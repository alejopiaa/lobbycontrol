/**
 * dom-dispatcher.component.js - Delegación unificada de eventos DOM para componentes reactivos
 * Desacoplado de app.js para arquitectura modular ESM.
 */

// Helpers seguros para resolver estado global desacoplado de apps/scripts clásicos
const getCurrentView = () => window.currentView || (typeof currentView !== 'undefined' ? currentView : 'dashboard');
const getPState = () => window.paginationState || (typeof paginationState !== 'undefined' ? paginationState : {});
const getDashboardFilters = () => window.dashboardFilters || (typeof dashboardFilters !== 'undefined' ? dashboardFilters : {});
const getReportesFilters = () => window.reportesFilters || (typeof reportesFilters !== 'undefined' ? reportesFilters : {});
const getActiveAdminTab = () => window.activeAdminTab || (typeof activeAdminTab !== 'undefined' ? activeAdminTab : 'usuarios');

const callHandleSearch = (...args) => (window.handleSearch || (() => {}))(...args);
const callHandleMultiFilter = (...args) => (window.handleMultiFilter || (() => {}))(...args);
const callHandleDashboardInputWithSuggestions = (...args) => (window.handleDashboardInputWithSuggestions || (() => {}))(...args);
const callHandleDashboardInputKeydown = (...args) => (window.handleDashboardInputKeydown || (() => {}))(...args);
const callShowDashboardSuggestions = (...args) => (window.showDashboardSuggestions || (() => {}))(...args);
const callHideDashboardSuggestions = (...args) => (window.hideDashboardSuggestions || (() => {}))(...args);
const callSelectDashboardSuggestion = (...args) => (window.selectDashboardSuggestion || (() => {}))(...args);
const callGetActiveFiltersAndPrefix = () => (window.getActiveFiltersAndPrefix ? window.getActiveFiltersAndPrefix() : { idPrefix: 'dashboard-filter-', filters: {} });
const callTriggerRenderOrFetch = () => (window.triggerRenderOrFetch || (() => {}))();
const callClearReportesFilters = () => (window.clearReportesFilters || (() => {}))();
const callRenderView = () => (window.renderView || (() => {}))();
const callDebouncedReportesRender = (...args) => (window.debouncedReportesRender || (() => {}))(...args);
const callUpdateListView = (...args) => (window.updateListView || (() => {}))(...args);
const callUpdateReporteEstadoPillStyle = (...args) => (window.updateReporteEstadoPillStyle || (() => {}))(...args);
const callHandleReportesEstadoToggle = (...args) => (window.handleReportesEstadoToggle || (() => {}))(...args);

// 1. Eventos de Input (Escribir en campos)
document.addEventListener('input', (e) => {
  const target = e.target;
  
  if (target.dataset.component === 'search-input') {
    const fieldName = target.dataset.field;
    const isAutocomplete = target.dataset.autocomplete === 'true';
    
    if (isAutocomplete) {
      callHandleDashboardInputWithSuggestions(e, fieldName);
    } else {
      if (target.id === 'search-sujetos') {
        callHandleSearch('sujetos_pasivos', target.value);
      } else {
        callHandleMultiFilter(getCurrentView(), fieldName, target.value);
      }
    }
  }
});

// 2. Eventos de Keydown (Navegación por teclado en sugerencias)
document.addEventListener('keydown', (e) => {
  const target = e.target;
  if (target.dataset.component === 'search-input' && target.dataset.autocomplete === 'true') {
    const fieldName = target.dataset.field;
    callHandleDashboardInputKeydown(e, fieldName);
  }
});

// 3. Eventos de Focus (Mostrar sugerencias al enfocar)
document.addEventListener('focus', (e) => {
  const target = e.target;
  if (target.dataset.component === 'search-input') {
    if (target.dataset.autocomplete === 'true') {
      const fieldName = target.dataset.field;
      callShowDashboardSuggestions(fieldName);
    }
    
    target.classList.remove('placeholder-transparent', 'select-none');
    target.removeAttribute('style');
    const wrapper = target.closest('.relative');
    if (wrapper) {
      const overlay = wrapper.querySelector('[data-element="badge-overlay"]');
      if (overlay) {
        overlay.classList.add('hidden');
      }
    }
  }
}, true); // useCapture para eventos que no burbujean

