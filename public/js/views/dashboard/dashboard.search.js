/**
 * dashboard.search.js - Motor predictivo, sugerencias y autocompletado del Dashboard
 * Desacoplado de app.js para arquitectura modular ESM.
 */

/**
 * Helper interno: extrae el arreglo real de una respuesta API
 * @param {*} val - Parámetro val.
 */
function _getArr(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  if (val.data && Array.isArray(val.data)) return val.data;
  return [];
}

let activeSuggestionIndex = -1;
let hideSuggestionsTimeout = null;

function getDropdownCache() {
  return window.dashboardDropdownCache || (window.dashboardDropdownCache = {
    anios: [],
    nombres: [],
    cargos: [],
    sujetosActivosRepresentados: [],
    nombresVigentes: []
  });
}

function buildDashboardDropdownCache() {
  const ds = window.dataStore || (typeof dataStore !== 'undefined' ? dataStore : {});
  const cache = getDropdownCache();
  const rawNombresSet = new Set();
  const rawCargosSet = new Set();
  const rawSujetosActivosRepresentadosSet = new Set();

  const dataset = _getArr(ds.dashboardRawData).length
    ? _getArr(ds.dashboardRawData)
    : (_getArr(ds.solicitudes).length
      ? _getArr(ds.solicitudes)
      : _getArr(ds.publicadas));

  dataset.forEach(item => {
    if (item.sujeto_pasivo) rawNombresSet.add(item.sujeto_pasivo);
    if (item.cargo) rawCargosSet.add(item.cargo);
    if (item.sujeto_activo) rawSujetosActivosRepresentadosSet.add(item.sujeto_activo);
    if (item.representado) rawSujetosActivosRepresentadosSet.add(item.representado);
  });

  // Normalizar solo el conjunto único de valores para evitar sobrecarga de CPU en base de datos grande
  const normalizeNameFn = typeof normalizeName === 'function' ? normalizeName : (window.normalizeName || (n => n));
  const getCargoCleanFn = typeof getCargoClean === 'function' ? getCargoClean : (window.getCargoClean || (c => c));

  const nombresSet = new Set();
  rawNombresSet.forEach(n => {
    const normalized = normalizeNameFn(n);
    if (normalized) nombresSet.add(normalized);
  });

  const cargosSet = new Set();
  rawCargosSet.forEach(c => {
    const cleaned = getCargoCleanFn(c);
    if (cleaned) cargosSet.add(cleaned);
  });

  const sujetosActivosRepresentadosSet = new Set();
  rawSujetosActivosRepresentadosSet.forEach(s => {
    const normalized = normalizeNameFn(s);
    if (normalized) sujetosActivosRepresentadosSet.add(normalized);
  });

  // Años válidos desde 2015 al año actual
  const currentYear = new Date().getFullYear();
  const validYears = [];
  for (let y = 2015; y <= currentYear; y++) {
    validYears.push(String(y));
  }

  cache.anios = validYears.reverse();
  cache.nombres = Array.from(nombresSet).sort((a, b) => a.localeCompare(b));
  cache.cargos = Array.from(cargosSet).sort((a, b) => a.localeCompare(b));
  cache.sujetosActivosRepresentados = Array.from(sujetosActivosRepresentadosSet).sort((a, b) => a.localeCompare(b));

  // Construir lista de sujetos pasivos VIGENTES desde el endpoint dedicado
  const vigentesNombresSet = new Set();
  _getArr(ds.sujetosVigentesNombres).forEach(sp => {
    if (sp.nombre) {
      const normalized = normalizeNameFn(sp.nombre);
      if (normalized) vigentesNombresSet.add(normalized);
    }
  });
  cache.nombresVigentes = Array.from(vigentesNombresSet).sort((a, b) => a.localeCompare(b));
}



/**
 * Variable global para controlar la sugerencia activa por teclado
 */

/**
 * Helper para obtener el prefijo de ID de input y los filtros activos según la vista
 */
