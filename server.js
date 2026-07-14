process.env.DATABASE_URL = "postgresql://postgres:tIUHZOwRTVTQVaNmQbOXoKTdqtMVSHyN@ballast.proxy.rlwy.net:10856/railway";

const express = require("express");
console.log("VERSION RECUPERACION 11-JUN-2026");
const { Pool } = require("pg");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const bodyParser = require("body-parser");
const cors = require("cors");
const compression = require("compression"); // <-- NUEVO COMPRESOR
const nodemailer = require("nodemailer");

const app = express();
const codigosRecuperacion = new Map();

const PORT = process.env.PORT || 3000;
const SECRET = process.env.JWT_SECRET || "mi_super_secreto";

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
            WHERE id = $3 AND (status = 'available' OR ($4 = true AND reusable = 1))
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
       LEFT JOIN admin_panels ap ON lower(ap.email) = lower(u.email)
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
    req.isPanelAdmin = Boolean(user.admin_panel_id);
    req.isMainAdmin = !req.isPanelAdmin;
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
     LEFT JOIN admin_panels ap ON lower(ap.email) = lower(u.email)
     LEFT JOIN users owner_user ON owner_user.id = u.owner_user_id
     LEFT JOIN admin_panels owner_panel ON lower(owner_panel.email) = lower(owner_user.email)
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
     LEFT JOIN admin_panels own_panel ON lower(own_panel.email) = lower(owner.email)
     LEFT JOIN admin_panels self_panel ON lower(self_panel.email) = lower(u.email)
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

function dynamicStockSubquery(productAlias = "products") {
  return `COALESCE((
    SELECT COUNT(*)::int
    FROM platform_accounts pa
    WHERE pa.status IN ('available', 'disponible')
      AND (
        (${productAlias}.owner_admin_id IS NULL AND (pa.owner_admin_id IS NULL OR pa.owner_admin_id = 0))
        OR pa.owner_admin_id = ${productAlias}.owner_admin_id
      )
      AND (
        lower(COALESCE(NULLIF(TRIM(pa.product_name), ''), NULLIF(TRIM(pa.platform), ''))) = lower(${productAlias}.name)
        OR lower(pa.platform) = lower(${productAlias}.name)
      )
  ), 0)`;
}

function effectiveStockExpression(productAlias = "products") {
  return `CASE
    WHEN lower(trim(COALESCE(${productAlias}.product_type, 'streaming_auto'))) LIKE '%manual%'
      THEN GREATEST(0, COALESCE(${productAlias}.stock, 0))::int
    ELSE ${dynamicStockSubquery(productAlias)}
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
      reviewed_at TIMESTAMP
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
  await pool.query(`ALTER TABLE platform_accounts ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW()`);
  await pool.query(`ALTER TABLE platform_accounts ADD COLUMN IF NOT EXISTS owner_admin_id INTEGER`);
  await pool.query(`ALTER TABLE platform_accounts ADD COLUMN IF NOT EXISTS manual_replacement_source TEXT DEFAULT ''`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_platform_accounts_available ON platform_accounts (status, lower(product_name), lower(platform))`);


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
  await pool.query(`ALTER TABLE account_reports ADD COLUMN IF NOT EXISTS refund_amount NUMERIC DEFAULT 0`);
  await pool.query(`ALTER TABLE account_reports ADD COLUMN IF NOT EXISTS resolution_type TEXT DEFAULT ''`);

  await pool.query(`ALTER TABLE account_reports ADD COLUMN IF NOT EXISTS reported_platform TEXT DEFAULT ''`);
  await pool.query(`ALTER TABLE account_reports ADD COLUMN IF NOT EXISTS owner_admin_id INTEGER`);

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
    WHERE lower(u.email) = lower(ap.email)
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

