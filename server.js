const express = require("express");
const crypto = require("crypto");
console.log("VERSION RECUPERACION 11-JUN-2026");
const { Pool } = require("pg");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const bodyParser = require("body-parser");
const cors = require("cors");
const compression = require("compression"); // <-- NUEVO COMPRESOR
const nodemailer = require("nodemailer");
const fs = require("fs");
const fsp = fs.promises;
const path = require("path");

const app = express();
const codigosRecuperacion = new Map();

const PORT = process.env.PORT || 3000;
const SECRET = process.env.JWT_SECRET || "mi_super_secreto";

const PANEL_BASE_DOMAIN = String(process.env.PANEL_BASE_DOMAIN || "katalogoclick.com")
  .trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");

const MAIN_ADMIN_EMAIL = String(process.env.ADMIN_EMAIL || "").trim().toLowerCase();
function isMainAdminEmail(email) {
  return Boolean(MAIN_ADMIN_EMAIL) && String(email || "").trim().toLowerCase() === MAIN_ADMIN_EMAIL;
}

function getRequestHost(req) {
  const forwarded = String(req.headers["x-forwarded-host"] || "").split(",")[0].trim();
  return String(forwarded || req.headers.host || "").split(":")[0].trim().toLowerCase();
}
function slugifyBusinessName(value) {
  return String(value || "").trim().toLowerCase().normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").replace(/ñ/g, "n")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50);
}
function getTenantSlugFromHost(req) {
  const host = getRequestHost(req), base = PANEL_BASE_DOMAIN;
  if (!host || host === base || host === `www.${base}`) return "";
  const suffix = `.${base}`;
  if (!host.endsWith(suffix)) return "";
  const slug = host.slice(0, -suffix.length);
  return slug && !slug.includes(".") ? slug : "";
}
function buildPanelUrl(slug) { return `https://${slug}.${PANEL_BASE_DOMAIN}`; }
function isTenantHost(req) { return Boolean(getTenantSlugFromHost(req)); }
async function getPanelBySlug(slug, client = pool) {
  const clean = String(slug || "").trim().toLowerCase();
  if (!clean) return null;
  const result = await client.query(
    `SELECT ap.*, owner.id AS owner_user_id, owner.name AS owner_user_name, owner.email AS owner_user_email
     FROM admin_panels ap
     LEFT JOIN users owner ON owner.id = ap.owner_user_id
     WHERE lower(ap.slug) = lower($1) LIMIT 1`, [clean]);
  return result.rows[0] || null;
}
async function getTenantPanelFromRequest(req, client = pool) {
  const slug = getTenantSlugFromHost(req);
  return slug ? getPanelBySlug(slug, client) : null;
}

app.use(bodyParser.json({ limit: "10mb" }));
app.use(cors());
app.use(compression()); // <-- EXPRIME LA PÁGINA PARA QUE CARGUE RÁPIDO
app.use(express.static("public"));

app.get("/test-recuperacion", (req, res) => {
  res.send("OK TEST");
});
// ===============================
// NOTIFICACIONES POR CORREO CON RESEND
// ===============================
// Variables necesarias en Render:
// RESEND_API_KEY = tu API key de Resend
// NOTIFY_EMAIL = correo donde quieres recibir los pedidos
// FROM_EMAIL = correo remitente. Si no tienes dominio verificado, usa onboarding@resend.dev
function getMailConfig() {
  const apiKey = process.env.RESEND_API_KEY || "";
  const notifyTo = process.env.NOTIFY_EMAIL || process.env.ADMIN_EMAIL || process.env.EMAIL_USER || "";
  const fromEmail = process.env.FROM_EMAIL || "onboarding@resend.dev";

  return { apiKey, notifyTo, fromEmail };
}

function isMailConfigured() {
  const { apiKey, notifyTo, fromEmail } = getMailConfig();
  return Boolean(apiKey && notifyTo && fromEmail);
}

function formatOrderData(orderData) {
  const data = safeJsonObject(orderData);
  const entries = Object.entries(data);

  if (entries.length === 0) {
    return "Sin datos adicionales";
  }

  return entries
    .map(([key, value]) => `${key}: ${value}`)
    .join("\n");
}


async function sendDirectUserEmail({ to, subject, text }) {
  try {
    if (!isMailConfigured()) {
      console.log("Correo al usuario NO enviado: faltan variables RESEND_API_KEY o FROM_EMAIL.");
      return false;
    }

    if (!to) {
      console.log("Correo al usuario NO enviado: destinatario vacío.");
      return false;
    }

    const { apiKey, fromEmail } = getMailConfig();

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: `Servicios Digitales Peters <${fromEmail}>`,
        to: [to],
        subject,
        text
      })
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error("Error enviando correo al usuario con Resend:", JSON.stringify(result));
      return false;
    }

    console.log(`Correo enviado al usuario ${to}: ${subject}`);
    return true;
  } catch (err) {
    console.error("Error enviando correo al usuario:", err.message);
    return false;
  }
}


async function sendNewOrderEmail({ orderId, customerName, customerEmail, productName, amount, orderData }) {
  try {
    if (!isMailConfigured()) {
      console.log("Correo NO enviado: faltan variables RESEND_API_KEY, NOTIFY_EMAIL o FROM_EMAIL.");
      return;
    }

    const { apiKey, notifyTo, fromEmail } = getMailConfig();

    const subject = `Nuevo pedido #${orderId} - ${productName}`;
    const text = `
Nuevo pedido recibido en Servicios Digitales Peters

Pedido: #${orderId}
Cliente: ${customerName || "Cliente"}
Correo cliente: ${customerEmail || "Sin correo"}
Producto: ${productName}
Monto: $${Number(amount || 0).toFixed(2)}

Datos del trámite:
${formatOrderData(orderData)}

Entra al panel de administrador para revisar el pedido.
    `.trim();

    console.log(`Intentando enviar correo con Resend desde ${fromEmail} hacia ${notifyTo}`);

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: `Servicios Digitales Peters <${fromEmail}>`,
        to: [notifyTo],
        subject,
        text
      })
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error("Error enviando correo con Resend:", JSON.stringify(result));
      return;
    }

    console.log(`Correo enviado correctamente con Resend para pedido #${orderId} a ${notifyTo}`);
  } catch (error) {
    console.error("Error enviando correo de nuevo pedido:", error.message);
  }
}


async function sendBalanceRequestEmail({ requestId, customerName, customerEmail, amount, bank, reference, accountHolder, proof, notifyToOverride }) {
  try {
    if (!isMailConfigured()) {
      console.log("Correo NO enviado: faltan variables RESEND_API_KEY, NOTIFY_EMAIL o FROM_EMAIL.");
      return;
    }

    const { apiKey, notifyTo: defaultNotifyTo, fromEmail } = getMailConfig();
    const notifyTo = notifyToOverride || defaultNotifyTo;

    const subject = `Nueva solicitud de saldo #${requestId} - $${Number(amount || 0).toFixed(2)}`;
    const text = `
Nueva solicitud de carga de saldo en Servicios Digitales Peters

Solicitud: #${requestId}
Cliente: ${customerName || "Cliente"}
Correo cliente: ${customerEmail || "Sin correo"}
Monto solicitado: $${Number(amount || 0).toFixed(2)}
Banco: ${bank || "Sin banco"}
Referencia / clave de rastreo: ${reference || "Sin referencia"}
Titular: ${accountHolder || "Sin titular"}
Comprobante / nota: ${proof || "No enviado"}

Revisa tu app bancaria. Si el pago sí llegó, entra al panel admin y aprueba la solicitud para sumar el saldo.
    `.trim();

    console.log(`Intentando enviar correo de solicitud de saldo con Resend desde ${fromEmail} hacia ${notifyTo}`);

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: `Servicios Digitales Peters <${fromEmail}>`,
        to: [notifyTo],
        subject,
        text
      })
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error("Error enviando correo de solicitud de saldo con Resend:", JSON.stringify(result));
      return;
    }

    console.log(`Correo de solicitud de saldo enviado correctamente con Resend para solicitud #${requestId}`);
  } catch (error) {
    console.error("Error enviando correo de solicitud de saldo:", error.message);
  }
}


async function sendAccountReportEmail({ reportId, customerName, customerEmail, email, issueType, description }) {
  try {
    if (!isMailConfigured()) {
      console.log("Correo NO enviado: faltan variables RESEND_API_KEY, NOTIFY_EMAIL o FROM_EMAIL.");
      return;
    }

    const { apiKey, notifyTo, fromEmail } = getMailConfig();

    const subject = `Nuevo reporte de cuenta #${reportId}`;
    const text = `
Nuevo reporte de cuenta en Servicios Digitales Peters

Reporte: #${reportId}
Cliente: ${customerName || "Cliente"}
Correo cliente: ${customerEmail || "Sin correo"}
Correo con falla: ${email || "Sin correo reportado"}
Tipo de falla: ${issueType || "Sin tipo"}

Explicación de la falla:
${description || "Sin explicación"}

Entra al panel admin, revisa la explicación y da el veredicto final: Resuelto, Reemplazo o Reembolso.
    `.trim();

    console.log(`Intentando enviar correo de reporte con Resend desde ${fromEmail} hacia ${notifyTo}`);

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: `Servicios Digitales Peters <${fromEmail}>`,
        to: [notifyTo],
        subject,
        text
      })
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error("Error enviando correo de reporte con Resend:", JSON.stringify(result));
      return;
    }

    console.log(`Correo de reporte enviado correctamente con Resend para reporte #${reportId}`);
  } catch (error) {
    console.error("Error enviando correo de reporte:", error.message);
  }
}


const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

console.log("DATABASE_URL existe:", !!process.env.DATABASE_URL);

async function markAccountAsSold(client, accountId, orderId, userId, isReusableSale = false) {
    try {
        console.log(`[INVENTARIO] Intentando descontar cuenta ${accountId} para pedido ${orderId}`);
        
        const result = await client.query(`
            UPDATE platform_accounts 
            SET status = CASE WHEN $4 = true THEN status ELSE 'delivered' END,
                assigned_order_id = $1, 
                assigned_user_id = $2, 
                delivered_at = NOW() 
            WHERE id = $3
              AND (
                status IN ('available', 'disponible')
                OR (
                  $4 = true
                  AND lower(COALESCE(status, 'available')) NOT IN ('failed', 'discarded', 'recovery_pending')
                )
              )
            RETURNING id, reusable;
        `, [orderId, userId, accountId, isReusableSale]);

        if (result.rowCount === 0) {
            throw new Error(`La cuenta ${accountId} ya no está disponible o no existe.`);
        }
        
        console.log(`[INVENTARIO] Éxito: Cuenta ${accountId} marcada como entregada.`);
        return true;
    } catch (error) {
        console.error(`[INVENTARIO] ERROR CRÍTICO: ${error.message}`);
        throw error; // Esto disparará el ROLLBACK de la transacción principal
    }
}

// Cuando una cuenta madre falla, todos los perfiles todavía disponibles que
// comparten el mismo correo deben salir del inventario vendible. El alcance se
// limita al mismo propietario del inventario para no afectar otros paneles.
async function markFailedAccountEmailGroup(client, {
  reportedAccountId,
  accountEmail,
  ownerAdminId
}) {
  const accountId = Number(reportedAccountId || 0);

  if (!accountId) {
    return {
      reportedAccountMarked: 0,
      availableSiblingsMarked: 0,
      totalMarked: 0,
      accountIds: []
    };
  }

  // El perfil exacto reportado siempre se marca como failed. Los demás perfiles
  // solo se retiran del inventario si todavía están disponibles y pertenecen a
  // la misma cuenta madre. Para registros antiguos sin mother_account_id se usa
  // correo + fecha oficial como respaldo; created_at nunca define el ciclo.
  const sourceResult = await client.query(
    `SELECT pa.id,
            pa.account_email,
            pa.owner_admin_id,
            pa.official_purchase_date,
            pa.mother_account_id,
            COALESCE(ma.original_purchase_date, pa.official_purchase_date) AS cycle_date
     FROM platform_accounts pa
     LEFT JOIN mother_accounts ma ON ma.id = pa.mother_account_id
     WHERE pa.id = $1
     LIMIT 1
     FOR UPDATE OF pa`,
    [accountId]
  );

  const sourceAccount = sourceResult.rows[0];
  if (!sourceAccount) {
    return {
      reportedAccountMarked: 0,
      availableSiblingsMarked: 0,
      totalMarked: 0,
      accountIds: []
    };
  }

  const cleanEmail = String(sourceAccount.account_email || accountEmail || "").trim();
  const sourceOwnerValue = sourceAccount.owner_admin_id;
  const inventoryOwnerId = sourceOwnerValue !== null && sourceOwnerValue !== undefined
    ? (Number(sourceOwnerValue || 0) || null)
    : (Number(ownerAdminId || 0) || null);
  const motherAccountId = Number(sourceAccount.mother_account_id || 0) || null;
  const cycleDate = sourceAccount.cycle_date || null;

  const result = await client.query(
    `UPDATE platform_accounts pa
     SET status = 'failed'
     WHERE pa.id = $1
        OR (
          pa.status IN ('available', 'disponible')
          AND (
            ($4::int IS NOT NULL AND pa.mother_account_id = $4)
            OR (
              $4::int IS NULL
              AND pa.mother_account_id IS NULL
              AND $2::text <> ''
              AND $5::date IS NOT NULL
              AND lower(regexp_replace(trim(COALESCE(pa.account_email, '')), '\\s+', '', 'g')) =
                  lower(regexp_replace(trim($2), '\\s+', '', 'g'))
              AND pa.official_purchase_date IS NOT DISTINCT FROM $5::date
            )
          )
          AND (
            (($3::int IS NULL OR $3::int = 0) AND (pa.owner_admin_id IS NULL OR pa.owner_admin_id = 0))
            OR ($3::int IS NOT NULL AND $3::int <> 0 AND pa.owner_admin_id = $3)
          )
        )
     RETURNING pa.id,
               CASE WHEN pa.id = $1 THEN 'reported' ELSE 'available_sibling' END AS failure_source`,
    [accountId, cleanEmail, inventoryOwnerId, motherAccountId, cycleDate]
  );

  const reportedAccountMarked = result.rows.filter(row => row.failure_source === 'reported').length;
  const availableSiblingsMarked = result.rows.filter(row => row.failure_source === 'available_sibling').length;

  return {
    reportedAccountMarked,
    availableSiblingsMarked,
    totalMarked: result.rowCount,
    accountIds: result.rows.map(row => Number(row.id)).filter(Number.isFinite),
    motherAccountId,
    cycleDate
  };
}

function safeJsonArray(value) {
  try {
    if (Array.isArray(value)) return value;
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function safeJsonObject(value) {
  try {
    if (typeof value === "object" && value !== null) return value;
    const parsed = JSON.parse(value || "{}");
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}


function getPaginationParams(req, defaultLimit = 20, maxLimit = 100) {
  const rawPage = Number(req.query.page || 1);
  const rawLimit = Number(req.query.limit || defaultLimit);
  const page = Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1;
  const limit = Number.isFinite(rawLimit) && rawLimit > 0
    ? Math.min(maxLimit, Math.floor(rawLimit))
    : defaultLimit;
  return { page, limit, offset: (page - 1) * limit };
}

function buildPaginationPayload(rows, page, limit, total, extra = {}) {
  const safeTotal = Math.max(0, Number(total || 0));
  return {
    rows,
    page,
    limit,
    total: safeTotal,
    totalPages: Math.max(1, Math.ceil(safeTotal / limit)),
    ...extra
  };
}

function getInlineAttachmentMeta(value, fieldName = "") {
  const text = String(value || "").trim();
  const match = text.match(/^data:([^;,]+)(?:;[^,]*)?,/i);
  if (!match) return null;
  const mimeType = String(match[1] || "application/octet-stream").toLowerCase();
  return {
    __lazy_attachment: true,
    field: String(fieldName || ""),
    mime_type: mimeType,
    is_image: mimeType.startsWith("image/"),
    is_pdf: mimeType === "application/pdf",
    encoded_size: text.length
  };
}

function summarizeOrderDataForList(rawOrderData) {
  const original = safeJsonObject(rawOrderData);
  const summary = {};

  for (const [field, value] of Object.entries(original)) {
    const attachment = getInlineAttachmentMeta(value, field);
    summary[field] = attachment || value;
  }

  return JSON.stringify(summary);
}

function summarizeOrderRowsForList(rows) {
  return (Array.isArray(rows) ? rows : []).map((row) => ({
    ...row,
    order_data: summarizeOrderDataForList(row.order_data)
  }));
}

function getOrderDataFieldValue(rawOrderData, field) {
  const data = safeJsonObject(rawOrderData);
  if (!Object.prototype.hasOwnProperty.call(data, field)) return undefined;
  return data[field];
}

function normalizeFieldName(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ñ/g, "n")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      role: user.role
    },
    SECRET,
    {
      expiresIn: "24h"
    }
  );
}

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ error: "No autorizado" });
  }

  const token = authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Token faltante" });
  }

  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch {
    return res.status(403).json({ error: "Token inválido" });
  }
}

async function adminMiddleware(req, res, next) {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Admin requerido" });
    }

    const userResult = await pool.query(
      `SELECT u.id, u.email, u.name, u.role, u.balance,
              COALESCE(u.is_subadmin, false) AS is_subadmin,
              u.owner_user_id,
              ap.id AS admin_panel_id,
              ap.business_name AS admin_panel_business_name,
              ap.status AS admin_panel_status
       FROM users u
       LEFT JOIN admin_panels ap ON ap.owner_user_id = u.id
       WHERE u.id = $1`,
      [req.user.id]
    );

    const user = userResult.rows[0];
    if (!user) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    if (user.admin_panel_id && String(user.admin_panel_status || "activo").toLowerCase() !== "activo") {
      return res.status(403).json({ error: "Panel suspendido o inactivo" });
    }

    req.adminUser = user;
    req.isPanelAdmin = Boolean(user.admin_panel_id) && !isMainAdminEmail(user.email);
    req.isMainAdmin = isMainAdminEmail(user.email) || !req.isPanelAdmin;
    next();
  } catch (err) {
    console.error("Error validando admin:", err.message);
    return res.status(500).json({ error: "Error validando permisos" });
  }
}

function mainAdminMiddleware(req, res, next) {
  if (!req.isMainAdmin) {
    return res.status(403).json({ error: "Admin principal requerido" });
  }
  next();
}


async function distributorMiddleware(req, res, next) {
  try {
    const result = await pool.query(
      `SELECT id, role, COALESCE(is_subadmin, false) AS is_subadmin FROM users WHERE id = $1`,
      [req.user.id]
    );

    const user = result.rows[0];

    if (!user || user.is_subadmin !== true) {
      return res.status(403).json({ error: "Distribuidor requerido" });
    }

    req.distributor = user;
    next();
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Error validando distribuidor" });
  }
}

async function inventoryHistoryAccessMiddleware(req, res, next) {
  try {
    const result = await pool.query(
      `SELECT id, role, COALESCE(is_subadmin, false) AS is_subadmin FROM users WHERE id = $1`,
      [req.user.id]
    );

    const user = result.rows[0];

    if (!user || (user.role !== 'admin' && user.is_subadmin !== true)) {
      return res.status(403).json({ error: 'Acceso restringido al historial de inventario' });
    }

    req.inventoryHistoryUser = user;
    next();
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Error validando acceso al historial de inventario' });
  }
}

async function getFullUser(userId, client = pool) {
  const result = await client.query(
    `SELECT id, name, email, role, balance,
            COALESCE(is_subadmin, false) AS is_subadmin,
            owner_user_id
     FROM users
     WHERE id = $1`,
    [userId]
  );

  return result.rows[0];
}

async function getAdminPanelForEmail(email, client = pool) {
  const cleanEmail = String(email || "").trim().toLowerCase();
  if (!cleanEmail) return null;

  const result = await client.query(
    `SELECT id, business_name, admin_name, email, status, plan_type, expires_at,
            bank_name, bank_holder, bank_clabe, payment_concept, notification_email
     FROM admin_panels
     WHERE lower(email) = lower($1)
     LIMIT 1`,
    [cleanEmail]
  );

  return result.rows[0] || null;
}

async function getAdminPanelForUserId(userId, client = pool) {
  const id = Number(userId || 0);
  if (!id) return null;
  const result = await client.query(
    `SELECT id, business_name, admin_name, email, status, plan_type, expires_at,
            bank_name, bank_holder, bank_clabe, payment_concept, notification_email
     FROM admin_panels
     WHERE owner_user_id = $1
     LIMIT 1`,
    [id]
  );
  return result.rows[0] || null;
}


async function getViewerContext(userId, client = pool) {
  const result = await client.query(
    `SELECT u.id, u.name, u.email, u.role, u.balance,
            COALESCE(u.is_subadmin, false) AS is_subadmin,
            u.owner_user_id,
            ap.id AS admin_panel_id,
            ap.business_name AS admin_panel_business_name,
            ap.bank_name, ap.bank_holder, ap.bank_clabe, ap.payment_concept,
            ap.notification_email, ap.status AS admin_panel_status,
            owner_panel.id AS owner_panel_id
     FROM users u
     LEFT JOIN admin_panels ap ON ap.owner_user_id = u.id
     LEFT JOIN users owner_user ON owner_user.id = u.owner_user_id
     LEFT JOIN admin_panels owner_panel ON owner_panel.owner_user_id = owner_user.id
     WHERE u.id = $1`,
    [userId]
  );
  const viewer = result.rows[0] || null;
  if (!viewer) return null;
  viewer.is_panel_admin = Boolean(viewer.admin_panel_id);
  viewer.owner_is_panel_admin = Boolean(viewer.owner_panel_id);
  // Reglas de negocio:
  // - admin principal: datos globales (owner_admin_id NULL/0)
  // - usuario convertido a distribuidor: usa productos/stock globales del admin principal
  // - panel vendido/rentado: usa sus propios productos/stock (owner_admin_id = su id de users)
  // - vendedor de panel vendido/rentado: usa productos/stock del panel dueño
  // - vendedor de distribuidor convertido: usa productos/stock globales del admin principal
  viewer.owner_admin_id = viewer.is_panel_admin ? viewer.id : (viewer.owner_is_panel_admin ? viewer.owner_user_id : null);
  return viewer;
}


async function getOwnerAndNotificationForUser(userId, client = pool) {
  const result = await client.query(
    `SELECT
       u.id,
       u.email,
       u.owner_user_id,
       owner.email AS owner_email,
       own_panel.id AS owner_panel_id,
       own_panel.notification_email AS owner_notification_email,
       self_panel.id AS self_panel_id,
       self_panel.notification_email AS self_notification_email
     FROM users u
     LEFT JOIN users owner ON owner.id = u.owner_user_id
     LEFT JOIN admin_panels own_panel ON own_panel.owner_user_id = owner.id
     LEFT JOIN admin_panels self_panel ON self_panel.owner_user_id = u.id
     WHERE u.id = $1
     LIMIT 1`,
    [userId]
  );

  const row = result.rows[0] || {};
  const ownerAdminId = row.owner_user_id || (row.self_panel_id ? row.id : null);
  const notificationEmail = row.owner_notification_email || row.self_notification_email || "";

  return { ownerAdminId, notificationEmail };
}

function adminOwnedWhere(viewer, alias = "") {
  const prefix = alias ? alias + "." : "";

  // Panel vendido/rentado y sus vendedores: solo datos propios del panel.
  if (viewer && viewer.owner_admin_id) {
    return { clause: `${prefix}owner_admin_id = $1`, params: [viewer.owner_admin_id] };
  }

  // Admin principal, usuarios normales y distribuidores convertidos: datos globales.
  return { clause: `(${prefix}owner_admin_id IS NULL OR ${prefix}owner_admin_id = 0)`, params: [] };
}

function productAccountMatchCondition(productAlias = "products", accountAlias = "pa") {
  return `(
    lower(COALESCE(NULLIF(TRIM(${accountAlias}.product_name), ''), NULLIF(TRIM(${accountAlias}.platform), ''))) = lower(${productAlias}.name)
    OR lower(COALESCE(${accountAlias}.platform, '')) = lower(${productAlias}.name)
  )`;
}

function productAccountOwnerCondition(productAlias = "products", accountAlias = "pa") {
  return `(
    (${productAlias}.owner_admin_id IS NULL AND (${accountAlias}.owner_admin_id IS NULL OR ${accountAlias}.owner_admin_id = 0))
    OR ${accountAlias}.owner_admin_id = ${productAlias}.owner_admin_id
  )`;
}

function reusableProductTextCondition(productAlias = "products") {
  return `lower(concat_ws(' ', COALESCE(${productAlias}.name, ''), COALESCE(${productAlias}.category, '')))
    ~ '(pdf|curso|ebook|manual|guia|guía)'`;
}

function reusableStockSubquery(productAlias = "products") {
  return `EXISTS (
    SELECT 1
    FROM platform_accounts pa
    WHERE (
        COALESCE(pa.reusable, 0) = 1
        OR (
          ${reusableProductTextCondition(productAlias)}
          AND COALESCE(NULLIF(TRIM(pa.access_url), ''), '') <> ''
        )
      )
      AND lower(COALESCE(pa.status, 'available')) IN ('available', 'disponible', 'delivered')
      AND ${productAccountOwnerCondition(productAlias, 'pa')}
      AND ${productAccountMatchCondition(productAlias, 'pa')}
  )`;
}

function dynamicStockSubquery(productAlias = "products") {
  return `COALESCE((
    SELECT COUNT(*)::int
    FROM platform_accounts pa
    WHERE pa.status IN ('available', 'disponible')
      AND ${productAccountOwnerCondition(productAlias, 'pa')}
      AND ${productAccountMatchCondition(productAlias, 'pa')}
  ), 0)`;
}

function effectiveStockExpression(productAlias = "products") {
  return `CASE
    WHEN lower(trim(COALESCE(${productAlias}.product_type, 'streaming_auto'))) LIKE '%combo%'
      THEN 0
    -- La configuración explícita del producto siempre tiene prioridad.
    -- stock_enabled = 0 significa venta sin límite; stock_enabled = 1 consume stock real.
    WHEN COALESCE(${productAlias}.stock_enabled, 0) <> 1
      THEN 1
    WHEN lower(trim(COALESCE(${productAlias}.product_type, 'streaming_auto'))) LIKE '%manual%'
      THEN GREATEST(0, COALESCE(${productAlias}.stock, 0))::int
    ELSE ${dynamicStockSubquery(productAlias)}
  END`;
}

function reusableStockFlagExpression(productAlias = "products") {
  return `CASE
    WHEN lower(trim(COALESCE(${productAlias}.product_type, 'streaming_auto'))) NOT LIKE '%combo%'
      AND COALESCE(${productAlias}.stock_enabled, 0) <> 1
      THEN 1
    ELSE 0
  END`;
}

function normalizeProductType(value) {
  const clean = String(value || "streaming_auto").trim().toLowerCase();
  if (!clean) return "streaming_auto";
  if (clean.includes("manual")) return "manual";
  if (clean.includes("combo")) return "combo_auto";
  if (clean.includes("auto") || clean.includes("automatic")) return "streaming_auto";
  return ["streaming_auto", "manual", "combo_auto"].includes(clean) ? clean : "streaming_auto";
}

function getPlatformAccountPurchaseCost(account, fallbackCost = 0) {
  const rawPurchasePrice = account?.purchase_price;

  if (
    rawPurchasePrice !== null &&
    rawPurchasePrice !== undefined &&
    String(rawPurchasePrice).trim() !== ""
  ) {
    const purchasePrice = Number(rawPurchasePrice);
    if (Number.isFinite(purchasePrice)) return Math.max(0, purchasePrice);
  }

  const fallback = Number(fallbackCost);
  return Number.isFinite(fallback) ? Math.max(0, fallback) : 0;
}


