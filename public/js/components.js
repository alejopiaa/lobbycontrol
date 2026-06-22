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
    inputClass += 'glass-input-disabled cursor-not-allowed text-slate-400';
  } else {
    inputClass += 'text-slate-200 placeholder-slate-400';
  }

  let iconHtml = '';
  if (icon) {
    iconHtml = `
      <span class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-300">
        <i data-lucide="${icon}" class="h-3.5 w-3.5"></i>
      </span>
    `;
  }

  let suggestionsHtml = '';
  if (hasSuggestions) {
    suggestionsHtml = `
      <div id="suggestions-${fieldName}" class="suggestions-dropdown hidden absolute left-0 right-0 top-full mt-1 z-50 glass-card rounded-xl border border-slate-700/60 shadow-xl overflow-hidden max-h-48 overflow-y-auto">
        <!-- Las sugerencias se inyectarán en tiempo de ejecución -->
      </div>
    `;
  }

  // Generar el badge si el input tiene valor seleccionado (y no está enfocado)
  let badgeOverlayHtml = '';
  let inputExtraClass = '';
  let inputStyle = '';
  const isFocused = typeof document !== 'undefined' && document.activeElement && document.activeElement.id === id;
  if (value && !isFocused) {
    inputExtraClass = 'placeholder-transparent select-none';
    inputStyle = 'style="color: transparent !important;"';
    const overlayLeftClass = icon ? 'left-9' : 'left-2';
    badgeOverlayHtml = `
      <div data-element="badge-overlay" class="absolute inset-y-0 ${overlayLeftClass} right-2 flex items-center pointer-events-none">
        <div class="flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-slate-200/90 dark:bg-slate-800/95 text-slate-800 dark:text-slate-200 text-[11px] font-semibold border border-slate-300 dark:border-slate-700/60 shadow-sm max-w-[95%] pointer-events-auto">
          <span class="truncate max-w-[150px]">${value}</span>
          <button type="button" 
                  data-action="clear-input-badge" 
                  data-field="${fieldName}" 
                  data-input-id="${id}"
                  class="text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-300 dark:hover:bg-slate-700/50 rounded p-0.5 transition-colors flex items-center justify-center shrink-0">
            <i data-lucide="x" class="h-3 w-3"></i>
          </button>
        </div>
      </div>
    `;
  }

  return `
    <div class="space-y-1 relative w-full" id="container-filter-${fieldName}">
      ${label ? `<label for="${id}" class="block text-[10px] font-bold text-slate-300 uppercase tracking-wider">${label}</label>` : ''}
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
      ${label ? `<label for="${id}-display" class="block text-[10px] font-bold text-slate-300 uppercase tracking-wider">${label}</label>` : ''}
      <div class="relative w-full flex items-center">
        <input type="text"
               id="${id}-display"
               data-date-display="true"
               data-date-target="${id}"
               data-field="${fieldName}"
               placeholder="DD/MM/AAAA"
               maxlength="10"
               autocomplete="off"
               value="${escapeHtmlAttr(displayValue)}"
               oninput="handleDateDisplayInput(this)"
               onkeydown="handleDateDisplayKeydown(event, this)"
               class="w-full pl-3 pr-9 py-2 rounded-xl text-xs glass-input text-slate-200 placeholder-slate-400 tracking-widest">
        <button type="button"
                onclick="toggleDateNativePicker('${id}')"
                class="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-brand-400 transition-colors p-0.5">
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
               class="sr-only"
               onchange="handleNativeDateChange(this)">
      </div>
    </div>
  `;
}


