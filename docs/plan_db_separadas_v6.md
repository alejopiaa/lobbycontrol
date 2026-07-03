# Plan de Sincronización y Separación de Bases de Datos (v6)

Este plan describe la reestructuración de la base de datos de LobbyControl para separar la lista de usuarios y roles del volumen principal de datos de Lobby, aislar las alertas gestionadas en una base de datos local, y mitigar vulnerabilidades de pérdida de datos, privacidad e inconsistencias de IPC, con un manejo seguro de bloqueos de archivos en Windows.

---

## 🔒 Decisiones Críticas de Arquitectura y Seguridad

1. **Eliminación Absoluta de Claves Locales**:
   * Se elimina la columna `password_hash` y cualquier lógica de autenticación local o hashing de contraseñas.
   * La base de datos `usuarios.db` actúa exclusivamente como una lista de autorización (White-List) que mapea cuentas del SSO (`correo`) con sus respectivos nombres y roles.

2. **Eliminación Completa de la Bitácora de Reportes**:
   * Se descarta la tabla `reportes_generados` y cualquier registro de historial de reportes.
   * La exportación de PDFs seguirá funcionando normalmente en caliente (generando y descargando el archivo local en el equipo), pero no guardará registros en ninguna base de datos ni en la nube.

3. **Aislamiento de Alertas Gestionadas**:
   * La tabla `alertas_gestionadas` (alertas leídas/resueltas) se almacena en `local.db` y no se sincroniza con la nube, preservando el estado visual específico de cada máquina cliente.

4. **Mitigación de Pérdida de Datos en Gestión de Usuarios (Write-Through)**:
   * Para evitar que los cambios locales realizados por el administrador se pierdan en el próximo reinicio (cuando se descargue `usuarios.db` de la nube), se implementa un esquema **Write-Through obligatorio**: cualquier operación de creación, edición o eliminación de usuarios (`POST`, `PUT`, `DELETE` sobre `/api/usuarios`) escribirá localmente en `usuarios.db` e inmediatamente subirá el archivo actualizado a SharePoint. Si la subida falla, la transacción local se revierte y se alerta al administrador.

5. **Prevención de Fuga de Información en Login (Rechazo con Autodestrucción)**:
   * Al iniciar sesión, la base de datos `usuarios.db` se descarga de SharePoint inicialmente bajo el nombre **`usuarios_temp.db`**.
   * El backend valida el correo contra `usuarios_temp.db`.
   * **Si es autorizado**: Se cierra la conexión temporal, se reemplaza `usuarios.db` local por `usuarios_temp.db` y se inicia la aplicación.
   * **Si es rechazado (403)**: Se cierra la conexión temporal y **se elimina físicamente `usuarios_temp.db` de inmediato** para evitar que usuarios no autorizados de la institución conserven la lista de personal en su disco local.

6. **Manejo Seguro de Bloqueo de Archivos en Windows (Cierre Sincronizado por Promesas)**:
   * En `sqlite3` de Node.js, `db.close()` es una operación asíncrona. Si intentamos renombrar o eliminar un archivo inmediatamente después de llamarla en Windows, el sistema operativo arrojará una excepción `EBUSY: resource busy or locked`.
   * *Solución*: Envolveremos el cierre de la base de datos temporal en una Promesa (`Promise`) y esperaremos mediante `await` a que finalice completamente antes de intentar usar `fs.unlinkSync()` o `fs.renameSync()`.

7. **Mitigación del Bloqueo del Archivo Definitivo (`usuarios.db`)**:
   * Como la aplicación se conecta a `usuarios.db` desde el arranque en el Paso 1, intentar sobrescribir este archivo definitivo con `fs.renameSync()` bajo Windows lanzará una excepción fatal `EBUSY` debido a que la conexión principal `usersDb` sigue activa y bloquea el archivo de destino.
   * *Solución*: Antes de ejecutar el reemplazo de archivos, la aplicación debe desconectar la base de datos principal de usuarios mediante `usersDb.closeConnection()`. Una vez completado el reemplazo físico, la aplicación debe volver a abrir la conexión usando `usersDb.openConnection()` para permitir consultas posteriores sin interrupciones.

---

## 🛠️ Cambios Propuestos

### 1. Inicialización de Bases de Datos en `database.js`
#### [MODIFY] [src/config/database.js](file:///c:/Users/abarrazaj/OneDrive%20-%20Ilustre%20Municipalidad%20de%20Maip%C3%BA/Documentos/Antigravity/Lobby/src/config/database.js)

