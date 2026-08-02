let token=localStorage.getItem('token');let currentUser=null;let allProducts=[];let __productsLoadedOnce=false;let myOrders=[];let allUsers=[];let adminOrders=[];
let currentInventoryPage = 1;
let currentOrdersPage = 1;
let currentMyOrdersPage = 1;
let currentMyReportsPage = 1;
let currentFailureResponsesPage = 1;
let currentAdminAccountReportsPage = 1;
let currentAdminBalanceRequestsPage = 1;
let currentUserHistoryPage = 1;
const HISTORY_PAGE_LIMIT = 20;

function canAccessInventoryHistory(){
  return !!currentUser && (
    currentUser.role === 'admin' ||
    currentUser.is_subadmin === true ||
    currentUser.is_subadmin === 1 ||
    currentUser.is_subadmin === 'true'
  );
}

const SECTION_ALIASES = Object.freeze({
  reportsMenu: 'reports-menu',
  failureResponses: 'failure-responses',
  accountResponses: 'failure-responses',
  reportResponses: 'failure-responses',
  store: 'shop'
});

const __sectionHooks = new Set();
const __sectionLoadPromises = new Map();
let __sectionNavigationLocked = false;
let __lastSectionName = '';
let __sectionUnlockTimer = null;

function runAfterNextPaint(handler){
  if(typeof handler !== 'function') return;
  if(typeof requestAnimationFrame === 'function'){
    requestAnimationFrame(() => requestAnimationFrame(handler));
  }else{
    Promise.resolve().then(handler);
  }
}

function normalizeSectionName(name){
  const targetName = String(name || '').trim();
  return SECTION_ALIASES[targetName] || targetName;
}

function registerSectionHook(handler){
  if(typeof handler !== 'function') return function(){};
  __sectionHooks.add(handler);
  return function unregisterSectionHook(){ __sectionHooks.delete(handler); };
}
window.registerSectionHook = registerSectionHook;

function runSectionHooks(sectionName){
  __sectionHooks.forEach(handler => {
    try{
      handler(sectionName);
    }catch(error){
      console.warn('Error en acción posterior de navegación', sectionName, error);
    }
  });
}

function runSectionLoadOnce(key, loader){
  if(typeof loader !== 'function') return Promise.resolve();
  if(__sectionLoadPromises.has(key)) return __sectionLoadPromises.get(key);

  const task = Promise.resolve()
    .then(loader)
    .catch(error => {
      console.warn('Error cargando sección', key, error);
    })
    .finally(() => {
      __sectionLoadPromises.delete(key);
    });

  __sectionLoadPromises.set(key, task);
  return task;
}

function showSection(name) {
  let normalizedName = normalizeSectionName(name);
  if(!normalizedName) return false;

  if(normalizedName === 'admin' && typeof isAnyAdminUserPanel === 'function' && !isAnyAdminUserPanel()){
    normalizedName = 'dashboard';
  }

  if(normalizedName === 'inventory-history' && !canAccessInventoryHistory()){
    if(typeof showMessage === 'function'){
      showMessage('Solo el distribuidor puede acceder al historial de inventario', 'error');
    }
    normalizedName = 'dashboard';
  }

  if((normalizedName === 'reports-menu' || normalizedName === 'failure-responses') && typeof ensureReportMenuFinal === 'function'){
    ensureReportMenuFinal();
  }

  const section = document.getElementById('section-' + normalizedName);
  if(!section) return false;

  // Evita dobles clics y llamadas repetidas a la misma sección sin crear nuevas capas.
  if(__sectionNavigationLocked && normalizedName === __lastSectionName) return true;
  __sectionNavigationLocked = true;
  __lastSectionName = normalizedName;
  if(__sectionUnlockTimer) clearTimeout(__sectionUnlockTimer);
  __sectionUnlockTimer = setTimeout(() => {
    __sectionNavigationLocked = false;
  }, 120);

  document.querySelectorAll('.section').forEach(item => item.classList.remove('active'));
  section.classList.add('active');

  document.querySelectorAll('.menu-btn').forEach(button => {
    button.classList.toggle('active', button.dataset.section === normalizedName);
  });

  document.getElementById('sidebar')?.classList.remove('show');

  if(typeof applyRentedAdminLayout === 'function') applyRentedAdminLayout();

  if(normalizedName === 'shop' && typeof loadProducts === 'function'){
    runSectionLoadOnce('shop', () => loadProducts());
  }

  if(normalizedName === 'orders' && typeof loadMyOrders === 'function'){
    runSectionLoadOnce('orders', () => loadMyOrders());
  }

  if(normalizedName === 'balance' && typeof loadBankInfoForPanel === 'function'){
    runSectionLoadOnce('balance', () => loadBankInfoForPanel());
  }

  if(normalizedName === 'alerts' && typeof loadExpiringAlerts === 'function'){
    runSectionLoadOnce('alerts', () => loadExpiringAlerts());
  }

  if(normalizedName === 'admin' && typeof isAnyAdminUserPanel === 'function' && isAnyAdminUserPanel()){
    runSectionLoadOnce('admin', async () => {
      const rentedPanel = typeof isPanelAdminRented === 'function' && isPanelAdminRented();
      await Promise.allSettled([
        !rentedPanel && typeof loadUsers === 'function' ? loadUsers() : Promise.resolve(),
        typeof loadAdminProducts === 'function' ? loadAdminProducts() : Promise.resolve(),
        !rentedPanel && typeof loadBalanceRequests === 'function' ? loadBalanceRequests() : Promise.resolve(),
        !rentedPanel && typeof loadAccountReports === 'function' ? loadAccountReports() : Promise.resolve(),
        !rentedPanel && typeof loadSalesReport === 'function' ? loadSalesReport(true) : Promise.resolve()
      ]);
      if(typeof applyRentedAdminLayout === 'function') applyRentedAdminLayout();
    });
  }

  runSectionHooks(normalizedName);
  return true;
}

async function loadUsers(){
  const box = document.getElementById('usersList');
  try{
    const users = await api('/api/admin/users');
    allUsers = Array.isArray(users) ? users : [];
    window.__adminUsersCacheOwnerId = Number(currentUser?.id || 0);

    const statUsersEl = document.getElementById('statUsers');
    if(statUsersEl) statUsersEl.textContent = String(allUsers.length);
    const adminUsersCountEl = document.getElementById('adminUsersCount');
    if(adminUsersCountEl) adminUsersCountEl.textContent = String(allUsers.length);

    const balanceUserSelect = document.getElementById('balanceUserSelect');
    const balanceUserId = document.getElementById('balanceUserId');
    if(balanceUserSelect){
      balanceUserSelect.innerHTML = '<option value="">Selecciona usuario</option>' + allUsers.map(u => `<option value="${u.id}">${safeText(u.name)} (${safeText(u.email)}) - $${formatMoney(u.balance)}</option>`).join('');
      balanceUserSelect.onchange = () => {
        if(balanceUserId) balanceUserId.value = balanceUserSelect.value;
      };
    }

    if(box){
      box.innerHTML = allUsers.length ? allUsers.map(u => {
        const isPanelOwner = u.is_panel_admin === true || u.is_panel_admin === 1 || u.is_panel_admin === 'true';
        const isDistributor = !isPanelOwner && (u.is_subadmin === true || u.is_subadmin === 1 || u.is_subadmin === 'true');
        const enabled = !(u.is_enabled === false || u.is_enabled === 0 || u.is_enabled === 'false');
        const roleLabel = isPanelOwner ? 'Panel propietario' : (isDistributor ? 'Admin distribuidor' : 'Usuario');
        const statusChip = enabled
          ? '<span class="chip" style="background:#dcfce7;color:#166534">Activo</span>'
          : '<span class="chip" style="background:#fee2e2;color:#991b1b">Deshabilitado</span>';
        const canManage = Number(u.id) !== Number(currentUser?.id) && !isPanelOwner && u.role !== 'admin';
        const manageButtons = canManage
          ? `<div class="tools" style="margin-bottom:0"><button class="outline-btn" onclick="toggleSubadmin(${u.id}, ${isDistributor ? 'false' : 'true'})">${isDistributor ? 'Quitar admin distribuidor' : 'Convertir en admin distribuidor'}</button><button class="outline-btn" onclick="adminSetUserEnabled(${u.id}, ${enabled ? 'false' : 'true'})">${enabled ? 'Deshabilitar' : 'Habilitar'}</button><button class="danger-btn" onclick="adminDeleteUser(${u.id})">Eliminar</button></div>`
          : '';
        return `<div class="item"><p><b>ID:</b> ${u.id}</p><p><b>Nombre:</b> ${safeText(u.name)}</p><p><b>Correo:</b> ${safeText(u.email)}</p><p><b>Rol:</b> ${safeText(u.role)} <span class="chip">${safeText(roleLabel)}</span></p><p><b>Saldo:</b> $${formatMoney(u.balance)}</p><p><b>Estado:</b> ${statusChip}</p><p><b>Último movimiento:</b> ${u.last_activity_at ? safeText(String(u.last_activity_at).replace('T', ' ').slice(0, 19)) : 'Sin movimientos registrados'}</p><p><b>Movimientos 2 meses:</b> ${Number(u.movements_2m || 0)}</p>${manageButtons}</div>`;
      }).join('') : 'No hay usuarios.';
    }
  }catch(e){
    console.warn('Error cargando usuarios del panel admin', e);
    if(box) box.textContent = 'No se pudieron cargar los usuarios.';
  }
}

function getRequiredFieldsFromInput(id){return document.getElementById(id).value.split(',').map(normalizeFieldName).filter(Boolean)}
// ===============================
// FIX REPORTE VENTAS HOY ADMIN
// El dashboard siempre consulta el día actual del servidor en horario México.
// El filtro de fecha del panel se conserva solo cuando el admin selecciona una fecha.
// ===============================


// La navegación se administra únicamente desde showSection y sus hooks registrados.

// Auto-refresh periódico desactivado: las secciones se actualizan solo después de acciones.
// setInterval(()=>{
//   if(currentUser?.role==='admin') loadSalesReport(true);
// }, 60000);




// ===============================
// FIX FINAL: reporte de ventas con costo y ganancia real
// ===============================


function populatePlatformProductSelect(){
  const sel=document.getElementById('platformProductSelect');
  if(!sel)return;
  const current=sel.value;
  const products=(allProducts||[]);
  sel.innerHTML='<option value="">Selecciona producto/plataforma</option>'+products.map(p=>`<option value="${p.id}">${safeText(p.name)}${p.category?` · ${safeText(p.category)}`:''}</option>`).join('');
  if(current)sel.value=current;
}

// Variables globales de paginación para paneles pesados
const ADMIN_TABLE_PAGE_LIMIT = 50;

function renderTablePager(container, pagerId, page, totalPages, prevFn, nextFn){
  if(!container) return;
  let pager=document.getElementById(pagerId);
  if(!pager){
    pager=document.createElement('div');
    pager.id=pagerId;
    pager.className='table-pagination';
    container.parentNode?.appendChild(pager);
  }
  const safePage=Math.max(1, Number(page||1));
  const safeTotal=Math.max(1, Number(totalPages||1));
  const disabledPrev=safePage<=1 ? 'disabled' : '';
  const disabledNext=safePage>=safeTotal ? 'disabled' : '';
  pager.innerHTML=`<button class="outline-btn" style="width:100%" ${disabledPrev} onclick="${prevFn}()">◀ Anterior</button><div class="pager-status">Página ${safePage} de ${safeTotal}</div><button class="outline-btn" style="width:100%" ${disabledNext} onclick="${nextFn}()">Siguiente ▶</button>`;
}

window.goInventoryPagePrev = function(){
  if(currentInventoryPage>1) loadPlatformInventory(currentInventoryPage-1);
};

window.goInventoryPageNext = function(){
  loadPlatformInventory(currentInventoryPage+1);
};

function bindInventoryPaginationControls(){
  const prevBtn=document.getElementById('inv-prev-btn');
  const nextBtn=document.getElementById('inv-next-btn');
  if(!prevBtn || !nextBtn || prevBtn.dataset.boundInvPager==='1') return;

  prevBtn.dataset.boundInvPager='1';
  prevBtn.onclick=function(){
    if(currentInventoryPage<=1) return;
    currentInventoryPage-=1;
    loadPlatformInventory(currentInventoryPage);
  };

  nextBtn.onclick=function(){
    currentInventoryPage+=1;
    loadPlatformInventory(currentInventoryPage);
  };
}

function updateInventoryPagerInfo(page,totalPages){
  const prevBtn=document.getElementById('inv-prev-btn');
  const nextBtn=document.getElementById('inv-next-btn');
  const info=document.getElementById('inv-page-info');
  const safePage=Math.max(1, Number(page||1));
  const safeTotal=Math.max(1, Number(totalPages||1));
  if(info) info.textContent=`Página ${safePage} de ${safeTotal}`;
  if(prevBtn) prevBtn.disabled=safePage<=1;
  if(nextBtn) nextBtn.disabled=safePage>=safeTotal;
}

window.loadPlatformInventory = async function(page = currentInventoryPage) {
  if(currentUser?.role !== 'admin') return;
  try {
    if(!__productsLoadedOnce && typeof loadProducts === 'function') await loadProducts();
    populatePlatformProductSelect();
    
    const countEl = document.getElementById('adminPlatformAccountsCount');
    const summaryBox = document.getElementById('platformStockSummary');
    const listBox = document.getElementById('platformAccountsList') || document.getElementById('adminPlatformAccountsList');

    if(!listBox){
      throw new Error('No se encontró el contenedor de inventario (platformAccountsList).');
    }

    if(listBox) listBox.innerHTML = '<p class="small-text">Cargando inventario...</p>';

    const payload = await api(`/api/admin/platform-accounts?page=${Math.max(1, Number(page||1))}&limit=${ADMIN_TABLE_PAGE_LIMIT}`);
    const accounts = Array.isArray(payload?.rows) ? payload.rows : [];
    currentInventoryPage = Number(payload?.page || 1);
    const totalPages = Number(payload?.totalPages || 1);
    bindInventoryPaginationControls();
    updateInventoryPagerInfo(currentInventoryPage, totalPages);

    // --- CONTEO Y RESUMEN ---
    if(countEl) countEl.textContent = Number(payload?.summary?.available || 0);

    if(summaryBox) {
      const rows = Array.isArray(payload?.productSummary) ? payload.productSummary : [];
      summaryBox.innerHTML = rows.length 
        ? `<div class="table-wrap"><table class="mini-table"><thead><tr><th>Plataforma</th><th>Disponibles</th><th>Entregadas</th><th>Vendidas fuera</th><th>Fallidas</th><th>Total</th></tr></thead><tbody>${rows.map(v => {const name=v.product||'Sin plataforma';const available=Number(v.available||0);const delivered=Number(v.delivered||0);const soldOutside=Number(v.sold_outside||0);const failed=Number(v.failed||0);const total=Number(v.total||0);return `<tr><td><b>${safeText(name)}</b>${available<=2?`<br><span class="error">Stock bajo</span>`:''}</td><td class="${available<=0?'error':(available<=2?'status':'success')}">${available}</td><td>${delivered}</td><td>${soldOutside}</td><td>${failed}</td><td>${total}</td></tr>`;}).join('')}</tbody></table></div>` 
        : 'Sin cuentas.';
    }

    // --- LISTA COMPLETA ---
    if(listBox) {
      listBox.innerHTML = accounts.length 
        ? `<div class="table-wrap"><table class="mini-table"><thead><tr><th>ID</th><th>Producto</th><th>Correo / contraseña</th><th>Perfil / PIN</th><th>URL</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>${accounts.map(a => renderPlatformAccountRow(a)).join('')}</tbody></table></div>` 
        : 'Sin cuentas.';
    }
  } catch(e) {
    showMessage(e.message || 'Error cargando inventario', 'error');
  }
}


async function verHistorialRecuperacion() {
  const res = await fetch('/api/admin/recovery-history', { 
    headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') } 
  });
  const data = await res.json();
  // Aquí puedes dibujar una tabla con 'data' usando el mismo estilo de modal que ya tienes
}

function renderPlatformAccountRow(a){
  const statuses=['available','delivered','failed','sold_outside','reserved'];
  return `<tr>
    <td>${a.id}</td>
    <td><b>${safeText(a.product_name||a.platform||'')}</b><br><span class="small-text">${safeText(a.platform||'')}</span></td>
    <td><input id="pa-email-${a.id}" value="${safeText(a.account_email||'')}" placeholder="Correo"/><input id="pa-pass-${a.id}" value="${safeText(a.account_password||'')}" placeholder="Contraseña"/></td>
    <td><input id="pa-profile-${a.id}" value="${safeText(a.profile_name||'')}" placeholder="Perfil"/><input id="pa-pin-${a.id}" value="${safeText(a.profile_pin||'')}" placeholder="PIN"/></td>
    <td><input id="pa-url-${a.id}" value="${safeText(a.access_url||'')}" placeholder="URL opcional"/></td>
    <td><select id="pa-status-${a.id}">${statuses.map(st=>`<option value="${st}" ${a.status===st?'selected':''}>${st}</option>`).join('')}</select></td>
    <td><button class="primary-btn" style="width:auto;margin-bottom:6px" onclick="updatePlatformAccount(${a.id}, '${safeText(a.product_name||a.platform||'')}')">Guardar</button><br><button class="muted-btn" style="width:auto" onclick="markPlatformAccountSoldOutside(${a.id})">Vendido por fuera</button></td>
  </tr>`;
}

// Nota: Esta función la dejamos casi intacta, solo le inyectamos la variable "currentInventoryPage" 
// al final para que cuando guardes un cambio, NO te regrese a la página 1 a la fuerza.
async function updatePlatformAccount(id, productName){
  try{
    const payload = {
      platform: productName,
      product_name: productName,
      account_email: (document.getElementById('pa-email-'+id)?.value || '').trim(),
      account_password: (document.getElementById('pa-pass-'+id)?.value || '').trim(),
      profile_name: (document.getElementById('pa-profile-'+id)?.value || '').trim(),
      profile_pin: (document.getElementById('pa-pin-'+id)?.value || '').trim(),
      access_url: (document.getElementById('pa-url-'+id)?.value || '').trim(),
      status: document.getElementById('pa-status-'+id)?.value || 'available'
    };
    const data = await api('/api/admin/platform-accounts/'+id, {method:'PATCH', body:JSON.stringify(payload)});
    showMessage(data.message || 'Cuenta actualizada');
    
    // Aquí es donde recarga, pero manteniéndote en tu página actual
    await loadPlatformInventory(currentInventoryPage);
  } catch(e) {
    showMessage(e.message || 'Error actualizando cuenta', 'error');
  }
}

async function markPlatformAccountSoldOutside(id){
  if(!confirm('¿Marcar esta cuenta/perfil como vendido por fuera? Ya no se entregará automáticamente.'))return;
  try{
    const data=await api('/api/admin/platform-accounts/'+id+'/sold-outside',{method:'POST',body:JSON.stringify({})});
    showMessage(data.message||'Marcada como vendida por fuera');
    await loadPlatformInventory();
  }catch(e){showMessage(e.message||'Error marcando vendido por fuera','error')}
}


async function createPlatformAccount(){
  try{
    const productId=document.getElementById('platformProductSelect')?.value;
    const product=(allProducts||[]).find(p=>String(p.id)===String(productId));
    if(!product)throw new Error('Selecciona un producto/plataforma');
    
    // 1. CAPTURAMOS LA CASILLA REUSABLE Y LA NUEVA FECHA
    const isReusable = document.getElementById('platformReusable')?.checked || false;
    const officialPurchaseDate = (document.getElementById('officialPurchaseDate')?.value || '').trim();
    
    const email=(document.getElementById('platformEmail')?.value||'').trim();
    const password=(document.getElementById('platformPassword')?.value||'').trim();
    const accessUrl=(document.getElementById('platformAccessUrl')?.value||'').trim();
    
    // 2. CORREGIMOS LA VALIDACIÓN: Si NO es reusable, exige correo y contraseña.
    // Si ES reusable, exige que al menos pongas el Link (access_url)
    if (!isReusable && (!email || !password)) {
      throw new Error('Correo y contraseña son obligatorios para cuentas normales');
    }
    if (isReusable && !accessUrl) {
      throw new Error('Para un producto digital/PDF, debes pegar la URL del archivo');
    }

    // 3. ENVIAMOS LOS DATOS
    await api('/api/admin/platform-accounts',{
      method:'POST',
      body:JSON.stringify({
        platform:product.name,
        product_name:product.name,
        account_email:email,
        account_password:password,
        profile_name:(document.getElementById('platformProfile')?.value||'').trim(),
        profile_pin:(document.getElementById('platformPin')?.value||'').trim(),
        access_url:accessUrl,
        extra_data:'',
        terms_conditions:'',
        reusable: isReusable ? 1 : 0,
        official_purchase_date: officialPurchaseDate || null // <-- NUEVO DATO ENVIADO AL SERVIDOR
      })
    });
    
    showMessage('Cuenta o Link agregado correctamente');
    
    // 4. LIMPIAMOS EL FORMULARIO
    if(document.getElementById('platformEmail')) document.getElementById('platformEmail').value='';
    if(document.getElementById('platformPassword')) document.getElementById('platformPassword').value='';
    if(document.getElementById('platformProfile')) document.getElementById('platformProfile').value='';
    if(document.getElementById('platformPin')) document.getElementById('platformPin').value='';
    if(document.getElementById('officialPurchaseDate')) document.getElementById('officialPurchaseDate').value=''; // <-- LIMPIA LA FECHA
    if(document.getElementById('platformAccessUrl')) document.getElementById('platformAccessUrl').value='';
    if(document.getElementById('platformReusable')) document.getElementById('platformReusable').checked=false;
    
    await loadPlatformInventory();
  }catch(e){
    showMessage(e.message||'Error guardando cuenta','error')
  }
}


function calculateReportRefundInfo(report){
  const amount=Number(report.order_amount||0);
  if(!report.order_created_at||!amount)return {daysUsed:0,daysRemaining:0,refund:0};
  const purchase=new Date(report.order_created_at);
  const now=new Date();
  const msPerDay=24*60*60*1000;
  const daysUsed=Math.max(0,Math.min(28,Math.ceil((now-purchase)/msPerDay)));
  const daysRemaining=Math.max(0,28-daysUsed);
  const refund=Math.round(((amount/28)*daysRemaining)*100)/100;
  return {daysUsed,daysRemaining,refund};
}

const __reportActionBusy = new Set();


// Reemplazo automático desde inventario
async function replaceReportedAccountAuto(reportId){
  if(__reportActionBusy.has(Number(reportId))) return;
  __reportActionBusy.add(Number(reportId));
  try{
    if(!confirm('¿Reemplazar esta cuenta usando una cuenta disponible del inventario automático?')) return;

    let reportedAccountId = 0;
    try {
      const comboData = await api('/api/admin/account-reports/'+reportId+'/order-accounts');
      const accounts = Array.isArray(comboData?.accounts) ? comboData.accounts : [];
      const exactReportedAccountId = Number(comboData?.reported_account_id || 0);
      if (exactReportedAccountId > 0) {
        reportedAccountId = exactReportedAccountId;
      } else if (accounts.length === 1) {
        reportedAccountId = Number(accounts[0]?.id || 0);
      } else if (accounts.length > 1) {
        const list = accounts.map((a,i)=>`${i+1}) ${a.platform||a.product_name||'Plataforma'} | ${a.account_email||''}${a.profile_name?' | Perfil: '+a.profile_name:''} | Estado: ${a.status||'n/a'}`).join('\n');
        const ans = prompt('Selecciona qué cuenta/plataforma del combo será reemplazada:\n\n'+list);
        if(ans===null) throw new Error('Reemplazo cancelado');
        const idx = Number(ans)-1;
        if(!Number.isInteger(idx)||idx<0||idx>=accounts.length) throw new Error('Opción inválida');
        reportedAccountId = Number(accounts[idx]?.id || 0);
      }
    } catch (e) {
      if (e?.message) throw e;
    }

    const query = reportedAccountId ? ('?reported_account_id='+reportedAccountId) : '';
    const optionsData = await api('/api/admin/account-reports/'+reportId+'/replacement-options'+query);
    const options = Array.isArray(optionsData?.options) ? optionsData.options : [];
    if(!options.length) throw new Error('No hay cuentas disponibles para esa plataforma. Captura manualmente una cuenta.');

    const list = options.map((a,i)=>`${i+1}) ${a.platform||a.product_name||'Plataforma'} | ${a.account_email||''}${a.profile_name?' | Perfil: '+a.profile_name:''}`).join('\n');
    const pick = prompt('Selecciona la cuenta disponible para entregar:\n\n'+list);
    if(pick===null) throw new Error('Reemplazo cancelado');
    const idx = Number(pick)-1;
    if(!Number.isInteger(idx)||idx<0||idx>=options.length) throw new Error('Opción inválida');

    const body = {
      manual:false,
      replacement_account_id: Number(options[idx].id)
    };
    if(reportedAccountId) body.reported_account_id = reportedAccountId;

    const data = await api('/api/admin/account-reports/'+reportId+'/replace',{method:'POST',body:JSON.stringify(body)});
    showMessage(data.message||'Cuenta reemplazada desde inventario');
    if(data?.delivered_account_data && typeof window.showReplacementCopyBox === 'function'){
      window.showReplacementCopyBox(data.delivered_account_data);
    }
    await loadAccountReports();
    if(typeof loadPlatformInventory === 'function') await loadPlatformInventory();
    if(typeof loadAdminOrders === 'function') await loadAdminOrders();
  }catch(e){showMessage(e.message||'Error reemplazando cuenta','error')}
  finally{__reportActionBusy.delete(Number(reportId));}
}

