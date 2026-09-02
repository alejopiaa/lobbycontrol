const { app, session, shell } = require("electron");
const path = require("path");
const fs = require("fs");
const { safeIpcHandle } = require("./security");
const db = require("../config/database");
const { loginWithMicrosoft, fetchSharepointUser, clearAllSsoData } = require("../config/sharepoint-auth");
const { checkAndSyncDatabase } = require("../config/db-sync");
const router = require("./router");

let currentUserSession = null;
let latestSharepointCookie = null;

// Intentar auto-login de SharePoint al arrancar (SSO persistente)
app.whenReady().then(async () => {
  const SHAREPOINT_HOST = process.env.SHAREPOINT_HOST || "immaipu.sharepoint.com";
  try {
    console.log("[Auto-Login SSO] Buscando cookies corporativas...");
    const cookies = await session.defaultSession.cookies.get({ domain: SHAREPOINT_HOST });
    const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");

    if (cookieHeader) {
      console.log("[Auto-Login SSO] Cookies encontradas. Validando contra SharePoint...");
      const userProfile = await fetchSharepointUser(cookieHeader);
      if (userProfile && userProfile.Email) {
        const email = userProfile.Email.toLowerCase().trim();
        // Verificar si el usuario está registrado localmente
        const database = require("../config/database");
        database.usersDb.get("SELECT * FROM usuarios WHERE correo = ?", [email], (err, user) => {
          if (!err && user) {
            currentUserSession = {
              id: user.id,
              correo: user.correo,
              nombre: user.nombre,
              rol: user.rol,
              rut: user.rut || "",
              asistido_rut: user.asistido_rut || ""
            };
            latestSharepointCookie = cookieHeader;
            
            console.log(`[Auto-Login SSO] Sesión válida encontrada: ${user.correo}`);
            
            // Disparar sincronización en segundo plano con retardo de 5 segundos
            setTimeout(async () => {
              try {
                const usersUpdated = await checkAndSyncDatabase(database.usersDb, cookieHeader, "usuarios");
                console.log(`[SSO Sync] Sincronización de usuarios en arranque terminada. ¿Cambios?: ${usersUpdated}`);
                const lobbyUpdated = await checkAndSyncDatabase(database, cookieHeader, "lobby");
                console.log(`[SSO Sync] Sincronización de lobby en arranque terminada. ¿Cambios?: ${lobbyUpdated}`);
                const asistenciasUpdated = await checkAndSyncDatabase(database.asistenciasDb, cookieHeader, "asistencias");
                console.log(`[SSO Sync] Sincronización de asistencias en arranque terminada. ¿Cambios?: ${asistenciasUpdated}`);
              } catch (syncErr) {
                console.error("[SSO Sync] Error al sincronizar en arranque:", syncErr.message);
                const { logError } = require("../config/logger");
                logError("ERR-SYNC-301", "Sincronización automática en arranque falló", syncErr.message);
              }
            }, 5000);
          } else {
            console.log(`[Auto-Login SSO] Usuario ${email} no registrado en la base de datos local.`);
          }
        });
      }
    } else {
      console.log("[Auto-Login SSO] No se encontraron cookies corporativas activas.");
    }
  } catch (err) {
    console.warn("[Auto-Login SSO] Omitido o fallido:", err.message);
  }
});

