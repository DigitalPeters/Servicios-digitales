// ==========================================
// MÓDULO DE PRODUCTOS Y TIENDA (products.js)
// ==========================================

async function loadProducts() {
    allProducts = await api('/api/products');
    const statProducts = document.getElementById('statProducts');
    const adminProductsCount = document.getElementById('adminProductsCount');
    if(statProducts) statProducts.textContent = allProducts.length;
    if(adminProductsCount) adminProductsCount.textContent = allProducts.length;
    buildCategoryFilter();
    renderProducts(allProducts);
}

function renderProducts(products) {
    let html = '';
    const cats = {};
    products.forEach(p => { const c = p.category || 'Otros'; (cats[c] = cats[c] || []).push(p); });
    Object.keys(cats).forEach(c => {
        html += `<div class="category-title">${safeText(c)}</div>` + cats[c].map(renderProductRow).join('');
    });
    document.getElementById('productsList').innerHTML = html || 'No hay productos.';
}

function renderProductRow(product) {
    const stockEnabled = Number(product.stock_enabled || 0) === 1;
    const stock = Number(product.stock || 0);
    const soldOut = stockEnabled && stock <= 0;
    return `<div class="product-row" data-product-id="${product.id}">
        <div class="product-header" onclick="toggleProduct(${product.id})">
            <div><div class="product-name">${safeText(product.name)}</div><span class="chip">${safeText(product.category || 'Otros')}</span></div>
            <div><div class="price">$${formatMoney(product.price)}</div>${stockEnabled ? `<div class="stock ${soldOut ? 'out' : ''}">${soldOut ? 'Sin stock' : 'Stock: ' + stock}</div>` : ''}</div>
            <div>⌄</div>
        </div>
        <div id="product-details-${product.id}" class="product-details">
            <p class="product-description">${safeText(product.description || '')}</p>
            <p class="small-text"><b>Cobro:</b> ${safeText(getChargeModeText(product.charge_mode))}</p>
            ${renderProductInputs(product)}
            <button class="primary-btn" onclick="buyProduct(${product.id})" ${soldOut ? 'disabled' : ''}>${soldOut ? 'Sin stock' : 'Comprar'}</button>
        </div>
    </div>`;
}

async function buyProduct(productId) {
    try {
        const product = allProducts.find(p => Number(p.id) === Number(productId)) || await api('/api/products').then(ps => ps.find(p => Number(p.id) === Number(productId)));
        if (!product) throw new Error('Producto no encontrado');
        if (!confirm(`Vas a comprar: ${product.name}\nCosto: $${formatMoney(product.price)}\n¿Confirmas la compra?`)) return;
        const fields = parseJsonArray(product.required_fields);
        const order_data = {};
        fields.forEach(f => {
            const input = document.getElementById(`field-${productId}-${f}`);
            if (input) order_data[f] = input.type === 'file' ? (input.files[0] ? convertFileToBase64(input.files[0]) : '') : input.value.trim();
        });
        const data = await api('/api/buy/' + productId, { method: 'POST', body: JSON.stringify({ order_data }) });
        showMessage(data.message || 'Compra realizada');
        await loadApp();
        showSection('orders');
    } catch (e) { showMessage(e.message, 'error'); }
}