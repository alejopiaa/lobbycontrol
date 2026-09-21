/**
 * Sistema Canónico de Componentes Modulares de UI - LobbyControl
 * Biblioteca de funciones puras de presentación (retorno de marcado HTML).
 * Desacopladas de estado e interacciones mediante importaciones explícitas.
 */

import { escapeHtml, escapeHtmlAttr } from '../utils/formatters.js';
export { renderTableListViewLayout, renderKpiCard } from './table-list.layout.js';
export { renderFilterBar, renderFilterChip, toggleFilterBarPanel } from './filter-bar.component.js';

/**
 * Contenedor de Tarjeta Glassmorphic
 * @param {string} content - Contenido HTML hijo.
 * @param {string} extraClasses - Clases CSS adicionales.
 * @returns {string} Marcado HTML del contenedor.
 */
export function renderGlassCard(content, extraClasses = '') {
  return `
    <div class="glass-card ${extraClasses}">
      ${content}
    </div>
  `;
}

/**
 * Input de Búsqueda con Icono y Sugerencias de Autocompletado
 * @param {Object} options - Configuración del input.
 * @returns {string} Marcado HTML.
 */
export function renderSearchInput(options) {
  const {
    id,
    fieldName,
    label = '',
    placeholder = '',
    value = '',
    icon = '',
    disabled = false,
    hasSuggestions = false
  } = options;

  const escapedVal = escapeHtmlAttr(value || '');
  const escapedPlaceholder = escapeHtmlAttr(placeholder || '');
  const disabledAttr = disabled ? 'disabled' : '';

  let inputClass = 'w-full py-2 rounded-xl text-xs glass-input ';
  if (icon) {
    inputClass += 'pl-9 pr-3 ';
  } else {
    inputClass += 'px-3 ';
  }

  if (disabled) {
    inputClass += 'glass-input-disabled cursor-not-allowed text-text-tertiary';
  } else {
    inputClass += 'text-text-primary placeholder:text-text-tertiary';
  }

  let iconHtml = '';
  if (icon) {
    iconHtml = `
      <span class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-tertiary">
        <i data-lucide="${icon}" class="h-3.5 w-3.5"></i>
      </span>
    `;
  }

  let suggestionsHtml = '';
  if (hasSuggestions) {
    suggestionsHtml = `
      <div id="suggestions-${fieldName}" class="suggestions-dropdown hidden absolute left-0 right-0 top-full mt-1 z-50 glass-card rounded-xl border border-border-ui shadow-xl overflow-hidden max-h-48 overflow-y-auto">
        <!-- Las sugerencias se inyectarán en tiempo de ejecución -->
      </div>
    `;
  }

  let badgeOverlayHtml = '';
  let inputExtraClass = '';
  let inputStyle = '';
  const isFocused = typeof document !== 'undefined' && document.activeElement && document.activeElement.id === id;
  if (value && !isFocused && hasSuggestions) {
    inputExtraClass = 'placeholder-transparent select-none';
    inputStyle = 'style="color: transparent !important;"';
    const overlayLeftClass = icon ? 'left-9' : 'left-2';
    badgeOverlayHtml = `
      <div data-element="badge-overlay" class="absolute inset-y-0 ${overlayLeftClass} right-2 flex items-center pointer-events-none">
        <div class="flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-border-ui text-text-primary text-[11px] font-semibold border border-border-ui shadow-sm max-w-[95%] pointer-events-auto">
          <span class="truncate max-w-[150px]">${escapeHtml(value)}</span>
          <button type="button" 
                  title="Limpiar valor seleccionado"
                  aria-label="Limpiar valor seleccionado"
                  data-action="clear-input-badge" 
                  data-field="${fieldName}" 
                  data-input-id="${id}"
                  class="text-text-tertiary hover:text-text-primary hover:bg-bg-header rounded p-0.5 transition-colors flex items-center justify-center shrink-0">
            <i data-lucide="x" class="h-3 w-3"></i>
          </button>
        </div>
      </div>
    `;
  }

  return `
    <div class="space-y-1 relative w-full" id="container-filter-${fieldName}">
      ${label ? `<label for="${id}" class="block text-[10px] font-bold text-text-tertiary uppercase tracking-wider">${label}</label>` : ''}
      <div class="relative w-full flex items-center">
        ${iconHtml}
        <input type="text" 
               id="${id}" 
               data-component="search-input"
               data-field="${fieldName}"
               data-autocomplete="${hasSuggestions}"
               value="${escapedVal}" 
               placeholder="${escapedPlaceholder}" 
               autocomplete="off"
               ${disabledAttr}
               ${inputStyle}
               class="${inputClass} ${inputExtraClass}">
        ${badgeOverlayHtml}
      </div>
      ${suggestionsHtml}
    </div>
  `;
}

