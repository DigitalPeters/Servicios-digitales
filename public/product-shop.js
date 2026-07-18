let currentShopCategory = null;

async function loadProducts() {
  allProducts = await api('/api/products');
  __productsLoadedOnce = true;
  const statProductsEl = document.getElementById('statProducts');
  const adminProductsCountEl = document.getElementById('adminProductsCount');
  if (statProductsEl) statProductsEl.textContent = String(allProducts.length);
  if (adminProductsCountEl) adminProductsCountEl.textContent = String(allProducts.length);
  buildCategoryFilter();
  renderShopHome();
}

function buildCategoryFilter() {
  const sel = document.getElementById('categoryFilter');
  if (!sel) return;
  const cur = sel.value;
  const cats = [...new Set(allProducts.map((p) => p.category || 'Otros'))].sort();
  sel.innerHTML =
    '<option value="">Todas las categorías</option>' +
    cats.map((c) => `<option value="${safeText(c)}">${safeText(c)}</option>`).join('');
  sel.value = cur;
}

function renderShopHome() {
  currentShopCategory = null;
  setShopMode('categories');
  renderCategoriesOnly(allProducts);
}

function setShopMode(mode) {
  const section = document.getElementById('section-shop');
  if (!section) return;
  section.classList.remove('shop-view-categories', 'shop-view-products');
  section.classList.add(mode === 'products' ? 'shop-view-products' : 'shop-view-categories');
}

function renderCategoriesOnly(products) {
  const productsListEl = document.getElementById('productsList');
  if (!productsListEl) return;
  const byCategory = {};
  products.forEach((p) => {
    const category = p.category || 'Otros';
    (byCategory[category] = byCategory[category] || []).push(p);
  });

  const categories = Object.keys(byCategory).sort();
  productsListEl.innerHTML = `
    <div class="shop-categories-grid">
      ${categories
        .map((category) => {
          const items = byCategory[category];
          const available = items.filter((p) => Number(p.stock_enabled || 0) !== 1 || Number(p.stock || 0) > 0).length;
          return `
            <button class="shop-category-card" type="button" data-category="${safeText(category)}" onclick="openShopCategory(this.dataset.category)">
              <div class="shop-category-card-icon">▶</div>
              <div class="shop-category-card-main">
                <div class="shop-category-card-name">${safeText(category)}</div>
                <div class="shop-category-card-meta">${items.length} producto${items.length === 1 ? '' : 's'} • ${available} con stock</div>
              </div>
            </button>`;
        })
        .join('')}
    </div>`;
}

function openShopCategory(category) {
  currentShopCategory = String(category || '').trim() || null;
  setShopMode('products');
  filterProducts();
}

function backToShopCategories() {
  renderShopHome();
}

function filterProducts() {
  const term = '';
  const cat = currentShopCategory || '';
  const filtered = allProducts.filter(
    (p) =>
      (!term ||
        String(p.name).toLowerCase().includes(term) ||
        String(p.category || '').toLowerCase().includes(term)) &&
      (!cat || (p.category || 'Otros') === cat)
  );
  if (!currentShopCategory) {
    renderCategoriesOnly(filtered);
    return;
  }
  renderProducts(filtered);
}

function renderProducts(products) {
  const productsListEl = document.getElementById('productsList');
  if (!productsListEl) return;
  const title = currentShopCategory ? safeText(currentShopCategory) : 'Productos';
  productsListEl.innerHTML = `
    <section class="shop-category-block shop-products-view-block">
      <header class="shop-category-head">
        <button class="outline-btn shop-back-btn" type="button" onclick="backToShopCategories()">◀ Categorias</button>
        <h3 class="shop-category-name">${title}</h3>
        <span class="shop-category-count">${products.length} producto${products.length === 1 ? '' : 's'}</span>
      </header>
      <div class="shop-product-list">${products.map(renderProductRow).join('')}</div>
    </section>`;
}

function renderProductRow(product) {
  const stockEnabled = Number(product.stock_enabled || 0) === 1;
  const stock = Number(product.stock || 0);
  const soldOut = stockEnabled && stock <= 0;
  const stackedName = String(product.name || '').replace(/\s+/g, '<br>');

  return `<article class="shop-card product-row shop-list-item" data-product-id="${product.id}">
    <button class="shop-card-head product-header shop-list-head" type="button" onclick="openProductModal(${product.id})">
      <div class="shop-card-main">
        <div class="product-name">${stackedName || safeText(product.name)}</div>
      </div>
      <div class="shop-card-price-wrap">
        <div class="price">$${formatMoney(product.price)}</div>
        ${stockEnabled ? `<div class="stock ${soldOut ? 'out' : ''}">${soldOut ? 'Sin stock' : 'Stock: ' + stock}</div>` : '<div class="stock">Sin límite</div>'}
      </div>
      <div class="shop-expand">Ver</div>
    </button>
  </article>`;
}

function toggleProduct(id) {
  const row = document.querySelector(`.product-row[data-product-id="${id}"]`);
  if (!row) return;
  const isOpen = row.classList.contains('open');
  document.querySelectorAll('.product-row').forEach((r) => r.classList.remove('open'));
  if (!isOpen) row.classList.add('open');
}

