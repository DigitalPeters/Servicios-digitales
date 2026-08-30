async function loadUsersDistributorLegacy(){allUsers=await api('/api/admin/users');statUsers.textContent=allUsers.length;adminUsersCount.textContent=allUsers.length;balanceUserSelect.innerHTML='<option value="">Selecciona usuario</option>'+allUsers.map(u=>`<option value="${u.id}">${safeText(u.name)} (${safeText(u.email)}) - $${formatMoney(u.balance)}</option>`).join('');balanceUserSelect.onchange=()=>{balanceUserId.value=balanceUserSelect.value};usersList.innerHTML=allUsers.map(u=>`<div class="item"><p><b>ID:</b> ${u.id}</p><p><b>Nombre:</b> ${safeText(u.name)}</p><p><b>Correo:</b> ${safeText(u.email)}</p><p><b>Rol:</b> ${safeText(u.role)}</p><p><b>Saldo:</b> $${formatMoney(u.balance)}</p></div>`).join('')||'No hay usuarios.'}
async function addBalanceDistributorLegacy(){try{const data=await api('/api/admin/add-balance',{method:'POST',body:JSON.stringify({user_id:Number(balanceUserId.value),amount:balanceAmount.value,note:balanceNote.value})});showMessage(data.message||'Saldo agregado');balanceAmount.value=balanceNote.value='';if(typeof window.loadUsers==='function')await window.loadUsers();}catch(e){showMessage(e.message,'error');}}

async function adjustAdminUserBalance(mode){
  const userId = Number(document.getElementById('balanceUserId')?.value || 0);
  const amountRaw = (document.getElementById('balanceAmount')?.value || '').trim();
  const note = (document.getElementById('balanceNote')?.value || '').trim();
  const amount = Number(amountRaw);

  if(!userId || !amountRaw){
    showMessage('Selecciona usuario y cantidad', 'error');
    return;
  }

  if(!Number.isFinite(amount) || amount <= 0){
    showMessage('La cantidad debe ser mayor a 0', 'error');
    return;
  }

  try{
    const endpoint = mode === 'remove' ? '/api/admin/remove-balance' : '/api/admin/add-balance';
    const data = await api(endpoint, {
      method:'POST',
      body: JSON.stringify({
        user_id: userId,
        amount,
        note
      })
    });

    showMessage(data.message || (mode === 'remove' ? 'Saldo descontado' : 'Saldo agregado'));
    const amountInput = document.getElementById('balanceAmount');
    const noteInput = document.getElementById('balanceNote');
    if(amountInput) amountInput.value = '';
    if(noteInput) noteInput.value = '';
    if(typeof window.loadUsers === 'function') await window.loadUsers();
  }catch(e){
    showMessage(e.message || 'Error ajustando saldo', 'error');
  }
}

window.addBalance = function(){ return adjustAdminUserBalance('add'); };
window.removeBalance = function(){ return adjustAdminUserBalance('remove'); };

function isDistributorUser(){
  return currentUser && (currentUser.role === 'admin' || currentUser.is_subadmin === true || currentUser.is_subadmin === 1 || currentUser.is_subadmin === 'true');
}
function isSubadminOnly(){
  if(!currentUser) return false;
  const isPanelOwner = currentUser.is_panel_admin === true || currentUser.is_panel_admin === 1 || currentUser.is_panel_admin === '1' || currentUser.is_panel_admin === 'true';
  return isPanelOwner || isIndependentDistributorUser();
}

function installDistributorHooks(){
  if(window.__distributorHooksInstalled) return true;
  if(typeof window.registerSectionHook !== 'function' || typeof window.registerLoadAppHook !== 'function') return false;

  window.registerSectionHook(function distributorSectionHook(name){
    if(name === 'distributor' && isDistributorUser()){
      loadDistributorPanel();
      loadDistributorPrices();
    }
    if(name === 'distributorEarnings' && isIndependentDistributorUser()){
      initializeDistributorEarningsDates();
      loadDistributorEarnings();
    }
  });

  window.registerLoadAppHook(function distributorLoadAppHook(){
    const distributorVisible = isSubadminOnly();
    const earningsVisible = isIndependentDistributorUser();
    document.getElementById('distributorMenuBtn')?.classList.toggle('hidden', !distributorVisible);
    document.getElementById('distributorEarningsBtn')?.classList.toggle('hidden', !earningsVisible);
    document.getElementById('btn-dist-ganancias')?.classList.toggle('hidden', !earningsVisible);
    document.getElementById('dashDistributorCard')?.classList.toggle('hidden', !distributorVisible);

    const balanceLabel = document.getElementById('actionBalanceLabel');
    const balanceDescription = document.getElementById('actionBalanceDescription');
    const balanceDash = document.getElementById('distributorPurchaseBalanceDash');
    if(balanceDash) balanceDash.textContent = formatMoney(currentUser?.balance || 0);
    if(balanceLabel) balanceLabel.textContent = earningsVisible ? 'Mi saldo' : 'Cargar saldo';
    if(balanceDescription) balanceDescription.textContent = earningsVisible ? 'Saldo para mis compras personales' : 'Enviar solicitud de recarga';

    if(earningsVisible && typeof loadDistributorEarningsWallet === 'function'){
      loadDistributorEarningsWallet({ silent:true });
    }

    if(currentUser?.role === 'admin'){
      renderAdminSubadminSelect();
    }
  }, { name:'distributor-controls', order:800 });

  window.__distributorHooksInstalled = true;
  return true;
}

