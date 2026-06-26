const { BrowserWindow, session } = require('electron');
const https = require('https');

// URL del sitio de SharePoint corporativo y sub-sitio de SECMU
const SHAREPOINT_HOST = process.env.SHAREPOINT_HOST || 'immaipu.sharepoint.com';
const SHAREPOINT_SITE_URL = process.env.SHAREPOINT_SITE_URL || `https://${SHAREPOINT_HOST}/sites/SECMU`;
const SHAREPOINT_LOGIN_URL = process.env.SHAREPOINT_LOGIN_URL || SHAREPOINT_SITE_URL;

// Extraer la ruta del sub-sitio para consultas REST API
let sitePath = '/sites/SECMU';
try {
  const urlObj = new URL(SHAREPOINT_SITE_URL);
  sitePath = urlObj.pathname;
  if (sitePath.endsWith('/')) {
    sitePath = sitePath.slice(0, -1);
  }
} catch (e) {
  sitePath = '/sites/SECMU';
}

/**
 * Abre una ventana de login en Electron y captura las cookies del usuario una vez autenticado.
 * @returns {Promise<{userProfile: Object, cookieHeader: String}>}
 */
function loginWithMicrosoft() {
  return new Promise((resolve, reject) => {
    // Si no estamos ejecutándonos dentro de Electron (desarrollo local)
    if (!process.versions.electron) {
      console.log('Modo Desarrollo: Simulando login corporativo...');
      return resolve({
        userProfile: {
          Email: 'usuario.dev@maipu.cl',
          Title: 'Usuario de Desarrollo'
        },
        cookieHeader: 'MockCookie=123456'
      });
    }

    const loginWin = new BrowserWindow({
      width: 600,
      height: 700,
      show: true,
      title: 'Iniciar Sesión - Municipalidad de Maipú',
      autoHideMenuBar: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    });

    // Manejar fallas de red o errores DNS (ej. dominio incorrecto) para evitar pantalla blanca silenciosa
    loginWin.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL, isMainFrame) => {
      if (isMainFrame) {
        loginWin.close();
        reject(new Error(`Error de conexión (${errorDescription}): No se pudo cargar el portal de SharePoint. Verifica que la dirección de SHAREPOINT_HOST sea correcta en tu archivo .env.`));
      }
    });

    // Cargar la página de SharePoint para forzar la redirección al login institucional
    loginWin.loadURL(SHAREPOINT_LOGIN_URL);

    // Escuchar la navegación para detectar cuando las cookies estén listas, sin importar la URL exacta
    const checkAuth = async () => {
      try {
        // Obtener las cookies de sesión del host de SharePoint
        const cookies = await session.defaultSession.cookies.get({ domain: SHAREPOINT_HOST });
        const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');
        
        if (!cookieHeader || cookieHeader.trim() === '') return;

        // Validar el perfil de usuario contra SharePoint REST API
        const userProfile = await fetchSharepointUser(cookieHeader);
        
        if (userProfile && userProfile.Email) {
          const email = userProfile.Email.toLowerCase().trim();
          
          // Validar que pertenezca al dominio oficial @maipu.cl
          if (email.endsWith('@maipu.cl')) {
            loginWin.close();
            resolve({ userProfile, cookieHeader });
          } else {
            // Limpiar cookies y almacenamiento de inmediato para que no quede guardada la cuenta externa
            await clearAllSsoData();
            loginWin.close();
            reject(new Error('Acceso no autorizado: Debes iniciar sesión con una cuenta @maipu.cl'));
          }
        }
      } catch (err) {
        // Ignorar errores de red temporales mientras el usuario inicia sesión
      }
    };

    loginWin.webContents.on('did-navigate', checkAuth);
    loginWin.webContents.on('did-navigate-in-page', checkAuth);

    loginWin.on('closed', () => {
      reject(new Error('Inicio de sesión cancelado por el usuario'));
    });
  });
}

/**
 * Consulta la API de SharePoint para validar la autenticidad del usuario y obtener sus datos.
 * @param {String} cookieHeader 
 * @returns {Promise<{Email: String, Title: String}>}
 */
function fetchSharepointUser(cookieHeader) {
  return new Promise((resolve, reject) => {
    // Si estamos simulando en desarrollo local
    if (!process.versions.electron) {
      return resolve({ Email: 'usuario.dev@maipu.cl', Title: 'Usuario de Desarrollo' });
    }

    const options = {
      hostname: SHAREPOINT_HOST,
      path: `${sitePath}/_api/web/currentuser`,
      method: 'GET',
      headers: {
        'Cookie': cookieHeader,
        'Accept': 'application/json;odata=verbose'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.d && parsed.d.Email) {
            resolve({
              Email: parsed.d.Email,
              Title: parsed.d.Title
            });
          } else {
            reject(new Error('Formato de perfil no válido o sesión de SharePoint inactiva'));
          }
        } catch (e) {
          reject(new Error('Error al parsear el perfil de SharePoint'));
        }
      });
    });

    req.on('error', (err) => {
      reject(new Error(`Error de red con SharePoint: ${err.message}`));
    });

    req.end();
  });
}

/**
 * Limpia de manera exhaustiva todas las cookies y almacenamiento (localStorage, IndexedDB, etc.)
 * relacionado con el inicio de sesión corporativo en Microsoft y SharePoint.
 * Esto evita que las cuentas queden "amarradas" y permite el cambio de usuario.
 * @returns {Promise<void>}
 */
async function clearAllSsoData() {
  if (!process.versions.electron) return;
  const { session } = require('electron');
  const SHAREPOINT_HOST = process.env.SHAREPOINT_HOST || 'immaipu.sharepoint.com';

  console.log('[SSO Storage] Iniciando limpieza de datos de sesión corporativa...');

  try {
    // 1. Limpiar todas las cookies de Electron a nivel global
    await session.defaultSession.clearStorageData({
      storages: ['cookies']
    });
    console.log('[SSO Storage] Cookies globales eliminadas.');
  } catch (err) {
    console.error('[SSO Storage] Error al limpiar cookies:', err.message);
  }

  // 2. Limpiar almacenamiento local (localStorage, indexdb, etc.) para orígenes específicos de autenticación
  const origins = [
    'https://login.microsoftonline.com',
    'https://login.microsoft.com',
    'https://login.windows.net',
    'https://login.live.com',
    `https://${SHAREPOINT_HOST}`,
    'https://municipalidadmaipu.sharepoint.com',
    'https://municipalidadmaipu-my.sharepoint.com'
  ];

  for (const origin of origins) {
    try {
      await session.defaultSession.clearStorageData({
        origin: origin,
        storages: ['localstorage', 'indexdb', 'websql', 'serviceworkers', 'cachestorage']
      });
      console.log(`[SSO Storage] Almacenamiento local limpiado para origen: ${origin}`);
    } catch (err) {
      console.warn(`[SSO Storage] Advertencia al limpiar storage para ${origin}:`, err.message);
    }
  }
}

module.exports = { loginWithMicrosoft, fetchSharepointUser, clearAllSsoData };
