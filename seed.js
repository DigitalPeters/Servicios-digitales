const bcrypt = require('bcrypt');
const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("Falta DATABASE_URL. Este script debe correr en Render o con DATABASE_URL configurado.");
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  console.log("Conectando a PostgreSQL...");

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
      active INTEGER DEFAULT 1
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

  const adminEmail = "tizacell75@gmail.com";
  const adminPassword = "12345678";
  const hashedPassword = await bcrypt.hash(adminPassword, 10);

  const existingAdmin = await pool.query(
    `SELECT id FROM users WHERE email = $1`,
    [adminEmail]
  );

  if (existingAdmin.rows.length === 0) {
    await pool.query(
      `INSERT INTO users (name, email, password, role, balance)
       VALUES ($1, $2, $3, $4, $5)`,
      ["Admin", adminEmail, hashedPassword, "admin", 0]
    );

    console.log("Admin creado correctamente.");
  } else {
    await pool.query(
      `UPDATE users
       SET role = 'admin', password = $1
       WHERE email = $2`,
      [hashedPassword, adminEmail]
    );

    console.log("Admin actualizado correctamente.");
  }

  const products = [
    {
      name: "Acta de Nacimiento",
      description: "Se entrega en PDF de 1 a 10 minutos.",
      price: 20,
      category: "Actas",
      required_fields: ["curp"],
      charge_mode: "on_purchase"
    },
    {
      name: "CSF",
      description: "Constancia de Situación Fiscal.",
      price: 30,
      category: "CSF",
      required_fields: ["rfc", "idcif"],
      charge_mode: "on_purchase"
    },
    {
      name: "Alta al IMSS",
      description: "Trámite de alta al IMSS. Se cobra hasta que el admin marque Éxito.",
      price: 50,
      category: "IMSS",
      required_fields: ["nombre_completo", "curp", "nss"],
      charge_mode: "on_success"
    }
  ];

  for (const product of products) {
    const existingProduct = await pool.query(
      `SELECT id FROM products WHERE name = $1 AND active = 1`,
      [product.name]
    );

    if (existingProduct.rows.length === 0) {
      await pool.query(
        `INSERT INTO products
         (name, description, price, category, required_fields, charge_mode, active)
         VALUES ($1, $2, $3, $4, $5, $6, 1)`,
        [
          product.name,
          product.description,
          product.price,
          product.category,
          JSON.stringify(product.required_fields),
          product.charge_mode
        ]
      );

      console.log("Producto creado:", product.name);
    } else {
      console.log("Producto ya existe:", product.name);
    }
  }

  console.log("--------------------------------");
  console.log("LISTO");
  console.log("Admin:");
  console.log("Correo:", adminEmail);
  console.log("Contraseña:", adminPassword);
  console.log("--------------------------------");

  await pool.end();
}

main().catch(async error => {
  console.error("Error:", error.message);
  await pool.end();
  process.exit(1);
});