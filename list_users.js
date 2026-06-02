const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./database.sqlite');

db.all("SELECT id, name, email, role, balance FROM users", [], (err, rows) => {
  if (err) {
    console.error("Error leyendo la base de datos:", err);
    process.exit(1);
  }

  if (rows.length === 0) {
    console.log("No hay usuarios registrados.");
  } else {
    console.log("Usuarios registrados:");
    rows.forEach(user => {
      console.log(`ID: ${user.id} | Nombre: ${user.name} | Email: ${user.email} | Rol: ${user.role} | Saldo: $${user.balance.toFixed(2)}`);
    });
  }

  db.close();
});