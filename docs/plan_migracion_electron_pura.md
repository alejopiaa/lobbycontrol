# Plan de Implementación: Migración a Arquitectura Electron Pura

Este documento detalla el plan de ingeniería de software para migrar la aplicación LobbyControl de su modelo híbrido actual (basado en servidor Express local) a una arquitectura pura nativa de Electron. Esta migración elimina toda exposición de puertos locales (`localhost`) y blinda la aplicación contra vulnerabilidades de inyección de código.

---

## 1. Fase 1: Configuración de Seguridad y Protocolo Privilegiado

### Modificaciones en [main.js](file:///c:/Users/abarrazaj/OneDrive%20-%20Ilustre%20Municipalidad%20de%20Maip%C3%BA/Documentos/Antigravity/Lobby/main.js)
1.  **Eliminación de la dependencia HTTP**:
    *   Retirar la línea que arranca el servidor Express: `require("./server.js");`.
2.  **Registro de Protocolo Personalizado Privilegiado (`app://`)**:
    *   Registrar un esquema privado privilegiado usando `protocol.registerSchemesAsPrivileged` para habilitar el comportamiento estándar (soporte de rutas relativas y absolutas), seguridad integrada y soporte para peticiones `fetch()`.
    *   Definir el manejador `protocol.handle("app", (request) => { ... })` que intercepte y sirva los recursos estáticos de forma local y segura desde el directorio `public`, impidiendo Directory Traversal y el uso directo de `file://`.
3.  **Configuración de Directivas de Seguridad**:
    *   Modificar las propiedades de `webPreferences` al instanciar `BrowserWindow`:
        *   Establecer `contextIsolation: true` para aislar el contexto de JavaScript de la vista.
        *   Establecer `nodeIntegration: false` para evitar que la vista use APIs nativas de Node.
        *   Establecer `sandbox: true` para habilitar el aislamiento a nivel de sistema operativo en la vista.
        *   Definir la ruta del script de precarga: `preload: path.join(__dirname, "preload.js")`.
4.  **Carga del Origen Virtual Seguro**:
    *   Reemplazar `mainWindow.loadURL("http://localhost:...")` por la carga del origen virtual de la aplicación: `mainWindow.loadURL("app://lobbycontrol/index.html")`.

---

## 2. Fase 2: Desarrollo del Script de Precarga (Preload)

### Creación de [preload.js](file:///c:/Users/abarrazaj/OneDrive%20-%20Ilustre%20Municipalidad%20de%20Maip%C3%BA/Documentos/Antigravity/Lobby/preload.js) (Nuevo Archivo)
1.  **Exposición Restringida de APIs**:
    *   Importar únicamente los métodos necesarios de Electron: `contextBridge` e `ipcRenderer`.
    *   Utilizar `contextBridge.exposeInMainWorld` para exponer una API global llamada `api` al navegador (`window.api`).
    *   Declarar funciones wrapper específicas con firmas e inmutabilidad estrictas para cada requerimiento del frontend.
    
    *Patrón conceptual:*
    *   `obtenerSolicitudes(filtros) -> ipcRenderer.invoke('get-solicitudes', filtros)`
    *   `importarExcel(fileData) -> ipcRenderer.invoke('import-excel', fileData)`
    *   `sincronizarSharePoint() -> ipcRenderer.invoke('sync-sharepoint')`
    *   `obtenerAlertas() -> ipcRenderer.invoke('get-alertas')`

---

## 3. Fase 3: Migración del Backend a Manejadores IPC Seguros

### Creación de [src/ipc/handlers.js](file:///c:/Users/abarrazaj/OneDrive%20-%20Ilustre%20Municipalidad%20de%20Maip%C3%BA/Documentos/Antigravity/Lobby/src/ipc/handlers.js) o Modificación de [main.js](file:///c:/Users/abarrazaj/OneDrive%20-%20Ilustre%20Municipalidad%20de%20Maip%C3%BA/Documentos/Antigravity/Lobby/main.js)
1.  **Migración de Rutas SQL de Express**:
    *   Trasladar todas las consultas SQLite actualmente ubicadas en `server.js` (endpoints `/api/...`) hacia manejadores asíncronos en Node.js mediante `ipcMain.handle`.
2.  **Implementación del Middleware de Seguridad de Invocación**:
    *   Crear una utilidad de envoltura (`safeIpcHandle(canal, handler)`) que valide rigurosamente los metadatos de bajo nivel del emisor:
        *   Verificar que `event.senderFrame` exista.
        *   Validar que el origen del frame emisor (`event.senderFrame.origin`) sea exactamente igual a `app://lobbycontrol`.
        *   Validar que `event.senderFrame.parent` sea estrictamente `null` (para prevenir vulnerabilidades de iframes embebidos o secuestro de clics).
    *   Sanitizar y validar la estructura de los parámetros recibidos antes de realizar consultas SQL para evitar ataques de inyección SQL.

---

## 4. Fase 4: Adaptación del Frontend a Llamados IPC

### Modificaciones en [app.js](file:///c:/Users/abarrazaj/OneDrive%20-%20Ilustre%20Municipalidad%20de%20Maip%C3%BA/Documentos/Antigravity/Lobby/public/js/app.js)
1.  **Reemplazar Peticiones `fetch()`**:
    *   Identificar cada llamada HTTP local (ej: `await fetch('/api/stats')`).
    *   Reemplazarla por la invocación directa a la API segura del preload: `await window.api.obtenerStats()`.
2.  **Eliminar Middleware de Cookies y Sesiones Web**:
    *   La sesión del usuario autenticado (SSO Microsoft/SharePoint) ya no requerirá guardarse en cookies locales del navegador web de Express. La información del perfil de usuario y las cookies de SharePoint se almacenarán de forma segura en el proceso principal de Node.js o el almacén seguro de Electron.

---

## 5. Fase 5: Limpieza y Reducción del Codebase

### Modificaciones en [package.json](file:///c:/Users/abarrazaj/OneDrive%20-%20Ilustre%20Municipalidad%20de%20Maip%C3%BA/Documentos/Antigravity/Lobby/package.json) y Eliminación de Código
1.  **Eliminar Express**:
    *   Desinstalar dependencias innecesarias de red: `express`, `express-rate-limit`, etc.
2.  **Eliminar Archivos de Servidor**:
    *   Eliminar permanentemente el archivo `server.js`.
3.  **Actualizar Empaquetado**:
    *   Actualizar la sección `build` de `package.json` para no incluir `server.js` en la distribución final compilada.

---

## 6. Plan de Verificación Técnica

### A. Pruebas de Red y Puertos Abiertos
*   Iniciar la aplicación y ejecutar en consola de sistema el comando de redes:
    *   `netstat -ano | findstr :3000` (o cualquier puerto aleatorio anterior).
*   **Criterio de Aceptación**: Ningún puerto TCP local debe estar abierto o en escucha por parte de la aplicación.

### B. Pruebas de Funcionamiento Integral
*   Comprobar que todos los listados de solicitudes (SH, PH, SPH), paneles de estadísticas y la importación de Excel funcionen de manera fluida y con menor latencia a través de los canales IPC.

### C. Auditoría de Simulación XSS (Estrés de Seguridad)
*   Inyectar payloads de prueba a través de herramientas de desarrollo o mediante un archivo Excel importado.
*   **Criterio de Aceptación**: El script inyectado no debe ser capaz de acceder al objeto `process`, al sistema de archivos (`fs`), ni de realizar consultas SQLite no autorizadas gracias al aislamiento de contexto.
