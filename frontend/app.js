/* ============================================================
   SHOPWAVE — FRONTEND APP LOGIC (connects to real backend API)
   Backend must be running: cd backend && npm install && npm start
============================================================ */

// ---------- CONFIG ----------
const API = (window.SHOPWAVE_API_BASE) || 'https://shopwave-fullstack.onrender.com/api';
const CATEGORY_ICONS = { Electronics: "💻", Fashion: "👗", "Beauty & Personal Care": "💄", "Home & Kitchen": "🍳", Grocery: "🛒", "Sports & Fitness": "🏋️", Automotive: "🚗", Books: "📚", "Toys & Baby": "🧸", "Pet Supplies": "🐶" };
const TRANSLATIONS = { en: { signin: "Sign in" }, hi: { signin: "साइन इन" } };
const FX = { USD: 1, INR: 83.2 }; const SYM = { USD: '$', INR: '₹' };

// ---------- LOCAL (client-only convenience) STORAGE ----------
const DB = { get(k, f) { try { const v = JSON.parse(localStorage.getItem(k)); return v === null ? f : v; } catch { return f; } }, set(k, v) { localStorage.setItem(k, JSON.stringify(v)); } };
let cart = DB.get('sw_cart', []);
let savedForLater = DB.get('sw_saved', []);
let wishlist = DB.get('sw_wishlist', []);
let compareList = DB.get('sw_compare', []);
let recentlyViewed = DB.get('sw_recent', []);
let notifications = DB.get('sw_notifs', [
  { t: 'Welcome to ShopWave!', d: 'Explore AI-curated picks made for you.', read: false },
  { t: 'Flash Sale Live ⚡', d: 'Up to 40% off Electronics — ends soon.', read: false }
]);
let theme = DB.get('sw_theme', 'dark');
let currency = DB.get('sw_currency', 'INR');
let lang = DB.get('sw_lang', 'en');
let notifyList = DB.get('sw_notify_stock', []);

// ---------- AUTH STATE (real backend JWT) ----------
let authToken = localStorage.getItem('sw_token') || null;
let currentUser = DB.get('sw_current_user', null); // { id, name, email, role, points, referral, addresses }

// ---------- APP STATE ----------
let categories = [];
let productCache = {};      // id -> product (populated as fetched)
let gridProducts = [];      // current page's rendered products
let activeCategory = 'all', currentPage = 1, totalPages = 1, PAGE_SIZE = 12;
let selectedColor = '', selectedSize = '', detailQty = 1, currentProductId = null, selectedRating = 0;
let selectedPayMethod = 'card', selectedAddrId = null, appliedDiscountPct = 0, drawerTab = 'cart';
let pendingReviewImg = null;

function saveLocal() {
  DB.set('sw_cart', cart); DB.set('sw_saved', savedForLater); DB.set('sw_wishlist', wishlist);
  DB.set('sw_compare', compareList); DB.set('sw_recent', recentlyViewed); DB.set('sw_notifs', notifications);
  DB.set('sw_theme', theme); DB.set('sw_currency', currency); DB.set('sw_lang', lang); DB.set('sw_notify_stock', notifyList);
  DB.set('sw_current_user', currentUser);
}
function fmt(usd) { return SYM[currency] + (usd * FX[currency]).toFixed(currency === 'INR' ? 0 : 2); }

// ---------- API HELPER ----------
async function api(path, { method = 'GET', body, auth = false } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth && authToken) headers['Authorization'] = 'Bearer ' + authToken;
  try {
    const res = await fetch(API + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  } catch (err) {
    if (err.message === 'Failed to fetch') {
      showBackendOfflineBanner();
      throw new Error('Cannot reach the backend server. Is it running on http://localhost:5000 ?');
    }
    throw err;
  }
}
let offlineBannerShown = false;
function showBackendOfflineBanner() {
  if (offlineBannerShown) return; offlineBannerShown = true;
  const bar = document.createElement('div');
  bar.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;background:#ef4444;color:#fff;text-align:center;padding:10px;font-size:.85rem;font-weight:600';
  bar.innerHTML = '⚠️ Backend not reachable at ' + API + ' — run <code>cd backend && npm install && npm start</code>, then reload this page.';
  document.body.prepend(bar);
}

// ---------- TOAST ----------
function showToast(msg, type = 'success') {
  const stack = document.getElementById('toast-stack');
  const t = document.createElement('div'); t.className = 'glass toast' + (type === 'error' ? ' error' : '');
  t.innerHTML = `<i class="fas ${type === 'error' ? 'fa-circle-xmark' : 'fa-circle-check'}"></i> ${msg}`;
  stack.appendChild(t); requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 350); }, 2800);
}

// ---------- THEME / CURRENCY / LANG ----------
function toggleTheme() { theme = theme === 'dark' ? 'light' : 'dark'; document.documentElement.setAttribute('data-theme', theme); document.getElementById('theme-icon').className = 'fas fa-' + (theme === 'dark' ? 'moon' : 'sun'); saveLocal(); }
function changeCurrency() { currency = document.getElementById('currency-select').value; saveLocal(); renderProducts(true); if (currentProductId) renderProductDetail(currentProductId); }
function changeLang() { lang = document.getElementById('lang-select').value; saveLocal(); refreshAccountUI(); showToast(lang === 'hi' ? 'भाषा बदल दी गई' : 'Language updated'); }

// ---------- PAGE ROUTER ----------
function goPage(page) {
  document.querySelectorAll('[id^="page-"]').forEach(el => el.classList.add('hidden'));
  const target = document.getElementById('page-' + page); if (target) target.classList.remove('hidden');
  document.querySelectorAll('.nav-link').forEach(a => a.classList.toggle('active', a.dataset.page === page));
  closeAllOverlays(); window.scrollTo({ top: 0, behavior: 'instant' });
  if (page === 'home') { currentPage = 1; renderProducts(true); renderRecentlyViewed(); renderBestSellers(); }
  if (page === 'wishlist') renderWishlistPage();
  if (page === 'compare') renderComparePage();
  if (page === 'orders') requireAuth(() => renderOrdersPage());
  if (page === 'checkout') requireAuth(() => renderCheckout());
  if (page === 'dashboard') requireAuth(() => { if (currentUser.role === 'admin') { goPage('admin'); return; } dashTab('overview'); });
  if (page === 'admin') requireAuth(() => { if (currentUser.role !== 'admin') { showToast('Admin access only', 'error'); goPage('home'); return; } adminTab('dashboard'); });
  if (page === 'home') maybeShowSpinWheel();
}
function requireAuth(cb) { if (!currentUser || !authToken) { showToast('Please sign in to continue', 'error'); goPage('auth'); return; } cb(); }

// ---------- CATEGORIES ----------
async function loadCategories() {
  try { categories = await api('/categories'); } catch { categories = []; }
  renderCategories();
}
function renderCategories() {
  const all = ['all', ...categories];
  document.getElementById('categories-grid').innerHTML = all.map(c => `<div class="glass cat-card ${activeCategory === c ? 'active' : ''}" onclick="setCategory('${c}')"><span class="cat-icon">${c === 'all' ? '🛍️' : CATEGORY_ICONS[c] || '📦'}</span><div class="cat-name">${c === 'all' ? 'All' : c}</div></div>`).join('');
  document.getElementById('filter-chips').innerHTML = all.map(c => `<button class="filter-btn ${activeCategory === c ? 'active' : ''}" onclick="setCategory('${c}')">${c === 'all' ? 'All' : c}</button>`).join('');
}
function setCategory(c) { activeCategory = c; renderCategories(); if (c === 'all') { renderProducts(true); return; } openCategoryPage(c); }
async function openCategoryPage(cat) {
  goPage('category');
  document.getElementById('category-banner-icon').textContent = CATEGORY_ICONS[cat] || '📦';
  document.getElementById('category-banner-title').textContent = cat;
  const grid = document.getElementById('category-products-grid');
  showSkeletons('category-products-grid', 8);
  let activeSub = 'all';
  try {
    const subs = await api('/products/meta/subcategories?category=' + encodeURIComponent(cat));
    const subWrap = document.getElementById('category-subfilter');
    const renderSubChips = () => {
      subWrap.innerHTML = ['all', ...subs].map(s => `<button class="filter-btn ${activeSub === s ? 'active' : ''}" onclick="filterCategorySub('${cat}','${s}')">${s === 'all' ? 'All' : s}</button>`).join('');
    };
    window._catSubs = subs; window._catActiveSub = 'all'; window._renderSubChips = renderSubChips;
    renderSubChips();
  } catch { document.getElementById('category-subfilter').innerHTML = ''; }
  try {
    const data = await api('/products?category=' + encodeURIComponent(cat) + '&limit=40');
    document.getElementById('category-banner-count').textContent = data.total + ' products in this category';
    grid.innerHTML = data.products.length ? data.products.map(productCard).join('') : `<div class="empty-state"><i class="fas fa-box-open"></i><h3>No products in this category yet</h3></div>`;
  } catch { grid.innerHTML = `<div class="empty-state"><i class="fas fa-plug-circle-xmark"></i><h3>Can't load products</h3></div>`; }
}
async function filterCategorySub(cat, sub) {
  window._catActiveSub = sub;
  if (window._renderSubChips) { document.querySelectorAll('#category-subfilter .filter-btn').forEach(b => b.classList.remove('active')); window._renderSubChips(); }
  const grid = document.getElementById('category-products-grid');
  showSkeletons('category-products-grid', 8);
  const params = new URLSearchParams({ category: cat, limit: 40 });
  if (sub !== 'all') params.set('subcategory', sub);
  try {
    const data = await api('/products?' + params.toString());
    document.getElementById('category-banner-count').textContent = data.total + ' products in this category';
    grid.innerHTML = data.products.length ? data.products.map(productCard).join('') : `<div class="empty-state"><i class="fas fa-box-open"></i><h3>No products found</h3></div>`;
  } catch { grid.innerHTML = `<div class="empty-state"><i class="fas fa-plug-circle-xmark"></i><h3>Can't load products</h3></div>`; }
}

