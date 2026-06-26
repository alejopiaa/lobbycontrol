# Análisis de Arquitectura: Migración a Electron Pura (Sin Servidor Local)

Este documento contiene un análisis técnico detallado sobre la **Medida 3: Migración a una Arquitectura Electron Pura**, eliminando la dependencia de servidores HTTP locales como Express y migrando a comunicación IPC y protocolos de carga nativos de Electron.

---

## 1. El Concepto Central: De Servidor Web a Comunicación IPC

En la arquitectura híbrida actual de LobbyControl:
*   **Proceso Principal (Main/Backend)**: Levanta una instancia de Express y expone endpoints HTTP en un puerto local.
*   **Proceso de Renderizado (Renderer/Frontend)**: Carga `http://localhost:3000` y realiza peticiones mediante `fetch()`.

En una **Arquitectura Pura de Electron**, se elimina el servidor Express y el uso de puertos de red locales. El intercambio de datos se realiza a través de **IPC (Inter-Process Communication)**, un canal de comunicación seguro y directo en memoria física provisto por el sistema operativo y gestionado de manera nativa por Electron.

---

## 2. El Flujo de Datos sin HTTP (Mecánica de IPC)

Para realizar operaciones (como consultar estadísticas o iniciar importaciones) sin conexiones HTTP locales, se establece un flujo de tres capas:

1.  **Renderer Process (El Navegador / Chromium)**:
    La vista está aislada del sistema operativo por seguridad. Para consultar datos, invoca una función expuesta en el contexto global del navegador:
    ```javascript
    const solicitudes = await window.api.obtenerSolicitudes(filtros);
    ```
2.  **Preload Script (El Puente Seguro)**:
    Un script intermedio (`preload.js`) con acceso restringido a Electron expone selectivamente APIs a la vista mediante `contextBridge.exposeInMainWorld`, redirigiendo la llamada como un mensaje IPC seguro:
    ```javascript
    // preload.js
    contextBridge.exposeInMainWorld('api', {
      obtenerSolicitudes: (filtros) => ipcRenderer.invoke('canal-solicitudes', filtros)
    });
    ```
3.  **Main Process (Node.js / Backend)**:
    El proceso principal de Electron escucha en el canal IPC asignado, realiza la consulta directamente a la base de datos `lobby.db` usando el módulo nativo de SQLite, y retorna el resultado de vuelta por el canal:
    ```javascript
    // main.js
    ipcMain.handle('canal-solicitudes', async (event, filtros) => {
      // Consulta directa a la BD sin pasar por Express
      return await db.query(filtros);
    });
    ```

---

## 3. Carga de Interfaz mediante Protocolos Seguros

Para cargar el frontend sin un servidor HTTP local que exponga archivos estáticos, Electron sirve los assets directamente desde el directorio compilado:
*   **Protocolo de Archivos (`file://`)**: Electron abre los archivos locales físicos del disco (ej: `mainWindow.loadFile('public/index.html')`).
*   **Protocolos Personalizados (`app://` o `safe://`)**: Electron registra esquemas URL propios, intercepta las peticiones de Chromium de forma interna y sirve los bytes del disco asíncronamente sin abrir puertos TCP.

---

## 4. Ventajas de Seguridad de la Arquitectura Pura

*   **Cero Puertos Expuestos**: Al no abrir puertos de red, se anula el riesgo de intrusión externa desde otros equipos de la red (Intranet Municipal) o de otros usuarios locales del mismo equipo.
*   **Rendimiento E/S**: El intercambio de datos por IPC es directo en memoria RAM, evitando la serialización de cabeceras HTTP y latencias de socket loopback.
*   **Políticas de Seguridad Estrictas (CSP)**: Permite implementar directivas CSP estrictas que bloquean la ejecución de scripts remotos no autorizados.

---

## 5. Esfuerzo de Refactorización

Migrar LobbyControl a este modelo requeriría:
1.  **Eliminar Express**: Quitar dependencias de Express, CORS y middlewares de red en `server.js`.
2.  **Mapear APIs a IPC**: Convertir los endpoints de Express (`app.get`, `app.post`) en listeners de IPC (`ipcMain.handle`).
3.  **Adaptar Peticiones**: Reemplazar los llamados `fetch` del frontend en `public/js/app.js` por llamadas a las funciones de `window.api`.
