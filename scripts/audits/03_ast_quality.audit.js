/**
 * scripts/audits/03_ast_quality.audit.js
 * Dominio 3: Calidad de Código y AST
 * 
 * Abarca:
 *  - Dimensión 13: Invocaciones JS -> JS (detección de funciones no declaradas con AST)
 *  - Dimensión 14: Detección de código muerto (funciones declaradas no utilizadas)
 *  - Dimensión 15: Bloqueo estricto de diálogos nativos (alert, confirm, prompt)
 */

const fs = require('fs');
const path = require('path');
const walk = require('acorn-walk');

module.exports = {
  id: 'ast',
  name: 'Calidad de Código, AST y Diálogos',

  run(ctx, addIssue) {
    const { globals: globalFunctions, functionDeclarations } = ctx.getDeclaredGlobals();

    // ─────────────────────────────────────────────────────────────────────────
    // 13. RESOLUCIÓN ESTÁTICA DE INVOCACIONES JS -> JS (CON AST Y LOCATIONS)
    // ─────────────────────────────────────────────────────────────────────────
    ctx.forEachJsAst((ast, file, content, lines) => {
      walk.ancestor(ast, {
        CallExpression(node, ancestors) {
          if (node.callee.type === 'Identifier') {
            const fnName = node.callee.name;
            if (['if', 'for', 'while', 'switch', 'catch', 'function', 'return', 'typeof', 'delete', 'import', 'export', 'super', 'new', 'void', 'throw'].includes(fnName)) return;

            // Verificar si el identificador está en el ámbito local
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
              const lineNum = node.loc?.start?.line || 1;
              addIssue(
                'undefinedFunctions',
                file,
                lineNum,
                `Invocación a función no declarada "${fnName}()" en el flujo JavaScript`,
                'Verifique si la función fue renombrada, tiene un error tipográfico o requiere ser declarada/importada.',
                lines[lineNum - 1],
                'error'
              );
            }
          }
        }
      });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // 14. DETECCIÓN DE CÓDIGO MUERTO / FUNCIONES DECLARADAS NO UTILIZADAS
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

    functionDeclarations.forEach((meta, fnName) => {
      if (coreLifecycleSet.has(fnName)) return;
      if (fnName.startsWith('render') || fnName.startsWith('get') || fnName.startsWith('format') || fnName.startsWith('build')) return;

      let activeUsageCount = 0;
      const usageRegex = new RegExp(`\\b${fnName}\\b`, 'g');

      for (const file of allPublicFiles) {
        const lines = ctx.getFileLines(file);
        for (let idx = 0; idx < lines.length; idx++) {
          const lineNum = idx + 1;
          const line = lines[idx];

          if (file === meta.file && lineNum === meta.line) continue;
          if (line.includes(`window.${fnName} = ${fnName}`) || line.includes(`window.${fnName} = function`) || line.includes(`window.${fnName} = async function`)) {
            continue;
          }

          if (usageRegex.test(line)) {
            activeUsageCount++;
          }
        }
      }

      if (activeUsageCount === 0) {
        addIssue(
          'unusedFunctions',
          meta.file,
          meta.line,
          `Función "${fnName}()" declarada pero no cuenta con llamadas en ninguna vista ni flujo activo`,
          'Si esta función ya no es requerida por la aplicación, elimínela para evitar código muerto.',
          meta.code,
          'warning'
        );
      }
    });

    // ─────────────────────────────────────────────────────────────────────────
    // 15. PROHIBICIÓN ESTRICTA DE DIÁLOGOS NATIVOS (alert, confirm, prompt)
    // ─────────────────────────────────────────────────────────────────────────
    const nativeDialogRegex = /\b(?:window\.)?(alert|confirm|prompt)\s*\(/;

    for (const file of allPublicFiles) {
      if (file.includes('vendor')) continue;
      const lines = ctx.getFileLines(file);

      lines.forEach((line, idx) => {
        const lineNum = idx + 1;
        const trimmed = line.trim();
        if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) return;

        const match = line.match(nativeDialogRegex);
        if (match) {
          const dialogMethod = match[1];
          addIssue(
            'nativeDialogs',
            file,
            lineNum,
            `Invocación a método nativo bloqueante "${dialogMethod}()" detectada. Está estrictamente prohibido usar diálogos del sistema operativo en la interfaz.`,
            `Sustituya "${dialogMethod}()" por "openConfirmModal(title, message, onConfirm)" o notificaciones "showToast()".`,
            line,
            'error'
          );
        }
      });
    }
  }
};
