const fs = require('fs');
const path = require('path');

function decompressFileAsync(src, dest) {
  return new Promise((resolve, reject) => {
    const zlib = require('zlib');
    const sourceStream = fs.createReadStream(src);
    const gunzipStream = zlib.createGunzip();
    const destStream = fs.createWriteStream(dest);

    sourceStream.on('error', reject);
    gunzipStream.on('error', reject);
    destStream.on('error', reject);

    destStream.on('close', () => {
      resolve();
    });

    sourceStream.pipe(gunzipStream).pipe(destStream);
  });
}

function copyFileWithRetry(src, dest, retries = 5, delay = 500) {
  return new Promise((resolve, reject) => {
    let attempt = 0;
    function tryCopy() {
      attempt++;
      try {
        fs.copyFileSync(src, dest);
        resolve();
      } catch (err) {
        if (err.code === 'EBUSY' && attempt < retries) {
          console.warn(`Archivo bloqueado (${dest}). Reintentando copia en ${delay}ms... (Intento ${attempt}/${retries})`);
          setTimeout(tryCopy, delay);
        } else {
          reject(err);
        }
      }
    }
    tryCopy();
  });
}

/**
 * Descarga un archivo de forma segura enviando las cookies de SharePoint y manejando redirecciones.
 * @param {String} url 
 * @param {String} destPath 
 * @param {String} cookieHeader 
 * @returns {Promise<void>}
 */