// Este archivo se carga después de app.js; los registros ya están disponibles.
// No es necesario sondear el navegador cada 50 ms.
installDistributorHooks();

async function createReseller(){
  try{
    const data = await api('/api/distributor/resellers', {
      method:'POST',
      body: JSON.stringify({
        name: resellerName.value,
        email: resellerEmail.value,
        password: resellerPassword.value
      })
    });
    showMessage(data.message || 'Vendedor creado');
    resellerName.value = resellerEmail.value = resellerPassword.value = '';
    await loadDistributorPanel();
  }catch(e){ showMessage(e.message,'error'); }
}

async function loadDistributorPanel(){
  if(!isDistributorUser()) return;
  try{
    const sellers = await api('/api/distributor/resellers');
    const activeCount = sellers.filter(s => s.is_enabled !== false).length;
    const inactiveCount = sellers.length - activeCount;
    const noMove2mCount = sellers.filter(s => Number(s.movements_2m || 0) <= 0).length;
    const stat = document.getElementById('statResellers');
    if(stat) stat.textContent = sellers.length;
    const select = document.getElementById('resellerBalanceSelect');
    if(select){
      select.innerHTML = '<option value="">Selecciona vendedor</option>' + sellers.map(s=>`<option value="${s.id}">${safeText(s.name)} (${safeText(s.email)}) - $${formatMoney(s.balance)}</option>`).join('');
    }
    const box = document.getElementById('resellersList');
    if(box){
      box.innerHTML = sellers.length ? `<div class="item" style="border-left:4px solid #2563eb"><p><b>Resumen:</b> ${sellers.length} vendedores · ${activeCount} activos · ${inactiveCount} deshabilitados · ${noMove2mCount} sin movimientos (2 meses)</p><div class="tools" style="margin-bottom:0"><button class="outline-btn" style="width:auto" onclick="disableInactiveResellers()">Deshabilitar inactivos (2 meses)</button></div></div>` + sellers.map(s=>`<div class="item"><p><b>ID:</b> ${s.id}</p><p><b>Nombre:</b> ${safeText(s.name)}</p><p><b>Correo:</b> ${safeText(s.email)}</p><p><b>Saldo:</b> $${formatMoney(s.balance)}</p><p><b>Estado:</b> ${s.is_enabled===false?'<span class="chip" style="background:#fee2e2;color:#991b1b">Deshabilitado</span>':'<span class="chip" style="background:#dcfce7;color:#166534">Activo</span>'}</p><p><b>Último movimiento:</b> ${formatResellerMovementDate(s.last_activity_at)}</p><p><b>Movimientos últimos 2 meses:</b> ${Number(s.movements_2m||0)}</p><div class="tools" style="margin-bottom:0"><button class="outline-btn" style="width:auto" onclick="resetResellerAccess(${s.id})">Reparar acceso</button><button class="outline-btn" style="width:auto" onclick="setResellerEnabled(${s.id}, ${s.is_enabled===false?'true':'false'})">${s.is_enabled===false?'Habilitar':'Deshabilitar'}</button><button class="danger-btn" style="width:auto" onclick="deleteReseller(${s.id})">Eliminar vendedor</button></div></div>`).join('') : 'Sin vendedores.';
    }
  }catch(e){ showMessage(e.message || 'Error cargando vendedores','error'); }
}

function formatResellerMovementDate(value){
  if(!value) return 'Sin movimientos registrados';
  const d = new Date(value);
  if(Number.isNaN(d.getTime())) return 'Sin movimientos registrados';
  return d.toLocaleString('es-MX');
}

async function setResellerEnabled(id, enabled){
  try{
    const enableValue = enabled === true || enabled === 'true';
    if(!confirm(enableValue ? '¿Habilitar este vendedor?' : '¿Deshabilitar este vendedor? No podrá iniciar sesión.')) return;
    const data = await api('/api/distributor/resellers/'+id+'/status', {
      method:'PATCH',
      body: JSON.stringify({ enabled: enableValue })
    });
    showMessage(data.message || (enableValue ? 'Vendedor habilitado' : 'Vendedor deshabilitado'));
    await loadDistributorPanel();
  }catch(e){ showMessage(e.message || 'Error cambiando estado del vendedor','error'); }
}