function getActiveFiltersAndPrefix() {
  const currentView = window.currentView || (typeof currentView !== 'undefined' ? currentView : 'dashboard');
  const activeAdminTab = window.activeAdminTab || (typeof activeAdminTab !== 'undefined' ? activeAdminTab : '');
  const dashboardFilters = window.dashboardFilters || (typeof dashboardFilters !== 'undefined' ? dashboardFilters : {});
  const reportesFilters = window.reportesFilters || (typeof reportesFilters !== 'undefined' ? reportesFilters : {});
  const paginationState = window.paginationState || (typeof paginationState !== 'undefined' ? paginationState : {
    solicitudes: { filters: {} },
    publicadas: { filters: {} },
    viajes: { filters: {} },
    donativos: { filters: {} },
    sujetos_pasivos: {}
  });

  let idPrefix, filters;
  if (currentView === 'dashboard' || currentView === 'estadisticas') {
    idPrefix = 'dashboard-filter-';
    filters = dashboardFilters;
  } else if (currentView === 'reportes' || (currentView === 'administracion' && activeAdminTab === 'reportes')) {
    idPrefix = 'report-filter-';
    filters = reportesFilters;
  } else if (currentView === 'solicitudes') {
    idPrefix = 'solicitudes-filter-';
    filters = paginationState.solicitudes?.filters || {};
  } else if (currentView === 'publicadas') {
    idPrefix = 'publicadas-filter-';
    filters = paginationState.publicadas?.filters || {};
  } else if (currentView === 'viajes') {
    idPrefix = 'viajes-filter-';
    filters = paginationState.viajes?.filters || {};
  } else if (currentView === 'donativos') {
    idPrefix = 'donativos-filter-';
    filters = paginationState.donativos?.filters || {};
  } else if (currentView === 'audiencias') {
    const subTab = window.activeAudienciasSubTab || 'solicitudes';
    if (subTab === 'solicitudes') {
      idPrefix = 'solicitudes-filter-';
      filters = paginationState.solicitudes?.filters || {};
    } else {
      idPrefix = 'publicadas-filter-';
      filters = paginationState.publicadas?.filters || {};
    }
  } else if (currentView === 'sujetos_pasivos' || (currentView === 'administracion' && activeAdminTab === 'sujetos')) {
    idPrefix = 'search-';
    filters = paginationState.sujetos_pasivos || {};
  }

  // Respaldo defensivo: si no se resolvió prefijo o currentView quedó en login durante el montaje
  if (!idPrefix && typeof document !== 'undefined') {
    if (document.getElementById('dashboard-filter-nombre') || document.getElementById('estadisticas-view-container')) {
      idPrefix = 'dashboard-filter-';
      filters = dashboardFilters;
      if (typeof window !== 'undefined') window.currentView = 'estadisticas';
    }
  }

  return { idPrefix, filters };
}

/**
 * Obtener el conjunto de datos de búsqueda adecuado para autocompletado de cargos según la vista activa
 */
function getLookupDataset() {
  if (currentView === 'publicadas') {
    return Array.isArray(dataStore.publicadas) ? dataStore.publicadas : (dataStore.publicadas?.data || []);
  }
  if (currentView === 'audiencias') {
    const subTab = window.activeAudienciasSubTab || 'solicitudes';
    if (subTab === 'solicitudes') {
      return (dataStore.dashboardRawData && dataStore.dashboardRawData.length)
        ? dataStore.dashboardRawData
        : (Array.isArray(dataStore.solicitudes) ? dataStore.solicitudes : (dataStore.solicitudes?.data || []));
    } else {
      return Array.isArray(dataStore.publicadas) ? dataStore.publicadas : (dataStore.publicadas?.data || []);
    }
  }
  if (currentView === 'viajes') {
    return Array.isArray(dataStore.viajes) ? dataStore.viajes : (dataStore.viajes?.data || []);
  }
  if (currentView === 'donativos') {
    return Array.isArray(dataStore.donativos) ? dataStore.donativos : (dataStore.donativos?.data || []);
  }
  if (currentView === 'solicitudes') {
    return (dataStore.dashboardRawData && dataStore.dashboardRawData.length)
      ? dataStore.dashboardRawData
      : (Array.isArray(dataStore.solicitudes) ? dataStore.solicitudes : (dataStore.solicitudes?.data || []));
  }
  return dataStore.dashboardRawData || [];
}

/**
 * Mostrar las sugerencias para el campo Nombre o Cargo
 * @param {string} fieldName - Parámetro fieldName.
 */