// Reemplazo manual con formulario modal
function replaceReportedAccountManual(reportId){
  const old = document.getElementById('replaceManualModal'); if(old) old.remove();
  const html = `
    <div id="replaceManualModal" class="modal-overlay">
      <div class="modal-card" style="max-width:720px;">
        <div style="display:flex;justify-content:space-between;align-items:center"><h3>Reemplazo manual</h3><button class="modal-close-btn" onclick="document.getElementById('replaceManualModal')?.remove()">×</button></div>
        <p class="small-text">Ingresa los datos de la cuenta nueva. La fecha original de compra y el vencimiento de 28 días se heredarán automáticamente del pedido.</p>
        <label class="field-label">Correo</label><input id="rm_email" type="email" />
        <label class="field-label">Contraseña</label><input id="rm_password" type="text" />
        <label class="field-label">Perfil (opcional)</label><input id="rm_profile" />
        <label class="field-label">PIN (opcional)</label><input id="rm_pin" />
        <label class="field-label">URL / Nota (opcional)</label><input id="rm_url" />
        <div style="display:flex;gap:8px;margin-top:12px">
          <button class="green-btn" onclick="submitReplaceManual(${reportId})">Aplicar reemplazo</button>
          <button class="outline-btn" onclick="document.getElementById('replaceManualModal')?.remove()">Cancelar</button>
        </div>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', html);
}

async function submitReplaceManual(reportId){
  if(__reportActionBusy.has(Number(reportId))) return;
  __reportActionBusy.add(Number(reportId));
  try{
    const account_email=(document.getElementById('rm_email')?.value||'').trim();
    const account_password=(document.getElementById('rm_password')?.value||'').trim();
    const profile_name=(document.getElementById('rm_profile')?.value||'').trim();
    const profile_pin=(document.getElementById('rm_pin')?.value||'').trim();
    const access_url=(document.getElementById('rm_url')?.value||'').trim();

    if(!account_email || !account_password){
      throw new Error('Correo y contraseña son obligatorios para reemplazo manual.');
    }

    const body = {
      manual:true,
      account_email,
      account_password,
      profile_name,
      profile_pin,
      access_url
    };

    const data = await api('/api/admin/account-reports/'+reportId+'/replace',{
      method:'POST',
      body: JSON.stringify(body)
    });

    showMessage(data.message||'Cuenta reemplazada manualmente');
    if(data?.delivered_account_data && typeof window.showReplacementCopyBox === 'function'){
      window.showReplacementCopyBox(data.delivered_account_data);
    }
    document.getElementById('replaceManualModal')?.remove();
    await loadAccountReports();
    if(typeof loadPlatformInventory === 'function') await loadPlatformInventory();
    if(typeof loadAdminOrders === 'function') await loadAdminOrders();
  }catch(e){
    showMessage(e.message||'Error aplicando reemplazo manual','error');
  }
  finally{__reportActionBusy.delete(Number(reportId));}
}

// Reembolso proporcional para reportes de falla
async function refundReportedAccount(reportId, orderCreatedAt){
  if(__reportActionBusy.has(Number(reportId))) return;
  __reportActionBusy.add(Number(reportId));
  try{
    const dateLabel = orderCreatedAt ? `\nFecha del pedido: ${String(orderCreatedAt).slice(0,10)}` : '';
    if(!confirm(`¿Aplicar reembolso proporcional a este reporte?${dateLabel}`)) return;

    const data = await api('/api/admin/account-reports/'+reportId+'/refund-proportional', {
      method:'POST',
      body: JSON.stringify({})
    });

    showMessage(data.message || 'Reembolso proporcional aplicado');
    await loadAccountReports();
    if(typeof loadUsers === 'function') await loadUsers();
  }catch(e){
    showMessage(e.message || 'Error aplicando reembolso proporcional', 'error');
  }
  finally{__reportActionBusy.delete(Number(reportId));}
}

// Reembolso completo para reportes de falla
async function refundFullReportedAccount(reportId){
  if(__reportActionBusy.has(Number(reportId))) return;
  __reportActionBusy.add(Number(reportId));
  try{
    if(!confirm('¿Aplicar reembolso completo a este reporte?')) return;

    const data = await api('/api/admin/account-reports/'+reportId+'/refund-full', {
      method:'POST',
      body: JSON.stringify({})
    });

    showMessage(data.message || 'Reembolso completo aplicado');
    await loadAccountReports();
    if(typeof loadUsers === 'function') await loadUsers();
  }catch(e){
    showMessage(e.message || 'Error aplicando reembolso completo', 'error');
  }
  finally{__reportActionBusy.delete(Number(reportId));}
}

window.replaceReportedAccountManual = replaceReportedAccountManual;
window.submitReplaceManual = submitReplaceManual;
window.replaceReportedAccountAuto = replaceReportedAccountAuto;
window.refundReportedAccount = refundReportedAccount;
window.refundFullReportedAccount = refundFullReportedAccount;



// ===============================
// COMBOS AUTOMÁTICOS - OVERRIDES
// ===============================
function getSelectedComboItems(prefix) {
  return Array.from(document.querySelectorAll(`input[data-combo-${prefix}]:checked`))
    .map(input => Number(input.value))
    .filter(value => Number.isInteger(value) && value > 0);
}

function renderComboOptions(containerId, selectedIds = [], prefix = "create", excludeId = null) {
  const box = document.getElementById(containerId);
  if (!box) return;
  const selected = new Set((selectedIds || []).map(Number));
  const options = (allProducts || [])
    .filter(p => Number(p.id) !== Number(excludeId))
    .filter(p => String(p.product_type || "streaming_auto") !== "combo_auto")
    .map(p => `
      <label class="checkbox-row">
        <input type="checkbox" data-combo-${prefix}="1" value="${p.id}" ${selected.has(Number(p.id)) ? "checked" : ""} />
        ${safeText(p.name)} - $${formatMoney(p.price)}
      </label>
    `).join("");
  box.innerHTML = options || "No hay productos individuales para agregar al combo.";
}

function toggleComboCreateBox() {
  const isCombo = document.getElementById("productType")?.value === "combo_auto";
  const box = document.getElementById("createComboBox");
  if (box) box.classList.toggle("hidden", !isCombo);
  if (isCombo) renderComboOptions("productComboItemsBox", [], "create");
}

function toggleComboEditBox(id) {
  const isCombo = document.getElementById(`editProductType-${id}`)?.value === "combo_auto";
  const box = document.getElementById(`editComboBox-${id}`);
  if (box) box.classList.toggle("hidden", !isCombo);
  if (isCombo) {
    const product = (allProducts || []).find(p => Number(p.id) === Number(id));
    renderComboOptions(`editComboItemsBox-${id}`, parseJsonArray(product?.combo_items), `edit-${id}`, id);
  }
}

// Funciones de comercio admin movidas a admin-commerce.js


// ===============================
// FIX FINAL: UI de combos y garantía visible
// ===============================
function ensureComboCreateControls(){
  const createBox=document.getElementById('createProductBox');
  if(!createBox)return;
  if(!document.getElementById('productType')){
    const charge=document.getElementById('productChargeMode');
    if(charge){
      const wrapper=document.createElement('div');
      wrapper.innerHTML=`
        <label class="field-label">Tipo de producto</label>
        <select id="productType" onchange="toggleComboCreateBox()">
          <option value="streaming_auto">Automático streaming</option>
          <option value="manual">Manual</option>
          <option value="combo_auto">Combo automático</option>
        </select>
        <div id="createComboBox" class="hidden">
          <label class="field-label">Descuento por plataforma incluida</label>
          <input id="productComboDiscount" type="number" step="0.01" value="5" />
          <label class="field-label">Productos incluidos en el combo</label>
          <div id="productComboItemsBox" class="order-data">Primero carga productos.</div>
          <p class="small-text">El combo entrega una cuenta disponible de cada producto seleccionado. Si falta stock de una plataforma, no cobra.</p>
        </div>`;
      charge.parentNode.insertBefore(wrapper, charge.previousElementSibling || charge);
    }
  }
  if(document.getElementById('productType')){
    renderComboOptions('productComboItemsBox', [], 'create');
    toggleComboCreateBox();
  }
}

function hasAccountDelivery(order){
  const text=getAccountTextFromOrder(order);
  if(!text)return false;
  const hasHeader = /Cuenta de Streaming Entregada|Entrega Digital Inmediata|Combo Streaming|Cuenta entregada/i.test(text);
  const hasEmail = /(?:Correo|📧\s*Correo):\s*[^\s\n]+/i.test(text);
  const hasPassword = /(?:Contraseña|Password|🔐\s*Contraseña):\s*[^\n]*/i.test(text);
  const hasAccessLink = /(?:Enlace de acceso\/descarga|URL para código\/soporte|🔗\s*(?:Enlace|URL))/i.test(text);
  return hasHeader || hasEmail || hasPassword || hasAccessLink;
}

function getWarrantyInfoFromOrder(o){
  const raw=String(o.delivered_account_data||o.admin_response||'');
  const m=raw.match(/Fecha (?:original de compra|de entrega):\s*(\d{2})\/(\d{2})\/(\d{2,4})/i);
  let start=o.created_at?new Date(o.created_at):null;
  if(m){
    const day=Number(m[1]), month=Number(m[2])-1, year=Number(m[3].length===2?'20'+m[3]:m[3]);
    start=new Date(year,month,day);
  }
  if(!start||isNaN(start.getTime()))return null;
  const end=new Date(start);end.setDate(end.getDate()+28);
  const today=new Date();
  const msDay=24*60*60*1000;
  const daysRemaining=Math.max(0,Math.ceil((end-today)/msDay));
  const daysUsed=Math.min(28,Math.max(0,28-daysRemaining));
  return {start,end,daysRemaining,daysUsed,active:daysRemaining>0};
}

function shouldShowWarranty(o){
  const cat=String(o.product_category||o.product_category_snapshot||'').toLowerCase();
  const name=String(o.product_name||o.product_name_snapshot||'').toLowerCase();
  const raw=String(o.delivered_account_data||o.admin_response||'');
  return hasAccountDelivery(o) || cat.includes('plataforma') || cat.includes('combo') || name.includes('combo') || /Fecha de entrega:/i.test(raw);
}

function renderWarrantyNotice(o){
  if(!shouldShowWarranty(o))return '';
  const w=getWarrantyInfoFromOrder(o);
  if(!w)return '';
  return `<div class="order-data"><b>Estado de garantía:</b><p style="margin:5px 0"><b>Entrega:</b> ${w.start.toLocaleDateString('es-MX')} &nbsp; <b>Vence:</b> ${w.end.toLocaleDateString('es-MX')} &nbsp; <b>Días restantes:</b> <span class="${w.active?'success':'error'}">${w.daysRemaining}</span></p></div>`;
}

function renderMyOrders(){
  const rows=[...(myOrders||[])];
  if(!myOrdersList) return;
  myOrdersList.innerHTML=rows.map(o=>{
    const data=parseJsonObject(o.order_data);
    const currentAccountsHtml=typeof renderCurrentOrderAccounts==='function' ? renderCurrentOrderAccounts(o) : '';
    const currentDeliveryText=typeof getAccountTextFromOrder==='function' ? getAccountTextFromOrder(o) : String(o.delivered_account_data||o.admin_response||'');
    const copyButton=hasAccountDelivery(o)?`<button class="copy-account-btn" onclick="copyAccountDataFromOrder(${o.id}, 'my')">📋 Copiar datos de cuenta vigente</button>`:'';
    return `<div class="item"><p><b>Pedido:</b> #${o.id}</p><p><b>Producto:</b> ${safeText(o.product_name)}</p><p><b>Monto:</b> $${formatMoney(o.amount)}</p><p><b>Estado:</b> <span class="status">${safeText(getStatusText(o.status))}</span></p>${currentAccountsHtml}${renderWarrantyNotice(o)}${renderOrderData(data, o.id)}<p><b>Entrega / respuesta vigente:</b></p><div class="response-text">${safeText(currentDeliveryText||'Sin respuesta todavía')}</div>${copyButton}</div>`;
  }).join('')||'No hay pedidos con esos filtros.';
}

function openInventoryHistory() {
  if (!canAccessInventoryHistory()) {
    if (typeof showMessage === 'function') showMessage('Solo el distribuidor puede ver el historial de inventario', 'error');
    return;
  }
  showSection('inventory-history');

  const input = document.getElementById('inventorySearchInput');
  const summary = document.getElementById('inventoryHistorySummary');
  const timelinePanel = document.getElementById('inventoryHistoryTimeline');
  const timelineItems = document.getElementById('inventoryTimelineItems');

  if (input) input.value = '';
  if (summary) summary.classList.add('hidden');
  if (timelinePanel) timelinePanel.classList.add('hidden');
  if (timelineItems) timelineItems.innerHTML = 'Sin información.';
  setTimeout(() => document.getElementById('section-inventory-history')?.scrollIntoView({behavior:'smooth', block:'start'}), 100);
}

async function searchInventoryHistory() {
  const input = document.getElementById('inventorySearchInput');
  const query = String(input?.value || '').trim();
  const timelineItems = document.getElementById('inventoryTimelineItems');
  const summary = document.getElementById('inventoryHistorySummary');
  const timelinePanel = document.getElementById('inventoryHistoryTimeline');

  if (!query) {
    alert('Por favor ingresa un correo madre, correo de cliente, nombre, perfil, PIN o número de pedido para buscar la historia de inventario.');
    return;
  }

  if (timelineItems) timelineItems.innerHTML = '<p>Buscando historial...</p>';
  if (summary) summary.classList.add('hidden');
  if (timelinePanel) timelinePanel.classList.add('hidden');

  try {
    const response = await api(`/api/admin/inventory-history?q=${encodeURIComponent(query)}`);

    if (!response.events || response.events.length === 0) {
      if (timelineItems) timelineItems.innerHTML = '<p>No se encontraron registros para esta cuenta madre.</p>';
      if (timelinePanel) timelinePanel.classList.remove('hidden');
      return;
    }

    renderInventoryHistorySummary(response.events);
    renderInventoryHistoryTimeline(response.events);
    renderInventoryHistoryModal(response.events);
    openInventoryHistoryModal();
    if (summary) summary.classList.remove('hidden');
    if (timelinePanel) timelinePanel.classList.remove('hidden');
  } catch (error) {
    if (timelineItems) timelineItems.innerHTML = `<p style="color:red;">Error: ${safeText(error.message)}</p>`;
    if (timelinePanel) timelinePanel.classList.remove('hidden');
  }
}