// ---------- PRODUCTS ----------
function starString(r) { const f = Math.floor(r), h = r % 1 >= 0.3; return '★'.repeat(f) + (h ? '½' : '') + '☆'.repeat(Math.max(0, 5 - f - (h ? 1 : 0))); }
function hasPurchased(pid) { return false; /* resolved async per-product on detail page via API */ }
function productCard(p) {
  productCache[p.id] = p;
  const discount = p.originalPrice ? Math.round((1 - p.price / p.originalPrice) * 100) : 0;
  const inWish = wishlist.includes(p.id), inCompare = compareList.includes(p.id), outOfStock = p.stock === 0;
  const eta = new Date(Date.now() + 3 * 86400000).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return `
  <article class="glass product-card">
    <div class="product-img-wrap" onclick="openProduct(${p.id})">
      ${p.badge ? `<span class="product-badge ${p.badge}">${p.badgeText}</span>` : ''}
      ${outOfStock ? '<span class="stock-tag out">Out of stock</span>' : p.stock <= 5 ? `<span class="stock-tag low">Only ${p.stock} left</span>` : ''}
      <div class="card-icon-row">
        <button class="icon-btn ${inWish ? 'active' : ''}" onclick="event.stopPropagation();toggleWishlist(${p.id})" title="Wishlist"><i class="fa${inWish ? 's' : 'r'} fa-heart"></i></button>
        <button class="icon-btn ${inCompare ? 'active' : ''}" onclick="event.stopPropagation();toggleCompare(${p.id})" title="Compare"><i class="fas fa-code-compare"></i></button>
      </div>
      ${p.photo ? `<img src="${p.photo}" alt="${p.name}" loading="lazy" style="width:100%;height:100%;object-fit:cover" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" /><span style="display:none;width:100%;height:100%;align-items:center;justify-content:center;font-size:4rem">${p.emoji}</span>` : p.emoji}
    </div>
    <div class="product-info">
      <div class="product-category">${p.category}${p.brand && p.brand !== p.category ? ' · ' + p.brand : ''}</div>
      <h3 class="product-name" onclick="openProduct(${p.id})">${p.name}</h3>
      <div class="product-rating"><span class="stars">${starString(p.rating)}</span><span class="rating-count">(${p.reviews.toLocaleString()})</span></div>
      <div class="delivery-est">🚚 Delivery by ${eta}</div>
      <div class="product-price-row">
        <div><span class="price-current">${fmt(p.price)}</span>${p.originalPrice ? `<span class="price-original">${fmt(p.originalPrice)}</span>` : ''}</div>
        ${outOfStock ? `<button class="notify-btn ${notifyList.includes(p.id) ? 'active' : ''}" onclick="event.stopPropagation();toggleNotifyStock(${p.id})">${notifyList.includes(p.id) ? '✓ Notified' : 'Notify Me'}</button>`
      : `<button class="add-to-cart-btn" onclick="quickAdd(${p.id},this)"><i class="fas fa-cart-plus"></i> Add</button>`}
      </div>
    </div>
  </article>`;
}
function showSkeletons(gridId, count) {
  const grid = document.getElementById(gridId); if (!grid) return;
  grid.innerHTML = Array(count).fill(0).map(() => `<div class="skel-card"><div class="skel-box skel-img"></div><div class="skel-box skel-line"></div><div class="skel-box skel-line short"></div></div>`).join('');
}
async function renderProducts(reset) {
  if (reset) currentPage = 1;
  const grid = document.getElementById('products-grid');
  if (reset) showSkeletons('products-grid', 8);
  const q = (document.getElementById('search-input').value || '').trim();
  const sort = document.getElementById('sort-select')?.value || 'default';
  const instock = document.getElementById('filter-instock')?.checked ? 'true' : '';
  const maxPrice = document.getElementById('price-range')?.value;
  const params = new URLSearchParams({ page: currentPage, limit: PAGE_SIZE });
  if (activeCategory !== 'all') params.set('category', activeCategory);
  if (q) params.set('search', q);
  if (sort !== 'default') params.set('sort', sort);
  if (instock) params.set('instock', instock);
  if (maxPrice && maxPrice < 1000) params.set('maxPrice', maxPrice);

  let data;
  try { data = await api('/products?' + params.toString()); }
  catch { grid.innerHTML = `<div class="empty-state"><i class="fas fa-plug-circle-xmark"></i><h3>Can't load products</h3><p>Make sure the backend server is running</p></div>`; return; }

  totalPages = data.totalPages;
  document.getElementById('results-count').textContent = `${data.total} product${data.total !== 1 ? 's' : ''} found`;
  if (!data.products.length) { grid.innerHTML = `<div class="empty-state"><i class="fas fa-magnifying-glass"></i><h3>No products found</h3><p>Try a different search or filter</p></div>`; return; }

  if (reset) { gridProducts = data.products; grid.innerHTML = gridProducts.map(productCard).join('') + sentinelHtml(); }
  else { gridProducts = gridProducts.concat(data.products); grid.innerHTML = gridProducts.map(productCard).join('') + sentinelHtml(); }
  observeSentinel();
}
function sentinelHtml() { return currentPage < totalPages ? `<div class="load-sentinel" id="load-sentinel">Loading more products...</div>` : ''; }
let io;
function observeSentinel() {
  const el = document.getElementById('load-sentinel'); if (!el) return;
  if (io) io.disconnect();
  io = new IntersectionObserver(entries => { if (entries[0].isIntersecting && currentPage < totalPages) { currentPage++; renderProducts(false); } }, { threshold: 0.3 });
  io.observe(el);
}
function quickAdd(id, btn) { addToCart(id, 1, '', ''); if (btn) { btn.classList.add('added'); btn.innerHTML = '<i class="fas fa-check"></i> Added'; setTimeout(() => { btn.classList.remove('added'); btn.innerHTML = '<i class="fas fa-cart-plus"></i> Add'; }, 1300); } }
function toggleNotifyStock(id) { if (notifyList.includes(id)) { notifyList = notifyList.filter(x => x !== id); } else { notifyList.push(id); showToast("We'll email you when it's back in stock 🔔"); } saveLocal(); renderProducts(true); }

// ---------- WISHLIST (client-side convenience) ----------
function toggleWishlist(id) {
  if (wishlist.includes(id)) { wishlist = wishlist.filter(w => w !== id); showToast('Removed from wishlist'); }
  else { wishlist.push(id); showToast('Added to wishlist ❤️'); }
  saveLocal(); updateBadges(); renderProducts(true);
  if (!document.getElementById('page-product').classList.contains('hidden')) renderProductDetail(currentProductId);
  if (!document.getElementById('page-wishlist').classList.contains('hidden')) renderWishlistPage();
}
async function renderWishlistPage() {
  const grid = document.getElementById('wishlist-grid');
  if (!wishlist.length) { grid.innerHTML = `<div class="empty-state"><i class="fas fa-heart-crack"></i><h3>Your wishlist is empty</h3><p>Tap the heart icon on any product to save it here</p></div>`; return; }
  showSkeletons('wishlist-grid', wishlist.length);
  const items = await Promise.all(wishlist.map(id => productCache[id] ? Promise.resolve(productCache[id]) : api('/products/' + id).catch(() => null)));
  const valid = items.filter(Boolean);
  grid.innerHTML = valid.length ? valid.map(productCard).join('') : `<div class="empty-state"><i class="fas fa-heart-crack"></i><h3>Your wishlist is empty</h3></div>`;
}

