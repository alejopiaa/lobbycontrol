/**
 * scripts/audit_db_invocations.js
 * 
 * Script de Auditoría Pragmática de Invocaciones, Rutas y Esquemas de Bases de Datos (v3.1).
 * 
 * Mejoras arquitectónicas aplicadas:
 * 1. Escaneo sobre buffer completo con soporte multilínea y template literals.
 * 2. Supresión de comentarios preservando longitud exacta de caracteres y saltos de línea.
 * 3. Validación semántica estricta de cláusulas SQL (FROM, INTO, UPDATE, JOIN, TABLE, REFERENCES)
 *    con soporte para prefijos de base de datos/esquemas opcionales (ej: app.tabla, main.tabla).
 * 4. Extracción de argumentos con salto inmediato de secuencias de escape (\\) sin flags booleanos frágiles.
 * 5. Soporte para identificadores compuestos y acceso a propiedades (ej: queries.miConsulta).
 * 6. Resolución léxica hacia atrás para variables y propiedades de objetos sin sobreingeniería.
 * 7. Esquemas canónicos completos: DATA (4), APP (7), USERS (4: usuarios, roles, permisos, sesiones), LOCAL (2).
 * 8. Detección calibrada de rutas locales en Windows, ignorando fallbacks legítimos (userData/APPDATA).
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');

// Directorios a auditar
const TARGET_DIRS = ['src', 'scripts', 'public'];

// Extensiones de código analizadas sintáctica y semánticamente
const CODE_EXTS = ['.js', '.cjs', '.mjs', '.html'];

// Extensiones de configuración (solo escaneo de literales de texto)
const CONFIG_EXTS = ['.json'];

// Rutas excluidas de la auditoría
const IGNORE_PATHS = [
  'node_modules',
  '.git',
  'data',
  'dist',
  'release-builds',
  'package-lock.json',
  'scripts/refactor_db_architecture.js', // Script histórico de migración estructural
  'scripts/migrate_sharepoint_dbs.js',   // Script de migración en SharePoint
  'scripts/audit_db_invocations.js'      // Este mismo script
];

// -----------------------------------------------------------------------------
// DEFINICIÓN CANÓNICA DE TABLAS POR BASE DE DATOS
// -----------------------------------------------------------------------------
const DATA_DB_TABLES = [
  'solicitudes_sh',
  'publicadas_ph',
  'sujetos_pasivos_sph',
  'sujetos_pasivos_vigentes'
];

const APP_DB_TABLES = [
  'bitacora_asistencias',
  'contactos_asistencia',
  'asistencia_categorias',
  'direcciones_municipales',
  'auditoria_semanal',
  'historial_sincronizaciones',
  'configuracion'
];

const USERS_DB_TABLES = [
  'usuarios',
  'roles',
  'permisos',
  'sesiones'
];

const LOCAL_DB_TABLES = [
  'alertas_gestionadas',
  'configuracion_local'
];

// -----------------------------------------------------------------------------
// MATRIZ DECLARATIVA DE REGLAS: HANDLE <-> TABLAS PROHIBIDAS
// -----------------------------------------------------------------------------
const HANDLE_RULES = [
  {
    handleId: 'dataDb',
    label: 'db / dataDb (data.db)',
    callRegexGenerator: () => /\b(?:db|dataDb)\s*\.\s*(?:all|run|get|each|prepare|exec)\s*\(/g,
    forbiddenTables: [...APP_DB_TABLES, ...USERS_DB_TABLES, ...LOCAL_DB_TABLES],
    targetHandle: 'appDb, usersDb o localDb'
  },
  {
    handleId: 'appDb',
    label: 'appDb (app.db)',
    callRegexGenerator: () => /\b(?:appDb|asistenciasDb)\s*\.\s*(?:all|run|get|each|prepare|exec)\s*\(/g,
    forbiddenTables: [...DATA_DB_TABLES, ...USERS_DB_TABLES, ...LOCAL_DB_TABLES],
    targetHandle: 'dataDb, usersDb o localDb'
  },
  {
    handleId: 'usersDb',
    label: 'usersDb (usuarios.db)',
    callRegexGenerator: () => /\busersDb\s*\.\s*(?:all|run|get|each|prepare|exec)\s*\(/g,
    forbiddenTables: [...DATA_DB_TABLES, ...APP_DB_TABLES, ...LOCAL_DB_TABLES],
    targetHandle: 'dataDb, appDb o localDb'
  },
  {
    handleId: 'localDb',
    label: 'localDb (local.db)',
    callRegexGenerator: () => /\blocalDb\s*\.\s*(?:all|run|get|each|prepare|exec)\s*\(/g,
    forbiddenTables: [...DATA_DB_TABLES, ...APP_DB_TABLES, ...USERS_DB_TABLES],
    targetHandle: 'dataDb, appDb o usersDb'
  }
];

// Nombres obsoletos de bases de datos
const OBSOLETE_DB_NAMES = ['lobby_control.db', 'asistencias.db', 'lobby.db'];

// -----------------------------------------------------------------------------
// UTILIDADES DE BÚSQUEDA Y ANÁLISIS
// -----------------------------------------------------------------------------

function getAllFiles(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relativePath = path.relative(ROOT_DIR, fullPath).replace(/\\/g, '/');

    if (IGNORE_PATHS.some(ignore => relativePath.startsWith(ignore) || relativePath === ignore)) {
      continue;
    }

    if (entry.isDirectory()) {
      getAllFiles(fullPath, fileList);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (CODE_EXTS.includes(ext) || CONFIG_EXTS.includes(ext)) {
        fileList.push(fullPath);
      }
    }
  }

  return fileList;
}

function getLineNumber(content, charIndex) {
  return content.substring(0, charIndex).split('\n').length;
}

function getSnippet(content, charIndex, length = 80) {
  const lineStart = content.lastIndexOf('\n', charIndex) + 1;
  let lineEnd = content.indexOf('\n', charIndex);
  if (lineEnd === -1) lineEnd = content.length;
  const fullLine = content.substring(lineStart, lineEnd).trim();
  return fullLine.length > length ? fullLine.substring(0, length) + '...' : fullLine;
}

/**
 * Reemplaza comentarios de bloque y de línea por espacios en blanco idénticos en longitud.
 * Mantiene la correspondencia exacta de índices y saltos de línea (\n).
 */