async function disableInactiveResellers(){
  try{
    if(!confirm('¿Deshabilitar todos los vendedores sin movimientos en los últimos 2 meses?')) return;
    const data = await api('/api/distributor/resellers/disable-inactive', { method:'POST' });
    showMessage(data.message || 'Vendedores inactivos deshabilitados');
    await loadDistributorPanel();
  }catch(e){ showMessage(e.message || 'Error deshabilitando inactivos','error'); }
}

async function resetResellerAccess(id){
  try{
    const password = prompt('Escribe una nueva contraseña para este vendedor (mínimo 6 caracteres):');
    if(!password) return;
    const data = await api('/api/distributor/resellers/'+id+'/reset-access', {
      method:'POST',
      body: JSON.stringify({ password })
    });
    showMessage(data.message || 'Acceso reparado');
    await loadDistributorPanel();
  }catch(e){ showMessage(e.message || 'Error reparando acceso','error'); }
}

async function deleteReseller(id){
  try{
    if(!confirm('¿Seguro que quieres eliminar este vendedor? Esta acción solo se permite si no tiene pedidos, reportes o solicitudes.')) return;
    const data = await api('/api/distributor/resellers/'+id, { method:'DELETE' });
    showMessage(data.message || 'Vendedor eliminado');
    await loadDistributorPanel();
  }catch(e){ showMessage(e.message || 'No se pudo eliminar vendedor','error'); }
}


async function repairResellerByEmail(){
  try{
    const email = prompt('Correo exacto del vendedor:');
    if(!email) return;
    const password = prompt('Nueva contraseña para el vendedor (mínimo 6 caracteres):');
    if(!password) return;
    const name = prompt('Nombre del vendedor (opcional):') || email;
    const data = await api('/api/distributor/resellers/repair-by-email', {
      method:'POST',
      body: JSON.stringify({ email, password, name })
    });
    showMessage(data.message || 'Acceso reparado');
    await loadDistributorPanel();
  }catch(e){ showMessage(e.message || 'Error reparando acceso por correo','error'); }
}

async function addResellerBalance(){
  try{
    const data = await api('/api/distributor/add-balance', {
      method:'POST',
      body: JSON.stringify({
        user_id: Number(resellerBalanceSelect.value),
        amount: resellerBalanceAmount.value,
        note: resellerBalanceNote.value
      })
    });
    showMessage(data.message || 'Saldo agregado');
    resellerBalanceAmount.value = resellerBalanceNote.value = '';
    await loadDistributorPanel();
  }catch(e){ showMessage(e.message,'error'); }
}

async function loadDistributorPrices(){
  if(!isDistributorUser()) return;
  try{
    const prices = await api('/api/distributor/prices');
    const box = document.getElementById('distributorPricesList');
    if(!box) return;
    box.innerHTML = prices.length ? `<div class="table-wrap"><table class="mini-table"><thead><tr><th>Producto</th><th>Tu costo</th><th>Precio vendedor</th><th>Ganancia</th><th>Guardar</th></tr></thead><tbody>${prices.map(p=>`<tr><td><b>${safeText(p.name)}</b><br><span class="small-text">${safeText(p.category||'')}</span></td><td>$${formatMoney(p.owner_price)}</td><td><input id="resellerPrice-${p.product_id}" type="number" step="0.01" value="${Number(p.reseller_price||0)}" /></td><td>$${formatMoney(Number(p.reseller_price||0)-Number(p.owner_price||0))}</td><td><button class="primary-btn" onclick="saveDistributorPrice(${p.product_id})">Guardar</button></td></tr>`).join('')}</tbody></table></div>` : 'No hay productos.';
  }catch(e){ showMessage(e.message || 'Error cargando precios','error'); }
}

async function saveDistributorPrice(productId){
  try{
    const value = document.getElementById('resellerPrice-'+productId).value;
    const data = await api('/api/distributor/prices', {method:'PATCH', body: JSON.stringify({product_id: productId, sale_price: value})});
    showMessage(data.message || 'Precio actualizado');
    await loadDistributorPrices();
  }catch(e){ showMessage(e.message,'error'); }
}

