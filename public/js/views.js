/**
 * Fachada de Enrutamiento y Adaptador de Vistas.
 * Preserva firmas en window.* para compatibilidad con Electron, enrutador SPA y eventos HTML inline.
 */

/**
 * Renderiza los controles de paginación para una vista.
 * @param {string} viewName - Nombre de la vista activa.
 * @param {number} totalItems - Total de elementos a paginar.
 * @param {number} currentPage - Página actual.
 * @param {number} [pageSize=10] - Cantidad de elementos por página.
 * @returns {string} Fragmento HTML de los controles de paginación.
 */
function renderPaginationControls(
  viewName,
  totalItems,
  currentPage,
  pageSize = 10,
) {
  const totalPages = Math.ceil(totalItems / pageSize);
  if (totalPages <= 1) return "";

  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  let pages = [];
  const maxVisiblePages = 5;
  let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
  let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

  if (endPage - startPage + 1 < maxVisiblePages) {
    startPage = Math.max(1, endPage - maxVisiblePages + 1);
  }

  for (let i = startPage; i <= endPage; i++) {
    pages.push(i);
  }

  let buttonsHtml = "";

  const prevDisabled = currentPage === 1;
  buttonsHtml += `
    <button onclick="${prevDisabled ? "" : `changePage('${viewName}', ${currentPage - 1})`}" 
            class="h-8 w-8 rounded-lg flex items-center justify-center border border-border-ui bg-bg-card text-text-secondary hover:text-text-primary transition-all ${prevDisabled ?"opacity-40 cursor-not-allowed" : "hover:bg-border-ui/50"}" 
            title="Anterior">
      <i data-lucide="chevron-left" class="h-4 w-4 text-text-secondary"></i>
    </button>
  `;

  if (startPage > 1) {
    buttonsHtml += `
      <button onclick="changePage('${viewName}', 1)" class="h-8 px-3 rounded-lg border border-border-ui bg-bg-card text-text-secondary hover:text-text-primary hover:bg-border-ui/50 transition-all text-xs font-semibold font-sans">1</button>
    `;
    if (startPage > 2) {
      buttonsHtml += `<span class="text-text-secondary text-xs px-1 font-sans">...</span>`;
    }
  }

  pages.forEach((p) => {
    const isCurrent = p === currentPage;
    buttonsHtml += `
      <button onclick="changePage('${viewName}', ${p})" 
              class="h-8 w-8 rounded-lg flex items-center justify-center text-xs font-semibold font-sans transition-all ${ isCurrent ?"bg-brand-600 text-white shadow-md shadow-brand-500/20"
                  : "border border-border-ui bg-bg-card text-text-secondary hover:text-text-primary hover:bg-border-ui/50"
              }">
        ${p}
      </button>
    `;
  });

  if (endPage < totalPages) {
    if (endPage < totalPages - 1) {
      buttonsHtml += `<span class="text-text-secondary text-xs px-1 font-sans">...</span>`;
    }
    buttonsHtml += `
      <button onclick="changePage('${viewName}', ${totalPages})" class="h-8 px-3 rounded-lg border border-border-ui bg-bg-card text-text-secondary hover:text-text-primary hover:bg-border-ui/50 transition-all text-xs font-semibold font-sans">${totalPages}</button>
    `;
  }

  const nextDisabled = currentPage === totalPages;
  buttonsHtml += `
    <button onclick="${nextDisabled ? "" : `changePage('${viewName}', ${currentPage + 1})`}" 
            class="h-8 w-8 rounded-lg flex items-center justify-center border border-border-ui bg-bg-card text-text-secondary hover:text-text-primary transition-all ${nextDisabled ?"opacity-40 cursor-not-allowed" : "hover:bg-border-ui/50"}" 
            title="Siguiente">
      <i data-lucide="chevron-right" class="h-4 w-4 text-text-secondary"></i>
    </button>
  `;

  return `
    <div class="p-4 border-t border-border-ui flex flex-col sm:flex-row items-center justify-between gap-4 bg-bg-card">
      <div class="text-xs text-text-secondary font-semibold">
        Mostrando <span class="text-text-primary font-bold">${startItem}</span> a <span class="text-text-primary font-bold">${endItem}</span> de <span class="text-text-primary font-bold">${totalItems}</span> registros
      </div>
      <div class="flex items-center gap-1.5 font-sans">
        ${buttonsHtml}
      </div>
    </div>
  `;
}

