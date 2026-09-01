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

  function ensureMasterUI(){
    if(!isMain()){
      document.getElementById('masterOperationsPanel')?.remove();
      document.getElementById('masterLedgerPanel')?.remove();
      document.getElementById('masterAuditPanel')?.remove();
      return;
    }

    const dashboard=document.getElementById('section-dashboard');
    if(dashboard && !document.getElementById('masterOperationsPanel')){
      const panel=document.createElement('div');
      panel.id='masterOperationsPanel';
      panel.className='panel master-operations-panel';
      panel.innerHTML=`
        <div class="panel-head master-head">
          <div>
            <div class="master-kicker">VERSIÓN MAESTRA</div>
            <h2>Centro de operaciones</h2>
            <p class="small-text">Lo que requiere tu atención hoy, sin buscarlo módulo por módulo.</p>
          </div>
          <button class="outline-btn" style="width:auto" onclick="loadMasterOperations(true)">Actualizar</button>
        </div>
        <div id="masterOpsKpis" class="master-kpi-grid"><div class="small-text">Cargando operación...</div></div>
        <div class="master-two-col">
          <div>
            <h3>🚨 Atención prioritaria</h3>
            <div id="masterUrgentList" class="master-urgent-list"><div class="small-text">Revisando pendientes...</div></div>
          </div>
          <div>
            <h3>⚡ Accesos rápidos del dueño</h3>
            <div class="master-actions">
              <button onclick="openMasterLedger()">💰 Libro de saldo</button>
              <button onclick="openMasterAudit()">🛡️ Bitácora admin</button>
              <button onclick="openBalanceRequests()">💳 Solicitudes de saldo</button>
              <button onclick="openAccountReportsFromDashboard()">⚠️ Reportes de falla</button>
              <button onclick="openInventoryFromDashboard()">🔐 Inventario</button>
              <button onclick="openOrdersFromDashboard()">▤ Pedidos</button>
            </div>
            <div id="masterOpsUpdated" class="small-text master-updated"></div>
          </div>
        </div>`;
      const charts=document.getElementById('dashboardChartsPanel');
      if(charts) dashboard.insertBefore(panel, charts); else dashboard.appendChild(panel);
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
        <div class="master-kpi"><span>💵 Ventas hoy</span><b>$${money(d.sales_today?.revenue)}</b><small>${Number(d.sales_today?.orders||0)} pedidos</small></div>
        <div class="master-kpi"><span>📈 Utilidad bruta hoy</span><b>$${money(d.sales_today?.gross_profit)}</b><small>Venta − costo registrado</small></div>
        <div class="master-kpi ${Number(d.pending_orders)>0?'warn':''}"><span>▤ Pedidos pendientes</span><b>${Number(d.pending_orders||0)}</b><small>Por atender / proceso</small></div>
        <div class="master-kpi ${Number(d.pending_reports)>0?'danger':''}"><span>⚠️ Fallas pendientes</span><b>${Number(d.pending_reports||0)}</b><small>Requieren respuesta</small></div>
        <div class="master-kpi ${Number(d.pending_balance_requests)>0?'warn':''}"><span>💳 Saldo por validar</span><b>${Number(d.pending_balance_requests||0)}</b><small>$${money(d.pending_balance_amount)} solicitado</small></div>
        <div class="master-kpi"><span>🔐 Stock disponible</span><b>${Number(d.inventory_available||0)}</b><small>Cuentas listas</small></div>
        <div class="master-kpi ${Number(d.quarantine)>0?'warn':''}"><span>♻️ Cuarentena</span><b>${Number(d.quarantine||0)}</b><small>Cuentas por recuperar</small></div>
        <div class="master-kpi ${Number(d.mother_accounts_expiring_7d)>0?'warn':''}"><span>⏰ Vencen en 7 días</span><b>${Number(d.mother_accounts_expiring_7d||0)}</b><small>Cuentas madre</small></div>`;

      if(urgent){
        const rows=Array.isArray(d.urgent)?d.urgent:[];
        urgent.innerHTML=rows.length ? rows.map(item=>{
          const action=item.type==='pedido' ? `openOrdersFromDashboard()` : item.type==='reporte' ? `openAccountReportsFromDashboard()` : `openBalanceRequests()`;
          return `<button class="master-urgent-item" onclick="${action}"><span><b>${esc(item.title)}</b><small>${esc(item.detail)}</small></span><em>${formatAge(item.age_minutes)}</em></button>`;
        }).join('') : '<div class="master-ok">✅ No hay pendientes prioritarios en este momento.</div>';
      }
      const updated=document.getElementById('masterOpsUpdated');
      if(updated) updated.textContent=`Actualizado: ${new Date(d.generated_at || Date.now()).toLocaleString('es-MX')}`;
      if(showFeedback && typeof showMessage==='function') showMessage('Centro de operaciones actualizado');
    }catch(e){
      if(kpis) kpis.innerHTML=`<div class="small-text">No se pudo cargar el Centro de operaciones: ${esc(e.message||'error')}</div>`;
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
    }, {name:'master-admin-v1',order:950});
  }
  if(typeof registerSectionHook==='function'){
    registerSectionHook(function masterAdminSectionHook(name){
      if(name==='dashboard' && isMain()) loadMasterOperations(false);
      if(name==='admin' && isMain()) ensureMasterUI();
    });
  }
})();