function renderAdminUsersWithTools(){
  const box=document.getElementById('usersList');
  if(currentUser?.role==='admin' && box && Array.isArray(allUsers)){
    box.innerHTML = allUsers.map(u=>{
      const isPanelOwner = u.is_panel_admin === true || u.is_panel_admin === 1 || u.is_panel_admin === 'true';
      const isDistributor = !isPanelOwner && (u.is_subadmin === true || u.is_subadmin === 1 || u.is_subadmin === 'true');
      const chip = isPanelOwner ? '<span class="chip">Panel propietario</span>' : (isDistributor ? '<span class="chip">Admin distribuidor</span>' : '');
      const roleText = isPanelOwner ? 'panel_propietario' : safeText(u.role);
      const action = (!isPanelOwner && u.role !== 'admin') ? `<button class="outline-btn" onclick="toggleSubadmin(${u.id}, ${isDistributor ? 'false' : 'true'})">${isDistributor ? 'Quitar admin distribuidor' : 'Convertir en admin distribuidor'}</button>` : '';
      const canManage = Number(u.id) !== Number(currentUser?.id) && !isPanelOwner && u.role !== 'admin';
      const enabled = !(u.is_enabled === false || u.is_enabled === 0 || u.is_enabled === 'false');
      const statusChip = enabled
        ? '<span class="chip" style="background:#dcfce7;color:#166534">Activo</span>'
        : '<span class="chip" style="background:#fee2e2;color:#991b1b">Deshabilitado</span>';
      const movementDate = formatAdminUserMovementDate(u.last_activity_at);
      const movements2m = Number(u.movements_2m || 0);
      const manageButtons = canManage
        ? `<button class="outline-btn" onclick="adminSetUserEnabled(${u.id}, ${enabled ? 'false' : 'true'})">${enabled ? 'Deshabilitar' : 'Habilitar'}</button><button class="danger-btn" onclick="adminDeleteUser(${u.id})">Eliminar</button>`
        : '';
      return `<div class="item"><p><b>ID:</b> ${u.id}</p><p><b>Nombre:</b> ${safeText(u.name)}</p><p><b>Correo:</b> ${safeText(u.email)}</p><p><b>Rol:</b> ${roleText} ${chip}</p><p><b>Saldo:</b> $${formatMoney(u.balance)}</p><p><b>Estado:</b> ${statusChip}</p><p><b>Último movimiento:</b> ${movementDate}</p><p><b>Movimientos 2 meses:</b> ${movements2m}</p><div class="tools" style="margin-bottom:0">${action}${manageButtons}</div></div>`;
    }).join('') || 'No hay usuarios.';
  }
}

function installLoadUsersEnhancer(){
  if(window.__loadUsersEnhancedByDistributorTools) return;
  if(typeof window.loadUsers !== 'function') return;
  const baseLoadUsers = window.loadUsers;
  window.loadUsers = async function(){
    await baseLoadUsers();
    renderAdminSubadminSelect();
    renderAdminUsersWithTools();
  };
  window.__loadUsersEnhancedByDistributorTools = true;

  // Si la lista ya fue cargada, solo vuelve a renderizarla; no hace otra petición.
  if(Array.isArray(allUsers) && allUsers.length){
    renderAdminSubadminSelect();
    renderAdminUsersWithTools();
  }
}

installLoadUsersEnhancer();

function formatAdminUserMovementDate(value){
  if(!value) return 'Sin movimientos registrados';
  const d = new Date(value);
  if(Number.isNaN(d.getTime())) return 'Sin movimientos registrados';
  return d.toLocaleString('es-MX');
}

async function adminSetUserEnabled(userId, enabled){
  try{
    const enableValue = enabled === true || enabled === 'true';
    if(!confirm(enableValue ? '¿Habilitar este usuario?' : '¿Deshabilitar este usuario?')) return;
    const data = await api('/api/admin/users/'+userId+'/status', {
      method:'PATCH',
      body: JSON.stringify({ enabled: enableValue })
    });
    showMessage(data.message || (enableValue ? 'Usuario habilitado' : 'Usuario deshabilitado'));
    await loadUsers();
  }catch(e){ showMessage(e.message || 'Error cambiando estado del usuario','error'); }
}

async function adminDeleteUser(userId){
  try{
    if(!confirm('¿Seguro que quieres eliminar este usuario? Solo se permite si no tiene movimientos históricos.')) return;
    const data = await api('/api/admin/users/'+userId, { method:'DELETE' });
    showMessage(data.message || 'Usuario eliminado');
    await loadUsers();
  }catch(e){ showMessage(e.message || 'No se pudo eliminar usuario','error'); }
}

function renderAdminSubadminSelect(){
  const select=document.getElementById('subadminPriceUserSelect');
  if(!select || !Array.isArray(allUsers)) return;
  const current=select.value;
  const subadmins=allUsers.filter(u=>!(u.is_panel_admin === true || u.is_panel_admin === 1 || u.is_panel_admin === 'true') && (u.is_subadmin === true || u.is_subadmin === 1 || u.is_subadmin === 'true'));
  select.innerHTML='<option value="">Selecciona admin distribuidor</option>'+subadmins.map(u=>`<option value="${u.id}">${safeText(u.name)} (${safeText(u.email)})</option>`).join('');
  select.value=current;
}

