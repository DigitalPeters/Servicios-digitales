/* Servicios Digitales - Rentabilidad y Calidad Admin V1 */
(function(){
  'use strict';
  let cache = null;

  const num = v => Number(v || 0);
  const money = v => `$${num(v).toFixed(2)}`;
  const pct = v => v === null || v === undefined ? '—' : `${num(v).toFixed(2)}%`;
  const esc = v => typeof safeText === 'function'
    ? safeText(String(v ?? ''))
    : String(v ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

  function isMain(){
    return typeof isMainAdminPrincipal === 'function'
      ? isMainAdminPrincipal()
      : !!currentUser && String(currentUser.role || '').toLowerCase() === 'admin';
  }

  function isoLocal(date){
    const y=date.getFullYear();
    const m=String(date.getMonth()+1).padStart(2,'0');
    const d=String(date.getDate()).padStart(2,'0');
    return `${y}-${m}-${d}`;
  }

  function setVisibility(){
    const visible=isMain();
    const card=document.getElementById('adminProfitQualityCard');
    const section=document.getElementById('section-profit-quality');
    [card, section].forEach(el=>{
      if(!el) return;
      el.classList.toggle('hidden', !visible);
      if(!visible) el.style.display='none';
      else el.style.display='';
    });
  }

  window.setProfitQualityCurrentMonth=function(){
    const now=new Date();
    const start=new Date(now.getFullYear(), now.getMonth(), 1);
    const a=document.getElementById('profitQualityStart');
    const b=document.getElementById('profitQualityEnd');
    if(a) a.value=isoLocal(start);
    if(b) b.value=isoLocal(now);
    return loadProfitQuality();
  };

  window.setProfitQualityLast30Days=function(){
    const end=new Date();
    const start=new Date(); start.setDate(start.getDate()-29);
    const a=document.getElementById('profitQualityStart');
    const b=document.getElementById('profitQualityEnd');
    if(a) a.value=isoLocal(start);
    if(b) b.value=isoLocal(end);
    return loadProfitQuality();
  };

  function ensureDates(){
    const start=document.getElementById('profitQualityStart');
    const end=document.getElementById('profitQualityEnd');
    if(!start || !end) return;
    if(!end.value) end.value=isoLocal(new Date());
    if(!start.value){
      const now=new Date();
      start.value=isoLocal(new Date(now.getFullYear(), now.getMonth(), 1));
    }
  }

  window.showProfitQualityTab=function(tab){
    const profit=tab!=='quality';
    document.getElementById('pqProfitTab')?.classList.toggle('hidden', !profit);
    document.getElementById('pqQualityTab')?.classList.toggle('hidden', profit);
    document.getElementById('pqTabProfit')?.classList.toggle('active', profit);
    document.getElementById('pqTabQuality')?.classList.toggle('active', !profit);
  };

  function statusChip(row){
    const status=String(row.profitability_status || 'rentable');
    if(status==='perdida') return '<span class="chip error">🔴 Pérdida</span>';
    if(status==='margen_bajo') return '<span class="chip status">🟠 Margen bajo</span>';
    return '<span class="chip success">🟢 Rentable</span>';
  }

  function renderSummary(summary){
    const set=(id,val)=>{const el=document.getElementById(id);if(el)el.textContent=val;};
    set('pqAdminRevenue',num(summary.admin_revenue).toFixed(2));
    set('pqSaleCost',num(summary.sale_cost).toFixed(2));
    set('pqReplacementCost',num(summary.replacement_cost).toFixed(2));
    set('pqProfit',num(summary.profit).toFixed(2));
    set('pqMargin',num(summary.margin_percent).toFixed(2));
    set('pqFailures',String(summary.failures || 0));
    set('pqReplacements',String(summary.replacements || 0));

    const saleCostCard=document.getElementById('pqSaleCost')?.closest('.dash-card');
    if(saleCostCard){
      let note=saleCostCard.querySelector('.pq-cost-source-note');
      const fallback=Number(summary.cost_sources?.product_current_orders || 0);
      if(fallback>0){
        if(!note){note=document.createElement('div');note.className='small-text pq-cost-source-note';saleCostCard.querySelector('.dash-value')?.parentElement?.appendChild(note);}
        note.textContent=`${fallback} venta(s) usan el costo actual configurado en Productos`;
      }else if(note){note.remove();}

      let linkNote=saleCostCard.querySelector('.pq-link-warning');
      const unlinked=Number(summary.cost_sources?.unlinked_inventory_orders || 0);
      if(unlinked>0){
        if(!linkNote){linkNote=document.createElement('div');linkNote.className='small-text status pq-link-warning';saleCostCard.querySelector('.dash-value')?.parentElement?.appendChild(linkNote);}
        linkNote.textContent=`${unlinked} venta(s) no conservan vínculo histórico con una cuenta madre; su costo sí se calcula, pero se agrupan en Sin proveedor.`;
      }else if(linkNote){linkNote.remove();}
    }

    const target=document.getElementById('pqReplacementCost')?.closest('.dash-card');
    if(target){
      let note=target.querySelector('.pq-cost-warning');
      const missing=Number(summary.replacement_cost_missing || 0);
      if(missing){
        if(!note){note=document.createElement('div');note.className='small-text error pq-cost-warning';target.querySelector('.dash-value')?.parentElement?.appendChild(note);}
        note.textContent=`${missing} reemplazo(s) sin costo capturado`;
      }else if(note){note.remove();}
    }
  }

  function renderProviders(rows){
    const box=document.getElementById('pqProviders'); if(!box) return;
    if(!rows?.length){box.innerHTML='<p class="small-text">Sin proveedores con actividad en este periodo.</p>';return;}
    box.innerHTML=`<div class="table-wrap pq-table-scroll"><table class="mini-table pq-provider-table"><thead><tr><th>Proveedor</th><th>Cuentas madre</th><th>Inversión registrada</th><th>Ventas</th><th>Ingreso admin</th><th>Costo vendido</th><th>Reemplazos</th><th>Utilidad</th><th>Margen</th><th>Fallas</th><th>Tasa falla</th></tr></thead><tbody>${rows.map(r=>`<tr>
      <td><b>${esc(r.provider_name||'Sin proveedor')}</b>${r.mother_cost_missing?`<br><span class="small-text error">${r.mother_cost_missing} cuenta(s) sin costo configurado</span>`:''}</td>
      <td>${num(r.mother_accounts)}</td><td><b>${money(r.registered_mother_cost)}</b></td><td>${num(r.orders)}</td><td>${money(r.admin_revenue)}</td><td>${money(r.sale_cost)}</td><td>${money(r.replacement_cost)}</td>
      <td class="${num(r.profit)<0?'error':'success'}"><b>${money(r.profit)}</b></td><td>${pct(r.margin_percent)}</td><td>${num(r.failures)} (${num(r.replacements)} repl.)</td><td><b>${pct(r.failure_rate)}</b></td>
    </tr>`).join('')}</tbody></table></div>`;
  }

  window.updateMotherCostPreview=function(id){
    const totalRaw=(document.getElementById(`pq-cost-${id}`)?.value||'').trim();
    const total=totalRaw===''?null:Number(totalRaw);
    const byProfile=!!document.getElementById(`pq-by-profile-${id}`)?.checked;
    const countRaw=(document.getElementById(`pq-profile-count-${id}`)?.value||'').trim();
    const count=countRaw===''?0:Number(countRaw);
    const overrideRaw=(document.getElementById(`pq-profile-cost-${id}`)?.value||'').trim();
    const override=overrideRaw===''?null:Number(overrideRaw);
    const group=document.getElementById(`pq-profile-settings-${id}`);
    if(group) group.classList.toggle('hidden',!byProfile);
    let effective=null, label='Sin costo configurado';
    if(byProfile){
      if(override!==null && Number.isFinite(override) && override>=0){effective=override;label='Costo manual por perfil';}
      else if(total!==null && Number.isFinite(total) && count>0){effective=total/count;label='Costo calculado por perfil';}
    }else if(total!==null && Number.isFinite(total) && total>=0){effective=total;label='Costo por cuenta completa';}
    const preview=document.getElementById(`pq-cost-preview-${id}`);
    if(preview) preview.innerHTML=effective===null
      ? `<span class="error">${esc(label)}</span>`
      : `<span>${esc(label)}</span><b>${money(effective)}</b>`;
  };

  function renderMothers(rows){
    const box=document.getElementById('pqMotherAccounts'); if(!box) return;
    const active=(rows||[]).filter(r=>num(r.orders)>0 || num(r.failures)>0 || r.id);
    if(!active.length){box.innerHTML='<p class="small-text">Sin cuentas madre.</p>';return;}
    box.innerHTML=`<div class="table-wrap pq-table-scroll"><table class="mini-table pq-mother-table"><thead><tr><th>Cuenta madre</th><th>Configuración de costo</th><th>Perfiles / costo unitario</th><th>Ventas</th><th>Ingreso admin</th><th>Costo vendido</th><th>Costo reemplazos</th><th>Utilidad</th><th>Fallas</th></tr></thead><tbody>${active.map(r=>`<tr>
      <td><b>${r.id?`#${num(r.id)} · `:''}${esc(r.product_name||'Sin producto')}</b><br><span class="small-text">${esc(r.account_email||'')}</span><br>${statusChip(r)}</td>
      <td>${r.id?`<div class="pq-cost-editor">
          <label>Proveedor</label><input id="pq-provider-${r.id}" value="${esc(r.provider_name||'')}" placeholder="Ej. Digitalvnhe"/>
          <label>Costo cuenta completa</label><input id="pq-cost-${r.id}" type="number" min="0" step="0.01" value="${r.purchase_cost_total===null?'':num(r.purchase_cost_total)}" placeholder="Ej. 250.00" oninput="updateMotherCostPreview(${r.id})"/>
          <label class="pq-check"><input id="pq-by-profile-${r.id}" type="checkbox" ${r.sell_by_profile?'checked':''} onchange="updateMotherCostPreview(${r.id})"/> <span>Esta cuenta se vende por perfiles</span></label>
          <div id="pq-profile-settings-${r.id}" class="pq-profile-settings ${r.sell_by_profile?'':'hidden'}">
            <label>Perfiles de la cuenta</label><input id="pq-profile-count-${r.id}" type="number" min="1" max="500" step="1" value="${r.configured_profile_count===null?'':num(r.configured_profile_count)}" placeholder="Ej. 5" oninput="updateMotherCostPreview(${r.id})"/>
            <label>Costo manual por perfil <small>(opcional)</small></label><input id="pq-profile-cost-${r.id}" type="number" min="0" step="0.01" value="${r.profile_cost_override===null?'':num(r.profile_cost_override)}" placeholder="Vacío = calcular automático" oninput="updateMotherCostPreview(${r.id})"/>
          </div>
          <div id="pq-cost-preview-${r.id}" class="pq-cost-preview"></div>
          <button class="primary-btn pq-save-cost" onclick="saveMotherAnalyticsMeta(${r.id})">Guardar costo</button>
        </div>`:`${esc(r.provider_name||'Sin proveedor')}`}</td>
      <td><b>${num(r.profile_count)} perfil(es) cargados</b><br><span class="small-text">${num(r.available_profiles)} disp. · ${num(r.failed_profiles)} fallidos</span><div class="pq-effective-cost"><span>Costo usado por venta</span><b>${r.effective_unit_cost===null?'—':money(r.effective_unit_cost)}</b><small>${r.sell_by_profile?`${num(r.cost_profile_count)} perfil(es) para reparto`:'Cuenta completa'}</small></div></td>
      <td>${num(r.orders)}</td><td>${money(r.admin_revenue)}</td><td>${money(r.sale_cost)}</td><td>${money(r.replacement_cost)}</td>
      <td class="${num(r.profit)<0?'error':'success'}"><b>${money(r.profit)}</b><br><span class="small-text">${pct(r.margin_percent)}</span></td>
      <td>${num(r.failures)}<br><span class="small-text">${num(r.replacements)} repl. · ${num(r.refunds)} reemb.</span></td>
    </tr>`).join('')}</tbody></table></div>`;
    active.filter(r=>r.id).forEach(r=>updateMotherCostPreview(r.id));
  }

  function renderQuality(id,rows){
    const box=document.getElementById(id); if(!box) return;
    if(!rows?.length){box.innerHTML='<p class="small-text">Sin datos.</p>';return;}
    box.innerHTML=`<div class="table-wrap"><table class="mini-table"><thead><tr><th>Grupo</th><th>Ventas</th><th>Afectadas</th><th>Reportes</th><th>Reemplazos</th><th>Reembolsos</th><th>Costo repl.</th><th>Tasa falla</th></tr></thead><tbody>${rows.slice(0,60).map(r=>`<tr>
      <td><b>${esc(r.label||'Sin dato')}</b>${r.replacement_cost_missing?`<br><span class="small-text error">${r.replacement_cost_missing} costo(s) faltante(s)</span>`:''}</td>
      <td>${num(r.sales)}</td><td>${num(r.affected_sales)}</td><td>${num(r.reports)}</td><td>${num(r.replacements)}</td><td>${num(r.refunds)} · ${money(r.refund_amount)}</td><td>${money(r.replacement_cost)}</td>
      <td class="${num(r.failure_rate)>=15?'error':num(r.failure_rate)>=7?'status':'success'}"><b>${pct(r.failure_rate)}</b></td>
    </tr>`).join('')}</tbody></table></div>`;
  }

  function formatDate(value){
    const raw=String(value||'');
    if(!raw) return '—';
    const d=new Date(raw);
    if(Number.isNaN(d.getTime())) return raw.slice(0,10);
    return new Intl.DateTimeFormat('es-MX',{timeZone:'America/Mexico_City',dateStyle:'short',timeStyle:'short'}).format(d);
  }

  function renderRecent(rows){
    const box=document.getElementById('pqRecentReports'); if(!box) return;
    if(!rows?.length){box.innerHTML='<p class="small-text">Sin reportes en el periodo.</p>';return;}
    box.innerHTML=`<div class="table-wrap"><table class="mini-table"><thead><tr><th>Fecha</th><th>Vendedor</th><th>Plataforma / producto</th><th>Proveedor</th><th>Falla</th><th>Resolución</th><th>Impacto</th></tr></thead><tbody>${rows.map(r=>`<tr>
      <td>${esc(formatDate(r.created_at))}</td><td>${esc(r.seller_name||r.seller_email||'Usuario')}${r.distributor_name?`<br><span class="small-text">Dist: ${esc(r.distributor_name)}</span>`:''}</td>
      <td>${esc(r.platform_name||'')}<br><span class="small-text">${esc(r.product_name||'')}</span></td><td>${esc(r.provider_name||'Sin proveedor')}</td><td>${esc(r.issue_type||'')}</td>
      <td>${esc(r.resolution_type||r.status||'Pendiente')}</td><td>${num(r.refund_amount)>0?`Reembolso ${money(r.refund_amount)}<br>`:''}${num(r.replacement_account_id)>0?`Reemplazo · costo ${money(r.replacement_cost)}`:''}</td>
    </tr>`).join('')}</tbody></table></div>`;
  }

  function render(data){
    cache=data;
    renderSummary(data.summary||{});
    renderProviders(data.profitability?.providers||[]);
    renderMothers(data.profitability?.mother_accounts||[]);
    renderQuality('pqQualityPlatform',data.quality?.by_platform||[]);
    renderQuality('pqQualityProvider',data.quality?.by_provider||[]);
    renderQuality('pqQualitySeller',data.quality?.by_seller||[]);
    renderQuality('pqQualityProduct',data.quality?.by_product||[]);
    renderRecent(data.quality?.recent_reports||[]);
  }

  window.loadProfitQuality=async function(){
    if(!isMain()) return;
    ensureDates();
    const start=document.getElementById('profitQualityStart')?.value||'';
    const end=document.getElementById('profitQualityEnd')?.value||'';
    ['pqProviders','pqMotherAccounts','pqQualityPlatform','pqQualityProvider','pqQualitySeller','pqQualityProduct','pqRecentReports'].forEach(id=>{
      const el=document.getElementById(id); if(el) el.innerHTML='<p class="small-text">Calculando...</p>';
    });
    try{
      const data=await api(`/api/admin/profit-quality?start_date=${encodeURIComponent(start)}&end_date=${encodeURIComponent(end)}`);
      render(data);
    }catch(e){
      if(typeof showMessage==='function') showMessage(e.message||'Error cargando rentabilidad y calidad','error');
    }
  };

  window.saveMotherAnalyticsMeta=async function(id){
    try{
      const provider=(document.getElementById(`pq-provider-${id}`)?.value||'').trim();
      const raw=(document.getElementById(`pq-cost-${id}`)?.value||'').trim();
      const sellByProfile=!!document.getElementById(`pq-by-profile-${id}`)?.checked;
      const countRaw=(document.getElementById(`pq-profile-count-${id}`)?.value||'').trim();
      const profileCostRaw=(document.getElementById(`pq-profile-cost-${id}`)?.value||'').trim();
      const body={
        provider_name:provider,
        purchase_cost_total:raw===''?null:raw,
        sell_by_profile:sellByProfile,
        configured_profile_count:sellByProfile && countRaw!==''?countRaw:null,
        profile_cost_override:sellByProfile && profileCostRaw!==''?profileCostRaw:null
      };
      const result=await api(`/api/admin/mother-accounts/${id}/analytics-meta`,{method:'PATCH',body:JSON.stringify(body)});
      if(typeof showMessage==='function') showMessage(result.message||'Costo actualizado');
      await loadProfitQuality();
      if(typeof loadMasterOperations==='function') loadMasterOperations(false);
    }catch(e){if(typeof showMessage==='function')showMessage(e.message||'Error guardando proveedor/costo','error');}
  };

  if(typeof registerSectionHook==='function'){
    registerSectionHook(function(name){
      setVisibility();
      if(name==='profit-quality' && isMain()) loadProfitQuality();
    });
  }
  if(typeof registerLoadAppHook==='function'){
    registerLoadAppHook(function(){setVisibility();ensureDates();},{name:'profit-quality-admin-v1',order:910});
  }
  setVisibility();
})();
