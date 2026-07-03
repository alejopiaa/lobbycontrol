const { BrowserWindow, session } = require("electron");
const https = require("https");

// URL del sitio de SharePoint corporativo y sub-sitio de SECMU
const SHAREPOINT_HOST = process.env.SHAREPOINT_HOST || "immaipu.sharepoint.com";
const SHAREPOINT_SITE_URL =
  process.env.SHAREPOINT_SITE_URL || `https://${SHAREPOINT_HOST}/sites/SECMU`;
const SHAREPOINT_LOGIN_URL =
  process.env.SHAREPOINT_LOGIN_URL || SHAREPOINT_SITE_URL;

// Extraer la ruta del sub-sitio para consultas REST API
let sitePath = "/sites/SECMU";
try {
  const urlObj = new URL(SHAREPOINT_SITE_URL);
  sitePath = urlObj.pathname;
  if (sitePath.endsWith("/")) {
    sitePath = sitePath.slice(0, -1);
  }
} catch (e) {
  sitePath = "/sites/SECMU";
}

/**
 * Abre una ventana de login en Electron y captura las cookies del usuario una vez autenticado.
 * @returns {Promise<{userProfile: Object, cookieHeader: String}>}
 */
function loginWithMicrosoft() {
  return new Promise(async (resolve, reject) => {
    // Si no estamos ejecutándonos dentro de Electron (desarrollo local)
    if (!process.versions.electron) {
      console.log("Modo Desarrollo: Simulando login corporativo...");
      return resolve({
        userProfile: {
          Email: "usuario.dev@maipu.cl",
          Title: "Usuario de Desarrollo",
        },
        cookieHeader: "MockCookie=123456",
      });
    }

    try {
      // Limpiar cookies y almacenamiento antes de iniciar para evitar capturar sesiones viejas/expiradas
      await clearAllSsoData().catch(() => {});
    } catch (e) {
      console.warn("[SSO Auth] Error al limpiar sesión previa:", e.message);
    }

    const loginWin = new BrowserWindow({
      width: 600,
      height: 700,
      show: true, // Mostrar de inmediato para dar feedback visual
      title: "Iniciar Sesión - Municipalidad de Maipú",
      autoHideMenuBar: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
    });



    // Manejar fallas de red o errores DNS (ej. dominio incorrecto) para evitar pantalla blanca silenciosa
    loginWin.webContents.on(
      "did-fail-load",
      async (event, errorCode, errorDescription, validatedURL, isMainFrame) => {
        if (isMainFrame) {
          // Ignorar cancelaciones normales de navegación (como ERR_ABORTED, código -3)
          if (errorCode === -3) {
            console.log(
              "[SSO Auth] Ignorando ERR_ABORTED (-3) en redirección.",
            );
            return;
          }

          try {
            // Verificar si las cookies críticas ya se crearon antes de abortar
            const cookies = await session.defaultSession.cookies.get({});
            const shCookies = cookies.filter(
              (c) =>
                c.domain.includes("sharepoint.com") ||
                c.domain.includes(SHAREPOINT_HOST),
            );
            const fedAuth = shCookies.find((c) => c.name === "FedAuth");
            const rtFa = shCookies.find((c) => c.name === "rtFa");

            if (fedAuth && rtFa) {
              console.log(
                "[SSO Auth] Fallo de carga ignorado: cookies de autenticación ya listas.",
              );
              return;
            }
          } catch (cookieErr) {
            console.error(
              "[SSO Auth] Error al verificar cookies en did-fail-load:",
              cookieErr.message,
            );
          }

          try {
            if (!loginWin.isDestroyed()) loginWin.close();
          } catch (e) {}
          reject(
            new Error(
              `Error de conexión (${errorDescription}): No se pudo cargar el portal de SharePoint.`,
            ),
          );
        }
      },
    );

    // Cargar la página de SharePoint para forzar la redirección al login institucional
    loginWin.loadURL(SHAREPOINT_LOGIN_URL);

    // BUCLE DE SONDEO (POLLING) DE COOKIES - Opción B
    let authInitiated = false;
    const pollInterval = setInterval(async () => {
      if (loginWin.isDestroyed()) {
        clearInterval(pollInterval);
        return;
      }

      if (authInitiated) return;

      try {
        const cookies = await session.defaultSession.cookies.get({});
        const shCookies = cookies.filter(
          (c) =>
            c.domain.includes("sharepoint.com") ||
            c.domain.includes(SHAREPOINT_HOST),
        );

        const fedAuth = shCookies.find((c) => c.name === "FedAuth");
        const rtFa = shCookies.find((c) => c.name === "rtFa");

        if (fedAuth && rtFa) {
          authInitiated = true;
          clearInterval(pollInterval);
          console.log(
            "[SSO Auth] Polling detectó cookies de SharePoint activas. Iniciando validación de perfil...",
          );

          const cookieHeader = shCookies
            .map((c) => `${c.name}=${c.value}`)
            .join("; ");

          let userProfile = null;
          let lastError = null;

          for (let attempt = 1; attempt <= 3; attempt++) {
            if (loginWin.isDestroyed()) {
              reject(new Error("Inicio de sesión cancelado por el usuario."));
              return;
            }

            try {
              console.log(
                `[SSO Auth] Validando perfil (Intento ${attempt})...`,
              );
              userProfile = await fetchSharepointUser(cookieHeader);
              if (userProfile && userProfile.Email) break;
            } catch (err) {
              lastError = err;
              if (attempt < 3) {
                await new Promise((r) => setTimeout(r, 500));
              }
            }
          }

          if (!userProfile || !userProfile.Email) {
            throw (
              lastError ||
              new Error(
                "No se pudo recuperar el perfil de usuario desde la API de SharePoint.",
              )
            );
          }

          const email = userProfile.Email.toLowerCase().trim();
          if (email.endsWith("@maipu.cl")) {
            try {
              if (!loginWin.isDestroyed()) loginWin.close();
            } catch (e) {}
            resolve({ userProfile, cookieHeader });
          } else {
            throw new Error(
              "Acceso no autorizado: Debes iniciar sesión con una cuenta @maipu.cl",
            );
          }
        }
      } catch (err) {
        console.error("[SSO Auth] Error en bucle de validación:", err.message);
        clearInterval(pollInterval);
        await clearAllSsoData().catch(() => {});
        try {
          if (!loginWin.isDestroyed()) loginWin.close();
        } catch (e) {}
        reject(
          new Error(`Error de inicio de sesión: ${err.message}`),
        );
      }
    }, 250);

    loginWin.on("closed", () => {
      clearInterval(pollInterval);
      reject(new Error("Inicio de sesión cancelado por el usuario"));
    });
  });
}

