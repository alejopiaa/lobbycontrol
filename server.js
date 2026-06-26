require('dotenv').config();
const express = require('express');
const path = require('path');
const db = require('./src/config/database');
const auth = require('./src/middleware/auth');
const dateUtils = require('./src/utils/date-utils');

const app = express();
const PORT = process.env.PORT || 3000;

// Semáforo de control para importaciones concurrentes
let isImporting = false;
let latestSharepointCookie = null;

// Helper para extraer cookies firmadas
function getCookie(req, name) {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return null;
  const cookies = cookieHeader.split(';');
  for (let c of cookies) {
    const [k, v] = c.trim().split('=');
    if (k === name) return v;
  }
  return null;
}

// Helper para inyectar campos calculados dinámicamente en tiempo de ejecución (para mantener la consistencia DRY)
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
          // Calcular si tiene retraso de publicación
          try {
            const parts = item.fecha_agendada.split(' ')[0].split('-');
            if (parts.length === 3) {
              const year = parseInt(parts[0], 10);
              const month = parseInt(parts[1], 10) - 1; // 0-indexed
              
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

// Cache de folios publicados con TTL de 60 segundos para evitar queries redundantes
let _publishedFoliosCache = null;
let _publishedFoliosCacheTime = 0;
const PUBLISHED_FOLIOS_TTL_MS = 60 * 1000; // 60 segundos

// Helper para obtener el Set de folios publicados (con caché corta)
function getPublishedFolios(callback) {
  const now = Date.now();
  if (_publishedFoliosCache && (now - _publishedFoliosCacheTime) < PUBLISHED_FOLIOS_TTL_MS) {
    return callback(_publishedFoliosCache);
  }
  db.all('SELECT folio_lobby FROM publicadas_ph WHERE folio_lobby IS NOT NULL AND folio_lobby != \'\'', [], (err, rows) => {
    if (err) {
      callback(new Set());
    } else {
      _publishedFoliosCache = new Set(rows.map(r => r.folio_lobby));
      _publishedFoliosCacheTime = now;
      callback(_publishedFoliosCache);
    }
  });
}

// Función para invalidar el caché de folios publicados (llamar si se importan datos nuevos)
function invalidatePublishedFoliosCache() {
  _publishedFoliosCache = null;
  _publishedFoliosCacheTime = 0;
}

// Middleware para parsear JSON y datos de formularios con límites ampliados para carga de Excel en Base64
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Loggear todas las peticiones entrantes para diagnóstico con código de respuesta
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    console.log(`[HTTP res] ${req.method} ${req.url} - Status: ${res.statusCode} (${Date.now() - start}ms)`);
  });
  next();
});


// Middleware de autenticación global para la API
app.use('/api', (req, res, next) => {
  if (req.user) {
    return next();
  }
  // Las rutas de login y última modificación son públicas
  if (req.path === '/auth/login' || req.path === '/auth/sso' || req.path === '/auth/trigger-sso' || req.path === '/db-last-update') {
    return next();
  }
  
  const token = getCookie(req, 'lobby_session');
  if (!token) {
    return res.status(401).json({ error: 'No autorizado. Inicie sesión.' });
  }
  
  const decoded = auth.verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ error: 'Sesión inválida o expirada.' });
  }
  
  req.user = decoded;

  // Sliding Expiration: Renovar la cookie y el token en cada petición activa a la API
  const newToken = auth.signToken({
    id: decoded.id,
    correo: decoded.correo,
    nombre: decoded.nombre,
    rol: decoded.rol,
    rut: decoded.rut,
    asistido_rut: decoded.asistido_rut
  });
  res.cookie('lobby_session', newToken, {
    httpOnly: true,
    maxAge: 30 * 60 * 1000, // Renovar por 30 minutos más
    sameSite: 'lax',
    path: '/'
  });

  next();
});

// Configurar carpeta estática para el frontend con caché de corta duración en producción
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    } else {
      res.setHeader('Cache-Control', 'public, max-age=3600');
    }
  }
}));

// ==========================================
// RUTAS DE AUTENTICACIÓN
// ==========================================
app.post('/api/auth/login', (req, res) => {
  const { correo, password } = req.body;
  if (!correo || !password) {
    return res.status(400).json({ error: 'Correo y contraseña son obligatorios.' });
  }
  
  db.get('SELECT * FROM usuarios WHERE correo = ?', [correo], (err, user) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!user) {
      return res.status(401).json({ error: 'Credenciales inválidas.' });
    }
    
    const isValid = auth.verifyPassword(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Credenciales inválidas.' });
    }
    
    const token = auth.signToken({
      id: user.id,
      correo: user.correo,
      nombre: user.nombre,
      rol: user.rol,
      rut: user.rut,
      asistido_rut: user.asistido_rut
    });
    
    res.cookie('lobby_session', token, {
      httpOnly: true,
      maxAge: 30 * 60 * 1000, // 30 minutos
      sameSite: 'lax',
      path: '/'
    });
    
    res.json({
      message: 'Inicio de sesión exitoso',
      user: {
        id: user.id,
        correo: user.correo,
        nombre: user.nombre,
        rol: user.rol,
        rut: user.rut,
        asistido_rut: user.asistido_rut
      }
    });
  });
});