async function resolveMotherAccount(client, {
  productName,
  accountEmail,
  ownerAdminId,
  purchaseDate = null,
  originalPurchaseDate = null,
  expirationDate = null,
  replacesMotherAccountId = null,
  forceCreateNew = false
}) {
  const cleanProduct = String(productName || "").trim() || "Sin producto";
  const cleanEmail = String(accountEmail || "").trim();
  const cleanOwnerId = Number(ownerAdminId || 0) || null;
  const replacementId = Number(replacesMotherAccountId || 0) || null;
  const suppliedOriginalDate = originalPurchaseDate || purchaseDate || null;

  // Evita crear dos cuentas madre para el mismo grupo durante cargas simultáneas.
  await client.query("LOCK TABLE mother_accounts IN SHARE ROW EXCLUSIVE MODE");

  if (replacementId) {
    const previousResult = await client.query(
      `SELECT * FROM mother_accounts WHERE id = $1 FOR UPDATE`,
      [replacementId]
    );
    const previous = previousResult.rows[0];

    if (!previous) {
      throw new Error(`La cuenta madre #${replacementId} indicada para reemplazo no existe.`);
    }

    if (Number(previous.owner_admin_id || 0) !== Number(cleanOwnerId || 0)) {
      throw new Error(`La cuenta madre #${replacementId} no pertenece a este propietario.`);
    }

    const existingReplacementResult = await client.query(
      `SELECT *
       FROM mother_accounts
       WHERE replaces_mother_account_id = $1
         AND status = 'active'
       ORDER BY id DESC
       LIMIT 1
       FOR UPDATE`,
      [replacementId]
    );

    const inheritedOriginalDate = previous.original_purchase_date || suppliedOriginalDate || null;
    const inheritedExpirationDate = previous.expiration_date || expirationDate || null;

    if (existingReplacementResult.rows[0]) {
      const existingReplacement = existingReplacementResult.rows[0];

      await client.query(
        `UPDATE mother_accounts
         SET status = 'replaced',
             replaced_by_mother_account_id = $1,
             updated_at = NOW()
         WHERE id = $2`,
        [existingReplacement.id, replacementId]
      );

      const refreshedReplacementResult = await client.query(
        `UPDATE mother_accounts
         SET original_purchase_date = COALESCE($2::date, original_purchase_date),
             expiration_date = COALESCE($3::date, expiration_date),
             status = 'active',
             updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [existingReplacement.id, inheritedOriginalDate, inheritedExpirationDate]
      );

      return refreshedReplacementResult.rows[0];
    }

    await client.query(
      `UPDATE mother_accounts
       SET status = 'replaced', updated_at = NOW()
       WHERE id = $1`,
      [replacementId]
    );

    const newMotherResult = await client.query(
      `INSERT INTO mother_accounts
       (product_name, account_email, owner_admin_id, original_purchase_date, expiration_date,
        replaces_mother_account_id, status, created_at, updated_at)
       VALUES (
         $1, $2, $3, $4,
         COALESCE($5::date, CASE WHEN $4::date IS NULL THEN NULL ELSE ($4::date + INTERVAL '30 days')::date END),
         $6, 'active', NOW(), NOW()
       )
       RETURNING *`,
      [cleanProduct, cleanEmail, cleanOwnerId, inheritedOriginalDate, inheritedExpirationDate, replacementId]
    );

    const newMother = newMotherResult.rows[0];
    await client.query(
      `UPDATE mother_accounts
       SET replaced_by_mother_account_id = $1, updated_at = NOW()
       WHERE id = $2`,
      [newMother.id, replacementId]
    );

    return newMother;
  }

  if (forceCreateNew) {
    const createdResult = await client.query(
      `INSERT INTO mother_accounts
       (product_name, account_email, owner_admin_id, original_purchase_date, expiration_date, status)
       VALUES (
         $1, $2, $3, $4,
         COALESCE($5::date, CASE WHEN $4::date IS NULL THEN NULL ELSE ($4::date + INTERVAL '30 days')::date END),
         'active'
       )
       RETURNING *`,
      [cleanProduct, cleanEmail, cleanOwnerId, suppliedOriginalDate, expirationDate]
    );

    return createdResult.rows[0];
  }

  const existingResult = await client.query(
    `SELECT *
     FROM mother_accounts
     WHERE status = 'active'
       AND lower(trim(product_name)) = lower(trim($1))
       AND lower(trim(account_email)) = lower(trim($2))
       AND COALESCE(owner_admin_id, 0) = COALESCE($3::int, 0)
       AND (
         ($4::date IS NULL AND original_purchase_date IS NULL)
         OR original_purchase_date = $4::date
       )
     ORDER BY created_at DESC, id DESC
     LIMIT 1
     FOR UPDATE`,
    [cleanProduct, cleanEmail, cleanOwnerId, suppliedOriginalDate]
  );

  if (existingResult.rows[0]) {
    const existing = existingResult.rows[0];
    const updatedResult = await client.query(
      `UPDATE mother_accounts
       SET original_purchase_date = COALESCE(original_purchase_date, $2::date),
           expiration_date = COALESCE(
             expiration_date,
             $3::date,
             CASE WHEN COALESCE(original_purchase_date, $2::date) IS NULL THEN NULL
                  ELSE (COALESCE(original_purchase_date, $2::date) + INTERVAL '30 days')::date END
           ),
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [existing.id, suppliedOriginalDate, expirationDate]
    );
    return updatedResult.rows[0];
  }

  const createdResult = await client.query(
    `INSERT INTO mother_accounts
     (product_name, account_email, owner_admin_id, original_purchase_date, expiration_date, status)
     VALUES (
       $1, $2, $3, $4,
       COALESCE($5::date, CASE WHEN $4::date IS NULL THEN NULL ELSE ($4::date + INTERVAL '30 days')::date END),
       'active'
     )
     RETURNING *`,
    [cleanProduct, cleanEmail, cleanOwnerId, suppliedOriginalDate, expirationDate]
  );

  return createdResult.rows[0];
}

async function getEffectiveProductPrice(client, user, product) {
  const fallbackPrice = Number(product.price || 0);

  if (!user) return fallbackPrice;

  if (user.role === "admin") {
    return fallbackPrice;
  }

  // Si este usuario es vendedor de un distribuidor, toma el precio final que su distribuidor definió.
  if (user.owner_user_id) {
    const resellerPriceResult = await client.query(
      `SELECT sale_price
       FROM subadmin_reseller_prices
       WHERE owner_user_id = $1 AND product_id = $2`,
      [user.owner_user_id, product.id]
    );

    if (resellerPriceResult.rows[0]) {
      return Number(resellerPriceResult.rows[0].sale_price || fallbackPrice);
    }

    // Si no tiene precio final, usa el costo/precio que ese distribuidor tiene contigo.
    const ownerPriceResult = await client.query(
      `SELECT sale_price
       FROM user_product_prices
       WHERE user_id = $1 AND product_id = $2`,
      [user.owner_user_id, product.id]
    );

    if (ownerPriceResult.rows[0]) {
      return Number(ownerPriceResult.rows[0].sale_price || fallbackPrice);
    }

    return fallbackPrice;
  }

  // Si es usuario normal o admin independiente, toma su precio especial si existe.
  const customPriceResult = await client.query(
    `SELECT sale_price
     FROM user_product_prices
     WHERE user_id = $1 AND product_id = $2`,
    [user.id, product.id]
  );

  if (customPriceResult.rows[0]) {
    return Number(customPriceResult.rows[0].sale_price || fallbackPrice);
  }

  return fallbackPrice;
}

async function initDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT,
      email TEXT UNIQUE,
      password TEXT,
      role TEXT DEFAULT 'user',
      balance NUMERIC DEFAULT 0
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
      name TEXT,
      description TEXT,
      price NUMERIC,
      category TEXT DEFAULT 'Otros',
      required_fields TEXT DEFAULT '[]',
      charge_mode TEXT DEFAULT 'on_purchase',
      active INTEGER DEFAULT 1,
      stock_enabled INTEGER DEFAULT 0,
      stock INTEGER DEFAULT 0
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      product_id INTEGER REFERENCES products(id),
      amount NUMERIC,
      order_data TEXT DEFAULT '{}',
      status TEXT DEFAULT 'accion_en_espera',
      admin_response TEXT DEFAULT '',
      charged INTEGER DEFAULT 0,
      refunded INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);


  await pool.query(`
    CREATE TABLE IF NOT EXISTS balance_requests (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      amount NUMERIC NOT NULL,
      bank TEXT DEFAULT '',
      reference TEXT DEFAULT '',
      account_holder TEXT DEFAULT '',
      proof TEXT DEFAULT '',
      status TEXT DEFAULT 'pendiente',
      admin_response TEXT DEFAULT '',
      created_at TIMESTAMP DEFAULT NOW(),
      reviewed_at TIMESTAMP,
      replacement_account_id INTEGER
    )
  `);


  await pool.query(`
    CREATE TABLE IF NOT EXISTS account_reports (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      email TEXT NOT NULL,
      issue_type TEXT DEFAULT 'otro',
      description TEXT NOT NULL,
      status TEXT DEFAULT 'pendiente',
      admin_response TEXT DEFAULT '',
      created_at TIMESTAMP DEFAULT NOW(),
      reviewed_at TIMESTAMP
    )
  `);


  await pool.query(`
    CREATE TABLE IF NOT EXISTS platform_accounts (
      id SERIAL PRIMARY KEY,
      platform VARCHAR(100) NOT NULL,
      product_name VARCHAR(150) NOT NULL,
      account_email VARCHAR(255) NOT NULL,
      account_password VARCHAR(255) NOT NULL,
      profile_name VARCHAR(100),
      profile_pin VARCHAR(50),
      extra_data TEXT,
      terms_conditions TEXT,
      access_url TEXT DEFAULT '',
      status VARCHAR(30) DEFAULT 'available',
      assigned_order_id INTEGER,
      assigned_user_id INTEGER,
      delivered_at TIMESTAMP,
      purchase_price NUMERIC,
      reusable INTEGER DEFAULT 0,
      official_purchase_date DATE,
      expires_at TIMESTAMP,
      mother_account_id INTEGER,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user'`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS balance NUMERIC DEFAULT 0`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_subadmin BOOLEAN DEFAULT FALSE`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS owner_user_id INTEGER`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_enabled BOOLEAN DEFAULT TRUE`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW()`);

  await pool.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS cost_price NUMERIC DEFAULT 0`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_product_prices (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
      sale_price NUMERIC NOT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(user_id, product_id)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS subadmin_reseller_prices (
      id SERIAL PRIMARY KEY,
      owner_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
      sale_price NUMERIC NOT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(owner_user_id, product_id)
    )
  `);

  // Asegura columnas necesarias aunque las tablas se hayan creado manualmente antes
  await pool.query(`ALTER TABLE user_product_prices ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW()`);
  await pool.query(`ALTER TABLE user_product_prices ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()`);
  await pool.query(`ALTER TABLE subadmin_reseller_prices ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW()`);
  await pool.query(`ALTER TABLE subadmin_reseller_prices ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()`);


  await pool.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS description TEXT`);
  await pool.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'Otros'`);
  await pool.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS required_fields TEXT DEFAULT '[]'`);
  await pool.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS charge_mode TEXT DEFAULT 'on_purchase'`);
  await pool.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS active INTEGER DEFAULT 1`);
  await pool.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS stock_enabled INTEGER DEFAULT 0`);
  await pool.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS stock INTEGER DEFAULT 0`);
  await pool.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS product_type TEXT DEFAULT 'streaming_auto'`);
  await pool.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS combo_items TEXT DEFAULT '[]'`);
  await pool.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS combo_discount NUMERIC DEFAULT 0`);
  await pool.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS owner_admin_id INTEGER`);

  await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_data TEXT DEFAULT '{}'`);
  await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'accion_en_espera'`);
  await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS admin_response TEXT DEFAULT ''`);
  await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS charged INTEGER DEFAULT 0`);
  await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS refunded INTEGER DEFAULT 0`);
  await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW()`);

  await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS assigned_platform_account_id INTEGER`);
  await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivered_account_data TEXT DEFAULT ''`);
  await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS product_name_snapshot TEXT DEFAULT ''`);
  await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS product_category_snapshot TEXT DEFAULT ''`);
  await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS product_cost_snapshot NUMERIC DEFAULT 0`);
  await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS distributor_cost_snapshot NUMERIC`);
  await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS owner_admin_id INTEGER`);

  await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 1`);
  await pool.query(`UPDATE orders SET quantity = 1 WHERE quantity IS NULL OR quantity < 1`);
  await pool.query(`
    UPDATE orders
    SET quantity = GREATEST(
      COALESCE(quantity, 1),
      COALESCE(NULLIF(substring(product_name_snapshot from '\\s+x([0-9]+)$'), '')::int, 1)
    )
    WHERE product_name_snapshot ~* '\\s+x[0-9]+$'
  `);


  await pool.query(`ALTER TABLE platform_accounts ADD COLUMN IF NOT EXISTS platform VARCHAR(100)`);
  await pool.query(`ALTER TABLE platform_accounts ADD COLUMN IF NOT EXISTS product_name VARCHAR(150)`);
  await pool.query(`ALTER TABLE platform_accounts ADD COLUMN IF NOT EXISTS account_email VARCHAR(255)`);
  await pool.query(`ALTER TABLE platform_accounts ADD COLUMN IF NOT EXISTS account_password VARCHAR(255)`);
  await pool.query(`ALTER TABLE platform_accounts ADD COLUMN IF NOT EXISTS profile_name VARCHAR(100)`);
  await pool.query(`ALTER TABLE platform_accounts ADD COLUMN IF NOT EXISTS profile_pin VARCHAR(50)`);
  await pool.query(`ALTER TABLE platform_accounts ADD COLUMN IF NOT EXISTS extra_data TEXT`);
  await pool.query(`ALTER TABLE platform_accounts ADD COLUMN IF NOT EXISTS terms_conditions TEXT`);
  await pool.query(`ALTER TABLE platform_accounts ADD COLUMN IF NOT EXISTS access_url TEXT DEFAULT ''`);
  await pool.query(`ALTER TABLE platform_accounts ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'available'`);
  await pool.query(`ALTER TABLE platform_accounts ADD COLUMN IF NOT EXISTS assigned_order_id INTEGER`);
  await pool.query(`ALTER TABLE platform_accounts ADD COLUMN IF NOT EXISTS assigned_user_id INTEGER`);
  await pool.query(`ALTER TABLE platform_accounts ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP`);
  await pool.query(`ALTER TABLE platform_accounts ADD COLUMN IF NOT EXISTS purchase_price NUMERIC`);
  await pool.query(`ALTER TABLE platform_accounts ADD COLUMN IF NOT EXISTS reusable INTEGER DEFAULT 0`);
  await pool.query(`ALTER TABLE platform_accounts ADD COLUMN IF NOT EXISTS official_purchase_date DATE`);
  await pool.query(`ALTER TABLE platform_accounts ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP`);
  await pool.query(`ALTER TABLE platform_accounts ADD COLUMN IF NOT EXISTS mother_account_id INTEGER`);
  await pool.query(`ALTER TABLE platform_accounts ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW()`);
  await pool.query(`ALTER TABLE platform_accounts ADD COLUMN IF NOT EXISTS owner_admin_id INTEGER`);
  await pool.query(`ALTER TABLE platform_accounts ADD COLUMN IF NOT EXISTS manual_replacement_source TEXT DEFAULT ''`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_platform_accounts_available ON platform_accounts (status, lower(product_name), lower(platform))`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_platform_accounts_mother_account ON platform_accounts (mother_account_id)`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS mother_accounts (
      id SERIAL PRIMARY KEY,
      product_name VARCHAR(150) NOT NULL DEFAULT '',
      account_email VARCHAR(255) NOT NULL DEFAULT '',
      owner_admin_id INTEGER,
      original_purchase_date DATE,
      expiration_date DATE,
      replaces_mother_account_id INTEGER REFERENCES mother_accounts(id),
      replaced_by_mother_account_id INTEGER REFERENCES mother_accounts(id),
      status VARCHAR(30) NOT NULL DEFAULT 'active',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await pool.query(`ALTER TABLE mother_accounts ADD COLUMN IF NOT EXISTS product_name VARCHAR(150) NOT NULL DEFAULT ''`);
  await pool.query(`ALTER TABLE mother_accounts ADD COLUMN IF NOT EXISTS account_email VARCHAR(255) NOT NULL DEFAULT ''`);
  await pool.query(`ALTER TABLE mother_accounts ADD COLUMN IF NOT EXISTS owner_admin_id INTEGER`);
  await pool.query(`ALTER TABLE mother_accounts ADD COLUMN IF NOT EXISTS original_purchase_date DATE`);
  await pool.query(`ALTER TABLE mother_accounts ADD COLUMN IF NOT EXISTS expiration_date DATE`);
  await pool.query(`ALTER TABLE mother_accounts ADD COLUMN IF NOT EXISTS replaces_mother_account_id INTEGER`);
  await pool.query(`ALTER TABLE mother_accounts ADD COLUMN IF NOT EXISTS replaced_by_mother_account_id INTEGER`);
  await pool.query(`ALTER TABLE mother_accounts ADD COLUMN IF NOT EXISTS status VARCHAR(30) NOT NULL DEFAULT 'active'`);
  await pool.query(`ALTER TABLE mother_accounts ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW()`);
  await pool.query(`ALTER TABLE mother_accounts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_mother_accounts_group ON mother_accounts (lower(product_name), lower(account_email), COALESCE(owner_admin_id, 0), status)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_mother_accounts_replaces ON mother_accounts (replaces_mother_account_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_mother_accounts_expiration ON mother_accounts (status, expiration_date)`);

  // Vincula inventario histórico sin cuenta madre respetando cada ciclo por fecha oficial.
  await pool.query(`
    INSERT INTO mother_accounts
      (product_name, account_email, owner_admin_id, original_purchase_date, expiration_date, status)
    SELECT groups.product_name, groups.account_email, groups.owner_admin_id,
           groups.original_purchase_date,
           CASE WHEN groups.original_purchase_date IS NULL THEN NULL
                ELSE (groups.original_purchase_date + INTERVAL '30 days')::date END,
           'active'
    FROM (
      SELECT
        COALESCE(NULLIF(TRIM(product_name), ''), NULLIF(TRIM(platform), ''), 'Sin producto') AS product_name,
        COALESCE(TRIM(account_email), '') AS account_email,
        owner_admin_id,
        official_purchase_date AS original_purchase_date
      FROM platform_accounts
      WHERE mother_account_id IS NULL
      GROUP BY 1, 2, 3, 4
    ) groups
    WHERE NOT EXISTS (
      SELECT 1
      FROM mother_accounts ma
      WHERE lower(trim(ma.product_name)) = lower(trim(groups.product_name))
        AND lower(trim(ma.account_email)) = lower(trim(groups.account_email))
        AND COALESCE(ma.owner_admin_id, 0) = COALESCE(groups.owner_admin_id, 0)
        AND ma.original_purchase_date IS NOT DISTINCT FROM groups.original_purchase_date
    )
  `);

  await pool.query(`
    WITH legacy_matches AS (
      SELECT
        pa.id AS platform_account_id,
        (
          SELECT ma.id
          FROM mother_accounts ma
          WHERE lower(trim(ma.product_name)) = lower(trim(COALESCE(NULLIF(pa.product_name, ''), NULLIF(pa.platform, ''), 'Sin producto')))
            AND lower(trim(ma.account_email)) = lower(trim(COALESCE(pa.account_email, '')))
            AND COALESCE(ma.owner_admin_id, 0) = COALESCE(pa.owner_admin_id, 0)
            AND ma.original_purchase_date IS NOT DISTINCT FROM pa.official_purchase_date
          ORDER BY ma.created_at DESC, ma.id DESC
          LIMIT 1
        ) AS mother_account_id
      FROM platform_accounts pa
      WHERE pa.mother_account_id IS NULL
    )
    UPDATE platform_accounts pa
    SET mother_account_id = legacy_matches.mother_account_id
    FROM legacy_matches
    WHERE pa.id = legacy_matches.platform_account_id
      AND legacy_matches.mother_account_id IS NOT NULL
  `);


  await pool.query(`ALTER TABLE balance_requests ADD COLUMN IF NOT EXISTS bank TEXT DEFAULT ''`);
  await pool.query(`ALTER TABLE balance_requests ADD COLUMN IF NOT EXISTS reference TEXT DEFAULT ''`);
  await pool.query(`ALTER TABLE balance_requests ADD COLUMN IF NOT EXISTS account_holder TEXT DEFAULT ''`);
  await pool.query(`ALTER TABLE balance_requests ADD COLUMN IF NOT EXISTS proof TEXT DEFAULT ''`);
  await pool.query(`ALTER TABLE balance_requests ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pendiente'`);
  await pool.query(`ALTER TABLE balance_requests ADD COLUMN IF NOT EXISTS admin_response TEXT DEFAULT ''`);
  await pool.query(`ALTER TABLE balance_requests ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW()`);
  await pool.query(`ALTER TABLE balance_requests ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP`);
  await pool.query(`ALTER TABLE balance_requests ADD COLUMN IF NOT EXISTS owner_admin_id INTEGER`);

  await pool.query(`ALTER TABLE account_reports ADD COLUMN IF NOT EXISTS email TEXT DEFAULT ''`);
  await pool.query(`ALTER TABLE account_reports ADD COLUMN IF NOT EXISTS issue_type TEXT DEFAULT 'otro'`);
  await pool.query(`ALTER TABLE account_reports ADD COLUMN IF NOT EXISTS description TEXT DEFAULT ''`);
  await pool.query(`ALTER TABLE account_reports ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pendiente'`);
  await pool.query(`ALTER TABLE account_reports ADD COLUMN IF NOT EXISTS admin_response TEXT DEFAULT ''`);
  await pool.query(`ALTER TABLE account_reports ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW()`);
  await pool.query(`ALTER TABLE account_reports ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP`);
  await pool.query(`ALTER TABLE account_reports ADD COLUMN IF NOT EXISTS order_id INTEGER`);
  await pool.query(`ALTER TABLE account_reports ADD COLUMN IF NOT EXISTS reported_account_id INTEGER`);
  await pool.query(`ALTER TABLE account_reports ADD COLUMN IF NOT EXISTS replacement_account_id INTEGER`);
  await pool.query(`ALTER TABLE account_reports ADD COLUMN IF NOT EXISTS refund_amount NUMERIC DEFAULT 0`);
  await pool.query(`ALTER TABLE account_reports ADD COLUMN IF NOT EXISTS resolution_type TEXT DEFAULT ''`);

  await pool.query(`ALTER TABLE account_reports ADD COLUMN IF NOT EXISTS reported_platform TEXT DEFAULT ''`);
  await pool.query(`ALTER TABLE account_reports ADD COLUMN IF NOT EXISTS owner_admin_id INTEGER`);

  // Ganancias del distribuidor: cuenta separada del saldo comprado.
  // Cada movimiento conserva su origen para evitar créditos/retiros duplicados.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS distributor_earnings_ledger (
      id SERIAL PRIMARY KEY,
      distributor_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      seller_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
      report_id INTEGER REFERENCES account_reports(id) ON DELETE SET NULL,
      movement_type TEXT NOT NULL,
      amount NUMERIC NOT NULL DEFAULT 0,
      sale_amount NUMERIC DEFAULT 0,
      distributor_cost NUMERIC DEFAULT 0,
      refund_amount NUMERIC DEFAULT 0,
      reference_key TEXT UNIQUE,
      note TEXT DEFAULT '',
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await pool.query(`ALTER TABLE distributor_earnings_ledger ADD COLUMN IF NOT EXISTS seller_id INTEGER`);
  await pool.query(`ALTER TABLE distributor_earnings_ledger ADD COLUMN IF NOT EXISTS order_id INTEGER`);
  await pool.query(`ALTER TABLE distributor_earnings_ledger ADD COLUMN IF NOT EXISTS report_id INTEGER`);
  await pool.query(`ALTER TABLE distributor_earnings_ledger ADD COLUMN IF NOT EXISTS movement_type TEXT DEFAULT 'ajuste'`);
  await pool.query(`ALTER TABLE distributor_earnings_ledger ADD COLUMN IF NOT EXISTS amount NUMERIC DEFAULT 0`);
  await pool.query(`ALTER TABLE distributor_earnings_ledger ADD COLUMN IF NOT EXISTS sale_amount NUMERIC DEFAULT 0`);
  await pool.query(`ALTER TABLE distributor_earnings_ledger ADD COLUMN IF NOT EXISTS distributor_cost NUMERIC DEFAULT 0`);
  await pool.query(`ALTER TABLE distributor_earnings_ledger ADD COLUMN IF NOT EXISTS refund_amount NUMERIC DEFAULT 0`);
  await pool.query(`ALTER TABLE distributor_earnings_ledger ADD COLUMN IF NOT EXISTS reference_key TEXT`);
  await pool.query(`ALTER TABLE distributor_earnings_ledger ADD COLUMN IF NOT EXISTS note TEXT DEFAULT ''`);
  await pool.query(`ALTER TABLE distributor_earnings_ledger ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW()`);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS distributor_earnings_reference_key_uq ON distributor_earnings_ledger(reference_key)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS distributor_earnings_distributor_date_idx ON distributor_earnings_ledger(distributor_id, created_at DESC, id DESC)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS distributor_earnings_order_idx ON distributor_earnings_ledger(order_id)`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS distributor_earnings_state (
      distributor_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      initialized_at TIMESTAMP,
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await pool.query(`ALTER TABLE distributor_earnings_state ADD COLUMN IF NOT EXISTS initialized_at TIMESTAMP`);
  await pool.query(`ALTER TABLE distributor_earnings_state ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()`);

  await pool.query(`ALTER TABLE account_reports ADD COLUMN IF NOT EXISTS owner_admin_id INTEGER`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS admin_panels (
      id SERIAL PRIMARY KEY,
      business_name TEXT DEFAULT '',
      admin_name TEXT DEFAULT '',
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      phone TEXT DEFAULT '',
      bank_name TEXT DEFAULT '',
      bank_holder TEXT DEFAULT '',
      bank_clabe TEXT DEFAULT '',
      payment_concept TEXT DEFAULT '',
      notification_email TEXT DEFAULT '',
      status TEXT DEFAULT 'activo',
      plan_type TEXT DEFAULT 'renta',
      expires_at DATE,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await pool.query(`ALTER TABLE admin_panels ADD COLUMN IF NOT EXISTS slug TEXT`);
  await pool.query(`ALTER TABLE admin_panels ADD COLUMN IF NOT EXISTS owner_user_id INTEGER`);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_panels_slug_unique ON admin_panels (lower(slug)) WHERE slug IS NOT NULL AND slug <> ''`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS panel_invites (
      id SERIAL PRIMARY KEY, token TEXT UNIQUE NOT NULL, plan_type TEXT DEFAULT 'renta',
      expires_at DATE, invite_expires_at TIMESTAMP DEFAULT (NOW() + INTERVAL '7 days'),
      status TEXT DEFAULT 'activo', created_at TIMESTAMP DEFAULT NOW(), used_at TIMESTAMP
    )
  `);
  await pool.query(`UPDATE admin_panels ap SET owner_user_id = u.id FROM users u WHERE ap.owner_user_id IS NULL AND lower(u.email) = lower(ap.email) AND ($1 = '' OR lower(u.email) <> $1)`, [MAIN_ADMIN_EMAIL]);
  // Si una versión anterior asoció por error al administrador principal con un panel,
  // deshacemos únicamente esa asociación; no eliminamos el panel ni al usuario.
  if (MAIN_ADMIN_EMAIL) {
    await pool.query(`UPDATE admin_panels SET owner_user_id = NULL WHERE owner_user_id IN (SELECT id FROM users WHERE lower(email)=lower($1))`, [MAIN_ADMIN_EMAIL]);
  }


  await pool.query(`UPDATE users SET role = 'user' WHERE role IS NULL`);
  await pool.query(`UPDATE users SET balance = 0 WHERE balance IS NULL`);
  await pool.query(`UPDATE users SET is_subadmin = FALSE WHERE is_subadmin IS NULL`);
  await pool.query(`UPDATE users SET is_enabled = TRUE WHERE is_enabled IS NULL`);

  // Los paneles creados/rentados son "Panel propietario", no "Admin distribuidor".
  // Por eso, si existe un usuario cuyo correo está en admin_panels, se limpia is_subadmin.
  await pool.query(`
    UPDATE users u
    SET is_subadmin = FALSE
    FROM admin_panels ap
    WHERE ap.owner_user_id = u.id
  `);

  await pool.query(`UPDATE products SET cost_price = 0 WHERE cost_price IS NULL`);
  await pool.query(`UPDATE products SET active = 1 WHERE active IS NULL`);
  await pool.query(`UPDATE products SET category = 'Otros' WHERE category IS NULL`);
  await pool.query(`UPDATE products SET required_fields = '[]' WHERE required_fields IS NULL`);
  await pool.query(`UPDATE products SET charge_mode = 'on_purchase' WHERE charge_mode IS NULL`);
  await pool.query(`UPDATE products SET stock_enabled = 0 WHERE stock_enabled IS NULL`);
  await pool.query(`UPDATE products SET stock = 0 WHERE stock IS NULL`);
  await pool.query(`UPDATE products SET product_type = 'streaming_auto' WHERE product_type IS NULL OR product_type = ''`);
  await pool.query(`UPDATE products SET product_type = 'manual' WHERE lower(trim(product_type)) LIKE '%manual%'`);
  await pool.query(`UPDATE products SET product_type = 'combo_auto' WHERE lower(trim(product_type)) LIKE '%combo%'`);
  await pool.query(`UPDATE products SET product_type = 'streaming_auto' WHERE lower(trim(product_type)) LIKE '%auto%' AND lower(trim(product_type)) <> 'combo_auto'`);
  await pool.query(`UPDATE products SET combo_items = '[]' WHERE combo_items IS NULL OR combo_items = ''`);
  await pool.query(`UPDATE products SET combo_discount = 0 WHERE combo_discount IS NULL`);
  await pool.query(`UPDATE orders SET order_data = '{}' WHERE order_data IS NULL`);
  await pool.query(`UPDATE orders SET status = 'accion_en_espera' WHERE status IS NULL`);
  await pool.query(`UPDATE orders SET admin_response = '' WHERE admin_response IS NULL`);
  await pool.query(`UPDATE orders SET charged = 0 WHERE charged IS NULL`);
  await pool.query(`UPDATE orders SET refunded = 0 WHERE refunded IS NULL`);

  await pool.query(`UPDATE orders SET delivered_account_data = '' WHERE delivered_account_data IS NULL`);
  await pool.query(`UPDATE orders SET product_name_snapshot = '' WHERE product_name_snapshot IS NULL`);
  await pool.query(`UPDATE orders SET product_category_snapshot = '' WHERE product_category_snapshot IS NULL`);
  await pool.query(`UPDATE orders SET product_cost_snapshot = 0 WHERE product_cost_snapshot IS NULL`);
  await pool.query(`UPDATE platform_accounts SET access_url = '' WHERE access_url IS NULL`);
  await pool.query(`UPDATE platform_accounts SET status = 'available' WHERE status IS NULL OR status = ''`);

  await pool.query(`UPDATE balance_requests SET bank = '' WHERE bank IS NULL`);
  await pool.query(`UPDATE balance_requests SET reference = '' WHERE reference IS NULL`);
  await pool.query(`UPDATE balance_requests SET account_holder = '' WHERE account_holder IS NULL`);
  await pool.query(`UPDATE balance_requests SET proof = '' WHERE proof IS NULL`);
  await pool.query(`UPDATE balance_requests SET status = 'pendiente' WHERE status IS NULL`);
  await pool.query(`UPDATE balance_requests SET admin_response = '' WHERE admin_response IS NULL`);

  await pool.query(`UPDATE account_reports SET email = '' WHERE email IS NULL`);
  await pool.query(`UPDATE account_reports SET issue_type = 'otro' WHERE issue_type IS NULL`);
  await pool.query(`UPDATE account_reports SET description = '' WHERE description IS NULL`);
  await pool.query(`UPDATE account_reports SET status = 'pendiente' WHERE status IS NULL`);
  await pool.query(`UPDATE account_reports SET admin_response = '' WHERE admin_response IS NULL`);
  await pool.query(`UPDATE account_reports SET refund_amount = 0 WHERE refund_amount IS NULL`);
  await pool.query(`UPDATE account_reports SET resolution_type = '' WHERE resolution_type IS NULL`);
}

function getDateOnlyParts(value) {
  if (!value) return null;

  if (typeof value === "string") {
    const clean = value.trim();
    const match = clean.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|T00:00:00(?:\.000)?Z?$)/);
    if (match) {
      return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
    }
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    // Los DATE/TIMESTAMP a medianoche que vienen de PostgreSQL representan una
    // fecha de servicio, no un instante que deba desplazarse por zona horaria.
    if (
      value.getUTCHours() === 0 &&
      value.getUTCMinutes() === 0 &&
      value.getUTCSeconds() === 0 &&
      value.getUTCMilliseconds() === 0
    ) {
      return {
        year: value.getUTCFullYear(),
        month: value.getUTCMonth() + 1,
        day: value.getUTCDate()
      };
    }
  }

  return null;
}

function dateOnlyToSafeDate(value) {
  const parts = getDateOnlyParts(value);
  if (!parts) return null;
  // Mediodía UTC evita que America/Mexico_City retroceda al día anterior.
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 12, 0, 0));
}

function normalizeServiceDate(value, fallbackValue = null) {
  const safeDateOnly = dateOnlyToSafeDate(value);
  if (safeDateOnly) return safeDateOnly;

  const parsed = value ? new Date(value) : null;
  if (parsed && !Number.isNaN(parsed.getTime())) return parsed;

  const safeFallbackDateOnly = dateOnlyToSafeDate(fallbackValue);
  if (safeFallbackDateOnly) return safeFallbackDateOnly;

  const fallback = fallbackValue ? new Date(fallbackValue) : null;
  if (fallback && !Number.isNaN(fallback.getTime())) return fallback;
  return new Date();
}

function formatFechaMX(fecha) {
  const parts = getDateOnlyParts(fecha);
  if (parts) {
    return `${String(parts.day).padStart(2, "0")}/${String(parts.month).padStart(2, "0")}/${String(parts.year).slice(-2)}`;
  }

  const parsed = fecha instanceof Date ? fecha : new Date(fecha);
  if (Number.isNaN(parsed.getTime())) return "";

  return parsed.toLocaleDateString("es-MX", {
    timeZone: "America/Mexico_City",
    day: "2-digit",
    month: "2-digit",
    year: "2-digit"
  });
}

function isPdfOrCourseProduct(productName = "", productCategory = "", productType = "", assignedAccount = null) {
  const combined = `${String(productName || "")} ${String(productCategory || "")} ${String(productType || "")}`.toLowerCase();
  const hasPdfOrCourseWord = /(pdf|curso|ebook|manual|guia|guía)/i.test(combined);
  const accountUrl = String(assignedAccount?.access_url || "").toLowerCase();
  const hasPdfUrl = accountUrl.includes('.pdf');
  return hasPdfOrCourseWord || hasPdfUrl;
}

async function addTraceEvent(client, {
    accountId,
    eventType,
    userId = null,
    orderId = null,
    reportId = null,
    description = "",
    metadata = {}
}) {

    await client.query(
        `INSERT INTO account_traceability
        (
            platform_account_id,
            event_type,
            user_id,
            order_id,
            report_id,
            description,
            metadata
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [
            accountId,
            eventType,
            userId,
            orderId,
            reportId,
            description,
            JSON.stringify(metadata)
        ]
    );

}




// AÑADIMOS EL PARÁMETRO "originalDate = null"
function buildDeliveredAccountData(assignedAccount, productName = "", productCategory = "", originalDate = null, productType = "") {
  // Si nos mandan una fecha vieja (reemplazo), usamos esa. Si no (venta nueva), usamos la de hoy.
  const fechaEntrega = originalDate ? normalizeServiceDate(originalDate) : new Date();

  const fechaVencimiento = new Date(fechaEntrega);
  fechaVencimiento.setUTCDate(fechaVencimiento.getUTCDate() + 28);

  const isDigitalClean = isPdfOrCourseProduct(productName, productCategory, productType, assignedAccount);

  if (isDigitalClean) {
    const cleanLines = [
      "📄 Entrega Digital Inmediata",
      "",
      `📌 Producto: ${String(productName || assignedAccount.platform || productCategory || "").toUpperCase()}`,
      `📅 Fecha de entrega: ${formatFechaMX(fechaEntrega)}`
    ];

    if (assignedAccount.access_url) {
      cleanLines.push(`🔗 Enlace de acceso/descarga: ${assignedAccount.access_url}`);
    }

    return cleanLines.join("\n");
  }

  const lines = [
    "🎬 Cuenta de Streaming Entregada",
    "",
    `📌 Plataforma: ${String(assignedAccount.platform || productCategory || productName || "").toUpperCase()}`,
    `📧 Correo: ${assignedAccount.account_email || ""}`,
    `🔐 Contraseña: ${assignedAccount.account_password || ""}`,
    `👤 Perfil: ${assignedAccount.profile_name || "No aplica"}`,
    `🔢 PIN de acceso: ${assignedAccount.profile_pin || "No aplica"}`,
    `📅 Fecha de entrega: ${formatFechaMX(fechaEntrega)}`,
    `📅 Fecha de vencimiento: ${formatFechaMX(fechaVencimiento)}`
  ];

  if (assignedAccount.access_url) {
    lines.push(`🔗 URL para código/soporte: ${assignedAccount.access_url}`);
  }

  lines.push(
    "",
    "📌 Normas de uso:",
    "✅ No editar datos de acceso",
    "✅ No cambiar el nombre ni el código del perfil",
    "✅ Uso exclusivo en un solo equipo",
    "✅ No compartir el acceso con otros",
    "",
    "Evita incumplir estas reglas para mantener el servicio activo sin inconvenientes."
  );

  return lines.join("\n");
}
async function findReportedPurchase(client, userId, accountEmail) {
  const result = await client.query(
    `SELECT
       o.id AS order_id,
       o.user_id,
       o.amount,
       o.created_at AS order_created_at,
       o.refunded,
       o.assigned_platform_account_id,
       p.id AS product_id,
       p.name AS product_name,
       p.category AS product_category,
       p.product_type,
       pa.id AS account_id,
       pa.platform,
       pa.product_name AS account_product_name,
       pa.account_email,
       pa.status AS account_status,
       pa.owner_admin_id
     FROM platform_accounts pa
     JOIN orders o ON o.id = pa.assigned_order_id
     JOIN products p ON p.id = o.product_id
     WHERE pa.assigned_user_id = $1
       AND o.user_id = $1
       AND lower(pa.account_email) = lower($2)
       AND o.status = 'exito'
       AND pa.status = 'delivered'
       AND NOT EXISTS (
         SELECT 1
         FROM account_reports replaced_report
         WHERE replaced_report.user_id = $1
           AND replaced_report.order_id = o.id
           AND replaced_report.reported_account_id = pa.id
           AND NULLIF(replaced_report.replacement_account_id, 0) IS NOT NULL
       )
       AND (
         lower(COALESCE(p.product_type, '')) LIKE '%combo%'
         OR pa.id = o.assigned_platform_account_id
         OR EXISTS (
           SELECT 1
           FROM account_reports replacement_report
           WHERE replacement_report.user_id = $1
             AND replacement_report.order_id = o.id
             AND replacement_report.replacement_account_id = pa.id
         )
         OR pa.id = (
           SELECT current_pa.id
           FROM platform_accounts current_pa
           WHERE current_pa.assigned_order_id = o.id
             AND current_pa.assigned_user_id = $1
             AND current_pa.status = 'delivered'
             AND NOT EXISTS (
               SELECT 1
               FROM account_reports previous_report
               WHERE previous_report.user_id = $1
                 AND previous_report.order_id = o.id
                 AND previous_report.reported_account_id = current_pa.id
                 AND NULLIF(previous_report.replacement_account_id, 0) IS NOT NULL
             )
           ORDER BY current_pa.delivered_at DESC NULLS LAST, current_pa.id DESC
           LIMIT 1
         )
       )
     ORDER BY
       CASE WHEN pa.id = o.assigned_platform_account_id THEN 0 ELSE 1 END,
       pa.delivered_at DESC NULLS LAST,
       o.id DESC,
       pa.id DESC
     LIMIT 1`,
    [userId, String(accountEmail || "").trim()]
  );

  return result.rows[0] || null;
}



async function getComboItems(client, comboItemsValue) {
  const ids = safeJsonArray(comboItemsValue)
    .map(v => Number(v))
    .filter(v => Number.isInteger(v) && v > 0);

  if (!ids.length) return [];

  const result = await client.query(
    `SELECT p.id, p.name, p.description, p.price, p.cost_price, p.category, p.required_fields, p.charge_mode, p.active, p.stock_enabled,
            ${effectiveStockExpression("p")} AS stock,
            ${reusableStockFlagExpression("p")} AS reusable_stock,
            p.product_type, p.combo_items, p.combo_discount, p.owner_admin_id
     FROM products p
     WHERE p.id = ANY($1::int[]) AND p.active = 1`,
    [ids]
  );

  const byId = new Map(result.rows.map(row => [Number(row.id), row]));
  return ids.map(id => byId.get(id)).filter(Boolean);
}

async function calculateComboPrice(client, user, comboProduct) {
  const items = await getComboItems(client, comboProduct.combo_items);
  const discount = Math.max(0, Number(comboProduct.combo_discount || 0));
  let total = 0;

  for (const item of items) {
    total += await getEffectiveProductPrice(client, user, item);
  }

  return Math.max(0, Number((total - (discount * items.length)).toFixed(2)));
}


async function getDistributorCostSnapshot(client, buyerUser, product) {
  const distributorId = Number(buyerUser?.owner_user_id || 0);
  if (!distributorId) return null;

  const distributor = await getFullUser(distributorId, client);
  if (!distributor || distributor.is_subadmin !== true) return null;

  const rawCost = normalizeProductType(product?.product_type) === 'combo_auto'
    ? await calculateComboPrice(client, distributor, product)
    : await getEffectiveProductPrice(client, distributor, product);

  const numericCost = Number(rawCost);
  return Number.isFinite(numericCost) ? Math.max(0, Number(numericCost.toFixed(2))) : null;
}

function roundMoney(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? Math.round((number + Number.EPSILON) * 100) / 100 : 0;
}

async function getDistributorEarningOrderBase(client, orderId) {
  const result = await client.query(
    `SELECT
       o.id, o.user_id, o.product_id, o.amount, o.status, o.refunded, o.created_at,
       o.distributor_cost_snapshot, o.product_name_snapshot, o.product_category_snapshot, o.owner_admin_id,
       seller.owner_user_id AS distributor_id, seller.name AS seller_name, seller.email AS seller_email,
       COALESCE(distributor.is_subadmin, false) AS distributor_is_subadmin,
       p.name, p.category, p.price, p.cost_price, p.product_type, p.combo_items, p.combo_discount, p.owner_admin_id AS product_owner_admin_id
     FROM orders o
     JOIN users seller ON seller.id = o.user_id
     LEFT JOIN users distributor ON distributor.id = seller.owner_user_id
     JOIN products p ON p.id = o.product_id
     WHERE o.id = $1
     LIMIT 1`,
    [orderId]
  );

  const row = result.rows[0];
  if (!row || !Number(row.distributor_id || 0) || row.distributor_is_subadmin !== true) return null;
  return row;
}

async function resolveDistributorOrderCost(client, row) {
  let distributorCost = row?.distributor_cost_snapshot === null || row?.distributor_cost_snapshot === undefined
    ? null
    : Number(row.distributor_cost_snapshot);
  let source = 'snapshot';

  if (!Number.isFinite(distributorCost)) {
    const distributor = await getFullUser(Number(row.distributor_id || 0), client);
    if (!distributor) return { cost: 0, source: 'sin_distribuidor' };
    const rawCost = normalizeProductType(row.product_type) === 'combo_auto'
      ? await calculateComboPrice(client, distributor, row)
      : await getEffectiveProductPrice(client, distributor, row);
    distributorCost = Number(rawCost);
    source = 'precio_actual';
  }

  return {
    cost: Math.max(0, roundMoney(distributorCost)),
    source
  };
}

async function ensureDistributorSaleEarningForOrder(client, orderId) {
  const row = await getDistributorEarningOrderBase(client, orderId);
  if (!row || String(row.status || '').toLowerCase() !== 'exito') return null;

  const { cost, source } = await resolveDistributorOrderCost(client, row);
  const saleAmount = Math.max(0, roundMoney(row.amount));
  const profit = roundMoney(saleAmount - cost);
  const referenceKey = `sale:${Number(row.id)}`;
  const productName = String(row.product_name_snapshot || row.name || 'Producto').trim();

  const inserted = await client.query(
    `INSERT INTO distributor_earnings_ledger
       (distributor_id, seller_id, order_id, movement_type, amount, sale_amount, distributor_cost, refund_amount, reference_key, note, created_at)
     VALUES ($1, $2, $3, 'venta', $4, $5, $6, 0, $7, $8, COALESCE($9, NOW()))
     ON CONFLICT (reference_key) DO NOTHING
     RETURNING *`,
    [
      Number(row.distributor_id),
      Number(row.user_id),
      Number(row.id),
      profit,
      saleAmount,
      cost,
      referenceKey,
      `Ganancia pedido #${Number(row.id)} · ${productName} · costo ${source}`,
      row.created_at || null
    ]
  );

  if (inserted.rows[0]) return inserted.rows[0];

  const existing = await client.query(
    `SELECT * FROM distributor_earnings_ledger WHERE reference_key = $1 LIMIT 1`,
    [referenceKey]
  );
  return existing.rows[0] || null;
}

async function recordDistributorRefundEarningAdjustment(client, {
  orderId,
  refundAmount,
  reportId = null,
  referenceKey = '',
  note = ''
}) {
  const saleMovement = await ensureDistributorSaleEarningForOrder(client, orderId);
  if (!saleMovement) return null;

  const saleAmount = Math.max(0, roundMoney(saleMovement.sale_amount));
  if (saleAmount <= 0) return null;

  const refund = Math.max(0, roundMoney(refundAmount));
  if (refund <= 0) return null;

  const ratio = Math.max(0, Math.min(1, refund / saleAmount));
  const originalProfit = roundMoney(saleMovement.amount);
  const adjustmentAmount = roundMoney(-(originalProfit * ratio));
  const effectiveReference = String(referenceKey || (reportId ? `refund-report:${Number(reportId)}` : `refund-order:${Number(orderId)}`));

  // Serializa reembolsos y transferencias del mismo distribuidor. Si ya transfirió
  // las ganancias, el ajuste puede dejar la cuenta de ganancias en negativo sin tocar
  // el saldo que compró con su propio dinero.
  await client.query(`SELECT id FROM users WHERE id = $1 FOR UPDATE`, [Number(saleMovement.distributor_id)]);

  const inserted = await client.query(
    `INSERT INTO distributor_earnings_ledger
       (distributor_id, seller_id, order_id, report_id, movement_type, amount, sale_amount, distributor_cost, refund_amount, reference_key, note, created_at)
     VALUES ($1, $2, $3, $4, 'ajuste_reembolso', $5, $6, $7, $8, $9, $10, NOW())
     ON CONFLICT (reference_key) DO NOTHING
     RETURNING *`,
    [
      Number(saleMovement.distributor_id),
      Number(saleMovement.seller_id || 0) || null,
      Number(orderId),
      reportId ? Number(reportId) : null,
      adjustmentAmount,
      saleAmount,
      roundMoney(saleMovement.distributor_cost),
      refund,
      effectiveReference,
      note || `Ajuste proporcional por reembolso de $${refund.toFixed(2)} en pedido #${Number(orderId)}`
    ]
  );

  if (inserted.rows[0]) {
    return {
      ...inserted.rows[0],
      adjustment_amount: adjustmentAmount,
      original_profit: originalProfit,
      refund_ratio: Number((ratio * 100).toFixed(2))
    };
  }

  const existing = await client.query(
    `SELECT * FROM distributor_earnings_ledger WHERE reference_key = $1 LIMIT 1`,
    [effectiveReference]
  );
  const row = existing.rows[0];
  return row ? {
    ...row,
    adjustment_amount: roundMoney(row.amount),
    original_profit: originalProfit,
    refund_ratio: Number((ratio * 100).toFixed(2))
  } : null;
}

async function ensureDistributorEarningsInitialized(client, distributorId) {
  const id = Number(distributorId || 0);
  if (!id) return;

  const state = await client.query(
    `SELECT distributor_id, initialized_at FROM distributor_earnings_state WHERE distributor_id = $1 LIMIT 1`,
    [id]
  );
  if (state.rows[0]?.initialized_at) return;

  const distributor = await getFullUser(id, client);
  if (!distributor || distributor.is_subadmin !== true) return;

  // La mayoría de pedidos modernos ya tiene distributor_cost_snapshot; esos se
  // migran de forma masiva para que el primer acceso no sea lento aun con miles de ventas.
  await client.query(
    `INSERT INTO distributor_earnings_ledger
       (distributor_id, seller_id, order_id, movement_type, amount, sale_amount, distributor_cost, refund_amount, reference_key, note, created_at)
     SELECT
       $1, o.user_id, o.id, 'venta',
       ROUND((COALESCE(o.amount, 0) - COALESCE(o.distributor_cost_snapshot, 0))::numeric, 2),
       ROUND(COALESCE(o.amount, 0)::numeric, 2),
       ROUND(COALESCE(o.distributor_cost_snapshot, 0)::numeric, 2),
       0,
       'sale:' || o.id::text,
       'Ganancia histórica pedido #' || o.id::text || ' · costo snapshot',
       o.created_at
     FROM orders o
     JOIN users seller ON seller.id = o.user_id
     WHERE seller.owner_user_id = $1
       AND o.status = 'exito'
       AND o.distributor_cost_snapshot IS NOT NULL
     ON CONFLICT (reference_key) DO NOTHING`,
    [id]
  );

  const legacyOrders = await client.query(
    `SELECT o.id
     FROM orders o
     JOIN users seller ON seller.id = o.user_id
     WHERE seller.owner_user_id = $1
       AND o.status = 'exito'
       AND o.distributor_cost_snapshot IS NULL
     ORDER BY o.id ASC`,
    [id]
  );

  for (const order of legacyOrders.rows) {
    await ensureDistributorSaleEarningForOrder(client, order.id);
  }

  const refundedReports = await client.query(
    `SELECT ar.id, ar.order_id, ar.refund_amount
     FROM account_reports ar
     JOIN orders o ON o.id = ar.order_id
     JOIN users seller ON seller.id = o.user_id
     WHERE seller.owner_user_id = $1
       AND COALESCE(ar.refund_amount, 0) > 0
       AND lower(COALESCE(ar.resolution_type, '')) = 'reembolso'
     ORDER BY ar.id ASC`,
    [id]
  );

  for (const report of refundedReports.rows) {
    await recordDistributorRefundEarningAdjustment(client, {
      orderId: report.order_id,
      reportId: report.id,
      refundAmount: report.refund_amount,
      referenceKey: `refund-report:${Number(report.id)}`,
      note: `Ajuste histórico por reembolso del reporte #${Number(report.id)}`
    });
  }

  const refundedWithoutReport = await client.query(
    `SELECT o.id, o.amount
     FROM orders o
     JOIN users seller ON seller.id = o.user_id
     WHERE seller.owner_user_id = $1
       AND COALESCE(o.refunded, 0) = 1
       AND NOT EXISTS (
         SELECT 1 FROM account_reports ar
         WHERE ar.order_id = o.id
           AND COALESCE(ar.refund_amount, 0) > 0
           AND lower(COALESCE(ar.resolution_type, '')) = 'reembolso'
       )
     ORDER BY o.id ASC`,
    [id]
  );

  for (const order of refundedWithoutReport.rows) {
    await recordDistributorRefundEarningAdjustment(client, {
      orderId: order.id,
      refundAmount: order.amount,
      referenceKey: `refund-order:${Number(order.id)}`,
      note: `Ajuste histórico por reembolso completo del pedido #${Number(order.id)}`
    });
  }

  await client.query(
    `INSERT INTO distributor_earnings_state (distributor_id, initialized_at, updated_at)
     VALUES ($1, NOW(), NOW())
     ON CONFLICT (distributor_id) DO UPDATE
     SET initialized_at = COALESCE(distributor_earnings_state.initialized_at, EXCLUDED.initialized_at),
         updated_at = NOW()`,
    [id]
  );
}

async function getDistributorEarningsWallet(client, distributorId, movementLimit = 60) {
  const id = Number(distributorId || 0);
  await ensureDistributorEarningsInitialized(client, id);

  const [summaryResult, userResult, movementsResult] = await Promise.all([
    client.query(
      `SELECT
         COALESCE(SUM(amount), 0) AS available,
         COALESCE(SUM(CASE WHEN movement_type = 'venta' THEN amount ELSE 0 END), 0) AS earned_from_sales,
         COALESCE(SUM(CASE WHEN movement_type = 'ajuste_reembolso' THEN amount ELSE 0 END), 0) AS refund_adjustments,
         COALESCE(SUM(CASE WHEN movement_type = 'transferencia_saldo' THEN -amount ELSE 0 END), 0) AS transferred_to_balance
       FROM distributor_earnings_ledger
       WHERE distributor_id = $1`,
      [id]
    ),
    client.query(`SELECT balance FROM users WHERE id = $1 LIMIT 1`, [id]),
    client.query(
      `SELECT
         l.id, l.movement_type, l.amount, l.sale_amount, l.distributor_cost, l.refund_amount,
         l.order_id, l.report_id, l.note, l.created_at,
         seller.name AS seller_name, seller.email AS seller_email,
         COALESCE(NULLIF(o.product_name_snapshot, ''), p.name, 'Producto') AS product_name,
         to_char(((l.created_at AT TIME ZONE 'UTC') AT TIME ZONE 'America/Mexico_City'), 'DD/MM/YYYY HH24:MI:SS') AS created_at_mx
       FROM distributor_earnings_ledger l
       LEFT JOIN users seller ON seller.id = l.seller_id
       LEFT JOIN orders o ON o.id = l.order_id
       LEFT JOIN products p ON p.id = o.product_id
       WHERE l.distributor_id = $1
       ORDER BY l.created_at DESC, l.id DESC
       LIMIT $2`,
      [id, Math.max(1, Math.min(200, Number(movementLimit || 60)))]
    )
  ]);

  const summary = summaryResult.rows[0] || {};
  return {
    available: roundMoney(summary.available),
    earned_from_sales: roundMoney(summary.earned_from_sales),
    refund_adjustments: roundMoney(summary.refund_adjustments),
    transferred_to_balance: roundMoney(summary.transferred_to_balance),
    purchase_balance: roundMoney(userResult.rows[0]?.balance || 0),
    movements: movementsResult.rows.map(row => ({
      ...row,
      amount: roundMoney(row.amount),
      sale_amount: roundMoney(row.sale_amount),
      distributor_cost: roundMoney(row.distributor_cost),
      refund_amount: roundMoney(row.refund_amount)
    }))
  };
}

function buildComboDeliveredAccountData(accounts) {
  const fechaEntrega = new Date();
  const fechaVencimiento = new Date(fechaEntrega);
  fechaVencimiento.setUTCDate(fechaVencimiento.getUTCDate() + 28);

  const blocks = accounts.map(account => [
    `📌 Plataforma: ${String(account.platform || account.product_name || '').toUpperCase()}`,
    `📧 Correo: ${account.account_email || ''}`,
    `🔐 Contraseña: ${account.account_password || ''}`,
    `👤 Perfil: ${account.profile_name || 'No aplica'}`,
    `🔢 PIN de acceso: ${account.profile_pin || 'No aplica'}`,
    `📅 Fecha de entrega: ${formatFechaMX(fechaEntrega)}`,
    `📅 Fecha de vencimiento: ${formatFechaMX(fechaVencimiento)}`
  ].join("\n"));

  return [
    "🎬 Combo Streaming Entregado",
    "",
    blocks.join("\n\n━━━━━━━━━━━━━━\n\n")
  ].join("\n");
}

function getValidDeliveryDate(value, fallbackValue = null) {
  return normalizeServiceDate(value, fallbackValue);
}

function getValidExpirationDate(value, deliveryDate) {
  if (value) return normalizeServiceDate(value, deliveryDate);
  const calculated = new Date(deliveryDate);
  calculated.setUTCDate(calculated.getUTCDate() + 28);
  return calculated;
}

function buildCurrentAccountDeliveryBlock(account, fallbackDeliveryDate = null) {
  const originalPurchaseDate = getValidDeliveryDate(
    account?.official_purchase_date,
    fallbackDeliveryDate || account?.delivered_at
  );
  const expirationDate = getValidExpirationDate(account?.expires_at, originalPurchaseDate);
  const lines = [
    `📌 Plataforma: ${String(account?.platform || account?.product_name || '').toUpperCase()}`,
    `🆔 Cuenta entregada: ${Number(account?.id || 0) || ''}`,
    `📧 Correo: ${account?.account_email || ''}`,
    `🔐 Contraseña: ${account?.account_password || ''}`,
    `👤 Perfil: ${account?.profile_name || 'No aplica'}`,
    `🔢 PIN de acceso: ${account?.profile_pin || 'No aplica'}`,
    `📅 Fecha original de compra: ${formatFechaMX(originalPurchaseDate)}`,
    `📅 Fecha de vencimiento: ${formatFechaMX(expirationDate)}`
  ];

  if (account?.access_url) lines.push(`🔗 URL para código/soporte: ${account.access_url}`);
  if (account?.extra_data) lines.push(`📝 Datos adicionales: ${account.extra_data}`);
  return lines.join("\n");
}

function buildCurrentOrderDeliveredAccountData(order, accounts) {
  const currentAccounts = (Array.isArray(accounts) ? accounts : []).filter(account => Number(account?.id || 0) > 0);
  if (!currentAccounts.length) return '';

  const isCombo = normalizeProductType(order?.product_type) === 'combo_auto' || currentAccounts.length > 1;
  if (isCombo) {
    return [
      '🎬 Combo Streaming Entregado',
      '',
      currentAccounts
        .map(account => buildCurrentAccountDeliveryBlock(account, order?.created_at))
        .join("\n\n━━━━━━━━━━━━━━\n\n")
    ].join("\n");
  }

  const account = currentAccounts[0];
  return [
    '🎬 Cuenta de Streaming Entregada',
    '',
    buildCurrentAccountDeliveryBlock(account, order?.created_at),
    '',
    '📌 Normas de uso:',
    '✅ No editar datos de acceso',
    '✅ No cambiar el nombre ni el código del perfil',
    '✅ Uso exclusivo en un solo equipo',
    '✅ No compartir el acceso con otros',
    '',
    'Evita incumplir estas reglas para mantener el servicio activo sin inconvenientes.'
  ].join("\n");
}

async function getCurrentOrderDeliveryState(client, orderId) {
  const orderResult = await client.query(
    `SELECT o.id, o.user_id, o.created_at, o.product_id,
            COALESCE(NULLIF(o.product_name_snapshot, ''), p.name, '') AS product_name,
            COALESCE(NULLIF(o.product_category_snapshot, ''), p.category, '') AS product_category,
            p.product_type
     FROM orders o
     LEFT JOIN products p ON p.id = o.product_id
     WHERE o.id = $1
     LIMIT 1`,
    [orderId]
  );
  const order = orderResult.rows[0] || null;
  if (!order) return { order: null, accounts: [], deliveredAccountData: '' };

  const accountsResult = await client.query(
    `SELECT id, platform, product_name, account_email, account_password,
            profile_name, profile_pin, access_url, extra_data, status,
            assigned_order_id, assigned_user_id, delivered_at, expires_at,
            official_purchase_date, mother_account_id
     FROM platform_accounts
     WHERE assigned_order_id = $1
       AND assigned_user_id = $2
       AND status = 'delivered'
     ORDER BY id ASC`,
    [orderId, order.user_id]
  );

  return {
    order,
    accounts: accountsResult.rows,
    deliveredAccountData: buildCurrentOrderDeliveredAccountData(order, accountsResult.rows)
  };
}

async function findAvailableAccountForProduct(client, product, userId) {
  const productName = String(product.name || '').trim();
  const productCategory = String(product.category || '').trim();
  const ownerId = product.owner_admin_id || null;
  // El modo reutilizable depende únicamente de la configuración del producto.
  // Así un perfil Netflix/HBO con stock limitado nunca se vuelve ilimitado por nombre o datos históricos.
  const reusableProduct = Number(product.reusable_stock || 0) === 1;

  const statusCondition = reusableProduct
    ? `lower(COALESCE(status, 'available')) IN ('available', 'disponible', 'delivered')`
    : `status IN ('available', 'disponible')`;

  const result = await client.query(
    `SELECT *
     FROM platform_accounts
     WHERE ${statusCondition}
       AND (
         ($3::int IS NULL AND (owner_admin_id IS NULL OR owner_admin_id = 0))
         OR ($3::int IS NOT NULL AND owner_admin_id = $3)
       )
       AND (
         lower(COALESCE(product_name, '')) = lower($1)
         OR lower(COALESCE(platform, '')) = lower($1)
         OR lower(COALESCE(platform, '')) = lower($2)
       )
     ORDER BY CASE WHEN COALESCE(reusable, 0) = 1 THEN 0 ELSE 1 END, id ASC
     LIMIT 1
     FOR UPDATE SKIP LOCKED`,
    [productName, productCategory, ownerId]
  );

  return result.rows[0] || null;
}

// REGISTRO
app.get("/api/tenant-context", async (req, res) => {
  try {
    const panel = await getTenantPanelFromRequest(req);
    if (!panel) return res.json({ is_tenant: false, base_domain: PANEL_BASE_DOMAIN });
    if (String(panel.status || "activo").toLowerCase() !== "activo") return res.status(403).json({ error: "Este panel se encuentra suspendido o inactivo." });
    res.json({ is_tenant: true, business_name: panel.business_name || "", slug: panel.slug || "", status: panel.status || "activo", panel_url: panel.slug ? buildPanelUrl(panel.slug) : "" });
  } catch (err) {
    console.error("Error cargando contexto del panel:", err.message);
    res.status(500).json({ error: "Error cargando el contexto del panel" });
  }
});

app.get("/api/panel-invite/:token", async (req, res) => {
  try {
    const token = String(req.params.token || "").trim();
    const result = await pool.query(`SELECT id, plan_type, expires_at, status, invite_expires_at FROM panel_invites WHERE token = $1 LIMIT 1`, [token]);
    const invite = result.rows[0];
    if (!invite || invite.status !== "activo" || new Date(invite.invite_expires_at) < new Date()) return res.status(404).json({ error: "El enlace de registro no existe, ya fue utilizado o expiró." });
    res.json({ valid: true, plan_type: invite.plan_type || "renta", expires_at: invite.expires_at || null });
  } catch (err) { res.status(500).json({ error: "Error validando invitación" }); }
});

app.post("/api/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const cleanName = String(name || "").trim();
    const cleanEmail = String(email || "").trim().toLowerCase();
    if (!cleanName || !cleanEmail || !password) return res.status(400).json({ error: "Faltan datos" });
    const tenantPanel = await getTenantPanelFromRequest(req);
    if (isTenantHost(req) && !tenantPanel) {
      return res.status(404).json({ error: "Este subdominio no corresponde a un panel registrado." });
    }
    const hashedPassword = await bcrypt.hash(password, 10);

    if (tenantPanel) {
      const ownerId = Number(tenantPanel.owner_user_id || 0);
      if (!ownerId) return res.status(500).json({ error: "Este panel todavía no tiene propietario configurado." });
      if (String(tenantPanel.status || "activo").toLowerCase() !== "activo") return res.status(403).json({ error: "Este panel se encuentra suspendido o inactivo." });
      const existing = await pool.query(`SELECT id FROM users WHERE lower(email) = lower($1)`, [cleanEmail]);
      if (existing.rows.length) return res.status(400).json({ error: "Este correo ya tiene una cuenta. Inicia sesión con el panel al que pertenece." });
      const result = await pool.query(`INSERT INTO users (name,email,password,role,balance,is_subadmin,owner_user_id,is_enabled) VALUES ($1,$2,$3,'user',0,false,$4,true) RETURNING id,name,email,role,balance,owner_user_id`, [cleanName,cleanEmail,hashedPassword,ownerId]);
      const token = generateToken(result.rows[0]);
      return res.json({ token, message: "Cuenta creada y vinculada al panel correctamente" });
    }

    const result = await pool.query(`INSERT INTO users (name,email,password,role,balance) VALUES ($1,$2,$3,'user',0) RETURNING id,name,email,role,balance`, [cleanName,cleanEmail,hashedPassword]);
    res.json({ token: generateToken(result.rows[0]), message: "Usuario registrado con éxito" });
  } catch (err) {
    console.error(err.message);
    res.status(400).json({ error: "El usuario ya existe o los datos son inválidos" });
  }
});

