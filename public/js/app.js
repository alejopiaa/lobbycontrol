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
  viajes: [],
  viajesStats: {},
  donativos: [],
  donativosStats: {},
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

// [MODULARIZADO] Interceptor global para redirección automática y desvío de API a IPC en Electron
// Extraído y delegado canónicamente a public/js/core/fetch-interceptor.js

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
      vigencia: 'todos',
      fechaInicio: '',
      fechaTermino: ''
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
      vigencia: 'todos',
      fechaInicio: '',
      fechaTermino: ''
    }
  },
  sujetos_pasivos: { page: 1, search: '', vigencia: 'todos', tipoFecha: 'incorporacion', fechaDesde: '', fechaHasta: '' },
  viajes: {
    page: 1,
    filters: {
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
    }
  },
  donativos: {
    page: 1,
    filters: {
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
    }
  },
  audiencias: {
    page: 1,
    subTab: 'solicitudes'
  },
  reportes: { page: 1 },
  logs: { page: 1, filterType: 'all' }
};

// Variables para control de cancelaciones asíncronas y temporizadores de UI
let activeAbortController = null;
let tooltipTimeout = null;
let hideSuggestionsTimeout = null;
let activeSujetoIdsCache = (typeof window !== 'undefined' && window.activeSujetoIdsCache instanceof Set && window.activeSujetoIdsCache.size > 0) ? window.activeSujetoIdsCache : new Set();

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

// Exposición canónica del estado global a window para módulos ESM y scripts clásicos
window.currentUser = currentUser;
window.selectedExcelFileBase64 = selectedExcelFileBase64;
window.currentView = currentView;
window.activeAdminTab = activeAdminTab;
window.dataStore = dataStore;
window.paginationState = paginationState;
window.activeAbortController = activeAbortController;
window.activeSujetoIdsCache = (window.activeSujetoIdsCache && window.activeSujetoIdsCache.size > 0) ? window.activeSujetoIdsCache : activeSujetoIdsCache;
window.dashboardFilters = dashboardFilters;
window.reportesFilters = reportesFilters;
window.dashboardDropdownCache = dashboardDropdownCache;
window.currentCalendarDate = currentCalendarDate;
window.calendarViewMode = calendarViewMode;
window.calendarFilters = calendarFilters;
window.calendarEvents = calendarEvents;

// Seguimiento dinámico de la última comprobación con la nube
// [MODULARIZADO] Autenticación, SSO, Impersonación y Sincronización en Segundo Plano
// Extraído y delegado canónicamente a public/js/services/auth-sync.service.js
const parseTimestampToMs = (...args) => (window.parseTimestampToMs || (() => 0))(...args);
const getEffectiveLastUpdate = (...args) => (window.getEffectiveLastUpdate || (() => ''))(...args);
const updateCloudCheckDisplay = (...args) => (window.updateCloudCheckDisplay || (() => {}))(...args);
const updateCapsuleStatus = (...args) => (window.updateCapsuleStatus || (() => {}))(...args);
const fetchAndUpdateDbTimestamp = (...args) => (window.fetchAndUpdateDbTimestamp || (() => {}))(...args);
const checkAuth = (...args) => (window.checkAuth || (() => Promise.resolve(false)))(...args);
const updateHeaderUserSection = (...args) => (window.updateHeaderUserSection || (() => {}))(...args);
const startImpersonation = (...args) => (window.startImpersonation || (() => {}))(...args);
const stopImpersonation = (...args) => (window.stopImpersonation || (() => {}))(...args);
const triggerSsoLogin = (...args) => (window.triggerSsoLogin || (() => {}))(...args);
const logout = (...args) => (window.logout || (() => {}))(...args);
const initBackgroundSync = (...args) => (window.initBackgroundSync || (() => {}))(...args);
const runCapsuleSync = (...args) => (window.runCapsuleSync || (() => {}))(...args);
const sincronizarSharepoint = (...args) => (window.sincronizarSharepoint || (() => {}))(...args);
const fetchAppVersion = (...args) => (window.fetchAppVersion || (() => {}))(...args);
const startLiveClock = (...args) => (window.startLiveClock || (() => {}))(...args);

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
    if (typeof initBackgroundSync === 'function') initBackgroundSync();
    const savedView = localStorage.getItem('lobby_current_view') || 'dashboard';
    switchView(savedView === 'login' ? 'dashboard' : savedView);
  } else {
    switchView('login');
  }
});