function renderVigenciaSelect({ id, value, onChange, asInput = false }) {
  const currentVal = value || 'todos';
  const labelMap = {
    todos: asInput ? 'Todos los Sujetos' : 'Todos',
    vigentes: asInput ? 'Solo Vigentes' : 'Vigentes',
    no_vigentes: asInput ? 'Solo No Vigentes' : 'No Vigentes'
  };
  const currentLabel = labelMap[currentVal] || (asInput ? 'Todos los Sujetos' : 'Todos');

  const options = [
    { value: 'todos', label: asInput ? 'Todos los Sujetos' : 'Todos' },
    { value: 'vigentes', label: asInput ? 'Solo Vigentes' : 'Vigentes' },
    { value: 'no_vigentes', label: asInput ? 'Solo No Vigentes' : 'No Vigentes' }
  ];

  const optionsHtml = options.map(opt => {
    const isSelected = opt.value === currentVal;
    return `
      <div data-value="${opt.value}" data-label="${opt.label}"
           onclick="selectVigenciaOption(event, '${id}', '${opt.value}', '${opt.label}', '${onChange}')"
           class="px-3 py-1.5 text-xs flex items-center justify-between cursor-pointer transition-colors rounded-lg mx-1 my-0.5 ${ isSelected ? 'bg-brand-600/15 dark:bg-brand-500/20 text-brand-600 dark:text-brand-400 font-bold' : 'text-text-secondary hover:bg-border-ui dark:hover:bg-border-ui/50 hover:text-brand-600 dark:hover:text-brand-400 font-normal' }">
        <span>${opt.label}</span>
        ${isSelected ? '<i data-lucide="check" class="h-3.5 w-3.5 text-brand-600 dark:text-brand-400 shrink-0"></i>' : ''}
      </div>
    `;
  }).join('');

  if (asInput) {
    return `
      <div class="relative w-full font-sans select-none" id="vigencia-container-${id}">
        <button type="button"
                id="custom-select-trigger-${id}"
                onclick="toggleCustomSelectDropdown(event, '${id}')"
                class="w-full pl-3 pr-10 py-2 rounded-xl text-xs glass-input text-text-primary text-left relative flex items-center justify-between cursor-pointer hover:border-border-ui transition-all duration-200">
          <span class="truncate">${currentLabel}</span>
          <span class="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-text-tertiary">
            <i data-lucide="chevron-down" class="h-3.5 w-3.5"></i>
          </span>
        </button>
        <div id="custom-select-dropdown-${id}"
             class="custom-select-dropdown hidden absolute left-0 right-0 top-full mt-1 z-50 glass-card rounded-xl border border-border-ui shadow-xl overflow-hidden max-h-48 overflow-y-auto py-1">
          ${optionsHtml}
        </div>
      </div>
    `;
  }

  return `
    <div class="relative inline-block font-sans select-none" id="vigencia-container-${id}">
      <div class="flex items-center gap-1.5 bg-white dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-border-ui text-xs shadow-2xs">
        <span class="text-[11px] font-semibold text-slate-500 whitespace-nowrap">Vigencia:</span>
        <button type="button"
                id="custom-select-trigger-${id}"
                onclick="toggleCustomSelectDropdown(event, '${id}')"
                class="bg-transparent border-0 text-[11px] font-bold text-brand-600 dark:text-brand-400 focus:outline-none cursor-pointer flex items-center gap-1 pr-0.5 hover:text-brand-500 transition-colors">
          <span class="truncate" id="custom-select-label-${id}">${currentLabel}</span>
          <i data-lucide="chevron-down" class="h-3 w-3 shrink-0 opacity-70"></i>
        </button>
      </div>
      
      <div id="custom-select-dropdown-${id}"
           class="custom-select-dropdown hidden absolute left-0 top-full mt-1.5 z-50 glass-card bg-white dark:bg-slate-800 backdrop-blur-md rounded-xl border border-border-ui shadow-xl py-1 min-w-[140px]">
        ${optionsHtml}
      </div>
    </div>
  `;
}



/**
 * Renderiza la vista de Dashboard delegando al módulo canónico.
 * @param {HTMLElement} container - Contenedor DOM destino.
 */