function showDashboardSuggestions(fieldName) {
  if (hideSuggestionsTimeout) {
    clearTimeout(hideSuggestionsTimeout);
    hideSuggestionsTimeout = null;
  }

  const { idPrefix, filters } = getActiveFiltersAndPrefix();

  // Si es cargo y no hay nombre seleccionado, no hacer nada y ocultar sugerencias
  if (fieldName === 'cargo' && !filters.nombre) {
    const suggestionsDiv = document.getElementById('suggestions-cargo');
    if (suggestionsDiv) {
      suggestionsDiv.classList.add('hidden');
    }
    return;
  }

  const input = document.getElementById(`${idPrefix}${fieldName}`);
  if (!input) return;
  
  const val = input.value.trim().toLowerCase();
  const suggestionsDiv = document.getElementById(`suggestions-${fieldName}`);
  if (!suggestionsDiv) return;

  const dropdownCache = getDropdownCache();
  let list;
  if (fieldName === 'nombre') {
    if (filters && (filters.vigencia === 'vigentes' || filters.soloVigentes === true)) {
      list = (dropdownCache.nombresVigentes && dropdownCache.nombresVigentes.length)
        ? dropdownCache.nombresVigentes
        : (dropdownCache.nombres || []);
    } else {
      list = dropdownCache.nombres || [];
    }
  } else if (fieldName === 'anio') {
    list = dropdownCache.anios || [];
  } else if (fieldName === 'sujetoActivoRepresentado') {
    list = dropdownCache.sujetosActivosRepresentados || [];
  } else {
    // Si hay un nombre filtrado, limitar las sugerencias de cargo a los correspondientes a ese nombre
    const selectedNombre = (filters.nombre || '').trim().toLowerCase();
    if (selectedNombre !== '' && selectedNombre !== 'todos') {
      const cargosSet = new Set();
      // Usar el dataset correcto según la vista activa
      const lookupDataset = getLookupDataset();
      lookupDataset.forEach(item => {
        if (item.sujeto_pasivo && item.sujeto_pasivo.toLowerCase().includes(selectedNombre)) {
          if (item.cargo) {
            const getCleanFn = typeof getCargoClean === 'function' ? getCargoClean : (window.getCargoClean || (c => c));
            cargosSet.add(getCleanFn(item.cargo));
          }
        }
      });
      list = Array.from(cargosSet).sort((a, b) => a.localeCompare(b));
    } else {
      list = dropdownCache.cargos || [];
    }

    if (idPrefix === 'report-filter-') {
      list = ['Todos', ...list];
    }
  }

  // Si la caché está vacía, forzar su construcción inmediata desde los datos actuales
  if (!list || list.length === 0) {
    buildDashboardDropdownCache();
    if (fieldName === 'nombre') {
      list = (filters && (filters.vigencia === 'vigentes' || filters.soloVigentes === true))
        ? ((dropdownCache.nombresVigentes && dropdownCache.nombresVigentes.length) ? dropdownCache.nombresVigentes : (dropdownCache.nombres || []))
        : (dropdownCache.nombres || []);
    } else if (fieldName === 'anio') {
      list = dropdownCache.anios || [];
    } else if (fieldName === 'cargo') {
      list = dropdownCache.cargos || [];
    }
  }

  const isReportesNombre = (idPrefix === 'report-filter-' && fieldName === 'nombre');
  const isValTodos = val.toLowerCase() === 'todos';
  const maxSuggestions = 15;
  const filtered = (val.length > 0 && fieldName !== 'anio' && !isValTodos)
    ? (list || []).filter(item => item && item.toLowerCase().includes(val)).slice(0, maxSuggestions)
    : (list || []).slice(0, maxSuggestions);

  if (filtered.length === 0) {
    suggestionsDiv.innerHTML = `
      <div class="px-3 py-2 text-xs text-text-tertiary italic">
        Sin coincidencias
      </div>
    `;
    suggestionsDiv.classList.remove('hidden');
    activeSuggestionIndex = -1;
    return;
  }

  // Encabezado de grupo para el campo nombre en reportes
  let headerHtml = '';
  if (isReportesNombre) {
    if (val.length === 0) {
      headerHtml = `<div class="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-brand-400 border-b border-border-ui flex items-center gap-1.5"><i data-lucide="shield-check" class="h-3 w-3"></i> Sujetos Pasivos Vigentes</div>`;
    } else {
      headerHtml = `<div class="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-text-tertiary border-b border-border-ui">Resultados de búsqueda</div>`;
    }
  }

  const escapeFn = typeof escapeHtml === 'function' ? escapeHtml : (typeof window !== 'undefined' && window.escapeHtml ? window.escapeHtml : (s => String(s ?? '')));
  const escapeAttrFn = typeof escapeHtmlAttr === 'function' ? escapeHtmlAttr : (typeof window !== 'undefined' && window.escapeHtmlAttr ? window.escapeHtmlAttr : escapeFn);

  suggestionsDiv.innerHTML = headerHtml + filtered.map((item) => {
    return `
      <div data-action="select-suggestion"
           data-field="${fieldName}"
           data-value="${escapeAttrFn(item)}"
           class="suggestion-item px-3 py-1.5 text-xs text-text-secondary hover:bg-border-ui dark:hover:bg-border-ui/50 hover:text-brand-600 dark:hover:text-brand-400 rounded-lg mx-1 my-0.5 cursor-pointer transition-colors truncate">
        ${escapeFn(item)}
      </div>
    `;
  }).join('');
  suggestionsDiv.classList.remove('hidden');
  activeSuggestionIndex = -1;
  if (isReportesNombre && typeof lucide !== 'undefined' && typeof lucide.createIcons === 'function') lucide.createIcons();
}

/**
 * Seleccionar sugerencia del Dashboard
 * @param {string} fieldName - Parámetro fieldName.
 * @param {*} value - Parámetro value.
 */