/**
 * Sincroniza dinámicamente el badge/chip de un input de búsqueda autocompletable.
 * @param {HTMLElement|string} inputOrId - Elemento input o su ID.
 * @param {string} [customValue] - Valor opcional a forzar (si no se pasa, toma input.value).
 */
export function syncSearchInputBadge(inputOrId, customValue) {
  if (typeof document === 'undefined') return;
  const input = typeof inputOrId === 'string' ? document.getElementById(inputOrId) : inputOrId;
  if (!input) return;

  const fieldName = input.dataset.field || '';
  const hasSuggestions = input.dataset.autocomplete === 'true';
  const id = input.id;
  const val = (customValue !== undefined ? customValue : input.value || '').trim();
  const wrapper = input.closest('.relative');
  if (!wrapper) return;

  let overlay = wrapper.querySelector('[data-element="badge-overlay"]');
  const isFocused = document.activeElement && document.activeElement.id === id;

  if (val && !isFocused && hasSuggestions) {
    input.classList.add('placeholder-transparent', 'select-none');
    input.style.setProperty('color', 'transparent', 'important');

    const overlayLeftClass = input.classList.contains('pl-9') ? 'left-9' : 'left-2';

    if (!overlay) {
      overlay = document.createElement('div');
      overlay.dataset.element = 'badge-overlay';
      overlay.className = `absolute inset-y-0 ${overlayLeftClass} right-2 flex items-center pointer-events-none`;
      wrapper.appendChild(overlay);
    }
    overlay.classList.remove('hidden');
    overlay.innerHTML = `
      <div class="flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-border-ui text-text-primary text-[11px] font-semibold border border-border-ui shadow-sm max-w-[95%] pointer-events-auto">
        <span class="truncate max-w-[150px]">${escapeHtml(val)}</span>
        <button type="button" 
                title="Limpiar valor seleccionado"
                aria-label="Limpiar valor seleccionado"
                data-action="clear-input-badge" 
                data-field="${escapeHtmlAttr(fieldName)}" 
                data-input-id="${escapeHtmlAttr(id)}"
                class="text-text-tertiary hover:text-text-primary hover:bg-bg-header rounded p-0.5 transition-colors flex items-center justify-center shrink-0">
          <i data-lucide="x" class="h-3 w-3"></i>
        </button>
      </div>
    `;
    if (typeof lucide !== 'undefined' && lucide.createIcons) {
      lucide.createIcons();
    }
  } else {
    input.classList.remove('placeholder-transparent', 'select-none');
    input.style.removeProperty('color');
    if (overlay) {
      overlay.remove();
    }
  }
}

/**
 * Input de Fecha con máscara DD/MM/AAAA
 * @param {Object} options - Configuración.
 * @returns {string} Marcado HTML.
 */
export function renderDateInput(options) {
  const {
    id,
    fieldName,
    label = '',
    value = '',
    min = '',
    max = ''
  } = options;

  let displayValue = '';
  if (value && value.length === 10) {
    const [y, m, d] = value.split('-');
    if (y && m && d) displayValue = `${d}/${m}/${y}`;
  }

  const escapedVal = escapeHtmlAttr(value || '');
  const minAttr = min ? `min="${escapeHtmlAttr(min)}"` : '';
  const maxAttr = max ? `max="${escapeHtmlAttr(max)}"` : '';

  return `
    <div class="space-y-1 w-full">
      ${label ? `<label for="${id}-display" class="block text-[10px] font-bold text-text-tertiary uppercase tracking-wider">${label}</label>` : ''}
      <div class="relative w-full flex items-center">
        <input type="text"
               id="${id}-display"
               data-date-display="true"
               data-date-target="${id}"
               data-field="${fieldName}"
               placeholder="DD/MM/AAAA"
               maxlength="10"
               autocomplete="off"
               readonly
               value="${escapeHtmlAttr(displayValue)}"
               class="datepicker-display-input w-full pl-3 pr-9 py-2 rounded-xl text-xs glass-input text-text-primary placeholder:text-text-tertiary tracking-widest cursor-pointer">
        <button type="button"
                title="Abrir selector de calendario"
                aria-label="Abrir selector de calendario"
                data-datepicker-trigger="${id}"
                class="absolute right-2 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-brand-500 transition-colors p-0.5">
          <i data-lucide="calendar" class="h-3.5 w-3.5"></i>
        </button>
        <input type="date"
               id="${id}"
               data-component="date-input"
               data-field="${fieldName}"
               value="${escapedVal}"
               ${minAttr}
               ${maxAttr}
               tabindex="-1"
               class="sr-only">
      </div>
    </div>
  `;
}

/**
 * Cápsula Unificada de Rango de Fechas (Diseño Canónico Horizontal con selectores independientes)
 * @param {Object} options
 * @param {string} [options.idPrefix='dashboard-filter-'] - Prefijo de IDs (ej: 'viajes-filter-')
 * @param {string} [options.fechaInicio=''] - Valor ISO de fecha inicio (YYYY-MM-DD)
 * @param {string} [options.fechaTermino=''] - Valor ISO de fecha término (YYYY-MM-DD)
 * @param {string} [options.onChange=''] - Nombre o expresión opcional onChange para los inputs nativos
 * @returns {string} Marcado HTML de la cápsula
 */
