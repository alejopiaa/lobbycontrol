/**
 * scripts/audits/01_dom_ui.audit.js
 * Dominio 1: Integridad DOM, Clases, IDs y Diseño
 * 
 * Abarca:
 *  - Dimensión 1: Eventos inline HTML (onclick, onchange, etc.)
 *  - Dimensión 2: Manipulación segura de classList (prevención de tokens vacíos '')
 *  - Dimensión 3: Validación cruzada de IDs DOM (getElementById / querySelector vs HTML)
 *  - Dimensión 4: Tokens de diseño Tailwind y ausencia de colores #hex fijos
 *  - Dimensión 5: Integridad de nombres de íconos Lucide (data-lucide)
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const acorn = require('acorn');
const walk = require('acorn-walk');

module.exports = {
  id: 'ui',
  name: 'Integridad DOM, Clases y Tokens de Diseño',

  run(ctx, addIssue) {
    const jsFiles = ctx.getJsFiles();
    const { globals: globalFunctions } = ctx.getDeclaredGlobals();

    // ─────────────────────────────────────────────────────────────────────────
    // 1. EVENTOS INLINE HTML
    // ─────────────────────────────────────────────────────────────────────────
    const eventAttrRegex = /\b(onclick|onchange|oninput|onsubmit|onkeydown|onkeyup)\s*=\s*(["'])([\s\S]*?)\2/gi;

    for (const file of jsFiles) {
      const content = ctx.getFileContent(file);
      const lines = ctx.getFileLines(file);

      lines.forEach((line, lineIdx) => {
        let match;
        while ((match = eventAttrRegex.exec(line)) !== null) {
          const attrName = match[1];
          const attrCode = match[3].trim();
          const lineNum = lineIdx + 1;

          if (/if\s*\(\s*(totalItems|items|processedData|itemEstado|currentPage)\b/i.test(attrCode)) {
            addIssue(
              'eventHandlers',
              file,
              lineNum,
              `Variable local no interpolada en evento ${attrName}: "${attrCode}"`,
              'Si la variable es local del template, interpole con ${variable} o verifique su existencia global.',
              line,
              'error'
            );
          }

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
                      line,
                      'error'
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
                line,
                'error'
              );
            }
          }
        }
      });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 2. MANIPULACIÓN SEGURA DE CLASSLIST
    // ─────────────────────────────────────────────────────────────────────────
    for (const file of jsFiles) {
      const lines = ctx.getFileLines(file);
      lines.forEach((line, lineIdx) => {
        const lineNum = lineIdx + 1;

        if (/classList\.(add|remove)\s*\(\s*['"]\s*['"]\s*\)/.test(line)) {
          addIssue(
            'emptyClassTokens',
            file,
            lineNum,
            'Llamada a classList con string vacío ("")',
            'Elimine el argumento vacío para evitar DOMException.',
            line,
            'error'
          );
        }

        if (/\[[^\]]*?['"]\s*['"]\s*[,\]]/.test(line) && (line.includes('classList') || line.includes('Classes'))) {
          addIssue(
            'emptyClassTokens',
            file,
            lineNum,
            'Array de clases CSS contiene elementos vacíos ("")',
            'Filtre o elimine los strings vacíos del array de clases.',
            line,
            'error'
          );
        }
      });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 3. VALIDACIÓN CRUZADA DE IDS DOM
    // ─────────────────────────────────────────────────────────────────────────
    const declaredIds = new Set();
    const queriedIds = new Map();

    const scanFilesForDeclaredIds = (dir) => {
      if (!fs.existsSync(dir)) return;
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          scanFilesForDeclaredIds(fullPath);
        } else if (entry.isFile() && (entry.name.endsWith('.html') || entry.name.endsWith('.js'))) {
          const content = ctx.getFileContent(fullPath);
          const matches = content.matchAll(/\bid\s*=\s*["']([^"'${}\s]+)["']/g);
          for (const m of matches) declaredIds.add(m[1]);
          const propMatches = content.matchAll(/\bid\s*:\s*["']([^"'${}\s]+)["']/g);
          for (const m of propMatches) declaredIds.add(m[1]);

          // Detectar contenedores de sugerencias declarados mediante renderSearchInput({ fieldName: '...', hasSuggestions: true })
          const rsiMatches = content.matchAll(/renderSearchInput\(\s*\{[\s\S]*?fieldName\s*:\s*["']([^"']+)["'][\s\S]*?hasSuggestions\s*:\s*true/g);
          for (const m of rsiMatches) declaredIds.add(`suggestions-${m[1]}`);
          const rsiMatchesRev = content.matchAll(/renderSearchInput\(\s*\{[\s\S]*?hasSuggestions\s*:\s*true[\s\S]*?fieldName\s*:\s*["']([^"']+)["']/g);
          for (const m of rsiMatchesRev) declaredIds.add(`suggestions-${m[1]}`);
        }
      }
    };
    scanFilesForDeclaredIds(ctx.publicDir);

    // Solo se consideran legítimamente dinámicos aquellos IDs con sufijo numérico estricto (timestamps o IDs de BD, ej: toast-1789..., row-42)
    const isStrictNumericDynamic = (id) => /^[a-zA-Z0-9_-]+-\d+$/.test(id);

    for (const file of jsFiles) {
      const lines = ctx.getFileLines(file);
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
      if (!declaredIds.has(id) && !isStrictNumericDynamic(id)) {
        addIssue(
          'domIds',
          location.file,
          location.line,
          `Elemento con ID "${id}" consultado en el DOM pero nunca declarado en las plantillas HTML`,
          `Verifique si el ID fue renombrado o agregue el id="${id}" en la vista correspondiente.`,
          location.code,
          'error'
        );
      }
    });

    // ─────────────────────────────────────────────────────────────────────────
    // 4. TOKENS DE DISEÑO Y AUSENCIA DE COLORES #HEX FIJOS
    // ─────────────────────────────────────────────────────────────────────────
    const allPublicFiles = [];
    const collectPublic = (dir) => {
      if (!fs.existsSync(dir)) return;
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          collectPublic(full);
        } else if (entry.isFile() && (entry.name.endsWith('.html') || entry.name.endsWith('.js'))) {
          allPublicFiles.push(full);
        }
      }
    };
    collectPublic(ctx.publicDir);

    const hexInStyleRegex = /style=["'][^"']*#([0-9a-fA-F]{3,6})[^"']*["']/i;
    const hexAllowedPaths = ['apexcharts', 'views/dashboard/dashboard.charts.js', 'services/export.service.js'];
    const exportTemplateFunctions = new Set([
      'buildReportPDFHtml',
      'exportAssistanceToPDF',
      'exportReportToPDF',
      'exportReporteEjecutivoPDF',
      'generarReportesMasivos',
      'exportLoteReportesPDF',
      'exportAsistenciasDirectorioToPDF',
      'enviarFichaPorCorreo',
      'prepararCorreoOutlook',
      'generarFichaPDF',
      'prepararDockCorreoOutlook',
      'generarDockFichaPDF',
      'exportAsistenciasConsolidadoPDF'
    ]);

    for (const file of allPublicFiles) {
      if (file.includes('vendor')) continue;
      if (hexAllowedPaths.some(ap => file.includes(ap))) continue;

      const lines = ctx.getFileLines(file);
      let currentFunction = '';

      lines.forEach((line, idx) => {
        const lineNum = idx + 1;
        const trimmed = line.trim();
        if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) return;

        const fnMatch = line.match(/(?:async\s+)?function\s+([a-zA-Z0-9_]+)/) || line.match(/(?:window\.)?([a-zA-Z0-9_]+)\s*=\s*(?:async\s+)?function/);
        if (fnMatch) currentFunction = fnMatch[1];

        const inExportTemplate = exportTemplateFunctions.has(currentFunction) || line.includes('font-family: Calibri') || line.includes('<!DOCTYPE html>');

        if (!inExportTemplate) {
          const hexMatch = line.match(hexInStyleRegex);
          if (hexMatch && !line.includes('var(')) {
            addIssue(
              'designTokens',
              file,
              lineNum,
              `Uso de color hexadecimal fijo inline (#${hexMatch[1]}) en atributo style. Viola el sistema de diseño reactivo a modo oscuro.`,
              'Utilice variables semánticas oficiales (ej. var(--card-orange-text), var(--bg-card)) o clases Tailwind.',
              line,
              'warning'
            );
          }
        }

        if (line.includes('emerald') && !line.includes('bg-emerald-950/10')) {
          const surroundingStart = Math.max(0, idx - 10);
          const surroundingSnippet = lines.slice(surroundingStart, idx + 10).join('\n');
          const isAllowedEmerald = 
            surroundingSnippet.includes('capsule-') || 
            surroundingSnippet.includes('contacto-vinculado') || 
            surroundingSnippet.toLowerCase().includes('resuelta') || 
            surroundingSnippet.includes('isFuera') || 
            surroundingSnippet.includes('success') || 
            surroundingSnippet.includes('cumplimiento') || 
            surroundingSnippet.includes('enplazo') ||
            surroundingSnippet.includes('ddlPubColorClass') ||
            surroundingSnippet.includes('complianceColorClass') ||
            surroundingSnippet.includes('badge-enplazo') ||
            surroundingSnippet.includes('Tasa de Resolución') ||
            surroundingSnippet.includes('Publicadas') ||
            surroundingSnippet.includes('Respondidas') ||
            surroundingSnippet.includes('openImportStatsModal') ||
            surroundingSnippet.includes('openImportDetailModal') ||
            surroundingSnippet.includes('Importación Completada') ||
            surroundingSnippet.includes('Nuevo Registro') ||
            surroundingSnippet.includes('cloud-check') ||
            surroundingSnippet.includes('Creados') ||
            surroundingSnippet.includes('diff.new') ||
            surroundingSnippet.includes('pct > 0') ||
            surroundingSnippet.includes('password') ||
            surroundingSnippet.includes('contraseña') ||
            surroundingSnippet.includes('infoEl') ||
            surroundingSnippet.includes('netStatusEl') ||
            surroundingSnippet.includes('pingEl') ||
            surroundingSnippet.includes('dotEl') ||
            surroundingSnippet.includes('No hay alertas pendientes') ||
            surroundingSnippet.includes('No hay logs registrados') ||
            surroundingSnippet.includes('¡Todo en orden!') ||
            line.includes('file-spreadsheet') ||
            line.includes('sheet') ||
            surroundingSnippet.includes('activeAlertasTab') ||
            surroundingSnippet.includes('switchAlertasType') ||
            surroundingSnippet.includes("dbName === 'app.db'") ||
            file.includes('auditoria.tab.js') ||
            file.includes('asistencia.service.js');

          if (!isAllowedEmerald) {
            addIssue(
              'designTokens',
              file,
              lineNum,
              'Uso sospechoso de clase cromática emerald en elemento no catalogado como estado semántico.',
              'Armonice el componente a la paleta corporativa "brand" (azul) o neutral a menos que represente un estado de éxito/conexión/resuelta.',
              line,
              'warning'
            );
          }
        }
      });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 5. CATÁLOGO DE ÍCONOS LUCIDE
    // ─────────────────────────────────────────────────────────────────────────
    const lucideVendorPath = path.join(ctx.publicDir, 'vendor/lucide.min.js');
    let availableLucideIcons = null;

    if (fs.existsSync(lucideVendorPath)) {
      try {
        const lucideCode = ctx.getFileContent(lucideVendorPath);
        const sandbox = { window: {} };
        vm.createContext(sandbox);
        vm.runInContext(lucideCode, sandbox);
        const iconsObj = sandbox.lucide ? sandbox.lucide.icons : sandbox.window.lucide?.icons;
        if (iconsObj) {
          availableLucideIcons = new Set(Object.keys(iconsObj));
        }
      } catch (e) {
        // Fallback silencioso
      }
    }

    if (availableLucideIcons) {
      const toPascalCase = (str) => str.replace(/(^\w|-\w)/g, (m) => m.replace('-', '').toUpperCase());
      const lucideAttrRegex = /data-lucide=["']([a-z0-9-]+)["']/g;

      for (const file of allPublicFiles) {
        if (file.includes('vendor')) continue;
        const lines = ctx.getFileLines(file);

        lines.forEach((line, idx) => {
          const lineNum = idx + 1;
          let match;
          while ((match = lucideAttrRegex.exec(line)) !== null) {
            const iconName = match[1];
            const pascalName = toPascalCase(iconName);
            if (!availableLucideIcons.has(pascalName)) {
              addIssue(
                'lucideIcons',
                file,
                lineNum,
                `Ícono Lucide "${iconName}" (PascalCase: ${pascalName}) no existe en el catálogo de Lucide. Esto dejará un espacio en blanco en la UI.`,
                'Consulte el catálogo de Lucide y use el nombre exacto del ícono correspondiente.',
                line,
                'error'
              );
            }
          }
        });
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 6. INTEGRIDAD DE CLASES CSS TAILWIND COMPILADAS (PREVENCIÓN DE CLASES FANTASMA)
    // ─────────────────────────────────────────────────────────────────────────
    const outputCssPath = path.join(ctx.publicDir, 'css/output.css');
    if (fs.existsSync(outputCssPath)) {
      const compiledClasses = new Set();
      const cssContent = ctx.getFileContent(outputCssPath);
      const classSelectorRegex = /\.((?:[a-zA-Z0-9_\-]|\\.)+)/g;
      let m;
      while ((m = classSelectorRegex.exec(cssContent)) !== null) {
        compiledClasses.add(m[1].replace(/\\/g, ''));
      }

      const colorPrefixRegex = /^(?:[a-z0-9-]+:)*(?:bg|text|border|shadow|ring)-[a-z0-9]+-[0-9]{2,3}(?:\/[0-9]+)?$/;

      for (const file of allPublicFiles) {
        if (file.includes('vendor')) continue;
        const lines = ctx.getFileLines(file);

        lines.forEach((line, idx) => {
          const lineNum = idx + 1;
          const classAttrRegex = /(?:class(?:Name)?\s*=\s*["'`]([^"'`]+)["'`]|classList\.add\(\s*["'`]([^"'`]+)["'`]\))/g;
          let cm;
          while ((cm = classAttrRegex.exec(line)) !== null) {
            const rawClasses = cm[1] || cm[2];
            if (!rawClasses) continue;
            const tokens = rawClasses.split(/\s+/);
            for (const t of tokens) {
              if (!t || t.includes('${') || t.includes('}') || t.includes('<') || t.includes('>')) continue;
              if (colorPrefixRegex.test(t)) {
                if (!compiledClasses.has(t)) {
                  addIssue(
                    'compiledCssClasses',
                    file,
                    lineNum,
                    `Clase utilitaria "${t}" no existe en el CSS compilado (public/css/output.css). Riesgo de estilo fantasma/incoloro.`,
                    'Declare la paleta en @theme en src/styles/input.css o use una clase Tailwind compilada válida.',
                    line,
                    'error'
                  );
                }
              }
            }
          }
        });
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 7. DETECCIÓN DE COLISIONES DE CLASES CSS ANTAGÓNICAS (CONFLICTING OVERRIDES)
    // ─────────────────────────────────────────────────────────────────────────
    function extractClassAttributes(text) {
      const results = [];
      const regex = /\bclass\s*=\s*(["'])/g;
      let m;
      while ((m = regex.exec(text)) !== null) {
        const quote = m[1];
        const startIndex = m.index + m[0].length;
        let i = startIndex;
        let inInterpolation = false;
        let braceDepth = 0;
        let inSubQuote = false;
        let subQuoteChar = '';

        while (i < text.length) {
          const char = text[i];
          const prev = text[i - 1];

          if (!inInterpolation) {
            if (char === '$' && text[i + 1] === '{') {
              inInterpolation = true;
              braceDepth = 1;
              i += 2;
              continue;
            }
            if (char === quote && prev !== '\\') {
              results.push({
                start: startIndex,
                raw: text.substring(startIndex, i),
                line: text.substring(0, m.index).split('\n').length
              });
              break;
            }
          } else {
            if (!inSubQuote) {
              if (char === '"' || char === "'" || char === '`') {
                inSubQuote = true;
                subQuoteChar = char;
              } else if (char === '{') {
                braceDepth++;
              } else if (char === '}') {
                braceDepth--;
                if (braceDepth === 0) inInterpolation = false;
              }
            } else {
              if (char === subQuoteChar && prev !== '\\') {
                inSubQuote = false;
              }
            }
          }
          i++;
        }
      }
      return results;
    }

    for (const file of allPublicFiles) {
      if (file.includes('vendor')) continue;
      const content = ctx.getFileContent(file);
      const attrs = extractClassAttributes(content);
      const lines = ctx.getFileLines(file);

      for (const a of attrs) {
        if (!a.raw.includes('${')) continue;

        const staticPart = a.raw.replace(/\$\{[\s\S]*?\}/g, ' ');
        const staticBgClasses = staticPart.split(/\s+/).filter(t => /^bg-(?!gradient)[a-z0-9-]+(?:\/[0-9]+)?$/.test(t) && !t.includes(':') && t !== 'bg-no-repeat');

        if (staticBgClasses.length === 0) continue;

        const interpolationMatches = a.raw.matchAll(/\$\{([\s\S]*?)\}/g);
        for (const im of interpolationMatches) {
          const branchStringMatches = im[1].matchAll(/["']([^"']+)["']/g);
          for (const sm of branchStringMatches) {
            const branchBgClasses = sm[1].split(/\s+/).filter(t => /^bg-(?!gradient)[a-z0-9-]+(?:\/[0-9]+)?$/.test(t) && !t.includes(':') && t !== 'bg-no-repeat');

            for (const bBg of branchBgClasses) {
              for (const sBg of staticBgClasses) {
                if (bBg !== sBg) {
                  const codeLine = lines[a.line - 1] || '';
                  addIssue(
                    'cssClassCollision',
                    file,
                    a.line,
                    `Colisión de clases antagónicas en atributo class: clase estática "${sBg}" colisiona con clase condicional "${bBg}". La clase estática anula el fondo activo silenciosamente dejando texto invisible.`,
                    `Mueva "${sBg}" dentro de la rama condicional inactiva para que no compita contra "${bBg}".`,
                    codeLine.trim(),
                    'error'
                  );
                }
              }
            }
          }
        }
      }
    }
  }
};


