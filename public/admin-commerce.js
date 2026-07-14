function toggleAdminProduct(id){document.getElementById('admin-product-'+id)?.classList.toggle('open')}
async function deleteProduct(id){if(!confirm('¿Seguro que quieres eliminar este producto?'))return;try{const data=await api('/api/admin/products/'+id,{method:'DELETE'});showMessage(data.message||'Producto eliminado');await loadProducts();await loadAdminProducts();}catch(e){showMessage(e.message,'error');}}

function normalizeProductTypeAdmin(value){
  const clean=String(value||'streaming_auto').trim().toLowerCase();
  if(clean.includes('manual')) return 'manual';
  if(clean.includes('combo')) return 'combo_auto';
  return 'streaming_auto';
}

function setTodaySalesDate(){
  const input=document.getElementById('salesReportDate');
  if(input && !input.value){
    const today=new Date();
    const yyyy=today.getFullYear();
    const mm=String(today.getMonth()+1).padStart(2,'0');
    const dd=String(today.getDate()).padStart(2,'0');
    input.value=`${yyyy}-${mm}-${dd}`;
  }
}

function renderDashboardSalesCharts(byUser = [], byProduct = []) {
  if (typeof renderDashboardCharts === 'function') {
    const payload = {
      by_user: Array.isArray(byUser) ? byUser : [],
      top_products: (Array.isArray(byProduct) ? byProduct : []).map((p) => ({
        product_name: p.product_name || p.name || 'Producto',
        orders: Number(p.total_orders || p.orders || 0)
      }))
    };
    try {
      renderDashboardCharts(payload);
    } catch (e) {
      console.warn('No se pudo renderizar grafica de dashboard', e);
    }
  }
}

async function loadSalesReport(forceToday=false){
  if(currentUser?.role!=='admin')return;
  try{
    const input=document.getElementById('salesReportDate');
    if(forceToday && input) input.value='';
    const date=input?.value||'';
    const data=await api('/api/admin/sales-report'+(date?'?date='+encodeURIComponent(date):''));
    if(input && data?.date) input.value=data.date;

    const total=Number(data?.summary?.total_sales||0);
    const totalCost=Number(data?.summary?.total_cost||0);
    const totalProfit=Number(data?.summary?.total_profit||0);
    const totalOrders=Number(data?.summary?.total_orders||0);
    const byUser=data?.by_user||[];
    const byProduct=data?.by_product||[];
    const details=data?.details||[];
    renderDashboardSalesCharts(byUser, byProduct);

    const setText=(id,value)=>{const el=document.getElementById(id); if(el)el.textContent=value;};
    setText('statSalesToday', formatMoney(total));
    setText('adminSalesToday', formatMoney(total));
    setText('salesReportTotal', formatMoney(total));
    setText('salesReportCost', formatMoney(totalCost));
    setText('salesReportProfit', formatMoney(totalProfit));
    setText('salesReportOrders', totalOrders);
    setText('salesReportUsers', byUser.length);

    const byUserBox=document.getElementById('salesByUserList');
    if(byUserBox){
      byUserBox.innerHTML=byUser.length?`<div class="table-wrap"><table class="mini-table"><thead><tr><th>Usuario</th><th>Pedidos</th><th>Venta</th><th>Costo</th><th>Ganancia</th></tr></thead><tbody>${byUser.map(u=>`<tr><td><b>${safeText(u.customer_name||'Cliente')}</b><br><span class="small-text">${safeText(u.customer_email||'')}</span></td><td>${u.total_orders}</td><td>$${formatMoney(u.total_sales)}</td><td>$${formatMoney(u.total_cost)}</td><td><b>$${formatMoney(u.total_profit)}</b></td></tr>`).join('')}</tbody></table></div>`:'Sin ventas por usuario.';
    }

    const byProductBox=document.getElementById('salesByProductList');
    if(byProductBox){
      byProductBox.innerHTML=byProduct.length?`<div class="table-wrap"><table class="mini-table"><thead><tr><th>Producto real vendido</th><th>Pedidos</th><th>Venta</th><th>Costo</th><th>Ganancia</th></tr></thead><tbody>${byProduct.map(p=>`<tr><td><b>${safeText(p.product_name||'Producto')}</b><br><span class="small-text">${safeText(p.product_category||'')}</span></td><td>${p.total_orders}</td><td>$${formatMoney(p.total_sales)}</td><td>$${formatMoney(p.total_cost)}</td><td><b>$${formatMoney(p.total_profit)}</b></td></tr>`).join('')}</tbody></table></div>`:'Sin ventas por producto.';
    }

    const detailsBox=document.getElementById('salesDetailsList');
    if(detailsBox){
      detailsBox.innerHTML=details.length?`<div class="table-wrap"><table class="mini-table"><thead><tr><th>Pedido</th><th>Cliente</th><th>Producto real vendido</th><th>Venta</th><th>Costo</th><th>Ganancia</th><th>Fecha México</th></tr></thead><tbody>${details.map(o=>`<tr><td>#${o.id}</td><td><b>${safeText(o.customer_name||'Cliente')}</b><br><span class="small-text">${safeText(o.customer_email||'')}</span></td><td>${safeText(o.product_name||'')}</td><td>$${formatMoney(o.amount)}</td><td>$${formatMoney(o.cost_price)}</td><td><b>$${formatMoney(o.profit)}</b></td><td>${safeText(o.created_at_mx||'')}</td></tr>`).join('')}</tbody></table></div>`:'Sin ventas en esta fecha.';
    }
  }catch(e){
    console.warn('No se pudo cargar reporte de ventas',e);
    showMessage(e.message||'Error cargando reporte de ventas','error');
  }
}

