/**
 * scripts/audits/context.js
 * Proveedor de Contexto Compartido para la Auditoría de Integridad y Seguridad.
 * 
 * Principios:
 * 1. Evaluación Perezosa (Lazy): Solo carga y procesa lo que el módulo activo solicita.
 * 2. AST Cache & Coordenadas: Acorn configurado con locations: true.
 * 3. Null-Safety Centralizado: forEachJsAst filtra internamente los ASTs nulos.
 * 4. Extracción HTML directa: Expresiones regulares simples de alta velocidad (< 5ms).
 */

const fs = require('fs');
const path = require('path');
const acorn = require('acorn');

const ROOT_DIR = process.cwd();
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const PUBLIC_JS_DIR = path.join(PUBLIC_DIR, 'js');
const SRC_DIR = path.join(ROOT_DIR, 'src');

class AuditContext {
  constructor(addIssueFn) {
    this.rootDir = ROOT_DIR;
    this.publicDir = PUBLIC_DIR;
    this.publicJsDir = PUBLIC_JS_DIR;
    this.srcDir = SRC_DIR;
    this.addIssue = addIssueFn;

    // Cachés perezosos
    this._jsFiles = null;
    this._fileContents = new Map();
    this._fileLines = new Map();
    this._astCache = new Map();
    this._htmlData = null;
    this._lucideCatalog = null;
    this._routerRoutes = null;
    this._declaredGlobals = null;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Archivos y Contenidos
  // ───────────────────────────────────────────────────────────────────────────
  getJsFiles() {
    if (this._jsFiles) return this._jsFiles;
    const files = [];
    const findJs = (dir) => {
      if (!fs.existsSync(dir)) return;
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          findJs(full);
        } else if (entry.isFile() && entry.name.endsWith('.js')) {
          files.push(full);
        }
      }
    };
    findJs(this.publicJsDir);
    this._jsFiles = files;
    return this._jsFiles;
  }

  getFileContent(filePath) {
    if (this._fileContents.has(filePath)) {
      return this._fileContents.get(filePath);
    }
    if (!fs.existsSync(filePath)) return '';
    const content = fs.readFileSync(filePath, 'utf8');
    this._fileContents.set(filePath, content);
    return content;
  }

  getFileLines(filePath) {
    if (this._fileLines.has(filePath)) {
      return this._fileLines.get(filePath);
    }
    const content = this.getFileContent(filePath);
    const lines = content.split('\n');
    this._fileLines.set(filePath, lines);
    return lines;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // AST & Parseo Seguro con Null-Safety
  // ───────────────────────────────────────────────────────────────────────────
  getJsAst(filePath) {
    if (this._astCache.has(filePath)) {
      return this._astCache.get(filePath);
    }
    const content = this.getFileContent(filePath);
    const ast = this._parseJsSafe(content, filePath);
    this._astCache.set(filePath, ast);
    return ast;
  }

  _parseJsSafe(code, filePath) {
    try {
      return acorn.parse(code, { locations: true, ecmaVersion: 2022, sourceType: 'module' });
    } catch (errMod) {
      try {
        return acorn.parse(code, { locations: true, ecmaVersion: 2022, sourceType: 'script' });
      } catch (errScript) {
        const line = errScript.loc?.line || 1;
        this.addIssue(
          'syntaxError',
          filePath,
          line,
          `Error sintáctico en archivo JavaScript: ${errScript.message}`,
          'Corrija la sintaxis para permitir el análisis del AST.',
          null,
          'error'
        );
        return null;
      }
    }
  }

  /**
   * Itera únicamente sobre archivos JavaScript cuyo AST haya sido parseado con éxito.
   * Blindaje centralizado: ningún módulo recibirá un AST null.
   */
  forEachJsAst(callback) {
    const files = this.getJsFiles();
    for (const file of files) {
      const ast = this.getJsAst(file);
      if (ast) {
        callback(ast, file, this.getFileContent(file), this.getFileLines(file));
      }
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Catálogo de Funciones Globales
  // ───────────────────────────────────────────────────────────────────────────
  getDeclaredGlobals() {
    if (this._declaredGlobals) return this._declaredGlobals;

    const globals = new Set([
      'fetch', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval',
      'encodeURIComponent', 'decodeURIComponent', 'encodeURI', 'decodeURI', 'parseInt', 'parseFloat', 'isNaN', 'isFinite',
      'requestAnimationFrame', 'cancelAnimationFrame', 'btoa', 'atob', 'structuredClone', 'queueMicrotask',
      'eval', 'String', 'Number', 'Boolean', 'Array', 'Object', 'Function', 'Symbol', 'BigInt', 'Date', 'RegExp',
      'Error', 'TypeError', 'RangeError', 'SyntaxError', 'ReferenceError', 'Promise', 'Set', 'Map', 'WeakSet', 'WeakMap',
      'Int8Array', 'Uint8Array', 'Uint8ClampedArray', 'Int16Array', 'Uint16Array', 'Int32Array', 'Uint32Array',
      'Float32Array', 'Float64Array', 'BigInt64Array', 'BigUint64Array', 'ArrayBuffer', 'DataView', 'JSON', 'Math', 'Reflect', 'Proxy',
      'URL', 'URLSearchParams', 'FormData', 'Blob', 'File', 'FileReader', 'Headers', 'Request', 'Response',
      'alert', 'confirm', 'prompt', 'escapeHtml', 'formatDate', 'formatNumber', 'showToast', 'openConfirmModal',
      'AirDatepicker', 'ApexCharts', 'html2pdf', 'lucide', 'createIcons', 'api', 'window', 'document', 'navigator', 'console',
      'getComputedStyle', 'matchMedia', 'IntersectionObserver', 'ResizeObserver', 'MutationObserver'
    ]);

    const functionDeclarations = new Map();

    for (const file of this.getJsFiles()) {
      const lines = this.getFileLines(file);
      lines.forEach((line, lineIdx) => {
        const lineNum = lineIdx + 1;
        const fnMatch = line.match(/(?:^|\s)(?:async\s+)?function\s+([a-zA-Z0-9_$]+)\s*\(/);
        if (fnMatch) {
          const name = fnMatch[1];
          globals.add(name);
          if (!functionDeclarations.has(name)) {
            functionDeclarations.set(name, { file, line: lineNum, code: line.trim() });
          }
        }

        const constFnMatch = line.match(/(?:const|let|var)\s+([a-zA-Z0-9_$]+)\s*=\s*(?:async\s+)?(?:function|\([^)]*\)\s*=>|[a-zA-Z0-9_$]+\s*=>)/);
        if (constFnMatch) {
          const name = constFnMatch[1];
          globals.add(name);
          if (!functionDeclarations.has(name)) {
            functionDeclarations.set(name, { file, line: lineNum, code: line.trim() });
          }
        }

        const winMatch = line.match(/window\.([a-zA-Z0-9_$]+)\s*=\s*(?:async\s+)?(?:function|\([^)]*\)\s*=>|[a-zA-Z0-9_$]+\s*=>|[a-zA-Z0-9_$]+)/);
        if (winMatch) {
          const name = winMatch[1];
          globals.add(name);
          if (!functionDeclarations.has(name)) {
            functionDeclarations.set(name, { file, line: lineNum, code: line.trim() });
          }
        }
      });
    }

    this._declaredGlobals = { globals, functionDeclarations };
    return this._declaredGlobals;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Datos HTML (IDs, data-action, Lucide)
  // ───────────────────────────────────────────────────────────────────────────
  getHtmlData() {
    if (this._htmlData) return this._htmlData;

    const htmlFiles = [
      path.join(this.publicDir, 'index.html'),
      path.join(this.publicDir, 'asistencia-window.html'),
      path.join(this.publicDir, 'print-template.html')
    ].filter(f => fs.existsSync(f));

    const declaredIds = new Set();
    const declaredActions = new Set();
    const lucideIconsUsed = new Set();
    const inlineEventAttrs = [];

    const idRegex = /\bid\s*=\s*["']([^"'\s>]+)["']/gi;
    const actionRegex = /\bdata-action\s*=\s*["']([^"'\s>]+)["']/gi;
    const lucideRegex = /\bdata-lucide\s*=\s*["']([^"'\s>]+)["']/gi;
    const eventRegex = /\b(onclick|onchange|oninput|onsubmit|onkeydown|onkeyup)\s*=\s*(["'])([\s\S]*?)\2/gi;

    for (const file of htmlFiles) {
      const content = this.getFileContent(file);
      const lines = this.getFileLines(file);

      lines.forEach((line, lineIdx) => {
        const lineNum = lineIdx + 1;

        let m;
        while ((m = idRegex.exec(line)) !== null) declaredIds.add(m[1]);
        while ((m = actionRegex.exec(line)) !== null) declaredActions.add(m[1]);
        while ((m = lucideRegex.exec(line)) !== null) lucideIconsUsed.add(m[1]);

        while ((m = eventRegex.exec(line)) !== null) {
          inlineEventAttrs.push({
            file,
            line: lineNum,
            event: m[1],
            code: m[3].trim(),
            rawLine: line
          });
        }
      });
    }

    this._htmlData = {
      declaredIds,
      declaredActions,
      lucideIconsUsed,
      inlineEventAttrs,
      htmlFiles
    };
    return this._htmlData;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Catálogo Oficial de Lucide
  // ───────────────────────────────────────────────────────────────────────────
  getLucideCatalog() {
    if (this._lucideCatalog) return this._lucideCatalog;

    const lucideJsPath = path.join(this.publicDir, 'vendor', 'lucide.min.js');
    const catalog = new Set();

    if (fs.existsSync(lucideJsPath)) {
      const lucideContent = this.getFileContent(lucideJsPath);
      const matches = lucideContent.matchAll(/["']([a-z0-9]+(?:-[a-z0-9]+)*)["']\s*:\s*\[/g);
      for (const m of matches) {
        catalog.add(m[1]);
      }
    }

    if (catalog.size < 50) {
      const fallbackIcons = [
        'search', 'filter', 'calendar', 'clock', 'check', 'check-circle', 'x', 'x-circle',
        'alert-circle', 'alert-triangle', 'info', 'chevron-down', 'chevron-up', 'chevron-left',
        'chevron-right', 'arrow-left', 'arrow-right', 'download', 'upload', 'file-text', 'user',
        'users', 'user-check', 'tag', 'folder', 'external-link', 'phone', 'mail', 'message-square',
        'pin', 'refresh-cw', 'eye', 'edit', 'trash', 'trash-2', 'plus', 'minus', 'settings',
        'bell', 'moon', 'sun', 'log-out', 'shield', 'shield-alert', 'database', 'activity'
      ];
      fallbackIcons.forEach(ic => catalog.add(ic));
    }

    this._lucideCatalog = catalog;
    return this._lucideCatalog;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Endpoints del Router
  // ───────────────────────────────────────────────────────────────────────────
  getRouterRoutes() {
    if (this._routerRoutes) return this._routerRoutes;

    const routerPath = path.join(this.srcDir, 'ipc', 'router.js');
    const routes = new Set();

    if (fs.existsSync(routerPath)) {
      const lines = this.getFileLines(routerPath);
      for (const line of lines) {
        const m = line.match(/(?:pathName|url|path)\s*===?\s*['"](\/api\/[^'"]+)['"]/);
        if (m) routes.add(m[1]);
        const m2 = line.match(/method\s*===?\s*['"](GET|POST|PUT|DELETE|PATCH)['"]\s*&&\s*pathName\s*===?\s*['"](\/api\/[^'"]+)['"]/);
        if (m2) routes.add(`${m2[1]} ${m2[2]}`);
      }
    }

    this._routerRoutes = routes;
    return this._routerRoutes;
  }
}

module.exports = {
  AuditContext
};
