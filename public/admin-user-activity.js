(function(){
  function money(v){ return typeof formatMoney === 'function' ? formatMoney(v) : Number(v||0).toFixed(2); }
  function safe(v){ return typeof safeText === 'function' ? safeText(v) : String(v ?? '').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
  function dateMX(v){
    if(!v) return 'Nunca';
    const d=new Date(v);
    if(Number.isNaN(d.getTime())) return 'Nunca';
    return d.toLocaleString('es-MX',{dateStyle:'medium',timeStyle:'short'});
  }
  function label(type){
    if(type==='never_registered') return {title:'🔵 Se registró y nunca vendió',desc:'No tiene ventas exitosas y nunca aparece una carga de saldo registrada.'};
    if(type==='loaded_no_sales') return {title:'🟡 Cargó saldo pero nunca vendió',desc:'Tiene una o más cargas de saldo, pero ninguna venta exitosa.'};
    if(type==='sold_inactive_30d') return {title:'🟠 Vendió, pero lleva más de 30 días sin movimiento',desc:'Tiene historial de ventas y carga de saldo, pero su último movimiento registrado supera 30 días.'};
    if(type==='active_or_recent') return {title:'🟢 Activo o reciente',desc:'Tiene ventas y su actividad más reciente está dentro de los últimos 30 días.'};
    return {title:'⚪ Otro caso',desc:'No entra en las tres categorías principales de limpieza.'};
  }
  function card(id,title,count,extra){
    return `<div class="dash-card" style="min-height:92px"><div class="dash-label">${title}</div><div class="dash-value" id="${id}">${count}</div>${extra?`<div class="small-text">${extra}</div>`:''}</div>`;
  }
  function actionButtons(u){
    const canDelete = u.classification==='never_registered';
    const deleteTitle = canDelete
      ? 'Eliminar permanentemente este usuario. Solo será posible si no tiene ningún historial que deba conservarse.'
      : 'Este botón verifica el historial antes de eliminar. Si existen ventas, cargas o reportes, el servidor impedirá la eliminación.';
    return `<div class="tools" style="margin:12px 0 0;display:flex;gap:8px;flex-wrap:wrap">
      <button class="outline-btn" style="width:auto" onclick="sellerActivitySetEnabled(${u.id},${u.is_enabled?'false':'true'})">${u.is_enabled?'Deshabilitar':'Habilitar'}</button>
      <button class="danger-btn" style="width:auto" title="${deleteTitle}" onclick="sellerActivityDelete(${u.id})">Eliminar permanentemente</button>
    </div>`;
  }
  function row(u){
    return `<div class="item" style="margin-bottom:10px">
      <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap">
        <div><p style="margin:0 0 4px"><b>${safe(u.name||'Sin nombre')}</b> <span class="chip">ID ${u.id}</span></p><p style="margin:0;color:#64748b">${safe(u.email)}</p></div>
        <span class="chip" style="background:${u.is_enabled?'#dcfce7':'#fee2e2'};color:${u.is_enabled?'#166534':'#991b1b'}">${u.is_enabled?'Activo':'Deshabilitado'}</span>
      </div>
      <p><b>Registro:</b> ${dateMX(u.created_at)} · <b>Saldo actual:</b> $${money(u.balance)}</p>
      <p><b>Ventas exitosas:</b> ${u.total_sales} · <b>Ventas últimos 30 días:</b> ${u.sales_30d}</p>
      <p><b>Saldo cargado histórico:</b> $${money(u.loaded_total)} · <b>Última carga:</b> ${dateMX(u.last_load_at)}</p>
      <p><b>Última venta:</b> ${dateMX(u.last_sale_at)} · <b>Último movimiento:</b> ${dateMX(u.last_activity_at)}</p>
      ${actionButtons(u)}
    </div>`;
  }
  function renderGroup(container,title,desc,rows){
    const box=document.createElement('div');
    box.className='panel';
    box.style.margin='0 0 14px';
    box.innerHTML=`<div class="panel-head"><div><h3 style="margin:0">${title} <span class="chip">${rows.length}</span></h3><p class="small-text">${desc}</p></div></div>${rows.length?rows.map(row).join(''):'<p class="small-text">No hay usuarios en esta categoría.</p>'}`;
    container.appendChild(box);
  }
  window.loadSellerActivityReport=async function(){
    const summary=document.getElementById('sellerActivitySummary');
    const target=document.getElementById('sellerActivityReport');
    if(!target)return;
    target.textContent='Generando reporte preciso...';
    try{
      const data=await api('/api/admin/user-activity-report');
      const s=data.summary||{};
      if(summary){
        summary.innerHTML=[
          card('sellerActNever','🔵 Nunca vendieron',s.never_registered||0,'Prioridad máxima de limpieza'),
          card('sellerActLoaded','🟡 Cargaron saldo sin vender',s.loaded_no_sales||0,'Segunda prioridad'),
          card('sellerActInactive','🟠 Vendieron pero llevan +30 días',s.sold_inactive_30d||0,'Revisar / deshabilitar'),
          card('sellerActRecent','🟢 Activos o recientes',s.active_or_recent||0,'No aparecen como candidatos')
        ].join('');
      }
      const rows=Array.isArray(data.rows)?data.rows:[];
      target.innerHTML='';
      renderGroup(target,...Object.values(label('never_registered')),rows.filter(x=>x.classification==='never_registered'));
      renderGroup(target,...Object.values(label('loaded_no_sales')),rows.filter(x=>x.classification==='loaded_no_sales'));
      renderGroup(target,...Object.values(label('sold_inactive_30d')),rows.filter(x=>x.classification==='sold_inactive_30d'));
      const others=rows.filter(x=>['active_or_recent','other'].includes(x.classification));
      if(others.length) renderGroup(target,'🟢 Fuera de limpieza', 'Vendedores con actividad reciente u otros casos que no deben limpiarse automáticamente.',others);
    }catch(e){ target.textContent=e.message||'No se pudo cargar el reporte de actividad.'; }
  };
  window.sellerActivitySetEnabled=async function(id,enabled){
    try{
      const on=enabled===true||enabled==='true';
      if(!confirm(on?'¿Habilitar este vendedor?':'¿Deshabilitar este vendedor? No podrá iniciar sesión.'))return;
      const data=await api('/api/admin/users/'+id+'/status',{method:'PATCH',body:JSON.stringify({enabled:on})});
      showMessage(data.message||'Estado actualizado');
      await loadSellerActivityReport();
      if(typeof loadUsers==='function') await loadUsers();
    }catch(e){showMessage(e.message||'No se pudo cambiar el estado','error');}
  };
  window.sellerActivityDelete=async function(id){
    try{
      if(!confirm('⚠️ ELIMINAR PERMANENTEMENTE\n\nSe intentará borrar este usuario y sus datos auxiliares. Si tiene ventas, solicitudes, reportes o historial que deba conservarse, el sistema BLOQUEARÁ la eliminación.\n\n¿Continuar?'))return;
      const data=await api('/api/admin/users/'+id,{method:'DELETE'});
      showMessage(data.message||'Usuario eliminado permanentemente');
      await loadSellerActivityReport();
      if(typeof loadUsers==='function') await loadUsers();
    }catch(e){showMessage(e.message||'No se pudo eliminar permanentemente','error');}
  };
  if(typeof registerSectionHook==='function') registerSectionHook(function(name){ if(name==='admin') setTimeout(loadSellerActivityReport,80); });
})();
