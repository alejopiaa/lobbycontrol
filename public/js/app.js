// Variables de estado global
let currentUser = null;
let selectedExcelFileBase64 = null;
let currentView = 'dashboard';
let activeAdminTab = 'usuarios';
let dataStore = {
  usuarios: [],
  solicitudes: [],
  publicadas: [],
  sujetos_pasivos: [],
  stats: {},
  dbHealth: null,
  syncHistory: [],
  dashboardRawData: [],
  reportesRawData: [],
  auditoria: [],
  alertas: null
};

// Referencias a los gráficos de Chart.js
let chartDistribucionInstance = null;
let chartEvolucionInstance = null;
let chartCumplimientoInstance = null;
let chartTopAutoridadesInstance = null;

// Interceptor global para redirección automática en caso de 401 (Sesión Expirada)
const originalFetch = window.fetch;
window.fetch = async function (...args) {
  const response = await originalFetch(...args);
  if (response.status === 401) {
    const url = typeof args[0] === 'string' ? args[0] : args[0].url;
    if (!url.includes('/api/auth/me') && !url.includes('/api/auth/login')) {
      currentUser = null;
      switchView('login');
      showToast('Su sesión ha expirado o no está autorizado.', 'error');
    }
  }
  return response;
};

let paginationState = {
  solicitudes: { 
    page: 1, 
    filters: {
      folio: '',
      nombre: '',
      cargo: '',
      sujetoActivoRepresentado: '',
      estado: '',
      relacionSujetoActivo: '',
      relacionRut: '',
      relacionRepresentado: ''
    }
  },
  publicadas: { 
    page: 1, 
    subTab: 'historial',
    filters: {
      folio: '',
      nombre: '',
      cargo: '',
      sujetoActivoRepresentado: '',
      estado: '',
      relacionSujetoActivo: '',
      relacionRut: '',
      relacionRepresentado: ''
    }
  },
  sujetos_pasivos: { page: 1, search: '' },
  reportes: { page: 1 }
};

// Variables para control de cancelaciones asíncronas y temporizadores de UI
let activeAbortController = null;
let tooltipTimeout = null;
let hideSuggestionsTimeout = null;
let activeSujetoIdsCache = new Set();

let dashboardFilters = {
  anio: '',
  fechaInicio: '',
  fechaTermino: '',
  nombre: '',
  cargo: ''
};

let reportesFilters = {
  nombre: '',
  cargo: '',
  fechaInicio: '',
  fechaTermino: '',
  estados: []
};

let dashboardDropdownCache = {
  anios: [],
  nombres: [],
  cargos: [],
  sujetosActivosRepresentados: []
};

// Obtener y actualizar fecha de última actualización de la base de datos en el header
async function fetchAndUpdateDbTimestamp() {
  try {
    const res = await fetch('/api/db-last-update');
    if (res.ok) {
      const data = await res.json();
      const el = document.getElementById('db-last-update');
      if (el && data.dbLastUpdate) {
        el.textContent = data.dbLastUpdate;
      }
    }
  } catch (err) {
    console.error('Error al obtener fecha de última actualización:', err);
  }
}

// Funciones auxiliares de autenticación frontend
async function checkAuth() {
  try {
    const res = await fetch('/api/auth/me');
    if (res.ok) {
      currentUser = await res.json();
      if (currentUser) {
        updateHeaderUserSection();
        return true;
      }
    }
  } catch (err) {
    console.error('Error al comprobar sesión:', err);
  }
  currentUser = null;
  return false;
}

function updateHeaderUserSection() {
  if (!currentUser) return;
  const rolEl = document.getElementById('header-user-rol');
  const nombreEl = document.getElementById('header-user-nombre');
  const initialsEl = document.getElementById('header-user-initials');
  
  if (rolEl) rolEl.textContent = currentUser.rol || 'Analista';
  if (nombreEl) nombreEl.textContent = currentUser.nombre || '';
  if (initialsEl) {
    const names = (currentUser.nombre || '').trim().split(/\s+/);
    let initials = 'U';
    if (names.length >= 2) {
      initials = (names[0][0] + names[names.length - 1][0]).toUpperCase();
    } else if (names.length === 1 && names[0]) {
      initials = names[0].substring(0, 2).toUpperCase();
    }
    initialsEl.textContent = initials;
  }

  // Ocultar/mostrar opciones del menú según rol
  const rol = currentUser.rol || '';
  const navSujetos = document.getElementById('nav-sujetos_pasivos');
  const navAdministracion = document.getElementById('nav-administracion');
  const navReportes = document.getElementById('nav-reportes');

  if (navSujetos) {
    if (rol === 'Sujeto Pasivo' || rol === 'Asistente técnico') {
      navSujetos.style.display = 'none';
      navSujetos.classList.add('hidden');
    } else {
      navSujetos.style.display = '';
      navSujetos.classList.remove('hidden');
    }
  }

  if (navAdministracion) {
    if (rol === 'Auditor' || rol === 'Sujeto Pasivo' || rol === 'Asistente técnico') {
      navAdministracion.style.display = 'none';
      navAdministracion.classList.add('hidden');
    } else {
      navAdministracion.style.display = '';
      navAdministracion.classList.remove('hidden');
    }
  }

  if (navReportes) {
    if (rol === 'Auditor' || rol === 'Sujeto Pasivo' || rol === 'Asistente técnico') {
      navReportes.style.display = 'none';
      navReportes.classList.add('hidden');
    } else {
      navReportes.style.display = '';
      navReportes.classList.remove('hidden');
    }
  }
}

async function triggerSsoLogin() {
  const loginErrorEl = document.getElementById('login-error');
  const loginErrorTextEl = document.getElementById('login-error-text');
  
  if (loginErrorEl) loginErrorEl.classList.add('hidden');

  try {
    const res = await fetch('/api/auth/trigger-sso', { method: 'POST' });
    const data = await res.json();
    
    if (res.ok && data.success) {
      currentUser = data.user;
      showToast('Sesión iniciada con éxito via SSO');
      
      const header = document.querySelector('header');
      if (header) header.classList.remove('hidden');
      
      updateHeaderUserSection();
      fetchAlertas();
      if (typeof initSessionTimeout === 'function') initSessionTimeout();
      switchView('dashboard');
      // Recargar la app para sincronizar los nuevos datos de base de datos
      window.location.reload();
    } else {
      if (loginErrorEl && loginErrorTextEl) {
        loginErrorTextEl.textContent = data.error || 'No se pudo iniciar sesión con Microsoft.';
        loginErrorEl.classList.remove('hidden');
      }
    }
  } catch (err) {
    console.error('Error en SSO:', err);
    if (loginErrorEl && loginErrorTextEl) {
      loginErrorTextEl.textContent = 'Error de red al conectar con el inicio de sesión corporativo.';
      loginErrorEl.classList.remove('hidden');
    }
  }
}

async function login(correo, password) {
  const loginErrorEl = document.getElementById('login-error');
  const loginErrorTextEl = document.getElementById('login-error-text');
  
  if (loginErrorEl) {
    loginErrorEl.classList.add('hidden');
  }
  if (loginErrorTextEl) {
    loginErrorTextEl.textContent = '';
  }

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ correo, password })
    });
    
    if (res.ok) {
      const data = await res.json();
      currentUser = data.user;
      showToast('Sesión iniciada con éxito');
      
      // Mostrar la cabecera antes de cambiar de vista
      const header = document.querySelector('header');
      if (header) header.classList.remove('hidden');
      
      updateHeaderUserSection();
      fetchAlertas();
      // Iniciar el módulo de timeout de inactividad
      if (typeof initSessionTimeout === 'function') initSessionTimeout();
      switchView('dashboard');
    } else {
      const err = await res.json();
      if (loginErrorEl && loginErrorTextEl) {
        loginErrorTextEl.textContent = err.error || 'Credenciales inválidas. Inténtelo de nuevo.';
        loginErrorEl.classList.remove('hidden');
      }
    }
  } catch (err) {
    console.error('Error en login:', err);
    if (loginErrorEl && loginErrorTextEl) {
      loginErrorTextEl.textContent = 'Error de red al conectar con el servidor.';
      loginErrorEl.classList.remove('hidden');
    }
  }
}

async function logout() {
  // Detener el timeout antes de cerrar sesión
  if (typeof destroySessionTimeout === 'function') destroySessionTimeout();
  try {
    const res = await fetch('/api/auth/logout', { method: 'POST' });
    if (res.ok) {
      currentUser = null;
      showToast('Sesión cerrada');
      switchView('login');
    } else {
      showToast('Error al cerrar sesión', 'error');
    }
  } catch (err) {
    console.error('Error en logout:', err);
    showToast('Error de red al conectar con el servidor', 'error');
  }
}

// Al cargar el documento
document.addEventListener('DOMContentLoaded', async () => {
  lucide.createIcons();
  updateThemeIcons();
  fetchAndUpdateDbTimestamp();
  
  const isAuthenticated = await checkAuth();
  if (isAuthenticated) {
    fetchAlertas();
    // Iniciar el módulo de timeout de inactividad (sesión ya activa desde una recarga)
    if (typeof initSessionTimeout === 'function') initSessionTimeout();
    const savedView = localStorage.getItem('lobby_current_view') || 'dashboard';
    switchView(savedView === 'login' ? 'dashboard' : savedView);
  } else {
    switchView('login');
  }
});


// Control de paginación
function changePage(viewName, newPage) {
  paginationState[viewName].page = newPage;
  if (viewName === 'solicitudes' || viewName === 'publicadas') {
    updateListView(viewName);
  } else {
    renderView();
  }
}

// Control de sub-pestañas de publicadas (Historial / Pendientes)
function changePublicadasSubTab(subTabName) {
  paginationState.publicadas.subTab = subTabName;
  paginationState.publicadas.page = 1;
  // Limpiar filtros al cambiar de sub-pestaña para evitar incongruencias
  paginationState.publicadas.filters = {
    folio: '',
    nombre: '',
    cargo: '',
    sujetoActivoRepresentado: '',
    estado: '',
    relacionSujetoActivo: '',
    relacionRut: '',
    relacionRepresentado: ''
  };
  updateListView('publicadas');
}

// Nota: debounce fue movido a helpers.js para estar disponible antes en la carga de scripts

