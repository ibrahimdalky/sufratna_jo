/* ============================================
   سفرتنا — APP.JS — COMPLETE APPLICATION LOGIC
   Rewritten from scratch against real CSV data
   ============================================ */

(function () {
  'use strict';

  /* ──────────── CONSTANTS ──────────── */

  var CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vR9p3HjkTJAsmNyFCDCcYAzg1wot5iz6AcCWN618PRzqd8Zw6ZSbcYtZ85o-wTs6tLpBYWFvqD4yl9S/pub?output=csv';
  // The sheet URL above is intentionally kept unchanged. Cache only stores
  // the latest response so the menu can appear immediately on repeat visits.
  var MENU_CACHE_KEY = 'safratna_menu_csv_v1';
  var MENU_CACHE_MAX_AGE = 10 * 60 * 1000;
  var menuRequest = null;

  function fetchWithProxy(proxyUrl) {
    var controller = new AbortController();
    var timeout = setTimeout(function () { controller.abort(); }, 6000);
    return fetch(proxyUrl, { signal: controller.signal, cache: 'no-store' })
      .then(function (res) {
        clearTimeout(timeout);
        if (!res.ok) throw new Error('not ok');
        return res.text();
      })
      .then(function (text) {
        if (!text || text.length < 50 || text.indexOf(',') === -1) throw new Error('bad data');
        return text;
      })
      .catch(function (e) {
        clearTimeout(timeout);
        throw e;
      });
  }

  function fetchCSV(forceRefresh) {
    // Add a request-only cache buster on manual refresh. CSV_URL itself stays
    // untouched so the sheet connection remains exactly the same.
    var requestURL = forceRefresh ? CSV_URL + '&v=' + Date.now() : CSV_URL;
    var encoded = encodeURIComponent(requestURL);
    // Try direct URL first (fastest, works on most browsers when page is HTTPS)
    // Then race all proxies simultaneously as fallback
    var allUrls = [
      requestURL,
      'https://api.allorigins.win/raw?url=' + encoded,
      'https://corsproxy.io/?url=' + encoded,
      'https://thingproxy.freeboard.io/fetch/' + requestURL,
      'https://yacdn.org/serve/' + requestURL
    ];
    return Promise.any(allUrls.map(function (url) { return fetchWithProxy(url); }));
  }

  function readMenuCache() {
    try {
      var raw = localStorage.getItem(MENU_CACHE_KEY);
      if (!raw) return null;
      var cached = JSON.parse(raw);
      if (!cached || !cached.text) return null;
      return cached;
    } catch (e) {
      return null;
    }
  }

  function writeMenuCache(text) {
    try {
      localStorage.setItem(MENU_CACHE_KEY, JSON.stringify({
        text: text,
        savedAt: Date.now()
      }));
    } catch (e) { /* private browsing or a full storage quota */ }
  }

  var PLACEHOLDER_SVG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'%3E%3Crect width='200' height='200' fill='%23FAF6F0'/%3E%3Ctext x='100' y='108' text-anchor='middle' font-size='48' fill='%23BC4327'%3E🍽%3C/text%3E%3C/svg%3E";

  var WHATSAPP_SVG = '<svg viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>';

  /* ──────────── STATE ──────────── */

  var allProducts = [];
  var filteredProducts = [];
  var categories = [];
  var activeCategory = 'الكل';
  var cart = [];
  var lastCartAddition = null;
  var cartNoticeTimer = 0;
  var CART_STORAGE_KEY = 'safratna_cart_v1';

  /* ──────────── DOM REFERENCES ──────────── */

  var $skeletonLoader = document.getElementById('skeletonLoader');
  var $errorState     = document.getElementById('errorState');
  var $retryBtn       = document.getElementById('retryBtn');
  var $productSwiper  = document.getElementById('productSwiper');
  var $swiperWrapper  = document.getElementById('swiperWrapper');
  var $productDetails = document.getElementById('productDetails');
  var $categoryScroll = document.getElementById('categoryScroll');
  var $cartBadge      = document.getElementById('cartBadge');
  var $cartBarText    = document.getElementById('cartBarText');
  var $cartBarNotice  = document.getElementById('cartBarNotice');
  var $cartLastItem   = document.getElementById('cartLastItem');
  var $cartBarTotal   = document.getElementById('cartBarTotal');
  var $cartBar        = document.getElementById('cartBar');
  var $drawerOverlay  = document.getElementById('drawerOverlay');
  var $drawerContent  = document.getElementById('drawerContent');
  var $brandLogo      = document.getElementById('brandLogo');
  var $logoPlaceholder = document.getElementById('logoPlaceholder');
  var $journeyStartBtn = document.getElementById('journeyStartBtn');
  var $refreshBtn      = document.getElementById('refreshBtn');
  var $syncStatus      = document.getElementById('syncStatus');
  var $menuViewToolbar = document.getElementById('menuViewToolbar');
  var $swipeGuide      = document.getElementById('swipeGuide');

  /* ══════════════════════════════════════════
     2. HELPERS
     ══════════════════════════════════════════ */

  function escapeHTML(str) {
    if (!str) return '';
    var d = document.createElement('div');
    d.appendChild(document.createTextNode(str));
    return d.innerHTML;
  }

  function escapeAttr(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function loadCart() {
    try {
      var raw = localStorage.getItem(CART_STORAGE_KEY);
      var saved = raw ? JSON.parse(raw) : [];
      if (Array.isArray(saved)) cart = saved;
    } catch (e) { cart = []; }
  }

  function saveCart() {
    try { localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart)); } catch (e) { /* ignore */ }
  }

  /**
   * Extract a real image URL from an ImgBB HTML snippet or return as-is if
   * already a plain URL.
   *
   * Real CSV cells look like:
   *   <a href="https://ibb.co/..."><img src="https://i.ibb.co/…/file.jpg" …/></a>
   *
   * Inside the Google Sheets CSV export, quotes within a quoted field are
   * doubled (""), so after our CSV row parser un-doubles them we receive
   * standard HTML that this regex can match.
   */
  function extractImageUrl(raw) {
    if (!raw) return '';
    var s = raw.trim();
    // Already a direct URL
    if (s.indexOf('<') === -1 && (s.indexOf('http://') === 0 || s.indexOf('https://') === 0)) {
      return s;
    }
    // Extract src="..." from HTML
    var m = s.match(/src=["']([^"']+)["']/i);
    return m ? m[1] : '';
  }

  /* ══════════════════════════════════════════
     3. CSV ROW PARSER
     Handles quoted fields, doubled-quote escapes,
     embedded commas and newlines within quotes.
     ══════════════════════════════════════════ */

  function parseCSVRow(row) {
    var result = [];
    var cur = '';
    var inQ = false;
    for (var i = 0; i < row.length; i++) {
      var ch = row[i];
      if (inQ) {
        if (ch === '"') {
          if (i + 1 < row.length && row[i + 1] === '"') {
            cur += '"';
            i++; // skip doubled quote
          } else {
            inQ = false;
          }
        } else {
          cur += ch;
        }
      } else {
        if (ch === '"') {
          inQ = true;
        } else if (ch === ',') {
          result.push(cur);
          cur = '';
        } else {
          cur += ch;
        }
      }
    }
    result.push(cur);
    return result;
  }

  /* ══════════════════════════════════════════
     4. CSV FETCH & PARSE
     ══════════════════════════════════════════ */

  function fetchProducts(options) {
    options = options || {};
    var cached = readMenuCache();
    var hasUsableCache = cached && cached.text;

    $errorState.style.display = 'none';
    if (hasUsableCache) {
      // Paint cached data first. This keeps repeat visits almost instant while
      // the fresh sheet response is loaded in the background.
      handleCSV(cached.text);
      $skeletonLoader.style.display = 'none';
      $productSwiper.style.display = 'block';
      setSyncStatus(cached.savedAt && Date.now() - cached.savedAt <= MENU_CACHE_MAX_AGE ? 'آخر تحديث محفوظ' : 'نحدّث المنيو الآن…');
    } else {
      $skeletonLoader.style.display = 'grid';
      $productSwiper.style.display = 'none';
      setSyncStatus('نحمّل المنيو الآن…');
    }

    if (menuRequest) return menuRequest;
    if (options.force) setSyncStatus('نحدّث المنيو الآن…');

    menuRequest = fetchCSV(!!options.force)
      .then(function (text) {
        console.log('CSV loaded, length:', text.length);
        writeMenuCache(text);
        handleCSV(text);
        setSyncStatus('المنيو محدثة الآن');
      })
      .catch(function (err) {
        console.error('FETCH ERROR:', err);
        if (!hasUsableCache) {
          $skeletonLoader.style.display = 'none';
          $errorState.style.display = 'block';
          setSyncStatus('تعذر تحميل المنيو');
        } else {
          setSyncStatus('نعرض آخر نسخة محفوظة');
        }
      })
      .then(function () {
        menuRequest = null;
      });
    return menuRequest;
  }

  function setSyncStatus(message) {
    if ($syncStatus) $syncStatus.textContent = message || '';
  }

  function handleCSV(csvText) {
    // Split into lines, keep content, trim whitespace
    var rawLines = csvText.split('\n');
    var lines = [];
    for (var i = 0; i < rawLines.length; i++) {
      var t = rawLines[i].replace(/\r$/, '');
      lines.push(t);
    }

    /*
     * CRITICAL: The real spreadsheet has empty rows before the header.
     * We must find the header row dynamically by looking for the line
     * that starts with "id,name" (the known header pattern).
     */
    var headerIdx = -1;
    for (var i = 0; i < lines.length; i++) {
      var lower = lines[i].trim().toLowerCase();
      if (lower.indexOf('id') === 0 && lower.indexOf('name') !== -1) {
        headerIdx = i;
        break;
      }
    }

    if (headerIdx === -1 || headerIdx >= lines.length - 1) {
      $skeletonLoader.style.display = 'none';
      $errorState.style.display = 'block';
      return;
    }

    // Build column map from header
    var headers = parseCSVRow(lines[headerIdx]);
    var col = {};
    for (var i = 0; i < headers.length; i++) {
      col[headers[i].trim().toLowerCase()] = i;
    }

    // Optional presentation columns. Existing sheets do not need to change.
    var badgeCol = col['badge'] !== undefined ? col['badge'] :
      (col['tag'] !== undefined ? col['tag'] : col['شارة']);
    var featuredCol = col['is_featured'] !== undefined ? col['is_featured'] : col['featured'];

    // Validate required columns exist
    var required = ['id', 'name', 'category', 'base_price', 'description', 'image_url', 'sizes_and_prices', 'is_available'];
    for (var r = 0; r < required.length; r++) {
      if (col[required[r]] === undefined) {
        console.error('Missing column:', required[r], '| Found headers:', headers);
        $skeletonLoader.style.display = 'none';
        $errorState.style.display = 'block';
        return;
      }
    }

    // Logo from first data row
    var firstRow = parseCSVRow(lines[headerIdx + 1]);
    if (col['logo'] !== undefined && firstRow[col['logo']]) {
      var logoSrc = extractImageUrl(firstRow[col['logo']]);
      if (logoSrc) loadLogo(logoSrc);
    }

    // Parse all data rows
    var products = [];
    var catSet = {};

    for (var i = headerIdx + 1; i < lines.length; i++) {
      var line = lines[i].trim();
      if (!line) continue;

      var c = parseCSVRow(line);

      // is_available must be TRUE
      var avail = (c[col['is_available']] || '').trim().toUpperCase();
      if (avail !== 'TRUE') continue;

      // Parse sizes_and_prices: "وسط=2.5, كبير=4"
      var sizesRaw = (c[col['sizes_and_prices']] || '').trim();
      var sizes = [];
      if (sizesRaw && sizesRaw !== '-') {
        var chunks = sizesRaw.split(',');
        for (var j = 0; j < chunks.length; j++) {
          var part = chunks[j].trim();
          if (!part) continue;
          var eqIdx = part.indexOf('=');
          if (eqIdx !== -1) {
            var label = part.substring(0, eqIdx).trim();
            var price = parseFloat(part.substring(eqIdx + 1).trim());
            if (label && !isNaN(price)) {
              sizes.push({ label: label, price: price });
            }
          }
        }
      }

      var basePrice = parseFloat(c[col['base_price']]) || 0;
      var category = (c[col['category']] || '').trim();
      if (category) catSet[category] = true;

      var imgUrl = extractImageUrl(c[col['image_url']]);
      var badgeText = badgeCol !== undefined ? (c[badgeCol] || '').trim() : '';
      var isFeatured = featuredCol !== undefined && (c[featuredCol] || '').trim().toUpperCase() === 'TRUE';
      if (!badgeText && isFeatured) badgeText = 'الأكثر طلباً';

      products.push({
        id: (c[col['id']] || '').trim(),
        name: (c[col['name']] || '').trim(),
        category: category,
        base_price: basePrice,
        sizes: sizes,
        image_url: imgUrl,
        description: (c[col['description']] || '').trim(),
        badge: badgeText,
        selectedSize: sizes.length > 0 ? sizes[0] : null,
        selectedPrice: sizes.length > 0 ? sizes[0].price : basePrice
      });
    }

    if (products.length === 0) {
      $skeletonLoader.style.display = 'none';
      $errorState.style.display = 'block';
      return;
    }

    allProducts = products;
    categories = Object.keys(catSet);
    filteredProducts = allProducts.slice();

    renderCategories();
    renderProducts();

    $skeletonLoader.style.display = 'none';
    $productSwiper.style.display = 'block';
  }

  /* ──────────── LOGO ──────────── */

  function loadLogo(url) {
    if (!url || $brandLogo.getAttribute('src') === url) return;
    $brandLogo.onload = function () {
      $brandLogo.style.display = 'block';
      $logoPlaceholder.style.display = 'none';
    };
    $brandLogo.onerror = function () {
      $brandLogo.style.display = 'none';
      $logoPlaceholder.style.display = '';
      $brandLogo.removeAttribute('src');
    };
    $brandLogo.src = url;
  }

  /* ══════════════════════════════════════════
     5. CATEGORIES
     ══════════════════════════════════════════ */

  function renderCategories() {
    var html = '<button class="cat-pill active" data-cat="الكل"><span class="cat-name">الكل</span><span class="cat-count">' + allProducts.length + '</span></button>';
    for (var i = 0; i < categories.length; i++) {
      var count = 0;
      for (var j = 0; j < allProducts.length; j++) {
        if (allProducts[j].category === categories[i]) count++;
      }
      html += '<button class="cat-pill" data-cat="' + escapeAttr(categories[i]) + '"><span class="cat-name">' + escapeHTML(categories[i]) + '</span><span class="cat-count">' + count + '</span></button>';
    }
    $categoryScroll.innerHTML = html;
  }

  $categoryScroll.addEventListener('click', function (e) {
    var pill = e.target.closest('.cat-pill');
    if (!pill) return;
    var cat = pill.getAttribute('data-cat');
    if (cat === activeCategory) return;

    activeCategory = cat;
    var pills = $categoryScroll.querySelectorAll('.cat-pill');
    for (var i = 0; i < pills.length; i++) pills[i].classList.remove('active');
    pill.classList.add('active');

    if (cat === 'الكل') {
      filteredProducts = allProducts.slice();
    } else {
      filteredProducts = [];
      for (var i = 0; i < allProducts.length; i++) {
        if (allProducts[i].category === cat) filteredProducts.push(allProducts[i]);
      }
    }
    renderProducts();
  });

  /* ══════════════════════════════════════════
     6. RENDER PRODUCT SLIDES
     ══════════════════════════════════════════ */

  var detailsProduct = null;
  var detailsTrigger = null;

  function sizePillsMarkup(product, index, showPrice) {
    if (!product.sizes.length) return '';
    var html = '<div class="size-selector" role="group" aria-label="حجم الوجبة">';
    for (var i = 0; i < product.sizes.length; i++) {
      var size = product.sizes[i];
      var selected = size === product.selectedSize;
      var priceId = 'productSizePrice' + i;
      html += '<button type="button" class="size-pill' + (selected ? ' active' : '') + '" data-idx="' + index + '" data-si="' + i + '" aria-pressed="' + selected + '"' +
        (showPrice ? ' aria-label="' + escapeAttr(size.label) + '" aria-describedby="' + priceId + '"' : '') + '>' +
        (showPrice ? '<span class="detail-size-name">' + escapeHTML(size.label) + '</span>' : escapeHTML(size.label)) +
        (showPrice ? '<span class="detail-size-price" id="' + priceId + '"><bdi>' + size.price.toFixed(2) + '</bdi> د.أ</span>' : '') +
        '</button>';
    }
    return html + '</div>';
  }

  function gridPriceMarkup(product, index) {
    var prices = product.sizes.length ? product.sizes.map(function (size) { return size.price; }) : [product.base_price];
    var minimum = Math.min.apply(null, prices);
    var prefix = minimum < Math.max.apply(null, prices) ? '<span>من</span>' : '';
    return '<div class="grid-card-footer"><div class="grid-card-price" id="gridCardPrice' + index + '">' + prefix +
      '<bdi>' + minimum.toFixed(2) + '</bdi><span>د.أ</span></div>' +
      '<span class="grid-card-arrow" aria-hidden="true"></span></div>';
  }

  function keepOpenDetails() {
    if (!$productDetails.open || !detailsProduct) return -1;
    var retainedIndex = filteredProducts.indexOf(detailsProduct);
    if (retainedIndex < 0) {
      retainedIndex = filteredProducts.findIndex(function (product) {
        return product.id === detailsProduct.id && (product.id || product.name === detailsProduct.name);
      });
    }
    if (retainedIndex < 0) {
      $productDetails.close();
      return -1;
    }
    var product = filteredProducts[retainedIndex];
    if (product !== detailsProduct && detailsProduct.selectedSize) {
      var selectedLabel = detailsProduct.selectedSize.label;
      var retainedSize = product.sizes.find(function (size) { return size.label === selectedLabel; });
      if (retainedSize) {
        product.selectedSize = retainedSize;
        product.selectedPrice = retainedSize.price;
      }
    }
    detailsProduct = product;
    return retainedIndex;
  }

  function renderProducts() {
    var detailsIndex = keepOpenDetails();
    if (filteredProducts.length === 0) {
      $swiperWrapper.innerHTML = '<div class="product-slide"><div class="product-card"><div class="card-body" style="text-align:center;padding:40px 20px;"><p style="color:var(--text-secondary);">لا توجد منتجات في هذا القسم</p></div></div></div>';
      productGallery.reset();
      return;
    }

    var html = '';
    var bestsellerShown = false;
    for (var idx = 0; idx < filteredProducts.length; idx++) {
      var p = filteredProducts[idx];

      var imgSrc = p.image_url || PLACEHOLDER_SVG;
      // Presentation only: show one bestseller badge, exclusively for sheet ID 1.
      var showBestseller = p.id === '1' && !bestsellerShown;
      if (showBestseller) bestsellerShown = true;
      var badgeHTML = showBestseller
        ? '<span class="bestseller-hat" aria-hidden="true"><svg class="chef-hat-icon" viewBox="0 0 120 104" xmlns="http://www.w3.org/2000/svg"><path d="M30 56C15 58 5 47 8 31C11 16 25 9 40 15C47 0 71 0 82 17C99 9 116 24 112 41C110 56 99 63 87 59C70 62 48 62 30 56Z" fill="#F2B734" stroke="#FFD879" stroke-width="1.5"/><path d="M31 62Q58 68 88 62L86 92Q59 88 33 94Z" fill="#F2B734" stroke="#FFD879" stroke-width="1.5"/><path d="M20 31Q22 20 34 22M49 17Q60 10 70 19" fill="none" stroke="#FFE6A8" stroke-width="3" stroke-linecap="round" opacity="0.7"/></svg></span><span class="product-badge">الأكثر طلباً</span>'
        : '';
      var imageSource = idx === 0 ? 'src' : 'data-gallery-src';
      var imagePriority = idx === 0 ? 'high' : 'auto';

      html +=
        '<div class="product-slide" data-idx="' + idx + '">' +
          '<div class="product-card' + (showBestseller ? ' is-bestseller' : '') + '">' +
            badgeHTML +
            '<button type="button" class="card-image-wrap card-image-trigger" data-idx="' + idx + '" aria-label="تفاصيل ' + escapeAttr(p.name) + '" aria-haspopup="dialog" aria-controls="productDetails">' +
              '<img ' + imageSource + '="' + escapeAttr(imgSrc) + '" alt="" draggable="false" fetchpriority="' + imagePriority + '" decoding="async" onerror="this.onerror=null;this.src=\'' + PLACEHOLDER_SVG + '\';" />' +
              '<span class="suggested-product-badge" aria-hidden="true"><span>✦</span> اقتراحنا إلك</span>' +
              '<span class="card-details-cue" aria-hidden="true">التفاصيل ↑</span>' +
            '</button>' +
            '<div class="card-body">' +
              '<span class="card-category">' + escapeHTML(p.category) + '</span>' +
              '<h2 class="card-name">' + escapeHTML(p.name) + '</h2>' +
              gridPriceMarkup(p, idx) +
              '<p class="card-desc">' + escapeHTML(p.description) + '</p>' +
              sizePillsMarkup(p, idx) +
              '<div class="card-price" data-idx="' + idx + '">' +
                '<span class="price-value">' + p.selectedPrice.toFixed(2) + '</span> ' +
                '<span class="currency">د.أ</span>' +
              '</div>' +
              '<button class="add-to-cart-btn" data-idx="' + idx + '">🛒 أضف إلى السلة</button>' +
            '</div>' +
          '</div>' +
        '</div>';
    }

    $swiperWrapper.innerHTML = html;
    productGallery.reset(detailsIndex);
    if (detailsIndex >= 0) {
      detailsTrigger = productCardAt(detailsIndex).querySelector('.card-image-trigger');
      if (!detailsExit) {
        renderProductDetails(detailsProduct, detailsIndex);
        $productDetails.querySelector('.product-details-close').focus({ preventScroll: true });
      }
    }
  }

  /* ══════════════════════════════════════════
     7. CIRCULAR PRODUCT GALLERY
     ══════════════════════════════════════════ */

  var productGallery = (function () {
    var slides = [];
    var gridMode = false;
    var current = null;
    var suggestedPanel = null;
    var angle = 0;
    var angleStep = 0;
    var width = 0;
    var radius = 0;
    var perspective = 1000;
    var radians = Math.PI / 180;
    var direction = 1;
    var glide = 0;
    var alignment = null;
    var frame = 0;
    var previousTime = 0;
    var gesture = null;
    var suppressClick = false;
    var hasSwiped = false;
    var pauseOverride = null;
    var resumeAt = 0;
    var resumeTimer = 0;
    var distantPhotosReady = false;
    var distantPhotoTimer = 0;
    var toggle = document.getElementById('galleryMotionToggle');
    var ringView = document.getElementById('menuViewRing');
    var gridView = document.getElementById('menuViewGrid');
    var pickProduct = document.getElementById('menuPickProduct');
    var pickStatus = document.getElementById('menuPickStatus');
    var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    var inView = typeof IntersectionObserver === 'undefined';

    function wrap(index) {
      return ((index % slides.length) + slides.length) % slides.length;
    }

    function preloadImage(index, lowPriority, lazy) {
      var image = slides[wrap(index)].image;
      if (!image) return;
      if (!lowPriority && image.loading === 'lazy') image.loading = 'eager';
      if (!lowPriority && image.fetchPriority === 'low') image.fetchPriority = 'auto';
      if (!image.dataset.gallerySrc) return;
      if (lazy) image.loading = 'lazy';
      if (lowPriority) image.fetchPriority = 'low';
      image.src = image.dataset.gallerySrc;
      image.removeAttribute('data-gallery-src');
    }

    function showCurrent(index) {
      var next = slides[wrap(index)].panel;
      if (next === current) return;
      if (current) {
        if (current.contains(document.activeElement)) $productSwiper.focus({ preventScroll: true });
        current.classList.remove('is-current');
        current.setAttribute('inert', '');
        current.setAttribute('aria-hidden', 'true');
      }
      next.classList.add('is-current');
      next.removeAttribute('inert');
      next.removeAttribute('aria-hidden');
      current = next;
      preloadImage(index);
      preloadImage(index - 1);
      preloadImage(index + 1);
    }

    function prioritizeOpeningPhoto() {
      clearTimeout(distantPhotoTimer);
      var first = slides.length ? slides[0].image : null;
      distantPhotosReady = !first || first.complete;
      if (distantPhotosReady) return;

      function warmDistantPhotos() {
        if (!slides.length || slides[0].image !== first || distantPhotosReady) return;
        clearTimeout(distantPhotoTimer);
        distantPhotosReady = true;
        queueFrame();
      }
      first.addEventListener('load', warmDistantPhotos, { once: true });
      first.addEventListener('error', warmDistantPhotos, { once: true });
      distantPhotoTimer = setTimeout(warmDistantPhotos, 1800);
    }

    function paint() {
      if (gridMode || !slides.length) return;
      showCurrent(slides.length === 1 ? 0 : Math.round(angle / angleStep));
      $swiperWrapper.style.transform = 'translateZ(' + -radius + 'px) rotateY(' + angle + 'deg)';

      // The track rotates as one object. All cards keep fixed slots on the
      // cylinder, with the far side dimmed and its faces readable.
      var facingLimit = radius / (perspective + radius);
      for (var i = 0; i < slides.length; i++) {
        var item = slides[i];
        var panelAngle = angle - i * angleStep;
        var phase = panelAngle * radians;
        var cosine = Math.cos(phase);
        if (slides.length <= 3) {
          // Sparse rings still show the photos when the panels pass the sides.
          item.panel.style.setProperty('--panel-face', Math.sin(phase) * 55 - panelAngle + 'deg');
        } else {
          var faceAway = cosine < facingLimit;
          if (faceAway !== item.faceAway) {
            item.panel.classList.toggle('is-facing-away', faceAway);
            item.faceAway = faceAway;
          }
        }
        var opacity = Math.min(1, Math.round((0.49 + 0.51 * (1 + cosine) / 1.92) * 100) / 100);
        if (opacity !== item.opacity) {
          item.panel.style.opacity = opacity;
          item.opacity = opacity;
        }
        if (distantPhotosReady && item.image && item.image.dataset.gallerySrc) {
          var distance = radius * (1 - cosine);
          var x = Math.abs(radius * Math.sin(phase) * perspective / (perspective + distance));
          if (x < width * 0.82) preloadImage(i, true);
        }
      }
    }

    function autoEnabled() {
      return pauseOverride === null ? !reducedMotion.matches : !pauseOverride;
    }

    function canAnimate() {
      return !gridMode && slides.length > 1 && inView && !document.hidden && !$productDetails.open && !$drawerOverlay.classList.contains('open');
    }

    function canAutoplay(now) {
      var focus = document.activeElement;
      return autoEnabled() && now >= resumeAt &&
        (!focus || focus === toggle || !$productSwiper.contains(focus) || !focus.matches(':focus-visible'));
    }

    function queueFrame() {
      if (!gridMode && !frame) frame = requestAnimationFrame(tick);
    }

    function tick(now) {
      frame = 0;
      var onSettled = null;
      var elapsed = previousTime ? Math.min(32, Math.max(0, now - previousTime)) : 0;
      if (!gesture && canAnimate()) {
        if (alignment) {
          var progress = Math.min(1, Math.max(0, (now - alignment.time) / alignment.duration));
          angle = alignment.from + (alignment.to - alignment.from) * (1 - Math.pow(1 - progress, 3));
          if (progress === 1) {
            onSettled = alignment.onSettled;
            alignment = null;
          }
        } else {
          var idleSpeed = canAutoplay(now) ? direction * 18 / (radius * radians) : 0;
          if (suggestedPanel && elapsed && (glide || idleSpeed)) clearSuggestion();
          angle += (glide + idleSpeed) * elapsed / 1000;
          glide *= Math.exp(-elapsed / 160);
          if (Math.abs(glide) < 0.45) glide = 0;
        }
        angle %= 360;
      }
      paint();
      if (onSettled) onSettled();

      if (!gesture && canAnimate() && (alignment || glide || canAutoplay(now))) {
        previousTime = now;
        queueFrame();
      } else {
        previousTime = 0;
      }
    }

    function holdFor(milliseconds) {
      resumeAt = performance.now() + milliseconds;
      clearTimeout(resumeTimer);
      resumeTimer = setTimeout(queueFrame, milliseconds + 20);
    }

    function centerCard(target, duration, onSettled) {
      glide = 0;
      if (reducedMotion.matches || !canAnimate()) {
        angle = target % 360;
        alignment = null;
        paint();
        if (onSettled) onSettled();
      } else {
        alignment = { from: angle, to: target, time: performance.now(), duration: duration || 240, onSettled: onSettled };
        queueFrame();
      }
    }

    function clearSuggestion() {
      if (!suggestedPanel) return;
      suggestedPanel.classList.remove('is-suggested');
      suggestedPanel = null;
      pickStatus.textContent = '';
    }

    function showSuggestion(index) {
      suggestedPanel = slides[index].panel;
      suggestedPanel.classList.add('is-suggested');
      pickStatus.textContent = 'اقتراحنا إلك: ' + filteredProducts[index].name;
      holdFor(5000);
    }

    function updateControls() {
      $menuViewToolbar.hidden = filteredProducts.length === 0;
      ringView.setAttribute('aria-pressed', String(!gridMode));
      gridView.setAttribute('aria-pressed', String(gridMode));
      toggle.hidden = gridMode || slides.length <= 1;
      toggle.textContent = autoEnabled() ? 'إيقاف الدوران' : 'تشغيل الدوران';
      $swipeGuide.classList.toggle('is-hidden', gridMode || hasSwiped || slides.length <= 1);
    }

    function prepareGrid() {
      current = null;
      $swiperWrapper.style.removeProperty('transform');
      slides.forEach(function (item, index) {
        item.panel.classList.remove('is-current');
        item.panel.removeAttribute('inert');
        item.panel.removeAttribute('aria-hidden');
        item.panel.style.removeProperty('opacity');
        item.opacity = null;
        var trigger = item.panel.querySelector('.card-image-trigger');
        if (trigger) trigger.setAttribute('aria-describedby', 'gridCardPrice' + index);
        preloadImage(index, index > 1, index > 1);
      });
    }

    function prepareRing() {
      current = null;
      slides.forEach(function (item) {
        item.panel.setAttribute('inert', '');
        item.panel.setAttribute('aria-hidden', 'true');
        var trigger = item.panel.querySelector('.card-image-trigger');
        if (trigger) trigger.removeAttribute('aria-describedby');
      });
      layout();
      queueFrame();
    }

    function selectView(showGrid) {
      if (gridMode === showGrid) return;
      finishGesture(true);
      clearSuggestion();
      cancelAnimationFrame(frame);
      clearTimeout(resumeTimer);
      frame = previousTime = glide = resumeAt = 0;
      alignment = null;
      suppressClick = false;
      gridMode = showGrid;
      $productSwiper.classList.toggle('is-grid', gridMode);
      $productSwiper.setAttribute('aria-label', gridMode ? 'عرض أصناف سفرتنا' : 'معرض أصناف سفرتنا');
      if (gridMode) prepareGrid();
      else {
        prepareRing();
        var bounds = $productSwiper.getBoundingClientRect();
        inView = Math.min(window.innerHeight, bounds.bottom) - Math.max(0, bounds.top) >= bounds.height * 0.2;
      }
      updateControls();
    }

    ringView.addEventListener('click', function () { selectView(false); });
    gridView.addEventListener('click', function () { selectView(true); });
    pickProduct.addEventListener('click', function () {
      if (!filteredProducts.length) return;
      selectView(false);
      finishGesture(true);
      var origin = alignment ? alignment.to : angle;
      var previousIndex = wrap(Math.round(origin / angleStep));
      var count = filteredProducts.length;
      var index = count > 1 ? wrap(previousIndex + 1 + Math.floor(Math.random() * (count - 1))) : 0;
      var distance = ((index * angleStep - angle) % 360 + 360) % 360;
      if (distance > 300) distance -= 360;
      clearSuggestion();
      holdFor(5500);
      centerCard(angle + distance, Math.min(870, 540 + Math.abs(distance)), function () {
        showSuggestion(index);
      });
    });

    function degreesPerPixel() {
      // Keep small categories responsive without changing the size of their ring.
      return Math.max(1 / (radius * radians), angleStep / (width * 0.72));
    }

    function finishGesture(cancelled) {
      if (!gesture) return;
      var ended = gesture;
      gesture = null;
      if (ended.dragging) {
        $productSwiper.classList.remove('is-dragging');
        if ($productSwiper.hasPointerCapture(ended.id)) $productSwiper.releasePointerCapture(ended.id);
        if (!cancelled && Math.abs(angle - ended.start) > 0.5) direction = Math.sign(angle - ended.start);
        if (reducedMotion.matches) {
          centerCard(Math.round(angle / angleStep) * angleStep);
        } else if (!cancelled && performance.now() - ended.lastTime < 100) {
          glide = ended.speed * degreesPerPixel() * 1000;
        }
        hasSwiped = true;
        updateControls();
      } else if (!cancelled) {
        holdFor(1200);
      }
      queueFrame();
    }

    $productSwiper.addEventListener('pointerdown', function (event) {
      if (gridMode || gesture || !event.isPrimary || event.button !== 0) return;
      suppressClick = false;
      if (slides.length <= 1 || toggle.contains(event.target)) return;
      alignment = null;
      glide = 0;
      previousTime = 0;
      gesture = {
        id: event.pointerId, x: event.clientX, y: event.clientY, start: angle,
        lastX: event.clientX, lastTime: performance.now(), speed: 0, dragging: false
      };
    });

    $productSwiper.addEventListener('pointermove', function (event) {
      if (!gesture || gesture.id !== event.pointerId) return;
      var dx = event.clientX - gesture.x;
      var dy = event.clientY - gesture.y;
      if (!gesture.dragging) {
        if (Math.abs(dy) > 8 && Math.abs(dy) >= Math.abs(dx)) { finishGesture(true); return; }
        if (Math.abs(dx) < 8 || Math.abs(dx) <= Math.abs(dy)) return;
        clearSuggestion();
        gesture.dragging = true;
        suppressClick = true;
        $productSwiper.setPointerCapture(event.pointerId);
        $productSwiper.classList.add('is-dragging');
      }
      var now = performance.now();
      var speed = (event.clientX - gesture.lastX) / Math.max(8, now - gesture.lastTime);
      gesture.speed = Math.max(-1.4, Math.min(1.4, 0.4 * gesture.speed + 0.6 * speed));
      gesture.lastX = event.clientX;
      gesture.lastTime = now;
      angle = gesture.start + dx * degreesPerPixel();
      queueFrame();
    });

    window.addEventListener('pointerup', function (event) {
      if (gesture && gesture.id === event.pointerId) finishGesture(false);
    });
    window.addEventListener('pointercancel', function (event) {
      if (gesture && gesture.id === event.pointerId) finishGesture(true);
    });
    $productSwiper.addEventListener('lostpointercapture', function (event) {
      if (event.target === $productSwiper && gesture && gesture.id === event.pointerId) finishGesture(true);
    });
    window.addEventListener('blur', function () { finishGesture(true); });

    $productSwiper.addEventListener('click', function (event) {
      if (!suppressClick || event.detail === 0) return;
      event.preventDefault();
      event.stopPropagation();
    }, true);

    $swiperWrapper.addEventListener('click', function (event) {
      if (slides.length <= 1 || !current || !current.contains(event.target) || event.target.closest('.card-image-trigger')) return;
      holdFor(5500);
      centerCard(Math.round(angle / angleStep) * angleStep);
    });

    $productSwiper.addEventListener('keydown', function (event) {
      if (gridMode || slides.length <= 1 || gesture || (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft')) return;
      event.preventDefault();
      clearSuggestion();
      direction = event.key === 'ArrowRight' ? 1 : -1;
      hasSwiped = true;
      updateControls();
      holdFor(3500);
      var target = alignment ? alignment.to : Math.round(angle / angleStep) * angleStep;
      centerCard(target + direction * angleStep);
    });

    toggle.addEventListener('click', function () {
      pauseOverride = autoEnabled();
      alignment = null;
      glide = 0;
      resumeAt = 0;
      queueFrame();
      updateControls();
    });

    function layout() {
      angleStep = 360 / Math.max(1, slides.length);
      radius = 0;
      if (slides.length > 1) {
        var cardWidth = slides[0].panel.offsetWidth || Math.min(width <= 360 ? 260 : 300, width * 0.85);
        var halfAngle = Math.min(Math.PI / 4, angleStep * radians / 2);
        // Neighboring panels must not intersect, even in larger menus.
        var clearance = (cardWidth + 18) / (2 * Math.tan(halfAngle));
        radius = Math.max(clearance, width * 0.55 / Math.sin(Math.min(Math.PI / 2, angleStep * radians)));
      }
      $swiperWrapper.style.setProperty('--ring-radius', radius + 'px');
      slides.forEach(function (item, index) {
        item.panel.style.setProperty('--panel-angle', -index * angleStep + 'deg');
      });
      paint();
    }

    function resize() {
      var measured = $productSwiper.clientWidth || Math.min(window.innerWidth, 480);
      if (measured === width) return;
      finishGesture(true);
      width = measured;
      if (!gridMode) layout();
    }

    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(resize).observe($productSwiper);
    else window.addEventListener('resize', resize);
    if (typeof IntersectionObserver !== 'undefined') {
      new IntersectionObserver(function (entries) {
        var entry = entries[0];
        inView = entry.isIntersecting && entry.intersectionRatio >= 0.2;
        if (!inView) glide = 0;
        queueFrame();
      }, { threshold: 0.2 }).observe($productSwiper);
    }
    new MutationObserver(queueFrame).observe($drawerOverlay, { attributes: true, attributeFilter: ['class'] });
    document.addEventListener('visibilitychange', function () {
      previousTime = 0;
      if (document.hidden) { glide = 0; finishGesture(true); }
      queueFrame();
    });
    $productSwiper.addEventListener('focusin', queueFrame);
    $productSwiper.addEventListener('focusout', queueFrame);
    function onMotionPreferenceChange() {
      glide = 0;
      if (alignment && reducedMotion.matches) centerCard(alignment.to, alignment.duration, alignment.onSettled);
      updateControls();
      queueFrame();
    }
    if (reducedMotion.addEventListener) reducedMotion.addEventListener('change', onMotionPreferenceChange);
    else reducedMotion.addListener(onMotionPreferenceChange);

    return {
      isGrid: function () { return gridMode; },
      lockToProduct: function (index) {
        alignment = null;
        glide = previousTime = 0;
        angle = index * angleStep;
        paint();
      },
      releaseProduct: function () {
        if (gridMode) return;
        holdFor(5000);
        queueFrame();
      },
      reset: function (index) {
        finishGesture(true);
        clearSuggestion();
        cancelAnimationFrame(frame);
        clearTimeout(resumeTimer);
        frame = previousTime = resumeAt = angle = glide = 0;
        alignment = current = null;
        suppressClick = false;
        width = $productSwiper.clientWidth || Math.min(window.innerWidth, 480);
        slides = Array.from($swiperWrapper.children, function (panel) {
          return { panel: panel, image: panel.querySelector('img'), opacity: 1, faceAway: false };
        });
        prioritizeOpeningPhoto();
        angleStep = 360 / Math.max(1, slides.length);
        if (index >= 0 && slides.length) angle = index * angleStep;
        updateControls();
        if (gridMode) prepareGrid();
        else prepareRing();
      }
    };
  })();
  /* ══════════════════════════════════════════
     8. EVENT DELEGATION — SIZE PILLS & ADD TO CART
     ══════════════════════════════════════════ */

  function productCardAt(index) {
    return $swiperWrapper.querySelector('.product-slide[data-idx="' + index + '"] .product-card');
  }

  function renderProductDetails(product, index) {
    if (stopPhotoFlight) stopPhotoFlight();
    var card = productCardAt(index);
    var cardImage = card ? card.querySelector('img') : null;
    var imageSource = (cardImage && cardImage.currentSrc) || product.image_url || PLACEHOLDER_SVG;
    $productDetails.innerHTML =
      '<div class="product-details-panel">' +
        '<header class="product-details-header">' +
          '<div>' +
            (product.category ? '<p class="product-details-category">' + escapeHTML(product.category) + '</p>' : '') +
            '<h2 id="productDetailsTitle">' + escapeHTML(product.name) + '</h2>' +
          '</div>' +
          '<button type="button" class="product-details-close" aria-label="إغلاق تفاصيل الصنف" autofocus>×</button>' +
        '</header>' +
        '<div class="product-details-content">' +
          '<div class="product-details-summary">' +
            '<img class="product-details-photo" src="' + escapeAttr(imageSource) + '" alt="" decoding="async" />' +
            (product.description ? '<p>' + escapeHTML(product.description) + '</p>' : '') +
          '</div>' +
          (product.sizes.length ? '<p class="product-details-size-label">اختر الحجم</p>' + sizePillsMarkup(product, index, true) : '') +
        '</div>' +
        '<footer class="product-details-footer">' +
          '<div class="product-details-total">' +
            '<span>السعر</span>' +
            '<div class="card-price" aria-live="polite"><span class="price-value">' + product.selectedPrice.toFixed(2) +
              '</span> <span class="currency">د.أ</span></div>' +
          '</div>' +
          '<button type="button" class="add-to-cart-btn" data-idx="' + index + '">🛒 أضف إلى السلة</button>' +
          '<span class="product-details-feedback" role="status"></span>' +
        '</footer>' +
      '</div>';

    $productDetails.querySelector('.product-details-photo').addEventListener('error', function () {
      this.src = PLACEHOLDER_SVG;
    }, { once: true });
  }

  var stopPhotoFlight = null;
  var detailsExit = null;

  function photoBounds(element, top, bottom) {
    if (!element || !element.isConnected) return null;
    var rect = element.getBoundingClientRect();
    var visibleHeight = Math.min(rect.bottom, bottom) - Math.max(rect.top, top);
    return rect.width > 0 && rect.height > 0 && visibleHeight >= Math.min(24, rect.height) ? rect : null;
  }

  function moveProductPhoto(image, from, to, covers, duration) {
    if (!from || !to || !image || !image.complete || !image.naturalWidth || !image.currentSrc || feedbackMotionPreference.matches) return;
    var flight = document.createElement('img');
    if (typeof flight.showPopover !== 'function' || typeof flight.animate !== 'function') return;

    flight.className = 'product-photo-flight';
    flight.alt = '';
    flight.setAttribute('aria-hidden', 'true');
    flight.setAttribute('popover', 'manual');
    flight.src = image.currentSrc;
    flight.style.left = from.left + 'px';
    flight.style.top = from.top + 'px';
    flight.style.width = from.width + 'px';
    flight.style.height = from.height + 'px';
    document.body.appendChild(flight);
    try {
      flight.showPopover();
    } catch (error) {
      flight.remove();
      return;
    }

    covers = covers.filter(Boolean);
    covers.forEach(function (element) { element.classList.add('is-photo-in-flight'); });
    var dx = to.left - from.left;
    var dy = to.top - from.top;
    var scaleX = to.width / from.width;
    var scaleY = to.height / from.height;
    var movement = flight.animate([
      { transform: 'none' },
      { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(' + scaleX + ',' + scaleY + ')' }
    ], { duration: duration, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'forwards' });

    function cleanUp() {
      if (stopPhotoFlight !== cancel) return;
      flight.remove();
      covers.forEach(function (element) { element.classList.remove('is-photo-in-flight'); });
      stopPhotoFlight = null;
    }
    function cancel() {
      movement.cancel();
      cleanUp();
    }
    stopPhotoFlight = cancel;
    movement.finished.then(cleanUp, cleanUp);
  }

  function openProductDetails(trigger) {
    if ($productDetails.open || detailsExit || typeof $productDetails.showModal !== 'function') return;
    var index = Number(trigger.dataset.idx);
    var product = filteredProducts[index];
    if (!product || (!productGallery.isGrid() && !trigger.closest('.product-slide.is-current'))) return;

    var image = trigger.querySelector('img');
    var source = photoBounds(trigger, 0, $cartBar.getBoundingClientRect().top);

    detailsProduct = product;
    detailsTrigger = trigger;
    renderProductDetails(product, index);
    $productDetails.showModal();
    document.documentElement.classList.add('has-product-details');
    productGallery.lockToProduct(index);

    var thumbnail = $productDetails.querySelector('.product-details-photo');
    var destination = thumbnail.getBoundingClientRect();
    var sheetTravel = Math.max(0, $productDetails.getBoundingClientRect().bottom - window.innerHeight);
    moveProductPhoto(image, source, {
      left: destination.left, top: destination.top - sheetTravel,
      width: destination.width, height: destination.height
    }, [image, thumbnail], 285);
  }

  function requestDetailsClose() {
    if (!$productDetails.open || detailsExit) return;
    if (feedbackMotionPreference.matches || typeof $productDetails.animate !== 'function') {
      $productDetails.close();
      return;
    }

    var thumbnail = $productDetails.querySelector('.product-details-photo');
    var content = $productDetails.querySelector('.product-details-content').getBoundingClientRect();
    var from = !stopPhotoFlight && photoBounds(thumbnail, Math.max(0, content.top), Math.min(window.innerHeight, content.bottom));
    if (stopPhotoFlight) stopPhotoFlight();
    var to = photoBounds(detailsTrigger, 0, $cartBar.getBoundingClientRect().top);
    var targetImage = to ? detailsTrigger.querySelector('img') : null;

    var sheetTransform = getComputedStyle($productDetails).transform;
    $productDetails.classList.add('is-closing');
    moveProductPhoto(thumbnail, from, to, [thumbnail, targetImage], 220);
    var exit = $productDetails.animate([
      { transform: sheetTransform }, { transform: 'translateY(100%)' }
    ], { duration: 220, easing: 'ease-in', fill: 'forwards' });
    detailsExit = exit;
    function finishClose() {
      if (detailsExit === exit && $productDetails.open) $productDetails.close();
    }
    exit.finished.then(finishClose, finishClose);
  }

  var pressedDetailsBackdrop = false;
  $productDetails.addEventListener('pointerdown', function (event) {
    pressedDetailsBackdrop = event.target === $productDetails;
  });
  $productDetails.addEventListener('cancel', function (event) {
    event.preventDefault();
    requestDetailsClose();
  });
  $productDetails.addEventListener('close', function () {
    if ($productDetails.open) return;
    if (stopPhotoFlight) stopPhotoFlight();
    if (detailsExit) {
      var exit = detailsExit;
      detailsExit = null;
      exit.cancel();
    }
    $productDetails.classList.remove('is-closing');
    document.documentElement.classList.remove('has-product-details');
    if (detailsTrigger && detailsTrigger.isConnected && !detailsTrigger.closest('[inert]')) {
      detailsTrigger.focus({ preventScroll: true });
    }
    detailsTrigger = detailsProduct = null;
    pressedDetailsBackdrop = false;
    productGallery.releaseProduct();
    if (lastCartAddition && lastCartAddition.deferred) showCartAdditionNotice();
  });

  var feedbackMotionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  var feedbackAnimations = new WeakMap();

  function animateFeedback(element, frames, duration) {
    if (!element.animate || feedbackMotionPreference.matches) return;
    var running = feedbackAnimations.get(element);
    if (running) running.cancel();
    feedbackAnimations.set(element, element.animate(frames, {
      duration: duration,
      easing: 'cubic-bezier(0.22, 1, 0.36, 1)'
    }));
  }

  function syncProductChoices(container, product, shouldAnimate) {
    if (!container) return;
    container.querySelectorAll('.size-pill').forEach(function (pill) {
      var selected = product.sizes[Number(pill.dataset.si)] === product.selectedSize;
      pill.classList.toggle('active', selected);
      pill.setAttribute('aria-pressed', String(selected));
    });
    var value = container.querySelector('.price-value');
    var formattedPrice = product.selectedPrice.toFixed(2);
    if (!value || value.textContent === formattedPrice) return;
    value.textContent = formattedPrice;
    if (shouldAnimate) {
      animateFeedback(value, [
        { opacity: 0.55, transform: 'translateY(4px)' },
        { opacity: 1, transform: 'translateY(0)' }
      ], 205);
    }
  }

  function handleProductAction(event) {
    var target = event.target;
    var inDetails = event.currentTarget === $productDetails;
    if (inDetails && detailsExit) return;
    if (inDetails && (target.closest('.product-details-close') ||
        (target === $productDetails && pressedDetailsBackdrop))) {
      requestDetailsClose();
      return;
    }

    var image = target.closest('.card-image-trigger');
    if (!image && !inDetails && productGallery.isGrid()) {
      var gridCard = target.closest('.product-card');
      if (gridCard) image = gridCard.querySelector('.card-image-trigger');
    }
    if (image) {
      openProductDetails(image);
      return;
    }

    var button = target.closest('.size-pill, .add-to-cart-btn');
    if (!button) return;
    var index = Number(button.dataset.idx);
    var product = filteredProducts[index];
    if (!product || (inDetails && product !== detailsProduct)) return;

    var card = productCardAt(index);
    if (button.classList.contains('size-pill')) {
      var size = product.sizes[Number(button.dataset.si)];
      if (!size) return;
      animateFeedback(button, [
        { transform: 'scale(0.94)' },
        { transform: 'scale(1)' }
      ], 170);
      product.selectedSize = size;
      product.selectedPrice = size.price;
      syncProductChoices(card, product, !inDetails);
      if (inDetails) syncProductChoices($productDetails, product, true);
      return;
    }

    if (button.classList.contains('success')) return;
    addToCart(product);
    if (navigator.vibrate) navigator.vibrate(8);

    button.classList.add('success');
    button.textContent = '✓ تمت الإضافة';
    var feedback = inDetails ? $productDetails.querySelector('.product-details-feedback') : null;
    if (feedback) feedback.textContent = 'انضاف للسلة: ' + product.name;
    setTimeout(function () {
      button.classList.remove('success');
      button.textContent = '🛒 أضف إلى السلة';
      if (feedback) feedback.textContent = '';
    }, 1200);

    var cardImage = !inDetails && card ? card.querySelector('.card-image-wrap img') : null;
    if (cardImage) flyToCart(cardImage);
  }

  $swiperWrapper.addEventListener('click', handleProductAction);
  $productDetails.addEventListener('click', handleProductAction);

  /* ══════════════════════════════════════════
     9. CART SYSTEM
     ══════════════════════════════════════════ */

  function addToCart(product) {
    var sizeLabel = product.selectedSize ? product.selectedSize.label : null;
    var price = product.selectedPrice;

    // Check for existing item with same product + size
    var existing = null;
    for (var i = 0; i < cart.length; i++) {
      if (cart[i].productId === product.id && cart[i].size === sizeLabel) {
        existing = cart[i];
        break;
      }
    }

    if (existing) {
      existing.quantity++;
    } else {
      cart.push({
        productId: product.id,
        name: product.name,
        image_url: product.image_url,
        size: sizeLabel,
        price: price,
        quantity: 1
      });
    }

    saveCart();
    updateCartUI();
    rememberCartAddition(product, sizeLabel);
  }

  function removeFromCart(productId, size) {
    var next = [];
    for (var i = 0; i < cart.length; i++) {
      if (!(cart[i].productId === productId && cart[i].size === size)) {
        next.push(cart[i]);
      }
    }
    cart = next;
    saveCart();
    updateCartUI();
    renderDrawerCart();
  }

  function updateQuantity(productId, size, delta) {
    for (var i = 0; i < cart.length; i++) {
      if (cart[i].productId === productId && cart[i].size === size) {
        cart[i].quantity += delta;
        if (cart[i].quantity <= 0) {
          removeFromCart(productId, size);
          return;
        }
        break;
      }
    }
    saveCart();
    updateCartUI();
    renderDrawerCart();
  }

  function getCartTotal() {
    var sum = 0;
    for (var i = 0; i < cart.length; i++) sum += cart[i].price * cart[i].quantity;
    return sum;
  }

  function getCartCount() {
    var sum = 0;
    for (var i = 0; i < cart.length; i++) sum += cart[i].quantity;
    return sum;
  }

  function updateCartUI() {
    var count = getCartCount();
    var total = getCartTotal();

    if (lastCartAddition && !cart.some(function (item) {
      return item.productId === lastCartAddition.id && item.size === lastCartAddition.size;
    })) clearCartAdditionNotice();

    if (count > 0) {
      $cartBar.classList.add('has-items');
      $cartBadge.style.display = 'flex';
      $cartBadge.textContent = count;
      $cartBadge.classList.remove('bounce');
      void $cartBadge.offsetWidth; // reflow to restart animation
      $cartBadge.classList.add('bounce');
      $cartBarText.innerHTML = 'سلة المشتريات';
      $cartBarTotal.textContent = total.toFixed(2) + ' د.أ';
    } else {
      $cartBar.classList.remove('has-items');
      $cartBadge.style.display = 'none';
      $cartBarText.innerHTML = '<span class="muted">سلتك فارغة</span>';
      $cartBarTotal.textContent = '';
    }
  }

  /* ══════════════════════════════════════════
     10. FLY-TO-CART ANIMATION
     ══════════════════════════════════════════ */

  function flyToCart(imgEl) {
    var imgRect = imgEl.getBoundingClientRect();
    var barRect = $cartBar.getBoundingClientRect();

    var clone = document.createElement('div');
    clone.className = 'fly-clone';
    clone.style.width = '60px';
    clone.style.height = '60px';
    clone.style.top = (imgRect.top + imgRect.height / 2 - 30) + 'px';
    clone.style.left = (imgRect.left + imgRect.width / 2 - 30) + 'px';

    var cImg = document.createElement('img');
    cImg.src = imgEl.src;
    clone.appendChild(cImg);
    document.body.appendChild(clone);

    var dx = barRect.left + 30 - (imgRect.left + imgRect.width / 2);
    var dy = barRect.top + barRect.height / 2 - (imgRect.top + imgRect.height / 2);

    requestAnimationFrame(function () {
      clone.style.transform = 'translate(' + dx + 'px, ' + dy + 'px) scale(0.1)';
      clone.style.opacity = '0';
    });

    clone.addEventListener('transitionend', function handler() {
      clone.removeEventListener('transitionend', handler);
      if (clone.parentNode) clone.parentNode.removeChild(clone);
    });
  }

  /* ══════════════════════════════════════════
     11. CART ADDITION FEEDBACK
     ══════════════════════════════════════════ */

  function clearCartAdditionNotice() {
    clearTimeout(cartNoticeTimer);
    cartNoticeTimer = 0;
    lastCartAddition = null;
    $cartBar.classList.remove('has-addition');
    $cartBarNotice.hidden = true;
    $cartLastItem.textContent = '';
  }

  function rememberCartAddition(product, sizeLabel) {
    clearCartAdditionNotice();
    lastCartAddition = {
      id: product.id,
      size: sizeLabel,
      name: product.name,
      deferred: $productDetails.open
    };
    if (!lastCartAddition.deferred) showCartAdditionNotice();
  }

  function showCartAdditionNotice() {
    lastCartAddition.deferred = false;
    $cartBarNotice.hidden = false;
    $cartLastItem.textContent = lastCartAddition.name;
    $cartBar.classList.add('has-addition');
    animateFeedback($cartBarNotice, [
      { opacity: 0.6, transform: 'translateY(4px)' },
      { opacity: 1, transform: 'translateY(0)' }
    ], 180);
    cartNoticeTimer = setTimeout(clearCartAdditionNotice, 2800);
  }

  /* ══════════════════════════════════════════
     12. CART DRAWER
     ══════════════════════════════════════════ */

  // Open drawer on cart bar click (whole bar is clickable)
  $cartBar.addEventListener('click', function () {
    openDrawer();
  });

  // Close on overlay click
  $drawerOverlay.addEventListener('click', function (e) {
    if (e.target === $drawerOverlay) closeDrawer();
  });

  function openDrawer() {
    renderDrawerCart();
    $drawerOverlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeDrawer() {
    $drawerOverlay.classList.remove('open');
    document.body.style.overflow = '';
  }

  function renderDrawerCart() {
    if (cart.length === 0) {
      $drawerContent.innerHTML =
        '<div class="drawer-header">' +
          '<span class="drawer-title">سلة المشتريات 🛒</span>' +
          '<button class="drawer-close" data-action="close">✕</button>' +
        '</div>' +
        '<div class="empty-cart">' +
          '<span class="empty-cart-icon">🛒</span>' +
          '<p class="empty-cart-title">سلتك فارغة</p>' +
          '<p class="empty-cart-sub">أضف بعض المنتجات</p>' +
        '</div>';
      bindDrawerEvents();
      return;
    }

    var itemsHTML = '';
    for (var i = 0; i < cart.length; i++) {
      var item = cart[i];
      var sizeText = item.size || '';
      var subtotal = (item.price * item.quantity).toFixed(2);
      var imgSrc = item.image_url || PLACEHOLDER_SVG;

      itemsHTML +=
        '<div class="cart-item-row">' +
          '<img class="cart-item-thumb" src="' + escapeAttr(imgSrc) + '" alt="" onerror="this.onerror=null;this.src=\'' + PLACEHOLDER_SVG + '\';" />' +
          '<div class="cart-item-info">' +
            '<div class="cart-item-name">' + escapeHTML(item.name) + '</div>' +
            (sizeText ? '<div class="cart-item-size">' + escapeHTML(sizeText) + '</div>' : '') +
          '</div>' +
          '<div class="cart-item-controls">' +
            '<button class="delete-btn" data-action="delete" data-pid="' + escapeAttr(item.productId) + '" data-size="' + escapeAttr(item.size || '') + '">🗑</button>' +
            '<button class="qty-btn" data-action="minus" data-pid="' + escapeAttr(item.productId) + '" data-size="' + escapeAttr(item.size || '') + '">−</button>' +
            '<span class="qty-value">' + item.quantity + '</span>' +
            '<button class="qty-btn" data-action="plus" data-pid="' + escapeAttr(item.productId) + '" data-size="' + escapeAttr(item.size || '') + '">+</button>' +
          '</div>' +
          '<span class="cart-item-subtotal">' + subtotal + ' د.أ</span>' +
        '</div>';
    }

    var total = getCartTotal().toFixed(2);

    $drawerContent.innerHTML =
      '<div class="drawer-header">' +
        '<span class="drawer-title">سلة المشتريات 🛒</span>' +
        '<button class="drawer-close" data-action="close">✕</button>' +
      '</div>' +
      '<div class="drawer-items">' + itemsHTML + '</div>' +
      '<div class="drawer-footer">' +
        '<p class="drawer-delivery">رسوم التوصيل: مجاناً 🚚</p>' +
        '<div class="drawer-total-row">' +
          '<span class="drawer-total-label">المجموع الكلي:</span>' +
          '<span class="drawer-total-value">' + total + ' د.أ</span>' +
        '</div>' +
        '<button class="checkout-btn" data-action="checkout">متابعة الطلب ←</button>' +
      '</div>';

    bindDrawerEvents();
  }

  /**
   * Single event-delegation handler for all drawer buttons.
   * Uses data-action attributes instead of IDs to avoid rebinding issues.
   */
  function bindDrawerEvents() {
    $drawerContent.onclick = function (e) {
      var btn = e.target.closest('[data-action]');
      if (!btn) return;

      var action = btn.getAttribute('data-action');
      var pid = btn.getAttribute('data-pid') || '';
      var size = btn.getAttribute('data-size');
      if (size === '') size = null;

      switch (action) {
        case 'close':
          e.stopPropagation();
          closeDrawer();
          break;
        case 'plus':
          updateQuantity(pid, size, 1);
          break;
        case 'minus':
          updateQuantity(pid, size, -1);
          break;
        case 'delete':
          removeFromCart(pid, size);
          break;
        case 'checkout':
          showRepSelection();
          break;
        case 'rep-ibrahim':
          generateWhatsAppMessage('إبراهيم', '962787364679');
          break;
        case 'rep-rakan':
          generateWhatsAppMessage('ركان', '962789290001');
          break;
        case 'back-to-cart':
          renderDrawerCart();
          break;
      }
    };
  }

  /* ══════════════════════════════════════════
     13. WHATSAPP REP SELECTION
     ══════════════════════════════════════════ */

  function showRepSelection() {
    $drawerContent.innerHTML =
      '<div class="drawer-header">' +
        '<span class="drawer-title">تأكيد الطلب 💬</span>' +
        '<button class="drawer-close" data-action="close">✕</button>' +
      '</div>' +
      '<div class="rep-view">' +
        '<h3 class="rep-view-title">اختر المسؤول لتأكيد طلبك عبر واتساب 💬</h3>' +
        '<p class="rep-view-sub">سيتواصل معك للتأكيد وتحديد موعد التوصيل</p>' +
        '<button class="whatsapp-btn" data-action="rep-ibrahim">' +
          WHATSAPP_SVG +
          '<span>إبراهيم — تواصل مباشرة</span>' +
        '</button>' +
        '<button class="whatsapp-btn" data-action="rep-rakan">' +
          WHATSAPP_SVG +
          '<span>ركان — تواصل مباشرة</span>' +
        '</button>' +
        '<button class="back-to-cart-btn" data-action="back-to-cart">← رجوع للسلة</button>' +
      '</div>';

    bindDrawerEvents();
  }

  function generateWhatsAppMessage(repName, phone) {
    var msg = 'مرحبا ' + repName + ' 👋\n';
    msg += 'عندي طلب جديد من الموقع:\n\n';
    msg += '📋 تفاصيل الطلب:\n';

    for (var i = 0; i < cart.length; i++) {
      var item = cart[i];
      var sizeLabel = item.size ? ' (' + item.size + ')' : '';
      var subtotal = (item.price * item.quantity).toFixed(2);
      msg += '- ' + item.name + sizeLabel + ' × ' + item.quantity + ' = ' + subtotal + ' د.أ\n';
    }

    var total = getCartTotal().toFixed(2);
    msg += '\n💵 المجموع الكلي: ' + total + ' د.أ\n';
    msg += '🚚 رسوم التوصيل: مجاناً';

    window.open('https://wa.me/' + phone + '?text=' + encodeURIComponent(msg), '_blank');
  }

  /* ══════════════════════════════════════════
     14. RETRY
     ══════════════════════════════════════════ */

  $retryBtn.addEventListener('click', function () {
    fetchProducts({ force: true });
  });

  if ($journeyStartBtn) {
    $journeyStartBtn.addEventListener('click', function () {
      var target = $menuViewToolbar.hidden ? $productSwiper : $menuViewToolbar;
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  if ($refreshBtn) {
    $refreshBtn.addEventListener('click', function () {
      if ($refreshBtn.disabled) return;
      $refreshBtn.disabled = true;
      $refreshBtn.classList.add('is-refreshing');
      fetchProducts({ force: true }).then(function () {
        setTimeout(function () {
          $refreshBtn.disabled = false;
          $refreshBtn.classList.remove('is-refreshing');
        }, 350);
      });
    });
  }

  /* ══════════════════════════════════════════
     🚀 INIT
     ══════════════════════════════════════════ */

  loadCart();
  updateCartUI();
  fetchProducts();

})();
