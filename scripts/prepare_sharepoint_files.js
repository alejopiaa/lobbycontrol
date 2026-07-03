const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');

const dataDir = path.join(__dirname, '../data');
const bakDbPath = path.join(dataDir, 'lobby.db.bak');
const localDbPath = path.join(dataDir, 'lobby.db');
const localVersionPath = path.join(dataDir, 'version.json');

const uploadDir = path.join(dataDir, 'sharepoint_upload');
const uploadDbPath = path.join(uploadDir, 'lobby.db');
const uploadVersionPath = path.join(uploadDir, 'version.json');

async function run() {
  try {
    console.log('1. Restaurando base de datos local de desarrollo...');
    if (!fs.existsSync(bakDbPath)) {
      throw new Error(`No se encuentra el archivo de respaldo en: ${bakDbPath}`);
    }

    // Copiar el respaldo sobre el archivo local (descomprimido para que el entorno de desarrollo lo lea)
    fs.copyFileSync(bakDbPath, localDbPath);
    console.log('✓ Base de datos local restaurada a partir del respaldo (20.7 MB).');

    // Asegurar directorio de subida
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    console.log('2. Comprimiendo base de datos con Gzip para SharePoint...');
    const dbBuffer = fs.readFileSync(bakDbPath);
    const compressedDb = zlib.gzipSync(dbBuffer);
    fs.writeFileSync(uploadDbPath, compressedDb);
    console.log(`✓ Archivo comprimido creado con éxito en: ${uploadDbPath} (${compressedDb.length} bytes)`);

    console.log('3. Calculando firma digital de la base de datos...');
    const signature = crypto.createHmac('sha256', 'LobbyControl_Secure_Key_2026_Maipu')
      .update(dbBuffer)
      .digest('hex');

    const versionData = {
      last_import_timestamp: '30-06-2026 17:15',
      db_size: dbBuffer.length,
      db_signature: signature,
      db_compression: 'gzip'
    };

    // Escribir version.json en la carpeta de subida
    fs.writeFileSync(uploadVersionPath, JSON.stringify(versionData, null, 2));
    console.log(`✓ Archivo version.json creado con éxito en: ${uploadVersionPath}`);

    // También actualizar el version.json local para que coincida con el estado restaurado
    fs.writeFileSync(localVersionPath, JSON.stringify(versionData, null, 2));
    console.log('✓ Archivo version.json local actualizado.');

    console.log('\n=========================================');
    console.log('¡PROCESO FINALIZADO CON ÉXITO!');
    console.log('Ruta de los archivos listos para subir a SharePoint:');
    console.log(`- Base de datos: ${uploadDbPath}`);
    console.log(`- Versión: ${uploadVersionPath}`);
    console.log('=========================================');

  } catch (err) {
    console.error('Error durante la preparación:', err.message);
    process.exit(1);
  }
}

run();
