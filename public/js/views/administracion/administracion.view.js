/**
 * AdministracionView - Vista contenedora con selector segmentado de 2 ámbitos (Gestión vs Sistema)
 */
import { appStore } from '../../core/store.js';

export const AdministracionView = {
  currentTab: 'auditoria',

  mount(container, params = {}) {
    const rol = (appStore.state.currentUser && appStore.state.currentUser.rol) || '';
    
    // Por defecto al entrar: Ámbito de Gestión a la izquierda
    appStore.state.activeAdminScope = 'gestion';
    this.currentTab = rol === 'Auditor' ? 'sujetos' : (params.tab || 'auditoria');

    this.renderContainer(container);
    this.renderActiveTab(container);
  },

  renderContainer(container) {
    const rol = (appStore.state.currentUser && appStore.state.currentUser.rol) || '';
    const currentScope = appStore.state.activeAdminScope || 'gestion';

    const tabClass = (name) => `border-b-2 py-3 px-1 text-xs font-bold transition-all flex items-center gap-2 focus:outline-none shrink-0 cursor-pointer ${
      this.currentTab === name
        ? 'border-brand-500 text-brand-600 dark:text-brand-400'
        : 'border-transparent text-text-tertiary hover:text-text-primary hover:border-border-ui'
    }`;

    const scopeBtnClass = (scope) => `px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
      currentScope === scope
        ? 'bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/30 shadow-xs'
        : 'bg-transparent text-text-tertiary hover:text-text-primary hover:bg-border-ui/40 border border-transparent'
    }`;

    let tabsListHtml = '';
    if (currentScope === 'gestion' || rol === 'Auditor') {
      tabsListHtml = `
        ${rol !== 'Auditor' ? `<button type="button" data-tab="auditoria" class="${tabClass('auditoria')}"><i data-lucide="clipboard-check" class="h-4 w-4"></i> Control de Auditoría</button>` : ''}
        <button type="button" data-tab="reportes" class="${tabClass('reportes')}"><i data-lucide="bar-chart-2" class="h-4 w-4"></i> Reportes</button>
        <button type="button" data-tab="sujetos" class="${tabClass('sujetos')}"><i data-lucide="shield-check" class="h-4 w-4"></i> Sujetos Pasivos</button>
        <button type="button" data-tab="asistencia" class="${tabClass('asistencia')}"><i data-lucide="headset" class="h-4 w-4"></i> Asistencia Técnica</button>
      `;
    } else {
      tabsListHtml = `
        <button type="button" data-tab="usuarios" class="${tabClass('usuarios')}"><i data-lucide="users" class="h-4 w-4"></i> Gestión de Usuarios</button>
        <button type="button" data-tab="sincronizacion" class="${tabClass('sincronizacion')}"><i data-lucide="refresh-cw" class="h-4 w-4"></i> Sincronización</button>
        <button type="button" data-tab="database" class="${tabClass('database')}"><i data-lucide="database" class="h-4 w-4"></i> Base de Datos</button>
        <button type="button" data-tab="logs" class="${tabClass('logs')}"><i data-lucide="file-text" class="h-4 w-4"></i> Bitácora de Logs</button>
      `;
    }

    container.innerHTML = `
      <div class="space-y-6">
        <!-- Barra de Navegación de Administración -->
        <div class="glass-card p-4 rounded-2xl border border-border-ui shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          ${rol !== 'Auditor' ? `
            <!-- Selector de Ámbito Segmentado: Gestión (Izq) vs Sistema (Der) -->
            <div class="inline-flex items-center p-1 rounded-xl bg-border-ui/40 border border-border-ui shrink-0 self-start md:self-auto">
              <button type="button" id="btn-scope-gestion" class="${scopeBtnClass('gestion')}">
                <i data-lucide="layout-grid" class="h-3.5 w-3.5"></i>
                <span>Herramientas de Gestión</span>
              </button>
              <button type="button" id="btn-scope-sistema" class="${scopeBtnClass('sistema')}">
                <i data-lucide="settings-2" class="h-3.5 w-3.5"></i>
                <span>Sistema y Configuración</span>
              </button>
            </div>
          ` : ''}

          <!-- Barra de 4 Pestañas Directas -->
          <nav class="-mb-px flex space-x-6 items-center overflow-x-auto scrollbar-none shrink-0" aria-label="Tabs">
            ${tabsListHtml}
          </nav>
        </div>

        <!-- Contenedor Dinámico de la Pestaña Activa -->
        <div id="admin-tab-content-container" class="min-h-[400px]"></div>
      </div>
    `;

    this.bindEvents(container);
  },

  bindEvents(container) {
    const btnGestion = container.querySelector('#btn-scope-gestion');
    const btnSistema = container.querySelector('#btn-scope-sistema');

    if (btnGestion) {
      btnGestion.onclick = () => {
        appStore.state.activeAdminScope = 'gestion';
        this.currentTab = 'auditoria';
        this.renderContainer(container);
        this.renderActiveTab(container);
      };
    }

    if (btnSistema) {
      btnSistema.onclick = () => {
        appStore.state.activeAdminScope = 'sistema';
        this.currentTab = 'usuarios';
        this.renderContainer(container);
        this.renderActiveTab(container);
      };
    }

    container.querySelectorAll('nav button[data-tab]').forEach(btn => {
      btn.onclick = () => {
        this.currentTab = btn.getAttribute('data-tab');
        this.renderContainer(container);
        this.renderActiveTab(container);
      };
    });
  },

  renderActiveTab(container) {
    const tabContainer = container.querySelector('#admin-tab-content-container');
    if (!tabContainer) return;

    if (typeof window.changeAdminTab === 'function') {
      window.changeAdminTab(this.currentTab);
    }
  },

  unmount() {}
};
