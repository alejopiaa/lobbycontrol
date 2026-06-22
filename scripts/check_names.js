const path = require('path');
const sqlite3 = require('sqlite3').verbose();
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const absoluteDbPath = path.join(__dirname, '..', process.env.DATABASE_PATH || 'lobby.db');
const db = new sqlite3.Database(absoluteDbPath);

db.all(
  "SELECT sujeto_pasivo, COUNT(*) as c FROM solicitudes_sh WHERE sujeto_pasivo LIKE '%Vodanovic%' GROUP BY sujeto_pasivo ORDER BY c DESC",
  [],
  function(err, rows) {
    if (err) { console.error(err); }
    else { rows.forEach(x => console.log(x.c, x.sujeto_pasivo)); }
    db.close();
  }
);
