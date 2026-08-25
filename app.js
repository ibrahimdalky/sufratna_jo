/* ═══════════════════════════════════════════════════════════════════
   سفرتنا – App Logic (Refactored)
   ═══════════════════════════════════════════════════════════════════
   Architecture:
     1. Bulletproof CSV parser (handles missing columns, HTML img tags)
     2. Swiper.js coverflow – initialized ONLY after DOM render
     3. Per-card size state via DOM data attributes (survives re-render)
     4. Fly-to-cart animation with parabolic arc
     5. Cart state with live UI sync
     6. WhatsApp dispatcher with URL-encoded message
   ═══════════════════════════════════════════════════════════════════ */

// ─── CONSTANTS ────────────────────────────────────────────────────
const CSV_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vR9p3HjkTJAsmNyFCDCcYAzg1wot5iz6AcCWN618PRzqd8Zw6ZSbcYtZ85o-wTs6tLpBYWFvqD4yl9S/pub?output=csv';

const WHATSAPP = {
  ibrahim: { number: '962787364679', greeting: 'مرحبا ابراهيم 👋' },
  rakan:   { number: '96278929001',  greeting: 'مرحبا ركان 👋' }
};

// ─── STATE ────────────────────────────────────────────────────────
let allProducts     = [];   // All parsed products (flat array of objects)
let filteredProducts = [];  // Products visible after category filter
let activeCategory  = 'الكل';
let cart            = [];   // { id, name, size, price, qty, image }
let swiperInstance  = null;
let logoUrl         = '';

// ═══════════════════════════════════════════════════════════════════
// 1. CSV FETCH & BULLETPROOF PARSE
// ═══════════════════════════════════════════════════════════════════

/**
 * Entry point – fetches CSV text from Google Sheets.
 */
async function fetchProducts() {
  try {
    const res = await fetch(CSV_URL);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const text = await res.text();
    parseCSV(text);
  } catch (err) {
    console.error('Fetch error:', err);
    document.getElementById('skeleton-loader').innerHTML = `
      <div style="text-align:center;padding:40px;color:var(--text-muted)">
        <i class="fa-solid fa-triangle-exclamation" style="font-size:2rem;color:var(--primary);margin-bottom:12px"></i>
        <p>عذراً، حدث خطأ في تحميل المنتجات</p>
        <button onclick="location.reload()" style="margin-top:16px;padding:10px 24px;border-radius:50px;border:1px solid var(--glass-border);background:var(--glass-bg);color:var(--text-main);font-family:'Readex Pro',sans-serif;cursor:pointer">
          إعادة المحاولة
        </button>
      </div>`;
  }
}

/**
 * Parses raw CSV text. Finds the header row dynamically by looking
 * for a row containing "id". Maps each data row to a product object
 * using header-based column lookup (column order doesn't matter).
 */
function parseCSV(text) {
  const rows = tokenizeCSV(text);

  // ── Find header row (any row that contains a cell trimming to "id")
  let headerIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].some(c => c.trim().toLowerCase() === 'id')) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) { console.error('Header row not found'); return; }

  // ── Normalize header names
  const headers = rows[headerIdx].map(h => h.trim().toLowerCase().replace(/\s+/g, '_'));
  const data    = rows.slice(headerIdx + 1);

  allProducts = [];

  for (const row of data) {
    // Skip empty rows (need at least an id and a name)
    if (!row[0] || !row[0].trim()) continue;

    // Build product object by header name
    const p = {};
    headers.forEach((key, i) => { p[key] = (row[i] || '').trim(); });

    // ── Availability: default TRUE when column is missing
    if (p.is_available && p.is_available.toUpperCase() === 'FALSE') continue;

    // ── Image URL: extract src from HTML <img> tags
    p.image_url = extractSrc(p.image_url);

    // ── Logo: grab from first product that has it
    if (!logoUrl && p.logo) logoUrl = extractSrc(p.logo);

    // ── Base price
    p.base_price = parseFloat(p.base_price) || 0;

    // ── Variants from sizes_and_prices
    p.variants = parseSizes(p.sizes_and_prices);

    // If no variants, create a single default variant from base_price
    if (p.variants.length === 0) {
      p.variants = [{ size: '', price: p.base_price }];
    }

    allProducts.push(p);
  }

  // ── Set logo
  const logoEl = document.getElementById('brand-logo');
  if (logoUrl && logoEl) {
    logoEl.src = logoUrl;
  } else {
    const c = document.getElementById('logo-container');
    if (c) c.style.display = 'none';
  }

  // ── First render
  filteredProducts = [...allProducts];
  renderCategoryTabs();
  renderProducts();
}

