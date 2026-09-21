/**
 * view-navigator.js - Orquestación de navegación, conmutación y renderizado de vistas SPA
 * Arquitectura modular canónica ESM.
 */
import {
  fetchStats,
  fetchData,
  fetchPaginatedList,
  updateListView,
  triggerRenderOrFetch,
  fetchDbHealth,
  fetchSyncHistory,
  fetchAuditoria,
  fetchDashboardData,
  fetchActiveSujetoIds,
  fetchVigentesNombres,
  fetchReportesData
} from '../services/lobby-data.service.js';

import {
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
} from '../views/dashboard/dashboard.search.js';

import {
  initAirDatepickerFields,
  syncAllLinkedDatepickers
} from '../components/datepicker.component.js';

import { showToast } from '../components/toast.component.js';
import { fetchAlertas } from '../views/alertas/alertas.view.js';
import { renderEstadisticas } from '../views/estadisticas/estadisticas.view.js';
import { debounce } from '../utils/dom.js';

let activeAbortController = null;

/**
 * Cambiar de vista activa en el Sidebar y recargar datos
 * @param {string} viewName - Parámetro viewName.
 */
async function switchView(viewName) {
  window.isSwitchingView = true;
  const user = window.currentUser || (typeof currentUser !== 'undefined' ? currentUser : null);
  // Proteger el ruteo en el cliente según rol
  if (viewName !== 'login' && user) {
    const rol = user.rol || '';
    let allowed = true;
    if (rol === 'Auditor') {
      // Auditor tiene acceso permitido a reportes y a administracion (ámbito gestión)
    } else if (rol === 'Sujeto Pasivo' || rol === 'Asistente técnico') {
      if (viewName === 'sujetos_pasivos' || viewName === 'administracion' || viewName === 'reportes') allowed = false;
    }

    if (!allowed) {
      showToast('No tiene permisos para acceder a esta sección.', 'error');
      viewName = 'dashboard';
    }
  }

  if (viewName === 'escritorio') {
    viewName = 'dashboard';
  } else if (viewName === 'solicitudes') {
    viewName = 'audiencias';
    window.activeAudienciasSubTab = 'solicitudes';
  } else if (viewName === 'publicadas') {
    viewName = 'audiencias';
    window.activeAudienciasSubTab = 'publicadas';
  } else if (viewName === 'audiencias' && !window.activeAudienciasSubTab) {
    window.activeAudienciasSubTab = 'solicitudes';
  }

  window.currentView = viewName;
  if (typeof currentView !== 'undefined') currentView = viewName;
  localStorage.setItem('lobby_current_view', viewName);

  if (viewName !== 'dashboard' && typeof window !== 'undefined' && window.dashboardClockInterval) {
    clearInterval(window.dashboardClockInterval);
    window.dashboardClockInterval = null;
  }

  if (viewName === 'administracion') {
    const rol = (user && user.rol) || '';
    window.activeAdminScope = 'gestion';
    window.activeAdminTab = rol === 'Auditor' ? 'sujetos' : 'auditoria';
  }
  
  // Controlar visibilidad del Header, Sidebar y Cápsula según si es vista de Login o no
  const header = document.querySelector('header');
  const sidebar = document.getElementById('app-sidebar');
  const capsule = document.getElementById('system-status-capsule');
  if (viewName === 'login') {
    if (header) header.classList.add('hidden');
    if (sidebar) sidebar.classList.add('hidden');
    if (capsule) capsule.classList.add('hidden');
    renderView();
    return;
  } else {
    if (header) header.classList.remove('hidden');
    if (sidebar) sidebar.classList.remove('hidden');
    if (capsule) capsule.classList.remove('hidden');
    updateHeaderUserSection();

    // Sincronizar dinámicamente el Topbar oficial
    const topbarMeta = {
      dashboard: {
        title: 'Escritorio',
        desc: 'Panel operativo de solicitudes, plazos y acciones rápidas'
      },
      escritorio: {
        title: 'Escritorio',
        desc: 'Panel operativo de solicitudes, plazos y acciones rápidas'
      },
      estadisticas: {
        title: 'Estadísticas y Análisis',
        desc: 'Control analítico de solicitudes, plazos legales y distribución por estado'
      },
      audiencias: {
        title: 'Audiencias y Solicitudes',
        desc: 'Gestión y seguimiento de audiencias según Ley N° 20.730'
      },
      agenda: {
        title: 'Agenda de Audiencias',
        desc: 'Calendario y programación de audiencias'
      },
      viajes: {
        title: 'Registro de Viajes',
        desc: 'Comisiones de servicio y viajes realizados por autoridades y funcionarios (Ley N° 20.730)'
      },
      donativos: {
        title: 'Registro de Donativos',
        desc: 'Donativos y regalos protocolares recibidos por sujetos pasivos en ejercicio de sus funciones (Ley N° 20.730)'
      },
      administracion: {
        title: 'Administración y Gestión',
        desc: 'Herramientas de gestión, auditoría, usuarios y reportes'
      },
      reportes: {
        title: 'Reportes y Exportación',
        desc: 'Generación y descarga de informes analíticos'
      }
    };
    const currentMeta = topbarMeta[viewName] || { title: 'LobbyControl', desc: '' };
    const topTitleEl = document.getElementById('topbar-title');
    const topDescEl = document.getElementById('topbar-desc');
    if (topTitleEl) topTitleEl.textContent = currentMeta.title;
    if (topDescEl) topDescEl.textContent = currentMeta.desc;
  }
  
  const navButtons = ['dashboard', 'estadisticas', 'audiencias', 'agenda', 'viajes', 'donativos', 'settings'];
  navButtons.forEach(btn => {
    const el = document.getElementById(`nav-${btn}`);
    if (el) {
      const isCurrent = (btn === viewName) || (btn === 'settings' && viewName === 'administracion');
      el.classList.toggle('active', isCurrent);
    }
  });

  // Asegurar que las opciones de menú según rol estén bien ocultas/mostradas después de cambiar clases
  updateHeaderUserSection();

  // Reset pagination for the view
  // Reset page for the view, but keep the filters preserved
  if (paginationState[viewName]) {
    paginationState[viewName].page = 1;
  }

  renderLoader();

  try {
    if (activeAbortController) {
      activeAbortController.abort();
    }
    activeAbortController = new AbortController();
    const signal = activeAbortController.signal;
    const ds = window.dataStore || (typeof dataStore !== 'undefined' ? dataStore : {});

    if (viewName === 'dashboard' || viewName === 'estadisticas') {
      await fetchStats(signal);
      await fetchDashboardData(signal);
      await fetchData('publicadas', signal);
      await fetchActiveSujetoIds(signal);
      await fetchVigentesNombres(signal);
      buildDashboardDropdownCache();
    } else if (viewName === 'reportes') {
      await fetchReportesData(signal);
      await fetchData('publicadas', signal);
      await fetchVigentesNombres(signal);
      await fetchActiveSujetoIds(signal);
      ds.dashboardRawData = ds.reportesRawData;
      buildDashboardDropdownCache();
    } else {
      if (viewName === 'solicitudes' || viewName === 'publicadas' || viewName === 'audiencias' || viewName === 'viajes' || viewName === 'donativos') {
        if (!ds.dashboardRawData || ds.dashboardRawData.length === 0) {
          await fetchDashboardData(signal);
        }
        await fetchActiveSujetoIds(signal);
        await fetchPaginatedList(viewName, signal);
      } else if (viewName === 'alertas') {
        await fetchAlertas(signal);
      } else if (viewName === 'agenda') {
        await fetchActiveSujetoIds(signal);
        await fetchData('publicadas', signal);
      } else if (viewName === 'administracion' || viewName === 'sujetos_pasivos') {
        await fetchActiveSujetoIds(signal);
        await fetchData('sujetos_pasivos', signal);
        await fetchStats(signal);
        const isAdmin = user && user.rol === 'Administrador';
        if (isAdmin && viewName === 'administracion') {
          await fetchData('administracion', signal);
          await fetchDbHealth(signal);
          await fetchSyncHistory(signal);
          await fetchAuditoria(signal);
          try {
            const resVals = await fetch('/api/admin/auditoria/valores-actuales', { signal });
            if (resVals.ok) {
              ds.valoresActuales = await resVals.json();
            }
          } catch(e) {
            console.error(e);
          }
        }
      } else {
        await fetchActiveSujetoIds(signal);
        await fetchData(viewName, signal);
      }
      if (viewName === 'solicitudes' || viewName === 'publicadas' || viewName === 'audiencias') {
        buildDashboardDropdownCache();
      }
    }
    renderView();
  } catch (err) {
    if (err.name === 'AbortError') {
      return; // Petición cancelada legítimamente por cambio de pestaña rápido
    }
    console.error(err);
    showToast('Error de red al obtener datos del servidor local.', 'error');
    renderError();
  } finally {
    hideLoader();
  }
}

