require('dotenv').config();
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const auth = require('../middleware/auth');

const os = require('os');

let dbPath;
let dbDir;

if (process.versions.electron || process.env.IS_ELECTRON === 'true') {
  // En Electron portable, guardamos de forma segura en la carpeta oculta AppData/Local/LobbyControl del usuario
  // Esto no requiere permisos de administrador y oculta la base de datos del usuario común
  const baseDir = process.versions.electron 
    ? require('electron').app.getPath('userData')
    : path.join(os.homedir(), 'AppData', 'Local', 'LobbyControl');
    
  dbDir = path.join(baseDir, 'data');
  dbPath = path.join(dbDir, 'lobby.db');
} else {
  // Configuración estándar para desarrollo local web
  dbPath = path.isAbsolute(process.env.DATABASE_PATH || 'lobby.db')
    ? (process.env.DATABASE_PATH || 'lobby.db')
    : path.join(__dirname, '..', '..', process.env.DATABASE_PATH || 'lobby.db');
  dbDir = path.dirname(dbPath);
}

// Asegurar que la carpeta de destino de la base de datos exista
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Verificar firma digital del archivo de base de datos para depuración (sin acción destructiva)
if (fs.existsSync(dbPath)) {
  const localVersionPath = path.join(dbDir, 'version.json');
  if (fs.existsSync(localVersionPath)) {
    try {
      const crypto = require('crypto');
      const versionData = JSON.parse(fs.readFileSync(localVersionPath, 'utf8'));
      
      if (versionData.db_signature) {
        const dbBuffer = fs.readFileSync(dbPath);
        const calculatedSignature = crypto.createHmac('sha256', 'LobbyControl_Secure_Key_2026_Maipu')
          .update(dbBuffer)
          .digest('hex');
          
        if (calculatedSignature !== versionData.db_signature) {
          console.log('ℹ️ [Firma DB] La firma digital local difiere debido a modificaciones recientes en la base de datos.');
        } else {
          console.log('✓ Firma digital de base de datos local verificada correctamente.');
        }
      }
    } catch (sigErr) {
      console.warn('Advertencia en verificación de firma de inicio:', sigErr.message);
    }
  }
}

// Conectar a la base de datos SQLite usando una referencia activa
let activeDb = null;

function connectDb(targetPath) {
  activeDb = new sqlite3.Database(targetPath, (err) => {
    if (err) {
      console.error('Error al abrir la base de datos SQLite:', err.message);
    } else {
      console.log('Conectado a la base de datos local SQLite:', targetPath);
      activeDb.run('PRAGMA busy_timeout = 30000');
      activeDb.run('PRAGMA journal_mode = WAL', (err) => {
        if (err) {
          console.error('Error al activar WAL en SQLite:', err.message);
        } else {
          console.log('Modo WAL (Write-Ahead Logging) activado en SQLite.');
        }
      });
    }
  });
}

// Inicializar la conexión
connectDb(dbPath);

