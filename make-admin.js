const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./database.sqlite');

const email = 'tizacell75@gmail.com';

db.run(
  `UPDATE users SET role = 'admin' WHERE email = ?`,
  [email],
  function (err) {
    if (err) {
      console.error('Error:', err.message);
      return;
    }

    if (this.changes === 0) {
      console.log('No se encontró ningún usuario con ese correo.');
    } else {
      console.log('Usuario convertido en admin correctamente.');
    }

    db.close();
  }
);