function renderDashboard(container) {
  if (typeof window.renderDashboardModule === 'function') {
    return window.renderDashboardModule(container);
  }
  if (typeof window.DashboardView?.mount === 'function') {
    return window.DashboardView.mount(container);
  }
}
window.renderDashboard = renderDashboard;

/**
 * Renderiza la vista de Solicitudes delegando al módulo canónico.
 * @param {HTMLElement} container - Contenedor DOM destino.
 */
function renderSolicitudes(container) {
  if (typeof window.SolicitudesView?.mount === 'function') {
    return window.SolicitudesView.mount(container);
  }
}
window.renderSolicitudes = renderSolicitudes;

/**
 * Renderiza la vista de Publicadas delegando al módulo canónico.
 * @param {HTMLElement} container - Contenedor DOM destino.
 */
function renderPublicadas(container) {
  if (typeof window.PublicadasView?.mount === 'function') {
    return window.PublicadasView.mount(container);
  }
}
window.renderPublicadas = renderPublicadas;

/**
 * Renderiza la vista de Sujetos Pasivos delegando al módulo canónico.
 * @param {HTMLElement} container - Contenedor DOM destino.
 */
function renderSujetosPasivos(container) {
  if (typeof window.SujetosPasivosView?.mount === 'function') {
    return window.SujetosPasivosView.mount(container);
  }
}
window.renderSujetosPasivos = renderSujetosPasivos;

function showSujetoDetailsModal(sujetoId) {
  if (typeof window.showSujetoDetailsModal === 'function' && window.showSujetoDetailsModal !== showSujetoDetailsModal) {
    return window.showSujetoDetailsModal(sujetoId);
  }
}
window.showSujetoDetailsModal = showSujetoDetailsModal;

if (typeof window.showSolicitudDetailsModal !== 'function') {
  window.showSolicitudDetailsModal = function(idOrItem, isPending = false) {
    console.debug('showSolicitudDetailsModal pendiente de inicialización');
  };
}

if (typeof window.showAudienciaPublicadaDetailsModal !== 'function') {
  window.showAudienciaPublicadaDetailsModal = function(idOrItem) {
    console.debug('showAudienciaPublicadaDetailsModal pendiente de inicialización');
  };
}

/**
 * Renderiza la vista de Reportes delegando al módulo canónico.
 * @param {HTMLElement} container - Contenedor DOM destino.
 */
function renderReportes(container) {
  if (typeof window.ReportesView?.mount === 'function') {
    return window.ReportesView.mount(container);
  }
}
window.renderReportes = renderReportes;

/**
 * Renderiza el Centro de Alertas delegando al módulo canónico.
 * @param {HTMLElement} container - Contenedor DOM destino.
 */
function renderAlertasCentro(container) {
  if (typeof window.AlertasView?.mount === 'function') {
    return window.AlertasView.mount(container);
  }
}
window.renderAlertasCentro = renderAlertasCentro;

/**
 * Renderiza la vista de Agenda delegando al módulo canónico.
 * @param {HTMLElement} container - Contenedor DOM destino.
 */
function renderAgenda(container) {
  if (typeof window.AgendaView?.mount === 'function') {
    return window.AgendaView.mount(container);
  }
}
window.renderAgenda = renderAgenda;

/**
 * Renderiza la vista de Viajes delegando al módulo canónico.
 * @param {HTMLElement} container - Contenedor DOM destino.
 */
function renderViajes(container) {
  if (typeof window.ViajesView?.mount === 'function') {
    return window.ViajesView.mount(container);
  }
}
window.renderViajes = renderViajes;

/**
 * Renderiza la vista de Audiencias Unificadas delegando al módulo canónico.
 * @param {HTMLElement} container - Contenedor DOM destino.
 */
function renderAudiencias(container) {
  if (typeof window.AudienciasView?.mount === 'function') {
    return window.AudienciasView.mount(container);
  }
}
window.renderAudiencias = renderAudiencias;

/**
 * Renderiza la vista de Donativos delegando al módulo canónico.
 * @param {HTMLElement} container - Contenedor DOM destino.
 */
function renderDonativos(container) {
  if (typeof window.DonativosView?.mount === 'function') {
    return window.DonativosView.mount(container);
  }
}
window.renderDonativos = renderDonativos;

