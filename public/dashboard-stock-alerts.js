// Indicador de productos sin stock para dashboard/admin
function isProductOutOfStock(product){
  return Number(product?.stock_enabled || 0) === 1 && Number(product?.stock || 0) <= 0;
}

function getOutOfStockProducts(){
  return (allProducts || []).filter(isProductOutOfStock);
}

function updateOutOfStockStats(){
  const count = getOutOfStockProducts().length;
  const isAdmin = typeof isAdminUserSafe === 'function' ? isAdminUserSafe() : String(currentUser?.role || '').toLowerCase() === 'admin';
  const setText = (id, value) => {
    const el = document.getElementById(id);
    if(el) el.textContent = value;
  };
  const setVisible = (id, visible) => {
    const el = document.getElementById(id);
    if(el) el.classList.toggle('hidden', !visible);
  };

  setText('statOutOfStock', count);
  setText('adminOutOfStockCount', count);
  setVisible('dashOutOfStockCard', isAdmin);
  setVisible('adminOutOfStockCard', isAdmin);

  ['dashOutOfStockCard','adminOutOfStockCard'].forEach(id => {
    const el = document.getElementById(id);
    if(el) el.classList.toggle('stock-alert', count > 0);
  });
}

function openOutOfStockFromDashboard(){
  if(typeof isAdminUserSafe === 'function' && !isAdminUserSafe()) return showSection('shop');

  updateOutOfStockStats();
  const outProducts = getOutOfStockProducts();

  scrollToAdmin('adminProductsPanel');

  setTimeout(() => {
    outProducts.forEach(product => {
      const item = document.getElementById('admin-product-' + product.id);
      if(item) item.classList.add('open');
    });

    if(outProducts[0]){
      document.getElementById('admin-product-' + outProducts[0].id)?.scrollIntoView({behavior:'smooth', block:'center'});
      showMessage(`Hay ${outProducts.length} producto${outProducts.length === 1 ? '' : 's'} sin stock.`);
    }else{
      showMessage('No tienes productos sin stock.');
    }
  }, 450);
}

const __baseLoadProductsOutOfStock = typeof loadProducts === 'function' ? loadProducts : null;
if(__baseLoadProductsOutOfStock){
  loadProducts = async function(){
    const result = await __baseLoadProductsOutOfStock();
    updateOutOfStockStats();
    return result;
  };
}

const __baseLoadAdminProductsOutOfStock = typeof loadAdminProducts === 'function' ? loadAdminProducts : null;
if(__baseLoadAdminProductsOutOfStock){
  loadAdminProducts = async function(){
    const result = await __baseLoadAdminProductsOutOfStock();
    updateOutOfStockStats();
    return result;
  };
}

const __baseSyncAdminVisibilityOutOfStock = typeof syncAdminVisibilitySafe === 'function' ? syncAdminVisibilitySafe : null;
if(__baseSyncAdminVisibilityOutOfStock){
  syncAdminVisibilitySafe = function(){
    __baseSyncAdminVisibilityOutOfStock();
    updateOutOfStockStats();
  };
}
