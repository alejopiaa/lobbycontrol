# Análisis de Arquitectura: Recursos Estáticos y Seguridad IPC en Electron

Este documento detalla las soluciones técnicas diseñadas para resolver dos desafíos críticos de seguridad y carga de recursos al migrar la aplicación **LobbyControl** de una arquitectura basada en red local (Express en `localhost`) a una **arquitectura pura nativa de Electron**.

---

## 🛠️ Problema 1: Gestión de Recursos Estáticos (Protocolo Seguro)

### Contexto del Problema
Cuando la interfaz de usuario se carga de forma local (ej. `mainWindow.loadFile("public/index.html")`), Chromium ejecuta el frontend bajo el protocolo `file://`. Esto presenta dos problemas importantes:
1. **Resolución de Rutas Absolutas**: Si el archivo HTML de la interfaz hace referencia a hojas de estilo o scripts utilizando rutas absolutas (como `/css/style.css` o `/js/views.js`), Chromium intentará buscar en la raíz del disco duro del sistema operativo (por ejemplo, `C:\css\style.css`), fallando inmediatamente.
2. **Superficie de Ataque XSS Ampliada**: Si ocurre una inyección de código (XSS) y la aplicación se ejecuta directamente bajo `file://`, el script inyectado hereda la capacidad de leer *cualquier* archivo del disco duro local del usuario utilizando `fetch('file:///C:/Users/.../documento.txt')` e interactuar con el sistema de archivos del host.

### Solución Propuesta: Custom Protocol Privilegiado (`app://`)
La solución más segura y profesional para resolver la resolución de rutas y mitigar los riesgos de `file://` es **registrar un protocolo personalizado privado** en Electron (por ejemplo, `app://lobbycontrol/`).

#### Beneficios:
* **Aislamiento de Origen (Same-Origin Policy)**: La aplicación tendrá su propio origen exclusivo (`app://lobbycontrol`). Los scripts de la vista no tendrán permisos para acceder a otros recursos locales del disco (`file://`), anulando la exfiltración de archivos a través de XSS.
* **Resolución Natural de Rutas**: Las rutas absolutas como `<link href="/css/style.css" rel="stylesheet">` se resolverán automáticamente relativas al origen del protocolo (`app://lobbycontrol/css/style.css`), mapeándose de forma interna al directorio de instalación.
* **Compatibilidad Estricta de CSP**: Permite definir una Política de Seguridad de Contenido (CSP) que restrinja la carga de scripts e imágenes únicamente a `app://lobbycontrol`.

#### Diseño de Implementación en `main.js`:

```javascript
const { app, protocol, BrowserWindow } = require("electron");
const path = require("path");
const fs = require("fs");

// 1. Registrar el esquema del protocolo como privilegiado (Debe hacerse antes de que la app esté lista)
protocol.registerSchemesAsPrivileged([
  {
    scheme: "app",
    privileges: {
      standard: true,     // Actúa como http/https (soporta rutas relativas/absolutas)
      secure: true,       // Reconocido como origen seguro (evita advertencias de seguridad)
      supportFetch: true,  // Habilita el uso de fetch() sobre este protocolo
      corsEnabled: false  // Deshabilita CORS cruzado innecesario
    }
  }
]);

app.whenReady().then(() => {
  // 2. Definir el handler para procesar y servir los archivos
  protocol.handle("app", (request) => {
    // Normalizar la URL (ej. app://lobbycontrol/js/views.js -> js/views.js)
    const url = request.url.replace("app://lobbycontrol/", "");
    const cleanPath = url.split("?")[0].split("#")[0];
    
    // Resolver la ruta dentro del directorio "public" de la aplicación
    const absoluteFilePath = path.join(__dirname, "public", cleanPath);

    // Evitar ataques de Directory Traversal (salto de directorios con ..)
    const relative = path.relative(path.join(__dirname, "public"), absoluteFilePath);
    const isInsidePublic = relative && !relative.startsWith('..') && !path.isAbsolute(relative);
    
    if (!isInsidePublic) {
      return new Response("Acceso Denegado", { status: 403 });
    }

    // Servir el archivo utilizando la API nativa de fetch sobre file://
    return net.fetch(`file://${absoluteFilePath}`);
  });

  // 3. Crear ventana principal cargando el protocolo personalizado
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, "preload.js")
    }
  });

  mainWindow.loadURL("app://lobbycontrol/index.html");
});
```

---

## 🔒 Problema 2: Validación Estricta de Orígenes en IPC

### Contexto del Problema
Al prescindir del servidor Express local y comunicarse mediante `ipcMain.handle(canal, handler)`, perdemos el puerto de red como barrera de autenticación. Cualquier ventana o frame de Chromium ejecutándose dentro del proceso del renderizador de Electron podría intentar emitir señales al backend enviando mensajes de IPC.
Si un atacante logra inyectar código (XSS), o si la ventana principal es redirigida accidentalmente a un sitio externo malicioso, ese origen de red externo podría intentar invocar canales de IPC expuestos en el puente de precarga (`preload.js`), ganando ejecución de comandos en Node.js de forma directa.

### Solución Propuesta: Validación de Bajo Nivel por Frame Origin
Electron proporciona metadatos detallados del origen que emite el mensaje de IPC en el primer parámetro de los manejadores (`event`). Debemos validar este origen a nivel de microsegundo en **todos** los listeners del proceso principal.

#### Estrategia de Validación:
1. **Comprobar la existencia del Frame**: Asegurar que `event.senderFrame` no sea nulo.
2. **Validación de Origen Estricto**: Verificar que el origen del frame emisor (`event.senderFrame.origin`) sea exactamente igual a `app://lobbycontrol` (el protocolo seguro).
3. **Restricción de Jerarquía (No Sub-Frames)**: Validar que `event.senderFrame.parent` sea `null`. Esto previene que una etiqueta `<iframe>` de un sitio externo embebida en la interfaz herede el puente IPC y envíe mensajes de forma fraudulenta.
4. **Verificación de la URL del Frame**: Validar que el archivo que envía la petición sea exactamente el recurso esperado.

