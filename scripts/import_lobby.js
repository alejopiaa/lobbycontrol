const XLSX = require("xlsx");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const crypto = require("crypto");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const fs = require("fs");
const https = require("https");

// =========================================================================
// HELPERS PARA SINCRONIZACIÓN DIRECTA CON SHAREPOINT
// =========================================================================

function compressFileAsync(src, dest) {
  return new Promise((resolve, reject) => {
    const zlib = require("zlib");
    const sourceStream = fs.createReadStream(src);
    const gzipStream = zlib.createGzip();
    const destStream = fs.createWriteStream(dest);

    sourceStream.on("error", reject);
    gzipStream.on("error", reject);
    destStream.on("error", reject);

    destStream.on("close", () => {
      resolve();
    });

    sourceStream.pipe(gzipStream).pipe(destStream);
  });
}

// Agente HTTPS que ignora errores de certificado en entornos corporativos (Electron + Microsoft)
const sharepointAgent = new https.Agent({ rejectUnauthorized: false });

function extractSiteUrl(sharepointUrl) {
  try {
    const parsed = new URL(sharepointUrl);
    const pathParts = parsed.pathname.split("/");
    if (pathParts[1] === "sites" && pathParts[2]) {
      return `${parsed.origin}/sites/${pathParts[2]}`;
    }
    return parsed.origin;
  } catch (e) {
    console.error("Error al extraer site URL:", e.message);
    return "https://immaipu.sharepoint.com/sites/SECMU";
  }
}

// resolveRemoteFolderUrl eliminada: se usa SHAREPOINT_FOLDER_PATH desde .env directamente.

function getRequestDigest(siteUrl, cookies) {
  return new Promise((resolve, reject) => {
    let parsedUrl;
    try {
      parsedUrl = new URL(siteUrl);
    } catch (e) {
      return reject(new Error(`URL de sitio inválida: ${siteUrl}`));
    }

    const options = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + "/_api/contextinfo",
      method: "POST",
      agent: sharepointAgent,
      headers: {
        Cookie: cookies,
        Accept: "application/json;odata=verbose",
        "Content-Length": "0",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Electron/LobbyControl",
      },
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        if (res.statusCode !== 200 && res.statusCode !== 201) {
          return reject(
            new Error(
              `Error al obtener contextinfo (HTTP ${res.statusCode}): ${data}`,
            ),
          );
        }
        try {
          const parsed = JSON.parse(data);
          const digest = parsed.d?.GetContextWebInformation?.FormDigestValue;
          if (digest) {
            resolve(digest);
          } else {
            reject(
              new Error(
                `No se encontró FormDigestValue en la respuesta de contextinfo.`,
              ),
            );
          }
        } catch (err) {
          reject(new Error(`Error al parsear contextinfo: ${err.message}`));
        }
      });
    });

    req.on("error", reject);
    req.end();
  });
}

function uploadFileToSharePoint(
  siteUrl,
  folderPath,
  fileName,
  filePath,
  digest,
  cookies,
) {
  return new Promise((resolve, reject) => {
    let parsedUrl;
    try {
      parsedUrl = new URL(siteUrl);
    } catch (e) {
      return reject(new Error(`URL de sitio inválida: ${siteUrl}`));
    }

    const fileContent = fs.readFileSync(filePath);
    const escapedFolderPath = folderPath.replace(/'/g, "''");
    const escapedFileName = fileName.replace(/'/g, "''");
    const apiPath = `${parsedUrl.pathname}/_api/web/GetFolderByServerRelativeUrl('${escapedFolderPath}')/Files/Add(url='${escapedFileName}',overwrite=true)`;
    const encodedPath = encodeURI(apiPath);

    const options = {
      hostname: parsedUrl.hostname,
      path: encodedPath,
      method: "POST",
      agent: sharepointAgent,
      headers: {
        Cookie: cookies,
        "X-RequestDigest": digest,
        Accept: "application/json;odata=verbose",
        "Content-Type": "application/octet-stream",
        "Content-Length": fileContent.length,
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Electron/LobbyControl",
      },
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        if (res.statusCode === 200 || res.statusCode === 201) {
          console.log(
            `✓ [SharePoint Upload] Archivo ${fileName} subido con éxito.`,
          );
          resolve();
        } else {
          reject(
            new Error(
              `Fallo de subida de ${fileName} (HTTP ${res.statusCode}): ${data}`,
            ),
          );
        }
      });
    });

    req.on("error", reject);
    req.write(fileContent);
    req.end();
  });
}

let dbDir;
let excelPath;

if (process.env.PRODUCTION_DB === "true") {
  const os = require("os");
  const baseDir =
    process.env.USER_DATA_DIR ||
    (process.env.APPDATA
      ? path.join(process.env.APPDATA, "LobbyControl")
      : (fs.existsSync(path.join(os.homedir(), "AppData", "Roaming", "LobbyControl"))
        ? path.join(os.homedir(), "AppData", "Roaming", "LobbyControl")
        : path.join(os.homedir(), "AppData", "Local", "LobbyControl")));
  dbDir = path.join(baseDir, "data");
  excelPath = path.join(dbDir, "lobby_data.xlsx");
} else {
  const envDbPath = process.env.DATABASE_PATH;
  if (envDbPath) {
    const fullEnvDbPath = path.isAbsolute(envDbPath) ? envDbPath : path.join(__dirname, "..", envDbPath);
    dbDir = path.dirname(fullEnvDbPath);
  } else {
    dbDir = path.join(__dirname, "..", "data");
  }
  excelPath = path.join(
    __dirname,
    "..",
    process.env.EXCEL_PATH || "data/lobby_data.xlsx",
  );
}

// Rutas canónicas
const dataDbPath = path.join(dbDir, "data.db");
const appDbPath = path.join(dbDir, "app.db");
const dbPath = dataDbPath;

// Asegurar que la carpeta de destino de la base de datos exista
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

console.log("Iniciando importación desde:", excelPath);

// Función para formatear fechas de Excel a ISO YYYY-MM-DD [HH:MM]
function parseExcelDate(serial) {
  if (serial === undefined || serial === null || serial === "") return "";
  if (typeof serial === "number") {
    const utcDays = serial - 25569;
    const date = new Date(Math.round(utcDays * 86400000));
    const yyyy = date.getUTCFullYear();
    const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(date.getUTCDate()).padStart(2, "0");
    const hh = String(date.getUTCHours()).padStart(2, "0");
    const min = String(date.getUTCMinutes()).padStart(2, "0");

    // Si tiene parte decimal (hora significativa), agregamos la hora
    if (serial % 1 !== 0) {
      return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
    }
    return `${yyyy}-${mm}-${dd}`;
  }

  const str = String(serial).trim();
  if (!str) return "";

  // 1. Formato ISO existente: YYYY-MM-DD o YYYY/MM/DD [HH:MM]
  const isoMatch = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:\s+(\d{1,2}):(\d{1,2}))?/);
  if (isoMatch) {
    const y = isoMatch[1];
    const m = String(isoMatch[2]).padStart(2, "0");
    const d = String(isoMatch[3]).padStart(2, "0");
    if (isoMatch[4] !== undefined) {
      const hh = String(isoMatch[4]).padStart(2, "0");
      const min = String(isoMatch[5] || "00").padStart(2, "0");
      return `${y}-${m}-${d} ${hh}:${min}`;
    }
    return `${y}-${m}-${d}`;
  }

  // 2. Formato Latino/Español: DD/MM/YYYY o DD-MM-YYYY [HH:MM]
  const latinMatch = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?:\s+(\d{1,2}):(\d{1,2}))?/);
  if (latinMatch) {
    const d = String(latinMatch[1]).padStart(2, "0");
    const m = String(latinMatch[2]).padStart(2, "0");
    const y = latinMatch[3];
    if (latinMatch[4] !== undefined) {
      const hh = String(latinMatch[4]).padStart(2, "0");
      const min = String(latinMatch[5] || "00").padStart(2, "0");
      return `${y}-${m}-${d} ${hh}:${min}`;
    }
    return `${y}-${m}-${d}`;
  }

  return str;
}

