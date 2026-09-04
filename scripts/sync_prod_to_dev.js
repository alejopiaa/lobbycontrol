const fs = require("fs");
const path = require("path");
const os = require("os");

// Determinar el directorio de bases de datos de producción
const prodBaseDir =
  process.env.USER_DATA_DIR ||
  (process.env.APPDATA
    ? path.join(process.env.APPDATA, "LobbyControl")
    : path.join(os.homedir(), "AppData", "Roaming", "LobbyControl"));
const prodDbDir = path.join(prodBaseDir, "data");

// Directorio de destino local (subdirectorio 'data' en desarrollo)
const devDbDir = path.join(__dirname, "..", "data");

// Asegurar que el directorio de destino exista
if (!fs.existsSync(devDbDir)) {
  fs.mkdirSync(devDbDir, { recursive: true });
}

const filesToCopy = [
  // Arquitectura canónica
  "data.db",
  "data.db-wal",
  "data.db-shm",
  "version_data.json",
  "app.db",
  "app.db-wal",
  "app.db-shm",
  "version_app.json",
  "usuarios.db",
  "usuarios.db-wal",
  "usuarios.db-shm",
  "version_users.json",
  "local.db",
  "local.db-wal",
  "local.db-shm",
  // Archivos de retrocompatibilidad / fallback
  "lobby_control.db", /* fallback / legacy */
  "lobby_control.db-wal", /* fallback / legacy */
  "lobby_control.db-shm", /* fallback / legacy */
  "asistencias.db", /* fallback / legacy */
  "asistencias.db-wal", /* fallback / legacy */
  "asistencias.db-shm", /* fallback / legacy */
  "version_lobby.json",
  "version_asistencias.json",
];

function isDatabaseLocked(filePath) {
  if (!fs.existsSync(filePath)) return false;
  try {
    const fd = fs.openSync(filePath, "r+");
    fs.closeSync(fd);
    return false;
  } catch (err) {
    if (err.code === "EBUSY" || err.code === "EPERM" || err.code === "EACCES") {
      return true;
    }
    return false;
  }
}

console.log("=== Copiando Bases de Datos de Producción a Desarrollo ===");
console.log(`Origen (Producción): ${prodDbDir}`);
console.log(`Destino (Desarrollo): ${devDbDir}\n`);

if (!fs.existsSync(prodDbDir)) {
  console.error(
    `Error: El directorio de base de datos de producción no existe: ${prodDbDir}`,
  );
  console.error(
    "Asegúrese de haber ejecutado al menos una vez la aplicación en producción en esta máquina.",
  );
  process.exit(1);
}

const criticalDbs = ["data.db", "usuarios.db", "app.db"];
const lockedFiles = criticalDbs.filter((f) => isDatabaseLocked(path.join(prodDbDir, f)));
if (lockedFiles.length > 0) {
  console.warn("⚠️  ADVERTENCIA: La aplicación LobbyControl (Producción) parece estar abierta.");
  console.warn(`   Los siguientes archivos están en uso: ${lockedFiles.join(", ")}`);
  console.warn("   Para evitar inconsistencias en SQLite WAL, se recomienda cerrar la app de producción.\n");
}

let copiedCount = 0;
filesToCopy.forEach((file) => {
  const srcPath = path.join(prodDbDir, file);
  const destPath = path.join(devDbDir, file);

  if (fs.existsSync(srcPath)) {
    try {
      // Reemplazar de forma segura sobreescribiendo el archivo local
      fs.copyFileSync(srcPath, destPath);
      console.log(`✓ Copiado: ${file}`);
      copiedCount++;
    } catch (err) {
      console.error(`✗ Error al copiar ${file}: ${err.message}`);
    }
  } else {
    console.log(`- Omitido (no existe en producción): ${file}`);
  }
});

console.log(
  `\nProceso terminado. Se copiaron ${copiedCount} archivos de forma exitosa.`,
);
