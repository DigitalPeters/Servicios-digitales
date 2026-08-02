let __exactReportAccountId = 0;

function setExactReportAccountId(value) {
  const id = Number(value || 0);
  __exactReportAccountId = Number.isInteger(id) && id > 0 ? id : 0;
  return __exactReportAccountId;
}

function getExactReportAccountId() {
  return Number(__exactReportAccountId || 0);
}

function ensureExactReportOption(select, account = {}) {
  if (!select) return false;
  const id = Number(account?.id || 0);
  if (id <= 0) return false;

  let option = Array.from(select.options || []).find((item) => Number(item.value || 0) === id);
  if (!option) {
    option = document.createElement('option');
    option.value = String(id);
    option.dataset.email = String(account?.account_email || account?.email || '').trim();
    const label = [
      account?.order_id ? `Pedido #${Number(account.order_id)}` : '',
      account?.platform || account?.product_name || 'Cuenta de reemplazo',
      account?.account_email || account?.email || '',
      account?.profile_name ? `Perfil: ${account.profile_name}` : '',
      `ID #${id}`
    ].filter(Boolean).join(' | ');
    option.textContent = label;
    select.appendChild(option);
  }

  select.value = String(id);
  setExactReportAccountId(id);
  return select.value === String(id);
}

window.setExactReportAccountIdStable = setExactReportAccountId;
window.getExactReportAccountIdStable = getExactReportAccountId;
window.ensureExactReportOptionStable = ensureExactReportOption;

async function loadMyOrders(page = 1) {
  const requestedPage = Math.max(1, Number(page || 1));
  const search = String(document.getElementById('myOrdersSearch')?.value || '').trim();
  const status = String(document.getElementById('myOrdersStatusFilter')?.value || '').trim();
  const qs = new URLSearchParams({
    page: String(requestedPage),
    limit: String(HISTORY_PAGE_LIMIT)
  });
  if (search) qs.set('search', search);
  if (status) qs.set('status', status);

  const payload = await api('/api/my-orders?' + qs.toString());
  const rows = Array.isArray(payload?.rows) ? payload.rows : [];
  const total = Number(payload?.total || 0);
  const totalPages = Math.max(1, Number(payload?.totalPages || 1));
  currentMyOrdersPage = Math.max(1, Number(payload?.page || requestedPage));

  if (currentMyOrdersPage > totalPages) {
    return loadMyOrders(totalPages);
  }

  myOrders = rows;
  if (statOrders) statOrders.textContent = total;
  renderMyOrders();

  const list = document.getElementById('myOrdersList');
  if (list && typeof renderTablePager === 'function') {
    renderTablePager(list, 'myOrdersPaginationControls', currentMyOrdersPage, totalPages, 'goMyOrdersPagePrev', 'goMyOrdersPageNext');
  }

  if (currentMyOrdersPage === 1 && recentOrdersList) {
    recentOrdersList.innerHTML =
      rows.slice(0, 4).map((o) =>
        `<div class="item"><b>#${o.id}</b> ${safeText(o.product_name)} <span class="status">${safeText(getStatusText(o.status))}</span></div>`
      ).join('') || 'Sin pedidos recientes.';
  }
}

let __myOrdersSearchTimer = null;
window.scheduleMyOrdersReload = function scheduleMyOrdersReload(){
  if (__myOrdersSearchTimer) clearTimeout(__myOrdersSearchTimer);
  __myOrdersSearchTimer = setTimeout(() => {
    __myOrdersSearchTimer = null;
    loadMyOrders(1).catch((e) => console.warn('Error filtrando pedidos:', e));
  }, 280);
};
window.goMyOrdersPagePrev = function(){
  if (currentMyOrdersPage > 1) loadMyOrders(currentMyOrdersPage - 1);
};
window.goMyOrdersPageNext = function(){
  loadMyOrders(currentMyOrdersPage + 1);
};

function extractDeliveredAccountEmail(text) {
  const m = String(text || '').match(/(?:Correo|📧\s*Correo):\s*([^\n\r\s]+)/i);
  return m ? m[1].trim() : '';
}


const __myAccountReportsById = new Map();

function cacheMyAccountReports(reports) {
  __myAccountReportsById.clear();
  (Array.isArray(reports) ? reports : []).forEach((report) => {
    const id = Number(report?.id || 0);
    if (id > 0) __myAccountReportsById.set(id, report);
  });
}

function getMyAccountReportById(reportId) {
  return __myAccountReportsById.get(Number(reportId)) || null;
}

