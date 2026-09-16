const __inflightGetRequests = new Map();

async function api(path, opt = {}) {
  const method = String(opt.method || 'GET').toUpperCase();
  const headers = { ...(opt.headers || {}) };
  if (token) headers.Authorization = 'Bearer ' + token;
  if (!(opt.body instanceof FormData)) headers['Content-Type'] = 'application/json';

  // Varias tarjetas pueden pedir el mismo recurso durante el mismo renderizado.
  // Para GET idénticos reutilizamos solamente la petición que esté en curso;
  // no guardamos respuestas ni servimos datos antiguos.
  const canDedupe = method === 'GET' && opt.dedupe !== false;
  const requestKey = canDedupe ? `${token || ''}|${String(path)}` : '';
  if (canDedupe && __inflightGetRequests.has(requestKey)) {
    return __inflightGetRequests.get(requestKey);
  }

  const request = (async () => {
    const fetchOptions = { ...opt, method, headers };
    delete fetchOptions.dedupe;
    const r = await fetch(path, fetchOptions);
    const d = await r.json().catch(() => ({}));
    if (!r.ok) {
      const detailed =
        (Array.isArray(d.errors) && d.errors.length ? d.errors.join(' | ') : '') ||
        (typeof d.error === 'string' && d.error) ||
        `Error HTTP ${r.status}`;
      throw new Error(detailed);
    }
    return d;
  })();

  if (!canDedupe) return request;
  __inflightGetRequests.set(requestKey, request);
  try {
    return await request;
  } finally {
    if (__inflightGetRequests.get(requestKey) === request) {
      __inflightGetRequests.delete(requestKey);
    }
  }
}

let currentTenantContext = null;

function applyTenantBranding(context) {
  const name=String(context?.business_name||"").trim();
  if(!context?.is_tenant || !name) return;
  document.title=name;
  document.querySelectorAll('.auth-brand-name').forEach(el=>el.textContent=name);
  document.querySelectorAll('.auth-brand-surname').forEach(el=>el.textContent='PANEL');
  document.querySelectorAll('.auth-mobile-brand b').forEach(el=>el.textContent=name);
  document.querySelectorAll('.auth-mobile-brand span').forEach(el=>el.textContent='PANEL');
  document.querySelectorAll('.auth-showcase').forEach(el=>el.setAttribute('aria-label',name));
  document.querySelector('.mobile-header b')?.replaceChildren(document.createTextNode(name));
  const side=document.querySelector('.sidebar .brand h2'); if(side) side.textContent=name;
}
async function loadTenantContext(){
  try{const r=await fetch('/api/tenant-context');const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'No se pudo cargar el panel');currentTenantContext=d;applyTenantBranding(d);return d;}catch(e){console.warn('Contexto de panel:',e.message);return null;}
}
function getPanelInviteToken(){try{return new URLSearchParams(window.location.search).get('panel_invite')||'';}catch(_){return '';}}
function ensurePanelInviteFields(){
  const form=document.getElementById('registerForm'); if(!form||document.getElementById('panelInviteFields')) return;
  const wrap=document.createElement('div'); wrap.id='panelInviteFields'; wrap.className='panel-invite-fields hidden';
  wrap.innerHTML=`<div class="auth-invite-note" id="panelInviteNote">Registro de propietario de panel</div>
    <label class="auth-field-label">Nombre del administrador</label><div class="auth-input-wrap"><input id="panelAdminNameInvite" placeholder="Tu nombre completo"></div>
    <label class="auth-field-label">Teléfono / WhatsApp</label><div class="auth-input-wrap"><input id="panelPhoneInvite" placeholder="Tu teléfono / WhatsApp"></div>
    <label class="auth-field-label">Banco</label><div class="auth-input-wrap"><input id="panelBankNameInvite" placeholder="BBVA, Mercado Pago, etc."></div>
    <label class="auth-field-label">Titular</label><div class="auth-input-wrap"><input id="panelBankHolderInvite" placeholder="Nombre del titular"></div>
    <label class="auth-field-label">CLABE / cuenta</label><div class="auth-input-wrap"><input id="panelBankClabeInvite" placeholder="CLABE o número de cuenta"></div>
    <label class="auth-field-label">Concepto de pago</label><div class="auth-input-wrap"><input id="panelPaymentConceptInvite" placeholder="Ejemplo: servicios"></div>
    <label class="auth-field-label">Correo de notificaciones</label><div class="auth-input-wrap"><input id="panelNotificationEmailInvite" type="email" placeholder="correo para pedidos y alertas"></div>`;
  form.insertBefore(wrap, document.getElementById('registerSubmitBtn'));
}
async function loadPanelInvite(){
  const token=getPanelInviteToken(); if(!token) return null; ensurePanelInviteFields();
  try{const r=await fetch('/api/panel-invite/'+encodeURIComponent(token));const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'Enlace inválido');
    currentPanelInvite=d;document.getElementById('panelInviteFields')?.classList.remove('hidden');
    const note=document.getElementById('panelInviteNote');if(note)note.textContent=`Crea tu panel · Plan: ${d.plan_type||'renta'}`;
    const nameLabel=document.querySelector('label[for="registerName"]');if(nameLabel)nameLabel.textContent='Nombre del negocio';
    const submit=document.getElementById('registerSubmitBtn');if(submit)submit.querySelector('span')?.replaceChildren(document.createTextNode('Crear mi panel'));
    showAuth('register');return d;
  }catch(e){showMessage(e.message||'Enlace inválido','error');return null;}
}

