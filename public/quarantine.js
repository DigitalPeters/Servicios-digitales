/*
 * Servicios Digitales Peters · Cuarentena
 * Módulo independiente: navegación, consulta, recuperación y desecho.
 * No modifica la navegación de Ventas ni Inventario.
 */
(function(){
  'use strict';

  let openRequest = null;
  let monitorTimer = null;

  function isMainAdmin(){
    if(!currentUser) return false;
    const role = String(currentUser.role || '').toLowerCase();
    if(role !== 'admin') return false;

    const type = String(currentUser.account_type || '').toLowerCase();
    const panel = type === 'panel_propietario' || type === 'panel_admin' || type === 'admin_panel' ||
      currentUser.is_panel_admin === true ||
      currentUser.is_panel_admin === 1 ||
      currentUser.is_panel_admin === '1' ||
      currentUser.is_panel_admin === 'true';

    return !panel;
  }

  function setCount(count){
    const stat = document.getElementById('statExpiring');
    if(stat) stat.textContent = String(Number(count || 0));
  }

  function setCardVisible(visible){
    const card = document.getElementById('dashQuarantineCard');
    if(!card) return;
    card.classList.toggle('hidden', !visible);
    if(visible) card.style.removeProperty('display');
    else card.style.setProperty('display', 'none', 'important');
  }

  function removeLegacyAlarm(){
    document.getElementById('btn-cuarentena-alarma')?.remove();
  }

  async function refreshQuarantine(options = {}){
    if(!isMainAdmin()){
      setCount(0);
      setCardVisible(false);
      removeLegacyAlarm();
      return [];
    }

    if(openRequest && !options.force) return openRequest;

    openRequest = (async()=>{
      try{
        // Primero sincroniza expiraciones y después consulta el estado real.
        await api('/api/admin/system/check-expirations', {
          method:'POST',
          dedupe:false,
          body:JSON.stringify({})
        });

        const list = await api('/api/admin/accounts/quarantine');
        const rows = Array.isArray(list) ? list : [];
        setCount(rows.length);
        setCardVisible(true);
        removeLegacyAlarm();
        return rows;
      } finally {
        openRequest = null;
      }
    })();

    try{
      return await openRequest;
    }catch(error){
      console.error('[CUARENTENA] Error actualizando:', error);
      setCount(0);
      setCardVisible(true);
      throw error;
    }
  }

  async function openQuarantine(event){
    if(event){
      event.preventDefault();
      event.stopPropagation();
      if(typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
    }

    if(!isMainAdmin()){
      if(typeof showMessage === 'function') showMessage('Cuarentena está disponible únicamente para el Administrador Principal.', 'error');
      return false;
    }

    const card = document.getElementById('dashQuarantineCard');
    if(card) card.setAttribute('aria-busy','true');

    try{
      const rows = await refreshQuarantine({force:true});
      renderModal(rows);
      return true;
    }catch(error){
      if(typeof showMessage === 'function') showMessage(error?.message || 'No se pudo abrir Cuarentena.', 'error');
      return false;
    }finally{
      if(card) card.removeAttribute('aria-busy');
    }
  }

  function bindCard(){
    const card = document.getElementById('dashQuarantineCard');
    if(!card || card.dataset.quarantineBound === '1') return;

    // El HTML no tiene onclick. Este es el único dueño del clic de Cuarentena.
    card.dataset.quarantineBound = '1';
    card.addEventListener('click', openQuarantine, false);
    card.removeAttribute('onclick');
  }

  function esc(value){
    if(typeof safeText === 'function') return safeText(value ?? '');
    return String(value ?? '').replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
  }

  function renderModal(rows){
    document.getElementById('quarantineModal')?.remove();

    const modal = document.createElement('div');
    modal.id = 'quarantineModal';
    modal.className = 'modal-overlay';
    modal.style.zIndex = '99999';
    modal.setAttribute('role','dialog');
    modal.setAttribute('aria-modal','true');

    const card = document.createElement('div');
    card.className = 'modal-card';
    card.style.maxWidth = '920px';
    card.style.width = '90%';
    card.style.background = '#0f172a';

    const body = rows.length ? rows.map(row => {
      const id = Number(row.id || 0);
      const dias = row.dias_restantes && typeof row.dias_restantes === 'object'
        ? Math.floor(Number(row.dias_restantes.days || 0))
        : Math.floor(Number(row.dias_restantes || 0));
      const vida = dias > 0 ? `${dias} días` : '¡Vencida!';
      const border = dias < 5 ? 'border-left:4px solid #ef4444;' : '';
      return `
        <div class="quarantine-item" data-id="${id}" style="${border}">
          <div class="quarantine-row">
            <div class="quarantine-meta">
              <div class="quarantine-platform">${esc(row.platform || '')}</div>
              <div class="quarantine-email">📧 ${esc(row.account_email || '-')}</div>
              <div class="quarantine-profile">👤 ${esc(row.profile_name || 'Principal')} | PIN: ${esc(row.profile_pin || '—')}</div>
              <div class="quarantine-life">⏳ Vida restante: <strong>${esc(vida)}</strong></div>
            </div>
            <div class="quarantine-actions">
              <label class="field-label" style="margin-bottom:6px">Nueva contraseña</label>
              <input data-quarantine-password="${id}" placeholder="Nueva contraseña" class="form-control" autocomplete="off" />
              <label class="field-label" style="margin-top:8px;margin-bottom:6px">Nuevo PIN (opcional)</label>
              <input data-quarantine-pin="${id}" placeholder="Nuevo PIN" class="form-control" inputmode="numeric" autocomplete="off" />
              <div style="display:flex;gap:8px;margin-top:10px;">
                <button type="button" class="green-btn" data-quarantine-release="${id}">Recuperar</button>
                <button type="button" class="outline-btn" data-quarantine-discard="${id}">Desechar</button>
              </div>
            </div>
          </div>
        </div>`;
    }).join('') : `
      <div class="empty-state" style="padding:30px;text-align:center;">
        <div style="font-size:36px;">✅</div>
        <h3 style="margin:10px 0 5px;">No hay cuentas en cuarentena</h3>
        <p class="small-text">Las cuentas vencidas aparecerán aquí cuando termine su periodo de garantía.</p>
      </div>`;

    card.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;">
        <h2 style="color:#ef4444;margin:0;">🚨 Cuentas en Cuarentena</h2>
        <button type="button" class="modal-close-btn" data-quarantine-close aria-label="Cerrar">×</button>
      </div>
      <p class="small-text" style="margin-top:10px;color:#cbd5e1;">Estas cuentas requieren atención. Actualiza los datos en la plataforma oficial antes de recuperarlas.</p>
      <div id="quarantineListContainer" style="margin-top:18px;display:flex;flex-direction:column;gap:12px;">${body}</div>
      <div style="margin-top:16px;display:flex;gap:8px;">
        <button type="button" class="outline-btn" data-quarantine-close>Cerrar</button>
        <button type="button" class="outline-btn" data-quarantine-refresh>Refrescar lista</button>
      </div>`;

    modal.appendChild(card);
    document.body.appendChild(modal);

    modal.addEventListener('click', async event => {
      const target = event.target.closest('button');
      if(!target) return;
      event.preventDefault();
      event.stopPropagation();

      if(target.hasAttribute('data-quarantine-close')){
        modal.remove();
        return;
      }

      if(target.hasAttribute('data-quarantine-refresh')){
        target.disabled = true;
        try{
          const fresh = await refreshQuarantine({force:true});
          renderModal(fresh);
        }catch(error){
          if(typeof showMessage === 'function') showMessage(error?.message || 'No se pudo actualizar Cuarentena.', 'error');
        }
        return;
      }

      if(target.hasAttribute('data-quarantine-release')){
        await releaseAccount(Number(target.getAttribute('data-quarantine-release')));
        return;
      }

      if(target.hasAttribute('data-quarantine-discard')){
        await discardAccount(Number(target.getAttribute('data-quarantine-discard')));
      }
    });
  }

  async function releaseAccount(id){
    const password = String(document.querySelector(`[data-quarantine-password="${id}"]`)?.value || '').trim();
    const pin = String(document.querySelector(`[data-quarantine-pin="${id}"]`)?.value || '').trim();
    if(!password && !pin){
      if(typeof showMessage === 'function') showMessage('Debes capturar una nueva contraseña o un nuevo PIN.', 'error');
      return;
    }
    if(!window.confirm('¿Confirmas que ya actualizaste los datos en la plataforma oficial y deseas recuperar esta cuenta?')) return;

    const button = document.querySelector(`[data-quarantine-release="${id}"]`);
    if(button) button.disabled = true;

    try{
      const data = await api(`/api/admin/accounts/${id}/release`, {
        method:'POST',
        body:JSON.stringify({ new_password:password || undefined, new_pin:pin || undefined })
      });
      if(typeof showMessage === 'function') showMessage(data.message || 'Cuenta recuperada correctamente.');
      const fresh = await refreshQuarantine({force:true});
      renderModal(fresh);
      if(typeof loadPlatformInventory === 'function') await loadPlatformInventory(1);
    }catch(error){
      if(button) button.disabled = false;
      if(typeof showMessage === 'function') showMessage(error?.message || 'No se pudo recuperar la cuenta.', 'error');
    }
  }

  async function discardAccount(id){
    if(!window.confirm('¿Deseas desechar esta cuenta permanentemente?')) return;
    const button = document.querySelector(`[data-quarantine-discard="${id}"]`);
    if(button) button.disabled = true;

    try{
      const data = await api(`/api/admin/accounts/${id}/discard`, {
        method:'POST',
        body:JSON.stringify({})
      });
      if(typeof showMessage === 'function') showMessage(data.message || 'Cuenta desechada correctamente.');
      const fresh = await refreshQuarantine({force:true});
      renderModal(fresh);
      if(typeof loadPlatformInventory === 'function') await loadPlatformInventory(1);
    }catch(error){
      if(button) button.disabled = false;
      if(typeof showMessage === 'function') showMessage(error?.message || 'No se pudo desechar la cuenta.', 'error');
    }
  }

  async function loadRecoveryHistory(){
    try{
      const list = await api('/api/admin/recovery-history');
      const rows = Array.isArray(list) ? list : [];
      document.getElementById('historialModal')?.remove();
      const modal = document.createElement('div');
      modal.id = 'historialModal';
      modal.className = 'modal-overlay';
      modal.style.zIndex = '99999';
      modal.innerHTML = `
        <div class="modal-card" style="max-width:700px;width:90%;">
          <h2>♻ Historial de recuperaciones</h2>
          <ul style="list-style:none;padding:0;max-height:60vh;overflow:auto;">
            ${rows.length ? rows.map(r => `<li style="border-bottom:1px solid #444;padding:8px 0;font-size:12px;"><b>Pedido:</b> ${esc(r.order_id || 'N/A')} | <b>Plataforma:</b> ${esc(r.platform || '')}<br><b>Correo:</b> ${esc(r.account_email || '')}<br><b>Recuperado:</b> ${r.recovered_at ? esc(new Date(r.recovered_at).toLocaleDateString('es-MX')) : 'N/A'}</li>`).join('') : '<li class="small-text">No hay recuperaciones registradas.</li>'}
          </ul>
          <button type="button" class="outline-btn" data-history-close style="width:100%;">Cerrar</button>
        </div>`;
      document.body.appendChild(modal);
      modal.querySelector('[data-history-close]')?.addEventListener('click',()=>modal.remove());
    }catch(error){
      console.error('[CUARENTENA] Historial:', error);
      if(typeof showMessage === 'function') showMessage(error?.message || 'No se pudo cargar el historial.', 'error');
    }
  }

  function startMonitor(){
    bindCard();
    setCardVisible(isMainAdmin());
    if(monitorTimer) clearInterval(monitorTimer);
    monitorTimer = null;
    if(!isMainAdmin()) return;

    refreshQuarantine().catch(()=>{});
    monitorTimer = setInterval(()=>{
      if(!document.hidden) refreshQuarantine().catch(()=>{});
    }, 300000);
  }

  window.openQuarantineFromDashboard = openQuarantine;
  window.checkQuarantineAccounts = () => refreshQuarantine({force:true});
  window.showQuarantineModal = renderModal;
  window.liberarCuentaDeCuarentena = releaseAccount;
  window.desecharCuenta = discardAccount;
  window.abrirModalHistorial = loadRecoveryHistory;

  // Una única entrada de arranque para este módulo.
  if(typeof window.registerLoadAppHook === 'function'){
    window.registerLoadAppHook(startMonitor, {name:'quarantine-module', order:710});
  }else{
    document.addEventListener('DOMContentLoaded', startMonitor, {once:true});
  }
})();