export function renderDualDatePicker(options = {}) {
  const {
    idPrefix = 'dashboard-filter-',
    fechaInicio = '',
    fechaTermino = '',
    onChange = ''
  } = options;

  const startId = `${idPrefix}fechainicio`;
  const endId = `${idPrefix}fechatermino`;

  // Formatear fechas a DD/MM/AAAA para presentación
  const formatDisplay = (val) => {
    if (!val) return '';
    const str = String(val).trim();
    if (str.includes('T') || str.includes('-')) {
      const parts = str.split('T')[0].split('-');
      if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
    }
    return str;
  };

  const displayStart = formatDisplay(fechaInicio);
  const displayEnd = formatDisplay(fechaTermino);
  const onChangeStart = onChange ? `onchange="${onChange}('fechaInicio', this.value)"` : '';
  const onChangeEnd = onChange ? `onchange="${onChange}('fechaTermino', this.value)"` : '';

  return `
    <div class="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200/60 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs shadow-2xs shrink-0">
      <i data-lucide="calendar" class="h-3.5 w-3.5 text-slate-400 shrink-0"></i>
      
      <!-- Selector Desde -->
      <div class="flex items-center gap-1">
        <span class="text-[11px] font-semibold text-slate-500 whitespace-nowrap">Desde:</span>
        <input type="text"
               id="${startId}-display"
               data-date-display="true"
               data-date-target="${startId}"
               data-field="fechaInicio"
               placeholder="DD/MM/AAAA"
               readonly
               value="${escapeHtmlAttr(displayStart)}"
               class="datepicker-display-input bg-transparent border-0 text-xs font-semibold text-text-primary focus:outline-none cursor-pointer w-24 text-center">
        <input type="date"
               id="${startId}"
               data-component="date-input"
               data-field="fechaInicio"
               value="${escapeHtmlAttr(fechaInicio || '')}"
               tabindex="-1"
               ${onChangeStart}
               class="sr-only">
      </div>

      <!-- Separador discreto -->
      <span class="text-slate-200 dark:text-slate-700 select-none">|</span>

      <!-- Selector Hasta -->
      <div class="flex items-center gap-1">
        <span class="text-[11px] font-semibold text-slate-500 whitespace-nowrap">Hasta:</span>
        <input type="text"
               id="${endId}-display"
               data-date-display="true"
               data-date-target="${endId}"
               data-field="fechaTermino"
               placeholder="DD/MM/AAAA"
               readonly
               value="${escapeHtmlAttr(displayEnd)}"
               class="datepicker-display-input bg-transparent border-0 text-xs font-semibold text-text-primary focus:outline-none cursor-pointer w-24 text-center">
        <input type="date"
               id="${endId}"
               data-component="date-input"
               data-field="fechaTermino"
               value="${escapeHtmlAttr(fechaTermino || '')}"
               tabindex="-1"
               ${onChangeEnd}
               class="sr-only">
      </div>
    </div>
  `;
}

export const renderDateRangeCapsule = renderDualDatePicker;

/**
 * Selector de Opciones Estándar (Custom Dropdown Premium)
 * @param {Object} options - Configuración.
 * @returns {string} Marcado HTML.
 */
export function renderSelectInput(options) {
  const {
    id,
    fieldName,
    label = '',
    value = '',
    optionsList = []
  } = options;

  const selectedOpt = optionsList.find(opt => String(opt.value) === String(value)) || optionsList[0];
  const selectedOptionText = selectedOpt ? selectedOpt.text : 'Seleccionar...';

  const optionsHtml = optionsList.map(opt => {
    const selectedAttr = String(opt.value) === String(value) ? 'selected' : '';
    return `<option value="${escapeHtmlAttr(opt.value)}" ${selectedAttr}>${opt.text}</option>`;
  }).join('');

  const customOptionsHtml = optionsList.map(opt => {
    const isSelected = String(opt.value) === String(value);
    const activeClass = isSelected ? 'bg-brand-500/15 font-semibold text-brand-600 dark:text-brand-400' : '';
    return `
      <div onclick="selectCustomOption(event, '${id}', '${escapeHtmlAttr(opt.value)}', '${escapeHtmlAttr(opt.text)}')"
           class="custom-select-item px-3 py-2 text-xs text-text-primary hover:bg-brand-500 hover:text-white cursor-pointer transition-colors truncate ${activeClass}">
        ${opt.text}
      </div>
    `;
  }).join('');

  return `
    <div class="space-y-1 w-full relative">
      ${label ? `<label for="${id}" class="block text-[10px] font-bold text-text-tertiary uppercase tracking-wider">${label}</label>` : ''}
      <div class="relative w-full font-sans">
        <select id="${id}" class="hidden glass-input" data-component="select-input" data-field="${fieldName}">
          ${optionsHtml}
        </select>
        
        <button type="button" 
                id="custom-select-trigger-${id}"
                onclick="toggleCustomSelectDropdown(event, '${id}')"
                class="w-full pl-3 pr-10 py-2 rounded-xl text-xs glass-input text-text-primary text-left relative flex items-center justify-between cursor-pointer hover:border-border-ui transition-all duration-200">
          <span class="truncate">${selectedOptionText}</span>
          <span class="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-text-tertiary">
            <i data-lucide="chevron-down" class="h-3.5 w-3.5"></i>
          </span>
        </button>
        
        <div id="custom-select-dropdown-${id}" 
             class="custom-select-dropdown hidden absolute left-0 right-0 top-full mt-1 z-50 glass-card rounded-xl border border-border-ui shadow-xl overflow-hidden max-h-48 overflow-y-auto">
          ${customOptionsHtml}
        </div>
      </div>
    </div>
  `;
}

