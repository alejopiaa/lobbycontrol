const urlModule = require("url");
const path = require("path");
const fs = require("fs");
const db = require("../config/database");
const usersDb = db.usersDb;
const localDb = db.localDb;
const asistenciasDb = db.asistenciasDb;
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
function sanitizeContactData(nombre, depto, correo, contacto) {
  let cleanName = (nombre || '').trim().replace(/\s+/g, ' ');
  let cleanDepto = (depto || '').trim();
  let cleanEmail = (correo || '').trim().toLowerCase();
  if (cleanEmail && !cleanEmail.includes('@')) {
    cleanEmail += '@maipu.cl';
  }
  let cleanPhone = (contacto || '').trim();
  if (/^\d{4}$/.test(cleanPhone)) {
    cleanPhone = `Anexo ${cleanPhone}`;
  }
  return { cleanName, cleanDepto, cleanEmail, cleanPhone };
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

    const { checkAndSyncDatabase } = require('../config/db-sync');
    return new Promise((resolve) => {
      checkAndSyncDatabase(db, req.sharepointCookie)
        .then((updated) => {
          // Obtener la fecha de última actualización para retornarla al cliente si hubo cambios
          if (updated) {
            db.get("SELECT valor FROM configuracion WHERE clave = 'db_last_update'", [], (err, row) => {
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
        
        // Sincronizar SharePoint en segundo plano (usuarios.db y lobby.db)
        const { checkAndSyncDatabase } = require('../config/db-sync');
        setTimeout(async () => {
          try {
            const usersUpdated = await checkAndSyncDatabase(usersDb, cookieHeader, 'usuarios');
            console.log(`[SSO Sync] Sincronización de usuarios terminada. ¿Cambios?: ${usersUpdated}`);
            const lobbyUpdated = await checkAndSyncDatabase(db, cookieHeader, 'lobby');
            console.log(`[SSO Sync] Sincronización de lobby terminada. ¿Cambios?: ${lobbyUpdated}`);
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
      SELECT DISTINCT sph.nombre, sph.rut
      FROM sujetos_pasivos_sph sph
      INNER JOIN sujetos_pasivos_vigentes spv ON spv.id_sujeto_lobby = sph.id_sujeto_lobby
      ORDER BY sph.nombre ASC
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
      db.get("SELECT valor FROM configuracion WHERE clave = 'last_import_timestamp'", [], (err, row) => {
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
    const { checkAndSyncDatabase } = require('../config/db-sync');
    return new Promise((resolve) => {
      checkAndSyncDatabase(db, req.sharepointCookie)
        .then((updated) => {
          const { logEvent } = require('../config/logger');
          if (updated) {
            db.get("SELECT valor FROM configuracion WHERE clave = 'db_last_update'", [], (err, row) => {
              const lastUpdate = (row && !err) ? row.valor : new Date().toLocaleString('es-CL');
              logEvent("INFO-SYNC-201", "Sincronización manual completada (Con cambios)", `Firma actualizada: ${lastUpdate} | Por: ${user.correo}`);
            });
          } else {
            logEvent("INFO-SYNC-202", "Sincronización manual completada (Sin cambios)", `Por: ${user.correo}`);
          }

          resolve({
            status: 200,
            data: {
              success: true,
              updated,
              message: updated 
                ? 'Sincronización completada: Se descargó y aplicó una nueva versión de la base de datos.' 
                : 'La base de datos local ya está al día.'
            }
          });
        })
        .catch((err) => {
          console.error('Error al sincronizar:', err);
          const { logError } = require('../config/logger');
          logError("ERR-SYNC-302", "Sincronización manual falló", `Error: ${err.message} | Por: ${user.correo}`);
          resolve({ status: 500, data: { error: `Error al sincronizar: ${err.message}` } });
        })
        .finally(() => {
          isSyncing = false;
        });
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
              message: 'Base de Asistencias Técnicas (asistencias.db) respaldada en SharePoint correctamente.'
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
      db.all('SELECT * FROM historial_sincronizaciones ORDER BY id DESC LIMIT 5', [], (err, rows) => {
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
      db.all('SELECT * FROM auditoria_semanal ORDER BY fecha ASC', [], (err, rows) => {
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
      db.run(query, [fecha, total || 0, ingresada || 0, aceptada || 0, rechazada || 0, suspendida || 0, cancelada || 0, encomendada || 0, publicada || 0, usuario], async function(err) {
        if (err) return resolve({ status: 500, data: { error: err.message } });
        await db.recalculateAndSignDatabase();
        if (req.sharepointCookie) {
          const { uploadDatabaseToSharePoint } = require('../config/db-sync');
          uploadDatabaseToSharePoint(db, req.sharepointCookie, 'lobby').catch(e => {
            console.error('Error al subir base de datos de lobby a SharePoint:', e.message);
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
      db.run(query, [fecha, total || 0, ingresada || 0, aceptada || 0, rechazada || 0, suspendida || 0, cancelada || 0, encomendada || 0, publicada || 0, estado || null, id], async function(err) {
        if (err) return resolve({ status: 500, data: { error: err.message } });
        if (this.changes === 0) return resolve({ status: 404, data: { error: 'Registro no encontrado.' } });
        await db.recalculateAndSignDatabase();
        if (req.sharepointCookie) {
          const { uploadDatabaseToSharePoint } = require('../config/db-sync');
          uploadDatabaseToSharePoint(db, req.sharepointCookie, 'lobby').catch(e => {
            console.error('Error al subir base de datos de lobby a SharePoint:', e.message);
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
      db.run('DELETE FROM auditoria_semanal WHERE id = ?', id, async function(err) {
        if (err) return resolve({ status: 500, data: { error: err.message } });
        if (this.changes === 0) return resolve({ status: 404, data: { error: 'Registro no encontrado.' } });
        await db.recalculateAndSignDatabase();
        if (req.sharepointCookie) {
          const { uploadDatabaseToSharePoint } = require('../config/db-sync');
          uploadDatabaseToSharePoint(db, req.sharepointCookie, 'lobby').catch(e => {
            console.error('Error al subir base de datos de lobby a SharePoint:', e.message);
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
        SELECT id, nombre, depto_habitual, correo, telefono_anexo
        FROM contactos_asistencia
        WHERE nombre LIKE ? COLLATE NOCASE OR depto_habitual LIKE ? COLLATE NOCASE
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
      `;
      let params = [];
      if (search) {
        sql += ` WHERE c.nombre LIKE ? COLLATE NOCASE OR c.depto_habitual LIKE ? COLLATE NOCASE OR c.correo LIKE ? COLLATE NOCASE`;
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

  // POST /api/asistencias/contactos
  if (method === 'POST' && pathName === '/api/asistencias/contactos') {
    const { nombre, depto_habitual, correo, telefono_anexo, notas } = body;
    if (!nombre || !nombre.trim()) {
      return { status: 400, data: { error: 'El nombre del contacto es obligatorio.' } };
    }
    const { cleanName, cleanDepto, cleanEmail, cleanPhone } = sanitizeContactData(nombre, depto_habitual, correo, telefono_anexo);
    const crypto = require('crypto');
    const contactUuid = crypto.randomUUID();

    return new Promise((resolve) => {
      asistenciasDb.run(`
        INSERT INTO contactos_asistencia (uuid, nombre, depto_habitual, correo, telefono_anexo, notas)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [contactUuid, cleanName, cleanDepto, cleanEmail, cleanPhone, notas || ''], function(err) {
        if (err) return resolve({ status: 500, data: { error: err.message } });
        resolve({ status: 201, data: { id: this.lastID, uuid: contactUuid, nombre: cleanName, depto_habitual: cleanDepto, correo: cleanEmail, telefono_anexo: cleanPhone } });
      });
    });
  }

  // PUT /api/asistencias/contactos/:id
  const contactoMatch = pathName.match(/^\/api\/asistencias\/contactos\/(\d+)$/);
  if (method === 'PUT' && contactoMatch) {
    const id = parseInt(contactoMatch[1], 10);
    const { nombre, depto_habitual, correo, telefono_anexo, notas } = body;
    if (!nombre || !nombre.trim()) {
      return { status: 400, data: { error: 'El nombre del contacto es obligatorio.' } };
    }
    const { cleanName, cleanDepto, cleanEmail, cleanPhone } = sanitizeContactData(nombre, depto_habitual, correo, telefono_anexo);
    return new Promise((resolve) => {
      asistenciasDb.run(`
        UPDATE contactos_asistencia
        SET nombre = ?, depto_habitual = ?, correo = ?, telefono_anexo = ?, notas = ?, updated_at = datetime('now', 'localtime')
        WHERE id = ?
      `, [cleanName, cleanDepto, cleanEmail, cleanPhone, notas || '', id], function(err) {
        if (err) return resolve({ status: 500, data: { error: err.message } });
        if (this.changes === 0) return resolve({ status: 404, data: { error: 'Contacto no encontrado.' } });
        resolve({ status: 200, data: { id, nombre: cleanName, depto_habitual: cleanDepto, correo: cleanEmail, telefono_anexo: cleanPhone } });
      });
    });
  }

  // POST /api/asistencias/contactos/unificar (Merge de contactos duplicados con UUID)
  if (method === 'POST' && pathName === '/api/asistencias/contactos/unificar') {
    const { target_id, target_uuid, source_ids, source_uuids } = body;
    
    return new Promise((resolve) => {
      asistenciasDb.get(
        "SELECT id, uuid, nombre, depto_habitual, correo, telefono_anexo FROM contactos_asistencia WHERE id = ? OR (uuid IS NOT NULL AND uuid = ?)",
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

              const idPlaceholders = sIds.length > 0 ? sIds.map(() => '?').join(',') : 'NULL';
              const uuidPlaceholders = sUuids.length > 0 ? sUuids.map(() => '?').join(',') : 'NULL';

              asistenciasDb.run(`
                UPDATE bitacora_asistencias
                SET contacto_id = ?, contacto_uuid = ?, updated_at = datetime('now', 'localtime')
                WHERE contacto_id IN (${idPlaceholders}) OR contacto_uuid IN (${uuidPlaceholders})
              `, [cleanTargetId, cleanTargetUuid, ...sIds, ...sUuids], (uErr) => {
                if (uErr) {
                  asistenciasDb.run("ROLLBACK");
                  return resolve({ status: 500, data: { error: uErr.message } });
                }

                asistenciasDb.run(`
                  DELETE FROM contactos_asistencia
                  WHERE id IN (${idPlaceholders}) OR uuid IN (${uuidPlaceholders})
                `, [...sIds, ...sUuids], function(dErr) {
                  if (dErr) {
                    asistenciasDb.run("ROLLBACK");
                    return resolve({ status: 500, data: { error: dErr.message } });
                  }

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
                  });
                });
              });
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
      const qTopDepto = `SELECT COALESCE(NULLIF(TRIM(solicitante_cargo_depto), ''), 'General') AS depto, COUNT(*) AS count FROM bitacora_asistencias GROUP BY depto ORDER BY count DESC LIMIT 10`;
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
      where.push(`(b.ticket_codigo LIKE ? OR b.solicitante_nombre LIKE ? COLLATE NOCASE OR b.solicitante_cargo_depto LIKE ? COLLATE NOCASE OR b.motivo_consulta LIKE ? COLLATE NOCASE OR b.solucion_orientacion LIKE ? COLLATE NOCASE OR b.folio_lobby LIKE ?)`);
      const sVal = `%${search}%`;
      params.push(sVal, sVal, sVal, sVal, sVal, sVal);
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
          SELECT b.*, c.nombre AS contacto_nombre_canonico, c.correo AS contacto_correo_canonico, c.telefono_anexo AS contacto_anexo_canonico
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
      solicitante_cargo_depto,
      solicitante_correo,
      solicitante_contacto,
      canal,
      categoria,
      folio_lobby,
      sujeto_pasivo,
      motivo_consulta,
      solucion_orientacion,
      estado,
      duracion_minutos,
      contacto_id,
      creado_por
    } = body;

    if (!solicitante_nombre || !solicitante_nombre.trim()) {
      return { status: 400, data: { error: 'El nombre del solicitante es obligatorio.' } };
    }
    if (!categoria || !categoria.trim()) {
      return { status: 400, data: { error: 'Debes seleccionar una categoría para la asistencia.' } };
    }
    if (!motivo_consulta || !motivo_consulta.trim()) {
      return { status: 400, data: { error: 'El motivo de la consulta es obligatorio.' } };
    }

    const { cleanName, cleanDepto, cleanEmail, cleanPhone } = sanitizeContactData(
      solicitante_nombre, solicitante_cargo_depto, solicitante_correo, solicitante_contacto
    );

    const currentUserEmail = (user && user.correo) || creado_por || 'admin@maipu.cl';

    return new Promise((resolve) => {
      asistenciasDb.serialize(() => {
        asistenciasDb.run("BEGIN IMMEDIATE TRANSACTION", (bErr) => {
          if (bErr) return resolve({ status: 500, data: { error: bErr.message } });

          // 1. Calcular folio correlativo único del día AST-AAMMDD-NNN
          const datePrefix = getChileanDatePrefix();
          const queryPrefix = `AST-${datePrefix}-%`;

          asistenciasDb.all("SELECT ticket_codigo FROM bitacora_asistencias WHERE ticket_codigo LIKE ?", [queryPrefix], (tErr, rows) => {
            if (tErr) {
              asistenciasDb.run("ROLLBACK");
              return resolve({ status: 500, data: { error: tErr.message } });
            }

            let maxSeq = 0;
            if (rows && rows.length > 0) {
              for (const r of rows) {
                if (r && r.ticket_codigo) {
                  const parts = r.ticket_codigo.split('-');
                  if (parts.length >= 3) {
                    const num = parseInt(parts[2], 10);
                    if (!isNaN(num) && num > maxSeq) {
                      maxSeq = num;
                    }
                  }
                }
              }
            }
            const ticketCodigo = `AST-${datePrefix}-${String(maxSeq + 1).padStart(3, '0')}`;

            // 2. Gestionar contacto en contactos_asistencia
            const proceedWithInsert = (resolvedContactId, resolvedContactUuid) => {
              asistenciasDb.run(`
                INSERT INTO bitacora_asistencias (
                  ticket_codigo, contacto_id, contacto_uuid, canal, solicitante_nombre, solicitante_cargo_depto,
                  solicitante_correo, solicitante_contacto, categoria, folio_lobby, sujeto_pasivo,
                  motivo_consulta, solucion_orientacion, estado, duracion_minutos, creado_por
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              `, [
                ticketCodigo,
                resolvedContactId,
                resolvedContactUuid,
                canal || 'telefono',
                cleanName,
                cleanDepto,
                cleanEmail,
                cleanPhone,
                categoria,
                (folio_lobby || '').trim() || null,
                (sujeto_pasivo || '').trim() || null,
                motivo_consulta.trim(),
                (solucion_orientacion || '').trim(),
                estado || 'resuelta',
                parseInt(duracion_minutos, 10) || 5,
                currentUserEmail
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
                      ticket_codigo: ticketCodigo,
                      contacto_id: resolvedContactId,
                      contacto_uuid: resolvedContactUuid,
                      solicitante_nombre: cleanName,
                      solicitante_cargo_depto: cleanDepto,
                      solicitante_correo: cleanEmail,
                      solicitante_contacto: cleanPhone,
                      fecha_hora: new Date().toISOString(),
                      message: `Asistencia ${ticketCodigo} guardada correctamente.`
                    }
                  });
                });
              });
            };

            const crypto = require('crypto');
            if (contacto_id) {
              const cId = parseInt(contacto_id, 10);
              asistenciasDb.get("SELECT uuid FROM contactos_asistencia WHERE id = ?", [cId], (uErr, cRow) => {
                const cUuid = (cRow && cRow.uuid) ? cRow.uuid : null;
                proceedWithInsert(cId, cUuid);
              });
            } else {
              asistenciasDb.get("SELECT id, uuid, depto_habitual, correo, telefono_anexo FROM contactos_asistencia WHERE nombre = ? COLLATE NOCASE", [cleanName], (cErr, contactRow) => {
                if (cErr) {
                  asistenciasDb.run("ROLLBACK");
                  return resolve({ status: 500, data: { error: cErr.message } });
                }
                if (contactRow) {
                  const updatedDepto = contactRow.depto_habitual || cleanDepto;
                  const updatedEmail = cleanEmail || contactRow.correo;
                  const updatedPhone = cleanPhone || contactRow.telefono_anexo;
                  const currentUuid = contactRow.uuid || crypto.randomUUID();
                  asistenciasDb.run(
                    "UPDATE contactos_asistencia SET uuid = ?, depto_habitual = ?, correo = ?, telefono_anexo = ?, updated_at = datetime('now', 'localtime') WHERE id = ?",
                    [currentUuid, updatedDepto, updatedEmail, updatedPhone, contactRow.id],
                    () => proceedWithInsert(contactRow.id, currentUuid)
                  );
                } else if (cleanName) {
                  const newContactUuid = crypto.randomUUID();
                  asistenciasDb.run(
                    "INSERT INTO contactos_asistencia (uuid, nombre, depto_habitual, correo, telefono_anexo) VALUES (?, ?, ?, ?, ?)",
                    [newContactUuid, cleanName, cleanDepto, cleanEmail, cleanPhone],
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
          });
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
        SELECT b.*, c.nombre AS contacto_nombre_canonico, c.correo AS contacto_correo_canonico, c.telefono_anexo AS contacto_anexo_canonico
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
      solicitante_cargo_depto,
      solicitante_correo,
      solicitante_contacto,
      categoria,
      folio_lobby,
      sujeto_pasivo,
      motivo_consulta,
      solucion_orientacion,
      estado,
      duracion_minutos,
      updated_by
    } = body;

    const currentUserEmail = (user && user.correo) || updated_by || 'admin@maipu.cl';

    return new Promise((resolve) => {
      asistenciasDb.get("SELECT * FROM bitacora_asistencias WHERE id = ?", [id], (err, current) => {
        if (err) return resolve({ status: 500, data: { error: err.message } });
        if (!current) return resolve({ status: 404, data: { error: 'Registro de asistencia no encontrado.' } });

        // Regla de inmutabilidad (24 horas): si pasaron más de 24h, no se permite cambiar motivo ni solicitante original
        const createdAt = new Date(current.created_at.replace(' ', 'T') + 'Z');
        const diffHours = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60);
        const isProtected = diffHours > 24;

        const cleanDepto = solicitante_cargo_depto !== undefined ? solicitante_cargo_depto : current.solicitante_cargo_depto;
        const cleanEmail = solicitante_correo !== undefined ? solicitante_correo : current.solicitante_correo;
        const cleanPhone = solicitante_contacto !== undefined ? solicitante_contacto : current.solicitante_contacto;
        const finalCategoria = categoria || current.categoria;
        const finalFolio = folio_lobby !== undefined ? folio_lobby : current.folio_lobby;
        const finalSujeto = sujeto_pasivo !== undefined ? sujeto_pasivo : current.sujeto_pasivo;
        const finalMotivo = (!isProtected && motivo_consulta) ? motivo_consulta.trim() : current.motivo_consulta;
        const finalSolucion = solucion_orientacion !== undefined ? solucion_orientacion.trim() : current.solucion_orientacion;
        const finalEstado = estado || current.estado;
        const finalDuracion = duracion_minutos !== undefined ? (parseInt(duracion_minutos, 10) || 5) : current.duracion_minutos;

        asistenciasDb.run(`
          UPDATE bitacora_asistencias
          SET solicitante_cargo_depto = ?, solicitante_correo = ?, solicitante_contacto = ?,
              categoria = ?, folio_lobby = ?, sujeto_pasivo = ?, motivo_consulta = ?,
              solucion_orientacion = ?, estado = ?, duracion_minutos = ?, updated_by = ?,
              updated_at = datetime('now', 'localtime')
          WHERE id = ?
        `, [
          cleanDepto, cleanEmail, cleanPhone,
          finalCategoria, finalFolio, finalSujeto, finalMotivo,
          finalSolucion, finalEstado, finalDuracion, currentUserEmail,
          id
        ], function(uErr) {
          if (uErr) return resolve({ status: 500, data: { error: uErr.message } });
          resolve({
            status: 200,
            data: {
              id,
              ticket_codigo: current.ticket_codigo,
              is_protected_24h: isProtected,
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
        'INSERT INTO asistencia_categorias (nombre, descripcion, orden, activo) VALUES (?, ?, ?, 1)',
        [nombre.trim(), descripcion ? descripcion.trim() : '', parseInt(orden, 10) || 0],
        function(err) {
          if (err) return resolve({ status: 500, data: { error: err.message } });
          resolve({ status: 201, data: { id: this.lastID, nombre: nombre.trim(), message: 'Categoría creada con éxito.' } });
        }
      );
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
          resolve({ status: 200, data: { message: 'Categoría actualizada con éxito.' } });
        }
      );
    });
  }

  // DELETE /api/asistencias/categorias/:id
  if (method === 'DELETE' && catMatch) {
    const id = parseInt(catMatch[1], 10);
    return new Promise((resolve) => {
      asistenciasDb.run('DELETE FROM asistencia_categorias WHERE id = ?', [id], function(err) {
        if (err) return resolve({ status: 500, data: { error: err.message } });
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
      localDb.all('SELECT * FROM direcciones_municipales WHERE activo = 1 ORDER BY orden ASC, acronimo ASC', [], (err, rows) => {
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
      localDb.run(
        'INSERT INTO direcciones_municipales (acronimo, nombre, orden, activo) VALUES (?, ?, ?, 1)',
        [acronimo.trim().toUpperCase(), nombre.trim(), parseInt(orden, 10) || 0],
        function(err) {
          if (err) return resolve({ status: 500, data: { error: err.message } });
          resolve({ status: 201, data: { id: this.lastID, acronimo: acronimo.trim().toUpperCase(), message: 'Dirección creada con éxito.' } });
        }
      );
    });
  }

  // PUT /api/direcciones/:id
  const dirMatch = pathName.match(/^\/api\/direcciones\/(\d+)$/);
  if (method === 'PUT' && dirMatch) {
    const id = parseInt(dirMatch[1], 10);
    const { acronimo, nombre, activo, orden } = body || {};
    return new Promise((resolve) => {
      localDb.run(
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
          resolve({ status: 200, data: { message: 'Dirección actualizada con éxito.' } });
        }
      );
    });
  }

  // DELETE /api/direcciones/:id
  if (method === 'DELETE' && dirMatch) {
    const id = parseInt(dirMatch[1], 10);
    return new Promise((resolve) => {
      localDb.run('DELETE FROM direcciones_municipales WHERE id = ?', [id], function(err) {
        if (err) return resolve({ status: 500, data: { error: err.message } });
        resolve({ status: 200, data: { message: 'Dirección eliminada con éxito.' } });
      });
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
                'lobby_control.db': lobbyRows.map(r => r.name).sort(),
                'usuarios.db': usersRows.map(r => r.name).sort(),
                'asistencias.db': asistenciasRows.map(r => r.name).sort(),
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
    } else if (tableName === 'contactos_asistencia' || tableName === 'bitacora_asistencias' || tableName === 'asistencia_categorias') {
      dbHandle = asistenciasDb;
    } else if (tableName === 'alertas_gestionadas' || tableName === 'configuracion_local' || tableName === 'direcciones_municipales') {
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
