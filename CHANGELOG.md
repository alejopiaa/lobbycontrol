# Changelog

Todos los cambios notables en este proyecto serán documentados en este archivo. El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/) y este proyecto adhiere a [Semantic Versioning](https://semver.org/lang/es/).

---

## [2.6.0] - 2026-07-08

### Añadido
- **Filtro Segmentado de Logs (Estilo Centro de Alertas)**:
  - Nueva barra segmentada de botones redondeados con indicadores circulares de color (dots) a la izquierda de cada etiqueta (por ejemplo: Crítico con dot rojo, Advertencia con dot ámbar, Auth con dot celeste, Info con dot gris), imitando el diseño estético de los filtros del Centro de Alertas.
  - Paginación integrada en la Bitácora de Logs con bloques de 15 registros por página.
  - Re-renderizado instantáneo de la vista de administración al alternar de filtro para reflejar visualmente el estado activo.

### Cambiado
- **Estilo de Bordes y Contraste de Tablas**:
  - Reemplazo de los bordes duros negros (`border-slate-800`) en la tabla de logs por bordes responsivos y suaves (`border-slate-200` en tema claro, `border-slate-800/60` en tema oscuro) para una integración visual agradable.
  - Reemplazo de colores de texto y bordes estáticos en la vista de **Reportes** por variables responsivas (`text-heading` para el título principal y clases neutrales para inputs y tablas), solucionando el problema de visualización con colores de fondo oscuros fijos.
  - Rediseño de los selectores de estados de solicitud en Reportes (Selección Múltiple) a chips claros (`light-first`) con bordes limpios en modo claro que se destacan en azul de marca al seleccionarse.

### Eliminado
- **Leyenda Redundante en Logs**:
  - Remoción de la leyenda inferior de colores en la bitácora de logs. El texto instructivo *"Clic en una fila para ver detalles"* se integró limpiamente en el subtítulo del encabezado.

### Corregido
- **Mapeo de Índices en Logs Filtrados**:
  - Mapeo de la selección de filas al índice original del arreglo en memoria, previniendo errores de apertura del modal de detalle al usar paginación o filtros.
  - Corrección de la referencia del estado `paginationState` en views.js al remover el prefijo redundante `window.`.

---

## [2.5.0] - 2026-07-07

### Añadido
- **Auditor de Cambios de Sincronización (Excel/SharePoint Diff)**:
  - Comparador campo por campo en script `import_lobby.js` para registrar exactamente diferencias de filas agregadas, modificadas y eliminadas en la base de datos local.
  - Almacenamiento de deltas detallados en formato JSON dentro de la columna `detalles` de `historial_sincronizaciones`.
  - Nuevo modal interactivo de auditoría de sincronizaciones que clasifica y muestra cambios en tres pestañas: Agregados (verde), Modificados (ámbar con comparación tachado/verde de valores viejo y nuevo) y Eliminados (rojo).
  - Botón interactivo de "Ver detalle" (ojo) en cada registro de la bitácora de sincronizaciones en Administración.
- **Escudo de Integridad de Datos**:
  - Endpoint IPC `GET /api/admin/db-health` extendido para validar en tiempo real la firma de la base de datos `lobby.db` usando HMAC-SHA256 y la clave secreta corporativa contra `version_lobby.json`.
  - Visualización del badge de estado "Firma Digital (HMAC)" en la tarjeta de Salud del Sistema (Administración) que detecta si el archivo se encuentra Válido o Alterado.
- **Segmentación de Alertas**:
  - Filtro por tipo de alertas (Pills interactivos: Todos, Solicitudes, Publicaciones, Agenda) en el Centro de Alertas para facilitar la clasificación de plazos legales y eventos de hoy.

### Cambiado
- **Feedback de Sincronización**:
  - Reemplazo de las antiguas alertas toast por la apertura automática del nuevo modal de auditoría interactivo al completar una sincronización.
- **Optimización y Estandarización de CSS** (`public/css/style.css`):
  - Centralización de variables del calendario (`--cal-*`) dentro del bloque global `:root` y en el selector `.dark` para evitar duplicidad y mejorar soporte del tema oscuro.
  - Consolidación y unificación de selectores repetidos para colores de fondo, tarjetas y bordes de la interfaz.
  - Integración de prefijo `-webkit-backdrop-filter` en clases con efectos de glassmorphism (`.glass-card`, `.suggestions-dropdown`, etc.) para asegurar compatibilidad total en plataformas Windows y macOS con motores Chromium/WebKit.
- **Navegación en Administración**:
  - Reordenamiento de las pestañas en el panel administrativo: Control de Auditoría (abierto por defecto al entrar), Sincronización, Gestión de Usuarios, Base de Datos y Bitácora de Logs.

### Corregido
- **Resolución de Errores de Carga**:
  - Restauración del bloque `catch` roto en la función `refreshAdminLogs()` en `public/js/app.js`, asegurando la correcta inicialización de Lucide al cargar la bitácora de logs.

---

## [2.4.0] - 2026-07-03

### Añadido
- **Módulo de Agenda (Calendario)**:
  - Nueva sección "Agenda" en el menú de navegación principal con soporte para vistas de Mes, Semana y Día.
  - Implementación de grilla mensual interactiva con indicadores de audiencias y celdas de relleno del mes previo/siguiente.
  - Vista semanal estructurada por columnas de días y vista diaria detallada con tarjetas de reuniones extendidas.
  - Código de colores visuales para distinguir de forma rápida entre audiencias pasadas (Realizadas - Muted/Gris) y futuras/hoy (No Realizadas - Verde/Resaltado).
  - Modal interactivo de detalle de audiencia agendada con visualización de folio, materia, especificación, autoridades y lobbistas.
  - Validación dinámica de publicación (`✓ Publicada` o `✗ No Publicada`) cruzando los folios de solicitudes en tiempo real con las publicaciones del portal de transparencia.
  - Lógica integrada de plazos para audiencias no publicadas (`Dentro de plazo / DDP` o `Fuera de plazo / FDP` con días de atraso).
  - Soporte de consulta eficiente por rango de fechas (`fecha_agendada_desde` y `fecha_agendada_hasta`) en el canal IPC `/api/solicitudes`.
- **Alertas de Reuniones Agendadas Hoy**:
  - Nuevo tipo de alerta preventiva `agenda` (etiqueta verde "Agenda") que se activa automáticamente para reuniones del día actual.
  - Notificaciones de color azul (info) en el Centro de Alertas y en la campanita de navegación.
  - Acción "Ir al registro" en la alerta que desplaza y enfoca automáticamente el calendario en la fecha del evento.

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
