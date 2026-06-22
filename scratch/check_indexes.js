const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('lobby.db');

db.all("SELECT name, tbl_name FROM sqlite_master WHERE type='index'", [], (err, rows) => {
  if (err) {
    console.error(err);
  } else {
    console.log('--- Indexes in lobby.db ---');
    console.log(rows);
  }
  db.close();
});
