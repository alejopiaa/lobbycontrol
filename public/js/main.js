import './core/fetch-interceptor.js';
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
import {
  renderGlassCard,
  renderSearchInput,
  syncSearchInputBadge,
  renderDateInput,
  renderSelectInput,
  renderStatusBadge,
  renderPaginationControls,
  renderVigenciaSelect,
  renderTableListViewLayout
} from './components/ui.js';

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
    showToast,
    renderGlassCard,
    renderSearchInput,
    syncSearchInputBadge,
    renderDateInput,
    renderSelectInput,
    renderStatusBadge,
    renderPaginationControls,
    renderVigenciaSelect,
    renderTableListViewLayout
  }
};

// Vistas Modulares
import { LoginView } from './views/login/login.view.js';
import { DashboardView } from './views/dashboard/dashboard.view.js';
import { EstadisticasView } from './views/estadisticas/estadisticas.view.js';
import { SolicitudesView } from './views/solicitudes/solicitudes.view.js';
import { PendientesPublicacionView } from './views/pendientesPublicacion/pendientesPublicacion.view.js';
import { AudienciasPublicadasView } from './views/audienciasPublicadas/audienciasPublicadas.view.js';
import { PublicadasView } from './views/publicadas/publicadas.view.js';
import { AdministracionView } from './views/administracion/administracion.view.js';
import { ViajesView } from './views/viajes/viajes.view.js';
import { AudienciasView } from './views/audiencias/audiencias.view.js';
import { DonativosView } from './views/donativos/donativos.view.js';
import { AlertasView } from './views/alertas/alertas.view.js';
import { AgendaView } from './views/agenda/agenda.view.js';
import { SujetosPasivosView } from './views/sujetos-pasivos/sujetos-pasivos.view.js';
import { ReportesView } from './views/reportes/reportes.view.js';
// Servicios base y utilidades de soporte
import './services/lobby-data.service.js';
import './services/auth-sync.service.js';
import './components/datepicker.component.js';
import './components/filter-manager.component.js';
import './components/dom-dispatcher.component.js';
import './views/dashboard/dashboard.search.js';
import './views/administracion/asistencia.tab.js';
import './views/administracion/logs.tab.js';
import './views/administracion/database.tab.js';
import './views/administracion/usuarios.tab.js';
import './views/administracion/sync.tab.js';
import './views/administracion/auditoria.tab.js';
import './views/perfil/perfil.modal.js';

// Orquestador de navegación y ciclo de vida de vistas
import './core/view-navigator.js';

appRouter.register('login', LoginView);
appRouter.register('dashboard', DashboardView);
appRouter.register('escritorio', DashboardView);
appRouter.register('estadisticas', EstadisticasView);
appRouter.register('audiencias', AudienciasView);
appRouter.register('solicitudes', SolicitudesView);
appRouter.register('pendientes', PendientesPublicacionView);
appRouter.register('pendientesPublicacion', PendientesPublicacionView);
appRouter.register('publicadas', AudienciasPublicadasView);
appRouter.register('audienciasPublicadas', AudienciasPublicadasView);
appRouter.register('administracion', AdministracionView);
appRouter.register('viajes', ViajesView);
appRouter.register('donativos', DonativosView);
appRouter.register('alertas', AlertasView);
appRouter.register('agenda', AgendaView);
appRouter.register('sujetos_pasivos', SujetosPasivosView);
appRouter.register('reportes', ReportesView);

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
  showToast,
  renderGlassCard,
  renderSearchInput,
  syncSearchInputBadge,
  renderDateInput,
  renderSelectInput,
  renderStatusBadge,
  renderPaginationControls,
  renderVigenciaSelect,
  renderTableListViewLayout
};
