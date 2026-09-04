const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const dbPath = process.env.APP_DB_PATH || path.join(__dirname, '../data/app.db');
const backupPath = `${dbPath}.bak_` + Date.now();
const backupStatic = `${dbPath}.bak`;

console.log('--- INICIO DE SANEAMIENTO DE ASISTENCIAS ---');
console.log('Base de datos:', dbPath);

if (!fs.existsSync(dbPath)) {
  console.error('No se encontró el archivo de base de datos:', dbPath);
  process.exit(1);
}

// 1. Crear backup de seguridad
fs.copyFileSync(dbPath, backupPath);
fs.copyFileSync(dbPath, backupStatic);
console.log('✓ Respaldo creado en:', backupPath);

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

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function toIsoUtc(dateStr) {
  if (!dateStr) return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  try {
    let d;
    if (dateStr.includes('T')) {
      d = new Date(dateStr);
    } else {
      d = new Date(dateStr.replace(' ', 'T'));
    }
    if (isNaN(d.getTime())) return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
    return d.toISOString().replace(/\.\d{3}Z$/, 'Z');
  } catch (e) {
    return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  }
}

async function main() {
  try {
    // 2. Asegurar columnas uuid y updated_at en ambas tablas
    console.log('Verificando columnas y DDL...');
    const bitacoraCols = await all("PRAGMA table_info(bitacora_asistencias)");
    const bitacoraColNames = bitacoraCols.map(c => c.name);

    if (!bitacoraColNames.includes('uuid')) {
      console.log('Agregando columna uuid a bitacora_asistencias...');
      await run("ALTER TABLE bitacora_asistencias ADD COLUMN uuid TEXT");
    }
    if (!bitacoraColNames.includes('contacto_uuid')) {
      console.log('Agregando columna contacto_uuid a bitacora_asistencias...');
      await run("ALTER TABLE bitacora_asistencias ADD COLUMN contacto_uuid TEXT");
    }

    const contactosCols = await all("PRAGMA table_info(contactos_asistencia)");
    const contactosColNames = contactosCols.map(c => c.name);

    if (!contactosColNames.includes('uuid')) {
      console.log('Agregando columna uuid a contactos_asistencia...');
      await run("ALTER TABLE contactos_asistencia ADD COLUMN uuid TEXT");
    }

    // 3. Poblar UUIDs para contactos que no tengan
    const contactsWithoutUuid = await all("SELECT id, nombre FROM contactos_asistencia WHERE uuid IS NULL OR trim(uuid) = ''");
    console.log(`Contactos sin UUID: ${contactsWithoutUuid.length}`);
    for (const c of contactsWithoutUuid) {
      const u = crypto.randomUUID();
      await run("UPDATE contactos_asistencia SET uuid = ? WHERE id = ?", [u, c.id]);
    }
    await run("CREATE UNIQUE INDEX IF NOT EXISTS idx_contactos_uuid ON contactos_asistencia(uuid)");

    // 4. Actualizar triggers para usar UTC canónico
    console.log('Actualizando triggers a UTC canónico...');
    await run("DROP TRIGGER IF EXISTS trg_bitacora_asistencias_updated_at");
    await run(`
      CREATE TRIGGER IF NOT EXISTS trg_bitacora_asistencias_updated_at 
      AFTER UPDATE ON bitacora_asistencias BEGIN 
        UPDATE bitacora_asistencias SET updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = NEW.id; 
      END
    `);

    await run("DROP TRIGGER IF EXISTS trg_contactos_asistencia_updated_at");
    await run(`
      CREATE TRIGGER IF NOT EXISTS trg_contactos_asistencia_updated_at 
      AFTER UPDATE ON contactos_asistencia BEGIN 
        UPDATE contactos_asistencia SET updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = NEW.id; 
      END
    `);

    // 5. Depurar ÚNICAMENTE registros basura (duplicado legacy 235 y prueba 239)
    console.log('Depurando registros basura (duplicado legacy 235 y prueba 239)...');
    const delRes = await run("DELETE FROM bitacora_asistencias WHERE id IN (235, 239)");
    console.log(`Registros basura eliminados: ${delRes.changes}`);

    // 5. Mapear y renumerar exactamente los 8 registros legítimos
    const targetFolios = [
      { id: 64,  folio: 'AST26AB-001' },
      { id: 33,  folio: 'AST26AB-002' },
      { id: 38,  folio: 'AST26AB-003' },
      { id: 1,   folio: 'AST26AB-004' },
      { id: 237, folio: 'AST26AB-005' },
      { id: 6,   folio: 'AST26AB-006' },
      { id: 188, folio: 'AST26AB-007' },
      { id: 196, folio: 'AST26AB-008' }
    ];

    console.log('Actualizando los 8 registros legítimos con folios inmutables y UUIDs...');
    for (const item of targetFolios) {
      const existing = await get("SELECT * FROM bitacora_asistencias WHERE id = ?", [item.id]);
      if (!existing) {
        console.warn(`ADVERTENCIA: No se encontró registro con ID ${item.id}`);
        continue;
      }

      const rowUuid = existing.uuid && existing.uuid.length === 36 ? existing.uuid : crypto.randomUUID();
      const isoCreated = toIsoUtc(existing.created_at || existing.fecha_hora);
      const isoUpdated = toIsoUtc(existing.updated_at || existing.created_at || existing.fecha_hora);

      // Resolver contacto_uuid desde contactos_asistencia
      let contactUuid = existing.contacto_uuid;
      if (!contactUuid && existing.contacto_id) {
        const cRow = await get("SELECT uuid FROM contactos_asistencia WHERE id = ?", [existing.contacto_id]);
        if (cRow) contactUuid = cRow.uuid;
      }
      if (!contactUuid && existing.solicitante_nombre) {
        const cRow = await get("SELECT id, uuid FROM contactos_asistencia WHERE nombre = ? COLLATE NOCASE", [existing.solicitante_nombre.trim()]);
        if (cRow) {
          contactUuid = cRow.uuid;
          await run("UPDATE bitacora_asistencias SET contacto_id = ? WHERE id = ?", [cRow.id, item.id]);
        }
      }

      await run(`
        UPDATE bitacora_asistencias
        SET ticket_codigo = ?,
            uuid = ?,
            contacto_uuid = ?,
            created_at = ?,
            updated_at = ?
        WHERE id = ?
      `, [item.folio, rowUuid, contactUuid, isoCreated, isoUpdated, item.id]);

      console.log(`✓ ID ${item.id} -> ${item.folio} (UUID: ${rowUuid}, Contacto UUID: ${contactUuid})`);
    }

    // 6. Reconciliación O(1) de claves foráneas
    await run(`
      UPDATE bitacora_asistencias
      SET contacto_id = (
        SELECT id FROM contactos_asistencia WHERE uuid = bitacora_asistencias.contacto_uuid
      )
      WHERE contacto_uuid IS NOT NULL AND contacto_id IS NULL
    `);

    // 7. Crear índices únicos y de búsqueda
    console.log('Creando índices optimizados...');
    await run("CREATE UNIQUE INDEX IF NOT EXISTS idx_bitacora_uuid ON bitacora_asistencias(uuid)");
    await run("CREATE INDEX IF NOT EXISTS idx_bitacora_contacto_uuid ON bitacora_asistencias(contacto_uuid)");
    await run("CREATE INDEX IF NOT EXISTS idx_bitacora_updated ON bitacora_asistencias(updated_at)");

    // 8. Verificación final de integridad
    const finalRows = await all("SELECT id, ticket_codigo, solicitante_nombre, solicitante_direccion, uuid, contacto_id, contacto_uuid, updated_at FROM bitacora_asistencias ORDER BY ticket_codigo ASC");
    console.log('\n--- TABLA FINAL SANEADA (' + finalRows.length + ' registros) ---');
    console.table(finalRows);

    // 9. Checkpoint de WAL
    await run("PRAGMA wal_checkpoint(TRUNCATE)");
    console.log('\n✓ Checkpoint de WAL completado con éxito.');
    console.log('--- SANEAMIENTO COMPLETADO CON ÉXITO ---');
  } catch (err) {
    console.error('Error durante el saneamiento:', err);
    process.exit(1);
  } finally {
    db.close();
  }
}

main();
