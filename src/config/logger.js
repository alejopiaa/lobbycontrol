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

const logFilePath = path.join(logDir, 'app.log');
const errorLogFilePath = path.join(logDir, 'error.log');

/**
 * Registra una línea estructurada de log en la bitácora general y, opcionalmente, en la de errores.
 * @param {string} code - Código de log (ej: AUTH-SUC-101, ERR-DB-500)
 * @param {string} message - Mensaje descriptivo
 * @param {string} details - Detalles técnicos o contextuales
 * @param {string} severity - Nivel de severidad ('info', 'warn', 'error')
 */
function logEvent(code, message, details = '', severity = 'info') {
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
    
    // 1. Escribir siempre en la bitácora general (app.log)
    fs.appendFileSync(logFilePath, logEntry, 'utf8');

    // 2. Si es error/advertencia o código empieza con ERR-, escribir en error.log
    if (severity === 'error' || severity === 'warn' || (code && code.startsWith('ERR-'))) {
      fs.appendFileSync(errorLogFilePath, logEntry, 'utf8');
    }
  } catch (err) {
    console.error('Error escribiendo en bitácora de logs:', err.message);
  }
}

/**
 * Registra un error en las bitácoras.
 * @param {string} code - Código de error (ej: ERR-AUTH-202)
 * @param {string} message - Mensaje amigable o título del error
 * @param {string} details - Detalles técnicos o stack trace
 */
function logError(code, message, details = '') {
  logEvent(code, message, details, 'error');
}

module.exports = { logError, logEvent, logFilePath };