function selectDashboardSuggestion(fieldName, value) {
  if (hideSuggestionsTimeout) {
    clearTimeout(hideSuggestionsTimeout);
    hideSuggestionsTimeout = null;
  }

  const { idPrefix, filters } = getActiveFiltersAndPrefix();

  // Si se selecciona un nuevo nombre diferente, resetear el cargo
  if (fieldName === 'nombre' && filters.nombre !== value) {
    filters.cargo = '';
    
    // Si estamos en cualquier vista con cargo, sincronizar DOM
    if (typeof updateDashboardCargoSelect === 'function') {
      updateDashboardCargoSelect(value);
    }
  } else if (fieldName === 'nombre' && value) {
    if (typeof updateDashboardCargoSelect === 'function') {
      updateDashboardCargoSelect(value);
    }
  }

  // Si se selecciona un nuevo año diferente, resetear las fechas de inicio y término y forzar re-renderizado completo
  if (fieldName === 'anio' && filters.anio !== value) {
    filters.fechaInicio = '';
    filters.fechaTermino = '';
    const mainEl = document.getElementById('main-content');
    if (mainEl) mainEl.innerHTML = '';
  }

  filters[fieldName] = value;
  
  const input = document.getElementById(`${idPrefix}${fieldName}`);
  if (input) {
    input.value = value;
    if (typeof syncSearchInputBadge === 'function') {
      syncSearchInputBadge(input, value);
    }
    input.blur();
  }
  
  const suggestionsDiv = document.getElementById(`suggestions-${fieldName}`);
  if (suggestionsDiv) {
    suggestionsDiv.classList.add('hidden');
  }
  
  activeSuggestionIndex = -1;
  triggerRenderOrFetch();
}

/**
 * Ocultar las sugerencias con retardo y aplicar el filtro con validación
 * @param {string} fieldName - Parámetro fieldName.
 */
