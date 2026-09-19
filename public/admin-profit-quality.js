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

  function renderMissingMotherAccounts(rows){
    const box=document.getElementById('pqMissingMotherAccounts'); if(!box) return;
    const list=Array.isArray(rows)?rows:[];
    const manual=(cache?.profitability?.mother_accounts||[]).filter(r=>r.id && r.manual_profile_cost_configured);
    if(!list.length && !manual.length){
      box.innerHTML='<div class="pq-inline-ok">✅ No hay cuentas pendientes ni costos manuales por perfil para revisar.</div>';
      return;
    }
    const counts={provider:0,full:0,fullSale:0,profiles:0,profileSale:0};
    list.forEach(r=>{
      if(r.provider_missing)counts.provider++;
      if(r.full_cost_missing)counts.full++;
      if(r.full_sale_missing)counts.fullSale++;
      if(r.profile_count_missing)counts.profiles++;
      if(r.profile_sale_missing)counts.profileSale++;
    });
    const missingHtml=list.length?`
      <div class="pq-missing-summary">
        <div><b>${list.length}</b><span>cuentas con pendientes</span></div>
        <div><b>${counts.provider}</b><span>sin proveedor</span></div>
        <div><b>${counts.full}</b><span>sin costo de compra</span></div>
        <div><b>${counts.fullSale}</b><span>sin venta cuenta completa</span></div>
        <div><b>${counts.profiles}</b><span>sin perfiles totales</span></div>
        <div><b>${counts.profileSale}</b><span>sin venta por perfil</span></div>
      </div>
      <p class="small-text"><b>Regla:</b> la casilla “Esta cuenta también se controla y vende por perfiles” es la que define la modalidad. Si está desactivada se revisa venta de cuenta completa; si está activada se revisan perfiles y precio de venta por perfil. El costo de compra de la cuenta completa se mantiene como base para calcular automáticamente el costo por perfil.</p>
      <div class="table-wrap"><table class="mini-table"><thead><tr><th>Cuenta madre</th><th>Modalidad</th><th>Proveedor</th><th>Costo compra · cuenta</th><th>Dato de venta requerido</th><th>Perfiles</th><th>Acción</th></tr></thead><tbody>
      ${list.map(r=>{
        const byProfile=!!r.sell_by_profile;
        const pending=[];
        if(r.provider_missing)pending.push('Proveedor');
        if(r.full_cost_missing)pending.push('Costo compra · cuenta completa');
        if(byProfile){
          if(r.profile_count_missing)pending.push('Perfiles totales');
          if(r.profile_sale_missing)pending.push('Precio venta · perfil');
        }else if(r.full_sale_missing){
          pending.push('Precio venta · cuenta completa');
        }
        return `<tr class="pq-missing-row" data-mother-id="${num(r.id)}">
          <td><b>#${num(r.id)}</b><br><span class="small-text">${esc(r.account_email||'')}</span><br><span class="small-text">${esc(r.product_name||'Sin producto')}</span></td>
          <td>${byProfile?'👥 Por perfiles':'📱 1 dispositivo / cuenta completa'}</td>
          <td><input id="pq-missing-provider-${num(r.id)}" class="pq-inline-input" value="${esc(r.provider_name||'')}" placeholder="Proveedor"></td>
          <td><input id="pq-missing-full-${num(r.id)}" class="pq-inline-input" type="number" min="0" step="0.01" value="${r.purchase_cost_total===null?'':num(r.purchase_cost_total)}" placeholder="Costo cuenta"></td>
          <td>${byProfile
            ? `<input id="pq-missing-sale-profile-${num(r.id)}" class="pq-inline-input" type="number" min="0" step="0.01" value="${r.sale_price_profile===null?'':num(r.sale_price_profile)}" placeholder="Precio vendedor · perfil">`
            : `<input id="pq-missing-sale-full-${num(r.id)}" class="pq-inline-input" type="number" min="0" step="0.01" value="${r.sale_price_full===null?'':num(r.sale_price_full)}" placeholder="Precio vendedor · cuenta">`}</td>
          <td>${byProfile ? `<input id="pq-missing-count-${num(r.id)}" class="pq-inline-input pq-inline-count" type="number" min="1" max="500" step="1" value="${r.configured_profile_count===null?'':num(r.configured_profile_count)}" placeholder="Total">` : '<span class="small-text">No aplica</span>'}</td>
          <td><div class="pq-missing-actions"><span class="chip error">${esc(pending.join(' · '))}</span><button type="button" class="primary-btn pq-inline-save" onclick="saveMissingMotherAccount(${num(r.id)})">💾 Guardar</button></div></td>
        </tr>`;
      }).join('')}</tbody></table></div>`:'<div class="pq-inline-ok">✅ No hay cuentas con datos obligatorios pendientes.</div>';

    const manualHtml=manual.length?`
      <div class="pq-manual-review" style="margin-top:18px">
        <div class="pq-subhead"><div><span class="pq-mini-label">REVISIÓN</span><h4>⚠️ Cuentas con “Costo manual por perfil” configurado</h4></div></div>
        <p class="small-text">Este campo ya no se necesita para el cálculo normal. El costo por perfil se calcula automáticamente con <b>Costo de compra de la cuenta completa ÷ Perfiles totales</b>. Aquí aparecen únicamente las cuentas que todavía tienen un costo manual guardado para que puedas quitarlo.</p>
        <div class="table-wrap"><table class="mini-table"><thead><tr><th>Cuenta madre</th><th>Proveedor</th><th>Perfiles</th><th>Costo cuenta</th><th>Costo manual guardado</th><th>Acción</th></tr></thead><tbody>
        ${manual.map(r=>`<tr class="pq-missing-row" data-mother-id="${num(r.id)}">
          <td><b>#${num(r.id)}</b><br><span class="small-text">${esc(r.account_email||'')}</span><br>${esc(r.product_name||'Sin producto')}</td>
          <td>${esc(r.provider_name||'Sin proveedor')}</td><td>${num(r.configured_profile_count||r.profile_count||0)}</td><td>${r.purchase_cost_total===null?'—':money(r.purchase_cost_total)}</td><td>${r.profile_cost_override===null?'—':money(r.profile_cost_override)}</td>
          <td><button type="button" class="outline-btn" onclick="clearMotherProfileCostOverride(${num(r.id)})">🧹 Quitar costo manual</button></td>
        </tr>`).join('')}</tbody></table></div>
      </div>`:'';
    box.innerHTML=missingHtml+manualHtml;
  }

  function renderMissingProviderSales(rows){
    const box=document.getElementById('pqMissingProviderSales'); if(!box) return;
    const list=Array.isArray(rows)?rows:[];
    const count=document.getElementById('pqMissingProviderSalesCount');
    if(count) count.textContent=String(list.length);
    if(!list.length){
      box.innerHTML='<div class="pq-inline-ok">✅ No hay ventas pendientes de asignar proveedor.</div>';
      return;
    }
    const linkedCount=list.filter(r=>r.has_mother_account).length;
    const unlinkedCount=list.length-linkedCount;
    box.innerHTML=`
      <div class="pq-missing-provider-summary">
        <div><b>${list.length}</b><span>venta(s) pendientes de proveedor</span></div>
        <p>Esta lista debe coincidir con las ventas que aparecen como <b>“Sin proveedor”</b> en la rentabilidad. ${linkedCount?`<b>${linkedCount}</b> tienen cuenta madre vinculada y se corregirán en la cuenta madre.`:''} ${unlinkedCount?`<b>${unlinkedCount}</b> no conservaron cuenta madre vinculada; en esas ventas el proveedor se guardará directamente en el histórico de la venta.`:''}</p>
      </div>
      <div class="table-wrap"><table class="mini-table pq-provider-pending-table"><thead><tr>
        <th>Fecha</th><th>Venta</th><th>Cuenta / origen</th><th>Vendedor</th><th>Importe</th><th>Costo real</th><th>Proveedor</th><th>Acción</th>
      </tr></thead><tbody>
      ${list.map(r=>{
        const rowKey=`${num(r.mother_account_id||0)}-${num(r.order_id)}`;
        const origin=r.has_mother_account
          ? `<b>Cuenta madre #${num(r.mother_account_id)}</b><br><span class="small-text">${esc(r.account_email||'')}</span><br><span class="small-text">${esc(r.mother_product_name||'')}</span>`
          : `<b>⚠ Sin cuenta madre</b><br><span class="small-text">La venta conserva su entrega, pero no el vínculo con inventario.</span>`;
        return `<tr class="pq-missing-provider-row" data-mother-id="${num(r.mother_account_id)}" data-order-id="${num(r.order_id)}">
          <td>${esc(formatDate(r.created_at))}</td>
          <td><b>#${num(r.order_id)}</b><br><span class="small-text">${esc(r.product_name||'Sin producto')}</span></td>
          <td>${origin}</td>
          <td>${esc(r.seller_name||r.seller_email||'Usuario')}</td>
          <td><b>${money(r.amount)}</b></td>
          <td>${money(r.sale_cost)}<br><span class="small-text">${esc(r.cost_source||'')}</span></td>
          <td><input id="pq-sale-provider-${rowKey}" class="pq-inline-input" list="pqProviderSuggestions" value="" placeholder="Ej. Digitalvnhe" autocomplete="off"></td>
          <td><button type="button" class="primary-btn pq-inline-save" onclick="saveMissingProviderSale(${num(r.mother_account_id)},${num(r.order_id)})">💾 Asignar proveedor</button></td>
        </tr>`;
      }).join('')}
      </tbody></table></div>
      <datalist id="pqProviderSuggestions">${(cache?.profitability?.providers||[]).filter(p=>p.provider_name && p.provider_name!=='Sin proveedor').map(p=>`<option value="${esc(p.provider_name)}"></option>`).join('')}</datalist>
      <p class="small-text pq-provider-pending-note"><b>Importante:</b> los trámites digitales quedan fuera de esta bandeja y de la rentabilidad por proveedor porque no manejan proveedor, cuenta madre ni perfiles. Para las demás ventas: si tienen cuenta madre, se corrige el proveedor de esa cuenta y el histórico; si no tienen cuenta madre, se guarda un proveedor histórico directamente en la venta.</p>`;
  }

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
    renderMissingMotherAccounts(data.profitability?.missing_mother_accounts||[]);
    renderMissingProviderSales(data.profitability?.missing_provider_sales||[]);
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
    ['pqProviders','pqMissingMotherAccounts','pqMissingProviderSales','pqMotherAccounts','pqQualityPlatform','pqQualityProvider','pqQualitySeller','pqQualityProduct','pqRecentReports'].forEach(id=>{
      const el=document.getElementById(id); if(el) el.innerHTML='<p class="small-text">Calculando...</p>';
    });
    try{
      const data=await api(`/api/admin/profit-quality?start_date=${encodeURIComponent(start)}&end_date=${encodeURIComponent(end)}`);
      render(data);
    }catch(e){
      if(typeof showMessage==='function') showMessage(e.message||'Error cargando rentabilidad y calidad','error');
    }
  };

  window.saveMissingProviderSale=async function(motherId,orderId){
    const row=document.querySelector(`.pq-missing-provider-row[data-order-id="${Number(orderId)}"]`);
    const key=`${Number(motherId||0)}-${Number(orderId)}`;
    const input=document.getElementById(`pq-sale-provider-${key}`);
    const btn=row?.querySelector('.pq-inline-save');
    const provider=String(input?.value||'').trim();
    if(!provider){
      if(typeof showMessage==='function') showMessage('Escribe o selecciona el proveedor antes de guardar','error');
      input?.focus();
      return;
    }
    try{
      if(btn){btn.disabled=true;btn.textContent='Guardando...';}
      const result=await api(`/api/admin/profit-quality/orders/${Number(orderId)}/provider`,{
        method:'PATCH',
        body:JSON.stringify({provider_name:provider,mother_account_id:Number(motherId||0)})
      });
      if(typeof showMessage==='function') showMessage(result.message||'Proveedor asignado correctamente');
      await loadProfitQuality();
    }catch(e){
      if(typeof showMessage==='function') showMessage(e.message||'Error asignando proveedor','error');
      if(btn){btn.disabled=false;btn.textContent='💾 Asignar proveedor';}
    }
  };

  window.saveMissingMotherAccount=async function(id){
    const btn=document.querySelector(`.pq-missing-row[data-mother-id="${id}"] .pq-inline-save`);
    try{
      if(btn){btn.disabled=true;btn.textContent='Guardando...';}
      const provider=(document.getElementById(`pq-missing-provider-${id}`)?.value||'').trim();
      const fullRaw=(document.getElementById(`pq-missing-full-${id}`)?.value||'').trim();
      const countEl=document.getElementById(`pq-missing-count-${id}`);
      const saleProfileEl=document.getElementById(`pq-missing-sale-profile-${id}`);
      const saleFullEl=document.getElementById(`pq-missing-sale-full-${id}`);
      const row=cache?.profitability?.missing_mother_accounts?.find(x=>Number(x.id)===Number(id));
      const byProfile=!!row?.sell_by_profile;
      const countRaw=countEl?.value?.trim()||'';
      const saleProfileRaw=saleProfileEl?.value?.trim()||'';
      const saleFullRaw=saleFullEl?.value?.trim()||'';
      const body={
        provider_name:provider,
        purchase_cost_total:fullRaw===''?null:fullRaw,
        sell_by_profile:byProfile,
        configured_profile_count:byProfile?(countRaw===''?null:countRaw):null,
        profile_cost_override:null,
        sale_price_full:byProfile?null:(saleFullRaw===''?null:saleFullRaw),
        sale_price_profile:byProfile?(saleProfileRaw===''?null:saleProfileRaw):null,
        partial_update:true
      };
      const result=await api(`/api/admin/mother-accounts/${id}/analytics-meta`,{method:'PATCH',body:JSON.stringify(body)});
      if(typeof showMessage==='function') showMessage(result.message||'Cuenta madre actualizada');
      await loadProfitQuality();
    }catch(e){
      if(typeof showMessage==='function') showMessage(e.message||'Error guardando cuenta madre','error');
      if(btn){btn.disabled=false;btn.textContent='💾 Guardar';}
    }
  };

  window.clearMotherProfileCostOverride=async function(id){
    try{
      const result=await api(`/api/admin/mother-accounts/${id}/analytics-meta`,{method:'PATCH',body:JSON.stringify({partial_update:true,clear_profile_cost_override:true})});
      if(typeof showMessage==='function') showMessage(result.message||'Costo manual eliminado; ahora se calculará automáticamente.');
      await loadProfitQuality();
    }catch(e){
      if(typeof showMessage==='function') showMessage(e.message||'Error eliminando costo manual','error');
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