async function toggleSubadmin(userId, value){
  try{
    const data=await api('/api/admin/users/'+userId+'/subadmin',{method:'PATCH', body:JSON.stringify({is_subadmin:value===true})});
    showMessage(data.message || 'Usuario actualizado');
    await loadUsers();
  }catch(e){ showMessage(e.message,'error'); }
}

async function loadAdminSubadminPrices(){
  try{
    const userId=document.getElementById('subadminPriceUserSelect')?.value;
    const box=document.getElementById('adminSubadminPricesList');
    if(!userId){ if(box) box.innerHTML='Selecciona un admin distribuidor.'; return; }
    const prices=await api('/api/admin/subadmin-prices/'+userId);
    if(!box) return;
    box.innerHTML=prices.length ? `<div class="table-wrap"><table class="mini-table"><thead><tr><th>Producto</th><th>Precio general</th><th>Precio para este admin</th><th>Guardar</th></tr></thead><tbody>${prices.map(p=>`<tr><td><b>${safeText(p.name)}</b><br><span class="small-text">${safeText(p.category||'')}</span></td><td>$${formatMoney(p.general_price)}</td><td><input id="subadminPrice-${p.product_id}" type="number" step="0.01" value="${Number(p.sale_price||0)}" /></td><td><button class="primary-btn" onclick="saveAdminSubadminPrice(${userId}, ${p.product_id})">Guardar</button></td></tr>`).join('')}</tbody></table></div>` : 'No hay productos.';
  }catch(e){ showMessage(e.message || 'Error cargando precios','error'); }
}

async function saveAdminSubadminPrice(userId, productId){
  try{
    const value=document.getElementById('subadminPrice-'+productId).value;
    const data=await api('/api/admin/subadmin-prices',{method:'PATCH', body:JSON.stringify({user_id:Number(userId), product_id:productId, sale_price:value})});
    showMessage(data.message || 'Precio guardado');
    await loadAdminSubadminPrices();
  }catch(e){ showMessage(e.message,'error'); }
}


// ==========================================
// REPORTE DE GANANCIAS DEL DISTRIBUIDOR
// ==========================================
let distributorEarningsCache = null;
let distributorEarningsWalletCache = null;

function isIndependentDistributorUser(){
  if(!currentUser) return false;
  const accountType = String(currentUser.account_type || '').toLowerCase();
  const isPanelOwner = currentUser.is_panel_admin === true || currentUser.is_panel_admin === 1 || currentUser.is_panel_admin === '1' || currentUser.is_panel_admin === 'true';
  const flag = currentUser.is_subadmin === true || currentUser.is_subadmin === 1 || currentUser.is_subadmin === '1' || currentUser.is_subadmin === 'true';
  if(['admin_distribuidor','distribuidor_del_panel'].includes(accountType)) return true;
  return !isPanelOwner && flag;
}

function getMexicoDateParts(){
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Mexico_City',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return {
    today: `${values.year}-${values.month}-${values.day}`,
    monthStart: `${values.year}-${values.month}-01`
  };
}

function initializeDistributorEarningsDates(){
  const start = document.getElementById('distributorEarningsStart');
  const end = document.getElementById('distributorEarningsEnd');
  if(!start || !end) return;
  const dates = getMexicoDateParts();
  if(!start.value) start.value = dates.monthStart;
  if(!end.value) end.value = dates.today;
}

function setDistributorEarningsToday(){
  const dates = getMexicoDateParts();
  const start = document.getElementById('distributorEarningsStart');
  const end = document.getElementById('distributorEarningsEnd');
  if(start) start.value = dates.today;
  if(end) end.value = dates.today;
  return loadDistributorEarnings();
}

function setDistributorEarningsCurrentMonth(){
  const dates = getMexicoDateParts();
  const start = document.getElementById('distributorEarningsStart');
  const end = document.getElementById('distributorEarningsEnd');
  if(start) start.value = dates.monthStart;
  if(end) end.value = dates.today;
  return loadDistributorEarnings();
}

function setDistributorEarningsText(id, value){
  const element = document.getElementById(id);
  if(element) element.textContent = String(value);
}

function distributorMoneySigned(value){
  const n = Number(value || 0);
  if(!Number.isFinite(n) || Math.abs(n) < 0.005) return '$0.00';
  return `${n < 0 ? '-$' : '+$'}${formatMoney(Math.abs(n))}`;
}

function distributorMovementLabel(type){
  const key=String(type||'').toLowerCase();
  if(key==='venta') return 'Ganancia por venta';
  if(key==='ajuste_reembolso') return 'Ajuste por reembolso';
  if(key==='transferencia_saldo') return 'Transferencia a saldo';
  return 'Movimiento';
}

