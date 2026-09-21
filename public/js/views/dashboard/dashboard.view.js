/**
 * dashboard.view.js - Vista operativa "Escritorio"
 * Panel ejecutivo de control y monitoreo de la Ley de Lobby.
 * Ley N° 20.730 · I. Municipalidad de Maipú
 * LobbyControl - Arquitectura Modular ESM
 */

import {
  escapeHtml,
  escapeHtmlAttr,
  formatDateForDisplay
} from '../../utils/formatters.js';

import { showSolicitudDetailsModal } from '../solicitudes/solicitudes.view.js';

/**
 * Helper: Formato local YYYY-MM-DD para hoy
 */
function getTodayString() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Helper: Saludo según la hora del día
 */
function getGreeting() {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return '¡Buenos días';
  if (hour >= 12 && hour < 20) return '¡Buenas tardes';
  return '¡Buenas noches';
}

/**
 * Helper: Badge con la misma lógica canónica y cromática de Solicitudes
 * @param {Object} item - Parámetro item.
 */
function getEstadoBadge(item) {
  if (!item) return { text: 'Ingresada', class: 'badge-status-otros' };
  const getBadgeFn = typeof getDeadlineStatusBadge === 'function'
    ? getDeadlineStatusBadge
    : (typeof window !== 'undefined' && typeof window.getDeadlineStatusBadge === 'function' ? window.getDeadlineStatusBadge : null);

  if (getBadgeFn) {
    const estado = (item.estado || 'Ingresada').trim();
    return getBadgeFn(item.fecha_ingreso, item.fecha_respuesta, estado, item);
  }

  const st = (item.estado || 'Ingresada').trim();
  const lower = st.toLowerCase();
  if (lower === 'aceptada') return { text: st, class: 'badge-status-enplazo' };
  if (lower === 'rechazada' || lower === 'cancelada') return { text: st, class: 'badge-status-vencido' };
  return { text: st, class: 'badge-status-otros' };
}

/**
 * Renderiza el Escritorio operativo en un único espacio unificado
 * @param {HTMLElement} container - Contenedor principal
 */