function formatFechaMX(fecha) {
  return fecha.toLocaleDateString("es-MX", {
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
  const fechaEntrega = originalDate ? new Date(originalDate) : new Date();
  
  const fechaVencimiento = new Date(fechaEntrega);
  fechaVencimiento.setDate(fechaVencimiento.getDate() + 28);

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
       p.id AS product_id,
       p.name AS product_name,
       p.category AS product_category,
       pa.id AS account_id,
       pa.platform,
       pa.product_name AS account_product_name,
       pa.account_email,
       pa.status AS account_status
     FROM platform_accounts pa
     JOIN orders o ON o.id = pa.assigned_order_id
     JOIN products p ON p.id = o.product_id
     WHERE pa.assigned_user_id = $1
       AND lower(pa.account_email) = lower($2)
       AND o.status = 'exito'
       AND pa.status IN ('delivered','failed')
     ORDER BY o.id DESC
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

function buildComboDeliveredAccountData(accounts) {
  const fechaEntrega = new Date();
  const fechaVencimiento = new Date(fechaEntrega);
  fechaVencimiento.setDate(fechaVencimiento.getDate() + 28);

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

async function findAvailableAccountForProduct(client, product, userId) {
  const productName = String(product.name || '').trim();
  const productCategory = String(product.category || '').trim();

  const ownerId = product.owner_admin_id || null;
  const result = await client.query(
    `SELECT *
     FROM platform_accounts
     WHERE status = 'available'
       AND ($3::int IS NULL OR owner_admin_id = $3)
       AND (
         lower(product_name) = lower($1)
         OR lower(platform) = lower($1)
         OR lower(platform) = lower($2)
       )
     ORDER BY id ASC
     LIMIT 1
     FOR UPDATE SKIP LOCKED`,
    [productName, productCategory, ownerId]
  );

  return result.rows[0] || null;
}

// REGISTRO
app.post("/api/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: "Faltan datos" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO users (name, email, password, role, balance)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, email, role, balance`,
      [name.trim(), email.trim().toLowerCase(), hashedPassword, "user", 0]
    );

    const user = result.rows[0];
    const token = generateToken(user);

    res.json({
      token,
      message: "Usuario registrado con éxito"
    });
  } catch (err) {
    console.error(err.message);
    res.status(400).json({ error: "El usuario ya existe o los datos son inválidos" });
  }
});

// LOGIN
app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const cleanEmail = String(email || "").trim().toLowerCase();

    const result = await pool.query(
      `SELECT *
       FROM users
       WHERE lower(regexp_replace(trim(email), '\\s+', '', 'g')) = lower(regexp_replace($1, '\\s+', '', 'g'))
       ORDER BY id DESC
       LIMIT 1`,
      [cleanEmail]
    );

    let user = result.rows[0];

    // Si todavía no existe en users, pero sí existe como panel admin rentado, crea su acceso automáticamente.
    if (!user) {
      const panel = await getAdminPanelForEmail(cleanEmail);
      if (!panel) {
        return res.status(404).json({ error: "Usuario no encontrado" });
      }

      if (String(panel.status || "activo").toLowerCase() !== "activo") {
        return res.status(403).json({ error: "Panel suspendido o inactivo" });
      }

      const panelPass = await pool.query(`SELECT password FROM admin_panels WHERE id = $1`, [panel.id]);
      const matchPanel = await bcrypt.compare(password || "", panelPass.rows[0]?.password || "");
      if (!matchPanel) {
        return res.status(401).json({ error: "Contraseña incorrecta" });
      }

      const created = await pool.query(
        `INSERT INTO users (name, email, password, role, balance, is_subadmin)
         VALUES ($1, $2, $3, 'admin', 0, false)
         RETURNING *`,
        [panel.admin_name || panel.business_name || cleanEmail, cleanEmail, panelPass.rows[0].password]
      );
      user = created.rows[0];
    }

    const panel = await getAdminPanelForEmail(user.email);
    if (panel && String(panel.status || "activo").toLowerCase() !== "activo") {
      return res.status(403).json({ error: "Panel suspendido o inactivo" });
    }

    if (user.is_enabled === false) {
      return res.status(403).json({ error: "Tu acceso está deshabilitado. Contacta al administrador de tu panel." });
    }

    const match = await bcrypt.compare(password || "", user.password);

    if (!match) {
      return res.status(401).json({ error: "Contraseña incorrecta" });
    }

    const token = generateToken(user);

    res.json({ token });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Error iniciando sesión" });
  }
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
                WHEN ap.id IS NOT NULL THEN 'panel_propietario'
                WHEN COALESCE(u.is_subadmin, false) = true THEN 'admin_distribuidor'
                WHEN u.role = 'admin' THEN 'admin_global'
                ELSE 'usuario'
              END AS account_type,
              CASE
                WHEN ap.id IS NOT NULL THEN 'Panel propietario'
                WHEN COALESCE(u.is_subadmin, false) = true THEN 'Admin distribuidor'
                WHEN u.role = 'admin' THEN 'Admin global'
                ELSE 'Usuario'
              END AS role_label
       FROM users u
       LEFT JOIN admin_panels ap ON lower(ap.email) = lower(u.email)
       WHERE u.id = $1`,
      [req.user.id]
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
      const cleanProduct = {
        ...product,
        product_type: normalizeProductType(product.product_type),
        stock_enabled: normalizeProductType(product.product_type) === 'manual'
          ? Number(product.stock_enabled || 0)
          : 1,
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
    const normalizedStockEnabled = normalizedType === 'manual'
      ? ((stock_enabled === true || stock_enabled === 1 || stock_enabled === '1' || normalizedStock > 0) ? 1 : 0)
      : 1;

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
    const normalizedStockEnabled = normalizedType === 'manual'
      ? ((stock_enabled === true || stock_enabled === 1 || stock_enabled === '1' || normalizedStock > 0) ? 1 : 0)
      : 1;

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
       WHERE id = $13 AND active = 1 AND ($14::int IS NULL OR owner_admin_id = $14)`,
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