/**
 * Renderiza la vista de Autenticación y Login.
 * @param {HTMLElement} container - Contenedor DOM destino.
 */
async function renderLogin(container) {
  const isElectron =
    window.location.search.includes("platform=electron") ||
    window.navigator.userAgent.toLowerCase().includes("electron");

  let isInitialized = true;
  if (isElectron) {
    try {
      const res = await fetch("/api/auth/status");
      const data = await res.json();
      isInitialized = !!(data && data.initialized);
    } catch (e) {
      console.warn("Error al verificar estado de inicialización:", e);
    }
  }

  container.innerHTML = `
    <div class="min-h-[80vh] flex items-center justify-center p-4">
      <div class="glass-card w-full max-w-md p-8 rounded-3xl shadow-2xl border border-border-ui space-y-6 relative overflow-hidden animate-fade-in">
        <button id="login-theme-toggle" onclick="toggleTheme()" class="absolute top-4 right-4 h-8 w-8 rounded-xl flex items-center justify-center border border-border-ui hover:border-border-ui bg-bg-main text-text-secondary hover:text-text-primary transition-all duration-200 cursor-pointer" title="Cambiar de Modo">
          <i data-lucide="sun" class="h-4 w-4"></i>
        </button>

        <div class="absolute -top-10 -left-10 w-40 h-40 bg-brand-600/10 rounded-full blur-3xl pointer-events-none"></div>
        <div class="absolute -bottom-10 -right-10 w-40 h-40 bg-brand-500/5 rounded-full blur-3xl pointer-events-none"></div>

        <div class="flex flex-col items-center text-center space-y-3 relative z-10">
          <img src="/logo_secum.png" alt="Secretaría Municipal Maipú" class="h-20 w-auto object-contain mb-2">
          <div>
            <h1 class="text-2xl font-extrabold text-text-primary tracking-tight">LobbyControl</h1>
            <p class="text-xs text-body-muted mt-1 font-medium">Gestión de Audiencias - Ley N° 20.730</p>
          </div>
        </div>

        <div id="login-error" class="hidden px-4 py-3 rounded-xl bg-rose-950/40 border border-rose-900/60 text-rose-300 text-xs font-semibold flex items-center gap-2">
          <i data-lucide="alert-circle" class="h-4 w-4 shrink-0"></i>
          <span id="login-error-text">Credenciales inválidas. Inténtelo de nuevo.</span>
        </div>

        ${
          isElectron
            ? `
        <div id="sso-container" class="space-y-4 relative z-10 text-center">
          <button id="btn-sso-login" onclick="triggerSsoLogin()" 
                  class="w-full py-3 btn-primary rounded-xl text-xs font-bold transition-all hover:shadow-lg mt-2 flex items-center justify-center gap-2.5 active:scale-[0.98] cursor-pointer">
            <svg style="width: 18px; height: 18px; flex-shrink: 0;" viewBox="0 0 23 23" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M0 0H11V11H0V0Z" fill="#F25022"/>
              <path d="M12 0H23V11H12V0Z" fill="#7FBA00"/>
              <path d="M0 12H11V23H0V12Z" fill="#00A4EF"/>
              <path d="M12 12H23V23H12V12Z" fill="#FFB900"/>
            </svg>
            <span id="btn-sso-text">Iniciar sesión</span>
          </button>
        </div>
        `
            : ""
        }

        <div class="text-center text-[10px] text-body-muted pt-2 relative z-10 border-t border-border-ui">
          <p>LobbyControl - Gestión de Audiencias</p>
        </div>
      </div>
    </div>
  `;

  if (typeof lucide !== "undefined") {
    lucide.createIcons();
  }
}
window.renderLogin = renderLogin;


// ─── 4. VISTA DE ADMINISTRACIÓN Y SUB-PESTAÑAS MODULARES ──────────────────

if (typeof window.activeAdminScope === 'undefined') {
  window.activeAdminScope = 'gestion';
}

function switchAdminScope(scopeName) {
  window.activeAdminScope = scopeName;
  if (scopeName === 'gestion') {
    changeAdminTab('auditoria');
  } else {
    changeAdminTab('sincronizacion');
  }
}
window.switchAdminScope = switchAdminScope;

