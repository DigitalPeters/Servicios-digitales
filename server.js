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


async function sendBalanceRequestEmail({ requestId, customerName, customerEmail, amount, bank, reference, accountHolder, proof }) {
  try {
    if (!isMailConfigured()) {
      console.log("Correo NO enviado: faltan variables RESEND_API_KEY, NOTIFY_EMAIL o FROM_EMAIL.");
      return;
    }

    const { apiKey, notifyTo, fromEmail } = getMailConfig();

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

function adminMiddleware(req, res, next) {
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Admin requerido" });
  }

  next();
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
      cost_price NUMERIC DEFAULT 0,
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
      status VARCHAR(30) DEFAULT 'available',
      assigned_order_id INTEGER,
      assigned_user_id INTEGER,
      delivered_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user'`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS balance NUMERIC DEFAULT 0`);

  await pool.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS description TEXT`);
  await pool.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS cost_price NUMERIC DEFAULT 0`);
  await pool.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'Otros'`);
  await pool.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS required_fields TEXT DEFAULT '[]'`);
  await pool.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS charge_mode TEXT DEFAULT 'on_purchase'`);
  await pool.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS active INTEGER DEFAULT 1`);
  await pool.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS stock_enabled INTEGER DEFAULT 0`);
  await pool.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS stock INTEGER DEFAULT 0`);

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
  await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS cost_price_snapshot NUMERIC DEFAULT 0`);

  await pool.query(`ALTER TABLE platform_accounts ADD COLUMN IF NOT EXISTS platform VARCHAR(100)`);
  await pool.query(`ALTER TABLE platform_accounts ADD COLUMN IF NOT EXISTS product_name VARCHAR(150)`);
  await pool.query(`ALTER TABLE platform_accounts ADD COLUMN IF NOT EXISTS account_email VARCHAR(255)`);
  await pool.query(`ALTER TABLE platform_accounts ADD COLUMN IF NOT EXISTS account_password VARCHAR(255)`);
  await pool.query(`ALTER TABLE platform_accounts ADD COLUMN IF NOT EXISTS profile_name VARCHAR(100)`);
  await pool.query(`ALTER TABLE platform_accounts ADD COLUMN IF NOT EXISTS profile_pin VARCHAR(50)`);
  await pool.query(`ALTER TABLE platform_accounts ADD COLUMN IF NOT EXISTS extra_data TEXT`);
  await pool.query(`ALTER TABLE platform_accounts ADD COLUMN IF NOT EXISTS terms_conditions TEXT`);
  await pool.query(`ALTER TABLE platform_accounts ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'available'`);
  await pool.query(`ALTER TABLE platform_accounts ADD COLUMN IF NOT EXISTS assigned_order_id INTEGER`);
  await pool.query(`ALTER TABLE platform_accounts ADD COLUMN IF NOT EXISTS assigned_user_id INTEGER`);
  await pool.query(`ALTER TABLE platform_accounts ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP`);
  await pool.query(`ALTER TABLE platform_accounts ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW()`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_platform_accounts_available ON platform_accounts (status, lower(product_name), lower(platform))`);


  await pool.query(`ALTER TABLE balance_requests ADD COLUMN IF NOT EXISTS bank TEXT DEFAULT ''`);
  await pool.query(`ALTER TABLE balance_requests ADD COLUMN IF NOT EXISTS reference TEXT DEFAULT ''`);
  await pool.query(`ALTER TABLE balance_requests ADD COLUMN IF NOT EXISTS account_holder TEXT DEFAULT ''`);
  await pool.query(`ALTER TABLE balance_requests ADD COLUMN IF NOT EXISTS proof TEXT DEFAULT ''`);
  await pool.query(`ALTER TABLE balance_requests ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pendiente'`);
  await pool.query(`ALTER TABLE balance_requests ADD COLUMN IF NOT EXISTS admin_response TEXT DEFAULT ''`);
  await pool.query(`ALTER TABLE balance_requests ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW()`);
  await pool.query(`ALTER TABLE balance_requests ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP`);

  await pool.query(`ALTER TABLE account_reports ADD COLUMN IF NOT EXISTS email TEXT DEFAULT ''`);
  await pool.query(`ALTER TABLE account_reports ADD COLUMN IF NOT EXISTS issue_type TEXT DEFAULT 'otro'`);
  await pool.query(`ALTER TABLE account_reports ADD COLUMN IF NOT EXISTS description TEXT DEFAULT ''`);
  await pool.query(`ALTER TABLE account_reports ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pendiente'`);
  await pool.query(`ALTER TABLE account_reports ADD COLUMN IF NOT EXISTS admin_response TEXT DEFAULT ''`);
  await pool.query(`ALTER TABLE account_reports ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW()`);
  await pool.query(`ALTER TABLE account_reports ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP`);

  await pool.query(`UPDATE users SET role = 'user' WHERE role IS NULL`);
  await pool.query(`UPDATE users SET balance = 0 WHERE balance IS NULL`);
  await pool.query(`UPDATE products SET active = 1 WHERE active IS NULL`);
  await pool.query(`UPDATE products SET cost_price = 0 WHERE cost_price IS NULL`);
  await pool.query(`UPDATE products SET category = 'Otros' WHERE category IS NULL`);
  await pool.query(`UPDATE products SET required_fields = '[]' WHERE required_fields IS NULL`);
  await pool.query(`UPDATE products SET charge_mode = 'on_purchase' WHERE charge_mode IS NULL`);
  await pool.query(`UPDATE products SET stock_enabled = 0 WHERE stock_enabled IS NULL`);
  await pool.query(`UPDATE products SET stock = 0 WHERE stock IS NULL`);
  await pool.query(`UPDATE orders SET order_data = '{}' WHERE order_data IS NULL`);
  await pool.query(`UPDATE orders SET status = 'accion_en_espera' WHERE status IS NULL`);
  await pool.query(`UPDATE orders SET admin_response = '' WHERE admin_response IS NULL`);
  await pool.query(`UPDATE orders SET charged = 0 WHERE charged IS NULL`);
  await pool.query(`UPDATE orders SET refunded = 0 WHERE refunded IS NULL`);

  await pool.query(`UPDATE orders SET delivered_account_data = '' WHERE delivered_account_data IS NULL`);
  await pool.query(`UPDATE orders SET product_name_snapshot = '' WHERE product_name_snapshot IS NULL`);
  await pool.query(`UPDATE orders SET product_category_snapshot = '' WHERE product_category_snapshot IS NULL`);
  await pool.query(`UPDATE orders SET cost_price_snapshot = 0 WHERE cost_price_snapshot IS NULL`);
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

    const result = await pool.query(
      `SELECT * FROM users WHERE email = $1`,
      [String(email || "").trim().toLowerCase()]
    );

    const user = result.rows[0];

    if (!user) {
      return res.status(404).json({ error: "Usuario no encontrado" });
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
      `SELECT id, name, email, role, balance FROM users WHERE id = $1`,
      [req.user.id]
    );

    const user = result.rows[0];

    if (!user) {
      return res.status(404).json({ error: "Usuario no encontrado" });
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
    const result = await pool.query(
      `SELECT
         id,
         name,
         description,
         price,
         CASE WHEN $1 = 'admin' THEN COALESCE(cost_price, 0) ELSE 0 END AS cost_price,
         category,
         required_fields,
         charge_mode,
         active,
         stock_enabled,
         stock
       FROM products
       WHERE active = 1
       ORDER BY category ASC, name ASC`,
      [req.user.role]
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Error cargando productos" });
  }
});

