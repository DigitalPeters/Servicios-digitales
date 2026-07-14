async function loadUsers(){allUsers=await api('/api/admin/users');statUsers.textContent=allUsers.length;adminUsersCount.textContent=allUsers.length;balanceUserSelect.innerHTML='<option value="">Selecciona usuario</option>'+allUsers.map(u=>`<option value="${u.id}">${safeText(u.name)} (${safeText(u.email)}) - $${formatMoney(u.balance)}</option>`).join('');balanceUserSelect.onchange=()=>{balanceUserId.value=balanceUserSelect.value};usersList.innerHTML=allUsers.map(u=>`<div class="item"><p><b>ID:</b> ${u.id}</p><p><b>Nombre:</b> ${safeText(u.name)}</p><p><b>Correo:</b> ${safeText(u.email)}</p><p><b>Rol:</b> ${safeText(u.role)}</p><p><b>Saldo:</b> $${formatMoney(u.balance)}</p></div>`).join('')||'No hay usuarios.'}
async function addBalance(){try{const data=await api('/api/admin/add-balance',{method:'POST',body:JSON.stringify({user_id:Number(balanceUserId.value),amount:balanceAmount.value,note:balanceNote.value})});showMessage(data.message||'Saldo agregado');balanceAmount.value=balanceNote.value='';await loadUsers();}catch(e){showMessage(e.message,'error');}}

function isDistributorUser(){
  return currentUser && (currentUser.role === 'admin' || currentUser.is_subadmin === true || currentUser.is_subadmin === 1 || currentUser.is_subadmin === 'true');
}
function isSubadminOnly(){
  return currentUser && (currentUser.is_panel_admin === true || currentUser.is_panel_admin === 1 || currentUser.is_panel_admin === 'true' || (currentUser.role !== 'admin' && (currentUser.is_subadmin === true || currentUser.is_subadmin === 1 || currentUser.is_subadmin === 'true')));
}

const __oldShowSectionForDistributor = showSection;
showSection = function(name){
  __oldShowSectionForDistributor(name);
  if(name === 'distributor' && isDistributorUser()){
    loadDistributorPanel();
    loadDistributorPrices();
  }
};

const __oldLoadAppForDistributor = loadApp;
loadApp = async function(){
  await __oldLoadAppForDistributor();
  const distributorVisible = isSubadminOnly();
  document.getElementById('distributorMenuBtn')?.classList.toggle('hidden', !distributorVisible);
  document.getElementById('dashDistributorCard')?.classList.toggle('hidden', !distributorVisible);
  if(currentUser?.role === 'admin'){
    renderAdminSubadminSelect();
  }
};

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
    const stat = document.getElementById('statResellers');
    if(stat) stat.textContent = sellers.length;
    const select = document.getElementById('resellerBalanceSelect');
    if(select){
      select.innerHTML = '<option value="">Selecciona vendedor</option>' + sellers.map(s=>`<option value="${s.id}">${safeText(s.name)} (${safeText(s.email)}) - $${formatMoney(s.balance)}</option>`).join('');
    }
    const box = document.getElementById('resellersList');
    if(box){
      box.innerHTML = sellers.length ? sellers.map(s=>`<div class="item"><p><b>ID:</b> ${s.id}</p><p><b>Nombre:</b> ${safeText(s.name)}</p><p><b>Correo:</b> ${safeText(s.email)}</p><p><b>Saldo:</b> $${formatMoney(s.balance)}</p><div class="tools" style="margin-bottom:0"><button class="outline-btn" style="width:auto" onclick="resetResellerAccess(${s.id})">Reparar acceso</button><button class="danger-btn" style="width:auto" onclick="deleteReseller(${s.id})">Eliminar vendedor</button></div></div>`).join('') : 'Sin vendedores.';
    }
  }catch(e){ showMessage(e.message || 'Error cargando vendedores','error'); }
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

const __oldLoadUsersForSubadminTools = loadUsers;
loadUsers = async function(){
  await __oldLoadUsersForSubadminTools();
  renderAdminSubadminSelect();
  const box=document.getElementById('usersList');
  if(currentUser?.role==='admin' && box && Array.isArray(allUsers)){
    box.innerHTML = allUsers.map(u=>{
      const isPanelOwner = u.is_panel_admin === true || u.is_panel_admin === 1 || u.is_panel_admin === 'true';
      const isDistributor = !isPanelOwner && (u.is_subadmin === true || u.is_subadmin === 1 || u.is_subadmin === 'true');
      const chip = isPanelOwner ? '<span class="chip">Panel propietario</span>' : (isDistributor ? '<span class="chip">Admin distribuidor</span>' : '');
      const roleText = isPanelOwner ? 'panel_propietario' : safeText(u.role);
      const action = (!isPanelOwner && u.role !== 'admin') ? `<button class="outline-btn" onclick="toggleSubadmin(${u.id}, ${isDistributor ? 'false' : 'true'})">${isDistributor ? 'Quitar admin distribuidor' : 'Convertir en admin distribuidor'}</button>` : '';
      return `<div class="item"><p><b>ID:</b> ${u.id}</p><p><b>Nombre:</b> ${safeText(u.name)}</p><p><b>Correo:</b> ${safeText(u.email)}</p><p><b>Rol:</b> ${roleText} ${chip}</p><p><b>Saldo:</b> $${formatMoney(u.balance)}</p>${action}</div>`;
    }).join('') || 'No hay usuarios.';
  }
};

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
