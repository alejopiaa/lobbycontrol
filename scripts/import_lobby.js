const XLSX = require('xlsx');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const crypto = require('crypto');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const dbPath = path.join(__dirname, '..', process.env.DATABASE_PATH || 'lobby.db');
const excelPath = path.join(__dirname, '..', process.env.EXCEL_PATH || 'lobby_data.xlsx');

console.log('Iniciando importación desde:', excelPath);

// Función para formatear fechas de Excel a ISO YYYY-MM-DD [HH:MM]
function parseExcelDate(serial) {
  if (serial === undefined || serial === null || serial === '') return '';
  if (typeof serial === 'string') return serial.trim();
  if (typeof serial === 'number') {
    const utcDays = serial - 25569;
    const date = new Date(Math.round(utcDays * 86400000));
    const yyyy = date.getUTCFullYear();
    const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(date.getUTCDate()).padStart(2, '0');
    const hh = String(date.getUTCHours()).padStart(2, '0');
    const min = String(date.getUTCMinutes()).padStart(2, '0');
    
    // Si tiene parte decimal (hora significativa), agregamos la hora
    if (serial % 1 !== 0) {
      return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
    }
    return `${yyyy}-${mm}-${dd}`;
  }
  return String(serial).trim();
}

// =========================================================================
// MOTORES DE CÁLCULO ANALÍTICO (PORTADOS DE HELPERS.JS PARA INGESTA)
// =========================================================================

const dateUtils = require('../src/utils/date-utils');
const isChileanHoliday = dateUtils.isChileanHoliday;
const getDeadlineDate = dateUtils.getDeadlineDate;
const getBusinessDaysDiff = dateUtils.getBusinessDaysDiff;
const getLastBusinessDayOfMonth = dateUtils.getLastBusinessDayOfMonth;

function getCargoClean(cargoString) {
  if (!cargoString) return 'No definido';
  const parts = cargoString.split(' - ');
  if (parts.length > 1) {
    return parts.slice(0, -1).join(' - ').trim();
  }
  return cargoString.trim();
}

