async function loadProducts() {
  allProducts = await api('/api/products');
  statProducts.textContent = allProducts.length;
  adminProductsCount.textContent = allProducts.length;
  buildCategoryFilter();
  renderProducts(allProducts);
}

function buildCategoryFilter() {
  const sel = categoryFilter;
  const cur = sel.value;
  const cats = [...new Set(allProducts.map((p) => p.category || 'Otros'))].sort();
  sel.innerHTML =
    '<option value="">Todas las categorías</option>' +
    cats.map((c) => `<option value="${safeText(c)}">${safeText(c)}</option>`).join('');
  sel.value = cur;
}

function filterProducts() {
  const term = (productSearch?.value || globalSearch?.value || '').toLowerCase();
  const cat = categoryFilter?.value || '';
  const filtered = allProducts.filter(
    (p) =>
      (!term ||
        String(p.name).toLowerCase().includes(term) ||
        String(p.category || '').toLowerCase().includes(term)) &&
      (!cat || (p.category || 'Otros') === cat)
  );
  renderProducts(filtered);
}

function renderProducts(products) {
  let html = '';
  const cats = {};
  products.forEach((p) => {
    const c = p.category || 'Otros';
    (cats[c] = cats[c] || []).push(p);
  });
  Object.keys(cats)
    .sort()
    .forEach((c) => {
      const items = cats[c];
      html += `
      <section class="shop-category-block">
        <header class="shop-category-head">
          <h3 class="shop-category-name">${safeText(c)}</h3>
          <span class="shop-category-count">${items.length} producto${items.length === 1 ? '' : 's'}</span>
        </header>
        <div class="shop-grid">${items.map(renderProductRow).join('')}</div>
      </section>`;
    });
  productsList.innerHTML = html || 'No hay productos.';
}

function renderProductRow(product) {
  const stockEnabled = Number(product.stock_enabled || 0) === 1;
  const stock = Number(product.stock || 0);
  const soldOut = stockEnabled && stock <= 0;

    return `<article class="shop-card product-row" data-product-id="${product.id}">
      <button class="shop-card-head product-header" type="button" onclick="toggleProduct(${product.id})">
            <div class="shop-card-main">
                <div class="product-name">${safeText(product.name)}</div>
        </div>
        <div class="shop-card-price-wrap">
          <div class="price">$${formatMoney(product.price)}</div>
          ${stockEnabled ? `<div class="stock ${soldOut ? 'out' : ''}">${soldOut ? 'Sin stock' : 'Stock: ' + stock}</div>` : '<div class="stock">Sin límite</div>'}
        </div>
            <div class="shop-expand">⌄</div>
      </button>
      <div id="product-details-${product.id}" class="product-details shop-card-details">
        <p class="product-description">${safeText(product.description || '')}</p>
        <p class="small-text"><b>Cobro:</b> ${safeText(getChargeModeText(product.charge_mode))}</p>
        ${renderProductInputs(product)}
        <button class="primary-btn" onclick="buyProduct(${product.id})" ${soldOut ? 'disabled' : ''}>${soldOut ? 'Sin stock' : 'Comprar'}</button>
      </div>
    </article>`;
}

function toggleProduct(id) {
  const row = document.querySelector(`.product-row[data-product-id="${id}"]`);
  if (!row) return;
  const open = row.classList.contains('open');
  document.querySelectorAll('.product-row').forEach((r) => r.classList.remove('open'));
  if (!open) row.classList.add('open');
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

    showMessage(data.message || 'Compra realizada');
    if (data.delivered_account_data) openModalEntregaInmediata(data.delivered_account_data);
    showSection('orders');
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