// Endpoint para Inicio de Sesión Único (SSO) institucional
app.post('/api/auth/sso', (req, res) => {
  const isLocal = req.ip === '127.0.0.1' || req.ip === '::1' || req.ip === '::ffff:127.0.0.1';
  if (!isLocal) {
    return res.status(403).json({ error: 'Acceso no autorizado: Solo se permiten inicios de sesión SSO desde localhost.' });
  }

  const { email, nombre, cookieHeader } = req.body;
  if (cookieHeader) {
    latestSharepointCookie = cookieHeader;
  }
  if (!email || !email.toLowerCase().trim().endsWith('@maipu.cl')) {
    return res.status(400).json({ error: 'Correo institucional inválido o no pertenece a @maipu.cl.' });
  }

  const cleanEmail = email.toLowerCase().trim();

  // Buscar al usuario en la base de datos local SQLite para validar acceso
  db.get('SELECT * FROM usuarios WHERE correo = ?', [cleanEmail], async (err, user) => {
    if (err) return res.status(500).json({ error: 'Error de base de datos: ' + err.message });

    const handleSession = (finalUser) => {
      const token = auth.signToken({
        id: finalUser.id,
        correo: finalUser.correo,
        nombre: finalUser.nombre,
        rol: finalUser.rol,
        rut: finalUser.rut || '',
        asistido_rut: finalUser.asistido_rut || ''
      });

      res.cookie('lobby_session', token, {
        httpOnly: true,
        maxAge: 8 * 60 * 60 * 1000, // 8 horas de sesión laboral para SSO
        sameSite: 'lax',
        path: '/'
      });

      // Disparar sincronización en segundo plano CON RETARDO
      // El retardo evita la race condition entre la carga del dashboard y el hot-swap de la BD
      const { checkAndSyncDatabase } = require('./src/config/db-sync');
      setTimeout(() => {
        checkAndSyncDatabase(db, cookieHeader)
          .then((updated) => {
            console.log(`[SSO Sync] Sincronización en login terminada. ¿Hubo cambios?: ${updated}`);
          })
          .catch((syncErr) => {
            console.error('[SSO Sync] Error al sincronizar en login:', syncErr.message);
          });
      }, 5000); // 5 segundos de margen para que el dashboard cargue primero

      res.json({
        message: 'SSO exitoso',
        user: {
          id: finalUser.id,
          correo: finalUser.correo,
          nombre: finalUser.nombre,
          rol: finalUser.rol
        }
      });
    };

    if (!user) {
      console.warn(`[SSO] Acceso denegado: El correo ${cleanEmail} no está registrado en la base de datos local.`);
      try {
        const { clearAllSsoData } = require('./src/config/sharepoint-auth');
        await clearAllSsoData();
      } catch (clearErr) {
        console.error('[SSO] Error al limpiar almacenamiento tras rechazo de usuario:', clearErr.message);
      }
      return res.status(403).json({ error: 'Acceso denegado: Tu correo corporativo no está registrado en el sistema. Solicita acceso al administrador.' });
    } else {
      handleSession(user);
    }
  });
});

// Endpoint para disparar interactivamente el inicio de sesión de Microsoft desde el navegador
app.post('/api/auth/trigger-sso', (req, res) => {
  if (!process.versions.electron) {
    return res.status(400).json({ error: 'SSO institucional solo está disponible al ejecutar la aplicación de escritorio.' });
  }

  const { loginWithMicrosoft } = require('./src/config/sharepoint-auth');
  loginWithMicrosoft()
    .then(async ({ userProfile, cookieHeader }) => {
      if (cookieHeader) {
        latestSharepointCookie = cookieHeader;
      }
      const email = userProfile.Email.toLowerCase().trim();
      const nombre = userProfile.Title || email.split('@')[0];

      db.get('SELECT * FROM usuarios WHERE correo = ?', [email], async (err, user) => {
        if (err) return res.status(500).json({ error: 'Error de base de datos: ' + err.message });

        const handleSession = (finalUser) => {
          const token = auth.signToken({
            id: finalUser.id,
            correo: finalUser.correo,
            nombre: finalUser.nombre,
            rol: finalUser.rol,
            rut: finalUser.rut || '',
            asistido_rut: finalUser.asistido_rut || ''
          });

          res.cookie('lobby_session', token, {
            httpOnly: true,
            maxAge: 8 * 60 * 60 * 1000,
            sameSite: 'lax',
            path: '/'
          });

          // Sincronizar en segundo plano tras el login interactivo exitoso
          const { checkAndSyncDatabase } = require('./src/config/db-sync');
          checkAndSyncDatabase(db, cookieHeader)
            .then((updated) => {
              console.log(`[SSO Trigger Sync] Sincronización finalizada. ¿Hubo cambios?: ${updated}`);
            })
            .catch((syncErr) => {
              console.error('[SSO Trigger Sync] Error al sincronizar:', syncErr.message);
            });

          res.json({
            success: true,
            user: {
              id: finalUser.id,
              correo: finalUser.correo,
              nombre: finalUser.nombre,
              rol: finalUser.rol
            }
          });
        };

        if (!user) {
          console.warn(`[SSO Trigger] Acceso denegado: El correo ${email} no está registrado en la base de datos local.`);
          try {
            const { clearAllSsoData } = require('./src/config/sharepoint-auth');
            await clearAllSsoData();
          } catch (clearErr) {
            console.error('[SSO Trigger] Error al limpiar almacenamiento tras rechazo de usuario:', clearErr.message);
          }
          return res.status(403).json({ error: 'Acceso denegado: Tu correo corporativo no está registrado en el sistema. Solicita acceso al administrador.' });
        } else {
          handleSession(user);
        }
      });
    })
    .catch((err) => {
      console.warn('[SSO Trigger] Login cancelado o fallido:', err.message);
      res.status(401).json({ error: err.message });
    });
});

app.post('/api/auth/logout', async (req, res) => {
  res.clearCookie('lobby_session', { path: '/' });

  // Si estamos en Electron, limpiar también las cookies y almacenamiento de SharePoint para permitir cambio de usuario
  if (process.versions.electron) {
    try {
      const { clearAllSsoData } = require('./src/config/sharepoint-auth');
      await clearAllSsoData();
      console.log('[SSO Logout] Datos de sesión corporativa eliminados de Electron con éxito.');
    } catch (err) {
      console.error('[SSO Logout] Error al limpiar datos de Electron:', err.message);
    }
  }

  res.json({ message: 'Sesión cerrada correctamente.' });
});

app.get('/api/auth/me', (req, res) => {
  res.json(req.user || null);
});

// Extender sesión activa por 30 minutos más (llamado desde el modal de advertencia)
app.post('/api/auth/extend', (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autorizado.' });
  const newToken = auth.signToken({
    id: req.user.id,
    correo: req.user.correo,
    nombre: req.user.nombre,
    rol: req.user.rol,
    rut: req.user.rut,
    asistido_rut: req.user.asistido_rut
  });
  res.cookie('lobby_session', newToken, {
    httpOnly: true,
    maxAge: 30 * 60 * 1000, // 30 minutos
    sameSite: 'lax',
    path: '/'
  });
  res.json({ message: 'Sesión extendida.' });
});