function renderDistributorEarningsWallet(wallet){
  const data = wallet || {};
  distributorEarningsWalletCache = data;
  const available = Number(data.available || 0);
  const purchaseBalance = Number(data.purchase_balance || 0);
  const earned = Number(data.earned_from_sales || 0);
  const refundAdjustments = Number(data.refund_adjustments || 0);
  const transferred = Number(data.transferred_to_balance || 0);
  const movements = Array.isArray(data.movements) ? data.movements : [];

  setDistributorEarningsText('distributorWalletAvailable', formatMoney(available));
  setDistributorEarningsText('distributorWalletPurchaseBalance', formatMoney(purchaseBalance));
  setDistributorEarningsText('distributorWalletEarned', formatMoney(earned));
  setDistributorEarningsText('distributorWalletRefundAdjustments', refundAdjustments < 0 ? `-${formatMoney(Math.abs(refundAdjustments))}` : formatMoney(refundAdjustments));
  setDistributorEarningsText('distributorWalletTransferred', formatMoney(transferred));
  setDistributorEarningsText('distributorAvailableEarningsDash', formatMoney(available));
  setDistributorEarningsText('distributorPurchaseBalanceDash', formatMoney(purchaseBalance));

  if(currentUser){
    currentUser.balance = purchaseBalance;
    const top = document.getElementById('topUserBalance');
    const userBalance = document.getElementById('userBalance');
    if(top) top.textContent = formatMoney(purchaseBalance);
    if(userBalance) userBalance.textContent = formatMoney(purchaseBalance);
  }

  const warning = document.getElementById('distributorEarningsWalletWarning');
  if(warning){
    if(available < 0){
      warning.innerHTML = `<b>Ganancias en ajuste:</b> tu cuenta está en -$${formatMoney(Math.abs(available))}. Esto puede ocurrir si ya habías transferido ganancias y después hubo un reembolso. Tu saldo de compra no se descontó; las próximas ganancias cubrirán primero este ajuste.`;
    }else if(available === 0){
      warning.textContent = 'No tienes ganancias disponibles para transferir en este momento.';
    }else{
      warning.textContent = `Disponible para transferir: $${formatMoney(available)}. Tu saldo de compra se mantiene separado.`;
    }
  }

  const box = document.getElementById('distributorEarningsMovements');
  if(box){
    box.innerHTML = movements.length
      ? `<div class="table-wrap"><table class="mini-table"><thead><tr><th>Fecha</th><th>Movimiento</th><th>Vendedor / pedido</th><th>Detalle</th><th>Importe</th></tr></thead><tbody>${movements.map(row=>{
          const amount = Number(row.amount || 0);
          const context = row.order_id ? `${safeText(row.seller_name || 'Vendedor')} · Pedido #${Number(row.order_id)}` : 'Cuenta del distribuidor';
          const detailParts=[];
          if(row.product_name) detailParts.push(safeText(row.product_name));
          if(Number(row.refund_amount || 0)>0) detailParts.push(`Reembolso $${formatMoney(row.refund_amount)}`);
          if(row.note) detailParts.push(safeText(row.note));
          return `<tr><td>${safeText(row.created_at_mx || '')}</td><td><b>${safeText(distributorMovementLabel(row.movement_type))}</b></td><td>${context}</td><td>${detailParts.join('<br>') || '-'}</td><td style="font-weight:800;${amount<0?'color:#b91c1c':'color:#166534'}">${distributorMoneySigned(amount)}</td></tr>`;
        }).join('')}</tbody></table></div>`
      : 'Sin movimientos de ganancias.';
  }
}

async function loadDistributorEarningsWallet(options={}){
  if(!isIndependentDistributorUser()) return null;
  try{
    const wallet = await api('/api/distributor/earnings/wallet');
    renderDistributorEarningsWallet(wallet);
    return wallet;
  }catch(error){
    if(!options.silent) showMessage(error.message || 'Error cargando cuenta de ganancias', 'error');
    return null;
  }
}

async function transferDistributorEarningsToBalance(){
  if(!isIndependentDistributorUser()){
    showMessage('Esta función es únicamente para distribuidores', 'error');
    return;
  }

  const amountInput = document.getElementById('distributorEarningsTransferAmount');
  const noteInput = document.getElementById('distributorEarningsTransferNote');
  const amount = Number(amountInput?.value || 0);
  const available = Number(distributorEarningsWalletCache?.available || 0);

  if(!Number.isFinite(amount) || amount <= 0){
    showMessage('Ingresa una cantidad mayor a 0', 'error');
    return;
  }
  if(available <= 0 || amount > available){
    showMessage(`Solo tienes $${formatMoney(available)} disponibles en Ganancias`, 'error');
    return;
  }

  try{
    const data = await api('/api/distributor/earnings/transfer', {
      method:'POST',
      body:JSON.stringify({ amount, note:(noteInput?.value || '').trim() })
    });
    if(amountInput) amountInput.value='';
    if(noteInput) noteInput.value='';
    if(data.wallet) renderDistributorEarningsWallet(data.wallet);
    showMessage(data.message || 'Ganancias transferidas a saldo');
  }catch(error){
    showMessage(error.message || 'No se pudieron transferir las ganancias', 'error');
    await loadDistributorEarningsWallet({ silent:true });
  }
}

function renderDistributorEarnings(data){
  const summary = data?.summary || {};
  const bySeller = Array.isArray(data?.by_seller) ? data.by_seller : [];
  const byProduct = Array.isArray(data?.by_product) ? data.by_product : [];
  const details = Array.isArray(data?.details) ? data.details : [];

  if(data?.wallet) renderDistributorEarningsWallet(data.wallet);

  setDistributorEarningsText('distributorEarningsOrders', Number(summary.total_orders || 0));
  setDistributorEarningsText('distributorEarningsGrossSales', formatMoney(summary.gross_sales || 0));
  setDistributorEarningsText('distributorEarningsRefunds', formatMoney(summary.total_refunds || 0));
  setDistributorEarningsText('distributorEarningsSales', formatMoney(summary.total_sales || 0));
  setDistributorEarningsText('distributorEarningsCost', formatMoney(summary.total_cost || 0));
  setDistributorEarningsText('distributorEarningsProfit', formatMoney(summary.total_profit || 0));
  setDistributorEarningsText('distributorEarningsMargin', Number(summary.margin_percent || 0).toFixed(2));
  const estimatedOrders = Number(summary.estimated_cost_orders || 0);
  const refundedOrders = Number(summary.refunded_orders || 0);
  const estimatedNote = estimatedOrders > 0
    ? ` · ${estimatedOrders} pedido${estimatedOrders === 1 ? '' : 's'} anterior${estimatedOrders === 1 ? '' : 'es'} calculado${estimatedOrders === 1 ? '' : 's'} con tu costo actual`
    : '';
  const refundNote = refundedOrders > 0
    ? ` · ${refundedOrders} pedido${refundedOrders === 1 ? '' : 's'} con reembolso ajustado proporcionalmente`
    : '';
  setDistributorEarningsText('distributorEarningsRangeLabel', `Periodo: ${safeText(data?.start_date || '')} al ${safeText(data?.end_date || '')} · Horario de México${refundNote}${estimatedNote}`);

  const sellerBox = document.getElementById('distributorEarningsBySeller');
  if(sellerBox){
    sellerBox.innerHTML = bySeller.length
      ? `<div class="table-wrap"><table class="mini-table"><thead><tr><th>Vendedor</th><th>Pedidos</th><th>Venta bruta</th><th>Reembolsos</th><th>Venta neta</th><th>Tu costo</th><th>Ganancia neta</th></tr></thead><tbody>${bySeller.map(row => `<tr><td><b>${safeText(row.seller_name || 'Vendedor')}</b><br><span class="small-text">${safeText(row.seller_email || '')}</span></td><td>${Number(row.total_orders || 0)}</td><td>$${formatMoney(row.gross_sales || 0)}</td><td>${Number(row.total_refunds || 0)>0?`-$${formatMoney(row.total_refunds || 0)}`:'$0.00'}</td><td>$${formatMoney(row.total_sales || 0)}</td><td>$${formatMoney(row.total_cost || 0)}</td><td><b>$${formatMoney(row.total_profit || 0)}</b></td></tr>`).join('')}</tbody></table></div>`
      : 'Sin ventas en el rango seleccionado.';
  }

  const productBox = document.getElementById('distributorEarningsByProduct');
  if(productBox){
    productBox.innerHTML = byProduct.length
      ? `<div class="table-wrap"><table class="mini-table"><thead><tr><th>Producto</th><th>Pedidos</th><th>Venta bruta</th><th>Reembolsos</th><th>Venta neta</th><th>Tu costo</th><th>Ganancia neta</th></tr></thead><tbody>${byProduct.map(row => `<tr><td><b>${safeText(row.product_name || 'Producto')}</b><br><span class="small-text">${safeText(row.product_category || '')}</span></td><td>${Number(row.total_orders || 0)}</td><td>$${formatMoney(row.gross_sales || 0)}</td><td>${Number(row.total_refunds || 0)>0?`-$${formatMoney(row.total_refunds || 0)}`:'$0.00'}</td><td>$${formatMoney(row.total_sales || 0)}</td><td>$${formatMoney(row.total_cost || 0)}</td><td><b>$${formatMoney(row.total_profit || 0)}</b></td></tr>`).join('')}</tbody></table></div>`
      : 'Sin ventas en el rango seleccionado.';
  }

  const detailsBox = document.getElementById('distributorEarningsDetails');
  if(detailsBox){
    detailsBox.innerHTML = details.length
      ? `<div class="table-wrap"><table class="mini-table"><thead><tr><th>Pedido</th><th>Vendedor</th><th>Producto</th><th>Venta bruta</th><th>Reembolso</th><th>Venta neta</th><th>Ganancia original</th><th>Ajuste de ganancia</th><th>Ganancia final</th><th>Fecha México</th></tr></thead><tbody>${details.map(row => `<tr><td>#${Number(row.id || 0)}</td><td><b>${safeText(row.seller_name || 'Vendedor')}</b><br><span class="small-text">${safeText(row.seller_email || '')}</span></td><td>${safeText(row.product_name || 'Producto')}</td><td>$${formatMoney(row.gross_sale_amount || 0)}</td><td>${Number(row.refund_amount || 0)>0?`-$${formatMoney(row.refund_amount || 0)}<br><span class="small-text">${Number(row.refund_percent||0).toFixed(2)}%</span>`:'$0.00'}</td><td>$${formatMoney(row.sale_amount || 0)}</td><td>$${formatMoney(row.original_profit || 0)}</td><td>${Number(row.refund_profit_adjustment || 0)>0?`-$${formatMoney(row.refund_profit_adjustment || 0)}`:'$0.00'}</td><td><b>$${formatMoney(row.profit || 0)}</b></td><td>${safeText(row.created_at_mx || '')}</td></tr>`).join('')}</tbody></table></div>`
      : 'Sin ventas en el rango seleccionado.';
  }
}

async function loadDistributorEarnings(){
  if(!isIndependentDistributorUser()){
    showMessage('Este reporte está disponible únicamente para distribuidores', 'error');
    return;
  }

  initializeDistributorEarningsDates();
  const start = document.getElementById('distributorEarningsStart')?.value || '';
  const end = document.getElementById('distributorEarningsEnd')?.value || '';
  if(!start || !end){
    showMessage('Selecciona la fecha inicial y final', 'error');
    return;
  }
  if(start > end){
    showMessage('La fecha inicial no puede ser posterior a la fecha final', 'error');
    return;
  }

  const rangeLabel = document.getElementById('distributorEarningsRangeLabel');
  if(rangeLabel) rangeLabel.textContent = 'Calculando ganancias...';

  try{
    const data = await api(`/api/distributor/earnings?start_date=${encodeURIComponent(start)}&end_date=${encodeURIComponent(end)}`);
    distributorEarningsCache = data;
    renderDistributorEarnings(data);
  }catch(error){
    distributorEarningsCache = null;
    if(rangeLabel) rangeLabel.textContent = 'No se pudo cargar el reporte.';
    showMessage(error.message || 'Error cargando reporte de ganancias', 'error');
  }
}

function escapeDistributorCsvValue(value){
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function downloadDistributorEarningsCsv(){
  const data = distributorEarningsCache;
  const rows = Array.isArray(data?.details) ? data.details : [];
  if(!rows.length){
    showMessage('No hay ventas para descargar en el rango seleccionado', 'error');
    return;
  }

  const csvRows = [
    ['Pedido','Vendedor','Correo','Producto','Categoría','Venta bruta','Reembolso','Venta neta','Costo distribuidor proporcional','Ganancia original','Ajuste ganancia por reembolso','Ganancia final','Fecha México'],
    ...rows.map(row => [
      row.id,
      row.seller_name || '',
      row.seller_email || '',
      row.product_name || '',
      row.product_category || '',
      Number(row.gross_sale_amount || 0).toFixed(2),
      Number(row.refund_amount || 0).toFixed(2),
      Number(row.sale_amount || 0).toFixed(2),
      Number(row.distributor_cost || 0).toFixed(2),
      Number(row.original_profit || 0).toFixed(2),
      Number(row.refund_profit_adjustment || 0).toFixed(2),
      Number(row.profit || 0).toFixed(2),
      row.created_at_mx || ''
    ])
  ];
  const csv = '\ufeff' + csvRows.map(row => row.map(escapeDistributorCsvValue).join(',')).join('\n');
  const blob = new Blob([csv], { type:'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `ganancias_distribuidor_${data.start_date || 'inicio'}_${data.end_date || 'fin'}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

window.irADirectoAGanancias = function irADirectoAGanancias(){
  if(!isIndependentDistributorUser()){
    showMessage('Este reporte está disponible únicamente para distribuidores', 'error');
    return false;
  }
  return showSection('distributorEarnings');
};
window.loadDistributorEarnings = loadDistributorEarnings;
window.setDistributorEarningsToday = setDistributorEarningsToday;
window.setDistributorEarningsCurrentMonth = setDistributorEarningsCurrentMonth;
window.downloadDistributorEarningsCsv = downloadDistributorEarningsCsv;
window.loadDistributorEarningsWallet = loadDistributorEarningsWallet;
window.transferDistributorEarningsToBalance = transferDistributorEarningsToBalance;