export function renderDashboard(container) {
  if (!container) return false;

  const store = (typeof dataStore !== 'undefined' ? dataStore : (typeof window !== 'undefined' ? window.dataStore : null)) || {};
  const currentUser = (typeof window !== 'undefined' && window.currentUser) ? window.currentUser : (store.currentUser || null);

  const statsCalculator = typeof calculateDashboardStats === 'function'
    ? calculateDashboardStats
    : (typeof window !== 'undefined' ? window.calculateDashboardStats : null);

  const rawData = Array.isArray(store.dashboardRawData) ? store.dashboardRawData : (Array.isArray(store.solicitudes) ? store.solicitudes : []);
  const stats = statsCalculator ? statsCalculator(rawData, {}) : {
    totales: { total: 0, pendientes: 0, publicadas: 0, pendientesPublicacion: 0 },
    pendientes: { ddp: 0, fdp: 0 },
    estados: { suspendida: { count: 0 } }
  };

  const fdpCount = stats.pendientes?.fdp ?? 0;
  const ddpCount = stats.pendientes?.ddp ?? 0;
  const pendientesPubCount = stats.totales?.pendientesPublicacion ?? 0;
  const totalPendientes = fdpCount + ddpCount;

  // Conteo de solicitudes suspendidas (requieren reagendamiento)
  const suspendidasCount = stats.estados?.suspendida?.count ?? rawData.filter(item => (item.estado || '').trim().toLowerCase() === 'suspendida').length;

  // Conteo y desglose de pendientes de publicar (FDP y DDP)
  const publicadasArray = Array.isArray(store.publicadas) ? store.publicadas : (store.publicadas?.data || []);
  const publicadosFolios = new Set(publicadasArray.map(p => p.folio_lobby).filter(Boolean));
  const getDelayFn = typeof getPendingPublicationDelay === 'function' 
    ? getPendingPublicationDelay 
    : (typeof window !== 'undefined' ? window.getPendingPublicationDelay : null);

  let pubFdpCount = 0;
  let pubDdpCount = 0;

  rawData.forEach(item => {
    const estadoClean = (item.estado || '').trim().toLowerCase();
    const hasFolio = Boolean(item.folio_lobby);
    const isPublicada = hasFolio && publicadosFolios.has(item.folio_lobby);
    if (estadoClean === 'aceptada' && item.fecha_agendada && !isPublicada) {
      const delayInfo = getDelayFn ? getDelayFn(item.fecha_agendada, item) : null;
      const isItemFuera = delayInfo ? (delayInfo.days > 0) : ((item.dias_retraso_publicacion || 0) > 0);
      if (isItemFuera) {
        pubFdpCount++;
      } else {
        pubDdpCount++;
      }
    }
  });

  const totalPendientesPub = (pubFdpCount + pubDdpCount) > 0 ? (pubFdpCount + pubDdpCount) : pendientesPubCount;

  // 1. Obtener las últimas solicitudes recibidas (ordenadas por fecha_ingreso descendente, máximo 4 para una vista despejada)
  const ultimasSolicitudes = [...rawData]
    .sort((a, b) => {
      const fA = a.fecha_ingreso || '';
      const fB = b.fecha_ingreso || '';
      return fB.localeCompare(fA);
    })
    .slice(0, 4);

  // 2. Obtener todas las audiencias aceptadas ordenadas cronológicamente
  const todasAudienciasAceptadas = rawData.filter(item => {
    const estadoClean = (item.estado || '').trim().toLowerCase();
    return estadoClean === 'aceptada' && Boolean(item.fecha_agendada);
  }).sort((a, b) => (a.fecha_agendada || '').localeCompare(b.fecha_agendada || ''));

  // Audiencias programadas para hoy
  const todayStr = getTodayString();
  const audienciasHoyTodas = todasAudienciasAceptadas.filter(item => (item.fecha_agendada || '').startsWith(todayStr));
  const audienciasHoy = audienciasHoyTodas.slice(0, 4);

  // Fecha y hora actual en español
  const now = new Date();
  const hoyFechaFormateada = new Intl.DateTimeFormat('es-CL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  }).format(now);
  const hoyCapitalizada = hoyFechaFormateada.charAt(0).toUpperCase() + hoyFechaFormateada.slice(1);
  const horaActual = now.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false });
  const horaActualConSegundos = now.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  const nowIsoPrefix = `${todayStr} ${horaActual}`;

  // Fecha de mañana en formato YYYY-MM-DD
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;

  // Próxima reunión (inteligente: hoy pendiente -> mañana -> fecha futura -> finalizadas)
  let proximaReunionLabel = '';
  const proximaHoy = audienciasHoyTodas.find(item => {
    const parts = (item.fecha_agendada || '').split(' ');
    if (parts.length < 2) return false;
    const hora = parts[1].slice(0, 5);
    return hora >= horaActual;
  });

  if (proximaHoy) {
    const hora = proximaHoy.fecha_agendada.split(' ')[1].slice(0, 5);
    proximaReunionLabel = `Próxima reunión a las <span class="font-bold text-indigo-600 dark:text-indigo-400 font-mono">${hora} hrs</span>`;
  } else {
    const siguienteFutura = todasAudienciasAceptadas.find(item => {
      const f = item.fecha_agendada || '';
      return f > nowIsoPrefix;
    });

    if (siguienteFutura) {
      const parts = (siguienteFutura.fecha_agendada || '').split(' ');
      const fechaParte = parts[0] || '';
      const hora = (parts[1] || '').slice(0, 5);
      if (fechaParte === tomorrowStr) {
        proximaReunionLabel = `Próxima reunión mañana a las <span class="font-bold text-indigo-600 dark:text-indigo-400 font-mono">${hora} hrs</span>`;
      } else {
        const fParts = fechaParte.split('-');
        const ddMm = fParts.length === 3 ? `${fParts[2]}/${fParts[1]}` : fechaParte;
        proximaReunionLabel = `Próxima reunión el ${ddMm} a las <span class="font-bold text-indigo-600 dark:text-indigo-400 font-mono">${hora} hrs</span>`;
      }
    } else {
      if (audienciasHoyTodas.length > 0) {
        proximaReunionLabel = 'Reuniones de hoy finalizadas';
      } else {
        proximaReunionLabel = 'Sin próximas reuniones programadas';
      }
    }
  }
  // Nombre del usuario para el saludo dinámico
  const userNombre = currentUser?.nombre || currentUser?.username || 'Usuario';
  const greeting = getGreeting();

  container.innerHTML = `
    <div class="space-y-6" id="escritorio-view-container">

      <!-- ========================================================================= -->
      <!-- ESPACIO DE TRABAJO PRINCIPAL UNIFICADO (UN SOLO LIENZO SÓLIDO)            -->
      <!-- ========================================================================= -->
      <div class="glass-card rounded-3xl border border-border-ui bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
        
        <!-- CABECERA INTEGRADA: SALUDO Y FECHA/HORA ESTILIZADA -->
        <div class="px-8 py-5 border-b border-border-ui flex items-center justify-between gap-4 flex-wrap bg-slate-50/50 dark:bg-slate-800/40">
          <div>
            <h1 class="text-xl md:text-2xl font-black text-text-primary tracking-tight flex items-center gap-2">
              <span>${escapeHtml(greeting)}, ${escapeHtml(userNombre)}</span>
              <span class="inline-block hover:scale-110 transition-transform cursor-default select-none">👋</span>
            </h1>
          </div>
          
          <!-- Píldora ejecutiva: En Línea (Radar) + Fecha + Reloj en vivo -->
          <div class="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-white dark:bg-slate-800 border border-border-ui shadow-xs text-xs">
            <!-- Indicador Radar En Línea -->
            <div class="flex items-center gap-1.5 pr-0.5 select-none" title="Sistema activo y sincronizado">
              <span class="relative flex h-2 w-2">
                <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span class="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span class="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 tracking-tight">En Línea</span>
            </div>

            <span class="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600"></span>

            <!-- Fecha del día -->
            <div class="flex items-center gap-1.5 text-text-secondary font-medium">
              <i data-lucide="calendar" class="w-3.5 h-3.5 text-brand-500"></i>
              <span>${escapeHtml(hoyCapitalizada)}</span>
            </div>

            <span class="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600"></span>

            <!-- Reloj activo en tiempo real con segundero -->
            <div class="flex items-center gap-1.5 text-brand-600 dark:text-brand-400 font-mono font-bold">
              <i data-lucide="clock" class="w-3.5 h-3.5"></i>
              <span id="escritorio-live-clock">${escapeHtml(horaActualConSegundos)} hrs</span>
            </div>
          </div>
        </div>

        <!-- FRANJA SUPERIOR: BARRA DE MÉTRICAS CONTINUA INTEGRADA -->
        <div class="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-100 dark:divide-slate-800/80 border-b border-border-ui bg-slate-50/40 dark:bg-slate-800/30">
          
          <!-- MÉTRICA 1: SOLICITUDES PENDIENTES -->
          <div onclick="irASolicitudes('pendientes')" class="pt-6 pb-8 px-8 flex flex-col justify-between hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-all cursor-pointer group">
            <div class="flex items-start justify-between">
              <div>
                <span class="text-[10px] font-extrabold uppercase tracking-wider text-text-tertiary block">
                  Solicitudes Pendientes
                </span>
                <div class="mt-2 flex items-baseline gap-2">
                  <span class="text-3xl font-black font-mono text-text-secondary tracking-tight" id="count-card-pronunciamiento">${totalPendientes}</span>
                </div>
              </div>
              <div class="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center border border-rose-100 dark:border-rose-900/40 shrink-0 group-hover:scale-105 transition-transform">
                <i data-lucide="clock" class="w-5 h-5"></i>
              </div>
            </div>

            <div class="pt-5 mt-3 flex items-center justify-between text-xs">
              <div class="flex items-center gap-1.5">
                <span onclick="event.stopPropagation(); irASolicitudes('fuera_plazo')" class="text-[11px] font-bold px-2 py-0.5 rounded bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50 font-mono hover:underline" title="Ver sólo solicitudes Fuera de Plazo">${fdpCount} FDP</span>
                <span onclick="event.stopPropagation(); irASolicitudes('dentro_plazo')" class="badge-enplazo text-[11px] font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/50 font-mono hover:underline" title="Ver sólo solicitudes Dentro de Plazo">${ddpCount} en plazo</span>
              </div>
              <span class="font-bold text-brand-600 dark:text-brand-400 group-hover:translate-x-0.5 transition-transform">Consultar &rarr;</span>
            </div>
          </div>

          <!-- MÉTRICA 2: SUSPENDIDAS -->
          <div onclick="irASolicitudes('suspendidas')" class="pt-6 pb-8 px-8 flex flex-col justify-between hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-all cursor-pointer group">
            <div class="flex items-start justify-between">
              <div>
                <span class="text-[10px] font-extrabold uppercase tracking-wider text-text-tertiary block">
                  Suspendidas
                </span>
                <div class="mt-2 flex items-baseline gap-2">
                  <span class="text-3xl font-black font-mono text-text-secondary tracking-tight" id="count-card-suspendidas">${suspendidasCount}</span>
                </div>
              </div>
              <div class="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-100 dark:border-amber-900/40 shrink-0 group-hover:scale-105 transition-transform">
                <i data-lucide="calendar-x" class="w-5 h-5"></i>
              </div>
            </div>

            <div class="pt-5 mt-3 flex items-center justify-between text-xs">
              <span class="text-text-tertiary text-[11px]">Requiere reagendamiento</span>
              <span class="font-bold text-amber-600 dark:text-amber-400 group-hover:translate-x-0.5 transition-transform">Consultar &rarr;</span>
            </div>
          </div>

          <!-- MÉTRICA 3: PENDIENTES DE PUBLICAR -->
          <div onclick="irAPublicadas()" class="pt-6 pb-8 px-8 flex flex-col justify-between hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-all cursor-pointer group">
            <div class="flex items-start justify-between">
              <div>
                <span class="text-[10px] font-extrabold uppercase tracking-wider text-text-tertiary block">
                  Pendientes de Publicar
                </span>
                <div class="mt-2 flex items-baseline gap-2">
                  <span class="text-3xl font-black font-mono text-text-secondary tracking-tight" id="count-card-porpublicar">${totalPendientesPub}</span>
                </div>
              </div>
              <div class="w-10 h-10 rounded-xl bg-sky-50 dark:bg-sky-950/50 text-sky-600 dark:text-sky-400 flex items-center justify-center border border-sky-100 dark:border-sky-900/40 shrink-0 group-hover:scale-105 transition-transform">
                <i data-lucide="upload-cloud" class="w-5 h-5"></i>
              </div>
            </div>

            <div class="pt-5 mt-3 flex items-center justify-between text-xs">
              <div class="flex items-center gap-1.5">
                <span onclick="event.stopPropagation(); irAPublicadas('fuera_plazo')" class="text-[11px] font-bold px-2 py-0.5 rounded bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50 font-mono hover:underline" title="Ver sólo pendientes de publicar Fuera de Plazo">${pubFdpCount} FDP</span>
                <span onclick="event.stopPropagation(); irAPublicadas('dentro_plazo')" class="badge-enplazo text-[11px] font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/50 font-mono hover:underline" title="Ver sólo pendientes de publicar Dentro de Plazo">${pubDdpCount} en plazo</span>
              </div>
              <span class="font-bold text-sky-600 dark:text-sky-400 group-hover:translate-x-0.5 transition-transform">Consultar &rarr;</span>
            </div>
          </div>

        </div>

        <!-- CUERPO OPERATIVO UNIFICADO (GRID ASIMÉTRICA 7 / 5 CON AIRE INTERNO) -->
        <div class="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-100 dark:divide-slate-800/80">
          
          <!-- SECCIÓN IZQUIERDA: ÚLTIMAS SOLICITUDES RECIBIDAS (7 COLS) -->
          <div class="lg:col-span-7 pt-8 pb-8 px-8 flex flex-col">
            <!-- Cabecera de la Sección -->
              <div class="flex items-center justify-between pb-4 mb-3 border-b border-border-ui">
                <div>
                  <h2 class="text-xs font-black uppercase tracking-wider text-text-primary">Últimas Solicitudes Recibidas</h2>
                </div>

                <button type="button" onclick="irASolicitudes('todas')" class="text-xs font-bold text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 flex items-center gap-1 group cursor-pointer transition-colors">
                  <span>Ver todas (${rawData.length})</span>
                  <i data-lucide="arrow-right" class="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform"></i>
                </button>
              </div>

              <!-- Listado Continuo de Solicitudes con Holgura y 2 Líneas Fluidas -->
              <div class="divide-y divide-slate-100/80 dark:divide-slate-800/60" id="escritorio-solicitudes-list">
                ${ultimasSolicitudes.length === 0 ? `
                  <div class="py-16 text-center text-xs text-text-tertiary flex flex-col items-center justify-center">
                    <div class="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mb-2">
                      <i data-lucide="check-circle-2" class="w-6 h-6 text-brand-500"></i>
                    </div>
                    <p class="font-bold text-text-secondary text-xs">Sin registros</p>
                    <p class="text-[11px] text-text-tertiary mt-0.5">No hay solicitudes registradas.</p>
                  </div>
                ` : ultimasSolicitudes.map(item => {
                  const badgeEstado = getEstadoBadge(item);

                  const fechaIngresoDisplay = formatDateForDisplay(item.fecha_ingreso);
                  const representadoInfo = item.representado ? ` <span class="text-text-tertiary">(${escapeHtml(item.representado)})</span>` : '';

                  return `
                    <div onclick="window.showSolicitudDetailsModal(${item.id})" class="py-3.5 px-3 flex items-center justify-between gap-4 hover:bg-slate-50/90 dark:hover:bg-slate-800/60 rounded-xl transition-all duration-150 cursor-pointer group border border-transparent hover:border-border-ui">
                      <div class="min-w-0 space-y-1">
                        <!-- Línea 1: Folio + Estado + Fecha -->
                        <div class="flex items-center gap-2 flex-wrap">
                          <span class="font-mono text-xs font-bold text-text-secondary">${escapeHtml(item.folio_lobby || 'Sin Folio')}</span>
                          <span class="text-[10px] font-semibold px-2 py-0.5 rounded-md border ${badgeEstado.class || 'badge-status-otros'}">
                            ${escapeHtml(badgeEstado.text || item.estado || 'Ingresada')}
                          </span>
                          ${fechaIngresoDisplay ? `
                            <span class="text-[11px] text-text-tertiary font-mono">
                              · ${escapeHtml(fechaIngresoDisplay)}
                            </span>
                          ` : ''}
                        </div>

                        <!-- Línea 2: Sujeto Pasivo + Solicitante -->
                        <div class="text-xs text-text-secondary truncate">
                          <span class="font-semibold text-text-secondary">${escapeHtml(item.sujeto_pasivo || 'No asignado')}</span>
                          <span class="text-text-tertiary"> · Solicitante: </span>
                          <span>${escapeHtml(item.sujeto_activo || 'Particular')}</span>${representadoInfo}
                        </div>
                      </div>

                      <!-- Botón Ver Ficha Sutil -->
                      <button type="button" onclick="event.stopPropagation(); window.showSolicitudDetailsModal(${item.id})" class="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-slate-800 border border-border-ui text-text-secondary group-hover:text-brand-600 group-hover:border-brand-300 dark:group-hover:text-brand-300 shadow-2xs shrink-0 cursor-pointer transition-all">
                        Ver Ficha
                      </button>
                    </div>
                  `;
                }).join('')}
              </div>
          </div>

          <!-- SECCIÓN DERECHA: AGENDA DE HOY (5 COLS) -->
          <div class="lg:col-span-5 pt-8 pb-8 px-8 flex flex-col bg-slate-50/20 dark:bg-slate-800/10">
            <!-- Cabecera de la Agenda -->
              <div class="flex items-center justify-between pb-4 mb-3 border-b border-border-ui">
                <div>
                  <div class="flex items-center gap-2">
                    <span class="w-2.5 h-2.5 rounded-full bg-indigo-600"></span>
                    <h2 class="text-xs font-black uppercase tracking-wider text-text-primary">Agenda de Hoy</h2>
                    <span class="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-900/50">
                      ${audienciasHoyTodas.length} ${audienciasHoyTodas.length === 1 ? 'audiencia' : 'audiencias'}
                    </span>
                  </div>
                  <p class="text-[11px] text-text-tertiary mt-0.5">
                    ${proximaReunionLabel}
                  </p>
                </div>

                <button type="button" onclick="irAAgendaHoy()" class="text-xs font-bold text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 flex items-center gap-1 cursor-pointer transition-colors">
                  <span>Ver agenda</span>
                  <i data-lucide="arrow-right" class="w-3.5 h-3.5"></i>
                </button>
              </div>

              <!-- Cronología Continua de Audiencias con Mayor Aire y Hover Visible -->
              <div class="divide-y divide-slate-100/80 dark:divide-slate-800/60" id="escritorio-agenda-list">
                ${audienciasHoy.length === 0 ? `
                  <div class="py-16 text-center text-xs text-text-tertiary flex flex-col items-center justify-center">
                    <div class="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mb-2">
                      <i data-lucide="calendar-check" class="w-6 h-6 text-indigo-400"></i>
                    </div>
                    <p class="font-bold text-text-secondary text-xs">Sin audiencias programadas hoy</p>
                    <p class="text-[11px] text-text-tertiary mt-0.5">Puedes consultar la programación completa en la Agenda.</p>
                  </div>
                ` : audienciasHoy.map(item => {
                  const horaStr = (item.fecha_agendada && item.fecha_agendada.includes(' '))
                    ? item.fecha_agendada.split(' ')[1].slice(0, 5)
                    : 'Por fijar';
                  const esVideo = (item.forma || '').toLowerCase().includes('video');
                  const formaLabel = esVideo ? 'Videollamada' : 'Presencial';

                  return `
                    <div onclick="window.showSolicitudDetailsModal(${item.id})" class="py-3.5 px-3 flex items-start justify-between gap-3 bg-white/60 dark:bg-slate-900/40 hover:bg-indigo-50/90 dark:hover:bg-indigo-950/60 rounded-xl transition-all duration-150 cursor-pointer group border border-transparent hover:border-indigo-200/70 dark:hover:border-indigo-800/60 hover:shadow-2xs">
                      <div class="flex items-start gap-3.5 min-w-0">
                        <!-- Píldora de Hora y Modalidad -->
                        <div class="w-16 shrink-0 text-center space-y-0.5 pt-0.5">
                          <span class="font-mono text-xs font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-md border border-indigo-200 dark:border-indigo-800 block">
                            ${horaStr}
                          </span>
                          <span class="text-[10px] font-semibold text-text-tertiary block">
                            ${formaLabel}
                          </span>
                        </div>

                        <!-- Detalle de la Audiencia en 2 Líneas Claras -->
                        <div class="min-w-0 space-y-1">
                          <h4 class="text-xs font-semibold text-text-secondary truncate group-hover:text-indigo-700 dark:group-hover:text-indigo-300 transition-colors">
                            ${escapeHtml(item.sujeto_pasivo || 'Autoridad')}
                          </h4>
                          <p class="text-xs text-text-secondary truncate">
                            <span class="text-text-tertiary">Gestor: </span><span>${escapeHtml(item.sujeto_activo || 'Particular')}</span>${item.representado ? ` <span class="text-text-tertiary">(${escapeHtml(item.representado)})</span>` : ''}
                          </p>
                        </div>
                      </div>

                      <!-- Botón Detalle -->
                      <button type="button" onclick="event.stopPropagation(); window.showSolicitudDetailsModal(${item.id})" class="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-slate-800 border border-border-ui text-text-secondary group-hover:text-indigo-600 group-hover:border-indigo-300 dark:group-hover:text-indigo-400 shadow-2xs shrink-0 cursor-pointer transition-all">
                        Ver
                      </button>
                    </div>
                  `;
                }).join('')}
              </div>
          </div>

        </div>

      </div>

    </div>
  `;

  if (typeof lucide !== 'undefined' && lucide.createIcons) {
    lucide.createIcons();
  }

  startDashboardLiveClock();

  return false;
}

