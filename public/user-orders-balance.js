async function loadMyOrders() {
  myOrders = await api('/api/my-orders');
  statOrders.textContent = myOrders.length;
  renderMyOrders();
  recentOrdersList.innerHTML =
    myOrders
      .slice(0, 4)
      .map(
        (o) =>
          `<div class="item"><b>#${o.id}</b> ${safeText(o.product_name)} <span class="status">${safeText(getStatusText(o.status))}</span></div>`
      )
      .join('') || 'Sin pedidos recientes.';
}

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
  const data = extractReplacementDeliveryData(report);
  const email = extractDeliveredAccountEmail(data) || String(report?.email || '').trim();
  const accountId = Number(report?.reported_account_id || 0);

  if (!report || !email) {
    showMessage('No pude identificar la cuenta reemplazada para reportarla', 'error');
    return;
  }

  showSection('reports');

  if (typeof window.ensureReportSelectStable === 'function') {
    window.ensureReportSelectStable();
  }
  if (typeof window.loadReportableAccountsStable === 'function') {
    await window.loadReportableAccountsStable();
  }

  const select = document.getElementById('reporteCuentaSelect');
  if (select && accountId > 0) {
    select.value = String(accountId);
    if (select.value === String(accountId)) {
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  const emailInput = document.getElementById('reporteCorreo');
  if (emailInput) emailInput.value = email;

  const description = document.getElementById('reporteExplicacion');
  if (description) {
    description.value = '';
    setTimeout(() => description.focus(), 100);
  }

  showMessage('Cuenta reemplazada seleccionada. Describe la nueva falla.');
};

async function loadMyReports() {
  try {
    const reports = await api('/api/my-account-reports');
    cacheMyAccountReports(reports);
    const box = document.getElementById('myReportsList');
    if (!box) return;
    box.innerHTML = reports.length
      ? reports
          .map(
            (r) => `
      <div class="item">
        <p><b>Reporte:</b> #${r.id} <span class="status">${safeText(r.status)}</span></p>
        <p><b>Correo reportado:</b> ${safeText(r.email)}</p>
        <p><b>Falla:</b> ${safeText(r.issue_type)}</p>
        <p><b>Explicación:</b> ${safeText(r.description)}</p>
        <div class="order-data response-text" style="background:#eef2ff; margin-top: 10px;"><b>Respuesta del admin:</b><br>${safeText(r.admin_response || 'En revisión por el administrador...')}</div>
        ${renderReplacementReportActions(r)}
      </div>
    `
          )
          .join('')
      : 'No has reportado fallas.';
  } catch (e) {
    console.warn(e);
  }
}

function isLikelyAttachmentValue(v) {
  const s = String(v || '').trim();
  if (!s) return false;
  if (/^data:image\//i.test(s)) return true;
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

function renderAttachmentButtons(url) {
  const safeUrl = safeText(url || '');
  return `<div class="proof-actions"><a class="proof-action-btn" href="${safeUrl}" target="_blank" rel="noopener noreferrer">👁️ Ver Imagen</a><a class="proof-action-btn proof-action-download" href="${safeUrl}" download>📥 Descargar Comprobante</a></div>`;
}

function renderOrderData(data) {
  const entries = Object.entries(data || {});
  if (!entries.length) return '';
  return `<div class="order-data"><b>Datos enviados:</b>${entries
    .map(([k, v]) => {
      const value = String(v ?? '').trim();
      if (isLikelyAttachmentValue(value)) {
        const preview = isLikelyImageAttachment(value)
          ? `<div class="proof-preview"><img src="${safeText(value)}" alt="Comprobante adjunto"></div>`
          : '';
        return `<div class="order-proof-row"><p style="margin:5px 0"><b>${safeText(fieldLabel(k))}:</b></p>${renderAttachmentButtons(value)}${preview}</div>`;
      }
      return `<p style="margin:5px 0"><b>${safeText(fieldLabel(k))}:</b> ${safeText(value)}</p>`;
    })
    .join('')}</div>`;
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

    const reportedAccountId = Number(document.getElementById('reporteCuentaSelect')?.value || 0);

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
    if (fotoInput) fotoInput.value = '';

    if (typeof loadAccountReports === 'function') await loadAccountReports();
    if (typeof loadMyReports === 'function') await loadMyReports();
    if (typeof loadMyFailureResponsesFinal === 'function') await loadMyFailureResponsesFinal();
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

async function loadBalanceRequests() {
  try {
    let requests = [];
    if (currentUser?.role === 'admin') {
      requests = await api('/api/admin/balance-requests');
      const pending = requests.filter((r) => String(r.status || '').toLowerCase() === 'pendiente');
      statBalanceRequests.textContent = pending.length;

      const box = document.getElementById('adminBalanceRequestsList');
      if (box) {
        box.innerHTML = pending.length
          ? pending
              .map(
                (r) => `
          <div class="item">
            <p><b>Solicitud:</b> #${r.id}</p>
            <p><b>Cliente:</b> ${safeText(r.customer_name || r.name || 'Cliente')}</p>
            <p><b>Correo:</b> ${safeText(r.customer_email || r.email || '')}</p>
            <p><b>Nombre transferencia:</b> ${safeText(r.account_holder || r.titular || '')}</p>
            <p><b>Banco:</b> ${safeText(r.bank || r.banco || '')}</p>
            <p><b>Monto:</b> $${formatMoney(r.amount || r.monto)}</p>
            <p><b>Estado:</b> <span class="status">${safeText(getBalanceRequestStatusText(r.status || 'pendiente'))}</span></p>

            <label class="field-label">Respuesta para el cliente</label>
            <textarea id="balance-response-${r.id}" placeholder="Ejemplo: Saldo aprobado y agregado a tu cuenta.">${safeText(r.admin_response || '')}</textarea>

            <div class="two-row">
              <button class="green-btn" onclick="updateBalanceRequestStatus(${r.id}, 'aprobado')">
                Aprobar y sumar saldo
              </button>
              <button class="danger-btn" onclick="updateBalanceRequestStatus(${r.id}, 'rechazado')">
                Rechazar
              </button>
            </div>
          </div>
        `
              )
              .join('')
          : 'Sin solicitudes pendientes.';
      }
    } else {
      try {
        requests = await api('/api/my-balance-requests');
      } catch (_) {
        requests = [];
      }
      const pending = requests.filter((r) => String(r.status || '').toLowerCase() === 'pendiente');
      statBalanceRequests.textContent = pending.length;
    }
  } catch (e) {
    console.warn('No se pudieron cargar solicitudes de saldo', e);
    statBalanceRequests.textContent = '0';
  }
}

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
    await loadBalanceRequests();
    showSection('admin');
    setTimeout(() => scrollToAdmin('adminBalanceRequestsPanel'), 120);
  } catch (e) {
    showMessage(e.message, 'error');
  }
}

function copyText(t) {
  copyToClipboard(t, 'Copiado');
}

function getAccountTextFromOrder(order) {
  return String(order?.delivered_account_data || order?.admin_response || '').trim();
}

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

function openModalEntregaInmediata(text) {
  const modal = document.getElementById('modalEntregaInmediata');
  const box = document.getElementById('modalEntregaInmediataText');
  if (!modal || !box) return;
  box.value = String(text || '').trim();
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
}

function closeModalEntregaInmediata() {
  const modal = document.getElementById('modalEntregaInmediata');
  if (!modal) return;
  modal.classList.add('hidden');
  modal.setAttribute('aria-hidden', 'true');
}

function copyEntregaInmediataData() {
  const text = document.getElementById('modalEntregaInmediataText')?.value || '';
  if (!text.trim()) return showMessage('No hay datos para copiar', 'error');
  copyToClipboard(text, 'Datos de entrega copiados');
}

function extractAccountEmailFromText(text) {
  const value = String(text || '');
  const match = value.match(/(?:📧\s*)?Correo:\s*([^\s\n]+)/i);
  return match ? match[1].trim() : '';
}

function reportDeliveredAccount(orderId) {
  const order = myOrders.find((o) => Number(o.id) === Number(orderId));
  const text = getAccountTextFromOrder(order);
  const email = extractAccountEmailFromText(text);
  if (!email) {
    showMessage('No pude detectar el correo de esta cuenta para reportarla', 'error');
    return;
  }
  showSection('reports');
  const input = document.getElementById('reporteCorreo');
  if (input) {
    input.value = email;
  }
  copyToClipboard(email, 'Correo copiado y colocado en el reporte');
  setTimeout(() => document.getElementById('reporteExplicacion')?.focus(), 150);
}
