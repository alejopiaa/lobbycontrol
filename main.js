const { app, BrowserWindow, session, shell } = require("electron");
const path = require("path");

// Determinar si la aplicación está empaquetada
const isPackaged = app.isPackaged;

// Definir el directorio del ejecutable (para el modo portable)
// Si está empaquetada, process.execPath nos da la ruta al ejecutable (ej. .../LobbyControl.exe)
// Si está en desarrollo, usamos el directorio actual (__dirname)
const exeDir = isPackaged ? path.dirname(process.execPath) : __dirname;

// Inyectar variables de entorno críticas antes de requerir server.js
process.env.IS_ELECTRON = "true";
process.env.EXE_DIR = exeDir;
process.env.USER_DATA_DIR = app.getPath('userData');

// Si no se define puerto en .env, usar 3000
const PORT = process.env.PORT || "3000";
process.env.PORT = PORT;

// Iniciar el servidor Express importándolo directamente
console.log("Iniciando servidor de Express integrado en Electron...");
require("./server.js");

let mainWindow = null;
const {
  loginWithMicrosoft,
  fetchSharepointUser,
} = require("./src/config/sharepoint-auth");
const http = require("http");

// Registrar la sesión SSO en el servidor Express local
function registerSsoSession(email, nombre, cookieHeader) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ email, nombre, cookieHeader });
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port: PORT,
        path: "/api/auth/sso",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(postData),
        },
      },
      (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          if (res.statusCode === 200) {
            resolve({
              body: JSON.parse(body),
              setCookie: res.headers["set-cookie"],
            });
          } else {
            reject(new Error(`Código de estado HTTP ${res.statusCode}`));
          }
        });
      },
    );

    req.on("error", reject);
    req.write(postData);
    req.end();
  });
}

// Wrapper con reintentos exponenciales para tolerar demoras en el arranque del servidor Express
function registerSsoSessionWithRetries(email, nombre, cookieHeader, retries = 5, delay = 1000) {
  return registerSsoSession(email, nombre, cookieHeader)
    .catch((err) => {
      if (retries > 0) {
        console.log(`[SSO] Falló registro de sesión local, reintentando en ${delay}ms (${retries} intentos restantes)... Error: ${err.message}`);
        return new Promise((resolve) => setTimeout(resolve, delay))
          .then(() => registerSsoSessionWithRetries(email, nombre, cookieHeader, retries - 1, delay * 1.5));
      }
      throw err;
    });
}

// Inyecta las cookies devueltas por Express (lobby_session) al navegador de Electron
async function injectCookiesIntoElectronSession(setCookieHeader) {
  if (!setCookieHeader) return;
  for (const cookieStr of setCookieHeader) {
    const parts = cookieStr.split(";")[0].split("=");
    if (parts.length >= 2) {
      const name = parts[0].trim();
      const value = parts.slice(1).join("=").trim();
      await session.defaultSession.cookies.set({
        url: `http://localhost:${PORT}`,
        name: name,
        value: value,
        path: "/",
      });
    }
  }
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: "LobbyControl",
    autoHideMenuBar: true, // Ocultar barra de menú superior estándar
    webPreferences: {
      nodeIntegration: false,
      contextBridge: true,
    },
  });

  // Interceptar clicks a enlaces externos para abrirlos en el navegador por defecto del sistema
  const isLocal = (url) => {
    return url.startsWith(`http://localhost:${PORT}`) || url.startsWith(`http://127.0.0.1:${PORT}`) || url === 'about:blank';
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

  mainWindow.loadURL(`http://localhost:${PORT}?platform=electron`).catch((err) => {
    console.error("Error al cargar la URL local de la aplicación:", err);
    // Reintentar si falla
    setTimeout(() => {
      mainWindow.loadURL(`http://localhost:${PORT}?platform=electron`);
    }, 1500);
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

async function startAppFlow() {
  const SHAREPOINT_HOST = process.env.SHAREPOINT_HOST || "immaipu.sharepoint.com";

  try {
    // Limpiar caché de HTTP para evitar que assets viejos queden cacheados
    await session.defaultSession.clearCache();

    console.log(
      "[SSO] Comprobando cookies de sesión de SharePoint existentes...",
    );
    const cookies = await session.defaultSession.cookies.get({
      domain: SHAREPOINT_HOST,
    });
    const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");

    if (cookieHeader) {
      console.log("[SSO] Cookies encontradas. Validando contra SharePoint...");
      try {
        const userProfile = await fetchSharepointUser(cookieHeader);
        if (
          userProfile &&
          userProfile.Email.toLowerCase().endsWith("@maipu.cl")
        ) {
          console.log(
            `[SSO] Sesión válida encontrada en segundo plano: ${userProfile.Email}`,
          );
          const { setCookie } = await registerSsoSessionWithRetries(
            userProfile.Email,
            userProfile.Title,
            cookieHeader,
          );
          await injectCookiesIntoElectronSession(setCookie);
          createMainWindow();
          return;
        }
      } catch (validationErr) {
        console.log(
          "[SSO] Cookies expiradas o no válidas. Abriendo pantalla de inicio local.",
        );
      }
    } else {
      console.log("[SSO] No se encontraron cookies de SharePoint. Abriendo pantalla de inicio local.");
    }

    // En lugar de abrir login de Microsoft de inmediato, abrimos la ventana principal.
    // Si no está autenticado localmente, la web mostrará el botón para iniciar sesión corporativo.
    createMainWindow();
  } catch (err) {
    console.error("[SSO] Error en el flujo de inicio de sesión:", err.message);
    console.log("[SSO] Fallback: Abriendo ventana principal de todos modos.");
    createMainWindow();
  }
}

// Al iniciar Electron
app.whenReady().then(() => {
  // Esperar 1 segundo para dar tiempo a que el servidor Express levante la conexión
  setTimeout(() => {
    startAppFlow();
  }, 1000);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      startAppFlow();
    }
  });
});

// Cuando todas las ventanas se cierran
app.on("window-all-closed", () => {
  console.log(
    "Todas las ventanas cerradas. Deteniendo el servidor y saliendo...",
  );
  if (process.platform !== "darwin") {
    app.quit();
  }
});
