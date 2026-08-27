require('dotenv').config();
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const os = require('os');

let dbPath;
let usersDbPath;
let localDbPath;
let asistenciasDbPath;
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
asistenciasDbPath = path.join(dbDir, 'asistencias.db');

// Asegurar que la carpeta de destino de la base de datos exista
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Limpieza preventiva de archivos Excel huérfanos de ejecuciones anteriores (a prueba de fallos)
const orphanExcelPath = path.join(dbDir, 'lobby_data.xlsx');
if (fs.existsSync(orphanExcelPath)) {
  try {
    fs.unlinkSync(orphanExcelPath);
    console.log('[Database Init] Archivo Excel temporal huérfano de sesión anterior eliminado con éxito.');
  } catch (err) {
    console.warn('[Database Init] No se pudo eliminar el archivo Excel temporal huérfano:', err.message);
  }
}

// Función de autorreparación para asegurar que la base de datos no esté comprimida con GZIP en disco
function ensureDecompressedDb(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return;
  try {
    const fd = fs.openSync(filePath, 'r');
    const headerBuffer = Buffer.alloc(2);
    fs.readSync(fd, headerBuffer, 0, 2, 0);
    fs.closeSync(fd);
    if (headerBuffer[0] === 0x1f && headerBuffer[1] === 0x8b) {
      console.log(`[Auto-Repair] Detectada base de datos comprimida en ${filePath}. Descomprimiendo...`);
      const zlib = require('zlib');
      const compressedBuffer = fs.readFileSync(filePath);
      const decompressedBuffer = zlib.gunzipSync(compressedBuffer);
      fs.writeFileSync(filePath, decompressedBuffer);
      console.log(`✓ [Auto-Repair] Base de datos ${filePath} descompuesta y reparada correctamente.`);
    }
  } catch (e) {
    console.error(`[Auto-Repair Error] Error al verificar/descomprimir ${filePath}:`, e.message);
  }
}

// Autorreparar bases de datos si están comprimidas
ensureDecompressedDb(dbPath);
ensureDecompressedDb(usersDbPath);
ensureDecompressedDb(localDbPath);
ensureDecompressedDb(asistenciasDbPath);

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
let activeAsistenciasDb = null;

function connectLobbyDb(targetPath) {
  ensureDecompressedDb(targetPath);
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
      activeLocalDb.run('PRAGMA foreign_keys = ON');
    }
  });
}

function connectAsistenciasDb(targetPath) {
  ensureDecompressedDb(targetPath);
  activeAsistenciasDb = new sqlite3.Database(targetPath, (err) => {
    if (err) {
      console.error('Error al abrir asistencias.db SQLite:', err.message);
    } else {
      console.log('Conectado a la base de datos asistencias.db SQLite:', targetPath);
      activeAsistenciasDb.run('PRAGMA busy_timeout = 30000');
      activeAsistenciasDb.run('PRAGMA journal_mode = WAL');
      activeAsistenciasDb.run('PRAGMA foreign_keys = ON');
    }
  });
}