/**
 * Spinner de carga
 */
function renderLoader() {
  const main = document.getElementById('main-content');
  const bar = document.getElementById('top-loading-bar');
  if (main) {
    main.classList.add('opacity-40', 'pointer-events-none', 'transition-opacity', 'duration-300');
  }
  if (bar) {
    bar.style.opacity = '1';
    bar.style.width = '30%';
    if (window.loadingInterval) clearInterval(window.loadingInterval);
    window.loadingInterval = setInterval(() => {
      const currentWidth = parseFloat(bar.style.width || '30%');
      if (currentWidth < 85) {
        bar.style.width = (currentWidth + (90 - currentWidth) * 0.15) + '%';
      }
    }, 150);
  }
}

function hideLoader(preventFadeIn = false) {
  const main = document.getElementById('main-content');
  const bar = document.getElementById('top-loading-bar');
  if (window.loadingInterval) {
    clearInterval(window.loadingInterval);
    window.loadingInterval = null;
  }
  if (bar) {
    bar.style.width = '100%';
    setTimeout(() => {
      bar.style.opacity = '0';
      setTimeout(() => {
        bar.style.width = '0';
      }, 200);
    }, 150);
  }
  if (main) {
    main.classList.remove('opacity-40', 'pointer-events-none');
    if (!preventFadeIn) {
      main.classList.remove('animate-fade-in');
      void main.offsetWidth;
      main.classList.add('animate-fade-in');
    }
  }
}