// 4. Eventos de Click
document.addEventListener('click', (e) => {
  const target = e.target;
  
  const clearBadgeBtn = target.closest('[data-action="clear-input-badge"]');
  if (clearBadgeBtn) {
    e.preventDefault();
    e.stopPropagation();
    const fieldName = clearBadgeBtn.dataset.field;
    const inputId = clearBadgeBtn.dataset.inputId;
    
    const { idPrefix, filters } = callGetActiveFiltersAndPrefix();
    if (filters) filters[fieldName] = '';
    
    if (fieldName === 'nombre') {
      if (filters) filters.cargo = '';
      const cargoInput = document.getElementById(getCurrentView() === 'dashboard' ? 'dashboard-filter-cargo' : `${idPrefix}cargo`);
      if (cargoInput) {
        cargoInput.disabled = true;
        cargoInput.placeholder = 'Seleccione nombre primero...';
        cargoInput.classList.add('glass-input-disabled', 'cursor-not-allowed');
        cargoInput.classList.remove('text-text-secondary');
        cargoInput.value = '';
        if (typeof window.syncSearchInputBadge === 'function') {
          window.syncSearchInputBadge(cargoInput, '');
        }
      }
    }
    
    if (fieldName === 'anio') {
      if (filters) {
        filters.fechaInicio = '';
        filters.fechaTermino = '';
      }
      const mainEl = document.getElementById('main-content');
      if (mainEl) mainEl.innerHTML = '';
    }
    
    const input = document.getElementById(inputId);
    if (input) {
      input.value = '';
      input.disabled = (fieldName === 'cargo' && filters && !filters.nombre);
      if (typeof window.syncSearchInputBadge === 'function') {
        window.syncSearchInputBadge(input, '');
      }
    }
    
    callTriggerRenderOrFetch();
    
    // Enfocar el input después de borrar para comodidad del usuario
    setTimeout(() => {
      const newInput = document.getElementById(inputId);
      if (newInput && !newInput.disabled) {
        newInput.focus();
      }
    }, 50);
    return;
  }

  if (target.dataset.component === 'search-input' && target.dataset.autocomplete === 'true') {
    const fieldName = target.dataset.field;
    callShowDashboardSuggestions(fieldName);
  }
  
  const clearBtn = target.closest('#btn-reportes-clear');
  if (clearBtn) {
    callClearReportesFilters();
  }
});

// 5. Eventos de Blur/Desenfoque (Ocultar sugerencias)
document.addEventListener('blur', (e) => {
  const target = e.target;
  if (target.dataset.component === 'search-input' && target.dataset.autocomplete === 'true') {
    const fieldName = target.dataset.field;
    callHideDashboardSuggestions(fieldName);
  }
}, true); // useCapture para eventos que no burbujean

// 6. Eventos de Mousedown (Selección de sugerencias antes de que ocurra el blur)
document.addEventListener('mousedown', (e) => {
  const suggestionItem = e.target.closest('[data-action="select-suggestion"]');
  if (suggestionItem) {
    const fieldName = suggestionItem.dataset.field;
    const value = suggestionItem.dataset.value;
    callSelectDashboardSuggestion(fieldName, value);
  }
});

// 7. Eventos de Change (Selectores y Checkboxes)
document.addEventListener('change', (e) => {
  const target = e.target;
  const currentV = getCurrentView();
  const activeTab = getActiveAdminTab();
  const isSujetos = currentV === 'sujetos_pasivos' || (currentV === 'administracion' && activeTab === 'sujetos');
  
  if (target.dataset.component === 'select-input') {
    const fieldName = target.dataset.field;
    if (isSujetos && fieldName === 'tipoFecha') {
      if (typeof window.changeSujetosTipoFecha === 'function') {
        window.changeSujetosTipoFecha(target.value);
      }
    } else {
      callHandleMultiFilter(currentV, fieldName, target.value);
    }
  } else if (target.dataset.component === 'date-input') {
    // Actualizamos el estado interno siempre.
    // Si la fecha ya está completa (YYYY-MM-DD = 10 chars) o fue vaciada,
    // re-renderizamos inmediatamente (ej: selección desde calendario nativo / Air Datepicker).
    // El blur también dispara el render como respaldo para escritura manual.
    const fieldName = target.dataset.field;
    const value = target.value;
    const isComplete = value === '' || value.length === 10;
    const dashFilters = getDashboardFilters();
    const repFilters = getReportesFilters();
    const pState = getPState();

    if (currentV === 'dashboard') {
      dashFilters[fieldName] = value;
      if (isComplete) callRenderView();
    } else if (currentV === 'reportes' || (currentV === 'administracion' && activeTab === 'reportes')) {
      if (fieldName === 'fechaInicio') repFilters.fechaInicio = value;
      else if (fieldName === 'fechaTermino') repFilters.fechaTermino = value;
      if (isComplete) callDebouncedReportesRender();
    } else if (isSujetos) {
      if (!pState.sujetos_pasivos) pState.sujetos_pasivos = {};
      if (fieldName === 'fechaDesde') pState.sujetos_pasivos.fechaDesde = value;
      else if (fieldName === 'fechaHasta') pState.sujetos_pasivos.fechaHasta = value;
      pState.sujetos_pasivos.page = 1;
      if (isComplete) callRenderView();
    } else if (currentV === 'audiencias' || currentV === 'solicitudes' || currentV === 'publicadas') {
      const subTab = window.activeAudienciasSubTab || 'solicitudes';
      const targetView = (subTab === 'solicitudes') ? 'solicitudes' : 'publicadas';
      if (pState[targetView] && pState[targetView].filters) {
        pState[targetView].filters[fieldName] = value;
        pState[targetView].page = 1;
        if (isComplete) callUpdateListView(targetView);
      }
    } else if (currentV === 'viajes' || currentV === 'donativos') {
      if (pState[currentV] && pState[currentV].filters) {
        pState[currentV].filters[fieldName] = value;
        pState[currentV].page = 1;
        if (isComplete) callUpdateListView(currentV);
      }
    }
  } else if (target.classList.contains('report-estado-checkbox')) {
    callUpdateReporteEstadoPillStyle(target);
    const estado = target.getAttribute('data-estado');
    callHandleReportesEstadoToggle(estado, target.checked);
  }
});