function _buildAdminTabsNavHtml(activeTab) {
  const rol = (window.currentUser && window.currentUser.rol) || '';

  if (rol === 'Auditor') {
    window.activeAdminScope = 'gestion';
  } else {
    const sistemaTabs = ['sincronizacion', 'usuarios', 'database', 'logs'];
    const gestionTabs = ['auditoria', 'reportes', 'sujetos', 'asistencia'];
    if (sistemaTabs.includes(activeTab)) {
      window.activeAdminScope = 'sistema';
    } else if (gestionTabs.includes(activeTab)) {
      window.activeAdminScope = 'gestion';
    }
  }

  const currentScope = window.activeAdminScope || 'gestion';

  const tabClass = (name) => `border-b-2 py-3 px-1 text-xs font-bold transition-all flex items-center gap-2 focus:outline-none shrink-0 cursor-pointer ${
    activeTab === name
      ? 'border-brand-500 text-brand-600 dark:text-brand-400'
      : 'border-transparent text-text-tertiary hover:text-text-primary dark:hover:text-text-primary hover:border-border-ui dark:hover:border-border-ui'
  }`;

  const scopeBtnClass = (scope) => `px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
    currentScope === scope
      ? 'bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/30 shadow-xs'
      : 'bg-transparent text-text-tertiary hover:text-text-primary hover:bg-border-ui/40 border border-transparent'
  }`;

  let tabsListHtml = '';
  if (currentScope === 'gestion' || rol === 'Auditor') {
    tabsListHtml = `
      ${rol !== 'Auditor' ? `<button onclick="changeAdminTab('auditoria')" class="${tabClass('auditoria')}"><i data-lucide="clipboard-check" class="h-4 w-4"></i> Control de Auditoría</button>` : ''}
      <button onclick="changeAdminTab('reportes')" class="${tabClass('reportes')}"><i data-lucide="bar-chart-2" class="h-4 w-4"></i> Reportes</button>
      <button onclick="changeAdminTab('sujetos')" class="${tabClass('sujetos')}"><i data-lucide="shield-check" class="h-4 w-4"></i> Sujetos Pasivos</button>
      <button onclick="changeAdminTab('asistencia')" class="${tabClass('asistencia')}"><i data-lucide="headset" class="h-4 w-4"></i> Asistencia Técnica</button>
    `;
  } else {
    tabsListHtml = `
      <button onclick="changeAdminTab('sincronizacion')" class="${tabClass('sincronizacion')}"><i data-lucide="refresh-cw" class="h-4 w-4"></i> Sincronización</button>
      <button onclick="changeAdminTab('usuarios')" class="${tabClass('usuarios')}"><i data-lucide="users" class="h-4 w-4"></i> Gestión de Usuarios</button>
      <button onclick="changeAdminTab('database')" class="${tabClass('database')}"><i data-lucide="database" class="h-4 w-4"></i> Base de Datos</button>
      <button onclick="changeAdminTab('logs')" class="${tabClass('logs')}"><i data-lucide="file-text" class="h-4 w-4"></i> Bitácora de Logs</button>
    `;
  }

  if (rol === 'Auditor') {
    return `
      <nav class="-mb-px flex space-x-6 items-center overflow-x-auto scrollbar-none" aria-label="Tabs">
        ${tabsListHtml}
      </nav>
    `;
  }

  return `
    <div class="w-full flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div class="inline-flex items-center p-1 rounded-xl bg-border-ui/40 border border-border-ui shrink-0 self-start md:self-auto">
        <button type="button" onclick="switchAdminScope('gestion')" class="${scopeBtnClass('gestion')}">
          <i data-lucide="layout-grid" class="h-3.5 w-3.5"></i>
          <span>Herramientas de Gestión</span>
        </button>
        <button type="button" onclick="switchAdminScope('sistema')" class="${scopeBtnClass('sistema')}">
          <i data-lucide="settings-2" class="h-3.5 w-3.5"></i>
          <span>Sistema y Configuración</span>
        </button>
      </div>

      <nav class="-mb-px flex space-x-6 items-center overflow-x-auto scrollbar-none shrink-0" aria-label="Tabs">
        ${tabsListHtml}
      </nav>
    </div>
  `;
}