function maskComments(code) {
  return code.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, match => {
    return match.split('\n').map(part => ' '.repeat(part.length)).join('\n');
  });
}

/**
 * Extrae el contenido del primer argumento de la llamada SQLite a partir del paréntesis de apertura.
 * Maneja cadenas literales con salto de escapes (\\), template literals, e identificadores o propiedades compuestas.
 */
function extractFirstArgument(code, openParenIndex) {
  let idx = openParenIndex + 1;
  while (idx < code.length && /\s/.test(code[idx])) {
    idx++;
  }

  if (idx >= code.length) return { type: 'unknown', content: '' };

  const firstChar = code[idx];

  // Caso 1: String literal o Template literal con salto directo de caracteres de escape
  if (firstChar === '`' || firstChar === '"' || firstChar === "'") {
    const quote = firstChar;
    let endIdx = -1;

    for (let i = idx + 1; i < code.length; i++) {
      const c = code[i];
      if (c === '\\') {
        i++; // Saltar inmediatamente el carácter escapado
        continue;
      }
      if (c === quote) {
        endIdx = i;
        break;
      }
    }

    if (endIdx !== -1) {
      return { type: 'literal', content: code.substring(idx + 1, endIdx) };
    }
  }

  // Caso 2: Identificador compuesto o acceso a propiedades (ej: db.all(sql), db.all(queries.getUsers))
  const identMatch = /^[a-zA-Z0-9_$]+(?:\.[a-zA-Z0-9_$]+)*/.exec(code.substring(idx));
  if (identMatch) {
    return { type: 'variable', content: identMatch[0] };
  }

  // Caso 3: Expresión general balanceada
  let depth = 1;
  let inStr = null;
  let expEnd = -1;

  for (let i = idx; i < code.length; i++) {
    const c = code[i];
    if (inStr) {
      if (c === '\\') { i++; continue; }
      if (c === inStr) inStr = null;
      continue;
    }
    if (c === '`' || c === '"' || c === "'") { inStr = c; continue; }
    if (c === '(' || c === '[' || c === '{') { depth++; continue; }
    if (c === ')' || c === ']' || c === '}') {
      depth--;
      if (depth === 0) { expEnd = i; break; }
      continue;
    }
    if (c === ',' && depth === 1) { expEnd = i; break; }
  }

  if (expEnd === -1) expEnd = Math.min(code.length, idx + 200);
  return { type: 'expression', content: code.substring(idx, expEnd).trim() };
}