/**
 * Vista de Error
 */
function renderError() {
  const main = document.getElementById('main-content');
  main.innerHTML = `
    <div class="h-64 flex flex-col items-center justify-center gap-4 text-center">
      <div class="h-12 w-12 rounded-full badge-status-vencido flex items-center justify-center">
        <i data-lucide="alert-triangle" class="h-6 w-6"></i>
      </div>
      <div>
        <h3 class="text-sm font-semibold text-heading">Error en Servidor Local</h3>
        <p class="text-xs text-body-muted max-w-sm mt-1">No se pudo establecer conexión con el servidor Node.js. Asegúrate de ejecutar "npm start" y que el puerto 3000 esté libre.</p>
      </div>
      <button onclick="switchView('${currentView}')" class="px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 btn-secondary">
        <i data-lucide="refresh-cw" class="h-3 w-3"></i> Reintentar
      </button>
    </div>
  `;
  lucide.createIcons();
}


window.changeDashboardVigencia = function(val) {
  dashboardFilters.vigencia = val;
  renderView(true);
};

window.changeSolicitudesVigencia = function(val) {
  paginationState.solicitudes.filters.vigencia = val;
  paginationState.solicitudes.page = 1;
  updateListView('solicitudes');
};

window.changePublicadasVigencia = function(val) {
  paginationState.publicadas.filters.vigencia = val;
  paginationState.publicadas.page = 1;
  updateListView('publicadas');
};

window.changeViajesVigencia = function(val) {
  paginationState.viajes.filters.vigencia = val;
  paginationState.viajes.page = 1;
  updateListView('viajes');
};

window.changeDonativosVigencia = function(val) {
  paginationState.donativos.filters.vigencia = val;
  paginationState.donativos.page = 1;
  updateListView('donativos');
};

window.changeCalendarVigencia = function(val) {
  calendarFilters.vigencia = val;
  if (typeof drawCalendarBodyOnly === 'function') {
    drawCalendarBodyOnly();
  } else {
    renderView();
  }
};

window.changeSujetosPasivosVigencia = function(val) {
  paginationState.sujetos_pasivos.vigencia = val;
  paginationState.sujetos_pasivos.page = 1;
  renderView();
};