async function createProduct(){
  try{
    const typeEl=document.getElementById('productType');
    const stockEnabledEl=document.getElementById('productStockEnabled');
    const stockEl=document.getElementById('productStock');
    const selectedType=normalizeProductTypeAdmin(typeEl?.value || 'streaming_auto');
    const manualStock=Math.max(0, Number(stockEl?.value || 0));
    const manualEnabled=selectedType==='manual' ? (manualStock>0 || stockEnabledEl?.checked===true) : true;

    const data=await api('/api/admin/create-product',{
      method:'POST',
      body:JSON.stringify({
        name:document.getElementById('productName')?.value || '',
        description:document.getElementById('productDescription')?.value || '',
        price:document.getElementById('productPrice')?.value || 0,
        cost_price:(document.getElementById('productCostPrice')?.value||0),
        category:document.getElementById('productCategory')?.value || '',
        required_fields:getRequiredFieldsFromInput('productRequiredFields'),
        charge_mode:document.getElementById('productChargeMode')?.value || 'on_purchase',
        stock_enabled:manualEnabled,
        stock:manualStock,
        product_type:selectedType,
        combo_items:getSelectedComboItems('create'),
        combo_discount:document.getElementById('productComboDiscount')?.value || 0
      })
    });
    showMessage(data.message||'Producto creado');
    const nameEl=document.getElementById('productName'); if(nameEl) nameEl.value='';
    const descEl=document.getElementById('productDescription'); if(descEl) descEl.value='';
    const priceEl=document.getElementById('productPrice'); if(priceEl) priceEl.value='';
    const categoryEl=document.getElementById('productCategory'); if(categoryEl) categoryEl.value='';
    const reqEl=document.getElementById('productRequiredFields'); if(reqEl) reqEl.value='';
    if(document.getElementById('productCostPrice'))document.getElementById('productCostPrice').value='0';
    if(document.getElementById('productType'))document.getElementById('productType').value='streaming_auto';
    if(document.getElementById('productComboDiscount'))document.getElementById('productComboDiscount').value='5';
    toggleComboCreateBox();
    await loadProducts();
    await loadAdminProducts();
  }catch(e){showMessage(e.message,'error')}
}