// =========================================================================
// MOTORES DE CÁLCULO ANALÍTICO (PORTADOS DE HELPERS.JS PARA INGESTA)
// =========================================================================

const dateUtils = require("../src/utils/date-utils");
const isChileanHoliday = dateUtils.isChileanHoliday;
const getDeadlineDate = dateUtils.getDeadlineDate;
const getBusinessDaysDiff = dateUtils.getBusinessDaysDiff;
const getLastBusinessDayOfMonth = dateUtils.getLastBusinessDayOfMonth;

function normalizeEstado(estadoString) {
  if (estadoString === undefined || estadoString === null) return "Pendiente";
  const clean = String(estadoString).trim().toLowerCase();
  if (clean === "") return "Pendiente";
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

function getCargoClean(cargoString) {
  if (cargoString === undefined || cargoString === null) return "No definido";
  const str = String(cargoString).trim();
  if (str === "") return "No definido";
  const parts = str.split(" - ");
  if (parts.length > 1) {
    return parts.slice(0, -1).join(" - ").trim();
  }
  return str;
}

function precalculateSolicitudFields(row) {
  const cargo = row["cargoSujetoPasivo"] || "";
  const cargo_limpio = getCargoClean(cargo);

  let codigo_licitacion = null;
  const licitacionMatch = cargo.match(/^\s*(2770-\d+-?\s*[A-Z0-9]+)/i);
  if (licitacionMatch) {
    codigo_licitacion = licitacionMatch[1].trim();
  }

  const fecha_ingreso = row["fechaIngreso"];
  const deadlineDate = getDeadlineDate(fecha_ingreso);
  let fecha_limite_sh = "";
  if (deadlineDate) {
    const d = String(deadlineDate.getUTCDate()).padStart(2, "0");
    const m = String(deadlineDate.getUTCMonth() + 1).padStart(2, "0");
    const y = deadlineDate.getUTCFullYear();
    fecha_limite_sh = `${y}-${m}-${d}`;
  }

  const fecha_respuesta = row["fechaRespuesta"];
  let dias_habiles_respuesta = null;
  const hasRespuesta =
    fecha_respuesta &&
    fecha_respuesta !== "-" &&
    fecha_respuesta !== "null" &&
    fecha_respuesta !== "---";
  if (fecha_ingreso && hasRespuesta && deadlineDate) {
    try {
      const respParts = fecha_respuesta.split(" ")[0].split("-");
      if (respParts.length === 3) {
        const respYear = parseInt(respParts[0], 10);
        const respMonth = parseInt(respParts[1], 10) - 1;
        const respDay = parseInt(respParts[2], 10);
        const responseUTC = new Date(Date.UTC(respYear, respMonth, respDay));
        const deadlineUTC = new Date(
          Date.UTC(
            deadlineDate.getUTCFullYear(),
            deadlineDate.getUTCMonth(),
            deadlineDate.getUTCDate(),
          ),
        );
        dias_habiles_respuesta = getBusinessDaysDiff(deadlineUTC, responseUTC);
      }
    } catch (e) {}
  }

  const estado = row["estado"] || "Pendiente";
  const estadoClean = normalizeEstado(estado);
  let estado_cumplimiento_sh = "PENDIENTE_EN_PLAZO";

  if (estadoClean !== "Ingresada") {
    if (hasRespuesta && deadlineDate && dias_habiles_respuesta !== null) {
      estado_cumplimiento_sh =
        dias_habiles_respuesta > 0 ? "FUERA_PLAZO" : "EN_PLAZO";
    } else {
      estado_cumplimiento_sh = "EN_PLAZO";
    }
  } else {
    if (deadlineDate) {
      const today = new Date();
      const todayUTC = new Date(
        Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()),
      );
      const deadlineUTC = new Date(
        Date.UTC(
          deadlineDate.getUTCFullYear(),
          deadlineDate.getUTCMonth(),
          deadlineDate.getUTCDate(),
        ),
      );
      const diffDays = getBusinessDaysDiff(todayUTC, deadlineUTC);
      estado_cumplimiento_sh =
        diffDays < 0 ? "PENDIENTE_VENCIDA" : "PENDIENTE_EN_PLAZO";
    }
  }

  const fecha_agendada = row["fechaAgenda"];
  let fecha_limite_publicacion = null;
  if (estadoClean === "Aceptada" && fecha_agendada) {
    try {
      const agendadaParts = fecha_agendada.split(" ")[0].split("-");
      if (agendadaParts.length === 3) {
        const year = parseInt(agendadaParts[0], 10);
        const month = parseInt(agendadaParts[1], 10) - 1;
        const deadlinePubDate = getLastBusinessDayOfMonth(year, month);
        const d = String(deadlinePubDate.getUTCDate()).padStart(2, "0");
        const m = String(deadlinePubDate.getUTCMonth() + 1).padStart(2, "0");
        const y = deadlinePubDate.getUTCFullYear();
        fecha_limite_publicacion = `${y}-${m}-${d}`;
      }
    } catch (e) {}
  }

  return {
    estado: estadoClean,
    cargo_limpio,
    codigo_licitacion,
    fecha_limite_sh,
    dias_habiles_respuesta,
    estado_cumplimiento_sh,
    fecha_limite_publicacion,
  };
}

function getPublishedDelay(fechaInicio, fechaPublicacion) {
  if (!fechaInicio || !fechaPublicacion) return 0;
  try {
    const inicioParts = fechaInicio.split(" ")[0].split("-");
    const pubParts = fechaPublicacion.split(" ")[0].split("-");
    if (inicioParts.length !== 3 || pubParts.length !== 3) return 0;

    const yearA = parseInt(inicioParts[0], 10);
    const monthA = parseInt(inicioParts[1], 10) - 1;

    const yearB = parseInt(pubParts[0], 10);
    const monthB = parseInt(pubParts[1], 10) - 1;

    const monthsDiff = yearB * 12 + monthB - (yearA * 12 + monthA);
    return monthsDiff > 0 ? monthsDiff * 30 : 0;
  } catch (e) {
    return 0;
  }
}

function ensureDecompressedDb(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return;
  try {
    const fd = fs.openSync(filePath, "r");
    const headerBuffer = Buffer.alloc(2);
    fs.readSync(fd, headerBuffer, 0, 2, 0);
    fs.closeSync(fd);
    if (headerBuffer[0] === 0x1f && headerBuffer[1] === 0x8b) {
      console.log(`[Auto-Repair] Detectada base de datos comprimida en ${filePath}. Descomprimiendo...`);
      const zlib = require("zlib");
      const compressedBuffer = fs.readFileSync(filePath);
      const decompressedBuffer = zlib.gunzipSync(compressedBuffer);
      fs.writeFileSync(filePath, decompressedBuffer);
      console.log(`✓ [Auto-Repair] Base de datos ${filePath} descomprimida correctamente.`);
    }
  } catch (e) {
    console.error(`[Auto-Repair Error] Error al verificar/descomprimir ${filePath}:`, e.message);
  }
}

ensureDecompressedDb(dbPath);

// Abrir base de datos
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("Error abriendo base de datos:", err.message);
    process.exit(1);
  }
  console.log("Conectado a la base de datos:", dbPath);
});

// Manejadores de señales de terminación para asegurar consistencia e impedir transacciones colgadas
const handleTermination = () => {
  console.log(
    "\nTerminación forzada detectada. Cerrando conexión de base de datos...",
  );
  db.run("ROLLBACK", (err) => {
    db.close(() => {
      process.exit(1);
    });
  });
};

process.on("SIGTERM", handleTermination);
process.on("SIGINT", handleTermination);

// Cargar el libro Excel
let workbook;
try {
  console.time("Tiempo: Lectura de Excel");
  workbook = XLSX.readFile(excelPath);
  console.timeEnd("Tiempo: Lectura de Excel");
  console.log("Libro Excel abierto correctamente. Hojas:", workbook.SheetNames);
} catch (e) {
  console.error(
    "Error al abrir el Excel. Asegúrate de que no esté abierto en otra aplicación:",
    e.message,
  );
  db.close();
  process.exit(1);
}