async function register(){
  try{
    const inviteToken=getPanelInviteToken();
    if(inviteToken){
      const data=await api('/api/panel-register/'+encodeURIComponent(inviteToken),{method:'POST',body:JSON.stringify({
        business_name:registerName.value,admin_name:document.getElementById('panelAdminNameInvite')?.value||'',email:registerEmail.value,password:registerPassword.value,
        phone:document.getElementById('panelPhoneInvite')?.value||'',bank_name:document.getElementById('panelBankNameInvite')?.value||'',
        bank_holder:document.getElementById('panelBankHolderInvite')?.value||'',bank_clabe:document.getElementById('panelBankClabeInvite')?.value||'',
        payment_concept:document.getElementById('panelPaymentConceptInvite')?.value||'',notification_email:document.getElementById('panelNotificationEmailInvite')?.value||registerEmail.value
      })});
      token=data.token;localStorage.setItem('token',token);showMessage(data.message||'Panel creado correctamente');
      if(data.panel?.panel_url){setTimeout(()=>{window.location.href=data.panel.panel_url;},900);return;}
      await loadApp();return;
    }
    const data=await api('/api/register',{method:'POST',body:JSON.stringify({name:registerName.value,email:registerEmail.value,password:registerPassword.value})});
    token=data.token;localStorage.setItem('token',token);showMessage(data.message||'Cuenta creada');await loadApp();
  }catch(e){showMessage(e.message,'error');}
}

async function login() {
  try {
    const data = await api('/api/login', {
      method: 'POST',
      body: JSON.stringify({
        email: loginEmail.value,
        password: loginPassword.value
      })
    });
    token = data.token;
    localStorage.setItem('token', token);
    showMessage('Sesión iniciada');
    await loadApp();
  } catch (e) {
    showMessage(e.message, 'error');
  }
}

function logout() {
  localStorage.removeItem('token');
  token = null;
  currentUser = null;
  if (typeof window.syncPanicAdminButton === 'function') window.syncPanicAdminButton();
  document.documentElement.classList.remove('session-token-present');
  document.getElementById('authSection').classList.remove('hidden');
  document.getElementById('appSection').classList.add('hidden');
  showMessage('Sesión cerrada');
}

const __loadAppHooks = new Map();
let __activeLoadAppPromise = null;

function registerLoadAppHook(handler, options = {}) {
  if (typeof handler !== 'function') return function () {};

  const name = String(options.name || handler.name || `load-app-hook-${__loadAppHooks.size + 1}`);
  const order = Number.isFinite(Number(options.order)) ? Number(options.order) : 500;
  __loadAppHooks.set(name, { name, order, handler });

  return function unregisterLoadAppHook() {
    __loadAppHooks.delete(name);
  };
}

async function runLoadAppHooks(context = {}) {
  const hooks = Array.from(__loadAppHooks.values()).sort((a, b) => a.order - b.order);
  for (const hook of hooks) {
    try {
      await hook.handler(context);
    } catch (error) {
      console.warn(`Error en inicialización adicional: ${hook.name}`, error);
    }
  }
}

window.registerLoadAppHook = registerLoadAppHook;
window.runLoadAppHooks = runLoadAppHooks;

