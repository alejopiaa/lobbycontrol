# Changelog

Todos los cambios notables en este proyecto serán documentados en este archivo. El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/) y este proyecto adhiere a [Semantic Versioning](https://semver.org/lang/es/).

---

## [2.3.0] - 2026-07-03

### Añadido
- **Empaquetado e Instalador Interactivo (NSIS)**:
  - Soporte para instalador asistido interactivo (`oneClick: false`) que guía al usuario paso a paso (Welcome, Choose Folder, Progress, Finish) en lugar de una instalación silenciosa.
  - Inicio automático de la aplicación desmarcado por defecto (`runAfterFinish: false`) en la pantalla final del instalador para respetar la elección del usuario.
  - Integración de ícono corporativo personalizado `public/lobby.ico` en el instalador y accesos directos de Windows.
  - Comando `"electron:installer"` en `package.json` para generar el instalador distribuible.

### Eliminado
- **Código Muerto y Deuda Técnica**:
  - Eliminación definitiva del archivo de middleware criptográfico huérfano `src/middleware/auth.js`.
  - Remoción del controlador y de la ruta obsoleta de login local `/api/auth/login` en `src/ipc/router.js`.
  - Eliminación de la función obsoleta `login()` en `public/js/app.js` y del formulario HTML de login local (`#local-form-container`) en `public/js/views.js`.
  - Remoción de campos de contraseña locales en modales de creación/edición de usuarios y de perfil propio en `public/js/app.js`.
  - Eliminación de las funciones de soporte para contraseñas (`togglePasswordVisibility` y `generateSecurePassword`) en `public/js/helpers.js`.

### Corregido
- **Representación Visual en Dashboard**:
  - Implementación del helper `formatPct` para evitar mostrar `0%` en categorías que contienen elementos reales pero de peso porcentual muy bajo (ej. 8 registros de 12.848), mostrándolas ahora correctamente como `<0.1%`.

---

## [2.2.2] - 2026-07-02

### Añadido
- **Arquitectura de Sincronización y Bases de Datos Separadas**:
  - División física de la base de datos en tres archivos SQLite independientes en `data/`:
    1. `lobby.db`: Contiene los datos principales de audiencias de la Ley de Lobby.
    2. `usuarios.db`: Lista blanca de usuarios autorizados.
    3. `local.db`: Datos locales y configuraciones de cada terminal de instalación (incluyendo el estado de alertas visuales de la máquina).
  - Enrutador centralizado de canales IPC en `src/ipc/router.js` para redireccionar las operaciones SQLite correspondientes de forma aislada.
  - Implementación del nuevo módulo de logs unificado `src/config/logger.js`.
  - Nueva plantilla HTML para la impresión local de reportes en `public/print-template.html`.

### Cambiado
- **Seguridad de Autenticación**:
  - Mapeo de la base de datos `usuarios.db` para que actúe exclusivamente como lista de autorización de SSO.
  - Implementación de la subida inmediata (Write-Through) síncrona en cambios locales de usuarios a SharePoint, previniendo la pérdida de datos locales durante la sincronización remota.

### Corregido
- **Manejo de Bloqueo de Archivos en Windows (EBUSY)**:
  - Rediseño de la conexión temporal en el login manual SSO: cierra la base de datos de usuarios (`usersDb.closeConnection()`) utilizando promesas con `await` para garantizar la liberación de descriptores de archivos antes de renombrar/eliminar archivos bajo Windows, evitando excepciones de recursos ocupados en el sistema operativo.
  - Autodestrucción segura del archivo temporal `usuarios_temp.db` mediante `fs.unlinkSync()` si el login SSO falla o es denegado (error 403), evitando conservar datos residuales sin lanzar errores EBUSY en consola.

### Eliminado
- **Contraseñas Locales**:
  - Eliminación absoluta de la lógica de contraseñas locales (eliminando hashes, hashing local y endpoints de verificación).
- **Historial de Reportes**:
  - Remoción completa del almacenamiento del historial de reportes y de la tabla `reportes_generados` en la base de datos de lobby. La generación de PDFs se procesa en caliente en el cliente.
- **Servidor Express Local**:
  - Eliminación definitiva del archivo `server.js` (antiguo servidor Express para HTTP), consolidando la comunicación nativa local 100% por IPC de Electron.

---

## [2.2.1] - 2026-06-26

### Seguridad

- Reversión de la lógica de autoregistro automático de usuarios SSO para mitigar una vulnerabilidad crítica de elevación de privilegios no autorizada.

---

## [2.2.0] - 2026-06-26

### Añadido

- Funcionalidad para autoregistrar automáticamente al primer usuario autenticado vía Single Sign-On (SSO) como Administrador del sistema si la base de datos se encuentra vacía.

---

## [2.1.1] - 2026-06-26

### Corregido

- Bucle de redirección infinita de login de SharePoint Maipú para usuarios de departamentos que utilizan el sub-sitio de SECMU.
- Detección de entorno de producción en la base de datos sqlite para evitar la creación de archivos locales en directorios protegidos dentro de la carpeta del ejecutable.
- Ruta de base de datos en entorno de desarrollo (`DEV`) para evitar usar `AppData` si la variable de entorno `USER_DATA_DIR` está definida.
- Configuración de empaquetado en `package.json` agregando `preload.js` faltante y corrigiendo la inclusión de scripts esenciales.

---

## [2.1.0] - 2026-06-26

### Añadido

- Integración de URLs corporativas de SharePoint de la Municipalidad de Maipú como fallbacks predeterminados en el código para asegurar portabilidad completa.
- Mecanismo para alternar la base de datos SQLite a la carpeta local en desarrollo y a `AppData` solo cuando la aplicación está empaquetada en producción.
- Actualización de la documentación del sistema en `README.md`.

### Cambiado

- Cambio de nombre del repositorio y aplicación de "LobbyTracker" a **"LobbyControl"** en `package.json` e identidades del sistema.
- Limpieza general del repositorio eliminando código obsoletos y archivos basura detectados en auditoría.

---

## [2.0.0] - 2026-06-26

### Añadido

- **Nueva Arquitectura Desktop**: Migración completa de una aplicación basada en servidor HTTP local a una arquitectura nativa de Electron.
- Implementación de comunicación segura mediante enrutador IPC (Inter-Process Communication).
- Configuración de protocolo seguro y privado `app://` para la carga de recursos de la aplicación, eliminando puertos locales expuestos.
- Creación de `preload.js` y puente seguro (`contextBridge`) para exponer APIs específicas de forma controlada al frontend.

---

## [1.4.0] - 2026-06-26

### Añadido
- Motor de Sincronización de Datos (`src/config/db-sync.js`): implementación de sincronización bidireccional y control de versiones offline/online mediante `data/version.json`.

---

## [1.3.0] - 2026-06-26

### Añadido
- Módulo de Autenticación con SharePoint (`src/config/sharepoint-auth.js`): integración de credenciales y conexión contra la plataforma SharePoint de la Municipalidad de Maipú.

---

## [1.2.0] - 2026-06-26

### Añadido
- Actualización mayor en el importador `scripts/import_lobby.js` para soportar volúmenes masivos de datos y optimizar el almacenamiento en SQLite.

---

## [1.1.0] - 2026-06-26

### Añadido
- Rediseño del Frontend y Vistas Offline: modificación de `app.js`, `views.js` y `helpers.js` para soportar alertas de conexión, reintentos de red e interfaces avanzadas de búsqueda local de audiencias.

---

## [1.0.3] - 2026-06-25

### Corregido
- Errores de carga y filtros corruptos en las vistas de búsqueda offline.
- Fallos de renderizado en tablas con registros extensos en la vista del dashboard.

---

## [1.0.2] - 2026-06-24

### Corregido
- Procesamiento y desbordamiento de formatos de fecha inconsistentes de la Ley de Lobby (`src/utils/date-utils.js`).
- Corrección de inserciones duplicadas en SQLite en el importador original.

---

## [1.0.1] - 2026-06-23

### Corregido
- Limpieza de datos en blanco y celdas nulas en la lectura de planillas Excel.
- Ajustes de dependencias menores de npm para el soporte de archivos de Office.

---

## [1.0.0] - 2026-06-22

### Añadido
- Primer commit del MVP de LobbyTracker para la gestión local de audiencias bajo la Ley de Lobby.
- Base de datos SQLite inicial y scripts de importación y verificación de datos.