function extractReplacementDeliveryData(report) {
  const response = String(report?.admin_response || '').trim();
  if (!response) return '';

  const status = String(report?.status || '').toLowerCase();
  const resolutionType = String(report?.resolution_type || '').toLowerCase();
  const isReplacement =
    status === 'reemplazo' ||
    resolutionType === 'reemplazo' ||
    /cuenta reemplazada|reemplazo (?:manual )?entregado/i.test(response);

  const hasDeliveredAccount =
    /Cuenta de Streaming Entregada|Entrega Digital Inmediata|Combo Streaming/i.test(response) ||
    (/(?:📧\s*)?Correo:\s*[^\s\n]+/i.test(response) && /(?:🔐\s*)?(?:Contraseña|Password):/i.test(response));

  if (!isReplacement || !hasDeliveredAccount) return '';

  const markers = [
    '🎬 Cuenta de Streaming Entregada',
    '📄 Entrega Digital Inmediata',
    '🎁 Combo Streaming',
    'Cuenta de Streaming Entregada',
    'Entrega Digital Inmediata',
    'Combo Streaming'
  ];

  let start = -1;
  markers.forEach((marker) => {
    const index = response.indexOf(marker);
    if (index >= 0 && (start < 0 || index < start)) start = index;
  });

  return (start >= 0 ? response.slice(start) : response).trim();
}

function renderReplacementReportActions(report) {
  if (!extractReplacementDeliveryData(report)) return '';
  const reportId = Number(report?.id || 0);
  if (!reportId) return '';

  return `<div class="replacement-delivery-actions">
    <button class="copy-account-btn" type="button" onclick="copyReplacementReportData(${reportId})">📋 Copiar datos</button>
    <button class="copy-account-btn danger-btn" type="button" onclick="reportReplacementAccount(${reportId})">⚠ Reportar falla</button>
  </div>`;
}

window.copyReplacementReportData = function copyReplacementReportData(reportId) {
  const report = getMyAccountReportById(reportId);
  const data = extractReplacementDeliveryData(report);
  if (!data) {
    showMessage('No encontré los datos de la cuenta reemplazada', 'error');
    return;
  }
  copyToClipboard(data, 'Datos de la cuenta reemplazada copiados');
};

window.reportReplacementAccount = async function reportReplacementAccount(reportId) {
  const report = getMyAccountReportById(reportId);
  const accountId = Number(report?.replacement_account_id || 0);

  if (!report || accountId <= 0) {
    showMessage('No pude identificar el perfil exacto de reemplazo para reportarlo', 'error');
    return;
  }

  setExactReportAccountId(accountId);
  showSection('reports');

  if (typeof window.ensureReportSelectStable === 'function') window.ensureReportSelectStable();
  if (typeof window.loadReportableAccountsStable === 'function') await window.loadReportableAccountsStable();

  const select = document.getElementById('reporteCuentaSelect');
  if (!select) {
    showMessage('No se encontró el selector de cuentas reportables', 'error');
    return;
  }

  const replacementData = extractReplacementDeliveryData(report);
  const replacementEmail = extractDeliveredAccountEmail(replacementData) || String(report?.email || '').trim();
  ensureExactReportOption(select, {
    id: accountId,
    order_id: report?.order_id,
    platform: report?.reported_platform || 'Cuenta de reemplazo',
    account_email: replacementEmail
  });
  select.dispatchEvent(new Event('change', { bubbles: true }));

  const description = document.getElementById('reporteExplicacion');
  if (description) {
    description.value = '';
    setTimeout(() => description.focus(), 100);
  }

  showMessage('Perfil de reemplazo seleccionado. Describe la nueva falla.');
};

