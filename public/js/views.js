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
            <p class="text-xs text-body-muted font-semibold mt-1">100%</p>
          </div>
          <div class="space-y-1.5">
            <div class="w-full h-3 rounded-full overflow-hidden bg-slate-800 flex">
              <div class="h-full bg-deadline-ok" style="width: ${stats.respondidas.pctTotal}%"></div>
              <div class="h-full bg-deadline-pending" style="width: ${stats.pendientes.pctTotal}%"></div>
            </div>
            <div class="flex justify-between items-center text-[10px] text-body-muted font-semibold">
              <span>${formatPct(stats.respondidas.pctTotal, stats.totales.respondidas)} Respondidas (${stats.totales.respondidas})</span>
              <span>${formatPct(stats.pendientes.pctTotal, stats.totales.pendientes)} Pendientes (${stats.totales.pendientes})</span>
            </div>
          </div>
        </div>

        <!-- CARD RESPONDIDAS -->
        <div class="glass-card dashboard-card-interactive stagger-card p-6 rounded-2xl flex flex-col justify-between shadow-sm space-y-4" style="animation-delay: 100ms;">
          <div class="text-center">
            <span class="text-xs text-slate-300 font-bold uppercase tracking-widest">Solicitudes Respondidas</span>
            <h3 class="text-4xl font-extrabold text-heading mt-2" id="count-solicitudes-respondidas">${stats.totales.respondidas}</h3>
            <p class="text-xs text-body-muted font-semibold mt-1">${formatPct(stats.respondidas.pctTotal, stats.totales.respondidas)}</p>
          </div>
          <div class="space-y-1.5">
            <div class="w-full h-3 rounded-full overflow-hidden bg-slate-800 flex">
              <div class="h-full bg-deadline-ok" style="width: ${stats.respondidas.pctRdp}%"></div>
              <div class="h-full bg-deadline-overdue" style="width: ${stats.respondidas.pctRfp}%"></div>
            </div>
            <div class="flex justify-between items-center text-[10px] text-body-muted font-semibold">
              <span>${formatPct(stats.respondidas.pctRdp, stats.respondidas.rdp)} RDP (${stats.respondidas.rdp})</span>
              <span>${formatPct(stats.respondidas.pctRfp, stats.respondidas.rfp)} RFP (${stats.respondidas.rfp})</span>
            </div>
          </div>
        </div>

        <!-- CARD PENDIENTES -->
        <div class="glass-card dashboard-card-interactive stagger-card p-6 rounded-2xl flex flex-col justify-between shadow-sm space-y-4" style="animation-delay: 150ms;">
          <div class="text-center">
            <span class="text-xs text-slate-300 font-bold uppercase tracking-widest">Solicitudes Pendientes</span>
            <h3 class="text-4xl font-extrabold text-heading mt-2" id="count-solicitudes-pendientes">${stats.totales.pendientes}</h3>
            <p class="text-xs text-body-muted font-semibold mt-1">${formatPct(stats.pendientes.pctTotal, stats.totales.pendientes)}</p>
          </div>
          <div class="space-y-1.5">
            <div class="w-full h-3 rounded-full overflow-hidden bg-slate-800 flex">
              <div class="h-full bg-deadline-ok" style="width: ${stats.pendientes.pctDdp}%"></div>
              <div class="h-full bg-deadline-overdue" style="width: ${stats.pendientes.pctFdp}%"></div>
            </div>
            <div class="flex justify-between items-center text-[10px] text-body-muted font-semibold">
              <span>${formatPct(stats.pendientes.pctDdp, stats.pendientes.ddp)} DDP (${stats.pendientes.ddp})</span>
              <span>${formatPct(stats.pendientes.pctFdp, stats.pendientes.fdp)} FDP (${stats.pendientes.fdp})</span>
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
            <p class="text-xs text-body-muted font-semibold">${formatPct(stats.estados.aceptada.pct, stats.estados.aceptada.count)}</p>
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
            <p class="text-xs text-body-muted font-semibold">${formatPct(stats.estados.rechazada.pct, stats.estados.rechazada.count)}</p>
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
            <p class="text-xs text-body-muted font-semibold">${formatPct(stats.estados.suspendida.pct, stats.estados.suspendida.count)}</p>
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
            <p class="text-xs text-body-muted font-semibold">${formatPct(stats.estados.cancelada.pct, stats.estados.cancelada.count)}</p>
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
            <p class="text-xs text-body-muted font-semibold">${formatPct(stats.estados.encomendada.pct, stats.estados.encomendada.count)}</p>
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
            <p class="text-xs text-body-muted font-semibold">${formatPct(stats.totales.pctPublicadas, stats.totales.publicadas)}</p>
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
            <p class="text-xs text-body-muted font-semibold">${formatPct(stats.totales.pctPendientesPublicacion, stats.totales.pendientesPublicacion)}</p>
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
        if ((item.estado || '').toLowerCase() !== 'aceptada') return false;
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
          
          <div class="flex items-center gap-2.5 w-full sm:w-auto sm:justify-end shrink-0">
            <button id="btn-sincronizar-usuarios" onclick="confirmarSincronizacionUsuarios(this)" class="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2 transition-all hover:shadow-lg hover:shadow-emerald-500/20 shrink-0 cursor-pointer">
              <i data-lucide="cloud-lightning" class="h-4 w-4"></i> Sincronizar usuarios
            </button>
            <button id="btn-registrar-usuario" onclick="openUsuarioModal()" class="px-4 py-2.5 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2 transition-all hover:shadow-lg hover:shadow-brand-500/20 shrink-0 cursor-pointer">
              <i data-lucide="plus" class="h-4 w-4"></i> Registrar Usuario
            </button>
          </div>
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
                Seleccione el archivo de datos Excel ('.xlsx') y luego haga clic en "Procesar e Importar Excel" para actualizar los datos locales y subirlos a SharePoint. O haga clic en "Sincronizar desde SharePoint" para descargar cualquier versión más reciente de la nube.
              </p>
              <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div class="border rounded-xl p-4" style="background-color: var(--bg-main); border-color: var(--border-ui);">
                  <span class="text-[10px] text-body-muted font-bold uppercase tracking-wider block mb-1">Archivo de Origen</span>
                  <span class="text-xs font-mono text-heading font-semibold break-all">lobby_data.xlsx</span>
                </div>
                <div class="border rounded-xl p-4" style="background-color: var(--bg-main); border-color: var(--border-ui);">
                  <span class="text-[10px] text-body-muted font-bold uppercase tracking-wider block mb-1">Ruta en Servidor (%APPDATA%)</span>
                  <span class="text-[10px] font-mono text-heading font-semibold break-all" title="${dataStore.dbHealth?.excelPath || '-'}">${dataStore.dbHealth?.excelPath || '-'}</span>
                </div>
                <div class="border rounded-xl p-4" style="background-color: var(--bg-main); border-color: var(--border-ui);">
                  <span class="text-[10px] text-body-muted font-bold uppercase tracking-wider block mb-1">Última Sincronización</span>
                  <span class="text-xs font-mono text-heading font-semibold break-all">${lastSyncStr}</span>
                </div>
              </div>

              <!-- Selector de Archivo Excel con soporte de Drag & Drop -->
              <div class="border-2 border-dashed border-slate-700/60 rounded-xl p-5 text-center hover:border-brand-500 transition-colors cursor-pointer bg-slate-950/40 relative" 
                   onclick="document.getElementById('import-excel-file').click()"
                   ondragover="event.preventDefault(); this.classList.add('border-brand-500')"
                   ondragleave="this.classList.remove('border-brand-500')"
                   ondrop="event.preventDefault(); this.classList.remove('border-brand-500'); if(event.dataTransfer.files.length) { document.getElementById('import-excel-file').files = event.dataTransfer.files; handleExcelFileSelected({target: document.getElementById('import-excel-file')}); }">
                <input type="file" id="import-excel-file" accept=".xlsx" class="hidden" onchange="handleExcelFileSelected(event)">
                <div class="space-y-2 pointer-events-none">
                  <i data-lucide="file-spreadsheet" class="h-8 w-8 text-slate-400 mx-auto"></i>
                  <p class="text-xs font-semibold text-slate-300" id="excel-file-label">Haz clic para buscar o arrastra aquí tu archivo Excel</p>
                  <p class="text-[10px] text-slate-500" id="excel-file-details">Solo formato .xlsx (Ley de Lobby)</p>
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
                <button id="btn-import-sync" onclick="triggerImport()" disabled class="flex-1 py-3 bg-slate-800 text-slate-500 rounded-xl text-xs font-bold transition-all cursor-not-allowed flex items-center justify-center gap-2">
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
  } else if (activeAdminTab === 'logs') {
    contentHtml = renderLogsTabHtml();
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
        <button onclick="changeAdminTab('logs')" class="border-b-2 py-3.5 px-1 text-xs font-bold transition-all ${activeAdminTab === 'logs' ? 'border-brand-500 text-brand-600 dark:text-brand-400' : 'border-transparent text-body-muted hover:text-heading hover:border-slate-300 dark:hover:border-slate-700'} flex items-center gap-2 focus:outline-none shrink-0">
          <i data-lucide="file-text" class="h-4 w-4"></i>
          Bitácora de Logs
        </button>
      </nav>
    </div>

    ${contentHtml}
  `;

  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }

  if (activeAdminTab === 'logs' && typeof refreshAdminLogs === 'function') {
    setTimeout(refreshAdminLogs, 50);
  }
}

// RENDER: PESTAÑA BITÁCORA DE LOGS
function renderLogsTabHtml() {
  return `
    <div class="space-y-4">
      ${renderGlassCard(`
        <!-- Header de la bitácora -->
        <div class="border-b border-slate-800/60 pb-4 flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="h-9 w-9 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center shrink-0">
              <i data-lucide="file-text" class="h-4.5 w-4.5"></i>
            </div>
            <div>
              <h3 class="text-xs font-bold uppercase tracking-wider text-heading">Bitácora de Errores</h3>
              <p class="text-[10px] text-slate-500 mt-0.5">Últimos 200 eventos registrados por el sistema</p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <span id="logs-count-badge" class="inline-flex items-center justify-center min-w-[24px] h-6 px-2 rounded-full bg-slate-800 border border-slate-700 text-[10px] font-bold text-slate-300 tabular-nums">—</span>
            <button onclick="refreshAdminLogs()" class="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1.5 active:scale-[0.95] border border-slate-700">
              <i data-lucide="refresh-cw" class="h-3 w-3"></i> Actualizar
            </button>
          </div>
        </div>

        <!-- Leyenda de severidad -->
        <div class="flex items-center gap-4 pt-3 pb-1">
          <div class="flex items-center gap-1.5">
            <span class="inline-block w-2 h-2 rounded-full bg-rose-500"></span>
            <span class="text-[9px] text-slate-500 font-medium">Crítico</span>
          </div>
          <div class="flex items-center gap-1.5">
            <span class="inline-block w-2 h-2 rounded-full bg-amber-500"></span>
            <span class="text-[9px] text-slate-500 font-medium">Advertencia</span>
          </div>
          <div class="flex items-center gap-1.5">
            <span class="inline-block w-2 h-2 rounded-full bg-sky-500"></span>
            <span class="text-[9px] text-slate-500 font-medium">Autenticación</span>
          </div>
          <div class="flex items-center gap-1.5">
            <span class="inline-block w-2 h-2 rounded-full bg-slate-500"></span>
            <span class="text-[9px] text-slate-500 font-medium">Info</span>
          </div>
          <span class="ml-auto text-[9px] text-slate-600 italic">Clic en una fila para ver detalles</span>
        </div>

        <!-- Tabla de logs -->
        <div class="overflow-x-auto rounded-xl border border-slate-800/60 mt-2">
          <table class="w-full text-left">
            <thead>
              <tr class="bg-slate-900/60 border-b border-slate-800/60">
                <th class="py-2.5 px-3 text-[9px] font-bold text-slate-500 uppercase tracking-widest w-[140px]">Fecha / Hora</th>
                <th class="py-2.5 px-3 text-[9px] font-bold text-slate-500 uppercase tracking-widest w-[120px]">Código</th>
                <th class="py-2.5 px-3 text-[9px] font-bold text-slate-500 uppercase tracking-widest">Mensaje</th>
                <th class="py-2.5 px-3 text-[9px] font-bold text-slate-500 uppercase tracking-widest w-[80px]"></th>
              </tr>
            </thead>
            <tbody id="logs-table-body">
              <tr><td colspan="4" class="text-center py-8 text-slate-500 text-xs">Cargando registros...</td></tr>
            </tbody>
          </table>
        </div>
      `, 'rounded-2xl p-6 shadow-sm')}
    </div>
  `;
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
          <td class="px-2 text-xs text-left w-32">
            <div class="font-medium text-slate-200">${item.fechaIngreso}</div>
            ${item.fechaLimiteRespuesta ? `<div class="text-[10px] text-slate-400 mt-0.5" title="Plazo Legal Límite de Respuesta">${item.fechaLimiteRespuesta}</div>` : ''}
          </td>
          <td class="px-2 text-xs text-left w-32">
            <div class="font-medium text-slate-200">${item.fechaAgendada}</div>
            ${item.fechaLimitePublicacion ? `<div class="text-[10px] text-slate-400 mt-0.5" title="Plazo Límite de Publicación">${item.fechaLimitePublicacion}</div>` : ''}
          </td>
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
      exportBtnContainer.className = "flex items-center gap-2.5";
      exportBtnContainer.innerHTML = `
        <div class="flex items-center gap-2 mr-1">
          <label class="flex items-center gap-1 text-[10px] text-slate-300 font-semibold cursor-pointer select-none">
            <input type="checkbox" id="batch-reportes-solo-vigentes" class="rounded border-slate-700 bg-slate-900/40 text-blue-500 focus:ring-blue-500/20" checked>
            <span>Solo vigentes</span>
          </label>
          <button onclick="generarReportesMasivos()" class="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-[10px] font-semibold flex items-center gap-1 transition-all shadow-sm">
            <i data-lucide="files" class="h-3 w-3"></i>
            Generación Masiva
          </button>
        </div>
        
        <div class="h-4 w-[1px] bg-slate-700/60 mx-1"></div>

        ${totalItems > 0 ? `
          <button onclick="exportReportToPDF()" class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm">
            <i data-lucide="file-down" class="h-3.5 w-3.5"></i>
            Exportar PDF
          </button>
        ` : ''}
      `;
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
            placeholder: 'Vigentes o escribir nombre...',
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
          <div id="reportes-export-btn-container" class="flex items-center gap-2.5">
            <div class="flex items-center gap-2 mr-1">
              <label class="flex items-center gap-1 text-[10px] text-slate-300 font-semibold cursor-pointer select-none">
                <input type="checkbox" id="batch-reportes-solo-vigentes" class="rounded border-slate-700 bg-slate-900/40 text-blue-500 focus:ring-blue-500/20" checked>
                <span>Solo vigentes</span>
              </label>
              <button onclick="generarReportesMasivos()" class="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-[10px] font-semibold flex items-center gap-1 transition-all shadow-sm">
                <i data-lucide="files" class="h-3 w-3"></i>
                Generación Masiva
              </button>
            </div>
            
            <div class="h-4 w-[1px] bg-slate-700/60 mx-1"></div>

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
                <th class="px-2 py-3 w-36 text-left">
                  <div>Fecha Ingreso</div>
                  <div class="text-[9px] font-normal text-slate-500 mt-0.5 normal-case tracking-normal">Plazo Respuesta</div>
                </th>
                <th class="px-2 py-3 w-36 text-left">
                  <div>Fecha Agenda</div>
                  <div class="text-[9px] font-normal text-slate-500 mt-0.5 normal-case tracking-normal">Plazo Publicación</div>
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
async function renderLogin(container) {
  const isElectron = window.location.search.includes('platform=electron') || window.navigator.userAgent.toLowerCase().includes('electron');

  let isInitialized = true;
  if (isElectron) {
    try {
      const res = await fetch('/api/auth/status');
      const data = await res.json();
      isInitialized = !!(data && data.initialized);
    } catch (e) {
      console.warn('Error al verificar estado de inicialización:', e);
    }
  }

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
            <h1 class="text-2xl font-extrabold text-heading tracking-tight text-white">LobbyControl</h1>
            <p class="text-xs text-body-muted mt-1 font-medium">Gestión de Audiencias - Ley N° 20.730</p>
          </div>
        </div>

        <!-- Mensaje de Error (Oculto por defecto) -->
        <div id="login-error" class="hidden px-4 py-3 rounded-xl bg-rose-950/40 border border-rose-900/60 text-rose-300 text-xs font-semibold flex items-center gap-2">
          <i data-lucide="alert-circle" class="h-4 w-4 shrink-0"></i>
          <span id="login-error-text">Credenciales inválidas. Inténtelo de nuevo.</span>
        </div>

        <!-- Opción Microsoft SSO (Solo en Electron) -->
        ${isElectron ? `
        <div id="sso-container" class="space-y-4 relative z-10 text-center">
          <button id="btn-sso-login" onclick="triggerSsoLogin()" 
                  class="w-full py-3 bg-[#2f2f2f] hover:bg-[#3f3f3f] text-white rounded-xl text-xs font-bold transition-all hover:shadow-lg mt-2 flex items-center justify-center gap-2.5 border border-slate-700 active:scale-[0.98]">
            <svg style="width: 18px; height: 18px; flex-shrink: 0;" viewBox="0 0 23 23" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M0 0H11V11H0V0Z" fill="#F25022"/>
              <path d="M12 0H23V11H12V0Z" fill="#7FBA00"/>
              <path d="M0 12H11V23H0V12Z" fill="#00A4EF"/>
              <path d="M12 12H23V23H12V12Z" fill="#FFB900"/>
            </svg>
            <span id="btn-sso-text">Iniciar sesión</span>
          </button>
        </div>
        ` : ''}

        <!-- Pie de página de login -->
        <div class="text-center text-[10px] text-body-muted pt-2 relative z-10 border-t border-slate-900/60">
          <p>LobbyControl - Gestión de Audiencias</p>
        </div>
      </div>
    </div>
  `;

  // Inicializar íconos de Lucide tras inyectar el HTML
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
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

// ==========================================
// VISTA: CENTRO DE ALERTAS
// ==========================================
let activeAlertasTab = 'no_leidas';
let alertasSearchQuery = '';

function renderAlertasCentro(container) {
  if (!container) return;

  const allAlerts = getActiveAlertsList(true);
  const unreadAlerts = allAlerts.filter(w => w.estado_gestion !== 'leida');
  const readAlerts = allAlerts.filter(w => w.estado_gestion === 'leida');

  const activeList = activeAlertasTab === 'no_leidas' ? unreadAlerts : readAlerts;
  const filteredList = activeList.filter(w => {
    if (!alertasSearchQuery) return true;
    const query = alertasSearchQuery.toLowerCase();
    return (
      (w.sujeto_pasivo || '').toLowerCase().includes(query) ||
      (w.folio || '').toLowerCase().includes(query) ||
      (w.text || '').toLowerCase().includes(query)
    );
  });

  const tabsHtml = `
    <div class="flex border-b border-[var(--border-ui)] mb-6 gap-2">
      <button onclick="switchAlertasTab('no_leidas')" class="px-4 py-2.5 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
        activeAlertasTab === 'no_leidas'
          ? 'border-brand-500 text-[var(--text-primary)] font-bold'
          : 'border-transparent text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'
      }">
        <i data-lucide="bell" class="h-4 w-4"></i>
        No leídas
        <span class="px-1.5 py-0.5 rounded-full text-[10px] bg-brand-500/20 text-brand-700 dark:text-brand-300 font-bold">
          ${unreadAlerts.length}
        </span>
      </button>
      <button onclick="switchAlertasTab('leidas')" class="px-4 py-2.5 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
        activeAlertasTab === 'leidas'
          ? 'border-brand-500 text-[var(--text-primary)] font-bold'
          : 'border-transparent text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'
      }">
        <i data-lucide="archive" class="h-4 w-4"></i>
        Leídas / Historial
        <span class="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-400 font-bold">
          ${readAlerts.length}
        </span>
      </button>
    </div>
  `;

  let actionButtonsHtml = '';
  if (activeAlertasTab === 'no_leidas' && unreadAlerts.length > 0) {
    actionButtonsHtml = `
      <button onclick="bulkChangeAlertaEstado('leida')" class="btn-secondary px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm cursor-pointer whitespace-nowrap">
        <i data-lucide="check-check" class="h-4 w-4 text-emerald-600 dark:text-emerald-400"></i>
        Descartar todo
      </button>
    `;
  } else if (activeAlertasTab === 'leidas' && readAlerts.length > 0) {
    actionButtonsHtml = `
      <button onclick="bulkChangeAlertaEstado('borrada')" class="px-3.5 py-2 rounded-xl text-xs font-bold bg-rose-50 dark:bg-rose-950/10 hover:bg-rose-100 dark:hover:bg-rose-900/20 border border-rose-200 dark:border-rose-800/30 text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 transition-all flex items-center gap-1.5 shadow-sm cursor-pointer whitespace-nowrap">
        <i data-lucide="trash-2" class="h-4 w-4"></i>
        Borrar historial
      </button>
    `;
  }

  let listHtml = '';
  if (filteredList.length === 0) {
    const isSearch = !!alertasSearchQuery;
    listHtml = `
      <div class="text-center py-16 border border-dashed border-[var(--border-ui)] rounded-2xl bg-slate-900/5 dark:bg-slate-900/10">
        <i data-lucide="${isSearch ? 'search' : (activeAlertasTab === 'no_leidas' ? 'check-circle' : 'archive')}" class="h-12 w-12 ${isSearch ? 'text-[var(--text-tertiary)]' : (activeAlertasTab === 'no_leidas' ? 'text-emerald-500/80' : 'text-[var(--text-tertiary)]')} mx-auto mb-3"></i>
        <h3 class="text-sm font-bold text-[var(--text-primary)]">${isSearch ? 'Sin resultados' : (activeAlertasTab === 'no_leidas' ? '¡Todo al día!' : 'Historial vacío')}</h3>
        <p class="text-xs text-[var(--text-tertiary)] mt-1 max-w-md mx-auto">
          ${isSearch ? 'Intente buscar con otros términos o revise los filtros.' : (activeAlertasTab === 'no_leidas' ? 'No tienes alertas pendientes de lectura.' : 'Aquí se guardarán las alertas que descartes desde la campanita.')}
        </p>
      </div>
    `;
  } else {
    listHtml = `
      <div class="grid grid-cols-1 gap-3.5">
        ${filteredList.map(w => {
          const typeBadge = w.type === 'solicitud' 
            ? `<span class="bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-200/50 dark:border-indigo-500/20 text-[9px] px-2 py-0.5 rounded-lg font-bold uppercase tracking-wider">Solicitud</span>`
            : w.type === 'agenda'
              ? `<span class="bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-200/50 dark:border-emerald-500/20 text-[9px] px-2 py-0.5 rounded-lg font-bold uppercase tracking-wider text-emerald-500">Agenda</span>`
              : `<span class="bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-200/50 dark:border-purple-500/20 text-[9px] px-2 py-0.5 rounded-lg font-bold uppercase tracking-wider">Publicación</span>`;
          
          const urgencyBadge = w.color === 'red'
            ? `<span class="flex h-2.5 w-2.5 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(239,68,68,0.5)] animate-pulse shrink-0 mt-1.5"></span>`
            : w.color === 'blue'
              ? `<span class="flex h-2.5 w-2.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)] animate-pulse shrink-0 mt-1.5"></span>`
              : `<span class="flex h-2.5 w-2.5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)] shrink-0 mt-1.5"></span>`;
 
          const dateIconHtml = `<i data-lucide="calendar" class="h-3.5 w-3.5 inline text-[var(--text-tertiary)] mr-1 align-text-bottom"></i>`;
 
          const toggleReadBtn = w.estado_gestion === 'leida'
            ? `<button onclick="changeAlertaEstado('${w.type}', '${w.id}', null)" class="alert-action-btn btn-unread" title="Reactivar alerta (devolver a campanita)">
                 <i data-lucide="rotate-ccw" class="h-4 w-4"></i>
               </button>`
            : `<button onclick="changeAlertaEstado('${w.type}', '${w.id}', 'leida')" class="alert-action-btn btn-read" title="Marcar como leída (descartar de campanita)">
                 <i data-lucide="check" class="h-4 w-4"></i>
               </button>`;
 
          return `
            <div class="glass-card px-6 py-5 rounded-2xl ${w.color === 'red' ? 'card-alert-urgent' : w.color === 'blue' ? 'card-alert-info' : 'card-alert-warning'} flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all hover:bg-slate-50/40 dark:hover:bg-slate-900/10 group font-sans">
              <div class="flex gap-3.5 items-start text-left min-w-0">
                ${urgencyBadge}
                <div class="min-w-0">
                  <div class="flex items-center gap-2 mb-1.5 flex-wrap">
                    ${typeBadge}
                    <span class="text-xs text-[var(--text-secondary)] font-medium">Folio: <span class="font-mono text-[var(--text-primary)] font-bold">${w.folio}</span></span>
                  </div>
                  <h4 class="text-sm font-bold text-[var(--text-primary)] truncate">${w.sujeto_pasivo || 'Sujeto Pasivo'}</h4>
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
        }).join('')}
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

  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
}

