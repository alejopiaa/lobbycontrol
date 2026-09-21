/**
 * filter-bar.component.js - Componente Canónico de Barra de Filtros Desplegable
 * LobbyControl - Arquitectura Modular ESM
 */

import { escapeHtml, escapeHtmlAttr } from '../utils/formatters.js';

/**
 * Alterna visibilidad del panel de filtros para cualquier módulo de forma reactiva
 * @param {string} moduleName - Nombre clave del módulo (ej: 'dashboard', 'donativos', 'viajes')
 */
export function toggleFilterBarPanel(moduleName) {
  if (typeof window === 'undefined') return;
  const stateKey = `_${moduleName}FiltersPanelOpen`;
  if (window[stateKey] === undefined) {
    window[stateKey] = false;
  }
  window[stateKey] = !window[stateKey];
  const isOpen = window[stateKey];

  const panel = document.getElementById(`${moduleName}-filters-panel`);
  const chevronId = moduleName === 'dashboard' ? 'icon-toggle-filters-chevron' : `icon-toggle-${moduleName}-filters-chevron`;
  const chevron = document.getElementById(chevronId) || document.getElementById(`icon-toggle-${moduleName}-filters-chevron`);

  if (panel) {
    if (isOpen) {
      panel.classList.remove('max-h-0', 'opacity-0', 'p-0', 'pointer-events-none', 'overflow-hidden');
      panel.classList.add('max-h-[500px]', 'opacity-100', 'px-4', 'pb-3', 'pt-1', 'pointer-events-auto', 'overflow-visible');
    } else {
      panel.classList.add('max-h-0', 'opacity-0', 'p-0', 'pointer-events-none', 'overflow-hidden');
      panel.classList.remove('max-h-[500px]', 'opacity-100', 'px-4', 'pb-3', 'pt-1', 'pointer-events-auto', 'overflow-visible');
    }
  }

  if (chevron) {
    chevron.classList.toggle('rotate-180', isOpen);
  }
}

/**
 * Renderiza la barra canónica de filtros idéntica al Dashboard
 * @param {Object} options
 * @param {string} options.moduleName - Nombre del módulo ('dashboard', 'donativos', 'viajes', etc.)
 * @param {number} [options.activeCount=0] - Número de filtros actualmente aplicados
 * @param {string} options.chipsHtml - HTML de los chips y selectores horizontales
 * @param {string} [options.onClear] - Expresión o función onclick para limpiar filtros
 * @param {string} [options.onToggle] - Expresión onclick opcional para toggle (default usa toggleFilterBarPanel)
 * @param {string} [options.clearTitle='Restablecer todos los filtros'] - Tooltip del botón borrar
 * @returns {string} HTML de la tarjeta de filtros
 */
export function renderFilterBar({
  moduleName = 'filters',
  activeCount = 0,
  chipsHtml = '',
  onClear = '',
  onToggle = '',
  clearTitle = 'Restablecer todos los filtros',
  defaultOpen = false
}) {
  const stateKey = `_${moduleName}FiltersPanelOpen`;
  if (typeof window !== 'undefined' && window[stateKey] === undefined) {
    window[stateKey] = false; // Colapsado/oculto por defecto idéntico a Dashboard
  }
  const isPanelOpen = typeof window !== 'undefined' ? !!window[stateKey] : false;
  const toggleCall = onToggle || `toggleFilterBarPanel('${moduleName}')`;
  const clearCall = onClear || `clearFilters('${moduleName}')`;
  const chevronId = moduleName === 'dashboard' ? 'icon-toggle-filters-chevron' : `icon-toggle-${moduleName}-filters-chevron`;

  return `
    <div id="${moduleName}-filters-card" class="glass-card rounded-2xl relative z-20 transition-all duration-300">
      <!-- CABECERA INTEGRADA: TRIGGER [⚡ Filtros ▾ (badge)] + [↺ Borrar filtros] -->
      <div class="px-4 py-2.5 flex items-center justify-between gap-3">
        <button id="btn-toggle-${moduleName}-filters" onclick="${toggleCall}"
                class="h-8 px-3.5 rounded-full bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200/50 dark:border-slate-700 text-xs font-bold flex items-center gap-2 text-brand-600 dark:text-brand-400 transition-all duration-200 cursor-pointer shadow-2xs group">
          <i data-lucide="sliders-horizontal" class="h-3.5 w-3.5 text-brand-600 dark:text-brand-400 group-hover:scale-110 transition-transform"></i>
          <span>Filtros</span>
          <span id="${moduleName}-filters-badge" class="${activeCount > 0 ? 'inline-flex' : 'hidden'} text-[10px] font-black px-1.5 py-0.5 rounded-full bg-brand-500 text-white leading-none">${activeCount}</span>
          <i id="${chevronId}" data-lucide="chevron-down" class="h-3.5 w-3.5 text-slate-400 transition-transform duration-200 ${isPanelOpen ? 'rotate-180' : ''}"></i>
        </button>

        <!-- BOTÓN PERMANENTE: Borrar filtros -->
        <button id="btn-clear-${moduleName}-filters" onclick="${clearCall}"
                class="text-xs font-semibold flex items-center gap-1.5 transition-all duration-150 ${activeCount > 0 ? 'text-rose-600 dark:text-rose-400 hover:text-rose-700 cursor-pointer opacity-100' : 'text-slate-400 dark:text-slate-500 opacity-40 pointer-events-none'}"
                title="${escapeHtmlAttr(clearTitle)}">
          <i data-lucide="rotate-ccw" class="h-3.5 w-3.5"></i>
          <span>Borrar filtros</span>
        </button>
      </div>

      <!-- PANEL DESPLEGABLE CON TODOS LOS CHIPS EN FILA HORIZONTAL -->
      <div id="${moduleName}-filters-panel" class="transition-all duration-300 ease-out ${isPanelOpen ? 'max-h-[500px] opacity-100 px-4 pb-3 pt-1 pointer-events-auto overflow-visible' : 'max-h-0 opacity-0 p-0 pointer-events-none overflow-hidden'}">
        <div class="flex flex-wrap items-center gap-2.5">
          ${chipsHtml}
        </div>
      </div>
    </div>
  `;
}