window.changeSujetosTipoFecha = function(val) {
  paginationState.sujetos_pasivos.tipoFecha = val;
  paginationState.sujetos_pasivos.page = 1;
  renderView();
};

window.clearSujetosFilters = function() {
  paginationState.sujetos_pasivos.search = '';
  paginationState.sujetos_pasivos.vigencia = 'todos';
  paginationState.sujetos_pasivos.tipoFecha = 'incorporacion';
  paginationState.sujetos_pasivos.fechaDesde = '';
  paginationState.sujetos_pasivos.fechaHasta = '';
  paginationState.sujetos_pasivos.page = 1;
  renderView();
};

window.changeReportesVigencia = function(val) {
  reportesFilters.vigencia = val;
  paginationState.reportes.page = 1;
  debouncedReportesRender();
};


const debouncedReportesRender = debounce((activeInputId) => {
  window.activeInputId = activeInputId;
  renderView();
  window.activeInputId = null;
  if (activeInputId) {
    const input = document.getElementById(activeInputId);
    if (input) {
      input.focus();
      if (input.tagName === 'INPUT' && typeof input.setSelectionRange === 'function') {
        const len = input.value.length;
        input.setSelectionRange(len, len);
      }
      if (input.dataset && input.dataset.autocomplete === 'true') {
        const fieldName = input.dataset.field;
        if (fieldName) {
          showDashboardSuggestions(fieldName);
        }
      }
    }
  }
}, 250);
window.debouncedReportesRender = debouncedReportesRender;



function updateReporteEstadoPillStyle(checkbox) {
  if (!checkbox) return;
  const label = checkbox.closest('label');
  if (!label) return;
  const isChecked = checkbox.checked;
  
  const activeClasses = ['border-brand-500', 'bg-blue-500/10', 'text-blue-600', 'dark:text-blue-400', 'shadow-sm', 'shadow-brand-500/20'];
  const inactiveClasses = ['text-text-tertiary'];

  if (isChecked) {
    inactiveClasses.forEach(c => label.classList.remove(c));
    activeClasses.forEach(c => label.classList.add(c));
  } else {
    activeClasses.forEach(c => label.classList.remove(c));
    inactiveClasses.forEach(c => label.classList.add(c));
  }
}

function handleReportesEstadoToggle(estado, checked) {
  const pState = window.paginationState || (typeof paginationState !== 'undefined' ? paginationState : {});
  if (pState.reportes) pState.reportes.page = 1;
  const rf = window.reportesFilters || (typeof reportesFilters !== 'undefined' ? reportesFilters : { estados: [] });
  if (!Array.isArray(rf.estados)) rf.estados = [];
  if (checked) {
    if (!rf.estados.includes(estado)) {
      rf.estados.push(estado);
    }
  } else {
    rf.estados = rf.estados.filter(e => e !== estado);
  }
  window.reportesFilters = rf;
  debouncedReportesRender();
}

function clearReportesFilters() {
  const pState = window.paginationState || (typeof paginationState !== 'undefined' ? paginationState : {});
  if (pState.reportes) pState.reportes.page = 1;
  const cleanFilters = {
    nombre: '',
    cargo: '',
    fechaInicio: '',
    fechaTermino: '',
    estados: [],
    vigencia: 'todos'
  };
  window.reportesFilters = cleanFilters;
  if (typeof reportesFilters !== 'undefined') reportesFilters = cleanFilters;
  const main = document.getElementById('main-content');
  if (main) main.innerHTML = ''; // Fuerza re-renderizado completo de los filtros
  renderView();
}


/**
 * Renderizar Vistas según selección
 * @param {*} forceAnimateCards - Parámetro forceAnimateCards.
 */