async function loadMyReports(page = currentMyReportsPage) {
  try {
    const requestedPage = Math.max(1, Number(page || 1));
    const payload = await api(`/api/my-account-reports?page=${requestedPage}&limit=${HISTORY_PAGE_LIMIT}`);
    const reports = Array.isArray(payload?.rows) ? payload.rows : [];
    const totalPages = Math.max(1, Number(payload?.totalPages || 1));
    currentMyReportsPage = Math.max(1, Number(payload?.page || requestedPage));
    if (currentMyReportsPage > totalPages) return loadMyReports(totalPages);

    cacheMyAccountReports(reports);
    const box = document.getElementById('myReportsList');
    if (!box) return;
    box.innerHTML = reports.length
      ? reports.map((r) => `
      <div class="item">
        <p><b>Reporte:</b> #${r.id} <span class="status">${safeText(r.status)}</span></p>
        <p><b>Correo reportado:</b> ${safeText(r.email)}</p>
        <p><b>Perfil reportado:</b> ${Number(r.reported_account_id||0)>0 ? '#'+Number(r.reported_account_id) : 'No identificado'}${Number(r.replacement_account_id||0)>0 ? ` &nbsp; <b>Reemplazo:</b> #${Number(r.replacement_account_id)}` : ''}</p>
        <p><b>Falla:</b> ${safeText(r.issue_type)}</p>
        <p><b>Explicación:</b> ${safeText(r.description)}</p>
        ${Number(r.has_evidence || 0) === 1 ? `<div class="order-proof-row"><button class="outline-btn" style="width:auto" onclick="openMyReportEvidence(${r.id})">👁️ Ver evidencia</button></div>` : ''}
        <div class="order-data response-text" style="background:#eef2ff; margin-top: 10px;"><b>Respuesta del admin:</b><br>${safeText(r.admin_response || 'En revisión por el administrador...')}</div>
        ${renderReplacementReportActions(r)}
      </div>`).join('')
      : 'No has reportado fallas.';

    if (typeof renderTablePager === 'function') {
      renderTablePager(box, 'myReportsPaginationControls', currentMyReportsPage, totalPages, 'goMyReportsPagePrev', 'goMyReportsPageNext');
    }
  } catch (e) {
    console.warn(e);
  }
}
window.goMyReportsPagePrev = function(){ if(currentMyReportsPage > 1) loadMyReports(currentMyReportsPage - 1); };
window.goMyReportsPageNext = function(){ loadMyReports(currentMyReportsPage + 1); };

function isLikelyAttachmentValue(v) {
  const s = String(v || '').trim();
  if (!s) return false;
  if (/^data:(?:image\/|application\/pdf)/i.test(s)) return true;
  if (/^https?:\/\//i.test(s)) return true;
  if (/\.(png|jpe?g|webp|gif|bmp|svg|pdf)(\?|#|$)/i.test(s)) return true;
  return false;
}

function isLikelyImageAttachment(v) {
  const s = String(v || '').trim();
  if (/^data:image\//i.test(s)) return true;
  if (/\.(png|jpe?g|webp|gif|bmp|svg)(\?|#|$)/i.test(s)) return true;
  return false;
}

function isLazyAttachmentDescriptor(value){
  return Boolean(value && typeof value === 'object' && value.__lazy_attachment === true);
}

function renderAttachmentButtons(url) {
  const safeUrl = safeText(url || '');
  const label = isLikelyImageAttachment(url) ? '👁️ Ver imagen' : '👁️ Abrir archivo';
  return `<div class="proof-actions"><a class="proof-action-btn" href="${safeUrl}" target="_blank" rel="noopener noreferrer">${label}</a><a class="proof-action-btn proof-action-download" href="${safeUrl}" download>📥 Descargar</a></div>`;
}

const __lazyMediaCache = new Map();

function closeLazyMediaModal(){
  document.getElementById('lazyMediaModal')?.remove();
}
window.closeLazyMediaModal = closeLazyMediaModal;

function showLazyMediaModal(title, value, meta = {}){
  closeLazyMediaModal();
  const safeValue = safeText(value || '');
  const mime = String(meta.mime_type || '').toLowerCase();
  const isImage = Boolean(meta.is_image) || mime.startsWith('image/') || /^data:image\//i.test(String(value || ''));
  const isPdf = Boolean(meta.is_pdf) || mime === 'application/pdf' || /^data:application\/pdf/i.test(String(value || ''));
  const preview = isImage
    ? `<img class="lazy-media-image" src="${safeValue}" alt="${safeText(title)}">`
    : isPdf
      ? `<iframe class="lazy-media-frame" src="${safeValue}" title="${safeText(title)}"></iframe>`
      : `<p class="small-text">El archivo está listo para abrirse o descargarse.</p>`;

  document.body.insertAdjacentHTML('beforeend', `
    <div id="lazyMediaModal" class="modal-overlay">
      <div class="modal-card lazy-media-card">
        <div class="panel-head">
          <h3 style="margin:0">${safeText(title)}</h3>
          <button class="outline-btn" style="width:auto" onclick="closeLazyMediaModal()">Cerrar</button>
        </div>
        <div class="lazy-media-preview">${preview}</div>
        <div class="proof-actions" style="margin-top:12px">
          <a class="proof-action-btn" href="${safeValue}" target="_blank" rel="noopener noreferrer">Abrir en pestaña nueva</a>
          <a class="proof-action-btn proof-action-download" href="${safeValue}" download>📥 Descargar</a>
        </div>
      </div>
    </div>`);
}

async function openLazyApiMedia(cacheKey, url, title, valueKey = 'value'){
  try{
    let payload = __lazyMediaCache.get(cacheKey);
    if(!payload){
      payload = await api(url);
      __lazyMediaCache.set(cacheKey, payload);
    }
    const value = String(payload?.[valueKey] || '').trim();
    if(!value) throw new Error('El archivo ya no está disponible');
    showLazyMediaModal(title, value, payload);
  }catch(e){
    showMessage(e.message || 'No se pudo abrir el archivo', 'error');
  }
}
window.openLazyApiMedia = openLazyApiMedia;

window.openOrderAttachment = function openOrderAttachment(orderId, encodedField){
  const field = decodeURIComponent(String(encodedField || ''));
  const query = encodeURIComponent(field);
  return openLazyApiMedia(`order:${orderId}:${field}`, `/api/orders/${orderId}/attachment?field=${query}`, `Adjunto del pedido #${orderId}`);
};
window.openMyReportEvidence = function openMyReportEvidence(reportId){
  return openLazyApiMedia(`my-report:${reportId}`, `/api/my-account-reports/${reportId}/evidence`, `Evidencia del reporte #${reportId}`, 'evidence_image');
};
window.openBalanceRequestProof = function openBalanceRequestProof(requestId, adminMode){
  const prefix = adminMode ? '/api/admin/balance-requests/' : '/api/my-balance-requests/';
  return openLazyApiMedia(`balance:${adminMode ? 'admin' : 'my'}:${requestId}`, `${prefix}${requestId}/proof`, `Comprobante de saldo #${requestId}`);
};

function renderOrderData(data, orderId) {
  const entries = Object.entries(data || {});
  if (!entries.length) return '';
  return `<div class="order-data"><b>Datos enviados:</b>${entries.map(([k, v]) => {
      if (isLazyAttachmentDescriptor(v)) {
        const encodedField = encodeURIComponent(String(v.field || k));
        const label = v.is_image ? '👁️ Ver imagen adjunta' : '👁️ Abrir archivo adjunto';
        return `<div class="order-proof-row"><p style="margin:5px 0"><b>${safeText(fieldLabel(k))}:</b></p><div class="proof-actions"><button class="proof-action-btn" type="button" onclick="openOrderAttachment(${Number(orderId || 0)}, '${encodedField}')">${label}</button></div></div>`;
      }
      const value = String(v ?? '').trim();
      if (isLikelyAttachmentValue(value)) {
        return `<div class="order-proof-row"><p style="margin:5px 0"><b>${safeText(fieldLabel(k))}:</b></p>${renderAttachmentButtons(value)}</div>`;
      }
      return `<p style="margin:5px 0"><b>${safeText(fieldLabel(k))}:</b> ${safeText(value)}</p>`;
    }).join('')}</div>`;
}

async function enviarSolicitudSaldo() {
  try {
    const nombre = (document.getElementById('saldoNombre')?.value || '').trim();
    const banco = (document.getElementById('saldoBanco')?.value || '').trim();
    const monto = (document.getElementById('saldoMonto')?.value || '').trim();
    if (!nombre || !banco || !monto) throw new Error('Nombre, banco y monto son obligatorios');

    const data = await api('/api/balance-requests', {
      method: 'POST',
      body: JSON.stringify({
        amount: monto,
        bank: banco,
        reference: 'No proporcionada',
        account_holder: nombre,
        proof: ''
      })
    });

    showMessage(data.message || 'Solicitud enviada');
    saldoNombre.value = saldoBanco.value = saldoMonto.value = '';
    await loadBalanceRequests();
  } catch (e) {
    showMessage(e.message, 'error');
  }
}

async function enviarReporteCuenta() {
  try {
    const correo = (document.getElementById('reporteCorreo')?.value || '').trim();
    const tipo = (document.getElementById('reporteTipo')?.value || 'otro').trim();
    const explicacion = (document.getElementById('reporteExplicacion')?.value || '').trim();
    if (!correo || !explicacion) throw new Error('Correo y explicación son obligatorios');

    let fotoBase64 = null;
    const fotoInput = document.getElementById('reporteEvidencia');
    if (fotoInput && fotoInput.files.length > 0) {
      const file = fotoInput.files[0];
      if (file.size > 2 * 1024 * 1024) {
        throw new Error('La imagen es muy pesada (Máximo 2MB). Usa una imagen más ligera o recortada.');
      }
      fotoBase64 = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.readAsDataURL(file);
      });
    }

    const reportedAccountId = Number(getExactReportAccountId() || document.getElementById('reporteCuentaSelect')?.value || 0);

    const data = await api('/api/account-reports', {
      method: 'POST',
      body: JSON.stringify({
        email: correo,
        issue_type: tipo,
        description: explicacion,
        evidence_image: fotoBase64,
        ...(reportedAccountId > 0 ? { reported_account_id: reportedAccountId } : {})
      })
    });

    showMessage(data.message || 'Reporte enviado');

    if (document.getElementById('reporteCorreo')) document.getElementById('reporteCorreo').value = '';
    if (document.getElementById('reporteExplicacion')) document.getElementById('reporteExplicacion').value = '';
    if (document.getElementById('reporteCuentaSelect')) document.getElementById('reporteCuentaSelect').value = '';
    setExactReportAccountId(0);
    if (fotoInput) fotoInput.value = '';

    if (typeof loadAccountReports === 'function') await loadAccountReports(1);
    if (typeof loadMyReports === 'function') await loadMyReports(1);
    if (typeof loadMyFailureResponsesFinal === 'function') await loadMyFailureResponsesFinal(1);
  } catch (e) {
    showMessage(e.message, 'error');
  }
}