// Inicializar las conexiones activas
connectLobbyDb(dbPath);
connectUsersDb(usersDbPath);
connectLocalDb(localDbPath);
connectAsistenciasDb(asistenciasDbPath);

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
      activeDb.run("PRAGMA wal_checkpoint(TRUNCATE)", (pragmaErr) => {
        if (pragmaErr) console.warn("Advertencia en checkpoint de cierre de lobby.db:", pragmaErr.message);
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
    return new Promise((resolve) => {
      if (!activeDb) {
        console.warn('Advertencia: Intento de firmar lobby.db sin conexión activa.');
        return resolve();
      }
      activeDb.run("PRAGMA wal_checkpoint(TRUNCATE)", (pragmaErr) => {
        if (pragmaErr) console.error('Error en checkpoint antes de firmar lobby.db:', pragmaErr.message);
        
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
            console.log('✓ [Sign Database] Firma digital local de lobby.db recalculada y guardada.');
          }
        } catch (err) {
          console.error('Error al recalcular firma local de lobby.db:', err.message);
        }
        resolve();
      });
    });
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
      activeUsersDb.run("PRAGMA wal_checkpoint(TRUNCATE)", (pragmaErr) => {
        if (pragmaErr) console.warn("Advertencia en checkpoint de cierre de usuarios.db:", pragmaErr.message);
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
  },
  recalculateAndSignDatabase: () => {
    return new Promise((resolve) => {
      if (!activeUsersDb) {
        console.warn('Advertencia: Intento de firmar usuarios.db sin conexión activa.');
        return resolve();
      }
      activeUsersDb.run("PRAGMA wal_checkpoint(TRUNCATE)", (pragmaErr) => {
        if (pragmaErr) console.error('Error en checkpoint antes de firmar usuarios.db:', pragmaErr.message);
        
        try {
          const crypto = require('crypto');
          const localVersionPath = path.join(dbDir, 'version_users.json');
          if (fs.existsSync(usersDbPath)) {
            const dbBuffer = fs.readFileSync(usersDbPath);
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
            console.log('✓ [Sign Database] Firma digital local de usuarios.db recalculada y guardada.');
          }
        } catch (err) {
          console.error('Error al recalcular firma local de usuarios.db:', err.message);
        }
        resolve();
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
      activeLocalDb.run("PRAGMA wal_checkpoint(TRUNCATE)", (pragmaErr) => {
        if (pragmaErr) console.warn("Advertencia en checkpoint de cierre de local.db:", pragmaErr.message);
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
            activeLocalDb.run('PRAGMA foreign_keys = ON', (fkErr) => {
              if (fkErr) console.error('Error al activar foreign_keys en local.db:', fkErr.message);
              resolve();
            });
          });
        }
      });
    });
  }
};