function switchAlertasTab(tab) {
  activeAlertasTab = tab;
  const container = document.getElementById('main-content');
  renderAlertasCentro(container);
}

function onAlertasSearch(val) {
  alertasSearchQuery = val;
  const container = document.getElementById('main-content');
  renderAlertasCentro(container);
}

// Acción individual: Cambiar estado (leída / no leída)
async function changeAlertaEstado(type, id, estado) {
  try {
    const res = await fetch('/api/alertas/gestionar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        alertas: [{ tipo: type, solicitud_id: id, estado: estado }]
      })
    });
    if (res.ok) {
      showToast(estado === 'leida' ? 'Alerta marcada como leída.' : 'Alerta marcada como no leída.');
      await fetchAlertas();
    } else {
      showToast('Error al actualizar el estado de la alerta.', 'error');
    }
  } catch (err) {
    console.error(err);
    showToast('Error de red al actualizar la alerta.', 'error');
  }
}

// Acción individual: Borrar alerta (estado = 'borrada')
function deleteAlerta(type, id) {
  openConfirmModal(
    'Eliminar Alerta del Historial',
    '¿Estás seguro de que deseas eliminar permanentemente esta alerta del historial? Ya no volverá a aparecer en el Centro de Alertas.',
    async () => {
      try {
        const res = await fetch('/api/alertas/gestionar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            alertas: [{ tipo: type, solicitud_id: id, estado: 'borrada' }]
          })
        });
        if (res.ok) {
          showToast('Alerta eliminada con éxito.');
          await fetchAlertas();
        } else {
          showToast('Error al eliminar la alerta.', 'error');
        }
      } catch (err) {
        console.error(err);
        showToast('Error de red al eliminar la alerta.', 'error');
      }
    }
  );
}