function hideDashboardSuggestions(fieldName) {
  if (hideSuggestionsTimeout) {
    clearTimeout(hideSuggestionsTimeout);
  }
  hideSuggestionsTimeout = setTimeout(() => {
    const suggestionsDiv = document.getElementById(`suggestions-${fieldName}`);
    if (suggestionsDiv) {
      suggestionsDiv.classList.add('hidden');
    }
    activeSuggestionIndex = -1;
    hideSuggestionsTimeout = null;

    const { idPrefix, filters } = getActiveFiltersAndPrefix();

    const input = document.getElementById(`${idPrefix}${fieldName}`);
    if (input) {
      const val = input.value.trim();
      
      const dropdownCache = getDropdownCache();
      let list;
      if (fieldName === 'nombre') {
        // En reportes: aceptar cualquier nombre del historial completo (vigentes o no)
        list = dropdownCache.nombres || [];
      } else if (fieldName === 'sujetoActivoRepresentado') {
        list = dropdownCache.sujetosActivosRepresentados || [];
      } else if (fieldName === 'cargo') {
        const selectedNombre = (filters.nombre || '').trim().toLowerCase();
        if (selectedNombre !== '' && selectedNombre !== 'todos') {
          const cargosSet = new Set();
          const lookupDataset = getLookupDataset();
          lookupDataset.forEach(item => {
            if (item.sujeto_pasivo && item.sujeto_pasivo.toLowerCase().includes(selectedNombre)) {
              if (item.cargo) {
                const getCleanFn = typeof getCargoClean === 'function' ? getCargoClean : (window.getCargoClean || (c => c));
                cargosSet.add(getCleanFn(item.cargo));
              }
            }
          });
          list = Array.from(cargosSet);
        } else {
          list = dropdownCache.cargos || [];
        }
        if (idPrefix === 'report-filter-') {
          list = ['Todos', ...list];
        }
      } else {
        list = dropdownCache.anios || [];
      }
      
      if (val === '') {
        if (filters[fieldName] !== '') {
          filters[fieldName] = '';
          if (fieldName === 'nombre') {
            filters.cargo = '';
            
            const cargoInput = document.getElementById(currentView === 'dashboard' ? 'dashboard-filter-cargo' : `${idPrefix}cargo`);
            if (cargoInput) {
              cargoInput.disabled = true;
              cargoInput.placeholder = 'Seleccione nombre primero...';
              cargoInput.classList.add('glass-input-disabled', 'cursor-not-allowed');
              cargoInput.classList.remove('text-text-secondary');
              cargoInput.value = '';
              if (typeof syncSearchInputBadge === 'function') {
                syncSearchInputBadge(cargoInput, '');
              }
            }
          }
          if (fieldName === 'anio') {
            filters.fechaInicio = '';
            filters.fechaTermino = '';
            const mainEl = document.getElementById('main-content');
            if (mainEl) mainEl.innerHTML = '';
          }
          if (typeof syncSearchInputBadge === 'function') {
            syncSearchInputBadge(input, '');
          }
          triggerRenderOrFetch();
        } else {
          if (typeof syncSearchInputBadge === 'function') {
            syncSearchInputBadge(input, '');
          }
        }
      } else {
        const isReportes = (currentView === 'reportes' || (currentView === 'administracion' && typeof activeAdminTab !== 'undefined' && activeAdminTab === 'reportes'));
        const isWildcardAllowed = (isReportes && (fieldName === 'nombre' || fieldName === 'cargo') && val.toLowerCase() === 'todos');
        const matchedItem = isWildcardAllowed ? 'Todos' : list.find(item => item.toLowerCase() === val.toLowerCase());
        if (matchedItem) {
          if (filters[fieldName] !== matchedItem) {
            if (fieldName === 'nombre') {
              filters.cargo = '';
              
              const cargoInput = document.getElementById(currentView === 'dashboard' ? 'dashboard-filter-cargo' : `${idPrefix}cargo`);
              if (cargoInput) {
                cargoInput.disabled = false;
                cargoInput.placeholder = 'Escribir cargo...';
                cargoInput.classList.remove('glass-input-disabled', 'cursor-not-allowed');
                cargoInput.classList.add('text-text-secondary');
                cargoInput.value = '';
                if (typeof syncSearchInputBadge === 'function') {
                  syncSearchInputBadge(cargoInput, '');
                }
              }
            }
            if (fieldName === 'anio') {
              filters.fechaInicio = '';
              filters.fechaTermino = '';
              const mainEl = document.getElementById('main-content');
              if (mainEl) mainEl.innerHTML = '';
            }
            filters[fieldName] = matchedItem;
            input.value = matchedItem;
          } else if (fieldName === 'nombre') {
            const cargoInput = document.getElementById(currentView === 'dashboard' ? 'dashboard-filter-cargo' : `${idPrefix}cargo`);
            if (cargoInput) {
              cargoInput.disabled = false;
              cargoInput.placeholder = 'Escribir cargo...';
              cargoInput.classList.remove('glass-input-disabled', 'cursor-not-allowed');
              cargoInput.classList.add('text-text-secondary');
            }
          }
          if (typeof syncSearchInputBadge === 'function') {
            syncSearchInputBadge(input, matchedItem);
          }
          triggerRenderOrFetch();
        } else if (isReportes || currentView === 'solicitudes' || currentView === 'publicadas' || currentView === 'audiencias' || fieldName === 'sujetoActivoRepresentado') {
          // En solicitudes, publicadas, audiencias, reportes y búsqueda de sujeto activo/representado se permite búsqueda libre
          filters[fieldName] = val;
          input.value = val;
          if (fieldName === 'nombre') {
            const cargoInput = document.getElementById(`${idPrefix}cargo`);
            if (cargoInput) {
              cargoInput.disabled = false;
              cargoInput.placeholder = 'Escribir cargo...';
              cargoInput.classList.remove('glass-input-disabled', 'cursor-not-allowed');
              cargoInput.classList.add('text-text-secondary');
            }
          }
          if (typeof syncSearchInputBadge === 'function') {
            syncSearchInputBadge(input, val);
          }
          triggerRenderOrFetch();
        } else {
          // Si no existe y estamos en vista restrictiva (dashboard), rechazar la entrada y volver al valor anterior
          input.value = filters[fieldName] || '';
          if (typeof syncSearchInputBadge === 'function') {
            syncSearchInputBadge(input, filters[fieldName] || '');
          }
          showToast(`El ${fieldName === 'nombre' ? 'nombre' : (fieldName === 'cargo' ? 'cargo' : (fieldName === 'sujetoActivoRepresentado' ? 'sujeto activo/representado' : 'año'))} ingresado no existe en el catálogo.`, 'warning');
          triggerRenderOrFetch();
        }
      }
    }
  }, 200);
}

/**
 * Manejar cambios en el input del dashboard y mostrar sugerencias sin actualizar estadísticas
 * @param {Event} eventOrEl - Parámetro eventOrEl.
 * @param {string} fieldName - Parámetro fieldName.
 */
