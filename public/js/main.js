import { appStore } from './core/store.js';
import { eventBus } from './core/event-bus.js';
import { appRouter } from './core/router.js';

// Servicios de datos e IPC
import { apiClient } from './services/api-client.js';
import { AuthService } from './services/auth.service.js';
import { LobbyService } from './services/lobby.service.js';
import { AsistenciaService } from './services/asistencia.service.js';
import { AuditoriaService } from './services/auditoria.service.js';
import { ExportService } from './services/export.service.js';

// Utilidades puras y componentes UI
import { formatDateForDisplay, formatDateTime, formatNumber, formatPct, formatRut, sanitizeHtml } from './utils/formatters.js';
import { isHabil, calculateDeadline, getDaysRemaining } from './utils/date-calculator.js';
import { translateError } from './utils/error-translator.js';
import { getEl, getAllEl, onEvent } from './utils/dom.js';
import { openConfirmModal, closeModal } from './components/modal.component.js';
import { showToast } from './components/toast.component.js';

console.log('🚀 Inicializando LobbyControl en Arquitectura Modular ESM...');

// 1. Exponer fachada temporal controlada para compatibilidad retroactiva durante la refactorización
window.LobbyApp = {
  store: appStore,
  bus: eventBus,
  router: appRouter,
  services: {
    apiClient,
    auth: AuthService,
    lobby: LobbyService,
    asistencia: AsistenciaService,
    auditoria: AuditoriaService,
    export: ExportService
  },
  utils: {
    formatDateForDisplay,
    formatDateTime,
    formatNumber,
    formatPct,
    formatRut,
    sanitizeHtml,
    isHabil,
    calculateDeadline,
    getDaysRemaining,
    translateError,
    getEl,
    getAllEl,
    onEvent
  },
  components: {
    openConfirmModal,
    closeModal,
    showToast
  }
};

// Vistas Modulares
import { LoginView } from './views/login/login.view.js';
import { DashboardView } from './views/dashboard/dashboard.view.js';
import { SolicitudesView } from './views/solicitudes/solicitudes.view.js';
import { PublicadasView } from './views/publicadas/publicadas.view.js';
import { AdministracionView } from './views/administracion/administracion.view.js';

// Registrar rutas en el enrutador SPA
appRouter.register('login', LoginView);
appRouter.register('dashboard', DashboardView);
appRouter.register('solicitudes', SolicitudesView);
appRouter.register('publicadas', PublicadasView);
appRouter.register('administracion', AdministracionView);

// 2. Inicialización al cargar el DOM
document.addEventListener('DOMContentLoaded', async () => {
  console.log('✓ DOM cargado. Inicializando subsistemas Core...');

  // Suscribir observadores de tema
  appStore.subscribe('theme', (newTheme) => {
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  });

  // Notificar arranque completado
  eventBus.emit('app:ready', { timestamp: Date.now() });
});

export {
  appStore,
  eventBus,
  appRouter,
  apiClient,
  AuthService,
  LobbyService,
  AsistenciaService,
  AuditoriaService,
  ExportService,
  formatDateForDisplay,
  formatDateTime,
  formatNumber,
  formatPct,
  formatRut,
  sanitizeHtml,
  isHabil,
  calculateDeadline,
  getDaysRemaining,
  translateError,
  getEl,
  getAllEl,
  onEvent,
  openConfirmModal,
  closeModal,
  showToast
};