// Acción bulk: Marcar todas como leídas o borrar todo el historial
function bulkChangeAlertaEstado(estado) {
  const allAlerts = getActiveAlertsList(true);
  let targetAlerts = [];
  let modalTitle = '';
  let modalText = '';

  if (estado === 'leida') {
    targetAlerts = allAlerts.filter(w => w.estado_gestion !== 'leida');
    if (targetAlerts.length === 0) return;
    modalTitle = 'Descartar todas las Alertas';
    modalText = '¿Estás seguro de que deseas marcar todas las alertas actuales como leídas?';
  } else if (estado === 'borrada') {
    targetAlerts = allAlerts.filter(w => w.estado_gestion === 'leida');
    if (targetAlerts.length === 0) return;
    modalTitle = 'Limpiar Historial de Alertas';
    modalText = '¿Estás seguro de que deseas borrar permanentemente todo el historial de alertas leídas? Esta acción no se puede deshacer.';
  }

  const performBulk = async () => {
    try {
      const alertasToManage = targetAlerts.map(w => ({
        tipo: w.type,
        solicitud_id: w.id,
        estado: estado
      }));

      const res = await fetch('/api/alertas/gestionar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alertas: alertasToManage })
      });

      if (res.ok) {
        showToast(estado === 'leida' ? 'Todas las alertas fueron marcadas como leídas.' : 'Historial de alertas limpio con éxito.');
        await fetchAlertas();
      } else {
        showToast('Error al procesar la acción en lote.', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Error de red al realizar la acción en lote.', 'error');
    }
  };

  openConfirmModal(modalTitle, modalText, performBulk);
}

// =========================================================================
// MÓDULO DE AGENDA Y CALENDARIO DE AUDIENCIAS
// =========================================================================

function formatLocalDateYYYYMMDD(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getCalendarActiveTitle() {
  const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const year = currentCalendarDate.getFullYear();
  
  if (calendarViewMode === 'month') {
    return `${months[currentCalendarDate.getMonth()]} ${year}`;
  } else if (calendarViewMode === 'week') {
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
  let start = '';
  let end = '';
  
  if (calendarViewMode === 'month') {
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
    
    start = formatLocalDateYYYYMMDD(startDate) + ' 00:00:00';
    end = formatLocalDateYYYYMMDD(endDate) + ' 23:59:59';
  } else if (calendarViewMode === 'week') {
    const currentDayOfWeek = currentCalendarDate.getDay();
    const daysToMon = currentDayOfWeek === 0 ? -6 : 1 - currentDayOfWeek;
    
    const monDate = new Date(currentCalendarDate);
    monDate.setDate(monDate.getDate() + daysToMon);
    
    const sunDate = new Date(monDate);
    sunDate.setDate(sunDate.getDate() + 6);
    
    start = formatLocalDateYYYYMMDD(monDate) + ' 00:00:00';
    end = formatLocalDateYYYYMMDD(sunDate) + ' 23:59:59';
  } else {
    const dateStr = formatLocalDateYYYYMMDD(currentCalendarDate);
    start = dateStr + ' 00:00:00';
    end = dateStr + ' 23:59:59';
  }
  
  return { start, end };
}

async function fetchAndDrawCalendar() {
  const placeholder = document.getElementById('calendar-content-placeholder');
  if (!placeholder) return;
  
  placeholder.innerHTML = `
    <div class="absolute inset-0 flex items-center justify-center bg-slate-950/10 backdrop-blur-[1px] rounded-2xl min-h-[300px]">
      <div class="h-8 w-8 rounded-full border-2 border-brand-500 border-t-transparent animate-spin"></div>
    </div>
  `;
  
  const range = calculateCalendarDateRange();
  
  try {
    const params = new URLSearchParams({
      all: 'true',
      estado: 'Aceptada',
      fecha_agendada_desde: range.start,
      fecha_agendada_hasta: range.end
    });
    
    const res = await fetch(`/api/solicitudes?${params.toString()}`);
    if (res.ok) {
      calendarEvents = await res.json();
      drawCalendarBodyOnly();
    } else {
      placeholder.innerHTML = `
        <div class="py-20 text-center glass-card rounded-2xl border border-slate-800">
          <i data-lucide="alert-circle" class="h-10 w-10 text-rose-500/80 mx-auto mb-3 animate-pulse"></i>
          <p class="text-xs text-rose-400 font-semibold">Error al cargar datos del calendario.</p>
        </div>
      `;
      lucide.createIcons();
    }
  } catch (err) {
    console.error(err);
    placeholder.innerHTML = `
      <div class="py-20 text-center glass-card rounded-2xl border border-slate-800">
        <i data-lucide="alert-circle" class="h-10 w-10 text-rose-500/80 mx-auto mb-3 animate-pulse"></i>
        <p class="text-xs text-rose-400 font-semibold">Error de conexión al cargar el calendario.</p>
        <p class="text-[10px] text-slate-500 mt-2 font-mono">Detalle: ${escapeHtml(err.message || String(err))}</p>
      </div>
    `;
    lucide.createIcons();
  }
}

function drawCalendarBodyOnly() {
  const titleDisplay = document.getElementById('calendar-title-display');
  if (titleDisplay) {
    titleDisplay.textContent = getCalendarActiveTitle();
  }
  
  let filtered = calendarEvents || [];
  if (calendarFilters.search) {
    const query = calendarFilters.search.toLowerCase().trim();
    filtered = filtered.filter(e => 
      (e.sujeto_pasivo || '').toLowerCase().includes(query) ||
      (e.sujeto_activo || '').toLowerCase().includes(query) ||
      (e.folio_lobby || '').toLowerCase().includes(query) ||
      (e.materia || '').toLowerCase().includes(query)
    );
  }
  
  const placeholder = document.getElementById('calendar-content-placeholder');
  if (!placeholder) return;
  
  if (calendarViewMode === 'month') {
    drawMonthView(placeholder, filtered);
  } else if (calendarViewMode === 'week') {
    drawWeekView(placeholder, filtered);
  } else {
    drawDayView(placeholder, filtered);
  }
}

function drawMonthView(container, events) {
  const year = currentCalendarDate.getFullYear();
  const month = currentCalendarDate.getMonth();
  
  const firstDayOfMonth = new Date(year, month, 1);
  const startDay = firstDayOfMonth.getDay();
  let prevMonthDaysCount = startDay === 0 ? 6 : startDay - 1;
  
  const gridStartDate = new Date(firstDayOfMonth);
  gridStartDate.setDate(gridStartDate.getDate() - prevMonthDaysCount);
  
  let html = `
    <div class="grid grid-cols-7 gap-px bg-slate-800/80 rounded-2xl overflow-hidden border border-slate-800/60 shadow-xl">
      <!-- Headers -->
      ${['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'].map(day => `
        <div class="py-3 text-center text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-950/80 border-b border-slate-800/80 select-none">
          ${day}
        </div>
      `).join('')}
  `;
  
  const today = new Date();
  const todayStr = formatLocalDateYYYYMMDD(today);
  const tempDate = new Date(gridStartDate);
  
  for (let i = 0; i < 42; i++) {
    const tempDateStr = formatLocalDateYYYYMMDD(tempDate);
    const isCurrentMonth = tempDate.getMonth() === month;
    const isToday = tempDateStr === todayStr;
    
    const cellEvents = events.filter(e => e.fecha_agendada && e.fecha_agendada.startsWith(tempDateStr));
    
    html += `
      <div class="calendar-cell bg-slate-950/40 p-2 flex flex-col justify-between border border-slate-900/40 relative ${
        isToday 
          ? 'ring-1 ring-brand-500/50 bg-brand-500/[0.02]' 
          : ''
      }">
        <div class="flex justify-between items-center mb-1.5 select-none">
          <span class="text-xs font-bold ${
            isToday 
              ? 'text-brand-400 bg-brand-500/10 px-1.5 py-0.5 rounded-lg border border-brand-500/20' 
              : (isCurrentMonth ? 'text-slate-200' : 'text-slate-600')
          }">
            ${tempDate.getDate()}
          </span>
          ${cellEvents.length > 0 ? `
            <span class="px-1.5 py-0.5 rounded-lg text-[9px] font-bold bg-slate-800/80 text-slate-400 border border-slate-800/50">
              ${cellEvents.length}
            </span>
          ` : ''}
        </div>
        <div class="flex-1 overflow-y-auto max-h-[84px] space-y-1 custom-scrollbar text-left pr-0.5">
          ${cellEvents.map(e => {
            const isPast = e.fecha_agendada && e.fecha_agendada.split(' ')[0] < todayStr;
            const timeStr = e.fecha_agendada && e.fecha_agendada.split(' ')[1] 
              ? e.fecha_agendada.split(' ')[1].slice(0, 5) 
              : '';
            
            return `
              <div onclick="showAgendaDetailsModal(${e.id})" 
                   class="text-[9px] p-1 rounded-lg truncate cursor-pointer transition-all hover:-translate-y-px active:translate-y-0 ${
                     isPast 
                       ? 'bg-slate-900/60 text-slate-400 border border-slate-800/50 hover:bg-slate-900' 
                       : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/25'
                   } font-medium flex items-center justify-between gap-1 select-none"
                   title="${escapeHtmlAttr(e.sujeto_pasivo)} - ${escapeHtmlAttr(e.materia || '')}">
                <span class="font-mono text-[8px] font-bold shrink-0 opacity-80">${timeStr}</span>
                <span class="truncate flex-1">${escapeHtml(e.sujeto_pasivo)}</span>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
    
    tempDate.setDate(tempDate.getDate() + 1);
  }
  
  html += `</div>`;
  container.innerHTML = html;
}

function drawWeekView(container, events) {
  const currentDayOfWeek = currentCalendarDate.getDay();
  const daysToMon = currentDayOfWeek === 0 ? -6 : 1 - currentDayOfWeek;
  
  const monDate = new Date(currentCalendarDate);
  monDate.setDate(monDate.getDate() + daysToMon);
  
  const today = new Date();
  const todayStr = formatLocalDateYYYYMMDD(today);
  
  let html = `<div class="grid grid-cols-1 md:grid-cols-7 gap-3.5 h-full">`;
  const tempDate = new Date(monDate);
  
  for (let i = 0; i < 7; i++) {
    const tempDateStr = formatLocalDateYYYYMMDD(tempDate);
    const isToday = tempDateStr === todayStr;
    
    const cellEvents = events.filter(e => e.fecha_agendada && e.fecha_agendada.startsWith(tempDateStr));
    const dayNames = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
    
    html += `
      <div class="glass-card flex flex-col h-full rounded-2xl border ${
        isToday 
          ? 'border-brand-500 bg-brand-500/[0.01]' 
          : 'border-slate-800/80 bg-slate-950/20'
      } p-3.5 min-h-[400px]">
        <div class="border-b border-slate-800/80 pb-2 mb-3.5 text-center select-none">
          <p class="text-[10px] font-bold uppercase tracking-wider ${isToday ? 'text-brand-400' : 'text-slate-400'}">${dayNames[i]}</p>
          <p class="text-lg font-bold mt-0.5 ${isToday ? 'text-brand-500' : 'text-slate-200'}">${tempDate.getDate()}</p>
        </div>
        <div class="flex-1 overflow-y-auto space-y-2.5 pr-1 custom-scrollbar">
          ${cellEvents.length === 0 ? `
            <div class="h-full flex items-center justify-center py-20">
              <p class="text-[10px] text-slate-600 font-medium italic select-none">Sin reuniones</p>
            </div>
          ` : cellEvents.map(e => {
            const isPast = e.fecha_agendada && e.fecha_agendada.split(' ')[0] < todayStr;
            const timeStr = e.fecha_agendada && e.fecha_agendada.split(' ')[1] 
              ? e.fecha_agendada.split(' ')[1].slice(0, 5) 
              : '';
            
            return `
              <div onclick="showAgendaDetailsModal(${e.id})" 
                   class="p-3 rounded-xl border border-slate-800 cursor-pointer text-left transition-all hover:-translate-y-0.5 active:translate-y-0 ${
                     isPast 
                       ? 'bg-slate-900/30 text-slate-400 border-slate-800/50 hover:bg-slate-900/50' 
                       : 'bg-emerald-500/5 text-emerald-300 border-emerald-500/20 hover:bg-emerald-500/10'
                   }">
                <div class="flex items-center justify-between mb-1.5 select-none">
                  <span class="text-[9px] font-bold font-mono ${isPast ? 'text-slate-500' : 'text-emerald-400'}">${timeStr}</span>
                  <span class="text-[8px] font-semibold text-slate-500">Folio ${e.folio_lobby || 's/f'}</span>
                </div>
                <h4 class="text-xs font-bold text-slate-200 truncate" title="${escapeHtmlAttr(e.sujeto_pasivo)}">${escapeHtml(e.sujeto_pasivo)}</h4>
                <p class="text-[9px] text-slate-400 truncate mt-0.5" title="${escapeHtmlAttr(e.sujeto_activo || 'Lobbista')}">${escapeHtml(e.sujeto_activo || 'Sin Lobbista')}</p>
                <p class="text-[9px] text-slate-400 line-clamp-2 mt-2 italic border-l border-slate-800 pl-2 leading-relaxed" title="${escapeHtmlAttr(e.materia || '')}">${escapeHtml(e.materia || 'Sin materia')}</p>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
    
    tempDate.setDate(tempDate.getDate() + 1);
  }
  
  html += `</div>`;
  container.innerHTML = html;
}

function drawDayView(container, events) {
  const today = new Date();
  const todayStr = formatLocalDateYYYYMMDD(today);
  const activeDateStr = formatLocalDateYYYYMMDD(currentCalendarDate);
  
  const cellEvents = events.filter(e => e.fecha_agendada && e.fecha_agendada.startsWith(activeDateStr));
  
  let html = `
    <div class="max-w-2xl mx-auto glass-card rounded-3xl border border-slate-800/80 p-6 shadow-xl bg-slate-950/20">
      <div class="border-b border-slate-800/80 pb-4 mb-4 flex justify-between items-center select-none">
        <div class="text-left">
          <h3 class="text-sm font-bold text-slate-200">Reuniones del Día</h3>
          <p class="text-xs text-slate-400">${formatDate(activeDateStr)}</p>
        </div>
        <span class="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-900 border border-slate-800 text-slate-300">
          ${cellEvents.length} ${cellEvents.length === 1 ? 'Reunión' : 'Reuniones'}
        </span>
      </div>
      
      <div class="space-y-4">
        ${cellEvents.length === 0 ? `
          <div class="py-16 text-center select-none">
            <i data-lucide="calendar" class="h-10 w-10 text-slate-800 mx-auto mb-3"></i>
            <p class="text-xs text-slate-500 italic">No hay reuniones programadas para este día.</p>
          </div>
        ` : cellEvents.map(e => {
          const isPast = e.fecha_agendada && e.fecha_agendada.split(' ')[0] < todayStr;
          const timeStr = e.fecha_agendada && e.fecha_agendada.split(' ')[1] 
            ? e.fecha_agendada.split(' ')[1].slice(0, 5) 
            : 'Hora no especificada';
          
          return `
            <div onclick="showAgendaDetailsModal(${e.id})" 
                 class="p-5 rounded-2xl border text-left cursor-pointer transition-all hover:-translate-y-px active:translate-y-0 ${
                   isPast 
                     ? 'bg-slate-900/20 text-slate-400 border-slate-800/40 hover:bg-slate-900/30' 
                     : 'bg-emerald-500/[0.03] text-emerald-300 border-emerald-500/20 hover:bg-emerald-500/10'
                 } flex gap-4 items-start">
              <div class="flex flex-col items-center shrink-0 w-16 select-none">
                <span class="text-xs font-bold font-mono ${isPast ? 'text-slate-500' : 'text-emerald-400'}">${timeStr}</span>
                <span class="text-[9px] font-semibold text-slate-500 mt-1.5 uppercase tracking-wider">Inicio</span>
              </div>
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2 mb-1.5 flex-wrap select-none">
                  <span class="bg-slate-800/80 text-slate-400 border border-slate-700/50 text-[9px] px-2 py-0.5 rounded-lg font-bold uppercase tracking-wider">Folio: ${e.folio_lobby || 'Sin Folio'}</span>
                </div>
                <h4 class="text-sm font-bold text-slate-200 truncate">${escapeHtml(e.sujeto_pasivo)}</h4>
                <p class="text-xs text-slate-400 font-semibold mt-0.5 truncate">${escapeHtml(e.cargo_limpio || getCargoClean(e.cargo))}</p>
                
                <div class="mt-3.5 grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                  <div>
                    <span class="text-[10px] text-slate-500 block uppercase tracking-wider font-bold select-none">Sujeto Activo / Lobbista</span>
                    <span class="text-slate-300 font-medium">${escapeHtml(e.sujeto_activo || 'Sin Lobbista')}</span>
                  </div>
                  <div>
                    <span class="text-[10px] text-slate-500 block uppercase tracking-wider font-bold select-none">Representado</span>
                    <span class="text-slate-300 font-medium">${escapeHtml(e.representado || 'Particular')}</span>
                  </div>
                </div>
                <div class="mt-3.5 pt-2.5 border-t border-slate-900">
                  <span class="text-[10px] text-slate-500 block uppercase tracking-wider font-bold select-none">Materia</span>
                  <p class="text-xs text-slate-400 mt-0.5 leading-relaxed line-clamp-2">${escapeHtml(e.materia || 'Sin especificar')}</p>
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
  
  container.innerHTML = html;
  lucide.createIcons();
}

