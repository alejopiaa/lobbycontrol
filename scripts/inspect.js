const path = require('path');
const sqlite3 = require('sqlite3').verbose();
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const absoluteDbPath = path.join(__dirname, '..', process.env.DATABASE_PATH || 'lobby.db');

const db = new sqlite3.Database(absoluteDbPath, (err) => {
  if (err) {
    console.error('Error connecting to database:', err);
    process.exit(1);
  }
});

db.all(
  "SELECT DISTINCT estado FROM solicitudes_sh",
  [],
  (err, rows) => {
    if (err) {
      console.error(err);
    } else {
      console.log('--- Unique States in DB (solicitudes_sh) ---');
      console.log(rows);
    }
    db.close();
  }
);


