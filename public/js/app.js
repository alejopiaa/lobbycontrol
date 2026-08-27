// Variables de estado global
let currentUser = null;
let selectedExcelFileBase64 = null;
let currentView = 'dashboard';
let activeAdminTab = 'auditoria';
let dataStore = {
  usuarios: [],
  solicitudes: [],
  publicadas: [],
  sujetos_pasivos: [],
  sujetosVigentesNombres: [],
  stats: {},
  dbHealth: null,
  syncHistory: [],
  dashboardRawData: [],
  reportesRawData: [],
  auditoria: [],
  alertas: null
};

// Variables de estado del Calendario (Agenda)
let currentCalendarDate = new Date();
let calendarViewMode = 'month'; // 'month', 'week', 'day'
let previousCalendarViewMode = 'month';
let calendarFilters = { search: '', vigencia: 'todos' };
let calendarEvents = [];

// Referencias a los gráficos de Chart.js
let chartDistribucionInstance = null;
let chartEvolucionInstance = null;
let chartCumplimientoInstance = null;
let chartTopAutoridadesInstance = null;

// Interceptor global para redirección automática y desvío de API a IPC en Electron
const originalFetch = window.fetch;
window.fetch = async function (input, init = {}) {
  let url = typeof input === 'string' ? input : input.url;
  
  // Si es un llamado a la API local (/api/...) y estamos en entorno Electron
  if (url.startsWith('/api/') && typeof window.api !== 'undefined') {
    const method = init.method || 'GET';
    let body = null;
    if (init.body) {
      if (typeof init.body === 'string') {
        try {
          body = JSON.parse(init.body);
        } catch (e) {
          body = init.body;
        }
      } else {
        body = init.body;
      }
    }

    try {
      const responseData = await window.api.invokeRoute({
        url,
        method,
        body,
        headers: init.headers
      });

      // Crear un objeto Response simulado para que el frontend lo procese igual
      const resStatus = responseData?.status || (responseData?.success === false ? 500 : 200);
      const resData = responseData?.data !== undefined ? responseData.data : (responseData !== undefined ? responseData : { error: 'Unknown backend response' });
      const resObj = new Response(
        typeof resData === 'string' ? resData : JSON.stringify(resData),
        {
          status: resStatus,
          statusText: resStatus === 200 ? 'OK' : 'Error',
          headers: new Headers({
            'Content-Type': 'application/json',
            ...(responseData?.headers || {})
          })
        }
      );

      // Manejar el caso de no autorizado (401)
      if (resObj.status === 401) {
        if (!url.includes('/api/auth/me') && !url.includes('/api/auth/login')) {
          currentUser = null;
          switchView('login');
          resObj.clone().json().then(data => {
            const msg = data.error || data.message || 'Su sesión ha expirado o no está autorizado.';
            showToast(msg, 'error');
          }).catch(() => {
            showToast('Su sesión ha expirado o no está autorizado.', 'error');
          });
        }
      }

      return resObj;
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        statusText: 'Internal Server Error',
        headers: new Headers({ 'Content-Type': 'application/json' })
      });
    }
  }

  // Comportamiento por defecto para assets estáticos u otras llamadas (si no hay Electron)
  const response = await originalFetch(input, init);
  if (response.status === 401) {
    if (!url.includes('/api/auth/me') && !url.includes('/api/auth/login')) {
      currentUser = null;
      switchView('login');
      response.clone().json().then(data => {
        const msg = data.error || data.message || 'Su sesión ha expirado o no está autorizado.';
        showToast(msg, 'error');
      }).catch(() => {
        showToast('Su sesión ha expirado o no está autorizado.', 'error');
      });
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
      relacionRepresentado: '',
      vigencia: 'todos'
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
      relacionRepresentado: '',
      vigencia: 'todos'
    }
  },
  sujetos_pasivos: { page: 1, search: '', vigencia: 'todos', tipoFecha: 'incorporacion', fechaDesde: '', fechaHasta: '' },
  reportes: { page: 1 },
  logs: { page: 1, filterType: 'all' }
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
  cargo: '',
  vigencia: 'todos'
};

let reportesFilters = {
  nombre: '',
  cargo: '',
  fechaInicio: '',
  fechaTermino: '',
  estados: [],
  vigencia: 'todos'
};

let dashboardDropdownCache = {
  anios: [],
  nombres: [],
  nombresVigentes: [],
  cargos: [],
  sujetosActivosRepresentados: []
};

// Administrar visualmente el estado de la cápsula flotante de conexión
function updateCapsuleStatus(state, details = '') {
  const pingEl = document.getElementById('capsule-indicator-ping');
  const dotEl = document.getElementById('capsule-indicator-dot');
  const labelEl = document.getElementById('capsule-label');
  const netStatusEl = document.getElementById('capsule-net-status');
  const lastUpdateEl = document.getElementById('capsule-last-update');
  const syncContainer = document.getElementById('capsule-sync-container');

  if (details && lastUpdateEl) {
    lastUpdateEl.textContent = details;
  }

  if (pingEl && dotEl && labelEl && netStatusEl) {
    pingEl.className = 'animate-ping absolute inline-flex h-full w-full rounded-full';
    dotEl.className = 'relative inline-flex rounded-full h-2 w-2';
    netStatusEl.className = 'font-semibold';

    if (state === 'synced') {
      pingEl.classList.remove('hidden');
      pingEl.classList.add('bg-emerald-400');
      dotEl.classList.add('bg-emerald-500');
      labelEl.textContent = 'Conectado';
      netStatusEl.textContent = 'Conectado';
      netStatusEl.classList.add('text-emerald-600', 'dark:text-emerald-400');
      if (syncContainer) syncContainer.classList.add('hidden');
    } else if (state === 'syncing') {
      pingEl.classList.remove('hidden');
      pingEl.classList.add('bg-amber-400');
      dotEl.classList.add('bg-amber-500');
      labelEl.textContent = 'Actualizando...';
      netStatusEl.textContent = 'Sincronizando...';
      netStatusEl.classList.add('text-amber-500');
      if (syncContainer) syncContainer.classList.add('hidden');
    } else if (state === 'error') {
      pingEl.classList.add('hidden');
      dotEl.classList.add('bg-rose-500');
      labelEl.textContent = 'Desconectado';
      netStatusEl.textContent = 'Error Sync';
      netStatusEl.classList.add('text-rose-600', 'dark:text-rose-400');
      if (syncContainer) syncContainer.classList.remove('hidden');
    }
  }
}

// Obtener y actualizar fecha de última actualización de la base de datos en el header
async function fetchAndUpdateDbTimestamp() {
  try {
    const res = await fetch('/api/db-last-update');
    if (res.ok) {
      const data = await res.json();
      if (data.dbLastUpdate) {
        updateCapsuleStatus('synced', data.dbLastUpdate);
      }
      if (data.usersLastUpdate) {
        dataStore.usersLastUpdate = data.usersLastUpdate;
        const usersLastSyncEl = document.getElementById('users-last-sync-time');
        if (usersLastSyncEl) {
          usersLastSyncEl.textContent = data.usersLastUpdate;
        }
      }
    }
  } catch (err) {
    console.error('Error al obtener fecha de última actualización:', err);
    updateCapsuleStatus('error');
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
  const navAdministracion = document.getElementById('nav-settings') || document.getElementById('nav-administracion');
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
    // El Auditor y Administrador tienen acceso a la vista de administración/configuración
    if (rol === 'Sujeto Pasivo' || rol === 'Asistente técnico') {
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

  // Manejar el banner de simulación de perfil
  const banner = document.getElementById('impersonation-banner');
  if (banner) {
    if (currentUser.isSimulated) {
      banner.classList.remove('hidden');
      const nameEl = document.getElementById('simulated-user-name');
      const roleEl = document.getElementById('simulated-user-role');
      if (nameEl) nameEl.textContent = currentUser.nombre || '';
      if (roleEl) roleEl.textContent = currentUser.rol || '';
    } else {
      banner.classList.add('hidden');
    }
  }
}

async function startImpersonation(userId) {
  try {
    const res = await fetch('/api/admin/impersonate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ userId })
    });
    
    if (res.ok) {
      showToast('Simulación de perfil iniciada.');
      await checkAuth();
      // Forzar recarga de datos según el nuevo rol simulado
      await switchView('dashboard');
    } else {
      const data = await res.json();
      showToast(data.error || 'No se pudo iniciar la simulación.', 'error');
    }
  } catch (err) {
    console.error('Error al iniciar simulación:', err);
    showToast('Error de red al iniciar la simulación.', 'error');
  }
}
window.startImpersonation = startImpersonation;

async function stopImpersonation() {
  try {
    const res = await fetch('/api/admin/impersonate/stop', {
      method: 'POST'
    });
    
    if (res.ok) {
      showToast('Simulación de perfil finalizada.');
      await checkAuth();
      // Forzar recarga de datos según el rol real
      await switchView('dashboard');
    } else {
      showToast('No se pudo finalizar la simulación.', 'error');
    }
  } catch (err) {
    console.error('Error al detener simulación:', err);
    showToast('Error de red al finalizar la simulación.', 'error');
  }
}
window.stopImpersonation = stopImpersonation;

async function triggerSsoLogin() {
  const loginErrorEl = document.getElementById('login-error');
  const loginErrorTextEl = document.getElementById('login-error-text');
  const btn = document.getElementById('btn-sso-login');
  
  if (loginErrorEl) loginErrorEl.classList.add('hidden');

  let originalHtml = '';
  if (btn) {
    originalHtml = btn.innerHTML;
    btn.disabled = true;
    btn.classList.add('opacity-60', 'cursor-not-allowed');
    btn.innerHTML = `<i data-lucide="refresh-cw" class="h-4 w-4 animate-spin shrink-0"></i> <span>Iniciando sesión...</span>`;
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  }

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
    } else {
      if (loginErrorEl && loginErrorTextEl) {
        const rawMsg = data.message || data.error || 'No se pudo iniciar sesión con Microsoft.';
        loginErrorTextEl.textContent = translateError(rawMsg);
        loginErrorEl.classList.remove('hidden');
      }
      if (btn) {
        btn.disabled = false;
        btn.classList.remove('opacity-60', 'cursor-not-allowed');
        btn.innerHTML = originalHtml;
        if (typeof lucide !== 'undefined') {
          lucide.createIcons();
        }
      }
    }
  } catch (err) {
    console.error('Error en SSO:', err);
    if (loginErrorEl && loginErrorTextEl) {
      loginErrorTextEl.textContent = translateError(err.message || 'Error de red al conectar con el inicio de sesión corporativo.');
      loginErrorEl.classList.remove('hidden');
    }
    if (btn) {
      btn.disabled = false;
      btn.classList.remove('opacity-60', 'cursor-not-allowed');
      btn.innerHTML = originalHtml;
      if (typeof lucide !== 'undefined') {
        lucide.createIcons();
      }
    }
  }
}