/**
 * Robust CSV tokenizer. Handles:
 *  - Quoted fields containing commas, newlines, and double-quotes
 *  - Mixed \r\n / \n / \r line endings
 */
function tokenizeCSV(text) {
  const rows = [];
  let row = [], cell = '', inQ = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i], nx = text[i + 1];

    if (inQ) {
      if (ch === '"' && nx === '"') { cell += '"'; i++; }
      else if (ch === '"')          { inQ = false; }
      else                          { cell += ch; }
    } else {
      if (ch === '"')                             { inQ = true; }
      else if (ch === ',')                        { row.push(cell); cell = ''; }
      else if (ch === '\r' && nx === '\n')         { row.push(cell); cell = ''; rows.push(row); row = []; i++; }
      else if (ch === '\n' || ch === '\r')         { row.push(cell); cell = ''; rows.push(row); row = []; }
      else                                        { cell += ch; }
    }
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

/**
 * Extracts the first `src` URL from an HTML string.
 * Handles both single-quoted and double-quoted (escaped) src attributes.
 */
function extractSrc(html) {
  if (!html) return '';
  // Try standard src="..." first, then escaped src=""...""
  let m = html.match(/src\s*=\s*"([^"]+)"/i)
       || html.match(/src\s*=\s*""([^"]+)""/i)
       || html.match(/src\s*=\s*'([^']+)'/i);
  if (m) return m[1];
  // Already a plain URL?
  if (/^https?:\/\//i.test(html)) return html.trim();
  return '';
}

/**
 * Parses "وسط=2.5, كبير=4" → [{ size:'وسط', price:2.5 }, { size:'كبير', price:4 }]
 */
function parseSizes(str) {
  if (!str || !str.trim()) return [];
  return str.split(',')
    .map(pair => {
      const [name, val] = pair.split('=').map(s => s.trim());
      const price = parseFloat(val);
      return (name && !isNaN(price)) ? { size: name, price } : null;
    })
    .filter(Boolean);
}


// ═══════════════════════════════════════════════════════════════════
// 2. CATEGORY TABS
// ═══════════════════════════════════════════════════════════════════

function renderCategoryTabs() {
  const cats = ['الكل', ...new Set(allProducts.map(p => p.category).filter(Boolean))];
  const $tabs = document.getElementById('category-tabs');

  $tabs.innerHTML = cats.map(c =>
    `<button class="category-tab${c === activeCategory ? ' active' : ''}"
             data-cat="${c}">${c}</button>`
  ).join('');

  // Event delegation (avoids inline onclick with Arabic quotes issues)
  $tabs.onclick = e => {
    const btn = e.target.closest('.category-tab');
    if (btn) filterByCategory(btn.dataset.cat);
  };
}

function filterByCategory(cat) {
  activeCategory = cat;

  document.querySelectorAll('.category-tab').forEach(t =>
    t.classList.toggle('active', t.dataset.cat === cat)
  );

  filteredProducts = cat === 'الكل'
    ? [...allProducts]
    : allProducts.filter(p => p.category === cat);

  renderProducts();
}


// ═══════════════════════════════════════════════════════════════════
// 3. PRODUCT RENDERING & SWIPER INITIALIZATION
// ═══════════════════════════════════════════════════════════════════

/**
 * Renders product cards into the Swiper wrapper, then initializes
 * (or re-initializes) Swiper. Swiper is NEVER created before cards
 * exist in the DOM.
 */
function renderProducts() {
  document.getElementById('skeleton-loader').style.display = 'none';

  const $section = document.getElementById('products-section');
  const $empty   = document.getElementById('empty-state');
  const $wrapper = document.getElementById('swiper-wrapper');

  if (!filteredProducts.length) {
    $section.style.display = 'none';
    $empty.style.display   = 'block';
    return;
  }

  $empty.style.display   = 'none';
  $section.style.display = 'block';

  // ── Build slide HTML
  $wrapper.innerHTML = filteredProducts.map(product => {
    const defaultPrice = product.variants[0].price;
    const defaultSize  = product.variants[0].size;
    const hasSizes     = product.variants.length > 1 || product.variants[0].size !== '';

    const pills = hasSizes
      ? `<div class="size-selector">${
          product.variants.map((v, i) =>
            `<button class="size-pill${i === 0 ? ' active' : ''}"
                     data-vidx="${i}"
                     data-vprice="${v.price}"
                     data-vsize="${v.size}">${v.size}</button>`
          ).join('')
        }</div>`
      : '';

    // Fallback image as inline SVG data URI
    const fallback = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 300'%3E%3Crect fill='%231C1917' width='400' height='300'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%23C47D4C' font-size='48'%3E🍽️%3C/text%3E%3C/svg%3E";

    return `
      <div class="swiper-slide">
        <div class="product-card"
             data-pid="${product.id}"
             data-pname="${product.name}"
             data-pimage="${product.image_url}"
             data-active-price="${defaultPrice}"
             data-active-size="${defaultSize}">
          <div class="product-image-wrapper">
            <img class="product-image"
                 src="${product.image_url || fallback}"
                 alt="${product.name}"
                 loading="lazy"
                 onerror="this.onerror=null;this.src='${fallback}'" />
          </div>
          <div class="product-info">
            <h3 class="product-name">${product.name}</h3>
            <p class="product-description">${product.description || ''}</p>
            ${pills}
            <div class="product-price-row">
              <span class="product-price">${defaultPrice.toFixed(2)} <span class="currency">د.أ</span></span>
            </div>
            <button class="add-to-cart-btn" aria-label="أضف إلى السلة">
              <i class="fa-solid fa-cart-plus"></i>
              <span>أضف إلى السلة</span>
            </button>
          </div>
        </div>
      </div>`;
  }).join('');

  // ── Attach event listeners via delegation on the wrapper
  $wrapper.onclick = handleCardClick;

  // ── Initialize Swiper AFTER cards are in the DOM
  initSwiper();
}

/**
 * Event delegation handler for all clicks inside product cards.
 */
function handleCardClick(e) {
  const sizePill = e.target.closest('.size-pill');
  const addBtn   = e.target.closest('.add-to-cart-btn');

  if (sizePill) {
    e.stopPropagation();
    selectSize(sizePill);
    return;
  }

  if (addBtn) {
    e.stopPropagation();
    const card = addBtn.closest('.product-card');
    if (card) addToCart(card);
    return;
  }
}

/**
 * Initializes Swiper.js coverflow effect.
 * Destroys any previous instance first.
 * Called ONLY after product slides exist in the DOM.
 */
function initSwiper() {
  // Destroy previous instance cleanly
  if (swiperInstance) {
    swiperInstance.destroy(true, true);
    swiperInstance = null;
  }

  swiperInstance = new Swiper('#product-swiper', {
    effect: 'coverflow',
    grabCursor: true,
    centeredSlides: true,
    slidesPerView: 'auto',
    initialSlide: 0,

    coverflowEffect: {
      rotate: 0,
      stretch: 0,
      depth: 100,
      modifier: 2,
      slideShadows: false
    },

    // Touch handling
    touchEventsTarget: 'wrapper',
    touchRatio: 1,
    threshold: 5,
    resistance: true,
    resistanceRatio: 0.85,
    speed: 450,

    // Observe DOM changes
    observer: true,
    observeParents: true,

    // No loop – avoids duplicate DOM clones breaking data-pid lookups
    loop: false,

    a11y: {
      prevSlideMessage: 'المنتج السابق',
      nextSlideMessage: 'المنتج التالي',
    }
  });

  // Force layout update after mount
  swiperInstance.update();
}


// ═══════════════════════════════════════════════════════════════════
// 4. SIZE VARIANT SELECTION
// ═══════════════════════════════════════════════════════════════════

/**
 * Handles a size pill click. Updates the card's DOM data attributes
 * (data-active-price, data-active-size) and the visible price.
 */
function selectSize(pill) {
  const card      = pill.closest('.product-card');
  const selector  = pill.closest('.size-selector');
  const newPrice  = parseFloat(pill.dataset.vprice);
  const newSize   = pill.dataset.vsize;

  // Update active pill styling
  selector.querySelectorAll('.size-pill').forEach(p => p.classList.remove('active'));
  pill.classList.add('active');

  // Store on the card element for addToCart to read
  card.dataset.activePrice = newPrice;
  card.dataset.activeSize  = newSize;

  // Animate the price change
  const priceEl = card.querySelector('.product-price');
  priceEl.style.transform = 'scale(1.15)';
  priceEl.innerHTML = `${newPrice.toFixed(2)} <span class="currency">د.أ</span>`;
  setTimeout(() => { priceEl.style.transform = 'scale(1)'; }, 200);
}


// ═══════════════════════════════════════════════════════════════════
// 5. ADD TO CART
// ═══════════════════════════════════════════════════════════════════

/**
 * Reads the card's current state from its DOM data attributes
 * and adds (or increments) the item in the global cart.
 */
function addToCart(card) {
  const id    = card.dataset.pid;
  const name  = card.dataset.pname;
  const image = card.dataset.pimage;
  const price = parseFloat(card.dataset.activePrice);
  const size  = card.dataset.activeSize || '';

  // Check for existing identical item
  const existing = cart.find(i => i.id === id && i.size === size);
  if (existing) {
    existing.qty++;
  } else {
    cart.push({ id, name, size, price, qty: 1, image });
  }

  // Fly-to-cart animation
  const imgEl = card.querySelector('.product-image');
  if (imgEl) flyToCart(imgEl);

  updateCartUI();
  showToast();
}


// ═══════════════════════════════════════════════════════════════════
// 6. FLY-TO-CART ANIMATION
// ═══════════════════════════════════════════════════════════════════

/**
 * Clones the product image as a small circle and animates it
 * along a parabolic arc to the cart icon in the bottom bar.
 */
function flyToCart(imgEl) {
  const imgRect  = imgEl.getBoundingClientRect();
  const cartEl   = document.getElementById('cart-icon-wrapper');
  const cartRect = cartEl.getBoundingClientRect();

  // Start position: center of the image
  const startX = imgRect.left + imgRect.width / 2 - 30;
  const startY = imgRect.top  + imgRect.height / 2 - 30;

  // End position: center of cart icon
  const endX = cartRect.left + cartRect.width / 2 - 10;
  const endY = cartRect.top  + cartRect.height / 2 - 10;

  // Create clone
  const clone = document.createElement('img');
  clone.src       = imgEl.src;
  clone.className = 'fly-clone';
  clone.style.width  = '60px';
  clone.style.height = '60px';
  clone.style.left   = startX + 'px';
  clone.style.top    = startY + 'px';
  clone.style.opacity = '1';
  document.body.appendChild(clone);

  // Animate using Web Animations API for smooth parabolic path
  const duration = 650;
  const midX = (startX + endX) / 2;
  const midY = Math.min(startY, endY) - 80; // Arc peak above both points

  clone.animate([
    { left: startX + 'px', top: startY + 'px', width: '60px', height: '60px', opacity: 1 },
    { left: midX   + 'px', top: midY   + 'px', width: '40px', height: '40px', opacity: 0.85, offset: 0.5 },
    { left: endX   + 'px', top: endY   + 'px', width: '20px', height: '20px', opacity: 0 }
  ], {
    duration,
    easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
    fill: 'forwards'
  });

  // Bounce the cart icon on arrival
  setTimeout(() => {
    cartEl.classList.remove('bounce');
    void cartEl.offsetWidth; // reflow
    cartEl.classList.add('bounce');
    clone.remove();
  }, duration);
}


// ═══════════════════════════════════════════════════════════════════
// 7. CART STATE & UI
// ═══════════════════════════════════════════════════════════════════

/**
 * Syncs all cart-related UI elements with the current cart state.
 */
function updateCartUI() {
  const totalQty   = cart.reduce((s, i) => s + i.qty, 0);
  const totalPrice = cart.reduce((s, i) => s + i.price * i.qty, 0);

  // Badge
  const badge = document.getElementById('cart-badge');
  badge.textContent = totalQty;
  badge.classList.remove('pulse');
  void badge.offsetWidth;
  badge.classList.add('pulse');

  // Totals
  document.getElementById('cart-bar-total').textContent   = totalPrice.toFixed(2) + ' د.أ';
  document.getElementById('cart-total-price').textContent  = totalPrice.toFixed(2) + ' د.أ';

  // Footer visibility
  document.getElementById('cart-drawer-footer').style.display = totalQty > 0 ? 'block' : 'none';
}

/**
 * Renders the cart items list inside the drawer body.
 */
function renderCartItems() {
  const $body = document.getElementById('cart-drawer-body');

  if (cart.length === 0) {
    $body.innerHTML = `
      <div class="cart-empty-state">
        <i class="fa-solid fa-basket-shopping"></i>
        <p>السلة فارغة</p>
        <span>أضف بعض الأطباق الشهية!</span>
      </div>`;
    return;
  }

  const fallback = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect fill='%231C1917' width='100' height='100'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%23C47D4C' font-size='32'%3E🍽️%3C/text%3E%3C/svg%3E";

  $body.innerHTML = cart.map((item, idx) => `
    <div class="cart-item">
      <img class="cart-item-image" src="${item.image || fallback}" alt="${item.name}"
           onerror="this.onerror=null;this.src='${fallback}'" />
      <div class="cart-item-details">
        <div class="cart-item-name">${item.name}</div>
        ${item.size ? `<div class="cart-item-variant">${item.size}</div>` : ''}
        <div class="cart-item-controls">
          ${item.qty === 1
            ? `<button class="qty-btn delete" data-action="remove" data-idx="${idx}" aria-label="حذف"><i class="fa-solid fa-trash-can"></i></button>`
            : `<button class="qty-btn" data-action="dec" data-idx="${idx}" aria-label="تقليل">−</button>`
          }
          <span class="cart-item-qty">${item.qty}</span>
          <button class="qty-btn" data-action="inc" data-idx="${idx}" aria-label="زيادة">+</button>
        </div>
      </div>
      <div class="cart-item-price">${(item.price * item.qty).toFixed(2)} د.أ</div>
    </div>
  `).join('');

  // Event delegation for quantity buttons
  $body.onclick = e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const idx    = parseInt(btn.dataset.idx);
    const action = btn.dataset.action;

    if (action === 'inc')    { cart[idx].qty++; }
    else if (action === 'dec') { cart[idx].qty--; if (cart[idx].qty <= 0) cart.splice(idx, 1); }
    else if (action === 'remove') { cart.splice(idx, 1); }

    renderCartItems();
    updateCartUI();
  };
}


// ═══════════════════════════════════════════════════════════════════
// 8. CART DRAWER TOGGLE
// ═══════════════════════════════════════════════════════════════════

function toggleCartDrawer() {
  const drawer  = document.getElementById('cart-drawer');
  const overlay = document.getElementById('cart-overlay');
  const isOpen  = drawer.classList.contains('open');

  if (isOpen) {
    drawer.classList.remove('open');
    overlay.classList.remove('open');
    document.body.style.overflow = '';
  } else {
    renderCartItems();
    updateCartUI();
    drawer.classList.add('open');
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
}


// ═══════════════════════════════════════════════════════════════════
// 9. TOAST NOTIFICATION
// ═══════════════════════════════════════════════════════════════════

let _toastTimer;
function showToast() {
  const t = document.getElementById('toast');
  clearTimeout(_toastTimer);
  t.classList.add('show');
  _toastTimer = setTimeout(() => t.classList.remove('show'), 2000);
}


// ═══════════════════════════════════════════════════════════════════
// 10. WHATSAPP DISPATCHER
// ═══════════════════════════════════════════════════════════════════

function openWhatsAppModal() {
  if (!cart.length) return;

  // Close cart drawer first
  toggleCartDrawer();

  setTimeout(() => {
    document.getElementById('whatsapp-modal').classList.add('open');
    document.getElementById('whatsapp-overlay').classList.add('open');
    document.body.style.overflow = 'hidden';
  }, 350);
}

function closeWhatsAppModal() {
  document.getElementById('whatsapp-modal').classList.remove('open');
  document.getElementById('whatsapp-overlay').classList.remove('open');
  document.body.style.overflow = '';
}

/**
 * Builds the WhatsApp message, URL-encodes it, and opens wa.me.
 */
function sendWhatsApp(person) {
  const { number, greeting } = WHATSAPP[person];

  const lines = cart.map(item => {
    const sizeLabel = item.size ? ` (${item.size})` : '';
    const lineTotal = (item.price * item.qty).toFixed(2);
    return `• ${item.name}${sizeLabel} × ${item.qty} = ${lineTotal} د.أ`;
  });

  const total = cart.reduce((s, i) => s + i.price * i.qty, 0).toFixed(2);

  const msg = [
    greeting,
    'عندي طلب جديد من الموقع:',
    '',
    '📋 تفاصيل الطلب:',
    ...lines,
    '',
    `💵 المجموع الكلي: ${total} د.أ`,
    '🚚 رسوم التوصيل: مجاناً'
  ].join('\n');

  window.open(`https://wa.me/${number}?text=${encodeURIComponent(msg)}`, '_blank');

  // Reset
  closeWhatsAppModal();
  cart = [];
  updateCartUI();
}


// ═══════════════════════════════════════════════════════════════════
// 11. BOOT
// ═══════════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', fetchProducts);
