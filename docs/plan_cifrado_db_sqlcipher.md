# Plan de Implementación: Cifrado de Base de Datos con SQLCipher + Electron safeStorage

## Objetivo

Cifrar el archivo `lobby.db` en disco usando **SQLCipher** (SQLite con cifrado AES-256), de manera que aunque alguien copie el archivo a otro computador o lo abra con un visor externo, los datos sean completamente ilegibles sin la clave correcta.

La clave de cifrado se genera en el primer arranque, se almacena de forma segura usando la **API `safeStorage` de Electron** (que usa DPAPI de Windows internamente), y está atada al perfil de usuario de Windows de la máquina específica. Es imposible descifrar el archivo en otro computador.

---

## Cómo resuelve el problema de bootstrap (primer arranque)

### Flujo de sincronización actual (contexto importante)

`checkAndSyncDatabase` en `db-sync.js` hace una **sustitución completa** del `lobby.db` local:
- Descarga `version.json` de SharePoint → compara versiones
- Si SharePoint es más nuevo → descarga el `lobby.db` completo (incluye **todas las tablas: usuarios + solicitudes + publicadas**, etc.)
- Cierra conexión SQLite → reemplaza el archivo → reabre
- Esta sync se dispara **automáticamente** en cada login SSO. No requiere que el usuario haga nada.

### Flujo en un computador nuevo

1. El admin copia `win-unpacked` + `seed_users.db` al computador
2. App arranca → detecta `seed_users.db` → genera clave AES-256 de esta máquina (safeStorage/DPAPI)
3. Crea un `lobby.db` cifrado con solo los usuarios del seed → elimina `seed_users.db` del disco
4. El usuario hace SSO → correo encontrado en la tabla `usuarios` (viene del seed) → login OK
5. `checkAndSyncDatabase` se dispara automáticamente tras el login
6. Descarga el `lobby.db` completo de SharePoint (todos los usuarios reales + todos los datos)
7. **Re-cifra** el archivo descargado con la clave de esta máquina ← nuevo paso requerido
8. Reemplaza el `lobby.db` local → la BD queda completa y cifrada
9. En cada login siguiente: si hay nueva versión en SharePoint, repite pasos 6-8 automáticamente

**Seguridad garantizada:**
- Si alguien copia `lobby.db` → ilegible en otro computador (clave en DPAPI de esta máquina)
- `seed_users.db` solo existe brevemente durante el primer arranque y no contiene datos de lobby
- Sin SSO válido + estar en seed → no hay login, la BD de SharePoint nunca se descarga

---

## Dependencias a instalar

```bash
npm uninstall sqlite3
npm install @journeyapps/sqlcipher
```

> **Nota:** `@journeyapps/sqlcipher` es compatible con Windows y Electron mediante `@electron/rebuild`, que ya está configurado en el proyecto (`postinstall`).

---

## Archivos a modificar

### 1. `package.json`

- **Reemplazar** `sqlite3` → `@journeyapps/sqlcipher` en `dependencies`
- Agregar `@journeyapps/sqlcipher` al listado de `asarUnpack` para que el módulo nativo quede fuera del ASAR y pueda cargarse correctamente en producción

```json
"asarUnpack": [
  "scripts/import_lobby.js",
  "node_modules/@journeyapps/sqlcipher/**"
]
```

---

### 2. `main.js` — Generación y recuperación de la clave de cifrado

Agregar antes de `require('./src/ipc/handlers')`:

```javascript
const { safeStorage } = require('electron');
const crypto = require('crypto');
const keyFilePath = path.join(app.getPath('userData'), 'lobbycontrol.key');

async function getOrCreateDbKey() {
  if (fs.existsSync(keyFilePath)) {
    // Recuperar clave cifrada del disco y descifrarla con DPAPI
    const encryptedKey = fs.readFileSync(keyFilePath);
    const key = await safeStorage.decryptStringAsync(encryptedKey);
    return key;
  } else {
    // Primer arranque: generar clave aleatoria AES-256
    const key = crypto.randomBytes(32).toString('hex');
    const encryptedKey = await safeStorage.encryptStringAsync(key);
    fs.writeFileSync(keyFilePath, encryptedKey);
    return key;
  }
}
```

La clave se inyecta como variable de entorno antes de cargar los módulos:
```javascript
process.env.DB_CIPHER_KEY = await getOrCreateDbKey();
```

---

### 3. `src/config/database.js` — Apertura de BD cifrada

Reemplazar:
```javascript
const sqlite3 = require('sqlite3').verbose();
```

Por:
```javascript
const sqlite3 = require('@journeyapps/sqlcipher').verbose();
```

Modificar la función `connectDb` para aplicar la clave antes de cualquier operación:

```javascript
function connectDb(targetPath) {
  activeDb = new sqlite3.Database(targetPath, (err) => {
    if (err) {
      console.error('Error al abrir la base de datos SQLite:', err.message);
    } else {
      // Aplicar clave de cifrado (debe ser el PRIMER comando tras abrir)
      const cipherKey = process.env.DB_CIPHER_KEY || '';
      activeDb.run(`PRAGMA key = '${cipherKey}'`, (keyErr) => {
        if (keyErr) {
          console.error('Error al aplicar clave de cifrado:', keyErr.message);
          return;
        }
        activeDb.run('PRAGMA cipher_compatibility = 4');
        activeDb.run('PRAGMA busy_timeout = 30000');
        activeDb.run('PRAGMA journal_mode = WAL', (walErr) => {
          if (walErr) console.error('Error WAL:', walErr.message);
          else console.log('BD cifrada abierta y WAL activado:', targetPath);
        });
      });
    }
  });
}
```

---

### 4. `src/config/db-sync.js` — Sincronización en primer arranque

