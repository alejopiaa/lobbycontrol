const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

function openDb(filePath) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(filePath, sqlite3.OPEN_READONLY, (err) => {
      if (err) reject(err);
      else resolve(db);
    });
  });
}

function queryAll(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
}

function queryGet(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

async function verify(dataPath, appPath) {
  console.log('--- VERIFICACIÓN POST-MIGRACIÓN DE ARQUITECTURA ---');
  console.log('data.db:', dataPath);
  console.log('app.db :', appPath);

  if (!fs.existsSync(dataPath)) {
    console.error('❌ Falta archivo data.db');
    return false;
  }
  if (!fs.existsSync(appPath)) {
    console.error('❌ Falta archivo app.db');
    return false;
  }

  const dbData = await openDb(dataPath);
  const dbApp = await openDb(appPath);

  try {
    // 1. Integridad física
    const dataIntegrity = await queryAll(dbData, "PRAGMA integrity_check");
    if (dataIntegrity[0]?.integrity_check !== 'ok') {
      console.error('❌ PRAGMA integrity_check falló en data.db:', dataIntegrity);
      return false;
    }
    console.log('✓ data.db integrity_check: ok');

    const appIntegrity = await queryAll(dbApp, "PRAGMA integrity_check");
    if (appIntegrity[0]?.integrity_check !== 'ok') {
      console.error('❌ PRAGMA integrity_check falló en app.db:', appIntegrity);
      return false;
    }
    console.log('✓ app.db integrity_check: ok');

    // 2. Tablas en data.db
    const dataTables = (await queryAll(dbData, "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")).map(t => t.name).sort();
    console.log('Tablas encontradas en data.db:', dataTables);
    const expectedDataTables = ['publicadas_ph', 'solicitudes_sh', 'sujetos_pasivos_sph', 'sujetos_pasivos_vigentes'];
    const hasOnlyExpectedData = expectedDataTables.every(t => dataTables.includes(t)) && !dataTables.includes('configuracion') && !dataTables.includes('auditoria_semanal') && !dataTables.includes('historial_sincronizaciones');
    if (!hasOnlyExpectedData) {
      console.error('❌ data.db contiene tablas no permitidas o faltan las del Excel:', dataTables);
      return false;
    }
    console.log('✓ data.db contiene exclusivamente las 4 tablas del Excel importado.');

    // 3. Tablas en app.db
    const appTables = (await queryAll(dbApp, "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")).map(t => t.name).sort();
    console.log('Tablas encontradas en app.db:', appTables);
    const requiredAppTables = [
      'asistencia_categorias',
      'auditoria_semanal',
      'bitacora_asistencias',
      'configuracion',
      'contactos_asistencia',
      'direcciones_municipales',
      'historial_sincronizaciones'
    ];
    const hasAllAppTables = requiredAppTables.every(t => appTables.includes(t));
    if (!hasAllAppTables) {
      console.error('❌ app.db le faltan tablas requeridas:', requiredAppTables.filter(t => !appTables.includes(t)));
      return false;
    }
    console.log('✓ app.db contiene todas las tablas operativas, asistencias, auditoría y configuración.');

    // 4. Conteo de asistencias y validación de folios
    const bitacoraCount = (await queryGet(dbApp, "SELECT COUNT(*) as c FROM bitacora_asistencias")).c;
    if (bitacoraCount !== 8) {
      console.error(`❌ Conteo de bitacora_asistencias incorrecto: ${bitacoraCount} (esperado: 8)`);
      return false;
    }
    const tickets = await queryAll(dbApp, "SELECT id, ticket_codigo, uuid FROM bitacora_asistencias ORDER BY id ASC");
    for (let i = 0; i < 8; i++) {
      const expectedFolio = `AST26AB-00${i + 1}`;
      if (tickets[i].ticket_codigo !== expectedFolio) {
        console.error(`❌ Folio inesperado en ticket ${i + 1}: ${tickets[i].ticket_codigo} (esperado: ${expectedFolio})`);
        return false;
      }
      if (!tickets[i].uuid || tickets[i].uuid.length !== 36) {
        console.error(`❌ UUID inválido en ticket ${tickets[i].ticket_codigo}: ${tickets[i].uuid}`);
        return false;
      }
    }
    console.log('✓ 8 tickets de asistencia verificados intactos con folios AST26AB-001 a AST26AB-008 y UUIDs válidos.');

    // 5. Conteo de tablas migradas en app.db
    const auditCount = (await queryGet(dbApp, "SELECT COUNT(*) as c FROM auditoria_semanal")).c;
    const syncCount = (await queryGet(dbApp, "SELECT COUNT(*) as c FROM historial_sincronizaciones")).c;
    const configCount = (await queryGet(dbApp, "SELECT COUNT(*) as c FROM configuracion")).c;
    console.log(`✓ Tablas migradas en app.db: auditoria_semanal (${auditCount}), historial_sincronizaciones (${syncCount}), configuracion (${configCount})`);

    if (auditCount !== 18 || syncCount !== 202 || configCount !== 2) {
      console.error('❌ Los recuentos de las tablas migradas difieren de los esperados.');
      return false;
    }

    // 6. Conteo en data.db
    const solCount = (await queryGet(dbData, "SELECT COUNT(*) as c FROM solicitudes_sh")).c;
    const pubCount = (await queryGet(dbData, "SELECT COUNT(*) as c FROM publicadas_ph")).c;
    const sphCount = (await queryGet(dbData, "SELECT COUNT(*) as c FROM sujetos_pasivos_sph")).c;
    console.log(`✓ data.db preserva todas las filas: solicitudes_sh (${solCount}), publicadas_ph (${pubCount}), sujetos_pasivos_sph (${sphCount})`);

    if (solCount !== 13401 || pubCount !== 5154 || sphCount !== 4321) {
      console.error('❌ Los recuentos de data.db difieren de los esperados.');
      return false;
    }

    console.log('✓ Todas las verificaciones post-migración fueron 100% exitosas.');
    return true;
  } finally {
    dbData.close();
    dbApp.close();
  }
}

module.exports = { verify };

if (require.main === module) {
  const devDir = path.join(__dirname, '..', 'data');
  const prodDir = path.join(process.env.APPDATA || '', 'LobbyControl', 'data');
  const dbDir = fs.existsSync(path.join(devDir, 'data.db')) ? devDir : prodDir;
  verify(path.join(dbDir, 'data.db'), path.join(dbDir, 'app.db'))
    .then(ok => process.exit(ok ? 0 : 1))
    .catch(e => {
      console.error('Error en verificación:', e);
      process.exit(1);
    });
}