function changeAdminTab(tabName, targetContainer = null) {
  window.activeAdminTab = tabName;
  const adminTabContent = document.getElementById("admin-tab-content-container");
  const container = targetContainer || adminTabContent || document.getElementById("main-content");
  if (!container) return;

  if (tabName === "reportes") {
    if (typeof fetchActiveSujetoIds === "function") fetchActiveSujetoIds();
    if ((!dataStore.publicadas || dataStore.publicadas.length === 0) && typeof fetchData === "function") {
      fetchData('publicadas');
    }
    if (!dataStore.reportesRawData || dataStore.reportesRawData.length === 0) {
      if (typeof fetchReportesData === "function") {
        fetchReportesData().then(() => {
          if (typeof fetchVigentesNombres === "function") fetchVigentesNombres();
          renderUsuarios(container);
          if (typeof window.actualizarBadgeCorrelativo === "function") {
            window.actualizarBadgeCorrelativo();
          }
          if (typeof initAirDatepickerFields === "function") {
            requestAnimationFrame(() => {
              initAirDatepickerFields();
              if (typeof syncAllLinkedDatepickers === "function") syncAllLinkedDatepickers();
            });
          }
        });
        return;
      }
    }
  }

  renderUsuarios(container);

  if (typeof initAirDatepickerFields === "function") {
    requestAnimationFrame(() => {
      initAirDatepickerFields();
      if (typeof syncAllLinkedDatepickers === "function") syncAllLinkedDatepickers();
    });
  }
}
window.changeAdminTab = changeAdminTab;

function renderUsuarios(container) {
  const rol = (window.currentUser && window.currentUser.rol) || '';
  if (typeof activeAdminTab === "undefined" || (rol === 'Auditor' && activeAdminTab === 'auditoria')) {
    window.activeAdminTab = rol === 'Auditor' ? 'sujetos' : 'auditoria';
  }

  const isEmbeddedInAdmin = container && container.id === "admin-tab-content-container";
  let contentHtml = "";

  if (window.activeAdminTab === "sujetos") {
    const isPartialUpdate = renderSujetosPasivos(container, { isEmbedded: isEmbeddedInAdmin });
    if (isPartialUpdate) {
      if (typeof syncAllLinkedDatepickers === "function") {
        requestAnimationFrame(() => syncAllLinkedDatepickers());
      }
      return;
    }
    if (!isEmbeddedInAdmin) {
      const adminShell = document.createElement('div');
      adminShell.innerHTML = `
        <div class="space-y-1">
          <h2 class="text-2xl font-bold text-heading tracking-tight">Administración</h2>
        </div>
        <div class="border-b border-border-ui mt-6 mb-0 relative z-30">
          ${_buildAdminTabsNavHtml(window.activeAdminTab)}
        </div>
      `;
      container.insertBefore(adminShell, container.firstChild);
    }
    if (window.lucide && typeof window.lucide.createIcons === "function") window.lucide.createIcons();
    if (typeof initAirDatepickerFields === "function") {
      requestAnimationFrame(() => {
        initAirDatepickerFields();
        if (typeof syncAllLinkedDatepickers === "function") syncAllLinkedDatepickers();
      });
    }
    return;
  } else if (window.activeAdminTab === "reportes") {
    const isPartialUpdate = renderReportes(container, { isEmbedded: isEmbeddedInAdmin });
    if (isPartialUpdate) {
      if (typeof syncAllLinkedDatepickers === "function") {
        requestAnimationFrame(() => syncAllLinkedDatepickers());
      }
      return;
    }
    if (!isEmbeddedInAdmin) {
      const adminShell = document.createElement('div');
      adminShell.innerHTML = `
        <div class="space-y-1">
          <h2 class="text-2xl font-bold text-heading tracking-tight">Administración</h2>
        </div>
        <div class="border-b border-border-ui mt-6 mb-0 relative z-30">
          ${_buildAdminTabsNavHtml(window.activeAdminTab)}
        </div>
      `;
      container.insertBefore(adminShell, container.firstChild);
    }
    if (window.lucide && typeof window.lucide.createIcons === "function") window.lucide.createIcons();
    if (typeof initAirDatepickerFields === "function") {
      requestAnimationFrame(() => {
        initAirDatepickerFields();
        if (typeof syncAllLinkedDatepickers === "function") syncAllLinkedDatepickers();
      });
    }
    return;
  } else if (window.activeAdminTab === "usuarios") {
    contentHtml = typeof window.UsuariosTab?.renderTabHtml === 'function' ? window.UsuariosTab.renderTabHtml() : '';
  } else if (window.activeAdminTab === "sincronizacion") {
    contentHtml = typeof window.SyncTab?.renderTabHtml === 'function' ? window.SyncTab.renderTabHtml() : '';
  } else if (window.activeAdminTab === "auditoria") {
    contentHtml = typeof window.AuditoriaTab?.renderTabHtml === 'function' ? window.AuditoriaTab.renderTabHtml() : '';
  } else if (window.activeAdminTab === "database") {
    contentHtml = renderDatabaseInspectorHtml();
  } else if (window.activeAdminTab === "asistencia") {
    contentHtml = renderAsistenciaTabHtml();
  } else if (window.activeAdminTab === "logs") {
    contentHtml = renderLogsTabHtml();
  }

  if (isEmbeddedInAdmin) {
    container.innerHTML = contentHtml;
  } else {
    container.innerHTML = `
      <div class="space-y-1">
        <h2 class="text-2xl font-bold text-heading tracking-tight">Administración</h2>
      </div>

      <div class="border-b border-border-ui mt-6 mb-0 relative z-30">
        ${_buildAdminTabsNavHtml(window.activeAdminTab)}
      </div>

      ${contentHtml}
    `;
  }

  if (window.lucide && typeof window.lucide.createIcons === "function") {
    window.lucide.createIcons();
  }

  if (window.activeAdminTab === "asistencia" && typeof initAsistenciaTab === "function") {
    setTimeout(initAsistenciaTab, 50);
  }

  if (window.activeAdminTab === "logs" && typeof refreshAdminLogs === "function") {
    setTimeout(refreshAdminLogs, 50);
  }
}
window.renderUsuarios = renderUsuarios;


