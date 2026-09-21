/**
 * filter-manager.component.js - Gestión unificada de filtros de búsqueda, multipropósito y relaciones
 * Desacoplado de app.js para arquitectura modular ESM.
 */

const getPState = () => (typeof window !== 'undefined' && window.paginationState) ? window.paginationState : (typeof paginationState !== 'undefined' ? paginationState : {});
const callUpdateListView = (...args) => (window.updateListView || (typeof updateListView !== 'undefined' ? updateListView : () => {}))(...args);
const callRenderView = (...args) => (window.renderView || (typeof renderView !== 'undefined' ? renderView : () => {}))(...args);
const callDebouncedSearchRender = (...args) => (window.debouncedSearchRender || (typeof debouncedSearchRender !== 'undefined' ? debouncedSearchRender : () => {}))(...args);
const callDebouncedFilterRender = (...args) => (window.debouncedFilterRender || (typeof debouncedFilterRender !== 'undefined' ? debouncedFilterRender : () => {}))(...args);

/**
 * Búsqueda simple
 * @param {string} viewName - Parámetro viewName.
 * @param {string} text - Parámetro text.
 */
function handleSearch(viewName, text) {
  const pState = getPState();
  if (pState[viewName]) {
    pState[viewName].search = text;
    pState[viewName].page = 1;
  }
  
  const inputId = viewName === 'sujetos_pasivos' ? 'search-sujetos' : (viewName === 'viajes' ? 'search-viajes' : `search-${viewName}`);
  callDebouncedSearchRender(viewName, text, inputId);
}

/**
 * Filtros múltiples interconectados
 * @param {string} viewName - Parámetro viewName.
 * @param {string} fieldName - Parámetro fieldName.
 * @param {*} value - Parámetro value.
 */
function handleMultiFilter(viewName, fieldName, value) {
  let targetView = viewName;
  if (viewName === 'audiencias') {
    const subTab = window.activeAudienciasSubTab || 'solicitudes';
    targetView = (subTab === 'solicitudes') ? 'solicitudes' : 'publicadas';
  }
  const pState = getPState();
  if (!pState[targetView] || !pState[targetView].filters) return;

  pState[targetView].filters[fieldName] = value;
  pState[targetView].page = 1;
  
  const inputId = `filter-${viewName}-${fieldName}`;
  const input = document.getElementById(inputId);
  
  if (input && input.tagName === 'SELECT') {
    if (targetView === 'solicitudes' || targetView === 'publicadas' || targetView === 'viajes') {
      callUpdateListView(targetView, inputId);
    } else {
      callRenderView();
    }
  } else {
    callDebouncedFilterRender(targetView, inputId);
  }
}

/**
 * Limpiar filtros
 * @param {string} viewName - Parámetro viewName.
 */
function clearFilters(viewName) {
  if (viewName === 'viajes') {
    paginationState.viajes.filters = {
      search: '',
      nombre: '',
      sujetoPasivo: '',
      cargo: '',
      destino: '',
      financiador: '',
      anio: '',
      fechaInicio: '',
      fechaTermino: '',
      vigencia: 'todos'
    };
    paginationState.viajes.page = 1;
    if (typeof syncAllLinkedDatepickers === 'function') {
      syncAllLinkedDatepickers();
    }
    updateListView('viajes');
    return;
  }
  if (viewName === 'donativos') {
    paginationState.donativos.filters = {
      search: '',
      nombre: '',
      sujetoPasivo: '',
      cargo: '',
      procedencia: '',
      tipo: '',
      ocasion: '',
      anio: '',
      fechaInicio: '',
      fechaTermino: '',
      vigencia: 'todos'
    };
    paginationState.donativos.page = 1;
    if (typeof syncAllLinkedDatepickers === 'function') {
      syncAllLinkedDatepickers();
    }
    updateListView('donativos');
    return;
  }
  if (viewName === 'audiencias') {
    const subTab = window.activeAudienciasSubTab || 'solicitudes';
    clearFilters(subTab === 'solicitudes' ? 'solicitudes' : 'publicadas');
    return;
  }
  if (paginationState[viewName]) {
    paginationState[viewName].filters = {
      folio: '',
      nombre: '',
      cargo: '',
      sujetoActivoRepresentado: '',
      estado: '',
      relacionSujetoActivo: '',
      relacionRut: '',
      relacionRepresentado: '',
      vigencia: 'todos',
      fechaInicio: '',
      fechaTermino: ''
    };
    paginationState[viewName].page = 1;
  }
  if (typeof syncAllLinkedDatepickers === 'function') {
    syncAllLinkedDatepickers();
  }
  if (viewName === 'solicitudes' || viewName === 'publicadas' || viewName === 'audiencias') {
    updateListView(viewName);
  } else {
    renderView();
  }
}

/**
 * Filtro directo de relaciones (un solo clic)
 * @param {string} viewName - Parámetro viewName.
 * @param {*} sujetoActivo - Parámetro sujetoActivo.
 * @param {*} rut - Parámetro rut.
 * @param {*} representado - Parámetro representado.
 */
function filtrarRelacionados(viewName, sujetoActivo, rut, representado) {
  paginationState[viewName].filters = {
    folio: '',
    nombre: '',
    cargo: '',
    sujetoActivoRepresentado: '',
    estado: '',
    relacionSujetoActivo: (sujetoActivo && sujetoActivo !== 'null') ? sujetoActivo : '',
    relacionRut: (rut && rut !== 'null') ? rut : '',
    relacionRepresentado: (representado && representado !== 'null') ? representado : '',
    vigencia: 'todos',
    fechaInicio: '',
    fechaTermino: ''
  };
  paginationState[viewName].page = 1;
  updateListView(viewName);
}
window.filtrarRelacionados = filtrarRelacionados;

function clearRelacionFilter(viewName) {
  paginationState[viewName].filters.relacionSujetoActivo = '';
  paginationState[viewName].filters.relacionRut = '';
  paginationState[viewName].filters.relacionRepresentado = '';
  paginationState[viewName].page = 1;
  updateListView(viewName);
}
window.clearRelacionFilter = clearRelacionFilter;



// Exposición canónica a window para compatibilidad total
window.handleSearch = handleSearch;
window.handleMultiFilter = handleMultiFilter;
window.clearFilters = clearFilters;
window.filtrarRelacionados = filtrarRelacionados;
window.clearRelacionFilter = clearRelacionFilter;

export {
  handleSearch,
  handleMultiFilter,
  clearFilters,
  filtrarRelacionados,
  clearRelacionFilter
};