function precalculateSolicitudFields(row) {
  const cargo = row['Cargo'] || '';
  const cargo_limpio = getCargoClean(cargo);
  
  let codigo_licitacion = null;
  const licitacionMatch = cargo.match(/^\s*(2770-\d+-?\s*[A-Z0-9]+)/i);
  if (licitacionMatch) {
    codigo_licitacion = licitacionMatch[1].trim();
  }
  
  const fecha_ingreso = row['Fecha ingreso'];
  const deadlineDate = getDeadlineDate(fecha_ingreso);
  let fecha_limite_sh = '';
  if (deadlineDate) {
    const d = String(deadlineDate.getUTCDate()).padStart(2, '0');
    const m = String(deadlineDate.getUTCMonth() + 1).padStart(2, '0');
    const y = deadlineDate.getUTCFullYear();
    fecha_limite_sh = `${y}-${m}-${d}`;
  }
  
  const fecha_respuesta = row['Fecha respuesta'];
  let dias_habiles_respuesta = null;
  const hasRespuesta = fecha_respuesta && fecha_respuesta !== '-' && fecha_respuesta !== 'null' && fecha_respuesta !== '---';
  if (fecha_ingreso && hasRespuesta && deadlineDate) {
    try {
      const respParts = fecha_respuesta.split(' ')[0].split('-');
      if (respParts.length === 3) {
        const respYear = parseInt(respParts[0], 10);
        const respMonth = parseInt(respParts[1], 10) - 1;
        const respDay = parseInt(respParts[2], 10);
        const responseUTC = new Date(Date.UTC(respYear, respMonth, respDay));
        const deadlineUTC = new Date(Date.UTC(deadlineDate.getUTCFullYear(), deadlineDate.getUTCMonth(), deadlineDate.getUTCDate()));
        dias_habiles_respuesta = getBusinessDaysDiff(deadlineUTC, responseUTC);
      }
    } catch (e) {}
  }
  
  const estado = row['Estado'] || 'Pendiente';
  const estadoClean = estado.trim();
  let estado_cumplimiento_sh = 'PENDIENTE_EN_PLAZO';
  
  if (estadoClean !== 'Ingresada') {
    if (hasRespuesta && deadlineDate && dias_habiles_respuesta !== null) {
      estado_cumplimiento_sh = dias_habiles_respuesta > 0 ? 'FUERA_PLAZO' : 'EN_PLAZO';
    } else {
      estado_cumplimiento_sh = 'EN_PLAZO';
    }
  } else {
    if (deadlineDate) {
      const today = new Date();
      const todayUTC = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
      const deadlineUTC = new Date(Date.UTC(deadlineDate.getUTCFullYear(), deadlineDate.getUTCMonth(), deadlineDate.getUTCDate()));
      const diffDays = getBusinessDaysDiff(todayUTC, deadlineUTC);
      estado_cumplimiento_sh = diffDays < 0 ? 'PENDIENTE_VENCIDA' : 'PENDIENTE_EN_PLAZO';
    }
  }
  
  const fecha_agendada = row['Fecha agendada'];
  let fecha_limite_publicacion = null;
  if (estadoClean === 'Aceptada' && fecha_agendada) {
    try {
      const agendadaParts = fecha_agendada.split(' ')[0].split('-');
      if (agendadaParts.length === 3) {
        const year = parseInt(agendadaParts[0], 10);
        const month = parseInt(agendadaParts[1], 10) - 1;
        const deadlinePubDate = getLastBusinessDayOfMonth(year, month);
        const d = String(deadlinePubDate.getUTCDate()).padStart(2, '0');
        const m = String(deadlinePubDate.getUTCMonth() + 1).padStart(2, '0');
        const y = deadlinePubDate.getUTCFullYear();
        fecha_limite_publicacion = `${y}-${m}-${d}`;
      }
    } catch (e) {}
  }
  
  return {
    cargo_limpio,
    codigo_licitacion,
    fecha_limite_sh,
    dias_habiles_respuesta,
    estado_cumplimiento_sh,
    fecha_limite_publicacion
  };
}

function getPublishedDelay(fechaInicio, fechaPublicacion) {
  if (!fechaInicio || !fechaPublicacion) return 0;
  try {
    const inicioParts = fechaInicio.split(' ')[0].split('-');
    const pubParts = fechaPublicacion.split(' ')[0].split('-');
    if (inicioParts.length !== 3 || pubParts.length !== 3) return 0;
    
    const yearA = parseInt(inicioParts[0], 10);
    const monthA = parseInt(inicioParts[1], 10) - 1;
    
    const yearB = parseInt(pubParts[0], 10);
    const monthB = parseInt(pubParts[1], 10) - 1;
    
    const monthsDiff = (yearB * 12 + monthB) - (yearA * 12 + monthA);
    return monthsDiff > 0 ? monthsDiff * 30 : 0;
  } catch (e) {
    return 0;
  }
}

// Abrir base de datos
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error abriendo base de datos:', err.message);
    process.exit(1);
  }
  console.log('Conectado a la base de datos:', dbPath);
});

// Manejadores de señales de terminación para asegurar consistencia e impedir transacciones colgadas
const handleTermination = () => {
  console.log('\nTerminación forzada detectada. Cerrando conexión de base de datos...');
  db.run('ROLLBACK', (err) => {
    db.close(() => {
      process.exit(1);
    });
  });
};

process.on('SIGTERM', handleTermination);
process.on('SIGINT', handleTermination);

// Cargar el libro Excel
let workbook;
try {
  workbook = XLSX.readFile(excelPath);
  console.log('Libro Excel abierto correctamente. Hojas:', workbook.SheetNames);
} catch (e) {
  console.error('Error al abrir el Excel. Asegúrate de que no esté abierto en otra aplicación:', e.message);
  db.close();
  process.exit(1);
}

/**
 * Normaliza un valor de celda para el cálculo del hash
 * - null/undefined/"" -> ""
 * - String -> trim()
 */