/**
 * Resuelve el valor asignado a una variable o propiedad buscando léxicamente hacia atrás desde callIndex.
 */
function resolveVariableBackwards(code, varName, callIndex) {
  const codeBefore = code.substring(0, callIndex);
  
  // Si es un acceso a propiedad como 'queries.getUsers', buscar la clave final 'getUsers'
  const targetKey = varName.includes('.') ? varName.split('.').pop() : varName;
  const escapedKey = targetKey.replace(/\$/g, '\\$');

  // Coincide con asignaciones de variable (key = '...') o pares de objeto (key: '...')
  const assignRegex = new RegExp(
    `(?:(?:const|let|var)\\s+)?${escapedKey}\\s*[:=]\\s*(\`[\\s\\S]*?\`|'(?:\\\\.|[^'])*'|"(?:\\\\.|[^"])*")`,
    'g'
  );

  let lastMatch = null;
  let m;
  while ((m = assignRegex.exec(codeBefore)) !== null) {
    lastMatch = m[1];
  }

  if (lastMatch) {
    return lastMatch.substring(1, lastMatch.length - 1);
  }

  return '';
}

// -----------------------------------------------------------------------------
// FUNCIÓN PRINCIPAL DE AUDITORÍA POR ARCHIVO
// -----------------------------------------------------------------------------

