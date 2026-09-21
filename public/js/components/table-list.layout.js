/**
 * table-list.layout.js - Plantilla Maestra Canónica para Vistas Tabulares (TableListViewLayout)
 * LobbyControl - Arquitectura Modular ESM
 */

import { escapeHtml } from '../utils/formatters.js';

/**
 * Renderiza una tarjeta de KPI con diseño canónico Behance LMS
 * @param {Object} kpi
 * @param {string} kpi.label - Etiqueta superior
 * @param {string|number} kpi.value - Cifra principal
 * @param {string} [kpi.subtitle] - Texto explicativo inferior
 * @param {string} [kpi.icon] - Icono Lucide
 * @param {string} [kpi.color] - Color de acento ('brand'|'emerald'|'sky'|'amber'|'indigo'|'rose')
 * @param {string} [kpi.id] - ID opcional para actualización reactiva del valor
 * @param {string} [kpi.pct] - Porcentaje opcional o badge
 * @returns {string} HTML de la tarjeta
 */
export function renderKpiCard({
  label = '',
  value = 0,
  subtitle = '',
  icon = 'activity',
  color = 'brand',
  id = '',
  pct = ''
} = {}) {
  const colorMap = {
    brand: 'bg-brand-50 dark:bg-brand-950/50 text-brand-600 dark:text-brand-400',
    emerald: 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400',
    green: 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400',
    sky: 'bg-sky-50 dark:bg-sky-950/50 text-sky-600 dark:text-sky-400',
    blue: 'bg-sky-50 dark:bg-sky-950/50 text-sky-600 dark:text-sky-400',
    amber: 'bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400',
    yellow: 'bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400',
    indigo: 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400',
    purple: 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400',
    rose: 'bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400',
    red: 'bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400'
  };

  const iconClasses = colorMap[color] || colorMap.brand;
  const idAttr = id ? `id="${id}"` : '';

  return `
    <div class="glass-card rounded-2xl p-5 flex items-center gap-4 hover:shadow-md transition-all duration-300">
      <div class="w-12 h-12 rounded-2xl ${iconClasses} flex items-center justify-center shrink-0">
        <i data-lucide="${icon}" class="w-6 h-6"></i>
      </div>
      <div class="flex-1 min-w-0">
        <p class="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider truncate">${escapeHtml(label)}</p>
        <div class="flex items-baseline gap-2">
          <span class="text-2xl font-black text-text-primary font-mono" ${idAttr}>${escapeHtml(String(value))}</span>
          ${pct ? `<span class="text-[10px] font-bold text-brand-700 dark:text-brand-300 bg-brand-50 dark:bg-brand-950/50 px-1.5 py-0.5 rounded">${escapeHtml(pct)}</span>` : ''}
        </div>
        ${subtitle ? `<p class="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 truncate">${escapeHtml(subtitle)}</p>` : ''}
      </div>
    </div>
  `;
}

/**
 * Renderiza el cuerpo o contenedor completo de una vista basada en tabla
 * @param {Object} options
 * @param {string} [options.id] - ID contenedor principal
 * @param {string} [options.title] - Título principal (h2)
 * @param {string} [options.titleIcon] - Icono Lucide para el badge del título
 * @param {string} [options.subtitle] - Subtítulo descriptivo
 * @param {string} [options.headerActionsHtml] - Botones de acción superiores junto al título (solo Reportes)
 * @param {Array<Object>} [options.kpis] - Array de objetos KPI declarativos
 * @param {string} [options.statsHtml] - HTML de respaldo para métricas
 * @param {string} [options.filtersHtml] - HTML del panel de filtros (Zona 1)
 * @param {string} [options.tableActionsHtml] - Botones de acción sobre la tabla (solo si aplica)
 * @param {string} [options.counterText] - Texto contador sobre la tabla (Zona 3)
 * @param {string} [options.counterId] - ID para el elemento contador
 * @param {Array<{ key: string, header: string, width?: string, align?: string, render?: Function }>} options.columns - Definición de columnas (Zona 4)
 * @param {Array<Object>} options.items - Elementos de la página actual (Zona 5)
 * @param {Function|string} [options.rowClick] - Función o string de handler onclick para la fila
 * @param {Function|string} [options.rowClass] - Función o string de clase adicional para la fila
 * @param {string} [options.emptyIcon] - Icono Lucide para estado vacío (default: 'inbox')
 * @param {string} [options.emptyMessage] - Mensaje para estado vacío
 * @param {string} [options.emptyActionHtml] - Botón o acción para estado vacío
 * @param {string} [options.paginationSummary] - Texto de resumen en pie de tabla (Zona 6)
 * @param {string} [options.paginationHtml] - HTML de los controles de paginación (Zona 6)
 * @param {string} [options.paginationId] - ID del contenedor de paginación
 * @param {string} [options.tableId] - ID del elemento <table>
 * @param {boolean} [options.isEmbedded] - Si es vista embebida (omite cabecera superior)
 * @returns {string} HTML generado
 */