app.post("/api/panel-register/:token", async (req, res) => {
  const client = await pool.connect();
  try {
    const token = String(req.params.token || "").trim();
    const b=req.body||{};
    const business=String(b.business_name||"").trim(), adminName=String(b.admin_name||"").trim(), email=String(b.email||"").trim().toLowerCase(), password=String(b.password||"");
    if (!token || !business || !adminName || !email || password.length < 6) return res.status(400).json({ error: "Completa nombre del negocio, nombre del administrador, correo y una contraseña de mínimo 6 caracteres." });
    await client.query("BEGIN");
    const invR=await client.query(`SELECT * FROM panel_invites WHERE token=$1 FOR UPDATE`,[token]);
    const inv=invR.rows[0];
    if(!inv || inv.status!=="activo" || new Date(inv.invite_expires_at)<new Date()){ await client.query("ROLLBACK"); return res.status(404).json({error:"El enlace de registro no existe, ya fue utilizado o expiró."}); }
    const ex=await client.query(`SELECT id FROM users WHERE lower(email)=lower($1)`,[email]);
    if(ex.rows.length){ await client.query("ROLLBACK"); return res.status(400).json({error:"Este correo ya está registrado en el sistema."}); }
    let base=slugifyBusinessName(business)||`panel-${Date.now()}`, slug=base, n=2;
    while((await client.query(`SELECT id FROM admin_panels WHERE lower(slug)=lower($1) LIMIT 1`,[slug])).rows.length){ slug=`${base}-${n++}`; }
    const hash=await bcrypt.hash(password,10);
    const panelR=await client.query(`INSERT INTO admin_panels (business_name,admin_name,email,password,phone,bank_name,bank_holder,bank_clabe,payment_concept,notification_email,status,plan_type,expires_at,slug) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'activo',$11,$12,$13) RETURNING id,business_name,admin_name,email,phone,status,plan_type,expires_at,slug`,[business,adminName,email,hash,String(b.phone||"").trim(),String(b.bank_name||"").trim(),String(b.bank_holder||"").trim(),String(b.bank_clabe||"").trim(),String(b.payment_concept||"").trim(),String(b.notification_email||email).trim(),String(inv.plan_type||"renta"),inv.expires_at||null,slug]);
    const ownerR=await client.query(`INSERT INTO users (name,email,password,role,balance,is_subadmin,owner_user_id,is_enabled) VALUES ($1,$2,$3,'admin',0,false,NULL,true) RETURNING id,name,email,role,balance`,[adminName,email,hash]);
    await client.query(`UPDATE admin_panels SET owner_user_id=$1,updated_at=NOW() WHERE id=$2`,[ownerR.rows[0].id,panelR.rows[0].id]);
    await client.query(`UPDATE panel_invites SET status='usado',used_at=NOW() WHERE id=$1`,[inv.id]);
    await client.query("COMMIT");
    res.json({message:"Panel creado correctamente",token:generateToken(ownerR.rows[0]),panel:{...panelR.rows[0],owner_user_id:ownerR.rows[0].id,panel_url:buildPanelUrl(slug)}});
  } catch(err){ try{await client.query("ROLLBACK")}catch(_){} console.error("Error en registro de panel:",err.message); res.status(500).json({error:"No fue posible crear el panel. Revisa los datos e inténtalo nuevamente."}); }
  finally{client.release();}
});

// LOGIN
app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const cleanEmail=String(email||"").trim().toLowerCase();
    const tenantPanel=await getTenantPanelFromRequest(req);
    if (isTenantHost(req) && !tenantPanel) return res.status(404).json({error:"Este subdominio no corresponde a un panel registrado."});
    let result;
    if(tenantPanel){
      const ownerId=Number(tenantPanel.owner_user_id||0);
      if(!ownerId) return res.status(503).json({error:"Este panel todavía no tiene propietario configurado."});
      if(String(tenantPanel.status||"activo").toLowerCase()!=="activo") return res.status(403).json({error:"Panel suspendido o inactivo"});
      result=await pool.query(`SELECT * FROM users WHERE lower(regexp_replace(trim(email), '\\s+', '', 'g'))=lower(regexp_replace($1, '\\s+', '', 'g')) AND (id=$2 OR owner_user_id=$2) ORDER BY id DESC LIMIT 1`,[cleanEmail,ownerId]);
    }else{
      result=await pool.query(`SELECT * FROM users WHERE lower(regexp_replace(trim(email), '\\s+', '', 'g'))=lower(regexp_replace($1, '\\s+', '', 'g')) ORDER BY id DESC LIMIT 1`,[cleanEmail]);
    }
    let user=result.rows[0];
    if(!user && !tenantPanel){
      const panel=await getAdminPanelForEmail(cleanEmail);
      if(!panel) return res.status(404).json({error:"Usuario no encontrado"});
      if(String(panel.status||"activo").toLowerCase()!=="activo") return res.status(403).json({error:"Panel suspendido o inactivo"});
      const panelPass=await pool.query(`SELECT password FROM admin_panels WHERE id=$1`,[panel.id]);
      if(!await bcrypt.compare(password||"",panelPass.rows[0]?.password||"")) return res.status(401).json({error:"Contraseña incorrecta"});
      const created=await pool.query(`INSERT INTO users (name,email,password,role,balance,is_subadmin) VALUES ($1,$2,$3,'admin',0,false) RETURNING *`,[panel.admin_name||panel.business_name||cleanEmail,cleanEmail,panelPass.rows[0].password]);
      user=created.rows[0];
      await pool.query(`UPDATE admin_panels SET owner_user_id=$1,updated_at=NOW() WHERE id=$2 AND owner_user_id IS NULL`,[user.id,panel.id]);
    }
    if(!user) return res.status(404).json({error:"Usuario no encontrado en este panel"});
    if(tenantPanel && Number(user.id)!==Number(tenantPanel.owner_user_id||0) && Number(user.owner_user_id||0)!==Number(tenantPanel.owner_user_id||0)) return res.status(403).json({error:"Esta cuenta no pertenece a este panel."});
    const panel = await getAdminPanelForUserId(user.id);
    if(panel && String(panel.status||"activo").toLowerCase()!=="activo") return res.status(403).json({error:"Panel suspendido o inactivo"});
    if(user.is_enabled===false) return res.status(403).json({error:"Tu acceso está deshabilitado. Contacta al administrador de tu panel."});
    if(!await bcrypt.compare(password||"",user.password)) return res.status(401).json({error:"Contraseña incorrecta"});
    res.json({token:generateToken(user)});
  }catch(err){console.error(err.message);res.status(500).json({error:"Error iniciando sesión"});}
});

// MI CUENTA
app.get("/api/me", authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.name, u.email, u.role, u.balance,
              COALESCE(u.is_subadmin, false) AS is_subadmin,
              u.owner_user_id,
              ap.id AS admin_panel_id,
              ap.business_name AS admin_panel_business_name,
              ap.status AS admin_panel_status,
              CASE WHEN ap.id IS NULL THEN false ELSE true END AS is_panel_admin,
              CASE
                WHEN lower(u.email) = lower($2) AND u.role = 'admin' THEN 'admin_global'
                WHEN ap.id IS NOT NULL THEN 'panel_propietario'
                WHEN COALESCE(u.is_subadmin, false) = true THEN 'admin_distribuidor'
                WHEN u.role = 'admin' THEN 'admin_global'
                ELSE 'usuario'
              END AS account_type,
              CASE
                WHEN lower(u.email) = lower($2) AND u.role = 'admin' THEN 'Admin principal'
                WHEN ap.id IS NOT NULL THEN 'Panel propietario'
                WHEN COALESCE(u.is_subadmin, false) = true THEN 'Admin distribuidor'
                WHEN u.role = 'admin' THEN 'Admin global'
                ELSE 'Usuario'
              END AS role_label
       FROM users u
       LEFT JOIN admin_panels ap ON ap.owner_user_id = u.id
       WHERE u.id = $1`,
      [req.user.id, MAIN_ADMIN_EMAIL]
    );

    const user = result.rows[0];

    if (!user) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    if (user.is_panel_admin && String(user.admin_panel_status || "activo").toLowerCase() !== "activo") {
      return res.status(403).json({ error: "Panel suspendido o inactivo" });
    }

    res.json(user);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Error cargando usuario" });
  }
});

// PRODUCTOS ACTIVOS
app.get("/api/products", authMiddleware, async (req, res) => {
  try {
    const viewer = await getViewerContext(req.user.id);
    const owner = adminOwnedWhere(viewer, "p");

    const result = await pool.query(
      `SELECT p.id, p.name, p.description, p.price, p.cost_price, p.category, p.required_fields, p.charge_mode, p.active, p.stock_enabled,
              ${effectiveStockExpression("p")} AS stock,
              ${reusableStockFlagExpression("p")} AS reusable_stock,
              p.product_type, p.combo_items, p.combo_discount, p.owner_admin_id
       FROM products p
       WHERE p.active = 1 AND ${owner.clause}
       ORDER BY p.category ASC, p.name ASC`,
      owner.params
    );

    const products = [];
    const productIds = result.rows.map(p => Number(p.id)).filter(n => Number.isInteger(n) && n > 0);
    const customPriceMap = new Map();
    const ownerPriceMap = new Map();
    const resellerPriceMap = new Map();

    if (viewer.role !== "admin" && productIds.length) {
      if (viewer.owner_user_id) {
        const resellerPrices = await pool.query(
          `SELECT product_id, sale_price
           FROM subadmin_reseller_prices
           WHERE owner_user_id = $1
             AND product_id = ANY($2::int[])`,
          [viewer.owner_user_id, productIds]
        );
        resellerPrices.rows.forEach(row => {
          resellerPriceMap.set(Number(row.product_id), Number(row.sale_price || 0));
        });

        const ownerPrices = await pool.query(
          `SELECT product_id, sale_price
           FROM user_product_prices
           WHERE user_id = $1
             AND product_id = ANY($2::int[])`,
          [viewer.owner_user_id, productIds]
        );
        ownerPrices.rows.forEach(row => {
          ownerPriceMap.set(Number(row.product_id), Number(row.sale_price || 0));
        });
      } else {
        const customPrices = await pool.query(
          `SELECT product_id, sale_price
           FROM user_product_prices
           WHERE user_id = $1
             AND product_id = ANY($2::int[])`,
          [viewer.id, productIds]
        );
        customPrices.rows.forEach(row => {
          customPriceMap.set(Number(row.product_id), Number(row.sale_price || 0));
        });
      }
    }

    for (const product of result.rows) {
      const effectivePrice = String(product.product_type || '').toLowerCase() === 'combo_auto'
        ? await calculateComboPrice(pool, viewer, product)
        : (() => {
            if (viewer.role === "admin") {
              return Number(product.price || 0);
            }
            if (viewer.owner_user_id) {
              const pid = Number(product.id);
              if (resellerPriceMap.has(pid)) return resellerPriceMap.get(pid);
              if (ownerPriceMap.has(pid)) return ownerPriceMap.get(pid);
              return Number(product.price || 0);
            }
            const pid = Number(product.id);
            if (customPriceMap.has(pid)) return customPriceMap.get(pid);
            return Number(product.price || 0);
          })();
      const normalizedType = normalizeProductType(product.product_type);
      const unlimitedStock = normalizedType !== 'combo_auto' && Number(product.reusable_stock || 0) === 1;
      const stockMode = normalizedType === 'combo_auto'
        ? 'combo'
        : unlimitedStock
          ? 'unlimited'
          : 'finite';

      const cleanProduct = {
        ...product,
        product_type: normalizedType,
        stock_enabled: stockMode === 'finite' ? 1 : 0,
        unlimited_stock: unlimitedStock ? 1 : 0,
        stock_mode: stockMode,
        base_price: product.price,
        price: effectivePrice
      };

      if (viewer.role !== "admin") {
        delete cleanProduct.cost_price;
      }

      products.push(cleanProduct);
    }

    res.json(products);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Error cargando productos" });
  }
});

// ADMIN: LISTAR PRODUCTOS VISIBLES Y OCULTOS DEL PROPIETARIO ACTUAL
app.get("/api/admin/products", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const ownerAdminId = req.isPanelAdmin ? req.user.id : null;

    const result = await pool.query(
      `SELECT p.id, p.name, p.description, p.price, p.cost_price, p.category,
              p.required_fields, p.charge_mode, p.active, p.stock_enabled,
              ${effectiveStockExpression("p")} AS stock,
              ${reusableStockFlagExpression("p")} AS reusable_stock,
              p.product_type, p.combo_items, p.combo_discount, p.owner_admin_id
       FROM products p
       WHERE (
         ($1::int IS NULL AND (p.owner_admin_id IS NULL OR p.owner_admin_id = 0))
         OR ($1::int IS NOT NULL AND p.owner_admin_id = $1)
       )
       ORDER BY p.active DESC, p.category ASC, p.name ASC, p.id DESC`,
      [ownerAdminId]
    );

    res.json(result.rows.map(product => {
      const normalizedType = normalizeProductType(product.product_type);
      const unlimitedStock = normalizedType !== 'combo_auto' && Number(product.reusable_stock || 0) === 1;
      const stockMode = normalizedType === 'combo_auto'
        ? 'combo'
        : unlimitedStock
          ? 'unlimited'
          : 'finite';

      return {
        ...product,
        product_type: normalizedType,
        stock_enabled: stockMode === 'finite' ? 1 : 0,
        unlimited_stock: unlimitedStock ? 1 : 0,
        stock_mode: stockMode
      };
    }));
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Error cargando productos del administrador" });
  }
});

// ADMIN: CREAR PRODUCTO
app.post("/api/admin/create-product", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { name, description, price, cost_price, category, required_fields, charge_mode, stock_enabled, stock, product_type, combo_items, combo_discount } = req.body;

    if (!name || !price) {
      return res.status(400).json({ error: "Nombre y precio son obligatorios" });
    }

    const priceNumber = Number(price);

    if (priceNumber <= 0) {
      return res.status(400).json({ error: "El precio debe ser mayor a 0" });
    }

    const validChargeModes = ["on_purchase", "on_success"];
    const finalChargeMode = validChargeModes.includes(charge_mode) ? charge_mode : "on_purchase";

    const cleanFields = safeJsonArray(required_fields)
      .map(field => normalizeFieldName(field))
      .filter(field => field.length > 0);

    const normalizedType = normalizeProductType(product_type);
    const normalizedStock = Math.max(0, Number(stock || 0));
    const normalizedStockEnabled = normalizedType === 'combo_auto'
      ? 1
      : ((stock_enabled === true || stock_enabled === 1 || stock_enabled === '1' || stock_enabled === 'true') ? 1 : 0);

    await pool.query(
      `INSERT INTO products
       (name, description, price, cost_price, category, required_fields, charge_mode, active, stock_enabled, stock, product_type, combo_items, combo_discount, owner_admin_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 1, $8, $9, $10, $11, $12, $13)`,
      [
        name.trim(),
        description || "",
        priceNumber,
        Math.max(0, Number(cost_price || 0)),
        category || "Otros",
        JSON.stringify([...new Set(cleanFields)]),
        finalChargeMode,
        normalizedStockEnabled,
        normalizedStock,
        normalizedType,
        JSON.stringify(safeJsonArray(combo_items).map(Number).filter(n => Number.isInteger(n) && n > 0)),
        Math.max(0, Number(combo_discount || 0)),
        req.isPanelAdmin ? req.user.id : null
      ]
    );

    res.json({ message: "Producto creado correctamente" });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Error creando producto" });
  }
});

// ADMIN: MODIFICAR PRODUCTO
app.patch("/api/admin/products/:productId", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const productId = req.params.productId;
    const { name, description, price, cost_price, category, required_fields, charge_mode, stock_enabled, stock, product_type, combo_items, combo_discount } = req.body;

    if (!name || !price) {
      return res.status(400).json({ error: "Nombre y precio son obligatorios" });
    }

    const priceNumber = Number(price);

    if (priceNumber <= 0) {
      return res.status(400).json({ error: "El precio debe ser mayor a 0" });
    }

    const validChargeModes = ["on_purchase", "on_success"];
    const finalChargeMode = validChargeModes.includes(charge_mode) ? charge_mode : "on_purchase";

    const cleanFields = safeJsonArray(required_fields)
      .map(field => normalizeFieldName(field))
      .filter(field => field.length > 0);

    const normalizedType = normalizeProductType(product_type);
    const normalizedStock = Math.max(0, Number(stock || 0));
    const normalizedStockEnabled = normalizedType === 'combo_auto'
      ? 1
      : ((stock_enabled === true || stock_enabled === 1 || stock_enabled === '1' || stock_enabled === 'true') ? 1 : 0);

    const result = await pool.query(
      `UPDATE products
       SET name = $1,
           description = $2,
           price = $3,
           cost_price = $4,
           category = $5,
           required_fields = $6,
           charge_mode = $7,
           stock_enabled = $8,
           stock = $9,
           product_type = $10,
           combo_items = $11,
           combo_discount = $12
       WHERE id = $13
         AND (
           ($14::int IS NULL AND (owner_admin_id IS NULL OR owner_admin_id = 0))
           OR ($14::int IS NOT NULL AND owner_admin_id = $14)
         )`,
      [
        name.trim(),
        description || "",
        priceNumber,
        Math.max(0, Number(cost_price || 0)),
        category || "Otros",
        JSON.stringify([...new Set(cleanFields)]),
        finalChargeMode,
        normalizedStockEnabled,
        normalizedStock,
        normalizedType,
        JSON.stringify(safeJsonArray(combo_items).map(Number).filter(n => Number.isInteger(n) && n > 0)),
        Math.max(0, Number(combo_discount || 0)),
        productId,
        req.isPanelAdmin ? req.user.id : null
      ]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Producto no encontrado" });
    }

    res.json({ message: "Producto actualizado correctamente" });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Error modificando producto" });
  }
});

// ADMIN: CAMBIAR VISIBILIDAD DEL PRODUCTO DE FORMA REVERSIBLE
app.patch("/api/admin/products/:productId/visibility", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const productId = Number(req.params.productId || 0);
    const rawActive = req.body?.active;
    const active = (rawActive === true || rawActive === 1 || rawActive === "1")
      ? 1
      : (rawActive === false || rawActive === 0 || rawActive === "0")
        ? 0
        : null;

    if (!productId || active === null) {
      return res.status(400).json({ error: "Producto y visibilidad válida son obligatorios" });
    }

    const ownerAdminId = req.isPanelAdmin ? req.user.id : null;
    const result = await pool.query(
      `UPDATE products
       SET active = $1
       WHERE id = $2
         AND (
           ($3::int IS NULL AND (owner_admin_id IS NULL OR owner_admin_id = 0))
           OR ($3::int IS NOT NULL AND owner_admin_id = $3)
         )
       RETURNING id, active`,
      [active, productId, ownerAdminId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Producto no encontrado para este panel" });
    }

    res.json({
      message: active === 1 ? "Producto mostrado nuevamente en la tienda" : "Producto ocultado de la tienda",
      product_id: Number(result.rows[0].id),
      active: Number(result.rows[0].active)
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Error cambiando la visibilidad del producto" });
  }
});

// Compatibilidad con el botón anterior: DELETE ahora solo oculta, nunca borra.
app.delete("/api/admin/products/:productId", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const productId = Number(req.params.productId || 0);
    const ownerAdminId = req.isPanelAdmin ? req.user.id : null;

    const result = await pool.query(
      `UPDATE products
       SET active = 0
       WHERE id = $1
         AND active = 1
         AND (
           ($2::int IS NULL AND (owner_admin_id IS NULL OR owner_admin_id = 0))
           OR ($2::int IS NOT NULL AND owner_admin_id = $2)
         )
       RETURNING id`,
      [productId, ownerAdminId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Producto no encontrado o ya está oculto" });
    }

    res.json({ message: "Producto ocultado de la tienda" });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Error ocultando producto" });
  }
});

// COMPRAR PRODUCTO
app.post("/api/buy/:productId", authMiddleware, async (req, res) => {
  const client = await pool.connect();

  try {
    const productId = req.params.productId;
    const userId = req.user.id;
    const orderData = safeJsonObject(req.body.order_data);

    await client.query("BEGIN");
    console.log("--- INICIO DE COMPRA ---");
    console.log("Producto ID:", productId, "Usuario ID:", userId);

    const viewerContext = await getViewerContext(userId, client);
    const ownerFilter = adminOwnedWhere(viewerContext, "p");
    const productResult = await client.query(
      `SELECT p.*,
              ${effectiveStockExpression("p")} AS stock,
              ${reusableStockFlagExpression("p")} AS reusable_stock
       FROM products p
       WHERE p.id = $1 AND p.active = 1 AND ${ownerFilter.clause}
       FOR UPDATE`,
      [productId, ...ownerFilter.params]
    );

    const product = productResult.rows[0];

    if (!product) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Producto no encontrado" });
    }

    const productType = normalizeProductType(product.product_type);
    const reusableStock = productType !== 'combo_auto' && Number(product.reusable_stock || 0) === 1;
    const enforceStock = productType !== 'combo_auto' && !reusableStock;

    if (enforceStock && Number(product.stock || 0) <= 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Producto agotado. No hay stock disponible." });
    }

    const requiredFields = safeJsonArray(product.required_fields);

    for (const field of requiredFields) {
      const value = orderData[field];

      if (!value || String(value).trim() === "") {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: `Debes ingresar: ${field}` });
      }
    }

    const userResult = await client.query(
      `SELECT id, name, email, role, balance, COALESCE(is_subadmin, false) AS is_subadmin, owner_user_id FROM users WHERE id = $1 FOR UPDATE`,
      [userId]
    );

    const user = userResult.rows[0];

    if (!user) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    const isComboProduct = productType === 'combo_auto';
    const price = isComboProduct
      ? await calculateComboPrice(client, user, product)
      : await getEffectiveProductPrice(client, user, product);
    const distributorCostSnapshot = await getDistributorCostSnapshot(client, user, product);
    const balance = Number(user.balance);
    const chargeMode = product.charge_mode || "on_purchase";

    if (chargeMode === "on_purchase" && balance < price) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        error: `Saldo insuficiente. Tu saldo es $${balance.toFixed(2)} y el producto cuesta $${price.toFixed(2)}`
      });
    }

    if (isComboProduct) {
      const comboItems = await getComboItems(client, product.combo_items);

      if (!comboItems.length) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: "Este combo no tiene productos incluidos." });
      }

      const assignedAccounts = [];

      for (const item of comboItems) {
        const account = await findAvailableAccountForProduct(client, item, userId);
        if (!account) {
          await client.query("ROLLBACK");
          return res.status(400).json({ error: `No hay stock completo para este combo. Falta cuenta disponible para: ${item.name}` });
        }
        assignedAccounts.push(account);
      }

      const deliveredAccountData = buildComboDeliveredAccountData(assignedAccounts);
      const charged = chargeMode === "on_purchase" ? 1 : 0;

      if (charged === 1) {
        await client.query(`UPDATE users SET balance = balance - $1 WHERE id = $2`, [price, userId]);
      }

      const comboCost = assignedAccounts.reduce((sum, account, index) => {
        const fallbackCost = comboItems[index]?.cost_price;
        return sum + getPlatformAccountPurchaseCost(account, fallbackCost);
      }, 0);

      const orderInsertResult = await client.query(
        `INSERT INTO orders
         (user_id, product_id, amount, order_data, status, admin_response, charged, refunded, assigned_platform_account_id, delivered_account_data, product_name_snapshot, product_category_snapshot, product_cost_snapshot, distributor_cost_snapshot, owner_admin_id)
         VALUES ($1, $2, $3, $4, 'exito', $5, $6, 0, $7, $5, $8, $9, $10, $11, $12)
         RETURNING id`,
        [
          userId,
          productId,
          price,
          JSON.stringify(orderData),
          deliveredAccountData,
          charged,
          assignedAccounts[0]?.id || null,
          product.name || 'Combo',
          product.category || 'Combo',
          comboCost,
          distributorCostSnapshot,
          viewerContext?.owner_admin_id || null
        ]
      );

      const newOrderId = orderInsertResult.rows[0].id;

      for (const account of assignedAccounts) {
        await client.query(
          `UPDATE platform_accounts
           SET status = 'delivered', assigned_order_id = $1, assigned_user_id = $2, delivered_at = NOW()
           WHERE id = $3`,
          [newOrderId, userId, account.id]
        );
      }

      if (Number(product.stock_enabled || 0) === 1 && normalizeProductType(product.product_type) === 'manual') {
        await client.query(`UPDATE products SET stock = stock - 1 WHERE id = $1 AND stock > 0`, [productId]);
      }

      await ensureDistributorSaleEarningForOrder(client, newOrderId);
      await client.query("COMMIT");

      sendNewOrderEmail({
        orderId: newOrderId,
        customerName: user.name || "Cliente",
        customerEmail: user.email || "Sin correo",
        productName: product.name,
        amount: price,
        orderData
      });

      return res.json({
        message: "Combo comprado correctamente. Tus cuentas fueron entregadas automáticamente.",
        immediate_delivery: true,
        order_id: newOrderId,
        product_id: Number(productId),
        product_name: product.name || 'Combo',
        amount: price,
        delivered_account_data: deliveredAccountData,
        assigned_account_id: assignedAccounts[0]?.id || null,
        assigned_accounts: assignedAccounts.map(account => ({
          id: Number(account.id),
          platform: account.platform || account.product_name || '',
          product_name: account.product_name || account.platform || '',
          account_email: account.account_email || '',
          profile_name: account.profile_name || '',
          reportable: true
        }))
      });
    }

    const productName = String(product.name || "").trim();
    const productCategory = String(product.category || "").trim();

    console.log("Buscando cuenta para:", productName, productCategory);

    const isPlatformProduct = productType === 'streaming_auto';
    // La casilla "Manejar stock limitado" tiene prioridad sobre nombre, categoría y cuentas reutilizables antiguas.
    const isReusableProduct = Number(product.reusable_stock || 0) === 1;

    console.log(
      'PRODUCTO:',
      product.name,
      'TIPO:',
      product.product_type,
      'AUTO:',
      isPlatformProduct,
      'REUSABLE:',
      isReusableProduct
    );
    let assignedAccount = null;
    let deliveredAccountData = "";
    let orderStatus = "accion_en_espera";
    let adminResponse = "";

    if (isPlatformProduct) {
      const availableCondition = isReusableProduct
        ? `lower(COALESCE(status, 'available')) IN ('available', 'disponible', 'delivered')`
        : `status IN ('available', 'disponible')`;
      const inventoryOwnerId = viewerContext?.owner_admin_id || null;

      const availableAccountResult = await client.query(
        `SELECT *
         FROM platform_accounts
         WHERE ${availableCondition}
           AND (
             ($3::int IS NULL AND (owner_admin_id IS NULL OR owner_admin_id = 0))
             OR ($3::int IS NOT NULL AND owner_admin_id = $3)
           )
           AND (
             lower(COALESCE(product_name, '')) = lower($1)
             OR lower(COALESCE(platform, '')) = lower($1)
             OR lower(COALESCE(platform, '')) = lower($2)
           )
         ORDER BY CASE WHEN COALESCE(reusable, 0) = 1 THEN 0 ELSE 1 END, id ASC
         LIMIT 1
         FOR UPDATE SKIP LOCKED`,
        [productName, productCategory, inventoryOwnerId]
      );

      assignedAccount = availableAccountResult.rows[0];

      if (!assignedAccount) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          error: "Por el momento no hay cuentas disponibles para esta plataforma. Intenta más tarde."
        });
      }

      // Solo conserva la cuenta para ventas sucesivas cuando el producto está configurado sin límite.
      const isReusableSale = isReusableProduct;

      deliveredAccountData = buildDeliveredAccountData(
        assignedAccount,
        productName,
        productCategory,
        null,
        product.product_type
      );

      orderStatus = "exito";
      adminResponse = deliveredAccountData;
      assignedAccount.isReusableSale = isReusableSale;
    }

    const charged = chargeMode === "on_purchase" ? 1 : 0;

    if (charged === 1) {
      await client.query(
        `UPDATE users SET balance = balance - $1 WHERE id = $2`,
        [price, userId]
      );
    }

    const orderInsertResult = await client.query(
      `INSERT INTO orders
       (user_id, product_id, amount, order_data, status, admin_response, charged, refunded, assigned_platform_account_id, delivered_account_data, product_name_snapshot, product_category_snapshot, product_cost_snapshot, distributor_cost_snapshot, owner_admin_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       RETURNING id`,
      [
        userId,
        productId,
        price,
        JSON.stringify(orderData),
        orderStatus,
        adminResponse,
        charged,
        0,
        assignedAccount ? assignedAccount.id : null,
        deliveredAccountData,
        product.name || productName,
        product.category || productCategory,
        assignedAccount
          ? getPlatformAccountPurchaseCost(assignedAccount, product.cost_price)
          : Math.max(0, Number(product.cost_price || 0)),
        distributorCostSnapshot,
        viewerContext?.owner_admin_id || null
      ]
    );

    const newOrderId = orderInsertResult.rows[0].id;

if (assignedAccount) {
    const isReusableSale = assignedAccount.isReusableSale === true;
    await markAccountAsSold(client, assignedAccount.id, newOrderId, userId, isReusableSale);
    
    // Si la función de arriba falla, el código salta al catch y hace ROLLBACK
    // por lo tanto, aquí ya puedes estar seguro de que la cuenta está entregada.
} else if (isPlatformProduct) {
    // Si no hay cuenta, cancelamos la compra
    await client.query("ROLLBACK");
    return res.status(400).json({ error: "No se pudo asignar cuenta." });
}
if (Number(product.stock_enabled || 0) === 1 && normalizeProductType(product.product_type) === 'manual') {
    await client.query(
        `UPDATE products
         SET stock = stock - 1
         WHERE id = $1 AND stock > 0`,
        [productId]
    );
}

await ensureDistributorSaleEarningForOrder(client, newOrderId);
await client.query("COMMIT");

sendNewOrderEmail({
    orderId: newOrderId,
    customerName: user.name || "Cliente",
    customerEmail: user.email || "Sin correo",
    productName: product.name,
    amount: price,
    orderData
});

return res.json({
    message: assignedAccount
        ? "Cuenta entregada correctamente."
        : "Pedido enviado correctamente.",
    immediate_delivery: Boolean(assignedAccount && deliveredAccountData),
    order_id: newOrderId,
    product_id: Number(productId),
    product_name: product.name || productName,
    amount: price,
    delivered_account_data: deliveredAccountData,
    assigned_account_id: assignedAccount ? Number(assignedAccount.id) : null,
    assigned_accounts: assignedAccount ? [{
      id: Number(assignedAccount.id),
      platform: assignedAccount.platform || assignedAccount.product_name || productName || productCategory || '',
      product_name: assignedAccount.product_name || productName || '',
      account_email: assignedAccount.account_email || '',
      profile_name: assignedAccount.profile_name || '',
      reportable: assignedAccount.isReusableSale !== true
    }] : []
});

} catch (err) {

    await client.query("ROLLBACK");

    console.error(err);

    return res.status(500).json({
        error: "Error procesando la compra."
    });

} finally {

    client.release();

}

});

app.get("/api/alerts/expiring", authMiddleware, async (req, res) => {
  try {
    const viewer = await getViewerContext(req.user.id);
    const scope = adminOwnedWhere(viewer, "orders");

    const result = await pool.query(`
  SELECT
    id,
    product_name_snapshot AS product_name,
    created_at,
    (created_at + INTERVAL '28 days') AS expires_at
  FROM orders
  WHERE status = 'exito'
  AND refunded = 0
  AND ${scope.clause}
  AND (
    created_at + INTERVAL '28 days'
  )::date
  BETWEEN CURRENT_DATE
  AND (CURRENT_DATE + INTERVAL '3 days')::date
  ORDER BY expires_at ASC
    `, scope.params);

    res.json(result.rows);

  } catch (err) {
    console.error("Error buscando cuentas por vencer:", err);
    res.status(500).json({ error: "Error obteniendo alertas" });
  }
});

app.get("/api/alerts/count", authMiddleware, async (req, res) => {
  try {
    const viewer = await getViewerContext(req.user.id);
    const scope = adminOwnedWhere(viewer, "orders");

    const result = await pool.query(`
      SELECT COUNT(*) AS total
      FROM orders
      WHERE status = 'exito'
      AND refunded = 0
      AND ${scope.clause}
      AND (
        created_at + INTERVAL '28 days'
      )::date
      BETWEEN CURRENT_DATE
      AND (CURRENT_DATE + INTERVAL '3 days')::date
    `, scope.params);

    res.json({
      count: Number(result.rows[0].total || 0)
    });

  } catch (err) {
    console.error("Error obteniendo contador de renovaciones:", err.message);
    res.status(500).json({
      error: "Error obteniendo contador"
    });
  }
});

// === AQUÍ PEGAS LA NUEVA RUTA DE ALERTAS ===
app.get("/api/admin/alerts/mother-accounts", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const ownerId = req.isPanelAdmin ? req.user.id : null;
    const result = await pool.query(
      `SELECT
         ma.id,
         ma.product_name AS platform,
         ma.product_name,
         ma.account_email,
         ma.original_purchase_date AS official_purchase_date,
         ma.expiration_date AS mother_expiration,
         ma.replaces_mother_account_id,
         COUNT(pa.id)::int AS profile_count,
         COUNT(pa.id) FILTER (WHERE pa.status = 'available')::int AS available_profiles
       FROM mother_accounts ma
       LEFT JOIN platform_accounts pa ON pa.mother_account_id = ma.id
       WHERE ma.status = 'active'
         AND ma.expiration_date IS NOT NULL
         AND ma.expiration_date <= (CURRENT_DATE + INTERVAL '5 days')::date
         AND COALESCE(ma.owner_admin_id, 0) = COALESCE($1::int, 0)
       GROUP BY ma.id
       ORDER BY ma.expiration_date ASC, ma.id ASC`,
      [ownerId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Error cargando alertas de cuentas madre" });
  }
});

app.get("/api/admin/search-email", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.json({ accounts: [], orders: [] });

    const search = `%${q}%`;

    // 1. Buscamos TODAS las cuentas madre que coincidan con el correo
    const accountsResult = await pool.query(
      `SELECT id, platform, account_email, status, official_purchase_date
       FROM platform_accounts 
       WHERE account_email ILIKE $1`,
      [search]
    );

    // 2. Buscamos TODOS los pedidos vinculados a ese correo 
    // Usamos el ID de esas cuentas encontradas para ser precisos
    const accountIds = accountsResult.rows.map(a => a.id);
    
    let orders = [];
    if (accountIds.length > 0) {
      // Buscamos cualquier pedido que tenga asignado CUALQUIERA de los IDs encontrados
      const ordersResult = await pool.query(
        `SELECT o.id, u.name as vendedor_name, p.name as product_name, o.status, o.created_at 
         FROM orders o
         LEFT JOIN users u ON o.user_id = u.id
         LEFT JOIN products p ON o.product_id = p.id
         WHERE o.assigned_platform_account_id = ANY($1) 
         OR o.id IN (
            SELECT assigned_order_id FROM platform_accounts WHERE id = ANY($1) AND assigned_order_id IS NOT NULL
         )
         ORDER BY o.created_at DESC`,
        [accountIds]
      );
      orders = ordersResult.rows;
    }

    res.json({
      accounts: accountsResult.rows,
      orders: orders
    });
  } catch (err) {
    console.error("Error SQL:", err.message);
    res.status(500).json({ error: "Error en la búsqueda global" });
  }
});

// CUENTAS DE PLATAFORMAS - ADMIN
app.get("/api/admin/platform-accounts", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const owner = req.isPanelAdmin
      ? { clause: "owner_admin_id = $1", params: [req.user.id] }
      : { clause: "(owner_admin_id IS NULL OR owner_admin_id = 0)", params: [] };

    const pageRaw = Number(req.query.page || 1);
    const limitRaw = Number(req.query.limit || 50);
    const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(200, Math.floor(limitRaw)) : 50;
    const offset = (page - 1) * limit;

    const totalResult = await pool.query(
      `SELECT COUNT(*)::int AS total FROM platform_accounts WHERE ${owner.clause}`,
      owner.params
    );
    const total = Number(totalResult.rows[0]?.total || 0);
    const totalPages = Math.max(1, Math.ceil(total / limit));

    const summaryResult = await pool.query(
      `SELECT
         COALESCE(NULLIF(TRIM(product_name), ''), NULLIF(TRIM(platform), ''), 'Sin plataforma') AS product,
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE status = 'available')::int AS available,
         COUNT(*) FILTER (WHERE status = 'delivered')::int AS delivered,
         COUNT(*) FILTER (WHERE status = 'sold_outside')::int AS sold_outside,
         COUNT(*) FILTER (WHERE status = 'failed')::int AS failed
       FROM platform_accounts
       WHERE ${owner.clause}
       GROUP BY 1
       ORDER BY 1 ASC`,
      owner.params
    );

    const totalsByStatusResult = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'available')::int AS available,
         COUNT(*)::int AS total
       FROM platform_accounts
       WHERE ${owner.clause}`,
      owner.params
    );

    const result = await pool.query(
      `SELECT pa.*,
              ma.replaces_mother_account_id AS reemplaza_cuenta_madre_id,
              ma.original_purchase_date AS fecha_original_cuenta_madre,
              ma.expiration_date AS vencimiento_cuenta_madre,
              ma.status AS estado_cuenta_madre
       FROM platform_accounts pa
       LEFT JOIN mother_accounts ma ON ma.id = pa.mother_account_id
       WHERE ${owner.clause.replace(/owner_admin_id/g, 'pa.owner_admin_id')}
       ORDER BY pa.id DESC
       LIMIT $${owner.params.length + 1} OFFSET $${owner.params.length + 2}`,
      [...owner.params, limit, offset]
    );

    res.json({
      rows: result.rows,
      page,
      limit,
      total,
      totalPages,
      summary: {
        available: Number(totalsByStatusResult.rows[0]?.available || 0),
        total: Number(totalsByStatusResult.rows[0]?.total || 0)
      },
      productSummary: summaryResult.rows
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Error obteniendo cuentas" });
  }
});

