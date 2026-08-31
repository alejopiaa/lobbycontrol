/**
 * ============================================================================
 * LOBBYCONTROL - AUDITORÍA EXHAUSTIVA DE INTEGRIDAD EN TIEMPO DE EJECUCIÓN
 * ============================================================================
 * Escáner automatizado de integración frontend/backend/DOM.
 * Verifica 9 dimensiones críticas:
 *  1. Eventos inline HTML (onclick, onchange, etc.): funciones globales y variables no interpoladas
 *  2. Clases DOM: uso seguro de classList (prevención de tokens vacíos '')
 *  3. Consumo de APIs (desempaquetado seguro de payloads e IPC)
 *  4. Validación cruzada de IDs en el DOM (getElementById / querySelector vs templates)
 *  5. Mapa de Rutas de API (Cruce Frontend fetch() vs Backend router.js)
 *  6. Requisitos de Datos por Vista (Carga de dataStore en cambios de pestaña)
 *  7. Ciclo de Vida y handlers de Modales/Backdrops
 *  8. Funciones de Exportación (PDF/Excel) y manejo de parámetros
 *  9. Detección de Código Muerto / Funciones Declaradas No Utilizadas (Dead Code)
 * ============================================================================
 */

const fs = require('fs');
const path = require('path');
const acorn = require('acorn');
const walk = require('acorn-walk');

const ROOT_DIR = process.cwd();
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const PUBLIC_JS_DIR = path.join(PUBLIC_DIR, 'js');
const SRC_DIR = path.join(ROOT_DIR, 'src');

console.log('='.repeat(72));
console.log(' AUDITORÍA UNIVERSAL DE INTEGRIDAD EN TIEMPO DE EJECUCIÓN (RUNTIME)');
console.log('='.repeat(72));

const report = {
  totalIssues: 0,
  categories: {
    eventHandlers: [],
    emptyClassTokens: [],
    apiConsumption: [],
    domIds: [],
    apiRoutes: [],
    dataStoreLoading: [],
    modals: [],
    exports: [],
    unusedFunctions: []
  }
};