function renderView(forceAnimateCards = false) {
  const main = document.getElementById('main-content');
  if (!main) return;

  if (window.isSwitchingView) {
    main.classList.remove('view-transition');
    void main.offsetWidth; // trigger reflow
    main.classList.add('view-transition');
    window.isSwitchingView = false;
  }
  
  let isPartialUpdate = false;
  const activeView = window.currentView || (typeof currentView !== 'undefined' ? currentView : 'dashboard');
  switch (activeView) {
    case 'login':
      if (typeof window.renderLogin === 'function') window.renderLogin(main);
      else if (typeof renderLogin === 'function') renderLogin(main);
      break;
    case 'dashboard':
      if (main.querySelector('#btn-sso-login')) {
        main.innerHTML = '';
      }
      if (typeof window.renderDashboardModule === 'function') {
        isPartialUpdate = window.renderDashboardModule(main);
      } else if (typeof window.renderDashboard === 'function') {
        isPartialUpdate = window.renderDashboard(main);
      } else if (typeof renderDashboard === 'function') {
        isPartialUpdate = renderDashboard(main);
      }
      if (typeof window.initDashboardCharts === 'function') window.initDashboardCharts();
      else if (typeof initDashboardCharts === 'function') initDashboardCharts();
      if (!isPartialUpdate || forceAnimateCards) {
        const animFn = typeof window.animateNumberCount === 'function' ? window.animateNumberCount : (typeof animateNumberCount === 'function' ? animateNumberCount : null);
        if (animFn) {
          ['count-total-solicitudes', 'count-solicitudes-respondidas', 'count-solicitudes-pendientes',
           'count-estado-aceptada', 'count-estado-rechazada', 'count-estado-suspendida', 
           'count-estado-cancelada', 'count-estado-encomendada', 'count-estado-publicadas', 
           'count-estado-pendientesPublicacion'].forEach(id => animFn(id, null, 1000));
        }
      }
      break;
    case 'estadisticas':
      if (main.querySelector('#btn-sso-login')) {
        main.innerHTML = '';
      }
      if (typeof window.renderEstadisticas === 'function') {
        isPartialUpdate = window.renderEstadisticas(main);
      } else if (typeof renderEstadisticas === 'function') {
        isPartialUpdate = renderEstadisticas(main);
      }
      if (typeof window.initEstadisticasCharts === 'function') window.initEstadisticasCharts();
      if (!isPartialUpdate || forceAnimateCards) {
        const animFn = typeof window.animateNumberCount === 'function' ? window.animateNumberCount : (typeof animateNumberCount === 'function' ? animateNumberCount : null);
        if (animFn) {
          ['count-total-solicitudes', 'count-solicitudes-respondidas', 'count-solicitudes-pendientes',
           'count-estado-aceptada', 'count-estado-rechazada', 'count-estado-suspendida', 
           'count-estado-cancelada', 'count-estado-encomendada', 'count-estado-publicadas', 
           'count-estado-pendientesPublicacion'].forEach(id => animFn(id, null, 1000));
        }
      }
      break;
    case 'solicitudes':
      if (typeof window.renderSolicitudes === 'function') window.renderSolicitudes(main);
      else if (typeof renderSolicitudes === 'function') renderSolicitudes(main);
      break;
    case 'pendientes':
      if (typeof window.renderPendientesPublicacion === 'function') window.renderPendientesPublicacion(main);
      else if (typeof renderPendientesPublicacion === 'function') renderPendientesPublicacion(main);
      break;
    case 'publicadas':
      if (typeof window.renderAudienciasPublicadas === 'function') window.renderAudienciasPublicadas(main);
      else if (typeof renderAudienciasPublicadas === 'function') renderAudienciasPublicadas(main);
      else if (typeof window.renderPublicadas === 'function') window.renderPublicadas(main);
      else if (typeof renderPublicadas === 'function') renderPublicadas(main);
      break;
    case 'audiencias':
      if (typeof window.renderAudiencias === 'function') window.renderAudiencias(main);
      else if (typeof renderAudiencias === 'function') renderAudiencias(main);
      break;
    case 'agenda':
      if (typeof window.renderAgenda === 'function') window.renderAgenda(main);
      else if (typeof renderAgenda === 'function') renderAgenda(main);
      break;
    case 'viajes':
      if (typeof window.renderViajes === 'function') window.renderViajes(main);
      else if (typeof renderViajes === 'function') renderViajes(main);
      break;
    case 'donativos':
      if (typeof window.renderDonativos === 'function') window.renderDonativos(main);
      else if (typeof renderDonativos === 'function') renderDonativos(main);
      break;
    case 'sujetos_pasivos':
      if (typeof window.renderSujetosPasivos === 'function') window.renderSujetosPasivos(main);
      else if (typeof renderSujetosPasivos === 'function') renderSujetosPasivos(main);
      break;
    case 'administracion':
      if (typeof window.renderUsuarios === 'function') window.renderUsuarios(main);
      else if (typeof window.renderAdministracion === 'function') window.renderAdministracion(main);
      else if (typeof renderUsuarios === 'function') renderUsuarios(main);
      break;
    case 'reportes':
      if (typeof window.renderReportes === 'function') isPartialUpdate = window.renderReportes(main);
      else if (typeof renderReportes === 'function') isPartialUpdate = renderReportes(main);
      break;
    case 'alertas':
      if (typeof window.renderAlertasCentro === 'function') window.renderAlertasCentro(main);
      else if (typeof renderAlertasCentro === 'function') renderAlertasCentro(main);
      break;
  }
  if (window.lucide && typeof window.lucide.createIcons === 'function') window.lucide.createIcons();
  if (typeof window.updateThemeIcons === 'function') window.updateThemeIcons();
  updateSidebarBadges();
  
  const scheduleTask = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : (cb) => setTimeout(cb, 0);
  if (!isPartialUpdate) {
    scheduleTask(() => initAirDatepickerFields());
  } else {
    scheduleTask(() => syncAllLinkedDatepickers());
  }
  
  hideLoader(!!window.activeInputId || !window.isSwitchingView);
  window.isSwitchingView = false;
}