async function loadAdminProducts(){
  const products=allProducts.length?allProducts:await api('/api/products');
  if(document.getElementById('adminProductsCount'))adminProductsCount.textContent=products.length;
  const list=document.getElementById('adminProductsList');
  if(!list)return;
  list.innerHTML=products.map(p=>{
    const rf=parseJsonArray(p.required_fields);
    const type=normalizeProductTypeAdmin(p.product_type||'streaming_auto');
    const se=type==='manual' ? Number(p.stock_enabled||0)===1 : true;
    return `<div class="item" id="admin-product-${p.id}">
      <div style="display:flex;justify-content:space-between;gap:12px;cursor:pointer" onclick="toggleAdminProduct(${p.id}); setTimeout(()=>toggleComboEditBox(${p.id}),60)">
        <b>${safeText(p.name)}</b>
        <span>Venta: $${formatMoney(p.price)} · Costo: $${formatMoney(p.cost_price||0)} · ${safeText(p.category||'Otros')} · ${type==='combo_auto'?'Combo':type==='manual'?'Manual':'Automático'}</span>
      </div>
      <div class="admin-product-body">
        <label class="field-label">Nombre</label><input id="editName-${p.id}" value="${safeText(p.name)}" />
        <label class="field-label">Descripción</label><textarea id="editDescription-${p.id}">${safeText(p.description||'')}</textarea>
        <div class="three-row"><div><label class="field-label">Precio de venta</label><input id="editPrice-${p.id}" type="number" step="0.01" value="${p.price}" /></div><div><label class="field-label">Costo de compra</label><input id="editCostPrice-${p.id}" type="number" step="0.01" value="${Number(p.cost_price||0)}" /></div><div><label class="field-label">Categoría</label><input id="editCategory-${p.id}" value="${safeText(p.category||'Otros')}" /></div></div>
        <label class="field-label">Datos requeridos</label><textarea id="editRequiredFields-${p.id}">${safeText(rf.join(', '))}</textarea>
        <label class="field-label">Tipo de producto</label><select id="editProductType-${p.id}" onchange="toggleComboEditBox(${p.id})"><option value="streaming_auto" ${type==='streaming_auto'?'selected':''}>Automático streaming</option><option value="manual" ${type==='manual'?'selected':''}>Manual</option><option value="combo_auto" ${type==='combo_auto'?'selected':''}>Combo automático</option></select>
        <div id="editComboBox-${p.id}" class="${type==='combo_auto'?'':'hidden'}"><label class="field-label">Descuento por plataforma incluida</label><input id="editComboDiscount-${p.id}" type="number" step="0.01" value="${Number(p.combo_discount||0)}" /><label class="field-label">Productos incluidos</label><div id="editComboItemsBox-${p.id}" class="order-data"></div><p class="small-text">El combo descuenta este monto a cada plataforma incluida.</p></div>
        <label class="field-label">Cobro</label><select id="editChargeMode-${p.id}"><option value="on_purchase" ${p.charge_mode==='on_purchase'?'selected':''}>Descontar al comprar</option><option value="on_success" ${p.charge_mode==='on_success'?'selected':''}>Descontar cuando el admin marque Éxito</option></select>
        <label class="checkbox-row"><input type="checkbox" id="editStockEnabled-${p.id}" ${se?'checked':''}/> Activar stock</label><input id="editStock-${p.id}" type="number" min="0" value="${Number(p.stock||0)}"/>
        <div class="three-row"><button onclick="updateProduct(${p.id})">Guardar</button><button class="danger-btn" onclick="deleteProduct(${p.id})">Eliminar</button><button class="muted-btn" onclick="toggleProduct(${p.id});showSection('shop')">Ver tienda</button></div>
      </div>
    </div>`
  }).join('')||'No hay productos.';
  products.forEach(p=>{
    if(normalizeProductTypeAdmin(String(p.product_type||''))==='combo_auto'){
      renderComboOptions(`editComboItemsBox-${p.id}`, parseJsonArray(p.combo_items), `edit-${p.id}`, p.id);
    }
  });
}

async function updateProduct(id){
  try{
    const type=normalizeProductTypeAdmin(document.getElementById(`editProductType-${id}`)?.value || 'streaming_auto');
    const stockValue=Math.max(0, Number(document.getElementById('editStock-'+id)?.value || 0));
    const stockEnabledChecked=document.getElementById('editStockEnabled-'+id)?.checked === true;
    const stockEnabledFinal=type==='manual' ? (stockValue>0 || stockEnabledChecked) : true;

    const required_fields=document.getElementById('editRequiredFields-'+id).value.split(',').map(normalizeFieldName).filter(Boolean);
    const data=await api('/api/admin/products/'+id,{method:'PATCH',body:JSON.stringify({
      name:document.getElementById('editName-'+id).value,
      description:document.getElementById('editDescription-'+id).value,
      price:document.getElementById('editPrice-'+id).value,
      cost_price:(document.getElementById('editCostPrice-'+id)?.value||0),
      category:document.getElementById('editCategory-'+id).value,
      required_fields,
      charge_mode:document.getElementById('editChargeMode-'+id).value,
      stock_enabled:stockEnabledFinal,
      stock:stockValue,
      product_type:type,
      combo_items:getSelectedComboItems(`edit-${id}`),
      combo_discount:document.getElementById(`editComboDiscount-${id}`)?.value || 0
    })});
    showMessage(data.message||'Producto actualizado');
    await loadProducts();
    await loadAdminProducts();
  }catch(e){showMessage(e.message,'error')}
}