Agregar verificación de BD vacía antes de requerir login:

```javascript
// Si la BD está completamente vacía (primer arranque), sincronizar usando cookie SSO
// antes de validar tabla usuarios
async function isDbEmpty(db) {
  return new Promise((resolve) => {
    db.get('SELECT COUNT(*) as count FROM solicitudes_sh', [], (err, row) => {
      resolve(!err && row && row.count === 0);
    });
  });
}
```

Esta función se llama desde el endpoint `/api/auth/sso` de `server.js` para disparar la sincronización inicial si la BD está vacía, **solo después de que el SSO de Microsoft haya verificado que el usuario es @maipu.cl**.

---

### 5. `server.js` — Endpoint SSO con bootstrap de primer arranque

Modificar el flujo de `/api/auth/sso` para que, si no existe el usuario Y la BD está vacía, se dispare la sincronización antes de la validación final:

```javascript
// Si usuario no encontrado, verificar si es primer arranque (BD vacía)
if (!user) {
  const empty = await isDbEmpty(db);
  if (empty && cookieHeader) {
    // Primer arranque: sincronizar BD desde SharePoint
    await checkAndSyncDatabase(db, cookieHeader);
    // Reintentar búsqueda del usuario en la BD recién descargada
    db.get('SELECT * FROM usuarios WHERE correo = ?', [cleanEmail], (err2, user2) => {
      if (err2 || !user2) {
        // Incluso tras sincronizar, el usuario no está autorizado
        // ELIMINAR la BD descargada para no dejar datos expuestos
        db.closeConnection().then(() => {
          fs.unlinkSync(dbPath);
        });
        return res.status(403).json({ error: 'Acceso denegado: Tu correo no está autorizado en este sistema.' });
      }
      handleSession(user2);
    });
  } else {
    // BD no vacía pero usuario no encontrado → acceso denegado
    return res.status(403).json({ error: 'Acceso denegado: Tu correo corporativo no está registrado.' });
  }
} else {
  handleSession(user);
}
```

**Seguridad crítica:** Si la BD se descarga pero el correo no está en `usuarios`, la BD se **elimina inmediatamente del disco** antes de devolver el error 403.

---

### 6. `scripts/import_lobby.js` — Importación con BD cifrada

Reemplazar `require('sqlite3')` por `require('@journeyapps/sqlcipher')` y aplicar `PRAGMA key` inmediatamente tras abrir la BD:

```javascript
const sqlite3 = require('@journeyapps/sqlcipher').verbose();
const db = new sqlite3.Database(dbPath, (err) => {
  if (!err) {
    db.run(`PRAGMA key = '${process.env.DB_CIPHER_KEY || ''}'`);
    db.run('PRAGMA cipher_compatibility = 4');
  }
});
```

El proceso padre (`server.js`) inyecta `DB_CIPHER_KEY` en el entorno del proceso hijo al hacer `fork`.

---

### 7. `scripts/check_db.js` e `scripts/inspect.js`

Mismo cambio: reemplazar `sqlite3` por `@journeyapps/sqlcipher` y aplicar `PRAGMA key`. En desarrollo local, la `DB_CIPHER_KEY` puede venir del `.env` o de una variable generada al inicio.

> **Nota:** En modo desarrollo, la BD local (`data/lobby.db`) **no se cifra** (la clave `DB_CIPHER_KEY` no se inyecta en modo `isDev`), para que los scripts de consola sigan funcionando sin necesidad de DPAPI.

---

## Migración de la BD existente

La BD actual (`data/lobby.db`) está sin cifrar. El proceso de migración es:

1. Hacer un respaldo del archivo `.db` original
2. Abrir la BD sin clave con sqlite3 clásico
3. Usar `sqlcipher_export()` para crear una copia cifrada
4. Reemplazar el archivo original por el cifrado

Se creará un script de migración en `scripts/migrate_to_encrypted.js` que se ejecuta **una sola vez** en modo desarrollo antes del primer build de producción con cifrado.

---

## Resumen de cambios por archivo

| Archivo | Tipo de cambio |
|---|---|
| `package.json` | Reemplazar sqlite3 → sqlcipher, actualizar asarUnpack |
| `main.js` | Generar/recuperar clave con safeStorage, inyectarla en env |
| `src/config/database.js` | Usar sqlcipher, aplicar PRAGMA key al abrir BD |
| `src/config/db-sync.js` | Agregar función `isDbEmpty` para bootstrap |
| `server.js` | Endpoint SSO con lógica de bootstrap + eliminación si no autorizado |
| `scripts/import_lobby.js` | Usar sqlcipher, recibir clave desde env |
| `scripts/check_db.js` | Usar sqlcipher (modo dev sin clave) |
| `scripts/inspect.js` | Usar sqlcipher (modo dev sin clave) |
| `scripts/migrate_to_encrypted.js` | **NUEVO** — migración única de BD existente a formato cifrado |

---

## Riesgos y consideraciones

| Riesgo | Mitigación |
|---|---|
| `safeStorage` no disponible en algunos sistemas | Verificar `safeStorage.isEncryptionAvailable()` antes de usar. Si no está disponible, registrar error y detener la app con mensaje claro. |
| Pérdida de la clave (`lobbycontrol.key`) | Si el archivo se elimina, la BD es irrecuperable. El admin debe hacer backup de la BD desde el panel de Administración regularmente. |
| `@journeyapps/sqlcipher` y Windows | Módulo nativo que se recompila con `@electron/rebuild` (ya configurado). Puede requerir Visual C++ Build Tools instalado. |
| BD de desarrollo sigue sin cifrar | Intencional. El modo `isDev` no aplica cifrado para permitir el uso de herramientas de debug. |
