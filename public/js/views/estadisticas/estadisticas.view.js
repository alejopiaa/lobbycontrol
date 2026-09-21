/**
 * estadisticas.view.js - Vista modular de métricas agregadas y estadísticas Ley 20.730
 * LobbyControl - Arquitectura Modular ESM
 */

import {
  renderGlassCard,
  renderSearchInput,
  renderDateInput,
  renderVigenciaSelect,
  renderCargoSelect,
  renderFilterBar,
  renderDualDatePicker,
  syncSearchInputBadge
} from '../../components/ui.js';
import { formatPct, formatDateForDisplay } from '../../utils/formatters.js';
import { estadisticasCharts } from './estadisticas.charts.js';

/**
 * Renderiza el módulo de estadísticas completo o actualiza sus contadores en tiempo real
 * @param {HTMLElement} container - Contenedor principal donde se monta la vista
 * @returns {boolean} true si fue actualización parcial de contadores, false si fue montaje completo
 */
export function renderEstadisticas(container) {
  if (!container) return false;

  const store = (typeof dataStore !== 'undefined' ? dataStore : (typeof window !== 'undefined' ? window.dataStore : null)) || {};
  const filters = (typeof estadisticasFilters !== 'undefined' ? estadisticasFilters : (typeof window !== 'undefined' ? (window.estadisticasFilters || window.dashboardFilters) : null)) || {};
  const statsCalculator = typeof calculateDashboardStats === 'function'
    ? calculateDashboardStats
    : (typeof window !== 'undefined' ? window.calculateDashboardStats : null);

  const stats = statsCalculator ? statsCalculator(
    store.dashboardRawData || [],
    filters
  ) : {
    totales: { total: 0, pctUniversal: 100, respondidas: 0, pendientes: 0, publicadas: 0, pctPublicadas: 0, pendientesPublicacion: 0, pctPendientesPublicacion: 0 },
    respondidas: { pctTotal: 0, rdp: 0, pctRdp: 0, rfp: 0, pctRfp: 0 },
    pendientes: { pctTotal: 0, ddp: 0, pctDdp: 0, fdp: 0, pctFdp: 0 },
    estados: {
      aceptada: { count: 0, pct: 0 },
      rechazada: { count: 0, pct: 0 },
      suspendida: { count: 0, pct: 0 },
      cancelada: { count: 0, pct: 0 },
      encomendada: { count: 0, pct: 0 }
    }
  };

  const existingView = container.querySelector("#estadisticas-view-container");
  if (existingView) {
    // 1. Actualizar números y porcentajes de las tarjetas principales
    const totalCountEl = existingView.querySelector('#count-total-solicitudes');
    if (totalCountEl) totalCountEl.textContent = stats.totales.total;
    const totalPctEl = existingView.querySelector('#pct-total-solicitudes');
    if (totalPctEl) {
      totalPctEl.textContent = stats.totales.pctUniversal < 100
        ? `${stats.totales.pctUniversal}% del total`
        : '100%';
    }

    // Respondidas
    const respCountEl = existingView.querySelector('#count-solicitudes-respondidas');
    if (respCountEl) respCountEl.textContent = stats.totales.respondidas;
    const respPctEl = existingView.querySelector('#pct-solicitudes-respondidas');
    if (respPctEl) respPctEl.textContent = formatPct(stats.respondidas.pctTotal, stats.totales.respondidas);
    
    // text Total
    const textTotalResp = existingView.querySelector('#text-total-respondidas');
    if (textTotalResp) textTotalResp.textContent = `${stats.totales.respondidas} Respondidas · ${stats.totales.pendientes} Pendientes`;

    // text Respondidas
    const textRespRdp = existingView.querySelector('#text-respondidas-rdp');
    if (textRespRdp) textRespRdp.textContent = `${stats.respondidas.rdp} RDP · ${stats.respondidas.rfp} RFP`;

    // Pendientes / FDP
    const pendCountEl = existingView.querySelector('#count-solicitudes-pendientes');
    if (pendCountEl) pendCountEl.textContent = stats.pendientes.fdp !== undefined ? stats.pendientes.fdp : stats.totales.pendientes;

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
      const elCount = existingView.querySelector(`#${item.id}`);
      if (elCount) elCount.textContent = item.count;
      const elText = existingView.querySelector(`#${item.textId}`);
      if (elText) elText.textContent = formatPct(item.pct, item.count);
    });

    // 3. Sincronizar inputs y chips del panel
    const nombreInput = existingView.querySelector('#dashboard-filter-nombre');
    if (nombreInput) nombreInput.value = filters.nombre || '';

    const fInicio = existingView.querySelector('#dashboard-filter-fechainicio');
    if (fInicio) fInicio.value = filters.fechaInicio || '';
    const fInicioDisp = existingView.querySelector('#dashboard-filter-fechainicio-display');
    if (fInicioDisp) fInicioDisp.value = formatDateForDisplay(filters.fechaInicio);

    const fTermino = existingView.querySelector('#dashboard-filter-fechatermino');
    if (fTermino) fTermino.value = filters.fechaTermino || '';
    const fTerminoDisp = existingView.querySelector('#dashboard-filter-fechatermino-display');
    if (fTerminoDisp) fTerminoDisp.value = formatDateForDisplay(filters.fechaTermino);

    // Sincronizar Badge y botón Borrar filtros
    const activeCount = [
      filters.vigencia && filters.vigencia !== 'todos',
      !!filters.anio,
      !!filters.nombre,
      !!filters.cargo,
      !!filters.fechaInicio,
      !!filters.fechaTermino
    ].filter(Boolean).length;

    const badgeEl = existingView.querySelector('#dashboard-filters-badge');
    if (badgeEl) {
      if (activeCount > 0) {
        badgeEl.textContent = activeCount;
        badgeEl.classList.remove('hidden');
        badgeEl.classList.add('inline-flex');
      } else {
        badgeEl.classList.add('hidden');
        badgeEl.classList.remove('inline-flex');
      }
    }

    const clearBtn = existingView.querySelector('#btn-clear-dashboard-filters');
    if (clearBtn) {
      if (activeCount > 0) {
        clearBtn.className = 'text-xs font-semibold flex items-center gap-1.5 transition-all duration-150 text-rose-600 dark:text-rose-400 hover:text-rose-700 cursor-pointer opacity-100';
      } else {
        clearBtn.className = 'text-xs font-semibold flex items-center gap-1.5 transition-all duration-150 text-slate-400 dark:text-slate-500 opacity-40 pointer-events-none';
      }
    }

    // 4. Sincronizar FDP Casos
    const elFdp = existingView.querySelector('#count-fdp-casos');
    if (elFdp) {
      elFdp.textContent = stats.totales.fdp || 3;
    }

    return true;
  }

  const activeCount = [
    filters.vigencia && filters.vigencia !== 'todos',
    !!filters.nombre,
    !!filters.cargo,
    !!filters.fechaInicio,
    !!filters.fechaTermino
  ].filter(Boolean).length;

  container.innerHTML = `
    <div class="space-y-4" id="estadisticas-view-container">
      <!-- BARRA / TARJETA UNIFICADA DE FILTROS -->
      ${renderFilterBar({
        moduleName: 'dashboard',
        activeCount,
        onToggle: 'toggleDashboardFiltersPanel()',
        onClear: 'clearDashboardFilters()',
        chipsHtml: `
          <!-- 1. Vigencia (Custom select con ancho fijo) -->
          ${renderVigenciaSelect({
            id: "dashboard-filter-vigencia",
            value: filters.vigencia,
            onChange: "changeDashboardVigencia",
          })}

          <!-- 2. Chip Sujeto Pasivo (Ancho estable con badge y botón X al seleccionar) -->
          <div class="relative w-[215px] shrink-0">
            ${filters.nombre ? `
              <div class="flex items-center justify-between gap-1.5 px-3 py-1.5 rounded-xl border border-brand-200/80 dark:border-brand-800/60 bg-brand-50/70 dark:bg-brand-950/40 text-xs shadow-2xs">
                <div class="flex items-center gap-1.5 truncate">
                  <i data-lucide="user" class="h-3.5 w-3.5 text-brand-600 dark:text-brand-400 shrink-0"></i>
                  <span class="font-bold text-brand-700 dark:text-brand-300 truncate text-[11px]" title="${filters.nombre}">${filters.nombre}</span>
                </div>
                <button type="button" 
                        onclick="clearDashboardSujetoPasivo(event)" 
                        class="text-brand-400 hover:text-brand-600 dark:hover:text-brand-200 hover:bg-brand-100/60 dark:hover:bg-brand-900/60 rounded-full p-0.5 transition-colors shrink-0 cursor-pointer" 
                        title="Quitar filtro Sujeto Pasivo">
                  <i data-lucide="x" class="h-3.5 w-3.5"></i>
                </button>
              </div>
            ` : `
              <div class="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200/60 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs shadow-2xs">
                <i data-lucide="user" class="h-3.5 w-3.5 text-slate-400 shrink-0"></i>
                <input type="text" id="dashboard-filter-nombre" placeholder="Sujeto Pasivo..." 
                       value=""
                       onfocus="showDashboardSuggestions('nombre')"
                       onclick="showDashboardSuggestions('nombre')"
                       oninput="handleDashboardInputWithSuggestions(event, 'nombre')"
                       onkeydown="handleDashboardInputKeydown(event, 'nombre')"
                       class="bg-transparent border-0 text-xs text-text-primary placeholder:text-slate-400 focus:outline-none w-full">
              </div>
              <div id="suggestions-nombre" class="hidden absolute left-0 right-0 top-full mt-1 z-50 glass-card bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-xl max-h-48 overflow-y-auto py-1"></div>
            `}
          </div>

          <!-- 4. Chip Cargo (Dropdown custom dependiente de Nombre con ancho fijo) -->
          ${renderCargoSelect({
            id: "dashboard-filter-cargo",
            value: filters.cargo,
            nombre: filters.nombre,
            onChange: "changeDashboardCargo",
          })}

          <!-- 5. Selector Dual de Fechas (Desde / Hasta) -->
          ${renderDualDatePicker({
            idPrefix: 'dashboard-filter-',
            fechaInicio: filters.fechaInicio,
            fechaTermino: filters.fechaTermino,
            onChange: 'changeDashboardFecha'
          })}
        `
      })}

      <!-- CUATRO TARJETAS MÉTRICAS PRINCIPALES -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-5 items-stretch">
        
        <!-- KPI 1: TOTAL SOLICITUDES -->
        <div class="lg:col-span-3 glass-card rounded-2xl p-5 flex items-center gap-4 hover:shadow-md transition-all duration-300">
          <div class="w-12 h-12 rounded-2xl bg-brand-50 dark:bg-brand-950/50 text-brand-600 dark:text-brand-400 flex items-center justify-center shrink-0">
            <i data-lucide="layers" class="w-6 h-6"></i>
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-[11px] font-semibold text-slate-400">Total Solicitudes</p>
            <div class="flex items-baseline gap-2">
              <span class="text-2xl font-black text-text-primary font-mono" id="count-total-solicitudes">${stats.totales.total}</span>
              <span id="pct-total-solicitudes" class="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-1.5 py-0.5 rounded">${stats.totales.pctUniversal < 100 ? `${stats.totales.pctUniversal}%` : '100%'}</span>
            </div>
            <p class="text-[10px] text-slate-400 mt-0.5" id="text-total-respondidas">${stats.totales.respondidas} Respondidas · ${stats.totales.pendientes} Pendientes</p>
          </div>
        </div>

        <!-- KPI 2: RESPONDIDAS -->
        <div class="lg:col-span-3 glass-card rounded-2xl p-5 flex items-center gap-4 hover:shadow-md transition-all duration-300">
          <div class="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <i data-lucide="check-circle-2" class="w-6 h-6"></i>
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-[11px] font-semibold text-slate-400">Respondidas</p>
            <div class="flex items-baseline gap-2">
              <span class="text-2xl font-black text-text-primary font-mono" id="count-solicitudes-respondidas">${stats.totales.respondidas}</span>
              <span id="pct-solicitudes-respondidas" class="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-1.5 py-0.5 rounded">${formatPct(stats.respondidas.pctTotal, stats.totales.respondidas)}</span>
            </div>
            <p class="text-[10px] text-slate-400 mt-0.5" id="text-respondidas-rdp">${stats.respondidas.rdp} RDP · ${stats.respondidas.rfp} RFP</p>
          </div>
        </div>

        <!-- KPI 3: PUBLICADAS -->
        <div class="lg:col-span-3 glass-card rounded-2xl p-5 flex items-center gap-4 hover:shadow-md transition-all duration-300">
          <div class="w-12 h-12 rounded-2xl bg-sky-50 dark:bg-sky-950/50 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
            <i data-lucide="file-check" class="w-6 h-6"></i>
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-[11px] font-semibold text-slate-400">Publicadas</p>
            <div class="flex items-baseline gap-2">
              <span class="text-2xl font-black text-text-primary font-mono" id="count-estado-publicadas">${stats.totales.publicadas}</span>
              <span id="text-pct-publicadas" class="text-[10px] font-bold text-sky-700 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/50 px-1.5 py-0.5 rounded">${formatPct(stats.totales.pctPublicadas, stats.totales.publicadas)}</span>
            </div>
            <p class="text-[10px] text-slate-400 mt-0.5">
              <span id="count-estado-pendientesPublicacion">${stats.totales.pendientesPublicacion}</span> pendientes de publicación
            </p>
          </div>
        </div>

        <!-- KPI 4: CRÍTICO FDP -->
        <div class="lg:col-span-3 glass-card rounded-2xl p-5 flex items-center justify-between border border-rose-100 dark:border-rose-950/40 hover:shadow-md transition-all duration-300">
          <div class="flex items-center gap-3.5">
            <div class="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/50 text-rose-500 dark:text-rose-400 flex items-center justify-center shrink-0 border border-rose-100 dark:border-rose-900/50">
              <i data-lucide="alert-circle" class="w-6 h-6"></i>
            </div>
            <div>
              <p class="text-[10px] font-extrabold uppercase tracking-wider text-rose-600 dark:text-rose-400">CRÍTICO FDP</p>
              <div class="flex items-baseline gap-1.5">
                <span class="text-2xl font-black text-slate-900 dark:text-white font-mono" id="count-fdp-casos">${stats.totales.fdp || 3}</span>
                <span class="text-xs font-semibold text-slate-400">Casos</span>
              </div>
            </div>
          </div>
          <button onclick="switchView('audiencias')" class="px-4 py-2 rounded-full bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-sm shadow-rose-500/20 flex items-center gap-1.5 transition-all cursor-pointer">
            <span>Ver FDP</span>
            <i data-lucide="arrow-right" class="w-3.5 h-3.5"></i>
          </button>
          <span class="hidden" id="count-solicitudes-pendientes">${stats.totales.pendientes}</span>
        </div>

      </div>

      <!-- CINTA MÉTRICA UNIFICADA DE ESTADOS -->
      <div class="glass-card stagger-card rounded-2xl p-1.5 shadow-2xs hover:shadow-md transition-all duration-300" style="animation-delay: 200ms;">
        <div class="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 divide-y sm:divide-y-0 sm:divide-x divide-slate-100/60 dark:divide-slate-800/60">
          
          <!-- ACEPTADAS -->
          <div class="p-3.5 text-center flex flex-col justify-between items-center group transition-colors hover:bg-border-ui/20 rounded-xl">
            <div class="flex items-center justify-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-text-tertiary mb-1">
              <span class="h-2 w-2 rounded-full shrink-0 shadow-xs" style="background-color: var(--card-blue-border, #3b82f6);"></span>
              <span>Aceptadas</span>
            </div>
            <div class="space-y-0.5 my-1">
              <h3 class="text-2xl font-black text-text-primary tracking-tight group-hover:scale-105 transition-transform" id="count-estado-aceptada">${stats.estados.aceptada.count}</h3>
            </div>
            <span id="text-pct-aceptada" class="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">${formatPct(stats.estados.aceptada.pct, stats.estados.aceptada.count)}</span>
          </div>

          <!-- RECHAZADAS -->
          <div class="p-3.5 text-center flex flex-col justify-between items-center group transition-colors hover:bg-border-ui/20 rounded-xl">
            <div class="flex items-center justify-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-text-tertiary mb-1">
              <span class="h-2 w-2 rounded-full shrink-0 shadow-xs" style="background-color: var(--card-pink-border, #f43f5e);"></span>
              <span>Rechazadas</span>
            </div>
            <div class="space-y-0.5 my-1">
              <h3 class="text-2xl font-black text-text-primary tracking-tight group-hover:scale-105 transition-transform" id="count-estado-rechazada">${stats.estados.rechazada.count}</h3>
            </div>
            <span id="text-pct-rechazada" class="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">${formatPct(stats.estados.rechazada.pct, stats.estados.rechazada.count)}</span>
          </div>

          <!-- SUSPENDIDAS -->
          <div class="p-3.5 text-center flex flex-col justify-between items-center group transition-colors hover:bg-border-ui/20 rounded-xl">
            <div class="flex items-center justify-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-text-tertiary mb-1">
              <span class="h-2 w-2 rounded-full shrink-0 shadow-xs" style="background-color: var(--brand-color, #7c3aed);"></span>
              <span>Suspendidas</span>
            </div>
            <div class="space-y-0.5 my-1">
              <h3 class="text-2xl font-black text-text-primary tracking-tight group-hover:scale-105 transition-transform" id="count-estado-suspendida">${stats.estados.suspendida.count}</h3>
            </div>
            <span id="text-pct-suspendida" class="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">${formatPct(stats.estados.suspendida.pct, stats.estados.suspendida.count)}</span>
          </div>

          <!-- CANCELADAS -->
          <div class="p-3.5 text-center flex flex-col justify-between items-center group transition-colors hover:bg-border-ui/20 rounded-xl">
            <div class="flex items-center justify-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-text-tertiary mb-1">
              <span class="h-2 w-2 rounded-full shrink-0 shadow-xs" style="background-color: var(--card-slate-text, #64748b);"></span>
              <span>Canceladas</span>
            </div>
            <div class="space-y-0.5 my-1">
              <h3 class="text-2xl font-black text-text-primary tracking-tight group-hover:scale-105 transition-transform" id="count-estado-cancelada">${stats.estados.cancelada.count}</h3>
            </div>
            <span id="text-pct-cancelada" class="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20">${formatPct(stats.estados.cancelada.pct, stats.estados.cancelada.count)}</span>
          </div>

          <!-- ENCOMENDADAS -->
          <div class="p-3.5 text-center flex flex-col justify-between items-center group transition-colors hover:bg-border-ui/20 rounded-xl">
            <div class="flex items-center justify-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-text-tertiary mb-1">
              <span class="h-2 w-2 rounded-full shrink-0 shadow-xs" style="background-color: var(--card-orange-text);"></span>
              <span>Encomendadas</span>
            </div>
            <div class="space-y-0.5 my-1">
              <h3 class="text-2xl font-black text-text-primary tracking-tight group-hover:scale-105 transition-transform" id="count-estado-encomendada">${stats.estados.encomendada.count}</h3>
            </div>
            <span id="text-pct-encomendada" class="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">${formatPct(stats.estados.encomendada.pct, stats.estados.encomendada.count)}</span>
          </div>

          <!-- PUBLICADAS -->
          <div class="p-3.5 text-center flex flex-col justify-between items-center group transition-colors hover:bg-border-ui/20 rounded-xl">
            <div class="flex items-center justify-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-text-tertiary mb-1">
              <span class="h-2 w-2 rounded-full shrink-0 shadow-xs" style="background-color: var(--card-teal-text);"></span>
              <span>Publicadas</span>
            </div>
            <div class="space-y-0.5 my-1">
              <h3 class="text-2xl font-black text-text-primary tracking-tight group-hover:scale-105 transition-transform" id="count-estado-publicadas">${stats.totales.publicadas}</h3>
            </div>
            <span id="text-pct-publicadas" class="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">${formatPct(stats.totales.pctPublicadas, stats.totales.publicadas)}</span>
          </div>

          <!-- PND. PUBLICAR -->
          <div class="p-3.5 text-center flex flex-col justify-between items-center group transition-colors hover:bg-border-ui/20 rounded-xl">
            <div class="flex items-center justify-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-text-tertiary mb-1">
              <span class="h-2 w-2 rounded-full shrink-0 shadow-xs" style="background-color: var(--card-amber-text);"></span>
              <span>Pnd. Publicar</span>
            </div>
            <div class="space-y-0.5 my-1">
              <h3 class="text-2xl font-black text-text-primary tracking-tight group-hover:scale-105 transition-transform" id="count-estado-pendientesPublicacion">${stats.totales.pendientesPublicacion}</h3>
            </div>
            <span id="text-pct-pendientesPublicacion" class="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">${formatPct(stats.totales.pctPendientesPublicacion, stats.totales.pendientesPublicacion)}</span>
          </div>

        </div>
      </div>

      <!-- PANEL DE GRÁFICOS ANALÍTICOS (GRILLA 2x2) -->
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

        <!-- 2. Evolución Mensual Interanual -->
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

  if (typeof lucide !== 'undefined' && lucide.createIcons) {
    lucide.createIcons();
  }

  if (typeof window.initAirDatepickerFields === 'function') {
    window.initAirDatepickerFields();
  }

  return false;
}

export const EstadisticasView = {
  async mount(container, params = {}) {
    if (typeof window !== 'undefined') {
      window.currentView = 'estadisticas';
    }
    // 1. Montaje visual en el DOM
    renderEstadisticas(container);

    // 2. Obtención de métricas y datos en segundo plano
    try {
      const ds = window.dataStore || (window.dataStore = {});
      const [resStats, resSol, resPub, resVig, resVigNombres] = await Promise.all([
        fetch('/api/stats').then(r => r.ok ? r.json() : {}).catch(() => ({})),
        fetch('/api/solicitudes').then(r => r.ok ? r.json() : []).catch(() => []),
        fetch('/api/publicadas').then(r => r.ok ? r.json() : []).catch(() => []),
        fetch('/api/sujetos_pasivos/vigentes').then(r => r.ok ? r.json() : []).catch(() => []),
        fetch('/api/sujetos_pasivos/vigentes-nombres').then(r => r.ok ? r.json() : []).catch(() => [])
      ]);
      ds.stats = resStats;
      ds.dashboardRawData = resSol;
      ds.publicadas = resPub;
      ds.sujetosVigentesNombres = resVigNombres;
      if (Array.isArray(resVig)) {
        const cache = new Set();
        resVig.forEach(id => { if (id != null) { cache.add(Number(id)); cache.add(String(id)); } });
        window.activeSujetoIdsCache = cache;
      }
      if (typeof window.buildDashboardDropdownCache === 'function') {
        window.buildDashboardDropdownCache();
      }
      renderEstadisticas(container);
    } catch (e) {
      console.warn('[EstadisticasView] Error cargando datos en segundo plano:', e);
    }

    // 3. Inicializar gráficos
    if (typeof window.initEstadisticasCharts === 'function') {
      window.initEstadisticasCharts();
    } else if (estadisticasCharts) {
      estadisticasCharts.renderCharts();
    }
  },

  unmount() {
    estadisticasCharts.destroyAll();
  }
};

if (typeof window !== 'undefined') {
  window.renderEstadisticas = renderEstadisticas;
  window.EstadisticasView = EstadisticasView;
}