// ---------- COMPARE ----------
function toggleCompare(id) {
  if (compareList.includes(id)) { compareList = compareList.filter(c => c !== id); }
  else { if (compareList.length >= 4) { showToast('You can compare up to 4 products', 'error'); return; } compareList.push(id); }
  saveLocal(); renderProducts(true);
  if (!document.getElementById('page-compare').classList.contains('hidden')) renderComparePage();
}
function clearCompare() { compareList = []; saveLocal(); renderComparePage(); renderProducts(true); }
async function renderComparePage() {
  const wrap = document.getElementById('compare-wrap');
  if (!compareList.length) { wrap.innerHTML = `<div class="empty-state"><i class="fas fa-code-compare"></i><h3>No products to compare</h3><p>Tap the compare icon on any product card to add it here (max 4)</p></div>`; return; }
  const items = (await Promise.all(compareList.map(id => productCache[id] ? Promise.resolve(productCache[id]) : api('/products/' + id).catch(() => null)))).filter(Boolean);
  const rows = [['Image', items.map(p => `<div style="font-size:2.2rem">${p.emoji}</div>`)], ['Name', items.map(p => p.name)], ['Price', items.map(p => fmt(p.price))], ['Rating', items.map(p => starString(p.rating) + ' (' + p.reviews + ')')], ['Category', items.map(p => p.category)], ['Stock', items.map(p => p.stock > 0 ? p.stock + ' available' : 'Out of stock')], ['Action', items.map(p => `<button class="mini-btn primary" onclick="addToCart(${p.id},1,'','')">Add to Cart</button> <button class="mini-btn danger" onclick="toggleCompare(${p.id})">Remove</button>`)]];
  wrap.innerHTML = `<table class="compare-table">${rows.map(r => `<tr><th>${r[0]}</th>${r[1].map(v => `<td>${v}</td>`).join('')}</tr>`).join('')}</table>`;
}

// ---------- RECENTLY VIEWED ----------
function trackRecentlyViewed(id) { recentlyViewed = recentlyViewed.filter(x => x !== id); recentlyViewed.unshift(id); recentlyViewed = recentlyViewed.slice(0, 10); saveLocal(); }
async function renderRecentlyViewed() {
  const sec = document.getElementById('rv-section');
  if (!recentlyViewed.length) { sec.style.display = 'none'; return; }
  sec.style.display = 'block';
  const items = (await Promise.all(recentlyViewed.map(id => productCache[id] ? Promise.resolve(productCache[id]) : api('/products/' + id).catch(() => null)))).filter(Boolean);
  document.getElementById('recently-viewed').innerHTML = items.map(p => `<div class="glass mini-card" onclick="openProduct(${p.id})"><div class="e">${p.emoji}</div><div class="n">${p.name}</div><div class="p">${fmt(p.price)}</div></div>`).join('');
}

// ---------- CART (client-side, synced to backend only at checkout) ----------
function addToCart(id, qty = 1, size = '', color = '') {
  const p = productCache[id]; if (!p || p.stock === 0) return;
  const existing = cart.find(i => i.id === id && i.size === size && i.color === color);
  if (existing) existing.qty += qty; else cart.push({ id: p.id, name: p.name, price: p.price, emoji: p.emoji, category: p.category, qty, size: size || p.sizes[0] || '', color });
  saveLocal(); updateBadges(); renderDrawer(); showToast(`${p.name} added to cart 🛒`);
}
function changeQty(id, size, color, delta) {
  const item = cart.find(i => i.id === id && i.size === size && i.color === color); if (!item) return;
  item.qty += delta; if (item.qty <= 0) cart = cart.filter(i => !(i.id === id && i.size === size && i.color === color));
  saveLocal(); updateBadges(); renderDrawer();
}
function removeCartItem(id, size, color) { cart = cart.filter(i => !(i.id === id && i.size === size && i.color === color)); saveLocal(); updateBadges(); renderDrawer(); showToast('Item removed', 'error'); }
function saveForLater(id, size, color) {
  const item = cart.find(i => i.id === id && i.size === size && i.color === color); if (!item) return;
  savedForLater.push(item); cart = cart.filter(i => !(i.id === id && i.size === size && i.color === color));
  saveLocal(); updateBadges(); renderDrawer(); showToast('Moved to Saved for Later');
}
function moveToCart(idx) { const item = savedForLater[idx]; if (!item) return; cart.push(item); savedForLater.splice(idx, 1); saveLocal(); updateBadges(); renderDrawer(); showToast('Moved to cart'); }
function removeSaved(idx) { savedForLater.splice(idx, 1); saveLocal(); renderDrawer(); }
function cartSubtotal() { return cart.reduce((s, i) => s + i.price * i.qty, 0); }
function cartCount() { return cart.reduce((s, i) => s + i.qty, 0); }
function updateBadges() {
  const cc = cartCount(), wc = wishlist.length, nc = notifications.filter(n => !n.read).length;
  const ce = document.getElementById('cart-count'), we = document.getElementById('wishlist-count'), ne = document.getElementById('notif-count');
  ce.textContent = cc; ce.style.display = cc > 0 ? 'flex' : 'none';
  we.textContent = wc; we.style.display = wc > 0 ? 'flex' : 'none';
  ne.textContent = nc; ne.style.display = nc > 0 ? 'flex' : 'none';
}
function switchDrawerTab(t) { drawerTab = t; document.getElementById('tab-cart-btn').classList.toggle('active', t === 'cart'); document.getElementById('tab-saved-btn').classList.toggle('active', t === 'saved'); document.getElementById('drawer-foot').style.display = t === 'cart' ? 'block' : 'none'; renderDrawer(); }
function renderDrawer() {
  const wrap = document.getElementById('drawer-items');
  if (drawerTab === 'cart') {
    if (!cart.length) { wrap.innerHTML = `<div class="empty-state"><i class="fas fa-bag-shopping"></i><h3>Your cart is empty</h3><p>Add products to see them here</p></div>`; document.getElementById('drawer-subtotal').textContent = fmt(0); return; }
    wrap.innerHTML = cart.map(i => `
      <div class="cart-item">
        <div class="cart-item-img">${i.emoji}</div>
        <div>
          <div class="cart-item-name">${i.name}</div>
          <div class="cart-item-meta">${i.category}${i.size ? ' · ' + i.size : ''}</div>
          <div class="qty-control-sm"><button onclick="changeQty(${i.id},'${i.size}','${i.color}',-1)">−</button><span>${i.qty}</span><button onclick="changeQty(${i.id},'${i.size}','${i.color}',1)">+</button></div>
        </div>
        <div class="cart-item-actions">
          <div class="item-total">${fmt(i.price * i.qty)}</div>
          <button class="mini-link" onclick="saveForLater(${i.id},'${i.size}','${i.color}')">Save for later</button>
          <button class="mini-link danger" onclick="removeCartItem(${i.id},'${i.size}','${i.color}')">Remove</button>
        </div>
      </div>`).join('');
    document.getElementById('drawer-subtotal').textContent = fmt(cartSubtotal());
  } else {
    wrap.innerHTML = savedForLater.length ? savedForLater.map((i, idx) => `
      <div class="cart-item">
        <div class="cart-item-img">${i.emoji}</div>
        <div><div class="cart-item-name">${i.name}</div><div class="cart-item-meta">${i.category}${i.size ? ' · ' + i.size : ''}</div></div>
        <div class="cart-item-actions"><div class="item-total">${fmt(i.price * i.qty)}</div><button class="mini-link" onclick="moveToCart(${idx})">Move to cart</button><button class="mini-link danger" onclick="removeSaved(${idx})">Remove</button></div>
      </div>`).join('') : `<div class="empty-state"><i class="fas fa-bookmark"></i><h3>Nothing saved</h3><p>Items you save for later appear here</p></div>`;
  }
}
function openCart() { drawerTab = 'cart'; renderDrawer(); document.getElementById('cart-drawer').classList.add('open'); document.getElementById('overlay').classList.add('open'); }
function closeCart() { document.getElementById('cart-drawer').classList.remove('open'); document.getElementById('overlay').classList.remove('open'); }
function closeAllOverlays() { closeCart(); closeQuickModal(); document.getElementById('notif-dropdown')?.classList.remove('show'); }
function goToCheckout() { if (!cart.length) { showToast('Your cart is empty', 'error'); return; } closeCart(); goPage('checkout'); }

