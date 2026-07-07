const { app, BrowserWindow, session, shell, protocol, net } = require("electron");
const path = require("path");
const fs = require("fs");

// Determinar si la aplicación está empaquetada
const isPackaged = app.isPackaged;

// Definir el directorio del ejecutable (para el modo portable)
const exeDir = isPackaged ? path.dirname(process.execPath) : __dirname;

// Inyectar variables de entorno críticas antes de iniciar manejadores
process.env.IS_ELECTRON = "true";
process.env.EXE_DIR = exeDir;
process.env.USER_DATA_DIR = app.getPath('userData');

// Registrar el esquema de protocolo personalizado como privilegiado.
// Esto debe ejecutarse antes de que la aplicación esté lista.
protocol.registerSchemesAsPrivileged([
  {
    scheme: "app",
    privileges: {
      standard: true,
      secure: true,
      supportFetch: true,
      corsEnabled: false
    }
  }
]);

let mainWindow = null;

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: "LobbyControl",
    autoHideMenuBar: true, // Ocultar barra de menú superior estándar
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, "preload.js")
    },
  });

  // Interceptar clicks a enlaces externos para abrirlos en el navegador por defecto del sistema
  const isLocal = (url) => {
    return url.startsWith("app://lobbycontrol") || url === 'about:blank';
  };

  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!isLocal(url)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!isLocal(url)) {
      shell.openExternal(url);
      return { action: "deny" };
    }
    return { action: "allow" };
  });

  // Cargar el index.html usando el protocolo privado seguro
  mainWindow.loadURL("app://lobbycontrol/index.html").catch((err) => {
    console.error("Error al cargar la interfaz de usuario via app://:", err);
  });

  // if (!isPackaged) {
  //   mainWindow.webContents.openDevTools();
  // }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// Al iniciar Electron
app.whenReady().then(() => {
  // 1. Configurar el manejador del protocolo seguro 'app://'
  protocol.handle("app", (request) => {
    // Extraer y normalizar la ruta relativa del recurso
    const urlStr = request.url.replace("app://lobbycontrol/", "");
    const cleanPath = urlStr.split("?")[0].split("#")[0];
    
    // Resolver la ruta dentro del directorio "public" de la aplicación
    const absoluteFilePath = path.join(__dirname, "public", cleanPath || "index.html");

    // Evitar ataques de Directory Traversal (salto de directorios con ..)
    const relative = path.relative(path.join(__dirname, "public"), absoluteFilePath);
    const isInsidePublic = relative && !relative.startsWith('..') && !path.isAbsolute(relative);
    
    if (!isInsidePublic) {
      return new Response("Acceso Denegado", { status: 403 });
    }

    // Servir el archivo utilizando la API nativa net.fetch sobre file://
    return net.fetch(`file://${absoluteFilePath}`);
  });

  // 2. Importar y configurar los manejadores de IPC seguro (Fase 3)
  require("./src/ipc/handlers");

  // 3. Iniciar la ventana principal de la aplicación
  createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

// Cuando todas las ventanas se cierran
app.on("window-all-closed", () => {
  console.log("Todas las ventanas cerradas. Saliendo...");
  if (process.platform !== "darwin") {
    app.quit();
  }
});