/**
 * Renderiza un chip de filtro estándar idéntico al estilo horizontal del Dashboard
 * @param {Object} options
 * @param {string} options.id - ID del elemento input
 * @param {string} [options.icon='search'] - Icono Lucide
 * @param {string} [options.placeholder=''] - Texto del placeholder
 * @param {string} [options.value=''] - Valor inicial
 * @param {string} [options.width='w-[200px]'] - Clase de ancho de Tailwind
 * @param {string} [options.onInput] - Handler oninput
 * @param {string} [options.onKeydown] - Handler onkeydown
 * @param {string} [options.onFocus] - Handler onfocus
 * @param {string} [options.onClick] - Handler onclick
 * @param {boolean} [options.disabled=false] - Si está deshabilitado
 * @param {string} [options.extraHtml=''] - HTML adicional (ej: sugerencias de autocompletado)
 * @returns {string} HTML del chip
 */
export function renderFilterChip({
  id = '',
  icon = 'search',
  placeholder = '',
  value = '',
  width = 'w-[200px]',
  onInput = '',
  onKeydown = '',
  onFocus = '',
  onClick = '',
  disabled = false,
  extraHtml = ''
} = {}) {
  const disabledClass = disabled
    ? 'opacity-60 cursor-not-allowed bg-slate-50 dark:bg-slate-900/50'
    : 'bg-white dark:bg-slate-800';
  const idAttr = id ? `id="${id}"` : '';
  const valueAttr = value ? `value="${escapeHtmlAttr(value)}"` : 'value=""';
  const onInputAttr = onInput ? `oninput="${onInput}"` : '';
  const onKeydownAttr = onKeydown ? `onkeydown="${onKeydown}"` : '';
  const onFocusAttr = onFocus ? `onfocus="${onFocus}"` : '';
  const onClickAttr = onClick ? `onclick="${onClick}"` : '';
  const disabledAttr = disabled ? 'disabled' : '';

  return `
    <div class="relative ${width} shrink-0">
      <div class="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200/60 dark:border-slate-700 ${disabledClass} text-xs shadow-2xs">
        <i data-lucide="${icon}" class="h-3.5 w-3.5 text-slate-400 shrink-0"></i>
        <input type="text" ${idAttr} placeholder="${escapeHtmlAttr(placeholder)}"
               ${valueAttr} ${disabledAttr}
               ${onInputAttr} ${onKeydownAttr} ${onFocusAttr} ${onClickAttr}
               class="bg-transparent border-0 text-xs text-text-primary placeholder:text-slate-400 focus:outline-none w-full">
      </div>
      ${extraHtml}
    </div>
  `;
}

if (typeof window !== 'undefined') {
  window.renderFilterBar = renderFilterBar;
  window.renderFilterChip = renderFilterChip;
  window.toggleFilterBarPanel = toggleFilterBarPanel;
}
