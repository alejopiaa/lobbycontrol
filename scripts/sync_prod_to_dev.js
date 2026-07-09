const fs = require("fs");
const path = require("path");
const os = require("os");

// Determinar el directorio de bases de datos de producción
const prodBaseDir =
  process.env.USER_DATA_DIR ||
  path.join(os.homedir(), "AppData", "Roaming", "LobbyControl");
const prodDbDir = path.join(prodBaseDir, "data");

// Directorio de destino local (subdirectorio 'data' en desarrollo)
const devDbDir = path.join(__dirname, "..", "data");

// Asegurar que el directorio de destino exista
if (!fs.existsSync(devDbDir)) {
  fs.mkdirSync(devDbDir, { recursive: true });
}

const filesToCopy = [
  "lobby_control.db",
  "lobby_control.db-wal",
  "lobby_control.db-shm",
  "usuarios.db",
  "usuarios.db-wal",
  "usuarios.db-shm",
  "local.db",
  "local.db-wal",
  "local.db-shm",
  "version_lobby.json",
  "version_users.json",
];

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
