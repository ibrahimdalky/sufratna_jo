/* ═══════════════════════════════════════════════════════════════════
   سفرتنا – App Logic
   ───────────────────────────────────────────────────────────────
   Handles:
   1. CSV Fetch & Parse from Google Sheets
   2. Product rendering & Swiper.js Coverflow slider
   3. Category filtering
   4. Size variant selection
   5. Cart state management
   6. Fly-to-cart animation
   7. Cart drawer (bottom sheet)
   8. WhatsApp dispatcher & message builder
   ═══════════════════════════════════════════════════════════════════ */

// ─── CONSTANTS ────────────────────────────────────────────────────
const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vR9p3HjkTJAsmNyFCDCcYAzg1wot5iz6AcCWN618PRzqd8Zw6ZSbcYtZ85o-wTs6tLpBYWFvqD4yl9S/pub?output=csv';

const WHATSAPP_NUMBERS = {
  ibrahim: '962787364679',
  rakan: '96278929001'
};

const WHATSAPP_GREETINGS = {
  ibrahim: 'مرحبا ابراهيم 👋',
  rakan: 'مرحبا ركان 👋'
};

// ─── STATE ────────────────────────────────────────────────────────
let allProducts = [];        // All parsed products
let filteredProducts = [];   // Products after category filter
let activeCategory = 'الكل';
let cart = [];               // Cart items: { id, name, size, price, qty, image }
let swiperInstance = null;   // Swiper.js instance reference
let logoUrl = '';            // Brand logo extracted from CSV

// ─── DOM REFERENCES ──────────────────────────────────────────────
const $skeleton = document.getElementById('skeleton-loader');
const $productsSection = document.getElementById('products-section');
const $swiperWrapper = document.getElementById('swiper-wrapper');
const $categoryTabs = document.getElementById('category-tabs');
const $emptyState = document.getElementById('empty-state');
const $cartBadge = document.getElementById('cart-badge');
const $cartBarTotal = document.getElementById('cart-bar-total');
const $cartDrawerBody = document.getElementById('cart-drawer-body');
const $cartEmpty = document.getElementById('cart-empty');
const $cartDrawerFooter = document.getElementById('cart-drawer-footer');
const $cartTotalPrice = document.getElementById('cart-total-price');
const $toast = document.getElementById('toast');
const $brandLogo = document.getElementById('brand-logo');

// ═══════════════════════════════════════════════════════════════════
// 1. CSV FETCH & PARSE
// ═══════════════════════════════════════════════════════════════════

/**
 * Fetches CSV from Google Sheets and parses it into product objects.
 * Handles HTML-embedded image URLs and sizes_and_prices parsing.
 */
async function fetchProducts() {
  try {
    const response = await fetch(CSV_URL);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const csvText = await response.text();
    parseCSV(csvText);
  } catch (error) {
    console.error('Error fetching products:', error);
    // Show error state
    $skeleton.innerHTML = `
      <div style="text-align:center; padding:40px; color:var(--text-muted);">
        <i class="fa-solid fa-triangle-exclamation" style="font-size:2rem; color:var(--primary); margin-bottom:12px;"></i>
        <p>عذراً، حدث خطأ في تحميل المنتجات</p>
        <button onclick="location.reload()" style="margin-top:16px; padding:10px 24px; border-radius:50px; border:1px solid var(--glass-border); background:var(--glass-bg); color:var(--text-main); font-family:'Readex Pro',sans-serif; cursor:pointer;">
          إعادة المحاولة
        </button>
      </div>`;
  }
}

/**
 * Parses raw CSV text into structured product objects.
 * CSV format uses commas as delimiter with quoted fields for HTML content.
 */