function parseInventoryHistoryDate(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;

  let match = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (match) {
    const date = new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatInventoryHistoryDate(value) {
  const date = value instanceof Date ? value : parseInventoryHistoryDate(value);
  return date ? date.toLocaleDateString('es-MX') : '-';
}

function getInventoryHistoryOfficialDate(evento) {
  return evento?.fecha_original_cuenta_madre
    || evento?.cycle_official_purchase_date
    || evento?.official_purchase_date
    || evento?.fecha_compra
    || evento?.stored_official_purchase_date
    || '';
}

function getInventoryHistoryExpirationDate(evento) {
  return evento?.vencimiento_cuenta_madre
    || evento?.mother_account_expiration
    || evento?.expiration_date
    || evento?.expires_at
    || '';
}

function getInventoryHistoryCycleDateKey(evento) {
  const date = parseInventoryHistoryDate(getInventoryHistoryOfficialDate(evento));
  if (!date) return 'sin-fecha';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getInventoryHistoryCycleKey(evento) {
  const motherAccountId = evento?.cuenta_madre_id ?? evento?.mother_account_id;
  if (motherAccountId !== null && motherAccountId !== undefined && String(motherAccountId).trim() !== '') {
    return `mother:${String(motherAccountId).trim()}`;
  }

  const email = String(evento?.cuenta_madre || evento?.account_email || '').trim().toLowerCase();
  return `legacy:${email}||${getInventoryHistoryCycleDateKey(evento)}`;
}

function getInventoryHistoryTimestamp(value) {
  const date = new Date(value || '');
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function sortInventoryHistoryEvents(eventos) {
  return [...(Array.isArray(eventos) ? eventos : [])].sort((a, b) => {
    const officialA = parseInventoryHistoryDate(getInventoryHistoryOfficialDate(a))?.getTime() || 0;
    const officialB = parseInventoryHistoryDate(getInventoryHistoryOfficialDate(b))?.getTime() || 0;
    if (officialA !== officialB) return officialB - officialA;

    const createdA = getInventoryHistoryTimestamp(a?.created_at || a?.fecha_ingreso);
    const createdB = getInventoryHistoryTimestamp(b?.created_at || b?.fecha_ingreso);
    return createdB - createdA;
  });
}

function groupInventoryHistoryCycles(eventos) {
  const sortedRows = sortInventoryHistoryEvents(eventos);
  const cycleMap = new Map();

  sortedRows.forEach(evento => {
    const key = getInventoryHistoryCycleKey(evento);
    if (!cycleMap.has(key)) {
      cycleMap.set(key, {
        key,
        email: String(evento?.cuenta_madre || evento?.account_email || '').trim(),
        motherAccountId: evento?.cuenta_madre_id ?? evento?.mother_account_id ?? '',
        replacesMotherAccountId: evento?.reemplaza_cuenta_madre_id ?? '',
        officialDate: getInventoryHistoryOfficialDate(evento),
        expirationDate: getInventoryHistoryExpirationDate(evento),
        motherStatus: evento?.mother_account_status || '',
        totalProfiles: Number(evento?.total_perfiles || 0),
        latestCreatedAt: getInventoryHistoryTimestamp(evento?.created_at || evento?.fecha_ingreso),
        events: []
      });
    }

    const cycle = cycleMap.get(key);
    cycle.events.push(evento);
    cycle.totalProfiles = Math.max(cycle.totalProfiles, Number(evento?.total_perfiles || 0));
    cycle.latestCreatedAt = Math.max(cycle.latestCreatedAt, getInventoryHistoryTimestamp(evento?.created_at || evento?.fecha_ingreso));
    if (!cycle.officialDate) cycle.officialDate = getInventoryHistoryOfficialDate(evento);
    if (!cycle.expirationDate) cycle.expirationDate = getInventoryHistoryExpirationDate(evento);
    if (!cycle.motherStatus) cycle.motherStatus = evento?.mother_account_status || '';
  });

  return Array.from(cycleMap.values()).sort((a, b) => {
    const officialA = parseInventoryHistoryDate(a.officialDate)?.getTime() || 0;
    const officialB = parseInventoryHistoryDate(b.officialDate)?.getTime() || 0;
    if (officialA !== officialB) return officialB - officialA;
    return b.latestCreatedAt - a.latestCreatedAt;
  });
}

function isInventoryHistoryUnassigned(evento) {
  const status = String(evento?.status || '').trim().toLowerCase();
  const hasAssignedUser = evento?.assigned_user_id !== null
    && evento?.assigned_user_id !== undefined
    && String(evento.assigned_user_id).trim() !== '';
  const hasAssignedOrder = evento?.assigned_order_id !== null
    && evento?.assigned_order_id !== undefined
    && String(evento.assigned_order_id).trim() !== '';
  const hasOrder = evento?.orden_id !== null
    && evento?.orden_id !== undefined
    && String(evento.orden_id).trim() !== '';
  const hasSeller = String(evento?.comprador_nombre || evento?.comprador_email || '').trim() !== '';
  const availableStatus = !status || ['available', 'disponible'].includes(status);
  return availableStatus && !hasAssignedUser && !hasAssignedOrder && !hasOrder && !hasSeller;
}

function countInventoryHistoryProfiles(eventos) {
  const profileKeys = new Set();
  const rows = Array.isArray(eventos) ? eventos : [];

  rows.forEach((evento, index) => {
    const profileId = evento?.perfil_id ?? evento?.platform_account_id ?? evento?.id;
    if (profileId !== null && profileId !== undefined && String(profileId).trim() !== '') {
      profileKeys.add(`id:${profileId}`);
      return;
    }

    const profileName = String(evento?.profile_name || '').trim();
    const profilePin = String(evento?.profile_pin || '').trim();
    if (profileName || profilePin) profileKeys.add(`profile:${profileName}|${profilePin}`);
    else profileKeys.add(`row:${index}`);
  });
  return profileKeys.size;
}

function getInventoryHistoryCycleTotal(cycle) {
  const serverTotal = Number(cycle?.totalProfiles || 0);
  return serverTotal > 0 ? serverTotal : countInventoryHistoryProfiles(cycle?.events || []);
}

function getInventoryHistoryCycleExpiration(cycle) {
  const storedExpiration = parseInventoryHistoryDate(cycle?.expirationDate);
  if (storedExpiration) return storedExpiration;

  const officialDate = parseInventoryHistoryDate(cycle?.officialDate);
  if (!officialDate) return null;
  const calculated = new Date(officialDate);
  calculated.setDate(calculated.getDate() + 30);
  return calculated;
}

function renderInventoryHistorySummary(events) {
  const cycles = groupInventoryHistoryCycles(events);
  const currentCycle = cycles[0] || { events: [] };
  const currentEvents = currentCycle.events;
  const firstEvent = currentEvents[0] || {};
  const lastEvent = currentEvents[currentEvents.length - 1] || firstEvent;
  const fechaIngreso = firstEvent.fecha_ingreso ? new Date(firstEvent.fecha_ingreso) : null;
  const fechaVencimiento = getInventoryHistoryCycleExpiration(currentCycle);
  const diasRestantes = fechaVencimiento ? Math.max(0, Math.ceil((fechaVencimiento - new Date()) / (1000 * 60 * 60 * 24))) : '-';
  const explicitStatus = String(currentCycle.motherStatus || '').trim().toLowerCase();
  const estado = ['replaced', 'reemplazada', 'reemplazado', 'inactive', 'inactiva'].includes(explicitStatus)
    ? 'Reemplazada'
    : ['active', 'activa'].includes(explicitStatus)
      ? 'Activa'
      : lastEvent.status === 'failed' || lastEvent.orden_status === 'failed'
        ? 'Reemplazo / Falla'
        : lastEvent.orden_id
          ? 'Venta normal'
          : 'En inventario';

  document.getElementById('inventoryEmail').textContent = firstEvent.cuenta_madre || '-';
  document.getElementById('inventoryProfile').textContent = firstEvent.profile_name || '-';
  document.getElementById('inventoryPlatform').textContent = firstEvent.platform || firstEvent.product_name || '-';
  document.getElementById('inventoryStatus').textContent = estado;
  document.getElementById('inventoryEntered').textContent = fechaIngreso ? fechaIngreso.toLocaleDateString('es-MX') : '-';
  document.getElementById('inventoryExpire').textContent = formatInventoryHistoryDate(fechaVencimiento);
  document.getElementById('inventoryLifeDays').textContent = String(diasRestantes);
  document.getElementById('inventoryEventsCount').textContent = String(getInventoryHistoryCycleTotal(currentCycle));
}

function renderInventoryHistoryEventCard(evento) {
  const fechaIngreso = evento.fecha_ingreso ? new Date(evento.fecha_ingreso) : null;
  const fechaEntrega = evento.fecha_entrega ? new Date(evento.fecha_entrega) : null;
  const ordenCreada = evento.orden_creada ? new Date(evento.orden_creada) : null;
  let fechaVencimiento = parseInventoryHistoryDate(getInventoryHistoryExpirationDate(evento));
  if (!fechaVencimiento) {
    const fechaOficial = parseInventoryHistoryDate(getInventoryHistoryOfficialDate(evento));
    if (fechaOficial) {
      fechaVencimiento = new Date(fechaOficial);
      fechaVencimiento.setDate(fechaVencimiento.getDate() + 30);
    }
  }
  const diasRestantes = fechaVencimiento ? Math.max(0, Math.ceil((fechaVencimiento - new Date()) / (1000 * 60 * 60 * 24))) : '-';
  const eventoTipo = evento.status === 'failed' || evento.orden_status === 'failed' ? 'Reemplazo por falla' : evento.orden_id ? 'Venta normal a vendedor' : 'Ingreso al inventario';
  const vendedor = evento.comprador_nombre ? `${safeText(evento.comprador_nombre)} (${safeText(evento.comprador_email || 'sin email')})` : 'Sin vendedor asignado';
  const perfil = evento.profile_name ? `${safeText(evento.profile_name)}${evento.profile_pin ? ` | PIN: ${safeText(evento.profile_pin)}` : ''}` : 'Sin perfil';
  const pedido = evento.orden_id ? `Pedido #${safeText(evento.orden_id)} (${safeText(evento.orden_status || 'sin estado')})` : 'No vendido aún';

  return `
    <div class="timeline-event">
      <div class="timeline-date">${fechaIngreso ? `Ingreso: ${fechaIngreso.toLocaleDateString('es-MX')} ${fechaIngreso.toLocaleTimeString('es-MX')}` : 'Fecha no disponible'}</div>
      <div class="timeline-title">${safeText(evento.platform || evento.product_name || 'Cuenta madre')}</div>
      <div class="timeline-details">
        <p><strong>Tipo de evento:</strong> ${safeText(eventoTipo)}</p>
        <p><strong>Cuenta madre:</strong> ${safeText(evento.cuenta_madre || 'Sin correo')}</p>
        <p><strong>Perfil vendido:</strong> ${perfil}</p>
        <p><strong>Vendedor:</strong> ${vendedor}</p>
        <p><strong>${pedido}</strong></p>
        ${ordenCreada ? `<p><strong>Fecha de venta:</strong> ${ordenCreada.toLocaleDateString('es-MX')}</p>` : ''}
        ${fechaEntrega ? `<p><strong>Entrega registrada:</strong> ${fechaEntrega.toLocaleDateString('es-MX')}</p>` : ''}
        <p><strong>Estado actual:</strong> ${safeText(evento.status || evento.orden_status || 'Disponible')}</p>
        <p><strong>Vence:</strong> ${fechaVencimiento ? fechaVencimiento.toLocaleDateString('es-MX') : 'No aplica'}</p>
        <p><strong>Días restantes:</strong> ${safeText(String(diasRestantes))}</p>
      </div>
    </div>
  `;
}

function renderInventoryHistoryCycles(eventos) {
  const cycles = groupInventoryHistoryCycles(eventos);

  return cycles.map((cycle, index) => {
    const cycleLabel = index === 0 ? 'Ciclo actual' : 'Ciclo anterior';
    const dateLabel = formatInventoryHistoryDate(cycle.officialDate);
    const expirationLabel = formatInventoryHistoryDate(getInventoryHistoryCycleExpiration(cycle));
    const cycleProfileCount = getInventoryHistoryCycleTotal(cycle);
    return `
      <section class="inventory-history-cycle" data-cycle-key="${safeText(cycle.key)}">
        <div class="timeline-event" style="border-left:4px solid ${index === 0 ? '#2563eb' : '#94a3b8'};padding:12px 14px;margin-bottom:12px;">
          <div class="timeline-title">${safeText(cycleLabel)}</div>
          <div class="timeline-details">
            <p><strong>ID cuenta madre:</strong> ${safeText(String(cycle.motherAccountId || '-'))}</p>
            <p><strong>Reemplaza cuenta madre:</strong> ${safeText(String(cycle.replacesMotherAccountId || '-'))}</p>
            <p><strong>Correo:</strong> ${safeText(cycle.email || 'Sin correo')}</p>
            <p><strong>Fecha oficial de compra:</strong> ${safeText(dateLabel)}</p>
            <p><strong>Vencimiento:</strong> ${safeText(expirationLabel)}</p>
            <p><strong>Perfiles en este ciclo:</strong> ${cycleProfileCount}</p>
          </div>
        </div>
        ${cycle.events.map(renderInventoryHistoryEventCard).join('')}
      </section>
    `;
  }).join('');
}

function renderInventoryHistoryTimeline(eventos) {
  const timelineItems = document.getElementById('inventoryTimelineItems');
  if (!timelineItems) return;
  timelineItems.innerHTML = renderInventoryHistoryCycles(eventos);
}

function renderInventoryHistoryModal(eventos) {
  const summaryModal = document.getElementById('inventoryHistoryModalSummary');
  const timelineModalItems = document.getElementById('inventoryTimelineModalItems');
  if (!summaryModal || !timelineModalItems) return;

  const cycles = groupInventoryHistoryCycles(eventos);
  const currentCycle = cycles[0] || { events: [] };
  const currentEvents = currentCycle.events;

  const findCurrentValue = (...fields) => {
    for (const evento of currentEvents) {
      for (const field of fields) {
        const value = evento?.[field];
        if (value !== null && value !== undefined && String(value).trim() !== '') return value;
      }
    }
    return '';
  };

  const fechaOficial = parseInventoryHistoryDate(currentCycle.officialDate || findCurrentValue(
    'fecha_original_cuenta_madre',
    'cycle_official_purchase_date',
    'official_purchase_date',
    'fecha_compra'
  ));
  const fechaVencimiento = getInventoryHistoryCycleExpiration(currentCycle);
  const totalProfiles = getInventoryHistoryCycleTotal(currentCycle);

  const explicitMotherStatus = String(currentCycle.motherStatus || findCurrentValue(
    'mother_account_status',
    'mother_status',
    'estado_cuenta_madre'
  ) || '').trim().toLowerCase();
  const profileStatuses = currentEvents.map(evento => String(evento?.status || evento?.orden_status || '').trim().toLowerCase());
  let estado = 'Activa';
  if (['replaced', 'reemplazada', 'reemplazado', 'inactive', 'inactiva'].includes(explicitMotherStatus)) {
    estado = 'Reemplazada';
  } else if (['active', 'activa'].includes(explicitMotherStatus)) {
    estado = 'Activa';
  } else if (profileStatuses.some(status => ['failed', 'fallida', 'damaged', 'dañada'].includes(status))) {
    estado = 'Con falla';
  }

  const currentMotherAccountId = currentCycle.motherAccountId || findCurrentValue('cuenta_madre_id', 'mother_account_id') || '-';

  summaryModal.innerHTML = `
    <div class="trace-item"><strong class="trace-label">ID cuenta madre</strong><div class="trace-value">${safeText(String(currentMotherAccountId))}</div></div>
    <div class="trace-item"><strong class="trace-label">Plataforma / Producto</strong><div class="trace-value">${safeText(findCurrentValue('product_name', 'platform') || '-')}</div></div>
    <div class="trace-item"><strong class="trace-label">Correo</strong><div class="trace-value">${safeText(findCurrentValue('cuenta_madre', 'account_email') || '-')}</div></div>
    <div class="trace-item"><strong class="trace-label">Contraseña actual</strong><div class="trace-value">${safeText(findCurrentValue('contrasena', 'account_password') || '-')}</div></div>
    <div class="trace-item"><strong class="trace-label">Fecha oficial de compra</strong><div class="trace-value">${formatInventoryHistoryDate(fechaOficial)}</div></div>
    <div class="trace-item"><strong class="trace-label">Vencimiento a 30 días</strong><div class="trace-value">${formatInventoryHistoryDate(fechaVencimiento)}</div></div>
    <div class="trace-item"><strong class="trace-label">Total de perfiles</strong><div class="trace-value">${totalProfiles}</div></div>
    <div class="trace-item"><strong class="trace-label">Estado</strong><div class="trace-value">${safeText(estado)}</div></div>
  `;

  timelineModalItems.innerHTML = renderInventoryHistoryCycles(eventos);
}

function openInventoryHistoryModal() {
  const modal = document.getElementById('inventoryHistoryModal');
  if (!modal) return;
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

function closeInventoryHistoryModal() {
  const modal = document.getElementById('inventoryHistoryModal');
  if (!modal) return;
  modal.classList.add('hidden');
  modal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

function initInventoryHistoryModalBehavior() {
  const modal = document.getElementById('inventoryHistoryModal');
  if (!modal || modal.dataset.historyModalBound === '1') return;
  modal.dataset.historyModalBound = '1';
  modal.onclick = (event) => {
    if (event.target === modal) closeInventoryHistoryModal();
  };
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !modal.classList.contains('hidden')) {
      closeInventoryHistoryModal();
    }
  });
}

// El botón de historial de inventario abre la sección fija.
function initInventoryHistoryDashboardButton() {
  const card = document.getElementById('dashInventoryHistoryCard');
  if (card) {
    card.classList.toggle('hidden', !canAccessInventoryHistory());
    card.onclick = openInventoryHistory;
  }
}

registerLoadAppHook(function inventoryHistoryUiLoadAppHook(){
  initInventoryHistoryDashboardButton();
  initInventoryHistoryModalBehavior();
}, { name:'inventory-history-ui', order:90 });

// El arranque de sesión se ejecuta al terminar de cargar todos los módulos.
// No iniciar loadApp aquí: este archivo aún continúa instalando hooks y mejoras.

// ===============================
// FIX REAL: Pedidos pendientes + Auto refresh
// ===============================
let __autoRefreshRunning = false;
let __autoRefreshTimer = null;

function isManualPendingOrder(order){
  const type = String(order?.product_type || '').toLowerCase();
  const status = String(order?.status || '').toLowerCase();
  return type === 'manual' && ['accion_en_espera','en_proceso','pendiente'].includes(status);
}

function ensureManualPendingCard(){
  const grid = document.querySelector('#section-dashboard .grid-cards');
  if(!grid) return;
  let card = document.getElementById('dashManualPendingCard');
  if(!card){
    card = document.createElement('div');
    card.id = 'dashManualPendingCard';
    card.className = 'dash-card clickable';
    card.onclick = openManualPendingOrdersFromDashboard;
    card.innerHTML = `<div class="dash-icon">📝</div><div><div class="dash-label">Pedidos pendientes</div><div id="statManualPending" class="dash-value">0</div></div>`;
    const salesCard = document.getElementById('dashSalesTodayCard');
    if(salesCard && salesCard.parentNode === grid){
      grid.insertBefore(card, salesCard);
    }else{
      grid.appendChild(card);
    }
  }
  const label = card.querySelector('.dash-label');
  if(label) label.textContent = 'Pedidos pendientes';
}

function updateManualPendingCount(){
  ensureManualPendingCard();
  const count = (adminOrders || []).filter(isManualPendingOrder).length;
  const el = document.getElementById('statManualPending');
  if(el) el.textContent = count;
  const card = document.getElementById('dashManualPendingCard');
  if(card) card.classList.toggle('urgent-card', count > 0);
}

function openManualPendingOrdersFromDashboard(){
  if(currentUser?.role !== 'admin') return showSection('orders');
  showSection('admin');
  setTimeout(()=>{
    const panel = document.getElementById('adminOrdersPanel');
    if(panel) panel.scrollIntoView({behavior:'smooth', block:'start'});
    if(typeof renderAdminOrdersManualPendingOnly === 'function') renderAdminOrdersManualPendingOnly();
  },120);
}

const __originalLoadAdminOrdersForPending = typeof loadAdminOrders === 'function' ? loadAdminOrders : null;
if(__originalLoadAdminOrdersForPending){
  loadAdminOrders = async function(){
    const oldNotice = document.getElementById('manualPendingNotice');
    if(oldNotice) oldNotice.remove();
    await __originalLoadAdminOrdersForPending();
    updateManualPendingCount();
  }
}

const __originalLoadProductsForPending = typeof loadProducts === 'function' ? loadProducts : null;
if(__originalLoadProductsForPending){
  loadProducts = async function(){
    await __originalLoadProductsForPending();
    ensureManualPendingCard();
  }
}

registerSectionHook(function manualPendingSectionHook(name){
  if(name === 'dashboard' || name === 'admin') ensureManualPendingCard();
});




function __isAdminUserFinal(){
  return currentUser && (currentUser.role === 'admin' || currentUser.role === 'super_admin') && !(currentUser.is_panel_admin === true || currentUser.is_panel_admin === 1 || currentUser.is_panel_admin === 'true');
}

function isAdminUserSafe(){
  if(typeof __isAdminUserFinal === 'function') return __isAdminUserFinal();
  const role = String(currentUser?.role || '').toLowerCase();
  const isPanelAdmin = currentUser?.is_panel_admin === true || currentUser?.is_panel_admin === 1 || currentUser?.is_panel_admin === 'true';
  return (role === 'admin' || role === 'super_admin') && !isPanelAdmin;
}

function toggleCompactItemFinal(id){
  const node=document.getElementById(id);
  if(!node) return;
  node.classList.toggle('open');
  const details=node.querySelector('.compact-details');
  if(details){
    const isOpen=node.classList.contains('open');
    details.style.display=isOpen?'block':'none';
  }
}


// loadAdminOrders movida a admin-commerce.js

function goAdminOrdersPagePrev(){
  if(currentOrdersPage>1){
    currentOrdersPage-=1;
    loadAdminOrders();
  }
}

function goAdminOrdersPageNext(){
  currentOrdersPage+=1;
  loadAdminOrders();
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

function renderAdminReportCompactFinal(r){
  const info=calculateReportRefundInfo(r);
  const canAct=String(r.status||'').toLowerCase()==='pendiente';
  const itemId=`admin-report-compact-${r.id}`;
  return `<div class="item compact-item" id="${itemId}">
    <div class="compact-header" onclick="toggleCompactItemFinal('${itemId}')">
      <div class="compact-title">Reporte #${r.id}</div>
    </div>
    <div class="compact-details" style="display:none">
      <p><b>Reporte:</b> #${r.id} <span class="status">${safeText(r.status||'pendiente')}</span></p>
      <p><b>Cliente:</b> ${safeText(r.customer_name||'Cliente')} <span class="small-text">${safeText(r.customer_email||'')}</span></p>
      <p><b>Correo reportado:</b> ${safeText(r.email||'')}</p>
      <p><b>Perfil original reportado:</b> ${Number(r.reported_account_id||0)>0 ? '#'+Number(r.reported_account_id) : 'No identificado'}${Number(r.replacement_account_id||0)>0 ? ` &nbsp; <b>Perfil de reemplazo:</b> #${Number(r.replacement_account_id)}` : ''}</p>
      <p><b>Producto:</b> ${safeText(r.product_name||r.account_product_name||'')} ${r.platform?`<span class="chip">${safeText(r.platform)}</span>`:''}</p>
      <p><b>Falla:</b> ${safeText(r.issue_type||'otro')}</p>
      <p><b>Explicación:</b> ${safeText(r.description||'')}</p>
      ${Number(r.has_evidence || 0) === 1 ? `<div class="order-proof-row"><p style="margin:5px 0"><b>Evidencia adjunta:</b></p><button class="outline-btn" style="width:auto" onclick="openReportEvidenceModal(${r.id})">👁️ Ver evidencia</button></div>` : ''}
<p><b>Monto:</b> $${formatMoney(r.order_amount)} &nbsp; <b>Días usados:</b> ${info.daysUsed} &nbsp; <b>Días restantes:</b> ${info.daysRemaining} &nbsp; <b>Reembolso sugerido:</b> $${formatMoney(info.refund)}</p>
      ${r.admin_response?`<div class="order-data response-text"><b>Respuesta admin:</b><br>${safeText(r.admin_response)}</div>`:''}
      <div class="two-row">
        <button class="green-btn" onclick="replaceReportedAccountAuto(${r.id})" ${canAct?'':'disabled'}>🔁 Reemplazo (inventario)</button>
        <button class="outline-btn" onclick="replaceReportedAccountManual(${r.id})" ${canAct?'':'disabled'}>✍️ Reemplazo manual</button>
      </div>
      <div class="two-row" style="margin-top:10px">
        <button class="danger-btn" onclick="refundReportedAccount(${r.id}, '${r.order_created_at}')" ${canAct?'':'disabled'}>💰 Reembolso proporcional</button>
        <button class="danger-btn" style="background:#b91c1c" onclick="refundFullReportedAccount(${r.id})" ${canAct?'':'disabled'}>💸 Reembolso completo</button>
      </div>
      <div class="two-row" style="margin-top:10px">
        <select id="reportStatus-${r.id}"><option value="pendiente" ${r.status==='pendiente'?'selected':''}>Pendiente</option><option value="resuelto" ${r.status==='resuelto'?'selected':''}>Resuelto</option><option value="reemplazo" ${r.status==='reemplazo'?'selected':''}>Reemplazo</option><option value="reembolso" ${r.status==='reembolso'?'selected':''}>Reembolso</option></select>
        <input id="reportResponse-${r.id}" placeholder="Respuesta para el cliente" value="${safeText(r.admin_response||'')}" />
      </div>
      <button class="outline-btn" style="width:auto" onclick="updateAccountReportStatus(${r.id})">Guardar veredicto</button>
    </div>
  </div>`;
}

   

async function loadAccountReports(page = currentAdminAccountReportsPage) {
  if (!__isAdminUserFinal()) return;

  try {
    const requestedPage = Math.max(1, Number(page || 1));
    const payload = await api(`/api/admin/account-reports?page=${requestedPage}&limit=${HISTORY_PAGE_LIMIT}`);
    const reports = Array.isArray(payload?.rows) ? payload.rows : [];
    const totalPages = Math.max(1, Number(payload?.totalPages || 1));
    currentAdminAccountReportsPage = Math.max(1, Number(payload?.page || requestedPage));
    if(currentAdminAccountReportsPage > totalPages) return loadAccountReports(totalPages);

    const stat = document.getElementById('statReports');
    if (stat) stat.textContent = Number(payload?.pendingTotal || 0);

    const box = document.getElementById('adminAccountReportsList');
    if (box) {
      box.innerHTML = reports.length ? reports.map(renderAdminReportCompactFinal).join('') : 'Sin reportes de falla.';
      if(typeof renderTablePager === 'function'){
        renderTablePager(box, 'accountReportsPaginationControls', currentAdminAccountReportsPage, totalPages, 'goAccountReportsPagePrev', 'goAccountReportsPageNext');
      }
    }
  } catch (e) {
    console.warn('Error cargando reportes:', e);
  }
}
window.goAccountReportsPagePrev = function(){ if(currentAdminAccountReportsPage > 1) loadAccountReports(currentAdminAccountReportsPage - 1); };
window.goAccountReportsPageNext = function(){ loadAccountReports(currentAdminAccountReportsPage + 1); };

async function openReportEvidenceModal(reportId){
  if(typeof openLazyApiMedia === 'function'){
    return openLazyApiMedia(`admin-report:${reportId}`, `/api/admin/account-reports/${reportId}/evidence`, `Evidencia del reporte #${reportId}`, 'evidence_image');
  }
  showMessage('No se pudo inicializar el visor de evidencia', 'error');
}
window.openReportEvidenceModal = openReportEvidenceModal;

async function updateAccountReportStatus(reportId){
  if(__reportActionBusy.has(Number(reportId))) return;
  __reportActionBusy.add(Number(reportId));
  try{
    const status = (document.getElementById('reportStatus-'+reportId)?.value || '').trim();
    const admin_response = (document.getElementById('reportResponse-'+reportId)?.value || '').trim();

    if(!status){
      throw new Error('Selecciona un veredicto');
    }

    const data = await api('/api/admin/account-reports/'+reportId+'/status', {
      method:'PATCH',
      body: JSON.stringify({ status, admin_response })
    });

    showMessage(data.message || 'Veredicto guardado correctamente');
    await loadAccountReports(currentAdminAccountReportsPage);
  }catch(e){
    showMessage(e.message || 'Error guardando veredicto', 'error');
  }
  finally{__reportActionBusy.delete(Number(reportId));}
}
window.updateAccountReportStatus = updateAccountReportStatus;

// ===============================
// FIX: Entrega manual registrada en platform_accounts
// Al marcar Éxito en un producto manual, permite elegir plataforma registrada
// y guardar correo/contraseña para que el usuario pueda reportar fallas.
// ===============================
function escapeAttrManualFix(value){
  return String(value ?? '')
    .replace(/&/g,'&amp;')
    .replace(/"/g,'&quot;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;');
}

function getAdminOrderByIdManualFix(orderId){
  return (adminOrders || []).find(o => Number(o.id) === Number(orderId));
}

function renderManualDeliveryFormFinal(o){
  const isManual = String(o.product_type || '').toLowerCase() === 'manual';
  if(!isManual) return '';

  const productOptions = (allProducts || [])
    .filter(p => Number(p.active ?? 1) === 1 || p.active === true || p.active === undefined)
    .map(p => `<option value="${escapeAttrManualFix(p.id)}" ${Number(p.id)===Number(o.product_id)?'selected':''}>${safeText(p.name || 'Producto')}</option>`)
    .join('');

  return `<div class="order-data manual-delivery-box">
    <b>Registrar cuenta manual entregada</b>
    <p class="small-text">Si este pedido se marcará como Éxito, llena estos datos. Se guardarán en Inventario como cuenta entregada y el usuario podrá reportarla en fallas.</p>
    <label class="field-label">Plataforma / producto registrado</label>
    <select id="manualPlatformProduct-${o.id}">${productOptions}</select>
    <div class="two-row">
      <div><label class="field-label">Correo de la cuenta</label><input id="manualAccountEmail-${o.id}" placeholder="correo@ejemplo.com" /></div>
      <div><label class="field-label">Contraseña</label><input id="manualAccountPassword-${o.id}" placeholder="Contraseña" /></div>
    </div>
    <div class="two-row">
      <div><label class="field-label">Perfil</label><input id="manualProfileName-${o.id}" placeholder="Perfil 1, P1, etc." /></div>
      <div><label class="field-label">PIN</label><input id="manualProfilePin-${o.id}" placeholder="PIN" /></div>
    </div>
    <label class="field-label">URL para código/soporte opcional</label>
    <input id="manualAccessUrl-${o.id}" placeholder="https://..." />
  </div>`;
}

function renderAdminOrderCompactFinal(o){
  const od=parseJsonObject(o.order_data);
  const itemId=`admin-order-compact-${o.id}`;
  const copyButton=hasAccountDelivery(o)?`<button class="copy-account-btn" onclick="copyAccountDataFromOrder(${o.id}, 'admin')">📋 Copiar datos de cuenta</button>`:'';
  const manualChip=String(o.product_type||'').toLowerCase()==='manual'?'<span class="chip">Manual</span>':'';
  return `<div class="item compact-item" id="${itemId}">
    <div class="compact-header" onclick="toggleCompactItemFinal('${itemId}')">
      <div class="compact-title">Pedido #${o.id}</div>
      <div class="compact-meta">${safeText(getStatusText(o.status))}</div>
    </div>
    <div class="compact-details" style="display:none">
      <p><b>Pedido:</b> #${o.id}</p>
      <p><b>Cliente:</b> ${safeText(o.customer_name)}</p>
      <p><b>Correo:</b> ${safeText(o.customer_email)}</p>
      <p><b>Producto:</b> ${safeText(o.product_name)} ${manualChip}</p>
      <p><b>Monto:</b> $${formatMoney(o.amount)}</p>
      <p><b>Estado actual:</b> <span class="status">${safeText(getStatusText(o.status))}</span></p>
      <p><b>Cobrado:</b> ${Number(o.charged||0)===1?'Sí':'No'}</p>
      ${typeof renderWarrantyNotice === 'function' ? renderWarrantyNotice(o) : ''}
      ${renderOrderData(od, o.id)}
      <label class="field-label">Estado</label>
      <select id="status-${o.id}"><option value="accion_en_espera" ${o.status==='accion_en_espera'?'selected':''}>Acción en espera</option><option value="en_proceso" ${o.status==='en_proceso'?'selected':''}>En proceso</option><option value="exito" ${o.status==='exito'?'selected':''}>Éxito</option><option value="rechazado" ${o.status==='rechazado'?'selected':''}>Rechazado</option></select>
      <label class="field-label">Respuesta para el cliente</label>
      <textarea id="response-${o.id}">${safeText(o.admin_response||'')}</textarea>
      ${renderManualDeliveryFormFinal(o)}
      ${copyButton}
      <label class="checkbox-row"><input type="checkbox" id="refund-${o.id}" /> Devolver saldo si se rechaza</label>
      <button onclick="updateOrderStatus(${o.id})">Actualizar pedido</button>
    </div>
  </div>`;
}

// updateOrderStatus movida a admin-commerce.js


function ensureReportMenuFinal(){
  const menu=document.querySelector('.menu');
  const reportsBtn=document.querySelector('[data-section="reports"]');
  if(reportsBtn){
    reportsBtn.innerHTML='⚠ Reportar';
    reportsBtn.onclick=function(){showSection('reports-menu')};
  }

  const main=document.querySelector('.main');
  if(main && !document.getElementById('section-reports-menu')){
    const section=document.createElement('section');
    section.id='section-reports-menu';
    section.className='section';
    section.innerHTML=`
      <h1 class="section-title">Reportar</h1>
      <div class="row">
        <div class="panel report-option-card" onclick="openReportFaultFormFinal()" style="cursor:pointer">
          <div class="dash-icon" style="margin-bottom:14px">⚠</div>
          <h2>Reportar fallo</h2>
          <p class="small-text">Reporta una cuenta que presente problema para que el admin revise el caso.</p>
          <button class="primary-btn">Abrir reporte</button>
        </div>
        <div class="panel report-option-card" onclick="openFailureResponsesFinal()" style="cursor:pointer">
          <div class="dash-icon" style="margin-bottom:14px">💬</div>
          <h2>Respuesta de fallos</h2>
          <p class="small-text">Consulta el estado y la respuesta del admin a tus reportes.</p>
          <button class="outline-btn">Ver respuestas</button>
        </div>
      </div>`;
    const reportsSection=document.getElementById('section-reports');
    if(reportsSection) reportsSection.insertAdjacentElement('beforebegin', section);
    else main.appendChild(section);
  }

  if(main && !document.getElementById('section-failure-responses')){
    const section=document.createElement('section');
    section.id='section-failure-responses';
    section.className='section';
    section.innerHTML=`
      <div class="panel">
        <div class="panel-head">
          <div>
            <h2>Respuesta de fallos</h2>
            <p class="small-text">Aquí aparecerán las respuestas del admin a tus reportes.</p>
          </div>
          <button class="outline-btn" style="width:auto" onclick="loadMyFailureResponsesFinal()">Actualizar</button>
        </div>
        <div id="myFailureResponsesList">Cargando respuestas...</div>
      </div>`;
    const reportsSection=document.getElementById('section-reports');
    if(reportsSection) reportsSection.insertAdjacentElement('afterend', section);
    else main.appendChild(section);
  }
}

function openReportFaultFormFinal(){
  showSection('reports');
}

function openFailureResponsesFinal(){
  showSection('failure-responses');
}

function getReportStatusTextFinal(status){
  const map={
    pendiente:'Pendiente',
    resuelto:'Resuelto',
    reemplazo:'Reemplazo',
    reembolso:'Reembolso',
    rechazado:'Rechazado'
  };
  return map[String(status||'').toLowerCase()] || status || 'Pendiente';
}

async function loadMyFailureResponsesFinal(page = currentFailureResponsesPage){
  const box=document.getElementById('myFailureResponsesList');
  if(!box) return;
  try{
    const requestedPage=Math.max(1, Number(page||1));
    const payload=await api(`/api/my-account-reports?page=${requestedPage}&limit=${HISTORY_PAGE_LIMIT}`);
    const reports=Array.isArray(payload?.rows) ? payload.rows : [];
    const totalPages=Math.max(1, Number(payload?.totalPages||1));
    currentFailureResponsesPage=Math.max(1, Number(payload?.page||requestedPage));
    if(currentFailureResponsesPage > totalPages) return loadMyFailureResponsesFinal(totalPages);

    if(typeof cacheMyAccountReports === 'function') cacheMyAccountReports(reports);
    if(!reports.length){
      box.innerHTML='Todavía no tienes reportes de falla.';
    }else{
      box.innerHTML=reports.map(r=>`
        <div class="item compact-item">
          <div class="compact-header" onclick="this.parentNode.classList.toggle('open')">
            <div class="compact-title">Reporte #${r.id}</div>
            <div class="compact-meta">${safeText(r.email||'correo reportado')} · ${safeText(getReportStatusTextFinal(r.status))}</div>
          </div>
          <div class="compact-details">
            <p><b>Reporte:</b> #${r.id}</p>
            <p><b>Correo reportado:</b> ${safeText(r.email||'')}</p>
            <p><b>Tipo de falla:</b> ${safeText(r.issue_type||'otro')}</p>
            <p><b>Explicación enviada:</b> ${safeText(r.description||'')}</p>
            <p><b>Estado:</b> <span class="status">${safeText(getReportStatusTextFinal(r.status))}</span></p>
            ${Number(r.has_evidence || 0) === 1 ? `<div class="order-proof-row"><button class="outline-btn" style="width:auto" onclick="openMyReportEvidence(${r.id})">👁️ Ver evidencia enviada</button></div>` : ''}
            <div class="order-data response-text"><b>Respuesta del admin:</b><br>${safeText(r.admin_response||'Aún no hay respuesta del admin.')}</div>
            ${typeof renderReplacementReportActions === 'function' ? renderReplacementReportActions(r) : ''}
          </div>
        </div>`).join('');
    }
    if(typeof renderTablePager === 'function'){
      renderTablePager(box, 'failureResponsesPaginationControls', currentFailureResponsesPage, totalPages, 'goFailureResponsesPagePrev', 'goFailureResponsesPageNext');
    }
  }catch(e){
    box.innerHTML='No se pudieron cargar tus respuestas de fallos.';
    console.warn('Error cargando respuestas de fallos', e);
  }
}
window.goFailureResponsesPagePrev = function(){ if(currentFailureResponsesPage > 1) loadMyFailureResponsesFinal(currentFailureResponsesPage - 1); };
window.goFailureResponsesPageNext = function(){ loadMyFailureResponsesFinal(currentFailureResponsesPage + 1); };

(function(){
  const styleId='reportMenuFinalStyle';
  if(!document.getElementById(styleId)){
    const st=document.createElement('style');
    st.id=styleId;
    st.textContent=`
      .report-option-card h2{margin:0 0 8px}.report-option-card button{margin-top:10px}
      @media(max-width:760px){.report-option-card .dash-icon{width:58px;height:58px;font-size:26px}}
    `;
    document.head.appendChild(st);
  }

  registerSectionHook(function reportsSectionHook(name){
    if(name === 'reports-menu' || name === 'reports' || name === 'failure-responses'){
      ensureReportMenuFinal();
    }
    if(name === 'failure-responses'){
      runSectionLoadOnce('failure-responses', () => loadMyFailureResponsesFinal());
    }
  });

  registerLoadAppHook(function reportMenuUiLoadAppHook(){
    ensureReportMenuFinal();
  }, { name:'report-menu-ui', order:95 });
})();



// ===============================
// FASE 1: Crear y administrar paneles admin secundarios
// Esta sección es solo para el admin principal.
// ===============================
function ensureAdminPanelsPhase1UI(){
  if(!currentUser || String(currentUser.role||'').toLowerCase()!=='admin') return;

  const adminSection=document.getElementById('section-admin');
  if(!adminSection) return;

  const grid=adminSection.querySelector('.grid-cards');
  if(grid && !document.getElementById('adminPanelsCardPhase1')){
    const card=document.createElement('div');
    card.id='adminPanelsCardPhase1';
    card.className='dash-card clickable';
    card.onclick=function(){ scrollToAdmin('adminPanelsPanelPhase1'); loadAdminPanelsPhase1(); };
    card.innerHTML=`<div class="dash-icon">🏢</div><div><div class="dash-label">Paneles admin</div><div id="adminPanelsCountPhase1" class="dash-value">0</div></div>`;
    grid.appendChild(card);
  }

  if(!document.getElementById('adminPanelsPanelPhase1')){
    const panel=document.createElement('div');
    panel.id='adminPanelsPanelPhase1';
    panel.className='panel';
    panel.innerHTML=`
      <div class="panel-head">
        <div>
          <h2>Paneles admin</h2>
          <p class="small-text">Crea paneles para admins que renten o compren su propio acceso. En esta fase solo se registran sus datos, banco y estado.</p>
        </div>
        <button class="outline-btn" style="width:auto" onclick="loadAdminPanelsPhase1()">Actualizar</button>
      </div>

      <div class="row">
        <div>
          <h3>Crear nuevo panel</h3>
          <label class="field-label">Nombre del negocio</label>
          <input id="panelBusinessNamePhase1" placeholder="Ejemplo: Servicios Digitales Juan" />

          <label class="field-label">Nombre del admin</label>
          <input id="panelAdminNamePhase1" placeholder="Nombre completo" />

          <label class="field-label">Correo de acceso</label>
          <input id="panelEmailPhase1" type="email" placeholder="admin@correo.com" />

          <label class="field-label">Contraseña inicial</label>
          <input id="panelPasswordPhase1" type="password" placeholder="Mínimo 6 caracteres" />

          <label class="field-label">Teléfono</label>
          <input id="panelPhonePhase1" placeholder="Teléfono / WhatsApp" />
        </div>

        <div>
          <h3>Datos de banco y plan</h3>
          <label class="field-label">Banco</label>
          <input id="panelBankNamePhase1" placeholder="BBVA, Mercado Pago, etc." />

          <label class="field-label">Titular</label>
          <input id="panelBankHolderPhase1" placeholder="Nombre del titular" />

          <label class="field-label">CLABE / cuenta</label>
          <input id="panelBankClabePhase1" placeholder="CLABE o número de cuenta" />

          <label class="field-label">Concepto de pago</label>
          <input id="panelPaymentConceptPhase1" placeholder="Ejemplo: servicios" />

          <label class="field-label">Correo de notificaciones</label>
          <input id="panelNotificationEmailPhase1" type="email" placeholder="correo para pedidos y alertas" />

          <div class="two-row">
            <div>
              <label class="field-label">Estado</label>
              <select id="panelStatusPhase1">
                <option value="activo">Activo</option>
                <option value="inactivo">Inactivo</option>
                <option value="suspendido">Suspendido</option>
              </select>
            </div>
            <div>
              <label class="field-label">Tipo de plan</label>
              <select id="panelPlanTypePhase1">
                <option value="renta">Renta mensual</option>
                <option value="compra">Compra única</option>
              </select>
            </div>
          </div>

          <label class="field-label">Fecha de vencimiento</label>
          <input id="panelExpiresAtPhase1" type="date" />

          <button class="primary-btn" onclick="createAdminPanelPhase1()">Crear panel admin</button>
        </div>
      </div>

      <hr class="divider">
      <h3>Paneles registrados</h3>
      <div id="adminPanelsListPhase1">Cargando paneles...</div>
    `;

    const usersPanel=document.getElementById('adminUsersPanel');
    if(usersPanel) usersPanel.insertAdjacentElement('beforebegin', panel);
    else adminSection.appendChild(panel);
  }
}

function getAdminPanelPhase1Payload(){
  return {
    business_name:document.getElementById('panelBusinessNamePhase1')?.value || '',
    admin_name:document.getElementById('panelAdminNamePhase1')?.value || '',
    email:document.getElementById('panelEmailPhase1')?.value || '',
    password:document.getElementById('panelPasswordPhase1')?.value || '',
    phone:document.getElementById('panelPhonePhase1')?.value || '',
    bank_name:document.getElementById('panelBankNamePhase1')?.value || '',
    bank_holder:document.getElementById('panelBankHolderPhase1')?.value || '',
    bank_clabe:document.getElementById('panelBankClabePhase1')?.value || '',
    payment_concept:document.getElementById('panelPaymentConceptPhase1')?.value || '',
    notification_email:document.getElementById('panelNotificationEmailPhase1')?.value || '',
    status:document.getElementById('panelStatusPhase1')?.value || 'activo',
    plan_type:document.getElementById('panelPlanTypePhase1')?.value || 'renta',
    expires_at:document.getElementById('panelExpiresAtPhase1')?.value || null
  };
}

function clearAdminPanelPhase1Form(){
  [
    'panelBusinessNamePhase1','panelAdminNamePhase1','panelEmailPhase1','panelPasswordPhase1',
    'panelPhonePhase1','panelBankNamePhase1','panelBankHolderPhase1','panelBankClabePhase1',
    'panelPaymentConceptPhase1','panelNotificationEmailPhase1','panelExpiresAtPhase1'
  ].forEach(id=>{const el=document.getElementById(id); if(el) el.value='';});
  const status=document.getElementById('panelStatusPhase1'); if(status) status.value='activo';
  const plan=document.getElementById('panelPlanTypePhase1'); if(plan) plan.value='renta';
}

async function loadAdminPanelsPhase1(){
  if(!isAdminUserSafe()) return;
  ensureAdminPanelsPhase1UI();

  const box=document.getElementById('adminPanelsListPhase1');
  try{
    const panels=await api('/api/admin/admin-panels');
    window.__adminPanelsPhase1Cache = Array.isArray(panels) ? panels : [];
    window.__adminPanelsPhase1Loaded = true;
    const count=document.getElementById('adminPanelsCountPhase1');
    if(count) count.textContent=Array.isArray(panels)?panels.length:0;

    if(!box) return;

    if(!Array.isArray(panels) || !panels.length){
      box.innerHTML='Todavía no hay paneles admin registrados.';
      return;
    }

    box.innerHTML=`<div class="table-wrap"><table class="mini-table">
      <thead>
        <tr>
          <th>Panel</th>
          <th>Admin</th>
          <th>Banco</th>
          <th>Plan</th>
          <th>Estado</th>
          <th>Acciones</th>
        </tr>
      </thead>
      <tbody>
        ${panels.map(p=>`
          <tr>
            <td>
              <b>${safeText(p.business_name||'Sin nombre')}</b><br>
              <span class="small-text">${safeText(p.email||'')}</span>
            </td>
            <td>
              ${safeText(p.admin_name||'')}<br>
              <span class="small-text">${safeText(p.phone||'')}</span>
            </td>
            <td>
              <b>${safeText(p.bank_name||'')}</b><br>
              <span class="small-text">${safeText(p.bank_holder||'')}</span><br>
              <span class="small-text">${safeText(p.bank_clabe||'')}</span>
            </td>
            <td>
              ${safeText(p.plan_type||'renta')}<br>
              <span class="small-text">Vence: ${safeText(p.expires_at ? String(p.expires_at).slice(0,10) : 'Sin fecha')}</span>
            </td>
            <td><span class="status">${safeText(p.status||'activo')}</span></td>
            <td>
              <button class="outline-btn" style="width:auto;margin-bottom:6px" onclick="updateAdminPanelStatusPhase1(${p.id}, '${String(p.status||'activo')==='activo'?'suspendido':'activo'}')">
                ${String(p.status||'activo')==='activo'?'Suspender':'Activar'}
              </button>
              <button class="muted-btn" style="width:auto" onclick="copyAdminPanelInfoPhase1(${p.id})">Copiar datos</button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table></div>`;

  }catch(e){
    if(box) box.innerHTML='No se pudieron cargar los paneles admin.';
    showMessage(e.message||'Error cargando paneles admin','error');
  }
}

async function createAdminPanelPhase1(){
  try{
    const payload=getAdminPanelPhase1Payload();

    if(!payload.email.trim()) throw new Error('El correo del admin es obligatorio.');
    if(!payload.password.trim() || payload.password.trim().length<6) throw new Error('La contraseña debe tener mínimo 6 caracteres.');

    const data=await api('/api/admin/admin-panels',{
      method:'POST',
      body:JSON.stringify(payload)
    });

    showMessage(data.message||'Panel admin creado correctamente');
    clearAdminPanelPhase1Form();
    await loadAdminPanelsPhase1();
  }catch(e){
    showMessage(e.message||'Error creando panel admin','error');
  }
}

async function updateAdminPanelStatusPhase1(panelId,status){
  try{
    const data=await api('/api/admin/admin-panels/'+panelId+'/status',{
      method:'PATCH',
      body:JSON.stringify({status})
    });
    showMessage(data.message||'Estado actualizado');
    await loadAdminPanelsPhase1();
  }catch(e){
    showMessage(e.message||'Error actualizando estado','error');
  }
}

function copyAdminPanelInfoPhase1(panelId){
  const panel=(window.__adminPanelsPhase1Cache||[]).find(p=>Number(p.id)===Number(panelId));
  if(!panel) return;
  const text=[
    `Panel: ${panel.business_name||''}`,
    `Admin: ${panel.admin_name||''}`,
    `Correo: ${panel.email||''}`,
    `Banco: ${panel.bank_name||''}`,
    `Titular: ${panel.bank_holder||''}`,
    `CLABE/Cuenta: ${panel.bank_clabe||''}`,
    `Concepto: ${panel.payment_concept||''}`,
    `Correo notificaciones: ${panel.notification_email||''}`,
    `Estado: ${panel.status||''}`,
    `Plan: ${panel.plan_type||''}`,
    `Vence: ${panel.expires_at ? String(panel.expires_at).slice(0,10) : 'Sin fecha'}`
  ].join('\n');

  navigator.clipboard?.writeText(text).then(
    ()=>showMessage('Datos del panel copiados'),
    ()=>showMessage(text)
  );
}

(function(){
  registerSectionHook(function adminPanelsPhase1SectionHook(name){
    if(name === 'admin' && isAdminUserSafe()){
      ensureAdminPanelsPhase1UI();
      runSectionLoadOnce('admin-panels-phase1', () => loadAdminPanelsPhase1());
    }
  });

  registerLoadAppHook(function adminPanelsPhase1LoadAppHook(){
    if(isAdminUserSafe()) ensureAdminPanelsPhase1UI();
  }, { name:'admin-panels-phase1-ui', order:105 });
})();


// ===============================
// FASE 2 INICIO: Panel admin rentado con productos, inventario y banco
// ===============================
function isPanelAdminRented(){
  return currentUser && (currentUser.is_panel_admin === true || currentUser.is_panel_admin === 1 || currentUser.is_panel_admin === 'true');
}
function isAnyAdminUserPanel(){
  return currentUser && String(currentUser.role || '').toLowerCase() === 'admin';
}
function isMainAdminPrincipal(){
  return isAnyAdminUserPanel() && !isPanelAdminRented();
}
function hideElementHard(el, hidden){
  if(!el) return;
  el.classList.toggle('hidden', !!hidden);
  el.style.display = hidden ? 'none' : '';
}
function applyRentedAdminLayout(){
  const panel = isPanelAdminRented();
  const main = isMainAdminPrincipal();

  // Menú admin: solo principal ve el panel completo. El rentado entra desde tarjetas.
  hideElementHard(document.getElementById('adminMenuBtn'), true);
  hideElementHard(document.getElementById('adminSalesMenuBtn'), !main);

  // Tarjetas dashboard para panel rentado.
  const userCard = document.querySelector('.dash-card[onclick="openUsersFromDashboard()"]');
if(userCard) userCard.classList.remove('hidden');
  hideElementHard(userCard, panel); // se quita Usuarios porque ya existe Mis vendedores.
  hideElementHard(document.getElementById('dashInventoryCard'), !(main || panel));
  hideElementHard(document.getElementById('dashSalesTodayCard'), !main); // ventas propias completas van en fase de reportes.
  hideElementHard(document.getElementById('dashboardChartsPanel'), !main);
  hideElementHard(document.getElementById('adminPanelsCardPhase1'), !main);
  hideElementHard(document.getElementById('adminPanelsPanelPhase1'), !main);

  // Dentro del admin rentado solo mostramos lo que necesita para operar su panel.
  if(panel){
    hideElementHard(document.getElementById('section-admin'), false);
    hideElementHard(document.getElementById('adminUsersPanel'), false);
    hideElementHard(document.getElementById('adminSubadminPricesPanel'), true);
    hideElementHard(document.getElementById('adminBalanceRequestsPanel'), true);
    hideElementHard(document.getElementById('adminAccountReportsPanel'), true);
    hideElementHard(document.getElementById('adminSalesReportPanel'), true);
    hideElementHard(document.getElementById('adminOrdersPanel'), false);
    hideElementHard(document.getElementById('adminProductsPanel'), false);
    hideElementHard(document.getElementById('adminPlatformAccountsPanel'), false);

    const title=document.querySelector('#section-admin .section-title');
    if(title) title.textContent='Mi panel admin';
  }

}

function scrollToAdmin(id){
  if(!isAnyAdminUserPanel()) return showSection('dashboard');
  showSection('admin');
  applyRentedAdminLayout();
  if(id==='adminOrdersPanel' && typeof loadAdminOrders==='function') loadAdminOrders(1);
  if(id==='adminPlatformAccountsPanel' && typeof loadPlatformInventory==='function') loadPlatformInventory(1);
  runAfterNextPaint(()=>{
    const el=document.getElementById(id);
    if(el) el.scrollIntoView({behavior:'smooth', block:'start'});
  });
}

openUsersFromDashboard = function(){
  if(isPanelAdminRented()) return showSection('distributor');
  if(isMainAdminPrincipal()) return scrollToAdmin('adminUsersPanel');
  showSection('account');
};
openProductsFromDashboard = function(){
  if(isAnyAdminUserPanel()) return scrollToAdmin('adminProductsPanel');
  showSection('shop');
};
openInventoryFromDashboard = function(){
  if(isAnyAdminUserPanel()) return scrollToAdmin('adminPlatformAccountsPanel');
  showSection('shop');
};
openOrdersFromDashboard = function(){
  if(isAnyAdminUserPanel()) return scrollToAdmin('adminOrdersPanel');
  showSection('orders');
};

async function loadBankInfoForPanel(){
  try{
    const info=await api('/api/bank-info');
    const setText=(id,val)=>{const el=document.getElementById(id); if(el) el.textContent=val || '';};
    setText('bankNameText', info.bank_name || '');
    setText('bankHolderText', info.bank_holder || '');
    setText('clabeText', info.bank_clabe || '');
    setText('conceptText', info.payment_concept || '');
  }catch(e){
    console.warn('No se pudieron cargar datos bancarios', e);
  }
}

registerLoadAppHook(async function rentedAdminLoadAppHook(){
  await loadBankInfoForPanel();
  applyRentedAdminLayout();

  if(isPanelAdminRented()){
    const statUsersEl=document.getElementById('statUsers');
    if(statUsersEl) statUsersEl.textContent='0';

    if(typeof loadDistributorPanel==='function'){
      await loadDistributorPanel();
    }
    applyRentedAdminLayout();
  }
}, { name:'rented-admin-layout', order:100 });


// ===============================
// MEJORA REAL: dashboard para panel independiente + reporte mensual + busquedas
// ===============================
function isPanelAdminCreatedFinal(){
  return currentUser && (currentUser.is_panel_admin === true || currentUser.is_panel_admin === 1 || currentUser.is_panel_admin === 'true');
}
function isAdminAnyFinal(){
  return currentUser && String(currentUser.role || '').toLowerCase() === 'admin';
}
function showHardFinal(id, show=true){
  const el=document.getElementById(id);
  if(!el) return;
  el.classList.toggle('hidden', !show);
  el.style.display = show ? '' : 'none';
}
function ensurePanelAdminDashboardCardsFinal(){
  if(!isAdminAnyFinal()) return;
  // El panel creado debe ver ventas y graficas como admin global, pero con sus propios datos.
  showHardFinal('dashSalesTodayCard', true);
  showHardFinal('dashboardChartsPanel', true);
  showHardFinal('adminSalesReportPanel', true);

  const grid=document.querySelector('#section-dashboard .grid-cards');
  if(!grid) return;
  const specs=[
    ['panelCostTodayCard','💸','Costo total','salesReportCost','0.00'],
    ['panelProfitTodayCard','📈','Ganancia real','salesReportProfit','0.00'],
    ['panelSuccessOrdersCard','▤','Pedidos éxito','salesReportOrders','0']
  ];
  specs.forEach(([id,icon,label,source,def])=>{
    if(document.getElementById(id)) return;
    const card=document.createElement('div');
    card.id=id;
    card.className='dash-card clickable';
    card.onclick=()=>openSalesReportFinal();
    const isMoney = source !== 'salesReportOrders';
    card.innerHTML=`<div class="dash-icon">${icon}</div><div><div class="dash-label">${label}</div><div class="dash-value">${isMoney?'$':''}<span id="${id}Value">${def}</span></div></div>`;
    const salesCard=document.getElementById('dashSalesTodayCard');
    if(salesCard && salesCard.parentNode===grid) salesCard.insertAdjacentElement('afterend', card);
    else grid.appendChild(card);
  });
}
function syncPanelAdminDashboardValuesFinal(){
  const copy=(src,dst,def='0')=>{
    const s=document.getElementById(src), d=document.getElementById(dst);
    if(d) d.textContent=(s?.textContent || def);
  };
  copy('salesReportCost','panelCostTodayCardValue','0.00');
  copy('salesReportProfit','panelProfitTodayCardValue','0.00');
  copy('salesReportOrders','panelSuccessOrdersCardValue','0');
}
function openSalesReportFinal(){
  if(!isAdminAnyFinal()) return;
  showSection('admin');
  ensureAdvancedReportsPanelFinal();
  loadSalesReport(true).then(syncPanelAdminDashboardValuesFinal).catch(()=>{});
  runAfterNextPaint(()=>{
    const el=document.getElementById('adminSalesReportPanel');
    if(el) el.scrollIntoView({behavior:'smooth', block:'start'});
  });
}
if(typeof openSalesReport === 'function'){
  openSalesReport = openSalesReportFinal;
}

function ensureAdvancedReportsPanelFinal(){
  if(!isAdminAnyFinal()) return;
  const salesPanel=document.getElementById('adminSalesReportPanel');
  if(!salesPanel || document.getElementById('advancedReportsPanelFinal')) return;
  const panel=document.createElement('div');
  panel.id='advancedReportsPanelFinal';
  panel.className='panel';
  panel.innerHTML=`
    <div class="panel-head">
      <div>
        <h2>Búsqueda e historial</h2>
        <p class="small-text">Busca pedidos o fallas por rango de fechas, o consulta el historial de pedidos de un usuario.</p>
      </div>
    </div>
    <div class="row">
      <div>
        <h3>Buscar por fechas</h3>
        <div class="two-row">
          <div><label class="field-label">Fecha inicial</label><input id="searchStartDateFinal" type="date"></div>
          <div><label class="field-label">Fecha final</label><input id="searchEndDateFinal" type="date"></div>
        </div>
        <label class="field-label">Tipo</label>
        <select id="searchTypeFinal"><option value="orders">Pedidos</option><option value="reports">Fallas</option></select>
        <button class="primary-btn" onclick="searchRecordsByDateFinal()">Buscar</button>
      </div>
      <div>
        <h3>Historial por usuario</h3>
        <label class="field-label">Usuario</label>
        <select id="historyUserSelectFinal"><option value="">Cargando usuarios...</option></select>
        <div class="two-row">
          <div><label class="field-label">Desde opcional</label><input id="historyStartDateFinal" type="date"></div>
          <div><label class="field-label">Hasta opcional</label><input id="historyEndDateFinal" type="date"></div>
        </div>
        <button class="green-btn" onclick="loadUserHistoryFinal()">Ver historial</button>
      </div>
    </div>
    <hr class="divider">
    <div id="advancedReportsResultFinal">Sin búsqueda todavía.</div>`;
  salesPanel.insertAdjacentElement('afterend', panel);
  loadHistoryUsersFinal();
}
async function loadHistoryUsersFinal(){
  if(!isAdminAnyFinal()) return;
  const sel=document.getElementById('historyUserSelectFinal');
  if(!sel) return;
  try{
    const cacheBelongsToCurrentAdmin = Number(window.__adminUsersCacheOwnerId || 0) === Number(currentUser?.id || 0);
    const users = cacheBelongsToCurrentAdmin && Array.isArray(allUsers)
      ? allUsers
      : await api('/api/admin/users');
    sel.innerHTML='<option value="">Selecciona usuario</option>'+users.map(u=>`<option value="${u.id}">#${u.id} ${safeText(u.name||'Usuario')} · ${safeText(u.email||'')}</option>`).join('');
  }catch(e){
    sel.innerHTML='<option value="">Error cargando usuarios</option>';
  }
}
function renderRecordsTableFinal(type, records=[]){
  const box=document.getElementById('advancedReportsResultFinal');
  if(!box) return;
  if(!records.length){ box.innerHTML='Sin resultados.'; return; }
  if(type==='reports'){
    box.innerHTML=`<div class="table-wrap"><table class="mini-table"><thead><tr><th>Reporte</th><th>Usuario</th><th>Correo falla</th><th>Tipo</th><th>Estado</th><th>Respuesta</th><th>Fecha</th></tr></thead><tbody>${records.map(r=>`<tr><td>#${r.id}${r.order_id?`<br><span class="small-text">Pedido #${r.order_id}</span>`:''}</td><td><b>${safeText(r.customer_name||'')}</b><br><span class="small-text">${safeText(r.customer_email||'')}</span></td><td>${safeText(r.email||'')}</td><td>${safeText(r.issue_type||'')}</td><td>${safeText(r.status||'')}</td><td>${safeText(r.admin_response||'Sin respuesta')}</td><td>${safeText(String(r.created_at||'').slice(0,10))}</td></tr>`).join('')}</tbody></table></div>`;
    return;
  }
  box.innerHTML=`<div class="table-wrap"><table class="mini-table"><thead><tr><th>Pedido</th><th>Usuario</th><th>Producto</th><th>Monto</th><th>Estado</th><th>Respuesta</th><th>Fecha</th></tr></thead><tbody>${records.map(o=>`<tr><td>#${o.id}</td><td><b>${safeText(o.customer_name||'')}</b><br><span class="small-text">${safeText(o.customer_email||'')}</span></td><td>${safeText(o.product_name||'')}</td><td>$${formatMoney(o.amount)}</td><td>${safeText(o.status||'')}</td><td>${safeText(o.admin_response||'')}</td><td>${safeText(String(o.created_at||'').slice(0,10))}</td></tr>`).join('')}</tbody></table></div>`;
}
async function searchRecordsByDateFinal(){
  try{
    const type=document.getElementById('searchTypeFinal')?.value || 'orders';
    const start=document.getElementById('searchStartDateFinal')?.value || '';
    const end=document.getElementById('searchEndDateFinal')?.value || '';
    const data=await api(`/api/admin/search-records?type=${encodeURIComponent(type)}&start_date=${encodeURIComponent(start)}&end_date=${encodeURIComponent(end)}`);
    renderRecordsTableFinal(type, data.records||[]);
  }catch(e){ showMessage(e.message||'Error buscando registros','error'); }
}
async function loadUserHistoryFinal(page = 1){
  try{
    const userId=document.getElementById('historyUserSelectFinal')?.value || '';
    const start=document.getElementById('historyStartDateFinal')?.value || '';
    const end=document.getElementById('historyEndDateFinal')?.value || '';
    const requestedPage=Math.max(1, Number(page||1));
    const qs=new URLSearchParams({
      user_id:userId,
      page:String(requestedPage),
      limit:String(HISTORY_PAGE_LIMIT)
    });
    if(start && end){ qs.set('start_date',start); qs.set('end_date',end); }
    const data=await api('/api/admin/user-history?'+qs.toString());
    const totalPages=Math.max(1, Number(data?.totalPages||1));
    currentUserHistoryPage=Math.max(1, Number(data?.page||requestedPage));
    if(currentUserHistoryPage > totalPages) return loadUserHistoryFinal(totalPages);
    renderRecordsTableFinal('orders', data.records||[]);
    const box=document.getElementById('advancedReportsResultFinal');
    if(box && typeof renderTablePager === 'function'){
      renderTablePager(box, 'userHistoryPaginationControls', currentUserHistoryPage, totalPages, 'goUserHistoryPagePrev', 'goUserHistoryPageNext');
    }
  }catch(e){ showMessage(e.message||'Error cargando historial','error'); }
}
window.goUserHistoryPagePrev=function(){ if(currentUserHistoryPage>1) loadUserHistoryFinal(currentUserHistoryPage-1); };
window.goUserHistoryPageNext=function(){ loadUserHistoryFinal(currentUserHistoryPage+1); };

async function downloadMonthlyReport(){
  try{
    if(!isAdminAnyFinal()) return;
    let month=document.getElementById('monthlyReportMonth')?.value || '';
    if(!month){
      const d=new Date(); month=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      const input=document.getElementById('monthlyReportMonth'); if(input) input.value=month;
    }
    const res=await fetch('/api/admin/monthly-report?month='+encodeURIComponent(month), {headers:{Authorization:'Bearer '+token}});
    if(!res.ok){ const err=await res.json().catch(()=>({error:'Error descargando reporte'})); throw new Error(err.error||'Error descargando reporte'); }
    const blob=await res.blob();
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url; a.download=`reporte_mensual_${month}.csv`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  }catch(e){ showMessage(e.message||'Error descargando reporte mensual','error'); }
}

const __loadSalesReportBeforeFinal = typeof loadSalesReport === 'function' ? loadSalesReport : null;
if(__loadSalesReportBeforeFinal){
  loadSalesReport = async function(forceToday=false){
    await __loadSalesReportBeforeFinal(forceToday);
    ensurePanelAdminDashboardCardsFinal();
    syncPanelAdminDashboardValuesFinal();
  };
}
const __applyRentedLayoutBeforeFinal = typeof applyRentedAdminLayout === 'function' ? applyRentedAdminLayout : null;
if(__applyRentedLayoutBeforeFinal){
  applyRentedAdminLayout = function(){
    __applyRentedLayoutBeforeFinal();
    if(isPanelAdminCreatedFinal()){
      showHardFinal('dashSalesTodayCard', true);
      showHardFinal('dashboardChartsPanel', true);
      showHardFinal('adminSalesReportPanel', true);
      showHardFinal('panelCostTodayCard', true);
      showHardFinal('panelProfitTodayCard', true);
      showHardFinal('panelSuccessOrdersCard', true);
    }
  };
}
registerLoadAppHook(async function advancedReportsLoadAppHook(){
  if(!isAdminAnyFinal()) return;

  ensurePanelAdminDashboardCardsFinal();
  const advancedPanelAlreadyExisted = !!document.getElementById('advancedReportsPanelFinal');
  ensureAdvancedReportsPanelFinal();

  // Si el panel acaba de crearse, ensureAdvancedReportsPanelFinal ya carga el
  // selector una vez. Si ya existía, actualizarlo aquí sin duplicar la petición.
  if(advancedPanelAlreadyExisted){
    await loadHistoryUsersFinal();
  }

  if(typeof applyRentedAdminLayout === 'function'){
    applyRentedAdminLayout();
  }
  syncPanelAdminDashboardValuesFinal();
}, { name:'advanced-admin-reports', order:200 });

// ===============================
// AJUSTE FINAL: Ventas hoy despliega resumen + Paneles admin en dashboard principal
// ===============================
(function(){
  let salesDetailsExpandedFinal = false;

  function isMainGlobalAdminFinal(){
    return currentUser &&
      String(currentUser.role || '').toLowerCase() === 'admin' &&
      !(currentUser.is_panel_admin === true || currentUser.is_panel_admin === 1 || currentUser.is_panel_admin === 'true') &&
      !(currentUser.is_subadmin === true || currentUser.is_subadmin === 1 || currentUser.is_subadmin === 'true');
  }

  function isAnyAdminFinal(){
    return currentUser && String(currentUser.role || '').toLowerCase() === 'admin';
  }

  function setSalesDetailCardsFinal(show){
    ['panelSuccessOrdersCard','panelProfitTodayCard','panelCostTodayCard'].forEach(id=>{
      const el=document.getElementById(id);
      if(!el) return;
      el.classList.toggle('hidden', !show);
      el.style.display = show ? '' : 'none';
    });
  }

  function prepareSalesTodayToggleFinal(){
    const salesCard=document.getElementById('dashSalesTodayCard');
    if(!salesCard || salesCard.dataset.salesToggleFinal === '1') return;
    salesCard.dataset.salesToggleFinal = '1';
    salesCard.title = 'Toca para desplegar costo, ganancia y pedidos éxito';
    salesCard.onclick = async function(){
      salesDetailsExpandedFinal = !salesDetailsExpandedFinal;
      if(typeof ensurePanelAdminDashboardCardsFinal === 'function') ensurePanelAdminDashboardCardsFinal();
      setSalesDetailCardsFinal(salesDetailsExpandedFinal);
      if(salesDetailsExpandedFinal && typeof loadSalesReport === 'function'){
        try{ await loadSalesReport(true); }catch(e){ console.warn('No se pudo actualizar ventas hoy', e); }
        setSalesDetailCardsFinal(true);
      }
    };
  }

  function movePanelsAdminToMainDashboardFinal(){
    if(!isMainGlobalAdminFinal()) return;
    const grid=document.querySelector('#section-dashboard .grid-cards');
    if(!grid) return;

    let card=document.getElementById('dashAdminPanelsCardMainFinal');
    if(!card){
      card=document.createElement('div');
      card.id='dashAdminPanelsCardMainFinal';
      card.className='dash-card clickable';
      card.innerHTML=`<div class="dash-icon">🏢</div><div><div class="dash-label">Paneles admin</div><div id="statAdminPanelsMainFinal" class="dash-value">0</div></div>`;
      card.onclick=function(){
        if(typeof ensureAdminPanelsPhase1UI === 'function') ensureAdminPanelsPhase1UI();
        if(typeof showSection === 'function') showSection('admin');
        if(typeof loadAdminPanelsPhase1 === 'function') loadAdminPanelsPhase1();
        runAfterNextPaint(()=>{
          const panel=document.getElementById('adminPanelsPanelPhase1');
          if(panel) panel.scrollIntoView({behavior:'smooth', block:'start'});
        });
      };
      grid.appendChild(card);
    }
    card.classList.remove('hidden');
    card.style.display='';
    updateAdminPanelsCountFinal();
  }

  let adminPanelsCountRequest = null;
  async function updateAdminPanelsCountFinal(){
    if(!isMainGlobalAdminFinal()) return;
    const el=document.getElementById('statAdminPanelsMainFinal');
    const applyCount=(panels)=>{
      const count=Array.isArray(panels) ? panels.length : 0;
      if(el) el.textContent = count;
      const old=document.getElementById('adminPanelsCountPhase1');
      if(old) old.textContent = count;
    };

    if(window.__adminPanelsPhase1Loaded){
      applyCount(window.__adminPanelsPhase1Cache || []);
      return;
    }
    if(adminPanelsCountRequest) return adminPanelsCountRequest;

    adminPanelsCountRequest=(async()=>{
      try{
        const panels=await api('/api/admin/admin-panels');
        window.__adminPanelsPhase1Cache=Array.isArray(panels) ? panels : [];
        window.__adminPanelsPhase1Loaded=true;
        applyCount(window.__adminPanelsPhase1Cache);
      }catch(e){
        if(el && !el.textContent) el.textContent='0';
        console.warn('No se pudo contar paneles admin', e);
      }finally{
        adminPanelsCountRequest=null;
      }
    })();
    return adminPanelsCountRequest;
  }

  function applyDashboardFinalAdjustments(){
    if(!isAnyAdminFinal()) return;
    if(typeof ensurePanelAdminDashboardCardsFinal === 'function') ensurePanelAdminDashboardCardsFinal();
    prepareSalesTodayToggleFinal();
    setSalesDetailCardsFinal(salesDetailsExpandedFinal);
    movePanelsAdminToMainDashboardFinal();
  }

  const prevLoadSalesReport = typeof loadSalesReport === 'function' ? loadSalesReport : null;
  if(prevLoadSalesReport){
    loadSalesReport = async function(forceToday=false){
      const result = await prevLoadSalesReport(forceToday);
      prepareSalesTodayToggleFinal();
      setSalesDetailCardsFinal(salesDetailsExpandedFinal);
      movePanelsAdminToMainDashboardFinal();
      return result;
    };
  }

  const prevLoadAdminPanels = typeof loadAdminPanelsPhase1 === 'function' ? loadAdminPanelsPhase1 : null;
  if(prevLoadAdminPanels){
    loadAdminPanelsPhase1 = async function(){
      const result = await prevLoadAdminPanels();
      updateAdminPanelsCountFinal();
      return result;
    };
  }

  registerSectionHook(function dashboardAdjustmentsSectionHook(name){
    if(name === 'dashboard' || name === 'admin') applyDashboardFinalAdjustments();
  });

  registerLoadAppHook(function dashboardAdjustmentsLoadAppHook(){
    // Mantener cerrado el resumen hasta que el usuario toque Ventas hoy.
    salesDetailsExpandedFinal = false;
    applyDashboardFinalAdjustments();
    setSalesDetailCardsFinal(false);
  }, { name:'dashboard-final-adjustments', order:300 });

  window.toggleSalesTodayDetailsFinal = function(){
    salesDetailsExpandedFinal = !salesDetailsExpandedFinal;
    setSalesDetailCardsFinal(salesDetailsExpandedFinal);
  };

})();


// ===============================
// FIX FINAL 2026-06-08 03:25:07
// Ventas hoy debe mandar al apartado de Reporte de ventas en la misma página
// y NO desplegar tarjetas sueltas en el dashboard principal.
// ===============================
(function(){
  function hideDashboardSalesExtraCards(){
    ['panelSuccessOrdersCard','panelProfitTodayCard','panelCostTodayCard'].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.classList.add('hidden');
      el.style.display = 'none';
    });
  }

  async function goToSalesReportSamePage(){
    try {
      if (typeof showSection === 'function') showSection('admin');

      const panel = document.getElementById('adminSalesReportPanel');
      if (panel) {
        panel.classList.remove('hidden');
        panel.style.display = '';
      }

      if (typeof setTodaySalesDate === 'function') setTodaySalesDate();
      if (typeof loadSalesReport === 'function') {
        try { await loadSalesReport(true); } catch(e) { console.warn('No se pudo cargar reporte de ventas', e); }
      }

      runAfterNextPaint(() => {
        const target = document.getElementById('adminSalesReportPanel');
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    } catch(e) {
      console.error('Error abriendo Ventas hoy', e);
    }

    hideDashboardSalesExtraCards();
  }

  function bindVentasHoyButton(){
    const salesCard = document.getElementById('dashSalesTodayCard');
    if (salesCard) {
      salesCard.onclick = goToSalesReportSamePage;
      salesCard.title = 'Ver reporte de ventas de hoy';
      salesCard.classList.add('clickable');
    }

    document.querySelectorAll('[onclick="openSalesReport()"]').forEach(el => {
      if (el.id === 'dashSalesTodayCard' || (el.textContent || '').toLowerCase().includes('ventas hoy')) {
        el.onclick = goToSalesReportSamePage;
      }
    });

    hideDashboardSalesExtraCards();
  }

  openSalesReport = goToSalesReportSamePage;
  window.openSalesReport = goToSalesReportSamePage;

  openSalesReportFinal = goToSalesReportSamePage;
  window.openSalesReportFinal = goToSalesReportSamePage;

  registerLoadAppHook(function salesTodayButtonLoadAppHook(){
    bindVentasHoyButton();
  }, { name:'sales-today-button', order:400 });

  registerSectionHook(function ventasHoySectionHook(name){
    if(name === 'dashboard' || name === 'admin') bindVentasHoyButton();
  });

  const prevLoadSalesReportVentasFix = typeof loadSalesReport === 'function' ? loadSalesReport : null;
  if (prevLoadSalesReportVentasFix) {
    loadSalesReport = async function(forceToday=false){
      const result = await prevLoadSalesReportVentasFix(forceToday);
      hideDashboardSalesExtraCards();
      bindVentasHoyButton();
      return result;
    };
  }

})();


// ===============================
// ROLES VISUALES SEPARADOS - 2026-06-08 03:36:19
// Admin distribuidor != Panel propietario
// ===============================
(function(){
  function roleLabelForCurrentUser(){
    if (!currentUser) return '';
    const isPanelOwner = currentUser.is_panel_admin === true || currentUser.is_panel_admin === 1 || currentUser.is_panel_admin === 'true' || currentUser.account_type === 'panel_propietario';
    const isDistributor = !isPanelOwner && (currentUser.is_subadmin === true || currentUser.is_subadmin === 1 || currentUser.is_subadmin === 'true' || currentUser.account_type === 'admin_distribuidor');
    if (isPanelOwner) return 'Panel propietario';
    if (isDistributor) return 'Admin distribuidor';
    if (currentUser.role === 'admin') return 'Admin global';
    return 'Usuario';
  }

  function applyRoleLabels(){
    const userRoleEl = document.getElementById('userRole');
    if (userRoleEl && currentUser) userRoleEl.textContent = roleLabelForCurrentUser();

    document.querySelectorAll('.chip').forEach(chip => {
      if ((chip.textContent || '').trim() === 'Admin independiente') chip.textContent = 'Admin distribuidor';
    });
  }

  registerLoadAppHook(function roleLabelsLoadAppHook(){
    applyRoleLabels();
  }, { name:'role-labels', order:500 });

  const oldLoadUsersRoleLabels = typeof loadUsers === 'function' ? loadUsers : null;
  if (oldLoadUsersRoleLabels) {
    loadUsers = async function(){
      const result = await oldLoadUsersRoleLabels();
      applyRoleLabels();
      return result;
    };
  }

})();


// ===============================
// JERARQUÍA PANEL PROPIETARIO + ANUNCIOS PROPIOS - 2026-06-08 03:50:31
// ===============================
(function(){
  function isTrue(v){ return v === true || v === 1 || v === 'true'; }
  function userAccountLabel(u){
    if (isTrue(u.is_panel_admin) || u.account_type === 'panel_propietario') return 'Panel propietario';
    if (u.account_type === 'distribuidor_del_panel') return 'Distribuidor del panel';
    if (u.account_type === 'vendedor_panel') return 'Vendedor de panel';
    if (isTrue(u.is_subadmin)) return 'Admin distribuidor';
    if (u.role === 'admin') return 'Admin global';
    return 'Usuario';
  }
  function ownerText(u){
    if (u.owner_panel_name || u.owner_name || u.owner_email) {
      return `<p><b>Panel:</b> ${safeText(u.owner_panel_name || u.owner_name || 'Panel propietario')}${u.owner_email ? ` <span class="small-text">(${safeText(u.owner_email)})</span>` : ''}</p>`;
    }
    return '';
  }
  function movementText(value){
    if(!value) return 'Sin movimientos registrados';
    const d = new Date(value);
    if(Number.isNaN(d.getTime())) return 'Sin movimientos registrados';
    return d.toLocaleString('es-MX');
  }
  function actionForUser(u){
    const isPanelOwner = isTrue(u.is_panel_admin) || u.account_type === 'panel_propietario';
    if (isPanelOwner || u.role === 'admin') return '';
    const isDistributor = isTrue(u.is_subadmin);
    const belongsToPanel = isTrue(u.belongs_to_panel_owner) || u.account_type === 'vendedor_panel' || u.account_type === 'distribuidor_del_panel' || !!u.owner_panel_id;
    const textOn = belongsToPanel ? 'Convertir en distribuidor del panel' : 'Convertir en admin distribuidor';
    const textOff = belongsToPanel ? 'Quitar distribuidor del panel' : 'Quitar admin distribuidor';
    const enabled = !(u.is_enabled === false || u.is_enabled === 0 || u.is_enabled === 'false');
    const canManage = Number(u.id) !== Number(currentUser?.id);
    const manageButtons = canManage
      ? `<button class="outline-btn" onclick="adminSetUserEnabled(${u.id}, ${enabled ? 'false' : 'true'})">${enabled ? 'Deshabilitar' : 'Habilitar'}</button><button class="danger-btn" onclick="adminDeleteUser(${u.id})">Eliminar</button>`
      : '';
    return `<div class="tools" style="margin-bottom:0"><button class="outline-btn" onclick="toggleSubadmin(${u.id}, ${isDistributor ? 'false' : 'true'})">${isDistributor ? textOff : textOn}</button>${manageButtons}</div>`;
  }
  function renderUsersWithHierarchy(){
    const box = document.getElementById('usersList');
    if (!box || !Array.isArray(allUsers)) return;
    box.innerHTML = allUsers.map(u => {
      const label = userAccountLabel(u);
      const chipClass = label === 'Panel propietario' ? 'chip' : 'chip';
      const enabled = !(u.is_enabled === false || u.is_enabled === 0 || u.is_enabled === 'false');
      const statusChip = enabled
        ? '<span class="chip" style="background:#dcfce7;color:#166534">Activo</span>'
        : '<span class="chip" style="background:#fee2e2;color:#991b1b">Deshabilitado</span>';
      return `<div class="item">
        <p><b>ID:</b> ${u.id}</p>
        <p><b>Nombre:</b> ${safeText(u.name)}</p>
        <p><b>Correo:</b> ${safeText(u.email)}</p>
        <p><b>Rol:</b> ${safeText(u.role)} <span class="${chipClass}">${safeText(label)}</span></p>
        ${ownerText(u)}
        <p><b>Saldo:</b> $${formatMoney(u.balance)}</p>
        <p><b>Estado:</b> ${statusChip}</p>
        <p><b>Último movimiento:</b> ${movementText(u.last_activity_at)}</p>
        <p><b>Movimientos 2 meses:</b> ${Number(u.movements_2m||0)}</p>
        ${actionForUser(u)}
      </div>`;
    }).join('') || 'No hay usuarios.';
  }

  async function loadAdminUsersPanelFinal(){
    const box = document.getElementById('usersList');
    if (!box) return;
    try{
      box.textContent = 'Cargando usuarios...';
      const users = await api('/api/admin/users');
      allUsers = Array.isArray(users) ? users : [];

      const statUsersEl = document.getElementById('statUsers');
      if(statUsersEl) statUsersEl.textContent = String(allUsers.length);
      const adminUsersCountEl = document.getElementById('adminUsersCount');
      if(adminUsersCountEl) adminUsersCountEl.textContent = String(allUsers.length);

      const balanceUserSelect = document.getElementById('balanceUserSelect');
      const balanceUserId = document.getElementById('balanceUserId');
      if(balanceUserSelect){
        balanceUserSelect.innerHTML = '<option value="">Selecciona usuario</option>' + allUsers.map(u => `<option value="${u.id}">${safeText(u.name)} (${safeText(u.email)}) - $${formatMoney(u.balance)}</option>`).join('');
        balanceUserSelect.onchange = () => {
          if(balanceUserId) balanceUserId.value = balanceUserSelect.value;
        };
      }

      box.innerHTML = allUsers.length ? allUsers.map(u => {
        const isPanelOwner = u.is_panel_admin === true || u.is_panel_admin === 1 || u.is_panel_admin === 'true';
        const isDistributor = !isPanelOwner && (u.is_subadmin === true || u.is_subadmin === 1 || u.is_subadmin === 'true');
        const enabled = !(u.is_enabled === false || u.is_enabled === 0 || u.is_enabled === 'false');
        const statusChip = enabled
          ? '<span class="chip" style="background:#dcfce7;color:#166534">Activo</span>'
          : '<span class="chip" style="background:#fee2e2;color:#991b1b">Deshabilitado</span>';
        const roleLabel = isPanelOwner ? 'Panel propietario' : (isDistributor ? 'Admin distribuidor' : 'Usuario');
        const manageButtons = (Number(u.id) !== Number(currentUser?.id) && !isPanelOwner && u.role !== 'admin')
          ? `<div class="tools" style="margin-bottom:0"><button class="outline-btn" onclick="toggleSubadmin(${u.id}, ${isDistributor ? 'false' : 'true'})">${isDistributor ? 'Quitar admin distribuidor' : 'Convertir en admin distribuidor'}</button><button class="outline-btn" onclick="adminSetUserEnabled(${u.id}, ${enabled ? 'false' : 'true'})">${enabled ? 'Deshabilitar' : 'Habilitar'}</button><button class="danger-btn" onclick="adminDeleteUser(${u.id})">Eliminar</button></div>`
          : '';
        return `<div class="item"><p><b>ID:</b> ${u.id}</p><p><b>Nombre:</b> ${safeText(u.name)}</p><p><b>Correo:</b> ${safeText(u.email)}</p><p><b>Rol:</b> ${safeText(u.role)} <span class="chip">${safeText(roleLabel)}</span></p><p><b>Saldo:</b> $${formatMoney(u.balance)}</p><p><b>Estado:</b> ${statusChip}</p><p><b>Último movimiento:</b> ${u.last_activity_at ? safeText(String(u.last_activity_at).replace('T', ' ').slice(0, 19)) : 'Sin movimientos registrados'}</p><p><b>Movimientos 2 meses:</b> ${Number(u.movements_2m || 0)}</p>${manageButtons}</div>`;
      }).join('') : 'No hay usuarios.';
    }catch(e){
      box.textContent = 'No se pudieron cargar los usuarios.';
      console.warn('Error cargando usuarios del panel admin', e);
    }
  }

  window.loadAdminUsersPanelFinal = loadAdminUsersPanelFinal;
  const oldLoadUsersHierarchy = typeof loadUsers === 'function' ? loadUsers : null;
  if (oldLoadUsersHierarchy) {
    loadUsers = async function(){
      const result = await oldLoadUsersHierarchy();
      renderUsersWithHierarchy();
      return result;
    };
  }
  registerSectionHook(function usersHierarchySectionHook(name){
    if(name === 'admin') renderUsersWithHierarchy();
  });
})();

if(typeof window.adminSetUserEnabled !== 'function'){
  window.adminSetUserEnabled = async function(userId, enabled){
    try{
      const enableValue = enabled === true || enabled === 'true';
      if(!confirm(enableValue ? '¿Habilitar este usuario?' : '¿Deshabilitar este usuario?')) return;
      const data = await api('/api/admin/users/'+userId+'/status', {
        method:'PATCH',
        body: JSON.stringify({ enabled: enableValue })
      });
      showMessage(data.message || (enableValue ? 'Usuario habilitado' : 'Usuario deshabilitado'));
      if(typeof loadUsers === 'function') await loadUsers();
    }catch(e){ showMessage(e.message || 'Error cambiando estado del usuario','error'); }
  };
}

if(typeof window.adminDeleteUser !== 'function'){
  window.adminDeleteUser = async function(userId){
    try{
      if(!confirm('¿Seguro que quieres eliminar este usuario? Solo se permite si no tiene movimientos.')) return;
      const data = await api('/api/admin/users/'+userId, { method:'DELETE' });
      showMessage(data.message || 'Usuario eliminado');
      if(typeof loadUsers === 'function') await loadUsers();
    }catch(e){ showMessage(e.message || 'No se pudo eliminar usuario','error'); }
  };
}



// ===============================
// FIX ESTABLE: COMBOS REPORTABLES SIN ROMPER TIENDA - 2026-06-09 02:15:25
// No modifica toggleProduct ni el despliegue de tienda.
// ===============================
(function(){
  // Ocultar cualquier input de cantidad si quedó de versiones anteriores, sin tocar contenedores.
  function removeMultiQtyUI(){
    document.querySelectorAll('[id^="qty-"]').forEach(input => {
      input.value = 1;
      input.style.display = 'none';
      const label = input.previousElementSibling;
      if(label && (label.textContent||'').toLowerCase().includes('cantidad')) label.style.display='none';
    });
    document.querySelectorAll('.small-text').forEach(el => {
      const t=(el.textContent||'').toLowerCase();
      if(t.includes('varias cuentas') || t.includes('varios perfiles') || t.includes('misma plataforma')) el.style.display='none';
    });
  }

// Compra individual; no cambia el abrir/cerrar del producto.
// Después de comprar solo se refrescan los datos afectados: saldo, pedidos y stock.
const __purchaseRequestsInFlight = new Set();

function applyCurrentUserPurchaseSnapshot(user){
  if(!user || typeof user !== 'object') return;
  currentUser = { ...(currentUser || {}), ...user };

  const formattedBalance = formatMoney(currentUser.balance);
  const userBalanceEl = document.getElementById('userBalance');
  const topUserBalanceEl = document.getElementById('topUserBalance');
  if(userBalanceEl) userBalanceEl.textContent = formattedBalance;
  if(topUserBalanceEl) topUserBalanceEl.textContent = formattedBalance;
}

async function refreshAfterPurchase(){
  const runOnce = typeof runSectionLoadOnce === 'function'
    ? runSectionLoadOnce
    : function(_key, loader){ return Promise.resolve().then(loader); };

  const tasks = [
    runOnce('orders', () => typeof loadMyOrders === 'function' ? loadMyOrders() : Promise.resolve()),
    runOnce('shop', () => typeof loadProducts === 'function' ? loadProducts() : Promise.resolve()),
    runOnce('purchase-user-summary', async () => {
      const freshUser = await api('/api/me');
      applyCurrentUserPurchaseSnapshot(freshUser);
    })
  ];

  // Si el comprador es un administrador, refrescar solamente el reporte de hoy
  // para actualizar las graficas; nunca volver a ejecutar loadApp completo.
  if(currentUser?.role === 'admin' && typeof loadSalesReport === 'function'){
    tasks.push(runOnce('sales-report-after-purchase', () => loadSalesReport(true)));
  }

  const results = await Promise.allSettled(tasks);
  const errors = results
    .filter(result => result.status === 'rejected')
    .map(result => result.reason);

  if(errors.length){
    console.warn('La compra se completó, pero algunos datos no pudieron refrescarse de inmediato:', errors);
  }
}

window.refreshAfterPurchase = refreshAfterPurchase;

window.buyProduct = async function(productId){
  const purchaseKey = String(productId);
  if(__purchaseRequestsInFlight.has(purchaseKey)){
    showMessage('Esta compra ya se está procesando. Espera un momento.');
    return;
  }

  try {
    const product = (allProducts || []).find(p=>Number(p.id)===Number(productId)) ||
      await api('/api/products').then(ps=>ps.find(p=>Number(p.id)===Number(productId)));
    if(!product) throw new Error('Producto no encontrado');

    if(!confirm(`Vas a comprar: ${product.name}\nCosto: $${formatMoney(product.price)}\n\n¿Confirmas la compra?`)) return;

    __purchaseRequestsInFlight.add(purchaseKey);

    const fields = parseJsonArray(product.required_fields);
    const order_data = {};
    
    // Procesamos todos los campos uno por uno
    for (let i = 0; i < fields.length; i++) {
        const f = fields[i];
        const input = document.getElementById(`field-${productId}-${f}`);
        
        if (input) {
            // Si el input es un botón de archivo...
            if (input.type === 'file') {
                if (input.files.length > 0) {
                    const file = input.files[0];
                    if (file.size > 5 * 1024 * 1024) throw new Error(`El archivo para "${f}" es muy pesado. Máximo 5 MB.`);
                    // Convertimos la foto/pdf a texto y lo metemos en los datos de la orden
                    order_data[f] = await convertFileToBase64(file);
                } else {
                    order_data[f] = '';
                }
            } else {
                // Si es un texto normal...
                order_data[f] = input.value.trim();
            }
        }
    }

    const data = await api('/api/buy/'+productId, {
      method:'POST',
      body:JSON.stringify({ order_data, quantity: 1 })
    });

    if (typeof closeProductModal === 'function') closeProductModal();
    showMessage(data.message || 'Compra realizada');

    const hasImmediateDelivery = Boolean(data?.delivered_account_data && data?.immediate_delivery !== false);
    if (hasImmediateDelivery && typeof window.openModalEntregaInmediata === 'function') {
      window.openModalEntregaInmediata({
        ...data,
        product_name: data.product_name || product.name
      });
    } else {
      // Los pedidos manuales continúan enviando al usuario a Mis pedidos.
      showSection('orders');
    }

    // Actualiza pedidos, stock y saldo en segundo plano sin cerrar el modal ni
    // reconstruir toda la aplicación.
    void refreshAfterPurchase();
  } catch(e) {
    showMessage(e.message || 'Error comprando producto','error');
  } finally {
    __purchaseRequestsInFlight.delete(purchaseKey);
  }
};

  async function loadReportableAccounts(){
    try {
      const select=document.getElementById('reporteCuentaSelect');
      if(!select) return;
      const preferredId=Number(
        (typeof window.getExactReportAccountIdStable==='function' ? window.getExactReportAccountIdStable() : 0)
        || select.value
        || 0
      );
      const accounts=await api('/api/reportable-accounts');
      select.innerHTML='<option value="">Selecciona cuenta/plataforma entregada</option>'+(accounts||[]).map(a=>{
        const replacementLabel=a.is_replacement===true || a.is_replacement==='true' ? ' | Reemplazo vigente' : '';
        const label=`Pedido #${a.order_id} | ${a.platform||a.product_name||'Plataforma'} | ${a.account_email||''}${a.profile_name?' | Perfil: '+a.profile_name:''} | ID #${a.id}${replacementLabel}`;
        return `<option value="${a.id}" data-email="${safeText(a.account_email||'')}">${safeText(label)}</option>`;
      }).join('');
      if(preferredId>0 && Array.from(select.options).some(opt=>Number(opt.value||0)===preferredId)){
        select.value=String(preferredId);
        select.dispatchEvent(new Event('change',{bubbles:true}));
      }
    } catch(e) {
      console.warn('No se pudieron cargar cuentas reportables', e);
    }
  }

  function ensureReportSelect(){
    const correo=document.getElementById('reporteCorreo');
    if(!correo || document.getElementById('reporteCuentaSelect')) return;
    const div=document.createElement('div');
    div.innerHTML=`<label class="field-label">Cuenta/plataforma que falló</label>
      <select id="reporteCuentaSelect" onchange="onSelectReportAccountStable()">
        <option value="">Cargando cuentas...</option>
      </select>
      <p class="small-text">Si fue un combo, selecciona exactamente la plataforma/cuenta que falló.</p>`;
    correo.parentNode.insertBefore(div, correo);
    loadReportableAccounts();
  }

  window.loadReportableAccountsStable = loadReportableAccounts;
  window.ensureReportSelectStable = ensureReportSelect;

  window.onSelectReportAccountStable=function(){
    const select=document.getElementById('reporteCuentaSelect');
    const opt=select?.selectedOptions?.[0];
    const selectedId=Number(select?.value||0);
    if(typeof window.setExactReportAccountIdStable==='function'){
      window.setExactReportAccountIdStable(selectedId);
    }
    const email=opt?.getAttribute('data-email')||'';
    const correo=document.getElementById('reporteCorreo');
    if(correo && email) correo.value=email;
  };

  async function chooseComboAccount(reportId){
    const data=await api('/api/admin/account-reports/'+reportId+'/order-accounts');
    const exactReportedAccountId=Number(data?.reported_account_id||0);
    if(exactReportedAccountId>0) return exactReportedAccountId;
    const accounts=data.accounts||[];
    if(accounts.length<=1) return accounts[0]?.id || 0;
    const list=accounts.map((a,i)=>`${i+1}) ${a.platform||a.product_name||'Plataforma'} | ${a.account_email||''}${a.profile_name?' | Perfil: '+a.profile_name:''} | Estado: ${a.status}`).join('\n');
    const ans=prompt('Selecciona qué cuenta/plataforma del combo será reemplazada:\n\n'+list);
    if(ans===null) throw new Error('Reemplazo cancelado');
    const idx=Number(ans)-1;
    if(!Number.isInteger(idx)||idx<0||idx>=accounts.length) throw new Error('Opción inválida');
    return accounts[idx].id;
  }

  async function chooseInventoryReplacement(reportId, reportedAccountId){
    const query = reportedAccountId ? ('?reported_account_id='+reportedAccountId) : '';
    const data=await api('/api/admin/account-reports/'+reportId+'/replacement-options'+query);
    const options=data.options||[];
    if(!options.length) throw new Error('No hay cuentas disponibles para esa plataforma. Captura manualmente una cuenta.');
    const list=options.map((a,i)=>`${i+1}) ${a.platform||a.product_name||'Plataforma'} | ${a.account_email||''}${a.profile_name?' | Perfil: '+a.profile_name:''}`).join('\n');
    const ans=prompt('Selecciona la cuenta disponible para entregar:\n\n'+list);
    if(ans===null) throw new Error('Reemplazo cancelado');
    const idx=Number(ans)-1;
    if(!Number.isInteger(idx)||idx<0||idx>=options.length) throw new Error('Opción inválida');
    return options[idx].id;
  }

  function showCopyBox(text){
    const old=document.getElementById('replacementCopyBox');
    if(old) old.remove();
    const box=document.createElement('div');
    box.id='replacementCopyBox';
    box.className='modal-backdrop';
    box.innerHTML=`<div class="modal-card">
      <h2>Cuenta de reemplazo entregada</h2>
      <p class="small-text">Copia estos datos para enviarlos al cliente.</p>
      <textarea id="replacementCopyText" style="min-height:240px">${safeText(text||'')}</textarea>
      <div class="two-row">
        <button class="primary-btn" onclick="copyReplacementTextStable()">Copiar datos</button>
        <button class="outline-btn" onclick="document.getElementById('replacementCopyBox').remove()">Cerrar</button>
      </div>
    </div>`;
    document.body.appendChild(box);
  }
  window.showReplacementCopyBox = showCopyBox;

  window.copyReplacementTextStable=async function(){
    const text=document.getElementById('replacementCopyText')?.value||'';
    try {
      await navigator.clipboard.writeText(text);
      showMessage('Datos copiados');
    } catch(e) {
      const area=document.getElementById('replacementCopyText');
      if(area) {
        area.focus();
        area.select();
        document.execCommand('copy');
        showMessage('Datos copiados');
      }
    }
  };

  window.replaceReportedAccount=async function(reportId){
    try {
      const comboAccountId=await chooseComboAccount(reportId);
      const useManual=confirm('¿Capturar manualmente la cuenta de reemplazo?\n\nAceptar = Manual\nCancelar = Elegir del inventario disponible');
      let body={};
      if(comboAccountId) body.reported_account_id=comboAccountId;

      if(useManual) {
        const account_email=prompt('Correo de la cuenta nueva:');
        if(!account_email) throw new Error('Correo obligatorio');
        const account_password=prompt('Contraseña de la cuenta nueva:');
        if(!account_password) throw new Error('Contraseña obligatoria');
        body={
          ...body,
          manual:true,
          account_email:account_email.trim(),
          account_password:account_password.trim(),
          profile_name:(prompt('Perfil (opcional):','')||'').trim(),
          profile_pin:(prompt('PIN (opcional):','')||'').trim(),
          access_url:(prompt('URL opcional:','')||'').trim(),
          extra_data:(prompt('Notas extra opcional:','')||'').trim()
        };
      } else {
        body={...body, manual:false, replacement_account_id: await chooseInventoryReplacement(reportId, comboAccountId)};
      }

      const data=await api('/api/admin/account-reports/'+reportId+'/replace', {
        method:'POST',
        body:JSON.stringify(body)
      });

      showMessage(data.message || 'Cuenta reemplazada');
      if(data.delivered_account_data) showCopyBox(data.delivered_account_data);
      if(typeof loadAccountReports==='function') await loadAccountReports();
      if(typeof loadPlatformInventory==='function') await loadPlatformInventory();
    } catch(e) {
      showMessage(e.message || 'Error reemplazando cuenta','error');
    }
  };
  replaceReportedAccount=window.replaceReportedAccount;

  registerSectionHook(function reportsAndShopSectionHook(name){
    if(name === 'reports') ensureReportSelect();
    if(name === 'shop') removeMultiQtyUI();
  });

  registerLoadAppHook(function reportsAndShopLoadAppHook(){
    ensureReportSelect();
    removeMultiQtyUI();
  }, { name:'reports-and-shop-ui', order:600 });
})();



// ===============================
// FIX CONTABILIZAR X2 COMO CUENTAS VENDIDAS - 2026-06-09 02:27:10
// Ya no hay compra múltiple, pero pedidos históricos tipo "Netflix perfil x2"
// deben sumarse como 2 dentro de "Netflix perfil".
// ===============================
(function(){
  function baseNameNoX(name){
    return String(name || '').replace(/\s+x\d+$/i, '').trim();
  }

  function qtyFromXName(name, fallback){
    const m = String(name || '').match(/\s+x(\d+)$/i);
    const byName = m ? Math.max(1, Number(m[1] || 1)) : 0;
    const byValue = Number(fallback || 0) || 0;
    return Math.max(byName || 1, byValue || 1);
  }

  function mergeProductsX(list){
    const map = new Map();
    (list || []).forEach(item => {
      const raw = item.product_name || item.name || item.product || '';
      const base = baseNameNoX(raw);
      const qty = qtyFromXName(raw, item.orders ?? item.count ?? item.total ?? item.value ?? 0);
      const key = base.toLowerCase();
      const prev = map.get(key) || {
        ...item,
        product_name: base,
        name: base,
        product: base,
        orders: 0,
        count: 0,
        total: 0,
        value: 0
      };
      const current = Number(prev.orders || prev.count || prev.total || prev.value || 0) || 0;
      const newTotal = current + qty;
      prev.orders = newTotal;
      prev.count = newTotal;
      prev.total = newTotal;
      prev.value = newTotal;
      map.set(key, prev);
    });
    return Array.from(map.values()).sort((a,b)=>Number(b.orders||b.count||0)-Number(a.orders||a.count||0));
  }

  window.mergeProductsX = mergeProductsX;

  // Intercepta gráficas del dashboard principal.
  const oldRenderDashboardChartsMergeX = typeof renderDashboardCharts === 'function' ? renderDashboardCharts : null;
  if (oldRenderDashboardChartsMergeX) {
    window.renderDashboardCharts = function(data){
      if (data && Array.isArray(data.top_products)) {
        data.top_products = mergeProductsX(data.top_products);
      }
      return oldRenderDashboardChartsMergeX(data);
    };
    renderDashboardCharts = window.renderDashboardCharts;
  }

  // Intercepta posibles renderizadores de productos más vendidos.
  ['renderTopProductsChart','renderProductsChart','renderSalesByProduct'].forEach(fnName => {
    const oldFn = window[fnName];
    if (typeof oldFn === 'function') {
      window[fnName] = function(list, ...rest){
        if (Array.isArray(list)) list = mergeProductsX(list);
        return oldFn(list, ...rest);
      };
      try { eval(fnName + ' = window[fnName]'); } catch(e) {}
    }
  });

  // Corrección visual por si el backend/listado ya pintó "Netflix perfil x2" separado.
  function fixVisibleXProducts(){
    const targets = [
      document.getElementById('dashboardTopProductsChart'),
      document.getElementById('salesByProductList')
    ].filter(Boolean);

    targets.forEach(box => {
      const text = box.innerText || '';
      if (!/\sx\d+/i.test(text)) return;

      const lines = text.split('\n').map(x=>x.trim()).filter(Boolean);
      const map = new Map();

      lines.forEach(line => {
        const m = line.match(/^(.*?)(?:\s+)(\d+)$/);
        if (!m) return;
        const rawName = m[1].trim();
        const count = Number(m[2] || 0);
        if (!rawName || rawName.toLowerCase().includes('productos')) return;
        const base = baseNameNoX(rawName);
        const qty = qtyFromXName(rawName, count);
        const key = base.toLowerCase();
        map.set(key, { name: base, count: (map.get(key)?.count || 0) + qty });
      });

      if (!map.size) return;
      const merged = Array.from(map.values()).sort((a,b)=>b.count-a.count);
      const total = merged.reduce((s,x)=>s+x.count,0);

      if (box.id === 'dashboardTopProductsChart') {
        const rows = merged.map(p=>`
          <div class="legend-item">
            <span class="legend-dot"></span>
            <span class="legend-name">${p.name}</span>
            <span class="legend-value">${p.count}</span>
          </div>
        `).join('');
        box.innerHTML = `
          <div class="donut-summary">
            <div class="donut">
              <div class="donut-center">${total}<span>cuentas</span></div>
            </div>
            <div class="legend-list">${rows}</div>
          </div>
        `;
      } else {
        box.innerHTML = merged.map(p=>`
          <div class="item">
            <p><b>${p.name}</b></p>
            <p><b>Cuentas vendidas:</b> ${p.count}</p>
          </div>
        `).join('');
      }
    });
  }

  const oldLoadDashboardStatsMergeX = typeof loadDashboardStats === 'function' ? loadDashboardStats : null;
  if (oldLoadDashboardStatsMergeX) {
    window.loadDashboardStats = async function(){
      const result = await oldLoadDashboardStatsMergeX();
      fixVisibleXProducts();
      return result;
    };
    loadDashboardStats = window.loadDashboardStats;
  }

  const oldLoadSalesReportMergeX = typeof loadSalesReport === 'function' ? loadSalesReport : null;
  if (oldLoadSalesReportMergeX) {
    window.loadSalesReport = async function(...args){
      const result = await oldLoadSalesReportMergeX(...args);
      fixVisibleXProducts();
      return result;
    };
    loadSalesReport = window.loadSalesReport;
  }

})();



// Los botones de reemplazo ahora se renderizan directamente en cada reporte.


// ===============================
// FIX SALDO PENDIENTE + NOTIFICACIONES - 2026-06-09 04:01:41
// ===============================
(function(){
  function removeBrokenVentasProductoFromBalance(){
    const adminPanel = document.getElementById('adminBalanceRequestsPanel');
    if (!adminPanel) return;
    const txt = (adminPanel.innerText || '').toLowerCase();
    if (txt.includes('ventas por producto') || txt.includes('productos más vendidos')) {
      loadBalanceRequests();
    }
  }

  window.openBalanceRequests = function(){
    if (currentUser && currentUser.role === 'admin') {
      showSection('admin');
      setTimeout(() => {
        loadBalanceRequests();
        const panel = document.getElementById('adminBalanceRequestsPanel');
        if (panel) panel.scrollIntoView({ behavior:'smooth', block:'start' });
        removeBrokenVentasProductoFromBalance();
      }, 120);
    } else {
      showSection('balance');
    }
  };

  function bindSaldoPendienteCard(){
    document.querySelectorAll('.dash-card').forEach(card => {
      const label = (card.innerText || '').toLowerCase();
      if (label.includes('saldo pendiente')) {
        card.onclick = function(ev){
          ev.preventDefault();
          ev.stopPropagation();
          openBalanceRequests();
        };
      }
    });
  }

  async function notifyBalanceRequest(requestId){
    try {
      const data = await api('/api/admin/balance-requests/' + requestId + '/notify', { method:'POST' });
      showMessage(data.message || 'Notificación enviada');
    } catch(e) {
      showMessage(e.message || 'Error enviando notificación', 'error');
    }
  }
  window.notifyBalanceRequest = notifyBalanceRequest;

  async function notifyAccountReport(reportId){
    try {
      const data = await api('/api/admin/account-reports/' + reportId + '/notify', { method:'POST' });
      showMessage(data.message || 'Notificación enviada');
    } catch(e) {
      showMessage(e.message || 'Error enviando notificación', 'error');
    }
  }
  window.notifyAccountReport = notifyAccountReport;

  function addNotifyButtons(){
    // Solicitudes de saldo
    const balanceBox = document.getElementById('adminBalanceRequestsList');
    if (balanceBox) {
      balanceBox.querySelectorAll('.item').forEach(item => {
        if (item.querySelector('.notify-balance-btn')) return;
        const text = item.innerText || '';
        const m = text.match(/Solicitud:\s*#(\d+)/i);
        if (!m) return;
        const id = m[1];
        const btn = document.createElement('button');
        btn.className = 'outline-btn notify-balance-btn';
        btn.type = 'button';
        btn.style.marginTop = '10px';
        btn.textContent = '📩 Notificar saldo al usuario';
        btn.onclick = function(ev) {
          ev.preventDefault();
          ev.stopPropagation();
          notifyBalanceRequest(id);
        };
        item.appendChild(btn);
      });
    }

    // Reportes de falla
    const reportsBox = document.getElementById('adminAccountReportsList');
    if (reportsBox) {
      reportsBox.querySelectorAll('.item').forEach(item => {
        if (item.querySelector('.notify-report-btn')) return;
        const text = item.innerText || '';
        const m = text.match(/Reporte:\s*#(\d+)|Reporte\s*#(\d+)/i);
        const id = m ? (m[1] || m[2]) : null;
        if (!id) return;
        const btn = document.createElement('button');
        btn.className = 'outline-btn notify-report-btn';
        btn.type = 'button';
        btn.style.marginTop = '10px';
        btn.textContent = '📩 Notificar reporte atendido';
        btn.onclick = function(ev) {
          ev.preventDefault();
          ev.stopPropagation();
          notifyAccountReport(id);
        };
        item.appendChild(btn);
      });
    }
  }

  const prevLoadBalanceRequestsNotify = typeof loadBalanceRequests === 'function' ? loadBalanceRequests : null;
  if (prevLoadBalanceRequestsNotify) {
    window.loadBalanceRequests = async function(){
      const result = await prevLoadBalanceRequestsNotify();
      addNotifyButtons();
      bindSaldoPendienteCard();
      return result;
    };
    loadBalanceRequests = window.loadBalanceRequests;
  }

  const prevLoadAccountReportsNotify = typeof loadAccountReports === 'function' ? loadAccountReports : null;
  if (prevLoadAccountReportsNotify) {
    window.loadAccountReports = async function(){
      const result = await prevLoadAccountReportsNotify();
      addNotifyButtons();
      return result;
    };
    loadAccountReports = window.loadAccountReports;
  }

registerSectionHook(function saldoAndNotificationsSectionHook(name){
    if(name === 'dashboard' || name === 'balance') bindSaldoPendienteCard();
    if(name === 'admin') addNotifyButtons();
});
});  


// ==========================================
// ==========================================
// BOTÓN MORADO DE INGRESO MANUAL SEGURO
// ==========================================
async function forzarIngresoManual(reportId) {
  const email = prompt("1/5 - Ingrese el NUEVO CORREO electrónico:");
  if (!email) return;
  const password = prompt("2/5 - Ingrese la NUEVA CONTRASEÑA:");
  if (!password) return;
  const profile = prompt("3/5 - PERFIL asignado (Opcional):") || "";
  const pin = prompt("4/5 - PIN de acceso (Opcional):") || "";
  const url = prompt("5/5 - URL de acceso (Opcional):") || "";

  if (!confirm(`¿Confirmas entregar esta cuenta al cliente?\nCorreo: ${email}`)) return;

  try {
    const res = await fetch('/api/admin/reemplazo-manual-seguro', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reportId, email, password, profile, pin, url })
    });
    
    const data = await res.json();
    if (data.success) {
      alert("¡Éxito! La cuenta se entregó al cliente correctamente.");
      if (typeof loadAccountReports === 'function') loadAccountReports();
      else location.reload();
    } else {
      alert("Error: " + data.error);
    }
  } catch (err) {
    alert("Error de conexión: " + err.message);
  }
}

// Inyector desactivado: el barrido global cada 2s degradaba el rendimiento del panel admin.
// ==========================================
// RECUPERACIÓN DE CONTRASEÑA
// ==========================================

function mostrarRecuperacion() {

  const html = `
    <div id="recoveryModal" class="modal-overlay">
      <div class="modal-box">

        <h2>Recuperar contraseña</h2>

        <input
          id="recoveryEmail"
          type="email"
          placeholder="Tu correo"
        />

        <button onclick="solicitarCodigo()">
          Enviar código
        </button>

        <hr>

        <input
          id="recoveryCode"
          placeholder="Código recibido"
        />

        <input
          id="newPassword"
          type="password"
          placeholder="Nueva contraseña"
        />

        <button onclick="cambiarContrasena()">
          Cambiar contraseña
        </button>

        <button onclick="cerrarRecuperacion()">
          Cerrar
        </button>

      </div>
    </div>
  `;

  document.body.insertAdjacentHTML(
    "beforeend",
    html
  );

}

function cerrarRecuperacion() {

  const modal =
    document.getElementById(
      "recoveryModal"
    );

  if(modal) modal.remove();

}

async function solicitarCodigo() {

  const email =
    document.getElementById(
      "recoveryEmail"
    ).value;

  try {

    const res =
      await fetch(
        "/api/solicitar-codigo",
        {
          method:"POST",
          headers:{
            "Content-Type":"application/json"
          },
          body:JSON.stringify({
            email
          })
        }
      );

    const data =
      await res.json();

    alert(
      data.message ||
      data.error
    );

  } catch(err){

    alert(
      "Error enviando código"
    );

  }

}

async function cambiarContrasena() {

  const email =
    document.getElementById(
      "recoveryEmail"
    ).value;

  const codigo =
    document.getElementById(
      "recoveryCode"
    ).value;

  const nuevaContrasena =
    document.getElementById(
      "newPassword"
    ).value;

  try {

    const res =
      await fetch(
        "/api/cambiar-contrasena",
        {
          method:"POST",
          headers:{
            "Content-Type":"application/json"
          },
          body:JSON.stringify({
            email,
            codigo,
            nuevaContrasena
          })
        }
      );

    const data =
      await res.json();

    alert(
      data.message ||
      data.error
    );

    if(data.success){

      cerrarRecuperacion();

    }

  } catch(err){

    alert(
      "Error cambiando contraseña"
    );

  }

}
// ==========================================
// BOTÓN DE PÁNICO: INTERFAZ DE ADMINISTRADOR DEFINITIVA
// ==========================================
async function botonDePanico() {
  const email = prompt("🚨 BOTÓN DE PÁNICO (Admin) 🚨\n\nIngresa el CORREO EXACTO del cliente al que le vas a resetear la contraseña:");
  if (!email) return;

  const confirmacion = confirm(`¿Estás seguro de resetear la cuenta de:\n${email}?\n\nSu nueva contraseña será temporalmente: 123456`);
  if (!confirmacion) return;

  try {
    const token = localStorage.getItem('token'); 
    const res = await fetch('/api/admin/panic-reset', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ email: email })
    });
    
    const data = await res.json();
    if (data.success) {
      alert(`✅ ¡ÉXITO!\n\n${data.message}\n\nDile a tu cliente que inicie sesión con 123456 y que la cambie desde su cuenta.`);
    } else {
      alert("❌ Error: " + data.error);
    }
  } catch (err) {
    alert("❌ Error de red: " + err.message);
  }
}