/**
 * Badge de Estado Pasivo y Formateador Estructural
 * @param {Object} badgeData - Contiene { text, subtext, class }.
 * @returns {string} Marcado HTML.
 */
export function renderStatusBadge(badgeData) {
  if (!badgeData) return '';
  const { text = '', subtext = '', class: badgeClass = '' } = badgeData;
  if (subtext) {
    return `
      <div class="w-full text-center px-2 py-1 rounded-lg ${badgeClass}">
        <div class="text-[10px] font-semibold leading-none">${text}</div>
        <div class="text-[9px] opacity-90 mt-1.5 font-medium leading-none whitespace-nowrap">${subtext}</div>
      </div>
    `;
  }
  return `
    <div class="w-full text-center px-2 py-1 rounded-lg text-[10px] font-semibold ${badgeClass} whitespace-nowrap">
      ${text}
    </div>
  `;
}

/**
 * Generador de controles de paginación
 * @param {string} viewName - Nombre de la vista para changePage.
 * @param {number} totalItems - Total de elementos.
 * @param {number} currentPage - Página actual.
 * @param {number} pageSize - Elementos por página.
 * @returns {string} Marcado HTML.
 */
export function renderPaginationControls(
  viewName,
  totalItems,
  currentPage,
  pageSize = 10,
) {
  const totalPages = Math.ceil(totalItems / pageSize);
  if (totalPages <= 1) return '';

  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  let pages = [];
  const maxVisiblePages = 5;
  let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
  let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

  if (endPage - startPage + 1 < maxVisiblePages) {
    startPage = Math.max(1, endPage - maxVisiblePages + 1);
  }

  for (let i = startPage; i <= endPage; i++) {
    pages.push(i);
  }

  let buttonsHtml = '';

  const prevDisabled = currentPage === 1;
  buttonsHtml += `
    <button onclick="${prevDisabled ? '' : `changePage('${viewName}', ${currentPage - 1})`}" 
            class="h-8 w-8 rounded-lg flex items-center justify-center border border-border-ui bg-bg-card text-text-secondary hover:text-text-primary transition-all ${prevDisabled ? 'opacity-40 cursor-not-allowed' : 'hover:bg-border-ui/50'}" 
            title="Anterior">
      <i data-lucide="chevron-left" class="h-4 w-4 text-text-secondary"></i>
    </button>
  `;

  if (startPage > 1) {
    buttonsHtml += `
      <button onclick="changePage('${viewName}', 1)" class="h-8 px-3 rounded-lg border border-border-ui bg-bg-card text-text-secondary hover:text-text-primary hover:bg-border-ui/50 transition-all text-xs font-semibold font-sans">1</button>
    `;
    if (startPage > 2) {
      buttonsHtml += `<span class="text-text-secondary text-xs px-1 font-sans">...</span>`;
    }
  }

  pages.forEach((p) => {
    const isCurrent = p === currentPage;
    buttonsHtml += `
      <button onclick="changePage('${viewName}', ${p})" 
              class="h-8 w-8 rounded-lg flex items-center justify-center text-xs font-semibold font-sans transition-all ${ isCurrent ? 'bg-brand-600 text-white shadow-md shadow-brand-500/20'
                  : 'border border-border-ui bg-bg-card text-text-secondary hover:text-text-primary hover:bg-border-ui/50'
              }">
        ${p}
      </button>
    `;
  });

  if (endPage < totalPages) {
    if (endPage < totalPages - 1) {
      buttonsHtml += `<span class="text-text-secondary text-xs px-1 font-sans">...</span>`;
    }
    buttonsHtml += `
      <button onclick="changePage('${viewName}', ${totalPages})" class="h-8 px-3 rounded-lg border border-border-ui bg-bg-card text-text-secondary hover:text-text-primary hover:bg-border-ui/50 transition-all text-xs font-semibold font-sans">${totalPages}</button>
    `;
  }

  const nextDisabled = currentPage === totalPages;
  buttonsHtml += `
    <button onclick="${nextDisabled ? '' : `changePage('${viewName}', ${currentPage + 1})`}" 
            class="h-8 w-8 rounded-lg flex items-center justify-center border border-border-ui bg-bg-card text-text-secondary hover:text-text-primary transition-all ${nextDisabled ? 'opacity-40 cursor-not-allowed' : 'hover:bg-border-ui/50'}" 
            title="Siguiente">
      <i data-lucide="chevron-right" class="h-4 w-4 text-text-secondary"></i>
    </button>
  `;

  return `
    <div class="p-4 border-t border-border-ui flex flex-col sm:flex-row items-center justify-between gap-4 bg-bg-card">
      <div class="text-xs text-text-secondary font-semibold">
        Mostrando <span class="text-text-primary font-bold">${startItem}</span> a <span class="text-text-primary font-bold">${endItem}</span> de <span class="text-text-primary font-bold">${totalItems}</span> registros
      </div>
      <div class="flex items-center gap-1.5 font-sans">
        ${buttonsHtml}
      </div>
    </div>
  `;
}