function ensureShopProductModal() {
  if (document.getElementById('shopProductModal')) return;
  const html = `
    <div id="shopProductModal" class="modal-overlay hidden" aria-hidden="true">
      <div class="modal-card shop-product-modal-card">
        <button class="modal-close-btn" type="button" onclick="closeProductModal()" aria-label="Cerrar">×</button>
        <div id="shopProductModalBody"></div>
      </div>
    </div>`;
  document.body.insertAdjacentHTML('beforeend', html);
}

function openProductModal(productId) {
  ensureShopProductModal();
  const modal = document.getElementById('shopProductModal');
  const body = document.getElementById('shopProductModalBody');
  if (!modal || !body) return;

  const product = allProducts.find((p) => Number(p.id) === Number(productId));
  if (!product) return;

  const stockEnabled = Number(product.stock_enabled || 0) === 1;
  const stock = Number(product.stock || 0);
  const soldOut = stockEnabled && stock <= 0;

  body.innerHTML = `
    <div class="modal-head">
      <h2>${safeText(product.name || 'Producto')}</h2>
      <p class="small-text">${safeText(product.category || 'Categoria')}</p>
    </div>
    <p class="product-description">${safeText(product.description || 'Sin descripción disponible.')}</p>
    <p class="small-text"><b>Cobro:</b> ${safeText(getChargeModeText(product.charge_mode))}</p>
    <div class="shop-modal-price">$${formatMoney(product.price)}</div>
    <div class="shop-modal-stock ${soldOut ? 'out' : ''}">${stockEnabled ? (soldOut ? 'Sin stock' : 'Stock: ' + stock) : 'Sin límite'}</div>
    ${renderProductInputs(product)}
    <button class="primary-btn" onclick="buyProduct(${product.id})" ${soldOut ? 'disabled' : ''}>${soldOut ? 'Sin stock' : 'Comprar'}</button>`;

  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
}

function closeProductModal() {
  const modal = document.getElementById('shopProductModal');
  if (!modal) return;
  modal.classList.add('hidden');
  modal.setAttribute('aria-hidden', 'true');
}

function renderProductInputs(product) {
  const fields = parseJsonArray(product.required_fields);
  if (!fields.length) return `<p class="small-text">Este producto no requiere datos adicionales.</p>`;

  return fields
    .map((f) => {
      const palabra = f.toLowerCase();
      if (palabra.includes('pdf') || palabra.includes('foto') || palabra.includes('ine') || palabra.includes('archivo')) {
        return `
            <div style="margin-bottom: 10px;">
                <label class="field-label" style="color: #d84315; font-weight: bold;">${safeText(fieldLabel(f))} (Subir Archivo)</label>
                <input type="file" id="field-${product.id}-${f}" accept=".pdf, image/*" style="width: 100%; font-size: 13px;" />
            </div>`;
      }
      return `
            <div style="margin-bottom: 10px;">
                <label class="field-label">${safeText(fieldLabel(f))}</label>
                <input id="field-${product.id}-${f}" placeholder="Ingresa ${safeText(fieldLabel(f))}" style="width: 100%;" />
            </div>`;
    })
    .join('');
}

async function buyProduct(productId) {
  try {
    const product =
      allProducts.find((p) => Number(p.id) === Number(productId)) ||
      (await api('/api/products').then((ps) => ps.find((p) => Number(p.id) === Number(productId))));

    if (!product) throw new Error('Producto no encontrado');

    if (!confirm(`Vas a comprar: ${product.name}\nCosto: $${formatMoney(product.price)}\n¿Confirmas la compra?`)) return;

    const fields = parseJsonArray(product.required_fields);
    const order_data = {};

    fields.forEach((f) => {
      const input = document.getElementById(`field-${productId}-${f}`);
      order_data[f] = input ? input.value.trim() : '';
    });

    let attached_document = null;
    const fileInput = document.getElementById(`file-${productId}`);

    if (fileInput && fileInput.files.length > 0) {
      const file = fileInput.files[0];
      if (file.size > 5 * 1024 * 1024) {
        throw new Error('El PDF es muy pesado. Máximo 5 MB.');
      }
      attached_document = await convertFileToBase64(file);
    }

    const data = await api('/api/buy/' + productId, {
      method: 'POST',
      body: JSON.stringify({
        order_data,
        attached_document
      })
    });

    closeProductModal();
    showMessage(data.message || 'Compra realizada');

    const hasImmediateDelivery = Boolean(data?.delivered_account_data && data?.immediate_delivery !== false);
    if (hasImmediateDelivery && typeof window.openModalEntregaInmediata === 'function') {
      window.openModalEntregaInmediata({
        ...data,
        product_name: data.product_name || product.name
      });
    } else {
      showSection('orders');
    }

    loadMyOrders().catch((e) => console.warn('Error recargando pedidos:', e));
    if (allProducts.length) {
      loadProducts().catch((e) => console.warn('Error recargando productos:', e));
    }
  } catch (e) {
    showMessage(e.message, 'error');
  }
}

function convertFileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = (error) => reject(error);
  });
}

window.openShopCategory = openShopCategory;
window.backToShopCategories = backToShopCategories;
window.toggleProduct = toggleProduct;
window.openProductModal = openProductModal;
window.closeProductModal = closeProductModal;
window.renderShopHome = renderShopHome;