// ---------- PRODUCT DETAIL ----------
function openProduct(id) { currentProductId = id; trackRecentlyViewed(id); goPage('product'); renderProductDetail(id); }
async function renderProductDetail(id) {
  let p = productCache[id];
  if (!p) { try { p = await api('/products/' + id); productCache[id] = p; } catch { showToast('Product not found', 'error'); goPage('home'); return; } }
  selectedColor = p.colors[0] || ''; selectedSize = p.sizes[0] || ''; detailQty = 1;
  document.getElementById('detail-breadcrumb').textContent = p.name;
  document.getElementById('main-product-img').innerHTML = p.photo ? `<img src="${p.photo}" alt="${p.name}" style="width:100%;height:100%;object-fit:cover;border-radius:inherit" />` : p.images[0];
  const thumbSources = p.photo ? [p.photo, ...p.images] : p.images;
  document.getElementById('thumb-row').innerHTML = thumbSources.map((img, i) => {
    const isPhoto = img.startsWith('http');
    return `<div class="glass thumb ${i === 0 ? 'active' : ''}" onclick='switchThumb(this,${JSON.stringify(img)})'>${isPhoto ? `<img src="${img}" style="width:100%;height:100%;object-fit:cover;border-radius:inherit" />` : img}</div>`;
  }).join('');
  document.getElementById('inline-zoom-panel').classList.add('hidden');
  document.getElementById('detail-category').textContent = p.category;
  document.getElementById('detail-title').textContent = p.name;
  document.getElementById('detail-stars').textContent = starString(p.rating);
  document.getElementById('detail-rating-score').textContent = `${p.rating} (${p.reviews.toLocaleString()} reviews)`;
  document.getElementById('detail-price').textContent = fmt(p.price);
  document.getElementById('detail-original').textContent = p.originalPrice ? fmt(p.originalPrice) : '';
  const discount = p.originalPrice ? Math.round((1 - p.price / p.originalPrice) * 100) : 0;
  document.getElementById('detail-discount').textContent = discount > 0 ? discount + '% OFF' : '';
  document.getElementById('detail-desc').textContent = p.description;
  document.getElementById('detail-delivery').textContent = '🚚 Estimated delivery: ' + new Date(Date.now() + 3 * 86400000).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  document.getElementById('color-options').innerHTML = p.colors.map((c, i) => `<div class="color-dot ${i === 0 ? 'active' : ''}" style="background:${c}" onclick="pickColor(this,'${c}')"></div>`).join('');
  document.getElementById('size-options').innerHTML = p.sizes.map((s, i) => `<button class="glass size-btn ${i === 0 ? 'active' : ''}" onclick="pickSize(this,'${s}')">${s}</button>`).join('');
  document.getElementById('qty-display').textContent = 1;
  document.getElementById('detail-tags').innerHTML = '<span style="color:var(--muted);font-weight:600;font-size:.76rem">Tags:</span>' + p.tags.map(t => `<span class="tag">#${t}</span>`).join('');
  const wishBtn = document.getElementById('detail-wish-btn'); wishBtn.classList.toggle('active', wishlist.includes(p.id)); wishBtn.onclick = () => toggleWishlist(p.id);
  const cmpBtn = document.getElementById('detail-compare-btn'); cmpBtn.classList.toggle('active', compareList.includes(p.id)); cmpBtn.onclick = () => toggleCompare(p.id);
  const addBtn = document.getElementById('detail-add-btn'); addBtn.disabled = p.stock === 0;
  addBtn.innerHTML = p.stock === 0 ? 'Out of Stock' : '<i class="fas fa-bag-shopping"></i> Add to Cart';
  addBtn.onclick = () => { addToCart(p.id, detailQty, selectedSize, selectedColor); };
  renderReviews(id);
  try {
    const relatedData = await api(`/products?category=${encodeURIComponent(p.category)}&limit=5`);
    const related = relatedData.products.filter(x => x.id !== p.id).slice(0, 4);
    document.getElementById('related-grid').innerHTML = related.map(productCard).join('');
    const fbtData = await api(`/products?limit=3&page=${Math.floor(Math.random() * 5) + 1}`);
    document.getElementById('fbt-grid').innerHTML = fbtData.products.filter(x => x.id !== p.id).slice(0, 3).map(productCard).join('');
  } catch {}
}
function switchThumb(el, img) {
  document.querySelectorAll('.thumb').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  const isPhoto = typeof img === 'string' && img.startsWith('http');
  document.getElementById('main-product-img').innerHTML = isPhoto ? `<img src="${img}" style="width:100%;height:100%;object-fit:cover;border-radius:inherit" />` : img;
  const panel = document.getElementById('inline-zoom-panel');
  panel.innerHTML = isPhoto ? `<img src="${img}" style="width:100%;border-radius:14px" />` : `<div style="font-size:8rem;text-align:center;padding:30px 0">${img}</div>`;
  panel.classList.remove('hidden');
}
function pickColor(el, c) { document.querySelectorAll('.color-dot').forEach(d => d.classList.remove('active')); el.classList.add('active'); selectedColor = c; }
function pickSize(el, s) { document.querySelectorAll('.size-btn').forEach(d => d.classList.remove('active')); el.classList.add('active'); selectedSize = s; }
document.getElementById('qty-plus').addEventListener('click', () => { detailQty = Math.min(detailQty + 1, 99); document.getElementById('qty-display').textContent = detailQty; });
document.getElementById('qty-minus').addEventListener('click', () => { detailQty = Math.max(detailQty - 1, 1); document.getElementById('qty-display').textContent = detailQty; });

// ---------- REVIEWS (real backend) ----------
document.getElementById('star-input').addEventListener('click', e => { const v = e.target.dataset.v; if (!v) return; selectedRating = +v; document.querySelectorAll('#star-input i').forEach(i => i.classList.toggle('on', +i.dataset.v <= selectedRating)); });
document.getElementById('review-img').addEventListener('change', e => { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => { pendingReviewImg = r.result; }; r.readAsDataURL(f); });
async function renderReviews(pid) {
  const base = productCache[pid];
  let list = [];
  try { list = await api(`/products/${pid}/reviews`); } catch {}
  const totalReviews = list.length + base.reviews;
  const avg = list.length ? ((list.reduce((s, r) => s + r.rating, 0) + base.rating * base.reviews) / totalReviews) : base.rating;
  document.getElementById('rev-avg').textContent = avg.toFixed(1);
  document.getElementById('rev-stars').textContent = starString(avg);
  document.getElementById('rev-count').textContent = `Based on ${totalReviews.toLocaleString()} reviews`;
  document.getElementById('reviews-list').innerHTML = list.length ? list.slice().reverse().map(r => `
    <div class="glass review-card">
      <div class="review-head"><span class="review-name">${r.name}${r.verified ? ' <span class="verified-badge">✓ Verified Buyer</span>' : ''}</span><span class="review-date">${r.date}</span></div>
      <div class="stars" style="margin-bottom:6px">${starString(r.rating)}</div>
      <p style="font-size:.83rem;color:var(--muted)">${r.text}</p>
      ${r.img ? `<img class="review-img-thumb" src="${r.img}" />` : ''}
    </div>`).join('') : `<p style="color:var(--muted);font-size:.83rem">No customer reviews yet. Be the first to write one!</p>`;
  selectedRating = 0; document.querySelectorAll('#star-input i').forEach(i => i.classList.remove('on'));
}
async function submitReview(e) {
  e.preventDefault();
  if (!currentUser || !authToken) { showToast('Please sign in to write a review', 'error'); goPage('auth'); return; }
  if (selectedRating === 0) { showToast('Please select a star rating', 'error'); return; }
  const text = document.getElementById('review-text').value.trim();
  try {
    await api(`/products/${currentProductId}/reviews`, { method: 'POST', auth: true, body: { rating: selectedRating, text, img: pendingReviewImg } });
    pendingReviewImg = null; document.getElementById('review-img').value = '';
    document.getElementById('review-name').value = ''; document.getElementById('review-text').value = '';
    showToast('Review submitted — thank you! ⭐'); renderReviews(currentProductId);
  } catch (err) { showToast(err.message, 'error'); }
}

// ---------- AUTH (real backend JWT) ----------
function toggleAuthMode() { document.getElementById('login-box').classList.toggle('hidden'); document.getElementById('signup-box').classList.toggle('hidden'); }
function socialLogin(provider) { showToast(`${provider} OAuth needs real client-id/secret setup server-side — this demo button is a placeholder.`, 'error'); }
async function handleSignup(e) {
  e.preventDefault();
  const name = document.getElementById('signup-name').value.trim();
  const email = document.getElementById('signup-email').value.trim();
  const password = document.getElementById('signup-password').value;
  const referral = document.getElementById('signup-ref').value.trim();
  try {
    const data = await api('/auth/register', { method: 'POST', body: { name, email, password, referral } });
    authToken = data.token; currentUser = data.user;
    localStorage.setItem('sw_token', authToken); saveLocal();
    refreshAccountUI(); showToast(`Welcome to ShopWave, ${name.split(' ')[0]}! 🎉`); goPage('home');
  } catch (err) { showToast(err.message, 'error'); }
}
async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  try {
    const data = await api('/auth/login', { method: 'POST', body: { email, password } });
    authToken = data.token; currentUser = data.user;
    localStorage.setItem('sw_token', authToken); saveLocal();
    await loadCartFromBackend();
    refreshAccountUI(); showToast(`Welcome back, ${data.user.name.split(' ')[0]}!`);
    goPage(currentUser.role === 'admin' ? 'admin' : 'home');
  } catch (err) { showToast(err.message, 'error'); }
}
function logout() { authToken = null; currentUser = null; localStorage.removeItem('sw_token'); saveLocal(); refreshAccountUI(); showToast('Logged out'); goPage('home'); }
function handleAccountClick() { if (!currentUser) { goPage('auth'); return; } goPage(currentUser.role === 'admin' ? 'admin' : 'dashboard'); }
function refreshAccountUI() { document.getElementById('account-label').textContent = currentUser ? currentUser.name.split(' ')[0] : TRANSLATIONS[lang].signin; }
async function refreshCurrentUser() { if (!authToken) return; try { currentUser = await api('/auth/me', { auth: true }); saveLocal(); } catch { logout(); } }