function getBalanceRequestStatusText(status) {
  const statuses = {
    pendiente: 'Pendiente',
    aprobado: 'Aprobado',
    aprobada: 'Aprobada',
    rechazado: 'Rechazado',
    rechazada: 'Rechazada'
  };
  return statuses[String(status || '').toLowerCase()] || status || 'pendiente';
}

async function loadBalanceRequests(page = currentAdminBalanceRequestsPage) {
  try {
    if (currentUser?.role === 'admin') {
      const requestedPage = Math.max(1, Number(page || 1));
      const payload = await api(`/api/admin/balance-requests?page=${requestedPage}&limit=${HISTORY_PAGE_LIMIT}&status=pendiente`);
      const requests = Array.isArray(payload?.rows) ? payload.rows : [];
      const total = Number(payload?.total || 0);
      const totalPages = Math.max(1, Number(payload?.totalPages || 1));
      currentAdminBalanceRequestsPage = Math.max(1, Number(payload?.page || requestedPage));
      if(currentAdminBalanceRequestsPage > totalPages) return loadBalanceRequests(totalPages);

      if(statBalanceRequests) statBalanceRequests.textContent = total;
      const box = document.getElementById('adminBalanceRequestsList');
      if (box) {
        box.innerHTML = requests.length ? requests.map((r) => `
          <div class="item">
            <p><b>Solicitud:</b> #${r.id}</p>
            <p><b>Cliente:</b> ${safeText(r.customer_name || r.name || 'Cliente')}</p>
            <p><b>Correo:</b> ${safeText(r.customer_email || r.email || '')}</p>
            <p><b>Nombre transferencia:</b> ${safeText(r.account_holder || r.titular || '')}</p>
            <p><b>Banco:</b> ${safeText(r.bank || r.banco || '')}</p>
            <p><b>Monto:</b> $${formatMoney(r.amount || r.monto)}</p>
            <p><b>Estado:</b> <span class="status">${safeText(getBalanceRequestStatusText(r.status || 'pendiente'))}</span></p>
            ${Number(r.has_proof || 0) === 1 ? `<div class="order-proof-row"><button class="outline-btn" style="width:auto" onclick="openBalanceRequestProof(${r.id}, true)">👁️ Ver comprobante</button></div>` : ''}
            <label class="field-label">Respuesta para el cliente</label>
            <textarea id="balance-response-${r.id}" placeholder="Ejemplo: Saldo aprobado y agregado a tu cuenta.">${safeText(r.admin_response || '')}</textarea>
            <div class="two-row">
              <button class="green-btn" onclick="updateBalanceRequestStatus(${r.id}, 'aprobado')">Aprobar y sumar saldo</button>
              <button class="danger-btn" onclick="updateBalanceRequestStatus(${r.id}, 'rechazado')">Rechazar</button>
            </div>
          </div>`).join('') : 'Sin solicitudes pendientes.';
        if(typeof renderTablePager === 'function'){
          renderTablePager(box, 'balanceRequestsPaginationControls', currentAdminBalanceRequestsPage, totalPages, 'goBalanceRequestsPagePrev', 'goBalanceRequestsPageNext');
        }
      }
    } else {
      const payload = await api('/api/my-balance-requests?page=1&limit=1&status=pendiente');
      if(statBalanceRequests) statBalanceRequests.textContent = Number(payload?.total || 0);
    }
  } catch (e) {
    console.warn('No se pudieron cargar solicitudes de saldo', e);
    if(statBalanceRequests) statBalanceRequests.textContent = '0';
  }
}
window.goBalanceRequestsPagePrev = function(){ if(currentAdminBalanceRequestsPage > 1) loadBalanceRequests(currentAdminBalanceRequestsPage - 1); };
window.goBalanceRequestsPageNext = function(){ loadBalanceRequests(currentAdminBalanceRequestsPage + 1); };