/**
 * Normaliza un valor de celda para el cálculo del hash
 * - null/undefined/"" -> ""
 * - String -> trim()
 */
function normalizeVal(val) {
  if (val === null || val === undefined) return "";
  return String(val).trim();
}

function normalizeDiffVal(val) {
  if (val === null || val === undefined) return "";
  return String(val).trim();
}

function diffSolicitudSH(oldRow, newRow) {
  const changes = {};
  const fields = [
    { label: "Estado", oldVal: oldRow.estado, newVal: newRow.estado },
    { label: "Fecha Agendada", oldVal: oldRow.fecha_agendada, newVal: newRow.fecha_agendada },
    { label: "Fecha Respuesta", oldVal: oldRow.fecha_respuesta, newVal: newRow.fecha_respuesta },
    { label: "Fecha Ingreso", oldVal: oldRow.fecha_ingreso, newVal: newRow.fecha_ingreso },
    { label: "Sujeto Pasivo", oldVal: oldRow.sujeto_pasivo, newVal: newRow.sujeto_pasivo },
    { label: "Cargo", oldVal: oldRow.cargo, newVal: newRow.cargo },
    { label: "Sujeto Activo", oldVal: oldRow.sujeto_activo, newVal: newRow.sujeto_activo },
    { label: "RUN Solicitante", oldVal: oldRow.rut, newVal: newRow.rut },
    { label: "Representado", oldVal: oldRow.representado, newVal: newRow.representado },
    { label: "Materia", oldVal: oldRow.materia, newVal: newRow.materia },
    { label: "Especificación Materia", oldVal: oldRow.especificacion_materia, newVal: newRow.especificacion_materia },
    { label: "Código Licitación", oldVal: oldRow.codigo_licitacion, newVal: newRow.codigo_licitacion },
  ];

  for (const f of fields) {
    const o = normalizeDiffVal(f.oldVal);
    const n = normalizeDiffVal(f.newVal);
    if (o !== n) {
      changes[f.label] = { old: o, new: n };
    }
  }
  return changes;
}

function diffPublicadaPH(oldRow, newRow) {
  const changes = {};
  const fields = [
    { label: "Estado", oldVal: oldRow.estado, newVal: newRow.estado },
    { label: "Fecha Inicio", oldVal: oldRow.fecha_inicio, newVal: newRow.fecha_inicio },
    { label: "Fecha Término", oldVal: oldRow.fecha_termino, newVal: newRow.fecha_termino },
    { label: "Fecha Publicación", oldVal: oldRow.fecha_publicacion, newVal: newRow.fecha_publicacion },
    { label: "Cumplimiento", oldVal: oldRow.cumplimiento, newVal: newRow.cumplimiento },
    { label: "Forma", oldVal: oldRow.forma, newVal: newRow.forma },
    { label: "Materia", oldVal: oldRow.materia, newVal: newRow.materia },
    { label: "Especificación Materia", oldVal: oldRow.especificacion_materia, newVal: newRow.especificacion_materia },
    { label: "Lugar", oldVal: oldRow.lugar, newVal: newRow.lugar },
    { label: "Comuna", oldVal: oldRow.comuna, newVal: newRow.comuna },
    { label: "Sujeto Pasivo", oldVal: oldRow.sujeto_pasivo, newVal: newRow.sujeto_pasivo },
    { label: "Cargo", oldVal: oldRow.cargo, newVal: newRow.cargo },
    { label: "Sujeto Activo", oldVal: oldRow.sujeto_activo, newVal: newRow.sujeto_activo },
    { label: "RUN Solicitante", oldVal: oldRow.rut, newVal: newRow.rut },
    { label: "Tipo Solicitante", oldVal: oldRow.tipo, newVal: newRow.tipo },
    { label: "Representado", oldVal: oldRow.representado, newVal: newRow.representado },
    { label: "Duración", oldVal: oldRow.duracion, newVal: newRow.duracion },
  ];

  for (const f of fields) {
    const o = normalizeDiffVal(f.oldVal);
    const n = normalizeDiffVal(f.newVal);
    if (o !== n) {
      changes[f.label] = { old: o, new: n };
    }
  }
  return changes;
}

function diffSujetoPasivoSPH(oldRow, newRow) {
  const changes = {};
  const fields = [
    { label: "Nombre", oldVal: oldRow.nombre, newVal: newRow.nombre },
    { label: "RUN", oldVal: oldRow.rut, newVal: newRow.rut },
    { label: "Cargo", oldVal: oldRow.cargo, newVal: newRow.cargo },
    { label: "Tipo", oldVal: oldRow.tipo, newVal: newRow.tipo },
    { label: "Zona", oldVal: oldRow.zona, newVal: newRow.zona },
    { label: "Fecha Incorporación", oldVal: oldRow.fecha_incorporacion, newVal: newRow.fecha_incorporacion },
    { label: "Fecha Término", oldVal: oldRow.fecha_termino, newVal: newRow.fecha_termino },
    { label: "Respaldo Jurídico", oldVal: oldRow.respaldo_juridico, newVal: newRow.respaldo_juridico },
    { label: "Asistente Técnico", oldVal: oldRow.asistente_tecnico, newVal: newRow.asistente_tecnico },
  ];

  for (const f of fields) {
    const o = normalizeDiffVal(f.oldVal);
    const n = normalizeDiffVal(f.newVal);
    if (o !== n) {
      changes[f.label] = { old: o, new: n };
    }
  }
  return changes;
}

/**
 * Calcula un hash MD5 de un array de valores normalizados
 */
function calculateHashFromValues(valuesArray) {
  const normalized = valuesArray.map((v) => normalizeVal(v));
  return crypto.createHash("md5").update(normalized.join("|")).digest("hex");
}

/**
 * Procesa un array en lotes concurrentes de tamaño `batchSize`
 */
function executeInBatches(array, batchSize, iteratorFn, callback) {
  let index = 0;
  function nextBatch() {
    if (index >= array.length) {
      return callback();
    }
    const batch = array.slice(index, index + batchSize);
    index += batchSize;

    let pending = batch.length;
    if (pending === 0) return callback();

    batch.forEach((item) => {
      iteratorFn(item, () => {
        pending--;
        if (pending === 0) {
          nextBatch();
        }
      });
    });
  }
  nextBatch();
}

/**
 * Sincronización incremental de solicitudes_sh
 */
