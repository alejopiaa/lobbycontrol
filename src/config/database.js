require('dotenv').config();
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const auth = require('../middleware/auth');

const dbPath = path.isAbsolute(process.env.DATABASE_PATH || 'lobby.db')
  ? (process.env.DATABASE_PATH || 'lobby.db')
  : path.join(__dirname, '..', '..', process.env.DATABASE_PATH || 'lobby.db');

// Conectar a la base de datos SQLite (se creará el archivo si no existe)
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error al abrir la base de datos SQLite:', err.message);
  } else {
    console.log('Conectado a la base de datos local SQLite:', dbPath);
    db.run('PRAGMA journal_mode = WAL', (err) => {
      if (err) {
        console.error('Error al activar WAL en SQLite:', err.message);
      } else {
        console.log('Modo WAL (Write-Ahead Logging) activado en SQLite.');
      }
    });
  }
});

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
      
      // Migración para agregar row_hash a solicitudes_sh si ya existía la tabla sin esa columna
      db.all("PRAGMA table_info(solicitudes_sh)", [], (err, rows) => {
        if (!err && rows) {
          const hasRowHash = rows.some(r => r.name === 'row_hash');
          if (!hasRowHash) {
            db.run("ALTER TABLE solicitudes_sh ADD COLUMN row_hash TEXT", (err) => {
              if (err) console.error('Error migrando row_hash en solicitudes_sh:', err.message);
              else console.log('Columna row_hash agregada con éxito a la tabla solicitudes_sh.');
            });
          }
        }
      });
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

});


function rebuildActiveSujetoIdsTable() {
  db.serialize(() => {
    db.run('DELETE FROM sujetos_pasivos_vigentes', (err) => {
      if (err) {
        console.error('Error al limpiar sujetos_pasivos_vigentes:', err.message);
        return;
      }
      
      const todayStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      
      db.all('SELECT id_sujeto_lobby, fecha_termino FROM sujetos_pasivos_sph', [], (err, rows) => {
        if (err) {
          console.error('Error al consultar sujetos_pasivos_sph para vigencia:', err.message);
          return;
        }
        
        if (!rows || rows.length === 0) return;
        
        const insertStmt = db.prepare('INSERT OR IGNORE INTO sujetos_pasivos_vigentes (id_sujeto_lobby) VALUES (?)');
        let count = 0;
        
        rows.forEach(sp => {
          const ft = sp.fecha_termino;
          let vigente = false;
          if (!ft) {
            vigente = true;
          } else {
            const clean = ft.trim().toLowerCase();
            if (clean === '' || clean === 'indefinido' || clean === 'indefinicio' || clean === 'null' || clean === '-' || clean.includes('indefin')) {
              vigente = true;
            } else {
              try {
                if (clean >= todayStr) {
                  vigente = true;
                }
              } catch (e) {}
            }
          }
          
          if (vigente && sp.id_sujeto_lobby) {
            insertStmt.run(sp.id_sujeto_lobby);
            count++;
          }
        });
        
        insertStmt.finalize((err) => {
          if (!err) {
            console.log(`✓ Tabla sujetos_pasivos_vigentes inicializada: ${count} registros vigentes creados.`);
          }
        });
      });
    });
  });
}

module.exports = db;