function normalizeVal(val) {
  if (val === null || val === undefined) return '';
  return String(val).trim();
}

/**
 * Calcula un hash MD5 de un array de valores normalizados
 */
function calculateHashFromValues(valuesArray) {
  const normalized = valuesArray.map(v => normalizeVal(v));
  return crypto.createHash('md5').update(normalized.join('|')).digest('hex');
}

/**
 * Sincronización incremental de solicitudes_sh
 */
function syncSolicitudes(rows, callback) {
  db.all("SELECT id_lobby, row_hash FROM solicitudes_sh", [], (err, existingRows) => {
    if (err) return callback(err);

    const existingMap = {};
    existingRows.forEach(r => {
      if (r.id_lobby !== null && r.id_lobby !== undefined) {
        existingMap[r.id_lobby] = r.row_hash || '';
      }
    });

    db.run('BEGIN TRANSACTION', (err) => {
      if (err) console.error('Error al iniciar transacción SH:', err.message);
    });

    const insertStmt = db.prepare(`
      INSERT INTO solicitudes_sh (
        id_lobby, folio_lobby, fecha_ingreso, fecha_respuesta, fecha_agendada,
        sujeto_pasivo, cargo, sujeto_pasivo_id, sujeto_activo, rut,
        representado, materia, especificacion_materia, estado,
        cargo_limpio, codigo_licitacion, fecha_limite_sh,
        dias_habiles_respuesta, estado_cumplimiento_sh, fecha_limite_publicacion,
        row_hash
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const updateStmt = db.prepare(`
      UPDATE solicitudes_sh SET
        folio_lobby = ?, fecha_ingreso = ?, fecha_respuesta = ?, fecha_agendada = ?,
        sujeto_pasivo = ?, cargo = ?, sujeto_pasivo_id = ?, sujeto_activo = ?, rut = ?,
        representado = ?, materia = ?, especificacion_materia = ?, estado = ?,
        cargo_limpio = ?, codigo_licitacion = ?, fecha_limite_sh = ?,
        dias_habiles_respuesta = ?, estado_cumplimiento_sh = ?, fecha_limite_publicacion = ?,
        row_hash = ?
      WHERE id_lobby = ?
    `);

    const seenIds = new Set();
    let insertsCount = 0;
    let updatesCount = 0;
    let skippedCount = 0;
    let pendingOps = 0;
    let loopFinished = false;

    function checkFinished() {
      if (loopFinished && pendingOps === 0) {
        insertStmt.finalize();
        updateStmt.finalize();

        const deleteIds = [];
        Object.keys(existingMap).forEach(id => {
          const numericId = parseInt(id, 10);
          if (!seenIds.has(numericId)) {
            deleteIds.push(numericId);
          }
        });

        const performCommit = (deletesCount) => {
          db.run('COMMIT', (err) => {
            if (err) {
              console.error('Error al hacer COMMIT de SH:', err.message);
              callback(err);
            } else {
              console.log(`✓ Sincronización SH: ${insertsCount} insertados, ${updatesCount} actualizados, ${skippedCount} omitidos, ${deletesCount} eliminados.`);
              callback(null, { insertsCount, updatesCount, skippedCount, deletesCount });
            }
          });
        };

        if (deleteIds.length > 0) {
          const placeholders = deleteIds.map(() => '?').join(',');
          db.run(`DELETE FROM solicitudes_sh WHERE id_lobby IN (${placeholders})`, deleteIds, function(err) {
            if (err) console.error('Error al eliminar huérfanos de SH:', err.message);
            performCommit(this ? this.changes : 0);
          });
        } else {
          performCommit(0);
        }
      }
    }

    rows.forEach((row) => {
      const idLobby = row['Id'] || null;
      if (idLobby === null) return;
      seenIds.add(idLobby);

      const parsedFechaIngreso = parseExcelDate(row['Fecha ingreso']);
      const parsedFechaRespuesta = parseExcelDate(row['Fecha respuesta']);
      const parsedFechaAgendada = parseExcelDate(row['Fecha agendada']);

      const precalc = precalculateSolicitudFields({
        ...row,
        'Fecha ingreso': parsedFechaIngreso,
        'Fecha respuesta': parsedFechaRespuesta,
        'Fecha agendada': parsedFechaAgendada
      });

      const valuesForHash = [
        idLobby,
        row['Folio'] || '',
        parsedFechaIngreso,
        parsedFechaRespuesta,
        parsedFechaAgendada,
        row['Sujeto pasivo'] || '',
        row['Cargo'] || '',
        row['Sujeto pasivo id'] || null,
        row['Sujeto activo'] || '',
        row['Rut'] || '',
        row['Representado'] || '',
        row['Materia'] || '',
        row['Especificación materia'] || '',
        row['Estado'] || 'Pendiente',
        precalc.cargo_limpio,
        precalc.codigo_licitacion,
        precalc.fecha_limite_sh,
        precalc.dias_habiles_respuesta,
        precalc.estado_cumplimiento_sh,
        precalc.fecha_limite_publicacion
      ];

      const currentHash = calculateHashFromValues(valuesForHash);

      if (!existingMap.hasOwnProperty(idLobby)) {
        pendingOps++;
        insertStmt.run([...valuesForHash, currentHash], (err) => {
          if (err) console.error(`Error al insertar SH ID ${idLobby}:`, err.message);
          pendingOps--;
          checkFinished();
        });
        insertsCount++;
      } else if (existingMap[idLobby] !== currentHash) {
        const updateValues = [
          row['Folio'] || '',
          parsedFechaIngreso,
          parsedFechaRespuesta,
          parsedFechaAgendada,
          row['Sujeto pasivo'] || '',
          row['Cargo'] || '',
          row['Sujeto pasivo id'] || null,
          row['Sujeto activo'] || '',
          row['Rut'] || '',
          row['Representado'] || '',
          row['Materia'] || '',
          row['Especificación materia'] || '',
          row['Estado'] || 'Pendiente',
          precalc.cargo_limpio,
          precalc.codigo_licitacion,
          precalc.fecha_limite_sh,
          precalc.dias_habiles_respuesta,
          precalc.estado_cumplimiento_sh,
          precalc.fecha_limite_publicacion,
          currentHash,
          idLobby
        ];
        pendingOps++;
        updateStmt.run(updateValues, (err) => {
          if (err) console.error(`Error al actualizar SH ID ${idLobby}:`, err.message);
          pendingOps--;
          checkFinished();
        });
        updatesCount++;
      } else {
        skippedCount++;
      }
    });

    loopFinished = true;
    checkFinished();
  });
}

/**
 * Sincronización incremental de publicadas_ph
 */
function syncPublicadas(rows, solicitudAceptadaMap, callback) {
  db.all("SELECT id_lobby, row_hash FROM publicadas_ph", [], (err, existingRows) => {
    if (err) return callback(err);

    const existingMap = {};
    existingRows.forEach(r => {
      if (r.id_lobby !== null && r.id_lobby !== undefined) {
        existingMap[r.id_lobby] = r.row_hash || '';
      }
    });

    db.run('BEGIN TRANSACTION', (err) => {
      if (err) console.error('Error al iniciar transacción PH:', err.message);
    });

    const insertStmt = db.prepare(`
      INSERT INTO publicadas_ph (
        id_lobby, folio_lobby, estado, forma, materia, especificacion_materia,
        lugar, comuna, sujeto_pasivo, cargo, sujeto_activo, rut, genero,
        tipo, representado, fecha_inicio, fecha_termino, duracion,
        fecha_publicacion, cumplimiento, id_solicitud_lobby, row_hash
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const updateStmt = db.prepare(`
      UPDATE publicadas_ph SET
        folio_lobby = ?, estado = ?, forma = ?, materia = ?, especificacion_materia = ?,
        lugar = ?, comuna = ?, sujeto_pasivo = ?, cargo = ?, sujeto_activo = ?, rut = ?, genero = ?,
        tipo = ?, representado = ?, fecha_inicio = ?, fecha_termino = ?, duracion = ?,
        fecha_publicacion = ?, cumplimiento = ?, id_solicitud_lobby = ?, row_hash = ?
      WHERE id_lobby = ?
    `);

    const seenIds = new Set();
    let insertsCount = 0;
    let updatesCount = 0;
    let skippedCount = 0;
    let pendingOps = 0;
    let loopFinished = false;

    function checkFinished() {
      if (loopFinished && pendingOps === 0) {
        insertStmt.finalize();
        updateStmt.finalize();

        const deleteIds = [];
        Object.keys(existingMap).forEach(id => {
          const numericId = parseInt(id, 10);
          if (!seenIds.has(numericId)) {
            deleteIds.push(numericId);
          }
        });

        const performCommit = (deletesCount) => {
          db.run('COMMIT', (err) => {
            if (err) {
              console.error('Error al hacer COMMIT de PH:', err.message);
              callback(err);
            } else {
              console.log(`✓ Sincronización PH: ${insertsCount} insertados, ${updatesCount} actualizados, ${skippedCount} omitidos, ${deletesCount} eliminados.`);
              callback(null, { insertsCount, updatesCount, skippedCount, deletesCount });
            }
          });
        };

        if (deleteIds.length > 0) {
          const placeholders = deleteIds.map(() => '?').join(',');
          db.run(`DELETE FROM publicadas_ph WHERE id_lobby IN (${placeholders})`, deleteIds, function(err) {
            if (err) console.error('Error al eliminar huérfanos de PH:', err.message);
            performCommit(this ? this.changes : 0);
          });
        } else {
          performCommit(0);
        }
      }
    }

    rows.forEach((row) => {
      const idLobby = row['Id'] || null;
      if (idLobby === null) return;
      seenIds.add(idLobby);

      const parsedFechaInicio = parseExcelDate(row['Fecha inicio']);
      const parsedFechaPublicacion = parseExcelDate(row['Fecha publicación']);
      
      let cumplimientoVal = row['Cumplimiento'] || 'En plazo';
      if (parsedFechaInicio && parsedFechaPublicacion) {
        const delay = getPublishedDelay(parsedFechaInicio, parsedFechaPublicacion);
        cumplimientoVal = delay > 0 ? `Fuera de plazo (-${delay}d)` : 'En plazo';
      } else {
        if (cumplimientoVal.toLowerCase().includes('fuera')) {
          cumplimientoVal = 'Fuera de plazo';
        } else {
          cumplimientoVal = 'En plazo';
        }
      }

      const folio = row['Folio'] || '';
      const idSolicitudLobby = solicitudAceptadaMap[folio] || null;

      const valuesForHash = [
        idLobby,
        folio,
        row['Estado'] || 'Publicada',
        row['Forma'] || '',
        row['Materia'] || '',
        row['Especificación materia tratada'] || '',
        row['Lugar'] || '',
        row['Comuna'] || '',
        row['Sujeto pasivo'] || '',
        row['Cargo'] || '',
        row['Sujeto activo'] || '',
        row['Rut'] || '',
        row['Genero'] || '',
        row['Tipo'] || '',
        row['Representado'] || '',
        parsedFechaInicio,
        parseExcelDate(row['Fecha término']),
        row['Duración'] || '',
        parsedFechaPublicacion,
        cumplimientoVal,
        idSolicitudLobby
      ];

      const currentHash = calculateHashFromValues(valuesForHash);

      if (!existingMap.hasOwnProperty(idLobby)) {
        pendingOps++;
        insertStmt.run([...valuesForHash, currentHash], (err) => {
          if (err) console.error(`Error al insertar PH ID ${idLobby}:`, err.message);
          pendingOps--;
          checkFinished();
        });
        insertsCount++;
      } else if (existingMap[idLobby] !== currentHash) {
        const updateValues = [
          folio,
          row['Estado'] || 'Publicada',
          row['Forma'] || '',
          row['Materia'] || '',
          row['Especificación materia tratada'] || '',
          row['Lugar'] || '',
          row['Comuna'] || '',
          row['Sujeto pasivo'] || '',
          row['Cargo'] || '',
          row['Sujeto activo'] || '',
          row['Rut'] || '',
          row['Genero'] || '',
          row['Tipo'] || '',
          row['Representado'] || '',
          parsedFechaInicio,
          parseExcelDate(row['Fecha término']),
          row['Duración'] || '',
          parsedFechaPublicacion,
          cumplimientoVal,
          idSolicitudLobby,
          currentHash,
          idLobby
        ];
        pendingOps++;
        updateStmt.run(updateValues, (err) => {
          if (err) console.error(`Error al actualizar PH ID ${idLobby}:`, err.message);
          pendingOps--;
          checkFinished();
        });
        updatesCount++;
      } else {
        skippedCount++;
      }
    });

    loopFinished = true;
    checkFinished();
  });
}

/**
 * Sincronización incremental de sujetos_pasivos_sph
 */
function syncSujetosPasivos(rows, callback) {
  db.all("SELECT id_sujeto_lobby, row_hash FROM sujetos_pasivos_sph", [], (err, existingRows) => {
    if (err) return callback(err);

    const existingMap = {};
    existingRows.forEach(r => {
      if (r.id_sujeto_lobby !== null && r.id_sujeto_lobby !== undefined) {
        existingMap[r.id_sujeto_lobby] = r.row_hash || '';
      }
    });

    db.run('BEGIN TRANSACTION', (err) => {
      if (err) console.error('Error al iniciar transacción SPH:', err.message);
    });

    const insertStmt = db.prepare(`
      INSERT INTO sujetos_pasivos_sph (
        id_sujeto_lobby, nombre, rut, cargo, tipo, zona,
        fecha_incorporacion, fecha_termino, respaldo_juridico, row_hash
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const updateStmt = db.prepare(`
      UPDATE sujetos_pasivos_sph SET
        nombre = ?, rut = ?, cargo = ?, tipo = ?, zona = ?,
        fecha_incorporacion = ?, fecha_termino = ?, respaldo_juridico = ?, row_hash = ?
      WHERE id_sujeto_lobby = ?
    `);

    const seenIds = new Set();
    let insertsCount = 0;
    let updatesCount = 0;
    let skippedCount = 0;
    let pendingOps = 0;
    let loopFinished = false;

    function checkFinished() {
      if (loopFinished && pendingOps === 0) {
        insertStmt.finalize();
        updateStmt.finalize();

        const deleteIds = [];
        Object.keys(existingMap).forEach(id => {
          const numericId = parseInt(id, 10);
          if (!seenIds.has(numericId)) {
            deleteIds.push(numericId);
          }
        });

        const performCommit = (deletesCount) => {
          db.run('COMMIT', (err) => {
            if (err) {
              console.error('Error al hacer COMMIT de SPH:', err.message);
              callback(err);
            } else {
              console.log(`✓ Sincronización SPH: ${insertsCount} insertados, ${updatesCount} actualizados, ${skippedCount} omitidos, ${deletesCount} eliminados.`);
              rebuildActiveSujetoIdsTable(() => {
                callback(null, { insertsCount, updatesCount, skippedCount, deletesCount });
              });
            }
          });
        };

        if (deleteIds.length > 0) {
          const placeholders = deleteIds.map(() => '?').join(',');
          db.run(`DELETE FROM sujetos_pasivos_sph WHERE id_sujeto_lobby IN (${placeholders})`, deleteIds, function(err) {
            if (err) console.error('Error al eliminar huérfanos de SPH:', err.message);
            performCommit(this ? this.changes : 0);
          });
        } else {
          performCommit(0);
        }
      }
    }

    rows.forEach((row) => {
      const idSujeto = row['ID'] || null;
      if (idSujeto === null) return;
      seenIds.add(idSujeto);

      const valuesForHash = [
        idSujeto,
        row['Nombre'] || '',
        row['Rut'] || '',
        row['Cargo o función'] || '',
        row['Tipo'] || '',
        row['Zona'] || '',
        parseExcelDate(row['Fecha incorporación']),
        parseExcelDate(row['Fecha término']),
        row['Respaldo juridico'] || ''
      ];

      const currentHash = calculateHashFromValues(valuesForHash);

      if (!existingMap.hasOwnProperty(idSujeto)) {
        pendingOps++;
        insertStmt.run([...valuesForHash, currentHash], (err) => {
          if (err) console.error(`Error al insertar SPH ID ${idSujeto}:`, err.message);
          pendingOps--;
          checkFinished();
        });
        insertsCount++;
      } else if (existingMap[idSujeto] !== currentHash) {
        const updateValues = [
          row['Nombre'] || '',
          row['Rut'] || '',
          row['Cargo o función'] || '',
          row['Tipo'] || '',
          row['Zona'] || '',
          parseExcelDate(row['Fecha incorporación']),
          parseExcelDate(row['Fecha término']),
          row['Respaldo juridico'] || '',
          currentHash,
          idSujeto
        ];
        pendingOps++;
        updateStmt.run(updateValues, (err) => {
          if (err) console.error(`Error al actualizar SPH ID ${idSujeto}:`, err.message);
          pendingOps--;
          checkFinished();
        });
        updatesCount++;
      } else {
        skippedCount++;
      }
    });

    loopFinished = true;
    checkFinished();
  });
}

/**
 * Guarda la fecha de última actualización en la tabla configuracion
 */
function saveLastImportTimestamp(callback) {
  const mtime = new Date();
  const yyyy = mtime.getFullYear();
  const mm = String(mtime.getMonth() + 1).padStart(2, '0');
  const dd = String(mtime.getDate()).padStart(2, '0');
  const hh = String(mtime.getHours()).padStart(2, '0');
  const min = String(mtime.getMinutes()).padStart(2, '0');
  const timestampStr = `${dd}-${mm}-${yyyy} ${hh}:${min}`;

  db.run(
    "INSERT OR REPLACE INTO configuracion (clave, valor) VALUES ('last_import_timestamp', ?)",
    [timestampStr],
    (err) => {
      if (err) {
        console.error('Error al registrar fecha de importación:', err.message);
      } else {
        console.log(`✓ Fecha de última actualización registrada en la base de datos: ${timestampStr}`);
      }
      callback(err);
    }
  );
}

// Objeto acumulador de estadísticas de importación
const allStats = {
  sh: { inserts: 0, updates: 0, skipped: 0, deletes: 0 },
  ph: { inserts: 0, updates: 0, skipped: 0, deletes: 0 },
  sph: { inserts: 0, updates: 0, skipped: 0, deletes: 0 }
};

// Ejecutar la importación de forma transaccional y secuencial
db.serialize(() => {
  db.run('PRAGMA busy_timeout = 30000');
  db.run('PRAGMA synchronous = OFF');

  const solicitudAceptadaMap = {};

  if (workbook.SheetNames.includes('SH')) {
    const sheet = workbook.Sheets['SH'];
    const rows = XLSX.utils.sheet_to_json(sheet);
    console.log(`\nProcesando ${rows.length} registros para la tabla "solicitudes_sh"...`);

    rows.forEach(row => {
      if ((row['Estado'] || '').trim() === 'Aceptada') {
        const folio = row['Folio'] || '';
        const id = row['Id'] || null;
        if (folio && id) {
          if (!solicitudAceptadaMap[folio] || id > solicitudAceptadaMap[folio]) {
            solicitudAceptadaMap[folio] = id;
          }
        }
      }
    });
    console.log(`  → Mapa de solicitudes Aceptadas construido: ${Object.keys(solicitudAceptadaMap).length} folios únicos.`);

    syncSolicitudes(rows, (err, stats) => {
      if (err) {
        console.error('Error al sincronizar solicitudes_sh:', err.message);
        db.close();
        process.exit(1);
      }
      if (stats) {
        allStats.sh = {
          inserts: stats.insertsCount,
          updates: stats.updatesCount,
          skipped: stats.skippedCount,
          deletes: stats.deletesCount
        };
      }
      processPH();
    });
  } else {
    console.log('⚠ No se encontró la hoja "SH" en el Excel.');
    processPH();
  }

  function processPH() {
    if (workbook.SheetNames.includes('PH')) {
      const sheet = workbook.Sheets['PH'];
      const rows = XLSX.utils.sheet_to_json(sheet);
      console.log(`\nProcesando ${rows.length} registros para la tabla "publicadas_ph"...`);

      syncPublicadas(rows, solicitudAceptadaMap, (err, stats) => {
        if (err) {
          console.error('Error al sincronizar publicadas_ph:', err.message);
          db.close();
          process.exit(1);
        }
        if (stats) {
          allStats.ph = {
            inserts: stats.insertsCount,
            updates: stats.updatesCount,
            skipped: stats.skippedCount,
            deletes: stats.deletesCount
          };
        }
        processSPH();
      });
    } else {
      console.log('⚠ No se encontró la hoja "PH" en el Excel.');
      processSPH();
    }
  }

  function processSPH() {
    if (workbook.SheetNames.includes('SPH')) {
      const sheet = workbook.Sheets['SPH'];
      const rows = XLSX.utils.sheet_to_json(sheet);
      console.log(`\nProcesando ${rows.length} registros para la tabla "sujetos_pasivos_sph"...`);

      syncSujetosPasivos(rows, (err, stats) => {
        if (err) {
          console.error('Error al sincronizar sujetos_pasivos_sph:', err.message);
          db.close();
          process.exit(1);
        }
        if (stats) {
          allStats.sph = {
            inserts: stats.insertsCount,
            updates: stats.updatesCount,
            skipped: stats.skippedCount,
            deletes: stats.deletesCount
          };
        }
        finalizeImport();
      });
    } else {
      console.log('⚠ No se encontró la hoja "SPH" en el Excel.');
      finalizeImport();
    }
  }

  function finalizeImport() {
    const totalChanges = 
      (allStats.sh.inserts || 0) + (allStats.sh.updates || 0) + (allStats.sh.deletes || 0) +
      (allStats.ph.inserts || 0) + (allStats.ph.updates || 0) + (allStats.ph.deletes || 0) +
      (allStats.sph.inserts || 0) + (allStats.sph.updates || 0) + (allStats.sph.deletes || 0);

    const nextStep = () => {
      console.log('Ejecutando limpieza y optimización de base de datos (VACUUM)...');
      db.run('VACUUM', (vErr) => {
        if (vErr) {
          console.error('Error al ejecutar VACUUM:', vErr.message);
        } else {
          console.log('✓ Base de datos optimizada y compactada con éxito (VACUUM).');
        }
        
        console.log('\nImportación masiva completada con éxito.');
        
        if (process.send) {
          process.send({
            type: 'import_stats',
            stats: allStats
          });
        }
        
        db.close();
      });
    };

    if (totalChanges > 0) {
      saveLastImportTimestamp((err) => {
        nextStep();
      });
    } else {
      console.log('No se detectaron cambios reales en los datos importados. Se omite la actualización de la marca de tiempo de última modificación.');
      nextStep();
    }
  }
});

function rebuildActiveSujetoIdsTable(done) {
  const todayStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  db.run('DELETE FROM sujetos_pasivos_vigentes', (err) => {
    if (err) {
      console.error('Error al limpiar sujetos_pasivos_vigentes:', err.message);
      return done();
    }
    
    db.all('SELECT id_sujeto_lobby, fecha_termino FROM sujetos_pasivos_sph', [], (err, rows) => {
      if (err) {
        console.error('Error al consultar sujetos_pasivos_sph para vigencia:', err.message);
        return done();
      }
      
      if (!rows || rows.length === 0) return done();
      
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
          console.log(`✓ Sincronización vigentes: ${count} registros vigentes creados en sujetos_pasivos_vigentes.`);
        }
        done();
      });
    });
  });
}