// ==========================================
// RUTA API: EDITAR PERFIL DE USUARIO
// ==========================================
app.put('/api/perfil', (req, res) => {
  const userId = req.user.id;
  const { nombre, correo, rut, password } = req.body;

  db.get('SELECT * FROM usuarios WHERE id = ?', [userId], (err, user) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado.' });

    let updateNombre = user.nombre;
    let updateCorreo = user.correo;
    let updateRut = user.rut;
    let updatePasswordHash = user.password_hash;

    // Administrador: Acceso total para editar campos de perfil
    if (req.user.rol === 'Administrador') {
      if (nombre !== undefined) updateNombre = nombre;
      if (rut !== undefined) updateRut = rut;
      if (correo !== undefined) updateCorreo = correo;
    } else {
      // Otros roles: solo pueden editar correo electrónico
      if (correo !== undefined) updateCorreo = correo;
    }

    // Hashear contraseña si se provee una nueva
    if (password && password.trim() !== '') {
      updatePasswordHash = auth.hashPassword(password);
    }

    // Validar correo duplicado
    if (correo && correo !== user.correo) {
      db.get('SELECT id FROM usuarios WHERE correo = ? AND id != ?', [updateCorreo, userId], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (row) {
          return res.status(400).json({ error: 'El correo electrónico ya está registrado por otro usuario.' });
        }
        performUpdate();
      });
    } else {
      performUpdate();
    }

    function performUpdate() {
      const query = 'UPDATE usuarios SET nombre = ?, correo = ?, rut = ?, password_hash = ? WHERE id = ?';
      db.run(query, [updateNombre, updateCorreo, updateRut, updatePasswordHash, userId], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        db.recalculateAndSignDatabase();
        
        // Regenerar el payload de la sesión
        const updatedPayload = {
          id: userId,
          correo: updateCorreo,
          nombre: updateNombre,
          rol: user.rol,
          rut: updateRut,
          asistido_rut: user.asistido_rut
        };
        
        const token = auth.signToken(updatedPayload);
        
        res.cookie('lobby_session', token, {
          httpOnly: true,
          maxAge: 30 * 60 * 1000, // 30 minutos (consistente con el resto de la app)
          sameSite: 'lax',
          path: '/'
        });

        // Retornar datos limpios de perfil (sin contraseña ni hash)
        res.json({
          id: userId,
          nombre: updateNombre,
          correo: updateCorreo,
          rut: updateRut,
          rol: user.rol,
          asistido_rut: user.asistido_rut
        });
      });
    }
  });
});

// ==========================================
// ENDPOINT DE ESTADÍSTICAS DEL DASHBOARD
// ==========================================
app.get('/api/stats', (req, res) => {
  const stats = {};
  if (req.user.rol === 'Sujeto Pasivo' || req.user.rol === 'Asistente técnico') {
    const targetRut = req.user.rol === 'Sujeto Pasivo' ? req.user.rut : req.user.asistido_rut;
    stats.usuarios = 1;
    stats.sujetos_pasivos = 1;
    
    const solQuery = `
      SELECT COUNT(*) AS count FROM solicitudes_sh 
      WHERE sujeto_pasivo_id IN (SELECT id_sujeto_lobby FROM sujetos_pasivos_sph WHERE rut = ?)
         OR LOWER(sujeto_pasivo) IN (SELECT LOWER(nombre) FROM sujetos_pasivos_sph WHERE rut = ?)
    `;
    db.get(solQuery, [targetRut, targetRut], (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      stats.solicitudes = row.count;
      
      const pubQuery = `
        SELECT COUNT(*) AS count FROM publicadas_ph 
        WHERE LOWER(sujeto_pasivo) IN (SELECT LOWER(nombre) FROM sujetos_pasivos_sph WHERE rut = ?)
      `;
      db.get(pubQuery, [targetRut], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        stats.publicadas = row.count;
        res.json(stats);
      });
    });
  } else {
    db.get('SELECT COUNT(*) AS count FROM usuarios', (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      stats.usuarios = row.count;

      db.get('SELECT COUNT(*) AS count FROM solicitudes_sh', (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        stats.solicitudes = row.count;

        db.get('SELECT COUNT(*) AS count FROM publicadas_ph', (err, row) => {
          if (err) return res.status(500).json({ error: err.message });
          stats.publicadas = row.count;

          db.get('SELECT COUNT(*) AS count FROM sujetos_pasivos_sph', (err, row) => {
            if (err) return res.status(500).json({ error: err.message });
            stats.sujetos_pasivos = row.count;
            res.json(stats);
          });
        });
      });
    });
  }
});

// ==========================================
// RUTAS API: USUARIOS
// ==========================================
// Middleware para proteger endpoints de gestión de usuarios (solo Administrador)
app.use('/api/usuarios', (req, res, next) => {
  if (req.user.rol !== 'Administrador') {
    return res.status(403).json({ error: 'Acceso denegado. Se requieren privilegios de Administrador.' });
  }
  next();
});

app.get('/api/usuarios', (req, res) => {
  db.all('SELECT * FROM usuarios ORDER BY id DESC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/usuarios', (req, res) => {
  const { correo, nombre, rol, password, rut, asistido_rut } = req.body;
  if (!correo || !nombre || !password) {
    return res.status(400).json({ error: 'Correo, Nombre y Contraseña son obligatorios.' });
  }
  const password_hash = auth.hashPassword(password);
  const query = 'INSERT INTO usuarios (correo, nombre, rol, password_hash, rut, asistido_rut) VALUES (?, ?, ?, ?, ?, ?)';
  db.run(query, [correo, nombre, rol || 'Analista', password_hash, rut || '', asistido_rut || ''], function(err) {
    if (err) {
      if (err.message.includes('UNIQUE constraint failed')) {
        return res.status(400).json({ error: 'El correo electrónico ya está registrado.' });
      }
      return res.status(500).json({ error: err.message });
    }
    db.recalculateAndSignDatabase();
    res.status(201).json({ id: this.lastID, correo, nombre, rol: rol || 'Analista', rut: rut || '', asistido_rut: asistido_rut || '' });
  });
});

app.put('/api/usuarios/:id', (req, res) => {
  const { id } = req.params;
  const { correo, nombre, rol, password, rut, asistido_rut } = req.body;
  
  if (password && password.trim() !== '') {
    const password_hash = auth.hashPassword(password);
    const query = 'UPDATE usuarios SET correo = ?, nombre = ?, rol = ?, password_hash = ?, rut = ?, asistido_rut = ? WHERE id = ?';
    db.run(query, [correo, nombre, rol, password_hash, rut || '', asistido_rut || '', id], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: 'Usuario no encontrado.' });
      db.recalculateAndSignDatabase();
      res.json({ id, correo, nombre, rol, rut: rut || '', asistido_rut: asistido_rut || '' });
    });
  } else {
    const query = 'UPDATE usuarios SET correo = ?, nombre = ?, rol = ?, rut = ?, asistido_rut = ? WHERE id = ?';
    db.run(query, [correo, nombre, rol, rut || '', asistido_rut || '', id], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: 'Usuario no encontrado.' });
      db.recalculateAndSignDatabase();
      res.json({ id, correo, nombre, rol, rut: rut || '', asistido_rut: asistido_rut || '' });
    });
  }
});

app.delete('/api/usuarios/:id', (req, res) => {
  const { id } = req.params;
  
  if (Number(id) === Number(req.user.id)) {
    return res.status(400).json({ error: 'No puedes eliminar a tu propio usuario.' });
  }

  db.run('DELETE FROM usuarios WHERE id = ?', id, function(err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'Usuario no encontrado.' });
    db.recalculateAndSignDatabase();
    res.json({ message: 'Usuario eliminado correctamente', id });
  });
});

