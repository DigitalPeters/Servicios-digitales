(function(){
  'use strict';

  const esc = value => typeof safeText === 'function' ? safeText(value) : String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money = value => Number(value || 0).toLocaleString('es-MX',{minimumFractionDigits:2,maximumFractionDigits:2});
  const isMain = () => typeof isMainAdminPrincipal === 'function' && isMainAdminPrincipal();
  let quickOptions = {users:[],products:[]};
  let quickQuote = null;
  let searchTimer = null;

  function addModal(id, title, content){
    if(document.getElementById(id)) return document.getElementById(id);
    const el=document.createElement('div');
    el.id=id;
    el.className='master-v14-modal hidden';
    el.innerHTML=`<div class="master-v14-backdrop" data-close="${id}"></div><div class="master-v14-dialog" role="dialog" aria-modal="true"><div class="master-v14-dialog-head"><div><span class="master-eyebrow">VERSIÓN MAESTRA</span><h2>${esc(title)}</h2></div><button type="button" class="master-v14-x" data-close="${id}">×</button></div><div class="master-v14-dialog-body">${content}</div></div>`;
    document.body.appendChild(el);
    el.querySelectorAll(`[data-close="${id}"]`).forEach(btn=>btn.addEventListener('click',()=>closeModal(id)));
    return el;
  }
  function openModal(id){document.getElementById(id)?.classList.remove('hidden');document.body.classList.add('master-v14-modal-open');}
  function closeModal(id){document.getElementById(id)?.classList.add('hidden');if(!document.querySelector('.master-v14-modal:not(.hidden)'))document.body.classList.remove('master-v14-modal-open');}

  function ensureV14UI(){
    if(!isMain()) return;
    const controls=document.querySelector('#masterOperationsPanel .master-command-controls');
    if(controls && !document.getElementById('masterGlobalSearchBtn')){
      const search=document.createElement('button');
      search.id='masterGlobalSearchBtn';search.className='master-tool-btn';search.innerHTML='🧬 <span>Trazabilidad</span>';
      search.onclick=openMasterGlobalSearch;
      controls.insertBefore(search,controls.firstChild);
      const sale=document.createElement('button');
      sale.id='masterQuickSaleBtn';sale.className='master-tool-btn master-tool-btn-primary';sale.innerHTML='＋ <span>Venta rápida</span>';
      sale.onclick=openMasterQuickSale;
      controls.insertBefore(sale,controls.firstChild);
    }

    const modules=document.querySelector('#masterOperationsPanel .master-module-grid');
    // Pedidos por atender, fallas pendientes y saldo por validar ya viven en los KPI superiores.
    // Evitamos repetir esos accesos en la zona de gestión.
    document.getElementById('masterManualDeliveriesModule')?.remove();
    document.getElementById('masterQuickSaleModule')?.remove();
    if(modules){
      if(!document.getElementById('masterStorePreviewModule')){
        const shop=document.createElement('button');
        shop.id='masterStorePreviewModule';shop.className='master-module master-module-store';shop.innerHTML='<span class="master-module-icon">🛒</span><span><b>Tienda</b><small>Validar precios por vendedor</small></span><i>→</i>';
        shop.onclick=openMasterStorePreview;
        modules.prepend(shop);
      }
      if(!document.getElementById('masterSuppliersModule')){
        const supplier=document.createElement('button');
        supplier.id='masterSuppliersModule';supplier.className='master-module';supplier.innerHTML='<span class="master-module-icon">🚚</span><span><b>Proveedores</b><small>Compras e inversión</small></span><i>→</i>';
        supplier.onclick=openMasterSuppliers;
        modules.appendChild(supplier);
      }
    }

    const admin=document.getElementById('section-admin');
    if(admin && !document.getElementById('masterSuppliersPanel')){
      const panel=document.createElement('div');
      panel.id='masterSuppliersPanel';panel.className='panel master-data-panel master-suppliers-panel';
      panel.innerHTML=`
        <div class="panel-head"><div><div class="master-kicker">COMPRAS E INVENTARIO</div><h2>Proveedores</h2><p class="small-text">Registra a quién compras, cuánto inviertes y conserva un historial independiente de las cuentas madre.</p></div><button class="outline-btn" style="width:auto" onclick="loadMasterSuppliers()">Actualizar</button></div>
        <div class="master-supplier-forms">
          <form id="masterSupplierForm" class="master-v14-form-card">
            <h3>Guardar proveedor</h3>
            <input id="masterSupplierName" placeholder="Nombre del proveedor" required />
            <div class="two-row"><input id="masterSupplierContact" placeholder="Contacto"/><input id="masterSupplierPhone" placeholder="WhatsApp / teléfono"/></div>
            <input id="masterSupplierEmail" type="email" placeholder="Correo (opcional)"/>
            <textarea id="masterSupplierNotes" placeholder="Notas, condiciones, plataformas, horarios…"></textarea>
            <button class="primary-btn" type="submit">Guardar proveedor</button>
          </form>
          <form id="masterPurchaseForm" class="master-v14-form-card">
            <h3>Registrar compra de inventario</h3>
            <select id="masterPurchaseSupplier"><option value="">Selecciona proveedor</option></select>
            <input id="masterPurchaseSupplierText" placeholder="O escribe proveedor"/>
            <div class="two-row"><input id="masterPurchaseDate" type="date"/><input id="masterPurchaseCount" type="number" min="1" value="1" placeholder="Unidades/cuentas"/></div>
            <input id="masterPurchaseDescription" placeholder="Ej. 3 cuentas Netflix / 20 perfiles"/>
            <input id="masterPurchaseTotal" type="number" min="0" step="0.01" placeholder="Total pagado" required/>
            <textarea id="masterPurchaseNotes" placeholder="Referencia, renovación, observaciones…"></textarea>
            <button class="green-btn" type="submit">Registrar compra</button>
          </form>
        </div>
        <div class="master-v14-subhead"><h3>Resumen de proveedores</h3><span>Inversión en cuentas + compras registradas</span></div>
        <div id="masterSuppliersList" class="master-supplier-grid"><div class="small-text">Abre el módulo para cargar proveedores.</div></div>
        <div class="master-v14-subhead"><h3>Últimas compras</h3><span>Historial administrativo</span></div>
        <div id="masterPurchasesList"></div>`;
      admin.appendChild(panel);
      panel.querySelector('#masterSupplierForm')?.addEventListener('submit',saveMasterSupplier);
      panel.querySelector('#masterPurchaseForm')?.addEventListener('submit',saveMasterPurchase);
    }

    ensureQuickSaleModal();
    ensureStorePreviewModal();
    ensureSearchModal();
    ensureUser360Modal();
    ensureManualDeliveriesModal();
  }

  function ensureQuickSaleModal(){
    const modal=addModal('masterQuickSaleModal','Venta rápida · Cliente final',`
      <div class="master-v14-callout"><b>Venta directa de Servicios Digitales Peters a tu cliente final.</b><span>No selecciona vendedor ni distribuidor y no descuenta saldos. Registra al cliente, el producto y lo que realmente cobraste.</span></div>
      <form id="masterQuickSaleForm" class="master-v14-form">
        <div class="master-v14-grid3">
          <label>Nombre del cliente final<input id="masterQuickCustomerName" placeholder="Ej. Juan Pérez" required/></label>
          <label>WhatsApp / teléfono<input id="masterQuickCustomerPhone" placeholder="Opcional"/></label>
          <label>Correo<input id="masterQuickCustomerEmail" type="email" placeholder="Opcional"/></label>
        </div>
        <label>Producto<select id="masterQuickProduct" required><option value="">Selecciona…</option></select></label>
        <div id="masterQuickQuote" class="master-v14-quote">Selecciona un producto.</div>
        <div id="masterQuickRequiredFields" class="master-v14-grid2"></div>
        <div class="master-v14-grid3"><label>Monto cobrado al cliente<input id="masterQuickAmount" type="number" min="0" step="0.01" required/></label><label>Método de pago<select id="masterQuickPayment"><option value="transferencia">Transferencia</option><option value="efectivo">Efectivo</option><option value="tarjeta">Tarjeta</option><option value="otro">Otro</option></select></label><label>Nota<input id="masterQuickNote" placeholder="Opcional"/></label></div>
        <div class="master-v14-checks"><label><input id="masterQuickAutoDeliver" type="checkbox" checked/> Entrega automática si aplica</label><label><input id="masterQuickSuccess" type="checkbox" checked/> Marcar éxito cuando no requiera entrega</label></div>
        <div id="masterQuickResult"></div>
        <div class="master-v14-footer"><button type="button" class="outline-btn" onclick="closeMasterQuickSale()">Cancelar</button><button type="submit" class="primary-btn">Registrar venta al cliente</button></div>
      </form>`);
    const form=modal.querySelector('#masterQuickSaleForm');
    if(form && !form.dataset.bound){form.dataset.bound='1';form.addEventListener('submit',submitMasterQuickSale);}
    const product=document.getElementById('masterQuickProduct');
    if(product&&!product.dataset.quoteBound){product.dataset.quoteBound='1';product.addEventListener('change',refreshQuickQuote);}
  }

  async function openMasterQuickSale(){
    ensureV14UI();openModal('masterQuickSaleModal');
    const result=document.getElementById('masterQuickResult');if(result)result.innerHTML='';
    try{
      quickOptions=await api('/api/admin/master/quick-sale/options');
      const p=document.getElementById('masterQuickProduct');
      if(p)p.innerHTML='<option value="">Selecciona producto…</option>'+(quickOptions.products||[]).map(x=>`<option value="${x.id}">${esc(x.name)} · ${esc(x.category||'')} · $${money(x.price)} · stock ${Number(x.stock||0)}</option>`).join('');
      if(p?.value)await refreshQuickQuote();
    }catch(e){if(result)result.innerHTML=`<div class="master-v14-error">${esc(e.message||'No se pudieron cargar productos')}</div>`;}
  }
  window.openMasterQuickSale=openMasterQuickSale;
  window.closeMasterQuickSale=()=>closeModal('masterQuickSaleModal');

  async function refreshQuickQuote(){
    const productId=document.getElementById('masterQuickProduct')?.value;
    const quote=document.getElementById('masterQuickQuote');
    if(!productId){quickQuote=null;if(quote)quote.textContent='Selecciona un producto.';return;}
    try{
      quickQuote=await api(`/api/admin/master/quick-sale/quote?product_id=${encodeURIComponent(productId)}`);
      const amount=document.getElementById('masterQuickAmount');if(amount)amount.value=Number(quickQuote.amount||0).toFixed(2);
      if(quote)quote.innerHTML=`<span><b>${esc(quickQuote.product?.name)}</b><small>Precio base $${money(quickQuote.amount)} · stock ${Number(quickQuote.product?.stock||0)}</small></span><span><b>Cliente final</b><small>Puedes ajustar el monto cobrado antes de registrar.</small></span>`;
      const fields=document.getElementById('masterQuickRequiredFields');
      if(fields){const list=Array.isArray(quickQuote.product?.required_fields)?quickQuote.product.required_fields:[];fields.innerHTML=list.map((f,i)=>`<label>${esc(f)}<input class="master-quick-extra" data-field="${esc(f)}" id="masterQuickExtra${i}" required/></label>`).join('');}
    }catch(e){if(quote)quote.innerHTML=`<span class="master-v14-error">${esc(e.message||'No se pudo cotizar')}</span>`;}
  }

  async function submitMasterQuickSale(ev){
    ev.preventDefault();
    const result=document.getElementById('masterQuickResult');
    try{
      const orderData={};document.querySelectorAll('.master-quick-extra').forEach(input=>orderData[input.dataset.field]=input.value.trim());
      const payload={
        customer_mode:'final',product_id:Number(document.getElementById('masterQuickProduct').value),
        final_customer:{name:document.getElementById('masterQuickCustomerName').value.trim(),phone:document.getElementById('masterQuickCustomerPhone').value.trim(),email:document.getElementById('masterQuickCustomerEmail').value.trim()},
        amount:Number(document.getElementById('masterQuickAmount').value),payment_method:document.getElementById('masterQuickPayment').value,
        note:document.getElementById('masterQuickNote').value,auto_deliver:document.getElementById('masterQuickAutoDeliver').checked,
        mark_success:document.getElementById('masterQuickSuccess').checked,order_data:orderData
      };
      if(result)result.innerHTML='<div class="small-text">Registrando venta al cliente…</div>';
      const d=await api('/api/admin/master/quick-sale',{method:'POST',body:JSON.stringify(payload)});
      if(result)result.innerHTML=`<div class="master-v14-success"><b>✓ ${esc(d.message)}</b><span>${esc(d.customer_name||'Cliente final')} · Pedido #${Number(d.order_id)} · $${money(d.amount)}${d.immediate_delivery?' · entrega automática':''}</span></div>`;
      if(typeof loadMasterOperations==='function')loadMasterOperations(false);
      if(typeof loadAdminOrders==='function')loadAdminOrders();
      await refreshQuickQuote();
    }catch(e){if(result)result.innerHTML=`<div class="master-v14-error">${esc(e.message||'No se pudo registrar la venta')}</div>`;}
  }

  let masterStoreProducts=[];
  function ensureStorePreviewModal(){
    const modal=addModal('masterStorePreviewModal','Tienda · Validar precios',`
      <div class="master-v14-callout"><b>Comprueba exactamente el precio que verá cada vendedor o distribuidor.</b><span>Selecciona una persona y compara su precio efectivo contra el precio base configurado en Productos.</span></div>
      <div class="master-store-toolbar">
        <label>Ver precios como<select id="masterStoreViewer"><option value="">Cliente final / precio base</option></select></label>
        <label>Buscar producto<input id="masterStoreSearch" placeholder="Nombre o categoría"/></label>
        <button type="button" class="outline-btn" id="masterStoreOpenBaseBtn">Abrir tienda base</button>
      </div>
      <div id="masterStoreViewerInfo" class="master-store-viewer-info"></div>
      <div id="masterStorePreviewList" class="master-store-preview-list"><div class="master-v14-empty">Abre la tienda para cargar precios.</div></div>`);
    const viewer=modal.querySelector('#masterStoreViewer');
    if(viewer&&!viewer.dataset.bound){viewer.dataset.bound='1';viewer.addEventListener('change',loadMasterStorePreview);}
    const search=modal.querySelector('#masterStoreSearch');
    if(search&&!search.dataset.bound){search.dataset.bound='1';search.addEventListener('input',renderMasterStorePreview);}
    const base=modal.querySelector('#masterStoreOpenBaseBtn');
    if(base&&!base.dataset.bound){base.dataset.bound='1';base.addEventListener('click',()=>{closeModal('masterStorePreviewModal');if(typeof showSection==='function')showSection('shop');});}
  }

  async function openMasterStorePreview(){
    ensureV14UI();openModal('masterStorePreviewModal');
    const list=document.getElementById('masterStorePreviewList');if(list)list.innerHTML='<div class="small-text">Cargando precios…</div>';
    try{
      const d=await api('/api/admin/master/store-preview/options');
      const select=document.getElementById('masterStoreViewer');
      if(select){
        const current=select.value;
        select.innerHTML='<option value="">Cliente final / precio base</option>'+(d.viewers||[]).map(v=>`<option value="${v.id}">${esc(v.type)} · ${esc(v.name||v.email)}</option>`).join('');
        if([...select.options].some(o=>o.value===current))select.value=current;
      }
      await loadMasterStorePreview();
    }catch(e){if(list)list.innerHTML=`<div class="master-v14-error">${esc(e.message||'No se pudo abrir la tienda')}</div>`;}
  }
  window.openMasterStorePreview=openMasterStorePreview;

  async function loadMasterStorePreview(){
    const list=document.getElementById('masterStorePreviewList');if(list)list.innerHTML='<div class="small-text">Calculando precios visibles…</div>';
    try{
      const userId=document.getElementById('masterStoreViewer')?.value||'';
      const d=await api(`/api/admin/master/store-preview${userId?`?user_id=${encodeURIComponent(userId)}`:''}`);
      masterStoreProducts=Array.isArray(d.products)?d.products:[];
      const info=document.getElementById('masterStoreViewerInfo');
      if(info)info.innerHTML=`<b>${esc(d.viewer?.type||'Vista')}</b><span>${esc(d.viewer?.name||'Cliente final / precio base')}${d.viewer?.email?` · ${esc(d.viewer.email)}`:''}</span>`;
      renderMasterStorePreview();
    }catch(e){if(list)list.innerHTML=`<div class="master-v14-error">${esc(e.message||'No se pudieron calcular los precios')}</div>`;}
  }
  window.loadMasterStorePreview=loadMasterStorePreview;

  function renderMasterStorePreview(){
    const list=document.getElementById('masterStorePreviewList');if(!list)return;
    const term=String(document.getElementById('masterStoreSearch')?.value||'').trim().toLowerCase();
    const rows=masterStoreProducts.filter(p=>!term||String(p.name||'').toLowerCase().includes(term)||String(p.category||'').toLowerCase().includes(term));
    if(!rows.length){list.innerHTML='<div class="master-v14-empty">No hay productos que coincidan.</div>';return;}
    list.innerHTML=rows.map(p=>{
      const changed=Math.abs(Number(p.price||0)-Number(p.base_price||0))>.009;
      const stockLabel=Number(p.reusable_stock||0)===1?'Sin límite':(Number(p.stock_enabled||0)===1?`${Number(p.stock||0)} disponibles`:'Según producto');
      return `<article class="master-store-product"><div><small>${esc(p.category||'Otros')}</small><b>${esc(p.name||'Producto')}</b><span>${esc(stockLabel)}</span></div><div class="master-store-price"><small>Precio visible</small><b>$${money(p.price)}</b>${changed?`<span>Base $${money(p.base_price)}</span>`:'<span>Precio base</span>'}</div></article>`;
    }).join('');
  }

  function ensureSearchModal(){
    const modal=addModal('masterGlobalSearchModal','Trazabilidad y búsqueda global',`
      <div class="master-v15-trace-help"><b>🧬 Busca una cuenta, perfil, PIN, pedido, vendedor o distribuidor.</b><span>Verás ingreso al inventario, garantía de 30 días, ventas, pedidos, fallas, reemplazos y recuperaciones cuando exista historial.</span></div>
      <div class="master-search-box"><span>⌕</span><input id="masterGlobalSearchInput" placeholder="Cuenta madre, perfil, PIN, pedido, vendedor, distribuidor…" autocomplete="off"/></div>
      <div id="masterGlobalSearchResults" class="master-search-results"><div class="master-v14-empty">Escribe al menos 2 caracteres.</div></div>`);
    const input=modal.querySelector('#masterGlobalSearchInput');
    if(input&&!input.dataset.bound){input.dataset.bound='1';input.addEventListener('input',()=>{clearTimeout(searchTimer);searchTimer=setTimeout(runMasterGlobalSearch,250);});}
  }
  function openMasterGlobalSearch(){ensureV14UI();openModal('masterGlobalSearchModal');setTimeout(()=>document.getElementById('masterGlobalSearchInput')?.focus(),50);}
  window.openMasterGlobalSearch=openMasterGlobalSearch;
  window.closeMasterGlobalSearch=()=>closeModal('masterGlobalSearchModal');

  function listFromJson(value){
    if(Array.isArray(value)) return value;
    if(!value) return [];
    try{const parsed=typeof value==='string'?JSON.parse(value):value;return Array.isArray(parsed)?parsed:[];}catch(_){return [];}
  }
  function fmtDate(value){if(!value)return '-';const d=new Date(value);return Number.isNaN(d.getTime())?String(value).slice(0,10):d.toLocaleString('es-MX');}
  function uniqueById(rows,key='orden_id'){const seen=new Set();return rows.filter(x=>{const v=String(x?.[key]??'');if(!v||seen.has(v))return false;seen.add(v);return true;});}
  function buildTracePreview(trace){
    const events=Array.isArray(trace?.events)?trace.events:[];
    if(!events.length)return '';
    const first=events[0]||{};
    const sales=uniqueById(events.flatMap(e=>listFromJson(e.ventas_historial)),'orden_id');
    const reports=uniqueById(events.flatMap(e=>listFromJson(e.reportes_historial)),'id');
    const recoveries=events.flatMap(e=>listFromJson(e.recuperaciones_historial));
    const sources=[...new Set(events.map(e=>e.ingreso_origen).filter(Boolean))];
    const replacementUse=reports.filter(r=>r.papel==='usada_como_reemplazo');
    const reported=reports.filter(r=>r.papel==='reportada'||r.papel==='relacionada');
    const latestSale=sales[0];
    window.masterLastTraceEvents=events;
    return `<section class="master-trace-preview">
      <div class="master-trace-preview-head"><div><span class="master-eyebrow">TRAZABILIDAD</span><h3>${esc(first.product_name||first.platform||'Cuenta')} · ${esc(first.cuenta_madre||'')}</h3></div><button class="primary-btn" type="button" onclick="openMasterTraceTimeline()">Ver línea del tiempo</button></div>
      <div class="master-trace-facts">
        <span><small>Ingreso</small><b>${esc(sources.join(' / ')||'Histórico')}</b><em>${esc(fmtDate(first.fecha_ingreso))}${first.entry_batch_id?` · lote ${esc(first.entry_batch_id)}`:''}</em></span>
        <span><small>Proveedor</small><b>${esc(first.proveedor||'Sin proveedor')}</b><em>${first.costo_compra_cuenta_madre!=null?`Compra madre: $${money(first.costo_compra_cuenta_madre)}`:'Costo no registrado'}</em></span>
        <span><small>Garantía / vence</small><b>${esc(String(first.vencimiento_cuenta_madre||first.expires_at||'-').slice(0,10))}</b><em>30 días según ciclo</em></span>
        <span><small>Cuenta madre</small><b>#${esc(first.cuenta_madre_id||'-')}</b><em>${Number(first.total_perfiles||0)} perfil(es)</em></span>
        <span><small>Ventas detectadas</small><b>${sales.length}</b><em>${latestSale?`Última: pedido #${esc(latestSale.orden_id)}`:'Sin venta enlazada'}</em></span>
        <span><small>Fallas / reportes</small><b>${reported.length}</b><em>${replacementUse.length} uso(s) como reemplazo</em></span>
        <span><small>Recuperaciones</small><b>${recoveries.length}</b><em>${first.reemplaza_cuenta_madre_id?`Reemplaza madre #${esc(first.reemplaza_cuenta_madre_id)}`:first.reemplazada_por_cuenta_madre_id?`Reemplazada por #${esc(first.reemplazada_por_cuenta_madre_id)}`:'Sin reemplazo de madre'}</em></span>
      </div>
      ${sales.length?`<div class="master-trace-sales"><b>Ventas / entregas</b>${sales.slice(0,6).map(v=>`<div><span>Pedido #${esc(v.orden_id)} · ${esc(v.modalidad||'venta')}</span><strong>${esc(v.comprador_nombre||v.comprador_email||'Usuario')}</strong><small>${esc(v.comprador_tipo||'vendedor')}${v.distribuidor_nombre?` · Distribuidor: ${esc(v.distribuidor_nombre)}`:''} · $${money(v.orden_amount)} · ${esc(fmtDate(v.orden_creada))}</small></div>`).join('')}</div>`:''}
      ${reports.length?`<div class="master-trace-reports"><b>Fallas y reemplazos</b>${reports.slice(0,6).map(r=>`<div><span>Reporte #${esc(r.id)} · ${esc(r.issue_type||'falla')}</span><strong>${esc(r.papel==='usada_como_reemplazo'?'Esta cuenta se usó como reemplazo':'Esta cuenta fue reportada')}</strong><small>${esc(r.status||'')} · ${esc(r.resolution_type||'')} · pedido #${esc(r.order_id||'-')}</small></div>`).join('')}</div>`:''}
    </section>`;
  }
  window.openMasterTraceTimeline=function(){
    const events=Array.isArray(window.masterLastTraceEvents)?window.masterLastTraceEvents:[];
    if(!events.length)return;
    closeModal('masterGlobalSearchModal');
    try{
      if(typeof renderInventoryHistorySummary==='function')renderInventoryHistorySummary(events);
      if(typeof renderInventoryHistoryTimeline==='function')renderInventoryHistoryTimeline(events);
      if(typeof renderInventoryHistoryModal==='function')renderInventoryHistoryModal(events);
      if(typeof openInventoryHistoryModal==='function')openInventoryHistoryModal();
    }catch(e){console.warn('No se pudo abrir trazabilidad completa',e);}
  };

  async function runMasterGlobalSearch(){
    const input=document.getElementById('masterGlobalSearchInput'),box=document.getElementById('masterGlobalSearchResults');const q=input?.value.trim()||'';
    if(q.length<2){if(box)box.innerHTML='<div class="master-v14-empty">Escribe al menos 2 caracteres.</div>';return;}
    try{
      if(box)box.innerHTML='<div class="small-text">Buscando trazabilidad y coincidencias…</div>';
      const [globalResult,traceResult]=await Promise.allSettled([
        api(`/api/admin/master/global-search?q=${encodeURIComponent(q)}`),
        api(`/api/admin/inventory-history?q=${encodeURIComponent(q)}&include_buyer=1`)
      ]);
      const d=globalResult.status==='fulfilled'?globalResult.value:{};
      const trace=traceResult.status==='fulfilled'?traceResult.value:{events:[]};
      const sections=[];
      const traceHtml=buildTracePreview(trace);
      if(traceHtml)sections.push(traceHtml);
      if(d.users?.length)sections.push(searchGroup('Usuarios',d.users.map(x=>({icon:'👤',title:x.name||x.email,sub:`${x.email} · saldo $${money(x.balance)}`,action:`openMasterUser360(${Number(x.id)})`}))));
      if(d.orders?.length)sections.push(searchGroup('Pedidos',d.orders.map(x=>{let od={};try{od=typeof x.order_data==='string'?JSON.parse(x.order_data||'{}'):(x.order_data||{});}catch(_){}const buyer=od._cliente_final_nombre?`Cliente final: ${od._cliente_final_nombre}`:(x.user_name||x.user_email||'');return {icon:'▤',title:`Pedido #${x.id} · ${x.product_name}`,sub:`${buyer} · $${money(x.amount)} · ${x.status}`,action:`openMasterManualDeliveryOrder(${Number(x.id)}, true)`};})));
      if(d.accounts?.length && !traceHtml)sections.push(searchGroup('Inventario',d.accounts.map(x=>({icon:'🔐',title:`${x.product_name||x.platform} · ${x.account_email}`,sub:`${x.profile_name||'Sin perfil'} · ${x.status}`,action:`masterOpenAdminTarget('adminPlatformAccountsPanel')`}))));
      if(d.products?.length)sections.push(searchGroup('Productos',d.products.map(x=>({icon:'📦',title:x.name,sub:`${x.category||''} · venta $${money(x.price)} · costo $${money(x.cost_price)}`,action:`masterOpenAdminTarget('adminProductsPanel')`}))));
      if(d.reports?.length && !traceHtml)sections.push(searchGroup('Reportes',d.reports.map(x=>({icon:'⚠️',title:`Reporte #${x.id} · ${x.issue_type}`,sub:`${x.user_name||x.user_email||''} · ${x.status}`,action:`masterOpenAdminTarget('adminAccountReportsPanel')`}))));
      if(box)box.innerHTML=sections.join('')||'<div class="master-v14-empty">No encontramos coincidencias.</div>';
    }catch(e){if(box)box.innerHTML=`<div class="master-v14-error">${esc(e.message||'Error de búsqueda')}</div>`;}
  }
  function searchGroup(title,items){return `<section class="master-search-group"><h3>${esc(title)}</h3>${items.map(i=>`<button onclick="${i.action};closeMasterGlobalSearch()"><span>${i.icon}</span><span><b>${esc(i.title)}</b><small>${esc(i.sub)}</small></span><i>→</i></button>`).join('')}</section>`;}
  window.masterOpenAdminTarget=function(id){if(typeof showSection==='function')showSection('admin');setTimeout(()=>document.getElementById(id)?.scrollIntoView({behavior:'auto',block:'start'}),80);};

  function ensureManualDeliveriesModal(){
    addModal('masterManualDeliveriesModal','Pedidos por entregar',`<div class="master-v15-trace-help"><b>📥 Cola de atención del administrador</b><span>Pedidos de vendedores y distribuidores que siguen pendientes de entrega o requieren intervención.</span></div><div class="master-v14-footer" style="justify-content:flex-end"><button class="outline-btn" type="button" onclick="loadMasterManualDeliveries()">↻ Actualizar</button></div><div id="masterManualDeliveriesList"><div class="small-text">Cargando…</div></div>`);
  }
  async function openMasterManualDeliveries(){ensureV14UI();openModal('masterManualDeliveriesModal');await loadMasterManualDeliveries();}
  window.openMasterManualDeliveries=openMasterManualDeliveries;
  window.closeMasterManualDeliveries=()=>closeModal('masterManualDeliveriesModal');
  async function loadMasterManualDeliveries(){
    const box=document.getElementById('masterManualDeliveriesList');if(box)box.innerHTML='<div class="small-text">Cargando pedidos…</div>';
    try{
      const d=await api('/api/admin/master/manual-deliveries?limit=150');const rows=d.rows||[];
      const count=document.getElementById('masterManualDeliveryCount');if(count)count.textContent=rows.filter(r=>String(r.product_type||'').toLowerCase().includes('manual')).length;
      if(!box)return;
      box.innerHTML=rows.length?`<div class="master-delivery-queue">${rows.map(r=>`<article class="master-delivery-item"><div><span class="master-delivery-id">#${Number(r.id)}</span><div><b>${esc(r.product_name||'Producto')}</b><small>${esc(r.customer_name||r.customer_email||'Usuario')} · ${esc(r.buyer_type||'vendedor')}${r.distributor_name?` · distribuidor ${esc(r.distributor_name)}`:''}</small><small>$${money(r.amount)} · ${esc(r.status)} · ${esc(fmtDate(r.created_at))}</small></div></div><span class="master-delivery-reason">${esc(String(r.queue_reason||'').replaceAll('_',' '))}</span><button class="primary-btn" type="button" onclick="openMasterManualDeliveryOrder(${Number(r.id)})">Atender</button></article>`).join('')}</div>`:'<div class="master-v14-empty">No hay pedidos pendientes por entregar.</div>';
    }catch(e){if(box)box.innerHTML=`<div class="master-v14-error">${esc(e.message||'No se pudo cargar la cola')}</div>`;}
  }
  window.loadMasterManualDeliveries=loadMasterManualDeliveries;
  async function openMasterManualDeliveryOrder(orderId, fromSearch=false){
    try{
      const d=await api(`/api/admin/master/manual-deliveries?order_id=${Number(orderId)}&limit=1${fromSearch?'&include_closed=1':''}`);
      let row=(d.rows||[])[0];
      if(!row && fromSearch){
        if(typeof showSection==='function')showSection('admin');
        setTimeout(()=>document.getElementById('adminOrdersPanel')?.scrollIntoView({behavior:'auto',block:'start'}),80);
        return;
      }
      if(!row)throw new Error('Ese pedido ya no está pendiente; revisa el historial de Pedidos.');
      if(typeof loadProducts==='function' && (!Array.isArray(window.allProducts)||!window.allProducts.length)){try{await loadProducts();}catch(_){}}
      closeModal('masterManualDeliveriesModal');closeModal('masterGlobalSearchModal');
      if(typeof showSection==='function')showSection('admin');
      if(Array.isArray(window.adminOrders))window.adminOrders=[row];else adminOrders=[row];
      const box=document.getElementById('adminOrdersList');
      if(box && typeof renderAdminOrderCompactFinal==='function'){
        box.innerHTML=renderAdminOrderCompactFinal(row);
        const item=document.getElementById(`admin-order-compact-${Number(row.id)}`);item?.classList.add('open');
        const details=item?.querySelector('.compact-details');if(details)details.style.display='block';
      }
      setTimeout(()=>document.getElementById('adminOrdersPanel')?.scrollIntoView({behavior:'auto',block:'start'}),80);
    }catch(e){if(typeof showMessage==='function')showMessage(e.message||'No se pudo abrir el pedido','error');}
  }
  window.openMasterManualDeliveryOrder=openMasterManualDeliveryOrder;

  function ensureUser360Modal(){addModal('masterUser360Modal','Ficha 360° del usuario','<div id="masterUser360Body"><div class="small-text">Cargando…</div></div>');}
  async function openMasterUser360(userId){
    ensureV14UI();openModal('masterUser360Modal');const box=document.getElementById('masterUser360Body');if(box)box.innerHTML='<div class="small-text">Cargando ficha…</div>';
    try{
      const d=await api(`/api/admin/master/users/${Number(userId)}/overview`),u=d.user||{},s=d.summary||{};
      if(box)box.innerHTML=`
        <div class="master-user360-head"><div><div class="master-user-avatar">${esc(String(u.name||u.email||'?').slice(0,1).toUpperCase())}</div><div><h3>${esc(u.name||'Usuario')}</h3><p>${esc(u.email||'')} · ID ${Number(u.id||0)}</p></div></div><div><b>$${money(u.balance)}</b><small>Saldo actual</small></div></div>
        <div class="master-user360-kpis"><span><small>Pedidos éxito</small><b>${Number(s.successful_orders||0)}</b></span><span><small>Ventas</small><b>$${money(s.revenue)}</b></span><span><small>Costo</small><b>$${money(s.cost)}</b></span><span><small>Utilidad</small><b>$${money(s.profit)}</b></span><span><small>Pendientes</small><b>${Number(s.pending_orders||0)}</b></span><span><small>Fallas abiertas</small><b>${Number(s.pending_reports||0)}</b></span></div>
        <div class="master-v14-subhead"><h3>Últimos pedidos</h3><span>Actividad reciente</span></div>
        ${miniTable((d.recent_orders||[]).map(o=>[ `#${o.id}`,o.product_name,`$${money(o.amount)}`,o.status,new Date(o.created_at).toLocaleString('es-MX') ]),['Pedido','Producto','Venta','Estado','Fecha'])}
        <div class="master-v14-subhead"><h3>Movimientos de saldo</h3><span>Últimos 30</span></div>
        ${miniTable((d.ledger||[]).map(r=>[new Date(r.created_at).toLocaleString('es-MX'),String(r.movement_type||'').replaceAll('_',' '),`${Number(r.amount)>=0?'+':'-'}$${money(Math.abs(Number(r.amount||0)))}`,`$${money(r.balance_after)}`,r.note||'']),['Fecha','Movimiento','Monto','Saldo','Nota'])}`;
    }catch(e){if(box)box.innerHTML=`<div class="master-v14-error">${esc(e.message||'No se pudo cargar ficha')}</div>`;}
  }
  window.openMasterUser360=openMasterUser360;
  function miniTable(rows,heads){if(!rows.length)return '<div class="master-v14-empty">Sin movimientos.</div>';return `<div class="table-wrap"><table class="mini-table"><thead><tr>${heads.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(v=>`<td>${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;}

  async function openMasterSuppliers(){ensureV14UI();if(typeof showSection==='function')showSection('admin');setTimeout(()=>document.getElementById('masterSuppliersPanel')?.scrollIntoView({behavior:'auto',block:'start'}),80);await loadMasterSuppliers();}
  window.openMasterSuppliers=openMasterSuppliers;
  async function loadMasterSuppliers(){
    if(!isMain())return;const list=document.getElementById('masterSuppliersList'),purchases=document.getElementById('masterPurchasesList');
    try{
      const d=await api('/api/admin/master/suppliers');
      const suppliers=d.suppliers||[];const select=document.getElementById('masterPurchaseSupplier');
      if(select)select.innerHTML='<option value="">Selecciona proveedor</option>'+suppliers.filter(s=>s.id).map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join('');
      if(list)list.innerHTML=suppliers.length?suppliers.map(s=>`<article class="master-supplier-card"><div><span class="master-supplier-icon">🚚</span><div><h3>${esc(s.name)}</h3><p>${esc(s.contact_name||s.phone||s.email||'Sin contacto registrado')}</p></div></div><div class="master-supplier-metrics"><span><small>Cuentas madre</small><b>${Number(s.mother_accounts||0)}</b></span><span><small>Inversión cuentas</small><b>$${money(s.invested)}</b></span><span><small>Compras registradas</small><b>$${money(s.purchases_total)}</b></span></div></article>`).join(''):'<div class="master-v14-empty">Aún no hay proveedores registrados.</div>';
      if(purchases)purchases.innerHTML=miniTable((d.purchases||[]).map(x=>[String(x.purchase_date||'').slice(0,10),x.supplier_name_snapshot,x.description||'',x.item_count,`$${money(x.total_amount)}`]),['Fecha','Proveedor','Compra','Unidades','Total']);
    }catch(e){if(list)list.innerHTML=`<div class="master-v14-error">${esc(e.message||'No se pudo cargar proveedores')}</div>`;}
  }
  window.loadMasterSuppliers=loadMasterSuppliers;
  async function saveMasterSupplier(ev){ev.preventDefault();try{await api('/api/admin/master/suppliers',{method:'POST',body:JSON.stringify({name:document.getElementById('masterSupplierName').value,contact_name:document.getElementById('masterSupplierContact').value,phone:document.getElementById('masterSupplierPhone').value,email:document.getElementById('masterSupplierEmail').value,notes:document.getElementById('masterSupplierNotes').value})});ev.target.reset();await loadMasterSuppliers();if(typeof showMessage==='function')showMessage('Proveedor guardado');}catch(e){if(typeof showMessage==='function')showMessage(e.message||'No se pudo guardar proveedor',true);}}
  async function saveMasterPurchase(ev){ev.preventDefault();try{await api('/api/admin/master/inventory-purchases',{method:'POST',body:JSON.stringify({supplier_id:document.getElementById('masterPurchaseSupplier').value||null,supplier_name:document.getElementById('masterPurchaseSupplierText').value,purchase_date:document.getElementById('masterPurchaseDate').value||null,item_count:document.getElementById('masterPurchaseCount').value,total_amount:document.getElementById('masterPurchaseTotal').value,description:document.getElementById('masterPurchaseDescription').value,notes:document.getElementById('masterPurchaseNotes').value})});ev.target.reset();document.getElementById('masterPurchaseCount').value='1';document.getElementById('masterPurchaseDate').value=new Date().toISOString().slice(0,10);await loadMasterSuppliers();if(typeof showMessage==='function')showMessage('Compra registrada');}catch(e){if(typeof showMessage==='function')showMessage(e.message||'No se pudo registrar compra',true);}}

  function init(){ensureV14UI();const date=document.getElementById('masterPurchaseDate');if(date&&!date.value)date.value=new Date().toISOString().slice(0,10);loadMasterManualDeliveries().catch(()=>{});}
  if(typeof registerLoadAppHook==='function') registerLoadAppHook(async()=>init(),{name:'master-ops-v1-4',order:980});
  if(typeof registerSectionHook==='function') registerSectionHook(name=>{if((name==='dashboard'||name==='admin')&&isMain())setTimeout(init,20);});
  document.addEventListener('keydown',e=>{if(!isMain())return;if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();openMasterGlobalSearch();}if(e.key==='Escape')document.querySelectorAll('.master-v14-modal:not(.hidden)').forEach(x=>closeModal(x.id));});
})();