// [MODULARIZADO] Control de Paginación y Renderizado Diferido
// Extraído y delegado canónicamente a public/js/core/view-navigator.js
const changePage = (...args) => (window.changePage || (() => {}))(...args);
const changeAudienciasSubTab = (...args) => (window.changeAudienciasSubTab || (() => {}))(...args);
const debouncedSearchRender = (...args) => (window.debouncedSearchRender || (() => {}))(...args);
const debouncedFilterRender = (...args) => (window.debouncedFilterRender || (() => {}))(...args);

// [MODULARIZADO] Manejo de Filtros y Búsquedas Globales
// Extraído y delegado canónicamente a public/js/components/filter-manager.component.js
const handleSearch = (...args) => (window.handleSearch || (() => {}))(...args);
const handleMultiFilter = (...args) => (window.handleMultiFilter || (() => {}))(...args);
const clearFilters = (...args) => (window.clearFilters || (() => {}))(...args);
const filtrarRelacionados = (...args) => (window.filtrarRelacionados || (() => {}))(...args);
const clearRelacionFilter = (...args) => (window.clearRelacionFilter || (() => {}))(...args);





// [MODULARIZADO] Notificaciones Toast y Reportes Raw Data
// Delegado a public/js/components/toast.component.js y public/js/services/lobby-data.service.js
const dismissToast = (...args) => (window.dismissToast || (() => {}))(...args);
const showToast = (...args) => (window.showToast || (() => {}))(...args);
const fetchReportesData = (...args) => (window.fetchReportesData || (() => Promise.resolve()))(...args);

// [MODULARIZADO] Navegación, Enrutador y Ciclo de Renderizado de Vistas
// Extraído y delegado canónicamente a public/js/core/view-navigator.js
const switchView = (...args) => (window.switchView || (() => {}))(...args);
const renderView = (...args) => (window.renderView || (() => {}))(...args);
const renderLoader = (...args) => (window.renderLoader || (() => {}))(...args);
const hideLoader = (...args) => (window.hideLoader || (() => {}))(...args);
const renderError = (...args) => (window.renderError || (() => {}))(...args);



// [MODULARIZADO] Inicialización y Sincronización de Air-Datepicker
// Extraído y delegado canónicamente a public/js/components/datepicker.component.js
const initAirDatepickerFields = (...args) => (window.initAirDatepickerFields || (() => {}))(...args);
const syncLinkedDatepickers = (...args) => (window.syncLinkedDatepickers || (() => {}))(...args);
const syncAllLinkedDatepickers = (...args) => (window.syncAllLinkedDatepickers || (() => {}))(...args);

// [MODULARIZADO] Modales Base, Confirmación y Eliminación Genérica
// Extraído y delegado canónicamente a public/js/components/modal.component.js
const deleteRecord = (...args) => (window.deleteRecord || (() => {}))(...args);
const closeModal = (...args) => (window.closeModal || (() => {}))(...args);
const openConfirmModal = (...args) => (window.openConfirmModal || (() => {}))(...args);

// [MODULARIZADO] Notificaciones, Perfil de Usuario y Alertas
// Extraído y delegado a public/js/views/perfil/perfil.modal.js y public/js/views/alertas/alertas.view.js
const openProfileModal = (...args) => (window.openProfileModal || (() => {}))(...args);
const saveProfile = (...args) => (window.saveProfile || (() => {}))(...args);
const toggleProfileDropdown = (...args) => (window.toggleProfileDropdown || (() => {}))(...args);
const triggerEditProfile = (...args) => (window.triggerEditProfile || (() => {}))(...args);
const triggerAlertCenter = (...args) => (window.triggerAlertCenter || (() => {}))(...args);
const renderAlertasWidget = (...args) => (window.renderAlertasWidget || (() => {}))(...args);
