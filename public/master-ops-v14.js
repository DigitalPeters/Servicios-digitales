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
      search.id='masterGlobalSearchBtn';search.className='master-tool-btn';search.innerHTML='⌕ <span>Buscar</span>';
      search.onclick=openMasterGlobalSearch;
      controls.insertBefore(search,controls.firstChild);
      const sale=document.createElement('button');
      sale.id='masterQuickSaleBtn';sale.className='master-tool-btn master-tool-btn-primary';sale.innerHTML='＋ <span>Venta rápida</span>';
      sale.onclick=openMasterQuickSale;
      controls.insertBefore(sale,controls.firstChild);
    }

    const modules=document.querySelector('#masterOperationsPanel .master-module-grid');
    if(modules && !document.getElementById('masterSuppliersModule')){
      const supplier=document.createElement('button');
      supplier.id='masterSuppliersModule';supplier.className='master-module';supplier.innerHTML='<span class="master-module-icon">🚚</span><span><b>Proveedores</b><small>Compras e inversión</small></span><i>→</i>';
      supplier.onclick=openMasterSuppliers;
      modules.appendChild(supplier);
      const quick=document.createElement('button');
      quick.id='masterQuickSaleModule';quick.className='master-module master-module-accent';quick.innerHTML='<span class="master-module-icon">⚡</span><span><b>Venta rápida</b><small>WhatsApp / mostrador</small></span><i>→</i>';
      quick.onclick=openMasterQuickSale;
      modules.prepend(quick);
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
    ensureSearchModal();
    ensureUser360Modal();
  }

  function ensureQuickSaleModal(){
    const modal=addModal('masterQuickSaleModal','Venta rápida',`
      <div class="master-v14-callout"><b>Registra ventas que recibes por WhatsApp, teléfono o mostrador.</b><span>Puede entregar inventario automáticamente y decidir si el cobro sale del saldo del vendedor o fue pagado por fuera.</span></div>
      <form id="masterQuickSaleForm" class="master-v14-form">
        <div class="master-v14-grid2"><label>Vendedor / cliente<select id="masterQuickUser" required><option value="">Selecciona…</option></select></label><label>Producto<select id="masterQuickProduct" required><option value="">Selecciona…</option></select></label></div>
        <div id="masterQuickQuote" class="master-v14-quote">Selecciona usuario y producto.</div>
        <div id="masterQuickRequiredFields" class="master-v14-grid2"></div>
        <div class="master-v14-grid3"><label>Monto de la venta<input id="masterQuickAmount" type="number" min="0" step="0.01" required/></label><label>Método de pago<select id="masterQuickPayment"><option value="transferencia">Transferencia</option><option value="efectivo">Efectivo</option><option value="saldo">Saldo del vendedor</option><option value="otro">Otro</option></select></label><label>Nota<input id="masterQuickNote" placeholder="Opcional"/></label></div>
        <div class="master-v14-checks"><label><input id="masterQuickChargeBalance" type="checkbox"/> Descontar del saldo del vendedor</label><label><input id="masterQuickAutoDeliver" type="checkbox" checked/> Entrega automática si aplica</label><label><input id="masterQuickSuccess" type="checkbox" checked/> Marcar éxito cuando no requiera entrega</label></div>
        <div id="masterQuickResult"></div>
        <div class="master-v14-footer"><button type="button" class="outline-btn" onclick="closeMasterQuickSale()">Cancelar</button><button type="submit" class="primary-btn">Registrar venta</button></div>
      </form>`);
    const form=modal.querySelector('#masterQuickSaleForm');
    if(form && !form.dataset.bound){form.dataset.bound='1';form.addEventListener('submit',submitMasterQuickSale);}
    ['masterQuickUser','masterQuickProduct'].forEach(id=>document.getElementById(id)?.addEventListener('change',refreshQuickQuote));
    document.getElementById('masterQuickPayment')?.addEventListener('change',()=>{
      const value=document.getElementById('masterQuickPayment')?.value;
      const cb=document.getElementById('masterQuickChargeBalance');if(cb)cb.checked=value==='saldo';
    });
    document.getElementById('masterQuickChargeBalance')?.addEventListener('change',e=>{if(e.target.checked){const p=document.getElementById('masterQuickPayment');if(p)p.value='saldo';}});
  }

  async function openMasterQuickSale(){
    ensureV14UI();openModal('masterQuickSaleModal');
    const result=document.getElementById('masterQuickResult');if(result)result.innerHTML='';
    try{
      quickOptions=await api('/api/admin/master/quick-sale/options');
      const u=document.getElementById('masterQuickUser'),p=document.getElementById('masterQuickProduct');
      if(u)u.innerHTML='<option value="">Selecciona vendedor / cliente…</option>'+(quickOptions.users||[]).map(x=>`<option value="${x.id}">${esc(x.name||x.email)} · $${money(x.balance)}</option>`).join('');
      if(p)p.innerHTML='<option value="">Selecciona producto…</option>'+(quickOptions.products||[]).map(x=>`<option value="${x.id}">${esc(x.name)} · ${esc(x.category||'')} · stock ${Number(x.stock||0)}</option>`).join('');
      const date=document.getElementById('masterPurchaseDate');if(date&&!date.value)date.value=new Date().toISOString().slice(0,10);
    }catch(e){if(result)result.innerHTML=`<div class="master-v14-error">${esc(e.message||'No se pudieron cargar opciones')}</div>`;}
  }
  window.openMasterQuickSale=openMasterQuickSale;
  window.closeMasterQuickSale=()=>closeModal('masterQuickSaleModal');

  async function refreshQuickQuote(){
    const userId=document.getElementById('masterQuickUser')?.value,productId=document.getElementById('masterQuickProduct')?.value;
    const quote=document.getElementById('masterQuickQuote');
    if(!userId||!productId){quickQuote=null;if(quote)quote.textContent='Selecciona usuario y producto.';return;}
    try{
      quickQuote=await api(`/api/admin/master/quick-sale/quote?user_id=${encodeURIComponent(userId)}&product_id=${encodeURIComponent(productId)}`);
      const amount=document.getElementById('masterQuickAmount');if(amount)amount.value=Number(quickQuote.amount||0).toFixed(2);
      if(quote)quote.innerHTML=`<span><b>${esc(quickQuote.user?.name||quickQuote.user?.email)}</b><small>Saldo $${money(quickQuote.user?.balance)}</small></span><span><b>${esc(quickQuote.product?.name)}</b><small>Precio efectivo $${money(quickQuote.amount)} · stock ${Number(quickQuote.product?.stock||0)}</small></span>`;
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
        user_id:Number(document.getElementById('masterQuickUser').value),product_id:Number(document.getElementById('masterQuickProduct').value),
        amount:Number(document.getElementById('masterQuickAmount').value),payment_method:document.getElementById('masterQuickPayment').value,
        note:document.getElementById('masterQuickNote').value,charge_balance:document.getElementById('masterQuickChargeBalance').checked,
        auto_deliver:document.getElementById('masterQuickAutoDeliver').checked,mark_success:document.getElementById('masterQuickSuccess').checked,order_data:orderData
      };
      if(result)result.innerHTML='<div class="small-text">Registrando venta…</div>';
      const d=await api('/api/admin/master/quick-sale',{method:'POST',body:JSON.stringify(payload)});
      if(result)result.innerHTML=`<div class="master-v14-success"><b>✓ ${esc(d.message)}</b><span>Pedido #${Number(d.order_id)} · $${money(d.amount)}${d.immediate_delivery?' · entrega automática':''}</span></div>`;
      if(typeof loadMasterOperations==='function')loadMasterOperations(false);
      if(typeof loadAdminOrders==='function')loadAdminOrders();
      await refreshQuickQuote();
    }catch(e){if(result)result.innerHTML=`<div class="master-v14-error">${esc(e.message||'No se pudo registrar la venta')}</div>`;}
  }

  function ensureSearchModal(){
    const modal=addModal('masterGlobalSearchModal','Buscador global',`
      <div class="master-search-box"><span>⌕</span><input id="masterGlobalSearchInput" placeholder="Nombre, correo, pedido, cuenta, producto, proveedor…" autocomplete="off"/></div>
      <div id="masterGlobalSearchResults" class="master-search-results"><div class="master-v14-empty">Escribe al menos 2 caracteres.</div></div>`);
    const input=modal.querySelector('#masterGlobalSearchInput');
    if(input&&!input.dataset.bound){input.dataset.bound='1';input.addEventListener('input',()=>{clearTimeout(searchTimer);searchTimer=setTimeout(runMasterGlobalSearch,250);});}
  }
  function openMasterGlobalSearch(){ensureV14UI();openModal('masterGlobalSearchModal');setTimeout(()=>document.getElementById('masterGlobalSearchInput')?.focus(),50);}
  window.openMasterGlobalSearch=openMasterGlobalSearch;
  window.closeMasterGlobalSearch=()=>closeModal('masterGlobalSearchModal');

  async function runMasterGlobalSearch(){
    const input=document.getElementById('masterGlobalSearchInput'),box=document.getElementById('masterGlobalSearchResults');const q=input?.value.trim()||'';
    if(q.length<2){if(box)box.innerHTML='<div class="master-v14-empty">Escribe al menos 2 caracteres.</div>';return;}
    try{
      if(box)box.innerHTML='<div class="small-text">Buscando…</div>';
      const d=await api(`/api/admin/master/global-search?q=${encodeURIComponent(q)}`);
      const sections=[];
      if(d.users?.length)sections.push(searchGroup('Usuarios',d.users.map(x=>({icon:'👤',title:x.name||x.email,sub:`${x.email} · saldo $${money(x.balance)}`,action:`openMasterUser360(${Number(x.id)})`}))));
      if(d.orders?.length)sections.push(searchGroup('Pedidos',d.orders.map(x=>({icon:'▤',title:`Pedido #${x.id} · ${x.product_name}`,sub:`${x.user_name||x.user_email||''} · $${money(x.amount)} · ${x.status}`,action:`masterOpenAdminTarget('adminOrdersPanel')`}))));
      if(d.products?.length)sections.push(searchGroup('Productos',d.products.map(x=>({icon:'📦',title:x.name,sub:`${x.category||''} · venta $${money(x.price)} · costo $${money(x.cost_price)}`,action:`masterOpenAdminTarget('adminProductsPanel')`}))));
      if(d.accounts?.length)sections.push(searchGroup('Inventario',d.accounts.map(x=>({icon:'🔐',title:`${x.product_name||x.platform} · ${x.account_email}`,sub:`${x.profile_name||'Sin perfil'} · ${x.status}`,action:`masterOpenAdminTarget('adminPlatformAccountsPanel')`}))));
      if(d.mother_accounts?.length)sections.push(searchGroup('Cuentas madre',d.mother_accounts.map(x=>({icon:'🧬',title:`${x.product_name} · ${x.account_email}`,sub:`${x.provider_name||'Sin proveedor'} · ${x.status}`,action:`showSection('profit-quality')`}))));
      if(d.reports?.length)sections.push(searchGroup('Reportes',d.reports.map(x=>({icon:'⚠️',title:`Reporte #${x.id} · ${x.issue_type}`,sub:`${x.user_name||x.user_email||''} · ${x.status}`,action:`masterOpenAdminTarget('adminAccountReportsPanel')`}))));
      if(box)box.innerHTML=sections.join('')||'<div class="master-v14-empty">No encontramos coincidencias.</div>';
    }catch(e){if(box)box.innerHTML=`<div class="master-v14-error">${esc(e.message||'Error de búsqueda')}</div>`;}
  }
  function searchGroup(title,items){return `<section class="master-search-group"><h3>${esc(title)}</h3>${items.map(i=>`<button onclick="${i.action};closeMasterGlobalSearch()"><span>${i.icon}</span><span><b>${esc(i.title)}</b><small>${esc(i.sub)}</small></span><i>→</i></button>`).join('')}</section>`;}
  window.masterOpenAdminTarget=function(id){if(typeof showSection==='function')showSection('admin');setTimeout(()=>document.getElementById(id)?.scrollIntoView({behavior:'smooth',block:'start'}),80);};

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

  async function openMasterSuppliers(){ensureV14UI();if(typeof showSection==='function')showSection('admin');setTimeout(()=>document.getElementById('masterSuppliersPanel')?.scrollIntoView({behavior:'smooth',block:'start'}),80);await loadMasterSuppliers();}
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

  function init(){ensureV14UI();const date=document.getElementById('masterPurchaseDate');if(date&&!date.value)date.value=new Date().toISOString().slice(0,10);}
  if(typeof registerLoadAppHook==='function') registerLoadAppHook(async()=>init(),{name:'master-ops-v1-4',order:980});
  if(typeof registerSectionHook==='function') registerSectionHook(name=>{if((name==='dashboard'||name==='admin')&&isMain())setTimeout(init,20);});
  document.addEventListener('keydown',e=>{if(!isMain())return;if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();openMasterGlobalSearch();}if(e.key==='Escape')document.querySelectorAll('.master-v14-modal:not(.hidden)').forEach(x=>closeModal(x.id));});
})();