/**
 * Selector de Opciones Estándar
 * @param {Object} options - Configuración.
 * @returns {string} Marcado HTML.
 */
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
    const activeClass = isSelected ? 'bg-brand-600/20 font-semibold text-brand-600 dark:text-brand-400' : '';
    return `
      <div onclick="selectCustomOption(event, '${id}', '${escapeHtmlAttr(opt.value)}', '${escapeHtmlAttr(opt.text)}')"
           class="custom-select-item px-3 py-2 text-xs text-slate-200 hover:bg-brand-600 hover:text-white cursor-pointer transition-colors truncate ${activeClass}">
        ${opt.text}
      </div>
    `;
  }).join('');

  return `
    <div class="space-y-1 w-full relative">
      ${label ? `<label for="${id}" class="block text-[10px] font-bold text-slate-300 uppercase tracking-wider">${label}</label>` : ''}
      <div class="relative w-full font-sans">
        <!-- Select nativo oculto para compatibilidad de eventos y lectura de estado -->
        <select id="${id}" 
                data-component="select-input"
                data-field="${fieldName}"
                class="hidden">
          ${optionsHtml}
        </select>
        
        <!-- Botón disparador del selector customizado -->
        <button type="button" 
                id="custom-select-trigger-${id}"
                onclick="toggleCustomSelectDropdown(event, '${id}')"
                class="w-full pl-3 pr-10 py-2 rounded-xl text-xs glass-input text-slate-200 text-left relative flex items-center justify-between cursor-pointer hover:border-slate-500 transition-all duration-200">
          <span class="truncate">${selectedOptionText}</span>
          <span class="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-300">
            <i data-lucide="chevron-down" class="h-3.5 w-3.5"></i>
          </span>
        </button>
        
        <!-- Contenedor desplegable customizado (igual que los dropdowns de autocompletado) -->
        <div id="custom-select-dropdown-${id}" 
             class="custom-select-dropdown hidden absolute left-0 right-0 top-full mt-1 z-50 glass-card rounded-xl border border-slate-700/60 shadow-xl overflow-hidden max-h-48 overflow-y-auto">
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

// Cerrar todos los selectores personalizados al hacer clic fuera
document.addEventListener('click', (e) => {
  if (!e.target.closest('.custom-select-dropdown') && !e.target.closest('[id^="custom-select-trigger-"]')) {
    document.querySelectorAll('.custom-select-dropdown').forEach(dropdown => {
      dropdown.classList.add('hidden');
    });
  }
});

// =========================================================================
// CONTROLADORES PARA EL INPUT DE FECHA CON MÁSCARA DD/MM/AAAA
// =========================================================================

/**
 * Aplica máscara DD/MM/AAAA al input de texto de fecha.
 * Inserta las barras automáticamente y sincroniza el estado de filtros directamente.
 */
window.handleDateDisplayInput = function(el) {
  let raw = el.value.replace(/\D/g, ''); // Solo dígitos
  let masked = '';

  if (raw.length > 0) masked += raw.substring(0, 2);
  if (raw.length >= 3) masked += '/' + raw.substring(2, 4);
  if (raw.length >= 5) masked += '/' + raw.substring(4, 8);

  el.value = masked;

  const targetId = el.dataset.dateTarget;
  const fieldName = el.dataset.field;
  const hiddenInput = targetId ? document.getElementById(targetId) : null;

  if (masked.length === 10) {
    const [d, m, y] = masked.split('/');
    const isoDate = `${y}-${m}-${d}`;
    // Validar que sea una fecha real
    const dateObj = new Date(`${y}-${m}-${d}T00:00:00`);
    const isValid = dateObj instanceof Date && !isNaN(dateObj) &&
                    dateObj.getDate() === parseInt(d, 10) &&
                    dateObj.getMonth() + 1 === parseInt(m, 10);
    if (isValid) {
      if (hiddenInput) hiddenInput.value = isoDate;
      // Actualizar el estado de filtros directamente (sin re-renderizar el DOM)
      // El render se dispara en blur para no destruir el input activo
      if (typeof dashboardFilters !== 'undefined' && typeof currentView !== 'undefined' && currentView === 'dashboard') {
        dashboardFilters[fieldName] = isoDate;
      } else if (typeof reportesFilters !== 'undefined' && typeof currentView !== 'undefined' && currentView === 'reportes') {
        if (fieldName === 'fechaInicio') reportesFilters.fechaInicio = isoDate;
        else if (fieldName === 'fechaTermino') reportesFilters.fechaTermino = isoDate;
      }
    }
  } else if (masked.length === 0) {
    // Campo vaciado: limpiar el filtro
    if (hiddenInput) hiddenInput.value = '';
    if (typeof dashboardFilters !== 'undefined' && typeof currentView !== 'undefined' && currentView === 'dashboard') {
      dashboardFilters[fieldName] = '';
    } else if (typeof reportesFilters !== 'undefined' && typeof currentView !== 'undefined' && currentView === 'reportes') {
      if (fieldName === 'fechaInicio') reportesFilters.fechaInicio = '';
      else if (fieldName === 'fechaTermino') reportesFilters.fechaTermino = '';
    }
  } else {
    // Fecha incompleta: limpiar el input oculto pero mantener el filtro hasta que se complete
    if (hiddenInput) hiddenInput.value = '';
  }
};


/**
 * Maneja teclas especiales en el input de fecha:
 * - Backspace en posición de barra: elimina la barra automáticamente
 * - Enter/Tab: aplica el filtro inmediatamente
 */
window.handleDateDisplayKeydown = function(event, el) {
  const key = event.key;
  
  // Permitir navegación y edición normal
  if (['Tab', 'ArrowLeft', 'ArrowRight', 'Delete'].includes(key)) return;
  
  if (key === 'Enter') {
    event.preventDefault();
    el.blur(); // Dispara el blur que aplica el filtro
    return;
  }

  // Bloquear caracteres no numéricos (excepto Backspace, Delete)
  if (key !== 'Backspace' && !/^\d$/.test(key)) {
    event.preventDefault();
  }
};

/**
 * Abre el input type="date" nativo como picker al hacer clic en el ícono de calendario.
 */
window.toggleDateNativePicker = function(hiddenInputId) {
  const hiddenInput = document.getElementById(hiddenInputId);
  if (hiddenInput) {
    hiddenInput.style.position = 'absolute';
    hiddenInput.style.opacity = '0';
    hiddenInput.style.pointerEvents = 'auto';
    hiddenInput.style.width = '1px';
    hiddenInput.style.height = '1px';
    hiddenInput.removeAttribute('tabindex');
    hiddenInput.showPicker && hiddenInput.showPicker();
    hiddenInput.focus();
    // Restaurar el estado sr-only después del pick
    hiddenInput.addEventListener('change', function once() {
      hiddenInput.removeEventListener('change', once);
      hiddenInput.style.position = '';
      hiddenInput.style.opacity = '';
      hiddenInput.style.pointerEvents = '';
      hiddenInput.style.width = '';
      hiddenInput.style.height = '';
      hiddenInput.setAttribute('tabindex', '-1');
    }, { once: true });
    hiddenInput.addEventListener('blur', function onBlur() {
      hiddenInput.removeEventListener('blur', onBlur);
      hiddenInput.style.position = '';
      hiddenInput.style.opacity = '';
      hiddenInput.style.pointerEvents = '';
      hiddenInput.style.width = '';
      hiddenInput.style.height = '';
      hiddenInput.setAttribute('tabindex', '-1');
    }, { once: true });
  }
};

/**
 * Sincroniza el display de texto DD/MM/AAAA cuando el usuario elige fecha del picker nativo.
 * Se llama desde el onchange del input date oculto (picker nativo).
 * El evento change del input oculto burbujea automáticamente al listener global de app.js.
 */
window.handleNativeDateChange = function(hiddenInput) {
  const value = hiddenInput.value; // YYYY-MM-DD
  const displayId = hiddenInput.id + '-display';
  const displayEl = document.getElementById(displayId);
  if (displayEl) {
    if (value && value.length === 10) {
      const [y, m, d] = value.split('-');
      displayEl.value = `${d}/${m}/${y}`;
    } else {
      displayEl.value = '';
    }
  }
  // El evento change ya burbujea al listener global en app.js - no re-disparar.
};


