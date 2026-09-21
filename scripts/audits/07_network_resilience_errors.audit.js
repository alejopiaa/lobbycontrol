/**
 * scripts/audits/07_network_resilience_errors.audit.js
 * Dominio 7: Resiliencia de Red y Manejo de Errores
 * 
 * Abarca:
 *  - Dimensión 19.1: Promesas y llamadas asíncronas desprotegidas (fetch, invokeRoute, queries) sin try/catch ni .catch()
 *  - Dimensión 19.2: Bloques catch vacíos o silenciosos que enmascaran fallos sin feedback al usuario (showToast)
 */

const walk = require('acorn-walk');

module.exports = {
  id: 'resilience',
  name: 'Resiliencia de Red y Manejo de Errores',

  run(ctx, addIssue) {
    // ─────────────────────────────────────────────────────────────────────────
    // 19.1 LLAMADAS ASÍNCRONAS SIN PROTECCIÓN TRY/CATCH O .CATCH()
    // ─────────────────────────────────────────────────────────────────────────
    ctx.forEachJsAst((ast, file, content, lines) => {
      walk.ancestor(ast, {
        CallExpression(node, ancestors) {
          const callee = node.callee;
          let isAsyncNetworkOrDb = false;
          let opName = '';

          // 1. fetch(...)
          if (callee.type === 'Identifier' && callee.name === 'fetch') {
            isAsyncNetworkOrDb = true;
            opName = 'fetch()';
          }
          // 2. invokeRoute(...)
          else if (callee.type === 'Identifier' && (callee.name === 'invokeRoute' || callee.name === 'apiClient')) {
            isAsyncNetworkOrDb = true;
            opName = `${callee.name}()`;
          }
          // 3. window.api.invoke(...) o api.invoke(...)
          else if (callee.type === 'MemberExpression' && callee.property && callee.property.name === 'invoke') {
            isAsyncNetworkOrDb = true;
            opName = 'api.invoke()';
          }

          if (isAsyncNetworkOrDb) {
            // Verificar si la llamada está encadenada a un .catch(...)
            const parent = ancestors[ancestors.length - 2];
            let hasChainedCatch = false;
            if (parent && parent.type === 'MemberExpression' && parent.property && parent.property.name === 'then') {
              const grandParent = ancestors[ancestors.length - 3];
              if (grandParent && grandParent.type === 'CallExpression') {
                const greatGrand = ancestors[ancestors.length - 4];
                if (greatGrand && greatGrand.type === 'MemberExpression' && greatGrand.property && greatGrand.property.name === 'catch') {
                  hasChainedCatch = true;
                }
              }
            } else if (parent && parent.type === 'MemberExpression' && parent.property && parent.property.name === 'catch') {
              hasChainedCatch = true;
            }

            // Verificar si está dentro del bloque try de un TryStatement
            let isInsideTryBlock = false;
            for (let i = ancestors.length - 1; i >= 0; i--) {
              const anc = ancestors[i];
              if (anc.type === 'TryStatement') {
                // Comprobar que el nodo hijo esté en anc.block (el bloque try)
                const childOfTry = ancestors[i + 1];
                if (childOfTry === anc.block) {
                  isInsideTryBlock = true;
                  break;
                }
              }
            }

            if (!hasChainedCatch && !isInsideTryBlock) {
              const lineNum = node.loc?.start?.line || 1;
              const lineCode = lines[lineNum - 1] || '';
              // No reportar si es en capas de servicios/librerías que retornan promesas para que las capture la vista
              const isServiceLayer = file.includes('services') && !file.includes('view');
              if (!file.includes('test') && !file.includes('mock') && !isServiceLayer) {
                addIssue(
                  'unhandledAsyncCall',
                  file,
                  lineNum,
                  `Llamada asíncrona a ${opName} sin envoltorio try/catch ni encadenamiento .catch() defensivo.`,
                  `Envuelva la operación asíncrona dentro de un bloque "try { await ... } catch (err) { ... }" o encadene ".catch(err => ...)" para garantizar resiliencia.`,
                  lineCode.trim(),
                  'warning'
                );
              }
            }
          }
        },

        // ─────────────────────────────────────────────────────────────────────
        // 19.2 BLOQUES CATCH VACÍOS O SILENCIOSOS (SILENT CATCHES)
        // ─────────────────────────────────────────────────────────────────────
        CatchClause(node) {
          const body = node.body;
          const lineNum = node.loc?.start?.line || 1;
          const lineCode = lines[lineNum - 1] || '';

          // Verificar si el try anterior era una operación de limpieza/teardown (.destroy, .remove, .abort)
          const surroundingBefore = lines.slice(Math.max(0, lineNum - 5), lineNum).join('\n');
          const isTeardown = /\b(destroy|remove|disconnect|abort|cancel|cleanup|dispose)\s*\(/.test(surroundingBefore);
          
          // Verificar si inmediatamente después del catch hay feedback (ej. showToast posterior a fallbacks)
          const surroundingAfter = lines.slice(lineNum, Math.min(lines.length, lineNum + 5)).join('\n');
          const hasSubsequentFeedback = /\b(showToast|console\.error|console\.warn)\b/.test(surroundingAfter);

          // Verificar si el try anterior era una asignación de compatibilidad global
          const isLegacyGlobalSync = /try\s*\{\s*[a-zA-Z0-9_$]+\s*=\s*[a-zA-Z0-9_$]+;?\s*\}\s*catch/.test(lineCode) ||
                                     /try\s*\{\s*[a-zA-Z0-9_$]+\s*=\s*[a-zA-Z0-9_$]+;?\s*\}\s*catch/.test(surroundingBefore);

          if (isTeardown || hasSubsequentFeedback || isLegacyGlobalSync) {
            return; // Patrón defensivo legítimo
          }

          if (body.type === 'BlockStatement') {
            // Caso A: Totalmente vacío
            if (body.body.length === 0) {
              addIssue(
                'silentCatch',
                file,
                lineNum,
                'Bloque catch vacío detectado. Enmascara errores sin registrar ni notificar al usuario.',
                'Al menos registre el error con console.error(err) o muestre una notificación con showToast(...) si impacta al usuario.',
                lineCode.trim(),
                'error'
              );
            } else {
              // Caso B: Solo contiene return vacío o declaraciones inocuas sin log ni feedback
              let hasLoggingOrFeedback = false;
              walk.simple(body, {
                CallExpression(callNode) {
                  const c = callNode.callee;
                  if (c.type === 'MemberExpression' && c.object && c.object.name === 'console') {
                    hasLoggingOrFeedback = true;
                  } else if (c.type === 'Identifier' && ['showToast', 'translateError', 'openConfirmModal', 'notify', 'logError'].includes(c.name)) {
                    hasLoggingOrFeedback = true;
                  }
                },
                ThrowStatement() {
                  hasLoggingOrFeedback = true; // Re-lanzar es válido
                }
              });

              // Si el cuerpo solo tiene 1 o 2 sentencias y carece de log o toast
              if (!hasLoggingOrFeedback && body.body.length <= 2) {
                const isSilentFallback = content.slice(node.start, node.end).includes('fallback');
                if (!isSilentFallback) {
                  addIssue(
                    'silentCatch',
                    file,
                    lineNum,
                    'Bloque catch silencioso sin registro (console.error) ni feedback visual (showToast).',
                    'Asegure registrar el fallo o brindar retroalimentación para evitar congelamientos silenciosos de la interfaz.',
                    lineCode.trim(),
                    'warning'
                  );
                }
              }
            }
          }
        }
      });
    });
  }
};
