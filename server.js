require('dotenv').config();
const express = require('express');
const path = require('path');
const db = require('./src/config/database');
const auth = require('./src/middleware/auth');
const rateLimit = require('express-rate-limit');
const dateUtils = require('./src/utils/date-utils');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // Máximo 5 intentos por IP
  message: { error: 'Demasiados intentos de inicio de sesión. Por favor intente de nuevo en 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false
});

const app = express();
const PORT = process.env.PORT || 3000;

// Semáforo de control para importaciones concurrentes
let isImporting = false;

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
      const estadoClean = (item.estado || 'Ingresada').trim();
      
      if (estadoClean === 'Ingresada') {
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
      } else if (estadoClean === 'Aceptada' && item.fecha_agendada) {
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

// Middleware para parsear JSON y datos de formularios
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Middleware de autenticación global para la API
app.use('/api', (req, res, next) => {
  // Las rutas de login y última modificación son públicas
  if (req.path === '/auth/login' || req.path === '/db-last-update') {
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
app.post('/api/auth/login', loginLimiter, (req, res) => {
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

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('lobby_session', { path: '/' });
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
      res.json({ id, correo, nombre, rol, rut: rut || '', asistido_rut: asistido_rut || '' });
    });
  } else {
    const query = 'UPDATE usuarios SET correo = ?, nombre = ?, rol = ?, rut = ?, asistido_rut = ? WHERE id = ?';
    db.run(query, [correo, nombre, rol, rut || '', asistido_rut || '', id], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: 'Usuario no encontrado.' });
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
    whereClauses.push(`estado = 'Aceptada'`);
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
      const query = `SELECT * FROM solicitudes_sh ${finalWhereSql} ORDER BY id DESC`;
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
      const dataQuery = `SELECT * FROM solicitudes_sh ${finalWhereSql} ORDER BY id DESC LIMIT ? OFFSET ?`;

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
      const query = `SELECT * FROM solicitudes_sh ${finalWhereSql} ORDER BY id DESC`;
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
      const dataQuery = `SELECT * FROM solicitudes_sh ${finalWhereSql} ORDER BY id DESC LIMIT ? OFFSET ?`;

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
    SELECT id, folio_lobby, sujeto_pasivo, fecha_ingreso, fecha_limite_sh, estado_cumplimiento_sh
    FROM solicitudes_sh
    WHERE estado = 'Ingresada' ${userWhereSql}
    ORDER BY fecha_limite_sh ASC
  `;

  // 2. Obtener publicaciones pendientes
  const queryPendientesPub = `
    SELECT id, folio_lobby, sujeto_pasivo, fecha_agendada, fecha_limite_publicacion
    FROM solicitudes_sh
    WHERE estado = 'Aceptada'
      AND fecha_agendada IS NOT NULL AND fecha_agendada != '' AND fecha_agendada != '-'
      AND (folio_lobby IS NULL OR folio_lobby = '' OR folio_lobby NOT IN (SELECT folio_lobby FROM publicadas_ph WHERE folio_lobby IS NOT NULL AND folio_lobby != ''))
      ${userWhereSql}
    ORDER BY fecha_limite_publicacion ASC
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
    const query = `SELECT * FROM publicadas_ph ${whereSql} ORDER BY id DESC`;
    db.all(query, params, (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    });
  } else {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const offset = (page - 1) * limit;

    const countQuery = `SELECT COUNT(*) AS total FROM publicadas_ph ${whereSql}`;
    const dataQuery = `SELECT * FROM publicadas_ph ${whereSql} ORDER BY id DESC LIMIT ? OFFSET ?`;

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
  db.all('SELECT * FROM sujetos_pasivos_sph ORDER BY id DESC', [], (err, rows) => {
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
  isImporting = true;

  const { fork } = require('child_process');
  const child = fork(path.join(__dirname, 'scripts', 'import_lobby.js'));

  let finished = false;

  // Control de aborto: si el cliente cierra la pestaña, recarga o pierde la conexión
  req.on('close', () => {
    if (!finished && child.exitCode === null) {
      console.log('Cliente desconectado de la petición de importación. Terminando subproceso hijo...');
      child.kill('SIGTERM');

      db.run(
        'INSERT INTO historial_sincronizaciones (usuario, estado, detalles) VALUES (?, ?, ?)',
        [`${req.user.nombre} (${req.user.correo})`, 'Cancelado', 'La importación fue cancelada por desconexión o recarga de la página.'],
        (e) => { if (e) console.error(e); }
      );
    }
  });

  child.on('message', (message) => {
    if (message && message.type === 'import_stats') {
      finished = true;
      isImporting = false;

      db.run(
        'INSERT INTO historial_sincronizaciones (usuario, estado, detalles) VALUES (?, ?, ?)',
        [`${req.user.nombre} (${req.user.correo})`, 'Exitoso', JSON.stringify(message.stats)],
        (err) => { if (err) console.error('Error al registrar historial_sincronizaciones:', err.message); }
      );

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

      db.run(
        'INSERT INTO historial_sincronizaciones (usuario, estado, detalles) VALUES (?, ?, ?)',
        [`${req.user.nombre} (${req.user.correo})`, 'Fallido', `Error de proceso: ${err.message}`],
        (e) => { if (e) console.error(e); }
      );

      res.status(500).json({ error: 'Error interno durante el procesamiento del archivo Excel.' });
    }
  });

  child.on('exit', (code) => {
    if (!finished) {
      finished = true;
      isImporting = false;

      // Si salió con código 0 y no enviamos respuesta aún, es porque no disparó import_stats (ej. error lógico o aborto manual)
      const estado = code === 0 || code === null ? 'Cancelado' : 'Fallido';
      const desc = code === 0 || code === null ? 'El proceso terminó inesperadamente o fue abortado.' : `El proceso secundario salió con código de error ${code}.`;

      db.run(
        'INSERT INTO historial_sincronizaciones (usuario, estado, detalles) VALUES (?, ?, ?)',
        [`${req.user.nombre} (${req.user.correo})`, estado, desc],
        (e) => { if (e) console.error(e); }
      );

      res.status(500).json({ error: `El proceso de importación finalizó inesperadamente con código de salida ${code}.` });
    }
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
  const dbFile = path.isAbsolute(process.env.DATABASE_PATH || 'lobby.db')
    ? (process.env.DATABASE_PATH || 'lobby.db')
    : path.join(__dirname, process.env.DATABASE_PATH || 'lobby.db');
  const excelFile = path.isAbsolute(process.env.EXCEL_PATH || 'lobby_data.xlsx')
    ? (process.env.EXCEL_PATH || 'lobby_data.xlsx')
    : path.join(__dirname, process.env.EXCEL_PATH || 'lobby_data.xlsx');

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
      SUM(CASE WHEN estado = 'Ingresada' THEN 1 ELSE 0 END) AS ingresada,
      SUM(CASE WHEN estado = 'Aceptada' THEN 1 ELSE 0 END) AS aceptada,
      SUM(CASE WHEN estado = 'Rechazada' THEN 1 ELSE 0 END) AS rechazada,
      SUM(CASE WHEN estado = 'Suspendida' THEN 1 ELSE 0 END) AS suspendida,
      SUM(CASE WHEN estado = 'Cancelada' THEN 1 ELSE 0 END) AS cancelada,
      SUM(CASE WHEN estado = 'Encomendada' THEN 1 ELSE 0 END) AS encomendada
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

// Levantar el servidor
app.listen(PORT, () => {
  console.log(`Servidor de desarrollo local corriendo en http://localhost:${PORT}`);
});