/**
 * Inicia el segundero en vivo del reloj del Escritorio
 */
function startDashboardLiveClock() {
  if (typeof window === 'undefined') return;
  if (window.dashboardClockInterval) {
    clearInterval(window.dashboardClockInterval);
    window.dashboardClockInterval = null;
  }
  const clockEl = document.getElementById('escritorio-live-clock');
  if (!clockEl) return;

  const updateClock = () => {
    const el = document.getElementById('escritorio-live-clock');
    if (!el) {
      if (window.dashboardClockInterval) {
        clearInterval(window.dashboardClockInterval);
        window.dashboardClockInterval = null;
      }
      return;
    }
    const current = new Date();
    const timeStr = current.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    el.textContent = `${timeStr} hrs`;
  };

  window.dashboardClockInterval = setInterval(updateClock, 1000);
}

// Helpers de navegación rápida con filtros consistentes
if (typeof window !== 'undefined') {
  window.irASolicitudes = async function(tipo) {
    window.activeAudienciasSubTab = 'solicitudes';
    if (!window.paginationState) window.paginationState = {};
    if (!window.paginationState.solicitudes) {
      window.paginationState.solicitudes = { page: 1, filters: {} };
    }
    window.paginationState.solicitudes.page = 1;
    const f = window.paginationState.solicitudes.filters || (window.paginationState.solicitudes.filters = {});
    
    f.folio = '';
    f.nombre = '';
    f.cargo = '';
    f.sujetoActivoRepresentado = '';
    f.fechaInicio = '';
    f.fechaTermino = '';

    if (tipo === 'fuera_plazo') {
      f.estado = 'Ingresada';
      f.estadoPlazo = 'FDP';
    } else if (tipo === 'dentro_plazo') {
      f.estado = 'Ingresada';
      f.estadoPlazo = 'DDP';
    } else if (tipo === 'suspendidas') {
      f.estado = 'Suspendida';
      f.estadoPlazo = '';
    } else if (tipo === 'pendientes') {
      f.estado = 'Ingresada';
      f.estadoPlazo = '';
    } else {
      f.estado = '';
      f.estadoPlazo = '';
    }

    if (typeof window.switchView === 'function') {
      await window.switchView('audiencias');
    }
  };

  window.irAPublicadas = async function(tipo) {
    window.activeAudienciasSubTab = 'pendientes';
    if (!window.paginationState) window.paginationState = {};
    if (!window.paginationState.pendientes) {
      window.paginationState.pendientes = { page: 1, filters: {} };
    }
    window.paginationState.pendientes.page = 1;
    window.paginationState.pendientes.filters = {};

    if (tipo === 'fuera_plazo') {
      window.paginationState.pendientes.filters.estado = 'fuera de plazo';
    } else if (tipo === 'dentro_plazo') {
      window.paginationState.pendientes.filters.estado = 'en plazo';
    }

    if (typeof window.switchView === 'function') {
      await window.switchView('audiencias');
    }
  };

  window.irAAgendaHoy = async function() {
    window.calendarViewMode = 'day';
    window.currentCalendarDate = new Date();
    if (typeof window.switchView === 'function') {
      await window.switchView('agenda');
    }
  };
}