/**
 * Consulta la API de SharePoint para validar la autenticidad del usuario y obtener sus datos.
 * @param {String} cookieHeader
 * @returns {Promise<{Email: String, Title: String}>}
 */
async function fetchSharepointUser(cookieHeader) {
  // Si estamos simulando en desarrollo local
  if (!process.versions.electron) {
    return {
      Email: "usuario.dev@maipu.cl",
      Title: "Usuario de Desarrollo",
    };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const url = `https://${SHAREPOINT_HOST}/_api/web/currentuser`;
    const { net } = require('electron');
    const response = await net.fetch(url, {
      method: "GET",
      headers: {
        Cookie: cookieHeader,
        Accept: "application/json;odata=verbose",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Electron/LobbyControl"
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Fallo de validación de perfil HTTP ${response.status}: ${response.statusText}`);
    }

    const parsed = await response.json();
    if (parsed.d && parsed.d.Email) {
      return {
        Email: parsed.d.Email,
        Title: parsed.d.Title,
      };
    } else {
      throw new Error("Formato de perfil no válido o sesión de SharePoint inactiva");
    }
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === "AbortError") {
      throw new Error("Tiempo de espera agotado al validar el perfil (timeout 15s).");
    }
    throw new Error(`Error de red con SharePoint: ${err.message}`);
  }
}

/**
 * Limpia de manera exhaustiva todas las cookies y almacenamiento (localStorage, IndexedDB, etc.)
 * relacionado con el inicio de sesión corporativo en Microsoft y SharePoint.
 * Esto evita que las cuentas queden "amarradas" y permite el cambio de usuario.
 * @returns {Promise<void>}
 */
async function clearAllSsoData() {
  if (!process.versions.electron) return;
  const { session } = require("electron");
  const SHAREPOINT_HOST =
    process.env.SHAREPOINT_HOST || "immaipu.sharepoint.com";

  console.log(
    "[SSO Storage] Iniciando limpieza de datos de sesión corporativa...",
  );

  try {
    // 1. Limpiar todas las cookies de Electron a nivel global
    await session.defaultSession.clearStorageData({
      storages: ["cookies"],
    });
    console.log("[SSO Storage] Cookies globales eliminadas.");
  } catch (err) {
    console.error("[SSO Storage] Error al limpiar cookies:", err.message);
  }

  // 2. Limpiar almacenamiento local (localStorage, indexdb, etc.) para orígenes específicos de autenticación
  const origins = [
    "https://login.microsoftonline.com",
    "https://login.microsoft.com",
    "https://login.windows.net",
    "https://login.live.com",
    `https://${SHAREPOINT_HOST}`,
    "https://municipalidadmaipu.sharepoint.com",
    "https://municipalidadmaipu-my.sharepoint.com",
  ];

  for (const origin of origins) {
    try {
      await session.defaultSession.clearStorageData({
        origin: origin,
        storages: [
          "localstorage",
          "indexdb",
          "websql",
          "serviceworkers",
          "cachestorage",
        ],
      });
      console.log(
        `[SSO Storage] Almacenamiento local limpiado para origen: ${origin}`,
      );
    } catch (err) {
      console.warn(
        `[SSO Storage] Advertencia al limpiar storage para ${origin}:`,
        err.message,
      );
    }
  }
}

module.exports = { loginWithMicrosoft, fetchSharepointUser, clearAllSsoData };
