const path = require('path');
const sqlite3 = require('sqlite3').verbose();
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const absoluteDbPath = path.join(__dirname, '..', process.env.DATABASE_PATH || 'lobby_control.db');

const db = new sqlite3.Database(absoluteDbPath, (err) => {
  if (err) {
    console.error('Error connecting to database:', err);
    process.exit(1);
  }
});

console.log('--- Top 10 Solicitudes SH (ORDER BY id DESC) ---');
db.all("SELECT id, folio_lobby, sujeto_pasivo, cargo, sujeto_activo, representado FROM solicitudes_sh ORDER BY id DESC LIMIT 10", [], (err, rows) => {
  if (err) console.error(err);
  console.log(rows);

  console.log('\n--- Top 10 Publicadas PH (ORDER BY id DESC) ---');
  db.all("SELECT id, folio_lobby, sujeto_pasivo, cargo, sujeto_activo, representado FROM publicadas_ph ORDER BY id DESC LIMIT 10", [], (err, rows) => {
    if (err) console.error(err);
    console.log(rows);
    db.close();
  });
});
