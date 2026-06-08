const express = require("express");
const { Pool } = require("pg");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const bodyParser = require("body-parser");
const cors = require("cors");

const app = express();

const PORT = process.env.PORT || 3000;
const SECRET = process.env.JWT_SECRET || "mi_super_secreto";

app.use(bodyParser.json({ limit: "10mb" }));
app.use(cors());
app.use(express.static("public"));

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

    if (!user || (user.role !== "admin" && user.is_subadmin !== true)) {
      return res.status(403).json({ error: "Distribuidor requerido" });
    }

    req.distributor = user;
    next();
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Error validando distribuidor" });
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
            ap.notification_email, ap.status AS admin_panel_status
     FROM users u
     LEFT JOIN admin_panels ap ON lower(ap.email) = lower(u.email)
     WHERE u.id = $1`,
    [userId]
  );
  const viewer = result.rows[0] || null;
  if (!viewer) return null;
  viewer.is_panel_admin = Boolean(viewer.admin_panel_id);
  viewer.owner_admin_id = viewer.is_panel_admin ? viewer.id : (viewer.owner_user_id || null);
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
  if (viewer && viewer.is_panel_admin) {
    return { clause: `${prefix}owner_admin_id = $1`, params: [viewer.id] };
  }
  if (viewer && viewer.owner_user_id) {
    return { clause: `${prefix}owner_admin_id = $1`, params: [viewer.owner_user_id] };
  }
  return { clause: `(${prefix}owner_admin_id IS NULL OR ${prefix}owner_admin_id = 0)`, params: [] };
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


  await pool.query(`
    CREATE TABLE IF NOT EXISTS announcements (
      id SERIAL PRIMARY KEY,
      message TEXT NOT NULL,
      active INTEGER DEFAULT 1,
      owner_admin_id INTEGER,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await pool.query(`ALTER TABLE announcements ADD COLUMN IF NOT EXISTS owner_admin_id INTEGER`);


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
  await pool.query(`UPDATE products SET cost_price = 0 WHERE cost_price IS NULL`);
  await pool.query(`UPDATE products SET active = 1 WHERE active IS NULL`);
  await pool.query(`UPDATE products SET category = 'Otros' WHERE category IS NULL`);
  await pool.query(`UPDATE products SET required_fields = '[]' WHERE required_fields IS NULL`);
  await pool.query(`UPDATE products SET charge_mode = 'on_purchase' WHERE charge_mode IS NULL`);
  await pool.query(`UPDATE products SET stock_enabled = 0 WHERE stock_enabled IS NULL`);
  await pool.query(`UPDATE products SET stock = 0 WHERE stock IS NULL`);
  await pool.query(`UPDATE products SET product_type = 'streaming_auto' WHERE product_type IS NULL OR product_type = ''`);
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

function buildDeliveredAccountData(assignedAccount, productName = "", productCategory = "") {
  const fechaEntrega = new Date();
  const fechaVencimiento = new Date(fechaEntrega);
  fechaVencimiento.setDate(fechaVencimiento.getDate() + 28);

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
    `SELECT id, name, description, price, cost_price, category, required_fields, charge_mode, active, stock_enabled, stock, product_type, combo_items, combo_discount
     FROM products
     WHERE id = ANY($1::int[]) AND active = 1`,
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
         VALUES ($1, $2, $3, 'admin', 0, true)
         RETURNING *`,
        [panel.admin_name || panel.business_name || cleanEmail, cleanEmail, panelPass.rows[0].password]
      );
      user = created.rows[0];
    }

    const panel = await getAdminPanelForEmail(user.email);
    if (panel && String(panel.status || "activo").toLowerCase() !== "activo") {
      return res.status(403).json({ error: "Panel suspendido o inactivo" });
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
              CASE WHEN ap.id IS NULL THEN false ELSE true END AS is_panel_admin
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
    const owner = adminOwnedWhere(viewer, "products");

    const result = await pool.query(
      `SELECT id, name, description, price, cost_price, category, required_fields, charge_mode, active, stock_enabled, stock, product_type, combo_items, combo_discount, owner_admin_id
       FROM products
       WHERE active = 1 AND ${owner.clause}
       ORDER BY category ASC, name ASC`,
      owner.params
    );

    const products = [];

    for (const product of result.rows) {
      const effectivePrice = String(product.product_type || '').toLowerCase() === 'combo_auto'
        ? await calculateComboPrice(pool, viewer, product)
        : await getEffectiveProductPrice(pool, viewer, product);
      const cleanProduct = {
        ...product,
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
        stock_enabled ? 1 : 0,
        Math.max(0, Number(stock || 0)),
        ['streaming_auto','manual','combo_auto'].includes(product_type) ? product_type : 'streaming_auto',
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
        stock_enabled ? 1 : 0,
        Math.max(0, Number(stock || 0)),
        ['streaming_auto','manual','combo_auto'].includes(product_type) ? product_type : 'streaming_auto',
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

    const viewerContext = await getViewerContext(userId, client);
    const ownerFilter = adminOwnedWhere(viewerContext, "products");
    const productResult = await client.query(
      `SELECT * FROM products WHERE id = $1 AND active = 1 AND ${ownerFilter.clause} FOR UPDATE`,
      [productId, ...ownerFilter.params]
    );

    const product = productResult.rows[0];

    if (!product) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Producto no encontrado" });
    }

    if (Number(product.stock_enabled || 0) === 1 && Number(product.stock || 0) <= 0) {
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

    const isComboProduct = String(product.product_type || '').toLowerCase() === 'combo_auto';
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

      if (Number(product.stock_enabled || 0) === 1) {
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

    const platformCountResult = await client.query(
      `SELECT COUNT(*)::int AS total
       FROM platform_accounts
       WHERE lower(product_name) = lower($1)
          OR lower(platform) = lower($1)
          OR lower(platform) = lower($2)`,
      [productName, productCategory]
    );

    const isPlatformProduct = Number(platformCountResult.rows[0]?.total || 0) > 0;
    let assignedAccount = null;
    let deliveredAccountData = "";
    let orderStatus = "accion_en_espera";
    let adminResponse = "";

    if (isPlatformProduct) {
      const availableAccountResult = await client.query(
        `SELECT *
         FROM platform_accounts
         WHERE status = 'available'
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

      const fechaEntrega = new Date();
      const fechaVencimiento = new Date(fechaEntrega);
      fechaVencimiento.setDate(fechaVencimiento.getDate() + 28);

      function formatFechaMX(fecha) {
        return fecha.toLocaleDateString("es-MX", {
          timeZone: "America/Mexico_City",
          day: "2-digit",
          month: "2-digit",
          year: "2-digit"
        });
      }

      deliveredAccountData = [
        "🎬 Cuenta de Streaming Entregada",
        "",
        `📌 Plataforma: ${String(assignedAccount.platform || productCategory || productName || "").toUpperCase()}`,
        `📧 Correo: ${assignedAccount.account_email || ""}`,
        `🔐 Contraseña: ${assignedAccount.account_password || ""}`,
        `👤 Perfil: ${assignedAccount.profile_name || "No aplica"}`,
        `🔢 PIN de acceso: ${assignedAccount.profile_pin || "No aplica"}`,
        `📅 Fecha de entrega: ${formatFechaMX(fechaEntrega)}`,
        `📅 Fecha de vencimiento: ${formatFechaMX(fechaVencimiento)}`,
        assignedAccount.access_url ? `🔗 URL para código/soporte: ${assignedAccount.access_url}` : null,
        "",
        "📌 Normas de uso:",
        "✅ No editar datos de acceso",
        "✅ No cambiar el nombre ni el código del perfil",
        "✅ Uso exclusivo en un solo equipo",
        "✅ No compartir el acceso con otros",
        "",
        "Evita incumplir estas reglas para mantener el servicio activo sin inconvenientes."
      ].filter(line => line !== null && line !== undefined).join("\n");

      orderStatus = "exito";
      adminResponse = deliveredAccountData;
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
      await client.query(
        `UPDATE platform_accounts
         SET status = 'delivered', assigned_order_id = $1, assigned_user_id = $2, delivered_at = NOW()
         WHERE id = $3`,
        [newOrderId, userId, assignedAccount.id]
      );
    }

    if (Number(product.stock_enabled || 0) === 1) {
      await client.query(
        `UPDATE products SET stock = stock - 1 WHERE id = $1 AND stock > 0`,
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

    if (assignedAccount) {
      return res.json({
        message: "Compra realizada correctamente. Tu cuenta fue entregada automáticamente en Mis pedidos.",
        delivered_account_data: deliveredAccountData
      });
    }

    if (charged === 1) {
      return res.json({
        message: `Compra realizada correctamente. Se descontaron $${price.toFixed(2)} de tu saldo.`
      });
    }

    return res.json({
      message: "Pedido creado correctamente. El saldo se descontará cuando el admin marque Éxito."
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err.message);
    res.status(500).json({ error: "Error creando pedido" });
  } finally {
    client.release();
  }
});

// CUENTAS DE PLATAFORMAS - ADMIN
app.get("/api/admin/platform-accounts", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const owner = req.isPanelAdmin
      ? { clause: "owner_admin_id = $1", params: [req.user.id] }
      : { clause: "(owner_admin_id IS NULL OR owner_admin_id = 0)", params: [] };
    const result = await pool.query(
      `SELECT * FROM platform_accounts WHERE ${owner.clause} ORDER BY id DESC`,
      owner.params
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Error obteniendo cuentas de plataformas" });
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
      access_url
    } = req.body;

    if (!platform || !product_name || !account_email || !account_password) {
      return res.status(400).json({ error: "Faltan datos obligatorios" });
    }

    const result = await pool.query(
      `INSERT INTO platform_accounts
       (platform, product_name, account_email, account_password, profile_name, profile_pin, extra_data, terms_conditions, access_url, status, owner_admin_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'available',$10)
       RETURNING *`,
      [platform, product_name, account_email, account_password, profile_name || "", profile_pin || "", extra_data || "", terms_conditions || "", access_url || "", req.isPanelAdmin ? req.user.id : null]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Error guardando cuenta de plataforma" });
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
        `SELECT id, name, email, role, balance, COALESCE(is_subadmin, false) AS is_subadmin, owner_user_id
         FROM users
         WHERE owner_user_id = $1
         ORDER BY id DESC`,
        [req.user.id]
      );
    } else {
      result = await pool.query(
        `SELECT id, name, email, role, balance, COALESCE(is_subadmin, false) AS is_subadmin, owner_user_id FROM users ORDER BY id DESC`
      );
    }

    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Error cargando usuarios" });
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
      `SELECT id, balance FROM users WHERE id = $1 FOR UPDATE`,
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
      return res.json({ message: `Solicitud aprobada. Se agregaron $${amountNumber.toFixed(2)} al cliente.` });
    }

    if (status === "rechazado") {
      return res.json({ message: "Solicitud rechazada correctamente." });
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


// USUARIO: REPORTAR PROBLEMA DE CUENTA
async function createAccountReportHandler(req, res) {
  try {
    const userId = req.user.id;
    const email = String(req.body.email || req.body.correo || "").trim();
    const issue_type = String(req.body.issue_type || req.body.tipo || "otro").trim();
    const description = String(req.body.description || req.body.explicacion || "").trim();

    if (!email || !description) {
      return res.status(400).json({ error: "Correo y explicación de la falla son obligatorios" });
    }

    let purchase = await findReportedPurchase(pool, userId, email);

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

    const insertResult = await pool.query(
      `INSERT INTO account_reports
       (user_id, email, issue_type, description, status, admin_response, order_id, reported_account_id, refund_amount, resolution_type)
       VALUES ($1, $2, $3, $4, 'pendiente', '', $5, $6, 0, '')
       RETURNING id`,
      [userId, email, issue_type || "otro", description, purchase.order_id, purchase.account_id]
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
      message: "Reporte enviado. El administrador revisará la falla y dará el veredicto final."
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
      `SELECT id, email, issue_type, description, status, admin_response, created_at, reviewed_at, order_id, reported_account_id, refund_amount, resolution_type
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


// ADMIN: REEMPLAZAR CUENTA REPORTADA
app.post("/api/admin/account-reports/:reportId/replace", authMiddleware, adminMiddleware, async (req, res) => {
  const client = await pool.connect();
  let transactionStarted = false;

  try {
    const reportId = req.params.reportId;
    await client.query("BEGIN");
    transactionStarted = true;

    const reportResult = await client.query(
      `SELECT ar.*, o.amount, o.product_id, o.created_at AS order_created_at,
              p.name AS product_name, p.category AS product_category,
              pa.platform, pa.product_name AS account_product_name, pa.account_email
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

    if (!report.order_id || !report.reported_account_id) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Este reporte no está ligado a un pedido entregado automáticamente" });
    }

    const matchProduct = report.account_product_name || report.product_name;
    const matchPlatform = report.platform || report.product_category || report.product_name;

    const availableResult = await client.query(
      `SELECT *
       FROM platform_accounts
       WHERE status = 'available'
         AND (
           lower(product_name) = lower($1)
           OR lower(platform) = lower($1)
           OR lower(platform) = lower($2)
           OR lower(product_name) = lower($2)
         )
       ORDER BY id ASC
       LIMIT 1
       FOR UPDATE SKIP LOCKED`,
      [matchProduct, matchPlatform]
    );

    const newAccount = availableResult.rows[0];

    if (!newAccount) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "No hay otra cuenta disponible para reemplazar esta plataforma" });
    }

    const deliveredAccountData = buildDeliveredAccountData(newAccount, report.product_name, report.product_category);

    await client.query(
      `UPDATE platform_accounts
       SET status = 'failed'
       WHERE id = $1`,
      [report.reported_account_id]
    );

    await client.query(
      `UPDATE platform_accounts
       SET status = 'delivered', assigned_order_id = $1, assigned_user_id = $2, delivered_at = NOW()
       WHERE id = $3`,
      [report.order_id, report.user_id, newAccount.id]
    );

    await client.query(
      `UPDATE orders
       SET assigned_platform_account_id = $1,
           delivered_account_data = $2,
           admin_response = $2,
           status = 'exito'
       WHERE id = $3`,
      [newAccount.id, deliveredAccountData, report.order_id]
    );

    const replacementResponse = `Cuenta reemplazada correctamente.

${deliveredAccountData}`;

    await client.query(
      `UPDATE account_reports
       SET status = 'reemplazo',
           resolution_type = 'reemplazo',
           admin_response = $1,
           reviewed_at = NOW()
       WHERE id = $2`,
      [replacementResponse, reportId]
    );

    await client.query("COMMIT");
    transactionStarted = false;

    res.json({ message: "Cuenta reemplazada correctamente", delivered_account_data: deliveredAccountData });
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
       ORDER BY orders.id DESC`,
      [req.isPanelAdmin ? req.user.id : null]
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Error cargando pedidos de admin" });
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
      `SELECT id, balance FROM users WHERE id = $1 FOR UPDATE`,
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
    const userId = req.params.userId;
    const isSubadmin = req.body.is_subadmin === true;

    const result = await pool.query(
      `UPDATE users SET is_subadmin = $1 WHERE id = $2 AND role <> 'admin'
       RETURNING id, name, email, role, balance, COALESCE(is_subadmin, false) AS is_subadmin, owner_user_id`,
      [isSubadmin, userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Usuario no encontrado o no se puede modificar" });
    }

    res.json({ message: isSubadmin ? "Usuario convertido en admin independiente" : "Admin independiente desactivado", user: result.rows[0] });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Error actualizando admin independiente" });
  }
});

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
      `SELECT id, name, email, role, balance, owner_user_id, created_at
       FROM users
       WHERE owner_user_id = $1
       ORDER BY id DESC`,
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
             is_subadmin = FALSE
         WHERE id = $4
         RETURNING id, name, email, role, balance, owner_user_id`,
        [cleanName, hashedPassword, req.user.id, existingUser.id, cleanEmail]
      );

      user = updated.rows[0];
      return res.json({ message: "Vendedor actualizado y acceso habilitado correctamente", user });
    }

    const result = await pool.query(
      `INSERT INTO users (name, email, password, role, balance, owner_user_id, is_subadmin)
       VALUES ($1, $2, $3, 'user', 0, $4, FALSE)
       RETURNING id, name, email, role, balance, owner_user_id`,
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
           is_subadmin = FALSE
       WHERE id = $3
         AND (owner_user_id = $2 OR owner_user_id IS NULL OR owner_user_id = 0)
       RETURNING id, name, email, role, balance, owner_user_id`,
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
             is_subadmin = FALSE
         WHERE id = $5
         RETURNING id, name, email, role, balance, owner_user_id`,
        [cleanName, cleanEmail, hashedPassword, req.user.id, existingUser.id]
      );
    } else {
      result = await pool.query(
        `INSERT INTO users (name, email, password, role, balance, owner_user_id, is_subadmin)
         VALUES ($1, $2, $3, 'user', 0, $4, FALSE)
         RETURNING id, name, email, role, balance, owner_user_id`,
        [cleanName, cleanEmail, hashedPassword, req.user.id]
      );
    }

    res.json({ message: "Acceso reparado correctamente. Ya puede iniciar sesión con esa contraseña.", user: result.rows[0] });
  } catch (err) {
    console.error("Error reparando acceso por correo:", err.message);
    res.status(500).json({ error: "Error reparando acceso por correo" });
  }
});