// ---------- ADDRESS BOOK (real backend) ----------
function openAddAddress() {
  document.getElementById('quick-modal-body').innerHTML = `
    <button class="modal-close" onclick="closeQuickModal()">&times;</button>
    <h3 class="detail-sec-title" style="margin-bottom:14px">Add New Address</h3>
    <form id="addr-form">
      <input class="form-input" placeholder="Full Name" id="addr-name" required />
      <input class="form-input" placeholder="Phone Number" id="addr-phone" required />
      <input class="form-input" placeholder="Address Line" id="addr-line" required />
      <div class="form-row-2"><input class="form-input" placeholder="City" id="addr-city" required /><input class="form-input" placeholder="PIN Code" id="addr-pin" required /></div>
      <button type="submit" class="btn-full">Save Address</button>
    </form>`;
  document.getElementById('addr-form').addEventListener('submit', async e => {
    e.preventDefault();
    try {
      const addr = await api('/auth/addresses', { method: 'POST', auth: true, body: { name: document.getElementById('addr-name').value, phone: document.getElementById('addr-phone').value, line: document.getElementById('addr-line').value, city: document.getElementById('addr-city').value, pin: document.getElementById('addr-pin').value } });
      currentUser.addresses.push(addr); saveLocal(); closeQuickModal(); showToast('Address saved'); renderCheckout();
    } catch (err) { showToast(err.message, 'error'); }
  });
  document.getElementById('quick-modal').classList.add('active');
}
function closeQuickModal() { document.getElementById('quick-modal').classList.remove('active'); }
async function deleteAddress(id) {
  try { await api('/auth/addresses/' + id, { method: 'DELETE', auth: true }); currentUser.addresses = currentUser.addresses.filter(a => a.id !== id); saveLocal(); renderCheckout(); if (!document.getElementById('page-dashboard').classList.contains('hidden')) dashTab('addresses'); }
  catch (err) { showToast(err.message, 'error'); }
}

// ---------- CHECKOUT / ORDERS (real backend) ----------
function selectPay(el) { document.querySelectorAll('.pay-option').forEach(o => o.classList.remove('selected')); el.classList.add('selected'); selectedPayMethod = el.dataset.pay; }
async function applyPromo() {
  const code = document.getElementById('checkout-promo').value.trim();
  try { const c = await api('/coupons/apply', { method: 'POST', body: { code } }); appliedDiscountPct = c.pct; showToast(`Coupon applied — ${c.pct}% off! 🎉`); }
  catch (err) { appliedDiscountPct = 0; showToast(err.message, 'error'); }
  renderCheckout();
}
function renderCheckout() {
  if (!cart.length) { showToast('Your cart is empty', 'error'); goPage('home'); return; }
  document.getElementById('checkout-addr-list').innerHTML = currentUser.addresses.length ? currentUser.addresses.map(a => `
    <div class="glass addr-option ${selectedAddrId === a.id ? 'selected' : ''}" onclick="selectAddress(${a.id})">
      <input type="radio" name="addr" ${selectedAddrId === a.id ? 'checked' : ''} />
      <div><strong>${a.name}</strong> — ${a.phone}<br/><span style="color:var(--muted)">${a.line}, ${a.city} - ${a.pin}</span></div>
    </div>`).join('') : `<p style="font-size:.82rem;color:var(--muted)">No saved addresses yet. Add one below.</p>`;
  if (!selectedAddrId && currentUser.addresses.length) selectedAddrId = currentUser.addresses[0].id;
  document.getElementById('checkout-items').innerHTML = cart.map(i => `<div style="display:flex;justify-content:space-between;font-size:.82rem;margin-bottom:9px;color:var(--muted)"><span>${i.emoji} ${i.name} × ${i.qty}</span><span style="color:var(--text);font-weight:600">${fmt(i.price * i.qty)}</span></div>`).join('');
  const subtotal = cartSubtotal(), shipping = subtotal > 100 ? 0 : 9.99, giftwrap = document.getElementById('giftwrap-check')?.checked ? 4.99 : 0;
  const discount = subtotal * (appliedDiscountPct / 100), tax = (subtotal - discount) * 0.05, total = subtotal + shipping + giftwrap - discount + tax;
  document.getElementById('co-subtotal').textContent = fmt(subtotal);
  document.getElementById('co-shipping').textContent = shipping === 0 ? 'FREE' : fmt(shipping);
  document.getElementById('co-giftwrap').textContent = fmt(giftwrap);
  document.getElementById('co-discount').textContent = '-' + fmt(discount);
  document.getElementById('co-tax').textContent = fmt(tax);
  document.getElementById('co-total').textContent = fmt(total);
  document.getElementById('co-points').textContent = (currentUser.points || 0) + ' pts';
}
function selectAddress(id) { selectedAddrId = id; renderCheckout(); }
async function placeOrder() {
  if (!currentUser.addresses.length) { showToast('Please add a delivery address', 'error'); return; }
  const address = currentUser.addresses.find(a => a.id === selectedAddrId) || currentUser.addresses[0];
  const giftwrap = document.getElementById('giftwrap-check')?.checked || false;
  try {
    const order = await api('/orders', { method: 'POST', auth: true, body: { items: cart, address, payMethod: selectedPayMethod, giftwrap, discountPct: appliedDiscountPct } });
    notifications.unshift({ t: 'Order placed 🎉', d: `Order #${order.id} confirmed — arriving soon.`, read: false });
    cart = []; appliedDiscountPct = 0; saveLocal(); updateBadges();
    await refreshCurrentUser();
    showToast('🎉 Order placed successfully!');
    goPage('orders');
  } catch (err) { showToast(err.message, 'error'); }
}
async function renderOrdersPage() {
  const wrap = document.getElementById('orders-list');
  let mine = [];
  try { mine = await api('/orders', { auth: true }); } catch (err) { wrap.innerHTML = `<div class="empty-state"><i class="fas fa-plug-circle-xmark"></i><h3>Can't load orders</h3></div>`; return; }
  wrap.innerHTML = mine.length ? mine.map(o => {
    const stepIdx = { processing: 1, shipped: 2, delivered: 3 }[o.status] || 1;
    return `
    <div class="glass order-card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <div><strong>Order #${o.id}</strong><div style="font-size:.75rem;color:var(--muted)">${o.date}</div></div>
        <span class="order-status ${o.status}">${o.status}</span>
      </div>
      <div class="order-timeline">${[1, 2, 3].map(i => `<div class="tl-dot ${i <= stepIdx ? 'done' : ''}"></div>`).join('')}</div>
      <div style="font-size:.82rem;color:var(--muted);margin-bottom:10px">${o.items.map(i => i.name + ' ×' + i.qty).join(', ')}${o.giftwrap ? ' · 🎁 Gift wrapped' : ''}</div>
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
        <span style="font-weight:700">Deliver to: ${o.address?.city || '-'}</span>
        <div style="display:flex;gap:8px;align-items:center">
          <span style="font-weight:800">${fmt(o.total)}</span>
          <button class="mini-btn" onclick="downloadInvoice('${o.id}')"><i class="fas fa-file-pdf"></i> Invoice</button>
          <button class="mini-btn" onclick="showQR('${o.id}')"><i class="fas fa-qrcode"></i> Track QR</button>
          ${o.status !== 'delivered' && o.status !== 'cancelled' ? `<button class="mini-btn danger" onclick="cancelOrder('${o.id}')">Cancel</button>` : ''}
        </div>
      </div>
    </div>`;
  }).join('') : `<div class="empty-state"><i class="fas fa-box-open"></i><h3>No orders yet</h3><p>Your placed orders will show up here</p></div>`;
}
async function cancelOrder(id) { try { await api(`/orders/${id}/cancel`, { method: 'PUT', auth: true }); showToast('Order cancelled'); renderOrdersPage(); } catch (err) { showToast(err.message, 'error'); } }
function downloadInvoice(id) {
  api(`/orders/${id}`, { auth: true }).then(o => {
    if (!window.jspdf) { showToast('PDF library not loaded', 'error'); return; }
    const { jsPDF } = window.jspdf; const doc = new jsPDF();
    doc.setFontSize(18); doc.text('ShopWave — Invoice', 14, 20);
    doc.setFontSize(10); doc.text('Order #' + o.id, 14, 30); doc.text('Date: ' + o.date, 14, 36); doc.text('Deliver to: ' + (o.address?.name || '') + ', ' + (o.address?.city || ''), 14, 42);
    let y = 56; doc.setFontSize(11); doc.text('Item', 14, y); doc.text('Qty', 120, y); doc.text('Price', 150, y); y += 6; doc.line(14, y - 4, 196, y - 4);
    o.items.forEach(i => { doc.text(i.name.slice(0, 40), 14, y); doc.text(String(i.qty), 120, y); doc.text(fmt(i.price * i.qty), 150, y); y += 7; });
    y += 6; doc.setFontSize(13); doc.text('Total: ' + fmt(o.total), 14, y);
    doc.save('invoice-' + o.id + '.pdf'); showToast('Invoice downloaded 📄');
  }).catch(err => showToast(err.message, 'error'));
}
function showQR(id) {
  document.getElementById('quick-modal-body').innerHTML = `<button class="modal-close" onclick="closeQuickModal()">&times;</button><h3 class="detail-sec-title" style="margin-bottom:14px;text-align:center">Track Order #${id}</h3><div id="qr-holder" style="display:flex;justify-content:center"></div><p style="text-align:center;font-size:.78rem;color:var(--muted);margin-top:12px">Scan to view live tracking (demo)</p>`;
  document.getElementById('quick-modal').classList.add('active');
  setTimeout(() => { if (window.QRCode) { new QRCode(document.getElementById('qr-holder'), { text: 'shopwave-order:' + id, width: 160, height: 160 }); } }, 50);
}