#### Diseño de Middleware de Validación de IPC:

Para mantener la base de código limpia y segura, implementamos una envoltura (*wrapper*) para todos los manejadores de IPC en el proceso principal:

```javascript
// src/utils/security.js
const TRUSTED_ORIGIN = "app://lobbycontrol";

/**
 * Valida de forma estricta que una petición IPC provenga del frame principal empaquetado.
 * @param {Electron.IpcMainInvokeEvent} event - Evento nativo de IPC recibido
 * @throws {Error} Si el origen no es de absoluta confianza
 */
function validateIpcSender(event) {
  const frame = event.senderFrame;

  // 1. Verificar existencia del frame emisor
  if (!frame) {
    throw new Error("Acceso denegado: Remitente de IPC inexistente.");
  }

  // 2. Verificar origen del protocolo privilegido
  if (frame.origin !== TRUSTED_ORIGIN) {
    console.error(`[Alerta de Seguridad] Intento de IPC bloqueado desde origen no autorizado: ${frame.origin}`);
    throw new Error("Acceso denegado: Origen de solicitud no autorizado.");
  }

  // 3. Bloquear llamadas desde frames secundarios o iframes de terceros
  if (frame.parent !== null) {
    console.error("[Alerta de Seguridad] Intento de IPC bloqueado desde un frame secundario (iframe).");
    throw new Error("Acceso denegado: Solo el frame principal puede iniciar llamadas IPC.");
  }
}

/**
 * Envoltura para registrar manejadores IPC de forma segura y automatizada.
 * @param {string} channel - Nombre del canal IPC
 * @param {Function} handler - Función a ejecutar que procesa la lógica
 */
function safeIpcHandle(channel, handler) {
  const { ipcMain } = require("electron");
  
  ipcMain.handle(channel, async (event, ...args) => {
    try {
      // Aplicar validaciones de seguridad de bajo nivel antes de invocar la lógica
      validateIpcSender(event);
      return await handler(event, ...args);
    } catch (error) {
      console.error(`Error en canal IPC seguro [${channel}]:`, error.message);
      return { success: false, error: error.message };
    }
  });
}

module.exports = {
  safeIpcHandle,
  validateIpcSender
};
```

#### Ejemplo de Registro de API Segura:

Con este middleware, los manejadores del backend se declaran de manera sumamente simple y blindada contra llamadas externas:

```javascript
// main.js o controladores del backend
const { safeIpcHandle } = require("./src/utils/security");
const db = require("./src/config/database");

// Registro del canal de obtención de estadísticas
safeIpcHandle("db:get-stats", async (event, filters) => {
  // Solo se ejecutará si pasa el filtro de validateIpcSender
  const stats = await db.getStatsFromDatabase(filters);
  return { success: true, data: stats };
});
```

---

## 🎯 Conclusión y Recomendación Arquitectónica

Al combinar un **Protocolo Personalizado Privilegiado (`app://`)** con una **Validación Estricta de Frames de IPC (`event.senderFrame`)**, resolvemos ambos problemas de forma integral:
1. Eliminamos el servidor Express local por completo, cerrando toda exposición de puertos TCP.
2. Mantenemos el soporte para rutas relativas y absolutas nativas en el frontend de forma transparente y sin romper el DOM.
3. Blindamos el backend contra inyecciones XSS o redirecciones de Chromium al no confiar ciegamente en cualquier mensaje que llegue a los manejadores de IPC.
