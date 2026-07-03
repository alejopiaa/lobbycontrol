const fs = require('fs');
const path = require('path');
const { app } = require('electron');

let logDir;
if (app) {
  const baseDir = process.env.USER_DATA_DIR || app.getPath('userData');
  logDir = path.join(baseDir, 'logs');
} else {
  // Configuración estándar para desarrollo local
  const baseDir = path.join(__dirname, '../../');
  logDir = path.join(baseDir, 'data', 'logs');
}

if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const logFilePath = path.join(logDir, 'error.log');

/**
 * Registra una línea estructurada de error en el archivo error.log.
 * @param {string} code - Código de error (ej: ERR-AUTH-202)
 * @param {string} message - Mensaje amigable o título del error
 * @param {string} details - Detalles técnicos o stack trace
 */
function logError(code, message, details = '') {
  try {
    const now = new Date();
    const d = String(now.getDate()).padStart(2, '0');
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const y = now.getFullYear();
    const hh = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    const timestamp = `${d}-${m}-${y} ${hh}:${min}:${ss}`;

    const formattedDetails = String(details).replace(/\r?\n/g, ' \\ ');
    const logEntry = `[${timestamp}] [${code}] ${message} | Detalle: ${formattedDetails}\n`;
    
    fs.appendFileSync(logFilePath, logEntry, 'utf8');
  } catch (err) {
    console.error('Error escribiendo en bitácora de logs:', err.message);
  }
}

module.exports = { logError, logFilePath };