// Renderizados diferidos por debounce para mantener el foco en la posición correcta del cursor
const debouncedSearchRender = debounce((viewName, text, inputId) => {
  if (viewName === 'solicitudes' || viewName === 'publicadas') {
    updateListView(viewName, inputId);
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

const debouncedFilterRender = debounce((viewName, inputId) => {
  if (viewName === 'solicitudes' || viewName === 'publicadas') {
    updateListView(viewName, inputId);
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

// Búsqueda simple
function handleSearch(viewName, text) {
  paginationState[viewName].search = text;
  paginationState[viewName].page = 1;
  
  const inputId = viewName === 'sujetos_pasivos' ? 'search-sujetos' : `search-${viewName}`;
  debouncedSearchRender(viewName, text, inputId);
}

// Filtros múltiples interconectados
function handleMultiFilter(viewName, fieldName, value) {
  paginationState[viewName].filters[fieldName] = value;
  paginationState[viewName].page = 1;
  
  const inputId = `filter-${viewName}-${fieldName}`;
  const input = document.getElementById(inputId);
  
  if (input && input.tagName === 'SELECT') {
    if (viewName === 'solicitudes' || viewName === 'publicadas') {
      updateListView(viewName, inputId);
    } else {
      renderView();
    }
  } else {
    debouncedFilterRender(viewName, inputId);
  }
}

// Limpiar filtros
function clearFilters(viewName) {
  paginationState[viewName].filters = {
    folio: '',
    nombre: '',
    cargo: '',
    sujetoActivoRepresentado: '',
    estado: '',
    relacionSujetoActivo: '',
    relacionRut: '',
    relacionRepresentado: ''
  };
  paginationState[viewName].page = 1;
  if (viewName === 'solicitudes' || viewName === 'publicadas') {
    updateListView(viewName);
  } else {
    renderView();
  }
}

// Filtro directo de relaciones (un solo clic)
function filtrarRelacionados(viewName, sujetoActivo, rut, representado) {
  // Limpiar filtros manuales anteriores para evitar conflictos y establecer relación
  paginationState[viewName].filters = {
    folio: '',
    nombre: '',
    cargo: '',
    sujetoActivoRepresentado: '',
    estado: '',
    relacionSujetoActivo: sujetoActivo || '',
    relacionRut: rut || '',
    relacionRepresentado: (representado && representado.toLowerCase() !== 'particular') ? representado : ''
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



// Control de Tooltips globales
function showGlobalTooltip(event, text) {
  if (tooltipTimeout) {
    clearTimeout(tooltipTimeout);
    tooltipTimeout = null;
  }

  const tooltip = document.getElementById('global-tooltip');
  const tooltipText = document.getElementById('global-tooltip-text');
  if (!tooltip || !tooltipText) return;

  tooltipText.textContent = text || 'Sin Cargo Definido';
  tooltip.classList.remove('hidden');
  
  // Forzar reflujo
  tooltip.offsetHeight;
  tooltip.classList.remove('opacity-0');
  tooltip.classList.add('opacity-100');

  // Posicionar tooltip
  const rect = event.currentTarget.getBoundingClientRect();
  const tooltipRect = tooltip.getBoundingClientRect();
  
  // Centrado horizontal sobre el elemento
  let left = rect.left + (rect.width - tooltipRect.width) / 2;
  // Posición vertical arriba del elemento
  let top = rect.top - tooltipRect.height - 8;

  // Evitar que se salga por los lados de la pantalla
  if (left < 10) left = 10;
  if (left + tooltipRect.width > window.innerWidth - 10) {
    left = window.innerWidth - tooltipRect.width - 10;
  }
  // Si se sale por arriba de la pantalla, mostrar abajo del elemento
  if (top < 10) {
    top = rect.bottom + 8;
  }

  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top}px`;
}

function hideGlobalTooltip() {
  const tooltip = document.getElementById('global-tooltip');
  if (!tooltip) return;
  tooltip.classList.remove('opacity-100');
  tooltip.classList.add('opacity-0');
  
  if (tooltipTimeout) {
    clearTimeout(tooltipTimeout);
  }
  
  // Ocultar después de la transición
  tooltipTimeout = setTimeout(() => {
    if (tooltip.classList.contains('opacity-0')) {
      tooltip.classList.add('hidden');
    }
  }, 150);
}

// Mostrar notificaciones Toast
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg text-sm transition-all duration-300 transform translate-y-2 opacity-0 glass-card border-l-4 ${
    type === 'success' ? 'border-l-emerald-500 text-emerald-300' : 'border-l-rose-500 text-rose-300'
  }`;
  
  const icon = type === 'success' ? 'check-circle' : 'alert-circle';
  toast.innerHTML = `
    <i data-lucide="${icon}" class="h-5 w-5 shrink-0"></i>
    <span>${message}</span>
  `;
  
  container.appendChild(toast);
  lucide.createIcons();
  
  // Animación de entrada
  setTimeout(() => {
    toast.classList.remove('translate-y-2', 'opacity-0');
  }, 50);

  // Eliminación automática
  setTimeout(() => {
    toast.classList.add('translate-y-2', 'opacity-0');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// Petición especial de datos para Reportes
async function fetchReportesData(signal) {
  const res = await fetch('/api/solicitudes', { signal });
  if (!res.ok) throw new Error();
  dataStore.reportesRawData = await res.json();
}

// Cambiar de vista activa en el Sidebar y recargar datos
async function switchView(viewName) {
  // Proteger el ruteo en el cliente según rol
  if (viewName !== 'login' && currentUser) {
    const rol = currentUser.rol || '';
    let allowed = true;
    if (rol === 'Auditor') {
      if (viewName === 'administracion' || viewName === 'reportes') allowed = false;
    } else if (rol === 'Sujeto Pasivo' || rol === 'Asistente técnico') {
      if (viewName === 'sujetos_pasivos' || viewName === 'administracion' || viewName === 'reportes') allowed = false;
    }

    if (!allowed) {
      showToast('No tiene permisos para acceder a esta sección.', 'error');
      viewName = 'dashboard';
    }
  }

  currentView = viewName;
  localStorage.setItem('lobby_current_view', viewName);
  
  // Controlar visibilidad del Header según si es vista de Login o no
  const header = document.querySelector('header');
  if (viewName === 'login') {
    if (header) header.classList.add('hidden');
    renderView();
    const emailInput = document.getElementById('login-email');
    const passInput = document.getElementById('login-password');
    if (emailInput) emailInput.value = '';
    if (passInput) passInput.value = '';
    return;
  } else {
    if (header) header.classList.remove('hidden');
    updateHeaderUserSection();
  }
  
  // Actualizar estilos de la Navegación Superior
  const navButtons = ['dashboard', 'solicitudes', 'publicadas', 'sujetos_pasivos', 'reportes', 'administracion'];
  navButtons.forEach(btn => {
    const el = document.getElementById(`nav-${btn}`);
    if (el) {
      if (btn === viewName) {
        el.className = "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 sidebar-nav-active";
      } else {
        el.className = "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 sidebar-nav-inactive";
      }
    }
  });

  // Asegurar que las opciones de menú según rol estén bien ocultas/mostradas después de cambiar clases
  updateHeaderUserSection();

  // Reset pagination for the view
  // Reset page for the view, but keep the filters preserved
  if (paginationState[viewName]) {
    paginationState[viewName].page = 1;
  }

  // Renderizar Loader
  renderLoader();

  // Cargar datos del servidor
  try {
    if (activeAbortController) {
      activeAbortController.abort();
    }
    activeAbortController = new AbortController();
    const signal = activeAbortController.signal;

    if (viewName === 'dashboard') {
      await fetchStats(signal);
      await fetchDashboardData(signal);
      await fetchData('publicadas', signal);
      await fetchActiveSujetoIds(signal);
      buildDashboardDropdownCache();
    } else if (viewName === 'reportes') {
      await fetchReportesData(signal);
      await fetchData('publicadas', signal);
      dataStore.dashboardRawData = dataStore.reportesRawData;
      buildDashboardDropdownCache();
    } else {
      if (viewName === 'solicitudes' || viewName === 'publicadas') {
        if (!dataStore.dashboardRawData || dataStore.dashboardRawData.length === 0) {
          await fetchDashboardData(signal);
        }
        await fetchPaginatedList(viewName, signal);
      } else if (viewName === 'alertas') {
        await fetchAlertas(signal);
      } else {
        await fetchData(viewName, signal);
      }
      
      if (viewName === 'administracion') {
        // Cargar sujetos pasivos para poblar selector de asistente técnico y datos de salud/historial
        await fetchData('sujetos_pasivos', signal);
        await fetchStats(signal);
        await fetchDbHealth(signal);
        await fetchSyncHistory(signal);
        await fetchAuditoria(signal);
        
        try {
          const resVals = await fetch('/api/admin/auditoria/valores-actuales', { signal });
          if (resVals.ok) {
            dataStore.valoresActuales = await resVals.json();
          }
        } catch(e) {
          console.error(e);
        }
      }
      if (viewName === 'solicitudes' || viewName === 'publicadas') {
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
    hideLoader(true); // Ocultar spinner y restaurar clics
    renderError();
  }
}

// Spinner de carga
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

// Vista de Error
function renderError() {
  const main = document.getElementById('main-content');
  main.innerHTML = `
    <div class="h-64 flex flex-col items-center justify-center gap-4 text-center">
      <div class="h-12 w-12 rounded-full badge-status-vencido flex items-center justify-center">
        <i data-lucide="alert-triangle" class="h-6 w-6"></i>
      </div>
      <div>
        <h3 class="text-md font-semibold text-heading">Error en Servidor Local</h3>
        <p class="text-xs text-body-muted max-w-sm mt-1">No se pudo establecer conexión con el servidor Node.js. Asegúrate de ejecutar "npm start" y que el puerto 3000 esté libre.</p>
      </div>
      <button onclick="switchView('${currentView}')" class="px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 btn-secondary">
        <i data-lucide="refresh-cw" class="h-3 w-3"></i> Reintentar
      </button>
    </div>
  `;
  lucide.createIcons();
}

// Petición de estadísticas generales
async function fetchStats(signal) {
  const res = await fetch('/api/stats', { signal });
  if (!res.ok) throw new Error();
  dataStore.stats = await res.json();
}

// Petición de datos genérica
async function fetchData(viewName, signal) {
  const apiPath = viewName === 'administracion' ? 'usuarios' : viewName;
  const endpoint = `/api/${apiPath}`;
  const res = await fetch(endpoint, { signal });
  if (!res.ok) throw new Error();
  
  const storeKey = viewName === 'administracion' ? 'usuarios' : viewName;
  dataStore[storeKey] = await res.json();
}

// Petición de lista paginada y filtrada desde el backend
async function fetchPaginatedList(viewName, signal) {
  const pageLimit = 10;
  
  if (viewName === 'solicitudes') {
    const state = paginationState.solicitudes;
    const params = new URLSearchParams({
      page: state.page,
      limit: pageLimit,
      folio: state.filters.folio || '',
      nombre: state.filters.nombre || '',
      cargo: state.filters.cargo || '',
      sujetoActivoRepresentado: state.filters.sujetoActivoRepresentado || '',
      estado: state.filters.estado || '',
      relacionSujetoActivo: state.filters.relacionSujetoActivo || '',
      relacionRut: state.filters.relacionRut || '',
      relacionRepresentado: state.filters.relacionRepresentado || ''
    });
    
    const res = await fetch(`/api/solicitudes?${params.toString()}`, { signal });
    if (!res.ok) throw new Error();
    dataStore.solicitudes = await res.json();
    
  } else if (viewName === 'publicadas') {
    const state = paginationState.publicadas;
    const subTab = state.subTab || 'historial';
    const params = new URLSearchParams({
      page: state.page,
      limit: pageLimit,
      folio: state.filters.folio || '',
      nombre: state.filters.nombre || '',
      cargo: state.filters.cargo || '',
      sujetoActivoRepresentado: state.filters.sujetoActivoRepresentado || '',
      estado: state.filters.estado || '',
      relacionSujetoActivo: state.filters.relacionSujetoActivo || '',
      relacionRut: state.filters.relacionRut || '',
      relacionRepresentado: state.filters.relacionRepresentado || ''
    });
    
    if (subTab === 'historial') {
      const res = await fetch(`/api/publicadas?${params.toString()}`, { signal });
      if (!res.ok) throw new Error();
      dataStore.publicadas = await res.json();
    } else {
      params.set('pending_publication', 'true');
      const res = await fetch(`/api/solicitudes?${params.toString()}`, { signal });
      if (!res.ok) throw new Error();
      dataStore.solicitudesPendientesPublicacion = await res.json();
    }
  }
}

// Actualizar la vista de la lista con cancelación y manejo de errores
async function updateListView(viewName, activeInputId = null) {
  if (activeAbortController) {
    activeAbortController.abort();
  }
  activeAbortController = new AbortController();
  const signal = activeAbortController.signal;
  
  try {
    await fetchPaginatedList(viewName, signal);
    window.activeInputId = activeInputId;
    renderView();
    window.activeInputId = null;
    if (activeInputId) {
      const input = document.getElementById(activeInputId);
      if (input && input.tagName !== 'SELECT') {
        input.focus();
        const len = input.value.length;
        input.setSelectionRange(len, len);
      }
    }
  } catch (err) {
    if (err.name === 'AbortError') return;
    console.error(err);
    showToast('Error al obtener datos paginados del servidor.', 'error');
  }
}

// Helper para disparar re-renderizado o llamada paginada según corresponda
function triggerRenderOrFetch() {
  if (currentView === 'solicitudes' || currentView === 'publicadas') {
    updateListView(currentView);
  } else {
    renderView();
  }
}

// Petición de estado de salud y diagnóstico de base de datos
async function fetchDbHealth(signal) {
  const res = await fetch('/api/admin/db-health', { signal });
  if (!res.ok) throw new Error();
  dataStore.dbHealth = await res.json();
}

// Petición de historial de sincronizaciones
async function fetchSyncHistory(signal) {
  const res = await fetch('/api/admin/historial-sincronizaciones', { signal });
  if (!res.ok) throw new Error();
  dataStore.syncHistory = await res.json();
}

// Petición de registros de auditoría semanal
async function fetchAuditoria(signal) {
  const res = await fetch('/api/admin/auditoria', { signal });
  if (!res.ok) throw new Error();
  dataStore.auditoria = await res.json();
}

// Petición especial de datos para el Dashboard
async function fetchDashboardData(signal) {
  const res = await fetch('/api/solicitudes', { signal });
  if (!res.ok) throw new Error();
  dataStore.dashboardRawData = await res.json();
}

// Petición de IDs de sujetos pasivos vigentes
async function fetchActiveSujetoIds(signal) {
  const res = await fetch('/api/sujetos_pasivos/vigentes', { signal });
  if (!res.ok) throw new Error();
  const data = await res.json();
  activeSujetoIdsCache = new Set(data);
}

// Construir caché única de años, nombres y cargos del sujeto pasivo
function buildDashboardDropdownCache() {
  const rawNombresSet = new Set();
  const rawCargosSet = new Set();
  const rawSujetosActivosRepresentadosSet = new Set();

  const dataset = (dataStore.dashboardRawData && dataStore.dashboardRawData.length) ? dataStore.dashboardRawData : 
                  ((dataStore.solicitudes && dataStore.solicitudes.length) ? dataStore.solicitudes : 
                  ((dataStore.publicadas && dataStore.publicadas.length) ? dataStore.publicadas : []));

  dataset.forEach(item => {
    if (item.sujeto_pasivo) rawNombresSet.add(item.sujeto_pasivo);
    if (item.cargo) rawCargosSet.add(item.cargo);
    if (item.sujeto_activo) rawSujetosActivosRepresentadosSet.add(item.sujeto_activo);
    if (item.representado) rawSujetosActivosRepresentadosSet.add(item.representado);
  });

  // Normalizar solo el conjunto único de valores para evitar sobrecarga de CPU en base de datos grande
  const nombresSet = new Set();
  rawNombresSet.forEach(n => {
    const normalized = normalizeName(n);
    if (normalized) nombresSet.add(normalized);
  });

  const cargosSet = new Set();
  rawCargosSet.forEach(c => {
    const cleaned = getCargoClean(c);
    if (cleaned) cargosSet.add(cleaned);
  });

  const sujetosActivosRepresentadosSet = new Set();
  rawSujetosActivosRepresentadosSet.forEach(s => {
    const normalized = normalizeName(s);
    if (normalized) sujetosActivosRepresentadosSet.add(normalized);
  });

  // Años válidos desde 2015 al año actual
  const currentYear = new Date().getFullYear();
  const validYears = [];
  for (let y = 2015; y <= currentYear; y++) {
    validYears.push(String(y));
  }

  dashboardDropdownCache.anios = validYears.reverse();
  dashboardDropdownCache.nombres = Array.from(nombresSet).sort((a, b) => a.localeCompare(b));
  dashboardDropdownCache.cargos = Array.from(cargosSet).sort((a, b) => a.localeCompare(b));
  dashboardDropdownCache.sujetosActivosRepresentados = Array.from(sujetosActivosRepresentadosSet).sort((a, b) => a.localeCompare(b));
}



// Variable global para controlar la sugerencia activa por teclado
let activeSuggestionIndex = -1;

// Helper para obtener el prefijo de ID de input y los filtros activos según la vista
function getActiveFiltersAndPrefix() {
  let idPrefix, filters;
  if (currentView === 'dashboard') {
    idPrefix = 'dashboard-filter-';
    filters = dashboardFilters;
  } else if (currentView === 'reportes') {
    idPrefix = 'report-filter-';
    filters = reportesFilters;
  } else if (currentView === 'solicitudes') {
    idPrefix = 'solicitudes-filter-';
    filters = paginationState.solicitudes.filters;
  } else if (currentView === 'publicadas') {
    idPrefix = 'publicadas-filter-';
    filters = paginationState.publicadas.filters;
  }
  return { idPrefix, filters };
}

// Obtener el conjunto de datos de búsqueda adecuado para autocompletado de cargos según la vista activa
function getLookupDataset() {
  if (currentView === 'publicadas') {
    return Array.isArray(dataStore.publicadas) ? dataStore.publicadas : (dataStore.publicadas?.data || []);
  }
  if (currentView === 'solicitudes') {
    return (dataStore.dashboardRawData && dataStore.dashboardRawData.length)
      ? dataStore.dashboardRawData
      : (Array.isArray(dataStore.solicitudes) ? dataStore.solicitudes : (dataStore.solicitudes?.data || []));
  }
  return dataStore.dashboardRawData || [];
}

// Mostrar las sugerencias para el campo Nombre o Cargo
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

  let list;
  if (fieldName === 'nombre') {
    list = idPrefix === 'report-filter-' ? ['Todos', ...dashboardDropdownCache.nombres] : dashboardDropdownCache.nombres;
  } else if (fieldName === 'anio') {
    list = dashboardDropdownCache.anios;
  } else if (fieldName === 'sujetoActivoRepresentado') {
    list = dashboardDropdownCache.sujetosActivosRepresentados;
  } else {
    // Si hay un nombre filtrado, limitar las sugerencias de cargo a los correspondientes a ese nombre
    const selectedNombre = (filters.nombre || '').trim().toLowerCase();
    if (selectedNombre !== '' && selectedNombre !== 'todos') {
      const cargosSet = new Set();
      // Usar el dataset correcto según la vista activa
      const lookupDataset = getLookupDataset();
      lookupDataset.forEach(item => {
        if (item.sujeto_pasivo && item.sujeto_pasivo.toLowerCase().includes(selectedNombre)) {
          if (item.cargo) cargosSet.add(getCargoClean(item.cargo));
        }
      });
      list = Array.from(cargosSet).sort((a, b) => a.localeCompare(b));
    } else {
      list = dashboardDropdownCache.cargos;
    }

    if (idPrefix === 'report-filter-') {
      list = ['Todos', ...list];
    }
  }

  if (!list) {
    suggestionsDiv.classList.add('hidden');
    activeSuggestionIndex = -1;
    return;
  }
  
  // Si el campo nombre o sujetoActivoRepresentado está vacío, no mostrar sugerencias
  if ((fieldName === 'nombre' || fieldName === 'sujetoActivoRepresentado') && val.length === 0) {
    suggestionsDiv.classList.add('hidden');
    activeSuggestionIndex = -1;
    return;
  }

  const isValTodos = val.toLowerCase() === 'todos';
  const filtered = (val.length > 0 && fieldName !== 'anio' && !isValTodos)
    ? list.filter(item => item.toLowerCase().includes(val)).slice(0, 8)
    : (fieldName === 'anio' ? list : list.slice(0, 8));

  if (filtered.length === 0) {
    suggestionsDiv.innerHTML = `
      <div class="px-3 py-2 text-xs text-slate-400 italic">
        Sin coincidencias
      </div>
    `;
    suggestionsDiv.classList.remove('hidden');
    activeSuggestionIndex = -1;
    return;
  }

  suggestionsDiv.innerHTML = filtered.map((item, index) => {
    return `
      <div data-action="select-suggestion"
           data-field="${fieldName}"
           data-value="${escapeHtmlAttr(item)}"
           class="suggestion-item px-3 py-2 text-xs text-slate-200 hover:bg-brand-600 hover:text-white cursor-pointer transition-colors truncate">
        ${escapeHtml(item)}
      </div>
    `;
  }).join('');
  suggestionsDiv.classList.remove('hidden');
  activeSuggestionIndex = -1;
}

// Seleccionar sugerencia del Dashboard
function selectDashboardSuggestion(fieldName, value) {
  if (hideSuggestionsTimeout) {
    clearTimeout(hideSuggestionsTimeout);
    hideSuggestionsTimeout = null;
  }

  const { idPrefix, filters } = getActiveFiltersAndPrefix();

  // Si se selecciona un nuevo nombre diferente, resetear el cargo
  if (fieldName === 'nombre' && filters.nombre !== value) {
    filters.cargo = '';
    
    // Si estamos en vistas con bloqueo reactivo, forzar bloqueo en DOM
    const cargoInput = document.getElementById(currentView === 'dashboard' ? 'dashboard-filter-cargo' : `${idPrefix}cargo`);
    if (cargoInput && (currentView === 'reportes' || currentView === 'solicitudes' || currentView === 'publicadas')) {
      if (value === '') {
        cargoInput.disabled = true;
        cargoInput.placeholder = 'Seleccione nombre primero...';
        cargoInput.classList.add('glass-input-disabled', 'cursor-not-allowed');
        cargoInput.classList.remove('text-slate-200');
        cargoInput.value = '';
      } else {
        cargoInput.disabled = false;
        cargoInput.placeholder = 'Escribir cargo...';
        cargoInput.classList.remove('glass-input-disabled', 'cursor-not-allowed');
        cargoInput.classList.add('text-slate-200');
      }
    }
  }

  filters[fieldName] = value;
  
  const input = document.getElementById(`${idPrefix}${fieldName}`);
  if (input) {
    input.value = value;
    input.blur();
  }
  
  const suggestionsDiv = document.getElementById(`suggestions-${fieldName}`);
  if (suggestionsDiv) {
    suggestionsDiv.classList.add('hidden');
  }
  
  activeSuggestionIndex = -1;
  triggerRenderOrFetch();
}

// Ocultar las sugerencias con retardo y aplicar el filtro con validación
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

    // Validar y sincronizar el filtro con el texto del input al salir de él (blur)
    const input = document.getElementById(`${idPrefix}${fieldName}`);
    if (input) {
      const val = input.value.trim();
      
      let list;
      if (fieldName === 'nombre') {
        list = idPrefix === 'report-filter-' ? ['Todos', ...dashboardDropdownCache.nombres] : dashboardDropdownCache.nombres;
      } else if (fieldName === 'sujetoActivoRepresentado') {
        list = dashboardDropdownCache.sujetosActivosRepresentados || [];
      } else if (fieldName === 'cargo') {
        const selectedNombre = (filters.nombre || '').trim().toLowerCase();
        if (selectedNombre !== '' && selectedNombre !== 'todos') {
          const cargosSet = new Set();
          const lookupDataset = getLookupDataset();
          lookupDataset.forEach(item => {
            if (item.sujeto_pasivo && item.sujeto_pasivo.toLowerCase().includes(selectedNombre)) {
              if (item.cargo) cargosSet.add(getCargoClean(item.cargo));
            }
          });
          list = Array.from(cargosSet);
        } else {
          list = dashboardDropdownCache.cargos;
        }
        if (idPrefix === 'report-filter-') {
          list = ['Todos', ...list];
        }
      } else {
        list = dashboardDropdownCache.anios;
      }
      
      if (val === '') {
        if (filters[fieldName] !== '') {
          filters[fieldName] = '';
          if (fieldName === 'nombre') {
            filters.cargo = '';
            
            // Si estamos en vistas con bloqueo reactivo, forzar bloqueo de cargo en DOM
            const cargoInput = document.getElementById(currentView === 'dashboard' ? 'dashboard-filter-cargo' : `${idPrefix}cargo`);
            if (cargoInput && (currentView === 'reportes' || currentView === 'solicitudes' || currentView === 'publicadas')) {
              cargoInput.disabled = true;
              cargoInput.placeholder = 'Seleccione nombre primero...';
              cargoInput.classList.add('glass-input-disabled', 'cursor-not-allowed');
              cargoInput.classList.remove('text-slate-200');
              cargoInput.value = '';
            }
          }
          triggerRenderOrFetch();
        }
      } else {
        // Buscar si existe coincidencia exacta (insensible a mayúsculas) o comodín Todos en reportes
        const isWildcardAllowed = (currentView === 'reportes' && (fieldName === 'nombre' || fieldName === 'cargo') && val.toLowerCase() === 'todos');
        const matchedItem = isWildcardAllowed ? 'Todos' : list.find(item => item.toLowerCase() === val.toLowerCase());
        if (matchedItem) {
          if (filters[fieldName] !== matchedItem) {
            if (fieldName === 'nombre') {
              filters.cargo = '';
              
              // Si estamos en vistas con bloqueo reactivo, forzar desbloqueo de cargo en DOM
              const cargoInput = document.getElementById(currentView === 'dashboard' ? 'dashboard-filter-cargo' : `${idPrefix}cargo`);
              if (cargoInput && (currentView === 'reportes' || currentView === 'solicitudes' || currentView === 'publicadas')) {
                cargoInput.disabled = false;
                cargoInput.placeholder = 'Escribir cargo...';
                cargoInput.classList.remove('glass-input-disabled', 'cursor-not-allowed');
                cargoInput.classList.add('text-slate-200');
              }
            }
            filters[fieldName] = matchedItem;
            input.value = matchedItem;
          }
          triggerRenderOrFetch();
        } else {
          // Si no existe, rechazar la entrada y volver al valor anterior
          input.value = filters[fieldName] || '';
          showToast(`El ${fieldName === 'nombre' ? 'nombre' : (fieldName === 'cargo' ? 'cargo' : (fieldName === 'sujetoActivoRepresentado' ? 'sujeto activo/representado' : 'año'))} ingresado no existe en el sistema.`, 'error');
          triggerRenderOrFetch();
        }
      }
    }
  }, 200);
}

// Manejar cambios en el input del dashboard y mostrar sugerencias sin actualizar estadísticas
function handleDashboardInputWithSuggestions(event, fieldName) {
  const value = event.target.value;
  showDashboardSuggestions(fieldName);
  
  const { idPrefix, filters } = getActiveFiltersAndPrefix();

  // Si se vacía completamente, limpiamos el filtro y actualizamos las estadísticas de inmediato
  if (value.trim() === '') {
    if (filters[fieldName] !== '') {
      filters[fieldName] = '';
      if (fieldName === 'nombre') {
        filters.cargo = '';
        
        // Si estamos en vistas con bloqueo reactivo, forzar bloqueo de cargo en DOM
        const cargoInput = document.getElementById(currentView === 'dashboard' ? 'dashboard-filter-cargo' : `${idPrefix}cargo`);
        if (cargoInput && (currentView === 'reportes' || currentView === 'solicitudes' || currentView === 'publicadas')) {
          cargoInput.disabled = true;
          cargoInput.placeholder = 'Seleccione nombre primero...';
          cargoInput.classList.add('glass-input-disabled', 'cursor-not-allowed');
          cargoInput.classList.remove('text-slate-200');
          cargoInput.value = '';
        }
      }
      triggerRenderOrFetch();
      const input = document.getElementById(`${idPrefix}${fieldName}`);
      if (input) {
        input.focus();
      }
    }
  } else {
    // Si no está vacío y estamos en tablas (reportes, solicitudes, publicadas), filtrar en tiempo real (debounced)
    if (currentView === 'reportes' || currentView === 'solicitudes' || currentView === 'publicadas') {
      filters[fieldName] = value;
      if (fieldName === 'nombre') {
        filters.cargo = '';
        // Forzar desbloqueo de cargo en DOM
        const cargoInput = document.getElementById(currentView === 'dashboard' ? 'dashboard-filter-cargo' : `${idPrefix}cargo`);
        if (cargoInput) {
          cargoInput.disabled = false;
          cargoInput.placeholder = 'Escribir cargo...';
          cargoInput.classList.remove('glass-input-disabled', 'cursor-not-allowed');
          cargoInput.classList.add('text-slate-200');
        }
      }
      
      if (currentView === 'reportes') {
        debouncedReportesRender(`${idPrefix}${fieldName}`);
      } else {
        debouncedFilterRender(currentView, `${idPrefix}${fieldName}`);
      }
    }
  }
}

// Manejar navegación por teclado en el menú de sugerencias con validación
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
      
      let list;
      if (fieldName === 'nombre') {
        list = idPrefix === 'report-filter-' ? ['Todos', ...dashboardDropdownCache.nombres] : dashboardDropdownCache.nombres;
      } else if (fieldName === 'sujetoActivoRepresentado') {
        list = dashboardDropdownCache.sujetosActivosRepresentados || [];
      } else if (fieldName === 'cargo') {
        const selectedNombre = (filters.nombre || '').trim().toLowerCase();
        if (selectedNombre !== '' && selectedNombre !== 'todos') {
          const cargosSet = new Set();
          const lookupDataset = getLookupDataset();
          lookupDataset.forEach(item => {
            if (item.sujeto_pasivo && item.sujeto_pasivo.toLowerCase().includes(selectedNombre)) {
              if (item.cargo) cargosSet.add(getCargoClean(item.cargo));
            }
          });
          list = Array.from(cargosSet);
        } else {
          list = dashboardDropdownCache.cargos;
        }
        if (idPrefix === 'report-filter-') {
          list = ['Todos', ...list];
        }
      } else {
        list = dashboardDropdownCache.anios;
      }
      
      if (selectedValue) {
        selectDashboardSuggestion(fieldName, selectedValue);
      } else {
        // Validar el texto del input al presionar Enter
        if (val === '') {
          selectDashboardSuggestion(fieldName, '');
        } else {
          const isWildcardAllowed = (currentView === 'reportes' && (fieldName === 'nombre' || fieldName === 'cargo') && val.toLowerCase() === 'todos');
          const matchedItem = isWildcardAllowed ? 'Todos' : list.find(item => item.toLowerCase() === val.toLowerCase());
          if (matchedItem) {
            selectDashboardSuggestion(fieldName, matchedItem);
          } else {
            // Si no existe, rechazar y revertir al filtro actual
            input.value = filters[fieldName] || '';
            showToast(`El ${fieldName === 'nombre' ? 'nombre' : (fieldName === 'cargo' ? 'cargo' : (fieldName === 'sujetoActivoRepresentado' ? 'sujeto activo/representado' : 'año'))} ingresado no existe en el sistema.`, 'error');
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

// Actualizar elemento resaltado de sugerencias
function updateHighlightedSuggestion(items) {
  items.forEach((item, idx) => {
    if (idx === activeSuggestionIndex) {
      item.classList.add('bg-brand-600', 'text-white');
      item.classList.remove('text-slate-200');
      item.scrollIntoView({ block: 'nearest' });
    } else {
      item.classList.remove('bg-brand-600', 'text-white');
      item.classList.add('text-slate-200');
    }
  });
}

// Cambiar filtro del dashboard y re-renderizar
function handleDashboardFilter(fieldName, value) {
  dashboardFilters[fieldName] = value;
  renderView();
}

// Limpiar filtros del dashboard
function clearDashboardFilters() {
  dashboardFilters = {
    anio: '',
    fechaInicio: '',
    fechaTermino: '',
    nombre: '',
    cargo: ''
  };
  renderView();
}

// Manejar cambios en filtros de reportes con debounce y mantención de foco
const debouncedReportesRender = debounce((activeInputId) => {
  window.activeInputId = activeInputId;
  renderView();
  window.activeInputId = null;
  if (activeInputId) {
    const input = document.getElementById(activeInputId);
    if (input) {
      input.focus();
      const len = input.value.length;
      input.setSelectionRange(len, len);
    }
  }
}, 250);

function handleReportesFilter(fieldName, value, inputId) {
  paginationState.reportes.page = 1;
  if (fieldName === 'nombre') {
    reportesFilters.nombre = value;
    // Si cambia o se limpia el nombre, resetear cargo a vacío
    reportesFilters.cargo = '';
    
    // Forzar el bloqueo del input físico en el DOM
    const cargoInput = document.getElementById('report-filter-cargo');
    if (cargoInput) {
      if (value === '') {
        cargoInput.disabled = true;
        cargoInput.placeholder = 'Seleccione nombre primero...';
        cargoInput.classList.add('glass-input-disabled', 'cursor-not-allowed');
        cargoInput.classList.remove('text-slate-200');
        cargoInput.value = '';
      } else {
        cargoInput.disabled = false;
        cargoInput.placeholder = 'Escribir cargo...';
        cargoInput.classList.remove('glass-input-disabled', 'cursor-not-allowed');
        cargoInput.classList.add('text-slate-200');
      }
    }
  } else if (fieldName === 'cargo') {
    reportesFilters.cargo = value;
  } else if (fieldName === 'fechaInicio') {
    reportesFilters.fechaInicio = value;
  } else if (fieldName === 'fechaTermino') {
    reportesFilters.fechaTermino = value;
  }

  debouncedReportesRender(inputId);
}

function handleReportesEstadoToggle(estado, checked) {
  paginationState.reportes.page = 1;
  if (checked) {
    if (!reportesFilters.estados.includes(estado)) {
      reportesFilters.estados.push(estado);
    }
  } else {
    reportesFilters.estados = reportesFilters.estados.filter(e => e !== estado);
  }
  debouncedReportesRender();
}

function clearReportesFilters() {
  paginationState.reportes.page = 1;
  reportesFilters = {
    nombre: '',
    cargo: '',
    fechaInicio: '',
    fechaTermino: '',
    estados: []
  };
  renderView();
}


// Renderizar Vistas según selección
function renderView() {
  const main = document.getElementById('main-content');
  if (!main) return;
  
  switch (currentView) {
    case 'login':
      renderLogin(main);
      break;
    case 'dashboard':
      renderDashboard(main);
      initDashboardCharts();
      ['count-total-solicitudes', 'count-solicitudes-respondidas', 'count-solicitudes-pendientes',
       'count-estado-aceptada', 'count-estado-rechazada', 'count-estado-suspendida', 
       'count-estado-cancelada', 'count-estado-encomendada', 'count-estado-publicadas', 
       'count-estado-pendientesPublicacion'].forEach(id => animateNumberCount(id, null, 1000));
      break;
    case 'solicitudes':
      renderSolicitudes(main);
      break;
    case 'publicadas':
      renderPublicadas(main);
      break;
    case 'sujetos_pasivos':
      renderSujetosPasivos(main);
      break;
    case 'administracion':
      renderUsuarios(main);
      break;
    case 'reportes':
      renderReportes(main);
      break;
    case 'alertas':
      renderAlertasCentro(main);
      break;
  }
  lucide.createIcons();
  updateThemeIcons();
  hideLoader(!!window.activeInputId);
}



// Eliminación genérica de registros
function deleteRecord(viewName, id) {
  openConfirmModal(
    'Eliminar Registro',
    '¿Estás seguro de que deseas eliminar este registro de la base de datos local? Esta acción no se puede deshacer.',
    async () => {
      try {
        let endpoint = `/api/${viewName}/${id}`;
        if (viewName === 'solicitudes_sh') endpoint = `/api/solicitudes/${id}`;
        
        const res = await fetch(endpoint, {
          method: 'DELETE'
        });

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || 'No se pudo eliminar el registro.');
        }

        showToast('Registro eliminado con éxito.');
        fetchAndUpdateDbTimestamp();
        switchView(currentView);
      } catch (err) {
        showToast(err.message, 'error');
      }
    }
  );
}

// Cerrar modal
function closeModal() {
  const modal = document.getElementById('modal-container');
  if (modal) {
    modal.classList.add('hidden');
    modal.innerHTML = '';
  }
}

/**
 * Abre un modal de confirmación con estética premium integrada
 * @param {string} title - Título del diálogo
 * @param {string} message - Mensaje descriptivo
 * @param {Function} onConfirm - Callback a ejecutar al confirmar
 */
function openConfirmModal(title, message, onConfirm) {
  const modal = document.getElementById('modal-container');
  if (!modal) return;
  modal.classList.remove('hidden');

  modal.innerHTML = `
    <div class="glass-card w-full max-w-md p-6 rounded-3xl space-y-5 shadow-2xl relative animate-fade-in border border-slate-200 dark:border-slate-800">
      <!-- Icono de advertencia premium -->
      <div class="flex items-center gap-3">
        <div class="h-10 w-10 rounded-xl bg-amber-500/10 text-amber-500 dark:text-amber-400 flex items-center justify-center shrink-0">
          <i data-lucide="alert-triangle" class="h-5 w-5"></i>
        </div>
        <div>
          <h3 class="text-sm font-bold text-heading uppercase tracking-wider">${title}</h3>
        </div>
      </div>

      <p class="text-xs text-body-muted leading-relaxed">${message}</p>

      <div class="flex justify-end gap-3 pt-2">
        <button type="button" onclick="closeModal()" class="px-4 py-2.5 rounded-xl text-xs font-semibold btn-secondary">
          Cancelar
        </button>
        <button type="button" id="btn-confirm-modal-action" class="px-4 py-2.5 rounded-xl text-xs font-bold btn-primary text-white">
          Confirmar
        </button>
      </div>
    </div>
  `;

  // Asignar acción de confirmación
  const confirmBtn = document.getElementById('btn-confirm-modal-action');
  if (confirmBtn) {
    confirmBtn.onclick = () => {
      closeModal();
      onConfirm();
    };
  }

  // Actualizar iconos de Lucide
  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
}

function renderAlertasWidget() {
  const container = document.getElementById('alerts-widget-container');
  if (!container) return;

  if (!currentUser || !dataStore.alertas) {
    container.innerHTML = '';
    return;
  }

  const warnings = getActiveAlertsList(false);
  const hasWarnings = warnings.length > 0;

  container.innerHTML = `
    <button id="alerts-toggle-btn" onclick="toggleAlertsDropdown(event)" class="relative h-8 w-8 rounded-xl flex items-center justify-center border border-slate-800 hover:border-slate-700 bg-slate-950/40 text-slate-300 hover:text-white transition-all duration-200" title="Alertas de Plazos">
      <i data-lucide="bell" class="h-4 w-4"></i>
      ${hasWarnings ? `
        <span class="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold text-white ring-2 ring-[var(--bg-header)] animate-pulse">
          ${warnings.length}
        </span>
      ` : ''}
    </button>
    
    <div id="alerts-dropdown" class="hidden absolute right-0 mt-2 w-80 glass-card text-[var(--text-primary)] rounded-2xl p-4 z-50 flex flex-col gap-3">
      <div class="flex items-center justify-between border-b border-[var(--border-ui)] pb-2">
        <h3 class="text-xs font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
          <i data-lucide="alert-circle" class="h-3.5 w-3.5 text-brand-500 dark:text-brand-400"></i>
          Alertas de Plazos
        </h3>
        ${hasWarnings ? `
          <button onclick="dismissAllAlertas(event)" class="text-[10px] text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 font-bold transition-all duration-150 flex items-center gap-1 hover:underline cursor-pointer" title="Descartar todas las alertas actuales">
            <i data-lucide="check-check" class="h-3.5 w-3.5"></i> Descartar todo
          </button>
        ` : `
          <span class="text-[10px] text-[var(--text-tertiary)] font-medium">0 activas</span>
        `}
      </div>
      
      <div class="max-h-60 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
        ${!hasWarnings ? `
          <div class="text-center py-6 text-[var(--text-tertiary)] text-xs">
            <i data-lucide="check-circle" class="h-8 w-8 text-emerald-500/80 mx-auto mb-2"></i>
            <span>No hay alertas pendientes</span>
            <p class="text-[10px] text-[var(--text-tertiary)] mt-0.5">Todos los plazos están al día</p>
          </div>
        ` : warnings.map(w => `
          <div class="p-2.5 rounded-xl border border-[var(--border-ui)] border-l-4 ${
            w.color === 'red' ? 'border-l-rose-500 bg-rose-500/[0.03] dark:bg-rose-950/10' : 'border-l-amber-500 bg-amber-500/[0.03] dark:bg-amber-950/10'
          } hover:bg-slate-50/50 dark:hover:bg-slate-900/20 transition-colors flex gap-2.5 items-start text-left relative group">
            <span class="flex h-2 w-2 rounded-full mt-1.5 shrink-0 ${
              w.color === 'red' ? 'bg-rose-500 shadow-[0_0_8px_rgba(239,68,68,0.5)] animate-pulse' : 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]'
            }"></span>
            <div class="flex-1 min-w-0">
              <div class="text-xs font-semibold text-[var(--text-primary)] mb-0.5 flex justify-between gap-2">
                <span class="truncate pr-4">${w.sujeto_pasivo || 'Sujeto Pasivo'}</span>
                <span class="text-[9px] text-[var(--text-tertiary)] font-mono tracking-tighter shrink-0">${formatDate(w.deadline)}</span>
              </div>
              <p class="text-[10px] text-[var(--text-secondary)] leading-normal">${w.text}</p>
              <div class="mt-1 flex items-center gap-2">
                <button onclick="goToAlertItem('${w.type}', '${w.folio}')" class="text-[9px] text-brand-500 dark:text-brand-400 hover:text-brand-600 dark:hover:text-brand-300 font-semibold flex items-center gap-0.5 transition-colors">
                  Ir al registro <i data-lucide="arrow-right" class="h-2.5 w-2.5"></i>
                </button>
              </div>
            </div>
            <button onclick="dismissAlerta(event, '${w.type}', '${w.id}')" class="absolute top-2 right-2 text-[var(--text-tertiary)] hover:text-rose-500 transition-colors duration-150 rounded p-0.5 opacity-0 group-hover:opacity-100 focus:opacity-100" title="Descartar alerta">
              <i data-lucide="x" class="h-3 w-3"></i>
            </button>
          </div>
        `).join('')}
      </div>

      <div class="border-t border-[var(--border-ui)] pt-2 text-center mt-1">
        <button onclick="switchView('alertas'); toggleAlertsDropdown(event);" class="text-[11px] text-brand-500 dark:text-brand-400 hover:text-brand-600 dark:hover:text-brand-300 font-semibold hover:underline flex items-center justify-center gap-1 w-full py-1 cursor-pointer">
          <i data-lucide="layout-list" class="h-3 w-3"></i> Ver todas (Centro de Alertas)
        </button>
      </div>
    </div>
  `;

  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
}

// Modal y acciones: Control de Usuarios
// Función para controlar la visibilidad del selector de sujeto pasivo asistido
function toggleAsistidoSelector() {
  const rolSelect = document.getElementById('user-rol');
  const asistidoContainer = document.getElementById('user-asistido-container');
  const asistidoSelect = document.getElementById('user-asistido-rut');
  if (rolSelect && asistidoContainer && asistidoSelect) {
    if (rolSelect.value === 'Asistente técnico') {
      asistidoContainer.classList.remove('hidden');
      asistidoSelect.setAttribute('required', 'true');
    } else {
      asistidoContainer.classList.add('hidden');
      asistidoSelect.removeAttribute('required');
      asistidoSelect.value = '';
    }
  }
}

function openUsuarioModal(id = null) {
  const modal = document.getElementById('modal-container');
  if (!modal) return;
  modal.classList.remove('hidden');

  const isEdit = id !== null;
  let user = { nombre: '', correo: '', rol: 'Administrador', rut: '', asistido_rut: '' };
  if (isEdit) {
    user = dataStore.usuarios.find(u => u.id === id) || user;
  }

  // Obtener lista de sujetos pasivos únicos por RUT para el selector
  const uniqueSujetos = [];
  const seenRuts = new Set();
  (dataStore.sujetos_pasivos || []).forEach(sp => {
    if (sp.rut && !seenRuts.has(sp.rut)) {
      seenRuts.add(sp.rut);
      uniqueSujetos.push(sp);
    }
  });
  uniqueSujetos.sort((a, b) => a.nombre.localeCompare(b.nombre));

  modal.innerHTML = `
    <div class="glass-card w-full max-w-md p-6 rounded-2xl space-y-6 shadow-2xl relative">
      <div>
        <h3 class="text-lg font-bold text-heading">${isEdit ? 'Editar Usuario' : 'Nuevo Usuario'}</h3>
        <p class="text-xs text-body-muted">Completa los datos locales para registrar el acceso.</p>
      </div>

      <form id="usuario-form" onsubmit="saveUsuario(event, ${id})" class="space-y-4">
        <div class="space-y-1">
          <label class="text-[10px] font-bold text-body-muted uppercase">Nombre Completo</label>
          <input type="text" id="user-nombre" value="${user.nombre}" required class="w-full px-3 py-2 rounded-xl text-xs glass-input text-slate-200 placeholder-slate-400">
        </div>

        <div class="space-y-1">
          <label class="text-[10px] font-bold text-body-muted uppercase">RUT</label>
          <input type="text" id="user-rut" value="${user.rut || ''}" placeholder="12.345.678-9" class="w-full px-3 py-2 rounded-xl text-xs glass-input text-slate-200 placeholder-slate-400">
        </div>

        <div class="space-y-1">
          <label class="text-[10px] font-bold text-body-muted uppercase">Correo Electrónico</label>
          <input type="email" id="user-correo" value="${user.correo}" required placeholder="ejemplo@correo.com" ${isEdit ? 'readonly class="w-full px-3 py-2 rounded-xl text-xs glass-input glass-input-disabled cursor-not-allowed"' : 'class="w-full px-3 py-2 rounded-xl text-xs glass-input text-slate-200 placeholder-slate-400"'}>
        </div>

        <div class="space-y-1">
          <label class="text-[10px] font-bold text-body-muted uppercase">Rol en Sistema</label>
          <select id="user-rol" onchange="toggleAsistidoSelector()" class="w-full px-3 py-2 rounded-xl text-xs glass-input">
            <option value="Administrador" ${user.rol === 'Administrador' ? 'selected' : ''}>Administrador</option>
            <option value="Auditor" ${user.rol === 'Auditor' ? 'selected' : ''}>Auditor</option>
            <option value="Sujeto Pasivo" ${user.rol === 'Sujeto Pasivo' ? 'selected' : ''}>Sujeto Pasivo</option>
            <option value="Asistente técnico" ${user.rol === 'Asistente técnico' ? 'selected' : ''}>Asistente técnico</option>
          </select>
        </div>

        <div class="space-y-1 ${user.rol === 'Asistente técnico' ? '' : 'hidden'}" id="user-asistido-container">
          <label class="text-[10px] font-bold text-body-muted uppercase">Sujeto Pasivo a Asistir</label>
          <select id="user-asistido-rut" ${user.rol === 'Asistente técnico' ? 'required' : ''} class="w-full px-3 py-2 rounded-xl text-xs glass-input">
            <option value="">-- Seleccionar Sujeto Pasivo --</option>
            ${uniqueSujetos.map(sp => `<option value="${sp.rut}" ${user.asistido_rut === sp.rut ? 'selected' : ''}>${sp.nombre} (${sp.rut})</option>`).join('')}
          </select>
        </div>

        <div class="space-y-1">
          <div class="flex justify-between items-center">
            <label class="text-[10px] font-bold text-body-muted uppercase">Contraseña ${isEdit ? '(dejar en blanco para no cambiar)' : ''}</label>
            <button type="button" onclick="const p = generateSecurePassword(); const inp = document.getElementById('user-password'); inp.value = p; inp.type = 'text'; const eye = document.getElementById('user-password-eye'); if (eye) { eye.setAttribute('data-lucide', 'eye-off'); lucide.createIcons(); } navigator.clipboard.writeText(p); showToast('Contraseña segura generada y copiada al portapapeles.');" class="text-[10px] font-semibold text-brand-400 hover:text-brand-300 transition-colors flex items-center gap-1">
              <i data-lucide="key" class="h-3 w-3"></i> Generar y copiar
            </button>
          </div>
          <div class="relative">
            <input type="password" id="user-password" ${isEdit ? '' : 'required'} placeholder="${isEdit ? '••••••••' : 'Escriba contraseña...'}" class="w-full pl-3 pr-10 py-2 rounded-xl text-xs glass-input text-slate-200 placeholder-slate-400">
            <button type="button" onclick="togglePasswordVisibility('user-password', 'user-password-eye')" class="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-white transition-colors" title="Mostrar contraseña">
              <i id="user-password-eye" data-lucide="eye" class="h-4 w-4"></i>
            </button>
          </div>
        </div>

        <div class="flex justify-end gap-3 pt-2">
          <button type="button" onclick="closeModal()" class="px-4 py-2 rounded-xl text-xs font-semibold btn-secondary">Cancelar</button>
          <button type="submit" class="px-4 py-2 rounded-xl text-xs font-semibold btn-primary">Guardar Cambios</button>
        </div>
      </form>
    </div>
  `;
  lucide.createIcons();
}

async function saveUsuario(event, id) {
  event.preventDefault();
  const nombre = document.getElementById('user-nombre').value;
  const correo = document.getElementById('user-correo').value;
  const rol = document.getElementById('user-rol').value;
  const rut = document.getElementById('user-rut').value;
  const password = document.getElementById('user-password').value;
  const asistido_rut = rol === 'Asistente técnico' ? document.getElementById('user-asistido-rut').value : '';

  const isEdit = id !== null;
  const url = isEdit ? `/api/usuarios/${id}` : '/api/usuarios';
  const method = isEdit ? 'PUT' : 'POST';

  const bodyData = { nombre, correo, rol, rut, asistido_rut };
  if (password && password.trim() !== '') {
    bodyData.password = password;
  }

  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyData)
    });

    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.error || 'Error en la petición.');
    }

    showToast(isEdit ? 'Usuario actualizado.' : 'Usuario registrado.');
    closeModal();
    fetchAndUpdateDbTimestamp();
    switchView('administracion');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// Modal y acciones: Editar Perfil Propio
function openProfileModal() {
  if (!currentUser) return;
  const modal = document.getElementById('modal-container');
  if (!modal) return;
  modal.classList.remove('hidden');

  const isAdmin = currentUser.rol === 'Administrador';

  modal.innerHTML = `
    <div class="glass-card w-full max-w-md p-6 rounded-2xl space-y-6 shadow-2xl relative animate-fade-in">
      <div class="absolute -top-10 -left-10 w-24 h-24 bg-brand-600/10 rounded-full blur-2xl pointer-events-none"></div>
      <div class="absolute -bottom-10 -right-10 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none"></div>

      <div>
        <h3 class="text-lg font-bold text-heading">Mi Perfil</h3>
        <p class="text-xs text-body-muted">Visualiza y edita los datos de tu cuenta personal.</p>
      </div>

      <form id="profile-form" onsubmit="saveProfile(event)" class="space-y-4">
        <!-- NOMBRE -->
        <div class="space-y-1">
          <label class="text-[10px] font-bold text-body-muted uppercase">Nombre Completo</label>
          <input type="text" id="profile-nombre" value="${currentUser.nombre || ''}" 
                 ${isAdmin ? 'required' : 'readonly'} 
                 class="w-full px-3 py-2 rounded-xl text-xs glass-input ${isAdmin ? 'text-slate-200 placeholder-slate-400' : 'glass-input-disabled cursor-not-allowed'}">
        </div>

        <!-- RUT -->
        <div class="space-y-1">
          <label class="text-[10px] font-bold text-body-muted uppercase">RUT</label>
          <input type="text" id="profile-rut" value="${currentUser.rut || ''}" placeholder="12.345.678-9"
                 ${isAdmin ? '' : 'readonly'} 
                 class="w-full px-3 py-2 rounded-xl text-xs glass-input ${isAdmin ? 'text-slate-200 placeholder-slate-400' : 'glass-input-disabled cursor-not-allowed'}">
        </div>

        <!-- ROL -->
        <div class="space-y-1">
          <label class="text-[10px] font-bold text-body-muted uppercase">Rol del Sistema</label>
          <input type="text" id="profile-rol" value="${currentUser.rol || 'Analista'}" readonly 
                 class="w-full px-3 py-2 rounded-xl text-xs glass-input glass-input-disabled cursor-not-allowed">
        </div>

        <!-- CORREO ELECTRÓNICO -->
        <div class="space-y-1">
          <label class="text-[10px] font-bold text-body-muted uppercase">Correo Electrónico</label>
          <input type="email" id="profile-correo" value="${currentUser.correo || ''}" required placeholder="ejemplo@correo.com"
                 class="w-full px-3 py-2 rounded-xl text-xs glass-input text-slate-200 placeholder-slate-400">
        </div>

        <!-- CONTRASEÑA -->
        <div class="space-y-1">
          <div class="flex justify-between items-center">
            <label class="text-[10px] font-bold text-body-muted uppercase">Contraseña (dejar en blanco para conservar la actual)</label>
            <button type="button" onclick="const p = generateSecurePassword(); const inp = document.getElementById('profile-password'); inp.value = p; inp.type = 'text'; const eye = document.getElementById('profile-password-eye'); if (eye) { eye.setAttribute('data-lucide', 'eye-off'); lucide.createIcons(); } navigator.clipboard.writeText(p); showToast('Contraseña segura generada y copiada al portapapeles.');" class="text-[10px] font-semibold text-brand-400 hover:text-brand-300 transition-colors flex items-center gap-1">
              <i data-lucide="key" class="h-3 w-3"></i> Generar y copiar
            </button>
          </div>
          <div class="relative">
            <input type="password" id="profile-password" placeholder="••••••••" class="w-full pl-3 pr-10 py-2 rounded-xl text-xs glass-input text-slate-200 placeholder-slate-400">
            <button type="button" onclick="togglePasswordVisibility('profile-password', 'profile-password-eye')" class="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-white transition-colors" title="Mostrar contraseña">
              <i id="profile-password-eye" data-lucide="eye" class="h-4 w-4"></i>
            </button>
          </div>
        </div>

        <div class="flex justify-end gap-3 pt-2">
          <button type="button" onclick="closeModal()" class="px-4 py-2 rounded-xl text-xs font-semibold btn-secondary">Cancelar</button>
          <button type="submit" class="px-4 py-2 rounded-xl text-xs font-semibold btn-primary">Guardar Cambios</button>
        </div>
      </form>
    </div>
  `;
  lucide.createIcons();
}

async function saveProfile(event) {
  event.preventDefault();
  const nombre = document.getElementById('profile-nombre').value;
  const correo = document.getElementById('profile-correo').value;
  const rut = document.getElementById('profile-rut').value;
  const password = document.getElementById('profile-password').value;

  const bodyData = { correo };
  
  if (currentUser.rol === 'Administrador') {
    bodyData.nombre = nombre;
    bodyData.rut = rut;
  }
  
  if (password && password.trim() !== '') {
    bodyData.password = password;
  }

  try {
    const res = await fetch('/api/perfil', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyData)
    });

    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.error || 'Error al actualizar el perfil.');
    }

    const updatedUser = await res.json();
    currentUser = updatedUser;
    
    showToast('Perfil actualizado con éxito.');
    closeModal();
    updateHeaderUserSection();
    fetchAndUpdateDbTimestamp();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// =========================================================================