app.post("/api/admin/platform-accounts", authMiddleware, adminMiddleware, async (req, res) => {
  const client = await pool.connect();
  try {
    const {
      platform,
      product_name,
      account_email,
      account_password,
      profile_name,
      profile_pin,
      extra_data,
      terms_conditions,
      access_url,
      reusable,
      official_purchase_date,
      purchase_price
    } = req.body;

    if (!platform || !product_name) {
      return res.status(400).json({ error: "Faltan plataforma o nombre del producto" });
    }

    if (!reusable && (!account_email || !account_password)) {
      return res.status(400).json({ error: "Faltan datos obligatorios (correo y contraseña)" });
    }

    const rawPurchasePrice = String(purchase_price ?? "").trim();
    const parsedPurchasePrice = rawPurchasePrice === "" ? null : Number(rawPurchasePrice);
    if (parsedPurchasePrice !== null && (!Number.isFinite(parsedPurchasePrice) || parsedPurchasePrice < 0)) {
      return res.status(400).json({ error: "precio_compra debe ser un número mayor o igual a 0" });
    }

    await client.query("BEGIN");
    const ownerAdminId = req.isPanelAdmin ? req.user.id : null;
    const motherAccount = await resolveMotherAccount(client, {
      productName: product_name,
      accountEmail: account_email || "",
      ownerAdminId,
      purchaseDate: official_purchase_date || null
    });

    const result = await client.query(
      `INSERT INTO platform_accounts
       (platform, product_name, account_email, account_password, profile_name, profile_pin,
        extra_data, terms_conditions, access_url, status, owner_admin_id, reusable,
        official_purchase_date, purchase_price, mother_account_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'available',$10,$11,$12,$13,$14)
       RETURNING *`,
      [
        platform,
        product_name,
        account_email || "",
        account_password || "",
        profile_name || "",
        profile_pin || "",
        extra_data || "",
        terms_conditions || "",
        access_url || "",
        ownerAdminId,
        reusable === 1 ? 1 : 0,
        official_purchase_date || motherAccount.original_purchase_date || null,
        parsedPurchasePrice,
        motherAccount.id
      ]
    );

    await client.query("COMMIT");
    res.json(result.rows[0]);
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error(err.message);
    res.status(500).json({ error: err.message || "Error guardando cuenta de plataforma" });
  } finally {
    client.release();
  }
});

app.patch("/api/admin/platform-accounts/:id", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const id = req.params.id;

      const {
        platform,
        product_name,
        account_email,
        account_password,
        profile_name,
        profile_pin,
        access_url,
        status,
        reusable,
        official_purchase_date // <-- NUEVO AL EDITAR
      } = req.body;

      const result = await pool.query(
        // <-- NUEVO: Agregamos official_purchase_date = $10 y recorremos el id a $11
        `UPDATE platform_accounts
         SET
           platform = $1,
           product_name = $2,
           account_email = $3,
           account_password = $4,
           profile_name = $5,
           profile_pin = $6,
           access_url = $7,
           status = $8,
           reusable = $9,
           official_purchase_date = $10
         WHERE id = $11
         RETURNING *`,
        [
          platform,
          product_name,
          account_email || "",
          account_password || "",
          profile_name || "",
          profile_pin || "",
          access_url || "",
          status,
          reusable === 1 ? 1 : 0,
          official_purchase_date || null, // <-- NUEVO
          id
        ]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({ error: "Cuenta no encontrada" });
      }

      res.json({ message: "Cuenta actualizada correctamente" });

    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Error actualizando cuenta" 
});
    }
  }
);

app.post(["/api/admin/inventario/bulk-upload", "/api/admin/inventory/bulk-upload"], authMiddleware, adminMiddleware, async (req, res) => {
  const normalizeHeader = (value) =>
    String(value || "")
      .replace(/^\uFEFF/, "")
      .replace(/[\u200B-\u200D\u2060]/g, "")
      .trim()
      .toLowerCase();

  const parseCsvLine = (rawLine, separator) => {
    const line = String(rawLine || "");
    const out = [];
    let cur = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      const nxt = line[i + 1];
      if (ch === '"') {
        if (inQuotes && nxt === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }
      if (ch === separator && !inQuotes) {
        out.push(cur.trim());
        cur = "";
        continue;
      }
      cur += ch;
    }
    out.push(cur.trim());
    return out;
  };

  const detectSeparator = (headerLine) => {
    const text = String(headerLine || "");
    const semicolonCols = parseCsvLine(text, ';').length;
    const commaCols = parseCsvLine(text, ',').length;
    return semicolonCols > commaCols ? ';' : ',';
  };

  const normalizeInventoryDate = (value) => {
    const text = String(value || "").trim();
    if (!text) return null;

    let year;
    let month;
    let day;
    let match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);

    if (match) {
      year = Number(match[1]);
      month = Number(match[2]);
      day = Number(match[3]);
    } else {
      match = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      if (!match) return undefined;
      day = Number(match[1]);
      month = Number(match[2]);
      year = Number(match[3]);
    }

    const date = new Date(Date.UTC(year, month - 1, day));
    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) {
      return undefined;
    }

    return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  };

  const normalizePurchasePrice = (value) => {
    const text = String(value ?? "").trim();
    if (!text) return null;

    const normalized = text
      .replace(/\s+/g, "")
      .replace(/(?:MXN|\$)/gi, "")
      .replace(',', '.');

    if (!/^\d+(?:\.\d+)?$/.test(normalized)) return undefined;

    const amount = Number(normalized);
    return Number.isFinite(amount) && amount >= 0 ? amount : undefined;
  };

  const normalizeOptionalPositiveId = (value) => {
    const text = String(value ?? "").trim();
    if (!text) return null;
    if (!/^\d+$/.test(text)) return undefined;
    const id = Number(text);
    return Number.isSafeInteger(id) && id > 0 ? id : undefined;
  };


  const requiredHeaders = [
    "producto", "correo", "contrasena", "perfil", "pin", "fecha_compra",
    "cuenta_madre", "url_soporte", "precio_compra"
  ];
  const optionalHeaders = [
    "cuenta_madre_id", "reemplaza_cuenta_madre_id",
    "fecha_original_cuenta_madre", "vencimiento_cuenta_madre"
  ];
  const supportedHeaders = [...requiredHeaders, ...optionalHeaders];

  const parseRowsFromCsvText = (csvText) => {
    const normalized = String(csvText || "")
      .replace(/^\uFEFF/, "")
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n");

    const lines = normalized.split("\n").filter((line) => String(line).trim() !== "");
    if (lines.length < 2) {
      throw new Error("Archivo CSV vacío o sin filas válidas.");
    }

    const separator = detectSeparator(lines[0]);
    const headers = parseCsvLine(lines[0], separator).map(normalizeHeader);
    const missing = requiredHeaders.filter((h) => !headers.includes(h));
    if (missing.length) {
      throw new Error(`Encabezados faltantes en CSV: ${missing.join(", ")}`);
    }

    const indexByHeader = {};
    headers.forEach((h, i) => {
      if (indexByHeader[h] === undefined) indexByHeader[h] = i;
    });

    return lines.slice(1).map((line, idx) => {
      const cols = parseCsvLine(line, separator);
      const row = {};
      supportedHeaders.forEach((h) => {
        const columnIndex = indexByHeader[h];
        row[h] = columnIndex === undefined ? "" : String(cols[columnIndex] || "").trim();
      });
      row.__rowNumber = idx + 2;
      return row;
    });
  };

  let rows = [];
  if (Array.isArray(req.body?.rows) && req.body.rows.length) {
    rows = req.body.rows;
  } else if (typeof req.body?.csvText === "string" && req.body.csvText.trim()) {
    rows = parseRowsFromCsvText(req.body.csvText);
  }

  if (!rows.length) {
    return res.status(400).json({
      successCount: 0,
      errorCount: 1,
      errors: ["Archivo vacío o sin filas válidas."]
    });
  }

  const ownerId = req.isPanelAdmin ? req.user.id : null;
  const productScopeClause = req.isPanelAdmin
    ? "owner_admin_id = $1"
    : "(owner_admin_id IS NULL OR owner_admin_id = 0)";

  const preparedRows = [];
  const errors = [];

  try {
    const productsResult = await pool.query(
      `SELECT id, name, category FROM products WHERE active = 1 AND ${productScopeClause}`,
      req.isPanelAdmin ? [ownerId] : []
    );

    const productsMap = new Map();
    productsResult.rows.forEach((p) => {
      const key = String(p.name || "").trim().toLowerCase();
      if (key) productsMap.set(key, p);
    });

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i] || {};
      const rowNumber = Number(row.__rowNumber) || i + 2;

      const producto = String(row.producto || "").trim();
      const correo = String(row.correo || "").trim();
      const contrasena = String(row.contrasena || "").trim();
      const perfil = String(row.perfil || "").trim();
      const pin = String(row.pin || "").trim();
      const fechaCompra = String(row.fecha_compra || "").trim();
      const cuentaMadre = String(row.cuenta_madre || "").trim();
      const urlSoporte = String(row.url_soporte || "").trim();
      const precioCompra = row.precio_compra;
      const explicitMotherId = normalizeOptionalPositiveId(row.cuenta_madre_id);
      const replacementMotherId = normalizeOptionalPositiveId(row.reemplaza_cuenta_madre_id);

      if (!producto) {
        errors.push(`Fila ${rowNumber}: Falta el campo producto.`);
        continue;
      }

      const product = productsMap.get(producto.toLowerCase());
      if (!product) {
        errors.push(`Fila ${rowNumber}: El producto '${producto}' no coincide con tu lista.`);
        continue;
      }

      const isReusable = !!urlSoporte;
      if (!isReusable && (!correo || !contrasena)) {
        errors.push(`Fila ${rowNumber}: Para cuentas normales debes enviar correo y contrasena.`);
        continue;
      }

      const parsedCsvDate = normalizeInventoryDate(fechaCompra);
      if (parsedCsvDate === undefined) {
        errors.push(`Fila ${rowNumber}: fecha_compra inválida. Usa DD/MM/YYYY o YYYY-MM-DD.`);
        continue;
      }

      const parsedOriginalMotherDate = normalizeInventoryDate(row.fecha_original_cuenta_madre);
      if (parsedOriginalMotherDate === undefined) {
        errors.push(`Fila ${rowNumber}: fecha_original_cuenta_madre inválida. Usa DD/MM/YYYY o YYYY-MM-DD.`);
        continue;
      }

      const parsedMotherExpiration = normalizeInventoryDate(row.vencimiento_cuenta_madre);
      if (parsedMotherExpiration === undefined) {
        errors.push(`Fila ${rowNumber}: vencimiento_cuenta_madre inválido. Usa DD/MM/YYYY o YYYY-MM-DD.`);
        continue;
      }

      // Sin IDs se crea una cuenta madre nueva, respetando exactamente fecha_compra.
      const isNewMotherCycle = !explicitMotherId && !replacementMotherId;
      const cyclePurchaseDate = parsedCsvDate;

      const parsedPurchasePrice = normalizePurchasePrice(precioCompra);
      if (parsedPurchasePrice === undefined) {
        errors.push(`Fila ${rowNumber}: precio_compra debe ser un número mayor o igual a 0.`);
        continue;
      }

      if (explicitMotherId === undefined) {
        errors.push(`Fila ${rowNumber}: cuenta_madre_id debe ser un ID numérico positivo o quedar vacío.`);
        continue;
      }

      if (replacementMotherId === undefined) {
        errors.push(`Fila ${rowNumber}: reemplaza_cuenta_madre_id debe ser un ID numérico positivo o quedar vacío.`);
        continue;
      }

      if (explicitMotherId && replacementMotherId) {
        errors.push(`Fila ${rowNumber}: usa cuenta_madre_id o reemplaza_cuenta_madre_id, no ambos.`);
        continue;
      }

      preparedRows.push({
        rowNumber,
        platform: cuentaMadre || product.name || producto,
        product_name: product.name || producto,
        account_email: correo,
        account_password: contrasena,
        profile_name: perfil,
        profile_pin: pin,
        extra_data: "",
        terms_conditions: "",
        access_url: urlSoporte,
        owner_admin_id: ownerId,
        reusable: isReusable ? 1 : 0,
        official_purchase_date: cyclePurchaseDate,
        purchase_price: parsedPurchasePrice,
        original_mother_date: parsedOriginalMotherDate,
        mother_expiration: parsedMotherExpiration,
        mother_account_id: explicitMotherId,
        replaces_mother_account_id: replacementMotherId,
        is_new_mother_cycle: isNewMotherCycle
      });
    }

    let successCount = 0;
    const newMotherCyclesInThisUpload = new Map();

    for (const item of preparedRows) {
      const client = await pool.connect();
      let newCycleCacheKey = '';
      let shouldCacheNewMother = false;
      try {
        await client.query("BEGIN");

        let motherAccount = null;

        if (item.mother_account_id) {
          const existingMotherResult = await client.query(
            `SELECT * FROM mother_accounts WHERE id = $1 FOR UPDATE`,
            [item.mother_account_id]
          );
          motherAccount = existingMotherResult.rows[0] || null;
          if (!motherAccount) {
            throw new Error(`La cuenta madre #${item.mother_account_id} no existe.`);
          }
          if (Number(motherAccount.owner_admin_id || 0) !== Number(item.owner_admin_id || 0)) {
            throw new Error(`La cuenta madre #${item.mother_account_id} no pertenece a este propietario.`);
          }
        } else if (item.replaces_mother_account_id) {
          motherAccount = await resolveMotherAccount(client, {
            productName: item.product_name,
            accountEmail: item.account_email,
            ownerAdminId: item.owner_admin_id,
            purchaseDate: item.official_purchase_date,
            originalPurchaseDate: item.original_mother_date,
            expirationDate: item.mother_expiration,
            replacesMotherAccountId: item.replaces_mother_account_id
          });
        } else {
          newCycleCacheKey = [
            String(item.product_name || '').trim().toLowerCase(),
            String(item.account_email || '').trim().toLowerCase(),
            String(Number(item.owner_admin_id || 0)),
            String(item.official_purchase_date || '')
          ].join('||');

          motherAccount = newMotherCyclesInThisUpload.get(newCycleCacheKey) || null;
          if (!motherAccount) {
            motherAccount = await resolveMotherAccount(client, {
              productName: item.product_name,
              accountEmail: item.account_email,
              ownerAdminId: item.owner_admin_id,
              purchaseDate: item.official_purchase_date,
              originalPurchaseDate: item.official_purchase_date,
              expirationDate: null,
              forceCreateNew: true
            });
            shouldCacheNewMother = true;
          }
        }

        const effectivePurchaseDate = motherAccount.original_purchase_date
          || item.official_purchase_date
          || null;
        const effectiveExpirationDate = motherAccount.expiration_date
          || item.mother_expiration
          || null;
        const insertResult = await client.query(
          `INSERT INTO platform_accounts
           (platform, product_name, account_email, account_password, profile_name, profile_pin,
            extra_data, terms_conditions, access_url, status, owner_admin_id, reusable,
            official_purchase_date, purchase_price, mother_account_id, expires_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'available',$10,$11,$12,$13,$14,$15)
           RETURNING id`,
          [
            item.platform,
            item.product_name,
            item.account_email,
            item.account_password,
            item.profile_name,
            item.profile_pin,
            item.extra_data,
            item.terms_conditions,
            item.access_url,
            item.owner_admin_id,
            item.reusable,
            effectivePurchaseDate,
            item.purchase_price,
            motherAccount.id,
            effectiveExpirationDate
          ]
        );

        const accountId = insertResult.rows[0].id;
        await addTraceEvent(client, {
          accountId,
          eventType: "ACCOUNT_CREATED",
          userId: req.user.id,
          description: "Cuenta agregada al inventario",
          metadata: {
            platform: item.platform,
            product: item.product_name,
            email: item.account_email,
            profile: item.profile_name,
            purchase_date: effectivePurchaseDate,
            purchase_price: item.purchase_price,
            mother_account_id: motherAccount.id,
            replaces_mother_account_id: motherAccount.replaces_mother_account_id || null
          }
        });

        await client.query("COMMIT");
        if (shouldCacheNewMother && newCycleCacheKey) {
          newMotherCyclesInThisUpload.set(newCycleCacheKey, motherAccount);
        }
        successCount++;
      } catch (insertErr) {
        await client.query("ROLLBACK").catch(() => {});
        errors.push(`Fila ${item.rowNumber}: ${insertErr.message || "Error al insertar en base de datos."}`);
      } finally {
        client.release();
      }
    }

    return res.json({
      successCount,
      errorCount: errors.length,
      errors
    });
  } catch (err) {
    console.error("Error bulk upload inventario:", err.message);
    return res.status(500).json({
      successCount: 0,
      errorCount: errors.length + 1,
      errors: [...errors, err.message || "Error interno procesando la carga masiva."]
    });
  }
});

// MIS PEDIDOS
app.get("/api/my-orders", authMiddleware, async (req, res) => {
  try {
    const { page, limit, offset } = getPaginationParams(req, 20, 100);
    const search = String(req.query.search || "").trim();
    const status = String(req.query.status || "").trim().toLowerCase();

    const params = [req.user.id, search, status];
    const whereSql = `
      WHERE orders.user_id = $1
        AND (
          $2::text = ''
          OR orders.id::text ILIKE '%' || $2 || '%'
          OR COALESCE(products.name, '') ILIKE '%' || $2 || '%'
          OR COALESCE(products.category, '') ILIKE '%' || $2 || '%'
          OR COALESCE(current_account.account_email, '') ILIKE '%' || $2 || '%'
          OR COALESCE(current_account.profile_name, '') ILIKE '%' || $2 || '%'
          OR COALESCE(orders.delivered_account_data, '') ILIKE '%' || $2 || '%'
          OR COALESCE(orders.admin_response, '') ILIKE '%' || $2 || '%'
        )
        AND (
          $3::text = ''
          OR ($3 = 'reportado' AND CONCAT(COALESCE(orders.delivered_account_data, ''), ' ', COALESCE(orders.admin_response, '')) ~* 'reporte|falla|reemplazo|reembolso')
          OR ($3 <> 'reportado' AND lower(COALESCE(orders.status, '')) = $3)
        )`;

    const totalResult = await pool.query(
      `SELECT COUNT(*)::int AS total
       FROM orders
       JOIN products ON orders.product_id = products.id
       LEFT JOIN LATERAL (
         SELECT candidate.*
         FROM platform_accounts candidate
         WHERE candidate.assigned_order_id = orders.id
           AND candidate.assigned_user_id = orders.user_id
           AND candidate.status = 'delivered'
           AND NOT EXISTS (
             SELECT 1
             FROM account_reports replaced_report
             WHERE replaced_report.user_id = orders.user_id
               AND replaced_report.order_id = orders.id
               AND replaced_report.reported_account_id = candidate.id
               AND NULLIF(replaced_report.replacement_account_id, 0) IS NOT NULL
           )
         ORDER BY CASE WHEN candidate.id = orders.assigned_platform_account_id THEN 0 ELSE 1 END,
                  candidate.delivered_at DESC NULLS LAST,
                  candidate.id DESC
         LIMIT 1
       ) current_account ON true
       ${whereSql}`,
      params
    );
    const total = Number(totalResult.rows[0]?.total || 0);

    const result = await pool.query(
      `SELECT
        orders.id,
        orders.user_id,
        orders.product_id,
        orders.amount,
        orders.order_data,
        orders.status,
        orders.admin_response,
        orders.delivered_account_data,
        orders.charged,
        orders.refunded,
        orders.created_at,
        orders.assigned_platform_account_id,
        current_account.id AS current_account_id,
        current_account.platform AS current_platform,
        current_account.product_name AS current_account_product_name,
        current_account.account_email AS current_account_email,
        current_account.account_password AS current_account_password,
        current_account.profile_name AS current_profile_name,
        current_account.profile_pin AS current_profile_pin,
        current_account.delivered_at AS current_delivered_at,
        current_account.expires_at AS current_expires_at,
        current_account.official_purchase_date AS current_official_purchase_date,
        current_account.mother_account_id AS current_mother_account_id,
        current_account.access_url AS current_access_url,
        products.name AS product_name,
        products.category AS product_category,
        products.charge_mode AS charge_mode,
        products.product_type AS product_type,
        COALESCE((
          SELECT json_agg(
            json_build_object(
              'id', active_account.id,
              'platform', active_account.platform,
              'product_name', active_account.product_name,
              'account_email', active_account.account_email,
              'account_password', active_account.account_password,
              'profile_name', active_account.profile_name,
              'profile_pin', active_account.profile_pin,
              'delivered_at', active_account.delivered_at,
              'expires_at', active_account.expires_at,
              'official_purchase_date', active_account.official_purchase_date,
              'mother_account_id', active_account.mother_account_id,
              'access_url', active_account.access_url
            ) ORDER BY CASE WHEN active_account.id = current_account.id THEN 0 ELSE 1 END,
                       active_account.delivered_at DESC NULLS LAST,
                       active_account.id ASC
          )
          FROM platform_accounts active_account
          WHERE active_account.assigned_order_id = orders.id
            AND active_account.assigned_user_id = orders.user_id
            AND active_account.status = 'delivered'
            AND NOT EXISTS (
              SELECT 1
              FROM account_reports replaced_report
              WHERE replaced_report.user_id = orders.user_id
                AND replaced_report.order_id = orders.id
                AND replaced_report.reported_account_id = active_account.id
                AND NULLIF(replaced_report.replacement_account_id, 0) IS NOT NULL
            )
        ), '[]'::json) AS current_accounts
       FROM orders
       JOIN products ON orders.product_id = products.id
       LEFT JOIN LATERAL (
         SELECT candidate.*
         FROM platform_accounts candidate
         WHERE candidate.assigned_order_id = orders.id
           AND candidate.assigned_user_id = orders.user_id
           AND candidate.status = 'delivered'
           AND NOT EXISTS (
             SELECT 1
             FROM account_reports replaced_report
             WHERE replaced_report.user_id = orders.user_id
               AND replaced_report.order_id = orders.id
               AND replaced_report.reported_account_id = candidate.id
               AND NULLIF(replaced_report.replacement_account_id, 0) IS NOT NULL
           )
         ORDER BY CASE WHEN candidate.id = orders.assigned_platform_account_id THEN 0 ELSE 1 END,
                  candidate.delivered_at DESC NULLS LAST,
                  candidate.id DESC
         LIMIT 1
       ) current_account ON true
       ${whereSql}
       ORDER BY orders.id DESC
       LIMIT $4 OFFSET $5`,
      [...params, limit, offset]
    );

    res.json(buildPaginationPayload(
      summarizeOrderRowsForList(result.rows),
      page,
      limit,
      total
    ));
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Error cargando pedidos" });
  }
});

// USUARIO/ADMIN: CARGAR UN ADJUNTO DE PEDIDO SOLO CUANDO SE ABRE
app.get("/api/orders/:orderId/attachment", authMiddleware, async (req, res) => {
  try {
    const orderId = Number(req.params.orderId || 0);
    const field = String(req.query.field || "").trim();
    if (!orderId || !field) return res.status(400).json({ error: "Adjunto inválido" });

    const result = await pool.query(
      `SELECT orders.user_id, orders.owner_admin_id, orders.order_data,
              users.owner_user_id
       FROM orders
       JOIN users ON users.id = orders.user_id
       WHERE orders.id = $1
       LIMIT 1`,
      [orderId]
    );
    const order = result.rows[0];
    if (!order) return res.status(404).json({ error: "Pedido no encontrado" });

    let allowed = Number(order.user_id) === Number(req.user.id);
    if (!allowed && String(req.user.role || '').toLowerCase() === 'admin') {
      const viewer = await getViewerContext(req.user.id);
      if (viewer?.is_panel_admin) {
        allowed = Number(order.owner_admin_id || 0) === Number(viewer.id)
          || Number(order.user_id || 0) === Number(viewer.id)
          || Number(order.owner_user_id || 0) === Number(viewer.id);
      } else {
        allowed = true;
      }
    }

    if (!allowed) return res.status(403).json({ error: "No tienes permiso para abrir este adjunto" });

    const value = getOrderDataFieldValue(order.order_data, field);
    const meta = getInlineAttachmentMeta(value, field);
    if (!meta) return res.status(404).json({ error: "El adjunto no existe o ya no está disponible" });

    res.json({
      value,
      mime_type: meta.mime_type,
      is_image: meta.is_image,
      is_pdf: meta.is_pdf,
      field
    });
  } catch (err) {
    console.error("Error cargando adjunto de pedido:", err.message);
    res.status(500).json({ error: "Error cargando adjunto" });
  }
});

