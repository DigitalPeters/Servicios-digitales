(function(){
  'use strict';
  const esc=v=>typeof safeText==='function'?safeText(v):String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=v=>Number(v||0).toLocaleString('es-MX',{minimumFractionDigits:2,maximumFractionDigits:2});
  const pct=v=>`${Number(v||0).toFixed(1)}%`;
  const isMain=()=>typeof isMainAdminPrincipal==='function'&&isMainAdminPrincipal();
  const today=()=>new Date().toISOString().slice(0,10);
  const ago=(days)=>{const d=new Date();d.setDate(d.getDate()-days);return d.toISOString().slice(0,10);};
  let supplierRows=[];

  function ensureUI(){
    if(!isMain()) return;
    const modules=document.querySelector('#masterOperationsPanel .master-module-grid');
    if(modules&&!document.getElementById('masterControlModule')){
      const btn=document.createElement('button');btn.id='masterControlModule';btn.className='master-module master-control-module';
      btn.innerHTML='<span class="master-module-icon">🎯</span><span><b>Control maestro</b><small>Proveedores, renovaciones y seguridad</small></span><i>→</i>';
      btn.onclick=openMasterControl;modules.appendChild(btn);
    }
    const admin=document.getElementById('section-admin');
    if(admin&&!document.getElementById('masterControlPanel')){
      const panel=document.createElement('div');panel.id='masterControlPanel';panel.className='panel master-data-panel master-control-panel';
      panel.innerHTML=`
        <div class="panel-head"><div><div class="master-kicker">MASTER V1.7 / V1.8</div><h2>Control administrativo y preparación del clon</h2><p class="small-text">Compara proveedores, registra atención/renovaciones, exporta datos y revisa seguridad e integridad antes de clonar.</p></div><button class="outline-btn" style="width:auto" onclick="loadMasterControlAll()">Actualizar todo</button></div>

        <section class="mc-section">
          <div class="mc-head"><div><span>🏆</span><div><h3>Ranking de proveedores</h3><p>Rentabilidad + calidad + atención + resolución. La puntuación es orientativa y muestra sus componentes.</p></div></div><div class="mc-dates"><input id="mcProviderFrom" type="date"/><input id="mcProviderTo" type="date"/><button onclick="loadProviderRanking()">Calcular</button></div></div>
          <div id="mcProviderSummary" class="mc-summary"></div><div id="mcProviderRanking" class="mc-provider-grid"><div class="small-text">Cargando proveedores…</div></div>
        </section>

        <section class="mc-section">
          <div class="mc-head"><div><span>🚨</span><div><h3>Alertas avanzadas</h3><p>Proveedores con deterioro, fallas atrasadas y anomalías de saldo.</p></div></div><button onclick="loadAdvancedAlerts()">Revisar</button></div>
          <div id="mcAdvancedAlerts" class="mc-alert-grid"></div>
        </section>

        <section class="mc-grid2">
          <div class="mc-section">
            <div class="mc-head"><div><span>🤝</span><div><h3>Atención del proveedor</h3><p>Registra respuesta y solución para medir servicio real.</p></div></div></div>
            <form id="mcServiceForm" class="mc-form">
              <select id="mcServiceSupplier" required><option value="">Proveedor…</option></select>
              <div class="two-row"><input id="mcServiceReport" type="number" min="1" placeholder="Reporte # (opcional)"/><input id="mcServiceMother" type="number" min="1" placeholder="Cuenta madre # (opcional)"/></div>
              <input id="mcServiceIssue" placeholder="Problema / solicitud al proveedor" required/>
              <div class="two-row"><select id="mcServiceStatus"><option value="pendiente">Pendiente</option><option value="respondio">Respondió</option><option value="resuelto">Resuelto</option><option value="no_resuelto">No resuelto</option></select><select id="mcServiceRating"><option value="">Atención sin calificar</option><option value="5">★★★★★ Excelente</option><option value="4">★★★★ Buena</option><option value="3">★★★ Regular</option><option value="2">★★ Mala</option><option value="1">★ Muy mala</option></select></div>
              <textarea id="mcServiceNotes" placeholder="Notas de atención"></textarea><button class="primary-btn">Guardar seguimiento</button>
            </form>
            <div id="mcServiceCases" class="mc-list compact"></div>
          </div>

          <div class="mc-section">
            <div class="mc-head"><div><span>🔄</span><div><h3>Historial de renovaciones</h3><p>No sobrescribas el pasado: cada renovación conserva fecha, costo y resultado.</p></div></div></div>
            <form id="mcRenewalForm" class="mc-form">
              <select id="mcRenewalMother" required><option value="">Cuenta madre…</option></select>
              <div class="two-row"><select id="mcRenewalResult"><option value="renovada">Renovada</option><option value="no_renovable">No renovable</option><option value="reemplazada">Reemplazada / compré otra</option></select><input id="mcRenewalExpiration" type="date"/></div>
              <input id="mcRenewalCost" type="number" min="0" step="0.01" placeholder="Costo de renovación"/><textarea id="mcRenewalNotes" placeholder="Notas"></textarea><button class="green-btn">Registrar renovación</button>
            </form>
            <div id="mcRenewalHistory" class="mc-list compact"></div>
          </div>
        </section>

        <section class="mc-section">
          <div class="mc-head"><div><span>📤</span><div><h3>Exportaciones administrativas</h3><p>Descarga copias CSV para análisis, contabilidad o respaldo operativo.</p></div></div><div class="mc-dates"><input id="mcExportFrom" type="date"/><input id="mcExportTo" type="date"/></div></div>
          <div class="mc-export-grid">${['ventas','inventario','proveedores','saldos','renovaciones','reembolsos'].map(k=>`<button onclick="downloadMasterExport('${k}')">⬇ ${k[0].toUpperCase()+k.slice(1)}</button>`).join('')}</div>
        </section>

        <section class="mc-grid2">
          <div class="mc-section"><div class="mc-head"><div><span>📱</span><div><h3>Sesiones y dispositivos</h3><p>Cierra una sesión específica o todas las de un usuario.</p></div></div><button onclick="loadMasterSessions()">Actualizar</button></div><div id="mcSessions" class="mc-list"></div></div>
          <div class="mc-section"><div class="mc-head"><div><span>🔐</span><div><h3>Permisos administrativos</h3><p>Base de permisos finos preparada para el clon. El dueño principal no se restringe.</p></div></div><button onclick="loadAdminPermissions()">Actualizar</button></div><div id="mcPermissions" class="mc-list"></div></div>
        </section>

        <section class="mc-grid2">
          <div class="mc-section"><div class="mc-head"><div><span>🩺</span><div><h3>Diagnóstico de datos</h3><p>Detecta ventas sin costo, cuentas sin madre, duplicados y referencias huérfanas.</p></div></div><button onclick="loadDataDiagnostics()">Ejecutar</button></div><div id="mcDiagnostics"></div></div>
          <div class="mc-section"><div class="mc-head"><div><span>🧱</span><div><h3>Aislamiento multiempresa</h3><p>Chequeo de datos globales que podrían estar asociados a usuarios de paneles.</p></div></div><button onclick="loadIsolationAudit()">Auditar</button></div><div id="mcIsolation"></div></div>
        </section>

        <section class="mc-grid2">
          <div class="mc-section"><div class="mc-head"><div><span>💾</span><div><h3>Registro de respaldos</h3><p>El sistema no puede ver tu archivo local de pg_dump; aquí registras cuándo lo hiciste y si lo verificaste.</p></div></div></div>
            <form id="mcBackupForm" class="mc-form"><div class="two-row"><input id="mcBackupLocation" placeholder="Ej. C:\\RespaldosSDP\\...dump" required/><input id="mcBackupSize" placeholder="Ej. 54 MB"/></div><label class="mc-check"><input id="mcBackupVerified" type="checkbox"/> Verificado con pg_restore --list</label><textarea id="mcBackupNotes" placeholder="Notas"></textarea><button class="primary-btn">Registrar respaldo</button></form><div id="mcBackups" class="mc-list compact"></div>
          </div>
          <div class="mc-section"><div class="mc-head"><div><span>🧩</span><div><h3>Migraciones versionadas</h3><p>V1.7 y V1.8 ya quedan registradas como migraciones; las siguientes versiones deben continuar este esquema.</p></div></div><button onclick="loadMigrations()">Actualizar</button></div><div id="mcMigrations" class="mc-list compact"></div></div>
        </section>`;
      admin.appendChild(panel);
      document.getElementById('mcProviderFrom').value=ago(29);document.getElementById('mcProviderTo').value=today();document.getElementById('mcExportFrom').value=ago(29);document.getElementById('mcExportTo').value=today();
      panel.querySelector('#mcServiceForm').addEventListener('submit',saveServiceCase);panel.querySelector('#mcRenewalForm').addEventListener('submit',saveRenewal);panel.querySelector('#mcBackupForm').addEventListener('submit',saveBackupCheckpoint);
    }
  }

  function openMasterControl(){ensureUI();if(typeof showSection==='function')showSection('admin');setTimeout(()=>{document.getElementById('masterControlPanel')?.scrollIntoView({behavior:'auto',block:'start'});loadMasterControlAll();},70);}
  window.openMasterControl=openMasterControl;

  async function loadProviderRanking(){
    ensureUI();const box=document.getElementById('mcProviderRanking');try{box.innerHTML='<div class="small-text">Calculando…</div>';const from=document.getElementById('mcProviderFrom').value,to=document.getElementById('mcProviderTo').value;const d=await api(`/api/admin/master/provider-performance?from=${from}&to=${to}`);supplierRows=d.providers||[];
      const summary=document.getElementById('mcProviderSummary');const best=supplierRows[0];if(summary)summary.innerHTML=best?`<span>🏆 Mejor puntuado <b>${esc(best.name)} · ${best.score}/100</b></span><span>ROI <b>${pct(best.roi_pct)}</b></span><span>Fallas <b>${pct(best.failure_rate)}</b></span><span>Atención <b>${Number(best.avg_attention_rating||0).toFixed(1)}/5</b></span>`:'<span>Sin datos suficientes</span>';
      box.innerHTML=supplierRows.length?supplierRows.map((r,i)=>`<article class="mc-provider-card score-${r.score>=85?'great':r.score>=70?'good':r.score>=55?'mid':'risk'}"><div class="mc-provider-rank">#${i+1}</div><div class="mc-provider-top"><div><h4>${esc(r.name)}</h4><span>${esc(r.classification)} · ${r.score}/100</span></div><b>${r.score}</b></div><div class="mc-provider-metrics"><span><small>Invertido</small><b>$${money(r.invested)}</b></span><span><small>Utilidad período</small><b>$${money(r.profit)}</b></span><span><small>ROI operativo</small><b>${pct(r.roi_pct)}</b></span><span><small>Ventas</small><b>${r.sales}</b></span><span><small>Fallas</small><b>${r.failures} · ${pct(r.failure_rate)}</b></span><span><small>Reemplazos</small><b>${r.replacements} · ${pct(r.replacement_rate)}</b></span><span><small>Costo fallas</small><b>$${money(r.replacement_cost)}</b></span><span><small>Atención</small><b>${Number(r.avg_attention_rating||0).toFixed(1)}/5</b></span><span><small>Solución prom.</small><b>${Number(r.avg_resolution_hours||0)>0?Number(r.avg_resolution_hours).toFixed(1)+' h':'—'}</b></span></div><p>${esc(r.recommendation)}</p><div class="mc-score-parts"><em>Rentabilidad ${Math.round(r.profitability_score)}</em><em>Calidad ${Math.round(r.quality_score)}</em><em>Atención ${Math.round(r.attention_score)}</em><em>Resolución ${Math.round(r.resolution_score)}</em></div></article>`).join(''):'<div class="master-empty">Aún no hay proveedores con datos.</div>';
      fillSupplierOptions();
    }catch(e){box.innerHTML=`<div class="master-load-error">${esc(e.message||'Error')}</div>`;}
  }
  window.loadProviderRanking=loadProviderRanking;
  function fillSupplierOptions(){const sel=document.getElementById('mcServiceSupplier');if(sel)sel.innerHTML='<option value="">Proveedor…</option>'+supplierRows.map(r=>`<option value="${r.supplier_id||''}" data-name="${esc(r.name)}">${esc(r.name)}</option>`).join('');}

  async function loadAdvancedAlerts(){const box=document.getElementById('mcAdvancedAlerts');try{const from=document.getElementById('mcProviderFrom').value,to=document.getElementById('mcProviderTo').value;const d=await api(`/api/admin/master/advanced-alerts?from=${from}&to=${to}`);const items=[];(d.supplier_alerts||[]).forEach(x=>items.push(`<article class="mc-alert danger"><b>🚚 ${esc(x.name)}</b><span>${x.score}/100 · fallas ${pct(x.failure_rate)}</span><small>${esc(x.recommendation)}</small></article>`));(d.delayed_reports||[]).forEach(x=>items.push(`<article class="mc-alert warn"><b>⚠ Reporte #${x.id} atrasado</b><span>${esc(x.name||x.email||'Usuario')} · ${Number(x.age_hours||0).toFixed(1)} h</span><small>${esc(x.issue_type||'Falla')}</small></article>`));(d.balance_anomalies||[]).forEach(x=>items.push(`<article class="mc-alert danger"><b>💳 Saldo no concilia</b><span>${esc(x.name||x.email)} · diferencia $${money(x.difference)}</span></article>`));box.innerHTML=items.length?items.join(''):'<div class="master-ok"><span>✓</span><div><b>Sin alertas avanzadas</b><small>No se detectaron condiciones críticas en este rango.</small></div></div>';}catch(e){box.innerHTML=`<div class="master-load-error">${esc(e.message)}</div>`;}}
  window.loadAdvancedAlerts=loadAdvancedAlerts;

  async function loadServiceCases(){try{const d=await api('/api/admin/master/provider-service-cases');const box=document.getElementById('mcServiceCases');box.innerHTML=(d.rows||[]).slice(0,30).map(r=>`<div class="mc-row"><div><b>${esc(r.supplier_name)}</b><small>${esc(r.issue||'Seguimiento')} · ${new Date(r.contacted_at).toLocaleString('es-MX')}${r.resolved_at?` · resuelto ${new Date(r.resolved_at).toLocaleString('es-MX')}`:''}</small></div><span class="mc-status">${esc(r.status)}</span><em>${r.attention_rating?`${r.attention_rating}/5`:'sin calificar'}</em><div class="mc-row-actions">${r.status==='pendiente'?`<button onclick="updateServiceCase(${r.id},'respondio')">Respondió</button>`:''}${!['resuelto','no_resuelto'].includes(r.status)?`<button onclick="updateServiceCase(${r.id},'resuelto',true)">Resolver</button><button onclick="updateServiceCase(${r.id},'no_resuelto',true)">No resolvió</button>`:''}</div></div>`).join('')||'<div class="small-text">Sin seguimientos.</div>';}catch(e){}}

  window.updateServiceCase=async (id,status,askRating=false)=>{let rating=null;if(askRating){const raw=prompt('Califica la atención del proveedor del 1 al 5 (opcional):','5');if(raw!==null&&raw!=='')rating=Math.max(1,Math.min(5,Number(raw)||0));}try{await api(`/api/admin/master/provider-service-cases/${id}`,{method:'PATCH',body:JSON.stringify({status,attention_rating:rating})});await Promise.all([loadServiceCases(),loadProviderRanking()]);showMessage?.('Seguimiento actualizado');}catch(e){showMessage?.(e.message||'Error',true);}};

  async function saveServiceCase(ev){ev.preventDefault();const sel=document.getElementById('mcServiceSupplier'),opt=sel.options[sel.selectedIndex];try{await api('/api/admin/master/provider-service-cases',{method:'POST',body:JSON.stringify({supplier_id:sel.value||null,supplier_name:opt?.dataset?.name||opt?.text||'',report_id:document.getElementById('mcServiceReport').value||null,mother_account_id:document.getElementById('mcServiceMother').value||null,issue:document.getElementById('mcServiceIssue').value,status:document.getElementById('mcServiceStatus').value,attention_rating:document.getElementById('mcServiceRating').value||null,notes:document.getElementById('mcServiceNotes').value})});ev.target.reset();fillSupplierOptions();await Promise.all([loadServiceCases(),loadProviderRanking()]);showMessage?.('Seguimiento del proveedor guardado');}catch(e){showMessage?.(e.message||'Error',true);}}

  async function loadRenewals(){try{const d=await api('/api/admin/master/renewal-history');const sel=document.getElementById('mcRenewalMother');sel.innerHTML='<option value="">Cuenta madre…</option>'+(d.mother_accounts||[]).map(m=>`<option value="${m.id}">#${m.id} · ${esc(m.product_name)} · ${esc(m.account_email)} · vence ${String(m.expiration_date||'—').slice(0,10)}</option>`).join('');const box=document.getElementById('mcRenewalHistory');box.innerHTML=(d.rows||[]).slice(0,30).map(r=>`<div class="mc-row"><div><b>#${r.mother_account_id} · ${esc(r.product_name)}</b><small>${esc(r.supplier_name||'Sin proveedor')} · ${String(r.previous_expiration||'—').slice(0,10)} → ${String(r.new_expiration||'—').slice(0,10)}</small></div><span>${esc(r.result)}</span><em>$${money(r.renewal_cost)}</em></div>`).join('')||'<div class="small-text">Sin renovaciones registradas.</div>';}catch(e){}}
  async function saveRenewal(ev){ev.preventDefault();try{await api('/api/admin/master/renewal-history',{method:'POST',body:JSON.stringify({mother_account_id:document.getElementById('mcRenewalMother').value,result:document.getElementById('mcRenewalResult').value,new_expiration:document.getElementById('mcRenewalExpiration').value||null,renewal_cost:document.getElementById('mcRenewalCost').value||0,notes:document.getElementById('mcRenewalNotes').value})});ev.target.reset();await Promise.all([loadRenewals(),loadProviderRanking()]);showMessage?.('Renovación registrada');}catch(e){showMessage?.(e.message||'Error',true);}}

  async function downloadMasterExport(kind){const from=document.getElementById('mcExportFrom').value,to=document.getElementById('mcExportTo').value;try{const r=await fetch(`/api/admin/master/export/${encodeURIComponent(kind)}?from=${from}&to=${to}`,{headers:{Authorization:'Bearer '+localStorage.getItem('token')}});if(!r.ok){const e=await r.json().catch(()=>({}));throw new Error(e.error||'No se pudo exportar');}const blob=await r.blob();const a=document.createElement('a');a.href=URL.createObjectURL(blob);const cd=r.headers.get('content-disposition')||'';a.download=(cd.match(/filename="?([^";]+)"?/)||[])[1]||`${kind}.csv`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}catch(e){showMessage?.(e.message||'Error al exportar',true);}}
  window.downloadMasterExport=downloadMasterExport;

  async function loadMasterSessions(){const box=document.getElementById('mcSessions');try{const d=await api('/api/admin/master/sessions');box.innerHTML=(d.rows||[]).slice(0,80).map(r=>`<div class="mc-row session ${r.revoked_at?'muted':''}"><div><b>${esc(r.name||r.email)} ${r.session_id===d.current_session_id?'· ESTA SESIÓN':''}</b><small>${esc(r.ip_address||'IP no registrada')} · ${esc(String(r.user_agent||'').slice(0,80))}<br>Última actividad: ${new Date(r.last_seen_at||r.created_at).toLocaleString('es-MX')}</small></div><span>${r.revoked_at?'cerrada':'activa'}</span>${!r.revoked_at&&r.session_id!==d.current_session_id?`<button onclick="revokeMasterSession(${r.id})">Cerrar</button>`:''}</div>`).join('')||'<div class="small-text">Las sesiones empezarán a registrarse al volver a iniciar sesión con V1.8.</div>';}catch(e){box.innerHTML=`<div class="master-load-error">${esc(e.message)}</div>`;}}
  window.loadMasterSessions=loadMasterSessions;
  window.revokeMasterSession=async id=>{if(!confirm('¿Cerrar esta sesión?'))return;await api(`/api/admin/master/sessions/${id}/revoke`,{method:'POST'});loadMasterSessions();};

  async function loadAdminPermissions(){const box=document.getElementById('mcPermissions');try{const d=await api('/api/admin/master/admin-permissions');box.innerHTML=(d.rows||[]).map(r=>`<div class="mc-permission-card"><div><b>${esc(r.name||r.email)}</b><small>${esc(r.email)}</small></div>${r.id===currentUser?.id?'<span>Administrador principal</span>':`<div class="mc-perm-grid">${d.available.map(k=>`<label><input type="checkbox" data-admin="${r.id}" data-perm="${k}" ${r.admin_permissions?.[k]?'checked':''}/> ${k.replaceAll('_',' ')}</label>`).join('')}</div><button onclick="saveAdminPermissions(${r.id})">Guardar</button>`}</div>`).join('')||'<div class="small-text">No hay otros administradores.</div>';}catch(e){box.innerHTML=`<div class="master-load-error">${esc(e.message)}</div>`;}}
  window.loadAdminPermissions=loadAdminPermissions;
  window.saveAdminPermissions=async id=>{const permissions={};document.querySelectorAll(`[data-admin="${id}"][data-perm]`).forEach(x=>permissions[x.dataset.perm]=x.checked);await api(`/api/admin/master/admin-permissions/${id}`,{method:'PUT',body:JSON.stringify({permissions})});showMessage?.('Permisos guardados');};

  async function loadDataDiagnostics(){const box=document.getElementById('mcDiagnostics');try{const d=await api('/api/admin/master/data-diagnostics');box.innerHTML=`<div class="mc-health ${d.health_score>=90?'good':d.health_score>=70?'mid':'risk'}"><b>${d.health_score}/100</b><span>salud de datos</span></div>`+(d.rows||[]).map(r=>`<div class="mc-check-row ${r.total?'issue':'ok'}"><span>${r.total?'⚠':'✓'}</span><div><b>${esc(r.label)}</b><small>${r.total?`${r.total} caso(s)${r.sample?.length?' · IDs '+r.sample.join(', '):''}`:'Sin incidencias'}</small></div></div>`).join('');}catch(e){box.innerHTML=`<div class="master-load-error">${esc(e.message)}</div>`;}}
  window.loadDataDiagnostics=loadDataDiagnostics;
  async function loadIsolationAudit(){const box=document.getElementById('mcIsolation');try{const d=await api('/api/admin/master/isolation-audit');box.innerHTML=`<div class="mc-health ${d.status==='ok'?'good':'risk'}"><b>${d.potential_scope_leaks}</b><span>posibles cruces de alcance</span></div><div class="mc-check-row ${d.status==='ok'?'ok':'issue'}"><span>${d.status==='ok'?'✓':'⚠'}</span><div><b>${d.status==='ok'?'Aislamiento de datos sin cruces detectados':'Revisión necesaria'}</b><small>Pedidos panel→global: ${d.details.panel_orders_in_global||0} · Reportes: ${d.details.panel_reports_in_global||0} · Saldos: ${d.details.panel_balance_in_global||0}</small></div></div><p class="small-text">${esc(d.note||'')}</p>`;}catch(e){box.innerHTML=`<div class="master-load-error">${esc(e.message)}</div>`;}}
  window.loadIsolationAudit=loadIsolationAudit;

  async function loadBackups(){try{const d=await api('/api/admin/master/backup-checkpoints');const box=document.getElementById('mcBackups');box.innerHTML=(d.rows||[]).map(r=>`<div class="mc-row"><div><b>${r.verified?'✅':'⚪'} ${esc(r.backup_type)}</b><small>${new Date(r.backup_date).toLocaleString('es-MX')} · ${esc(r.location_label||'Sin ubicación')}</small></div><em>${esc(r.size_label||'')}</em></div>`).join('')||'<div class="small-text">Todavía no has registrado un respaldo en el panel.</div>';}catch(e){}}
  async function saveBackupCheckpoint(ev){ev.preventDefault();try{await api('/api/admin/master/backup-checkpoints',{method:'POST',body:JSON.stringify({location_label:document.getElementById('mcBackupLocation').value,size_label:document.getElementById('mcBackupSize').value,verified:document.getElementById('mcBackupVerified').checked,notes:document.getElementById('mcBackupNotes').value})});ev.target.reset();await loadBackups();showMessage?.('Respaldo registrado');}catch(e){showMessage?.(e.message||'Error',true);}}
  async function loadMigrations(){try{const d=await api('/api/admin/master/migrations');const box=document.getElementById('mcMigrations');box.innerHTML=(d.rows||[]).map(r=>`<div class="mc-row"><div><b>${esc(r.version)}</b><small>${esc(r.description||'')}</small></div><em>${new Date(r.applied_at).toLocaleString('es-MX')}</em></div>`).join('');}catch(e){}}
  window.loadMigrations=loadMigrations;

  async function loadMasterControlAll(){ensureUI();await Promise.allSettled([loadProviderRanking(),loadAdvancedAlerts(),loadServiceCases(),loadRenewals(),loadMasterSessions(),loadAdminPermissions(),loadDataDiagnostics(),loadIsolationAudit(),loadBackups(),loadMigrations()]);}
  window.loadMasterControlAll=loadMasterControlAll;

  if(typeof registerLoadAppHook==='function')registerLoadAppHook(async()=>{ensureUI();},{name:'master-control-v178',order:990});
  else document.addEventListener('DOMContentLoaded',()=>setTimeout(ensureUI,1000));
})();