function handleDashboardInputWithSuggestions(eventOrEl, fieldName) {
  const value = (eventOrEl && eventOrEl.target) ? eventOrEl.target.value : (eventOrEl && eventOrEl.value !== undefined ? eventOrEl.value : '');
  showDashboardSuggestions(fieldName);
  
  const { idPrefix, filters } = getActiveFiltersAndPrefix();

  // Si se vacía completamente, limpiamos el filtro y actualizamos las estadísticas de inmediato
  if (value.trim() === '') {
    if (filters[fieldName] !== '') {
      filters[fieldName] = '';
      if (fieldName === 'nombre') {
        filters.cargo = '';
        
        // Sincronizar bloqueo de cargo en DOM (dashboard y tablas)
        if (typeof updateDashboardCargoSelect === 'function') {
          updateDashboardCargoSelect('');
        }
      }
      triggerRenderOrFetch();
      const input = document.getElementById(`${idPrefix}${fieldName}`);
      if (input) {
        input.focus();
      }
    }
  } else {
    // Si no está vacío y estamos en tablas (reportes, solicitudes, publicadas, viajes), filtrar en tiempo real (debounced)
    const isReportesView = (currentView === 'reportes' || (currentView === 'administracion' && typeof activeAdminTab !== 'undefined' && activeAdminTab === 'reportes'));
    if (isReportesView || currentView === 'solicitudes' || currentView === 'publicadas' || currentView === 'viajes') {
      filters[fieldName] = value;
      if (fieldName === 'nombre') {
        filters.cargo = '';
        // Forzar desbloqueo de cargo en DOM
        const cargoInput = document.getElementById(currentView === 'dashboard' ? 'dashboard-filter-cargo' : `${idPrefix}cargo`);
        if (cargoInput) {
          cargoInput.disabled = false;
          cargoInput.placeholder = 'Cargo...';
          cargoInput.classList.remove('cursor-not-allowed', 'opacity-50');
          const parentWrap = cargoInput.closest('.relative');
          if (parentWrap) parentWrap.classList.remove('opacity-50', 'cursor-not-allowed');
        }
      }
      
      if (isReportesView) {
        debouncedReportesRender(`${idPrefix}${fieldName}`);
      } else {
        debouncedFilterRender(currentView, `${idPrefix}${fieldName}`);
      }
    }
  }
}

/**
 * Manejar navegación por teclado en el menú de sugerencias con validación
 * @param {Event} event - Parámetro event.
 * @param {string} fieldName - Parámetro fieldName.
 */
function handleDashboardInputKeydown(event, fieldName) {
  const suggestionsDiv = document.getElementById(`suggestions-${fieldName}`);
  const hasSuggestions = suggestionsDiv && !suggestionsDiv.classList.contains('hidden');

  if (event.key === 'Enter') {
    event.preventDefault();
    let selectedValue = '';
    if (hasSuggestions) {
      const items = suggestionsDiv.querySelectorAll('.suggestion-item');
      if (activeSuggestionIndex >= 0 && activeSuggestionIndex < items.length) {
        selectedValue = items[activeSuggestionIndex].getAttribute('data-value');
      }
    }
    
    const { idPrefix, filters } = getActiveFiltersAndPrefix();
    const input = document.getElementById(`${idPrefix}${fieldName}`);
    if (input) {
      const val = input.value.trim();
      
      const dropdownCache = getDropdownCache();
      let list;
      if (fieldName === 'nombre') {
        list = idPrefix === 'report-filter-' ? ['Todos', ...(dropdownCache.nombres || [])] : (dropdownCache.nombres || []);
      } else if (fieldName === 'sujetoActivoRepresentado') {
        list = dropdownCache.sujetosActivosRepresentados || [];
      } else if (fieldName === 'cargo') {
        const selectedNombre = (filters.nombre || '').trim().toLowerCase();
        if (selectedNombre !== '' && selectedNombre !== 'todos') {
          const cargosSet = new Set();
          const lookupDataset = getLookupDataset();
          lookupDataset.forEach(item => {
            if (item.sujeto_pasivo && item.sujeto_pasivo.toLowerCase().includes(selectedNombre)) {
              if (item.cargo) {
                const getCleanFn = typeof getCargoClean === 'function' ? getCargoClean : (window.getCargoClean || (c => c));
                cargosSet.add(getCleanFn(item.cargo));
              }
            }
          });
          list = Array.from(cargosSet);
        } else {
          list = dropdownCache.cargos || [];
        }
        if (idPrefix === 'report-filter-') {
          list = ['Todos', ...list];
        }
      } else {
        list = dropdownCache.anios || [];
      }
      
      if (selectedValue) {
        selectDashboardSuggestion(fieldName, selectedValue);
      } else {
        if (val === '') {
          selectDashboardSuggestion(fieldName, '');
        } else {
          const isReportes = (currentView === 'reportes' || (currentView === 'administracion' && typeof activeAdminTab !== 'undefined' && activeAdminTab === 'reportes'));
          const isFreeSearchAllowed = (isReportes || currentView === 'solicitudes' || currentView === 'publicadas' || currentView === 'audiencias' || fieldName === 'sujetoActivoRepresentado');
          const isWildcardAllowed = (isReportes && (fieldName === 'nombre' || fieldName === 'cargo') && val.toLowerCase() === 'todos');
          const matchedItem = isWildcardAllowed ? 'Todos' : list.find(item => item.toLowerCase() === val.toLowerCase());
          if (matchedItem) {
            selectDashboardSuggestion(fieldName, matchedItem);
          } else if (isFreeSearchAllowed) {
            // En solicitudes, publicadas, audiencias, reportes y búsqueda de sujeto activo/representado se permite búsqueda libre
            if (suggestionsDiv) {
              suggestionsDiv.classList.add('hidden');
            }
            activeSuggestionIndex = -1;
            selectDashboardSuggestion(fieldName, val);
          } else {
            // Si no existe y estamos en vista restrictiva (dashboard), rechazar y revertir al filtro actual
            input.value = filters[fieldName] || '';
            showToast(`El ${fieldName === 'nombre' ? 'nombre' : (fieldName === 'cargo' ? 'cargo' : (fieldName === 'sujetoActivoRepresentado' ? 'sujeto activo/representado' : 'año'))} ingresado no existe en el catálogo.`, 'warning');
            if (suggestionsDiv) {
              suggestionsDiv.classList.add('hidden');
            }
            activeSuggestionIndex = -1;
          }
        }
      }
    }
    return;
  }

  if (!hasSuggestions) return;
  const items = suggestionsDiv.querySelectorAll('.suggestion-item');
  if (items.length === 0) return;

  if (event.key === 'ArrowDown') {
    event.preventDefault();
    activeSuggestionIndex = (activeSuggestionIndex + 1) % items.length;
    updateHighlightedSuggestion(items);
  } else if (event.key === 'ArrowUp') {
    event.preventDefault();
    activeSuggestionIndex = (activeSuggestionIndex - 1 + items.length) % items.length;
    updateHighlightedSuggestion(items);
  } else if (event.key === 'Escape') {
    event.preventDefault();
    suggestionsDiv.classList.add('hidden');
    activeSuggestionIndex = -1;
  }
}

