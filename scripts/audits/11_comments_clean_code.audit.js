/**
 * scripts/audits/11_comments_clean_code.audit.js
 * Dominio 11: Estandarización Estructural de Comentarios y Clean Code
 * 
 * Reglas 100% estructurales y gramaticales (Cero listas de palabras clave):
 *  1. Código muerto: sentencias de sintaxis JavaScript comentadas en desuso.
 *  2. Anotaciones temporales: exigencia estricta de "TODO: <descripción>" o "FIXME: <descripción>".
 *  3. Banners y separadores ornamentales: líneas con símbolos repetidos o títulos de sección numerados.
 *  4. Estructura JSDoc canónica:
 *     - Prohibición de comentarios informales "//" antes de funciones o clases.
 *     - Prohibición de bloques JSDoc apilados/consecutivos antes de una misma entidad.
 *     - Exigencia de etiquetas @param en funciones documentadas que declaren argumentos formales.
 *     - Prohibición de bloques híbridos rotos (línea "//" inmediatamente tras el cierre "* /").
 */

const fs = require('fs');
const path = require('path');

module.exports = {
  id: 'comments',
  name: 'Estandarización de Comentarios y Clean Code',

  run(ctx, addIssue) {
    const filesToAudit = [];

    // Archivos JavaScript de public/
    const publicJs = ctx.getJsFiles();
    filesToAudit.push(...publicJs);

    // Archivos JavaScript de src/
    const collectFromDir = (dir) => {
      if (!fs.existsSync(dir)) return;
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          collectFromDir(full);
        } else if (entry.isFile() && entry.name.endsWith('.js')) {
          filesToAudit.push(full);
        }
      }
    };
    collectFromDir(ctx.srcDir);

    // Archivos raíz
    const rootFiles = ['main.js', 'preload.js']
      .map(f => path.join(ctx.rootDir, f))
      .filter(f => fs.existsSync(f));
    filesToAudit.push(...rootFiles);

    // ─────────────────────────────────────────────────────────────────────────
    // PATRONES SINTÁCTICOS DE CÓDIGO MUERTO (GRAMÁTICA JS)
    // ─────────────────────────────────────────────────────────────────────────
    const DEAD_CODE_SYNTAX = [
      {
        id: 'DEAD_VAR',
        regex: /^\/\/\s*(?:const|let|var)\s+[$_a-zA-Z0-9]+\s*=/,
        message: 'Código muerto detectado: declaración de variable comentada en desuso.'
      },
      {
        id: 'DEAD_FN',
        regex: /^\/\/\s*(?:async\s+)?function(?:\s*\*|\s+[$_a-zA-Z0-9]+)\s*\(/,
        message: 'Código muerto detectado: declaración de función comentada en desuso.'
      },
      {
        id: 'DEAD_MODULE',
        regex: /^\/\/\s*(?:import\s+.*?from\s+['"]|export\s+(?:default\s+)?(?:const|let|var|function|class)\b)/,
        message: 'Código muerto detectado: sentencia import/export comentada en desuso.'
      },
      {
        id: 'DEAD_FLOW',
        regex: /^\/\/\s*(?:if|for|while|switch)\s*\(.*?\)\s*\{?\s*$/,
        message: 'Código muerto detectado: estructura de control comentada en desuso.'
      },
      {
        id: 'DEAD_RETURN',
        regex: /^\/\/\s*(?:return|throw)\s+[^;]+;?\s*$/,
        message: 'Código muerto detectado: instrucción return o throw comentada en desuso.'
      },
      {
        id: 'DEAD_AWAIT',
        regex: /^\/\/\s*await\s+[$_a-zA-Z0-9.]+\s*\(.*?\);?\s*$/,
        message: 'Código muerto detectado: llamada asíncrona await comentada en desuso.'
      },
      {
        id: 'DEAD_DEBUG',
        regex: /^\/\/\s*console\.(?:log|warn|error|info|debug)\s*\(.*?\);?\s*$/,
        message: 'Código muerto detectado: llamada de depuración console.* comentada.'
      }
    ];

    // Banners decorativos con símbolos repetidos (4 o más)
    const ORNAMENTAL_BANNER = /^\s*(?:\/\/\s*|\/\*\s*|\*\s*)[-=─*_~#]{4,}\s*(?:\*\/)?$/;

    // Títulos de sección numerados (ej. "1. CONTROLES...", "2. RUTAS:...")
    const NUMBERED_SECTION_TITLE = /^\s*(?:\/\/\s*|\*\s*)\d+\.\s+[A-ZÁÉÍÓÚ0-9_\s\-\/:()]+$/;

    // ─────────────────────────────────────────────────────────────────────────
    // ANÁLISIS ESTRUCTURAL ARCHIVO POR ARCHIVO
    // ─────────────────────────────────────────────────────────────────────────
    for (const filePath of filesToAudit) {
      const lines = ctx.getFileLines(filePath);
      let inBlockComment = false;
      let blockStartLine = 0;
      let blockIsJsDoc = false;
      let blockContent = [];
      let consecutiveJsDocBlocks = 0;
      let prevLineWasJsDocClose = false;

      for (let i = 0; i < lines.length; i++) {
        const lineNum = i + 1;
        const lineContent = lines[i];
        const trimmed = lineContent.trim();

        // 1. Detección de inicio de bloque multilínea
        if (trimmed.startsWith('/**')) {
          inBlockComment = true;
          blockStartLine = lineNum;
          blockIsJsDoc = true;
          blockContent = [trimmed];
          consecutiveJsDocBlocks++;
          if (consecutiveJsDocBlocks > 1) {
            addIssue(
              'clean_code_comments',
              filePath,
              lineNum,
              `[JSDOC APILADO] Se detectaron ${consecutiveJsDocBlocks} bloques JSDoc consecutivos antes de la misma entidad.`,
              'Consolide la documentación en un único bloque formal JSDoc.',
              trimmed,
              'warning'
            );
          }
          prevLineWasJsDocClose = false;
          continue;
        } else if (trimmed.startsWith('/*')) {
          inBlockComment = true;
          blockStartLine = lineNum;
          blockIsJsDoc = false;
          blockContent = [trimmed];
          prevLineWasJsDocClose = false;
          continue;
        }

        // 2. Procesamiento dentro de bloque multilínea
        if (inBlockComment) {
          blockContent.push(trimmed);

          // Verificar si el bloque contiene banners ornamentales
          if (ORNAMENTAL_BANNER.test(trimmed)) {
            addIssue(
              'clean_code_comments',
              filePath,
              lineNum,
              `[RUIDO DECORATIVO] Banner ornamental detectado dentro de bloque de comentarios.`,
              'Elimine las líneas de caracteres repetidos.',
              trimmed,
              'warning'
            );
          }

          // Verificar si el bloque JSDoc se usa como título de sección numerado
          if (blockIsJsDoc && NUMBERED_SECTION_TITLE.test(trimmed)) {
            addIssue(
              'clean_code_comments',
              filePath,
              lineNum,
              `[JSDOC SECCIONAL] Título de sección numerado detectado dentro de un bloque JSDoc.`,
              'JSDoc debe documentar firmas de código, no actuar como separador de capítulos.',
              trimmed,
              'warning'
            );
          }

          if (trimmed.includes('*/')) {
            inBlockComment = false;
            prevLineWasJsDocClose = true;

            // Verificar si el JSDoc de una función con parámetros omite @param
            if (blockIsJsDoc) {
              // Buscar siguiente línea de código tras el cierre
              let nextCodeLine = '';
              for (let j = i + 1; j < lines.length; j++) {
                const nt = lines[j].trim();
                if (nt && !nt.startsWith('//') && !nt.startsWith('/*')) {
                  nextCodeLine = nt;
                  break;
                }
              }

              if (nextCodeLine) {
                // Si es función con parámetros declarados
                const fnParamMatch = nextCodeLine.match(/(?:function\s+[$_a-zA-Z0-9]*\s*|(?!(?:if|for|while|switch|catch)\b)[$_a-zA-Z0-9]+\s*)\(([^)]+)\)/);
                if (fnParamMatch) {
                  const paramStr = fnParamMatch[1].trim();
                  if (paramStr && paramStr !== '') {
                    const blockText = blockContent.join('\n');
                    // Si el JSDoc no tiene @param, alertar
                    if (!blockText.includes('@param')) {
                      addIssue(
                        'clean_code_comments',
                        filePath,
                        blockStartLine,
                        `[JSDOC INCOMPLETO] La función recibe parámetros (${paramStr}) pero el bloque JSDoc omite las etiquetas @param.`,
                        'Documente los tipos y nombres de parámetros con la etiqueta formal @param.',
                        lines[blockStartLine - 1].trim(),
                        'warning'
                      );
                    }
                  }
                }
              }
            }
          }
          continue;
        }

        // Si la línea está vacía, continuar
        if (!trimmed) {
          consecutiveJsDocBlocks = 0;
          prevLineWasJsDocClose = false;
          continue;
        }

        // 3. Detección de Bloque Híbrido Roto (// inmediatamente después de */)
        if (prevLineWasJsDocClose && trimmed.startsWith('//')) {
          addIssue(
            'clean_code_comments',
            filePath,
            lineNum,
            `[COMENTARIO HÍBRIDO ROTO] Comentario "//" huérfano inmediatamente posterior al cierre de un bloque "*/".`,
            'Integre el texto dentro del bloque JSDoc o elimínelo si es redundante.',
            trimmed,
            'warning'
          );
        }
        prevLineWasJsDocClose = false;

        // Si no es un comentario de una sola línea, resetear apilamiento
        if (!trimmed.startsWith('//')) {
          consecutiveJsDocBlocks = 0;
          continue;
        }

        // ─────────────────────────────────────────────────────────────────────
        // 4. ANÁLISIS DE LÍNEAS COMENTADAS //
        // ─────────────────────────────────────────────────────────────────────

        // 4.1 Código Muerto
        for (const deadPattern of DEAD_CODE_SYNTAX) {
          if (deadPattern.regex.test(trimmed)) {
            addIssue(
              'clean_code_comments',
              filePath,
              lineNum,
              `[CÓDIGO MUERTO] ${deadPattern.message}`,
              'Elimine el código en desuso conforme a principios de Clean Code.',
              trimmed,
              'error'
            );
            break;
          }
        }

        // 4.2 Anotaciones Temporales TODO / FIXME (Estricto)
        const lowerTaskMatch = trimmed.match(/(?:^|\/\/)\s*(todo|fixme)\s*[:\-]/i);
        if (lowerTaskMatch && !/\b(TODO|FIXME):/.test(trimmed)) {
          addIssue(
            'clean_code_comments',
            filePath,
            lineNum,
            `[ANOTACIÓN TEMPORAL] Marcador no estándar "${lowerTaskMatch[1]}" detectado.`,
            'Estandarice usando estrictamente: "TODO: <descripción>" o "FIXME: <descripción>".',
            trimmed,
            'error'
          );
        } else {
          const upperTaskMatch = trimmed.match(/\b(TODO|FIXME)\b/);
          if (upperTaskMatch) {
            const validSyntax = /\b(TODO|FIXME):\s+\S+/;
            if (!validSyntax.test(trimmed)) {
              addIssue(
                'clean_code_comments',
                filePath,
                lineNum,
                `[ANOTACIÓN TEMPORAL] Formato no estándar en marcador ${upperTaskMatch[1]}.`,
                'Estandarice a la convención estricta: "TODO: <descripción>" o "FIXME: <descripción>".',
                trimmed,
                'error'
              );
            }
          }
        }

        // 4.3 Banners y títulos ornamentales
        if (ORNAMENTAL_BANNER.test(trimmed)) {
          addIssue(
            'clean_code_comments',
            filePath,
            lineNum,
            `[RUIDO DECORATIVO] Banner ornamental de caracteres repetidos detectado.`,
            'Elimine los separadores visuales ornamentales.',
            trimmed,
            'warning'
          );
        }

        if (NUMBERED_SECTION_TITLE.test(trimmed)) {
          addIssue(
            'clean_code_comments',
            filePath,
            lineNum,
            `[TÍTULO ORNAMENTAL] Título de sección numerado detectado en comentario "//".`,
            'Elimine la numeración de capítulos; organice el código mediante módulos y funciones autoexplicativas.',
            trimmed,
            'warning'
          );
        }

        // 4.4 Buscar siguiente línea ejecutable de código
        let nextCodeLine = '';
        for (let j = i + 1; j < lines.length; j++) {
          const nt = lines[j].trim();
          if (nt && !nt.startsWith('//') && !nt.startsWith('/*')) {
            nextCodeLine = nt;
            break;
          }
        }

        // 4.5 Comentario informal "//" antes de función o clase
        if (nextCodeLine) {
          const isFunctionOrClass = /(?:^|\s)(?:async\s+)?function(?:\s*\*|\s+[$_a-zA-Z0-9]+)\s*\(|^(?:export\s+)?(?:async\s+)?(?!(?:if|for|while|switch|catch|with)\b)[a-zA-Z0-9_$]+\s*\([^)]*\)\s*\{|^(?:export\s+)?class\s+[$_a-zA-Z0-9]+/.test(nextCodeLine);
          if (isFunctionOrClass) {
            addIssue(
              'clean_code_comments',
              filePath,
              lineNum,
              `[DOCUMENTACIÓN INFORMAL] Comentario informal "//" antes de una función o clase.`,
              'Estandarice la documentación utilizando formato JSDoc formal (/** ... */) con @param y @returns.',
              trimmed,
              'warning'
            );
          }
        }
      }
    }
  }
};
