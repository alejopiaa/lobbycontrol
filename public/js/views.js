

// Generador de controles de paginación
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

function renderVigenciaSelect({ id, value, onChange }) {
  const currentVal = value || 'todos';
  const labelMap = {
    todos: 'Todos',
    vigentes: 'Vigentes',
    no_vigentes: 'No Vigentes'
  };
  const currentLabel = labelMap[currentVal] || 'Todos';

  const options = [
    { value: 'todos', label: 'Todos' },
    { value: 'vigentes', label: 'Vigentes' },
    { value: 'no_vigentes', label: 'No Vigentes' }
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

  return `
    <div class="relative inline-block font-sans select-none" id="vigencia-container-${id}">
      <div class="flex items-center gap-1.5 bg-border-ui px-2.5 py-1 rounded-xl border border-border-ui text-xs shadow-sm">
        <span class="text-[11px] font-semibold text-text-secondary whitespace-nowrap">Estado Sujeto Pasivo:</span>
        <button type="button"
                id="custom-select-trigger-${id}"
                onclick="toggleCustomSelectDropdown(event, '${id}')"
                class="bg-transparent border-0 text-[11px] font-bold text-brand-600 dark:text-brand-400 focus:outline-none cursor-pointer flex items-center gap-1 pr-0.5 hover:text-brand-500 transition-colors">
          <span class="truncate">${currentLabel}</span>
          <i data-lucide="chevron-down" class="h-3 w-3 shrink-0 opacity-70"></i>
        </button>
      </div>
      
      <div id="custom-select-dropdown-${id}"
           class="custom-select-dropdown hidden absolute right-0 top-full mt-1.5 z-50 glass-card bg-bg-header backdrop-blur-md rounded-xl border border-border-ui shadow-xl py-1 min-w-[130px]">
        ${optionsHtml}
      </div>
    </div>
  `;
}

// RENDER: VISTA DASHBOARD (VISTA INICIAL)
function renderDashboard(container) {
  const stats = calculateDashboardStats(
    dataStore.dashboardRawData,
    dashboardFilters,
  );

  const existingDashboard = container.querySelector("#dashboard-view-container");
  if (existingDashboard) {
    // 1. Actualizar números y porcentajes de las tarjetas principales
    // Total Solicitudes
    const totalCountEl = existingDashboard.querySelector('#count-total-solicitudes');
    if (totalCountEl) totalCountEl.textContent = stats.totales.total;

    // Respondidas
    const respCountEl = existingDashboard.querySelector('#count-solicitudes-respondidas');
    if (respCountEl) respCountEl.textContent = stats.totales.respondidas;
    const respPctEl = respCountEl ? respCountEl.nextElementSibling : null;
    if (respPctEl) respPctEl.textContent = formatPct(stats.respondidas.pctTotal, stats.totales.respondidas);
    
    // progress bar Total
    const barTotalResp = existingDashboard.querySelector('#bar-total-respondidas');
    if (barTotalResp) barTotalResp.style.width = `${stats.respondidas.pctTotal}%`;
    const barTotalPend = existingDashboard.querySelector('#bar-total-pendientes');
    if (barTotalPend) barTotalPend.style.width = `${stats.pendientes.pctTotal}%`;

    // text Total
    const textTotalResp = existingDashboard.querySelector('#text-total-respondidas');
    if (textTotalResp) textTotalResp.textContent = `${formatPct(stats.respondidas.pctTotal, stats.totales.respondidas)} Respondidas (${stats.totales.respondidas})`;
    const textTotalPend = existingDashboard.querySelector('#text-total-pendientes');
    if (textTotalPend) textTotalPend.textContent = `${formatPct(stats.pendientes.pctTotal, stats.totales.pendientes)} Pendientes (${stats.totales.pendientes})`;

    // progress bar Respondidas
    const barRespRdp = existingDashboard.querySelector('#bar-respondidas-rdp');
    if (barRespRdp) barRespRdp.style.width = `${stats.respondidas.pctRdp}%`;
    const barRespRfp = existingDashboard.querySelector('#bar-respondidas-rfp');
    if (barRespRfp) barRespRfp.style.width = `${stats.respondidas.pctRfp}%`;

    // text Respondidas
    const textRespRdp = existingDashboard.querySelector('#text-respondidas-rdp');
    if (textRespRdp) textRespRdp.textContent = `${formatPct(stats.respondidas.pctRdp, stats.respondidas.rdp)} RDP (${stats.respondidas.rdp})`;
    const textRespRfp = existingDashboard.querySelector('#text-respondidas-rfp');
    if (textRespRfp) textRespRfp.textContent = `${formatPct(stats.respondidas.pctRfp, stats.respondidas.rfp)} RFP (${stats.respondidas.rfp})`;

    // Pendientes
    const pendCountEl = existingDashboard.querySelector('#count-solicitudes-pendientes');
    if (pendCountEl) pendCountEl.textContent = stats.totales.pendientes;
    const pendPctEl = pendCountEl ? pendCountEl.nextElementSibling : null;
    if (pendPctEl) pendPctEl.textContent = formatPct(stats.pendientes.pctTotal, stats.totales.pendientes);

    // progress bar Pendientes
    const barPendDdp = existingDashboard.querySelector('#bar-pendientes-ddp');
    if (barPendDdp) barPendDdp.style.width = `${stats.pendientes.pctDdp}%`;
    const barPendFdp = existingDashboard.querySelector('#bar-pendientes-fdp');
    if (barPendFdp) barPendFdp.style.width = `${stats.pendientes.pctFdp}%`;

    // text Pendientes
    const textPendDdp = existingDashboard.querySelector('#text-pendientes-ddp');
    if (textPendDdp) textPendDdp.textContent = `${formatPct(stats.pendientes.pctDdp, stats.pendientes.ddp)} DDP (${stats.pendientes.ddp})`;
    const textPendFdp = existingDashboard.querySelector('#text-pendientes-fdp');
    if (textPendFdp) textPendFdp.textContent = `${formatPct(stats.pendientes.pctFdp, stats.pendientes.fdp)} FDP (${stats.pendientes.fdp})`;

    // 2. Actualizar desglose de 7 estados
    const estadosMap = [
      { id: 'count-estado-aceptada', textId: 'text-pct-aceptada', count: stats.estados.aceptada.count, pct: stats.estados.aceptada.pct },
      { id: 'count-estado-rechazada', textId: 'text-pct-rechazada', count: stats.estados.rechazada.count, pct: stats.estados.rechazada.pct },
      { id: 'count-estado-suspendida', textId: 'text-pct-suspendida', count: stats.estados.suspendida.count, pct: stats.estados.suspendida.pct },
      { id: 'count-estado-cancelada', textId: 'text-pct-cancelada', count: stats.estados.cancelada.count, pct: stats.estados.cancelada.pct },
      { id: 'count-estado-encomendada', textId: 'text-pct-encomendada', count: stats.estados.encomendada.count, pct: stats.estados.encomendada.pct },
      { id: 'count-estado-publicadas', textId: 'text-pct-publicadas', count: stats.totales.publicadas, pct: stats.totales.pctPublicadas },
      { id: 'count-estado-pendientesPublicacion', textId: 'text-pct-pendientesPublicacion', count: stats.totales.pendientesPublicacion, pct: stats.totales.pctPendientesPublicacion }
    ];

    estadosMap.forEach(item => {
      const elCount = existingDashboard.querySelector(`#${item.id}`);
      if (elCount) elCount.textContent = item.count;
      const elText = existingDashboard.querySelector(`#${item.textId}`);
      if (elText) elText.textContent = formatPct(item.pct, item.count);
    });

    return true;
  }

  container.innerHTML = `
    <div class="space-y-4" id="dashboard-view-container">
      <div class="space-y-1">
        <h2 class="text-2xl font-bold text-text-primary tracking-tight">Dashboard</h2>
      </div>

      <!-- CONTENEDOR FILTROS -->
      ${renderGlassCard(
        `
        <div class="flex flex-wrap items-center justify-between border-b border-border-ui pb-3 gap-2">
          <div class="flex items-center gap-3 flex-wrap">
            <h3 class="text-xs font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400 flex items-center gap-2">
              <i data-lucide="sliders-horizontal" class="h-3.5 w-3.5"></i>
              Filtros
            </h3>
            ${renderVigenciaSelect({
              id: "dashboard-filter-vigencia",
              value: dashboardFilters.vigencia,
              onChange: "changeDashboardVigencia",
            })}
          </div>
          <button onclick="clearDashboardFilters()" class="text-[10px] text-text-tertiary hover:text-text-primary transition-colors flex items-center gap-1 cursor-pointer">
            <i data-lucide="rotate-ccw" class="h-3 w-3"></i> Limpiar Filtros
          </button>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <!-- AÑO -->
          ${renderSearchInput({
            id: "dashboard-filter-anio",
            fieldName: "anio",
            label: "Año",
            placeholder: "Escribir año...",
            value: dashboardFilters.anio,
            hasSuggestions: true,
          })}
          <!-- NOMBRE -->
          ${renderSearchInput({
            id: "dashboard-filter-nombre",
            fieldName: "nombre",
            label: "Nombre",
            placeholder: "Escribir nombre...",
            value: dashboardFilters.nombre,
            hasSuggestions: true,
          })}
          <!-- CARGO -->
          ${renderSearchInput({
            id: "dashboard-filter-cargo",
            fieldName: "cargo",
            label: "Cargo",
            placeholder: !dashboardFilters.nombre
              ? "Seleccione nombre primero..."
              : "Escribir cargo...",
            value: dashboardFilters.cargo,
            disabled: !dashboardFilters.nombre,
            hasSuggestions: true,
          })}
          <!-- FECHA INICIO -->
          ${renderDateInput({
            id: "dashboard-filter-fechainicio",
            fieldName: "fechaInicio",
            label: "Fecha Inicio",
            value: dashboardFilters.fechaInicio,
            min: dashboardFilters.anio ? `${dashboardFilters.anio}-01-01` : "",
            max: dashboardFilters.anio ? `${dashboardFilters.anio}-12-31` : "",
          })}
          <!-- FECHA TÉRMINO -->
          ${renderDateInput({
            id: "dashboard-filter-fechatermino",
            fieldName: "fechaTermino",
            label: "Fecha Término",
            value: dashboardFilters.fechaTermino,
            min: dashboardFilters.anio ? `${dashboardFilters.anio}-01-01` : "",
            max: dashboardFilters.anio ? `${dashboardFilters.anio}-12-31` : "",
          })}
        </div>
      `,
        "rounded-2xl p-5 space-y-4 relative z-20",
      )}

      <!-- TRES TARJETAS PRINCIPALES -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- CARD TOTAL SOLICITUDES -->
        <div class="glass-card dashboard-card-interactive stagger-card p-6 rounded-2xl flex flex-col justify-between shadow-sm space-y-4" style="animation-delay: 50ms;">
          <div class="text-center">
            <span class="text-xs text-text-secondary font-bold uppercase tracking-widest">Total Solicitudes</span>
            <h3 class="text-4xl font-extrabold text-heading mt-2" id="count-total-solicitudes">${stats.totales.total}</h3>
            <p class="text-xs text-body-muted font-semibold mt-1">100%</p>
          </div>
          <div class="space-y-1.5">
            <div class="w-full h-2 rounded-full overflow-hidden bg-border-ui/60 flex">
              <div id="bar-total-respondidas" class="h-full bg-brand-600 transition-all duration-500 ease-out" style="width: ${stats.respondidas.pctTotal}%"></div>
              <div id="bar-total-pendientes" class="h-full bg-brand-300 transition-all duration-500 ease-out" style="width: ${stats.pendientes.pctTotal}%"></div>
            </div>
            <div class="flex justify-between items-center text-[10px] text-body-muted font-semibold">
              <span id="text-total-respondidas">${formatPct(stats.respondidas.pctTotal, stats.totales.respondidas)} Respondidas (${stats.totales.respondidas})</span>
              <span id="text-total-pendientes">${formatPct(stats.pendientes.pctTotal, stats.totales.pendientes)} Pendientes (${stats.totales.pendientes})</span>
            </div>
          </div>
        </div>

        <!-- CARD RESPONDIDAS -->
        <div class="glass-card dashboard-card-interactive stagger-card p-6 rounded-2xl flex flex-col justify-between shadow-sm space-y-4" style="animation-delay: 100ms;">
          <div class="text-center">
            <span class="text-xs text-text-secondary font-bold uppercase tracking-widest">Solicitudes Respondidas</span>
            <h3 class="text-4xl font-extrabold text-heading mt-2" id="count-solicitudes-respondidas">${stats.totales.respondidas}</h3>
            <p class="text-xs text-body-muted font-semibold mt-1">${formatPct(stats.respondidas.pctTotal, stats.totales.respondidas)}</p>
          </div>
          <div class="space-y-1.5">
            <div class="w-full h-2 rounded-full overflow-hidden bg-border-ui/60 flex">
              <div id="bar-respondidas-rdp" class="h-full bg-brand-600 transition-all duration-500 ease-out" style="width: ${stats.respondidas.pctRdp}%"></div>
              <div id="bar-respondidas-rfp" class="h-full bg-brand-300 transition-all duration-500 ease-out" style="width: ${stats.respondidas.pctRfp}%"></div>
            </div>
            <div class="flex justify-between items-center text-[10px] text-body-muted font-semibold">
              <span id="text-respondidas-rdp">${formatPct(stats.respondidas.pctRdp, stats.respondidas.rdp)} RDP (${stats.respondidas.rdp})</span>
              <span id="text-respondidas-rfp">${formatPct(stats.respondidas.pctRfp, stats.respondidas.rfp)} RFP (${stats.respondidas.rfp})</span>
            </div>
          </div>
        </div>

        <!-- CARD PENDIENTES -->
        <div class="glass-card dashboard-card-interactive stagger-card p-6 rounded-2xl flex flex-col justify-between shadow-sm space-y-4" style="animation-delay: 150ms;">
          <div class="text-center">
            <span class="text-xs text-text-secondary font-bold uppercase tracking-widest">Solicitudes Pendientes</span>
            <h3 class="text-4xl font-extrabold text-heading mt-2" id="count-solicitudes-pendientes">${stats.totales.pendientes}</h3>
            <p class="text-xs text-body-muted font-semibold mt-1">${formatPct(stats.pendientes.pctTotal, stats.totales.pendientes)}</p>
          </div>
          <div class="space-y-1.5">
            <div class="w-full h-2 rounded-full overflow-hidden bg-border-ui/60 flex">
              <div id="bar-pendientes-ddp" class="h-full bg-brand-600 transition-all duration-500 ease-out" style="width: ${stats.pendientes.pctDdp}%"></div>
              <div id="bar-pendientes-fdp" class="h-full bg-brand-300 transition-all duration-500 ease-out" style="width: ${stats.pendientes.pctFdp}%"></div>
            </div>
            <div class="flex justify-between items-center text-[10px] text-body-muted font-semibold">
              <span id="text-pendientes-ddp">${formatPct(stats.pendientes.pctDdp, stats.pendientes.ddp)} DDP (${stats.pendientes.ddp})</span>
              <span id="text-pendientes-fdp">${formatPct(stats.pendientes.pctFdp, stats.pendientes.fdp)} FDP (${stats.pendientes.fdp})</span>
            </div>
          </div>
        </div>
      </div>

      <!-- DESGLOSE DE ESTADOS -->
      <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-5">
        <!-- ACEPTADAS -->
        <div class="glass-card dashboard-card-interactive stagger-card rounded-2xl overflow-hidden flex flex-col justify-between shadow-sm" style="animation-delay: 200ms;">
          <div class="py-2 text-center text-[10px] font-bold tracking-widest uppercase border-b" 
               style="background-color: var(--card-blue-bg); border-color: var(--border-ui); color: var(--card-blue-text);">
            Aceptadas
          </div>
          <div class="p-6 text-center space-y-1">
            <h3 class="text-3xl font-bold text-heading" id="count-estado-aceptada">${stats.estados.aceptada.count}</h3>
            <p id="text-pct-aceptada" class="text-xs text-body-muted font-semibold">${formatPct(stats.estados.aceptada.pct, stats.estados.aceptada.count)}</p>
          </div>
        </div>

        <!-- RECHAZADAS -->
        <div class="glass-card dashboard-card-interactive stagger-card rounded-2xl overflow-hidden flex flex-col justify-between shadow-sm" style="animation-delay: 250ms;">
          <div class="py-2 text-center text-[10px] font-bold tracking-widest uppercase border-b" 
               style="background-color: var(--card-pink-bg); border-color: var(--border-ui); color: var(--card-pink-text);">
            Rechazadas
          </div>
          <div class="p-6 text-center space-y-1">
            <h3 class="text-3xl font-bold text-heading" id="count-estado-rechazada">${stats.estados.rechazada.count}</h3>
            <p id="text-pct-rechazada" class="text-xs text-body-muted font-semibold">${formatPct(stats.estados.rechazada.pct, stats.estados.rechazada.count)}</p>
          </div>
        </div>

        <!-- SUSPENDIDAS -->
        <div class="glass-card dashboard-card-interactive stagger-card rounded-2xl overflow-hidden flex flex-col justify-between shadow-sm" style="animation-delay: 300ms;">
          <div class="py-2 text-center text-[10px] font-bold tracking-widest uppercase border-b" 
               style="background-color: var(--card-purple-bg); border-color: var(--border-ui); color: var(--card-purple-text);">
            Suspendidas
          </div>
          <div class="p-6 text-center space-y-1">
            <h3 class="text-3xl font-bold text-heading" id="count-estado-suspendida">${stats.estados.suspendida.count}</h3>
            <p id="text-pct-suspendida" class="text-xs text-body-muted font-semibold">${formatPct(stats.estados.suspendida.pct, stats.estados.suspendida.count)}</p>
          </div>
        </div>

        <!-- CANCELADAS -->
        <div class="glass-card dashboard-card-interactive stagger-card rounded-2xl overflow-hidden flex flex-col justify-between shadow-sm" style="animation-delay: 350ms;">
          <div class="py-2 text-center text-[10px] font-bold tracking-widest uppercase border-b" 
               style="background-color: var(--bg-card); border-color: var(--border-ui); color: var(--text-secondary);">
            Canceladas
          </div>
          <div class="p-6 text-center space-y-1">
            <h3 class="text-3xl font-bold text-heading" id="count-estado-cancelada">${stats.estados.cancelada.count}</h3>
            <p id="text-pct-cancelada" class="text-xs text-body-muted font-semibold">${formatPct(stats.estados.cancelada.pct, stats.estados.cancelada.count)}</p>
          </div>
        </div>

        <!-- ENCOMENDADAS -->
        <div class="glass-card dashboard-card-interactive stagger-card rounded-2xl overflow-hidden flex flex-col justify-between shadow-sm" style="animation-delay: 400ms;">
          <div class="py-2 text-center text-[10px] font-bold tracking-widest uppercase border-b" 
               style="background-color: var(--card-orange-bg); border-color: var(--border-ui); color: var(--card-orange-text);">
            Encomendadas
          </div>
          <div class="p-6 text-center space-y-1">
            <h3 class="text-3xl font-bold text-heading" id="count-estado-encomendada">${stats.estados.encomendada.count}</h3>
            <p id="text-pct-encomendada" class="text-xs text-body-muted font-semibold">${formatPct(stats.estados.encomendada.pct, stats.estados.encomendada.count)}</p>
          </div>
        </div>

        <!-- PUBLICADAS -->
        <div class="glass-card dashboard-card-interactive stagger-card rounded-2xl overflow-hidden flex flex-col justify-between shadow-sm" style="animation-delay: 450ms;">
          <div class="py-2 text-center text-[10px] font-bold tracking-widest uppercase border-b" 
               style="background-color: var(--card-teal-bg); border-color: var(--border-ui); color: var(--card-teal-text);">
            Publicadas
          </div>
          <div class="p-6 text-center space-y-1">
            <h3 class="text-3xl font-bold text-heading" id="count-estado-publicadas">${stats.totales.publicadas}</h3>
            <p id="text-pct-publicadas" class="text-xs text-body-muted font-semibold">${formatPct(stats.totales.pctPublicadas, stats.totales.publicadas)}</p>
          </div>
        </div>

        <!-- PENDIENTES DE PUBLICACIÓN -->
        <div class="glass-card dashboard-card-interactive stagger-card rounded-2xl overflow-hidden flex flex-col justify-between shadow-sm" style="animation-delay: 500ms;">
          <div class="py-2 text-center text-[10px] font-bold tracking-widest uppercase border-b" 
               style="background-color: var(--card-amber-bg); border-color: var(--border-ui); color: var(--card-amber-text);">
            Pnd. Publicar
          </div>
          <div class="p-6 text-center space-y-1">
            <h3 class="text-3xl font-bold text-heading" id="count-estado-pendientesPublicacion">${stats.totales.pendientesPublicacion}</h3>
            <p id="text-pct-pendientesPublicacion" class="text-xs text-body-muted font-semibold">${formatPct(stats.totales.pctPendientesPublicacion, stats.totales.pendientesPublicacion)}</p>
          </div>
        </div>
      </div>

      <!-- PANEL DE GRÁFICOS ANALÍTICOS Y COMPARATIVOS (GRILLA 2x2) -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <!-- 1. Distribución por Estado -->
        <div class="glass-card p-6 rounded-2xl flex flex-col justify-between shadow-sm min-h-[360px] relative">
          <h4 class="text-xs font-bold uppercase tracking-wider text-text-secondary mb-4 flex items-center gap-2">
            <i data-lucide="pie-chart" class="h-4 w-4"></i> Distribución por Estado
          </h4>
          <div class="flex-1 w-full flex items-center justify-center">
            <div id="chart-distribucion-estados" class="w-full min-h-[260px]"></div>
          </div>
        </div>

        <!-- 2. Evolución Mensual Comparativa (Año vs Año Anterior) -->
        <div class="glass-card p-6 rounded-2xl flex flex-col justify-between shadow-sm min-h-[360px] relative">
          <h4 class="text-xs font-bold uppercase tracking-wider text-text-secondary mb-4 flex items-center gap-2">
            <i data-lucide="trending-up" class="h-4 w-4"></i> Evolución Mensual Interanual
          </h4>
          <div class="flex-1 w-full flex items-center justify-center">
            <div id="chart-evolucion-mensual" class="w-full min-h-[260px]"></div>
          </div>
        </div>

        <!-- 3. Cumplimiento de Plazos Mensual -->
        <div class="glass-card p-6 rounded-2xl flex flex-col justify-between shadow-sm min-h-[360px] relative">
          <h4 class="text-xs font-bold uppercase tracking-wider text-text-secondary mb-4 flex items-center gap-2">
            <i data-lucide="bar-chart-3" class="h-4 w-4"></i> Cumplimiento de Plazos (Mensual)
          </h4>
          <div class="flex-1 w-full flex items-center justify-center">
            <div id="chart-cumplimiento-plazos" class="w-full min-h-[260px]"></div>
          </div>
        </div>

        <!-- 4. Top 5 Sujetos Pasivos con más Solicitudes -->
        <div class="glass-card p-6 rounded-2xl flex flex-col justify-between shadow-sm min-h-[360px] relative">
          <div class="flex items-center justify-between mb-4">
            <h4 class="text-xs font-bold uppercase tracking-wider text-text-secondary flex items-center gap-2">
              <i data-lucide="award" class="h-4 w-4"></i> Top 5 Autoridades
            </h4>
          </div>
          <div class="flex-1 w-full flex items-center justify-center">
            <div id="chart-top-autoridades" class="w-full min-h-[260px]"></div>
          </div>
        </div>
      </div>
    </div>
  `;
}

// RENDER: VISTA SOLICITUDES SH
function renderSolicitudes(container) {
  const filters = paginationState.solicitudes.filters;
  let paginatedItems = [];
  let totalItems = 0;
  const currentPage = paginationState.solicitudes.page;
  const pageSize = 10;

  const isServerPaged =
    dataStore.solicitudes && !Array.isArray(dataStore.solicitudes);
  if (isServerPaged) {
    paginatedItems = dataStore.solicitudes.data || [];
    totalItems = dataStore.solicitudes.totalItems || 0;
  } else {
    let filtered = dataStore.solicitudes || [];
    if (filters.vigencia === 'vigentes' || filters.soloVigentes === true) {
      filtered = filtered.filter((item) => {
        if (item.sujeto_pasivo_id && typeof activeSujetoIdsCache !== 'undefined' && activeSujetoIdsCache.has(item.sujeto_pasivo_id)) {
          return true;
        }
        return false;
      });
    } else if (filters.vigencia === 'no_vigentes') {
      filtered = filtered.filter((item) => {
        if (!item.sujeto_pasivo_id || typeof activeSujetoIdsCache === 'undefined' || !activeSujetoIdsCache.has(item.sujeto_pasivo_id)) {
          return true;
        }
        return false;
      });
    }
    if (filters.folio) {
      const val = filters.folio.toLowerCase();
      filtered = filtered.filter((item) =>
        (item.folio_lobby || "").toLowerCase().includes(val),
      );
    }
    if (filters.nombre) {
      const val = filters.nombre.toLowerCase();
      filtered = filtered.filter((item) =>
        (item.sujeto_pasivo || "").toLowerCase().includes(val),
      );
    }
    if (filters.cargo) {
      const val = filters.cargo.toLowerCase();
      filtered = filtered.filter(
        (item) =>
          item.cargo && getCargoClean(item.cargo).toLowerCase().includes(val),
      );
    }
    if (filters.sujetoActivoRepresentado) {
      const val = filters.sujetoActivoRepresentado.toLowerCase();
      filtered = filtered.filter(
        (item) =>
          (item.sujeto_activo || "").toLowerCase().includes(val) ||
          (item.representado || "").toLowerCase().includes(val) ||
          (item.rut || "").toLowerCase().includes(val),
      );
    }
    if (
      filters.relacionSujetoActivo ||
      filters.relacionRut ||
      filters.relacionRepresentado
    ) {
      filtered = filtered.filter((item) => {
        let match = false;
        if (
          filters.relacionSujetoActivo &&
          item.sujeto_activo &&
          item.sujeto_activo.toLowerCase() ===
            filters.relacionSujetoActivo.toLowerCase()
        ) {
          match = true;
        }
        if (
          filters.relacionRut &&
          item.rut &&
          item.rut.toLowerCase() === filters.relacionRut.toLowerCase()
        ) {
          match = true;
        }
        if (
          filters.relacionRepresentado &&
          item.representado &&
          item.representado.toLowerCase() ===
            filters.relacionRepresentado.toLowerCase()
        ) {
          match = true;
        }
        return match;
      });
    }
    if (filters.estado) {
      const val = filters.estado.toLowerCase();
      filtered = filtered.filter(
        (item) => (item.estado || "").toLowerCase() === val,
      );
    }
    totalItems = filtered.length;
    paginatedItems = filtered.slice(
      (currentPage - 1) * pageSize,
      currentPage * pageSize,
    );
  }

  let rowsHtml = "";
  if (paginatedItems.length === 0) {
    rowsHtml = `<tr><td colspan="9" class="px-6 py-8 text-center text-xs text-text-secondary">No hay registros de solicitudes.</td></tr>`;
  } else {
    paginatedItems.forEach((item) => {
      rowsHtml += `
        <tr class="hover:bg-border-ui border-b border-border-ui transition-colors h-[72px]">
          <td class="pl-6 pr-2 text-xs font-semibold text-text-primary text-left">${escapeHtml(item.folio_lobby || "Sin Folio")}</td>
          <td class="px-2 text-xs text-left">
            <div class="font-semibold text-text-secondary" title="Fecha Ingreso">${formatDate(item.fecha_ingreso)}</div>
            <div class="text-[10px] text-text-tertiary mt-0.5" title="Plazo Legal Límite">
              ${item.fecha_limite_sh ? formatDate(item.fecha_limite_sh) : (item.fecha_ingreso ? formatDate(item.fecha_ingreso) : "---")}
            </div>
          </td>
          <td class="px-2 text-xs text-text-secondary font-medium text-left">${formatDate(item.fecha_respuesta) || "---"}</td>
          <td class="px-2 text-xs text-text-secondary text-left">${formatDate(item.fecha_agendada) || "---"}</td>
          <td class="px-2 text-xs text-text-secondary text-left">
            <div class="font-medium text-text-secondary w-full truncate" title="${escapeHtmlAttr(normalizeName(item.sujeto_pasivo) || "Sin Nombre")}">${escapeHtml(normalizeName(item.sujeto_pasivo) || "Sin Nombre")}</div>
            <div class="text-[10px] text-text-secondary mt-0.5 w-full truncate" title="${escapeHtmlAttr(item.cargo_limpio || getCargoClean(item.cargo))}">${escapeHtml(item.cargo_limpio || getCargoClean(item.cargo))}</div>
          </td>
          <td class="px-2 text-xs text-text-secondary text-left">
            <div class="font-medium text-text-secondary w-full flex items-center justify-between gap-1">
              <span class="truncate" title="${escapeHtmlAttr(item.sujeto_activo || "Sin Activo")}">${escapeHtml(item.sujeto_activo || "Sin Activo")}</span>
              ${
                item.sujeto_activo
                  ? `
                <button onclick="filtrarRelacionados('solicitudes', '${escapeHtmlAttr(item.sujeto_activo)}', '${escapeHtmlAttr(item.rut || "")}', '${escapeHtmlAttr(item.representado || "")}')" 
                        class="text-brand-500 dark:text-brand-400 hover:text-brand-600 dark:hover:text-brand-300 hover:bg-brand-500/10 p-0.5 rounded-lg transition-all shrink-0 cursor-pointer" 
                        title="Filtrar solicitudes relacionadas (mismo RUN, representado y/o sujeto activo)">
                  <i data-lucide="info" class="h-3.5 w-3.5"></i>
                </button>
              `
                  : ""
              }
            </div>
            <div class="text-[10px] text-text-secondary mt-0.5 w-full truncate" title="${escapeHtmlAttr(item.representado || "Particular")}">${escapeHtml(item.representado || "Particular")}</div>
          </td>
          <td class="px-2 text-left">
            <div class="text-[10.5px] text-text-secondary font-sans leading-normal overflow-hidden" 
                 style="display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; max-height: 2.8em;"
                 title="${escapeHtmlAttr(item.especificacion_materia || item.materia || "")}">
              ${escapeHtml(item.especificacion_materia || item.materia || "Sin Especificar")}
            </div>
          </td>
          <td class="px-2 text-xs text-left">
            <div class="w-24">
              ${renderStatusBadge(getDeadlineStatusBadge(item.fecha_ingreso, item.fecha_respuesta, item.estado, item))}
            </div>
          </td>
          <td class="pl-2 pr-6 text-left whitespace-nowrap">
            <button onclick="showSolicitudDetailsModal(${item.id})" class="px-3 py-1.5 rounded-lg text-xs font-semibold bg-brand-600 hover:bg-brand-500 text-white transition-all inline-block hover:shadow-md hover:shadow-brand-500/20 whitespace-nowrap cursor-pointer">Ver Detalle</button>
          </td>
        </tr>
      `;
    });
  }

  const existingTable = container.querySelector("#table-solicitudes");
  if (existingTable && window.activeInputId) {
    existingTable.querySelector("tbody").innerHTML = rowsHtml;
    const counterEl = container.querySelector("#solicitudes-counter");
    if (counterEl)
      counterEl.textContent = `${totalItems} registros encontrados`;
    const pagEl = container.querySelector("#solicitudes-pagination-container");
    if (pagEl)
      pagEl.innerHTML = renderPaginationControls(
        "solicitudes",
        totalItems,
        currentPage,
        pageSize,
      );
    lucide.createIcons();
    return;
  }

  container.innerHTML = `
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div class="space-y-1">
        <h2 class="text-2xl font-bold text-text-primary tracking-tight">Solicitudes</h2>
      </div>
    </div>

    <!-- CONTENEDOR FILTROS -->
    ${renderGlassCard(
      `
      <div class="flex flex-wrap items-center justify-between border-b border-border-ui pb-3 gap-2">
        <div class="flex items-center gap-3 flex-wrap">
          <h3 class="text-xs font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400 flex items-center gap-2">
            <i data-lucide="sliders-horizontal" class="h-3.5 w-3.5"></i>
            Filtros
          </h3>
          ${renderVigenciaSelect({
            id: "filter-solicitudes-vigencia",
            value: filters.vigencia,
            onChange: "changeSolicitudesVigencia",
          })}
        </div>
        <button onclick="clearFilters('solicitudes')" class="text-[10px] text-text-tertiary hover:text-text-primary transition-colors flex items-center gap-1 cursor-pointer">
          <i data-lucide="rotate-ccw" class="h-3 w-3"></i> Limpiar Filtros
        </button>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <!-- FOLIO -->
        ${renderSearchInput({
          id: "filter-solicitudes-folio",
          fieldName: "folio",
          label: "Folio",
          placeholder: "Buscar folio...",
          value: filters.folio,
          icon: "hash",
        })}
        <!-- NOMBRE -->
        ${renderSearchInput({
          id: "solicitudes-filter-nombre",
          fieldName: "nombre",
          label: "Nombre Sujeto Pasivo",
          placeholder: "Escribir nombre...",
          value: filters.nombre,
          icon: "user",
          hasSuggestions: true,
        })}
        <!-- CARGO -->
        ${renderSearchInput({
          id: "solicitudes-filter-cargo",
          fieldName: "cargo",
          label: "Cargo",
          placeholder: !filters.nombre
            ? "Seleccione nombre primero..."
            : "Escribir cargo...",
          value: filters.cargo,
          icon: "user",
          disabled: !filters.nombre,
          hasSuggestions: true,
        })}
        <!-- SUJETO ACTIVO / REPRESENTADO -->
        ${renderSearchInput({
          id: "solicitudes-filter-sujetoActivoRepresentado",
          fieldName: "sujetoActivoRepresentado",
          label: "Sujeto Activo / Representado",
          placeholder: "Lobbista o gestor de interés...",
          value: filters.sujetoActivoRepresentado,
          icon: "users",
          hasSuggestions: true,
        })}
        <!-- ESTADO -->
        ${renderSelectInput({
          id: "filter-solicitudes-estado",
          fieldName: "estado",
          label: "Estado",
          value: filters.estado,
          optionsList: [
            { value: "", text: "Todos los Estados" },
            { value: "Ingresada", text: "Ingresada" },
            { value: "Aceptada", text: "Aceptada" },
            { value: "Rechazada", text: "Rechazada" },
            { value: "Suspendida", text: "Suspendida" },
            { value: "Cancelada", text: "Cancelada" },
            { value: "Encomendada", text: "Encomendada" },
          ],
        })}
      </div>
    `,
      "rounded-2xl p-5 space-y-4 relative z-20",
    )}

    <!-- BANNER DE RELACIÓN ACTIVO -->
    ${
      filters.relacionSujetoActivo ||
      filters.relacionRut ||
      filters.relacionRepresentado
        ? `
      <div class="mb-4 p-4 rounded-2xl bg-brand-50 dark:bg-brand-500/10 border border-brand-200/80 border-brand-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-brand-900 dark:text-brand-200 relative overflow-hidden glass-card">
        <div class="flex items-center gap-3">
          <div class="p-2 rounded-xl bg-brand-100 dark:bg-brand-500/20 text-brand-600 dark:text-brand-400 border border-brand-200 dark:border-brand-500/30">
            <i data-lucide="info" class="h-4 w-4"></i>
          </div>
          <div>
            <div class="font-bold text-text-primary uppercase tracking-wider text-[10px] mb-0.5">Filtrando Solicitudes Relacionadas</div>
            <div class="font-medium text-text-secondary">
              Mostrando registros de sujeto activo <strong class="text-text-primary">${escapeHtml(filters.relacionSujetoActivo || "---")}</strong>
              ${filters.relacionRut ? ` (RUN: <strong class="text-text-primary font-mono">${escapeHtml(filters.relacionRut)}</strong>)` : ""}
              ${filters.relacionRepresentado ? ` y/o representado <strong class="text-text-primary">${escapeHtml(filters.relacionRepresentado)}</strong>` : ""}
            </div>
          </div>
        </div>
        <button onclick="clearRelacionFilter('solicitudes')" class="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl font-bold transition-all hover:shadow-lg hover:shadow-brand-500/20 whitespace-nowrap shrink-0 text-xs cursor-pointer">
          Limpiar Filtro
        </button>
      </div>
    `
        : ""
    }

    <!-- TABLA -->
    <div class="rounded-2xl overflow-hidden mt-4 border border-border-ui glass-card">
      <div class="p-4 border-b border-border-ui flex justify-between items-center">
        <div class="text-xs text-text-secondary" id="solicitudes-counter">${totalItems} registros encontrados</div>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full text-left border-collapse table-fixed" id="table-solicitudes">
          <thead>
            <tr class="bg-border-ui/50 border-b border-border-ui text-text-tertiary text-[10px] uppercase font-bold tracking-widest">
              <th class="pl-6 pr-2 py-3 w-40 text-left">Folio</th>
              <th class="px-2 py-3 w-28 text-left">Ingreso / Plazo</th>
              <th class="px-2 py-3 w-24 text-left">Fecha Respuesta</th>
              <th class="px-2 py-3 w-24 text-left">Fecha Agendada</th>
              <th class="px-2 py-3 w-48 text-left">Sujeto Pasivo</th>
              <th class="px-2 py-3 w-48 text-left">Sujeto Activo / Representado</th>
              <th class="px-2 py-3 w-48 text-left">Materia</th>
              <th class="px-2 py-3 w-28 text-left">Estado</th>
              <th class="pl-2 pr-6 py-3 w-28 text-left whitespace-nowrap">Acción</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </div>
      <div id="solicitudes-pagination-container">
        ${renderPaginationControls("solicitudes", totalItems, currentPage, pageSize)}
      </div>
    </div>
  `;
}

// RENDER: VISTA PUBLICADAS PH
function renderPublicadas(container) {
  const filters = paginationState.publicadas.filters;
  const subTab = paginationState.publicadas.subTab || "historial";
  let paginatedItems = [];
  let totalItems = 0;
  const currentPage = paginationState.publicadas.page;
  const pageSize = 10;

  if (subTab === "historial") {
    const isServerPaged =
      dataStore.publicadas && !Array.isArray(dataStore.publicadas);
    if (isServerPaged) {
      paginatedItems = dataStore.publicadas.data || [];
      totalItems = dataStore.publicadas.totalItems || 0;
    } else {
      let filtered = dataStore.publicadas || [];
      if (filters.vigencia === 'vigentes' || filters.soloVigentes === true) {
        filtered = filtered.filter((item) => {
          if (item.sujeto_pasivo_id && typeof activeSujetoIdsCache !== 'undefined' && activeSujetoIdsCache.has(item.sujeto_pasivo_id)) {
            return true;
          }
          if (dashboardDropdownCache.nombresVigentes && item.sujeto_pasivo) {
            return dashboardDropdownCache.nombresVigentes.some(n => n.toLowerCase() === item.sujeto_pasivo.toLowerCase());
          }
          return false;
        });
      } else if (filters.vigencia === 'no_vigentes') {
        filtered = filtered.filter((item) => {
          if (item.sujeto_pasivo_id && typeof activeSujetoIdsCache !== 'undefined' && activeSujetoIdsCache.has(item.sujeto_pasivo_id)) {
            return false;
          }
          if (dashboardDropdownCache.nombresVigentes && item.sujeto_pasivo) {
            return !dashboardDropdownCache.nombresVigentes.some(n => n.toLowerCase() === item.sujeto_pasivo.toLowerCase());
          }
          return true;
        });
      }
      if (filters.folio) {
        const val = filters.folio.toLowerCase();
        filtered = filtered.filter((item) =>
          (item.folio_lobby || "").toLowerCase().includes(val),
        );
      }
      if (filters.nombre) {
        const val = filters.nombre.toLowerCase();
        filtered = filtered.filter((item) =>
          (item.sujeto_pasivo || "").toLowerCase().includes(val),
        );
      }
      if (filters.cargo) {
        const val = filters.cargo.toLowerCase();
        filtered = filtered.filter(
          (item) =>
            item.cargo && getCargoClean(item.cargo).toLowerCase().includes(val),
        );
      }
      if (filters.sujetoActivoRepresentado) {
        const val = filters.sujetoActivoRepresentado.toLowerCase();
        filtered = filtered.filter(
          (item) =>
            (item.sujeto_activo || "").toLowerCase().includes(val) ||
            (item.representado || "").toLowerCase().includes(val) ||
            (item.rut || "").toLowerCase().includes(val),
        );
      }
      if (
        filters.relacionSujetoActivo ||
        filters.relacionRut ||
        filters.relacionRepresentado
      ) {
        filtered = filtered.filter((item) => {
          let match = false;
          if (
            filters.relacionSujetoActivo &&
            item.sujeto_activo &&
            item.sujeto_activo.toLowerCase() ===
              filters.relacionSujetoActivo.toLowerCase()
          ) {
            match = true;
          }
          if (
            filters.relacionRut &&
            item.rut &&
            item.rut.toLowerCase() === filters.relacionRut.toLowerCase()
          ) {
            match = true;
          }
          if (
            filters.relacionRepresentado &&
            filters.relacionRepresentado.toLowerCase() !== "particular" &&
            item.representado &&
            item.representado.toLowerCase() ===
              filters.relacionRepresentado.toLowerCase()
          ) {
            match = true;
          }
          return match;
        });
      }
      if (filters.estado) {
        const val = filters.estado.toLowerCase();
        filtered = filtered.filter((item) => {
          const isItemFuera = (item.cumplimiento || "")
            .toLowerCase()
            .includes("fuera");
          const itemEstadoNormalized = isItemFuera
            ? "fuera de plazo"
            : "en plazo";
          return itemEstadoNormalized === val;
        });
      }
      totalItems = filtered.length;
      paginatedItems = filtered.slice(
        (currentPage - 1) * pageSize,
        currentPage * pageSize,
      );
    }
  } else {
    // subTab === 'pendientes'
    const isServerPaged =
      dataStore.solicitudesPendientesPublicacion &&
      !Array.isArray(dataStore.solicitudesPendientesPublicacion);
    if (isServerPaged) {
      paginatedItems = dataStore.solicitudesPendientesPublicacion.data || [];
      totalItems = dataStore.solicitudesPendientesPublicacion.totalItems || 0;
    } else {
      const publicadosFolios = new Set(
        (dataStore.publicadas || []).map((p) => p.folio_lobby).filter(Boolean),
      );
      let filtered = (dataStore.solicitudes || []).filter((item) => {
        if ((item.estado || "").toLowerCase() !== "aceptada") return false;
        if (!item.fecha_agendada) return false;
        if (publicadosFolios.has(item.folio_lobby)) return false;
        return true;
      });

      if (filters.vigencia === 'vigentes' || filters.soloVigentes === true) {
        filtered = filtered.filter((item) => {
          if (item.sujeto_pasivo_id && typeof activeSujetoIdsCache !== 'undefined' && activeSujetoIdsCache.has(item.sujeto_pasivo_id)) {
            return true;
          }
          if (dashboardDropdownCache.nombresVigentes && item.sujeto_pasivo) {
            return dashboardDropdownCache.nombresVigentes.some(n => n.toLowerCase() === item.sujeto_pasivo.toLowerCase());
          }
          return false;
        });
      } else if (filters.vigencia === 'no_vigentes') {
        filtered = filtered.filter((item) => {
          if (item.sujeto_pasivo_id && typeof activeSujetoIdsCache !== 'undefined' && activeSujetoIdsCache.has(item.sujeto_pasivo_id)) {
            return false;
          }
          if (dashboardDropdownCache.nombresVigentes && item.sujeto_pasivo) {
            return !dashboardDropdownCache.nombresVigentes.some(n => n.toLowerCase() === item.sujeto_pasivo.toLowerCase());
          }
          return true;
        });
      }

      if (filters.folio) {
        const val = filters.folio.toLowerCase();
        filtered = filtered.filter((item) =>
          (item.folio_lobby || "").toLowerCase().includes(val),
        );
      }
      if (filters.nombre) {
        const val = filters.nombre.toLowerCase();
        filtered = filtered.filter((item) =>
          (item.sujeto_pasivo || "").toLowerCase().includes(val),
        );
      }
      if (filters.cargo) {
        const val = filters.cargo.toLowerCase();
        filtered = filtered.filter((item) =>
          (item.cargo_limpio || getCargoClean(item.cargo) || "")
            .toLowerCase()
            .includes(val),
        );
      }
      if (filters.sujetoActivoRepresentado) {
        const val = filters.sujetoActivoRepresentado.toLowerCase();
        filtered = filtered.filter(
          (item) =>
            (item.sujeto_activo || "").toLowerCase().includes(val) ||
            (item.representado || "").toLowerCase().includes(val) ||
            (item.rut || "").toLowerCase().includes(val),
        );
      }
      if (
        filters.relacionSujetoActivo ||
        filters.relacionRut ||
        filters.relacionRepresentado
      ) {
        filtered = filtered.filter((item) => {
          let match = false;
          if (
            filters.relacionSujetoActivo &&
            item.sujeto_activo &&
            item.sujeto_activo.toLowerCase() ===
              filters.relacionSujetoActivo.toLowerCase()
          ) {
            match = true;
          }
          if (
            filters.relacionRut &&
            item.rut &&
            item.rut.toLowerCase() === filters.relacionRut.toLowerCase()
          ) {
            match = true;
          }
          if (
            filters.relacionRepresentado &&
            filters.relacionRepresentado.toLowerCase() !== "particular" &&
            item.representado &&
            item.representado.toLowerCase() ===
              filters.relacionRepresentado.toLowerCase()
          ) {
            match = true;
          }
          return match;
        });
      }
      if (filters.estado) {
        const val = filters.estado.toLowerCase();
        filtered = filtered.filter((item) => {
          const delayInfo = getPendingPublicationDelay(
            item.fecha_agendada,
            item,
          );
          const isFuera = delayInfo.days > 0;
          const itemEstadoNormalized = isFuera ? "fuera de plazo" : "en plazo";
          return itemEstadoNormalized === val;
        });
      }
      totalItems = filtered.length;
      paginatedItems = filtered.slice(
        (currentPage - 1) * pageSize,
        currentPage * pageSize,
      );
    }
  }

  let rowsHtml = "";

  if (subTab === "historial") {
    if (paginatedItems.length === 0) {
      rowsHtml = `<tr><td colspan="7" class="px-3 py-8 text-center text-xs text-text-secondary">No hay registros de audiencias publicadas.</td></tr>`;
    } else {
      paginatedItems.forEach((item) => {
        const dateTimeParts = item.fecha_inicio
          ? item.fecha_inicio.split(" ")
          : [];
        const formattedDate = dateTimeParts[0]
          ? formatDate(dateTimeParts[0])
          : "-";
        const timePart = dateTimeParts[1]
          ? dateTimeParts[1].substring(0, 5)
          : "";
        const displayDateTime = timePart
          ? `${formattedDate} ${timePart}`
          : formattedDate;

        const isFuera = (item.cumplimiento || "")
          .toLowerCase()
          .includes("fuera");
        const badgeClass = isFuera
          ? "badge-status-vencido"
          : "badge-status-enplazo";
        const displayCumplimiento = item.cumplimiento || "En plazo";

        rowsHtml += `
          <tr class="hover:bg-border-ui border-b border-border-ui transition-colors h-[72px]">
            <td class="pl-6 pr-2 text-xs font-semibold text-text-primary text-left">${escapeHtml(item.folio_lobby || "Sin Folio")}</td>
            <td class="px-2 text-xs text-text-secondary text-left">
              <div class="font-medium text-text-secondary w-full truncate">${displayDateTime}</div>
              <div class="text-[10px] text-text-secondary mt-0.5 w-full truncate">${escapeHtml(item.forma || "Presencial")}</div>
            </td>
            <td class="px-2 text-xs text-text-secondary text-left">
              <div class="font-medium text-text-secondary w-full truncate" title="${escapeHtmlAttr(normalizeName(item.sujeto_pasivo) || "Sin Nombre")}">${escapeHtml(normalizeName(item.sujeto_pasivo) || "Sin Nombre")}</div>
              <div class="text-[10px] text-text-secondary mt-0.5 w-full truncate" title="${escapeHtmlAttr(getCargoClean(item.cargo))}">${escapeHtml(getCargoClean(item.cargo))}</div>
            </td>
            <td class="px-2 text-xs text-text-secondary text-left">
              <div class="font-medium text-text-secondary w-full flex items-center justify-between gap-1">
                <span class="truncate" title="${escapeHtmlAttr(item.sujeto_activo || "Sin Activo")}">${escapeHtml(item.sujeto_activo || "Sin Activo")}</span>
                ${
                  item.sujeto_activo
                    ? `
                  <button onclick="filtrarRelacionados('publicadas', '${escapeHtmlAttr(item.sujeto_activo)}', '${escapeHtmlAttr(item.rut || "")}', '${escapeHtmlAttr(item.representado || "")}')" 
                          class="text-brand-500 dark:text-brand-400 hover:text-brand-600 dark:hover:text-brand-300 hover:bg-brand-500/10 p-0.5 rounded-lg transition-all shrink-0 cursor-pointer" 
                          title="Filtrar audiencias relacionadas (mismo RUN, representado y/o sujeto activo)">
                    <i data-lucide="info" class="h-3.5 w-3.5"></i>
                  </button>
                `
                    : ""
                }
              </div>
              <div class="text-[10px] text-text-secondary mt-0.5 w-full truncate" title="${escapeHtmlAttr(item.representado || "Particular")}">${escapeHtml(item.representado || "Particular")}</div>
            </td>
            <td class="px-2 text-xs text-text-secondary text-left"><div class="w-full truncate" title="${escapeHtmlAttr(item.especificacion_materia || item.materia || "")}">${escapeHtml(item.especificacion_materia || item.materia || "Sin Especificar")}</div></td>
            <td class="px-2 text-xs text-text-secondary text-left">
              <div class="font-semibold text-text-secondary">${formatDate(item.fecha_publicacion)}</div>
              <div class="mt-1">
                <span class="px-2 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap ${badgeClass}">${displayCumplimiento}</span>
              </div>
            </td>
            <td class="pl-2 pr-6 text-left whitespace-nowrap">
              <button onclick="showAudienciaPublicadaDetailsModal(${item.id})" class="px-3 py-1.5 rounded-lg text-xs font-semibold bg-brand-600 hover:bg-brand-500 text-white transition-all inline-block hover:shadow-md hover:shadow-brand-500/20 whitespace-nowrap cursor-pointer">Ver Detalle</button>
            </td>
          </tr>
        `;
      });
    }
  } else {
    // subTab === 'pendientes'
    if (paginatedItems.length === 0) {
      rowsHtml = `<tr><td colspan="7" class="px-3 py-8 text-center text-xs text-text-secondary">No hay solicitudes aceptadas pendientes de publicación.</td></tr>`;
    } else {
      paginatedItems.forEach((item) => {
        const delayInfo = getPendingPublicationDelay(item.fecha_agendada, item);

        rowsHtml += `
          <tr class="hover:bg-border-ui border-b border-border-ui transition-colors h-[72px]">
            <td class="pl-6 pr-2 py-4 align-middle text-xs font-semibold text-text-primary">${escapeHtml(item.folio_lobby || "Sin Folio")}</td>
            <td class="px-2 py-4 align-middle text-xs text-text-secondary">
              <div class="font-medium text-text-secondary w-full truncate">${formatDate(item.fecha_agendada)}</div>
              <div class="text-[10px] text-text-secondary mt-0.5 w-full truncate">${escapeHtml(item.forma || "Presencial")}</div>
            </td>
            <td class="px-2 py-4 align-middle text-xs text-text-secondary">
              <div class="font-medium text-text-secondary w-full truncate" title="${escapeHtmlAttr(normalizeName(item.sujeto_pasivo) || "Sin Nombre")}">${escapeHtml(normalizeName(item.sujeto_pasivo) || "Sin Nombre")}</div>
              <div class="text-[10px] text-text-secondary mt-0.5 w-full truncate" title="${escapeHtmlAttr(item.cargo_limpio || getCargoClean(item.cargo))}">${escapeHtml(item.cargo_limpio || getCargoClean(item.cargo))}</div>
            </td>
            <td class="px-2 py-4 align-middle text-xs text-text-secondary">
              <div class="font-medium text-text-secondary w-full flex items-center justify-between gap-1">
                <span class="truncate" title="${escapeHtmlAttr(item.sujeto_activo || "Sin Activo")}">${escapeHtml(item.sujeto_activo || "Sin Activo")}</span>
                ${
                  item.sujeto_activo
                    ? `
                  <button onclick="filtrarRelacionados('publicadas', '${escapeHtmlAttr(item.sujeto_activo)}', '${escapeHtmlAttr(item.rut || "")}', '${escapeHtmlAttr(item.representado || "")}')" 
                          class="text-brand-500 dark:text-brand-400 hover:text-brand-600 dark:hover:text-brand-300 hover:bg-brand-500/10 p-0.5 rounded-lg transition-all shrink-0 cursor-pointer" 
                          title="Filtrar solicitudes relacionadas (mismo RUN, representado y/o sujeto activo)">
                    <i data-lucide="info" class="h-3.5 w-3.5"></i>
                  </button>
                `
                    : ""
                }
              </div>
              <div class="text-[10px] text-text-secondary mt-0.5 w-full truncate" title="${escapeHtmlAttr(item.representado || "Particular")}">${escapeHtml(item.representado || "Particular")}</div>
            </td>
            <td class="px-2 py-4 align-middle text-xs text-text-secondary">
              <div class="font-semibold text-text-secondary">${escapeHtml(delayInfo.deadlineStr)}</div>
              <div class="text-[9px] text-text-tertiary mt-0.5">Último día hábil</div>
            </td>
            <td class="px-2 py-4 align-middle text-xs text-text-secondary">
              <span class="px-2 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap ${delayInfo.badgeClass}">${escapeHtml(delayInfo.text)}</span>
            </td>
            <td class="pl-2 pr-6 py-4 align-middle text-left whitespace-nowrap">
              <button onclick="showSolicitudDetailsModal(${item.id}, true)" class="px-3 py-1.5 rounded-lg text-xs font-semibold bg-brand-600 hover:bg-brand-500 text-white transition-all inline-block hover:shadow-md hover:shadow-brand-500/20 whitespace-nowrap cursor-pointer">Ver Detalle</button>
            </td>
          </tr>
        `;
      });
    }
  }

  const existingTable = container.querySelector("#table-publicadas");
  if (
    existingTable &&
    existingTable.dataset.subtab === subTab &&
    window.activeInputId
  ) {
    existingTable.querySelector("tbody").innerHTML = rowsHtml;
    const counterEl = container.querySelector("#publicadas-counter");
    if (counterEl) {
      counterEl.textContent =
        subTab === "historial"
          ? `${totalItems} registros publicados encontrados`
          : `${totalItems} solicitudes pendientes de publicación encontradas`;
    }
    const pagEl = container.querySelector("#publicadas-pagination-container");
    if (pagEl)
      pagEl.innerHTML = renderPaginationControls(
        "publicadas",
        totalItems,
        currentPage,
        pageSize,
      );
    lucide.createIcons();
    return;
  }

  container.innerHTML = `
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div class="space-y-1">
        <h2 class="text-2xl font-bold text-text-primary tracking-tight">Audiencias</h2>
      </div>
    </div>

    <!-- SELECCIÓN DE SUB-PESTAÑA -->
    <div class="flex gap-2 border-b border-border-ui pb-2 mt-4">
      <button onclick="changePublicadasSubTab('historial')" class="px-4 py-2 text-xs font-semibold rounded-xl transition-all ${ subTab ==="historial"
          ? "bg-brand-600 text-white shadow-md shadow-brand-500/20"
          : "text-text-secondary hover:text-text-primary hover:bg-border-ui/50"
      }">
        Historial Publicadas
      </button>
      <button onclick="changePublicadasSubTab('pendientes')" class="px-4 py-2 text-xs font-semibold rounded-xl transition-all ${ subTab ==="pendientes"
          ? "bg-brand-600 text-white shadow-md shadow-brand-500/20"
          : "text-text-secondary hover:text-text-primary hover:bg-border-ui/50"
      }">
        Pendientes de Publicación
      </button>
    </div>

    <!-- CONTENEDOR FILTROS -->
    ${renderGlassCard(
      `
      <div class="flex flex-wrap items-center justify-between border-b border-border-ui pb-3 gap-2">
        <div class="flex items-center gap-3 flex-wrap">
          <h3 class="text-xs font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400 flex items-center gap-2">
            <i data-lucide="sliders-horizontal" class="h-3.5 w-3.5"></i>
            Filtros
          </h3>
          ${renderVigenciaSelect({
            id: "filter-publicadas-vigencia",
            value: filters.vigencia,
            onChange: "changePublicadasVigencia",
          })}
        </div>
        <button onclick="clearFilters('publicadas')" class="text-[10px] text-text-tertiary hover:text-text-primary transition-colors flex items-center gap-1 cursor-pointer">
          <i data-lucide="rotate-ccw" class="h-3 w-3"></i> Limpiar Filtros
        </button>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <!-- FOLIO -->
        ${renderSearchInput({
          id: "filter-publicadas-folio",
          fieldName: "folio",
          label: "Folio",
          placeholder: "Buscar folio...",
          value: filters.folio,
          icon: "hash",
        })}
        <!-- NOMBRE -->
        ${renderSearchInput({
          id: "publicadas-filter-nombre",
          fieldName: "nombre",
          label: "Nombre Sujeto Pasivo",
          placeholder: "Escribir nombre...",
          value: filters.nombre,
          icon: "user",
          hasSuggestions: true,
        })}
        <!-- CARGO -->
        ${renderSearchInput({
          id: "publicadas-filter-cargo",
          fieldName: "cargo",
          label: "Cargo",
          placeholder: !filters.nombre
            ? "Seleccione nombre primero..."
            : "Escribir cargo...",
          value: filters.cargo,
          icon: "user",
          disabled: !filters.nombre,
          hasSuggestions: true,
        })}
        <!-- SUJETO ACTIVO / REPRESENTADO -->
        ${renderSearchInput({
          id: "publicadas-filter-sujetoActivoRepresentado",
          fieldName: "sujetoActivoRepresentado",
          label: "Sujeto Activo / Representado",
          placeholder: "Lobbista, gestor de interés o RUT...",
          value: filters.sujetoActivoRepresentado,
          icon: "users",
          hasSuggestions: true,
        })}
        <!-- ESTADO -->
        ${renderSelectInput({
          id: "filter-publicadas-estado",
          fieldName: "estado",
          label: "Estado de Cumplimiento",
          value: filters.estado,
          optionsList: [
            { value: "", text: "Todos los Estados" },
            { value: "en plazo", text: "En plazo" },
            { value: "fuera de plazo", text: "Fuera de plazo" },
          ],
        })}
      </div>
    `,
      "rounded-2xl p-5 space-y-4 relative z-20",
    )}

    <!-- BANNER DE RELACIÓN ACTIVO -->
    ${
      filters.relacionSujetoActivo ||
      filters.relacionRut ||
      filters.relacionRepresentado
        ? `
      <div class="mb-4 p-4 rounded-2xl bg-brand-50 dark:bg-brand-500/10 border border-brand-200/80 border-brand-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-brand-900 dark:text-brand-200 relative overflow-hidden glass-card">
        <div class="flex items-center gap-3">
          <div class="p-2 rounded-xl bg-brand-100 dark:bg-brand-500/20 text-brand-600 dark:text-brand-400 border border-brand-200 dark:border-brand-500/30">
            <i data-lucide="info" class="h-4 w-4"></i>
          </div>
          <div>
            <div class="font-bold text-text-primary uppercase tracking-wider text-[10px] mb-0.5">Filtrando Audiencias Relacionadas</div>
            <div class="font-medium text-text-secondary">
              Mostrando registros de sujeto activo <strong class="text-text-primary">${escapeHtml(filters.relacionSujetoActivo || "---")}</strong>
              ${filters.relacionRut ? ` (RUN: <strong class="text-text-primary font-mono">${escapeHtml(filters.relacionRut)}</strong>)` : ""}
              ${filters.relacionRepresentado ? ` y/o representado <strong class="text-text-primary">${escapeHtml(filters.relacionRepresentado)}</strong>` : ""}
            </div>
          </div>
        </div>
        <button onclick="clearRelacionFilter('publicadas')" class="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl font-bold transition-all hover:shadow-lg hover:shadow-brand-500/20 whitespace-nowrap shrink-0 text-xs cursor-pointer">
          Limpiar Filtro
        </button>
      </div>
    `
        : ""
    }

    <!-- TABLA -->
    <div class="rounded-2xl overflow-hidden mt-4 border border-border-ui glass-card">
      <div class="p-4 border-b border-border-ui flex justify-between items-center">
        <div class="text-xs text-text-secondary" id="publicadas-counter">
          ${
            subTab === "historial"
              ? `${totalItems} registros publicados encontrados`
              : `${totalItems} solicitudes pendientes de publicación encontradas`
          }
        </div>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full text-left border-collapse table-fixed" id="table-publicadas" data-subtab="${subTab}">
          <thead>
            ${
              subTab === "historial"
                ? `
              <tr class="bg-border-ui/50 border-b border-border-ui text-text-tertiary text-[10px] uppercase font-bold tracking-widest">
                <th class="pl-6 pr-2 py-3 w-36 text-left">Folio</th>
                <th class="px-2 py-3 w-28 text-left">Fecha / Forma</th>
                <th class="px-2 py-3 w-44 text-left">Sujeto Pasivo</th>
                <th class="px-2 py-3 w-44 text-left">Sujeto Activo</th>
                <th class="px-2 py-3 w-48 text-left">Materia</th>
                <th class="px-2 py-3 w-36 text-left">Publicación / Estado</th>
                <th class="pl-2 pr-6 py-3 w-32 text-left whitespace-nowrap">Acción</th>
              </tr>
            `
                : `
              <tr class="bg-border-ui/50 border-b border-border-ui text-text-tertiary text-[10px] uppercase font-bold tracking-widest">
                <th class="pl-6 pr-2 py-3 w-40 text-left">Folio</th>
                <th class="px-2 py-3 w-36 text-left">Fecha Agendada</th>
                <th class="px-2 py-3 w-56 text-left">Sujeto Pasivo</th>
                <th class="px-2 py-3 w-56 text-left">Sujeto Activo / Representado</th>
                <th class="px-2 py-3 w-40 text-left">Plazo Máximo</th>
                <th class="px-2 py-3 w-32 text-left">Estado</th>
                <th class="pl-2 pr-6 py-3 w-32 text-left whitespace-nowrap">Acción</th>
              </tr>
            `
            }
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </div>
      <div id="publicadas-pagination-container">
        ${renderPaginationControls("publicadas", totalItems, currentPage, pageSize)}
      </div>
    </div>
  `;
}

function isFechaTerminoIndefinida(ft) {
  if (!ft) return true;
  const s = String(ft).trim().toLowerCase();
  return s === '' || s === '-' || s === 'null' || s.includes('indefin');
}

function isSujetoPasivoVigente(item) {
  if (item.id_sujeto_lobby && typeof activeSujetoIdsCache !== 'undefined' && activeSujetoIdsCache.size > 0) {
    return activeSujetoIdsCache.has(item.id_sujeto_lobby);
  }
  return isFechaTerminoIndefinida(item.fecha_termino);
}

// RENDER: VISTA SUJETOS PASIVOS SPH
function renderSujetosPasivos(container) {
  const search = paginationState.sujetos_pasivos.search.toLowerCase();
  const vigencia = paginationState.sujetos_pasivos.vigencia || 'todos';
  const tipoFecha = paginationState.sujetos_pasivos.tipoFecha || 'incorporacion';
  const fechaDesde = paginationState.sujetos_pasivos.fechaDesde || '';
  const fechaHasta = paginationState.sujetos_pasivos.fechaHasta || '';

  let filtered = dataStore.sujetos_pasivos || [];
  if (vigencia === 'vigentes') {
    filtered = filtered.filter((item) => isSujetoPasivoVigente(item));
  } else if (vigencia === 'no_vigentes') {
    filtered = filtered.filter((item) => !isSujetoPasivoVigente(item));
  }

  // Filtrado condicionado por Fecha de Incorporación o Fecha de Término
  if (fechaDesde || fechaHasta) {
    filtered = filtered.filter((item) => {
      const targetDate = tipoFecha === 'termino' ? item.fecha_termino : item.fecha_incorporacion;
      if (!targetDate) return false;
      if (tipoFecha === 'termino' && isFechaTerminoIndefinida(targetDate)) return false;

      const d = targetDate.split(' ')[0];
      if (fechaDesde && d < fechaDesde) return false;
      if (fechaHasta && d > fechaHasta) return false;
      return true;
    });
  }

  if (search) {
    filtered = filtered.filter((item) => {
      const nombre = (item.nombre || "").toLowerCase();
      const rut = (item.rut || "").toLowerCase();
      const cargo = (item.cargo || "").toLowerCase();
      const tipo = (item.tipo || "").toLowerCase();
      return (
        nombre.includes(search) ||
        rut.includes(search) ||
        cargo.includes(search) ||
        tipo.includes(search)
      );
    });
  }

  // Ordenar: Indefinidos primero (por fecha_incorporacion DESC), luego fecha_termino DESC
  filtered.sort((a, b) => {
    const isIndefA = isFechaTerminoIndefinida(a.fecha_termino);
    const isIndefB = isFechaTerminoIndefinida(b.fecha_termino);

    if (isIndefA && isIndefB) {
      return (b.fecha_incorporacion || '').localeCompare(a.fecha_incorporacion || '');
    }
    if (isIndefA) return -1;
    if (isIndefB) return 1;

    return (b.fecha_termino || '').localeCompare(a.fecha_termino || '');
  });

  const totalItems = filtered.length;
  const currentPage = paginationState.sujetos_pasivos.page;
  const pageSize = 10;
  const paginatedItems = filtered.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  let rowsHtml = "";

  if (paginatedItems.length === 0) {
    rowsHtml = `<tr><td colspan="7" class="px-3 py-8 text-center text-xs text-text-secondary">No hay registros de sujetos pasivos.</td></tr>`;
  } else {
    paginatedItems.forEach((item) => {
      const isVigente = isSujetoPasivoVigente(item);
      const isIndef = isFechaTerminoIndefinida(item.fecha_termino);
      const statusBadge = isVigente
        ? `<span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold badge-status-enplazo">Vigente</span>`
        : `<span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold badge-status-vencido">No Vigente</span>`;

      rowsHtml += `
        <tr class="hover:bg-border-ui border-b border-border-ui transition-colors h-[72px]">
          <td class="pl-6 pr-3 text-xs font-semibold text-text-secondary">
            <div class="leading-snug" title="${escapeHtmlAttr(item.nombre)}">${escapeHtml(item.nombre)}</div>
          </td>
          <td class="px-2 text-xs text-text-secondary font-mono">
            <div class="w-full truncate">${escapeHtml(item.rut || "No definido")}</div>
          </td>
          <td class="px-3 text-xs text-text-secondary font-medium">
            <div class="line-clamp-2 leading-relaxed" title="${escapeHtmlAttr(getCargoClean(item.cargo))}">${escapeHtml(getCargoClean(item.cargo))}</div>
          </td>
          <td class="px-2 text-xs text-text-secondary font-mono">
            <div>${formatDate(item.fecha_incorporacion)}</div>
          </td>
          <td class="px-2 text-xs text-text-secondary font-mono">
            <div>${isIndef ? '<span class="text-text-tertiary font-bold select-none">-</span>' : formatDate(item.fecha_termino)}</div>
          </td>
          <td class="px-2 text-xs">
            ${statusBadge}
          </td>
          <td class="pl-2 pr-6 text-left whitespace-nowrap">
            <button onclick="showSujetoDetailsModal(${item.id})" class="px-3 py-1.5 rounded-lg text-xs font-semibold bg-brand-600 hover:bg-brand-500 text-white transition-all inline-block hover:shadow-md hover:shadow-brand-900/40 whitespace-nowrap cursor-pointer">
              Ver Detalle
            </button>
          </td>
        </tr>
      `;
    });
  }

  const existingTable = container.querySelector("#table-sujetos");
  if (existingTable && window.activeInputId) {
    existingTable.querySelector("tbody").innerHTML = rowsHtml;
    const counterEl = container.querySelector("#sujetos-counter");
    if (counterEl)
      counterEl.textContent = `Mostrando ${totalItems} registros en total`;
    const pagEl = container.querySelector("#sujetos-pagination-container");
    if (pagEl)
      pagEl.innerHTML = renderPaginationControls(
        "sujetos_pasivos",
        totalItems,
        currentPage,
        pageSize,
      );
    lucide.createIcons();
    return true;
  }

  container.innerHTML = `
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div class="space-y-1">
        <h2 class="text-2xl font-bold text-heading tracking-tight">Sujetos Pasivos</h2>
      </div>
    </div>

    <!-- CONTENEDOR FILTROS ESTÁNDAR (IDÉNTICO A SOLICITUDES, AUDIENCIAS Y REPORTES) -->
    ${renderGlassCard(
      `
      <div class="flex flex-wrap items-center justify-between border-b border-border-ui pb-3 gap-2">
        <div class="flex items-center gap-3 flex-wrap">
          <h3 class="text-xs font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400 flex items-center gap-2">
            <i data-lucide="sliders-horizontal" class="h-3.5 w-3.5"></i>
            Filtros
          </h3>
          ${renderVigenciaSelect({
            id: "filter-sujetos-vigencia",
            value: paginationState.sujetos_pasivos.vigencia,
            onChange: "changeSujetosPasivosVigencia",
          })}
        </div>
        ${(paginationState.sujetos_pasivos.search || paginationState.sujetos_pasivos.fechaDesde || paginationState.sujetos_pasivos.fechaHasta || paginationState.sujetos_pasivos.vigencia !== 'todos') ? `
          <button onclick="clearSujetosFilters()" class="text-[10px] text-text-tertiary hover:text-text-primary transition-colors flex items-center gap-1 cursor-pointer bg-transparent border-0">
            <i data-lucide="rotate-ccw" class="h-3 w-3"></i> Limpiar Filtros
          </button>
        ` : ''}
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <!-- BUSCADOR GENERAL -->
        ${renderSearchInput({
          id: "search-sujetos",
          fieldName: "search",
          label: "Búsqueda General",
          placeholder: "Nombre, RUT o Cargo...",
          value: paginationState.sujetos_pasivos.search,
          icon: "search",
        })}

        <!-- CRITERIO DE FECHA -->
        ${renderSelectInput({
          id: "filter-sujetos-tipoFecha",
          fieldName: "tipoFecha",
          label: "Criterio de Fecha",
          value: tipoFecha,
          optionsList: [
            { value: "incorporacion", text: "Fecha Incorporación" },
            { value: "termino", text: "Fecha Término" }
          ]
        })}

        <!-- FECHA DESDE (AIR DATEPICKER) -->
        ${renderDateInput({
          id: "filter-sujetos-fechadesde",
          fieldName: "fechaDesde",
          label: "Fecha Desde",
          value: fechaDesde,
        })}

        <!-- FECHA HASTA (AIR DATEPICKER) -->
        ${renderDateInput({
          id: "filter-sujetos-fechahasta",
          fieldName: "fechaHasta",
          label: "Fecha Hasta",
          value: fechaHasta,
        })}
      </div>
      `,
      "rounded-2xl p-5 space-y-4 relative z-20 mt-4",
    )}

    <!-- CONTENEDOR TABLA -->
    <div class="rounded-2xl overflow-hidden mt-6 border border-border-ui glass-card">
      <div class="p-4 border-b border-border-ui flex items-center justify-between">
        <div class="text-xs font-semibold text-text-tertiary uppercase tracking-wider">Registros</div>
        <div class="text-xs text-text-tertiary shrink-0" id="sujetos-counter">Mostrando ${totalItems} registros en total</div>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full text-left border-collapse table-fixed" id="table-sujetos">
          <thead>
            <tr class="bg-border-ui/50 border-b border-border-ui text-text-tertiary text-[10px] uppercase font-bold tracking-widest">
              <th class="pl-6 pr-3 py-3 w-60 text-left">Nombre Completo</th>
              <th class="px-2 py-3 w-28 text-left">RUT / RUN</th>
              <th class="px-3 py-3 min-w-[220px] text-left">Cargo</th>
              <th class="px-2 py-3 w-28 text-left">Fecha Inicio</th>
              <th class="px-2 py-3 w-28 text-left">Fecha Término</th>
              <th class="px-2 py-3 w-24 text-left">Estado</th>
              <th class="pl-2 pr-6 py-3 w-28 text-left">Acción</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </div>
      <div id="sujetos-pagination-container">
        ${renderPaginationControls("sujetos_pasivos", totalItems, currentPage, pageSize)}
      </div>
    </div>
  `;
}

// RENDER: MODAL DE DETALLES DEL SUJETO PASIVO
function showSujetoDetailsModal(sujetoId) {
  try {
    const list = dataStore.sujetos_pasivos || [];
    const item = list.find((s) => s.id == sujetoId);
    if (!item) {
      showToast("No se encontró el registro del Sujeto Pasivo.", "error");
      return;
    }

    const modal = document.getElementById("modal-container");
    if (!modal) return;

    modal.classList.remove("hidden");
    modal.classList.add("backdrop-animate-in");

    // Buscar asesores técnicos asociados
    const users = dataStore.usuarios || [];
    const asesores = users.filter((u) => u.rol === "Asistente técnico" && u.asistido_rut === item.rut);
    
    let asesoresHtml = "";
    if (asesores.length === 0) {
      asesoresHtml = `
        <p class="text-xs text-text-tertiary text-text-secondary italic mt-1.5 p-3 rounded-xl border border-border-ui bg-bg-main">
          No registra asesores técnicos.
        </p>
      `;
    } else {
      asesoresHtml = `
        <div class="grid grid-cols-1 gap-2 mt-1.5">
          ${asesores.map((a) => {
            const names = (a.nombre || "").trim().split(/\s+/);
            let initials = "AT";
            if (names.length >= 2) {
              initials = (names[0][0] + names[names.length - 1][0]).toUpperCase();
            } else if (names.length === 1 && names[0]) {
              initials = names[0].substring(0, 2).toUpperCase();
            }
            return `
              <div class="flex items-center gap-2.5 bg-bg-main border border-border-ui p-2.5 rounded-xl hover:border-border-ui dark:hover:border-border-ui transition-colors">
                <div class="h-7 w-7 rounded-full bg-brand-500/10 text-brand-500 dark:text-brand-400 flex items-center justify-center text-[10.5px] font-bold shrink-0 border border-brand-500/20">
                  ${initials}
                </div>
                <div class="truncate leading-none">
                  <p class="font-bold text-text-primary text-[11px]">${escapeHtml(a.nombre)}</p>
                  <p class="text-text-tertiary text-text-secondary text-[9.5px] mt-0.5">${escapeHtml(a.correo)}</p>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;
    }

    const isVigente = isSujetoPasivoVigente(item);
    const isIndef = isFechaTerminoIndefinida(item.fecha_termino);
    const statusBadgeModal = isVigente
      ? `<span class="px-2.5 py-0.5 text-[10px] rounded-md font-bold badge-status-enplazo">Vigente</span>`
      : `<span class="px-2.5 py-0.5 text-[10px] rounded-md font-bold badge-status-vencido">No Vigente</span>`;

    modal.innerHTML = `
      <div class="glass-card w-full max-w-lg p-6 rounded-3xl space-y-5 shadow-2xl relative modal-animate-in border border-border-ui text-[var(--text-primary)] font-sans text-left">
        <!-- Header -->
        <div class="flex items-center justify-between border-b border-border-ui pb-3">
          <div class="flex items-center gap-2">
            <div class="h-9 w-9 rounded-xl bg-brand-500/10 text-brand-500 flex items-center justify-center shrink-0">
              <i data-lucide="user" class="h-4.5 w-4.5"></i>
            </div>
            <div>
              <h3 class="text-xs font-bold uppercase tracking-wider text-text-tertiary">Detalle de Sujeto Pasivo</h3>
              <span class="text-xs font-semibold text-text-secondary text-text-secondary">ID Portal Lobby: <span class="font-mono text-brand-400 font-bold">${item.id_sujeto_lobby || "Sin ID"}</span></span>
            </div>
          </div>
          <button onclick="closeModal()" class="h-7 w-7 rounded-lg flex items-center justify-center border border-border-ui hover:bg-border-ui dark:hover:bg-border-ui/50 text-text-tertiary hover:text-text-primary transition-colors cursor-pointer bg-transparent">
            <i data-lucide="x" class="h-4 w-4"></i>
          </button>
        </div>

        <!-- Info Grid -->
        <div class="space-y-4 text-xs">
          <div>
            <span class="text-[10px] text-text-tertiary block uppercase tracking-wider font-bold">Nombre Completo</span>
            <p class="text-sm font-bold text-text-primary mt-0.5">${escapeHtml(item.nombre)}</p>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <span class="text-[10px] text-text-tertiary block uppercase tracking-wider font-bold">RUT</span>
              <p class="text-text-secondary font-semibold font-mono mt-0.5">${escapeHtml(item.rut || "No definido")}</p>
            </div>
            <div>
              <span class="text-[10px] text-text-tertiary block uppercase tracking-wider font-bold">Tipo de Sujeto Pasivo</span>
              <p class="text-text-secondary font-semibold mt-0.5">${escapeHtml(item.tipo || "Autoridad")}</p>
            </div>
          </div>

          <hr class="border-border-ui">

          <div>
            <span class="text-[10px] text-text-tertiary block uppercase tracking-wider font-bold">Cargo</span>
            <p class="text-xs text-text-secondary font-semibold mt-1 bg-bg-main border border-border-ui p-2.5 rounded-xl leading-relaxed select-text">${escapeHtml(getCargoClean(item.cargo))}</p>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <span class="text-[10px] text-text-tertiary block uppercase tracking-wider font-bold">Estado de Vigencia</span>
              <p class="mt-1">
                ${statusBadgeModal}
              </p>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <span class="text-[10px] text-text-tertiary block uppercase tracking-wider font-bold">Fecha de Inicio</span>
              <p class="text-text-secondary font-semibold font-mono mt-0.5">${formatDate(item.fecha_incorporacion)}</p>
            </div>
            <div>
              <span class="text-[10px] text-text-tertiary block uppercase tracking-wider font-bold">Fecha de Término</span>
              <p class="text-text-secondary font-semibold font-mono mt-0.5">${isIndef ? "Indefinido" : formatDate(item.fecha_termino)}</p>
            </div>
          </div>

          <hr class="border-border-ui">
          
          <div>
            <span class="text-[10px] text-text-tertiary block uppercase tracking-wider font-bold">Respaldo Jurídico (Decreto)</span>
            <p class="text-xs text-text-secondary text-text-secondary mt-1 bg-bg-main border border-border-ui p-2.5 rounded-xl leading-relaxed select-text">${escapeHtml(item.respaldo_juridico || "No registra respaldo jurídico")}</p>
          </div>

          <hr class="border-border-ui">

          <div>
            <span class="text-[10px] text-text-tertiary block uppercase tracking-wider font-bold">Asistente Técnico Registrado (Excel SPH)</span>
            <p class="text-xs text-text-secondary text-text-secondary mt-1 bg-bg-main border border-border-ui p-2.5 rounded-xl leading-relaxed select-text">${escapeHtml(item.asistente_tecnico || "No registra asistente técnico en SPH")}</p>
          </div>

          <hr class="border-border-ui">

          <div>
            <span class="text-[10px] text-text-tertiary block uppercase tracking-wider font-bold">Asesores Técnicos</span>
            ${asesoresHtml}
          </div>
        </div>

        <!-- Footer -->
        <div class="flex justify-end gap-3 pt-2">
          <button type="button" onclick="closeModal()" class="px-4 py-2.5 rounded-xl text-xs font-semibold btn-secondary cursor-pointer">
            Cerrar
          </button>
        </div>
      </div>
    `;

    lucide.createIcons();
  } catch (err) {
    console.error("Error al abrir modal del sujeto pasivo:", err);
  }
}
window.showSujetoDetailsModal = showSujetoDetailsModal;

// MODAL: DETALLE DE SOLICITUD (SOLICITUDES Y PENDIENTES DE PUBLICACIÓN)
function showSolicitudDetailsModal(idOrItem, isPending = false) {
  try {
    let item = null;
    if (typeof idOrItem === 'object' && idOrItem !== null) {
      item = idOrItem;
    } else {
      const id = idOrItem;
      if (isPending) {
        const list = dataStore.solicitudesPendientesPublicacion?.data || dataStore.solicitudesPendientesPublicacion || [];
        item = list.find((s) => s.id == id);
      }
      if (!item) {
        const list = dataStore.solicitudes?.data || dataStore.solicitudes || [];
        item = list.find((s) => s.id == id);
      }
      if (!item && dataStore.solicitudesPendientesPublicacion) {
        const list = dataStore.solicitudesPendientesPublicacion?.data || dataStore.solicitudesPendientesPublicacion || [];
        item = list.find((s) => s.id == id);
      }
      if (!item && dataStore.solicitudesRawData) {
        item = dataStore.solicitudesRawData.find((s) => s.id == id);
      }
      if (!item && dataStore.dashboardRawData) {
        item = dataStore.dashboardRawData.find((s) => s.id == id);
      }
    }

    if (!item) {
      if (typeof showToast === 'function') {
        showToast('No se encontró la información de la solicitud.', 'error');
      }
      return;
    }

    const modal = document.getElementById('modal-container');
    if (!modal) return;
    modal.classList.remove('hidden');
    modal.classList.add('backdrop-animate-in');

    const estado = item.estado || 'Ingresada';
    const badgeData = getDeadlineStatusBadge(item.fecha_ingreso, item.fecha_respuesta, estado, item);

    // Formateo de fecha y hora agendada (siempre con hora si está presente)
    const agendadaParts = item.fecha_agendada ? item.fecha_agendada.split(' ') : [];
    const agendadaDate = agendadaParts[0] ? formatDate(agendadaParts[0]) : '—';
    const agendadaTime = agendadaParts[1] ? agendadaParts[1].substring(0, 5) : '';
    const displayAgendada = (agendadaDate !== '—' && agendadaTime) ? `${agendadaDate} ${agendadaTime}` : agendadaDate;

    if (isPending) {
      // ══════════════════════════════════════════════════════════════════
      // MODAL: AUDIENCIA PENDIENTE DE PUBLICACIÓN
      // ══════════════════════════════════════════════════════════════════
      const delayInfo = getPendingPublicationDelay(item.fecha_agendada, item);
      const horaInicio = item.hora_inicio || agendadaTime || (item.fecha_inicio ? (item.fecha_inicio.split(' ')[1] ? item.fecha_inicio.split(' ')[1].substring(0, 5) : '') : '') || '—';
      const horaFin = item.hora_termino || item.hora_fin || (item.fecha_termino ? (item.fecha_termino.split(' ')[1] ? item.fecha_termino.split(' ')[1].substring(0, 5) : '') : '') || '—';

      let ddlPubStatusText = '';
      let ddlPubColorClass = 'text-emerald-500';
      if (delayInfo.days > 0) {
        ddlPubStatusText = `PFP (-${delayInfo.days}d)`;
        ddlPubColorClass = 'text-rose-500';
      } else {
        ddlPubStatusText = 'PDP';
        ddlPubColorClass = 'text-emerald-500';
      }

      modal.innerHTML = `
        <div class="glass-card w-full max-w-xl p-6 rounded-3xl space-y-5 shadow-2xl relative modal-animate-in border border-border-ui text-[var(--text-primary)] max-h-[90vh] overflow-y-auto custom-scrollbar font-sans text-left">
          <!-- Header -->
          <div class="flex items-center justify-between border-b border-border-ui pb-3">
            <div class="flex items-center gap-2">
              <div class="h-9 w-9 rounded-xl bg-brand-500/10 text-brand-500 flex items-center justify-center shrink-0">
                <i data-lucide="clock" class="h-4.5 w-4.5"></i>
              </div>
              <div>
                <h3 class="text-xs font-bold uppercase tracking-wider text-text-tertiary">Detalle de Audiencia Pendiente</h3>
                <div class="flex items-center gap-2">
                  <span class="text-xs font-semibold text-text-secondary text-text-secondary">Folio: <span class="font-mono text-brand-400 font-bold">${item.folio_lobby || "Sin Folio"}</span></span>
                  <span class="px-2 py-0.5 rounded text-[10px] font-bold ${badgeData?.class || 'badge-status-otros'}">${escapeHtml(estado)}</span>
                </div>
              </div>
            </div>
            <button onclick="closeModal()" class="h-7 w-7 rounded-lg flex items-center justify-center border border-border-ui hover:bg-border-ui dark:hover:bg-border-ui/50 text-text-tertiary hover:text-text-primary transition-colors cursor-pointer">
              <i data-lucide="x" class="h-4 w-4"></i>
            </button>
          </div>

          <!-- 1. Bloque de Tiempos y Plazos -->
          <div class="space-y-3">
            <div class="text-xs" style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.75rem;">
              <div>
                <span class="text-[10px] text-text-tertiary block uppercase tracking-wider font-bold mb-0.5">F. Ingreso</span>
                <span class="text-text-secondary font-semibold">${formatDate(item.fecha_ingreso)}</span>
              </div>
              <div>
                <span class="text-[10px] text-text-tertiary block uppercase tracking-wider font-bold mb-0.5">F. Agendada</span>
                <span class="text-text-secondary font-semibold">${displayAgendada}</span>
              </div>
              <div>
                <span class="text-[10px] text-text-tertiary block uppercase tracking-wider font-bold mb-0.5">DDL Publicación</span>
                <div class="flex items-center gap-1.5 flex-wrap">
                  <span class="text-text-secondary font-semibold">${escapeHtml(delayInfo.deadlineStr)}</span>
                  <span class="text-[11px] font-bold ${ddlPubColorClass}">${ddlPubStatusText}</span>
                </div>
              </div>
            </div>

            <div class="text-xs pt-2.5 border-t border-border-ui">
              <span class="text-[10px] text-text-tertiary block uppercase tracking-wider font-bold mb-0.5">Forma / Lugar</span>
              <span class="text-text-secondary font-semibold text-xs leading-relaxed break-words block">${escapeHtml(item.forma || 'Presencial')}${item.lugar || item.comuna ? ` — ${escapeHtml(item.lugar || item.comuna)}` : ''}</span>
            </div>
          </div>

          <hr class="border-border-ui">

          <!-- 2. Sujeto Pasivo y Solicitante -->
          <div class="space-y-3.5 text-xs">
            <div>
              <span class="text-[10px] text-text-tertiary block uppercase tracking-wider font-bold mb-0.5">Sujeto Pasivo (Autoridad / Funcionario)</span>
              <p class="text-xs text-text-primary flex items-baseline gap-1.5 flex-wrap">
                <span class="font-bold text-sm text-text-primary">${escapeHtml(normalizeName(item.sujeto_pasivo) || 'Sin Nombre')}</span>
                ${(item.cargo_limpio || getCargoClean(item.cargo) || item.cargo) ? `<span class="text-text-tertiary">—</span><span class="text-text-secondary font-medium">${escapeHtml(item.cargo_limpio || getCargoClean(item.cargo) || item.cargo)}</span>` : ''}
              </p>
            </div>

            <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem;">
              <div>
                <span class="text-[10px] text-text-tertiary block uppercase tracking-wider font-bold mb-0.5">Sujeto Activo (Lobbista/Gestor)</span>
                <p class="text-text-secondary font-semibold">${escapeHtml(item.sujeto_activo || "Particular")}</p>
                ${item.rut ? '<p class="text-[10px] text-text-tertiary font-mono mt-0.5">RUN: ' + escapeHtml(item.rut) + "</p>" : ""}
              </div>
              <div>
                <span class="text-[10px] text-text-tertiary block uppercase tracking-wider font-bold mb-0.5">Representado</span>
                <p class="text-text-secondary font-semibold">${escapeHtml(item.representado || item.sujeto_activo || "Particular")}</p>
              </div>
            </div>

            <hr class="border-border-ui">

            <!-- 3. Materia y Especificación -->
            <div>
              <span class="text-[10px] text-text-tertiary block uppercase tracking-wider font-bold mb-1">Materia</span>
              <p class="text-xs text-text-secondary font-semibold bg-bg-main border border-border-ui p-2.5 rounded-xl leading-relaxed select-text">${escapeHtml(item.materia || "Sin especificar")}</p>
            </div>

            ${item.especificacion_materia ? '<div><span class="text-[10px] text-text-tertiary block uppercase tracking-wider font-bold mb-1">Especificación de la Materia</span><p class="text-xs text-text-secondary bg-bg-main border border-border-ui p-2.5 rounded-xl leading-relaxed select-text max-h-36 overflow-y-auto custom-scrollbar">' + escapeHtml(item.especificacion_materia) + "</p></div>" : ""}
          </div>

          <!-- Footer -->
          <div class="flex justify-end gap-3 pt-2">
            ${item.id_lobby ? '<a href="https://www.leylobby.gob.cl/admin/solicitudes/' + item.id_lobby + '" target="_blank" class="px-4 py-2.5 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all hover:shadow-lg hover:shadow-brand-500/20 cursor-pointer">Ver Solicitud Original <i data-lucide="external-link" class="h-3.5 w-3.5"></i></a>' : ""}
            <button type="button" onclick="closeModal()" class="px-4 py-2.5 rounded-xl text-xs font-semibold btn-secondary cursor-pointer">
              Cerrar
            </button>
          </div>
        </div>
      `;
    } else {
      // ══════════════════════════════════════════════════════════════════
      // MODAL: SOLICITUD
      // ══════════════════════════════════════════════════════════════════
      let complianceText = '';
      let complianceColorClass = 'text-emerald-500';
      const hasRespuesta = item.fecha_respuesta && item.fecha_respuesta !== '-' && item.fecha_respuesta !== 'null' && item.fecha_respuesta !== '---';
      
      if (hasRespuesta) {
        if (item.estado_cumplimiento_sh === 'FUERA_PLAZO' || (badgeData?.subtext && badgeData.subtext.toLowerCase().includes('fuera'))) {
          const diasAtraso = item.dias_habiles_respuesta ? ` (-${item.dias_habiles_respuesta}d)` : (badgeData?.subtext?.match(/\(-?\d+d\)/)?.[0] ? ` ${badgeData.subtext.match(/\(-?\d+d\)/)[0]}` : '');
          complianceText = `Fuera de plazo${diasAtraso}`;
          complianceColorClass = 'text-rose-500';
        } else {
          complianceText = 'En plazo';
          complianceColorClass = 'text-emerald-500';
        }
      } else if (estado.toLowerCase() === 'ingresada') {
        if (badgeData?.class === 'badge-status-vencido') {
          const atraso = item.dias_restantes_sh !== undefined ? ` (-${Math.abs(item.dias_restantes_sh)}d)` : (badgeData?.subtext?.match(/\(-?\d+d\)/)?.[0] ? ` ${badgeData.subtext.match(/\(-?\d+d\)/)[0]}` : '');
          complianceText = `Fuera de plazo${atraso}`;
          complianceColorClass = 'text-rose-500';
        } else if (badgeData?.class === 'badge-status-enplazo') {
          const diffDays = item.dias_restantes_sh !== undefined ? ` (${item.dias_restantes_sh}d)` : (badgeData?.subtext?.match(/\(\d+d\)/)?.[0] ? ` ${badgeData.subtext.match(/\(\d+d\)/)[0]}` : '');
          complianceText = `En plazo${diffDays}`;
          complianceColorClass = 'text-emerald-500';
        }
      }

      modal.innerHTML = `
        <div class="glass-card w-full max-w-xl p-6 rounded-3xl space-y-5 shadow-2xl relative modal-animate-in border border-border-ui text-[var(--text-primary)] max-h-[90vh] overflow-y-auto custom-scrollbar font-sans text-left">
          <!-- Header -->
          <div class="flex items-center justify-between border-b border-border-ui pb-3">
            <div class="flex items-center gap-2">
              <div class="h-9 w-9 rounded-xl bg-brand-500/10 text-brand-500 flex items-center justify-center shrink-0">
                <i data-lucide="file-text" class="h-4.5 w-4.5"></i>
              </div>
              <div>
                <h3 class="text-xs font-bold uppercase tracking-wider text-text-tertiary">Detalle de Solicitud</h3>
                <div class="flex items-center gap-2">
                  <span class="text-xs font-semibold text-text-secondary text-text-secondary">Folio: <span class="font-mono text-brand-400 font-bold">${item.folio_lobby || "Sin Folio"}</span></span>
                  <span class="px-2 py-0.5 rounded text-[10px] font-bold ${badgeData?.class || 'badge-status-otros'}">${escapeHtml(estado)}</span>
                </div>
              </div>
            </div>
            <button onclick="closeModal()" class="h-7 w-7 rounded-lg flex items-center justify-center border border-border-ui hover:bg-border-ui dark:hover:bg-border-ui/50 text-text-tertiary hover:text-text-primary transition-colors cursor-pointer">
              <i data-lucide="x" class="h-4 w-4"></i>
            </button>
          </div>

          <!-- 1. Bloque Unificado de Tiempos y Plazos -->
          <div class="text-xs" style="display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0.65rem;">
            <div>
              <span class="text-[10px] text-text-tertiary block uppercase tracking-wider font-bold mb-0.5">F. Ingreso</span>
              <span class="text-text-secondary font-semibold">${formatDate(item.fecha_ingreso)}</span>
            </div>
            <div>
              <span class="text-[10px] text-text-tertiary block uppercase tracking-wider font-bold mb-0.5">DDL</span>
              <span class="text-text-secondary font-semibold">${item.fecha_limite_sh ? formatDate(item.fecha_limite_sh) : (item.fecha_ingreso ? formatDate(item.fecha_ingreso) : "—")}</span>
            </div>
            <div>
              <span class="text-[10px] text-text-tertiary block uppercase tracking-wider font-bold mb-0.5">F. Respuesta</span>
              <div class="flex items-center gap-1.5 flex-wrap">
                <span class="text-text-secondary font-semibold">${formatDate(item.fecha_respuesta) || '—'}</span>
                ${complianceText ? `<span class="text-[11px] font-bold ${complianceColorClass}">${complianceText}</span>` : ''}
              </div>
            </div>
            <div>
              <span class="text-[10px] text-text-tertiary block uppercase tracking-wider font-bold mb-0.5">F. Agendada</span>
              <span class="text-text-secondary font-semibold">${displayAgendada}</span>
            </div>
          </div>

          <hr class="border-border-ui">

          <!-- 2. Sujeto Pasivo y Solicitante -->
          <div class="space-y-3.5 text-xs">
            <div>
              <span class="text-[10px] text-text-tertiary block uppercase tracking-wider font-bold mb-0.5">Sujeto Pasivo (Autoridad / Funcionario)</span>
              <p class="text-xs text-text-primary flex items-baseline gap-1.5 flex-wrap">
                <span class="font-bold text-sm text-text-primary">${escapeHtml(normalizeName(item.sujeto_pasivo) || 'Sin Nombre')}</span>
                ${(item.cargo_limpio || getCargoClean(item.cargo) || item.cargo) ? `<span class="text-text-tertiary">—</span><span class="text-text-secondary font-medium">${escapeHtml(item.cargo_limpio || getCargoClean(item.cargo) || item.cargo)}</span>` : ''}
              </p>
            </div>

            <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem;">
              <div>
                <span class="text-[10px] text-text-tertiary block uppercase tracking-wider font-bold mb-0.5">Sujeto Activo (Lobbista/Gestor)</span>
                <p class="text-text-secondary font-semibold">${escapeHtml(item.sujeto_activo || "Particular")}</p>
                ${item.rut ? '<p class="text-[10px] text-text-tertiary font-mono mt-0.5">RUN: ' + escapeHtml(item.rut) + "</p>" : ""}
              </div>
              <div>
                <span class="text-[10px] text-text-tertiary block uppercase tracking-wider font-bold mb-0.5">Representado</span>
                <p class="text-text-secondary font-semibold">${escapeHtml(item.representado || item.sujeto_activo || "Particular")}</p>
              </div>
            </div>

            <hr class="border-border-ui">

            <!-- 3. Materia y Especificación -->
            <div>
              <span class="text-[10px] text-text-tertiary block uppercase tracking-wider font-bold mb-1">Materia</span>
              <p class="text-xs text-text-secondary font-semibold bg-bg-main border border-border-ui p-2.5 rounded-xl leading-relaxed select-text">${escapeHtml(item.materia || "Sin especificar")}</p>
            </div>

            ${item.especificacion_materia ? '<div><span class="text-[10px] text-text-tertiary block uppercase tracking-wider font-bold mb-1">Especificación de la Materia</span><p class="text-xs text-text-secondary bg-bg-main border border-border-ui p-2.5 rounded-xl leading-relaxed select-text max-h-36 overflow-y-auto custom-scrollbar">' + escapeHtml(item.especificacion_materia) + "</p></div>" : ""}
          </div>

          <!-- Footer -->
          <div class="flex justify-end gap-3 pt-2">
            ${item.id_lobby ? '<a href="https://www.leylobby.gob.cl/admin/solicitudes/' + item.id_lobby + '" target="_blank" class="px-4 py-2.5 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all hover:shadow-lg hover:shadow-brand-500/20 cursor-pointer">Ver Solicitud Original <i data-lucide="external-link" class="h-3.5 w-3.5"></i></a>' : ""}
            <button type="button" onclick="closeModal()" class="px-4 py-2.5 rounded-xl text-xs font-semibold btn-secondary cursor-pointer">
              Cerrar
            </button>
          </div>
        </div>
      `;
    }

    lucide.createIcons();
  } catch (err) {
    console.error('Error al abrir modal de detalle de solicitud:', err);
  }
}
window.showSolicitudDetailsModal = showSolicitudDetailsModal;

// MODAL: DETALLE DE AUDIENCIA PUBLICADA (HISTORIAL DE PUBLICADAS)
function showAudienciaPublicadaDetailsModal(idOrItem) {
  try {
    let item = null;
    if (typeof idOrItem === 'object' && idOrItem !== null) {
      item = idOrItem;
    } else {
      const id = idOrItem;
      const list = dataStore.publicadas?.data || dataStore.publicadas || [];
      item = list.find((s) => s.id == id);
      if (!item && dataStore.reportesRawData) {
        item = dataStore.reportesRawData.find((s) => s.id == id);
      }
    }

    if (!item) {
      if (typeof showToast === 'function') {
        showToast('No se encontró la información de la audiencia.', 'error');
      }
      return;
    }

    const modal = document.getElementById('modal-container');
    if (!modal) return;
    modal.classList.remove('hidden');
    modal.classList.add('backdrop-animate-in');

    const dateTimeParts = item.fecha_inicio ? item.fecha_inicio.split(" ") : [];
    const formattedDate = dateTimeParts[0] ? formatDate(dateTimeParts[0]) : "-";
    const horaInicio = dateTimeParts[1] ? dateTimeParts[1].substring(0, 5) : (item.hora_inicio || "—");

    const terminoParts = item.fecha_termino ? item.fecha_termino.split(" ") : [];
    const horaTermino = terminoParts[1] ? terminoParts[1].substring(0, 5) : (item.hora_termino || item.hora_fin || "—");
    const duracion = item.duracion || "—";

    const isFuera = (item.cumplimiento || "").toLowerCase().includes("fuera");
    const cumplimientoColorClass = isFuera ? "text-rose-500" : "text-emerald-500";
    const lobbyId = item.id_solicitud_lobby || item.id_lobby;

    modal.innerHTML = `
      <div class="glass-card w-full max-w-xl p-6 rounded-3xl space-y-5 shadow-2xl relative modal-animate-in border border-border-ui text-[var(--text-primary)] max-h-[90vh] overflow-y-auto custom-scrollbar font-sans text-left">
        <!-- Header -->
        <div class="flex items-center justify-between border-b border-border-ui pb-3">
          <div class="flex items-center gap-2">
            <div class="h-9 w-9 rounded-xl bg-brand-500/10 text-brand-500 flex items-center justify-center shrink-0">
              <i data-lucide="calendar-check" class="h-4.5 w-4.5"></i>
            </div>
            <div>
              <h3 class="text-xs font-bold uppercase tracking-wider text-text-tertiary">Detalle de Audiencia Publicada</h3>
              <span class="text-xs font-semibold text-text-secondary text-text-secondary">Folio: <span class="font-mono text-brand-400 font-bold">${item.folio_lobby || "Sin Folio"}</span></span>
            </div>
          </div>
          <button onclick="closeModal()" class="h-7 w-7 rounded-lg flex items-center justify-center border border-border-ui hover:bg-border-ui dark:hover:bg-border-ui/50 text-text-tertiary hover:text-text-primary transition-colors cursor-pointer">
            <i data-lucide="x" class="h-4 w-4"></i>
          </button>
        </div>

        <!-- 1. Bloque Unificado de Tiempos y Plazos -->
        <div class="space-y-3">
          <!-- Fila 1: 3 columnas perfectamente alineadas -->
          <div class="text-xs" style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.75rem;">
            <div>
              <span class="text-[10px] text-text-tertiary block uppercase tracking-wider font-bold mb-0.5">F. Realización</span>
              <span class="text-text-secondary font-semibold">${escapeHtml(formattedDate)}</span>
            </div>
            <div>
              <span class="text-[10px] text-text-tertiary block uppercase tracking-wider font-bold mb-0.5">F. Publicación</span>
              <span class="text-text-secondary font-semibold">${formatDate(item.fecha_publicacion)}</span>
            </div>
            <div>
              <span class="text-[10px] text-text-tertiary block uppercase tracking-wider font-bold mb-0.5">Cumplimiento</span>
              <div>
                <span class="text-xs font-bold ${cumplimientoColorClass}">
                  ${escapeHtml(item.cumplimiento || 'Publicada')}
                </span>
              </div>
            </div>
          </div>

          <!-- Fila 2: 3 columnas perfectamente alineadas con la Fila 1 -->
          <div class="text-xs pt-2.5 border-t border-border-ui" style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.75rem;">
            <div>
              <span class="text-[10px] text-text-tertiary block uppercase tracking-wider font-bold mb-0.5">Hora de Inicio</span>
              <span class="text-text-secondary font-semibold">${escapeHtml(horaInicio)}</span>
            </div>
            <div>
              <span class="text-[10px] text-text-tertiary block uppercase tracking-wider font-bold mb-0.5">Hora de Término</span>
              <span class="text-text-secondary font-semibold">${escapeHtml(horaTermino)}</span>
            </div>
            <div>
              <span class="text-[10px] text-text-tertiary block uppercase tracking-wider font-bold mb-0.5">Duración</span>
              <span class="text-text-secondary font-semibold">${escapeHtml(duracion)}</span>
            </div>
          </div>

          <!-- Fila 3: Forma / Lugar ancho completo -->
          <div class="text-xs pt-2.5 border-t border-border-ui">
            <span class="text-[10px] text-text-tertiary block uppercase tracking-wider font-bold mb-0.5">Forma / Lugar</span>
            <span class="text-text-secondary font-semibold text-xs leading-relaxed break-words block">${escapeHtml(item.forma || 'Presencial')}${item.lugar || item.comuna ? ` — ${escapeHtml(item.lugar || item.comuna)}` : ''}</span>
          </div>
        </div>

        <hr class="border-border-ui">

        <!-- 2. Sujeto Pasivo y Solicitante -->
        <div class="space-y-3.5 text-xs">
          <div>
            <span class="text-[10px] text-text-tertiary block uppercase tracking-wider font-bold mb-0.5">Sujeto Pasivo (Autoridad / Funcionario)</span>
            <p class="text-xs text-text-primary flex items-baseline gap-1.5 flex-wrap">
              <span class="font-bold text-sm text-text-primary">${escapeHtml(normalizeName(item.sujeto_pasivo) || 'Sin Nombre')}</span>
              ${(item.cargo_limpio || getCargoClean(item.cargo) || item.cargo) ? `<span class="text-text-tertiary">—</span><span class="text-text-secondary font-medium">${escapeHtml(item.cargo_limpio || getCargoClean(item.cargo) || item.cargo)}</span>` : ''}
            </p>
          </div>

          <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem;">
            <div>
              <span class="text-[10px] text-text-tertiary block uppercase tracking-wider font-bold mb-0.5">Sujeto Activo (Lobbista/Gestor)</span>
              <p class="text-text-secondary font-semibold">${escapeHtml(item.sujeto_activo || "Particular")}</p>
              ${item.rut ? '<p class="text-[10px] text-text-tertiary font-mono mt-0.5">RUN: ' + escapeHtml(item.rut) + "</p>" : ""}
            </div>
            <div>
              <span class="text-[10px] text-text-tertiary block uppercase tracking-wider font-bold mb-0.5">Representado</span>
              <p class="text-text-secondary font-semibold">${escapeHtml(item.representado || item.sujeto_activo || "Particular")}</p>
            </div>
          </div>

          <hr class="border-border-ui">

          <!-- 3. Materia y Especificación -->
          <div>
            <span class="text-[10px] text-text-tertiary block uppercase tracking-wider font-bold mb-1">Materia</span>
            <p class="text-xs text-text-secondary font-semibold bg-bg-main border border-border-ui p-2.5 rounded-xl leading-relaxed select-text">${escapeHtml(item.materia || "Sin especificar")}</p>
          </div>

          ${item.especificacion_materia ? '<div><span class="text-[10px] text-text-tertiary block uppercase tracking-wider font-bold mb-1">Especificación de la Materia</span><p class="text-xs text-text-secondary bg-bg-main border border-border-ui p-2.5 rounded-xl leading-relaxed select-text max-h-36 overflow-y-auto custom-scrollbar">' + escapeHtml(item.especificacion_materia) + "</p></div>" : ""}
        </div>

        <!-- Footer -->
        <div class="flex justify-end gap-3 pt-2">
          ${lobbyId ? '<a href="https://www.leylobby.gob.cl/admin/solicitudes/' + lobbyId + '" target="_blank" class="px-4 py-2.5 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all hover:shadow-lg hover:shadow-brand-500/20 cursor-pointer">Ver Solicitud Original <i data-lucide="external-link" class="h-3.5 w-3.5"></i></a>' : ""}
          <button type="button" onclick="closeModal()" class="px-4 py-2.5 rounded-xl text-xs font-semibold btn-secondary cursor-pointer">
            Cerrar
          </button>
        </div>
      </div>
    `;

    lucide.createIcons();
  } catch (err) {
    console.error('Error al abrir modal de audiencia publicada:', err);
  }
}
window.showAudienciaPublicadaDetailsModal = showAudienciaPublicadaDetailsModal;

function changeAdminTab(tabName) {
  activeAdminTab = tabName;
  const container = document.getElementById("main-content");
  if (!container) return;

  // Si se cambia a Reportes y no hay datos cargados, los buscamos primero
  if (tabName === "reportes") {
    if (typeof fetchActiveSujetoIds === "function") {
      fetchActiveSujetoIds();
    }
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

  // Inicialización y sincronización inmediata de datepickers en cualquier sub-pestaña
  if (typeof initAirDatepickerFields === "function") {
    requestAnimationFrame(() => {
      initAirDatepickerFields();
      if (typeof syncAllLinkedDatepickers === "function") syncAllLinkedDatepickers();
    });
  }
}

function renderHistoryList() {
  const list = dataStore.syncHistory || [];
  if (list.length === 0) {
    return `<p class="text-center text-[10px] text-text-tertiary py-4">No se registran sincronizaciones previas.</p>`;
  }

  return list
    .map((item) => {
      let badgeClass = "badge-status-normal";
      if (item.estado === "Exitoso") {
        badgeClass = "badge-status-enplazo";
      } else if (item.estado === "Fallido") {
        badgeClass = "badge-status-vencido";
      } else if (item.estado === "Cancelado") {
        badgeClass = "badge-status-otros";
      }

      let dateStr = item.timestamp;
      try {
        const d = new Date(item.timestamp.replace(" ", "T") + "Z");
        dateStr = d.toLocaleString("es-CL", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        });
      } catch (err) {
        dateStr = item.timestamp || '';
      }

      let detailStr = "";
      let hasDetails = false;
      try {
        const statsObj = JSON.parse(item.detalles);
        const ins =
          (statsObj.sh?.inserts || 0) +
          (statsObj.ph?.inserts || 0) +
          (statsObj.sph?.inserts || 0);
        const upd =
          (statsObj.sh?.updates || 0) +
          (statsObj.ph?.updates || 0) +
          (statsObj.sph?.updates || 0);
        const del =
          (statsObj.sh?.deletes || 0) +
          (statsObj.ph?.deletes || 0) +
          (statsObj.sph?.deletes || 0);
        detailStr = `${ins} creados, ${upd} act., ${del} elim.`;
        hasDetails =
          (statsObj.sh?.details && statsObj.sh.details.length > 0) ||
          (statsObj.ph?.details && statsObj.ph.details.length > 0) ||
          (statsObj.sph?.details && statsObj.sph.details.length > 0);
      } catch (e) {
        detailStr = item.detalles || "";
      }

      return `
      <div class="p-2.5 rounded-xl border text-[11px] space-y-1.5 hover:border-border-ui dark:hover:border-border-ui transition-colors" style="background-color: var(--bg-main); border-color: var(--border-ui);">
        <div class="flex justify-between items-center gap-2">
          <span class="font-bold text-heading">${dateStr}</span>
          <div class="flex items-center gap-1.5">
            <span class="px-1.5 py-0.5 rounded-md text-[9px] font-semibold ${badgeClass}">${item.estado}</span>
            ${
              hasDetails
                ? `
              <button onclick="viewSyncDetails(${item.id})" class="text-brand-500 hover:text-brand-400 p-0.5 transition-colors cursor-pointer border-none bg-transparent flex items-center justify-center" title="Ver detalles de los cambios">
                <i data-lucide="eye" class="h-3.5 w-3.5"></i>
              </button>
            `
                : ""
            }
          </div>
        </div>
        <div class="text-[10px] text-body-muted font-medium truncate" title="${item.usuario}">${item.usuario}</div>
        <div class="text-[10px] text-heading font-mono leading-tight whitespace-normal break-words">${detailStr}</div>
      </div>
    `;
    })
    .join("");
}

function generateUsuarioRowHtml(item) {
  const names = (item.nombre || "").trim().split(/\s+/);
  let initials = "U";
  if (names.length >= 2) {
    initials = (names[0][0] + names[names.length - 1][0]).toUpperCase();
  } else if (names.length === 1 && names[0]) {
    initials = names[0].substring(0, 2).toUpperCase();
  }

  const colors = [
    "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
    "bg-brand-500/10 text-brand-600 dark:text-brand-400 border-brand-500/20",
    "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
    "bg-rose-500/10 text-pink-600 dark:text-rose-400 border-pink-500/20",
    "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20",
  ];
  let hash = 0;
  const nameStr = item.nombre || "";
  for (let i = 0; i < nameStr.length; i++) {
    hash = nameStr.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % colors.length;
  const avatarColorClass = colors[index];

  let roleClasses = "";
  switch (item.rol) {
    case "Administrador":
      roleClasses = "bg-brand-500/10 text-brand-500 dark:text-brand-400 border-brand-500/20 border";
      break;
    case "Auditor":
      roleClasses =
        "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-badge-enplazo-border border";
      break;
    case "Sujeto Pasivo":
      roleClasses = "bg-card-amber-bg text-card-amber-text border-card-amber-border border";
      break;
    case "Asistente técnico":
      roleClasses =
        "bg-badge-ingresada-bg text-badge-ingresada-text border-badge-ingresada-border border";
      break;
    default:
      roleClasses = "bg-border-ui/40 text-text-tertiary border-border-ui border";
  }

  let asistidoSubtext = "";
  if (item.rol === "Asistente técnico" && item.asistido_rut) {
    const sp = (dataStore.sujetos_pasivos || []).find(
      (s) => s.rut === item.asistido_rut,
    );
    const asistidoNombre = sp ? sp.nombre : item.asistido_rut;
    asistidoSubtext = `
      <div class="text-[9px] text-text-tertiary font-medium truncate mt-0.5" title="Asiste a: ${asistidoNombre}">
        Asiste a: <span class="font-semibold text-text-secondary">${asistidoNombre}</span>
      </div>
    `;
  }

  return `
    <tr class="hover:bg-border-ui border-b border-border-ui transition-colors h-[72px]">
      <td class="pl-6 pr-2 text-xs font-semibold text-text-primary">
        <div class="flex items-center gap-3">
          <div class="h-8 w-8 rounded-full flex items-center justify-center text-[10px] font-bold border ${avatarColorClass} shrink-0 shadow-sm">
            ${initials}
          </div>
          <div class="font-semibold text-heading truncate max-w-[180px]">${escapeHtml(item.nombre)}</div>
        </div>
      </td>
      <td class="px-2 text-xs text-text-secondary font-mono"><div class="w-full truncate">${escapeHtml(item.rut || "-")}</div></td>
      <td class="px-2 text-xs text-text-secondary font-mono"><div class="w-full truncate">${escapeHtml(item.correo)}</div></td>
      <td class="px-2 text-xs">
        <div class="w-full truncate">
          <span class="px-2 py-0.5 rounded text-[10px] font-bold border ${roleClasses}">${escapeHtml(item.rol)}</span>
          ${asistidoSubtext}
        </div>
      </td>
      <td class="pl-2 pr-6 text-right whitespace-nowrap">
        <div class="flex items-center justify-end gap-1">
          ${
            currentUser && currentUser.rol === 'Administrador' && item.id !== currentUser.id && !currentUser.isSimulated
              ? `<button onclick="startImpersonation(${item.id})" class="p-1.5 rounded-lg text-text-tertiary hover:text-amber-500 hover:bg-amber-500/10 dark:hover:bg-amber-500/20 transition-all" title="Simular Usuario">
                   <i data-lucide="user-check" class="h-3.5 w-3.5"></i>
                 </button>`
              : ''
          }
          <button onclick="openUsuarioModal(${item.id})" class="p-1.5 rounded-lg text-text-tertiary hover:text-brand-600 hover:bg-brand-500/10 dark:hover:bg-brand-500/20 transition-all" title="Editar">
            <i data-lucide="edit-2" class="h-3.5 w-3.5"></i>
          </button>
          ${
            currentUser && item.id === currentUser.id
              ? `<button disabled class="p-1.5 rounded-lg text-text-secondary cursor-not-allowed opacity-40" title="No puedes eliminar tu propio usuario">
                 <i data-lucide="trash-2" class="h-3.5 w-3.5"></i>
               </button>`
              : `<button onclick="deleteRecord('usuarios', ${item.id})" class="p-1.5 rounded-lg text-text-tertiary hover:text-rose-600 hover:bg-rose-500/10 dark:hover:bg-rose-500/20 transition-all" title="Eliminar">
                 <i data-lucide="trash-2" class="h-3.5 w-3.5"></i>
               </button>`
          }
        </div>
      </td>
    </tr>
  `;
}

function filterUsuarios() {
  const query = (document.getElementById("search-usuarios")?.value || "")
    .toLowerCase()
    .trim();
  const tbody = document.querySelector("#table-usuarios tbody");
  if (!tbody) return;

  const items = dataStore.usuarios || [];
  const filtered = items.filter((user) => {
    return (
      (user.nombre || "").toLowerCase().includes(query) ||
      (user.correo || "").toLowerCase().includes(query) ||
      (user.rut || "").toLowerCase().includes(query) ||
      (user.rol || "").toLowerCase().includes(query)
    );
  });

  let rowsHtml = "";
  if (filtered.length === 0) {
    rowsHtml = `<tr><td colspan="5" class="px-3 py-8 text-center text-xs text-text-secondary">No se encontraron usuarios coincidentes.</td></tr>`;
  } else {
    filtered.forEach((item) => {
      rowsHtml += generateUsuarioRowHtml(item);
    });
  }
  tbody.innerHTML = rowsHtml;
  lucide.createIcons();
}

// Helper: Variable y conmutador de ámbito de Administración ('gestion' | 'sistema')
if (typeof window.activeAdminScope === 'undefined') {
  window.activeAdminScope = 'gestion';
}

function switchAdminScope(scopeName) {
  window.activeAdminScope = scopeName;
  if (scopeName === 'gestion') {
    changeAdminTab('auditoria');
  } else {
    changeAdminTab('usuarios');
  }
}
window.switchAdminScope = switchAdminScope;

// Helper: Genera el HTML de los botones de pestañas de Administración con conmutador de ámbito
function _buildAdminTabsNavHtml(activeTab) {
  const rol = (window.currentUser && window.currentUser.rol) || '';

  // Forzar 'gestion' si el usuario es Auditor
  if (rol === 'Auditor') {
    window.activeAdminScope = 'gestion';
  } else {
    const sistemaTabs = ['usuarios', 'sincronizacion', 'database', 'logs'];
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
      <button onclick="changeAdminTab('usuarios')" class="${tabClass('usuarios')}"><i data-lucide="users" class="h-4 w-4"></i> Gestión de Usuarios</button>
      <button onclick="changeAdminTab('sincronizacion')" class="${tabClass('sincronizacion')}"><i data-lucide="refresh-cw" class="h-4 w-4"></i> Sincronización</button>
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
      <!-- Selector de Ámbito Segmentado (Gestión vs Sistema) -->
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

      <!-- Barra de 4 Pestañas Directas -->
      <nav class="-mb-px flex space-x-6 items-center overflow-x-auto scrollbar-none shrink-0" aria-label="Tabs">
        ${tabsListHtml}
      </nav>
    </div>
  `;
}

// RENDER: VISTA CONTROL USUARIOS
function renderUsuarios(container) {
  const rol = (window.currentUser && window.currentUser.rol) || '';
  if (typeof activeAdminTab === "undefined" || (rol === 'Auditor' && activeAdminTab === 'auditoria')) {
    activeAdminTab = rol === 'Auditor' ? 'sujetos' : 'auditoria';
  }

  // Bloques de contenido para sujetos y reportes se delegan a sus funciones de render
  // pero dentro del shell completo de la vista de Administración (encabezado + tabs)
  let contentHtml = "";

  if (activeAdminTab === "sujetos") {
    const isPartialUpdate = renderSujetosPasivos(container);
    if (isPartialUpdate) {
      if (typeof syncAllLinkedDatepickers === "function") {
        requestAnimationFrame(() => syncAllLinkedDatepickers());
      }
      return;
    }
    const adminShell = document.createElement('div');
    adminShell.innerHTML = `
      <div class="space-y-1">
        <h2 class="text-2xl font-bold text-heading tracking-tight">Administración</h2>
      </div>
      <div class="border-b border-border-ui mt-6 mb-0 relative z-30">
        ${_buildAdminTabsNavHtml(activeAdminTab)}
      </div>
    `;
    container.insertBefore(adminShell, container.firstChild);
    if (window.lucide && typeof window.lucide.createIcons === "function") window.lucide.createIcons();
    if (typeof initAirDatepickerFields === "function") {
      requestAnimationFrame(() => {
        initAirDatepickerFields();
        if (typeof syncAllLinkedDatepickers === "function") syncAllLinkedDatepickers();
      });
    }
    return;
  }
  if (activeAdminTab === "reportes") {
    const isPartialUpdate = renderReportes(container);
    if (isPartialUpdate) {
      if (typeof syncAllLinkedDatepickers === "function") {
        requestAnimationFrame(() => syncAllLinkedDatepickers());
      }
      return;
    }
    const adminShell = document.createElement('div');
    adminShell.innerHTML = `
      <div class="space-y-1">
        <h2 class="text-2xl font-bold text-heading tracking-tight">Administración</h2>
      </div>
      <div class="border-b border-border-ui mt-6 mb-0 relative z-30">
        ${_buildAdminTabsNavHtml(activeAdminTab)}
      </div>
    `;
    container.insertBefore(adminShell, container.firstChild);
    if (window.lucide && typeof window.lucide.createIcons === "function") window.lucide.createIcons();
    if (typeof initAirDatepickerFields === "function") {
      requestAnimationFrame(() => {
        initAirDatepickerFields();
        if (typeof syncAllLinkedDatepickers === "function") syncAllLinkedDatepickers();
      });
    }
    return;
  }

  if (activeAdminTab === "usuarios") {
    const items = dataStore.usuarios || [];
    let rowsHtml = "";

    if (items.length === 0) {
      rowsHtml = `<tr><td colspan="5" class="px-3 py-8 text-center text-xs text-text-secondary">No hay registros de usuarios encontrados.</td></tr>`;
    } else {
      items.forEach((item) => {
        rowsHtml += generateUsuarioRowHtml(item);
      });
    }

    contentHtml = `
      <div class="space-y-6 mt-6">
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div class="relative w-full max-w-md">
            <span class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-tertiary">
              <i data-lucide="search" class="h-4 w-4"></i>
            </span>
            <input type="text" id="search-usuarios" oninput="filterUsuarios()" placeholder="Buscar por nombre, correo, rut..." class="w-full py-2.5 pl-9 pr-4 rounded-xl text-xs glass-input focus:outline-none transition-colors">
          </div>
          
          <div class="flex items-center gap-2.5 w-full sm:w-auto sm:justify-end shrink-0">
            <button id="btn-sincronizar-usuarios" onclick="confirmarSincronizacionUsuarios(this)" class="px-4 py-2.5 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2 transition-all hover:shadow-lg hover:shadow-brand-500/20 shrink-0 cursor-pointer">
              <i data-lucide="cloud-lightning" class="h-4 w-4"></i> Sincronizar usuarios
            </button>
            <button id="btn-registrar-usuario" onclick="openUsuarioModal()" class="px-4 py-2.5 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2 transition-all hover:shadow-lg hover:shadow-brand-500/20 shrink-0 cursor-pointer">
              <i data-lucide="plus" class="h-4 w-4"></i> Registrar Usuario
            </button>
          </div>
        </div>

        <div class="rounded-2xl overflow-hidden border border-border-ui mt-4 glass-card">
          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse table-fixed" id="table-usuarios">
              <thead>
                <tr class="bg-border-ui/50 border-b border-border-ui text-text-tertiary text-[10px] uppercase font-bold tracking-widest">
                  <th class="pl-6 pr-2 py-3 w-44 text-left">Nombre Completo</th>
                  <th class="px-2 py-3 w-28 text-left">RUT</th>
                  <th class="px-2 py-3 w-48 text-left">Correo Electrónico</th>
                  <th class="px-2 py-3 w-32 text-left">Rol</th>
                  <th class="pl-2 pr-6 py-3 w-24 text-right whitespace-nowrap">Acciones</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  } else if (activeAdminTab === "sincronizacion") {
    let lastSyncStr = "Sin registros";
    if (dataStore.syncHistory && dataStore.syncHistory.length > 0) {
      const lastSync = dataStore.syncHistory[0];
      try {
        const d = new Date(lastSync.timestamp.replace(" ", "T") + "Z");
        lastSyncStr = d.toLocaleString("es-CL", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        });
      } catch (e) {
        lastSyncStr = lastSync.timestamp;
      }
    }

    contentHtml = `
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-4 animate-fade-in">
        <div class="glass-card p-4 rounded-2xl flex items-center gap-4 shadow-sm">
          <div class="h-10 w-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0">
            <i data-lucide="file-text" class="h-5 w-5"></i>
          </div>
          <div>
            <p class="text-[10px] text-text-tertiary font-bold uppercase tracking-wider">Total Solicitudes</p>
            <p class="text-xl font-bold text-heading mt-0.5">${dataStore.stats.solicitudes ?? "-"}</p>
          </div>
        </div>
        <div class="glass-card p-4 rounded-2xl flex items-center gap-4 shadow-sm">
          <div class="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <i data-lucide="calendar-check" class="h-5 w-5"></i>
          </div>
          <div>
            <p class="text-[10px] text-text-tertiary font-bold uppercase tracking-wider">Publicadas PH</p>
            <p class="text-xl font-bold text-heading mt-0.5">${dataStore.stats.publicadas ?? "-"}</p>
          </div>
        </div>
        <div class="glass-card p-4 rounded-2xl flex items-center gap-4 shadow-sm">
          <div class="h-10 w-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center shrink-0">
            <i data-lucide="users" class="h-5 w-5"></i>
          </div>
          <div>
            <p class="text-[10px] text-text-tertiary font-bold uppercase tracking-wider">Sujetos Pasivos</p>
            <p class="text-xl font-bold text-heading mt-0.5">${dataStore.stats.sujetos_pasivos ?? "-"}</p>
          </div>
        </div>
        <div class="glass-card p-4 rounded-2xl flex items-center gap-4 shadow-sm">
          <div class="h-10 w-10 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center shrink-0">
            <i data-lucide="shield-check" class="h-5 w-5"></i>
          </div>
          <div>
            <p class="text-[10px] text-text-tertiary font-bold uppercase tracking-wider">Usuarios Activos</p>
            <p class="text-xl font-bold text-heading mt-0.5">${dataStore.stats.usuarios ?? "-"}</p>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6 animate-fade-in">
        <div class="lg:col-span-2 space-y-4">
          ${renderGlassCard(
            `
            <div class="border-b border-border-ui pb-3 flex items-center gap-2 mb-4">
              <i data-lucide="refresh-cw" class="h-4 w-4 text-brand-400"></i>
              <h3 class="text-xs font-bold uppercase tracking-wider text-brand-400">Panel de Sincronización</h3>
            </div>
            <div class="space-y-4">
              <p class="text-xs text-text-secondary leading-relaxed">
                Seleccione el archivo de datos Excel ('.xlsx') y luego haga clic en "Procesar e Importar Excel" para actualizar los datos locales y subirlos a SharePoint. O haga clic en "Sincronizar desde SharePoint" para descargar cualquier versión más reciente de la nube.
              </p>
              <div class="grid grid-cols-1 gap-4">
                <div class="border rounded-xl p-4" style="background-color: var(--bg-main); border-color: var(--border-ui);">
                  <span class="text-[10px] text-body-muted font-bold uppercase tracking-wider block mb-1">Última Sincronización de Base de Datos</span>
                  <span class="text-xs font-mono text-heading font-semibold break-all">${lastSyncStr}</span>
                </div>
              </div>

              <!-- Selector de Archivo Excel con soporte de Drag & Drop -->
              <div class="border-2 border-dashed border-border-ui rounded-xl p-5 text-center hover:border-brand-500 transition-colors cursor-pointer bg-bg-main relative" 
                   onclick="document.getElementById('import-excel-file').click()"
                   ondragover="event.preventDefault(); this.classList.add('border-brand-500')"
                   ondragleave="this.classList.remove('border-brand-500')"
                   ondrop="event.preventDefault(); this.classList.remove('border-brand-500'); if(event.dataTransfer.files.length) { document.getElementById('import-excel-file').files = event.dataTransfer.files; handleExcelFileSelected({target: document.getElementById('import-excel-file')}); }">
                <input type="file" id="import-excel-file" accept=".xlsx" class="hidden" onchange="handleExcelFileSelected(event)">
                <div class="space-y-2 pointer-events-none">
                  <i data-lucide="file-spreadsheet" class="h-8 w-8 text-text-tertiary mx-auto"></i>
                  <p class="text-xs font-semibold text-text-secondary" id="excel-file-label">Haz clic para buscar o arrastra aquí tu archivo Excel</p>
                  <p class="text-[10px] text-text-tertiary" id="excel-file-details">Solo formato .xlsx (Ley de Lobby)</p>
                </div>
              </div>
              
              <div id="import-progress-container" class="hidden space-y-2 py-2">
                <div class="flex justify-between text-[10px]">
                  <span id="import-progress-status" class="text-text-tertiary font-medium">Sincronizando registros...</span>
                  <span class="text-brand-400 font-bold animate-pulse">En curso</span>
                </div>
                <div class="w-full bg-border-ui h-1.5 rounded-full overflow-hidden">
                  <div class="bg-brand-500 h-full w-full animate-pulse rounded-full" style="width: 100%;"></div>
                </div>
              </div>

              <div class="flex flex-col sm:flex-row gap-3 pt-2">
                <button id="btn-import-sync" onclick="triggerImport()" disabled class="flex-1 py-3 bg-border-ui/50 text-text-tertiary rounded-xl text-xs font-bold transition-all cursor-not-allowed flex items-center justify-center gap-2">
                  <i data-lucide="file-up" class="h-4 w-4"></i>
                  <span>Procesar e Importar Excel</span>
                </button>
                
                <button id="btn-sharepoint-sync" onclick="triggerSharepointSync()" class="flex-1 py-3 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-bold transition-all active:scale-[0.98] flex items-center justify-center gap-2">
                  <i data-lucide="refresh-cw" class="h-4 w-4"></i>
                  <span>Sincronizar desde SharePoint</span>
                </button>
                
                <button onclick="downloadBackup()" class="py-3 px-6 rounded-xl text-xs font-bold transition-all btn-secondary active:scale-[0.98] flex items-center justify-center gap-2 shrink-0">
                  <i data-lucide="download" class="h-4 w-4"></i>
                  <span>Respaldar BD</span>
                </button>
              </div>
            </div>
          `,
            "rounded-2xl p-6 shadow-sm relative z-20",
          )}
        </div>

        <div class="space-y-4">
          ${renderGlassCard(
            `
            <div class="border-b border-border-ui pb-3 flex items-center gap-2 mb-4">
              <i data-lucide="activity" class="h-4 w-4 text-brand-400"></i>
              <h3 class="text-xs font-bold uppercase tracking-wider text-brand-400">Salud del Sistema</h3>
            </div>
            <div class="space-y-3.5 text-xs">
              <div class="flex justify-between items-center py-1 border-b border-border-ui">
                <span class="text-body-muted">Base de Datos:</span>
                <span class="font-bold text-heading font-mono">${dataStore.dbHealth?.dbSize || "-"}</span>
              </div>
              <div class="flex justify-between items-center py-1 border-b border-border-ui">
                <span class="text-body-muted">Integridad SQLite:</span>
                <span class="font-bold font-mono px-2 py-0.5 rounded text-[10px] ${dataStore.dbHealth?.integrity ==="ok" ? "badge-status-enplazo" : "badge-status-vencido"}" style="margin-left: auto;">${dataStore.dbHealth?.integrity || "-"}</span>
              </div>
              <div class="flex justify-between items-center py-1">
                <span class="text-body-muted">Firma Digital (HMAC):</span>
                <span class="font-bold font-mono px-2 py-0.5 rounded text-[10px] ${dataStore.dbHealth?.signatureStatus ==="Válida" ? "badge-status-enplazo" : "badge-status-vencido"}" style="margin-left: auto;">${dataStore.dbHealth?.signatureStatus || "-"}</span>
              </div>
            </div>
          `,
            "rounded-2xl p-6 shadow-sm",
          )}

          ${renderGlassCard(
            `
            <div class="border-b border-border-ui pb-3 flex items-center gap-2 mb-4">
              <i data-lucide="history" class="h-4 w-4 text-brand-400"></i>
              <h3 class="text-xs font-bold uppercase tracking-wider text-brand-400">Historial Reciente</h3>
            </div>
            <div class="space-y-3 max-h-60 overflow-y-auto pr-1">
              ${renderHistoryList()}
            </div>
          `,
            "rounded-2xl p-6 shadow-sm",
          )}
        </div>
      </div>
    `;
  } else if (activeAdminTab === "logs") {
    contentHtml = renderLogsTabHtml();
  } else if (activeAdminTab === "database") {
    contentHtml = renderDatabaseInspectorHtml();
  } else if (activeAdminTab === "auditoria") {
    const list = dataStore.auditoria || [];
    // Ordenar ascendentemente por fecha para cálculo correcto de variaciones
    const sortedAudits = [...list].sort((a, b) =>
      a.fecha.localeCompare(b.fecha),
    );

    // Obtener valores actuales de la base de datos para la comparación de discrepancias
    const liveVals = dataStore.valoresActuales || {
      ingresada: 0,
      aceptada: 0,
      rechazada: 0,
      suspendida: 0,
      cancelada: 0,
      encomendada: 0,
      publicada: 0,
    };
    const liveTotal =
      liveVals.ingresada +
      liveVals.aceptada +
      liveVals.rechazada +
      liveVals.suspendida +
      liveVals.cancelada +
      liveVals.encomendada;

    const formatVariation = (val, prevVal) => {
      if (prevVal === undefined || prevVal === null || prevVal === 0) return "";
      const diff = val - prevVal;
      const pct = (diff / prevVal) * 100;
      if (pct === 0)
        return `<span class="text-text-tertiary text-[9px] ml-1">0,00%</span>`;
      const sign = pct > 0 ? "+" : "";
      const colorClass =
        pct > 0
          ? "text-emerald-600 dark:text-emerald-400 font-semibold animate-pulse-subtle"
          : "text-rose-600 dark:text-rose-400 font-semibold";
      return `<span class="${colorClass} text-[9px] ml-1">${sign}${pct.toFixed(2).replace(".", ",")}%</span>`;
    };

    // Construcción de la Tabla Semanal (última ingresada primero)
    let weeklyRowsHtml = "";
    if (sortedAudits.length === 0) {
      weeklyRowsHtml = `<tr><td colspan="10" class="px-3 py-8 text-center text-xs text-text-tertiary">No hay registros de auditoría cargados.</td></tr>`;
    } else {
      for (let i = sortedAudits.length - 1; i >= 0; i--) {
        const cur = sortedAudits[i];
        const prev = i > 0 ? sortedAudits[i - 1] : null;

        const curTotal = cur.total || 0;
        const prevTotal = prev ? prev.total || 0 : null;

        // Comprobación de discrepancias (solo se alertan para el último registro semanal disponible y si está En Proceso)
        const isLatest = i === sortedAudits.length - 1;
        const isEnProceso = cur.estado === "En Proceso";
        const discIngresada =
          isLatest && isEnProceso && cur.ingresada !== liveVals.ingresada;
        const discAceptada =
          isLatest && isEnProceso && cur.aceptada !== liveVals.aceptada;
        const discRechazada =
          isLatest && isEnProceso && cur.rechazada !== liveVals.rechazada;
        const discSuspendida =
          isLatest && isEnProceso && cur.suspendida !== liveVals.suspendida;
        const discCancelada =
          isLatest && isEnProceso && cur.cancelada !== liveVals.cancelada;
        const discEncomendada =
          isLatest && isEnProceso && cur.encomendada !== liveVals.encomendada;
        const discPublicada =
          isLatest && isEnProceso && cur.publicada !== liveVals.publicada;
        const discTotal = isLatest && isEnProceso && curTotal !== liveTotal;

        const hasAnyDiscrepancy =
          discIngresada ||
          discAceptada ||
          discRechazada ||
          discSuspendida ||
          discCancelada ||
          discEncomendada ||
          discPublicada ||
          discTotal;

        let warningBadge = "";
        if (cur.estado === "Cerrado") {
          warningBadge = `
            <span class="px-1.5 py-0.5 rounded text-[8px] font-bold badge-status-enplazo flex items-center gap-1 inline-flex shrink-0 select-none cursor-default">
              <i data-lucide="shield-check" class="h-2.5 w-2.5 shrink-0"></i> Validado
            </span>
          `;
        } else {
          warningBadge = `
            <div class="flex flex-col items-end gap-1 shrink-0">
              <span class="px-1.5 py-0.5 rounded text-[8px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1 inline-flex shrink-0 select-none cursor-default">
                <i data-lucide="clock" class="h-2.5 w-2.5 shrink-0 animate-pulse"></i> En Proceso
              </span>
              ${
                hasAnyDiscrepancy
                  ? `
              <span class="px-1.5 py-0.5 rounded text-[8px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center gap-1 inline-flex shrink-0 select-none cursor-default" title="Discrepancia detectada con la base de datos actual.">
                <i data-lucide="alert-circle" class="h-2.5 w-2.5 shrink-0"></i> Discrepancia
              </span>
              `
                  : ""
              }
            </div>
          `;
        }

        const formatCell = (val, prevVal, isDisc, liveVal) => {
          const formattedVal = val.toLocaleString("es-CL");
          const variation =
            prevVal !== null ? formatVariation(val, prevVal) : "";
          const discClass = isDisc
            ? "bg-rose-500/20 text-rose-300 font-bold border border-rose-500/30 rounded px-1.5 py-0.5"
            : "";
          const titleText = isDisc
            ? `title="Cifra en Sistema: ${liveVal.toLocaleString("es-CL")} (Discrepancia: ${val - liveVal})"`
            : "";
          return `<div class="flex flex-col items-start gap-0.5">
            <span class="${discClass} inline-block" ${titleText}>${formattedVal}</span>
            ${variation}
          </div>`;
        };

        // Formatear fecha DD-MM-YYYY
        let dateStr = cur.fecha;
        try {
          const parts = cur.fecha.split(" ");
          if (parts[0]) {
            const dateParts = parts[0].split("-");
            if (dateParts.length === 3) {
              dateStr = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}${parts[1] ? " " + parts[1] : ""}`;
            }
          }
        } catch (err) {
          dateStr = cur.fecha || '';
        }

        const cerrarBtnHtml =
          isEnProceso && isLatest
            ? `<button onclick="closeAuditoriaRecord(${cur.id})" class="p-1.5 rounded-lg text-text-tertiary hover:text-brand-500 hover:bg-brand-500/10 dark:hover:bg-brand-500/20 transition-all shrink-0" title="Cerrar y Validar Control Semanal">
               <i data-lucide="check-square" class="h-3.5 w-3.5"></i>
             </button>`
            : `<div class="w-[26px] h-[26px] shrink-0"></div>`;

        weeklyRowsHtml += `
          <tr class="hover:bg-border-ui border-b border-border-ui transition-colors h-[64px]">
            <td class="pl-6 pr-2 text-xs font-semibold text-text-primary font-mono">
              <div class="flex flex-col">
                <span class="text-text-secondary font-semibold text-[11px]">${dateStr}</span>
                <span class="text-[9px] text-text-tertiary font-medium">${cur.usuario || "Sistema"}</span>
              </div>
            </td>
            <td class="px-2 text-xs font-semibold text-text-primary">${formatCell(curTotal, prevTotal, discTotal, liveTotal)}</td>
            <td class="px-2 text-xs text-text-secondary">${formatCell(cur.ingresada, prev ? prev.ingresada : null, discIngresada, liveVals.ingresada)}</td>
            <td class="px-2 text-xs text-text-secondary">${formatCell(cur.aceptada, prev ? prev.aceptada : null, discAceptada, liveVals.aceptada)}</td>
            <td class="px-2 text-xs text-text-secondary">${formatCell(cur.rechazada, prev ? prev.rechazada : null, discRechazada, liveVals.rechazada)}</td>
            <td class="px-2 text-xs text-text-secondary">${formatCell(cur.suspendida, prev ? prev.suspendida : null, discSuspendida, liveVals.suspendida)}</td>
            <td class="px-2 text-xs text-text-secondary">${formatCell(cur.cancelada, prev ? prev.cancelada : null, discCancelada, liveVals.cancelada)}</td>
            <td class="px-2 text-xs text-text-secondary">${formatCell(cur.encomendada, prev ? prev.encomendada : null, discEncomendada, liveVals.encomendada)}</td>
            <td class="px-2 text-xs text-text-secondary">${formatCell(cur.publicada, prev ? prev.publicada : null, discPublicada, liveVals.publicada)}</td>
            <td class="pl-2 pr-6 text-right whitespace-nowrap">
              <div class="flex items-center justify-end gap-1">
                <div class="flex items-center gap-1 mr-2">${warningBadge}</div>
                ${cerrarBtnHtml}
                <button onclick="openAuditoriaModal(${cur.id})" class="p-1.5 rounded-lg text-text-tertiary hover:text-brand-400 hover:bg-brand-500/10 dark:hover:bg-brand-500/20 transition-all" title="Editar">
                  <i data-lucide="edit-2" class="h-3.5 w-3.5"></i>
                </button>
                <button onclick="deleteAuditoria(${cur.id})" class="p-1.5 rounded-lg text-text-tertiary hover:text-rose-500 hover:bg-rose-500/10 dark:hover:bg-rose-500/20 transition-all" title="Eliminar">
                  <i data-lucide="trash-2" class="h-3.5 w-3.5"></i>
                </button>
              </div>
            </td>
          </tr>
        `;
      }
    }

    // Construcción de la Tabla Mensual (Cierres de mes)
    const monthlyGroups = {};
    sortedAudits.forEach((aud) => {
      const yyyymm = aud.fecha.slice(0, 7); // e.g. "2026-06"
      monthlyGroups[yyyymm] = aud; // Sobrescribe con el último registro cronológico del mes
    });

    const monthlyKeys = Object.keys(monthlyGroups).sort();
    let monthlyRowsHtml = "";
    if (monthlyKeys.length === 0) {
      monthlyRowsHtml = `<tr><td colspan="10" class="px-3 py-8 text-center text-xs text-text-tertiary">No hay datos de auditoría mensual disponibles.</td></tr>`;
    } else {
      for (let i = monthlyKeys.length - 1; i >= 0; i--) {
        const key = monthlyKeys[i];
        const cur = monthlyGroups[key];
        const prevKey = i > 0 ? monthlyKeys[i - 1] : null;
        const prev = prevKey ? monthlyGroups[prevKey] : null;

        const curTotal = cur.total || 0;
        const prevTotal = prev ? prev.total || 0 : null;

        let monthName = key;
        try {
          const parts = key.split("-");
          const yearShort = parts[0].slice(2);
          const months = [
            "ene",
            "feb",
            "mar",
            "abr",
            "may",
            "jun",
            "jul",
            "ago",
            "sep",
            "oct",
            "nov",
            "dic",
          ];
          const monthIndex = parseInt(parts[1], 10) - 1;
          monthName = `${months[monthIndex]}-${yearShort}`;
        } catch (err) {
          monthName = key;
        }

        const formatMonthlyCell = (val, prevVal) => {
          const formattedVal = val.toLocaleString("es-CL");
          const variation =
            prevVal !== null ? formatVariation(val, prevVal) : "";
          return `<div class="flex flex-col items-start gap-0.5">
            <span>${formattedVal}</span>
            ${variation}
          </div>`;
        };

        monthlyRowsHtml += `
          <tr class="hover:bg-border-ui border-b border-border-ui transition-colors h-[56px]">
            <td class="pl-6 pr-2 text-xs font-bold text-text-secondary uppercase">${monthName}</td>
            <td class="px-2 text-xs font-semibold text-text-primary">${formatMonthlyCell(curTotal, prevTotal)}</td>
            <td class="px-2 text-xs text-text-secondary">${formatMonthlyCell(cur.ingresada, prev ? prev.ingresada : null)}</td>
            <td class="px-2 text-xs text-text-secondary">${formatMonthlyCell(cur.aceptada, prev ? prev.aceptada : null)}</td>
            <td class="px-2 text-xs text-text-secondary">${formatMonthlyCell(cur.rechazada, prev ? prev.rechazada : null)}</td>
            <td class="px-2 text-xs text-text-secondary">${formatMonthlyCell(cur.suspendida, prev ? prev.suspendida : null)}</td>
            <td class="px-2 text-xs text-text-secondary">${formatMonthlyCell(cur.cancelada, prev ? prev.cancelada : null)}</td>
            <td class="px-2 text-xs text-text-secondary">${formatMonthlyCell(cur.encomendada, prev ? prev.encomendada : null)}</td>
            <td class="px-2 text-xs text-text-secondary">${formatMonthlyCell(cur.publicada, prev ? prev.publicada : null)}</td>
            <td class="pl-2 pr-6"></td>
          </tr>
        `;
      }
    }

    contentHtml = `
      <div class="space-y-6 mt-6 animate-fade-in">
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div class="space-y-1">
            <h3 class="text-sm font-bold text-text-primary flex items-center gap-2">
              <i data-lucide="clipboard-check" class="h-4 w-4 text-brand-400"></i>
              Control de Auditoría Semanal
            </h3>
            <p class="text-xs text-text-tertiary">Auditoría manual.</p>
          </div>
          <button id="btn-registrar-auditoria" onclick="openAuditoriaModal()" class="px-4 py-2.5 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2 transition-all hover:shadow-lg hover:shadow-brand-500/20 shrink-0">
            <i data-lucide="plus" class="h-4 w-4"></i> Registrar Control Semanal
          </button>
        </div>

        <!-- TABLA PROGRESIÓN MENSUAL -->
        <div class="space-y-2">
          <span class="text-[10px] font-bold text-brand-400 uppercase tracking-wider block">Tabla Superior: Progresión Mensual (Estados de Solicitud)</span>
          <div class="rounded-2xl overflow-hidden border border-border-ui glass-card">
            <div class="overflow-x-auto">
              <table class="w-full text-left border-collapse table-fixed">
                <thead>
                  <tr class="bg-border-ui/50 border-b border-border-ui text-text-tertiary text-[9px] uppercase font-bold tracking-widest">
                    <th class="pl-6 pr-2 py-3 w-32 text-left">Mes</th>
                    <th class="px-2 py-3 w-28 text-left">Total Mensual</th>
                    <th class="px-2 py-3 w-24 text-left">Ingresada</th>
                    <th class="px-2 py-3 w-24 text-left">Aceptada</th>
                    <th class="px-2 py-3 w-24 text-left">Rechazada</th>
                    <th class="px-2 py-3 w-24 text-left">Suspendida</th>
                    <th class="px-2 py-3 w-24 text-left">Cancelada</th>
                    <th class="px-2 py-3 w-28 text-left">Encomendada</th>
                    <th class="px-2 py-3 w-24 text-left">Publicada</th>
                    <th class="pl-2 pr-6 py-3 w-16"></th>
                  </tr>
                </thead>
                <tbody>
                  ${monthlyRowsHtml}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- TABLA CONTROL SEMANAL -->
        <div class="space-y-2">
          <span class="text-[10px] font-bold text-brand-400 uppercase tracking-wider block">Tabla Inferior: Registro Histórico Semanal (Control Físico)</span>
          <div class="rounded-2xl overflow-hidden border border-border-ui glass-card">
            <div class="overflow-x-auto">
              <table class="w-full text-left border-collapse table-fixed">
                <thead>
                  <tr class="bg-border-ui/50 border-b border-border-ui text-text-tertiary text-[9px] uppercase font-bold tracking-widest">
                    <th class="pl-6 pr-2 py-3 w-40 text-left">Fecha de Control</th>
                    <th class="px-2 py-3 w-28 text-left">Total</th>
                    <th class="px-2 py-3 w-24 text-left">Ingresada</th>
                    <th class="px-2 py-3 w-24 text-left">Aceptada</th>
                    <th class="px-2 py-3 w-24 text-left">Rechazada</th>
                    <th class="px-2 py-3 w-24 text-left">Suspendida</th>
                    <th class="px-2 py-3 w-24 text-left">Cancelada</th>
                    <th class="px-2 py-3 w-28 text-left">Encomendada</th>
                    <th class="px-2 py-3 w-24 text-left">Publicada</th>
                    <th class="pl-2 pr-6 py-3 w-48 text-right">Validación / Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  ${weeklyRowsHtml}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  if (activeAdminTab === "asistencia") {
    contentHtml = renderAsistenciaTabHtml();
  }

  container.innerHTML = `
    <div class="space-y-1">
      <h2 class="text-2xl font-bold text-heading tracking-tight">Administración</h2>
    </div>

    <div class="border-b border-border-ui mt-6 mb-0 relative z-30">
      ${_buildAdminTabsNavHtml(activeAdminTab)}
    </div>

    ${contentHtml}
  `;

  if (window.lucide && typeof window.lucide.createIcons === "function") {
    window.lucide.createIcons();
  }

  if (activeAdminTab === "asistencia" && typeof initAsistenciaTab === "function") {
    setTimeout(initAsistenciaTab, 50);
  }

  if (activeAdminTab === "logs" && typeof refreshAdminLogs === "function") {
    setTimeout(refreshAdminLogs, 50);
  }
}

// RENDER: PESTAÑA ASISTENCIA TÉCNICA (ADMINISTRACIÓN)
function renderAsistenciaTabHtml() {
  if (typeof activeAsistenciaSubTab === "undefined") {
    window.activeAsistenciaSubTab = "bitacora";
  }

  const subTabClass = (tab) => {
    return activeAsistenciaSubTab === tab
      ? "px-4 py-2 rounded-xl text-xs font-bold bg-brand-600 text-white shadow-sm flex items-center gap-2 transition-all cursor-default"
      : "px-4 py-2 rounded-xl text-xs font-semibold text-text-secondary  hover:text-text-primary dark:hover:text-text-primary hover:bg-border-ui dark:hover:bg-border-ui/50 flex items-center gap-2 transition-all cursor-pointer";
  };

  let subContent = renderAsistenciaBitacoraViewHtml();
  if (activeAsistenciaSubTab === "contactos") {
    subContent = renderAsistenciaContactosViewHtml();
  } else if (activeAsistenciaSubTab === "categorias") {
    subContent = renderAsistenciaCategoriasViewHtml();
  }

  return `
    <div class="space-y-5 animate-fade-in font-sans mt-4">
      
      <!-- SUB-BARRA DE NAVEGACIÓN (BITÁCORA / DIRECTORIO / CATEGORÍAS) -->
      <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-2 border-b border-border-ui">
        <div class="flex items-center gap-2 flex-wrap">
          <button onclick="changeAsistenciaSubTab('bitacora')" class="${subTabClass('bitacora')}">
            <i data-lucide="clipboard-list" class="h-4 w-4"></i>
            <span>Bitácora de Atenciones</span>
          </button>
          <button onclick="changeAsistenciaSubTab('contactos')" class="${subTabClass('contactos')}">
            <i data-lucide="users" class="h-4 w-4"></i>
            <span>Directorio de Contactos</span>
          </button>
          <button onclick="changeAsistenciaSubTab('categorias')" class="${subTabClass('categorias')}">
            <i data-lucide="tags" class="h-4 w-4"></i>
            <span>Materias y Categorías</span>
          </button>
        </div>
      </div>

      <!-- CONTENIDO DE LA SUB-PESTAÑA SELECCIONADA -->
      <div id="asistencia-subtab-content">
        ${subContent}
      </div>
    </div>
  `;
}

// Sub-vista: Bitácora de Atenciones
function renderAsistenciaBitacoraViewHtml() {
  return `
    <div class="space-y-4">
      <!-- 4 TARJETAS KPI EJECUTIVAS -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div class="glass-card p-4 rounded-2xl flex items-center gap-3.5 shadow-xs border border-border-ui bg-bg-header">
          <div class="h-10 w-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 border border-blue-500/20">
            <i data-lucide="clipboard-check" class="h-5 w-5"></i>
          </div>
          <div class="min-w-0">
            <p class="text-[10px] text-text-tertiary font-bold uppercase tracking-wider">Atenciones del Mes</p>
            <p id="kpi-asistencia-total" class="text-xl font-bold text-text-primary mt-0.5">--</p>
          </div>
        </div>

        <div class="glass-card p-4 rounded-2xl flex items-center gap-3.5 shadow-xs border border-border-ui bg-bg-header">
          <div class="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/20">
            <i data-lucide="check-circle" class="h-5 w-5"></i>
          </div>
          <div class="min-w-0">
            <p class="text-[10px] text-text-tertiary font-bold uppercase tracking-wider">Tasa de Resolución</p>
            <p id="kpi-asistencia-pct-tel" class="text-xl font-bold text-text-primary mt-0.5">--%</p>
          </div>
        </div>

        <div class="glass-card p-4 rounded-2xl flex items-center gap-3.5 shadow-xs border border-border-ui bg-bg-header">
          <div class="h-10 w-10 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0 border border-purple-500/20">
            <i data-lucide="building-2" class="h-5 w-5"></i>
          </div>
          <div class="min-w-0">
            <p class="text-[10px] text-text-tertiary font-bold uppercase tracking-wider">Mayor Demanda</p>
            <p id="kpi-asistencia-top-cat" class="text-sm font-bold text-text-primary mt-1 truncate">--</p>
          </div>
        </div>

        <div class="glass-card p-4 rounded-2xl flex items-center gap-3.5 shadow-xs border border-border-ui bg-bg-header">
          <div class="h-10 w-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/20">
            <i data-lucide="clock" class="h-5 w-5"></i>
          </div>
          <div class="min-w-0">
            <p class="text-[10px] text-text-tertiary font-bold uppercase tracking-wider">En Seguimiento</p>
            <p id="kpi-asistencia-pendientes" class="text-xl font-bold text-text-primary mt-0.5">--</p>
          </div>
        </div>
      </div>

      <!-- SECCIÓN DE GRÁFICOS DINÁMICOS APEXCHARTS (DEMANDA Y EVOLUCIÓN) -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
        
        <!-- GRÁFICO 1: DEMANDA POR DIRECCIÓN MUNICIPAL -->
        <div class="glass-card p-4 rounded-2xl border border-border-ui bg-bg-header shadow-xs flex flex-col justify-between">
          <div class="flex items-center justify-between mb-2">
            <div class="flex items-center gap-2">
              <div class="h-8 w-8 rounded-lg bg-brand-500/10 text-brand-600 dark:text-brand-400 flex items-center justify-center">
                <i data-lucide="bar-chart-2" class="h-4 w-4"></i>
              </div>
              <div>
                <h3 class="text-xs font-bold text-text-primary uppercase tracking-wider">Demanda por Dirección</h3>
                <p class="text-[10px] text-text-tertiary">Atenciones por unidad y depto. municipal</p>
              </div>
            </div>
          </div>
          <div id="chart-asistencia-direcciones" class="w-full min-h-[220px] flex items-center justify-center text-xs text-text-tertiary">
            <i data-lucide="loader-2" class="h-5 w-5 animate-spin mr-2 text-brand-500"></i> Cargando gráfico...
          </div>
        </div>

        <!-- GRÁFICO 2: EVOLUCIÓN TEMPORAL DE ASISTENCIAS -->
        <div class="glass-card p-4 rounded-2xl border border-border-ui bg-bg-header shadow-xs flex flex-col justify-between">
          <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-2">
            <div class="flex items-center gap-2">
              <div class="h-8 w-8 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                <i data-lucide="trending-up" class="h-4 w-4"></i>
              </div>
              <div>
                <h3 class="text-xs font-bold text-text-primary uppercase tracking-wider">Evolución de Consultas</h3>
                <p class="text-[10px] text-text-tertiary">Tendencia histórica y comparativa</p>
              </div>
            </div>
            
            <div class="flex items-center gap-1.5 flex-wrap">
              <!-- Selector Granularidad: Semanal / Mensual / Anual -->
              <div class="flex items-center bg-border-ui p-0.5 rounded-lg border border-border-ui text-[10px] font-semibold">
                <button type="button" id="btn-evol-semanal" onclick="setAsistenciaEvolucionView('semanal')" class="px-2 py-0.5 rounded-md text-text-secondary hover:text-text-primary dark:hover:text-text-primary cursor-pointer">
                  Semanal
                </button>
                <button type="button" id="btn-evol-mensual" onclick="setAsistenciaEvolucionView('mensual')" class="px-2 py-0.5 rounded-md bg-bg-card text-brand-600 dark:text-brand-400 shadow-xs cursor-pointer">
                  Mensual
                </button>
                <button type="button" id="btn-evol-anual" onclick="setAsistenciaEvolucionView('anual')" class="px-2 py-0.5 rounded-md text-text-secondary hover:text-text-primary dark:hover:text-text-primary cursor-pointer">
                  Anual
                </button>
              </div>

              <!-- Toggle Comparar -->
              <button type="button" id="btn-evol-comparar" onclick="toggleAsistenciaComparar()" class="px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/30 hover:bg-brand-500/20 transition-all flex items-center gap-1 cursor-pointer" title="Activar/Desactivar comparativa con el periodo anterior">
                <i data-lucide="split" class="h-3 w-3"></i>
                <span id="label-evol-comparar">Comparar: ON</span>
              </button>
            </div>
          </div>
          <div id="chart-asistencia-evolucion" class="w-full min-h-[220px] flex items-center justify-center text-xs text-text-tertiary">
            <i data-lucide="loader-2" class="h-5 w-5 animate-spin mr-2 text-brand-500"></i> Cargando gráfico...
          </div>
        </div>

      </div>

      <!-- BARRA DE HERRAMIENTAS Y FILTROS -->
      <div class="glass-card p-3.5 rounded-2xl border border-border-ui bg-bg-header space-y-3 shadow-xs">
        <div class="flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-3">
          
          <!-- Filtros de Búsqueda y Dropdowns -->
          <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 flex-1">
            <!-- Buscador -->
            <div class="relative">
              <i data-lucide="search" class="absolute left-3 top-2.5 h-3.5 w-3.5 text-text-tertiary"></i>
              <input type="text" id="filter-asistencia-search" oninput="handleAsistenciasFilterChange()" placeholder="Buscar por nombre, depto, motivo..."
                class="w-full pl-8.5 pr-3 py-1.5 glass-input rounded-xl text-xs text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-colors font-medium">
            </div>

            <!-- Filtro Canal -->
            <select id="filter-asistencia-canal" onchange="handleAsistenciasFilterChange()" class="glass-input rounded-xl px-2.5 py-1.5 text-xs text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 cursor-pointer">
              <option value="todos">Canal: Todos</option>
              <option value="telefono">📞 Teléfono</option>
              <option value="correo">✉️ Correo</option>
              <option value="presencial">👥 Presencial</option>
              <option value="teams">💬 Teams</option>
            </select>

            <!-- Filtro Materia -->
            <select id="filter-asistencia-categoria" onchange="handleAsistenciasFilterChange()" class="glass-input rounded-xl px-2.5 py-1.5 text-xs text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 cursor-pointer">
              <option value="todas">Materia: Todas</option>
              <option value="plazos">Plazos Legales</option>
              <option value="plataforma">Uso Plataforma / ClaveÚnica</option>
              <option value="sujetos_pasivos">Sujetos Pasivos</option>
              <option value="derivaciones">Derivaciones / Improcedencia</option>
              <option value="actas">Carga de Actas</option>
              <option value="normativa">Normativa Ley 20.730</option>
              <option value="otro">Otro / General</option>
            </select>

            <!-- Filtro Estado -->
            <select id="filter-asistencia-estado" onchange="handleAsistenciasFilterChange()" class="glass-input rounded-xl px-2.5 py-1.5 text-xs text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 cursor-pointer">
              <option value="todos">Estado: Todos</option>
              <option value="resuelta">🟢 Resuelta</option>
              <option value="en_seguimiento">🟡 En Seguimiento</option>
              <option value="derivada">🔵 Derivada</option>
            </select>
          </div>

          <!-- Botones de Acción y Exportación -->
          <div class="flex items-center gap-2 shrink-0 justify-end">
            <button onclick="openAssistanceConsole()" class="px-3.5 py-1.5 bg-brand-600 hover:bg-brand-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-xs cursor-pointer" title="Registrar asistencia en consola flotante (Ctrl+Shift+A)">
              <i data-lucide="plus" class="h-3.5 w-3.5"></i>
              <span>Nueva Asistencia</span>
              <span class="text-[9px] bg-brand-700/60 px-1 py-0.5 rounded font-mono hidden sm:inline">Ctrl+Shift+A</span>
            </button>
            <button onclick="exportAsistenciasExcel()" class="px-3 py-1.5 bg-bg-card hover:bg-border-ui dark:hover:bg-border-ui/50 text-text-secondary border border-border-ui rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer" title="Exportar bitácora a Excel">
              <i data-lucide="file-spreadsheet" class="h-3.5 w-3.5 text-emerald-500"></i>
              <span class="hidden sm:inline">Excel</span>
            </button>
            <button onclick="exportAsistenciasConsolidadoPDF()" class="px-3 py-1.5 bg-bg-card hover:bg-border-ui dark:hover:bg-border-ui/50 text-text-secondary border border-border-ui rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer" title="Exportar reporte consolidado en PDF">
              <i data-lucide="file-text" class="h-3.5 w-3.5 text-rose-500"></i>
              <span class="hidden sm:inline">PDF</span>
            </button>
          </div>
        </div>
      </div>

      <!-- TABLA DE BITÁCORA DE ATENCIONES -->
      <div class="glass-card rounded-2xl overflow-hidden border border-border-ui bg-bg-header shadow-xs">
        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs border-collapse">
            <thead>
              <tr class="border-b border-border-ui bg-bg-main text-[10px] font-bold text-text-tertiary uppercase tracking-wider">
                <th class="px-4 py-3 text-left w-32">Ticket / Fecha</th>
                <th class="px-3 py-3 text-center w-24">Canal</th>
                <th class="px-4 py-3 text-left min-w-[150px]">Solicitante</th>
                <th class="px-4 py-3 text-left w-28">Dirección</th>
                <th class="px-3 py-3 text-left w-36">Materia</th>
                <th class="px-4 py-3 text-left min-w-[220px]">Motivo & Orientación</th>
                <th class="px-3 py-3 text-center w-36">Estado</th>
                <th class="px-4 py-3 text-right w-36">Acciones</th>
              </tr>
            </thead>
            <tbody id="tabla-asistencias-body" class="divide-y divide-border-ui divide-border-ui">
              <tr>
                <td colspan="8" class="text-center py-8 text-text-tertiary">
                  <i data-lucide="loader-2" class="h-5 w-5 animate-spin mx-auto mb-2 text-brand-500"></i>
                  Cargando bitácora de asistencias...
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Paginación shadcn/ui -->
        <div id="asistencia-pagination" class="p-3 border-t border-border-ui flex items-center justify-between text-xs text-text-tertiary">
          <span id="asistencia-page-info">Mostrando 0 de 0 registros</span>
          <div class="flex items-center gap-2">
            <button id="btn-asistencia-prev" onclick="changeAsistenciaPage(-1)" class="h-8 px-3 rounded-lg border border-border-ui bg-bg-card text-text-secondary hover:bg-border-ui dark:hover:bg-border-ui/50 hover:text-text-primary dark:hover:text-text-primary disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold shadow-2xs transition-colors cursor-pointer active:scale-95">Anterior</button>
            <button id="btn-asistencia-next" onclick="changeAsistenciaPage(1)" class="h-8 px-3 rounded-lg border border-border-ui bg-bg-card text-text-secondary hover:bg-border-ui dark:hover:bg-border-ui/50 hover:text-text-primary dark:hover:text-text-primary disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold shadow-2xs transition-colors cursor-pointer active:scale-95">Siguiente</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

// Sub-vista: Directorio de Contactos
function renderAsistenciaContactosViewHtml() {
  return `
    <div class="space-y-4">
      <!-- BARRA SUPERIOR DE CONTACTOS -->
      <div class="glass-card p-3.5 rounded-2xl border border-border-ui bg-bg-header shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div class="relative flex-1 max-w-md">
          <i data-lucide="search" class="absolute left-3 top-2.5 h-3.5 w-3.5 text-text-tertiary"></i>
          <input type="text" id="filter-contactos-search" oninput="handleContactosFilterChange()" placeholder="Buscar por nombre, dirección o correo..."
            class="w-full pl-8.5 pr-3 py-1.5 bg-bg-card border border-border-ui rounded-xl text-xs text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-colors font-medium">
        </div>

        <div class="flex items-center gap-2 justify-end">
          <button onclick="openModalNuevoContacto()" class="px-3.5 py-1.5 bg-brand-600 hover:bg-brand-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-xs cursor-pointer">
            <i data-lucide="user-plus" class="h-3.5 w-3.5"></i>
            <span>Nuevo Contacto</span>
          </button>
          <button onclick="openModalMergeContactos()" class="px-3.5 py-1.5 bg-purple-50 hover:bg-purple-100 dark:bg-purple-600/15 dark:hover:bg-purple-600/25 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-500/30 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer" title="Unificar contactos duplicados">
            <i data-lucide="git-merge" class="h-3.5 w-3.5"></i>
            <span>Unificar Duplicados</span>
          </button>
        </div>
      </div>

      <!-- TABLA DEL DIRECTORIO -->
      <div class="glass-card rounded-2xl overflow-hidden border border-border-ui bg-bg-header shadow-xs">
        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs border-collapse">
            <thead>
              <tr class="border-b border-border-ui bg-bg-main text-[10px] font-bold text-text-tertiary uppercase tracking-wider">
                <th class="px-4 py-3">Funcionario / Solicitante</th>
                <th class="px-4 py-3">Dirección Habitual</th>
                <th class="px-4 py-3">Correo Institucional</th>
                <th class="px-4 py-3">Anexo / Contacto</th>
                <th class="px-3 py-3 text-center w-28">Atenciones</th>
                <th class="px-4 py-3 text-right w-28">Acciones</th>
              </tr>
            </thead>
            <tbody id="tabla-contactos-body" class="divide-y divide-border-ui divide-border-ui">
              <tr>
                <td colspan="6" class="text-center py-8 text-text-tertiary">
                  <i data-lucide="loader-2" class="h-5 w-5 animate-spin mx-auto mb-2 text-brand-500"></i>
                  Cargando directorio de contactos...
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

// Sub-vista: Materias y Categorías de Asistencia
function renderAsistenciaCategoriasViewHtml() {
  return `
    <div class="space-y-4">
      <!-- BARRA SUPERIOR DE CATEGORÍAS -->
      <div class="glass-card p-3.5 rounded-2xl border border-border-ui bg-bg-header shadow-xs flex items-center justify-between gap-3">
        <div>
          <h3 class="text-xs font-bold text-text-primary uppercase tracking-wider flex items-center gap-2">
            <i data-lucide="tags" class="h-4 w-4 text-brand-500"></i>
            <span>Materias / Categorías de Asistencia Técnica</span>
          </h3>
          <p class="text-[10px] text-text-tertiary mt-0.5">
            Configura las materias que aparecen en los desplegables de registro y en las estadísticas de atención.
          </p>
        </div>

        <button onclick="openModalNuevaCategoria()" class="px-3.5 py-1.5 bg-brand-600 hover:bg-brand-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-xs cursor-pointer shrink-0">
          <i data-lucide="plus" class="h-3.5 w-3.5"></i>
          <span>Nueva Materia</span>
        </button>
      </div>

      <!-- TABLA DE CATEGORÍAS -->
      <div class="glass-card rounded-2xl overflow-hidden border border-border-ui bg-bg-header shadow-xs">
        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs border-collapse">
            <thead>
              <tr class="border-b border-border-ui bg-bg-main text-[10px] font-bold text-text-tertiary uppercase tracking-wider">
                <th class="px-4 py-3 w-16">#</th>
                <th class="px-4 py-3 w-72">Nombre de la Materia</th>
                <th class="px-4 py-3">Descripción / Alcance</th>
                <th class="px-4 py-3 text-right w-28">Acciones</th>
              </tr>
            </thead>
            <tbody id="tabla-categorias-body" class="divide-y divide-border-ui divide-border-ui">
              <tr>
                <td colspan="4" class="text-center py-8 text-text-tertiary">
                  <i data-lucide="loader-2" class="h-5 w-5 animate-spin mx-auto mb-2 text-brand-500"></i>
                  Cargando materias y categorías...
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

// RENDER: PESTAÑA BITÁCORA DE LOGS
function renderLogsTabHtml() {
  const currentFilter = (typeof paginationState !== 'undefined' && paginationState.logs) ? paginationState.logs.filterType : 'all';
  
  const getPillClass = (type, activeType) => {
    if (type === activeType) {
      if (type === 'all') return 'bg-border-ui  text-[var(--text-primary)] font-bold';
      if (type === 'error') return 'bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-500 font-bold';
      if (type === 'warn') return 'bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 font-bold';
      if (type === 'auth') return 'bg-sky-500/10 border border-sky-500/30 text-sky-600 dark:text-sky-400 shadow-sm font-bold';
      if (type === 'info') return 'bg-border-ui/40 border border-border-ui text-text-secondary  font-bold';
    }
    // Inactivos
    if (type === 'error') return 'border border-transparent text-text-tertiary  hover:text-rose-500 hover:bg-rose-500/5 dark:hover:bg-rose-500/10';
    if (type === 'warn') return 'border border-transparent text-text-tertiary  hover:text-amber-500 hover:bg-amber-500/5 dark:hover:bg-amber-500/10';
    if (type === 'auth') return 'border border-transparent text-text-tertiary  hover:text-sky-500 hover:bg-sky-500/5 dark:hover:bg-sky-500/10';
    return 'border border-transparent text-text-tertiary  hover:text-[var(--text-primary)] hover:bg-border-ui/50';
  };

  return `
    <div class="space-y-4 animate-fade-in font-sans">
      <div class="pb-4 flex flex-col xl:flex-row xl:items-center justify-between gap-4 border-b border-border-ui">
        <div class="flex items-center gap-3">
          <div class="h-9 w-9 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center shrink-0">
            <i data-lucide="file-text" class="h-4.5 w-4.5"></i>
          </div>
          <div>
            <h3 class="text-xs font-bold uppercase tracking-wider text-heading font-sans">Bitácora de Logs</h3>
            <p class="text-[10px] text-text-tertiary mt-0.5 font-medium">
              Últimos eventos registrados • Clic en una fila para ver detalles
            </p>
          </div>
        </div>
        
        <!-- Filtro Segmentado Premium y Acciones -->
        <div class="flex items-center gap-3.5 flex-wrap">
          <!-- Selector de Tipo de Registro (Segmentado Estilo Alertas) -->
          <div class="flex items-center gap-1.5 pb-2.5 lg:pb-0 overflow-x-auto whitespace-nowrap scrollbar-none">
            <span class="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider mr-1 select-none">Filtro:</span>
            <button onclick="filterLogsByType('all')" class="px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${getPillClass('all', currentFilter)}">
              Todos
            </button>
            <button onclick="filterLogsByType('error')" class="px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${getPillClass('error', currentFilter)}">
              <span class="h-1.5 w-1.5 rounded-full bg-rose-500 shrink-0"></span>
              Crítico
            </button>
            <button onclick="filterLogsByType('warn')" class="px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${getPillClass('warn', currentFilter)}">
              <span class="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0"></span>
              Advertencia
            </button>
            <button onclick="filterLogsByType('auth')" class="px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${getPillClass('auth', currentFilter)}">
              <span class="h-1.5 w-1.5 rounded-full bg-sky-500 shrink-0"></span>
              Auth
            </button>
            <button onclick="filterLogsByType('info')" class="px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${getPillClass('info', currentFilter)}">
              <span class="h-1.5 w-1.5 rounded-full bg-border-ui shrink-0"></span>
              Info
            </button>
          </div>

          <div class="flex items-center gap-2">
            <span id="logs-count-badge" class="inline-flex items-center justify-center min-w-[24px] h-6 px-2 rounded-full bg-border-ui border border-border-ui text-[10px] font-bold text-text-secondary tabular-nums">—</span>
            
            <button onclick="refreshAdminLogs(true)" class="px-3 py-1.5 bg-border-ui hover:bg-border-ui dark:hover:bg-border-ui/50 text-text-secondary rounded-lg text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1.5 active:scale-[0.95] border border-border-ui">
              <i data-lucide="refresh-cw" class="h-3 w-3"></i> Actualizar
            </button>
          </div>
        </div>
      </div>

      <!-- Tabla de logs -->
      <div class="overflow-x-auto rounded-xl border border-border-ui mt-2">
        <table class="w-full text-left">
          <thead>
            <tr class="bg-bg-main border-b border-border-ui">
              <th class="py-2.5 px-3 text-[9px] font-bold text-text-tertiary uppercase tracking-widest w-[140px]">Fecha / Hora</th>
              <th class="py-2.5 px-3 text-[9px] font-bold text-text-tertiary uppercase tracking-widest w-[120px]">Código</th>
              <th class="py-2.5 px-3 text-[9px] font-bold text-text-tertiary uppercase tracking-widest">Mensaje</th>
              <th class="py-2.5 px-3 text-[9px] font-bold text-text-secondary uppercase tracking-widest w-[80px]"></th>
            </tr>
          </thead>
          <tbody id="logs-table-body">
            <tr><td colspan="4" class="text-center py-8 text-text-tertiary text-xs font-semibold">Cargando registros...</td></tr>
          </tbody>
        </table>
      </div>

      <!-- Paginación -->
      <div id="logs-pagination-container" class="mt-4"></div>
    </div>
  `;
}

// RENDER: VISTA REPORTES ANALÍTICOS AVANZADOS
function renderReportes(container) {
  const processedData = processReportData(
    dataStore.reportesRawData,
    reportesFilters,
  );
  const totalItems = processedData.length;
  const currentPage = paginationState.reportes.page;
  const pageSize = 10;
  const paginatedItems = processedData.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  const isNombreEmpty =
    !reportesFilters.nombre || reportesFilters.nombre === "";
  const cargoPlaceholder = isNombreEmpty
    ? "Seleccione nombre primero..."
    : "Escribir cargo...";

  let rowsHtml = "";
  if (paginatedItems.length === 0) {
    const hasAnyFilter =
      (reportesFilters.nombre && reportesFilters.nombre !== "") ||
      (reportesFilters.cargo && reportesFilters.cargo !== "") ||
      reportesFilters.fechaInicio ||
      reportesFilters.fechaTermino ||
      (reportesFilters.estados && reportesFilters.estados.length > 0);
    const msg = hasAnyFilter
      ? "No hay registros que coincidan con los filtros aplicados."
      : 'Por favor, ingrese un Sujeto Pasivo (o seleccione "Todos") u otros filtros para generar el reporte.';
    rowsHtml = `<tr><td colspan="7" class="px-6 py-8 text-center text-xs text-text-tertiary font-semibold">${msg}</td></tr>`;
  } else {
    paginatedItems.forEach((item) => {
      rowsHtml += `
        <tr class="hover:bg-border-ui dark:hover:bg-border-ui border-b border-border-ui transition-colors h-[56px]">
          <td class="pl-6 pr-2 text-xs font-semibold text-text-tertiary text-left w-12">${item.index}</td>
          <td class="px-2 text-xs font-semibold text-text-secondary text-left w-36">${escapeHtml(item.folio)}</td>
          <td class="px-2 text-xs text-text-secondary text-left" title="${escapeHtmlAttr(item.cargoCompleto)}">
            <div class="font-medium text-text-secondary truncate max-w-xs">${escapeHtml(item.cargoCompleto)}</div>
          </td>
          <td class="px-2 text-xs text-left w-32">
            <div class="font-medium text-text-secondary">${item.fechaIngreso}</div>
            ${item.fechaLimiteRespuesta ? `<div class="text-[10px] text-text-tertiary mt-0.5" title="Plazo Legal Límite de Respuesta">${item.fechaLimiteRespuesta}</div>` : ""}
          </td>
          <td class="px-2 text-xs text-left w-32">
            <div class="font-medium text-text-secondary">${item.fechaAgendada}</div>
            ${item.fechaLimitePublicacion ? `<div class="text-[10px] text-text-tertiary mt-0.5" title="Plazo Límite de Publicación">${item.fechaLimitePublicacion}</div>` : ""}
          </td>
          <td class="px-2 text-xs text-left w-44">
            ${
              item.badgeText === "Pendiente de publicación"
                ? `<span class="px-2 py-1 rounded text-[10px] font-bold ${item.badgeClass} inline-block text-center leading-tight">Pendiente de<br>publicación</span>`
                : `<span class="px-2 py-0.5 rounded text-[10px] font-bold ${item.badgeClass} whitespace-nowrap">${escapeHtml(item.badgeText)}</span>`
            }
          </td>
          <td class="pl-2 pr-6 text-xs text-left w-28">
            ${(() => {
              const plazoStr = item.plazo || "";
              const hasDays =
                plazoStr.includes("(") && plazoStr.includes(")");
              let mainCode = plazoStr || "—";
              let subtextHtml = "";

              if (hasDays) {
                const parts = plazoStr.split(" ");
                mainCode = parts[0] || "—";
                const days = (parts[1] || "").replace(/[()]/g, "");
                if (mainCode === "FDP" || mainCode === "RFP") {
                  subtextHtml = `<div class="text-[9px] font-bold mt-0.5 leading-none opacity-90">${days}</div>`;
                }
              }

              const isOverdue =
                mainCode === "FDP" ||
                mainCode === "RFP" ||
                plazoStr.includes("-");
              const badgeClass = isOverdue
                ? "badge-status-vencido"
                : "badge-status-enplazo";

              if (subtextHtml) {
                return `
                  <div class="px-2 py-1 rounded text-[10px] font-semibold flex flex-col items-center justify-center text-center w-12 ${badgeClass}">
                    <div>${mainCode}</div>
                    ${subtextHtml}
                  </div>
                `;
              }

              return `
                <div class="px-2 py-1 rounded text-[10px] font-semibold flex flex-col items-center justify-center text-center w-12 ${badgeClass}">
                  ${mainCode}
                </div>
              `;
            })()}
          </td>
        </tr>
      `;
    });
  }

  const existingReportes = container.querySelector("#reportes-view-container");
  if (existingReportes) {
    // 1. Actualizar cuerpo de la tabla
    const tbody = existingReportes.querySelector("#table-reportes tbody");
    if (tbody) tbody.innerHTML = rowsHtml;
    
    // 2. Actualizar contador
    const counterEl = existingReportes.querySelector("#reportes-counter");
    if (counterEl) counterEl.textContent = `${totalItems} registros coincidentes encontrados`;
    
    // 3. Actualizar paginación
    const pagEl = existingReportes.querySelector("#reportes-pagination-container");
    if (pagEl) {
      pagEl.innerHTML = renderPaginationControls(
        "reportes",
        totalItems,
        currentPage,
        pageSize,
      );
    }

    // 4. Actualizar botones de exportación
    const exportBtnContainer = existingReportes.querySelector("#reportes-export-btn-container");
    if (exportBtnContainer) {
      exportBtnContainer.className = "flex items-center gap-2.5 flex-wrap";
      exportBtnContainer.innerHTML = `
        <button onclick="abrirModalConfigurarCorrelativo()" title="Configurar o reiniciar correlativo de reportes RAP" class="px-2.5 py-1.5 bg-border-ui hover:bg-border-ui dark:hover:bg-border-ui/50 text-text-secondary border border-border-ui rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer group">
          <i data-lucide="hash" class="h-3.5 w-3.5 text-brand-600 dark:text-brand-400"></i>
          <span class="text-[10px] uppercase font-bold text-text-tertiary">Próximo Folio:</span>
          <span id="badge-proximo-correlativo" class="font-mono font-extrabold text-brand-600 dark:text-brand-400 text-xs">...</span>
          <i data-lucide="settings-2" class="h-3 w-3 text-text-tertiary group-hover:text-text-primary dark:group-hover:text-text-primary transition-colors ml-0.5"></i>
        </button>

        <button onclick="generarReportesMasivos()" class="px-2.5 py-1.5 bg-border-ui hover:bg-border-ui dark:hover:bg-border-ui/50 text-text-secondary border border-border-ui rounded-xl text-[10px] font-bold flex items-center gap-1 transition-all shadow-sm cursor-pointer">
          <i data-lucide="files" class="h-3.5 w-3.5"></i>
          Generación Masiva
        </button>
        
        <div class="h-4 w-[1px] bg-border-ui mx-1"></div>

        <button onclick="exportReportToExcel()" class="px-3 py-1.5 bg-border-ui hover:bg-border-ui dark:hover:bg-border-ui/50 text-text-secondary border border-border-ui rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm ${totalItems > 0 ? 'cursor-pointer' : 'opacity-40 cursor-not-allowed'}" title="${totalItems > 0 ? 'Exportar datos a planilla Excel (.xlsx)' : 'No hay registros coincidentes para exportar'}">
          <i data-lucide="sheet" class="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400"></i>
          Exportar a Excel
        </button>

        <button onclick="exportReporteEjecutivoPDF()" class="px-3 py-1.5 bg-border-ui hover:bg-border-ui dark:hover:bg-border-ui/50 text-text-secondary border border-border-ui rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm ${totalItems > 0 ? 'cursor-pointer' : 'opacity-40 cursor-not-allowed'}" title="${totalItems > 0 ? 'Generar Reporte Consolidado de Solicitudes y Audiencias' : 'No hay registros coincidentes para exportar'}">
          <i data-lucide="bar-chart-3" class="h-3.5 w-3.5 text-blue-600 dark:text-blue-400"></i>
          Reporte Consolidado PDF
        </button>

        <button onclick="exportReportToPDF()" class="px-3 py-1.5 bg-brand-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm ${totalItems > 0 ? 'cursor-pointer hover:bg-brand-500' : 'opacity-40 cursor-not-allowed'}" title="${totalItems > 0 ? 'Exportar documento PDF individual' : 'No hay registros coincidentes para exportar'}">
          <i data-lucide="file-down" class="h-3.5 w-3.5"></i>
          Exportar PDF
        </button>`;
    }
    if (window.actualizarBadgeCorrelativo) {
      window.actualizarBadgeCorrelativo();
    }
    lucide.createIcons();
    return true;
  }

  container.innerHTML = `
    <div class="space-y-4" id="reportes-view-container">
      <div class="space-y-1">
        <h2 class="text-2xl font-bold text-heading tracking-tight">Reportes</h2>
      </div>

      <!-- PANEL FILTROS AVANZADOS -->
      ${renderGlassCard(
        `
        <div class="flex flex-wrap items-center justify-between border-b border-border-ui pb-3 gap-2">
          <div class="flex items-center gap-3 flex-wrap">
            <h3 class="text-xs font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400 flex items-center gap-2">
              <i data-lucide="sliders-horizontal" class="h-3.5 w-3.5"></i>
              Filtros
            </h3>
            ${renderVigenciaSelect({
              id: "reportes-filter-vigencia",
              value: reportesFilters.vigencia,
              onChange: "changeReportesVigencia",
            })}
          </div>
          <button id="btn-reportes-clear" class="text-[10px] text-text-tertiary hover:text-text-primary transition-colors flex items-center gap-1 bg-transparent border-none cursor-pointer">
            <i data-lucide="rotate-ccw" class="h-3 w-3"></i> Limpiar Filtros
          </button>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <!-- NOMBRE -->
          ${renderSearchInput({
            id: "report-filter-nombre",
            fieldName: "nombre",
            label: "Nombre Sujeto Pasivo",
            placeholder: "Vigentes o escribir nombre...",
            value: reportesFilters.nombre,
            hasSuggestions: true,
          })}

          <!-- CARGO -->
          ${renderSearchInput({
            id: "report-filter-cargo",
            fieldName: "cargo",
            label: "Cargo",
            placeholder: cargoPlaceholder,
            value: reportesFilters.cargo,
            disabled: isNombreEmpty,
            hasSuggestions: true,
          })}

          <!-- FECHA INICIO -->
          ${renderDateInput({
            id: "report-filter-fechainicio",
            fieldName: "fechaInicio",
            label: "Fecha Inicio",
            value: reportesFilters.fechaInicio,
          })}

          <!-- FECHA TERMINO -->
          ${renderDateInput({
            id: "report-filter-fechatermino",
            fieldName: "fechaTermino",
            label: "Fecha Término",
            value: reportesFilters.fechaTermino,
          })}
        </div>

        <!-- FILTRO ESTADOS MULTIPLE -->
        <div class="space-y-2">
          <label class="text-[10px] font-bold text-text-tertiary uppercase tracking-wider block">Estados de Solicitud (Selección Múltiple)</label>
          <div class="flex flex-wrap gap-2.5">
            ${[
              "Ingresada",
              "Aceptada",
              "Rechazada",
              "Suspendida",
              "Cancelada",
              "Encomendada",
              "Pendiente de publicación",
            ]
              .map((est) => {
                const checked = reportesFilters.estados.includes(est);
                return `
                <label class="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-border-ui bg-border-ui text-xs font-semibold cursor-pointer select-none transition-all hover:bg-border-ui dark:hover:bg-border-ui/50 ${checked ?"border-brand-500 bg-blue-500/10 text-blue-600 dark:text-blue-400 shadow-sm shadow-brand-500/20" : "text-text-tertiary "}">
                  <input type="checkbox" class="sr-only report-estado-checkbox" data-estado="${est}" ${checked ? "checked" : ""}>
                  <span>${est}</span>
                </label>
              `;
              })
              .join("")}
          </div>
        </div>
      `,
        "rounded-2xl p-5 space-y-4 relative z-20",
      )}

      <!-- TABLA DE REPORTES -->
      <div class="rounded-2xl overflow-hidden mt-4 border border-border-ui glass-card">
        <div class="p-4 border-b border-border-ui flex justify-between items-center">
          <div class="text-xs text-text-secondary font-semibold" id="reportes-counter">${totalItems} registros coincidentes encontrados</div>
          <div id="reportes-export-btn-container" class="flex items-center gap-2.5 flex-wrap">
        <button onclick="abrirModalConfigurarCorrelativo()" title="Configurar o reiniciar correlativo de reportes RAP" class="px-2.5 py-1.5 bg-border-ui hover:bg-border-ui dark:hover:bg-border-ui/50 text-text-secondary border border-border-ui rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer group">
          <i data-lucide="hash" class="h-3.5 w-3.5 text-brand-600 dark:text-brand-400"></i>
          <span class="text-[10px] uppercase font-bold text-text-tertiary">Próximo Folio:</span>
          <span id="badge-proximo-correlativo" class="font-mono font-extrabold text-brand-600 dark:text-brand-400 text-xs">...</span>
          <i data-lucide="settings-2" class="h-3 w-3 text-text-tertiary group-hover:text-text-primary dark:group-hover:text-text-primary transition-colors ml-0.5"></i>
        </button>

        <button onclick="generarReportesMasivos()" class="px-2.5 py-1.5 bg-border-ui hover:bg-border-ui dark:hover:bg-border-ui/50 text-text-secondary border border-border-ui rounded-xl text-[10px] font-bold flex items-center gap-1 transition-all shadow-sm cursor-pointer">
          <i data-lucide="files" class="h-3.5 w-3.5"></i>
          Generación Masiva
        </button>
        
        <div class="h-4 w-[1px] bg-border-ui mx-1"></div>

        <button onclick="exportReportToExcel()" class="px-3 py-1.5 bg-border-ui hover:bg-border-ui dark:hover:bg-border-ui/50 text-text-secondary border border-border-ui rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm ${totalItems > 0 ? 'cursor-pointer' : 'opacity-40 cursor-not-allowed'}" title="${totalItems > 0 ? 'Exportar datos a planilla Excel (.xlsx)' : 'No hay registros coincidentes para exportar'}">
          <i data-lucide="sheet" class="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400"></i>
          Exportar a Excel
        </button>

        <button onclick="exportReporteEjecutivoPDF()" class="px-3 py-1.5 bg-border-ui hover:bg-border-ui dark:hover:bg-border-ui/50 text-text-secondary border border-border-ui rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm ${totalItems > 0 ? 'cursor-pointer' : 'opacity-40 cursor-not-allowed'}" title="${totalItems > 0 ? 'Generar Reporte Consolidado de Solicitudes y Audiencias' : 'No hay registros coincidentes para exportar'}">
          <i data-lucide="bar-chart-3" class="h-3.5 w-3.5 text-blue-600 dark:text-blue-400"></i>
          Reporte Consolidado PDF
        </button>

        <button onclick="exportReportToPDF()" class="px-3 py-1.5 bg-brand-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm ${totalItems > 0 ? 'cursor-pointer hover:bg-brand-500' : 'opacity-40 cursor-not-allowed'}" title="${totalItems > 0 ? 'Exportar documento PDF individual' : 'No hay registros coincidentes para exportar'}">
          <i data-lucide="file-down" class="h-3.5 w-3.5"></i>
          Exportar PDF
        </button>
          </div>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse table-fixed" id="table-reportes">
            <thead>
              <tr class="bg-border-ui/50 border-b border-border-ui text-text-tertiary text-[10px] uppercase font-bold tracking-widest">
                <th class="pl-6 pr-2 py-3 w-12 text-left">#</th>
                <th class="px-2 py-3 w-36 text-left">Folio</th>
                <th class="px-2 py-3 text-left">Sujeto Pasivo y Cargo</th>
                <th class="px-2 py-3 w-36 text-left">
                  <div>Fecha Ingreso</div>
                  <div class="text-[9px] font-medium text-text-secondary mt-0.5 normal-case tracking-normal">Plazo Respuesta</div>
                </th>
                <th class="px-2 py-3 w-36 text-left">
                  <div>Fecha Agenda</div>
                  <div class="text-[9px] font-medium text-text-secondary mt-0.5 normal-case tracking-normal">Plazo Publicación</div>
                </th>
                <th class="px-2 py-3 w-44 text-left">Estado</th>
                <th class="pl-2 pr-6 py-3 w-28 text-left">Plazo / Retraso</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        </div>
        <div id="reportes-pagination-container">
          ${renderPaginationControls("reportes", totalItems, currentPage, pageSize)}
        </div>
      </div>
    </div>
  `;
}

/**
 * RENDER: VISTA DE INICIO DE SESIÓN
 * Presenta una pantalla de autenticación premium integrada en la SPA.
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
        <!-- Botón de Modo Claro/Oscuro en Login -->
        <button id="login-theme-toggle" onclick="toggleTheme()" class="absolute top-4 right-4 h-8 w-8 rounded-xl flex items-center justify-center border border-border-ui hover:border-border-ui bg-bg-main text-text-secondary hover:text-text-primary transition-all duration-200" title="Cambiar de Modo">
          <i data-lucide="sun" class="h-4 w-4"></i>
        </button>

        <!-- Decoración de fondo premium -->
        <div class="absolute -top-10 -left-10 w-40 h-40 bg-brand-600/10 rounded-full blur-3xl pointer-events-none"></div>
        <div class="absolute -bottom-10 -right-10 w-40 h-40 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <!-- Encabezado / Logo -->
        <div class="flex flex-col items-center text-center space-y-3 relative z-10">
          <img src="/logo_secum.png" alt="Secretaría Municipal Maipú" class="h-20 w-auto object-contain mb-2">
          <div>
            <h1 class="text-2xl font-extrabold text-text-primary tracking-tight">LobbyControl</h1>
            <p class="text-xs text-body-muted mt-1 font-medium">Gestión de Audiencias - Ley N° 20.730</p>
          </div>
        </div>

        <!-- Mensaje de Error (Oculto por defecto) -->
        <div id="login-error" class="hidden px-4 py-3 rounded-xl bg-rose-950/40 border border-rose-900/60 text-rose-300 text-xs font-semibold flex items-center gap-2">
          <i data-lucide="alert-circle" class="h-4 w-4 shrink-0"></i>
          <span id="login-error-text">Credenciales inválidas. Inténtelo de nuevo.</span>
        </div>

        <!-- Opción Microsoft SSO (Solo en Electron) -->
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

        <!-- Pie de página de login -->
        <div class="text-center text-[10px] text-body-muted pt-2 relative z-10 border-t border-border-ui">
          <p>LobbyControl - Gestión de Audiencias</p>
        </div>
      </div>
    </div>
  `;

  // Inicializar íconos de Lucide tras inyectar el HTML
  if (typeof lucide !== "undefined") {
    lucide.createIcons();
  }
}

// =========================================================================
// INSPECTOR DE BASE DE DATOS - ESTADO Y COMPONENTE VISUAL
// =========================================================================

let inspectorState = {
  tables: {},
  selectedDb: "lobby_control.db",
  selectedTable: "solicitudes_sh",
  page: 1,
  limit: 10,
  search: "",
  columns: [],
  rows: [],
  total: 0,
  loading: false,
};

async function initDatabaseInspector() {
  const hasTables = inspectorState.tables && Object.keys(inspectorState.tables).length > 0;
  if (!hasTables) {
    try {
      const res = await fetch("/api/admin/inspector/tables");
      if (res.ok) {
        inspectorState.tables = await res.json();
        
        // Buscar si solicitudes_sh existe en lobby_control.db
        if (inspectorState.tables["lobby_control.db"] && inspectorState.tables["lobby_control.db"].includes("solicitudes_sh")) {
          inspectorState.selectedDb = "lobby_control.db";
          inspectorState.selectedTable = "solicitudes_sh";
        } else {
          const dbs = Object.keys(inspectorState.tables);
          if (dbs.length > 0) {
            inspectorState.selectedDb = dbs[0];
            const tablesList = inspectorState.tables[dbs[0]] || [];
            if (tablesList.length > 0) {
              inspectorState.selectedTable = tablesList[0];
            }
          }
        }
      }
    } catch (e) {
      console.error("Error al inicializar tablas del inspector:", e);
    }
  }
  await fetchInspectorData();
}

async function fetchInspectorData() {
  if (!inspectorState.selectedTable) return;
  inspectorState.loading = true;
  updateInspectorUI();

  try {
    const params = new URLSearchParams({
      table: inspectorState.selectedTable,
      page: inspectorState.page,
      limit: inspectorState.limit,
      search: inspectorState.search,
    });
    const res = await fetch(`/api/admin/inspector/data?${params.toString()}`);
    if (res.ok) {
      const result = await res.json();
      inspectorState.columns = result.columns;
      inspectorState.rows = result.rows;
      inspectorState.total = result.total;
    } else {
      showToast("Error al obtener datos de la tabla.", "error");
    }
  } catch (e) {
    console.error("Error al obtener datos de la tabla:", e);
    showToast("Error al conectar con el inspector.", "error");
  } finally {
    inspectorState.loading = false;
    updateInspectorUI();
  }
}

function renderDatabaseInspectorHtml() {
  // Disparar la inicialización en diferido
  const hasTables = inspectorState.tables && Object.keys(inspectorState.tables).length > 0;
  if (!hasTables) {
    setTimeout(initDatabaseInspector, 0);
  }

  return `
    <div class="space-y-6 mt-6 animate-fade-in" id="database-inspector-root">
      ${renderDatabaseInspectorContent()}
    </div>
  `;
}

function updateInspectorUI() {
  const root = document.getElementById("database-inspector-root");
  if (root) {
    root.innerHTML = renderDatabaseInspectorContent();
    if (window.lucide && typeof window.lucide.createIcons === "function") {
      window.lucide.createIcons();
    }
  }
}

function renderDatabaseInspectorContent() {
  if (inspectorState.loading && inspectorState.columns.length === 0) {
    return `
      <div class="h-64 flex flex-col items-center justify-center gap-4 animate-fade-in">
        <div class="w-12 h-12 border-4 border-border-ui border-brand-500 rounded-full animate-spin"></div>
        <p class="text-sm text-text-secondary font-medium">Consultando tabla...</p>
      </div>
    `;
  }

  // Selector de Bases de Datos
  let dbOptions = "";
  for (const dbName in inspectorState.tables) {
    dbOptions += `<option value="${dbName}" ${inspectorState.selectedDb === dbName ? "selected" : ""}>${dbName}</option>`;
  }

  // Selector de Tablas (solo para la base de datos seleccionada)
  let tableOptions = "";
  const currentTables = inspectorState.tables[inspectorState.selectedDb] || [];
  currentTables.forEach((t) => {
    tableOptions += `<option value="${t}" ${inspectorState.selectedTable === t ? "selected" : ""}>${t}</option>`;
  });

  // Columnas y cabeceras
  let headersHtml = "";
  let colCount = inspectorState.columns.length || 1;
  if (inspectorState.columns.length > 0) {
    headersHtml = inspectorState.columns
      .map(
        (col) =>
          `<th class="px-3 py-3 text-left font-bold text-[10px] text-text-tertiary uppercase tracking-wider font-mono select-none whitespace-nowrap" title="${col.type} ${col.notnull ? "NOT NULL" : ""}">${escapeHtml(col.name)}</th>`,
      )
      .join("");
  } else {
    headersHtml = `<th class="px-6 py-3 text-left font-bold text-[10px] text-text-tertiary uppercase tracking-wider">Columnas</th>`;
  }

  // Filas de datos
  let rowsHtml = "";
  if (inspectorState.rows.length === 0) {
    rowsHtml = `<tr><td colspan="${colCount}" class="px-6 py-8 text-center text-xs text-text-tertiary">La tabla está vacía o no tiene registros que coincidan con la búsqueda.</td></tr>`;
  } else {
    inspectorState.rows.forEach((row) => {
      rowsHtml += `<tr class="hover:bg-border-ui dark:hover:bg-border-ui/50 border-b border-border-ui transition-colors">`;
      inspectorState.columns.forEach((col) => {
        let val = row[col.name];
        let valStr = "";
        if (val === null || val === undefined) {
          valStr = `<span class="text-text-tertiary font-mono italic text-[10px]">NULL</span>`;
        } else if (typeof val === "object") {
          valStr = `<span class="text-text-secondary font-mono text-[11px]">${escapeHtml(JSON.stringify(val))}</span>`;
        } else {
          valStr = `<span class="text-text-primary text-xs">${escapeHtml(String(val))}</span>`;
        }
        rowsHtml += `<td class="px-3 py-2.5 max-w-xs truncate font-medium align-middle" title="${escapeHtmlAttr(String(val || ""))}">${valStr}</td>`;
      });
      rowsHtml += `</tr>`;
    });
  }

  // Generar botones de paginación del inspector
  const totalPages = Math.ceil(inspectorState.total / inspectorState.limit);
  const startItem =
    inspectorState.total === 0
      ? 0
      : (inspectorState.page - 1) * inspectorState.limit + 1;
  const endItem = Math.min(
    inspectorState.page * inspectorState.limit,
    inspectorState.total,
  );

  let pagesHtml = "";
  if (totalPages > 1) {
    const prevDisabled = inspectorState.page === 1;
    const nextDisabled = inspectorState.page === totalPages;

    pagesHtml += `
      <div class="flex items-center gap-1.5 font-sans">
        <button onclick="${prevDisabled ? "" : "changeInspectorPage(" + (inspectorState.page - 1) + ")"}" 
                class="h-8 w-8 rounded-lg flex items-center justify-center border border-border-ui bg-bg-card text-text-secondary hover:text-text-primary transition-all ${prevDisabled ?"opacity-40 cursor-not-allowed" : "hover:bg-border-ui dark:hover:bg-border-ui/50 cursor-pointer"}">
          <i data-lucide="chevron-left" class="h-4 w-4"></i>
        </button>
        <span class="text-xs text-text-secondary px-2.5 font-semibold font-sans">Página ${inspectorState.page} de ${totalPages}</span>
        <button onclick="${nextDisabled ? "" : "changeInspectorPage(" + (inspectorState.page + 1) + ")"}" 
                class="h-8 w-8 rounded-lg flex items-center justify-center border border-border-ui bg-bg-card text-text-secondary hover:text-text-primary transition-all ${nextDisabled ?"opacity-40 cursor-not-allowed" : "hover:bg-border-ui dark:hover:bg-border-ui/50 cursor-pointer"}">
          <i data-lucide="chevron-right" class="h-4 w-4"></i>
        </button>
      </div>
    `;
  }

  const paginationControlsHtml = `
    <div class="p-4 border-t border-border-ui flex flex-col sm:flex-row items-center justify-between gap-4 bg-bg-main">
      <div class="text-xs text-text-secondary font-medium">
        Mostrando <span class="text-text-primary font-bold">${startItem}</span> a <span class="text-text-primary font-bold">${endItem}</span> de <span class="text-text-primary font-bold">${inspectorState.total}</span> registros
      </div>
      ${pagesHtml}
    </div>
  `;

  return `
    <div class="flex flex-col md:flex-row gap-4 items-center justify-between relative z-30">
      <div class="flex flex-col sm:flex-row gap-3 items-center w-full md:w-auto">
        
        <!-- CUSTOM DROPDOWN: BASE DE DATOS -->
        <div class="relative w-full sm:w-auto" id="dropdown-inspector-db-container">
          <div class="flex items-center gap-2">
            <span class="text-xs font-bold text-text-tertiary uppercase tracking-wider shrink-0 flex items-center gap-1.5">
              <i data-lucide="database" class="h-3.5 w-3.5 text-brand-500"></i>
              <span>Base:</span>
            </span>
            <button type="button" onclick="toggleInspectorDbDropdown(event)" class="w-full sm:w-52 px-3 py-2 rounded-xl text-xs bg-bg-card hover:bg-border-ui dark:hover:bg-border-ui border border-border-ui hover:border-border-ui dark:hover:border-border-ui font-bold text-text-primary flex items-center justify-between gap-2 shadow-xs transition-all cursor-pointer">
              <span class="truncate font-mono">${inspectorState.selectedDb}</span>
              <i data-lucide="chevron-down" class="h-3.5 w-3.5 text-text-tertiary transition-transform ${inspectorState.isDbDropdownOpen ? 'rotate-180 text-brand-500' : ''}"></i>
            </button>
          </div>

          ${inspectorState.isDbDropdownOpen ? `
          <div class="absolute left-0 sm:left-14 top-full mt-1.5 w-full sm:w-60 bg-bg-header border border-border-ui rounded-xl shadow-2xl backdrop-blur-xl p-1.5 z-50 animate-fade-in divide-y divide-border-ui divide-border-ui">
            <div class="p-1 space-y-1">
              ${Object.keys(inspectorState.tables).map(dbName => {
                const isSelected = inspectorState.selectedDb === dbName;
                let badge = 'Compartida';
                let iconColor = 'text-brand-500';
                if (dbName === 'asistencias.db') { badge = 'Asistencias'; iconColor = 'text-emerald-500'; }
                else if (dbName === 'usuarios.db') { badge = 'Seguridad'; iconColor = 'text-purple-500'; }
                else if (dbName === 'local.db') { badge = 'Local'; iconColor = 'text-amber-500'; }
                
                return `
                <button type="button" onclick="selectInspectorDb('${dbName}')" class="w-full px-2.5 py-2 rounded-lg text-left text-xs font-semibold flex items-center justify-between transition-all cursor-pointer ${isSelected ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/20 dark:text-brand-300 border border-brand-200 dark:border-brand-500/30' : 'text-text-secondary hover:bg-border-ui dark:hover:bg-border-ui/50 hover:text-text-primary '}">
                  <div class="flex items-center gap-2 truncate">
                    <i data-lucide="database" class="h-3.5 w-3.5 shrink-0 ${iconColor}"></i>
                    <span class="font-mono truncate">${dbName}</span>
                  </div>
                  <span class="text-[9px] uppercase px-1.5 py-0.5 rounded bg-border-ui text-text-secondary font-bold border border-border-ui">${badge}</span>
                </button>
                `;
              }).join('')}
            </div>
          </div>
          ` : ''}
        </div>

        <!-- CUSTOM DROPDOWN: TABLA -->
        <div class="relative w-full sm:w-auto sm:ml-2" id="dropdown-inspector-table-container">
          <div class="flex items-center gap-2">
            <span class="text-xs font-bold text-text-tertiary uppercase tracking-wider shrink-0 flex items-center gap-1.5">
              <i data-lucide="table" class="h-3.5 w-3.5 text-purple-500"></i>
              <span>Tabla:</span>
            </span>
            <button type="button" onclick="toggleInspectorTableDropdown(event)" class="w-full sm:w-56 px-3 py-2 rounded-xl text-xs bg-bg-card hover:bg-border-ui dark:hover:bg-border-ui border border-border-ui hover:border-border-ui dark:hover:border-border-ui font-bold text-text-primary flex items-center justify-between gap-2 shadow-xs transition-all cursor-pointer">
              <span class="truncate font-mono">${inspectorState.selectedTable || 'Seleccionar tabla'}</span>
              <i data-lucide="chevron-down" class="h-3.5 w-3.5 text-text-tertiary transition-transform ${inspectorState.isTableDropdownOpen ? 'rotate-180 text-purple-500' : ''}"></i>
            </button>
          </div>

          ${inspectorState.isTableDropdownOpen ? `
          <div class="absolute left-0 sm:left-14 top-full mt-1.5 w-full sm:w-64 max-h-72 overflow-y-auto bg-bg-header border border-border-ui rounded-xl shadow-2xl backdrop-blur-xl p-1.5 z-50 animate-fade-in space-y-1">
            ${(inspectorState.tables[inspectorState.selectedDb] || []).map(tbl => {
              const isSelected = inspectorState.selectedTable === tbl;
              return `
              <button type="button" onclick="selectInspectorTable('${tbl}')" class="w-full px-2.5 py-1.5 rounded-lg text-left text-xs font-medium flex items-center justify-between transition-all cursor-pointer ${isSelected ? 'bg-purple-50 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300 border border-purple-200 dark:border-purple-500/30 font-bold' : 'text-text-secondary hover:bg-border-ui dark:hover:bg-border-ui/50 hover:text-text-primary '}">
                <div class="flex items-center gap-2 truncate">
                  <i data-lucide="table-properties" class="h-3.5 w-3.5 shrink-0 text-text-tertiary"></i>
                  <span class="font-mono truncate">${tbl}</span>
                </div>
                ${isSelected ? '<i data-lucide="check" class="h-3.5 w-3.5 text-purple-600 dark:text-purple-400 shrink-0"></i>' : ''}
              </button>
              `;
            }).join('')}
          </div>
          ` : ''}
        </div>

      </div>
      
      <div class="relative w-full md:w-80">
        <span class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-tertiary">
          <i data-lucide="search" class="h-4 w-4"></i>
        </span>
        <input type="text" oninput="onInspectorSearch(this.value)" placeholder="Buscar en tabla..." value="${escapeHtmlAttr(inspectorState.search)}" class="w-full py-2 pl-9 pr-4 rounded-xl text-xs bg-bg-card border border-border-ui focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none transition-all text-text-primary font-medium placeholder:text-text-tertiary shadow-xs">
      </div>
    </div>

    <!-- TABLA DE DATOS -->
    <div class="rounded-2xl overflow-hidden mt-4 border border-border-ui bg-bg-header shadow-xs">
      <div class="overflow-x-auto">
        <table class="w-full text-left border-collapse table-auto">
          <thead>
            <tr class="bg-bg-main border-b border-border-ui text-text-tertiary">
              ${headersHtml}
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </div>
      ${paginationControlsHtml}
    </div>
  `;
}

function toggleInspectorDbDropdown(event) {
  if (event) event.stopPropagation();
  inspectorState.isDbDropdownOpen = !inspectorState.isDbDropdownOpen;
  inspectorState.isTableDropdownOpen = false;
  updateInspectorUI();
}
window.toggleInspectorDbDropdown = toggleInspectorDbDropdown;

function toggleInspectorTableDropdown(event) {
  if (event) event.stopPropagation();
  inspectorState.isTableDropdownOpen = !inspectorState.isTableDropdownOpen;
  inspectorState.isDbDropdownOpen = false;
  updateInspectorUI();
}
window.toggleInspectorTableDropdown = toggleInspectorTableDropdown;

function onInspectorDbChange(dbName) {
  inspectorState.selectedDb = dbName;
  const tablesList = inspectorState.tables[dbName] || [];
  inspectorState.selectedTable = tablesList.length > 0 ? tablesList[0] : "";
  inspectorState.page = 1;
  inspectorState.search = "";
  fetchInspectorData();
}
window.onInspectorDbChange = onInspectorDbChange;

function onInspectorTableChange(table) {
  inspectorState.selectedTable = table;
  inspectorState.page = 1;
  inspectorState.search = "";
  fetchInspectorData();
}
window.onInspectorTableChange = onInspectorTableChange;

function selectInspectorDb(dbName) {
  inspectorState.isDbDropdownOpen = false;
  onInspectorDbChange(dbName);
}
window.selectInspectorDb = selectInspectorDb;

function selectInspectorTable(table) {
  inspectorState.isTableDropdownOpen = false;
  onInspectorTableChange(table);
}
window.selectInspectorTable = selectInspectorTable;

// Cerrar dropdowns del inspector al hacer clic fuera
document.addEventListener('click', (e) => {
  if (inspectorState.isDbDropdownOpen || inspectorState.isTableDropdownOpen) {
    const dbContainer = document.getElementById('dropdown-inspector-db-container');
    const tableContainer = document.getElementById('dropdown-inspector-table-container');
    if ((!dbContainer || !dbContainer.contains(e.target)) && (!tableContainer || !tableContainer.contains(e.target))) {
      inspectorState.isDbDropdownOpen = false;
      inspectorState.isTableDropdownOpen = false;
      updateInspectorUI();
    }
  }
});

const debouncedInspectorSearch = debounce(() => {
  fetchInspectorData();
}, 250);

function onInspectorSearch(query) {
  inspectorState.search = query;
  inspectorState.page = 1;
  debouncedInspectorSearch();
}

function changeInspectorPage(page) {
  inspectorState.page = page;
  fetchInspectorData();
}



// ==========================================
// VISTA: CENTRO DE ALERTAS
// ==========================================
let activeAlertasTab = "no_leidas";
let alertasSearchQuery = "";
let activeAlertasType = "todos";

function renderAlertasCentro(container) {
  if (!container) return;

  const allAlerts = getActiveAlertsList(true);
  const unreadAlerts = allAlerts.filter((w) => w.estado_gestion !== "leida");
  const readAlerts = allAlerts.filter((w) => w.estado_gestion === "leida");

  const activeList =
    activeAlertasTab === "no_leidas" ? unreadAlerts : readAlerts;
  const filteredList = activeList.filter((w) => {
    // Filtrar por tipo
    if (activeAlertasType !== "todos" && w.type !== activeAlertasType) {
      return false;
    }
    if (!alertasSearchQuery) return true;
    const query = alertasSearchQuery.toLowerCase();
    return (
      (w.sujeto_pasivo || "").toLowerCase().includes(query) ||
      (w.folio || "").toLowerCase().includes(query) ||
      (w.text || "").toLowerCase().includes(query)
    );
  });

  const tabsHtml = `
    <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between border-b border-[var(--border-ui)] mb-6 gap-4">
      <div class="flex gap-2">
        <button onclick="switchAlertasTab('no_leidas')" class="-mb-px px-4 py-2.5 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${ activeAlertasTab ==="no_leidas"
            ? "border-brand-500 text-[var(--text-primary)] font-bold"
            : "border-transparent text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
        }">
          <i data-lucide="bell" class="h-4 w-4"></i>
          No leídas
          <span class="px-1.5 py-0.5 rounded-full text-[10px] bg-brand-500/20 text-brand-700 dark:text-brand-300 font-bold">
            ${unreadAlerts.length}
          </span>
        </button>
        <button onclick="switchAlertasTab('leidas')" class="-mb-px px-4 py-2.5 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${ activeAlertasTab ==="leidas"
            ? "border-brand-500 text-[var(--text-primary)] font-bold"
            : "border-transparent text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
        }">
          <i data-lucide="archive" class="h-4 w-4"></i>
          Leídas / Historial
          <span class="px-1.5 py-0.5 rounded-full text-[10px] bg-border-ui text-text-secondary font-bold">
            ${readAlerts.length}
          </span>
        </button>
      </div>

      <!-- Filtro de tipo de alerta -->
      <div class="flex items-center gap-1.5 pb-2.5 lg:pb-0 overflow-x-auto whitespace-nowrap scrollbar-none">
        <span class="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider mr-1 select-none">Tipo:</span>
        <button onclick="switchAlertasType('todos')" class="px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${ activeAlertasType ==="todos"
            ? "bg-border-ui  text-[var(--text-primary)] font-bold"
            : "text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-border-ui/50"
        }">
          Todos
        </button>
        <button onclick="switchAlertasType('solicitud')" class="px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${ activeAlertasType ==="solicitud"
            ? "bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 font-bold"
            : "text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-border-ui/50"
        }">
          <span class="h-1.5 w-1.5 rounded-full bg-indigo-500 shrink-0"></span>
          Solicitudes
        </button>
        <button onclick="switchAlertasType('publicacion')" class="px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${ activeAlertasType ==="publicacion"
            ? "bg-purple-500/10 border border-purple-500/30 text-purple-450 font-bold"
            : "text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-border-ui/50"
        }">
          <span class="h-1.5 w-1.5 rounded-full bg-purple-500 shrink-0"></span>
          Publicaciones
        </button>
        <button onclick="switchAlertasType('agenda')" class="px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${ activeAlertasType ==="agenda"
            ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-450 font-bold"
            : "text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-border-ui/50"
        }">
          <span class="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0"></span>
          Agenda
        </button>
      </div>
    </div>
  `;

  let actionButtonsHtml = "";
  if (activeAlertasTab === "no_leidas" && unreadAlerts.length > 0) {
    actionButtonsHtml = `
      <button onclick="bulkChangeAlertaEstado('leida')" class="btn-secondary px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm cursor-pointer whitespace-nowrap">
        <i data-lucide="check-check" class="h-4 w-4 text-emerald-600 dark:text-emerald-400"></i>
        Descartar todo
      </button>
    `;
  } else if (activeAlertasTab === "leidas" && readAlerts.length > 0) {
    actionButtonsHtml = `
      <button onclick="bulkChangeAlertaEstado('borrada')" class="px-3.5 py-2 rounded-xl text-xs font-bold bg-rose-50 dark:bg-rose-950/10 hover:bg-rose-100 dark:hover:bg-rose-900/20 border border-rose-200 dark:border-rose-800/30 text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 transition-all flex items-center gap-1.5 shadow-sm cursor-pointer whitespace-nowrap">
        <i data-lucide="trash-2" class="h-4 w-4"></i>
        Borrar historial
      </button>
    `;
  }

  let listHtml = "";
  if (filteredList.length === 0) {
    const isSearch = !!alertasSearchQuery;
    listHtml = `
      <div class="text-center py-16 border border-dashed border-[var(--border-ui)] rounded-2xl bg-bg-card">
        <i data-lucide="${isSearch ? "search" : activeAlertasTab === "no_leidas" ? "check-circle" : "archive"}" class="h-12 w-12 ${isSearch ?"text-[var(--text-tertiary)]" : activeAlertasTab === "no_leidas" ? "text-emerald-500/80" : "text-[var(--text-tertiary)]"} mx-auto mb-3"></i>
        <h3 class="text-sm font-bold text-[var(--text-primary)]">${isSearch ? "Sin resultados" : activeAlertasTab === "no_leidas" ? "¡Todo al día!" : "Historial vacío"}</h3>
        <p class="text-xs text-[var(--text-tertiary)] mt-1 max-w-md mx-auto">
          ${isSearch ? "Intente buscar con otros términos o revise los filtros." : activeAlertasTab === "no_leidas" ? "No tienes alertas pendientes de lectura." : "Aquí se guardarán las alertas que descartes desde la campanita."}
        </p>
      </div>
    `;
  } else {
    listHtml = `
      <div class="grid grid-cols-1 gap-3.5">
        ${filteredList
          .map((w) => {
            const typeBadge =
              w.type === "solicitud"
                ? `<span class="bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-200/50 dark:border-indigo-500/20 text-[9px] px-2 py-0.5 rounded-lg font-bold uppercase tracking-wider">Solicitud</span>`
                : w.type === "agenda"
                  ? `<span class="text-[9px] px-2 py-0.5 rounded-lg font-bold uppercase tracking-wider badge-status-enplazo">Agenda</span>`
                  : `<span class="bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-200/50 dark:border-purple-500/20 text-[9px] px-2 py-0.5 rounded-lg font-bold uppercase tracking-wider">Publicación</span>`;

            const urgencyBadge =
              w.color === "red"
                ? `<span class="flex h-2.5 w-2.5 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(239,68,68,0.5)] animate-pulse shrink-0 mt-1.5"></span>`
                : w.color === "blue"
                  ? `<span class="flex h-2.5 w-2.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)] animate-pulse shrink-0 mt-1.5"></span>`
                  : `<span class="flex h-2.5 w-2.5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)] shrink-0 mt-1.5"></span>`;

            const dateIconHtml = `<i data-lucide="calendar" class="h-3.5 w-3.5 inline text-[var(--text-tertiary)] mr-1 align-text-bottom"></i>`;

            const toggleReadBtn =
              w.estado_gestion === "leida"
                ? `<button onclick="changeAlertaEstado('${w.type}', '${w.id}', null)" class="alert-action-btn btn-unread" title="Reactivar alerta (devolver a campanita)">
                 <i data-lucide="rotate-ccw" class="h-4 w-4"></i>
               </button>`
                : `<button onclick="changeAlertaEstado('${w.type}', '${w.id}', 'leida')" class="alert-action-btn btn-read" title="Marcar como leída (descartar de campanita)">
                 <i data-lucide="check" class="h-4 w-4"></i>
               </button>`;

            return `
            <div class="glass-card px-6 py-5 rounded-2xl ${w.color ==="red" ? "card-alert-urgent" : w.color === "blue" ? "card-alert-info" : "card-alert-warning"} flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all hover:bg-border-ui dark:hover:bg-border-ui group font-sans">
              <div class="flex gap-3.5 items-start text-left min-w-0">
                ${urgencyBadge}
                <div class="min-w-0">
                  <div class="flex items-center gap-2 mb-1.5 flex-wrap">
                    ${typeBadge}
                    <span class="text-xs text-[var(--text-secondary)] font-medium">Folio: <span class="font-mono text-[var(--text-primary)] font-bold">${w.folio}</span></span>
                  </div>
                  <h4 class="text-sm font-bold text-[var(--text-primary)] truncate">${w.sujeto_pasivo || "Sujeto Pasivo"}</h4>
                  <p class="text-xs text-[var(--text-secondary)] mt-1.5 leading-relaxed">${w.text}</p>
                  <div class="mt-2 text-[10px] text-[var(--text-tertiary)] font-mono flex items-center gap-1">
                    ${dateIconHtml} Límite: <span class="text-[var(--text-secondary)] font-semibold">${formatDate(w.deadline)}</span>
                  </div>
                </div>
              </div>
              
              <div class="flex items-center gap-2 self-end sm:self-center shrink-0">
                <button onclick="goToAlertItem('${w.type}', '${w.folio}')" class="alert-action-btn btn-view" title="Ir al registro original">
                  <i data-lucide="eye" class="h-4 w-4"></i>
                </button>
                ${toggleReadBtn}
                <button onclick="deleteAlerta('${w.type}', '${w.id}')" class="alert-action-btn btn-delete" title="Borrar permanentemente del historial">
                  <i data-lucide="trash-2" class="h-4 w-4"></i>
                </button>
              </div>
            </div>
          `;
          })
          .join("")}
      </div>
    `;
  }

  container.innerHTML = `
    <div class="space-y-6">
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div class="space-y-1">
          <h2 class="text-2xl font-bold text-[var(--text-primary)] tracking-tight flex items-center gap-2.5">
            <i data-lucide="bell" class="h-6 w-6 text-brand-400"></i>
            Centro de Alertas
          </h2>
          <p class="text-xs text-[var(--text-tertiary)]">Gestión de alertas preventivas por vencimiento de plazos legales.</p>
        </div>
        <div class="flex items-center gap-3 w-full md:w-auto">
          <div class="relative w-full md:w-64">
            <span class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[var(--text-tertiary)]">
              <i data-lucide="search" class="h-4 w-4"></i>
            </span>
            <input type="text" id="search-alertas" oninput="onAlertasSearch(this.value)" placeholder="Buscar por folio, nombre..." value="${escapeHtmlAttr(alertasSearchQuery)}" class="w-full py-2.5 pl-9 pr-4 rounded-xl text-xs glass-input focus:outline-none transition-colors text-[var(--text-primary)]">
          </div>
          ${actionButtonsHtml}
        </div>
      </div>

      ${tabsHtml}
      
      <div class="mt-4">
        ${listHtml}
      </div>
    </div>
  `;

  if (window.lucide && typeof window.lucide.createIcons === "function") {
    window.lucide.createIcons();
  }
}

function switchAlertasTab(tab) {
  activeAlertasTab = tab;
  const container = document.getElementById("main-content");
  renderAlertasCentro(container);
}

function switchAlertasType(type) {
  activeAlertasType = type;
  const container = document.getElementById("main-content");
  renderAlertasCentro(container);
}

function onAlertasSearch(val) {
  alertasSearchQuery = val;
  const container = document.getElementById("main-content");
  renderAlertasCentro(container);
}

// Acción individual: Cambiar estado (leída / no leída)
async function changeAlertaEstado(type, id, estado) {
  try {
    const res = await fetch("/api/alertas/gestionar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        alertas: [{ tipo: type, solicitud_id: id, estado: estado }],
      }),
    });
    if (res.ok) {
      showToast(
        estado === "leida"
          ? "Alerta marcada como leída."
          : "Alerta marcada como no leída.",
      );
      await fetchAlertas();
    } else {
      showToast("Error al actualizar el estado de la alerta.", "error");
    }
  } catch (err) {
    console.error(err);
    showToast("Error de red al actualizar la alerta.", "error");
  }
}

// Acción individual: Borrar alerta (estado = 'borrada')
function deleteAlerta(type, id) {
  openConfirmModal(
    "Eliminar Alerta del Historial",
    "¿Estás seguro de que deseas eliminar permanentemente esta alerta del historial? Ya no volverá a aparecer en el Centro de Alertas.",
    async () => {
      try {
        const res = await fetch("/api/alertas/gestionar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            alertas: [{ tipo: type, solicitud_id: id, estado: "borrada" }],
          }),
        });
        if (res.ok) {
          showToast("Alerta eliminada con éxito.");
          await fetchAlertas();
        } else {
          showToast("Error al eliminar la alerta.", "error");
        }
      } catch (err) {
        console.error(err);
        showToast("Error de red al eliminar la alerta.", "error");
      }
    },
  );
}

// Acción bulk: Marcar todas como leídas o borrar todo el historial
function bulkChangeAlertaEstado(estado) {
  const allAlerts = getActiveAlertsList(true);
  let targetAlerts = [];
  let modalTitle = "";
  let modalText = "";

  if (estado === "leida") {
    targetAlerts = allAlerts.filter((w) => w.estado_gestion !== "leida");
    if (targetAlerts.length === 0) return;
    modalTitle = "Descartar todas las Alertas";
    modalText =
      "¿Estás seguro de que deseas marcar todas las alertas actuales como leídas?";
  } else if (estado === "borrada") {
    targetAlerts = allAlerts.filter((w) => w.estado_gestion === "leida");
    if (targetAlerts.length === 0) return;
    modalTitle = "Limpiar Historial de Alertas";
    modalText =
      "¿Estás seguro de que deseas borrar permanentemente todo el historial de alertas leídas? Esta acción no se puede deshacer.";
  }

  const performBulk = async () => {
    try {
      const alertasToManage = targetAlerts.map((w) => ({
        tipo: w.type,
        solicitud_id: w.id,
        estado: estado,
      }));

      const res = await fetch("/api/alertas/gestionar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alertas: alertasToManage }),
      });

      if (res.ok) {
        showToast(
          estado === "leida"
            ? "Todas las alertas fueron marcadas como leídas."
            : "Historial de alertas limpio con éxito.",
        );
        await fetchAlertas();
      } else {
        showToast("Error al procesar la acción en lote.", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Error de red al realizar la acción en lote.", "error");
    }
  };

  openConfirmModal(modalTitle, modalText, performBulk);
}

// =========================================================================
// MÓDULO DE AGENDA Y CALENDARIO DE AUDIENCIAS
// =========================================================================

function formatLocalDateYYYYMMDD(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getCalendarActiveTitle() {
  const months = [
    "Enero",
    "Febrero",
    "Marzo",
    "Abril",
    "Mayo",
    "Junio",
    "Julio",
    "Agosto",
    "Septiembre",
    "Octubre",
    "Noviembre",
    "Diciembre",
  ];
  const year = currentCalendarDate.getFullYear();

  if (calendarViewMode === "month") {
    return `${months[currentCalendarDate.getMonth()]} ${year}`;
  } else if (calendarViewMode === "week") {
    const currentDayOfWeek = currentCalendarDate.getDay();
    const daysToMon = currentDayOfWeek === 0 ? -6 : 1 - currentDayOfWeek;
    const monDate = new Date(currentCalendarDate);
    monDate.setDate(monDate.getDate() + daysToMon);

    const sunDate = new Date(monDate);
    sunDate.setDate(sunDate.getDate() + 6);

    if (monDate.getMonth() === sunDate.getMonth()) {
      return `${monDate.getDate()} al ${sunDate.getDate()} de ${months[monDate.getMonth()]} ${monDate.getFullYear()}`;
    } else {
      if (monDate.getFullYear() === sunDate.getFullYear()) {
        return `${monDate.getDate()} de ${months[monDate.getMonth()]} al ${sunDate.getDate()} de ${months[sunDate.getMonth()]} ${monDate.getFullYear()}`;
      } else {
        return `${monDate.getDate()} de ${months[monDate.getMonth()]} ${monDate.getFullYear()} al ${sunDate.getDate()} de ${months[sunDate.getMonth()]} ${sunDate.getFullYear()}`;
      }
    }
  } else {
    return `${currentCalendarDate.getDate()} de ${months[currentCalendarDate.getMonth()]} ${year}`;
  }
}

function calculateCalendarDateRange() {
  let start = "";
  let end = "";

  if (calendarViewMode === "month") {
    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const startDay = firstDay.getDay();
    let prevDays = startDay === 0 ? 6 : startDay - 1;

    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - prevDays);

    const lastDay = new Date(year, month + 1, 0);
    const endDay = lastDay.getDay();
    let nextDays = endDay === 0 ? 0 : 7 - endDay;

    const endDate = new Date(lastDay);
    endDate.setDate(endDate.getDate() + nextDays);

    start = formatLocalDateYYYYMMDD(startDate);
    end = formatLocalDateYYYYMMDD(endDate) + " 23:59:59";
  } else if (calendarViewMode === "week") {
    const currentDayOfWeek = currentCalendarDate.getDay();
    const daysToMon = currentDayOfWeek === 0 ? -6 : 1 - currentDayOfWeek;

    const monDate = new Date(currentCalendarDate);
    monDate.setDate(monDate.getDate() + daysToMon);

    const sunDate = new Date(monDate);
    sunDate.setDate(sunDate.getDate() + 6);

    start = formatLocalDateYYYYMMDD(monDate);
    end = formatLocalDateYYYYMMDD(sunDate) + " 23:59:59";
  } else {
    const dateStr = formatLocalDateYYYYMMDD(currentCalendarDate);
    start = dateStr;
    end = dateStr + " 23:59:59";
  }

  return { start, end };
}

async function fetchAndDrawCalendar() {
  const placeholder = document.getElementById("calendar-content-placeholder");
  if (!placeholder) return;

  placeholder.innerHTML = `
    <div class="absolute inset-0 flex items-center justify-center bg-bg-main backdrop-blur-[1px] rounded-2xl min-h-[300px]">
      <div class="h-8 w-8 rounded-full border-2 border-brand-500 border-t-transparent animate-spin"></div>
    </div>
  `;

  const range = calculateCalendarDateRange();

  try {
    const params = new URLSearchParams({
      all: "true",
      estado: "Aceptada",
      fecha_agendada_desde: range.start,
      fecha_agendada_hasta: range.end,
    });

    const res = await fetch(`/api/solicitudes?${params.toString()}`);
    if (res.ok) {
      calendarEvents = await res.json();
      window.calendarEvents = calendarEvents;
      drawCalendarBodyOnly();
    } else {
      placeholder.innerHTML = `
        <div class="py-20 text-center glass-card rounded-2xl border border-border-ui">
          <i data-lucide="alert-circle" class="h-10 w-10 text-rose-500/80 mx-auto mb-3 animate-pulse"></i>
          <p class="text-xs text-rose-400 font-semibold">Error al cargar datos del calendario.</p>
        </div>
      `;
      lucide.createIcons();
    }
  } catch (err) {
    console.error(err);
    placeholder.innerHTML = `
      <div class="py-20 text-center glass-card rounded-2xl border border-border-ui">
        <i data-lucide="alert-circle" class="h-10 w-10 text-rose-500/80 mx-auto mb-3 animate-pulse"></i>
        <p class="text-xs text-rose-400 font-semibold">Error de conexión al cargar el calendario.</p>
        <p class="text-[10px] text-text-tertiary mt-2 font-mono">Detalle: ${escapeHtml(err.message || String(err))}</p>
      </div>
    `;
    lucide.createIcons();
  }
}

function detectCalendarConflicts(events) {
  if (!events || !Array.isArray(events)) return;

  events.forEach((e) => {
    e.hasConflict = false;
    e.conflictDetails = "";
  });

  const groups = {};
  events.forEach((e) => {
    if (!e.fecha_agendada || !e.sujeto_pasivo) return;
    const datePart = e.fecha_agendada.split(" ")[0];
    const name = e.sujeto_pasivo.trim().toLowerCase();
    const key = `${datePart}_${name}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(e);
  });

  Object.values(groups).forEach((group) => {
    if (group.length <= 1) return;

    // Calcular minutos transcurridos desde medianoche
    group.forEach((e) => {
      const timePart = e.fecha_agendada.split(" ")[1] || "00:00";
      const [h, m] = timePart.split(":").map(Number);
      e._epoch = h * 60 + m;
    });

    group.sort((a, b) => a._epoch - b._epoch);

    // Comparar pares de reuniones
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const a = group[i];
        const b = group[j];

        // Si la diferencia es menor a 30 minutos (es decir, b._epoch - a._epoch < 30), hay choque
        if (b._epoch - a._epoch < 30) {
          a.hasConflict = true;
          b.hasConflict = true;

          const timeA = a.fecha_agendada.split(" ")[1]
            ? a.fecha_agendada.split(" ")[1].slice(0, 5)
            : "00:00";
          const timeB = b.fecha_agendada.split(" ")[1]
            ? b.fecha_agendada.split(" ")[1].slice(0, 5)
            : "00:00";

          a.conflictDetails = `Choque: tiene otra reunión con este sujeto pasivo a las ${timeB}`;
          b.conflictDetails = `Choque: tiene otra reunión con este sujeto pasivo a las ${timeA}`;
        }
      }
    }

    group.forEach((e) => delete e._epoch);
  });
}

function drawCalendarBodyOnly() {
  const rangeLabel = document.getElementById("calendar-active-range-label");
  if (rangeLabel) {
    rangeLabel.textContent = getCalendarActiveTitle();
  }
  const titleDisplay = document.getElementById("calendar-title-display");
  if (titleDisplay) {
    titleDisplay.textContent = getCalendarActiveTitle();
  }

  detectCalendarConflicts(calendarEvents);

  let filtered = calendarEvents || [];
  if (calendarFilters.vigencia === 'vigentes' || calendarFilters.soloVigentes === true) {
    filtered = filtered.filter((e) => {
      if (e.sujeto_pasivo_id && typeof activeSujetoIdsCache !== 'undefined' && activeSujetoIdsCache.has(e.sujeto_pasivo_id)) {
        return true;
      }
      if (dashboardDropdownCache.nombresVigentes && e.sujeto_pasivo) {
        return dashboardDropdownCache.nombresVigentes.some(n => n.toLowerCase() === e.sujeto_pasivo.toLowerCase());
      }
      return false;
    });
  } else if (calendarFilters.vigencia === 'no_vigentes') {
    filtered = filtered.filter((e) => {
      if (e.sujeto_pasivo_id && typeof activeSujetoIdsCache !== 'undefined' && activeSujetoIdsCache.has(e.sujeto_pasivo_id)) {
        return false;
      }
      if (dashboardDropdownCache.nombresVigentes && e.sujeto_pasivo) {
        return !dashboardDropdownCache.nombresVigentes.some(n => n.toLowerCase() === e.sujeto_pasivo.toLowerCase());
      }
      return true;
    });
  }
  if (calendarFilters.search) {
    const query = calendarFilters.search.toLowerCase().trim();
    filtered = filtered.filter(
      (e) =>
        (e.sujeto_pasivo || "").toLowerCase().includes(query) ||
        (e.cargo_limpio || e.cargo || "").toLowerCase().includes(query) ||
        (e.folio_lobby || "").toLowerCase().includes(query),
    );
  }

  const placeholder = document.getElementById("calendar-content-placeholder");
  if (!placeholder) return;

  if (calendarViewMode === "month") {
    drawMonthView(placeholder, filtered);
  } else if (calendarViewMode === "week") {
    drawWeekView(placeholder, filtered);
  } else {
    drawDayView(placeholder, filtered);
  }
}

function drawMonthView(container, events) {
  const year = currentCalendarDate.getFullYear();
  const month = currentCalendarDate.getMonth();

  // Escanear si hay reuniones en Sábado o Domingo durante el mes activo
  const hasWeekendEventsInMonth = events.some((e) => {
    if (!e.fecha_agendada) return false;
    const [datePart] = e.fecha_agendada.split(" ");
    const [y, m, d] = datePart.split("-").map(Number);
    if (y === year && m - 1 === month) {
      const dayOfWeek = new Date(y, m - 1, d).getDay();
      return dayOfWeek === 0 || dayOfWeek === 6; // 0 = Domingo, 6 = Sábado
    }
    return false;
  });

  const colsCount = hasWeekendEventsInMonth ? 7 : 5;
  const dayHeaders = hasWeekendEventsInMonth
    ? [
        "Lunes",
        "Martes",
        "Miércoles",
        "Jueves",
        "Viernes",
        "Sábado",
        "Domingo",
      ]
    : ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"];

  const firstDayOfMonth = new Date(year, month, 1);
  const startDay = firstDayOfMonth.getDay();
  let prevMonthDaysCount = startDay === 0 ? 6 : startDay - 1;

  const gridStartDate = new Date(firstDayOfMonth);
  gridStartDate.setDate(gridStartDate.getDate() - prevMonthDaysCount);

  // Calcular número de semanas del mes
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const endDay = lastDayOfMonth.getDay();
  let daysAfter = endDay === 0 ? 0 : 7 - endDay;
  const totalDaysSpan = prevMonthDaysCount + lastDayOfMonth.getDate() + daysAfter;
  const weeksCount = Math.ceil(totalDaysSpan / 7);

  let html = `
    <div class="grid ${hasWeekendEventsInMonth ?"grid-cols-7" : "grid-cols-5"} gap-px rounded-2xl overflow-hidden border border-border-ui  bg-border-ui  shadow-sm h-[calc(100vh-250px)] min-h-[520px]">
      <!-- Headers -->
      ${dayHeaders
        .map(
          (day) => `
        <div class="bg-bg-main text-text-tertiary text-[10.5px] font-bold uppercase tracking-wider py-2.5 text-center select-none border-b border-border-ui">
          ${day}
        </div>
      `,
        )
        .join("")}
  `;

  const today = new Date();
  const todayStr = formatLocalDateYYYYMMDD(today);
  const tempDate = new Date(gridStartDate);

  for (let w = 0; w < weeksCount; w++) {
    for (let d = 0; d < 7; d++) {
      const dayOfWeek = tempDate.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

      // Si el mes no tiene reuniones de fin de semana, saltar sábados y domingos
      if (!hasWeekendEventsInMonth && isWeekend) {
        tempDate.setDate(tempDate.getDate() + 1);
        continue;
      }

      const tempDateStr = formatLocalDateYYYYMMDD(tempDate);
      const isCurrentMonth = tempDate.getMonth() === month;
      const isToday = tempDateStr === todayStr;

      const cellEvents = isCurrentMonth
        ? events
            .filter(
              (e) =>
                e.fecha_agendada && e.fecha_agendada.startsWith(tempDateStr),
            )
            .sort((a, b) =>
              (a.fecha_agendada || "").localeCompare(b.fecha_agendada || ""),
            )
        : [];

      const maxVisible = cellEvents.length <= 2 ? 2 : 1;
      const visibleEvents = cellEvents.slice(0, maxVisible);
      const hiddenCount = cellEvents.length - visibleEvents.length;

      html += `
        <div ${isCurrentMonth ? `onclick="openDayEventsModal('${tempDateStr}')"` : ""} 
             class="p-2 flex flex-col justify-between min-h-0 overflow-hidden transition-colors ${ isToday ?"bg-violet-50/60 dark:bg-violet-950/30 ring-2 ring-brand-500 ring-inset z-10 cursor-pointer"
                 : isCurrentMonth
                   ? isWeekend
                     ? "bg-amber-50/30 dark:bg-amber-950/20 hover:bg-amber-100/40 cursor-pointer"
                     : "bg-bg-card  hover:bg-violet-50/40 dark:hover:bg-violet-950/20 cursor-pointer"
                   : "bg-bg-main  opacity-30 select-none cursor-default"
             }">
          <!-- Header del día -->
          <div class="flex items-center justify-between leading-none mb-1 select-none">
            <span class="text-xs font-bold ${ isToday ?"w-6 h-6 flex items-center justify-center rounded-full bg-brand-600 text-white shadow-sm"
                : isCurrentMonth
                  ? isWeekend
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-text-primary "
                  : "text-text-tertiary "
            }">
              ${tempDate.getDate()}
            </span>
            ${isWeekend && isCurrentMonth ? '<span class="text-[7.5px] font-bold uppercase tracking-wider text-amber-500 px-1 rounded bg-amber-500/10 border border-amber-500/20">Fin de Semana</span>' : ''}
          </div>

          <!-- Lista de micro-píldoras elásticas -->
          <div class="flex-1 space-y-1 overflow-hidden">
            ${visibleEvents
              .map((e) => {
                const isPast =
                  e.fecha_agendada && e.fecha_agendada.split(" ")[0] < todayStr;
                const timeStr =
                  e.fecha_agendada && e.fecha_agendada.split(" ")[1]
                    ? e.fecha_agendada.split(" ")[1].slice(0, 5)
                    : "00:00";

                return `
                <div onclick="event.stopPropagation(); showAgendaDetailsModal(${e.id})" 
                     class="flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10.5px] border cursor-pointer select-none transition-all hover:scale-[1.01] shadow-xs ${ isWeekend ?"bg-amber-50 dark:bg-amber-950/50 border-amber-300 dark:border-amber-700/60 text-amber-950 dark:text-amber-100"
                         : isPast
                           ? "bg-border-ui  border-border-ui  text-text-secondary  hover:bg-border-ui"
                           : "bg-violet-50 dark:bg-violet-950/50 border-violet-200/90 dark:border-violet-800/60 text-text-primary  hover:bg-violet-100 dark:hover:bg-violet-900/60"
                     } ${e.hasConflict ? "ring-1 ring-amber-500/40" : ""}"
                     title="${escapeHtmlAttr(e.sujeto_pasivo)} (${timeStr}) - Folio: ${escapeHtmlAttr(e.folio_lobby || "Sin Folio")}${isWeekend ? ' [⚠️ Fin de semana]' : ''}">
                  <span class="font-mono font-bold text-[10px] shrink-0 ${isWeekend ?"text-amber-600 dark:text-amber-400" : e.hasConflict ? "text-amber-500" : isPast ? "text-text-tertiary " : "text-violet-700 dark:text-violet-400"}">${timeStr}</span>
                  <span class="truncate font-semibold">${escapeHtml(e.sujeto_pasivo)}</span>
                </div>
              `;
              })
              .join("")}
            ${
              hiddenCount > 0
                ? `
              <div onclick="event.stopPropagation(); openDayEventsModal('${tempDateStr}')" 
                   class="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[9px] font-bold bg-violet-100 dark:bg-violet-900/50 text-violet-700 dark:text-violet-300 hover:bg-violet-200 dark:hover:bg-violet-800/70 transition-colors cursor-pointer select-none">
                +${hiddenCount} más
              </div>
            `
                : ""
            }
          </div>
        </div>
      `;

      tempDate.setDate(tempDate.getDate() + 1);
    }
  }

  html += `</div>`;
  container.innerHTML = html;
}

function openDayEventsModal(dateStr) {
  try {
    const event = window.event;
    if (event) event.stopPropagation();

    const eventsList = window.calendarEvents || calendarEvents || [];
    const dayEvents = eventsList
      .filter((e) => e.fecha_agendada && e.fecha_agendada.startsWith(dateStr))
      .sort((a, b) =>
        (a.fecha_agendada || "").localeCompare(b.fecha_agendada || ""),
      );

    const modal = document.getElementById("modal-container");
    if (!modal) return;

    const today = new Date();
    const todayStr = formatLocalDateYYYYMMDD(today);
    const isToday = dateStr === todayStr;

    modal.classList.remove("hidden");
    modal.classList.add("backdrop-animate-in");

    modal.innerHTML = `
      <div class="glass-card w-full max-w-lg p-5 rounded-3xl space-y-4 shadow-2xl relative modal-animate-in border border-border-ui bg-bg-header backdrop-blur-xl max-h-[85vh] flex flex-col font-sans text-left">
        <!-- Header del Pop-over -->
        <div class="flex items-center justify-between border-b border-border-ui pb-3 shrink-0">
          <div class="flex items-center gap-2.5">
            <div class="h-9 w-9 rounded-xl bg-brand-500/10 text-brand-500 dark:bg-brand-500/20 dark:text-brand-400 flex items-center justify-center shrink-0">
              <i data-lucide="calendar" class="h-5 w-5"></i>
            </div>
            <div>
              <h3 class="text-sm font-bold text-text-primary flex items-center gap-2">
                <span>Audiencias del Día</span>
                ${isToday ? '<span class="text-[9px] font-bold uppercase px-2 py-0.5 bg-brand-500 text-white rounded-full">Hoy</span>' : ''}
              </h3>
              <p class="text-xs text-text-tertiary">${formatDate(dateStr)}</p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <span class="px-2.5 py-0.5 rounded-lg text-xs font-bold bg-border-ui text-text-secondary border border-border-ui">
              ${dayEvents.length} ${dayEvents.length === 1 ? 'Reunión' : 'Reuniones'}
            </span>
            <button onclick="closeModal()" class="h-7 w-7 rounded-lg flex items-center justify-center text-text-tertiary hover:text-text-primary hover:bg-border-ui dark:hover:bg-border-ui/50 transition-colors cursor-pointer" title="Cerrar">
              <i data-lucide="x" class="h-4 w-4"></i>
            </button>
          </div>
        </div>

        <!-- Listado de Audiencias con scroll interno ordenadas cronológicamente -->
        <div class="flex-1 overflow-y-auto space-y-2.5 pr-1 custom-scrollbar">
          ${dayEvents.length === 0 ? `
            <div class="py-12 text-center select-none">
              <i data-lucide="calendar" class="h-8 w-8 mx-auto mb-2 text-text-secondary"></i>
              <p class="text-xs italic text-text-tertiary">No hay audiencias registradas para esta fecha.</p>
            </div>
          ` : dayEvents.map(e => {
            const isPast = e.fecha_agendada && e.fecha_agendada.split(" ")[0] < todayStr;
            const timeStr = e.fecha_agendada && e.fecha_agendada.split(" ")[1] ? e.fecha_agendada.split(" ")[1].slice(0, 5) : "00:00";
            return `
              <div onclick="showAgendaDetailsModal(${e.id})" 
                   class="p-3 rounded-2xl border text-left cursor-pointer transition-all hover:scale-[1.01] ${ isPast ? 'bg-bg-main border-border-ui ' : 'bg-violet-50/70 dark:bg-violet-950/30 border-violet-200/80 dark:border-violet-800/50 hover:bg-violet-100/80' } ${e.hasConflict ? 'ring-1 ring-amber-500/40' : ''}">
                <div class="flex items-center justify-between mb-1 select-none">
                  <span class="text-xs font-bold font-mono ${e.hasConflict ? 'text-amber-500' : isPast ? 'text-text-tertiary ' : 'text-violet-700 dark:text-violet-400'}">${e.hasConflict ? '⚠️ ' : ''}${timeStr} hrs</span>
                  <div class="flex items-center gap-1.5">
                    ${e.hasConflict ? '<span class="text-[8px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20 px-1.5 py-0.5 rounded">CHOQUE</span>' : ''}
                    <span class="text-[8.5px] font-bold font-mono px-1.5 py-0.5 rounded bg-border-ui text-text-secondary border border-border-ui">Folio: ${escapeHtml(e.folio_lobby || 's/f')}</span>
                  </div>
                </div>
                <h4 class="text-xs font-bold truncate text-text-primary">${escapeHtml(e.sujeto_pasivo)}</h4>
                <p class="text-[11px] text-text-tertiary truncate mt-0.5">${escapeHtml(e.cargo_limpio || getCargoClean(e.cargo))}</p>
                <div class="mt-2 pt-2 border-t border-border-ui flex items-center justify-between text-[10px] text-text-tertiary">
                  <span class="truncate">Solicitante: <strong class="text-text-secondary">${escapeHtml(e.sujeto_activo || 'Sin Lobbista')}</strong></span>
                  <span class="text-brand-500 dark:text-brand-400 font-semibold shrink-0">Ver ficha →</span>
                </div>
              </div>
            `;
          }).join('')}
        </div>

        <!-- Footer -->
        <div class="flex justify-between items-center pt-2 shrink-0 border-t border-border-ui">
          <button onclick="previousCalendarViewMode = 'month'; calendarViewMode = 'day'; currentCalendarDate = new Date('${dateStr}T12:00:00'); closeModal(); renderView();" class="text-xs font-semibold text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1 cursor-pointer">
            <span>Ir a vista diaria completa</span>
            <i data-lucide="arrow-right" class="h-3.5 w-3.5"></i>
          </button>
          <button type="button" onclick="closeModal()" class="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-border-ui text-text-secondary hover:bg-border-ui dark:hover:bg-border-ui/50 transition-colors cursor-pointer">
            Cerrar
          </button>
        </div>
      </div>
    `;

    lucide.createIcons();
  } catch (err) {
    console.error("Error al abrir popover de audiencias del día:", err);
  }
}

function drawWeekView(container, events) {
  const currentDayOfWeek = currentCalendarDate.getDay();
  const daysToMon = currentDayOfWeek === 0 ? -6 : 1 - currentDayOfWeek;

  const monDate = new Date(currentCalendarDate);
  monDate.setDate(monDate.getDate() + daysToMon);

  const today = new Date();
  const todayStr = formatLocalDateYYYYMMDD(today);

  const dayNames = [
    "Lunes",
    "Martes",
    "Miércoles",
    "Jueves",
    "Viernes",
    "Sábado",
    "Domingo",
  ];

  // 1. Pre-calcular todos los 7 días de la semana (Lunes a Domingo)
  const weekDays = [];
  const tempDate = new Date(monDate);

  for (let i = 0; i < 7; i++) {
    const tempDateStr = formatLocalDateYYYYMMDD(tempDate);
    const isWeekend = i >= 5;
    const cellEvents = events
      .filter(
        (e) => e.fecha_agendada && e.fecha_agendada.startsWith(tempDateStr),
      )
      .sort((a, b) =>
        (a.fecha_agendada || "").localeCompare(b.fecha_agendada || ""),
      );
    weekDays.push({
      name: dayNames[i],
      date: tempDate.getDate(),
      dateStr: tempDateStr,
      isToday: tempDateStr === todayStr,
      isWeekend: isWeekend,
      events: cellEvents,
    });
    tempDate.setDate(tempDate.getDate() + 1);
  }

  // Detectar si el fin de semana tiene reuniones
  const hasWeekendEvents =
    weekDays[5].events.length > 0 || weekDays[6].events.length > 0;
  const activeDays = hasWeekendEvents ? weekDays : weekDays.slice(0, 5);
  const gridColsClass = hasWeekendEvents ? "grid-cols-7" : "grid-cols-5";

  // 2. Grilla horizontal dinámica (5 columnas si no hay eventos en fin de semana, 7 si los hay)
  let html = `<div class="w-full grid ${gridColsClass} gap-3 h-[calc(100vh-250px)] min-h-[520px]">`;

  activeDays.forEach((day) => {
    html += `
      <div class="bg-bg-card flex flex-col rounded-2xl border ${ day.isWeekend ?"border-amber-200 dark:border-amber-900/60 bg-amber-50/10"
          : "border-border-ui "
      } ${
        day.isToday ? "ring-2 ring-brand-500 shadow-md shadow-brand-500/10" : ""
      } p-3.5 overflow-hidden shadow-xs">
        <div class="border-b border-border-ui pb-2 mb-2.5 text-center select-none shrink-0 ${day.isToday ?"bg-brand-500/10 rounded-xl pt-1.5 pb-1.5" : ""}">
          <p class="text-[10.5px] font-bold uppercase tracking-wider ${day.isToday ?"text-brand-600 dark:text-brand-400" : day.isWeekend ? "text-amber-600 dark:text-amber-400" : "text-text-tertiary "}">${day.name}</p>
          <p class="text-lg font-extrabold mt-0.5 ${day.isToday ?"text-brand-600 dark:text-brand-400" : "text-text-primary "}">${day.date}</p>
          ${day.isToday ? `<span class="inline-block text-[8px] font-bold uppercase px-2 py-0.5 bg-brand-500 text-white rounded-full mt-0.5 shadow-sm">Hoy</span>` : day.isWeekend ? `<span class="inline-block text-[7.5px] font-bold uppercase px-1.5 py-0.2 bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 rounded-full mt-0.5">Fin de Semana</span>` : ''}
        </div>
        <div class="flex-1 overflow-y-auto space-y-2.5 pr-0.5 custom-scrollbar">
          ${
            day.events.length === 0
              ? `
            <div class="h-full flex items-center justify-center py-20">
              <p class="text-[10.5px] font-medium italic select-none opacity-60 text-text-tertiary">Sin reuniones</p>
            </div>
          `
              : day.events
                  .map((e) => {
                    const isPast =
                      e.fecha_agendada &&
                      e.fecha_agendada.split(" ")[0] < todayStr;
                    const timeStr =
                      e.fecha_agendada && e.fecha_agendada.split(" ")[1]
                        ? e.fecha_agendada.split(" ")[1].slice(0, 5)
                        : "00:00";

                    return `
              <div onclick="showAgendaDetailsModal(${e.id})" 
                   class="p-3 rounded-xl border border-border-ui border-l-4 ${ day.isWeekend ?"border-l-amber-500 bg-amber-50/50 dark:bg-amber-950/30"
                       : isPast
                         ? "border-l-border-ui bg-bg-main "
                         : "border-l-brand-500 bg-violet-50/40 dark:bg-violet-950/20 hover:bg-violet-50 dark:hover:bg-violet-950/40"
                   } cursor-pointer text-left transition-all hover:scale-[1.01] shadow-xs ${e.hasConflict ? "ring-1 ring-amber-500/40" : ""}"
                   title="${escapeHtmlAttr(e.sujeto_pasivo)} - Folio: ${escapeHtmlAttr(e.folio_lobby || "Sin Folio")}${day.isWeekend ? " [⚠️ Reunión en Fin de Semana]" : ""}">
                <!-- Fila 1: Hora + Folio + Badges -->
                <div class="flex items-center justify-between mb-1 select-none">
                  <span class="text-[10.5px] font-bold font-mono ${day.isWeekend ?"text-amber-600 dark:text-amber-400" : e.hasConflict ? "text-amber-500 dark:text-amber-400" : isPast ? "text-text-tertiary " : "text-violet-700 dark:text-violet-300"}">${e.hasConflict ? "⚠️ " : ""}${timeStr}</span>
                  <div class="flex gap-1 items-center">
                    ${day.isWeekend ? `<span class="text-[7px] font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20 px-1 py-0.5 rounded shadow-sm select-none">⚠️ FIN DE SEMANA</span>` : ""}
                    ${e.hasConflict ? `<span class="text-[7px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20 px-1 py-0.5 rounded shadow-sm select-none">CHOQUE</span>` : ""}
                    <span class="text-[8.5px] font-bold font-mono px-1.5 py-0.5 rounded bg-border-ui text-text-secondary border border-border-ui">Folio: ${escapeHtml(e.folio_lobby || "s/f")}</span>
                  </div>
                </div>
                <!-- Fila 2: Sujeto Pasivo -->
                <h4 class="text-xs font-bold truncate ${isPast ?"text-text-secondary " : "text-text-primary "}" title="${escapeHtmlAttr(e.sujeto_pasivo)}">${escapeHtml(e.sujeto_pasivo)}</h4>
                <!-- Fila 3: Sujeto Activo / Representado -->
                <p class="text-[10px] truncate mt-0.5 font-medium ${isPast ?"text-text-tertiary " : "text-text-tertiary "}" title="${escapeHtmlAttr((e.sujeto_activo || "Sin Lobbista") + (e.representado ? " · " + e.representado : ""))}">
                  ${escapeHtml(e.sujeto_activo || "Sin Lobbista")}${e.representado && e.representado !== e.sujeto_activo ? ` <span class="opacity-75">· ${escapeHtml(e.representado)}</span>` : ""}
                </p>
              </div>
            `;
                  })
                  .join("")
          }
        </div>
      </div>
    `;
  });

  html += `</div>`;
  container.innerHTML = html;
}

function drawDayView(container, events) {
  const today = new Date();
  const todayStr = formatLocalDateYYYYMMDD(today);
  const activeDateStr = formatLocalDateYYYYMMDD(currentCalendarDate);

  const cellEvents = events
    .filter(
      (e) => e.fecha_agendada && e.fecha_agendada.startsWith(activeDateStr),
    )
    .sort((a, b) =>
      (a.fecha_agendada || "").localeCompare(b.fecha_agendada || ""),
    );

  const backTargetMode =
    typeof previousCalendarViewMode !== "undefined" &&
    previousCalendarViewMode === "week"
      ? "week"
      : "month";
  const backLabel =
    backTargetMode === "week" ? "Volver a Semana" : "Volver al Mes";

  let html = `
    <div class="bg-bg-card rounded-2xl border border-border-ui p-5 shadow-sm flex flex-col h-[calc(100vh-250px)] min-h-[520px] overflow-hidden">
      <!-- Cabecera Superior Fija -->
      <div class="border-b border-border-ui pb-3 mb-3 flex justify-between items-center select-none shrink-0">
        <div class="flex items-center gap-3 text-left">
          <button onclick="calendarViewMode = '${backTargetMode}'; renderView();" class="px-3 py-1.5 text-xs font-semibold rounded-xl border border-border-ui bg-bg-main hover:bg-border-ui dark:hover:bg-border-ui/50 text-text-secondary transition-all cursor-pointer flex items-center gap-1.5 shadow-xs">
            <i data-lucide="arrow-left" class="h-4 w-4"></i>
            <span>${backLabel}</span>
          </button>
          <div>
            <h3 class="text-sm font-bold text-text-primary">Reuniones del Día</h3>
            <p class="text-xs text-text-tertiary">${formatDate(activeDateStr)}</p>
          </div>
        </div>
        <span class="px-3 py-1 rounded-xl text-xs font-bold bg-border-ui text-text-secondary border border-border-ui shadow-xs">
          ${cellEvents.length} ${cellEvents.length === 1 ? "Reunión" : "Reuniones"}
        </span>
      </div>
      
      <!-- Listado Interno con Scroll Propio -->
      <div class="flex-1 overflow-y-auto custom-scrollbar pr-1">
        ${
          cellEvents.length === 0
            ? `
          <div class="py-24 text-center select-none">
            <i data-lucide="calendar" class="h-10 w-10 mx-auto mb-3 text-text-secondary"></i>
            <p class="text-xs italic text-text-tertiary">No hay reuniones programadas para este día.</p>
          </div>
        `
            : `
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
            ${cellEvents
              .map((e) => {
                const isPast =
                  e.fecha_agendada && e.fecha_agendada.split(" ")[0] < todayStr;
                const timeStr =
                  e.fecha_agendada && e.fecha_agendada.split(" ")[1]
                    ? e.fecha_agendada.split(" ")[1].slice(0, 5)
                    : "00:00";

                return `
                <div onclick="showAgendaDetailsModal(${e.id})" 
                     class="p-4 rounded-2xl border text-left cursor-pointer transition-all hover:scale-[1.005] shadow-xs hover:shadow-md ${ isPast ?"bg-bg-main  border-border-ui "
                         : "bg-bg-card  border-border-ui  hover:border-brand-500/40"
                     } flex flex-col gap-3 ${e.hasConflict ? "ring-1 ring-amber-500/40 shadow-md" : ""}">
                  <!-- Top Row: Time & Folio Badges -->
                  <div class="flex items-center justify-between select-none">
                    <div class="flex items-center gap-2">
                      <span class="px-2.5 py-1 rounded-lg text-xs font-mono font-bold ${ e.hasConflict ?"bg-amber-500/10 text-amber-500 border border-amber-500/20"
                          : isPast
                            ? "bg-border-ui  text-text-secondary "
                            : "bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300"
                      }">
                        ${e.hasConflict ? "⚠️ " : ""}${timeStr} hrs
                      </span>
                      ${e.hasConflict ? `<span class="border border-amber-500/30 bg-amber-500/10 text-amber-500 text-[8px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">CHOQUE HORARIO</span>` : ""}
                    </div>
                    <span class="text-[9px] px-2 py-0.5 rounded font-mono font-bold uppercase tracking-wider bg-border-ui text-text-secondary border border-border-ui">
                      Folio: ${escapeHtml(e.folio_lobby || "Sin Folio")}
                    </span>
                  </div>

                  <!-- Authority info -->
                  <div>
                    <h4 class="text-sm font-bold truncate ${isPast ?"text-text-secondary " : "text-text-primary "}">${escapeHtml(e.sujeto_pasivo)}</h4>
                    <p class="text-xs font-medium mt-0.5 truncate text-text-tertiary">${escapeHtml(e.cargo_limpio || getCargoClean(e.cargo))}</p>
                  </div>
                  
                  ${
                    e.hasConflict
                      ? `
                    <div class="text-[10px] font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1.5 select-none bg-amber-500/5 p-2 rounded-xl border border-amber-500/20">
                      <i data-lucide="alert-triangle" class="h-3.5 w-3.5 shrink-0 text-amber-500"></i>
                      <span>${escapeHtml(e.conflictDetails)}</span>
                    </div>
                  `
                      : ""
                  }
                  
                  <!-- Participants in structured boxes -->
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] pt-1">
                    <div class="bg-bg-main p-2.5 rounded-xl border border-border-ui">
                      <span class="text-[8px] block uppercase tracking-wider font-bold select-none text-text-tertiary">Sujeto Activo (Lobbista)</span>
                      <span class="font-semibold truncate block text-text-secondary mt-0.5" title="${escapeHtmlAttr(e.sujeto_activo || "Sin Lobbista")}">${escapeHtml(e.sujeto_activo || "Sin Lobbista")}</span>
                    </div>
                    <div class="bg-bg-main p-2.5 rounded-xl border border-border-ui">
                      <span class="text-[8px] block uppercase tracking-wider font-bold select-none text-text-tertiary">Representado</span>
                      <span class="font-semibold truncate block text-text-secondary mt-0.5" title="${escapeHtmlAttr(e.representado || "Particular")}">${escapeHtml(e.representado || "Particular")}</span>
                    </div>
                  </div>
                </div>
              `;
              })
              .join("")}
          </div>
        `
        }
      </div>
    </div>
  `;
  container.innerHTML = html;
  if (window.lucide) lucide.createIcons();
}

function showAgendaDetailsModal(eventId) {
  try {
    const event = window.event;
    if (event) event.stopPropagation();

    const eventsList = window.calendarEvents || calendarEvents || [];
    const item = eventsList.find((e) => e.id == eventId);
    if (!item) {
      showToast(
        "No se encontró la reunión en el listado de eventos.",
        "error"
      );
      return;
    }

    const modal = document.getElementById("modal-container");
    if (!modal) {
      showToast(
        "Error: No se encontró el contenedor modal en el DOM.",
        "error"
      );
      return;
    }

    const publicadosFolios = new Set(
      (dataStore.publicadas?.data || dataStore.publicadas || [])
        .map((p) => p.folio_lobby)
        .filter(Boolean),
    );
    const isPublished =
      item.folio_lobby && publicadosFolios.has(item.folio_lobby);

    let pubStatusHtml = "";
    if (isPublished) {
      pubStatusHtml = `
        <span class="px-2.5 py-1 rounded-lg text-[10px] font-semibold flex items-center gap-1 shrink-0 badge-status-enplazo">
          <i data-lucide="check" class="h-3 w-3"></i> Publicada
        </span>
      `;
    } else {
      const delayInfo = getPendingPublicationDelay(item.fecha_agendada, item);
      const badgeColorClass =
        delayInfo.badgeClass === "badge-status-vencido"
          ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
          : "bg-blue-500/10 text-blue-400 border border-blue-500/20";

      const plazoText =
        delayInfo.text === "En plazo"
          ? "Dentro de plazo (DDP)"
          : `Fuera de plazo (FDP - Atrasada ${delayInfo.days} días)`;

      pubStatusHtml = `
        <div class="flex items-center gap-2 flex-wrap">
          <span class="px-2.5 py-1 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-lg text-[10px] font-semibold flex items-center gap-1 shrink-0">
            <i data-lucide="x" class="h-3 w-3"></i> No Publicada
          </span>
          <span class="px-2.5 py-1 ${badgeColorClass} rounded-lg text-[10px] font-semibold shrink-0">
            ${plazoText}
          </span>
        </div>
      `;
    }

    modal.classList.remove("hidden");
    modal.classList.add("backdrop-animate-in");
    modal.innerHTML = `
      <div class="glass-card w-full max-w-xl p-6 rounded-3xl space-y-5 shadow-2xl relative modal-animate-in border border-border-ui bg-bg-header backdrop-blur-xl text-text-primary max-h-[90vh] overflow-y-auto custom-scrollbar font-sans text-left">
        <!-- Header -->
        <div class="flex items-center justify-between border-b border-border-ui pb-3">
          <div class="flex items-center gap-2">
            <div class="h-9 w-9 rounded-xl bg-brand-500/10 text-brand-500 flex items-center justify-center shrink-0">
              <i data-lucide="calendar" class="h-4.5 w-4.5"></i>
            </div>
            <div>
              <h3 class="text-xs font-bold uppercase tracking-wider text-text-tertiary">Detalle de Audiencia</h3>
              <span class="text-xs font-semibold text-text-secondary text-text-secondary">Folio: <span class="font-mono text-brand-500 dark:text-brand-400 font-bold">${item.folio_lobby || "Sin Folio"}</span></span>
            </div>
          </div>
          <button onclick="closeModal()" class="h-7 w-7 rounded-lg flex items-center justify-center border border-border-ui hover:bg-border-ui dark:hover:bg-border-ui/50 text-text-tertiary hover:text-text-primary transition-colors cursor-pointer">
            <i data-lucide="x" class="h-4 w-4"></i>
          </button>
        </div>

        <!-- Info grid -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div>
            <span class="text-[10px] text-text-tertiary block uppercase tracking-wider font-bold">Fecha / Hora Agendada</span>
            <span class="text-text-secondary font-semibold">${formatDate(item.fecha_agendada)}${item.fecha_agendada && item.fecha_agendada.split(' ')[1] ? ' ' + item.fecha_agendada.split(' ')[1].slice(0, 5) : ''}</span>
          </div>
          <div>
            <span class="text-[10px] text-text-tertiary block uppercase tracking-wider font-bold">Estado de Publicación</span>
            <div class="mt-1">${pubStatusHtml}</div>
          </div>
        </div>

        <hr class="border-border-ui">

        <div class="space-y-3.5 text-xs">
          <div>
            <span class="text-[10px] text-text-tertiary block uppercase tracking-wider font-bold">Sujeto Pasivo (Autoridad)</span>
            <p class="text-sm font-bold text-text-primary">${escapeHtml(item.sujeto_pasivo)}</p>
            <p class="text-xs text-text-tertiary font-medium mt-0.5">${escapeHtml(item.cargo_limpio || getCargoClean(item.cargo))}</p>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <span class="text-[10px] text-text-tertiary block uppercase tracking-wider font-bold">Sujeto Activo (Lobbista/Gestor)</span>
              <p class="text-text-secondary font-semibold mt-0.5">${escapeHtml(item.sujeto_activo || "Sin Lobbista")}</p>
              ${item.rut ? '<p class="text-[10px] text-text-tertiary font-mono mt-0.5">RUT: ' + escapeHtml(item.rut) + "</p>" : ""}
            </div>
            <div>
              <span class="text-[10px] text-text-tertiary block uppercase tracking-wider font-bold">Representado</span>
              <p class="text-text-secondary font-semibold mt-0.5">${escapeHtml(item.representado || "Particular")}</p>
            </div>
          </div>

          <hr class="border-border-ui">

          <div>
            <span class="text-[10px] text-text-tertiary block uppercase tracking-wider font-bold">Materia</span>
            <p class="text-xs text-text-secondary font-semibold mt-1 bg-bg-main border border-border-ui p-2.5 rounded-xl leading-relaxed select-text">${escapeHtml(item.materia || "Sin especificar")}</p>
          </div>

          ${item.especificacion_materia ? '<div><span class="text-[10px] text-text-tertiary block uppercase tracking-wider font-bold">Especificación de la Materia</span><p class="text-xs text-text-secondary mt-1 bg-bg-main border border-border-ui p-2.5 rounded-xl leading-relaxed select-text">' + escapeHtml(item.especificacion_materia) + "</p></div>" : ""}
        </div>

        <!-- Footer -->
        <div class="flex justify-end gap-3 pt-2">
          ${item.id_lobby ? '<a href="https://www.leylobby.gob.cl/admin/solicitudes/' + item.id_lobby + '" target="_blank" class="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all hover:shadow-lg hover:shadow-brand-500/20 cursor-pointer">Ver Solicitud Original <i data-lucide="external-link" class="h-3.5 w-3.5"></i></a>' : ""}
          <button type="button" onclick="closeModal()" class="px-4 py-2 rounded-xl text-xs font-semibold bg-border-ui text-text-secondary hover:bg-border-ui dark:hover:bg-border-ui/50 transition-colors cursor-pointer">
            Cerrar
          </button>
        </div>
      </div>
    `;

    lucide.createIcons();
  } catch (err) {
    showToast("Error al abrir el modal de detalles: " + err.message, "error");
    console.error(err);
  }
}

function renderAgenda(container) {
  const searchVal = calendarFilters.search || "";

  let headerHtml = `
    <div class="space-y-4 font-sans">
      <!-- Title Bar (Uncluttered) -->
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-2">
        <div class="space-y-0.5 text-left">
          <h2 class="text-xl font-bold text-text-primary flex items-center gap-2 select-none">
            <i data-lucide="calendar" class="h-5 w-5 text-brand-500"></i>
            <span>Agenda de Audiencias</span>
          </h2>
          <p class="text-xs text-text-tertiary">Revisión de audiencias programadas y verificación de plazos.</p>
        </div>
      </div>

      <!-- Integrated Controls Bar (Tailwind UI Pattern) -->
      <div class="glass-card p-2.5 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-3 border border-border-ui bg-bg-header backdrop-blur-md relative z-30 shadow-sm">
        <!-- Compact Search bar with autocomplete -->
        <div class="relative w-full md:w-72" id="cal-search-wrapper">
          <i data-lucide="search" class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary"></i>
          <input type="text" id="search-calendar" 
                 oninput="onCalendarSearchInput(this.value)" 
                 onfocus="onCalendarSearchFocus()"
                 onkeydown="onCalendarSearchKeydown(event)"
                 placeholder="Buscar por autoridad o folio..." 
                 value="${escapeHtmlAttr(searchVal)}" 
                 autocomplete="off"
                 class="w-full py-1.5 pl-9 pr-3 rounded-xl text-xs border border-border-ui bg-bg-main text-text-primary placeholder:text-text-tertiary focus:bg-bg-card dark:focus:bg-bg-main focus:border-brand-500 dark:focus:border-brand-500 focus:outline-none transition-all">
          <div id="cal-suggestions-list" class="cal-suggestions absolute top-full left-0 right-0 mt-1 hidden"></div>
        </div>
        
        <!-- Controls grouped on the right -->
        <div class="flex items-center gap-2.5 shrink-0 flex-wrap justify-end w-full md:w-auto">
          ${renderVigenciaSelect({
            id: "calendar-filter-vigencia",
            value: calendarFilters.vigencia,
            onChange: "changeCalendarVigencia",
          })}

          <!-- Temporal Navigation Capsule (Tailwind UI Pattern: No native OS select dropdowns) -->
          <div class="flex items-center bg-bg-main p-1 rounded-xl border border-border-ui gap-1 select-none">
            <button onclick="navigateCalendar(-1)" class="h-7 w-7 flex items-center justify-center rounded-lg text-text-secondary hover:text-text-primary hover:bg-border-ui dark:hover:bg-border-ui transition-all cursor-pointer" title="Anterior">
              <i data-lucide="chevron-left" class="h-4 w-4"></i>
            </button>
            <button onclick="goCalendarToday()" class="px-2.5 py-1 text-xs font-semibold text-text-secondary hover:text-brand-600 dark:hover:text-brand-400 hover:bg-border-ui dark:hover:bg-border-ui rounded-lg transition-all cursor-pointer" title="Volver a Hoy">
              Hoy
            </button>
            <span id="calendar-active-range-label" class="px-3 py-1 text-xs font-bold text-text-primary min-w-[110px] text-center tracking-wide">
              ${getCalendarActiveTitle()}
            </span>
            <button onclick="navigateCalendar(1)" class="h-7 w-7 flex items-center justify-center rounded-lg text-text-secondary hover:text-text-primary hover:bg-border-ui dark:hover:bg-border-ui transition-all cursor-pointer" title="Siguiente">
              <i data-lucide="chevron-right" class="h-4 w-4"></i>
            </button>
          </div>
          
          <!-- View Switcher (Segmented Button Group) -->
          <div class="flex items-center bg-bg-main p-1 rounded-xl border border-border-ui gap-0.5">
            ${["month", "week", "day"]
              .map((view) => {
                const label =
                  view === "month" ? "Mes" : view === "week" ? "Semana" : "Día";
                const active = calendarViewMode === view;
                const activeClass = active
                  ? "bg-brand-600 text-white shadow-sm font-bold"
                  : "text-text-tertiary  hover:text-text-primary  font-semibold";
                return (
                  "<button onclick=\"changeCalendarViewMode('" +
                  view +
                  '\')" class="px-3 py-1 rounded-lg text-xs transition-all cursor-pointer ' + activeClass + '">' +
                  label +
                  "</button>"
                );
              })
              .join("")}
          </div>
        </div>
      </div>

      <!-- Calendar body container -->
      <div id="calendar-content-placeholder" class="relative">
        <!-- Rendered dynamically -->
      </div>
    </div>
  `;

  container.innerHTML = headerHtml;
  lucide.createIcons();

  fetchAndDrawCalendar();
}

// Registrar funciones de la Agenda en el ámbito global window
window.changeCalendarViewMode = function (mode) {
  if (calendarViewMode !== mode && calendarViewMode !== "day") {
    previousCalendarViewMode = calendarViewMode;
  }
  calendarViewMode = mode;
  renderView();
};

window.navigateCalendar = function (direction) {
  if (calendarViewMode === "month") {
    currentCalendarDate.setMonth(currentCalendarDate.getMonth() + direction);
  } else if (calendarViewMode === "week") {
    currentCalendarDate.setDate(currentCalendarDate.getDate() + direction * 7);
  } else if (calendarViewMode === "day") {
    currentCalendarDate.setDate(currentCalendarDate.getDate() + direction);
  }
  renderView();
};

window.goCalendarToday = function () {
  currentCalendarDate = new Date();
  calendarFilters.search = "";
  renderView();
};


window.onCalendarSearchInput = function (val) {
  calendarFilters.search = val;
  drawCalendarBodyOnly();
  showCalendarSuggestions(val);
};

window.onCalendarSearchFocus = function () {
  const input = document.getElementById("search-calendar");
  if (input) showCalendarSuggestions(input.value);
};

window.onCalendarSearchKeydown = function (e) {
  const list = document.getElementById("cal-suggestions-list");
  if (!list || list.classList.contains("hidden")) return;

  const items = list.querySelectorAll(".cal-suggestion-item");
  if (!items.length) return;

  let activeIdx = -1;
  items.forEach((item, i) => {
    if (item.classList.contains("active")) activeIdx = i;
  });

  if (e.key === "ArrowDown") {
    e.preventDefault();
    if (activeIdx >= 0) items[activeIdx].classList.remove("active");
    activeIdx = (activeIdx + 1) % items.length;
    items[activeIdx].classList.add("active");
    items[activeIdx].scrollIntoView({ block: "nearest" });
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    if (activeIdx >= 0) items[activeIdx].classList.remove("active");
    activeIdx = activeIdx <= 0 ? items.length - 1 : activeIdx - 1;
    items[activeIdx].classList.add("active");
    items[activeIdx].scrollIntoView({ block: "nearest" });
  } else if (e.key === "Enter" && activeIdx >= 0) {
    e.preventDefault();
    const selectedText = items[activeIdx].dataset.value;
    const input = document.getElementById("search-calendar");
    if (input) {
      input.value = selectedText;
    }
    calendarFilters.search = selectedText;
    drawCalendarBodyOnly();
    list.classList.add("hidden");
  } else if (e.key === "Escape") {
    list.classList.add("hidden");
  }
};

function showCalendarSuggestions(val) {
  const list = document.getElementById("cal-suggestions-list");
  if (!list) return;

  const query = (val || "").toLowerCase().trim();
  if (!query || query.length < 2) {
    list.classList.add("hidden");
    return;
  }

  // Build unique suggestions from calendarEvents
  const sugSet = new Set();
  (calendarEvents || []).forEach((e) => {
    if (calendarFilters.vigencia === 'vigentes' || calendarFilters.soloVigentes === true) {
      const isVigente = (e.sujeto_pasivo_id && typeof activeSujetoIdsCache !== 'undefined' && activeSujetoIdsCache.has(e.sujeto_pasivo_id)) ||
                        (dashboardDropdownCache.nombresVigentes && e.sujeto_pasivo && dashboardDropdownCache.nombresVigentes.some(n => n.toLowerCase() === e.sujeto_pasivo.toLowerCase()));
      if (!isVigente) return;
    } else if (calendarFilters.vigencia === 'no_vigentes') {
      const isVigente = (e.sujeto_pasivo_id && typeof activeSujetoIdsCache !== 'undefined' && activeSujetoIdsCache.has(e.sujeto_pasivo_id)) ||
                        (dashboardDropdownCache.nombresVigentes && e.sujeto_pasivo && dashboardDropdownCache.nombresVigentes.some(n => n.toLowerCase() === e.sujeto_pasivo.toLowerCase()));
      if (isVigente) return;
    }
    if (e.sujeto_pasivo) sugSet.add(e.sujeto_pasivo);
    if (e.cargo_limpio) sugSet.add(e.cargo_limpio);
    else if (e.cargo) {
      const cl = getCargoClean(e.cargo);
      if (cl) sugSet.add(cl);
    }
    if (e.folio_lobby) sugSet.add(e.folio_lobby);
  });

  const matches = [];
  sugSet.forEach((s) => {
    if (s.toLowerCase().includes(query)) matches.push(s);
  });
  matches.sort((a, b) => a.localeCompare(b, "es"));

  if (matches.length === 0) {
    list.classList.add("hidden");
    return;
  }

  list.innerHTML = matches
    .slice(0, 12)
    .map((m) => {
      const idx = m.toLowerCase().indexOf(query);
      const before = escapeHtml(m.substring(0, idx));
      const match = escapeHtml(m.substring(idx, idx + query.length));
      const after = escapeHtml(m.substring(idx + query.length));
      return (
        '<div class="cal-suggestion-item" data-value="' +
        escapeHtmlAttr(m) +
        '" onclick="selectCalendarSuggestion(this.dataset.value)">' +
        before +
        "<strong>" +
        match +
        "</strong>" +
        after +
        "</div>"
      );
    })
    .join("");
  list.classList.remove("hidden");
}

window.selectCalendarSuggestion = function (val) {
  const input = document.getElementById("search-calendar");
  if (input) {
    input.value = val;
  }
  calendarFilters.search = val;
  drawCalendarBodyOnly();
  const list = document.getElementById("cal-suggestions-list");
  if (list) list.classList.add("hidden");
};

// Close suggestions on click outside
document.addEventListener("click", function (e) {
  const wrapper = document.getElementById("cal-search-wrapper");
  const list = document.getElementById("cal-suggestions-list");
  if (wrapper && list && !wrapper.contains(e.target)) {
    list.classList.add("hidden");
  }
});

window.showAgendaDetailsModal = showAgendaDetailsModal;
window.getCalendarActiveTitle = getCalendarActiveTitle;
window.formatCalendarTitle = getCalendarActiveTitle;