function parseCSV(csvText) {
  const rows = parseCSVRows(csvText);
  
  // Find the header row (contains 'id')
  let headerIndex = -1;
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].some(cell => cell.trim().toLowerCase() === 'id')) {
      headerIndex = i;
      break;
    }
  }

  if (headerIndex === -1) {
    console.error('Could not find header row in CSV');
    return;
  }

  const headers = rows[headerIndex].map(h => h.trim().toLowerCase());
  const dataRows = rows.slice(headerIndex + 1);

  allProducts = [];

  for (const row of dataRows) {
    if (row.length < 3 || !row[0].trim()) continue;

    const product = {};
    headers.forEach((header, index) => {
      product[header] = (row[index] || '').trim();
    });

    // Skip unavailable products
    if (product.is_available && product.is_available.toUpperCase() === 'FALSE') continue;

    // Extract image URL from HTML <img> tag if present
    product.image_url = extractImageSrc(product.image_url || '');
    
    // Extract logo URL from the first product that has it
    if (!logoUrl && product.logo) {
      logoUrl = extractImageSrc(product.logo);
    }

    // Parse sizes_and_prices
    product.variants = parseSizesAndPrices(product.sizes_and_prices || '');
    product.base_price = parseFloat(product.base_price) || 0;

    // Determine the active/default price
    if (product.variants.length > 0) {
      product.activeVariant = 0; // First variant is default
      product.currentPrice = product.variants[0].price;
    } else {
      product.currentPrice = product.base_price;
    }

    allProducts.push(product);
  }

  // Set logo
  if (logoUrl && $brandLogo) {
    $brandLogo.src = logoUrl;
    $brandLogo.style.display = 'block';
  } else {
    // Hide logo container if no logo found
    const logoContainer = document.querySelector('.logo-container');
    if (logoContainer) logoContainer.style.display = 'none';
  }

  // Initialize UI
  filteredProducts = [...allProducts];
  renderCategoryTabs();
  renderProducts();
}

/**
 * Robust CSV parser that handles quoted fields with commas and newlines.
 * Returns an array of rows, each row being an array of cell values.
 */
function parseCSVRows(text) {
  const rows = [];
  let currentRow = [];
  let currentCell = '';
  let inQuotes = false;
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        // Escaped quote
        currentCell += '"';
        i++;
      } else if (char === '"') {
        // End of quoted field
        inQuotes = false;
      } else {
        currentCell += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        currentRow.push(currentCell);
        currentCell = '';
      } else if (char === '\n' || (char === '\r' && nextChar === '\n')) {
        currentRow.push(currentCell);
        currentCell = '';
        rows.push(currentRow);
        currentRow = [];
        if (char === '\r') i++; // Skip \n in \r\n
      } else if (char === '\r') {
        currentRow.push(currentCell);
        currentCell = '';
        rows.push(currentRow);
        currentRow = [];
      } else {
        currentCell += char;
      }
    }
  }

  // Don't forget the last cell/row
  if (currentCell || currentRow.length > 0) {
    currentRow.push(currentCell);
    rows.push(currentRow);
  }

  return rows;
}

/**
 * Extracts the src attribute from an HTML <img> tag string.
 * Falls back to returning the original string if no tag is found.
 */
function extractImageSrc(htmlString) {
  if (!htmlString) return '';
  const match = htmlString.match(/src="([^"]+)"/i) || htmlString.match(/src=""([^"]+)""/i);
  if (match) return match[1];
  // If it's already a plain URL
  if (htmlString.startsWith('http')) return htmlString;
  return '';
}

/**
 * Parses the sizes_and_prices string (e.g. "وسط=2.5, كبير=4")
 * into an array of { name, price } objects.
 */
function parseSizesAndPrices(str) {
  if (!str || !str.trim()) return [];

  const variants = [];
  const pairs = str.split(',');

  for (const pair of pairs) {
    const [name, price] = pair.split('=').map(s => s.trim());
    if (name && price && !isNaN(parseFloat(price))) {
      variants.push({
        name: name,
        price: parseFloat(price)
      });
    }
  }

  return variants;
}


// ═══════════════════════════════════════════════════════════════════
// 2. CATEGORY TABS
// ═══════════════════════════════════════════════════════════════════

/**
 * Renders category filter tabs from the product data.
 * Extracts unique categories and adds an "الكل" (All) tab.
 */
function renderCategoryTabs() {
  const categories = ['الكل', ...new Set(allProducts.map(p => p.category).filter(Boolean))];

  $categoryTabs.innerHTML = categories.map(cat => `
    <button class="category-tab ${cat === activeCategory ? 'active' : ''}"
            onclick="filterByCategory('${cat}')"
            aria-label="تصنيف ${cat}">
      ${cat}
    </button>
  `).join('');
}

/**
 * Filters products by category and re-renders the slider.
 */
function filterByCategory(category) {
  activeCategory = category;

  // Update tab styles
  document.querySelectorAll('.category-tab').forEach(tab => {
    tab.classList.toggle('active', tab.textContent.trim() === category);
  });

  // Filter products
  if (category === 'الكل') {
    filteredProducts = [...allProducts];
  } else {
    filteredProducts = allProducts.filter(p => p.category === category);
  }

  renderProducts();
}

// ═══════════════════════════════════════════════════════════════════
// 3. PRODUCT RENDERING & SWIPER
// ═══════════════════════════════════════════════════════════════════