// Crear proxy delegador para permitir intercambio en caliente (hot-swapping)
const db = {
  all: (...args) => {
    if (!activeDb) { const cb = args[args.length - 1]; if (typeof cb === 'function') return cb(new Error('BD no disponible: reconectando...')); return; }
    return activeDb.all(...args);
  },
  run: (...args) => {
    if (!activeDb) { const cb = args[args.length - 1]; if (typeof cb === 'function') return cb(new Error('BD no disponible: reconectando...')); return; }
    return activeDb.run(...args);
  },
  get: (...args) => {
    if (!activeDb) { const cb = args[args.length - 1]; if (typeof cb === 'function') return cb(new Error('BD no disponible: reconectando...')); return; }
    return activeDb.get(...args);
  },
  prepare: (...args) => {
    if (!activeDb) throw new Error('BD no disponible: reconectando...');
    return activeDb.prepare(...args);
  },
  serialize: (...args) => {
    if (!activeDb) return;
    return activeDb.serialize(...args);
  },
  close: (...args) => activeDb ? activeDb.close(...args) : undefined,
  // Métodos de administración de conexión
  getDbPath: () => dbPath,
  getUserDataDir: () => dbDir,
  closeConnection: () => {
    return new Promise((resolve, reject) => {
      if (!activeDb) return resolve();
      activeDb.close((err) => {
        if (err) {
          console.error('Error al cerrar la conexión de SQLite:', err.message);
          reject(err);
        } else {
          console.log('Conexión de SQLite cerrada exitosamente.');
          activeDb = null;
          resolve();
        }
      });
    });
  },
  openConnection: (targetPath) => {
    return new Promise((resolve, reject) => {
      const p = targetPath || dbPath;
      activeDb = new sqlite3.Database(p, (err) => {
        if (err) {
          console.error('Error al reabrir la base de datos SQLite:', err.message);
          reject(err);
        } else {
          console.log('Base de datos SQLite reabierta con éxito:', p);
          activeDb.run('PRAGMA busy_timeout = 30000');
          activeDb.run('PRAGMA journal_mode = WAL', (pragmaErr) => {
            if (pragmaErr) console.error('Error al activar WAL:', pragmaErr.message);
            
            // Asegurar que las tablas locales personalizadas existen tras reabrir (sincronización con SharePoint)
            activeDb.run(`
              CREATE TABLE IF NOT EXISTS alertas_gestionadas (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tipo TEXT NOT NULL,
                solicitud_id INTEGER NOT NULL,
                estado TEXT NOT NULL,
                fecha_actualizacion DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(tipo, solicitud_id)
              )
            `, (tableErr) => {
              if (tableErr) {
                console.error('Error creando tabla alertas_gestionadas tras reabrir:', tableErr.message);
              } else {
                console.log('✓ Tabla alertas_gestionadas verificada tras reabrir base de datos.');
              }
              resolve();
            });
          });
        }
      });
    });
  },
  recalculateAndSignDatabase: () => {
    try {
      const crypto = require('crypto');
      const localVersionPath = path.join(dbDir, 'version.json');
      if (fs.existsSync(dbPath)) {
        const dbBuffer = fs.readFileSync(dbPath);
        const calculatedSignature = crypto.createHmac('sha256', 'LobbyControl_Secure_Key_2026_Maipu')
          .update(dbBuffer)
          .digest('hex');
        
        let versionData = { last_import_timestamp: 'Nunca' };
        if (fs.existsSync(localVersionPath)) {
          try {
            versionData = JSON.parse(fs.readFileSync(localVersionPath, 'utf8'));
          } catch (e) {}
        }
        
        versionData.db_size = dbBuffer.length;
        versionData.db_signature = calculatedSignature;
        
        fs.writeFileSync(localVersionPath, JSON.stringify(versionData, null, 2));
        console.log('✓ [Sign Database] Firma digital local de base de datos recalculada y guardada.');
      }
    } catch (err) {
      console.error('Error al recalcular firma local de la base de datos:', err.message);
    }
  }
};