async function updateBalanceRequestStatus(requestId, status) {
  try {
    const response = document.getElementById('balance-response-' + requestId)?.value || '';
    const data = await api('/api/admin/balance-requests/' + requestId + '/status', {
      method: 'PATCH',
      body: JSON.stringify({
        status: status,
        admin_response: response
      })
    });
    showMessage(data.message || 'Solicitud de saldo actualizada');
    await loadBalanceRequests(currentAdminBalanceRequestsPage);
    showSection('admin');
    setTimeout(() => scrollToAdmin('adminBalanceRequestsPanel'), 120);
  } catch (e) {
    showMessage(e.message, 'error');
  }
}

function copyText(t) {
  copyToClipboard(t, 'Copiado');
}

function parseCurrentAccountsFromOrder(order) {
  let accounts = order?.current_accounts;
  if (typeof accounts === 'string') {
    try { accounts = JSON.parse(accounts); } catch (_) { accounts = []; }
  }
  accounts = Array.isArray(accounts) ? accounts : [];

  const currentId = Number(order?.current_account_id || order?.assigned_platform_account_id || 0);
  if (currentId > 0 && !accounts.some((account) => Number(account?.id || 0) === currentId)) {
    accounts.unshift({
      id: currentId,
      platform: order?.current_platform || order?.current_account_product_name || order?.product_name || '',
      product_name: order?.current_account_product_name || order?.current_platform || order?.product_name || '',
      account_email: order?.current_account_email || '',
      account_password: order?.current_account_password || '',
      profile_name: order?.current_profile_name || '',
      profile_pin: order?.current_profile_pin || '',
      delivered_at: order?.current_delivered_at || null,
      expires_at: order?.current_expires_at || null,
      official_purchase_date: order?.current_official_purchase_date || null,
      mother_account_id: order?.current_mother_account_id || null,
      access_url: order?.current_access_url || ''
    });
  }

  return accounts.filter((account) => Number(account?.id || 0) > 0);
}

