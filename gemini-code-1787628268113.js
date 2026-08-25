// روابط وإعدادات المتجر
const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vR9p3HjkTJAsmNyFCDCcYAzg1wot5iz6AcCWN618PRzqd8Zw6ZSbcYtZ85o-wTs6tLpBYWFvqD4yl9S/pub?output=csv";
const REPS = {
  ibrahim: { name: "ابراهيم", phone: "962787364679" },
  rakan: { name: "ركان", phone: "96278929001" }
};

let allProducts = [];
let cart = [];
let swiperInstance = null;

// تشغيل التطبيق فور تحميل الصفحة
document.addEventListener("DOMContentLoaded", () => {
  fetchProducts();
  setupEventListeners();
});

// سحب البيانات من Google Sheets CSV
async function fetchProducts() {
  try {
    const res = await fetch(SHEET_CSV_URL);
    const csvText = await res.text();
    allProducts = parseCSV(csvText);
    
    document.getElementById("loader").style.display = "none";
    document.querySelector(".mySwiper").style.display = "block";
    
    renderCategories();
    renderProducts(allProducts);
  } catch (error) {
    console.error("Error loading products:", error);
    document.getElementById("loader").innerHTML = "<p>تعذر تحميل المنتجات، يرجى المحاولة لاحقاً.</p>";
  }
}

