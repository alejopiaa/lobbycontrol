const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  /**
   * Invoca de forma segura una ruta en el backend a través de IPC.
   * @param {Object} routeInfo - Información de la ruta (url, método, cuerpo)
   * @returns {Promise<Object>} Resultado de la ejecución en el proceso principal
   */
  invokeRoute: (routeInfo) => ipcRenderer.invoke("api-route", routeInfo),
  selectDirectory: () => ipcRenderer.invoke("select-directory"),
  generateSilentPdf: (args) => ipcRenderer.invoke("generate-silent-pdf", args),
  selectSavePath: (args) => ipcRenderer.invoke("select-save-path", args)
});