// ADMIN: USUARIOS
app.get("/api/admin/users", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    let result;
    if (req.isPanelAdmin) {
      result = await pool.query(
        `SELECT u.id, u.name, u.email, u.role, u.balance, COALESCE(u.is_subadmin, false) AS is_subadmin, u.owner_user_id,
                COALESCE(u.is_enabled, TRUE) AS is_enabled,
                activity.last_activity_at,
                COALESCE(activity.movements_2m, 0)::int AS movements_2m,
                owner.name AS owner_name,
                owner.email AS owner_email,
                own_panel.business_name AS owner_panel_name,
                own_panel.id AS owner_panel_id,
                CASE WHEN ap.id IS NULL THEN false ELSE true END AS is_panel_admin,
                CASE WHEN own_panel.id IS NULL THEN false ELSE true END AS belongs_to_panel_owner,
                CASE WHEN ap.id IS NOT NULL THEN 'panel_propietario'
                     WHEN own_panel.id IS NOT NULL AND COALESCE(u.is_subadmin, false) = true THEN 'distribuidor_del_panel'
                     WHEN own_panel.id IS NOT NULL THEN 'vendedor_panel'
                     WHEN COALESCE(u.is_subadmin, false) = true THEN 'admin_distribuidor'
                     WHEN u.role = 'admin' THEN 'admin_global'
                     ELSE 'usuario' END AS account_type
         FROM users u
         LEFT JOIN LATERAL (
           SELECT
             MAX(m.ts) AS last_activity_at,
             COUNT(*) FILTER (WHERE m.ts >= NOW() - INTERVAL '2 months')::int AS movements_2m
           FROM (
             SELECT o.created_at AS ts FROM orders o WHERE o.user_id = u.id
             UNION ALL
             SELECT br.created_at AS ts FROM balance_requests br WHERE br.user_id = u.id
             UNION ALL
             SELECT ar.created_at AS ts FROM account_reports ar WHERE ar.user_id = u.id
           ) m
         ) activity ON TRUE
         LEFT JOIN users owner ON owner.id = u.owner_user_id
         LEFT JOIN admin_panels own_panel ON own_panel.owner_user_id = owner.id
         LEFT JOIN admin_panels ap ON ap.owner_user_id = u.id
         WHERE u.owner_user_id = $1
         ORDER BY u.id DESC`,
        [req.user.id]
      );
    } else {
      result = await pool.query(
        `SELECT u.id, u.name, u.email, u.role, u.balance, COALESCE(u.is_subadmin, false) AS is_subadmin, u.owner_user_id,
              COALESCE(u.is_enabled, TRUE) AS is_enabled,
              activity.last_activity_at,
              COALESCE(activity.movements_2m, 0)::int AS movements_2m,
              owner.name AS owner_name,
              owner.email AS owner_email,
              own_panel.business_name AS owner_panel_name,
              own_panel.id AS owner_panel_id,
              CASE WHEN ap.id IS NULL THEN false ELSE true END AS is_panel_admin,
              CASE WHEN own_panel.id IS NULL THEN false ELSE true END AS belongs_to_panel_owner,
              CASE WHEN ap.id IS NOT NULL THEN 'panel_propietario'
                   WHEN own_panel.id IS NOT NULL AND COALESCE(u.is_subadmin, false) = true THEN 'distribuidor_del_panel'
                   WHEN own_panel.id IS NOT NULL THEN 'vendedor_panel'
                   WHEN COALESCE(u.is_subadmin, false) = true THEN 'admin_distribuidor'
                   WHEN u.role = 'admin' THEN 'admin_global'
                   ELSE 'usuario' END AS account_type
       FROM users u
       LEFT JOIN LATERAL (
         SELECT
           MAX(m.ts) AS last_activity_at,
           COUNT(*) FILTER (WHERE m.ts >= NOW() - INTERVAL '2 months')::int AS movements_2m
         FROM (
           SELECT o.created_at AS ts FROM orders o WHERE o.user_id = u.id
           UNION ALL
           SELECT br.created_at AS ts FROM balance_requests br WHERE br.user_id = u.id
           UNION ALL
           SELECT ar.created_at AS ts FROM account_reports ar WHERE ar.user_id = u.id
         ) m
       ) activity ON TRUE
       LEFT JOIN users owner ON owner.id = u.owner_user_id
       LEFT JOIN admin_panels own_panel ON own_panel.owner_user_id = owner.id
       LEFT JOIN admin_panels ap ON ap.owner_user_id = u.id
       ORDER BY u.id DESC`
      );
    }

    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Error cargando usuarios" });
  }
});

app.patch("/api/admin/users/:userId/status", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    const rawEnabled = req.body?.enabled;
    const enabled =
      rawEnabled === true || rawEnabled === "true" || rawEnabled === 1 || rawEnabled === "1"
        ? true
        : rawEnabled === false || rawEnabled === "false" || rawEnabled === 0 || rawEnabled === "0"
          ? false
          : null;

    if (!userId || enabled === null) {
      return res.status(400).json({ error: "ID y estado habilitado son obligatorios" });
    }

    if (userId === Number(req.user.id)) {
      return res.status(400).json({ error: "No puedes deshabilitar tu propio usuario" });
    }

    const targetResult = await pool.query(
      `SELECT id, role, owner_user_id
       FROM users
       WHERE id = $1
       LIMIT 1`,
      [userId]
    );

    const target = targetResult.rows[0];
    if (!target) return res.status(404).json({ error: "Usuario no encontrado" });
    if (target.role === "admin") return res.status(403).json({ error: "No puedes modificar estado de cuentas admin" });

    if (req.isPanelAdmin && Number(target.owner_user_id || 0) !== Number(req.user.id)) {
      return res.status(403).json({ error: "Solo puedes modificar usuarios de tu panel" });
    }

    const result = await pool.query(
      `UPDATE users
       SET is_enabled = $1
       WHERE id = $2
       RETURNING id, name, email, COALESCE(is_enabled, TRUE) AS is_enabled`,
      [enabled, userId]
    );

    res.json({ message: enabled ? "Usuario habilitado correctamente" : "Usuario deshabilitado correctamente", user: result.rows[0] });
  } catch (err) {
    console.error("Error cambiando estado de usuario:", err.message);
    res.status(500).json({ error: "Error cambiando estado del usuario" });
  }
});

app.delete("/api/admin/users/:userId", authMiddleware, adminMiddleware, async (req, res) => {
  const client = await pool.connect();
  try {
    const userId = Number(req.params.userId);
    if (!userId) return res.status(400).json({ error: "ID de usuario inválido" });
    if (userId === Number(req.user.id)) return res.status(400).json({ error: "No puedes eliminar tu propio usuario" });

    await client.query("BEGIN");

    const targetResult = await client.query(
      `SELECT id, role, owner_user_id
       FROM users
       WHERE id = $1
       LIMIT 1`,
      [userId]
    );

    const target = targetResult.rows[0];
    if (!target) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    if (target.role === "admin") {
      await client.query("ROLLBACK");
      return res.status(403).json({ error: "No puedes eliminar cuentas admin" });
    }

    if (req.isPanelAdmin && Number(target.owner_user_id || 0) !== Number(req.user.id)) {
      await client.query("ROLLBACK");
      return res.status(403).json({ error: "Solo puedes eliminar usuarios de tu panel" });
    }

    const usage = await client.query(
      `SELECT
         (SELECT COUNT(*)::int FROM orders WHERE user_id = $1) AS orders_count,
         (SELECT COUNT(*)::int FROM balance_requests WHERE user_id = $1) AS balance_count,
         (SELECT COUNT(*)::int FROM account_reports WHERE user_id = $1) AS reports_count`,
      [userId]
    );

    const counts = usage.rows[0] || {};
    const hasMovements = Number(counts.orders_count || 0) > 0 || Number(counts.balance_count || 0) > 0 || Number(counts.reports_count || 0) > 0;
    if (hasMovements) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "No se puede eliminar porque el usuario ya tiene movimientos históricos." });
    }

    await client.query(`DELETE FROM subadmin_reseller_prices WHERE owner_user_id = $1`, [userId]);
    await client.query(`DELETE FROM user_product_prices WHERE user_id = $1`, [userId]);
    await client.query(`DELETE FROM users WHERE id = $1`, [userId]);

    await client.query("COMMIT");
    res.json({ message: "Usuario eliminado correctamente" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error eliminando usuario:", err.message);
    res.status(500).json({ error: "Error eliminando usuario" });
  } finally {
    client.release();
  }
});

// ADMIN: AGREGAR SALDO
app.post("/api/admin/add-balance", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { user_id, amount, note } = req.body;

    if (!user_id || !amount) {
      return res.status(400).json({ error: "ID de usuario y cantidad son obligatorios" });
    }

    const amountNumber = Number(amount);

    if (amountNumber <= 0) {
      return res.status(400).json({ error: "La cantidad debe ser mayor a 0" });
    }

    const result = await pool.query(
      `UPDATE users SET balance = balance + $1 WHERE id = $2 AND ($3::int IS NULL OR owner_user_id = $3)`,
      [amountNumber, user_id, req.isPanelAdmin ? req.user.id : null]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    res.json({
      message: `Saldo agregado correctamente${note ? ": " + note : ""}`
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Error agregando saldo" });
  }
});

// ADMIN: QUITAR SALDO
app.post("/api/admin/remove-balance", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { user_id, amount, note } = req.body;

    if (!user_id || !amount) {
      return res.status(400).json({ error: "ID de usuario y cantidad son obligatorios" });
    }

    const amountNumber = Number(amount);
    if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
      return res.status(400).json({ error: "La cantidad debe ser mayor a 0" });
    }

    const targetResult = await pool.query(
      `SELECT id, balance
       FROM users
       WHERE id = $1 AND ($2::int IS NULL OR owner_user_id = $2)
       LIMIT 1`,
      [user_id, req.isPanelAdmin ? req.user.id : null]
    );

    const target = targetResult.rows[0];
    if (!target) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    const currentBalance = Number(target.balance || 0);
    if (currentBalance < amountNumber) {
      return res.status(400).json({ error: `Saldo insuficiente para descontar. Saldo actual: $${currentBalance.toFixed(2)}` });
    }

    await pool.query(
      `UPDATE users SET balance = balance - $1 WHERE id = $2`,
      [amountNumber, user_id]
    );

    res.json({
      message: `Saldo descontado correctamente${note ? ": " + note : ""}`
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Error descontando saldo" });
  }
});


// USUARIO: SOLICITAR CARGA DE SALDO
app.post("/api/balance-requests", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { amount, bank, reference, account_holder, proof } = req.body;

    const amountNumber = Number(amount);

    if (!amountNumber || amountNumber <= 0) {
      return res.status(400).json({ error: "El monto debe ser mayor a 0" });
    }

    if (!bank || !reference || !account_holder) {
      return res.status(400).json({ error: "Banco, referencia y titular son obligatorios" });
    }

    const ownerInfo = await getOwnerAndNotificationForUser(userId);

    const insertResult = await pool.query(
      `INSERT INTO balance_requests
       (user_id, amount, bank, reference, account_holder, proof, status, admin_response, owner_admin_id)
       VALUES ($1, $2, $3, $4, $5, $6, 'pendiente', '', $7)
       RETURNING id`,
      [
        userId,
        amountNumber,
        String(bank).trim(),
        String(reference).trim(),
        String(account_holder).trim(),
        String(proof || '').trim(),
        ownerInfo.ownerAdminId
      ]
    );

    const requestId = insertResult.rows[0].id;

    const customerResult = await pool.query(
      `SELECT name, email FROM users WHERE id = $1`,
      [userId]
    );

    const customer = customerResult.rows[0] || {};

    sendBalanceRequestEmail({
      requestId,
      customerName: customer.name || "Cliente",
      customerEmail: customer.email || "Sin correo",
      amount: amountNumber,
      bank,
      reference,
      accountHolder: account_holder,
      proof: proof || "",
      notifyToOverride: ownerInfo.notificationEmail
    });

    res.json({
      message: "Solicitud enviada. El administrador revisará tu transferencia y aprobará el saldo si el pago llegó."
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Error enviando solicitud de saldo" });
  }
});



// ALIAS COMPATIBLE: SOLICITUD DE SALDO DESDE FRONTEND ANTERIOR
app.post("/api/user/solicitud-saldo", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const amountNumber = Number(req.body.monto || req.body.amount || 0);
    const bank = String(req.body.banco || req.body.bank || "").trim();
    const reference = String(req.body.referencia || req.body.reference || "No proporcionada").trim();
    const accountHolder = String(req.body.titular || req.body.account_holder || "").trim();
    const proof = String(req.body.comprobante || req.body.proof || "").trim();

    if (!amountNumber || amountNumber <= 0) {
      return res.status(400).json({ error: "El monto debe ser mayor a 0" });
    }

    if (!bank || !accountHolder) {
      return res.status(400).json({ error: "Banco y nombre de quien transfirió son obligatorios" });
    }

    const ownerInfo = await getOwnerAndNotificationForUser(userId);

    const insertResult = await pool.query(
      `INSERT INTO balance_requests
       (user_id, amount, bank, reference, account_holder, proof, status, admin_response, owner_admin_id)
       VALUES ($1, $2, $3, $4, $5, $6, 'pendiente', '', $7)
       RETURNING id`,
      [userId, amountNumber, bank, reference || "No proporcionada", accountHolder, proof, ownerInfo.ownerAdminId]
    );

    const requestId = insertResult.rows[0].id;
    const customerResult = await pool.query(`SELECT name, email FROM users WHERE id = $1`, [userId]);
    const customer = customerResult.rows[0] || {};

    sendBalanceRequestEmail({
      requestId,
      customerName: customer.name || "Cliente",
      customerEmail: customer.email || "Sin correo",
      amount: amountNumber,
      bank,
      reference: reference || "No proporcionada",
      accountHolder,
      proof,
      notifyToOverride: ownerInfo.notificationEmail
    });

    res.json({ message: "Solicitud enviada. El administrador revisará tu transferencia y aprobará el saldo si el pago llegó." });
  } catch (err) {
    console.error("Error enviando solicitud de saldo:", err.message);
    res.status(500).json({ error: "Error enviando solicitud de saldo" });
  }
});

// USUARIO: MIS SOLICITUDES DE SALDO
app.get("/api/my-balance-requests", authMiddleware, async (req, res) => {
  try {
    const { page, limit, offset } = getPaginationParams(req, 20, 100);
    const status = String(req.query.status || "").trim().toLowerCase();
    const params = [req.user.id, status];

    const totalResult = await pool.query(
      `SELECT COUNT(*)::int AS total
       FROM balance_requests
       WHERE user_id = $1
         AND ($2::text = '' OR lower(COALESCE(status, '')) = $2)`,
      params
    );
    const total = Number(totalResult.rows[0]?.total || 0);

    const result = await pool.query(
      `SELECT id, amount, bank, reference, account_holder,
              CASE WHEN COALESCE(proof, '') <> '' THEN 1 ELSE 0 END AS has_proof,
              status, admin_response, created_at, reviewed_at
       FROM balance_requests
       WHERE user_id = $1
         AND ($2::text = '' OR lower(COALESCE(status, '')) = $2)
       ORDER BY id DESC
       LIMIT $3 OFFSET $4`,
      [...params, limit, offset]
    );

    res.json(buildPaginationPayload(result.rows, page, limit, total));
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Error cargando solicitudes de saldo" });
  }
});

app.get("/api/my-balance-requests/:requestId/proof", authMiddleware, async (req, res) => {
  try {
    const requestId = Number(req.params.requestId || 0);
    if (!requestId) return res.status(400).json({ error: "Solicitud inválida" });
    const result = await pool.query(
      `SELECT proof FROM balance_requests WHERE id = $1 AND user_id = $2 LIMIT 1`,
      [requestId, req.user.id]
    );
    const proof = String(result.rows[0]?.proof || "").trim();
    if (!proof) return res.status(404).json({ error: "Esta solicitud no tiene comprobante" });
    const meta = getInlineAttachmentMeta(proof, "proof");
    res.json({ value: proof, mime_type: meta?.mime_type || "", is_image: Boolean(meta?.is_image), is_pdf: Boolean(meta?.is_pdf) });
  } catch (err) {
    console.error("Error cargando comprobante de saldo:", err.message);
    res.status(500).json({ error: "Error cargando comprobante" });
  }
});

// ADMIN: SOLICITUDES DE SALDO
app.get("/api/admin/balance-requests", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { page, limit, offset } = getPaginationParams(req, 20, 100);
    const status = String(req.query.status || "").trim().toLowerCase();
    const ownerId = req.isPanelAdmin ? Number(req.user.id) : null;
    const params = [ownerId, status];
    const whereSql = `WHERE ($1::int IS NULL OR balance_requests.owner_admin_id = $1)
                        AND ($2::text = '' OR lower(COALESCE(balance_requests.status, '')) = $2)`;

    const totalResult = await pool.query(
      `SELECT COUNT(*)::int AS total FROM balance_requests ${whereSql}`,
      params
    );
    const total = Number(totalResult.rows[0]?.total || 0);

    const result = await pool.query(
      `SELECT
        balance_requests.id,
        balance_requests.user_id,
        balance_requests.amount,
        balance_requests.bank,
        balance_requests.reference,
        balance_requests.account_holder,
        CASE WHEN COALESCE(balance_requests.proof, '') <> '' THEN 1 ELSE 0 END AS has_proof,
        balance_requests.status,
        balance_requests.admin_response,
        balance_requests.created_at,
        balance_requests.reviewed_at,
        users.name AS customer_name,
        users.email AS customer_email
       FROM balance_requests
       JOIN users ON balance_requests.user_id = users.id
       ${whereSql}
       ORDER BY balance_requests.id DESC
       LIMIT $3 OFFSET $4`,
      [...params, limit, offset]
    );

    res.json(buildPaginationPayload(result.rows, page, limit, total));
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Error cargando solicitudes de saldo" });
  }
});

app.get("/api/admin/balance-requests/:requestId/proof", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const requestId = Number(req.params.requestId || 0);
    if (!requestId) return res.status(400).json({ error: "Solicitud inválida" });
    const ownerId = req.isPanelAdmin ? Number(req.user.id) : null;
    const result = await pool.query(
      `SELECT proof
       FROM balance_requests
       WHERE id = $1 AND ($2::int IS NULL OR owner_admin_id = $2)
       LIMIT 1`,
      [requestId, ownerId]
    );
    const proof = String(result.rows[0]?.proof || "").trim();
    if (!proof) return res.status(404).json({ error: "Esta solicitud no tiene comprobante" });
    const meta = getInlineAttachmentMeta(proof, "proof");
    res.json({ value: proof, mime_type: meta?.mime_type || "", is_image: Boolean(meta?.is_image), is_pdf: Boolean(meta?.is_pdf) });
  } catch (err) {
    console.error("Error cargando comprobante de saldo admin:", err.message);
    res.status(500).json({ error: "Error cargando comprobante" });
  }
});

// ADMIN: APROBAR O RECHAZAR SOLICITUD DE SALDO
app.patch("/api/admin/balance-requests/:requestId/status", authMiddleware, adminMiddleware, async (req, res) => {
  const client = await pool.connect();
  let transactionStarted = false;

  try {
    const requestId = Number(req.params.requestId);
    const rawStatus = String(req.body.status || "").trim().toLowerCase();
    const admin_response = req.body.admin_response || "";

    const statusMap = {
      pendiente: "pendiente",
      aprobado: "aprobado",
      aprobada: "aprobado",
      rechazada: "rechazado",
      rechazado: "rechazado"
    };

    const status = statusMap[rawStatus];

    if (!requestId) {
      return res.status(400).json({ error: "Solicitud inválida" });
    }

    if (!status) {
      return res.status(400).json({ error: "Estado inválido" });
    }

    await client.query("BEGIN");
    transactionStarted = true;

    const requestResult = await client.query(
      `SELECT * FROM balance_requests WHERE id = $1 AND ($2::int IS NULL OR owner_admin_id = $2) FOR UPDATE`,
      [requestId, req.isPanelAdmin ? req.user.id : null]
    );

    const request = requestResult.rows[0];

    if (!request) {
      await client.query("ROLLBACK");
      transactionStarted = false;
      return res.status(404).json({ error: "Solicitud no encontrada" });
    }

    const currentStatus = statusMap[String(request.status || "pendiente").trim().toLowerCase()] || "pendiente";
    const amountNumber = Number(request.amount || 0);

    if (!amountNumber || amountNumber <= 0) {
      await client.query("ROLLBACK");
      transactionStarted = false;
      return res.status(400).json({ error: "La solicitud no tiene un monto válido" });
    }

    if (currentStatus === "aprobado" && status === "aprobado") {
      await client.query("ROLLBACK");
      transactionStarted = false;
      return res.status(400).json({ error: "Esta solicitud ya fue aprobada antes" });
    }

    if (currentStatus === "aprobado" && status !== "aprobado") {
      await client.query("ROLLBACK");
      transactionStarted = false;
      return res.status(400).json({ error: "No se puede cambiar una solicitud ya aprobada para evitar movimientos duplicados" });
    }

    const userResult = await client.query(
      `SELECT id, name, email, balance FROM users WHERE id = $1 FOR UPDATE`,
      [request.user_id]
    );

    const user = userResult.rows[0];

    if (!user) {
      await client.query("ROLLBACK");
      transactionStarted = false;
      return res.status(404).json({ error: "Usuario de la solicitud no encontrado" });
    }

    if (status === "aprobado") {
      await client.query(
        `UPDATE users SET balance = COALESCE(balance, 0) + $1 WHERE id = $2`,
        [amountNumber, request.user_id]
      );
    }

    await client.query(
      `UPDATE balance_requests
       SET status = $1, admin_response = $2, reviewed_at = NOW()
       WHERE id = $3`,
      [status, admin_response || "", requestId]
    );

    await client.query("COMMIT");
    transactionStarted = false;

    if (status === "aprobado") {
      await sendDirectUserEmail({
        to: user.email,
        subject: `Saldo aprobado por $${amountNumber.toFixed(2)}`,
        text: `Hola ${user.name || "cliente"}.

Tu solicitud de saldo fue aprobada correctamente.

Monto agregado: $${amountNumber.toFixed(2)}
Respuesta del admin: ${admin_response || "Saldo aprobado y agregado a tu cuenta."}

Ya puedes ingresar a tu panel y realizar tus compras.`
      });

      return res.json({ message: `Solicitud aprobada. Se agregaron $${amountNumber.toFixed(2)} al cliente y se notificó por correo.` });
    }

    if (status === "rechazado") {
      await sendDirectUserEmail({
        to: user.email,
        subject: "Solicitud de saldo rechazada",
        text: `Hola ${user.name || "cliente"}.

Tu solicitud de saldo fue rechazada.

Respuesta del admin: ${admin_response || "Por favor revisa los datos del comprobante o contacta al administrador."}`
      });

      return res.json({ message: "Solicitud rechazada correctamente y se notificó por correo." });
    }

    res.json({ message: "Solicitud actualizada correctamente." });
  } catch (err) {
    if (transactionStarted) {
      try { await client.query("ROLLBACK"); } catch (_) {}
    }
    console.error("Error actualizando solicitud de saldo:", err.message);
    res.status(500).json({ error: "Error actualizando solicitud de saldo" });
  } finally {
    client.release();
  }
});




// ADMIN: NOTIFICAR AL USUARIO SOBRE SOLICITUD DE SALDO
app.post("/api/admin/balance-requests/:requestId/notify", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const requestId = Number(req.params.requestId || 0);

    const result = await pool.query(
      `SELECT br.*, u.name AS customer_name, u.email AS customer_email
       FROM balance_requests br
       JOIN users u ON u.id = br.user_id
       WHERE br.id = $1
         AND ($2::int IS NULL OR br.owner_admin_id = $2)
       LIMIT 1`,
      [requestId, req.isPanelAdmin ? req.user.id : null]
    );

    const row = result.rows[0];
    if (!row) return res.status(404).json({ error: "Solicitud no encontrada" });

    const subject = String(row.status || "").toLowerCase() === "aprobado"
      ? `Saldo aprobado por $${Number(row.amount || 0).toFixed(2)}`
      : "Actualización de solicitud de saldo";

    const text = `Hola ${row.customer_name || "cliente"}.

Tu solicitud de saldo #${row.id} fue actualizada.

Estado: ${row.status || "pendiente"}
Monto: $${Number(row.amount || 0).toFixed(2)}
Respuesta: ${row.admin_response || "Tu solicitud fue revisada por el administrador."}

Entra a tu panel para verificar tu saldo.`;

    const sent = await sendDirectUserEmail({ to: row.customer_email, subject, text });

    res.json({
      message: sent ? "Notificación de saldo enviada al usuario." : "No se pudo enviar correo. Revisa variables de Resend.",
      sent
    });
  } catch (err) {
    console.error("Error notificando saldo:", err.message);
    res.status(500).json({ error: "Error notificando saldo" });
  }
});

// ADMIN: NOTIFICAR AL USUARIO SOBRE REPORTE DE FALLA
app.post("/api/admin/account-reports/:reportId/notify", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const reportId = Number(req.params.reportId || 0);

    const result = await pool.query(
      `SELECT ar.*, u.name AS customer_name, u.email AS customer_email
       FROM account_reports ar
       JOIN users u ON u.id = ar.user_id
       WHERE ar.id = $1
         AND ($2::int IS NULL OR ar.owner_admin_id = $2)
       LIMIT 1`,
      [reportId, req.isPanelAdmin ? req.user.id : null]
    );

    const row = result.rows[0];
    if (!row) return res.status(404).json({ error: "Reporte no encontrado" });

    const text = `Hola ${row.customer_name || "cliente"}.

Tu reporte de falla #${row.id} ya fue atendido.

Correo reportado: ${row.email || ""}
Estado: ${row.status || ""}
Respuesta del admin:

${row.admin_response || "Tu reporte fue revisado por el administrador."}

Entra a tu panel en Respuesta de fallos para ver/copiar los datos.`;

    const sent = await sendDirectUserEmail({
      to: row.customer_email,
      subject: `Tu reporte de falla #${row.id} fue atendido`,
      text
    });

    res.json({
      message: sent ? "Notificación de reporte enviada al usuario." : "No se pudo enviar correo. Revisa variables de Resend.",
      sent
    });
  } catch (err) {
    console.error("Error notificando reporte:", err.message);
    res.status(500).json({ error: "Error notificando reporte" });
  }
});