// Botón de emergencia sincronizado con la sesión ya cargada.
// No vuelve a consultar /api/me cada segundo.
function syncPanicAdminButton(){
  const button = document.getElementById('adminResetPasswordBtn');
  if(!button) return;
  const isAllowed = !!currentUser && (
    currentUser.role === 'admin' ||
    currentUser.is_panel_admin === true || currentUser.is_panel_admin === 1 || currentUser.is_panel_admin === 'true' ||
    currentUser.is_subadmin === true || currentUser.is_subadmin === 1 || currentUser.is_subadmin === 'true'
  );
  button.classList.toggle('hidden', !isAllowed);
}
window.syncPanicAdminButton = syncPanicAdminButton;

registerLoadAppHook(function panicButtonLoadAppHook(){
  syncPanicAdminButton();
}, { name:'panic-button-ui', order:710 });

// ==========================================
// CAMBIO DE CONTRASEÑA DESDE EL PERFIL
// ==========================================
async function cambiarMiPassword() {
  const currentPass = document.getElementById('pass-actual').value;
  const newPass = document.getElementById('pass-nueva').value;

  if (!currentPass || !newPass) {
    return alert("⚠️ Por favor, llena ambos campos de contraseña.");
  }

  if (newPass.length < 6) {
    return alert("⚠️ La nueva contraseña debe tener al menos 6 caracteres por tu seguridad.");
  }

  const confirmacion = confirm("¿Estás seguro de que deseas actualizar tu contraseña?");
  if (!confirmacion) return;

  try {
    const token = localStorage.getItem('token');
    const res = await fetch('/api/user/change-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ currentPass: currentPass, newPass: newPass })
    });

    const data = await res.json();
    
    if (data.success) {
      alert("✅ ¡Éxito! Tu contraseña ha sido actualizada correctamente.\nRecuerda usar la nueva la próxima vez que inicies sesión.");
      // Limpiamos las cajas de texto para que no se queden escritas
      document.getElementById('pass-actual').value = '';
      document.getElementById('pass-nueva').value = '';
    } else {
      alert("❌ No se pudo cambiar: " + data.error);
    }
  } catch (err) {
    alert("❌ Error de red: " + err.message);
  }
}
    