// Manejador centralizado IPC
safeIpcHandle("api-route", async (event, routeInfo) => {
  const { url, method, body, headers } = routeInfo;

  // Interceptar flujos interactivos especiales antes de pasarlos al enrutador
  if (url === "/api/auth/trigger-sso" && method === "POST") {
    try {
      console.log("[SSO IPC] Iniciando flujo interactivo de Microsoft...");
      const { userProfile, cookieHeader } = await loginWithMicrosoft();
      latestSharepointCookie = cookieHeader;
      const email = userProfile.Email.toLowerCase().trim();

      const database = require("../config/database");
      const dbDir = database.usersDb.getUserDataDir();
      const tempDbPath = path.join(dbDir, "usuarios_temp.db");
      const tempVersionPath = path.join(dbDir, "version_users.json.tmp");
      const officialDbPath = database.usersDb.getDbPath();
      const officialVersionPath = path.join(dbDir, "version_users.json");

      const { downloadUsersDatabaseTemp } = require("../config/db-sync");
      const sqlite3 = require('sqlite3').verbose();

      // Helper para cerrar la conexión de forma controlada y asíncrona mediante Promesas
      const closeConnectionPromise = (targetDb) => {
        return new Promise((resolve, reject) => {
          targetDb.close((err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      };

      let user = null;

      try {
        console.log("[SSO IPC] Descargando usuarios.db de forma temporal...");
        await downloadUsersDatabaseTemp(cookieHeader, tempDbPath, tempVersionPath);
      } catch (downloadErr) {
        if (downloadErr.message.includes("404")) {
          throw new Error("La base de datos de usuarios no está inicializada en SharePoint. Comuníquese con el administrador para realizar la carga inicial.");
        } else {
          throw downloadErr;
        }
      }

      // Abrir conexión a usuarios_temp.db para validación normal
      const tempDb = new sqlite3.Database(tempDbPath);
      try {
        user = await new Promise((resolve, reject) => {
          tempDb.get("SELECT * FROM usuarios WHERE correo = ?", [email], (err, row) => {
            if (err) reject(err);
            else resolve(row);
          });
        });
      } finally {
        await closeConnectionPromise(tempDb);
      }

      if (user) {
        console.log(`[SSO IPC] Usuario autorizado: ${email}`);
        
        // Cerrar conexión principal de usuarios.db para liberar lock de destino en Windows
        await database.usersDb.closeConnection();

        // Breve pausa para asegurar la liberación de bloqueos por el OS en Windows
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Eliminar archivos WAL y SHM asociados para evitar conflictos
        const officialWalPath = `${officialDbPath}-wal`;
        const officialShmPath = `${officialDbPath}-shm`;
        if (fs.existsSync(officialWalPath)) {
          try { fs.unlinkSync(officialWalPath); } catch (e) { console.warn(`Advertencia al eliminar WAL viejo de usuarios.db:`, e.message); }
        }
        if (fs.existsSync(officialShmPath)) {
          try { fs.unlinkSync(officialShmPath); } catch (e) { console.warn(`Advertencia al eliminar SHM viejo de usuarios.db:`, e.message); }
        }

        // Reemplazar archivos usando copia y desvinculación para mayor estabilidad ante bloqueos de Windows
        fs.copyFileSync(tempDbPath, officialDbPath);
        fs.copyFileSync(tempVersionPath, officialVersionPath);

        // Eliminar archivos temporales
        if (fs.existsSync(tempDbPath)) { try { fs.unlinkSync(tempDbPath); } catch (e) {} }
        if (fs.existsSync(tempVersionPath)) { try { fs.unlinkSync(tempVersionPath); } catch (e) {} }

        // Reabrir conexión principal
        await database.usersDb.openConnection();
      } else {
        // Eliminar archivos temporales de forma física e inmediata para privacidad
        if (fs.existsSync(tempDbPath)) { try { fs.unlinkSync(tempDbPath); } catch (e) {} }
        if (fs.existsSync(tempVersionPath)) { try { fs.unlinkSync(tempVersionPath); } catch (e) {} }
      }

      if (user) {
        currentUserSession = {
          id: user.id,
          correo: user.correo,
          nombre: user.nombre,
          rol: user.rol,
          rut: user.rut || "",
          asistido_rut: user.asistido_rut || ""
        };

        const { logEvent } = require("../config/logger");
        logEvent("AUTH-SUC-101", "Inicio de sesión exitoso", `Usuario: ${user.nombre} | Rol: ${user.rol} | Correo: ${user.correo}`);

        // Sincronizar la base de datos de lobby de forma síncrona antes de finalizar el login
        try {
          console.log("[SSO IPC] Sincronizando base de datos de lobby...");
          await checkAndSyncDatabase(database, cookieHeader, "lobby");
        } catch (e) {
          console.error("[SSO IPC] Sincronización de lobby post-login falló:", e.message);
          const { logError } = require("../config/logger");
          logError("ERR-SYNC-302", "Sincronización de lobby post-login falló", e.message);
        }

        return {
          status: 200,
          data: { success: true, user: currentUserSession }
        };
      } else {
        console.warn(`[SSO IPC] Acceso denegado: ${email} no autorizado.`);
        const { logEvent } = require("../config/logger");
        logEvent("ERR-AUTH-202", "Acceso denegado: Usuario no registrado", `Correo intentado: ${email}`, "warn");
        
        await clearAllSsoData().catch(() => {});
        currentUserSession = null;
        latestSharepointCookie = null;

        return {
          status: 403,
          data: {
            error: "Privilegios Insuficientes",
            code: "SHAREPOINT_403",
            message: "Autenticado con éxito, pero su cuenta no está autorizada en la base de datos de LobbyControl. Comuníquese con soporte Lobby."
          }
        };
      }
    } catch (err) {
      console.warn("[SSO IPC] Error o cancelación:", err.message);
      const { logError } = require("../config/logger");
      logError("ERR-AUTH-203", "Fallo en flujo interactivo SSO", err.message);
      // Limpiar temporales si existen en caso de error de red durante la descarga
      const database = require("../config/database");
      const dbDir = database.usersDb.getUserDataDir();
      const tempDbPath = path.join(dbDir, "usuarios_temp.db");
      const tempVersionPath = path.join(dbDir, "version_users.json.tmp");
      if (fs.existsSync(tempDbPath)) {
        try { fs.unlinkSync(tempDbPath); } catch (e) {}
      }
      if (fs.existsSync(tempVersionPath)) {
        try { fs.unlinkSync(tempVersionPath); } catch (e) {}
      }

      return {
        status: 401,
        data: { error: err.message }
      };
    }
  }

  if (url === "/api/auth/logout" && method === "POST") {
    const userEmail = currentUserSession ? currentUserSession.correo : "Desconocido";
    currentUserSession = null;
    latestSharepointCookie = null;
    await clearAllSsoData();
    const { logEvent } = require("../config/logger");
    logEvent("AUTH-OUT-102", "Cierre de sesión", `Correo: ${userEmail}`);
    return {
      status: 200,
      data: { message: "Sesión cerrada correctamente." }
    };
  }

  // Enrutar la llamada al enrutador puro
  const routerRes = await router.handle({
    url,
    method,
    body,
    headers,
    user: currentUserSession,
    sharepointCookie: latestSharepointCookie
  }, (cookie) => {
    latestSharepointCookie = cookie;
  });

  return routerRes;
});

// ==========================================
// MANEJADORES IPC: DIÁLOGO DE CARPETA Y GENERACIÓN SILENCIOSA DE PDF
// ==========================================
safeIpcHandle("select-directory", async (event) => {
  const { dialog } = require("electron");
  const mainWindow = event.sender.getOwnerBrowserWindow();
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Seleccionar carpeta para guardar reportes masivos",
    properties: ["openDirectory", "createDirectory"]
  });
  return {
    cancelled: result.canceled,
    filePath: result.filePaths[0]
  };
});

safeIpcHandle("select-save-path", async (event, { defaultName, filters, title }) => {
  const { dialog } = require("electron");
  const mainWindow = event.sender.getOwnerBrowserWindow();
  const result = await dialog.showSaveDialog(mainWindow, {
    title: title || "Guardar archivo",
    defaultPath: defaultName,
    filters: filters || [
      { name: "Archivos PDF", extensions: ["pdf"] }
    ]
  });
  return {
    cancelled: result.canceled,
    filePath: result.filePath
  };
});

safeIpcHandle("generate-excel-file", async (event, { data, sheetName, filePath }) => {
  const XLSX = require("xlsx");
  const fs = require("fs");
  const path = require("path");

  try {
    const worksheet = XLSX.utils.json_to_sheet(data);
    if (data && data.length > 0) {
      const colWidths = Object.keys(data[0]).map(key => {
        const maxLen = Math.max(
          key.length,
          ...data.map(row => String(row[key] || '').length)
        );
        return { wch: Math.min(Math.max(maxLen + 3, 10), 65) };
      });
      worksheet['!cols'] = colWidths;
    }

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName || 'Reporte Lobby');

    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    XLSX.writeFile(workbook, filePath);
    return { success: true };
  } catch (err) {
    console.error("[generate-excel-file] Error al generar planilla Excel:", err);
    return { success: false, error: err.message };
  }
});

safeIpcHandle("generate-silent-pdf", async (event, { html, filePath, title }) => {
  const { BrowserWindow } = require("electron");
  const fs = require("fs");
  const path = require("path");

  return new Promise((resolve) => {
    let resolved = false;
    let win = null;
    let timeoutId = null;

    const safeResolve = (res) => {
      if (resolved) return;
      resolved = true;
      if (timeoutId) clearTimeout(timeoutId);
      if (win && !win.isDestroyed()) {
        try { win.destroy(); } catch (e) {}
      }
      resolve(res);
    };

    // Timeout de resguardo de 25 segundos
    timeoutId = setTimeout(() => {
      safeResolve({ success: false, error: 'Tiempo agotado al generar PDF' });
    }, 25000);

    try {
      let processedHtml = html;
      try {
        const logoPath = path.join(__dirname, "../../public/logo_secum.png");
        if (fs.existsSync(logoPath)) {
          const logoBase64 = `data:image/png;base64,${fs.readFileSync(logoPath).toString("base64")}`;
          processedHtml = processedHtml.replace(/\/logo_secum\.png/g, logoBase64);
        }
      } catch (imgErr) {
        console.warn("No se pudo incrustar logo en base64:", imgErr.message);
      }

      win = new BrowserWindow({
        show: false,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true
        }
      });

      // REGISTRAR EVENTOS ANTES DE LOADURL
      win.webContents.on("did-finish-load", async () => {
        try {
          const docTitle = title || path.basename(filePath, path.extname(filePath));
          const escapedTitle = JSON.stringify(docTitle);
          const escapedHtml = JSON.stringify(processedHtml);
          await win.webContents.executeJavaScript(`
            (async () => {
              document.title = ${escapedTitle};
              document.getElementById('print-content').innerHTML = ${escapedHtml};
              
              // Esperar imágenes con límite
              const imgs = Array.from(document.images);
              await Promise.race([
                Promise.all(imgs.map(img => {
                  if (img.complete && img.naturalWidth !== 0) return Promise.resolve();
                  if (img.decode) return img.decode().catch(() => {});
                  return new Promise(res => {
                    img.onload = res;
                    img.onerror = res;
                    setTimeout(res, 800);
                  });
                })),
                new Promise(r => setTimeout(r, 1200))
              ]);

              if (document.fonts) {
                try { await document.fonts.ready; } catch (e) {}
              }
            })()
          `);

          const pdfBuffer = await win.webContents.printToPDF({
            margins: { top: 0, bottom: 0, left: 0, right: 0 },
            pageSize: 'Letter',
            printBackground: true
          });

          const dir = path.dirname(filePath);
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }

          fs.writeFileSync(filePath, pdfBuffer);
          safeResolve({ success: true });
        } catch (err) {
          const { logError } = require("../config/logger");
          logError("ERR-REP-502", "Fallo al generar reporte PDF", `Archivo: ${path.basename(filePath)} | Error: ${err.message}`);
          safeResolve({ success: false, error: err.message });
        }
      });

      win.webContents.on("did-fail-load", (e, errorCode, errorDescription) => {
        const { logError } = require("../config/logger");
        logError("ERR-REP-502", "Fallo al generar reporte PDF (Carga fallida)", `Archivo: ${path.basename(filePath)} | Error: ${errorDescription}`);
        safeResolve({ success: false, error: errorDescription });
      });

      win.loadURL("app://lobbycontrol/print-template.html");

    } catch (err) {
      const { logError } = require("../config/logger");
      logError("ERR-REP-502", "Fallo al iniciar generación de reporte PDF", `Archivo: ${path.basename(filePath)} | Error: ${err.message}`);
      safeResolve({ success: false, error: err.message });
    }
  });
});