/**
 * Renders the product cards inside the Swiper slider.
 * Destroys existing Swiper instance and creates a new one.
 */
function renderProducts() {
  // Hide skeleton
  $skeleton.style.display = 'none';

  if (filteredProducts.length === 0) {
    $productsSection.style.display = 'none';
    $emptyState.style.display = 'block';
    return;
  }

  $emptyState.style.display = 'none';
  $productsSection.style.display = 'block';

  // Build slide HTML
  $swiperWrapper.innerHTML = filteredProducts.map((product, index) => {
    const sizePills = product.variants.length > 0
      ? `<div class="size-selector" id="size-selector-${product.id}">
          ${product.variants.map((v, vi) => `
            <button class="size-pill ${vi === 0 ? 'active' : ''}"
                    onclick="selectSize('${product.id}', ${vi}, event)"
                    data-variant-index="${vi}">
              ${v.name}
            </button>
          `).join('')}
        </div>`
      : '';

    return `
      <div class="swiper-slide">
        <div class="product-card" data-product-id="${product.id}">
          <div class="product-image-wrapper">
            <img class="product-image"
                 src="${product.image_url}"
                 alt="${product.name}"
                 loading="lazy"
                 onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 400 300%22><rect fill=%22%231C1917%22 width=%22400%22 height=%22300%22/><text x=%2250%25%22 y=%2250%25%22 dominant-baseline=%22middle%22 text-anchor=%22middle%22 fill=%22%23C47D4C%22 font-size=%2248%22>🍽️</text></svg>'" />
          </div>
          <div class="product-info">
            <h3 class="product-name">${product.name}</h3>
            <p class="product-description">${product.description || ''}</p>
            ${sizePills}
            <div class="product-price-row">
              <div class="product-price" id="price-${product.id}">
                ${product.currentPrice.toFixed(2)} <span class="currency">د.أ</span>
              </div>
            </div>
            <button class="add-to-cart-btn"
                    onclick="addToCart('${product.id}', event)"
                    aria-label="أضف ${product.name} إلى السلة">
              <i class="fa-solid fa-cart-plus"></i>
              <span>أضف إلى السلة</span>
            </button>
          </div>
        </div>
      </div>`;
  }).join('');

  // Initialize Swiper
  initSwiper();
}

/**
 * Initializes Swiper.js with Coverflow 3D effect.
 * Destroys existing instance to prevent memory leaks.
 */
function initSwiper() {
  if (swiperInstance) {
    swiperInstance.destroy(true, true);
    swiperInstance = null;
  }

  swiperInstance = new Swiper('.product-swiper', {
    effect: 'coverflow',
    grabCursor: true,
    centeredSlides: true,
    slidesPerView: 'auto',
    initialSlide: 0,

    // Coverflow 3D parameters (as specified)
    coverflowEffect: {
      rotate: 0,
      stretch: 0,
      depth: 120,
      modifier: 2.5,
      slideShadows: false
    },

    // Touch/swipe behavior
    touchRatio: 1.2,
    threshold: 5,
    resistance: true,
    resistanceRatio: 0.85,

    // Smooth animations
    speed: 500,

    // Loop for seamless scrolling (only if enough slides)
    loop: filteredProducts.length > 2,

    // Accessibility
    a11y: {
      prevSlideMessage: 'المنتج السابق',
      nextSlideMessage: 'المنتج التالي',
    }
  });
}


// ═══════════════════════════════════════════════════════════════════
// 4. SIZE VARIANT SELECTION
// ═══════════════════════════════════════════════════════════════════

/**
 * Handles size pill selection. Updates the product's active variant
 * and reflects the new price in the card.
 */
function selectSize(productId, variantIndex, event) {
  event.stopPropagation();

  const product = allProducts.find(p => p.id === productId);
  if (!product || !product.variants[variantIndex]) return;

  // Update active variant
  product.activeVariant = variantIndex;
  product.currentPrice = product.variants[variantIndex].price;

  // Update pill styles
  const selector = document.getElementById(`size-selector-${productId}`);
  if (selector) {
    selector.querySelectorAll('.size-pill').forEach((pill, i) => {
      pill.classList.toggle('active', i === variantIndex);
    });
  }

  // Update price display with a micro-animation
  const priceEl = document.getElementById(`price-${productId}`);
  if (priceEl) {
    priceEl.style.transform = 'scale(1.15)';
    priceEl.style.transition = 'transform 0.2s ease';
    priceEl.innerHTML = `${product.currentPrice.toFixed(2)} <span class="currency">د.أ</span>`;
    setTimeout(() => {
      priceEl.style.transform = 'scale(1)';
    }, 200);
  }
}