async function logout() {
  // Detener el timeout antes de cerrar sesión
  if (typeof destroySessionTimeout === 'function') destroySessionTimeout();
  // Detener la sincronización automática en segundo plano
  if (window.bgSyncInterval) {
    clearInterval(window.bgSyncInterval);
    window.bgSyncInterval = null;
  }
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

// Función para iniciar la verificación automática de base de datos en segundo plano
function initBackgroundSync() {
  if (window.bgSyncInterval) clearInterval(window.bgSyncInterval);

  const runSync = async () => {
    if (!currentUser) return;

    // 1. Mostrar estado "Actualizando..."
    updateCapsuleStatus('syncing');

    try {
      console.log('[Auto-Sync] Verificando nueva versión de base de datos...');
      const res = await fetch('/api/db/sync', { method: 'POST' });
      
      if (res.ok) {
        const data = await res.json();
        
        if (data.success && data.updated) {
          console.log('[Auto-Sync] ¡Base de datos actualizada con éxito!');
          showToast('Base de datos actualizada con nuevos registros.', 'success');
          
          // 2. Éxito
          updateCapsuleStatus('synced', data.dbLastUpdate || 'Al día');
          
          if (typeof renderView === 'function') {
            renderView();
          }
        } else {
          // Si no hubo cambios, recuperar el valor actual
          const lastUpdateEl = document.getElementById('capsule-last-update');
          const lastText = lastUpdateEl ? lastUpdateEl.textContent : 'Al día';
          updateCapsuleStatus('synced', lastText);
        }
      } else {
        updateCapsuleStatus('error');
      }
    } catch (err) {
      console.error('[Auto-Sync] Error en la verificación automática:', err);
      updateCapsuleStatus('error');
    }
  };

  // 1. Ejecutar una verificación inicial 2 segundos después de arrancar
  setTimeout(runSync, 2000);

  // 2. Ejecutar de forma periódica en segundo plano
  // Configurado a 5 minutos para producción
  const syncIntervalTime = 5 * 60 * 1000; 
  window.bgSyncInterval = setInterval(runSync, syncIntervalTime);
}

// Función para ejecutar la sincronización manual desde la cápsula de estado
async function runCapsuleSync(isManual = false) {
  if (!currentUser) return;
  
  // 1. Mostrar estado "Actualizando..."
  updateCapsuleStatus('syncing');
  
  const syncBtn = document.getElementById('btn-capsule-sync');
  if (syncBtn) {
    syncBtn.disabled = true;
    syncBtn.classList.add('opacity-50', 'pointer-events-none');
  }

  try {
    console.log('[Manual-Sync] Forzando sincronización de base de datos...');
    const res = await fetch('/api/db/sync', { method: 'POST' });
    
    if (res.ok) {
      const data = await res.json();
      
      if (data.success) {
        if (data.updated) {
          console.log('[Manual-Sync] ¡Base de datos actualizada con éxito!');
          showToast('Base de datos sincronizada con éxito.', 'success');
          updateCapsuleStatus('synced', data.dbLastUpdate || 'Al día');
          
          if (typeof renderView === 'function') {
            renderView();
          }
        } else {
          console.log('[Manual-Sync] La base de datos ya está al día.');
          if (isManual) {
            showToast('La base de datos ya se encuentra al día.', 'info');
          }
          const lastUpdateEl = document.getElementById('capsule-last-update');
          const lastText = lastUpdateEl ? lastUpdateEl.textContent : 'Al día';
          updateCapsuleStatus('synced', lastText);
        }
      } else {
        updateCapsuleStatus('error');
        if (isManual) showToast('Error al intentar sincronizar: ' + (data.error || 'Servicio no disponible'), 'error');
      }
    } else {
      updateCapsuleStatus('error');
      if (isManual) showToast('No se pudo establecer conexión con el servidor.', 'error');
    }
  } catch (err) {
    console.error('[Manual-Sync] Error en la sincronización manual:', err);
    updateCapsuleStatus('error');
    if (isManual) showToast('Error de red al intentar sincronizar.', 'error');
  } finally {
    if (syncBtn) {
      syncBtn.disabled = false;
      syncBtn.classList.remove('opacity-50', 'pointer-events-none');
    }
  }
}
window.runCapsuleSync = runCapsuleSync;


// Obtener y mostrar la versión de la app desde el backend (package.json)
async function fetchAppVersion() {
  try {
    const response = await window.api.invokeRoute({
      url: '/api/app-version',
      method: 'GET'
    });
    if (response && response.status === 200 && response.data) {
      const versionEl = document.getElementById('app-version');
      if (versionEl) {
        versionEl.textContent = `v${response.data.version}`;
      }
      const devTag = document.getElementById('capsule-dev-tag');
      if (devTag) {
        if (response.data.isDev) {
          devTag.classList.remove('hidden');
        } else {
          devTag.classList.add('hidden');
        }
      }
    }
  } catch (err) {
    console.error('Error al cargar la versión de la app:', err);
  }
}

// Reloj digital (desactivado para reducir distracciones visuales)
function startLiveClock() {
  const dateEl = document.getElementById('current-date');
  const timeEl = document.getElementById('current-time');
  if (!dateEl || !timeEl) return;
}

// Al cargar el documento
document.addEventListener('DOMContentLoaded', async () => {
  lucide.createIcons();
  updateThemeIcons();
  fetchAndUpdateDbTimestamp();
  startLiveClock();
  fetchAppVersion();
  
  const isAuthenticated = await checkAuth();
  if (isAuthenticated) {
    fetchAlertas();
    // Iniciar el módulo de timeout de inactividad (sesión ya activa desde una recarga)
    if (typeof initSessionTimeout === 'function') initSessionTimeout();
    // Iniciar la sincronización automática en segundo plano
    if (typeof initBackgroundSync === 'function') initBackgroundSync();
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
    relacionRepresentado: '',
    vigencia: 'todos'
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
    relacionSujetoActivo: (sujetoActivo && sujetoActivo !== 'null') ? sujetoActivo : '',
    relacionRut: (rut && rut !== 'null') ? rut : '',
    relacionRepresentado: (representado && representado !== 'null') ? representado : '',
    vigencia: 'todos'
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





// Mostrar notificaciones Toast
function showToast(message, type = 'success', options = {}) {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  const isError = type === 'error';
  
  let displayMessage = message;
  let errorDetails = options.details || '';
  
  if (isError) {
    displayMessage = translateError(message);
    
    const codeMatch = displayMessage.match(/\[(ERR-\w+-\d+)\]/);
    const code = codeMatch ? codeMatch[1] : '';
    
    if (code === 'ERR-GEN-999' || code === 'ERR-DB-500') {
      const now = new Date();
      const d = String(now.getDate()).padStart(2, '0');
      const m = String(now.getMonth() + 1).padStart(2, '0');
      const y = now.getFullYear();
      const hh = String(now.getHours()).padStart(2, '0');
      const min = String(now.getMinutes()).padStart(2, '0');
      const ss = String(now.getSeconds()).padStart(2, '0');
      const timestamp = `${d}-${m}-${y} ${hh}:${min}:${ss}`;

      errorDetails = `================ LOBBYCONTROL ERROR REPORT ================
Fecha/Hora:     ${timestamp}
Código Soporte: ${code}
Mensaje:        ${displayMessage}
-----------------------------------------------------------
Detalle Técnico:
${message}
===========================================================`;
    }
  }

  const persistent = options.persistent !== undefined ? options.persistent : isError;

  toast.className = `flex items-center justify-between gap-3 px-4 py-3 rounded-2xl shadow-xl text-sm toast-animate-in glass-card border ${
    type === 'success' ? 'border-emerald-500/30 text-emerald-300' : 'border-rose-500/30 text-rose-300'
  }`;
  toast.style.position = 'relative';
  toast.style.overflow = 'hidden';
  
  const icon = type === 'success' ? 'check-circle' : 'alert-circle';
  
  let htmlContent = `
    <div class="flex items-center gap-3 pr-2">
      <i data-lucide="${icon}" class="h-5 w-5 shrink-0 ${type === 'success' ? 'text-emerald-400' : 'text-rose-400'}"></i>
      <span class="break-words text-left font-medium">${displayMessage}</span>
    </div>
    <div class="flex items-center gap-2 shrink-0">
  `;

  if (isError && errorDetails) {
    const escapedDetails = String(errorDetails).replace(/'/g, "\\'").replace(/"/g, '\\"').replace(/\n/g, '\\n');
    htmlContent += `
      <button onclick="navigator.clipboard.writeText('${escapedDetails}'); showToast('Detalles copiados', 'success', { persistent: false });" 
              class="px-2 py-1 bg-rose-950/40 hover:bg-rose-900/60 rounded text-[10px] font-semibold text-rose-300 transition-colors border border-rose-800/40 active:scale-[0.98] cursor-pointer">
        Copiar detalles
      </button>
    `;
  }

  if (persistent) {
    htmlContent += `
      <button onclick="const t = this.closest('.toast-animate-in, div'); t.classList.remove('toast-animate-in'); t.classList.add('toast-animate-out'); setTimeout(() => t.remove(), 190);" 
              class="text-text-tertiary hover:text-text-primary transition-colors bg-transparent border-none cursor-pointer p-0.5 flex items-center justify-center">
        <i data-lucide="x" class="h-4 w-4"></i>
      </button>
    `;
  }

  htmlContent += `</div>`;

  if (!persistent) {
    htmlContent += `
      <div style="position: absolute; bottom: 0; left: 0; right: 0; width: 100%; height: 3px; overflow: hidden; pointer-events: none;">
        <div class="toast-progress-bar" style="height: 100%; background-color: ${type === 'success' ? '#10b981' : '#f43f5e'};"></div>
      </div>
    `;
  }

  toast.innerHTML = htmlContent;
  container.appendChild(toast);
  lucide.createIcons();

  // Eliminación automática con salida animada suave
  if (!persistent) {
    setTimeout(() => {
      if (toast.parentNode) {
        toast.classList.remove('toast-animate-in');
        toast.classList.add('toast-animate-out');
        setTimeout(() => toast.remove(), 190);
      }
    }, 3800);
  }
}

// Petición especial de datos para Reportes
async function fetchReportesData(signal) {
  const res = await fetch('/api/solicitudes', { signal });
  if (!res.ok) throw new Error();
  dataStore.reportesRawData = await res.json();
}

// Cambiar de vista activa en el Sidebar y recargar datos
async function switchView(viewName) {
  window.isSwitchingView = true;
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

  if (viewName === 'administracion') {
    const rol = (currentUser && currentUser.rol) || '';
    window.activeAdminScope = 'gestion';
    window.activeAdminTab = rol === 'Auditor' ? 'sujetos' : 'auditoria';
  }
  
  // Controlar visibilidad del Header y Cápsula según si es vista de Login o no
  const header = document.querySelector('header');
  const capsule = document.getElementById('system-status-capsule');
  if (viewName === 'login') {
    if (header) header.classList.add('hidden');
    if (capsule) capsule.classList.add('hidden');
    renderView();
    return;
  } else {
    if (header) header.classList.remove('hidden');
    if (capsule) capsule.classList.remove('hidden');
    updateHeaderUserSection();
  }
  
  // Actualizar estilos de la Navegación Superior (píldoras del menú central)
  const navButtons = ['dashboard', 'solicitudes', 'publicadas', 'agenda'];
  navButtons.forEach(btn => {
    const el = document.getElementById(`nav-${btn}`);
    if (el) {
      if (btn === viewName) {
        el.className = "flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 sidebar-nav-active";
      } else {
        el.className = "flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all duration-200 sidebar-nav-inactive";
      }
    }
  });

  // Estilo del botón de Configuración (Settings engranaje a la derecha)
  const settingsEl = document.getElementById('nav-settings');
  if (settingsEl) {
    if (viewName === 'administracion') {
      settingsEl.className = "h-8 w-8 rounded-xl flex items-center justify-center border border-brand-500 bg-brand-500/10 text-brand-500 dark:text-brand-400 transition-all duration-200";
    } else {
      settingsEl.className = "h-8 w-8 rounded-xl flex items-center justify-center border border-border-ui  hover:border-border-ui dark:hover:border-border-ui bg-border-ui  text-text-secondary  hover:text-text-primary  transition-all duration-200";
    }
  }

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
      // Cargar nombres de sujetos pasivos vigentes para el autocomplete
      await fetchVigentesNombres(signal);
      // Cargar IDs de sujetos pasivos vigentes para el filtro de la tabla
      await fetchActiveSujetoIds(signal);
      dataStore.dashboardRawData = dataStore.reportesRawData;
      buildDashboardDropdownCache();
    } else {
      if (viewName === 'solicitudes' || viewName === 'publicadas') {
        if (!dataStore.dashboardRawData || dataStore.dashboardRawData.length === 0) {
          await fetchDashboardData(signal);
        }
        await fetchActiveSujetoIds(signal);
        await fetchPaginatedList(viewName, signal);
      } else if (viewName === 'alertas') {
        await fetchAlertas(signal);
      } else if (viewName === 'agenda') {
        await fetchData('publicadas', signal);
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
      relacionRepresentado: state.filters.relacionRepresentado || '',
      vigencia: state.filters.vigencia || 'todos'
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
      relacionRepresentado: state.filters.relacionRepresentado || '',
      vigencia: state.filters.vigencia || 'todos'
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

// Petición de nombres de sujetos pasivos VIGENTES (para el autocomplete de reportes)
async function fetchVigentesNombres(signal) {
  try {
    const res = await fetch('/api/sujetos_pasivos/vigentes-nombres', { signal });
    if (!res.ok) return;
    const data = await res.json();
    dataStore.sujetosVigentesNombres = data; // [{ nombre, rut }, ...]
  } catch (e) {
    console.warn('No se pudo cargar la lista de vigentes:', e);
  }
}

// Helper interno: extrae el arreglo real de una respuesta API que puede ser
// un arreglo directo o un objeto envuelto { success, data: [...] }
function _getArr(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  if (val.data && Array.isArray(val.data)) return val.data;
  return [];
}

// Construir caché única de años, nombres y cargos del sujeto pasivo
function buildDashboardDropdownCache() {
  const rawNombresSet = new Set();
  const rawCargosSet = new Set();
  const rawSujetosActivosRepresentadosSet = new Set();

  // Obtener el arreglo plano independientemente de si la API retorna un objeto envuelto
  const dataset = _getArr(dataStore.dashboardRawData).length
    ? _getArr(dataStore.dashboardRawData)
    : (_getArr(dataStore.solicitudes).length
      ? _getArr(dataStore.solicitudes)
      : _getArr(dataStore.publicadas));

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

  // Construir lista de sujetos pasivos VIGENTES desde el endpoint dedicado
  const vigentesNombresSet = new Set();
  _getArr(dataStore.sujetosVigentesNombres).forEach(sp => {
    if (sp.nombre) {
      const normalized = normalizeName(sp.nombre);
      if (normalized) vigentesNombresSet.add(normalized);
    }
  });
  dashboardDropdownCache.nombresVigentes = Array.from(vigentesNombresSet).sort((a, b) => a.localeCompare(b));
}



// Variable global para controlar la sugerencia activa por teclado
let activeSuggestionIndex = -1;

// Helper para obtener el prefijo de ID de input y los filtros activos según la vista
function getActiveFiltersAndPrefix() {
  let idPrefix, filters;
  if (currentView === 'dashboard') {
    idPrefix = 'dashboard-filter-';
    filters = dashboardFilters;
  } else if (currentView === 'reportes' || (currentView === 'administracion' && typeof activeAdminTab !== 'undefined' && activeAdminTab === 'reportes')) {
    idPrefix = 'report-filter-';
    filters = reportesFilters;
  } else if (currentView === 'solicitudes') {
    idPrefix = 'solicitudes-filter-';
    filters = paginationState.solicitudes.filters;
  } else if (currentView === 'publicadas') {
    idPrefix = 'publicadas-filter-';
    filters = paginationState.publicadas.filters;
  } else if (currentView === 'sujetos_pasivos' || (currentView === 'administracion' && typeof activeAdminTab !== 'undefined' && activeAdminTab === 'sujetos')) {
    idPrefix = 'search-';
    filters = paginationState.sujetos_pasivos;
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
    if (filters && (filters.vigencia === 'vigentes' || filters.soloVigentes === true)) {
      list = dashboardDropdownCache.nombresVigentes;
    } else {
      list = dashboardDropdownCache.nombres;
    }
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
  // Excepción: en reportes, campo nombre → mostrar los vigentes aunque esté vacío (como lista inicial)
  const isReportesNombre = (idPrefix === 'report-filter-' && fieldName === 'nombre');
  if ((fieldName === 'nombre' || fieldName === 'sujetoActivoRepresentado') && val.length === 0 && !isReportesNombre) {
    suggestionsDiv.classList.add('hidden');
    activeSuggestionIndex = -1;
    return;
  }

  const isValTodos = val.toLowerCase() === 'todos';
  // En reportes campo nombre sin texto: mostrar todos los vigentes (hasta 35)
  const maxSuggestions = isReportesNombre && val.length === 0 ? 50 : 8;
  const filtered = (val.length > 0 && fieldName !== 'anio' && !isValTodos)
    ? list.filter(item => item.toLowerCase().includes(val)).slice(0, maxSuggestions)
    : (fieldName === 'anio' ? list : list.slice(0, maxSuggestions));

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

  suggestionsDiv.innerHTML = headerHtml + filtered.map((item, index) => {
    return `
      <div data-action="select-suggestion"
           data-field="${fieldName}"
           data-value="${escapeHtmlAttr(item)}"
           class="suggestion-item px-3 py-2 text-xs text-text-secondary hover:bg-brand-600 hover:text-text-primary cursor-pointer transition-colors truncate">
        ${escapeHtml(item)}
      </div>
    `;
  }).join('');
  suggestionsDiv.classList.remove('hidden');
  activeSuggestionIndex = -1;
  if (isReportesNombre) lucide.createIcons();
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
    if (cargoInput && (currentView === 'reportes' || (currentView === 'administracion' && typeof activeAdminTab !== 'undefined' && activeAdminTab === 'reportes') || currentView === 'solicitudes' || currentView === 'publicadas')) {
      if (value === '') {
        cargoInput.disabled = true;
        cargoInput.placeholder = 'Seleccione nombre primero...';
        cargoInput.classList.add('glass-input-disabled', 'cursor-not-allowed');
        cargoInput.classList.remove('text-text-secondary');
        cargoInput.value = '';
      } else {
        cargoInput.disabled = false;
        cargoInput.placeholder = 'Escribir cargo...';
        cargoInput.classList.remove('glass-input-disabled', 'cursor-not-allowed');
        cargoInput.classList.add('text-text-secondary');
      }
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
        // En reportes: aceptar cualquier nombre del historial completo (vigentes o no)
        list = dashboardDropdownCache.nombres;
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
            if (cargoInput && (currentView === 'reportes' || (currentView === 'administracion' && typeof activeAdminTab !== 'undefined' && activeAdminTab === 'reportes') || currentView === 'solicitudes' || currentView === 'publicadas')) {
              cargoInput.disabled = true;
              cargoInput.placeholder = 'Seleccione nombre primero...';
              cargoInput.classList.add('glass-input-disabled', 'cursor-not-allowed');
              cargoInput.classList.remove('text-text-secondary');
              cargoInput.value = '';
            }
          }
          if (fieldName === 'anio') {
            filters.fechaInicio = '';
            filters.fechaTermino = '';
            const mainEl = document.getElementById('main-content');
            if (mainEl) mainEl.innerHTML = '';
          }
          triggerRenderOrFetch();
        }
      } else {
        const isReportes = (currentView === 'reportes' || (currentView === 'administracion' && typeof activeAdminTab !== 'undefined' && activeAdminTab === 'reportes'));
        const isWildcardAllowed = (isReportes && (fieldName === 'nombre' || fieldName === 'cargo') && val.toLowerCase() === 'todos');
        const matchedItem = isWildcardAllowed ? 'Todos' : list.find(item => item.toLowerCase() === val.toLowerCase());
        if (matchedItem) {
          if (filters[fieldName] !== matchedItem) {
            if (fieldName === 'nombre') {
              filters.cargo = '';
              
              // Si estamos en vistas con bloqueo reactivo, forzar desbloqueo de cargo en DOM
              const cargoInput = document.getElementById(currentView === 'dashboard' ? 'dashboard-filter-cargo' : `${idPrefix}cargo`);
              if (cargoInput && (currentView === 'reportes' || (currentView === 'administracion' && typeof activeAdminTab !== 'undefined' && activeAdminTab === 'reportes') || currentView === 'solicitudes' || currentView === 'publicadas')) {
                cargoInput.disabled = false;
                cargoInput.placeholder = 'Escribir cargo...';
                cargoInput.classList.remove('glass-input-disabled', 'cursor-not-allowed');
                cargoInput.classList.add('text-text-secondary');
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
          }
          triggerRenderOrFetch();
        } else if (isReportes) {
          // En reportes se permite la búsqueda libre / parcial de texto sin rechazar la entrada
          filters[fieldName] = val;
          if (fieldName === 'nombre') {
            const cargoInput = document.getElementById(`${idPrefix}cargo`);
            if (cargoInput) {
              cargoInput.disabled = false;
              cargoInput.placeholder = 'Escribir cargo...';
              cargoInput.classList.remove('glass-input-disabled', 'cursor-not-allowed');
              cargoInput.classList.add('text-text-secondary');
            }
          }
          triggerRenderOrFetch();
        } else {
          // Si no existe y no estamos en reportes, rechazar la entrada y volver al valor anterior
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
        if (cargoInput && (currentView === 'reportes' || (currentView === 'administracion' && typeof activeAdminTab !== 'undefined' && activeAdminTab === 'reportes') || currentView === 'solicitudes' || currentView === 'publicadas')) {
          cargoInput.disabled = true;
          cargoInput.placeholder = 'Seleccione nombre primero...';
          cargoInput.classList.add('glass-input-disabled', 'cursor-not-allowed');
          cargoInput.classList.remove('text-text-secondary');
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
    const isReportesView = (currentView === 'reportes' || (currentView === 'administracion' && typeof activeAdminTab !== 'undefined' && activeAdminTab === 'reportes'));
    if (isReportesView || currentView === 'solicitudes' || currentView === 'publicadas') {
      filters[fieldName] = value;
      if (fieldName === 'nombre') {
        filters.cargo = '';
        // Forzar desbloqueo de cargo en DOM
        const cargoInput = document.getElementById(currentView === 'dashboard' ? 'dashboard-filter-cargo' : `${idPrefix}cargo`);
        if (cargoInput) {
          cargoInput.disabled = false;
          cargoInput.placeholder = 'Escribir cargo...';
          cargoInput.classList.remove('glass-input-disabled', 'cursor-not-allowed');
          cargoInput.classList.add('text-text-secondary');
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
          const isWildcardAllowed = ((currentView === 'reportes' || (currentView === 'administracion' && typeof activeAdminTab !== 'undefined' && activeAdminTab === 'reportes')) && (fieldName === 'nombre' || fieldName === 'cargo') && val.toLowerCase() === 'todos');
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
      item.classList.remove('text-text-secondary');
      item.scrollIntoView({ block: 'nearest' });
    } else {
      item.classList.remove('bg-brand-600', 'text-white');
      item.classList.add('text-text-secondary');
    }
  });
}



// Limpiar filtros del dashboard
function clearDashboardFilters() {
  dashboardFilters = {
    anio: '',
    fechaInicio: '',
    fechaTermino: '',
    nombre: '',
    cargo: '',
    vigencia: 'todos'
  };
  const main = document.getElementById('main-content');
  if (main) main.innerHTML = ''; // Fuerza re-renderizado completo de los filtros
  renderView();
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

// Aliases de retrocompatibilidad
window.toggleDashboardSoloVigentes = (c) => window.changeDashboardVigencia(c ? 'vigentes' : 'todos');
window.toggleSolicitudesSoloVigentes = (c) => window.changeSolicitudesVigencia(c ? 'vigentes' : 'todos');
window.togglePublicadasSoloVigentes = (c) => window.changePublicadasVigencia(c ? 'vigentes' : 'todos');
window.toggleCalendarSoloVigentes = (c) => window.changeCalendarVigencia(c ? 'vigentes' : 'todos');
window.toggleSujetosPasivosSoloVigentes = (c) => window.changeSujetosPasivosVigencia(c ? 'vigentes' : 'todos');
window.toggleReportesSoloVigentes = (c) => window.changeReportesVigencia(c ? 'vigentes' : 'todos');

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



function updateReporteEstadoPillStyle(checkbox) {
  if (!checkbox) return;
  const label = checkbox.closest('label');
  if (!label) return;
  const isChecked = checkbox.checked;
  
  const activeClasses = ['border-brand-500', 'bg-blue-500/10', 'text-blue-600', 'dark:text-blue-400', 'shadow-sm', 'shadow-brand-500/20'];
  const inactiveClasses = ['text-text-tertiary', '', 'border-border-ui', '', 'bg-border-ui', ''];

  if (isChecked) {
    inactiveClasses.forEach(c => label.classList.remove(c));
    activeClasses.forEach(c => label.classList.add(c));
  } else {
    activeClasses.forEach(c => label.classList.remove(c));
    inactiveClasses.forEach(c => label.classList.add(c));
  }
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
    estados: [],
    vigencia: 'todos'
  };
  const main = document.getElementById('main-content');
  if (main) main.innerHTML = ''; // Fuerza re-renderizado completo de los filtros
  renderView();
}


// Renderizar Vistas según selección
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
  switch (currentView) {
    case 'login':
      renderLogin(main);
      break;
    case 'dashboard':
      isPartialUpdate = renderDashboard(main);
      initDashboardCharts();
      if (!isPartialUpdate || forceAnimateCards) {
        ['count-total-solicitudes', 'count-solicitudes-respondidas', 'count-solicitudes-pendientes',
         'count-estado-aceptada', 'count-estado-rechazada', 'count-estado-suspendida', 
         'count-estado-cancelada', 'count-estado-encomendada', 'count-estado-publicadas', 
         'count-estado-pendientesPublicacion'].forEach(id => animateNumberCount(id, null, 1000));
      }
      break;
    case 'solicitudes':
      renderSolicitudes(main);
      break;
    case 'publicadas':
      renderPublicadas(main);
      break;
    case 'agenda':
      renderAgenda(main);
      break;
    case 'sujetos_pasivos':
      renderSujetosPasivos(main);
      break;
    case 'administracion':
      renderUsuarios(main);
      break;
    case 'reportes':
      isPartialUpdate = renderReportes(main);
      break;
    case 'alertas':
      renderAlertasCentro(main);
      break;
  }
  lucide.createIcons();
  updateThemeIcons();
  
  // Inicializar Air Datepicker si la vista se redibujó por completo, o resincronizar límites si fue actualización parcial
  if (!isPartialUpdate) {
    requestAnimationFrame(() => initAirDatepickerFields());
  } else {
    requestAnimationFrame(() => syncAllLinkedDatepickers());
  }
  
  hideLoader(!!window.activeInputId || !window.isSwitchingView);
  window.isSwitchingView = false;
}



// ─── AIR DATEPICKER v3: Inicialización de selectores de fecha premium ───────
// Permite navegación por grid de meses y grid de años al hacer click en el header
function initAirDatepickerFields() {
  if (typeof AirDatepicker === 'undefined') {
    console.error('[DatePicker] AirDatepicker no está definido en el ámbito global.');
    return;
  }

  const locale = (typeof window.AirDatepickerLocaleEs !== 'undefined')
    ? window.AirDatepickerLocaleEs
    : undefined;

  const inputs = document.querySelectorAll('.datepicker-display-input, .flatpickr-display-input');

  inputs.forEach(displayInput => {
    try {
      const hiddenInputId = displayInput.getAttribute('data-date-target');
      const hiddenInput = hiddenInputId ? document.getElementById(hiddenInputId) : null;

      // 1. Obtener límites min y max desde el input oculto
      let minDate = undefined;
      let maxDate = undefined;
      if (hiddenInput) {
        const minVal = hiddenInput.getAttribute('min');
        if (minVal) {
          const parts = minVal.split('-').map(Number);
          if (parts.length === 3 && !parts.some(isNaN)) {
            minDate = new Date(parts[0], parts[1] - 1, parts[2]);
          }
        }
        const maxVal = hiddenInput.getAttribute('max');
        if (maxVal) {
          const parts = maxVal.split('-').map(Number);
          if (parts.length === 3 && !parts.some(isNaN)) {
            maxDate = new Date(parts[0], parts[1] - 1, parts[2]);
          }
        }
      }

      // 2. Si ya tiene una instancia de AirDatepicker, solo actualizamos sus opciones en lugar de recrearla
      if (displayInput._airDatepicker) {
        const dp = displayInput._airDatepicker;
        dp.update({
          minDate: minDate,
          maxDate: maxDate
        });
        return;
      }

      // 3. Crear opciones base del calendario
      const adpOptions = {
        dateFormat: 'dd/MM/yyyy',
        autoClose: true,
        isMobile: false,
        position: 'bottom left',
        navTitles: {
          days: 'MMMM yyyy',   // Click abre selector de meses
          months: 'yyyy',      // Click abre selector de años
          years: 'yyyy1 - yyyy2'
        },
        buttons: [{
          content: 'Hoy',
          className: 'adp-btn-today',
          onClick: (dp) => { dp.selectDate(new Date()); dp.hide(); }
        }, {
          content: 'Limpiar',
          className: 'adp-btn-clear',
          onClick: (dp) => {
            dp.clear();
            if (hiddenInput && hiddenInput.value !== '') {
              hiddenInput.value = '';
              syncAllLinkedDatepickers();
              hiddenInput.dispatchEvent(new Event('change', { bubbles: true }));
            }
            dp.hide();
          }
        }],
        onSelect: ({ date, formattedDate }) => {
          if (!hiddenInput) return;
          if (date) {
            const d = Array.isArray(date) ? date[0] : date;
            const yyyy = d.getFullYear();
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            const newVal = `${yyyy}-${mm}-${dd}`;
            
            // Solo si el valor realmente cambió disparamos el cambio (evita bucles infinitos en re-render)
            if (hiddenInput.value !== newVal) {
              hiddenInput.value = newVal;
              displayInput.value = formattedDate || `${dd.toString().padStart(2,'0')}/${mm}/${yyyy}`;
              syncAllLinkedDatepickers();
              hiddenInput.dispatchEvent(new Event('change', { bubbles: true }));
            }
          } else {
            if (hiddenInput.value !== '') {
              hiddenInput.value = '';
              displayInput.value = '';
              syncAllLinkedDatepickers();
              hiddenInput.dispatchEvent(new Event('change', { bubbles: true }));
            }
          }
        }
      };

      if (locale) adpOptions.locale = locale;
      if (minDate) adpOptions.minDate = minDate;
      if (maxDate) adpOptions.maxDate = maxDate;

      // Pre-seleccionar fecha parseando a Date local
      if (hiddenInput && hiddenInput.value && hiddenInput.value.length === 10) {
        const parts = hiddenInput.value.split('-').map(Number);
        if (parts.length === 3 && !parts.some(isNaN)) {
          adpOptions.selectedDates = [new Date(parts[0], parts[1] - 1, parts[2])];
          // Forzar que el display text muestre la fecha seleccionada al inicializar
          const dd = String(parts[2]).padStart(2, '0');
          const mm = String(parts[1]).padStart(2, '0');
          displayInput.value = `${dd}/${mm}/${parts[0]}`;
        }
      }

      const dp = new AirDatepicker(displayInput, adpOptions);
      displayInput._airDatepicker = dp;

      // Evento click al input display para asegurar que abra el calendario
      displayInput.addEventListener('click', (e) => {
        e.stopPropagation();
        dp.show();
      });

      // Botón del ícono de calendario: toggle del picker
      const triggerBtn = displayInput.parentElement
        ? displayInput.parentElement.querySelector(`[data-datepicker-trigger="${hiddenInputId}"], [data-flatpickr-trigger="${hiddenInputId}"]`)
        : null;
      if (triggerBtn) {
        const newBtn = triggerBtn.cloneNode(true);
        triggerBtn.parentNode.replaceChild(newBtn, triggerBtn);
        newBtn.addEventListener('click', (e) => { e.stopPropagation(); dp.show(); });
      }
    } catch (e) {
      console.error(`[DatePicker] Error al inicializar para el elemento:`, displayInput, e);
    }
  });

  // 4. Sincronizar dinámicamente los límites cruzados (minDate / maxDate) entre pares de fecha
  syncAllLinkedDatepickers();
}

/**
 * Sincroniza dinámicamente los límites minDate y maxDate entre un selector de Fecha Inicio y Fecha Término.
 * Deshabilita en tiempo real las fechas inválidas en el calendario compañero sin destruir ni re-renderizar los inputs.
 */
function syncLinkedDatepickers(startId, endId) {
  const startHidden = document.getElementById(startId);
  const endHidden = document.getElementById(endId);
  const startDisplay = document.getElementById(`${startId}-display`);
  const endDisplay = document.getElementById(`${endId}-display`);

  if (!startDisplay || !endDisplay) return;

  const dpStart = startDisplay._airDatepicker;
  const dpEnd = endDisplay._airDatepicker;

  let startDate = undefined;
  if (startHidden && startHidden.value && startHidden.value.length === 10) {
    const parts = startHidden.value.split('-').map(Number);
    if (parts.length === 3 && !parts.some(isNaN)) {
      startDate = new Date(parts[0], parts[1] - 1, parts[2]);
    }
  }

  let endDate = undefined;
  if (endHidden && endHidden.value && endHidden.value.length === 10) {
    const parts = endHidden.value.split('-').map(Number);
    if (parts.length === 3 && !parts.some(isNaN)) {
      endDate = new Date(parts[0], parts[1] - 1, parts[2]);
    }
  }

  const minValStart = startHidden ? startHidden.getAttribute('min') : null;
  const minDateBase = minValStart ? new Date(minValStart.split('-')[0], minValStart.split('-')[1] - 1, minValStart.split('-')[2]) : undefined;
  
  const maxValEnd = endHidden ? endHidden.getAttribute('max') : null;
  const maxDateBase = maxValEnd ? new Date(maxValEnd.split('-')[0], maxValEnd.split('-')[1] - 1, maxValEnd.split('-')[2]) : undefined;

  if (dpStart) {
    dpStart.update({
      minDate: minDateBase,
      maxDate: endDate || maxDateBase
    });
  }
  if (dpEnd) {
    dpEnd.update({
      minDate: startDate || minDateBase,
      maxDate: maxDateBase
    });
  }
}

/**
 * Aplica la sincronización cruzada a todos los módulos con rangos de fecha activos.
 */
function syncAllLinkedDatepickers() {
  syncLinkedDatepickers('filter-sujetos-fechadesde', 'filter-sujetos-fechahasta');
  syncLinkedDatepickers('report-filter-fechainicio', 'report-filter-fechatermino');
  syncLinkedDatepickers('dashboard-filter-fechainicio', 'dashboard-filter-fechatermino');
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

// Cerrar modal con animación de salida suave
function closeModal() {
  const modal = document.getElementById('modal-container');
  if (modal && !modal.classList.contains('hidden')) {
    const card = modal.querySelector('.glass-card');
    if (card) {
      card.classList.remove('modal-animate-in');
      card.classList.add('modal-animate-out');
      modal.classList.add('backdrop-animate-out');
      setTimeout(() => {
        modal.classList.add('hidden');
        modal.classList.remove('backdrop-animate-out');
        modal.innerHTML = '';
      }, 130);
    } else {
      modal.classList.add('hidden');
      modal.innerHTML = '';
    }
  }
}
window.closeModal = closeModal;

// Cerrar modal al presionar Escape o al hacer clic fuera del contenido
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const modal = document.getElementById('modal-container');
    if (modal && !modal.classList.contains('hidden')) {
      closeModal();
    }
  }
});

document.addEventListener('click', (e) => {
  const modal = document.getElementById('modal-container');
  if (modal && !modal.classList.contains('hidden') && e.target === modal) {
    closeModal();
  }
});

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
  modal.classList.add('backdrop-animate-in');

  modal.innerHTML = `
    <div class="glass-card w-full max-w-md p-6 rounded-3xl space-y-5 shadow-2xl relative modal-animate-in border border-border-ui">
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
    <button id="alerts-toggle-btn" onclick="toggleAlertsDropdown(event)" class="relative h-8 w-8 rounded-xl flex items-center justify-center border border-border-ui hover:border-border-ui bg-bg-main text-text-secondary hover:text-text-primary transition-all duration-200" title="Alertas de Plazos">
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
          <div class="p-2.5 rounded-xl border border-[var(--border-ui)] border-l-4 ${ w.color === 'red' ? 'border-l-rose-500 bg-rose-500/[0.03] dark:bg-rose-950/10' : w.color === 'blue' ? 'border-l-blue-500 bg-blue-500/[0.03] dark:bg-blue-950/10' : 'border-l-amber-500 bg-amber-500/[0.03] dark:bg-amber-950/10' } hover:bg-border-ui dark:hover:bg-border-ui/20 transition-colors flex gap-2.5 items-start text-left relative group">
            <span class="flex h-2 w-2 rounded-full mt-1.5 shrink-0 ${ w.color === 'red' ? 'bg-rose-500 shadow-[0_0_8px_rgba(239,68,68,0.5)] animate-pulse' : w.color === 'blue' ? 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)] animate-pulse' : 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]' }"></span>
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
          <input type="text" id="user-nombre" value="${user.nombre}" required class="w-full px-3 py-2 rounded-xl text-xs glass-input text-text-secondary placeholder:text-text-tertiary">
        </div>

        <div class="space-y-1">
          <label class="text-[10px] font-bold text-body-muted uppercase">RUT</label>
          <input type="text" id="user-rut" value="${user.rut || ''}" placeholder="12.345.678-9" class="w-full px-3 py-2 rounded-xl text-xs glass-input text-text-secondary placeholder:text-text-tertiary">
        </div>

        <div class="space-y-1">
          <label class="text-[10px] font-bold text-body-muted uppercase">Correo Electrónico</label>
          <input type="email" id="user-correo" value="${user.correo}" required placeholder="ejemplo@correo.com" ${isEdit ? 'readonly class="w-full px-3 py-2 rounded-xl text-xs glass-input glass-input-disabled cursor-not-allowed"' : 'class="w-full px-3 py-2 rounded-xl text-xs glass-input text-text-secondary placeholder:text-text-tertiary"'}>
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
  const asistido_rut = rol === 'Asistente técnico' ? document.getElementById('user-asistido-rut').value : '';

  const isEdit = id !== null;
  const url = isEdit ? `/api/usuarios/${id}` : '/api/usuarios';
  const method = isEdit ? 'PUT' : 'POST';

  const bodyData = { nombre, correo, rol, rut, asistido_rut };

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

function confirmarSincronizacionUsuarios(btn) {
  openConfirmModal(
    'Sincronizar Usuarios',
    '¿Está seguro de que desea subir y sincronizar la base de datos de usuarios actual con SharePoint? Esto actualizará la versión compartida para todos los computadores de la red.',
    () => {
      sincronizarUsuariosASharepoint(btn);
    }
  );
}

async function sincronizarUsuariosASharepoint(btn) {
  if (!btn) return;
  const originalHtml = btn.innerHTML;
  btn.disabled = true;
  btn.classList.add('opacity-60', 'cursor-not-allowed');
  btn.innerHTML = `<i data-lucide="refresh-cw" class="h-4 w-4 animate-spin shrink-0"></i> <span>Sincronizando...</span>`;
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }

  try {
    const res = await fetch('/api/admin/sincronizar-usuarios-sharepoint', { method: 'POST' });
    const data = await res.json();

    if (res.ok && data.success) {
      showToast(data.message || 'Usuarios sincronizados con SharePoint correctamente.', 'success');
      fetchAndUpdateDbTimestamp();
    } else {
      showToast(data.error || 'Error al sincronizar usuarios.', 'error');
    }
  } catch (err) {
    console.error('Error al sincronizar usuarios:', err);
    showToast('Error de red al conectar con el servidor', 'error');
  } finally {
    btn.disabled = false;
    btn.classList.remove('opacity-60', 'cursor-not-allowed');
    btn.innerHTML = originalHtml;
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
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
                 class="w-full px-3 py-2 rounded-xl text-xs glass-input ${isAdmin ? 'text-text-secondary placeholder:text-text-tertiary' : 'glass-input-disabled cursor-not-allowed'}">
        </div>

        <!-- RUT -->
        <div class="space-y-1">
          <label class="text-[10px] font-bold text-body-muted uppercase">RUT</label>
          <input type="text" id="profile-rut" value="${currentUser.rut || ''}" placeholder="12.345.678-9"
                 ${isAdmin ? '' : 'readonly'} 
                 class="w-full px-3 py-2 rounded-xl text-xs glass-input ${isAdmin ? 'text-text-secondary placeholder:text-text-tertiary' : 'glass-input-disabled cursor-not-allowed'}">
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
                 class="w-full px-3 py-2 rounded-xl text-xs glass-input text-text-secondary placeholder:text-text-tertiary">
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
  const bodyData = { correo };
  
  if (currentUser.rol === 'Administrador') {
    bodyData.nombre = nombre;
    bodyData.rut = rut;
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
  if (target.dataset.component === 'search-input') {
    if (target.dataset.autocomplete === 'true') {
      const fieldName = target.dataset.field;
      showDashboardSuggestions(fieldName);
    }
    
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
        cargoInput.classList.remove('text-text-secondary');
        cargoInput.value = '';
      }
    }
    
    if (fieldName === 'anio') {
      filters.fechaInicio = '';
      filters.fechaTermino = '';
      const mainEl = document.getElementById('main-content');
      if (mainEl) mainEl.innerHTML = '';
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

// 5. Eventos de Blur/Desenfoque (Ocultar sugerencias)
document.addEventListener('blur', (e) => {
  const target = e.target;
  if (target.dataset.component === 'search-input' && target.dataset.autocomplete === 'true') {
    const fieldName = target.dataset.field;
    hideDashboardSuggestions(fieldName);
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
  const isSujetos = currentView === 'sujetos_pasivos' || (currentView === 'administracion' && typeof activeAdminTab !== 'undefined' && activeAdminTab === 'sujetos');
  
  if (target.dataset.component === 'select-input') {
    const fieldName = target.dataset.field;
    if (isSujetos && fieldName === 'tipoFecha') {
      window.changeSujetosTipoFecha(target.value);
    } else {
      handleMultiFilter(currentView, fieldName, target.value);
    }
  } else if (target.dataset.component === 'date-input') {
    // Actualizamos el estado interno siempre.
    // Si la fecha ya está completa (YYYY-MM-DD = 10 chars) o fue vaciada,
    // re-renderizamos inmediatamente (ej: selección desde calendario nativo / Air Datepicker).
    // El blur también dispara el render como respaldo para escritura manual.
    const fieldName = target.dataset.field;
    const value = target.value;
    const isComplete = value === '' || value.length === 10;
    if (currentView === 'dashboard') {
      dashboardFilters[fieldName] = value;
      if (isComplete) renderView();
    } else if (currentView === 'reportes' || (currentView === 'administracion' && typeof activeAdminTab !== 'undefined' && activeAdminTab === 'reportes')) {
      if (fieldName === 'fechaInicio') reportesFilters.fechaInicio = value;
      else if (fieldName === 'fechaTermino') reportesFilters.fechaTermino = value;
      if (isComplete) debouncedReportesRender();
    } else if (isSujetos) {
      if (fieldName === 'fechaDesde') paginationState.sujetos_pasivos.fechaDesde = value;
      else if (fieldName === 'fechaHasta') paginationState.sujetos_pasivos.fechaHasta = value;
      paginationState.sujetos_pasivos.page = 1;
      if (isComplete) renderView();
    }
  } else if (target.classList.contains('report-estado-checkbox')) {
    updateReporteEstadoPillStyle(target);
    const estado = target.getAttribute('data-estado');
    handleReportesEstadoToggle(estado, target.checked);
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

// Función para generar un código local de reporte PDF (RAP-YYMMDD)
function generateLocalReportCode() {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `RAP${yy}${mm}${dd}`;
}

// Función compartida para construir el HTML de impresión PDF oficial del Municipio
function buildReportPDFHtml({ processedData, filtersSnapshot, sujetoPasivoNombre, sujetoPasivoCargo, codigoReporte = '' }) {
  const isOverdueItem = (item) => {
    const mainCode = (item.plazo || '').split(' ')[0].toUpperCase();
    return mainCode === 'FDP' || mainCode === 'RFP';
  };
  const isFdpItem = (item) => (item.plazo || '').split(' ')[0].toUpperCase() === 'FDP';
  const isDdpItem = (item) => (item.plazo || '').split(' ')[0].toUpperCase() === 'DDP';

  const totalItems = processedData.length;
  const overdueCount = processedData.filter(isFdpItem).length;
  const compliantCount = processedData.filter(isDdpItem).length;

  // Contadores por los 7 ESTADOS INDIVIDUALES
  const countIngresada = processedData.filter(i => (i.estado || '').toLowerCase() === 'ingresada').length;
  const countAceptada = processedData.filter(i => (i.estado || '').toLowerCase() === 'aceptada').length;
  const countRechazada = processedData.filter(i => (i.estado || '').toLowerCase() === 'rechazada').length;
  const countPendientePub = processedData.filter(i => (i.estado || '').toLowerCase() === 'pendiente de publicación').length;
  const countSuspendida = processedData.filter(i => (i.estado || '').toLowerCase() === 'suspendida').length;
  const countCancelada = processedData.filter(i => (i.estado || '').toLowerCase() === 'cancelada').length;
  const countEncomendada = processedData.filter(i => (i.estado || '').toLowerCase() === 'encomendada').length;

  const rowsArray = processedData.map((item, idx) => {
    let stateColor = '#334155';
    let stateBg = '#f8fafc';
    let stateBorder = '#e2e8f0';
    const stateLower = (item.estado || '').toLowerCase();
    
    if (stateLower === 'ingresada') {
      stateColor = '#475569'; stateBg = '#f8fafc'; stateBorder = '#e2e8f0';
    } else if (stateLower === 'aceptada') {
      stateColor = '#0369a1'; stateBg = '#f0f9ff'; stateBorder = '#bae6fd';
    } else if (stateLower === 'pendiente de publicación') {
      stateColor = '#5b21b6'; stateBg = '#f5f3ff'; stateBorder = '#ddd6fe';
    } else if (stateLower === 'rechazada') {
      stateColor = '#be123c'; stateBg = '#fff1f2'; stateBorder = '#fecdd3';
    } else if (stateLower === 'suspendida') {
      stateColor = '#b45309'; stateBg = '#fef3c7'; stateBorder = '#fde68a';
    } else if (stateLower === 'cancelada') {
      stateColor = '#c2410c'; stateBg = '#fff7ed'; stateBorder = '#ffedd5';
    } else if (stateLower === 'encomendada') {
      stateColor = '#86198f'; stateBg = '#fdf4ff'; stateBorder = '#f5d0fe';
    }

    const isOverdue = isOverdueItem(item);
    const plazoColor = isOverdue ? '#be123c' : '#166534';
    const plazoBg   = isOverdue ? '#fff1f2' : '#f0fdf4';
    const plazoBorder = isOverdue ? '#fecdd3' : '#bbf7d0';

    const plazoStr = item.plazo || '';
    const hasDays = plazoStr.includes('(') && plazoStr.includes(')');
    let mainCode = plazoStr || '—';
    let days = '';
    if (hasDays) {
      const parts = plazoStr.split(' ');
      mainCode = parts[0] || '—';
      days = (parts[1] || '').replace(/[()]/g, '');
    }

    const showTwoLine = hasDays && (mainCode === 'FDP' || mainCode === 'RFP');
    const plazoBadgeHtml = showTwoLine
      ? `<span style="display: inline-block; padding: 3px 6px; border: 1px solid ${plazoBorder}; border-radius: 6px; font-size: 7px; font-weight: 800; color: ${plazoColor}; background: ${plazoBg}; text-align: center; min-width: 42px; line-height: 1.3; white-space: normal;">${mainCode}<br><span style="font-size: 6px; font-weight: 500;">${days}</span></span>`
      : `<span style="display: inline-block; padding: 3px 6px; border: 1px solid ${plazoBorder}; border-radius: 6px; font-size: 7px; font-weight: 800; color: ${plazoColor}; background: ${plazoBg}; text-align: center; min-width: 42px; line-height: 1.3; text-transform: uppercase; white-space: nowrap;">${mainCode}</span>`;

    const rowBg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';

    return `
      <tr style="border-bottom: 1px solid #e2e8f0; font-size: 7.5px; background: ${rowBg};">
        <td style="padding: 8px 10px; font-weight: 600; color: #64748b; border-bottom: 1px solid #e2e8f0;">${item.index}</td>
        <td style="padding: 8px 10px; font-weight: 700; color: #0f172a; font-family: monospace; border-bottom: 1px solid #e2e8f0;">${item.folio}</td>
        <td style="padding: 8px 10px; color: #1e293b; font-weight: 500; border-bottom: 1px solid #e2e8f0; line-height: 1.3;">${item.cargo}</td>
        <td style="padding: 8px 10px; color: #475569; border-bottom: 1px solid #e2e8f0; line-height: 1.3;">
          <div style="font-weight: 600; color: #334155;">${item.fechaIngreso}</div>
          ${item.fechaLimiteRespuesta ? `<div style="font-size: 6.5px; color: #94a3b8; margin-top: 1px;">${item.fechaLimiteRespuesta}</div>` : ''}
        </td>
        <td style="padding: 8px 10px; color: #475569; border-bottom: 1px solid #e2e8f0; line-height: 1.3;">
          <div style="font-weight: 600; color: #334155;">${item.fechaAgendada}</div>
          ${item.fechaLimitePublicacion ? `<div style="font-size: 6.5px; color: #94a3b8; margin-top: 1px;">${item.fechaLimitePublicacion}</div>` : ''}
        </td>
        <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0; vertical-align: middle;">
          ${item.estado === 'Pendiente de publicación'
            ? `<span style="display: inline-block; padding: 3px 6px; border: 1px solid ${stateBorder}; border-radius: 6px; font-size: 6.5px; font-weight: 700; color: ${stateColor}; background: ${stateBg}; text-align: center; line-height: 1.2;">PENDIENTE DE PUBLICACIÓN</span>`
            : `<span style="display: inline-block; padding: 3px 6px; border: 1px solid ${stateBorder}; border-radius: 6px; font-size: 6.5px; font-weight: 700; color: ${stateColor}; background: ${stateBg}; text-transform: uppercase; white-space: nowrap; line-height: 1.2;">${item.estado}</span>`
          }
        </td>
        <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0; vertical-align: middle;">
          ${plazoBadgeHtml}
        </td>
      </tr>
    `;
  });

  const rfechas = `${filtersSnapshot.fechaInicio ? `Desde: ${filtersSnapshot.fechaInicio}` : ''} ${filtersSnapshot.fechaTermino ? `Hasta: ${filtersSnapshot.fechaTermino}` : ''}`;
  const rfechasStr = rfechas.trim() !== '' ? rfechas : 'Cualquier fecha';
  const generadoFechaHora = new Date().toLocaleString('es-CL', { timeZone: 'America/Santiago', hour12: false });
  const displayNombre = sujetoPasivoNombre || normalizeName(filtersSnapshot.nombre) || 'Todos los Sujetos Pasivos';
  const displayCargo = sujetoPasivoCargo || filtersSnapshot.cargo || 'Todos los Cargos';

  return `
    <style>
      @page {
        size: portrait;
        margin-top: 22mm;
        margin-bottom: 20mm;
        margin-left: 15mm;
        margin-right: 15mm;
        
        @top-left {
          content: "Reporte de Solicitudes de Audiencia (Ley N° 20.730 de Lobby) — Sujeto Pasivo: ${displayNombre}";
          font-family: 'Inter', sans-serif;
          font-size: 8px;
          font-weight: 800;
          color: #0f172a;
          padding-bottom: 6px;
          border-bottom: 1.5px solid #334155;
        }
        @top-right {
          content: "Generado el ${generadoFechaHora}";
          font-family: monospace;
          font-size: 7.5px;
          font-weight: 700;
          color: #64748b;
          padding-bottom: 6px;
          border-bottom: 1.5px solid #334155;
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
    </style>
    <div style="font-family: 'Inter', sans-serif;">
      <div class="municipal-header-p1" style="border-bottom: 2px solid #334155; padding-bottom: 14px; margin-bottom: 16px;">
        <table style="width: 100%; border-collapse: collapse; border: none;">
          <tr>
            <td style="vertical-align: middle; text-align: left; border: none; padding: 0;">
              <table style="border-collapse: collapse; border: none;">
                <tr>
                  <td style="padding-right: 14px; vertical-align: middle; border: none;">
                    <img src="/logo_secum.png" style="height: 46px; max-height: 46px; width: auto; object-fit: contain; display: block;" />
                  </td>
                  <td style="vertical-align: middle; border: none;">
                    <div style="font-size: 14px; font-weight: 800; color: #0f172a; letter-spacing: -0.02em; line-height: 1.2;">Reporte de Solicitudes de Audiencia</div>
                    <div style="font-size: 9px; font-weight: 600; color: #64748b; margin-top: 2px; line-height: 1.2;">Audiencias registradas bajo la Ley N° 20.730 de Lobby</div>
                  </td>
                </tr>
              </table>
            </td>
            <td style="vertical-align: middle; text-align: right; border: none; padding: 0;">
              <div style="font-size: 9px; font-weight: 700; color: #475569; font-family: monospace;">${generadoFechaHora}</div>
            </td>
          </tr>
        </table>
      </div>

      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; margin-bottom: 15px; box-sizing: border-box; width: 100%;">
        <div style="font-size: 12px; font-weight: 800; color: #1e3a8a; text-transform: uppercase; letter-spacing: -0.01em;">Sujeto Pasivo: ${displayNombre}</div>
        <div style="font-size: 10px; font-weight: 700; color: #475569; margin-top: 2px; text-transform: uppercase; letter-spacing: -0.01em;">Cargo: ${displayCargo}</div>
        <table style="width: 100%; border-collapse: collapse; font-size: 8.5px; color: #475569; margin-top: 6px;">
          <tr>
            <td style="padding: 0; border: none; width: 50%;"><strong>Período:</strong> ${rfechasStr}</td>
            <td style="padding: 0; border: none; width: 50%;"><strong>Estados:</strong> ${filtersSnapshot.estados.length > 0 ? filtersSnapshot.estados.join(', ') : 'Todos'}</td>
          </tr>
        </table>
      </div>

      <table style="width: 100%; border-collapse: collapse; margin-bottom: 8px;">
        <tr>
          <td style="width: 33.3%; padding-right: 8px; border: none;">
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; text-align: left; box-sizing: border-box; position: relative; overflow: hidden;">
              <div style="font-size: 7.5px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.05em;">Total de Audiencias</div>
              <div style="font-size: 20px; font-weight: 800; color: #0f172a; margin-top: 2px;">${totalItems}</div>
              <div style="position: absolute; right: 10px; bottom: 4px; font-size: 20px; color: #cbd5e1; font-weight: 900; line-height: 1; user-select: none;">#</div>
            </div>
          </td>
          <td style="width: 33.3%; padding-left: 4px; padding-right: 4px; border: none;">
            <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 10px; text-align: left; box-sizing: border-box; position: relative; overflow: hidden;">
              <div style="font-size: 7.5px; font-weight: 700; color: #166534; text-transform: uppercase; letter-spacing: 0.05em;">Dentro de Plazo</div>
              <div style="font-size: 20px; font-weight: 800; color: #14532d; margin-top: 2px;">${compliantCount}</div>
              <div style="position: absolute; right: 10px; bottom: 4px; font-size: 20px; color: #bbf7d0; font-weight: 900; line-height: 1; user-select: none;">&#10003;</div>
            </div>
          </td>
          <td style="width: 33.3%; padding-left: 8px; border: none;">
            <div style="background: #fff1f2; border: 1px solid #fecdd3; border-radius: 8px; padding: 10px; text-align: left; box-sizing: border-box; position: relative; overflow: hidden;">
              <div style="font-size: 7.5px; font-weight: 700; color: #be123c; text-transform: uppercase; letter-spacing: 0.05em;">Fuera de Plazo</div>
              <div style="font-size: 20px; font-weight: 800; color: #9f1239; margin-top: 2px;">${overdueCount}</div>
              <div style="position: absolute; right: 10px; bottom: 4px; font-size: 20px; color: #fecdd3; font-weight: 900; line-height: 1; user-select: none;">!</div>
            </div>
          </td>
        </tr>
      </table>

      <table style="width: 100%; border-collapse: collapse; margin-bottom: 15px;">
        <tr>
          <td style="width: 14.28%; padding-right: 4px; border: none;">
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 6px 8px; box-sizing: border-box;">
              <div style="font-size: 6px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.03em;">Ingresadas</div>
              <div style="font-size: 14px; font-weight: 800; color: #334155; margin-top: 1px;">${countIngresada}</div>
            </div>
          </td>
          <td style="width: 14.28%; padding-right: 4px; border: none;">
            <div style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 6px 8px; box-sizing: border-box;">
              <div style="font-size: 6px; font-weight: 700; color: #0369a1; text-transform: uppercase; letter-spacing: 0.03em;">Aceptadas</div>
              <div style="font-size: 14px; font-weight: 800; color: #075985; margin-top: 1px;">${countAceptada}</div>
            </div>
          </td>
          <td style="width: 14.28%; padding-right: 4px; border: none;">
            <div style="background: #fff1f2; border: 1px solid #fecdd3; border-radius: 8px; padding: 6px 8px; box-sizing: border-box;">
              <div style="font-size: 6px; font-weight: 700; color: #be123c; text-transform: uppercase; letter-spacing: 0.03em;">Rechazadas</div>
              <div style="font-size: 14px; font-weight: 800; color: #9f1239; margin-top: 1px;">${countRechazada}</div>
            </div>
          </td>
          <td style="width: 14.28%; padding-right: 4px; border: none;">
            <div style="background: #f5f3ff; border: 1px solid #ddd6fe; border-radius: 8px; padding: 6px 8px; box-sizing: border-box;">
              <div style="font-size: 6px; font-weight: 700; color: #5b21b6; text-transform: uppercase; letter-spacing: 0.03em;">Pend. Pub.</div>
              <div style="font-size: 14px; font-weight: 800; color: #4c1d95; margin-top: 1px;">${countPendientePub}</div>
            </div>
          </td>
          <td style="width: 14.28%; padding-right: 4px; border: none;">
            <div style="background: #fef3c7; border: 1px solid #fde68a; border-radius: 8px; padding: 6px 8px; box-sizing: border-box;">
              <div style="font-size: 6px; font-weight: 700; color: #b45309; text-transform: uppercase; letter-spacing: 0.03em;">Suspendidas</div>
              <div style="font-size: 14px; font-weight: 800; color: #92400e; margin-top: 1px;">${countSuspendida}</div>
            </div>
          </td>
          <td style="width: 14.28%; padding-right: 4px; border: none;">
            <div style="background: #fff7ed; border: 1px solid #ffedd5; border-radius: 8px; padding: 6px 8px; box-sizing: border-box;">
              <div style="font-size: 6px; font-weight: 700; color: #c2410c; text-transform: uppercase; letter-spacing: 0.03em;">Canceladas</div>
              <div style="font-size: 14px; font-weight: 800; color: #9a3412; margin-top: 1px;">${countCancelada}</div>
            </div>
          </td>
          <td style="width: 14.28%; border: none;">
            <div style="background: #fdf4ff; border: 1px solid #f5d0fe; border-radius: 8px; padding: 6px 8px; box-sizing: border-box;">
              <div style="font-size: 6px; font-weight: 700; color: #86198f; text-transform: uppercase; letter-spacing: 0.03em;">Encomend.</div>
              <div style="font-size: 14px; font-weight: 800; color: #701a75; margin-top: 1px;">${countEncomendada}</div>
            </div>
          </td>
        </tr>
      </table>

      <div style="border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; background: white; width: 100%;">
        <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 7.5px;">
          <thead>
            <tr style="background: #f8fafc; border-bottom: 1px solid #e2e8f0; color: #475569; font-weight: 700; font-size: 7.5px;">
              <th style="padding: 10px; width: 30px; border-bottom: 1px solid #e2e8f0;">#</th>
              <th style="padding: 10px; width: 95px; border-bottom: 1px solid #e2e8f0;">Folio</th>
              <th style="padding: 10px; border-bottom: 1px solid #e2e8f0;">Cargo</th>
              <th style="padding: 10px; width: 110px; border-bottom: 1px solid #e2e8f0; vertical-align: bottom;">
                <div style="font-size: 7.5px; font-weight: 800; color: #0f172a; text-transform: uppercase;">Fecha Ingreso</div>
                <div style="font-size: 6.5px; font-weight: 500; color: #64748b; margin-top: 1px; text-transform: uppercase;">Plazo Respuesta</div>
              </th>
              <th style="padding: 10px; width: 110px; border-bottom: 1px solid #e2e8f0; vertical-align: bottom;">
                <div style="font-size: 7.5px; font-weight: 800; color: #0f172a; text-transform: uppercase;">Fecha Agenda</div>
                <div style="font-size: 6.5px; font-weight: 500; color: #64748b; margin-top: 1px; text-transform: uppercase;">Plazo Publicación</div>
              </th>
              <th style="padding: 10px; width: 100px; border-bottom: 1px solid #e2e8f0;">Estado</th>
              <th style="padding: 10px; width: 75px; border-bottom: 1px solid #e2e8f0;">Plazo / Retraso</th>
            </tr>
          </thead>
          <tbody>
            ${rowsArray.join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// Función para exportar el reporte actual a un archivo PDF (Orientación Vertical - Portrait) usando impresión nativa del navegador
async function exportReportToPDF() {
  if (!dataStore.reportesRawData || dataStore.reportesRawData.length === 0) {
    showToast('No hay datos para exportar.', 'error');
    return;
  }

  showToast('Preparando vista de impresión...');

  const codigoReporte = generateLocalReportCode();
  const filtersSnapshot = {
    nombre: reportesFilters.nombre || '',
    cargo: reportesFilters.cargo || '',
    fechaInicio: reportesFilters.fechaInicio || '',
    fechaTermino: reportesFilters.fechaTermino || '',
    estados: [...(reportesFilters.estados || [])],
    vigencia: reportesFilters.vigencia || 'todos',
    soloVigentes: !!reportesFilters.soloVigentes
  };

  try {
    const processedData = processReportData(dataStore.reportesRawData, filtersSnapshot);
    if (processedData.length === 0) {
      showToast('No hay registros coincidentes para exportar.', 'error');
      return;
    }

    const htmlContent = buildReportPDFHtml({ processedData, filtersSnapshot, codigoReporte });
    const cargoAbbr = getCargoAbbreviated(filtersSnapshot.cargo || 'TODOS');
    const sanitizedNombre = sanitizeNombreForFilename(filtersSnapshot.nombre || 'Todos');
    const defaultName = `${codigoReporte}_${cargoAbbr}_${sanitizedNombre}.pdf`;

    const saveResult = await window.api.selectSavePath({ defaultName });
    if (saveResult.cancelled || !saveResult.filePath) {
      showToast('Guardado de reporte cancelado.', 'info');
      return;
    }

    showToast('Generando reporte PDF...');
    const silentResult = await window.api.generateSilentPdf({
      html: htmlContent,
      filePath: saveResult.filePath,
      title: `${codigoReporte} - ${displayNombre}`
    });

    if (silentResult && silentResult.success) {
      showToast(`Reporte ${codigoReporte} guardado correctamente.`, 'success');
      window.api.invokeRoute({
        url: '/api/log',
        method: 'POST',
        body: {
          code: 'INFO-REP-501',
          message: 'Reporte PDF generado (Individual)',
          details: `Archivo: ${defaultName} | Destino: ${saveResult.filePath} | Por: ${currentUser ? currentUser.correo : 'Desconocido'}`,
          severity: 'info'
        }
      }).catch(err => console.error('Error al registrar log de reporte:', err));
    } else {
      showToast('No se pudo generar el archivo PDF.', 'error');
    }
  } catch (err) {
    console.error('Error al exportar reporte a PDF:', err);
    showToast('Error al generar el reporte PDF.', 'error');
  }
}

// Función para exportar la selección de reportes directamente a Excel (.xlsx)
async function exportReportToExcel() {
  if (!dataStore.reportesRawData || dataStore.reportesRawData.length === 0) {
    showToast('No hay datos para exportar.', 'error');
    return;
  }

  showToast('Generando planilla Excel...');

  const filtersSnapshot = {
    nombre: reportesFilters.nombre || '',
    cargo: reportesFilters.cargo || '',
    fechaInicio: reportesFilters.fechaInicio || '',
    fechaTermino: reportesFilters.fechaTermino || '',
    estados: [...(reportesFilters.estados || [])],
    vigencia: reportesFilters.vigencia || 'todos',
    soloVigentes: !!reportesFilters.soloVigentes
  };

  const processedData = processReportData(dataStore.reportesRawData, filtersSnapshot);
  if (processedData.length === 0) {
    showToast('No hay registros coincidentes para exportar.', 'error');
    return;
  }

  const dateFormatted = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const hasSpecificNombre = filtersSnapshot.nombre && filtersSnapshot.nombre.toUpperCase() !== 'TODOS' && filtersSnapshot.nombre.trim() !== '';
  const sanitizedNombre = hasSpecificNombre ? sanitizeNombreForFilename(filtersSnapshot.nombre) : '';
  const fileName = sanitizedNombre
    ? `MU163-RAP${dateFormatted}_${sanitizedNombre}.xlsx`
    : `MU163-RAP${dateFormatted}.xlsx`;

  // Matriz exacta con las 12 columnas aprobadas
  const excelData = processedData.map((item) => {
    const isFdp = (item.plazo || '').split(' ')[0].toUpperCase() === 'FDP' || (item.plazo || '').toLowerCase().includes('fuera');
    const plazoText = (!item.plazo || item.plazo === '---') ? '---' : (isFdp ? 'Fuera de plazo' : 'En plazo');

    return {
      '# Correlativo': item.index,
      'Folio Lobby': item.folio,
      'Fecha Ingreso': item.fechaIngreso,
      'Fecha Agendada': item.fechaAgendada || '---',
      'Sujeto Pasivo': item.sujetoPasivo || normalizeName(filtersSnapshot.nombre) || '---',
      'Cargo': item.cargo,
      'Sujeto Activo / Gestor de Interés': item.sujetoActivo || '---',
      'Representado': item.representado || '---',
      'Materia': item.materia || '---',
      'Especificación de Materia': item.especificacionMateria || '---',
      'Estado': item.estado,
      'Plazo': plazoText
    };
  });

  try {
    const saveResult = await window.api.selectSavePath({
      title: 'Guardar Planilla Excel',
      defaultName: fileName,
      filters: [{ name: 'Planilla Excel', extensions: ['xlsx'] }]
    });

    if (saveResult.cancelled || !saveResult.filePath) {
      showToast('Guardado de Excel cancelado.', 'info');
      return;
    }

    const exportResult = await window.api.generateExcelFile({
      data: excelData,
      sheetName: 'Reporte Lobby',
      filePath: saveResult.filePath
    });

    if (exportResult && exportResult.success) {
      showToast(`Planilla Excel guardada exitosamente: ${fileName}`, 'success');

      window.api.invokeRoute({
        url: '/api/log',
        method: 'POST',
        body: {
          code: 'INFO-REP-502',
          message: 'Reporte Excel generado',
          details: `Archivo: ${fileName} | Destino: ${saveResult.filePath} | Por: ${currentUser ? currentUser.correo : 'Desconocido'}`,
          severity: 'info'
        }
      }).catch(err => console.error('Error al registrar log de Excel:', err));
    } else {
      showToast(`No se pudo generar la planilla Excel: ${exportResult ? exportResult.error : 'Error desconocido'}`, 'error');
    }
  } catch (err) {
    console.error('Error al exportar a Excel:', err);
    showToast(`Error al procesar exportación a Excel: ${err.message}`, 'error');
  }
}

// Función para generar el Reporte Ejecutivo PDF (Resumen Nominativo por Sujeto Pasivo)
async function exportReporteEjecutivoPDF() {
  if (!dataStore.reportesRawData || dataStore.reportesRawData.length === 0) {
    showToast('No hay datos para exportar.', 'error');
    return;
  }

  showToast('Generando Reporte Ejecutivo PDF...');

  const filtersSnapshot = {
    nombre: reportesFilters.nombre || '',
    cargo: reportesFilters.cargo || '',
    fechaInicio: reportesFilters.fechaInicio || '',
    fechaTermino: reportesFilters.fechaTermino || '',
    estados: [...(reportesFilters.estados || [])],
    vigencia: reportesFilters.vigencia || 'todos',
    soloVigentes: !!reportesFilters.soloVigentes
  };

  const processedData = processReportData(dataStore.reportesRawData, filtersSnapshot);
  if (processedData.length === 0) {
    showToast('No hay registros coincidentes para exportar.', 'error');
    return;
  }

  const isFdpItem = (item) => (item.plazo || '').split(' ')[0].toUpperCase() === 'FDP';
  const isDdpItem = (item) => (item.plazo || '').split(' ')[0].toUpperCase() === 'DDP';

  const totalItems = processedData.length;
  const compliantCount = processedData.filter(isDdpItem).length;
  const overdueCount = processedData.filter(isFdpItem).length;

  const publicadasArray = Array.isArray(dataStore.publicadas) ? dataStore.publicadas : (dataStore.publicadas?.data || []);
  const publicadosFolios = new Set(publicadasArray.map(p => p.folio_lobby).filter(Boolean));
  const publicadasCount = processedData.filter(i => publicadosFolios.has(i.folio_lobby)).length;

  const compliantPercent = totalItems > 0 ? ((compliantCount / totalItems) * 100).toFixed(1) : '0.0';
  const overduePercent = totalItems > 0 ? ((overdueCount / totalItems) * 100).toFixed(1) : '0.0';

  const sujetoGroups = {};
  processedData.forEach(item => {
    const name = (item.sujetoPasivo || item.sujeto_pasivo || 'Sin Nombre').trim();
    const cargo = (item.cargo || 'Sin Cargo').trim();
    const key = `${name}|||${cargo}`;
    if (!sujetoGroups[key]) {
      sujetoGroups[key] = {
        name,
        cargo,
        total: 0,
        ingresada: 0,
        aceptada: 0,
        rechazada: 0,
        suspendida: 0,
        cancelada: 0,
        encomendada: 0,
        pendientePub: 0,
        enPlazo: 0,
        fueraPlazo: 0
      };
    }

    const g = sujetoGroups[key];
    g.total += 1;

    const estLower = (item.estado || '').toLowerCase();
    if (estLower === 'ingresada') g.ingresada += 1;
    else if (estLower === 'aceptada') g.aceptada += 1;
    else if (estLower === 'rechazada') g.rechazada += 1;
    else if (estLower === 'suspendida') g.suspendida += 1;
    else if (estLower === 'cancelada') g.cancelada += 1;
    else if (estLower === 'encomendada') g.encomendada += 1;
    else if (estLower === 'pendiente de publicación') g.pendientePub += 1;

    if (isFdpItem(item)) g.fueraPlazo += 1;
    else g.enPlazo += 1;
  });

  const cargoPriorityOrder = ['ALC', 'CON', 'DOM', 'SECMUN', 'CE'];
  const sortedKeys = Object.keys(sujetoGroups).sort((keyA, keyB) => {
    const [nameA, cargoA] = keyA.split('|||');
    const [nameB, cargoB] = keyB.split('|||');

    const codeA = getCargoAbbreviated(cargoA);
    const codeB = getCargoAbbreviated(cargoB);

    const idxA = cargoPriorityOrder.indexOf(codeA);
    const idxB = cargoPriorityOrder.indexOf(codeB);

    const prioA = idxA !== -1 ? idxA : 999;
    const prioB = idxB !== -1 ? idxB : 999;

    if (prioA !== prioB) return prioA - prioB;
    if (codeA !== codeB) return codeA.localeCompare(codeB);
    return nameA.localeCompare(nameB);
  });

  let sumTotal = 0, sumIng = 0, sumAcep = 0, sumRech = 0, sumSusp = 0, sumCanc = 0, sumEnc = 0, sumPend = 0, sumDdp = 0, sumFdp = 0;

  const tableRowsHtml = sortedKeys.map((key, idx) => {
    const g = sujetoGroups[key];
    sumTotal += g.total;
    sumIng += g.ingresada;
    sumAcep += g.aceptada;
    sumRech += g.rechazada;
    sumSusp += g.suspendida;
    sumCanc += g.cancelada;
    sumEnc += g.encomendada;
    sumPend += g.pendientePub;
    sumDdp += g.enPlazo;
    sumFdp += g.fueraPlazo;

    const rowBg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
    const code = getCargoAbbreviated(g.cargo);

    return `
      <tr style="border-bottom: 1px solid #e2e8f0; font-size: 7.5px; background: ${rowBg};">
        <td style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0; vertical-align: middle;">
          <div style="font-size: 7.5px; font-weight: 700; color: #0f172a; line-height: 1.2;">${g.name}</div>
          <div style="font-size: 6.5px; font-weight: 600; color: #475569; margin-top: 1.5px; line-height: 1.2;">
            ${g.cargo} <span style="font-size: 6px; font-weight: 700; color: #64748b; background: #e2e8f0; padding: 1px 4px; border-radius: 3px; margin-left: 2px;">${code}</span>
          </div>
        </td>
        <td style="padding: 7px 8px; font-weight: 800; color: #0f172a; text-align: center; border-bottom: 1px solid #e2e8f0;">${g.total}</td>
        <td style="padding: 7px 8px; color: #475569; text-align: center; border-bottom: 1px solid #e2e8f0;">${g.ingresada}</td>
        <td style="padding: 7px 8px; color: #075985; text-align: center; border-bottom: 1px solid #e2e8f0;">${g.aceptada}</td>
        <td style="padding: 7px 8px; color: #be123c; text-align: center; border-bottom: 1px solid #e2e8f0;">${g.rechazada}</td>
        <td style="padding: 7px 8px; color: #b45309; text-align: center; border-bottom: 1px solid #e2e8f0;">${g.suspendida}</td>
        <td style="padding: 7px 8px; color: #c2410c; text-align: center; border-bottom: 1px solid #e2e8f0;">${g.cancelada}</td>
        <td style="padding: 7px 8px; color: #86198f; text-align: center; border-bottom: 1px solid #e2e8f0;">${g.encomendada}</td>
        <td style="padding: 7px 8px; color: #5b21b6; text-align: center; border-bottom: 1px solid #e2e8f0;">${g.pendientePub}</td>
        <td style="padding: 7px 8px; font-weight: 700; color: #166534; text-align: center; border-bottom: 1px solid #e2e8f0; background: #f0fdf4;">${g.enPlazo}</td>
        <td style="padding: 7px 8px; font-weight: 700; color: #be123c; text-align: center; border-bottom: 1px solid #e2e8f0; background: #fff1f2;">${g.fueraPlazo}</td>
      </tr>
    `;
  }).join('');

  const rfechas = `${filtersSnapshot.fechaInicio ? `Desde: ${filtersSnapshot.fechaInicio}` : ''} ${filtersSnapshot.fechaTermino ? `Hasta: ${filtersSnapshot.fechaTermino}` : ''}`;
  const rfechasStr = rfechas.trim() !== '' ? rfechas : 'Cualquier fecha';
  const generadoFechaHora = new Date().toLocaleString('es-CL', { timeZone: 'America/Santiago' });

  const htmlContent = `
    <style>
      @page {
        size: portrait;
        margin-top: 20mm;
        margin-bottom: 18mm;
        margin-left: 15mm;
        margin-right: 15mm;
        
        @top-left {
          content: "Reporte de Solicitudes de Audiencia (Ley N° 20.730 de Lobby) — Municipalidad de Maipú";
          font-family: 'Inter', sans-serif;
          font-size: 8px;
          font-weight: 800;
          color: #0f172a;
          padding-bottom: 6px;
          border-bottom: 1.5px solid #334155;
        }
        @top-right {
          content: "Generado el ${generadoFechaHora}";
          font-family: monospace;
          font-size: 7.5px;
          font-weight: 700;
          color: #64748b;
          padding-bottom: 6px;
          border-bottom: 1.5px solid #334155;
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
        margin-top: 14mm;
        @top-left { content: none; }
        @top-right { content: none; }
      }
    </style>
    <div style="font-family: 'Inter', sans-serif;">
      <div class="municipal-header-p1" style="border-bottom: 2px solid #334155; padding-bottom: 14px; margin-bottom: 16px;">
        <table style="width: 100%; border-collapse: collapse; border: none;">
          <tr>
            <td style="vertical-align: middle; text-align: left; border: none; padding: 0;">
              <table style="border-collapse: collapse; border: none;">
                <tr>
                  <td style="padding-right: 14px; vertical-align: middle; border: none;">
                    <img src="/logo_secum.png" style="height: 46px; max-height: 46px; width: auto; object-fit: contain; display: block;" />
                  </td>
                  <td style="vertical-align: middle; border: none;">
                    <div style="font-size: 14px; font-weight: 800; color: #0f172a; letter-spacing: -0.02em; line-height: 1.2;">Reporte de Solicitudes de Audiencia</div>
                    <div style="font-size: 9px; font-weight: 600; color: #64748b; margin-top: 2px; line-height: 1.2;">Audiencias registradas bajo la Ley N° 20.730 de Lobby</div>
                  </td>
                </tr>
              </table>
            </td>
            <td style="vertical-align: middle; text-align: right; border: none; padding: 0;">
              <div style="font-size: 9px; font-weight: 700; color: #475569; font-family: monospace;">${generadoFechaHora}</div>
            </td>
          </tr>
        </table>
      </div>

      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; margin-bottom: 12px; box-sizing: border-box; width: 100%;">
        <div style="font-size: 11px; font-weight: 800; color: #1e3a8a; text-transform: uppercase;">Período Evaluado: ${rfechasStr}</div>
        <div style="font-size: 8.5px; color: #475569; margin-top: 2px;">Filtros: ${filtersSnapshot.nombre ? `Sujeto: ${filtersSnapshot.nombre} | ` : ''}${filtersSnapshot.cargo ? `Cargo: ${filtersSnapshot.cargo} | ` : ''}Estados: ${filtersSnapshot.estados.length > 0 ? filtersSnapshot.estados.join(', ') : 'Todos'}</div>
      </div>

      <table style="width: 100%; border-collapse: collapse; margin-bottom: 12px;">
        <tr>
          <td style="width: 25%; padding-right: 6px; border: none;">
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 10px; text-align: left;">
              <div style="font-size: 7px; font-weight: 700; color: #475569; text-transform: uppercase;">Total Solicitudes</div>
              <div style="font-size: 18px; font-weight: 800; color: #0f172a; margin-top: 1px;">${totalItems}</div>
            </div>
          </td>
          <td style="width: 25%; padding-right: 6px; border: none;">
            <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 8px 10px; text-align: left;">
              <div style="font-size: 7px; font-weight: 700; color: #166534; text-transform: uppercase;">En Plazo Legal</div>
              <div style="font-size: 18px; font-weight: 800; color: #14532d; margin-top: 1px;">${compliantCount} <span style="font-size: 9px; font-weight: 600;">(${compliantPercent}%)</span></div>
            </div>
          </td>
          <td style="width: 25%; padding-right: 6px; border: none;">
            <div style="background: #fff1f2; border: 1px solid #fecdd3; border-radius: 8px; padding: 8px 10px; text-align: left;">
              <div style="font-size: 7px; font-weight: 700; color: #be123c; text-transform: uppercase;">Fuera de Plazo</div>
              <div style="font-size: 18px; font-weight: 800; color: #9f1239; margin-top: 1px;">${overdueCount} <span style="font-size: 9px; font-weight: 600;">(${overduePercent}%)</span></div>
            </div>
          </td>
          <td style="width: 25%; border: none;">
            <div style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 8px 10px; text-align: left;">
              <div style="font-size: 7px; font-weight: 700; color: #0369a1; text-transform: uppercase;">Audiencias Publicadas</div>
              <div style="font-size: 18px; font-weight: 800; color: #075985; margin-top: 1px;">${publicadasCount}</div>
            </div>
          </td>
        </tr>
      </table>

      <div style="font-size: 8.5px; font-weight: 800; color: #0f172a; text-transform: uppercase; margin-bottom: 6px;">Totales Municipales por Estado de Solicitud</div>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 12px;">
        <tr>
          <td style="width: 14.28%; padding-right: 3px; border: none;">
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 6px 4px; text-align: center;">
              <div style="font-size: 6.5px; font-weight: 700; color: #475569; text-transform: uppercase;">Ingresadas</div>
              <div style="font-size: 14px; font-weight: 800; color: #0f172a; margin-top: 1px;">${sumIng}</div>
            </div>
          </td>
          <td style="width: 14.28%; padding-left: 2px; padding-right: 3px; border: none;">
            <div style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 6px; padding: 6px 4px; text-align: center;">
              <div style="font-size: 6.5px; font-weight: 700; color: #0369a1; text-transform: uppercase;">Aceptadas</div>
              <div style="font-size: 14px; font-weight: 800; color: #075985; margin-top: 1px;">${sumAcep}</div>
            </div>
          </td>
          <td style="width: 14.28%; padding-left: 2px; padding-right: 3px; border: none;">
            <div style="background: #fff1f2; border: 1px solid #fecdd3; border-radius: 6px; padding: 6px 4px; text-align: center;">
              <div style="font-size: 6.5px; font-weight: 700; color: #be123c; text-transform: uppercase;">Rechazadas</div>
              <div style="font-size: 14px; font-weight: 800; color: #9f1239; margin-top: 1px;">${sumRech}</div>
            </div>
          </td>
          <td style="width: 14.28%; padding-left: 2px; padding-right: 3px; border: none;">
            <div style="background: #f5f3ff; border: 1px solid #ddd6fe; border-radius: 6px; padding: 6px 4px; text-align: center;">
              <div style="font-size: 6.5px; font-weight: 700; color: #6d28d9; text-transform: uppercase;">Pend. Pub.</div>
              <div style="font-size: 14px; font-weight: 800; color: #5b21b6; margin-top: 1px;">${sumPend}</div>
            </div>
          </td>
          <td style="width: 14.28%; padding-left: 2px; padding-right: 3px; border: none;">
            <div style="background: #fffbeb; border: 1px solid #fef3c7; border-radius: 6px; padding: 6px 4px; text-align: center;">
              <div style="font-size: 6.5px; font-weight: 700; color: #b45309; text-transform: uppercase;">Suspendidas</div>
              <div style="font-size: 14px; font-weight: 800; color: #92400e; margin-top: 1px;">${sumSusp}</div>
            </div>
          </td>
          <td style="width: 14.28%; padding-left: 2px; padding-right: 3px; border: none;">
            <div style="background: #fff7ed; border: 1px solid #ffedd5; border-radius: 6px; padding: 6px 4px; text-align: center;">
              <div style="font-size: 6.5px; font-weight: 700; color: #c2410c; text-transform: uppercase;">Canceladas</div>
              <div style="font-size: 14px; font-weight: 800; color: #9a3412; margin-top: 1px;">${sumCanc}</div>
            </div>
          </td>
          <td style="width: 14.28%; padding-left: 2px; border: none;">
            <div style="background: #fdf4ff; border: 1px solid #f5d0fe; border-radius: 6px; padding: 6px 4px; text-align: center;">
              <div style="font-size: 6.5px; font-weight: 700; color: #86198f; text-transform: uppercase;">Encomendadas</div>
              <div style="font-size: 14px; font-weight: 800; color: #701a75; margin-top: 1px;">${sumEnc}</div>
            </div>
          </td>
        </tr>
      </table>

      <div style="font-size: 8.5px; font-weight: 800; color: #0f172a; text-transform: uppercase; margin-bottom: 6px;">Resumen Nominativo por Sujeto Pasivo (Orden Jerárquico)</div>
      <div style="border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; background: white; width: 100%;">
        <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 7.5px;">
          <thead>
            <tr style="background: #f8fafc; border-bottom: 1px solid #e2e8f0; color: #475569; font-weight: 700; font-size: 7px; text-transform: uppercase;">
              <th style="padding: 8px; border-bottom: 1px solid #e2e8f0;">Sujeto Pasivo (Nombre y Cargo)</th>
              <th style="padding: 8px; width: 35px; text-align: center; border-bottom: 1px solid #e2e8f0;">Total</th>
              <th style="padding: 8px; width: 35px; text-align: center; border-bottom: 1px solid #e2e8f0;">Ing.</th>
              <th style="padding: 8px; width: 35px; text-align: center; border-bottom: 1px solid #e2e8f0;">Acep.</th>
              <th style="padding: 8px; width: 35px; text-align: center; border-bottom: 1px solid #e2e8f0;">Rech.</th>
              <th style="padding: 8px; width: 35px; text-align: center; border-bottom: 1px solid #e2e8f0;">Susp.</th>
              <th style="padding: 8px; width: 35px; text-align: center; border-bottom: 1px solid #e2e8f0;">Canc.</th>
              <th style="padding: 8px; width: 35px; text-align: center; border-bottom: 1px solid #e2e8f0;">Enc.</th>
              <th style="padding: 8px; width: 45px; text-align: center; border-bottom: 1px solid #e2e8f0;">Pend.Pub.</th>
              <th style="padding: 8px; width: 40px; text-align: center; border-bottom: 1px solid #e2e8f0; background: #f0fdf4;">En Plazo</th>
              <th style="padding: 8px; width: 40px; text-align: center; border-bottom: 1px solid #e2e8f0; background: #fff1f2;">Fuera Plazo</th>
            </tr>
          </thead>
          <tbody>
            ${tableRowsHtml}
            <tr style="background: #0f172a; color: white; font-weight: 800; font-size: 7.5px; page-break-inside: avoid;">
              <td style="padding: 8px;">TOTALES MUNICIPALES CONSOLIDADOS</td>
              <td style="padding: 8px; text-align: center;">${sumTotal}</td>
              <td style="padding: 8px; text-align: center;">${sumIng}</td>
              <td style="padding: 8px; text-align: center;">${sumAcep}</td>
              <td style="padding: 8px; text-align: center;">${sumRech}</td>
              <td style="padding: 8px; text-align: center;">${sumSusp}</td>
              <td style="padding: 8px; text-align: center;">${sumCanc}</td>
              <td style="padding: 8px; text-align: center;">${sumEnc}</td>
              <td style="padding: 8px; text-align: center;">${sumPend}</td>
              <td style="padding: 8px; text-align: center; background: #166534;">${sumDdp}</td>
              <td style="padding: 8px; text-align: center; background: #be123c;">${sumFdp}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  const dateFormatted = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const defaultName = `MU163-RAPEJECUTIVO_${dateFormatted}.pdf`;

  const saveResult = await window.api.selectSavePath({ defaultName });
  if (saveResult.cancelled || !saveResult.filePath) {
    showToast('Guardado de Reporte Ejecutivo cancelado.', 'info');
    return;
  }

  showToast('Generando Reporte Ejecutivo PDF...');
  const silentResult = await window.api.generateSilentPdf({
    html: htmlContent,
    filePath: saveResult.filePath,
    title: 'Reporte de Solicitudes de Audiencia — Resumen General'
  });

  if (silentResult && silentResult.success) {
    showToast(`Reporte Ejecutivo PDF guardado correctamente.`, 'success');
    window.api.invokeRoute({
      url: '/api/log',
      method: 'POST',
      body: {
        code: 'INFO-REP-503',
        message: 'Reporte Ejecutivo PDF generado',
        details: `Archivo: ${defaultName} | Destino: ${saveResult.filePath} | Por: ${currentUser ? currentUser.correo : 'Desconocido'}`,
        severity: 'info'
      }
    }).catch(err => console.error('Error al registrar log:', err));
  } else {
    showToast('No se pudo generar el Reporte Ejecutivo PDF.', 'error');
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
      btn.innerHTML = `<span class="w-4 h-4 border-2 border-border-ui border-t-transparent rounded-full animate-spin"></span> <span>Procesando...</span>`;

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
            
            if (stats.sharepoint) {
              if (stats.sharepoint.uploaded) {
                showToast('✓ Base de datos sincronizada y subida a SharePoint.', 'success');
              } else {
                const isOmit = stats.sharepoint.error && stats.sharepoint.error.startsWith('Omitido');
                if (isOmit) {
                  showToast('⚠️ Base de datos guardada localmente (SharePoint omitido, requiere SSO).', 'warning');
                } else if (!stats.sharepoint.error) {
                  showToast('✓ La base de datos local y remota están sincronizadas.', 'success');
                } else {
                  showToast(`❌ Error al subir a SharePoint: ${stats.sharepoint.error}`, 'error');
                }
              }
            } else {
              showToast('✓ Base de datos sincronizada localmente.', 'success');
            }
            
            // Abrir modal de resumen ejecutivo de importación (Nivel 1)
            window._lastSyncStats = stats;
            window._lastSyncDateStr = 'Sincronización recién completada';
            openSyncSummaryModal(stats, 'Sincronización recién completada');
            
            fetchAlertas();
            fetchSyncHistory(); // Refrescar el historial de administración
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
          btn.className = 'flex-1 py-3 bg-border-ui/50 text-text-tertiary rounded-xl text-xs font-bold transition-all cursor-not-allowed flex items-center justify-center gap-2';
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

// Solicitar ruta de guardado nativa y copiar base de datos para respaldo
async function downloadBackup() {
  try {
    showToast('Generando copia de seguridad...');
    const date = new Date();
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const defaultName = `lobby_backup_${yyyy}${mm}${dd}.db`;
    
    // 1. Abrir diálogo nativo "Guardar como..."
    const saveResult = await window.api.selectSavePath({ defaultName });
    if (saveResult.cancelled || !saveResult.filePath) {
      showToast('Guardado de copia de seguridad cancelado.', 'info');
      return;
    }
    const targetPath = saveResult.filePath;
    
    // 2. Invocar la ruta del backup pasándole la ruta de destino
    const res = await fetch(`/api/admin/backup?filePath=${encodeURIComponent(targetPath)}`);
    const data = await res.json();
    if (data && data.success) {
      showToast('Copia de seguridad guardada con éxito.', 'success');
    } else {
      showToast(data.error || 'Error al guardar la copia de seguridad.', 'error');
    }
  } catch (err) {
    console.error('Error al descargar copia de seguridad:', err);
    showToast('Error al procesar el respaldo de la base de datos.', 'error');
  }
}

// Cargar y mostrar la bitácora de logs en el panel de administración
// Almacenar entradas de logs en memoria para acceso desde el modal
let _logEntries = [];

async function refreshAdminLogs(force = false) {
  const container = document.getElementById('logs-table-body');
  const countEl = document.getElementById('logs-count-badge');
  if (!container) return;
  
  if (force || _logEntries.length === 0) {
    container.innerHTML = `<tr><td colspan="4" class="text-center py-8 text-text-tertiary text-xs font-semibold">Cargando registros...</td></tr>`;
    try {
      const res = await fetch('/api/admin/logs');
      const data = await res.json();
      _logEntries = (data && data.entries) ? data.entries : [];
    } catch (err) {
      console.error('Error al obtener bitácora de logs:', err);
      container.innerHTML = `<tr><td colspan="4" class="text-center py-8 text-rose-400 text-xs font-semibold">Error de red al obtener bitácora de logs.</td></tr>`;
      return;
    }
  }

  if (_logEntries.length === 0) {
    container.innerHTML = `<tr><td colspan="4" class="text-center py-8 text-text-tertiary text-xs font-semibold">
      <div class="flex flex-col items-center gap-2">
        <i data-lucide="check-circle" class="h-8 w-8 text-emerald-600/40"></i>
        <span>No hay logs registrados. ¡Todo en orden!</span>
      </div>
    </td></tr>`;
    if (countEl) countEl.textContent = '0';
    const paginationContainer = document.getElementById('logs-pagination-container');
    if (paginationContainer) paginationContainer.innerHTML = '';
    if (window.lucide) lucide.createIcons();
    return;
  }

  // Filtrar
  const filterType = (paginationState.logs && paginationState.logs.filterType) ? paginationState.logs.filterType : 'all';
  const filtered = _logEntries.filter(entry => {
    if (filterType === 'all') return true;
    const code = entry.code || '';
    if (filterType === 'warn') {
      return code.startsWith('ERR-NET') || code.startsWith('ERR-SYNC');
    }
    if (filterType === 'auth') {
      return code.startsWith('ERR-AUTH') || code.startsWith('AUTH-');
    }
    if (filterType === 'error') {
      return code.startsWith('ERR-') && !code.startsWith('ERR-NET') && !code.startsWith('ERR-SYNC') && !code.startsWith('ERR-AUTH');
    }
    if (filterType === 'info') {
      return !code.startsWith('ERR-') && !code.startsWith('AUTH-');
    }
    return true;
  });

  if (countEl) countEl.textContent = String(filtered.length);

  if (filtered.length === 0) {
    container.innerHTML = `<tr><td colspan="4" class="text-center py-8 text-text-tertiary text-xs font-semibold">No hay registros que coincidan con el filtro seleccionado.</td></tr>`;
    const paginationContainer = document.getElementById('logs-pagination-container');
    if (paginationContainer) paginationContainer.innerHTML = '';
    if (window.lucide) lucide.createIcons();
    return;
  }

  // Paginación
  const pageSize = 15;
  const totalItems = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  
  let currentPage = (paginationState.logs && paginationState.logs.page) ? paginationState.logs.page : 1;
  if (currentPage > totalPages) {
    currentPage = totalPages;
    if (paginationState.logs) paginationState.logs.page = currentPage;
  }
  
  const startIndex = (currentPage - 1) * pageSize;
  const paginated = filtered.slice(startIndex, startIndex + pageSize);

  const severityColor = (code) => {
    if (code.startsWith('ERR-NET') || code.startsWith('ERR-SYNC')) return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 dark:border-amber-800/40';
    if (code.startsWith('ERR-AUTH') || code.startsWith('AUTH-')) return 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20 dark:border-sky-800/40';
    if (code.startsWith('ERR-')) return 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20 dark:border-rose-800/40';
    return 'bg-border-ui/40 text-text-secondary  border-border-ui ';
  };

  container.innerHTML = paginated.map((entry) => {
    const originalIndex = _logEntries.indexOf(entry);
    return `
      <tr class="border-b border-border-ui hover:bg-border-ui dark:hover:bg-border-ui/50 transition-colors cursor-pointer group" onclick="openLogDetailModal(${originalIndex})">
        <td class="py-2.5 px-3 text-[10px] text-text-secondary font-mono whitespace-nowrap">${entry.timestamp}</td>
        <td class="py-2.5 px-3">
          <span class="inline-block px-2 py-0.5 rounded-md text-[9px] font-bold border ${severityColor(entry.code)}">${entry.code}</span>
        </td>
        <td class="py-2.5 px-3 text-[11px] text-text-secondary max-w-[350px] truncate font-medium">${entry.message}</td>
        <td class="py-2.5 px-3 text-right">
          <span class="opacity-0 group-hover:opacity-100 transition-opacity text-[9px] text-brand-600 dark:text-brand-400 font-bold">Ver detalle →</span>
        </td>
      </tr>
    `;
  }).join('');

  // Renderizar controles de paginación
  const paginationContainer = document.getElementById('logs-pagination-container');
  if (paginationContainer) {
    paginationContainer.innerHTML = renderPaginationControls('logs', totalItems, currentPage, pageSize);
  }

  if (window.lucide) lucide.createIcons();
}

window.filterLogsByType = function (type) {
  if (!paginationState.logs) {
    paginationState.logs = { page: 1, filterType: 'all' };
  }
  paginationState.logs.filterType = type;
  paginationState.logs.page = 1;
  
  const container = document.getElementById("main-content");
  if (container && typeof renderUsuarios === "function") {
    renderUsuarios(container);
  } else {
    refreshAdminLogs(false);
  }
};

// ============================================================================
// MODAL DE AUDITORÍA Y DETALLE DE CAMBIOS DE IMPORTACIÓN
// ============================================================================

// ============================================================================
// MODAL DE RESUMEN EJECUTIVO DE IMPORTACIÓN (NIVEL 1)
// ============================================================================

function openSyncSummaryModal(statsObj, dateStr) {
  const modal = document.getElementById('modal-container');
  if (!modal) return;
  modal.classList.remove('hidden');

  window._activeSyncStats = statsObj;
  window._activeSyncDateStr = dateStr;

  const inserts = (statsObj.sh?.inserts || 0) + (statsObj.ph?.inserts || 0) + (statsObj.sph?.inserts || 0);
  const updates = (statsObj.sh?.updates || 0) + (statsObj.ph?.updates || 0) + (statsObj.sph?.updates || 0);
  const deletes = (statsObj.sh?.deletes || 0) + (statsObj.ph?.deletes || 0) + (statsObj.sph?.deletes || 0);
  const skipped = (statsObj.sh?.skipped || 0) + (statsObj.ph?.skipped || 0) + (statsObj.sph?.skipped || 0);
  const totalChanges = inserts + updates + deletes;

  let spStatusHtml = '';
  if (statsObj.sharepoint && statsObj.sharepoint.uploaded) {
    spStatusHtml = `
      <div class="flex items-center gap-2.5 p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs font-medium">
        <i data-lucide="cloud-check" class="h-4 w-4 text-emerald-500 shrink-0"></i>
        <span>Base de datos respaldada y sincronizada en SharePoint con éxito.</span>
      </div>
    `;
  } else if (statsObj.sharepoint && statsObj.sharepoint.error && statsObj.sharepoint.error.startsWith('Omitido')) {
    spStatusHtml = `
      <div class="flex items-center gap-2.5 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-xs font-medium">
        <i data-lucide="cloud-off" class="h-4 w-4 text-amber-500 shrink-0"></i>
        <span>Base de datos guardada localmente (subida a SharePoint omitida).</span>
      </div>
    `;
  } else if (statsObj.sharepoint && statsObj.sharepoint.error) {
    spStatusHtml = `
      <div class="flex items-center gap-2.5 p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-400 text-xs font-medium">
        <i data-lucide="alert-triangle" class="h-4 w-4 text-rose-500 shrink-0"></i>
        <span>Guardado localmente. Error SharePoint: ${statsObj.sharepoint.error}</span>
      </div>
    `;
  } else {
    spStatusHtml = `
      <div class="flex items-center gap-2.5 p-3 rounded-2xl bg-border-ui/40 border border-border-ui text-text-secondary text-xs font-medium">
        <i data-lucide="database" class="h-4 w-4 text-brand-500 shrink-0"></i>
        <span>Base de datos local actualizada correctamente.</span>
      </div>
    `;
  }

  modal.innerHTML = `
    <div class="glass-card w-full max-w-lg p-6 rounded-3xl space-y-5 shadow-2xl relative animate-fade-in border border-border-ui flex flex-col overflow-hidden">
      <!-- Header -->
      <div class="flex items-start justify-between">
        <div class="flex items-center gap-3">
          <div class="h-11 w-11 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0 border border-emerald-500/20">
            <i data-lucide="check-circle-2" class="h-6 w-6"></i>
          </div>
          <div>
            <h3 class="text-base font-bold text-text-primary">¡Importación Completada!</h3>
            <p class="text-[11px] text-text-tertiary mt-0.5">${dateStr}</p>
          </div>
        </div>
        <button onclick="closeModal()" class="text-text-tertiary hover:text-text-primary dark:hover:text-text-primary transition-colors bg-transparent border-none cursor-pointer p-1">
          <i data-lucide="x" class="h-4 w-4"></i>
        </button>
      </div>

      <!-- KPI Grid -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div class="bg-bg-main border border-border-ui rounded-2xl p-3 text-center">
          <span class="block text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Creados</span>
          <span class="text-xl font-black text-text-primary mt-0.5 block">+${inserts}</span>
        </div>
        <div class="bg-bg-main border border-border-ui rounded-2xl p-3 text-center">
          <span class="block text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">Modificados</span>
          <span class="text-xl font-black text-text-primary mt-0.5 block">${updates}</span>
        </div>
        <div class="bg-bg-main border border-border-ui rounded-2xl p-3 text-center">
          <span class="block text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">Eliminados</span>
          <span class="text-xl font-black text-text-primary mt-0.5 block">${deletes}</span>
        </div>
        <div class="bg-bg-main border border-border-ui rounded-2xl p-3 text-center">
          <span class="block text-[10px] font-bold uppercase tracking-wider text-text-tertiary">Sin cambio</span>
          <span class="text-xl font-black text-text-primary mt-0.5 block">${skipped.toLocaleString('es-CL')}</span>
        </div>
      </div>

      <!-- SharePoint Status -->
      ${spStatusHtml}

      <!-- Footer Buttons -->
      <div class="flex items-center justify-between gap-3 pt-2 border-t border-border-ui shrink-0">
        ${totalChanges > 0 ? `
          <button onclick="openSyncDetailsModal(window._activeSyncStats, window._activeSyncDateStr, true)" class="px-4 py-2.5 rounded-xl text-xs font-bold border border-border-ui hover:bg-border-ui dark:hover:bg-border-ui/50 text-text-secondary flex items-center gap-2 cursor-pointer transition-all">
            <i data-lucide="eye" class="h-4 w-4 text-brand-500"></i>
            <span>Ver desglose detallado</span>
          </button>
        ` : `<div></div>`}
        <button onclick="closeModal()" class="px-6 py-2.5 rounded-xl text-xs font-bold btn-primary text-white cursor-pointer shadow-lg shadow-brand-500/20">
          Entendido
        </button>
      </div>
    </div>
  `;

  if (window.lucide) lucide.createIcons();
}

// ============================================================================
// MODAL DE AUDITORÍA Y DETALLE DE CAMBIOS (NIVEL 2)
// ============================================================================

function openSyncDetailsModal(statsObj, dateStr, showBackBtn = false) {
  const modal = document.getElementById('modal-container');
  if (!modal) return;
  modal.classList.remove('hidden');

  window._activeSyncStats = statsObj;
  window._activeSyncDateStr = dateStr;

  const inserts = [];
  const updates = [];
  const deletes = [];

  if (statsObj.sh && statsObj.sh.details) {
    statsObj.sh.details.forEach(d => {
      if (d.type === 'insert') inserts.push({ ...d, section: 'Solicitud (SH)' });
      else if (d.type === 'update') updates.push({ ...d, section: 'Solicitud (SH)' });
      else if (d.type === 'delete') deletes.push({ ...d, section: 'Solicitud (SH)' });
    });
  }
  if (statsObj.ph && statsObj.ph.details) {
    statsObj.ph.details.forEach(d => {
      if (d.type === 'insert') inserts.push({ ...d, section: 'Audiencia (PH)' });
      else if (d.type === 'update') updates.push({ ...d, section: 'Audiencia (PH)' });
      else if (d.type === 'delete') deletes.push({ ...d, section: 'Audiencia (PH)' });
    });
  }
  if (statsObj.sph && statsObj.sph.details) {
    statsObj.sph.details.forEach(d => {
      if (d.type === 'insert') inserts.push({ ...d, section: 'Sujeto Pasivo (SPH)' });
      else if (d.type === 'update') updates.push({ ...d, section: 'Sujeto Pasivo (SPH)' });
      else if (d.type === 'delete') deletes.push({ ...d, section: 'Sujeto Pasivo (SPH)' });
    });
  }

  // Selección inteligente de pestaña inicial
  let defaultTab = 'agregados';
  if (inserts.length === 0 && updates.length > 0) {
    defaultTab = 'modificados';
  } else if (inserts.length === 0 && updates.length === 0 && deletes.length > 0) {
    defaultTab = 'eliminados';
  }

  // Renderizar Agregados
  let agregadosHtml = '';
  if (inserts.length === 0) {
    agregadosHtml = `<p class="text-center text-xs text-text-tertiary py-10">Ningún registro fue agregado en este proceso.</p>`;
  } else {
    agregadosHtml = `
      <div class="space-y-2.5">
        ${inserts.map(item => `
          <div class="sync-item-card bg-bg-main border border-border-ui rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs transition-all" data-search="${(item.folio || '') + ' ' + (item.pasivo || '') + ' ' + (item.nombre || '') + ' ' + (item.activo || '')}">
            <div class="space-y-1">
              <div class="flex items-center gap-2">
                <span class="px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">${item.section}</span>
                <span class="font-mono font-bold text-xs text-text-primary">${item.folio || item.nombre || `ID: ${item.id}`}</span>
              </div>
              <p class="text-[11px] text-text-tertiary leading-snug">
                ${item.pasivo ? `<strong class="text-text-secondary">Sujeto:</strong> ${item.pasivo}` : ''}
                ${item.activo ? ` &bull; <strong class="text-text-secondary">Solicitante:</strong> ${item.activo}` : ''}
                ${item.cargo ? `<strong class="text-text-secondary">Cargo:</strong> ${item.cargo}` : ''}
              </p>
            </div>
            <span class="shrink-0 px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold text-[10px] self-start sm:self-auto border border-emerald-500/20">
              + Nuevo Registro
            </span>
          </div>
        `).join('')}
      </div>
    `;
  }

  // Renderizar Modificados (Tarjetas Diff con buen formato y sin cortes)
  let modificadosHtml = '';
  if (updates.length === 0) {
    modificadosHtml = `<p class="text-center text-xs text-text-tertiary py-10">Ningún registro fue modificado en este proceso.</p>`;
  } else {
    modificadosHtml = `
      <div class="space-y-3">
        ${updates.map(item => {
          let diffsHtml = '';
          if (item.changes && Object.keys(item.changes).length > 0) {
            diffsHtml = Object.keys(item.changes).map(field => {
              const diff = item.changes[field];
              return `
                <div class="grid grid-cols-1 sm:grid-cols-12 gap-1.5 sm:gap-3 py-2 border-b border-border-ui last:border-0 items-start text-xs">
                  <span class="sm:col-span-3 text-[10px] font-bold text-text-tertiary uppercase tracking-wider pt-0.5">${field}</span>
                  <div class="sm:col-span-9 flex flex-wrap items-center gap-2">
                    <span class="px-2.5 py-1 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 line-through text-[11px] font-medium max-w-full break-words" title="${diff.old}">${diff.old || '(vacío)'}</span>
                    <span class="text-text-tertiary font-bold">→</span>
                    <span class="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold text-[11px] max-w-full break-words" title="${diff.new}">${diff.new || '(vacío)'}</span>
                  </div>
                </div>
              `;
            }).join('');
          } else {
            diffsHtml = `<p class="text-[11px] text-text-secondary italic">Campos actualizados en base de datos.</p>`;
          }

          return `
            <div class="sync-item-card bg-bg-main border border-border-ui rounded-2xl p-4 space-y-2.5 transition-all" data-search="${(item.folio || '') + ' ' + (item.pasivo || '') + ' ' + (item.nombre || '') + ' ' + (item.activo || '')}">
              <div class="flex flex-wrap items-center justify-between gap-2 border-b border-border-ui pb-2.5">
                <div class="flex items-center gap-2">
                  <span class="px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20">${item.section}</span>
                  <span class="font-mono font-bold text-xs text-text-primary">${item.folio || item.nombre || `ID: ${item.id}`}</span>
                </div>
                ${item.pasivo ? `<span class="text-[11px] text-text-tertiary"><strong class="text-text-secondary">Sujeto:</strong> ${item.pasivo}</span>` : ''}
              </div>
              <div class="space-y-1">
                ${diffsHtml}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  // Renderizar Eliminados
  let eliminadosHtml = '';
  if (deletes.length === 0) {
    eliminadosHtml = `<p class="text-center text-xs text-text-tertiary py-10">Ningún registro fue eliminado en este proceso.</p>`;
  } else {
    eliminadosHtml = `
      <div class="space-y-2.5">
        ${deletes.map(item => `
          <div class="sync-item-card bg-bg-main border border-border-ui rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs transition-all" data-search="${(item.folio || '') + ' ' + (item.pasivo || '') + ' ' + (item.nombre || '')}">
            <div class="space-y-1">
              <div class="flex items-center gap-2">
                <span class="px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">${item.section}</span>
                <span class="font-mono font-bold text-xs text-text-primary">${item.folio || item.nombre || `ID: ${item.id}`}</span>
              </div>
              <p class="text-[11px] text-text-tertiary leading-snug">
                ${item.pasivo ? `<strong class="text-text-secondary">Sujeto Pasivo:</strong> ${item.pasivo}` : ''}
                ${item.nombre ? `<strong class="text-text-secondary">Nombre:</strong> ${item.nombre}` : ''}
              </p>
            </div>
            <span class="shrink-0 px-2.5 py-1 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold text-[10px] self-start sm:self-auto border border-rose-500/20">
              - Registro Removido
            </span>
          </div>
        `).join('')}
      </div>
    `;
  }

  modal.innerHTML = `
    <div class="glass-card w-full max-w-4xl p-6 rounded-3xl space-y-4 shadow-2xl relative animate-fade-in border border-border-ui max-h-[88vh] flex flex-col overflow-hidden">
      <!-- Header -->
      <div class="flex items-start justify-between shrink-0">
        <div class="flex items-center gap-3">
          <div class="h-10 w-10 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400 flex items-center justify-center shrink-0 border border-brand-500/20">
            <i data-lucide="clipboard-list" class="h-5 w-5"></i>
          </div>
          <div>
            <h3 class="text-sm font-bold text-text-primary">Desglose Detallado de Cambios</h3>
            <p class="text-[10px] text-text-tertiary mt-0.5">${dateStr}</p>
          </div>
        </div>
        <button onclick="closeModal()" class="text-text-tertiary hover:text-text-primary dark:hover:text-text-primary transition-colors bg-transparent border-none cursor-pointer p-1">
          <i data-lucide="x" class="h-4 w-4"></i>
        </button>
      </div>

      <!-- Search Filter -->
      <div class="relative w-full shrink-0">
        <i data-lucide="search" class="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-tertiary"></i>
        <input type="text" id="sync-detail-search" oninput="filterSyncDetailCards(this.value)" placeholder="Buscar por folio, sujeto pasivo, solicitante o RUT..." class="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-border-ui border border-border-ui text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-brand-500/40" />
      </div>

      <!-- Tabs Header -->
      <div class="flex border-b border-border-ui shrink-0 gap-1">
        <button data-tab="agregados" onclick="changeSyncDetailTab('agregados')" class="sync-tab-header px-4 py-2 border-b-2 ${defaultTab === 'agregados' ? 'border-brand-500 text-brand-600 dark:text-brand-400' : 'border-transparent text-text-tertiary hover:text-text-primary dark:hover:text-text-primary'} text-xs font-bold transition-all bg-transparent cursor-pointer">
          Agregados (${inserts.length})
        </button>
        <button data-tab="modificados" onclick="changeSyncDetailTab('modificados')" class="sync-tab-header px-4 py-2 border-b-2 ${defaultTab === 'modificados' ? 'border-brand-500 text-brand-600 dark:text-brand-400' : 'border-transparent text-text-tertiary hover:text-text-primary dark:hover:text-text-primary'} text-xs font-bold transition-all bg-transparent cursor-pointer">
          Modificados (${updates.length})
        </button>
        <button data-tab="eliminados" onclick="changeSyncDetailTab('eliminados')" class="sync-tab-header px-4 py-2 border-b-2 ${defaultTab === 'eliminados' ? 'border-brand-500 text-brand-600 dark:text-brand-400' : 'border-transparent text-text-tertiary hover:text-text-primary dark:hover:text-text-primary'} text-xs font-bold transition-all bg-transparent cursor-pointer">
          Eliminados (${deletes.length})
        </button>
      </div>

      <!-- Tab Contents (scrollable) -->
      <div class="flex-1 overflow-y-auto min-h-0 pr-1 py-1">
        <!-- AGREGADOS -->
        <div id="sync-tab-agregados" class="sync-tab-content ${defaultTab === 'agregados' ? '' : 'hidden'} space-y-3">
          ${agregadosHtml}
        </div>
        <!-- MODIFICADOS -->
        <div id="sync-tab-modificados" class="sync-tab-content ${defaultTab === 'modificados' ? '' : 'hidden'} space-y-3">
          ${modificadosHtml}
        </div>
        <!-- ELIMINADOS -->
        <div id="sync-tab-eliminados" class="sync-tab-content ${defaultTab === 'eliminados' ? '' : 'hidden'} space-y-3">
          ${eliminadosHtml}
        </div>
      </div>

      <!-- Footer -->
      <div class="flex items-center justify-between gap-2 pt-2 border-t border-border-ui shrink-0">
        ${showBackBtn ? `
          <button onclick="openSyncSummaryModal(window._activeSyncStats, window._activeSyncDateStr)" class="px-4 py-2 rounded-xl text-xs font-bold border border-border-ui hover:bg-border-ui dark:hover:bg-border-ui/50 text-text-secondary flex items-center gap-1.5 cursor-pointer transition-all">
            <i data-lucide="arrow-left" class="h-3.5 w-3.5"></i>
            <span>Volver al resumen</span>
          </button>
        ` : `<div></div>`}
        <button onclick="closeModal()" class="px-5 py-2 rounded-xl text-xs font-bold btn-primary text-white cursor-pointer shadow-lg shadow-brand-500/20">
          Cerrar
        </button>
      </div>
    </div>
  `;

  if (window.lucide) lucide.createIcons();
}

window.changeSyncDetailTab = (tabName) => {
  document.querySelectorAll('.sync-tab-content').forEach(el => el.classList.add('hidden'));
  const target = document.getElementById(`sync-tab-${tabName}`);
  if (target) target.classList.remove('hidden');
  
  document.querySelectorAll('.sync-tab-header').forEach(el => {
    if (el.getAttribute('data-tab') === tabName) {
      el.className = 'sync-tab-header px-4 py-2 border-b-2 border-brand-500 text-brand-600 dark:text-brand-400 text-xs font-bold transition-all bg-transparent cursor-pointer';
    } else {
      el.className = 'sync-tab-header px-4 py-2 border-b-2 border-transparent text-text-tertiary  hover:text-text-primary dark:hover:text-text-primary text-xs font-bold transition-all bg-transparent cursor-pointer';
    }
  });

  const searchInput = document.getElementById('sync-detail-search');
  if (searchInput && searchInput.value) {
    window.filterSyncDetailCards(searchInput.value);
  }
};

window.filterSyncDetailCards = (query) => {
  const q = (query || '').toLowerCase().trim();
  const activeContent = document.querySelector('.sync-tab-content:not(.hidden)');
  if (!activeContent) return;
  const cards = activeContent.querySelectorAll('.sync-item-card');
  cards.forEach(card => {
    const text = (card.getAttribute('data-search') || '') + ' ' + card.innerText;
    if (text.toLowerCase().includes(q)) {
      card.classList.remove('hidden');
    } else {
      card.classList.add('hidden');
    }
  });
};

window.viewSyncDetails = (id) => {
  const item = dataStore.syncHistory.find(x => x.id === id);
  if (!item) return;
  
  let dateStr = item.timestamp;
  try {
    const d = new Date(item.timestamp.replace(' ', 'T') + 'Z');
    dateStr = d.toLocaleString('es-CL', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  } catch (err) {
    console.warn('No se pudo formatear timestamp:', err);
  }
  
  try {
    const statsObj = JSON.parse(item.detalles);
    openSyncDetailsModal(statsObj, `Sincronización del ${dateStr}`);
  } catch(e) {
    showToast('No se pudieron cargar los detalles de este registro.', 'error');
  }
};

function openLogDetailModal(index) {
  const entry = _logEntries[index];
  if (!entry) return;
  
  const modal = document.getElementById('modal-container');
  if (!modal) return;
  modal.classList.remove('hidden');
  
  const severityLabel = (code) => {
    if (code.startsWith('ERR-GEN') || code.startsWith('ERR-DB-5')) return { text: 'CRÍTICO', cls: 'bg-rose-500/20 text-rose-400 border-rose-500/40' };
    if (code.startsWith('ERR-NET') || code.startsWith('ERR-SYNC')) return { text: 'ADVERTENCIA', cls: 'bg-amber-500/20 text-amber-400 border-amber-500/40' };
    if (code.startsWith('ERR-AUTH')) return { text: 'AUTENTICACIÓN', cls: 'bg-sky-500/20 text-sky-400 border-sky-500/40' };
    return { text: 'INFO', cls: 'bg-border-ui/40 text-text-tertiary border-border-ui' };
  };
  
  const severity = severityLabel(entry.code);
  const hasDetails = entry.details && entry.details.trim().length > 0;
  const escapedFull = JSON.stringify(`[${entry.timestamp}] [${entry.code}] ${entry.message}${hasDetails ? ' | ' + entry.details : ''}`).slice(1, -1);
  
  modal.innerHTML = `
    <div class="glass-card w-full max-w-lg p-6 rounded-3xl space-y-5 shadow-2xl relative animate-fade-in border border-border-ui">
      <!-- Header -->
      <div class="flex items-start justify-between">
        <div class="flex items-center gap-3">
          <div class="h-10 w-10 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center shrink-0">
            <i data-lucide="file-warning" class="h-5 w-5"></i>
          </div>
          <div>
            <h3 class="text-sm font-bold text-heading">Detalle del Evento</h3>
            <p class="text-[10px] text-text-tertiary mt-0.5">${entry.timestamp}</p>
          </div>
        </div>
        <button onclick="closeModal()" class="text-text-tertiary hover:text-text-primary transition-colors bg-transparent border-none cursor-pointer p-1">
          <i data-lucide="x" class="h-4 w-4"></i>
        </button>
      </div>
      
      <!-- Badges -->
      <div class="flex items-center gap-2">
        <span class="inline-block px-2.5 py-1 rounded-lg text-[10px] font-bold border ${severity.cls}">${severity.text}</span>
        <span class="inline-block px-2.5 py-1 rounded-lg text-[10px] font-bold bg-border-ui/50 text-text-secondary border border-border-ui font-mono">${entry.code}</span>
      </div>
      
      <!-- Mensaje -->
      <div class="space-y-1.5">
        <label class="text-[9px] font-bold text-text-tertiary uppercase tracking-widest">Mensaje</label>
        <p class="text-xs text-text-secondary leading-relaxed bg-black/50 rounded-xl px-4 py-3 border border-border-ui">${entry.message}</p>
      </div>
      
      <!-- Detalle Técnico -->
      ${hasDetails ? `
      <div class="space-y-1.5">
        <label class="text-[9px] font-bold text-text-tertiary uppercase tracking-widest">Detalle Técnico</label>
        <pre class="text-[10px] text-text-tertiary font-mono leading-relaxed bg-black/50 rounded-xl px-4 py-3 border border-border-ui max-h-48 overflow-y-auto whitespace-pre-wrap break-all">${entry.details}</pre>
      </div>
      ` : ''}
      
      <!-- Acciones -->
      <div class="flex justify-end gap-2 pt-1">
        <button onclick="navigator.clipboard.writeText('${escapedFull.replace(/'/g, "\\'")}'); showToast('Registro copiado al portapapeles', 'success', { persistent: false });" 
                class="px-3 py-2 rounded-xl text-[10px] font-bold btn-secondary flex items-center gap-1.5 cursor-pointer">
          <i data-lucide="copy" class="h-3.5 w-3.5"></i> Copiar
        </button>
        <button onclick="closeModal()" class="px-4 py-2 rounded-xl text-[10px] font-bold btn-primary text-white cursor-pointer">
          Cerrar
        </button>
      </div>
    </div>
  `;
  
  if (window.lucide) lucide.createIcons();
}

// Manejar selección del archivo Excel y conversión a Base64
function handleExcelFileSelected(event) {
  const input = event.target;
  const file = input.files ? input.files[0] : null;
  const label = document.getElementById('excel-file-label');
  const details = document.getElementById('excel-file-details');
  const btn = document.getElementById('btn-import-sync');
  const clearBtn = document.getElementById('btn-clear-excel');

  if (!file) {
    selectedExcelFileBase64 = null;
    if (label) label.textContent = 'Haz clic para buscar o arrastra aquí tu archivo Excel';
    if (details) details.textContent = 'Solo formato .xlsx';
    if (clearBtn) clearBtn.classList.add('hidden');
    if (btn) {
      btn.disabled = true;
      btn.className = 'flex-1 py-3 bg-border-ui/50 text-text-tertiary rounded-xl text-xs font-bold transition-all cursor-not-allowed flex items-center justify-center gap-2';
      btn.innerHTML = `<i data-lucide="file-up" class="h-4 w-4"></i> <span>Procesar e Importar Excel</span>`;
      lucide.createIcons();
    }
    return;
  }

  if (clearBtn) clearBtn.classList.remove('hidden');

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

// Limpiar la selección de archivo Excel
function clearExcelFileSelection() {
  const input = document.getElementById('import-excel-file');
  if (input) {
    input.value = '';
    handleExcelFileSelected({ target: input });
  }
}
window.clearExcelFileSelection = clearExcelFileSelection;
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
                  <span id="sys-val-${f.key}" class="text-[9px] text-text-tertiary font-semibold ${isEnProceso ? '' : 'hidden'}">Cargando...</span>
                </div>
                <input type="number" id="aud-${f.key}" value="${val !== '' ? val : ''}" required min="0" oninput="validateAuditForm(); compareFieldDiscrepancy('${f.key}')" class="w-full px-3 py-2 rounded-xl text-xs glass-input text-text-secondary placeholder:text-text-tertiary ${isTotal ? 'font-bold border-brand-500/30' : ''}">
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
  const containerDist = document.getElementById('chart-distribucion-estados');
  const containerEvol = document.getElementById('chart-evolucion-mensual');
  const containerCumpl = document.getElementById('chart-cumplimiento-plazos');
  const containerTop = document.getElementById('chart-top-autoridades');

  if (!containerDist || !containerEvol || !containerCumpl || !containerTop) return;

  // Destruir instancias previas para evitar superposiciones o fugas de memoria
  if (chartDistribucionInstance) {
    try { chartDistribucionInstance.destroy(); } catch (err) { console.debug('chartDistribucion ya liberado:', err); }
    chartDistribucionInstance = null;
  }
  if (chartEvolucionInstance) {
    try { chartEvolucionInstance.destroy(); } catch (err) { console.debug('chartEvolucion ya liberado:', err); }
    chartEvolucionInstance = null;
  }
  if (chartCumplimientoInstance) {
    try { chartCumplimientoInstance.destroy(); } catch (err) { console.debug('chartCumplimiento ya liberado:', err); }
    chartCumplimientoInstance = null;
  }
  if (chartTopAutoridadesInstance) {
    try { chartTopAutoridadesInstance.destroy(); } catch (err) { console.debug('chartTopAutoridades ya liberado:', err); }
    chartTopAutoridadesInstance = null;
  }

  if (typeof ApexCharts === 'undefined') {
    console.warn('ApexCharts no está cargado.');
    return;
  }

  // Detectar tema actual y leer variables CSS computadas (@theme Sincronización)
  const style = getComputedStyle(document.documentElement);
  const isDark = document.documentElement.classList.contains('dark');

  // Colores principales de la marca Liquid Lavender
  const colorBrand = style.getPropertyValue('--brand-600').trim() || '#7c3aed';

  // Paleta de colores WCAG AA / pasteles tecnológicos
  const colorSky = isDark ? '#38bdf8' : '#0284c7';
  const colorRose = isDark ? '#fda4af' : '#f43f5e';
  const colorPurple = isDark ? '#c084fc' : '#a78bfa';
  const colorSlate = isDark ? '#9a95b0' : '#9d8dbf';
  const colorAmber = isDark ? '#fbbf24' : '#d97706';

  const textColor = isDark ? '#e2e0ed' : '#18112b'; // slate-300 vs slate-700
  const gridColor = isDark ? '#221e33' : '#edeaf5'; // slate-800 vs slate-200

  // Obtener datos y calcular estadísticas
  const rawData = dataStore.dashboardRawData || [];
  const filters = dashboardFilters || {};
  const stats = calculateDashboardStats(rawData, filters);

  // 1. Re-filtrar datos locales para cálculos temporales
  let filtered = rawData;
  if (filters.vigencia === 'vigentes' || filters.soloVigentes === true) {
    if (typeof activeSujetoIdsCache !== 'undefined' && activeSujetoIdsCache) {
      filtered = filtered.filter(item => item.sujeto_pasivo_id && activeSujetoIdsCache.has(item.sujeto_pasivo_id));
    }
  } else if (filters.vigencia === 'no_vigentes') {
    if (typeof activeSujetoIdsCache !== 'undefined' && activeSujetoIdsCache) {
      filtered = filtered.filter(item => !item.sujeto_pasivo_id || !activeSujetoIdsCache.has(item.sujeto_pasivo_id));
    }
  }
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

  // ----------------------------------------------------
  // GRÁFICO A: DISTRIBUCIÓN POR ESTADO (Donut)
  // ----------------------------------------------------
  const distData = [
    stats.totales.pendientes,
    stats.estados.aceptada.count,
    stats.estados.rechazada.count,
    stats.estados.suspendida.count,
    stats.estados.cancelada.count,
    stats.estados.encomendada.count
  ];

  const distOptions = {
    chart: {
      type: 'donut',
      height: 280,
      fontFamily: 'Inter, sans-serif',
      foreColor: textColor,
      toolbar: {
        show: true,
        tools: {
          download: true,
          selection: false,
          zoom: false,
          zoomin: false,
          zoomout: false,
          pan: false,
          reset: false
        },
        export: {
          csv: { filename: 'distribucion_solicitudes_por_estado' },
          svg: { filename: 'distribucion_solicitudes_por_estado' },
          png: { filename: 'distribucion_solicitudes_por_estado' }
        }
      }
    },
    series: distData,
    labels: ['Ingresadas', 'Aceptadas', 'Rechazadas', 'Suspendidas', 'Canceladas', 'Encomendadas'],
    colors: [colorSky, colorBrand, colorRose, colorPurple, colorSlate, colorAmber],
    stroke: {
      show: true,
      width: 2,
      colors: [isDark ? '#0c0b14' : '#ffffff']
    },
    plotOptions: {
      pie: {
        donut: {
          size: '65%',
          background: 'transparent',
          labels: {
            show: true,
            name: {
              show: true,
              fontSize: '11px',
              fontFamily: 'Inter, sans-serif',
              fontWeight: 600,
            },
            value: {
              show: true,
              fontSize: '16px',
              fontFamily: 'Inter, sans-serif',
              fontWeight: 700,
              color: isDark ? '#e2e0ed' : '#0c0b14',
              formatter: function(val) {
                return parseInt(val, 10).toLocaleString('es-CL');
              }
            },
            total: {
              show: true,
              label: 'Total',
              fontSize: '11px',
              fontFamily: 'Inter, sans-serif',
              fontWeight: 500,
              color: textColor,
              formatter: function(w) {
                const sum = w.globals.seriesTotals.reduce((a, b) => a + b, 0);
                return sum.toLocaleString('es-CL');
              }
            }
          }
        }
      }
    },
    dataLabels: {
      enabled: false
    },
    legend: {
      position: 'right',
      fontSize: '11px',
      markers: {
        width: 8,
        height: 8,
        radius: 8
      },
      itemMargin: {
        vertical: 4
      }
    },
    tooltip: {
      theme: isDark ? 'dark' : 'light',
      y: {
        formatter: function(value) {
          const total = filtered.length;
          const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
          return `${value.toLocaleString('es-CL')} (${percentage}%)`;
        }
      }
    }
  };

  chartDistribucionInstance = new ApexCharts(containerDist, distOptions);
  chartDistribucionInstance.render();

  // ----------------------------------------------------
  // GRÁFICO B: EVOLUCIÓN MENSUAL INTERANUAL (Area/Line)
  // ----------------------------------------------------
  const selectedYearStr = (filters.anio && filters.anio !== 'TODOS') ? filters.anio : new Date().getFullYear().toString();
  const selectedYear = parseInt(selectedYearStr, 10);
  const previousYear = selectedYear - 1;

  // Filtrar datos para evolución aplicando filtros de Vigencia, Nombre y Cargo pero saltándose año
  let dataForEvol = rawData;
  if (filters.vigencia === 'vigentes' || filters.soloVigentes === true) {
    if (typeof activeSujetoIdsCache !== 'undefined' && activeSujetoIdsCache) {
      dataForEvol = dataForEvol.filter(item => item.sujeto_pasivo_id && activeSujetoIdsCache.has(item.sujeto_pasivo_id));
    }
  } else if (filters.vigencia === 'no_vigentes') {
    if (typeof activeSujetoIdsCache !== 'undefined' && activeSujetoIdsCache) {
      dataForEvol = dataForEvol.filter(item => !item.sujeto_pasivo_id || !activeSujetoIdsCache.has(item.sujeto_pasivo_id));
    }
  }
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

  const evolOptions = {
    chart: {
      type: 'area',
      height: 280,
      fontFamily: 'Inter, sans-serif',
      foreColor: textColor,
      toolbar: {
        show: true,
        tools: {
          download: true,
          selection: false,
          zoom: false,
          zoomin: false,
          zoomout: false,
          pan: false,
          reset: false
        },
        export: {
          csv: { filename: 'evolucion_mensual_solicitudes' },
          svg: { filename: 'evolucion_mensual_solicitudes' },
          png: { filename: 'evolucion_mensual_solicitudes' }
        }
      }
    },
    series: [
      {
        name: `${selectedYear} (Año Actual)`,
        data: currentYearMonthly
      },
      {
        name: `${previousYear} (Año Anterior)`,
        data: previousYearMonthly
      }
    ],
    colors: [colorBrand, colorSlate],
    stroke: {
      curve: 'smooth',
      width: [2, 1.5],
      dashArray: [0, 4]
    },
    fill: {
      type: 'gradient',
      gradient: {
        shadeIntensity: 1,
        opacityFrom: [0.25, 0],
        opacityTo: [0.05, 0],
        stops: [0, 90, 100]
      }
    },
    xaxis: {
      categories: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'],
      axisBorder: { show: false },
      axisTicks: { show: false }
    },
    grid: {
      borderColor: gridColor,
      strokeDashArray: 4,
      xaxis: { lines: { show: false } },
      yaxis: { lines: { show: true } }
    },
    dataLabels: {
      enabled: false
    },
    tooltip: {
      theme: isDark ? 'dark' : 'light'
    }
  };

  chartEvolucionInstance = new ApexCharts(containerEvol, evolOptions);
  chartEvolucionInstance.render();

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

  const cumplOptions = {
    chart: {
      type: 'bar',
      height: 280,
      stacked: true,
      fontFamily: 'Inter, sans-serif',
      foreColor: textColor,
      toolbar: {
        show: true,
        tools: {
          download: true,
          selection: false,
          zoom: false,
          zoomin: false,
          zoomout: false,
          pan: false,
          reset: false
        },
        export: {
          csv: { filename: 'cumplimiento_plazos_mensual' },
          svg: { filename: 'cumplimiento_plazos_mensual' },
          png: { filename: 'cumplimiento_plazos_mensual' }
        }
      }
    },
    series: [
      {
        name: 'Dentro de Plazo (RDP/DDP)',
        data: inPlazoMonthly
      },
      {
        name: 'Fuera de Plazo (RFP/FDP)',
        data: fueraPlazoMonthly
      }
    ],
    colors: [colorBrand, colorRose],
    plotOptions: {
      bar: {
        horizontal: false,
        columnWidth: '45%',
        borderRadius: 4,
        borderRadiusApplication: 'end',
        borderRadiusWhenStacked: 'last'
      }
    },
    xaxis: {
      categories: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'],
      axisBorder: { show: false },
      axisTicks: { show: false }
    },
    grid: {
      borderColor: gridColor,
      strokeDashArray: 4,
      xaxis: { lines: { show: false } },
      yaxis: { lines: { show: true } }
    },
    dataLabels: {
      enabled: false
    },
    tooltip: {
      theme: isDark ? 'dark' : 'light'
    }
  };

  chartCumplimientoInstance = new ApexCharts(containerCumpl, cumplOptions);
  chartCumplimientoInstance.render();

  // ----------------------------------------------------
  // GRÁFICO D: TOP 5 AUTORIDADES (Horizontal Bar)
  // ----------------------------------------------------
  const counts = {}; // spId -> { name, count }
  filtered.forEach(item => {
    if (item.sujeto_pasivo_id && item.sujeto_pasivo) {
      const spId = item.sujeto_pasivo_id;
      if (!counts[spId]) {
        counts[spId] = { name: normalizeName(item.sujeto_pasivo), count: 0 };
      }
      counts[spId].count++;
    }
  });

  const sortedTop = Object.keys(counts)
    .map(spId => ({ name: counts[spId].name, count: counts[spId].count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const topLabels = sortedTop.map(x => x.name);
  const topData = sortedTop.map(x => x.count);

  const topOptions = {
    chart: {
      type: 'bar',
      height: 280,
      fontFamily: 'Inter, sans-serif',
      foreColor: textColor,
      toolbar: {
        show: true,
        tools: {
          download: true,
          selection: false,
          zoom: false,
          zoomin: false,
          zoomout: false,
          pan: false,
          reset: false
        },
        export: {
          csv: { filename: 'top_autoridades_solicitudes' },
          svg: { filename: 'top_autoridades_solicitudes' },
          png: { filename: 'top_autoridades_solicitudes' }
        }
      }
    },
    series: [{
      name: 'Solicitudes Recibidas',
      data: topData.length > 0 ? topData : [0]
    }],
    colors: [colorBrand],
    plotOptions: {
      bar: {
        horizontal: true,
        barHeight: '35%',
        borderRadius: 4,
        borderRadiusApplication: 'end'
      }
    },
    xaxis: {
      categories: topLabels.length > 0 ? topLabels : ['Sin registros'],
      labels: {
        formatter: function(val) {
          return Math.floor(val);
        }
      },
      axisBorder: { show: false },
      axisTicks: { show: false }
    },
    grid: {
      borderColor: gridColor,
      strokeDashArray: 4,
      xaxis: { lines: { show: true } },
      yaxis: { lines: { show: false } }
    },
    dataLabels: {
      enabled: false
    },
    tooltip: {
      theme: isDark ? 'dark' : 'light'
    }
  };

  chartTopAutoridadesInstance = new ApexCharts(containerTop, topOptions);
  chartTopAutoridadesInstance.render();
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

  (dataStore.alertas.agendadasHoy || []).forEach(item => {
    if (!full && (item.estado_gestion === 'leida' || item.estado_gestion === 'borrada')) return;

    const timeStr = item.fecha_agendada && item.fecha_agendada.split(' ')[1]
      ? item.fecha_agendada.split(' ')[1].slice(0, 5)
      : 'Hora no especificada';

    warnings.push({
      id: item.id,
      type: 'agenda',
      folio: item.folio_lobby || 'Sin Folio',
      sujeto_pasivo: item.sujeto_pasivo,
      deadline: item.fecha_agendada,
      diff: 0,
      color: 'blue',
      text: `Hoy - Reunión agendada con ${item.sujeto_pasivo} (${item.sujeto_activo || 'Lobbista'}) a las ${timeStr}`,
      estado_gestion: item.estado_gestion
    });
  });

  // Ordenar alertas: Rojas primero, luego Amarillas, luego Azules. Dentro de cada grupo, las más próximas/vencidas primero.
  warnings.sort((a, b) => {
    if (a.color === 'red' && b.color !== 'red') return -1;
    if (a.color !== 'red' && b.color === 'red') return 1;
    if (a.color === 'yellow' && b.color === 'blue') return -1;
    if (a.color === 'blue' && b.color === 'yellow') return 1;
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
  } else if (type === 'agenda') {
    const meeting = (dataStore.alertas.agendadasHoy || []).find(m => m.folio_lobby === folio);
    if (meeting && meeting.fecha_agendada) {
      // Usar split y guiones para evitar desfases locales en parseo de fecha
      const dateParts = meeting.fecha_agendada.split(' ')[0].split('-');
      if (dateParts.length === 3) {
        currentCalendarDate = new Date(parseInt(dateParts[0], 10), parseInt(dateParts[1], 10) - 1, parseInt(dateParts[2], 10));
      }
    }
    calendarFilters.search = folio;
    switchView('agenda');
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

// Función para generar masivamente reportes PDF en segundo plano
async function generarReportesMasivos() {
  const fInicio = reportesFilters.fechaInicio || '';
  const fTermino = reportesFilters.fechaTermino || '';

  // 1. Solicitar la carpeta de destino al usuario vía IPC (Electron)
  const dirResult = await window.api.selectDirectory();
  if (dirResult.cancelled || !dirResult.filePath) {
    showToast('Generación masiva cancelada.', 'info');
    return;
  }
  const destFolder = dirResult.filePath;

  showToast('Iniciando procesamiento masivo...');

  // 2. Obtener la lista de sujetos vigentes si corresponde
  const vigenciaState = reportesFilters.vigencia || 'todos';
  let vigentesIds = null;
  if (vigenciaState === 'vigentes' || vigenciaState === 'no_vigentes') {
    try {
      const res = await fetch('/api/sujetos_pasivos/vigentes');
      if (res.ok) {
        vigentesIds = await res.json();
      }
    } catch (e) {
      console.error('Error al obtener sujetos vigentes:', e);
    }
  }

  // 3. Filtrar y agrupar solicitudes por (sujeto_pasivo, cargo)
  const filtered = [];
  const hasEstadosFilter = reportesFilters.estados && reportesFilters.estados.length > 0;
  const publicadasArray = Array.isArray(dataStore.publicadas) ? dataStore.publicadas : (dataStore.publicadas?.data || []);
  const publicadosFolios = new Set(publicadasArray.map(p => p.folio_lobby).filter(Boolean));

  dataStore.reportesRawData.forEach(item => {
    let itemEstado = (item.estado || 'Ingresada').trim();
    const isPendiente = itemEstado.toLowerCase() === 'aceptada' && item.fecha_agendada && !publicadosFolios.has(item.folio_lobby);
    if (isPendiente) {
      itemEstado = 'Pendiente de publicación';
    }

    // Filtro por Rango de Fechas (PDR Compliance: la fecha de evaluación depende del estado)
    // - Ingresada (PDR): se evalúa contra la fecha límite de respuesta (DDL)
    // - Aceptada / Pendiente: se evalúa contra la fecha agendada
    // - Otros: se evalúa contra la fecha de ingreso
    if (fInicio || fTermino) {
      const statusLower = itemEstado.toLowerCase();
      let evalDate = null;
      if (statusLower === 'ingresada') {
        evalDate = item.fecha_limite_sh || item.fecha_ingreso;
      } else if (item.fecha_agendada && item.fecha_agendada !== '-' && item.fecha_agendada !== '---') {
        evalDate = item.fecha_agendada;
      } else {
        evalDate = item.fecha_ingreso;
      }
      if (evalDate) {
        const dateStr = evalDate.split(' ')[0];
        if (fInicio && dateStr < fInicio) return;
        if (fTermino && dateStr > fTermino) return;
      } else {
        return;
      }
    }

    // Filtro por estados
    if (hasEstadosFilter) {
      const match = reportesFilters.estados.some(est => est.toLowerCase() === itemEstado.toLowerCase());
      if (!match) return;
    }

    // Filtro por estado de vigencia
    if (vigenciaState === 'vigentes' && vigentesIds) {
      if (!vigentesIds.includes(item.sujeto_pasivo_id)) {
        return;
      }
    } else if (vigenciaState === 'no_vigentes' && vigentesIds) {
      if (item.sujeto_pasivo_id && vigentesIds.includes(item.sujeto_pasivo_id)) {
        return;
      }
    }

    filtered.push(item);
  });

  // Agrupar por combinación única (sujeto_pasivo, cargo)
  const groups = {};
  filtered.forEach(item => {
    const name = (item.sujeto_pasivo || 'Sin Nombre').trim();
    const cargo = (item.cargo || 'Sin Cargo').trim();
    const key = `${name}|||${cargo}`;
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(item);
  });

  // Ordenar la cola de generación masiva según la jerarquía institucional solicitada por el usuario:
  // 1. ALC (Alcaldía) -> 2. CON (Concejales) -> 3. DOM (Obras) -> 4. SECMUN (Secretaría) -> 5. CE (Comisión) -> 6. LOS DEMÁs (Alfabético)
  const cargoPriorityOrder = ['ALC', 'CON', 'DOM', 'SECMUN', 'CE'];

  const groupKeys = Object.keys(groups).sort((keyA, keyB) => {
    const [nameA, cargoA] = keyA.split('|||');
    const [nameB, cargoB] = keyB.split('|||');

    const codeA = getCargoAbbreviated(cargoA);
    const codeB = getCargoAbbreviated(cargoB);

    const idxA = cargoPriorityOrder.indexOf(codeA);
    const idxB = cargoPriorityOrder.indexOf(codeB);

    const prioA = idxA !== -1 ? idxA : 999;
    const prioB = idxB !== -1 ? idxB : 999;

    if (prioA !== prioB) {
      return prioA - prioB;
    }

    if (codeA !== codeB) {
      return codeA.localeCompare(codeB);
    }

    return nameA.localeCompare(nameB);
  });
  const totalGroups = groupKeys.length;

  if (totalGroups === 0) {
    showToast('No se encontraron registros que coincidan con los filtros de fechas/estados.', 'error');
    return;
  }

  // 4. Mostrar modal de progreso en pantalla
  let isCancelled = false;
  const modal = document.getElementById('modal-container');
  if (modal) {
    modal.classList.remove('hidden');
    modal.innerHTML = `
      <div class="glass-card w-full max-w-md p-6 rounded-3xl space-y-5 shadow-2xl relative border border-border-ui">
        <div class="flex items-center gap-3">
          <div class="h-10 w-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
            <svg class="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
          <div>
            <h3 class="text-sm font-bold text-text-primary uppercase tracking-wider">Generación Masiva</h3>
            <p class="text-[10px] text-text-tertiary mt-0.5">Exportando reportes a PDF silenciosamente...</p>
          </div>
        </div>
        
        <div class="space-y-2">
          <div class="w-full bg-bg-card rounded-full h-1.5 overflow-hidden">
            <div id="batch-progress-bar" class="bg-blue-500 h-1.5 rounded-full transition-all duration-250" style="width: 0%"></div>
          </div>
          <div class="flex justify-between text-[10px] text-text-tertiary font-semibold">
            <span id="batch-progress-text" class="truncate max-w-[240px]">Iniciando cola...</span>
            <span id="batch-progress-percent">0%</span>
          </div>
        </div>

        <div class="flex justify-end pt-2">
          <button id="cancel-batch-btn" class="px-4 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 font-bold text-[10px] uppercase tracking-wider transition-colors">
            Cancelar
          </button>
        </div>
      </div>
    `;

    const cancelBtn = document.getElementById('cancel-batch-btn');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        isCancelled = true;
        cancelBtn.textContent = 'Cancelando...';
        cancelBtn.disabled = true;
        cancelBtn.classList.remove('bg-rose-500/10', 'text-rose-500');
        cancelBtn.classList.add('bg-border-ui/40', 'text-text-tertiary');
        showToast('Cancelando exportación masiva...', 'info');
      });
    }
  }

  // 5. Procesar e imprimir secuencialmente cada reporte
  for (let index = 0; index < totalGroups; index++) {
    if (isCancelled) {
      closeModal();
      showToast('Generación masiva cancelada por el usuario.', 'info');
      window.api.invokeRoute({
        url: '/api/log',
        method: 'POST',
        body: {
          code: 'INFO-REP-505',
          message: 'Generación masiva cancelada',
          details: `Procesamiento cancelado por el usuario en el reporte ${index + 1} de ${totalGroups} | Destino: ${destFolder} | Por: ${currentUser ? currentUser.correo : 'Desconocido'}`,
          severity: 'info'
        }
      }).catch(err => console.error('Error al registrar log de cancelación de reporte:', err));
      return;
    }
    const key = groupKeys[index];
    const [name, cargo] = key.split('|||');
    const groupItems = groups[key];

    // Actualizar progreso visual
    const progressPercent = Math.round((index / totalGroups) * 100);
    const progressBar = document.getElementById('batch-progress-bar');
    const progressText = document.getElementById('batch-progress-text');
    const progressPercentText = document.getElementById('batch-progress-percent');
    
    if (progressBar) progressBar.style.width = `${progressPercent}%`;
    if (progressText) progressText.textContent = `${normalizeName(name)} (${index + 1}/${totalGroups})`;
    if (progressPercentText) progressPercentText.textContent = `${progressPercent}%`;

    // Generar código de reporte local único agregando el índice para evitar colisiones
    const localBaseCode = generateLocalReportCode();
    const codigoReporte = `${localBaseCode}-${String(index + 1).padStart(3, '0')}`;

    // Mapear elementos del reporte exactamente igual que el listado individual
    const processedGroupItems = groupItems.map((item, idx) => {
      const isLicitacion = item.cargo && (item.cargo.includes('2770-') || item.cargo.includes('27770-'));
      const cleanedCargoText = isLicitacion ? getCargoCleanBidding(item.cargo) : getCargoClean(item.cargo);
      const normalizedName = normalizeName(item.sujeto_pasivo) || 'Sin Nombre';
      const cargoCombinado = `${normalizedName} - ${cleanedCargoText}`;

      let itemEstado = (item.estado || 'Ingresada').trim();
      const isPendiente = itemEstado.toLowerCase() === 'aceptada' && item.fecha_agendada && !publicadosFolios.has(item.folio_lobby);
      if (isPendiente) {
        itemEstado = 'Pendiente de publicación';
      }

      let badge;
      if (isPendiente) {
        badge = { text: 'Pendiente de publicación', class: 'badge-status-otros' };
      } else {
        badge = getDeadlineStatusBadge(item.fecha_ingreso, item.fecha_respuesta, item.estado, item);
      }
      const plazoRestanteStr = getStandardizedPlazoText(item, isPendiente);
      const pubInfo = getPendingPublicationDelay(item.fecha_agendada, item);

      return {
        index: idx + 1,
        id: item.id || idx,
        folio: item.folio_lobby || 'Sin Folio',
        cargoCompleto: cargoCombinado,
        cargo: cleanedCargoText,
        fechaIngreso: formatDate(item.fecha_ingreso),
        fechaLimiteRespuesta: item.fecha_limite_sh ? formatDate(item.fecha_limite_sh) : null,
        fechaAgendada: formatDateTime(item.fecha_agendada),
        fechaLimitePublicacion: (item.fecha_agendada && item.fecha_agendada !== '-') ? pubInfo.deadlineStr : null,
        estado: itemEstado,
        badgeClass: badge.class,
        badgeText: badge.text,
        plazo: plazoRestanteStr
      };
    });

    const isOverdueItem = (item) => {
      const mainCode = (item.plazo || '').split(' ')[0].toUpperCase();
      return mainCode === 'FDP' || mainCode === 'RFP';
    };
    const isFdpItem = (item) => (item.plazo || '').split(' ')[0].toUpperCase() === 'FDP';
    const isDdpItem = (item) => (item.plazo || '').split(' ')[0].toUpperCase() === 'DDP';

    const overdueCount = processedGroupItems.filter(isFdpItem).length;
    const compliantCount = processedGroupItems.filter(isDdpItem).length;
    const totalItems = processedGroupItems.length;

    const rowsArray = processedGroupItems.map((item, idx) => {
      let stateColor = '#334155';
      let stateBg = '#f1f5f9';
      let stateBorder = '#e2e8f0';
      const stateLower = (item.estado || '').toLowerCase();
      if (stateLower === 'aceptada') { stateColor = '#166534'; stateBg = '#f0fdf4'; stateBorder = '#bbf7d0'; }
      else if (stateLower === 'pendiente de publicación') { stateColor = '#075985'; stateBg = '#f0f9ff'; stateBorder = '#bae6fd'; }
      else if (stateLower === 'rechazada') { stateColor = '#991b1b'; stateBg = '#fef2f2'; stateBorder = '#fecaca'; }
      else if (stateLower === 'cancelada' || stateLower === 'suspendida') { stateColor = '#9a3412'; stateBg = '#fffbeb'; stateBorder = '#fed7aa'; }

      const isOverdue = isOverdueItem(item);
      const plazoColor = isOverdue ? '#991b1b' : '#166534';
      const plazoBg   = isOverdue ? '#fef2f2' : '#f0fdf4';
      const plazoBorder = isOverdue ? '#fecaca' : '#bbf7d0';

      const plazoStr = item.plazo || '';
      const hasDays = plazoStr.includes('(') && plazoStr.includes(')');
      let mainCode = plazoStr || '—';
      let days = '';
      if (hasDays) {
        const parts = plazoStr.split(' ');
        mainCode = parts[0] || '—';
        days = (parts[1] || '').replace(/[()]/g, '');
      }

      const showTwoLine = hasDays && (mainCode === 'FDP' || mainCode === 'RFP');
      const plazoBadgeHtml = showTwoLine
        ? `<span style="display: inline-block; padding: 3px 6px; border: 1px solid ${plazoBorder}; border-radius: 6px; font-size: 7px; font-weight: 800; color: ${plazoColor}; background: ${plazoBg}; text-align: center; min-width: 42px; line-height: 1.3; white-space: normal;">${mainCode}<br><span style="font-size: 6px; font-weight: 500;">${days}</span></span>`
        : `<span style="display: inline-block; padding: 3px 6px; border: 1px solid ${plazoBorder}; border-radius: 6px; font-size: 7px; font-weight: 800; color: ${plazoColor}; background: ${plazoBg}; text-align: center; min-width: 42px; line-height: 1.3; text-transform: uppercase; white-space: nowrap;">${mainCode}</span>`;

      const rowBg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';

      return `
        <tr style="border-bottom: 1px solid #e2e8f0; font-size: 7.5px; background: ${rowBg};">
          <td style="padding: 8px 10px; font-weight: 600; color: #64748b; border-bottom: 1px solid #e2e8f0;">${item.index}</td>
          <td style="padding: 8px 10px; font-weight: 700; color: #0f172a; font-family: monospace; border-bottom: 1px solid #e2e8f0;">${item.folio}</td>
          <td style="padding: 8px 10px; color: #1e293b; font-weight: 500; border-bottom: 1px solid #e2e8f0; line-height: 1.3;">${item.cargo}</td>
          <td style="padding: 8px 10px; color: #475569; border-bottom: 1px solid #e2e8f0; line-height: 1.3;">
            <div style="font-weight: 600; color: #334155;">${item.fechaIngreso}</div>
            ${item.fechaLimiteRespuesta ? `<div style="font-size: 6.5px; color: #94a3b8; margin-top: 1px;">${item.fechaLimiteRespuesta}</div>` : ''}
          </td>
          <td style="padding: 8px 10px; color: #475569; border-bottom: 1px solid #e2e8f0; line-height: 1.3;">
            <div style="font-weight: 600; color: #334155;">${item.fechaAgendada}</div>
            ${item.fechaLimitePublicacion ? `<div style="font-size: 6.5px; color: #94a3b8; margin-top: 1px;">${item.fechaLimitePublicacion}</div>` : ''}
          </td>
          <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0; vertical-align: middle;">
            ${item.estado === 'Pendiente de publicación'
              ? `<span style="display: inline-block; padding: 3px 6px; border: 1px solid ${stateBorder}; border-radius: 6px; font-size: 6.5px; font-weight: 700; color: ${stateColor}; background: ${stateBg}; text-align: center; line-height: 1.2;">PENDIENTE DE PUBLICACIÓN</span>`
              : `<span style="display: inline-block; padding: 3px 6px; border: 1px solid ${stateBorder}; border-radius: 6px; font-size: 6.5px; font-weight: 700; color: ${stateColor}; background: ${stateBg}; text-transform: uppercase; white-space: nowrap; line-height: 1.2;">${item.estado}</span>`
            }
          </td>
          <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0; vertical-align: middle;">
            ${plazoBadgeHtml}
          </td>
        </tr>
      `;
    });

    const htmlContent = buildReportPDFHtml({
      processedData: processedGroupItems,
      filtersSnapshot: {
        nombre: name,
        cargo: cargo,
        fechaInicio: fInicio,
        fechaTermino: fTermino,
        estados: reportesFilters.estados || []
      },
      sujetoPasivoNombre: normalizeName(name),
      sujetoPasivoCargo: cargo,
      codigoReporte
    });

    const cargoAbbr = getCargoAbbreviated(cargo);
    const sanitizedNombre = sanitizeNombreForFilename(name);
    const fileName = `${codigoReporte}_${cargoAbbr}_${sanitizedNombre}.pdf`;
    const filePath = `${destFolder}/${fileName}`.replace(/\\/g, '/');

    // Generar archivo PDF silencioso
    const silentResult = await window.api.generateSilentPdf({
      html: htmlContent,
      filePath,
      title: `${codigoReporte} - ${name}`
    });

    if (silentResult && silentResult.success) {
      // Éxito al generar PDF silencioso
    } else {
      console.error(`Error al exportar PDF de ${name} (${cargo}):`, silentResult ? silentResult.error : 'Desconocido');
    }
  }

  // 6. Finalizar
  closeModal();
  showToast(`Generación masiva completada: ${totalGroups} reportes exportados en ${destFolder}`, 'success');
  window.api.invokeRoute({
    url: '/api/log',
    method: 'POST',
    body: {
      code: 'INFO-REP-504',
      message: 'Generación masiva completada',
      details: `Total: ${totalGroups} reportes exportados en ${destFolder} | Por: ${currentUser ? currentUser.correo : 'Desconocido'}`,
      severity: 'info'
    }
  }).catch(err => console.error('Error al registrar log de generación masiva:', err));
}




// ============================================================================
// MÓDULO DE ASISTENCIA TÉCNICA Y DIRECTORIO (ADMINISTRACIÓN) - FASE 3
// ============================================================================

window.asistenciaPaginationState = {
  page: 1,
  limit: 15,
  total: 0,
  totalPages: 1
};

let asistenciaFilterTimeout = null;
let contactosFilterTimeout = null;

// Abrir la consola auxiliar flotante
async function openAssistanceConsole() {
  if (window.api && window.api.openAssistanceWindow) {
    await window.api.openAssistanceWindow();
  }
}
window.openAssistanceConsole = openAssistanceConsole;

// Atajos globales dentro de la ventana principal (F9 y Ctrl+Shift+A)
window.addEventListener('keydown', (e) => {
  if (e.key === 'F9' || ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'A' || e.key === 'a'))) {
    e.preventDefault();
    openAssistanceConsole();
  }
});

// Reactividad IPC: Si se guarda una asistencia desde la ventana auxiliar, refrescar la vista
if (window.api && window.api.onAssistanceUpdated) {
  window.api.onAssistanceUpdated(() => {
    if (typeof activeAdminTab !== 'undefined' && activeAdminTab === 'asistencia') {
      loadAsistenciaStats();
      if (window.activeAsistenciaSubTab === 'contactos') {
        loadContactosData();
      } else {
        loadAsistenciasData();
      }
    }
  });
}

// Cambiar entre sub-pestañas (Bitácora vs Directorio)
function changeAsistenciaSubTab(subTab) {
  window.activeAsistenciaSubTab = subTab;
  const container = document.getElementById('asistencia-subtab-content');
  if (!container) return;

  if (subTab === 'contactos') {
    container.innerHTML = renderAsistenciaContactosViewHtml();
    loadContactosData();
  } else if (subTab === 'categorias') {
    container.innerHTML = renderAsistenciaCategoriasViewHtml();
    loadCategoriasData();
  } else {
    container.innerHTML = renderAsistenciaBitacoraViewHtml();
    loadAsistenciaStats();
    loadAsistenciasData();
  }

  // Actualizar estilos de los botones de sub-pestaña
  const navButtons = document.querySelectorAll('button[onclick*="changeAsistenciaSubTab"]');
  navButtons.forEach(btn => {
    const isTarget = btn.getAttribute('onclick').includes(`'${subTab}'`);
    btn.className = isTarget
      ? "px-4 py-2 rounded-xl text-xs font-bold bg-brand-600 text-white shadow-2xs flex items-center gap-2 transition-all"
      : "px-4 py-2 rounded-xl text-xs font-semibold text-text-tertiary hover:text-text-primary hover:bg-border-ui/50 flex items-center gap-2 transition-all cursor-pointer";
  });

  if (window.lucide) window.lucide.createIcons();
}
window.changeAsistenciaSubTab = changeAsistenciaSubTab;

// Inicializador al entrar a la pestaña Asistencia Técnica
function initAsistenciaTab() {
  if (window.activeAsistenciaSubTab === 'contactos') {
    loadContactosData();
  } else {
    loadAsistenciaStats();
    loadAsistenciasData();
  }
}
window.initAsistenciaTab = initAsistenciaTab;

let chartAsistenciaDireccionesInstance = null;
let chartAsistenciaEvolucionInstance = null;
let currentAsistenciaEvolucionView = 'mensual';
window.asistenciaStatsData = null;

function setAsistenciaEvolucionView(view) {
  currentAsistenciaEvolucionView = view;
  ['semanal', 'mensual', 'anual'].forEach(v => {
    const btn = document.getElementById(`btn-evol-${v}`);
    if (btn) {
      if (v === view) {
        btn.className = "px-2 py-0.5 rounded-md bg-bg-card  text-brand-600 dark:text-brand-400 shadow-xs cursor-pointer";
      } else {
        btn.className = "px-2 py-0.5 rounded-md text-text-secondary  hover:text-text-primary dark:hover:text-text-primary cursor-pointer";
      }
    }
  });
  if (window.asistenciaStatsData) {
    renderAsistenciaEvolucionChart(window.asistenciaStatsData);
  }
}
window.setAsistenciaEvolucionView = setAsistenciaEvolucionView;

function renderAsistenciaDireccionesChart(stats) {
  const container = document.getElementById('chart-asistencia-direcciones');
  if (!container) return;

  if (chartAsistenciaDireccionesInstance) {
    try { chartAsistenciaDireccionesInstance.destroy(); } catch (err) { console.debug('chartAsistenciaDirecciones ya liberado:', err); }
    chartAsistenciaDireccionesInstance = null;
  }

  const isDark = document.documentElement.classList.contains('dark');
  const textColor = isDark ? '#e2e0ed' : '#18112b';
  const gridColor = isDark ? '#221e33' : '#edeaf5';
  const brandColor = isDark ? '#a78bfa' : '#7c3aed';

  const deptos = (stats && Array.isArray(stats.por_direccion) && stats.por_direccion.length > 0)
    ? stats.por_direccion.slice(0, 8)
    : [];

  if (deptos.length === 0) {
    container.innerHTML = '<div class="text-center text-text-tertiary text-xs py-10">Sin atenciones registradas todavía.</div>';
    return;
  }

  container.innerHTML = '';

  const categories = deptos.map(d => d.depto);
  const seriesData = deptos.map(d => d.count);

  const options = {
    chart: {
      type: 'bar',
      height: 240,
      fontFamily: 'Inter, sans-serif',
      foreColor: textColor,
      toolbar: { show: false }
    },
    plotOptions: {
      bar: {
        horizontal: true,
        barHeight: '35%',
        borderRadius: 4,
        borderRadiusApplication: 'end'
      }
    },
    colors: [brandColor],
    dataLabels: {
      enabled: false
    },
    series: [{
      name: 'Atenciones',
      data: seriesData
    }],
    xaxis: {
      categories: categories,
      labels: {
        style: { colors: textColor, fontSize: '10px' },
        formatter: (val) => Math.floor(val)
      },
      axisBorder: { show: false },
      axisTicks: { show: false }
    },
    yaxis: {
      labels: {
        style: { colors: textColor, fontSize: '11px', fontWeight: 500 },
        maxWidth: 140
      }
    },
    grid: {
      borderColor: gridColor,
      strokeDashArray: 4,
      xaxis: { lines: { show: true } },
      yaxis: { lines: { show: false } }
    },
    tooltip: {
      theme: isDark ? 'dark' : 'light',
      y: {
        formatter: (val) => `${val} atenciones`
      }
    }
  };

  chartAsistenciaDireccionesInstance = new ApexCharts(container, options);
  chartAsistenciaDireccionesInstance.render();
}

function renderAsistenciaEvolucionChart(stats) {
  const container = document.getElementById('chart-asistencia-evolucion');
  if (!container) return;

  if (chartAsistenciaEvolucionInstance) {
    try { chartAsistenciaEvolucionInstance.destroy(); } catch (err) { console.debug('chartAsistenciaEvolucion ya liberado:', err); }
    chartAsistenciaEvolucionInstance = null;
  }

  const isDark = document.documentElement.classList.contains('dark');
  const textColor = isDark ? '#e2e0ed' : '#18112b';
  const gridColor = isDark ? '#221e33' : '#edeaf5';
  const brandColor = isDark ? '#a78bfa' : '#7c3aed';
  const slateColor = isDark ? '#9a95b0' : '#9d8dbf';

  const fechas = (stats && Array.isArray(stats.fechas)) ? stats.fechas : [];

  if (fechas.length === 0) {
    container.innerHTML = '<div class="text-center text-text-tertiary text-xs py-10">Sin datos temporales registrados.</div>';
    return;
  }

  container.innerHTML = '';

  let categories = [];
  let series = [];

  const view = currentAsistenciaEvolucionView || 'mensual';

  if (view === 'semanal') {
    const weeksMap = {};
    const now = new Date();
    for (let i = 7; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
      const year = d.getFullYear();
      const firstDayOfYear = new Date(year, 0, 1);
      const pastDaysOfYear = (d - firstDayOfYear) / 86400000;
      const weekNum = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
      const key = `Sem ${weekNum}`;
      weeksMap[key] = 0;
    }
    fechas.forEach(fStr => {
      const d = new Date(fStr);
      if (!isNaN(d.getTime())) {
        const year = d.getFullYear();
        const firstDayOfYear = new Date(year, 0, 1);
        const pastDaysOfYear = (d - firstDayOfYear) / 86400000;
        const weekNum = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
        const key = `Sem ${weekNum}`;
        if (weeksMap[key] !== undefined) {
          weeksMap[key]++;
        }
      }
    });
    categories = Object.keys(weeksMap);
    series = [{
      name: 'Atenciones (Semanales)',
      data: Object.values(weeksMap)
    }];
  } else if (view === 'anual') {
    const yearsMap = {};
    fechas.forEach(fStr => {
      const year = fStr.substring(0, 4);
      if (year) {
        yearsMap[year] = (yearsMap[year] || 0) + 1;
      }
    });
    categories = Object.keys(yearsMap).sort();
    const counts = categories.map(y => yearsMap[y]);
    if (categories.length === 1) {
      categories = [String(parseInt(categories[0]) - 1), categories[0]];
      series = [{
        name: 'Atenciones Anuales',
        data: [0, counts[0]]
      }];
    } else {
      series = [{
        name: 'Atenciones Anuales',
        data: counts
      }];
    }
  } else {
    // mensual estándar de 12 meses idéntico al dashboard
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const currentYear = new Date().getFullYear();
    const previousYear = currentYear - 1;
    const currentYearMonthly = Array(12).fill(0);
    const previousYearMonthly = Array(12).fill(0);

    fechas.forEach(fStr => {
      const d = new Date(fStr);
      if (!isNaN(d.getTime())) {
        const y = d.getFullYear();
        const m = d.getMonth();
        if (y === currentYear && m >= 0 && m < 12) {
          currentYearMonthly[m]++;
        } else if (y === previousYear && m >= 0 && m < 12) {
          previousYearMonthly[m]++;
        }
      }
    });

    categories = months;
    series = [
      {
        name: `${currentYear} (Año Actual)`,
        data: currentYearMonthly
      },
      {
        name: `${previousYear} (Año Anterior)`,
        data: previousYearMonthly
      }
    ];
  }

  const options = {
    chart: {
      type: 'area',
      height: 240,
      fontFamily: 'Inter, sans-serif',
      foreColor: textColor,
      toolbar: { show: false }
    },
    series: series,
    colors: [brandColor, slateColor],
    stroke: {
      curve: 'smooth',
      width: series.length > 1 ? [2, 1.5] : [2],
      dashArray: series.length > 1 ? [0, 4] : [0]
    },
    fill: {
      type: 'gradient',
      gradient: {
        shadeIntensity: 1,
        opacityFrom: series.length > 1 ? [0.25, 0] : [0.25],
        opacityTo: series.length > 1 ? [0.05, 0] : [0.05],
        stops: [0, 90, 100]
      }
    },
    xaxis: {
      categories: categories,
      labels: {
        style: { colors: textColor, fontSize: '10px' }
      },
      axisBorder: { show: false },
      axisTicks: { show: false }
    },
    yaxis: {
      labels: {
        style: { colors: textColor, fontSize: '10px' },
        formatter: (val) => Math.floor(val)
      },
      min: 0,
      forceNiceScale: true
    },
    grid: {
      borderColor: gridColor,
      strokeDashArray: 4,
      xaxis: { lines: { show: false } },
      yaxis: { lines: { show: true } }
    },
    dataLabels: {
      enabled: false
    },
    legend: {
      show: series.length > 1,
      position: 'bottom',
      fontSize: '11px',
      markers: { width: 8, height: 8, radius: 8 }
    },
    tooltip: {
      theme: isDark ? 'dark' : 'light'
    }
  };

  chartAsistenciaEvolucionInstance = new ApexCharts(container, options);
  chartAsistenciaEvolucionInstance.render();
}

function renderAsistenciaCharts(stats) {
  if (typeof ApexCharts === 'undefined') return;
  renderAsistenciaDireccionesChart(stats);
  renderAsistenciaEvolucionChart(stats);
}

// 1. Cargar Estadísticas y KPIs Mensuales
async function loadAsistenciaStats() {
  try {
    const res = await window.api.invokeRoute({
      url: '/api/asistencias/stats',
      method: 'GET'
    });

    if (res && res.status === 200 && res.data) {
      const stats = res.data;
      window.asistenciaStatsData = stats;

      const elTotal = document.getElementById('kpi-asistencia-total');
      const elPctTel = document.getElementById('kpi-asistencia-pct-tel');
      const elPend = document.getElementById('kpi-asistencia-pendientes');
      const elTopCat = document.getElementById('kpi-asistencia-top-cat');

      if (elTotal) elTotal.textContent = (stats.total_mes || 0).toLocaleString('es-CL');
      if (elPctTel) elPctTel.textContent = `${stats.tasa_resolucion !== undefined ? stats.tasa_resolucion : 100}%`;
      if (elPend) elPend.textContent = (stats.en_seguimiento || 0).toLocaleString('es-CL');
      if (elTopCat) elTopCat.textContent = stats.top_direccion || 'Sin registros';

      renderAsistenciaCharts(stats);
    }
  } catch (err) {
    console.warn('Error al cargar KPIs de asistencia:', err);
  }
}
window.loadAsistenciaStats = loadAsistenciaStats;

// 2. Cargar Listado Paginado de la Bitácora
async function loadAsistenciasData() {
  const tbody = document.getElementById('tabla-asistencias-body');
  if (!tbody) return;

  const search = document.getElementById('filter-asistencia-search')?.value.trim() || '';
  const canal = document.getElementById('filter-asistencia-canal')?.value || 'todos';
  const categoria = document.getElementById('filter-asistencia-categoria')?.value || 'todas';
  const estado = document.getElementById('filter-asistencia-estado')?.value || 'todos';

  const params = new URLSearchParams({
    page: window.asistenciaPaginationState.page,
    limit: window.asistenciaPaginationState.limit
  });

  if (search) params.append('search', search);
  if (canal !== 'todos') params.append('canal', canal);
  if (categoria !== 'todas') params.append('categoria', categoria);
  if (estado !== 'todos') params.append('estado', estado);

  try {
    const res = await window.api.invokeRoute({
      url: `/api/asistencias?${params.toString()}`,
      method: 'GET'
    });

    if (res && res.status === 200 && res.data) {
      const total = res.data.total || 0;
      const page = res.data.page || 1;
      const totalPages = res.data.totalPages || res.data.total_pages || Math.ceil(total / (window.asistenciaPaginationState.limit || 10)) || 1;
      const rows = res.data.rows || [];

      window.asistenciaPaginationState.total = total;
      window.asistenciaPaginationState.page = page;
      window.asistenciaPaginationState.totalPages = totalPages;

      // Actualizar información de paginación
      const pageInfo = document.getElementById('asistencia-page-info');
      if (pageInfo) {
        const start = total === 0 ? 0 : (page - 1) * window.asistenciaPaginationState.limit + 1;
        const end = Math.min(page * window.asistenciaPaginationState.limit, total);
        pageInfo.textContent = `Mostrando ${start}-${end} de ${total} registros (Pág. ${page} de ${totalPages})`;
      }

      const btnPrev = document.getElementById('btn-asistencia-prev');
      const btnNext = document.getElementById('btn-asistencia-next');
      if (btnPrev) btnPrev.disabled = page <= 1;
      if (btnNext) btnNext.disabled = page >= totalPages;

      if (!rows || rows.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="8" class="text-center py-10 text-text-tertiary">
              <i data-lucide="inbox" class="h-6 w-6 mx-auto mb-2 text-text-tertiary"></i>
              No se encontraron registros de asistencias con los filtros seleccionados.
            </td>
          </tr>
        `;
        if (window.lucide) window.lucide.createIcons();
        return;
      }

      tbody.innerHTML = rows.map(r => {
        const canalBadges = {
          'telefono': '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"><i data-lucide="phone" class="h-2.5 w-2.5"></i> Teléfono</span>',
          'correo': '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"><i data-lucide="mail" class="h-2.5 w-2.5"></i> Correo</span>',
          'presencial': '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20"><i data-lucide="users" class="h-2.5 w-2.5"></i> Presencial</span>',
          'teams': '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20"><i data-lucide="message-square" class="h-2.5 w-2.5"></i> Teams</span>'
        };

        const estadoBadges = {
          'resuelta': '<span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20"><span class="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>Resuelta</span>',
          'en_seguimiento': '<span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20"><span class="h-1.5 w-1.5 rounded-full bg-amber-500"></span>En Seguimiento</span>',
          'derivada': '<span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20"><span class="h-1.5 w-1.5 rounded-full bg-blue-500"></span>Derivada</span>'
        };

        const catNames = {
          'plazos': 'Plazos Legales',
          'plataforma': 'Uso Plataforma',
          'sujetos_pasivos': 'Sujetos Pasivos',
          'derivaciones': 'Derivaciones',
          'actas': 'Carga Actas',
          'normativa': 'Normativa Ley',
          'otro': 'General'
        };

        const fechaFmt = r.fecha_hora ? r.fecha_hora.replace('T', ' ').substring(0, 16) : '--';

        return `
          <tr class="hover:bg-border-ui dark:hover:bg-border-ui/50 transition-colors">
            <!-- 1. TICKET / FECHA -->
            <td class="px-4 py-3 align-middle text-left w-32">
              <span class="font-mono font-bold text-brand-600 dark:text-brand-400 block">${r.ticket_codigo}</span>
              <span class="text-[10px] text-text-tertiary">${fechaFmt}</span>
            </td>

            <!-- 2. CANAL -->
            <td class="px-3 py-3 align-middle text-center w-24">
              <div class="flex justify-center">
                ${canalBadges[r.canal] || r.canal}
              </div>
            </td>

            <!-- 3. FUNCIONARIO SOLICITANTE -->
            <td class="px-4 py-3 align-middle text-left min-w-[150px]">
              <div class="font-bold text-text-primary">${r.solicitante_nombre}</div>
              <div class="text-[10px] text-text-tertiary">${r.solicitante_correo || ''} ${r.solicitante_contacto ? '· ' + r.solicitante_contacto : ''}</div>
            </td>

            <!-- 4. DIRECCIÓN / DEPTO -->
            <td class="px-4 py-3 align-middle text-left w-28">
              <span class="font-semibold text-text-primary">${r.solicitante_cargo_depto || '<span class="text-text-tertiary italic font-normal">General</span>'}</span>
            </td>

            <!-- 5. MATERIA (Limpio y legible estilo shadcn/ui) -->
            <td class="px-3 py-3 align-middle text-left w-36">
              <span class="text-xs font-medium text-text-secondary line-clamp-2 leading-tight" title="${catNames[r.categoria] || r.categoria}">
                ${catNames[r.categoria] || r.categoria}
              </span>
            </td>

            <!-- 6. MOTIVO & ORIENTACIÓN (UNIFICADO) -->
            <td class="px-4 py-3 align-middle text-left min-w-[220px]">
              <p class="text-text-primary line-clamp-2 text-xs leading-relaxed" title="${r.motivo_consulta}">${r.motivo_consulta || '<span class="text-text-tertiary italic">Sin motivo especificado</span>'}</p>
              ${r.solucion_orientacion ? `<p class="text-[10px] text-emerald-600 dark:text-emerald-400 line-clamp-1 mt-1 font-medium" title="${r.solucion_orientacion}">↳ ${r.solucion_orientacion}</p>` : ''}
            </td>

            <!-- 7. ESTADO -->
            <td class="px-3 py-3 align-middle text-center w-36">
              <div class="flex justify-center">
                ${estadoBadges[r.estado] || r.estado}
              </div>
            </td>

            <!-- 8. ACCIONES (Ver Detalle + Eliminar) -->
            <td class="px-4 py-3 align-middle text-right w-36">
              <div class="flex items-center justify-end gap-1.5">
                <button onclick="openModalDetalleAsistencia(${r.id})" class="h-7 px-2.5 rounded-lg text-xs font-semibold bg-brand-50 hover:bg-brand-100 dark:bg-brand-950/50 dark:hover:bg-brand-900/60 text-brand-600 dark:text-brand-400 border border-brand-200 dark:border-brand-800 transition-colors shadow-2xs cursor-pointer inline-flex items-center gap-1.5 active:scale-95 whitespace-nowrap" title="Ver detalle de la atención">
                  <i data-lucide="eye" class="h-3.5 w-3.5 shrink-0"></i>
                  <span>Ver Detalle</span>
                </button>
                <button onclick="eliminarAsistencia(${r.id}, '${r.ticket_codigo}')" class="h-7 w-7 rounded-lg text-text-tertiary hover:text-rose-600 dark:hover:text-rose-400 bg-border-ui hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-border-ui hover:border-rose-200 dark:hover:border-rose-800 transition-colors cursor-pointer inline-flex items-center justify-center active:scale-95 shrink-0" title="Eliminar registro">
                  <i data-lucide="trash-2" class="h-3.5 w-3.5"></i>
                </button>
              </div>
            </td>
          </tr>
        `;
      }).join('');

      if (window.lucide) window.lucide.createIcons();
    }
  } catch (err) {
    console.error('Error al listar asistencias:', err);
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="text-center py-8 text-rose-400">
          <i data-lucide="alert-triangle" class="h-6 w-6 mx-auto mb-2"></i>
          Error al cargar asistencias: ${err.message}
        </td>
      </tr>
    `;
    if (window.lucide) window.lucide.createIcons();
  }
}
window.loadAsistenciasData = loadAsistenciasData;

function handleAsistenciasFilterChange() {
  clearTimeout(asistenciaFilterTimeout);
  asistenciaFilterTimeout = setTimeout(() => {
    window.asistenciaPaginationState.page = 1;
    loadAsistenciasData();
  }, 200);
}
window.handleAsistenciasFilterChange = handleAsistenciasFilterChange;

function changeAsistenciaPage(delta) {
  const target = window.asistenciaPaginationState.page + delta;
  if (target >= 1 && target <= window.asistenciaPaginationState.totalPages) {
    window.asistenciaPaginationState.page = target;
    loadAsistenciasData();
  }
}
window.changeAsistenciaPage = changeAsistenciaPage;

// 3. Directorio de Contactos
async function loadContactosData() {
  const tbody = document.getElementById('tabla-contactos-body');
  if (!tbody) return;

  const search = document.getElementById('filter-contactos-search')?.value.trim() || '';

  try {
    const res = await window.api.invokeRoute({
      url: `/api/asistencias/contactos?search=${encodeURIComponent(search)}`,
      method: 'GET'
    });

    if (res && res.status === 200 && Array.isArray(res.data)) {
      const contacts = res.data;
      if (contacts.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="6" class="text-center py-10 text-text-tertiary">
              <i data-lucide="users" class="h-6 w-6 mx-auto mb-2 text-text-tertiary"></i>
              No hay funcionarios registrados en el directorio.
            </td>
          </tr>
        `;
        if (window.lucide) window.lucide.createIcons();
        return;
      }

      tbody.innerHTML = contacts.map(c => `
        <tr class="hover:bg-border-ui/50 transition-colors">
          <td class="px-4 py-3 font-bold text-text-primary flex items-center gap-2">
            <div class="h-7 w-7 rounded-lg bg-brand-500/10 text-brand-400 flex items-center justify-center font-bold text-xs shrink-0">
              ${(c.nombre || 'U').charAt(0).toUpperCase()}
            </div>
            <div>
              <span>${c.nombre}</span>
              ${c.notas ? `<p class="text-[10px] text-text-tertiary font-normal italic">${c.notas}</p>` : ''}
            </div>
          </td>
          <td class="px-4 py-3 text-text-secondary">
            ${c.depto_habitual || '<span class="text-text-tertiary italic">No especificado</span>'}
          </td>
          <td class="px-4 py-3 text-text-secondary font-mono text-[11px]">
            ${c.correo || '<span class="text-text-tertiary italic">Sin correo</span>'}
          </td>
          <td class="px-4 py-3 text-text-secondary">
            ${c.telefono_anexo || '<span class="text-text-tertiary italic">Sin anexo</span>'}
          </td>
          <td class="px-3 py-3 text-center">
            <button onclick="filtrarBitacoraPorContacto('${c.nombre}')" class="px-2 py-0.5 rounded-full bg-brand-500/15 text-brand-400 hover:bg-brand-500/20 border border-brand-500/30 text-[10px] font-bold transition-all cursor-pointer" title="Ver atenciones de este contacto">
              ${c.total_asistencias || 0} atenciones
            </button>
          </td>
          <td class="px-4 py-3 text-right">
            <div class="flex items-center justify-end gap-1">
              <button onclick="openModalEditarContacto(${c.id})" class="p-1.5 rounded-lg bg-border-ui/50 hover:bg-border-ui/50 text-text-secondary hover:text-text-primary border border-border-ui transition-all cursor-pointer" title="Editar contacto">
                <i data-lucide="edit-3" class="h-3.5 w-3.5"></i>
              </button>
            </div>
          </td>
        </tr>
      `).join('');

      if (window.lucide) window.lucide.createIcons();
    }
  } catch (err) {
    console.error('Error al listar contactos:', err);
  }
}
window.loadContactosData = loadContactosData;

function handleContactosFilterChange() {
  clearTimeout(contactosFilterTimeout);
  contactosFilterTimeout = setTimeout(loadContactosData, 200);
}
window.handleContactosFilterChange = handleContactosFilterChange;

function filtrarBitacoraPorContacto(nombre) {
  changeAsistenciaSubTab('bitacora');
  setTimeout(() => {
    const input = document.getElementById('filter-asistencia-search');
    if (input) {
      input.value = nombre;
      handleAsistenciasFilterChange();
    }
  }, 100);
}
window.filtrarBitacoraPorContacto = filtrarBitacoraPorContacto;

// 4. Abrir Consola Flotante Independiente para Detalle y Edición
async function openModalDetalleAsistencia(id) {
  if (window.api && window.api.openAssistanceWindow) {
    await window.api.openAssistanceWindow(id);
  }
}
window.openModalDetalleAsistencia = openModalDetalleAsistencia;

// 5. Modal Crear Asistencia desde la Ventana Principal
function openModalCrearAsistencia() {
  openAssistanceConsole();
}
window.openModalCrearAsistencia = openModalCrearAsistencia;

// 6. Modal Nuevo / Editar Contacto
function openModalNuevoContacto() {
  openModalEditarContacto(null);
}
window.openModalNuevoContacto = openModalNuevoContacto;

async function openModalEditarContacto(id) {
  let contact = { nombre: '', depto_habitual: '', correo: '', telefono_anexo: '', notas: '' };
  if (id) {
    try {
      const res = await window.api.invokeRoute({ url: '/api/asistencias/contactos', method: 'GET' });
      if (res && res.status === 200 && Array.isArray(res.data)) {
        const found = res.data.find(c => c.id === id);
        if (found) contact = found;
      }
    } catch (err) {
      console.error('Error al cargar detalle de contacto:', err);
      showToast('No se pudo cargar la información del contacto.', 'error');
    }
  }

  const modal = document.getElementById('modal-container');
  if (!modal) return;

  modal.innerHTML = `
    <div class="fixed inset-0 bg-bg-main backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div class="bg-bg-card border border-border-ui rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-fade-in flex flex-col">
        
        <div class="p-4 border-b border-border-ui flex items-center justify-between bg-bg-main">
          <h3 class="font-bold text-sm text-text-primary flex items-center gap-2">
            <i data-lucide="user" class="h-4 w-4 text-brand-400"></i>
            <span>${id ? 'Editar Contacto' : 'Nuevo Contacto de Asistencia'}</span>
          </h3>
          <button onclick="closeModal()" class="p-1.5 rounded-lg hover:bg-border-ui/50 text-text-tertiary hover:text-text-primary transition-all cursor-pointer">
            <i data-lucide="x" class="h-4 w-4"></i>
          </button>
        </div>

        <div class="p-4 space-y-3 text-xs">
          <div>
            <label class="text-[10px] font-bold uppercase text-text-tertiary block mb-1">Nombre Completo *</label>
            <input type="text" id="modal-contacto-nombre" value="${contact.nombre}" placeholder="Ej. Lorena Soto" class="w-full bg-bg-main border border-border-ui rounded-lg p-2 text-text-primary focus:border-brand-500 font-medium">
          </div>
          <div>
            <label class="text-[10px] font-bold uppercase text-text-tertiary block mb-1">Dirección / Depto Habitual</label>
            <input type="text" id="modal-contacto-depto" value="${contact.depto_habitual || ''}" placeholder="Ej. Dirección de Tránsito" class="w-full bg-bg-main border border-border-ui rounded-lg p-2 text-text-primary focus:border-brand-500">
          </div>
          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="text-[10px] font-bold uppercase text-text-tertiary block mb-1">Correo (@maipu.cl)</label>
              <input type="text" id="modal-contacto-correo" value="${contact.correo || ''}" placeholder="lsoto@maipu.cl" class="w-full bg-bg-main border border-border-ui rounded-lg p-2 text-text-primary focus:border-brand-500">
            </div>
            <div>
              <label class="text-[10px] font-bold uppercase text-text-tertiary block mb-1">Anexo / Teléfono</label>
              <input type="text" id="modal-contacto-telefono" value="${contact.telefono_anexo || ''}" placeholder="4321" class="w-full bg-bg-main border border-border-ui rounded-lg p-2 text-text-primary focus:border-brand-500">
            </div>
          </div>
          <div>
            <label class="text-[10px] font-bold uppercase text-text-tertiary block mb-1">Notas Internas</label>
            <textarea id="modal-contacto-notas" rows="2" placeholder="Observaciones o notas de contacto..." class="w-full bg-bg-main border border-border-ui rounded-lg p-2 text-text-primary focus:border-brand-500 resize-none">${contact.notas || ''}</textarea>
          </div>
        </div>

        <div class="p-3 border-t border-border-ui bg-bg-main flex items-center justify-end gap-2">
          <button onclick="closeModal()" class="px-3 py-1.5 rounded-lg bg-border-ui/50 hover:bg-border-ui/50 text-text-secondary text-xs font-semibold cursor-pointer">
            Cancelar
          </button>
          <button onclick="guardarContacto(${id || 'null'})" class="px-4 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold cursor-pointer">
            Guardar Contacto
          </button>
        </div>

      </div>
    </div>
  `;

  modal.classList.remove('hidden');
  if (window.lucide) window.lucide.createIcons();
}
window.openModalEditarContacto = openModalEditarContacto;

async function guardarContacto(id) {
  const nombre = document.getElementById('modal-contacto-nombre')?.value.trim();
  const depto = document.getElementById('modal-contacto-depto')?.value.trim();
  const correo = document.getElementById('modal-contacto-correo')?.value.trim();
  const telefono = document.getElementById('modal-contacto-telefono')?.value.trim();
  const notas = document.getElementById('modal-contacto-notas')?.value.trim();

  if (!nombre) {
    showToast('El nombre del funcionario es obligatorio.', 'error');
    return;
  }

  try {
    const url = id ? `/api/asistencias/contactos/${id}` : '/api/asistencias/contactos';
    const method = id ? 'PUT' : 'POST';

    const res = await window.api.invokeRoute({
      url,
      method,
      body: {
        nombre,
        depto_habitual: depto,
        correo,
        telefono_anexo: telefono,
        notas
      }
    });

    if (res && (res.status === 200 || res.status === 201)) {
      showToast('Contacto guardado exitosamente.', 'success');
      closeModal();
      loadContactosData();
    } else {
      showToast('Error: ' + (res?.data?.error || 'No se pudo guardar'), 'error');
    }
  } catch (err) {
    showToast('Error de red: ' + err.message, 'error');
  }
}
window.guardarContacto = guardarContacto;

// 7. Modal de Unificación de Contactos (Merge Duplicados)
async function openModalMergeContactos() {
  try {
    const res = await window.api.invokeRoute({ url: '/api/asistencias/contactos', method: 'GET' });
    if (!res || res.status !== 200 || !Array.isArray(res.data)) {
      showToast('No se pudieron obtener los contactos para unificar.', 'error');
      return;
    }

    const contacts = res.data;
    if (contacts.length < 2) {
      showToast('Se requieren al menos 2 contactos en el directorio para realizar una unificación.', 'info');
      return;
    }

    const modal = document.getElementById('modal-container');
    if (!modal) return;

    modal.innerHTML = `
      <div class="fixed inset-0 bg-bg-main backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div class="bg-bg-card border border-border-ui rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-fade-in flex flex-col max-h-[90vh]">
          
          <div class="p-4 border-b border-border-ui flex items-center justify-between bg-bg-main">
            <h3 class="font-bold text-sm text-text-primary flex items-center gap-2">
              <i data-lucide="git-merge" class="h-4 w-4 text-purple-400"></i>
              <span>Unificar Contactos Duplicados</span>
            </h3>
            <button onclick="closeModal()" class="p-1.5 rounded-lg hover:bg-border-ui/50 text-text-tertiary hover:text-text-primary transition-all cursor-pointer">
              <i data-lucide="x" class="h-4 w-4"></i>
            </button>
          </div>

          <div class="p-4 overflow-y-auto space-y-4 text-xs">
            <p class="text-text-secondary">
              Esta herramienta fusiona los registros duplicados en un único contacto principal. Todas las bitácoras asociadas se reasignarán automáticamente.
            </p>

            <div>
              <label class="text-[10px] font-bold uppercase text-emerald-400 block mb-1">1. Selecciona el Contacto Principal (Destino que prevalece):</label>
              <select id="merge-target-id" class="w-full glass-input border border-border-ui rounded-lg p-2 text-text-primary focus:border-brand-500 font-medium">
                ${contacts.map(c => `<option value="${c.id}">${c.nombre} (${c.depto_habitual || 'Sin Depto'}) - ${c.total_asistencias} atenciones</option>`).join('')}
              </select>
            </div>

            <div>
              <label class="text-[10px] font-bold uppercase text-rose-400 block mb-1">2. Marca los contactos duplicados que serán absorbidos y eliminados:</label>
              <div class="bg-bg-main border border-border-ui rounded-lg p-2 max-h-48 overflow-y-auto divide-y divide-border-ui space-y-1">
                ${contacts.map(c => `
                  <label class="flex items-center gap-2 p-1.5 hover:bg-border-ui rounded cursor-pointer">
                    <input type="checkbox" name="merge-source" value="${c.id}" class="rounded border-border-ui bg-bg-card text-purple-600 focus:ring-0">
                    <span class="font-medium text-text-secondary">${c.nombre}</span>
                    <span class="text-[10px] text-text-tertiary">(${c.depto_habitual || 'Sin depto'}) · ${c.total_asistencias} atenciones</span>
                  </label>
                `).join('')}
              </div>
            </div>
          </div>

          <div class="p-3 border-t border-border-ui bg-bg-main flex items-center justify-end gap-2">
            <button onclick="closeModal()" class="px-3 py-1.5 rounded-lg bg-border-ui/50 hover:bg-border-ui/50 text-text-secondary text-xs font-semibold cursor-pointer">
              Cancelar
            </button>
            <button onclick="ejecutarMergeContactos()" class="px-4 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold cursor-pointer flex items-center gap-1.5">
              <i data-lucide="git-merge" class="h-3.5 w-3.5"></i>
              <span>Unificar y Reasignar</span>
            </button>
          </div>

        </div>
      </div>
    `;

    modal.classList.remove('hidden');
    if (window.lucide) window.lucide.createIcons();
  } catch (err) {
    showToast('Error al abrir unificador: ' + err.message, 'error');
  }
}
window.openModalMergeContactos = openModalMergeContactos;

async function ejecutarMergeContactos() {
  const targetId = parseInt(document.getElementById('merge-target-id')?.value, 10);
  const checkedBoxes = document.querySelectorAll('input[name="merge-source"]:checked');
  const sourceIds = Array.from(checkedBoxes).map(cb => parseInt(cb.value, 10)).filter(id => id !== targetId);

  if (sourceIds.length === 0) {
    showToast('Debes seleccionar al menos un contacto duplicado diferente al destino.', 'error');
    return;
  }

  openConfirmModal(
    'Confirmar Unificación de Contactos',
    `¿Confirmas la unificación de ${sourceIds.length} contacto(s) en el contacto principal? Todos los tickets asociados serán reasignados y las fichas duplicadas se eliminarán permanentemente.`,
    async () => {
      try {
        const res = await window.api.invokeRoute({
          url: '/api/asistencias/contactos/unificar',
          method: 'POST',
          body: {
            target_id: targetId,
            source_ids: sourceIds
          }
        });

        if (res && res.status === 200) {
          showToast(res.data.message || 'Contactos unificados con éxito.', 'success');
          closeModal();
          loadContactosData();
          loadAsistenciaStats();
          loadAsistenciasData();
        } else {
          showToast('Error al unificar: ' + (res?.data?.error || 'Error desconocido'), 'error');
        }
      } catch (err) {
        showToast('Error de red: ' + (typeof translateError === 'function' ? translateError(err.message) : err.message), 'error');
      }
    }
  );
}
window.ejecutarMergeContactos = ejecutarMergeContactos;

// 8. Eliminar Asistencia
async function eliminarAsistencia(id, codigo) {
  openConfirmModal(
    'Eliminar Registro de Asistencia',
    `¿Estás seguro de eliminar el registro ${codigo}? Esta acción es permanente y no se puede deshacer.`,
    async () => {
      try {
        const res = await window.api.invokeRoute({
          url: `/api/asistencias/${id}`,
          method: 'DELETE'
        });

        if (res && res.status === 200) {
          showToast(`Registro ${codigo} eliminado.`, 'success');
          loadAsistenciaStats();
          loadAsistenciasData();
        } else {
          showToast('Error al eliminar: ' + (res?.data?.error || 'Error desconocido'), 'error');
        }
      } catch (err) {
        showToast('Error de red: ' + (typeof translateError === 'function' ? translateError(err.message) : err.message), 'error');
      }
    }
  );
}
window.eliminarAsistencia = eliminarAsistencia;

// 9. Reenviar Correo / Generar PDF desde Fila
async function prepararCorreoDesdeFila(id) {
  try {
    const res = await window.api.invokeRoute({ url: `/api/asistencias/${id}`, method: 'GET' });
    if (!res || res.status !== 200 || !res.data) return;

    const ast = res.data;
    const subject = `[LobbyControl] Comprobante de Asistencia Técnica N° ${ast.ticket_codigo}`;
    const bodyHtml = `
      <div style="font-family: Arial, sans-serif; font-size: 13px; color: #1e293b; max-width: 600px;">
        <div style="background-color: #0f172a; color: #ffffff; padding: 14px 18px; border-radius: 8px 8px 0 0;">
          <h2 style="margin: 0; font-size: 15px; font-weight: bold;">Municipalidad de Maipú — Plataforma LobbyControl</h2>
          <p style="margin: 4px 0 0 0; font-size: 12px; color: #94a3b8;">Comprobante de Asistencia Técnica (Ley N° 20.730 de Lobby)</p>
        </div>
        <div style="padding: 18px; border: 1px solid #cbd5e1; border-top: none; border-radius: 0 0 8px 8px; background: #ffffff;">
          <p>Estimado(a) <strong>${ast.solicitante_nombre}</strong>${ast.solicitante_cargo_depto ? ' (' + ast.solicitante_cargo_depto + ')' : ''}:</p>
          <p>A continuación se detalla el registro y orientación técnica brindada a su consulta:</p>
          
          <table style="width: 100%; border-collapse: collapse; margin: 14px 0;">
            <tr style="background: #f8fafc;">
              <td style="padding: 8px 10px; border: 1px solid #e2e8f0; font-weight: bold; width: 140px;">Ticket N°:</td>
              <td style="padding: 8px 10px; border: 1px solid #e2e8f0;"><span style="font-family: monospace; font-weight: bold; color: #0284c7;">${ast.ticket_codigo}</span></td>
            </tr>
            ${ast.folio_lobby ? `
            <tr>
              <td style="padding: 8px 10px; border: 1px solid #e2e8f0; font-weight: bold;">Folio Lobby:</td>
              <td style="padding: 8px 10px; border: 1px solid #e2e8f0;"><span style="font-family: monospace; font-weight: bold;">${ast.folio_lobby}</span></td>
            </tr>` : ''}
            <tr style="background: #f8fafc;">
              <td style="padding: 8px 10px; border: 1px solid #e2e8f0; font-weight: bold;">Fecha de Atención:</td>
              <td style="padding: 8px 10px; border: 1px solid #e2e8f0;">${ast.fecha_hora ? ast.fecha_hora.replace('T', ' ').substring(0, 16) : ''}</td>
            </tr>
            <tr>
              <td style="padding: 8px 10px; border: 1px solid #e2e8f0; font-weight: bold;">Motivo de Consulta:</td>
              <td style="padding: 8px 10px; border: 1px solid #e2e8f0;">${ast.motivo_consulta}</td>
            </tr>
            <tr style="background: #f0fdf4;">
              <td style="padding: 8px 10px; border: 1px solid #bbf7d0; font-weight: bold; color: #166534;">Orientación / Solución:</td>
              <td style="padding: 8px 10px; border: 1px solid #bbf7d0; color: #14532d;">${(ast.solucion_orientacion || 'Atención brindada conforme a normativa.').replace(/\n/g, '<br>')}</td>
            </tr>
          </table>

          <p style="font-size: 11px; color: #64748b; margin-top: 18px; border-top: 1px solid #e2e8f0; padding-top: 10px;">
            Este comprobante es generado automáticamente por la plataforma <strong>LobbyControl</strong> de la Secretaría Municipal. Ante dudas, contactar al Administrador de Lobby.
          </p>
        </div>
      </div>
    `;

    if (window.api && window.api.generateEmlAndOpen) {
      await window.api.generateEmlAndOpen({
        to: ast.solicitante_correo || '',
        subject,
        bodyHtml,
        ticketCodigo: ast.ticket_codigo
      });
    }
  } catch (e) {
    showToast('Error al abrir correo: ' + e.message, 'error');
  }
}
window.prepararCorreoDesdeFila = prepararCorreoDesdeFila;

async function generarPdfDesdeFila(id) {
  try {
    const res = await window.api.invokeRoute({ url: `/api/asistencias/${id}`, method: 'GET' });
    if (!res || res.status !== 200 || !res.data) return;
    const ast = res.data;

    const savePathRes = await window.api.selectSavePath({
      defaultName: `Ficha_Asistencia_${ast.ticket_codigo}.pdf`
    });
    if (!savePathRes || savePathRes.cancelled || !savePathRes.filePath) return;

    showToast('Generando ficha PDF...');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 11px; color: #1e293b; padding: 25px; line-height: 1.4; }
          .header { border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 18px; }
          .title { font-size: 16px; font-weight: bold; color: #0f172a; }
          .subtitle { font-size: 11px; color: #64748b; margin-top: 3px; }
          .badge { font-family: monospace; font-size: 13px; font-weight: bold; color: #0284c7; background: #e0f2fe; padding: 4px 8px; border-radius: 4px; display: inline-block; }
          .table-info { width: 100%; border-collapse: collapse; margin-top: 15px; }
          .table-info td { padding: 7px 10px; border: 1px solid #cbd5e1; }
          .table-info td.label { font-weight: bold; background: #f8fafc; width: 140px; }
          .box-solucion { background: #f0fdf4; border: 1px solid #86efac; border-radius: 6px; padding: 12px; margin-top: 15px; }
          .footer { margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 10px; font-size: 9px; color: #94a3b8; text-align: center; }
        </style>
      </head>
      <body>
        <div class="header">
          <table style="width: 100%;">
            <tr>
              <td>
                <div class="title">MUNICIPALIDAD DE MAIPÚ</div>
                <div class="subtitle">Secretaría Municipal — Plataforma LobbyControl (Ley N° 20.730)</div>
                <div class="subtitle">Ficha de Asistencia Técnica y Orientación Normativa</div>
              </td>
              <td style="text-align: right;">
                <div class="badge">${ast.ticket_codigo}</div>
                <div style="font-size: 10px; color: #64748b; margin-top: 4px;">Fecha: ${ast.fecha_hora ? ast.fecha_hora.replace('T', ' ').substring(0, 16) : ''}</div>
              </td>
            </tr>
          </table>
        </div>

        <table class="table-info">
          <tr>
            <td class="label">Funcionario / Solicitante:</td>
            <td><strong>${ast.solicitante_nombre}</strong></td>
          </tr>
          <tr>
            <td class="label">Dirección / Depto:</td>
            <td>${ast.solicitante_cargo_depto || 'No especificado'}</td>
          </tr>
          <tr>
            <td class="label">Correo / Contacto:</td>
            <td>${ast.solicitante_correo || ''} ${ast.solicitante_contacto ? ' (' + ast.solicitante_contacto + ')' : ''}</td>
          </tr>
          <tr>
            <td class="label">Canal y Categoría:</td>
            <td>Canal: ${ast.canal.toUpperCase()} | Materia: ${ast.categoria.toUpperCase()}</td>
          </tr>
          ${ast.folio_lobby ? `<tr><td class="label">Folio Vinculado:</td><td><code>${ast.folio_lobby}</code></td></tr>` : ''}
          <tr>
            <td class="label">Motivo de Consulta:</td>
            <td>${ast.motivo_consulta}</td>
          </tr>
        </table>

        <div class="box-solucion">
          <strong style="color: #166534;">ORIENTACIÓN Y SOLUCIÓN BRINDADA:</strong>
          <p style="margin: 6px 0 0 0; color: #14532d;">${(ast.solucion_orientacion || 'Atención concluida satisfactoriamente.').replace(/\n/g, '<br>')}</p>
        </div>

        <div class="footer">
          Documento generado automáticamente por LobbyControl — Municipalidad de Maipú.
        </div>
      </body>
      </html>
    `;

    const pdfRes = await window.api.generateSilentPdf({
      html: htmlContent,
      filePath: savePathRes.filePath
    });

    if (pdfRes && pdfRes.success) {
      const folderPath = savePathRes.filePath.replace(/[\\/][^\\/]+$/, '');
      showToast(`Ficha ${ast.ticket_codigo} guardada correctamente.`, 'success', {
        duration: 7500,
        action: {
          label: 'Abrir carpeta',
          icon: 'folder',
          onClick: () => {
            if (window.api && window.api.openPath) window.api.openPath(folderPath);
          }
        }
      });
    } else {
      showToast('Error al generar PDF: ' + (pdfRes?.error || 'Error desconocido'), 'error');
    }
  } catch (e) {
    showToast('Error al generar ficha PDF: ' + e.message, 'error');
  }
}
window.generarPdfDesdeFila = generarPdfDesdeFila;

// 10. Exportaciones Masivas (Excel y Reporte Consolidado PDF)
async function exportAsistenciasExcel() {
  try {
    const search = document.getElementById('filter-asistencia-search')?.value.trim() || '';
    const canal = document.getElementById('filter-asistencia-canal')?.value || 'todos';
    const categoria = document.getElementById('filter-asistencia-categoria')?.value || 'todas';
    const estado = document.getElementById('filter-asistencia-estado')?.value || 'todos';

    const params = new URLSearchParams({ page: 1, limit: 10000 });
    if (search) params.append('search', search);
    if (canal !== 'todos') params.append('canal', canal);
    if (categoria !== 'todas') params.append('categoria', categoria);
    if (estado !== 'todos') params.append('estado', estado);

    const res = await window.api.invokeRoute({
      url: `/api/asistencias?${params.toString()}`,
      method: 'GET'
    });

    if (!res || res.status !== 200 || !res.data.rows || res.data.rows.length === 0) {
      showToast('No hay registros para exportar con los filtros actuales.', 'info');
      return;
    }

    const defaultName = `Bitacora_Asistencias_Lobby_${new Date().toISOString().split('T')[0]}.xlsx`;
    const saveRes = await window.api.selectSavePath({ defaultName });
    if (saveRes.cancelled || !saveRes.filePath) return;

    showToast('Generando archivo Excel...');

    const columns = [
      { header: 'Ticket', key: 'ticket_codigo', width: 16 },
      { header: 'Fecha y Hora', key: 'fecha_hora', width: 20 },
      { header: 'Solicitante', key: 'solicitante_nombre', width: 28 },
      { header: 'Dirección / Depto', key: 'solicitante_cargo_depto', width: 28 },
      { header: 'Correo', key: 'solicitante_correo', width: 25 },
      { header: 'Contacto / Anexo', key: 'solicitante_contacto', width: 18 },
      { header: 'Canal', key: 'canal', width: 14 },
      { header: 'Materia', key: 'categoria', width: 18 },
      { header: 'Folio Lobby', key: 'folio_lobby', width: 18 },
      { header: 'Motivo de Consulta', key: 'motivo_consulta', width: 40 },
      { header: 'Solución / Orientación', key: 'solucion_orientacion', width: 45 },
      { header: 'Estado', key: 'estado', width: 15 },
      { header: 'Duración (min)', key: 'duracion_minutos', width: 14 },
      { header: 'Atendido Por', key: 'created_by', width: 22 }
    ];

    const excelRes = await window.api.generateExcelFile({
      data: res.data.rows,
      columns,
      filePath: saveRes.filePath,
      sheetName: 'Bitácora Asistencias'
    });

    if (excelRes && excelRes.success) {
      const folderPath = saveRes.filePath.replace(/[\\/][^\\/]+$/, '');
      showToast('Bitácora exportada a Excel correctamente.', 'success', {
        duration: 7500,
        action: {
          label: 'Abrir carpeta',
          icon: 'folder',
          onClick: () => {
            if (window.api && window.api.openPath) window.api.openPath(folderPath);
          }
        }
      });
    } else {
      showToast('Error al exportar a Excel: ' + (excelRes?.error || 'Error desconocido'), 'error');
    }
  } catch (e) {
    showToast('Error al generar Excel: ' + e.message, 'error');
  }
}
window.exportAsistenciasExcel = exportAsistenciasExcel;

async function exportAsistenciasConsolidadoPDF() {
  try {
    const search = document.getElementById('filter-asistencia-search')?.value.trim() || '';
    const canal = document.getElementById('filter-asistencia-canal')?.value || 'todos';
    const categoria = document.getElementById('filter-asistencia-categoria')?.value || 'todas';
    const estado = document.getElementById('filter-asistencia-estado')?.value || 'todos';

    const params = new URLSearchParams({ page: 1, limit: 1000 });
    if (search) params.append('search', search);
    if (canal !== 'todos') params.append('canal', canal);
    if (categoria !== 'todas') params.append('categoria', categoria);
    if (estado !== 'todos') params.append('estado', estado);

    const res = await window.api.invokeRoute({
      url: `/api/asistencias?${params.toString()}`,
      method: 'GET'
    });

    if (!res || res.status !== 200 || !res.data.rows || res.data.rows.length === 0) {
      showToast('No hay registros para exportar en el informe PDF.', 'info');
      return;
    }

    const defaultName = `Informe_Consolidado_Asistencias_${new Date().toISOString().split('T')[0]}.pdf`;
    const saveRes = await window.api.selectSavePath({ defaultName });
    if (saveRes.cancelled || !saveRes.filePath) return;

    showToast('Generando informe consolidado PDF...');

    const rows = res.data.rows;
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 9px; color: #1e293b; padding: 20px; line-height: 1.3; }
          .header { border-bottom: 2px solid #0f172a; padding-bottom: 10px; margin-bottom: 14px; }
          .title { font-size: 14px; font-weight: bold; color: #0f172a; }
          .subtitle { font-size: 10px; color: #64748b; margin-top: 2px; }
          .table-data { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 8.5px; }
          .table-data th { background: #0f172a; color: #ffffff; padding: 6px 8px; text-align: left; font-size: 8px; text-transform: uppercase; }
          .table-data td { padding: 6px 8px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
          .table-data tr:nth-child(even) { background: #f8fafc; }
          .badge { font-family: monospace; font-weight: bold; color: #0284c7; }
          .footer { margin-top: 25px; border-top: 1px solid #e2e8f0; padding-top: 8px; font-size: 8px; color: #94a3b8; text-align: center; }
        </style>
      </head>
      <body>
        <div class="header">
          <table style="width: 100%;">
            <tr>
              <td>
                <div class="title">MUNICIPALIDAD DE MAIPÚ</div>
                <div class="subtitle">Secretaría Municipal — Plataforma LobbyControl (Ley N° 20.730)</div>
                <div class="subtitle">Informe Consolidado de Asistencia Técnica y Consultas Normativas</div>
              </td>
              <td style="text-align: right;">
                <div style="font-size: 9px; color: #64748b;">Fecha Emisión: ${new Date().toLocaleDateString('es-CL')}</div>
                <div style="font-size: 9px; color: #0f172a; font-weight: bold;">Total Atenciones: ${rows.length}</div>
              </td>
            </tr>
          </table>
        </div>

        <table class="table-data">
          <thead>
            <tr>
              <th style="width: 75px;">Ticket / Fecha</th>
              <th style="width: 120px;">Solicitante</th>
              <th style="width: 120px;">Dirección / Depto</th>
              <th style="width: 50px;">Canal</th>
              <th style="width: 70px;">Materia</th>
              <th>Motivo & Solución Brindada</th>
              <th style="width: 55px;">Estado</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(r => `
              <tr>
                <td>
                  <span class="badge">${r.ticket_codigo}</span><br>
                  <span style="color: #64748b; font-size: 7.5px;">${r.fecha_hora ? r.fecha_hora.replace('T', ' ').substring(0, 16) : ''}</span>
                </td>
                <td>
                  <strong>${r.solicitante_nombre}</strong><br>
                  <span style="color: #64748b;">${r.solicitante_correo || ''}</span>
                </td>
                <td>${r.solicitante_cargo_depto || 'General'}</td>
                <td>${r.canal.toUpperCase()}</td>
                <td>${r.categoria.toUpperCase()}</td>
                <td>
                  <strong>Consulta:</strong> ${r.motivo_consulta}<br>
                  ${r.solucion_orientacion ? '<strong style="color: #166534;">Orientación:</strong> ' + r.solucion_orientacion : ''}
                </td>
                <td><strong>${r.estado.toUpperCase()}</strong></td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="footer">
          Documento generado automáticamente por LobbyControl — Secretaría Municipal de Maipú.
        </div>
      </body>
      </html>
    `;

    const pdfRes = await window.api.generateSilentPdf({
      html: htmlContent,
      filePath: saveRes.filePath
    });

    if (pdfRes && pdfRes.success) {
      const folderPath = saveRes.filePath.replace(/[\\/][^\\/]+$/, '');
      showToast('Informe consolidado PDF guardado correctamente.', 'success', {
        duration: 7500,
        action: {
          label: 'Abrir carpeta',
          icon: 'folder',
          onClick: () => {
            if (window.api && window.api.openPath) window.api.openPath(folderPath);
          }
        }
      });
    } else {
      showToast('Error al generar PDF: ' + (pdfRes?.error || 'Error desconocido'), 'error');
    }
  } catch (e) {
    showToast('Error al exportar informe consolidado: ' + e.message, 'error');
  }
}
window.exportAsistenciasConsolidadoPDF = exportAsistenciasConsolidadoPDF;



// ==========================================
// CONTROLADORES DE CATEGORÍAS DE ASISTENCIA
// ==========================================
async function loadCategoriasData() {
  const tbody = document.getElementById('tabla-categorias-body');
  if (!tbody) return;

  try {
    const res = await window.api.invokeRoute({ url: '/api/asistencias/categorias', method: 'GET' });
    if (res && res.status === 200 && Array.isArray(res.data)) {
      const rows = res.data;
      if (rows.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center py-6 text-text-tertiary">No hay materias registradas.</td></tr>';
        return;
      }

      tbody.innerHTML = rows.map((cat, idx) => `
        <tr class="hover:bg-border-ui dark:hover:bg-border-ui/50 transition-colors">
          <td class="px-4 py-3 font-mono text-text-tertiary text-xs">${idx + 1}</td>
          <td class="px-4 py-3 font-bold text-text-primary flex items-center gap-2">
            <i data-lucide="tag" class="h-3.5 w-3.5 text-brand-600 dark:text-brand-400"></i>
            <span>${cat.nombre}</span>
          </td>
          <td class="px-4 py-3 text-text-secondary text-xs">${cat.descripcion || '-'}</td>
          <td class="px-4 py-3 text-right">
            <div class="flex items-center justify-end gap-1.5">
              <button onclick="openModalEditarCategoria(${cat.id})" class="p-1.5 rounded-lg bg-border-ui hover:bg-border-ui dark:hover:bg-border-ui/50 text-text-secondary hover:text-brand-600 dark:hover:text-brand-400 border border-border-ui transition-colors cursor-pointer" title="Editar materia">
                <i data-lucide="edit-3" class="h-3.5 w-3.5"></i>
              </button>
              <button onclick="eliminarCategoria(${cat.id}, '${cat.nombre.replace(/'/g, "\\'")}')" class="p-1.5 rounded-lg bg-border-ui hover:bg-rose-50 dark:hover:bg-rose-600/20 text-text-tertiary hover:text-rose-600 dark:hover:text-rose-400 border border-border-ui transition-colors cursor-pointer" title="Eliminar materia">
                <i data-lucide="trash-2" class="h-3.5 w-3.5"></i>
              </button>
            </div>
          </td>
        </tr>
      `).join('');

      if (window.lucide) window.lucide.createIcons();
    }
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="4" class="text-center py-6 text-rose-500">Error al cargar materias: ${err.message}</td></tr>`;
  }
}
window.loadCategoriasData = loadCategoriasData;

function openModalNuevaCategoria() {
  openModalEditarCategoria(null);
}
window.openModalNuevaCategoria = openModalNuevaCategoria;

async function openModalEditarCategoria(id) {
  let cat = { nombre: '', descripcion: '' };
  if (id) {
    try {
      const res = await window.api.invokeRoute({ url: '/api/asistencias/categorias', method: 'GET' });
      if (res && res.status === 200 && Array.isArray(res.data)) {
        const found = res.data.find(c => c.id === id);
        if (found) cat = found;
      }
    } catch (err) {
      console.error('Error al cargar categoría:', err);
      showToast('No se pudo cargar la información de la categoría.', 'error');
    }
  }

  const modal = document.getElementById('modal-container');
  if (!modal) return;

  modal.innerHTML = `
    <div class="fixed inset-0 bg-bg-main backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div class="glass-card bg-bg-card border border-border-ui rounded-3xl w-full max-w-md shadow-2xl overflow-hidden modal-animate-in flex flex-col text-text-primary text-left">
        
        <div class="p-4 border-b border-border-ui flex items-center justify-between bg-bg-main">
          <h3 class="font-bold text-sm text-text-primary flex items-center gap-2">
            <i data-lucide="tag" class="h-4 w-4 text-brand-600 dark:text-brand-400"></i>
            <span>${id ? 'Editar Materia / Categoría' : 'Nueva Materia / Categoría'}</span>
          </h3>
          <button onclick="closeModal()" class="p-1.5 rounded-lg hover:bg-border-ui dark:hover:bg-border-ui/50 text-text-tertiary hover:text-text-primary dark:hover:text-text-primary transition-colors cursor-pointer">
            <i data-lucide="x" class="h-4 w-4"></i>
          </button>
        </div>

        <div class="p-4 space-y-3 text-xs">
          <div>
            <label class="text-[10px] font-bold uppercase text-text-tertiary block mb-1">Nombre de la Materia *</label>
            <input type="text" id="modal-cat-nombre" value="${cat.nombre}" placeholder="Nombre de la materia" class="w-full bg-bg-card border border-border-ui rounded-lg p-2 text-text-primary focus:border-brand-500 font-medium">
          </div>
          <div>
            <label class="text-[10px] font-bold uppercase text-text-tertiary block mb-1">Descripción / Alcance</label>
            <textarea id="modal-cat-desc" rows="2" placeholder="Detalle o alcance de esta materia..." class="w-full bg-bg-card border border-border-ui rounded-lg p-2 text-text-primary focus:border-brand-500 resize-none">${cat.descripcion || ''}</textarea>
          </div>
        </div>

        <div class="p-3.5 border-t border-border-ui bg-bg-main flex items-center justify-end gap-2">
          <button onclick="closeModal()" class="px-3.5 py-1.5 rounded-lg bg-border-ui hover:bg-border-ui dark:hover:bg-border-ui/50 text-text-secondary text-xs font-semibold transition-colors cursor-pointer">
            Cancelar
          </button>
          <button onclick="guardarCategoria(${id || 'null'})" class="px-4 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold transition-all shadow-xs cursor-pointer">
            Guardar Materia
          </button>
        </div>

      </div>
    </div>
  `;

  modal.classList.remove('hidden');
  if (window.lucide) window.lucide.createIcons();
}
window.openModalEditarCategoria = openModalEditarCategoria;

async function guardarCategoria(id) {
  const nombre = document.getElementById('modal-cat-nombre')?.value.trim();
  const desc = document.getElementById('modal-cat-desc')?.value.trim();

  if (!nombre) {
    showToast('El nombre de la materia es obligatorio.', 'error');
    return;
  }

  try {
    const isEdit = Boolean(id);
    const url = isEdit ? `/api/asistencias/categorias/${id}` : '/api/asistencias/categorias';
    const method = isEdit ? 'PUT' : 'POST';

    const res = await window.api.invokeRoute({
      url,
      method,
      body: { nombre, descripcion: desc }
    });

    if (res && (res.status === 200 || res.status === 201)) {
      showToast(isEdit ? 'Materia actualizada con éxito.' : 'Materia creada con éxito.', 'success');
      closeModal();
      loadCategoriasData();
    } else {
      showToast('Error: ' + (res?.data?.error || 'No se pudo guardar'), 'error');
    }
  } catch (err) {
    showToast('Error al guardar materia: ' + err.message, 'error');
  }
}
window.guardarCategoria = guardarCategoria;

function eliminarCategoria(id, nombre) {
  showLobbyConfirmModal({
    title: 'Eliminar Materia',
    message: `¿Estás seguro de eliminar la materia "${nombre}"?`,
    acceptText: 'Sí, Eliminar',
    isDanger: true,
    onConfirm: async () => {
      try {
        const res = await window.api.invokeRoute({
          url: `/api/asistencias/categorias/${id}`,
          method: 'DELETE'
        });

        if (res && res.status === 200) {
          showToast('Materia eliminada exitosamente.', 'success');
          loadCategoriasData();
        } else {
          showToast('Error al eliminar materia: ' + (res?.data?.error || 'Error desconocido'), 'error');
        }
      } catch (err) {
        showToast('Error al eliminar: ' + err.message, 'error');
      }
    }
  });
}
window.eliminarCategoria = eliminarCategoria;
