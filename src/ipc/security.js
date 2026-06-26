const TRUSTED_ORIGIN = "app://lobbycontrol";

/**
 * Valida de forma estricta que una petición IPC provenga del frame principal empaquetado.
 * @param {Electron.IpcMainInvokeEvent} event - Evento nativo de IPC recibido
 * @throws {Error} Si el origen no es de absoluta confianza
 */
function validateIpcSender(event) {
  const frame = event.senderFrame;

  // 1. Verificar existencia del frame emisor
  if (!frame) {
    throw new Error("Acceso denegado: Remitente de IPC inexistente.");
  }

  // 2. Verificar origen del protocolo privilegido
  if (frame.origin !== TRUSTED_ORIGIN) {
    console.error(`[Alerta de Seguridad] Intento de IPC bloqueado desde origen no autorizado: ${frame.origin}`);
    throw new Error("Acceso denegado: Origen de solicitud no autorizado.");
  }

  // 3. Bloquear llamadas desde frames secundarios o iframes de terceros
  if (frame.parent !== null) {
    console.error("[Alerta de Seguridad] Intento de IPC bloqueado desde un frame secundario (iframe).");
    throw new Error("Acceso denegado: Solo el frame principal puede iniciar llamadas IPC.");
  }
}

/**
 * Envoltura para registrar manejadores IPC de forma segura y automatizada.
 * @param {string} channel - Nombre del canal IPC
 * @param {Function} handler - Función a ejecutar que procesa la lógica
 */
function safeIpcHandle(channel, handler) {
  const { ipcMain } = require("electron");
  
  ipcMain.handle(channel, async (event, ...args) => {
    try {
      // Aplicar validaciones de seguridad de bajo nivel antes de invocar la lógica
      validateIpcSender(event);
      return await handler(event, ...args);
    } catch (error) {
      console.error(`Error en canal IPC seguro [${channel}]:`, error.message);
      return { success: false, error: error.message };
    }
  });
}

module.exports = {
  safeIpcHandle,
  validateIpcSender
};
