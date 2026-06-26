const { app, session } = require("electron");
const { safeIpcHandle } = require("./security");
const expressApp = require("../../server");
const db = require("../config/database");
const { Readable } = require("stream");
const { loginWithMicrosoft, fetchSharepointUser, clearAllSsoData } = require("../config/sharepoint-auth");

// Mock de Request y Response para enrutar llamadas Express vía IPC
class MockRequest extends Readable {
  constructor(options) {
    super();
    this.url = options.url || "/";
    this.method = options.method || "GET";
    this.headers = {};
    
    // Normalizar cabeceras a minúsculas
    if (options.headers) {
      for (const [k, v] of Object.entries(options.headers)) {
        this.headers[k.toLowerCase()] = v;
      }
    }
    
    this.body = options.body || {};
    this.ip = "127.0.0.1";
    this.user = options.user || null;

    if (this.body && this.method !== "GET" && this.method !== "HEAD") {
      const data = typeof this.body === "string" ? this.body : JSON.stringify(this.body);
      this.push(data);
    }
    this.push(null);
  }
}

class MockResponse {
  constructor(callback) {
    this.statusCode = 200;
    this._headers = {};
    this._body = "";
    this.callback = callback;
    this.finished = false;
    this.headersSent = false;
    this.writableEnded = false;
    this.writableFinished = false;

    // Métodos definidos en la instancia para que Object.setPrototypeOf no los pise
    this.setHeader = (name, value) => {
      this._headers[name.toLowerCase()] = value;
      return this;
    };

    this.getHeader = (name) => {
      return this._headers[name.toLowerCase()];
    };

    this.hasHeader = (name) => {
      return typeof this._headers[name.toLowerCase()] !== "undefined";
    };

    this.removeHeader = (name) => {
      delete this._headers[name.toLowerCase()];
      return this;
    };

    this.getHeaders = () => {
      return { ...this._headers };
    };

    this.write = (chunk) => {
      if (chunk) {
        this._body += chunk.toString();
      }
      return true;
    };

    this.end = (chunk) => {
      if (this.finished) return;
      if (chunk) {
        this._body += chunk.toString();
      }
      this.finished = true;
      this.writableEnded = true;
      this.writableFinished = true;
      this.callback(null, this);
    };

    this.writeHead = (statusCode, statusMessage, headers) => {
      this.statusCode = statusCode;
      this.headersSent = true;
      
      let finalHeaders = headers;
      if (typeof statusMessage === "object") {
        finalHeaders = statusMessage;
      }
      
      if (finalHeaders) {
        for (const [k, v] of Object.entries(finalHeaders)) {
          this.setHeader(k, v);
        }
      }
      return this;
    };

    this.cookie = (name, value, options) => {
      const cookieStr = `${name}=${value}`;
      if (!this._headers["set-cookie"]) {
        this._headers["set-cookie"] = [];
      }
      this._headers["set-cookie"].push(cookieStr);
      return this;
    };

    this.clearCookie = (name) => {
      return this.cookie(name, "", { maxAge: 0 });
    };
  }
}

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
        db.get("SELECT * FROM usuarios WHERE correo = ?", [email], (err, user) => {
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
            
            // Simular petición a /api/auth/sso para mantener sincronizada la cookie en server.js
            const mockReq = new MockRequest({
              url: "/api/auth/sso",
              method: "POST",
              body: { email, nombre: user.nombre, cookieHeader }
            });
            const mockRes = new MockResponse((e, r) => {
              console.log("[Auto-Login SSO] Registro de sesión corporativa completado en server.js.");
            });
            expressApp.handle(mockReq, mockRes);
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

  // Interceptar flujos interactivos especiales antes de pasarlos a Express
  if (url === "/api/auth/trigger-sso" && method === "POST") {
    try {
      console.log("[SSO IPC] Iniciando flujo interactivo de Microsoft...");
      const { userProfile, cookieHeader } = await loginWithMicrosoft();
      latestSharepointCookie = cookieHeader;
      const email = userProfile.Email.toLowerCase().trim();
      const nombre = userProfile.Title || email.split("@")[0];

      return new Promise((resolve) => {
        db.get("SELECT * FROM usuarios WHERE correo = ?", [email], async (err, user) => {
          if (err) {
            return resolve({
              status: 500,
              data: { error: "Error de base de datos: " + err.message }
            });
          }

          if (!user) {
            await clearAllSsoData();
            currentUserSession = null;
            latestSharepointCookie = null;
            return resolve({
              status: 403,
              data: { error: "Acceso denegado: Tu correo corporativo no está registrado en el sistema. Solicita acceso al administrador." }
            });
          }

          currentUserSession = {
            id: user.id,
            correo: user.correo,
            nombre: user.nombre,
            rol: user.rol,
            rut: user.rut || "",
            asistido_rut: user.asistido_rut || ""
          };

          // Sincronizar en Express
          const mockReq = new MockRequest({
            url: "/api/auth/sso",
            method: "POST",
            body: { email, nombre, cookieHeader }
          });
          const mockRes = new MockResponse((e, r) => {
            resolve({
              status: 200,
              data: { success: true, user: currentUserSession }
            });
          });
          expressApp.handle(mockReq, mockRes);
        });
      });
    } catch (err) {
      console.warn("[SSO IPC] Error o cancelación:", err.message);
      return {
        status: 401,
        data: { error: err.message }
      };
    }
  }

  if (url === "/api/auth/logout" && method === "POST") {
    currentUserSession = null;
    latestSharepointCookie = null;
    await clearAllSsoData();
    return {
      status: 200,
      data: { message: "Sesión cerrada correctamente." }
    };
  }

  // Enrutar la llamada normal a través de Express
  return new Promise((resolve) => {
    const mockReq = new MockRequest({
      url,
      method,
      body,
      headers,
      user: currentUserSession
    });

    const mockRes = new MockResponse((err, res) => {
      let data = res._body;
      if (res._headers["content-type"] && res._headers["content-type"].includes("application/json")) {
        try {
          data = JSON.parse(res._body);
        } catch (e) {}
      }

      // Si el login local fue exitoso, capturar la sesión en el proceso principal
      if (url === "/api/auth/login" && method === "POST" && res.statusCode === 200) {
        if (data && data.user) {
          currentUserSession = data.user;
        }
      }

      resolve({
        status: res.statusCode,
        headers: res._headers,
        data
      });
    });

    expressApp.handle(mockReq, mockRes);
  });
});
