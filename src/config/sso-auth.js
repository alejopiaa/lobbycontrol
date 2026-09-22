const { BrowserWindow, session } = require("electron");

// Parámetros de entorno corporativo (sin fallbacks hardcodeados)
const SHAREPOINT_HOST = process.env.SHAREPOINT_HOST;
const SHAREPOINT_SITE_URL = process.env.SHAREPOINT_SITE_URL;
const SHAREPOINT_LOGIN_URL = process.env.SHAREPOINT_LOGIN_URL || SHAREPOINT_SITE_URL;
const ALLOWED_EMAIL_DOMAIN = process.env.ALLOWED_EMAIL_DOMAIN || "";

/**
 * Valida la presencia de las variables de entorno críticas de infraestructura
 */
function validateEnvironment() {
  if (!SHAREPOINT_HOST || !SHAREPOINT_SITE_URL) {
    throw new Error(
      "Configuración de entorno incompleta: SHAREPOINT_HOST y SHAREPOINT_SITE_URL deben estar definidos en las variables de entorno."
    );
  }
}

/**
 * Abre una ventana de login en Electron y captura las cookies del usuario una vez autenticado.
 * @returns {Promise<{userProfile: Object, cookieHeader: String}>}
 */
function loginWithMicrosoft() {
  return new Promise(async (resolve, reject) => {
    if (!process.versions.electron) {
      return reject(new Error("La autenticación interactiva SSO requiere el entorno Electron."));
    }

    try {
      validateEnvironment();
      await clearAllSsoData().catch(() => {});
    } catch (e) {
      console.warn("[SSO Auth] Error al inicializar sesión previa:", e.message);
    }

    const loginWin = new BrowserWindow({
      width: 600,
      height: 700,
      show: true,
      title: "Autenticación Corporativa",
      autoHideMenuBar: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
    });

    // Manejar fallas de red o errores DNS
    loginWin.webContents.on(
      "did-fail-load",
      async (event, errorCode, errorDescription, validatedURL, isMainFrame) => {
        if (isMainFrame) {
          if (errorCode === -3) {
            console.log("[SSO Auth] Ignorando ERR_ABORTED (-3) en redirección de autenticación.");
            return;
          }

          try {
            const cookies = await session.defaultSession.cookies.get({});
            const shCookies = cookies.filter(
              (c) =>
                c.domain.includes("sharepoint.com") ||
                (SHAREPOINT_HOST && c.domain.includes(SHAREPOINT_HOST))
            );
            const fedAuth = shCookies.find((c) => c.name === "FedAuth");
            const rtFa = shCookies.find((c) => c.name === "rtFa");

            if (fedAuth && rtFa) {
              console.log("[SSO Auth] Fallo de carga ignorado: cookies de autenticación disponibles.");
              return;
            }
          } catch (cookieErr) {
            console.error("[SSO Auth] Error al verificar cookies en did-fail-load:", cookieErr.message);
          }

          try {
            if (!loginWin.isDestroyed()) loginWin.close();
          } catch (e) {}
          reject(
            new Error(`Error de conexión (${errorDescription}): No se pudo cargar el portal de autenticación.`)
          );
        }
      }
    );

    loginWin.loadURL(SHAREPOINT_LOGIN_URL);

    // Bucle de sondeo (polling) de cookies corporativas
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
            (SHAREPOINT_HOST && c.domain.includes(SHAREPOINT_HOST))
        );

        const fedAuth = shCookies.find((c) => c.name === "FedAuth");
        const rtFa = shCookies.find((c) => c.name === "rtFa");

        if (fedAuth && rtFa) {
          authInitiated = true;
          clearInterval(pollInterval);
          console.log("[SSO Auth] Cookies de sesión corporativa detectadas. Validando perfil de usuario...");

          const cookieHeader = shCookies.map((c) => `${c.name}=${c.value}`).join("; ");

          let userProfile = null;
          let lastError = null;

          for (let attempt = 1; attempt <= 3; attempt++) {
            if (loginWin.isDestroyed()) {
              reject(new Error("Inicio de sesión cancelado por el usuario."));
              return;
            }

            try {
              console.log(`[SSO Auth] Validando perfil corporativo (Intento ${attempt})...`);
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
              new Error("No se pudo recuperar el perfil de usuario desde la API corporativa.")
            );
          }

          const email = userProfile.Email.toLowerCase().trim();
          const isAllowedDomain = !ALLOWED_EMAIL_DOMAIN || email.endsWith(ALLOWED_EMAIL_DOMAIN.toLowerCase().trim());

          if (isAllowedDomain) {
            try {
              if (!loginWin.isDestroyed()) loginWin.close();
            } catch (e) {}
            resolve({ userProfile, cookieHeader });
          } else {
            throw new Error(`Acceso no autorizado: La cuenta ${email} no pertenece al dominio institucional permitido.`);
          }
        }
      } catch (err) {
        console.error("[SSO Auth] Error en bucle de validación:", err.message);
        clearInterval(pollInterval);
        await clearAllSsoData().catch(() => {});
        try {
          if (!loginWin.isDestroyed()) loginWin.close();
        } catch (e) {}
        reject(new Error(`Error de inicio de sesión: ${err.message}`));
      }
    }, 250);

    loginWin.on("closed", () => {
      clearInterval(pollInterval);
      reject(new Error("Inicio de sesión cancelado por el usuario"));
    });
  });
}

/**
 * Consulta la API para validar la autenticidad del usuario y obtener sus datos institucionales.
 * @param {String} cookieHeader
 * @returns {Promise<{Email: String, Title: String}>}
 */
async function fetchSharepointUser(cookieHeader) {
  if (!process.versions.electron) {
    throw new Error("fetchSharepointUser requiere el entorno Electron.");
  }

  validateEnvironment();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const url = `https://${SHAREPOINT_HOST}/_api/web/currentuser`;
    const { net } = require("electron");
    const response = await net.fetch(url, {
      method: "GET",
      headers: {
        Cookie: cookieHeader,
        Accept: "application/json;odata=verbose",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Electron/LobbyControl",
      },
      signal: controller.signal,
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
      throw new Error("Formato de perfil no válido o sesión corporativa inactiva.");
    }
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === "AbortError") {
      throw new Error("Tiempo de espera agotado al validar el perfil (timeout 15s).");
    }
    throw new Error(`Error de red con el servicio de autenticación: ${err.message}`);
  }
}

/**
 * Limpia de manera exhaustiva las cookies y almacenamiento local de autenticación Microsoft y del tenant.
 * @returns {Promise<void>}
 */
async function clearAllSsoData() {
  if (!process.versions.electron) return;
  const { session } = require("electron");

  console.log("[SSO Storage] Iniciando limpieza de datos de sesión corporativa...");

  try {
    await session.defaultSession.clearStorageData({
      storages: ["cookies"],
    });
    console.log("[SSO Storage] Cookies globales eliminadas.");
  } catch (err) {
    console.error("[SSO Storage] Error al limpiar cookies:", err.message);
  }

  const origins = [
    "https://login.microsoftonline.com",
    "https://login.microsoft.com",
    "https://login.windows.net",
    "https://login.live.com",
  ];

  if (SHAREPOINT_HOST) {
    origins.push(`https://${SHAREPOINT_HOST}`);
  }

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
      console.log(`[SSO Storage] Almacenamiento local limpiado para origen: ${origin}`);
    } catch (err) {
      console.warn(`[SSO Storage] Advertencia al limpiar storage para ${origin}:`, err.message);
    }
  }
}

module.exports = { loginWithMicrosoft, fetchSharepointUser, clearAllSsoData };