/**
 * Actualizar elemento resaltado de sugerencias
 * @param {Array} items - Parámetro items.
 */
function updateHighlightedSuggestion(items) {
  items.forEach((item, idx) => {
    if (idx === activeSuggestionIndex) {
      item.classList.add('bg-brand-600', 'text-white');
      item.classList.remove('text-text-secondary');
      item.scrollIntoView({ block: 'nearest' });
    } else {
      item.classList.remove('bg-brand-600', 'text-white');
      item.classList.add('text-text-secondary');
    }
  });
}



/**
 * Limpiar filtros del dashboard
 */
function clearDashboardFilters() {
  const clean = {
    anio: '',
    fechaInicio: '',
    fechaTermino: '',
    nombre: '',
    cargo: '',
    vigencia: 'todos'
  };
  window.dashboardFilters = clean;
  if (typeof dashboardFilters !== 'undefined') dashboardFilters = clean;
  const main = document.getElementById('main-content');
  if (main) main.innerHTML = ''; // Fuerza re-renderizado completo de los filtros
  if (typeof renderView === 'function') renderView();
  else if (typeof window.renderView === 'function') window.renderView();
}


function changeDashboardAnio(val) {
  if (typeof dashboardFilters !== 'undefined') dashboardFilters.anio = val;
  if (window.dashboardFilters) window.dashboardFilters.anio = val;
  if (typeof renderView === 'function') renderView(true);
  else if (typeof window.renderView === 'function') window.renderView(true);
}

function changeDashboardFecha(field, val) {
  if (typeof dashboardFilters !== 'undefined') dashboardFilters[field] = val;
  if (window.dashboardFilters) window.dashboardFilters[field] = val;
  if (typeof renderView === 'function') renderView(true);
  else if (typeof window.renderView === 'function') window.renderView(true);
}

function getCargosForNombre(nombre) {
  if (!nombre) return [];
  const selectedNombre = String(nombre).trim().toLowerCase();
  if (!selectedNombre) return [];
  const cargosSet = new Set();
  const ds = window.dataStore || (typeof dataStore !== 'undefined' ? dataStore : {});
  const dataset = (ds.dashboardRawData && ds.dashboardRawData.length)
    ? ds.dashboardRawData
    : (Array.isArray(ds.solicitudes) ? ds.solicitudes : (ds.solicitudes?.data || (Array.isArray(ds.publicadas) ? ds.publicadas : [])));
  
  dataset.forEach(item => {
    if (item && item.sujeto_pasivo && item.sujeto_pasivo.toLowerCase().includes(selectedNombre)) {
      if (item.cargo) {
        const cleaned = typeof getCargoClean === 'function' ? getCargoClean(item.cargo) : item.cargo.trim();
        if (cleaned) cargosSet.add(cleaned);
      }
    }
  });
  return Array.from(cargosSet).sort((a, b) => a.localeCompare(b));
}

