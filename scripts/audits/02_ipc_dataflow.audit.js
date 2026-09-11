/**
 * scripts/audits/02_ipc_dataflow.audit.js
 * Dominio 2: IPC, APIs y Flujo de Datos
 * 
 * Abarca:
 *  - Dimensión 6: Desempaquetado seguro de respuestas API e IPC
 *  - Dimensión 7: Validación de rutas y métodos HTTP (Frontend vs Backend router.js)
 *  - Dimensión 8: Delegación de eventos (data-action)
 *  - Dimensión 9: Requisitos de pre-carga de datasets (dataStore) en navegación
 *  - Dimensión 10: Firmas y aridad de funciones críticas (openConfirmModal, showToast)
 *  - Dimensión 11: Ciclo de vida y resguardos en exportadores (PDF/Excel)
 */

const fs = require('fs');
const path = require('path');

module.exports = {
  id: 'ipc',
  name: 'IPC, APIs y Flujo de Datos',

  run(ctx, addIssue) {
    const jsFiles = ctx.getJsFiles();

    // ─────────────────────────────────────────────────────────────────────────
    // 6. DESEMPAQUETADO SEGURO DE RESPUESTAS API / IPC
    // ─────────────────────────────────────────────────────────────────────────
    for (const file of jsFiles) {
      const lines = ctx.getFileLines(file);
      lines.forEach((line, lineIdx) => {
        const lineNum = lineIdx + 1;
        if (/\b(?:data|d|res)\.data\.(codes|firstCode|items|records|valor)\b/.test(line) && !line.includes('?.') && !line.includes('||')) {
          addIssue(
            'apiConsumption',
            file,
            lineNum,
            'Acceso directo rígido a propiedad anidada (.data.) sin fallback para payloads planos',
            'Use navegación opcional o fallback: "res?.codes || res?.data?.codes".',
            line,
            'error'
          );
        }
      });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 7. CRUCE DE RUTAS Y MÉTODOS HTTP (FRONTEND vs ROUTER)
    // ─────────────────────────────────────────────────────────────────────────
    const routerJsPath = path.join(ctx.srcDir, 'ipc/router.js');
    const backendRoutes = new Map();

    if (fs.existsSync(routerJsPath)) {
      const routerLines = ctx.getFileLines(routerJsPath);
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

    for (const file of jsFiles) {
      const lines = ctx.getFileLines(file);
      lines.forEach((line, lineIdx) => {
        const lineNum = lineIdx + 1;

        // A. fetch('/api/...')
        const fetchMatches = line.matchAll(/fetch\(\s*['"`](\/api\/[^'"`?#\s]+)/g);
        for (const m of fetchMatches) {
          const route = m[1];
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
              line,
              'error'
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
              line,
              'error'
            );
          } else if (!matchedMethods.has('ALL') && !matchedMethods.has(method)) {
            addIssue(
              'apiRoutes',
              file,
              lineNum,
              `Método HTTP "${method}" no implementado para la ruta "${route}" en router.js`,
              `El backend solo soporta: ${Array.from(matchedMethods).join(', ')}.`,
              line,
              'error'
            );
          }
        }
      });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 8. DELEGACIÓN DE EVENTOS (DATA-ACTION)
    // ─────────────────────────────────────────────────────────────────────────
    const declaredActions = new Set();
    const handledActions = new Set();

    for (const file of jsFiles) {
      const content = ctx.getFileContent(file);

      const actionDeclMatches = content.matchAll(/data-action=["']([^"'${}\s]+)["']/g);
      for (const m of actionDeclMatches) declaredActions.add(m[1]);

      const actionHandleMatches = content.matchAll(/(?:dataset\.action|data-action)\s*(?:===|==|\.includes\()\s*["']([^"'${}\s]+)["']/g);
      for (const m of actionHandleMatches) handledActions.add(m[1]);

      const actionClosestMatches = content.matchAll(/closest\(\s*['"]\[data-action=["']([^"'${}\s]+)["']\]['"]\s*\)/g);
      for (const m of actionClosestMatches) handledActions.add(m[1]);
    }

    // También considerar actions declaradas en HTML
    const htmlData = ctx.getHtmlData();
    htmlData.declaredActions.forEach(a => declaredActions.add(a));

    declaredActions.forEach(action => {
      if (!handledActions.has(action)) {
        addIssue(
          'dataActionDelegation',
          'public/js/views.js',
          1,
          `Atributo data-action="${action}" declarado en vistas pero no cuenta con manejador de evento en los listeners`,
          `Agregue el case o bloque if para manejar la acción "${action}" en los manejadores de eventos.`,
          `data-action="${action}"`,
          'warning'
        );
      }
    });

    // ─────────────────────────────────────────────────────────────────────────
    // 9. REQUISITOS DE DATOS POR VISTA (DATASTORE PRE-LOADING)
    // ─────────────────────────────────────────────────────────────────────────
    const viewsJsPath = path.join(ctx.publicJsDir, 'views.js');
    if (fs.existsSync(viewsJsPath)) {
      const viewsContent = ctx.getFileContent(viewsJsPath);
      if (viewsContent.includes('tabName === "reportes"') && !viewsContent.includes('fetchData("publicadas")') && !viewsContent.includes("fetchData('publicadas')")) {
        addIssue(
          'dataStoreLoading',
          viewsJsPath,
          2247,
          'La vista de Reportes no asegura la carga de dataStore.publicadas en el cambio de pestaña',
          'Invoque fetchData("publicadas") al activar la pestaña de reportes.',
          null,
          'error'
        );
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 10. FIRMAS Y ARIDAD DE FUNCIONES COMPARTIDAS (openConfirmModal)
    // ─────────────────────────────────────────────────────────────────────────
    for (const file of jsFiles) {
      const lines = ctx.getFileLines(file);
      lines.forEach((line, lineIdx) => {
        const lineNum = lineIdx + 1;
        const objCallMatch = line.match(/openConfirmModal\s*\(\s*\{/);
        if (objCallMatch) {
          addIssue(
            'functionSignatures',
            file,
            lineNum,
            'openConfirmModal invocado con un objeto de opciones en lugar de argumentos posicionales (title, message, onConfirm)',
            'Use openConfirmModal(title, message, callback) en lugar de pasar un objeto.',
            line,
            'error'
          );
        }
      });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 11. TIMEOUTS Y RESGUARDOS EN EXPORTADORES
    // ─────────────────────────────────────────────────────────────────────────
    const handlersJsPath = path.join(ctx.srcDir, 'ipc/handlers.js');
    if (fs.existsSync(handlersJsPath)) {
      const handlersContent = ctx.getFileContent(handlersJsPath);
      if (handlersContent.includes('generate-silent-pdf') && !handlersContent.includes('timeoutId = setTimeout')) {
        addIssue(
          'exports',
          handlersJsPath,
          323,
          'El manejador generate-silent-pdf no cuenta con timeout de seguridad en Electron',
          'Incorpore un timeout defensivo para resolver la promesa si la ventana tarda en imprimir.',
          null,
          'error'
        );
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 12. INTEGRIDAD DE ESQUEMA DB (TABLAS Y CONSULTAS CANÓNICAS SQLITE)
    // ─────────────────────────────────────────────────────────────────────────
    const obsoleteTables = [
      'audiencias_lobby',
      'solicitudes_lobby',
      'viajes_dh',
      'donativos_vh',
      'audiencias_ph',
      'audiencias_sh',
      'audiencias'
    ];
    const obsoleteTableRegex = new RegExp(`\\b(?:FROM|JOIN|INTO|UPDATE|TABLE)\\s+(${obsoleteTables.join('|')})\\b`, 'i');

    const allBackendFiles = [];
    function collectBackendFiles(dir) {
      if (!fs.existsSync(dir)) return;
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name !== 'node_modules') collectBackendFiles(full);
        } else if (entry.isFile() && entry.name.endsWith('.js')) {
          allBackendFiles.push(full);
        }
      }
    }
    collectBackendFiles(ctx.srcDir);
    collectBackendFiles(path.join(ctx.rootDir, 'scripts'));

    for (const file of allBackendFiles) {
      const lines = ctx.getFileLines(file);
      lines.forEach((line, lineIdx) => {
        const match = line.match(obsoleteTableRegex);
        if (match) {
          const badTable = match[1];
          addIssue(
            'dbSchemaIntegrity',
            file,
            lineIdx + 1,
            `Referencia a tabla inexistente u obsoleta "${badTable}" en consulta SQL`,
            'Use los nombres canónicos: solicitudes_sh, publicadas_ph, viajes_vh, donativos_dh, sujetos_pasivos_sph.',
            line,
            'error'
          );
        }
      });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 13. CONTRATOS DE FILTRADO Y ESTADO (FILTER & STATE RESOLUTION)
    // ─────────────────────────────────────────────────────────────────────────
    const appJsPath = path.join(ctx.publicJsDir, 'app.js');
    if (fs.existsSync(appJsPath)) {
      const appContent = ctx.getFileContent(appJsPath);
      const appLines = ctx.getFileLines(appJsPath);

      // Verificar si handleMultiFilter resuelve vistas compuestas (ej: audiencias -> solicitudes/publicadas)
      const handleMultiFilterMatch = appContent.match(/function\s+handleMultiFilter\s*\(([^)]*)\)\s*\{([\s\S]*?)\n\}/);
      if (handleMultiFilterMatch) {
        const fnBody = handleMultiFilterMatch[2];
        const fnParams = handleMultiFilterMatch[1].split(',').map(p => p.trim());
        const viewParam = fnParams[0] || 'viewName';

        // Si accede directamente a paginationState[viewParam] sin resolver 'audiencias'
        const directAccessRegex = new RegExp(`paginationState\\[${viewParam}\\]`);
        const hasAudienciasResolution = fnBody.includes("'audiencias'") || fnBody.includes('"audiencias"');

        if (directAccessRegex.test(fnBody) && !hasAudienciasResolution) {
          // Buscar línea exacta de handleMultiFilter
          let fnLine = 1;
          for (let i = 0; i < appLines.length; i++) {
            if (appLines[i].includes('function handleMultiFilter')) {
              fnLine = i + 1;
              break;
            }
          }
          addIssue(
            'filterStateContract',
            appJsPath,
            fnLine,
            `Función handleMultiFilter(${viewParam}) accede directamente a paginationState[${viewParam}] sin resolver la vista compuesta "audiencias". Provoca TypeError irrecuperable al interactuar con filtros en la vista Audiencias.`,
            'Resuelva la vista activa: si viewName === "audiencias", determine si la sub-pestaña es "solicitudes" o "publicadas" antes de acceder a paginationState.',
            appLines[fnLine - 1],
            'error'
          );
        }
      }

      // Verificar que los campos data-field de selectores de filtro existan en los filtros de paginationState
      for (const file of jsFiles) {
        const content = ctx.getFileContent(file);
        const lines = ctx.getFileLines(file);

        lines.forEach((line, lineIdx) => {
          const selectFilterMatch = line.matchAll(/renderSelectInput\(\s*\{[\s\S]*?fieldName:\s*["']([^"']+)["']/g);
          for (const m of selectFilterMatch) {
            const field = m[1];
            // Si el campo no existe en paginationState ni es un campo estándar
            const isKnownField = ['estado', 'tipoFecha', 'vigencia', 'anio', 'procedencia', 'tipo', 'ocasion'].includes(field);
            if (!isKnownField) {
              addIssue(
                'filterStateContract',
                file,
                lineIdx + 1,
                `Selector de filtro declarado con fieldName="${field}" no reconocido en el catálogo de filtros`,
                'Declare la propiedad en paginationState.*.filters o verifique el nombre del campo.',
                line,
                'warning'
              );
            }
          }
        });
      }
    }
  }
};