// ==========================================
// RUTAS API: SOLICITUDES SH
// ==========================================
app.get('/api/solicitudes', (req, res) => {
  console.log('GET /api/solicitudes query:', req.query);
  const all = req.query.all === 'true' || (!req.query.page && !req.query.limit);
  const pendingPub = req.query.pending_publication === 'true';

  let whereClauses = [];
  let params = [];

  // Filtro de rol (sujeto pasivo / asistente técnico)
  if (req.user.rol === 'Sujeto Pasivo' || req.user.rol === 'Asistente técnico') {
    const targetRut = req.user.rol === 'Sujeto Pasivo' ? req.user.rut : req.user.asistido_rut;
    whereClauses.push(`(sujeto_pasivo_id IN (SELECT id_sujeto_lobby FROM sujetos_pasivos_sph WHERE rut = ?) OR LOWER(sujeto_pasivo) IN (SELECT LOWER(nombre) FROM sujetos_pasivos_sph WHERE rut = ?))`);
    params.push(targetRut, targetRut);
  }

  if (pendingPub) {
    whereClauses.push(`LOWER(estado) = 'aceptada'`);
    whereClauses.push(`fecha_agendada IS NOT NULL AND fecha_agendada != '' AND fecha_agendada != '-'`);
    whereClauses.push(`(folio_lobby IS NULL OR folio_lobby = '' OR folio_lobby NOT IN (SELECT folio_lobby FROM publicadas_ph WHERE folio_lobby IS NOT NULL AND folio_lobby != ''))`);
  }

  // Filtros dinámicos
  if (req.query.folio) {
    whereClauses.push(`folio_lobby LIKE ?`);
    params.push(`%${req.query.folio}%`);
  }
  if (req.query.nombre) {
    whereClauses.push(`sujeto_pasivo LIKE ?`);
    params.push(`%${req.query.nombre}%`);
  }
  if (req.query.cargo) {
    whereClauses.push(`cargo_limpio LIKE ?`);
    params.push(`%${req.query.cargo}%`);
  }
  if (req.query.sujetoActivoRepresentado) {
    whereClauses.push(`(sujeto_activo LIKE ? OR representado LIKE ? OR rut LIKE ?)`);
    params.push(`%${req.query.sujetoActivoRepresentado}%`, `%${req.query.sujetoActivoRepresentado}%`, `%${req.query.sujetoActivoRepresentado}%`);
  }
  if (req.query.relacionSujetoActivo || req.query.relacionRut || req.query.relacionRepresentado) {
    let subClauses = [];
    if (req.query.relacionSujetoActivo) {
      subClauses.push(`sujeto_activo LIKE ?`);
      params.push(req.query.relacionSujetoActivo);
    }
    if (req.query.relacionRut) {
      subClauses.push(`rut LIKE ?`);
      params.push(req.query.relacionRut);
    }
    if (req.query.relacionRepresentado && req.query.relacionRepresentado.toLowerCase() !== 'particular') {
      subClauses.push(`representado LIKE ?`);
      params.push(req.query.relacionRepresentado);
    }
    if (subClauses.length > 0) {
      whereClauses.push(`(${subClauses.join(' OR ')})`);
    }
  }


  if (pendingPub) {
    if (req.query.estado) {
      const val = req.query.estado.toLowerCase();
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

    if (all) {
      const query = `SELECT id, id_lobby, folio_lobby, fecha_ingreso, fecha_respuesta, fecha_agendada, sujeto_pasivo, cargo, sujeto_pasivo_id, sujeto_activo, rut, representado, estado, cargo_limpio, codigo_licitacion, fecha_limite_sh, dias_habiles_respuesta, estado_cumplimiento_sh, fecha_limite_publicacion, genero FROM solicitudes_sh ${finalWhereSql} ORDER BY id_lobby DESC`;
      db.all(query, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        injectDynamicFields(rows, () => {
          res.json(rows);
        });
      });
    } else {
      const page = parseInt(req.query.page, 10) || 1;
      const limit = parseInt(req.query.limit, 10) || 10;
      const offset = (page - 1) * limit;

      const countQuery = `SELECT COUNT(*) AS total FROM solicitudes_sh ${finalWhereSql}`;
      const dataQuery = `SELECT * FROM solicitudes_sh ${finalWhereSql} ORDER BY id_lobby DESC LIMIT ? OFFSET ?`;

      db.get(countQuery, params, (err, countRow) => {
        if (err) return res.status(500).json({ error: err.message });
        const totalItems = countRow ? countRow.total : 0;

        db.all(dataQuery, [...params, limit, offset], (err, rows) => {
          if (err) return res.status(500).json({ error: err.message });
          injectDynamicFields(rows, () => {
            res.json({
              data: rows,
              totalItems,
              page,
              limit
            });
          });
        });
      });
    }
  } else {
    // Para solicitudes normales
    if (req.query.estado) {
      whereClauses.push(`LOWER(estado) = ?`);
      params.push(req.query.estado.toLowerCase());
    }
    const finalWhereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    if (all) {
      const query = `SELECT id, id_lobby, folio_lobby, fecha_ingreso, fecha_respuesta, fecha_agendada, sujeto_pasivo, cargo, sujeto_pasivo_id, sujeto_activo, rut, representado, estado, cargo_limpio, codigo_licitacion, fecha_limite_sh, dias_habiles_respuesta, estado_cumplimiento_sh, fecha_limite_publicacion, genero FROM solicitudes_sh ${finalWhereSql} ORDER BY id_lobby DESC`;
      db.all(query, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        injectDynamicFields(rows, () => {
          res.json(rows);
        });
      });
    } else {
      const page = parseInt(req.query.page, 10) || 1;
      const limit = parseInt(req.query.limit, 10) || 10;
      const offset = (page - 1) * limit;

      const countQuery = `SELECT COUNT(*) AS total FROM solicitudes_sh ${finalWhereSql}`;
      const dataQuery = `SELECT * FROM solicitudes_sh ${finalWhereSql} ORDER BY id_lobby DESC LIMIT ? OFFSET ?`;

      db.get(countQuery, params, (err, countRow) => {
        if (err) return res.status(500).json({ error: err.message });
        const totalItems = countRow ? countRow.total : 0;

        db.all(dataQuery, [...params, limit, offset], (err, rows) => {
          if (err) return res.status(500).json({ error: err.message });
          injectDynamicFields(rows, () => {
            res.json({
              data: rows,
              totalItems,
              page,
              limit
            });
          });
        });
      });
    }
  }
});