app.get("/api/distributor/prices", authMiddleware, distributorMiddleware, async (req, res) => {
  try {
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
    const params = [selectedDate];

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
         AND ${dateCondition}`,
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

// COMUNICADOS GLOBALES: visibles para todos los usuarios con sesión
app.get("/api/announcements", authMiddleware, async (req, res) => {
  try {
    const viewer = await getViewerContext(req.user.id);
    const owner = viewer?.owner_admin_id || null;
    const result = await pool.query(
      `SELECT id, message, active, created_at
       FROM announcements
       WHERE active = 1
         AND (($1::int IS NULL AND owner_admin_id IS NULL) OR owner_admin_id = $1)
       ORDER BY id DESC
       LIMIT 10`,
      [owner]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Error cargando comunicados" });
  }
});

// ADMIN: listar comunicados
app.get("/api/admin/announcements", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const owner = req.isPanelAdmin ? req.user.id : null;
    const result = await pool.query(
      `SELECT id, message, active, created_at
       FROM announcements
       WHERE (($1::int IS NULL AND owner_admin_id IS NULL) OR owner_admin_id = $1)
       ORDER BY id DESC
       LIMIT 50`,
      [owner]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Error cargando comunicados" });
  }
});

// ADMIN: crear comunicado
app.post("/api/admin/announcements", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const message = String(req.body.message || "").trim();
    if (!message) return res.status(400).json({ error: "El comunicado es obligatorio" });

    const result = await pool.query(
      `INSERT INTO announcements (message, active, owner_admin_id) VALUES ($1, 1, $2) RETURNING id, message, active, created_at`,
      [message, req.isPanelAdmin ? req.user.id : null]
    );
    res.json({ message: "Comunicado publicado", announcement: result.rows[0] });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Error creando comunicado" });
  }
});

// ADMIN: activar / ocultar comunicado
app.patch("/api/admin/announcements/:id", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const active = Number(req.body.active) === 1 ? 1 : 0;
    const result = await pool.query(
      `UPDATE announcements SET active = $1 WHERE id = $2 AND (($3::int IS NULL AND owner_admin_id IS NULL) OR owner_admin_id = $3) RETURNING id, message, active, created_at`,
      [active, id, req.isPanelAdmin ? req.user.id : null]
    );
    if (!result.rows[0]) return res.status(404).json({ error: "Comunicado no encontrado" });
    res.json({ message: "Comunicado actualizado", announcement: result.rows[0] });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Error actualizando comunicado" });
  }
});

// ADMIN: eliminar comunicado
app.delete("/api/admin/announcements/:id", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const id = Number(req.params.id);
    await pool.query(`DELETE FROM announcements WHERE id = $1 AND (($2::int IS NULL AND owner_admin_id IS NULL) OR owner_admin_id = $2)`, [id, req.isPanelAdmin ? req.user.id : null]);
    res.json({ message: "Comunicado eliminado" });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Error eliminando comunicado" });
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
       VALUES ($1, $2, $3, 'admin', 0, true)
       ON CONFLICT (email) DO UPDATE
       SET name = EXCLUDED.name,
           password = EXCLUDED.password,
           role = 'admin',
           is_subadmin = true
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


initDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Servidor corriendo en puerto ${PORT}`);
    });
  })
  .catch(err => {
    console.error("Error iniciando base de datos:", err.message);
    process.exit(1);
  });
