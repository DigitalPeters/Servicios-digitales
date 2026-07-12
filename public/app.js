function openTopbarAnnouncements(){
  const modal = document.getElementById('modal-anuncios');
  if (!modal) return;

  modal.style.display = 'flex';
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');

  if (typeof fillAnnouncementModalFields === 'function') {
    fillAnnouncementModalFields('Cargando anuncio activo...');
  }
}

async function loadTopbarAnnouncements(){
  if (typeof syncAnnouncementControlAccess === 'function') {
    syncAnnouncementControlAccess();
  }
  if (typeof loadPanelAnnouncementText === 'function') {
    await loadPanelAnnouncementText();
  }
}

window.abrirModalAnuncios = async function(){
  openTopbarAnnouncements();
  await loadTopbarAnnouncements();
};

window.cerrarModalAnuncios = function() {
  const modal = document.getElementById('modal-anuncios');
  if (!modal) return;
  modal.style.display = 'none';
  modal.classList.add('hidden');
  modal.setAttribute('aria-hidden', 'true');
};

let token=localStorage.getItem('token');let currentUser=null;let allProducts=[];let myOrders=[];let allUsers=[];let adminOrders=[];
let currentInventoryPage = 1;
let currentOrdersPage = 1;

function showAuth(type){const isLogin=type==='login';document.getElementById('loginForm')?.classList.toggle('hidden',!isLogin);document.getElementById('registerForm')?.classList.toggle('hidden',isLogin);document.getElementById('loginTab')?.classList.toggle('active',isLogin);document.getElementById('registerTab')?.classList.toggle('active',!isLogin)}
function toggleSidebar(){document.getElementById('sidebar').classList.toggle('show')}

function showSection(name) {
  activarHistorialCelular();
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));

  const sec = document.getElementById('section-' + name);
  if (sec) sec.classList.add('active');

  document.querySelectorAll('.menu-btn')
    .forEach(b => b.classList.toggle('active', b.dataset.section === name));

  document.getElementById('sidebar')?.classList.remove('show');

  if (name === 'shop') loadProducts();
  if (name === 'orders') loadMyOrders();

  if (name === 'admin' && currentUser?.role === 'admin') {
    loadUsers();
    loadAdminProducts();
    loadAdminOrders();
    loadSalesReport();
    loadPlatformInventory();
    loadAccountReports();
  }

  if (name === 'alerts') loadExpiringAlerts();

  // --- SECCIÓN DASHBOARD ---
  if (name === 'dashboard' && currentUser?.role === 'admin') {
    loadExpiringCount();
  }
} // <--- Esta es la ÚNICA llave que cierra toda la función

function cambiarSeccion(name){
  const key = String(name || '').toLowerCase().trim();
  const map = {
    dashboard: 'dashboard',
    inicio: 'dashboard',
    'mi-cuenta': 'account',
    micuenta: 'account',
    cuenta: 'account',
    tienda: 'shop',
    pedidos: 'orders',
    saldo: 'balance',
    reportes: 'reports'
  };
  showSection(map[key] || name);
}

function scrollToAdmin(id){showSection('admin');setTimeout(()=>document.getElementById(id)?.scrollIntoView({behavior:'smooth',block:'start'}),80)}

function openUsersFromDashboard(){
  if(currentUser?.role==='admin'){
    showSection('admin');
    setTimeout(()=>scrollToAdmin('adminUsersPanel'),80);
  }else{
    showSection('account');
  }
}

async function reloadDashboard() {
  if (!currentUser || currentUser.role !== 'admin') return;

  showMessage('Actualizando panel...');

  await Promise.allSettled([
    loadUsers(),
    loadAdminProducts(),
    loadAdminOrders(),
    loadBalanceRequests(),
    loadAccountReports(),
    loadSalesReport(true),
    loadPlatformInventory()
  ]);

  showMessage('Panel actualizado');
}

function openProductsFromDashboard(){
  if(currentUser?.role==='admin'){
    showSection('admin');
    setTimeout(()=>scrollToAdmin('adminProductsPanel'),80);
  }else{
    showSection('shop');
  }
}

function openOrdersFromDashboard(){
  if(currentUser?.role==='admin'){
    showSection('admin');
    setTimeout(()=>scrollToAdmin('adminOrdersPanel'),80);
  }else{
    showSection('orders');
  }
}
function showMessage(text,type='success'){document.getElementById('message').innerHTML=`<p class="${type}">${safeText(text)}</p>`;setTimeout(()=>{document.getElementById('message').innerHTML=''},4500)}
function showMicroIndicator(text, type = 'success') {
  let box = document.getElementById('micro-indicator');
  if (!box) {
    box = document.createElement('div');
    box.id = 'micro-indicator';
    box.style.position = 'fixed';
    box.style.right = '16px';
    box.style.bottom = '16px';
    box.style.zIndex = '100000';
    box.style.padding = '10px 12px';
    box.style.borderRadius = '10px';
    box.style.fontSize = '13px';
    box.style.fontWeight = '700';
    box.style.boxShadow = '0 8px 24px rgba(0,0,0,0.35)';
    box.style.transition = 'opacity .22s ease, transform .22s ease';
    box.style.opacity = '0';
    box.style.transform = 'translateY(8px)';
    box.style.maxWidth = '280px';
    box.style.pointerEvents = 'none';
    document.body.appendChild(box);
  }

  box.textContent = String(text || 'Actualizado');
  if (type === 'error') {
    box.style.background = '#7f1d1d';
    box.style.color = '#fee2e2';
    box.style.border = '1px solid #ef4444';
  } else {
    box.style.background = '#064e3b';
    box.style.color = '#d1fae5';
    box.style.border = '1px solid #10b981';
  }

  box.style.opacity = '1';
  box.style.transform = 'translateY(0)';
  clearTimeout(window.__microIndicatorTimer);
  window.__microIndicatorTimer = setTimeout(() => {
    if (!box) return;
    box.style.opacity = '0';
    box.style.transform = 'translateY(8px)';
  }, 1800);
}
function resolveWelcomeName(loginData){const fromApi=String(loginData?.user?.name||loginData?.name||'').trim();if(fromApi)return fromApi;const fromMe=String(currentUser?.name||'').trim();if(fromMe)return fromMe;const fromInput=String(document.getElementById('loginEmail')?.value||'').trim();return fromInput?fromInput.split('@')[0]:'Usuario'}
function paintDashboardWelcomeBanner(name){const el=document.getElementById('dashboardWelcomeBanner');if(!el)return;const finalName=String(name||'Usuario').trim()||'Usuario';el.textContent=`¡Bienvenido, ${finalName}!`;el.classList.remove('hidden');clearTimeout(window.__welcomeBannerTimer);window.__welcomeBannerTimer=setTimeout(()=>el.classList.add('hidden'),7000)}
function safeText(v){return String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;')}
function parseJsonArray(v){try{if(Array.isArray(v))return v;const p=JSON.parse(v||'[]');return Array.isArray(p)?p:[]}catch{return[]}}
function parseJsonObject(v){try{if(typeof v==='object'&&v!==null)return v;const p=JSON.parse(v||'{}');return typeof p==='object'&&p!==null?p:{}}catch{return{}}}
function normalizeFieldName(n){return String(n||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ñ/g,'n').replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'')}
function fieldLabel(f){const labels={curp:'CURP',rfc:'RFC',idcif:'IDCIF',nss:'NSS',nombre_completo:'Nombre completo',correo:'Correo',telefono:'Teléfono',fecha_nacimiento:'Fecha de nacimiento'};return labels[f]||String(f).replace(/_/g,' ').replace(/\b\w/g,l=>l.toUpperCase())}
function getChargeModeText(m){return m==='on_success'?'Se descuenta cuando el admin marque Éxito':'Se descuenta al comprar'}
function getStatusText(s){return({accion_en_espera:'Acción en espera',en_proceso:'En proceso',exito:'Éxito',rechazado:'Rechazado'}[s]||s)}
function formatMoney(v){return Number(v||0).toFixed(2)}
async function api(path,opt={}){const headers=opt.headers||{};if(token)headers.Authorization='Bearer '+token;if(!(opt.body instanceof FormData))headers['Content-Type']='application/json';const r=await fetch(path,{...opt,headers});const d=await r.json().catch(()=>({}));if(!r.ok){const detailed=(Array.isArray(d.errors)&&d.errors.length?d.errors.join(' | '):'')||(typeof d.error==='string'&&d.error)||`Error HTTP ${r.status}`;throw new Error(detailed)}return d}
async function register(){try{const data=await api('/api/register',{method:'POST',body:JSON.stringify({name:registerName.value,email:registerEmail.value,password:registerPassword.value})});token=data.token;localStorage.setItem('token',token);showMessage(data.message||'Cuenta creada');await loadApp()}catch(e){showMessage(e.message,'error')}}
async function login(){try{const data=await api('/api/login',{method:'POST',body:JSON.stringify({email:loginEmail.value,password:loginPassword.value})});token=data.token;localStorage.setItem('token',token);const welcomeName=resolveWelcomeName(data);window.__pendingWelcomeName=welcomeName;showMessage(`¡Bienvenido, ${welcomeName}!`);await loadApp()}catch(e){showMessage(e.message,'error')}}
window.register = register;
window.login = login;
function logout(){localStorage.removeItem('token');token=null;currentUser=null;document.getElementById('authSection').classList.remove('hidden');document.getElementById('appSection').classList.add('hidden');showMessage('Sesión cerrada')}

document.addEventListener('click', async function(e) {
  const btnTopReporteVentas = e.target.closest('#btn-top-reporte-ventas');
  if (btnTopReporteVentas) {
    e.preventDefault();
    if (typeof openSalesReport === 'function') {
      openSalesReport();
    } else if (typeof scrollToAdmin === 'function') {
      showSection('admin');
      setTimeout(() => scrollToAdmin('adminSalesReportPanel'), 80);
    } else {
      showSection('admin');
    }

    if (typeof loadSalesReport === 'function') {
      await loadSalesReport(true);
    }
    return;
  }

   // --- BLOQUE ANUNCIOS INTEGRADO Y BLINDADO POR TI ---
  const abrirAnuncios = e.target.closest('#btn-anuncios') || e.target.closest('#btn-comunicados');
  if (abrirAnuncios) {
    e.preventDefault();
    console.log("¡El botón de comunicados fue detectado al primer clic!");

    const modal = document.getElementById('modal-anuncios') || document.getElementById('modal-comunicados');
    if (modal) {
      // 💥 LA BALA DE PLATA: Arrancamos el modal de cualquier contenedor oculto de Copilot
      // y lo movemos directamente al cuerpo principal de la página en tiempo real
      document.body.appendChild(modal);

      // Ahora sí, lo forzamos a mostrarse visualmente
      modal.style.setProperty('display', 'flex', 'important');
      modal.classList.remove('hidden');
      modal.setAttribute('aria-hidden', 'false');
    } else {
      console.log("Error: No se encontró ningún modal con ID modal-anuncios o modal-comunicados");
    }

    // ⏳ Retrasamos la carga de datos 50 milisegundos para que primero se pinte el modal
    // y no congele la animación visual de la pantalla
    setTimeout(() => {
      try {
        if (typeof loadTopbarAnnouncements === 'function') {
          loadTopbarAnnouncements();
        } else if (typeof cargarAnuncioActual === 'function') {
          cargarAnuncioActual();
        }
      } catch (err) {
        console.log("Error secundario al cargar datos:", err);
      }
    }, 50);

    return;
  }

  // --- BLOQUE DE CIERRE Y ACCIONES BLINDADO POR TI ---
  const cerrarAnuncios = e.target.closest('#btn-cerrar-anuncios, #btn-cerrar-anuncios-x');
  if (cerrarAnuncios) {
    e.preventDefault();
    const modal = document.getElementById('modal-anuncios') || document.getElementById('modal-comunicados');
    if (modal) {
      // Forzamos el ocultado inmediato anulando el flex anterior
      modal.style.setProperty('display', 'none', 'important');
    }
    if (typeof window.cerrarModalAnuncios === 'function') {
      window.cerrarModalAnuncios();
    }
    return;
  }

  const activarAnuncio = e.target.closest('#btn-activar-anuncios');
  if (activarAnuncio) {
    e.preventDefault();
    await applyAnnouncementFromModal();
    const modal = document.getElementById('modal-anuncios') || document.getElementById('modal-comunicados');
    if (modal) modal.style.setProperty('display', 'none', 'important');
    if (typeof window.cerrarModalAnuncios === 'function') window.cerrarModalAnuncios();
    return;
  }

  const ocultarAnuncio = e.target.closest('#btn-ocultar-anuncios');
  if (ocultarAnuncio) {
    e.preventDefault();
    await clearAnnouncementFromModal();
    const modal = document.getElementById('modal-anuncios') || document.getElementById('modal-comunicados');
    if (modal) modal.style.setProperty('display', 'none', 'important');
    if (typeof window.cerrarModalAnuncios === 'function') window.cerrarModalAnuncios();
    return;
  }

  const eliminarAnuncio = e.target.closest('#btn-eliminar-anuncios');
  if (eliminarAnuncio) {
    e.preventDefault();
    await deleteAnnouncementFromModal();
    const modal = document.getElementById('modal-anuncios') || document.getElementById('modal-comunicados');
    if (modal) modal.style.setProperty('display', 'none', 'important');
    if (typeof window.cerrarModalAnuncios === 'function') window.cerrarModalAnuncios();
    return;
  }

  const btnBuscar = e.target.closest('#btn-ejecutar-busqueda');
  if (btnBuscar) {
    e.preventDefault();
    const emailInput = document.getElementById('input-busqueda-email')?.value.trim();
    if (!emailInput) return alert('Escribe un correo para buscar');

    console.log('Buscando el correo:', emailInput);

    try {
      const response = await fetch(`/api/inventory/search?email=${encodeURIComponent(emailInput)}`);
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.error || 'No se pudo completar la búsqueda');
      }

      const cuentas = Array.isArray(payload) ? payload : [];
      console.log('Cuentas encontradas desde el servidor:', cuentas);
      showMessage(`Búsqueda completada: ${cuentas.length} resultado(s).`);

      const listBox = document.getElementById('platformAccountsList') || document.getElementById('adminPlatformAccountsList');
      const countEl = document.getElementById('adminPlatformAccountsCount');
      const info = document.getElementById('inv-page-info');
      const prevBtn = document.getElementById('inv-prev-btn');
      const nextBtn = document.getElementById('inv-next-btn');

      if (listBox) {
        listBox.innerHTML = renderPlatformAccountsTable(
          cuentas,
          `No se encontraron cuentas para ${safeText(emailInput)}.`
        );
      }

      if (countEl) countEl.textContent = String(cuentas.length);
      if (info) info.textContent = `Búsqueda: ${cuentas.length} resultado(s)`;
      if (prevBtn) prevBtn.disabled = true;
      if (nextBtn) nextBtn.disabled = true;

      // NOTA DE CONTROL: Aquí debes pasarle el arreglo 'cuentas' a la función
      // que use tu sistema para dibujar las filas del inventario en pantalla.
      // Ejemplo: renderInventoryTable(cuentas);
    } catch (err) {
      console.error('Error al ejecutar búsqueda:', err);
      showMessage(err.message || 'Error al ejecutar búsqueda', 'error');
    }

    return;
  }

  const btnLimpiarBuscar = e.target.closest('#btn-limpiar-busqueda');
  if (btnLimpiarBuscar) {
    e.preventDefault();
    const inputBusqueda = document.getElementById('input-busqueda-email');
    if (inputBusqueda) inputBusqueda.value = '';
    if (typeof loadPlatformInventory === 'function') {
      await loadPlatformInventory();
    }
    return;
  }

  const quarantineAction = e.target.closest('[data-quarantine-action]');
  if (quarantineAction) {
    e.preventDefault();

    const action = String(quarantineAction.dataset.quarantineAction || '').toLowerCase();
    const accountId = Number(quarantineAction.dataset.accountId || 0);
    if (!Number.isInteger(accountId) || accountId <= 0) {
      showMicroIndicator('Cuenta inválida para esta acción.', 'error');
      return;
    }

    try {
      if (action === 'release') {
        const passInput = document.getElementById(`new-pass-${accountId}`);
        const newPass = String(passInput?.value || '').trim();
        if (!newPass) {
          showMicroIndicator('Escribe la nueva contraseña para liberar.', 'error');
          return;
        }
        if (!confirm('¿Confirma que ya cambiaste esta contraseña en la página oficial?')) {
          return;
        }

        const response = await fetch(`/api/admin/accounts/${accountId}/release`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + localStorage.getItem('token')
          },
          body: JSON.stringify({ new_password: newPass })
        });
        const data = await response.json().catch(() => ({}));

        if (response.ok) {
          const fila = e.target.closest('[data-quarantine-row="1"]');
          if (fila) fila.remove();

          showMicroIndicator(data.message || 'Cuenta liberada correctamente.', 'success');

          const stat = document.getElementById('statExpiring');
          const leftRows = document.querySelectorAll('#quarantineModal [data-quarantine-row="1"]').length;
          if (stat) stat.textContent = String(leftRows);

          if (typeof checkQuarantineAccounts === 'function') checkQuarantineAccounts();
          if (typeof loadPlatformInventory === 'function') loadPlatformInventory();
          return;
        }

        throw new Error(data.error || 'Error liberando cuenta.');
      }

      if (action === 'discard') {
        if (!confirm('¿Deseas enviar esta cuenta a desecho permanente?')) {
          return;
        }

        const response = await fetch(`/api/admin/accounts/${accountId}/discard`, {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer ' + localStorage.getItem('token'),
            'Content-Type': 'application/json'
          }
        });
        const data = await response.json().catch(() => ({}));

        if (response.ok) {
          const fila = e.target.closest('[data-quarantine-row="1"]');
          if (fila) fila.remove();

          showMicroIndicator(data.message || 'Cuenta desechada correctamente.', 'success');

          const stat = document.getElementById('statExpiring');
          const leftRows = document.querySelectorAll('#quarantineModal [data-quarantine-row="1"]').length;
          if (stat) stat.textContent = String(leftRows);

          if (typeof checkQuarantineAccounts === 'function') checkQuarantineAccounts();
          if (typeof loadPlatformInventory === 'function') loadPlatformInventory();
          return;
        }

        throw new Error(data.error || 'Error al desechar cuenta.');
      }
    } catch (err) {
      showMicroIndicator('Error: ' + err.message, 'error');
      console.error(err);
    }
    return;
  }

  const backdropAnuncios = e.target.closest('#backdrop-anuncios');
  if (backdropAnuncios) {
    window.cerrarModalAnuncios();
    return;
  }
});

async function loadApp() {
  if (!token) return;
  try {
    currentUser = await api('/api/me');
    authSection.classList.remove('hidden'); // Ajusta esto según tu lógica
    appSection.classList.remove('hidden');

    userName.textContent = currentUser.name;
    userEmail.textContent = currentUser.email;
    userRole.textContent = currentUser.role;
    userBalance.textContent = formatMoney(currentUser.balance);
    sideEmail.textContent = currentUser.email;
    topUserName.textContent = currentUser.name;
    statBalance.textContent = formatMoney(currentUser.balance);
    statUsers.textContent = '0';
    
    const btnHistorial = document.getElementById('btnHistorialId');
    if (btnHistorial) {
      btnHistorial.onclick = function() {
        if (typeof window.abrirModalHistorial === 'function') {
          window.abrirModalHistorial();
        }
      };
    }

    await loadProducts();
    await loadMyOrders();
    await loadBalanceRequests();

    if (currentUser.role === 'admin') {
      setTodaySalesDate();
      await loadUsers();
      await loadAdminProducts();
      await loadAdminOrders();
      await loadSalesReport();
      await loadPlatformInventory();
      await loadExpiringCount();
      await loadAccountReports();
    }
    showSection('dashboard');
    activarHistorialCelular();
    
  } catch (e) {
    console.error("Error en loadApp:", e);
    logout();
  }
}

async function loadProducts(){allProducts=await api('/api/products');statProducts.textContent=allProducts.length;adminProductsCount.textContent=allProducts.length;buildCategoryFilter();renderProducts(allProducts)}

async function loadExpiringCount(){
  try{
    if(!currentUser || String(currentUser.role || '').toLowerCase() !== 'admin'){
      const renewalsNoAdmin = document.getElementById('count-pedidos_pendientes');
      if(renewalsNoAdmin) renewalsNoAdmin.textContent = '0';
      return;
    }

    const data = await api('/api/alerts/count');
    const renewals = Number(data?.count || 0);
    const renewalsEl = document.getElementById('count-pedidos_pendientes');
    if(renewalsEl) renewalsEl.textContent = String(renewals);

    const expiringCard = document.getElementById('dashExpiringCard');
    if(expiringCard) expiringCard.classList.remove('hidden');
  }catch(e){
    console.warn('Error cargando contador de renovaciones', e);
  }
}

function buildCategoryFilter(){const sel=categoryFilter;const cur=sel.value;const cats=[...new Set(allProducts.map(p=>p.category||'Otros'))].sort();sel.innerHTML='<option value="">Todas las categorías</option>'+cats.map(c=>`<option value="${safeText(c)}">${safeText(c)}</option>`).join('');sel.value=cur}
function filterProducts(){const term=(productSearch?.value||globalSearch?.value||'').toLowerCase();const cat=categoryFilter?.value||'';const filtered=allProducts.filter(p=>(!term||String(p.name).toLowerCase().includes(term)||String(p.category||'').toLowerCase().includes(term))&&(!cat||(p.category||'Otros')===cat));renderProducts(filtered)}
function renderProducts(products){let html='';const cats={};products.forEach(p=>{const c=p.category||'Otros';(cats[c]=cats[c]||[]).push(p)});Object.keys(cats).forEach(c=>{html+=`<div class="category-title">${safeText(c)}</div>`+cats[c].map(renderProductRow).join('')});productsList.innerHTML=html||'No hay productos.'}