// ═══════════════════════════════════════════════════════════════════
// 5. CART MANAGEMENT
// ═══════════════════════════════════════════════════════════════════

/**
 * Adds a product to the cart with its selected size variant.
 * If the same product+size already exists, increments quantity.
 * Triggers fly-to-cart animation and toast notification.
 */
function addToCart(productId, event) {
  event.stopPropagation();

  const product = allProducts.find(p => p.id === productId);
  if (!product) return;

  const size = product.variants.length > 0
    ? product.variants[product.activeVariant || 0].name
    : '';
  const price = product.currentPrice;
  const name = product.name;
  const image = product.image_url;

  // Check if already in cart (same product + size)
  const existingIndex = cart.findIndex(
    item => item.id === productId && item.size === size
  );

  if (existingIndex >= 0) {
    cart[existingIndex].qty += 1;
  } else {
    cart.push({ id: productId, name, size, price, qty: 1, image });
  }

  // Trigger fly-to-cart animation
  const card = document.querySelector(`[data-product-id="${productId}"]`);
  if (card) {
    const imgEl = card.querySelector('.product-image');
    if (imgEl) flyToCart(imgEl);
  }

  // Update UI
  updateCartUI();
  showToast();
}

/**
 * Removes an item from the cart by index.
 */
function removeFromCart(index) {
  cart.splice(index, 1);
  updateCartUI();
  renderCartItems();
}

/**
 * Updates the quantity of a cart item.
 * Removes the item if quantity reaches 0.
 */
function updateQty(index, delta) {
  cart[index].qty += delta;
  if (cart[index].qty <= 0) {
    removeFromCart(index);
    return;
  }
  updateCartUI();
  renderCartItems();
}

/**
 * Recalculates totals and updates the floating cart bar and drawer.
 */
function updateCartUI() {
  const totalItems = cart.reduce((sum, item) => sum + item.qty, 0);
  const totalPrice = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);

  // Update badge
  $cartBadge.textContent = totalItems;
  $cartBadge.classList.remove('pulse');
  void $cartBadge.offsetWidth; // Force reflow for re-triggering animation
  $cartBadge.classList.add('pulse');

  // Update totals
  $cartBarTotal.textContent = `${totalPrice.toFixed(2)} د.أ`;
  $cartTotalPrice.textContent = `${totalPrice.toFixed(2)} د.أ`;

  // Show/hide cart footer
  $cartDrawerFooter.style.display = totalItems > 0 ? 'block' : 'none';
  $cartEmpty.style.display = totalItems > 0 ? 'none' : 'flex';
}

/**
 * Renders cart item rows inside the cart drawer.
 */
function renderCartItems() {
  if (cart.length === 0) {
    $cartDrawerBody.innerHTML = `
      <div class="cart-empty-state" id="cart-empty">
        <i class="fa-solid fa-basket-shopping"></i>
        <p>السلة فارغة</p>
        <span>أضف بعض الأطباق الشهية!</span>
      </div>`;
    return;
  }

  $cartDrawerBody.innerHTML = cart.map((item, index) => `
    <div class="cart-item">
      <img class="cart-item-image" src="${item.image}" alt="${item.name}"
           onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect fill=%22%231C1917%22 width=%22100%22 height=%22100%22/><text x=%2250%25%22 y=%2250%25%22 dominant-baseline=%22middle%22 text-anchor=%22middle%22 fill=%22%23C47D4C%22 font-size=%2232%22>🍽️</text></svg>'" />
      <div class="cart-item-details">
        <div class="cart-item-name">${item.name}</div>
        ${item.size ? `<div class="cart-item-variant">${item.size}</div>` : ''}
        <div class="cart-item-controls">
          ${item.qty === 1
            ? `<button class="qty-btn delete" onclick="removeFromCart(${index})" aria-label="حذف"><i class="fa-solid fa-trash-can"></i></button>`
            : `<button class="qty-btn" onclick="updateQty(${index}, -1)" aria-label="تقليل">−</button>`
          }
          <span class="cart-item-qty">${item.qty}</span>
          <button class="qty-btn" onclick="updateQty(${index}, 1)" aria-label="زيادة">+</button>
        </div>
      </div>
      <div class="cart-item-price">${(item.price * item.qty).toFixed(2)} د.أ</div>
    </div>
  `).join('');
}


