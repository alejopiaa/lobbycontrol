/**
 * migrate_sharepoint_dbs.js
 * 
 * Script de Migración a SharePoint en Modo Convivencia (Blue/Green)
 * para la nueva arquitectura desacoplada (data.db y app.db).
 * 
 * Principios:
 * 1. Modo Convivencia: No elimina archivos legados (lobby_control.db, asistencias.db /* legacy / fallback *\/)
 *    en SharePoint para garantizar la operatividad de clientes aún no actualizados.
 * 2. Cierre y Checkpoint Estricto en Windows: Ejecuta PRAGMA wal_checkpoint(TRUNCATE)
 *    seguido de db.close() antes de cualquier lectura binaria para evitar EBUSY.
 * 3. Preparación de Artefactos: Genera data.db (Gzip), app.db (Gzip), version_data.json y
 *    version_app.json con firmas HMAC SHA-256 en la carpeta de staging.
 * 4. Ejecución Segura: Permite modo '--dry-run' o subida en vivo si SHAREPOINT_COOKIES está presente.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const zlib = require('zlib');
const crypto = require('crypto');
const sqlite3 = require('sqlite3').verbose();
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const dataDir = path.join(__dirname, '../data');
const stagingDir = path.join(dataDir, 'sharepoint_upload');

const sharepointAgent = new https.Agent({ rejectUnauthorized: false });

function runPragma(db, sql) {
  return new Promise((resolve, reject) => {
    db.run(sql, (err) => {
      if (err) reject(err);
      else resolve();
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

function closeDb(db) {
  return new Promise((resolve, reject) => {
    db.close((err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

async function prepareCompressedDb(dbFileName, versionFileName) {
  const sourcePath = path.join(dataDir, dbFileName);
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Base de datos origen no existe: ${sourcePath}`);
  }

  console.log(`\n--- Preparando ${dbFileName} ---`);
  console.log(`1. Verificando integridad y ejecutando checkpoint WAL...`);

  const db = new sqlite3.Database(sourcePath);
  try {
    const integrity = await queryAll(db, 'PRAGMA integrity_check');
    if (integrity[0]?.integrity_check !== 'ok') {
      throw new Error(`Integridad fallida en ${dbFileName}: ${JSON.stringify(integrity)}`);
    }
    await runPragma(db, 'PRAGMA wal_checkpoint(TRUNCATE)');
    console.log(`✓ Checkpoint TRUNCATE ejecutado con éxito.`);
  } finally {
    await closeDb(db);
    // Breve pausa para asegurar liberación de descriptores NTFS en Windows
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  console.log(`2. Leyendo binario y generando compresión Gzip...`);
  const rawBuffer = fs.readFileSync(sourcePath);
  const compressedBuffer = zlib.gzipSync(rawBuffer);

  const stagingDbPath = path.join(stagingDir, dbFileName);
  fs.writeFileSync(stagingDbPath, compressedBuffer);
  console.log(`✓ Archivo comprimido generado: ${stagingDbPath} (${compressedBuffer.length} bytes, original: ${rawBuffer.length} bytes)`);

  console.log(`3. Calculando firma digital HMAC SHA-256...`);
  const signature = crypto.createHmac('sha256', 'LobbyControl_Secure_Key_2026_Maipu')
    .update(rawBuffer)
    .digest('hex');

  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const formattedTimestamp = `${pad(now.getDate())}-${pad(now.getMonth() + 1)}-${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}`;

  const versionData = {
    last_import_timestamp: formattedTimestamp,
    db_size: rawBuffer.length,
    db_signature: signature,
    db_compression: 'gzip'
  };

  const stagingVersionPath = path.join(stagingDir, versionFileName);
  fs.writeFileSync(stagingVersionPath, JSON.stringify(versionData, null, 2));

  const localVersionPath = path.join(dataDir, versionFileName);
  fs.writeFileSync(localVersionPath, JSON.stringify(versionData, null, 2));
  console.log(`✓ Archivo de versión generado: ${stagingVersionPath}`);

  return {
    dbFileName,
    versionFileName,
    stagingDbPath,
    stagingVersionPath,
    rawSize: rawBuffer.length,
    compressedSize: compressedBuffer.length,
    signature
  };
}

function getRequestDigest(siteUrl, cookies) {
  return new Promise((resolve, reject) => {
    let parsedUrl;
    try {
      parsedUrl = new URL(siteUrl);
    } catch (e) {
      return reject(new Error(`URL de sitio inválida: ${siteUrl}`));
    }

    const options = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + '/_api/contextinfo',
      method: 'POST',
      agent: sharepointAgent,
      headers: {
        Cookie: cookies,
        Accept: 'application/json;odata=verbose',
        'Content-Length': '0',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Electron/LobbyControl'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        if (res.statusCode !== 200 && res.statusCode !== 201) {
          return reject(new Error(`Error al obtener contextinfo (HTTP ${res.statusCode}): ${data}`));
        }
        try {
          const parsed = JSON.parse(data);
          const digest = parsed.d?.GetContextWebInformation?.FormDigestValue;
          if (digest) resolve(digest);
          else reject(new Error('No se encontró FormDigestValue en la respuesta de contextinfo.'));
        } catch (err) {
          reject(new Error(`Error al parsear contextinfo: ${err.message}`));
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

function uploadFileToSharePoint(siteUrl, folderPath, fileName, filePath, digest, cookies) {
  return new Promise((resolve, reject) => {
    let parsedUrl;
    try {
      parsedUrl = new URL(siteUrl);
    } catch (e) {
      return reject(new Error(`URL de sitio inválida: ${siteUrl}`));
    }

    const fileContent = fs.readFileSync(filePath);
    const escapedFolderPath = folderPath.replace(/'/g, "''");
    const escapedFileName = fileName.replace(/'/g, "''");
    const apiPath = `${parsedUrl.pathname}/_api/web/GetFolderByServerRelativeUrl('${escapedFolderPath}')/Files/Add(url='${escapedFileName}',overwrite=true)`;
    const encodedPath = encodeURI(apiPath);

    const options = {
      hostname: parsedUrl.hostname,
      path: encodedPath,
      method: 'POST',
      agent: sharepointAgent,
      headers: {
        Cookie: cookies,
        'X-RequestDigest': digest,
        Accept: 'application/json;odata=verbose',
        'Content-Type': 'application/octet-stream',
        'Content-Length': fileContent.length,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Electron/LobbyControl'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        if (res.statusCode === 200 || res.statusCode === 201) {
          console.log(`✓ [SharePoint Upload] ${fileName} subido con éxito.`);
          resolve();
        } else {
          reject(new Error(`Fallo al subir ${fileName} (HTTP ${res.statusCode}): ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function main() {
  const isDryRun = process.argv.includes('--dry-run') || !process.env.SHAREPOINT_COOKIES;
  console.log('================================================================================');
  console.log(' MIGRACIÓN A SHAREPOINT - ARQUITECTURA DATA.DB & APP.DB');
  console.log(` Modo: ${isDryRun ? 'DRY-RUN / STAGING PREPARADO' : 'SUBIDA EN VIVO DIRECTA'}`);
  console.log(' Política: Convivencia no destructiva (Blue/Green). Archivos legados conservados.');
  console.log('================================================================================');

  if (!fs.existsSync(stagingDir)) {
    fs.mkdirSync(stagingDir, { recursive: true });
  }

  // 1. Preparar data.db y version_data.json
  const dataResult = await prepareCompressedDb('data.db', 'version_data.json');

  // 2. Preparar app.db y version_app.json
  const appResult = await prepareCompressedDb('app.db', 'version_app.json');

  console.log('\n--------------------------------------------------------------------------------');
  console.log(' RESUMEN DE ARTEFACTOS PREPARADOS PARA MIGRACIÓN:');
  console.log('--------------------------------------------------------------------------------');
  console.log(`- data.db: ${dataResult.rawSize} bytes -> ${dataResult.compressedSize} bytes (Gzip)`);
  console.log(`  Firma:   ${dataResult.signature}`);
  console.log(`- app.db:  ${appResult.rawSize} bytes -> ${appResult.compressedSize} bytes (Gzip)`);
  console.log(`  Firma:   ${appResult.signature}`);

  if (isDryRun) {
    console.log('\n[INFO] Modo Dry-Run finalizado exitosamente.');
    console.log('Los archivos comprimidos y metadatos se encuentran listos en:');
    console.log(`Carpeta: ${stagingDir}`);
    console.log('\nPara subir en vivo a SharePoint, proporcione SHAREPOINT_COOKIES en .env o invoque con --upload');
    return;
  }

  // Subida en vivo
  console.log('\n--- Subiendo archivos canónicos a SharePoint ---');
  const siteUrl = process.env.SHAREPOINT_SITE_URL || 'https://immaipu.sharepoint.com/sites/SECMU';
  const folderPath = process.env.SHAREPOINT_FOLDER_PATH;
  const cookies = process.env.SHAREPOINT_COOKIES;

  if (!folderPath) {
    throw new Error('Falta la variable SHAREPOINT_FOLDER_PATH en .env');
  }

  console.log(`Sitio SharePoint:   ${siteUrl}`);
  console.log(`Directorio Remoto:  ${folderPath}`);
  console.log('Obteniendo Request Digest...');
  const digest = await getRequestDigest(siteUrl, cookies);
  console.log('✓ Request Digest obtenido con éxito.');

  // Subir data.db y version_data.json
  console.log('Subiendo version_data.json...');
  await uploadFileToSharePoint(siteUrl, folderPath, 'version_data.json', dataResult.stagingVersionPath, digest, cookies);

  console.log('Subiendo data.db (Gzip)...');
  await uploadFileToSharePoint(siteUrl, folderPath, 'data.db', dataResult.stagingDbPath, digest, cookies);

  // Subir app.db y version_app.json
  console.log('Subiendo version_app.json...');
  await uploadFileToSharePoint(siteUrl, folderPath, 'version_app.json', appResult.stagingVersionPath, digest, cookies);

  console.log('Subiendo app.db (Gzip)...');
  await uploadFileToSharePoint(siteUrl, folderPath, 'app.db', appResult.stagingDbPath, digest, cookies);

  console.log('\n================================================================================');
  console.log('✓ MIGRACIÓN A SHAREPOINT COMPLETADA EXITOSAMENTE');
  console.log('Archivos legados (lobby_control.db y asistencias.db) permanecen intactos en la nube');
  console.log('asegurando total convivencia y cero impacto a clientes anteriores.');
  console.log('================================================================================');
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('\n❌ Error en migración a SharePoint:', err.message);
      process.exit(1);
    });
}

module.exports = { prepareCompressedDb };