async function downloadAuthenticatedFile(url, destPath, cookieHeader) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const { net } = require('electron');
    const response = await net.fetch(url, {
      method: 'GET',
      headers: {
        'Cookie': cookieHeader,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Electron/LobbyControl'
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const httpErr = new Error(`Fallo de descarga HTTP ${response.status}: ${response.statusText}`);
      httpErr.status = response.status;
      throw httpErr;
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Asegurarse de que el directorio existe
    const dir = path.dirname(destPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(destPath, buffer);
  } catch (err) {
    clearTimeout(timeoutId);
    if (fs.existsSync(destPath)) {
      try {
        fs.unlinkSync(destPath);
      } catch (e) {}
    }
    if (err.name === 'AbortError') {
      throw new Error('Tiempo de espera agotado al conectar con el servidor (timeout 15s).');
    }
    throw err;
  }
}

/**
 * Realiza una fusión a nivel de fila (Row-Level Delta Merge) para asistencias.db.
 * Garantiza cero pérdida de datos al sincronizar asistencias y contactos desde SharePoint
 * con remapeo dinámico de contacto_id por clave natural (nombre único).
 */
async function mergeAsistenciasDatabase(targetAsistenciasDb, tempDbPath) {
  const sqlite3 = require('sqlite3').verbose();
  const sourceDb = new sqlite3.Database(tempDbPath, sqlite3.OPEN_READONLY);

  const queryAll = (dbHandle, sql, params = []) => new Promise((resolve, reject) => {
    dbHandle.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });

  const queryGet = (dbHandle, sql, params = []) => new Promise((resolve, reject) => {
    dbHandle.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });

  const execRun = (dbHandle, sql, params = []) => new Promise((resolve, reject) => {
    dbHandle.run(sql, params, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });

  try {
    // 0. Asegurar esquema y columnas canónicas en targetAsistenciasDb antes de procesar el delta
    const contactCols = await queryAll(targetAsistenciasDb, "PRAGMA table_info(contactos_asistencia)");
    const contactColNames = contactCols.map(c => c.name);

    if (!contactColNames.includes('direccion')) {
      await execRun(targetAsistenciasDb, "ALTER TABLE contactos_asistencia ADD COLUMN direccion TEXT");
      if (contactColNames.includes('depto_habitual')) {
        await execRun(targetAsistenciasDb, "UPDATE contactos_asistencia SET direccion = depto_habitual WHERE direccion IS NULL OR direccion = ''");
      }
    }
    if (!contactColNames.includes('telefono')) {
      await execRun(targetAsistenciasDb, "ALTER TABLE contactos_asistencia ADD COLUMN telefono TEXT");
      if (contactColNames.includes('telefono_anexo')) {
        await execRun(targetAsistenciasDb, "UPDATE contactos_asistencia SET telefono = telefono_anexo WHERE telefono IS NULL OR telefono = ''");
      }
    }
    if (!contactColNames.includes('uuid')) {
      await execRun(targetAsistenciasDb, "ALTER TABLE contactos_asistencia ADD COLUMN uuid TEXT");
      try {
        await execRun(targetAsistenciasDb, "CREATE UNIQUE INDEX IF NOT EXISTS idx_contactos_uuid ON contactos_asistencia(uuid)");
      } catch (e) {}
    }

    const bitacoraCols = await queryAll(targetAsistenciasDb, "PRAGMA table_info(bitacora_asistencias)");
    const bitacoraColNames = bitacoraCols.map(c => c.name);

    if (!bitacoraColNames.includes('solicitante_direccion')) {
      await execRun(targetAsistenciasDb, "ALTER TABLE bitacora_asistencias ADD COLUMN solicitante_direccion TEXT");
      if (bitacoraColNames.includes('solicitante_cargo_depto')) {
        await execRun(targetAsistenciasDb, "UPDATE bitacora_asistencias SET solicitante_direccion = solicitante_cargo_depto WHERE solicitante_direccion IS NULL OR solicitante_direccion = ''");
      }
    }
    if (!bitacoraColNames.includes('solicitante_telefono')) {
      await execRun(targetAsistenciasDb, "ALTER TABLE bitacora_asistencias ADD COLUMN solicitante_telefono TEXT");
      if (bitacoraColNames.includes('solicitante_contacto')) {
        await execRun(targetAsistenciasDb, "UPDATE bitacora_asistencias SET solicitante_telefono = solicitante_contacto WHERE solicitante_telefono IS NULL OR solicitante_telefono = ''");
      }
    }
    if (!bitacoraColNames.includes('representado')) {
      await execRun(targetAsistenciasDb, "ALTER TABLE bitacora_asistencias ADD COLUMN representado TEXT");
    }
    if (!bitacoraColNames.includes('representado_id_lobby')) {
      await execRun(targetAsistenciasDb, "ALTER TABLE bitacora_asistencias ADD COLUMN representado_id_lobby INTEGER");
    }
    if (!bitacoraColNames.includes('contacto_uuid')) {
      await execRun(targetAsistenciasDb, "ALTER TABLE bitacora_asistencias ADD COLUMN contacto_uuid TEXT");
      try {
        await execRun(targetAsistenciasDb, "CREATE INDEX IF NOT EXISTS idx_bitacora_contacto_uuid ON bitacora_asistencias(contacto_uuid)");
      } catch (e) {}
    }

    const remoteCategories = await queryAll(sourceDb, "SELECT * FROM asistencia_categorias");
    const remoteContacts = await queryAll(sourceDb, "SELECT * FROM contactos_asistencia");
    const remoteBitacoras = await queryAll(sourceDb, "SELECT * FROM bitacora_asistencias");

    let remoteDirecciones = [];
    try {
      remoteDirecciones = await queryAll(sourceDb, "SELECT * FROM direcciones_municipales");
    } catch (dErr) {}

    // 1. Sincronizar Categorías
    for (const cat of remoteCategories) {
      await new Promise((resolve, reject) => {
        targetAsistenciasDb.run(`
          INSERT INTO asistencia_categorias (nombre, descripcion, activo, orden, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(nombre) DO UPDATE SET
            descripcion = COALESCE(excluded.descripcion, asistencia_categorias.descripcion),
            activo = COALESCE(excluded.activo, asistencia_categorias.activo),
            orden = COALESCE(excluded.orden, asistencia_categorias.orden),
            updated_at = excluded.updated_at
          WHERE excluded.updated_at > asistencia_categorias.updated_at
        `, [cat.nombre, cat.descripcion, cat.activo !== undefined ? cat.activo : 1, cat.orden || 0, cat.created_at, cat.updated_at], (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }

    // 1.1 Sincronizar Direcciones Municipales
    for (const d of remoteDirecciones) {
      await new Promise((resolve, reject) => {
        targetAsistenciasDb.run(`
          INSERT INTO direcciones_municipales (acronimo, nombre, orden, activo, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(acronimo) DO UPDATE SET
            nombre = COALESCE(excluded.nombre, direcciones_municipales.nombre),
            orden = COALESCE(excluded.orden, direcciones_municipales.orden),
            activo = COALESCE(excluded.activo, direcciones_municipales.activo),
            updated_at = excluded.updated_at
          WHERE excluded.updated_at > direcciones_municipales.updated_at
        `, [d.acronimo, d.nombre, d.orden || 0, d.activo !== undefined ? d.activo : 1, d.created_at, d.updated_at], (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }

    // 2. Sincronizar Contactos (Identificador Universal: uuid)
    const crypto = require('crypto');
    for (const c of remoteContacts) {
      const contactUuid = c.uuid || crypto.randomUUID();
      const contactDir = c.direccion !== undefined ? c.direccion : (c.depto_habitual || '');
      const contactTel = c.telefono !== undefined ? c.telefono : (c.telefono_anexo || '');
      await new Promise((resolve, reject) => {
        targetAsistenciasDb.run(`
          INSERT INTO contactos_asistencia (uuid, nombre, direccion, correo, telefono, notas, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(uuid) DO UPDATE SET
            nombre = excluded.nombre,
            direccion = COALESCE(excluded.direccion, contactos_asistencia.direccion),
            correo = COALESCE(excluded.correo, contactos_asistencia.correo),
            telefono = COALESCE(excluded.telefono, contactos_asistencia.telefono),
            notas = COALESCE(excluded.notas, contactos_asistencia.notas),
            updated_at = excluded.updated_at
          WHERE excluded.updated_at > contactos_asistencia.updated_at
        `, [contactUuid, c.nombre, contactDir, c.correo, contactTel, c.notas, c.created_at, c.updated_at], (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }

    // 3. Sincronizar Bitácora con Enlace Inequívoco por contacto_uuid y resolución LWW
    for (const b of remoteBitacoras) {
      let resolvedContactId = null;
      let resolvedContactUuid = b.contacto_uuid || null;

      if (resolvedContactUuid) {
        const contactRow = await queryGet(targetAsistenciasDb, "SELECT id FROM contactos_asistencia WHERE uuid = ?", [resolvedContactUuid]);
        if (contactRow) resolvedContactId = contactRow.id;
      } else if (b.solicitante_nombre && b.solicitante_nombre.trim()) {
        const contactRow = await queryGet(targetAsistenciasDb, "SELECT id, uuid FROM contactos_asistencia WHERE nombre = ? COLLATE NOCASE", [b.solicitante_nombre.trim()]);
        if (contactRow) {
          resolvedContactId = contactRow.id;
          resolvedContactUuid = contactRow.uuid;
        }
      }

      const bitacoraDir = b.solicitante_direccion !== undefined ? b.solicitante_direccion : (b.solicitante_cargo_depto || '');
      const bitacoraTel = b.solicitante_telefono !== undefined ? b.solicitante_telefono : (b.solicitante_contacto || '');
      const bitacoraRep = (b.representado !== undefined && b.representado !== null && typeof b.representado === 'string' && b.representado.trim()) ? b.representado.trim() : null;
      const bitacoraRepId = (b.representado_id_lobby !== undefined && b.representado_id_lobby !== null && !isNaN(b.representado_id_lobby)) ? parseInt(b.representado_id_lobby, 10) : null;

      await new Promise((resolve, reject) => {
        targetAsistenciasDb.run(`
          INSERT INTO bitacora_asistencias (
            ticket_codigo, contacto_id, contacto_uuid, fecha_hora, canal, solicitante_nombre, solicitante_direccion,
            solicitante_correo, solicitante_telefono, categoria, folio_lobby,
            motivo_consulta, solucion_orientacion, estado, representado, representado_id_lobby, creado_por, updated_by, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(ticket_codigo) DO UPDATE SET
            contacto_id = excluded.contacto_id,
            contacto_uuid = excluded.contacto_uuid,
            solicitante_nombre = excluded.solicitante_nombre,
            solicitante_direccion = excluded.solicitante_direccion,
            solicitante_correo = excluded.solicitante_correo,
            solicitante_telefono = excluded.solicitante_telefono,
            canal = excluded.canal,
            categoria = excluded.categoria,
            folio_lobby = excluded.folio_lobby,
            motivo_consulta = excluded.motivo_consulta,
            solucion_orientacion = excluded.solucion_orientacion,
            estado = excluded.estado,
            representado = excluded.representado,
            representado_id_lobby = excluded.representado_id_lobby,
            updated_by = excluded.updated_by,
            updated_at = excluded.updated_at
          WHERE excluded.updated_at > bitacora_asistencias.updated_at
        `, [
          b.ticket_codigo, resolvedContactId, resolvedContactUuid, b.fecha_hora, b.canal || 'telefono', b.solicitante_nombre, bitacoraDir,
          b.solicitante_correo, bitacoraTel, b.categoria, b.folio_lobby,
          b.motivo_consulta, b.solucion_orientacion, b.estado, bitacoraRep, bitacoraRepId,
          b.creado_por || b.created_by, b.updated_by, b.created_at, b.updated_at
        ], (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }
    console.log(`✓ Delta merge de asistencias.db completado: ${remoteContacts.length} contactos y ${remoteBitacoras.length} asistencias procesadas con UUID.`);
  } finally {
    sourceDb.close();
  }
}

/**
 * Resuelve metadatos y nombres de archivos de forma genérica para cualquier base de datos.
 * Casos específicos conocidos:
 *  - 'lobby' -> 'lobby_control.db', 'version_lobby.json'
 *  - 'usuarios' -> 'usuarios.db', 'version_users.json'
 *  - 'local' / 'asistencias' -> 'asistencias.db', 'version_asistencias.json'
 * Para cualquier base de datos futura (ej: 'inventario'):
 *  - '${type}.db', 'version_${type}.json'
 */
function resolveDbMetadata(type) {
  const normType = String(type || 'lobby').trim().toLowerCase();
  let remoteDbName = `${normType}.db`;
  let remoteVersionName = `version_${normType}.json`;

  if (normType === 'lobby') {
    remoteDbName = 'lobby_control.db';
    remoteVersionName = 'version_lobby.json';
  } else if (normType === 'usuarios') {
    remoteDbName = 'usuarios.db';
    remoteVersionName = 'version_users.json';
  } else if (normType === 'local' || normType === 'asistencias') {
    remoteDbName = 'asistencias.db';
    remoteVersionName = 'version_asistencias.json';
  }

  return { remoteDbName, remoteVersionName, normType };
}

/**
 * Guarda la marca de tiempo de sincronización en la base de datos de manera universal.
 * Para 'lobby' se almacena en su tabla 'configuracion' ('db_last_update').
 * Para cualquier otra base de datos se almacena en 'configuracion_local' con clave `${normType}_last_update`.
 */
async function saveSyncTimestamp(db, type, timestampStr) {
  const { normType } = resolveDbMetadata(type);
  const database = require('./database');

  if (normType === 'lobby') {
    return new Promise((resolve, reject) => {
      db.run("INSERT OR REPLACE INTO configuracion (clave, valor) VALUES ('db_last_update', ?)", [timestampStr], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  const configKey = normType === 'usuarios' ? 'users_last_update' : `${normType}_last_update`;
  return new Promise((resolve, reject) => {
    database.localDb.run("INSERT OR REPLACE INTO configuracion_local (clave, valor) VALUES (?, ?)", [configKey, timestampStr], (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

/**
 * Ejecuta la verificación y sincronización de base de datos desde SharePoint.
 * @param {Object} db - Instancia del proxy de la base de datos
 * @param {String} cookieHeader - Cookies de sesión válidas de SharePoint
 * @param {String} type - Tipo de base de datos a sincronizar ('lobby', 'usuarios', 'asistencias', etc.)
 * @returns {Promise<Boolean>} - Retorna true si hubo actualización, false de lo contrario.
 */
async function checkAndSyncDatabase(db, cookieHeader, type = 'lobby') {
  const siteUrl = process.env.SHAREPOINT_SITE_URL || 'https://immaipu.sharepoint.com/sites/SECMU';
  const folderPath = process.env.SHAREPOINT_FOLDER_PATH || '/sites/SECMU/Lobby/LobbyControl';

  if (!siteUrl || !folderPath) {
    console.log(`Sincronización remota para ${type} omitida: Falta configuración en las variables de entorno.`);
    return false;
  }

  const { remoteDbName, remoteVersionName, normType } = resolveDbMetadata(type);
  const isAsistencias = normType === 'asistencias' || normType === 'local';

  // Construir las URLs de la API REST de SharePoint
  const cleanSiteUrl = siteUrl.replace(/\/$/, '');
  const cleanFolderPath = folderPath.replace(/\/$/, '');
  const versionUrl = `${cleanSiteUrl}/_api/web/GetFileByServerRelativeUrl('${cleanFolderPath}/${remoteVersionName}')/$value`;
  const dbUrl = `${cleanSiteUrl}/_api/web/GetFileByServerRelativeUrl('${cleanFolderPath}/${remoteDbName}')/$value`;

  const dbDir = db.getUserDataDir();
  const localVersionPath = path.join(dbDir, remoteVersionName);
  const localDbPath = db.getDbPath();
  
  const tempDbPath = path.join(dbDir, `${remoteDbName}.tmp`);
  const tempVersionPath = path.join(dbDir, `${remoteVersionName}.tmp`);

  try {
    console.log(`Comprobando versión de ${remoteDbName} remota en SharePoint...`);
    // 1. Descargar versión remota
    try {
      await downloadAuthenticatedFile(versionUrl, tempVersionPath, cookieHeader);
    } catch (verErr) {
      if (verErr.status === 404 || (verErr.message && verErr.message.includes('404'))) {
        console.log(`ℹ️ Archivo de versión ${remoteVersionName} no existe en SharePoint (404). Se asume primera sincronización.`);
        return false;
      }
      throw verErr;
    }
    const remoteVersion = JSON.parse(fs.readFileSync(tempVersionPath, 'utf8'));

    // 2. Calcular firma de la base de datos local actual si existe
    let localDbSignature = '';
    if (fs.existsSync(localDbPath)) {
      try {
        // Forzar checkpoint de WAL antes de leer el archivo físico para asegurar datos frescos
        await new Promise((resolve) => {
          db.run("PRAGMA wal_checkpoint(TRUNCATE)", (err) => {
            if (err) console.warn(`Advertencia al forzar checkpoint de WAL para firma en checkAndSyncDatabase:`, err.message);
            resolve();
          });
        });

        const crypto = require('crypto');
        const dbBuffer = fs.readFileSync(localDbPath);
        localDbSignature = crypto.createHmac('sha256', 'LobbyControl_Secure_Key_2026_Maipu')
          .update(dbBuffer)
          .digest('hex');
      } catch (sigErr) {
        console.warn(`Error al calcular firma local para ${remoteDbName}, forzando descarga:`, sigErr.message);
      }
    }

    // 3. Comprobar versión local
    let localVersion = { last_import_timestamp: 'Nunca' };
    if (fs.existsSync(localVersionPath)) {
      try {
        localVersion = JSON.parse(fs.readFileSync(localVersionPath, 'utf8'));
      } catch (e) {
        console.warn(`Archivo ${remoteVersionName} local corrupto, forzando descarga completa.`);
      }
    }

    // 4. Comparar marcas de tiempo Y firmas digitales
    const remoteDate = parseTimestamp(remoteVersion.last_import_timestamp);
    const localDate = parseTimestamp(localVersion.last_import_timestamp);

    const isRemoteNewer = remoteDate > localDate;
    const isLocalNewer = localDate > remoteDate;
    const isSignatureDifferent = remoteVersion.db_signature !== localDbSignature;

    let shouldDownload = false;
    let logMessage = '';
    let isSecurityAlert = false;

    if (isRemoteNewer) {
      shouldDownload = true;
      logMessage = `Nueva versión de ${remoteDbName} disponible en SharePoint (${remoteVersion.last_import_timestamp}). Descargando...`;
    } else if (isLocalNewer) {
      console.log(`La base de datos local ${remoteDbName} es más reciente (${localVersion.last_import_timestamp}) que la remota. Se omite la descarga.`);
      shouldDownload = false;
    } else {
      if (isSignatureDifferent) {
        shouldDownload = true;
        isSecurityAlert = true;
        logMessage = `⚠️ ALERTA: La base de datos local ${remoteDbName} difiere en firma digital. Forzando sincronización desde SharePoint...`;
      } else {
        console.log(`Base de datos local ${remoteDbName} al día y firma validada.`);
        shouldDownload = false;
      }
    }

    if (shouldDownload) {
      if (isSecurityAlert) console.warn(logMessage);
      else console.log(logMessage);
      
      // 5. Descargar nueva base de datos
      try {
        await downloadAuthenticatedFile(dbUrl, tempDbPath, cookieHeader);
      } catch (dbErr) {
        if (dbErr.status === 404 || (dbErr.message && dbErr.message.includes('404'))) {
          console.log(`ℹ️ Base de datos ${remoteDbName} no existe en SharePoint (404). Se omite descarga.`);
          return false;
        }
        throw dbErr;
      }
      
      // Verificar si el archivo descargado está comprimido en GZIP
      let isCompressed = false;
      try {
        const fd = fs.openSync(tempDbPath, 'r');
        const headerBuffer = Buffer.alloc(2);
        fs.readSync(fd, headerBuffer, 0, 2, 0);
        fs.closeSync(fd);
        if (headerBuffer[0] === 0x1f && headerBuffer[1] === 0x8b) {
          isCompressed = true;
        }
      } catch (e) {
        console.warn('Advertencia en detección de cabecera GZIP:', e.message);
      }

      if (isCompressed || remoteVersion.db_compression === 'gzip') {
        console.log(`Detectada base de datos ${remoteDbName} comprimida con Gzip. Descomprimiendo...`);
        const decompressedTempPath = tempDbPath + '.decompressed';
        await decompressFileAsync(tempDbPath, decompressedTempPath);
        
        fs.unlinkSync(tempDbPath);
        fs.renameSync(decompressedTempPath, tempDbPath);
      }

      // Validar la firma de la base de datos descargada para mayor seguridad
      const downloadedBuffer = fs.readFileSync(tempDbPath);
      const crypto = require('crypto');
      const downloadedSignature = crypto.createHmac('sha256', 'LobbyControl_Secure_Key_2026_Maipu')
        .update(downloadedBuffer)
        .digest('hex');
        
      if (downloadedSignature !== remoteVersion.db_signature) {
        throw new Error(`La firma de ${remoteDbName} descargada no coincide con el servidor.`);
      }

      // Si es asistencias.db, ejecutar Delta Merge para no perder registros locales
      if (isAsistencias) {
        console.log(`Ejecutando Row-Level Delta Merge en asistencias.db...`);
        await mergeAsistenciasDatabase(db, tempDbPath);
        fs.copyFileSync(tempVersionPath, localVersionPath);
        try { fs.unlinkSync(tempDbPath); } catch (e) {}
        try { fs.unlinkSync(tempVersionPath); } catch (e) {}

        const timestampStr = remoteVersion.last_import_timestamp;
        await saveSyncTimestamp(db, normType, timestampStr);
        console.log(`✓ Delta Merge de ${remoteDbName} completado con éxito.`);
        return true;
      }
      
      // 6. Intercambio seguro en caliente para lobby_control.db y usuarios.db
      console.log(`Reemplazando base de datos local ${remoteDbName} SQLite...`);
      await db.closeConnection();
      
      // Breve pausa para asegurar la liberación del lock del archivo por el OS
      await new Promise(resolve => setTimeout(resolve, 200));

      // Eliminar archivos WAL y SHM asociados para evitar corrupción
      const localWalPath = `${localDbPath}-wal`;
      const localShmPath = `${localDbPath}-shm`;
      if (fs.existsSync(localWalPath)) {
        try { fs.unlinkSync(localWalPath); } catch (e) { console.warn(`Advertencia al eliminar WAL viejo: ${e.message}`); }
      }
      if (fs.existsSync(localShmPath)) {
        try { fs.unlinkSync(localShmPath); } catch (e) { console.warn(`Advertencia al eliminar SHM viejo: ${e.message}`); }
      }

      try {
        await copyFileWithRetry(tempDbPath, localDbPath);
        await copyFileWithRetry(tempVersionPath, localVersionPath);
      } catch (copyErr) {
        console.error(`Error crítico al copiar base de datos temporal: ${copyErr.message}. Restaurando conexión original...`);
        try {
          await db.openConnection();
        } catch (openErr) {
          console.error(`Error al intentar restaurar conexión original: ${openErr.message}`);
        }
        throw copyErr;
      }
      
      // Limpiar temporales
      try { fs.unlinkSync(tempDbPath); } catch (e) {}
      try { fs.unlinkSync(tempVersionPath); } catch (e) {}

      await db.openConnection();
      
      // Guardar marca de tiempo en la base correspondiente
      const timestampStr = remoteVersion.last_import_timestamp;
      await saveSyncTimestamp(db, normType, timestampStr);

      console.log(`✓ Base de datos ${remoteDbName} sincronizada con éxito.`);
      return true;
    } else {
      if (fs.existsSync(tempVersionPath)) {
        fs.unlinkSync(tempVersionPath);
      }
      return false;
    }
  } catch (err) {
    console.error(`Error durante la sincronización de ${remoteDbName}:`, err.message);
    if (fs.existsSync(tempDbPath)) fs.unlinkSync(tempDbPath);
    if (fs.existsSync(tempVersionPath)) fs.unlinkSync(tempVersionPath);
    throw err;
  }
}

/**
 * Parsea un timestamp en formato "DD-MM-YYYY HH:mm" a un objeto Date.
 * @param {String} tsStr 
 * @returns {Date}
 */
function parseTimestamp(tsStr) {
  if (!tsStr || tsStr === 'Nunca') return new Date(0);
  const parts = tsStr.split(' ');
  if (parts.length < 2) return new Date(0);
  const dateParts = parts[0].split('-');
  const timeParts = parts[1].split(':');
  if (dateParts.length < 3 || timeParts.length < 2) return new Date(0);
  const day = parseInt(dateParts[0], 10);
  const month = parseInt(dateParts[1], 10) - 1;
  const year = parseInt(dateParts[2], 10);
  const hour = parseInt(timeParts[0], 10);
  const minute = parseInt(timeParts[1], 10);
  return new Date(year, month, day, hour, minute);
}

/**
 * Comprime, firma y sube la base de datos local y su archivo de versión a SharePoint.
 * @param {Object} db - Instancia del proxy de base de datos
 * @param {String} cookieHeader - Cookies de autenticación válidas
 * @param {String} type - Tipo de base de datos a subir ('lobby' o 'usuarios')
 * @returns {Promise<void>}
 */
async function uploadDatabaseToSharePoint(db, cookieHeader, type = 'lobby') {
  const { net } = require('electron');
  const zlib = require('zlib');
  const crypto = require('crypto');

  const siteUrl = process.env.SHAREPOINT_SITE_URL || 'https://immaipu.sharepoint.com/sites/SECMU';
  const folderPath = process.env.SHAREPOINT_FOLDER_PATH || '/sites/SECMU/Lobby/LobbyControl';

  if (!siteUrl || !folderPath) {
    throw new Error('Falta configuración de SHAREPOINT_SITE_URL o SHAREPOINT_FOLDER_PATH en las variables de entorno.');
  }

  const { remoteDbName, remoteVersionName, normType } = resolveDbMetadata(type);

  const dbDir = db.getUserDataDir();
  const localDbPath = db.getDbPath();
  const localVersionPath = path.join(dbDir, remoteVersionName);

  const cleanSiteUrl = siteUrl.replace(/\/$/, '');
  const cleanFolderPath = folderPath.replace(/\/$/, '');

  // 1. Leer y comprimir la base de datos local
  if (!fs.existsSync(localDbPath)) {
    throw new Error(`No se encontró la base de datos local ${remoteDbName} para subir.`);
  }

  // Forzar checkpoint de WAL para escribir los cambios del archivo -wal al principal en disco
  await new Promise((resolve) => {
    db.run("PRAGMA wal_checkpoint(TRUNCATE)", (err) => {
      if (err) console.warn(`Advertencia al forzar checkpoint de WAL en uploadDatabaseToSharePoint para ${remoteDbName}:`, err.message);
      resolve();
    });
  });

  console.log(`[Upload Sync] Comprimiendo base de datos ${remoteDbName}...`);
  const dbBuffer = fs.readFileSync(localDbPath);
  const compressedDb = zlib.gzipSync(dbBuffer);

  // 2. Calcular firma HMAC y preparar versión json
  console.log(`[Upload Sync] Firmando base de datos ${remoteDbName}...`);
  const signature = crypto.createHmac('sha256', 'LobbyControl_Secure_Key_2026_Maipu')
    .update(dbBuffer)
    .digest('hex');

  // Obtener timestamp actual en formato DD-MM-YYYY HH:mm
  const now = new Date();
  const d = String(now.getDate()).padStart(2, '0');
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const y = now.getFullYear();
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  const timestampStr = `${d}-${m}-${y} ${hh}:${min}`;

  const versionData = {
    last_import_timestamp: timestampStr,
    db_size: dbBuffer.length,
    db_signature: signature,
    db_compression: 'gzip'
  };

  const versionStr = JSON.stringify(versionData, null, 2);

  // Helper local para realizar fetch con timeout
  const fetchWithTimeout = async (url, options, timeoutMs = 30000) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await net.fetch(url, {
        ...options,
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      return res;
    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        throw new Error(`Tiempo de espera agotado al subir a SharePoint (timeout ${timeoutMs / 1000}s).`);
      }
      throw err;
    }
  };

  // 3. Obtener el Request Digest de SharePoint
  console.log('[Upload Sync] Solicitando Request Digest a SharePoint...');
  const digestUrl = `${cleanSiteUrl}/_api/contextinfo`;
  const digestRes = await fetchWithTimeout(digestUrl, {
    method: 'POST',
    headers: {
      'Cookie': cookieHeader,
      'Accept': 'application/json;odata=verbose'
    }
  });

  if (!digestRes.ok) {
    const errText = await digestRes.text();
    throw new Error(`Fallo al obtener Request Digest (HTTP ${digestRes.status}): ${errText}`);
  }

  const digestData = await digestRes.json();
  const digest = digestData.d?.GetContextWebInformation?.FormDigestValue;
  if (!digest) {
    throw new Error('No se encontró FormDigestValue en la respuesta de contextinfo.');
  }

  // 4. Subir archivo de versión a SharePoint
  console.log(`[Upload Sync] Subiendo ${remoteVersionName}...`);
  const versionUploadUrl = `${cleanSiteUrl}/_api/web/GetFolderByServerRelativeUrl('${cleanFolderPath}')/Files/Add(url='${remoteVersionName}',overwrite=true)`;
  const versionRes = await fetchWithTimeout(versionUploadUrl, {
    method: 'POST',
    headers: {
      'Cookie': cookieHeader,
      'X-RequestDigest': digest,
      'Accept': 'application/json;odata=verbose'
    },
    body: new Uint8Array(Buffer.from(versionStr))
  });

  if (!versionRes.ok) {
    const errText = await versionRes.text();
    throw new Error(`Fallo al subir ${remoteVersionName} (HTTP ${versionRes.status}): ${errText}`);
  }

  // 5. Subir base de datos comprimida a SharePoint
  console.log(`[Upload Sync] Subiendo ${remoteDbName}...`);
  const dbUploadUrl = `${cleanSiteUrl}/_api/web/GetFolderByServerRelativeUrl('${cleanFolderPath}')/Files/Add(url='${remoteDbName}',overwrite=true)`;
  const dbRes = await fetchWithTimeout(dbUploadUrl, {
    method: 'POST',
    headers: {
      'Cookie': cookieHeader,
      'X-RequestDigest': digest,
      'Accept': 'application/json;odata=verbose'
    },
    body: new Uint8Array(compressedDb)
  });

  if (!dbRes.ok) {
    const errText = await dbRes.text();
    throw new Error(`Fallo al subir ${remoteDbName} (HTTP ${dbRes.status}): ${errText}`);
  }

  // 6. Guardar localmente los archivos de versión y timestamp
  fs.writeFileSync(localVersionPath, versionStr, 'utf8');
  await saveSyncTimestamp(db, normType, timestampStr);

  console.log(`✓ Sincronización de subida exitosa para ${remoteDbName}.`);
}

/**
 * Descarga la base de datos de usuarios a una ubicación temporal para su posterior validación.
 * @param {String} cookieHeader 
 * @param {String} tempDbPath 
 * @param {String} tempVersionPath 
 * @returns {Promise<void>}
 */
async function downloadUsersDatabaseTemp(cookieHeader, tempDbPath, tempVersionPath) {
  const siteUrl = process.env.SHAREPOINT_SITE_URL || 'https://immaipu.sharepoint.com/sites/SECMU';
  const folderPath = process.env.SHAREPOINT_FOLDER_PATH || '/sites/SECMU/Lobby/LobbyControl';

  if (!siteUrl || !folderPath) {
    throw new Error('Falta configuración de SHAREPOINT_SITE_URL o SHAREPOINT_FOLDER_PATH');
  }

  const cleanSiteUrl = siteUrl.replace(/\/$/, '');
  const cleanFolderPath = folderPath.replace(/\/$/, '');
  const dbUrl = `${cleanSiteUrl}/_api/web/GetFileByServerRelativeUrl('${cleanFolderPath}/usuarios.db')/$value`;
  const versionUrl = `${cleanSiteUrl}/_api/web/GetFileByServerRelativeUrl('${cleanFolderPath}/version_users.json')/$value`;

  // 1. Descargar version_users.json a la ruta temporal
  await downloadAuthenticatedFile(versionUrl, tempVersionPath, cookieHeader);

  // 2. Descargar usuarios.db a la ruta temporal
  await downloadAuthenticatedFile(dbUrl, tempDbPath, cookieHeader);

  // 3. Descomprimir si tiene cabecera GZIP
  let isCompressed = false;
  try {
    const fd = fs.openSync(tempDbPath, 'r');
    const headerBuffer = Buffer.alloc(2);
    fs.readSync(fd, headerBuffer, 0, 2, 0);
    fs.closeSync(fd);
    if (headerBuffer[0] === 0x1f && headerBuffer[1] === 0x8b) {
      isCompressed = true;
    }
  } catch (e) {}

  if (isCompressed) {
    console.log('[Login Temp Sync] Detectado usuarios.db temporal comprimido con GZIP. Descomprimiendo...');
    const decompressedTempPath = tempDbPath + '.decompressed';
    await decompressFileAsync(tempDbPath, decompressedTempPath);
    fs.unlinkSync(tempDbPath);
    fs.renameSync(decompressedTempPath, tempDbPath);
    console.log('[Login Temp Sync] Descompresión completada.');
  }

  // Validar firma digital de la base de datos descargada para seguridad
  const remoteVersion = JSON.parse(fs.readFileSync(tempVersionPath, 'utf8'));
  const downloadedBuffer = fs.readFileSync(tempDbPath);
  const crypto = require('crypto');
  const downloadedSignature = crypto.createHmac('sha256', 'LobbyControl_Secure_Key_2026_Maipu')
    .update(downloadedBuffer)
    .digest('hex');
    
  if (downloadedSignature !== remoteVersion.db_signature) {
    throw new Error('La base de datos de usuarios descargada no coincide con la firma digital.');
  }
}

let isAsistenciasSyncing = false;
let hasPendingAsistenciasSync = false;

/**
 * Ejecuta un ciclo seguro Pull-Merge-Push para asistencias.db:
 * 1. Descarga deltas remotos de SharePoint y fusiona con SQLite local.
 * 2. Sube la base local consolidada resultante a SharePoint.
 * Cuenta con un candado en memoria para evitar colisiones entre llamadas simultáneas.
 * @param {Object} db - Instancia de asistenciasDb
 * @param {String} cookieHeader - Cookies de SharePoint activas
 * @returns {Promise<Boolean>}
 */
async function safeSyncAndUploadAsistencias(db, cookieHeader) {
  if (!cookieHeader) return false;
  if (isAsistenciasSyncing) {
    hasPendingAsistenciasSync = true;
    return false;
  }

  isAsistenciasSyncing = true;
  try {
    await checkAndSyncDatabase(db, cookieHeader, 'asistencias');
    await uploadDatabaseToSharePoint(db, cookieHeader, 'asistencias');
    return true;
  } catch (err) {
    console.error('[safeSyncAndUploadAsistencias] Error en ciclo Pull-Merge-Push:', err.message);
    throw err;
  } finally {
    isAsistenciasSyncing = false;
    if (hasPendingAsistenciasSync) {
      hasPendingAsistenciasSync = false;
      safeSyncAndUploadAsistencias(db, cookieHeader).catch(e => {
        console.warn('[safeSyncAndUploadAsistencias] Error en sincronización encolada:', e.message);
      });
    }
  }
}

module.exports = { 
  checkAndSyncDatabase, 
  uploadDatabaseToSharePoint, 
  downloadUsersDatabaseTemp, 
  mergeAsistenciasDatabase,
  safeSyncAndUploadAsistencias
};
