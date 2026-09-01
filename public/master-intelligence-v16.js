(function(){
  'use strict';

  const esc=v=>typeof safeText==='function'?safeText(v):String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=v=>Number(v||0).toLocaleString('es-MX',{minimumFractionDigits:2,maximumFractionDigits:2});
  const isMain=()=>typeof isMainAdminPrincipal==='function'&&isMainAdminPrincipal();
  const mxToday=()=>{
    const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/Mexico_City',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).reduce((a,p)=>(a[p.type]=p.value,a),{});
    return `${parts.year}-${parts.month}-${parts.day}`;
  };
  const monthStart=()=>mxToday().slice(0,8)+'01';
  const fmtDate=v=>{if(!v)return '—';const s=String(v).slice(0,10);return s.split('-').reverse().join('/');};
  const signedMoney=v=>`${Number(v||0)>=0?'':'-'}$${money(Math.abs(Number(v||0)))}`;

  function ensureV16UI(){
    if(!isMain())return;
    const modules=document.querySelector('#masterOperationsPanel .master-module-grid');
    if(modules&&!document.getElementById('masterIntelligenceModule')){
      const btn=document.createElement('button');
      btn.id='masterIntelligenceModule';btn.className='master-module master-module-intelligence';
      btn.innerHTML='<span class="master-module-icon">🧠</span><span><b>Inteligencia</b><small>Stock, caja y utilidad neta</small></span><em id="masterIntelligenceRisk">0</em>';
      btn.onclick=openMasterIntelligence;
      modules.appendChild(btn);
    }
    if(modules&&!document.getElementById('masterRefundsModule')){
      const btn=document.createElement('button');
      btn.id='masterRefundsModule';btn.className='master-module master-module-refunds';
      btn.innerHTML='<span class="master-module-icon">↩️</span><span><b>Reembolsos</b><small>Pedidos, montos y origen</small></span><em id="masterRefundsBadge">0</em>';
      btn.onclick=openMasterRefunds;
      modules.appendChild(btn);
    }

    const admin=document.getElementById('section-admin');
    if(admin&&!document.getElementById('masterIntelligencePanel')){
      const panel=document.createElement('div');
      panel.id='masterIntelligencePanel';panel.className='panel master-data-panel master-intelligence-panel';
      panel.innerHTML=`
        <div class="panel-head master-intelligence-head">
          <div><div class="master-kicker">MASTER V1.6</div><h2>Inteligencia de inventario y finanzas</h2><p class="small-text">Pronóstico de stock, utilidad neta, gastos reales y conciliación de saldos.</p></div>
          <div class="master-intelligence-period">
            <label>Desde<input id="masterFinanceStart" type="date"/></label>
            <label>Hasta<input id="masterFinanceEnd" type="date"/></label>
            <button class="outline-btn" type="button" onclick="loadMasterIntelligence(true)">Actualizar</button>
          </div>
        </div>

        <div id="masterFinanceKpis" class="master-finance-kpis"><div class="small-text">Cargando resumen financiero…</div></div>
        <div id="masterFinanceExplain" class="master-finance-explain"></div>

        <div class="master-intelligence-grid">
          <section class="master-intelligence-block master-intelligence-stock">
            <div class="master-v14-subhead"><div><h3>🧠 Pronóstico de inventario</h3><span>Velocidad 7/30 días · objetivo de cobertura: 7 días</span></div><button class="outline-btn" type="button" onclick="openMasterSuppliers()">Ver proveedores</button></div>
            <div id="masterInventoryForecast"><div class="small-text">Calculando velocidad de venta…</div></div>
          </section>

          <section class="master-intelligence-block">
            <div class="master-v14-subhead"><div><h3>⚖️ Conciliación de saldos</h3><span>Saldo actual vs. último movimiento del libro maestro</span></div><button class="outline-btn" type="button" onclick="loadMasterBalanceReconciliation()">Revisar</button></div>
            <div id="masterBalanceRecon"><div class="small-text">Revisando saldos…</div></div>
          </section>
        </div>

        <section class="master-intelligence-block master-cash-block">
          <div class="master-v14-subhead"><div><h3>💵 Caja y gastos administrativos</h3><span>Registra gastos reales del negocio e ingresos extraordinarios.</span></div></div>
          <div class="master-v16-callout"><b>Las compras registradas en Proveedores ya aparecen como inversión en inventario.</b><span>No las registres otra vez como gasto que afecta utilidad, para evitar descontarlas dos veces.</span></div>
          <form id="masterCashForm" class="master-v16-cash-form">
            <label>Fecha<input id="masterCashDate" type="date" required/></label>
            <label>Tipo<select id="masterCashType"><option value="gasto">Gasto</option><option value="ingreso">Ingreso</option></select></label>
            <label>Categoría<select id="masterCashCategory"><option value="servidor">Servidor / hosting</option><option value="dominio">Dominio</option><option value="publicidad">Publicidad</option><option value="comisiones">Comisiones</option><option value="impuestos">Impuestos</option><option value="oficina">Oficina</option><option value="transporte">Transporte</option><option value="otro_ingreso">Otro ingreso</option><option value="retiro_dueno">Retiro del dueño</option><option value="otros">Otros</option></select></label>
            <label>Monto<input id="masterCashAmount" type="number" min="0.01" step="0.01" required/></label>
            <label>Forma de pago<input id="masterCashPayment" placeholder="Transferencia, efectivo…"/></label>
            <label>Proveedor<select id="masterCashSupplier"><option value="">No aplica</option></select></label>
            <label class="master-v16-cash-description">Descripción<input id="masterCashDescription" placeholder="Ej. Railway septiembre, publicidad Facebook…" required/></label>
            <label class="master-v16-profit-check"><input id="masterCashAffectsProfit" type="checkbox" checked/> Afecta la utilidad neta</label>
            <label class="master-v16-cash-notes">Notas<input id="masterCashNotes" placeholder="Opcional"/></label>
            <button class="primary-btn master-v16-save-cash" type="submit">Guardar movimiento</button>
          </form>
          <div id="masterCashMovements"><div class="small-text">Cargando movimientos…</div></div>
        </section>`;
      admin.appendChild(panel);
      panel.querySelector('#masterCashForm')?.addEventListener('submit',saveMasterCashMovement);
    }
    if(admin&&!document.getElementById('masterRefundsPanel')){
      const panel=document.createElement('div');
      panel.id='masterRefundsPanel';panel.className='panel master-data-panel master-refunds-panel';
      panel.innerHTML=`
        <div class="panel-head master-refunds-head">
          <div><div class="master-kicker">CONTROL FINANCIERO</div><h2>↩️ Reembolsos</h2><p class="small-text">Historial de dinero devuelto: pedido, comprador, distribuidor, producto, reporte y tipo de reembolso.</p></div>
          <div class="master-intelligence-period">
            <label>Desde<input id="masterRefundStart" type="date"/></label>
            <label>Hasta<input id="masterRefundEnd" type="date"/></label>
            <button class="outline-btn" type="button" onclick="loadMasterRefunds(true)">Actualizar</button>
          </div>
        </div>
        <div id="masterRefundSummary" class="master-refund-summary"></div>
        <div id="masterRefundList"><div class="small-text">Abre este módulo para cargar los reembolsos.</div></div>`;
      admin.appendChild(panel);
    }
    const start=document.getElementById('masterFinanceStart'),end=document.getElementById('masterFinanceEnd'),date=document.getElementById('masterCashDate');
    const refundStart=document.getElementById('masterRefundStart'),refundEnd=document.getElementById('masterRefundEnd');
    if(start&&!start.value)start.value=monthStart();if(end&&!end.value)end.value=mxToday();if(date&&!date.value)date.value=mxToday();
    if(refundStart&&!refundStart.value)refundStart.value=monthStart();if(refundEnd&&!refundEnd.value)refundEnd.value=mxToday();
  }

  async function openMasterIntelligence(){
    ensureV16UI();
    if(typeof showSection==='function')showSection('admin');
    setTimeout(()=>document.getElementById('masterIntelligencePanel')?.scrollIntoView({behavior:'auto',block:'start'}),80);
    await loadMasterIntelligence(false);
  }
  window.openMasterIntelligence=openMasterIntelligence;

  async function openMasterRefunds(){
    ensureV16UI();
    if(typeof showSection==='function')showSection('admin');
    setTimeout(()=>document.getElementById('masterRefundsPanel')?.scrollIntoView({behavior:'auto',block:'start'}),90);
    await loadMasterRefunds(false);
  }
  window.openMasterRefunds=openMasterRefunds;

  async function loadMasterRefunds(feedback=false){
    if(!isMain())return;
    ensureV16UI();
    const start=document.getElementById('masterRefundStart')?.value||monthStart();
    const end=document.getElementById('masterRefundEnd')?.value||mxToday();
    const box=document.getElementById('masterRefundList'),summary=document.getElementById('masterRefundSummary');
    try{
      const data=await api(`/api/admin/master/refunds?start_date=${encodeURIComponent(start)}&end_date=${encodeURIComponent(end)}&limit=200`);
      const rows=data?.rows||[],sum=data?.summary||{};
      const badge=document.getElementById('masterRefundsBadge');if(badge)badge.textContent=Number(sum.refunds||0);
      if(summary)summary.innerHTML=`<span><b>${Number(sum.refunds||0)}</b><small>pedido(s) con reembolso</small></span><span><b>-$${money(sum.amount)}</b><small>total devuelto</small></span><span><b>${esc(start.split('-').reverse().join('/'))}</b><small>desde</small></span><span><b>${esc(end.split('-').reverse().join('/'))}</b><small>hasta</small></span>`;
      if(box)box.innerHTML=rows.length?`<div class="master-refund-list">${rows.map(r=>`<article class="master-refund-item"><div class="master-refund-order"><span>Pedido</span><b>#${Number(r.order_id||0)}</b><small>${esc(r.refund_type||'Reembolso')}</small></div><div><span>Comprador</span><b>${esc(r.customer_name||'Usuario')}</b><small>${esc(r.customer_type||'')} · ${esc(r.customer_email||'')}</small>${r.distributor_name?`<small>Distribuidor: ${esc(r.distributor_name)}</small>`:''}</div><div><span>Producto</span><b>${esc(r.product_name||'Producto')}</b><small>${esc(r.product_category||'')}</small></div><div><span>Monto</span><b class="master-negative">-$${money(r.refund_amount)}</b><small>Venta original $${money(r.amount)}</small></div><div><span>Origen</span><b>${Array.isArray(r.report_ids)&&r.report_ids.length?`Reporte #${r.report_ids.join(', #')}`:'Pedido'}</b><small>${esc(r.resolution_types||r.movement_types||'Reembolso administrativo')}</small></div><div><span>Fecha</span><b>${esc(new Date(r.refund_at_mx||r.refund_at).toLocaleString('es-MX',{timeZone:'America/Mexico_City'}))}</b></div><div class="master-refund-actions"><button class="outline-btn" onclick="openOrdersFromDashboard()">Ver pedidos</button>${Array.isArray(r.report_ids)&&r.report_ids.length?'<button class="outline-btn" onclick="openAccountReportsFromDashboard()">Ver fallas</button>':''}</div></article>`).join('')}</div>`:'<div class="master-v14-empty">No hay reembolsos en el periodo seleccionado.</div>';
      if(feedback&&typeof showMessage==='function')showMessage('Reembolsos actualizados');
    }catch(e){if(box)box.innerHTML=`<div class="master-v14-error">${esc(e.message||'No se pudieron cargar los reembolsos')}</div>`;}
  }
  window.loadMasterRefunds=loadMasterRefunds;

  function periodQuery(){
    const start=document.getElementById('masterFinanceStart')?.value||monthStart();
    const end=document.getElementById('masterFinanceEnd')?.value||mxToday();
    return {start,end,qs:`start_date=${encodeURIComponent(start)}&end_date=${encodeURIComponent(end)}`};
  }

  async function loadMasterIntelligence(feedback=false){
    if(!isMain())return;
    ensureV16UI();
    const {qs}=periodQuery();
    try{
      const [forecast,finance,recon,cash,suppliers]=await Promise.all([
        api('/api/admin/master/inventory-intelligence'),
        api('/api/admin/master/finance-summary?'+qs),
        api('/api/admin/master/balance-reconciliation'),
        api('/api/admin/master/cash-movements?'+qs+'&limit=120'),
        api('/api/admin/master/suppliers').catch(()=>({suppliers:[]}))
      ]);
      renderForecast(forecast);renderFinance(finance);renderReconciliation(recon);renderCash(cash);fillCashSuppliers(suppliers?.suppliers||[]);
      const badge=document.getElementById('masterIntelligenceRisk');if(badge)badge.textContent=Number(forecast?.risk_count||0);
      if(feedback&&typeof showMessage==='function')showMessage('Inteligencia y finanzas actualizadas');
    }catch(e){
      const box=document.getElementById('masterFinanceKpis');if(box)box.innerHTML=`<div class="master-v14-error">${esc(e.message||'No se pudo cargar V1.6')}</div>`;
    }
  }
  window.loadMasterIntelligence=loadMasterIntelligence;

  function renderFinance(data){
    const s=data?.summary||{},box=document.getElementById('masterFinanceKpis'),explain=document.getElementById('masterFinanceExplain');
    if(box)box.innerHTML=`
      <article class="master-finance-kpi"><small>Ingreso admin</small><b>$${money(s.admin_revenue)}</b><span>Después de reembolsos y ganancia de distribuidores</span></article>
      <button class="master-finance-kpi master-finance-refunds" type="button" onclick="openMasterRefunds()"><small>Reembolsos</small><b>-$${money(s.refunds)}</b><span>${Number(s.refund_orders||0)} pedido(s) · ver detalle</span></button>
      <article class="master-finance-kpi"><small>Costo vendido</small><b>$${money(s.sale_cost)}</b><span>Inventario consumido en ${Number(s.orders||0)} pedido(s)</span></article>
      <article class="master-finance-kpi"><small>Reemplazos</small><b>$${money(s.replacement_cost)}</b><span>${Number(s.replacements||0)} reemplazo(s) con costo</span></article>
      <article class="master-finance-kpi"><small>Gastos operativos</small><b>$${money(s.operating_expenses)}</b><span>Sólo movimientos que afectan utilidad</span></article>
      <article class="master-finance-kpi master-finance-net ${Number(s.net_profit||0)<0?'negative':'positive'}"><small>Utilidad neta</small><b>${signedMoney(s.net_profit)}</b><span>Margen ${Number(s.margin_percent||0).toFixed(2)}%</span></article>
      <article class="master-finance-kpi"><small>Inversión en inventario</small><b>$${money(s.inventory_investment)}</b><span>${Number(s.inventory_purchases||0)} compra(s) · no se duplica en utilidad</span></article>`;
    if(explain)explain.innerHTML=`<span><b>Resultado operativo:</b> ${signedMoney(s.operating_profit)}</span><span><b>Otros ingresos:</b> +$${money(s.other_income)}</span><span><b>Reembolsos:</b> -$${money(s.refunds)}</span><span><b>Ganancia distribuidores:</b> -$${money(s.distributor_earnings)}</span><span><b>Caja manual registrada:</b> ${signedMoney(s.manual_cash_balance)}</span>`;
  }

  function riskChip(row){
    const cls=['sin_stock','critico'].includes(row.risk)?'danger':row.risk==='alto'?'warn':row.risk==='medio'?'watch':row.risk==='estable'?'ok':'muted';
    return `<span class="master-stock-risk ${cls}">${esc(row.risk_label||row.risk)}</span>`;
  }
  function renderForecast(data){
    const box=document.getElementById('masterInventoryForecast');if(!box)return;const rows=data?.rows||[];
    if(!rows.length){box.innerHTML='<div class="master-v14-empty">No hay productos con control de stock activo.</div>';return;}
    box.innerHTML=`<div class="master-stock-table-wrap"><table class="master-stock-table"><thead><tr><th>Producto</th><th>Stock</th><th>Vendidos 7d</th><th>Prom./día</th><th>Cobertura</th><th>Tendencia</th><th>Comprar</th><th>Riesgo</th></tr></thead><tbody>${rows.map(r=>`<tr><td><b>${esc(r.name)}</b><small>${esc(r.category||'')}</small></td><td><b>${Number(r.current_stock||0)}</b></td><td>${Number(r.sold_7d||0)}</td><td>${Number(r.demand_rate||0).toFixed(2)}</td><td>${r.coverage_days===null?'—':`${Number(r.coverage_days).toFixed(1)} días`}</td><td class="${Number(r.trend_percent||0)>20?'master-trend-up':''}">${Number(r.trend_percent||0)>0?'+':''}${Number(r.trend_percent||0).toFixed(1)}%</td><td><b>${Number(r.suggested_purchase_7d||0)}</b><small>para 7 días</small></td><td>${riskChip(r)}</td></tr>`).join('')}</tbody></table></div>`;
  }

  function renderReconciliation(data){
    const box=document.getElementById('masterBalanceRecon');if(!box)return;const s=data?.summary||{},rows=data?.rows||[];
    const issues=rows.filter(r=>r.status!=='correcto').slice(0,30);
    box.innerHTML=`<div class="master-recon-summary"><span class="ok"><b>${Number(s.correct||0)}</b><small>correctos</small></span><span class="${Number(s.mismatch||0)?'danger':''}"><b>${Number(s.mismatch||0)}</b><small>con diferencia</small></span><span><b>${Number(s.no_history||0)}</b><small>sin historial Master</small></span></div>${issues.length?`<div class="master-recon-list">${issues.map(r=>`<article class="master-recon-item ${r.status}"><div><b>${esc(r.name||r.email||`Usuario #${r.id}`)}</b><small>${esc(r.email||'')} · saldo $${money(r.balance)}</small></div><div>${r.status==='sin_historial'?'<span class="master-recon-chip muted">Sin historial</span>':`<span class="master-recon-chip danger">Diferencia ${signedMoney(r.difference)}</span><small>Libro $${money(r.ledger_balance)}${Number(r.continuity_breaks||0)?` · ${Number(r.continuity_breaks)} salto(s)`:''}</small>`}</div>${typeof window.openMasterUser360==='function'?`<button class="outline-btn" onclick="openMasterUser360(${Number(r.id)})">Ver usuario</button>`:''}</article>`).join('')}</div>`:'<div class="master-ok"><span>✓</span><div><b>Saldos conciliados</b><small>No se detectaron diferencias en usuarios con libro maestro.</small></div></div>'}`;
  }

  async function loadMasterBalanceReconciliation(){
    try{const d=await api('/api/admin/master/balance-reconciliation');renderReconciliation(d);if(typeof showMessage==='function')showMessage('Conciliación actualizada');}catch(e){if(typeof showMessage==='function')showMessage(e.message||'No se pudo conciliar',true);}
  }
  window.loadMasterBalanceReconciliation=loadMasterBalanceReconciliation;

  function fillCashSuppliers(rows){
    const select=document.getElementById('masterCashSupplier');if(!select)return;const current=select.value;
    select.innerHTML='<option value="">No aplica</option>'+rows.filter(x=>x.id).map(x=>`<option value="${Number(x.id)}">${esc(x.name)}</option>`).join('');
    if([...select.options].some(o=>o.value===current))select.value=current;
  }

  function renderCash(data){
    const box=document.getElementById('masterCashMovements');if(!box)return;const rows=data?.rows||[];
    if(!rows.length){box.innerHTML='<div class="master-v14-empty">No hay movimientos manuales de caja en este periodo.</div>';return;}
    box.innerHTML=`<div class="table-wrap"><table class="mini-table master-cash-table"><thead><tr><th>Fecha</th><th>Tipo</th><th>Categoría</th><th>Descripción</th><th>Proveedor</th><th>Monto</th><th>Utilidad</th><th></th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(fmtDate(r.movement_date))}</td><td><span class="master-cash-type ${esc(r.movement_type)}">${r.movement_type==='ingreso'?'Ingreso':'Gasto'}</span></td><td>${esc(String(r.category||'otros').replaceAll('_',' '))}</td><td><b>${esc(r.description||'')}</b>${r.payment_method?`<br><small>${esc(r.payment_method)}</small>`:''}</td><td>${esc(r.supplier_name||r.supplier_name_snapshot||'—')}</td><td class="${r.movement_type==='ingreso'?'master-positive':'master-negative'}"><b>${r.movement_type==='ingreso'?'+':'-'}$${money(r.amount)}</b></td><td>${r.affects_profit?'<span class="master-recon-chip ok">Sí</span>':'<span class="master-recon-chip muted">No</span>'}</td><td><button class="master-delete-cash" onclick="deleteMasterCashMovement(${Number(r.id)})" title="Eliminar">×</button></td></tr>`).join('')}</tbody></table></div>`;
  }

  async function saveMasterCashMovement(ev){
    ev.preventDefault();
    const payload={movement_date:document.getElementById('masterCashDate').value,movement_type:document.getElementById('masterCashType').value,category:document.getElementById('masterCashCategory').value,amount:Number(document.getElementById('masterCashAmount').value),payment_method:document.getElementById('masterCashPayment').value,description:document.getElementById('masterCashDescription').value,supplier_id:document.getElementById('masterCashSupplier').value||null,affects_profit:document.getElementById('masterCashAffectsProfit').checked,notes:document.getElementById('masterCashNotes').value};
    try{await api('/api/admin/master/cash-movements',{method:'POST',body:JSON.stringify(payload)});ev.target.reset();document.getElementById('masterCashDate').value=mxToday();document.getElementById('masterCashType').value='gasto';document.getElementById('masterCashAffectsProfit').checked=true;await loadMasterIntelligence(false);if(typeof showMessage==='function')showMessage('Movimiento de caja registrado');}catch(e){if(typeof showMessage==='function')showMessage(e.message||'No se pudo guardar',true);}
  }

  async function deleteMasterCashMovement(id){
    if(!confirm('¿Eliminar este movimiento de caja? La acción quedará en la bitácora administrativa.'))return;
    try{await api('/api/admin/master/cash-movements/'+Number(id),{method:'DELETE'});await loadMasterIntelligence(false);if(typeof showMessage==='function')showMessage('Movimiento eliminado');}catch(e){if(typeof showMessage==='function')showMessage(e.message||'No se pudo eliminar',true);}
  }
  window.deleteMasterCashMovement=deleteMasterCashMovement;

  function init(){
    ensureV16UI();
    if(isMain()){
      api('/api/admin/master/inventory-intelligence').then(d=>{const b=document.getElementById('masterIntelligenceRisk');if(b)b.textContent=Number(d.risk_count||0);}).catch(()=>{});
      api(`/api/admin/master/refunds?start_date=${encodeURIComponent(monthStart())}&end_date=${encodeURIComponent(mxToday())}&limit=1`).then(d=>{const b=document.getElementById('masterRefundsBadge');if(b)b.textContent=Number(d?.summary?.refunds||0);}).catch(()=>{});
    }
  }
  if(typeof registerLoadAppHook==='function')registerLoadAppHook(async()=>init(),{name:'master-intelligence-v1-6',order:995});
  if(typeof registerSectionHook==='function')registerSectionHook(name=>{if((name==='dashboard'||name==='admin')&&isMain())setTimeout(init,30);});
})();
