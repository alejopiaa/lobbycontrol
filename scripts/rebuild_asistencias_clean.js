const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const dbPath = process.env.APP_DB_PATH || path.join(__dirname, '../data/app.db');
const backupTimestamp = Date.now();
const backupFile = `${dbPath}.backup_clean_rebuild_${backupTimestamp}`;

console.log('--- RECONSTRUCCIÓN LIMPIA DESDE CERO (CLEAN SLATE) ---');
console.log('1. Creando respaldo previo obligatorio en:', backupFile);

fs.copyFileSync(dbPath, backupFile);
console.log('✓ Respaldo de seguridad creado exitosamente.');

const db = new sqlite3.Database(dbPath);

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

async function rebuild() {
  try {
    // 2. Extraer los 8 registros legítimos actuales ordenados por ticket_codigo ASC
    console.log('2. Extrayendo los 8 registros legítimos en orden...');
    const sourceRows = await all("SELECT * FROM bitacora_asistencias ORDER BY ticket_codigo ASC");
    console.log(`Leídos ${sourceRows.length} registros.`);

    if (sourceRows.length !== 8) {
      throw new Error(`Se esperaban 8 registros y se encontraron ${sourceRows.length}. Abortando por seguridad.`);
    }

    // 3. Eliminar tabla actual y triggers
    console.log('3. Eliminando tabla vieja y reiniciando secuencia...');
    await run("DROP TRIGGER IF EXISTS trg_bitacora_asistencias_updated_at");
    await run("DROP TABLE IF EXISTS bitacora_asistencias");
    try {
      await run("DELETE FROM sqlite_sequence WHERE name = 'bitacora_asistencias'");
    } catch (e) {}

    // 4. Crear tabla limpia con DDL canónico
    console.log('4. Creando tabla canónica bitacora_asistencias...');
    await run(`
      CREATE TABLE bitacora_asistencias (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        uuid TEXT UNIQUE NOT NULL,
        ticket_codigo TEXT UNIQUE NOT NULL,
        contacto_id INTEGER,
        contacto_uuid TEXT,
        fecha_hora DATETIME DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
        canal TEXT NOT NULL DEFAULT 'telefono',
        solicitante_nombre TEXT NOT NULL,
        solicitante_direccion TEXT,
        solicitante_correo TEXT,
        solicitante_telefono TEXT,
        categoria TEXT NOT NULL,
        folio_lobby TEXT,
        motivo_consulta TEXT NOT NULL,
        solucion_orientacion TEXT,
        estado TEXT NOT NULL DEFAULT 'resuelta',
        representado TEXT,
        representado_id_lobby INTEGER,
        creado_por TEXT,
        updated_by TEXT,
        created_at DATETIME DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
        updated_at DATETIME DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
        FOREIGN KEY (contacto_id) REFERENCES contactos_asistencia(id) ON DELETE SET NULL
      )
    `);

    // 5. Insertar los 8 registros con IDs 1 al 8
    console.log('5. Reinsertando registros con IDs correlativos del 1 al 8...');
    const insertStmt = `
      INSERT INTO bitacora_asistencias (
        id, uuid, ticket_codigo, contacto_id, contacto_uuid, fecha_hora, canal, solicitante_nombre, solicitante_direccion,
        solicitante_correo, solicitante_telefono, categoria, folio_lobby,
        motivo_consulta, solucion_orientacion, estado, representado, representado_id_lobby, creado_por, updated_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    for (let i = 0; i < sourceRows.length; i++) {
      const r = sourceRows[i];
      const newId = i + 1;
      await run(insertStmt, [
        newId,
        r.uuid,
        r.ticket_codigo,
        r.contacto_id,
        r.contacto_uuid,
        r.fecha_hora,
        r.canal,
        r.solicitante_nombre,
        r.solicitante_direccion,
        r.solicitante_correo,
        r.solicitante_telefono,
        r.categoria,
        r.folio_lobby,
        r.motivo_consulta,
        r.solucion_orientacion,
        r.estado,
        r.representado,
        r.representado_id_lobby,
        r.creado_por,
        r.updated_by,
        r.created_at,
        r.updated_at
      ]);
      console.log(`✓ ID ${newId} -> ${r.ticket_codigo} (${r.solicitante_nombre})`);
    }

    // 6. Asegurar sqlite_sequence en 8
    await run("INSERT OR REPLACE INTO sqlite_sequence (name, seq) VALUES ('bitacora_asistencias', 8)");

    // 7. Crear índices de rendimiento y triggers UTC
    console.log('6. Creando índices y triggers UTC...');
    await run("CREATE INDEX IF NOT EXISTS idx_bitacora_ticket ON bitacora_asistencias(ticket_codigo)");
    await run("CREATE INDEX IF NOT EXISTS idx_bitacora_contacto ON bitacora_asistencias(contacto_id)");
    await run("CREATE INDEX IF NOT EXISTS idx_bitacora_fecha ON bitacora_asistencias(fecha_hora)");
    await run("CREATE INDEX IF NOT EXISTS idx_bitacora_canal ON bitacora_asistencias(canal)");
    await run("CREATE INDEX IF NOT EXISTS idx_bitacora_estado ON bitacora_asistencias(estado)");
    await run("CREATE UNIQUE INDEX IF NOT EXISTS idx_bitacora_uuid ON bitacora_asistencias(uuid)");
    await run("CREATE INDEX IF NOT EXISTS idx_bitacora_contacto_uuid ON bitacora_asistencias(contacto_uuid)");
    await run("CREATE INDEX IF NOT EXISTS idx_bitacora_updated ON bitacora_asistencias(updated_at)");

    await run(`
      CREATE TRIGGER IF NOT EXISTS trg_bitacora_asistencias_updated_at 
      AFTER UPDATE ON bitacora_asistencias BEGIN 
        UPDATE bitacora_asistencias SET updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = NEW.id; 
      END
    `);

    // 8. Checkpoint WAL
    await run("PRAGMA wal_checkpoint(TRUNCATE)");

    // 9. Verificar estado final
    const finalRows = await all("SELECT id, ticket_codigo, solicitante_nombre, solicitante_direccion, contacto_id, uuid FROM bitacora_asistencias ORDER BY id ASC");
    console.log('\n--- TABLA FINAL RECONSTRUIDA (IDs 1 al 8) ---');
    console.table(finalRows);
    console.log('✓ Reconstrucción completada con éxito.');
  } catch (err) {
    console.error('Error durante la reconstrucción:', err);
    process.exit(1);
  } finally {
    db.close();
  }
}

rebuild();
