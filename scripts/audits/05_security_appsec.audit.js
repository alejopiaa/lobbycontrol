/**
 * scripts/audits/05_security_appsec.audit.js
 * Dominio 5: Seguridad y Vulnerabilidades (AppSec)
 * 
 * Abarca la Dimensión 18:
 *  - 18.1: Inyección SQL (SQLi) y parametrización en SQLite
 *  - 18.2: Prevención de DOM XSS en .innerHTML y bloqueo de eval()
 *  - 18.3: Aislamiento del proceso renderizador en Electron (main.js y preload.js)
 *  - 18.4: Prevención de Salto de Directorio (Path Traversal)
 */

const fs = require('fs');
const path = require('path');
const acorn = require('acorn');
const walk = require('acorn-walk');

module.exports = {
  id: 'security',
  name: 'Seguridad y Vulnerabilidades (AppSec)',

  run(ctx, addIssue) {
    // ─────────────────────────────────────────────────────────────────────────
    // 18.1 INYECCIÓN SQL (SQLi) Y PARAMETRIZACIÓN
    // ─────────────────────────────────────────────────────────────────────────
    const dbTargetFiles = [
      path.join(ctx.srcDir, 'ipc/router.js'),
      path.join(ctx.srcDir, 'config/database.js'),
      path.join(ctx.srcDir, 'ipc/handlers.js')
    ].filter(f => fs.existsSync(f));

    const dbMethodNames = new Set(['all', 'run', 'get', 'each', 'exec']);

    for (const filePath of dbTargetFiles) {
      const content = ctx.getFileContent(filePath);
      const lines = ctx.getFileLines(filePath);

      let ast = null;
      try {
        ast = acorn.parse(content, { locations: true, ecmaVersion: 2022, sourceType: 'script' });
      } catch (e) {
        try {
          ast = acorn.parse(content, { locations: true, ecmaVersion: 2022, sourceType: 'module' });
        } catch (e2) {
          // Si no parsea, el context ya lo reportó
        }
      }

      if (ast) {
        walk.simple(ast, {
          CallExpression(node) {
            const callee = node.callee;
            let isDbCall = false;

            if (callee.type === 'MemberExpression' && callee.property && dbMethodNames.has(callee.property.name)) {
              const objName = callee.object.name || (callee.object.property && callee.object.property.name);
              if (objName && (objName.includes('db') || objName.includes('Db') || objName === 'database')) {
                isDbCall = true;
              }
            }

            if (isDbCall && node.arguments.length > 0) {
              const sqlArg = node.arguments[0];

              // Si es un TemplateLiteral (interpolación `${...}`)
              if (sqlArg.type === 'TemplateLiteral') {
                const expressions = sqlArg.expressions || [];
                const rawStrings = (sqlArg.quasis || []).map(q => q.value.raw);

                expressions.forEach((expr, idx) => {
                  const surroundingSql = (rawStrings[idx] || '') + ' ' + (rawStrings[idx + 1] || '');
                  const isWhereOrValue = /\b(WHERE|VALUES|AND|OR|SET|LIKE)\b/i.test(surroundingSql);
                  const isClauseJoin = expr.type === 'CallExpression' && expr.callee.property && expr.callee.property.name === 'join';
                  const isClauseVar = expr.type === 'Identifier' && (expr.name.endsWith('Where') || expr.name.endsWith('Clause') || expr.name.endsWith('Sql'));

                  if (isWhereOrValue && !isClauseJoin && !isClauseVar) {
                    const lineNum = expr.loc?.start?.line || sqlArg.loc.start.line;
                    addIssue(
                      'sqlInjection',
                      filePath,
                      lineNum,
                      'Interpolación directa de expresión JavaScript dentro de cláusula condicional SQL. Riesgo crítico de Inyección SQL.',
                      'Utilice marcadores de parámetros parametrizados ("?") y pase los valores en el array de parámetros de SQLite.',
                      lines[lineNum - 1],
                      'error'
                    );
                  }
                });
              }

              // Si es una concatenación binaria con "+"
              if (sqlArg.type === 'BinaryExpression' && sqlArg.operator === '+') {
                const lineNum = sqlArg.loc?.start?.line || 1;
                const snippet = lines[lineNum - 1] || '';
                if (/\b(WHERE|VALUES|LIKE)\b/i.test(snippet)) {
                  addIssue(
                    'sqlInjection',
                    filePath,
                    lineNum,
                    'Concatenación de cadenas con "+" en consulta SQL. Riesgo de Inyección SQL.',
                    'Parametrice la consulta con marcadores "?" en lugar de concatenar texto dinámico.',
                    snippet,
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
    // 18.2 PREVENCIÓN DE DOM XSS EN .innerHTML Y EVAL()
    // ─────────────────────────────────────────────────────────────────────────
    ctx.forEachJsAst((ast, file, content, lines) => {
      walk.simple(ast, {
        AssignmentExpression(node) {
          const left = node.left;
          if (left.type === 'MemberExpression' && left.property && left.property.name === 'innerHTML') {
            const right = node.right;

            // Literales puros estáticos son seguros (ej: el.innerHTML = '<div class="spin"></div>')
            if (right.type === 'Literal') return;

            // Template literals con variables
            if (right.type === 'TemplateLiteral') {
              const expressions = right.expressions || [];
              expressions.forEach(expr => {
                // Verificar si es un identificador crudo no envuelto en función de escape
                let isRawData = false;
                let exprSnippet = content.slice(expr.start, expr.end);

                if (expr.type === 'Identifier' || expr.type === 'MemberExpression') {
                  // Propiedades típicas de registros sin sanitizar
                  if (/^(?:item|row|solicitud|contacto|asistencia|cat|user|draft)\.[a-zA-Z0-9_$]+/i.test(exprSnippet)) {
                    isRawData = true;
                  }
                }

                // Si llama a una función de escape conocida, es seguro
                const isEscaped = 
                  expr.type === 'CallExpression' && 
                  expr.callee && 
                  ['escapeHtml', 'esc', 'formatDate', 'formatNumber'].includes(expr.callee.name);

                if (isRawData && !isEscaped) {
                  const lineNum = expr.loc?.start?.line || node.loc.start.line;
                  addIssue(
                    'domXss',
                    file,
                    lineNum,
                    `Interpolación de datos crudos "${exprSnippet}" en innerHTML sin función de sanitización (escapeHtml). Riesgo de Cross-Site Scripting (XSS).`,
                    `Envuelva la variable en "escapeHtml(${exprSnippet})" para neutralizar caracteres HTML maliciosos.`,
                    lines[lineNum - 1],
                    'error'
                  );
                }
              });
            }
          }
        },

        CallExpression(node) {
          if (node.callee.type === 'Identifier' && node.callee.name === 'eval') {
            const lineNum = node.loc?.start?.line || 1;
            addIssue(
              'domXss',
              file,
              lineNum,
              'Uso de "eval()" detectado en el código frontend. Viola la directiva CSP y abre vulnerabilidades de ejecución arbitraria.',
              'Elimine el uso de eval() y utilice deserialización JSON segura o lógica nativa.',
              lines[lineNum - 1],
              'error'
            );
          }
        },

        NewExpression(node) {
          if (node.callee.type === 'Identifier' && node.callee.name === 'Function') {
            const lineNum = node.loc?.start?.line || 1;
            addIssue(
              'domXss',
              file,
              lineNum,
              'Constructor "new Function()" detectado. Es equivalente a eval() y representa riesgo de inyección de código.',
              'Reemplace la construcción dinámica de funciones por funciones declarativas estándar.',
              lines[lineNum - 1],
              'error'
            );
          }
        }
      });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // 18.3 AISLAMIENTO DE ELECTRON (main.js y preload.js)
    // ─────────────────────────────────────────────────────────────────────────
    const mainJsPath = path.join(ctx.rootDir, 'main.js');
    if (fs.existsSync(mainJsPath)) {
      const mainContent = ctx.getFileContent(mainJsPath);
      const mainLines = ctx.getFileLines(mainJsPath);

      // A. Verificar contextIsolation: true y nodeIntegration: false
      let mainAst = null;
      try {
        mainAst = acorn.parse(mainContent, { locations: true, ecmaVersion: 2022, sourceType: 'script' });
      } catch (e) {
        // Fallback
      }

      if (mainAst) {
        walk.simple(mainAst, {
          NewExpression(node) {
            if (node.callee.name === 'BrowserWindow' && node.arguments.length > 0) {
              const opts = node.arguments[0];
              if (opts.type === 'ObjectExpression') {
                const webPrefProp = opts.properties.find(p => p.key && p.key.name === 'webPreferences');
                if (webPrefProp && webPrefProp.value.type === 'ObjectExpression') {
                  const prefs = webPrefProp.value.properties;

                  const nodeIntegProp = prefs.find(p => p.key && p.key.name === 'nodeIntegration');
                  if (nodeIntegProp && nodeIntegProp.value.value === true) {
                    addIssue(
                      'electronSecurity',
                      mainJsPath,
                      nodeIntegProp.loc.start.line,
                      'nodeIntegration: true en BrowserWindow. Permite a la interfaz acceder a APIs nativas de NodeJS del sistema operativo.',
                      'Configure siempre "nodeIntegration: false" para aislar el proceso renderizador.',
                      mainLines[nodeIntegProp.loc.start.line - 1],
                      'error'
                    );
                  }

                  const contextIsoProp = prefs.find(p => p.key && p.key.name === 'contextIsolation');
                  if (!contextIsoProp || contextIsoProp.value.value === false) {
                    addIssue(
                      'electronSecurity',
                      mainJsPath,
                      webPrefProp.loc.start.line,
                      'contextIsolation ausente o false en BrowserWindow. Invalida la separación entre renderer y preload.',
                      'Configure siempre "contextIsolation: true".',
                      mainLines[webPrefProp.loc.start.line - 1],
                      'error'
                    );
                  }
                }
              }
            }
          }
        });
      }

      // B. Verificar ausencia de @electron/remote
      if (mainContent.includes('@electron/remote')) {
        addIssue(
          'electronSecurity',
          mainJsPath,
          1,
          'Módulo desaconsejado "@electron/remote" detectado en el proceso principal.',
          'Elimine el uso de @electron/remote y comunique a través de contextBridge e IPC bidireccional seguro.',
          '@electron/remote',
          'error'
        );
      }
    }

    // C. Verificar preload.js: no exponer ipcRenderer crudo
    const preloadJsPath = path.join(ctx.rootDir, 'preload.js');
    if (fs.existsSync(preloadJsPath)) {
      const preloadContent = ctx.getFileContent(preloadJsPath);
      const preloadLines = ctx.getFileLines(preloadJsPath);

      let preloadAst = null;
      try {
        preloadAst = acorn.parse(preloadContent, { locations: true, ecmaVersion: 2022, sourceType: 'script' });
      } catch (e) {}

      if (preloadAst) {
        walk.simple(preloadAst, {
          CallExpression(node) {
            if (
              node.callee.type === 'MemberExpression' &&
              node.callee.object.name === 'contextBridge' &&
              node.callee.property.name === 'exposeInMainWorld'
            ) {
              // Si el segundo argumento es un objeto
              if (node.arguments.length > 1 && node.arguments[1].type === 'ObjectExpression') {
                const apiProps = node.arguments[1].properties;
                apiProps.forEach(prop => {
                  if (
                    prop.value &&
                    (prop.value.name === 'ipcRenderer' || 
                     (prop.key && (prop.key.name === 'ipcRenderer' || prop.key.value === 'ipcRenderer')))
                  ) {
                    addIssue(
                      'electronSecurity',
                      preloadJsPath,
                      prop.loc.start.line,
                      'Exposición directa de "ipcRenderer" a través de contextBridge. Permite al frontend enviar o escuchar canales IPC arbitrarios sin restricción.',
                      'Exponga únicamente métodos invocadores específicos con canales validados (ej. invokeRoute).',
                      preloadLines[prop.loc.start.line - 1],
                      'error'
                    );
                  }
                });
              }
            }
          }
        });
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 18.4 PREVENCIÓN DE SALTO DE DIRECTORIO (PATH TRAVERSAL)
    // ─────────────────────────────────────────────────────────────────────────
    const customProtocolCheck = path.join(ctx.rootDir, 'main.js');
    if (fs.existsSync(customProtocolCheck)) {
      const mainContent = ctx.getFileContent(customProtocolCheck);
      if (mainContent.includes('protocol.handle') && !mainContent.includes('relative.startsWith') && !mainContent.includes('path.relative')) {
        addIssue(
          'pathTraversal',
          customProtocolCheck,
          160,
          'El manejador de protocolo de archivos no valida la ruta relativa contra salto de directorio ("..").',
          'Utilice path.relative() para comprobar que el archivo resuelto permanezca estrictamente dentro del directorio permitido.',
          null,
          'error'
        );
      }
    }
  }
};