function syncSolicitudes(rows, callback) {
  db.all(
    "SELECT id_lobby, row_hash FROM solicitudes_sh",
    [],
    (err, existingRows) => {
      if (err) return callback(err);

      const existingMap = {};
      existingRows.forEach((r) => {
        if (r.id_lobby !== null && r.id_lobby !== undefined) {
          existingMap[r.id_lobby] = r.row_hash || "";
        }
      });

      db.run("BEGIN TRANSACTION", (err) => {
        if (err) console.error("Error al iniciar transacción SH:", err.message);
      });

      const insertStmt = db.prepare(`
      INSERT INTO solicitudes_sh (
        id_lobby, folio_lobby, fecha_ingreso, fecha_respuesta, fecha_agendada,
        sujeto_pasivo, cargo, sujeto_pasivo_id, sujeto_activo, rut,
        genero, representado, materia, especificacion_materia, estado,
        cargo_limpio, codigo_licitacion, fecha_limite_sh,
        dias_habiles_respuesta, estado_cumplimiento_sh, fecha_limite_publicacion,
        row_hash
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

      const updateStmt = db.prepare(`
      UPDATE solicitudes_sh SET
        folio_lobby = ?, fecha_ingreso = ?, fecha_respuesta = ?, fecha_agendada = ?,
        sujeto_pasivo = ?, cargo = ?, sujeto_pasivo_id = ?, sujeto_activo = ?, rut = ?,
        genero = ?, representado = ?, materia = ?, especificacion_materia = ?, estado = ?,
        cargo_limpio = ?, codigo_licitacion = ?, fecha_limite_sh = ?,
        dias_habiles_respuesta = ?, estado_cumplimiento_sh = ?, fecha_limite_publicacion = ?,
        row_hash = ?
      WHERE id_lobby = ?
    `);

      const selectOldStmt = db.prepare(
        "SELECT * FROM solicitudes_sh WHERE id_lobby = ?",
      );

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
          selectOldStmt.finalize();

          const deleteIds = [];
          Object.keys(existingMap).forEach((id) => {
            const numericId = parseInt(id, 10);
            if (!seenIds.has(numericId)) {
              deleteIds.push(numericId);
            }
          });

          const performCommit = (deletesCount) => {
            db.run("COMMIT", (err) => {
              if (err) {
                console.error("Error al hacer COMMIT de SH:", err.message);
                callback(err);
              } else {
                console.log(
                  `✓ Sincronización SH: ${insertsCount} insertados, ${updatesCount} actualizados, ${skippedCount} omitidos, ${deletesCount} eliminados.`,
                );
                callback(null, {
                  insertsCount,
                  updatesCount,
                  skippedCount,
                  deletesCount,
                });
              }
            });
          };

          if (deleteIds.length > 0) {
            const placeholders = deleteIds.map(() => "?").join(",");
            db.all(
              `SELECT id_lobby, folio_lobby, sujeto_pasivo FROM solicitudes_sh WHERE id_lobby IN (${placeholders})`,
              deleteIds,
              (err, rowsToDelete) => {
                if (!err && rowsToDelete) {
                  rowsToDelete.forEach((r) => {
                    allStats.sh.details.push({
                      type: "delete",
                      id: r.id_lobby,
                      folio: r.folio_lobby || `ID: ${r.id_lobby}`,
                      pasivo: r.sujeto_pasivo || "",
                    });
                  });
                }
                db.run(
                  `DELETE FROM solicitudes_sh WHERE id_lobby IN (${placeholders})`,
                  deleteIds,
                  function (err) {
                    if (err)
                      console.error(
                        "Error al eliminar huérfanos de SH:",
                        err.message,
                      );
                    performCommit(this ? this.changes : 0);
                  },
                );
              },
            );
          } else {
            performCommit(0);
          }
        }
      }

      executeInBatches(
        rows,
        200,
        (row, done) => {
          const idLobby = row["id"] || null;
          if (idLobby === null) return done();
          seenIds.add(idLobby);

          const parsedFechaIngreso = parseExcelDate(row["fechaIngreso"]);
          const parsedFechaRespuesta = parseExcelDate(row["fechaRespuesta"]);
          let parsedFechaAgendada = parseExcelDate(row["fechaAgenda"]);
          if (parsedFechaAgendada && parsedFechaAgendada.length === 10) {
            parsedFechaAgendada += " 00:00";
          }

          const precalc = precalculateSolicitudFields({
            ...row,
            fechaIngreso: parsedFechaIngreso,
            fechaRespuesta: parsedFechaRespuesta,
            fechaAgenda: parsedFechaAgendada,
          });

          const valuesForHash = [
            idLobby,
            row["folio"] || "",
            parsedFechaIngreso,
            parsedFechaRespuesta,
            parsedFechaAgendada,
            row["sujetoPasivo"] || "",
            row["cargoSujetoPasivo"] || "",
            row["idSujetoPasivo"] || null,
            row["sujetoActivo"] || "",
            row["runSujetoActivo"] || "",
            row["generoSujetoActivo"] || "",
            row["representado"] || "",
            row["materia"] || "",
            row["especificacionMateria"] || "",
            precalc.estado,
            precalc.cargo_limpio,
            precalc.codigo_licitacion,
            precalc.fecha_limite_sh,
            precalc.dias_habiles_respuesta,
            precalc.estado_cumplimiento_sh,
            precalc.fecha_limite_publicacion,
          ];

          const currentHash = calculateHashFromValues(valuesForHash);

          if (!existingMap.hasOwnProperty(idLobby)) {
            pendingOps++;
            insertStmt.run([...valuesForHash, currentHash], (err) => {
              if (err) {
                console.error(
                  `Error al insertar SH ID ${idLobby}:`,
                  err.message,
                );
              } else {
                allStats.sh.details.push({
                  type: "insert",
                  id: idLobby,
                  folio: row["folio"] || `ID: ${idLobby}`,
                  pasivo: row["sujetoPasivo"] || "",
                  activo: row["sujetoActivo"] || "",
                });
              }
              pendingOps--;
              done();
            });
            insertsCount++;
          } else if (existingMap[idLobby] !== currentHash) {
            const updateValues = [
              row["folio"] || "",
              parsedFechaIngreso,
              parsedFechaRespuesta,
              parsedFechaAgendada,
              row["sujetoPasivo"] || "",
              row["cargoSujetoPasivo"] || "",
              row["idSujetoPasivo"] || null,
              row["sujetoActivo"] || "",
              row["runSujetoActivo"] || "",
              row["generoSujetoActivo"] || "",
              row["representado"] || "",
              row["materia"] || "",
              row["especificacionMateria"] || "",
              precalc.estado,
              precalc.cargo_limpio,
              precalc.codigo_licitacion,
              precalc.fecha_limite_sh,
              precalc.dias_habiles_respuesta,
              precalc.estado_cumplimiento_sh,
              precalc.fecha_limite_publicacion,
              currentHash,
              idLobby,
            ];
            pendingOps++;
            selectOldStmt.get([idLobby], (selectErr, oldRow) => {
              if (!selectErr && oldRow) {
                const changes = diffSolicitudSH(oldRow, {
                  estado: precalc.estado,
                  fecha_agendada: parsedFechaAgendada,
                  fecha_respuesta: parsedFechaRespuesta,
                  fecha_ingreso: parsedFechaIngreso,
                  sujeto_pasivo: row["sujetoPasivo"] || "",
                  cargo: row["cargoSujetoPasivo"] || "",
                  sujeto_activo: row["sujetoActivo"] || "",
                  rut: row["runSujetoActivo"] || "",
                  representado: row["representado"] || "",
                  materia: row["materia"] || "",
                  especificacion_materia: row["especificacionMateria"] || "",
                  codigo_licitacion: precalc.codigo_licitacion,
                });
                if (Object.keys(changes).length > 0) {
                  allStats.sh.details.push({
                    type: "update",
                    id: idLobby,
                    folio: row["folio"] || `ID: ${idLobby}`,
                    pasivo: row["sujetoPasivo"] || "",
                    changes: changes,
                  });
                }
              }
              updateStmt.run(updateValues, (err) => {
                if (err)
                  console.error(
                    `Error al actualizar SH ID ${idLobby}:`,
                    err.message,
                  );
                pendingOps--;
                done();
              });
            });
            updatesCount++;
          } else {
            skippedCount++;
            done();
          }
        },
        () => {
          loopFinished = true;
          checkFinished();
        },
      );
    },
  );
}

/**
 * Sincronización incremental de publicadas_ph
 */
function syncPublicadas(rows, solicitudAceptadaMap, callback) {
  db.all(
    "SELECT id_lobby, row_hash FROM publicadas_ph",
    [],
    (err, existingRows) => {
      if (err) return callback(err);

      const existingMap = {};
      existingRows.forEach((r) => {
        if (r.id_lobby !== null && r.id_lobby !== undefined) {
          existingMap[r.id_lobby] = r.row_hash || "";
        }
      });

      db.run("BEGIN TRANSACTION", (err) => {
        if (err) console.error("Error al iniciar transacción PH:", err.message);
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

      const selectOldStmt = db.prepare(
        "SELECT * FROM publicadas_ph WHERE id_lobby = ?",
      );

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
          selectOldStmt.finalize();

          const deleteIds = [];
          Object.keys(existingMap).forEach((id) => {
            const numericId = parseInt(id, 10);
            if (!seenIds.has(numericId)) {
              deleteIds.push(numericId);
            }
          });

          const performCommit = (deletesCount) => {
            db.run("COMMIT", (err) => {
              if (err) {
                console.error("Error al hacer COMMIT de PH:", err.message);
                callback(err);
              } else {
                console.log(
                  `✓ Sincronización PH: ${insertsCount} insertados, ${updatesCount} actualizados, ${skippedCount} omitidos, ${deletesCount} eliminados.`,
                );
                callback(null, {
                  insertsCount,
                  updatesCount,
                  skippedCount,
                  deletesCount,
                });
              }
            });
          };

          if (deleteIds.length > 0) {
            const placeholders = deleteIds.map(() => "?").join(",");
            db.all(
              `SELECT id_lobby, folio_lobby, sujeto_pasivo FROM publicadas_ph WHERE id_lobby IN (${placeholders})`,
              deleteIds,
              (err, rowsToDelete) => {
                if (!err && rowsToDelete) {
                  rowsToDelete.forEach((r) => {
                    allStats.ph.details.push({
                      type: "delete",
                      id: r.id_lobby,
                      folio: r.folio_lobby || `ID: ${r.id_lobby}`,
                      pasivo: r.sujeto_pasivo || "",
                    });
                  });
                }
                db.run(
                  `DELETE FROM publicadas_ph WHERE id_lobby IN (${placeholders})`,
                  deleteIds,
                  function (err) {
                    if (err)
                      console.error(
                        "Error al eliminar huérfanos de PH:",
                        err.message,
                      );
                    performCommit(this ? this.changes : 0);
                  },
                );
              },
            );
          } else {
            performCommit(0);
          }
        }
      }

      executeInBatches(
        rows,
        200,
        (row, done) => {
          const idLobby = row["id"] || null;
          if (idLobby === null) return done();
          seenIds.add(idLobby);

          const parsedFechaInicio = parseExcelDate(row["fechaInicio"]);
          const parsedFechaPublicacion = parseExcelDate(
            row["fechaPublicacion"],
          );

          let cumplimientoVal =
            row["cumplimiento"] !== undefined && row["cumplimiento"] !== null
              ? String(row["cumplimiento"])
              : "En plazo";
          if (parsedFechaInicio && parsedFechaPublicacion) {
            const delay = getPublishedDelay(
              parsedFechaInicio,
              parsedFechaPublicacion,
            );
            cumplimientoVal =
              delay > 0 ? `Fuera de plazo (-${delay}d)` : "En plazo";
          } else {
            if (cumplimientoVal.toLowerCase().includes("fuera")) {
              cumplimientoVal = "Fuera de plazo";
            } else {
              cumplimientoVal = "En plazo";
            }
          }

          const folio = row["folio"] || "";
          const idSolicitudLobby = solicitudAceptadaMap[folio] || null;

          const valuesForHash = [
            idLobby,
            folio,
            normalizeEstado(row["estado"] || "Publicada"),
            row["forma"] || "",
            row["materia"] || "",
            row["especificacionMateria"] || "",
            row["lugar"] || "",
            row["comuna"] || "",
            row["sujetoPasivo"] || "",
            row["cargoSujetoPasivo"] || "",
            row["sujetoActivo"] || "",
            row["runSujetoActivo"] || "",
            row["generoSujetoActivo"] || "",
            row["tipoSujetoActivo"] || "",
            row["representado"] || "",
            parsedFechaInicio,
            parseExcelDate(row["fechaTermino"]),
            row["duracion"] || "",
            parsedFechaPublicacion,
            cumplimientoVal,
            idSolicitudLobby,
          ];

          const currentHash = calculateHashFromValues(valuesForHash);

          if (!existingMap.hasOwnProperty(idLobby)) {
            pendingOps++;
            insertStmt.run([...valuesForHash, currentHash], (err) => {
              if (err) {
                console.error(
                  `Error al insertar PH ID ${idLobby}:`,
                  err.message,
                );
              } else {
                allStats.ph.details.push({
                  type: "insert",
                  id: idLobby,
                  folio: folio || `ID: ${idLobby}`,
                  pasivo: row["sujetoPasivo"] || "",
                  activo: row["sujetoActivo"] || "",
                });
              }
              pendingOps--;
              done();
            });
            insertsCount++;
          } else if (existingMap[idLobby] !== currentHash) {
            const updateValues = [
              folio,
              normalizeEstado(row["estado"] || "Publicada"),
              row["forma"] || "",
              row["materia"] || "",
              row["especificacionMateria"] || "",
              row["lugar"] || "",
              row["comuna"] || "",
              row["sujetoPasivo"] || "",
              row["cargoSujetoPasivo"] || "",
              row["sujetoActivo"] || "",
              row["runSujetoActivo"] || "",
              row["generoSujetoActivo"] || "",
              row["tipoSujetoActivo"] || "",
              row["representado"] || "",
              parsedFechaInicio,
              parseExcelDate(row["fechaTermino"]),
              row["duracion"] || "",
              parsedFechaPublicacion,
              cumplimientoVal,
              idSolicitudLobby,
              currentHash,
              idLobby,
            ];
            pendingOps++;
            selectOldStmt.get([idLobby], (selectErr, oldRow) => {
              if (!selectErr && oldRow) {
                const changes = diffPublicadaPH(oldRow, {
                  estado: normalizeEstado(row["estado"] || "Publicada"),
                  fecha_inicio: parsedFechaInicio,
                  fecha_termino: parseExcelDate(row["fechaTermino"]),
                  fecha_publicacion: parsedFechaPublicacion,
                  cumplimiento: cumplimientoVal,
                  forma: row["forma"] || "",
                  materia: row["materia"] || "",
                  especificacion_materia: row["especificacionMateria"] || "",
                  lugar: row["lugar"] || "",
                  comuna: row["comuna"] || "",
                  sujeto_pasivo: row["sujetoPasivo"] || "",
                  cargo: row["cargoSujetoPasivo"] || "",
                  sujeto_activo: row["sujetoActivo"] || "",
                  rut: row["runSujetoActivo"] || "",
                  tipo: row["tipoSujetoActivo"] || "",
                  representado: row["representado"] || "",
                  duracion: row["duracion"] || "",
                });
                if (Object.keys(changes).length > 0) {
                  allStats.ph.details.push({
                    type: "update",
                    id: idLobby,
                    folio: folio || `ID: ${idLobby}`,
                    pasivo: row["sujetoPasivo"] || "",
                    changes: changes,
                  });
                }
              }
              updateStmt.run(updateValues, (err) => {
                if (err)
                  console.error(
                    `Error al actualizar PH ID ${idLobby}:`,
                    err.message,
                  );
                pendingOps--;
                done();
              });
            });
            updatesCount++;
          } else {
            skippedCount++;
            done();
          }
        },
        () => {
          loopFinished = true;
          checkFinished();
        },
      );
    },
  );
}

/**
 * Sincronización incremental de sujetos_pasivos_sph
 */
function syncSujetosPasivos(rows, callback) {
  db.all(
    "SELECT id_sujeto_lobby, row_hash FROM sujetos_pasivos_sph",
    [],
    (err, existingRows) => {
      if (err) return callback(err);

      const existingMap = {};
      existingRows.forEach((r) => {
        if (r.id_sujeto_lobby !== null && r.id_sujeto_lobby !== undefined) {
          existingMap[r.id_sujeto_lobby] = r.row_hash || "";
        }
      });

      db.run("BEGIN TRANSACTION", (err) => {
        if (err)
          console.error("Error al iniciar transacción SPH:", err.message);
      });

      const insertStmt = db.prepare(`
      INSERT INTO sujetos_pasivos_sph (
        id_sujeto_lobby, nombre, rut, cargo, tipo, zona,
        fecha_incorporacion, fecha_termino, respaldo_juridico, asistente_tecnico, row_hash
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

      const updateStmt = db.prepare(`
      UPDATE sujetos_pasivos_sph SET
        nombre = ?, rut = ?, cargo = ?, tipo = ?, zona = ?,
        fecha_incorporacion = ?, fecha_termino = ?, respaldo_juridico = ?, asistente_tecnico = ?, row_hash = ?
      WHERE id_sujeto_lobby = ?
    `);

      const selectOldStmt = db.prepare(
        "SELECT * FROM sujetos_pasivos_sph WHERE id_sujeto_lobby = ?",
      );

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
          selectOldStmt.finalize();

          const deleteIds = [];
          Object.keys(existingMap).forEach((id) => {
            const numericId = parseInt(id, 10);
            if (!seenIds.has(numericId)) {
              deleteIds.push(numericId);
            }
          });

          const performCommit = (deletesCount) => {
            db.run("COMMIT", (err) => {
              if (err) {
                console.error("Error al hacer COMMIT de SPH:", err.message);
                callback(err);
              } else {
                console.log(
                  `✓ Sincronización SPH: ${insertsCount} insertados, ${updatesCount} actualizados, ${skippedCount} omitidos, ${deletesCount} eliminados.`,
                );
                rebuildActiveSujetoIdsTable(() => {
                  callback(null, {
                    insertsCount,
                    updatesCount,
                    skippedCount,
                    deletesCount,
                  });
                });
              }
            });
          };

          if (deleteIds.length > 0) {
            const placeholders = deleteIds.map(() => "?").join(",");
            db.all(
              `SELECT id_sujeto_lobby, nombre, cargo FROM sujetos_pasivos_sph WHERE id_sujeto_lobby IN (${placeholders})`,
              deleteIds,
              (err, rowsToDelete) => {
                if (!err && rowsToDelete) {
                  rowsToDelete.forEach((r) => {
                    allStats.sph.details.push({
                      type: "delete",
                      id: r.id_sujeto_lobby,
                      nombre: r.nombre || `ID: ${r.id_sujeto_lobby}`,
                      cargo: r.cargo || "",
                    });
                  });
                }
                db.run(
                  `DELETE FROM sujetos_pasivos_sph WHERE id_sujeto_lobby IN (${placeholders})`,
                  deleteIds,
                  function (err) {
                    if (err)
                      console.error(
                        "Error al eliminar huérfanos de SPH:",
                        err.message,
                      );
                    performCommit(this ? this.changes : 0);
                  },
                );
              },
            );
          } else {
            performCommit(0);
          }
        }
      }

      executeInBatches(
        rows,
        200,
        (row, done) => {
          const idSujeto = row["id"] || null;
          if (idSujeto === null) return done();
          seenIds.add(idSujeto);

          const valuesForHash = [
            idSujeto,
            row["nombre"] || "",
            row["run"] || "",
            row["cargo"] || "",
            row["tipo"] || "",
            row["zona"] || "",
            parseExcelDate(row["fechaInicio"]),
            parseExcelDate(row["fechaTermino"]),
            row["respaldoJuridico"] || "",
            row["asistenteTecnico"] || "",
          ];

          const currentHash = calculateHashFromValues(valuesForHash);

          if (!existingMap.hasOwnProperty(idSujeto)) {
            pendingOps++;
            insertStmt.run([...valuesForHash, currentHash], (err) => {
              if (err) {
                console.error(
                  `Error al insertar SPH ID ${idSujeto}:`,
                  err.message,
                );
              } else {
                allStats.sph.details.push({
                  type: "insert",
                  id: idSujeto,
                  nombre: row["nombre"] || `ID: ${idSujeto}`,
                  cargo: row["cargo"] || "",
                });
              }
              pendingOps--;
              done();
            });
            insertsCount++;
          } else if (existingMap[idSujeto] !== currentHash) {
            const updateValues = [
              row["nombre"] || "",
              row["run"] || "",
              row["cargo"] || "",
              row["tipo"] || "",
              row["zona"] || "",
              parseExcelDate(row["fechaInicio"]),
              parseExcelDate(row["fechaTermino"]),
              row["respaldoJuridico"] || "",
              row["asistenteTecnico"] || "",
              currentHash,
              idSujeto,
            ];
            pendingOps++;
            selectOldStmt.get([idSujeto], (selectErr, oldRow) => {
              if (!selectErr && oldRow) {
                const changes = diffSujetoPasivoSPH(oldRow, {
                  nombre: row["nombre"] || "",
                  rut: row["run"] || "",
                  cargo: row["cargo"] || "",
                  tipo: row["tipo"] || "",
                  zona: row["zona"] || "",
                  fecha_incorporacion: parseExcelDate(row["fechaInicio"]),
                  fecha_termino: parseExcelDate(row["fechaTermino"]),
                  respaldo_juridico: row["respaldoJuridico"] || "",
                  asistente_tecnico: row["asistenteTecnico"] || "",
                });
                if (Object.keys(changes).length > 0) {
                  allStats.sph.details.push({
                    type: "update",
                    id: idSujeto,
                    nombre: row["nombre"] || `ID: ${idSujeto}`,
                    cargo: row["cargo"] || "",
                    changes: changes,
                  });
                }
              }
              updateStmt.run(updateValues, (err) => {
                if (err)
                  console.error(
                    `Error al actualizar SPH ID ${idSujeto}:`,
                    err.message,
                  );
                pendingOps--;
                done();
              });
            });
            updatesCount++;
          } else {
            skippedCount++;
            done();
          }
        },
        () => {
          loopFinished = true;
          checkFinished();
        },
      );
    },
  );
}

