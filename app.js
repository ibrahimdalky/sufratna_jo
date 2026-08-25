/* ============================================
   سفرتنا — APP.JS — COMPLETE APPLICATION LOGIC
   ============================================ */

(function () {
  'use strict';

  /* ---------- CONSTANTS ---------- */
  const CSV_URL =
    'https://docs.google.com/spreadsheets/d/e/2PACX-1vR9p3HjkTJAsmNyFCDCcYAzg1wot5iz6AcCWN618PRzqd8Zw6ZSbcYtZ85o-wTs6tLpBYWFvqD4yl9S/pub?output=csv';

  const PLACEHOLDER_SVG =
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'%3E%3Crect width='200' height='200' fill='%231C1917'/%3E%3Ctext x='100' y='108' text-anchor='middle' font-size='48' fill='%23C47D4C'%3E🍽%3C/text%3E%3C/svg%3E";

  const WHATSAPP_SVG = `<svg viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>`;

  /* ---------- STATE ---------- */
  let allProducts = [];
  let filteredProducts = [];
  let categories = [];
  let activeCategory = 'الكل';
  let cart = [];
  let swiperInstance = null;
  let logoUrl = '';

  /* ---------- DOM REFS ---------- */
  const $canvas = document.getElementById('particleCanvas');
  const $skeletonLoader = document.getElementById('skeletonLoader');
  const $errorState = document.getElementById('errorState');
  const $retryBtn = document.getElementById('retryBtn');
  const $productSwiper = document.getElementById('productSwiper');
  const $swiperWrapper = document.getElementById('swiperWrapper');
  const $categoryScroll = document.getElementById('categoryScroll');
  const $cartBadge = document.getElementById('cartBadge');
  const $cartBarText = document.getElementById('cartBarText');
  const $cartBarTotal = document.getElementById('cartBarTotal');
  const $cartBar = document.getElementById('cartBar');
  const $drawerOverlay = document.getElementById('drawerOverlay');
  const $drawerContent = document.getElementById('drawerContent');
  const $toastContainer = document.getElementById('toastContainer');
  const $brandLogo = document.getElementById('brandLogo');
  const $logoPlaceholder = document.getElementById('logoPlaceholder');

  /* ==========================================
     PARTICLE BACKGROUND
     ========================================== */
  (function initParticles() {
    const ctx = $canvas.getContext('2d');
    let particles = [];
    const PARTICLE_COUNT = 60;

    function resize() {
      $canvas.width = window.innerWidth;
      $canvas.height = window.innerHeight;
    }

    function createParticles() {
      particles = [];
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        particles.push({
          x: Math.random() * $canvas.width,
          y: Math.random() * $canvas.height,
          r: Math.random() * 2 + 0.8,
          dx: (Math.random() - 0.5) * 0.4,
          dy: (Math.random() - 0.5) * 0.4,
          opacity: Math.random() * 0.3 + 0.1,
          opDir: Math.random() > 0.5 ? 1 : -1,
          isGold: Math.random() > 0.5,
        });
      }
    }

    function draw() {
      ctx.clearRect(0, 0, $canvas.width, $canvas.height);
      particles.forEach(function (p) {
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
      });
      requestAnimationFrame(draw);
    }

    resize();
    createParticles();
    draw();
    window.addEventListener('resize', function () {
      resize();
      createParticles();
    });
  })();

  /* ==========================================
     CSV FETCH & PARSE
     ========================================== */
  function fetchProducts() {
    $skeletonLoader.style.display = 'grid';
    $errorState.style.display = 'none';
    $productSwiper.style.display = 'none';

    fetch(CSV_URL)
      .then(function (r) { return r.text(); })
      .then(function (csv) { parseCSV(csv); })
      .catch(function () {
        $skeletonLoader.style.display = 'none';
        $errorState.style.display = 'block';
      });
  }

  function parseCSV(csvText) {
    var lines = csvText.split('\n').map(function (l) { return l.trim(); }).filter(Boolean);
    if (lines.length < 2) {
      $skeletonLoader.style.display = 'none';
      $errorState.style.display = 'block';
      return;
    }

    var headers = parseCSVRow(lines[0]);
    var colMap = {};
    headers.forEach(function (h, i) { colMap[h.trim().toLowerCase()] = i; });

    /* logo from first data row */
    var firstDataRow = parseCSVRow(lines[1]);
    if (colMap['logo'] !== undefined || colMap['logo'] !== undefined) {
      var logoIdx = colMap['logo'];
      if (logoIdx !== undefined && firstDataRow[logoIdx]) {
        logoUrl = firstDataRow[logoIdx].trim();
        loadLogo(logoUrl);
      }
    }

    var products = [];
    var catSet = new Set();

    for (var i = 1; i < lines.length; i++) {
      var cols = parseCSVRow(lines[i]);
      if (cols.length < headers.length) continue;

      var available = (cols[colMap['is_available']] || '').trim().toUpperCase();
      if (available !== 'TRUE') continue;

      var sizesRaw = (cols[colMap['sizes_and_prices']] || '').trim();
      var sizes = [];
      if (sizesRaw && sizesRaw !== '-') {
        sizesRaw.split(',').forEach(function (chunk) {
          var parts = chunk.trim().split('=');
          if (parts.length === 2) {
            sizes.push({ label: parts[0].trim(), price: parseFloat(parts[1].trim()) || 0 });
          }
        });
      }

      var basePrice = parseFloat(cols[colMap['base_price']]) || 0;
      var category = (cols[colMap['category']] || '').trim();
      if (category) catSet.add(category);

      products.push({
        id: (cols[colMap['id']] || '').trim(),
        name: (cols[colMap['name']] || '').trim(),
        category: category,
        base_price: basePrice,
        sizes: sizes,
        image_url: (cols[colMap['image_url']] || '').trim(),
        description: (cols[colMap['description']] || '').trim(),
        selectedSize: sizes.length > 0 ? sizes[0] : null,
        selectedPrice: sizes.length > 0 ? sizes[0].price : basePrice,
        quantity: 0,
      });
    }

    allProducts = products;
    categories = Array.from(catSet);
    filteredProducts = allProducts.slice();

    renderCategories();
    renderProducts();

    $skeletonLoader.style.display = 'none';
    $productSwiper.style.display = 'block';
  }

  /* Robust CSV row parser — handles quoted fields with commas */
  function parseCSVRow(row) {
    var result = [];
    var current = '';
    var inQuotes = false;
    for (var i = 0; i < row.length; i++) {
      var ch = row[i];
      if (inQuotes) {
        if (ch === '"') {
          if (i + 1 < row.length && row[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          current += ch;
        }
      } else {
        if (ch === '"') {
          inQuotes = true;
        } else if (ch === ',') {
          result.push(current);
          current = '';
        } else {
          current += ch;
        }
      }
    }
    result.push(current);
    return result;
  }

  /* ---------- LOGO ---------- */
  function loadLogo(url) {
    if (!url) return;
    var img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = function () {
      $brandLogo.src = url;
      $brandLogo.style.display = 'block';
      $logoPlaceholder.style.display = 'none';
    };
    img.onerror = function () {
      /* keep placeholder */
    };
    img.src = url;
  }

  /* ==========================================
     CATEGORIES
     ========================================== */
  function renderCategories() {
    var html = '<button class="cat-pill active" data-cat="الكل">الكل</button>';
    categories.forEach(function (cat) {
      html += '<button class="cat-pill" data-cat="' + escapeAttr(cat) + '">' + escapeHTML(cat) + '</button>';
    });
    $categoryScroll.innerHTML = html;
  }

  $categoryScroll.addEventListener('click', function (e) {
    var pill = e.target.closest('.cat-pill');
    if (!pill) return;
    var cat = pill.getAttribute('data-cat');
    if (cat === activeCategory) return;

    activeCategory = cat;
    $categoryScroll.querySelectorAll('.cat-pill').forEach(function (p) { p.classList.remove('active'); });
    pill.classList.add('active');

    if (cat === 'الكل') {
      filteredProducts = allProducts.slice();
    } else {
      filteredProducts = allProducts.filter(function (p) { return p.category === cat; });
    }
    renderProducts();
  });

  /* ==========================================
     RENDER PRODUCT SLIDES
     ========================================== */
  function renderProducts() {
    var html = '';
    filteredProducts.forEach(function (product, idx) {
      var sizesHTML = '';
      if (product.sizes.length > 0) {
        sizesHTML = '<div class="size-selector">';
        product.sizes.forEach(function (s, si) {
          var activeClass = si === 0 ? ' active' : '';
          sizesHTML += '<button class="size-pill' + activeClass + '" data-idx="' + idx + '" data-size-idx="' + si + '">' + escapeHTML(s.label) + '</button>';
        });
        sizesHTML += '</div>';
      }

      html += '<div class="swiper-slide" data-idx="' + idx + '">' +
        '<div class="product-card">' +
          '<div class="card-image-wrap">' +
            '<img src="' + escapeAttr(product.image_url) + '" alt="' + escapeAttr(product.name) + '" loading="lazy" onerror="this.onerror=null;this.src=\'' + PLACEHOLDER_SVG + '\';" />' +
            '<div class="card-image-overlay"></div>' +
          '</div>' +
          '<div class="card-body">' +
            '<span class="card-category">' + escapeHTML(product.category) + '</span>' +
            '<h2 class="card-name">' + escapeHTML(product.name) + '</h2>' +
            '<p class="card-desc">' + escapeHTML(product.description) + '</p>' +
            sizesHTML +
            '<div class="card-price" data-idx="' + idx + '">' +
              '<span class="price-value">' + product.selectedPrice.toFixed(2) + '</span> ' +
              '<span class="currency">د.أ</span>' +
            '</div>' +
            '<button class="add-to-cart-btn" data-idx="' + idx + '">' +
              '🛒 أضف إلى السلة' +
            '</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    });

    $swiperWrapper.innerHTML = html;
    initSwiper();
  }

  /* ==========================================
     SWIPER INIT
     ========================================== */
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
          slideShadows: false,
        },
        keyboard: { enabled: true },
        touchRatio: 1.5,
        threshold: 5,
        on: {
          slideChange: function () {
            updateActiveCardState(this.activeIndex);
          },
        },
      });
    }, 50);
  }

  function updateActiveCardState(index) {
    /* visual feedback can be extended here */
  }

  /* ==========================================
     EVENT DELEGATION — SIZE PILLS & ADD TO CART
     ========================================== */
  $swiperWrapper.addEventListener('click', function (e) {
    /* Size pill click */
    var sizePill = e.target.closest('.size-pill');
    if (sizePill) {
      var pIdx = parseInt(sizePill.getAttribute('data-idx'), 10);
      var sIdx = parseInt(sizePill.getAttribute('data-size-idx'), 10);
      var product = filteredProducts[pIdx];
      if (!product || !product.sizes[sIdx]) return;

      product.selectedSize = product.sizes[sIdx];
      product.selectedPrice = product.sizes[sIdx].price;

      /* Update pill states */
      var card = sizePill.closest('.product-card');
      card.querySelectorAll('.size-pill').forEach(function (p) { p.classList.remove('active'); });
      sizePill.classList.add('active');

      /* Update price display */
      var priceEl = card.querySelector('.card-price .price-value');
      if (priceEl) {
        priceEl.style.opacity = '0.3';
        setTimeout(function () {
          priceEl.textContent = product.selectedPrice.toFixed(2);
          priceEl.style.opacity = '1';
        }, 120);
      }
      return;
    }

    /* Add to cart click */
    var addBtn = e.target.closest('.add-to-cart-btn');
    if (addBtn) {
      var idx = parseInt(addBtn.getAttribute('data-idx'), 10);
      var product = filteredProducts[idx];
      if (!product) return;
      addToCart(product);

      /* Button success state */
      addBtn.classList.add('success');
      addBtn.textContent = '✓ تمت الإضافة';
      setTimeout(function () {
        addBtn.classList.remove('success');
        addBtn.textContent = '🛒 أضف إلى السلة';
      }, 1200);

      /* Fly to cart animation */
      var slide = addBtn.closest('.swiper-slide');
      var imgEl = slide ? slide.querySelector('.card-image-wrap img') : null;
      if (imgEl) {
        flyToCart(imgEl);
      }
      return;
    }
  });

  /* ==========================================
     CART SYSTEM
     ========================================== */
  function addToCart(product) {
    var sizeLabel = product.selectedSize ? product.selectedSize.label : null;
    var price = product.selectedPrice;

    var existing = cart.find(function (item) {
      return item.productId === product.id && item.size === sizeLabel;
    });

    if (existing) {
      existing.quantity++;
    } else {
      cart.push({
        productId: product.id,
        name: product.name,
        image_url: product.image_url,
        size: sizeLabel,
        price: price,
        quantity: 1,
      });
    }

    updateCartUI();
    showToast('✓ تمت الإضافة إلى السلة');
  }

  function removeFromCart(productId, size) {
    cart = cart.filter(function (item) {
      return !(item.productId === productId && item.size === size);
    });
    updateCartUI();
    renderDrawerCart();
  }

  function updateQuantity(productId, size, delta) {
    var item = cart.find(function (i) {
      return i.productId === productId && i.size === size;
    });
    if (!item) return;

    item.quantity += delta;
    if (item.quantity <= 0) {
      removeFromCart(productId, size);
      return;
    }
    updateCartUI();
    renderDrawerCart();
  }

  function getCartTotal() {
    return cart.reduce(function (sum, item) { return sum + item.price * item.quantity; }, 0);
  }

  function getCartCount() {
    return cart.reduce(function (sum, item) { return sum + item.quantity; }, 0);
  }

  function updateCartUI() {
    var count = getCartCount();
    var total = getCartTotal();

    if (count > 0) {
      $cartBadge.style.display = 'flex';
      $cartBadge.textContent = count;
      $cartBadge.classList.remove('bounce');
      void $cartBadge.offsetWidth; /* reflow */
      $cartBadge.classList.add('bounce');
      $cartBarText.innerHTML = 'سلة المشتريات';
      $cartBarTotal.textContent = total.toFixed(2) + ' د.أ';
    } else {
      $cartBadge.style.display = 'none';
      $cartBarText.innerHTML = '<span class="muted">سلتك فارغة</span>';
      $cartBarTotal.textContent = '';
    }
  }

  /* ==========================================
     FLY-TO-CART ANIMATION
     ========================================== */
  function flyToCart(imgEl) {
    var imgRect = imgEl.getBoundingClientRect();
    var barRect = $cartBar.getBoundingClientRect();

    var clone = document.createElement('div');
    clone.className = 'fly-clone';
    clone.style.width = '60px';
    clone.style.height = '60px';
    clone.style.top = imgRect.top + imgRect.height / 2 - 30 + 'px';
    clone.style.left = imgRect.left + imgRect.width / 2 - 30 + 'px';

    var cloneImg = document.createElement('img');
    cloneImg.src = imgEl.src;
    clone.appendChild(cloneImg);
    document.body.appendChild(clone);

    var targetX = barRect.left + 30 - (imgRect.left + imgRect.width / 2);
    var targetY = barRect.top + barRect.height / 2 - (imgRect.top + imgRect.height / 2);

    requestAnimationFrame(function () {
      clone.style.transform = 'translate(' + targetX + 'px, ' + targetY + 'px) scale(0.1)';
      clone.style.opacity = '0';
    });

    clone.addEventListener('transitionend', function handler() {
      clone.removeEventListener('transitionend', handler);
      if (clone.parentNode) clone.parentNode.removeChild(clone);
    });
  }

  /* ==========================================
     TOAST NOTIFICATIONS
     ========================================== */
  function showToast(message) {
    var toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    $toastContainer.appendChild(toast);

    setTimeout(function () {
      toast.classList.add('fade-out');
      setTimeout(function () {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 350);
    }, 2500);
  }

  /* ==========================================
     CART DRAWER
     ========================================== */
  $cartBar.addEventListener('click', function () {
    openDrawer();
  });

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
          '<button class="drawer-close" id="drawerCloseBtn">✕</button>' +
        '</div>' +
        '<div class="empty-cart">' +
          '<span class="empty-cart-icon">🛒</span>' +
          '<p class="empty-cart-title">سلتك فارغة</p>' +
          '<p class="empty-cart-sub">أضف بعض المنتجات</p>' +
        '</div>';
      bindDrawerClose();
      return;
    }

    var itemsHTML = '';
    cart.forEach(function (item) {
      var sizeText = item.size ? item.size : '';
      var subtotal = (item.price * item.quantity).toFixed(2);
      itemsHTML +=
        '<div class="cart-item-row">' +
          '<img class="cart-item-thumb" src="' + escapeAttr(item.image_url) + '" alt="" onerror="this.onerror=null;this.src=\'' + PLACEHOLDER_SVG + '\';" />' +
          '<div class="cart-item-info">' +
            '<div class="cart-item-name">' + escapeHTML(item.name) + '</div>' +
            (sizeText ? '<div class="cart-item-size">' + escapeHTML(sizeText) + '</div>' : '') +
          '</div>' +
          '<div class="cart-item-controls">' +
            '<button class="delete-btn" data-pid="' + escapeAttr(item.productId) + '" data-size="' + escapeAttr(item.size || '') + '">🗑</button>' +
            '<button class="qty-btn qty-minus" data-pid="' + escapeAttr(item.productId) + '" data-size="' + escapeAttr(item.size || '') + '">−</button>' +
            '<span class="qty-value">' + item.quantity + '</span>' +
            '<button class="qty-btn qty-plus" data-pid="' + escapeAttr(item.productId) + '" data-size="' + escapeAttr(item.size || '') + '">+</button>' +
          '</div>' +
          '<span class="cart-item-subtotal">' + subtotal + ' د.أ</span>' +
        '</div>';
    });

    var total = getCartTotal().toFixed(2);

    $drawerContent.innerHTML =
      '<div class="drawer-header">' +
        '<span class="drawer-title">سلة المشتريات 🛒</span>' +
        '<button class="drawer-close" id="drawerCloseBtn">✕</button>' +
      '</div>' +
      '<div class="drawer-items">' + itemsHTML + '</div>' +
      '<div class="drawer-footer">' +
        '<p class="drawer-delivery">رسوم التوصيل: مجاناً 🚚</p>' +
        '<div class="drawer-total-row">' +
          '<span class="drawer-total-label">المجموع الكلي:</span>' +
          '<span class="drawer-total-value">' + total + ' د.أ</span>' +
        '</div>' +
        '<button class="checkout-btn" id="checkoutBtn">متابعة الطلب ←</button>' +
      '</div>';

    bindDrawerClose();
    bindDrawerActions();
  }

  function bindDrawerClose() {
    var closeBtn = document.getElementById('drawerCloseBtn');
    if (closeBtn) {
      closeBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        closeDrawer();
      });
    }
  }

  function bindDrawerActions() {
    /* Qty +/- and delete via delegation on drawer content */
    $drawerContent.onclick = function (e) {
      var target = e.target.closest('button');
      if (!target) return;

      var pid = target.getAttribute('data-pid');
      var size = target.getAttribute('data-size') || null;
      if (size === '') size = null;

      if (target.classList.contains('qty-plus')) {
        updateQuantity(pid, size, 1);
      } else if (target.classList.contains('qty-minus')) {
        updateQuantity(pid, size, -1);
      } else if (target.classList.contains('delete-btn')) {
        removeFromCart(pid, size);
      } else if (target.id === 'checkoutBtn') {
        showRepSelection();
      } else if (target.id === 'drawerCloseBtn') {
        e.stopPropagation();
        closeDrawer();
      }
    };
  }

  /* ==========================================
     REP SELECTION (WHATSAPP)
     ========================================== */
  function showRepSelection() {
    $drawerContent.innerHTML =
      '<div class="drawer-header">' +
        '<span class="drawer-title">تأكيد الطلب 💬</span>' +
        '<button class="drawer-close" id="drawerCloseBtn">✕</button>' +
      '</div>' +
      '<div class="rep-view">' +
        '<h3 class="rep-view-title">اختر المسؤول لتأكيد طلبك عبر واتساب 💬</h3>' +
        '<p class="rep-view-sub">سيتواصل معك للتأكيد وتحديد موعد التوصيل</p>' +
        '<button class="whatsapp-btn" id="repIbrahim">' +
          WHATSAPP_SVG +
          '<span>إبراهيم — تواصل مباشرة</span>' +
        '</button>' +
        '<button class="whatsapp-btn" id="repRakan">' +
          WHATSAPP_SVG +
          '<span>ركان — تواصل مباشرة</span>' +
        '</button>' +
        '<button class="back-to-cart-btn" id="backToCartBtn">← رجوع للسلة</button>' +
      '</div>';

    bindDrawerClose();

    document.getElementById('repIbrahim').addEventListener('click', function () {
      generateWhatsAppMessage('إبراهيم', '962787364679');
    });

    document.getElementById('repRakan').addEventListener('click', function () {
      generateWhatsAppMessage('ركان', '96278929001');
    });

    document.getElementById('backToCartBtn').addEventListener('click', function () {
      renderDrawerCart();
    });
  }

  function generateWhatsAppMessage(repName, phone) {
    var message = 'مرحبا ' + repName + ' 👋\nعندي طلب جديد من الموقع:\n\n📋 تفاصيل الطلب:\n';
    cart.forEach(function (item) {
      var sizeLabel = item.size ? ' (' + item.size + ')' : '';
      var subtotal = (item.price * item.quantity).toFixed(2);
      message += '• ' + item.name + sizeLabel + ' × ' + item.quantity + ' = ' + subtotal + ' د.أ\n';
    });
    var total = getCartTotal().toFixed(2);
    message += '\n💵 المجموع الكلي: ' + total + ' د.أ\n🚚 رسوم التوصيل: مجاناً';
    var encoded = encodeURIComponent(message);
    window.open('https://wa.me/' + phone + '?text=' + encoded, '_blank');
  }

  /* ==========================================
     RETRY
     ========================================== */
  $retryBtn.addEventListener('click', function () {
    fetchProducts();
  });

  /* ==========================================
     HELPERS
     ========================================== */
  function escapeHTML(str) {
    if (!str) return '';
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  function escapeAttr(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /* ==========================================
     INIT
     ========================================== */
  fetchProducts();

})();