// La visibilidad de los accesos de distribuidor se aplica desde
// applyDashboardRoleVisibilityMatrix(), sin un sondeo permanente cada segundo.

// ==========================================
// ACCESO DIRECTO A GANANCIAS (SIN ROMPER NADA)
// ==========================================
function irADirectoAGanancias() {
  // 1. Abrimos la sección de reportes
  showSection('reports');
  
  // 2. Ejecutamos la carga de ganancias si existe la función
  if (typeof loadDistributorEarnings === 'function') {
    loadDistributorEarnings();
  } else {
    console.log("ℹ️ La función de ganancias no está cargada, revisa el archivo de reportes.");
  }
}

// ==========================================
// SISTEMA DE CUARENTENA Y RECUPERACIÓN
// ==========================================
let __quarantineCheckPromise = null;
async function checkQuarantineAccounts() {
  if (!currentUser || (currentUser.role !== 'admin' && currentUser.account_type !== 'panel_propietario')) return;
  if (__quarantineCheckPromise) return __quarantineCheckPromise;

  __quarantineCheckPromise = (async () => {
    try {
      // 1. Forzar al servidor a revisar si hay cuentas que ya vencieron
      await fetch('/api/admin/system/check-expirations', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
      });

      // 2. Traer la lista de cuentas atrapadas en cuarentena
      const res = await fetch('/api/admin/accounts/quarantine', {
        headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
      });
      const quarantineList = await res.json();
      const campanaVieja = document.getElementById('btn-cuarentena-alarma');
      if (campanaVieja) campanaVieja.remove();

      const recoverBtn = document.getElementById('btnHistorialId');
      const count = Array.isArray(quarantineList) ? quarantineList.length : 0;
      if (recoverBtn) {
        recoverBtn.textContent = count > 0 ? `♻ Recuperar (${count})` : '♻ Recuperar';
        recoverBtn.onclick = () => {
          if (count > 0) showQuarantineModal(quarantineList);
          else if (typeof window.abrirModalHistorial === 'function') window.abrirModalHistorial();
        };
      }

      const stat = document.getElementById('statExpiring');
      if (stat) stat.textContent = String(count);

      const quarantineCard = document.getElementById('dashQuarantineCard');
      if (quarantineCard && currentUser && String(currentUser.role || '').toLowerCase() === 'admin') {
        quarantineCard.classList.remove('hidden');
      }
    } catch (err) {
      console.error("Error en sistema de cuarentena", err);
    }
  })().finally(() => {
    __quarantineCheckPromise = null;
  });

  return __quarantineCheckPromise;
}