export const DashboardView = {
  async mount(container, params = {}) {
    if (typeof window !== 'undefined') {
      window.currentView = 'dashboard';
    }
    // 1. Renderizado visual inmediato
    renderDashboard(container);

    // 2. Sincronización en segundo plano
    try {
      const ds = window.dataStore || (window.dataStore = {});
      const [resStats, resSol, resPub] = await Promise.all([
        fetch('/api/stats').then(r => r.ok ? r.json() : {}).catch(() => ({})),
        fetch('/api/solicitudes').then(r => r.ok ? r.json() : []).catch(() => []),
        fetch('/api/publicadas').then(r => r.ok ? r.json() : []).catch(() => [])
      ]);
      ds.stats = resStats;
      ds.dashboardRawData = resSol;
      ds.publicadas = resPub;
      renderDashboard(container);
      if (typeof window.updateSidebarBadges === 'function') {
        window.updateSidebarBadges();
      }
    } catch (e) {
      console.warn('[DashboardView/Escritorio] Error cargando datos en segundo plano:', e);
    }
  },

  unmount() {
    if (typeof window !== 'undefined' && window.dashboardClockInterval) {
      clearInterval(window.dashboardClockInterval);
      window.dashboardClockInterval = null;
    }
  }
};

if (typeof window !== 'undefined') {
  window.renderDashboardModule = renderDashboard;
  window.renderDashboard = renderDashboard;
  window.DashboardView = DashboardView;
}