// Helper global para abreviar cargos según mapeo del usuario
const getCargoAbbreviated = (cargoText) => {
  if (!cargoText) return 'TODOS';
  const clean = cargoText.toLowerCase().trim();
  
  if (clean.includes('2770')) return 'CE';
  if (clean.includes('comisión evaluadora') || clean.includes('comision evaluadora')) return 'CE';
  if (clean.includes('compras públicas') || clean.includes('compras publicas')) return 'COMP';
  if (clean.includes('smapa')) return 'SMAPA';
  if (clean.includes('salud municipal') || clean.includes('disam')) return 'DISAM';
  if (clean.includes('inspección') || clean.includes('inspeccion')) return 'INSP';
  if (clean.includes('riesgo, desastres') || clean.includes('riesgo desastres') || clean.includes('drde')) return 'DRDE';
  if (clean.includes('tránsito') || clean.includes('transito') || clean.includes('dtt')) return 'DTT';
  if (clean.includes('operaciones')) return 'OPS';
  if (clean.includes('aseo, ornato') || clean.includes('aseo ornato') || clean.includes('daoga')) return 'DAOGA';
  if (clean.includes('recursos humanos') || clean.includes('rrhh')) return 'RRHH';
  if (clean.includes('tecnología y comunicaciones') || clean.includes('tecnologia y comunicaciones') || clean.includes('ditec')) return 'DITEC';
  if (clean.includes('comunal de planificación') || clean.includes('comunal de planificacion') || clean.includes('secpla')) return 'SECPLA';
  if (clean.includes('prevención y seguridad') || clean.includes('prevencion y seguridad') || clean.includes('dipresec')) return 'DIPRESEC';
  if (clean.includes('obras municipales') || clean.includes('dom')) return 'DOM';
  if (clean.includes('desarrollo comunitario') || clean.includes('dideco')) return 'DIDECO';
  if (clean.includes('asesoría jurídica') || clean.includes('asesoria juridica') || clean.includes('daj')) return 'DAJ';
  if (clean.includes('administración y finanzas') || clean.includes('administracion y finanzas') || clean.includes('daf')) return 'DAF';
  if (clean.includes('control')) return 'CTRL';
  if (clean.includes('secretaria municipal') || clean.includes('secretario municipal')) return 'SECMUN';
  if (clean.includes('concejal') || clean.includes('concejala')) return 'CON';
  if (clean.includes('gabinete alcaldía') || clean.includes('gabinete alcaldia') || clean.includes('asistente alcaldía') || clean.includes('asistente alcaldia') || clean.includes('jefe de gabinete') || clean.includes('jefa de gabinete')) return 'JGAB';
  if (clean.includes('comunicaciones alcaldía') || clean.includes('comunicaciones alcaldia') || clean.includes('encargado de comunicaciones') || clean.includes('encargada de comunicaciones') || clean.includes('comunicaciones')) return 'COMS';
  if (clean.includes('alcalde') || clean.includes('alcaldesa')) return 'ALC';
  if (clean.includes('administrador municipal') || clean.includes('administradora municipal')) return 'ADM';
  if (clean.includes('rentas')) return 'REN';

  return 'GEN'; // default generic
};

// Helper global para formatear el nombre (CamelCase, sin tildes ni espacios)
const sanitizeNombreForFilename = (name) => {
  if (!name || name.toLowerCase() === 'todos') return 'Todos';
  const normalized = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return normalized
    .split(/\s+/)
.map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
};

// [MODULARIZADO] Funciones Delegadas de Reportes, Exportación y Administración


// Exposición de helpers de formateo y sanitización a window
window.getCargoAbbreviated = getCargoAbbreviated;
window.sanitizeNombreForFilename = sanitizeNombreForFilename;

export {
  getCargoAbbreviated,
  sanitizeNombreForFilename
};