/**
 * Control de paginación
 * @param {string} viewName - Parámetro viewName.
 * @param {number} newPage - Parámetro newPage.
 */
function changePage(viewName, newPage) {
  const pState = window.paginationState || (typeof paginationState !== 'undefined' ? paginationState : null);
  if (pState && pState[viewName]) {
    pState[viewName].page = newPage;
  }
  if (viewName === 'solicitudes' || viewName === 'pendientes' || viewName === 'publicadas' || viewName === 'viajes') {
    if (typeof updateListView === 'function') {
      updateListView(viewName);
    }
  } else {
    renderView();
  }
}

/**
 * Control de sub-pestañas de Audiencias (Solicitudes / Pendientes de Publicación / Audiencias Publicadas)
 * @param {string} subTabName - Parámetro subTabName.
 */
function changeAudienciasSubTab(subTabName) {
  window.activeAudienciasSubTab = subTabName;
  const pState = window.paginationState || (typeof paginationState !== 'undefined' ? paginationState : null);
  if (subTabName === 'solicitudes') {
    if (pState && pState.solicitudes) pState.solicitudes.page = 1;
    if (typeof updateListView === 'function') updateListView('solicitudes');
  } else if (subTabName === 'pendientes') {
    if (pState) {
      if (!pState.pendientes) {
        pState.pendientes = { page: 1, filters: {} };
      } else {
        pState.pendientes.page = 1;
      }
    }
    if (typeof updateListView === 'function') updateListView('pendientes');
  } else {
    // 'publicadas' o 'historial'
    if (pState) {
      if (!pState.publicadas) {
        pState.publicadas = { page: 1, filters: {} };
      } else {
        pState.publicadas.page = 1;
      }
      pState.publicadas.subTab = 'historial';
    }
    if (typeof updateListView === 'function') updateListView('publicadas');
  }
}

// Renderizados diferidos por debounce para mantener el foco en la posición correcta del cursor
const safeDebounce = (fn, delay) => {
  if (typeof window.debounce === 'function') {
    return window.debounce(fn, delay);
  }
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
};

const debouncedSearchRender = safeDebounce((viewName, text, inputId) => {
  if (viewName === 'solicitudes' || viewName === 'pendientes' || viewName === 'publicadas' || viewName === 'audiencias' || viewName === 'viajes' || viewName === 'donativos') {
    if (typeof updateListView === 'function') updateListView(viewName, inputId);
  } else {
    window.activeInputId = inputId;
    renderView();
    window.activeInputId = null;
    const input = document.getElementById(inputId);
    if (input) {
      input.focus();
      const len = input.value.length;
      input.setSelectionRange(len, len);
    }
  }
}, 250);

