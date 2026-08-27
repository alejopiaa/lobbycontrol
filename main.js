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
let assistanceWindow = null;

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: "LobbyControl",
    autoHideMenuBar: true, // Ocultar barra de menú superior estándar
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
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

function createAssistanceWindow(id) {
  const { screen } = require("electron");
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workArea;

  const winWidth = 580;
  const winHeight = Math.min(800, screenHeight - 30);
  const posX = Math.max(0, screenWidth - winWidth - 20);
  const posY = 30;

  assistanceWindow = new BrowserWindow({
    width: winWidth,
    height: winHeight,
    minWidth: 390,
    minHeight: 580,
    x: posX,
    y: posY,
    title: "LobbyControl - Asistencia Técnica",
    autoHideMenuBar: true,
    alwaysOnTop: true,
    resizable: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      preload: path.join(__dirname, "preload.js")
    }
  });

  const isLocal = (url) => {
    return url.startsWith("app://lobbycontrol") || url === 'about:blank';
  };

  assistanceWindow.webContents.on("will-navigate", (event, url) => {
    if (!isLocal(url)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  assistanceWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!isLocal(url)) {
      shell.openExternal(url);
      return { action: "deny" };
    }
    return { action: "allow" };
  });

  const targetUrl = id ? `app://lobbycontrol/asistencia-window.html?id=${id}` : "app://lobbycontrol/asistencia-window.html";
  assistanceWindow.loadURL(targetUrl).catch((err) => {
    console.error("Error al cargar la consola de asistencia via app://:", err);
  });

  assistanceWindow.on("closed", () => {
    assistanceWindow = null;
  });

  return assistanceWindow;
}

function toggleOrFocusAssistanceWindow(id) {
  if (assistanceWindow && !assistanceWindow.isDestroyed()) {
    if (assistanceWindow.isMinimized()) assistanceWindow.restore();
    assistanceWindow.show();
    assistanceWindow.focus();
    if (id) {
      assistanceWindow.webContents.send("load-assistance-for-edit", id);
    }
  } else {
    createAssistanceWindow(id);
  }
}

// Al iniciar Electron
app.whenReady().then(() => {
  const { pathToFileURL } = require("url");

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

    // Servir el archivo utilizando la API nativa net.fetch sobre pathToFileURL (compatible con acentos y espacios en Windows)
    return net.fetch(pathToFileURL(absoluteFilePath).toString());
  });

  // 2. Importar y configurar los manejadores de IPC seguro
  require("./src/ipc/handlers");

  // 3. Iniciar la ventana principal de la aplicación
  createMainWindow();

  // 4. Registrar atajo de teclado global Ctrl+Shift+A
  const { globalShortcut } = require("electron");
  try {
    const registered = globalShortcut.register("CommandOrControl+Shift+A", () => {
      toggleOrFocusAssistanceWindow();
    });
    if (registered) {
      console.log("✓ Atajo global CommandOrControl+Shift+A registrado correctamente.");
    } else {
      console.warn("Advertencia: No se pudo registrar el atajo global CommandOrControl+Shift+A (posible conflicto con otra app).");
    }
  } catch (scErr) {
    console.warn("Error al registrar atajo global:", scErr.message);
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

// Limpieza al salir de la aplicación
app.on("will-quit", () => {
  const { globalShortcut } = require("electron");
  try {
    globalShortcut.unregisterAll();
  } catch (e) {}

  // Limpiar archivos temporales .eml
  try {
    const tempDir = app.getPath("temp");
    if (fs.existsSync(tempDir)) {
      const files = fs.readdirSync(tempDir);
      files.forEach((f) => {
        if (f.startsWith("temp_ast_") && f.endsWith(".eml")) {
          try {
            fs.unlinkSync(path.join(tempDir, f));
          } catch (e) {}
        }
      });
    }
  } catch (e) {}
});

// Cuando todas las ventanas se cierran
app.on("window-all-closed", () => {
  console.log("Todas las ventanas cerradas. Saliendo...");
  if (process.platform !== "darwin") {
    app.quit();
  }
});

module.exports = {
  getMainWindow: () => mainWindow,
  getAssistanceWindow: () => assistanceWindow,
  toggleOrFocusAssistanceWindow
};