/**
 * Guarda la fecha de última actualización en la tabla configuracion
 */
function saveLastImportTimestamp(callback) {
  const mtime = new Date();
  const yyyy = mtime.getFullYear();
  const mm = String(mtime.getMonth() + 1).padStart(2, "0");
  const dd = String(mtime.getDate()).padStart(2, "0");
  const hh = String(mtime.getHours()).padStart(2, "0");
  const min = String(mtime.getMinutes()).padStart(2, "0");
  const timestampStr = `${dd}-${mm}-${yyyy} ${hh}:${min}`;

  if (!fs.existsSync(appDbPath)) {
    if (typeof callback === "function") callback(null);
    return;
  }

  const appDbConn = new sqlite3.Database(appDbPath, (openErr) => {
    if (openErr) {
      console.error("Error al abrir app.db para timestamp:", openErr.message);
      if (typeof callback === "function") callback(openErr);
      return;
    }
    appDbConn.run(
      "INSERT OR REPLACE INTO configuracion (clave, valor) VALUES ('last_import_timestamp', ?)",
      [timestampStr],
      (err) => {
        if (err) {
          console.error("Error al registrar fecha de importación:", err.message);
        } else {
          console.log(
            `✓ Fecha de última actualización registrada en la base de datos: ${timestampStr}`,
          );
        }
        appDbConn.close(() => {
          if (typeof callback === "function") callback(err);
        });
      },
    );
  });
}