// USUARIO: CUENTAS REPORTABLES
// Permite seleccionar cuenta exacta cuando un pedido/combo trae varias plataformas.
app.get("/api/reportable-accounts", authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `WITH latest_replacement AS (
         SELECT DISTINCT ON (ar.order_id)
                ar.order_id,
                ar.replacement_account_id
         FROM account_reports ar
         JOIN platform_accounts replacement_pa
           ON replacement_pa.id = ar.replacement_account_id
          AND replacement_pa.assigned_order_id = ar.order_id
          AND replacement_pa.assigned_user_id = ar.user_id
          AND replacement_pa.status = 'delivered'
         WHERE ar.user_id = $1
           AND NULLIF(ar.replacement_account_id, 0) IS NOT NULL
         ORDER BY ar.order_id,
                  COALESCE(ar.reviewed_at, ar.created_at) DESC NULLS LAST,
                  ar.id DESC
       ), latest_delivered AS (
         SELECT DISTINCT ON (candidate.assigned_order_id)
                candidate.assigned_order_id AS order_id,
                candidate.id AS account_id
         FROM platform_accounts candidate
         WHERE candidate.assigned_user_id = $1
           AND candidate.status = 'delivered'
           AND NOT EXISTS (
             SELECT 1
             FROM account_reports replaced_report
             WHERE replaced_report.user_id = $1
               AND replaced_report.order_id = candidate.assigned_order_id
               AND replaced_report.reported_account_id = candidate.id
               AND NULLIF(replaced_report.replacement_account_id, 0) IS NOT NULL
           )
         ORDER BY candidate.assigned_order_id,
                  candidate.delivered_at DESC NULLS LAST,
                  candidate.id DESC
       )
       SELECT
         pa.id,
         pa.assigned_order_id AS order_id,
         pa.platform,
         pa.product_name,
         pa.account_email,
         pa.profile_name,
         pa.profile_pin,
         pa.delivered_at,
         pa.expires_at,
         pa.official_purchase_date,
         o.created_at AS order_created_at,
         COALESCE(NULLIF(o.product_name_snapshot, ''), p.name, '') AS order_product_name,
         CASE
           WHEN pa.id = lr.replacement_account_id THEN true
           ELSE false
         END AS is_replacement
       FROM platform_accounts pa
       JOIN orders o ON o.id = pa.assigned_order_id
       LEFT JOIN products p ON p.id = o.product_id
       LEFT JOIN latest_replacement lr ON lr.order_id = o.id
       LEFT JOIN latest_delivered ld ON ld.order_id = o.id
       WHERE pa.assigned_user_id = $1
         AND o.user_id = $1
         AND o.status = 'exito'
         AND pa.status = 'delivered'
         AND NOT EXISTS (
           SELECT 1
           FROM account_reports replaced_report
           WHERE replaced_report.user_id = $1
             AND replaced_report.order_id = o.id
             AND replaced_report.reported_account_id = pa.id
             AND NULLIF(replaced_report.replacement_account_id, 0) IS NOT NULL
         )
         AND (
           lower(COALESCE(p.product_type, '')) LIKE '%combo%'
           OR pa.id = lr.replacement_account_id
           OR pa.id = o.assigned_platform_account_id
           OR pa.id = ld.account_id
         )
       ORDER BY o.id DESC,
                CASE WHEN pa.id = lr.replacement_account_id THEN 0
                     WHEN pa.id = o.assigned_platform_account_id THEN 1
                     ELSE 2 END,
                pa.id ASC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Error cargando cuentas reportables:", err.message);
    res.status(500).json({ error: "Error cargando cuentas reportables" });
  }
});


// USUARIO: REPORTAR PROBLEMA DE CUENTA
async function createAccountReportHandler(req, res) {
  try {
    const userId = req.user.id;
    const reportedAccountId = Number(req.body.reported_account_id || 0);
    let email = String(req.body.email || req.body.correo || "").trim();
    const issue_type = String(req.body.issue_type || req.body.tipo || "otro").trim();
    const description = String(req.body.description || req.body.explicacion || "").trim();
// --- NUEVO: ATRAPAMOS LA FOTO ---
    const evidence_image = req.body.evidence_image || null;

// 👇 PON ESTE DETECTOR AQUÍ 👇
console.log("📸 FOTO RECIBIDA EN SERVER:", evidence_image ? "SÍ LLEGÓ, longitud: " + evidence_image.length : "NO LLEGÓ NADA");
    // --------------------------------

    if (!description) {
      return res.status(400).json({ error: "La explicación de la falla es obligatoria" });
    }

    let purchase = null;

    if (reportedAccountId > 0) {
      const selectedResult = await pool.query(
        `SELECT
           o.id AS order_id,
           o.user_id,
           o.amount,
           o.created_at AS order_created_at,
           o.refunded,
           o.assigned_platform_account_id,
           p.id AS product_id,
           p.name AS product_name,
           p.category AS product_category,
           p.product_type,
           pa.id AS account_id,
           pa.platform,
           pa.product_name AS account_product_name,
           pa.account_email,
           pa.status AS account_status,
           pa.owner_admin_id
         FROM platform_accounts pa
         JOIN orders o ON o.id = pa.assigned_order_id
         JOIN products p ON p.id = o.product_id
         WHERE pa.id = $1
           AND pa.assigned_user_id = $2
           AND o.user_id = $2
           AND o.status = 'exito'
           AND pa.status = 'delivered'
           AND NOT EXISTS (
             SELECT 1
             FROM account_reports replaced_report
             WHERE replaced_report.user_id = $2
               AND replaced_report.order_id = o.id
               AND replaced_report.reported_account_id = pa.id
               AND NULLIF(replaced_report.replacement_account_id, 0) IS NOT NULL
           )
           AND (
             lower(COALESCE(p.product_type, '')) LIKE '%combo%'
             OR pa.id = o.assigned_platform_account_id
             OR EXISTS (
               SELECT 1
               FROM account_reports replacement_report
               WHERE replacement_report.user_id = $2
                 AND replacement_report.order_id = o.id
                 AND replacement_report.replacement_account_id = pa.id
             )
             OR pa.id = (
               SELECT current_pa.id
               FROM platform_accounts current_pa
               WHERE current_pa.assigned_order_id = o.id
                 AND current_pa.assigned_user_id = $2
                 AND current_pa.status = 'delivered'
                 AND NOT EXISTS (
                   SELECT 1
                   FROM account_reports previous_report
                   WHERE previous_report.user_id = $2
                     AND previous_report.order_id = o.id
                     AND previous_report.reported_account_id = current_pa.id
                     AND NULLIF(previous_report.replacement_account_id, 0) IS NOT NULL
                 )
               ORDER BY current_pa.delivered_at DESC NULLS LAST, current_pa.id DESC
               LIMIT 1
             )
           )
         LIMIT 1`,
        [reportedAccountId, userId]
      );

      purchase = selectedResult.rows[0] || null;
      if (!purchase) {
        return res.status(400).json({ error: "No se encontró ese perfil vigente dentro de tus pedidos o reemplazos." });
      }

      // Repara de forma segura pedidos históricos cuyo reemplazo sí está ligado al
      // usuario/pedido, pero el pedido todavía apunta a la cuenta anterior.
      if (
        normalizeProductType(purchase.product_type) !== 'combo_auto' &&
        Number(purchase.assigned_platform_account_id || 0) !== Number(purchase.account_id || 0)
      ) {
        await pool.query(
          `UPDATE orders
           SET assigned_platform_account_id = $1
           WHERE id = $2 AND user_id = $3`,
          [purchase.account_id, purchase.order_id, userId]
        );
      }

      email = purchase.account_email || email;
    }

    if (!email) {
      return res.status(400).json({ error: "Selecciona la cuenta del combo o escribe el correo con falla" });
    }

    if (!purchase) purchase = await findReportedPurchase(pool, userId, email);

    // Si no existe en inventario automático, busca cuentas entregadas manualmente
    // dentro del pedido del usuario. Esto permite reportar cuentas manuales
    // siempre que el correo aparezca en delivered_account_data o admin_response.
    if (!purchase) {
      const manualResult = await pool.query(
        `SELECT
           o.id AS order_id,
           o.user_id,
           o.amount,
           o.created_at AS order_created_at,
           o.refunded,
           p.id AS product_id,
           p.name AS product_name,
           p.category AS product_category,
           NULL::integer AS account_id,
           p.name AS platform,
           p.name AS account_product_name,
           $2::text AS account_email,
           'manual' AS account_status
         FROM orders o
         JOIN products p ON p.id = o.product_id
         WHERE o.user_id = $1
           AND o.status = 'exito'
           AND (
             COALESCE(o.delivered_account_data, '') ILIKE $3
             OR COALESCE(o.admin_response, '') ILIKE $3
           )
         ORDER BY o.id DESC
         LIMIT 1`,
        [userId, email, `%${email}%`]
      );

      purchase = manualResult.rows[0] || null;
    }

    if (!purchase) {
      return res.status(400).json({
        error: "Solo puedes reportar un correo que hayas comprado y que fue entregado por el sistema o manualmente. Revisa que el correo esté escrito igual al de Mis pedidos."
      });
    }

// === INICIO DE NUEVA VALIDACIÓN: Bloquear reportes duplicados ===
    const checkDuplicate = Number(purchase.account_id || 0) > 0
      ? await pool.query(
          `SELECT id
           FROM account_reports
           WHERE reported_account_id = $1
             AND user_id = $2
             AND order_id = $3
             AND lower(COALESCE(status, '')) IN ('pendiente', 'en_revision', 'en revisión')
           LIMIT 1`,
          [purchase.account_id, userId, purchase.order_id]
        )
      : { rows: [] };

    if (checkDuplicate.rows.length > 0) {
      return res.status(400).json({ 
        error: "Ya existe un reporte pendiente para este perfil exacto. Cuando se entregue un reemplazo, el perfil nuevo podrá reportarse con su propio ID." 
      });
    }
    // === FIN DE NUEVA VALIDACIÓN ===    

const insertResult = await pool.query(
      `INSERT INTO account_reports
       (user_id, email, issue_type, description, status, admin_response, order_id, reported_account_id, refund_amount, resolution_type, reported_platform, owner_admin_id, evidence_image)
       VALUES ($1, $2, $3, $4, 'pendiente', '', $5, $6, 0, '', $7, $8, $9)
       RETURNING id`,
      [
        userId,
        email,
        issue_type || "otro",
        description,
        purchase.order_id,
        purchase.account_id,
        purchase.platform || purchase.account_product_name || purchase.product_name || "",
        purchase.owner_admin_id || null,
        evidence_image // <-- Aquí inyectamos la foto en la base de datos
      ]
    );

    const reportId = insertResult.rows[0].id;

    const customerResult = await pool.query(
      `SELECT name, email FROM users WHERE id = $1`,
      [userId]
    );

    const customer = customerResult.rows[0] || {};

    sendAccountReportEmail({
      reportId,
      customerName: customer.name || "Cliente",
      customerEmail: customer.email || "Sin correo",
      email,
      issueType: issue_type || "otro",
      description
    });


res.json({
      message: evidence_image ? "✅ ¡ÉXITO! LA FOTO SÍ LLEGÓ AL SERVIDOR" : "❌ ERROR: LA FOTO NO LLEGÓ"
    });
  } catch (err) {
    console.error("Error enviando reporte de cuenta:", err.message);
    res.status(500).json({ error: "Error enviando reporte de cuenta" });
  }
}


app.post("/api/account-reports", authMiddleware, createAccountReportHandler);
app.post("/api/user/reporte-cuenta", authMiddleware, createAccountReportHandler);

// USUARIO: MIS REPORTES DE CUENTA
app.get("/api/my-account-reports", authMiddleware, async (req, res) => {
  try {
    const { page, limit, offset } = getPaginationParams(req, 20, 100);
    const totalResult = await pool.query(
      `SELECT COUNT(*)::int AS total FROM account_reports WHERE user_id = $1`,
      [req.user.id]
    );
    const total = Number(totalResult.rows[0]?.total || 0);

    const result = await pool.query(
      `SELECT id, email, issue_type, description, status, admin_response, created_at, reviewed_at,
              order_id, reported_account_id, replacement_account_id, refund_amount, resolution_type,
              CASE WHEN COALESCE(evidence_image, '') <> '' THEN 1 ELSE 0 END AS has_evidence
       FROM account_reports
       WHERE user_id = $1
       ORDER BY id DESC
       LIMIT $2 OFFSET $3`,
      [req.user.id, limit, offset]
    );

    res.json(buildPaginationPayload(result.rows, page, limit, total));
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Error cargando reportes de cuenta" });
  }
});

app.get("/api/my-account-reports/:reportId/evidence", authMiddleware, async (req, res) => {
  try {
    const reportId = Number(req.params.reportId || 0);
    if (!reportId) return res.status(400).json({ error: "ID de reporte inválido" });
    const result = await pool.query(
      `SELECT evidence_image FROM account_reports WHERE id = $1 AND user_id = $2 LIMIT 1`,
      [reportId, req.user.id]
    );
    const evidence = String(result.rows[0]?.evidence_image || "").trim();
    if (!evidence) return res.status(404).json({ error: "Este reporte no tiene evidencia" });
    const meta = getInlineAttachmentMeta(evidence, "evidence_image");
    res.json({ evidence_image: evidence, mime_type: meta?.mime_type || "", is_image: Boolean(meta?.is_image), is_pdf: Boolean(meta?.is_pdf) });
  } catch (err) {
    console.error("Error cargando evidencia del usuario:", err.message);
    res.status(500).json({ error: "Error cargando evidencia" });
  }
});

// ADMIN: REPORTES DE CUENTA
app.get("/api/admin/account-reports", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { page, limit, offset } = getPaginationParams(req, 20, 100);
    const ownerId = req.isPanelAdmin ? Number(req.user.id) : null;
    const scopeSql = `($1::int IS NULL OR account_reports.owner_admin_id = $1 OR account_reports.user_id = $1 OR account_reports.user_id IN (SELECT id FROM users WHERE owner_user_id = $1))`;

    const totalsResult = await pool.query(
      `SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE lower(COALESCE(account_reports.status, '')) = 'pendiente')::int AS pending_total
       FROM account_reports
       WHERE ${scopeSql}`,
      [ownerId]
    );
    const total = Number(totalsResult.rows[0]?.total || 0);
    const pendingTotal = Number(totalsResult.rows[0]?.pending_total || 0);

    const result = await pool.query(
      `SELECT
        account_reports.id,
        account_reports.user_id,
        account_reports.email,
        account_reports.issue_type,
        account_reports.description,
        account_reports.status,
        account_reports.admin_response,
        account_reports.created_at,
        account_reports.reviewed_at,
        account_reports.order_id,
        account_reports.reported_account_id,
        account_reports.replacement_account_id,
        account_reports.refund_amount,
        account_reports.resolution_type,
        CASE WHEN COALESCE(account_reports.evidence_image, '') <> '' THEN 1 ELSE 0 END AS has_evidence,
        users.name AS customer_name,
        users.email AS customer_email,
        orders.amount AS order_amount,
        orders.created_at AS order_created_at,
        products.name AS product_name,
        products.category AS product_category,
        platform_accounts.platform AS platform,
        platform_accounts.product_name AS account_product_name,
        platform_accounts.status AS account_status
       FROM account_reports
       JOIN users ON account_reports.user_id = users.id
       LEFT JOIN orders ON orders.id = account_reports.order_id
       LEFT JOIN products ON products.id = orders.product_id
       LEFT JOIN platform_accounts ON platform_accounts.id = account_reports.reported_account_id
       WHERE ${scopeSql}
       ORDER BY account_reports.id DESC
       LIMIT $2 OFFSET $3`,
      [ownerId, limit, offset]
    );

    res.json(buildPaginationPayload(result.rows, page, limit, total, { pendingTotal }));
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Error cargando reportes de cuenta" });
  }
});

app.get("/api/admin/account-reports/:reportId/evidence", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const reportId = Number(req.params.reportId || 0);
    if (!reportId) return res.status(400).json({ error: "ID de reporte inválido" });
    const ownerId = req.isPanelAdmin ? Number(req.user.id) : null;
    const result = await pool.query(
      `SELECT evidence_image
       FROM account_reports
       WHERE id = $1
         AND ($2::int IS NULL OR owner_admin_id = $2 OR user_id = $2 OR user_id IN (SELECT id FROM users WHERE owner_user_id = $2))
       LIMIT 1`,
      [reportId, ownerId]
    );

    const evidence = String(result.rows[0]?.evidence_image || "").trim();
    if (!evidence) return res.status(404).json({ error: "Este reporte no tiene evidencia adjunta" });
    const meta = getInlineAttachmentMeta(evidence, "evidence_image");
    res.json({ evidence_image: evidence, mime_type: meta?.mime_type || "", is_image: Boolean(meta?.is_image), is_pdf: Boolean(meta?.is_pdf) });
  } catch (err) {
    console.error("Error cargando evidencia de reporte:", err.message);
    res.status(500).json({ error: "Error cargando evidencia" });
  }
});


// CUENTAS DEL PEDIDO DE UN REPORTE
app.get("/api/admin/account-reports/:reportId/order-accounts", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const reportId = Number(req.params.reportId || 0);
    const reportResult = await pool.query(
      `SELECT id, order_id, reported_account_id, replacement_account_id
       FROM account_reports
       WHERE id = $1
       LIMIT 1`,
      [reportId]
    );

    const report = reportResult.rows[0];

    if (report && Number(report.reported_account_id || 0) > 0) {
      const selectedAccountResult = await pool.query(
        `SELECT *
         FROM platform_accounts
         WHERE id = $1
           AND assigned_order_id = $2
         LIMIT 1
         FOR UPDATE`,
        [Number(report.reported_account_id), report.order_id]
      );

      const selectedAccount = selectedAccountResult.rows[0];
      if (!selectedAccount) {
               return res.status(400).json({ error: "La cuenta seleccionada no pertenece a ese pedido/combo" });
      }

      report.reported_account_id = selectedAccount.id;
      report.platform = selectedAccount.platform || report.platform;
      report.account_product_name = selectedAccount.product_name || report.account_product_name;
      report.resolved_owner_admin_id = selectedAccount.owner_admin_id || report.resolved_owner_admin_id;

      await pool.query(
        `UPDATE account_reports
         SET reported_account_id = $1,
             reported_platform = $2,
             owner_admin_id = COALESCE(owner_admin_id, $3)
         WHERE id = $4`,
        [selectedAccount.id, selectedAccount.platform || selectedAccount.product_name || "", selectedAccount.owner_admin_id || null, reportId]
      );
    }

    if (!report || !report.order_id) {
      return res.status(404).json({ error: "Reporte sin pedido ligado" });
    }

    const accountsResult = await pool.query(
      `SELECT id, platform, product_name, account_email, profile_name, profile_pin, status, delivered_at
       FROM platform_accounts
       WHERE assigned_order_id = $1
       ORDER BY id ASC`,
      [report.order_id]
    );

    res.json({
      report_id: report.id,
      order_id: report.order_id,
      reported_account_id: report.reported_account_id,
      replacement_account_id: report.replacement_account_id || null,
      accounts: accountsResult.rows
    });
  } catch (err) {
    console.error("Error cargando cuentas del reporte:", err.message);
    res.status(500).json({ error: "Error cargando cuentas del reporte" });
  }
});

// OPCIONES DE REEMPLAZO PARA REPORTE
app.get("/api/admin/account-reports/:reportId/replacement-options", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const reportId = req.params.reportId;
    const selectedAccountId = Number(req.query.reported_account_id || 0);

    const reportResult = await pool.query(
      `SELECT ar.*, o.owner_admin_id AS order_owner_admin_id,
              p.name AS product_name, p.category AS product_category,
              pa.platform, pa.product_name AS account_product_name, pa.account_email,
              COALESCE(ar.owner_admin_id, o.owner_admin_id, pa.owner_admin_id, p.owner_admin_id) AS resolved_owner_admin_id
       FROM account_reports ar
       JOIN orders o ON o.id = ar.order_id
       JOIN products p ON p.id = o.product_id
       LEFT JOIN platform_accounts pa ON pa.id = COALESCE(NULLIF(ar.reported_account_id,0), NULLIF($2,0))
       WHERE ar.id = $1
       LIMIT 1`,
      [reportId, selectedAccountId]
    );

    const report = reportResult.rows[0];
    if (!report) return res.status(404).json({ error: "Reporte no encontrado" });

    const ownerAdminId = report.resolved_owner_admin_id || null;
    const platform = report.platform || report.account_product_name || report.reported_platform || report.product_name || report.product_category || "";
    const failedAccountEmail = String(report.account_email || "").trim();

    const optionsResult = await pool.query(
      `SELECT id, platform, product_name, account_email, profile_name, profile_pin, created_at
       FROM platform_accounts
       WHERE status = 'available'
         AND (
           $3::text = ''
           OR lower(regexp_replace(trim(COALESCE(account_email, '')), '\\s+', '', 'g')) <>
              lower(regexp_replace(trim($3), '\\s+', '', 'g'))
         )
         AND (
           lower(platform) = lower($1)
           OR lower(product_name) = lower($1)
           OR lower(platform) LIKE '%' || lower($1) || '%'
           OR lower($1) LIKE '%' || lower(platform) || '%'
           OR lower(product_name) LIKE '%' || lower($1) || '%'
           OR lower($1) LIKE '%' || lower(product_name) || '%'
         )
         AND (
           owner_admin_id = $2
           OR owner_admin_id IS NULL
           OR owner_admin_id = 0
           OR $2::int IS NULL
         )
       ORDER BY id ASC
       LIMIT 30`,
      [platform, ownerAdminId, failedAccountEmail]
    );

    res.json({ report_id: reportId, platform, options: optionsResult.rows });
  } catch (err) {
    console.error("Error cargando opciones de reemplazo:", err.message);
    res.status(500).json({ error: "Error cargando opciones de reemplazo" });
  }
});


// ADMIN: REEMPLAZAR CUENTA REPORTADA (CON CÁLCULO DE DÍAS RESTANTES)
app.post("/api/admin/account-reports/:reportId/replace", authMiddleware, adminMiddleware, async (req, res) => {
  const client = await pool.connect();
  let transactionStarted = false;

  try {
    const reportId = req.params.reportId;
    const {
      manual,
      account_email,
      account_password,
      profile_name,
      profile_pin,
      access_url,
      extra_data,
      official_purchase_date,
      reported_account_id,
      replacement_account_id
    } = req.body || {};

    await client.query("BEGIN");
    transactionStarted = true;

    const selectedReportedAccountId = Number(reported_account_id || 0);

    const reportResult = await client.query(
      `SELECT ar.*, o.amount, o.product_id, o.created_at AS order_created_at,
              o.owner_admin_id AS order_owner_admin_id,
              p.name AS product_name, p.category AS product_category,
              p.owner_admin_id AS product_owner_admin_id,
              pa.id AS matched_reported_account_id,
              pa.platform, pa.product_name AS account_product_name, pa.account_email,
              pa.owner_admin_id AS reported_account_owner_admin_id,
              pa.mother_account_id AS reported_mother_account_id,
              pa.official_purchase_date AS reported_official_purchase_date,
              pa.expires_at AS reported_expires_at,
              (((o.created_at AT TIME ZONE 'UTC') AT TIME ZONE 'America/Mexico_City')::date) AS warranty_purchase_date,
              ((((o.created_at AT TIME ZONE 'UTC') AT TIME ZONE 'America/Mexico_City')::date) + 28) AS warranty_expiration_date,
              COALESCE(NULLIF(ar.reported_account_id, 0), NULLIF($2::int, 0)) AS resolved_reported_account_id,
              COALESCE(ar.owner_admin_id, o.owner_admin_id, p.owner_admin_id, pa.owner_admin_id) AS resolved_owner_admin_id
       FROM account_reports ar
       JOIN orders o ON o.id = ar.order_id
       JOIN products p ON p.id = o.product_id
       LEFT JOIN platform_accounts pa
         ON pa.id = COALESCE(NULLIF(ar.reported_account_id, 0), NULLIF($2::int, 0))
        AND pa.assigned_order_id = ar.order_id
        AND pa.assigned_user_id = ar.user_id
       WHERE ar.id = $1
       FOR UPDATE OF ar, o`,
      [reportId, selectedReportedAccountId]
    );

    const report = reportResult.rows[0];

    if (!report) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Reporte no encontrado" });
    }

    if (!report.order_id) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Este reporte no está ligado a un pedido" });
    }

    if (!Number(report.resolved_reported_account_id || 0) || !Number(report.matched_reported_account_id || 0)) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "No se pudo identificar el perfil exacto reportado dentro de este pedido" });
    }

    // La garantía nunca se reinicia al reemplazar. Todos los reemplazos usan
    // la fecha original del pedido y vencen exactamente 28 días después.
    const warrantyPurchaseDate = report.warranty_purchase_date || report.reported_official_purchase_date || report.order_created_at;
    const warrantyExpirationDate = report.warranty_expiration_date || report.reported_expires_at;
    const expirationForMessage = warrantyExpirationDate ? normalizeServiceDate(warrantyExpirationDate) : null;
    const now = new Date();
    const msPerDay = 24 * 60 * 60 * 1000;
    const daysRemaining = expirationForMessage && !Number.isNaN(expirationForMessage.getTime())
      ? Math.max(0, Math.ceil((expirationForMessage.getTime() - now.getTime()) / msPerDay))
      : 0;

    const ownerAdminId = report.resolved_owner_admin_id || null;
    const failedAccountOwnerAdminId = Number(report.reported_account_owner_admin_id || 0) || null;
    const failedAccountEmail = String(report.account_email || "").trim();
    const resolvedReportedAccountId = Number(report.resolved_reported_account_id || 0);
    const replacementProductName = report.account_product_name || report.product_name || "";
    const replacementPlatform = report.platform || report.product_category || report.product_name || "";

    let newAccount = null;

    if (manual === true || manual === "true") {
      const cleanEmail = String(account_email || "").trim();
      const cleanPassword = String(account_password || "").trim();

      if (!cleanEmail || !cleanPassword) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: "Correo y contraseña de la cuenta nueva son obligatorios" });
      }

      const insertAccountResult = await client.query(
        `INSERT INTO platform_accounts
         (platform, product_name, account_email, account_password, profile_name, profile_pin,
          extra_data, access_url, status, assigned_order_id, assigned_user_id, delivered_at, owner_admin_id, expires_at, official_purchase_date)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'delivered',$9,$10,NOW(),$11,$12,$13)
         RETURNING *`,
        [
          replacementPlatform,
          replacementProductName,
          cleanEmail,
          cleanPassword,
          String(profile_name || "").trim(),
          String(profile_pin || "").trim(),
          String(extra_data || "").trim(),
          String(access_url || "").trim(),
          report.order_id,
          report.user_id,
          ownerAdminId,
          warrantyExpirationDate,
          warrantyPurchaseDate
        ]
      );

      newAccount = insertAccountResult.rows[0];
    } else {
      let availableResult;

      if (Number(replacement_account_id || 0) > 0) {
        availableResult = await client.query(
          `SELECT * FROM platform_accounts
           WHERE id = $1 AND status = 'available'
             AND (
               $4::text = ''
               OR lower(regexp_replace(trim(COALESCE(account_email, '')), '\\s+', '', 'g')) <>
                  lower(regexp_replace(trim($4), '\\s+', '', 'g'))
             )
             AND (lower(platform) = lower($2) OR lower(product_name) = lower($2) OR lower(platform) LIKE '%' || lower($2) || '%' OR lower($2) LIKE '%' || lower(platform) || '%' OR lower(product_name) LIKE '%' || lower($2) || '%' OR lower($2) LIKE '%' || lower(product_name) || '%')
             AND (owner_admin_id = $3 OR owner_admin_id IS NULL OR owner_admin_id = 0 OR $3::int IS NULL)
           LIMIT 1 FOR UPDATE`,
          [Number(replacement_account_id), replacementPlatform, ownerAdminId, failedAccountEmail]
        );
      } else {
        availableResult = await client.query(
          `SELECT * FROM platform_accounts
           WHERE status = 'available'
             AND (
               $3::text = ''
               OR lower(regexp_replace(trim(COALESCE(account_email, '')), '\\s+', '', 'g')) <>
                  lower(regexp_replace(trim($3), '\\s+', '', 'g'))
             )
             AND (lower(platform) = lower($1) OR lower(product_name) = lower($1) OR lower(platform) LIKE '%' || lower($1) || '%' OR lower($1) LIKE '%' || lower(platform) || '%' OR lower(product_name) LIKE '%' || lower($1) || '%' OR lower($1) LIKE '%' || lower(product_name) || '%')
             AND (owner_admin_id = $2 OR owner_admin_id IS NULL OR owner_admin_id = 0 OR $2::int IS NULL)
           ORDER BY id ASC LIMIT 1 FOR UPDATE SKIP LOCKED`,
          [replacementPlatform, ownerAdminId, failedAccountEmail]
        );
      }

      newAccount = availableResult.rows[0];

      if (!newAccount) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: "No hay cuenta disponible válida para esa plataforma. Puedes capturar una cuenta manual." });
      }

      const deliveredReplacementResult = await client.query(
        `UPDATE platform_accounts
         SET status = 'delivered',
             assigned_order_id = $1,
             assigned_user_id = $2,
             delivered_at = NOW(),
             expires_at = $4,
             official_purchase_date = $5
         WHERE id = $3
         RETURNING *`,
        [report.order_id, report.user_id, newAccount.id, warrantyExpirationDate, warrantyPurchaseDate]
      );
      newAccount = deliveredReplacementResult.rows[0] || newAccount;
    }
// Solo descontar stock cuando se toma una cuenta del inventario
if (!(manual === true || manual === "true")) {
  await client.query(
    `UPDATE products
     SET stock = stock - 1
     WHERE id = $1 AND stock > 0`,
    [report.product_id]
  );
}


      // ----------------------------------------------

    const failedGroupResult = await markFailedAccountEmailGroup(client, {
      reportedAccountId: resolvedReportedAccountId,
      accountEmail: failedAccountEmail,
      ownerAdminId: failedAccountOwnerAdminId
    });

    const currentDeliveryState = await getCurrentOrderDeliveryState(client, report.order_id);
    const deliveredAccountData = currentDeliveryState.deliveredAccountData;
    if (!deliveredAccountData) {
      await client.query("ROLLBACK");
      transactionStarted = false;
      return res.status(500).json({ error: "No se pudo reconstruir la entrega vigente del pedido" });
    }

    await client.query(
      `UPDATE orders
       SET assigned_platform_account_id = $1,
           delivered_account_data = $2,
           admin_response = $2,
           status = 'exito',
           owner_admin_id = COALESCE(owner_admin_id, $4)
       WHERE id = $3`,
      [newAccount.id, deliveredAccountData, report.order_id, ownerAdminId]
    );

    await client.query(
      `UPDATE account_reports
       SET reported_account_id = COALESCE(NULLIF(reported_account_id, 0), $5),
           replacement_account_id = $1,
           owner_admin_id = COALESCE(owner_admin_id, $4),
           status = 'reemplazo',
           resolution_type = 'reemplazo',
           admin_response = $2,
           reviewed_at = NOW()
       WHERE id = $3`,
      [
        newAccount.id,
        `Cuenta reemplazada correctamente (Días restantes: ${daysRemaining}).\n\n${deliveredAccountData}`,
        reportId,
        ownerAdminId,
        resolvedReportedAccountId
      ]
    );

    await client.query("COMMIT");
    transactionStarted = false;

    const baseMessage = manual === true || manual === "true"
      ? "Cuenta manual agregada y reemplazada correctamente"
      : "Cuenta reemplazada correctamente";
    const siblingMessage = failedGroupResult.availableSiblingsMarked > 0
      ? ` Se retiraron también ${failedGroupResult.availableSiblingsMarked} perfil(es) todavía disponible(s) de la misma cuenta madre y ciclo.`
      : "";

    res.json({
      message: `${baseMessage}.${siblingMessage}`.replace("correctamente..", "correctamente."),
      delivered_account_data: deliveredAccountData,
      platform_account_id: newAccount.id,
      reported_account_id: resolvedReportedAccountId,
      replacement_account_id: newAccount.id,
      failed_email_group: {
        email: failedAccountEmail,
        mother_account_id: failedGroupResult.motherAccountId || null,
        cycle_date: failedGroupResult.cycleDate || null,
        reported_account_marked: failedGroupResult.reportedAccountMarked,
        available_siblings_marked: failedGroupResult.availableSiblingsMarked,
        total_marked: failedGroupResult.totalMarked
      },
      failed_account_group: {
        mother_account_id: failedGroupResult.motherAccountId || null,
        cycle_date: failedGroupResult.cycleDate || null,
        reported_account_marked: failedGroupResult.reportedAccountMarked,
        available_siblings_marked: failedGroupResult.availableSiblingsMarked,
        total_marked: failedGroupResult.totalMarked
      }
    });
  } catch (err) {
    if (transactionStarted) {
      try { await client.query("ROLLBACK"); } catch (_) {}
    }
    console.error("Error reemplazando cuenta:", err.message);
    res.status(500).json({ error: "Error reemplazando cuenta" });
  } finally {
    client.release();
  }
});
// ADMIN: REEMBOLSO PROPORCIONAL POR DÍAS RESTANTES
app.post("/api/admin/account-reports/:reportId/refund-proportional", authMiddleware, adminMiddleware, async (req, res) => {
  const client = await pool.connect();
  let transactionStarted = false;

  try {
    const reportId = req.params.reportId;
    await client.query("BEGIN");
    transactionStarted = true;

    const reportResult = await client.query(
      `SELECT ar.*, o.amount, o.created_at AS order_created_at, o.refunded
       FROM account_reports ar
       JOIN orders o ON o.id = ar.order_id
       WHERE ar.id = $1
       FOR UPDATE`,
      [reportId]
    );

    const report = reportResult.rows[0];

    if (!report) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Reporte no encontrado" });
    }

    if (!report.order_id || !report.reported_account_id) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Este reporte no está ligado a un pedido entregado automáticamente" });
    }

    if (Number(report.refund_amount || 0) > 0 || String(report.resolution_type || "") === "reembolso" || Number(report.refunded || 0) === 1) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Este reporte o pedido ya tiene reembolso aplicado" });
    }

    const purchaseDate = new Date(report.order_created_at);
    const now = new Date();
    const msPerDay = 24 * 60 * 60 * 1000;
    const daysUsed = Math.max(0, Math.min(28, Math.ceil((now - purchaseDate) / msPerDay)));
    const daysRemaining = Math.max(0, 28 - daysUsed);
    const amountPaid = Number(report.amount || 0);
    const refundAmount = Math.round(((amountPaid / 28) * daysRemaining) * 100) / 100;

    if (refundAmount <= 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "No hay días restantes para reembolsar" });
    }

    await client.query(
      `UPDATE users SET balance = balance + $1 WHERE id = $2`,
      [refundAmount, report.user_id]
    );

    await client.query(
      `UPDATE orders SET refunded = 1 WHERE id = $1`,
      [report.order_id]
    );

    const distributorEarningsAdjustment = await recordDistributorRefundEarningAdjustment(client, {
      orderId: report.order_id,
      reportId,
      refundAmount,
      referenceKey: `refund-report:${Number(reportId)}`,
      note: `Reembolso proporcional del reporte #${Number(reportId)} · $${refundAmount.toFixed(2)}`
    });

    await markFailedAccountEmailGroup(client, {
      reportedAccountId: report.reported_account_id
    });

    await client.query(
      `UPDATE account_reports
       SET status = 'reembolso',
           resolution_type = 'reembolso',
           refund_amount = $1,
           admin_response = $2,
           reviewed_at = NOW()
       WHERE id = $3`,
      [refundAmount, `Reembolso proporcional aplicado: $${refundAmount.toFixed(2)}. Días usados: ${daysUsed}. Días restantes: ${daysRemaining}.${distributorEarningsAdjustment ? ` Ajuste de ganancia del distribuidor: $${Math.abs(Number(distributorEarningsAdjustment.adjustment_amount || 0)).toFixed(2)} (${Number(distributorEarningsAdjustment.refund_ratio || 0).toFixed(2)}%).` : ''}`, reportId]
    );

    await client.query("COMMIT");
    transactionStarted = false;

    const adjustmentValue = distributorEarningsAdjustment ? Math.abs(Number(distributorEarningsAdjustment.adjustment_amount || 0)) : 0;
    res.json({
      message: `Reembolso aplicado por $${refundAmount.toFixed(2)}${adjustmentValue > 0 ? ` · Ganancia distribuidor ajustada: -$${adjustmentValue.toFixed(2)}` : ''}`,
      refund_amount: refundAmount,
      days_used: daysUsed,
      days_remaining: daysRemaining,
      distributor_earnings_adjustment: distributorEarningsAdjustment || null
    });
  } catch (err) {
    if (transactionStarted) {
      try { await client.query("ROLLBACK"); } catch (_) {}
    }
    console.error("Error aplicando reembolso proporcional:", err.message);
    res.status(500).json({ error: "Error aplicando reembolso proporcional" });
  } finally {
    client.release();
  }
});

// ADMIN: REEMBOLSO COMPLETO (monto total pagado)
app.post("/api/admin/account-reports/:reportId/refund-full", authMiddleware, adminMiddleware, async (req, res) => {
  const client = await pool.connect();
  let transactionStarted = false;

  try {
    const reportId = req.params.reportId;
    await client.query("BEGIN");
    transactionStarted = true;

    const reportResult = await client.query(
      `SELECT ar.*, o.amount, o.created_at AS order_created_at, o.refunded
       FROM account_reports ar
       JOIN orders o ON o.id = ar.order_id
       WHERE ar.id = $1
       FOR UPDATE`,
      [reportId]
    );

    const report = reportResult.rows[0];

    if (!report) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Reporte no encontrado" });
    }

    if (!report.order_id || !report.reported_account_id) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Este reporte no está ligado a un pedido entregado automáticamente" });
    }

    if (Number(report.refund_amount || 0) > 0 || String(report.resolution_type || "") === "reembolso" || Number(report.refunded || 0) === 1) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Este reporte o pedido ya tiene reembolso aplicado" });
    }

    const amountPaid = Number(report.amount || 0);
    if (amountPaid <= 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Monto inválido para reembolso" });
    }

    // Aplicar reembolso completo
    await client.query(`UPDATE users SET balance = balance + $1 WHERE id = $2`, [amountPaid, report.user_id]);

    await client.query(`UPDATE orders SET refunded = 1 WHERE id = $1`, [report.order_id]);

    const distributorEarningsAdjustment = await recordDistributorRefundEarningAdjustment(client, {
      orderId: report.order_id,
      reportId,
      refundAmount: amountPaid,
      referenceKey: `refund-report:${Number(reportId)}`,
      note: `Reembolso completo del reporte #${Number(reportId)} · $${amountPaid.toFixed(2)}`
    });

    await markFailedAccountEmailGroup(client, {
      reportedAccountId: report.reported_account_id
    });

    await client.query(
      `UPDATE account_reports
       SET status = 'reembolso',
           resolution_type = 'reembolso',
           refund_amount = $1,
           admin_response = $2,
           reviewed_at = NOW()
       WHERE id = $3`,
      [amountPaid, `Reembolso completo aplicado: $${amountPaid.toFixed(2)}${distributorEarningsAdjustment ? ` · Ajuste de ganancia del distribuidor: $${Math.abs(Number(distributorEarningsAdjustment.adjustment_amount || 0)).toFixed(2)}` : ''}`, reportId]
    );

    await client.query("COMMIT");
    transactionStarted = false;

    const adjustmentValue = distributorEarningsAdjustment ? Math.abs(Number(distributorEarningsAdjustment.adjustment_amount || 0)) : 0;
    res.json({
      message: `Reembolso completo aplicado por $${amountPaid.toFixed(2)}${adjustmentValue > 0 ? ` · Ganancia distribuidor ajustada: -$${adjustmentValue.toFixed(2)}` : ''}`,
      refund_amount: amountPaid,
      distributor_earnings_adjustment: distributorEarningsAdjustment || null
    });
  } catch (err) {
    if (transactionStarted) {
      try { await client.query("ROLLBACK"); } catch (_) {}
    }
    console.error("Error aplicando reembolso completo:", err.message);
    res.status(500).json({ error: "Error aplicando reembolso completo" });
  } finally {
    client.release();
  }
});

// ADMIN: DAR VEREDICTO A REPORTE DE CUENTA
app.patch("/api/admin/account-reports/:reportId/status", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const reportId = req.params.reportId;
    const { status, admin_response } = req.body;

    const validStatuses = ["pendiente", "resuelto", "reemplazo", "reembolso"];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: "Veredicto inválido" });
    }

    const result = await pool.query(
      `UPDATE account_reports
       SET status = $1, admin_response = $2, reviewed_at = NOW()
       WHERE id = $3`,
      [status, admin_response || "", reportId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Reporte no encontrado" });
    }

    res.json({ message: "Veredicto guardado correctamente" });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Error actualizando reporte de cuenta" });
  }
});

// ADMIN: PEDIDOS
app.get("/api/admin/orders", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const pageRaw = Number(req.query.page || 1);
    const limitRaw = Number(req.query.limit || 50);
    const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(200, Math.floor(limitRaw)) : 50;
    const offset = (page - 1) * limit;
    const ownerId = req.isPanelAdmin ? req.user.id : null;

    const totalResult = await pool.query(
      `SELECT COUNT(*)::int AS total
       FROM orders
       WHERE ($1::int IS NULL OR orders.owner_admin_id = $1)`,
      [ownerId]
    );
    const total = Number(totalResult.rows[0]?.total || 0);
    const totalPages = Math.max(1, Math.ceil(total / limit));

    const result = await pool.query(
      `SELECT
        orders.id,
        orders.user_id,
        orders.product_id,
        orders.amount,
        orders.order_data,
        orders.status,
        orders.admin_response,
        orders.delivered_account_data,
        orders.charged,
        orders.refunded,
        orders.created_at,
        users.name AS customer_name,
        users.email AS customer_email,
        products.name AS product_name,
        products.category AS product_category,
        products.charge_mode AS charge_mode,
        products.product_type AS product_type
       FROM orders
       JOIN users ON orders.user_id = users.id
       JOIN products ON orders.product_id = products.id
       WHERE ($1::int IS NULL OR orders.owner_admin_id = $1)
       ORDER BY orders.id DESC
       LIMIT $2 OFFSET $3`,
      [ownerId, limit, offset]
    );

    res.json({
      rows: summarizeOrderRowsForList(result.rows),
      page,
      limit,
      total,
      totalPages
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Error cargando pedidos de admin" });
  }
});

app.get("/api/admin/dashboard-counts", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const ownerId = req.isPanelAdmin ? req.user.id : null;

    const [usersCount, productsCount, ordersCount, inventoryCount, reportsPendingCount, balancePendingCount] = await Promise.all([
      req.isPanelAdmin
        ? pool.query(`SELECT COUNT(*)::int AS total FROM users WHERE owner_user_id = $1`, [req.user.id])
        : pool.query(`SELECT COUNT(*)::int AS total FROM users`),
      req.isPanelAdmin
        ? pool.query(`SELECT COUNT(*)::int AS total FROM products WHERE active = 1 AND owner_admin_id = $1`, [req.user.id])
        : pool.query(`SELECT COUNT(*)::int AS total FROM products WHERE active = 1 AND (owner_admin_id IS NULL OR owner_admin_id = 0)`),
      pool.query(`SELECT COUNT(*)::int AS total FROM orders WHERE ($1::int IS NULL OR owner_admin_id = $1)`, [ownerId]),
      pool.query(`SELECT COUNT(*)::int AS total FROM platform_accounts WHERE status = 'available' AND ($1::int IS NULL AND (owner_admin_id IS NULL OR owner_admin_id = 0) OR owner_admin_id = $1)`, [ownerId]),
      pool.query(`SELECT COUNT(*)::int AS total FROM account_reports WHERE status = 'pendiente' AND ($1::int IS NULL OR owner_admin_id = $1 OR user_id = $1 OR user_id IN (SELECT id FROM users WHERE owner_user_id = $1))`, [ownerId]),
      pool.query(`SELECT COUNT(*)::int AS total FROM balance_requests WHERE status = 'pendiente' AND ($1::int IS NULL OR owner_admin_id = $1)`, [ownerId])
    ]);

    res.json({
      users: Number(usersCount.rows[0]?.total || 0),
      products: Number(productsCount.rows[0]?.total || 0),
      orders: Number(ordersCount.rows[0]?.total || 0),
      inventory: Number(inventoryCount.rows[0]?.total || 0),
      reportsPending: Number(reportsPendingCount.rows[0]?.total || 0),
      balancePending: Number(balancePendingCount.rows[0]?.total || 0)
    });
  } catch (err) {
    console.error("Error dashboard counts:", err.message);
    res.status(500).json({ error: err.message || "Error obteniendo conteos de dashboard" });
  }
});

const MINI_BANNERS_FILE = path.join(__dirname, "mini-banners.json");
let miniBannersCache = null;
let miniBannersLoadPromise = null;
let miniBannersMutationQueue = Promise.resolve();

function cloneMiniBannersList(list) {
  return (Array.isArray(list) ? list : []).map(item => ({ ...item }));
}

async function readMiniBannersFile() {
  if (miniBannersCache) return cloneMiniBannersList(miniBannersCache);
  if (miniBannersLoadPromise) return cloneMiniBannersList(await miniBannersLoadPromise);

  miniBannersLoadPromise = (async () => {
    try {
      const raw = await fsp.readFile(MINI_BANNERS_FILE, "utf8");
      const list = JSON.parse(raw);
      miniBannersCache = Array.isArray(list) ? list : [];
    } catch (e) {
      if (e?.code !== "ENOENT") {
        console.error("Error leyendo mini-banners:", e.message);
      }
      miniBannersCache = [];
    }
    return miniBannersCache;
  })();

  try {
    return cloneMiniBannersList(await miniBannersLoadPromise);
  } finally {
    miniBannersLoadPromise = null;
  }
}

async function persistMiniBannersFile(list) {
  const cleanList = cloneMiniBannersList(list);
  const tempFile = `${MINI_BANNERS_FILE}.${process.pid}.${Date.now()}.tmp`;
  await fsp.writeFile(tempFile, JSON.stringify(cleanList), "utf8");
  try {
    await fsp.rename(tempFile, MINI_BANNERS_FILE);
  } catch (err) {
    // En Windows rename no siempre reemplaza un archivo existente.
    if (["EEXIST", "EPERM", "ENOTEMPTY"].includes(err?.code)) {
      await fsp.unlink(MINI_BANNERS_FILE).catch(() => {});
      await fsp.rename(tempFile, MINI_BANNERS_FILE);
    } else {
      await fsp.unlink(tempFile).catch(() => {});
      throw err;
    }
  }
  miniBannersCache = cleanList;
}

function mutateMiniBannersFile(mutator) {
  const operation = miniBannersMutationQueue.then(async () => {
    const current = await readMiniBannersFile();
    const result = await mutator(current);
    if (!result || !Array.isArray(result.list)) {
      throw new Error("Mutación de mini banners inválida");
    }
    await persistMiniBannersFile(result.list);
    return result.value;
  });

  miniBannersMutationQueue = operation.catch(() => {});
  return operation;
}

function normalizeMiniBanner(item) {
  const id = Number(item?.id || 0);
  const image_url = String(item?.image_url || item?.image_data || "").trim();
  const title = String(item?.title || "").trim();
  const link_url = String(item?.link_url || "").trim();
  const active = item?.active === false || item?.active === 0 || item?.active === "false" ? false : true;
  const created_at = item?.created_at || new Date().toISOString();
  return { id, image_url, title, link_url, active, created_at };
}

app.get("/api/mini-banners", authMiddleware, async (req, res) => {
  try {
    // Los paneles rentados/propietarios empiezan limpios: los mini banners
    // del administrador principal NO se comparten entre tenants.
    const viewer = await getViewerContext(req.user.id);
    if (viewer?.is_panel_admin) return res.json({ banners: [] });

    const banners = (await readMiniBannersFile())
      .map(normalizeMiniBanner)
      .filter(b => b.id > 0 && b.image_url && b.active)
      .sort((a, b) => b.id - a.id);
    res.json({ banners });
  } catch (err) {
    console.error("Error cargando mini-banners:", err.message);
    res.status(500).json({ error: "Error cargando mini-banners" });
  }
});

app.get("/api/admin/mini-banners", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    // Hasta que exista almacenamiento de banners por tenant, no exponemos
    // los banners globales al administrador de un panel rentado.
    if (req.isPanelAdmin) return res.json({ banners: [] });

    const includeImages = String(req.query.with_images || "0") === "1";
    const banners = (await readMiniBannersFile())
      .map(normalizeMiniBanner)
      .filter(b => b.id > 0 && b.image_url)
      .map(b => {
        const rawImage = String(b.image_url || "");
        const isDataUrl = /^data:image\//i.test(rawImage);
        return {
          id: b.id,
          title: b.title,
          link_url: b.link_url,
          active: b.active,
          created_at: b.created_at,
          has_image: !!rawImage,
          image_url: includeImages ? rawImage : (isDataUrl ? "" : rawImage)
        };
      })
      .sort((a, b) => b.id - a.id);
    res.json({ banners });
  } catch (err) {
    console.error("Error cargando mini-banners admin:", err.message);
    res.status(500).json({ error: "Error cargando mini-banners" });
  }
});

app.post("/api/admin/mini-banners", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const imageData = String(req.body?.image_data || req.body?.image_url || "").trim();
    const title = String(req.body?.title || "").trim();
    const linkUrl = String(req.body?.link_url || "").trim();
    const active = !(req.body?.active === false || req.body?.active === 0 || req.body?.active === "false");

    if (!imageData) {
      return res.status(400).json({ error: "La imagen del banner es obligatoria" });
    }

    if (!/^data:image\/(png|jpe?g|webp|gif);base64,/i.test(imageData) && !/^https?:\/\//i.test(imageData)) {
      return res.status(400).json({ error: "Formato de imagen inválido" });
    }

    if (/^data:image\//i.test(imageData) && imageData.length > 1_500_000) {
      return res.status(400).json({ error: "La imagen es demasiado grande. Usa una imagen menor a 1 MB." });
    }

    const banner = await mutateMiniBannersFile(currentRaw => {
      const current = currentRaw.map(normalizeMiniBanner);
      const nextId = current.reduce((max, b) => Math.max(max, Number(b.id || 0)), 0) + 1;
      const created = {
        id: nextId,
        image_url: imageData,
        title,
        link_url: linkUrl,
        active,
        created_at: new Date().toISOString()
      };
      current.push(created);
      return { list: current, value: created };
    });

    res.json({ message: "Mini banner guardado", banner });
  } catch (err) {
    console.error("Error guardando mini-banner:", err.message);
    res.status(500).json({ error: "Error guardando mini-banner" });
  }
});

app.patch("/api/admin/mini-banners/:id", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const id = Number(req.params.id || 0);
    if (!id) return res.status(400).json({ error: "ID inválido" });

    const updatedBanner = await mutateMiniBannersFile(currentRaw => {
      const list = currentRaw.map(normalizeMiniBanner);
      const idx = list.findIndex(b => Number(b.id) === id);
      if (idx < 0) {
        const error = new Error("Banner no encontrado");
        error.statusCode = 404;
        throw error;
      }

      const next = { ...list[idx] };
      if (req.body?.title !== undefined) next.title = String(req.body.title || "").trim();
      if (req.body?.link_url !== undefined) next.link_url = String(req.body.link_url || "").trim();
      if (req.body?.active !== undefined) next.active = !(req.body.active === false || req.body.active === 0 || req.body.active === "false");

      list[idx] = normalizeMiniBanner(next);
      return { list, value: list[idx] };
    });

    res.json({ message: "Mini banner actualizado", banner: updatedBanner });
  } catch (err) {
    if (err?.statusCode === 404) return res.status(404).json({ error: err.message });
    console.error("Error actualizando mini-banner:", err.message);
    res.status(500).json({ error: "Error actualizando mini-banner" });
  }
});

app.delete("/api/admin/mini-banners/:id", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const id = Number(req.params.id || 0);
    if (!id) return res.status(400).json({ error: "ID inválido" });

    await mutateMiniBannersFile(currentRaw => {
      const list = currentRaw.map(normalizeMiniBanner);
      const next = list.filter(b => Number(b.id) !== id);
      if (next.length === list.length) {
        const error = new Error("Banner no encontrado");
        error.statusCode = 404;
        throw error;
      }
      return { list: next, value: true };
    });

    res.json({ message: "Mini banner eliminado" });
  } catch (err) {
    if (err?.statusCode === 404) return res.status(404).json({ error: err.message });
    console.error("Error eliminando mini-banner:", err.message);
    res.status(500).json({ error: "Error eliminando mini-banner" });
  }
});

