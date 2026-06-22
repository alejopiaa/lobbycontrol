// Helper para generar HTML de tooltip premium para el sujeto pasivo y su cargo
function renderSujetoPasivoTooltip(nombre, cargo) {
  const displayNombre = nombre || 'Sin Nombre';
  const escapedCargo = escapeHtmlAttr(cargo || 'Sin Cargo Definido');
  
  return `
    <span class="font-semibold text-slate-200 cursor-help border-b border-dashed border-slate-500 hover:text-brand-400 hover:border-brand-400 transition-colors"
          onmouseenter="showGlobalTooltip(event, '${escapedCargo}')"
          onmouseleave="hideGlobalTooltip()">
      ${escapeHtml(displayNombre)}
    </span>
  `;
}

// Generador de controles de paginación
function renderPaginationControls(viewName, totalItems, currentPage, pageSize = 10) {
  const totalPages = Math.ceil(totalItems / pageSize);
  if (totalPages <= 1) return '';

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

  let buttonsHtml = '';
  
  const prevDisabled = currentPage === 1;
  buttonsHtml += `
    <button onclick="${prevDisabled ? '' : `changePage('${viewName}', ${currentPage - 1})`}" 
            class="h-8 w-8 rounded-lg flex items-center justify-center border border-slate-700 bg-slate-900/60 text-slate-200 hover:text-white transition-all ${prevDisabled ? 'opacity-40 cursor-not-allowed' : 'hover:bg-slate-800'}" 
            title="Anterior">
      <i data-lucide="chevron-left" class="h-4 w-4 text-slate-200"></i>
    </button>
  `;

  if (startPage > 1) {
    buttonsHtml += `
      <button onclick="changePage('${viewName}', 1)" class="h-8 px-3 rounded-lg border border-slate-700 bg-slate-900/60 text-slate-200 hover:text-white hover:bg-slate-800 transition-all text-xs font-semibold font-sans">1</button>
    `;
    if (startPage > 2) {
      buttonsHtml += `<span class="text-slate-300 text-xs px-1 font-sans">...</span>`;
    }
  }

  pages.forEach(p => {
    const isCurrent = p === currentPage;
    buttonsHtml += `
      <button onclick="changePage('${viewName}', ${p})" 
              class="h-8 w-8 rounded-lg flex items-center justify-center text-xs font-semibold font-sans transition-all ${
                isCurrent 
                  ? 'bg-brand-600 text-white shadow-md shadow-brand-500/20' 
                  : 'border border-slate-700 bg-slate-900/60 text-slate-200 hover:text-white hover:bg-slate-800'
              }">
        ${p}
      </button>
    `;
  });

  if (endPage < totalPages) {
    if (endPage < totalPages - 1) {
      buttonsHtml += `<span class="text-slate-300 text-xs px-1 font-sans">...</span>`;
    }
    buttonsHtml += `
      <button onclick="changePage('${viewName}', ${totalPages})" class="h-8 px-3 rounded-lg border border-slate-700 bg-slate-900/60 text-slate-200 hover:text-white hover:bg-slate-800 transition-all text-xs font-semibold font-sans">${totalPages}</button>
    `;
  }

  const nextDisabled = currentPage === totalPages;
  buttonsHtml += `
    <button onclick="${nextDisabled ? '' : `changePage('${viewName}', ${currentPage + 1})`}" 
            class="h-8 w-8 rounded-lg flex items-center justify-center border border-slate-700 bg-slate-900/60 text-slate-200 hover:text-white transition-all ${nextDisabled ? 'opacity-40 cursor-not-allowed' : 'hover:bg-slate-800'}" 
            title="Siguiente">
      <i data-lucide="chevron-right" class="h-4 w-4 text-slate-200"></i>
    </button>
  `;

  return `
    <div class="p-4 border-t border-slate-900 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-900/10">
      <div class="text-xs text-slate-300 font-semibold">
        Mostrando <span class="text-white font-bold">${startItem}</span> a <span class="text-white font-bold">${endItem}</span> de <span class="text-white font-bold">${totalItems}</span> registros
      </div>
      <div class="flex items-center gap-1.5 font-sans">
        ${buttonsHtml}
      </div>
    </div>
  `;
}

