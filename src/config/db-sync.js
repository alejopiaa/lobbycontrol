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
      throw new Error(`Fallo de descarga HTTP ${response.status}: ${response.statusText}`);
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
 * Ejecuta la verificación y sincronización de base de datos desde SharePoint.
 * @param {Object} db - Instancia del proxy de la base de datos
 * @param {String} cookieHeader - Cookies de sesión válidas de SharePoint
 * @param {String} type - Tipo de base de datos a sincronizar ('lobby' o 'usuarios')
 * @returns {Promise<Boolean>} - Retorna true si hubo actualización, false de lo contrario.
 */
async function checkAndSyncDatabase(db, cookieHeader, type = 'lobby') {
  const siteUrl = process.env.SHAREPOINT_SITE_URL || 'https://immaipu.sharepoint.com/sites/SECMU';
  const folderPath = process.env.SHAREPOINT_FOLDER_PATH || '/sites/SECMU/Lobby/LobbyControl';

  if (!siteUrl || !folderPath) {
    console.log(`Sincronización remota para ${type} omitida: Falta configuración en las variables de entorno.`);
    return false;
  }

  const isLobby = type === 'lobby';
  const remoteDbName = isLobby ? 'lobby_control.db' : 'usuarios.db';
  const remoteVersionName = isLobby ? 'version_lobby.json' : 'version_users.json';

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
    await downloadAuthenticatedFile(versionUrl, tempVersionPath, cookieHeader);
    const remoteVersion = JSON.parse(fs.readFileSync(tempVersionPath, 'utf8'));

    // 2. Calcular firma de la base de datos local actual si existe
    let localDbSignature = '';
    if (fs.existsSync(localDbPath)) {
      try {
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
        logMessage = `⚠️ ALERTA: La base de datos local ${remoteDbName} difiere en firma digital. Forzando descarga limpia desde SharePoint...`;
      } else {
        console.log(`Base de datos local ${remoteDbName} al día y firma validada.`);
        shouldDownload = false;
      }
    }

    if (shouldDownload) {
      if (isSecurityAlert) console.warn(logMessage);
      else console.log(logMessage);
      
      // 5. Descargar nueva base de datos
      await downloadAuthenticatedFile(dbUrl, tempDbPath, cookieHeader);
      
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
      
      // 6. Intercambio seguro en caliente (Cerrar conexión, reemplazar, reabrir)
      console.log(`Reemplazando base de datos local ${remoteDbName} SQLite...`);
      await db.closeConnection();
      
      fs.copyFileSync(tempDbPath, localDbPath);
      fs.copyFileSync(tempVersionPath, localVersionPath);
      
      // Limpiar temporales
      fs.unlinkSync(tempDbPath);
      fs.unlinkSync(tempVersionPath);

      await db.openConnection();
      
      // Guardar marca de tiempo en la base correspondiente
      const timestampStr = remoteVersion.last_import_timestamp;
      if (isLobby) {
        await new Promise((resolve, reject) => {
          db.run("INSERT OR REPLACE INTO configuracion (clave, valor) VALUES ('db_last_update', ?)", [timestampStr], (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      } else {
        const database = require('./database');
        await new Promise((resolve, reject) => {
          database.localDb.run("INSERT OR REPLACE INTO configuracion_local (clave, valor) VALUES ('users_last_update', ?)", [timestampStr], (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      }

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

  const isLobby = type === 'lobby';
  const remoteDbName = isLobby ? 'lobby_control.db' : 'usuarios.db';
  const remoteVersionName = isLobby ? 'version_lobby.json' : 'version_users.json';

  const dbDir = db.getUserDataDir();
  const localDbPath = db.getDbPath();
  const localVersionPath = path.join(dbDir, remoteVersionName);

  const cleanSiteUrl = siteUrl.replace(/\/$/, '');
  const cleanFolderPath = folderPath.replace(/\/$/, '');

  // 1. Leer y comprimir la base de datos local
  if (!fs.existsSync(localDbPath)) {
    throw new Error(`No se encontró la base de datos local ${remoteDbName} para subir.`);
  }
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

  // 3. Obtener el Request Digest de SharePoint
  console.log('[Upload Sync] Solicitando Request Digest a SharePoint...');
  const digestUrl = `${cleanSiteUrl}/_api/contextinfo`;
  const digestRes = await net.fetch(digestUrl, {
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
  const versionRes = await net.fetch(versionUploadUrl, {
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
  const dbRes = await net.fetch(dbUploadUrl, {
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

  // 6. Guardar localmente los archivos de versión
  fs.writeFileSync(localVersionPath, versionStr, 'utf8');
  
  // Guardar en la base de datos correspondiente la fecha de última actualización
  if (isLobby) {
    await new Promise((resolve, reject) => {
      db.run("INSERT OR REPLACE INTO configuracion (clave, valor) VALUES ('db_last_update', ?)", [timestampStr], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  } else {
    const database = require('./database');
    await new Promise((resolve, reject) => {
      database.localDb.run("INSERT OR REPLACE INTO configuracion_local (clave, valor) VALUES ('users_last_update', ?)", [timestampStr], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

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

module.exports = { checkAndSyncDatabase, uploadDatabaseToSharePoint, downloadUsersDatabaseTemp };