// Proxy para Asistencias (asistenciasDb)
const asistenciasDb = {
  all: (...args) => {
    if (!activeAsistenciasDb) { const cb = args[args.length - 1]; if (typeof cb === 'function') return cb(new Error('Asistencias DB no disponible')); return; }
    return activeAsistenciasDb.all(...args);
  },
  run: (...args) => {
    if (!activeAsistenciasDb) { const cb = args[args.length - 1]; if (typeof cb === 'function') return cb(new Error('Asistencias DB no disponible')); return; }
    return activeAsistenciasDb.run(...args);
  },
  get: (...args) => {
    if (!activeAsistenciasDb) { const cb = args[args.length - 1]; if (typeof cb === 'function') return cb(new Error('Asistencias DB no disponible')); return; }
    return activeAsistenciasDb.get(...args);
  },
  prepare: (...args) => {
    if (!activeAsistenciasDb) throw new Error('Asistencias DB no disponible');
    return activeAsistenciasDb.prepare(...args);
  },
  serialize: (...args) => {
    if (!activeAsistenciasDb) return;
    return activeAsistenciasDb.serialize(...args);
  },
  close: (...args) => activeAsistenciasDb ? activeAsistenciasDb.close(...args) : undefined,
  getDbPath: () => asistenciasDbPath,
  getUserDataDir: () => dbDir,
  closeConnection: () => {
    return new Promise((resolve, reject) => {
      if (!activeAsistenciasDb) return resolve();
      activeAsistenciasDb.run("PRAGMA wal_checkpoint(TRUNCATE)", (pragmaErr) => {
        if (pragmaErr) console.warn("Advertencia en checkpoint de cierre de asistencias.db:", pragmaErr.message);
        activeAsistenciasDb.close((err) => {
          if (err) {
            console.error('Error al cerrar la conexión de asistencias.db:', err.message);
            reject(err);
          } else {
            console.log('Conexión de asistencias.db cerrada exitosamente.');
            activeAsistenciasDb = null;
            resolve();
          }
        });
      });
    });
  },
  openConnection: (targetPath) => {
    return new Promise((resolve, reject) => {
      const p = targetPath || asistenciasDbPath;
      activeAsistenciasDb = new sqlite3.Database(p, (err) => {
        if (err) {
          console.error('Error al reabrir la base de datos asistencias.db:', err.message);
          reject(err);
        } else {
          console.log('Base de datos asistencias.db reabierta con éxito:', p);
          activeAsistenciasDb.run('PRAGMA busy_timeout = 30000');
          activeAsistenciasDb.run('PRAGMA journal_mode = WAL', (pragmaErr) => {
            if (pragmaErr) console.error('Error al activar WAL en asistencias.db:', pragmaErr.message);
            activeAsistenciasDb.run('PRAGMA foreign_keys = ON', (fkErr) => {
              if (fkErr) console.error('Error al activar foreign_keys en asistencias.db:', fkErr.message);
              resolve();
            });
          });
        }
      });
    });
  },
  recalculateAndSignDatabase: () => {
    return new Promise((resolve) => {
      if (!activeAsistenciasDb) {
        console.warn('Advertencia: Intento de firmar asistencias.db sin conexión activa.');
        return resolve();
      }
      activeAsistenciasDb.run("PRAGMA wal_checkpoint(TRUNCATE)", (pragmaErr) => {
        if (pragmaErr) console.error('Error en checkpoint antes de firmar asistencias.db:', pragmaErr.message);
        try {
          const crypto = require('crypto');
          const localVersionPath = path.join(dbDir, 'version_asistencias.json');
          if (fs.existsSync(asistenciasDbPath)) {
            const dbBuffer = fs.readFileSync(asistenciasDbPath);
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
            console.log('✓ [Sign Database] Firma digital local de asistencias.db recalculada y guardada.');
          }
        } catch (err) {
          console.error('Error al recalcular firma local de asistencias.db:', err.message);
        }
        resolve();
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

// 2. Inicialización de asistencias.db (Tablas Maestras, Índices y Triggers)
asistenciasDb.serialize(() => {
  asistenciasDb.run('PRAGMA foreign_keys = ON');

  // 2.1 Categorías y Materias
  asistenciasDb.run(`
    CREATE TABLE IF NOT EXISTS asistencia_categorias (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL UNIQUE COLLATE NOCASE,
      descripcion TEXT,
      activo INTEGER NOT NULL DEFAULT 1,
      orden INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT (datetime('now', 'localtime')),
      updated_at DATETIME DEFAULT (datetime('now', 'localtime'))
    )
  `, (err) => {
    if (err) {
      console.error('Error creando tabla asistencia_categorias en asistencias.db:', err.message);
    } else {
      const defaultCategories = [
        ['Plazos Legales (3 Días / Publicación)', 'Cómputo de 3 días hábiles y plazos de publicación oficial en InfoLobby', 1],
        ['Plataforma / ClaveÚnica', 'Problemas de acceso, roles o vinculación de ClaveÚnica en InfoLobby', 2],
        ['Sujetos Pasivos / Suplencias', 'Consultas sobre subrogancias, vigencia y decretos de nombramiento', 3],
        ['Derivaciones / Improcedencia', 'Consultas que no constituyen Lobby o deben orientarse por OIRS/Partes', 4],
        ['Carga de Actas y Respuestas', 'Procedimiento para registrar actas, materias tratadas y acuerdos', 5],
        ['Normativa Ley N° 20.730', 'Orientación jurídica sobre el alcance de la ley y sujetos activos/pasivos', 6],
        ['Consulta General / Otro', 'Otras consultas generales de usuarios o solicitantes', 7]
      ];
      defaultCategories.forEach(([nombre, desc, ord]) => {
        asistenciasDb.run(`INSERT OR IGNORE INTO asistencia_categorias (nombre, descripcion, orden) VALUES (?, ?, ?)`, [nombre, desc, ord]);
      });
    }
  });

  // 2.2 Directorio de Contactos
  asistenciasDb.run(`
    CREATE TABLE IF NOT EXISTS contactos_asistencia (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT UNIQUE,
      nombre TEXT NOT NULL,
      depto_habitual TEXT,
      correo TEXT,
      telefono_anexo TEXT,
      notas TEXT,
      created_at DATETIME DEFAULT (datetime('now', 'localtime')),
      updated_at DATETIME DEFAULT (datetime('now', 'localtime'))
    )
  `, (err) => {
    if (err) console.error('Error creando tabla contactos_asistencia en asistencias.db:', err.message);
  });

  asistenciasDb.run(`CREATE INDEX IF NOT EXISTS idx_contactos_nombre ON contactos_asistencia(nombre COLLATE NOCASE)`);

  asistenciasDb.run(`
    CREATE TRIGGER IF NOT EXISTS trg_contactos_asistencia_updated_at 
    AFTER UPDATE ON contactos_asistencia BEGIN 
      UPDATE contactos_asistencia SET updated_at = datetime('now', 'localtime') WHERE id = NEW.id; 
    END;
  `);

  // 2.3 Bitácora de Asistencias
  asistenciasDb.run(`
    CREATE TABLE IF NOT EXISTS bitacora_asistencias (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_codigo TEXT UNIQUE NOT NULL,
      contacto_id INTEGER,
      contacto_uuid TEXT,
      fecha_hora DATETIME DEFAULT (datetime('now', 'localtime')),
      canal TEXT NOT NULL DEFAULT 'telefono',
      solicitante_nombre TEXT NOT NULL,
      solicitante_cargo_depto TEXT,
      solicitante_correo TEXT,
      solicitante_contacto TEXT,
      categoria TEXT NOT NULL,
      folio_lobby TEXT,
      sujeto_pasivo TEXT,
      motivo_consulta TEXT NOT NULL,
      solucion_orientacion TEXT,
      estado TEXT NOT NULL DEFAULT 'resuelta',
      duracion_minutos INTEGER DEFAULT 5,
      creado_por TEXT,
      updated_by TEXT,
      created_at DATETIME DEFAULT (datetime('now', 'localtime')),
      updated_at DATETIME DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (contacto_id) REFERENCES contactos_asistencia(id) ON DELETE SET NULL
    )
  `, (err) => {
    if (err) console.error('Error creando tabla bitacora_asistencias en asistencias.db:', err.message);
  });

  asistenciasDb.run(`CREATE INDEX IF NOT EXISTS idx_bitacora_ticket ON bitacora_asistencias(ticket_codigo)`);
  asistenciasDb.run(`CREATE INDEX IF NOT EXISTS idx_bitacora_contacto ON bitacora_asistencias(contacto_id)`);
  asistenciasDb.run(`CREATE INDEX IF NOT EXISTS idx_bitacora_fecha ON bitacora_asistencias(fecha_hora)`);
  asistenciasDb.run(`CREATE INDEX IF NOT EXISTS idx_bitacora_canal ON bitacora_asistencias(canal)`);
  asistenciasDb.run(`CREATE INDEX IF NOT EXISTS idx_bitacora_estado ON bitacora_asistencias(estado)`);

  asistenciasDb.run(`
    CREATE TRIGGER IF NOT EXISTS trg_bitacora_asistencias_updated_at 
    AFTER UPDATE ON bitacora_asistencias BEGIN 
      UPDATE bitacora_asistencias SET updated_at = datetime('now', 'localtime') WHERE id = NEW.id; 
    END;
  `);

  // Asegurar migración de esquema y backfill de UUIDs
  setTimeout(ensureUuidInAsistenciasDb, 50);

  // Ejecutar migración atómica si corresponde
  setTimeout(migrateLocalToAsistenciasDb, 100);
});

// Verificación y backfill de UUIDs en asistencias.db
function ensureUuidInAsistenciasDb() {
  const crypto = require('crypto');

  asistenciasDb.get("SELECT sql FROM sqlite_master WHERE type='table' AND name='contactos_asistencia'", [], (sqlErr, masterRow) => {
    if (sqlErr || !masterRow) return;

    const tableSql = masterRow.sql || '';
    const hasUniqueOnNombre = tableSql.includes('nombre TEXT NOT NULL UNIQUE') || tableSql.includes('UNIQUE(nombre');

    const handleBackfillAndIndexes = () => {
      asistenciasDb.all("PRAGMA table_info(contactos_asistencia)", [], (err, cols) => {
        if (err || !cols) return;
        const hasUuid = cols.some(c => c.name === 'uuid');
        const proceedWithContacts = () => {
          asistenciasDb.all("SELECT id FROM contactos_asistencia WHERE uuid IS NULL OR uuid = ''", [], (uErr, rows) => {
            if (!uErr && rows && rows.length > 0) {
              rows.forEach(r => {
                const newUuid = crypto.randomUUID();
                asistenciasDb.run("UPDATE contactos_asistencia SET uuid = ? WHERE id = ?", [newUuid, r.id]);
              });
              console.log(`✓ [UUID Migration] Asignados ${rows.length} UUIDs a contactos_asistencia existentes.`);
            }
            checkBitacoraUuid();
          });
        };

        if (!hasUuid) {
          asistenciasDb.run("ALTER TABLE contactos_asistencia ADD COLUMN uuid TEXT", () => {
            asistenciasDb.run("CREATE UNIQUE INDEX IF NOT EXISTS idx_contactos_uuid ON contactos_asistencia(uuid)", () => {
              proceedWithContacts();
            });
          });
        } else {
          asistenciasDb.run("CREATE UNIQUE INDEX IF NOT EXISTS idx_contactos_uuid ON contactos_asistencia(uuid)", () => {
            proceedWithContacts();
          });
        }
      });
    };

    if (hasUniqueOnNombre) {
      console.log('[UUID Migration] Eliminando restricción UNIQUE obsoleta de nombre en contactos_asistencia...');
      asistenciasDb.serialize(() => {
        asistenciasDb.run("CREATE TABLE IF NOT EXISTS contactos_asistencia_migrated (id INTEGER PRIMARY KEY AUTOINCREMENT, uuid TEXT UNIQUE, nombre TEXT NOT NULL, depto_habitual TEXT, correo TEXT, telefono_anexo TEXT, notas TEXT, created_at DATETIME DEFAULT (datetime('now', 'localtime')), updated_at DATETIME DEFAULT (datetime('now', 'localtime')))");
        asistenciasDb.run("INSERT INTO contactos_asistencia_migrated (id, uuid, nombre, depto_habitual, correo, telefono_anexo, notas, created_at, updated_at) SELECT id, uuid, nombre, depto_habitual, correo, telefono_anexo, notas, created_at, updated_at FROM contactos_asistencia");
        asistenciasDb.run("DROP TABLE contactos_asistencia");
        asistenciasDb.run("ALTER TABLE contactos_asistencia_migrated RENAME TO contactos_asistencia");
        asistenciasDb.run("CREATE INDEX IF NOT EXISTS idx_contactos_nombre ON contactos_asistencia(nombre COLLATE NOCASE)");
        asistenciasDb.run("CREATE UNIQUE INDEX IF NOT EXISTS idx_contactos_uuid ON contactos_asistencia(uuid)");
        asistenciasDb.run(`
          CREATE TRIGGER IF NOT EXISTS trg_contactos_asistencia_updated_at 
          AFTER UPDATE ON contactos_asistencia BEGIN 
            UPDATE contactos_asistencia SET updated_at = datetime('now', 'localtime') WHERE id = NEW.id; 
          END;
        `, () => {
          handleBackfillAndIndexes();
        });
      });
    } else {
      handleBackfillAndIndexes();
    }
  });

  function checkBitacoraUuid() {
    asistenciasDb.all("PRAGMA table_info(bitacora_asistencias)", [], (err, cols) => {
      if (err || !cols) return;
      const hasContactoUuid = cols.some(c => c.name === 'contacto_uuid');
      const backfillBitacora = () => {
        asistenciasDb.run(`
          UPDATE bitacora_asistencias 
          SET contacto_uuid = (SELECT uuid FROM contactos_asistencia WHERE contactos_asistencia.id = bitacora_asistencias.contacto_id)
          WHERE contacto_uuid IS NULL AND contacto_id IS NOT NULL
        `, function() {
          if (this && this.changes > 0) {
            console.log(`✓ [UUID Migration] Enlazados ${this.changes} tickets de bitácora con contacto_uuid.`);
          }
        });
      };

      if (!hasContactoUuid) {
        asistenciasDb.run("ALTER TABLE bitacora_asistencias ADD COLUMN contacto_uuid TEXT", () => {
          asistenciasDb.run("CREATE INDEX IF NOT EXISTS idx_bitacora_contacto_uuid ON bitacora_asistencias(contacto_uuid)", () => {
            backfillBitacora();
          });
        });
      } else {
        asistenciasDb.run("CREATE INDEX IF NOT EXISTS idx_bitacora_contacto_uuid ON bitacora_asistencias(contacto_uuid)", () => {
          backfillBitacora();
        });
      }
    });
  }
}

// Función de Migración Atómica desde local.db hacia asistencias.db
function migrateLocalToAsistenciasDb() {
  asistenciasDb.get("SELECT COUNT(*) AS count FROM bitacora_asistencias", (errAst, rowAst) => {
    if (errAst) return;
    const astCount = rowAst ? rowAst.count : 0;
    if (astCount > 0) {
      // Ya existen asistencias en asistencias.db, no requiere migración
      return;
    }

    localDb.get("SELECT name FROM sqlite_master WHERE type='table' AND name='bitacora_asistencias'", (errTbl, rowTbl) => {
      if (errTbl || !rowTbl) return;

      localDb.get("SELECT COUNT(*) AS count FROM bitacora_asistencias", (errLoc, rowLoc) => {
        if (errLoc || !rowLoc || rowLoc.count === 0) return;

        console.log(`[Migración DB] Detectados ${rowLoc.count} registros de asistencia en local.db. Iniciando migración atómica a asistencias.db...`);

        // 1. Respaldo físico preventivo de local.db
        try {
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const backupPath = path.join(dbDir, `local.db.backup_pre_asistencias_migration_${timestamp}`);
          fs.copyFileSync(localDbPath, backupPath);
          console.log(`✓ [Migración DB] Respaldo preventivo creado con éxito en: ${backupPath}`);
        } catch (backupErr) {
          console.error('[Migración DB Error] No se pudo crear el respaldo preventivo:', backupErr.message);
          return;
        }

        // 2. Extraer datos en memoria desde local.db
        localDb.all("SELECT * FROM asistencia_categorias ORDER BY id ASC", (errCats, rowsCats) => {
          localDb.all("SELECT * FROM contactos_asistencia ORDER BY id ASC", (errCont, rowsCont) => {
            localDb.all("SELECT * FROM bitacora_asistencias ORDER BY id ASC", (errBits, rowsBits) => {
              if (errBits) {
                console.error('[Migración DB Error] Error leyendo bitacora_asistencias de local.db:', errBits.message);
                return;
              }

              const cats = rowsCats || [];
              const conts = rowsCont || [];
              const bits = rowsBits || [];

              // 3. Transacción atómica en asistenciasDb
              asistenciasDb.serialize(() => {
                asistenciasDb.run("BEGIN IMMEDIATE TRANSACTION", (txErr) => {
                  if (txErr) {
                    console.error('[Migración DB Error] No se pudo iniciar transacción en asistencias.db:', txErr.message);
                    return;
                  }

                  try {
                    // 3.1 Categorías
                    for (const cat of cats) {
                      asistenciasDb.run(
                        "INSERT OR IGNORE INTO asistencia_categorias (id, nombre, descripcion, activo, orden, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
                        [cat.id, cat.nombre, cat.descripcion, cat.activo !== undefined ? cat.activo : 1, cat.orden || 0, cat.created_at, cat.updated_at]
                      );
                    }

                    // 3.2 Contactos
                    for (const c of conts) {
                      asistenciasDb.run(
                        "INSERT OR IGNORE INTO contactos_asistencia (id, nombre, depto_habitual, correo, telefono_anexo, notas, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                        [c.id, c.nombre, c.depto_habitual, c.correo, c.telefono_anexo, c.notas, c.created_at, c.updated_at]
                      );
                    }

                    // 3.3 Asistencias
                    for (const b of bits) {
                      asistenciasDb.run(
                        `INSERT OR IGNORE INTO bitacora_asistencias (
                          id, ticket_codigo, contacto_id, fecha_hora, canal, solicitante_nombre,
                          solicitante_cargo_depto, solicitante_correo, solicitante_contacto, categoria,
                          folio_lobby, sujeto_pasivo, motivo_consulta, solucion_orientacion, estado,
                          duracion_minutos, creado_por, updated_by, created_at, updated_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [
                          b.id, b.ticket_codigo, b.contacto_id, b.fecha_hora, b.canal, b.solicitante_nombre,
                          b.solicitante_cargo_depto, b.solicitante_correo, b.solicitante_contacto, b.categoria,
                          b.folio_lobby, b.sujeto_pasivo, b.motivo_consulta, b.solucion_orientacion, b.estado,
                          b.duracion_minutos || 5, b.creado_por, b.updated_by, b.created_at, b.updated_at
                        ]
                      );
                    }

                    asistenciasDb.run("COMMIT", (commitErr) => {
                      if (commitErr) {
                        console.error('[Migración DB Error] Error en COMMIT de asistencias.db:', commitErr.message);
                        asistenciasDb.run("ROLLBACK");
                      } else {
                        console.log(`✓ [Migración DB] Transacción exitosa: ${cats.length} categorías, ${conts.length} contactos y ${bits.length} asistencias migradas a asistencias.db.`);

                        // 4. Renombrar tablas en local.db a _migrated_*
                        localDb.serialize(() => {
                          localDb.run("ALTER TABLE bitacora_asistencias RENAME TO _migrated_bitacora_asistencias", () => {});
                          localDb.run("ALTER TABLE contactos_asistencia RENAME TO _migrated_contactos_asistencia", () => {});
                          localDb.run("ALTER TABLE asistencia_categorias RENAME TO _migrated_asistencia_categorias", () => {});
                          console.log('✓ [Migración DB] Tablas anteriores en local.db renombradas a _migrated_*');
                        });
                      }
                    });
                  } catch (e) {
                    console.error('[Migración DB Excepción]:', e.message);
                    asistenciasDb.run("ROLLBACK");
                  }
                });
              });
            });
          });
        });
      });
    });
  });
}

// 3. Inicialización de local.db (Solo configuración y datos estrictamente privados de la estación)
localDb.serialize(() => {
  localDb.run('PRAGMA foreign_keys = ON');

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
    if (err) console.error('Error creando tabla alertas_gestionadas en local.db:', err.message);
  });

  localDb.run(`
    CREATE TABLE IF NOT EXISTS configuracion_local (
      clave TEXT UNIQUE,
      valor TEXT
    )
  `, (err) => {
    if (err) {
      console.error('Error creando tabla configuracion_local en local.db:', err.message);
    } else {
      localDb.run(`INSERT OR IGNORE INTO configuracion_local (clave, valor) VALUES ('correlativo_reportes_rap', '1')`);
    }
  });

  // Catálogo de Direcciones Municipales Oficiales (Maipú)
  localDb.run(`
    CREATE TABLE IF NOT EXISTS direcciones_municipales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      acronimo TEXT NOT NULL UNIQUE COLLATE NOCASE,
      nombre TEXT NOT NULL,
      orden INTEGER DEFAULT 0,
      activo INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT (datetime('now', 'localtime')),
      updated_at DATETIME DEFAULT (datetime('now', 'localtime'))
    )
  `, (err) => {
    if (err) {
      console.error('Error creando tabla direcciones_municipales:', err.message);
    } else {
      const defaultDirecciones = [
        ['ALC', 'Alcaldía', 1],
        ['ADM', 'Administrador Municipal', 2],
        ['CON', 'Concejo Municipal / Concejales', 3],
        ['SECMUN', 'Secretaría Municipal', 4],
        ['SECPLA', 'Secretaría Comunal de Planificación', 5],
        ['DOM', 'Dirección de Obras Municipales', 6],
        ['DIDECO', 'Dirección de Desarrollo Comunitario', 7],
        ['DAF', 'Dirección de Administración y Finanzas', 8],
        ['DAJ', 'Dirección de Asesoría Jurídica', 9],
        ['CTRL', 'Dirección de Control', 10],
        ['DIPRESEC', 'Dirección de Prevención y Seguridad Ciudadana', 11],
        ['DTT', 'Dirección de Tránsito y Transporte Público', 12],
        ['DAOGA', 'Dirección de Aseo, Ornato y Gestión Ambiental', 13],
        ['DITEC', 'Dirección de Tecnologías de la Información y Comunicaciones', 14],
        ['RRHH', 'Dirección de Personas / Recursos Humanos', 15],
        ['OPS', 'Dirección de Operaciones', 16],
        ['REN', 'Departamento de Rentas Municipales', 17],
        ['SMAPA', 'Servicio Municipal de Agua Potable y Alcantarillado', 18],
        ['JPL', 'Juzgados de Policía Local', 19],
        ['JGAB', 'Jefatura de Gabinete', 20],
        ['COMS', 'Comunicaciones', 21]
      ];
      defaultDirecciones.forEach(([acronimo, nombre, ord]) => {
        localDb.run(`INSERT OR IGNORE INTO direcciones_municipales (acronimo, nombre, orden) VALUES (?, ?, ?)`, [acronimo, nombre, ord]);
      });
    }
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
      asistente_tecnico TEXT,
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
          const hasAsistente = rows.some(r => r.name === 'asistente_tecnico');
          if (!hasAsistente) {
            db.run("ALTER TABLE sujetos_pasivos_sph ADD COLUMN asistente_tecnico TEXT");
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
db.asistenciasDb = asistenciasDb;

module.exports = db;