// ADMIN: ACTUALIZAR PEDIDO
app.patch("/api/admin/orders/:orderId/status", authMiddleware, adminMiddleware, async (req, res) => {
  const client = await pool.connect();

  try {
    const orderId = req.params.orderId;
    const { status, response_message, refund_if_rejected, manual_account } = req.body;

    const validStatuses = ["accion_en_espera", "en_proceso", "exito", "rechazado"];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: "Estado inválido" });
    }

    await client.query("BEGIN");

    const orderResult = await client.query(
      `SELECT
        orders.*,
        products.charge_mode AS charge_mode,
        products.product_type AS product_type
       FROM orders
       JOIN products ON orders.product_id = products.id
       WHERE orders.id = $1
       FOR UPDATE`,
      [orderId]
    );

    const order = orderResult.rows[0];

    if (!order) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Pedido no encontrado" });
    }

    const userResult = await client.query(
      `SELECT id, name, email, balance FROM users WHERE id = $1 FOR UPDATE`,
      [order.user_id]
    );

    const user = userResult.rows[0];

    if (!user) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    const amount = Number(order.amount);
    const charged = Number(order.charged || 0);
    const refunded = Number(order.refunded || 0);
    const balance = Number(user.balance);

    const shouldChargeOnSuccess =
      status === "exito" &&
      charged === 0;

    if (shouldChargeOnSuccess && balance < amount) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        error: `No se puede marcar Éxito. El cliente no tiene saldo suficiente. Saldo: $${balance.toFixed(2)}, costo: $${amount.toFixed(2)}`
      });
    }

    const shouldRefund =
      status === "rechazado" &&
      refund_if_rejected === true &&
      charged === 1 &&
      refunded === 0;

    if (shouldChargeOnSuccess) {
      await client.query(
        `UPDATE users SET balance = balance - $1 WHERE id = $2`,
        [amount, order.user_id]
      );

      await client.query(
        `UPDATE orders SET charged = 1 WHERE id = $1`,
        [orderId]
      );
    }

    if (shouldRefund) {
      await client.query(
        `UPDATE users SET balance = balance + $1 WHERE id = $2`,
        [amount, order.user_id]
      );

      await client.query(
        `UPDATE orders SET refunded = 1 WHERE id = $1`,
        [orderId]
      );

      await recordDistributorRefundEarningAdjustment(client, {
        orderId,
        refundAmount: amount,
        referenceKey: `refund-order:${Number(orderId)}`,
        note: `Reembolso completo por pedido rechazado #${Number(orderId)}`
      });
    }

    let finalResponseMessage = response_message || "";
    let deliveredAccountDataToSave = null;

    // Cuando el admin marca Éxito en un pedido manual, puede registrar la cuenta
    // entregada en platform_accounts para que después el usuario pueda reportarla
    // como cualquier cuenta automática.
    if (
      status === "exito" &&
      String(order.product_type || "").toLowerCase() === "manual" &&
      manual_account &&
      String(manual_account.account_email || "").trim() &&
      String(manual_account.account_password || "").trim()
    ) {
      const selectedProductId = Number(manual_account.product_id || manual_account.platform_product_id || order.product_id);
      const platformProductResult = await client.query(
        `SELECT id, name, category FROM products WHERE id = $1 AND ($2::int IS NULL OR owner_admin_id = $2)`,
        [selectedProductId, req.isPanelAdmin ? req.user.id : null]
      );

      const platformProduct = platformProductResult.rows[0];

      if (!platformProduct) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: "Selecciona una plataforma válida para registrar la cuenta manual." });
      }

      const accountEmail = String(manual_account.account_email || "").trim();
      const accountPassword = String(manual_account.account_password || "").trim();
      const profileName = String(manual_account.profile_name || "").trim();
      const profilePin = String(manual_account.profile_pin || "").trim();
      const accessUrl = String(manual_account.access_url || "").trim();
      const extraData = String(manual_account.extra_data || "").trim();

      const existingAccountResult = await client.query(
        `SELECT id FROM platform_accounts WHERE assigned_order_id = $1 ORDER BY id DESC LIMIT 1`,
        [orderId]
      );

      let platformAccountId;

      if (existingAccountResult.rows[0]) {
        platformAccountId = existingAccountResult.rows[0].id;
        await client.query(
          `UPDATE platform_accounts
           SET platform = $1,
               product_name = $2,
               account_email = $3,
               account_password = $4,
               profile_name = $5,
               profile_pin = $6,
               access_url = $7,
               extra_data = $8,
               status = 'delivered',
               assigned_order_id = $9,
               assigned_user_id = $10,
               delivered_at = COALESCE(delivered_at, NOW())
           WHERE id = $11`,
          [
            platformProduct.name,
            platformProduct.name,
            accountEmail,
            accountPassword,
            profileName,
            profilePin,
            accessUrl,
            extraData,
            orderId,
            order.user_id,
            platformAccountId
          ]
        );
      } else {
        const insertedAccountResult = await client.query(
          `INSERT INTO platform_accounts
           (platform, product_name, account_email, account_password, profile_name, profile_pin, extra_data, terms_conditions, access_url, status, assigned_order_id, assigned_user_id, delivered_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, '', $8, 'delivered', $9, $10, NOW())
           RETURNING id`,
          [
            platformProduct.name,
            platformProduct.name,
            accountEmail,
            accountPassword,
            profileName,
            profilePin,
            extraData,
            accessUrl,
            orderId,
            order.user_id
          ]
        );
        platformAccountId = insertedAccountResult.rows[0].id;
      }

      deliveredAccountDataToSave = buildDeliveredAccountData(
        {
          platform: platformProduct.name,
          product_name: platformProduct.name,
          account_email: accountEmail,
          account_password: accountPassword,
          profile_name: profileName,
          profile_pin: profilePin,
          access_url: accessUrl
        },
        platformProduct.name,
        platformProduct.category || platformProduct.name
      );

      finalResponseMessage = deliveredAccountDataToSave;

      await client.query(
        `UPDATE orders
         SET assigned_platform_account_id = $1,
             delivered_account_data = $2
         WHERE id = $3`,
        [platformAccountId, deliveredAccountDataToSave, orderId]
      );
    }

    await client.query(
      `UPDATE orders
       SET status = $1,
           admin_response = $2,
           delivered_account_data = COALESCE($4, delivered_account_data)
       WHERE id = $3`,
      [status, finalResponseMessage, orderId, deliveredAccountDataToSave]
    );

    if (status === "exito") {
      await ensureDistributorSaleEarningForOrder(client, orderId);
    }

    await client.query("COMMIT");

    if (shouldChargeOnSuccess) {
      return res.json({
        message: `Pedido actualizado correctamente. Se descontaron $${amount.toFixed(2)} del saldo del cliente.`
      });
    }

    if (shouldRefund) {
      return res.json({
        message: `Pedido actualizado correctamente. Se devolvieron $${amount.toFixed(2)} al cliente.`
      });
    }

    res.json({ message: "Pedido actualizado correctamente" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err.message);
    res.status(500).json({ error: "Error actualizando pedido" });
  } finally {
    client.release();
  }
});






// ADMIN: activar/desactivar usuario como admin independiente
app.patch("/api/admin/users/:userId/subadmin", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    const isSubadmin = req.body.is_subadmin === true;

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ error: "Usuario inválido" });
    }

    const targetResult = await pool.query(
      `SELECT u.id, u.name, u.email, u.role, u.owner_user_id,
              owner.name AS owner_name,
              own_panel.id AS owner_panel_id,
              own_panel.business_name AS owner_panel_name,
              ap.id AS target_panel_id
       FROM users u
       LEFT JOIN users owner ON owner.id = u.owner_user_id
       LEFT JOIN admin_panels own_panel ON own_panel.owner_user_id = owner.id
       LEFT JOIN admin_panels ap ON ap.owner_user_id = u.id
       WHERE u.id = $1
       LIMIT 1`,
      [userId]
    );

    const target = targetResult.rows[0];
    if (!target || target.role === "admin" || target.target_panel_id) {
      return res.status(404).json({ error: "Usuario no encontrado o no se puede modificar" });
    }

    // Si quien modifica es Panel propietario, solo puede convertir/desactivar a sus propios vendedores.
    if (req.isPanelAdmin && Number(target.owner_user_id || 0) !== Number(req.user.id)) {
      return res.status(403).json({ error: "Solo puedes modificar vendedores de tu propio panel" });
    }

    const result = await pool.query(
      `UPDATE users SET is_subadmin = $1 WHERE id = $2 AND role <> 'admin'
       RETURNING id, name, email, role, balance, COALESCE(is_subadmin, false) AS is_subadmin, owner_user_id`,
      [isSubadmin, userId]
    );

    const isPanelSeller = Boolean(target.owner_panel_id);
    const label = isPanelSeller ? "distribuidor del panel" : "admin distribuidor";
    res.json({
      message: isSubadmin ? `Usuario convertido en ${label}` : `${label.charAt(0).toUpperCase() + label.slice(1)} desactivado`,
      user: result.rows[0]
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Error actualizando distribuidor" });
  }
});

// ADMIN: precios que tú le das a un admin independiente
// ADMIN: precios que tú le das a un admin independiente
app.get("/api/admin/subadmin-prices/:userId", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const userId = req.params.userId;

    const result = await pool.query(
      `SELECT
         products.id AS product_id,
         products.name,
         products.category,
         products.price AS general_price,
         products.cost_price,
         COALESCE(user_product_prices.sale_price, products.price) AS sale_price
       FROM products
       LEFT JOIN user_product_prices
         ON user_product_prices.product_id = products.id
        AND user_product_prices.user_id = $1
       WHERE products.active = 1
       ORDER BY products.category ASC, products.name ASC`,
      [userId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Error cargando precios del admin independiente" });
  }
});

app.patch("/api/admin/subadmin-prices", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { user_id, product_id, sale_price } = req.body;
    const priceNumber = Number(sale_price);

    if (!user_id || !product_id || !priceNumber || priceNumber <= 0) {
      return res.status(400).json({ error: "Usuario, producto y precio válido son obligatorios" });
    }

    const updateResult = await pool.query(
      `UPDATE user_product_prices
       SET sale_price = $3, updated_at = NOW()
       WHERE user_id = $1 AND product_id = $2`,
      [user_id, product_id, priceNumber]
    );

    if (updateResult.rowCount === 0) {
      await pool.query(
        `INSERT INTO user_product_prices (user_id, product_id, sale_price, created_at, updated_at)
         VALUES ($1, $2, $3, NOW(), NOW())`,
        [user_id, product_id, priceNumber]
      );
    }

    res.json({ message: "Precio del admin independiente actualizado" });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Error guardando precio" });
  }
});

// DISTRIBUIDOR: vendedores y precios para vendedores
app.get("/api/distributor/resellers", authMiddleware, distributorMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         u.id,
         u.name,
         u.email,
         u.role,
         u.balance,
         u.owner_user_id,
         u.created_at,
         COALESCE(u.is_enabled, TRUE) AS is_enabled,
         activity.last_activity_at,
         COALESCE(activity.movements_2m, 0)::int AS movements_2m,
         CASE
           WHEN activity.last_activity_at IS NULL THEN TRUE
           WHEN activity.last_activity_at < NOW() - INTERVAL '2 months' THEN TRUE
           ELSE FALSE
         END AS inactive_2m
       FROM users u
       LEFT JOIN LATERAL (
         SELECT
           MAX(m.ts) AS last_activity_at,
           COUNT(*) FILTER (WHERE m.ts >= NOW() - INTERVAL '2 months')::int AS movements_2m
         FROM (
           SELECT o.created_at AS ts FROM orders o WHERE o.user_id = u.id
           UNION ALL
           SELECT br.created_at AS ts FROM balance_requests br WHERE br.user_id = u.id
           UNION ALL
           SELECT ar.created_at AS ts FROM account_reports ar WHERE ar.user_id = u.id
         ) m
       ) activity ON TRUE
       WHERE u.owner_user_id = $1
       ORDER BY COALESCE(activity.last_activity_at, u.created_at) DESC, u.id DESC`,
      [req.user.id]
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Error cargando vendedores" });
  }
});

app.post("/api/distributor/resellers", authMiddleware, distributorMiddleware, async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const cleanName = String(name || "").trim();
    const cleanEmail = String(email || "").trim().toLowerCase();

    if (!cleanName || !cleanEmail || !password) {
      return res.status(400).json({ error: "Nombre, correo y contraseña son obligatorios" });
    }

    if (String(password).length < 6) {
      return res.status(400).json({ error: "La contraseña debe tener mínimo 6 caracteres" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Si el correo ya existe, no lo duplicamos. Lo validamos y, si pertenece al mismo panel,
    // actualizamos su acceso para que pueda iniciar sesión correctamente.
    const existing = await pool.query(
      `SELECT id, name, email, owner_user_id
       FROM users
       WHERE lower(trim(email)) = lower($1)
       LIMIT 1`,
      [cleanEmail]
    );

    let user;

    if (existing.rows[0]) {
      const existingUser = existing.rows[0];

      if (existingUser.owner_user_id && Number(existingUser.owner_user_id) !== Number(req.user.id)) {
        return res.status(400).json({ error: "Ese correo ya pertenece a otro panel" });
      }

      const updated = await pool.query(
        `UPDATE users
         SET name = $1,
             email = $5,
             password = $2,
             role = 'user',
             owner_user_id = $3,
             is_subadmin = FALSE,
             is_enabled = TRUE
         WHERE id = $4
         RETURNING id, name, email, role, balance, owner_user_id, COALESCE(is_enabled, TRUE) AS is_enabled`,
        [cleanName, hashedPassword, req.user.id, existingUser.id, cleanEmail]
      );

      user = updated.rows[0];
      return res.json({ message: "Vendedor actualizado y acceso habilitado correctamente", user });
    }

    const result = await pool.query(
      `INSERT INTO users (name, email, password, role, balance, owner_user_id, is_subadmin, is_enabled)
       VALUES ($1, $2, $3, 'user', 0, $4, FALSE, TRUE)
       RETURNING id, name, email, role, balance, owner_user_id, COALESCE(is_enabled, TRUE) AS is_enabled`,
      [cleanName, cleanEmail, hashedPassword, req.user.id]
    );

    user = result.rows[0];
    res.json({ message: "Vendedor creado correctamente y acceso de login habilitado", user });
  } catch (err) {
    console.error("Error creando vendedor:", err.message);
    res.status(400).json({ error: "No se pudo crear vendedor. Revisa si el correo ya existe." });
  }
});


app.delete("/api/distributor/resellers/:id", authMiddleware, distributorMiddleware, async (req, res) => {
  const client = await pool.connect();
  try {
    const resellerId = Number(req.params.id);

    if (!resellerId) {
      return res.status(400).json({ error: "ID de vendedor inválido" });
    }

    await client.query("BEGIN");

    const sellerResult = await client.query(
      `SELECT id, name, email, owner_user_id
       FROM users
       WHERE id = $1 AND owner_user_id = $2
       LIMIT 1`,
      [resellerId, req.user.id]
    );

    const seller = sellerResult.rows[0];
    if (!seller) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Vendedor no encontrado en tu panel" });
    }

    const usage = await client.query(
      `SELECT
         (SELECT COUNT(*)::int FROM orders WHERE user_id = $1) AS orders_count,
         (SELECT COUNT(*)::int FROM balance_requests WHERE user_id = $1) AS balance_count,
         (SELECT COUNT(*)::int FROM account_reports WHERE user_id = $1) AS reports_count`,
      [resellerId]
    );

    const counts = usage.rows[0] || {};
    const hasMovements = Number(counts.orders_count || 0) > 0 || Number(counts.balance_count || 0) > 0 || Number(counts.reports_count || 0) > 0;

    if (hasMovements) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        error: "No se puede eliminar porque este vendedor ya tiene pedidos, solicitudes de saldo o reportes. Así se evita perder historial."
      });
    }

    await client.query(`DELETE FROM subadmin_reseller_prices WHERE owner_user_id = $1`, [resellerId]);
    await client.query(`DELETE FROM user_product_prices WHERE user_id = $1`, [resellerId]);
    await client.query(`DELETE FROM users WHERE id = $1 AND owner_user_id = $2`, [resellerId, req.user.id]);

    await client.query("COMMIT");
    res.json({ message: "Vendedor eliminado correctamente" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error eliminando vendedor:", err.message);
    res.status(500).json({ error: "Error eliminando vendedor" });
  } finally {
    client.release();
  }
});

app.post("/api/distributor/resellers/:id/reset-access", authMiddleware, distributorMiddleware, async (req, res) => {
  try {
    const resellerId = Number(req.params.id);
    const { password } = req.body;

    if (!resellerId || !password || String(password).length < 6) {
      return res.status(400).json({ error: "ID y contraseña mínima de 6 caracteres son obligatorios" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `UPDATE users
       SET email = lower(trim(email)),
           password = $1,
           role = 'user',
           owner_user_id = $2,
           is_subadmin = FALSE,
           is_enabled = TRUE
       WHERE id = $3
         AND (owner_user_id = $2 OR owner_user_id IS NULL OR owner_user_id = 0)
       RETURNING id, name, email, role, balance, owner_user_id, COALESCE(is_enabled, TRUE) AS is_enabled`,
      [hashedPassword, req.user.id, resellerId]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ error: "Vendedor no encontrado en tu panel" });
    }

    res.json({ message: "Acceso del vendedor reparado correctamente", user: result.rows[0] });
  } catch (err) {
    console.error("Error reparando acceso de vendedor:", err.message);
    res.status(500).json({ error: "Error reparando acceso del vendedor" });
  }
});



// Repara acceso por correo exacto desde el panel independiente.
// Útil cuando el vendedor fue creado antes pero no quedó ligado correctamente.
app.post("/api/distributor/resellers/repair-by-email", authMiddleware, distributorMiddleware, async (req, res) => {
  try {
    const cleanEmail = String(req.body.email || "").trim().toLowerCase();
    const cleanName = String(req.body.name || "").trim() || cleanEmail;
    const password = String(req.body.password || "");

    if (!cleanEmail || !password || password.length < 6) {
      return res.status(400).json({ error: "Correo y contraseña mínima de 6 caracteres son obligatorios" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const existing = await pool.query(
      `SELECT id, owner_user_id
       FROM users
       WHERE lower(regexp_replace(trim(email), '\s+', '', 'g')) = lower(regexp_replace($1, '\s+', '', 'g'))
       ORDER BY id DESC
       LIMIT 1`,
      [cleanEmail]
    );

    let result;

    if (existing.rows[0]) {
      const existingUser = existing.rows[0];
      if (existingUser.owner_user_id && Number(existingUser.owner_user_id) !== Number(req.user.id)) {
        return res.status(400).json({ error: "Ese correo ya pertenece a otro panel" });
      }
      result = await pool.query(
        `UPDATE users
         SET name = $1,
             email = $2,
             password = $3,
             role = 'user',
             owner_user_id = $4,
             is_subadmin = FALSE,
             is_enabled = TRUE
         WHERE id = $5
         RETURNING id, name, email, role, balance, owner_user_id, COALESCE(is_enabled, TRUE) AS is_enabled`,
        [cleanName, cleanEmail, hashedPassword, req.user.id, existingUser.id]
      );
    } else {
      result = await pool.query(
        `INSERT INTO users (name, email, password, role, balance, owner_user_id, is_subadmin, is_enabled)
         VALUES ($1, $2, $3, 'user', 0, $4, FALSE, TRUE)
         RETURNING id, name, email, role, balance, owner_user_id, COALESCE(is_enabled, TRUE) AS is_enabled`,
        [cleanName, cleanEmail, hashedPassword, req.user.id]
      );
    }

    res.json({ message: "Acceso reparado correctamente. Ya puede iniciar sesión con esa contraseña.", user: result.rows[0] });
  } catch (err) {
    console.error("Error reparando acceso por correo:", err.message);
    res.status(500).json({ error: "Error reparando acceso por correo" });
  }
});

app.patch("/api/distributor/resellers/:id/status", authMiddleware, distributorMiddleware, async (req, res) => {
  try {
    const resellerId = Number(req.params.id);
    const { enabled } = req.body;

    if (!resellerId || typeof enabled !== "boolean") {
      return res.status(400).json({ error: "ID y estado habilitado son obligatorios" });
    }

    const result = await pool.query(
      `UPDATE users
       SET is_enabled = $1
       WHERE id = $2 AND owner_user_id = $3
       RETURNING id, name, email, COALESCE(is_enabled, TRUE) AS is_enabled`,
      [enabled, resellerId, req.user.id]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ error: "Vendedor no encontrado en tu panel" });
    }

    res.json({ message: enabled ? "Vendedor habilitado correctamente" : "Vendedor deshabilitado correctamente", user: result.rows[0] });
  } catch (err) {
    console.error("Error cambiando estado de vendedor:", err.message);
    res.status(500).json({ error: "Error cambiando estado del vendedor" });
  }
});

app.post("/api/distributor/resellers/disable-inactive", authMiddleware, distributorMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE users u
       SET is_enabled = FALSE
       WHERE u.owner_user_id = $1
         AND COALESCE(u.is_enabled, TRUE) = TRUE
         AND NOT EXISTS (
           SELECT 1
           FROM (
             SELECT o.created_at AS ts FROM orders o WHERE o.user_id = u.id AND o.created_at >= NOW() - INTERVAL '2 months'
             UNION ALL
             SELECT br.created_at AS ts FROM balance_requests br WHERE br.user_id = u.id AND br.created_at >= NOW() - INTERVAL '2 months'
             UNION ALL
             SELECT ar.created_at AS ts FROM account_reports ar WHERE ar.user_id = u.id AND ar.created_at >= NOW() - INTERVAL '2 months'
           ) mov
         )
       RETURNING u.id`,
      [req.user.id]
    );

    res.json({ message: `Se deshabilitaron ${result.rowCount || 0} vendedores sin movimientos en los últimos 2 meses`, affected: Number(result.rowCount || 0) });
  } catch (err) {
    console.error("Error deshabilitando vendedores inactivos:", err.message);
    res.status(500).json({ error: "Error deshabilitando vendedores inactivos" });
  }
});

app.get("/api/distributor/prices", authMiddleware, distributorMiddleware, async (req, res) => {
  try {
    const viewer = await getViewerContext(req.user.id);

    // Si es panel vendido/rentado: solo sus productos propios.
    if (viewer && viewer.is_panel_admin) {
      const result = await pool.query(
        `SELECT
           products.id AS product_id,
           products.name,
           products.category,
           products.price AS general_price,
           COALESCE(products.cost_price, products.price, 0) AS owner_price,
           COALESCE(subadmin_reseller_prices.sale_price, products.price) AS reseller_price
         FROM products
         LEFT JOIN subadmin_reseller_prices
           ON subadmin_reseller_prices.product_id = products.id
          AND subadmin_reseller_prices.owner_user_id = $1
         WHERE products.active = 1
           AND products.owner_admin_id = $1
         ORDER BY products.category ASC, products.name ASC`,
        [req.user.id]
      );
      return res.json(result.rows);
    }

    // Si es usuario convertido a distribuidor independiente: depende del admin global.
    // Ve productos globales y los precios especiales que el admin principal le asignó.
    const result = await pool.query(
      `SELECT
         products.id AS product_id,
         products.name,
         products.category,
         products.price AS general_price,
         COALESCE(user_product_prices.sale_price, products.price) AS owner_price,
         COALESCE(subadmin_reseller_prices.sale_price, user_product_prices.sale_price, products.price) AS reseller_price
       FROM products
       LEFT JOIN user_product_prices
         ON user_product_prices.product_id = products.id
        AND user_product_prices.user_id = $1
       LEFT JOIN subadmin_reseller_prices
         ON subadmin_reseller_prices.product_id = products.id
        AND subadmin_reseller_prices.owner_user_id = $1
       WHERE products.active = 1
         AND (products.owner_admin_id IS NULL OR products.owner_admin_id = 0)
       ORDER BY products.category ASC, products.name ASC`,
      [req.user.id]
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Error cargando precios para vendedores" });
  }
});

app.patch("/api/distributor/prices", authMiddleware, distributorMiddleware, async (req, res) => {
  try {
    const { product_id, sale_price } = req.body;
    const priceNumber = Number(sale_price);

    if (!product_id || !priceNumber || priceNumber <= 0) {
      return res.status(400).json({ error: "Producto y precio válido son obligatorios" });
    }

    const viewer = await getViewerContext(req.user.id);
    const productParams = viewer?.is_panel_admin ? [product_id, req.user.id] : [product_id];
    const productWhere = viewer?.is_panel_admin
      ? `id = $1 AND active = 1 AND owner_admin_id = $2`
      : `id = $1 AND active = 1 AND (owner_admin_id IS NULL OR owner_admin_id = 0)`;

    const productCheck = await pool.query(`SELECT id FROM products WHERE ${productWhere} LIMIT 1`, productParams);
    if (!productCheck.rows.length) {
      return res.status(404).json({ error: "Producto no disponible para este panel" });
    }

    const updateResult = await pool.query(
      `UPDATE subadmin_reseller_prices
       SET sale_price = $3, updated_at = NOW()
       WHERE owner_user_id = $1 AND product_id = $2`,
      [req.user.id, product_id, priceNumber]
    );

    if (updateResult.rowCount === 0) {
      await pool.query(
        `INSERT INTO subadmin_reseller_prices (owner_user_id, product_id, sale_price, created_at, updated_at)
         VALUES ($1, $2, $3, NOW(), NOW())`,
        [req.user.id, product_id, priceNumber]
      );
    }

    res.json({ message: "Precio para vendedores actualizado" });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Error guardando precio para vendedores" });
  }
});

// DISTRIBUIDOR: REPORTE DE GANANCIAS DE SUS VENDEDORES
app.get("/api/distributor/earnings", authMiddleware, distributorMiddleware, async (req, res) => {
  try {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    const defaultsResult = await pool.query(
      `SELECT
         date_trunc('month', NOW() AT TIME ZONE 'America/Mexico_City')::date::text AS month_start,
         (NOW() AT TIME ZONE 'America/Mexico_City')::date::text AS today`
    );

    const defaults = defaultsResult.rows[0] || {};
    const requestedStart = String(req.query.start_date || '').trim();
    const requestedEnd = String(req.query.end_date || '').trim();
    const startDate = dateRegex.test(requestedStart) ? requestedStart : defaults.month_start;
    const endDate = dateRegex.test(requestedEnd) ? requestedEnd : defaults.today;

    if (!startDate || !endDate || startDate > endDate) {
      return res.status(400).json({ error: 'El rango de fechas no es válido' });
    }

    const rangeResult = await pool.query(
      `SELECT ($2::date - $1::date)::int AS total_days`,
      [startDate, endDate]
    );
    if (Number(rangeResult.rows[0]?.total_days || 0) > 366) {
      return res.status(400).json({ error: 'Selecciona un rango máximo de 366 días' });
    }

    const distributor = await getFullUser(req.user.id);
    if (!distributor || distributor.is_subadmin !== true) {
      return res.status(403).json({ error: 'Distribuidor requerido' });
    }

    // Inicializa el historial anterior a esta versión una sola vez. Después, cada venta
    // y reembolso se registra al momento de ocurrir.
    const wallet = await getDistributorEarningsWallet(pool, req.user.id, 80);

    const ordersResult = await pool.query(
      `SELECT
         o.id,
         o.user_id,
         o.product_id,
         o.amount,
         o.refunded,
         o.distributor_cost_snapshot,
         sale_ledger.distributor_cost AS ledger_distributor_cost,
         o.product_name_snapshot,
         o.product_category_snapshot,
         o.created_at,
         u.name AS seller_name,
         u.email AS seller_email,
         p.name,
         p.category,
         p.price,
         p.cost_price,
         p.product_type,
         p.combo_items,
         p.combo_discount,
         p.owner_admin_id,
         CASE WHEN COALESCE(refunds.refund_amount, 0) > 0 THEN refunds.refund_amount WHEN COALESCE(o.refunded, 0) = 1 THEN o.amount ELSE 0 END AS refund_amount_total,
         to_char(((o.created_at AT TIME ZONE 'UTC') AT TIME ZONE 'America/Mexico_City'), 'DD/MM/YYYY HH24:MI:SS') AS created_at_mx
       FROM orders o
       INNER JOIN users u ON u.id = o.user_id
       INNER JOIN products p ON p.id = o.product_id
       LEFT JOIN distributor_earnings_ledger sale_ledger
         ON sale_ledger.order_id = o.id
        AND sale_ledger.movement_type = 'venta'
       LEFT JOIN LATERAL (
         SELECT COALESCE(SUM(ar.refund_amount), 0) AS refund_amount
         FROM account_reports ar
         WHERE ar.order_id = o.id
           AND COALESCE(ar.refund_amount, 0) > 0
           AND lower(COALESCE(ar.resolution_type, '')) = 'reembolso'
       ) refunds ON TRUE
       WHERE u.owner_user_id = $1
         AND o.status = 'exito'
         AND ((o.created_at AT TIME ZONE 'UTC') AT TIME ZONE 'America/Mexico_City')::date >= $2::date
         AND ((o.created_at AT TIME ZONE 'UTC') AT TIME ZONE 'America/Mexico_City')::date <= $3::date
       ORDER BY o.created_at DESC, o.id DESC`,
      [req.user.id, startDate, endDate]
    );

    const currentCostCache = new Map();
    const details = [];
    const sellerMap = new Map();
    const productMap = new Map();
    let grossSales = 0;
    let totalRefunds = 0;
    let totalSales = 0;
    let totalCost = 0;
    let totalProfit = 0;
    let refundedOrders = 0;
    let estimatedCostOrders = 0;

    for (const row of ordersResult.rows) {
      const grossSaleAmount = Math.max(0, roundMoney(row.amount));
      let distributorCost = row.distributor_cost_snapshot === null || row.distributor_cost_snapshot === undefined
        ? null
        : Number(row.distributor_cost_snapshot);
      let costSource = 'snapshot';

      if (!Number.isFinite(distributorCost) && row.ledger_distributor_cost !== null && row.ledger_distributor_cost !== undefined) {
        distributorCost = Number(row.ledger_distributor_cost);
        costSource = 'historial_ganancias';
      }

      if (!Number.isFinite(distributorCost)) {
        const productId = Number(row.product_id || 0);
        if (!currentCostCache.has(productId)) {
          const currentCost = normalizeProductType(row.product_type) === 'combo_auto'
            ? await calculateComboPrice(pool, distributor, row)
            : await getEffectiveProductPrice(pool, distributor, row);
          currentCostCache.set(productId, Math.max(0, Number(currentCost || 0)));
        }
        distributorCost = currentCostCache.get(productId) || 0;
        costSource = 'precio_actual';
        estimatedCostOrders += 1;
      }

      distributorCost = Math.max(0, roundMoney(distributorCost));
      const refundAmount = Math.max(0, Math.min(grossSaleAmount, roundMoney(row.refund_amount_total)));
      const refundRatio = grossSaleAmount > 0 ? Math.max(0, Math.min(1, refundAmount / grossSaleAmount)) : 0;
      const netSaleAmount = roundMoney(grossSaleAmount - refundAmount);
      const netDistributorCost = roundMoney(distributorCost * (1 - refundRatio));
      const originalProfit = roundMoney(grossSaleAmount - distributorCost);
      const profitAdjustment = roundMoney(originalProfit * refundRatio);
      const profit = roundMoney(originalProfit - profitAdjustment);
      const productName = String(row.product_name_snapshot || row.name || 'Producto').trim();
      const productCategory = String(row.product_category_snapshot || row.category || 'Otros').trim();
      const sellerId = Number(row.user_id || 0);

      grossSales += grossSaleAmount;
      totalRefunds += refundAmount;
      totalSales += netSaleAmount;
      totalCost += netDistributorCost;
      totalProfit += profit;
      if (refundAmount > 0) refundedOrders += 1;

      details.push({
        id: Number(row.id),
        seller_id: sellerId,
        seller_name: row.seller_name || 'Vendedor',
        seller_email: row.seller_email || '',
        product_id: Number(row.product_id || 0),
        product_name: productName,
        product_category: productCategory,
        gross_sale_amount: roundMoney(grossSaleAmount),
        refund_amount: roundMoney(refundAmount),
        sale_amount: roundMoney(netSaleAmount),
        original_distributor_cost: roundMoney(distributorCost),
        distributor_cost: roundMoney(netDistributorCost),
        original_profit: roundMoney(originalProfit),
        refund_profit_adjustment: roundMoney(profitAdjustment),
        refund_percent: Number((refundRatio * 100).toFixed(2)),
        profit,
        cost_source: costSource,
        created_at: row.created_at,
        created_at_mx: row.created_at_mx || ''
      });

      const sellerKey = String(sellerId);
      const sellerSummary = sellerMap.get(sellerKey) || {
        seller_id: sellerId,
        seller_name: row.seller_name || 'Vendedor',
        seller_email: row.seller_email || '',
        total_orders: 0,
        gross_sales: 0,
        total_refunds: 0,
        total_sales: 0,
        total_cost: 0,
        total_profit: 0
      };
      sellerSummary.total_orders += 1;
      sellerSummary.gross_sales += grossSaleAmount;
      sellerSummary.total_refunds += refundAmount;
      sellerSummary.total_sales += netSaleAmount;
      sellerSummary.total_cost += netDistributorCost;
      sellerSummary.total_profit += profit;
      sellerMap.set(sellerKey, sellerSummary);

      const productKey = `${Number(row.product_id || 0)}:${productName}`;
      const productSummary = productMap.get(productKey) || {
        product_id: Number(row.product_id || 0),
        product_name: productName,
        product_category: productCategory,
        total_orders: 0,
        gross_sales: 0,
        total_refunds: 0,
        total_sales: 0,
        total_cost: 0,
        total_profit: 0
      };
      productSummary.total_orders += 1;
      productSummary.gross_sales += grossSaleAmount;
      productSummary.total_refunds += refundAmount;
      productSummary.total_sales += netSaleAmount;
      productSummary.total_cost += netDistributorCost;
      productSummary.total_profit += profit;
      productMap.set(productKey, productSummary);
    }

    const roundSummary = (row) => ({
      ...row,
      gross_sales: roundMoney(row.gross_sales),
      total_refunds: roundMoney(row.total_refunds),
      total_sales: roundMoney(row.total_sales),
      total_cost: roundMoney(row.total_cost),
      total_profit: roundMoney(row.total_profit)
    });

    totalSales = roundMoney(totalSales);
    totalCost = roundMoney(totalCost);
    totalProfit = roundMoney(totalProfit);
    const bySeller = Array.from(sellerMap.values())
      .map(roundSummary)
      .sort((a, b) => b.total_profit - a.total_profit || b.total_sales - a.total_sales);
    const byProduct = Array.from(productMap.values())
      .map(roundSummary)
      .sort((a, b) => b.total_profit - a.total_profit || b.total_sales - a.total_sales);

    res.json({
      start_date: startDate,
      end_date: endDate,
      timezone: 'America/Mexico_City',
      wallet,
      summary: {
        total_orders: details.length,
        refunded_orders: refundedOrders,
        gross_sales: roundMoney(grossSales),
        total_refunds: roundMoney(totalRefunds),
        total_sales: totalSales,
        total_cost: totalCost,
        total_profit: totalProfit,
        margin_percent: totalSales > 0 ? Number(((totalProfit / totalSales) * 100).toFixed(2)) : 0,
        estimated_cost_orders: estimatedCostOrders
      },
      by_seller: bySeller,
      by_product: byProduct,
      details
    });
  } catch (err) {
    console.error('Error generando reporte de ganancias del distribuidor:', err.message);
    res.status(500).json({ error: 'Error generando reporte de ganancias' });
  }
});

// DISTRIBUIDOR: CUENTA DE GANANCIAS (independiente del saldo de compra)
app.get("/api/distributor/earnings/wallet", authMiddleware, distributorMiddleware, async (req, res) => {
  try {
    const wallet = await getDistributorEarningsWallet(pool, req.user.id, 80);
    res.json(wallet);
  } catch (err) {
    console.error('Error cargando cuenta de ganancias:', err.message);
    res.status(500).json({ error: 'Error cargando cuenta de ganancias' });
  }
});

// DISTRIBUIDOR: TRANSFERIR GANANCIAS A SU SALDO DE COMPRA
app.post("/api/distributor/earnings/transfer", authMiddleware, distributorMiddleware, async (req, res) => {
  const client = await pool.connect();
  let transactionStarted = false;

  try {
    const amount = roundMoney(req.body?.amount);
    const note = String(req.body?.note || '').trim().slice(0, 300);

    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: 'Ingresa una cantidad mayor a 0' });
    }

    await client.query('BEGIN');
    transactionStarted = true;

    const distributorResult = await client.query(
      `SELECT id, balance, COALESCE(is_subadmin, false) AS is_subadmin
       FROM users
       WHERE id = $1
       FOR UPDATE`,
      [req.user.id]
    );
    const distributor = distributorResult.rows[0];

    if (!distributor || distributor.is_subadmin !== true) {
      await client.query('ROLLBACK');
      transactionStarted = false;
      return res.status(403).json({ error: 'Distribuidor requerido' });
    }

    await ensureDistributorEarningsInitialized(client, req.user.id);

    const availableResult = await client.query(
      `SELECT COALESCE(SUM(amount), 0) AS available
       FROM distributor_earnings_ledger
       WHERE distributor_id = $1`,
      [req.user.id]
    );
    const available = roundMoney(availableResult.rows[0]?.available || 0);

    if (available <= 0 || amount > available) {
      await client.query('ROLLBACK');
      transactionStarted = false;
      return res.status(400).json({
        error: `Ganancias disponibles insuficientes. Disponible: $${available.toFixed(2)}`,
        earnings_available: available
      });
    }

    await client.query(
      `UPDATE users SET balance = COALESCE(balance, 0) + $1 WHERE id = $2`,
      [amount, req.user.id]
    );

    await client.query(
      `INSERT INTO distributor_earnings_ledger
       (distributor_id, movement_type, amount, sale_amount, distributor_cost, refund_amount, note, created_at)
       VALUES ($1, 'transferencia_saldo', $2, 0, 0, 0, $3, NOW())`,
      [req.user.id, -amount, note || `Transferencia de ganancias a saldo por $${amount.toFixed(2)}`]
    );

    await client.query('COMMIT');
    transactionStarted = false;

    const wallet = await getDistributorEarningsWallet(pool, req.user.id, 80);
    res.json({
      message: `Se transfirieron $${amount.toFixed(2)} de Ganancias a tu Saldo de compra`,
      transferred_amount: amount,
      wallet
    });
  } catch (err) {
    if (transactionStarted) {
      try { await client.query('ROLLBACK'); } catch (_) {}
    }
    console.error('Error transfiriendo ganancias a saldo:', err.message);
    res.status(500).json({ error: 'Error transfiriendo ganancias a saldo' });
  } finally {
    client.release();
  }
});