// DELEGACIÓN DE EVENTOS GLOBAL UNIFICADA (SISTEMA DE COMPONENTES GLOBALES)
// =========================================================================

// 1. Eventos de Input (Escribir en campos)
document.addEventListener('input', (e) => {
  const target = e.target;
  
  if (target.dataset.component === 'search-input') {
    const fieldName = target.dataset.field;
    const isAutocomplete = target.dataset.autocomplete === 'true';
    
    if (isAutocomplete) {
      handleDashboardInputWithSuggestions(e, fieldName);
    } else {
      if (target.id === 'search-sujetos') {
        handleSearch('sujetos_pasivos', target.value);
      } else {
        handleMultiFilter(currentView, fieldName, target.value);
      }
    }
  }
});

// 2. Eventos de Keydown (Navegación por teclado en sugerencias)
document.addEventListener('keydown', (e) => {
  const target = e.target;
  if (target.dataset.component === 'search-input' && target.dataset.autocomplete === 'true') {
    const fieldName = target.dataset.field;
    handleDashboardInputKeydown(e, fieldName);
  }
});

// 3. Eventos de Focus (Mostrar sugerencias al enfocar)
document.addEventListener('focus', (e) => {
  const target = e.target;
  if (target.dataset.component === 'search-input' && target.dataset.autocomplete === 'true') {
    const fieldName = target.dataset.field;
    showDashboardSuggestions(fieldName);
    
    // Ocultar temporalmente la tarjeta/badge overlay y hacer visible el texto para editarlo
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
  
  // Limpiar filtro mediante X en la card/badge
  const clearBadgeBtn = target.closest('[data-action="clear-input-badge"]');
  if (clearBadgeBtn) {
    e.preventDefault();
    e.stopPropagation();
    const fieldName = clearBadgeBtn.dataset.field;
    const inputId = clearBadgeBtn.dataset.inputId;
    
    const { idPrefix, filters } = getActiveFiltersAndPrefix();
    filters[fieldName] = '';
    
    if (fieldName === 'nombre') {
      filters.cargo = '';
      const cargoInput = document.getElementById(currentView === 'dashboard' ? 'dashboard-filter-cargo' : `${idPrefix}cargo`);
      if (cargoInput) {
        cargoInput.disabled = true;
        cargoInput.placeholder = 'Seleccione nombre primero...';
        cargoInput.classList.add('glass-input-disabled', 'cursor-not-allowed');
        cargoInput.classList.remove('text-slate-200');
        cargoInput.value = '';
      }
    }
    
    const input = document.getElementById(inputId);
    if (input) {
      input.value = '';
      input.disabled = (fieldName === 'cargo' && !filters.nombre);
    }
    
    triggerRenderOrFetch();
    
    // Enfocar el input después de borrar para comodidad del usuario
    setTimeout(() => {
      const newInput = document.getElementById(inputId);
      if (newInput && !newInput.disabled) {
        newInput.focus();
      }
    }, 50);
    return;
  }

  // Mostrar sugerencias al hacer click en input autocompletable
  if (target.dataset.component === 'search-input' && target.dataset.autocomplete === 'true') {
    const fieldName = target.dataset.field;
    showDashboardSuggestions(fieldName);
  }
  
  // Limpiar filtros del módulo de Reportes
  const clearBtn = target.closest('#btn-reportes-clear');
  if (clearBtn) {
    clearReportesFilters();
  }
});

// 5. Eventos de Blur/Desenfoque (Ocultar sugerencias y aplicar filtros de fecha)
document.addEventListener('blur', (e) => {
  const target = e.target;
  if (target.dataset.component === 'search-input' && target.dataset.autocomplete === 'true') {
    const fieldName = target.dataset.field;
    hideDashboardSuggestions(fieldName);
  }
  // Para el input de texto visible del date-mask: aplicar el filtro al salir del campo
  if (target.dataset.dateDisplay === 'true') {
    const fieldName = target.dataset.field;
    // El estado ya fue actualizado en handleDateDisplayInput.
    // Solo disparamos el re-render aquí.
    if (currentView === 'dashboard') {
      renderView();
    } else if (currentView === 'reportes') {
      debouncedReportesRender();
    }
  }
}, true); // useCapture para eventos que no burbujean

// 6. Eventos de Mousedown (Selección de sugerencias antes de que ocurra el blur)
document.addEventListener('mousedown', (e) => {
  const suggestionItem = e.target.closest('[data-action="select-suggestion"]');
  if (suggestionItem) {
    const fieldName = suggestionItem.dataset.field;
    const value = suggestionItem.dataset.value;
    selectDashboardSuggestion(fieldName, value);
  }
});

// 7. Eventos de Change (Selectores y Checkboxes)
document.addEventListener('change', (e) => {
  const target = e.target;
  
  if (target.dataset.component === 'select-input') {
    const fieldName = target.dataset.field;
    handleMultiFilter(currentView, fieldName, target.value);
  } else if (target.dataset.component === 'date-input') {
    // Actualizamos el estado interno siempre.
    // Si la fecha ya está completa (YYYY-MM-DD = 10 chars) o fue vaciada,
    // re-renderizamos inmediatamente (ej: selección desde calendario nativo).
    // El blur también dispara el render como respaldo para escritura manual.
    const fieldName = target.dataset.field;
    const value = target.value;
    const isComplete = value === '' || value.length === 10;
    if (currentView === 'dashboard') {
      dashboardFilters[fieldName] = value;
      if (isComplete) renderView();
    } else if (currentView === 'reportes') {
      if (fieldName === 'fechaInicio') reportesFilters.fechaInicio = value;
      else if (fieldName === 'fechaTermino') reportesFilters.fechaTermino = value;
      if (isComplete) debouncedReportesRender();
    }
  } else if (target.classList.contains('report-estado-checkbox')) {
    const estado = target.getAttribute('data-estado');
    handleReportesEstadoToggle(estado, target.checked);
  }
});

// Función para exportar el reporte actual a un archivo PDF (Orientación Vertical - Portrait) usando impresión nativa del navegador
async function exportReportToPDF() {
  if (!dataStore.reportesRawData || dataStore.reportesRawData.length === 0) {
    showToast('No hay datos para exportar.', 'error');
    return;
  }

  showToast('Preparando vista de impresión...');

  // Snapshot inmutable de filtros para evitar que cambios concurrentes alteren el PDF
  const filtersSnapshot = {
    nombre: reportesFilters.nombre || '',
    cargo: reportesFilters.cargo || '',
    fechaInicio: reportesFilters.fechaInicio || '',
    fechaTermino: reportesFilters.fechaTermino || '',
    estados: [...(reportesFilters.estados || [])]
  };

  const originalTitle = document.title;

  // Helper local para abreviar cargos según mapeo del usuario
  const getCargoAbbreviated = (cargoText) => {
    if (!cargoText) return 'TODOS';
    const clean = cargoText.toLowerCase().trim();
    
    if (clean.includes('2770')) return 'CE';
    if (clean.includes('comisión evaluadora') || clean.includes('comision evaluadora')) return 'CE';
    if (clean.includes('compras públicas') || clean.includes('compras publicas')) return 'COMP';
    if (clean.includes('smapa')) return 'SMAPA';
    if (clean.includes('salud municipal') || clean.includes('disam')) return 'DISAM';
    if (clean.includes('inspección') || clean.includes('inspeccion')) return 'INS';
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
    if (clean.includes('alcalde') || clean.includes('alcaldesa') || clean.includes('gabinete alcaldía') || clean.includes('gabinete alcaldia') || clean.includes('comunicaciones alcaldía') || clean.includes('comunicaciones alcaldia') || clean.includes('asistente alcaldía') || clean.includes('asistente alcaldia')) return 'ALC';
    if (clean.includes('administrador municipal') || clean.includes('administradora municipal')) return 'ADM';

    return 'GEN'; // default generic
  };

  // Helper local para formatear el nombre (CamelCase, sin tildes ni espacios)
  const sanitizeNombreForFilename = (name) => {
    if (!name || name.toLowerCase() === 'todos') return 'Todos';
    const normalized = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return normalized
      .split(/\s+/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('');
  };

  try {
    const processedData = processReportData(dataStore.reportesRawData, filtersSnapshot);
    const totalItems = processedData.length;

    if (totalItems === 0) {
      showToast('No hay registros coincidentes para exportar.', 'error');
      return;
    }

    // Identificar si una solicitud está fuera de plazo usando los códigos estandarizados
    const isOverdueItem = (item) => {
      const mainCode = (item.plazo || '').split(' ')[0].toUpperCase();
      return mainCode === 'FDP' || mainCode === 'RFP';
    };

    // Identificar si una solicitud es FDP (Fuera de plazo)
    const isFdpItem = (item) => {
      const mainCode = (item.plazo || '').split(' ')[0].toUpperCase();
      return mainCode === 'FDP';
    };

    // Identificar si una solicitud es DDP (Dentro de plazo)
    const isDdpItem = (item) => {
      const mainCode = (item.plazo || '').split(' ')[0].toUpperCase();
      return mainCode === 'DDP';
    };

    // Calcular estadísticas
    const overdueCount = processedData.filter(isFdpItem).length;
    const compliantCount = processedData.filter(isDdpItem).length;

    const rowsArray = processedData.map(item => {
      let stateColor = '#475569';
      let stateBg = '#f1f5f9';
      const stateLower = (item.estado || '').toLowerCase();
      if (stateLower === 'aceptada') { stateColor = '#15803d'; stateBg = '#f0fdf4'; }
      else if (stateLower === 'pendiente de publicación') { stateColor = '#0369a1'; stateBg = '#e0f2fe'; }
      else if (stateLower === 'rechazada') { stateColor = '#b91c1c'; stateBg = '#fef2f2'; }
      else if (stateLower === 'cancelada' || stateLower === 'suspendida') { stateColor = '#b45309'; stateBg = '#fffbeb'; }

      const isOverdue = isOverdueItem(item);
      const plazoColor = isOverdue ? '#b91c1c' : '#15803d';
      const plazoBg   = isOverdue ? '#fef2f2' : '#f0fdf4';

      const hasDays = item.plazo.includes('(') && item.plazo.includes(')');
      let mainCode = item.plazo;
      let days = '';
      if (hasDays) {
        const parts = item.plazo.split(' ');
        mainCode = parts[0];
        days = parts[1].replace(/[()]/g, '');
      }

      const showTwoLine = hasDays && (mainCode === 'FDP' || mainCode === 'RFP');
      const plazoBadgeHtml = showTwoLine
        ? `<span style="display: inline-block; padding: 4px 5px 3px 5px; border-radius: 4px; font-size: 8px; font-weight: 800; color: ${plazoColor}; background: ${plazoBg}; text-align: center; min-width: 38px; line-height: 1.5; white-space: normal;">${mainCode}<br>${days}</span>`
        : `<span style="display: inline-block; padding: 3px 5px; border-radius: 4px; font-size: 8px; font-weight: 800; color: ${plazoColor}; background: ${plazoBg}; text-align: center; min-width: 38px; line-height: 1.4; text-transform: uppercase; white-space: nowrap;">${mainCode}</span>`;

      return `
        <tr style="border-bottom: 1px solid #e2e8f0; font-size: 7.5px;">
          <td style="padding: 6px 10px; font-weight: 600; color: #64748b; border-bottom: 1px solid #e2e8f0;">${item.index}</td>
          <td style="padding: 6px 10px; font-weight: 700; color: #0f172a; font-family: monospace; border-bottom: 1px solid #e2e8f0;">${item.folio}</td>
          <td style="padding: 6px 10px; color: #1e293b; font-weight: 500; border-bottom: 1px solid #e2e8f0;">${item.cargo}</td>
          <td style="padding: 6px 10px; color: #475569; border-bottom: 1px solid #e2e8f0;">${item.fechaIngreso}</td>
          <td style="padding: 6px 10px; color: #475569; border-bottom: 1px solid #e2e8f0;">${item.fechaAgendada}</td>
          <td style="padding: 6px 10px; border-bottom: 1px solid #e2e8f0;">
            ${item.estado === 'Pendiente de publicación'
              ? `<span style="display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 7px; font-weight: 700; color: ${stateColor}; background: ${stateBg}; text-align: center; line-height: 1.1;">PENDIENTE DE<br>PUBLICACIÓN</span>`
              : `<span style="display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 7px; font-weight: 700; color: ${stateColor}; background: ${stateBg}; text-transform: uppercase; white-space: nowrap;">${item.estado}</span>`
            }
          </td>
          <td style="padding: 6px 10px; border-bottom: 1px solid #e2e8f0; vertical-align: middle;">
            ${plazoBadgeHtml}
          </td>
        </tr>
      `;
    });

    const rfechas = `${filtersSnapshot.fechaInicio ? `Desde: ${filtersSnapshot.fechaInicio}` : ''} ${filtersSnapshot.fechaTermino ? `Hasta: ${filtersSnapshot.fechaTermino}` : ''}`;
    const rfechasStr = rfechas.trim() !== '' ? rfechas : 'Cualquier fecha';

    // Obtener o crear el contenedor de impresión
    let printContainer = document.getElementById('print-report-container');
    if (!printContainer) {
      printContainer = document.createElement('div');
      printContainer.id = 'print-report-container';
      document.body.appendChild(printContainer);
    }

    const generadoFechaHora = new Date().toLocaleString('es-CL', { timeZone: 'America/Santiago' });

    // Inject dynamic print page styling to use native CSS Page Margin Boxes (supported in Chrome 131+)
    // This allows page counters (Página X de Y) to increment correctly without position:fixed / overflow clip bugs
    const styleEl = document.createElement('style');
    styleEl.id = 'dynamic-print-style';
    styleEl.innerHTML = `
      @page {
        size: portrait;
        margin-top: 22mm;
        margin-bottom: 20mm;
        margin-left: 15mm;
        margin-right: 15mm;
        
        @top-left {
          content: "Reporte de Solicitudes de Audiencia (Ley N° 20.730 de Lobby) — Sujeto Pasivo: ${normalizeName(filtersSnapshot.nombre) || 'Todos'}";
          font-family: 'Inter', sans-serif;
          font-size: 8px;
          font-weight: 800;
          color: #0f172a;
          padding-bottom: 6px;
          border-bottom: 1.5px solid #4f46e5;
        }
        @top-right {
          content: "Generado el ${generadoFechaHora}";
          font-family: monospace;
          font-size: 7.5px;
          font-weight: 700;
          color: #64748b;
          padding-bottom: 6px;
          border-bottom: 1.5px solid #4f46e5;
        }
        @bottom-right {
          content: "Página " counter(page) " de " counter(pages);
          font-family: monospace;
          font-size: 8.5px;
          font-weight: 700;
          color: #64748b;
        }
      }
      @page :first {
        margin-top: 15mm;
        @top-left { content: none; }
        @top-right { content: none; }
      }
    `;
    document.head.appendChild(styleEl);

    // Single flow layout where the browser paginates natively
    printContainer.innerHTML = `
      <div class="print-report-flow">
        <div class="municipal-header-p1">
          <!-- Encabezado Municipal (Página 1) -->
          <table style="width: 100%; border-collapse: collapse; border-bottom: 2px solid #4f46e5; padding-bottom: 15px;">
            <tr>
              <td style="vertical-align: middle; text-align: left; border: none;">
                <table style="border-collapse: collapse; border: none;">
                  <tr>
                    <td style="padding-right: 15px; vertical-align: middle; border: none;">
                      <img src="/logo_secum.png" style="height: 60px; width: auto; display: block;" />
                    </td>
                    <td style="vertical-align: middle; border: none;">
                      <div style="font-size: 15px; font-weight: 800; color: #0f172a; letter-spacing: -0.02em; font-family: 'Inter', sans-serif;">Reporte de Solicitudes de Audiencia</div>
                      <div style="font-size: 10px; font-weight: 600; color: #4f46e5; margin-top: 2px; font-family: 'Inter', sans-serif;">Audiencias registradas bajo la Ley N° 20.730 de Lobby</div>
                    </td>
                  </tr>
                </table>
              </td>
              <td style="vertical-align: middle; text-align: right; border: none;">
                <div style="font-size: 10px; font-weight: 700; color: #1e293b; font-family: monospace;">${generadoFechaHora}</div>
              </td>
            </tr>
          </table>
        </div>

        <!-- Sujeto Pasivo en grande y filtros alineados dentro de la tarjeta de fondo -->
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px; margin-top: 15px; margin-bottom: 15px; box-sizing: border-box; width: 100%; font-family: 'Inter', sans-serif;">
          <div style="font-size: 14px; font-weight: 800; color: #1e3a8a; text-transform: uppercase; letter-spacing: -0.01em;">Sujeto Pasivo: ${normalizeName(filtersSnapshot.nombre) || 'Todos los Sujetos Pasivos'}</div>
          <div style="font-size: 11px; font-weight: 700; color: #475569; margin-top: 3px; text-transform: uppercase; letter-spacing: -0.01em;">Cargo: ${filtersSnapshot.cargo || 'Todos los Cargos'}</div>
          <table style="width: 100%; border-collapse: collapse; font-size: 9px; color: #475569; margin-top: 8px;">
            <tr>
              <td style="padding: 0; border: none; width: 50%;"><strong>Período:</strong> ${rfechasStr}</td>
              <td style="padding: 0; border: none; width: 50%;"><strong>Estados:</strong> ${filtersSnapshot.estados.length > 0 ? filtersSnapshot.estados.join(', ') : 'Todos'}</td>
            </tr>
          </table>
        </div>

        <!-- Métricas rápidas - KPIs -->
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 15px; font-family: 'Inter', sans-serif;">
          <tr>
            <td style="width: 33.3%; padding-right: 8px; border: none;">
              <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 12px; padding: 12px; text-align: center; box-sizing: border-box;">
                <div style="font-size: 8px; font-weight: 700; color: #1e40af; text-transform: uppercase; letter-spacing: 0.05em;">Total de Audiencias</div>
                <div style="font-size: 20px; font-weight: 800; color: #1d4ed8; margin-top: 4px;">${totalItems}</div>
              </div>
            </td>
            <td style="width: 33.3%; padding-left: 4px; padding-right: 4px; border: none;">
              <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 12px; text-align: center; box-sizing: border-box;">
                <div style="font-size: 8px; font-weight: 700; color: #166534; text-transform: uppercase; letter-spacing: 0.05em;">Dentro de Plazo</div>
                <div style="font-size: 20px; font-weight: 800; color: #15803d; margin-top: 4px;">${compliantCount}</div>
              </div>
            </td>
            <td style="width: 33.3%; padding-left: 8px; border: none;">
              <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 12px; padding: 12px; text-align: center; box-sizing: border-box;">
                <div style="font-size: 8px; font-weight: 700; color: #991b1b; text-transform: uppercase; letter-spacing: 0.05em;">Fuera de Plazo</div>
                <div style="font-size: 20px; font-weight: 800; color: #b91c1c; margin-top: 4px;">${overdueCount}</div>
              </div>
            </td>
          </tr>
        </table>

        <!-- Tabla Única Vectorial -->
        <div style="border: 1px solid #cbd5e1; border-radius: 12px; overflow: hidden; background: white; width: 100%;">
          <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 8px; font-family: 'Inter', sans-serif;">
            <thead>
              <tr style="background: #f1f5f9; border-bottom: 1px solid #cbd5e1; color: #475569; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; font-size: 8px;">
                <th style="padding: 8px 10px; width: 30px; border-bottom: 1px solid #cbd5e1;">#</th>
                <th style="padding: 8px 10px; width: 95px; border-bottom: 1px solid #cbd5e1;">Folio</th>
                <th style="padding: 8px 10px; border-bottom: 1px solid #cbd5e1;">Cargo</th>
                <th style="padding: 8px 10px; width: 65px; border-bottom: 1px solid #cbd5e1;">F. Ingreso</th>
                <th style="padding: 8px 10px; width: 65px; border-bottom: 1px solid #cbd5e1;">F. Agenda</th>
                <th style="padding: 8px 10px; width: 110px; border-bottom: 1px solid #cbd5e1;">Estado</th>
                <th style="padding: 8px 10px; width: 75px; border-bottom: 1px solid #cbd5e1;">Plazo / Retraso</th>
              </tr>
            </thead>
            <tbody>
              ${rowsArray.join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    // Generar nombre de archivo dinámico sugerido para el PDF
    const cargoAbbr = getCargoAbbreviated(filtersSnapshot.cargo || 'TODOS');
    const sanitizedNombre = sanitizeNombreForFilename(filtersSnapshot.nombre || 'Todos');
    
    let codigoReporte = '';
    try {
      const res = await fetch('/api/reportes/registrar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sujeto_pasivo: filtersSnapshot.nombre || 'Todos',
          cargo: filtersSnapshot.cargo || 'Todos',
          filtros: filtersSnapshot
        })
      });
      if (res.ok) {
        const data = await res.json();
        codigoReporte = data.codigo_reporte;
      }
    } catch (e) {
      console.error('No se pudo registrar el reporte en base de datos, usando fallback:', e);
    }

    if (!codigoReporte) {
      // Fallback local por fecha si el servidor no responde
      const now = new Date();
      const yy = String(now.getFullYear()).slice(-2);
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const dd = String(now.getDate()).padStart(2, '0');
      const fallbackNum = String(Math.floor(Math.random() * 900) + 100);
      codigoReporte = `RAP${yy}${mm}${dd}-${fallbackNum}`;
    }

    document.title = `${codigoReporte}_${cargoAbbr}_${sanitizedNombre}`;

    // Disparar la impresión nativa
    setTimeout(() => {
      window.print();
      // Opcional: limpiar después de que se cierre el diálogo de impresión
      printContainer.innerHTML = '';
      styleEl.remove();
      document.title = originalTitle;
    }, 250);

  } catch (err) {
    console.error(err);
    showToast('Error al generar la vista de impresión.', 'error');
  }
}

// Gatillar la importación del Excel desde el frontend
function triggerImport() {
  const btn = document.getElementById('btn-import-sync');
  const btnRegistrar = document.getElementById('btn-registrar-usuario');
  const progressContainer = document.getElementById('import-progress-container');
  const progressStatus = document.getElementById('import-progress-status');

  if (!btn) return;
  if (!selectedExcelFileBase64) {
    showToast('Por favor, seleccione primero un archivo Excel.', 'error');
    return;
  }

  // CAPA DE SEGURIDAD: Confirmar mediante modal premium
  openConfirmModal(
    'Confirmar Sincronización',
    '¿Está seguro de que desea iniciar la sincronización incremental de la base de datos local? Este proceso actualizará los registros de solicitudes, audiencias y sujetos obligados.',
    async () => {
      // 1. Bloquear interfaz
      btn.disabled = true;
      btn.classList.add('glass-input-disabled', 'cursor-not-allowed', 'opacity-60');
      btn.innerHTML = `<span class="w-4 h-4 border-2 border-slate-300 border-t-transparent rounded-full animate-spin"></span> <span>Procesando...</span>`;

      if (btnRegistrar) {
        btnRegistrar.disabled = true;
        btnRegistrar.classList.add('glass-input-disabled', 'cursor-not-allowed', 'opacity-60');
      }

      if (progressContainer) {
        progressContainer.classList.remove('hidden');
      }
      if (progressStatus) {
        progressStatus.textContent = 'Procesando archivo masivo en segundo plano...';
      }

      try {
        const res = await fetch('/api/admin/importar', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ fileData: selectedExcelFileBase64 })
        });

        if (res.ok) {
          const data = await res.json();
          if (data.success && data.stats) {
            const stats = data.stats;
            
            // Sumar todos los cambios para armar un lindo Toast resumido
            const totalInserts = (stats.sh?.inserts || 0) + (stats.ph?.inserts || 0) + (stats.sph?.inserts || 0);
            const totalUpdates = (stats.sh?.updates || 0) + (stats.ph?.updates || 0) + (stats.sph?.updates || 0);
            const totalDeletes = (stats.sh?.deletes || 0) + (stats.ph?.deletes || 0) + (stats.sph?.deletes || 0);

            const msg = `Importación local exitosa: ${totalInserts} nuevos, ${totalUpdates} actualizados, ${totalDeletes} eliminados.`;
            if (stats.sharepoint) {
              if (stats.sharepoint.uploaded) {
                showToast(msg + ' ✓ Subido con éxito a SharePoint.', 'success');
              } else {
                const isOmit = stats.sharepoint.error && stats.sharepoint.error.startsWith('Omitido');
                if (isOmit) {
                  showToast(msg + ' ⚠️ No se subió a SharePoint (requiere sesión SSO activa).', 'warning');
                } else if (!stats.sharepoint.error) {
                  showToast(msg + ' ✓ La base de datos ya está al día.', 'success');
                } else {
                  showToast(`${msg} ❌ Error al subir a SharePoint: ${stats.sharepoint.error}`, 'error');
                }
              }
            } else {
              showToast(msg, 'success');
            }
            fetchAlertas();
            // Invalidar caché de datos para que las sugerencias de búsqueda
            // reflejen los nombres actualizados en la próxima navegación.
            dataStore.dashboardRawData = [];
            dataStore.solicitudes = [];
            dataStore.publicadas = [];
            dashboardDropdownCache.nombres = [];
            dashboardDropdownCache.cargos = [];
            dashboardDropdownCache.sujetosActivosRepresentados = [];
            if (currentView === 'administracion') {
              switchView('administracion');
            }
          } else {
            showToast('La importación finalizó pero no devolvió el formato esperado.', 'error');
          }
        } else {
          const err = await res.json();
          showToast(err.error || 'Error al procesar la importación en el servidor.', 'error');
        }
      } catch (err) {
        console.error('Error gatillando importación:', err);
        showToast('Error de red al conectar con el servidor para la importación.', 'error');
      } finally {
        // Limpiar el selector de archivos
        selectedExcelFileBase64 = null;
        const fileInput = document.getElementById('import-excel-file');
        if (fileInput) fileInput.value = '';
        
        const label = document.getElementById('excel-file-label');
        const details = document.getElementById('excel-file-details');
        if (label) label.textContent = 'Haz clic para buscar o arrastra aquí tu archivo Excel';
        if (details) details.textContent = 'Solo formato .xlsx (Ley de Lobby)';

        // 2. Desbloquear y restaurar interfaz en estado inactivo
        if (btn) {
          btn.disabled = true;
          btn.className = 'flex-1 py-3 bg-slate-800 text-slate-500 rounded-xl text-xs font-bold transition-all cursor-not-allowed flex items-center justify-center gap-2';
          btn.innerHTML = `<i data-lucide="file-up" class="h-4 w-4"></i> <span>Procesar e Importar Excel</span>`;
        }

        if (btnRegistrar) {
          btnRegistrar.disabled = false;
          btnRegistrar.classList.remove('glass-input-disabled', 'cursor-not-allowed', 'opacity-60');
        }

        if (progressContainer) {
          progressContainer.classList.add('hidden');
        }

        // Actualizar iconos de Lucide e indicador en el header
        lucide.createIcons();
        fetchAndUpdateDbTimestamp();
      }
    }
  );
}

// Sincronizar desde SharePoint de forma manual (obtener última base de la nube)
async function triggerSharepointSync() {
  const btn = document.getElementById('btn-sharepoint-sync');
  const syncBtn = document.getElementById('btn-import-sync');
  const btnRegistrar = document.getElementById('btn-registrar-usuario');

  if (!btn) return;

  // Bloquear los controles mientras se descarga la base
  btn.disabled = true;
  btn.classList.add('opacity-60', 'cursor-not-allowed');
  btn.innerHTML = `<i data-lucide="refresh-cw" class="h-4 w-4 animate-spin"></i> <span>Sincronizando...</span>`;
  
  if (syncBtn) syncBtn.disabled = true;
  if (btnRegistrar) btnRegistrar.disabled = true;
  
  lucide.createIcons();

  try {
    const res = await fetch('/api/admin/sincronizar-desde-sharepoint', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const data = await res.json();
    if (res.ok && data.success) {
      showToast(data.message, 'success');
      // Si hubo una descarga de base de datos nueva, refrescamos la vista actual
      if (data.updated) {
        await switchView(currentView);
      }
    } else {
      showToast(data.error || 'Error al sincronizar con SharePoint.', 'error');
    }
  } catch (err) {
    console.error('Error en sincronización manual:', err);
    showToast('Error de red al conectar con el servidor para la sincronización.', 'error');
  } finally {
    // Restaurar los botones
    btn.disabled = false;
    btn.classList.remove('opacity-60', 'cursor-not-allowed');
    btn.innerHTML = `<i data-lucide="refresh-cw" class="h-4 w-4"></i> <span>Sincronizar desde SharePoint</span>`;
    
    if (btnRegistrar) btnRegistrar.disabled = false;
    
    // Restaurar estado de botón de importación dependiendo de si hay archivo seleccionado
    if (syncBtn) {
      if (selectedExcelFileBase64) {
        syncBtn.disabled = false;
      } else {
        syncBtn.disabled = true;
      }
    }

    lucide.createIcons();
    fetchAndUpdateDbTimestamp();
  }
}

// Manejar selección del archivo Excel y conversión a Base64
function handleExcelFileSelected(event) {
  const input = event.target;
  const file = input.files ? input.files[0] : null;
  const label = document.getElementById('excel-file-label');
  const details = document.getElementById('excel-file-details');
  const btn = document.getElementById('btn-import-sync');

  if (!file) {
    selectedExcelFileBase64 = null;
    if (label) label.textContent = 'Haz clic para buscar o arrastra aquí tu archivo Excel';
    if (details) details.textContent = 'Solo formato .xlsx (Ley de Lobby)';
    if (btn) {
      btn.disabled = true;
      btn.className = 'flex-1 py-3 bg-slate-800 text-slate-500 rounded-xl text-xs font-bold transition-all cursor-not-allowed flex items-center justify-center gap-2';
      btn.innerHTML = `<i data-lucide="file-up" class="h-4 w-4"></i> <span>Procesar e Importar Excel</span>`;
      lucide.createIcons();
    }
    return;
  }

  // Validar extensión
  if (!file.name.endsWith('.xlsx')) {
    showToast('El archivo seleccionado debe tener la extensión .xlsx', 'error');
    input.value = '';
    handleExcelFileSelected({ target: input });
    return;
  }

  if (label) {
    label.textContent = `Archivo seleccionado: ${file.name}`;
  }
  if (details) {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
    details.textContent = `Tamaño: ${sizeMB} MB - Listo para sincronizar`;
  }

  const reader = new FileReader();
  reader.onload = function(e) {
    const dataUrl = e.target.result;
    const base64Index = dataUrl.indexOf(';base64,');
    if (base64Index !== -1) {
      selectedExcelFileBase64 = dataUrl.substring(base64Index + 8);
    } else {
      selectedExcelFileBase64 = dataUrl;
    }
    
    // Activar botón de sincronización
    if (btn) {
      btn.disabled = false;
      btn.className = 'flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all hover:shadow-lg hover:shadow-emerald-500/20 active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer';
    }
  };
  
  reader.onerror = function(err) {
    console.error('Error leyendo archivo:', err);
    showToast('Error al leer el archivo seleccionado.', 'error');
  };
  
  reader.readAsDataURL(file);
}
// ============================================================================
// FUNCIONES DE CONTROL DE AUDITORÍA SEMANAL
// ============================================================================
async function openAuditoriaModal(id = null) {
  const modal = document.getElementById('modal-container');
  if (!modal) return;
  modal.classList.remove('hidden');

  const isEdit = id !== null;
  let rec = { fecha: '', total: '', ingresada: '', aceptada: '', rechazada: '', suspendida: '', cancelada: '', encomendada: '', publicada: '', estado: 'En Proceso' };
  if (isEdit) {
    rec = dataStore.auditoria.find(a => a.id === id) || rec;
  } else {
    const now = new Date();
    const offset = now.getTimezoneOffset();
    const localNow = new Date(now.getTime() - (offset * 60 * 1000));
    rec.fecha = localNow.toISOString().slice(0, 16).replace('T', ' ');
  }

  const isEnProceso = !isEdit || rec.estado === 'En Proceso';
  window.activeAuditIsEnProceso = isEnProceso;

  modal.innerHTML = `
    <div class="glass-card w-full max-w-lg p-6 rounded-2xl space-y-6 shadow-2xl relative">
      <div>
        <h3 class="text-lg font-bold text-heading">${isEdit ? 'Editar Registro de Auditoría' : 'Nuevo Registro de Auditoría'}</h3>
        <p class="text-xs text-body-muted">Fecha y Hora de Auditoría: <span class="font-mono text-brand-400 font-bold">${rec.fecha}</span></p>
        <p class="text-[11px] text-body-muted mt-1.5">Ingresa los valores validados manualmente para el control semanal. El total de solicitudes ingresado debe coincidir exactamente con la suma de los estados (Ingresada a Encomendada).</p>
      </div>

      <form id="auditoria-form" onsubmit="saveAuditoria(event, ${id})" class="space-y-4">
        <input type="hidden" id="aud-fecha" value="${rec.fecha}">

        <div class="grid grid-cols-2 gap-4">
          ${[
            { key: 'total', label: 'Total Solicitudes', isTotal: true },
            { key: 'ingresada', label: 'Ingresada' },
            { key: 'aceptada', label: 'Aceptada' },
            { key: 'rechazada', label: 'Rechazada' },
            { key: 'suspendida', label: 'Suspendida' },
            { key: 'cancelada', label: 'Cancelada' },
            { key: 'encomendada', label: 'Encomendada' },
            { key: 'publicada', label: 'Publicada' }
          ].map(f => {
            const isTotal = f.key === 'total';
            const val = rec[f.key] !== undefined && rec[f.key] !== null ? rec[f.key] : '';
            return `
              <div class="space-y-1">
                <div class="flex justify-between items-center">
                  <label class="text-[10px] font-bold text-body-muted uppercase">${f.label}</label>
                  <span id="sys-val-${f.key}" class="text-[9px] text-slate-400 font-semibold ${isEnProceso ? '' : 'hidden'}">Cargando...</span>
                </div>
                <input type="number" id="aud-${f.key}" value="${val !== '' ? val : ''}" required min="0" oninput="validateAuditForm(); compareFieldDiscrepancy('${f.key}')" class="w-full px-3 py-2 rounded-xl text-xs glass-input text-slate-200 placeholder-slate-400 ${isTotal ? 'font-bold border-brand-500/30' : ''}">
                <div id="discrepancy-info-${f.key}" class="text-[9px] font-bold hidden mt-0.5"></div>
              </div>
            `;
          }).join('')}
        </div>

        <div id="validation-warning" class="hidden p-3 rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-400 text-xs font-semibold flex items-center gap-2">
          <i data-lucide="alert-triangle" class="h-4 w-4 shrink-0"></i>
          <span>La suma de los estados (Ingresada a Encomendada) no coincide con el Total de solicitudes ingresado.</span>
        </div>

        <div class="flex justify-end gap-3 pt-2">
          <button type="button" onclick="closeModal()" class="px-4 py-2 rounded-xl text-xs font-semibold btn-secondary">Cancelar</button>
          <button type="submit" class="px-4 py-2 rounded-xl text-xs font-semibold btn-primary">${isEdit ? 'Actualizar Registro' : 'Registrar Auditoría'}</button>
        </div>
      </form>
    </div>
  `;
  lucide.createIcons();
  validateAuditForm();

  if (isEnProceso) {
    // Cargar valores reales actuales del sistema
    try {
      const res = await fetch('/api/admin/auditoria/valores-actuales');
      if (res.ok) {
        const sysVals = await res.json();
        window.currentSystemValues = sysVals;
        Object.keys(sysVals).forEach(key => {
          const labelEl = document.getElementById(`sys-val-${key}`);
          if (labelEl) {
            labelEl.textContent = `Sistema: ${sysVals[key].toLocaleString('es-CL')}`;
          }
          compareFieldDiscrepancy(key);
        });

        // Calcular y mostrar total sistema
        const liveTotal = (sysVals.ingresada || 0) +
                          (sysVals.aceptada || 0) +
                          (sysVals.rechazada || 0) +
                          (sysVals.suspendida || 0) +
                          (sysVals.cancelada || 0) +
                          (sysVals.encomendada || 0);
        const totalLabelEl = document.getElementById(`sys-val-total`);
        if (totalLabelEl) {
          totalLabelEl.textContent = `Sistema: ${liveTotal.toLocaleString('es-CL')}`;
        }
        compareFieldDiscrepancy('total');
      }
    } catch(e) {
      console.error('Error fetching system values:', e);
    }
  }
}

function validateAuditForm() {
  const totalInput = document.getElementById('aud-total');
  const ingresadaEl = document.getElementById('aud-ingresada');
  const aceptadaEl = document.getElementById('aud-aceptada');
  const rechazadaEl = document.getElementById('aud-rechazada');
  const suspendidaEl = document.getElementById('aud-suspendida');
  const canceladaEl = document.getElementById('aud-cancelada');
  const encomendadaEl = document.getElementById('aud-encomendada');

  if (!totalInput || !ingresadaEl || !aceptadaEl || !rechazadaEl || !suspendidaEl || !canceladaEl || !encomendadaEl) return;

  const total = parseInt(totalInput.value, 10);
  const ingresada = parseInt(ingresadaEl.value || 0, 10);
  const aceptada = parseInt(aceptadaEl.value || 0, 10);
  const rechazada = parseInt(rechazadaEl.value || 0, 10);
  const suspendida = parseInt(suspendidaEl.value || 0, 10);
  const cancelada = parseInt(canceladaEl.value || 0, 10);
  const encomendada = parseInt(encomendadaEl.value || 0, 10);

  const sumStates = ingresada + aceptada + rechazada + suspendida + cancelada + encomendada;

  const warningEl = document.getElementById('validation-warning');
  const submitBtn = document.querySelector('#auditoria-form button[type="submit"]');

  if (isNaN(total) || total !== sumStates) {
    if (warningEl) warningEl.classList.remove('hidden');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.classList.add('opacity-50', 'cursor-not-allowed');
    }
  } else {
    if (warningEl) warningEl.classList.add('hidden');
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.classList.remove('opacity-50', 'cursor-not-allowed');
    }
  }
}

function compareFieldDiscrepancy(key) {
  if (!window.activeAuditIsEnProceso) return;
  const inputEl = document.getElementById(`aud-${key}`);
  const infoEl = document.getElementById(`discrepancy-info-${key}`);
  if (!inputEl || !infoEl || !window.currentSystemValues) return;

  const enteredVal = parseInt(inputEl.value, 10);
  
  let sysVal = 0;
  if (key === 'total') {
    sysVal = (window.currentSystemValues.ingresada || 0) +
             (window.currentSystemValues.aceptada || 0) +
             (window.currentSystemValues.rechazada || 0) +
             (window.currentSystemValues.suspendida || 0) +
             (window.currentSystemValues.cancelada || 0) +
             (window.currentSystemValues.encomendada || 0);
  } else {
    sysVal = window.currentSystemValues[key] || 0;
  }

  if (isNaN(enteredVal)) {
    infoEl.classList.add('hidden');
    inputEl.classList.remove('border-rose-500', 'bg-rose-950/10', 'border-emerald-500', 'bg-emerald-950/10');
    return;
  }

  const diff = enteredVal - sysVal;
  if (diff === 0) {
    infoEl.textContent = 'Coincide con el sistema';
    infoEl.className = 'text-[9px] font-bold text-emerald-400 mt-0.5';
    infoEl.classList.remove('hidden');
    inputEl.classList.remove('border-rose-500', 'bg-rose-950/10');
    inputEl.classList.add('border-emerald-500', 'bg-emerald-950/10');
  } else {
    const sign = diff > 0 ? '+' : '';
    infoEl.textContent = `Discrepancia: ${sign}${diff}`;
    infoEl.className = 'text-[9px] font-bold text-rose-400 mt-0.5';
    infoEl.classList.remove('hidden');
    inputEl.classList.remove('border-emerald-500', 'bg-emerald-950/10');
    inputEl.classList.add('border-rose-500', 'bg-rose-950/10');
  }
}

async function saveAuditoria(event, id) {
  event.preventDefault();
  const fecha = document.getElementById('aud-fecha').value;
  const total = parseInt(document.getElementById('aud-total').value, 10);
  const ingresada = parseInt(document.getElementById('aud-ingresada').value, 10);
  const aceptada = parseInt(document.getElementById('aud-aceptada').value, 10);
  const rechazada = parseInt(document.getElementById('aud-rechazada').value, 10);
  const suspendida = parseInt(document.getElementById('aud-suspendida').value, 10);
  const cancelada = parseInt(document.getElementById('aud-cancelada').value, 10);
  const encomendada = parseInt(document.getElementById('aud-encomendada').value, 10);
  const publicada = parseInt(document.getElementById('aud-publicada').value, 10);

  const isEdit = id !== null;
  const url = isEdit ? `/api/admin/auditoria/${id}` : '/api/admin/auditoria';
  const method = isEdit ? 'PUT' : 'POST';

  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fecha, total, ingresada, aceptada, rechazada, suspendida, cancelada, encomendada, publicada })
    });

    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.error || 'Error al guardar la auditoría.');
    }

    showToast(isEdit ? 'Registro de auditoría actualizado.' : 'Registro de auditoría guardado.');
    closeModal();
    await switchView('administracion');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function deleteAuditoria(id) {
  openConfirmModal(
    'Eliminar Auditoría',
    '¿Está seguro de que desea eliminar este registro de auditoría?',
    async () => {
      try {
        const res = await fetch(`/api/admin/auditoria/${id}`, { method: 'DELETE' });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Error al eliminar.');
        }
        showToast('Registro de auditoría eliminado.');
        await switchView('administracion');
      } catch (err) {
        showToast(err.message, 'error');
      }
    }
  );
}
function closeAuditoriaRecord(id) {
  openConfirmModal(
    'Validar y Cerrar Control',
    '¿Está seguro de que desea cerrar este control de auditoría? Una vez cerrado, las cifras quedarán congeladas y no se mostrarán más alertas de discrepancia.',
    async () => {
      try {
        const record = dataStore.auditoria.find(a => a.id === id);
        const res = await fetch(`/api/admin/auditoria/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fecha: record.fecha,
            total: record.total,
            ingresada: record.ingresada,
            aceptada: record.aceptada,
            rechazada: record.rechazada,
            suspendida: record.suspendida,
            cancelada: record.cancelada,
            encomendada: record.encomendada,
            publicada: record.publicada,
            estado: 'Cerrado'
          })
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Error al cerrar el registro.');
        }
        showToast('Control de auditoría cerrado y validado.');
        await switchView('administracion');
      } catch (err) {
        showToast(err.message, 'error');
      }
    }
  );
}