function toggleCreateProduct(){
  const box=document.getElementById('createProductBox');
  if(!box)return;
  box.classList.toggle('hidden');
  ensureComboCreateControls();
}

async function loadAdminOrders(page){
  try{
    if(Number.isFinite(Number(page)) && Number(page)>0) currentOrdersPage=Math.floor(Number(page));
    adminOrders=await api(`/api/admin/orders?page=${Math.max(1, Number(currentOrdersPage||1))}&limit=${ADMIN_TABLE_PAGE_LIMIT}`);
    const rows=Array.isArray(adminOrders?.rows) ? adminOrders.rows : [];
    const total=Number(adminOrders?.total || rows.length || 0);
    const totalPages=Number(adminOrders?.totalPages || 1);
    currentOrdersPage=Number(adminOrders?.page || 1);
    adminOrders=rows;

    const adminCount=document.getElementById('adminOrdersCount');
    if(adminCount)adminCount.textContent=total;
    const stat=document.getElementById('statOrders');
    if(stat)stat.textContent=currentUser?.role==='admin'?total:(myOrders||[]).length;
    const list=document.getElementById('adminOrdersList');
    const oldNotice=document.getElementById('manualPendingNotice');
    if(oldNotice)oldNotice.remove();
    if(list)list.innerHTML=adminOrders.length?adminOrders.map(renderAdminOrderCompactFinal).join(''):'No hay pedidos.';
    if(list)renderTablePager(list, 'ordersPaginationControls', currentOrdersPage, totalPages, 'goAdminOrdersPagePrev', 'goAdminOrdersPageNext');
    if(typeof updateManualPendingCount==='function') updateManualPendingCount();
  }catch(e){showMessage(e.message||'Error cargando pedidos','error')}
}

async function updateOrderStatus(id){
  try{
    const order=getAdminOrderByIdManualFix(id);
    const status=document.getElementById('status-'+id)?.value;
    const payload={
      status,
      response_message:document.getElementById('response-'+id)?.value || '',
      refund_if_rejected:document.getElementById('refund-'+id)?.checked === true
    };

    if(order && String(order.product_type||'').toLowerCase()==='manual' && status==='exito'){
      const accountEmail=(document.getElementById('manualAccountEmail-'+id)?.value || '').trim();
      const accountPassword=(document.getElementById('manualAccountPassword-'+id)?.value || '').trim();
      const platformProductId=document.getElementById('manualPlatformProduct-'+id)?.value || order.product_id;

      if(accountEmail || accountPassword){
        if(!accountEmail || !accountPassword){
          throw new Error('Para registrar la cuenta manual, correo y contraseña son obligatorios.');
        }
        payload.manual_account={
          product_id:Number(platformProductId),
          account_email:accountEmail,
          account_password:accountPassword,
          profile_name:(document.getElementById('manualProfileName-'+id)?.value || '').trim(),
          profile_pin:(document.getElementById('manualProfilePin-'+id)?.value || '').trim(),
          access_url:(document.getElementById('manualAccessUrl-'+id)?.value || '').trim()
        };
      }
    }

    const data=await api('/api/admin/orders/'+id+'/status',{method:'PATCH',body:JSON.stringify(payload)});
    showMessage(data.message||'Pedido actualizado');
    await Promise.allSettled([
      loadAdminOrders(),
      loadMyOrders(),
      loadUsers(),
      loadPlatformInventory(),
      loadSalesReport()
    ]);
  }catch(e){showMessage(e.message||'Error actualizando pedido','error')}
}