const debouncedFilterRender = safeDebounce((viewName, inputId) => {
  if (viewName === 'solicitudes' || viewName === 'pendientes' || viewName === 'publicadas' || viewName === 'audiencias' || viewName === 'viajes' || viewName === 'donativos') {
    if (typeof updateListView === 'function') updateListView(viewName, inputId);
  } else {
    window.activeInputId = inputId;
    renderView();
    window.activeInputId = null;
    if (inputId) {
      const input = document.getElementById(inputId);
      if (input && input.tagName !== 'SELECT') {
        input.focus();
        const len = input.value.length;
        input.setSelectionRange(len, len);
      }
    }
  }
}, 250);

function updateSidebarBadges() {
  const store = window.dataStore || {};
  const audienciasBadge = document.getElementById('sidebar-audiencias-badge');
  const agendaBadge = document.getElementById('sidebar-agenda-badge');
  const rawData = Array.isArray(store.dashboardRawData) && store.dashboardRawData.length > 0
    ? store.dashboardRawData
    : (Array.isArray(store.solicitudes) ? store.solicitudes : []);

  // 1. Badge de Audiencias: Mostrar las que tengan estado "Ingresada"
  if (audienciasBadge) {
    let ingresadasCount = null;
    if (rawData.length > 0) {
      ingresadasCount = rawData.filter(item => (item.estado || '').trim().toLowerCase() === 'ingresada').length;
    } else if (store.stats?.solicitudes_ingresadas !== undefined) {
      ingresadasCount = store.stats.solicitudes_ingresadas;
    }
    audienciasBadge.textContent = ingresadasCount !== null ? String(ingresadasCount) : '--';
  }

  // 2. Badge de Agenda: Audiencias aceptadas de hoy (aunque la hora ya haya pasado)
  if (agendaBadge) {
    let hoyCount = null;
    if (rawData.length > 0) {
      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, '0');
      const d = String(now.getDate()).padStart(2, '0');
      const todayStr = `${y}-${m}-${d}`;

      hoyCount = rawData.filter(item => {
        const estadoClean = (item.estado || '').trim().toLowerCase();
        const fecha = (item.fecha_agendada || '').split('T')[0].split(' ')[0];
        return estadoClean === 'aceptada' && fecha === todayStr;
      }).length;
    } else if (store.stats?.agenda_hoy !== undefined) {
      hoyCount = store.stats.agenda_hoy;
    }

    if (hoyCount !== null && hoyCount > 0) {
      agendaBadge.textContent = String(hoyCount);
      agendaBadge.classList.remove('hidden');
    } else if (hoyCount === 0) {
      agendaBadge.textContent = '0';
      agendaBadge.classList.add('hidden');
    } else {
      agendaBadge.textContent = '--';
      agendaBadge.classList.add('hidden');
    }
  }
}

// Exposición canónica a window para compatibilidad total con eventos DOM y router SPA
window.updateSidebarBadges = updateSidebarBadges;
window.switchView = switchView;
window.renderView = renderView;
window.renderLoader = renderLoader;
window.hideLoader = hideLoader;
window.renderError = renderError;
window.changePage = changePage;
window.changeAudienciasSubTab = changeAudienciasSubTab;
window.debouncedSearchRender = debouncedSearchRender;
window.debouncedFilterRender = debouncedFilterRender;
window.changeDashboardVigencia = changeDashboardVigencia;
window.changeSolicitudesVigencia = changeSolicitudesVigencia;
window.changePublicadasVigencia = changePublicadasVigencia;
window.changeViajesVigencia = changeViajesVigencia;
window.changeDonativosVigencia = changeDonativosVigencia;
window.changeCalendarVigencia = changeCalendarVigencia;
window.changeSujetosPasivosVigencia = changeSujetosPasivosVigencia;
window.changeSujetosTipoFecha = changeSujetosTipoFecha;
window.clearSujetosFilters = clearSujetosFilters;
window.changeReportesVigencia = changeReportesVigencia;
window.updateReporteEstadoPillStyle = updateReporteEstadoPillStyle;
window.handleReportesEstadoToggle = handleReportesEstadoToggle;
window.clearReportesFilters = clearReportesFilters;

export {
  switchView,
  renderView,
  renderLoader,
  hideLoader,
  renderError,
  changePage,
  changeAudienciasSubTab,
  debouncedSearchRender,
  debouncedFilterRender,
  updateSidebarBadges
};