// ADMIN: CREAR PRODUCTO
app.post("/api/admin/create-product", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { name, description, price, cost_price, category, required_fields, charge_mode, stock_enabled, stock } = req.body;

    if (!name || !price) {
      return res.status(400).json({ error: "Nombre y precio son obligatorios" });
    }

    const priceNumber = Number(price);

    if (priceNumber <= 0) {
      return res.status(400).json({ error: "El precio debe ser mayor a 0" });
    }

    const costPriceNumber = Math.max(0, Number(cost_price || 0));

    const validChargeModes = ["on_purchase", "on_success"];
    const finalChargeMode = validChargeModes.includes(charge_mode) ? charge_mode : "on_purchase";

    const cleanFields = safeJsonArray(required_fields)
      .map(field => normalizeFieldName(field))
      .filter(field => field.length > 0);

    await pool.query(
      `INSERT INTO products
       (name, description, price, cost_price, category, required_fields, charge_mode, active, stock_enabled, stock)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 1, $8, $9)`,
      [
        name.trim(),
        description || "",
        priceNumber,
        costPriceNumber,
        category || "Otros",
        JSON.stringify([...new Set(cleanFields)]),
        finalChargeMode,
        stock_enabled ? 1 : 0,
        Math.max(0, Number(stock || 0))
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
    const { name, description, price, cost_price, category, required_fields, charge_mode, stock_enabled, stock } = req.body;

    if (!name || !price) {
      return res.status(400).json({ error: "Nombre y precio son obligatorios" });
    }

    const priceNumber = Number(price);

    if (priceNumber <= 0) {
      return res.status(400).json({ error: "El precio debe ser mayor a 0" });
    }

    const costPriceNumber = Math.max(0, Number(cost_price || 0));

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
           stock = $9
       WHERE id = $10 AND active = 1`,
      [
        name.trim(),
        description || "",
        priceNumber,
        costPriceNumber,
        category || "Otros",
        JSON.stringify([...new Set(cleanFields)]),
        finalChargeMode,
        stock_enabled ? 1 : 0,
        Math.max(0, Number(stock || 0)),
        productId
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
      `UPDATE products SET active = 0 WHERE id = $1 AND active = 1`,
      [productId]
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

    const productResult = await client.query(
      `SELECT * FROM products WHERE id = $1 AND active = 1 FOR UPDATE`,
      [productId]
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
      `SELECT id, name, email, balance FROM users WHERE id = $1 FOR UPDATE`,
      [userId]
    );

    const user = userResult.rows[0];

    if (!user) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    const price = Number(product.price);
    const costPrice = Math.max(0, Number(product.cost_price || 0));
    const balance = Number(user.balance);
    const chargeMode = product.charge_mode || "on_purchase";

    if (chargeMode === "on_purchase" && balance < price) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        error: `Saldo insuficiente. Tu saldo es $${balance.toFixed(2)} y el producto cuesta $${price.toFixed(2)}`
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
        "",
        "📌 Normas de uso:",
        "✅ No editar datos de acceso",
        "✅ No cambiar el nombre ni el código del perfil",
        "✅ Uso exclusivo en un solo equipo",
        "✅ No compartir el acceso con otros",
        "",
        "Evita incumplir estas reglas para mantener el servicio activo sin inconvenientes."
      ].join("\n");

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
       (user_id, product_id, amount, order_data, status, admin_response, charged, refunded, assigned_platform_account_id, delivered_account_data, product_name_snapshot, product_category_snapshot, cost_price_snapshot)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
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
        costPrice
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
    const result = await pool.query(
      `SELECT * FROM platform_accounts ORDER BY id DESC`
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
      terms_conditions
    } = req.body;

    if (!platform || !product_name || !account_email || !account_password) {
      return res.status(400).json({ error: "Faltan datos obligatorios" });
    }

    const result = await pool.query(
      `INSERT INTO platform_accounts
       (platform, product_name, account_email, account_password, profile_name, profile_pin, extra_data, terms_conditions, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'available')
       RETURNING *`,
      [platform, product_name, account_email, account_password, profile_name || "", profile_pin || "", extra_data || "", terms_conditions || ""]
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
        orders.charged,
        orders.refunded,
        orders.created_at,
        products.name AS product_name,
        products.category AS product_category,
        products.charge_mode AS charge_mode
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
    const result = await pool.query(
      `SELECT id, name, email, role, balance FROM users ORDER BY id DESC`
    );

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
      `UPDATE users SET balance = balance + $1 WHERE id = $2`,
      [amountNumber, user_id]
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

    const insertResult = await pool.query(
      `INSERT INTO balance_requests
       (user_id, amount, bank, reference, account_holder, proof, status, admin_response)
       VALUES ($1, $2, $3, $4, $5, $6, 'pendiente', '')
       RETURNING id`,
      [
        userId,
        amountNumber,
        String(bank).trim(),
        String(reference).trim(),
        String(account_holder).trim(),
        String(proof || '').trim()
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
      proof: proof || ""
    });

    res.json({
      message: "Solicitud enviada. El administrador revisará tu transferencia y aprobará el saldo si el pago llegó."
    });
  } catch (err) {
    console.error(err.message);
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
       ORDER BY balance_requests.id DESC`
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

  try {
    const requestId = req.params.requestId;
    const { status, admin_response } = req.body;

    const validStatuses = ["pendiente", "aprobado", "rechazado"];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: "Estado inválido" });
    }

    await client.query("BEGIN");

    const requestResult = await client.query(
      `SELECT * FROM balance_requests WHERE id = $1 FOR UPDATE`,
      [requestId]
    );

    const request = requestResult.rows[0];

    if (!request) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Solicitud no encontrada" });
    }

    if (request.status === "aprobado" && status === "aprobado") {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Esta solicitud ya fue aprobada antes" });
    }

    if (request.status === "aprobado" && status !== "aprobado") {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "No se puede cambiar una solicitud ya aprobada para evitar movimientos duplicados" });
    }

    if (status === "aprobado") {
      await client.query(
        `UPDATE users SET balance = balance + $1 WHERE id = $2`,
        [request.amount, request.user_id]
      );
    }

    await client.query(
      `UPDATE balance_requests
       SET status = $1, admin_response = $2, reviewed_at = NOW()
       WHERE id = $3`,
      [status, admin_response || "", requestId]
    );

    await client.query("COMMIT");

    if (status === "aprobado") {
      return res.json({ message: `Solicitud aprobada. Se agregaron $${Number(request.amount).toFixed(2)} al cliente.` });
    }

    if (status === "rechazado") {
      return res.json({ message: "Solicitud rechazada correctamente." });
    }

    res.json({ message: "Solicitud actualizada correctamente." });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err.message);
    res.status(500).json({ error: "Error actualizando solicitud de saldo" });
  } finally {
    client.release();
  }
});


