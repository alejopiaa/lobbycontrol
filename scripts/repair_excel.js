const XLSX = require("xlsx");
const fs = require("fs");
const path = require("path");

// Definir rutas de archivos
const dataDir = path.join(__dirname, "../data");
const possibleFileNames = ["respaldoa.xlsx", "respaldo.xlsx"];
let inputFilePath = "";

// Buscar el archivo de entrada
for (const fileName of possibleFileNames) {
  const filePath = path.join(dataDir, fileName);
  if (fs.existsSync(filePath)) {
    inputFilePath = filePath;
    break;
  }
}

if (!inputFilePath) {
  console.error(`ERROR: No se encontró ningún archivo de respaldo en la carpeta data/.`);
  console.error(`Buscamos: ${possibleFileNames.join(", ")}`);
  process.exit(1);
}

const outputFilePath = path.join(dataDir, "respaldo_corregido.xlsx");

console.log(`Leyendo archivo de respaldo: ${inputFilePath}`);

// Leer el libro de trabajo original (preservando todos los estilos y celdas)
const workbook = XLSX.readFile(inputFilePath);
const sheetName = "SH";

if (!workbook.SheetNames.includes(sheetName)) {
  console.error(`ERROR: La pestaña "${sheetName}" no existe en el archivo.`);
  console.error(`Pestañas disponibles: ${workbook.SheetNames.join(", ")}`);
  process.exit(1);
}

const sheet = workbook.Sheets[sheetName];

// Obtener las filas como matriz 2D para mapear índices de filas reales de Excel
const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
console.log(`Se cargaron ${rows.length} filas (incluyendo cabecera) desde la pestaña "${sheetName}".`);

if (rows.length < 2) {
  console.error("ERROR: El archivo no contiene suficientes filas de datos.");
  process.exit(1);
}

const headers = rows[0];
const idColIdx = headers.indexOf("Id");
const folioColIdx = headers.indexOf("Folio");
const ingresoColIdx = headers.indexOf("Fecha ingreso");
const respuestaColIdx = headers.indexOf("Fecha respuesta");
const estadoColIdx = headers.indexOf("Estado");

if (idColIdx === -1 || folioColIdx === -1 || ingresoColIdx === -1 || respuestaColIdx === -1 || estadoColIdx === -1) {
  console.error("ERROR: Faltan columnas requeridas en la fila de cabeceras.");
  console.error("Cabeceras encontradas:", headers);
  process.exit(1);
}

// Construir lista estructurada de filas de datos
const dataRows = [];
for (let r = 1; r < rows.length; r++) {
  const rowData = rows[r];
  dataRows.push({
    excelRowNum: r + 1, // Fila real en Excel (1-indexed: la cabecera es fila 1, fila 1 de datos es fila 2)
    id: Number(rowData[idColIdx]) || 0,
    folio: String(rowData[folioColIdx] || "").trim(),
    fechaIngreso: rowData[ingresoColIdx],
    fechaRespuesta: rowData[respuestaColIdx],
    estado: String(rowData[estadoColIdx] || "").trim(),
    originalRow: rowData
  });
}

// Ordenar por ID numérico ascendente (cronológico)
console.log("Ordenando registros internamente por Id para el análisis...");
dataRows.sort((a, b) => a.id - b.id);

let updateCount = 0;
let notFoundNextCount = 0;
let missingIngresoCount = 0;

console.log("\nProcesando y corrigiendo registros directamente en la hoja original...");

for (let i = 0; i < dataRows.length; i++) {
  const r1 = dataRows[i];
  const estadoClean = r1.estado.toLowerCase();
  const fechaRespVal = r1.fechaRespuesta;
  
  // Identificar si no tiene fecha de respuesta válida
  const hasNoResp = !fechaRespVal || 
                     String(fechaRespVal).trim() === "" || 
                     String(fechaRespVal).trim() === "-" || 
                     String(fechaRespVal).trim() === "null" || 
                     String(fechaRespVal).trim() === "---";

  if (estadoClean === "encomendada" && hasNoResp) {
    const folio = r1.folio;
    const id1 = r1.id;
    
    // Buscar la siguiente fila cronológica con el mismo Folio
    let foundNext = null;
    for (let j = 0; j < dataRows.length; j++) {
      const r2 = dataRows[j];
      if (r2.folio === folio && r2.id > id1) {
        foundNext = r2;
        break; // Al estar ordenado, el primero con id2 > id1 es el inmediato siguiente
      }
    }
    
    if (foundNext) {
      // Obtener la celda original de "Fecha ingreso" del registro posterior
      // Las coordenadas de celda en SheetJS son 0-indexed (r: excelRowNum-1, c: ingresoColIdx)
      const nextCellAddress = XLSX.utils.encode_cell({ r: foundNext.excelRowNum - 1, c: ingresoColIdx });
      const nextCell = sheet[nextCellAddress];
      
      if (nextCell && nextCell.v !== undefined && nextCell.v !== null && nextCell.v !== "") {
        // Encontrar o crear la celda de destino
        const targetCellAddress = XLSX.utils.encode_cell({ r: r1.excelRowNum - 1, c: respuestaColIdx });
        
        if (!sheet[targetCellAddress]) {
          sheet[targetCellAddress] = {};
        }
        
        // Copiar el valor y los metadatos de formato de la celda de origen
        sheet[targetCellAddress].v = nextCell.v;
        sheet[targetCellAddress].t = nextCell.t; // Generalmente 'n' (número de serie de fecha) o 'd'
        
        if (nextCell.z) {
          sheet[targetCellAddress].z = nextCell.z; // Formato numérico de fecha (ej: 'yyyy-mm-dd' o 'dd-mm-yyyy')
        }
        if (nextCell.w) {
          sheet[targetCellAddress].w = nextCell.w; // Texto formateado visible (ej: "25-06-2026")
        }
        
        console.log(`[CORREGIDO] Fila Excel #${r1.excelRowNum} (Id ${id1}, Folio ${folio}): ` +
                    `Fecha respuesta asignada con el formato y valor de Fila Excel #${foundNext.excelRowNum} (Id ${foundNext.id}) -> '${nextCell.w || nextCell.v}'`);
        
        updateCount++;
      } else {
        console.log(`[ADVERTENCIA] Fila Excel #${r1.excelRowNum} (Id ${id1}, Folio ${folio}): se encontró la fila posterior (Fila Excel #${foundNext.excelRowNum}) pero su 'Fecha ingreso' está vacía.`);
        missingIngresoCount++;
      }
    } else {
      console.log(`[INFO] Fila Excel #${r1.excelRowNum} (Id ${id1}, Folio ${folio}): no se encontró ninguna fila posterior con el mismo folio.`);
      notFoundNextCount++;
    }
  }
}

// Guardar el libro original directamente (mantiene todos los estilos, anchos de columna, fuentes, etc.)
console.log("\nGuardando los cambios en el nuevo archivo Excel...");
XLSX.writeFile(workbook, outputFilePath);

console.log(`\n======================================================`);
console.log(`PROCESO FINALIZADO CON ÉXITO`);
console.log(`======================================================`);
console.log(`Filas actualizadas con Fecha respuesta:  ${updateCount}`);
console.log(`Filas sin etapa posterior encontrada:    ${notFoundNextCount}`);
console.log(`Filas con siguiente etapa sin fecha:    ${missingIngresoCount}`);
console.log(`Archivo corregido guardado en:           ${outputFilePath}`);
console.log(`======================================================\n`);