// RENDER: VISTA DASHBOARD (VISTA INICIAL)
function renderDashboard(container) {
  const stats = calculateDashboardStats(dataStore.dashboardRawData, dashboardFilters);
  


  container.innerHTML = `
    <div class="space-y-4">
      <div class="space-y-1">
        <h2 class="text-2xl font-bold text-white tracking-tight">Dashboard</h2>
      </div>

      <!-- CONTENEDOR FILTROS -->
      ${renderGlassCard(`
        <div class="flex items-center justify-between border-b border-slate-800/60 pb-3">
          <h3 class="text-xs font-bold uppercase tracking-wider text-brand-400 flex items-center gap-2">
            <i data-lucide="sliders-horizontal" class="h-3.5 w-3.5"></i>
            Filtros
          </h3>
          <button onclick="clearDashboardFilters()" class="text-[10px] text-slate-300 hover:text-white transition-colors flex items-center gap-1">
            <i data-lucide="rotate-ccw" class="h-3 w-3"></i> Limpiar Filtros
          </button>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <!-- AÑO -->
          ${renderSearchInput({
            id: 'dashboard-filter-anio',
            fieldName: 'anio',
            label: 'Año',
            placeholder: 'Escribir año...',
            value: dashboardFilters.anio,
            hasSuggestions: true
          })}
          <!-- NOMBRE -->
          ${renderSearchInput({
            id: 'dashboard-filter-nombre',
            fieldName: 'nombre',
            label: 'Nombre',
            placeholder: 'Escribir nombre...',
            value: dashboardFilters.nombre,
            hasSuggestions: true
          })}
          <!-- CARGO -->
          ${renderSearchInput({
            id: 'dashboard-filter-cargo',
            fieldName: 'cargo',
            label: 'Cargo',
            placeholder: !dashboardFilters.nombre ? 'Seleccione nombre primero...' : 'Escribir cargo...',
            value: dashboardFilters.cargo,
            disabled: !dashboardFilters.nombre,
            hasSuggestions: true
          })}
          <!-- FECHA INICIO -->
          ${renderDateInput({
            id: 'dashboard-filter-fechainicio',
            fieldName: 'fechaInicio',
            label: 'Fecha Inicio',
            value: dashboardFilters.fechaInicio,
            min: dashboardFilters.anio ? `${dashboardFilters.anio}-01-01` : '',
            max: dashboardFilters.anio ? `${dashboardFilters.anio}-12-31` : ''
          })}
          <!-- FECHA TÉRMINO -->
          ${renderDateInput({
            id: 'dashboard-filter-fechatermino',
            fieldName: 'fechaTermino',
            label: 'Fecha Término',
            value: dashboardFilters.fechaTermino,
            min: dashboardFilters.anio ? `${dashboardFilters.anio}-01-01` : '',
            max: dashboardFilters.anio ? `${dashboardFilters.anio}-12-31` : ''
          })}
        </div>
      `, 'rounded-2xl p-5 space-y-4 relative z-20')}

      <!-- TRES TARJETAS PRINCIPALES -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- CARD TOTAL SOLICITUDES -->
        <div class="glass-card dashboard-card-interactive stagger-card p-6 rounded-2xl flex flex-col justify-between shadow-sm space-y-4" style="animation-delay: 50ms;">
          <div class="text-center">
            <span class="text-xs text-slate-300 font-bold uppercase tracking-widest">Total Solicitudes</span>
            <h3 class="text-4xl font-extrabold text-heading mt-2" id="count-total-solicitudes">${stats.totales.total}</h3>
            <p class="text-xs text-body-muted font-semibold mt-1">100% Universo</p>
          </div>
          <div class="space-y-1.5">
            <div class="w-full h-3 rounded-full overflow-hidden bg-slate-800 flex">
              <div class="h-full bg-deadline-ok" style="width: ${stats.respondidas.pctTotal}%"></div>
              <div class="h-full bg-deadline-pending" style="width: ${stats.pendientes.pctTotal}%"></div>
            </div>
            <div class="flex justify-between items-center text-[10px] text-body-muted font-semibold">
              <span>${stats.respondidas.pctTotal}% Respondidas (${stats.totales.respondidas})</span>
              <span>${stats.pendientes.pctTotal}% Pendientes (${stats.totales.pendientes})</span>
            </div>
          </div>
        </div>

        <!-- CARD RESPONDIDAS -->
        <div class="glass-card dashboard-card-interactive stagger-card p-6 rounded-2xl flex flex-col justify-between shadow-sm space-y-4" style="animation-delay: 100ms;">
          <div class="text-center">
            <span class="text-xs text-slate-300 font-bold uppercase tracking-widest">Solicitudes Respondidas</span>
            <h3 class="text-4xl font-extrabold text-heading mt-2" id="count-solicitudes-respondidas">${stats.totales.respondidas}</h3>
            <p class="text-xs text-body-muted font-semibold mt-1">${stats.respondidas.pctTotal}%</p>
          </div>
          <div class="space-y-1.5">
            <div class="w-full h-3 rounded-full overflow-hidden bg-slate-800 flex">
              <div class="h-full bg-deadline-ok" style="width: ${stats.respondidas.pctRdp}%"></div>
              <div class="h-full bg-deadline-overdue" style="width: ${stats.respondidas.pctRfp}%"></div>
            </div>
            <div class="flex justify-between items-center text-[10px] text-body-muted font-semibold">
              <span>${stats.respondidas.pctRdp}% RDP (${stats.respondidas.rdp})</span>
              <span>${stats.respondidas.pctRfp}% RFP (${stats.respondidas.rfp})</span>
            </div>
          </div>
        </div>

        <!-- CARD PENDIENTES -->
        <div class="glass-card dashboard-card-interactive stagger-card p-6 rounded-2xl flex flex-col justify-between shadow-sm space-y-4" style="animation-delay: 150ms;">
          <div class="text-center">
            <span class="text-xs text-slate-300 font-bold uppercase tracking-widest">Solicitudes Pendientes</span>
            <h3 class="text-4xl font-extrabold text-heading mt-2" id="count-solicitudes-pendientes">${stats.totales.pendientes}</h3>
            <p class="text-xs text-body-muted font-semibold mt-1">${stats.pendientes.pctTotal}%</p>
          </div>
          <div class="space-y-1.5">
            <div class="w-full h-3 rounded-full overflow-hidden bg-slate-800 flex">
              <div class="h-full bg-deadline-ok" style="width: ${stats.pendientes.pctDdp}%"></div>
              <div class="h-full bg-deadline-overdue" style="width: ${stats.pendientes.pctFdp}%"></div>
            </div>
            <div class="flex justify-between items-center text-[10px] text-body-muted font-semibold">
              <span>${stats.pendientes.pctDdp}% DDP (${stats.pendientes.ddp})</span>
              <span>${stats.pendientes.pctFdp}% FDP (${stats.pendientes.fdp})</span>
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
            <p class="text-xs text-body-muted font-semibold">${stats.estados.aceptada.pct}%</p>
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
            <p class="text-xs text-body-muted font-semibold">${stats.estados.rechazada.pct}%</p>
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
            <p class="text-xs text-body-muted font-semibold">${stats.estados.suspendida.pct}%</p>
          </div>
        </div>

        <!-- CANCELADAS -->
        <div class="glass-card dashboard-card-interactive stagger-card rounded-2xl overflow-hidden flex flex-col justify-between shadow-sm" style="animation-delay: 350ms;">
          <div class="py-2 text-center text-[10px] font-bold tracking-widest uppercase border-b" 
               style="background-color: var(--card-slate-bg); border-color: var(--border-ui); color: var(--card-slate-text);">
            Canceladas
          </div>
          <div class="p-6 text-center space-y-1">
            <h3 class="text-3xl font-bold text-heading" id="count-estado-cancelada">${stats.estados.cancelada.count}</h3>
            <p class="text-xs text-body-muted font-semibold">${stats.estados.cancelada.pct}%</p>
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
            <p class="text-xs text-body-muted font-semibold">${stats.estados.encomendada.pct}%</p>
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
            <p class="text-xs text-body-muted font-semibold">${stats.totales.pctPublicadas}%</p>
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
            <p class="text-xs text-body-muted font-semibold">${stats.totales.pctPendientesPublicacion}%</p>
          </div>
        </div>
      </div>

      <!-- PANEL DE GRÁFICOS ANALÍTICOS Y COMPARATIVOS (GRILLA 2x2) -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <!-- 1. Distribución por Estado -->
        <div class="glass-card p-6 rounded-2xl flex flex-col justify-between shadow-sm min-h-[360px] relative">
          <h4 class="text-xs font-bold uppercase tracking-wider text-brand-500 dark:text-brand-400 mb-4 flex items-center gap-2">
            <i data-lucide="pie-chart" class="h-4 w-4"></i> Distribución por Estado
          </h4>
          <div class="flex-1 flex items-center justify-center">
            <canvas id="chart-distribucion-estados" class="max-h-[260px] w-full"></canvas>
          </div>
        </div>

        <!-- 2. Evolución Mensual Comparativa (Año vs Año Anterior) -->
        <div class="glass-card p-6 rounded-2xl flex flex-col justify-between shadow-sm min-h-[360px] relative">
          <h4 class="text-xs font-bold uppercase tracking-wider text-brand-500 dark:text-brand-400 mb-4 flex items-center gap-2">
            <i data-lucide="trending-up" class="h-4 w-4"></i> Evolución Mensual Interanual
          </h4>
          <div class="flex-1 flex items-center justify-center">
            <canvas id="chart-evolucion-mensual" class="max-h-[260px] w-full"></canvas>
          </div>
        </div>

        <!-- 3. Cumplimiento de Plazos Mensual -->
        <div class="glass-card p-6 rounded-2xl flex flex-col justify-between shadow-sm min-h-[360px] relative">
          <h4 class="text-xs font-bold uppercase tracking-wider text-brand-500 dark:text-brand-400 mb-4 flex items-center gap-2">
            <i data-lucide="bar-chart-3" class="h-4 w-4"></i> Cumplimiento de Plazos (Mensual)
          </h4>
          <div class="flex-1 flex items-center justify-center">
            <canvas id="chart-cumplimiento-plazos" class="max-h-[260px] w-full"></canvas>
          </div>
        </div>

        <!-- 4. Top 5 Sujetos Pasivos con más Solicitudes -->
        <div class="glass-card p-6 rounded-2xl flex flex-col justify-between shadow-sm min-h-[360px] relative">
          <div class="flex items-center justify-between mb-4">
            <h4 class="text-xs font-bold uppercase tracking-wider text-brand-500 dark:text-brand-400 flex items-center gap-2">
              <i data-lucide="award" class="h-4 w-4"></i> Top 5 Autoridades
            </h4>
            <label class="flex items-center gap-1.5 text-[10px] text-slate-300 font-semibold cursor-pointer select-none">
              <input type="checkbox" id="top-autoridades-only-active" checked onchange="toggleTopAutoridadesActive()" class="rounded border-slate-700 bg-slate-900/60 text-brand-600 focus:ring-0 focus:ring-offset-0 h-3.5 w-3.5">
              <span>Solo Vigentes</span>
            </label>
          </div>
          <div class="flex-1 flex items-center justify-center">
            <canvas id="chart-top-autoridades" class="max-h-[260px] w-full"></canvas>
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

  const isServerPaged = dataStore.solicitudes && !Array.isArray(dataStore.solicitudes);
  if (isServerPaged) {
    paginatedItems = dataStore.solicitudes.data || [];
    totalItems = dataStore.solicitudes.totalItems || 0;
  } else {
    let filtered = dataStore.solicitudes || [];
    if (filters.folio) {
      const val = filters.folio.toLowerCase();
      filtered = filtered.filter(item => (item.folio_lobby || '').toLowerCase().includes(val));
    }
    if (filters.nombre) {
      const val = filters.nombre.toLowerCase();
      filtered = filtered.filter(item => (item.sujeto_pasivo || '').toLowerCase().includes(val));
    }
    if (filters.cargo) {
      const val = filters.cargo.toLowerCase();
      filtered = filtered.filter(item => item.cargo && getCargoClean(item.cargo).toLowerCase().includes(val));
    }
    if (filters.sujetoActivoRepresentado) {
      const val = filters.sujetoActivoRepresentado.toLowerCase();
      filtered = filtered.filter(item => 
        (item.sujeto_activo || '').toLowerCase().includes(val) || 
        (item.representado || '').toLowerCase().includes(val) ||
        (item.rut || '').toLowerCase().includes(val)
      );
    }
    if (filters.relacionSujetoActivo || filters.relacionRut || filters.relacionRepresentado) {
      filtered = filtered.filter(item => {
        let match = false;
        if (filters.relacionSujetoActivo && item.sujeto_activo && item.sujeto_activo.toLowerCase() === filters.relacionSujetoActivo.toLowerCase()) {
          match = true;
        }
        if (filters.relacionRut && item.rut && item.rut.toLowerCase() === filters.relacionRut.toLowerCase()) {
          match = true;
        }
        if (filters.relacionRepresentado && filters.relacionRepresentado.toLowerCase() !== 'particular' && item.representado && item.representado.toLowerCase() === filters.relacionRepresentado.toLowerCase()) {
          match = true;
        }
        return match;
      });
    }
    if (filters.estado) {
      const val = filters.estado.toLowerCase();
      filtered = filtered.filter(item => (item.estado || '').toLowerCase() === val);
    }
    totalItems = filtered.length;
    paginatedItems = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  }

  let rowsHtml = '';
  
  if (paginatedItems.length === 0) {
    rowsHtml = `<tr><td colspan="9" class="px-6 py-8 text-center text-xs text-slate-300">No hay registros de solicitudes.</td></tr>`;
  } else {
    paginatedItems.forEach(item => {
      rowsHtml += `
        <tr class="hover:bg-slate-900/40 border-b border-slate-800 transition-colors h-[72px]">
          <td class="pl-6 pr-2 text-xs font-semibold text-slate-100 text-left">${escapeHtml(item.folio_lobby || 'Sin Folio')}</td>
          <td class="px-2 text-xs text-left">
            <div class="font-semibold text-slate-200" title="Fecha Ingreso">${formatDate(item.fecha_ingreso)}</div>
            <div class="text-[10px] text-slate-400 mt-0.5" title="Plazo Legal Límite">
              ${item.fecha_limite_sh ? formatDate(item.fecha_limite_sh) : calculateDeadline(item.fecha_ingreso)}
            </div>
          </td>
          <td class="px-2 text-xs text-slate-300 font-medium text-left">${formatDate(item.fecha_respuesta) || '---'}</td>
          <td class="px-2 text-xs text-slate-300 text-left">${formatDate(item.fecha_agendada) || '---'}</td>
          <td class="px-2 text-xs text-slate-300 text-left">
            <div class="font-medium text-slate-200 w-full truncate" title="${escapeHtmlAttr(normalizeName(item.sujeto_pasivo) || 'Sin Nombre')}">${escapeHtml(normalizeName(item.sujeto_pasivo) || 'Sin Nombre')}</div>
            <div class="text-[10px] text-slate-300 mt-0.5 w-full truncate" title="${escapeHtmlAttr(item.cargo_limpio || getCargoClean(item.cargo))}">${escapeHtml(item.cargo_limpio || getCargoClean(item.cargo))}</div>
          </td>
          <td class="px-2 text-xs text-slate-300 text-left">
            <div class="font-medium text-slate-200 w-full flex items-center justify-between gap-1">
              <span class="truncate" title="${escapeHtmlAttr(item.sujeto_activo || 'Sin Activo')}">${escapeHtml(item.sujeto_activo || 'Sin Activo')}</span>
              ${item.sujeto_activo ? `
                <button onclick="filtrarRelacionados('solicitudes', '${escapeHtmlAttr(item.sujeto_activo)}', '${escapeHtmlAttr(item.rut || '')}', '${escapeHtmlAttr(item.representado || '')}')" 
                        class="text-brand-500 dark:text-brand-400 hover:text-brand-600 dark:hover:text-brand-300 hover:bg-brand-500/10 p-0.5 rounded-lg transition-all shrink-0 cursor-pointer" 
                        title="Filtrar solicitudes relacionadas (mismo RUN, representado y/o sujeto activo)">
                  <i data-lucide="info" class="h-3.5 w-3.5"></i>
                </button>
              ` : ''}
            </div>
            <div class="text-[10px] text-slate-300 mt-0.5 w-full truncate" title="${escapeHtmlAttr(item.representado || 'Particular')}">${escapeHtml(item.representado || 'Particular')}</div>
          </td>
          <td class="px-2 text-left">
            <div class="text-[10.5px] text-slate-300 font-sans leading-normal overflow-hidden" 
                 style="display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; max-height: 2.8em;"
                 title="${escapeHtmlAttr(item.especificacion_materia || item.materia || '')}">
              ${escapeHtml(item.especificacion_materia || item.materia || 'Sin Especificar')}
            </div>
          </td>
          <td class="px-2 text-xs text-left">
            <div class="w-24">
              ${renderStatusBadge(getDeadlineStatusBadge(item.fecha_ingreso, item.fecha_respuesta, item.estado, item))}
            </div>
          </td>
          <td class="pl-2 pr-6 text-left whitespace-nowrap">
            ${item.id_lobby ? `<a href="https://www.leylobby.gob.cl/admin/solicitudes/${item.id_lobby}" target="_blank" class="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-700 hover:bg-emerald-600 text-white transition-all inline-block hover:shadow-md hover:shadow-emerald-900/40 whitespace-nowrap">Ver Solicitud</a>` : '<span class="text-slate-500 text-xs whitespace-nowrap">Sin Enlace</span>'}
          </td>
        </tr>
      `;
    });
  }

  const existingTable = container.querySelector('#table-solicitudes');
  if (existingTable && window.activeInputId) {
    existingTable.querySelector('tbody').innerHTML = rowsHtml;
    const counterEl = container.querySelector('#solicitudes-counter');
    if (counterEl) counterEl.textContent = `${totalItems} registros encontrados`;
    const pagEl = container.querySelector('#solicitudes-pagination-container');
    if (pagEl) pagEl.innerHTML = renderPaginationControls('solicitudes', totalItems, currentPage, pageSize);
    lucide.createIcons();
    return;
  }

  container.innerHTML = `
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div class="space-y-1">
        <h2 class="text-2xl font-bold text-white tracking-tight">Solicitudes</h2>
      </div>
    </div>

    <!-- CONTENEDOR FILTROS -->
    ${renderGlassCard(`
      <div class="flex items-center justify-between border-b border-slate-800/60 pb-3">
        <h3 class="text-xs font-bold uppercase tracking-wider text-brand-400 flex items-center gap-2">
          <i data-lucide="sliders-horizontal" class="h-3.5 w-3.5"></i>
          Filtros
        </h3>
        <button onclick="clearFilters('solicitudes')" class="text-[10px] text-slate-300 hover:text-white transition-colors flex items-center gap-1">
          <i data-lucide="rotate-ccw" class="h-3 w-3"></i> Limpiar Filtros
        </button>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <!-- FOLIO -->
        ${renderSearchInput({
          id: 'filter-solicitudes-folio',
          fieldName: 'folio',
          label: 'Folio',
          placeholder: 'Buscar folio...',
          value: filters.folio,
          icon: 'hash'
        })}
        <!-- NOMBRE -->
        ${renderSearchInput({
          id: 'solicitudes-filter-nombre',
          fieldName: 'nombre',
          label: 'Nombre Sujeto Pasivo',
          placeholder: 'Escribir nombre...',
          value: filters.nombre,
          icon: 'user',
          hasSuggestions: true
        })}
        <!-- CARGO -->
        ${renderSearchInput({
          id: 'solicitudes-filter-cargo',
          fieldName: 'cargo',
          label: 'Cargo',
          placeholder: !filters.nombre ? 'Seleccione nombre primero...' : 'Escribir cargo...',
          value: filters.cargo,
          icon: 'user',
          disabled: !filters.nombre,
          hasSuggestions: true
        })}
        <!-- SUJETO ACTIVO / REPRESENTADO -->
        ${renderSearchInput({
          id: 'solicitudes-filter-sujetoActivoRepresentado',
          fieldName: 'sujetoActivoRepresentado',
          label: 'Sujeto Activo / Representado',
          placeholder: 'Lobbista o gestor de interés...',
          value: filters.sujetoActivoRepresentado,
          icon: 'users',
          hasSuggestions: true
        })}
        <!-- ESTADO -->
        ${renderSelectInput({
          id: 'filter-solicitudes-estado',
          fieldName: 'estado',
          label: 'Estado',
          value: filters.estado,
          optionsList: [
            { value: '', text: 'Todos los Estados' },
            { value: 'Ingresada', text: 'Ingresada' },
            { value: 'Aceptada', text: 'Aceptada' },
            { value: 'Rechazada', text: 'Rechazada' },
            { value: 'Suspendida', text: 'Suspendida' },
            { value: 'Cancelada', text: 'Cancelada' },
            { value: 'Encomendada', text: 'Encomendada' }
          ]
        })}
      </div>
    `, 'rounded-2xl p-5 space-y-4 relative z-20')}

    <!-- BANNER DE RELACIÓN ACTIVO -->
    ${filters.relacionSujetoActivo || filters.relacionRut || filters.relacionRepresentado ? `
      <div class="mb-4 p-4 rounded-2xl bg-brand-50 dark:bg-brand-500/10 border border-brand-200/80 dark:border-brand-500/25 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-brand-900 dark:text-brand-200 relative overflow-hidden glass-card">
        <div class="flex items-center gap-3">
          <div class="p-2 rounded-xl bg-brand-100 dark:bg-brand-500/20 text-brand-600 dark:text-brand-400 border border-brand-200 dark:border-brand-500/30">
            <i data-lucide="info" class="h-4 w-4"></i>
          </div>
          <div>
            <div class="font-bold text-brand-950 dark:text-white uppercase tracking-wider text-[10px] mb-0.5">Filtrando Solicitudes Relacionadas</div>
            <div class="font-medium text-slate-700 dark:text-slate-300">
              Mostrando registros de sujeto activo <strong class="text-brand-950 dark:text-white">${escapeHtml(filters.relacionSujetoActivo || '---')}</strong>
              ${filters.relacionRut ? ` (RUN: <strong class="text-brand-950 dark:text-white font-mono">${escapeHtml(filters.relacionRut)}</strong>)` : ''}
              ${filters.relacionRepresentado ? ` y/o representado <strong class="text-brand-950 dark:text-white">${escapeHtml(filters.relacionRepresentado)}</strong>` : ''}
            </div>
          </div>
        </div>
        <button onclick="clearRelacionFilter('solicitudes')" class="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl font-bold transition-all hover:shadow-lg hover:shadow-brand-500/20 whitespace-nowrap shrink-0 text-xs cursor-pointer">
          Limpiar Filtro
        </button>
      </div>
    ` : ''}

    <!-- TABLA -->
    <div class="rounded-2xl overflow-hidden mt-4 border border-slate-700/40 glass-card">
      <div class="p-4 border-b border-slate-800/80 flex justify-between items-center">
        <div class="text-xs text-slate-300" id="solicitudes-counter">${totalItems} registros encontrados</div>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full text-left border-collapse table-fixed" id="table-solicitudes">
          <thead>
            <tr class="bg-slate-800/30 border-b border-slate-700/60 text-slate-400 text-[10px] uppercase font-bold tracking-widest">
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
        ${renderPaginationControls('solicitudes', totalItems, currentPage, pageSize)}
      </div>
    </div>
  `;
}

// RENDER: VISTA PUBLICADAS PH
function renderPublicadas(container) {
  const filters = paginationState.publicadas.filters;
  const subTab = paginationState.publicadas.subTab || 'historial';
  let paginatedItems = [];
  let totalItems = 0;
  const currentPage = paginationState.publicadas.page;
  const pageSize = 10;

  if (subTab === 'historial') {
    const isServerPaged = dataStore.publicadas && !Array.isArray(dataStore.publicadas);
    if (isServerPaged) {
      paginatedItems = dataStore.publicadas.data || [];
      totalItems = dataStore.publicadas.totalItems || 0;
    } else {
      let filtered = dataStore.publicadas || [];
      if (filters.folio) {
        const val = filters.folio.toLowerCase();
        filtered = filtered.filter(item => (item.folio_lobby || '').toLowerCase().includes(val));
      }
      if (filters.nombre) {
        const val = filters.nombre.toLowerCase();
        filtered = filtered.filter(item => (item.sujeto_pasivo || '').toLowerCase().includes(val));
      }
      if (filters.cargo) {
        const val = filters.cargo.toLowerCase();
        filtered = filtered.filter(item => item.cargo && getCargoClean(item.cargo).toLowerCase().includes(val));
      }
      if (filters.sujetoActivoRepresentado) {
        const val = filters.sujetoActivoRepresentado.toLowerCase();
        filtered = filtered.filter(item => 
          (item.sujeto_activo || '').toLowerCase().includes(val) || 
          (item.representado || '').toLowerCase().includes(val) ||
          (item.rut || '').toLowerCase().includes(val)
        );
      }
      if (filters.relacionSujetoActivo || filters.relacionRut || filters.relacionRepresentado) {
        filtered = filtered.filter(item => {
          let match = false;
          if (filters.relacionSujetoActivo && item.sujeto_activo && item.sujeto_activo.toLowerCase() === filters.relacionSujetoActivo.toLowerCase()) {
            match = true;
          }
          if (filters.relacionRut && item.rut && item.rut.toLowerCase() === filters.relacionRut.toLowerCase()) {
            match = true;
          }
          if (filters.relacionRepresentado && filters.relacionRepresentado.toLowerCase() !== 'particular' && item.representado && item.representado.toLowerCase() === filters.relacionRepresentado.toLowerCase()) {
            match = true;
          }
          return match;
        });
      }
      if (filters.estado) {
        const val = filters.estado.toLowerCase();
        filtered = filtered.filter(item => {
          const isItemFuera = (item.cumplimiento || '').toLowerCase().includes('fuera');
          const itemEstadoNormalized = isItemFuera ? 'fuera de plazo' : 'en plazo';
          return itemEstadoNormalized === val;
        });
      }
      totalItems = filtered.length;
      paginatedItems = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
    }
  } else {
    // subTab === 'pendientes'
    const isServerPaged = dataStore.solicitudesPendientesPublicacion && !Array.isArray(dataStore.solicitudesPendientesPublicacion);
    if (isServerPaged) {
      paginatedItems = dataStore.solicitudesPendientesPublicacion.data || [];
      totalItems = dataStore.solicitudesPendientesPublicacion.totalItems || 0;
    } else {
      const publicadosFolios = new Set((dataStore.publicadas || []).map(p => p.folio_lobby).filter(Boolean));
      let filtered = (dataStore.solicitudes || []).filter(item => {
        if (item.estado !== 'Aceptada') return false;
        if (!item.fecha_agendada) return false;
        if (publicadosFolios.has(item.folio_lobby)) return false;
        return true;
      });

      if (filters.folio) {
        const val = filters.folio.toLowerCase();
        filtered = filtered.filter(item => (item.folio_lobby || '').toLowerCase().includes(val));
      }
      if (filters.nombre) {
        const val = filters.nombre.toLowerCase();
        filtered = filtered.filter(item => (item.sujeto_pasivo || '').toLowerCase().includes(val));
      }
      if (filters.cargo) {
        const val = filters.cargo.toLowerCase();
        filtered = filtered.filter(item => (item.cargo_limpio || (item.cargo && getCargoClean(item.cargo))).toLowerCase().includes(val));
      }
      if (filters.sujetoActivoRepresentado) {
        const val = filters.sujetoActivoRepresentado.toLowerCase();
        filtered = filtered.filter(item => 
          (item.sujeto_activo || '').toLowerCase().includes(val) || 
          (item.representado || '').toLowerCase().includes(val) ||
          (item.rut || '').toLowerCase().includes(val)
        );
      }
      if (filters.relacionSujetoActivo || filters.relacionRut || filters.relacionRepresentado) {
        filtered = filtered.filter(item => {
          let match = false;
          if (filters.relacionSujetoActivo && item.sujeto_activo && item.sujeto_activo.toLowerCase() === filters.relacionSujetoActivo.toLowerCase()) {
            match = true;
          }
          if (filters.relacionRut && item.rut && item.rut.toLowerCase() === filters.relacionRut.toLowerCase()) {
            match = true;
          }
          if (filters.relacionRepresentado && filters.relacionRepresentado.toLowerCase() !== 'particular' && item.representado && item.representado.toLowerCase() === filters.relacionRepresentado.toLowerCase()) {
            match = true;
          }
          return match;
        });
      }
      if (filters.estado) {
        const val = filters.estado.toLowerCase();
        filtered = filtered.filter(item => {
          const delayInfo = getPendingPublicationDelay(item.fecha_agendada, item);
          const isFuera = delayInfo.days > 0;
          const itemEstadoNormalized = isFuera ? 'fuera de plazo' : 'en plazo';
          return itemEstadoNormalized === val;
        });
      }
      totalItems = filtered.length;
      paginatedItems = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
    }
  }

  let rowsHtml = '';
  
  if (subTab === 'historial') {
    if (paginatedItems.length === 0) {
      rowsHtml = `<tr><td colspan="7" class="px-3 py-8 text-center text-xs text-slate-300">No hay registros de audiencias publicadas.</td></tr>`;
    } else {
      paginatedItems.forEach(item => {
        const dateTimeParts = item.fecha_inicio ? item.fecha_inicio.split(' ') : [];
        const formattedDate = dateTimeParts[0] ? formatDate(dateTimeParts[0]) : '-';
        const timePart = dateTimeParts[1] ? dateTimeParts[1].substring(0, 5) : '';
        const displayDateTime = timePart ? `${formattedDate} ${timePart}` : formattedDate;

        const isFuera = (item.cumplimiento || '').toLowerCase().includes('fuera');
        const badgeClass = isFuera ? 'badge-status-vencido' : 'badge-status-enplazo';
        const displayCumplimiento = item.cumplimiento || 'En plazo';

        rowsHtml += `
          <tr class="hover:bg-slate-900/40 border-b border-slate-800 transition-colors h-[72px]">
            <td class="pl-6 pr-2 text-xs font-semibold text-slate-100 text-left">${escapeHtml(item.folio_lobby || 'Sin Folio')}</td>
            <td class="px-2 text-xs text-slate-300 text-left">
              <div class="font-medium text-slate-200 w-full truncate">${displayDateTime}</div>
              <div class="text-[10px] text-slate-300 mt-0.5 w-full truncate">${escapeHtml(item.forma || 'Presencial')}</div>
            </td>
            <td class="px-2 text-xs text-slate-300 text-left">
              <div class="font-medium text-slate-200 w-full truncate" title="${escapeHtmlAttr(normalizeName(item.sujeto_pasivo) || 'Sin Nombre')}">${escapeHtml(normalizeName(item.sujeto_pasivo) || 'Sin Nombre')}</div>
              <div class="text-[10px] text-slate-300 mt-0.5 w-full truncate" title="${escapeHtmlAttr(getCargoClean(item.cargo))}">${escapeHtml(getCargoClean(item.cargo))}</div>
            </td>
            <td class="px-2 text-xs text-slate-300 text-left">
              <div class="font-medium text-slate-200 w-full flex items-center justify-between gap-1">
                <span class="truncate" title="${escapeHtmlAttr(item.sujeto_activo || 'Sin Activo')}">${escapeHtml(item.sujeto_activo || 'Sin Activo')}</span>
                ${item.sujeto_activo ? `
                  <button onclick="filtrarRelacionados('publicadas', '${escapeHtmlAttr(item.sujeto_activo)}', '${escapeHtmlAttr(item.rut || '')}', '${escapeHtmlAttr(item.representado || '')}')" 
                          class="text-brand-500 dark:text-brand-400 hover:text-brand-600 dark:hover:text-brand-300 hover:bg-brand-500/10 p-0.5 rounded-lg transition-all shrink-0 cursor-pointer" 
                          title="Filtrar audiencias relacionadas (mismo RUN, representado y/o sujeto activo)">
                    <i data-lucide="info" class="h-3.5 w-3.5"></i>
                  </button>
                ` : ''}
              </div>
              <div class="text-[10px] text-slate-300 mt-0.5 w-full truncate" title="${escapeHtmlAttr(item.representado || 'Particular')}">${escapeHtml(item.representado || 'Particular')}</div>
            </td>
            <td class="px-2 text-xs text-slate-300 text-left"><div class="w-full truncate" title="${escapeHtmlAttr(item.especificacion_materia || item.materia || '')}">${escapeHtml(item.especificacion_materia || item.materia || 'Sin Especificar')}</div></td>
            <td class="px-2 text-xs text-slate-300 text-left">
              <div class="font-semibold text-slate-200">${formatDate(item.fecha_publicacion)}</div>
              <div class="mt-1">
                <span class="px-2 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap ${badgeClass}">${displayCumplimiento}</span>
              </div>
            </td>
            <td class="pl-2 pr-6 text-left whitespace-nowrap">
              ${item.id_solicitud_lobby
                ? `<a href="https://www.leylobby.gob.cl/admin/solicitudes/${escapeHtmlAttr(item.id_solicitud_lobby)}" target="_blank" class="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-700 hover:bg-emerald-600 text-white transition-all inline-block hover:shadow-md hover:shadow-emerald-900/40 whitespace-nowrap">Ver Solicitud</a>`
                : '<span class="text-slate-500 text-xs whitespace-nowrap">Sin Solicitud</span>'
              }
            </td>
          </tr>
        `;
      });
    }
  } else {
    // subTab === 'pendientes'
    if (paginatedItems.length === 0) {
      rowsHtml = `<tr><td colspan="7" class="px-3 py-8 text-center text-xs text-slate-300">No hay solicitudes aceptadas pendientes de publicación.</td></tr>`;
    } else {
      paginatedItems.forEach(item => {
        const delayInfo = getPendingPublicationDelay(item.fecha_agendada, item);

        rowsHtml += `
          <tr class="hover:bg-slate-900/40 border-b border-slate-800 transition-colors h-[72px]">
            <td class="pl-6 pr-2 py-4 align-middle text-xs font-semibold text-slate-100">${escapeHtml(item.folio_lobby || 'Sin Folio')}</td>
            <td class="px-2 py-4 align-middle text-xs text-slate-300">
              <div class="font-medium text-slate-200 w-full truncate">${formatDate(item.fecha_agendada)}</div>
              <div class="text-[10px] text-slate-300 mt-0.5 w-full truncate">${escapeHtml(item.forma || 'Presencial')}</div>
            </td>
            <td class="px-2 py-4 align-middle text-xs text-slate-300">
              <div class="font-medium text-slate-200 w-full truncate" title="${escapeHtmlAttr(normalizeName(item.sujeto_pasivo) || 'Sin Nombre')}">${escapeHtml(normalizeName(item.sujeto_pasivo) || 'Sin Nombre')}</div>
              <div class="text-[10px] text-slate-300 mt-0.5 w-full truncate" title="${escapeHtmlAttr(item.cargo_limpio || getCargoClean(item.cargo))}">${escapeHtml(item.cargo_limpio || getCargoClean(item.cargo))}</div>
            </td>
            <td class="px-2 py-4 align-middle text-xs text-slate-300">
              <div class="font-medium text-slate-200 w-full flex items-center justify-between gap-1">
                <span class="truncate" title="${escapeHtmlAttr(item.sujeto_activo || 'Sin Activo')}">${escapeHtml(item.sujeto_activo || 'Sin Activo')}</span>
                ${item.sujeto_activo ? `
                  <button onclick="filtrarRelacionados('publicadas', '${escapeHtmlAttr(item.sujeto_activo)}', '${escapeHtmlAttr(item.rut || '')}', '${escapeHtmlAttr(item.representado || '')}')" 
                          class="text-brand-500 dark:text-brand-400 hover:text-brand-600 dark:hover:text-brand-300 hover:bg-brand-500/10 p-0.5 rounded-lg transition-all shrink-0 cursor-pointer" 
                          title="Filtrar solicitudes relacionadas (mismo RUN, representado y/o sujeto activo)">
                    <i data-lucide="info" class="h-3.5 w-3.5"></i>
                  </button>
                ` : ''}
              </div>
              <div class="text-[10px] text-slate-300 mt-0.5 w-full truncate" title="${escapeHtmlAttr(item.representado || 'Particular')}">${escapeHtml(item.representado || 'Particular')}</div>
            </td>
            <td class="px-2 py-4 align-middle text-xs text-slate-300">
              <div class="font-semibold text-slate-200">${escapeHtml(delayInfo.deadlineStr)}</div>
              <div class="text-[9px] text-slate-400 mt-0.5">Último día hábil</div>
            </td>
            <td class="px-2 py-4 align-middle text-xs text-slate-300">
              <span class="px-2 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap ${delayInfo.badgeClass}">${escapeHtml(delayInfo.text)}</span>
            </td>
            <td class="pl-2 pr-6 py-4 align-middle text-left whitespace-nowrap">
              ${item.id_lobby ? `<a href="https://www.leylobby.gob.cl/admin/solicitudes/${escapeHtmlAttr(item.id_lobby)}" target="_blank" class="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-700 hover:bg-emerald-600 text-white transition-all inline-block hover:shadow-md hover:shadow-emerald-900/40 whitespace-nowrap">Ver Solicitud</a>` : '<span class="text-slate-500 text-xs whitespace-nowrap">Sin Enlace</span>'}
            </td>
          </tr>
        `;
      });
    }
  }

  const existingTable = container.querySelector('#table-publicadas');
  if (existingTable && existingTable.dataset.subtab === subTab && window.activeInputId) {
    existingTable.querySelector('tbody').innerHTML = rowsHtml;
    const counterEl = container.querySelector('#publicadas-counter');
    if (counterEl) {
      counterEl.textContent = subTab === 'historial' 
        ? `${totalItems} registros publicados encontrados` 
        : `${totalItems} solicitudes pendientes de publicación encontradas`;
    }
    const pagEl = container.querySelector('#publicadas-pagination-container');
    if (pagEl) pagEl.innerHTML = renderPaginationControls('publicadas', totalItems, currentPage, pageSize);
    lucide.createIcons();
    return;
  }

  container.innerHTML = `
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div class="space-y-1">
        <h2 class="text-2xl font-bold text-white tracking-tight">Audiencias</h2>
      </div>
    </div>

    <!-- SELECCIÓN DE SUB-PESTAÑA -->
    <div class="flex gap-2 border-b border-slate-800/80 pb-2 mt-4">
      <button onclick="changePublicadasSubTab('historial')" class="px-4 py-2 text-xs font-semibold rounded-xl transition-all ${
        subTab === 'historial' 
          ? 'bg-brand-600 text-white shadow-md shadow-brand-500/20' 
          : 'text-slate-300 hover:text-white hover:bg-slate-800/40'
      }">
        Historial Publicadas
      </button>
      <button onclick="changePublicadasSubTab('pendientes')" class="px-4 py-2 text-xs font-semibold rounded-xl transition-all ${
        subTab === 'pendientes' 
          ? 'bg-brand-600 text-white shadow-md shadow-brand-500/20' 
          : 'text-slate-300 hover:text-white hover:bg-slate-800/40'
      }">
        Pendientes de Publicación
      </button>
    </div>

    <!-- CONTENEDOR FILTROS -->
    ${renderGlassCard(`
      <div class="flex items-center justify-between border-b border-slate-800/60 pb-3">
        <h3 class="text-xs font-bold uppercase tracking-wider text-brand-400 flex items-center gap-2">
          <i data-lucide="sliders-horizontal" class="h-3.5 w-3.5"></i>
          Filtros
        </h3>
        <button onclick="clearFilters('publicadas')" class="text-[10px] text-slate-300 hover:text-white transition-colors flex items-center gap-1">
          <i data-lucide="rotate-ccw" class="h-3 w-3"></i> Limpiar Filtros
        </button>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <!-- FOLIO -->
        ${renderSearchInput({
          id: 'filter-publicadas-folio',
          fieldName: 'folio',
          label: 'Folio',
          placeholder: 'Buscar folio...',
          value: filters.folio,
          icon: 'hash'
        })}
        <!-- NOMBRE -->
        ${renderSearchInput({
          id: 'publicadas-filter-nombre',
          fieldName: 'nombre',
          label: 'Nombre Sujeto Pasivo',
          placeholder: 'Escribir nombre...',
          value: filters.nombre,
          icon: 'user',
          hasSuggestions: true
        })}
        <!-- CARGO -->
        ${renderSearchInput({
          id: 'publicadas-filter-cargo',
          fieldName: 'cargo',
          label: 'Cargo',
          placeholder: !filters.nombre ? 'Seleccione nombre primero...' : 'Escribir cargo...',
          value: filters.cargo,
          icon: 'user',
          disabled: !filters.nombre,
          hasSuggestions: true
        })}
        <!-- SUJETO ACTIVO / REPRESENTADO -->
        ${renderSearchInput({
          id: 'publicadas-filter-sujetoActivoRepresentado',
          fieldName: 'sujetoActivoRepresentado',
          label: 'Sujeto Activo / Representado',
          placeholder: 'Lobbista, gestor de interés o RUT...',
          value: filters.sujetoActivoRepresentado,
          icon: 'users',
          hasSuggestions: true
        })}
        <!-- ESTADO -->
        ${renderSelectInput({
          id: 'filter-publicadas-estado',
          fieldName: 'estado',
          label: 'Estado de Cumplimiento',
          value: filters.estado,
          optionsList: [
            { value: '', text: 'Todos los Estados' },
            { value: 'en plazo', text: 'En plazo' },
            { value: 'fuera de plazo', text: 'Fuera de plazo' }
          ]
        })}
      </div>
    `, 'rounded-2xl p-5 space-y-4 relative z-20')}

    <!-- BANNER DE RELACIÓN ACTIVO -->
    ${filters.relacionSujetoActivo || filters.relacionRut || filters.relacionRepresentado ? `
      <div class="mb-4 p-4 rounded-2xl bg-brand-50 dark:bg-brand-500/10 border border-brand-200/80 dark:border-brand-500/25 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-brand-900 dark:text-brand-200 relative overflow-hidden glass-card">
        <div class="flex items-center gap-3">
          <div class="p-2 rounded-xl bg-brand-100 dark:bg-brand-500/20 text-brand-600 dark:text-brand-400 border border-brand-200 dark:border-brand-500/30">
            <i data-lucide="info" class="h-4 w-4"></i>
          </div>
          <div>
            <div class="font-bold text-brand-950 dark:text-white uppercase tracking-wider text-[10px] mb-0.5">Filtrando Audiencias Relacionadas</div>
            <div class="font-medium text-slate-700 dark:text-slate-300">
              Mostrando registros de sujeto activo <strong class="text-brand-950 dark:text-white">${escapeHtml(filters.relacionSujetoActivo || '---')}</strong>
              ${filters.relacionRut ? ` (RUN: <strong class="text-brand-950 dark:text-white font-mono">${escapeHtml(filters.relacionRut)}</strong>)` : ''}
              ${filters.relacionRepresentado ? ` y/o representado <strong class="text-brand-950 dark:text-white">${escapeHtml(filters.relacionRepresentado)}</strong>` : ''}
            </div>
          </div>
        </div>
        <button onclick="clearRelacionFilter('publicadas')" class="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl font-bold transition-all hover:shadow-lg hover:shadow-brand-500/20 whitespace-nowrap shrink-0 text-xs cursor-pointer">
          Limpiar Filtro
        </button>
      </div>
    ` : ''}

    <!-- TABLA -->
    <div class="rounded-2xl overflow-hidden mt-4 border border-slate-700/40 glass-card">
      <div class="p-4 border-b border-slate-800/80 flex justify-between items-center">
        <div class="text-xs text-slate-300" id="publicadas-counter">
          ${subTab === 'historial' 
            ? `${totalItems} registros publicados encontrados` 
            : `${totalItems} solicitudes pendientes de publicación encontradas`
          }
        </div>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full text-left border-collapse table-fixed" id="table-publicadas" data-subtab="${subTab}">
          <thead>
            ${subTab === 'historial' ? `
              <tr class="bg-slate-800/30 border-b border-slate-700/60 text-slate-400 text-[10px] uppercase font-bold tracking-widest">
                <th class="pl-6 pr-2 py-3 w-36 text-left">Folio</th>
                <th class="px-2 py-3 w-28 text-left">Fecha / Forma</th>
                <th class="px-2 py-3 w-44 text-left">Sujeto Pasivo</th>
                <th class="px-2 py-3 w-44 text-left">Sujeto Activo</th>
                <th class="px-2 py-3 w-48 text-left">Materia</th>
                <th class="px-2 py-3 w-36 text-left">Publicación / Estado</th>
                <th class="pl-2 pr-6 py-3 w-32 text-left whitespace-nowrap">Acción</th>
              </tr>
            ` : `
              <tr class="bg-slate-800/30 border-b border-slate-700/60 text-slate-400 text-[10px] uppercase font-bold tracking-widest">
                <th class="pl-6 pr-2 py-3 w-40 text-left">Folio</th>
                <th class="px-2 py-3 w-36 text-left">Fecha Agendada</th>
                <th class="px-2 py-3 w-56 text-left">Sujeto Pasivo</th>
                <th class="px-2 py-3 w-56 text-left">Sujeto Activo / Representado</th>
                <th class="px-2 py-3 w-40 text-left">Plazo Máximo</th>
                <th class="px-2 py-3 w-32 text-left">Estado</th>
                <th class="pl-2 pr-6 py-3 w-32 text-left whitespace-nowrap">Acción</th>
              </tr>
            `}
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </div>
      <div id="publicadas-pagination-container">
        ${renderPaginationControls('publicadas', totalItems, currentPage, pageSize)}
      </div>
    </div>
  `;
}

// RENDER: VISTA SUJETOS PASIVOS SPH
function renderSujetosPasivos(container) {
  const search = paginationState.sujetos_pasivos.search.toLowerCase();
  let filtered = dataStore.sujetos_pasivos;
  if (search) {
    filtered = filtered.filter(item => {
      const nombre = (item.nombre || '').toLowerCase();
      const rut = (item.rut || '').toLowerCase();
      const cargo = (item.cargo || '').toLowerCase();
      const tipo = (item.tipo || '').toLowerCase();
      return nombre.includes(search) || rut.includes(search) || cargo.includes(search) || tipo.includes(search);
    });
  }

  const totalItems = filtered.length;
  const currentPage = paginationState.sujetos_pasivos.page;
  const pageSize = 10;
  const paginatedItems = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  let rowsHtml = '';
  
  if (paginatedItems.length === 0) {
    rowsHtml = `<tr><td colspan="6" class="px-3 py-8 text-center text-xs text-slate-300">No hay registros de sujetos pasivos.</td></tr>`;
  } else {
    paginatedItems.forEach(item => {
      rowsHtml += `
        <tr class="hover:bg-slate-900/40 border-b border-slate-800 transition-colors h-[72px]">
          <td class="pl-6 pr-2 text-xs font-semibold text-slate-200"><div class="w-full truncate" title="${escapeHtmlAttr(item.nombre)}">${escapeHtml(item.nombre)}</div></td>
          <td class="px-2 text-xs text-slate-300 font-mono"><div class="w-full truncate">${escapeHtml(item.rut || 'No definido')}</div></td>
          <td class="px-2 text-xs text-slate-300 font-medium"><div class="w-full truncate" title="${escapeHtmlAttr(getCargoClean(item.cargo))}">${escapeHtml(getCargoClean(item.cargo))}</div></td>
          <td class="px-2 text-xs text-slate-300"><div class="w-full truncate">${escapeHtml(item.tipo || 'Autoridad')}</div></td>
          <td class="px-2 text-xs text-slate-300"><div class="w-full truncate">${escapeHtml(item.zona || 'Metropolitana')}</div></td>
          <td class="pl-2 pr-6 text-xs text-slate-300">
            <div class="text-xs text-slate-300 w-full truncate">${formatDate(item.fecha_incorporacion)}</div>
            ${item.fecha_termino ? `<div class="text-[10px] text-rose-300 w-full truncate">Término: ${formatDate(item.fecha_termino)}</div>` : '<div class="text-[10px] text-emerald-300 font-medium w-full truncate">Vigente</div>'}
          </td>
        </tr>
      `;
    });
  }

  const existingTable = container.querySelector('#table-sujetos');
  if (existingTable && window.activeInputId) {
    existingTable.querySelector('tbody').innerHTML = rowsHtml;
    const counterEl = container.querySelector('#sujetos-counter');
    if (counterEl) counterEl.textContent = `Mostrando ${totalItems} registros en total`;
    const pagEl = container.querySelector('#sujetos-pagination-container');
    if (pagEl) pagEl.innerHTML = renderPaginationControls('sujetos_pasivos', totalItems, currentPage, pageSize);
    lucide.createIcons();
    return;
  }

  container.innerHTML = `
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div class="space-y-1">
        <h2 class="text-2xl font-bold text-white tracking-tight">Sujetos Pasivos</h2>
      </div>
    </div>

    <!-- CONTENEDOR FILTROS Y TABLA -->
    <div class="rounded-2xl overflow-hidden mt-4 border border-slate-700/40 glass-card">
      <div class="p-4 border-b border-slate-800/80 flex flex-col md:flex-row gap-3 items-center justify-between">
        <div class="w-full md:w-80">
          ${renderSearchInput({
            id: 'search-sujetos',
            fieldName: 'search',
            placeholder: 'Buscar por Nombre, RUT o Cargo...',
            value: paginationState.sujetos_pasivos.search,
            icon: 'search'
          })}
        </div>
        <div class="text-xs text-slate-300" id="sujetos-counter">Mostrando ${totalItems} registros en total</div>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full text-left border-collapse table-fixed" id="table-sujetos">
          <thead>
            <tr class="bg-slate-800/30 border-b border-slate-700/60 text-slate-400 text-[10px] uppercase font-bold tracking-widest">
              <th class="pl-6 pr-2 py-3 w-56 text-left">Nombre Completo</th>
              <th class="px-2 py-3 w-28 text-left">RUT</th>
              <th class="px-2 py-3 w-64 text-left">Cargo Municipal</th>
              <th class="px-2 py-3 w-28 text-left">Tipo</th>
              <th class="px-2 py-3 w-28 text-left">Zona</th>
              <th class="pl-2 pr-6 py-3 w-40 text-left">Fechas de Gestión</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </div>
      <div id="sujetos-pagination-container">
        ${renderPaginationControls('sujetos_pasivos', totalItems, currentPage, pageSize)}
      </div>
    </div>
  `;
}

function changeAdminTab(tabName) {
  activeAdminTab = tabName;
  const container = document.getElementById('main-content');
  if (container) {
    renderUsuarios(container);
  }
}

function renderHistoryList() {
  const list = dataStore.syncHistory || [];
  if (list.length === 0) {
    return `<p class="text-center text-[10px] text-slate-500 py-4">No se registran sincronizaciones previas.</p>`;
  }
  
  return list.map(item => {
    let badgeClass = 'badge-status-normal';
    if (item.estado === 'Exitoso') {
      badgeClass = 'badge-status-enplazo';
    } else if (item.estado === 'Fallido') {
      badgeClass = 'badge-status-vencido';
    } else if (item.estado === 'Cancelado') {
      badgeClass = 'badge-status-otros';
    }

    let dateStr = item.timestamp;
    try {
      const d = new Date(item.timestamp.replace(' ', 'T') + 'Z');
      dateStr = d.toLocaleString('es-CL', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });
    } catch(e) {}

    let detailStr = '';
    try {
      const statsObj = JSON.parse(item.detalles);
      const ins = (statsObj.sh?.inserts || 0) + (statsObj.ph?.inserts || 0) + (statsObj.sph?.inserts || 0);
      const upd = (statsObj.sh?.updates || 0) + (statsObj.ph?.updates || 0) + (statsObj.sph?.updates || 0);
      const del = (statsObj.sh?.deletes || 0) + (statsObj.ph?.deletes || 0) + (statsObj.sph?.deletes || 0);
      detailStr = `${ins} creados, ${upd} act., ${del} elim.`;
    } catch(e) {
      detailStr = item.detalles || '';
    }

    return `
      <div class="p-2.5 rounded-xl border text-[11px] space-y-1.5 hover:border-slate-300 dark:hover:border-slate-700 transition-colors" style="background-color: var(--bg-main); border-color: var(--border-ui);">
        <div class="flex justify-between items-center gap-2">
          <span class="font-bold text-heading">${dateStr}</span>
          <span class="px-1.5 py-0.5 rounded-md text-[9px] font-semibold ${badgeClass}">${item.estado}</span>
        </div>
        <div class="text-[10px] text-body-muted font-medium truncate" title="${item.usuario}">${item.usuario}</div>
        <div class="text-[10px] text-heading font-mono leading-tight whitespace-normal break-words">${detailStr}</div>
      </div>
    `;
  }).join('');
}

function generateUsuarioRowHtml(item) {
  const names = (item.nombre || '').trim().split(/\s+/);
  let initials = 'U';
  if (names.length >= 2) {
    initials = (names[0][0] + names[names.length - 1][0]).toUpperCase();
  } else if (names.length === 1 && names[0]) {
    initials = names[0].substring(0, 2).toUpperCase();
  }

  const colors = [
    'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
    'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
    'bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/20',
    'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20'
  ];
  let hash = 0;
  const nameStr = item.nombre || '';
  for (let i = 0; i < nameStr.length; i++) {
    hash = nameStr.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % colors.length;
  const avatarColorClass = colors[index];

  let roleClasses = '';
  switch (item.rol) {
    case 'Administrador':
      roleClasses = 'bg-blue-500/10 text-blue-400 border-blue-500/20 border';
      break;
    case 'Auditor':
      roleClasses = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 border';
      break;
    case 'Sujeto Pasivo':
      roleClasses = 'bg-amber-500/10 text-amber-400 border-amber-500/20 border';
      break;
    case 'Asistente técnico':
      roleClasses = 'bg-purple-500/10 text-purple-400 border-purple-500/20 border';
      break;
    default:
      roleClasses = 'bg-slate-500/10 text-slate-400 border-slate-500/20 border';
  }

  let asistidoSubtext = '';
  if (item.rol === 'Asistente técnico' && item.asistido_rut) {
    const sp = (dataStore.sujetos_pasivos || []).find(s => s.rut === item.asistido_rut);
    const asistidoNombre = sp ? sp.nombre : item.asistido_rut;
    asistidoSubtext = `
      <div class="text-[9px] text-slate-400 font-medium truncate mt-0.5" title="Asiste a: ${asistidoNombre}">
        Asiste a: <span class="font-semibold text-slate-300">${asistidoNombre}</span>
      </div>
    `;
  }

  return `
    <tr class="hover:bg-slate-900/40 border-b border-slate-800 transition-colors h-[72px]">
      <td class="pl-6 pr-2 text-xs font-semibold text-slate-100">
        <div class="flex items-center gap-3">
          <div class="h-8 w-8 rounded-full flex items-center justify-center text-[10px] font-bold border ${avatarColorClass} shrink-0 shadow-sm">
            ${initials}
          </div>
          <div class="font-semibold text-heading truncate max-w-[180px]">${escapeHtml(item.nombre)}</div>
        </div>
      </td>
      <td class="px-2 text-xs text-slate-200 font-mono"><div class="w-full truncate">${escapeHtml(item.rut || '-')}</div></td>
      <td class="px-2 text-xs text-slate-200 font-mono"><div class="w-full truncate">${escapeHtml(item.correo)}</div></td>
      <td class="px-2 text-xs">
        <div class="w-full truncate">
          <span class="px-2 py-0.5 rounded text-[10px] font-bold border ${roleClasses}">${escapeHtml(item.rol)}</span>
          ${asistidoSubtext}
        </div>
      </td>
      <td class="pl-2 pr-6 text-right whitespace-nowrap">
        <div class="flex items-center justify-end gap-1">
          <button onclick="openUsuarioModal(${item.id})" class="p-1.5 rounded-lg text-slate-400 hover:text-brand-600 hover:bg-brand-500/10 dark:hover:bg-brand-500/20 transition-all" title="Editar">
            <i data-lucide="edit-2" class="h-3.5 w-3.5"></i>
          </button>
          ${currentUser && item.id === currentUser.id 
            ? `<button disabled class="p-1.5 rounded-lg text-slate-600 cursor-not-allowed opacity-40" title="No puedes eliminar tu propio usuario">
                 <i data-lucide="trash-2" class="h-3.5 w-3.5"></i>
               </button>`
            : `<button onclick="deleteRecord('usuarios', ${item.id})" class="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-500/10 dark:hover:bg-rose-500/20 transition-all" title="Eliminar">
                 <i data-lucide="trash-2" class="h-3.5 w-3.5"></i>
               </button>`
          }
        </div>
      </td>
    </tr>
  `;
}

function filterUsuarios() {
  const query = (document.getElementById('search-usuarios')?.value || '').toLowerCase().trim();
  const tbody = document.querySelector('#table-usuarios tbody');
  if (!tbody) return;
  
  const items = dataStore.usuarios || [];
  const filtered = items.filter(user => {
    return (user.nombre || '').toLowerCase().includes(query) ||
           (user.correo || '').toLowerCase().includes(query) ||
           (user.rut || '').toLowerCase().includes(query) ||
           (user.rol || '').toLowerCase().includes(query);
  });
  
  let rowsHtml = '';
  if (filtered.length === 0) {
    rowsHtml = `<tr><td colspan="5" class="px-3 py-8 text-center text-xs text-slate-300">No se encontraron usuarios coincidentes.</td></tr>`;
  } else {
    filtered.forEach(item => {
      rowsHtml += generateUsuarioRowHtml(item);
    });
  }
  tbody.innerHTML = rowsHtml;
  lucide.createIcons();
}

// RENDER: VISTA CONTROL USUARIOS
function renderUsuarios(container) {
  if (typeof activeAdminTab === 'undefined') {
    activeAdminTab = 'usuarios';
  }

  let contentHtml = '';

  if (activeAdminTab === 'usuarios') {
    const items = dataStore.usuarios || [];
    let rowsHtml = '';
    
    if (items.length === 0) {
      rowsHtml = `<tr><td colspan="5" class="px-3 py-8 text-center text-xs text-slate-300">No hay registros de usuarios encontrados.</td></tr>`;
    } else {
      items.forEach(item => {
        rowsHtml += generateUsuarioRowHtml(item);
      });
    }

    contentHtml = `
      <div class="space-y-6 mt-6">
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div class="relative w-full max-w-md">
            <span class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <i data-lucide="search" class="h-4 w-4"></i>
            </span>
            <input type="text" id="search-usuarios" oninput="filterUsuarios()" placeholder="Buscar por nombre, correo, rut..." class="w-full py-2.5 pl-9 pr-4 rounded-xl text-xs glass-input focus:outline-none transition-colors">
          </div>
          
          <button id="btn-registrar-usuario" onclick="openUsuarioModal()" class="px-4 py-2.5 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2 transition-all hover:shadow-lg hover:shadow-brand-500/20 shrink-0">
            <i data-lucide="plus" class="h-4 w-4"></i> Registrar Usuario
          </button>
        </div>

        <div class="rounded-2xl overflow-hidden border border-slate-700/40 mt-4 glass-card">
          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse table-fixed" id="table-usuarios">
              <thead>
                <tr class="bg-slate-800/30 border-b border-slate-700/60 text-slate-400 text-[10px] uppercase font-bold tracking-widest">
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
  } else if (activeAdminTab === 'sincronizacion') {
    let lastSyncStr = 'Sin registros';
    if (dataStore.syncHistory && dataStore.syncHistory.length > 0) {
      const lastSync = dataStore.syncHistory[0];
      try {
        const d = new Date(lastSync.timestamp.replace(' ', 'T') + 'Z');
        lastSyncStr = d.toLocaleString('es-CL', {
          day: '2-digit', month: '2-digit', year: 'numeric',
          hour: '2-digit', minute: '2-digit'
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
            <p class="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total Solicitudes</p>
            <p class="text-xl font-bold text-heading mt-0.5">${dataStore.stats.solicitudes ?? '-'}</p>
          </div>
        </div>
        <div class="glass-card p-4 rounded-2xl flex items-center gap-4 shadow-sm">
          <div class="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
            <i data-lucide="calendar-check" class="h-5 w-5"></i>
          </div>
          <div>
            <p class="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Publicadas PH</p>
            <p class="text-xl font-bold text-heading mt-0.5">${dataStore.stats.publicadas ?? '-'}</p>
          </div>
        </div>
        <div class="glass-card p-4 rounded-2xl flex items-center gap-4 shadow-sm">
          <div class="h-10 w-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center shrink-0">
            <i data-lucide="users" class="h-5 w-5"></i>
          </div>
          <div>
            <p class="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Sujetos Pasivos</p>
            <p class="text-xl font-bold text-heading mt-0.5">${dataStore.stats.sujetos_pasivos ?? '-'}</p>
          </div>
        </div>
        <div class="glass-card p-4 rounded-2xl flex items-center gap-4 shadow-sm">
          <div class="h-10 w-10 rounded-xl bg-pink-500/10 text-pink-400 flex items-center justify-center shrink-0">
            <i data-lucide="shield-check" class="h-5 w-5"></i>
          </div>
          <div>
            <p class="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Usuarios Activos</p>
            <p class="text-xl font-bold text-heading mt-0.5">${dataStore.stats.usuarios ?? '-'}</p>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6 animate-fade-in">
        <div class="lg:col-span-2 space-y-4">
          ${renderGlassCard(`
            <div class="border-b border-slate-800/60 pb-3 flex items-center gap-2 mb-4">
              <i data-lucide="refresh-cw" class="h-4 w-4 text-brand-400"></i>
              <h3 class="text-xs font-bold uppercase tracking-wider text-brand-400">Panel de Sincronización</h3>
            </div>
            <div class="space-y-4">
              <p class="text-xs text-slate-300 leading-relaxed">
                Inicie la sincronización incremental para actualizar la base de datos local con los registros de solicitudes, audiencias y sujetos obligados desde el archivo de datos local.
              </p>
              <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div class="border rounded-xl p-4" style="background-color: var(--bg-main); border-color: var(--border-ui);">
                  <span class="text-[10px] text-body-muted font-bold uppercase tracking-wider block mb-1">Archivo de Origen</span>
                  <span class="text-xs font-mono text-heading font-semibold break-all">lobby_data.xlsx</span>
                </div>
                <div class="border rounded-xl p-4" style="background-color: var(--bg-main); border-color: var(--border-ui);">
                  <span class="text-[10px] text-body-muted font-bold uppercase tracking-wider block mb-1">Ruta Completa en Servidor</span>
                  <span class="text-[10px] font-mono text-heading font-semibold break-all" title="${dataStore.dbHealth?.excelPath || '-'}">${dataStore.dbHealth?.excelPath || '-'}</span>
                </div>
                <div class="border rounded-xl p-4" style="background-color: var(--bg-main); border-color: var(--border-ui);">
                  <span class="text-[10px] text-body-muted font-bold uppercase tracking-wider block mb-1">Última Sincronización</span>
                  <span class="text-xs font-mono text-heading font-semibold break-all">${lastSyncStr}</span>
                </div>
              </div>
              
              <div id="import-progress-container" class="hidden space-y-2 py-2">
                <div class="flex justify-between text-[10px]">
                  <span id="import-progress-status" class="text-slate-400 font-medium">Sincronizando registros...</span>
                  <span class="text-brand-400 font-bold animate-pulse">En curso</span>
                </div>
                <div class="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div class="bg-brand-500 h-full w-full animate-pulse rounded-full" style="width: 100%;"></div>
                </div>
              </div>

              <div class="flex flex-col sm:flex-row gap-3 pt-2">
                <button id="btn-import-sync" onclick="triggerImport()" class="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all hover:shadow-lg hover:shadow-emerald-500/20 active:scale-[0.98] flex items-center justify-center gap-2">
                  <i data-lucide="play-circle" class="h-4 w-4"></i>
                  <span>Sincronizar Ahora</span>
                </button>
                
                <button onclick="window.location.href='/api/admin/backup'" class="py-3 px-6 rounded-xl text-xs font-bold transition-all btn-secondary active:scale-[0.98] flex items-center justify-center gap-2">
                  <i data-lucide="download" class="h-4 w-4"></i>
                  <span>Respaldar Base de Datos</span>
                </button>
              </div>
            </div>
          `, 'rounded-2xl p-6 shadow-sm relative z-20')}
        </div>

        <div class="space-y-4">
          ${renderGlassCard(`
            <div class="border-b border-slate-800/60 pb-3 flex items-center gap-2 mb-4">
              <i data-lucide="activity" class="h-4 w-4 text-brand-400"></i>
              <h3 class="text-xs font-bold uppercase tracking-wider text-brand-400">Salud del Sistema</h3>
            </div>
            <div class="space-y-3.5 text-xs">
              <div class="flex justify-between items-center py-1 border-b border-slate-800/60">
                <span class="text-body-muted">Base de Datos:</span>
                <span class="font-bold text-heading font-mono">${dataStore.dbHealth?.dbSize || '-'}</span>
              </div>
              <div class="flex justify-between items-center py-1 border-b border-slate-800/60">
                <span class="text-body-muted">Archivo Excel:</span>
                <span class="font-bold text-heading font-mono">${dataStore.dbHealth?.excelSize || '-'}</span>
              </div>
              <div class="flex justify-between items-center py-1">
                <span class="text-body-muted">Integridad SQLite:</span>
                <span class="font-bold font-mono px-2 py-0.5 rounded text-[10px] ${dataStore.dbHealth?.integrity === 'ok' ? 'badge-status-enplazo' : 'badge-status-vencido'}" style="margin-left: auto;">${dataStore.dbHealth?.integrity || '-'}</span>
              </div>
            </div>
          `, 'rounded-2xl p-6 shadow-sm')}

          ${renderGlassCard(`
            <div class="border-b border-slate-800/60 pb-3 flex items-center gap-2 mb-4">
              <i data-lucide="history" class="h-4 w-4 text-brand-400"></i>
              <h3 class="text-xs font-bold uppercase tracking-wider text-brand-400">Historial Reciente</h3>
            </div>
            <div class="space-y-3 max-h-60 overflow-y-auto pr-1">
              ${renderHistoryList()}
            </div>
          `, 'rounded-2xl p-6 shadow-sm')}
        </div>
      </div>
    `;
  } else if (activeAdminTab === 'database') {
    contentHtml = renderDatabaseInspectorHtml();
  } else if (activeAdminTab === 'auditoria') {
    const list = dataStore.auditoria || [];
    // Ordenar ascendentemente por fecha para cálculo correcto de variaciones
    const sortedAudits = [...list].sort((a, b) => a.fecha.localeCompare(b.fecha));

    // Obtener valores actuales de la base de datos para la comparación de discrepancias
    const liveVals = dataStore.valoresActuales || { ingresada: 0, aceptada: 0, rechazada: 0, suspendida: 0, cancelada: 0, encomendada: 0, publicada: 0 };
    const liveTotal = liveVals.ingresada + liveVals.aceptada + liveVals.rechazada + liveVals.suspendida + liveVals.cancelada + liveVals.encomendada;

    const formatVariation = (val, prevVal) => {
      if (prevVal === undefined || prevVal === null || prevVal === 0) return '';
      const diff = val - prevVal;
      const pct = (diff / prevVal) * 100;
      if (pct === 0) return `<span class="text-slate-500 text-[9px] ml-1">0,00%</span>`;
      const sign = pct > 0 ? '+' : '';
      const colorClass = pct > 0 ? 'text-emerald-400 font-semibold animate-pulse-subtle' : 'text-rose-400 font-semibold';
      return `<span class="${colorClass} text-[9px] ml-1">${sign}${pct.toFixed(2).replace('.', ',')}%</span>`;
    };

    // Construcción de la Tabla Semanal (última ingresada primero)
    let weeklyRowsHtml = '';
    if (sortedAudits.length === 0) {
      weeklyRowsHtml = `<tr><td colspan="10" class="px-3 py-8 text-center text-xs text-slate-400">No hay registros de auditoría cargados.</td></tr>`;
    } else {
      for (let i = sortedAudits.length - 1; i >= 0; i--) {
        const cur = sortedAudits[i];
        const prev = i > 0 ? sortedAudits[i - 1] : null;

        const curTotal = cur.total || 0;
        const prevTotal = prev ? (prev.total || 0) : null;

        // Comprobación de discrepancias (solo se alertan para el último registro semanal disponible y si está En Proceso)
        const isLatest = i === sortedAudits.length - 1;
        const isEnProceso = cur.estado === 'En Proceso';
        const discIngresada = isLatest && isEnProceso && (cur.ingresada !== liveVals.ingresada);
        const discAceptada = isLatest && isEnProceso && (cur.aceptada !== liveVals.aceptada);
        const discRechazada = isLatest && isEnProceso && (cur.rechazada !== liveVals.rechazada);
        const discSuspendida = isLatest && isEnProceso && (cur.suspendida !== liveVals.suspendida);
        const discCancelada = isLatest && isEnProceso && (cur.cancelada !== liveVals.cancelada);
        const discEncomendada = isLatest && isEnProceso && (cur.encomendada !== liveVals.encomendada);
        const discPublicada = isLatest && isEnProceso && (cur.publicada !== liveVals.publicada);
        const discTotal = isLatest && isEnProceso && (curTotal !== liveTotal);

        const hasAnyDiscrepancy = discIngresada || discAceptada || discRechazada || discSuspendida || discCancelada || discEncomendada || discPublicada || discTotal;

        let warningBadge = '';
        if (cur.estado === 'Cerrado') {
          warningBadge = `
            <span class="px-1.5 py-0.5 rounded text-[8px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1 inline-flex shrink-0 select-none cursor-default">
              <i data-lucide="shield-check" class="h-2.5 w-2.5 shrink-0"></i> Validado
            </span>
          `;
        } else {
          warningBadge = `
            <div class="flex flex-col items-end gap-1 shrink-0">
              <span class="px-1.5 py-0.5 rounded text-[8px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1 inline-flex shrink-0 select-none cursor-default">
                <i data-lucide="clock" class="h-2.5 w-2.5 shrink-0 animate-pulse"></i> En Proceso
              </span>
              ${hasAnyDiscrepancy ? `
              <span class="px-1.5 py-0.5 rounded text-[8px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center gap-1 inline-flex shrink-0 select-none cursor-default" title="Discrepancia detectada con la base de datos actual.">
                <i data-lucide="alert-circle" class="h-2.5 w-2.5 shrink-0"></i> Discrepancia
              </span>
              ` : ''}
            </div>
          `;
        }

        const formatCell = (val, prevVal, isDisc, liveVal) => {
          const formattedVal = val.toLocaleString('es-CL');
          const variation = prevVal !== null ? formatVariation(val, prevVal) : '';
          const discClass = isDisc ? 'bg-rose-500/20 text-rose-300 font-bold border border-rose-500/30 rounded px-1.5 py-0.5' : '';
          const titleText = isDisc ? `title="Cifra en Sistema: ${liveVal.toLocaleString('es-CL')} (Discrepancia: ${val - liveVal})"` : '';
          return `<div class="flex flex-col items-start gap-0.5">
            <span class="${discClass} inline-block" ${titleText}>${formattedVal}</span>
            ${variation}
          </div>`;
        };

        // Formatear fecha DD-MM-YYYY
        let dateStr = cur.fecha;
        try {
          const parts = cur.fecha.split(' ');
          if (parts[0]) {
            const dateParts = parts[0].split('-');
            if (dateParts.length === 3) {
              dateStr = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}${parts[1] ? ' ' + parts[1] : ''}`;
            }
          }
        } catch(e) {}

        const cerrarBtnHtml = (isEnProceso && isLatest)
          ? `<button onclick="closeAuditoriaRecord(${cur.id})" class="p-1.5 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 dark:hover:bg-emerald-500/20 transition-all shrink-0" title="Cerrar y Validar Control Semanal">
               <i data-lucide="check-square" class="h-3.5 w-3.5"></i>
             </button>`
          : `<div class="w-[26px] h-[26px] shrink-0"></div>`;

        weeklyRowsHtml += `
          <tr class="hover:bg-slate-900/40 border-b border-slate-800 transition-colors h-[64px]">
            <td class="pl-6 pr-2 text-xs font-semibold text-slate-100 font-mono">
              <div class="flex flex-col">
                <span class="text-slate-200 font-semibold text-[11px]">${dateStr}</span>
                <span class="text-[9px] text-slate-500 font-medium">${cur.usuario || 'Sistema'}</span>
              </div>
            </td>
            <td class="px-2 text-xs font-semibold text-slate-100">${formatCell(curTotal, prevTotal, discTotal, liveTotal)}</td>
            <td class="px-2 text-xs text-slate-300">${formatCell(cur.ingresada, prev ? prev.ingresada : null, discIngresada, liveVals.ingresada)}</td>
            <td class="px-2 text-xs text-slate-300">${formatCell(cur.aceptada, prev ? prev.aceptada : null, discAceptada, liveVals.aceptada)}</td>
            <td class="px-2 text-xs text-slate-300">${formatCell(cur.rechazada, prev ? prev.rechazada : null, discRechazada, liveVals.rechazada)}</td>
            <td class="px-2 text-xs text-slate-300">${formatCell(cur.suspendida, prev ? prev.suspendida : null, discSuspendida, liveVals.suspendida)}</td>
            <td class="px-2 text-xs text-slate-300">${formatCell(cur.cancelada, prev ? prev.cancelada : null, discCancelada, liveVals.cancelada)}</td>
            <td class="px-2 text-xs text-slate-300">${formatCell(cur.encomendada, prev ? prev.encomendada : null, discEncomendada, liveVals.encomendada)}</td>
            <td class="px-2 text-xs text-slate-300">${formatCell(cur.publicada, prev ? prev.publicada : null, discPublicada, liveVals.publicada)}</td>
            <td class="pl-2 pr-6 text-right whitespace-nowrap">
              <div class="flex items-center justify-end gap-1">
                <div class="flex items-center gap-1 mr-2">${warningBadge}</div>
                ${cerrarBtnHtml}
                <button onclick="openAuditoriaModal(${cur.id})" class="p-1.5 rounded-lg text-slate-400 hover:text-brand-400 hover:bg-brand-500/10 dark:hover:bg-brand-500/20 transition-all" title="Editar">
                  <i data-lucide="edit-2" class="h-3.5 w-3.5"></i>
                </button>
                <button onclick="deleteAuditoria(${cur.id})" class="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 dark:hover:bg-rose-500/20 transition-all" title="Eliminar">
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
    sortedAudits.forEach(aud => {
      const yyyymm = aud.fecha.slice(0, 7); // e.g. "2026-06"
      monthlyGroups[yyyymm] = aud; // Sobrescribe con el último registro cronológico del mes
    });

    const monthlyKeys = Object.keys(monthlyGroups).sort();
    let monthlyRowsHtml = '';
    if (monthlyKeys.length === 0) {
      monthlyRowsHtml = `<tr><td colspan="10" class="px-3 py-8 text-center text-xs text-slate-400">No hay datos de auditoría mensual disponibles.</td></tr>`;
    } else {
      for (let i = monthlyKeys.length - 1; i >= 0; i--) {
        const key = monthlyKeys[i];
        const cur = monthlyGroups[key];
        const prevKey = i > 0 ? monthlyKeys[i - 1] : null;
        const prev = prevKey ? monthlyGroups[prevKey] : null;

        const curTotal = cur.total || 0;
        const prevTotal = prev ? (prev.total || 0) : null;

        let monthName = key;
        try {
          const parts = key.split('-');
          const yearShort = parts[0].slice(2);
          const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
          const monthIndex = parseInt(parts[1], 10) - 1;
          monthName = `${months[monthIndex]}-${yearShort}`;
        } catch(e) {}

        const formatMonthlyCell = (val, prevVal) => {
          const formattedVal = val.toLocaleString('es-CL');
          const variation = prevVal !== null ? formatVariation(val, prevVal) : '';
          return `<div class="flex flex-col items-start gap-0.5">
            <span>${formattedVal}</span>
            ${variation}
          </div>`;
        };

        monthlyRowsHtml += `
          <tr class="hover:bg-slate-900/40 border-b border-slate-800 transition-colors h-[56px]">
            <td class="pl-6 pr-2 text-xs font-bold text-slate-200 uppercase">${monthName}</td>
            <td class="px-2 text-xs font-semibold text-slate-100">${formatMonthlyCell(curTotal, prevTotal)}</td>
            <td class="px-2 text-xs text-slate-300">${formatMonthlyCell(cur.ingresada, prev ? prev.ingresada : null)}</td>
            <td class="px-2 text-xs text-slate-300">${formatMonthlyCell(cur.aceptada, prev ? prev.aceptada : null)}</td>
            <td class="px-2 text-xs text-slate-300">${formatMonthlyCell(cur.rechazada, prev ? prev.rechazada : null)}</td>
            <td class="px-2 text-xs text-slate-300">${formatMonthlyCell(cur.suspendida, prev ? prev.suspendida : null)}</td>
            <td class="px-2 text-xs text-slate-300">${formatMonthlyCell(cur.cancelada, prev ? prev.cancelada : null)}</td>
            <td class="px-2 text-xs text-slate-300">${formatMonthlyCell(cur.encomendada, prev ? prev.encomendada : null)}</td>
            <td class="px-2 text-xs text-slate-300">${formatMonthlyCell(cur.publicada, prev ? prev.publicada : null)}</td>
            <td class="pl-2 pr-6"></td>
          </tr>
        `;
      }
    }

    contentHtml = `
      <div class="space-y-6 mt-6 animate-fade-in">
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div class="space-y-1">
            <h3 class="text-sm font-bold text-white flex items-center gap-2">
              <i data-lucide="clipboard-check" class="h-4 w-4 text-brand-400"></i>
              Control de Auditoría Semanal
            </h3>
            <p class="text-xs text-slate-400">Controles manuales validados por la municipalidad y variaciones relativas de estados.</p>
          </div>
          <button id="btn-registrar-auditoria" onclick="openAuditoriaModal()" class="px-4 py-2.5 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2 transition-all hover:shadow-lg hover:shadow-brand-500/20 shrink-0">
            <i data-lucide="plus" class="h-4 w-4"></i> Registrar Control Semanal
          </button>
        </div>

        <!-- TABLA PROGRESIÓN MENSUAL -->
        <div class="space-y-2">
          <span class="text-[10px] font-bold text-brand-400 uppercase tracking-wider block">Tabla Superior: Progresión Mensual (Estados de Solicitud)</span>
          <div class="rounded-2xl overflow-hidden border border-slate-700/40 glass-card">
            <div class="overflow-x-auto">
              <table class="w-full text-left border-collapse table-fixed">
                <thead>
                  <tr class="bg-slate-800/30 border-b border-slate-700/60 text-slate-400 text-[9px] uppercase font-bold tracking-widest">
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
          <div class="rounded-2xl overflow-hidden border border-slate-700/40 glass-card">
            <div class="overflow-x-auto">
              <table class="w-full text-left border-collapse table-fixed">
                <thead>
                  <tr class="bg-slate-800/30 border-b border-slate-700/60 text-slate-400 text-[9px] uppercase font-bold tracking-widest">
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

  container.innerHTML = `
    <div class="space-y-1">
      <h2 class="text-2xl font-bold text-heading tracking-tight">Administración</h2>
    </div>

    <div class="border-b border-slate-800 mt-6">
      <nav class="-mb-px flex space-x-8 overflow-x-auto whitespace-nowrap scrollbar-none" aria-label="Tabs">
        <button onclick="changeAdminTab('usuarios')" class="border-b-2 py-3.5 px-1 text-xs font-bold transition-all ${activeAdminTab === 'usuarios' ? 'border-brand-500 text-brand-600 dark:text-brand-400' : 'border-transparent text-body-muted hover:text-heading hover:border-slate-300 dark:hover:border-slate-700'} flex items-center gap-2 focus:outline-none shrink-0">
          <i data-lucide="users" class="h-4 w-4"></i>
          Gestión de Usuarios
        </button>
        <button onclick="changeAdminTab('auditoria')" class="border-b-2 py-3.5 px-1 text-xs font-bold transition-all ${activeAdminTab === 'auditoria' ? 'border-brand-500 text-brand-600 dark:text-brand-400' : 'border-transparent text-body-muted hover:text-heading hover:border-slate-300 dark:hover:border-slate-700'} flex items-center gap-2 focus:outline-none shrink-0">
          <i data-lucide="clipboard-check" class="h-4 w-4"></i>
          Control de Auditoría
        </button>
        <button onclick="changeAdminTab('sincronizacion')" class="border-b-2 py-3.5 px-1 text-xs font-bold transition-all ${activeAdminTab === 'sincronizacion' ? 'border-brand-500 text-brand-600 dark:text-brand-400' : 'border-transparent text-body-muted hover:text-heading hover:border-slate-300 dark:hover:border-slate-700'} flex items-center gap-2 focus:outline-none shrink-0">
          <i data-lucide="refresh-cw" class="h-4 w-4"></i>
          Sincronización
        </button>
        <button onclick="changeAdminTab('database')" class="border-b-2 py-3.5 px-1 text-xs font-bold transition-all ${activeAdminTab === 'database' ? 'border-brand-500 text-brand-600 dark:text-brand-400' : 'border-transparent text-body-muted hover:text-heading hover:border-slate-300 dark:hover:border-slate-700'} flex items-center gap-2 focus:outline-none shrink-0">
          <i data-lucide="database" class="h-4 w-4"></i>
          Base de Datos
        </button>
      </nav>
    </div>

    ${contentHtml}
  `;

  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
}

// RENDER: VISTA REPORTES ANALÍTICOS AVANZADOS
function renderReportes(container) {
  const processedData = processReportData(dataStore.reportesRawData, reportesFilters);
  const totalItems = processedData.length;
  const currentPage = paginationState.reportes.page;
  const pageSize = 10;
  const paginatedItems = processedData.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const isNombreEmpty = !reportesFilters.nombre || reportesFilters.nombre === '';
  const cargoPlaceholder = isNombreEmpty ? 'Seleccione nombre primero...' : 'Escribir cargo...';

  let rowsHtml = '';
  if (paginatedItems.length === 0) {
    const hasAnyFilter = (reportesFilters.nombre && reportesFilters.nombre !== '') ||
                         (reportesFilters.cargo && reportesFilters.cargo !== '') ||
                         reportesFilters.fechaInicio ||
                         reportesFilters.fechaTermino ||
                         (reportesFilters.estados && reportesFilters.estados.length > 0);
    const msg = hasAnyFilter
      ? 'No hay registros que coincidan con los filtros aplicados.'
      : 'Por favor, ingrese un Sujeto Pasivo (o seleccione "Todos") u otros filtros para generar el reporte.';
    rowsHtml = `<tr><td colspan="7" class="px-6 py-8 text-center text-xs text-slate-300">${msg}</td></tr>`;
  } else {
    paginatedItems.forEach(item => {
      rowsHtml += `
        <tr class="hover:bg-slate-900/40 border-b border-slate-800 transition-colors h-[56px]">
          <td class="pl-6 pr-2 text-xs font-semibold text-slate-300 text-left w-12">${item.index}</td>
          <td class="px-2 text-xs font-semibold text-slate-100 text-left w-36">${escapeHtml(item.folio)}</td>
          <td class="px-2 text-xs text-slate-200 text-left" title="${escapeHtmlAttr(item.cargoCompleto)}">
            <div class="font-medium text-slate-100 truncate max-w-xs">${escapeHtml(item.cargoCompleto)}</div>
          </td>
          <td class="px-2 text-xs text-slate-300 text-left w-28">${item.fechaIngreso}</td>
          <td class="px-2 text-xs text-slate-300 text-left w-28">${item.fechaAgendada}</td>
          <td class="px-2 text-xs text-left w-44">
            ${item.badgeText === 'Pendiente de publicación'
              ? `<span class="px-2 py-1 rounded text-[10px] font-semibold ${item.badgeClass} inline-block text-center leading-tight">Pendiente de<br>publicación</span>`
              : `<span class="px-2 py-0.5 rounded text-[10px] font-semibold ${item.badgeClass} whitespace-nowrap">${escapeHtml(item.badgeText)}</span>`
            }
          </td>
          <td class="pl-2 pr-6 text-xs text-left w-28">
            ${(() => {
              const hasDays = item.plazo.includes('(') && item.plazo.includes(')');
              let mainCode = item.plazo;
              let subtextHtml = '';
              
              if (hasDays) {
                const parts = item.plazo.split(' ');
                mainCode = parts[0];
                const days = parts[1].replace(/[()]/g, '');
                if (mainCode === 'FDP' || mainCode === 'RFP') {
                  subtextHtml = `<div class="text-[9px] font-bold mt-0.5 leading-none opacity-90">${days}</div>`;
                }
              }
              
              const isOverdue = mainCode === 'FDP' || mainCode === 'RFP' || item.plazo.includes('-');
              const badgeClass = isOverdue ? 'badge-status-vencido' : 'badge-status-enplazo';
              
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

  const existingTable = container.querySelector('#table-reportes');
  if (existingTable && window.activeInputId) {
    existingTable.querySelector('tbody').innerHTML = rowsHtml;
    const counterEl = container.querySelector('#reportes-counter');
    if (counterEl) counterEl.textContent = `${totalItems} registros coincidentes encontrados`;
    const pagEl = container.querySelector('#reportes-pagination-container');
    if (pagEl) pagEl.innerHTML = renderPaginationControls('reportes', totalItems, currentPage, pageSize);
    
    // update export PDF button visibility
    const exportBtnContainer = container.querySelector('#reportes-export-btn-container');
    if (exportBtnContainer) {
      exportBtnContainer.innerHTML = totalItems > 0 ? `
        <button onclick="exportReportToPDF()" class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm">
          <i data-lucide="file-down" class="h-3.5 w-3.5"></i>
          Exportar PDF
        </button>
      ` : '';
    }
    lucide.createIcons();
    return;
  }

  container.innerHTML = `
    <div class="space-y-4" id="reportes-view-container">
      <div class="space-y-1">
        <h2 class="text-2xl font-bold text-white tracking-tight">Reportes</h2>
      </div>

      <!-- PANEL FILTROS AVANZADOS -->
      ${renderGlassCard(`
        <div class="flex items-center justify-between border-b border-slate-800/60 pb-3">
          <h3 class="text-xs font-bold uppercase tracking-wider text-brand-400 flex items-center gap-2">
            <i data-lucide="sliders-horizontal" class="h-3.5 w-3.5"></i>
            Filtros
          </h3>
          <button id="btn-reportes-clear" class="text-[10px] text-slate-300 hover:text-white transition-colors flex items-center gap-1">
            <i data-lucide="rotate-ccw" class="h-3 w-3"></i> Limpiar Filtros
          </button>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <!-- NOMBRE -->
          ${renderSearchInput({
            id: 'report-filter-nombre',
            fieldName: 'nombre',
            label: 'Nombre Sujeto Pasivo',
            placeholder: 'Escribir nombre...',
            value: reportesFilters.nombre,
            hasSuggestions: true
          })}

          <!-- CARGO -->
          ${renderSearchInput({
            id: 'report-filter-cargo',
            fieldName: 'cargo',
            label: 'Cargo',
            placeholder: cargoPlaceholder,
            value: reportesFilters.cargo,
            disabled: isNombreEmpty,
            hasSuggestions: true
          })}

          <!-- FECHA INICIO -->
          ${renderDateInput({
            id: 'report-filter-fechainicio',
            fieldName: 'fechaInicio',
            label: 'Fecha Inicio',
            value: reportesFilters.fechaInicio
          })}

          <!-- FECHA TERMINO -->
          ${renderDateInput({
            id: 'report-filter-fechatermino',
            fieldName: 'fechaTermino',
            label: 'Fecha Término',
            value: reportesFilters.fechaTermino
          })}
        </div>

        <!-- FILTRO ESTADOS MULTIPLE -->
        <div class="space-y-2">
          <label class="text-[10px] font-bold text-slate-300 uppercase tracking-wider block">Estados de Solicitud (Selección Múltiple)</label>
          <div class="flex flex-wrap gap-2.5">
            ${['Ingresada', 'Aceptada', 'Rechazada', 'Suspendida', 'Cancelada', 'Encomendada', 'Pendiente de publicación'].map(est => {
              const checked = reportesFilters.estados.includes(est);
              return `
                <label class="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-700/60 bg-slate-900/40 text-xs font-semibold cursor-pointer select-none transition-all hover:bg-slate-800/80 ${checked ? 'border-brand-500 bg-blue-500/10 text-blue-400 shadow-sm shadow-brand-500/20' : 'text-slate-300'}">
                  <input type="checkbox" class="hidden report-estado-checkbox" data-estado="${est}" ${checked ? 'checked' : ''}>
                  <span>${est}</span>
                </label>
              `;
            }).join('')}
          </div>
        </div>
      `, 'rounded-2xl p-5 space-y-4 relative z-20')}

      <!-- TABLA DE REPORTES -->
      <div class="rounded-2xl overflow-hidden mt-4 border border-slate-700/40 glass-card">
        <div class="p-4 border-b border-slate-800/80 flex justify-between items-center">
          <div class="text-xs text-slate-300" id="reportes-counter">${totalItems} registros coincidentes encontrados</div>
          <div id="reportes-export-btn-container">
            ${totalItems > 0 ? `
              <button onclick="exportReportToPDF()" class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm">
                <i data-lucide="file-down" class="h-3.5 w-3.5"></i>
                Exportar PDF
              </button>
            ` : ''}
          </div>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse table-fixed" id="table-reportes">
            <thead>
              <tr class="bg-slate-800/30 border-b border-slate-700/60 text-slate-400 text-[10px] uppercase font-bold tracking-widest">
                <th class="pl-6 pr-2 py-3 w-12 text-left">#</th>
                <th class="px-2 py-3 w-36 text-left">Folio</th>
                <th class="px-2 py-3 text-left">Sujeto Pasivo y Cargo</th>
                <th class="px-2 py-3 w-28 text-left">Fecha Ingreso</th>
                <th class="px-2 py-3 w-28 text-left">Fecha Agenda</th>
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
          ${renderPaginationControls('reportes', totalItems, currentPage, pageSize)}
        </div>
      </div>
    </div>
  `;
}

/**
 * RENDER: VISTA DE INICIO DE SESIÓN
 * Presenta una pantalla de autenticación premium integrada en la SPA.
 */
function renderLogin(container) {
  container.innerHTML = `
    <div class="min-h-[80vh] flex items-center justify-center p-4">
      <div class="glass-card w-full max-w-md p-8 rounded-3xl shadow-2xl border border-slate-800 space-y-6 relative overflow-hidden animate-fade-in">
        <!-- Botón de Modo Claro/Oscuro en Login -->
        <button id="login-theme-toggle" onclick="toggleTheme()" class="absolute top-4 right-4 h-8 w-8 rounded-xl flex items-center justify-center border border-slate-800 hover:border-slate-700 bg-slate-950/40 text-slate-300 hover:text-white transition-all duration-200" title="Cambiar de Modo">
          <i data-lucide="sun" class="h-4 w-4"></i>
        </button>

        <!-- Decoración de fondo premium -->
        <div class="absolute -top-10 -left-10 w-40 h-40 bg-brand-600/10 rounded-full blur-3xl pointer-events-none"></div>
        <div class="absolute -bottom-10 -right-10 w-40 h-40 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <!-- Encabezado / Logo -->
        <div class="flex flex-col items-center text-center space-y-3 relative z-10">
          <img src="/logo_secum.png" alt="Secretaría Municipal Maipú" class="h-20 w-auto object-contain mb-2">
          <div>
            <h1 class="text-2xl font-extrabold text-heading tracking-tight text-white">LobbyTracker</h1>
            <p class="text-xs text-body-muted mt-1 font-medium">Gestión de Audiencias - Ley N° 20.730</p>
          </div>
        </div>

        <!-- Mensaje de Error (Oculto por defecto) -->
        <div id="login-error" class="hidden px-4 py-3 rounded-xl bg-rose-950/40 border border-rose-900/60 text-rose-300 text-xs font-semibold flex items-center gap-2">
          <i data-lucide="alert-circle" class="h-4 w-4 shrink-0"></i>
          <span id="login-error-text">Credenciales inválidas. Inténtelo de nuevo.</span>
        </div>

        <!-- Formulario -->
        <form onsubmit="event.preventDefault(); login(document.getElementById('login-email').value, document.getElementById('login-password').value);" autocomplete="off" class="space-y-4 relative z-10">
          <!-- Correo -->
          <div class="space-y-1">
            <label for="login-email" class="block text-[10px] font-bold text-slate-300 uppercase tracking-wider">Correo Electrónico</label>
            <div class="relative">
              <span class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <i data-lucide="mail" class="h-4 w-4"></i>
              </span>
              <input type="email" id="login-email" required placeholder="ejemplo@correo.com" autocomplete="off" value=""
                     class="w-full pl-9 pr-3 py-2.5 rounded-xl text-xs glass-input text-slate-200 placeholder-slate-500">
            </div>
          </div>

          <!-- Contraseña -->
          <div class="space-y-1">
            <div class="flex justify-between items-center">
              <label for="login-password" class="block text-[10px] font-bold text-slate-300 uppercase tracking-wider">Contraseña</label>
            </div>
            <div class="relative">
              <span class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <i data-lucide="lock" class="h-4 w-4"></i>
              </span>
              <input type="password" id="login-password" required placeholder="••••••••" autocomplete="new-password" value=""
                     class="w-full pl-9 pr-10 py-2.5 rounded-xl text-xs glass-input text-slate-200 placeholder-slate-500">
              <button type="button" onclick="togglePasswordVisibility('login-password', 'login-password-eye')" class="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-white transition-colors" title="Mostrar contraseña">
                <i id="login-password-eye" data-lucide="eye" class="h-4 w-4"></i>
              </button>
            </div>
          </div>

          <!-- Botón de Envío -->
          <button type="submit" 
                  class="w-full py-2.5 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-bold transition-all hover:shadow-lg hover:shadow-brand-500/20 active:scale-[0.98] mt-6 flex items-center justify-center gap-2">
            <span>Iniciar Sesión</span>
            <i data-lucide="arrow-right" class="h-3.5 w-3.5"></i>
          </button>
        </form>

        <!-- Pie de página de login -->
        <div class="text-center text-[10px] text-body-muted pt-2 relative z-10 border-t border-slate-900/60">
          <p>LobbyTracker - Gestión de Audiencias</p>
        </div>
      </div>
    </div>
  `;
}

// =========================================================================
// INSPECTOR DE BASE DE DATOS - ESTADO Y COMPONENTE VISUAL
// =========================================================================

let inspectorState = {
  tables: [],
  selectedTable: 'solicitudes_sh',
  page: 1,
  limit: 10,
  search: '',
  columns: [],
  rows: [],
  total: 0,
  loading: false
};

async function initDatabaseInspector() {
  if (inspectorState.tables.length === 0) {
    try {
      const res = await fetch('/api/admin/inspector/tables');
      if (res.ok) {
        inspectorState.tables = await res.json();
        if (inspectorState.tables.length > 0) {
          inspectorState.selectedTable = inspectorState.tables.includes('solicitudes_sh') ? 'solicitudes_sh' : inspectorState.tables[0];
        }
      }
    } catch (e) {
      console.error('Error al inicializar tablas del inspector:', e);
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
      search: inspectorState.search
    });
    const res = await fetch(`/api/admin/inspector/data?${params.toString()}`);
    if (res.ok) {
      const result = await res.json();
      inspectorState.columns = result.columns;
      inspectorState.rows = result.rows;
      inspectorState.total = result.total;
    } else {
      showToast('Error al obtener datos de la tabla.', 'error');
    }
  } catch (e) {
    console.error('Error al obtener datos de la tabla:', e);
    showToast('Error al conectar con el inspector.', 'error');
  } finally {
    inspectorState.loading = false;
    updateInspectorUI();
  }
}

function renderDatabaseInspectorHtml() {
  // Disparar la inicialización en diferido
  if (inspectorState.tables.length === 0) {
    setTimeout(initDatabaseInspector, 0);
  }

  return `
    <div class="space-y-6 mt-6 animate-fade-in" id="database-inspector-root">
      ${renderDatabaseInspectorContent()}
    </div>
  `;
}

function updateInspectorUI() {
  const root = document.getElementById('database-inspector-root');
  if (root) {
    root.innerHTML = renderDatabaseInspectorContent();
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }
  }
}

function renderDatabaseInspectorContent() {
  if (inspectorState.loading && inspectorState.columns.length === 0) {
    return `
      <div class="h-64 flex flex-col items-center justify-center gap-4 animate-fade-in">
        <div class="w-12 h-12 border-4 border-slate-800 border-t-brand-500 rounded-full animate-spin"></div>
        <p class="text-sm text-slate-200 font-medium">Consultando tabla...</p>
      </div>
    `;
  }

  // Menú de selección de tablas
  const tableOptions = inspectorState.tables.map(t => 
    `<option value="${t}" ${inspectorState.selectedTable === t ? 'selected' : ''}>${t}</option>`
  ).join('');

  // Columnas y cabeceras
  let headersHtml = '';
  let colCount = inspectorState.columns.length || 1;
  if (inspectorState.columns.length > 0) {
    headersHtml = inspectorState.columns.map(col => 
      `<th class="px-3 py-3 text-left font-bold text-[10px] text-slate-400 uppercase tracking-wider font-mono select-none whitespace-nowrap" title="${col.type} ${col.notnull ? 'NOT NULL' : ''}">${escapeHtml(col.name)}</th>`
    ).join('');
  } else {
    headersHtml = `<th class="px-6 py-3 text-left">Columnas</th>`;
  }

  // Filas de datos
  let rowsHtml = '';
  if (inspectorState.rows.length === 0) {
    rowsHtml = `<tr><td colspan="${colCount}" class="px-6 py-8 text-center text-xs text-slate-400">La tabla está vacía o no tiene registros que coincidan con la búsqueda.</td></tr>`;
  } else {
    inspectorState.rows.forEach(row => {
      rowsHtml += `<tr class="hover:bg-slate-900/40 border-b border-slate-800 transition-colors">`;
      inspectorState.columns.forEach(col => {
        let val = row[col.name];
        let valStr = '';
        if (val === null || val === undefined) {
          valStr = `<span class="text-slate-600 font-mono italic text-[10px]">NULL</span>`;
        } else if (typeof val === 'object') {
          valStr = `<span class="text-slate-300 font-mono text-[11px]">${escapeHtml(JSON.stringify(val))}</span>`;
        } else {
          valStr = `<span class="text-slate-300 text-xs">${escapeHtml(String(val))}</span>`;
        }
        rowsHtml += `<td class="px-3 py-2.5 max-w-xs truncate font-medium align-middle" title="${escapeHtmlAttr(String(val || ''))}">${valStr}</td>`;
      });
      rowsHtml += `</tr>`;
    });
  }

  // Generar botones de paginación del inspector
  const totalPages = Math.ceil(inspectorState.total / inspectorState.limit);
  const startItem = inspectorState.total === 0 ? 0 : (inspectorState.page - 1) * inspectorState.limit + 1;
  const endItem = Math.min(inspectorState.page * inspectorState.limit, inspectorState.total);

  let pagesHtml = '';
  if (totalPages > 1) {
    const prevDisabled = inspectorState.page === 1;
    const nextDisabled = inspectorState.page === totalPages;

    pagesHtml += `
      <div class="flex items-center gap-1.5 font-sans">
        <button onclick="${prevDisabled ? '' : 'changeInspectorPage(' + (inspectorState.page - 1) + ')'}" 
                class="h-8 w-8 rounded-lg flex items-center justify-center border border-slate-700 bg-slate-900/60 text-slate-200 hover:text-white transition-all ${prevDisabled ? 'opacity-40 cursor-not-allowed' : 'hover:bg-slate-800'}">
          <i data-lucide="chevron-left" class="h-4 w-4"></i>
        </button>
        <span class="text-xs text-slate-200 px-2.5 font-semibold font-sans">Página ${inspectorState.page} de ${totalPages}</span>
        <button onclick="${nextDisabled ? '' : 'changeInspectorPage(' + (inspectorState.page + 1) + ')'}" 
                class="h-8 w-8 rounded-lg flex items-center justify-center border border-slate-700 bg-slate-900/60 text-slate-200 hover:text-white transition-all ${nextDisabled ? 'opacity-40 cursor-not-allowed' : 'hover:bg-slate-800'}">
          <i data-lucide="chevron-right" class="h-4 w-4"></i>
        </button>
      </div>
    `;
  }

  const paginationControlsHtml = `
    <div class="p-4 border-t border-slate-900 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-900/10">
      <div class="text-xs text-slate-300 font-semibold">
        Mostrando <span class="text-white font-bold">${startItem}</span> a <span class="text-white font-bold">${endItem}</span> de <span class="text-white font-bold">${inspectorState.total}</span> registros
      </div>
      ${pagesHtml}
    </div>
  `;

  return `
    <div class="flex flex-col md:flex-row gap-4 items-center justify-between">
      <div class="flex flex-col sm:flex-row gap-3 items-center w-full md:w-auto">
        <div class="flex items-center gap-2 shrink-0">
          <i data-lucide="database" class="h-4 w-4 text-brand-400"></i>
          <span class="text-xs font-bold text-slate-300 uppercase tracking-wider">Tabla:</span>
        </div>
        <select onchange="onInspectorTableChange(this.value)" class="w-full sm:w-56 px-3 py-2 rounded-xl text-xs glass-input focus:outline-none font-semibold text-slate-200">
          ${tableOptions}
        </select>
      </div>
      
      <div class="relative w-full md:w-80">
        <span class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
          <i data-lucide="search" class="h-4 w-4"></i>
        </span>
        <input type="text" oninput="onInspectorSearch(this.value)" placeholder="Buscar en tabla..." value="${escapeHtmlAttr(inspectorState.search)}" class="w-full py-2.5 pl-9 pr-4 rounded-xl text-xs glass-input focus:outline-none transition-colors text-slate-200">
      </div>
    </div>

    <!-- TABLA DE DATOS -->
    <div class="rounded-2xl overflow-hidden mt-4 border border-slate-700/40 glass-card">
      <div class="overflow-x-auto">
        <table class="w-full text-left border-collapse table-auto">
          <thead>
            <tr class="bg-slate-800/30 border-b border-slate-700/60 text-slate-400">
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

function onInspectorTableChange(table) {
  inspectorState.selectedTable = table;
  inspectorState.page = 1;
  inspectorState.search = '';
  fetchInspectorData();
}

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

let activeDbSubTab = 'sincronizacion';

function changeDbSubTab(subTabName) {
  activeDbSubTab = subTabName;
  const container = document.getElementById('main-content');
  if (container) {
    renderUsuarios(container);
  }
}