app.post("/api/distributor/add-balance", authMiddleware, distributorMiddleware, async (req, res) => {
  try {
    const { user_id, amount, note } = req.body;
    const amountNumber = Number(amount);

    if (!user_id || !amountNumber || amountNumber <= 0) {
      return res.status(400).json({ error: "Vendedor y cantidad son obligatorios" });
    }

    const result = await pool.query(
      `UPDATE users SET balance = balance + $1 WHERE id = $2 AND owner_user_id = $3`,
      [amountNumber, user_id, req.user.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Vendedor no encontrado" });
    }

    res.json({ message: `Saldo agregado al vendedor${note ? ": " + note : ""}` });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Error agregando saldo al vendedor" });
  }
});


function getReportScopeOwnerId(req) {
  try {
    if (req.isPanelAdmin) return Number(req.user.id);
    if (req.adminUser && (req.adminUser.is_subadmin === true || req.adminUser.is_subadmin === 'true' || req.adminUser.is_subadmin === 1)) return Number(req.user.id);
    return null;
  } catch {
    return null;
  }
}

function getScopedOrdersCondition() {
  return `($2::int IS NULL OR orders.owner_admin_id = $2 OR orders.user_id = $2 OR orders.user_id IN (SELECT id FROM users WHERE owner_user_id = $2))`;
}

function getScopedReportsCondition() {
  return `($3::int IS NULL OR account_reports.owner_admin_id = $3 OR account_reports.user_id = $3 OR account_reports.user_id IN (SELECT id FROM users WHERE owner_user_id = $3))`;
}

// ADMIN: REPORTE DE VENTAS (fecha local México) - con costo y ganancia
app.get("/api/admin/sales-report", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const requestedDate = String(req.query.date || "").trim();
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    const useDate = dateRegex.test(requestedDate) ? requestedDate : null;

    const mexicoTodayResult = await pool.query(
      `SELECT ((NOW() AT TIME ZONE 'America/Mexico_City')::date)::text AS today`
    );

    const selectedDate = useDate || mexicoTodayResult.rows[0].today;
    const scopeOwnerId = getReportScopeOwnerId(req);
    const params = [selectedDate, scopeOwnerId];
    const scopeCondition = getScopedOrdersCondition();

    const saleProductNameExpr = `
      COALESCE(
        NULLIF(orders.product_name_snapshot, ''),
        NULLIF(substring(orders.delivered_account_data from 'Producto: ([^\n\r]+)'), ''),
        products.name
      )
    `;

    const saleProductCategoryExpr = `
      COALESCE(
        NULLIF(orders.product_category_snapshot, ''),
        products.category,
        'Otros'
      )
    `;

    const costExpr = `COALESCE(orders.product_cost_snapshot, products.cost_price, 0)`;
    const dateCondition = `((orders.created_at AT TIME ZONE 'UTC') AT TIME ZONE 'America/Mexico_City')::date = $1::date`;

    const summaryResult = await pool.query(
      `SELECT
         COUNT(*)::int AS total_orders,
         COALESCE(SUM(orders.amount), 0)::numeric AS total_sales,
         COALESCE(SUM(${costExpr}), 0)::numeric AS total_cost,
         COALESCE(SUM(orders.amount - ${costExpr}), 0)::numeric AS total_profit
       FROM orders
       JOIN products ON products.id = orders.product_id
       WHERE orders.status = 'exito'
         AND ${dateCondition}
         AND ${scopeCondition}`,
      params
    );

    const byUserResult = await pool.query(
      `SELECT
         users.id AS user_id,
         users.name AS customer_name,
         users.email AS customer_email,
         COUNT(orders.id)::int AS total_orders,
         COALESCE(SUM(orders.amount), 0)::numeric AS total_sales,
         COALESCE(SUM(${costExpr}), 0)::numeric AS total_cost,
         COALESCE(SUM(orders.amount - ${costExpr}), 0)::numeric AS total_profit
       FROM orders
       JOIN users ON users.id = orders.user_id
       JOIN products ON products.id = orders.product_id
       WHERE orders.status = 'exito'
         AND ${dateCondition}
         AND ${scopeCondition}
       GROUP BY users.id, users.name, users.email
       ORDER BY total_profit DESC, total_sales DESC, total_orders DESC`,
      params
    );

    const byProductResult = await pool.query(
      `SELECT
         ${saleProductNameExpr} AS product_name,
         ${saleProductCategoryExpr} AS product_category,
         COUNT(orders.id)::int AS total_orders,
         COALESCE(SUM(orders.amount), 0)::numeric AS total_sales,
         COALESCE(SUM(${costExpr}), 0)::numeric AS total_cost,
         COALESCE(SUM(orders.amount - ${costExpr}), 0)::numeric AS total_profit
       FROM orders
       JOIN products ON products.id = orders.product_id
       WHERE orders.status = 'exito'
         AND ${dateCondition}
         AND ${scopeCondition}
       GROUP BY ${saleProductNameExpr}, ${saleProductCategoryExpr}
       ORDER BY total_profit DESC, total_sales DESC, total_orders DESC`,
      params
    );

    const detailsResult = await pool.query(
      `SELECT
         orders.id,
         users.name AS customer_name,
         users.email AS customer_email,
         ${saleProductNameExpr} AS product_name,
         ${saleProductCategoryExpr} AS product_category,
         orders.amount,
         ${costExpr} AS cost_price,
         (orders.amount - ${costExpr}) AS profit,
         orders.status,
         orders.created_at,
         to_char(((orders.created_at AT TIME ZONE 'UTC') AT TIME ZONE 'America/Mexico_City'), 'DD/MM/YYYY HH24:MI:SS') AS created_at_mx
       FROM orders
       JOIN users ON users.id = orders.user_id
       JOIN products ON products.id = orders.product_id
       WHERE orders.status = 'exito'
         AND ${dateCondition}
         AND ${scopeCondition}
       ORDER BY orders.created_at DESC`,
      params
    );

    res.json({
      date: selectedDate,
      timezone: "America/Mexico_City",
      summary: summaryResult.rows[0] || { total_orders: 0, total_sales: 0, total_cost: 0, total_profit: 0 },
      by_user: byUserResult.rows,
      by_product: byProductResult.rows,
      details: detailsResult.rows
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Error generando reporte de ventas" });
  }
});


// ==========================================
// RUTA PARA EL HISTORIAL DE INVENTARIO
// ==========================================
app.get('/api/admin/inventory-history', authMiddleware, inventoryHistoryAccessMiddleware, async (req, res) => {
  try {
    const search = String(req.query.q || '').trim();
    if (!search) {
      return res.status(400).json({ error: 'Se requiere q=texto de búsqueda' });
    }

    const lowerSearch = search.toLowerCase();
    const normalizedSearch = lowerSearch.replace(/\s+/g, '');
    const likeSearch = `%${lowerSearch}%`;
    const likeNormalizedSearch = `%${normalizedSearch}%`;
    const isEmailSearch = search.includes('@');
    const isNumericSearch = /^\d+$/.test(search);
    const numericSearch = isNumericSearch ? Number(search) : null;

    // La trazabilidad pertenece al inventario efectivo del usuario actual.
    // Admin principal y distribuidores convertidos usan owner 0/global;
    // paneles independientes usan su propio owner_admin_id.
    const viewer = await getViewerContext(req.user.id);
    const scopeOwnerId = Number(viewer?.owner_admin_id || 0) || null;

    const officialDateExpression = `COALESCE(ma.original_purchase_date, pa.official_purchase_date)`;
    const expirationDateExpression = `COALESCE(
      ma.expiration_date,
      pa.expires_at::date,
      CASE
        WHEN COALESCE(ma.original_purchase_date, pa.official_purchase_date) IS NULL THEN NULL
        ELSE (COALESCE(ma.original_purchase_date, pa.official_purchase_date) + INTERVAL '30 days')::date
      END
    )`;

    const selectSql = `
      SELECT
        pa.id AS perfil_id,
        pa.platform,
        pa.product_name,
        pa.account_email AS cuenta_madre,
        pa.account_password AS contrasena,
        pa.profile_name,
        pa.profile_pin,
        pa.status,
        pa.created_at AS fecha_ingreso,
        pa.created_at AS created_at,
        ${officialDateExpression} AS fecha_compra,
        ${officialDateExpression} AS official_purchase_date,
        ${officialDateExpression} AS cycle_official_purchase_date,
        pa.official_purchase_date AS stored_official_purchase_date,
        pa.expires_at,
        pa.delivered_at AS fecha_entrega,
        pa.assigned_order_id,
        pa.assigned_user_id,
        pa.mother_account_id AS cuenta_madre_id,
        ma.original_purchase_date AS fecha_original_cuenta_madre,
        ${expirationDateExpression} AS vencimiento_cuenta_madre,
        ma.status AS mother_account_status,
        ma.replaces_mother_account_id AS reemplaza_cuenta_madre_id,
        ma.replaced_by_mother_account_id AS reemplazada_por_cuenta_madre_id,
        CASE
          WHEN pa.mother_account_id IS NOT NULL THEN (
            SELECT COUNT(*)::int
            FROM platform_accounts pa_total
            WHERE pa_total.mother_account_id = pa.mother_account_id
          )
          ELSE (
            SELECT COUNT(*)::int
            FROM platform_accounts pa_total
            WHERE pa_total.mother_account_id IS NULL
              AND lower(regexp_replace(trim(COALESCE(pa_total.account_email, '')), '\\s+', '', 'g')) =
                  lower(regexp_replace(trim(COALESCE(pa.account_email, '')), '\\s+', '', 'g'))
              AND pa_total.official_purchase_date IS NOT DISTINCT FROM pa.official_purchase_date
              AND COALESCE(pa_total.owner_admin_id, 0) = COALESCE(pa.owner_admin_id, 0)
          )
        END AS total_perfiles,
        COALESCE(u.name, '') AS comprador_nombre,
        COALESCE(u.email, '') AS comprador_email,
        COALESCE(u.role, '') AS comprador_rol,
        o.id AS orden_id,
        o.status AS orden_status,
        o.created_at AS orden_creada,
        o.amount AS orden_amount
      FROM platform_accounts pa
      LEFT JOIN mother_accounts ma ON ma.id = pa.mother_account_id
      LEFT JOIN orders o ON pa.assigned_order_id = o.id
      LEFT JOIN users u ON pa.assigned_user_id = u.id
    `;

    let result;

    if (isEmailSearch) {
      // Un correo se interpreta exclusivamente como correo de CUENTA MADRE.
      // Primero localizamos sus mother_account_id exactos y después seguimos
      // únicamente la cadena de reemplazos relacionada con esos IDs.
      // Nunca se usa el correo del comprador/vendedor para ampliar resultados.
      const emailQuery = `
        WITH RECURSIVE anchor_mothers AS (
          SELECT DISTINCT pa_anchor.mother_account_id AS id
          FROM platform_accounts pa_anchor
          WHERE pa_anchor.mother_account_id IS NOT NULL
            AND lower(regexp_replace(trim(COALESCE(pa_anchor.account_email, '')), '\\s+', '', 'g')) = $1
            AND COALESCE(pa_anchor.owner_admin_id, 0) = COALESCE($2::int, 0)

          UNION

          SELECT ma_anchor.id
          FROM mother_accounts ma_anchor
          WHERE lower(regexp_replace(trim(COALESCE(ma_anchor.account_email, '')), '\\s+', '', 'g')) = $1
            AND COALESCE(ma_anchor.owner_admin_id, 0) = COALESCE($2::int, 0)
        ),
        mother_family(id) AS (
          SELECT id FROM anchor_mothers

          UNION

          SELECT linked.id
          FROM mother_family mf
          JOIN mother_accounts current_ma ON current_ma.id = mf.id
          JOIN mother_accounts linked
            ON linked.id = current_ma.replaces_mother_account_id
            OR linked.id = current_ma.replaced_by_mother_account_id
            OR linked.replaces_mother_account_id = current_ma.id
            OR linked.replaced_by_mother_account_id = current_ma.id
          WHERE COALESCE(linked.owner_admin_id, 0) = COALESCE($2::int, 0)
        )
        ${selectSql}
        WHERE COALESCE(pa.owner_admin_id, 0) = COALESCE($2::int, 0)
          AND (
            pa.mother_account_id IN (SELECT id FROM mother_family)
            OR (
              pa.mother_account_id IS NULL
              AND lower(regexp_replace(trim(COALESCE(pa.account_email, '')), '\\s+', '', 'g')) = $1
            )
          )
        ORDER BY
          ${officialDateExpression} DESC NULLS LAST,
          pa.created_at DESC NULLS LAST,
          pa.delivered_at DESC NULLS LAST,
          pa.id DESC;
      `;
      result = await pool.query(emailQuery, [normalizedSearch, scopeOwnerId]);
    } else if (isNumericSearch) {
      // Para números priorizamos coincidencia exacta de pedido, ID de perfil o PIN.
      // Ya no usamos LIKE sobre pedidos porque #12 no debe traer #120, #312, etc.
      const numericQuery = `
        ${selectSql}
        WHERE COALESCE(pa.owner_admin_id, 0) = COALESCE($2::int, 0)
          AND (
            pa.assigned_order_id = $1::int
            OR o.id = $1::int
            OR pa.id = $1::int
            OR regexp_replace(lower(COALESCE(pa.profile_pin, '')), '\\s+', '', 'g') = $3
          )
        ORDER BY
          ${officialDateExpression} DESC NULLS LAST,
          pa.created_at DESC NULLS LAST,
          pa.delivered_at DESC NULLS LAST,
          pa.id DESC;
      `;
      result = await pool.query(numericQuery, [numericSearch, scopeOwnerId, normalizedSearch]);
    } else {
      // Búsqueda textual: solo campos propios de la cuenta/perfil.
      // Se excluyen nombre y correo del comprador para impedir mezclar sus otras compras.
      const textQuery = `
        ${selectSql}
        WHERE COALESCE(pa.owner_admin_id, 0) = COALESCE($3::int, 0)
          AND (
            lower(COALESCE(pa.account_email, '')) LIKE $1
            OR regexp_replace(lower(COALESCE(pa.account_email, '')), '\\s+', '', 'g') LIKE $2
            OR lower(COALESCE(pa.profile_name, '')) LIKE $1
            OR regexp_replace(lower(COALESCE(pa.profile_name, '')), '\\s+', '', 'g') LIKE $2
            OR lower(COALESCE(pa.profile_pin, '')) LIKE $1
            OR regexp_replace(lower(COALESCE(pa.profile_pin, '')), '\\s+', '', 'g') LIKE $2
            OR lower(COALESCE(pa.product_name, '')) LIKE $1
            OR lower(COALESCE(pa.platform, '')) LIKE $1
          )
        ORDER BY
          ${officialDateExpression} DESC NULLS LAST,
          pa.created_at DESC NULLS LAST,
          pa.delivered_at DESC NULLS LAST,
          pa.id DESC;
      `;
      result = await pool.query(textQuery, [likeSearch, likeNormalizedSearch, scopeOwnerId]);
    }

    res.json({
      events: result.rows || [],
      search_mode: isEmailSearch ? 'mother_email' : (isNumericSearch ? 'exact_number' : 'account_fields'),
      query: search
    });
  } catch (error) {
    console.error('Error en historial de inventario:', error.message);
    res.status(500).json({ error: 'Error interno obteniendo el historial de inventario.' });
  }
});

// ADMIN: REPORTE MENSUAL CSV (respeta admin global, distribuidor o panel independiente)
app.get("/api/admin/monthly-report", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const month = String(req.query.month || "").trim();
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ error: "Mes inválido. Usa YYYY-MM" });
    }
    const scopeOwnerId = getReportScopeOwnerId(req);
    const startDate = `${month}-01`;
    const result = await pool.query(
      `SELECT
         orders.id,
         users.name AS customer_name,
         users.email AS customer_email,
         COALESCE(NULLIF(orders.product_name_snapshot, ''), products.name) AS product_name,
         COALESCE(NULLIF(orders.product_category_snapshot, ''), products.category, 'Otros') AS product_category,
         orders.amount,
         COALESCE(orders.product_cost_snapshot, products.cost_price, 0) AS cost_price,
         (orders.amount - COALESCE(orders.product_cost_snapshot, products.cost_price, 0)) AS profit,
         orders.status,
         to_char(((orders.created_at AT TIME ZONE 'UTC') AT TIME ZONE 'America/Mexico_City'), 'YYYY-MM-DD HH24:MI:SS') AS fecha_mexico
       FROM orders
       JOIN users ON users.id = orders.user_id
       JOIN products ON products.id = orders.product_id
       WHERE orders.status = 'exito'
         AND ((orders.created_at AT TIME ZONE 'UTC') AT TIME ZONE 'America/Mexico_City')::date >= $1::date
         AND ((orders.created_at AT TIME ZONE 'UTC') AT TIME ZONE 'America/Mexico_City')::date < ($1::date + INTERVAL '1 month')
         AND ($2::int IS NULL OR orders.owner_admin_id = $2 OR orders.user_id = $2 OR orders.user_id IN (SELECT id FROM users WHERE owner_user_id = $2))
       ORDER BY orders.created_at DESC`,
      [startDate, scopeOwnerId]
    );

    const headers = ['Pedido','Cliente','Correo','Producto','Categoria','Venta','Costo','Ganancia','Estado','Fecha Mexico'];
    const rows = result.rows.map(r => [
      r.id,
      r.customer_name || '',
      r.customer_email || '',
      r.product_name || '',
      r.product_category || '',
      Number(r.amount || 0).toFixed(2),
      Number(r.cost_price || 0).toFixed(2),
      Number(r.profit || 0).toFixed(2),
      r.status || '',
      r.fecha_mexico || ''
    ]);
    const csv = [headers, ...rows].map(row => row.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="reporte_mensual_${month}.csv"`);
    res.send('\ufeff' + csv);
  } catch (err) {
    console.error('Error generando reporte mensual:', err.message);
    res.status(500).json({ error: "Error generando reporte mensual" });
  }
});

// ADMIN: BUSCAR PEDIDOS O FALLAS POR RANGO DE FECHAS
app.get("/api/admin/search-records", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const type = String(req.query.type || 'orders');
    const startDate = String(req.query.start_date || '').trim();
    const endDate = String(req.query.end_date || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
      return res.status(400).json({ error: "Selecciona fecha inicial y fecha final válidas" });
    }
    const scopeOwnerId = getReportScopeOwnerId(req);
    if (type === 'reports') {
      const result = await pool.query(
        `SELECT account_reports.id, account_reports.order_id, account_reports.email, account_reports.issue_type, account_reports.description,
                account_reports.status, account_reports.admin_response, account_reports.created_at, account_reports.reviewed_at,
                users.name AS customer_name, users.email AS customer_email
         FROM account_reports
         JOIN users ON users.id = account_reports.user_id
         WHERE account_reports.created_at::date >= $1::date
           AND account_reports.created_at::date <= $2::date
           AND ($3::int IS NULL OR account_reports.owner_admin_id = $3 OR account_reports.user_id = $3 OR account_reports.user_id IN (SELECT id FROM users WHERE owner_user_id = $3))
         ORDER BY account_reports.created_at DESC`,
        [startDate, endDate, scopeOwnerId]
      );
      return res.json({ type, records: result.rows });
    }

    const result = await pool.query(
      `SELECT orders.id, orders.amount, orders.status, orders.admin_response, orders.created_at,
              COALESCE(NULLIF(orders.product_name_snapshot, ''), products.name) AS product_name,
              users.name AS customer_name, users.email AS customer_email
       FROM orders
       JOIN users ON users.id = orders.user_id
       JOIN products ON products.id = orders.product_id
       WHERE orders.created_at::date >= $1::date
         AND orders.created_at::date <= $2::date
         AND ($3::int IS NULL OR orders.owner_admin_id = $3 OR orders.user_id = $3 OR orders.user_id IN (SELECT id FROM users WHERE owner_user_id = $3))
       ORDER BY orders.created_at DESC`,
      [startDate, endDate, scopeOwnerId]
    );
    res.json({ type: 'orders', records: result.rows });
  } catch (err) {
    console.error('Error buscando registros:', err.message);
    res.status(500).json({ error: "Error buscando registros" });
  }
});

// ADMIN: HISTORIAL DE PEDIDOS POR USUARIO
app.get("/api/admin/user-history", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const userId = Number(req.query.user_id || 0);
    const startDate = String(req.query.start_date || '').trim();
    const endDate = String(req.query.end_date || '').trim();
    const { page, limit, offset } = getPaginationParams(req, 20, 100);
    if (!userId) return res.status(400).json({ error: "Selecciona un usuario" });
    const scopeOwnerId = getReportScopeOwnerId(req);
    const params = [userId, scopeOwnerId];
    let dateSql = '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(startDate) && /^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
      params.push(startDate, endDate);
      dateSql = ' AND orders.created_at::date >= $3::date AND orders.created_at::date <= $4::date ';
    }
    const limitParam = params.length + 1;
    const offsetParam = params.length + 2;
    const whereSql = `WHERE orders.user_id = $1
         AND ($2::int IS NULL OR orders.owner_admin_id = $2 OR users.owner_user_id = $2 OR users.id = $2)
         ${dateSql}`;

    const totalResult = await pool.query(
      `SELECT COUNT(*)::int AS total
       FROM orders
       JOIN users ON users.id = orders.user_id
       ${whereSql}`,
      params
    );
    const total = Number(totalResult.rows[0]?.total || 0);

    const result = await pool.query(
      `SELECT orders.id, orders.amount, orders.status, orders.admin_response, orders.order_data, orders.delivered_account_data, orders.created_at,
              COALESCE(NULLIF(orders.product_name_snapshot, ''), products.name) AS product_name,
              users.name AS customer_name, users.email AS customer_email
       FROM orders
       JOIN users ON users.id = orders.user_id
       JOIN products ON products.id = orders.product_id
       ${whereSql}
       ORDER BY orders.created_at DESC
       LIMIT $${limitParam} OFFSET $${offsetParam}`,
      [...params, limit, offset]
    );
    res.json({
      records: summarizeOrderRowsForList(result.rows),
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit))
    });
  } catch (err) {
    console.error('Error cargando historial:', err.message);
    res.status(500).json({ error: "Error cargando historial de usuario" });
  }
});


// DATOS BANCARIOS SEGÚN PANEL / ADMIN
app.get("/api/bank-info", authMiddleware, async (req, res) => {
  try {
    const viewer = await getViewerContext(req.user.id);
    let panel = null;

    if (viewer?.is_panel_admin) {
      panel = await getAdminPanelForEmail(viewer.email);
    } else if (viewer?.owner_user_id) {
      const ownerResult = await pool.query(`SELECT email FROM users WHERE id = $1`, [viewer.owner_user_id]);
      panel = await getAdminPanelForEmail(ownerResult.rows[0]?.email || "");
    }

    if (panel) {
      return res.json({
        bank_name: panel.bank_name || "",
        bank_holder: panel.bank_holder || "",
        bank_clabe: panel.bank_clabe || "",
        payment_concept: panel.payment_concept || ""
      });
    }

    res.json({
      bank_name: "Klar",
      bank_holder: "Pedro Garcia Diaz",
      bank_clabe: "661610003119974659",
      payment_concept: "ropa o comida"
    });
  } catch (err) {
    console.error("Error cargando datos bancarios:", err.message);
    res.status(500).json({ error: "Error cargando datos bancarios" });
  }
});

// ADMIN: PROBAR CORREO DE NOTIFICACIÓN
app.post("/api/admin/test-email", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    await sendNewOrderEmail({
      orderId: "PRUEBA",
      customerName: "Prueba Admin",
      customerEmail: "prueba@correo.com",
      productName: "Correo de prueba",
      amount: 0,
      orderData: {
        mensaje: "Si recibes este correo, Resend está funcionando correctamente."
      }
    });

    res.json({ message: "Prueba de correo ejecutada con Resend. Revisa tu bandeja y los Logs de Render." });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Error probando correo" });
  }
});


// ===============================
// FASE 1: PANELES ADMIN SECUNDARIOS
// Solo el admin principal puede crear/listar/suspender paneles.
// ===============================
app.get("/api/admin/admin-panels", authMiddleware, adminMiddleware, mainAdminMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, business_name, admin_name, email, phone, bank_name, bank_holder,
              bank_clabe, payment_concept, notification_email, status, plan_type,
              expires_at, slug, owner_user_id, created_at, updated_at
       FROM admin_panels
       ORDER BY id DESC`
    );

    res.json(result.rows);
  } catch (err) {
    console.error("Error listando paneles admin:", err.message);
    res.status(500).json({ error: "Error cargando paneles admin" });
  }
});

app.post("/api/admin/admin-panels", authMiddleware, adminMiddleware, mainAdminMiddleware, async (req, res) => {
  try {
    const {business_name,admin_name,email,password,phone,bank_name,bank_holder,bank_clabe,payment_concept,notification_email,status,plan_type,expires_at}=req.body||{};
    const cleanEmail=String(email||"").trim().toLowerCase(), cleanPassword=String(password||"").trim();
    if(!cleanEmail) return res.status(400).json({error:"El correo del admin es obligatorio"});
    if(isMainAdminEmail(cleanEmail)) return res.status(400).json({error:"El correo del administrador principal no puede convertirse en panel rentado."});
    if(cleanPassword.length<6) return res.status(400).json({error:"La contraseña debe tener mínimo 6 caracteres"});
    const exists=await pool.query(`SELECT id FROM admin_panels WHERE lower(email)=lower($1)`,[cleanEmail]);
    if(exists.rows.length) return res.status(400).json({error:"Este correo ya tiene un panel admin registrado"});
    let base=slugifyBusinessName(business_name)||`panel-${Date.now()}`, slug=base, n=2;
    while((await pool.query(`SELECT id FROM admin_panels WHERE lower(slug)=lower($1) LIMIT 1`,[slug])).rows.length){slug=`${base}-${n++}`;}
    const hash=await bcrypt.hash(cleanPassword,10);
    const result=await pool.query(`INSERT INTO admin_panels (business_name,admin_name,email,password,phone,bank_name,bank_holder,bank_clabe,payment_concept,notification_email,status,plan_type,expires_at,slug) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING id,business_name,admin_name,email,phone,bank_name,bank_holder,bank_clabe,payment_concept,notification_email,status,plan_type,expires_at,slug,owner_user_id,created_at,updated_at`,[String(business_name||"").trim(),String(admin_name||"").trim(),cleanEmail,hash,String(phone||"").trim(),String(bank_name||"").trim(),String(bank_holder||"").trim(),String(bank_clabe||"").trim(),String(payment_concept||"").trim(),String(notification_email||"").trim(),String(status||"activo").trim()||"activo",String(plan_type||"renta").trim()||"renta",expires_at||null,slug]);
    const owner=await pool.query(`INSERT INTO users (name,email,password,role,balance,is_subadmin,owner_user_id,is_enabled) VALUES ($1,$2,$3,'admin',0,false,NULL,true) RETURNING id`,[String(admin_name||business_name||cleanEmail).trim()||cleanEmail,cleanEmail,hash]);
    await pool.query(`UPDATE admin_panels SET owner_user_id=$1,updated_at=NOW() WHERE id=$2`,[owner.rows[0].id,result.rows[0].id]);
    result.rows[0].owner_user_id=owner.rows[0].id;
    res.json({message:"Panel admin creado correctamente y acceso habilitado",panel:{...result.rows[0],panel_url:buildPanelUrl(slug)}});
  }catch(err){console.error("Error creando panel admin:",err.message);res.status(500).json({error:"Error creando panel admin"});}
});

app.post("/api/admin/admin-panels/invite", authMiddleware, adminMiddleware, mainAdminMiddleware, async (req,res)=>{
  try{
    const token=crypto.randomBytes(24).toString("hex"), planType=String(req.body?.plan_type||"renta").trim()||"renta", expiresAt=req.body?.expires_at||null;
    const result=await pool.query(`INSERT INTO panel_invites(token,plan_type,expires_at) VALUES($1,$2,$3) RETURNING id,token,plan_type,expires_at,invite_expires_at,status,created_at`,[token,planType,expiresAt]);
    const host=getRequestHost(req), protocol=String(req.headers["x-forwarded-proto"]||req.protocol||"https").split(",")[0], baseUrl=`${protocol}://${host}`;
    res.json({message:"Enlace de registro generado",invite:result.rows[0],registration_url:`${baseUrl}/?panel_invite=${encodeURIComponent(token)}`});
  }catch(err){console.error("Error generando invitación:",err.message);res.status(500).json({error:"No se pudo generar el enlace de registro"});}
});

app.patch("/api/admin/admin-panels/:id/status", authMiddleware, adminMiddleware, mainAdminMiddleware, async (req, res) => {
  try {
    const panelId = Number(req.params.id);
    const status = String(req.body.status || "").trim();

    if (!panelId) {
      return res.status(400).json({ error: "Panel inválido" });
    }

    if (!["activo", "inactivo", "suspendido"].includes(status)) {
      return res.status(400).json({ error: "Estado inválido" });
    }

    const result = await pool.query(
      `UPDATE admin_panels
       SET status = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, business_name, admin_name, email, status`,
      [status, panelId]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: "Panel admin no encontrado" });
    }

    res.json({
      message: "Estado del panel actualizado",
      panel: result.rows[0]
    });
  } catch (err) {
    console.error("Error actualizando panel admin:", err.message);
    res.status(500).json({ error: "Error actualizando panel admin" });
  }
});
// ==========================================
// INGRESO MANUAL DIRECTO SIN BUSCAR INVENTARIO (VERSIÓN SEGURA)
// ==========================================
app.post("/api/admin/reemplazo-manual-seguro", async (req, res) => {
  try {
    const { reportId, email, password, profile, pin, url } = req.body;
    
    if (!reportId || !email || !password) {
      return res.status(400).json({ error: "Faltan datos obligatorios." });
    }

    // Se crea la respuesta estructurada
    const respuestaAdmin = `✅ REEMPLAZO MANUAL ENTREGADO:\n• Correo: ${email}\n• Contraseña: ${password}\n• Perfil: ${profile || 'N/A'}\n• PIN: ${pin || 'N/A'}\n• URL: ${url || 'N/A'}`;

    // Consulta SQL súper básica y segura que no exige columnas extra
    await pool.query(
      "UPDATE account_reports SET status = 'reemplazo', admin_response = $1 WHERE id = $2",
      [respuestaAdmin, reportId]
    );

    res.json({ success: true, message: "Cuenta entregada con éxito al cliente." });
  } catch (err) {
    console.error("Error en botón morado:", err.message);
    res.status(500).json({ error: "Error interno: " + err.message });
  }
});
// ==========================================
// RECUPERACIÓN DE CONTRASEÑA CON CÓDIGO DE 6 DÍGITOS
// ==========================================
app.post("/api/solicitar-codigo", async (req, res) => {
console.log("ENTRO A SOLICITAR CODIGO");
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Ingresa un correo." });

    const userCheck = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
    if (userCheck.rows.length === 0) return res.status(404).json({ error: "Cuenta no encontrada." });

    // 1. Generar código de 6 dígitos
    const codigo = Math.floor(100000 + Math.random() * 900000).toString();
    codigosRecuperacion.set(email, codigo);
setTimeout(() => {
  codigosRecuperacion.delete(email);
}, 15 * 60 * 1000);

    // 2. Configurar Gmail (IMPORTANTE: Usa una Contraseña de Aplicación de Google)
  const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS
  },
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 10000
});

    // 3. Enviar el correo
    await transporter.sendMail({
      from: '"Soporte Técnico" <' + (process.env.GMAIL_USER || 'tu_correo_de_soporte@gmail.com') + '>',
      to: email,
      subject: "Tu Código de Recuperación",
      html: `
        <div style="font-family: Arial; padding: 20px; color: #333; text-align: center;">
          <h2>Recuperación de Contraseña</h2>
          <p>Tu código de seguridad de 6 dígitos es:</p>
          <h1 style="background: #eef2ff; color: #6d5dfc; padding: 15px; letter-spacing: 5px; border-radius: 8px;">${codigo}</h1>
          <p>Ingresa este código en la página para crear tu nueva contraseña.</p>
        </div>`
    });

    res.json({ success: true, message: "Código enviado a tu correo." });
  } catch (err) {
  console.error("ERROR COMPLETO RECUPERACION:", err);

  res.status(500).json({
    error: err.message
  });
}
});

app.post("/api/cambiar-contrasena", async (req, res) => {
  try {
    const { email, codigo, nuevaContrasena } = req.body;
    
    // Verificamos que el código coincida
    if (codigosRecuperacion.get(email) !== codigo) {
       return res.status(400).json({ error: "Código incorrecto o expirado." });
    }
    
    // Si es correcto, guardamos la nueva clave
    const hashedPass = await bcrypt.hash(nuevaContrasena, 10);
    await pool.query("UPDATE users SET password = $1 WHERE email = $2", [hashedPass, email]);
    
    // Borramos el código para que no se pueda reusar
    codigosRecuperacion.delete(email); 

    res.json({ success: true, message: "Contraseña actualizada." });
  } catch (err) {
    res.status(500).json({ error: "Error actualizando contraseña." });
  }
});
// ==========================================
// ENDPOINT: CAMBIAR CONTRASEÑA DE CLIENTE
// ==========================================

app.post("/api/user/change-password", authMiddleware, async (req, res) => {
  try {
    const { currentPass, newPass } = req.body;
    const userId = req.user.id; // El authMiddleware nos asegura quién es el usuario

    // 1. Buscamos al usuario en la base de datos
    const userResult = await pool.query("SELECT * FROM users WHERE id = $1", [userId]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: "Usuario no encontrado" });
    }
    const user = userResult.rows[0];

    // 2. Comparamos la contraseña actual que escribió con la que tenemos guardada
    const validPassword = await bcrypt.compare(currentPass, user.password);
    if (!validPassword) {
      return res.status(400).json({ success: false, error: "La contraseña actual es incorrecta" });
    }

    // 3. Si todo está bien, encriptamos la nueva contraseña para máxima seguridad
    const salt = await bcrypt.genSalt(10);
    const hashedNewPassword = await bcrypt.hash(newPass, salt);

    // 4. Reemplazamos la vieja por la nueva en PostgreSQL
    await pool.query("UPDATE users SET password = $1 WHERE id = $2", [hashedNewPassword, userId]);

    res.json({ success: true, message: "Contraseña actualizada con éxito" });
  } catch (err) {
    console.error("Error al cambiar contraseña:", err.message);
    res.status(500).json({ success: false, error: "Error interno del servidor al actualizar" });
  }
});

// ==========================================
// BOTÓN DE PÁNICO (RESETEO A 123456 POR CORREO)
// ==========================================
app.post("/api/admin/panic-reset", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Ingresa el correo del usuario." });

    // Generamos la contraseña temporal universal: 123456
    const hashedPass = await bcrypt.hash("123456", 10);
    
    // Buscamos al usuario y le aplicamos el castigo/reinicio
    const result = await pool.query(
      "UPDATE users SET password = $1 WHERE lower(email) = $2 RETURNING email, name", 
      [hashedPass, email.trim().toLowerCase()]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "No se encontró ninguna cuenta con el correo: " + email });
    }

    res.json({ success: true, message: `La contraseña de ${result.rows[0].email} ahora es: 123456` });
  } catch (err) {
    console.error("Error en botón de pánico:", err.message);
    res.status(500).json({ error: "Error interno al intentar resetear la clave." });
  }
});
// ==========================================
// RUTA DE RECUPERACIÓN DE CUENTAS (CUARENTENA)
// ==========================================
app.post("/api/admin/system/check-expirations", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const result = await pool.query(`
      UPDATE platform_accounts
      SET status = 'recovery_pending'
      WHERE status = 'delivered' AND expires_at IS NOT NULL AND expires_at < NOW()
      RETURNING id, platform, account_email;
    `);
    res.json({ message: `Se movieron ${result.rowCount} cuentas a cuarentena.`, cuentas: result.rows });
  } catch (err) {
    res.status(500).json({ error: "Error verificando expiraciones." });
  }
});

app.get("/api/admin/accounts/quarantine", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        id, platform, account_email, account_password, profile_name, profile_pin,
  -- Calculamos días restantes dinámicamente según la fecha de compra original
  (official_purchase_date + INTERVAL '35 days' - CURRENT_TIMESTAMP) as dias_restantes
FROM platform_accounts
WHERE status = 'recovery_pending'
      ORDER BY expires_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Error listando cuarentena." });
  }
});

app.post("/api/admin/accounts/:id/release", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { new_password } = req.body;
    const accountId = req.params.id;

    // 1. OBTENEMOS LOS DATOS ACTUALES ANTES DE LIMPIAR
    // Esto es lo que permite que no se pierda la historia
    const currentData = await pool.query(
      `SELECT assigned_order_id, assigned_user_id, delivered_at 
       FROM platform_accounts WHERE id = $1`,
      [accountId]
    );

    if (currentData.rows.length > 0) {
      const { assigned_order_id, assigned_user_id, delivered_at } = currentData.rows[0];
      
      // 2. REGISTRAMOS EN LA BITÁCORA (Historial)
      // Si la cuenta tuvo una asignación, guardamos el rastro
      if (assigned_order_id) {
        await pool.query(
          `INSERT INTO account_recovery_log (account_id, order_id, user_id, delivered_at, recovered_at) 
           VALUES ($1, $2, $3, $4, NOW())`,
          [accountId, assigned_order_id, assigned_user_id, delivered_at]
        );
      }
    }

    // 3. AHORA SÍ: Liberamos la cuenta para el siguiente ciclo
    await pool.query(`
      UPDATE platform_accounts
      SET status = 'available', 
          account_password = $1, 
          assigned_order_id = NULL, 
          assigned_user_id = NULL, 
          delivered_at = NULL, 
          expires_at = NULL
      WHERE id = $2 AND status = 'recovery_pending'
    `, [new_password, accountId]);
    
    res.json({ message: "Cuenta liberada. Historial archivado correctamente." });
  } catch (err) {
    console.error("Error al liberar cuenta:", err);
    res.status(500).json({ error: "Error al archivar y liberar la cuenta." });
  }
});

initDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Servidor corriendo en puerto ${PORT}`);
    });
  })
  .catch(err => {
  console.error("ERROR COMPLETO");
  console.error(err);
  process.exit(1);
});

app.get("/api/admin/recovery-history", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT l.recovered_at, pa.platform, pa.account_email, l.order_id 
      FROM account_recovery_log l
      JOIN platform_accounts pa ON l.account_id = pa.id
      ORDER BY l.recovered_at DESC LIMIT 50
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener historial" });
  }
});

// ==========================================
// RUTA PARA DESECHAR CUENTAS (Eliminar de cuarentena)
// ==========================================
app.post("/api/admin/accounts/:id/discard", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const accountId = req.params.id;
    
    // Cambiamos el estado a 'discarded' para que ya no aparezca en el sistema de cuarentena
    await pool.query(
      "UPDATE platform_accounts SET status = 'discarded' WHERE id = $1", 
      [accountId]
    );
    
    res.json({ message: "Cuenta desechada correctamente." });
  } catch (err) {
    console.error("Error al desechar cuenta:", err);
    res.status(500).json({ error: "Error al desechar la cuenta." });
  }
});


// FIX GARANTIZADO VENTAS HOY Y PANELES ADMIN - 2026-06-08 03:14:33

// FIX VENTAS HOY SCROLL REPORTE MISMA PAGINA - 2026-06-08 03:25:07

// ROLES SEPARADOS: admin_global, admin_distribuidor, panel_propietario - 2026-06-08 03:36:19

// JERARQUIA PANEL PROPIETARIO - 2026-06-08 03:50:31

// REEMPLAZO MANUAL REPORTABLE - 2026-06-08 04:30:28

// FIX ESTABLE TIENDA COMBO REPORTES - 2026-06-09 02:15:25

// FIX CONTABILIZAR HISTORICO X2 COMO CUENTAS VENDIDAS - 2026-06-09 02:27:10

// BOTON COPIAR RESPUESTA DE FALLOS - 2026-06-09 02:38:18

// FIX BOTON COPIAR UNICO RESPUESTA FALLOS - 2026-06-09 03:02:58

// FIX SALDO PENDIENTE Y NOTIFICACIONES - 2026-06-09 04:01:41