let quarantineOpenRequest = null;

async function openQuarantineFromDashboard() {
  if (!currentUser || (currentUser.role !== 'admin' && currentUser.account_type !== 'panel_propietario')) {
    showMessage('No autorizado para abrir cuarentena', 'error');
    return;
  }

  // Si el usuario hace doble clic mientras la primera consulta sigue activa,
  // reutilizamos la misma solicitud y evitamos abrir/renderizar el modal dos veces.
  if (quarantineOpenRequest) return quarantineOpenRequest;

  const dashCard = document.getElementById('dashQuarantineCard');
  if (dashCard) dashCard.setAttribute('aria-busy', 'true');

  quarantineOpenRequest = (async () => {
    const response = await fetch('/api/admin/accounts/quarantine', {
      headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
    });

    if (!response.ok) {
      let message = 'No se pudo consultar la cuarentena.';
      try {
        const errorData = await response.json();
        if (errorData && errorData.error) message = errorData.error;
      } catch (_) {}
      throw new Error(message);
    }

    const list = await response.json();
    const quarantineList = Array.isArray(list) ? list : [];
    const stat = document.getElementById('statExpiring');
    if (stat) stat.textContent = String(quarantineList.length);
    showQuarantineModal(quarantineList);
  })()
    .catch(err => {
      console.error('Error abriendo cuarentena:', err);
      showMessage(err.message || 'No se pudo abrir la cuarentena.', 'error');
    })
    .finally(() => {
      if (dashCard) dashCard.removeAttribute('aria-busy');
      quarantineOpenRequest = null;
    });

  return quarantineOpenRequest;
}

