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
  return currentUser && (currentUser.is_panel_admin === true || currentUser.is_panel_admin === 1 || currentUser.is_panel_admin === 'true' || (currentUser.role !== 'admin' && (currentUser.is_subadmin === true || currentUser.is_subadmin === 1 || currentUser.is_subadmin === 'true')));
}

function installDistributorHooks(){
  if(window.__distributorHooksInstalled) return true;
  if(typeof window.showSection !== 'function' || typeof window.loadApp !== 'function') return false;

  const __oldShowSectionForDistributor = window.showSection;
  window.showSection = function(name){
    __oldShowSectionForDistributor(name);
    if(name === 'distributor' && isDistributorUser()){
      loadDistributorPanel();
      loadDistributorPrices();
    }
  };

  const __oldLoadAppForDistributor = window.loadApp;
  window.loadApp = async function(){
    await __oldLoadAppForDistributor();
    const distributorVisible = isSubadminOnly();
    document.getElementById('distributorMenuBtn')?.classList.toggle('hidden', !distributorVisible);
    document.getElementById('dashDistributorCard')?.classList.toggle('hidden', !distributorVisible);
    if(currentUser?.role === 'admin'){
      renderAdminSubadminSelect();
    }
  };

  window.__distributorHooksInstalled = true;
  return true;
}

(function waitForAppHooks(attempts){
  if(installDistributorHooks()) return;
  if(attempts <= 0) return;
  setTimeout(() => waitForAppHooks(attempts - 1), 50);
})(80);

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

  // Si ya hay usuarios cargados en memoria, aplica render inmediato.
  if(Array.isArray(window.allUsers) && window.allUsers.length){
    renderAdminSubadminSelect();
    renderAdminUsersWithTools();
  }

  // Refresco único para garantizar que el panel Usuarios tome la versión nueva.
  setTimeout(()=>{
    if(typeof window.loadUsers === 'function' && currentUser?.role === 'admin'){
      window.loadUsers().catch(()=>{});
    }
  }, 0);
}

setTimeout(installLoadUsersEnhancer, 0);

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