// ==========================================
// RUTA API: ALERTAS DE PLAZOS LEGALES (SEMÁFORO)
// ==========================================
app.get('/api/alertas', (req, res) => {
  let userWhereClauses = [];
  let userParams = [];

  // Filtro de rol (sujeto pasivo / asistente técnico)
  if (req.user.rol === 'Sujeto Pasivo' || req.user.rol === 'Asistente técnico') {
    const targetRut = req.user.rol === 'Sujeto Pasivo' ? req.user.rut : req.user.asistido_rut;
    userWhereClauses.push(`(sujeto_pasivo_id IN (SELECT id_sujeto_lobby FROM sujetos_pasivos_sph WHERE rut = ?) OR LOWER(sujeto_pasivo) IN (SELECT LOWER(nombre) FROM sujetos_pasivos_sph WHERE rut = ?))`);
    userParams.push(targetRut, targetRut);
  }

  const userWhereSql = userWhereClauses.length > 0 ? `AND ${userWhereClauses.join(' AND ')}` : '';

  // 1. Obtener solicitudes "Ingresada"
  const queryIngresadas = `
    SELECT solicitudes_sh.id, solicitudes_sh.folio_lobby, solicitudes_sh.sujeto_pasivo, solicitudes_sh.fecha_ingreso, solicitudes_sh.fecha_limite_sh, solicitudes_sh.estado_cumplimiento_sh, a.estado AS estado_gestion
    FROM solicitudes_sh
    LEFT JOIN alertas_gestionadas a ON a.tipo = 'solicitud' AND a.solicitud_id = solicitudes_sh.id
    WHERE LOWER(solicitudes_sh.estado) = 'ingresada'
      AND (a.estado IS NULL OR a.estado != 'borrada')
      ${userWhereSql}
    ORDER BY solicitudes_sh.fecha_limite_sh ASC
  `;

  // 2. Obtener publicaciones pendientes
  const queryPendientesPub = `
    SELECT solicitudes_sh.id, solicitudes_sh.folio_lobby, solicitudes_sh.sujeto_pasivo, solicitudes_sh.fecha_agendada, solicitudes_sh.fecha_limite_publicacion, a.estado AS estado_gestion
    FROM solicitudes_sh
    LEFT JOIN alertas_gestionadas a ON a.tipo = 'publicacion' AND a.solicitud_id = solicitudes_sh.id
    WHERE LOWER(solicitudes_sh.estado) = 'aceptada'
      AND solicitudes_sh.fecha_agendada IS NOT NULL AND solicitudes_sh.fecha_agendada != '' AND solicitudes_sh.fecha_agendada != '-'
      AND (solicitudes_sh.folio_lobby IS NULL OR solicitudes_sh.folio_lobby = '' OR solicitudes_sh.folio_lobby NOT IN (SELECT folio_lobby FROM publicadas_ph WHERE folio_lobby IS NOT NULL AND folio_lobby != ''))
      AND (a.estado IS NULL OR a.estado != 'borrada')
      ${userWhereSql}
    ORDER BY solicitudes_sh.fecha_limite_publicacion ASC
  `;

  db.all(queryIngresadas, userParams, (err, ingresadas) => {
    if (err) return res.status(500).json({ error: err.message });
    injectDynamicFields(ingresadas, () => {
      db.all(queryPendientesPub, userParams, (err, pendientesPub) => {
        if (err) return res.status(500).json({ error: err.message });
        injectDynamicFields(pendientesPub, () => {
          res.json({
            ingresadas,
            pendientesPub
          });
        });
      });
    });
  });
});

// RUTA API: ACTUALIZAR EL ESTADO DE ALERTA (MARCAR COMO LEÍDA/BORRADA)
app.post('/api/alertas/gestionar', (req, res) => {
  const { alertas } = req.body;
  if (!alertas || !Array.isArray(alertas) || alertas.length === 0) {
    return res.status(400).json({ error: 'Faltan parámetros o el formato de alertas es inválido' });
  }

  db.serialize(() => {
    let hasError = false;
    let processedCount = 0;

    const finalize = () => {
      processedCount++;
      if (processedCount === alertas.length) {
        if (hasError) {
          return res.status(500).json({ error: 'Hubo un error procesando algunas alertas' });
        }
        // Recalcular firma digital de la base de datos al realizar una modificación legítima
        db.recalculateAndSignDatabase();
        res.json({ success: true, message: 'Alertas gestionadas correctamente' });
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
        // Marcar como no leída (remover de alertas_gestionadas)
        db.run(
          `DELETE FROM alertas_gestionadas WHERE tipo = ? AND solicitud_id = ?`,
          [tipo, solicitud_id],
          (err) => {
            if (err) {
              console.error('Error al remover alerta gestionada:', err.message);
              hasError = true;
            }
            finalize();
          }
        );
      } else {
        // Insertar o actualizar el estado ('leida' o 'borrada')
        db.run(
          `INSERT OR REPLACE INTO alertas_gestionadas (tipo, solicitud_id, estado, fecha_actualizacion) VALUES (?, ?, ?, CURRENT_TIMESTAMP)`,
          [tipo, solicitud_id, estado],
          (err) => {
            if (err) {
              console.error('Error al insertar/actualizar alerta gestionada:', err.message);
              hasError = true;
            }
            finalize();
          }
        );
      }
    });
  });
});