/**
 * Selector de Vigencia para Sujetos Pasivos
 * @param {Object} params - { id, value, onChange, asInput }
 * @returns {string} Marcado HTML.
 */
export function renderVigenciaSelect({ id, value, onChange, asInput = false }) {
  const currentVal = value || 'todos';
  const isVigenciaDefault = !currentVal || currentVal === 'todos';
  const currentLabel = isVigenciaDefault
    ? (asInput ? 'Todos los Sujetos' : 'Vigencia')
    : (currentVal === 'vigentes' ? 'Vigentes' : 'No Vigentes');

  const options = [
    { value: 'todos', label: 'Todos' },
    { value: 'vigentes', label: 'Vigentes' },
    { value: 'no_vigentes', label: 'No Vigentes' }
  ];

  const optionsHtml = options.map(opt => {
    const isSelected = opt.value === currentVal;
    return `
      <div data-value="${opt.value}" data-label="${opt.label}"
           onclick="selectVigenciaOption(event, '${id}', '${opt.value}', '${opt.label}', '${onChange}')"
           class="px-3 py-1.5 text-xs flex items-center justify-between cursor-pointer transition-colors rounded-lg mx-1 my-0.5 ${ isSelected ? 'bg-brand-600/15 dark:bg-brand-500/20 text-brand-600 dark:text-brand-400 font-bold' : 'text-text-secondary hover:bg-border-ui dark:hover:bg-border-ui/50 hover:text-brand-600 dark:hover:text-brand-400 font-normal' }">
        <span>${opt.label}</span>
        ${isSelected ? '<i data-lucide="check" class="h-3.5 w-3.5 text-brand-600 dark:text-brand-400 shrink-0"></i>' : ''}
      </div>
    `;
  }).join('');

  if (asInput) {
    return `
      <div class="relative w-full font-sans select-none" id="vigencia-container-${id}">
        <button type="button"
                id="custom-select-trigger-${id}"
                onclick="toggleCustomSelectDropdown(event, '${id}')"
                class="w-full pl-3 pr-10 py-2 rounded-xl text-xs glass-input text-text-primary text-left relative flex items-center justify-between cursor-pointer hover:border-border-ui transition-all duration-200">
          <span class="truncate">${currentLabel}</span>
          <span class="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-text-tertiary">
            <i data-lucide="chevron-down" class="h-3.5 w-3.5"></i>
          </span>
        </button>
        <div id="custom-select-dropdown-${id}"
             class="custom-select-dropdown hidden absolute left-0 right-0 top-full mt-1 z-50 glass-card rounded-xl border border-border-ui shadow-xl overflow-hidden max-h-48 overflow-y-auto py-1">
          ${optionsHtml}
        </div>
      </div>
    `;
  }

  return `
    <div class="relative inline-block font-sans select-none" id="vigencia-container-${id}">
      <div class="flex items-center gap-1.5 bg-white dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200/60 dark:border-slate-700 text-xs shadow-2xs w-[125px] justify-between">
        <button type="button"
                id="custom-select-trigger-${id}"
                onclick="toggleCustomSelectDropdown(event, '${id}')"
                class="bg-transparent border-0 text-[11px] focus:outline-none cursor-pointer flex items-center justify-between gap-1 pr-0.5 hover:text-brand-500 transition-colors flex-1 min-w-0">
          <span class="truncate ${isVigenciaDefault ? 'text-slate-400 font-medium' : 'text-brand-600 dark:text-brand-400 font-bold'}" id="custom-select-label-${id}">${currentLabel}</span>
          <i data-lucide="chevron-down" class="h-3 w-3 shrink-0 opacity-70"></i>
        </button>
      </div>
      
      <div id="custom-select-dropdown-${id}"
           class="custom-select-dropdown hidden absolute left-0 top-full mt-1.5 z-50 glass-card bg-white dark:bg-slate-800 backdrop-blur-md rounded-xl border border-slate-100 shadow-xl py-1 min-w-[140px]">
        ${optionsHtml}
      </div>
    </div>
  `;
}