function renderProductRow(product) {
    const stockEnabled = Number(product.stock_enabled || 0) === 1;
    const stock = Number(product.stock || 0);
    const soldOut = stockEnabled && stock <= 0;

    return `<div class="product-row" data-product-id="${product.id}">
        <div class="product-header" onclick="toggleProduct(${product.id})">
            <div>
                <div class="product-name">${safeText(product.name)}</div>
                <span class="chip">${safeText(product.category || 'Otros')}</span>
            </div>
            <div>
                <div class="price">$${formatMoney(product.price)}</div>
                ${stockEnabled ? `<div class="stock ${soldOut ? 'out' : ''}">${soldOut ? 'Sin stock' : 'Stock: ' + stock}</div>` : ''}
            </div>
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


function toggleProduct(id){const row=document.querySelector(`.product-row[data-product-id="${id}"]`);if(!row)return;const open=row.classList.contains('open');document.querySelectorAll('.product-row').forEach(r=>r.classList.remove('open'));if(!open)row.classList.add('open')}

function renderProductInputs(product) {
    const fields = parseJsonArray(product.required_fields);
    if (!fields.length) return `<p class="small-text">Este producto no requiere datos adicionales.</p>`;
    
    return fields.map(f => {
        const palabra = f.toLowerCase();
        // Si el dato requerido contiene alguna de estas palabras, pide un archivo
        if (palabra.includes('pdf') || palabra.includes('foto') || palabra.includes('ine') || palabra.includes('archivo')) {
            return `
            <div style="margin-bottom: 10px;">
                <label class="field-label" style="color: #d84315; font-weight: bold;">${safeText(fieldLabel(f))} (Subir Archivo)</label>
                <input type="file" id="field-${product.id}-${f}" accept=".pdf, image/*" style="width: 100%; font-size: 13px;" />
            </div>`;
        } else {
            // Si no, muestra tu campo de texto normal
            return `
            <div style="margin-bottom: 10px;">
                <label class="field-label">${safeText(fieldLabel(f))}</label>
                <input id="field-${product.id}-${f}" placeholder="Ingresa ${safeText(fieldLabel(f))}" style="width: 100%;" />
            </div>`;
        }
    }).join('');
}
// Función para convertir el PDF a texto (Base64)
function convertFileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
  });
}

// Tu función de compra actualizada
async function buyProduct(productId) {
  try {
    const product = allProducts.find(p => Number(p.id) === Number(productId)) || 
                    await api('/api/products').then(ps => ps.find(p => Number(p.id) === Number(productId)));
    
    if (!product) throw new Error('Producto no encontrado');
    
    if (!confirm(`Vas a comprar: ${product.name}\nCosto: $${formatMoney(product.price)}\n¿Confirmas la compra?`)) return;
    
    const fields = parseJsonArray(product.required_fields);
    const order_data = {};
    
    fields.forEach(f => {
      const input = document.getElementById(`field-${productId}-${f}`);
      order_data[f] = input ? input.value.trim() : '';
    });

    // === NUEVO: CAPTURAMOS EL PDF ===
    let attached_document = null;
    // Buscamos la cajita del PDF usando el ID del producto
    const fileInput = document.getElementById(`file-${productId}`);
    
    if (fileInput && fileInput.files.length > 0) {
      const file = fileInput.files[0];
      // Validamos que sea menor a 5MB para no saturar tu base de datos
      if (file.size > 5 * 1024 * 1024) {
        throw new Error("El PDF es muy pesado. Máximo 5 MB.");
      }
      attached_document = await convertFileToBase64(file);
    }
    // ================================

    const data = await api('/api/buy/' + productId, {
      method: 'POST',
      body: JSON.stringify({ 
        order_data,
        attached_document // <-- Inyectamos el PDF al servidor
      })
    });
    
    const deliveredNow = String(data.delivered_account_data || '').trim();
    showMessage(data.message || 'Compra realizada');
    await loadApp();
    showSection('orders');
    if (deliveredNow) {
      openModalEntregaInmediata(deliveredNow);
    }
    
  } catch (e) {
    showMessage(e.message, 'error');
  }
}


async function loadMyOrders(){
  myOrders=await api('/api/my-orders');
  statOrders.textContent=myOrders.length;
  renderMyOrders();
  recentOrdersList.innerHTML=myOrders.slice(0,4).map(o=>`<div class="item"><b>#${o.id}</b> ${safeText(o.product_name)} <span class="status">${safeText(getStatusText(o.status))}</span></div>`).join('')||'Sin pedidos recientes.'
}
function extractDeliveredAccountEmail(text){
  const m=String(text||'').match(/(?:Correo|📧\s*Correo):\s*([^\n\r\s]+)/i);
  return m?m[1].trim():'';
}
function getWarrantyInfoFromOrder(o){
  const raw=String(o.delivered_account_data||o.admin_response||'');
  const m=raw.match(/Fecha de entrega:\s*(\d{2})\/(\d{2})\/(\d{2,4})/i);
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
function renderWarrantyNotice(o){
  if(!hasAccountDelivery(o))return '';
  const w=getWarrantyInfoFromOrder(o);
  if(!w)return '';
  return `<div class="order-data"><b>Garantía:</b><p style="margin:5px 0"><b>Entrega:</b> ${w.start.toLocaleDateString('es-MX')} &nbsp; <b>Vence:</b> ${w.end.toLocaleDateString('es-MX')} &nbsp; <b>Días restantes:</b> <span class="${w.active?'success':'error'}">${w.daysRemaining}</span></p></div>`;
}
async function loadMyReports(){
  try {
    const reports = await api('/api/my-account-reports');
    const box = document.getElementById('myReportsList');
    if(!box) return;
    box.innerHTML = reports.length ? reports.map(r => `
      <div class="item">
        <p><b>Reporte:</b> #${r.id} <span class="status">${safeText(r.status)}</span></p>
        <p><b>Correo reportado:</b> ${safeText(r.email)}</p>
        <p><b>Falla:</b> ${safeText(r.issue_type)}</p>
        <p><b>Explicación:</b> ${safeText(r.description)}</p>
        <div class="order-data response-text" style="background:#eef2ff; margin-top: 10px;"><b>Respuesta del admin:</b><br>${safeText(r.admin_response || 'En revisión por el administrador...')}</div>
      </div>
    `).join('') : 'No has reportado fallas.';
  } catch(e) { console.warn(e); }
}

function renderMyOrders(){
  const search=(document.getElementById('myOrdersSearch')?.value||'').toLowerCase().trim();
  const statusFilter=document.getElementById('myOrdersStatusFilter')?.value||'';
  let rows=[...(myOrders||[])];
  rows=rows.filter(o=>{
    const raw=String(o.delivered_account_data||o.admin_response||'');
    const email=extractDeliveredAccountEmail(raw);
    const hay=`${o.id} ${o.product_name||''} ${o.product_category||''} ${email} ${o.status||''}`.toLowerCase();
    const statusOk=!statusFilter || (statusFilter==='reportado' ? /reporte|falla|reemplazo|reembolso/i.test(raw+String(o.admin_response||'')) : o.status===statusFilter);
    return statusOk && (!search || hay.includes(search));
  });
  myOrdersList.innerHTML=rows.map(o=>{
    const data=parseJsonObject(o.order_data);
    const copyButton=hasAccountDelivery(o)?`<button class="copy-account-btn" onclick="copyAccountDataFromOrder(${o.id}, 'my')">📋 Copiar datos de cuenta</button>`:'';
    const reportButton=hasAccountDelivery(o)?`<button class="copy-account-btn danger-btn" onclick="reportDeliveredAccount(${o.id})">⚠ Reportar falla</button>`:'';
    return `<div class="item"><p><b>Pedido:</b> #${o.id}</p><p><b>Producto:</b> ${safeText(o.product_name)}</p><p><b>Monto:</b> $${formatMoney(o.amount)}</p><p><b>Estado:</b> <span class="status">${safeText(getStatusText(o.status))}</span></p>${renderWarrantyNotice(o)}${renderOrderData(data)}<p><b>Respuesta:</b></p><div class="response-text">${safeText(o.admin_response||'Sin respuesta todavía')}</div>${copyButton}${reportButton}</div>`
  }).join('')||'No hay pedidos con esos filtros.'
setTimeout(() => {
    const seccion = document.getElementById('myOrdersList'); // Asegúrate que este sea el ID de tu contenedor
    if (seccion) {
      seccion.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, 500);
}

function isLikelyAttachmentValue(v){
  const s=String(v||'').trim();
  if(!s) return false;
  if(/^data:image\//i.test(s)) return true;
  if(/^https?:\/\//i.test(s)) return true;
  if(/\.(png|jpe?g|webp|gif|bmp|svg|pdf)(\?|#|$)/i.test(s)) return true;
  return false;
}

function isLikelyImageAttachment(v){
  const s=String(v||'').trim();
  if(/^data:image\//i.test(s)) return true;
  if(/\.(png|jpe?g|webp|gif|bmp|svg)(\?|#|$)/i.test(s)) return true;
  return false;
}

function renderAttachmentButtons(url){
  const safeUrl=safeText(url||'');
  return `<div class="proof-actions"><a class="proof-action-btn" href="${safeUrl}" target="_blank" rel="noopener noreferrer">👁️ Ver Imagen</a><a class="proof-action-btn proof-action-download" href="${safeUrl}" download>📥 Descargar Comprobante</a></div>`;
}

function renderOrderData(data){
  const entries=Object.entries(data||{});
  if(!entries.length)return'';
  return `<div class="order-data"><b>Datos enviados:</b>${entries.map(([k,v])=>{
    const value=String(v??'').trim();
    if(isLikelyAttachmentValue(value)){
      const preview=isLikelyImageAttachment(value)?`<div class="proof-preview"><img src="${safeText(value)}" alt="Comprobante adjunto"></div>`:'';
      return `<div class="order-proof-row"><p style="margin:5px 0"><b>${safeText(fieldLabel(k))}:</b></p>${renderAttachmentButtons(value)}${preview}</div>`;
    }
    return `<p style="margin:5px 0"><b>${safeText(fieldLabel(k))}:</b> ${safeText(value)}</p>`;
  }).join('')}</div>`
}
async function enviarSolicitudSaldo(){
  try{
    const nombre=(document.getElementById('saldoNombre')?.value||'').trim();
    const banco=(document.getElementById('saldoBanco')?.value||'').trim();
    const monto=(document.getElementById('saldoMonto')?.value||'').trim();
    if(!nombre||!banco||!monto)throw new Error('Nombre, banco y monto son obligatorios');

    const data=await api('/api/balance-requests',{
      method:'POST',
      body:JSON.stringify({
        amount:monto,
        bank:banco,
        reference:'No proporcionada',
        account_holder:nombre,
        proof:''
      })
    });

    showMessage(data.message||'Solicitud enviada');
    saldoNombre.value=saldoBanco.value=saldoMonto.value='';
    await loadBalanceRequests();
  }catch(e){showMessage(e.message,'error')}
}
async function enviarReporteCuenta(){
  try{
    const correo=(document.getElementById('reporteCorreo')?.value||'').trim();
    const tipo=(document.getElementById('reporteTipo')?.value||'otro').trim();
    const explicacion=(document.getElementById('reporteExplicacion')?.value||'').trim();
    if(!correo||!explicacion)throw new Error('Correo y explicación son obligatorios');

    // --- NUEVA MAGIA: LEER LA FOTO COMO TEXTO ---
    let fotoBase64 = null;
    const fotoInput = document.getElementById('reporteEvidencia');
    if (fotoInput && fotoInput.files.length > 0) {
        const file = fotoInput.files[0];
        // Protección vital: Si la foto pesa más de 2MB, la bloqueamos para no tirar tu servidor
        if (file.size > 2 * 1024 * 1024) {
            throw new Error('La imagen es muy pesada (Máximo 2MB). Usa una imagen más ligera o recortada.');
        }
        fotoBase64 = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.readAsDataURL(file);
        });
    }
    // ---------------------------------------------

    const data=await api('/api/account-reports',{
        method:'POST',
        body:JSON.stringify({
            email:correo,
            issue_type:tipo,
            description:explicacion,
            evidence_image: fotoBase64 // Enviamos la foto adjunta al servidor
        })
    });
    
    showMessage(data.message||'Reporte enviado');
    
    // Limpiamos los campos para que quede como nuevo
    if(document.getElementById('reporteCorreo')) document.getElementById('reporteCorreo').value='';
    if(document.getElementById('reporteExplicacion')) document.getElementById('reporteExplicacion').value='';
    if(fotoInput) fotoInput.value='';
    
    // Refrescamos las vistas para que el vendedor vea su reporte al instante
    if(typeof loadAccountReports === 'function') await loadAccountReports();
    if(typeof loadMyReports === 'function') loadMyReports();
    
  }catch(e){
    showMessage(e.message,'error')
  }
}
function getBalanceRequestStatusText(status){
  const statuses={
    pendiente:"Pendiente",
    aprobado:"Aprobado",
    aprobada:"Aprobada",
    rechazado:"Rechazado",
    rechazada:"Rechazada"
  };
  return statuses[String(status||"").toLowerCase()] || status || "pendiente";
}

async function loadBalanceRequests(){
  try{
    let requests=[];
    if(currentUser?.role==='admin'){
      requests=await api('/api/admin/balance-requests');
      const pending=requests.filter(r=>String(r.status||'').toLowerCase()==='pendiente');
      statBalanceRequests.textContent=pending.length;

      const box=document.getElementById('adminBalanceRequestsList');
      if(box){
        box.innerHTML=pending.length?pending.map(r=>`
          <div class="item">
            <p><b>Solicitud:</b> #${r.id}</p>
            <p><b>Cliente:</b> ${safeText(r.customer_name||r.name||'Cliente')}</p>
            <p><b>Correo:</b> ${safeText(r.customer_email||r.email||'')}</p>
            <p><b>Nombre transferencia:</b> ${safeText(r.account_holder||r.titular||'')}</p>
            <p><b>Banco:</b> ${safeText(r.bank||r.banco||'')}</p>
            <p><b>Monto:</b> $${formatMoney(r.amount||r.monto)}</p>
            <p><b>Estado:</b> <span class="status">${safeText(getBalanceRequestStatusText(r.status||'pendiente'))}</span></p>

            <label class="field-label">Respuesta para el cliente</label>
            <textarea id="balance-response-${r.id}" placeholder="Ejemplo: Saldo aprobado y agregado a tu cuenta.">${safeText(r.admin_response||'')}</textarea>

            <div class="two-row">
              <button class="green-btn" onclick="updateBalanceRequestStatus(${r.id}, 'aprobado')">
                Aprobar y sumar saldo
              </button>
              <button class="danger-btn" onclick="updateBalanceRequestStatus(${r.id}, 'rechazado')">
                Rechazar
              </button>
            </div>
          </div>
        `).join(''):'Sin solicitudes pendientes.';
      }
    }else{
      try{requests=await api('/api/my-balance-requests')}catch(_){requests=[]}
      const pending=requests.filter(r=>String(r.status||'').toLowerCase()==='pendiente');
      statBalanceRequests.textContent=pending.length;
    }
  }catch(e){
    console.warn('No se pudieron cargar solicitudes de saldo',e);
    statBalanceRequests.textContent='0';
  }
}

async function updateBalanceRequestStatus(requestId,status){
  try{
    const response=document.getElementById('balance-response-'+requestId)?.value||'';
    const data=await api('/api/admin/balance-requests/'+requestId+'/status',{
      method:'PATCH',
      body:JSON.stringify({
        status:status,
        admin_response:response
      })
    });
    showMessage(data.message||'Solicitud de saldo actualizada');
    await 




// loadApp automático movido al final seguro
    showSection('admin');
    setTimeout(()=>scrollToAdmin('adminBalanceRequestsPanel'),120);
  }catch(e){
    showMessage(e.message,'error');
  }
}

function openBalanceRequests(){if(currentUser?.role==='admin'){showSection('admin');setTimeout(()=>scrollToAdmin('adminBalanceRequestsPanel'),80)}else{showSection('balance')}}
function copyText(t){
  copyToClipboard(t,'Copiado');
}
function getAccountTextFromOrder(order){
  return String(order?.delivered_account_data || order?.admin_response || '').trim();
}
function hasAccountDelivery(order){
  const text=getAccountTextFromOrder(order);
  if(!text)return false;
  return text.includes('Cuenta de Streaming') || text.includes('Cuenta entregada') || text.includes('Cuenta entregada automáticamente') || (text.includes('Correo:') && text.includes('Contraseña:')) || (text.includes('📧 Correo') && text.includes('🔐 Contraseña'));
}
function copyToClipboard(text,successMessage='Copiado'){
  const value=String(text||'').trim();
  if(!value){showMessage('No hay datos para copiar','error');return;}
  if(navigator.clipboard && window.isSecureContext){
    navigator.clipboard.writeText(value).then(()=>showMessage(successMessage)).catch(()=>fallbackCopy(value,successMessage));
  }else{
    fallbackCopy(value,successMessage);
  }
}
function fallbackCopy(text,successMessage){
  try{
    const area=document.createElement('textarea');
    area.value=text;
    area.setAttribute('readonly','');
    area.style.position='fixed';
    area.style.left='-9999px';
    document.body.appendChild(area);
    area.select();
    document.execCommand('copy');
    document.body.removeChild(area);
    showMessage(successMessage);
  }catch(e){
    showMessage('No se pudo copiar. Selecciona el texto manualmente.','error');
  }
}
function copyAccountDataFromOrder(orderId,source='my'){
  const list=source==='admin'?adminOrders:myOrders;
  const order=list.find(o=>Number(o.id)===Number(orderId));
  let text='';
  if(source==='admin'){
    const responseBox=document.getElementById(`response-${orderId}`);
    text=(responseBox?.value || getAccountTextFromOrder(order) || '').trim();
  }else{
    text=getAccountTextFromOrder(order);
  }
  copyToClipboard(text,'Datos de cuenta copiados');
}

function openModalEntregaInmediata(text){
  if (String(currentUser?.role || '').toLowerCase() === 'admin') return;
  const modal=document.getElementById('modalEntregaInmediata');
  const box=document.getElementById('modalEntregaInmediataText');
  if(!modal || !box) return;
  box.value=String(text||'').trim();
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden','false');
}

function closeModalEntregaInmediata(){
  const modal=document.getElementById('modalEntregaInmediata');
  if(!modal) return;
  modal.classList.add('hidden');
  modal.setAttribute('aria-hidden','true');
}

function copyEntregaInmediataData(){
  const text=document.getElementById('modalEntregaInmediataText')?.value||'';
  if(!text.trim()) return showMessage('No hay datos para copiar','error');
  copyToClipboard(text,'Datos de entrega copiados');
}
function extractAccountEmailFromText(text){
  const value=String(text||'');
  const match=value.match(/(?:📧\s*)?Correo:\s*([^\s\n]+)/i);
  return match ? match[1].trim() : '';
}
function reportDeliveredAccount(orderId){
  const order=myOrders.find(o=>Number(o.id)===Number(orderId));
  const text=getAccountTextFromOrder(order);
  const email=extractAccountEmailFromText(text);
  if(!email){showMessage('No pude detectar el correo de esta cuenta para reportarla','error');return;}
  showSection('reports');
  const input=document.getElementById('reporteCorreo');
  if(input){input.value=email;}
  copyToClipboard(email,'Correo copiado y colocado en el reporte');
  setTimeout(()=>document.getElementById('reporteExplicacion')?.focus(),150);
}
function getRequiredFieldsFromInput(id){return document.getElementById(id).value.split(',').map(normalizeFieldName).filter(Boolean)}
function toggleCreateProduct(){createProductBox.classList.toggle('hidden')}
async function createProduct(){try{const data=await api('/api/admin/create-product',{method:'POST',body:JSON.stringify({name:productName.value,description:productDescription.value,price:productPrice.value,cost_price:(document.getElementById('productCostPrice')?.value||0),category:productCategory.value,required_fields:getRequiredFieldsFromInput('productRequiredFields'),charge_mode:productChargeMode.value,stock_enabled:productStockEnabled.checked,stock:productStock.value})});showMessage(data.message||'Producto creado');productName.value=productDescription.value=productPrice.value=productCategory.value=productRequiredFields.value='';if(document.getElementById('productCostPrice'))productCostPrice.value='0';productStock.value='0';productStockEnabled.checked=false;await loadProducts();await loadAdminProducts();}catch(e){showMessage(e.message,'error');}}
async function loadUsers(){allUsers=await api('/api/admin/users');statUsers.textContent=allUsers.length;adminUsersCount.textContent=allUsers.length;balanceUserSelect.innerHTML='<option value="">Selecciona usuario</option>'+allUsers.map(u=>`<option value="${u.id}">${safeText(u.name)} (${safeText(u.email)}) - $${formatMoney(u.balance)}</option>`).join('');balanceUserSelect.onchange=()=>{balanceUserId.value=balanceUserSelect.value};usersList.innerHTML=allUsers.map(u=>`<div class="item"><p><b>ID:</b> ${u.id}</p><p><b>Nombre:</b> ${safeText(u.name)}</p><p><b>Correo:</b> ${safeText(u.email)}</p><p><b>Rol:</b> ${safeText(u.role)}</p><p><b>Saldo:</b> $${formatMoney(u.balance)}</p></div>`).join('')||'No hay usuarios.'}
async function addBalance(){try{const data=await api('/api/admin/add-balance',{method:'POST',body:JSON.stringify({user_id:Number(balanceUserId.value),amount:balanceAmount.value,note:balanceNote.value})});showMessage(data.message||'Saldo agregado');balanceAmount.value=balanceNote.value='';await loadUsers();}catch(e){showMessage(e.message,'error');}}
async function loadAdminProducts(){const products=allProducts.length?allProducts:await api('/api/products');adminProductsCount.textContent=products.length;adminProductsList.innerHTML=products.map(p=>{const rf=parseJsonArray(p.required_fields);const se=Number(p.stock_enabled||0)===1;return `<div class="item" id="admin-product-${p.id}"><div style="display:flex;justify-content:space-between;gap:12px;cursor:pointer" onclick="toggleAdminProduct(${p.id})"><b>${safeText(p.name)}</b><span>Venta: $${formatMoney(p.price)} · Costo: $${formatMoney(p.cost_price||0)} · ${safeText(p.category||'Otros')}</span></div><div class="admin-product-body"><label class="field-label">Nombre</label><input id="editName-${p.id}" value="${safeText(p.name)}" /><label class="field-label">Descripción</label><textarea id="editDescription-${p.id}">${safeText(p.description||'')}</textarea><div class="three-row"><div><label class="field-label">Precio de venta</label><input id="editPrice-${p.id}" type="number" step="0.01" value="${p.price}" /></div><div><label class="field-label">Costo de compra</label><input id="editCostPrice-${p.id}" type="number" step="0.01" value="${Number(p.cost_price||0)}" /></div><div><label class="field-label">Categoría</label><input id="editCategory-${p.id}" value="${safeText(p.category||'Otros')}" /></div></div><label class="field-label">Datos requeridos</label><textarea id="editRequiredFields-${p.id}">${safeText(rf.join(', '))}</textarea><label class="field-label">Cobro</label><select id="editChargeMode-${p.id}"><option value="on_purchase" ${p.charge_mode==='on_purchase'?'selected':''}>Descontar al comprar</option><option value="on_success" ${p.charge_mode==='on_success'?'selected':''}>Descontar cuando el admin marque Éxito</option></select><label class="checkbox-row"><input type="checkbox" id="editStockEnabled-${p.id}" ${se?'checked':''}/> Activar stock</label><input id="editStock-${p.id}" type="number" min="0" value="${Number(p.stock||0)}"/><div class="three-row"><button onclick="updateProduct(${p.id})">Guardar</button><button class="danger-btn" onclick="deleteProduct(${p.id})">Eliminar</button><button class="muted-btn" onclick="toggleProduct(${p.id});showSection('shop')">Ver tienda</button></div></div></div>`}).join('')||'No hay productos.'}
function toggleAdminProduct(id){document.getElementById('admin-product-'+id)?.classList.toggle('open')}
async function updateProduct(id){try{const required_fields=document.getElementById('editRequiredFields-'+id).value.split(',').map(normalizeFieldName).filter(Boolean);const data=await api('/api/admin/products/'+id,{method:'PATCH',body:JSON.stringify({name:document.getElementById('editName-'+id).value,description:document.getElementById('editDescription-'+id).value,price:document.getElementById('editPrice-'+id).value,cost_price:(document.getElementById('editCostPrice-'+id)?.value||0),category:document.getElementById('editCategory-'+id).value,required_fields,charge_mode:document.getElementById('editChargeMode-'+id).value,stock_enabled:document.getElementById('editStockEnabled-'+id).checked,stock:document.getElementById('editStock-'+id).value})});showMessage(data.message||'Producto actualizado');await loadProducts();await loadAdminProducts();}catch(e){showMessage(e.message,'error');}}
async function deleteProduct(id){if(!confirm('¿Seguro que quieres eliminar este producto?'))return;try{const data=await api('/api/admin/products/'+id,{method:'DELETE'});showMessage(data.message||'Producto eliminado');await loadProducts();await loadAdminProducts();}catch(e){showMessage(e.message,'error');}}
async function loadAdminOrders(){
  adminOrders=await api('/api/admin/orders');
  adminOrdersCount.textContent=adminOrders.length;
  statOrders.textContent=currentUser?.role==='admin'?adminOrders.length:myOrders.length;
  adminOrdersList.innerHTML=adminOrders.map(o=>{
    const od=parseJsonObject(o.order_data);
    const copyButton=hasAccountDelivery(o)?`<button class="copy-account-btn" onclick="copyAccountDataFromOrder(${o.id}, 'admin')">📋 Copiar datos de cuenta</button>`:'';
    return `<div class="item"><p><b>Pedido:</b> #${o.id}</p><p><b>Cliente:</b> ${safeText(o.customer_name)}</p><p><b>Correo:</b> ${safeText(o.customer_email)}</p><p><b>Producto:</b> ${safeText(o.product_name)}</p><p><b>Monto:</b> $${formatMoney(o.amount)}</p><p><b>Estado actual:</b> <span class="status">${safeText(getStatusText(o.status))}</span></p><p><b>Cobrado:</b> ${Number(o.charged||0)===1?'Sí':'No'}</p>${renderOrderData(od)}<label class="field-label">Estado</label><select id="status-${o.id}"><option value="accion_en_espera" ${o.status==='accion_en_espera'?'selected':''}>Acción en espera</option><option value="en_proceso" ${o.status==='en_proceso'?'selected':''}>En proceso</option><option value="exito" ${o.status==='exito'?'selected':''}>Éxito</option><option value="rechazado" ${o.status==='rechazado'?'selected':''}>Rechazado</option></select><label class="field-label">Respuesta para el cliente</label><textarea id="response-${o.id}">${safeText(o.admin_response||'')}</textarea>${copyButton}<label class="checkbox-row"><input type="checkbox" id="refund-${o.id}" /> Devolver saldo si se rechaza</label><button onclick="updateOrderStatus(${o.id})">Actualizar pedido</button></div>`
  }).join('')||'No hay pedidos.'
}
async function updateOrderStatus(id){try{const data=await api('/api/admin/orders/'+id+'/status',{method:'PATCH',body:JSON.stringify({status:document.getElementById('status-'+id).value,response_message:document.getElementById('response-'+id).value,refund_if_rejected:document.getElementById('refund-'+id).checked})});showMessage(data.message||'Pedido actualizado');await loadAdminOrders();}catch(e){showMessage(e.message,'error');}}

function openSalesReport(){
  if(currentUser?.role==='admin'){
    showSection('admin');
    setTimeout(()=>scrollToAdmin('adminSalesReportPanel'),80);
    loadSalesReport();
  }
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

// ===============================
// FIX REPORTE VENTAS HOY ADMIN
// El dashboard siempre consulta el día actual del servidor en horario México.
// El filtro de fecha del panel se conserva solo cuando el admin selecciona una fecha.
// ===============================
async function loadSalesReport(forceToday=false){
  if(currentUser?.role!=='admin')return;
  try{
    const input=document.getElementById('salesReportDate');
    if(forceToday && input) input.value='';

    const date=input?.value||'';
    const data=await api('/api/admin/sales-report'+(date?'?date='+encodeURIComponent(date):''));

    if(input && data?.date) input.value=data.date;

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
      detailsBox.innerHTML=details.length?`<div class="table-wrap"><table class="mini-table"><thead><tr><th>Pedido</th><th>Cliente</th><th>Producto real vendido</th><th>Monto</th><th>Fecha México</th></tr></thead><tbody>${details.map(o=>`<tr><td>#${o.id}</td><td><b>${safeText(o.customer_name||'Cliente')}</b><br><span class="small-text">${safeText(o.customer_email||'')}</span></td><td>${safeText(o.product_name||'')}</td><td>$${formatMoney(o.amount)}</td><td>${safeText(o.created_at_mx||'')}</td></tr>`).join('')}</tbody></table></div>`:'Sin ventas en esta fecha.';
    }
  }catch(e){
    console.warn('No se pudo cargar reporte de ventas',e);
    showMessage(e.message||'Error cargando reporte de ventas','error');
  }
}

function openSalesReport(){
  if(currentUser?.role==='admin'){
    showSection('admin');
    setTimeout(()=>scrollToAdmin('adminSalesReportPanel'),80);
    loadSalesReport(true);
  }
}

const __oldShowSectionForSalesToday = showSection;
showSection = function(name){
  __oldShowSectionForSalesToday(name);
  if(name==='dashboard' && currentUser?.role==='admin'){
    loadSalesReport(true);
  }
};

// Auto-refresh periódico desactivado: las secciones se actualizan solo después de acciones.
// setInterval(()=>{
//   if(currentUser?.role==='admin') loadSalesReport(true);
// }, 60000);


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



// ===============================
// FIX FINAL: reporte de ventas con costo y ganancia real
// ===============================
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
    if(!allProducts.length) allProducts = await api('/api/products');
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
      listBox.innerHTML = renderPlatformAccountsTable(accounts, 'Sin cuentas.');
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

function renderPlatformAccountsTable(accounts, emptyMessage = 'Sin cuentas.') {
  const rows = Array.isArray(accounts) ? accounts : [];
  return rows.length
    ? `<div class="table-wrap"><table class="mini-table"><thead><tr><th>ID</th><th>Producto</th><th>Correo / contraseña</th><th>Perfil / PIN</th><th>URL</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>${rows.map(a => renderPlatformAccountRow(a)).join('')}</tbody></table></div>`
    : emptyMessage;
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

function openAccountReportsFromDashboard(){
  if(currentUser?.role==='admin'){
    showSection('admin');
    setTimeout(()=>scrollToAdmin('adminAccountReportsPanel'),80);
    loadAccountReports();
  }else{
    showSection('reports');
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

async function loadAccountReports(){
alert('LOAD ACCOUNT REPORTS NUEVO');

  if(currentUser?.role!=='admin')return;
  try{
    const reports = await api('/api/admin/account-reports');
    
    // --- PON ESTE DETECTOR AQUÍ ---
    console.log("👀 REPORTES RECIBIDOS:", reports);
    // ------------------------------
    const pending=reports.filter(r=>String(r.status||'').toLowerCase()==='pendiente');
    const stat=document.getElementById('statReports');
    if(stat)stat.textContent=pending.length;
    const box=document.getElementById('adminAccountReportsList');
  if(!box)return;
  box.innerHTML=reports.length?reports.map(r=>{
    const info=calculateReportRefundInfo(r);
    const canAct=String(r.status||'').toLowerCase()==='pendiente';
    return `<div class="item">
      <p><b>Reporte:</b> #${r.id} <span class="status">${safeText(r.status||'pendiente')}</span></p>
      <p><b>Cliente:</b> ${safeText(r.customer_name||'Cliente')} <span class="small-text">${safeText(r.customer_email||'')}</span></p>
      <p><b>Correo reportado:</b> ${safeText(r.email||'')}</p>
      <p><b>Producto:</b> ${safeText(r.product_name||r.account_product_name||'')} ${r.platform?`<span class="chip">${safeText(r.platform)}</span>`:''}</p>
      <p><b>Falla:</b> ${safeText(r.issue_type||'otro')}</p>
      <p><b>Explicación:</b> ${safeText(r.description||'')}</p>

      ${r.evidence_image ? `
      <details style="margin: 12px 0; cursor: pointer; background: #2a2a40; padding: 10px; border-radius: 5px; border: 1px solid #444;">
        <summary style="color: #10b981; font-weight: bold; outline: none; user-select: none;">📷 Ver Evidencia Adjunta</summary>
        <div style="text-align: center; margin-top: 15px;">
          <img src="${r.evidence_image}" style="max-width: 100%; max-height: 400px; border-radius: 5px; box-shadow: 0 4px 6px rgba(0,0,0,0.3);" alt="Evidencia">
        </div>
      </details>
      ` : ''}
      <p><b>Monto:</b> $${formatMoney(r.order_amount)} &nbsp; <b>Días usados:</b> ${info.daysUsed} &nbsp; <b>Días restantes:</b> ${info.daysRemaining} &nbsp; <b>Reembolso sugerido:</b> $${formatMoney(info.refund)}</p>
      ${r.admin_response?`<div class="order-data response-text"><b>Respuesta admin:</b><br>${safeText(r.admin_response)}</div>`:''}
      <div class="two-row">
        <button class="green-btn" onclick="replaceReportedAccount(${r.id})" ${canAct?'':'disabled'}>🔁 Reemplazar cuenta</button>
        <button class="danger-btn" onclick="refundReportedAccount(${r.id}, '${r.order_created_at}')" ${canAct?'':'disabled'}>💰 Reembolso proporcional</button>
      </div>
      <div class="two-row" style="margin-top:10px">
        <select id="reportStatus-${r.id}">
          <option value="pendiente" ${r.status==='pendiente'?'selected':''}>Pendiente</option>
          <option value="resuelto" ${r.status==='resuelto'?'selected':''}>Resuelto</option>
          <option value="reemplazo" ${r.status==='reemplazo'?'selected':''}>Reemplazo</option>
          <option value="reembolso" ${r.status==='reembolso'?'selected':''}>Reembolso</option>
        </select>
        <input id="reportResponse-${r.id}" placeholder="Respuesta para el cliente" value="${safeText(r.admin_response||'')}" />
      </div>
      <button class="outline-btn" style="width:auto" onclick="updateAccountReportStatus(${r.id})">Guardar veredicto</button>
    </div>`;
  }).join(''):'Sin reportes de falla.';
}catch(e){console.warn('No se pudieron cargar reportes de falla',e)}
}

async function updateAccountReportStatus(reportId){
  try{
    const status=document.getElementById(`reportStatus-${reportId}`)?.value||'pendiente';
    const admin_response=document.getElementById(`reportResponse-${reportId}`)?.value||'';
    const data=await api('/api/admin/account-reports/'+reportId+'/status',{method:'PATCH',body:JSON.stringify({status,admin_response})});
    showMessage(data.message||'Reporte actualizado');
    await loadAccountReports();
  }catch(e){showMessage(e.message,'error')}
}


async function replaceReportedAccount(reportId){
  try{
    const useManual = confirm(
      '¿Quieres capturar manualmente la cuenta de reemplazo?\n\n' +
      'Aceptar = Capturar correo, contraseña, perfil y PIN manualmente.\n' +
      'Cancelar = Usar una cuenta disponible del inventario automático.'
    );

    let body = {};

    if(useManual){
      const account_email = prompt('Correo de la cuenta nueva:');
      if(!account_email || !account_email.trim()) throw new Error('El correo de la cuenta es obligatorio');

      const account_password = prompt('Contraseña de la cuenta nueva:');
      if(!account_password || !account_password.trim()) throw new Error('La contraseña es obligatoria');

      const profile_name = prompt('Perfil (opcional):', '') || '';
      const profile_pin = prompt('PIN del perfil (opcional):', '') || '';
      const access_url = prompt('URL para código/soporte (opcional):', '') || '';
      const extra_data = prompt('Notas extra / datos adicionales (opcional):', '') || '';

      body = {
        manual: true,
        account_email: account_email.trim(),
        account_password: account_password.trim(),
        profile_name: profile_name.trim(),
        profile_pin: profile_pin.trim(),
        access_url: access_url.trim(),
        extra_data: extra_data.trim()
      };
    }else{
      if(!confirm('¿Reemplazar esta cuenta usando una cuenta disponible del inventario automático?'))return;
    }

    const data=await api('/api/admin/account-reports/'+reportId+'/replace',{
      method:'POST',
      body:JSON.stringify(body)
    });

    showMessage(data.message||'Cuenta reemplazada');
    await loadAccountReports();
    if(typeof loadMyAccountReports === 'function') await loadMyAccountReports();
    if(typeof loadAdminOrders === 'function') await loadAdminOrders();
    if(typeof loadPlatformInventory === 'function') await loadPlatformInventory();
  }catch(e){
    showMessage(e.message || 'Error reemplazando cuenta','error');
  }
}


async function refundReportedAccount(reportId, fechaCompra) {
  try {
    let amountToSend = null;

    // 1. PRIMER PASO: Preguntar qué cuenta falló
    const cuentaFallida = prompt("Si es un COMBO: ¿Qué cuenta específica falló? (Ej. Netflix, Vix)\n\nSi es cuenta normal: Deja esto en blanco y presiona Aceptar.");
    
    if (cuentaFallida === null) return; // Si el admin cancela, cerramos.

    // 2. SEGUNDO PASO: Si escribió el nombre de la cuenta, pedimos el precio
    if (cuentaFallida.trim() !== '') {
        const basePriceStr = prompt(`¿Cuál es el costo base de la cuenta de ${cuentaFallida.toUpperCase()}? (Solo escribe el número, ej. 45.50)`);
        
        if (basePriceStr === null) return;

        const precioBase = parseFloat(basePriceStr);
        if (isNaN(precioBase) || precioBase <= 0) {
            alert("Monto inválido. Operación cancelada.");
            return;
        }

        // 3. TERCER PASO: Hacemos el cálculo matemático AQUÍ MISMO para que no falle nada
        const hoy = new Date();
        const compra = new Date(fechaCompra);
        const diasTotalesServicio = 28; // Tu sistema original usa 28 días, lo igualamos aquí.
        
        let diasUsados = 0;
        // Validamos que la fecha sea correcta
        if (!isNaN(compra.getTime())) {
            const diferenciaMilisegundos = hoy.getTime() - compra.getTime();
            diasUsados = Math.floor(diferenciaMilisegundos / (1000 * 60 * 60 * 24));
        }
        
        // Evitamos números negativos
        diasUsados = Math.max(0, diasUsados); 

        let diasRestantes = 0;
        if (diasUsados >= diasTotalesServicio) {
            amountToSend = 0;
        } else {
            diasRestantes = diasTotalesServicio - diasUsados;
            const costoPorDia = precioBase / diasTotalesServicio;
            amountToSend = parseFloat((costoPorDia * diasRestantes).toFixed(2));
        }

        // 4. Confirmación final con todos los datos
        if (!confirm(`COMBO DETECTADO (Falla en ${cuentaFallida.toUpperCase()}):\n\nEsta cuenta se ha usado por ${diasUsados} días.\nEl reembolso por los ${diasRestantes} días restantes es de: $${amountToSend}.\n\n¿Aplicar este monto al vendedor?`)) {
            return;
        }
        
    } else {
        // SI ES CUENTA NORMAL (Lo dejó en blanco)
        if (!confirm('¿Aplicar reembolso proporcional NORMAL al saldo del usuario?')) {
            return;
        }
    }

    // 5. Enviamos la instrucción al servidor
    const data = await api('/api/admin/account-reports/' + reportId + '/refund-proportional', {
        method: 'POST',
        body: JSON.stringify({ overrideAmount: amountToSend }) 
    });

    showMessage(data.message || 'Reembolso aplicado');
    await loadAccountReports();
    await loadUsers();

  } catch (e) {
    // Si algo falla, forzamos que salga un aviso visual en pantalla
    console.error("Error al procesar reembolso:", e);
    alert("Ocurrió un error al intentar reembolsar: " + e.message);
  }
}
// ===============================
// GRÁFICAS DEL DASHBOARD ADMIN
// Usa los datos del reporte de ventas existente. No requiere librerías externas.
// ===============================
function makeChartColor(index){
  const colors=['#f00662','#17135a','#2563eb','#7c3aed','#06b6d4','#f59e0b','#16a34a'];
  return colors[index % colors.length];
}

function renderDashboardSalesCharts(byUser=[], byProduct=[]){
  const chartsPanel=document.getElementById('dashboardChartsPanel');
  if(chartsPanel && currentUser?.role==='admin') chartsPanel.classList.remove('hidden');

  const productBox=document.getElementById('dashboardTopProductsChart');
  const userBox=document.getElementById('dashboardTopUsersChart');

  if(productBox){
    const products=(byProduct||[]).slice(0,6);
    const totalOrders=products.reduce((acc,p)=>acc+Number(p.total_orders||0),0);
    if(!products.length || totalOrders<=0){
      productBox.innerHTML='<div class="empty-chart">Sin productos vendidos hoy.</div>';
    }else{
      let start=0;
      const stops=[];
      products.forEach((p,i)=>{
        const val=Number(p.total_orders||0);
        const deg=(val/totalOrders)*360;
        const color=makeChartColor(i);
        stops.push(`${color} ${start}deg ${start+deg}deg`);
        start+=deg;
      });
      productBox.innerHTML=`<div class="donut-summary"><div class="donut" style="background:conic-gradient(${stops.join(',')})"><div class="donut-center">${totalOrders}<span>pedidos</span></div></div><div class="legend-list">${products.map((p,i)=>`<div class="legend-item"><span class="legend-dot" style="background:${makeChartColor(i)}"></span><span class="legend-name">${safeText(p.product_name||'Producto')}</span><span class="legend-value">${Number(p.total_orders||0)}</span></div>`).join('')}</div></div>`;
    }
  }

  if(userBox){
    const users=(byUser||[]).slice(0,6);
    const max=Math.max(...users.map(u=>Number(u.total_sales||0)),0);
    if(!users.length || max<=0){
      userBox.innerHTML='<div class="empty-chart">Sin ventas por usuario hoy.</div>';
    }else{
      userBox.innerHTML=`<div class="bar-chart">${users.map((u,i)=>{const val=Number(u.total_sales||0);const pct=Math.max(4,(val/max)*100);return `<div class="bar-row"><div class="bar-label" title="${safeText(u.customer_email||u.customer_name||'Usuario')}">${safeText(u.customer_name||u.customer_email||'Usuario')}</div><div class="bar-track"><div class="bar-fill" style="width:${pct}%;background:linear-gradient(90deg,${makeChartColor(i)},#f00662)"></div></div><div class="bar-value">$${formatMoney(val)}</div></div>`}).join('')}</div>`;
    }
  }
}

// loadApp automático movido al final seguro


// ===============================
// FIX SEGURO: permisos de dashboard/admin y botones funcionales
// ===============================
function isAdminUserSafe(){ return currentUser && currentUser.role === 'admin' && !(currentUser.is_panel_admin === true || currentUser.is_panel_admin === 1 || currentUser.is_panel_admin === 'true'); }

function setHiddenSafe(id, hidden){
  const el=document.getElementById(id);
  if(el) el.classList.toggle('hidden', !!hidden);
}

function syncAdminVisibilitySafe(){
  const isAdmin=isAdminUserSafe();
  setHiddenSafe('adminMenuBtn', true);
  setHiddenSafe('adminSalesMenuBtn', true);
  setHiddenSafe('dashInventoryCard', !isAdmin);
  setHiddenSafe('dashAccountTraceCard', !isAdmin);
  setHiddenSafe('dashSalesTodayCard', !isAdmin);
  setHiddenSafe('dashboardChartsPanel', !isAdmin);
  setHiddenSafe('dashBalanceCard', isAdmin);
  
  if(!isAdmin){
    setHiddenSafe('section-admin', true);
  }else{
    const adminSection=document.getElementById('section-admin');
    if(adminSection) adminSection.classList.remove('hidden');
  }

  // CONTROL DE BARRA LATERAL Y BOTONES APP
  const sidebar = document.getElementById('sidebar');
  const esPanelPropietario =
  currentUser?.is_panel_admin === true ||
  currentUser?.is_panel_admin === 1 ||
  currentUser?.is_panel_admin === 'true' ||
  currentUser?.account_type === 'panel_propietario';

if (!isAdmin && !esPanelPropietario) {
  if (sidebar) sidebar.style.display = 'none';
  setHiddenSafe('panel-botones-vendedor', false);
} else {
  if (sidebar) sidebar.style.display = '';
  setHiddenSafe('panel-botones-vendedor', true);
}
    
    // DETECTOR UNIVERSAL DE DISTRIBUIDORES A PRUEBA DE BALAS
    const esDist = currentUser && (
      currentUser.is_subadmin === true || currentUser.is_subadmin === 1 || currentUser.is_subadmin === 'true' || 
      currentUser.is_panel_admin === true || currentUser.is_panel_admin === 1 || currentUser.is_panel_admin === 'true' ||
      currentUser.account_type === 'admin_distribuidor' || currentUser.account_type === 'distribuidor_del_panel' || currentUser.account_type === 'panel_propietario'
    );
    
    const btnUsr = document.getElementById('btn-dist-usuarios');
    const btnPre = document.getElementById('btn-dist-precios');
    const btnGan = document.getElementById('btn-dist-ganancias');
    if (btnUsr) btnUsr.classList.toggle('hidden', !esDist);
    if (btnPre) btnPre.classList.toggle('hidden', !esDist);
    if (btnGan) btnGan.classList.toggle('hidden', !esDist);

  
  // TRUCO A PRUEBA DE BALAS PARA FULMINAR LAS TARJETAS VIEJAS
  const tarjetasViejas = document.querySelectorAll('#section-dashboard .grid-cards');
  tarjetasViejas.forEach(contenedor => {
  if (!isAdmin && !esPanelPropietario) {
    contenedor.style.display = 'none';
  } else {
    contenedor.style.display = '';
  }
});
}
function setDashboardMenuActiveSafe(){
  document.querySelectorAll('.menu-btn').forEach(b=>b.classList.toggle('active', b.dataset.section==='dashboard'));
}

const __originalShowSectionStable = typeof showSection === 'function' ? showSection : null;
showSection = function(name){
  if(name==='admin' && !isAdminUserSafe()) name='dashboard';
  document.querySelectorAll('.section').forEach(s=>s.classList.remove('active'));
  const sec=document.getElementById('section-'+name);
  if(sec) sec.classList.add('active');
  document.querySelectorAll('.menu-btn').forEach(b=>b.classList.toggle('active', b.dataset.section===name));
  document.getElementById('sidebar')?.classList.remove('show');
  syncAdminVisibilitySafe();
  if(name==='shop' && typeof loadProducts==='function') loadProducts();
  if(name==='orders' && typeof loadMyOrders==='function') loadMyOrders();
  if(name==='reports') {
    setTimeout(()=>document.getElementById('reporteCorreo')?.focus(),80);
    if(typeof loadMyReports==='function') loadMyReports();
  }
  if(name==='admin' && isAdminUserSafe()){
    Promise.allSettled([
      typeof loadUsers==='function'?loadUsers():Promise.resolve(),
      typeof loadAdminProducts==='function'?loadAdminProducts():Promise.resolve(),
      typeof loadBalanceRequests==='function'?loadBalanceRequests():Promise.resolve(),
      typeof loadAccountReports==='function'?loadAccountReports():Promise.resolve(),
      typeof loadSalesReport==='function'?loadSalesReport(true):Promise.resolve()
    ]);
  }
};

function scrollToAdmin(id){
  if(!isAdminUserSafe()) return showSection('dashboard');
  showSection('admin');
  setTimeout(()=>{
    const el=document.getElementById(id);
    if(el) el.scrollIntoView({behavior:'smooth', block:'start'});
    if(id==='adminOrdersPanel' && typeof loadAdminOrders==='function') loadAdminOrders(1);
    if(id==='adminPlatformAccountsPanel' && typeof loadPlatformInventory==='function') loadPlatformInventory(1);
  },120);
}

function openUsersFromDashboard(){ isAdminUserSafe() ? scrollToAdmin('adminUsersPanel') : showSection('account'); }
function openProductsFromDashboard(){ isAdminUserSafe() ? scrollToAdmin('adminProductsPanel') : showSection('shop'); }
function openInventoryFromDashboard(){ isAdminUserSafe() ? scrollToAdmin('adminPlatformAccountsPanel') : showSection('shop'); }
function openInventoryTraceFromDashboard(){
  if (!isAdminUserSafe()) return showSection('shop');
  scrollToAdmin('adminPlatformAccountsPanel');
  setTimeout(()=>document.getElementById('traceEmailInput')?.focus(), 180);
}
function openOrdersFromDashboard(){ isAdminUserSafe() ? scrollToAdmin('adminOrdersPanel') : showSection('orders'); }
function openBalanceRequests(){ isAdminUserSafe() ? scrollToAdmin('adminBalanceRequestsPanel') : showSection('balance'); }
function openAccountReportsFromDashboard(){ isAdminUserSafe() ? scrollToAdmin('adminAccountReportsPanel') : showSection('reports'); }
function openSalesReport(){ if(isAdminUserSafe()) scrollToAdmin('adminSalesReportPanel'); }

const __baseLoadPlatformInventorySafe = typeof loadPlatformInventory === 'function' ? loadPlatformInventory : null;
if(__baseLoadPlatformInventorySafe){
  loadPlatformInventory = async function(page){
    await __baseLoadPlatformInventorySafe(page);
    const src=document.getElementById('adminPlatformAccountsCount');
    const dst=document.getElementById('statInventory');
    if(src && dst) dst.textContent = src.textContent || '0';
  };
}

loadApp = async function(){
  if(!token) return;
  try{
    currentUser = await api('/api/me');
  }catch(e){
    console.error('Sesión inválida', e);
    localStorage.removeItem('token'); token=null; currentUser=null;
    document.getElementById('authSection')?.classList.remove('hidden');
    document.getElementById('appSection')?.classList.add('hidden');
    return;
  }

  document.getElementById('authSection')?.classList.add('hidden');
  document.getElementById('appSection')?.classList.remove('hidden');
  const set=(id,val)=>{const el=document.getElementById(id); if(el) el.textContent=val;};
  set('userName', currentUser.name||'');
  set('userEmail', currentUser.email||'');
  set('userRole', currentUser.role||'user');
  set('userBalance', formatMoney(currentUser.balance));
  set('sideEmail', currentUser.email||'');
  set('topUserName', currentUser.name||'Usuario');
  set('statBalance', formatMoney(currentUser.balance));

  syncAdminVisibilitySafe();

  const panelAdminVisible = currentUser && (currentUser.is_panel_admin === true || currentUser.is_panel_admin === 1 || currentUser.is_panel_admin === 'true');
  const distributorVisibleFinal = panelAdminVisible || (currentUser && currentUser.role !== 'admin' && (currentUser.is_subadmin === true || currentUser.is_subadmin === 1 || currentUser.is_subadmin === 'true'));
  setHiddenSafe('distributorMenuBtn', !distributorVisibleFinal);
  setHiddenSafe('dashDistributorCard', !distributorVisibleFinal);
  setHiddenSafe('adminMenuBtn', true);
  setHiddenSafe('adminSalesMenuBtn', true);

  if(panelAdminVisible){
    const statUsersEl=document.getElementById('statUsers'); if(statUsersEl) statUsersEl.textContent='0';
    const statProductsEl=document.getElementById('statProducts'); if(statProductsEl) statProductsEl.textContent='0';
  }

  await Promise.allSettled([
    typeof loadProducts==='function'?loadProducts():Promise.resolve(),
    typeof loadMyOrders==='function'?loadMyOrders():Promise.resolve(),
    typeof loadBalanceRequests==='function'?loadBalanceRequests():Promise.resolve()
  ]);

  if(isAdminUserSafe()){
    if(typeof setTodaySalesDate==='function') setTodaySalesDate();
    await Promise.allSettled([
      typeof loadUsers==='function'?loadUsers():Promise.resolve(),
      typeof loadAdminProducts==='function'?loadAdminProducts():Promise.resolve(),
      typeof loadBalanceRequests==='function'?loadBalanceRequests():Promise.resolve(),
      typeof loadAccountReports==='function'?loadAccountReports():Promise.resolve(),
      typeof loadSalesReport==='function'?loadSalesReport(true):Promise.resolve(),
      typeof loadDailySummary==='function'?loadDailySummary():Promise.resolve(),
      typeof loadAdminActivity==='function'?loadAdminActivity():Promise.resolve()
    ]);
  }

  set('topUserBalance', formatMoney(currentUser.balance));
  if(typeof loadMyReports==='function') loadMyReports();

 if(currentUser.role === 'admin' || (currentUser.is_subadmin === true || currentUser.is_subadmin === 1 || currentUser.is_subadmin === 'true')) {
    showSection('dashboard');
  } else {
    // ESTO DEJA ENTRAR A LOS VENDEDORES AL PANEL CENTRAL
    document.querySelector('[data-section="dashboard"]')?.classList.remove('hidden');
    document.querySelector('[data-section="account"]')?.classList.add('hidden'); 
    showSection('dashboard');
  }
};



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
  syncCreateStockMode();
}

function toggleComboEditBox(id) {
  const isCombo = document.getElementById(`editProductType-${id}`)?.value === "combo_auto";
  const box = document.getElementById(`editComboBox-${id}`);
  if (box) box.classList.toggle("hidden", !isCombo);
  if (isCombo) {
    const product = (allProducts || []).find(p => Number(p.id) === Number(id));
    renderComboOptions(`editComboItemsBox-${id}`, parseJsonArray(product?.combo_items), `edit-${id}`, id);
  }
  syncEditStockMode(id);
}

function syncCreateStockMode() {
  const type = document.getElementById("productType")?.value || "streaming_auto";
  const stockInput = document.getElementById("productStock");
  if (!stockInput) return;

  const isManual = type === "manual";
  stockInput.disabled = !isManual;
  stockInput.min = isManual ? "-999999" : "0";
}

function syncEditStockMode(id) {
  const type = document.getElementById(`editProductType-${id}`)?.value || "streaming_auto";
  const stockInput = document.getElementById(`editStock-${id}`);
  if (!stockInput) return;

  const isManual = type === "manual";
  stockInput.disabled = !isManual;
  stockInput.min = isManual ? "-999999" : "0";
}

async function createProduct(){
  try{
    syncCreateStockMode();
    const currentType=document.getElementById('productType')?.value || 'streaming_auto';
    const stockValue=currentType==='manual' ? (productStock.value || 0) : 0;
    const data=await api('/api/admin/create-product',{
      method:'POST',
      body:JSON.stringify({
        name:productName.value,
        description:productDescription.value,
        price:productPrice.value || 0,
        cost_price:(document.getElementById('productCostPrice')?.value||0),
        category:productCategory.value,
        required_fields:getRequiredFieldsFromInput('productRequiredFields'),
        charge_mode:productChargeMode.value,
        stock_enabled:productStockEnabled.checked,
        stock:stockValue,
        product_type:currentType,
        combo_items:getSelectedComboItems('create'),
        combo_discount:document.getElementById('productComboDiscount')?.value || 0
      })
    });
    showMessage(data.message||'Producto creado');
    productName.value=productDescription.value=productPrice.value=productCategory.value=productRequiredFields.value='';
    if(document.getElementById('productCostPrice'))productCostPrice.value='0';
    if(document.getElementById('productType'))productType.value='streaming_auto';
    if(document.getElementById('productComboDiscount'))productComboDiscount.value='5';
    toggleComboCreateBox();
    productStock.value='0';
    productStockEnabled.checked=false;
    syncCreateStockMode();
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
    const se=Number(p.stock_enabled||0)===1;
    const type=String(p.product_type||'streaming_auto');
    const selectedCombo=parseJsonArray(p.combo_items);
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
        <label class="checkbox-row"><input type="checkbox" id="editStockEnabled-${p.id}" ${se?'checked':''}/> Activar stock</label><input id="editStock-${p.id}" type="number" min="${type==='manual' ? '-999999' : '0'}" value="${Number(p.stock||0)}" ${type==='manual' ? '' : 'disabled'} />
        <div class="three-row"><button onclick="updateProduct(${p.id})">Guardar</button><button class="danger-btn" onclick="deleteProduct(${p.id})">Eliminar</button><button class="muted-btn" onclick="toggleProduct(${p.id});showSection('shop')">Ver tienda</button></div>
      </div>
    </div>`
  }).join('')||'No hay productos.';
  products.forEach(p=>{
    if(String(p.product_type||'')==='combo_auto'){
      renderComboOptions(`editComboItemsBox-${p.id}`, parseJsonArray(p.combo_items), `edit-${p.id}`, p.id);
    }
    syncEditStockMode(p.id);
  });

  syncCreateStockMode();
}

async function updateProduct(id){
  try{
    syncEditStockMode(id);
    const required_fields=document.getElementById('editRequiredFields-'+id).value.split(',').map(normalizeFieldName).filter(Boolean);
    const currentType=document.getElementById(`editProductType-${id}`)?.value || 'streaming_auto';
    const stockValue=currentType==='manual'
      ? (document.getElementById('editStock-'+id).value || 0)
      : 0;
    const data=await api('/api/admin/products/'+id,{method:'PATCH',body:JSON.stringify({
      name:document.getElementById('editName-'+id).value,
      description:document.getElementById('editDescription-'+id).value,
      price:document.getElementById('editPrice-'+id).value,
      cost_price:(document.getElementById('editCostPrice-'+id)?.value||0),
      category:document.getElementById('editCategory-'+id).value,
      required_fields,
      charge_mode:document.getElementById('editChargeMode-'+id).value,
      stock_enabled:document.getElementById('editStockEnabled-'+id).checked,
      stock:stockValue,
      product_type:currentType,
      combo_items:getSelectedComboItems(`edit-${id}`),
      combo_discount:document.getElementById(`editComboDiscount-${id}`)?.value || 0
    })});
    showMessage(data.message||'Producto actualizado');
    await loadProducts();
    await loadAdminProducts();
  }catch(e){showMessage(e.message,'error')}
}


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

function toggleCreateProduct(){
  const box=document.getElementById('createProductBox');
  if(!box)return;
  box.classList.toggle('hidden');
  ensureComboCreateControls();
}

function hasAccountDelivery(order){
  const text=getAccountTextFromOrder(order);
  if(!text)return false;
  return /Cuenta de Streaming|Combo Streaming|Cuenta entregada|Correo:\s*|📧\s*Correo/i.test(text) && /Contraseña:\s*|🔐\s*Contraseña/i.test(text);
}

function getWarrantyInfoFromOrder(o){
  const raw=String(o.delivered_account_data||o.admin_response||'');
  const m=raw.match(/Fecha de entrega:\s*(\d{2})\/(\d{2})\/(\d{2,4})/i);
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
  const search=(document.getElementById('myOrdersSearch')?.value||'').toLowerCase().trim();
  const statusFilter=document.getElementById('myOrdersStatusFilter')?.value||'';
  let rows=[...(myOrders||[])];
  rows=rows.filter(o=>{
    const raw=String(o.delivered_account_data||o.admin_response||'');
    const email=extractDeliveredAccountEmail(raw);
    const hay=`${o.id} ${o.product_name||''} ${o.product_category||''} ${email} ${o.status||''}`.toLowerCase();
    const statusOk=!statusFilter || (statusFilter==='reportado' ? /reporte|falla|reemplazo|reembolso/i.test(raw+String(o.admin_response||'')) : o.status===statusFilter);
    return statusOk && (!search || hay.includes(search));
  });
  myOrdersList.innerHTML=rows.map(o=>{
    const data=parseJsonObject(o.order_data);
    const copyButton=hasAccountDelivery(o)?`<button class="copy-account-btn" onclick="copyAccountDataFromOrder(${o.id}, 'my')">📋 Copiar datos de cuenta</button>`:'';
    const reportButton=hasAccountDelivery(o)?`<button class="copy-account-btn danger-btn" onclick="reportDeliveredAccount(${o.id})">⚠ Reportar falla</button>`:'';
    return `<div class="item"><p><b>Pedido:</b> #${o.id}</p><p><b>Producto:</b> ${safeText(o.product_name)}</p><p><b>Monto:</b> $${formatMoney(o.amount)}</p><p><b>Estado:</b> <span class="status">${safeText(getStatusText(o.status))}</span></p>${renderWarrantyNotice(o)}${renderOrderData(data)}<p><b>Respuesta:</b></p><div class="response-text">${safeText(o.admin_response||'Sin respuesta todavía')}</div>${copyButton}${reportButton}</div>`;
  }).join('')||'No hay pedidos con esos filtros.';
}


// ===============================
// INDICADOR: PRODUCTOS SIN STOCK
// ===============================
function isProductOutOfStock(product){
  return Number(product?.stock_enabled || 0) === 1 && Number(product?.stock || 0) <= 0;
}

function getOutOfStockProducts(){
  return (allProducts || []).filter(isProductOutOfStock);
}

function updateOutOfStockStats(){
  const count = getOutOfStockProducts().length;
  const isAdmin = isAdminUserSafe();
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
  if(!isAdminUserSafe()) return showSection('shop');

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


loadApp();


// ===============================
// FIX REAL: Pedidos pendientes + Comunicados globales + Auto refresh
// ===============================
let __autoRefreshRunning = false;
let __autoRefreshTimer = null;
let __announcementTimer = null;

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

function renderAdminOrdersManualPendingOnly(){
  const box = document.getElementById('adminOrdersList');
  if(!box || !Array.isArray(adminOrders)) return;
  const rows = adminOrders.filter(isManualPendingOrder);
  const oldNotice = document.getElementById('manualPendingNotice');
  if(oldNotice) oldNotice.remove();
  const notice = document.createElement('div');
  notice.id = 'manualPendingNotice';
  notice.className = 'bank-box';
  notice.innerHTML = `<b>Mostrando pedidos pendientes manuales.</b> <button class="outline-btn" style="width:auto;margin-left:10px" onclick="loadAdminOrders()">Ver todos los pedidos</button>`;
  box.parentNode.insertBefore(notice, box);
  
  if(!rows.length){ box.innerHTML='No hay pedidos manuales pendientes.'; return; }
  
  box.innerHTML = rows.map(o=>{
    const od=parseJsonObject(o.order_data);
    
    // === NUEVO: SEPARAMOS LOS ARCHIVOS DEL TEXTO NORMAL ===
    const normalData = {};
    let fileDataHtml = '';

    for (let key in od) {
      // Detectamos si el dato es un archivo en Base64
      if (typeof od[key] === 'string' && od[key].startsWith('data:')) {
        const isPdf = od[key].startsWith('data:application/pdf');
        const label = isPdf ? '📄 Descargar PDF' : '🖼️ Descargar Imagen';
        const ext = isPdf ? '.pdf' : '.jpg';
        
        fileDataHtml += `<div style="margin: 8px 0; padding: 8px; border: 1px solid #e0e0e0; border-radius: 5px; background: #fafafa;">
          <p style="margin: 0 0 5px 0; font-size: 13px;"><b>Archivo de ${safeText(key)}:</b></p>
          <a href="${od[key]}" download="${key}_pedido_${o.id}${ext}" style="display: inline-block; padding: 6px 12px; background-color: #0288d1; color: white; border-radius: 4px; text-decoration: none; font-size: 13px; font-weight: bold;">${label}</a>
        </div>`;
      } else {
        // Si no es un archivo, lo guardamos para que se dibuje normal
        normalData[key] = od[key];
      }
    }
    // ======================================================

    const copyButton=hasAccountDelivery(o)?`<button class="copy-account-btn" onclick="copyAccountDataFromOrder(${o.id}, 'admin')">📋 Copiar datos de cuenta</button>`:'';
    
    return `<div class="item">
      <p><b>Pedido:</b> #${o.id}</p>
      <p><b>Cliente:</b> ${safeText(o.customer_name)}</p>
      <p><b>Correo:</b> ${safeText(o.customer_email)}</p>
      <p><b>Producto:</b> ${safeText(o.product_name)} <span class="chip">Manual</span></p>
      <p><b>Monto:</b> $${formatMoney(o.amount)}</p>
      <p><b>Estado actual:</b> <span class="status">${safeText(getStatusText(o.status))}</span></p>
      <p><b>Cobrado:</b> ${Number(o.charged||0)===1?'Sí':'No'}</p>
      
      ${renderOrderData(normalData)}
      ${fileDataHtml}
      
      <label class="field-label">Estado</label>
      <select id="status-${o.id}">
        <option value="accion_en_espera" ${o.status==='accion_en_espera'?'selected':''}>Acción en espera</option>
        <option value="en_proceso" ${o.status==='en_proceso'?'selected':''}>En proceso</option>
        <option value="exito" ${o.status==='exito'?'selected':''}>Éxito</option>
        <option value="rechazado" ${o.status==='rechazado'?'selected':''}>Rechazado</option>
      </select>
      <label class="field-label">Respuesta para el cliente</label>
      <textarea id="response-${o.id}">${safeText(o.admin_response||'')}</textarea>
      ${copyButton}
      <label class="checkbox-row"><input type="checkbox" id="refund-${o.id}" /> Devolver saldo si se rechaza</label>
      <button onclick="updateOrderStatus(${o.id})">Actualizar pedido</button>
    </div>`;
  }).join('');
}
function ensureAnnouncementsUI(){
  const topbar = document.querySelector('.topbar');
  if(topbar && !document.getElementById('announcementTicker')){
    const ticker = document.createElement('div');
    ticker.id = 'announcementTicker';
    ticker.className = 'announcement-ticker';
    ticker.innerHTML = `<div class="announcement-track"><div id="announcementMarquee" class="announcement-marquee"></div></div>`;
    topbar.insertAdjacentElement('afterend', ticker);
  }
  if(currentUser?.role === 'admin') ensureAnnouncementAdminPanel();
}

function ensureAnnouncementAdminPanel(){
  const admin = document.getElementById('section-admin');
  if(!admin || document.getElementById('adminAnnouncementsPanel')) return;
  const panel = document.createElement('div');
  panel.id = 'adminAnnouncementsPanel';
  panel.className = 'panel';
  panel.innerHTML = `
    <div class="panel-head"><div><h2>Comunicados globales</h2><p class="small-text">Estos avisos aparecen arriba del panel para todos los usuarios y administradores.</p></div><button class="outline-btn" style="width:auto" onclick="loadAdminAnnouncements()">Actualizar</button></div>
    <div class="row">
      <div>
        <label class="field-label">Nuevo comunicado</label>
        <textarea id="announcementText" placeholder="Ejemplo: Servicio de Disney con demoras, favor de avisar a tus clientes."></textarea>
        <button class="primary-btn" onclick="createAnnouncement()">Publicar comunicado</button>
      </div>
      <div>
        <h3>Comunicados publicados</h3>
        <div id="adminAnnouncementsList" class="announcement-admin-list">Sin comunicados.</div>
      </div>
    </div>`;
  const firstPanel = admin.querySelector('.panel');
  if(firstPanel) admin.insertBefore(panel, firstPanel); else admin.appendChild(panel);
}

async function loadAnnouncements(){
  try{
    ensureAnnouncementsUI();
    const list = await api('/api/announcements');
    const ticker = document.getElementById('announcementTicker');
    const marquee = document.getElementById('announcementMarquee');
    if(!ticker || !marquee) return;
    const html = Array.isArray(list) && list.length
      ? list.map(a=>`<span>${safeText(a.message || a.text || '')}</span>`).join('')
      : '';
    marquee.innerHTML = html;
    ticker.classList.add('show');
    ticker.style.display = 'flex';
  }catch(e){
    console.warn('No se pudieron cargar comunicados', e);
  }
}

async function loadAdminAnnouncements(){
  if(currentUser?.role !== 'admin') return;
  try{
    ensureAnnouncementsUI();
    const list = await api('/api/admin/announcements');
    const box = document.getElementById('adminAnnouncementsList');
    if(!box) return;
    box.innerHTML = Array.isArray(list) && list.length ? list.map(a=>`
      <div class="item">
        <p><b>#${a.id}</b> ${safeText(a.message)}</p>
        <p><b>Estado:</b> <span class="status">${Number(a.active)===1 || a.active===true?'Activo':'Oculto'}</span></p>
        <div class="two-row">
          <button class="outline-btn" onclick="toggleAnnouncement(${a.id}, ${Number(a.active)===1 || a.active===true ? 0 : 1})">${Number(a.active)===1 || a.active===true?'Ocultar':'Activar'}</button>
          <button class="danger-btn" onclick="deleteAnnouncement(${a.id})">Eliminar</button>
        </div>
      </div>`).join('') : 'Sin comunicados.';
  }catch(e){showMessage(e.message || 'Error cargando comunicados', 'error')}
}

async function createAnnouncement(){
  try{
    const text = (document.getElementById('announcementText')?.value || '').trim();
    if(!text) throw new Error('Escribe el comunicado');
    const data = await api('/api/admin/announcements', {method:'POST', body:JSON.stringify({message:text})});
    showMessage(data.message || 'Comunicado publicado');
    document.getElementById('announcementText').value='';
    await loadAnnouncements();
    await loadAdminAnnouncements();
  }catch(e){showMessage(e.message, 'error')}
}

async function toggleAnnouncement(id, active){
  try{
    const data = await api('/api/admin/announcements/'+id, {method:'PATCH', body:JSON.stringify({active})});
    showMessage(data.message || 'Comunicado actualizado');
    await loadAnnouncements();
    await loadAdminAnnouncements();
  }catch(e){showMessage(e.message, 'error')}
}

async function deleteAnnouncement(id){
  if(!confirm('¿Eliminar este comunicado?')) return;
  try{
    const data = await api('/api/admin/announcements/'+id, {method:'DELETE'});
    showMessage(data.message || 'Comunicado eliminado');
    await loadAnnouncements();
    await loadAdminAnnouncements();
  }catch(e){showMessage(e.message, 'error')}
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

const __originalShowSectionForAnnouncements = typeof showSection === 'function' ? showSection : null;
if(__originalShowSectionForAnnouncements){
  showSection = function(name){
    __originalShowSectionForAnnouncements(name);
    ensureManualPendingCard();
    ensureAnnouncementsUI();
    if(name === 'admin' && currentUser?.role === 'admin') loadAdminAnnouncements();
  }
}

async function autoRefreshPanel(){
  if(__autoRefreshRunning || !currentUser || document.hidden) return;
  __autoRefreshRunning = true;
  try{
    ensureManualPendingCard();
    ensureAnnouncementsUI();
    await loadAnnouncements();
    if(currentUser.role === 'admin'){
      await Promise.allSettled([
        typeof loadBalanceRequests==='function'?loadBalanceRequests():Promise.resolve(),
        typeof loadAccountReports==='function'?loadAccountReports():Promise.resolve(),
        typeof loadSalesReport==='function'?loadSalesReport(true):Promise.resolve(),
        typeof loadProducts==='function'?loadProducts():Promise.resolve(),
        typeof loadAdminAnnouncements==='function'?loadAdminAnnouncements():Promise.resolve()
      ]);
    }else{
      await Promise.allSettled([
        typeof loadMyOrders==='function'?loadMyOrders():Promise.resolve(),
        typeof loadBalanceRequests==='function'?loadBalanceRequests():Promise.resolve(),
        typeof loadProducts==='function'?loadProducts():Promise.resolve()
      ]);
    }
  }catch(e){
    console.warn('Error autoactualizando panel', e);
  }finally{
    __autoRefreshRunning = false;
  }
}

function startAutoRefreshPanel(){
  // Solo carga inicial. No hay refresco automático para no interrumpir compras o formularios.
  ensureManualPendingCard();
  ensureAnnouncementsUI();
  loadAnnouncements();
  if(currentUser?.role === 'admin') loadAdminAnnouncements();
  if(__autoRefreshTimer) clearInterval(__autoRefreshTimer);
  __autoRefreshTimer = null;
}

setTimeout(startAutoRefreshPanel, 1200);
// Auto-refresh por visibilidad desactivado. Las acciones del panel ya recargan su sección al guardar.
// document.addEventListener('visibilitychange', ()=>{ if(!document.hidden) autoRefreshPanel(); });



// ===============================
// FIX FINAL REAL: Comunicados visibles + listas compactas
// ===============================
function __isAdminUserFinal(){
  return currentUser && (currentUser.role === 'admin' || currentUser.role === 'super_admin') && !(currentUser.is_panel_admin === true || currentUser.is_panel_admin === 1 || currentUser.is_panel_admin === 'true');
}

function ensureCompactAndAnnouncementsStyles(){
  if(document.getElementById('finalPanelStyles')) return;
  const st=document.createElement('style');
  st.id='finalPanelStyles';
  st.textContent=`
    .compact-item{padding:0;overflow:hidden;background:#fff}
    .compact-header{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:15px 16px;cursor:pointer;background:#fbfdff;border-radius:18px}
    .compact-title{font-size:18px;font-weight:900;color:var(--primary)}
    .compact-meta{font-size:13px;color:var(--muted);font-weight:800;text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:65%}
    .compact-details{display:none;border-top:1px solid var(--border);padding:16px;background:#fff}
    .compact-item.open .compact-details{display:block}
    .compact-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:10px}
    .compact-actions button{width:auto;padding:10px 13px;border-radius:12px}
    .important-announcements-label{display:none;background:linear-gradient(90deg,#ef4444,#b91c1c);color:#fff;text-align:center;font-weight:900;letter-spacing:.8px;border-radius:16px;margin:0 0 8px;padding:10px 14px;box-shadow:var(--shadow);font-size:15px}
    .important-announcements-label.show{display:block}
    .global-announcement-ticker{background:linear-gradient(90deg,var(--primary),var(--primary2));color:#fff;border-radius:18px;margin:0 0 18px;overflow:hidden;box-shadow:var(--shadow);display:none;align-items:center;min-height:48px}
    .global-announcement-ticker.show{display:flex}
    .global-announcement-badge{background:rgba(255,255,255,.16);font-weight:900;padding:14px 18px;white-space:nowrap;border-right:1px solid rgba(255,255,255,.18)}
    .global-announcement-track{flex:1;overflow:hidden;white-space:nowrap}
    .global-announcement-marquee{display:inline-block;padding-left:100%;animation:globalAnnouncementScroll 24s linear infinite;font-weight:900}
    .global-announcement-marquee span{margin-right:45px}
    @keyframes globalAnnouncementScroll{0%{transform:translateX(0)}100%{transform:translateX(-100%)}}
    .announcement-mini{border:1px solid var(--border);border-radius:16px;padding:14px;margin-bottom:10px;background:#fbfdff}
    .announcement-mini p{margin:0 0 8px}
    @media(max-width:760px){.compact-header{align-items:flex-start}.compact-meta{max-width:52%;white-space:normal}.global-announcement-badge{padding:13px 12px}.global-announcement-marquee{animation-duration:18s}}
  `;
  document.head.appendChild(st);
}

function ensureGlobalAnnouncementsUIFinal(){
  ensureCompactAndAnnouncementsStyles();
  const topbar=document.querySelector('.topbar');
  if(topbar && !document.getElementById('importantAnnouncementsLabel')){
    const label=document.createElement('div');
    label.id='importantAnnouncementsLabel';
    label.className='important-announcements-label';
    label.textContent='ANUNCIOS IMPORTANTES';
    topbar.insertAdjacentElement('afterend', label);
  }
  const label=document.getElementById('importantAnnouncementsLabel');
  if(topbar && !document.getElementById('globalAnnouncementTicker')){
    const ticker=document.createElement('div');
    ticker.id='globalAnnouncementTicker';
    ticker.className='global-announcement-ticker';
    ticker.innerHTML=`<div class="global-announcement-track"><div id="globalAnnouncementMarquee" class="global-announcement-marquee"></div></div>`;
    (label || topbar).insertAdjacentElement('afterend', ticker);
  }

  if(__isAdminUserFinal()){
    const menu=document.querySelector('.menu');
    if(menu && !document.getElementById('announcementsMenuBtn')){
      const btn=document.createElement('button');
      btn.id='announcementsMenuBtn';
      btn.className='menu-btn';
      btn.dataset.section='admin';
      btn.type='button';
      btn.innerHTML='📢 Comunicados';
      btn.onclick=function(){ showSection('admin'); setTimeout(()=>document.getElementById('adminAnnouncementsPanel')?.scrollIntoView({behavior:'smooth',block:'start'}),120); };
      const adminBtn=document.getElementById('adminMenuBtn');
      if(adminBtn && adminBtn.parentNode===menu) adminBtn.insertAdjacentElement('afterend', btn); else menu.appendChild(btn);
    }

    const admin=document.getElementById('section-admin');
    if(admin && !document.getElementById('adminAnnouncementsPanel')){
      const panel=document.createElement('div');
      panel.id='adminAnnouncementsPanel';
      panel.className='panel';
      panel.innerHTML=`
        <div class="panel-head">
          <div><h2>Comunicados globales</h2><p class="small-text">Publica avisos para que aparezcan en una tira superior para todos los usuarios y administradores.</p></div>
          <button class="outline-btn" style="width:auto" onclick="loadAdminAnnouncementsFinal()">Actualizar</button>
        </div>
        <div class="row">
          <div>
            <label class="field-label">Nuevo comunicado</label>
            <textarea id="announcementTextFinal" placeholder="Ejemplo: Hoy Disney puede tardar de 5 a 10 minutos en entregar códigos."></textarea>
            <button class="primary-btn" onclick="createAnnouncementFinal()">Publicar comunicado</button>
          </div>
          <div>
            <h3>Comunicados publicados</h3>
            <div id="adminAnnouncementsListFinal">Sin comunicados.</div>
          </div>
        </div>`;
      const salesPanel=document.getElementById('adminSalesReportPanel');
      const firstPanel=admin.querySelector('.panel');
      if(salesPanel) admin.insertBefore(panel, salesPanel);
      else if(firstPanel) admin.insertBefore(panel, firstPanel);
      else admin.appendChild(panel);
    }
  }
}

async function loadGlobalAnnouncementsFinal(){
  try{
    ensureGlobalAnnouncementsUIFinal();
    const list=await api('/api/announcements');
    const ticker=document.getElementById('globalAnnouncementTicker');
    const marquee=document.getElementById('globalAnnouncementMarquee');
    const label=document.getElementById('importantAnnouncementsLabel');
    if(!ticker || !marquee) return;
    const active=(Array.isArray(list)?list:[]).filter(a=>String(a.message||'').trim());
    marquee.innerHTML=active.length ? active.map(a=>`<span>${safeText(a.message)}</span>`).join('') : '';
    ticker.classList.add('show');
    ticker.style.display='flex';
    if(label)label.classList.add('show');
  }catch(e){console.warn('No se pudieron cargar comunicados globales',e)}
}

async function loadAdminAnnouncementsFinal(){
  if(!__isAdminUserFinal()) return;
  try{
    ensureGlobalAnnouncementsUIFinal();
    const list=await api('/api/admin/announcements');
    const box=document.getElementById('adminAnnouncementsListFinal');
    if(!box) return;
    box.innerHTML=(Array.isArray(list)&&list.length)?list.map(a=>{
      const active=Number(a.active)===1 || a.active===true;
      return `<div class="announcement-mini">
        <p><b>#${a.id}</b> ${safeText(a.message)}</p>
        <p><b>Estado:</b> <span class="status">${active?'Activo':'Oculto'}</span></p>
        <div class="compact-actions">
          <button class="outline-btn" onclick="toggleAnnouncementFinal(${a.id}, ${active?0:1})">${active?'Ocultar':'Activar'}</button>
          <button class="danger-btn" onclick="deleteAnnouncementFinal(${a.id})">Eliminar</button>
        </div>
      </div>`;
    }).join(''):'Sin comunicados publicados.';
  }catch(e){showMessage(e.message||'Error cargando comunicados','error')}
}

async function createAnnouncementFinal(){
  try{
    const text=(document.getElementById('announcementTextFinal')?.value||'').trim();
    if(!text) throw new Error('Escribe el comunicado');
    const data=await api('/api/admin/announcements',{method:'POST',body:JSON.stringify({message:text})});
    showMessage(data.message||'Comunicado publicado');
    document.getElementById('announcementTextFinal').value='';
    await loadGlobalAnnouncementsFinal();
    await loadAdminAnnouncementsFinal();
  }catch(e){showMessage(e.message||'Error publicando comunicado','error')}
}

async function toggleAnnouncementFinal(id,active){
  try{
    const data=await api('/api/admin/announcements/'+id,{method:'PATCH',body:JSON.stringify({active})});
    showMessage(data.message||'Comunicado actualizado');
    await loadGlobalAnnouncementsFinal();
    await loadAdminAnnouncementsFinal();
  }catch(e){showMessage(e.message||'Error actualizando comunicado','error')}
}

async function deleteAnnouncementFinal(id){
  if(!confirm('¿Eliminar este comunicado?')) return;
  try{
    const data=await api('/api/admin/announcements/'+id,{method:'DELETE'});
    showMessage(data.message||'Comunicado eliminado');
    await loadGlobalAnnouncementsFinal();
    await loadAdminAnnouncementsFinal();
  }catch(e){showMessage(e.message||'Error eliminando comunicado','error')}
}

function toggleCompactItemFinal(id){
  document.getElementById(id)?.classList.toggle('open');
}

function renderAdminOrderCompactFinal(o){
  const od=parseJsonObject(o.order_data);
  const itemId=`admin-order-compact-${o.id}`;
  const copyButton=hasAccountDelivery(o)?`<button class="copy-account-btn" onclick="copyAccountDataFromOrder(${o.id}, 'admin')">📋 Copiar datos de cuenta</button>`:'';
  return `<div class="item compact-item" id="${itemId}">
    <div class="compact-header" onclick="toggleCompactItemFinal('${itemId}')">
      <div class="compact-title">Pedido #${o.id}</div>
      <div class="compact-meta">${safeText(o.customer_name||'Cliente')} · ${safeText(o.product_name||'Producto')} · ${safeText(getStatusText(o.status))}</div>
    </div>
    <div class="compact-details">
      <p><b>Pedido:</b> #${o.id}</p>
      <p><b>Cliente:</b> ${safeText(o.customer_name)}</p>
      <p><b>Correo:</b> ${safeText(o.customer_email)}</p>
      <p><b>Producto:</b> ${safeText(o.product_name)} ${String(o.product_type||'').toLowerCase()==='manual'?'<span class="chip">Manual</span>':''}</p>
      <p><b>Monto:</b> $${formatMoney(o.amount)}</p>
      <p><b>Estado actual:</b> <span class="status">${safeText(getStatusText(o.status))}</span></p>
      <p><b>Cobrado:</b> ${Number(o.charged||0)===1?'Sí':'No'}</p>
      ${typeof renderWarrantyNotice === 'function' ? renderWarrantyNotice(o) : ''}
      ${renderOrderData(od)}
      <label class="field-label">Estado</label>
      <select id="status-${o.id}"><option value="accion_en_espera" ${o.status==='accion_en_espera'?'selected':''}>Acción en espera</option><option value="en_proceso" ${o.status==='en_proceso'?'selected':''}>En proceso</option><option value="exito" ${o.status==='exito'?'selected':''}>Éxito</option><option value="rechazado" ${o.status==='rechazado'?'selected':''}>Rechazado</option></select>
      <label class="field-label">Respuesta para el cliente</label>
      <textarea id="response-${o.id}">${safeText(o.admin_response||'')}</textarea>
      ${copyButton}
      <label class="checkbox-row"><input type="checkbox" id="refund-${o.id}" /> Devolver saldo si se rechaza</label>
      <button onclick="updateOrderStatus(${o.id})">Actualizar pedido</button>
    </div>
  </div>`;
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
  const reportId = Number(r.report_id || r.id || 0);
  const reportStatus = String(r.report_status || r.status || 'pendiente').toLowerCase();
  const reportEmail = r.email || r.reported_mother_email || '';
  const reportProduct = r.product_name || r.account_product_name || r.reported_platform || r.platform || '';
  const reportProfile = r.profile_name || r.affected_profile || 'No aplica';
  const reportPin = r.profile_pin || 'No aplica';
  const reportDate = r.report_created_at || r.created_at || r.order_created_at || null;
  const info=calculateReportRefundInfo({ ...r, id: reportId, status: reportStatus });
  const canAct=reportStatus==='pendiente';
  const itemId=`admin-report-compact-${reportId}`;
  return `<div class="item compact-item" id="${itemId}">
    <div class="compact-header" onclick="toggleCompactItemFinal('${itemId}')">
      <div class="compact-title">Reporte #${reportId}</div>
      <div class="compact-meta">${safeText(r.vendedor_name||r.customer_name||'Vendedor')} · ${safeText(reportEmail||'correo reportado')} · ${safeText(reportStatus||'pendiente')}</div>
    </div>
    <div class="compact-details">
      <p><b>Reporte:</b> #${reportId} <span class="status">${safeText(reportStatus||'pendiente')}</span></p>
      <p><b>Vendedor:</b> ${safeText(r.vendedor_name||r.customer_name||'Vendedor')} <span class="small-text">${safeText(r.customer_email||'')}</span></p>
      <p><b>Correo reportado:</b> ${safeText(reportEmail)}</p>
      <p><b>Producto:</b> ${safeText(reportProduct)} ${r.platform?`<span class="chip">${safeText(r.platform)}</span>`:''}</p>
      <p><b>Perfil:</b> ${safeText(reportProfile)} &nbsp; <b>PIN:</b> ${safeText(reportPin)}</p>
      <p><b>Fecha:</b> ${safeText(reportDate ? new Date(reportDate).toLocaleString() : '')}</p>
      <p><b>Falla:</b> ${safeText(r.issue_type||'otro')}</p>
      <p><b>Explicación:</b> ${safeText(r.description||'')}</p>
      ${r.evidence_image ? `<div class="order-proof-row"><p style="margin:5px 0"><b>Evidencia adjunta:</b></p>${renderAttachmentButtons(r.evidence_image)}<div class="proof-preview"><img src="${safeText(r.evidence_image)}" alt="Evidencia"></div></div>` : ''}
<p><b>Monto:</b> $${formatMoney(r.order_amount)} &nbsp; <b>Días usados:</b> ${info.daysUsed} &nbsp; <b>Días restantes:</b> ${info.daysRemaining} &nbsp; <b>Reembolso sugerido:</b> $${formatMoney(info.refund)}</p>
      ${r.admin_response?`<div class="order-data response-text"><b>Respuesta admin:</b><br>${safeText(r.admin_response)}</div>`:''}
      <div class="two-row">
        <button class="green-btn" onclick="replaceReportedAccount(${reportId})" ${canAct?'':'disabled'}>🔁 Reemplazar cuenta</button>
        <button class="danger-btn" data-id="${reportId}" onclick="refundReportedAccount(${reportId}, '${r.order_created_at}')" ${canAct?'':'disabled'}>💰 Reembolso Parcial</button>
      </div>
      <div class="two-row" style="margin-top:10px">
        <button class="danger-btn" data-id="${reportId}" onclick="refundOrderByType(${Number(r.order_id||0)}, 'completo')" ${canAct?'':'disabled'}>🛑 Reembolso Completo</button>
        <button class="outline-btn" data-id="${reportId}" onclick="loadAccountReports()">Actualizar</button>
      </div>
      <div class="two-row" style="margin-top:10px">
        <select id="reportStatus-${reportId}"><option value="pendiente" ${reportStatus==='pendiente'?'selected':''}>Pendiente</option><option value="resuelto" ${reportStatus==='resuelto'?'selected':''}>Resuelto</option><option value="reemplazo" ${reportStatus==='reemplazo'?'selected':''}>Reemplazo</option><option value="reembolso" ${reportStatus==='reembolso'?'selected':''}>Reembolso</option></select>
        <input id="reportResponse-${reportId}" placeholder="Respuesta para el cliente" value="${safeText(r.admin_response||'')}" />
      </div>
      <button class="outline-btn" style="width:auto" onclick="updateAccountReportStatus(${reportId})">Guardar veredicto</button>
    </div>
  </div>`;
}

   

async function loadAccountReports() {
  if (!__isAdminUserFinal()) return;

  try {
    const reports = await api('/api/admin/account-reports');
    const rows = Array.isArray(reports) ? reports : [];
    const pending = rows.filter(r => String(r.report_status || r.status || '').toLowerCase() === 'pendiente');
    
    const stat = document.getElementById('statReports');
    if (stat) stat.textContent = pending.length;
    
    const box = document.getElementById('adminAccountReportsList');
    if (box) {
      box.innerHTML = '';
      box.innerHTML = rows.length ? rows.map(renderAdminReportCompactFinal).join('') : 'Sin reportes de falla.';
    }

    const refreshBtn = document.querySelector('#adminAccountReportsPanel .panel-head .outline-btn');
    if (refreshBtn) {
      refreshBtn.onclick = function(){ loadAccountReports(); };
    }
  } catch (e) {
    console.warn('Error cargando reportes:', e);
  }
}

function refundOrderByType(orderId, refundType){
  const id = Number(orderId || 0);
  const type = String(refundType || '').toLowerCase();
  if(!id){
    showMessage('ID de pedido inválido para reembolso.', 'error');
    return;
  }
  if(type !== 'completo'){
    showMessage('Tipo de reembolso no válido.', 'error');
    return;
  }
  showMessage(`Reembolso completo preparado para validación. Pedido #${id}.`);
}

// Inicialización limpia de comunicados
setTimeout(() => {
  if (typeof ensureGlobalAnnouncementsUIFinal === 'function') ensureGlobalAnnouncementsUIFinal();
  if (typeof loadGlobalAnnouncementsFinal === 'function') loadGlobalAnnouncementsFinal();
  if (typeof __isAdminUserFinal === 'function' && __isAdminUserFinal()) {
    if (typeof loadAdminAnnouncementsFinal === 'function') loadAdminAnnouncementsFinal();
  }
}, 800);

// ===============================
// FIX: Comunicados como opción directa del menú lateral
// ===============================
function ensureGlobalAnnouncementsUIFinal(){
  ensureCompactAndAnnouncementsStyles();

  const topbar=document.querySelector('.topbar');
  if(topbar && !document.getElementById('importantAnnouncementsLabel')){
    const label=document.createElement('div');
    label.id='importantAnnouncementsLabel';
    label.className='important-announcements-label';
    label.textContent='ANUNCIOS IMPORTANTES';
    topbar.insertAdjacentElement('afterend', label);
  }
  const label=document.getElementById('importantAnnouncementsLabel');
  if(topbar && !document.getElementById('globalAnnouncementTicker')){
    const ticker=document.createElement('div');
    ticker.id='globalAnnouncementTicker';
    ticker.className='global-announcement-ticker';
    ticker.innerHTML=`<div class="global-announcement-track"><div id="globalAnnouncementMarquee" class="global-announcement-marquee"></div></div>`;
    (label || topbar).insertAdjacentElement('afterend', ticker);
  }

  const menu=document.querySelector('.menu');
  if(menu && !document.getElementById('announcementsMenuBtn')){
    const btn=document.createElement('button');
    btn.id='announcementsMenuBtn';
    btn.className='menu-btn';
    btn.dataset.section='comunicados';
    btn.type='button';
    btn.innerHTML='📢 Comunicados';
    btn.onclick=function(){ showSection('comunicados'); loadComunicadosSectionFinal(); };

    const reportsBtn=document.querySelector('[data-section="reports"]');
    if(reportsBtn && reportsBtn.parentNode===menu){
      reportsBtn.insertAdjacentElement('afterend', btn);
    }else{
      menu.appendChild(btn);
    }
  }

  const main=document.querySelector('.main');
  if(main && !document.getElementById('section-comunicados')){
    const section=document.createElement('section');
    section.id='section-comunicados';
    section.className='section';
    section.innerHTML=`
      <h1 class="section-title">Comunicados</h1>
      <div class="panel">
        <div class="panel-head">
          <div>
            <h2>Comunicados globales</h2>
            <p class="small-text">Avisos importantes visibles para todos los usuarios del panel.</p>
          </div>
          <button class="outline-btn" style="width:auto" onclick="loadComunicadosSectionFinal()">Actualizar</button>
        </div>
        <div id="announcementsCreateBoxFinal" class="hidden">
          <label class="field-label">Nuevo comunicado</label>
          <textarea id="announcementTextFinal" placeholder="Ejemplo: Hoy Disney puede tardar de 5 a 10 minutos en entregar códigos."></textarea>
          <button class="primary-btn" onclick="createAnnouncementFinal()">Publicar comunicado</button>
          <hr class="divider">
        </div>
        <div id="adminAnnouncementsListFinal">Cargando comunicados...</div>
      </div>`;
    main.appendChild(section);
  }

  const oldAdminPanel=document.getElementById('adminAnnouncementsPanel');
  if(oldAdminPanel) oldAdminPanel.remove();
}

async function loadAdminAnnouncementsFinal(){
  await loadComunicadosSectionFinal();
}

async function loadComunicadosSectionFinal(){
  try{
    ensureGlobalAnnouncementsUIFinal();
    const isAdmin=__isAdminUserFinal();
    const createBox=document.getElementById('announcementsCreateBoxFinal');
    if(createBox) createBox.classList.toggle('hidden', !isAdmin);

    const endpoint=isAdmin?'/api/admin/announcements':'/api/announcements';
    const list=await api(endpoint);
    const box=document.getElementById('adminAnnouncementsListFinal');
    if(!box) return;

    if(!Array.isArray(list) || !list.length){
      box.innerHTML='Sin comunicados publicados.';
      return;
    }

    box.innerHTML=list.map(a=>{
      const active=Number(a.active)===1 || a.active===true;
      if(isAdmin){
        return `<div class="announcement-mini">
          <p><b>#${a.id}</b> ${safeText(a.message)}</p>
          <p><b>Estado:</b> <span class="status">${active?'Activo':'Oculto'}</span></p>
          <div class="compact-actions">
            <button class="outline-btn" onclick="toggleAnnouncementFinal(${a.id}, ${active?0:1})">${active?'Ocultar':'Activar'}</button>
            <button class="danger-btn" onclick="deleteAnnouncementFinal(${a.id})">Eliminar</button>
          </div>
        </div>`;
      }
      return `<div class="announcement-mini"><p>${safeText(a.message)}</p></div>`;
    }).join('');
  }catch(e){
    const box=document.getElementById('adminAnnouncementsListFinal');
    if(box) box.innerHTML='No se pudieron cargar los comunicados.';
    console.warn('Error cargando comunicados',e);
  }
}

const __showSectionBeforeComunicadosMenuFix=typeof showSection==='function'?showSection:null;
if(__showSectionBeforeComunicadosMenuFix){
  showSection=function(name){
    __showSectionBeforeComunicadosMenuFix(name);
    if(name==='comunicados'){
      setTimeout(()=>loadComunicadosSectionFinal(),80);
    }
  }
}

setTimeout(()=>{ensureGlobalAnnouncementsUIFinal();loadGlobalAnnouncementsFinal();},400);


// ===============================
// FIX DEFINITIVO: mantener visible la tira de Comunicados
// ===============================
(function(){
  function keepAnnouncementTickerVisible(){
    const old=document.getElementById('announcementTicker');
    if(old){
      old.classList.add('show');
      old.style.display='flex';
      old.style.height='auto';
      old.style.minHeight='48px';
      old.style.margin='0 0 18px';
      old.style.padding='0';
      old.style.overflow='hidden';
      old.style.boxShadow='var(--shadow)';
    }
  }

  const originalEnsureGlobalAnnouncementsUIFinal = typeof ensureGlobalAnnouncementsUIFinal === 'function' ? ensureGlobalAnnouncementsUIFinal : null;
  const originalLoadGlobalAnnouncementsFinal = typeof loadGlobalAnnouncementsFinal === 'function' ? loadGlobalAnnouncementsFinal : null;

  // Reemplaza la función vieja que creaba/ocultaba #announcementTicker.
  ensureAnnouncementsUI = function(){
    keepAnnouncementTickerVisible();
    if(originalEnsureGlobalAnnouncementsUIFinal) originalEnsureGlobalAnnouncementsUIFinal();
    keepAnnouncementTickerVisible();
  };

  // Auto-refresh viejo llama loadAnnouncements(); lo mantenemos visible.
  loadAnnouncements = async function(){
    keepAnnouncementTickerVisible();
    if(originalLoadGlobalAnnouncementsFinal) await originalLoadGlobalAnnouncementsFinal();
    keepAnnouncementTickerVisible();
  };

  // Refuerza la función nueva para dejar visible la tira antes/después.
  if(originalEnsureGlobalAnnouncementsUIFinal){
    ensureGlobalAnnouncementsUIFinal = function(){
      keepAnnouncementTickerVisible();
      originalEnsureGlobalAnnouncementsUIFinal();
      keepAnnouncementTickerVisible();
    };
  }

  if(originalLoadGlobalAnnouncementsFinal){
    loadGlobalAnnouncementsFinal = async function(){
      keepAnnouncementTickerVisible();
      await originalLoadGlobalAnnouncementsFinal();
      keepAnnouncementTickerVisible();
    };
  }

  setTimeout(keepAnnouncementTickerVisible, 50);
  setTimeout(keepAnnouncementTickerVisible, 500);
  setTimeout(keepAnnouncementTickerVisible, 1500);
})();


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
      <div class="compact-meta">${safeText(o.customer_name||'Cliente')} · ${safeText(o.product_name||'Producto')} · ${safeText(getStatusText(o.status))}</div>
    </div>
    <div class="compact-details">
      <p><b>Pedido:</b> #${o.id}</p>
      <p><b>Cliente:</b> ${safeText(o.customer_name)}</p>
      <p><b>Correo:</b> ${safeText(o.customer_email)}</p>
      <p><b>Producto:</b> ${safeText(o.product_name)} ${manualChip}</p>
      <p><b>Monto:</b> $${formatMoney(o.amount)}</p>
      <p><b>Estado actual:</b> <span class="status">${safeText(getStatusText(o.status))}</span></p>
      <p><b>Cobrado:</b> ${Number(o.charged||0)===1?'Sí':'No'}</p>
      ${typeof renderWarrantyNotice === 'function' ? renderWarrantyNotice(o) : ''}
      ${renderOrderData(od)}
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
    await loadAdminOrders();
    await loadMyOrders();
    await loadUsers();
    await loadPlatformInventory();
    await loadSalesReport();
  }catch(e){showMessage(e.message||'Error actualizando pedido','error')}
}


// ===============================
// FIX FINAL: Comunicados solo para admin principal + menú Reportar con respuestas
// ===============================
function isMainAdminOnlyFinal(){
  return currentUser && String(currentUser.role || '').toLowerCase() === 'admin' && !(currentUser.is_panel_admin === true || currentUser.is_panel_admin === 1 || currentUser.is_panel_admin === 'true');
}

function applyComunicadosVisibilityFinal(){
  const btn=document.getElementById('announcementsMenuBtn');
  const section=document.getElementById('section-comunicados');
  if(!isMainAdminOnlyFinal()){
    if(btn) btn.remove();
    if(section) section.classList.add('hidden');
    return;
  }
  if(section) section.classList.remove('hidden');
}

(function(){
  const previousEnsure=typeof ensureGlobalAnnouncementsUIFinal==='function'?ensureGlobalAnnouncementsUIFinal:null;
  if(previousEnsure){
    ensureGlobalAnnouncementsUIFinal=function(){
      previousEnsure();
      applyComunicadosVisibilityFinal();
    };
  }
})();

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

async function openReportFaultFormFinal(){
  const box=document.getElementById('myReportsList');
  if(box) box.innerHTML='';
  showSection('reports');
  if(box) box.innerHTML='Cargando reportes...';
  try{
    await loadMyReports();
  }catch(error){
    console.error(error);
    if(box) box.innerHTML='No se pudieron cargar los reportes.';
  }
}

function openFailureResponsesFinal(){
  showSection('failure-responses');
  loadMyFailureResponsesFinal();
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

async function loadMyFailureResponsesFinal(){
  const box=document.getElementById('myFailureResponsesList');
  if(!box) return;
  try{
    const reports=await api('/api/my-account-reports');
    if(!Array.isArray(reports) || !reports.length){
      box.innerHTML='Todavía no tienes reportes de falla.';
      return;
    }
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
          <div class="order-data response-text"><b>Respuesta del admin:</b><br>${safeText(r.admin_response||'Aún no hay respuesta del admin.')}</div>
        </div>
      </div>`).join('');
  }catch(e){
    box.innerHTML='No se pudieron cargar tus respuestas de fallos.';
    console.warn('Error cargando respuestas de fallos', e);
  }
}

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

  const previousShow=typeof showSection==='function'?showSection:null;
  if(previousShow){
    showSection=function(name){
      ensureReportMenuFinal();
      applyComunicadosVisibilityFinal();
      previousShow(name);
      if(name==='failure-responses') setTimeout(()=>loadMyFailureResponsesFinal(),80);
      setTimeout(()=>applyComunicadosVisibilityFinal(),120);
    };
  }

  setTimeout(()=>{ensureReportMenuFinal();applyComunicadosVisibilityFinal();},300);
  setTimeout(()=>{ensureReportMenuFinal();applyComunicadosVisibilityFinal();},1200);
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

    window.__adminPanelsPhase1Cache=panels;
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
  const previousShowPhase1=typeof showSection==='function'?showSection:null;
  if(previousShowPhase1){
    showSection=function(name){
      previousShowPhase1(name);
      if(name==='admin' && isAdminUserSafe()){
        setTimeout(()=>{ensureAdminPanelsPhase1UI();loadAdminPanelsPhase1();},120);
      }
    };
  }

  setTimeout(()=>{
    if(isAdminUserSafe()){
      ensureAdminPanelsPhase1UI();
      if(document.getElementById('section-admin')?.classList.contains('active')) loadAdminPanelsPhase1();
    }
  },1000);
})();


// ===============================
// FASE 2 INICIO: Panel admin rentado con productos, inventario, banco y comunicados propios
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

  // Comunicados: el admin principal y cada panel rentado pueden manejar sus propios avisos.
  const commBtn=document.getElementById('announcementsMenuBtn');
  const commSection=document.getElementById('section-comunicados');
  if(isAnyAdminUserPanel()){
    if(commBtn) hideElementHard(commBtn, false);
    if(commSection) hideElementHard(commSection, false);
  }else{
    if(commBtn) hideElementHard(commBtn, true);
  }
}

const __showSectionBeforeRentedAdmin = typeof showSection === 'function' ? showSection : null;
showSection = function(name){
  if(name === 'admin' && !isAnyAdminUserPanel()) name = 'dashboard';

  document.querySelectorAll('.section').forEach(s=>s.classList.remove('active'));
  const sec=document.getElementById('section-'+name);
  if(sec) sec.classList.add('active');
  document.querySelectorAll('.menu-btn').forEach(b=>b.classList.toggle('active', b.dataset.section===name));
  document.getElementById('sidebar')?.classList.remove('show');

  applyRentedAdminLayout();

  if(name==='shop' && typeof loadProducts==='function') loadProducts();
  if(name==='orders' && typeof loadMyOrders==='function') loadMyOrders();
  if(name==='balance' && typeof loadBankInfoForPanel==='function') loadBankInfoForPanel();
  if(name==='comunicados' && typeof loadComunicadosSectionFinal==='function') loadComunicadosSectionFinal();

  if(name==='admin' && isAnyAdminUserPanel()){
    Promise.allSettled([
      !isPanelAdminRented() && typeof loadUsers==='function' ? loadUsers() : Promise.resolve(),
      typeof loadAdminProducts==='function' ? loadAdminProducts() : Promise.resolve(),
      !isPanelAdminRented() && typeof loadBalanceRequests==='function' ? loadBalanceRequests() : Promise.resolve(),
      !isPanelAdminRented() && typeof loadAccountReports==='function' ? loadAccountReports() : Promise.resolve(),
      !isPanelAdminRented() && typeof loadSalesReport==='function' ? loadSalesReport(true) : Promise.resolve()
    ]).then(()=>applyRentedAdminLayout());
  }
};

function scrollToAdmin(id){
  if(!isAnyAdminUserPanel()) return showSection('dashboard');
  showSection('admin');
  setTimeout(()=>{
    applyRentedAdminLayout();
    const el=document.getElementById(id);
    if(el) el.scrollIntoView({behavior:'smooth', block:'start'});
    if(id==='adminOrdersPanel' && typeof loadAdminOrders==='function') loadAdminOrders(1);
    if(id==='adminPlatformAccountsPanel' && typeof loadPlatformInventory==='function') loadPlatformInventory(1);
  },160);
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

const __loadAppBeforeRentedAdmin = typeof loadApp === 'function' ? loadApp : null;
if(__loadAppBeforeRentedAdmin){
  loadApp = async function(){
    await __loadAppBeforeRentedAdmin();
    await loadBankInfoForPanel();
    applyRentedAdminLayout();
    if(isPanelAdminRented()){
      const statUsersEl=document.getElementById('statUsers'); if(statUsersEl) statUsersEl.textContent='0';
      await Promise.allSettled([
        typeof loadDistributorPanel==='function'?loadDistributorPanel():Promise.resolve(),
        typeof loadProducts==='function'?loadProducts():Promise.resolve()
      ]);
      applyRentedAdminLayout();
    }
  };
}

setTimeout(()=>{loadBankInfoForPanel();applyRentedAdminLayout();},800);
setTimeout(()=>applyRentedAdminLayout(),1800);


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
  setTimeout(()=>{
    ensureAdvancedReportsPanelFinal();
    const el=document.getElementById('adminSalesReportPanel');
    if(el) el.scrollIntoView({behavior:'smooth', block:'start'});
    loadSalesReport(true).then(syncPanelAdminDashboardValuesFinal).catch(()=>{});
  },140);
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
    const users=await api('/api/admin/users');
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
async function loadUserHistoryFinal(){
  try{
    const userId=document.getElementById('historyUserSelectFinal')?.value || '';
    const start=document.getElementById('historyStartDateFinal')?.value || '';
    const end=document.getElementById('historyEndDateFinal')?.value || '';
    const qs=new URLSearchParams({user_id:userId});
    if(start && end){ qs.set('start_date',start); qs.set('end_date',end); }
    const data=await api('/api/admin/user-history?'+qs.toString());
    renderRecordsTableFinal('orders', data.records||[]);
  }catch(e){ showMessage(e.message||'Error cargando historial','error'); }
}
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
const __loadAppBeforeReportsFinal = typeof loadApp === 'function' ? loadApp : null;

if (__loadAppBeforeReportsFinal) {

  loadApp = async function () {
    await __loadAppBeforeReportsFinal();

    console.log('ROLE:', currentUser?.role);
    console.log('IS_PANEL_ADMIN:', currentUser?.is_panel_admin);
    console.log('IS_RENTED:', isPanelAdminRented());
    console.log('IS_MAIN_ADMIN:', isMainAdminPrincipal());
    console.log('CURRENT_USER:', currentUser);

    if (isAdminAnyFinal()) {
      ensurePanelAdminDashboardCardsFinal();
      ensureAdvancedReportsPanelFinal();

      await Promise.allSettled([
        loadSalesReport(true),
        loadHistoryUsersFinal()
      ]);

      if (typeof applyRentedAdminLayout === 'function')
        applyRentedAdminLayout();

      syncPanelAdminDashboardValuesFinal();
    }
  };

}

setTimeout(() => {
  if (isAdminAnyFinal()) {
    ensurePanelAdminDashboardCardsFinal();
    ensureAdvancedReportsPanelFinal();
    loadSalesReport(true).catch(() => {});
  }
}, 1200);

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
        setTimeout(()=>{
          if(typeof loadAdminPanelsPhase1 === 'function') loadAdminPanelsPhase1();
          const panel=document.getElementById('adminPanelsPanelPhase1');
          if(panel) panel.scrollIntoView({behavior:'smooth', block:'start'});
        },180);
      };
      grid.appendChild(card);
    }
    card.classList.remove('hidden');
    card.style.display='';
    updateAdminPanelsCountFinal();
  }

  async function updateAdminPanelsCountFinal(){
    if(!isMainGlobalAdminFinal()) return;
    const el=document.getElementById('statAdminPanelsMainFinal');
    try{
      const panels=await api('/api/admin/admin-panels');
      if(el) el.textContent = Array.isArray(panels) ? panels.length : 0;
      const old=document.getElementById('adminPanelsCountPhase1');
      if(old) old.textContent = Array.isArray(panels) ? panels.length : 0;
    }catch(e){
      if(el && !el.textContent) el.textContent='0';
      console.warn('No se pudo contar paneles admin', e);
    }
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

  const prevShowSection = typeof showSection === 'function' ? showSection : null;
  if(prevShowSection){
    showSection = function(name){
      const result = prevShowSection(name);
      setTimeout(applyDashboardFinalAdjustments,120);
      return result;
    };
  }

  const prevLoadApp = typeof loadApp === 'function' ? loadApp : null;
  if(prevLoadApp){
    loadApp = async function(){
      const result = await prevLoadApp();
      applyDashboardFinalAdjustments();
      // Mantener cerrado el resumen hasta que el usuario toque Ventas hoy.
      salesDetailsExpandedFinal = false;
      setSalesDetailCardsFinal(false);
      setTimeout(applyDashboardFinalAdjustments,400);
      setTimeout(applyDashboardFinalAdjustments,1200);
      setTimeout(applyDashboardFinalAdjustments,2500);
      return result;
    };
  }

  window.toggleSalesTodayDetailsFinal = function(){
    salesDetailsExpandedFinal = !salesDetailsExpandedFinal;
    setSalesDetailCardsFinal(salesDetailsExpandedFinal);
  };

  setTimeout(applyDashboardFinalAdjustments,500);
  setTimeout(applyDashboardFinalAdjustments,1500);
  setTimeout(applyDashboardFinalAdjustments,3000);
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

      setTimeout(() => {
        const target = document.getElementById('adminSalesReportPanel');
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 160);
    } catch(e) {
      console.error('Error abriendo Ventas hoy', e);
    }

    setTimeout(hideDashboardSalesExtraCards, 250);
    setTimeout(hideDashboardSalesExtraCards, 900);
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

  const prevOpenSalesReportFixed = typeof openSalesReport === 'function' ? openSalesReport : null;
  openSalesReport = goToSalesReportSamePage;
  window.openSalesReport = goToSalesReportSamePage;

  const prevOpenSalesReportFinalFixed = typeof openSalesReportFinal === 'function' ? openSalesReportFinal : null;
  openSalesReportFinal = goToSalesReportSamePage;
  window.openSalesReportFinal = goToSalesReportSamePage;

  const prevLoadAppVentasFix = typeof loadApp === 'function' ? loadApp : null;
  if (prevLoadAppVentasFix) {
    loadApp = async function(){
      const result = await prevLoadAppVentasFix();
      bindVentasHoyButton();
      setTimeout(bindVentasHoyButton, 500);
      setTimeout(bindVentasHoyButton, 1500);
      setTimeout(bindVentasHoyButton, 3000);
      return result;
    };
  }

  const prevShowSectionVentasFix = typeof showSection === 'function' ? showSection : null;
  if (prevShowSectionVentasFix) {
    showSection = function(name){
      const result = prevShowSectionVentasFix(name);
      setTimeout(bindVentasHoyButton, 180);
      return result;
    };
  }

  const prevLoadSalesReportVentasFix = typeof loadSalesReport === 'function' ? loadSalesReport : null;
  if (prevLoadSalesReportVentasFix) {
    loadSalesReport = async function(forceToday=false){
      const result = await prevLoadSalesReportVentasFix(forceToday);
      hideDashboardSalesExtraCards();
      bindVentasHoyButton();
      return result;
    };
  }

  setTimeout(bindVentasHoyButton, 300);
  setTimeout(bindVentasHoyButton, 1200);
  setTimeout(bindVentasHoyButton, 2500);
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

  const oldLoadAppRoleLabels = typeof loadApp === 'function' ? loadApp : null;
  if (oldLoadAppRoleLabels) {
    loadApp = async function(){
      const result = await oldLoadAppRoleLabels();
      applyRoleLabels();
      setTimeout(applyRoleLabels, 400);
      setTimeout(applyRoleLabels, 1200);
      return result;
    };
  }

  const oldLoadUsersRoleLabels = typeof loadUsers === 'function' ? loadUsers : null;
  if (oldLoadUsersRoleLabels) {
    loadUsers = async function(){
      const result = await oldLoadUsersRoleLabels();
      applyRoleLabels();
      return result;
    };
  }

  setTimeout(applyRoleLabels, 500);
  setTimeout(applyRoleLabels, 1500);
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
  function actionForUser(u){
    const isPanelOwner = isTrue(u.is_panel_admin) || u.account_type === 'panel_propietario';
    if (isPanelOwner || u.role === 'admin') return '';
    const isDistributor = isTrue(u.is_subadmin);
    const belongsToPanel = isTrue(u.belongs_to_panel_owner) || u.account_type === 'vendedor_panel' || u.account_type === 'distribuidor_del_panel' || !!u.owner_panel_id;
    const textOn = belongsToPanel ? 'Convertir en distribuidor del panel' : 'Convertir en admin distribuidor';
    const textOff = belongsToPanel ? 'Quitar distribuidor del panel' : 'Quitar admin distribuidor';
    return `<button class="outline-btn" onclick="toggleSubadmin(${u.id}, ${isDistributor ? 'false' : 'true'})">${isDistributor ? textOff : textOn}</button>`;
  }
  function renderUsersWithHierarchy(){
    const box = document.getElementById('usersList');
    if (!box || !Array.isArray(allUsers)) return;
    box.innerHTML = allUsers.map(u => {
      const label = userAccountLabel(u);
      const chipClass = label === 'Panel propietario' ? 'chip' : 'chip';
      return `<div class="item">
        <p><b>ID:</b> ${u.id}</p>
        <p><b>Nombre:</b> ${safeText(u.name)}</p>
        <p><b>Correo:</b> ${safeText(u.email)}</p>
        <p><b>Rol:</b> ${safeText(u.role)} <span class="${chipClass}">${safeText(label)}</span></p>
        ${ownerText(u)}
        <p><b>Saldo:</b> $${formatMoney(u.balance)}</p>
        ${actionForUser(u)}
      </div>`;
    }).join('') || 'No hay usuarios.';
  }
  function renameAnnouncementsPanel(){
    const title = document.querySelector('#adminAnnouncementsPanel h2');
    const desc = document.querySelector('#adminAnnouncementsPanel .small-text');
    const isPanelOwner = currentUser && (isTrue(currentUser.is_panel_admin) || currentUser.account_type === 'panel_propietario');
    if (title) title.textContent = isPanelOwner ? 'Comunicados de mi panel' : 'Comunicados globales';
    if (desc) desc.textContent = isPanelOwner
      ? 'Estos avisos solo aparecen para tus vendedores y dentro de tu panel propietario.'
      : 'Estos avisos aparecen para los usuarios de tu ecosistema global.';
  }
  const oldLoadUsersHierarchy = typeof loadUsers === 'function' ? loadUsers : null;
  if (oldLoadUsersHierarchy) {
    loadUsers = async function(){
      const result = await oldLoadUsersHierarchy();
      renderUsersWithHierarchy();
      return result;
    };
  }
  const oldEnsureAnnouncementsPanel = typeof ensureAnnouncementAdminPanel === 'function' ? ensureAnnouncementAdminPanel : null;
  if (oldEnsureAnnouncementsPanel) {
    ensureAnnouncementAdminPanel = function(){
      const result = oldEnsureAnnouncementsPanel();
      renameAnnouncementsPanel();
      return result;
    };
  }
  const oldShowSectionHierarchy = typeof showSection === 'function' ? showSection : null;
  if (oldShowSectionHierarchy) {
    showSection = function(name){
      const result = oldShowSectionHierarchy(name);
      if (name === 'admin') {
        setTimeout(renderUsersWithHierarchy, 250);
        setTimeout(renameAnnouncementsPanel, 250);
      }
      return result;
    };
  }
  setTimeout(renderUsersWithHierarchy, 600);
  setTimeout(renameAnnouncementsPanel, 600);
})();


// ===============================
// COMUNICADOS PARA PANEL PROPIETARIO - 2026-06-08 03:59:14
// ===============================
(function(){
  function isPanelOwnerUser(){
    return currentUser && (
      (String(currentUser.role || '').toLowerCase() === 'admin' &&
       !(currentUser.is_subadmin === true || currentUser.is_subadmin === 1 || currentUser.is_subadmin === 'true') &&
       !(currentUser.is_panel_admin === true || currentUser.is_panel_admin === 1 || currentUser.is_panel_admin === 'true')) ||
      currentUser.is_panel_admin === true ||
      currentUser.is_panel_admin === 1 ||
      currentUser.is_panel_admin === 'true' ||
      currentUser.account_type === 'panel_propietario'
    );
  }

  function setupOwnerAnnouncementsMenu(){
    const btn = document.getElementById('ownerAnnouncementsMenuBtn');
    if (!btn) return;
    if (isPanelOwnerUser()) {
      btn.classList.remove('hidden');
      btn.style.display = '';
    } else {
      btn.classList.add('hidden');
      btn.style.display = 'none';
    }
  }

  window.loadOwnerAnnouncements = async function(){
    try {
      if (!isPanelOwnerUser()) return;
      const list = await api('/api/admin/announcements');
      const box = document.getElementById('ownerAnnouncementsList');
      if (!box) return;
      box.innerHTML = Array.isArray(list) && list.length ? list.map(a => `
        <div class="item">
          <p><b>#${a.id}</b> ${safeText(a.message)}</p>
          <p><b>Estado:</b> <span class="status">${Number(a.active)===1 || a.active===true ? 'Activo' : 'Oculto'}</span></p>
          <div class="two-row">
            <button class="outline-btn" onclick="toggleOwnerAnnouncement(${a.id}, ${Number(a.active)===1 || a.active===true ? 0 : 1})">${Number(a.active)===1 || a.active===true ? 'Ocultar' : 'Activar'}</button>
            <button class="danger-btn" onclick="deleteOwnerAnnouncement(${a.id})">Eliminar</button>
          </div>
        </div>
      `).join('') : 'Sin comunicados.';
    } catch(e) {
      showMessage(e.message || 'Error cargando comunicados', 'error');
    }
  };

  window.createOwnerAnnouncement = async function(){
    try {
      const text = (document.getElementById('ownerAnnouncementText')?.value || '').trim();
      if (!text) throw new Error('Escribe el comunicado');
      const data = await api('/api/admin/announcements', { method:'POST', body: JSON.stringify({ message:text }) });
      showMessage(data.message || 'Comunicado publicado');
      const input = document.getElementById('ownerAnnouncementText');
      if (input) input.value = '';
      await loadAnnouncements();
      await loadOwnerAnnouncements();
    } catch(e) {
      showMessage(e.message || 'Error creando comunicado', 'error');
    }
  };

  window.toggleOwnerAnnouncement = async function(id, active){
    try {
      const data = await api('/api/admin/announcements/' + id, { method:'PATCH', body: JSON.stringify({ active }) });
      showMessage(data.message || 'Comunicado actualizado');
      await loadAnnouncements();
      await loadOwnerAnnouncements();
    } catch(e) {
      showMessage(e.message || 'Error actualizando comunicado', 'error');
    }
  };

  window.deleteOwnerAnnouncement = async function(id){
    if (!confirm('¿Eliminar este comunicado?')) return;
    try {
      const data = await api('/api/admin/announcements/' + id, { method:'DELETE' });
      showMessage(data.message || 'Comunicado eliminado');
      await loadAnnouncements();
      await loadOwnerAnnouncements();
    } catch(e) {
      showMessage(e.message || 'Error eliminando comunicado', 'error');
    }
  };

  const prevShowSectionOwnerAnn = typeof showSection === 'function' ? showSection : null;
  if (prevShowSectionOwnerAnn) {
    showSection = function(name){
      const result = prevShowSectionOwnerAnn(name);
      setupOwnerAnnouncementsMenu();
      if (name === 'ownerAnnouncements') loadOwnerAnnouncements();
      return result;
    };
    window.showSection = showSection;
  }

  const prevLoadAppOwnerAnn = typeof loadApp === 'function' ? loadApp : null;
  if (prevLoadAppOwnerAnn) {
    loadApp = async function(){
      const result = await prevLoadAppOwnerAnn();
      setupOwnerAnnouncementsMenu();
      setTimeout(setupOwnerAnnouncementsMenu, 500);
      setTimeout(setupOwnerAnnouncementsMenu, 1500);
      return result;
    };
    window.loadApp = loadApp;
  }

  setTimeout(setupOwnerAnnouncementsMenu, 500);
  setTimeout(setupOwnerAnnouncementsMenu, 1500);
})();



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

// Función para convertir el PDF a texto (Base64)
function convertFileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
  });
}

// Compra individual; no cambia el abrir/cerrar del producto.
window.buyProduct = async function(productId){
  try {
    const product = (window.allProducts || []).find(p=>Number(p.id)===Number(productId)) ||
      await api('/api/products').then(ps=>ps.find(p=>Number(p.id)===Number(productId)));
    if(!product) throw new Error('Producto no encontrado');

    if(!confirm(`Vas a comprar: ${product.name}\nCosto: $${formatMoney(product.price)}\n\n¿Confirmas la compra?`)) return;

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

    const deliveredNow = String(data.delivered_account_data || '').trim();
    showMessage(data.message || 'Compra realizada');
    await loadApp();
    showSection('orders');
    if (deliveredNow) {
      openModalEntregaInmediata(deliveredNow);
    }
  } catch(e) {
    showMessage(e.message || 'Error comprando producto','error');
  }
};

  async function loadReportableAccounts(){
    try {
      const select=document.getElementById('reporteCuentaSelect');
      if(!select) return;
      const accounts=await api('/api/reportable-accounts');
      select.innerHTML='<option value="">Selecciona cuenta/plataforma entregada</option>'+(accounts||[]).map(a=>{
        const label=`Pedido #${a.order_id} | ${a.platform||a.product_name||'Plataforma'} | ${a.account_email||''}${a.profile_name?' | Perfil: '+a.profile_name:''}`;
        return `<option value="${a.id}" data-email="${safeText(a.account_email||'')}">${safeText(label)}</option>`;
      }).join('');
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

  window.onSelectReportAccountStable=function(){
    const opt=document.getElementById('reporteCuentaSelect')?.selectedOptions?.[0];
    const email=opt?.getAttribute('data-email')||'';
    const correo=document.getElementById('reporteCorreo');
    if(correo && email) correo.value=email;
  };

  async function chooseComboAccount(reportId){
    const data=await api('/api/admin/account-reports/'+reportId+'/order-accounts');
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

  const oldShow=typeof showSection==='function'?showSection:null;
  if(oldShow){
    window.showSection=function(name){
      const r=oldShow(name);
      if(name==='reports') setTimeout(ensureReportSelect,150);
      if(name==='shop' || name==='store') setTimeout(removeMultiQtyUI,250);
      return r;
    };
    showSection=window.showSection;
  }

  const oldLoad=typeof loadApp==='function'?loadApp:null;
  if(oldLoad){
    window.loadApp=async function(){
      const r=await oldLoad();
      setTimeout(ensureReportSelect,600);
      setTimeout(removeMultiQtyUI,900);
      return r;
    };
    loadApp=window.loadApp;
  }

  setTimeout(removeMultiQtyUI,800);
  setTimeout(ensureReportSelect,800);
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
      setTimeout(fixVisibleXProducts, 200);
      setTimeout(fixVisibleXProducts, 900);
      return result;
    };
    loadDashboardStats = window.loadDashboardStats;
  }

  const oldLoadSalesReportMergeX = typeof loadSalesReport === 'function' ? loadSalesReport : null;
  if (oldLoadSalesReportMergeX) {
    window.loadSalesReport = async function(...args){
      const result = await oldLoadSalesReportMergeX(...args);
      setTimeout(fixVisibleXProducts, 200);
      setTimeout(fixVisibleXProducts, 900);
      return result;
    };
    loadSalesReport = window.loadSalesReport;
  }

  setTimeout(fixVisibleXProducts, 1200);
  setInterval(fixVisibleXProducts, 4000);
})();



// ===============================
// BOTÓN COPIAR EN RESPUESTA DE FALLOS - 2026-06-09 02:38:18
// Agrega botón para copiar la cuenta de reemplazo en el área del usuario.
// ===============================
(function(){
  function extractReplacementTextFromCard(card){
    if (!card) return '';
    const txt = card.innerText || '';
    const marker = 'Respuesta del admin:';
    const idx = txt.indexOf(marker);
    if (idx >= 0) return txt.slice(idx + marker.length).trim();
    return txt.trim();
  }

  window.copyFailureResponseText = async function(btn){
    try {
      const card = btn.closest('.item') || btn.closest('.report-card') || btn.closest('.card') || btn.parentElement;
      let text = '';

      const textarea = card ? card.querySelector('textarea') : null;
      if (textarea) text = textarea.value || textarea.textContent || '';

      if (!text) {
        const responseBox = card ? Array.from(card.querySelectorAll('div, p, pre')).find(el => 
          (el.innerText || '').toLowerCase().includes('respuesta del admin') ||
          (el.innerText || '').toLowerCase().includes('cuenta de streaming entregada')
        ) : null;
        text = responseBox ? responseBox.innerText : extractReplacementTextFromCard(card);
      }

      text = String(text || '').trim();
      if (!text) throw new Error('No encontré datos para copiar');

      await navigator.clipboard.writeText(text);
      showMessage('Datos copiados');
    } catch(e) {
      try {
        const card = btn.closest('.item') || btn.closest('.report-card') || btn.closest('.card') || btn.parentElement;
        const text = extractReplacementTextFromCard(card);
        const tmp = document.createElement('textarea');
        tmp.value = text;
        document.body.appendChild(tmp);
        tmp.focus();
        tmp.select();
        document.execCommand('copy');
        tmp.remove();
        showMessage('Datos copiados');
      } catch(err) {
        showMessage('No se pudo copiar', 'error');
      }
    }
  };

  function addCopyButtonsToFailureResponses(){
    const section = document.getElementById('section-failureResponses') ||
                    document.getElementById('section-accountResponses') ||
                    document.getElementById('section-reportResponses') ||
                    document.querySelector('section:not(.hidden)');

    const possibleCards = Array.from(document.querySelectorAll('.item, .report-card, .card, .panel div'));

    possibleCards.forEach(card => {
      const text = card.innerText || '';
      const isFailureResponse = text.includes('Respuesta del admin') &&
        (
          text.toLowerCase().includes('cuenta reemplazada') ||
          text.toLowerCase().includes('cuenta de streaming entregada') ||
          text.toLowerCase().includes('correo:') ||
          text.toLowerCase().includes('contraseña:')
        );

      if (!isFailureResponse) return;
      if (card.querySelector('.copy-failure-response-btn')) return;

      const btn = document.createElement('button');
      btn.className = 'outline-btn copy-failure-response-btn';
      btn.type = 'button';
      btn.style.marginTop = '12px';
      btn.textContent = '📋 Copiar cuenta de reemplazo';
      btn.onclick = function(ev){
        ev.preventDefault();
        ev.stopPropagation();
        copyFailureResponseText(btn);
      };

      card.appendChild(btn);
    });
  }

  const oldLoadMyAccountReportsCopyFix = typeof loadMyAccountReports === 'function' ? loadMyAccountReports : null;
  if (oldLoadMyAccountReportsCopyFix) {
    window.loadMyAccountReports = async function(){
      const result = await oldLoadMyAccountReportsCopyFix();
      setTimeout(addCopyButtonsToFailureResponses, 100);
      setTimeout(addCopyButtonsToFailureResponses, 600);
      return result;
    };
    loadMyAccountReports = window.loadMyAccountReports;
  }

  const oldShowSectionCopyFix = typeof showSection === 'function' ? showSection : null;
  if (oldShowSectionCopyFix) {
    window.showSection = function(name){
      const result = oldShowSectionCopyFix(name);
      if (
        name === 'failureResponses' ||
        name === 'responses' ||
        name === 'accountResponses' ||
        name === 'reportResponses' ||
        name === 'reports'
      ) {
        setTimeout(addCopyButtonsToFailureResponses, 150);
        setTimeout(addCopyButtonsToFailureResponses, 800);
      }
      return result;
    };
    showSection = window.showSection;
  }

  const oldLoadAppCopyFix = typeof loadApp === 'function' ? loadApp : null;
  if (oldLoadAppCopyFix) {
    window.loadApp = async function(){
      const result = await oldLoadAppCopyFix();
      setTimeout(addCopyButtonsToFailureResponses, 800);
      return result;
    };
    loadApp = window.loadApp;
  }

  setTimeout(addCopyButtonsToFailureResponses, 1000);
  setInterval(addCopyButtonsToFailureResponses, 3000);
})();



// ===============================
// FIX BOTÓN COPIAR ÚNICO EN RESPUESTA DE FALLOS - 2026-06-09 03:02:58
// Evita botones duplicados y deja solo uno por reporte abierto.
// ===============================
(function(){
  function getFailureReportCard(el){
    return el.closest('.item') || el.closest('.report-card') || el.closest('.card') || el.closest('.panel') || el.parentElement;
  }

  function cleanDuplicateCopyButtons(){
    const buttons = Array.from(document.querySelectorAll('.copy-failure-response-btn'));
    const seenCards = new Set();

    buttons.forEach(btn => {
      const card = getFailureReportCard(btn);
      if (!card) {
        btn.remove();
        return;
      }

      // Si el card no contiene respuesta real, quitar botón.
      const txt = (card.innerText || '').toLowerCase();
      const hasResponse = txt.includes('respuesta del admin') || txt.includes('cuenta de streaming entregada') || txt.includes('cuenta reemplazada');
      if (!hasResponse) {
        btn.remove();
        return;
      }

      // Solo un botón por card.
      if (seenCards.has(card)) {
        btn.remove();
      } else {
        seenCards.add(card);
      }
    });
  }

  function extractReplacementText(card){
    if (!card) return '';
    const full = card.innerText || '';
    const marker = 'Respuesta del admin:';
    const idx = full.indexOf(marker);
    if (idx >= 0) {
      let text = full.slice(idx + marker.length).trim();
      text = text.replace(/📋\s*Copiar cuenta de reemplazo/gi, '').trim();
      return text;
    }
    return full.replace(/📋\s*Copiar cuenta de reemplazo/gi, '').trim();
  }

  window.copyFailureResponseText = async function(btn){
    const card = getFailureReportCard(btn);
    const text = extractReplacementText(card);

    if (!text) {
      showMessage('No encontré datos para copiar', 'error');
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      showMessage('Datos copiados');
    } catch(e) {
      const tmp = document.createElement('textarea');
      tmp.value = text;
      document.body.appendChild(tmp);
      tmp.focus();
      tmp.select();
      document.execCommand('copy');
      tmp.remove();
      showMessage('Datos copiados');
    }
  };

  function addSingleCopyButtons(){
    cleanDuplicateCopyButtons();

    const cards = Array.from(document.querySelectorAll('.item, .report-card, .card'));
    cards.forEach(card => {
      const text = card.innerText || '';
      const lower = text.toLowerCase();

      const isReplacement =
        lower.includes('respuesta del admin') &&
        (
          lower.includes('cuenta reemplazada') ||
          lower.includes('cuenta de streaming entregada') ||
          lower.includes('correo:') ||
          lower.includes('contraseña:')
        );

      if (!isReplacement) return;

      // No agregar si ya hay botón en este card.
      if (card.querySelector(':scope > .copy-failure-response-btn') || card.querySelector('.copy-failure-response-btn')) return;

      const btn = document.createElement('button');
      btn.className = 'outline-btn copy-failure-response-btn';
      btn.type = 'button';
      btn.style.marginTop = '12px';
      btn.textContent = '📋 Copiar cuenta de reemplazo';
      btn.onclick = function(ev){
        ev.preventDefault();
        ev.stopPropagation();
        copyFailureResponseText(btn);
      };

      card.appendChild(btn);
    });

    cleanDuplicateCopyButtons();
  }

  const prevLoadMyReportsCopyUnique = typeof loadMyAccountReports === 'function' ? loadMyAccountReports : null;
  if (prevLoadMyReportsCopyUnique) {
    window.loadMyAccountReports = async function(){
      const result = await prevLoadMyReportsCopyUnique();
      setTimeout(addSingleCopyButtons, 150);
      setTimeout(addSingleCopyButtons, 700);
      return result;
    };
    loadMyAccountReports = window.loadMyAccountReports;
  }

  const prevShowSectionCopyUnique = typeof showSection === 'function' ? showSection : null;
  if (prevShowSectionCopyUnique) {
    window.showSection = function(name){
      const result = prevShowSectionCopyUnique(name);
      setTimeout(addSingleCopyButtons, 200);
      setTimeout(addSingleCopyButtons, 900);
      return result;
    };
    showSection = window.showSection;
  }

  const prevLoadAppCopyUnique = typeof loadApp === 'function' ? loadApp : null;
  if (prevLoadAppCopyUnique) {
    window.loadApp = async function(){
      const result = await prevLoadAppCopyUnique();
      setTimeout(addSingleCopyButtons, 1000);
      return result;
    };
    loadApp = window.loadApp;
  }

  setTimeout(addSingleCopyButtons, 1000);
  setInterval(cleanDuplicateCopyButtons, 3000);
})();



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
      setTimeout(addNotifyButtons, 150);
      setTimeout(bindSaldoPendienteCard, 200);
      return result;
    };
    loadBalanceRequests = window.loadBalanceRequests;
  }

  const prevLoadAccountReportsNotify = typeof loadAccountReports === 'function' ? loadAccountReports : null;
  if (prevLoadAccountReportsNotify) {
    window.loadAccountReports = async function(){
      const result = await prevLoadAccountReportsNotify();
      setTimeout(addNotifyButtons, 150);
      return result;
    };
    loadAccountReports = window.loadAccountReports;
  }

const prevShowSectionSaldoNotify = showSection;

showSection = function(name){
    const result = prevShowSectionSaldoNotify(name);

    setTimeout(bindSaldoPendienteCard, 200);

    if(name === 'admin')
        setTimeout(addNotifyButtons, 400);

    // NUEVO
    if(name === 'dashboard' && currentUser?.role === 'admin'){
        setTimeout(loadExpiringCount, 300);
    }

    return result;
}
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

// Inyector: Agrega el botón morado a todos los reportes automáticamente
setInterval(() => {
  const bloquesFallas = document.querySelectorAll('.item, .card, tr');
  bloquesFallas.forEach(bloque => {
    const texto = bloque.innerHTML;
    if ((texto.includes('Reporte') || texto.includes('Falla')) && !bloque.querySelector('.btn-ingreso-manual')) {
      const idEncontrado = texto.match(/#(\d+)/);
      const reportId = idEncontrado ? idEncontrado[1] : null;
      const contenedor = bloque.querySelector('.order-data, td:last-child') || bloque;
      
      if (reportId && contenedor) {
        const btn = document.createElement('button');
        btn.className = 'btn-ingreso-manual';
        btn.innerHTML = '⚡ Ingreso Manual';
        btn.style.cssText = 'background: #9333ea; color: white; padding: 6px 12px; border-radius: 6px; font-size: 12px; margin-left: 8px; border: none; cursor: pointer; display: inline-block; font-weight: bold; margin-top: 6px;';
        btn.onclick = () => forzarIngresoManual(reportId);
        contenedor.appendChild(btn);
      }
    }
  });
}, 2000);
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
function getAnunciosModal(){
  return document.getElementById('modal-anuncios');
}

function getPanicoModal(){
  return document.getElementById('modal-panico');
}

function showFloatingModal(modal){
  if (!modal) return;
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
  modal.style.display = 'flex';
  modal.style.position = 'fixed';
  modal.style.inset = '0';
  modal.style.zIndex = '9999';
  modal.style.alignItems = 'center';
  modal.style.justifyContent = 'center';
  if (!modal.style.background) {
    modal.style.background = 'rgba(0,0,0,0.5)';
  }
}

function hideFloatingModal(modal){
  if (!modal) return;
  modal.style.display = 'none';
  modal.classList.add('hidden');
  modal.setAttribute('aria-hidden', 'true');
}

function openPanicResetModal(){
  showFloatingModal(getPanicoModal());
}

function closePanicResetModal(){
  hideFloatingModal(getPanicoModal());
}

async function submitPanicReset(){
  try {
    if (!currentUser || String(currentUser.role || '').toLowerCase() !== 'admin') {
      throw new Error('Solo administradores pueden forzar reseteos.');
    }

    const input = document.getElementById('panicResetEmail');
    const email = String(input?.value || '').trim().toLowerCase();
    if (!email) {
      throw new Error('Ingresa el correo del vendedor.');
    }

    const data = await api('/api/panic-reset', {
      method: 'POST',
      body: JSON.stringify({ email })
    });

    if (input) input.value = '';
    closePanicResetModal();
    showMessage(data?.message || 'Contraseña reseteada a: 123456');
    alert('¡Contraseña restablecida con éxito a 123456!');
  } catch (err) {
    showMessage(err.message || 'No se pudo forzar el reset', 'error');
  }
}
// ==========================================
// INICIO DE GRÁFICAS (PROTEGIDO)
// ==========================================
setTimeout(() => {
  if (localStorage.getItem('token')) {
    if (typeof cargarGraficas === 'function') {
      cargarGraficas();
    } else {
      console.log("ℹ️ Nota: cargarGraficas no está definida, saltando ejecución.");
    }
  }
}, 2000);
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
    
// ==========================================
// MODO APP PARA DISTRIBUIDORES (LIMPIO)
// ==========================================
setInterval(() => {
  if (!currentUser) return;

  const role = String(currentUser.role || '').toLowerCase();
  const accountType = String(currentUser.account_type || '').toLowerCase();
  const isSubadmin = currentUser.is_subadmin === true || currentUser.is_subadmin === 1 || currentUser.is_subadmin === 'true';
  const esDistribuidor = (accountType === 'admin_distribuidor' || accountType === 'distribuidor_del_panel' || (role !== 'admin' && isSubadmin));

  const btnUsr = document.getElementById('btn-dist-usuarios');
  const btnPre = document.getElementById('btn-dist-precios');
  const btnGan = document.getElementById('btn-dist-ganancias');

  // Solo mostramos los botones si el usuario es distribuidor
  if (btnUsr) btnUsr.classList.toggle('hidden', !esDistribuidor);
  if (btnPre) btnPre.classList.toggle('hidden', !esDistribuidor);
  if (btnGan) btnGan.classList.toggle('hidden', !esDistribuidor);

}, 1000);

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
async function checkQuarantineAccounts() {
  if (!currentUser || (currentUser.role !== 'admin' && currentUser.account_type !== 'panel_propietario')) return;
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
}

function openQuarantineFromDashboard() {
  if (!currentUser || (currentUser.role !== 'admin' && currentUser.account_type !== 'panel_propietario')) return;

  fetch('/api/admin/accounts/quarantine', {
    headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
  })
    .then(r => r.json())
    .then(list => {
      const quarantineList = Array.isArray(list) ? list : [];
      const stat = document.getElementById('statExpiring');
      if (stat) stat.textContent = String(quarantineList.length);
      showQuarantineModal(quarantineList);
    })
    .catch(err => {
      console.error('Error abriendo cuarentena:', err);
    });
}

function showQuarantineModal(list) {
  const old = document.getElementById('quarantineModal');
  if (old) old.remove();

  const isMobile = window.matchMedia('(max-width: 820px)').matches;

  const renderDesktopRows = () => list.map(c => {
    const dias = c.dias_restantes ? Math.floor(c.dias_restantes.days || c.dias_restantes) : 0;
    const color = dias < 5 ? '#ef4444' : '#10b981';

    return `
    <tr data-quarantine-row="1" data-account-id="${c.id}" style="border-bottom:1px solid #2f3648;">
      <td style="padding:10px; vertical-align:top;"><b>${c.platform}</b></td>
      <td style="padding:10px; vertical-align:top; word-break:break-word;"><span style="color:#60a5fa">${c.account_email}</span></td>
      <td style="padding:10px;">
        <div>👤 ${c.profile_name || 'Principal'}</div>
        <div>🔢 ${c.profile_pin || 'No tiene'}</div>
      </td>
      <td style="padding:10px; color:${color}; vertical-align:top;"><b>${dias > 0 ? dias + ' días' : '¡Vencida!'}</b></td>
      <td style="padding:10px; vertical-align:top;">
        <div style="display:flex; flex-direction:column; gap:8px;">
          <input id="new-pass-${c.id}" placeholder="Nueva contraseña" style="width:100%; box-sizing:border-box; padding:9px; border-radius:6px; border:none; background:#111827; color:white;">
          <div style="display:flex; gap:8px;">
            <button data-quarantine-action="release" data-account-id="${c.id}" style="flex:1; background:#10b981; color:white; border:none; padding:8px; border-radius:6px; cursor:pointer; font-weight:bold;">Liberar</button>
            <button data-quarantine-action="discard" data-account-id="${c.id}" style="flex:1; background:#4b5563; color:white; border:none; padding:8px; border-radius:6px; cursor:pointer; font-weight:bold;">Desechar</button>
          </div>
        </div>
      </td>
    </tr>`;
  }).join('');

  const renderMobileCards = () => list.map(c => {
    const dias = c.dias_restantes ? Math.floor(c.dias_restantes.days || c.dias_restantes) : 0;
    const color = dias < 5 ? '#ef4444' : '#10b981';

    return `
    <div data-quarantine-row="1" data-account-id="${c.id}" style="background:#111827; border:1px solid #374151; border-left:4px solid ${color}; border-radius:10px; padding:10px; margin-bottom:10px;">
      <div style="display:grid; gap:6px; font-size:13px;">
        <div><b>Plataforma:</b> ${c.platform}</div>
        <div style="word-break:break-word;"><b>Correo:</b> <span style="color:#60a5fa">${c.account_email}</span></div>
        <div><b>Perfil:</b> ${c.profile_name || 'Principal'} · <b>PIN:</b> ${c.profile_pin || 'No tiene'}</div>
        <div style="color:${color};"><b>Vida restante:</b> ${dias > 0 ? dias + ' días' : '¡Vencida!'}</div>
      </div>
      <input id="new-pass-${c.id}" placeholder="Nueva contraseña" style="margin-top:10px; width:100%; box-sizing:border-box; padding:10px; border-radius:6px; border:none; background:#0f172a; color:white;">
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:8px;">
        <button data-quarantine-action="release" data-account-id="${c.id}" style="background:#10b981; color:white; border:none; padding:10px; border-radius:6px; cursor:pointer; font-weight:bold;">Liberar</button>
        <button data-quarantine-action="discard" data-account-id="${c.id}" style="background:#4b5563; color:white; border:none; padding:10px; border-radius:6px; cursor:pointer; font-weight:bold;">Desechar</button>
      </div>
    </div>`;
  }).join('');

  const html = `
  <div id="quarantineModal" class="modal-overlay" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); z-index:99999; display:flex; justify-content:center; align-items:center; overflow-y:auto;">
    <div class="modal-box" style="background:#1e1e2f; padding:${isMobile ? '14px' : '20px'}; border-radius:12px; width:min(96vw,980px); color:white; max-height: 88vh; overflow-y: auto; box-sizing:border-box;">
      <h2 style="color:#ef4444; margin-top:0; border-bottom:1px solid #ef4444; padding-bottom:10px;">🚨 Cuentas en Cuarentena</h2>
      <p style="font-size:14px; color:#cbd5e1; line-height:1.5;">Estas cuentas ya cumplieron sus días de garantía. <b>Pasos:</b><br>1. Entra a la plataforma oficial.<br>2. Cambia la contraseña para sacar al cliente anterior.<br>3. Escribe la nueva clave aquí y presiona Liberar.</p>

      ${isMobile ? `
      <div id="quarantineCardsBody" style="margin-top:14px;">
        ${renderMobileCards()}
      </div>
      ` : `
      <div style="margin-top:16px; border:1px solid #374151; border-radius:8px; overflow:hidden;">
        <table style="width:100%; border-collapse:collapse; table-layout:fixed;">
          <thead>
            <tr style="background:#111827; color:#93c5fd; text-align:left;">
              <th style="padding:10px; border-bottom:1px solid #374151; width:14%;">Plataforma</th>
              <th style="padding:10px; border-bottom:1px solid #374151; width:24%;">Correo</th>
              <th style="padding:10px; border-bottom:1px solid #374151; width:16%;">Perfil / PIN</th>
              <th style="padding:10px; border-bottom:1px solid #374151; width:14%;">Vida restante</th>
              <th style="padding:10px; border-bottom:1px solid #374151; width:32%;">Acciones</th>
            </tr>
          </thead>
          <tbody id="quarantineTableBody">
            ${renderDesktopRows()}
          </tbody>
        </table>
      </div>
      `}
      <button onclick="document.getElementById('quarantineModal').remove()" style="margin-top:25px; background:#4b5563; color:white; border:none; padding:12px 20px; border-radius:6px; cursor:pointer; width:100%; font-weight:bold;">Cerrar Ventana</button>
    </div>
  </div>
  `;
  document.body.insertAdjacentHTML('beforeend', html);
}

async function liberarCuentaDeCuarentena(id) {
  const btn = document.querySelector(`[data-quarantine-action="release"][data-account-id="${Number(id)}"]`);
  if (!btn) return;
  btn.click();
}

async function desecharCuenta(id) {
  const btn = document.querySelector(`[data-quarantine-action="discard"][data-account-id="${Number(id)}"]`);
  if (!btn) return;
  btn.click();
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

// Configurar el radar: Se ejecuta 3 segundos después de cargar y luego cada 5 minutos
setTimeout(checkQuarantineAccounts, 3000);
setInterval(checkQuarantineAccounts, 300000);

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
function isAppSessionActiveForBackGuard() {
  const appSection = document.getElementById('appSection');
  return Boolean(token && appSection && !appSection.classList.contains('hidden'));
}

function activarHistorialCelular() {
  if (!isAppSessionActiveForBackGuard()) return;
  const state = history.state || {};
  if (state.__mobileAppGuard === true) return;
  history.pushState({ ...state, __mobileAppGuard: true }, '', window.location.href);
}

// Hack para atrapar el botón físico de retroceso en celulares
window.addEventListener('popstate', function(event) {
  if (!isAppSessionActiveForBackGuard()) return;

  // Cierra modales si hay alguno abierto
  const modalesAbiertos = document.querySelectorAll('.modal-overlay');
  modalesAbiertos.forEach(modal => modal.remove());

  // Regresa al inicio de forma suave
  if (typeof showSection === 'function') {
    showSection('dashboard');
  } else {
    window.location.reload();
    return;
  }

  // Vuelve a insertar una entrada para evitar salir de la app por error
  history.pushState({ __mobileAppGuard: true }, '', window.location.href);
});

// FORZAR APARICIÓN DEL BOTÓN A LOS 2 SEGUNDOS DE ENTRAR
setTimeout(() => {
    mostrarBotonRegresar();
}, 2000);

async function loadExpiringAlerts() {
  const list = document.getElementById('expiringAlertsList');
  if (!list) return;

  try {
    list.innerHTML = '<p class="small-text">Buscando cuentas por vencer...</p>';
    const accounts = await api('/api/alerts/expiring');

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
      
      return `
        <div class="item" style="border: 1px solid #ef9a9a; background: #ffebee; margin-bottom: 10px; padding: 12px; border-radius: 6px;">
          <div style="display:flex; justify-content:space-between; align-items: center;">
            <div>
              <b style="color: #c62828; font-size: 16px;">Vence Proveedor: ${fechaVence.toLocaleDateString('es-MX', opcionesFecha)}</b><br>
              <span style="font-size: 14px;"><b>Correo:</b> ${acc.account_email}</span><br>
              <span style="font-size: 13px; color: #555;">Plataforma: ${acc.platform} | Comprada el: ${fechaCompra.toLocaleDateString('es-MX', opcionesFecha)}</span>
            </div>
            <div style="text-align: right;">
              <span style="font-size: 13px;"><b>ID:</b> #${acc.id}</span><br>
              <span style="font-size: 13px; font-weight:bold;">Perfil: ${acc.profile_name || 'N/A'}</span>
            </div>
          </div>
        </div>
      `;
    }).join('');

  } catch (e) {
    list.innerHTML = `<p style="color:red;">Error cargando alertas: ${e.message}</p>`;
  }
}

// Mantenemos tu EventListener seguro al final
document.addEventListener('DOMContentLoaded', () => {
  if(document.getElementById('expiringAlertsList')) {
    loadExpiringAlerts();
  }
});


// ESTA ES LA PARTE QUE MANTIENE TU PANEL SEGURO AL CARGAR
document.addEventListener('DOMContentLoaded', () => {
  if(document.getElementById('expiringAlertsList')) {
    loadExpiringAlerts();
  }
});

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
    'dashOrdersCard',
    'dashReportsCard',
    'dashBalanceRequestsCard',
    'dashQuarantineCard',
    'dashExpiringCard',
    'dashSalesTodayCard'
  ];

  const distOnlyButtons=['btn-dist-usuarios','btn-dist-precios','btn-dist-ganancias'];
  const actionButtons=['actionOrdersBtn','actionBalanceBtn','actionReportBtn','actionResponsesBtn'];
  const vendorOnlyCards=['actionAccountCard','actionShopCard','actionLogoutCard'];
  const globalInfraIds=['adminPanelsCardPhase1','adminPanelsPanelPhase1','dashAdminPanelsCardMainFinal','ownerAnnouncementsMenuBtn','panicResetMenuBtn'];

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
    // En paneles rentados, el módulo de cuarentena debe quedar limpio/oculto.
    if(isPanelAdmin){
      hardHide('dashQuarantineCard', true);
    }
    hardHide('dashCsvUploadCard', true);
    hardHide('dashDailyCutCard', true);
    hardHide('dashMonthlyReportCard', true);

    // Oculta infraestructura global para panel admin independiente.
    hardHide('adminMenuBtn', true);
    hardHide('adminSalesMenuBtn', true);
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
  hardHide('ownerAnnouncementsMenuBtn', true);
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
      'adminMenuBtn','adminSalesMenuBtn','ownerAnnouncementsMenuBtn','panicResetMenuBtn'
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

const __showSectionBeforeRoleMatrix = typeof showSection === 'function' ? showSection : null;
let __shopTransitionLockUntil = 0;
if(__showSectionBeforeRoleMatrix){
  showSection = function(name){
    const target = String(name || '');
    const now = Date.now();

    // Evita el cierre inmediato de tienda por dobles redirecciones en el primer click.
    if (now < __shopTransitionLockUntil && target !== 'shop') {
      return;
    }

    if (target === 'shop') {
      __shopTransitionLockUntil = now + 700;
    }

    __showSectionBeforeRoleMatrix(name);
    if(target==='dashboard') resetScrollToTop();
    applyDashboardRoleVisibilityMatrix();
    actualizarConteosDashboard();
    if(target==='dashboard' && currentUser && String(currentUser.role || '').toLowerCase()==='admin'){
      loadExpiringCount();
    }
  };
}

const __loadAppBeforeRoleMatrix = typeof loadApp === 'function' ? loadApp : null;
if(__loadAppBeforeRoleMatrix){
  loadApp = async function(){
    await __loadAppBeforeRoleMatrix();
    applyDashboardRoleVisibilityMatrix();
    actualizarConteosDashboard();
    const pendingName = String(window.__pendingWelcomeName || '').trim();
    if(pendingName){
      paintDashboardWelcomeBanner(pendingName);
      window.__pendingWelcomeName='';
    }else if(currentUser?.name){
      paintDashboardWelcomeBanner(currentUser.name);
    }
  };
}

setInterval(()=>{
  applyDashboardRoleVisibilityMatrix();
  actualizarConteosDashboard();
}, 1500);

// Navegación final por tarjetas: separa panel admin de distribuidor.
openUsersFromDashboard = function(){
  if(isGlobalAdminForDashboard() || isPanelAdminForDashboard()) return scrollToAdmin('adminUsersPanel');
  return showSection('account');
};

openProductsFromDashboard = function(){
  if(isGlobalAdminForDashboard() || isPanelAdminForDashboard()) return scrollToAdmin('adminProductsPanel');
  __shopTransitionLockUntil = Date.now() + 700;
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
  const expected=['producto','correo','contrasena','perfil','pin','fecha_compra','cuenta_madre','url_soporte'];
  const missing=expected.filter(h=>!headers.includes(h));
  if(missing.length){
    throw new Error(`Encabezados faltantes en CSV: ${missing.join(', ')}`);
  }

  const indexByHeader={};
  headers.forEach((h,i)=>{ if(indexByHeader[h]===undefined) indexByHeader[h]=i; });

  return lines.slice(1).map((line, idx)=>{
    const cols=parseCsvLine(line, separator);
    const row={};
    expected.forEach(h=>{ row[h]=String(cols[indexByHeader[h]] || '').trim(); });
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

    const headers = ['producto','correo','contrasena','perfil','pin','fecha_compra','cuenta_madre','url_soporte'];

    const lines = [headers.map(csvEscape).join(',')];
    (Array.isArray(rows) ? rows : []).forEach(acc => {
      const line = [
        acc.product_name || acc.platform || '',
        acc.account_email || '',
        acc.account_password || '',
        acc.profile_name || '',
        acc.profile_pin || '',
        acc.official_purchase_date ? String(acc.official_purchase_date).slice(0,10) : '',
        acc.platform || acc.product_name || '',
        acc.access_url || ''
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

setTimeout(setupInventoryCsvUploadFlow, 400);
setInterval(setupInventoryCsvUploadFlow, 3000);
setTimeout(setupInventoryCsvDownloadTrigger, 500);
setInterval(setupInventoryCsvDownloadTrigger, 3000);
setTimeout(setupExpiringCardAction, 450);
setInterval(setupExpiringCardAction, 3000);
setInterval(()=>{
  if(currentUser && String(currentUser.role || '').toLowerCase()==='admin') loadExpiringCount();
}, 30000);

const PANEL_ANNOUNCEMENT_DEFAULT = '¡Bienvenidos a la plataforma de servicios digitales!';
let __currentPanelAnnouncementText = PANEL_ANNOUNCEMENT_DEFAULT;

function ensureSingleAnnouncementRibbonOriginal(){
  if (typeof ensureAnnouncementsUI === 'function') {
    try { ensureAnnouncementsUI(); } catch (_) {}
  }

  const duplicateTicker = document.getElementById('globalAnnouncementTicker');
  if (duplicateTicker) {
    duplicateTicker.classList.add('show');
    duplicateTicker.style.display = 'flex';
  }

  const duplicateLabel = document.getElementById('importantAnnouncementsLabel');
  if (duplicateLabel) duplicateLabel.classList.add('show');

  const announcementsMenuBtn = document.getElementById('announcementsMenuBtn');
  if (announcementsMenuBtn) announcementsMenuBtn.remove();

  const announcementsSection = document.getElementById('section-comunicados');
  if (announcementsSection) announcementsSection.remove();

  const adminAnnouncementsPanel = document.getElementById('adminAnnouncementsPanel');
  if (adminAnnouncementsPanel) adminAnnouncementsPanel.remove();
}

function applyPanelAnnouncementText(text){
  const finalText = String(text ?? '').trim();
  __currentPanelAnnouncementText = finalText;

  ensureSingleAnnouncementRibbonOriginal();

  const announcementTicker = document.getElementById('announcementTicker');
  const announcementMarquee = document.getElementById('announcementMarquee');
  if (announcementTicker) {
    announcementTicker.classList.add('show');
    announcementTicker.style.display = 'flex';
  }
  const globalTicker = document.getElementById('globalAnnouncementTicker');
  if (globalTicker) {
    globalTicker.classList.add('show');
    globalTicker.style.display = 'flex';
  }
  const globalLabel = document.getElementById('importantAnnouncementsLabel');
  if (globalLabel) globalLabel.classList.add('show');
  if (announcementMarquee) {
    announcementMarquee.innerHTML = finalText ? `<span>${safeText(finalText)}</span>` : '';
  }
}

function syncAnnouncementControlAccess(){
  const openBtn = document.getElementById('btn-anuncios');
  const salesReportBtn = document.getElementById('btn-top-reporte-ventas');
  const modalInput = document.getElementById('announcementNewText');
  const applyBtn = document.getElementById('btn-activar-anuncios');
  const clearBtn = document.getElementById('btn-ocultar-anuncios');
  const deleteBtn = document.getElementById('btn-eliminar-anuncios');
  const role = String(currentUser?.role || '').toLowerCase();
  const accountType = String(currentUser?.account_type || '').toLowerCase();
  const isPanelAdmin = currentUser?.is_panel_admin === true || currentUser?.is_panel_admin === 1 || currentUser?.is_panel_admin === 'true';
  const canManageAnnouncements = role === 'admin' || isPanelAdmin || ['panel_propietario', 'panel_admin', 'admin_panel'].includes(accountType);

  if (openBtn) openBtn.classList.toggle('hidden', !canManageAnnouncements);
  if (salesReportBtn) salesReportBtn.classList.toggle('hidden', !canManageAnnouncements);
  if (modalInput) modalInput.disabled = !canManageAnnouncements;
  if (applyBtn) applyBtn.disabled = !canManageAnnouncements;
  if (clearBtn) clearBtn.disabled = !canManageAnnouncements;
  if (deleteBtn) deleteBtn.disabled = !canManageAnnouncements;
}

function fillAnnouncementModalFields(message){
  const activeBox = document.getElementById('anuncio-activo-txt');
  const input = document.getElementById('announcementNewText');
  const finalText = String(message ?? '').trim();

  if (activeBox) {
    activeBox.textContent = finalText || '(Sin anuncio activo)';
  }
  if (input) {
    input.value = finalText;
  }
}

async function loadPanelAnnouncementText(){
  if (!token) token = localStorage.getItem('token');
  if (!token) {
    fillAnnouncementModalFields('(Sin sesión activa)');
    return;
  }
  try {
    const payload = await api('/api/announcement');
    const message = String(
      payload?.text ??
      payload?.texto ??
      payload?.comunicado ??
      payload?.message ??
      payload?.announcement?.message ??
      ''
    ).trim();
    applyPanelAnnouncementText(message);
    fillAnnouncementModalFields(message);
    syncAnnouncementControlAccess();
  } catch (e) {
    fillAnnouncementModalFields(__currentPanelAnnouncementText);
    syncAnnouncementControlAccess();
    console.warn('No se pudo cargar el anuncio del panel', e);
  }
}

async function updateDashboardAnnouncement(){
  try {
    const input = document.getElementById('announcementNewText');
    const text = String(input?.value || '').trim() || PANEL_ANNOUNCEMENT_DEFAULT;
    const data = await api('/api/announcement', {
      method: 'POST',
      body: JSON.stringify({ message: text })
    });

    const savedMessage = String(data?.announcement?.message || text || PANEL_ANNOUNCEMENT_DEFAULT);
    applyPanelAnnouncementText(savedMessage);
    fillAnnouncementModalFields(savedMessage);
    showMessage(data?.message || 'Anuncio actualizado correctamente');
  } catch (e) {
    showMessage(e.message || 'Error actualizando anuncio', 'error');
  }
}

async function applyAnnouncementFromModal(){
  await updateDashboardAnnouncement();
}

async function clearAnnouncementFromModal(){
  try {
    const data = await api('/api/announcement', {
      method: 'POST',
      body: JSON.stringify({ message: '' })
    });

    applyPanelAnnouncementText('');
    fillAnnouncementModalFields('');
    showMessage(data?.message || 'Anuncio ocultado correctamente');
  } catch (e) {
    showMessage(e.message || 'Error ocultando anuncio', 'error');
  }
}

async function deleteAnnouncementFromModal(){
  try {
    const data = await api('/api/announcement', {
      method: 'POST',
      body: JSON.stringify({ message: '' })
    });

    applyPanelAnnouncementText('');
    fillAnnouncementModalFields('');
    const input = document.getElementById('announcementNewText');
    if (input) input.value = '';
    showMessage(data?.message || 'Anuncio eliminado correctamente');
  } catch (e) {
    showMessage(e.message || 'Error eliminando anuncio', 'error');
  }
}

function openAnnouncementModal(){
  const modal = getAnunciosModal();
  if (!modal) return;
  ensureSingleAnnouncementRibbonOriginal();
  showFloatingModal(modal);
  fillAnnouncementModalFields('Cargando anuncio activo...');
  syncAnnouncementControlAccess();
  loadPanelAnnouncementText();
}

function closeAnnouncementModal(){
  hideFloatingModal(getAnunciosModal());
}

window.updateDashboardAnnouncement = updateDashboardAnnouncement;
window.applyAnnouncementFromModal = applyAnnouncementFromModal;
window.clearAnnouncementFromModal = clearAnnouncementFromModal;
window.deleteAnnouncementFromModal = deleteAnnouncementFromModal;
window.openAnnouncementModal = openAnnouncementModal;
window.closeAnnouncementModal = closeAnnouncementModal;
window.openPanicResetModal = openPanicResetModal;
window.closePanicResetModal = closePanicResetModal;
window.submitPanicReset = submitPanicReset;
window.savePanelAnnouncementText = updateDashboardAnnouncement;

const __loadAppBeforePanelAnnouncement = typeof loadApp === 'function' ? loadApp : null;
if (__loadAppBeforePanelAnnouncement) {
  loadApp = async function(){
    await __loadAppBeforePanelAnnouncement();
    await loadPanelAnnouncementText();
  };
}

const __showSectionBeforePanelAnnouncement = typeof showSection === 'function' ? showSection : null;
if (__showSectionBeforePanelAnnouncement) {
  showSection = function(name){
    const result = __showSectionBeforePanelAnnouncement(name);
    if (name === 'dashboard' || name === 'admin') {
      loadPanelAnnouncementText();
    }
    return result;
  };
}

setTimeout(loadPanelAnnouncementText, 1000);
setInterval(ensureSingleAnnouncementRibbonOriginal, 3000);

function initTopbarAnnouncementsTopbar(){
  const anunciosBtn = document.getElementById('btn-anuncios');
  const salesReportBtn = document.getElementById('btn-top-reporte-ventas');
  const modalAnuncios = document.getElementById('modal-anuncios');

  if (anunciosBtn) anunciosBtn.dataset.ready = '1';
  if (salesReportBtn) salesReportBtn.dataset.ready = '1';
  if (modalAnuncios) modalAnuncios.dataset.ready = '1';

  syncAnnouncementControlAccess();
  loadPanelAnnouncementText();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initTopbarAnnouncementsTopbar);
} else {
  initTopbarAnnouncementsTopbar();
}

window.clearAccountTraceByEmail = function(){
  const input = document.getElementById('traceEmailInput');
  const box = document.getElementById('inventoryTraceResult');
  if (input) input.value = '';
  if (box) box.innerHTML = 'Ingresa un correo para ver su historial.';
};

function formatTraceDate(value){
  if(!value) return 'Sin fecha';
  const d = new Date(value);
  if(Number.isNaN(d.getTime())) return safeText(String(value));
  return d.toLocaleString('es-MX');
}

function getTraceTime(value){
  const d = new Date(value || '');
  return Number.isNaN(d.getTime()) ? 0 : d.getTime();
}

function traceSourceLabel(source){
  const key = String(source || '').trim().toLowerCase();
  if (key === 'replacement_manual_report') return 'Reemplazo manual desde reporte de fallas';
  if (key === 'replacement_inventory_report') return 'Reemplazo desde inventario por reporte de fallas';
  if (key === 'direct_inventory') return 'Ingreso directo a inventario';
  if (!key) return 'Ingreso directo a inventario';
  return key;
}

window.loadAccountTraceByEmail = async function(){
  try{
    if(currentUser?.role !== 'admin') return;

    const input = document.getElementById('traceEmailInput');
    const box = document.getElementById('inventoryTraceResult');
    const email = String(input?.value || '').trim();

    if(!email){
      showMessage('Escribe un correo para consultar.', 'error');
      return;
    }

    if(box) box.innerHTML = '<p class="small-text">Consultando trazabilidad...</p>';

    const data = await api('/api/admin/inventory/account-trace?email=' + encodeURIComponent(email));
    const first = data?.first_sale || null;
    const accountMovements = Array.isArray(data?.account_movements) ? data.account_movements : [];
    const reportMovements = Array.isArray(data?.report_movements) ? data.report_movements : [];

    const timeline = [];

    if (first) {
      timeline.push({
        type: 'first_sale',
        timestamp: getTraceTime(first.purchased_at),
        html: `<article class="trace-card trace-first-sale"><div class="trace-head"><span class="trace-badge">Primera venta</span><span class="trace-date">${safeText(formatTraceDate(first.purchased_at))}</span></div><h4 class="trace-title">Pedido #${first.order_id || 'N/A'} vendido por primera vez</h4><p class="trace-line"><b>Vendedor/cliente:</b> ${safeText(first.sold_to_name || 'N/A')} (${safeText(first.sold_to_email || 'N/A')})</p><p class="trace-line"><b>Cuenta:</b> ${safeText(first.account_email || email)} | <b>Perfil:</b> ${safeText(first.profile_name || 'Sin perfil')}</p><p class="trace-line"><b>Plataforma:</b> ${safeText(first.platform || first.product_name || 'Sin plataforma')}</p><p class="trace-line"><b>Ingreso a inventario (admin):</b> ${safeText(formatTraceDate(first.inventory_created_at))}</p><p class="trace-line"><b>Origen de ingreso:</b> ${safeText(traceSourceLabel(first.inventory_entry_source))}</p><p class="trace-line"><b>Vence cuenta madre (30 días):</b> ${safeText(formatTraceDate(first.mother_expires_at_30d))}</p><p class="trace-line"><b>Vence vendedor (28 días desde compra):</b> ${safeText(formatTraceDate(first.seller_expires_at_28d))}</p></article>`
      });
    }

    accountMovements.forEach((m) => {
      const eventDate = m.inventory_created_at || m.created_at || m.delivered_at || m.order_created_at;
      timeline.push({
        type: 'account',
        timestamp: getTraceTime(eventDate),
        html: `<article class="trace-card"><div class="trace-head"><span class="trace-badge">Inventario</span><span class="trace-date">${safeText(formatTraceDate(eventDate))}</span></div><h4 class="trace-title">Ingreso/movimiento de cuenta #${m.account_id || 'N/A'}</h4><p class="trace-line"><b>Estado:</b> ${safeText(m.status || 'N/A')}</p><p class="trace-line"><b>Correo:</b> ${safeText(m.account_email || '')}</p><p class="trace-line"><b>Perfil:</b> ${safeText(m.profile_name || 'N/A')} ${m.profile_pin ? `| <b>PIN:</b> ${safeText(m.profile_pin)}` : ''}</p><p class="trace-line"><b>Plataforma:</b> ${safeText(m.platform || m.product_name || m.sold_product_name || 'Sin plataforma')}</p><p class="trace-line"><b>Ingreso a inventario (admin):</b> ${safeText(formatTraceDate(m.inventory_created_at || m.created_at))}</p><p class="trace-line"><b>Origen de ingreso:</b> ${safeText(traceSourceLabel(m.inventory_entry_source))}</p><p class="trace-line"><b>Vence cuenta madre (30 días):</b> ${safeText(formatTraceDate(m.mother_expires_at_30d))}</p><p class="trace-line"><b>Pedido:</b> #${m.order_id || 'N/A'} | <b>Vendedor:</b> ${safeText(m.sold_to_name || 'Sin asignar')} (${safeText(m.sold_to_email || 'N/A')})</p><p class="trace-line"><b>Vence vendedor (28 días desde compra):</b> ${safeText(formatTraceDate(m.seller_expires_at_28d))}</p></article>`
      });
    });

    reportMovements.forEach((r) => {
      const eventDate = r.reviewed_at || r.report_created_at || r.order_created_at;
      timeline.push({
        type: 'report',
        timestamp: getTraceTime(eventDate),
        html: `<article class="trace-card trace-report"><div class="trace-head"><span class="trace-badge">Reporte / reemplazo</span><span class="trace-date">${safeText(formatTraceDate(eventDate))}</span></div><h4 class="trace-title">Reporte #${r.report_id || 'N/A'} en pedido #${r.order_id || 'N/A'}</h4><p class="trace-line"><b>Tipo:</b> ${safeText(r.issue_type || 'N/A')} | <b>Estado:</b> ${safeText(r.report_status || 'N/A')}</p><p class="trace-line"><b>Resolución:</b> ${safeText(r.resolution_type || 'Sin resolución')}</p><p class="trace-line"><b>Correo reportado:</b> ${safeText(r.reported_email || 'N/A')}</p><p class="trace-line"><b>Perfil reemplazado:</b> ${safeText(r.failed_profile_name || 'No identificado')}</p><p class="trace-line"><b>Cuenta nueva:</b> ${safeText(r.report_account_email || 'No identificado')} | <b>Perfil nuevo:</b> ${safeText(r.report_account_profile || 'No identificado')}</p><p class="trace-line"><b>Ingreso inventario cuenta nueva:</b> ${safeText(formatTraceDate(r.replacement_inventory_created_at))}</p><p class="trace-line"><b>Origen de ingreso cuenta nueva:</b> ${safeText(traceSourceLabel(r.replacement_entry_source))}</p><p class="trace-line"><b>Vence cuenta madre nueva (30 días):</b> ${safeText(formatTraceDate(r.replacement_mother_expires_at_30d))}</p><p class="trace-line"><b>Vendedor asociado:</b> ${safeText(r.sold_to_name || r.reporter_name || 'N/A')} (${safeText(r.sold_to_email || r.reporter_email || 'N/A')})</p><p class="trace-line"><b>Vence vendedor (28 días desde compra):</b> ${safeText(formatTraceDate(r.seller_expires_at_28d))}</p></article>`
      });
    });

    timeline.sort((a, b) => a.timestamp - b.timestamp);

    if(box){
      box.innerHTML = timeline.length
        ? `<div class="trace-summary"><b>Correo consultado:</b> ${safeText(email)}<br><span class="small-text">Eventos detectados: ${timeline.length} | Inventario: ${accountMovements.length} | Reportes: ${reportMovements.length}</span></div><div class="trace-timeline">${timeline.map(item => item.html).join('')}</div>`
        : '<p class="small-text">No se encontraron movimientos para ese correo dentro del alcance de este panel.</p>';
    }

    showMessage(`Trazabilidad cargada: ${accountMovements.length} movimiento(s) de inventario y ${reportMovements.length} reporte(s).`);
  }catch(e){
    showMessage(e.message || 'Error consultando trazabilidad', 'error');
    const box = document.getElementById('inventoryTraceResult');
    if (box) box.innerHTML = '<p class="small-text error">No se pudo cargar la trazabilidad.</p>';
  }
};