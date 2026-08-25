/* ═══════════════════════════════════════════════════════════════════
   سفرتنا – Complete App Logic  (Production)
   ═══════════════════════════════════════════════════════════════════
   1. CSV fetch & bulletproof parse
   2. Category tabs with instant filter + Swiper re-init
   3. Swiper 11 coverflow – lifecycle managed
   4. Size pills with per-card DOM state
   5. Cart: add / qty / remove / totals
   6. Fly-to-cart animation (Web Animations API)
   7. Drawer: cart view ↔ WhatsApp view
   8. WhatsApp message builder & wa.me redirect
   ═══════════════════════════════════════════════════════════════════ */

// ─── Constants ────────────────────────────────────────────────────
const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vR9p3HjkTJAsmNyFCDCcYAzg1wot5iz6AcCWN618PRzqd8Zw6ZSbcYtZ85o-wTs6tLpBYWFvqD4yl9S/pub?output=csv';

const REPS = {
  ibrahim: { phone: '962787364679', name: 'ابراهيم', greeting: 'مرحبا ابراهيم 👋' },
  rakan:   { phone: '96278929001',  name: 'ركان',   greeting: 'مرحبا ركان 👋' }
};

const FALLBACK_IMG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 300'%3E%3Crect fill='%231C1917' width='400' height='300'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%23C47D4C' font-size='48'%3E🍽️%3C/text%3E%3C/svg%3E";

// ─── State ────────────────────────────────────────────────────────
let allProducts      = [];
let filteredProducts  = [];
let activeCategory   = 'الكل';
let cart             = [];   // { id, name, size, price, qty, image }
let swiperInstance   = null;
let logoUrl          = '';

// ═══════════════════════════════════════════════════════════════════
//  BOOT
// ═══════════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', function() {
  // Wire up all static buttons with event listeners (no inline onclick)
  document.getElementById('cart-bar').addEventListener('click', openDrawer);
  document.getElementById('btn-close-drawer').addEventListener('click', closeDrawer);
  document.getElementById('cart-overlay').addEventListener('click', closeDrawer);
  document.getElementById('btn-checkout').addEventListener('click', showWhatsAppView);
  document.getElementById('btn-back-cart').addEventListener('click', showCartView);

  // WhatsApp contact buttons (delegation)
  document.querySelectorAll('.wa-contact-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      sendWhatsApp(btn.dataset.person);
    });
  });

  // Fetch data
  fetchProducts();
});


// ═══════════════════════════════════════════════════════════════════
//  1. CSV FETCH & PARSE
// ═══════════════════════════════════════════════════════════════════

async function fetchProducts() {
  try {
    var res = await fetch(CSV_URL);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    var text = await res.text();
    parseCSV(text);
  } catch (err) {
    console.error('Fetch error:', err);
    document.getElementById('skeleton-loader').innerHTML =
      '<div style="text-align:center;padding:40px;color:var(--muted)">' +
      '<i class="fa-solid fa-triangle-exclamation" style="font-size:2rem;color:var(--primary);margin-bottom:12px"></i>' +
      '<p>عذراً، حدث خطأ في تحميل المنتجات</p>' +
      '<button onclick="location.reload()" style="margin-top:16px;padding:10px 24px;border-radius:50px;border:1px solid var(--border);background:var(--glass);color:var(--text);font-family:\'Readex Pro\',sans-serif;cursor:pointer">إعادة المحاولة</button>' +
      '</div>';
  }
}