/**
 * Selector Personalizado de Año Glassmorphism (Sin elementos nativos del OS)
 * @param {string|number} { id - Parámetro { id.
 * @param {*} value - Parámetro value.
 * @param {*} onChange - Parámetro onChange.
 */
export function renderAnioSelect({ id = 'dashboard-filter-anio', value = '', onChange = 'changeDashboardAnio' }) {
  const currentVal = value || '';
  const isAnioDefault = !currentVal;
  const currentLabel = isAnioDefault ? 'Año' : currentVal;

  const years = [
    { value: '', label: 'Todos los años', display: 'Año' },
    { value: '2026', label: '2026', display: '2026' },
    { value: '2025', label: '2025', display: '2025' },
    { value: '2024', label: '2024', display: '2024' },
    { value: '2023', label: '2023', display: '2023' }
  ];

  const optionsHtml = years.map(opt => {
    const isSelected = opt.value === currentVal;
    return `
      <div data-value="${opt.value}" data-label="${opt.display}"
           onclick="selectAnioOption(event, '${id}', '${opt.value}', '${opt.display}', '${onChange}')"
           class="px-3 py-1.5 text-xs flex items-center justify-between cursor-pointer transition-colors rounded-lg mx-1 my-0.5 ${ isSelected ? 'bg-brand-600/15 dark:bg-brand-500/20 text-brand-600 dark:text-brand-400 font-bold' : 'text-text-secondary hover:bg-border-ui dark:hover:bg-border-ui/50 hover:text-brand-600 dark:hover:text-brand-400 font-normal' }">
        <span>${opt.label}</span>
        ${isSelected ? '<i data-lucide="check" class="h-3.5 w-3.5 text-brand-600 dark:text-brand-400 shrink-0"></i>' : ''}
      </div>
    `;
  }).join('');

  return `
    <div class="relative inline-block font-sans select-none" id="anio-container-${id}">
      <div class="flex items-center gap-1.5 bg-white dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200/60 dark:border-slate-700 text-xs shadow-2xs w-[110px] justify-between">
        <button type="button"
                id="custom-select-trigger-${id}"
                onclick="toggleCustomSelectDropdown(event, '${id}')"
                class="bg-transparent border-0 text-[11px] focus:outline-none cursor-pointer flex items-center justify-between gap-1 pr-0.5 hover:text-brand-500 transition-colors flex-1 min-w-0">
          <span class="truncate ${isAnioDefault ? 'text-slate-400 font-medium' : 'text-brand-600 dark:text-brand-400 font-bold'}" id="custom-select-label-${id}">${currentLabel}</span>
          <i data-lucide="chevron-down" class="h-3 w-3 shrink-0 opacity-70"></i>
        </button>
      </div>
      
      <div id="custom-select-dropdown-${id}"
           class="custom-select-dropdown hidden absolute left-0 top-full mt-1.5 z-50 glass-card bg-white dark:bg-slate-800 backdrop-blur-md rounded-xl border border-slate-100 shadow-xl py-1 min-w-[140px]">
        ${optionsHtml}
      </div>
    </div>
  `;
}

export function selectAnioOption(event, selectId, value, label, onChangeName) {
  if (event) event.stopPropagation();
  const dropdownEl = document.getElementById(`custom-select-dropdown-${selectId}`);
  if (dropdownEl) dropdownEl.classList.add('hidden');
  const labelEl = document.getElementById(`custom-select-label-${selectId}`);
  if (labelEl) {
    const isDefault = !value;
    labelEl.textContent = isDefault ? 'Año' : value;
    labelEl.className = `truncate ${isDefault ? 'text-slate-400 font-medium' : 'text-brand-600 dark:text-brand-400 font-bold'}`;
  }
  if (onChangeName && typeof window[onChangeName] === 'function') {
    window[onChangeName](value);
  }
}

/**
 * Selector Personalizado de Cargo Glassmorphism (Lista desplegable por autoridad)
 * @param {string|number} { id - Parámetro { id.
 * @param {*} value - Parámetro value.
 * @param {*} nombre - Parámetro nombre.
 * @param {*} onChange - Parámetro onChange.
 */