// Inicialización de Gráficos Comparativos con Chart.js
function initDashboardCharts() {
  const canvasDist = document.getElementById('chart-distribucion-estados');
  const canvasEvol = document.getElementById('chart-evolucion-mensual');
  const canvasCumpl = document.getElementById('chart-cumplimiento-plazos');
  const canvasTop = document.getElementById('chart-top-autoridades');

  if (!canvasDist || !canvasEvol || !canvasCumpl || !canvasTop) return;

  // Destruir instancias previas para evitar superposiciones
  if (chartDistribucionInstance) { chartDistribucionInstance.destroy(); chartDistribucionInstance = null; }
  if (chartEvolucionInstance) { chartEvolucionInstance.destroy(); chartEvolucionInstance = null; }
  if (chartCumplimientoInstance) { chartCumplimientoInstance.destroy(); chartCumplimientoInstance = null; }
  if (chartTopAutoridadesInstance) { chartTopAutoridadesInstance.destroy(); chartTopAutoridadesInstance = null; }

  if (typeof Chart === 'undefined') {
    console.warn('Chart.js no está cargado.');
    return;
  }

  // Detectar tema actual
  const isDark = document.documentElement.classList.contains('dark');
  const textColor = isDark ? '#cbd5e1' : '#334155'; // slate-300 vs slate-700
  const gridColor = isDark ? '#1e293b' : '#e2e8f0'; // slate-800 vs slate-200
  const tooltipBg = isDark ? '#0f172a' : '#ffffff';
  const tooltipBorder = isDark ? '#334155' : '#cbd5e1';
  const tooltipText = isDark ? '#f8fafc' : '#0f172a';

  // Obtener datos y calcular estadísticas
  const rawData = dataStore.dashboardRawData || [];
  const filters = dashboardFilters || {};
  const stats = calculateDashboardStats(rawData, filters);

  // 1. Re-filtrar datos locales para cálculos temporales
  let filtered = rawData;
  if (filters.anio && filters.anio !== 'TODOS') {
    filtered = filtered.filter(item => item.fecha_ingreso && item.fecha_ingreso.startsWith(filters.anio));
  }
  if (filters.fechaInicio) {
    filtered = filtered.filter(item => item.fecha_ingreso && item.fecha_ingreso.split(' ')[0] >= filters.fechaInicio);
  }
  if (filters.fechaTermino) {
    filtered = filtered.filter(item => item.fecha_ingreso && item.fecha_ingreso.split(' ')[0] <= filters.fechaTermino);
  }
  if (filters.nombre && filters.nombre.trim() !== '') {
    const val = filters.nombre.toLowerCase();
    filtered = filtered.filter(item => item.sujeto_pasivo && item.sujeto_pasivo.toLowerCase().includes(val));
  }
  if (filters.cargo && filters.cargo.trim() !== '') {
    const val = filters.cargo.toLowerCase();
    filtered = filtered.filter(item => item.cargo && getCargoClean(item.cargo).toLowerCase().includes(val));
  }

  // Opciones de fuentes estándar
  const fontConfig = {
    family: 'Inter, sans-serif',
    size: 10
  };

  // ----------------------------------------------------
  // GRÁFICO A: DISTRIBUCIÓN POR ESTADO (Doughnut)
  // ----------------------------------------------------
  const distData = [
    stats.estados.aceptada.count,
    stats.estados.rechazada.count,
    stats.estados.suspendida.count,
    stats.estados.cancelada.count,
    stats.estados.encomendada.count
  ];

  const colorsDoughnut = isDark ? [
    '#818cf8', // Aceptada (indigo-400)
    '#f472b6', // Rechazada (pink-400)
    '#a78bfa', // Suspendida (purple-400)
    '#cbd5e1', // Cancelada (slate-300)
    '#fb923c'  // Encomendada (orange-400)
  ] : [
    '#4f46e5', // Aceptada (indigo-600)
    '#db2777', // Rechazada (pink-600)
    '#7c3aed', // Suspendida (purple-600)
    '#475569', // Cancelada (slate-600)
    '#ea580c'  // Encomendada (orange-600)
  ];

  chartDistribucionInstance = new Chart(canvasDist, {
    type: 'doughnut',
    data: {
      labels: ['Aceptadas', 'Rechazadas', 'Suspendidas', 'Canceladas', 'Encomendadas'],
      datasets: [{
        data: distData,
        backgroundColor: colorsDoughnut,
        borderColor: isDark ? '#0f172a' : '#ffffff',
        borderWidth: 2,
        hoverOffset: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: {
            color: textColor,
            font: fontConfig,
            padding: 12,
            boxWidth: 8,
            boxHeight: 8,
            usePointStyle: true
          }
        },
        tooltip: {
          backgroundColor: tooltipBg,
          borderColor: tooltipBorder,
          borderWidth: 1,
          titleColor: tooltipText,
          bodyColor: tooltipText,
          titleFont: { family: 'Inter', weight: 'bold', size: 11 },
          bodyFont: { family: 'Inter', size: 11 },
          callbacks: {
            label: function(context) {
              const label = context.label || '';
              const value = context.parsed || 0;
              const total = filtered.length; // Usar el universo total filtrado para coincidir con las cards
              const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
              return ` ${label}: ${value.toLocaleString('es-CL')} (${percentage}%)`;
            }
          }
        }
      },
      cutout: '65%'
    }
  });

  // ----------------------------------------------------
  // GRÁFICO B: EVOLUCIÓN MENSUAL INTERANUAL (Line)
  // ----------------------------------------------------
  // Determinar años comparativos
  const selectedYearStr = (filters.anio && filters.anio !== 'TODOS') ? filters.anio : new Date().getFullYear().toString();
  const selectedYear = parseInt(selectedYearStr, 10);
  const previousYear = selectedYear - 1;

  // Filtrar datos para evolución aplicando filtros de Nombre y Cargo pero saltándose año
  let dataForEvol = rawData;
  if (filters.nombre && filters.nombre.trim() !== '') {
    const val = filters.nombre.toLowerCase();
    dataForEvol = dataForEvol.filter(item => item.sujeto_pasivo && item.sujeto_pasivo.toLowerCase().includes(val));
  }
  if (filters.cargo && filters.cargo.trim() !== '') {
    const val = filters.cargo.toLowerCase();
    dataForEvol = dataForEvol.filter(item => item.cargo && getCargoClean(item.cargo).toLowerCase().includes(val));
  }

  const today = new Date();
  const currentMonthIdx = today.getMonth(); // 0-11
  const isCurrentYearSelected = selectedYear === today.getFullYear();

  const currentYearMonthly = Array(12).fill(null);
  for (let m = 0; m < 12; m++) {
    if (!isCurrentYearSelected || m <= currentMonthIdx) {
      currentYearMonthly[m] = 0;
    }
  }

  const previousYearMonthly = Array(12).fill(0);

  dataForEvol.forEach(item => {
    if (item.fecha_ingreso) {
      const parts = item.fecha_ingreso.split(' ')[0].split('-');
      if (parts.length === 3) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        if (month >= 0 && month < 12) {
          if (year === selectedYear) {
            if (currentYearMonthly[month] !== null) {
              currentYearMonthly[month]++;
            }
          } else if (year === previousYear) {
            previousYearMonthly[month]++;
          }
        }
      }
    }
  });

  chartEvolucionInstance = new Chart(canvasEvol, {
    type: 'line',
    data: {
      labels: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'],
      datasets: [
        {
          label: `${selectedYear} (Año Actual)`,
          data: currentYearMonthly,
          borderColor: '#6366f1',
          backgroundColor: 'rgba(99, 102, 241, 0.1)',
          fill: true,
          tension: 0.35,
          borderWidth: 2.5,
          pointRadius: 3,
          pointHoverRadius: 5
        },
        {
          label: `${previousYear} (Año Anterior)`,
          data: previousYearMonthly,
          borderColor: isDark ? '#64748b' : '#94a3b8',
          backgroundColor: 'transparent',
          borderDash: [5, 5],
          tension: 0.35,
          borderWidth: 1.5,
          pointRadius: 2,
          pointHoverRadius: 4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
          labels: { color: textColor, font: fontConfig, boxWidth: 12, usePointStyle: true }
        },
        tooltip: {
          backgroundColor: tooltipBg,
          borderColor: tooltipBorder,
          borderWidth: 1,
          titleColor: tooltipText,
          bodyColor: tooltipText,
          titleFont: { family: 'Inter', weight: 'bold' },
          bodyFont: { family: 'Inter' }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: textColor, font: fontConfig }
        },
        y: {
          grid: { color: gridColor },
          ticks: { color: textColor, font: fontConfig }
        }
      }
    }
  });

  // ----------------------------------------------------
  // GRÁFICO C: CUMPLIMIENTO DE PLAZOS MENSUAL (Stacked Bar)
  // ----------------------------------------------------
  const inPlazoMonthly = Array(12).fill(0);
  const fueraPlazoMonthly = Array(12).fill(0);


  filtered.forEach(item => {
    if (!item.fecha_ingreso) return;
    const parts = item.fecha_ingreso.split(' ')[0].split('-');
    if (parts.length !== 3) return;
    const month = parseInt(parts[1], 10) - 1;
    if (month < 0 || month >= 12) return;

    const estadoClean = (item.estado || 'Ingresada').trim().toLowerCase();
    if (estadoClean === 'ingresada') {
      const diffDays = item.dias_restantes_sh !== undefined ? item.dias_restantes_sh : 0;
      if (diffDays < 0) {
        fueraPlazoMonthly[month]++;
      } else {
        inPlazoMonthly[month]++;
      }
    } else {
      if (item.estado_cumplimiento_sh === 'FUERA_PLAZO') {
        fueraPlazoMonthly[month]++;
      } else {
        inPlazoMonthly[month]++;
      }
    }
  });

  chartCumplimientoInstance = new Chart(canvasCumpl, {
    type: 'bar',
    data: {
      labels: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'],
      datasets: [
        {
          label: 'Dentro de Plazo (RDP/DDP)',
          data: inPlazoMonthly,
          backgroundColor: isDark ? '#818cf8' : '#4f46e5', // Índigo elegante (Dentro de plazo)
          borderRadius: 4
        },
        {
          label: 'Fuera de Plazo (RFP/FDP)',
          data: fueraPlazoMonthly,
          backgroundColor: isDark ? '#fecdd3' : '#fda4af', // Rosa pastel suave (Fuera de plazo)
          borderRadius: 4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
          labels: { color: textColor, font: fontConfig, boxWidth: 12, usePointStyle: true }
        },
        tooltip: {
          backgroundColor: tooltipBg,
          borderColor: tooltipBorder,
          borderWidth: 1,
          titleColor: tooltipText,
          bodyColor: tooltipText,
          titleFont: { family: 'Inter', weight: 'bold' },
          bodyFont: { family: 'Inter' }
        }
      },
      scales: {
        x: {
          stacked: true,
          grid: { display: false },
          ticks: { color: textColor, font: fontConfig }
        },
        y: {
          stacked: true,
          grid: { color: gridColor },
          ticks: { color: textColor, font: fontConfig }
        }
      }
    }
  });

  // ----------------------------------------------------
  // GRÁFICO D: TOP 5 AUTORIDADES (Horizontal Bar)
  // ----------------------------------------------------
  const onlyActive = document.getElementById('top-autoridades-only-active')?.checked ?? true;

  const counts = {}; // spId -> { name, count }
  filtered.forEach(item => {
    if (item.sujeto_pasivo_id && item.sujeto_pasivo) {
      const spId = item.sujeto_pasivo_id;
      if (!onlyActive || activeSujetoIdsCache.has(spId)) {
        if (!counts[spId]) {
          counts[spId] = { name: normalizeName(item.sujeto_pasivo), count: 0 };
        }
        counts[spId].count++;
      }
    }
  });

  const sortedTop = Object.keys(counts)
    .map(spId => ({ name: counts[spId].name, count: counts[spId].count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const topLabels = sortedTop.map(x => x.name);
  const topData = sortedTop.map(x => x.count);

  chartTopAutoridadesInstance = new Chart(canvasTop, {
    type: 'bar',
    data: {
      labels: topLabels.length > 0 ? topLabels : ['Sin registros'],
      datasets: [{
        label: 'Solicitudes Recibidas',
        data: topData.length > 0 ? topData : [0],
        backgroundColor: isDark ? 'rgba(129, 140, 248, 0.85)' : 'rgba(79, 70, 229, 0.85)',
        borderColor: isDark ? '#818cf8' : '#4f46e5',
        borderWidth: 1,
        borderRadius: 4,
        barThickness: 16
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: tooltipBg,
          borderColor: tooltipBorder,
          borderWidth: 1,
          titleColor: tooltipText,
          bodyColor: tooltipText,
          titleFont: { family: 'Inter', weight: 'bold' },
          bodyFont: { family: 'Inter' }
        }
      },
      scales: {
        x: {
          grid: { color: gridColor },
          ticks: { color: textColor, font: fontConfig, precision: 0 }
        },
        y: {
          grid: { display: false },
          ticks: { color: textColor, font: fontConfig }
        }
      }
    }
  });
}

// Handler para alternar el filtro de autoridades vigentes en el gráfico
function toggleTopAutoridadesActive() {
  initDashboardCharts();
}

// ==========================================
// CAPA DE ALERTAS PREVENTIVAS Y SEMÁFORO (FASE 2)
// ==========================================

// Cargar alertas de plazos legales desde el backend
// Cargar alertas de plazos legales desde el backend
async function fetchAlertas(signal) {
  if (!currentUser) return;
  try {
    const res = await fetch('/api/alertas', { signal });
    if (res.ok) {
      dataStore.alertas = await res.json();
      renderAlertasWidget();
      if (currentView === 'alertas') {
        const main = document.getElementById('main-content');
        if (main && typeof renderAlertasCentro === 'function') {
          renderAlertasCentro(main);
        }
      }
    }
  } catch (err) {
    if (err.name !== 'AbortError') {
      console.error('Error al obtener alertas:', err);
    }
  }
}

// Obtiene el listado completo y procesado de alertas (sin filtrar por descartadas si full=true)
function getActiveAlertsList(full = false) {
  if (!dataStore.alertas) return [];

  const warnings = [];

  (dataStore.alertas.ingresadas || []).forEach(item => {
    if (!full && (item.estado_gestion === 'leida' || item.estado_gestion === 'borrada')) return;

    if (item.dias_restantes_sh === undefined) return;
    const diffDays = item.dias_restantes_sh;

    if (diffDays < 0) {
      if (diffDays >= -180) { // Omitir alertas históricas antiguas de más de 180 días
        warnings.push({
          id: item.id,
          type: 'solicitud',
          folio: item.folio_lobby || 'Sin Folio',
          sujeto_pasivo: item.sujeto_pasivo,
          deadline: item.fecha_limite_sh,
          diff: diffDays,
          color: 'red',
          text: `Folio ${item.folio_lobby || 'Sin Folio'} - Solicitud vencida hace ${Math.abs(diffDays)}d hábiles`,
          estado_gestion: item.estado_gestion
        });
      }
    } else if (diffDays <= 1) {
      warnings.push({
        id: item.id,
        type: 'solicitud',
        folio: item.folio_lobby || 'Sin Folio',
        sujeto_pasivo: item.sujeto_pasivo,
        deadline: item.fecha_limite_sh,
        diff: diffDays,
        color: 'yellow',
        text: `Folio ${item.folio_lobby || 'Sin Folio'} - Solicitud por vencer (${diffDays}d hábiles restantes)`,
        estado_gestion: item.estado_gestion
      });
    }
  });

  (dataStore.alertas.pendientesPub || []).forEach(item => {
    if (!full && (item.estado_gestion === 'leida' || item.estado_gestion === 'borrada')) return;

    if (item.dias_restantes_publicacion === undefined) return;
    const diffDays = item.dias_restantes_publicacion;

    if (diffDays < 0) {
      if (diffDays >= -180) { // Omitir alertas históricas antiguas de más de 180 días
        warnings.push({
          id: item.id,
          type: 'publicacion',
          folio: item.folio_lobby || 'Sin Folio',
          sujeto_pasivo: item.sujeto_pasivo,
          deadline: item.fecha_limite_publicacion,
          diff: diffDays,
          color: 'red',
          text: `Folio ${item.folio_lobby || 'Sin Folio'} - Publicación atrasada hace ${Math.abs(diffDays)}d`,
          estado_gestion: item.estado_gestion
        });
      }
    } else if (diffDays <= 5) {
      warnings.push({
        id: item.id,
        type: 'publicacion',
        folio: item.folio_lobby || 'Sin Folio',
        sujeto_pasivo: item.sujeto_pasivo,
        deadline: item.fecha_limite_publicacion,
        diff: diffDays,
        color: 'yellow',
        text: `Folio ${item.folio_lobby || 'Sin Folio'} - Pendiente publicar (${diffDays}d restantes)`,
        estado_gestion: item.estado_gestion
      });
    }
  });

  // Ordenar alertas: Rojas primero, luego Amarillas. Dentro de cada grupo, las más próximas/vencidas primero.
  warnings.sort((a, b) => {
    if (a.color === 'red' && b.color !== 'red') return -1;
    if (a.color !== 'red' && b.color === 'red') return 1;
    return a.diff - b.diff;
  });

  return warnings;
}

// Descartar una alerta y recargar el widget
async function dismissAlerta(event, type, id) {
  if (event) event.stopPropagation();
  try {
    const res = await fetch('/api/alertas/gestionar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        alertas: [{ tipo: type, solicitud_id: id, estado: 'leida' }]
      })
    });
    if (res.ok) {
      showToast('Alerta descartada.');
      await fetchAlertas();
    } else {
      showToast('Error al descartar la alerta.', 'error');
    }
  } catch (e) {
    console.error('Error descartando alerta:', e);
  }
}