function parseCSV(text) {
  var rows = tokenize(text);

  // Find header row
  var hi = -1;
  for (var i = 0; i < rows.length; i++) {
    for (var j = 0; j < rows[i].length; j++) {
      if (rows[i][j].trim().toLowerCase() === 'id') { hi = i; break; }
    }
    if (hi !== -1) break;
  }
  if (hi === -1) { console.error('No header found'); return; }

  var headers = rows[hi].map(function(h) { return h.trim().toLowerCase().replace(/\s+/g, '_'); });
  var data = rows.slice(hi + 1);

  allProducts = [];

  for (var r = 0; r < data.length; r++) {
    var row = data[r];
    if (!row[0] || !row[0].trim()) continue;

    var p = {};
    for (var c = 0; c < headers.length; c++) {
      p[headers[c]] = (row[c] || '').trim();
    }

    // Availability – treat as available by default
    if (p.is_available && p.is_available.toUpperCase() === 'FALSE') continue;

    // Image
    p.image_url = extractSrc(p.image_url);

    // Logo (grab from first row that has it)
    if (!logoUrl && p.logo) logoUrl = extractSrc(p.logo);

    // Base price
    p.base_price = parseFloat(p.base_price) || 0;

    // Variants
    p.variants = parseSizes(p.sizes_and_prices);
    if (p.variants.length === 0) {
      p.variants = [{ size: '', price: p.base_price }];
    }

    allProducts.push(p);
  }

  // Logo
  var logoEl = document.getElementById('brand-logo');
  if (logoUrl && logoEl) {
    logoEl.src = logoUrl;
  } else {
    var lc = document.getElementById('logo-container');
    if (lc) lc.style.display = 'none';
  }

  filteredProducts = allProducts.slice();
  renderCategoryTabs();
  renderProducts();
}