function getCurrentAccountFromOrder(order, accountId = 0) {
  const accounts = parseCurrentAccountsFromOrder(order);
  const exactId = Number(accountId || 0);
  if (exactId > 0) return accounts.find((account) => Number(account.id) === exactId) || null;
  const assignedId = Number(order?.current_account_id || order?.assigned_platform_account_id || 0);
  return accounts.find((account) => Number(account.id) === assignedId) || accounts[0] || null;
}

function formatCurrentAccountDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString('es-MX');
}

function renderCurrentOrderAccounts(order) {
  const accounts = parseCurrentAccountsFromOrder(order);
  if (!accounts.length) return '';
  return `<div class="order-data current-order-accounts"><b>Cuenta${accounts.length > 1 ? 's' : ''} vigente${accounts.length > 1 ? 's' : ''}:</b>${accounts.map((account) => `
    <div class="current-order-account" style="margin-top:8px;padding-top:8px;border-top:1px solid #dbe2ea">
      <p style="margin:4px 0"><b>ID:</b> #${Number(account.id)}</p>
      <p style="margin:4px 0"><b>Plataforma:</b> ${safeText(account.platform || account.product_name || order?.product_name || '-')}</p>
      <p style="margin:4px 0"><b>Correo:</b> ${safeText(account.account_email || '-')}</p>
      <p style="margin:4px 0"><b>Contraseña:</b> ${safeText(account.account_password || '-')}</p>
      <p style="margin:4px 0"><b>Perfil:</b> ${safeText(account.profile_name || 'No aplica')} &nbsp; <b>PIN:</b> ${safeText(account.profile_pin || 'No aplica')}</p>
      <p style="margin:4px 0"><b>Compra original:</b> ${safeText(formatCurrentAccountDate(account.official_purchase_date || order?.created_at))} &nbsp; <b>Vence:</b> ${safeText(formatCurrentAccountDate(account.expires_at))}</p>
      <p style="margin:4px 0"><b>Última entrega/reemplazo:</b> ${safeText(formatCurrentAccountDate(account.delivered_at))}</p>
      ${account.access_url ? `<p style="margin:4px 0"><b>URL:</b> ${safeText(account.access_url)}</p>` : ''}
      <button class="copy-account-btn danger-btn" type="button" onclick="reportDeliveredAccount(${Number(order?.id || 0)}, ${Number(account.id)})">⚠ Reportar falla de este perfil</button>
    </div>`).join('')}</div>`;
}

function getAccountTextFromOrder(order) {
  return String(order?.delivered_account_data || order?.admin_response || '').trim();
}

window.parseCurrentAccountsFromOrder = parseCurrentAccountsFromOrder;
window.getCurrentAccountFromOrder = getCurrentAccountFromOrder;
window.renderCurrentOrderAccounts = renderCurrentOrderAccounts;

function copyToClipboard(text, successMessage = 'Copiado') {
  const value = String(text || '').trim();
  if (!value) {
    showMessage('No hay datos para copiar', 'error');
    return;
  }
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard
      .writeText(value)
      .then(() => showMessage(successMessage))
      .catch(() => fallbackCopy(value, successMessage));
  } else {
    fallbackCopy(value, successMessage);
  }
}

function fallbackCopy(text, successMessage) {
  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.left = '-9999px';
    document.body.appendChild(area);
    area.select();
    document.execCommand('copy');
    document.body.removeChild(area);
    showMessage(successMessage);
  } catch (e) {
    showMessage('No se pudo copiar. Selecciona el texto manualmente.', 'error');
  }
}

function copyAccountDataFromOrder(orderId, source = 'my') {
  const list = source === 'admin' ? adminOrders : myOrders;
  const order = list.find((o) => Number(o.id) === Number(orderId));
  let text = '';
  if (source === 'admin') {
    const responseBox = document.getElementById(`response-${orderId}`);
    text = (responseBox?.value || getAccountTextFromOrder(order) || '').trim();
  } else {
    text = getAccountTextFromOrder(order);
  }
  copyToClipboard(text, 'Datos de cuenta copiados');
}

const immediateDeliveryModalState = {
  text: '',
  orderId: 0,
  productName: '',
  assignedAccounts: [],
  selectedAccountId: 0,
  previousFocus: null
};