async function loadApp() {
  if (!token) return;
  if (__activeLoadAppPromise) return __activeLoadAppPromise;

  __activeLoadAppPromise = (async () => {
    // Solo una sesión nueva debe abrir el dashboard. Las recargas de datos internas
    // no deben sacar al usuario de la sección que está consultando.
    const shouldOpenDashboard = !currentUser;

    try {
      currentUser = await api('/api/me');
    } catch (e) {
      console.error('Sesion invalida al consultar /api/me:', e);
      logout();
      return;
    }

    try {
      if (typeof applyDashboardRoleVisibilityMatrix === 'function') {
        applyDashboardRoleVisibilityMatrix();
      }

      document.documentElement.classList.remove('session-token-present');
      document.getElementById('authSection')?.classList.add('hidden');
      document.getElementById('appSection')?.classList.remove('hidden');

      applyTenantBranding({ is_tenant: Boolean(currentUser.is_panel_admin), business_name: currentUser.admin_panel_business_name || '' });
      userName.textContent = currentUser.name;
      userEmail.textContent = currentUser.email;
      userRole.textContent = currentUser.role;
      userBalance.textContent = formatMoney(currentUser.balance);
      sideEmail.textContent = currentUser.email;
      topUserName.textContent = currentUser.name;
      topUserBalance.textContent = formatMoney(currentUser.balance);
      statUsers.textContent = '0';

      const btnHistorial = document.getElementById('btnHistorialId');
      if (btnHistorial) {
        btnHistorial.onclick = function () {
          if (typeof window.abrirModalHistorial === 'function') {
            window.abrirModalHistorial();
          }
        };
      }

      // La navegación inicial ocurre antes de las consultas pesadas. Así, si el
      // usuario abre otra sección mientras cargan los datos, loadApp no lo devuelve
      // al dashboard cuando esas consultas terminan.
      if (shouldOpenDashboard && typeof showSection === 'function') {
        showSection('dashboard');
      }

      await Promise.allSettled([
        typeof loadProducts === 'function' ? loadProducts() : Promise.resolve(),
        typeof loadMyOrders === 'function' ? loadMyOrders() : Promise.resolve(),
        typeof loadBalanceRequests === 'function' ? loadBalanceRequests() : Promise.resolve()
      ]);

      if (currentUser.role === 'admin') {
        if (typeof setTodaySalesDate === 'function') setTodaySalesDate();
        await Promise.allSettled([
          typeof loadUsers === 'function' ? loadUsers() : Promise.resolve(),
          typeof loadAdminProducts === 'function' ? loadAdminProducts() : Promise.resolve(),
          typeof loadAdminOrders === 'function' ? loadAdminOrders() : Promise.resolve(),
          typeof loadSalesReport === 'function' ? loadSalesReport() : Promise.resolve(),
          typeof loadPlatformInventory === 'function' ? loadPlatformInventory() : Promise.resolve(),
          // loadExpiringCount se ejecuta desde la única entrada al Dashboard.
          typeof loadAccountReports === 'function' ? loadAccountReports() : Promise.resolve()
        ]);
      }

      await runLoadAppHooks({
        initialSession: shouldOpenDashboard,
        user: currentUser
      });

      return currentUser;
    } catch (e) {
      console.error('Error inicializando panel (sesion preservada):', e);
      showMessage('Se inicio sesion, pero hubo un error cargando algunos paneles.', 'error');
      return currentUser;
    }
  })();

  try {
    return await __activeLoadAppPromise;
  } finally {
    __activeLoadAppPromise = null;
  }
}

window.loadApp = loadApp;

// Iniciar la sesión una sola vez, después de que app.js y los demás módulos
// hayan terminado de registrar sus funciones y hooks.
let __initialSessionBootStarted = false;
function startInitialSessionBoot() {
  if (__initialSessionBootStarted || !token) return;
  __initialSessionBootStarted = true;
  const loader = typeof window.loadApp === 'function' ? window.loadApp : loadApp;
  Promise.resolve(loader()).catch(error => {
    console.error('Error en el arranque inicial de sesión:', error);
  });
}

async function startPublicPanelBoot(){ await loadTenantContext(); await loadPanelInvite(); }
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => { startPublicPanelBoot(); startInitialSessionBoot(); }, { once: true });
} else { setTimeout(() => { startPublicPanelBoot(); startInitialSessionBoot(); }, 0); }