// ═══════════════════════════════════════════════════════════════════
// 6. FLY-TO-CART ANIMATION
// ═══════════════════════════════════════════════════════════════════

/**
 * Creates a cloned miniature of the product image and animates it
 * flying toward the cart icon at the bottom of the screen.
 */
function flyToCart(imgElement) {
  const imgRect = imgElement.getBoundingClientRect();
  const cartIconEl = document.getElementById('cart-icon');
  const cartRect = cartIconEl.getBoundingClientRect();

  // Create flying clone
  const clone = document.createElement('img');
  clone.src = imgElement.src;
  clone.className = 'fly-to-cart-clone';
  clone.style.width = '70px';
  clone.style.height = '70px';
  clone.style.top = `${imgRect.top + imgRect.height / 2 - 35}px`;
  clone.style.left = `${imgRect.left + imgRect.width / 2 - 35}px`;

  document.body.appendChild(clone);

  // Force reflow before animating
  void clone.offsetWidth;

  // Animate to cart position
  requestAnimationFrame(() => {
    clone.style.top = `${cartRect.top + cartRect.height / 2 - 10}px`;
    clone.style.left = `${cartRect.left + cartRect.width / 2 - 10}px`;
    clone.classList.add('animate');
  });

  // Clean up clone after animation completes
  setTimeout(() => {
    clone.remove();
  }, 750);
}


// ═══════════════════════════════════════════════════════════════════
// 7. CART DRAWER (Bottom Sheet)
// ═══════════════════════════════════════════════════════════════════

/**
 * Toggles the cart drawer (bottom sheet modal) open/closed.
 */
function toggleCartDrawer() {
  const drawer = document.getElementById('cart-drawer');
  const overlay = document.getElementById('cart-overlay');
  const isOpen = drawer.classList.contains('open');

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
// 8. TOAST NOTIFICATION
// ═══════════════════════════════════════════════════════════════════

let toastTimeout;

/**
 * Shows a brief "added to cart" toast notification.
 */
function showToast() {
  clearTimeout(toastTimeout);
  $toast.classList.add('show');
  toastTimeout = setTimeout(() => {
    $toast.classList.remove('show');
  }, 2000);
}


// ═══════════════════════════════════════════════════════════════════
// 9. WHATSAPP DISPATCHER
// ═══════════════════════════════════════════════════════════════════

/**
 * Opens the WhatsApp contact selection modal.
 */
function openWhatsAppModal() {
  if (cart.length === 0) return;

  // Close cart drawer first
  toggleCartDrawer();

  // Small delay for visual transition
  setTimeout(() => {
    document.getElementById('whatsapp-modal').classList.add('open');
    document.getElementById('whatsapp-overlay').classList.add('open');
    document.body.style.overflow = 'hidden';
  }, 350);
}

/**
 * Closes the WhatsApp contact selection modal.
 */
function closeWhatsAppModal() {
  document.getElementById('whatsapp-modal').classList.remove('open');
  document.getElementById('whatsapp-overlay').classList.remove('open');
  document.body.style.overflow = '';
}

/**
 * Builds the WhatsApp message and opens the WhatsApp link.
 * @param {'ibrahim'|'rakan'} person - The selected contact person
 */
function sendWhatsApp(person) {
  const number = WHATSAPP_NUMBERS[person];
  const greeting = WHATSAPP_GREETINGS[person];

  // Build order details
  const orderLines = cart.map(item => {
    const sizeText = item.size ? ` (${item.size})` : '';
    const lineTotal = (item.price * item.qty).toFixed(2);
    return `• ${item.name}${sizeText} × ${item.qty} = ${lineTotal} د.أ`;
  });

  const totalPrice = cart.reduce((sum, item) => sum + (item.price * item.qty), 0).toFixed(2);

  const message = `${greeting}
عندي طلب جديد من الموقع:

📋 تفاصيل الطلب:
${orderLines.join('\n')}

💵 المجموع الكلي: ${totalPrice} د.أ
🚚 رسوم التوصيل: مجاناً`;

  // Build WhatsApp URL
  const encodedMessage = encodeURIComponent(message);
  const whatsappUrl = `https://wa.me/${number}?text=${encodedMessage}`;

  // Open WhatsApp
  window.open(whatsappUrl, '_blank');

  // Close modal & clear cart
  closeWhatsAppModal();
  cart = [];
  updateCartUI();
}


// ═══════════════════════════════════════════════════════════════════
// 10. INITIALIZATION
// ═══════════════════════════════════════════════════════════════════

// Start the app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  fetchProducts();
});
