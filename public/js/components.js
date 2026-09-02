/**
 * Sistema de Componentes Globales de UI - LobbyFlow
 * Biblioteca de funciones puras de presentación (retorno de strings de marcado HTML)
 * Desacopladas de estado e interacciones mediante delegación de eventos unificada.
 */

/**
 * Contenedor de Tarjeta Glassmorphic
 * @param {string} content - Contenido HTML hijo.
 * @param {string} extraClasses - Clases CSS adicionales.
 * @returns {string} Marcado HTML del contenedor.
 */
function renderGlassCard(content, extraClasses = '') {
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
function renderSearchInput(options) {
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
  
  // Clases CSS según estado y diseño con iconos
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

  // Generar el badge si el input tiene valor seleccionado (y no está enfocado) y solo si es un input de sugerencias/autocompletado
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
          <span class="truncate max-w-[150px]">${value}</span>
          <button type="button" 
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
function syncSearchInputBadge(inputOrId, customValue) {
  const input = typeof inputOrId === 'string' ? document.getElementById(inputOrId) : inputOrId;
  if (!input) return;

  const fieldName = input.dataset.field || '';
  const hasSuggestions = input.dataset.autocomplete === 'true';
  const id = input.id;
  const val = (customValue !== undefined ? customValue : input.value || '').trim();
  const wrapper = input.closest('.relative');
  if (!wrapper) return;

  let overlay = wrapper.querySelector('[data-element="badge-overlay"]');
  const isFocused = typeof document !== 'undefined' && document.activeElement && document.activeElement.id === id;

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
window.syncSearchInputBadge = syncSearchInputBadge;

/**
 * Input de Fecha con máscara DD/MM/AAAA
 * Usa un input de texto visible (DD/MM/AAAA) y un input date oculto para almacenar el valor en YYYY-MM-DD.
 * @param {Object} options - Configuración.
 * @returns {string} Marcado HTML.
 */
function renderDateInput(options) {
  const {
    id,
    fieldName,
    label = '',
    value = '',
    min = '',
    max = ''
  } = options;

  // Convertir valor YYYY-MM-DD a DD/MM/AAAA para mostrar al usuario
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
 * Selector de Opciones Estándar (Custom Dropdown Premium)
 * @param {Object} options - Configuración.
 * @returns {string} Marcado HTML.
 */
function renderSelectInput(options) {
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
        <!-- Select nativo oculto para compatibilidad de eventos y lectura de estado -->
        <select id="${id}" class="hidden glass-input" data-component="select-input" data-field="${fieldName}">
          ${optionsHtml}
        </select>
        
        <!-- Botón disparador del selector customizado -->
        <button type="button" 
                id="custom-select-trigger-${id}"
                onclick="toggleCustomSelectDropdown(event, '${id}')"
                class="w-full pl-3 pr-10 py-2 rounded-xl text-xs glass-input text-text-primary text-left relative flex items-center justify-between cursor-pointer hover:border-border-ui transition-all duration-200">
          <span class="truncate">${selectedOptionText}</span>
          <span class="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-text-tertiary">
            <i data-lucide="chevron-down" class="h-3.5 w-3.5"></i>
          </span>
        </button>
        
        <!-- Contenedor desplegable customizado (igual que los dropdowns de autocompletado) -->
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
 * @param {Object} badgeData - Contiene { text, subtext, class } precalculados en helpers.js.
 * @returns {string} Marcado HTML.
 */
function renderStatusBadge(badgeData) {
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

// =========================================================================
// CONTROLADORES DE EVENTOS PARA EL SELECTOR PERSONALIZADO (CUSTOM SELECT)
// =========================================================================

window.toggleCustomSelectDropdown = function(event, selectId) {
  if (event) event.stopPropagation();
  
  const targetDropdown = document.getElementById(`custom-select-dropdown-${selectId}`);
  if (!targetDropdown) return;
  
  const isHidden = targetDropdown.classList.contains('hidden');
  
  // Cerrar todos los demás dropdowns primero
  document.querySelectorAll('.custom-select-dropdown').forEach(dropdown => {
    dropdown.classList.add('hidden');
  });
  
  if (isHidden) {
    targetDropdown.classList.remove('hidden');
  }
};

window.selectCustomOption = function(event, selectId, value, text) {
  if (event) event.stopPropagation();
  
  const selectEl = document.getElementById(selectId);
  if (selectEl) {
    selectEl.value = value;
    // Disparar evento change para que el listener global responda automáticamente
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
};

window.selectVigenciaOption = function(event, selectId, value, label, onChangeName) {
  if (event) event.stopPropagation();
  
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
    if (window.lucide) lucide.createIcons();
  }

  const triggerEl = document.getElementById(`custom-select-trigger-${selectId}`);
  if (triggerEl) {
    const span = triggerEl.querySelector('span.truncate');
    if (span) span.textContent = label;
  }

  if (typeof window[onChangeName] === 'function') {
    window[onChangeName](value);
  }
};

// Cerrar todos los selectores personalizados al hacer clic fuera
document.addEventListener('click', (e) => {
  if (!e.target.closest('.custom-select-dropdown') && !e.target.closest('[id^="custom-select-trigger-"]')) {
    document.querySelectorAll('.custom-select-dropdown').forEach(dropdown => {
      dropdown.classList.add('hidden');
    });
  }
});