* Inicializaremos tres archivos de base de datos SQLite en la misma carpeta `data`:
  1. `lobby.db` (Datos de lobby y solicitudes, se descarga/sobrescribe en la sincronización).
  2. `usuarios.db` (Lista blanca de usuarios autorizados, se sincroniza con SharePoint).
  3. `local.db` (Alertas gestionadas y configuración local específica de la máquina. **Nunca se sobrescribe**).
* Crearemos proxies de conexión en caliente para los tres:
  * `db` (Lobby) -> conexión activa `activeDb`. Expondrá `closeConnection` y `openConnection`.
  * `usersDb` (Usuarios) -> conexión activa `activeUsersDb`. **Expondrá obligatoriamente `closeConnection` y `openConnection`** propios para liberar el bloqueo sobre el archivo `usuarios.db`.
  * `localDb` (Local) -> conexión activa `activeLocalDb`. Expondrá `closeConnection` y `openConnection`.
* Modificaremos la creación de tablas:
  * En `usersDb`: Tabla `usuarios` con columnas `id`, `correo` (UNIQUE), `nombre`, `rol`, `rut`, `asistido_rut`. **Sin `password_hash`**.
  * En `localDb`: Tablas `alertas_gestionadas` y `configuracion_local` (para guardar marcas de tiempo de sincronización y configuraciones de la máquina).
  * En `db`: Tablas `solicitudes_sh`, `publicadas_ph`, `sujetos_pasivos_sph`, `sujetos_pasivos_vigentes`, `configuracion` y `historial_sincronizaciones`. **Se elimina la tabla `reportes_generados`**.
* El proxy principal `db` exportará las conexiones para mantener la compatibilidad:
  ```javascript
  db.usersDb = usersDb;
  db.localDb = localDb;
  module.exports = db;
  ```

---

### 2. Sincronización en `db-sync.js`
#### [MODIFY] [src/config/db-sync.js](file:///c:/Users/abarrazaj/OneDrive%20-%20Ilustre%20Municipalidad%20de%20Maip%C3%BA/Documentos/Antigravity/Lobby/src/config/db-sync.js)

* Modificaremos `checkAndSyncDatabase` y `uploadDatabaseToSharePoint` para manejar tipos:
  * `type === 'lobby'`: Trabaja con `lobby.db` y `version.json` (escribe la fecha de sincronización en `configuracion` dentro de `lobby.db`).
  * `type === 'usuarios'`: Trabaja con `usuarios.db` y `version_users.json` (escribe la fecha de sincronización en `configuracion_local` dentro de `local.db` para evitar crashes en bases de datos que no tengan la tabla `configuracion` de lobby):
    ```javascript
    db.localDb.run("INSERT OR REPLACE INTO configuracion_local (clave, valor) VALUES ('users_last_update', ?)", [timestampStr], ...)
    ```
* **Lógica de descarga temporal de usuarios**:
  * Modificaremos la sincronización de usuarios para que descargue el archivo remoto como `usuarios_temp.db` y solo lo consolide como `usuarios.db` si el login del usuario es exitoso.

---

### 3. Modificaciones en el Enrutador de Canales IPC (`router.js`)
#### [MODIFY] [src/ipc/router.js](file:///c:/Users/abarrazaj/OneDrive%20-%20Ilustre%20Municipalidad%20de%20Maip%C3%BA/Documentos/Antigravity/Lobby/src/ipc/router.js)

* Destructuraremos las bases de datos al inicio:
  ```javascript
  const db = require("../config/database");
  const usersDb = db.usersDb;
  const localDb = db.localDb;
  ```
* Redireccionaremos las consultas:
  * **Usuarios (Mutaciones Write-Through)**: 
    * Redireccionar consultas de la tabla `usuarios` hacia `usersDb`.
    * En los endpoints `POST /api/usuarios`, `PUT /api/usuarios` y `DELETE /api/usuarios`, después de ejecutar con éxito la consulta SQLite localmente, se llamará inmediatamente a `uploadDatabaseToSharePoint(usersDb, req.sharepointCookie, 'usuarios')` de forma síncrona. Si la subida falla, se la revertirá en base de datos y se notificará al administrador.
  * **Eliminar contraseñas y login local**: Remover la encriptación de contraseñas (`hashPassword`) y endpoints de validación de contraseñas locales. Al crear o modificar un usuario, ya no se solicita ni guarda una contraseña.
  * **Alertas**: Redireccionar consultas de la tabla `alertas_gestionadas` hacia `localDb`.
  * **Eliminar endpoints de reporte**: Borrar los controladores de ruta `/api/reportes/registrar` y `/api/reportes/resetear-correlativo` del enrutador de canales IPC.

---

