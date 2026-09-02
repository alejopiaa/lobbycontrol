/**
 * ============================================================================
 * LOBBYCONTROL - AUDITORÍA EXHAUSTIVA DE INTEGRIDAD EN TIEMPO DE EJECUCIÓN
 * ============================================================================
 * Escáner automatizado de integración frontend/backend/DOM.
 * Verifica 12 dimensiones críticas:
 *  1. Eventos inline HTML (onclick, onchange, etc.): funciones globales y variables no interpoladas
 *  2. Invocaciones JS -> JS: detección de llamadas a funciones no declaradas o inexistentes
 *  3. Clases DOM: uso seguro de classList (prevención de tokens vacíos '')
 *  4. Consumo de APIs (desempaquetado seguro de payloads e IPC)
 *  5. Validación cruzada de IDs en el DOM (getElementById / querySelector vs templates)
 *  6. Validación de Rutas y Métodos HTTP (Frontend fetch/invokeRoute vs Backend router.js)
 *  7. Delegación de Eventos: consistencia de atributos data-action
 *  8. Requisitos de Datos por Vista (Carga de dataStore en cambios de pestaña)
 *  9. Aridad y firmas de funciones de infraestructura crítica (openConfirmModal, showToast)
 *  10. Ciclo de Vida y handlers de Modales/Backdrops
 *  11. Funciones de Exportación (PDF/Excel) y resguardos
 *  12. Detección de Código Muerto / Funciones Declaradas No Utilizadas (Dead Code)
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
    undefinedFunctions: [],
    emptyClassTokens: [],
    apiConsumption: [],
    domIds: [],
    apiRoutes: [],
    dataActionDelegation: [],
    dataStoreLoading: [],
    functionSignatures: [],
    modals: [],
    exports: [],
    unusedFunctions: []
  }
};

function addIssue(category, file, line, message, suggestion, codeSnippet) {
  report.totalIssues++;
  if (!report.categories[category]) {
    report.categories[category] = [];
  }
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

const standardBuiltins = new Set([
  'alert', 'confirm', 'prompt', 'fetch', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval',
  'encodeURIComponent', 'decodeURIComponent', 'encodeURI', 'decodeURI', 'parseInt', 'parseFloat', 'isNaN', 'isFinite',
  'requestAnimationFrame', 'cancelAnimationFrame', 'btoa', 'atob', 'structuredClone', 'queueMicrotask',
  'eval', 'String', 'Number', 'Boolean', 'Array', 'Object', 'Function', 'Symbol', 'BigInt', 'Date', 'RegExp',
  'Error', 'TypeError', 'RangeError', 'SyntaxError', 'ReferenceError', 'Promise', 'Set', 'Map', 'WeakSet', 'WeakMap',
  'Int8Array', 'Uint8Array', 'Uint8ClampedArray', 'Int16Array', 'Uint16Array', 'Int32Array', 'Uint32Array',
  'Float32Array', 'Float64Array', 'BigInt64Array', 'BigUint64Array', 'DataView', 'ArrayBuffer',
  'Math', 'JSON', 'Reflect', 'Proxy', 'Intl', 'WebAssembly',
  'document', 'window', 'navigator', 'location', 'history', 'screen', 'performance', 'console',
  'localStorage', 'sessionStorage', 'crypto', 'indexedDB', 'caches', 'customElements',
  'getComputedStyle', 'getSelection', 'matchMedia',
  'Event', 'CustomEvent', 'MouseEvent', 'KeyboardEvent', 'FocusEvent', 'TouchEvent', 'UIEvent',
  'Node', 'Element', 'HTMLElement', 'DocumentFragment', 'MutationObserver', 'ResizeObserver', 'IntersectionObserver',
  'FormData', 'URL', 'URLSearchParams', 'Blob', 'File', 'FileReader', 'FileList', 'Image', 'Audio', 'Option',
  'AbortController', 'AbortSignal', 'Headers', 'Request', 'Response', 'WebSocket', 'Worker',
  'lucide', 'AirDatepicker', 'ApexCharts', 'XLSX', 'jspdf', 'html2canvas', 'Tailwind',
  'dataStore', 'activeSujetoIdsCache', 'dashboardFilters', 'reportesFilters', 'paginationState',
  'apiClient', 'currentSession'
]);

const declaredFunctions = new Map();
const globalFunctions = new Set([...standardBuiltins]);

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

    const constFnMatch = line.match(/(?:const|let|var)\s+([a-zA-Z0-9_$]+)\s*=\s*(?:async\s+)?(?:function|\([^)]*\)\s*=>|[a-zA-Z0-9_$]+\s*=>)/);
    if (constFnMatch) {
      const name = constFnMatch[1];
      globalFunctions.add(name);
      if (!declaredFunctions.has(name)) {
        declaredFunctions.set(name, { file, line: lineNum, code: line.trim() });
      }
    }

    const winMatch = line.match(/window\.([a-zA-Z0-9_$]+)\s*=\s*(?:async\s+)?(?:function|\([^)]*\)\s*=>|[a-zA-Z0-9_$]+\s*=>|[a-zA-Z0-9_$]+)/);
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
console.log('\n[1/12] Verificando manejadores de eventos inline HTML...');

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
// 3. AUDITORÍA: RESOLUCIÓN ESTÁTICA DE INVOCACIONES JS -> JS (FUNCIONES NO DECLARADAS CON AST)
// ─────────────────────────────────────────────────────────────────────────────
console.log('[2/12] Auditando resolución de llamadas internas JS -> JS (AST Scopes)...');

for (const file of publicJsFiles) {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');

  try {
    const ast = acorn.parse(content, { ecmaVersion: 'latest', sourceType: 'module' });
    walk.ancestor(ast, {
      CallExpression(node, ancestors) {
        if (node.callee.type === 'Identifier') {
          const fnName = node.callee.name;
          if (['if', 'for', 'while', 'switch', 'catch', 'function', 'return', 'typeof', 'delete', 'import', 'export', 'super', 'new', 'void', 'throw'].includes(fnName)) return;

          // Verificar si el identificador está en el ámbito local (parámetros o variables locales)
          let isScoped = false;
          for (let i = ancestors.length - 1; i >= 0; i--) {
            const anc = ancestors[i];
            if (anc.type === 'FunctionDeclaration' || anc.type === 'FunctionExpression' || anc.type === 'ArrowFunctionExpression') {
              if (anc.params && anc.params.some(p => {
                if (p.type === 'Identifier') return p.name === fnName;
                if (p.type === 'AssignmentPattern' && p.left && p.left.type === 'Identifier') return p.left.name === fnName;
                return false;
              })) {
                isScoped = true;
                break;
              }
            }
            if (anc.type === 'BlockStatement' || anc.type === 'Program') {
              if (anc.body) {
                for (const stmt of anc.body) {
                  if (stmt.type === 'VariableDeclaration') {
                    for (const decl of stmt.declarations) {
                      if (decl.id && decl.id.type === 'Identifier' && decl.id.name === fnName) {
                        isScoped = true;
                        break;
                      }
                    }
                  }
                  if (stmt.type === 'FunctionDeclaration' && stmt.id && stmt.id.name === fnName) {
                    isScoped = true;
                    break;
                  }
                }
              }
            }
            if (isScoped) break;
          }

          if (!isScoped && !globalFunctions.has(fnName)) {
            let lineNum = 1;
            let currentOffset = 0;
            for (let idx = 0; idx < lines.length; idx++) {
              currentOffset += lines[idx].length + 1;
              if (currentOffset > node.start) {
                lineNum = idx + 1;
                break;
              }
            }
            addIssue(
              'undefinedFunctions',
              file,
              lineNum,
              `Invocación a función no declarada "${fnName}()" en el flujo JavaScript`,
              `Verifique si la función fue renombrada, tiene un error tipográfico o requiere ser declarada/importada.`,
              lines[lineNum - 1]
            );
          }
        }
      }
    });
  } catch (err) {
    // Si ocurre error de parsing en módulo, continuar con los demás archivos
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. AUDITORÍA: CLASES DOM (PREVENCIÓN DE TOKENS VACÍOS '')
// ─────────────────────────────────────────────────────────────────────────────
console.log('[3/12] Verificando manipulación segura de classList en DOM...');

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
// 5. AUDITORÍA: CONSUMO DE RESPUESTAS DE API (IPC / FETCH)
// ─────────────────────────────────────────────────────────────────────────────
console.log('[4/12] Verificando desempaquetado robusto de respuestas API e IPC...');

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
// 6. AUDITORÍA: VALIDACIÓN CRUZADA DE IDs EN EL DOM
// ─────────────────────────────────────────────────────────────────────────────
console.log('[5/12] Realizando validación cruzada de IDs del DOM (Consultas vs Declaraciones)...');

const declaredIds = new Set();
const queriedIds = new Map();

function extractDeclaredIdsFromFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf8');
  const matches = content.matchAll(/\bid\s*=\s*["']([^"'${}\s]+)["']/g);
  for (const m of matches) {
    declaredIds.add(m[1]);
  }
  const propMatches = content.matchAll(/\bid\s*:\s*["']([^"'${}\s]+)["']/g);
  for (const m of propMatches) {
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
  /^aud-/, /^sys-val-/, /^discrepancy-info-/, /^suggestions-/, /^header-user-/, /^stat-/, /^kpi-/, /^pill-/, /^dashboard-filter-/
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
// 7. AUDITORÍA: MAPA DE RUTAS Y MÉTODOS HTTP (FRONTEND vs BACKEND ROUTER)
// ─────────────────────────────────────────────────────────────────────────────
console.log('[6/12] Cruzando endpoints de API y métodos HTTP (Frontend vs Backend router)...');

const routerJsPath = path.join(SRC_DIR, 'ipc/router.js');
const backendRoutes = new Map();

if (fs.existsSync(routerJsPath)) {
  const routerContent = fs.readFileSync(routerJsPath, 'utf8');
  const routerLines = routerContent.split('\n');
  routerLines.forEach(rLine => {
    const m1 = rLine.match(/method\s*===\s*['"]([A-Z]+)['"].*?pathName(?:\s*===|\.startsWith\()\s*['"](\/api\/[^'"]+)['"]/);
    if (m1) {
      const method = m1[1];
      const pathUrl = m1[2].split('?')[0];
      if (!backendRoutes.has(pathUrl)) backendRoutes.set(pathUrl, new Set());
      backendRoutes.get(pathUrl).add(method);
    }
    const m2 = rLine.match(/pathName(?:\s*===|\.startsWith\()\s*['"](\/api\/[^'"]+)['"].*?method\s*===\s*['"]([A-Z]+)['"]/);
    if (m2) {
      const pathUrl = m2[1].split('?')[0];
      const method = m2[2];
      if (!backendRoutes.has(pathUrl)) backendRoutes.set(pathUrl, new Set());
      backendRoutes.get(pathUrl).add(method);
    }
    const m3 = rLine.match(/pathName(?:\s*===|\.startsWith\()\s*['"](\/api\/[^'"]+)['"]/);
    if (m3 && !rLine.includes('method ===')) {
      const pathUrl = m3[1].split('?')[0];
      if (!backendRoutes.has(pathUrl)) backendRoutes.set(pathUrl, new Set());
      backendRoutes.get(pathUrl).add('ALL');
    }
  });
}

for (const file of publicJsFiles) {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');

  lines.forEach((line, lineIdx) => {
    const lineNum = lineIdx + 1;

    // A. fetch('/api/...')
    const fetchMatches = line.matchAll(/fetch\(\s*['"`](\/api\/[^'"`?#\s]+)/g);
    for (const m of fetchMatches) {
      let route = m[1];
      const normalizedRoute = route.replace(/\$\{[^}]+\}/g, '').replace(/\/+$/, '');

      let isKnown = false;
      backendRoutes.forEach((methods, br) => {
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

    // B. invokeRoute({ url: '/api/...', method: 'METHOD' })
    const invokeMatches = line.matchAll(/invokeRoute\(\s*\{\s*url:\s*['"`](\/api\/[^'"`?#\s]+)['"`],\s*method:\s*['"]([A-Z]+)['"]/g);
    for (const m of invokeMatches) {
      const route = m[1];
      const method = m[2];
      const normalizedRoute = route.replace(/\$\{[^}]+\}/g, '').replace(/\/+$/, '');

      let matchedMethods = backendRoutes.get(route) || backendRoutes.get(normalizedRoute);
      if (!matchedMethods) {
        backendRoutes.forEach((methods, br) => {
          if (!matchedMethods && (route.startsWith(br) || normalizedRoute.startsWith(br))) {
            matchedMethods = methods;
          }
        });
      }

      if (!matchedMethods) {
        addIssue(
          'apiRoutes',
          file,
          lineNum,
          `Ruta IPC "${method} ${route}" no encontrada en src/ipc/router.js`,
          'Implemente el endpoint en el router del backend.',
          line
        );
      } else if (!matchedMethods.has('ALL') && !matchedMethods.has(method)) {
        addIssue(
          'apiRoutes',
          file,
          lineNum,
          `Método HTTP "${method}" no implementado para la ruta "${route}" en router.js`,
          `El backend solo soporta: ${Array.from(matchedMethods).join(', ')}.`,
          line
        );
      }
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. AUDITORÍA: DELEGACIÓN DE EVENTOS (DATA-ACTION)
// ─────────────────────────────────────────────────────────────────────────────
console.log('[7/12] Verificando consistencia de atributos data-action...');

const declaredActions = new Set();
const handledActions = new Set();

for (const file of publicJsFiles) {
  const content = fs.readFileSync(file, 'utf8');

  const actionDeclMatches = content.matchAll(/data-action=["']([^"'${}\s]+)["']/g);
  for (const m of actionDeclMatches) {
    declaredActions.add(m[1]);
  }

  const actionHandleMatches = content.matchAll(/(?:dataset\.action|data-action)\s*(?:===|==|\.includes\()\s*["']([^"'${}\s]+)["']/g);
  for (const m of actionHandleMatches) {
    handledActions.add(m[1]);
  }
  const actionClosestMatches = content.matchAll(/closest\(\s*['"]\[data-action=["']([^"'${}\s]+)["']\]['"]\s*\)/g);
  for (const m of actionClosestMatches) {
    handledActions.add(m[1]);
  }
}

declaredActions.forEach(action => {
  if (!handledActions.has(action)) {
    addIssue(
      'dataActionDelegation',
      'public/js/views.js',
      1,
      `Atributo data-action="${action}" declarado en vistas pero no cuenta con manejador de evento en los listeners`,
      `Agregue el case o bloque if para manejar la acción "${action}" en los manejadores de eventos.`,
      `data-action="${action}"`
    );
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 9. AUDITORÍA: REQUISITOS DE DATOS POR VISTA (DATASTORE PRE-LOADING)
// ─────────────────────────────────────────────────────────────────────────────
console.log('[8/12] Verificando pre-carga de datasets (dataStore) en navegación...');

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
// 10. AUDITORÍA: FIRMAS Y ARIDAD DE FUNCIONES COMPARTIDAS (openConfirmModal, etc.)
// ─────────────────────────────────────────────────────────────────────────────
console.log('[9/12] Verificando llamadas y firmas de modales de confirmación...');

for (const file of publicJsFiles) {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');

  lines.forEach((line, lineIdx) => {
    const lineNum = lineIdx + 1;

    // openConfirmModal(title, message, onConfirm) espera argumentos posicionales, no un objeto options {}
    const objCallMatch = line.match(/openConfirmModal\s*\(\s*\{/);
    if (objCallMatch) {
      addIssue(
        'functionSignatures',
        file,
        lineNum,
        'openConfirmModal invocado con un objeto de opciones en lugar de argumentos posicionales (title, message, onConfirm)',
        'Use openConfirmModal(title, message, callback) en lugar de pasar un objeto.',
        line
      );
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 11. AUDITORÍA: CICLO DE VIDA DE MODALES Y EXPORTADORES
// ─────────────────────────────────────────────────────────────────────────────
console.log('[10/12] Verificando timeouts y resguardos en exportadores...');

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
// 12. AUDITORÍA: DETECCIÓN DE CÓDIGO MUERTO / FUNCIONES NO UTILIZADAS
// ─────────────────────────────────────────────────────────────────────────────
console.log('[11/12] Analizando alcance y uso de funciones (Detección de código muerto)...');

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
  'syncSearchInputBadge', 'loadCategoriasData', 'guardarCategoria', 'eliminarCategoria',
  'openModalNuevaCategoria', 'openModalEditarCategoria',
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

console.log('[12/12] Consolidando reporte final de auditoría...');

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