function bindQuarantineDashboardCard() {
  const dashCard = document.getElementById('dashQuarantineCard');
  if (!dashCard || dashCard.dataset.quarantineClickBound === '1') return;

  dashCard.dataset.quarantineClickBound = '1';
  dashCard.addEventListener('click', openQuarantineFromDashboard);
}


function showQuarantineModal(list) {
  console.log('showQuarantineModal called, list length:', Array.isArray(list)?list.length:0);
  const old = document.getElementById('quarantineModal');
  if (old) old.remove();

  const container = document.createElement('div');
  container.id = 'quarantineModal';
  container.className = 'modal-overlay';
  container.style.zIndex = '99999';
  container.style.display = 'flex';

  const card = document.createElement('div');
  card.className = 'modal-card';
  card.style.maxWidth = '920px';
  card.style.width = '90%';
  card.style.background = '#0f172a';

  card.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; gap:10px;">
      <h2 style="color:#ef4444; margin:0;">🚨 Cuentas en Cuarentena</h2>
      <button class="modal-close-btn" onclick="document.getElementById('quarantineModal')?.remove()">×</button>
    </div>
    <p class="small-text" style="margin-top:10px; color:#cbd5e1;">Estas cuentas requieren atención. Puedes cambiar la contraseña, cambiar el PIN del perfil, o desechar permanentemente la cuenta.</p>
    <div id="quarantineListContainer" style="margin-top:18px; display:flex; flex-direction:column; gap:12px;">
      ${list.map(c => {
        const dias = c.dias_restantes ? Math.floor(c.dias_restantes.days || c.dias_restantes) : 0;
        const estadoVida = dias > 0 ? `${dias} días` : '¡Vencida!';
        const borde = dias < 5 ? 'style="border-left:4px solid #ef4444;"' : '';

        return `
          <div class="quarantine-item" data-id="${c.id}" ${borde}>
            <div class="quarantine-row">
              <div class="quarantine-meta">
                <div class="quarantine-platform">${safeText(c.platform || '')}</div>
                <div class="quarantine-email">📧 ${safeText(c.account_email || '-')}</div>
                <div class="quarantine-profile">👤 ${safeText(c.profile_name || 'Principal')} | PIN: ${safeText(c.profile_pin || '—')}</div>
                <div class="quarantine-life">⏳ Vida restante: <strong>${estadoVida}</strong></div>
              </div>
              <div class="quarantine-actions">
                <label class="field-label" style="margin-bottom:6px">Nueva contraseña</label>
                <input id="new-pass-${c.id}" placeholder="Nueva contraseña" class="form-control" />
                <label class="field-label" style="margin-top:8px; margin-bottom:6px">Nuevo PIN (opcional)</label>
                <input id="new-pin-${c.id}" placeholder="Nuevo PIN" class="form-control" />
                <div style="display:flex; gap:8px; margin-top:10px;">
                  <button class="green-btn" onclick="liberarCuentaDeCuarentena(${c.id})">Recuperar</button>
                  <button class="outline-btn" onclick="desecharCuenta(${c.id})">Desechar</button>
                </div>
              </div>
            </div>
          </div>
        `;
      }).join('')}
    </div>
    <div style="margin-top:16px; display:flex; gap:8px;">
      <button class="outline-btn" onclick="document.getElementById('quarantineModal')?.remove()">Cerrar</button>
      <button class="outline-btn" onclick="checkQuarantineAccounts()">Refrescar lista</button>
    </div>
  `;

  container.appendChild(card);
  document.body.appendChild(container);
  console.log('quarantineModal appended to body');
}

async function liberarCuentaDeCuarentena(id) {
  const passEl = document.getElementById('new-pass-' + id);
  const pinEl = document.getElementById('new-pin-' + id);
  const newPass = passEl ? passEl.value.trim() : '';
  const newPin = pinEl ? pinEl.value.trim() : '';

  if (!newPass && !newPin) return alert("⚠️ Debes ingresar al menos una nueva contraseña o un nuevo PIN para recuperar la cuenta.");
  if (!confirm("¿Confirma que ya actualizaste los datos en la plataforma oficial y desea marcar esta cuenta como disponible?")) return;

  // Eliminación optimista del ítem en la UI
  const item = document.querySelector(`.quarantine-item[data-id="${id}"]`);
  const nextItem = item ? item.nextElementSibling : null;
  if (item) item.remove();
  const container = document.getElementById('quarantineListContainer');
  if (container && container.children.length === 0) {
    document.getElementById('quarantineModal')?.remove();
  } else if (nextItem) {
    nextItem.scrollIntoView({behavior:'smooth', block:'center'});
  }

  try {
    const res = await fetch('/api/admin/accounts/' + id + '/release', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + localStorage.getItem('token')
      },
      body: JSON.stringify({ new_password: newPass || undefined, new_pin: newPin || undefined })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error en servidor');
    showMessage(data.message || 'Cuenta liberada');
    checkQuarantineAccounts();
    if (typeof loadPlatformInventory === 'function') loadPlatformInventory();
  } catch (err) {
    showMessage(err.message || 'Error liberando cuenta', 'error');
    checkQuarantineAccounts();
  }
}

async function desecharCuenta(id) {
  if (!confirm("¿Deseas enviar esta cuenta a desecho permanente?")) return;

  // Eliminación optimista
  const item = document.querySelector(`.quarantine-item[data-id="${id}"]`);
  const nextItem = item ? item.nextElementSibling : null;
  if (item) item.remove();
  const container = document.getElementById('quarantineListContainer');
  if (container && container.children.length === 0) {
    document.getElementById('quarantineModal')?.remove();
  } else if (nextItem) {
    nextItem.scrollIntoView({behavior:'smooth', block:'center'});
  }

  try {
    const res = await fetch(`/api/admin/accounts/${id}/discard`, {
      method: 'POST',
      headers: { 
        'Authorization': 'Bearer ' + localStorage.getItem('token'),
        'Content-Type': 'application/json' 
      }
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error al desechar");

    showMessage(data.message || 'Cuenta desechada');
    checkQuarantineAccounts();
    if(typeof loadPlatformInventory === 'function') loadPlatformInventory();

  } catch (err) {
    showMessage(err.message || 'Error al desechar', 'error');
    console.error(err);
    checkQuarantineAccounts();
  }
}

async function abrirModalHistorial() {
  try {
    const res = await fetch('/api/admin/recovery-history', {
      headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
    });
    const lista = await res.json();
    
    console.log("Historial recibido:", lista);

    // Creamos el HTML dinámicamente
    const modalHTML = `
      <div id="historialModal" class="modal-overlay" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); z-index:99999; display:flex; justify-content:center; align-items:center;">
        <div style="background:#1e1e2f; padding:25px; border-radius:12px; width:90%; max-width:700px; color:white; max-height: 80vh; overflow-y: auto;">
          <h2 style="color:#10b981; border-bottom:1px solid #10b981;">📜 Historial de Recuperaciones</h2>
          <table style="width:100%; border-collapse: collapse; margin-top:15px; text-align:left;">
            <thead>
              <tr style="color:#60a5fa;"><th>Fecha</th><th>Plataforma</th><th>Correo</th></tr>
            </thead>
            <tbody>
              ${lista.map(item => `
                <tr style="border-bottom:1px solid #374151;">
                  <td style="padding:10px;">${new Date(item.recovered_at).toLocaleDateString()}</td>
                  <td style="padding:10px;">${item.platform}</td>
                  <td style="padding:10px;">${item.account_email}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <button onclick="document.getElementById('historialModal').remove()" style="margin-top:20px; width:100%; padding:10px; background:#4b5563; border:none; color:white; border-radius:6px; cursor:pointer;">Cerrar</button>
        </div>
      </div>
    `;

    // Lo inyectamos en el body
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    console.log("Modal inyectado en el DOM");

  } catch (err) {
    console.error("Error al abrir historial:", err);
    alert("Hubo un error al cargar el historial.");
  }
}

// Haz la función global explícitamente
window.abrirModalHistorial = abrirModalHistorial;

// Un único monitor de cuarentena. Solo trabaja con sesión autorizada y
// pausa sus consultas cuando la pestaña no está visible.
let __quarantineMonitorTimer = null;
function startQuarantineMonitor(){
  bindQuarantineDashboardCard();
  if(__quarantineMonitorTimer) clearInterval(__quarantineMonitorTimer);
  __quarantineMonitorTimer = null;

  if(!currentUser || (currentUser.role !== 'admin' && currentUser.account_type !== 'panel_propietario')) return;
  checkQuarantineAccounts();
  __quarantineMonitorTimer = setInterval(() => {
    if(!document.hidden) checkQuarantineAccounts();
  }, 300000);
}

registerLoadAppHook(function quarantineMonitorLoadAppHook(){
  startQuarantineMonitor();
}, { name:'quarantine-monitor', order:720 });

// ==========================================
// BOTÓN DE EMERGENCIA Y CONTROL DE CELULAR (CENTRADO Y PEQUEÑO)
// ==========================================
function mostrarBotonRegresar() {
  const btn = document.getElementById('btn-volver-universal');
  if (btn) btn.remove();
}

function ocultarBotonRegresar() {
    const btn = document.getElementById('btn-volver-universal');
  if (btn) btn.remove();
}
// Hack para atrapar el botón físico de retroceso en celulares
window.addEventListener('popstate', function(event) {
    // Cierra modales si hay alguno abierto
    const modalesAbiertos = document.querySelectorAll('.modal-overlay');
    modalesAbiertos.forEach(modal => modal.remove());
    
    // Regresa al inicio de forma suave
    if (typeof showSection === 'function') {
        showSection('dashboard');
    } else {
        window.location.reload();
    }
});

function activarHistorialCelular() {
    history.pushState({ panel: "abierto" }, '', '#opcion');
}