export function renderCargoSelect({ id = 'dashboard-filter-cargo', value = '', nombre = '', onChange = 'changeDashboardCargo' }) {
  const hasNombre = !!(nombre && nombre.trim());
  const cargosList = (hasNombre && typeof window !== 'undefined' && typeof window.getCargosForNombre === 'function')
    ? window.getCargosForNombre(nombre)
    : [];

  const currentVal = value || '';
  const isCargoDefault = !currentVal;
  const currentLabel = !hasNombre
    ? 'Cargo...'
    : (isCargoDefault ? 'Cargo' : currentVal);

  let optionsHtml = '';
  if (hasNombre) {
    const allOptions = [{ value: '', label: 'Todos los cargos', display: 'Cargo' }, ...cargosList.map(c => ({ value: c, label: c, display: c }))];
    optionsHtml = allOptions.map(opt => {
      const isSelected = opt.value === currentVal;
      return `
        <div data-value="${escapeHtmlAttr(opt.value)}" data-label="${escapeHtmlAttr(opt.display)}"
             onclick="selectCargoOption(event, '${id}', '${escapeHtmlAttr(opt.value)}', '${escapeHtmlAttr(opt.display)}', '${onChange}')"
             class="px-3 py-1.5 text-xs flex items-center justify-between cursor-pointer transition-colors rounded-lg mx-1 my-0.5 ${ isSelected ? 'bg-brand-600/15 dark:bg-brand-500/20 text-brand-600 dark:text-brand-400 font-bold' : 'text-text-secondary hover:bg-border-ui dark:hover:bg-border-ui/50 hover:text-brand-600 dark:hover:text-brand-400 font-normal' }">
          <span class="truncate">${escapeHtml(opt.label)}</span>
          ${isSelected ? '<i data-lucide="check" class="h-3.5 w-3.5 text-brand-600 dark:text-brand-400 shrink-0"></i>' : ''}
        </div>
      `;
    }).join('');
  }

  const disabledClass = hasNombre ? '' : 'opacity-50 cursor-not-allowed';

  return `
    <div class="relative inline-block font-sans select-none ${disabledClass}" id="cargo-container-${id}">
      <div class="flex items-center gap-1.5 bg-white dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200/60 dark:border-slate-700 text-xs shadow-2xs w-[170px] justify-between">
        <div class="flex items-center gap-1.5 min-w-0 flex-1">
          <i data-lucide="briefcase" class="h-3.5 w-3.5 text-slate-400 shrink-0"></i>
          <button type="button"
                  id="custom-select-trigger-${id}"
                  ${hasNombre ? `onclick="toggleCustomSelectDropdown(event, '${id}')"` : 'disabled'}
                  class="bg-transparent border-0 text-[11px] ${hasNombre ? 'cursor-pointer' : 'cursor-not-allowed'} focus:outline-none flex items-center justify-between gap-1 pr-0.5 hover:text-brand-500 transition-colors flex-1 min-w-0">
            <span class="truncate ${isCargoDefault || !hasNombre ? 'text-slate-400 font-medium' : 'text-brand-600 dark:text-brand-400 font-bold'}" id="custom-select-label-${id}">${currentLabel}</span>
            ${hasNombre ? '<i data-lucide="chevron-down" class="h-3 w-3 shrink-0 opacity-70"></i>' : ''}
          </button>
        </div>
      </div>
      
      ${hasNombre ? `
        <div id="custom-select-dropdown-${id}"
             class="custom-select-dropdown hidden absolute left-0 top-full mt-1.5 z-50 glass-card bg-white dark:bg-slate-800 backdrop-blur-md rounded-xl border border-slate-100 shadow-xl py-1 min-w-[200px] max-h-56 overflow-y-auto">
          ${optionsHtml}
        </div>
      ` : ''}
    </div>
  `;
}

export function selectCargoOption(event, selectId, value, label, onChangeName) {
  if (event) event.stopPropagation();
  const dropdownEl = document.getElementById(`custom-select-dropdown-${selectId}`);
  if (dropdownEl) dropdownEl.classList.add('hidden');
  const labelEl = document.getElementById(`custom-select-label-${selectId}`);
  if (labelEl) {
    const isDefault = !value;
    labelEl.textContent = isDefault ? 'Cargo' : label;
    labelEl.className = `truncate ${isDefault ? 'text-slate-400 font-medium' : 'text-brand-600 dark:text-brand-400 font-bold'}`;
  }
  if (onChangeName && typeof window[onChangeName] === 'function') {
    window[onChangeName](value);
  }
}

/**
 * CONTROLADORES DE EVENTOS PARA SELECTORES PERSONALIZADOS
 * @param {Event} event - Parámetro event.
 * @param {string|number} selectId - Parámetro selectId.
 */

export function toggleCustomSelectDropdown(event, selectId) {
  if (event) event.stopPropagation();
  if (typeof document === 'undefined') return;
  
  const targetDropdown = document.getElementById(`custom-select-dropdown-${selectId}`);
  if (!targetDropdown) return;
  
  const isHidden = targetDropdown.classList.contains('hidden');
  
  document.querySelectorAll('.custom-select-dropdown').forEach(dropdown => {
    dropdown.classList.add('hidden');
  });
  
  if (isHidden) {
    targetDropdown.classList.remove('hidden');
  }
}