function auditFile(filePath) {
  const relativePath = path.relative(ROOT_DIR, filePath).replace(/\\/g, '/');
  const ext = path.extname(filePath).toLowerCase();
  const rawContent = fs.readFileSync(filePath, 'utf8');
  const findings = [];

  // ===========================================================================
  // 1. AUDITORÍA DE NOMBRES OBSOLETOS DE BASES DE DATOS
  // ===========================================================================
  OBSOLETE_DB_NAMES.forEach(obsoleteName => {
    const escaped = obsoleteName.replace(/\./g, '\\.');
    const regex = new RegExp(`\\b${escaped}\\b`, 'gi');
    let match;

    while ((match = regex.exec(rawContent)) !== null) {
      const matchIndex = match.index;
      const lineNum = getLineNumber(rawContent, matchIndex);
      const snippet = getSnippet(rawContent, matchIndex);

      // Determinar si la mención está dentro de un comentario
      const lineStart = rawContent.lastIndexOf('\n', matchIndex) + 1;
      const beforeInLine = rawContent.substring(lineStart, matchIndex);
      const isLineComment = /\/\/|\/\*/.test(beforeInLine);
      
      const upToMatch = rawContent.substring(0, matchIndex);
      const lastBlockStart = upToMatch.lastIndexOf('/*');
      const lastBlockEnd = upToMatch.lastIndexOf('*/');
      const isInsideBlockComment = lastBlockStart !== -1 && lastBlockStart > lastBlockEnd;
      const isComment = isLineComment || isInsideBlockComment;

      const isFallbackContext = /fallback|retrocompatib|legacy|migraci[oó]n|alias/i.test(snippet);

      let severity = 'ERROR';
      if (isFallbackContext) {
        severity = 'INFO';
      } else if (isComment) {
        severity = 'WARNING';
      }

      if (CONFIG_EXTS.includes(ext) && severity === 'ERROR') {
        severity = 'WARNING';
      }

      findings.push({
        type: 'OBSOLETE_DB_NAME',
        severity,
        file: relativePath,
        line: lineNum,
        matched: match[0],
        snippet,
        detail: `Referencia al nombre de base de datos descontinuado '${match[0]}'.`
      });
    }
  });

  // En archivos JSON no aplicamos análisis sintáctico de llamadas SQL
  if (CONFIG_EXTS.includes(ext)) {
    return findings;
  }

  // ===========================================================================
  // 2. AUDITORÍA SINTÁCTICA Y SEMÁNTICA DE LLAMADAS SQL
  // ===========================================================================
  const maskedCode = maskComments(rawContent);

  HANDLE_RULES.forEach(rule => {
    const callRegex = rule.callRegexGenerator();
    let callMatch;

    while ((callMatch = callRegex.exec(maskedCode)) !== null) {
      const callIndex = callMatch.index;
      const openParenIndex = callIndex + callMatch[0].length - 1;
      const argInfo = extractFirstArgument(maskedCode, openParenIndex);

      let sqlQueryText = '';

      if (argInfo.type === 'literal') {
        sqlQueryText = argInfo.content;
      } else if (argInfo.type === 'variable') {
        sqlQueryText = resolveVariableBackwards(maskedCode, argInfo.content, callIndex);
      } else {
        sqlQueryText = argInfo.content;
      }

      // Validación Semántica de Cláusula SQL con prefijo opcional de esquema (ej: app.tabla, main.tabla)
      rule.forbiddenTables.forEach(forbiddenTable => {
        const semanticTableRegex = new RegExp(
          `(?:FROM|INTO|UPDATE|JOIN|TABLE(?:\\s+IF\\s+(?:NOT\\s+)?EXISTS)?|REFERENCES)\\s+(?:[a-zA-Z0-9_]+\\.)?[\`"']?\\b${forbiddenTable}\\b[\`"']?`,
          'i'
        );

        if (semanticTableRegex.test(sqlQueryText)) {
          const lineNum = getLineNumber(rawContent, callIndex);
          const snippet = getSnippet(rawContent, callIndex);

          findings.push({
            type: 'WRONG_DB_HANDLE_CALL',
            severity: 'ERROR',
            file: relativePath,
            line: lineNum,
            matched: `${rule.handleId} -> ${forbiddenTable}`,
            snippet,
            detail: `Invocación semántica a tabla '${forbiddenTable}' mediante '${rule.label}'. Requiere canalizarse a través de '${rule.targetHandle}'.`
          });
        }
      });
    }
  });

  // ===========================================================================
  // 3. AUDITORÍA DE PARIDAD DE RUTAS DEV VS PRODUCCIÓN (CALIBRADA)
  // ===========================================================================
  const prodPathPatterns = [
    /AppData[\\\/]Local[\\\/]LobbyControl/g,
    /['"]Local['"]\s*,\s*['"]LobbyControl['"]/g,
    /process\.env\.LOCALAPPDATA/g
  ];

  prodPathPatterns.forEach(pattern => {
    let m;
    while ((m = pattern.exec(maskedCode)) !== null) {
      const matchIndex = m.index;
      const lineNum = getLineNumber(rawContent, matchIndex);
      const snippet = getSnippet(rawContent, matchIndex);

      // Si el contexto inmediato ya implementa fallback legítimo (userData, APPDATA, USER_DATA_DIR, electronApp), omitir
      if (/electronApp|userData|process\.env\.APPDATA|process\.env\.USER_DATA_DIR/i.test(snippet)) {
        continue;
      }

      findings.push({
        type: 'DEV_PROD_PATH_MISMATCH',
        severity: 'WARNING',
        file: relativePath,
        line: lineNum,
        matched: m[0],
        snippet,
        detail: `Ruta fija de almacenamiento local detectada (${m[0]}) sin fallback explícito a userData o APPDATA.`
      });
    }
  });

  return findings;
}

// -----------------------------------------------------------------------------
// EJECUTOR DEL REPORTE
// -----------------------------------------------------------------------------

function runAudit() {
  console.log('='.repeat(80));
  console.log(' AUDITORÍA GLOBAL DE INVOCACIONES Y RUTAS DE BASES DE DATOS (v3.1 - AST/Semántica)');
  console.log(' Proyecto: LobbyControl (Arquitectura data.db & app.db)');
  console.log('='.repeat(80));

  let totalFilesScanned = 0;
  let allFindings = [];

  for (const targetDir of TARGET_DIRS) {
    const dirPath = path.join(ROOT_DIR, targetDir);
    const files = getAllFiles(dirPath);
    for (const file of files) {
      totalFilesScanned++;
      const findings = auditFile(file);
      if (findings.length > 0) {
        allFindings = allFindings.concat(findings);
      }
    }
  }

  const errors = allFindings.filter(f => f.severity === 'ERROR');
  const warnings = allFindings.filter(f => f.severity === 'WARNING');
  const infos = allFindings.filter(f => f.severity === 'INFO');

  console.log(`\nArchivos escaneados: ${totalFilesScanned}`);
  console.log(`Hallazgos totales:  ${allFindings.length}`);
  console.log(`  - [ERROR]   Críticos / Incompatibles: ${errors.length}`);
  console.log(`  - [WARNING] Advertencias / Rutas:    ${warnings.length}`);
  console.log(`  - [INFO]    Retrocompatibilidad:     ${infos.length}\n`);

  if (errors.length > 0) {
    console.log('-'.repeat(80));
    console.log(' ERRORES CRÍTICOS DETECTADOS:');
    console.log('-'.repeat(80));
    errors.forEach((err, i) => {
      console.log(`[${i + 1}] [${err.file}:${err.line}] (${err.type})`);
      console.log(`    Detalle: ${err.detail}`);
      console.log(`    Código:  ${err.snippet}`);
      console.log('');
    });
  }

  if (warnings.length > 0) {
    console.log('-'.repeat(80));
    console.log(' ADVERTENCIAS (RUTAS / COMENTARIOS / OBSOLETOS):');
    console.log('-'.repeat(80));
    warnings.forEach((warn, i) => {
      console.log(`[${i + 1}] [${warn.file}:${warn.line}] (${warn.type})`);
      console.log(`    Detalle: ${warn.detail}`);
      console.log(`    Código:  ${warn.snippet}`);
      console.log('');
    });
  }

  if (infos.length > 0) {
    console.log('-'.repeat(80));
    console.log(' INFORMACIÓN (FALLBACKS / ALIAS DOCUMENTADOS):');
    console.log('-'.repeat(80));
    infos.forEach((inf, i) => {
      console.log(`[${i + 1}] [${inf.file}:${inf.line}]`);
      console.log(`    Detalle: ${inf.detail}`);
      console.log(`    Código:  ${inf.snippet}`);
    });
    console.log('');
  }

  console.log('='.repeat(80));
  if (errors.length === 0) {
    console.log('✓ RESULTADO: Ningún error crítico de invocación encontrado.');
  } else {
    console.log(`✗ RESULTADO: Se encontraron ${errors.length} errores que requieren corrección.`);
  }
  console.log('='.repeat(80));

  return { totalFilesScanned, errors, warnings, infos };
}

if (require.main === module) {
  runAudit();
}

module.exports = { runAudit };