// دالة تحليل ملف الـ CSV
function parseCSV(text) {
  const lines = text.trim().split("\n").map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map(h => h.trim().replace(/^["']|["']$/g, ''));
  const products = [];

  for (let i = 1; i < lines.length; i++) {
    // معالجة الفواصل داخل النصوص
    const values = [];
    let insideQuotes = false;
    let currentVal = '';
    
    for (let char of lines[i]) {
      if (char === '"' || char === "'") {
        insideQuotes = !insideQuotes;
      } else if (char === ',' && !insideQuotes) {
        values.push(currentVal.trim().replace(/^["']|["']$/g, ''));
        currentVal = '';
      } else {
        currentVal += char;
      }
    }
    values.push(currentVal.trim().replace(/^["']|["']$/g, ''));

    const row = {};
    headers.forEach((h, index) => {
      row[h] = values[index] || '';
    });

    // استخراج الخيارات والأحجام
    const variants = parseVariants(row);
    products.push({
      id: row.id || i,
      name: row.name || 'طبق شهي',
      category: row.category || 'عام',
      description: row.description || '',
      image_url: row.image_url || 'https://via.placeholder.com/300',
      variants: variants,
      selectedVariantIndex: 0
    });
  }
  return products;
}

function parseVariants(row) {
  const raw = row.sizes_and_prices || '';
  const basePrice = parseFloat(row.base_price) || 0;
  if (!raw.trim()) {
    return [{ size: 'عادي', price: basePrice }];
  }

  const parts = raw.split(',');
  const list = [];
  parts.forEach(p => {
    const [s, pr] = p.split('=');
    if (s && pr) {
      list.push({ size: s.trim(), price: parseFloat(pr.trim()) || basePrice });
    }
  });

  return list.length ? list : [{ size: 'عادي', price: basePrice }];
}

// رسم التصنيفات
function renderCategories() {
  const container = document.getElementById("categories-container");
  const categories = ["الكل", ...new Set(allProducts.map(p => p.category).filter(Boolean))];

  container.innerHTML = categories.map((cat, idx) => `
    <button class="cat-btn ${idx === 0 ? 'active' : ''}" data-category="${cat}">${cat}</button>
  `).join('');

  container.querySelectorAll('.cat-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const selected = btn.dataset.category;
      const filtered = selected === "الكل" ? allProducts : allProducts.filter(p => p.category === selected);
      renderProducts(filtered);
    });
  });
}

// رسم المنتجات في الـ Swiper
function renderProducts(productsList) {
  const wrapper = document.getElementById("products-wrapper");
  wrapper.innerHTML = "";

  if (productsList.length === 0) {
    wrapper.innerHTML = `<div style="text-align:center; padding:30px; width:100%; color:var(--text-muted)">لا توجد منتجات في هذا القسم</div>`;
    return;
  }

  productsList.forEach((prod, pIdx) => {
    const activeVar = prod.variants[prod.selectedVariantIndex || 0];
    const hasMultipleSizes = prod.variants.length > 1;

    const slide = document.createElement("div");
    slide.className = "swiper-slide";
    slide.innerHTML = `
      <div class="product-card">
        <div class="product-img-box">
          <img src="${prod.image_url}" alt="${prod.name}" onerror="this.src='https://via.placeholder.com/300x200/1c1917/c47d4c?text=${encodeURIComponent(prod.name)}'">
        </div>
        <div class="product-info">
          <div>
            <h3 class="product-title">${prod.name}</h3>
            <p class="product-desc">${prod.description}</p>
          </div>

          <div>
            ${hasMultipleSizes ? `
              <div class="size-selector">
                ${prod.variants.map((v, vIdx) => `
                  <button class="size-pill ${(prod.selectedVariantIndex || 0) === vIdx ? 'active' : ''}" 
                          onclick="selectVariant(${prod.id}, ${vIdx})">
                    ${v.size}
                  </button>
                `).join('')}
              </div>
            ` : ''}

            <div class="product-price">${activeVar.price.toFixed(2)} د.أ</div>
            <button class="add-cart-btn" onclick="addToCart(${prod.id})">
              <i class="fa-solid fa-cart-plus"></i> أضف إلى السلة
            </button>
          </div>
        </div>
      </div>
    `;
    wrapper.appendChild(slide);
  });

  initSwiper();
}

// تشغيل Swiper مع معالجة وضع الـ RTL
function initSwiper() {
  if (swiperInstance) {
    swiperInstance.destroy(true, true);
  }

  swiperInstance = new Swiper('.mySwiper', {
    effect: 'coverflow',
    grabCursor: true,
    centeredSlides: true,
    slidesPerView: 'auto',
    initialSlide: 0,
    spaceBetween: 10,
    coverflowEffect: {
      rotate: 0,
      stretch: 0,
      depth: 60,
      modifier: 1.2,
      slideShadows: false,
    },
    touchRatio: 1.5,
    threshold: 2,
    observer: true,
    observeParents: true,
  });
}

// اختيار حجم المنتج
window.selectVariant = function(prodId, variantIndex) {
  const prod = allProducts.find(p => p.id == prodId);
  if (prod) {
    prod.selectedVariantIndex = variantIndex;
    const activeCat = document.querySelector('.cat-btn.active').dataset.category;
    const currentList = activeCat === "الكل" ? allProducts : allProducts.filter(p => p.category === activeCat);
    renderProducts(currentList);
  }
};

// إضافة إلى السلة
window.addToCart = function(prodId) {
  const prod = allProducts.find(p => p.id == prodId);
  if (!prod) return;

  const currentVariant = prod.variants[prod.selectedVariantIndex || 0];
  const existingIndex = cart.findIndex(item => item.id == prod.id && item.size === currentVariant.size);

  if (existingIndex > -1) {
    cart[existingIndex].qty += 1;
  } else {
    cart.push({
      id: prod.id,
      name: prod.name,
      size: currentVariant.size,
      price: currentVariant.price,
      qty: 1
    });
  }

  updateCartUI();
  showToast();
};

function updateCartUI() {
  const totalCount = cart.reduce((sum, item) => sum + item.qty, 0);
  const totalPrice = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);

  document.getElementById("cart-count").innerText = totalCount;
  document.getElementById("cart-total-display").innerText = totalPrice.toFixed(2);
  document.getElementById("drawer-total").innerText = totalPrice.toFixed(2);

  renderCartDrawer();
}

function renderCartDrawer() {
  const container = document.getElementById("cart-items-container");
  if (cart.length === 0) {
    container.innerHTML = `
      <div class="empty-cart-msg">
        <i class="fa-solid fa-basket-shopping"></i>
        <p>السلة فارغة</p>
        <small>أضف بعض الأطباق الشهية لسفرتك!</small>
      </div>
    `;
    document.getElementById("cart-footer").style.display = "none";
    return;
  }

  document.getElementById("cart-footer").style.display = "block";
  container.innerHTML = cart.map((item, idx) => `
    <div class="cart-item">
      <div>
        <div class="cart-item-title">${item.name}</div>
        <div class="cart-item-sub">${item.size !== 'عادي' ? `الحجم: ${item.size} | ` : ''}${item.price.toFixed(2)} د.أ</div>
      </div>
      <div class="qty-controls">
        <button class="qty-btn" onclick="changeQty(${idx}, -1)">-</button>
        <span>${item.qty}</span>
        <button class="qty-btn" onclick="changeQty(${idx}, 1)">+</button>
      </div>
    </div>
  `).join('');
}

window.changeQty = function(index, delta) {
  cart[index].qty += delta;
  if (cart[index].qty <= 0) {
    cart.splice(index, 1);
  }
  updateCartUI();
};

function showToast() {
  const toast = document.getElementById("toast");
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 1800);
}

// إدارة النوافذ المنبثقة
function setupEventListeners() {
  const cartModal = document.getElementById("cart-modal");
  const repModal = document.getElementById("rep-modal");

  // فتح السلة عند النقر على الشريط السفلي
  document.getElementById("bottom-cart-bar").addEventListener("click", () => {
    cartModal.classList.add("active");
  });

  document.getElementById("close-cart").addEventListener("click", () => {
    cartModal.classList.remove("active");
  });

  // الانتقال لنافذة الواتساب
  document.getElementById("proceed-checkout-btn").addEventListener("click", () => {
    if (cart.length === 0) return;
    cartModal.classList.remove("active");
    repModal.classList.add("active");
  });

  document.getElementById("close-rep").addEventListener("click", () => {
    repModal.classList.remove("active");
  });

  // إرسال الطلب للمسؤول عبر الواتساب
  document.querySelectorAll(".whatsapp-rep-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const repKey = btn.dataset.rep;
      const rep = REPS[repKey];
      sendWhatsAppOrder(rep);
    });
  });
}

function sendWhatsAppOrder(rep) {
  const totalSum = cart.reduce((sum, item) => sum + (item.price * item.qty), 0).toFixed(2);
  
  let itemsText = cart.map(item => {
    const sizeStr = item.size !== 'عادي' ? ` (${item.size})` : '';
    const itemTotal = (item.price * item.qty).toFixed(2);
    return `• ${item.name}${sizeStr} × ${item.qty} = ${itemTotal} د.أ`;
  }).join("\n");

  const message = `مرحبا ${rep.name} 👋
عندي طلب جديد من الموقع:

📋 تفاصيل الطلب:
${itemsText}

💵 المجموع الكلي: ${totalSum} د.أ
🚚 رسوم التوصيل: مجاناً`;

  const url = `https://wa.me/${rep.phone}?text=${encodeURIComponent(message)}`;
  window.open(url, '_blank');
}