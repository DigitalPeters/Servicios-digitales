let __messageClearTimer = null;

function showMessage(text, type = 'success') {
  const msg = document.getElementById('message');
  if (!msg) return;
  msg.innerHTML = `<p class="${type}">${safeText(text)}</p>`;
  if (__messageClearTimer) clearTimeout(__messageClearTimer);
  __messageClearTimer = setTimeout(() => {
    msg.innerHTML = '';
    __messageClearTimer = null;
  }, 4500);
}

function safeText(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function parseJsonArray(v) {
  try {
    if (Array.isArray(v)) return v;
    const parsed = JSON.parse(v || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseJsonObject(v) {
  try {
    if (typeof v === 'object' && v !== null) return v;
    const parsed = JSON.parse(v || '{}');
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

function normalizeFieldName(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ñ/g, 'n')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function fieldLabel(field) {
  const labels = {
    curp: 'CURP',
    rfc: 'RFC',
    idcif: 'IDCIF',
    nss: 'NSS',
    nombre_completo: 'Nombre completo',
    correo: 'Correo',
    telefono: 'Teléfono',
    fecha_nacimiento: 'Fecha de nacimiento'
  };
  return labels[field] || String(field).replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
}

function getChargeModeText(mode) {
  return mode === 'on_success'
    ? 'Se descuenta cuando el admin marque Éxito'
    : 'Se descuenta al comprar';
}

function getStatusText(status) {
  return ({
    accion_en_espera: 'Acción en espera',
    en_proceso: 'En proceso',
    exito: 'Éxito',
    rechazado: 'Rechazado'
  }[status] || status);
}

function formatMoney(value) {
  return Number(value || 0).toFixed(2);
}
