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

  window.setProfitQualityAllHistory=function(){
    const end=new Date();
    const a=document.getElementById('profitQualityStart');
    const b=document.getElementById('profitQualityEnd');
    if(a) a.value='2000-01-01';
    if(b) b.value=isoLocal(end);
    return loadProfitQuality();
  };

  function ensureDates(){
    const start=document.getElementById('profitQualityStart');
    const end=document.getElementById('profitQualityEnd');
    if(!start || !end) return;
    if(!end.value) end.value=isoLocal(new Date());
    if(!start.value){
      const d=new Date(); d.setDate(d.getDate()-29);
      start.value=isoLocal(d);
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
    box.innerHTML=`<div class="pq-provider-grid">${rows.map(r=>`<article class="pq-provider-card">
      <div class="pq-provider-head"><div><span class="pq-mini-label">PROVEEDOR</span><h3>${esc(r.provider_name||'Sin proveedor')}</h3></div><span class="pq-provider-count">${num(r.mother_accounts)} cuenta(s)</span></div>
      ${r.mother_cost_missing?`<div class="pq-inline-warning">⚠ ${num(r.mother_cost_missing)} cuenta(s) sin costo configurado</div>`:''}
      <div class="pq-provider-section-title">Periodo seleccionado</div>
      <div class="pq-provider-metrics">
        <div><span>Ventas</span><b>${num(r.orders)}</b></div>
        <div><span>Ingreso admin</span><b>${money(r.admin_revenue)}</b></div>
        <div><span>Costo vendido</span><b>${money(r.sale_cost)}</b></div>
        <div><span>Reemplazos</span><b>${money(r.replacement_cost)}</b></div>
        <div><span>Utilidad</span><b class="${num(r.profit)<0?'error':'success'}">${money(r.profit)}</b></div>
        <div><span>Margen</span><b>${pct(r.margin_percent)}</b></div>
      </div>
      <div class="pq-provider-section-title historical">Histórico acumulado</div>
      <div class="pq-provider-metrics pq-provider-history">
        <div><span>Inversión</span><b>${money(r.registered_mother_cost)}</b></div>
        <div><span>Unidades detectadas</span><b>${num(r.lifetime_units)}</b></div>
        <div><span>Ingreso</span><b>${money(r.lifetime_revenue)}</b></div>
        <div><span>Costo consumido</span><b>${money(r.lifetime_sale_cost)}</b></div>
        <div><span>Utilidad histórica</span><b class="${num(r.lifetime_profit)<0?'error':'success'}">${money(r.lifetime_profit)}</b></div>
        <div><span>Margen histórico</span><b>${pct(r.lifetime_margin_percent)}</b></div>
      </div>
      ${num(r.inferred_units)>0?`<div class="pq-estimate-note">${num(r.inferred_units)} unidad(es) históricas estimadas por movimiento de inventario sin pedido enlazado.</div>`:''}
      <div class="pq-provider-foot"><span>Fallas periodo <b>${num(r.failures)}</b></span><span>Tasa <b>${pct(r.failure_rate)}</b></span></div>
    </article>`).join('')}</div>`;
  }

  window.updateMotherCostPreview=function(id){
    const editor=document.getElementById(`pq-editor-${id}`);
    const totalRaw=(document.getElementById(`pq-cost-${id}`)?.value||'').trim();
    const total=totalRaw===''?null:Number(totalRaw);
    const byProfile=!!document.getElementById(`pq-by-profile-${id}`)?.checked;
    const countRaw=(document.getElementById(`pq-profile-count-${id}`)?.value||'').trim();
    const count=countRaw===''?0:Number(countRaw);
    const overrideRaw=(document.getElementById(`pq-profile-cost-${id}`)?.value||'').trim();
    const override=overrideRaw===''?null:Number(overrideRaw);
    const fullSaleRaw=(document.getElementById(`pq-sale-full-${id}`)?.value||'').trim();
    const profileSaleRaw=(document.getElementById(`pq-sale-profile-${id}`)?.value||'').trim();
    const fullSale=fullSaleRaw===''?null:Number(fullSaleRaw);
    const profileSale=profileSaleRaw===''?null:Number(profileSaleRaw);
    const productSale=Number(editor?.dataset.productSale||0);
    const group=document.getElementById(`pq-profile-settings-${id}`);
    if(group) group.classList.toggle('hidden',!byProfile);
    let effective=null, label='Sin costo configurado';
    if(byProfile){
      if(override!==null && Number.isFinite(override) && override>=0){effective=override;label='Costo manual por perfil';}
      else if(total!==null && Number.isFinite(total) && count>0){effective=total/count;label='Costo calculado por perfil';}
    }else if(total!==null && Number.isFinite(total) && total>=0){effective=total;label='Costo por cuenta completa';}
    let referenceSale=byProfile?profileSale:fullSale;
    let saleSource='precio capturado';
    if(referenceSale===null || !Number.isFinite(referenceSale)){referenceSale=productSale>0?productSale:null;saleSource='precio actual de Productos';}
    const unitProfit=effective!==null && referenceSale!==null ? referenceSale-effective : null;
    const margin=referenceSale>0 && unitProfit!==null ? (unitProfit/referenceSale)*100 : null;
    const preview=document.getElementById(`pq-cost-preview-${id}`);
    if(preview) preview.innerHTML=`
      <div><span>${esc(label)}</span><b>${effective===null?'—':money(effective)}</b></div>
      <div><span>Venta referencia · ${esc(saleSource)}</span><b>${referenceSale===null?'—':money(referenceSale)}</b></div>
      <div><span>Utilidad por unidad</span><b class="${unitProfit!==null&&unitProfit<0?'error':'success'}">${unitProfit===null?'—':money(unitProfit)}</b>${margin===null?'':`<small>${margin.toFixed(1)}% margen</small>`}</div>`;
  };

  function renderMothers(rows){
    const box=document.getElementById('pqMotherAccounts'); if(!box) return;
    const active=(rows||[]).filter(r=>r.id);
    if(!active.length){box.innerHTML='<p class="small-text">Sin cuentas madre.</p>';return;}
    box.innerHTML=`<div class="pq-mother-list">${active.map(r=>{
      const inferred=num(r.inferred_unlinked_units);
      const soldDetected=num(r.inventory_sale_cycles);
      const linked=num(r.lifetime_linked_units);
      const reference=r.reference_sale_price===null?'—':money(r.reference_sale_price);
      return `<article class="pq-mother-card">
        <header class="pq-mother-head">
          <div><span class="pq-mini-label">CUENTA MADRE #${num(r.id)}</span><h3>${esc(r.product_name||'Sin producto')}</h3><p>${esc(r.account_email||'')}</p></div>
          <div class="pq-head-badges">${statusChip(r)}<span class="pq-provider-pill">${esc(r.provider_name||'Sin proveedor')}</span></div>
        </header>
        <div class="pq-mother-body">
          <section id="pq-editor-${r.id}" class="pq-finance-editor" data-product-sale="${num(r.product_sale_price)}">
            <div class="pq-subhead"><div><span class="pq-mini-label">CONFIGURACIÓN FINANCIERA</span><h4>Compra y precio de venta</h4></div></div>
            <div class="pq-form-grid">
              <label>Proveedor<input id="pq-provider-${r.id}" value="${esc(r.provider_name||'')}" placeholder="Ej. Digitalvnhe"/></label>
              <label>Costo de compra · cuenta completa<input id="pq-cost-${r.id}" type="number" min="0" step="0.01" value="${r.purchase_cost_total===null?'':num(r.purchase_cost_total)}" placeholder="Ej. 200.00" oninput="updateMotherCostPreview(${r.id})"/></label>
              <label>Precio de venta al vendedor · cuenta completa<input id="pq-sale-full-${r.id}" type="number" min="0" step="0.01" value="${r.sale_price_full===null?'':num(r.sale_price_full)}" placeholder="Ej. 300.00" oninput="updateMotherCostPreview(${r.id})"/></label>
            </div>
            <label class="pq-check pq-wide-check"><input id="pq-by-profile-${r.id}" type="checkbox" ${r.sell_by_profile?'checked':''} onchange="updateMotherCostPreview(${r.id})"/> <span>Esta cuenta también se controla y vende por perfiles</span></label>
            <div id="pq-profile-settings-${r.id}" class="pq-profile-settings pq-profile-settings-v13 ${r.sell_by_profile?'':'hidden'}">
              <label>Perfiles totales<input id="pq-profile-count-${r.id}" type="number" min="1" max="500" step="1" value="${r.configured_profile_count===null?'':num(r.configured_profile_count)}" placeholder="Ej. 7" oninput="updateMotherCostPreview(${r.id})"/></label>
              <label>Costo manual por perfil <small>(opcional)</small><input id="pq-profile-cost-${r.id}" type="number" min="0" step="0.01" value="${r.profile_cost_override===null?'':num(r.profile_cost_override)}" placeholder="Vacío = costo ÷ perfiles" oninput="updateMotherCostPreview(${r.id})"/></label>
              <label>Precio de venta al vendedor · perfil<input id="pq-sale-profile-${r.id}" type="number" min="0" step="0.01" value="${r.sale_price_profile===null?'':num(r.sale_price_profile)}" placeholder="Ej. 60.00" oninput="updateMotherCostPreview(${r.id})"/></label>
            </div>
            <div id="pq-cost-preview-${r.id}" class="pq-cost-preview pq-cost-preview-v13"></div>
            <div class="pq-product-reference">Productos actualmente: venta <b>${money(r.product_sale_price)}</b> · costo <b>${money(r.product_cost_price)}</b>. Sólo se usa como respaldo cuando esta cuenta no tiene precio/costo propio.</div>
            <button class="primary-btn pq-save-cost" onclick="saveMotherAnalyticsMeta(${r.id})">Guardar configuración financiera</button>
          </section>

          <section class="pq-account-stats">
            <div class="pq-subhead"><div><span class="pq-mini-label">INVENTARIO</span><h4>Movimiento de perfiles</h4></div></div>
            <div class="pq-stat-grid">
              <div><span>Perfiles cargados</span><b>${num(r.profile_count)}</b></div>
              <div><span>Disponibles ahora</span><b>${num(r.available_profiles)}</b></div>
              <div><span>Entregados ahora</span><b>${num(r.delivered_profiles)}</b></div>
              <div><span>Ventas detectadas históricas</span><b>${soldDetected}</b></div>
            </div>
            <div class="pq-cost-line"><span>Costo usado por unidad</span><b>${r.effective_unit_cost===null?'—':money(r.effective_unit_cost)}</b></div>
            <div class="pq-cost-line"><span>Precio de venta referencia</span><b>${reference}</b></div>
            ${inferred>0?`<div class="pq-inline-warning">⚠ ${inferred} unidad(es) salieron del inventario sin un pedido histórico enlazado. El histórico inferior las estima con el precio de venta configurado.</div>`:''}
          </section>

          <section class="pq-period-card">
            <span class="pq-mini-label">PERIODO SELECCIONADO</span><h4>Rentabilidad real del rango</h4>
            <div class="pq-stat-grid compact">
              <div><span>Pedidos</span><b>${num(r.orders)}</b></div>
              <div><span>Ingreso admin</span><b>${money(r.admin_revenue)}</b></div>
              <div><span>Costo vendido</span><b>${money(r.sale_cost)}</b></div>
              <div><span>Reemplazos</span><b>${money(r.replacement_cost)}</b></div>
              <div><span>Utilidad</span><b class="${num(r.profit)<0?'error':'success'}">${money(r.profit)}</b></div>
              <div><span>Margen</span><b>${pct(r.margin_percent)}</b></div>
            </div>
          </section>

          <section class="pq-lifetime-card">
            <span class="pq-mini-label">HISTÓRICO DE LA CUENTA</span><h4>Lo que ya ha producido esta cuenta</h4>
            <div class="pq-stat-grid compact">
              <div><span>Unidades ligadas a pedidos</span><b>${linked}</b></div>
              <div><span>Pedidos históricos</span><b>${num(r.lifetime_orders)}</b></div>
              <div><span>Ingreso histórico</span><b>${money(r.lifetime_revenue)}</b></div>
              <div><span>Costo consumido</span><b>${money(r.lifetime_sale_cost)}</b></div>
              <div><span>Utilidad bruta histórica</span><b class="${num(r.lifetime_profit)<0?'error':'success'}">${money(r.lifetime_profit)}</b></div>
              <div><span>Margen histórico</span><b>${pct(r.lifetime_margin_percent)}</b></div>
            </div>
            ${num(r.lifetime_inferred_revenue)>0?`<p class="pq-estimate-note">Incluye <b>${money(r.lifetime_inferred_revenue)}</b> estimados por ${inferred} unidad(es) sin pedido enlazado. Las ventas con pedido siempre usan su importe real.</p>`:''}
          </section>
        </div>
      </article>`;
    }).join('')}</div>`;
    active.forEach(r=>updateMotherCostPreview(r.id));
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
      const fullSaleRaw=(document.getElementById(`pq-sale-full-${id}`)?.value||'').trim();
      const profileSaleRaw=(document.getElementById(`pq-sale-profile-${id}`)?.value||'').trim();
      const body={
        provider_name:provider,
        purchase_cost_total:raw===''?null:raw,
        sell_by_profile:sellByProfile,
        configured_profile_count:sellByProfile && countRaw!==''?countRaw:null,
        profile_cost_override:sellByProfile && profileCostRaw!==''?profileCostRaw:null,
        sale_price_full:fullSaleRaw===''?null:fullSaleRaw,
        sale_price_profile:sellByProfile && profileSaleRaw!==''?profileSaleRaw:null
      };
      const result=await api(`/api/admin/mother-accounts/${id}/analytics-meta`,{method:'PATCH',body:JSON.stringify(body)});
      if(typeof showMessage==='function') showMessage(result.message||'Configuración financiera actualizada');
      await loadProfitQuality();
      if(typeof loadMasterOperations==='function') loadMasterOperations(false);
    }catch(e){if(typeof showMessage==='function')showMessage(e.message||'Error guardando configuración financiera','error');}
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