// ==========================================
// RUTAS API: PUBLICADAS PH
// ==========================================
app.get('/api/publicadas', (req, res) => {
  console.log('GET /api/publicadas query:', req.query);
  const all = req.query.all === 'true' || (!req.query.page && !req.query.limit);

  let whereClauses = [];
  let params = [];

  // Filtro de rol (sujeto pasivo / asistente técnico)
  if (req.user.rol === 'Sujeto Pasivo' || req.user.rol === 'Asistente técnico') {
    const targetRut = req.user.rol === 'Sujeto Pasivo' ? req.user.rut : req.user.asistido_rut;
    whereClauses.push(`LOWER(sujeto_pasivo) IN (SELECT LOWER(nombre) FROM sujetos_pasivos_sph WHERE rut = ?)`);
    params.push(targetRut);
  }

  // Filtros dinámicos
  if (req.query.folio) {
    whereClauses.push(`folio_lobby LIKE ?`);
    params.push(`%${req.query.folio}%`);
  }
  if (req.query.nombre) {
    whereClauses.push(`sujeto_pasivo LIKE ?`);
    params.push(`%${req.query.nombre}%`);
  }
  if (req.query.cargo) {
    whereClauses.push(`cargo LIKE ?`);
    params.push(`%${req.query.cargo}%`);
  }
  if (req.query.sujetoActivoRepresentado) {
    whereClauses.push(`(sujeto_activo LIKE ? OR representado LIKE ? OR rut LIKE ?)`);
    params.push(`%${req.query.sujetoActivoRepresentado}%`, `%${req.query.sujetoActivoRepresentado}%`, `%${req.query.sujetoActivoRepresentado}%`);
  }
  if (req.query.relacionSujetoActivo || req.query.relacionRut || req.query.relacionRepresentado) {
    let subClauses = [];
    if (req.query.relacionSujetoActivo) {
      subClauses.push(`sujeto_activo LIKE ?`);
      params.push(req.query.relacionSujetoActivo);
    }
    if (req.query.relacionRut) {
      subClauses.push(`rut LIKE ?`);
      params.push(req.query.relacionRut);
    }
    if (req.query.relacionRepresentado && req.query.relacionRepresentado.toLowerCase() !== 'particular') {
      subClauses.push(`representado LIKE ?`);
      params.push(req.query.relacionRepresentado);
    }
    if (subClauses.length > 0) {
      whereClauses.push(`(${subClauses.join(' OR ')})`);
    }
  }

  if (req.query.estado) {
    const val = req.query.estado.toLowerCase();
    if (val === 'fuera de plazo') {
      whereClauses.push(`LOWER(cumplimiento) LIKE 'fuera%'`);
    } else {
      whereClauses.push(`LOWER(cumplimiento) = 'en plazo'`);
    }
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  if (all) {
    const query = `SELECT id, id_lobby, folio_lobby, estado, forma, lugar, comuna, sujeto_pasivo, cargo, sujeto_activo, rut, genero, tipo, representado, fecha_inicio, fecha_termino, duracion, fecha_publicacion, cumplimiento, id_solicitud_lobby FROM publicadas_ph ${whereSql} ORDER BY id_lobby DESC`;
    db.all(query, params, (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    });
  } else {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const offset = (page - 1) * limit;

    const countQuery = `SELECT COUNT(*) AS total FROM publicadas_ph ${whereSql}`;
    const dataQuery = `SELECT * FROM publicadas_ph ${whereSql} ORDER BY id_lobby DESC LIMIT ? OFFSET ?`;

    db.get(countQuery, params, (err, countRow) => {
      if (err) return res.status(500).json({ error: err.message });
      const totalItems = countRow ? countRow.total : 0;

      db.all(dataQuery, [...params, limit, offset], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({
          data: rows,
          totalItems,
          page,
          limit
        });
      });
    });
  }
});

// ==========================================
// RUTAS API: SUJETOS PASIVOS SPH
// ==========================================
app.get('/api/sujetos_pasivos', (req, res) => {
  if (req.user.rol === 'Sujeto Pasivo' || req.user.rol === 'Asistente técnico') {
    return res.status(403).json({ error: 'Acceso denegado. No autorizado para consultar sujetos pasivos.' });
  }
  db.all('SELECT * FROM sujetos_pasivos_sph ORDER BY fecha_incorporacion DESC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.get('/api/sujetos_pasivos/vigentes', (req, res) => {
  db.all('SELECT id_sujeto_lobby FROM sujetos_pasivos_vigentes', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const ids = rows.map(r => r.id_sujeto_lobby);
    res.json(ids);
  });
});

// ==========================================
// RUTA API: ÚLTIMA MODIFICACIÓN DE LA BASE DE DATOS
// ==========================================
app.get('/api/db-last-update', (req, res) => {
  db.get("SELECT valor FROM configuracion WHERE clave = 'last_import_timestamp'", [], (err, row) => {
    if (err || !row || !row.valor) {
      return res.json({ dbLastUpdate: 'No se registran importaciones' });
    }
    res.json({ dbLastUpdate: row.valor });
  });
});

// RUTA API: IMPORTAR EXCEL (ADMINISTRADOR)
// ==========================================
app.post('/api/admin/importar', (req, res) => {
  if (req.user.rol !== 'Administrador') {
    return res.status(403).json({ error: 'Acceso denegado. Se requieren privilegios de Administrador.' });
  }

  if (isImporting) {
    return res.status(409).json({ error: 'Ya hay un proceso de sincronización activo. Por favor, espere a que finalice.' });
  }

  const { fileData } = req.body;
  const fs = require('fs');
  const dbDir = db.getUserDataDir();
  const excelFile = process.env.IS_ELECTRON === 'true'
    ? path.join(dbDir, 'lobby_data.xlsx')
    : (path.isAbsolute(process.env.EXCEL_PATH || 'lobby_data.xlsx')
        ? (process.env.EXCEL_PATH || 'lobby_data.xlsx')
        : path.join(__dirname, process.env.EXCEL_PATH || 'lobby_data.xlsx'));

  if (fileData) {
    try {
      // Asegurar que la carpeta contenedora exista
      const excelDir = path.dirname(excelFile);
      if (!fs.existsSync(excelDir)) {
        fs.mkdirSync(excelDir, { recursive: true });
      }

      // Decodificar Base64 y guardar el archivo Excel
      const buffer = Buffer.from(fileData, 'base64');
      fs.writeFileSync(excelFile, buffer);
      console.log(`Excel recibido y guardado con éxito en: ${excelFile}`);
    } catch (writeErr) {
      console.error('Error al guardar el archivo Excel subido:', writeErr);
      return res.status(500).json({ error: `No se pudo guardar el archivo Excel en el servidor: ${writeErr.message}` });
    }
  }

  isImporting = true;

  const { fork } = require('child_process');
  const child = fork(
    path.join(__dirname, 'scripts', 'import_lobby.js'),
    [],
    {
      env: {
        ...process.env,
        IS_ELECTRON: process.env.IS_ELECTRON,
        EXE_DIR: process.env.EXE_DIR,
        USER_DATA_DIR: process.env.USER_DATA_DIR || path.dirname(dbDir), // Pasar el directorio raíz de AppData para evitar duplicados "data/data"
        SHAREPOINT_COOKIES: latestSharepointCookie,
        IMPORT_USER_NAME: req.user.nombre,
        IMPORT_USER_EMAIL: req.user.correo
      }
    }
  );

  let finished = false;

  // Control de aborto: si el cliente cierra la pestaña, recarga o pierde la conexión
  res.on('close', () => {
    if (!finished && child.exitCode === null) {
      console.log('Cliente desconectado de la petición de importación. Terminando subproceso hijo...');
      child.kill('SIGTERM');
    }
  });

  child.on('message', (message) => {
    if (message && message.type === 'import_stats') {
      finished = true;
      isImporting = false;

      res.json({
        success: true,
        stats: message.stats
      });
    }
  });

  child.on('error', (err) => {
    console.error('Error en proceso secundario de importación:', err);
    if (!finished) {
      finished = true;
      isImporting = false;
      res.status(500).json({ error: 'Error interno durante el procesamiento del archivo Excel: ' + err.message });
    }
  });

  child.on('exit', (code) => {
    if (!finished) {
      finished = true;
      isImporting = false;
      res.status(500).json({ error: `El proceso de importación finalizó inesperadamente con código de salida ${code}.` });
    }
  });
});