// ADMIN: ELIMINAR PRODUCTO
app.delete("/api/admin/products/:productId", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const productId = req.params.productId;

    const result = await pool.query(
      `UPDATE products SET active = 0 WHERE id = $1 AND active = 1 AND ($2::int IS NULL OR owner_admin_id = $2)`,
      [productId, req.isPanelAdmin ? req.user.id : null]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Producto no encontrado" });
    }

    res.json({ message: "Producto eliminado correctamente" });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Error eliminando producto" });
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
              ${effectiveStockExpression("p")} AS stock
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
    const enforceStock = productType === 'manual'
      ? Number(product.stock_enabled || 0) === 1
      : true;

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

      const comboCost = comboItems.reduce((sum, item) => sum + Math.max(0, Number(item.cost_price || 0)), 0);

      const orderInsertResult = await client.query(
        `INSERT INTO orders
         (user_id, product_id, amount, order_data, status, admin_response, charged, refunded, assigned_platform_account_id, delivered_account_data, product_name_snapshot, product_category_snapshot, product_cost_snapshot, owner_admin_id)
         VALUES ($1, $2, $3, $4, 'exito', $5, $6, 0, $7, $5, $8, $9, $10, $11)
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
        message: "Combo comprado correctamente. Tus cuentas fueron entregadas automáticamente en Mis pedidos.",
        delivered_account_data: deliveredAccountData
      });
    }

    const productName = String(product.name || "").trim();
    const productCategory = String(product.category || "").trim();

    console.log("Buscando cuenta para:", productName, productCategory);

    const isPlatformProduct = productType === 'streaming_auto';
    const isReusableProduct = isPdfOrCourseProduct(productName, productCategory, product.product_type, null);

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
        ? "(status = 'available' OR reusable = 1)"
        : "status = 'available'";

      const availableAccountResult = await client.query(
        `SELECT *
         FROM platform_accounts
         WHERE ${availableCondition}
           AND (
             lower(product_name) = lower($1)
             OR lower(platform) = lower($1)
             OR lower(platform) = lower($2)
           )
         ORDER BY id ASC
         LIMIT 1
         FOR UPDATE SKIP LOCKED`,
        [productName, productCategory]
      );

      assignedAccount = availableAccountResult.rows[0];

      if (!assignedAccount) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          error: "Por el momento no hay cuentas disponibles para esta plataforma. Intenta más tarde."
        });
      }

      const isReusableSale = isPdfOrCourseProduct(
        productName,
        productCategory,
        product.product_type,
        assignedAccount
      );

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
       (user_id, product_id, amount, order_data, status, admin_response, charged, refunded, assigned_platform_account_id, delivered_account_data, product_name_snapshot, product_category_snapshot, product_cost_snapshot, owner_admin_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
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
        Math.max(0, Number(product.cost_price || 0)),
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
    delivered_account_data: deliveredAccountData
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
    const query = `
      SELECT id, platform, account_email, profile_name, official_purchase_date,
             (official_purchase_date + INTERVAL '30 days') as mother_expiration
      FROM platform_accounts
      WHERE official_purchase_date IS NOT NULL
        AND (official_purchase_date + INTERVAL '30 days') <= (CURRENT_DATE + INTERVAL '5 days')
      ORDER BY mother_expiration ASC
    `;
    const result = await pool.query(query);
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
      `SELECT * FROM platform_accounts WHERE ${owner.clause} ORDER BY id DESC LIMIT $${owner.params.length + 1} OFFSET $${owner.params.length + 2}`,
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
      official_purchase_date // <-- NUEVO: Recibimos la fecha
    } = req.body;

    if (!platform || !product_name) {
      return res.status(400).json({ error: "Faltan plataforma o nombre del producto" });
    }
    
    // Si NO es reusable (es 0 o no existe), obligamos a que traiga correo y contraseña
    if (!reusable && (!account_email || !account_password)) {
      return res.status(400).json({ error: "Faltan datos obligatorios (correo y contraseña)" });
    }

    const result = await pool.query(
      // <-- NUEVO: Agregamos la columna official_purchase_date y el valor $12
      `INSERT INTO platform_accounts
       (platform, product_name, account_email, account_password, profile_name, profile_pin, extra_data, terms_conditions, access_url, status, owner_admin_id, reusable, official_purchase_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'available',$10,$11,$12)
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
        req.isPanelAdmin ? req.user.id : null,
        reusable === 1 ? 1 : 0,
        official_purchase_date || null // <-- NUEVO: Mandamos la fecha o null si está vacía
      ]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Error guardando cuenta de plataforma" });
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

  const parseRowsFromCsvText = (csvText) => {
    const expected = ["producto", "correo", "contrasena", "perfil", "pin", "fecha_compra", "cuenta_madre", "url_soporte"];
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
    const missing = expected.filter((h) => !headers.includes(h));
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
      expected.forEach((h) => {
        row[h] = String(cols[indexByHeader[h]] || "").trim();
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

      const parsedDate = fechaCompra && /^\d{4}-\d{2}-\d{2}$/.test(fechaCompra) ? fechaCompra : null;

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
        official_purchase_date: parsedDate
      });
    }

    let successCount = 0;
    for (const item of preparedRows) {
      try {
        const insertResult = await pool.query(
  `INSERT INTO platform_accounts
   (platform, product_name, account_email, account_password, profile_name, profile_pin, extra_data, terms_conditions, access_url, status, owner_admin_id, reusable, official_purchase_date)
   VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'available',$10,$11,$12)
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
    item.official_purchase_date
  ]
);

const accountId = insertResult.rows[0].id;

await addTraceEvent(pool, {
    accountId,
    eventType: "ACCOUNT_CREATED",
    userId: req.user.id,
    description: "Cuenta agregada al inventario",
    metadata: {
        platform: item.platform,
        product: item.product_name,
        email: item.account_email,
        profile: item.profile_name,
        purchase_date: item.official_purchase_date
    }
});

successCount++;
      } catch (insertErr) {
        errors.push(`Fila ${item.rowNumber}: ${insertErr.message || "Error al insertar en base de datos."}`);
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
// MIS PEDIDOS
app.get("/api/my-orders", authMiddleware, async (req, res) => {
  try {
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
        products.name AS product_name,
        products.category AS product_category,
        products.charge_mode AS charge_mode,
        products.product_type AS product_type
       FROM orders
       JOIN products ON orders.product_id = products.id
       WHERE orders.user_id = $1
       ORDER BY orders.id DESC`,
      [req.user.id]
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Error cargando pedidos" });
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
         LEFT JOIN admin_panels own_panel ON lower(own_panel.email) = lower(owner.email)
         LEFT JOIN admin_panels ap ON lower(ap.email) = lower(u.email)
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
       LEFT JOIN admin_panels own_panel ON lower(own_panel.email) = lower(owner.email)
       LEFT JOIN admin_panels ap ON lower(ap.email) = lower(u.email)
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
    const { enabled } = req.body;

    if (!userId || typeof enabled !== "boolean") {
      return res.status(400).json({ error: "ID y estado habilitado son obligatorios" });
    }

    if (userId === Number(req.user.id)) {
      return res.status(400).json({ error: "No puedes deshabilitar tu propio usuario" });
    }

    const targetResult = await pool.query(
      `SELECT id, role, owner_user_id, COALESCE(is_panel_admin, false) AS is_panel_admin
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
    const result = await pool.query(
      `SELECT id, amount, bank, reference, account_holder, proof, status, admin_response, created_at, reviewed_at
       FROM balance_requests
       WHERE user_id = $1
       ORDER BY id DESC`,
      [req.user.id]
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Error cargando solicitudes de saldo" });
  }
});

// ADMIN: SOLICITUDES DE SALDO
app.get("/api/admin/balance-requests", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
        balance_requests.id,
        balance_requests.user_id,
        balance_requests.amount,
        balance_requests.bank,
        balance_requests.reference,
        balance_requests.account_holder,
        balance_requests.proof,
        balance_requests.status,
        balance_requests.admin_response,
        balance_requests.created_at,
        balance_requests.reviewed_at,
        users.name AS customer_name,
        users.email AS customer_email
       FROM balance_requests
       JOIN users ON balance_requests.user_id = users.id
       WHERE ($1::int IS NULL OR balance_requests.owner_admin_id = $1)
       ORDER BY balance_requests.id DESC`,
      [req.isPanelAdmin ? req.user.id : null]
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Error cargando solicitudes de saldo" });
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
      `SELECT
         pa.id,
         pa.assigned_order_id AS order_id,
         pa.platform,
         pa.product_name,
         pa.account_email,
         pa.profile_name,
         pa.profile_pin,
         pa.delivered_at,
         o.created_at AS order_created_at,
         COALESCE(NULLIF(o.product_name_snapshot, ''), p.name, '') AS order_product_name
       FROM platform_accounts pa
       JOIN orders o ON o.id = pa.assigned_order_id
       LEFT JOIN products p ON p.id = o.product_id
       WHERE pa.assigned_user_id = $1
         AND o.user_id = $1
         AND o.status = 'exito'
         AND pa.status IN ('delivered','failed')
       ORDER BY o.id DESC, pa.id ASC`,
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
           p.id AS product_id,
           p.name AS product_name,
           p.category AS product_category,
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
           AND pa.status IN ('delivered','failed')
         LIMIT 1`,
        [reportedAccountId, userId]
      );

      purchase = selectedResult.rows[0] || null;
      if (!purchase) {
        return res.status(400).json({ error: "No se encontró la cuenta seleccionada en tus pedidos." });
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
    const checkDuplicate = await pool.query(
      `SELECT id FROM account_reports 
       WHERE reported_account_id = $1 
         AND status = 'pendiente' 
       LIMIT 1`,
      [purchase.account_id]
    );

    if (checkDuplicate.rows.length > 0) {
      return res.status(400).json({ 
        error: "Ya existe un reporte en proceso para esta cuenta exacta. Por favor, espera a que sea resuelto antes de enviar otro." 
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
    const result = await pool.query(
      `SELECT id, email, issue_type, description, status, admin_response, created_at, reviewed_at, order_id, reported_account_id, refund_amount, resolution_type, evidence_image
       FROM account_reports
       WHERE user_id = $1
       ORDER BY id DESC`,
      [req.user.id]
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Error cargando reportes de cuenta" });
  }
});

// ADMIN: REPORTES DE CUENTA
app.get("/api/admin/account-reports", authMiddleware, adminMiddleware, async (req, res) => {
  try {
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
        account_reports.refund_amount,
        account_reports.resolution_type,
        account_reports.evidence_image, /* <--- CÁMBIALO PARA QUE COINCIDA */
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
       ORDER BY account_reports.id DESC`
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Error cargando reportes de cuenta" });
  }
});


// CUENTAS DEL PEDIDO DE UN REPORTE
app.get("/api/admin/account-reports/:reportId/order-accounts", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const reportId = Number(req.params.reportId || 0);
    const reportResult = await pool.query(
      `SELECT id, order_id, reported_account_id
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
              pa.platform, pa.product_name AS account_product_name,
              COALESCE(ar.owner_admin_id, o.owner_admin_id, pa.owner_admin_id, p.owner_admin_id) AS resolved_owner_admin_id
       FROM account_reports ar
       JOIN orders o ON o.id = ar.order_id
       JOIN products p ON p.id = o.product_id
       LEFT JOIN platform_accounts pa ON pa.id = COALESCE(NULLIF($2,0), ar.reported_account_id)
       WHERE ar.id = $1
       LIMIT 1`,
      [reportId, selectedAccountId]
    );

    const report = reportResult.rows[0];
    if (!report) return res.status(404).json({ error: "Reporte no encontrado" });

    const ownerAdminId = report.resolved_owner_admin_id || null;
    const platform = report.platform || report.account_product_name || report.reported_platform || report.product_name || report.product_category || "";

    const optionsResult = await pool.query(
      `SELECT id, platform, product_name, account_email, profile_name, profile_pin, created_at
       FROM platform_accounts
       WHERE status = 'available'
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
      [platform, ownerAdminId]
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

    const reportResult = await client.query(
      `SELECT ar.*, o.amount, o.product_id, o.created_at AS order_created_at,
              o.owner_admin_id AS order_owner_admin_id,
              p.name AS product_name, p.category AS product_category,
              p.owner_admin_id AS product_owner_admin_id,
              pa.platform, pa.product_name AS account_product_name, pa.account_email,
              pa.owner_admin_id AS reported_account_owner_admin_id,
              COALESCE(ar.owner_admin_id, o.owner_admin_id, p.owner_admin_id, pa.owner_admin_id) AS resolved_owner_admin_id
       FROM account_reports ar
       JOIN orders o ON o.id = ar.order_id
       JOIN products p ON p.id = o.product_id
       LEFT JOIN platform_accounts pa ON pa.id = ar.reported_account_id
       WHERE ar.id = $1
       FOR UPDATE OF ar, o`,
      [reportId]
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

    // --- NUEVA LÓGICA: CALCULAR DÍAS RESTANTES ---
    const purchaseDate = new Date(report.order_created_at);
    const now = new Date();
    const msPerDay = 24 * 60 * 60 * 1000;
    const daysUsed = Math.max(0, Math.ceil((now - purchaseDate) / msPerDay));
    const daysRemaining = Math.max(0, 28 - daysUsed); 
    const expirationDate = new Date(now.getTime() + (daysRemaining * msPerDay));
    // ----------------------------------------------

    const ownerAdminId = report.resolved_owner_admin_id || null;
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
          expirationDate,
          String(official_purchase_date || '').trim() || null
        ]
      );

      newAccount = insertAccountResult.rows[0];
    } else {
      let availableResult;

      if (Number(replacement_account_id || 0) > 0) {
        availableResult = await client.query(
          `SELECT * FROM platform_accounts
           WHERE id = $1 AND status = 'available'
             AND (lower(platform) = lower($2) OR lower(product_name) = lower($2) OR lower(platform) LIKE '%' || lower($2) || '%' OR lower($2) LIKE '%' || lower(platform) || '%' OR lower(product_name) LIKE '%' || lower($2) || '%' OR lower($2) LIKE '%' || lower(product_name) || '%')
             AND (owner_admin_id = $3 OR owner_admin_id IS NULL OR owner_admin_id = 0 OR $3::int IS NULL)
           LIMIT 1 FOR UPDATE`,
          [Number(replacement_account_id), replacementPlatform, ownerAdminId]
        );
      } else {
        availableResult = await client.query(
          `SELECT * FROM platform_accounts
           WHERE status = 'available'
             AND (lower(platform) = lower($1) OR lower(product_name) = lower($1) OR lower(platform) LIKE '%' || lower($1) || '%' OR lower($1) LIKE '%' || lower(platform) || '%' OR lower(product_name) LIKE '%' || lower($1) || '%' OR lower($1) LIKE '%' || lower(product_name) || '%')
             AND (owner_admin_id = $2 OR owner_admin_id IS NULL OR owner_admin_id = 0 OR $2::int IS NULL)
           ORDER BY id ASC LIMIT 1 FOR UPDATE SKIP LOCKED`,
          [replacementPlatform, ownerAdminId]
        );
      }

      newAccount = availableResult.rows[0];

      if (!newAccount) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: "No hay cuenta disponible válida para esa plataforma. Puedes capturar una cuenta manual." });
      }

      await client.query(
        `UPDATE platform_accounts
         SET status = 'delivered', assigned_order_id = $1, assigned_user_id = $2, delivered_at = NOW(), expires_at = $4
         WHERE id = $3`,
        [report.order_id, report.user_id, newAccount.id, expirationDate]
      );
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

     const deliveredAccountData = buildDeliveredAccountData(newAccount, report.product_name, report.product_category, report.order_created_at);
    
       if (report.reported_account_id) {
      await client.query(
        `UPDATE platform_accounts SET status = 'failed' WHERE id = $1`,
        [report.reported_account_id]
      );
    }

    await client.query(
      `UPDATE orders
       SET assigned_platform_account_id = $1, delivered_account_data = $2, admin_response = $2, status = 'exito', owner_admin_id = COALESCE(owner_admin_id, $4)
       WHERE id = $3`,
      [newAccount.id, deliveredAccountData, report.order_id, ownerAdminId]
    );

    await client.query(
      `UPDATE account_reports
       SET reported_account_id = $1, owner_admin_id = COALESCE(owner_admin_id, $4), status = 'reemplazo', resolution_type = 'reemplazo', admin_response = $2, reviewed_at = NOW()
       WHERE id = $3`,
      [
        newAccount.id,
        `Cuenta reemplazada correctamente (Días restantes: ${daysRemaining}).\n\n${deliveredAccountData}`,
        reportId,
        ownerAdminId
      ]
    );

    await client.query("COMMIT");
    transactionStarted = false;

    res.json({
      message: manual === true || manual === "true" ? "Cuenta manual agregada y reemplazada correctamente" : "Cuenta reemplazada correctamente",
      delivered_account_data: deliveredAccountData,
      platform_account_id: newAccount.id
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

    await client.query(
      `UPDATE platform_accounts SET status = 'failed' WHERE id = $1`,
      [report.reported_account_id]
    );

    await client.query(
      `UPDATE account_reports
       SET status = 'reembolso',
           resolution_type = 'reembolso',
           refund_amount = $1,
           admin_response = $2,
           reviewed_at = NOW()
       WHERE id = $3`,
      [refundAmount, `Reembolso proporcional aplicado: $${refundAmount.toFixed(2)}. Días usados: ${daysUsed}. Días restantes: ${daysRemaining}.`, reportId]
    );

    await client.query("COMMIT");
    transactionStarted = false;

    res.json({ message: `Reembolso aplicado por $${refundAmount.toFixed(2)}`, refund_amount: refundAmount, days_used: daysUsed, days_remaining: daysRemaining });
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

    await client.query(`UPDATE platform_accounts SET status = 'failed' WHERE id = $1`, [report.reported_account_id]);

    await client.query(
      `UPDATE account_reports
       SET status = 'reembolso',
           resolution_type = 'reembolso',
           refund_amount = $1,
           admin_response = $2,
           reviewed_at = NOW()
       WHERE id = $3`,
      [amountPaid, `Reembolso completo aplicado: $${amountPaid.toFixed(2)}`, reportId]
    );

    await client.query("COMMIT");
    transactionStarted = false;

    res.json({ message: `Reembolso completo aplicado por $${amountPaid.toFixed(2)}`, refund_amount: amountPaid });
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
      rows: result.rows,
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
      pool.query(`SELECT COUNT(*)::int AS total FROM products WHERE active = 1`),
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
       LEFT JOIN admin_panels own_panel ON lower(own_panel.email) = lower(owner.email)
       LEFT JOIN admin_panels ap ON lower(ap.email) = lower(u.email)
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

    const costExpr = `COALESCE(NULLIF(orders.product_cost_snapshot, 0), products.cost_price, 0)`;
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
    const likeSearch = `%${lowerSearch}%`;
    const likeRawSearch = `%${search}%`;
    const normalizedSearch = lowerSearch.replace(/\s+/g, '');
    const likeNormalizedSearch = `%${normalizedSearch}%`;

        const query = `
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
                pa.official_purchase_date AS fecha_compra,
                pa.delivered_at AS fecha_entrega,
                pa.assigned_order_id,
                pa.assigned_user_id,
                COALESCE(u.name, '') AS comprador_nombre,
                COALESCE(u.email, '') AS comprador_email,
                COALESCE(u.role, '') AS comprador_rol,
                o.id AS orden_id,
                o.status AS orden_status,
                o.created_at AS orden_creada,
                o.amount AS orden_amount
            FROM platform_accounts pa
            LEFT JOIN orders o ON pa.assigned_order_id = o.id
            LEFT JOIN users u ON pa.assigned_user_id = u.id
            WHERE lower(pa.account_email) LIKE $1
              OR regexp_replace(lower(COALESCE(pa.account_email, '')), '\\s+', '', 'g') LIKE $3
              OR lower(pa.profile_name) LIKE $1
              OR regexp_replace(lower(COALESCE(pa.profile_name, '')), '\\s+', '', 'g') LIKE $3
              OR lower(pa.profile_pin) LIKE $1
              OR regexp_replace(lower(COALESCE(pa.profile_pin, '')), '\\s+', '', 'g') LIKE $3
              OR lower(COALESCE(u.email, '')) LIKE $1
              OR regexp_replace(lower(COALESCE(u.email, '')), '\\s+', '', 'g') LIKE $3
              OR lower(COALESCE(u.name, '')) LIKE $1
              OR regexp_replace(lower(COALESCE(u.name, '')), '\\s+', '', 'g') LIKE $3
               OR pa.assigned_order_id::text LIKE $2
               OR o.id::text LIKE $2
            ORDER BY pa.created_at ASC, pa.delivered_at ASC;
        `;

        const result = await pool.query(query, [likeSearch, likeRawSearch, likeNormalizedSearch]);
        const rows = result.rows || [];

        res.json({ events: rows });
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
         COALESCE(NULLIF(orders.product_cost_snapshot, 0), products.cost_price, 0) AS cost_price,
         (orders.amount - COALESCE(NULLIF(orders.product_cost_snapshot, 0), products.cost_price, 0)) AS profit,
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
    if (!userId) return res.status(400).json({ error: "Selecciona un usuario" });
    const scopeOwnerId = getReportScopeOwnerId(req);
    const params = [userId, scopeOwnerId];
    let dateSql = '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(startDate) && /^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
      params.push(startDate, endDate);
      dateSql = ' AND orders.created_at::date >= $3::date AND orders.created_at::date <= $4::date ';
    }
    const result = await pool.query(
      `SELECT orders.id, orders.amount, orders.status, orders.admin_response, orders.order_data, orders.delivered_account_data, orders.created_at,
              COALESCE(NULLIF(orders.product_name_snapshot, ''), products.name) AS product_name,
              users.name AS customer_name, users.email AS customer_email
       FROM orders
       JOIN users ON users.id = orders.user_id
       JOIN products ON products.id = orders.product_id
       WHERE orders.user_id = $1
         AND ($2::int IS NULL OR orders.owner_admin_id = $2 OR users.owner_user_id = $2 OR users.id = $2)
         ${dateSql}
       ORDER BY orders.created_at DESC`,
      params
    );
    res.json({ records: result.rows });
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
      bank_name: "Mercado Pago",
      bank_holder: "Pedro Garcia Diaz",
      bank_clabe: "722969020555596471",
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
              expires_at, created_at, updated_at
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
    const {
      business_name,
      admin_name,
      email,
      password,
      phone,
      bank_name,
      bank_holder,
      bank_clabe,
      payment_concept,
      notification_email,
      status,
      plan_type,
      expires_at
    } = req.body;

    const cleanEmail = String(email || "").trim().toLowerCase();
    const cleanPassword = String(password || "").trim();

    if (!cleanEmail) {
      return res.status(400).json({ error: "El correo del admin es obligatorio" });
    }

    if (!cleanPassword || cleanPassword.length < 6) {
      return res.status(400).json({ error: "La contraseña debe tener mínimo 6 caracteres" });
    }

    const exists = await pool.query(`SELECT id FROM admin_panels WHERE lower(email) = lower($1)`, [cleanEmail]);
    if (exists.rows.length) {
      return res.status(400).json({ error: "Este correo ya tiene un panel admin registrado" });
    }

    const hashedPassword = await bcrypt.hash(cleanPassword, 10);

    const result = await pool.query(
      `INSERT INTO admin_panels
       (business_name, admin_name, email, password, phone, bank_name, bank_holder,
        bank_clabe, payment_concept, notification_email, status, plan_type, expires_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING id, business_name, admin_name, email, phone, bank_name, bank_holder,
                 bank_clabe, payment_concept, notification_email, status, plan_type,
                 expires_at, created_at, updated_at`,
      [
        String(business_name || "").trim(),
        String(admin_name || "").trim(),
        cleanEmail,
        hashedPassword,
        String(phone || "").trim(),
        String(bank_name || "").trim(),
        String(bank_holder || "").trim(),
        String(bank_clabe || "").trim(),
        String(payment_concept || "").trim(),
        String(notification_email || "").trim(),
        String(status || "activo").trim() || "activo",
        String(plan_type || "renta").trim() || "renta",
        expires_at || null
      ]
    );

    await pool.query(
      `INSERT INTO users (name, email, password, role, balance, is_subadmin)
       VALUES ($1, $2, $3, 'admin', 0, false)
       ON CONFLICT (email) DO UPDATE
       SET name = EXCLUDED.name,
           password = EXCLUDED.password,
           role = 'admin',
           is_subadmin = false
       RETURNING id`,
      [String(admin_name || business_name || cleanEmail).trim() || cleanEmail, cleanEmail, hashedPassword]
    );

    res.json({
      message: "Panel admin creado correctamente y acceso habilitado",
      panel: result.rows[0]
    });
  } catch (err) {
    console.error("Error creando panel admin:", err.message);
    res.status(500).json({ error: "Error creando panel admin" });
  }
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