safeIpcHandle("open-path", async (event, targetPath) => {
  if (!targetPath || typeof targetPath !== "string") {
    return { success: false, error: "Ruta no especificada" };
  }
  try {
    const normPath = path.normalize(targetPath);
    const err = await shell.openPath(normPath);
    if (err) {
      return { success: false, error: err };
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

safeIpcHandle("open-assistance-window", async (event, id) => {
  try {
    const mainModule = require("../../main");
    if (mainModule && mainModule.toggleOrFocusAssistanceWindow) {
      mainModule.toggleOrFocusAssistanceWindow(id);
      return { success: true };
    }
    return { success: false, error: "Módulo principal no disponible" };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

safeIpcHandle("toggle-always-on-top", async (event, flag) => {
  try {
    const mainModule = require("../../main");
    const win = mainModule.getAssistanceWindow();
    if (win && !win.isDestroyed()) {
      const nextFlag = typeof flag === "boolean" ? flag : !win.isAlwaysOnTop();
      win.setAlwaysOnTop(nextFlag);
      return { success: true, alwaysOnTop: win.isAlwaysOnTop() };
    }
    return { success: false, error: "Ventana no disponible" };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

safeIpcHandle("notify-assistance-saved", async (event, data) => {
  try {
    const mainModule = require("../../main");
    const mainWindow = mainModule.getMainWindow();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("assistance-updated", data);
    }
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

safeIpcHandle("generate-eml-and-open", async (event, args) => {
  try {
    const { to, subject, bodyText, bodyHtml, ticketCodigo } = args || {};
    const tempDir = app.getPath("temp");
    const safeTicket = (ticketCodigo || "AST").replace(/[^a-zA-Z0-9-_]/g, "");
    const fileName = `temp_ast_${safeTicket}_${Date.now()}.eml`;
    const filePath = path.join(tempDir, fileName);

    const emlContent = [
      `To: ${to || ""}`,
      `Subject: ${subject || "Comprobante de Asistencia Técnica LobbyControl"}`,
      `X-Unsent: 1`,
      `MIME-Version: 1.0`,
      `Content-Type: text/html; charset=UTF-8`,
      ``,
      bodyHtml || `<p>${(bodyText || "").replace(/\n/g, "<br>")}</p>`
    ].join("\r\n");

    fs.writeFileSync(filePath, emlContent, "utf8");
    const err = await shell.openPath(filePath);
    if (err) {
      return { success: false, error: err };
    }
    return { success: true, filePath };
  } catch (e) {
    return { success: false, error: e.message };
  }
});