// ==========================================
// RUTA API: SINCRONIZAR DESDE SHAREPOINT (ADMINISTRADOR)
// ==========================================
app.post('/api/admin/sincronizar-desde-sharepoint', (req, res) => {
  if (req.user.rol !== 'Administrador') {
    return res.status(403).json({ error: 'Acceso denegado. Se requieren privilegios de Administrador.' });
  }

  if (!latestSharepointCookie) {
    return res.status(400).json({ error: 'No hay credenciales corporativas activas en el servidor. Por favor, inicie sesión con su Cuenta Institucional (SSO) para poder sincronizar desde SharePoint.' });
  }

  const { checkAndSyncDatabase } = require('./src/config/db-sync');
  checkAndSyncDatabase(db, latestSharepointCookie)
    .then((updated) => {
      res.json({
        success: true,
        updated,
        message: updated 
          ? 'Sincronización completada: Se descargó y aplicó una nueva versión de la base de datos desde SharePoint.' 
          : 'La base de datos local ya está al día con la versión de SharePoint.'
      });
    })
    .catch((err) => {
      console.error('Error al sincronizar con SharePoint:', err);
      res.status(500).json({ error: `Error al sincronizar con SharePoint: ${err.message}` });
    });
});

// ==========================================
// RUTA API: HISTORIAL DE SINCRONIZACIONES (ADMINISTRADOR)
// ==========================================
app.get('/api/admin/historial-sincronizaciones', (req, res) => {
  if (req.user.rol !== 'Administrador') {
    return res.status(403).json({ error: 'Acceso denegado. Se requieren privilegios de Administrador.' });
  }
  db.all('SELECT * FROM historial_sincronizaciones ORDER BY id DESC LIMIT 5', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Helper para dar formato legible a los bytes
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// ==========================================
// RUTA API: DIAGNÓSTICO Y SALUD DE LA BASE DE DATOS (ADMINISTRADOR)
// ==========================================
app.get('/api/admin/db-health', (req, res) => {
  if (req.user.rol !== 'Administrador') {
    return res.status(403).json({ error: 'Acceso denegado. Se requieren privilegios de Administrador.' });
  }

  const fs = require('fs');
  const dbDir = db.getUserDataDir();
  const dbFile = db.getDbPath();
  const excelFile = process.env.IS_ELECTRON === 'true'
    ? path.join(dbDir, 'lobby_data.xlsx')
    : (path.isAbsolute(process.env.EXCEL_PATH || 'lobby_data.xlsx')
        ? (process.env.EXCEL_PATH || 'lobby_data.xlsx')
        : path.join(__dirname, process.env.EXCEL_PATH || 'lobby_data.xlsx'));

  let dbSize = 'No encontrado';
  try {
    const stats = fs.statSync(dbFile);
    dbSize = formatBytes(stats.size);
  } catch (e) {}

  let excelSize = 'No encontrado';
  try {
    const stats = fs.statSync(excelFile);
    excelSize = formatBytes(stats.size);
  } catch (e) {}

  db.get('PRAGMA integrity_check', [], (err, row) => {
    const integrity = (err || !row) ? 'Error al verificar' : row.integrity_check;
    res.json({
      dbSize,
      excelSize,
      excelPath: excelFile,
      integrity
    });
  });
});

// ==========================================
// RUTA API: COPIA DE SEGURIDAD (ADMINISTRADOR)
// ==========================================
app.get('/api/admin/backup', (req, res) => {
  if (req.user.rol !== 'Administrador') {
    return res.status(403).json({ error: 'Acceso denegado. Se requieren privilegios de Administrador.' });
  }

  const dbFile = path.isAbsolute(process.env.DATABASE_PATH || 'lobby.db')
    ? (process.env.DATABASE_PATH || 'lobby.db')
    : path.join(__dirname, process.env.DATABASE_PATH || 'lobby.db');
  
  // Generar nombre de archivo dinámico lobby_backup_YYYYMMDD.db
  const date = new Date();
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const dynamicFileName = `lobby_backup_${yyyy}${mm}${dd}.db`;

  res.download(dbFile, dynamicFileName, (err) => {
    if (err) {
      console.error('Error al descargar copia de seguridad:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Error al generar la descarga del respaldo.' });
      }
    }
  });
});

// ==========================================
// RUTAS API: AUDITORÍA SEMANAL (ADMINISTRADOR)
// ==========================================
app.get('/api/admin/auditoria', (req, res) => {
  if (req.user.rol !== 'Administrador') {
    return res.status(403).json({ error: 'Acceso denegado. Se requieren privilegios de Administrador.' });
  }
  db.all('SELECT * FROM auditoria_semanal ORDER BY fecha ASC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.get('/api/admin/auditoria/valores-actuales', (req, res) => {
  if (req.user.rol !== 'Administrador') {
    return res.status(403).json({ error: 'Acceso denegado. Se requieren privilegios de Administrador.' });
  }

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

  db.get(querySol, [], (err, solRow) => {
    if (err) return res.status(500).json({ error: err.message });

    db.get('SELECT COUNT(*) AS publicada FROM publicadas_ph', [], (err, pubRow) => {
      if (err) return res.status(500).json({ error: err.message });

      res.json({
        ingresada: solRow.ingresada || 0,
        aceptada: solRow.aceptada || 0,
        rechazada: solRow.rechazada || 0,
        suspendida: solRow.suspendida || 0,
        cancelada: solRow.cancelada || 0,
        encomendada: solRow.encomendada || 0,
        publicada: pubRow.publicada || 0
      });
    });
  });
});

app.post('/api/admin/auditoria', (req, res) => {
  if (req.user.rol !== 'Administrador') {
    return res.status(403).json({ error: 'Acceso denegado. Se requieren privilegios de Administrador.' });
  }
  const { fecha, total, ingresada, aceptada, rechazada, suspendida, cancelada, encomendada, publicada } = req.body;
  if (!fecha) {
    return res.status(400).json({ error: 'La fecha es requerida.' });
  }
  const query = `
    INSERT INTO auditoria_semanal (fecha, total, ingresada, aceptada, rechazada, suspendida, cancelada, encomendada, publicada, usuario, estado)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'En Proceso')
  `;
  const usuario = req.user.nombre || req.user.correo;
  db.run(query, [fecha, total || 0, ingresada || 0, aceptada || 0, rechazada || 0, suspendida || 0, cancelada || 0, encomendada || 0, publicada || 0, usuario], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    db.recalculateAndSignDatabase();
    res.status(201).json({ id: this.lastID, message: 'Registro de auditoría guardado exitosamente.' });
  });
});

app.put('/api/admin/auditoria/:id', (req, res) => {
  if (req.user.rol !== 'Administrador') {
    return res.status(403).json({ error: 'Acceso denegado. Se requieren privilegios de Administrador.' });
  }
  const { id } = req.params;
  const { fecha, total, ingresada, aceptada, rechazada, suspendida, cancelada, encomendada, publicada, estado } = req.body;
  if (!fecha) {
    return res.status(400).json({ error: 'La fecha es requerida.' });
  }
  const query = `
    UPDATE auditoria_semanal
    SET fecha = ?, total = ?, ingresada = ?, aceptada = ?, rechazada = ?, suspendida = ?, cancelada = ?, encomendada = ?, publicada = ?, estado = COALESCE(?, estado)
    WHERE id = ?
  `;
  db.run(query, [fecha, total || 0, ingresada || 0, aceptada || 0, rechazada || 0, suspendida || 0, cancelada || 0, encomendada || 0, publicada || 0, estado || null, id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'Registro no encontrado.' });
    db.recalculateAndSignDatabase();
    res.json({ message: 'Registro de auditoría actualizado exitosamente.' });
  });
});

