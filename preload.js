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
  selectSavePath: (args) => ipcRenderer.invoke("select-save-path", args),
  generateExcelFile: (args) => ipcRenderer.invoke("generate-excel-file", args),
  openPath: (targetPath) => ipcRenderer.invoke("open-path", targetPath),
  openAssistanceWindow: (id) => ipcRenderer.invoke("open-assistance-window", id),
  toggleAlwaysOnTop: (flag) => ipcRenderer.invoke("toggle-always-on-top", flag),
  generateEmlAndOpen: (args) => ipcRenderer.invoke("generate-eml-and-open", args),
  notifyAssistanceSaved: (data) => ipcRenderer.invoke("notify-assistance-saved", data),
  onAssistanceUpdated: (callback) => {
    ipcRenderer.on("assistance-updated", (event, ...args) => callback(...args));
  },
  onLoadAssistanceForEdit: (callback) => {
    ipcRenderer.on("load-assistance-for-edit", (event, ...args) => callback(...args));
  },
  onCategoriasUpdated: (callback) => {
    const handler = (event, ...args) => callback(...args);
    ipcRenderer.on("categorias-updated", handler);
    return () => ipcRenderer.removeListener("categorias-updated", handler);
  }
});
