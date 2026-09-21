/**
 * scripts/audits/10_datos_hardcodeados.audit.js
 * Dominio 10: Detección de Datos Ficticios, Estáticos y Contadores Hardcodeados
 * 
 * Evalúa que el código de producción (HTML y JS) no contenga:
 *  1. Badges o contadores numéricos estáticos en la navegación o cabeceras (ej. 520, Hoy: 2, 3 FDP).
 *  2. Datos de identidad/usuario pre-rellenados en el cascarón HTML (ej. nombres o roles fijos antes de login).
 *  3. Marcas temporales u horas de maqueta congeladas en el HTML inicial (ej. 11:45 hrs en vez de --:--).
 *  4. Fallbacks de fechas/horas de negocio congeladas en código JavaScript (ej. '08-09-2026 12:23').
 *  5. Insignias o métricas cuantitativas hardcodeadas en plantillas dinámicas sin interpolación (${...}).
 */

const fs = require('fs');
const path = require('path');

module.exports = {
  id: 'hardcoded',
  name: 'Datos Estáticos, Ficticios y Contadores Hardcodeados',

  run(ctx, addIssue) {
    const rootIndexHtml = path.join(ctx.publicDir, 'index.html');
    const jsFiles = ctx.getJsFiles();

    // ─────────────────────────────────────────────────────────────────────────
    // 1. INSPECCIÓN DE PUBLIC/INDEX.HTML (CASCARÓN PRINCIPAL DE LA APP)
    // ─────────────────────────────────────────────────────────────────────────
    if (fs.existsSync(rootIndexHtml)) {
      const lines = ctx.getFileLines(rootIndexHtml);

      lines.forEach((line, idx) => {
        const lineNum = idx + 1;
        const trimmed = line.trim();

        // 1.1 Contadores o números directos dentro de badges/spans de navegación
        // Ejemplo: <span ...>520</span> o <span ...>Hoy: 2</span> o <span ...>3 FDP</span>
        const badgeStaticMatch = trimmed.match(/<span\b[^>]*>(\s*(?:Hoy:\s*)?\d+(?:\s+[A-Z]+)?\s*)<\/span>/i);
        if (badgeStaticMatch) {
          const rawText = badgeStaticMatch[1].trim();
          // Ignorar si es neutral tipo 0, 00, o si es un tag especial
          if (rawText !== '0' && rawText !== '00' && rawText !== '--') {
            // Verificar si el span tiene una clase indicadora de badge o está en navegación
            const isBadgeLike = /rounded|bg-|px-|text-\[|badge/i.test(trimmed);
            if (isBadgeLike) {
              addIssue(
                'hardcodedData',
                rootIndexHtml,
                lineNum,
                `Contador o métrica hardcodeada en elemento visual: "${rawText}"`,
                'Elimine la cifra estática o vincúlela dinámicamente mediante una función del store.',
                trimmed,
                'error'
              );
            }
          }
        }

        // 1.2 Horas o marcas temporales fijas simuladas en el HTML inicial
        // Ejemplo: <span ...>11:45 hrs</span>
        const timeStaticMatch = trimmed.match(/>\s*(\d{1,2}:\d{2}\s*(?:hrs|horas|am|pm)?)\s*</i);
        if (timeStaticMatch) {
          const matchedTime = timeStaticMatch[1].trim();
          if (!matchedTime.startsWith('--')) {
            addIssue(
              'hardcodedData',
              rootIndexHtml,
              lineNum,
              `Marca temporal u hora estática en HTML inicial: "${matchedTime}"`,
              'Use un indicador neutro inicial como "--:--" hasta que la sincronización real entregue la hora.',
              trimmed,
              'error'
            );
          }
        }
      });
    }

    // 1.3 Identidad de usuario / perfiles fijos en el cascarón (soporta multilínea)
    if (fs.existsSync(rootIndexHtml)) {
      const fullHtml = ctx.getFileContent(rootIndexHtml);
      const userFieldRegex = /<(div|p|span)\b[^>]*\bid=["']header-user-(nombre|rol|initials)["'][^>]*>([\s\S]*?)<\/\1>/gi;
      let uMatch;
      while ((uMatch = userFieldRegex.exec(fullHtml)) !== null) {
        const fieldType = uMatch[2];
        const innerVal = uMatch[3].replace(/\s+/g, ' ').trim();
        if (innerVal && innerVal !== '--' && innerVal !== '...' && innerVal !== 'Cargando...') {
          // Calcular número de línea aproximado
          const upToMatch = fullHtml.slice(0, uMatch.index);
          const lineNum = upToMatch.split('\n').length;
          addIssue(
            'hardcodedData',
            rootIndexHtml,
            lineNum,
            `Dato de usuario/perfil pre-poblado estáticamente en HTML (${fieldType}): "${innerVal}"`,
            'Deje el elemento vacío o con un placeholder neutro ("--") hasta que checkAuth() resuelva la sesión real.',
            uMatch[0].replace(/\s+/g, ' ').trim(),
            'error'
          );
        }
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 2. INSPECCIÓN DE JAVASCRIPT (PUBLIC/JS/**/*.JS)
    // ─────────────────────────────────────────────────────────────────────────
    for (const file of jsFiles) {
      const lines = ctx.getFileLines(file);

      lines.forEach((line, idx) => {
        const lineNum = idx + 1;
        const trimmed = line.trim();

        // 2.1 Fechas u horas de negocio completas congeladas como fallback en retornos o asignaciones
        // Ejemplo: return '08-09-2026 12:23' o const fallback = '08-09-2026 12:23'
        const dateFallbackMatch = trimmed.match(/(?:return|\|\||\=)\s*['"](\d{2}[-\/]\d{2}[-\/]\d{4}(?:\s+\d{2}:\d{2})?)['"]/i);
        if (dateFallbackMatch) {
          const fixedDate = dateFallbackMatch[1];
          addIssue(
            'hardcodedData',
            file,
            lineNum,
            `Fecha/hora congelada en código JavaScript como fallback: "${fixedDate}"`,
            'Devuelva un valor neutro ("--") o la marca temporal real de la base de datos.',
            trimmed,
            'error'
          );
        }

        // 2.2 Template literals en JS que generen badges o píldoras con cifras estáticas
        // Ejemplo: <span class="...rounded-full...">15</span> sin interpolación ${...}
        const templateBadgeMatch = trimmed.match(/class=["'][^"']*(?:rounded-full|badge)[^"']*["']>([a-zA-Z\s]*\d+[a-zA-Z\s]*)<\/(?:span|div)>/i);
        if (templateBadgeMatch) {
          const literalVal = templateBadgeMatch[1].trim();
          // Si no tiene ${...} y no es una constante de paginación unitaria
          if (!literalVal.includes('${') && literalVal !== '0' && literalVal !== '1') {
            addIssue(
              'hardcodedData',
              file,
              lineNum,
              `Insignia o contador cuantitativo estático en plantilla JS: "${literalVal}"`,
              'Interpole con datos reales de la base de datos mediante ${variable}.',
              trimmed,
              'error'
            );
          }
        }
      });
    }
  }
};
