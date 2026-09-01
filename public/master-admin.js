(function(){
  'use strict';

  const money = value => Number(value || 0).toLocaleString('es-MX', { minimumFractionDigits:2, maximumFractionDigits:2 });
  const esc = value => typeof safeText === 'function' ? safeText(value) : String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const formatAge = minutes => {
    const n=Number(minutes||0);
    if(n < 60) return `${n} min`;
    const h=Math.floor(n/60), m=n%60;
    if(h < 24) return `${h} h${m ? ` ${m} min` : ''}`;
    return `${Math.floor(h/24)} d ${h%24} h`;
  };
  const isMain = () => typeof isMainAdminPrincipal === 'function' && isMainAdminPrincipal();

  function ensureSecurityNotice(){
    let banner=document.getElementById('masterSecurityNotice');
    if(!currentUser?.must_change_password){ banner?.remove(); return; }
    if(banner) return;
    banner=document.createElement('div');
    banner.id='masterSecurityNotice';
    banner.className='master-security-notice';
    banner.innerHTML=`<b>🔐 Contraseña temporal activa.</b> Cambia tu contraseña desde <button type="button" onclick="showSection('account')">Mi cuenta</button> antes de continuar usando el sistema.`;
    const app=document.getElementById('appSection');
    if(app) app.insertBefore(banner, app.firstChild);
  }

  function openAdminPanelsMaster(){
    if(typeof ensureAdminPanelsPhase1UI === 'function') ensureAdminPanelsPhase1UI();
    if(typeof showSection === 'function') showSection('admin');
    if(typeof loadAdminPanelsPhase1 === 'function') loadAdminPanelsPhase1();
    setTimeout(()=>document.getElementById('adminPanelsPanelPhase1')?.scrollIntoView({behavior:'smooth',block:'start'}),100);
  }
  window.openAdminPanelsMaster=openAdminPanelsMaster;

  function bindStatMirror(sourceId,targetId){
    const target=document.getElementById(targetId);
    if(!target) return;
    const bind=()=>{
      const source=document.getElementById(sourceId);
      if(!source) return false;
      const copy=()=>{ target.textContent=(source.textContent||'0').trim() || '0'; };
      copy();
      if(source.dataset.masterMirrorBound !== targetId){
        source.dataset.masterMirrorBound=targetId;
        new MutationObserver(copy).observe(source,{subtree:true,childList:true,characterData:true});
      }
      return true;
    };
    if(bind()) return;
    [250,700,1500,3000].forEach(ms=>setTimeout(bind,ms));
  }

  function bindMasterStats(){
    [
      ['statUsers','masterCountUsers'],
      ['statProducts','masterCountProducts'],
      ['statInventory','masterCountInventory'],
      ['statOrders','masterCountOrders'],
      ['statReports','masterCountReports'],
      ['statBalanceRequests','masterCountBalance'],
      ['statAdminPanelsMainFinal','masterCountPanels']
    ].forEach(([source,target])=>bindStatMirror(source,target));
  }

  function activateOwnerVisualMode(){
    const app=document.getElementById('appSection');
    const dashboard=document.getElementById('section-dashboard');
    if(!isMain()){
      app?.classList.remove('master-owner-mode');
      dashboard?.classList.remove('master-owner-dashboard');
      return;
    }
    app?.classList.add('master-owner-mode');
    dashboard?.classList.add('master-owner-dashboard');
    const home=document.querySelector('#appSection .topbar-home-btn');
    if(home && !home.dataset.masterOriginalLabel){
      home.dataset.masterOriginalLabel=home.textContent || '';
      home.textContent='🏠 Panel maestro';
    }
  }

  function ensureMasterUI(){
    if(!isMain()){
      document.getElementById('masterOperationsPanel')?.remove();
      document.getElementById('masterLedgerPanel')?.remove();
      document.getElementById('masterAuditPanel')?.remove();
      activateOwnerVisualMode();
      return;
    }

    activateOwnerVisualMode();
    const dashboard=document.getElementById('section-dashboard');
    if(dashboard && !document.getElementById('masterOperationsPanel')){
      const panel=document.createElement('div');
      panel.id='masterOperationsPanel';
      panel.className='master-command-center';
      panel.innerHTML=`
        <div class="master-command-header">
          <div class="master-command-title">
            <div class="master-brand-line"><span class="master-brand-mark">SDP</span><span>VERSIÓN MAESTRA</span></div>
            <h1>Centro de control</h1>
            <p>Vista exclusiva del administrador principal de Servicios Digitales Peters.</p>
          </div>
          <div class="master-command-controls">
            <span class="master-system-status"><i></i> Operación activa</span>
            <button class="master-refresh-btn" onclick="loadMasterOperations(true)">↻ Actualizar</button>
          </div>
        </div>

        <div id="masterOpsKpis" class="master-kpi-grid"><div class="master-loading">Cargando resumen de operación…</div></div>

        <div class="master-workspace-grid">
          <section class="master-focus-card">
            <div class="master-section-heading">
              <div><span class="master-eyebrow">OPERACIÓN</span><h2>Atención prioritaria</h2></div>
              <span class="master-section-badge">HOY</span>
            </div>
            <div id="masterUrgentList" class="master-urgent-list"><div class="master-loading">Revisando pendientes…</div></div>
          </section>

          <section class="master-focus-card master-quick-card">
            <div class="master-section-heading">
              <div><span class="master-eyebrow">ACCESOS</span><h2>Acciones del dueño</h2></div>
            </div>
            <div class="master-actions">
              <button onclick="openMasterLedger()"><span>💰</span><b>Libro de saldo</b></button>
              <button onclick="openMasterAudit()"><span>🛡️</span><b>Bitácora admin</b></button>
              <button onclick="openBalanceRequests()"><span>💳</span><b>Validar saldo</b></button>
              <button onclick="openAccountReportsFromDashboard()"><span>⚠️</span><b>Atender fallas</b></button>
            </div>
            <div id="masterOpsUpdated" class="master-updated"></div>
          </section>
        </div>

        <section class="master-management-section">
          <div class="master-section-heading master-management-heading">
            <div><span class="master-eyebrow">GESTIÓN</span><h2>Administrar el negocio</h2><p>Entradas directas a los módulos que utilizas para operar.</p></div>
          </div>
          <div class="master-module-grid">
            <button class="master-module" onclick="openUsersFromDashboard()"><span class="master-module-icon">👥</span><span><b>Usuarios</b><small>Vendedores y cuentas</small></span><em id="masterCountUsers">0</em></button>
            <button class="master-module" onclick="openProductsFromDashboard()"><span class="master-module-icon">📦</span><span><b>Productos</b><small>Catálogo y precios</small></span><em id="masterCountProducts">0</em></button>
            <button class="master-module" onclick="openInventoryFromDashboard()"><span class="master-module-icon">🔐</span><span><b>Inventario</b><small>Cuentas disponibles</small></span><em id="masterCountInventory">0</em></button>
            <button class="master-module" onclick="openOrdersFromDashboard()"><span class="master-module-icon">▤</span><span><b>Pedidos</b><small>Ventas y entregas</small></span><em id="masterCountOrders">0</em></button>
            <button class="master-module" onclick="openAccountReportsFromDashboard()"><span class="master-module-icon">⚠️</span><span><b>Reportes</b><small>Fallas y soporte</small></span><em id="masterCountReports">0</em></button>
            <button class="master-module" onclick="openBalanceRequests()"><span class="master-module-icon">💳</span><span><b>Solicitudes</b><small>Recargas por validar</small></span><em id="masterCountBalance">0</em></button>
            <button class="master-module" onclick="openAdminPanelsMaster()"><span class="master-module-icon">🏢</span><span><b>Paneles admin</b><small>Renta y propietarios</small></span><em id="masterCountPanels">0</em></button>
            <button class="master-module" onclick="showSection('profit-quality')"><span class="master-module-icon">💹</span><span><b>Rentabilidad</b><small>Costos, calidad y utilidad</small></span><i>→</i></button>
          </div>
        </section>`;
      dashboard.prepend(panel);
      bindMasterStats();
    } else {
      bindMasterStats();
    }

    const admin=document.getElementById('section-admin');
    if(admin && !document.getElementById('masterLedgerPanel')){
      const ledger=document.createElement('div');
      ledger.id='masterLedgerPanel';
      ledger.className='panel master-data-panel';
      ledger.innerHTML=`
        <div class="panel-head"><div><div class="master-kicker">CONTROL FINANCIERO</div><h2>Libro de movimientos de saldo</h2><p class="small-text">Registra compras, recargas, retiros, aprobaciones y reembolsos desde Master V1.</p></div><button class="outline-btn" style="width:auto" onclick="loadMasterLedger()">Actualizar</button></div>
        <div id="masterLedgerSummary" class="master-ledger-summary"></div>
        <div id="masterLedgerList"><div class="small-text">Abre este módulo para cargar movimientos.</div></div>`;
      admin.appendChild(ledger);
    }
    if(admin && !document.getElementById('masterAuditPanel')){
      const audit=document.createElement('div');
      audit.id='masterAuditPanel';
      audit.className='panel master-data-panel';
      audit.innerHTML=`
        <div class="panel-head"><div><div class="master-kicker">SEGURIDAD</div><h2>Bitácora administrativa</h2><p class="small-text">Quién hizo qué y cuándo. Las contraseñas nunca se guardan en esta bitácora.</p></div><button class="outline-btn" style="width:auto" onclick="loadMasterAudit()">Actualizar</button></div>
        <div id="masterAuditList"><div class="small-text">Abre este módulo para cargar la bitácora.</div></div>`;
      admin.appendChild(audit);
    }
  }

  async function loadMasterOperations(showFeedback=false){
    if(!isMain()) return;
    ensureMasterUI();
    const kpis=document.getElementById('masterOpsKpis');
    const urgent=document.getElementById('masterUrgentList');
    try{
      const d=await api('/api/admin/master/operations');
      if(kpis) kpis.innerHTML=`
        <button class="master-kpi master-kpi-money" onclick="openSalesReport()"><span class="master-kpi-top"><i>💵</i> Ventas hoy</span><b>$${money(d.sales_today?.revenue)}</b><small>${Number(d.sales_today?.orders||0)} pedidos completados</small></button>
        <button class="master-kpi master-kpi-profit" onclick="showSection('profit-quality')"><span class="master-kpi-top"><i>📈</i> Utilidad bruta</span><b>$${money(d.sales_today?.gross_profit)}</b><small>Venta menos costo registrado / producto</small></button>
        <button class="master-kpi ${Number(d.pending_orders)>0?'master-kpi-warn':''}" onclick="openOrdersFromDashboard()"><span class="master-kpi-top"><i>▤</i> Pedidos pendientes</span><b>${Number(d.pending_orders||0)}</b><small>Por atender o en proceso</small></button>
        <button class="master-kpi ${Number(d.pending_reports)>0?'master-kpi-danger':''}" onclick="openAccountReportsFromDashboard()"><span class="master-kpi-top"><i>⚠️</i> Fallas pendientes</span><b>${Number(d.pending_reports||0)}</b><small>Requieren respuesta</small></button>
        <button class="master-kpi ${Number(d.pending_balance_requests)>0?'master-kpi-warn':''}" onclick="openBalanceRequests()"><span class="master-kpi-top"><i>💳</i> Saldo por validar</span><b>${Number(d.pending_balance_requests||0)}</b><small>$${money(d.pending_balance_amount)} solicitado</small></button>
        <button class="master-kpi" onclick="openInventoryFromDashboard()"><span class="master-kpi-top"><i>🔐</i> Stock disponible</span><b>${Number(d.inventory_available||0)}</b><small>Cuentas listas para vender</small></button>
        <button class="master-kpi ${Number(d.quarantine)>0?'master-kpi-warn':''}" onclick="openInventoryFromDashboard()"><span class="master-kpi-top"><i>♻️</i> Cuarentena</span><b>${Number(d.quarantine||0)}</b><small>Cuentas por recuperar</small></button>
        <button class="master-kpi ${Number(d.mother_accounts_expiring_7d)>0?'master-kpi-warn':''}" onclick="showSection('alerts')"><span class="master-kpi-top"><i>⏰</i> Vencen en 7 días</span><b>${Number(d.mother_accounts_expiring_7d||0)}</b><small>Cuentas madre a revisar</small></button>`;

      if(urgent){
        const rows=Array.isArray(d.urgent)?d.urgent:[];
        urgent.innerHTML=rows.length ? rows.map(item=>{
          const action=item.type==='pedido' ? `openOrdersFromDashboard()` : item.type==='reporte' ? `openAccountReportsFromDashboard()` : `openBalanceRequests()`;
          return `<button class="master-urgent-item" onclick="${action}"><span class="master-urgent-icon">${item.type==='pedido'?'▤':item.type==='reporte'?'⚠️':'💳'}</span><span class="master-urgent-copy"><b>${esc(item.title)}</b><small>${esc(item.detail)}</small></span><em>${formatAge(item.age_minutes)}</em><i>→</i></button>`;
        }).join('') : '<div class="master-ok"><span>✓</span><div><b>Operación al día</b><small>No hay pendientes prioritarios en este momento.</small></div></div>';
      }
      const updated=document.getElementById('masterOpsUpdated');
      if(updated) updated.textContent=`Última actualización: ${new Date(d.generated_at || Date.now()).toLocaleString('es-MX')}`;
      bindMasterStats();
      if(showFeedback && typeof showMessage==='function') showMessage('Centro de control actualizado');
    }catch(e){
      if(kpis) kpis.innerHTML=`<div class="master-load-error">No se pudo cargar el Centro de control: ${esc(e.message||'error')}</div>`;
    }
  }
  window.loadMasterOperations=loadMasterOperations;

  async function loadMasterLedger(){
    if(!isMain()) return;
    ensureMasterUI();
    const box=document.getElementById('masterLedgerList');
    try{
      if(box) box.innerHTML='<div class="small-text">Cargando libro...</div>';
      const d=await api('/api/admin/master/balance-ledger?limit=120');
      const rows=Array.isArray(d.rows)?d.rows:[];
      const summary=document.getElementById('masterLedgerSummary');
      if(summary) summary.innerHTML=`<span>Entradas registradas <b>+$${money(d.totals?.in)}</b></span><span>Salidas registradas <b>-$${money(d.totals?.out)}</b></span><small>El libro comienza a registrar movimientos a partir de la Versión Maestra V1; no inventa movimientos históricos.</small>`;
      if(!box) return;
      if(!rows.length){ box.innerHTML='<div class="master-empty">Aún no hay movimientos registrados por Master V1.</div>'; return; }
      box.innerHTML=`<div class="table-wrap"><table class="mini-table"><thead><tr><th>Fecha</th><th>Usuario</th><th>Movimiento</th><th>Monto</th><th>Antes</th><th>Después</th><th>Referencia / nota</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(new Date(r.created_at).toLocaleString('es-MX'))}</td><td><b>${esc(r.user_name||'')}</b><br><span class="small-text">${esc(r.user_email||'')}</span></td><td>${esc(String(r.movement_type||'').replaceAll('_',' '))}</td><td class="${Number(r.amount)>=0?'master-positive':'master-negative'}">${Number(r.amount)>=0?'+':'-'}$${money(Math.abs(Number(r.amount||0)))}</td><td>$${money(r.balance_before)}</td><td><b>$${money(r.balance_after)}</b></td><td>${r.reference_id?`<b>${esc(r.reference_type||'ref')} #${esc(r.reference_id)}</b><br>`:''}<span class="small-text">${esc(r.note||'')}</span></td></tr>`).join('')}</tbody></table></div>`;
    }catch(e){ if(box) box.innerHTML=`<div class="small-text">${esc(e.message||'No se pudo cargar el libro.')}</div>`; }
  }
  window.loadMasterLedger=loadMasterLedger;

  async function loadMasterAudit(){
    if(!isMain()) return;
    ensureMasterUI();
    const box=document.getElementById('masterAuditList');
    try{
      if(box) box.innerHTML='<div class="small-text">Cargando bitácora...</div>';
      const d=await api('/api/admin/master/audit-log?limit=120');
      const rows=Array.isArray(d.rows)?d.rows:[];
      if(!box) return;
      if(!rows.length){ box.innerHTML='<div class="master-empty">Aún no hay acciones registradas por Master V1.</div>'; return; }
      box.innerHTML=`<div class="table-wrap"><table class="mini-table"><thead><tr><th>Fecha</th><th>Administrador</th><th>Acción</th><th>Elemento</th><th>Detalle</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(new Date(r.created_at).toLocaleString('es-MX'))}</td><td>${esc(r.actor_email||'Sistema')}</td><td><b>${esc(String(r.action||'').replaceAll('_',' '))}</b></td><td>${esc(r.entity_type||'')}${r.entity_id?` #${esc(r.entity_id)}`:''}</td><td>${esc(r.summary||'')}</td></tr>`).join('')}</tbody></table></div>`;
    }catch(e){ if(box) box.innerHTML=`<div class="small-text">${esc(e.message||'No se pudo cargar la bitácora.')}</div>`; }
  }
  window.loadMasterAudit=loadMasterAudit;

  function openPanel(id, loader){
    if(typeof showSection==='function') showSection('admin');
    setTimeout(()=>{
      const el=document.getElementById(id); if(el) el.scrollIntoView({behavior:'smooth',block:'start'});
      if(typeof loader==='function') loader();
    },80);
  }
  window.openMasterLedger=()=>openPanel('masterLedgerPanel',loadMasterLedger);
  window.openMasterAudit=()=>openPanel('masterAuditPanel',loadMasterAudit);

  if(typeof registerLoadAppHook==='function'){
    registerLoadAppHook(async function masterAdminLoadHook(){
      ensureSecurityNotice();
      ensureMasterUI();
      if(isMain()) await loadMasterOperations(false);
    }, {name:'master-admin-v1-1',order:950});
  }
  if(typeof registerSectionHook==='function'){
    registerSectionHook(function masterAdminSectionHook(name){
      if(name==='dashboard' && isMain()){
        ensureMasterUI();
        loadMasterOperations(false);
      }
      if(name==='admin' && isMain()) ensureMasterUI();
    });
  }
})();
