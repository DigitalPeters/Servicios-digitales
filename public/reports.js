async function loadSalesReport(){
  if(currentUser?.role!=='admin')return;
  try{
    setTodaySalesDate();
    const date=document.getElementById('salesReportDate')?.value||'';
    const data=await api('/api/admin/sales-report'+(date?'?date='+encodeURIComponent(date):''));
    const total=Number(data?.summary?.total_sales||0);
    const totalOrders=Number(data?.summary?.total_orders||0);
    const byUser=data?.by_user||[];
    const byProduct=data?.by_product||[];
    const details=data?.details||[];
    const salesToday=document.getElementById('statSalesToday');
    const adminSalesTodayEl=document.getElementById('adminSalesToday');
    const totalEl=document.getElementById('salesReportTotal');
    const ordersEl=document.getElementById('salesReportOrders');
    const usersEl=document.getElementById('salesReportUsers');
    if(salesToday)salesToday.textContent=formatMoney(total);
    if(adminSalesTodayEl)adminSalesTodayEl.textContent=formatMoney(total);
    if(totalEl)totalEl.textContent=formatMoney(total);
    if(ordersEl)ordersEl.textContent=totalOrders;
    if(usersEl)usersEl.textContent=byUser.length;

    const byUserBox=document.getElementById('salesByUserList');
    if(byUserBox){
      byUserBox.innerHTML=byUser.length?`<div class="table-wrap"><table class="mini-table"><thead><tr><th>Usuario</th><th>Pedidos</th><th>Total</th></tr></thead><tbody>${byUser.map(u=>`<tr><td><b>${safeText(u.customer_name||'Cliente')}</b><br><span class="small-text">${safeText(u.customer_email||'')}</span></td><td>${u.total_orders}</td><td>$${formatMoney(u.total_sales)}</td></tr>`).join('')}</tbody></table></div>`:'Sin ventas por usuario.';
    }
    const byProductBox=document.getElementById('salesByProductList');
    if(byProductBox){
      byProductBox.innerHTML=byProduct.length?`<div class="table-wrap"><table class="mini-table"><thead><tr><th>Producto real vendido</th><th>Pedidos</th><th>Total</th></tr></thead><tbody>${byProduct.map(p=>`<tr><td><b>${safeText(p.product_name||'Producto')}</b><br><span class="small-text">${safeText(p.product_category||'')}</span></td><td>${p.total_orders}</td><td>$${formatMoney(p.total_sales)}</td></tr>`).join('')}</tbody></table></div>`:'Sin ventas por producto.';
    }
    const detailsBox=document.getElementById('salesDetailsList');
    if(detailsBox){
      detailsBox.innerHTML=details.length?`<div class="table-wrap"><table class="mini-table"><thead><tr><th>Pedido</th><th>Cliente</th><th>Producto real vendido</th><th>Monto</th><th>Fecha México</th></tr></thead><tbody>${details.map(o=>`<tr><td>#${o.id}</td><td><b>${safeText(o.customer_name||'Cliente')}</b><br><span class="small-text">${safeText(o.customer_email||'')}</span></td><td>${safeText(o.product_name||'')}</td><td>$${formatMoney(o.amount)}</td><td>${safeText(o.created_at_mx||new Date(o.created_at).toLocaleString())}</td></tr>`).join('')}</tbody></table></div>`:'Sin ventas en esta fecha.';
    }
  }catch(e){
    console.warn('No se pudo cargar reporte de ventas',e);
    showMessage(e.message||'Error cargando reporte de ventas','error');
  }
}

// Después de que el código termine de pintar las tablas (innerHTML = ...), agrega esto:
setTimeout(() => {
  const target = document.getElementById('salesDetailsList'); // o el ID de tu sección de pedidos
  if (target) {
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}, 300); // Espera 300ms a que las tablas terminen de renderizarse antes de saltar

async function loadAdminOrders(){
  try{
    adminOrders=await api('/api/admin/orders');
    const adminCount=document.getElementById('adminOrdersCount');
    if(adminCount)adminCount.textContent=adminOrders.length;
    const stat=document.getElementById('statOrders');
    if(stat)stat.textContent=currentUser?.role==='admin'?adminOrders.length:(myOrders||[]).length;
    const list=document.getElementById('adminOrdersList');
    const oldNotice=document.getElementById('manualPendingNotice');
    if(oldNotice)oldNotice.remove();
    if(list)list.innerHTML=adminOrders.length?adminOrders.map(renderAdminOrderCompactFinal).join(''):'No hay pedidos.';
    if(typeof updateManualPendingCount==='function') updateManualPendingCount();
  }catch(e){showMessage(e.message||'Error cargando pedidos','error')}
}

function renderAdminOrdersManualPendingOnly(){
  const box=document.getElementById('adminOrdersList');
  if(!box || !Array.isArray(adminOrders)) return;
  const rows=adminOrders.filter(isManualPendingOrder);
  const oldNotice=document.getElementById('manualPendingNotice');
  if(oldNotice)oldNotice.remove();
  const notice=document.createElement('div');
  notice.id='manualPendingNotice';
  notice.className='bank-box';
  notice.innerHTML=`<b>Mostrando pedidos pendientes manuales.</b> <button class="outline-btn" style="width:auto;margin-left:10px" onclick="loadAdminOrders()">Ver todos los pedidos</button>`;
  box.parentNode.insertBefore(notice,box);
  box.innerHTML=rows.length?rows.map(renderAdminOrderCompactFinal).join(''):'No hay pedidos manuales pendientes.';
}