// Objeto acumulador de estadísticas de importación
const allStats = {
  sh: { inserts: 0, updates: 0, skipped: 0, deletes: 0, details: [] },
  ph: { inserts: 0, updates: 0, skipped: 0, deletes: 0, details: [] },
  sph: { inserts: 0, updates: 0, skipped: 0, deletes: 0, details: [] },
  sharepoint: { uploaded: false, error: null },
};

// Ejecutar la importación de forma transaccional y secuencial
db.serialize(() => {
  console.time("Tiempo: Ejecución total de importación");
  db.run("PRAGMA busy_timeout = 30000");
  db.run("PRAGMA synchronous = OFF");

  // Validar y migrar esquema de la base de datos si es necesario (ej: si fue sobrescrita por sincronización desde SharePoint)
  db.all("PRAGMA table_info(sujetos_pasivos_sph)", [], (err, rows) => {
    if (!err && rows && rows.length > 0) {
      const hasAsistente = rows.some(r => r.name === 'asistente_tecnico');
      if (!hasAsistente) {
        db.run("ALTER TABLE sujetos_pasivos_sph ADD COLUMN asistente_tecnico TEXT", (alterErr) => {
          if (alterErr) {
            console.error("Error al añadir columna asistente_tecnico a sujetos_pasivos_sph:", alterErr.message);
          } else {
            console.log("✓ Columna asistente_tecnico añadida dinámicamente a sujetos_pasivos_sph.");
          }
        });
      }
    }
  });

  const solicitudAceptadaMap = {};

  if (workbook.SheetNames.includes("SH")) {
    const sheet = workbook.Sheets["SH"];
    const rows = XLSX.utils.sheet_to_json(sheet);

    if (!Array.isArray(rows) || rows.length === 0) {
      console.warn(
        '⚠ Advertencia: La hoja "SH" no contiene registros válidos.',
      );
      processPH();
    } else {
      const headers = XLSX.utils.sheet_to_json(sheet, { header: 1 })[0] || [];
      const required = ["id", "folio", "estado"];
      const missing = required.filter((col) => !headers.includes(col));

      if (missing.length > 0) {
        console.warn(
          `⚠️ Omitiendo sincronización SH: La hoja no contiene la estructura esperada. Faltan columnas: ${missing.join(", ")}.`,
        );
        processPH();
      } else {
        console.log(
          `\nProcesando ${rows.length} registros para la tabla "solicitudes_sh"...`,
        );

        rows.forEach((row) => {
          if (normalizeEstado(row["estado"]) === "Aceptada") {
            const folio = row["folio"] || "";
            const id = row["id"] || null;
            if (folio && id) {
              if (
                !solicitudAceptadaMap[folio] ||
                id > solicitudAceptadaMap[folio]
              ) {
                solicitudAceptadaMap[folio] = id;
              }
            }
          }
        });
        console.log(
          `  → Mapa de solicitudes Aceptadas construido: ${Object.keys(solicitudAceptadaMap).length} folios únicos.`,
        );

        console.time("Tiempo: Sincronización SH");
        syncSolicitudes(rows, (err, stats) => {
          console.timeEnd("Tiempo: Sincronización SH");
          if (err) {
            console.error("Error al sincronizar solicitudes_sh:", err.message);
            db.close();
            process.exit(1);
          }
          if (stats) {
            allStats.sh = {
              ...allStats.sh,
              inserts: stats.insertsCount,
              updates: stats.updatesCount,
              skipped: stats.skippedCount,
              deletes: stats.deletesCount,
            };
          }
          processPH();
        });
      }
    }
  } else {
    console.log('⚠ No se encontró la hoja "SH" en el Excel.');
    processPH();
  }

  function processPH() {
    if (workbook.SheetNames.includes("PH")) {
      const sheet = workbook.Sheets["PH"];
      const rows = XLSX.utils.sheet_to_json(sheet);

      if (!Array.isArray(rows) || rows.length === 0) {
        console.warn(
          '⚠ Advertencia: La hoja "PH" no contiene registros válidos.',
        );
        processSPH();
      } else {
        const headers = XLSX.utils.sheet_to_json(sheet, { header: 1 })[0] || [];
        const required = ["id", "folio", "estado"];
        const missing = required.filter((col) => !headers.includes(col));

        if (missing.length > 0) {
          console.warn(
            `⚠️ Omitiendo sincronización PH: La hoja no contiene la estructura esperada. Faltan columnas: ${missing.join(", ")}.`,
          );
          processSPH();
        } else {
          console.log(
            `\nProcesando ${rows.length} registros para la tabla "publicadas_ph"...`,
          );

          console.time("Tiempo: Sincronización PH");
          syncPublicadas(rows, solicitudAceptadaMap, (err, stats) => {
            console.timeEnd("Tiempo: Sincronización PH");
            if (err) {
              console.error("Error al sincronizar publicadas_ph:", err.message);
              db.close();
              process.exit(1);
            }
            if (stats) {
              allStats.ph = {
                ...allStats.ph,
                inserts: stats.insertsCount,
                updates: stats.updatesCount,
                skipped: stats.skippedCount,
                deletes: stats.deletesCount,
              };
            }
            processSPH();
          });
        }
      }
    } else {
      console.log('⚠ No se encontró la hoja "PH" en el Excel.');
      processSPH();
    }
  }

  function processSPH() {
    if (workbook.SheetNames.includes("SPH")) {
      const sheet = workbook.Sheets["SPH"];
      const rows = XLSX.utils.sheet_to_json(sheet);

      if (!Array.isArray(rows) || rows.length === 0) {
        console.warn(
          '⚠ Advertencia: La hoja "SPH" no contiene registros válidos.',
        );
        finalizeImport();
      } else {
        const headers = XLSX.utils.sheet_to_json(sheet, { header: 1 })[0] || [];
        const required = ["id", "nombre", "run"];
        const missing = required.filter((col) => !headers.includes(col));

        if (missing.length > 0) {
          console.warn(
            `⚠️ Omitiendo sincronización SPH: La hoja no contiene la estructura esperada. Faltan columnas: ${missing.join(", ")}.`,
          );
          finalizeImport();
        } else {
          console.log(
            `\nProcesando ${rows.length} registros para la tabla "sujetos_pasivos_sph"...`,
          );

          console.time("Tiempo: Sincronización SPH");
          syncSujetosPasivos(rows, (err, stats) => {
            console.timeEnd("Tiempo: Sincronización SPH");
            if (err) {
              console.error(
                "Error al sincronizar sujetos_pasivos_sph:",
                err.message,
              );
              db.close();
              process.exit(1);
            }
            if (stats) {
              allStats.sph = {
                ...allStats.sph,
                inserts: stats.insertsCount,
                updates: stats.updatesCount,
                skipped: stats.skippedCount,
                deletes: stats.deletesCount,
              };
            }
            finalizeImport();
          });
        }
      }
    } else {
      console.log('⚠ No se encontró la hoja "SPH" en el Excel.');
      finalizeImport();
    }
  }

  function finalizeImport() {
    const totalChanges =
      (allStats.sh.inserts || 0) +
      (allStats.sh.updates || 0) +
      (allStats.sh.deletes || 0) +
      (allStats.ph.inserts || 0) +
      (allStats.ph.updates || 0) +
      (allStats.ph.deletes || 0) +
      (allStats.sph.inserts || 0) +
      (allStats.sph.updates || 0) +
      (allStats.sph.deletes || 0);

    const userName = process.env.IMPORT_USER_NAME || "Sistema";
    const userEmail = process.env.IMPORT_USER_EMAIL || "";
    const userStr = userEmail ? `${userName} (${userEmail})` : userName;

    const nextStep = () => {
      const mtime = new Date();
      const yyyy = mtime.getFullYear();
      const mm = String(mtime.getMonth() + 1).padStart(2, "0");
      const dd = String(mtime.getDate()).padStart(2, "0");
      const hh = String(mtime.getHours()).padStart(2, "0");
      const min = String(mtime.getMinutes()).padStart(2, "0");
      const timestampStr = `${dd}-${mm}-${yyyy} ${hh}:${min}`;

      // 1. Registrar bitácora y timestamp de importación en app.db
      if (fs.existsSync(appDbPath)) {
        console.log("Registrando bitácora y timestamp de importación en app.db...");
        const appDb = new sqlite3.Database(appDbPath);
        appDb.serialize(() => {
          appDb.run("PRAGMA busy_timeout = 30000");
          appDb.run(
            "INSERT INTO historial_sincronizaciones (usuario, estado, detalles) VALUES (?, ?, ?)",
            [userStr, "Exitoso", JSON.stringify(allStats)],
            (bitErr) => {
              if (bitErr) console.error("Error al registrar bitácora en app.db:", bitErr.message);
            }
          );
          appDb.run(
            "INSERT OR REPLACE INTO configuracion (clave, valor) VALUES ('last_import_timestamp', ?)",
            [timestampStr],
            (cfgErr) => {
              if (cfgErr) console.error("Error al registrar last_import_timestamp en app.db:", cfgErr.message);
            }
          );
          appDb.run("PRAGMA wal_checkpoint(TRUNCATE)", () => {
            appDb.close();
          });
        });
      }

      console.log(
        "Ejecutando limpieza y optimización de base de datos (VACUUM)...",
      );
      console.time("Tiempo: VACUUM");
      db.run("VACUUM", (vErr) => {
        console.timeEnd("Tiempo: VACUUM");
        if (vErr) {
          console.error("Error al ejecutar VACUUM:", vErr.message);
        } else {
          console.log(
            "✓ Base de datos optimizada y compactada con éxito (VACUUM).",
          );
        }

        console.log("Ejecutando checkpoint de WAL en data.db...");
        db.run("PRAGMA wal_checkpoint(TRUNCATE)", (cpErr) => {
          if (cpErr)
            console.error(
              "Error al ejecutar checkpoint de WAL:",
              cpErr.message,
            );

          console.timeEnd("Tiempo: Ejecución total de importación");
          console.log("\nImportación masiva completada con éxito.");

          // Secuencia estricta Windows: cerrar la conexión db antes de leer el binario para Gzip
          db.close(async (closeErr) => {
            if (closeErr) console.error("Error al cerrar data.db:", closeErr.message);
            try {
              // Calcular firma digital HMAC de data.db para prevenir alteraciones
              const dbBuffer = fs.readFileSync(dbPath);
              const dbSignature = crypto
                .createHmac("sha256", "LobbyControl_Secure_Key_2026_Maipu")
                .update(dbBuffer)
                .digest("hex");

              const versionData = {
                last_import_timestamp: timestampStr,
                db_size: dbBuffer.length,
                db_signature: dbSignature,
                db_compression: "gzip",
              };

              const localJsonPath = path.join(dbDir, "version_data.json");
              const legacyJsonPath = path.join(dbDir, "version_lobby.json");
              fs.writeFileSync(
                localJsonPath,
                JSON.stringify(versionData, null, 2),
              );
              try {
                fs.writeFileSync(legacyJsonPath, JSON.stringify(versionData, null, 2));
              } catch (e) {}
              console.log(
                `✓ [Local Version] Generado archivo de versión local (Firmado) en: ${localJsonPath}`,
              );

              // Subir a SharePoint vía REST API si hay cookies
              if (process.env.SHAREPOINT_COOKIES) {
                console.log(
                  "[SharePoint Upload] Cookies de sesión encontradas. Iniciando subida directa a la nube...",
                );
                const siteUrl =
                  process.env.SHAREPOINT_SITE_URL ||
                  "https://immaipu.sharepoint.com/sites/SECMU";
                const folderPath =
                  process.env.SHAREPOINT_FOLDER_PATH ||
                  "/sites/SECMU/Lobby/LobbyControl";
                const cookies = process.env.SHAREPOINT_COOKIES;

                if (!folderPath) {
                  console.error(
                    "❌ [SharePoint Upload] Falta la variable SHAREPOINT_FOLDER_PATH en .env.",
                  );
                  allStats.sharepoint = {
                    uploaded: false,
                    error:
                      "Falta la variable SHAREPOINT_FOLDER_PATH en .env.",
                  };
                } else {
                  console.log(`[SharePoint Upload] Sitio: ${siteUrl}`);
                  console.log(
                    `[SharePoint Upload] Carpeta destino: ${folderPath}`,
                  );

                  const tempGzPath = dbPath + ".gz.tmp";
                  try {
                    console.log(
                      "[SharePoint Upload] Comprimiendo base de datos de forma asíncrona...",
                    );
                    await compressFileAsync(dbPath, tempGzPath);
                    console.log(
                      "[SharePoint Upload] Compresión finalizada.",
                    );

                    const digest = await getRequestDigest(siteUrl, cookies);
                    console.log(
                      "[SharePoint Upload] Request Digest obtenido.",
                    );

                    console.log(
                      "[SharePoint Upload] Subiendo version_data.json...",
                    );
                    await uploadFileToSharePoint(
                      siteUrl,
                      folderPath,
                      "version_data.json",
                      localJsonPath,
                      digest,
                      cookies,
                    );

                    console.log(
                      "[SharePoint Upload] Subiendo data.db (comprimido)...",
                    );
                    await uploadFileToSharePoint(
                      siteUrl,
                      folderPath,
                      "data.db",
                      tempGzPath,
                      digest,
                      cookies,
                    );

                    console.log(
                      "✓ [SharePoint Upload] Sincronización directa en la nube completada con éxito.",
                    );
                    allStats.sharepoint = { uploaded: true, error: null };
                  } catch (spErr) {
                    console.error(
                      "❌ [SharePoint Upload] Error al subir directamente a SharePoint:",
                      spErr.message,
                    );
                    allStats.sharepoint = {
                      uploaded: false,
                      error: spErr.message,
                    };
                  } finally {
                    if (fs.existsSync(tempGzPath)) {
                      try {
                        fs.unlinkSync(tempGzPath);
                        console.log(
                          "[SharePoint Upload] Archivo temporal comprimido eliminado.",
                        );
                      } catch (e) {
                        console.error(
                          "[SharePoint Upload] No se pudo eliminar el archivo temporal comprimido:",
                          e.message,
                        );
                      }
                    }
                  }
                }
              } else {
                console.log(
                  "[SharePoint Upload] No se encontraron cookies de sesión (SHAREPOINT_COOKIES). Se omite la subida directa.",
                );
                allStats.sharepoint = {
                  uploaded: false,
                  error:
                    "Omitido: Se requiere inicio de sesión institucional (SSO) para subir a SharePoint.",
                };
              }

              // Copiar a la carpeta compartida de OneDrive si está configurada
              if (process.env.ONEDRIVE_SYNC_PATH) {
                const odPath = process.env.ONEDRIVE_SYNC_PATH;
                if (fs.existsSync(odPath)) {
                  const destJsonPath = path.join(
                    odPath,
                    "version_data.json",
                  );
                  const destDbPath = path.join(odPath, "data.db");

                  fs.writeFileSync(
                    destJsonPath,
                    JSON.stringify(versionData, null, 2),
                  );
                  fs.copyFileSync(dbPath, destDbPath);

                  console.log(
                    `✓ [OneDrive Sync] Publicación de versión completada con éxito en: ${odPath}`,
                  );
                } else {
                  console.warn(
                    `⚠️ [OneDrive Sync] La ruta especificada en ONEDRIVE_SYNC_PATH no existe: ${odPath}`,
                  );
                }
              }
            } catch (err) {
              console.error(
                "❌ Error crítico al finalizar importación:",
                err.message,
              );
            }
          });
        });
      });
    };
                        `⚠️ [OneDrive Sync] La ruta especificada en ONEDRIVE_SYNC_PATH no existe: ${odPath}`,
                      );
                    }
                  }
                } catch (err) {
                  console.error(
                    "❌ Error al generar versión o copiar archivos:",
                    err.message,
                  );
                }

                if (process.send) {
                  process.send({
                    type: "import_stats",
                    stats: allStats,
                  });
                }
              });
            });
          });
        },
      );
    };

    if (totalChanges > 0) {
      saveLastImportTimestamp((err) => {
        nextStep();
      });
    } else {
      console.log(
        "No se detectaron cambios reales en los datos importados. Se omite la actualización de la marca de tiempo de última modificación, VACUUM y subida a SharePoint.",
      );
      // Cerrar la base de datos de forma limpia y notificar éxito al servidor
      db.close(() => {
        if (process.send) {
          process.send({
            type: "import_stats",
            stats: allStats,
          });
        }
      });
    }
  }
});