/**
 * 5. PUENTES DELEGADOS DE SUB-PESTAÑAS Y COMPONENTES
 */

function renderDatabaseInspectorHtml() {
  if (typeof window.DatabaseTab?.renderTabHtml === 'function') {
    return window.DatabaseTab.renderTabHtml();
  }
  return '<div id="database-inspector-root"></div>';
}
window.renderDatabaseInspectorHtml = renderDatabaseInspectorHtml;

function initDatabaseInspector() {
  if (typeof window.DatabaseTab?.initDatabaseInspector === 'function') {
    return window.DatabaseTab.initDatabaseInspector();
  }
}
window.initDatabaseInspector = initDatabaseInspector;

function changeInspectorPage(page) {
  if (typeof window.DatabaseTab?.changeInspectorPage === 'function') {
    return window.DatabaseTab.changeInspectorPage(page);
  }
}
window.changeInspectorPage = changeInspectorPage;

function renderLogsTabHtml() {
  if (typeof window.LogsTab?.renderTabHtml === 'function') {
    return window.LogsTab.renderTabHtml();
  }
  return '<div id="logs-tab-content"></div>';
}
window.renderLogsTabHtml = renderLogsTabHtml;

function renderAsistenciaTabHtml() {
  if (typeof window.AsistenciaTab?.renderTabHtml === 'function') {
    return window.AsistenciaTab.renderTabHtml();
  }
  return '<div id="asistencia-subtab-content" class="min-h-[400px]"></div>';
}
window.renderAsistenciaTabHtml = renderAsistenciaTabHtml;

function renderHistoryList() {
  if (typeof window.SyncTab?.renderHistoryList === 'function') {
    return window.SyncTab.renderHistoryList();
  }
  return '<p class="text-xs text-text-tertiary">Sin registros.</p>';
}
window.renderHistoryList = renderHistoryList;

function showSyncHistoryModal() {
  if (typeof window.SyncTab?.showSyncHistoryModal === 'function') {
    return window.SyncTab.showSyncHistoryModal();
  }
}
window.showSyncHistoryModal = showSyncHistoryModal;

function generateUsuarioRowHtml(item) {
  if (typeof window.UsuariosTab?.generateUsuarioRowHtml === 'function') {
    return window.UsuariosTab.generateUsuarioRowHtml(item);
  }
  return '';
}
window.generateUsuarioRowHtml = generateUsuarioRowHtml;

function filterUsuarios() {
  if (typeof window.UsuariosTab?.filterUsuarios === 'function') {
    return window.UsuariosTab.filterUsuarios();
  }
}
window.filterUsuarios = filterUsuarios;