// ---------- USER DASHBOARD ----------
function dashTab(tab, btn) {
  document.querySelectorAll('#page-dashboard .dash-nav button').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active'); else document.querySelector('#page-dashboard .dash-nav button').classList.add('active');
  const content = document.getElementById('dash-content');
  if (tab === 'overview') {
    api('/orders', { auth: true }).then(mine => {
      content.innerHTML = `
        <h3 class="detail-sec-title" style="margin-bottom:16px">Account Overview</h3>
        <div class="stats-row">
          <div class="glass stat-box"><div class="n">${mine.length}</div><div class="l">Orders</div></div>
          <div class="glass stat-box"><div class="n">${wishlist.length}</div><div class="l">Wishlist</div></div>
          <div class="glass stat-box"><div class="n">${fmt(mine.reduce((s, o) => s + o.total, 0))}</div><div class="l">Total Spent</div></div>
          <div class="glass stat-box"><div class="n">${currentUser.points || 0}</div><div class="l">Loyalty Points</div></div>
        </div>
        <p style="color:var(--muted);font-size:.88rem">Welcome back, <strong style="color:var(--text)">${currentUser.name}</strong>. Manage your orders, addresses, and rewards from here.</p>`;
    });
  } else if (tab === 'profile') {
    content.innerHTML = `<h3 class="detail-sec-title" style="margin-bottom:16px">Profile Details</h3>
      <label class="form-label">Full Name</label><input class="form-input" value="${currentUser.name}" disabled />
      <label class="form-label">Email</label><input class="form-input" value="${currentUser.email}" disabled />
      <p style="font-size:.76rem;color:var(--muted)">Profile editing is not wired up yet — add a PUT /api/auth/me endpoint to enable it.</p>`;
  } else if (tab === 'addresses') {
    content.innerHTML = `<h3 class="detail-sec-title" style="margin-bottom:16px">Address Book</h3>
      ${currentUser.addresses.length ? currentUser.addresses.map(a => `<div class="glass addr-option" style="cursor:default"><i class="fas fa-location-dot" style="color:var(--accent2)"></i><div style="flex:1"><strong>${a.name}</strong> — ${a.phone}<br/><span style="color:var(--muted)">${a.line}, ${a.city} - ${a.pin}</span></div><button class="mini-btn danger" onclick="deleteAddress(${a.id})">Delete</button></div>`).join('') : '<p style="font-size:.82rem;color:var(--muted)">No addresses saved yet.</p>'}
      <button class="btn-ghost glass" onclick="openAddAddress()" style="margin-top:8px"><i class="fas fa-plus"></i> Add address</button>`;
  } else if (tab === 'loyalty') {
    content.innerHTML = `<h3 class="detail-sec-title" style="margin-bottom:16px">Loyalty & Referral</h3>
      <div class="loyalty-box"><div class="loyalty-pts">${currentUser.points || 0} pts</div><div style="color:var(--muted);font-size:.8rem;margin-top:4px">≈ ${fmt((currentUser.points || 0) * 0.01)} in rewards</div></div>
      <p style="font-size:.82rem;color:var(--muted);margin-top:16px">Share your referral code — friends get bonus points, you earn 100 pts per signup.</p>
      <div class="referral-code"><input class="form-input" value="${currentUser.referral}" readonly style="margin-bottom:0" /><button class="btn-ghost glass" onclick="copyReferral('${currentUser.referral}')">Copy</button></div>`;
  } else if (tab === 'notifications') {
    content.innerHTML = `<h3 class="detail-sec-title" style="margin-bottom:16px">Notification Preferences</h3>
      ${['Order updates', 'Delivery updates', 'Offers & promotions', 'Wishlist price-drop alerts', 'Back-in-stock alerts'].map(n => `<div style="display:flex;justify-content:space-between;align-items:center;padding:11px 0;border-bottom:1px solid var(--glass-border);font-size:.84rem"><span>${n}</span><input type="checkbox" checked /></div>`).join('')}
      <p style="font-size:.72rem;color:var(--muted);margin-top:12px">Demo toggles — connect real email/SMS providers server-side to make these functional.</p>`;
  }
}
function copyReferral(code) { navigator.clipboard?.writeText(code); showToast('Referral code copied!'); }