// Descartar todas las alertas visibles
async function dismissAllAlertas(event) {
  if (event) event.stopPropagation();
  try {
    const warningList = getActiveAlertsList(false);
    if (warningList.length === 0) {
      showToast('No hay alertas activas para descartar.');
      return;
    }

    const alertasToManage = warningList.map(w => ({
      tipo: w.type,
      solicitud_id: w.id,
      estado: 'leida'
    }));

    const res = await fetch('/api/alertas/gestionar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alertas: alertasToManage })
    });

    if (res.ok) {
      showToast('Todas las alertas actuales han sido descartadas.');
      await fetchAlertas();
    } else {
      showToast('Error al descartar las alertas.', 'error');
    }
  } catch (e) {
    console.error('Error descartando todas las alertas:', e);
  }
}


// Alternar visibilidad del dropdown de alertas
function toggleAlertsDropdown(event) {
  if (event) event.stopPropagation();
  const dropdown = document.getElementById('alerts-dropdown');
  if (!dropdown) return;
  const isHidden = dropdown.classList.contains('hidden');
  
  // Cerrar otros dropdowns
  const profileDropdown = document.getElementById('profile-dropdown');
  if (profileDropdown) profileDropdown.classList.add('hidden');

  if (isHidden) {
    dropdown.classList.remove('hidden');
  } else {
    dropdown.classList.add('hidden');
  }
}

