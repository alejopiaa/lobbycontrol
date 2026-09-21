/**
 * scripts/audits/09_accessibility_ux_compliance.audit.js
 * Dominio 9: Accesibilidad, Formularios y UX Compliance
 * 
 * Abarca:
 *  - Dimensión 21.1: Inputs y selects sin label asociado (<label for="...">) ni atributos aria-label / title
 *  - Dimensión 21.2: Botones interactivos solo de icono (<i data-lucide="...">) sin texto accesible ni title/aria-label
 */

const fs = require('fs');
const path = require('path');

module.exports = {
  id: 'accessibility',
  name: 'Accesibilidad, Formularios y UX Compliance',

  run(ctx, addIssue) {
    const filesToAudit = [];

    // Coleccionar todos los archivos JS de vistas y componentes en public/js
    const jsFiles = ctx.getJsFiles();
    filesToAudit.push(...jsFiles);

    // Archivo HTML principal
    const indexHtmlPath = path.join(ctx.publicDir, 'index.html');
    if (fs.existsSync(indexHtmlPath)) {
      filesToAudit.push(indexHtmlPath);
    }

    for (const filePath of filesToAudit) {
      const content = ctx.getFileContent(filePath);
      const lines = ctx.getFileLines(filePath);

      // ───────────────────────────────────────────────────────────────────────
      // 21.1 INPUTS Y SELECTS SIN ACCESIBILIDAD (LABEL O ARIA-LABEL)
      // ───────────────────────────────────────────────────────────────────────
      const inputRegex = /<(input|select)\b([^>]*?)>/gi;
      let match;

      while ((match = inputRegex.exec(content)) !== null) {
        const tag = match[1].toLowerCase();
        const attrs = match[2];

        // Ignorar inputs de tipo hidden, submit, button, o con clases de ocultamiento técnico
        if (/\btype\s*=\s*["']hidden["']/i.test(attrs)) continue;
        if (/\bclass\s*=\s*["'][^"']*?\b(hidden|sr-only)\b/i.test(attrs)) continue;

        const hasAriaLabel = /\baria-label\s*=\s*["']/i.test(attrs);
        const hasAriaLabelledBy = /\baria-labelledby\s*=\s*["']/i.test(attrs);
        const hasTitle = /\btitle\s*=\s*["']/i.test(attrs);
        const hasPlaceholder = /\bplaceholder\s*=\s*["']/i.test(attrs);

        // Extraer id si existe
        const idMatch = attrs.match(/\bid\s*=\s*["']([^"'${}\s]+)["']/i);
        const inputId = idMatch ? idMatch[1] : null;

        let hasAssociatedLabel = false;
        if (inputId) {
          const labelRegex = new RegExp(`<label\\b[^>]*?\\bfor\\s*=\\s*["']${inputId}["']`, 'i');
          if (labelRegex.test(content)) {
            hasAssociatedLabel = true;
          }
        }

        // Verificar si el input está contenido dentro de un bloque <label> ... </label> envolvente
        const beforeSnippet = content.slice(Math.max(0, match.index - 300), match.index);
        const lastOpenLabel = beforeSnippet.lastIndexOf('<label');
        const lastCloseLabel = beforeSnippet.lastIndexOf('</label>');
        if (lastOpenLabel !== -1 && lastOpenLabel > lastCloseLabel) {
          hasAssociatedLabel = true;
        }

        // Si no tiene label, aria-label, aria-labelledby ni title
        if (!hasAssociatedLabel && !hasAriaLabel && !hasAriaLabelledBy && !hasTitle && !hasPlaceholder) {
          const charIndex = match.index;
          const lineNum = content.slice(0, charIndex).split('\n').length;
          const lineText = lines[lineNum - 1] || '';

          addIssue(
            'formAccessibility',
            filePath,
            lineNum,
            `Elemento <${tag}> sin etiqueta <label for="..."> asociada ni atributo "aria-label" o "title".`,
            `Agregue un atributo aria-label="..." o asocie una etiqueta <label for="${inputId || '...'}"> para accesibilidad de lectores de pantalla.`,
            lineText.trim(),
            'warning'
          );
        }
      }

      // ───────────────────────────────────────────────────────────────────────
      // 21.2 BOTONES SOLO CON ÍCONOS SIN TEXTO ACCESIBLE NI TITLE/ARIA-LABEL
      // ───────────────────────────────────────────────────────────────────────
      const buttonRegex = /<button\b([^>]*?)>([\s\S]*?)<\/button>/gi;
      let btnMatch;

      while ((btnMatch = buttonRegex.exec(content)) !== null) {
        const btnAttrs = btnMatch[1];
        const innerContent = btnMatch[2].trim();

        // Si el botón solo contiene un ícono data-lucide o SVG y nada más de texto
        const containsOnlyIcon = /^<i\b[^>]*?data-lucide=[^>]*?>\s*<\/i>$/i.test(innerContent) ||
                                 /^<svg\b[\s\S]*?<\/svg>$/i.test(innerContent);

        if (containsOnlyIcon) {
          const hasTitle = /\btitle\s*=\s*["']/i.test(btnAttrs);
          const hasAriaLabel = /\baria-label\s*=\s*["']/i.test(btnAttrs);
          const hasSrOnly = /class\s*=\s*["'][^"']*?\bsr-only\b/i.test(innerContent);

          if (!hasTitle && !hasAriaLabel && !hasSrOnly) {
            const charIndex = btnMatch.index;
            const lineNum = content.slice(0, charIndex).split('\n').length;
            const lineText = lines[lineNum - 1] || '';

            addIssue(
              'buttonAccessibility',
              filePath,
              lineNum,
              'Botón interactivo basado exclusivamente en icono sin texto alternativo, "title" ni "aria-label".',
              'Agregue title="..." o aria-label="..." al botón para describir la acción a usuarios de lectores de pantalla.',
              lineText.trim(),
              'warning'
            );
          }
        }
      }
    }
  }
};