### 4. Flujo de Inicio de Sesión y Auto-Login Seguro en `handlers.js`
#### [MODIFY] [src/ipc/handlers.js](file:///c:/Users/abarrazaj/OneDrive%20-%20Ilustre%20Municipalidad%20de%20Maip%C3%BA/Documentos/Antigravity/Lobby/src/ipc/handlers.js)

* **Auto-Login**:
  1. Verifica la validez de la sesión guardada localmente contra la lista de correos autorizados en `usersDb`.
  2. Si es exitosa, arranca la app y dispara la sincronización en segundo plano:
     * Sincroniza `usuarios.db` en segundo plano.
     * Sincroniza `lobby.db` en segundo plano.
* **Login Manual SSO**:
  1. Realiza el flujo interactivo de SSO de Microsoft para obtener el `cookieHeader`.
  2. Descarga la base de datos de usuarios de SharePoint como un archivo temporal **`usuarios_temp.db`** (utilizando la lógica modificada de `db-sync.js`).
  3. Abre una conexión temporal para verificar si el correo del SSO existe en la lista de usuarios autorizados dentro de `usuarios_temp.db`.
  4. **Cierre de Conexión con Promesa**:
     Para evitar el error `EBUSY` en Windows, definiremos una función para cerrar la conexión de forma controlada y sincrónica mediante Promesas:
     ```javascript
     const closeConnection = (targetDb) => {
       return new Promise((resolve, reject) => {
         targetDb.close((err) => {
           if (err) reject(err);
           else resolve();
         });
       });
     };
     ```
  5. **Si existe (Autorizado)**:
     * **Desconexión e intercambio seguro**:
       1. `await closeConnection(tempDb);` (Libera el bloqueo de `usuarios_temp.db`).
       2. `await usersDb.closeConnection();` (Libera el bloqueo de la conexión principal sobre `usuarios.db`).
       3. `fs.renameSync(tempDbPath, officialDbPath);` (Reemplaza el archivo físico sin fallos de EBUSY).
       4. `await usersDb.openConnection();` (Reabre la conexión principal a `usuarios.db` para que el backend la use sin interrupciones).
     * Permite la entrada y procede a sincronizar `lobby.db` en segundo plano.
  6. **Si no existe (Rechazado - 403)**:
     * `await closeConnection(tempDb);`
     * **Elimina físicamente el archivo `usuarios_temp.db` del disco duro** usando `fs.unlinkSync()`.
     * Limpia las credenciales SSO de la sesión y retorna error `403 Forbidden`.

---

### 5. Sincronización del Frontend (React)
#### [MODIFY] [Vistas y Componentes del Frontend]

* **Generación de Reportes**:
  * Modificaremos el flujo en el frontend al hacer clic en "Descargar PDF" para que genere y guarde el archivo PDF directamente en el sistema de archivos del usuario, omitiendo por completo cualquier llamada a `/api/reportes/registrar` o `/api/reportes/resetear-correlativo`.
* **Remover Historial de Reportes**:
  * Eliminaremos la sección de "Historial de Reportes" o la tabla de auditoría en la vista del administrador del frontend para evitar excepciones e invocaciones a canales IPC inexistentes.

---

## 📈 Plan de Verificación Técnica

1. **Prueba de Write-Through (Gestión de Usuarios)**:
   * Como administrador, crear un nuevo usuario.
   * Cerrar la aplicación de golpe inmediatamente después de guardarlo.
   * Volver a abrir la aplicación. Comprobar que el usuario sigue existiendo (confirmando la sincronización automática).
2. **Prueba de Privacidad (Autodestrucción en Login Fallido bajo Windows)**:
   * Iniciar sesión con una cuenta de Microsoft institucional que **no esté** en la lista blanca de usuarios.
   * Comprobar que la aplicación rechace el acceso con error `403`.
   * Verificar que la aplicación **no arroje un error `EBUSY` en consola** al destruir el archivo.
   * Verificar en la carpeta `data/` que el archivo `usuarios_temp.db` **no exista** tras ser eliminado.
3. **Prueba de Login Exitoso (Intercambio Seguro sin EBUSY)**:
   * Iniciar sesión con una cuenta de Microsoft institucional **autorizada** en Windows.
   * Confirmar que el login es exitoso y que la consola de Electron no muestra excepciones de archivo bloqueado al renombrar `usuarios_temp.db` -> `usuarios.db`.
   * Verificar que tras el login, la aplicación pueda consultar los usuarios de la base `usersDb` sin fallas de conexión.
4. **Prueba de IPC en Frontend**:
   * Descargar un reporte en PDF.
   * Confirmar que se descargue correctamente sin lanzar errores en la consola de React.
5. **Persistencia de Alertas**:
   * Resolver alertas en el Computador A.
   * Sincronizar y verificar que en el Computador B esas alertas sigan mostrándose como activas.