function changeDashboardCargo(val) {
  if (typeof dashboardFilters !== 'undefined') dashboardFilters.cargo = val;
  if (window.dashboardFilters) window.dashboardFilters.cargo = val;
  if (typeof renderView === 'function') renderView(true);
  else if (typeof window.renderView === 'function') window.renderView(true);
}

function updateDashboardCargoSelect(nombre) {
  const container = document.getElementById('cargo-container-dashboard-filter-cargo');
  if (!container || typeof window.renderCargoSelect !== 'function') return;
  const tempDiv = document.createElement('div');
  const filters = window.dashboardFilters || {};
  tempDiv.innerHTML = window.renderCargoSelect({
    id: 'dashboard-filter-cargo',
    value: filters.cargo || '',
    nombre: nombre || '',
    onChange: 'changeDashboardCargo'
  });
  const newEl = tempDiv.firstElementChild;
  if (newEl && container.parentNode) {
    container.parentNode.replaceChild(newEl, container);
    if (typeof lucide !== 'undefined' && typeof lucide.createIcons === 'function') {
      lucide.createIcons();
    }
  }
}

function toggleDashboardFiltersPanel() {
  const panel = document.getElementById('dashboard-filters-panel');
  const icon = document.getElementById('icon-toggle-filters-chevron');
  if (!panel) return;
  const willOpen = !window._dashboardFiltersPanelOpen;
  window._dashboardFiltersPanelOpen = willOpen;

  if (willOpen) {
    panel.classList.remove('max-h-0', 'opacity-0', 'p-0', 'pointer-events-none', 'overflow-hidden');
    panel.classList.add('max-h-[300px]', 'opacity-100', 'px-4', 'pb-3', 'pt-1', 'pointer-events-auto');
    setTimeout(() => {
      if (window._dashboardFiltersPanelOpen) {
        panel.classList.add('overflow-visible');
      }
    }, 280);
    if (icon) icon.classList.add('rotate-180');
    if (typeof window.initAirDatepickerFields === 'function') {
      window.initAirDatepickerFields();
    }
  } else {
    panel.classList.remove('max-h-[300px]', 'opacity-100', 'px-4', 'pb-3', 'pt-1', 'pointer-events-auto', 'overflow-visible');
    panel.classList.add('max-h-0', 'opacity-0', 'p-0', 'pointer-events-none', 'overflow-hidden');
    if (icon) icon.classList.remove('rotate-180');
  }
  if (typeof lucide !== 'undefined' && typeof lucide.createIcons === 'function') {
    lucide.createIcons();
  }
}

// Exposición canónica a window para compatibilidad total con eventos DOM y app.js
window.changeDashboardAnio = changeDashboardAnio;
window.changeDashboardFecha = changeDashboardFecha;
window.changeDashboardCargo = changeDashboardCargo;
window.getCargosForNombre = getCargosForNombre;
window.updateDashboardCargoSelect = updateDashboardCargoSelect;
window.toggleDashboardFiltersPanel = toggleDashboardFiltersPanel;
function clearDashboardSujetoPasivo(e) {
  if (e) {
    if (typeof e.preventDefault === 'function') e.preventDefault();
    if (typeof e.stopPropagation === 'function') e.stopPropagation();
  }
  const { filters } = getActiveFiltersAndPrefix();
  filters.nombre = '';
  filters.cargo = '';
  if (typeof updateDashboardCargoSelect === 'function') {
    updateDashboardCargoSelect('');
  }
  const mainEl = document.getElementById('main-content');
  if (mainEl) mainEl.innerHTML = '';
  triggerRenderOrFetch();
}

window.clearDashboardSujetoPasivo = clearDashboardSujetoPasivo;
window.buildDashboardDropdownCache = buildDashboardDropdownCache;
window.getActiveFiltersAndPrefix = getActiveFiltersAndPrefix;
window.getLookupDataset = getLookupDataset;
window.showDashboardSuggestions = showDashboardSuggestions;
window.selectDashboardSuggestion = selectDashboardSuggestion;
window.hideDashboardSuggestions = hideDashboardSuggestions;
window.handleDashboardInputWithSuggestions = handleDashboardInputWithSuggestions;
window.handleDashboardInputKeydown = handleDashboardInputKeydown;
window.updateHighlightedSuggestion = updateHighlightedSuggestion;
window.clearDashboardFilters = clearDashboardFilters;

export {
  clearDashboardSujetoPasivo,
  changeDashboardAnio,
  changeDashboardCargo,
  getCargosForNombre,
  updateDashboardCargoSelect,
  buildDashboardDropdownCache,
  getActiveFiltersAndPrefix,
  getLookupDataset,
  showDashboardSuggestions,
  selectDashboardSuggestion,
  hideDashboardSuggestions,
  handleDashboardInputWithSuggestions,
  handleDashboardInputKeydown,
  updateHighlightedSuggestion,
  clearDashboardFilters
};