app.delete('/api/admin/auditoria/:id', (req, res) => {
  if (req.user.rol !== 'Administrador') {
    return res.status(403).json({ error: 'Acceso denegado. Se requieren privilegios de Administrador.' });
  }
  const { id } = req.params;
  db.run('DELETE FROM auditoria_semanal WHERE id = ?', id, function(err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'Registro no encontrado.' });
    db.recalculateAndSignDatabase();
    res.json({ message: 'Registro de auditoría eliminado exitosamente.' });
  });
});

// ==========================================
// RUTA API: REGISTRAR REPORTE GENERADO
// ==========================================
app.post('/api/reportes/registrar', (req, res) => {
  const { sujeto_pasivo, cargo, filtros } = req.body;
  const now = new Date();
  
  // Obtener fecha en zona horaria local de Chile
  const chileTime = new Date(now.toLocaleString("en-US", { timeZone: "America/Santiago" }));
  const yy = String(chileTime.getFullYear()).slice(-2);
  const mm = String(chileTime.getMonth() + 1).padStart(2, '0');
  const dd = String(chileTime.getDate()).padStart(2, '0');
  const datePrefix = `${yy}${mm}${dd}`; // ej. "260615"

  // Consultar el total global de reportes para el correlativo secuencial
  db.get(
    "SELECT COUNT(*) as count FROM reportes_generados",
    [],
    (err, row) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Error al consultar correlativo global de reportes.' });
      }
      
      const consecutive = String((row ? row.count : 0) + 1).padStart(3, '0');
      const codigo_reporte = `RAP${datePrefix}-${consecutive}`;

      db.run(
        "INSERT INTO reportes_generados (codigo_reporte, fecha_generacion, sujeto_pasivo, cargo, filtros) VALUES (?, ?, ?, ?, ?)",
        [codigo_reporte, now.toISOString(), sujeto_pasivo, cargo, JSON.stringify(filtros)],
        function (err) {
          if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Error al registrar el reporte en la base de datos.' });
          }
          db.recalculateAndSignDatabase();
          res.json({ success: true, codigo_reporte });
        }
      );
    }
  );
});

// ==========================================
// RUTAS API: INSPECTOR DE BASE DE DATOS (ADMINISTRADOR)
// ==========================================
app.get('/api/admin/inspector/tables', (req, res) => {
  if (req.user.rol !== 'Administrador') {
    return res.status(403).json({ error: 'Acceso denegado. Se requieren privilegios de Administrador.' });
  }

  const query = "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name ASC";
  db.all(query, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const tables = rows.map(r => r.name);
    res.json(tables);
  });
});

app.get('/api/admin/inspector/data', (req, res) => {
  if (req.user.rol !== 'Administrador') {
    return res.status(403).json({ error: 'Acceso denegado. Se requieren privilegios de Administrador.' });
  }

  const tableName = req.query.table;
  if (!tableName) {
    return res.status(400).json({ error: 'El parámetro "table" es obligatorio.' });
  }

  // Lista blanca estricta de tablas para evitar SQL injection
  const whitelistedTables = [
    'usuarios',
    'solicitudes_sh',
    'publicadas_ph',
    'sujetos_pasivos_sph',
    'configuracion',
    'historial_sincronizaciones',
    'auditoria_semanal',
    'sujetos_pasivos_vigentes',
    'reportes_generados'
  ];

  if (!whitelistedTables.includes(tableName)) {
    return res.status(400).json({ error: 'Nombre de tabla no permitido o inválido.' });
  }

  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const offset = (page - 1) * limit;
  const search = req.query.search || '';

  // 1. Obtener la metadata de las columnas de la tabla
  db.all(`PRAGMA table_info(${tableName})`, [], (err, columns) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!columns || columns.length === 0) {
      return res.status(404).json({ error: `No se encontró metadata para la tabla "${tableName}".` });
    }

    const colNames = columns.map(c => c.name);
    let countQuery = `SELECT COUNT(*) AS total FROM ${tableName}`;
    let dataQuery = `SELECT * FROM ${tableName}`;
    let whereClauses = [];
    let params = [];

    // 2. Construir la consulta de búsqueda en base a todas las columnas
    if (search.trim() !== '') {
      const searchVal = `%${search.trim()}%`;
      colNames.forEach(col => {
        // En SQLite es seguro usar LIKE en columnas numéricas y de texto
        whereClauses.push(`"${col}" LIKE ?`);
        params.push(searchVal);
      });
    }

    if (whereClauses.length > 0) {
      const whereSql = ` WHERE ` + whereClauses.join(' OR ');
      countQuery += whereSql;
      dataQuery += whereSql;
    }

    // Ordenar de forma descendente si existe columna ID, sino por la primera columna
    const orderCol = colNames.includes('id') ? 'id' : colNames[0];
    dataQuery += ` ORDER BY "${orderCol}" DESC LIMIT ? OFFSET ?`;

    db.get(countQuery, params, (err, countRow) => {
      if (err) return res.status(500).json({ error: err.message });
      const total = countRow ? countRow.total : 0;

      db.all(dataQuery, [...params, limit, offset], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({
          columns,
          rows,
          total,
          page,
          limit
        });
      });
    });
  });
});

// Manejo de errores global no controlados
app.use((err, req, res, next) => {
  console.error('❌ ERROR INTERNO EN SERVIDOR:', err.stack || err);
  if (!res.headersSent) {
    res.status(500).json({ error: 'Error interno en el servidor local: ' + err.message });
  }
});

module.exports = app;

