require('dotenv').config();
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const os = require('os');

let dbPath;
let usersDbPath;
let localDbPath;
let dbDir;

// Detectar si estamos en Electron y si la aplicación está en producción
let electronApp = null;
let isDev = false;
if (process.versions.electron) {
  try {
    const electron = require('electron');
    electronApp = electron.app;
    isDev = process.defaultApp || /node_modules[\\/]electron[\\/]/.test(process.execPath);
  } catch (e) {}
} else {
  isDev = true; // Si no es Electron (por ejemplo, scripts de consola en desarrollo)
}

// Usar la ruta de producción si no estamos en desarrollo, o si se fuerza por variable de entorno
const useProductionPath = !isDev || process.env.PRODUCTION_DB === 'true';

if (useProductionPath) {
  // En producción (empaquetado), guardamos de forma segura en la carpeta de datos de usuario de Electron
  const baseDir = process.env.USER_DATA_DIR || (electronApp
    ? electronApp.getPath('userData')
    : path.join(os.homedir(), 'AppData', 'Local', 'LobbyControl'));
    
  dbDir = path.join(baseDir, 'data');
} else {
  // Configuración estándar para desarrollo local (scripts o Electron en desarrollo)
  const devPath = path.isAbsolute(process.env.DATABASE_PATH || 'lobby_control.db')
    ? (process.env.DATABASE_PATH || 'lobby_control.db')
    : path.join(__dirname, '..', '..', process.env.DATABASE_PATH || 'lobby_control.db');
  dbDir = path.dirname(devPath);
}

dbPath = path.join(dbDir, 'lobby_control.db');
usersDbPath = path.join(dbDir, 'usuarios.db');
localDbPath = path.join(dbDir, 'local.db');