// ---------- ADMIN PANEL (real backend) ----------
function adminTab(tab, btn) {
  document.querySelectorAll('#page-admin .dash-nav button').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active'); else document.querySelector('#page-admin .dash-nav button').classList.add('active');
  const content = document.getElementById('admin-content');
  if (tab === 'dashboard') {
    api('/admin/stats', { auth: true }).then(s => {
      const max = Math.max(...s.weeklySales.map(d => d.total), 1);
      content.innerHTML = `
        <h3 class="detail-sec-title" style="margin-bottom:16px">Revenue Dashboard</h3>
        <div class="stats-row">
          <div class="glass stat-box"><div class="n">${fmt(s.revenue)}</div><div class="l">Total Revenue</div></div>
          <div class="glass stat-box"><div class="n">${s.totalOrders}</div><div class="l">Total Orders</div></div>
          <div class="glass stat-box"><div class="n">${s.totalUsers}</div><div class="l">Registered Users</div></div>
          <div class="glass stat-box"><div class="n">${s.lowStockCount}</div><div class="l">Low Stock Items</div></div>
        </div>
        <div class="glass" style="padding:20px">
          <div class="detail-sec-title" style="margin-bottom:6px">Last 7 Days Sales</div>
          <div class="chart-bars">${s.weeklySales.map(d => `<div class="chart-bar" style="height:${Math.max(4, (d.total / max) * 130)}px"><span>${d.total > 0 ? fmt(d.total) : ''}</span></div>`).join('')}</div>
          <div class="chart-labels">${s.weeklySales.map(d => `<div>${d.label}</div>`).join('')}</div>
        </div>`;
    }).catch(err => content.innerHTML = `<p style="color:var(--danger)">${err.message}</p>`);
  } else if (tab === 'products') {
    content.innerHTML = `<h3 class="detail-sec-title" style="margin-bottom:12px">Product Management (400 total)</h3>
      <input class="form-input" id="admin-product-search" placeholder="Search products to edit..." oninput="adminSearchProducts()" />
      <div id="admin-products-table"><p style="font-size:.8rem;color:var(--muted)">Search for a product above to edit its price/stock.</p></div>`;
  } else if (tab === 'orders') {
    api('/admin/orders', { auth: true }).then(list => {
      content.innerHTML = `<h3 class="detail-sec-title" style="margin-bottom:16px">All Orders</h3>
        <table class="admin-table"><tr><th>Order ID</th><th>Customer</th><th>Total</th><th>Status</th><th>Update</th></tr>
        ${list.map(o => `<tr><td>${o.id}</td><td>${o.userEmail}</td><td>${fmt(o.total)}</td><td><span class="order-status ${o.status}">${o.status}</span></td><td>
          <select class="pill-select" onchange="updateOrderStatus('${o.id}',this.value)">
            <option value="processing" ${o.status === 'processing' ? 'selected' : ''}>Processing</option>
            <option value="shipped" ${o.status === 'shipped' ? 'selected' : ''}>Shipped</option>
            <option value="delivered" ${o.status === 'delivered' ? 'selected' : ''}>Delivered</option>
          </select></td></tr>`).join('') || '<tr><td colspan="5" style="color:var(--muted)">No orders yet</td></tr>'}
        </table>`;
    });
  } else if (tab === 'users') {
    api('/admin/users', { auth: true }).then(list => {
      content.innerHTML = `<h3 class="detail-sec-title" style="margin-bottom:16px">Registered Users</h3>
        <table class="admin-table"><tr><th>Name</th><th>Email</th><th>Role</th><th>Points</th></tr>
        ${list.map(u => `<tr><td>${u.name}</td><td>${u.email}</td><td>${u.role || 'user'}</td><td>${u.points || 0}</td></tr>`).join('')}
        </table>`;
    });
  } else if (tab === 'coupons') {
    api('/coupons').then(list => {
      content.innerHTML = `<h3 class="detail-sec-title" style="margin-bottom:16px">Coupon Management</h3>
        <table class="admin-table"><tr><th>Code</th><th>Discount</th><th>Action</th></tr>
        ${list.map(c => `<tr><td>${c.code}</td><td>${c.pct}%</td><td><button class="mini-btn danger" onclick="deleteCoupon('${c.code}')">Delete</button></td></tr>`).join('')}
        </table>
        <div style="display:flex;gap:8px;margin-top:14px">
          <input class="form-input" placeholder="CODE" id="new-coupon-code" style="margin-bottom:0" />
          <input class="form-input" type="number" placeholder="%" id="new-coupon-pct" style="margin-bottom:0;width:90px" />
          <button class="btn-ghost glass" onclick="addCoupon()">Add</button>
        </div>`;
    });
  }
}
let adminSearchTimer;
function adminSearchProducts() {
  clearTimeout(adminSearchTimer);
  adminSearchTimer = setTimeout(async () => {
    const q = document.getElementById('admin-product-search').value.trim();
    const table = document.getElementById('admin-products-table');
    if (!q) { table.innerHTML = `<p style="font-size:.8rem;color:var(--muted)">Search for a product above to edit its price/stock.</p>`; return; }
    const data = await api('/products?search=' + encodeURIComponent(q) + '&limit=10');
    table.innerHTML = `<table class="admin-table"><tr><th>Product</th><th>Category</th><th>Price</th><th>Stock</th><th>Action</th></tr>
      ${data.products.map(p => `<tr><td>${p.emoji} ${p.name}</td><td>${p.category}</td><td><input type="number" step="0.01" value="${p.price}" id="price-${p.id}" /></td><td><input type="number" value="${p.stock}" id="stock-${p.id}" /></td><td><button class="mini-btn primary" onclick="saveProductEdit(${p.id})">Save</button></td></tr>`).join('')}
      </table>`;
  }, 350);
}
async function saveProductEdit(id) {
  const price = parseFloat(document.getElementById('price-' + id).value), stock = parseInt(document.getElementById('stock-' + id).value);
  try { const updated = await api('/products/' + id, { method: 'PUT', auth: true, body: { price, stock } }); productCache[id] = updated; showToast('Product updated'); }
  catch (err) { showToast(err.message, 'error'); }
}
async function updateOrderStatus(id, status) { try { await api(`/orders/${id}/status`, { method: 'PUT', auth: true, body: { status } }); showToast('Order status updated'); } catch (err) { showToast(err.message, 'error'); } }
async function addCoupon() {
  const code = document.getElementById('new-coupon-code').value.trim(), pct = parseInt(document.getElementById('new-coupon-pct').value);
  if (!code || !pct) return;
  try { await api('/coupons', { method: 'POST', auth: true, body: { code, pct } }); adminTab('coupons'); showToast('Coupon added'); }
  catch (err) { showToast(err.message, 'error'); }
}
async function deleteCoupon(code) { try { await api('/coupons/' + code, { method: 'DELETE', auth: true }); adminTab('coupons'); } catch (err) { showToast(err.message, 'error'); } }

// ---------- NOTIFICATIONS ----------
function toggleNotif() {
  const dd = document.getElementById('notif-dropdown');
  dd.classList.toggle('show');
  if (dd.classList.contains('show')) {
    dd.innerHTML = notifications.length ? notifications.map(n => `<div class="notif-item"><div class="t">${n.t}</div><div class="d">${n.d}</div></div>`).join('') : '<div class="notif-item">No notifications</div>';
    notifications.forEach(n => n.read = true); saveLocal(); updateBadges();
  }
}
document.addEventListener('click', e => { if (!e.target.closest('.notif-wrap')) document.getElementById('notif-dropdown')?.classList.remove('show'); });

// ---------- FLASH SALE TIMER ----------
let flashEnd = Date.now() + 3 * 3600 * 1000 + 24 * 60000;
function tickFlash() {
  const diff = Math.max(0, flashEnd - Date.now());
  const h = Math.floor(diff / 3600000), m = Math.floor((diff % 3600000) / 60000), s = Math.floor((diff % 60000) / 1000);
  document.getElementById('ft-h').textContent = String(h).padStart(2, '0');
  document.getElementById('ft-m').textContent = String(m).padStart(2, '0');
  document.getElementById('ft-s').textContent = String(s).padStart(2, '0');
}
setInterval(tickFlash, 1000); tickFlash();

// ---------- NEWSLETTER ----------
function handleNewsletter(e) { e.preventDefault(); showToast('Subscribed! Check your inbox for 15% off 🎉'); document.getElementById('nl-email').value = ''; }

// ---------- SEARCH + VOICE + SUGGESTIONS ----------
const searchInput = document.getElementById('search-input');
let searchDebounce;
searchInput.addEventListener('input', () => {
  clearTimeout(searchDebounce);
  const q = searchInput.value.toLowerCase().trim();
  const box = document.getElementById('search-suggest');
  if (!q) { box.classList.remove('show'); if (!document.getElementById('page-home').classList.contains('hidden')) renderProducts(true); return; }
  searchDebounce = setTimeout(async () => {
    try {
      const data = await api('/products?search=' + encodeURIComponent(q) + '&limit=6');
      box.innerHTML = data.products.length ? data.products.map(p => `<div class="suggest-item" onclick="selectSuggest(${p.id})">${p.emoji} ${p.name} <span style="margin-left:auto;color:var(--accent2)">${fmt(p.price)}</span></div>`).join('') : '<div class="suggest-item">No matches</div>';
      box.classList.add('show');
    } catch {}
    if (!document.getElementById('page-home').classList.contains('hidden')) renderProducts(true);
  }, 300);
});
searchInput.addEventListener('keydown', e => { if (e.key === 'Enter') { document.getElementById('search-suggest').classList.remove('show'); goPage('home'); renderProducts(true); } });
function selectSuggest(id) { document.getElementById('search-suggest').classList.remove('show'); openProduct(id); }
document.addEventListener('click', e => { if (!e.target.closest('.nav-search')) document.getElementById('search-suggest').classList.remove('show'); });

const micBtn = document.getElementById('mic-btn');
let recognition = null;
if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SR(); recognition.lang = 'en-US'; recognition.continuous = false;
  recognition.onresult = e => { const text = e.results[0][0].transcript; searchInput.value = text; searchInput.dispatchEvent(new Event('input')); goPage('home'); };
  recognition.onend = () => micBtn.classList.remove('listening');
  micBtn.addEventListener('click', () => { micBtn.classList.add('listening'); recognition.start(); });
} else { micBtn.style.display = 'none'; }