// Alternar visibilidad del dropdown del perfil de usuario
function toggleProfileDropdown(event) {
  if (event) event.stopPropagation();
  const dropdown = document.getElementById('profile-dropdown');
  if (!dropdown) return;
  const isHidden = dropdown.classList.contains('hidden');
  
  // Cerrar otros dropdowns
  const alertsDropdown = document.getElementById('alerts-dropdown');
  if (alertsDropdown) alertsDropdown.classList.add('hidden');

  if (isHidden) {
    dropdown.classList.remove('hidden');
  } else {
    dropdown.classList.add('hidden');
  }
}

// Abrir modal de edición de perfil desde el dropdown flotante
function triggerEditProfile(event) {
  if (event) event.stopPropagation();
  const dropdown = document.getElementById('profile-dropdown');
  if (dropdown) dropdown.classList.add('hidden');
  openProfileModal();
}

// Ir al Centro de Alertas desde el dropdown flotante
function triggerAlertCenter(event) {
  if (event) event.stopPropagation();
  const dropdown = document.getElementById('profile-dropdown');
  if (dropdown) dropdown.classList.add('hidden');
  switchView('alertas');
}

// Navegar directamente a un registro desde una alerta
function goToAlertItem(type, folio) {
  const dropdown = document.getElementById('alerts-dropdown');
  if (dropdown) dropdown.classList.add('hidden');

  if (type === 'solicitud') {
    switchView('solicitudes');
    paginationState.solicitudes.filters.folio = folio;
    paginationState.solicitudes.page = 1;
    updateListView('solicitudes');
    
    setTimeout(() => {
      const input = document.getElementById('filter-solicitud-folio');
      if (input) input.value = folio;
    }, 100);
  } else if (type === 'publicacion') {
    switchView('publicadas');
    paginationState.publicadas.subTab = 'pendientes';
    paginationState.publicadas.filters.folio = folio;
    paginationState.publicadas.page = 1;
    updateListView('publicadas');
    
    setTimeout(() => {
      const input = document.getElementById('filter-publicadas-folio');
      if (input) input.value = folio;
    }, 100);
  }
}

// Cerrar los dropdowns al hacer clic fuera
document.addEventListener('click', (event) => {
  // Alertas
  const container = document.getElementById('alerts-widget-container');
  const dropdown = document.getElementById('alerts-dropdown');
  if (container && dropdown && !container.contains(event.target)) {
    dropdown.classList.add('hidden');
  }

  // Perfil de Usuario
  const profileContainer = document.getElementById('user-profile-menu');
  const profileDropdown = document.getElementById('profile-dropdown');
  if (profileContainer && profileDropdown && !profileContainer.contains(event.target)) {
    profileDropdown.classList.add('hidden');
  }
});