// Asegurar que la carpeta de destino de la base de datos exista
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Verificar firma digital del archivo de base de datos para depuración (sin acción destructiva)
if (fs.existsSync(dbPath)) {
  const localVersionPath = path.join(dbDir, 'version_lobby.json');
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

// Conexiones activas independientes
let activeDb = null;
let activeUsersDb = null;
let activeLocalDb = null;

function connectLobbyDb(targetPath) {
  activeDb = new sqlite3.Database(targetPath, (err) => {
    if (err) {
      console.error('Error al abrir lobby.db SQLite:', err.message);
    } else {
      console.log('Conectado a la base de datos lobby.db SQLite:', targetPath);
      activeDb.run('PRAGMA busy_timeout = 30000');
      activeDb.run('PRAGMA journal_mode = WAL');
    }
  });
}

function connectUsersDb(targetPath) {
  activeUsersDb = new sqlite3.Database(targetPath, (err) => {
    if (err) {
      console.error('Error al abrir usuarios.db SQLite:', err.message);
    } else {
      console.log('Conectado a la base de datos usuarios.db SQLite:', targetPath);
      activeUsersDb.run('PRAGMA busy_timeout = 30000');
      activeUsersDb.run('PRAGMA journal_mode = WAL');
    }
  });
}

function connectLocalDb(targetPath) {
  activeLocalDb = new sqlite3.Database(targetPath, (err) => {
    if (err) {
      console.error('Error al abrir local.db SQLite:', err.message);
    } else {
      console.log('Conectado a la base de datos local.db SQLite:', targetPath);
      activeLocalDb.run('PRAGMA busy_timeout = 30000');
      activeLocalDb.run('PRAGMA journal_mode = WAL');
    }
  });
}

// Inicializar las conexiones activas
connectLobbyDb(dbPath);
connectUsersDb(usersDbPath);
connectLocalDb(localDbPath);

// Proxy para Lobby (db)
const db = {
  all: (...args) => {
    if (!activeDb) { const cb = args[args.length - 1]; if (typeof cb === 'function') return cb(new Error('Lobby DB no disponible')); return; }
    return activeDb.all(...args);
  },
  run: (...args) => {
    if (!activeDb) { const cb = args[args.length - 1]; if (typeof cb === 'function') return cb(new Error('Lobby DB no disponible')); return; }
    return activeDb.run(...args);
  },
  get: (...args) => {
    if (!activeDb) { const cb = args[args.length - 1]; if (typeof cb === 'function') return cb(new Error('Lobby DB no disponible')); return; }
    return activeDb.get(...args);
  },
  prepare: (...args) => {
    if (!activeDb) throw new Error('Lobby DB no disponible');
    return activeDb.prepare(...args);
  },
  serialize: (...args) => {
    if (!activeDb) return;
    return activeDb.serialize(...args);
  },
  close: (...args) => activeDb ? activeDb.close(...args) : undefined,
  getDbPath: () => dbPath,
  getUserDataDir: () => dbDir,
  closeConnection: () => {
    return new Promise((resolve, reject) => {
      if (!activeDb) return resolve();
      activeDb.close((err) => {
        if (err) {
          console.error('Error al cerrar la conexión de lobby.db:', err.message);
          reject(err);
        } else {
          console.log('Conexión de lobby.db cerrada exitosamente.');
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
          console.error('Error al reabrir la base de datos lobby.db:', err.message);
          reject(err);
        } else {
          console.log('Base de datos lobby.db reabierta con éxito:', p);
          activeDb.run('PRAGMA busy_timeout = 30000');
          activeDb.run('PRAGMA journal_mode = WAL', (pragmaErr) => {
            if (pragmaErr) console.error('Error al activar WAL en lobby.db:', pragmaErr.message);
            resolve();
          });
        }
      });
    });
  },
  recalculateAndSignDatabase: () => {
    try {
      const crypto = require('crypto');
      const localVersionPath = path.join(dbDir, 'version_lobby.json');
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

// Proxy para Usuarios (usersDb)
const usersDb = {
  all: (...args) => {
    if (!activeUsersDb) { const cb = args[args.length - 1]; if (typeof cb === 'function') return cb(new Error('Users DB no disponible')); return; }
    return activeUsersDb.all(...args);
  },
  run: (...args) => {
    if (!activeUsersDb) { const cb = args[args.length - 1]; if (typeof cb === 'function') return cb(new Error('Users DB no disponible')); return; }
    return activeUsersDb.run(...args);
  },
  get: (...args) => {
    if (!activeUsersDb) { const cb = args[args.length - 1]; if (typeof cb === 'function') return cb(new Error('Users DB no disponible')); return; }
    return activeUsersDb.get(...args);
  },
  prepare: (...args) => {
    if (!activeUsersDb) throw new Error('Users DB no disponible');
    return activeUsersDb.prepare(...args);
  },
  serialize: (...args) => {
    if (!activeUsersDb) return;
    return activeUsersDb.serialize(...args);
  },
  close: (...args) => activeUsersDb ? activeUsersDb.close(...args) : undefined,
  getDbPath: () => usersDbPath,
  getUserDataDir: () => dbDir,
  closeConnection: () => {
    return new Promise((resolve, reject) => {
      if (!activeUsersDb) return resolve();
      activeUsersDb.close((err) => {
        if (err) {
          console.error('Error al cerrar la conexión de usuarios.db:', err.message);
          reject(err);
        } else {
          console.log('Conexión de usuarios.db cerrada exitosamente.');
          activeUsersDb = null;
          resolve();
        }
      });
    });
  },
  openConnection: (targetPath) => {
    return new Promise((resolve, reject) => {
      const p = targetPath || usersDbPath;
      activeUsersDb = new sqlite3.Database(p, (err) => {
        if (err) {
          console.error('Error al reabrir la base de datos usuarios.db:', err.message);
          reject(err);
        } else {
          console.log('Base de datos usuarios.db reabierta con éxito:', p);
          activeUsersDb.run('PRAGMA busy_timeout = 30000');
          activeUsersDb.run('PRAGMA journal_mode = WAL', (pragmaErr) => {
            if (pragmaErr) console.error('Error al activar WAL en usuarios.db:', pragmaErr.message);
            resolve();
          });
        }
      });
    });
  }
};

// Proxy para Local (localDb)
const localDb = {
  all: (...args) => {
    if (!activeLocalDb) { const cb = args[args.length - 1]; if (typeof cb === 'function') return cb(new Error('Local DB no disponible')); return; }
    return activeLocalDb.all(...args);
  },
  run: (...args) => {
    if (!activeLocalDb) { const cb = args[args.length - 1]; if (typeof cb === 'function') return cb(new Error('Local DB no disponible')); return; }
    return activeLocalDb.run(...args);
  },
  get: (...args) => {
    if (!activeLocalDb) { const cb = args[args.length - 1]; if (typeof cb === 'function') return cb(new Error('Local DB no disponible')); return; }
    return activeLocalDb.get(...args);
  },
  prepare: (...args) => {
    if (!activeLocalDb) throw new Error('Local DB no disponible');
    return activeLocalDb.prepare(...args);
  },
  serialize: (...args) => {
    if (!activeLocalDb) return;
    return activeLocalDb.serialize(...args);
  },
  close: (...args) => activeLocalDb ? activeLocalDb.close(...args) : undefined,
  getDbPath: () => localDbPath,
  getUserDataDir: () => dbDir,
  closeConnection: () => {
    return new Promise((resolve, reject) => {
      if (!activeLocalDb) return resolve();
      activeLocalDb.close((err) => {
        if (err) {
          console.error('Error al cerrar la conexión de local.db:', err.message);
          reject(err);
        } else {
          console.log('Conexión de local.db cerrada exitosamente.');
          activeLocalDb = null;
          resolve();
        }
      });
    });
  },
  openConnection: (targetPath) => {
    return new Promise((resolve, reject) => {
      const p = targetPath || localDbPath;
      activeLocalDb = new sqlite3.Database(p, (err) => {
        if (err) {
          console.error('Error al reabrir la base de datos local.db:', err.message);
          reject(err);
        } else {
          console.log('Base de datos local.db reabierta con éxito:', p);
          activeLocalDb.run('PRAGMA busy_timeout = 30000');
          activeLocalDb.run('PRAGMA journal_mode = WAL', (pragmaErr) => {
            if (pragmaErr) console.error('Error al activar WAL en local.db:', pragmaErr.message);
            resolve();
          });
        }
      });
    });
  }
};

// 1. Inicialización de usuarios.db
usersDb.serialize(() => {
  usersDb.run(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      correo TEXT UNIQUE,
      nombre TEXT,
      rol TEXT,
      rut TEXT,
      asistido_rut TEXT
    )
  `, (err) => {
    if (err) console.error('Error creando tabla usuarios:', err.message);
  });
});

// 2. Inicialización de local.db
localDb.serialize(() => {
  localDb.run(`
    CREATE TABLE IF NOT EXISTS alertas_gestionadas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tipo TEXT NOT NULL,
      solicitud_id INTEGER NOT NULL,
      estado TEXT NOT NULL,
      fecha_actualizacion DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(tipo, solicitud_id)
    )
  `, (err) => {
    if (err) console.error('Error creando tabla alertas_gestionadas:', err.message);
  });

  localDb.run(`
    CREATE TABLE IF NOT EXISTS configuracion_local (
      clave TEXT UNIQUE,
      valor TEXT
    )
  `, (err) => {
    if (err) console.error('Error creando tabla configuracion_local:', err.message);
  });
});

// 3. Inicialización de lobby.db
db.serialize(() => {
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
      db.run('CREATE INDEX IF NOT EXISTS idx_solicitudes_cargo_limpio ON solicitudes_sh (cargo_limpio)');
      db.run('CREATE INDEX IF NOT EXISTS idx_solicitudes_cumplimiento ON solicitudes_sh (estado_cumplimiento_sh)');
      db.run('CREATE INDEX IF NOT EXISTS idx_solicitudes_folios ON solicitudes_sh (folio_lobby)');
      db.run('CREATE INDEX IF NOT EXISTS idx_solicitudes_sujeto_pasivo ON solicitudes_sh (sujeto_pasivo)');
      db.run('CREATE INDEX IF NOT EXISTS idx_solicitudes_fecha_ingreso ON solicitudes_sh (fecha_ingreso)');
    }
  });

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
      db.run('CREATE INDEX IF NOT EXISTS idx_publicadas_sujeto_pasivo ON publicadas_ph (sujeto_pasivo)');
      db.run('CREATE INDEX IF NOT EXISTS idx_publicadas_fecha_inicio ON publicadas_ph (fecha_inicio)');
      
      db.all("PRAGMA table_info(publicadas_ph)", [], (err, rows) => {
        if (!err && rows) {
          const hasRowHash = rows.some(r => r.name === 'row_hash');
          if (!hasRowHash) {
            db.run("ALTER TABLE publicadas_ph ADD COLUMN row_hash TEXT");
          }
        }
      });
    }
  });

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
      db.all("PRAGMA table_info(sujetos_pasivos_sph)", [], (err, rows) => {
        if (!err && rows && rows.length > 0) {
          const hasRowHash = rows.some(r => r.name === 'row_hash');
          if (!hasRowHash) {
            db.run("ALTER TABLE sujetos_pasivos_sph ADD COLUMN row_hash TEXT");
          }
        }
      });
    }
  });

  db.run(`
    CREATE TABLE IF NOT EXISTS configuracion (
      clave TEXT UNIQUE,
      valor TEXT
    )
  `, (err) => {
    if (err) console.error('Error creando tabla configuracion:', err.message);
  });

  db.run(`
    CREATE TABLE IF NOT EXISTS historial_sincronizaciones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      usuario TEXT,
      estado TEXT,
      detalles TEXT
    )
  `, (err) => {
    if (err) console.error('Error creando tabla historial_sincronizaciones:', err.message);
  });

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
      db.all("PRAGMA table_info(auditoria_semanal)", [], (err, rows) => {
        if (!err && rows) {
          const hasEstado = rows.some(r => r.name === 'estado');
          const hasTotal = rows.some(r => r.name === 'total');
          
          const runMigrations = async () => {
            if (!hasEstado) {
              await new Promise((resolve) => db.run("ALTER TABLE auditoria_semanal ADD COLUMN estado TEXT DEFAULT 'Cerrado'", () => resolve()));
            }
            if (!hasTotal) {
              await new Promise((resolve) => db.run("ALTER TABLE auditoria_semanal ADD COLUMN total INTEGER DEFAULT 0", () => resolve()));
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

  db.run(`
    CREATE TABLE IF NOT EXISTS sujetos_pasivos_vigentes (
      id_sujeto_lobby INTEGER PRIMARY KEY
    )
  `, (err) => {
    if (err) console.error('Error creando tabla sujetos_pasivos_vigentes:', err.message);
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

    const todayStr = new Date().toISOString().split('T')[0];

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

// Inyectar proxies secundarios en el principal
db.usersDb = usersDb;
db.localDb = localDb;

module.exports = db;