// ---------- CHATBOT (rule-based) ----------
const CHAT_QUICK = ['Track my order', 'Return policy', 'Shipping info', 'Talk to a human'];
function toggleChat() {
  const win = document.getElementById('chatbot-win');
  win.classList.toggle('open');
  if (win.classList.contains('open') && !document.getElementById('chat-body').dataset.init) {
    addChatMsg('bot', "Hi! I'm the ShopWave AI Assistant 🤖 — ask me about orders, returns, shipping, or products.");
    document.getElementById('chat-quick').innerHTML = CHAT_QUICK.map(q => `<button onclick="quickChat('${q}')">${q}</button>`).join('');
    document.getElementById('chat-body').dataset.init = '1';
  }
}
function quickChat(q) { document.getElementById('chat-input').value = q; sendChat(); }
function addChatMsg(who, text) { const body = document.getElementById('chat-body'); const el = document.createElement('div'); el.className = 'chat-msg ' + who; el.textContent = text; body.appendChild(el); body.scrollTop = body.scrollHeight; }
async function botReply(msg) {
  const m = msg.toLowerCase();
  if (m.includes('track') || m.includes('order')) {
    if (!currentUser) return "Sign in first and I can look up your latest order status!";
    try { const list = await api('/orders', { auth: true }); return list.length ? `Your latest order #${list[0].id} is currently "${list[0].status}". Check the Orders page for full tracking.` : "You don't have any orders yet — once you place one, I can track it for you!"; } catch { return "Couldn't reach the order service right now."; }
  }
  if (m.includes('return')) return "We offer 30-day free returns on all items — just go to My Orders and click Cancel/Return on the eligible order.";
  if (m.includes('shipping') || m.includes('delivery')) return "Standard delivery takes 3-5 days. Orders above " + fmt(100) + " get FREE shipping!";
  if (m.includes('human') || m.includes('agent')) return "Connecting you to a human agent isn't available in this demo — but our support team is reachable at hello@shopwave.in in the real app.";
  if (m.includes('discount') || m.includes('coupon') || m.includes('promo')) return "Try code WELCOME for 15% off, or SHOPWAVE for 20% off orders over " + fmt(200) + "!";
  if (m.includes('hi') || m.includes('hello')) return "Hey there! 👋 How can I help with your shopping today?";
  return "I'm a simple demo bot right now — for real AI answers you'd connect this to an LLM API (like Claude) on a backend. Try asking about orders, returns, or shipping!";
}
function sendChat() {
  const input = document.getElementById('chat-input'); const text = input.value.trim(); if (!text) return;
  addChatMsg('user', text); input.value = '';
  botReply(text).then(reply => setTimeout(() => addChatMsg('bot', reply), 400));
}
document.getElementById('chat-input').addEventListener('keydown', e => { if (e.key === 'Enter') sendChat(); });

// ---------- BEST SELLERS ----------
async function renderBestSellers() {
  const grid = document.getElementById('bestsellers-grid'); if (!grid) return;
  showSkeletons('bestsellers-grid', 4);
  try {
    const data = await api('/products?sort=rating&limit=4');
    grid.innerHTML = data.products.map(productCard).join('');
  } catch { grid.innerHTML = ''; }
}

// ---------- IMAGE ZOOM LIGHTBOX ----------
function openZoom() {
  const p = productCache[currentProductId]; if (!p) return;
  document.getElementById('zoom-content').innerHTML = p.photo ? `<img src="${p.photo}" style="max-width:90vw;max-height:85vh;border-radius:16px" />` : p.images[0];
  document.getElementById('zoom-modal').classList.add('active');
}
function closeZoom() { document.getElementById('zoom-modal').classList.remove('active'); }

// ---------- WHATSAPP SHARE ----------
function shareOnWhatsApp() {
  const p = productCache[currentProductId]; if (!p) return;
  const text = encodeURIComponent(`Check out ${p.name} on ShopWave — ${fmt(p.price)}! ${window.location.href}`);
  window.open(`https://wa.me/?text=${text}`, '_blank');
}
document.addEventListener('DOMContentLoaded', () => {
  const shareBtn = document.getElementById('detail-share-btn');
  if (shareBtn) shareBtn.addEventListener('click', shareOnWhatsApp);
});

// ---------- SPIN THE WHEEL ----------
const WHEEL_PRIZES = [
  { pct: 5, deg: 30 }, { pct: 10, deg: 90 }, { pct: 15, deg: 150 },
  { pct: 20, deg: 210 }, { pct: 25, deg: 270 }, { pct: 30, deg: 330 }
];
function maybeShowSpinWheel() {
  if (DB.get('sw_spin_shown', false)) return;
  setTimeout(() => { document.getElementById('spin-modal').classList.add('active'); }, 1500);
}
function closeSpinWheel(won) {
  document.getElementById('spin-modal').classList.remove('active');
  DB.set('sw_spin_shown', true);
}
let spinning = false;
async function spinWheel() {
  if (spinning) return; spinning = true;
  const btn = document.getElementById('spin-btn'); btn.disabled = true; btn.textContent = 'Spinning...';
  const prize = WHEEL_PRIZES[Math.floor(Math.random() * WHEEL_PRIZES.length)];
  const spins = 5 * 360;
  const finalRotation = spins + (360 - prize.deg);
  document.getElementById('wheel').style.transform = `rotate(${finalRotation}deg)`;
  setTimeout(async () => {
    const code = 'SPIN' + prize.pct;
    try { await api('/coupons', { method: 'POST', body: { code, pct: prize.pct } }); } catch { /* coupon may already exist or need admin auth — fallback still shown to user */ }
    btn.textContent = `🎉 You won ${prize.pct}% OFF!`;
    showToast(`Coupon code "${code}" unlocked — use it at checkout! 🎉`);
    DB.set('sw_spin_shown', true);
    setTimeout(() => closeSpinWheel(true), 2500);
  }, 4200);
}

// ---------- FORGOT / RESET PASSWORD ----------
function openForgotPassword() {
  document.getElementById('quick-modal-body').innerHTML = `
    <button class="modal-close" onclick="closeQuickModal()">&times;</button>
    <h3 class="detail-sec-title" style="margin-bottom:6px">Reset your password</h3>
    <p style="font-size:.78rem;color:var(--muted);margin-bottom:16px">Enter your account email. This demo has no real email service, so your reset code will be shown right here instead of being emailed.</p>
    <form id="forgot-form">
      <input class="form-input" type="email" id="forgot-email" placeholder="Your account email" required />
      <button type="submit" class="btn-full">Send Reset Code</button>
    </form>
    <div id="forgot-step2" class="hidden" style="margin-top:16px">
      <div class="glass" style="padding:12px;border-radius:10px;margin-bottom:14px;text-align:center">
        <div style="font-size:.72rem;color:var(--muted);margin-bottom:4px">Your demo reset code</div>
        <div style="font-family:var(--font-head);font-size:1.4rem;font-weight:800;color:var(--accent2)" id="forgot-code-display"></div>
      </div>
      <form id="reset-form">
        <input class="form-input" id="reset-code" placeholder="Enter the code above" required />
        <input class="form-input" type="password" id="reset-newpass" placeholder="New password" minlength="4" required />
        <button type="submit" class="btn-full">Reset Password</button>
      </form>
    </div>`;
  document.getElementById('forgot-form').addEventListener('submit', async e => {
    e.preventDefault();
    const email = document.getElementById('forgot-email').value.trim();
    try {
      const data = await api('/auth/forgot-password', { method: 'POST', body: { email } });
      document.getElementById('forgot-code-display').textContent = data.demoCode;
      document.getElementById('forgot-step2').classList.remove('hidden');
      document.getElementById('reset-form').addEventListener('submit', async ev => {
        ev.preventDefault();
        try {
          await api('/auth/reset-password', { method: 'POST', body: { email, code: document.getElementById('reset-code').value.trim(), newPassword: document.getElementById('reset-newpass').value } });
          showToast('Password reset! Please log in with your new password.');
          closeQuickModal();
        } catch (err) { showToast(err.message, 'error'); }
      });
    } catch (err) { showToast(err.message, 'error'); }
  });
  document.getElementById('quick-modal').classList.add('active');
}

// ---------- CART BACKEND SYNC (logged-in users only) ----------
async function syncCartToBackend() {
  if (!authToken) return;
  try { await api('/cart', { method: 'PUT', auth: true, body: { items: cart } }); } catch { /* fails silently if offline; localStorage remains source of truth */ }
}
async function loadCartFromBackend() {
  if (!authToken) return;
  try {
    const serverCart = await api('/cart', { auth: true });
    if (serverCart && serverCart.length && !cart.length) { cart = serverCart; saveLocal(); updateBadges(); renderDrawer(); }
    else if (cart.length) { await syncCartToBackend(); }
  } catch { /* backend cart sync is best-effort */ }
}
const _origSaveLocal = saveLocal;
saveLocal = function () { _origSaveLocal(); syncCartToBackend(); };

// ---------- 404 HANDLING FOR MISSING PRODUCTS ----------
const _origRenderProductDetail = renderProductDetail;
renderProductDetail = async function (id) {
  try { await _origRenderProductDetail(id); }
  catch { goPage('notfound'); }
};


async function init() {
  document.documentElement.setAttribute('data-theme', theme);
  document.getElementById('theme-icon').className = 'fas fa-' + (theme === 'dark' ? 'moon' : 'sun');
  document.getElementById('currency-select').value = currency;
  document.getElementById('lang-select').value = lang;
  updateBadges(); refreshAccountUI();
  await loadCategories();
  if (authToken) { await refreshCurrentUser(); await loadCartFromBackend(); }
  goPage('home');
}
init();