function rebuildActiveSujetoIdsTable(done) {
  const todayStr = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  db.serialize(() => {
    db.run("BEGIN IMMEDIATE TRANSACTION", (txErr) => {
      if (txErr) {
        console.error(
          "Error al iniciar transacción para vigentes:",
          txErr.message,
        );
        if (typeof done === "function") done();
        return;
      }
    });

    db.run("DELETE FROM sujetos_pasivos_vigentes", (err) => {
      if (err) {
        console.error(
          "Error al limpiar sujetos_pasivos_vigentes:",
          err.message,
        );
        db.run("ROLLBACK");
        if (typeof done === "function") done();
        return;
      }
    });

    db.run(
      `
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
    `,
      [todayStr],
      function (insertErr) {
        if (insertErr) {
          console.error(
            "Error al poblar sujetos_pasivos_vigentes:",
            insertErr.message,
          );
          db.run("ROLLBACK");
          if (typeof done === "function") done();
        } else {
          const changes = this ? this.changes : 0;
          db.run("COMMIT", (commitErr) => {
            if (commitErr) {
              console.error(
                "Error al hacer COMMIT de vigentes:",
                commitErr.message,
              );
              db.run("ROLLBACK");
            } else {
              console.log(
                `✓ Sincronización vigentes: ${changes} registros vigentes creados en sujetos_pasivos_vigentes.`,
              );
            }
            if (typeof done === "function") done();
          });
        }
      },
    );
  });
}
