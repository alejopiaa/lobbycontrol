const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Determinar ruta de datos (dev o prod)
const devDir = path.join(__dirname, '..', 'data');
const prodDir = path.join(process.env.APPDATA || '', 'LobbyControl', 'data');
const dbDir = fs.existsSync(path.join(devDir, 'lobby_control.db')) ? devDir : prodDir;

console.log('=== MIGRACIÓN ARQUITECTÓNICA A DATA.DB Y APP.DB ===');
console.log('Directorio de datos:', dbDir);

const oldLobbyPath = path.join(dbDir, 'lobby_control.db');
const oldAsistenciasPath = path.join(dbDir, 'asistencias.db');
const newDataPath = path.join(dbDir, 'data.db');
const newAppPath = path.join(dbDir, 'app.db');

const lobbyBakPath = path.join(dbDir, 'lobby_control.db.pre_refactor_bak');
const asistenciasBakPath = path.join(dbDir, 'asistencias.db.pre_refactor_bak');

function runCheckpointAndClose(dbFilePath) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(dbFilePath)) return resolve();
    const db = new sqlite3.Database(dbFilePath, (err) => {
      if (err) return reject(err);
      db.run("PRAGMA wal_checkpoint(TRUNCATE)", (pragmaErr) => {
        if (pragmaErr) console.warn(`Advertencia checkpoint en ${path.basename(dbFilePath)}:`, pragmaErr.message);
        db.close((closeErr) => {
          if (closeErr) return reject(closeErr);
          resolve();
        });
      });
    });
  });
}

function purgeResiduals(targetPath) {
  ['', '-wal', '-shm', '-journal'].forEach(ext => {
    const file = `${targetPath}${ext}`;
    if (fs.existsSync(file)) {
      try {
        fs.unlinkSync(file);
        console.log(`Eliminado archivo/residuo: ${path.basename(file)}`);
      } catch (e) {
        console.warn(`No se pudo eliminar residuo ${file}:`, e.message);
      }
    }
  });
}

async function executeRefactor() {
  console.log('\n[Paso 1/6] Vaciado de WAL y cierre de descriptores en bases existentes...');
  await runCheckpointAndClose(oldLobbyPath);
  await runCheckpointAndClose(oldAsistenciasPath);

  console.log('\n[Paso 2/6] Creación de respaldos preventivos (.bak)...');
  if (fs.existsSync(oldLobbyPath)) {
    fs.copyFileSync(oldLobbyPath, lobbyBakPath);
    console.log(`✓ Respaldo creado: ${path.basename(lobbyBakPath)}`);
  }
  if (fs.existsSync(oldAsistenciasPath)) {
    fs.copyFileSync(oldAsistenciasPath, asistenciasBakPath);
    console.log(`✓ Respaldo creado: ${path.basename(asistenciasBakPath)}`);
  }

  let appDb = null;

  try {
    console.log('\n[Paso 3/6] Inicializando data.db y app.db...');
    // Si data.db ya existe por intento previo, limpiarlo antes de copiar
    purgeResiduals(newDataPath);
    purgeResiduals(newAppPath);

    if (fs.existsSync(oldLobbyPath)) {
      fs.copyFileSync(oldLobbyPath, newDataPath);
      console.log(`✓ Copiado lobby_control.db -> data.db`);
    }

    if (fs.existsSync(oldAsistenciasPath)) {
      fs.copyFileSync(oldAsistenciasPath, newAppPath);
      console.log(`✓ Copiado asistencias.db -> app.db`);
    }

    console.log('\n[Paso 4/6] Transfiriendo tablas operativas hacia app.db...');
    appDb = new sqlite3.Database(newAppPath);

    const execSql = (sql) => new Promise((resolve, reject) => {
      appDb.run(sql, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    const queryGet = (sql) => new Promise((resolve, reject) => {
      appDb.get(sql, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    // Adjuntar data.db para transferir datos de forma atómica a nivel de motor SQL
    const sanitizedDataPath = newDataPath.replace(/\\/g, '/');
    await execSql(`ATTACH DATABASE '${sanitizedDataPath}' AS dataDb`);

    // Tablas a transferir desde dataDb hacia appDb
    const tablesToTransfer = ['configuracion', 'historial_sincronizaciones', 'auditoria_semanal'];

    for (const tbl of tablesToTransfer) {
      console.log(`Transfiriendo tabla ${tbl}...`);
      const schemaRow = await queryGet(`SELECT sql FROM dataDb.sqlite_master WHERE type='table' AND name='${tbl}'`);
      if (schemaRow && schemaRow.sql) {
        await execSql(`DROP TABLE IF EXISTS main.${tbl}`);
        await execSql(schemaRow.sql.replace(`CREATE TABLE ${tbl}`, `CREATE TABLE IF NOT EXISTS main.${tbl}`));
        await execSql(`INSERT INTO main.${tbl} SELECT * FROM dataDb.${tbl}`);
        console.log(`✓ Tabla ${tbl} transferida íntegramente a app.db`);
      }
    }

    console.log('\n[Paso 5/6] Purgando tablas operativas de data.db...');
    for (const tbl of tablesToTransfer) {
      await execSql(`DROP TABLE IF EXISTS dataDb.${tbl}`);
    }

    // Desconectar base adjunta
    await execSql(`DETACH DATABASE dataDb`);

    // Checkpoint y cierre de appDb
    await new Promise((res) => appDb.run("PRAGMA wal_checkpoint(TRUNCATE)", () => res()));
    await new Promise((res, rej) => appDb.close((err) => err ? rej(err) : res()));
    appDb = null;

    // Checkpoint y cierre de data.db
    await runCheckpointAndClose(newDataPath);

    console.log('\n[Paso 6/6] Verificación integral de integridad...');
    const verifyScript = require('./verify_db_refactor.js');
    const isValid = await verifyScript.verify(newDataPath, newAppPath);

    if (!isValid) {
      throw new Error('La verificación post-migración falló.');
    }

    console.log('\n🎉 ¡MIGRACIÓN ARQUITECTÓNICA COMPLETADA CON ÉXITO!');
  } catch (err) {
    console.error('\n❌ ERROR EN MIGRACIÓN. INICIANDO ROLLBACK AUTOMÁTICO:', err.message);
    if (appDb) {
      try {
        await new Promise(r => appDb.close(r));
      } catch (e) {}
      appDb = null;
    }
    purgeResiduals(newDataPath);
    purgeResiduals(newAppPath);

    if (fs.existsSync(lobbyBakPath)) {
      fs.copyFileSync(lobbyBakPath, oldLobbyPath);
      console.log(`✓ Restaurado: ${path.basename(oldLobbyPath)}`);
    }
    if (fs.existsSync(asistenciasBakPath)) {
      fs.copyFileSync(asistenciasBakPath, oldAsistenciasPath);
      console.log(`✓ Restaurado: ${path.basename(oldAsistenciasPath)}`);
    }
    throw err;
  }
}

module.exports = { executeRefactor };

if (require.main === module) {
  executeRefactor().catch(e => {
    console.error('Proceso terminado con error:', e.message);
    process.exit(1);
  });
}