function showAgendaDetailsModal(eventId) {
  const item = calendarEvents.find(e => e.id === eventId);
  if (!item) return;
  
  const modal = document.getElementById('modal-container');
  if (!modal) return;
  
  const publicadosFolios = new Set((dataStore.publicadas || []).map(p => p.folio_lobby).filter(Boolean));
  const isPublished = item.folio_lobby && publicadosFolios.has(item.folio_lobby);
  
  let pubStatusHtml = '';
  if (isPublished) {
    pubStatusHtml = `
      <span class="px-2.5 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg text-[10px] font-semibold flex items-center gap-1 shrink-0">
        <i data-lucide="check" class="h-3 w-3"></i> Publicada
      </span>
    `;
  } else {
    const delayInfo = getPendingPublicationDelay(item.fecha_agendada, item);
    const badgeColorClass = delayInfo.badgeClass === 'badge-status-vencido' 
      ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' 
      : 'bg-blue-500/10 text-blue-400 border border-blue-500/20';
      
    const plazoText = delayInfo.text === 'En plazo' 
      ? 'Dentro de plazo (DDP)' 
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

  modal.classList.remove('hidden');
  modal.innerHTML = `
    <div class="glass-card w-full max-w-xl p-6 rounded-3xl space-y-5 shadow-2xl relative animate-fade-in border border-slate-200 dark:border-slate-800 text-[var(--text-primary)] max-h-[90vh] overflow-y-auto custom-scrollbar font-sans text-left">
      <!-- Header -->
      <div class="flex items-center justify-between border-b border-slate-800 pb-3">
        <div class="flex items-center gap-2">
          <div class="h-9 w-9 rounded-xl bg-brand-500/10 text-brand-500 flex items-center justify-center shrink-0">
            <i data-lucide="calendar" class="h-4.5 w-4.5"></i>
          </div>
          <div>
            <h3 class="text-xs font-bold uppercase tracking-wider text-slate-500">Detalle de Audiencia</h3>
            <span class="text-xs font-semibold text-slate-200">Folio: <span class="font-mono text-brand-400 font-bold">${item.folio_lobby || 'Sin Folio'}</span></span>
          </div>
        </div>
        <button onclick="closeModal()" class="h-7 w-7 rounded-lg flex items-center justify-center border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer">
          <i data-lucide="x" class="h-4 w-4"></i>
        </button>
      </div>

      <!-- Info grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        <div>
          <span class="text-[10px] text-slate-500 block uppercase tracking-wider font-bold">Fecha / Hora Agendada</span>
          <span class="text-slate-200 font-semibold">${formatDate(item.fecha_agendada)}</span>
        </div>
        <div>
          <span class="text-[10px] text-slate-500 block uppercase tracking-wider font-bold">Estado de Publicación</span>
          <div class="mt-1">${pubStatusHtml}</div>
        </div>
      </div>

      <hr class="border-slate-800">

      <div class="space-y-3.5 text-xs">
        <div>
          <span class="text-[10px] text-slate-500 block uppercase tracking-wider font-bold">Sujeto Pasivo (Autoridad)</span>
          <p class="text-sm font-bold text-slate-100">${escapeHtml(item.sujeto_pasivo)}</p>
          <p class="text-xs text-slate-400 font-medium mt-0.5">${escapeHtml(item.cargo_limpio || getCargoClean(item.cargo))}</p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <span class="text-[10px] text-slate-500 block uppercase tracking-wider font-bold">Sujeto Activo (Lobbista/Gestor)</span>
            <p class="text-slate-200 font-semibold mt-0.5">${escapeHtml(item.sujeto_activo || 'Sin Lobbista')}</p>
            \${item.rut ? `<p class="text-[10px] text-slate-400 font-mono mt-0.5">RUT: \${escapeHtml(item.rut)}</p>` : ''}
          </div>
          <div>
            <span class="text-[10px] text-slate-500 block uppercase tracking-wider font-bold">Representado</span>
            <p class="text-slate-200 font-semibold mt-0.5">${escapeHtml(item.representado || 'Particular')}</p>
          </div>
        </div>

        <hr class="border-slate-800">

        <div>
          <span class="text-[10px] text-slate-500 block uppercase tracking-wider font-bold">Materia</span>
          <p class="text-xs text-slate-200 font-semibold mt-1 bg-slate-900/30 border border-slate-900 p-2.5 rounded-xl leading-relaxed select-text">${escapeHtml(item.materia || 'Sin especificar')}</p>
        </div>

        \${item.especificacion_materia ? `
          <div>
            <span class="text-[10px] text-slate-500 block uppercase tracking-wider font-bold">Especificación de la Materia</span>
            <p class="text-xs text-slate-300 mt-1 bg-slate-900/30 border border-slate-900 p-2.5 rounded-xl leading-relaxed select-text">\${escapeHtml(item.especificacion_materia)}</p>
          </div>
        ` : ''}
      </div>

      <!-- Footer -->
      <div class="flex justify-end gap-3 pt-2">
        \${item.id_lobby ? `
          <a href="https://www.leylobby.gob.cl/admin/solicitudes/\${item.id_lobby}" target="_blank" class="px-4 py-2.5 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all hover:shadow-lg hover:shadow-brand-500/20 cursor-pointer">
            Ver Solicitud Original <i data-lucide="external-link" class="h-3.5 w-3.5"></i>
          </a>
        ` : ''}
        <button type="button" onclick="closeModal()" class="px-4 py-2.5 rounded-xl text-xs font-semibold btn-secondary cursor-pointer">
          Cerrar
        </button>
      </div>
    </div>
  `;
  
  lucide.createIcons();
}

function renderAgenda(container) {
  const searchVal = calendarFilters.search || '';
  
  let headerHtml = `
    <div class="space-y-6 font-sans">
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div class="space-y-1 text-left">
          <h2 class="text-xl font-bold text-heading flex items-center gap-2">
            <i data-lucide="calendar" class="h-5 w-5 text-brand-500"></i>
            Agenda de Audiencias
          </h2>
          <p class="text-xs text-slate-400">Revisión de audiencias programadas y verificación de plazos.</p>
        </div>
        
        <!-- Controls: View Selector & Nav -->
        <div class="flex items-center gap-3 self-end md:self-center flex-wrap">
          <!-- Navigation -->
          <div class="flex items-center bg-slate-950/40 p-1 rounded-xl border border-slate-800/80 gap-1">
            <button onclick="navigateCalendar(-1)" class="h-7 w-7 flex items-center justify-center rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-all cursor-pointer" title="Anterior">
              <i data-lucide="chevron-left" class="h-4 w-4"></i>
            </button>
            <button onclick="goCalendarToday()" class="px-3 py-1 text-xs font-semibold rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-all cursor-pointer">
              Hoy
            </button>
            <button onclick="navigateCalendar(1)" class="h-7 w-7 flex items-center justify-center rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-all cursor-pointer" title="Siguiente">
              <i data-lucide="chevron-right" class="h-4 w-4"></i>
            </button>
          </div>
          
          <!-- View selector -->
          <div class="flex items-center bg-slate-950/40 p-1 rounded-xl border border-slate-800/80 gap-0.5">
            \${['month', 'week', 'day'].map(view => {
              const label = view === 'month' ? 'Mes' : view === 'week' ? 'Semana' : 'Día';
              const active = calendarViewMode === view;
              return `
                <button onclick="changeCalendarViewMode('\${view}')" 
                        class="px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer \${
                          active 
                            ? 'bg-brand-600 text-white shadow-lg shadow-brand-500/10' 
                            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                        }">
                  \${label}
                </button>
              `;
            }).join('')}
          </div>
        </div>
      </div>

      <!-- Filters & Search -->
      <div class="glass-card p-4 rounded-2xl flex flex-col md:flex-row items-center gap-4 justify-between">
        <!-- Search bar -->
        <div class="relative w-full md:max-w-md">
          <i data-lucide="search" class="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500"></i>
          <input type="text" id="search-calendar" oninput="onCalendarSearch(this.value)" 
                 placeholder="Filtrar por lobbista, autoridad, folio o materia..." 
                 value="\${escapeHtmlAttr(searchVal)}" 
                 class="w-full py-2 pl-9 pr-4 rounded-xl text-xs glass-input focus:outline-none transition-colors text-[var(--text-primary)]">
        </div>
        
        <!-- Dinamic Calendar Title -->
        <div class="text-sm font-bold text-slate-200 text-right pr-2 select-none" id="calendar-title-display">
          Cargando...
        </div>
      </div>

      <!-- Calendar body container -->
      <div id="calendar-content-placeholder" class="relative min-h-[400px]">
        <!-- Rendered dynamically -->
      </div>
    </div>
  `;
  
  container.innerHTML = headerHtml;
  lucide.createIcons();
  
  fetchAndDrawCalendar();
}

// Registrar funciones de la Agenda en el ámbito global window
window.changeCalendarViewMode = function(mode) {
  calendarViewMode = mode;
  renderView();
};

window.navigateCalendar = function(direction) {
  if (calendarViewMode === 'month') {
    currentCalendarDate.setMonth(currentCalendarDate.getMonth() + direction);
  } else if (calendarViewMode === 'week') {
    currentCalendarDate.setDate(currentCalendarDate.getDate() + (direction * 7));
  } else if (calendarViewMode === 'day') {
    currentCalendarDate.setDate(currentCalendarDate.getDate() + direction);
  }
  renderView();
};

window.goCalendarToday = function() {
  currentCalendarDate = new Date();
  calendarFilters.search = '';
  renderView();
};

window.onCalendarSearch = function(val) {
  calendarFilters.search = val;
  drawCalendarBodyOnly();
};

window.showAgendaDetailsModal = function(eventId) {
  showAgendaDetailsModal(eventId);
};