async function loadExpiringAlerts() {
  const list = document.getElementById('expiringAlertsList');
  if (!list) return;

  try {
    list.innerHTML = '<p class="small-text">Buscando cuentas por vencer...</p>';
    const accounts = await api('/api/alerts/expiring');
    if(currentUser && String(currentUser.role || '').toLowerCase() === 'admin' && typeof loadMotherAccountsAlerts === 'function'){
      loadMotherAccountsAlerts();
    }

    if (accounts.length === 0) {
      list.innerHTML = '<p style="color: green; font-weight: bold;">✅ No hay cuentas por vencer pronto. Todo al día.</p>';
      return;
    }

    list.innerHTML = accounts.map(acc => {
      const fechaVence = new Date(acc.expires_at);
      const opcionesFecha = { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' };
      const textoVence = fechaVence.toLocaleDateString('es-MX', opcionesFecha);

      return `
        <div class="item" style="border: 1px solid #ffcc80; background: #fff8e1; margin-bottom: 10px; padding: 12px; border-radius: 6px;">
          <div style="display:flex; justify-content:space-between; align-items: center;">
            <div>
              <b style="color: #d84315; font-size: 16px;">Vence: ${textoVence}</b><br>
              <span style="font-size: 14px; font-weight: bold;">${acc.product_name}</span>
            </div>
            <div style="text-align: right;">
              <span style="font-size: 13px;">
                <b>Pedido:</b> #${acc.id}
              </span>
            </div>
          </div>
        </div>
      `;
    }).join('');

  } catch (e) {
    list.innerHTML = `<p style="color:red;">Error cargando alertas: ${e.message}</p>`;
  }
}

async function loadMotherAccountsAlerts() {
  const list = document.getElementById('motherAccountsList');
  if (!list) return;

  try {
    list.innerHTML = '<p class="small-text">Calculando fechas de proveedor...</p>';
    const accounts = await api('/api/admin/alerts/mother-accounts');

    if (accounts.length === 0) {
      list.innerHTML = '<p style="color: green; font-weight: bold;">✅ Tienes margen. Ninguna cuenta madre vence en los próximos 5 días.</p>';
      return;
    }

    list.innerHTML = accounts.map(acc => {
      const fechaCompra = new Date(acc.official_purchase_date);
      const fechaVence = new Date(acc.mother_expiration);
      const opcionesFecha = { year: 'numeric', month: 'short', day: 'numeric' };
      const perfiles=Number(acc.profile_count || 0);
      const disponibles=Number(acc.available_profiles || 0);

      return `
        <div class="item" style="border: 1px solid #ef9a9a; background: #ffebee; margin-bottom: 10px; padding: 12px; border-radius: 6px;">
          <div style="display:flex; justify-content:space-between; align-items: center; gap:12px;">
            <div>
              <b style="color: #c62828; font-size: 16px;">Vence Proveedor: ${fechaVence.toLocaleDateString('es-MX', opcionesFecha)}</b><br>
              <span style="font-size: 14px;"><b>Correo:</b> ${safeText(acc.account_email || '')}</span><br>
              <span style="font-size: 13px; color: #555;">Plataforma: ${safeText(acc.product_name || acc.platform || '')} | Fecha original: ${fechaCompra.toLocaleDateString('es-MX', opcionesFecha)}</span>
            </div>
            <div style="text-align: right; min-width:110px;">
              <span style="font-size: 13px;"><b>Cuenta madre:</b> #${Number(acc.id || 0)}</span><br>
              <span style="font-size: 13px; font-weight:bold;">Perfiles: ${perfiles} · Disponibles: ${disponibles}</span>
            </div>
          </div>
        </div>
      `;
    }).join('');

  } catch (e) {
    list.innerHTML = `<p style="color:red;">Error cargando alertas: ${e.message}</p>`;
  }
}

// Las alertas se cargan una sola vez al entrar en la sección Alerts,
// mediante showSection y su deduplicador de cargas en curso.

async function searchGlobalEmail() {
  const input = document.getElementById('globalEmailSearch').value.trim();
  const resultsDiv = document.getElementById('globalSearchResults');
  
  if (!input) return;
  resultsDiv.innerHTML = '<p class="small-text">Buscando auditoría de cuenta...</p>';

  try {
    const data = await api(`/api/admin/search-email?q=${encodeURIComponent(input)}`);
    let html = '';

    // Sección Cuentas Madre
    if (data.accounts.length > 0) {
      data.accounts.forEach(acc => {
        const fechaMadre = acc.official_purchase_date ? new Date(acc.official_purchase_date).toLocaleDateString() : 'No registrada';
        html += `<div style="padding: 10px; border: 1px solid #e57373; background: #ffebee; margin-bottom: 10px; border-radius: 5px;">
          <h4 style="margin:0; color:#c62828;">Cuenta Madre #${acc.id} (${acc.platform})</h4>
          <b>Correo:</b> ${acc.account_email} | <b>Estado:</b> ${acc.status}<br>
          <span style="color:#d32f2f;">📅 <b>Tu fecha de compra (Proveedor):</b> ${fechaMadre}</span>
        </div>`;
      });
    }

    // Sección Ventas de Perfiles
    if (data.orders.length > 0) {
      html += `<h4 style="color: #1976d2; margin-top: 15px;">Historial de Ventas (Perfiles):</h4>`;
      data.orders.forEach(ord => {
        const fechaVenta = new Date(ord.created_at).toLocaleDateString();
        html += `<div style="padding: 10px; border: 1px solid #90caf9; background: #e3f2fd; margin-bottom: 8px; border-radius: 5px;">
          <b>Pedido:</b> #${ord.id} | <b>Producto:</b> ${ord.product_name}<br>
          <b>👤 Vendedor:</b> ${ord.vendedor_name}<br>
          <span style="color:#1565c0;">🛒 <b>Fecha de venta al cliente:</b> ${fechaVenta}</span>
        </div>`;
      });
    } else if (data.accounts.length > 0) {
      html += `<p style="color: #555;"><i>Esta cuenta madre aún no ha sido utilizada en ningún pedido.</i></p>`;
    }

    resultsDiv.innerHTML = html || '<p>No se encontraron coincidencias.</p>';
  } catch (e) {
    resultsDiv.innerHTML = `<p style="color: red;">Error: ${e.message}</p>`;
  }
}


async function verHistorialCuenta(id) {
  try {
    const res = await fetch(`/api/admin/accounts/${id}/history`, {
      headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
    });
    const logs = await res.json();

    if (logs.length === 0) {
      alert("No hay historial registrado para esta cuenta.");
      return;
    }

    // Creamos un modal sencillo para mostrar el historial
    let html = `
      <div class="modal-overlay" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); z-index:9999; display:flex; justify-content:center; align-items:center;">
        <div style="background:#1e1e2f; padding:20px; border-radius:8px; width:400px; color:white;">
          <h3>Historial de la cuenta #${id}</h3>
          <ul style="list-style:none; padding:0;">
            ${logs.map(l => `
              <li style="border-bottom:1px solid #444; padding:8px 0; font-size:12px;">
                <b>Pedido:</b> ${l.order_id || 'N/A'} | <b>Vendedor:</b> ${l.user_id || 'N/A'}<br>
                <b>Recuperado:</b> ${new Date(l.recovered_at).toLocaleDateString()}
              </li>
            `).join('')}
          </ul>
          <button onclick="this.parentElement.parentElement.remove()" style="width:100%; padding:10px; background:#4b5563; border:none; color:white; border-radius:4px; cursor:pointer;">Cerrar</button>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', html);
  } catch (err) {
    alert("Error al cargar el historial.");
  }
}

// ==========================================
// MATRIZ FINAL DE VISIBILIDAD DASHBOARD (MODO CLARO)
// Regla: ocultar/mostrar unicamente con clase .hidden
// ==========================================
function isGlobalAdminForDashboard(){
  if(!currentUser) return false;
  const role=String(currentUser.role||'').toLowerCase();
  return role==='admin' && !isPanelAdminForDashboard();
}

function isTruthyRoleFlag(v){
  return v===true || v===1 || v==='1' || v==='true';
}

function isPanelAdminForDashboard(){
  if(!currentUser) return false;
  const role=String(currentUser.role||'').toLowerCase();
  const accountType=String(currentUser.account_type||'').toLowerCase();
  if(role!=='admin') return false;
  return isTruthyRoleFlag(currentUser.is_panel_admin) ||
    ['panel_propietario','panel_admin','admin_panel'].includes(accountType) ||
    (isTruthyRoleFlag(currentUser.is_subadmin) && accountType!=='admin_distribuidor');
}

function isDistributorForDashboard(){
  if(!currentUser) return false;
  if(isPanelAdminForDashboard()) return false;
  const role=String(currentUser.role||'').toLowerCase();
  const accountType=String(currentUser.account_type||'').toLowerCase();
  return ['admin_distribuidor','distribuidor_del_panel'].includes(accountType) ||
    (role!=='admin' && isTruthyRoleFlag(currentUser.is_subadmin));
}

function isVendorForDashboard(){
  return !!(currentUser && !isGlobalAdminForDashboard() && !isPanelAdminForDashboard() && !isDistributorForDashboard());
}

function ensureVendorDashboardCards(){
  ['actionAccountCard','actionShopCard','actionLogoutCard'].forEach(id=>{
    const el=document.getElementById(id);
    if(el) el.classList.add('hidden');
  });
}

let __miniBannersDataCache = null;
let __miniBannersLoadedAt = 0;
let __miniBannersRequest = null;
const MINI_BANNERS_CACHE_MS = 5 * 60 * 1000;

function miniBannersSignature(rows){
  return (Array.isArray(rows) ? rows : []).map(b => [
    Number(b?.id || 0),
    String(b?.title || ''),
    String(b?.link_url || ''),
    String(b?.created_at || ''),
    String(b?.image_url || '').length
  ].join(':')).join('|');
}

function renderMiniBannersStrip(items){
  const strip = document.getElementById('dashboardMiniBannersStrip');
  if(!strip) return;
  const rows = Array.isArray(items) ? items : [];
  const signature = miniBannersSignature(rows);

  if(!rows.length){
    strip.classList.add('hidden');
    if(strip.dataset.bannerSignature !== signature){
      strip.innerHTML = '';
      strip.dataset.bannerSignature = signature;
    }
    return;
  }

  // Evita reconstruir el carrusel y reiniciar su animación cuando loadApp y
  // showSection solicitan los mismos banners casi al mismo tiempo.
  if(strip.dataset.bannerSignature === signature && strip.firstElementChild){
    strip.classList.remove('hidden');
    return;
  }

  const renderSlide = (b, clone = false) => {
    const img = safeText(String(b.image_url || ''));
    const title = safeText(String(b.title || 'Mini banner'));
    const link = String(b.link_url || '').trim();
    const caption = title ? `<span class="mini-banner-below-title">${title}</span>` : '';
    const image = `<img src="${img}" alt="${title}" width="150" height="150" decoding="async" loading="${clone ? 'lazy' : 'eager'}" draggable="false" />`;
    if(link){
      const safeHref = safeText(link);
      return `<a class="dashboard-mini-banner-slide" href="${safeHref}" target="_blank" rel="noopener noreferrer"><span class="dashboard-mini-banner-item">${image}</span>${caption}</a>`;
    }
    return `<div class="dashboard-mini-banner-slide"><div class="dashboard-mini-banner-item">${image}</div>${caption}</div>`;
  };

  const baseSlides = rows.map(b => renderSlide(b, false)).join('');
  const loopEnabled = rows.length > 1;
  const cloneSlides = loopEnabled ? rows.map(b => renderSlide(b, true)).join('') : '';
  const slides = baseSlides + cloneSlides;
  const duration = Math.max(16, Number(rows.length || 1) * 5);

  strip.innerHTML = `
    <div id="dashboardMiniBannersCarousel" class="dashboard-mini-banners-carousel ${loopEnabled ? 'is-looping' : ''}" style="--mini-banner-duration:${duration}s">
      <div id="dashboardMiniBannersTrack" class="dashboard-mini-banners-track">${slides}</div>
    </div>
  `;
  strip.dataset.bannerSignature = signature;
  strip.classList.remove('hidden');

  const carousel = document.getElementById('dashboardMiniBannersCarousel');
  if(carousel && loopEnabled){
    carousel.onmouseenter = () => carousel.classList.add('paused');
    carousel.onmouseleave = () => carousel.classList.remove('paused');
  }
}

async function loadMiniBannersStrip(options = {}){
  if(!currentUser) return [];
  const force = options === true || options?.force === true;
  const cacheIsFresh = __miniBannersDataCache && (Date.now() - __miniBannersLoadedAt) < MINI_BANNERS_CACHE_MS;

  if(!force && cacheIsFresh){
    renderMiniBannersStrip(__miniBannersDataCache);
    return __miniBannersDataCache;
  }

  if(__miniBannersRequest){
    if(!force) return __miniBannersRequest;
    // Si el admin acaba de modificar un banner, espera la carga anterior y
    // realiza después una consulta nueva para no conservar una respuesta vieja.
    await __miniBannersRequest;
  }

  __miniBannersRequest = (async () => {
    try {
      const data = await api('/api/mini-banners', force ? { cache:'no-store' } : {});
      __miniBannersDataCache = Array.isArray(data?.banners) ? data.banners : [];
      __miniBannersLoadedAt = Date.now();
      renderMiniBannersStrip(__miniBannersDataCache);
      return __miniBannersDataCache;
    } catch(e){
      console.warn('No se pudieron cargar mini banners', e);
      if(!__miniBannersDataCache){
        __miniBannersDataCache = [];
        renderMiniBannersStrip([]);
      }
      return __miniBannersDataCache || [];
    } finally {
      __miniBannersRequest = null;
    }
  })();

  return __miniBannersRequest;
}

function fileToDataUrlMiniBanner(file){
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('No se pudo leer la imagen'));
    reader.readAsDataURL(file);
  });
}

function canvasToBlobMiniBanner(canvas, type, quality){
  return new Promise(resolve => canvas.toBlob(resolve, type, quality));
}

async function optimizeMiniBannerFile(file){
  if(!file) throw new Error('Selecciona una imagen');
  if(file.size > 8 * 1024 * 1024){
    throw new Error('La imagen original no puede superar 8 MB');
  }

  // Conserva GIF animado, pero limita su peso porque no puede comprimirse con canvas.
  if(String(file.type || '').toLowerCase() === 'image/gif'){
    if(file.size > 900 * 1024){
      throw new Error('El GIF debe pesar menos de 900 KB');
    }
    return file;
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('No se pudo procesar la imagen seleccionada'));
      img.src = objectUrl;
    });

    const maxEdge = 480;
    const naturalWidth = Number(image.naturalWidth || image.width || 0);
    const naturalHeight = Number(image.naturalHeight || image.height || 0);
    if(!naturalWidth || !naturalHeight) throw new Error('Dimensiones de imagen inválidas');

    const scale = Math.min(1, maxEdge / Math.max(naturalWidth, naturalHeight));
    const width = Math.max(1, Math.round(naturalWidth * scale));
    const height = Math.max(1, Math.round(naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { alpha:true });
    if(!ctx) throw new Error('El navegador no pudo preparar la imagen');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(image, 0, 0, width, height);

    let blob = await canvasToBlobMiniBanner(canvas, 'image/webp', 0.82);
    if(!blob || !blob.size){
      blob = await canvasToBlobMiniBanner(canvas, 'image/jpeg', 0.84);
    }
    if(!blob || !blob.size) throw new Error('No se pudo comprimir la imagen');

    if(blob.size > 900 * 1024){
      const smaller = await canvasToBlobMiniBanner(canvas, 'image/webp', 0.68);
      if(smaller?.size) blob = smaller;
    }
    if(blob.size > 900 * 1024){
      throw new Error('La imagen sigue siendo demasiado grande después de optimizarla');
    }

    const extension = blob.type === 'image/jpeg' ? 'jpg' : 'webp';
    const baseName = String(file.name || 'mini-banner').replace(/\.[^.]+$/, '').replace(/[^a-z0-9_-]+/gi, '-');
    return new File([blob], `${baseName}.${extension}`, { type:blob.type, lastModified:Date.now() });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function renderMiniBannerAdminList(items){
  const box = document.getElementById('miniBannerAdminList');
  if(!box) return;
  const rows = Array.isArray(items) ? items : [];
  const thumb = (b) => {
    const src = String(b?.image_url || '').trim();
    if(src){
      return `<img src="${safeText(src)}" alt="Banner" />`;
    }
    return `<div style="width:80px;height:54px;border-radius:8px;border:1px solid rgba(148,163,184,.35);display:grid;place-items:center;background:rgba(30,41,59,.6);color:#cbd5e1;font-size:11px;font-weight:700">IMG</div>`;
  };

  box.innerHTML = rows.length ? rows.map(b => `
    <div class="mini-banner-admin-item">
      ${thumb(b)}
      <div>
        <div><b>${safeText(String(b.title||'Sin título'))}</b></div>
        <div class="small-text">${safeText(String(b.link_url||'')) || 'Sin enlace'}</div>
        ${b.has_image ? '' : '<div class="small-text">Miniatura optimizada para carga rápida</div>'}
        <div class="mini-banner-admin-actions" style="margin-top:8px">
          <button class="outline-btn" onclick="toggleMiniBannerActive(${Number(b.id)}, ${b.active ? 'false' : 'true'})">${b.active ? 'Desactivar' : 'Activar'}</button>
          <button class="danger-btn" onclick="deleteMiniBanner(${Number(b.id)})">Eliminar</button>
        </div>
      </div>
    </div>
  `).join('') : 'No hay mini banners registrados.';
}

async function refreshMiniBannerAdminList(){
  try {
    const data = await api('/api/admin/mini-banners');
    renderMiniBannerAdminList(data?.banners || []);
  } catch(e){
    showMessage(e.message || 'Error cargando mini banners', 'error');
  }
}

let __creatingMiniBanner = false;
window.createMiniBanner = async function(){
  if(__creatingMiniBanner) return;
  const saveButton = document.getElementById('miniBannerSaveButton');
  try {
    __creatingMiniBanner = true;
    if(saveButton){
      saveButton.disabled = true;
      saveButton.textContent = 'Optimizando...';
    }

    const file = document.getElementById('miniBannerImage')?.files?.[0] || null;
    if(!file) throw new Error('Selecciona una imagen');
    const title = (document.getElementById('miniBannerTitle')?.value || '').trim();
    const link_url = (document.getElementById('miniBannerLink')?.value || '').trim();
    const active = !!document.getElementById('miniBannerActive')?.checked;
    const optimizedFile = await optimizeMiniBannerFile(file);
    const image_data = await fileToDataUrlMiniBanner(optimizedFile);

    if(saveButton) saveButton.textContent = 'Guardando...';
    await api('/api/admin/mini-banners', {
      method:'POST',
      body: JSON.stringify({ title, link_url, active, image_data })
    });

    showMessage('Mini banner optimizado y guardado');
    const imageInput = document.getElementById('miniBannerImage');
    const titleInput = document.getElementById('miniBannerTitle');
    const linkInput = document.getElementById('miniBannerLink');
    if(imageInput) imageInput.value = '';
    if(titleInput) titleInput.value = '';
    if(linkInput) linkInput.value = '';

    await refreshMiniBannerAdminList();
    await loadMiniBannersStrip({ force:true });
  } catch(e){
    showMessage(e.message || 'Error guardando mini banner', 'error');
  } finally {
    __creatingMiniBanner = false;
    if(saveButton){
      saveButton.disabled = false;
      saveButton.textContent = 'Guardar mini banner';
    }
  }
};

window.deleteMiniBanner = async function(id){
  try {
    if(!confirm('¿Eliminar mini banner?')) return;
    await api('/api/admin/mini-banners/'+id, { method:'DELETE' });
    showMessage('Mini banner eliminado');
    await refreshMiniBannerAdminList();
    await loadMiniBannersStrip({ force:true });
  } catch(e){
    showMessage(e.message || 'Error eliminando mini banner', 'error');
  }
};

window.toggleMiniBannerActive = async function(id, nextActive){
  try {
    await api('/api/admin/mini-banners/'+id, {
      method:'PATCH',
      body: JSON.stringify({ active: nextActive === true || nextActive === 'true' })
    });
    await refreshMiniBannerAdminList();
    await loadMiniBannersStrip({ force:true });
  } catch(e){
    showMessage(e.message || 'Error actualizando mini banner', 'error');
  }
};

window.openMiniBannerManager = async function(){
  if(!currentUser || String(currentUser.role || '').toLowerCase() !== 'admin'){
    showMessage('Solo admin puede administrar mini banners', 'error');
    return;
  }

  const old = document.getElementById('miniBannerManagerModal');
  if(old) old.remove();

  const html = `
    <div id="miniBannerManagerModal" class="modal-overlay">
      <div class="modal-card" style="max-width:860px; width:95%">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:12px">
          <h3 style="margin:0">Mini banners del dashboard</h3>
          <button class="outline-btn" style="width:auto" onclick="document.getElementById('miniBannerManagerModal')?.remove()">Cerrar</button>
        </div>
        <p class="small-text">Estos banners aparecen entre la barra superior y el dashboard.</p>
        <div class="row">
          <div>
            <label class="field-label">Imagen</label>
            <input id="miniBannerImage" type="file" accept="image/png,image/jpeg,image/jpg,image/webp,image/gif" />
            <div class="small-text">La imagen se reduce automáticamente a un formato ligero antes de guardarse.</div>
            <label class="field-label">Título (opcional)</label>
            <input id="miniBannerTitle" placeholder="Texto corto" />
            <label class="field-label">Enlace (opcional)</label>
            <input id="miniBannerLink" placeholder="https://..." />
            <label class="checkbox-row"><input type="checkbox" id="miniBannerActive" checked /> Activo</label>
            <button id="miniBannerSaveButton" class="green-btn" onclick="createMiniBanner()">Guardar mini banner</button>
          </div>
          <div>
            <h4 style="margin-top:0">Banners actuales</h4>
            <div id="miniBannerAdminList" class="mini-banner-admin-list">Cargando...</div>
          </div>
        </div>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', html);
  await refreshMiniBannerAdminList();
};

function resetScrollToTop(){
  try{ window.scrollTo({ top: 0, behavior: 'smooth' }); }catch(_){ window.scrollTo(0,0); }
  const content=document.getElementById('main-content') || document.getElementById('appSection');
  if(content) content.scrollTop=0;
  if(document.documentElement) document.documentElement.scrollTop=0;
  if(document.body) document.body.scrollTop=0;
}

function toggleCardByInnerId(innerId, hidden){
  const valueEl=document.getElementById(innerId);
  const card=valueEl ? valueEl.closest('.dash-card') : null;
  if(card) card.classList.toggle('hidden', !!hidden);
}

function applyDashboardRoleVisibilityMatrix(){
  if(!currentUser) return;

  const isAdminGlobal=isGlobalAdminForDashboard();
  const isPanelAdmin=isPanelAdminForDashboard();
  const isAdminLike=isAdminGlobal || isPanelAdmin;
  const isDistributor=isDistributorForDashboard();
  const isVendor=isVendorForDashboard();

  ensureVendorDashboardCards();

  const toggle=(id, hidden)=>{ const el=document.getElementById(id); if(el) el.classList.toggle('hidden', !!hidden); };
  const hardHide=(id, hidden)=>{
    const el=document.getElementById(id);
    if(!el) return;
    el.classList.toggle('hidden', !!hidden);
    if(hidden){
      el.style.setProperty('display', 'none', 'important');
    }else{
      el.style.removeProperty('display');
    }
  };


  const hardHideSelector=(selector, hidden)=>{
    const el=document.querySelector(selector);
    if(!el) return;
    el.classList.toggle('hidden', !!hidden);
    if(hidden){
      el.style.setProperty('display', 'none', 'important');
    }else{
      el.style.removeProperty('display');
    }
  };

  const adminCards=[
    'dashUsersCard',
    'dashProductsCard',
    'dashOutOfStockCard',
    'dashInventoryCard',
    'dashInventoryHistoryCard',
    'dashOrdersCard',
    'dashReportsCard',
    'dashBalanceRequestsCard',
    'dashQuarantineCard',
    'dashExpiringCard',
    'dashSalesTodayCard',
    'dashMiniBannersCard'
  ];

  const distOnlyButtons=['btn-dist-usuarios','btn-dist-precios','btn-dist-ganancias'];
  const actionButtons=['actionOrdersBtn','actionBalanceBtn','actionReportBtn','actionResponsesBtn'];
  const vendorOnlyCards=['actionAccountCard','actionShopCard','actionLogoutCard'];
  const globalInfraIds=['adminPanelsCardPhase1','adminPanelsPanelPhase1','dashAdminPanelsCardMainFinal','panicResetMenuBtn'];

  // Base segura para cualquier rol
  toggle('accountMenuBtn', false);
  toggle('shopMenuBtn', false);
  toggle('logoutMenuBtn', false);

  if(isAdminLike){
    hardHide('dashboardGlobalActionsBar', false);
    hardHide('panel-botones-vendedor', true);
    hardHideSelector('#section-dashboard .grid-cards', false);
    hardHide('dashboardChartsPanel', false);
    hardHide('section-admin', false);

    adminCards.forEach(id=>hardHide(id,false));
    hardHide('dashCsvUploadCard', true);
    hardHide('dashDailyCutCard', true);
    hardHide('dashMonthlyReportCard', true);

    // Oculta infraestructura global para panel admin independiente.
    hardHide('adminMenuBtn', true);
    hardHide('adminSalesMenuBtn', true);
    hardHide('dashInventoryHistoryCard', !(isDistributor || isAdminGlobal));
    globalInfraIds.forEach(id=>hardHide(id, isPanelAdmin));
    hardHide('btnHistorialId', true);

    hardHide('alertsMenuBtn', true);
    hardHide('ordersMenuBtn', true);
    hardHide('balanceMenuBtn', true);
    hardHide('reportsMenuBtn', true);
    hardHide('responsesMenuBtn', true);

    actionButtons.forEach(id=>hardHide(id,true));
    distOnlyButtons.forEach(id=>hardHide(id,true));
    vendorOnlyCards.forEach(id=>hardHide(id,true));
    hardHide('distributorMenuBtn', true);
    hardHide('distributorEarningsBtn', true);

    hardHide('dashBalanceCard', true);
    hardHide('dashDistributorCard', true);
    return;
  }

  // Roles no-admin: misma estética, pero jerarquía por ocultación
  hardHide('section-admin', true);
  hardHide('dashboardChartsPanel', true);
  hardHideSelector('#section-dashboard .grid-cards', true);
  adminCards.forEach(id=>hardHide(id,true));
  hardHide('dashBalanceCard', true);
  hardHide('dashDistributorCard', true);

  hardHide('adminMenuBtn', true);
  hardHide('adminSalesMenuBtn', true);
  hardHide('panicResetMenuBtn', true);
  hardHide('btnHistorialId', true);

  if(isDistributor){
    // Distribuidor: acciones comerciales y de gestión de su red.
    hardHide('dashboardGlobalActionsBar', false);
    hardHide('panel-botones-vendedor', false);

    hardHide('alertsMenuBtn', true);
    hardHide('ordersMenuBtn', true);
    hardHide('balanceMenuBtn', true);
    hardHide('reportsMenuBtn', true);
    hardHide('responsesMenuBtn', true);

    actionButtons.forEach(id=>hardHide(id,false));
    distOnlyButtons.forEach(id=>hardHide(id,false));
    vendorOnlyCards.forEach(id=>hardHide(id,true));
    hardHide('distributorMenuBtn', true);
    hardHide('distributorEarningsBtn', true);
    return;
  }

  if(isVendor){
    hardHide('dashboardGlobalActionsBar', false);
    hardHide('panel-botones-vendedor', false);

    hardHide('alertsMenuBtn', true);
    hardHide('ordersMenuBtn', true);
    hardHide('balanceMenuBtn', true);
    hardHide('reportsMenuBtn', true);
    hardHide('responsesMenuBtn', true);

    actionButtons.forEach(id=>hardHide(id,false));
    vendorOnlyCards.forEach(id=>hardHide(id,false));
    distOnlyButtons.forEach(id=>hardHide(id,true));
    hardHide('distributorMenuBtn', true);
    hardHide('distributorEarningsBtn', true);

    // Blindaje implacable: vendedor no ve herramientas admin/distribuidor.
    [
      'dashUsersCard','dashProductsCard','dashOutOfStockCard','dashInventoryCard','dashCsvUploadCard',
      'dashBalanceRequestsCard','dashSalesTodayCard','dashDailyCutCard','dashMonthlyReportCard','dashQuarantineCard',
      'dashDistributorCard','dashAdminPanelsCardMainFinal','adminPanelsCardPhase1','adminPanelsPanelPhase1',
      'adminMenuBtn','adminSalesMenuBtn','panicResetMenuBtn'
    ].forEach(id=>{
      const el=document.getElementById(id);
      if(el) el.classList.add('hidden');
      hardHide(id,true);
    });
  }
}

let __dashboardCountsLastTs = 0;
let __dashboardCountsCache = null;

function actualizarConteosDashboard(){
  if(!currentUser) return;

  const setText=(id, val)=>{
    const el=document.getElementById(id);
    if(el) el.textContent=String(val ?? '0');
  };

  const isAdminLike=isGlobalAdminForDashboard() || isPanelAdminForDashboard();
  if(isAdminLike){
    const now=Date.now();
    const useCache=__dashboardCountsCache && (now-__dashboardCountsLastTs)<10000;
    if(useCache){
      setText('statUsers', __dashboardCountsCache.users);
      setText('statProducts', __dashboardCountsCache.products);
      setText('statOrders', __dashboardCountsCache.orders);
      setText('statInventory', __dashboardCountsCache.inventory);
      setText('statReports', __dashboardCountsCache.reportsPending);
      setText('statBalanceRequests', __dashboardCountsCache.balancePending);
      setText('adminUsersCount', __dashboardCountsCache.users);
      setText('adminProductsCount', __dashboardCountsCache.products);
      setText('adminOrdersCount', __dashboardCountsCache.orders);
      setText('adminPlatformAccountsCount', __dashboardCountsCache.inventory);
    }else{
      api('/api/admin/dashboard-counts')
        .then(data=>{
          __dashboardCountsCache={
            users:Number(data?.users||0),
            products:Number(data?.products||0),
            orders:Number(data?.orders||0),
            inventory:Number(data?.inventory||0),
            reportsPending:Number(data?.reportsPending||0),
            balancePending:Number(data?.balancePending||0)
          };
          __dashboardCountsLastTs=Date.now();
          setText('statUsers', __dashboardCountsCache.users);
          setText('statProducts', __dashboardCountsCache.products);
          setText('statOrders', __dashboardCountsCache.orders);
          setText('statInventory', __dashboardCountsCache.inventory);
          setText('statReports', __dashboardCountsCache.reportsPending);
          setText('statBalanceRequests', __dashboardCountsCache.balancePending);
          setText('adminUsersCount', __dashboardCountsCache.users);
          setText('adminProductsCount', __dashboardCountsCache.products);
          setText('adminOrdersCount', __dashboardCountsCache.orders);
          setText('adminPlatformAccountsCount', __dashboardCountsCache.inventory);
        })
        .catch(()=>{});
    }
  }

  applyDashboardRoleVisibilityMatrix();
}

registerSectionHook(function roleMatrixSectionHook(name){
  applyDashboardRoleVisibilityMatrix();
  if(name === 'dashboard'){
    resetScrollToTop();
    loadMiniBannersStrip();
    actualizarConteosDashboard();
    if(currentUser && String(currentUser.role || '').toLowerCase() === 'admin'){
      loadExpiringCount();
    }
  }
});

registerLoadAppHook(function roleMatrixLoadAppHook(){
  // Dashboard ya carga banners y conteos desde showSection('dashboard').
  // Aquí solo se reaplica la visibilidad después de crear los elementos dinámicos.
  applyDashboardRoleVisibilityMatrix();
}, { name:'dashboard-role-matrix', order:700 });


// Navegación final por tarjetas: separa panel admin de distribuidor.
openUsersFromDashboard = function(){
  if(isGlobalAdminForDashboard() || isPanelAdminForDashboard()) return scrollToAdmin('adminUsersPanel');
  return showSection('account');
};

openProductsFromDashboard = function(){
  if(isGlobalAdminForDashboard() || isPanelAdminForDashboard()) return scrollToAdmin('adminProductsPanel');
  return showSection('shop');
};

openInventoryFromDashboard = function(){
  if(isGlobalAdminForDashboard() || isPanelAdminForDashboard()) return scrollToAdmin('adminPlatformAccountsPanel');
  return showSection('shop');
};

openOrdersFromDashboard = function(){
  if(isGlobalAdminForDashboard() || isPanelAdminForDashboard()) return scrollToAdmin('adminOrdersPanel');
  return showSection('orders');
};

openAccountReportsFromDashboard = function(){
  if(isGlobalAdminForDashboard() || isPanelAdminForDashboard()) return scrollToAdmin('adminAccountReportsPanel');
  return showSection('reports');
};

openBalanceRequests = function(){
  if(isGlobalAdminForDashboard() || isPanelAdminForDashboard()) return scrollToAdmin('adminBalanceRequestsPanel');
  return showSection('balance');
};

function setupExpiringCardAction(){
  const card=document.getElementById('dashExpiringCard');
  if(!card || card.dataset.boundExpiring==='1') return;
  card.dataset.boundExpiring='1';
  card.onclick=function(){ showSection('alerts'); };
}

let selectedInventoryCsvFile = null;

function openModalStatusCSV(){
  const modal=document.getElementById('modalStatusCSV');
  if(!modal) return;
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden','false');
}

function closeModalStatusCSV(){
  const modal=document.getElementById('modalStatusCSV');
  if(!modal) return;
  modal.classList.add('hidden');
  modal.setAttribute('aria-hidden','true');
}

function setCsvModalLoadingState(){
  const loading=document.getElementById('modalStatusCSVLoading');
  const result=document.getElementById('modalStatusCSVResult');
  const closeBtn=document.getElementById('csvStatusCloseBtn');
  const success=document.getElementById('csvSuccessSummary');
  const error=document.getElementById('csvErrorSummary');
  const list=document.getElementById('csvErrorList');

  if(loading) loading.classList.remove('hidden');
  if(result) result.classList.add('hidden');
  if(closeBtn) closeBtn.classList.add('hidden');
  if(success) success.textContent='';
  if(error){ error.textContent=''; error.classList.add('hidden'); }
  if(list){ list.textContent=''; list.classList.add('hidden'); }
}

function setCsvModalResultState(successCount, errorCount, errors){
  const loading=document.getElementById('modalStatusCSVLoading');
  const result=document.getElementById('modalStatusCSVResult');
  const closeBtn=document.getElementById('csvStatusCloseBtn');
  const success=document.getElementById('csvSuccessSummary');
  const error=document.getElementById('csvErrorSummary');
  const list=document.getElementById('csvErrorList');

  if(loading) loading.classList.add('hidden');
  if(result) result.classList.remove('hidden');
  if(closeBtn) closeBtn.classList.remove('hidden');
  if(success) success.textContent=`✅ Cuentas cargadas con éxito: ${Number(successCount || 0)}`;

  const hasErrors=Number(errorCount || 0) > 0;
  if(error){
    error.textContent=`❌ Cuentas con fallas: ${Number(errorCount || 0)}`;
    error.classList.toggle('hidden', !hasErrors);
  }

  if(list){
    const lines=Array.isArray(errors) ? errors : [];
    list.textContent=lines.length ? lines.join('\n') : '';
    list.classList.toggle('hidden', !lines.length);
  }
}

function parseCsvLine(rawLine, separator=','){
  const line=String(rawLine||'');
  const out=[];
  let cur='';
  let inQuotes=false;

  for(let i=0;i<line.length;i++){
    const ch=line[i];
    const nxt=line[i+1];
    if(ch==='"'){
      if(inQuotes && nxt==='"'){
        cur+='"';
        i++;
      }else{
        inQuotes=!inQuotes;
      }
      continue;
    }
    if(ch===separator && !inQuotes){
      out.push(cur.trim());
      cur='';
      continue;
    }
    cur+=ch;
  }
  out.push(cur.trim());
  return out;
}

function detectCsvSeparator(headerLine){
  const line=String(headerLine||'');
  const semicolonCols=parseCsvLine(line,';').length;
  const commaCols=parseCsvLine(line,',').length;
  return semicolonCols>commaCols ? ';' : ',';
}

function cleanCsvHeader(value){
  return String(value||'')
    .replace(/^\uFEFF/, '')
    .replace(/[\u200B-\u200D\u2060]/g, '')
    .trim()
    .toLowerCase();
}

function parseInventoryCsvText(text){
  const normalized=String(text||'')
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');
  const lines=normalized.split(/\r?\n/).filter(line=>String(line).trim()!=='');
  if(lines.length<2) throw new Error('El archivo CSV no tiene filas de datos.');

  const separator=detectCsvSeparator(lines[0]);
  const headers=parseCsvLine(lines[0], separator).map(cleanCsvHeader);
  const required=['producto','correo','contrasena','perfil','pin','fecha_compra','cuenta_madre','url_soporte','precio_compra'];
  const optional=['cuenta_madre_id','reemplaza_cuenta_madre_id','fecha_original_cuenta_madre','vencimiento_cuenta_madre'];
  const supported=[...required,...optional];
  const missing=required.filter(h=>!headers.includes(h));
  if(missing.length){
    throw new Error(`Encabezados faltantes en CSV: ${missing.join(', ')}`);
  }

  const indexByHeader={};
  headers.forEach((h,i)=>{ if(indexByHeader[h]===undefined) indexByHeader[h]=i; });

  return lines.slice(1).map((line, idx)=>{
    const cols=parseCsvLine(line, separator);
    const row={};
    supported.forEach(h=>{
      const columnIndex=indexByHeader[h];
      row[h]=columnIndex===undefined ? '' : String(cols[columnIndex] || '').trim();
    });
    row.__rowNumber=idx+2;
    return row;
  });
}

function setupInventoryCsvUploadFlow(){
  const selectBtn=document.getElementById('csvSelectFileBtn');
  const processBtn=document.getElementById('csvProcessUploadBtn');
  const input=document.getElementById('csv-upload-input');
  const nameEl=document.getElementById('csvSelectedFileName');
  if(!selectBtn || !processBtn || !input || selectBtn.dataset.boundCsvFlow==='1') return;

  selectBtn.dataset.boundCsvFlow='1';
  processBtn.disabled=true;

  selectBtn.onclick=function(){ input.click(); };

  input.onchange=function(){
    const file=input.files && input.files[0] ? input.files[0] : null;
    selectedInventoryCsvFile=file;
    const valid=file && /\.csv$/i.test(file.name||'');
    processBtn.disabled=!valid;
    if(nameEl){
      nameEl.textContent=valid ? `Archivo listo: ${file.name}` : 'Ningún archivo seleccionado.';
    }
    if(file && !valid){
      showMessage('Selecciona un archivo con extensión .csv', 'error');
    }
  };

  processBtn.onclick=async function(){
    if(!selectedInventoryCsvFile){
      showMessage('Primero selecciona un archivo CSV.', 'error');
      return;
    }

    openModalStatusCSV();
    setCsvModalLoadingState();

    try{
      const text=await selectedInventoryCsvFile.text();
      let rows=[];
      try{ rows=parseInventoryCsvText(text); }catch{ rows=[]; }
      const result=await api('/api/admin/inventario/bulk-upload', {
        method:'POST',
        body:JSON.stringify({ rows, csvText:text })
      });

      setCsvModalResultState(result.successCount, result.errorCount, result.errors);
      if(typeof loadPlatformInventory==='function') await loadPlatformInventory();
      if(typeof loadExpiringCount==='function') await loadExpiringCount();
    }catch(e){
      setCsvModalResultState(0, 1, [e.message || 'Error procesando el archivo CSV']);
    }
  };
}

function csvEscape(value){
  return `"${String(value ?? '').replace(/"/g,'""')}"`;
}

function formatInventoryCsvDate(value){
  const raw=String(value ?? '').trim();
  if(!raw) return '';

  const isoMatch=raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if(isoMatch) return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;

  const localMatch=raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return localMatch ? raw : '';
}

async function downloadInventoryCsv(){
  try{
    const rows = [];
    let page = 1;
    let totalPages = 1;
    do{
      const payload = await api(`/api/admin/platform-accounts?page=${page}&limit=200`);
      const chunk = Array.isArray(payload?.rows) ? payload.rows : [];
      rows.push(...chunk);
      totalPages = Number(payload?.totalPages || 1);
      page += 1;
    }while(page <= totalPages);

    const headers = [
      'producto','correo','contrasena','perfil','pin','fecha_compra','cuenta_madre','url_soporte',
      'precio_compra','cuenta_madre_id','reemplaza_cuenta_madre_id',
      'fecha_original_cuenta_madre','vencimiento_cuenta_madre'
    ];

    const lines = [headers.map(csvEscape).join(',')];
    (Array.isArray(rows) ? rows : []).forEach(acc => {
      const line = [
        acc.product_name || acc.platform || '',
        acc.account_email || '',
        acc.account_password || '',
        acc.profile_name || '',
        acc.profile_pin || '',
        formatInventoryCsvDate(acc.official_purchase_date),
        acc.platform || acc.product_name || '',
        acc.access_url || '',
        acc.purchase_price ?? '',
        acc.mother_account_id ?? '',
        acc.reemplaza_cuenta_madre_id ?? '',
        formatInventoryCsvDate(acc.fecha_original_cuenta_madre),
        formatInventoryCsvDate(acc.vencimiento_cuenta_madre)
      ].map(csvEscape).join(',');
      lines.push(line);
    });

    const csv = '\ufeff' + lines.join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const stamp = new Date().toISOString().slice(0,10);
    a.href = url;
    a.download = `inventario_actual_${stamp}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showMessage('Inventario CSV descargado');
  }catch(e){
    showMessage(e.message || 'Error descargando inventario CSV', 'error');
  }
}

function setupInventoryCsvDownloadTrigger(){
  const btn=document.getElementById('csvDownloadInventoryBtn');
  if(!btn || btn.dataset.boundCsvDownload==='1') return;
  btn.dataset.boundCsvDownload='1';
  btn.onclick=function(){ downloadInventoryCsv(); };
}

function initializeStaticAdminControls(){
  setupInventoryCsvUploadFlow();
  setupInventoryCsvDownloadTrigger();
  setupExpiringCardAction();
}

registerLoadAppHook(function staticAdminControlsLoadAppHook(){
  initializeStaticAdminControls();
}, { name:'static-admin-controls', order:730 });

registerSectionHook(function staticAdminControlsSectionHook(name){
  if(name === 'dashboard' || name === 'admin') initializeStaticAdminControls();
});

let __dashboardRefreshTimer = null;
function startDashboardRefreshScheduler(){
  if(__dashboardRefreshTimer) clearInterval(__dashboardRefreshTimer);
  __dashboardRefreshTimer = null;
  if(!currentUser) return;

  __dashboardRefreshTimer = setInterval(() => {
    if(document.hidden) return;
    const dashboardActive = !!document.getElementById('section-dashboard')?.classList.contains('active');
    if(!dashboardActive) return;
    actualizarConteosDashboard();
    if(String(currentUser.role || '').toLowerCase() === 'admin') loadExpiringCount();
  }, 30000);
}

registerLoadAppHook(function dashboardRefreshLoadAppHook(){
  startDashboardRefreshScheduler();
}, { name:'dashboard-refresh-scheduler', order:740 });