export function renderTableListViewLayout({
  id = '',
  title = '',
  titleIcon = '',
  subtitle = '',
  headerActionsHtml = '',
  kpis = null,
  statsHtml = '',
  subTabsHtml = '',
  bannerHtml = '',
  filtersHtml = '',
  tableActionsHtml = '',
  counterText = '',
  counterId = '',
  columns = [],
  items = [],
  rowClick = null,
  rowClass = '',
  emptyIcon = 'inbox',
  emptyMessage = 'No se encontraron registros coincidentes.',
  emptyActionHtml = '',
  paginationSummary = '',
  paginationHtml = '',
  paginationId = '',
  tableId = '',
  isEmbedded = false,
  showHeader = false
}) {
  const containerIdAttr = id ? `id="${id}"` : '';
  const tableIdAttr = tableId ? `id="${tableId}"` : '';
  const counterIdAttr = counterId ? `id="${counterId}"` : '';
  const paginationIdAttr = paginationId ? `id="${paginationId}"` : '';

  // Sincronizar dinámicamente la barra superior oficial (Topbar) para evitar títulos duplicados
  if (typeof document !== 'undefined' && !isEmbedded) {
    const topTitle = document.getElementById('topbar-title');
    const topDesc = document.getElementById('topbar-desc');
    if (title && topTitle) topTitle.textContent = title;
    if (subtitle && topDesc) topDesc.textContent = subtitle;
  }

  // Cabecera interna de Vista (Omitida por defecto porque el Topbar oficial ya gobierna el título)
  let headerSection = '';
  if (showHeader && !isEmbedded && (title || subtitle || headerActionsHtml)) {
    const iconBadge = titleIcon ? `
      <div class="h-9 w-9 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400 flex items-center justify-center shrink-0">
        <i data-lucide="${titleIcon}" class="h-5 w-5"></i>
      </div>
    ` : '';

    headerSection = `
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          ${title ? `
            <h2 class="text-xl font-black text-text-primary tracking-tight flex items-center gap-2.5">
              ${iconBadge}
              <span>${escapeHtml(title)}</span>
            </h2>
          ` : ''}
          ${subtitle ? `<p class="text-xs text-text-secondary mt-1">${escapeHtml(subtitle)}</p>` : ''}
        </div>
        ${headerActionsHtml ? `<div class="flex items-center gap-2 shrink-0">${headerActionsHtml}</div>` : ''}
      </div>
    `;
  }

  // ZONA 2: KPIs / Métricas declarativas (LMS Behance)
  let kpisSection = '';
  if (Array.isArray(kpis) && kpis.length > 0) {
    const colsClass = kpis.length === 2
      ? 'grid-cols-1 sm:grid-cols-2'
      : kpis.length === 3
        ? 'grid-cols-1 sm:grid-cols-3'
        : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4';
    kpisSection = `
      <div class="grid ${colsClass} gap-4 items-stretch">
        ${kpis.map(renderKpiCard).join('')}
      </div>
    `;
  } else if (statsHtml) {
    kpisSection = statsHtml;
  }

  // ZONA 4: Encabezados de Tabla (Cabeceras)
  const theadHtml = columns.map(col => {
    const alignClass = col.align || 'text-left';
    const widthClass = col.width || '';
    return `<th class="py-3 px-4 ${alignClass} ${widthClass}">${escapeHtml(col.header || '')}</th>`;
  }).join('');

  // ZONA 5: Filas de Datos
  let tbodyHtml = '';
  if (!items || items.length === 0) {
    const colSpan = columns.length || 1;
    tbodyHtml = `
      <tr>
        <td colspan="${colSpan}" class="py-12 text-center text-text-tertiary">
          <div class="flex flex-col items-center justify-center gap-2">
            <i data-lucide="${emptyIcon}" class="h-8 w-8 text-text-tertiary/50"></i>
            <p class="font-medium text-xs">${escapeHtml(emptyMessage)}</p>
            ${emptyActionHtml ? `<div class="mt-1">${emptyActionHtml}</div>` : ''}
          </div>
        </td>
      </tr>
    `;
  } else {
    tbodyHtml = items.map((item, index) => {
      const clickAttr = typeof rowClick === 'function' ? `onclick="${rowClick(item, index)}"` : (rowClick ? `onclick="${rowClick}"` : '');
      const cursorClass = clickAttr ? 'cursor-pointer' : '';
      const extraClass = typeof rowClass === 'function' ? rowClass(item, index) : rowClass;

      const cellsHtml = columns.map(col => {
        const alignClass = col.align || 'text-left';
        const widthClass = col.width || '';
        const content = typeof col.render === 'function'
          ? col.render(item, index)
          : (item[col.key] !== undefined && item[col.key] !== null ? escapeHtml(String(item[col.key])) : '—');

        return `<td class="py-3 px-4 ${alignClass} ${widthClass}">${content}</td>`;
      }).join('');

      return `
        <tr class="hover:bg-border-ui/30 transition-colors ${cursorClass} ${extraClass}" ${clickAttr}>
          ${cellsHtml}
        </tr>
      `;
    }).join('');
  }

  // ZONA 6: Pie de Paginación
  let tableFooter = '';
  if (paginationSummary || paginationHtml) {
    tableFooter = `
      <div class="p-4 border-t border-border-ui flex flex-col sm:flex-row items-center justify-between gap-3 bg-border-ui/10" ${paginationIdAttr}>
        <div class="text-xs text-text-tertiary">
          ${paginationSummary || ''}
        </div>
        <div>
          ${paginationHtml || ''}
        </div>
      </div>
    `;
  }

  // ESTRUCTURA CANÓNICA CON ORDEN ESTRICTO:
  // 1. FILTROS -> 2. KPIS -> 3. N ENCONTRADOS -> 4. CABECERAS -> 5. DATOS -> 6. PAGINACIÓN
  return `
    <div class="space-y-6 font-sans" ${containerIdAttr}>
      ${subTabsHtml ? `
        <div class="flex gap-2 border-b border-border-ui pb-2 -mt-2">
          ${subTabsHtml}
        </div>
      ` : ''}

      ${headerSection}

      ${bannerHtml || ''}
      
      <!-- 1. FILTROS -->
      ${filtersHtml}

      <!-- 2. KPIS / MÉTRICAS -->
      ${kpisSection}

      <!-- TABLA PRINCIPAL DE DATOS -->
      <div class="glass-card bg-white dark:bg-slate-900 rounded-2xl border border-border-ui overflow-hidden shadow-xs w-full max-w-full">
        <!-- 3. N ENCONTRADOS -->
        ${(counterText || tableActionsHtml) ? `
          <div class="p-4 border-b border-border-ui flex flex-wrap justify-between items-center gap-3 bg-white/50 dark:bg-slate-900/50">
            <div class="text-xs text-text-secondary font-medium" ${counterIdAttr}>${counterText}</div>
            ${tableActionsHtml ? `<div class="flex items-center gap-2 flex-wrap">${tableActionsHtml}</div>` : ''}
          </div>
        ` : ''}
        
        <div class="overflow-x-auto w-full">
          <table class="w-full min-w-[850px] text-left border-collapse table-fixed" ${tableIdAttr}>
            <!-- 4. CABECERAS -->
            <thead>
              <tr class="border-b border-border-ui bg-border-ui/30 text-[11px] font-bold uppercase tracking-wider text-text-tertiary">
                ${theadHtml}
              </tr>
            </thead>
            <!-- 5. DATOS -->
            <tbody class="divide-y divide-border-ui text-xs">
              ${tbodyHtml}
            </tbody>
          </table>
        </div>

        <!-- 6. PAGINACIÓN -->
        ${tableFooter}
      </div>
    </div>
  `;
}

if (typeof window !== 'undefined') {
  window.renderTableListViewLayout = renderTableListViewLayout;
  window.renderKpiCard = renderKpiCard;
}