// Inicialización de las tablas de forma secuencial
db.serialize(() => {
  db.run('PRAGMA busy_timeout = 30000');

  // 1. Tabla: usuarios
  db.run(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      correo TEXT UNIQUE,
      nombre TEXT,
      rol TEXT,
      password_hash TEXT,
      rut TEXT,
      asistido_rut TEXT
    )
  `, (err) => {
    if (err) {
      console.error('Error creando tabla usuarios:', err.message);
    } else {
      // Migración para bases de datos existentes: comprobar si faltan las nuevas columnas
      db.all("PRAGMA table_info(usuarios)", [], (err, rows) => {
        if (!err) {
          const hasPasswordHash = rows.some(r => r.name === 'password_hash');
          const hasRut = rows.some(r => r.name === 'rut');
          const hasAsistidoRut = rows.some(r => r.name === 'asistido_rut');
          
          if (!hasPasswordHash) {
            db.run("ALTER TABLE usuarios ADD COLUMN password_hash TEXT", (err) => {
              if (err) console.error('Error migrando password_hash:', err.message);
              else console.log('Columna password_hash agregada con éxito a la tabla usuarios.');
            });
          }
          if (!hasRut) {
            db.run("ALTER TABLE usuarios ADD COLUMN rut TEXT", (err) => {
              if (err) console.error('Error migrando rut:', err.message);
              else console.log('Columna rut agregada con éxito a la tabla usuarios.');
            });
          }
          if (!hasAsistidoRut) {
            db.run("ALTER TABLE usuarios ADD COLUMN asistido_rut TEXT", (err) => {
              if (err) console.error('Error migrando asistido_rut:', err.message);
              else console.log('Columna asistido_rut agregada con éxito a la tabla usuarios.');
            });
          }
        }
      });
    }
  });

  // 2. Tabla: solicitudes_sh (Solicitudes de Audiencias)
  db.run(`
    CREATE TABLE IF NOT EXISTS solicitudes_sh (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      id_lobby INTEGER,
      folio_lobby TEXT,
      fecha_ingreso TEXT,
      fecha_respuesta TEXT,
      fecha_agendada TEXT,
      sujeto_pasivo TEXT,
      cargo TEXT,
      sujeto_pasivo_id INTEGER,
      sujeto_activo TEXT,
      rut TEXT,
      genero TEXT,
      representado TEXT,
      materia TEXT,
      especificacion_materia TEXT,
      estado TEXT,
      cargo_limpio TEXT,
      codigo_licitacion TEXT,
      fecha_limite_sh TEXT,
      dias_habiles_respuesta INTEGER,
      estado_cumplimiento_sh TEXT,
      fecha_limite_publicacion TEXT,
      row_hash TEXT
    )
  `, (err) => {
    if (err) {
      console.error('Error creando tabla solicitudes_sh:', err.message);
    } else {
      // Crear Índices optimizados
      db.run('CREATE INDEX IF NOT EXISTS idx_solicitudes_cargo_limpio ON solicitudes_sh (cargo_limpio)');
      db.run('CREATE INDEX IF NOT EXISTS idx_solicitudes_cumplimiento ON solicitudes_sh (estado_cumplimiento_sh)');
      db.run('CREATE INDEX IF NOT EXISTS idx_solicitudes_folios ON solicitudes_sh (folio_lobby)');
      db.run('CREATE INDEX IF NOT EXISTS idx_solicitudes_sujeto_pasivo ON solicitudes_sh (sujeto_pasivo)');
      db.run('CREATE INDEX IF NOT EXISTS idx_solicitudes_fecha_ingreso ON solicitudes_sh (fecha_ingreso)');
      db.run('CREATE INDEX IF NOT EXISTS idx_publicadas_sujeto_pasivo ON publicadas_ph (sujeto_pasivo)');
      db.run('CREATE INDEX IF NOT EXISTS idx_publicadas_fecha_inicio ON publicadas_ph (fecha_inicio)');
      
    }
  });

  // 3. Tabla: publicadas_ph (Audiencias Publicadas)
  db.run(`
    CREATE TABLE IF NOT EXISTS publicadas_ph (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      id_lobby INTEGER,
      folio_lobby TEXT,
      estado TEXT,
      forma TEXT,
      materia TEXT,
      especificacion_materia TEXT,
      lugar TEXT,
      comuna TEXT,
      sujeto_pasivo TEXT,
      cargo TEXT,
      sujeto_activo TEXT,
      rut TEXT,
      genero TEXT,
      tipo TEXT,
      representado TEXT,
      fecha_inicio TEXT,
      fecha_termino TEXT,
      duracion TEXT,
      fecha_publicacion TEXT,
      cumplimiento TEXT,
      id_solicitud_lobby INTEGER,
      row_hash TEXT
    )
  `, (err) => {
    if (err) {
      console.error('Error creando tabla publicadas_ph:', err.message);
    } else {
      // Migración para agregar row_hash a publicadas_ph si ya existía la tabla sin esa columna
      db.all("PRAGMA table_info(publicadas_ph)", [], (err, rows) => {
        if (!err && rows) {
          const hasRowHash = rows.some(r => r.name === 'row_hash');
          if (!hasRowHash) {
            db.run("ALTER TABLE publicadas_ph ADD COLUMN row_hash TEXT", (err) => {
              if (err) console.error('Error migrando row_hash en publicadas_ph:', err.message);
              else console.log('Columna row_hash agregada con éxito a publicadas_ph.');
            });
          }
        }
      });
    }
  });

  // 4. Tabla: sujetos_pasivos_sph (Sujetos Pasivos)
  db.run(`
    CREATE TABLE IF NOT EXISTS sujetos_pasivos_sph (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      id_sujeto_lobby INTEGER,
      nombre TEXT,
      rut TEXT,
      cargo TEXT,
      tipo TEXT,
      zona TEXT,
      fecha_incorporacion TEXT,
      fecha_termino TEXT,
      respaldo_juridico TEXT,
      row_hash TEXT
    )
  `, (err) => {
    if (err) {
      console.error('Error creando tabla sujetos_pasivos_sph:', err.message);
    } else {
      // Migración para bases de datos existentes: comprobar si falta la columna row_hash
      db.all("PRAGMA table_info(sujetos_pasivos_sph)", [], (err, rows) => {
        if (!err && rows.length > 0) {
          const hasRowHash = rows.some(r => r.name === 'row_hash');
          if (!hasRowHash) {
            db.run("ALTER TABLE sujetos_pasivos_sph ADD COLUMN row_hash TEXT", (err) => {
              if (err) console.error('Error migrando row_hash en sujetos_pasivos_sph:', err.message);
              else console.log('Columna row_hash agregada con éxito a sujetos_pasivos_sph.');
            });
          }
        }
      });
    }
  });

  // 5. Tabla: configuracion (Almacena metadatos del sistema, como fecha de importación)
  db.run(`
    CREATE TABLE IF NOT EXISTS configuracion (
      clave TEXT UNIQUE,
      valor TEXT
    )
  `, (err) => {
    if (err) {
      console.error('Error creando tabla configuracion:', err.message);
    }
  });

  // 6. Tabla: historial_sincronizaciones (Bitácora de importaciones)
  db.run(`
    CREATE TABLE IF NOT EXISTS historial_sincronizaciones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      usuario TEXT,
      estado TEXT,
      detalles TEXT
    )
  `, (err) => {
    if (err) {
      console.error('Error creando tabla historial_sincronizaciones:', err.message);
    }
  });

  // 7. Tabla: auditoria_semanal (Control de Auditoría Semanal)
  db.run(`
    CREATE TABLE IF NOT EXISTS auditoria_semanal (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fecha TEXT NOT NULL,
      total INTEGER NOT NULL,
      ingresada INTEGER NOT NULL,
      aceptada INTEGER NOT NULL,
      rechazada INTEGER NOT NULL,
      suspendida INTEGER NOT NULL,
      cancelada INTEGER NOT NULL,
      encomendada INTEGER NOT NULL,
      publicada INTEGER NOT NULL,
      usuario TEXT,
      estado TEXT DEFAULT 'Cerrado'
    )
  `, (err) => {
    if (err) {
      console.error('Error creando tabla auditoria_semanal:', err.message);
    } else {
      // Migración para bases de datos existentes: comprobar si falta la columna estado y total
      db.all("PRAGMA table_info(auditoria_semanal)", [], (err, rows) => {
        if (!err && rows) {
          const hasEstado = rows.some(r => r.name === 'estado');
          const hasTotal = rows.some(r => r.name === 'total');
          
          const runMigrations = async () => {
            if (!hasEstado) {
              await new Promise((resolve) => {
                db.run("ALTER TABLE auditoria_semanal ADD COLUMN estado TEXT DEFAULT 'Cerrado'", () => resolve());
              });
            }
            if (!hasTotal) {
              await new Promise((resolve) => {
                db.run("ALTER TABLE auditoria_semanal ADD COLUMN total INTEGER DEFAULT 0", () => resolve());
              });
            }
            rebuildActiveSujetoIdsTable();
          };
          runMigrations();
        } else {
          rebuildActiveSujetoIdsTable();
        }
      });
    }
  });

  // 8. Tabla: sujetos_pasivos_vigentes (IDs de sujetos pasivos vigentes)
  db.run(`
    CREATE TABLE IF NOT EXISTS sujetos_pasivos_vigentes (
      id_sujeto_lobby INTEGER PRIMARY KEY
    )
  `, (err) => {
    if (err) {
      console.error('Error creando tabla sujetos_pasivos_vigentes:', err.message);
    }
  });

  // 9. Tabla: reportes_generados (Registro de reportes PDF generados)
  db.run(`
    CREATE TABLE IF NOT EXISTS reportes_generados (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      codigo_reporte TEXT UNIQUE,
      fecha_generacion TEXT,
      sujeto_pasivo TEXT,
      cargo TEXT,
      filtros TEXT
    )
  `, (err) => {
    if (err) {
      console.error('Error creando tabla reportes_generados:', err.message);
    }
  });

  // 10. Tabla: alertas_gestionadas (Estado de lectura/borrado de alertas)
  db.run(`
    CREATE TABLE IF NOT EXISTS alertas_gestionadas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tipo TEXT NOT NULL,
      solicitud_id INTEGER NOT NULL,
      estado TEXT NOT NULL,
      fecha_actualizacion DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(tipo, solicitud_id)
    )
  `, (err) => {
    if (err) {
      console.error('Error creando tabla alertas_gestionadas:', err.message);
    }
  });

});


function rebuildActiveSujetoIdsTable() {
  db.serialize(() => {
    db.run('BEGIN IMMEDIATE TRANSACTION', (txErr) => {
      if (txErr) {
        console.error('Error al iniciar transacción para vigentes:', txErr.message);
        return;
      }
    });

    db.run('DELETE FROM sujetos_pasivos_vigentes', (err) => {
      if (err) {
        console.error('Error al limpiar sujetos_pasivos_vigentes:', err.message);
        db.run('ROLLBACK');
        return;
      }
    });

    const todayStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    db.run(`
      INSERT OR IGNORE INTO sujetos_pasivos_vigentes (id_sujeto_lobby)
      SELECT DISTINCT id_sujeto_lobby
      FROM sujetos_pasivos_sph
      WHERE id_sujeto_lobby IS NOT NULL
        AND (
          fecha_termino IS NULL
          OR TRIM(fecha_termino) = ''
          OR LOWER(TRIM(fecha_termino)) IN ('indefinido', 'indefinicio', 'null', '-')
          OR LOWER(TRIM(fecha_termino)) LIKE '%indefin%'
          OR TRIM(fecha_termino) >= ?
        )
    `, [todayStr], function(insertErr) {
      if (insertErr) {
        console.error('Error al poblar sujetos_pasivos_vigentes:', insertErr.message);
        db.run('ROLLBACK');
      } else {
        const changes = this ? this.changes : 0;
        db.run('COMMIT', (commitErr) => {
          if (commitErr) {
            console.error('Error al hacer COMMIT de vigentes:', commitErr.message);
            db.run('ROLLBACK');
          } else {
            console.log(`✓ Tabla sujetos_pasivos_vigentes inicializada: ${changes} registros vigentes creados.`);
          }
        });
      }
    });
  });
}

module.exports = db;