function normalizeImmediateDeliveryPayload(payload) {
  if (typeof payload === 'string') {
    return {
      text: payload,
      orderId: 0,
      productName: '',
      assignedAccounts: []
    };
  }

  const source = payload && typeof payload === 'object' ? payload : {};
  const accounts = Array.isArray(source.assigned_accounts)
    ? source.assigned_accounts
        .map((account) => ({
          id: Number(account?.id || 0),
          platform: String(account?.platform || account?.product_name || '').trim(),
          product_name: String(account?.product_name || account?.platform || '').trim(),
          account_email: String(account?.account_email || '').trim(),
          profile_name: String(account?.profile_name || '').trim(),
          reportable: account?.reportable !== false
        }))
        .filter((account) => account.id > 0)
    : [];

  const fallbackAccountId = Number(source.assigned_account_id || 0);
  if (!accounts.length && fallbackAccountId > 0) {
    accounts.push({
      id: fallbackAccountId,
      platform: String(source.product_name || '').trim(),
      product_name: String(source.product_name || '').trim(),
      account_email: extractAccountEmailFromText(source.delivered_account_data || ''),
      profile_name: '',
      reportable: source.reportable !== false
    });
  }

  return {
    text: String(source.delivered_account_data || source.text || '').trim(),
    orderId: Number(source.order_id || 0),
    productName: String(source.product_name || '').trim(),
    assignedAccounts: accounts
  };
}

function ensureImmediateDeliveryModalAtBodyRoot() {
  const modal = document.getElementById('modalEntregaInmediata');
  if (modal && modal.parentElement !== document.body) {
    document.body.appendChild(modal);
  }
  return modal;
}

function renderImmediateDeliveryAccountChooser(accounts) {
  const wrap = document.getElementById('modalEntregaAccountChooser');
  const select = document.getElementById('modalEntregaAccountSelect');
  if (!wrap || !select) return;

  if (!Array.isArray(accounts) || accounts.length <= 1) {
    wrap.classList.add('hidden');
    select.innerHTML = '';
    immediateDeliveryModalState.selectedAccountId = Number(accounts?.[0]?.id || 0);
    return;
  }

  select.innerHTML = accounts.map((account) => {
    const label = [
      account.platform || account.product_name || 'Plataforma',
      account.account_email,
      account.profile_name ? `Perfil: ${account.profile_name}` : ''
    ].filter(Boolean).join(' · ');
    return `<option value="${Number(account.id)}">${safeText(label)}</option>`;
  }).join('');

  immediateDeliveryModalState.selectedAccountId = Number(accounts[0]?.id || 0);
  wrap.classList.remove('hidden');
}

function openModalEntregaInmediata(payload) {
  const normalized = normalizeImmediateDeliveryPayload(payload);
  if (!normalized.text) return false;

  const modal = ensureImmediateDeliveryModalAtBodyRoot();
  const box = document.getElementById('modalEntregaInmediataText');
  const title = document.getElementById('modalEntregaTitulo');
  const orderLabel = document.getElementById('modalEntregaOrderLabel');
  const reportButton = document.getElementById('modalEntregaReportBtn');
  if (!modal || !box) return false;

  immediateDeliveryModalState.text = normalized.text;
  immediateDeliveryModalState.orderId = normalized.orderId;
  immediateDeliveryModalState.productName = normalized.productName;
  immediateDeliveryModalState.assignedAccounts = normalized.assignedAccounts;
  immediateDeliveryModalState.selectedAccountId = Number(normalized.assignedAccounts[0]?.id || 0);
  immediateDeliveryModalState.previousFocus = document.activeElement instanceof HTMLElement
    ? document.activeElement
    : null;

  box.value = normalized.text;
  if (title) {
    title.textContent = normalized.productName
      ? `🎉 ${normalized.productName} entregado`
      : '🎉 Entrega inmediata completada';
  }
  if (orderLabel) {
    orderLabel.textContent = normalized.orderId > 0
      ? `Pedido #${normalized.orderId} · Guarda estos datos en un lugar seguro.`
      : 'Guarda estos datos en un lugar seguro.';
  }

  renderImmediateDeliveryAccountChooser(normalized.assignedAccounts);

  if (reportButton) {
    const canReport = normalized.assignedAccounts.some((account) => Number(account.id) > 0 && account.reportable !== false);
    reportButton.disabled = !canReport;
    reportButton.title = canReport
      ? 'Abrir el formulario con esta cuenta seleccionada'
      : 'Esta entrega no tiene una cuenta reportable asociada';
  }

  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');
  requestAnimationFrame(() => document.getElementById('modalEntregaCopyBtn')?.focus());
  return true;
}

function closeModalEntregaInmediata() {
  const modal = document.getElementById('modalEntregaInmediata');
  if (!modal) return;
  modal.classList.add('hidden');
  modal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('modal-open');

  const previous = immediateDeliveryModalState.previousFocus;
  immediateDeliveryModalState.previousFocus = null;
  if (previous && document.contains(previous) && typeof previous.focus === 'function') {
    previous.focus();
  }
}