/* ── CSV tokenizer (handles quoted fields with commas/newlines) ── */
function tokenize(text) {
  var rows = [], row = [], cell = '', inQ = false;
  for (var i = 0; i < text.length; i++) {
    var ch = text[i], nx = text[i + 1] || '';
    if (inQ) {
      if (ch === '"' && nx === '"') { cell += '"'; i++; }
      else if (ch === '"') { inQ = false; }
      else { cell += ch; }
    } else {
      if (ch === '"') { inQ = true; }
      else if (ch === ',') { row.push(cell); cell = ''; }
      else if (ch === '\r' && nx === '\n') { row.push(cell); cell = ''; rows.push(row); row = []; i++; }
      else if (ch === '\n' || ch === '\r') { row.push(cell); cell = ''; rows.push(row); row = []; }
      else { cell += ch; }
    }
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

/* ── Extract src from HTML img tag ── */
function extractSrc(html) {
  if (!html) return '';
  var m = html.match(/src\s*=\s*"([^"]+)"/i)
       || html.match(/src\s*=\s*""([^"]+)""/i)
       || html.match(/src\s*=\s*'([^']+)'/i);
  if (m) return m[1];
  if (/^https?:\/\//i.test(html)) return html.trim();
  return '';
}

/* ── Parse "وسط=2.5, كبير=4" ── */
function parseSizes(str) {
  if (!str || !str.trim()) return [];
  var result = [];
  var pairs = str.split(',');
  for (var i = 0; i < pairs.length; i++) {
    var parts = pairs[i].split('=');
    var name = (parts[0] || '').trim();
    var price = parseFloat((parts[1] || '').trim());
    if (name && !isNaN(price)) {
      result.push({ size: name, price: price });
    }
  }
  return result;
}


// ═══════════════════════════════════════════════════════════════════
//  2. CATEGORY TABS
// ═══════════════════════════════════════════════════════════════════

function renderCategoryTabs() {
  var cats = ['الكل'];
  var seen = {};
  for (var i = 0; i < allProducts.length; i++) {
    var cat = allProducts[i].category;
    if (cat && !seen[cat]) { seen[cat] = true; cats.push(cat); }
  }

  var tabsEl = document.getElementById('category-tabs');
  var html = '';
  for (var j = 0; j < cats.length; j++) {
    var isActive = cats[j] === activeCategory ? ' active' : '';
    html += '<button class="cat-tab' + isActive + '" data-cat="' + cats[j] + '">' + cats[j] + '</button>';
  }
  tabsEl.innerHTML = html;

  // Delegation
  tabsEl.addEventListener('click', function(e) {
    var btn = e.target.closest('.cat-tab');
    if (btn) filterByCategory(btn.dataset.cat);
  });
}

function filterByCategory(cat) {
  activeCategory = cat;

  var tabs = document.querySelectorAll('.cat-tab');
  for (var i = 0; i < tabs.length; i++) {
    tabs[i].classList.toggle('active', tabs[i].dataset.cat === cat);
  }

  if (cat === 'الكل') {
    filteredProducts = allProducts.slice();
  } else {
    filteredProducts = allProducts.filter(function(p) { return p.category === cat; });
  }

  renderProducts();
}


// ═══════════════════════════════════════════════════════════════════
//  3. RENDER PRODUCTS + SWIPER LIFECYCLE
// ═══════════════════════════════════════════════════════════════════

function renderProducts() {
  document.getElementById('skeleton-loader').style.display = 'none';
  var section = document.getElementById('products-section');
  var empty   = document.getElementById('empty-state');
  var wrapper = document.getElementById('swiper-wrapper');

  if (filteredProducts.length === 0) {
    section.style.display = 'none';
    empty.style.display = 'block';
    return;
  }

  empty.style.display = 'none';
  section.style.display = 'block';

  // Build slides HTML
  var html = '';
  for (var i = 0; i < filteredProducts.length; i++) {
    var p = filteredProducts[i];
    var defPrice = p.variants[0].price;
    var defSize  = p.variants[0].size;
    var hasSizes = p.variants.length > 1 || p.variants[0].size !== '';

    // Size pills
    var pills = '';
    if (hasSizes) {
      pills = '<div class="sizes">';
      for (var s = 0; s < p.variants.length; s++) {
        var v = p.variants[s];
        var ac = s === 0 ? ' active' : '';
        pills += '<button class="sz-pill' + ac + '" data-vidx="' + s + '" data-vprice="' + v.price + '" data-vsize="' + v.size + '">' + v.size + '</button>';
      }
      pills += '</div>';
    }

    html +=
      '<div class="swiper-slide">' +
        '<div class="product-card" data-pid="' + p.id + '" data-pname="' + escAttr(p.name) + '" data-pimage="' + escAttr(p.image_url) + '" data-price="' + defPrice + '" data-size="' + escAttr(defSize) + '">' +
          '<div class="img-wrap">' +
            '<img src="' + (p.image_url || FALLBACK_IMG) + '" alt="' + escAttr(p.name) + '" loading="lazy" onerror="this.onerror=null;this.src=\'' + FALLBACK_IMG + '\'">' +
          '</div>' +
          '<div class="p-info">' +
            '<h3 class="p-name">' + p.name + '</h3>' +
            '<p class="p-desc">' + (p.description || '') + '</p>' +
            pills +
            '<div class="price-row">' +
              '<span class="price">' + defPrice.toFixed(2) + ' <span class="cur">د.أ</span></span>' +
            '</div>' +
            '<button class="btn-add"><i class="fa-solid fa-cart-plus"></i> أضف إلى السلة</button>' +
          '</div>' +
        '</div>' +
      '</div>';
  }

  // Step 1: Update DOM
  wrapper.innerHTML = html;

  // Step 2: Attach event delegation on wrapper
  wrapper.removeEventListener('click', handleProductClick);
  wrapper.addEventListener('click', handleProductClick);

  // Step 3: Destroy old Swiper then re-init
  if (swiperInstance) {
    swiperInstance.destroy(true, true);
    swiperInstance = null;
  }

  // Step 4: Create new Swiper
  swiperInstance = new Swiper('.swiper', {
    effect: 'coverflow',
    grabCursor: true,
    centeredSlides: true,
    slidesPerView: 'auto',
    initialSlide: 0,
    spaceBetween: 20,
    coverflowEffect: {
      rotate: 0,
      stretch: 0,
      depth: 100,
      modifier: 2,
      slideShadows: false
    },
    keyboard: { enabled: true },
    touchRatio: 1.5,
    threshold: 5
  });
}

function escAttr(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;');
}

/* ── Delegation handler for clicks inside product cards ── */
function handleProductClick(e) {
  // Size pill click
  var pill = e.target.closest('.sz-pill');
  if (pill) {
    e.stopPropagation();
    selectSize(pill);
    return;
  }

  // Add-to-cart click
  var addBtn = e.target.closest('.btn-add');
  if (addBtn) {
    e.stopPropagation();
    var card = addBtn.closest('.product-card');
    if (card) addToCart(card);
    return;
  }
}


// ═══════════════════════════════════════════════════════════════════
//  4. SIZE SELECTION
// ═══════════════════════════════════════════════════════════════════

function selectSize(pill) {
  var card    = pill.closest('.product-card');
  var sizes   = pill.closest('.sizes');
  var newPrice = parseFloat(pill.dataset.vprice);
  var newSize  = pill.dataset.vsize;

  // Update active pill
  var pills = sizes.querySelectorAll('.sz-pill');
  for (var i = 0; i < pills.length; i++) pills[i].classList.remove('active');
  pill.classList.add('active');

  // Store on card dataset
  card.dataset.price = newPrice;
  card.dataset.size  = newSize;

  // Animate price update
  var priceEl = card.querySelector('.price');
  priceEl.style.transform = 'scale(1.15)';
  priceEl.innerHTML = newPrice.toFixed(2) + ' <span class="cur">د.أ</span>';
  setTimeout(function() { priceEl.style.transform = 'scale(1)'; }, 200);
}


// ═══════════════════════════════════════════════════════════════════
//  5. ADD TO CART
// ═══════════════════════════════════════════════════════════════════

function addToCart(card) {
  var id    = card.dataset.pid;
  var name  = card.dataset.pname;
  var image = card.dataset.pimage;
  var price = parseFloat(card.dataset.price);
  var size  = card.dataset.size || '';

  // Check existing
  var existing = null;
  for (var i = 0; i < cart.length; i++) {
    if (cart[i].id === id && cart[i].size === size) { existing = cart[i]; break; }
  }

  if (existing) {
    existing.qty++;
  } else {
    cart.push({ id: id, name: name, size: size, price: price, qty: 1, image: image });
  }

  // Animation
  var imgEl = card.querySelector('.img-wrap img');
  if (imgEl) flyToCart(imgEl);

  syncCartBar();
  showToast();
}


// ═══════════════════════════════════════════════════════════════════
//  6. FLY-TO-CART ANIMATION
// ═══════════════════════════════════════════════════════════════════

function flyToCart(imgEl) {
  var imgR = imgEl.getBoundingClientRect();
  var cartW = document.getElementById('cart-icon-wrap');
  var cartR = cartW.getBoundingClientRect();

  var startX = imgR.left + imgR.width / 2 - 28;
  var startY = imgR.top + imgR.height / 2 - 28;
  var endX   = cartR.left + cartR.width / 2 - 8;
  var endY   = cartR.top + cartR.height / 2 - 8;
  var midX   = (startX + endX) / 2;
  var midY   = Math.min(startY, endY) - 80;

  var clone = document.createElement('img');
  clone.src = imgEl.src;
  clone.className = 'fly-clone';
  clone.style.width  = '56px';
  clone.style.height = '56px';
  clone.style.left   = startX + 'px';
  clone.style.top    = startY + 'px';
  document.body.appendChild(clone);

  clone.animate([
    { left: startX + 'px', top: startY + 'px', width: '56px', height: '56px', opacity: 1 },
    { left: midX + 'px', top: midY + 'px', width: '36px', height: '36px', opacity: .85, offset: .5 },
    { left: endX + 'px', top: endY + 'px', width: '16px', height: '16px', opacity: 0 }
  ], {
    duration: 620,
    easing: 'cubic-bezier(.4,0,.2,1)',
    fill: 'forwards'
  });

  setTimeout(function() {
    cartW.classList.remove('bounce');
    void cartW.offsetWidth;
    cartW.classList.add('bounce');
    clone.remove();
  }, 620);
}


// ═══════════════════════════════════════════════════════════════════
//  7. CART BAR SYNC
// ═══════════════════════════════════════════════════════════════════

function syncCartBar() {
  var totalQty = 0, totalPrice = 0;
  for (var i = 0; i < cart.length; i++) {
    totalQty   += cart[i].qty;
    totalPrice += cart[i].price * cart[i].qty;
  }

  var badge = document.getElementById('cart-badge');
  badge.textContent = totalQty;
  badge.classList.remove('pop');
  void badge.offsetWidth;
  badge.classList.add('pop');

  document.getElementById('cart-bar-total').textContent = totalPrice.toFixed(2) + ' د.أ';
  document.getElementById('cart-total').textContent     = totalPrice.toFixed(2) + ' د.أ';
  document.getElementById('cart-footer').style.display  = totalQty > 0 ? 'block' : 'none';
}


// ═══════════════════════════════════════════════════════════════════
//  8. CART DRAWER
// ═══════════════════════════════════════════════════════════════════

function openDrawer() {
  showCartView(); // always start on cart view
  renderCartItems();
  syncCartBar();
  document.getElementById('cart-drawer').classList.add('open');
  document.getElementById('cart-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeDrawer() {
  document.getElementById('cart-drawer').classList.remove('open');
  document.getElementById('cart-overlay').classList.remove('open');
  document.body.style.overflow = '';
}

function showCartView() {
  document.getElementById('cart-view').style.display = 'flex';
  document.getElementById('whatsapp-view').style.display = 'none';
}

function showWhatsAppView() {
  if (cart.length === 0) return;
  document.getElementById('cart-view').style.display = 'none';
  document.getElementById('whatsapp-view').style.display = 'flex';
}

function renderCartItems() {
  var container = document.getElementById('cart-items-container');

  if (cart.length === 0) {
    container.innerHTML =
      '<div class="cart-empty">' +
        '<i class="fa-solid fa-basket-shopping"></i>' +
        '<p>السلة فارغة</p>' +
        '<span>أضف بعض الأطباق الشهية!</span>' +
      '</div>';
    return;
  }

  var html = '';
  for (var i = 0; i < cart.length; i++) {
    var item = cart[i];
    var lineTotal = (item.price * item.qty).toFixed(2);
    var sizeLabel = item.size ? '<div class="ci-size">' + item.size + '</div>' : '';

    var decBtn;
    if (item.qty === 1) {
      decBtn = '<button class="q-btn del" data-action="remove" data-idx="' + i + '"><i class="fa-solid fa-trash-can"></i></button>';
    } else {
      decBtn = '<button class="q-btn" data-action="dec" data-idx="' + i + '">−</button>';
    }

    html +=
      '<div class="cart-item">' +
        '<img class="ci-img" src="' + (item.image || FALLBACK_IMG) + '" alt="' + escAttr(item.name) + '" onerror="this.onerror=null;this.src=\'' + FALLBACK_IMG + '\'">' +
        '<div class="ci-details">' +
          '<div class="ci-name">' + item.name + '</div>' +
          sizeLabel +
          '<div class="ci-controls">' +
            decBtn +
            '<span class="ci-qty">' + item.qty + '</span>' +
            '<button class="q-btn" data-action="inc" data-idx="' + i + '">+</button>' +
          '</div>' +
        '</div>' +
        '<div class="ci-price">' + lineTotal + ' د.أ</div>' +
      '</div>';
  }
  container.innerHTML = html;

  // Delegation for qty buttons
  container.onclick = function(e) {
    var btn = e.target.closest('[data-action]');
    if (!btn) return;
    var idx = parseInt(btn.dataset.idx);
    var action = btn.dataset.action;

    if (action === 'inc') {
      cart[idx].qty++;
    } else if (action === 'dec') {
      cart[idx].qty--;
      if (cart[idx].qty <= 0) cart.splice(idx, 1);
    } else if (action === 'remove') {
      cart.splice(idx, 1);
    }

    renderCartItems();
    syncCartBar();
  };
}


// ═══════════════════════════════════════════════════════════════════
//  9. TOAST
// ═══════════════════════════════════════════════════════════════════

var _toastTimer;
function showToast() {
  var t = document.getElementById('toast');
  clearTimeout(_toastTimer);
  t.classList.add('show');
  _toastTimer = setTimeout(function() { t.classList.remove('show'); }, 2000);
}


// ═══════════════════════════════════════════════════════════════════
// 10. WHATSAPP DISPATCHER
// ═══════════════════════════════════════════════════════════════════

function sendWhatsApp(person) {
  if (cart.length === 0) return;

  var rep = REPS[person];
  var lines = '';
  var total = 0;

  for (var i = 0; i < cart.length; i++) {
    var item = cart[i];
    var sizeLabel = item.size ? ' (' + item.size + ')' : '';
    var lineTotal = (item.price * item.qty).toFixed(2);
    total += item.price * item.qty;
    lines += '• ' + item.name + sizeLabel + ' × ' + item.qty + ' = ' + lineTotal + ' د.أ\n';
  }

  var msg = rep.greeting + '\n' +
    'عندي طلب جديد من الموقع:\n\n' +
    '📋 تفاصيل الطلب:\n' +
    lines + '\n' +
    '💵 المجموع الكلي: ' + total.toFixed(2) + ' د.أ\n' +
    '🚚 رسوم التوصيل: مجاناً';

  var url = 'https://wa.me/' + rep.phone + '?text=' + encodeURIComponent(msg);
  window.open(url, '_blank');

  // Reset
  closeDrawer();
  cart = [];
  syncCartBar();
}