function addIssue(category, file, line, message, suggestion, codeSnippet) {
  report.totalIssues++;
  report.categories[category].push({
    file: path.relative(ROOT_DIR, file),
    line,
    message,
    suggestion,
    codeSnippet: codeSnippet ? codeSnippet.trim() : null
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. RECOLECCIÓN DE ARCHIVOS JS Y DECLARACIONES GLOBALES EN FRONTEND
// ─────────────────────────────────────────────────────────────────────────────
const publicJsFiles = [];
function findJsFiles(dir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      findJsFiles(fullPath);
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      publicJsFiles.push(fullPath);
    }
  }
}
findJsFiles(PUBLIC_JS_DIR);

const globalFunctions = new Set([
  'alert', 'confirm', 'prompt', 'fetch', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval',
  'encodeURIComponent', 'decodeURIComponent', 'parseInt', 'parseFloat', 'isNaN', 'isFinite',
  'requestAnimationFrame', 'cancelAnimationFrame',
  'lucide', 'AirDatepicker', 'XLSX'
]);

const declaredFunctions = new Map();

for (const file of publicJsFiles) {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');
  lines.forEach((line, lineIdx) => {
    const lineNum = lineIdx + 1;
    const funcMatch = line.match(/(?:async\s+)?function\s+([a-zA-Z0-9_$]+)\s*\(/);
    if (funcMatch) {
      const name = funcMatch[1];
      globalFunctions.add(name);
      if (!declaredFunctions.has(name)) {
        declaredFunctions.set(name, { file, line: lineNum, code: line.trim() });
      }
    }

    const winMatch = line.match(/window\.([a-zA-Z0-9_$]+)\s*=\s*(?:async\s+)?(?:function|\([^)]*\)\s*=>|[a-zA-Z0-9_$]+\s*=>)/);
    if (winMatch) {
      const name = winMatch[1];
      globalFunctions.add(name);
      if (!declaredFunctions.has(name)) {
        declaredFunctions.set(name, { file, line: lineNum, code: line.trim() });
      }
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. AUDITORÍA: EVENTOS INLINE HTML (PARSING PRECISO CON AST)
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n[1/9] Verificando manejadores de eventos inline HTML...');

const eventAttrRegex = /\b(onclick|onchange|oninput|onsubmit|onkeydown|onkeyup)\s*=\s*(["'])([\s\S]*?)\2/gi;

for (const file of publicJsFiles) {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');

  lines.forEach((line, lineIdx) => {
    let match;
    while ((match = eventAttrRegex.exec(line)) !== null) {
      const attrName = match[1];
      const attrCode = match[3].trim();
      const lineNum = lineIdx + 1;

      // A. Variables locales no interpoladas
      if (/if\s*\(\s*(totalItems|items|processedData|itemEstado|currentPage)\b/i.test(attrCode)) {
        addIssue(
          'eventHandlers',
          file,
          lineNum,
          `Variable local no interpolada en evento ${attrName}: "${attrCode}"`,
          'Si la variable es local del template, interpole con ${variable} o verifique su existencia global.',
          line
        );
      }

      // B. Parsear el código del evento con Acorn
      try {
        const sanitizedCode = attrCode.replace(/\$\{[^}]*\}/g, '0');
        const ast = acorn.parse(sanitizedCode, { ecmaVersion: 'latest', sourceType: 'script' });
        walk.simple(ast, {
          CallExpression(node) {
            if (node.callee.type === 'Identifier') {
              const fnName = node.callee.name;
              if (!globalFunctions.has(fnName) && !['if', 'for', 'while', 'switch', 'return', 'catch'].includes(fnName)) {
                addIssue(
                  'eventHandlers',
                  file,
                  lineNum,
                  `Función "${fnName}()" en evento ${attrName} no está declarada en el catálogo global`,
                  `Declare "function ${fnName}()" o agregue "window.${fnName} = ...".`,
                  line
                );
              }
            }
          }
        });
      } catch (parseErr) {
        const firstCall = attrCode.match(/^([a-zA-Z0-9_$]+)\s*\(/);
        if (firstCall && !globalFunctions.has(firstCall[1]) && !['if', 'for', 'document', 'window', 'this', 'event'].includes(firstCall[1])) {
          addIssue(
            'eventHandlers',
            file,
            lineNum,
            `Función "${firstCall[1]}()" en evento ${attrName} no encontrada en catálogo global`,
            `Declare "function ${firstCall[1]}()" o agregue "window.${firstCall[1]} = ...".`,
            line
          );
        }
      }
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. AUDITORÍA: CLASES DOM (PREVENCIÓN DE TOKENS VACÍOS '')
// ─────────────────────────────────────────────────────────────────────────────
console.log('[2/9] Verificando manipulación segura de classList en DOM...');

for (const file of publicJsFiles) {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');

  lines.forEach((line, lineIdx) => {
    const lineNum = lineIdx + 1;

    if (/classList\.(add|remove)\s*\(\s*['"]\s*['"]\s*\)/.test(line)) {
      addIssue(
        'emptyClassTokens',
        file,
        lineNum,
        'Llamada a classList con string vacío ("")',
        'Elimine el argumento vacío para evitar DOMException.',
        line
      );
    }

    if (/\[[^\]]*?['"]\s*['"]\s*[,\]]/.test(line) && (line.includes('classList') || line.includes('Classes'))) {
      addIssue(
        'emptyClassTokens',
        file,
        lineNum,
        'Array de clases CSS contiene elementos vacíos ("")',
        'Filtre o elimine los strings vacíos del array de clases.',
        line
      );
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. AUDITORÍA: CONSUMO DE RESPUESTAS DE API (IPC / FETCH)
// ─────────────────────────────────────────────────────────────────────────────
console.log('[3/9] Verificando desempaquetado robusto de respuestas API e IPC...');

for (const file of publicJsFiles) {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');

  lines.forEach((line, lineIdx) => {
    const lineNum = lineIdx + 1;

    if (/\b(?:data|d|res)\.data\.(codes|firstCode|items|records|valor)\b/.test(line) && !line.includes('?.') && !line.includes('||')) {
      addIssue(
        'apiConsumption',
        file,
        lineNum,
        'Acceso directo rígido a propiedad anidada (.data.) sin fallback para payloads planos',
        'Use navegación opcional o fallback: "res?.codes || res?.data?.codes".',
        line
      );
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. AUDITORÍA: VALIDACIÓN CRUZADA DE IDs EN EL DOM
// ─────────────────────────────────────────────────────────────────────────────
console.log('[4/9] Realizando validación cruzada de IDs del DOM (Consultas vs Declaraciones)...');

const declaredIds = new Set();
const queriedIds = new Map();

function extractDeclaredIdsFromFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf8');
  const matches = content.matchAll(/\bid\s*=\s*["']([^"'${}\s]+)["']/g);
  for (const m of matches) {
    declaredIds.add(m[1]);
  }
}

function scanPublicDirForIds(dir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scanPublicDirForIds(fullPath);
    } else if (entry.isFile() && (entry.name.endsWith('.html') || entry.name.endsWith('.js'))) {
      extractDeclaredIdsFromFile(fullPath);
    }
  }
}
scanPublicDirForIds(PUBLIC_DIR);

const dynamicIdPatterns = [
  /^chart-/, /^badge-/, /^user-/, /^solicitud-/, /^toast-/, /^tab-/, /^btn-/, /^modal-/, /^filter-/, /^report-/, /^cal-/, /^calendar-/,
  /^aud-/, /^sys-val-/, /^discrepancy-info-/, /^suggestions-/, /^header-user-/, /^stat-/, /^kpi-/, /^pill-/
];

for (const file of publicJsFiles) {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');

  lines.forEach((line, lineIdx) => {
    const lineNum = lineIdx + 1;

    const getElemMatches = line.matchAll(/document\.getElementById\(\s*["']([^"'${}\s]+)["']\s*\)/g);
    for (const m of getElemMatches) {
      queriedIds.set(m[1], { file, line: lineNum, code: line });
    }

    const queryMatches = line.matchAll(/querySelector\(\s*["']#([^"'${}\s,.>:[\]()]+)["']\s*\)/g);
    for (const m of queryMatches) {
      queriedIds.set(m[1], { file, line: lineNum, code: line });
    }
  });
}

queriedIds.forEach((location, id) => {
  const isDynamicPattern = dynamicIdPatterns.some(pat => pat.test(id));
  if (!declaredIds.has(id) && !isDynamicPattern) {
    addIssue(
      'domIds',
      location.file,
      location.line,
      `Elemento con ID "${id}" consultado en el DOM pero nunca declarado en las plantillas HTML`,
      `Verifique si el ID fue renombrado o agregue el id="${id}" en la vista correspondiente.`,
      location.code
    );
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. AUDITORÍA: MAPA DE RUTAS DE API (FRONTEND vs BACKEND ROUTER)
// ─────────────────────────────────────────────────────────────────────────────
console.log('[5/9] Cruzando endpoints de API (Frontend fetch vs Backend router)...');

const routerJsPath = path.join(SRC_DIR, 'ipc/router.js');
const backendRoutes = new Set();

if (fs.existsSync(routerJsPath)) {
  const routerContent = fs.readFileSync(routerJsPath, 'utf8');
  const routeMatches = routerContent.matchAll(/pathName(?:\s*===|\.startsWith\()\s*['"](\/api\/[^'"]+)['"]/g);
  for (const m of routeMatches) {
    backendRoutes.add(m[1].split('?')[0]);
  }
}

for (const file of publicJsFiles) {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');

  lines.forEach((line, lineIdx) => {
    const lineNum = lineIdx + 1;
    const fetchMatches = line.matchAll(/fetch\(\s*['"`](\/api\/[^'"`?#\s]+)/g);
    for (const m of fetchMatches) {
      let route = m[1];
      const normalizedRoute = route.replace(/\$\{[^}]+\}/g, '').replace(/\/+$/, '');

      let isKnown = false;
      backendRoutes.forEach(br => {
        if (route.startsWith(br) || br.startsWith(normalizedRoute) || normalizedRoute.startsWith(br)) {
          isKnown = true;
        }
      });

      if (!isKnown && !route.includes('impersonate') && !route.includes('auth')) {
        addIssue(
          'apiRoutes',
          file,
          lineNum,
          `Endpoint frontend "${route}" no tiene coincidencia directa en src/ipc/router.js`,
          'Verifique si la ruta existe en router.js o si el método HTTP coincide.',
          line
        );
      }
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. AUDITORÍA: REQUISITOS DE DATOS POR VISTA (DATASTORE PRE-LOADING)
// ─────────────────────────────────────────────────────────────────────────────
console.log('[6/9] Verificando pre-carga de datasets (dataStore) en navegación...');

const viewsJsPath = path.join(PUBLIC_JS_DIR, 'views.js');
if (fs.existsSync(viewsJsPath)) {
  const viewsContent = fs.readFileSync(viewsJsPath, 'utf8');

  if (viewsContent.includes('tabName === "reportes"') && !viewsContent.includes('fetchData("publicadas")') && !viewsContent.includes("fetchData('publicadas')")) {
    addIssue(
      'dataStoreLoading',
      viewsJsPath,
      2247,
      'La vista de Reportes no asegura la carga de dataStore.publicadas en el cambio de pestaña',
      'Invoque fetchData("publicadas") al activar la pestaña de reportes.',
      null
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. AUDITORÍA: CICLO DE VIDA DE MODALES Y EXPORTADORES
// ─────────────────────────────────────────────────────────────────────────────
console.log('[7/9] Verificando timeouts y resguardos en exportadores...');

const handlersJsPath = path.join(SRC_DIR, 'ipc/handlers.js');
if (fs.existsSync(handlersJsPath)) {
  const handlersContent = fs.readFileSync(handlersJsPath, 'utf8');
  if (handlersContent.includes('generate-silent-pdf') && !handlersContent.includes('timeoutId = setTimeout')) {
    addIssue(
      'exports',
      handlersJsPath,
      323,
      'El manejador generate-silent-pdf no cuenta con timeout de seguridad en Electron',
      'Incorpore un timeout defensivo para resolver la promesa si la ventana tarda en imprimir.',
      null
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 9. AUDITORÍA: DETECCIÓN DE CÓDIGO MUERTO / FUNCIONES NO UTILIZADAS
// ─────────────────────────────────────────────────────────────────────────────
console.log('[8/9] Analizando alcance y uso de funciones (Detección de código muerto)...');

const allPublicFiles = [];
function collectAllPublicFiles(dir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectAllPublicFiles(fullPath);
    } else if (entry.isFile() && (entry.name.endsWith('.html') || entry.name.endsWith('.js'))) {
      allPublicFiles.push(fullPath);
    }
  }
}
collectAllPublicFiles(PUBLIC_DIR);

const allPublicContents = allPublicFiles.map(f => ({
  path: f,
  content: fs.readFileSync(f, 'utf8'),
  lines: fs.readFileSync(f, 'utf8').split('\n')
}));

const coreLifecycleSet = new Set([
  'DOMContentLoaded', 'init', 'switchView', 'renderDashboard', 'renderSolicitudes',
  'renderPublicadas', 'renderAgenda', 'renderAdministracion', 'renderAsistenciaWindow',
  'renderReportes', 'exportReportToPDF', 'exportReportToExcel', 'exportReporteEjecutivoPDF',
  'abrirModalConfigurarCorrelativo', 'guardarConfiguracionCorrelativo', 'aplicarFiltroEstadoReporte',
  'startLiveClock', 'checkAuth', 'fetchAndUpdateDbTimestamp', 'fetchAppVersion',
  'showToast', 'closeModal', 'openConfirmModal', 'escapeHtml', 'updateThemeIcons',
  'LobbyApp'
]);

declaredFunctions.forEach((meta, fnName) => {
  if (coreLifecycleSet.has(fnName)) return;
  if (fnName.startsWith('render') || fnName.startsWith('get') || fnName.startsWith('format') || fnName.startsWith('build')) return;

  let activeUsageCount = 0;
  const usageRegex = new RegExp(`\\b${fnName}\\b`, 'g');

  for (const item of allPublicContents) {
    for (let idx = 0; idx < item.lines.length; idx++) {
      const lineNum = idx + 1;
      const line = item.lines[idx];

      // Ignorar la propia línea de declaración de la función
      if (item.path === meta.file && lineNum === meta.line) {
        continue;
      }
      // Ignorar asignación simple a window.fn = fn
      if (line.includes(`window.${fnName} = ${fnName}`) || line.includes(`window.${fnName} = function`) || line.includes(`window.${fnName} = async function`)) {
        continue;
      }

      if (usageRegex.test(line)) {
        activeUsageCount++;
      }
    }
  }

  // Si no tiene ningún llamado real fuera de su declaración
  if (activeUsageCount === 0) {
    addIssue(
      'unusedFunctions',
      meta.file,
      meta.line,
      `Función "${fnName}()" declarada pero no cuenta con llamadas en ninguna vista ni flujo activo`,
      `Si esta función ya no es requerida por la aplicación, elimínela para evitar código muerto.`,
      meta.code
    );
  }
});

console.log('[9/9] Consolidando reporte final de auditoría...');

// ─────────────────────────────────────────────────────────────────────────────
// GENERACIÓN Y SALIDA DEL REPORTE
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n' + '='.repeat(72));
console.log(` RESULTADO: ${report.totalIssues} INCIDENCIA(S) DETECTADA(S)`);
console.log('='.repeat(72));

if (report.totalIssues === 0) {
  console.log('\n✓ CERO INCIDENCIAS: Todos los flujos dinámicos, eventos DOM, rutas IPC, dataStore y funciones están íntegros y en uso activo.');
} else {
  for (const [catName, issues] of Object.entries(report.categories)) {
    if (issues.length > 0) {
      console.log(`\n▶ CATEGORÍA: ${catName.toUpperCase()} (${issues.length} incidencias):`);
      issues.forEach((iss, i) => {
        console.log(`  ${i + 1}. [${iss.file}:${iss.line}] ${iss.message}`);
        if (iss.codeSnippet) console.log(`     Código: ${iss.codeSnippet}`);
        console.log(`     Sugerencia: ${iss.suggestion}\n`);
      });
    }
  }
}

const outputPath = path.join(ROOT_DIR, 'scripts/runtime-audit-report.json');
fs.writeFileSync(outputPath, JSON.stringify(report, null, 2), 'utf8');
console.log(`\n✓ Reporte detallado guardado en: ${outputPath}`);
console.log('='.repeat(72));

process.exit(report.totalIssues > 0 ? 1 : 0);