function copyEntregaInmediataData() {
  const text = immediateDeliveryModalState.text || document.getElementById('modalEntregaInmediataText')?.value || '';
  if (!text.trim()) return showMessage('No hay datos para copiar', 'error');
  copyToClipboard(text, 'Datos de entrega copiados');
}

async function reportEntregaInmediata() {
  const accounts = (immediateDeliveryModalState.assignedAccounts || []).filter((account) => account.reportable !== false);
  const selectedFromModal = Number(document.getElementById('modalEntregaAccountSelect')?.value || 0);
  const accountId = selectedFromModal || Number(immediateDeliveryModalState.selectedAccountId || accounts[0]?.id || 0);
  const account = accounts.find((item) => Number(item.id) === accountId) || accounts[0] || null;

  if (!accountId) {
    showMessage('No pude identificar la cuenta comprada para reportarla', 'error');
    return;
  }

  closeModalEntregaInmediata();
  setExactReportAccountId(accountId);
  showSection('reports');

  try {
    if (typeof window.ensureReportSelectStable === 'function') {
      window.ensureReportSelectStable();
    }
    if (typeof window.loadReportableAccountsStable === 'function') {
      await window.loadReportableAccountsStable();
    }

    const reportSelect = document.getElementById('reporteCuentaSelect');
    if (reportSelect) {
      ensureExactReportOption(reportSelect, {
        ...account,
        id: accountId,
        order_id: immediateDeliveryModalState.orderId,
        product_name: immediateDeliveryModalState.productName
      });
      reportSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }

    const emailInput = document.getElementById('reporteCorreo');
    const deliveredEmail = String(account?.account_email || extractAccountEmailFromText(immediateDeliveryModalState.text) || '').trim();
    if (emailInput && deliveredEmail) emailInput.value = deliveredEmail;

    const description = document.getElementById('reporteExplicacion');
    if (description) {
      description.value = '';
      requestAnimationFrame(() => description.focus());
    }

    showMessage('Cuenta comprada seleccionada. Describe la falla para enviar el reporte.');
  } catch (error) {
    showMessage(error?.message || 'No se pudo preparar el reporte de esta cuenta', 'error');
  }
}

function onImmediateDeliveryAccountChange() {
  immediateDeliveryModalState.selectedAccountId = Number(document.getElementById('modalEntregaAccountSelect')?.value || 0);
}

function handleImmediateDeliveryModalKeydown(event) {
  const modal = document.getElementById('modalEntregaInmediata');
  if (!modal || modal.classList.contains('hidden')) return;
  if (event.key === 'Escape') {
    event.preventDefault();
    closeModalEntregaInmediata();
  }
}

document.addEventListener('keydown', handleImmediateDeliveryModalKeydown);
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', ensureImmediateDeliveryModalAtBodyRoot, { once: true });
} else {
  ensureImmediateDeliveryModalAtBodyRoot();
}

window.openModalEntregaInmediata = openModalEntregaInmediata;
window.closeModalEntregaInmediata = closeModalEntregaInmediata;
window.copyEntregaInmediataData = copyEntregaInmediataData;
window.reportEntregaInmediata = reportEntregaInmediata;
window.onImmediateDeliveryAccountChange = onImmediateDeliveryAccountChange;

function extractAccountEmailFromText(text) {
  const value = String(text || '');
  const match = value.match(/(?:📧\s*)?Correo:\s*([^\s\n]+)/i);
  return match ? match[1].trim() : '';
}

async function reportDeliveredAccount(orderId, accountId = 0) {
  const order = myOrders.find((item) => Number(item.id) === Number(orderId));
  const account = getCurrentAccountFromOrder(order, accountId);
  const exactAccountId = Number(account?.id || accountId || 0);

  if (!order || exactAccountId <= 0) {
    showMessage('No pude identificar el perfil vigente exacto de este pedido', 'error');
    return;
  }

  setExactReportAccountId(exactAccountId);
  showSection('reports');
  if (typeof window.ensureReportSelectStable === 'function') window.ensureReportSelectStable();
  if (typeof window.loadReportableAccountsStable === 'function') await window.loadReportableAccountsStable();

  const select = document.getElementById('reporteCuentaSelect');
  if (!select) {
    showMessage('No se encontró el selector de cuentas reportables', 'error');
    return;
  }

  ensureExactReportOption(select, {
    ...account,
    id: exactAccountId,
    order_id: order.id,
    product_name: order.product_name
  });
  select.dispatchEvent(new Event('change', { bubbles: true }));

  const input = document.getElementById('reporteCorreo');
  if (input && account?.account_email) input.value = String(account.account_email);
  const description = document.getElementById('reporteExplicacion');
  if (description) {
    description.value = '';
    setTimeout(() => description.focus(), 100);
  }
  showMessage(`Perfil vigente #${exactAccountId} seleccionado. Describe la falla.`);
}
