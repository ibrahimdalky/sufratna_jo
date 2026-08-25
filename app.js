/* ============================================
   سفرتنا — APP.JS — COMPLETE APPLICATION LOGIC
   Rewritten from scratch against real CSV data
   ============================================ */

(function () {
  'use strict';

  /* ──────────── CONSTANTS ──────────── */

  var CSV_RAW_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vR9p3HjkTJAsmNyFCDCcYAzg1wot5iz6AcCWN618PRzqd8Zw6ZSbcYtZ85o-wTs6tLpBYWFvqD4yl9S/pub?output=csv';
  var FETCH_URL = 'https://corsproxy.io/?url=' + encodeURIComponent(CSV_RAW_URL);

  var PLACEHOLDER_SVG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'%3E%3Crect width='200' height='200' fill='%231C1917'/%3E%3Ctext x='100' y='108' text-anchor='middle' font-size='48' fill='%23C47D4C'%3E🍽%3C/text%3E%3C/svg%3E";

  var WHATSAPP_SVG = '<svg viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>';

  /* ──────────── STATE ──────────── */

  var allProducts = [];
  var filteredProducts = [];
  var categories = [];
  var activeCategory = 'الكل';
  var cart = [];
  var swiperInstance = null;

  /* ──────────── DOM REFERENCES ──────────── */

  var $canvas         = document.getElementById('particleCanvas');
  var $skeletonLoader = document.getElementById('skeletonLoader');
  var $errorState     = document.getElementById('errorState');
  var $retryBtn       = document.getElementById('retryBtn');
  var $productSwiper  = document.getElementById('productSwiper');
  var $swiperWrapper  = document.getElementById('swiperWrapper');
  var $categoryScroll = document.getElementById('categoryScroll');
  var $cartBadge      = document.getElementById('cartBadge');
  var $cartBarText    = document.getElementById('cartBarText');
  var $cartBarTotal   = document.getElementById('cartBarTotal');
  var $cartBar        = document.getElementById('cartBar');
  var $drawerOverlay  = document.getElementById('drawerOverlay');
  var $drawerContent  = document.getElementById('drawerContent');
  var $toastContainer = document.getElementById('toastContainer');
  var $brandLogo      = document.getElementById('brandLogo');
  var $logoPlaceholder = document.getElementById('logoPlaceholder');

  /* ══════════════════════════════════════════
     1. PARTICLE BACKGROUND
     ══════════════════════════════════════════ */

  (function () {
    var ctx = $canvas.getContext('2d');
    var particles = [];
    var COUNT = 60;

    function resize() {
      $canvas.width = window.innerWidth;
      $canvas.height = window.innerHeight;
    }

    function seed() {
      particles = [];
      for (var i = 0; i < COUNT; i++) {
        particles.push({
          x: Math.random() * $canvas.width,
          y: Math.random() * $canvas.height,
          r: Math.random() * 2 + 0.8,
          dx: (Math.random() - 0.5) * 0.4,
          dy: (Math.random() - 0.5) * 0.4,
          opacity: Math.random() * 0.3 + 0.1,
          opDir: Math.random() > 0.5 ? 1 : -1,
          isGold: Math.random() > 0.5
        });
      }
    }

    function loop() {
      ctx.clearRect(0, 0, $canvas.width, $canvas.height);
      for (var i = 0; i < particles.length; i++) {
        var p = particles[i];
        p.x += p.dx;
        p.y += p.dy;
        p.opacity += p.opDir * 0.003;
        if (p.opacity >= 0.4) p.opDir = -1;
        if (p.opacity <= 0.1) p.opDir = 1;
        if (p.x < 0) p.x = $canvas.width;
        if (p.x > $canvas.width) p.x = 0;
        if (p.y < 0) p.y = $canvas.height;
        if (p.y > $canvas.height) p.y = 0;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.isGold
          ? 'rgba(229,169,60,' + p.opacity + ')'
          : 'rgba(196,125,76,' + p.opacity + ')';
        ctx.fill();
      }
      requestAnimationFrame(loop);
    }

    resize();
    seed();
    loop();
    window.addEventListener('resize', function () { resize(); seed(); });
  })();

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

  function fetchProducts() {
    $skeletonLoader.style.display = 'grid';
    $errorState.style.display = 'none';
    $productSwiper.style.display = 'none';

    fetch(FETCH_URL)
      .then(function (res) { return res.text(); })
      .then(function (text) { handleCSV(text); })
      .catch(function (err) {
        console.error('CSV fetch failed:', err);
        $skeletonLoader.style.display = 'none';
        $errorState.style.display = 'block';
      });
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

      products.push({
        id: (c[col['id']] || '').trim(),
        name: (c[col['name']] || '').trim(),
        category: category,
        base_price: basePrice,
        sizes: sizes,
        image_url: imgUrl,
        description: (c[col['description']] || '').trim(),
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
    if (!url) return;
    var img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = function () {
      $brandLogo.src = url;
      $brandLogo.style.display = 'block';
      $logoPlaceholder.style.display = 'none';
    };
    img.onerror = function () { /* keep placeholder */ };
    img.src = url;
  }

  /* ══════════════════════════════════════════
     5. CATEGORIES
     ══════════════════════════════════════════ */

  function renderCategories() {
    var html = '<button class="cat-pill active" data-cat="الكل">الكل</button>';
    for (var i = 0; i < categories.length; i++) {
      html += '<button class="cat-pill" data-cat="' + escapeAttr(categories[i]) + '">' + escapeHTML(categories[i]) + '</button>';
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

  function renderProducts() {
    if (filteredProducts.length === 0) {
      $swiperWrapper.innerHTML = '<div class="swiper-slide"><div class="product-card"><div class="card-body" style="text-align:center;padding:40px 20px;"><p style="color:var(--text-secondary);">لا توجد منتجات في هذا القسم</p></div></div></div>';
      initSwiper();
      return;
    }

    var html = '';
    for (var idx = 0; idx < filteredProducts.length; idx++) {
      var p = filteredProducts[idx];

      // Size pills
      var sizesHTML = '';
      if (p.sizes.length > 0) {
        sizesHTML = '<div class="size-selector">';
        for (var si = 0; si < p.sizes.length; si++) {
          var act = si === 0 ? ' active' : '';
          sizesHTML += '<button class="size-pill' + act + '" data-idx="' + idx + '" data-si="' + si + '">' + escapeHTML(p.sizes[si].label) + '</button>';
        }
        sizesHTML += '</div>';
      }

      var imgSrc = p.image_url || PLACEHOLDER_SVG;

      html +=
        '<div class="swiper-slide" data-idx="' + idx + '">' +
          '<div class="product-card">' +
            '<div class="card-image-wrap">' +
              '<img src="' + escapeAttr(imgSrc) + '" alt="' + escapeAttr(p.name) + '" loading="lazy" onerror="this.onerror=null;this.src=\'' + PLACEHOLDER_SVG + '\';" />' +
              '<div class="card-image-overlay"></div>' +
            '</div>' +
            '<div class="card-body">' +
              '<span class="card-category">' + escapeHTML(p.category) + '</span>' +
              '<h2 class="card-name">' + escapeHTML(p.name) + '</h2>' +
              '<p class="card-desc">' + escapeHTML(p.description) + '</p>' +
              sizesHTML +
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
    initSwiper();
  }

  /* ══════════════════════════════════════════
     7. SWIPER INITIALIZATION
     ══════════════════════════════════════════ */

  function initSwiper() {
    if (swiperInstance) {
      swiperInstance.destroy(true, true);
      swiperInstance = null;
    }
    setTimeout(function () {
      swiperInstance = new Swiper('#productSwiper', {
        effect: 'coverflow',
        grabCursor: true,
        centeredSlides: true,
        slidesPerView: 'auto',
        initialSlide: 0,
        spaceBetween: 20,
        coverflowEffect: {
          rotate: 0,
          stretch: 0,
          depth: 120,
          modifier: 2,
          slideShadows: false
        },
        keyboard: { enabled: true },
        touchRatio: 1.5,
        threshold: 5,
        on: {
          slideChange: function () {
            /* placeholder for active-card visual feedback */
          }
        }
      });
    }, 50);
  }

  /* ══════════════════════════════════════════
     8. EVENT DELEGATION — SIZE PILLS & ADD TO CART
     ══════════════════════════════════════════ */

  $swiperWrapper.addEventListener('click', function (e) {

    /* ── Size pill click ── */
    var pill = e.target.closest('.size-pill');
    if (pill) {
      var pIdx = parseInt(pill.getAttribute('data-idx'), 10);
      var sIdx = parseInt(pill.getAttribute('data-si'), 10);
      var prod = filteredProducts[pIdx];
      if (!prod || !prod.sizes[sIdx]) return;

      prod.selectedSize = prod.sizes[sIdx];
      prod.selectedPrice = prod.sizes[sIdx].price;

      // Update pill active state
      var card = pill.closest('.product-card');
      var allPills = card.querySelectorAll('.size-pill');
      for (var i = 0; i < allPills.length; i++) allPills[i].classList.remove('active');
      pill.classList.add('active');

      // Animate price change
      var priceEl = card.querySelector('.card-price .price-value');
      if (priceEl) {
        priceEl.style.opacity = '0.3';
        setTimeout(function () {
          priceEl.textContent = prod.selectedPrice.toFixed(2);
          priceEl.style.opacity = '1';
        }, 120);
      }
      return;
    }

    /* ── Add to cart click ── */
    var btn = e.target.closest('.add-to-cart-btn');
    if (btn) {
      var idx = parseInt(btn.getAttribute('data-idx'), 10);
      var prod = filteredProducts[idx];
      if (!prod) return;

      addToCart(prod);

      // Success flash
      btn.classList.add('success');
      btn.textContent = '✓ تمت الإضافة';
      setTimeout(function () {
        btn.classList.remove('success');
        btn.textContent = '🛒 أضف إلى السلة';
      }, 1200);

      // Fly-to-cart
      var slide = btn.closest('.swiper-slide');
      var imgEl = slide ? slide.querySelector('.card-image-wrap img') : null;
      if (imgEl) flyToCart(imgEl);

      return;
    }
  });

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

    updateCartUI();
    showToast('✓ تمت الإضافة إلى السلة');
  }

  function removeFromCart(productId, size) {
    var next = [];
    for (var i = 0; i < cart.length; i++) {
      if (!(cart[i].productId === productId && cart[i].size === size)) {
        next.push(cart[i]);
      }
    }
    cart = next;
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

    if (count > 0) {
      $cartBadge.style.display = 'flex';
      $cartBadge.textContent = count;
      $cartBadge.classList.remove('bounce');
      void $cartBadge.offsetWidth; // reflow to restart animation
      $cartBadge.classList.add('bounce');
      $cartBarText.innerHTML = 'سلة المشتريات';
      $cartBarTotal.textContent = total.toFixed(2) + ' د.أ';
    } else {
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
     11. TOAST NOTIFICATIONS
     ══════════════════════════════════════════ */

  function showToast(message) {
    var t = document.createElement('div');
    t.className = 'toast';
    t.textContent = message;
    $toastContainer.appendChild(t);

    setTimeout(function () {
      t.classList.add('fade-out');
      setTimeout(function () {
        if (t.parentNode) t.parentNode.removeChild(t);
      }, 350);
    }, 2500);
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
          generateWhatsAppMessage('ركان', '96278929001');
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
    fetchProducts();
  });

  /* ══════════════════════════════════════════
     🚀 INIT
     ══════════════════════════════════════════ */

  fetchProducts();

})();
