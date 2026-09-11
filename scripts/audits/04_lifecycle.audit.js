/**
 * scripts/audits/04_lifecycle.audit.js
 * Dominio 4: Ciclo de Vida y Autenticación
 * 
 * Abarca:
 *  - Dimensión 16: Prevención de fugas de memoria en listeners IPC (api.on* en loops)
 *  - Dimensión 17: Ciclo de vida de autenticación y carga perezosa de rutas protegidas (evitar 401 en arranque)
 */

const fs = require('fs');
const walk = require('acorn-walk');

module.exports = {
  id: 'lifecycle',
  name: 'Ciclo de Vida, Listeners y Autenticación',

  run(ctx, addIssue) {
    // ─────────────────────────────────────────────────────────────────────────
    // 16. PREVENCIÓN DE FUGAS DE MEMORIA EN LISTENERS IPC (CON AST)
    // ─────────────────────────────────────────────────────────────────────────
    ctx.forEachJsAst((ast, file, content, lines) => {
      walk.ancestor(ast, {
        CallExpression(node, ancestors) {
          const callee = node.callee;
          let isIpcListener = false;
          if (callee.type === 'MemberExpression' && callee.property && callee.property.name && callee.property.name.startsWith('on')) {
            if (
              (callee.object.name === 'api') || 
              (callee.object.property && callee.object.property.name === 'api')
            ) {
              isIpcListener = true;
            }
          }

          if (isIpcListener) {
            // Buscar si está anidado dentro de una función de renderizado
            const renderAncestor = ancestors.find(a => {
              if ((a.type === 'FunctionDeclaration' || a.type === 'FunctionExpression') && a.id && a.id.name) {
                return a.id.name.startsWith('render') || a.id.name.startsWith('switchView');
              }
              return false;
            });

            if (renderAncestor) {
              const lineNum = node.loc?.start?.line || 1;
              addIssue(
                'ipcListeners',
                file,
                lineNum,
                `Registro de escucha IPC "${callee.property.name}" dentro de función cíclica de renderizado "${renderAncestor.id.name}()". Provoca duplicación acumulativa de eventos en cada navegación.`,
                'Mueva la escucha a "DOMContentLoaded" global o desuscriba el listener antes de volver a renderizar.',
                lines[lineNum - 1],
                'error'
              );
            }
          }
        }
      });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // 17. GATING DE AUTENTICACIÓN Y CARGA PEREZOSA (401 EN ARRANQUE)
    // ─────────────────────────────────────────────────────────────────────────
    const publicRoutesSet = new Set([
      '/api/auth/sso',
      '/api/auth/trigger-sso',
      '/api/auth/status',
      '/api/auth/me',
      '/api/db-last-update',
      '/api/app-version'
    ]);

    const jsFiles = ctx.getJsFiles();

    for (const file of jsFiles) {
      if (file.includes('vendor')) continue;

      const content = ctx.getFileContent(file);
      const lines = ctx.getFileLines(file);

      lines.forEach((line, lineIdx) => {
        const lineNum = lineIdx + 1;
        const trimmed = line.trim();
        if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) return;

        const routeMatch = line.match(/(?:invokeRoute\(\s*\{\s*url:\s*|fetch\(\s*)['"`](\/api\/[^'"`?#\s]+)/);
        if (routeMatch) {
          const routeUrl = routeMatch[1];
          const isProtected = !publicRoutesSet.has(routeUrl);

          if (isProtected) {
            const surroundingStart = Math.max(0, lineIdx - 15);
            const surroundingSnippet = lines.slice(surroundingStart, lineIdx + 1).join('\n');

            const inStartup = surroundingSnippet.includes('DOMContentLoaded');
            const hasDefensiveReload = 
              content.includes('loadDockCatalogs') || 
              content.includes('loadDirecciones') || 
              content.includes('openAssistanceDock') ||
              content.includes('checkAuth') ||
              content.includes('openAssistanceWindow');

            if (inStartup && !surroundingSnippet.includes('checkAuth') && !hasDefensiveReload) {
              addIssue(
                'authLifecycleGating',
                file,
                lineNum,
                `Invocación a ruta protegida "${routeUrl}" en arranque ("DOMContentLoaded") sin resguardo de autenticación ni recarga perezosa. Fallará con 401 si el usuario no ha iniciado sesión.`,
                'Condicione la llamada al inicio de sesión o implemente hidratación reactiva al abrir el componente.',
                line,
                'error'
              );
            }
          }
        }
      });
    }
  }
};