export function selectCustomOption(event, selectId, value, text) {
  if (event) event.stopPropagation();
  if (typeof document === 'undefined') return;
  
  const selectEl = document.getElementById(selectId);
  if (selectEl) {
    selectEl.value = value;
    selectEl.dispatchEvent(new Event('change', { bubbles: true }));
  }
  
  const triggerEl = document.getElementById(`custom-select-trigger-${selectId}`);
  if (triggerEl) {
    const span = triggerEl.querySelector('span.truncate');
    if (span) span.textContent = text;
  }
  
  const dropdownEl = document.getElementById(`custom-select-dropdown-${selectId}`);
  if (dropdownEl) {
    dropdownEl.classList.add('hidden');
  }
}

export function selectVigenciaOption(event, selectId, value, label, onChangeName) {
  if (event) event.stopPropagation();
  if (typeof document === 'undefined') return;
  
  const dropdownEl = document.getElementById(`custom-select-dropdown-${selectId}`);
  if (dropdownEl) {
    dropdownEl.classList.add('hidden');
    
    const optionEls = dropdownEl.querySelectorAll('[data-value]');
    optionEls.forEach(optEl => {
      const optVal = optEl.getAttribute('data-value');
      const optLabel = optEl.getAttribute('data-label') || optEl.textContent.trim();
      const isSelected = optVal === value;
      if (isSelected) {
        optEl.className = 'px-3 py-1.5 text-xs flex items-center justify-between cursor-pointer transition-colors rounded-lg mx-1 my-0.5 bg-brand-500/15 text-brand-600 dark:text-brand-400 font-bold';
        optEl.innerHTML = `<span>${optLabel}</span><i data-lucide="check" class="h-3.5 w-3.5 text-brand-600 dark:text-brand-400 shrink-0"></i>`;
      } else {
        optEl.className = 'px-3 py-1.5 text-xs flex items-center justify-between cursor-pointer transition-colors rounded-lg mx-1 my-0.5 text-text-primary hover:bg-border-ui hover:text-brand-500 font-normal';
        optEl.innerHTML = `<span>${optLabel}</span>`;
      }
    });
    if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
  }

  const triggerEl = document.getElementById(`custom-select-trigger-${selectId}`);
  if (triggerEl) {
    const span = triggerEl.querySelector('span.truncate');
    if (span) span.textContent = label;
  }

  if (typeof window !== 'undefined' && typeof window[onChangeName] === 'function') {
    window[onChangeName](value);
  }
}

// Compatibilidad retroactiva para llamadas inline desde HTML y código legacy
if (typeof window !== 'undefined') {
  window.renderGlassCard = window.renderGlassCard || renderGlassCard;
  window.renderSearchInput = window.renderSearchInput || renderSearchInput;
  window.syncSearchInputBadge = window.syncSearchInputBadge || syncSearchInputBadge;
  window.renderDateInput = window.renderDateInput || renderDateInput;
  window.renderDualDatePicker = window.renderDualDatePicker || renderDualDatePicker;
  window.renderDateRangeCapsule = window.renderDateRangeCapsule || renderDualDatePicker;
  window.renderSelectInput = window.renderSelectInput || renderSelectInput;
  window.renderStatusBadge = window.renderStatusBadge || renderStatusBadge;
  window.renderPaginationControls = window.renderPaginationControls || renderPaginationControls;
  window.renderVigenciaSelect = window.renderVigenciaSelect || renderVigenciaSelect;
  window.renderAnioSelect = window.renderAnioSelect || renderAnioSelect;
  window.renderCargoSelect = window.renderCargoSelect || renderCargoSelect;
  if (typeof renderTableListViewLayout !== 'undefined') {
    window.renderTableListViewLayout = renderTableListViewLayout;
  }
  if (typeof renderKpiCard !== 'undefined') {
    window.renderKpiCard = renderKpiCard;
  }
  if (typeof renderFilterBar !== 'undefined') {
    window.renderFilterBar = renderFilterBar;
    window.renderFilterChip = renderFilterChip;
    window.toggleFilterBarPanel = toggleFilterBarPanel;
  }
  window.toggleCustomSelectDropdown = toggleCustomSelectDropdown;
  window.selectCustomOption = selectCustomOption;
  window.selectVigenciaOption = selectVigenciaOption;
  window.selectAnioOption = selectAnioOption;
  window.selectCargoOption = selectCargoOption;

  if (!window.__uiDropdownClickBound && typeof document !== 'undefined') {
    window.__uiDropdownClickBound = true;
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.custom-select-dropdown') && !e.target.closest('[id^="custom-select-trigger-"]')) {
        document.querySelectorAll('.custom-select-dropdown').forEach(dropdown => {
          dropdown.classList.add('hidden');
        });
      }
    });
  }
}
