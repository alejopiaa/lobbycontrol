const fs = require('fs');
const path = require('path');
const https = require('https');

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
function downloadAuthenticatedFile(url, destPath, cookieHeader) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    
    let parsedUrl;
    try {
      parsedUrl = new URL(url);
    } catch (e) {
      return reject(new Error(`URL inválida para descarga: ${url}`));
    }

    const options = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      headers: {
        'Cookie': cookieHeader,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Electron/LobbyControl'
      }
    };

    https.get(options, (response) => {
      // Manejar redirecciones 301/302 (SharePoint redirige las descargas directas)
      if (response.statusCode === 301 || response.statusCode === 302) {
        file.close(); // Cerrar el stream de escritura actual
        fs.unlinkSync(destPath); // Eliminar el archivo vacío temporal
        
        let redirectUrl = response.headers.location;
        if (redirectUrl && !redirectUrl.startsWith('http')) {
          // Redirección relativa
          redirectUrl = parsedUrl.origin + redirectUrl;
        }
        
        // Llamado recursivo con la nueva URL de redirección
        downloadAuthenticatedFile(redirectUrl, destPath, cookieHeader)
          .then(resolve)
          .catch(reject);
        return;
      }

      if (response.statusCode !== 200) {
        file.close();
        fs.unlinkSync(destPath);
        return reject(new Error(`Fallo de descarga HTTP ${response.statusCode}: ${response.statusMessage}`));
      }

      response.pipe(file);
      file.on('finish', () => {
        file.close(resolve);
      });
    }).on('error', (err) => {
      file.close();
      if (fs.existsSync(destPath)) {
        fs.unlinkSync(destPath);
      }
      reject(err);
    });
  });
}

/**
 * Ejecuta la verificación y sincronización de base de datos desde SharePoint.
 * @param {Object} db - Instancia del proxy de la base de datos
 * @param {String} cookieHeader - Cookies de sesión válidas de SharePoint
 * @returns {Promise<Boolean>} - Retorna true si hubo actualización, false de lo contrario.
 */
async function checkAndSyncDatabase(db, cookieHeader) {
  const versionUrl = process.env.SHAREPOINT_VERSION_URL || 'https://immaipu.sharepoint.com/sites/SECMU/_layouts/15/guestaccess.aspx?share=IQAEqx-udSnjR45ENm8jcNqPAd0QSIgfWRzK6-U9madcQbA&e=d4EjCH&download=1';
  const dbUrl = process.env.SHAREPOINT_DB_URL || 'https://immaipu.sharepoint.com/sites/SECMU/_layouts/15/guestaccess.aspx?share=IQAfzlIEO2_3Sog3WHRpNfmWATBo8wbHkWgrvo3J3ncFW4M&e=asp2UG&download=1';

  if (!versionUrl || !dbUrl) {
    console.log('Sincronización remota omitida: Falta configuración de SHAREPOINT_VERSION_URL o SHAREPOINT_DB_URL en .env');
    return false;
  }

  const dbDir = db.getUserDataDir();
  const localVersionPath = path.join(dbDir, 'version.json');
  const localDbPath = db.getDbPath();
  
  const tempDbPath = path.join(dbDir, 'lobby.db.tmp');
  const tempVersionPath = path.join(dbDir, 'version.json.tmp');

  try {
    console.log('Comprobando versión de base de datos remota en SharePoint...');
    // 1. Descargar version.json remoto
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
        console.warn('Error al calcular firma local, forzando descarga:', sigErr.message);
      }
    }

    // 3. Comprobar versión local
    let localVersion = { last_import_timestamp: 'Nunca' };
    if (fs.existsSync(localVersionPath)) {
      try {
        localVersion = JSON.parse(fs.readFileSync(localVersionPath, 'utf8'));
      } catch (e) {
        console.warn('Archivo version.json local corrupto, forzando descarga completa.');
      }
    }

    // 4. Comparar marcas de tiempo Y firmas digitales de forma inteligente
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
      logMessage = `Nueva versión disponible en SharePoint (${remoteVersion.last_import_timestamp}). Descargando base de datos...`;
    } else if (isLocalNewer) {
      console.log(`[SSO Sync] La base de datos local es más reciente (${localVersion.last_import_timestamp}) que la de SharePoint (${remoteVersion.last_import_timestamp}). Se omite la descarga.`);
      shouldDownload = false;
    } else {
      // Tienen la misma marca de tiempo
      if (isSignatureDifferent) {
        shouldDownload = true;
        isSecurityAlert = true;
        logMessage = '⚠️ ALERTA DE SEGURIDAD: La base de datos local tiene el mismo timestamp pero diferente firma (alterada o corrupta). Forzando descarga limpia desde SharePoint...';
      } else {
        console.log('Base de datos local al día y firma validada.');
        shouldDownload = false;
      }
    }

    if (shouldDownload) {
      if (isSecurityAlert) {
        console.warn(logMessage);
      } else {
        console.log(logMessage);
      }
      
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
        console.log('Detectada base de datos comprimida con Gzip. Descomprimiendo de forma asíncrona usando Streams...');
        const decompressedTempPath = tempDbPath + '.decompressed';
        await decompressFileAsync(tempDbPath, decompressedTempPath);
        
        // Reemplazar el archivo temporal con el descomprimido
        fs.unlinkSync(tempDbPath);
        fs.renameSync(decompressedTempPath, tempDbPath);
        console.log('Descompresión completada con éxito.');
      }

      // Validar la firma de la base de datos descargada para mayor seguridad
      const downloadedBuffer = fs.readFileSync(tempDbPath);
      const crypto = require('crypto');
      const downloadedSignature = crypto.createHmac('sha256', 'LobbyControl_Secure_Key_2026_Maipu')
        .update(downloadedBuffer)
        .digest('hex');
        
      if (downloadedSignature !== remoteVersion.db_signature) {
        throw new Error('La base de datos descargada de SharePoint no coincide con la firma digital del servidor.');
      }
      
      // 6. Intercambio seguro en caliente (Cerrar conexión SQLite, reemplazar, reabrir)
      console.log('Reemplazando base de datos local SQLite...');
      await db.closeConnection();
      
      fs.copyFileSync(tempDbPath, localDbPath);
      fs.copyFileSync(tempVersionPath, localVersionPath);
      
      // Limpiar temporales
      fs.unlinkSync(tempDbPath);
      fs.unlinkSync(tempVersionPath);

      await db.openConnection();
      console.log('✓ Base de datos sincronizada y cargada con éxito.');
      return true;
    } else {
      if (fs.existsSync(tempVersionPath)) {
        fs.unlinkSync(tempVersionPath);
      }
      return false;
    }
  } catch (err) {
    console.error('Error durante la sincronización de SharePoint:', err.message);
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

module.exports = { checkAndSyncDatabase };