// USUARIO: REPORTAR PROBLEMA DE CUENTA
app.post("/api/account-reports", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { email, issue_type, description } = req.body;

    if (!email || !description) {
      return res.status(400).json({ error: "Correo y explicación de la falla son obligatorios" });
    }

    const insertResult = await pool.query(
      `INSERT INTO account_reports
       (user_id, email, issue_type, description, status, admin_response)
       VALUES ($1, $2, $3, $4, 'pendiente', '')
       RETURNING id`,
      [userId, String(email).trim(), String(issue_type || "otro").trim(), String(description).trim()]
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
    console.error(err.message);
    res.status(500).json({ error: "Error enviando reporte de cuenta" });
  }
});

// USUARIO: MIS REPORTES DE CUENTA
app.get("/api/my-account-reports", authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, email, issue_type, description, status, admin_response, created_at, reviewed_at
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
        users.name AS customer_name,
        users.email AS customer_email
       FROM account_reports
       JOIN users ON account_reports.user_id = users.id
       ORDER BY account_reports.id DESC`
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Error cargando reportes de cuenta" });
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
        orders.charged,
        orders.refunded,
        orders.created_at,
        users.name AS customer_name,
        users.email AS customer_email,
        products.name AS product_name,
        products.category AS product_category,
        products.charge_mode AS charge_mode
       FROM orders
       JOIN users ON orders.user_id = users.id
       JOIN products ON orders.product_id = products.id
       ORDER BY orders.id DESC`
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
    const { status, response_message, refund_if_rejected } = req.body;

    const validStatuses = ["accion_en_espera", "en_proceso", "exito", "rechazado"];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: "Estado inválido" });
    }

    await client.query("BEGIN");

    const orderResult = await client.query(
      `SELECT
        orders.*,
        products.charge_mode AS charge_mode
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

    await client.query(
      `UPDATE orders SET status = $1, admin_response = $2 WHERE id = $3`,
      [status, response_message || "", orderId]
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




// ADMIN: REPORTE DE VENTAS (fecha local México)
app.get("/api/admin/sales-report", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const requestedDate = String(req.query.date || "").trim();
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    const useDate = dateRegex.test(requestedDate)
      ? requestedDate
      : null;

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

    const saleCostExpr = `COALESCE(NULLIF(orders.cost_price_snapshot, 0), products.cost_price, 0)`;

    const dateCondition = `((orders.created_at AT TIME ZONE 'UTC') AT TIME ZONE 'America/Mexico_City')::date = $1::date`;

    const summaryResult = await pool.query(
      `SELECT
         COUNT(*)::int AS total_orders,
         COALESCE(SUM(orders.amount), 0)::numeric AS total_sales,
         COALESCE(SUM(${saleCostExpr}), 0)::numeric AS total_cost,
         (COALESCE(SUM(orders.amount), 0) - COALESCE(SUM(${saleCostExpr}), 0))::numeric AS total_profit
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
         COALESCE(SUM(${saleCostExpr}), 0)::numeric AS total_cost,
         (COALESCE(SUM(orders.amount), 0) - COALESCE(SUM(${saleCostExpr}), 0))::numeric AS total_profit
       FROM orders
       JOIN users ON users.id = orders.user_id
       JOIN products ON products.id = orders.product_id
       WHERE orders.status = 'exito'
         AND ${dateCondition}
       GROUP BY users.id, users.name, users.email
       ORDER BY total_sales DESC, total_orders DESC`,
      params
    );

    const byProductResult = await pool.query(
      `SELECT
         ${saleProductNameExpr} AS product_name,
         ${saleProductCategoryExpr} AS product_category,
         COUNT(orders.id)::int AS total_orders,
         COALESCE(SUM(orders.amount), 0)::numeric AS total_sales,
         COALESCE(SUM(${saleCostExpr}), 0)::numeric AS total_cost,
         (COALESCE(SUM(orders.amount), 0) - COALESCE(SUM(${saleCostExpr}), 0))::numeric AS total_profit
       FROM orders
       JOIN products ON products.id = orders.product_id
       WHERE orders.status = 'exito'
         AND ${dateCondition}
       GROUP BY ${saleProductNameExpr}, ${saleProductCategoryExpr}
       ORDER BY total_sales DESC, total_orders DESC`,
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
         ${saleCostExpr}::numeric AS cost_price,
         (orders.amount - ${saleCostExpr})::numeric AS profit,
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
      summary: summaryResult.rows[0] || { total_orders: 0, total_sales: 0 },
      by_user: byUserResult.rows,
      by_product: byProductResult.rows,
      details: detailsResult.rows
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Error generando reporte de ventas" });
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
