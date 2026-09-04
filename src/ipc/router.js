const urlModule = require("url");
const path = require("path");
const fs = require("fs");
const db = require("../config/database");
const usersDb = db.usersDb;
const localDb = db.localDb;
const asistenciasDb = db.asistenciasDb;
const appDb = db.appDb || asistenciasDb;
const dateUtils = require("../utils/date-utils");

// Semáforo de control para importaciones concurrentes
let isImporting = false;

// Semáforo de control para sincronizaciones concurrentes con SharePoint
let isSyncing = false;

// Helper para obtener prefijo AAMMDD en zona horaria oficial de Chile
function getChileanDatePrefix() {
  try {
    const formatter = new Intl.DateTimeFormat('es-CL', {
      timeZone: 'America/Santiago',
      year: '2-digit',
      month: '2-digit',
      day: '2-digit'
    });
    const parts = formatter.formatToParts(new Date());
    const y = parts.find(p => p.type === 'year').value;
    const m = parts.find(p => p.type === 'month').value;
    const d = parts.find(p => p.type === 'day').value;
    return `${y}${m}${d}`;
  } catch (e) {
    const now = new Date();
    const y = String(now.getFullYear()).slice(-2);
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}${m}${d}`;
  }
}

// Helper para sanitizar y normalizar datos de contacto institucional
function sanitizeContactData(nombre, direccion, correo, telefono) {
  let cleanName = (nombre || '').trim().replace(/\s+/g, ' ');
  let cleanDireccion = (direccion || '').trim();
  let cleanEmail = (correo || '').trim().toLowerCase();
  if (cleanEmail && !cleanEmail.includes('@')) {
    cleanEmail += '@maipu.cl';
  }
  let cleanPhone = (telefono || '').trim().replace(/[^0-9]/g, '');
  return { cleanName, cleanDireccion, cleanDepto: cleanDireccion, cleanEmail, cleanPhone };
}

// Cache de folios publicados con TTL de 60 segundos
let _publishedFoliosCache = null;
let _publishedFoliosCacheTime = 0;
const PUBLISHED_FOLIOS_TTL_MS = 60 * 1000;

function getPublishedFolios(callback) {
  const now = Date.now();
  if (_publishedFoliosCache && (now - _publishedFoliosCacheTime) < PUBLISHED_FOLIOS_TTL_MS) {
    return callback(_publishedFoliosCache);
  }
  db.all("SELECT folio_lobby FROM publicadas_ph WHERE folio_lobby IS NOT NULL AND folio_lobby != ''", [], (err, rows) => {
    if (err) {
      callback(new Set());
    } else {
      _publishedFoliosCache = new Set(rows.map(r => r.folio_lobby));
      _publishedFoliosCacheTime = now;
      callback(_publishedFoliosCache);
    }
  });
}

function injectDynamicFields(items, callback) {
  if (!items) {
    if (callback) callback();
    return;
  }
  getPublishedFolios((publishedFolios) => {
    const today = new Date();
    const todayUTC = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
    const itemsArray = Array.isArray(items) ? items : [items];
    
    itemsArray.forEach(item => {
      const estadoClean = (item.estado || 'Ingresada').trim().toLowerCase();
      
      if (estadoClean === 'ingresada') {
        if (item.fecha_limite_sh) {
          try {
            const parts = item.fecha_limite_sh.split('-');
            if (parts.length === 3) {
              const deadlineDate = new Date(Date.UTC(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10)));
              const diffDays = dateUtils.getBusinessDaysDiff(todayUTC, deadlineDate);
              item.dias_restantes_sh = diffDays;
              item.estado_cumplimiento_sh = diffDays < 0 ? 'PENDIENTE_VENCIDA' : 'PENDIENTE_EN_PLAZO';
            }
          } catch (e) {
            item.dias_restantes_sh = 0;
            item.estado_cumplimiento_sh = 'PENDIENTE_EN_PLAZO';
          }
        } else {
          item.dias_restantes_sh = 0;
          item.estado_cumplimiento_sh = 'PENDIENTE_EN_PLAZO';
        }
      } else if (estadoClean === 'aceptada' && item.fecha_agendada) {
        const isPublished = item.folio_lobby && publishedFolios.has(item.folio_lobby);
        if (!isPublished) {
          try {
            const parts = item.fecha_agendada.split(' ')[0].split('-');
            if (parts.length === 3) {
              const year = parseInt(parts[0], 10);
              const month = parseInt(parts[1], 10) - 1;
              const currentYear = today.getFullYear();
              const currentMonth = today.getMonth();
              const monthsDiff = (currentYear * 12 + currentMonth) - (year * 12 + month);
              item.dias_retraso_publicacion = monthsDiff > 0 ? monthsDiff * 30 : 0;
              
              if (item.fecha_limite_publicacion) {
                const pubParts = item.fecha_limite_publicacion.split('-');
                const deadlinePubDate = new Date(Date.UTC(parseInt(pubParts[0], 10), parseInt(pubParts[1], 10) - 1, parseInt(pubParts[2], 10)));
                item.dias_restantes_publicacion = dateUtils.getBusinessDaysDiff(todayUTC, deadlinePubDate);
              } else {
                item.dias_restantes_publicacion = 0;
              }
            } else {
              item.dias_retraso_publicacion = 0;
              item.dias_restantes_publicacion = 0;
            }
          } catch (e) {
            item.dias_retraso_publicacion = 0;
            item.dias_restantes_publicacion = 0;
          }
        } else {
          item.dias_retraso_publicacion = 0;
          item.dias_restantes_publicacion = 0;
        }
      }
    });
    if (callback) callback();
  });
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Enrutador principal de endpoints locales sin Express.
 * @param {Object} req - Objeto de petición simplificado { url, method, body, headers, user, sharepointCookie }
 * @param {Function} setSharepointCookie - Callback para guardar la cookie de SharePoint en handlers.js
 * @returns {Promise<Object>} Formato estandarizado { status, data }
 */
async function handle(req, setSharepointCookie) {
  const parsedUrl = urlModule.parse(req.url, true);
  const pathName = parsedUrl.pathname;
  const query = parsedUrl.query;
  const method = req.method.toUpperCase();
  const body = req.body || {};
  const user = req.user; // currentUserSession
  
  function getEffectiveUser(u) {
    if (u && u.rol === 'Administrador' && u.simulatedUser) {
      return u.simulatedUser;
    }
    return u;
  }
  const effectiveUser = getEffectiveUser(user);

  // Validaciones globales de rutas
  const isPublicRoute = (
    pathName === '/api/auth/sso' || 
    pathName === '/api/auth/trigger-sso' || 
    pathName === '/api/auth/status' ||
    pathName === '/api/auth/me' ||
    pathName === '/api/db-last-update' ||
    pathName === '/api/app-version'
  );
  if (!isPublicRoute && !user) {
    return { status: 401, data: { error: 'No autorizado. Inicie sesión.' } };
  }

  const isAdminRoute = pathName.startsWith('/api/admin/');
  if (isAdminRoute && (!user || user.rol !== 'Administrador')) {
    return { status: 403, data: { error: 'Acceso denegado. Se requieren privilegios de Administrador.', code: 'FORBIDDEN_ADMIN_ROLE_REQUIRED' } };
  }

  // ==========================================
  // RUTAS: AUTENTICACIÓN
  // ==========================================

  // GET /api/auth/me
  if (method === 'GET' && pathName === '/api/auth/me') {
    if (!user) return { status: 200, data: null };
    
    const activeUser = effectiveUser;
    const dataToReturn = {
      id: activeUser.id,
      correo: activeUser.correo,
      nombre: activeUser.nombre,
      rol: activeUser.rol,
      rut: activeUser.rut || "",
      asistido_rut: activeUser.asistido_rut || "",
      isSimulated: !!user.simulatedUser,
      realUserNombre: user.nombre,
      realUserRol: user.rol
    };

    if (activeUser.rol === 'Sujeto Pasivo' || activeUser.rol === 'Asistente técnico') {
      const targetRut = activeUser.rol === 'Sujeto Pasivo' ? activeUser.rut : activeUser.asistido_rut;
      return new Promise((resolve) => {
        db.get('SELECT nombre FROM sujetos_pasivos_sph WHERE rut = ? LIMIT 1', [targetRut], (err, row) => {
          if (!err && row && row.nombre) {
            dataToReturn.sujeto_pasivo_nombre = row.nombre;
          } else {
            dataToReturn.sujeto_pasivo_nombre = activeUser.nombre;
          }
          resolve({ status: 200, data: dataToReturn });
        });
      });
    }
    return { status: 200, data: dataToReturn };
  }

  // POST /api/log
  if (method === 'POST' && pathName === '/api/log') {
    const { logEvent } = require('../config/logger');
    const { code, message, details, severity } = body;
    logEvent(code, message, details || '', severity || 'info');
    return { status: 200, data: { success: true } };
  }

  // GET /api/app-version
  if (method === 'GET' && pathName === '/api/app-version') {
    const pkg = require('../../package.json');
    const { app } = require('electron');
    return { status: 200, data: { version: pkg.version, isDev: !app.isPackaged } };
  }

  // GET /api/auth/status
  if (method === 'GET' && pathName === '/api/auth/status') {
    return new Promise((resolve) => {
      usersDb.get("SELECT name FROM sqlite_master WHERE type='table' AND name='usuarios'", [], (err, row) => {
        if (err) return resolve({ status: 500, data: { error: err.message } });
        if (!row) {
          return resolve({ status: 200, data: { initialized: false } });
        }
        usersDb.get("SELECT COUNT(*) AS count FROM usuarios", [], (err2, countRow) => {
          if (err2) return resolve({ status: 500, data: { error: err2.message } });
          const count = countRow ? countRow.count : 0;
          resolve({ status: 200, data: { initialized: count > 0 } });
        });
      });
    });
  }

  // POST /api/db/sync
  if (method === 'POST' && pathName === '/api/db/sync') {
    if (!user) {
      return { status: 401, data: { error: 'No autorizado.' } };
    }
    if (!req.sharepointCookie) {
      return { status: 400, data: { error: 'No hay credenciales activas.' } };
    }

    const { checkAndSyncDatabase, safeSyncAndUploadAsistencias } = require('../config/db-sync');
    if (req.sharepointCookie) {
      safeSyncAndUploadAsistencias(asistenciasDb, req.sharepointCookie).catch(e => {
        console.warn('[Sync-Capsule] Advertencia al sincronizar asistencias:', e.message);
      });
      checkAndSyncDatabase(usersDb, req.sharepointCookie, 'usuarios').catch(e => {
        console.warn('[Sync-Capsule] Advertencia al sincronizar usuarios:', e.message);
      });
    }
    return new Promise((resolve) => {
      checkAndSyncDatabase(db, req.sharepointCookie)
        .then((updated) => {
          // Obtener la fecha de última actualización para retornarla al cliente si hubo cambios
          if (updated) {
            appDb.get("SELECT valor FROM configuracion WHERE clave = 'db_last_update'", [], (err, row) => {
              const lastUpdate = (row && !err) ? row.valor : new Date().toLocaleString('es-CL');
              const { logEvent } = require('../config/logger');
              logEvent("INFO-SYNC-203", "Sincronización automática completada (Con cambios)", `Firma actualizada: ${lastUpdate} | Por: ${user.correo}`);
              resolve({
                status: 200,
                data: { success: true, updated: true, dbLastUpdate: lastUpdate }
              });
            });
          } else {
            // Sincronización en segundo plano sin cambios: silencioso, sin registrar log para evitar saturación
            resolve({
              status: 200,
              data: { success: true, updated: false }
            });
          }
        })
        .catch((err) => {
          console.error('Error al sincronizar en segundo plano:', err);
          const { logError } = require('../config/logger');
          logError("ERR-SYNC-301", "Sincronización automática en segundo plano falló", `Error: ${err.message} | Por: ${user.correo}`);
          resolve({ status: 500, data: { error: err.message } });
        });
    });
  }


  // POST /api/auth/sso
  if (method === 'POST' && pathName === '/api/auth/sso') {
    const { email, nombre, cookieHeader } = body;
    if (cookieHeader && setSharepointCookie) {
      setSharepointCookie(cookieHeader);
    }
    if (!email || !email.toLowerCase().trim().endsWith('@maipu.cl')) {
      return { status: 400, data: { error: 'Correo institucional inválido o no pertenece a @maipu.cl.' } };
    }
    const cleanEmail = email.toLowerCase().trim();
    return new Promise((resolve) => {
      usersDb.get('SELECT * FROM usuarios WHERE correo = ?', [cleanEmail], async (err, dbUser) => {
        if (err) return resolve({ status: 500, data: { error: 'Error de base de datos: ' + err.message } });
        if (!dbUser) {
          try {
            const { clearAllSsoData } = require('./sharepoint-auth');
            await clearAllSsoData();
          } catch (e) {}
          return resolve({ status: 403, data: { error: 'Acceso denegado: Tu correo corporativo no está registrado en el sistema. Solicita acceso al administrador.' } });
        }
        
        // Sincronizar SharePoint en segundo plano (usuarios.db y data.db)
        const { checkAndSyncDatabase } = require('../config/db-sync');
        setTimeout(async () => {
          try {
            const usersUpdated = await checkAndSyncDatabase(usersDb, cookieHeader, 'usuarios');
            console.log(`[SSO Sync] Sincronización de usuarios terminada. ¿Cambios?: ${usersUpdated}`);
            const lobbyUpdated = await checkAndSyncDatabase(db, cookieHeader, 'lobby');
            console.log(`[SSO Sync] Sincronización de lobby terminada. ¿Cambios?: ${lobbyUpdated}`);
            const asistenciasUpdated = await checkAndSyncDatabase(asistenciasDb, cookieHeader, 'asistencias');
            console.log(`[SSO Sync] Sincronización de asistencias terminada. ¿Cambios?: ${asistenciasUpdated}`);
          } catch (syncErr) {
            console.error('[SSO Sync] Error al sincronizar en login:', syncErr.message);
          }
        }, 5000);

        resolve({
          status: 200,
          data: {
            message: 'SSO exitoso',
            user: {
              id: dbUser.id,
              correo: dbUser.correo,
              nombre: dbUser.nombre,
              rol: dbUser.rol
            }
          }
        });
      });
    });
  }

  // POST /api/auth/extend
  if (method === 'POST' && pathName === '/api/auth/extend') {
    return { status: 200, data: { message: 'Sesión extendida.' } };
  }

  // PUT /api/perfil
  if (method === 'PUT' && pathName === '/api/perfil') {
    const userId = user.id;
    const { nombre, correo, rut } = body;
    return new Promise((resolve) => {
      usersDb.get('SELECT * FROM usuarios WHERE id = ?', [userId], (err, dbUser) => {
        if (err) return resolve({ status: 500, data: { error: err.message } });
        if (!dbUser) return resolve({ status: 404, data: { error: 'Usuario no encontrado.' } });

        let updateNombre = dbUser.nombre;
        let updateCorreo = dbUser.correo;
        let updateRut = dbUser.rut;

        if (user.rol === 'Administrador') {
          if (nombre !== undefined) updateNombre = nombre;
          if (rut !== undefined) updateRut = rut;
          if (correo !== undefined) updateCorreo = correo;
        } else {
          if (correo !== undefined) updateCorreo = correo;
        }

        const performUpdate = () => {
          const query = 'UPDATE usuarios SET nombre = ?, correo = ?, rut = ? WHERE id = ?';
          usersDb.run(query, [updateNombre, updateCorreo, updateRut, userId], function(err) {
            if (err) return resolve({ status: 500, data: { error: err.message } });
            
            const { uploadDatabaseToSharePoint } = require('../config/db-sync');
            uploadDatabaseToSharePoint(usersDb, req.sharepointCookie, 'usuarios')
              .then(() => {
                resolve({
                  status: 200,
                  data: {
                    id: userId,
                    nombre: updateNombre,
                    correo: updateCorreo,
                    rut: updateRut,
                    rol: dbUser.rol,
                    asistido_rut: dbUser.asistido_rut
                  }
                });
              })
              .catch((uploadErr) => {
                // Revertir cambio local
                usersDb.run(
                  'UPDATE usuarios SET nombre = ?, correo = ?, rut = ? WHERE id = ?',
                  [dbUser.nombre, dbUser.correo, dbUser.rut, userId],
                  () => {
                    resolve({ status: 500, data: { error: 'Error al sincronizar con SharePoint: ' + uploadErr.message + '. El cambio fue revertido.' } });
                  }
                );
              });
          });
        };

        if (correo && correo !== dbUser.correo) {
          usersDb.get('SELECT id FROM usuarios WHERE correo = ? AND id != ?', [updateCorreo, userId], (err, row) => {
            if (err) return resolve({ status: 500, data: { error: err.message } });
            if (row) {
              return resolve({ status: 400, data: { error: 'El correo electrónico ya está registrado por otro usuario.' } });
            }
            performUpdate();
          });
        } else {
          performUpdate();
        }
      });
    });
  }

  // ==========================================
  // RUTAS: ESTADÍSTICAS DEL DASHBOARD
  // ==========================================

  // GET /api/stats
  if (method === 'GET' && pathName === '/api/stats') {
    const stats = {};
    if (effectiveUser.rol === 'Sujeto Pasivo' || effectiveUser.rol === 'Asistente técnico') {
      const targetRut = effectiveUser.rol === 'Sujeto Pasivo' ? effectiveUser.rut : effectiveUser.asistido_rut;
      stats.usuarios = 1;
      stats.sujetos_pasivos = 1;
      
      const solQuery = `
        SELECT COUNT(*) AS count FROM solicitudes_sh 
        WHERE sujeto_pasivo_id IN (SELECT id_sujeto_lobby FROM sujetos_pasivos_sph WHERE rut = ?)
           OR LOWER(sujeto_pasivo) IN (SELECT LOWER(nombre) FROM sujetos_pasivos_sph WHERE rut = ?)
      `;
      return new Promise((resolve) => {
        db.get(solQuery, [targetRut, targetRut], (err, row) => {
          if (err) return resolve({ status: 500, data: { error: err.message } });
          stats.solicitudes = row.count;
          
          const pubQuery = `
            SELECT COUNT(*) AS count FROM publicadas_ph 
            WHERE LOWER(sujeto_pasivo) IN (SELECT LOWER(nombre) FROM sujetos_pasivos_sph WHERE rut = ?)
          `;
          db.get(pubQuery, [targetRut], (err, row) => {
            if (err) return resolve({ status: 500, data: { error: err.message } });
            stats.publicadas = row.count;
            resolve({ status: 200, data: stats });
          });
        });
      });
    } else {
      return new Promise((resolve) => {
        usersDb.get('SELECT COUNT(*) AS count FROM usuarios', (err, row) => {
          if (err) return resolve({ status: 500, data: { error: err.message } });
          stats.usuarios = row.count;

          db.get('SELECT COUNT(*) AS count FROM solicitudes_sh', (err, row) => {
            if (err) return resolve({ status: 500, data: { error: err.message } });
            stats.solicitudes = row.count;

            db.get('SELECT COUNT(*) AS count FROM publicadas_ph', (err, row) => {
              if (err) return resolve({ status: 500, data: { error: err.message } });
              stats.publicadas = row.count;

              db.get('SELECT COUNT(*) AS count FROM sujetos_pasivos_sph', (err, row) => {
                if (err) return resolve({ status: 500, data: { error: err.message } });
                stats.sujetos_pasivos = row.count;
                resolve({ status: 200, data: stats });
              });
            });
          });
        });
      });
    }
  }

  // ==========================================
  // RUTAS: GESTIÓN DE USUARIOS
  // ==========================================

  // GET /api/usuarios
  if (method === 'GET' && pathName === '/api/usuarios') {
    return new Promise((resolve) => {
      usersDb.all('SELECT * FROM usuarios ORDER BY id DESC', [], (err, rows) => {
        if (err) return resolve({ status: 500, data: { error: err.message } });
        resolve({ status: 200, data: rows });
      });
    });
  }

  // POST /api/usuarios
  if (method === 'POST' && pathName === '/api/usuarios') {
    const { correo, nombre, rol, rut, asistido_rut } = body;
    if (!correo || !nombre) {
      return { status: 400, data: { error: 'Correo y Nombre son obligatorios.' } };
    }
    const query = 'INSERT INTO usuarios (correo, nombre, rol, rut, asistido_rut) VALUES (?, ?, ?, ?, ?)';
    return new Promise((resolve) => {
      usersDb.run(query, [correo, nombre, rol || 'Analista', rut || '', asistido_rut || ''], function(err) {
        if (err) {
          const { logError } = require('../config/logger');
          if (err.message.includes('UNIQUE constraint failed')) {
            logError("ERR-USR-604", "Fallo al crear usuario: Correo ya registrado", `Intento: ${correo} | Por: ${user.correo}`);
            return resolve({ status: 400, data: { error: 'El correo electrónico ya está registrado.' } });
          }
          logError("ERR-USR-604", "Fallo al crear usuario", `Intento: ${correo} | Error: ${err.message} | Por: ${user.correo}`);
          return resolve({ status: 500, data: { error: err.message } });
        }
        
        const newId = this.lastID;
        const { uploadDatabaseToSharePoint } = require('../config/db-sync');
        uploadDatabaseToSharePoint(usersDb, req.sharepointCookie, 'usuarios')
          .then(() => {
            const { logEvent } = require('../config/logger');
            logEvent("INFO-USR-601", "Usuario creado", `Creado: ${correo} (Rol: ${rol || 'Analista'}) | Por: ${user.correo}`);
            resolve({
              status: 201,
              data: { id: newId, correo, nombre, rol: rol || 'Analista', rut: rut || '', asistido_rut: asistido_rut || '' }
            });
          })
          .catch((uploadErr) => {
            // Revertir inserción local
            usersDb.run('DELETE FROM usuarios WHERE id = ?', [newId], () => {
              const { logError } = require('../config/logger');
              logError("ERR-USR-604", "Fallo al sincronizar usuario creado con SharePoint", `Correo: ${correo} | Error: ${uploadErr.message} | Por: ${user.correo}`);
              resolve({ status: 500, data: { error: 'Error al sincronizar con SharePoint: ' + uploadErr.message + '. El cambio fue revertido.' } });
            });
          });
      });
    });
  }

  // PUT /api/usuarios/:id
  const userMatch = pathName.match(/^\/api\/usuarios\/(\d+)$/);
  if (method === 'PUT' && userMatch) {
    const id = userMatch[1];
    const { correo, nombre, rol, rut, asistido_rut } = body;
    return new Promise((resolve) => {
      usersDb.get('SELECT * FROM usuarios WHERE id = ?', [id], (err, oldUser) => {
        if (err) return resolve({ status: 500, data: { error: err.message } });
        if (!oldUser) return resolve({ status: 404, data: { error: 'Usuario no encontrado.' } });

        const query = 'UPDATE usuarios SET correo = ?, nombre = ?, rol = ?, rut = ?, asistido_rut = ? WHERE id = ?';
        usersDb.run(query, [correo, nombre, rol, rut || '', asistido_rut || '', id], function(err) {
          if (err) {
            const { logError } = require('../config/logger');
            logError("ERR-USR-604", "Fallo al modificar usuario", `ID: ${id} | Correo: ${correo} | Error: ${err.message} | Por: ${user.correo}`);
            return resolve({ status: 500, data: { error: err.message } });
          }
          if (this.changes === 0) return resolve({ status: 404, data: { error: 'Usuario no encontrado.' } });

          const { uploadDatabaseToSharePoint } = require('../config/db-sync');
          uploadDatabaseToSharePoint(usersDb, req.sharepointCookie, 'usuarios')
            .then(() => {
              const { logEvent } = require('../config/logger');
              logEvent("INFO-USR-602", "Usuario modificado", `Modificado: ${correo} (Rol: ${rol}) | Por: ${user.correo}`);
              resolve({ status: 200, data: { id, correo, nombre, rol, rut: rut || '', asistido_rut: asistido_rut || '' } });
            })
            .catch((uploadErr) => {
              // Revertir cambio local
              usersDb.run(
                'UPDATE usuarios SET correo = ?, nombre = ?, rol = ?, rut = ?, asistido_rut = ? WHERE id = ?',
                [oldUser.correo, oldUser.nombre, oldUser.rol, oldUser.rut, oldUser.asistido_rut, id],
                () => {
                  const { logError } = require('../config/logger');
                  logError("ERR-USR-604", "Fallo al sincronizar modificación de usuario con SharePoint", `Correo: ${correo} | Error: ${uploadErr.message} | Por: ${user.correo}`);
                  resolve({ status: 500, data: { error: 'Error al sincronizar con SharePoint: ' + uploadErr.message + '. El cambio fue revertido.' } });
                }
              );
            });
        });
      });
    });
  }

  // DELETE /api/usuarios/:id
  if (method === 'DELETE' && userMatch) {
    const id = userMatch[1];
    if (Number(id) === Number(user.id)) {
      return { status: 400, data: { error: 'No puedes eliminar a tu propio usuario.' } };
    }
    return new Promise((resolve) => {
      usersDb.get('SELECT * FROM usuarios WHERE id = ?', [id], (err, oldUser) => {
        if (err) return resolve({ status: 500, data: { error: err.message } });
        if (!oldUser) return resolve({ status: 404, data: { error: 'Usuario no encontrado.' } });

        usersDb.run('DELETE FROM usuarios WHERE id = ?', id, function(err) {
          if (err) {
            const { logError } = require('../config/logger');
            logError("ERR-USR-604", "Fallo al eliminar usuario", `ID: ${id} | Error: ${err.message} | Por: ${user.correo}`);
            return resolve({ status: 500, data: { error: err.message } });
          }
          if (this.changes === 0) return resolve({ status: 404, data: { error: 'Usuario no encontrado.' } });

          const { uploadDatabaseToSharePoint } = require('../config/db-sync');
          uploadDatabaseToSharePoint(usersDb, req.sharepointCookie, 'usuarios')
            .then(() => {
              const { logEvent } = require('../config/logger');
              logEvent("INFO-USR-603", "Usuario eliminado", `Eliminado: ${oldUser.correo} | Por: ${user.correo}`);
              resolve({ status: 200, data: { message: 'Usuario eliminado correctamente', id } });
            })
            .catch((uploadErr) => {
              // Revertir eliminación
              usersDb.run(
                'INSERT INTO usuarios (id, correo, nombre, rol, rut, asistido_rut) VALUES (?, ?, ?, ?, ?, ?)',
                [oldUser.id, oldUser.correo, oldUser.nombre, oldUser.rol, oldUser.rut, oldUser.asistido_rut],
                () => {
                  const { logError } = require('../config/logger');
                  logError("ERR-USR-604", "Fallo al sincronizar eliminación de usuario con SharePoint", `Correo: ${oldUser.correo} | Error: ${uploadErr.message} | Por: ${user.correo}`);
                  resolve({ status: 500, data: { error: 'Error al sincronizar con SharePoint: ' + uploadErr.message + '. El cambio fue revertido.' } });
                }
              );
            });
        });
      });
    });
  }

  // ==========================================
  // RUTAS: SOLICITUDES SH
  // ==========================================

  // GET /api/solicitudes
  if (method === 'GET' && pathName === '/api/solicitudes') {
    const all = query.all === 'true' || (!query.page && !query.limit);
    const pendingPub = query.pending_publication === 'true';

    let whereClauses = [];
    let params = [];

    if (effectiveUser.rol === 'Sujeto Pasivo' || effectiveUser.rol === 'Asistente técnico') {
      const targetRut = effectiveUser.rol === 'Sujeto Pasivo' ? effectiveUser.rut : effectiveUser.asistido_rut;
      whereClauses.push(`(sujeto_pasivo_id IN (SELECT id_sujeto_lobby FROM sujetos_pasivos_sph WHERE rut = ?) OR LOWER(sujeto_pasivo) IN (SELECT LOWER(nombre) FROM sujetos_pasivos_sph WHERE rut = ?))`);
      params.push(targetRut, targetRut);
    }

    if (pendingPub) {
      whereClauses.push(`LOWER(estado) = 'aceptada'`);
      whereClauses.push(`fecha_agendada IS NOT NULL AND fecha_agendada != '' AND fecha_agendada != '-'`);
      whereClauses.push(`(folio_lobby IS NULL OR folio_lobby = '' OR folio_lobby NOT IN (SELECT folio_lobby FROM publicadas_ph WHERE folio_lobby IS NOT NULL AND folio_lobby != ''))`);
    }

    if (query.vigencia === 'vigentes' || query.soloVigentes === 'true') {
      whereClauses.push(`sujeto_pasivo_id IN (SELECT id_sujeto_lobby FROM sujetos_pasivos_vigentes)`);
    } else if (query.vigencia === 'no_vigentes') {
      whereClauses.push(`(sujeto_pasivo_id IS NULL OR sujeto_pasivo_id NOT IN (SELECT id_sujeto_lobby FROM sujetos_pasivos_vigentes))`);
    }

    if (query.folio) {
      whereClauses.push(`folio_lobby LIKE ?`);
      params.push(`%${query.folio}%`);
    }
    if (query.nombre) {
      whereClauses.push(`sujeto_pasivo LIKE ?`);
      params.push(`%${query.nombre}%`);
    }
    if (query.cargo) {
      whereClauses.push(`cargo_limpio LIKE ?`);
      params.push(`%${query.cargo}%`);
    }
    if (query.sujetoActivoRepresentado) {
      whereClauses.push(`(sujeto_activo LIKE ? OR representado LIKE ? OR rut LIKE ?)`);
      params.push(`%${query.sujetoActivoRepresentado}%`, `%${query.sujetoActivoRepresentado}%`, `%${query.sujetoActivoRepresentado}%`);
    }
    if (query.relacionSujetoActivo || query.relacionRut || query.relacionRepresentado) {
      let subClauses = [];
      if (query.relacionSujetoActivo) {
        subClauses.push(`sujeto_activo LIKE ?`);
        params.push(query.relacionSujetoActivo);
      }
      if (query.relacionRut) {
        subClauses.push(`rut LIKE ?`);
        params.push(query.relacionRut);
      }
      if (query.relacionRepresentado && query.relacionRepresentado.toLowerCase() !== 'particular') {
        subClauses.push(`representado LIKE ?`);
        params.push(query.relacionRepresentado);
      }
      if (subClauses.length > 0) {
        whereClauses.push(`(${subClauses.join(' OR ')})`);
      }
    }

    if (query.fecha_agendada_desde) {
      whereClauses.push(`fecha_agendada >= ?`);
      params.push(query.fecha_agendada_desde);
    }
    if (query.fecha_agendada_hasta) {
      whereClauses.push(`fecha_agendada <= ?`);
      params.push(query.fecha_agendada_hasta);
    }

    if (pendingPub) {
      if (query.estado) {
        const val = query.estado.toLowerCase();
        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        
        whereClauses.push(`fecha_limite_publicacion IS NOT NULL AND fecha_limite_publicacion != '' AND fecha_limite_publicacion != '-'`);
        if (val === 'fuera de plazo') {
          whereClauses.push(`fecha_limite_publicacion < ?`);
          params.push(todayStr);
        } else if (val === 'en plazo') {
          whereClauses.push(`fecha_limite_publicacion >= ?`);
          params.push(todayStr);
        }
      }

      const finalWhereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

      return new Promise((resolve) => {
        if (all) {
          const sql = `SELECT id, id_lobby, folio_lobby, fecha_ingreso, fecha_respuesta, fecha_agendada, sujeto_pasivo, cargo, sujeto_pasivo_id, sujeto_activo, rut, representado, estado, cargo_limpio, codigo_licitacion, fecha_limite_sh, dias_habiles_respuesta, estado_cumplimiento_sh, fecha_limite_publicacion, genero, materia, especificacion_materia FROM solicitudes_sh ${finalWhereSql} ORDER BY id_lobby DESC`;
          db.all(sql, params, (err, rows) => {
            if (err) return resolve({ status: 500, data: { error: err.message } });
            injectDynamicFields(rows, () => {
              resolve({ status: 200, data: rows });
            });
          });
        } else {
          const page = parseInt(query.page, 10) || 1;
          const limit = parseInt(query.limit, 10) || 10;
          const offset = (page - 1) * limit;

          const countQuery = `SELECT COUNT(*) AS total FROM solicitudes_sh ${finalWhereSql}`;
          const dataQuery = `SELECT * FROM solicitudes_sh ${finalWhereSql} ORDER BY id_lobby DESC LIMIT ? OFFSET ?`;

          db.get(countQuery, params, (err, countRow) => {
            if (err) return resolve({ status: 500, data: { error: err.message } });
            const totalItems = countRow ? countRow.total : 0;

            db.all(dataQuery, [...params, limit, offset], (err, rows) => {
              if (err) return resolve({ status: 500, data: { error: err.message } });
              injectDynamicFields(rows, () => {
                resolve({
                  status: 200,
                  data: { data: rows, totalItems, page, limit }
                });
              });
            });
          });
        }
      });
    } else {
      if (query.estado) {
        whereClauses.push(`LOWER(estado) = ?`);
        params.push(query.estado.toLowerCase());
      }
      const finalWhereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

      return new Promise((resolve) => {
        if (all) {
          const sql = `SELECT id, id_lobby, folio_lobby, fecha_ingreso, fecha_respuesta, fecha_agendada, sujeto_pasivo, cargo, sujeto_pasivo_id, sujeto_activo, rut, representado, estado, cargo_limpio, codigo_licitacion, fecha_limite_sh, dias_habiles_respuesta, estado_cumplimiento_sh, fecha_limite_publicacion, genero, materia, especificacion_materia FROM solicitudes_sh ${finalWhereSql} ORDER BY id_lobby DESC`;
          db.all(sql, params, (err, rows) => {
            if (err) return resolve({ status: 500, data: { error: err.message } });
            injectDynamicFields(rows, () => {
              resolve({ status: 200, data: rows });
            });
          });
        } else {
          const page = parseInt(query.page, 10) || 1;
          const limit = parseInt(query.limit, 10) || 10;
          const offset = (page - 1) * limit;

          const countQuery = `SELECT COUNT(*) AS total FROM solicitudes_sh ${finalWhereSql}`;
          const dataQuery = `SELECT * FROM solicitudes_sh ${finalWhereSql} ORDER BY id_lobby DESC LIMIT ? OFFSET ?`;

          db.get(countQuery, params, (err, countRow) => {
            if (err) return resolve({ status: 500, data: { error: err.message } });
            const totalItems = countRow ? countRow.total : 0;

            db.all(dataQuery, [...params, limit, offset], (err, rows) => {
              if (err) return resolve({ status: 500, data: { error: err.message } });
              injectDynamicFields(rows, () => {
                resolve({
                  status: 200,
                  data: { data: rows, totalItems, page, limit }
                });
              });
            });
          });
        }
      });
    }
  }

  // ==========================================
  // RUTAS: ALERTAS
  // ==========================================

  // GET /api/alertas
  if (method === 'GET' && pathName === '/api/alertas') {
    let userWhereClauses = [];
    let userParams = [];

    if (effectiveUser.rol === 'Sujeto Pasivo' || effectiveUser.rol === 'Asistente técnico') {
      const targetRut = effectiveUser.rol === 'Sujeto Pasivo' ? effectiveUser.rut : effectiveUser.asistido_rut;
      userWhereClauses.push(`(sujeto_pasivo_id IN (SELECT id_sujeto_lobby FROM sujetos_pasivos_sph WHERE rut = ?) OR LOWER(sujeto_pasivo) IN (SELECT LOWER(nombre) FROM sujetos_pasivos_sph WHERE rut = ?))`);
      userParams.push(targetRut, targetRut);
    }

    const userWhereSql = userWhereClauses.length > 0 ? `AND ${userWhereClauses.join(' AND ')}` : '';

    return new Promise((resolve) => {
      localDb.all('SELECT tipo, solicitud_id, estado FROM alertas_gestionadas', [], (err, alerts) => {
        if (err) return resolve({ status: 500, data: { error: err.message } });

        const alertMap = new Map();
        alerts.forEach(a => {
          alertMap.set(`${a.tipo}-${a.solicitud_id}`, a.estado);
        });

        const queryIngresadas = `
          SELECT id, folio_lobby, sujeto_pasivo, fecha_ingreso, fecha_limite_sh, estado_cumplimiento_sh
          FROM solicitudes_sh
          WHERE LOWER(estado) = 'ingresada'
            ${userWhereSql}
          ORDER BY fecha_limite_sh ASC
        `;

        const queryPendientesPub = `
          SELECT id, folio_lobby, sujeto_pasivo, fecha_agendada, fecha_limite_publicacion
          FROM solicitudes_sh
          WHERE LOWER(estado) = 'aceptada'
            AND fecha_agendada IS NOT NULL AND fecha_agendada != '' AND fecha_agendada != '-'
            AND (folio_lobby IS NULL OR folio_lobby = '' OR folio_lobby NOT IN (SELECT folio_lobby FROM publicadas_ph WHERE folio_lobby IS NOT NULL AND folio_lobby != ''))
            ${userWhereSql}
          ORDER BY fecha_limite_publicacion ASC
        `;

        const queryAgendadasHoy = `
          SELECT id, folio_lobby, sujeto_pasivo, sujeto_activo, materia, fecha_agendada
          FROM solicitudes_sh
          WHERE LOWER(estado) = 'aceptada'
            AND fecha_agendada IS NOT NULL AND fecha_agendada != '' AND fecha_agendada != '-'
            AND fecha_agendada LIKE ?
            ${userWhereSql}
          ORDER BY fecha_agendada ASC
        `;

        db.all(queryIngresadas, userParams, (err, ingresadasRaw) => {
          if (err) return resolve({ status: 500, data: { error: err.message } });

          const ingresadas = ingresadasRaw.filter(item => {
            const estado = alertMap.get(`solicitud-${item.id}`);
            return estado !== 'borrada';
          }).map(item => {
            item.estado_gestion = alertMap.get(`solicitud-${item.id}`) || null;
            return item;
          });

          injectDynamicFields(ingresadas, () => {
            db.all(queryPendientesPub, userParams, (err, pendientesPubRaw) => {
              if (err) return resolve({ status: 500, data: { error: err.message } });

              const pendientesPub = pendientesPubRaw.filter(item => {
                const estado = alertMap.get(`publicacion-${item.id}`);
                return estado !== 'borrada';
              }).map(item => {
                item.estado_gestion = alertMap.get(`publicacion-${item.id}`) || null;
                return item;
              });

              injectDynamicFields(pendientesPub, () => {
                const today = new Date();
                const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
                
                db.all(queryAgendadasHoy, [todayStr + '%', ...userParams], (err, agendadasHoyRaw) => {
                  if (err) return resolve({ status: 500, data: { error: err.message } });

                  const agendadasHoy = agendadasHoyRaw.filter(item => {
                    const estado = alertMap.get(`agenda-${item.id}`);
                    return estado !== 'borrada';
                  }).map(item => {
                    item.estado_gestion = alertMap.get(`agenda-${item.id}`) || null;
                    return item;
                  });

                  injectDynamicFields(agendadasHoy, () => {
                    resolve({
                      status: 200,
                      data: { ingresadas, pendientesPub, agendadasHoy }
                    });
                  });
                });
              });
            });
          });
        });
      });
    });
  }

  // POST /api/alertas/gestionar
  if (method === 'POST' && pathName === '/api/alertas/gestionar') {
    const { alertas } = body;
    if (!alertas || !Array.isArray(alertas) || alertas.length === 0) {
      return { status: 400, data: { error: 'Faltan parámetros o el formato de alertas es inválido' } };
    }

    return new Promise((resolve) => {
      localDb.serialize(() => {
        let hasError = false;
        let processedCount = 0;

        const finalize = () => {
          processedCount++;
          if (processedCount === alertas.length) {
            if (hasError) {
              return resolve({ status: 500, data: { error: 'Hubo un error procesando algunas alertas' } });
            }
            resolve({ status: 200, data: { success: true, message: 'Alertas gestionadas correctamente' } });
          }
        };

        alertas.forEach(alerta => {
          const { tipo, solicitud_id, estado } = alerta;
          if (!tipo || !solicitud_id) {
            hasError = true;
            finalize();
            return;
          }

          if (estado === null || estado === undefined || estado === '') {
            localDb.run(
              `DELETE FROM alertas_gestionadas WHERE tipo = ? AND solicitud_id = ?`,
              [tipo, solicitud_id],
              (err) => {
                if (err) {
                  console.error('Error al remover alerta gestionada en localDb:', err.message);
                  hasError = true;
                }
                finalize();
              }
            );
          } else {
            localDb.run(
              `INSERT OR REPLACE INTO alertas_gestionadas (tipo, solicitud_id, estado, fecha_actualizacion) VALUES (?, ?, ?, CURRENT_TIMESTAMP)`,
              [tipo, solicitud_id, estado],
              (err) => {
                if (err) {
                  console.error('Error al insertar/actualizar alerta gestionada en localDb:', err.message);
                  hasError = true;
                }
                finalize();
              }
            );
          }
        });
      });
    });
  }

  // ==========================================
  // RUTAS: PUBLICADAS PH
  // ==========================================

  // GET /api/publicadas
  if (method === 'GET' && pathName === '/api/publicadas') {
    const all = query.all === 'true' || (!query.page && !query.limit);

    let whereClauses = [];
    let params = [];

    if (effectiveUser.rol === 'Sujeto Pasivo' || effectiveUser.rol === 'Asistente técnico') {
      const targetRut = effectiveUser.rol === 'Sujeto Pasivo' ? effectiveUser.rut : effectiveUser.asistido_rut;
      whereClauses.push(`LOWER(sujeto_pasivo) IN (SELECT LOWER(nombre) FROM sujetos_pasivos_sph WHERE rut = ?)`);
      params.push(targetRut);
    }

    if (query.vigencia === 'vigentes' || query.soloVigentes === 'true') {
      whereClauses.push(`LOWER(sujeto_pasivo) IN (SELECT LOWER(nombre) FROM sujetos_pasivos_sph WHERE id_sujeto_lobby IN (SELECT id_sujeto_lobby FROM sujetos_pasivos_vigentes))`);
    } else if (query.vigencia === 'no_vigentes') {
      whereClauses.push(`(sujeto_pasivo IS NULL OR LOWER(sujeto_pasivo) NOT IN (SELECT LOWER(nombre) FROM sujetos_pasivos_sph WHERE id_sujeto_lobby IN (SELECT id_sujeto_lobby FROM sujetos_pasivos_vigentes)))`);
    }

    if (query.folio) {
      whereClauses.push(`folio_lobby LIKE ?`);
      params.push(`%${query.folio}%`);
    }
    if (query.nombre) {
      whereClauses.push(`sujeto_pasivo LIKE ?`);
      params.push(`%${query.nombre}%`);
    }
    if (query.cargo) {
      whereClauses.push(`cargo LIKE ?`);
      params.push(`%${query.cargo}%`);
    }
    if (query.sujetoActivoRepresentado) {
      whereClauses.push(`(sujeto_activo LIKE ? OR representado LIKE ? OR rut LIKE ?)`);
      params.push(`%${query.sujetoActivoRepresentado}%`, `%${query.sujetoActivoRepresentado}%`, `%${query.sujetoActivoRepresentado}%`);
    }
    if (query.relacionSujetoActivo || query.relacionRut || query.relacionRepresentado) {
      let subClauses = [];
      if (query.relacionSujetoActivo) {
        subClauses.push(`sujeto_activo LIKE ?`);
        params.push(query.relacionSujetoActivo);
      }
      if (query.relacionRut) {
        subClauses.push(`rut LIKE ?`);
        params.push(query.relacionRut);
      }
      if (query.relacionRepresentado && query.relacionRepresentado.toLowerCase() !== 'particular') {
        subClauses.push(`representado LIKE ?`);
        params.push(query.relacionRepresentado);
      }
      if (subClauses.length > 0) {
        whereClauses.push(`(${subClauses.join(' OR ')})`);
      }
    }

    if (query.estado) {
      const val = query.estado.toLowerCase();
      if (val === 'fuera de plazo') {
        whereClauses.push(`LOWER(cumplimiento) LIKE 'fuera%'`);
      } else {
        whereClauses.push(`LOWER(cumplimiento) = 'en plazo'`);
      }
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    return new Promise((resolve) => {
      if (all) {
        const sql = `SELECT id, id_lobby, folio_lobby, estado, forma, lugar, comuna, sujeto_pasivo, cargo, sujeto_activo, rut, genero, tipo, representado, fecha_inicio, fecha_termino, duracion, fecha_publicacion, cumplimiento, id_solicitud_lobby FROM publicadas_ph ${whereSql} ORDER BY id_lobby DESC`;
        db.all(sql, params, (err, rows) => {
          if (err) return resolve({ status: 500, data: { error: err.message } });
          resolve({ status: 200, data: rows });
        });
      } else {
        const page = parseInt(query.page, 10) || 1;
        const limit = parseInt(query.limit, 10) || 10;
        const offset = (page - 1) * limit;

        const countQuery = `SELECT COUNT(*) AS total FROM publicadas_ph ${whereSql}`;
        const dataQuery = `SELECT * FROM publicadas_ph ${whereSql} ORDER BY id_lobby DESC LIMIT ? OFFSET ?`;

        db.get(countQuery, params, (err, countRow) => {
          if (err) return resolve({ status: 500, data: { error: err.message } });
          const totalItems = countRow ? countRow.total : 0;

          db.all(dataQuery, [...params, limit, offset], (err, rows) => {
            if (err) return resolve({ status: 500, data: { error: err.message } });
            resolve({
              status: 200,
              data: { data: rows, totalItems, page, limit }
            });
          });
        });
      }
    });
  }

  // ==========================================
  // RUTAS: SUJETOS PASIVOS SPH
  // ==========================================

  // GET /api/sujetos_pasivos
  if (method === 'GET' && pathName === '/api/sujetos_pasivos') {
    if (effectiveUser.rol === 'Sujeto Pasivo' || effectiveUser.rol === 'Asistente técnico') {
      return { status: 403, data: { error: 'Acceso denegado. No autorizado para consultar sujetos pasivos.' } };
    }
    return new Promise((resolve) => {
      const sql = `
        SELECT * FROM sujetos_pasivos_sph
        ORDER BY 
          CASE 
            WHEN fecha_termino IS NULL 
              OR TRIM(fecha_termino) = '' 
              OR LOWER(TRIM(fecha_termino)) IN ('indefinido', 'indefinicio', 'null', '-')
              OR LOWER(TRIM(fecha_termino)) LIKE '%indefin%' 
            THEN 0 
            ELSE 1 
          END ASC,
          CASE 
            WHEN fecha_termino IS NULL 
              OR TRIM(fecha_termino) = '' 
              OR LOWER(TRIM(fecha_termino)) IN ('indefinido', 'indefinicio', 'null', '-')
              OR LOWER(TRIM(fecha_termino)) LIKE '%indefin%' 
            THEN fecha_incorporacion 
            ELSE NULL 
          END DESC,
          fecha_termino DESC,
          fecha_incorporacion DESC
      `;
      db.all(sql, [], (err, rows) => {
        if (err) return resolve({ status: 500, data: { error: err.message } });
        resolve({ status: 200, data: rows });
      });
    });
  }

  // GET /api/sujetos_pasivos/vigentes
  if (method === 'GET' && pathName === '/api/sujetos_pasivos/vigentes') {
    return new Promise((resolve) => {
      db.all('SELECT id_sujeto_lobby FROM sujetos_pasivos_vigentes', [], (err, rows) => {
        if (err) return resolve({ status: 500, data: { error: err.message } });
        const ids = rows.map(r => r.id_sujeto_lobby);
        resolve({ status: 200, data: ids });
      });
    });
  }

  // GET /api/sujetos_pasivos/vigentes-nombres
  if (method === 'GET' && pathName === '/api/sujetos_pasivos/vigentes-nombres') {
    const sql = `
      SELECT MAX(sph.id_sujeto_lobby) AS id_sujeto_lobby, TRIM(sph.cargo) AS cargo
      FROM sujetos_pasivos_sph sph
      INNER JOIN sujetos_pasivos_vigentes spv ON spv.id_sujeto_lobby = sph.id_sujeto_lobby
      WHERE sph.cargo IS NOT NULL AND TRIM(sph.cargo) != ''
      GROUP BY TRIM(sph.cargo)
      ORDER BY TRIM(sph.cargo) ASC
    `;
    return new Promise((resolve) => {
      db.all(sql, [], (err, rows) => {
        if (err) return resolve({ status: 500, data: { error: err.message } });
        resolve({ status: 200, data: rows });
      });
    });
  }

  // ==========================================
  // RUTAS: ÚLTIMA MODIFICACIÓN DE LA BASE DE DATOS
  // ==========================================

  // GET /api/db-last-update
  if (method === 'GET' && pathName === '/api/db-last-update') {
    return new Promise((resolve) => {
      appDb.get("SELECT valor FROM configuracion WHERE clave = 'last_import_timestamp'", [], (err, row) => {
        const dbLastUpdate = (err || !row || !row.valor) ? 'No se registran importaciones' : row.valor;
        localDb.get("SELECT valor FROM configuracion_local WHERE clave = 'users_last_update'", [], (err2, row2) => {
          const usersLastUpdate = (err2 || !row2 || !row2.valor) ? 'Nunca' : row2.valor;
          resolve({ status: 200, data: { dbLastUpdate, usersLastUpdate } });
        });
      });
    });
  }

  // ==========================================
  // RUTAS: CORRELATIVO SECUENCIAL DE REPORTES (RAP)
  // ==========================================

  function getChileDateAAMMDD() {
    try {
      const formatter = new Intl.DateTimeFormat('es-CL', {
        timeZone: 'America/Santiago',
        year: '2-digit',
        month: '2-digit',
        day: '2-digit'
      });
      const parts = formatter.formatToParts(new Date());
      const dd = parts.find(p => p.type === 'day')?.value || '01';
      const mm = parts.find(p => p.type === 'month')?.value || '01';
      const yy = parts.find(p => p.type === 'year')?.value || '26';
      return `${yy}${mm}${dd}`;
    } catch (e) {
      const now = new Date();
      const yy = String(now.getFullYear()).slice(-2);
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const dd = String(now.getDate()).padStart(2, '0');
      return `${yy}${mm}${dd}`;
    }
  }

  function formatRapReportCode(num) {
    const dateStr = getChileDateAAMMDD();
    const padded = String(num).padStart(3, '0');
    return `RAP${dateStr}-${padded}`;
  }

  // GET /api/reportes/correlativo
  if (method === 'GET' && pathName === '/api/reportes/correlativo') {
    return new Promise((resolve) => {
      localDb.get("SELECT valor FROM configuracion_local WHERE clave = 'correlativo_reportes_rap'", [], (err, row) => {
        let currentVal = 1;
        if (!err && row && row.valor) {
          const parsed = parseInt(row.valor, 10);
          if (!isNaN(parsed) && parsed > 0) currentVal = parsed;
        }
        resolve({
          status: 200,
          data: {
            current: currentVal,
            formattedNext: formatRapReportCode(currentVal)
          }
        });
      });
    });
  }

  // POST /api/reportes/correlativo/consumir
  if (method === 'POST' && pathName === '/api/reportes/correlativo/consumir') {
    const cantidad = Math.max(1, parseInt(body?.cantidad, 10) || 1);
    return new Promise((resolve) => {
      localDb.serialize(() => {
        localDb.run("BEGIN IMMEDIATE TRANSACTION", (beginErr) => {
          if (beginErr) {
            return resolve({ status: 500, data: { error: `Error al iniciar transacción: ${beginErr.message}` } });
          }

          localDb.get("SELECT valor FROM configuracion_local WHERE clave = 'correlativo_reportes_rap'", [], (err, row) => {
            let currentVal = 1;
            if (!err && row && row.valor) {
              const parsed = parseInt(row.valor, 10);
              if (!isNaN(parsed) && parsed > 0) currentVal = parsed;
            }

            const startNum = currentVal;
            const endNum = currentVal + cantidad;
            const assignedCodes = [];
            for (let i = 0; i < cantidad; i++) {
              assignedCodes.push(formatRapReportCode(startNum + i));
            }

            localDb.run(
              "INSERT OR REPLACE INTO configuracion_local (clave, valor) VALUES ('correlativo_reportes_rap', ?)",
              [String(endNum)],
              (updateErr) => {
                if (updateErr) {
                  localDb.run("ROLLBACK");
                  return resolve({ status: 500, data: { error: `Error al actualizar correlativo: ${updateErr.message}` } });
                }

                localDb.run("COMMIT", (commitErr) => {
                  if (commitErr) {
                    localDb.run("ROLLBACK");
                    return resolve({ status: 500, data: { error: `Error al confirmar transacción: ${commitErr.message}` } });
                  }

                  resolve({
                    status: 200,
                    data: {
                      start: startNum,
                      cantidad,
                      next: endNum,
                      codes: assignedCodes,
                      firstCode: assignedCodes[0]
                    }
                  });
                });
              }
            );
          });
        });
      });
    });
  }

  // POST /api/reportes/correlativo/set
  if (method === 'POST' && pathName === '/api/reportes/correlativo/set') {
    const nuevoValor = Math.max(1, parseInt(body?.valor, 10) || 1);
    return new Promise((resolve) => {
      localDb.run(
        "INSERT OR REPLACE INTO configuracion_local (clave, valor) VALUES ('correlativo_reportes_rap', ?)",
        [String(nuevoValor)],
        (err) => {
          if (err) return resolve({ status: 500, data: { error: err.message } });
          resolve({
            status: 200,
            data: {
              current: nuevoValor,
              formattedNext: formatRapReportCode(nuevoValor)
            }
          });
        }
      );
    });
  }

  // ==========================================
  // RUTAS: IMPORTACIÓN Y DIAGNÓSTICO (ADMINISTRADOR)
  // ==========================================

  // POST /api/admin/importar
  if (method === 'POST' && pathName === '/api/admin/importar') {
    if (isImporting) {
      return { status: 409, data: { error: 'Ya hay un proceso de sincronización activo. Por favor, espere a que finalice.' } };
    }

    const { fileData } = body;
    const dbDir = db.getUserDataDir();
    const excelFile = path.join(dbDir, 'lobby_data.xlsx');

    if (fileData) {
      try {
        const excelDir = path.dirname(excelFile);
        if (!fs.existsSync(excelDir)) {
          fs.mkdirSync(excelDir, { recursive: true });
        }
        const buffer = Buffer.from(fileData, 'base64');
        fs.writeFileSync(excelFile, buffer);
        console.log(`Excel recibido y guardado con éxito en: ${excelFile}`);
      } catch (writeErr) {
        console.error('Error al guardar el archivo Excel subido:', writeErr);
        const { logError } = require('../config/logger');
        logError("ERR-IMP-702", "Fallo al guardar archivo Excel subido", `Error: ${writeErr.message} | Por: ${user.correo}`);
        return { status: 500, data: { error: `No se pudo guardar el archivo Excel: ${writeErr.message}` } };
      }
    }

    isImporting = true;
    const { fork } = require('child_process');
    const { app: electronApp } = require('electron');
    const isPackaged = electronApp ? electronApp.isPackaged : false;

    const child = fork(
      path.join(__dirname, '..', '..', 'scripts', 'import_lobby.js'),
      [],
      {
        env: {
          ...process.env,
          PRODUCTION_DB: isPackaged ? 'true' : 'false',
          IS_ELECTRON: 'true',
          EXE_DIR: process.env.EXE_DIR,
          USER_DATA_DIR: process.env.USER_DATA_DIR || path.dirname(dbDir),
          SHAREPOINT_COOKIES: req.sharepointCookie,
          IMPORT_USER_NAME: user.nombre,
          IMPORT_USER_EMAIL: user.correo
        }
      }
    );

    return new Promise((resolve) => {
      let finished = false;

      const cleanupExcel = () => {
        if (fs.existsSync(excelFile)) {
          try {
            fs.unlinkSync(excelFile);
            console.log(`[Import Cleanup] Archivo temporal Excel eliminado con éxito: ${excelFile}`);
          } catch (e) {
            console.warn(`[Import Cleanup] No se pudo eliminar el archivo Excel temporal: ${excelFile}`, e.message);
          }
        }
      };

      child.on('message', (message) => {
        if (message && message.type === 'import_stats') {
          finished = true;
          isImporting = false;
          cleanupExcel();
          const { logEvent } = require('../config/logger');
          logEvent("INFO-IMP-701", "Importación desde Excel exitosa", `Por: ${user.correo} | Stats: ${JSON.stringify(message.stats)}`);
          resolve({
            status: 200,
            data: { success: true, stats: message.stats }
          });
        }
      });

      child.on('error', (err) => {
        console.error('Error en proceso secundario de importación:', err);
        if (!finished) {
          finished = true;
          isImporting = false;
          cleanupExcel();
          const { logError } = require('../config/logger');
          logError("ERR-IMP-702", "Fallo al importar desde Excel", `Error: ${err.message} | Por: ${user.correo}`);
          resolve({
            status: 500,
            data: { error: 'Error interno durante el procesamiento del archivo Excel: ' + err.message }
          });
        }
      });

      child.on('exit', (code) => {
        if (!finished) {
          finished = true;
          isImporting = false;
          cleanupExcel();
          const { logError } = require('../config/logger');
          logError("ERR-IMP-702", "Proceso de importación Excel finalizó inesperadamente", `Código salida: ${code} | Por: ${user.correo}`);
          resolve({
            status: 500,
            data: { error: `El proceso de importación finalizó inesperadamente con código de salida ${code}.` }
          });
        }
      });
    });
  }

  // POST /api/admin/sincronizar-desde-sharepoint
  if (method === 'POST' && pathName === '/api/admin/sincronizar-desde-sharepoint') {
    if (!req.sharepointCookie) {
      return { status: 400, data: { error: 'No hay una sesión activa. Por favor, inicie sesión para poder sincronizar.' } };
    }
    if (isSyncing) {
      return { status: 409, data: { error: 'Ya hay una operación de sincronización en curso. Por favor, espere a que finalice.' } };
    }

    isSyncing = true;
    const { checkAndSyncDatabase, safeSyncAndUploadAsistencias } = require('../config/db-sync');
    return new Promise(async (resolve) => {
      try {
        const usersUpdated = await checkAndSyncDatabase(usersDb, req.sharepointCookie, 'usuarios');
        const lobbyUpdated = await checkAndSyncDatabase(db, req.sharepointCookie, 'lobby');
        const asistenciasUpdated = await safeSyncAndUploadAsistencias(asistenciasDb, req.sharepointCookie);

        const anyUpdated = usersUpdated || lobbyUpdated || asistenciasUpdated;
        const { logEvent } = require('../config/logger');
        if (lobbyUpdated) {
          appDb.get("SELECT valor FROM configuracion WHERE clave = 'db_last_update'", [], (err, row) => {
            const lastUpdate = (row && !err) ? row.valor : new Date().toLocaleString('es-CL');
            logEvent("INFO-SYNC-201", "Sincronización manual completa con SharePoint (Con cambios)", `Firma actualizada: ${lastUpdate} | Por: ${user ? user.correo : 'Usuario'}`);
          });
        } else {
          logEvent("INFO-SYNC-202", "Sincronización manual completa con SharePoint (Sin cambios)", `Por: ${user ? user.correo : 'Usuario'}`);
        }

        resolve({
          status: 200,
          data: {
            success: true,
            updated: anyUpdated,
            message: anyUpdated 
              ? 'Sincronización completada: Se descargaron y consolidaron los registros de Lobby, Usuarios y Asistencias.' 
              : 'Todas las bases de datos (Lobby, Usuarios y Asistencias) ya están al día con SharePoint.'
          }
        });
      } catch (err) {
        console.error('Error al sincronizar con SharePoint:', err);
        const { logError } = require('../config/logger');
        logError("ERR-SYNC-302", "Sincronización manual completa falló", `Error: ${err.message} | Por: ${user ? user.correo : 'Usuario'}`);
        resolve({ status: 500, data: { error: `Error al sincronizar: ${err.message}` } });
      } finally {
        isSyncing = false;
      }
    });
  }

  // POST /api/admin/sincronizar-usuarios-sharepoint
  if (method === 'POST' && pathName === '/api/admin/sincronizar-usuarios-sharepoint') {
    if (!req.sharepointCookie) {
      return { status: 400, data: { error: 'No hay una sesión activa. Por favor, inicie sesión para poder sincronizar.' } };
    }
    if (isSyncing) {
      return { status: 409, data: { error: 'Ya hay una operación de sincronización en curso. Por favor, espere a que finalice.' } };
    }

    isSyncing = true;
    const { uploadDatabaseToSharePoint } = require('../config/db-sync');
    return new Promise((resolve) => {
      uploadDatabaseToSharePoint(usersDb, req.sharepointCookie, 'usuarios')
        .then(() => {
          const { logEvent } = require('../config/logger');
          logEvent("INFO-SYNC-204", "Sincronización de usuarios a SharePoint exitosa", `Por: ${user.correo}`);
          resolve({
            status: 200,
            data: {
              success: true,
              message: 'Usuarios sincronizados con SharePoint correctamente.'
            }
          });
        })
        .catch((err) => {
          console.error('Error al subir base de datos:', err);
          const { logError } = require('../config/logger');
          logError("ERR-SYNC-303", "Sincronización de usuarios a SharePoint falló", `Error: ${err.message} | Por: ${user.correo}`);
          resolve({ status: 500, data: { error: `Error al sincronizar usuarios: ${err.message}` } });
        })
        .finally(() => {
          isSyncing = false;
        });
    });
  }

  // POST /api/admin/respaldar-asistencias-sharepoint
  if (method === 'POST' && pathName === '/api/admin/respaldar-asistencias-sharepoint') {
    if (!user || user.rol !== 'Administrador') {
      return {
        status: 403,
        data: {
          error: 'Acceso Denegado: Se requiere rol de Administrador para respaldar asistencias.',
          code: 'FORBIDDEN_ADMIN_ROLE_REQUIRED'
        }
      };
    }
    if (!req.sharepointCookie) {
      return { status: 400, data: { error: 'No hay una sesión activa con SharePoint.' } };
    }
    if (isSyncing) {
      return { status: 409, data: { error: 'Ya hay una sincronización en curso. Espera un momento.' } };
    }

    isSyncing = true;
    const { uploadDatabaseToSharePoint } = require('../config/db-sync');
    return new Promise((resolve) => {
      uploadDatabaseToSharePoint(asistenciasDb, req.sharepointCookie, 'asistencias')
        .then(() => {
          const { logEvent } = require('../config/logger');
          logEvent("INFO-SYNC-205", "Respaldo de Asistencias a SharePoint exitoso", `Por: ${user.correo}`);
          resolve({
            status: 200,
            data: {
              success: true,
              message: 'Base de Operación y Asistencias (app.db) respaldada en SharePoint correctamente.'
            }
          });
        })
        .catch((err) => {
          console.error('Error al subir asistencias:', err);
          const { logError } = require('../config/logger');
          logError("ERR-SYNC-304", "Respaldo de Asistencias a SharePoint falló", `Error: ${err.message} | Por: ${user.correo}`);
          resolve({ status: 500, data: { error: `Error al respaldar asistencias: ${err.message}` } });
        })
        .finally(() => {
          isSyncing = false;
        });
    });
  }

  // POST /api/admin/sincronizar-asistencias-sharepoint
  if (method === 'POST' && pathName === '/api/admin/sincronizar-asistencias-sharepoint') {
    if (!user || user.rol !== 'Administrador') {
      return {
        status: 403,
        data: {
          error: 'Acceso Denegado: Se requiere rol de Administrador para sincronizar asistencias.',
          code: 'FORBIDDEN_ADMIN_ROLE_REQUIRED'
        }
      };
    }
    if (!req.sharepointCookie) {
      return { status: 400, data: { error: 'No hay una sesión activa con SharePoint.' } };
    }
    if (isSyncing) {
      return { status: 409, data: { error: 'Ya hay una sincronización en curso. Espera un momento.' } };
    }

    isSyncing = true;
    const { checkAndSyncDatabase } = require('../config/db-sync');
    return new Promise((resolve) => {
      checkAndSyncDatabase(asistenciasDb, req.sharepointCookie, 'asistencias')
        .then((updated) => {
          const { logEvent } = require('../config/logger');
          logEvent("INFO-SYNC-206", `Sincronización de Asistencias desde SharePoint completada (${updated ? 'Con cambios' : 'Al día'})`, `Por: ${user.correo}`);
          resolve({
            status: 200,
            data: {
              success: true,
              updated,
              message: updated
                ? 'Sincronización completada: Nuevos registros de asistencia integrados exitosamente.'
                : 'La base de asistencias ya está actualizada con SharePoint.'
            }
          });
        })
        .catch((err) => {
          console.error('Error al sincronizar asistencias:', err);
          const { logError } = require('../config/logger');
          logError("ERR-SYNC-305", "Sincronización de Asistencias desde SharePoint falló", `Error: ${err.message} | Por: ${user.correo}`);
          resolve({ status: 500, data: { error: `Error al sincronizar asistencias: ${err.message}` } });
        })
        .finally(() => {
          isSyncing = false;
        });
    });
  }

  // GET /api/admin/historial-sincronizaciones
  if (method === 'GET' && pathName === '/api/admin/historial-sincronizaciones') {
    return new Promise((resolve) => {
      appDb.all('SELECT * FROM historial_sincronizaciones ORDER BY id DESC LIMIT 5', [], (err, rows) => {
        if (err) return resolve({ status: 500, data: { error: err.message } });
        resolve({ status: 200, data: rows });
      });
    });
  }

  // GET /api/admin/db-health
  if (method === 'GET' && pathName === '/api/admin/db-health') {
    const dbDir = db.getUserDataDir();
    const dbFile = db.getDbPath();

    let dbSize = 'No encontrado';
    try {
      const stats = fs.statSync(dbFile);
      dbSize = formatBytes(stats.size);
    } catch (e) {}

    let signatureStatus = 'No disponible';
    try {
      const localVersionPath = path.join(dbDir, 'version_lobby.json');
      if (fs.existsSync(localVersionPath)) {
        const crypto = require('crypto');
        const versionData = JSON.parse(fs.readFileSync(localVersionPath, 'utf8'));
        if (versionData.db_signature) {
          const dbBuffer = fs.readFileSync(dbFile);
          const calculatedSignature = crypto.createHmac('sha256', 'LobbyControl_Secure_Key_2026_Maipu')
            .update(dbBuffer)
            .digest('hex');
          if (calculatedSignature === versionData.db_signature) {
            signatureStatus = 'Válida';
          } else {
            signatureStatus = 'Alterada / Modificaciones no firmadas';
          }
        }
      }
    } catch (e) {
      signatureStatus = 'Error al verificar';
    }

    return new Promise((resolve) => {
      db.get('PRAGMA integrity_check', [], (err, row) => {
        const integrity = (err || !row) ? 'Error al verificar' : row.integrity_check;
        resolve({
          status: 200,
          data: { dbSize, integrity, signatureStatus }
        });
      });
    });
  }

  // GET /api/admin/backup
  if (method === 'GET' && pathName === '/api/admin/backup') {
    const dbFile = db.getDbPath();
    const targetPath = query.filePath;
    if (!targetPath) {
      return { status: 400, data: { error: 'Falta el parámetro filePath para el guardado del backup.' } };
    }

    try {
      fs.copyFileSync(dbFile, targetPath);
      const { logEvent } = require('../config/logger');
      logEvent("INFO-SYS-402", "Respaldo manual solicitado", `Archivo: ${path.basename(targetPath)} | Destino: ${targetPath} | Por: ${user.correo}`);
      return { status: 200, data: { success: true } };
    } catch (e) {
      const { logError } = require('../config/logger');
      logError("ERR-SYS-403", "Fallo al crear respaldo manual", `Destino: ${targetPath} | Error: ${e.message} | Por: ${user.correo}`);
      return { status: 500, data: { error: 'No se pudo copiar el archivo de base de datos para respaldo: ' + e.message } };
    }
  }

  // POST /api/admin/impersonate
  if (method === 'POST' && pathName === '/api/admin/impersonate') {
    const { userId } = body;
    if (!userId) return { status: 400, data: { error: 'Se requiere el parámetro userId para iniciar la simulación.' } };
    
    return new Promise((resolve) => {
      usersDb.get('SELECT * FROM usuarios WHERE id = ?', [userId], (err, dbUser) => {
        if (err) return resolve({ status: 500, data: { error: 'Error de base de datos: ' + err.message } });
        if (!dbUser) return resolve({ status: 404, data: { error: 'Usuario no encontrado en el sistema.' } });
        
        // Cargar el nombre oficial del sujeto pasivo si tiene RUT
        if (dbUser.rol === 'Sujeto Pasivo' || dbUser.rol === 'Asistente técnico') {
          const targetRut = dbUser.rol === 'Sujeto Pasivo' ? dbUser.rut : dbUser.asistido_rut;
          db.get('SELECT nombre FROM sujetos_pasivos_sph WHERE rut = ? LIMIT 1', [targetRut], (errSp, rowSp) => {
            user.simulatedUser = {
              id: dbUser.id,
              correo: dbUser.correo,
              nombre: dbUser.nombre,
              rol: dbUser.rol,
              rut: dbUser.rut || "",
              asistido_rut: dbUser.asistido_rut || "",
              sujeto_pasivo_nombre: (!errSp && rowSp && rowSp.nombre) ? rowSp.nombre : dbUser.nombre
            };
            const { logEvent } = require('../config/logger');
            logEvent("AUTH-SIM-103", "Simulación de perfil iniciada", `Administrador: ${user.correo} simulando a: ${dbUser.correo}`);
            resolve({ status: 200, data: { success: true } });
          });
        } else {
          user.simulatedUser = {
            id: dbUser.id,
            correo: dbUser.correo,
            nombre: dbUser.nombre,
            rol: dbUser.rol,
            rut: dbUser.rut || "",
            asistido_rut: dbUser.asistido_rut || "",
            sujeto_pasivo_nombre: dbUser.nombre
          };
          const { logEvent } = require('../config/logger');
          logEvent("AUTH-SIM-103", "Simulación de perfil iniciada", `Administrador: ${user.correo} simulando a: ${dbUser.correo}`);
          resolve({ status: 200, data: { success: true } });
        }
      });
    });
  }

  // POST /api/admin/impersonate/stop
  if (method === 'POST' && pathName === '/api/admin/impersonate/stop') {
    if (user && user.simulatedUser) {
      const simulatedEmail = user.simulatedUser.correo;
      user.simulatedUser = null;
      const { logEvent } = require('../config/logger');
      logEvent("AUTH-SIM-104", "Simulación de perfil finalizada", `Administrador: ${user.correo} detuvo simulación de: ${simulatedEmail}`);
    }
    return { status: 200, data: { success: true } };
  }

  // GET /api/admin/logs
  if (method === 'GET' && pathName === '/api/admin/logs') {
    if (!user || user.rol !== 'Administrador') {
      return { status: 403, data: { error: 'Acceso denegado.' } };
    }
    const fs = require('fs');
    const { logFilePath } = require('../config/logger');
    try {
      if (!fs.existsSync(logFilePath)) {
        return { status: 200, data: { entries: [] } };
      }
      const fileContent = fs.readFileSync(logFilePath, 'utf8');
      const lines = fileContent.trim().split('\n').filter(l => l.length > 0);
      const last200 = lines.slice(-200);
      // Parsear cada línea: [DD-MM-YYYY HH:MM:SS] [ERR-XXX-NNN] mensaje | Detalle: ...
      const entries = last200.map((line, idx) => {
        const match = line.match(/^\[([^\]]+)\]\s*\[([^\]]+)\]\s*(.+?)(?:\s*\|\s*Detalle:\s*(.*))?$/);
        if (match) {
          return {
            id: idx,
            timestamp: match[1],
            code: match[2],
            message: match[3].trim(),
            details: (match[4] || '').replace(/\s*\\\\\s*/g, '\n').trim()
          };
        }
        return { id: idx, timestamp: '', code: 'RAW', message: line, details: '' };
      });
      // Devolver en orden inverso (más reciente primero)
      return { status: 200, data: { entries: entries.reverse() } };
    } catch (e) {
      return { status: 500, data: { error: 'No se pudo leer la bitácora de logs: ' + e.message } };
    }
  }

  // GET /api/admin/auditoria
  if (method === 'GET' && pathName === '/api/admin/auditoria') {
    return new Promise((resolve) => {
      appDb.all('SELECT * FROM auditoria_semanal ORDER BY fecha ASC', [], (err, rows) => {
        if (err) return resolve({ status: 500, data: { error: err.message } });
        resolve({ status: 200, data: rows });
      });
    });
  }

  // GET /api/admin/auditoria/valores-actuales
  if (method === 'GET' && pathName === '/api/admin/auditoria/valores-actuales') {
    const querySol = `
      SELECT 
        SUM(CASE WHEN LOWER(estado) = 'ingresada' THEN 1 ELSE 0 END) AS ingresada,
        SUM(CASE WHEN LOWER(estado) = 'aceptada' THEN 1 ELSE 0 END) AS aceptada,
        SUM(CASE WHEN LOWER(estado) = 'rechazada' THEN 1 ELSE 0 END) AS rechazada,
        SUM(CASE WHEN LOWER(estado) = 'suspendida' THEN 1 ELSE 0 END) AS suspendida,
        SUM(CASE WHEN LOWER(estado) = 'cancelada' THEN 1 ELSE 0 END) AS cancelada,
        SUM(CASE WHEN LOWER(estado) = 'encomendada' THEN 1 ELSE 0 END) AS encomendada
      FROM solicitudes_sh
    `;

    return new Promise((resolve) => {
      db.get(querySol, [], (err, solRow) => {
        if (err) return resolve({ status: 500, data: { error: err.message } });

        db.get('SELECT COUNT(*) AS publicada FROM publicadas_ph', [], (err, pubRow) => {
          if (err) return resolve({ status: 500, data: { error: err.message } });

          resolve({
            status: 200,
            data: {
              ingresada: solRow.ingresada || 0,
              aceptada: solRow.aceptada || 0,
              rechazada: solRow.rechazada || 0,
              suspendida: solRow.suspendida || 0,
              cancelada: solRow.cancelada || 0,
              encomendada: solRow.encomendada || 0,
              publicada: pubRow.publicada || 0
            }
          });
        });
      });
    });
  }

  // POST /api/admin/auditoria
  if (method === 'POST' && pathName === '/api/admin/auditoria') {
    const { fecha, total, ingresada, aceptada, rechazada, suspendida, cancelada, encomendada, publicada } = body;
    if (!fecha) {
      return { status: 400, data: { error: 'La fecha es requerida.' } };
    }
    const query = `
      INSERT INTO auditoria_semanal (fecha, total, ingresada, aceptada, rechazada, suspendida, cancelada, encomendada, publicada, usuario, estado)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'En Proceso')
    `;
    const usuario = user.nombre || user.correo;
    return new Promise((resolve) => {
      appDb.run(query, [fecha, total || 0, ingresada || 0, aceptada || 0, rechazada || 0, suspendida || 0, cancelada || 0, encomendada || 0, publicada || 0, usuario], async function(err) {
        if (err) return resolve({ status: 500, data: { error: err.message } });
        await appDb.recalculateAndSignDatabase();
        if (req.sharepointCookie) {
          const { uploadDatabaseToSharePoint } = require('../config/db-sync');
          uploadDatabaseToSharePoint(appDb, req.sharepointCookie, 'app').catch(e => {
            console.error('Error al subir base de datos app a SharePoint:', e.message);
          });
        }
        resolve({ status: 201, data: { id: this.lastID, message: 'Registro de auditoría guardado y sincronizado en SharePoint exitosamente.' } });
      });
    });
  }

  // PUT /api/admin/auditoria/:id
  const auditMatch = pathName.match(/^\/api\/admin\/auditoria\/(\d+)$/);
  if (method === 'PUT' && auditMatch) {
    const id = auditMatch[1];
    const { fecha, total, ingresada, aceptada, rechazada, suspendida, cancelada, encomendada, publicada, estado } = body;
    if (!fecha) {
      return { status: 400, data: { error: 'La fecha es requerida.' } };
    }
    const query = `
      UPDATE auditoria_semanal
      SET fecha = ?, total = ?, ingresada = ?, aceptada = ?, rechazada = ?, suspendida = ?, cancelada = ?, encomendada = ?, publicada = ?, estado = COALESCE(?, estado)
      WHERE id = ?
    `;
    return new Promise((resolve) => {
      appDb.run(query, [fecha, total || 0, ingresada || 0, aceptada || 0, rechazada || 0, suspendida || 0, cancelada || 0, encomendada || 0, publicada || 0, estado || null, id], async function(err) {
        if (err) return resolve({ status: 500, data: { error: err.message } });
        if (this.changes === 0) return resolve({ status: 404, data: { error: 'Registro no encontrado.' } });
        await appDb.recalculateAndSignDatabase();
        if (req.sharepointCookie) {
          const { uploadDatabaseToSharePoint } = require('../config/db-sync');
          uploadDatabaseToSharePoint(appDb, req.sharepointCookie, 'app').catch(e => {
            console.error('Error al subir base de datos app a SharePoint:', e.message);
          });
        }
        resolve({ status: 200, data: { message: 'Registro de auditoría actualizado y sincronizado en SharePoint exitosamente.' } });
      });
    });
  }

  // DELETE /api/admin/auditoria/:id
  if (method === 'DELETE' && auditMatch) {
    const id = auditMatch[1];
    return new Promise((resolve) => {
      appDb.run('DELETE FROM auditoria_semanal WHERE id = ?', id, async function(err) {
        if (err) return resolve({ status: 500, data: { error: err.message } });
        if (this.changes === 0) return resolve({ status: 404, data: { error: 'Registro no encontrado.' } });
        await appDb.recalculateAndSignDatabase();
        if (req.sharepointCookie) {
          const { uploadDatabaseToSharePoint } = require('../config/db-sync');
          uploadDatabaseToSharePoint(appDb, req.sharepointCookie, 'app').catch(e => {
            console.error('Error al subir base de datos app a SharePoint:', e.message);
          });
        }
        resolve({ status: 200, data: { message: 'Registro de auditoría eliminado y sincronizado en SharePoint exitosamente.' } });
      });
    });
  }

  // ==========================================
  // RUTAS: BITÁCORA DE ASISTENCIAS Y CONTACTOS (SOLO ADMINISTRADOR)
  // ==========================================
  if (pathName.startsWith('/api/asistencias')) {
    if (!user || user.rol !== 'Administrador') {
      return {
        status: 403,
        data: {
          error: 'Acceso Denegado: Se requiere rol de Administrador para gestionar o consultar asistencias técnicas.',
          code: 'FORBIDDEN_ADMIN_ROLE_REQUIRED'
        }
      };
    }
  }

  // GET /api/asistencias/contactos/sugerencias?q=...
  if (method === 'GET' && pathName === '/api/asistencias/contactos/sugerencias') {
    const q = (query.q || '').trim();
    if (q.length < 2) {
      return { status: 200, data: [] };
    }
    const searchVal = `%${q}%`;
    return new Promise((resolve) => {
      asistenciasDb.all(`
        SELECT id, nombre, direccion, correo, telefono
        FROM contactos_asistencia
        WHERE activo = 1 AND (nombre LIKE ? COLLATE NOCASE OR direccion LIKE ? COLLATE NOCASE)
        ORDER BY nombre ASC
        LIMIT 10
      `, [searchVal, searchVal], (err, rows) => {
        if (err) return resolve({ status: 500, data: { error: err.message } });
        resolve({ status: 200, data: rows || [] });
      });
    });
  }

  // GET /api/asistencias/contactos
  if (method === 'GET' && pathName === '/api/asistencias/contactos') {
    const search = (query.search || '').trim();
    return new Promise((resolve) => {
      let sql = `
        SELECT c.*,
          (SELECT COUNT(*) FROM bitacora_asistencias b WHERE b.contacto_id = c.id) AS total_asistencias,
          (SELECT MAX(b.fecha_hora) FROM bitacora_asistencias b WHERE b.contacto_id = c.id) AS ultima_asistencia
        FROM contactos_asistencia c
        WHERE c.activo = 1
      `;
      let params = [];
      if (search) {
        sql += ` AND (c.nombre LIKE ? COLLATE NOCASE OR c.direccion LIKE ? COLLATE NOCASE OR c.correo LIKE ? COLLATE NOCASE)`;
        const sVal = `%${search}%`;
        params.push(sVal, sVal, sVal);
      }
      sql += ` ORDER BY c.nombre ASC`;
      asistenciasDb.all(sql, params, (err, rows) => {
        if (err) return resolve({ status: 500, data: { error: err.message } });
        resolve({ status: 200, data: rows || [] });
      });
    });
  }

  // POST /api/asistencias/contactos (Con diferenciación determinista de homónimos)
  if (method === 'POST' && pathName === '/api/asistencias/contactos') {
    const { nombre, direccion, depto_habitual, correo, telefono, telefono_anexo, notas } = body;
    if (!nombre || !nombre.trim()) {
      return { status: 400, data: { error: 'El nombre del contacto es obligatorio.' } };
    }
    const inputDireccion = direccion !== undefined ? direccion : depto_habitual;
    const inputTelefono = telefono !== undefined ? telefono : telefono_anexo;
    const { cleanName, cleanDireccion, cleanEmail, cleanPhone } = sanitizeContactData(nombre, inputDireccion, correo, inputTelefono);
    const crypto = require('crypto');
    const contactUuid = crypto.randomUUID();

    return new Promise((resolve) => {
      // 1. Verificar si existe un contacto inactivo con coincidencia positiva de identidad
      asistenciasDb.get(
        "SELECT id, uuid, correo, direccion FROM contactos_asistencia WHERE nombre = ? COLLATE NOCASE AND activo = 0 ORDER BY updated_at DESC, id DESC LIMIT 1",
        [cleanName],
        (fErr, inactiveContact) => {
          if (!fErr && inactiveContact) {
            const sameEmail = cleanEmail && inactiveContact.correo && cleanEmail.toLowerCase() === inactiveContact.correo.toLowerCase();
            const sameDireccion = cleanDireccion && inactiveContact.direccion && cleanDireccion.toLowerCase() === inactiveContact.direccion.toLowerCase();

            if (sameEmail || sameDireccion) {
              // Reactivación selectiva actualizando nombre, datos y fecha
              return asistenciasDb.run(`
                UPDATE contactos_asistencia
                SET nombre = ?, direccion = ?, correo = ?, telefono = ?, notas = ?, activo = 1, updated_at = datetime('now', 'localtime')
                WHERE id = ?
              `, [cleanName, cleanDireccion, cleanEmail, cleanPhone, notas || '', inactiveContact.id], function(uErr) {
                if (uErr) return resolve({ status: 500, data: { error: uErr.message } });
                resolve({
                  status: 200,
                  data: {
                    id: inactiveContact.id,
                    uuid: inactiveContact.uuid,
                    nombre: cleanName,
                    direccion: cleanDireccion,
                    correo: cleanEmail,
                    telefono: cleanPhone,
                    reactivado: true
                  }
                });
              });
            }
          }

          // 2. Si no hay coincidencia positiva previa o es un homónimo nuevo: INSERT con UUID nuevo
          asistenciasDb.run(`
            INSERT INTO contactos_asistencia (uuid, nombre, direccion, correo, telefono, notas, activo)
            VALUES (?, ?, ?, ?, ?, ?, 1)
          `, [contactUuid, cleanName, cleanDireccion, cleanEmail, cleanPhone, notas || ''], function(err) {
            if (err) return resolve({ status: 500, data: { error: err.message } });
            resolve({
              status: 201,
              data: {
                id: this.lastID,
                uuid: contactUuid,
                nombre: cleanName,
                direccion: cleanDireccion,
                correo: cleanEmail,
                telefono: cleanPhone
              }
            });
          });
        }
      );
    });
  }

  // PUT /api/asistencias/contactos/:id
  const contactoMatch = pathName.match(/^\/api\/asistencias\/contactos\/(\d+)$/);
  if (method === 'PUT' && contactoMatch) {
    const id = parseInt(contactoMatch[1], 10);
    const { nombre, direccion, depto_habitual, correo, telefono, telefono_anexo, notas } = body;
    if (!nombre || !nombre.trim()) {
      return { status: 400, data: { error: 'El nombre del contacto es obligatorio.' } };
    }
    const inputDireccion = direccion !== undefined ? direccion : depto_habitual;
    const inputTelefono = telefono !== undefined ? telefono : telefono_anexo;
    const { cleanName, cleanDireccion, cleanEmail, cleanPhone } = sanitizeContactData(nombre, inputDireccion, correo, inputTelefono);
    return new Promise((resolve) => {
      asistenciasDb.run(`
        UPDATE contactos_asistencia
        SET nombre = ?, direccion = ?, correo = ?, telefono = ?, notas = ?, updated_at = datetime('now', 'localtime')
        WHERE id = ?
      `, [cleanName, cleanDireccion, cleanEmail, cleanPhone, notas || '', id], function(err) {
        if (err) return resolve({ status: 500, data: { error: err.message } });
        if (this.changes === 0) return resolve({ status: 404, data: { error: 'Contacto no encontrado.' } });
        resolve({ status: 200, data: { id, nombre: cleanName, direccion: cleanDireccion, correo: cleanEmail, telefono: cleanPhone } });
      });
    });
  }

  // DELETE /api/asistencias/contactos/:id (Eliminación con lápida digital y desvinculación segura)
  if (method === 'DELETE' && contactoMatch) {
    const id = parseInt(contactoMatch[1], 10);
    return new Promise((resolve) => {
      asistenciasDb.get("SELECT id, uuid, nombre FROM contactos_asistencia WHERE id = ?", [id], (gErr, row) => {
        if (gErr) return resolve({ status: 500, data: { error: gErr.message } });
        if (!row) return resolve({ status: 404, data: { error: 'Contacto no encontrado.' } });

        asistenciasDb.serialize(() => {
          asistenciasDb.run("BEGIN IMMEDIATE TRANSACTION", (bErr) => {
            if (bErr) return resolve({ status: 500, data: { error: bErr.message } });

            // 1. Desvincular punteros relacionales sin alterar updated_at de tickets históricos
            asistenciasDb.run(`
              UPDATE bitacora_asistencias
              SET contacto_id = NULL, contacto_uuid = NULL
              WHERE contacto_id = ? OR (contacto_uuid IS NOT NULL AND contacto_uuid = ?)
            `, [row.id, row.uuid || ''], (uErr) => {
              if (uErr) {
                asistenciasDb.run("ROLLBACK");
                return resolve({ status: 500, data: { error: uErr.message } });
              }

              // 2. Aplicar lápida digital al contacto
              asistenciasDb.run(`
                UPDATE contactos_asistencia
                SET activo = 0, updated_at = datetime('now', 'localtime')
                WHERE id = ?
              `, [row.id], function(dErr) {
                if (dErr) {
                  asistenciasDb.run("ROLLBACK");
                  return resolve({ status: 500, data: { error: dErr.message } });
                }

                asistenciasDb.run("COMMIT", (cErr) => {
                  if (cErr) return resolve({ status: 500, data: { error: cErr.message } });

                  // 3. Respuesta inmediata HTTP 200 (Offline-first)
                  resolve({
                    status: 200,
                    data: {
                      message: `Contacto '${row.nombre}' eliminado del directorio exitosamente. Sus atenciones históricas se conservan intactas.`,
                      id: row.id
                    }
                  });

                  // 4. Sincronización en segundo plano con SharePoint
                  if (req.sharepointCookie) {
                    const { safeSyncAndUploadAsistencias } = require('../config/db-sync');
                    safeSyncAndUploadAsistencias(asistenciasDb, req.sharepointCookie).catch((sErr) => {
                      console.warn('[Sync-Contactos] Subida de lápida digital a SharePoint pendiente para próximo ciclo:', sErr.message);
                    });
                  }
                });
              });
            });
          });
        });
      });
    });
  }

  // POST /api/asistencias/contactos/unificar (Merge de contactos duplicados con lápida digital y parámetros dinámicos)
  if (method === 'POST' && pathName === '/api/asistencias/contactos/unificar') {
    const { target_id, target_uuid, source_ids, source_uuids } = body;
    
    return new Promise((resolve) => {
      asistenciasDb.get(
        "SELECT id, uuid, nombre, direccion, correo, telefono FROM contactos_asistencia WHERE id = ? OR (uuid IS NOT NULL AND uuid = ?)",
        [parseInt(target_id, 10) || null, target_uuid || null],
        (tErr, targetContact) => {
          if (tErr) return resolve({ status: 500, data: { error: tErr.message } });
          if (!targetContact) return resolve({ status: 404, data: { error: 'Contacto principal no encontrado.' } });

          const cleanTargetId = targetContact.id;
          const cleanTargetUuid = targetContact.uuid;

          const sIds = Array.isArray(source_ids) ? source_ids.map(s => parseInt(s, 10)).filter(s => s && s !== cleanTargetId) : [];
          const sUuids = Array.isArray(source_uuids) ? source_uuids.filter(u => u && u !== cleanTargetUuid) : [];

          if (sIds.length === 0 && sUuids.length === 0) {
            return resolve({ status: 400, data: { error: 'Debes seleccionar al menos un contacto duplicado diferente del principal.' } });
          }

          asistenciasDb.serialize(() => {
            asistenciasDb.run("BEGIN IMMEDIATE TRANSACTION", (bErr) => {
              if (bErr) return resolve({ status: 500, data: { error: bErr.message } });

              // Función modular para marcar lápidas en contactos absorbidos
              const executeTombstones = () => {
                const uWhere = [];
                const uParams = [];
                if (sIds.length > 0) {
                  uWhere.push(`id IN (${sIds.map(() => '?').join(',')})`);
                  uParams.push(...sIds);
                }
                if (sUuids.length > 0) {
                  uWhere.push(`uuid IN (${sUuids.map(() => '?').join(',')})`);
                  uParams.push(...sUuids);
                }

                const commitAndFinish = () => {
                  // Actualizar timestamp en contacto principal para propagar cambios
                  asistenciasDb.run(`
                    UPDATE contactos_asistencia
                    SET activo = 1, updated_at = datetime('now', 'localtime')
                    WHERE id = ?
                  `, [cleanTargetId], () => {
                    asistenciasDb.run("COMMIT", (cErr) => {
                      if (cErr) return resolve({ status: 500, data: { error: cErr.message } });
                      resolve({
                        status: 200,
                        data: {
                          message: `Fusión completada con éxito. Se unificaron los registros en '${targetContact.nombre}'.`,
                          target_id: cleanTargetId,
                          target_uuid: cleanTargetUuid,
                          merged_count: sIds.length || sUuids.length
                        }
                      });

                      if (req.sharepointCookie) {
                        const { safeSyncAndUploadAsistencias } = require('../config/db-sync');
                        safeSyncAndUploadAsistencias(asistenciasDb, req.sharepointCookie).catch((sErr) => {
                          console.warn('[Sync-Merge] Subida de unificación a SharePoint pendiente:', sErr.message);
                        });
                      }
                    });
                  });
                };

                // Guarda defensiva si uWhere está vacío
                if (uWhere.length === 0) {
                  return commitAndFinish();
                }

                asistenciasDb.run(`
                  UPDATE contactos_asistencia
                  SET activo = 0, updated_at = datetime('now', 'localtime')
                  WHERE ${uWhere.join(' OR ')}
                `, uParams, function(dErr) {
                  if (dErr) {
                    asistenciasDb.run("ROLLBACK");
                    return resolve({ status: 500, data: { error: dErr.message } });
                  }
                  commitAndFinish();
                });
              };

              // Reasignación de bitácoras si hay condiciones válidas
              const bWhere = [];
              const bWhereParams = [];
              if (sIds.length > 0) {
                bWhere.push(`contacto_id IN (${sIds.map(() => '?').join(',')})`);
                bWhereParams.push(...sIds);
              }
              if (sUuids.length > 0) {
                bWhere.push(`contacto_uuid IN (${sUuids.map(() => '?').join(',')})`);
                bWhereParams.push(...sUuids);
              }

              if (bWhere.length > 0) {
                asistenciasDb.run(`
                  UPDATE bitacora_asistencias
                  SET contacto_id = ?, contacto_uuid = ?, updated_at = datetime('now', 'localtime')
                  WHERE ${bWhere.join(' OR ')}
                `, [cleanTargetId, cleanTargetUuid, ...bWhereParams], (uErr) => {
                  if (uErr) {
                    asistenciasDb.run("ROLLBACK");
                    return resolve({ status: 500, data: { error: uErr.message } });
                  }
                  executeTombstones();
                });
              } else {
                executeTombstones();
              }
            });
          });
        }
      );
    });
  }

  // GET /api/asistencias/stats (Métricas KPI, Distribución por Dirección y Evolución Temporal Completa)
  if (method === 'GET' && pathName === '/api/asistencias/stats') {
    return new Promise((resolve) => {
      const now = new Date();
      const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      
      const qTotalMes = `SELECT COUNT(*) AS total FROM bitacora_asistencias WHERE strftime('%Y-%m', fecha_hora) = ?`;
      const qTotalGeneral = `SELECT COUNT(*) AS total_general FROM bitacora_asistencias`;
      const qTotalResueltas = `SELECT COUNT(*) AS total_resueltas FROM bitacora_asistencias WHERE estado = 'resuelta'`;
      const qSeguimiento = `SELECT COUNT(*) AS total_pend FROM bitacora_asistencias WHERE estado != 'resuelta'`;
      const qTopDepto = `SELECT COALESCE(NULLIF(TRIM(solicitante_direccion), ''), 'General') AS depto, COUNT(*) AS count FROM bitacora_asistencias GROUP BY depto ORDER BY count DESC LIMIT 10`;
      const qTotalContactos = `SELECT COUNT(*) AS total_contactos FROM contactos_asistencia`;
      const qFechas = `SELECT fecha_hora FROM bitacora_asistencias WHERE fecha_hora IS NOT NULL ORDER BY fecha_hora ASC`;

      asistenciasDb.get(qTotalMes, [currentYearMonth], (err, rTotal) => {
        if (err) return resolve({ status: 500, data: { error: err.message } });
        asistenciasDb.get(qTotalGeneral, [], (err, rGen) => {
          if (err) return resolve({ status: 500, data: { error: err.message } });
          asistenciasDb.get(qTotalResueltas, [], (err, rRes) => {
            if (err) return resolve({ status: 500, data: { error: err.message } });
            asistenciasDb.get(qSeguimiento, [], (err, rPend) => {
              if (err) return resolve({ status: 500, data: { error: err.message } });
              asistenciasDb.all(qTopDepto, [], (err, rDeptos) => {
                if (err) return resolve({ status: 500, data: { error: err.message } });
                asistenciasDb.get(qTotalContactos, [], (err, rCont) => {
                  if (err) return resolve({ status: 500, data: { error: err.message } });
                  asistenciasDb.all(qFechas, [], (err, rFechas) => {
                    if (err) return resolve({ status: 500, data: { error: err.message } });
                    
                    const totalMes = rTotal ? rTotal.total : 0;
                    const totalGeneral = rGen ? rGen.total_general : 0;
                    const totalResueltas = rRes ? rRes.total_resueltas : 0;
                    const tasaResolucion = totalGeneral > 0 ? Math.round((totalResueltas / totalGeneral) * 100) : 100;
                    const deptosList = Array.isArray(rDeptos) ? rDeptos : [];
                    const topDireccion = deptosList.length > 0 ? `${deptosList[0].depto} (${deptosList[0].count})` : 'Sin registros';
                    const fechasList = Array.isArray(rFechas) ? rFechas.map(f => f.fecha_hora) : [];

                    resolve({
                      status: 200,
                      data: {
                        total_mes: totalMes,
                        total_general: totalGeneral,
                        total_resueltas: totalResueltas,
                        tasa_resolucion: tasaResolucion,
                        en_seguimiento: rPend ? rPend.total_pend : 0,
                        top_direccion: topDireccion,
                        por_direccion: deptosList,
                        fechas: fechasList,
                        total_contactos: rCont ? rCont.total_contactos : 0
                      }
                    });
                  });
                });
              });
            });
          });
        });
      });
    });
  }

  // GET /api/asistencias (Listado filtrable y paginado)
  if (method === 'GET' && pathName === '/api/asistencias') {
    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const limit = Math.max(1, Math.min(200, parseInt(query.limit, 10) || 50));
    const offset = (page - 1) * limit;
    const search = (query.search || '').trim();
    const canal = (query.canal || '').trim();
    const categoria = (query.categoria || '').trim();
    const estado = (query.estado || '').trim();
    const fechaInicio = (query.fecha_inicio || '').trim();
    const fechaFin = (query.fecha_fin || '').trim();
    const contactoId = parseInt(query.contacto_id, 10);

    let where = [];
    let params = [];

    if (search) {
      where.push(`(b.ticket_codigo LIKE ? OR b.solicitante_nombre LIKE ? COLLATE NOCASE OR b.solicitante_direccion LIKE ? COLLATE NOCASE OR b.representado LIKE ? COLLATE NOCASE OR b.motivo_consulta LIKE ? COLLATE NOCASE OR b.solucion_orientacion LIKE ? COLLATE NOCASE OR b.folio_lobby LIKE ?)`);
      const sVal = `%${search}%`;
      params.push(sVal, sVal, sVal, sVal, sVal, sVal, sVal);
    }
    if (canal && canal !== 'todos') {
      where.push(`b.canal = ?`);
      params.push(canal);
    }
    if (categoria && categoria !== 'todas') {
      where.push(`b.categoria = ?`);
      params.push(categoria);
    }
    if (estado && estado !== 'todos') {
      where.push(`b.estado = ?`);
      params.push(estado);
    }
    if (fechaInicio) {
      where.push(`date(b.fecha_hora) >= date(?)`);
      params.push(fechaInicio);
    }
    if (fechaFin) {
      where.push(`date(b.fecha_hora) <= date(?)`);
      params.push(fechaFin);
    }
    if (contactoId) {
      where.push(`b.contacto_id = ?`);
      params.push(contactoId);
    }

    const whereClause = where.length > 0 ? ` WHERE ` + where.join(' AND ') : '';

    return new Promise((resolve) => {
      const countSql = `SELECT COUNT(*) AS total FROM bitacora_asistencias b ${whereClause}`;
      asistenciasDb.get(countSql, params, (err, countRow) => {
        if (err) return resolve({ status: 500, data: { error: err.message } });
        const total = countRow ? countRow.total : 0;

        const dataSql = `
          SELECT b.*, c.nombre AS contacto_nombre_canonico, c.correo AS contacto_correo_canonico, c.telefono AS contacto_telefono_canonico
          FROM bitacora_asistencias b
          LEFT JOIN contactos_asistencia c ON b.contacto_id = c.id
          ${whereClause}
          ORDER BY b.fecha_hora DESC, b.id DESC
          LIMIT ? OFFSET ?
        `;
        asistenciasDb.all(dataSql, [...params, limit, offset], (err, rows) => {
          if (err) return resolve({ status: 500, data: { error: err.message } });
            resolve({
              status: 200,
              data: {
                rows: rows || [],
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit) || 1,
                total_pages: Math.ceil(total / limit) || 1
              }
            });
        });
      });
    });
  }

  // POST /api/asistencias (Crear nueva atención)
  if (method === 'POST' && pathName === '/api/asistencias') {
    const {
      solicitante_nombre,
      solicitante_direccion,
      solicitante_cargo_depto,
      solicitante_correo,
      solicitante_telefono,
      solicitante_contacto,
      representado,
      representado_id_lobby,
      canal,
      categoria,
      folio_lobby,
      motivo_consulta,
      solucion_orientacion,
      estado,
      contacto_id,
      creado_por,
      fecha_hora
    } = body;

    const inputDireccion = (solicitante_direccion !== undefined ? solicitante_direccion : solicitante_cargo_depto) || '';
    const inputTelefono = (solicitante_telefono !== undefined ? solicitante_telefono : solicitante_contacto) || '';
    const rep = (representado && typeof representado === 'string' && representado.trim()) ? representado.trim() : null;
    const repId = (representado_id_lobby !== undefined && representado_id_lobby !== null && !isNaN(representado_id_lobby)) ? parseInt(representado_id_lobby, 10) : null;

    if (!fecha_hora || !fecha_hora.trim()) {
      return { status: 400, data: { error: 'La fecha y hora de la atención es obligatoria.' } };
    }
    if (!canal || !canal.trim()) {
      return { status: 400, data: { error: 'El canal de contacto es obligatorio.' } };
    }
    if (!solicitante_nombre || !solicitante_nombre.trim()) {
      return { status: 400, data: { error: 'El nombre del solicitante es obligatorio.' } };
    }
    if (!inputDireccion || !inputDireccion.trim()) {
      return { status: 400, data: { error: 'La dirección municipal del solicitante es obligatoria.' } };
    }
    if (!solicitante_correo || !solicitante_correo.trim()) {
      return { status: 400, data: { error: 'El correo electrónico del solicitante es obligatorio.' } };
    }
    if (!inputTelefono || !inputTelefono.trim()) {
      return { status: 400, data: { error: 'El teléfono de contacto es obligatorio.' } };
    }
    if (!categoria || !categoria.trim()) {
      return { status: 400, data: { error: 'Debes seleccionar una categoría para la asistencia.' } };
    }
    if (!motivo_consulta || !motivo_consulta.trim()) {
      return { status: 400, data: { error: 'El motivo de la consulta es obligatorio.' } };
    }
    if (!solucion_orientacion || !solucion_orientacion.trim()) {
      return { status: 400, data: { error: 'La orientación o solución entregada es obligatoria.' } };
    }

    const { cleanName, cleanDireccion, cleanEmail, cleanPhone } = sanitizeContactData(
      solicitante_nombre, inputDireccion, solicitante_correo, inputTelefono
    );

    const currentUserEmail = (user && user.correo) || creado_por || 'admin@maipu.cl';

    return new Promise((resolve) => {
      asistenciasDb.serialize(() => {
        asistenciasDb.run("BEGIN IMMEDIATE TRANSACTION", (bErr) => {
          if (bErr) return resolve({ status: 500, data: { error: bErr.message } });

          // 1. Calcular folio correlativo anual particionado por operador AST{YY}{OP}-{NNN} (ej. AST26AB-001)
          const targetYear = fecha_hora ? new Date(fecha_hora.replace(' ', 'T')).getFullYear() : new Date().getFullYear();
          const yy = String(isNaN(targetYear) ? new Date().getFullYear() : targetYear).slice(-2);

          let opInitials = 'AB';
          if (user && user.nombre) {
            const nameParts = user.nombre.trim().split(/\s+/);
            if (nameParts.length >= 2) {
              opInitials = (nameParts[0][0] + nameParts[1][0]).toUpperCase();
            } else if (nameParts.length === 1 && nameParts[0].length >= 2) {
              opInitials = nameParts[0].slice(0, 2).toUpperCase();
            }
          } else if (currentUserEmail) {
            const rawUser = currentUserEmail.split('@')[0].replace(/[^a-zA-Z]/g, '');
            if (rawUser.length >= 2) {
              opInitials = rawUser.slice(0, 2).toUpperCase();
            }
          }
          const opPrefix = `AST${yy}${opInitials}-`;

          asistenciasDb.get(
            `SELECT MAX(CAST(SUBSTR(ticket_codigo, ?) AS INTEGER)) AS max_num FROM bitacora_asistencias WHERE ticket_codigo LIKE ?`,
            [opPrefix.length + 1, `${opPrefix}%`],
            (tErr, maxRow) => {
              if (tErr) {
                asistenciasDb.run("ROLLBACK");
                return resolve({ status: 500, data: { error: tErr.message } });
              }

              const nextNum = ((maxRow && maxRow.max_num) ? maxRow.max_num : 0) + 1;
              const ticketCodigo = `${opPrefix}${String(nextNum).padStart(3, '0')}`;

              // 2. Gestionar contacto en contactos_asistencia
              const crypto = require('crypto');
              const proceedWithInsert = (resolvedContactId, resolvedContactUuid) => {
                const ticketUuid = crypto.randomUUID();
                const nowUtc = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
                asistenciasDb.run(`
                  INSERT INTO bitacora_asistencias (
                    uuid, ticket_codigo, contacto_id, contacto_uuid, fecha_hora, canal, solicitante_nombre, solicitante_direccion,
                    solicitante_correo, solicitante_telefono, categoria, folio_lobby,
                    motivo_consulta, solucion_orientacion, estado, representado, representado_id_lobby, creado_por, created_at, updated_at
                  ) VALUES (?, ?, ?, ?, COALESCE(?, ?), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, [
                  ticketUuid,
                  ticketCodigo,
                  resolvedContactId,
                  resolvedContactUuid,
                  fecha_hora ? fecha_hora.trim() : null,
                  nowUtc,
                  canal || 'telefono',
                  cleanName,
                  cleanDireccion,
                  cleanEmail,
                  cleanPhone,
                  categoria,
                  (folio_lobby || '').trim() || null,
                  motivo_consulta.trim(),
                  (solucion_orientacion || '').trim(),
                  estado || 'resuelta',
                  rep,
                  repId,
                  currentUserEmail,
                  nowUtc,
                  nowUtc
                ], function(insErr) {
                  if (insErr) {
                    asistenciasDb.run("ROLLBACK");
                    return resolve({ status: 500, data: { error: insErr.message } });
                  }
                  const newId = this.lastID;
                  asistenciasDb.run("COMMIT", (cErr) => {
                    if (cErr) return resolve({ status: 500, data: { error: cErr.message } });
                    resolve({
                      status: 201,
                      data: {
                        id: newId,
                        uuid: ticketUuid,
                        ticket_codigo: ticketCodigo,
                        contacto_id: resolvedContactId,
                        contacto_uuid: resolvedContactUuid,
                        solicitante_nombre: cleanName,
                        solicitante_direccion: cleanDireccion,
                        solicitante_cargo_depto: cleanDireccion,
                        solicitante_correo: cleanEmail,
                        solicitante_telefono: cleanPhone,
                        solicitante_contacto: cleanPhone,
                        representado: rep,
                        representado_id_lobby: repId,
                        fecha_hora: nowUtc,
                        message: `Asistencia ${ticketCodigo} guardada correctamente.`
                      }
                    });
                  });
                });
              };

              if (contacto_id) {
                const cId = parseInt(contacto_id, 10);
                asistenciasDb.get("SELECT uuid FROM contactos_asistencia WHERE id = ?", [cId], (uErr, cRow) => {
                  const cUuid = (cRow && cRow.uuid) ? cRow.uuid : null;
                  proceedWithInsert(cId, cUuid);
                });
              } else {
                asistenciasDb.get("SELECT id, uuid, direccion, correo, telefono FROM contactos_asistencia WHERE nombre = ? COLLATE NOCASE", [cleanName], (cErr, contactRow) => {
                  if (cErr) {
                    asistenciasDb.run("ROLLBACK");
                    return resolve({ status: 500, data: { error: cErr.message } });
                  }
                  if (contactRow) {
                    const updatedDir = contactRow.direccion || cleanDireccion;
                    const updatedEmail = cleanEmail || contactRow.correo;
                    const updatedPhone = cleanPhone || contactRow.telefono;
                    const currentUuid = contactRow.uuid || crypto.randomUUID();
                    asistenciasDb.run(
                      "UPDATE contactos_asistencia SET uuid = ?, direccion = ?, correo = ?, telefono = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ?",
                      [currentUuid, updatedDir, updatedEmail, updatedPhone, contactRow.id],
                      () => proceedWithInsert(contactRow.id, currentUuid)
                    );
                  } else if (cleanName) {
                    const newContactUuid = crypto.randomUUID();
                    asistenciasDb.run(
                      "INSERT INTO contactos_asistencia (uuid, nombre, direccion, correo, telefono, created_at, updated_at) VALUES (?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'), strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))",
                      [newContactUuid, cleanName, cleanDireccion, cleanEmail, cleanPhone],
                      function(nErr) {
                        if (nErr) {
                          asistenciasDb.run("ROLLBACK");
                          return resolve({ status: 500, data: { error: nErr.message } });
                        }
                        proceedWithInsert(this.lastID, newContactUuid);
                      }
                    );
                  } else {
                    proceedWithInsert(null, null);
                  }
                });
              }
            }
          );
        });
      });
    });
  }

  // GET /api/asistencias/:id
  const asistenciaMatch = pathName.match(/^\/api\/asistencias\/(\d+)$/);
  if (method === 'GET' && asistenciaMatch) {
    const id = parseInt(asistenciaMatch[1], 10);
    return new Promise((resolve) => {
      asistenciasDb.get(`
        SELECT b.*, c.nombre AS contacto_nombre_canonico, c.correo AS contacto_correo_canonico, c.telefono AS contacto_telefono_canonico
        FROM bitacora_asistencias b
        LEFT JOIN contactos_asistencia c ON b.contacto_id = c.id
        WHERE b.id = ?
      `, [id], (err, row) => {
        if (err) return resolve({ status: 500, data: { error: err.message } });
        if (!row) return resolve({ status: 404, data: { error: 'Registro de asistencia no encontrado.' } });
        resolve({ status: 200, data: row });
      });
    });
  }

  // PUT /api/asistencias/:id
  if (method === 'PUT' && asistenciaMatch) {
    const id = parseInt(asistenciaMatch[1], 10);
    const {
      solicitante_direccion,
      solicitante_cargo_depto,
      solicitante_correo,
      solicitante_telefono,
      solicitante_contacto,
      representado,
      representado_id_lobby,
      categoria,
      folio_lobby,
      motivo_consulta,
      solucion_orientacion,
      estado,
      updated_by,
      fecha_hora
    } = body;

    const inputDireccion = solicitante_direccion !== undefined ? solicitante_direccion : solicitante_cargo_depto;
    const inputTelefono = solicitante_telefono !== undefined ? solicitante_telefono : solicitante_contacto;
    const rep = (representado && typeof representado === 'string' && representado.trim()) ? representado.trim() : null;
    const repId = (representado_id_lobby !== undefined && representado_id_lobby !== null && !isNaN(representado_id_lobby)) ? parseInt(representado_id_lobby, 10) : null;

    const currentUserEmail = (user && user.correo) || updated_by || 'admin@maipu.cl';

    return new Promise((resolve) => {
      asistenciasDb.get("SELECT * FROM bitacora_asistencias WHERE id = ?", [id], (err, current) => {
        if (err) return resolve({ status: 500, data: { error: err.message } });
        if (!current) return resolve({ status: 404, data: { error: 'Registro de asistencia no encontrado.' } });

        // Regla de inmutabilidad (24 horas): si pasaron más de 24h, no se permite cambiar motivo ni solicitante original
        const createdAt = new Date(current.created_at.replace(' ', 'T') + 'Z');
        const diffHours = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60);
        const isProtected = diffHours > 24;

        if (fecha_hora !== undefined && !fecha_hora.trim()) {
          return resolve({ status: 400, data: { error: 'La fecha y hora de la atención es obligatoria.' } });
        }
        if (inputDireccion !== undefined && !inputDireccion.trim()) {
          return resolve({ status: 400, data: { error: 'La dirección municipal no puede estar vacía.' } });
        }
        if (solicitante_correo !== undefined && !solicitante_correo.trim()) {
          return resolve({ status: 400, data: { error: 'El correo electrónico no puede estar vacío.' } });
        }
        if (inputTelefono !== undefined && !inputTelefono.trim()) {
          return resolve({ status: 400, data: { error: 'El teléfono de contacto no puede estar vacío.' } });
        }
        if (motivo_consulta !== undefined && !motivo_consulta.trim()) {
          return resolve({ status: 400, data: { error: 'El motivo de la consulta no puede estar vacío.' } });
        }
        if (solucion_orientacion !== undefined && !solucion_orientacion.trim()) {
          return resolve({ status: 400, data: { error: 'La orientación o solución entregada no puede estar vacía.' } });
        }

        const finalFechaHora = (fecha_hora && fecha_hora.trim()) ? fecha_hora.trim() : current.fecha_hora;
        const cleanDireccion = inputDireccion !== undefined ? inputDireccion.trim() : (current.solicitante_direccion || current.solicitante_cargo_depto || '');
        const cleanEmail = solicitante_correo !== undefined ? solicitante_correo.trim() : current.solicitante_correo;
        const cleanPhone = inputTelefono !== undefined ? inputTelefono.trim().replace(/[^0-9]/g, '') : (current.solicitante_telefono || current.solicitante_contacto || '');
        const finalCategoria = categoria || current.categoria;
        const finalFolio = folio_lobby !== undefined ? folio_lobby : current.folio_lobby;
        const finalMotivo = (!isProtected && motivo_consulta) ? motivo_consulta.trim() : current.motivo_consulta;
        const finalSolucion = solucion_orientacion !== undefined ? solucion_orientacion.trim() : current.solucion_orientacion;
        const finalEstado = estado || current.estado;

        asistenciasDb.run(`
          UPDATE bitacora_asistencias
          SET fecha_hora = ?,
              solicitante_direccion = ?, solicitante_correo = ?, solicitante_telefono = ?,
              categoria = ?, folio_lobby = ?, motivo_consulta = ?,
              solucion_orientacion = ?, estado = ?, representado = ?, representado_id_lobby = ?, updated_by = ?,
              updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
          WHERE id = ?
        `, [
          finalFechaHora,
          cleanDireccion, cleanEmail, cleanPhone,
          finalCategoria, finalFolio, finalMotivo,
          finalSolucion, finalEstado, rep, repId, currentUserEmail,
          id
        ], function(uErr) {
          if (uErr) return resolve({ status: 500, data: { error: uErr.message } });
          resolve({
            status: 200,
            data: {
              id,
              ticket_codigo: current.ticket_codigo,
              is_protected_24h: isProtected,
              representado: rep,
              representado_id_lobby: repId,
              message: 'Asistencia actualizada correctamente.'
            }
          });
        });
      });
    });
  }

  // DELETE /api/asistencias/:id
  if (method === 'DELETE' && asistenciaMatch) {
    const id = parseInt(asistenciaMatch[1], 10);
    return new Promise((resolve) => {
      asistenciasDb.get("SELECT ticket_codigo FROM bitacora_asistencias WHERE id = ?", [id], (err, current) => {
        if (err) return resolve({ status: 500, data: { error: err.message } });
        if (!current) return resolve({ status: 404, data: { error: 'Registro de asistencia no encontrado.' } });

        asistenciasDb.run("DELETE FROM bitacora_asistencias WHERE id = ?", [id], function(dErr) {
          if (dErr) return resolve({ status: 500, data: { error: dErr.message } });
          resolve({ status: 200, data: { message: `Asistencia ${current.ticket_codigo} eliminada exitosamente.` } });
        });
      });
    });
  }

  // ==========================================
  // RUTAS: CATEGORÍAS / MATERIAS DE ASISTENCIA
  // ==========================================

  // GET /api/asistencias/categorias
  if (method === 'GET' && pathName === '/api/asistencias/categorias') {
    return new Promise((resolve) => {
      asistenciasDb.all('SELECT * FROM asistencia_categorias WHERE activo = 1 ORDER BY orden ASC, nombre ASC', [], (err, rows) => {
        if (err) return resolve({ status: 500, data: { error: err.message } });
        resolve({ status: 200, data: rows || [] });
      });
    });
  }

  // POST /api/asistencias/categorias
  if (method === 'POST' && pathName === '/api/asistencias/categorias') {
    const { nombre, descripcion, orden } = body || {};
    if (!nombre || !nombre.trim()) {
      return { status: 400, data: { error: 'El nombre de la categoría es obligatorio.' } };
    }
    return new Promise((resolve) => {
      asistenciasDb.run(
        `INSERT INTO asistencia_categorias (nombre, descripcion, orden, activo, created_at, updated_at) 
         VALUES (?, ?, ?, 1, datetime('now', 'localtime'), datetime('now', 'localtime'))
         ON CONFLICT(nombre) DO UPDATE SET
           descripcion = excluded.descripcion,
           orden = excluded.orden,
           activo = 1,
           updated_at = datetime('now', 'localtime')`,
        [nombre.trim(), descripcion ? descripcion.trim() : '', parseInt(orden, 10) || 0],
        function(err) {
          if (err) return resolve({ status: 500, data: { error: err.message } });
          
          if (req.sharepointCookie) {
            const { safeSyncAndUploadAsistencias } = require('../config/db-sync');
            safeSyncAndUploadAsistencias(asistenciasDb, req.sharepointCookie).catch(e => {
              console.warn('[Sync-Categorias] Advertencia al sincronizar asistencias con SharePoint:', e.message);
            });
          }

          resolve({ status: 201, data: { id: this.lastID, nombre: nombre.trim(), message: 'Categoría creada con éxito.' } });
        }
      );
    });
  }

  // PUT /api/asistencias/categorias/reordenar
  if (method === 'PUT' && pathName === '/api/asistencias/categorias/reordenar') {
    const { ids } = body || {};
    if (!Array.isArray(ids) || ids.length === 0) {
      return { status: 400, data: { error: 'Se requiere un arreglo de IDs no vacío.' } };
    }

    // Aserción defensiva de escala
    if (ids.length > 100) {
      return { status: 400, data: { error: 'El número de elementos supera el límite permitido (100).' } };
    }

    // Validar enteros positivos y ausencia de duplicados
    const uniqueIds = new Set(ids);
    const allValidIntegers = ids.every(id => Number.isInteger(id) && id > 0);
    if (!allValidIntegers || uniqueIds.size !== ids.length) {
      return { status: 400, data: { error: 'El arreglo contiene IDs inválidos o duplicados.' } };
    }

    return new Promise((resolve) => {
      // 1. Consultar categorías activas en BD
      asistenciasDb.all('SELECT id FROM asistencia_categorias WHERE activo = 1', [], (err, rows) => {
        if (err) return resolve({ status: 500, data: { error: err.message } });

        const activeDbIds = new Set((rows || []).map(r => r.id));

        // 2. Validación bidireccional estricta (paridad de conjunto)
        if (ids.length !== activeDbIds.size || !ids.every(id => activeDbIds.has(id))) {
          return resolve({
            status: 409,
            data: { error: 'El catálogo de categorías ha cambiado concurrentemente. Es necesario refrescar.', refresh_required: true }
          });
        }

        // 3. Generar sentencia parametrizada CASE id WHEN ? THEN ? ... WHERE id IN (?, ...)
        const whenClauses = ids.map(() => 'WHEN ? THEN ?').join(' ');
        const inPlaceholders = ids.map(() => '?').join(', ');
        const sql = `
          UPDATE asistencia_categorias 
          SET orden = CASE id ${whenClauses} END,
              updated_at = datetime('now', 'localtime')
          WHERE id IN (${inPlaceholders})
        `;

        const params = [];
        ids.forEach((id, index) => params.push(id, index + 1));
        params.push(...ids);

        asistenciasDb.run(sql, params, function(updateErr) {
          if (updateErr) return resolve({ status: 500, data: { error: updateErr.message } });

          // 4. Notificar a todas las ventanas vivas de Electron
          try {
            const { BrowserWindow } = require('electron');
            BrowserWindow.getAllWindows().forEach((win) => {
              if (win && !win.isDestroyed() && win.webContents) {
                win.webContents.send('categorias-updated', { timestamp: Date.now() });
              }
            });
          } catch (bErr) {
            console.warn('[router] Error al emitir broadcast categorias-updated:', bErr.message);
          }

          // 5. Sincronizar en segundo plano con SharePoint si hay sesión activa
          if (req.sharepointCookie) {
            const { safeSyncAndUploadAsistencias } = require('../config/db-sync');
            safeSyncAndUploadAsistencias(asistenciasDb, req.sharepointCookie).catch(e => {
              console.warn('[Sync-Categorias] Advertencia al sincronizar reordenamiento con SharePoint:', e.message);
            });
          }

          resolve({ status: 200, data: { message: 'Categorías reordenadas exitosamente.', updated: this.changes } });
        });
      });
    });
  }

  // PUT /api/asistencias/categorias/:id
  const catMatch = pathName.match(/^\/api\/asistencias\/categorias\/(\d+)$/);
  if (method === 'PUT' && catMatch) {
    const id = parseInt(catMatch[1], 10);
    const { nombre, descripcion, activo, orden } = body || {};
    return new Promise((resolve) => {
      asistenciasDb.run(
        `UPDATE asistencia_categorias SET 
          nombre = COALESCE(?, nombre), 
          descripcion = COALESCE(?, descripcion), 
          activo = COALESCE(?, activo),
          orden = COALESCE(?, orden),
          updated_at = datetime('now', 'localtime')
         WHERE id = ?`,
        [nombre ? nombre.trim() : null, descripcion !== undefined ? descripcion.trim() : null, activo, orden, id],
        function(err) {
          if (err) return resolve({ status: 500, data: { error: err.message } });
          try {
            const { BrowserWindow } = require('electron');
            BrowserWindow.getAllWindows().forEach((win) => {
              if (win && !win.isDestroyed() && win.webContents) {
                win.webContents.send('categorias-updated', { timestamp: Date.now() });
              }
            });
          } catch (e) {}

          if (req.sharepointCookie) {
            const { safeSyncAndUploadAsistencias } = require('../config/db-sync');
            safeSyncAndUploadAsistencias(asistenciasDb, req.sharepointCookie).catch(e => {
              console.warn('[Sync-Categorias] Advertencia al sincronizar actualización con SharePoint:', e.message);
            });
          }

          resolve({ status: 200, data: { message: 'Categoría actualizada con éxito.' } });
        }
      );
    });
  }

  // DELETE /api/asistencias/categorias/:id
  if (method === 'DELETE' && catMatch) {
    const id = parseInt(catMatch[1], 10);
    return new Promise((resolve) => {
      asistenciasDb.run("UPDATE asistencia_categorias SET activo = 0, updated_at = datetime('now', 'localtime') WHERE id = ?", [id], function(err) {
        if (err) return resolve({ status: 500, data: { error: err.message } });
        try {
          const { BrowserWindow } = require('electron');
          BrowserWindow.getAllWindows().forEach((win) => {
            if (win && !win.isDestroyed() && win.webContents) {
              win.webContents.send('categorias-updated', { timestamp: Date.now() });
            }
          });
        } catch (e) {}

        if (req.sharepointCookie) {
          const { safeSyncAndUploadAsistencias } = require('../config/db-sync');
          safeSyncAndUploadAsistencias(asistenciasDb, req.sharepointCookie).catch(e => {
            console.warn('[Sync-Categorias] Advertencia al sincronizar eliminación con SharePoint:', e.message);
          });
        }

        resolve({ status: 200, data: { message: 'Categoría eliminada con éxito.' } });
      });
    });
  }

  // ==========================================
  // RUTAS: DIRECCIONES MUNICIPALES (CONFIGURABLES)
  // ==========================================

  // GET /api/direcciones
  if (method === 'GET' && pathName === '/api/direcciones') {
    return new Promise((resolve) => {
      asistenciasDb.all('SELECT * FROM direcciones_municipales WHERE activo = 1 ORDER BY orden ASC, acronimo ASC', [], (err, rows) => {
        if (err) return resolve({ status: 500, data: { error: err.message } });
        resolve({ status: 200, data: rows || [] });
      });
    });
  }

  // POST /api/direcciones
  if (method === 'POST' && pathName === '/api/direcciones') {
    const { acronimo, nombre, orden } = body || {};
    if (!acronimo || !acronimo.trim() || !nombre || !nombre.trim()) {
      return { status: 400, data: { error: 'El acrónimo y el nombre de la dirección son obligatorios.' } };
    }
    return new Promise((resolve) => {
      asistenciasDb.run(
        `INSERT INTO direcciones_municipales (acronimo, nombre, orden, activo, created_at, updated_at) 
         VALUES (?, ?, ?, 1, datetime('now', 'localtime'), datetime('now', 'localtime'))
         ON CONFLICT(acronimo) DO UPDATE SET
           nombre = excluded.nombre,
           orden = excluded.orden,
           activo = 1,
           updated_at = datetime('now', 'localtime')`,
        [acronimo.trim().toUpperCase(), nombre.trim(), parseInt(orden, 10) || 0],
        function(err) {
          if (err) return resolve({ status: 500, data: { error: err.message } });

          if (req.sharepointCookie) {
            const { safeSyncAndUploadAsistencias } = require('../config/db-sync');
            safeSyncAndUploadAsistencias(asistenciasDb, req.sharepointCookie).catch(e => {
              console.warn('[Sync-Direcciones] Advertencia al sincronizar con SharePoint:', e.message);
            });
          }

          resolve({ status: 201, data: { id: this.lastID, acronimo: acronimo.trim().toUpperCase(), message: 'Dirección creada con éxito.' } });
        }
      );
    });
  }

  // PUT /api/direcciones/reordenar
  if (method === 'PUT' && pathName === '/api/direcciones/reordenar') {
    const { ids } = body || {};
    if (!Array.isArray(ids) || ids.length === 0) {
      return { status: 400, data: { error: 'Se requiere un arreglo de IDs no vacío.' } };
    }

    if (ids.length > 200) {
      return { status: 400, data: { error: 'El número de elementos supera el límite permitido.' } };
    }

    const uniqueIds = new Set(ids);
    const allValidIntegers = ids.every(id => Number.isInteger(id) && id > 0);
    if (!allValidIntegers || uniqueIds.size !== ids.length) {
      return { status: 400, data: { error: 'El arreglo contiene IDs inválidos o duplicados.' } };
    }

    return new Promise((resolve) => {
      asistenciasDb.all('SELECT id FROM direcciones_municipales WHERE activo = 1', [], (err, rows) => {
        if (err) return resolve({ status: 500, data: { error: err.message } });

        const activeDbIds = new Set((rows || []).map(r => r.id));

        if (ids.length !== activeDbIds.size || !ids.every(id => activeDbIds.has(id))) {
          return resolve({
            status: 409,
            data: { error: 'El catálogo de direcciones ha cambiado concurrentemente. Es necesario refrescar.', refresh_required: true }
          });
        }

        const whenClauses = ids.map(() => 'WHEN ? THEN ?').join(' ');
        const inPlaceholders = ids.map(() => '?').join(', ');
        const sql = `
          UPDATE direcciones_municipales 
          SET orden = CASE id ${whenClauses} END,
              updated_at = datetime('now', 'localtime')
          WHERE id IN (${inPlaceholders})
        `;

        const params = [];
        ids.forEach((id, index) => params.push(id, index + 1));
        params.push(...ids);

        asistenciasDb.run(sql, params, function(updateErr) {
          if (updateErr) return resolve({ status: 500, data: { error: updateErr.message } });

          try {
            const { BrowserWindow } = require('electron');
            BrowserWindow.getAllWindows().forEach((win) => {
              if (win && !win.isDestroyed() && win.webContents) {
                win.webContents.send('direcciones-updated', { timestamp: Date.now() });
              }
            });
          } catch (bErr) {
            console.warn('[router] Error al emitir broadcast direcciones-updated:', bErr.message);
          }

          if (req.sharepointCookie) {
            const { safeSyncAndUploadAsistencias } = require('../config/db-sync');
            safeSyncAndUploadAsistencias(asistenciasDb, req.sharepointCookie).catch(e => {
              console.warn('[Sync-Direcciones] Advertencia al sincronizar reordenamiento con SharePoint:', e.message);
            });
          }

          resolve({
            status: 200,
            data: { success: true, message: 'Direcciones reordenadas exitosamente.', total: ids.length }
          });
        });
      });
    });
  }

  // PUT /api/direcciones/:id
  const dirMatch = pathName.match(/^\/api\/direcciones\/(\d+)$/);
  if (method === 'PUT' && dirMatch) {
    const id = parseInt(dirMatch[1], 10);
    const { acronimo, nombre, activo, orden } = body || {};
    return new Promise((resolve) => {
      asistenciasDb.run(
        `UPDATE direcciones_municipales SET 
          acronimo = COALESCE(?, acronimo), 
          nombre = COALESCE(?, nombre), 
          activo = COALESCE(?, activo),
          orden = COALESCE(?, orden),
          updated_at = datetime('now', 'localtime')
         WHERE id = ?`,
        [acronimo ? acronimo.trim().toUpperCase() : null, nombre ? nombre.trim() : null, activo, orden, id],
        function(err) {
          if (err) return resolve({ status: 500, data: { error: err.message } });

          if (req.sharepointCookie) {
            const { safeSyncAndUploadAsistencias } = require('../config/db-sync');
            safeSyncAndUploadAsistencias(asistenciasDb, req.sharepointCookie).catch(e => {
              console.warn('[Sync-Direcciones] Advertencia al sincronizar con SharePoint:', e.message);
            });
          }

          resolve({ status: 200, data: { message: 'Dirección actualizada con éxito.' } });
        }
      );
    });
  }

  // DELETE /api/direcciones/:id
  if (method === 'DELETE' && dirMatch) {
    const id = parseInt(dirMatch[1], 10);
    return new Promise((resolve) => {
      asistenciasDb.run(
        "UPDATE direcciones_municipales SET activo = 0, updated_at = datetime('now', 'localtime') WHERE id = ?",
        [id],
        function(err) {
          if (err) return resolve({ status: 500, data: { error: err.message } });

          if (req.sharepointCookie) {
            const { safeSyncAndUploadAsistencias } = require('../config/db-sync');
            safeSyncAndUploadAsistencias(asistenciasDb, req.sharepointCookie).catch(e => {
              console.warn('[Sync-Direcciones] Advertencia al sincronizar eliminación con SharePoint:', e.message);
            });
          }

          resolve({ status: 200, data: { message: 'Dirección eliminada con éxito.' } });
        }
      );
    });
  }

  // GET /api/admin/inspector/tables
  if (method === 'GET' && pathName === '/api/admin/inspector/tables') {
    const queryTables = "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name ASC";
    return new Promise((resolve) => {
      db.all(queryTables, [], (err, lobbyRows) => {
        if (err) return resolve({ status: 500, data: { error: err.message } });
        usersDb.all(queryTables, [], (err, usersRows) => {
          if (err) return resolve({ status: 500, data: { error: err.message } });
          localDb.all(queryTables, [], (err, localRows) => {
            if (err) return resolve({ status: 500, data: { error: err.message } });
            asistenciasDb.all(queryTables, [], (err, asistenciasRows) => {
              if (err) return resolve({ status: 500, data: { error: err.message } });

              const tables = {
                'data.db': lobbyRows.map(r => r.name).sort(),
                'app.db': asistenciasRows.map(r => r.name).sort(),
                'usuarios.db': usersRows.map(r => r.name).sort(),
                'local.db': localRows.map(r => r.name).sort()
              };
              resolve({ status: 200, data: tables });
            });
          });
        });
      });
    });
  }

  // GET /api/admin/inspector/data
  if (method === 'GET' && pathName === '/api/admin/inspector/data') {
    const tableName = query.table;
    if (!tableName) {
      return { status: 400, data: { error: 'El parámetro "table" es obligatorio.' } };
    }

    const whitelistedTables = [
      'usuarios',
      'solicitudes_sh',
      'publicadas_ph',
      'sujetos_pasivos_sph',
      'configuracion',
      'historial_sincronizaciones',
      'auditoria_semanal',
      'sujetos_pasivos_vigentes',
      'alertas_gestionadas',
      'configuracion_local',
      'direcciones_municipales',
      'contactos_asistencia',
      'bitacora_asistencias',
      'asistencia_categorias'
    ];

    if (!whitelistedTables.includes(tableName)) {
      return { status: 400, data: { error: 'Nombre de tabla no permitido o inválido.' } };
    }

    let dbHandle = db;
    if (tableName === 'usuarios') {
      dbHandle = usersDb;
    } else if (
      tableName === 'configuracion' ||
      tableName === 'historial_sincronizaciones' ||
      tableName === 'auditoria_semanal' ||
      tableName === 'contactos_asistencia' ||
      tableName === 'bitacora_asistencias' ||
      tableName === 'asistencia_categorias' ||
      tableName === 'direcciones_municipales'
    ) {
      dbHandle = appDb;
    } else if (tableName === 'alertas_gestionadas' || tableName === 'configuracion_local') {
      dbHandle = localDb;
    }

    const page = parseInt(query.page, 10) || 1;
    const limit = parseInt(query.limit, 10) || 10;
    const offset = (page - 1) * limit;
    const search = query.search || '';

    return new Promise((resolve) => {
      dbHandle.all(`PRAGMA table_info(${tableName})`, [], (err, columns) => {
        if (err) return resolve({ status: 500, data: { error: err.message } });
        if (!columns || columns.length === 0) {
          return resolve({ status: 404, data: { error: `No se encontró metadata para la tabla "${tableName}".` } });
        }

        const colNames = columns.map(c => c.name);
        let countQuery = `SELECT COUNT(*) AS total FROM ${tableName}`;
        let dataQuery = `SELECT * FROM ${tableName}`;
        let whereClauses = [];
        let params = [];

        if (search.trim() !== '') {
          const searchVal = `%${search.trim()}%`;
          colNames.forEach(col => {
            whereClauses.push(`"${col}" LIKE ?`);
            params.push(searchVal);
          });
        }

        if (whereClauses.length > 0) {
          const whereSql = ` WHERE ` + whereClauses.join(' OR ');
          countQuery += whereSql;
          dataQuery += whereSql;
        }

        const orderCol = colNames.includes('id') ? 'id' : colNames[0];
        dataQuery += ` ORDER BY "${orderCol}" DESC LIMIT ? OFFSET ?`;

        dbHandle.get(countQuery, params, (err, countRow) => {
          if (err) return resolve({ status: 500, data: { error: err.message } });
          const total = countRow ? countRow.total : 0;

          dbHandle.all(dataQuery, [...params, limit, offset], (err, rows) => {
            if (err) return resolve({ status: 500, data: { error: err.message } });
            resolve({
              status: 200,
              data: { columns, rows, total, page, limit }
            });
          });
        });
      });
    });
  }

  // Si no coincide con ninguna ruta
  return { status: 404, data: { error: `Ruta no encontrada: ${method} ${pathName}` } };
}

module.exports = { handle };
