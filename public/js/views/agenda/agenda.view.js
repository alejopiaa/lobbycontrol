/**
 * AgendaView - Vista modular de Agenda y Calendario de Audiencias
 * LobbyControl - Arquitectura Modular ESM
 */

import {
  renderVigenciaSelect
} from '../../components/ui.js';
import {
  formatDateForDisplay,
  escapeHtml,
  escapeHtmlAttr
} from '../../utils/formatters.js';

/**
 * Helpers locales para fecha
 * @param {string|Date} date - Parámetro date.
 */
export function formatLocalDateYYYYMMDD(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function getCalendarActiveTitle() {
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
  const dateObj = window.currentCalendarDate || new Date();
  const year = dateObj.getFullYear();
  const viewMode = window.calendarViewMode || 'month';

  if (viewMode === "month") {
    return `${months[dateObj.getMonth()]} ${year}`;
  } else if (viewMode === "week") {
    const currentDayOfWeek = dateObj.getDay();
    const daysToMon = currentDayOfWeek === 0 ? -6 : 1 - currentDayOfWeek;
    const monDate = new Date(dateObj);
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
    return `${dateObj.getDate()} de ${months[dateObj.getMonth()]} ${year}`;
  }
}

export function calculateCalendarDateRange() {
  let start = "";
  let end = "";
  const dateObj = window.currentCalendarDate || new Date();
  const viewMode = window.calendarViewMode || 'month';

  if (viewMode === "month") {
    const year = dateObj.getFullYear();
    const month = dateObj.getMonth();
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
  } else if (viewMode === "week") {
    const currentDayOfWeek = dateObj.getDay();
    const daysToMon = currentDayOfWeek === 0 ? -6 : 1 - currentDayOfWeek;

    const monDate = new Date(dateObj);
    monDate.setDate(monDate.getDate() + daysToMon);

    const sunDate = new Date(monDate);
    sunDate.setDate(sunDate.getDate() + 6);

    start = formatLocalDateYYYYMMDD(monDate);
    end = formatLocalDateYYYYMMDD(sunDate) + " 23:59:59";
  } else {
    const dateStr = formatLocalDateYYYYMMDD(dateObj);
    start = dateStr;
    end = dateStr + " 23:59:59";
  }

  return { start, end };
}

export async function fetchAndDrawCalendar() {
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
      const rawEvents = await res.json();
      const events = Array.isArray(rawEvents) ? rawEvents : (rawEvents && Array.isArray(rawEvents.data) ? rawEvents.data : []);
      window.calendarEvents = events;
      drawCalendarBodyOnly();
    } else {
      placeholder.innerHTML = `
        <div class="py-20 text-center glass-card rounded-2xl border border-border-ui">
          <i data-lucide="alert-circle" class="h-10 w-10 text-rose-500/80 mx-auto mb-3 animate-pulse"></i>
          <p class="text-xs text-rose-400 font-semibold">Error al cargar datos del calendario.</p>
        </div>
      `;
      if (window.lucide) window.lucide.createIcons();
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
    if (window.lucide) window.lucide.createIcons();
  }
}

export function detectCalendarConflicts(events) {
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

    group.forEach((e) => {
      const timePart = e.fecha_agendada.split(" ")[1] || "00:00";
      const [h, m] = timePart.split(":").map(Number);
      e._epoch = h * 60 + m;
    });

    group.sort((a, b) => a._epoch - b._epoch);

    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const a = group[i];
        const b = group[j];

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

export function drawCalendarBodyOnly() {
  const rangeLabel = document.getElementById("calendar-active-range-label");
  if (rangeLabel) {
    rangeLabel.textContent = getCalendarActiveTitle();
  }

  const events = window.calendarEvents || [];
  detectCalendarConflicts(events);

  const filters = window.calendarFilters || { search: '', vigencia: 'todos' };
  let filtered = events;
  const activeIdsCache = window.activeSujetoIdsCache;
  const dropdownCache = window.dashboardDropdownCache || {};

  if (filters.vigencia === 'vigentes' || filters.soloVigentes === true) {
    filtered = filtered.filter((e) => {
      if (e.sujeto_pasivo_id && activeIdsCache && (activeIdsCache.has(Number(e.sujeto_pasivo_id)) || activeIdsCache.has(String(e.sujeto_pasivo_id)))) {
        return true;
      }
      if (dropdownCache.nombresVigentes && e.sujeto_pasivo) {
        return dropdownCache.nombresVigentes.some(n => n.toLowerCase() === e.sujeto_pasivo.toLowerCase());
      }
      return false;
    });
  } else if (filters.vigencia === 'no_vigentes') {
    filtered = filtered.filter((e) => {
      if (e.sujeto_pasivo_id && activeIdsCache && (activeIdsCache.has(Number(e.sujeto_pasivo_id)) || activeIdsCache.has(String(e.sujeto_pasivo_id)))) {
        return false;
      }
      if (dropdownCache.nombresVigentes && e.sujeto_pasivo) {
        return !dropdownCache.nombresVigentes.some(n => n.toLowerCase() === e.sujeto_pasivo.toLowerCase());
      }
      return true;
    });
  }
  if (filters.search) {
    const query = filters.search.toLowerCase().trim();
    filtered = filtered.filter(
      (e) =>
        (e.sujeto_pasivo || "").toLowerCase().includes(query) ||
        (e.cargo_limpio || e.cargo || "").toLowerCase().includes(query) ||
        (e.folio_lobby || "").toLowerCase().includes(query),
    );
  }

  const placeholder = document.getElementById("calendar-content-placeholder");
  if (!placeholder) return;

  const viewMode = window.calendarViewMode || 'month';
  if (viewMode === "month") {
    drawMonthView(placeholder, filtered);
  } else if (viewMode === "week") {
    drawWeekView(placeholder, filtered);
  } else {
    drawDayView(placeholder, filtered);
  }
}

export function drawMonthView(container, events = []) {
  if (!Array.isArray(events)) events = [];
  const dateObj = window.currentCalendarDate || new Date();
  const year = dateObj.getFullYear();
  const month = dateObj.getMonth();

  const hasWeekendEventsInMonth = events.some((e) => {
    if (!e.fecha_agendada) return false;
    const [datePart] = e.fecha_agendada.split(" ");
    const [y, m, d] = datePart.split("-").map(Number);
    if (y === year && m - 1 === month) {
      const dayOfWeek = new Date(y, m - 1, d).getDay();
      return dayOfWeek === 0 || dayOfWeek === 6;
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

  const lastDayOfMonth = new Date(year, month + 1, 0);
  const endDay = lastDayOfMonth.getDay();
  let daysAfter = endDay === 0 ? 0 : 7 - endDay;
  const totalDaysSpan = prevMonthDaysCount + lastDayOfMonth.getDate() + daysAfter;
  const weeksCount = Math.ceil(totalDaysSpan / 7);

  let html = `
    <div class="grid ${hasWeekendEventsInMonth ? "grid-cols-7" : "grid-cols-5"} gap-px rounded-2xl overflow-hidden border border-border-ui bg-border-ui shadow-sm h-[calc(100vh-250px)] min-h-[520px]">
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
             class="p-2 flex flex-col justify-between min-h-0 overflow-hidden transition-colors ${ isToday ? "bg-violet-50/60 dark:bg-violet-950/30 ring-2 ring-brand-500 ring-inset z-10 cursor-pointer"
                 : isCurrentMonth
                   ? isWeekend
                     ? "bg-amber-50/30 dark:bg-amber-950/20 hover:bg-amber-100/40 cursor-pointer"
                     : "bg-bg-card hover:bg-violet-50/40 dark:hover:bg-violet-950/20 cursor-pointer"
                   : "bg-bg-main opacity-30 select-none cursor-default"
             }">
          <!-- Header del día -->
          <div class="flex items-center justify-between leading-none mb-1 select-none">
            <span class="text-xs font-bold ${ isToday ? "w-6 h-6 flex items-center justify-center rounded-full bg-brand-600 text-white shadow-sm"
                : isCurrentMonth
                  ? isWeekend
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-text-primary"
                  : "text-text-tertiary"
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
                     class="flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10.5px] border cursor-pointer select-none transition-all hover:scale-[1.01] shadow-xs ${ isWeekend ? "bg-amber-50 dark:bg-amber-950/50 border-amber-300 dark:border-amber-700/60 text-amber-950 dark:text-amber-100"
                         : isPast
                           ? "bg-border-ui border-border-ui text-text-secondary hover:bg-border-ui"
                           : "bg-violet-50 dark:bg-violet-950/50 border-violet-200/90 dark:border-violet-800/60 text-text-primary hover:bg-violet-100 dark:hover:bg-violet-900/60"
                     } ${e.hasConflict ? "ring-1 ring-amber-500/40" : ""}"
                     title="${escapeHtmlAttr(e.sujeto_pasivo)} (${timeStr}) - Folio: ${escapeHtmlAttr(e.folio_lobby || "Sin Folio")}${isWeekend ? ' [⚠️ Fin de semana]' : ''}">
                  <span class="font-mono font-bold text-[10px] shrink-0 ${isWeekend ? "text-amber-600 dark:text-amber-400" : e.hasConflict ? "text-amber-500" : isPast ? "text-text-tertiary" : "text-violet-700 dark:text-violet-400"}">${timeStr}</span>
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

export function openDayEventsModal(dateStr) {
  try {
    const event = window.event;
    if (event) event.stopPropagation();

    const eventsList = window.calendarEvents || [];
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

    const dateFormatted = typeof window.formatDate === 'function'
      ? window.formatDate(dateStr)
      : formatDateForDisplay(dateStr);

    const getCargoCleanFn = typeof window.getCargoClean === 'function'
      ? window.getCargoClean
      : (cargo) => cargo || '';

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
              <p class="text-xs text-text-tertiary">${dateFormatted}</p>
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
                   class="p-3 rounded-2xl border text-left cursor-pointer transition-all hover:scale-[1.01] ${ isPast ? 'bg-bg-main border-border-ui' : 'bg-violet-50/70 dark:bg-violet-950/30 border-violet-200/80 dark:border-violet-800/50 hover:bg-violet-100/80' } ${e.hasConflict ? 'ring-1 ring-amber-500/40' : ''}">
                <div class="flex items-center justify-between mb-1 select-none">
                  <span class="text-xs font-bold font-mono ${e.hasConflict ? 'text-amber-500' : isPast ? 'text-text-tertiary' : 'text-violet-700 dark:text-violet-400'}">${e.hasConflict ? '⚠️ ' : ''}${timeStr} hrs</span>
                  <div class="flex items-center gap-1.5">
                    ${e.hasConflict ? '<span class="text-[8px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20 px-1.5 py-0.5 rounded">CHOQUE</span>' : ''}
                    <span class="text-[8.5px] font-bold font-mono px-1.5 py-0.5 rounded bg-border-ui text-text-secondary border border-border-ui">Folio: ${escapeHtml(e.folio_lobby || 's/f')}</span>
                  </div>
                </div>
                <h4 class="text-xs font-bold truncate text-text-primary">${escapeHtml(e.sujeto_pasivo)}</h4>
                <p class="text-[11px] text-text-tertiary truncate mt-0.5">${escapeHtml(e.cargo_limpio || getCargoCleanFn(e.cargo))}</p>
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

    if (window.lucide) window.lucide.createIcons();
  } catch (err) {
    console.error("Error al abrir popover de audiencias del día:", err);
  }
}

export function drawWeekView(container, events = []) {
  if (!Array.isArray(events)) events = [];
  const dateObj = window.currentCalendarDate || new Date();
  const currentDayOfWeek = dateObj.getDay();
  const daysToMon = currentDayOfWeek === 0 ? -6 : 1 - currentDayOfWeek;

  const monDate = new Date(dateObj);
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

  const hasWeekendEvents =
    weekDays[5].events.length > 0 || weekDays[6].events.length > 0;
  const activeDays = hasWeekendEvents ? weekDays : weekDays.slice(0, 5);
  const gridColsClass = hasWeekendEvents ? "grid-cols-7" : "grid-cols-5";

  let html = `<div class="w-full grid ${gridColsClass} gap-3 h-[calc(100vh-250px)] min-h-[520px]">`;

  activeDays.forEach((day) => {
    html += `
      <div class="flex flex-col rounded-2xl border ${ day.isWeekend
          ? "border-amber-200 dark:border-amber-900/60 bg-amber-50/10"
          : "border-border-ui bg-bg-card"
      } ${
        day.isToday ? "ring-2 ring-brand-500 shadow-md shadow-brand-500/10" : ""
      } p-3.5 overflow-hidden shadow-xs">
        <div class="border-b border-border-ui pb-2 mb-2.5 text-center select-none shrink-0 ${day.isToday ? "bg-brand-500/10 rounded-xl pt-1.5 pb-1.5" : ""}">
          <p class="text-[10.5px] font-bold uppercase tracking-wider ${day.isToday ? "text-brand-600 dark:text-brand-400" : day.isWeekend ? "text-amber-600 dark:text-amber-400" : "text-text-tertiary"}">${day.name}</p>
          <p class="text-lg font-extrabold mt-0.5 ${day.isToday ? "text-brand-600 dark:text-brand-400" : "text-text-primary"}">${day.date}</p>
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
                   class="p-3 rounded-xl border border-border-ui border-l-4 ${ day.isWeekend ? "border-l-amber-500 bg-amber-50/50 dark:bg-amber-950/30"
                       : isPast
                         ? "border-l-border-ui bg-bg-main"
                         : "border-l-brand-500 bg-violet-50/40 dark:bg-violet-950/20 hover:bg-violet-50 dark:hover:bg-violet-950/40"
                   } cursor-pointer text-left transition-all hover:scale-[1.01] shadow-xs ${e.hasConflict ? "ring-1 ring-amber-500/40" : ""}"
                   title="${escapeHtmlAttr(e.sujeto_pasivo)} - Folio: ${escapeHtmlAttr(e.folio_lobby || "Sin Folio")}${day.isWeekend ? " [⚠️ Reunión en Fin de Semana]" : ""}">
                <!-- Fila 1: Hora + Folio + Badges -->
                <div class="flex items-center justify-between mb-1 select-none">
                  <span class="text-[10.5px] font-bold font-mono ${day.isWeekend ? "text-amber-600 dark:text-amber-400" : e.hasConflict ? "text-amber-500 dark:text-amber-400" : isPast ? "text-text-tertiary" : "text-violet-700 dark:text-violet-300"}">${e.hasConflict ? "⚠️ " : ""}${timeStr}</span>
                  <div class="flex gap-1 items-center">
                    ${day.isWeekend ? `<span class="text-[7px] font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20 px-1 py-0.5 rounded shadow-sm select-none">⚠️ FIN DE SEMANA</span>` : ""}
                    ${e.hasConflict ? `<span class="text-[7px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20 px-1 py-0.5 rounded shadow-sm select-none">CHOQUE</span>` : ""}
                    <span class="text-[8.5px] font-bold font-mono px-1.5 py-0.5 rounded bg-border-ui text-text-secondary border border-border-ui">Folio: ${escapeHtml(e.folio_lobby || "s/f")}</span>
                  </div>
                </div>
                <!-- Fila 2: Sujeto Pasivo -->
                <h4 class="text-xs font-bold truncate ${isPast ? "text-text-secondary" : "text-text-primary"}" title="${escapeHtmlAttr(e.sujeto_pasivo)}">${escapeHtml(e.sujeto_pasivo)}</h4>
                <!-- Fila 3: Sujeto Activo / Representado -->
                <p class="text-[10px] truncate mt-0.5 font-medium ${isPast ? "text-text-tertiary" : "text-text-tertiary"}" title="${escapeHtmlAttr((e.sujeto_activo || "Sin Lobbista") + (e.representado ? " · " + e.representado : ""))}">
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

export function drawDayView(container, events = []) {
  if (!Array.isArray(events)) events = [];
  const today = new Date();
  const todayStr = formatLocalDateYYYYMMDD(today);
  const dateObj = window.currentCalendarDate || new Date();
  const activeDateStr = formatLocalDateYYYYMMDD(dateObj);

  const cellEvents = events
    .filter(
      (e) => e.fecha_agendada && e.fecha_agendada.startsWith(activeDateStr),
    )
    .sort((a, b) =>
      (a.fecha_agendada || "").localeCompare(b.fecha_agendada || ""),
    );

  const prevMode = window.previousCalendarViewMode;
  const backTargetMode =
    typeof prevMode !== "undefined" && prevMode === "week"
      ? "week"
      : "month";
  const backLabel =
    backTargetMode === "week" ? "Volver a Semana" : "Volver al Mes";

  const dateFormatted = typeof window.formatDate === 'function'
    ? window.formatDate(activeDateStr)
    : formatDateForDisplay(activeDateStr);

  const getCargoCleanFn = typeof window.getCargoClean === 'function'
    ? window.getCargoClean
    : (cargo) => cargo || '';

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
            <p class="text-xs text-text-tertiary">${dateFormatted}</p>
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
                     class="p-4 rounded-2xl border text-left cursor-pointer transition-all hover:scale-[1.005] shadow-xs hover:shadow-md ${ isPast ? "bg-bg-main border-border-ui"
                         : "bg-bg-card border-border-ui hover:border-brand-500/40"
                     } flex flex-col gap-3 ${e.hasConflict ? "ring-1 ring-amber-500/40 shadow-md" : ""}">
                  <!-- Top Row: Time & Folio Badges -->
                  <div class="flex items-center justify-between select-none">
                    <div class="flex items-center gap-2">
                      <span class="px-2.5 py-1 rounded-lg text-xs font-mono font-bold ${ e.hasConflict ? "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                          : isPast
                            ? "bg-border-ui text-text-secondary"
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
                    <h4 class="text-sm font-bold truncate ${isPast ? "text-text-secondary" : "text-text-primary"}">${escapeHtml(e.sujeto_pasivo)}</h4>
                    <p class="text-xs font-medium mt-0.5 truncate text-text-tertiary">${escapeHtml(e.cargo_limpio || getCargoCleanFn(e.cargo))}</p>
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
  if (window.lucide) window.lucide.createIcons();
}

export function showAgendaDetailsModal(eventId) {
  try {
    const event = window.event;
    if (event) event.stopPropagation();

    const eventsList = window.calendarEvents || [];
    const item = eventsList.find((e) => e.id == eventId);
    if (!item) {
      if (typeof window.showToast === 'function') {
        window.showToast(
          "No se encontró la reunión en el listado de eventos.",
          "error"
        );
      }
      return;
    }

    const modal = document.getElementById("modal-container");
    if (!modal) {
      if (typeof window.showToast === 'function') {
        window.showToast(
          "Error: No se encontró el contenedor modal en el DOM.",
          "error"
        );
      }
      return;
    }

    const dStore = window.dataStore || {};
    const publicadosFolios = new Set(
      (dStore.publicadas?.data || dStore.publicadas || [])
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
      const getDelayFn = typeof window.getPendingPublicationDelay === 'function'
        ? window.getPendingPublicationDelay
        : () => ({ badgeClass: 'badge-status-vencido', text: 'Fuera de plazo', days: 0 });
      const delayInfo = getDelayFn(item.fecha_agendada, item);
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

    const dateFormatted = typeof window.formatDate === 'function'
      ? window.formatDate(item.fecha_agendada)
      : formatDateForDisplay(item.fecha_agendada);

    const getCargoCleanFn = typeof window.getCargoClean === 'function'
      ? window.getCargoClean
      : (cargo) => cargo || '';

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
              <span class="text-xs font-semibold text-text-secondary">Folio: 
                ${item.folio_lobby && item.folio_lobby !== 'Sin Folio' ? `
                  <button type="button" onclick="copiarFolio('${escapeHtmlAttr(item.folio_lobby)}', event)" 
                          class="font-mono text-brand-500 dark:text-brand-400 hover:text-brand-600 dark:hover:text-brand-300 font-bold inline-flex items-center gap-1 cursor-pointer hover:underline active:scale-95" 
                          title="Clic para copiar folio">
                    <span>${escapeHtml(item.folio_lobby)}</span>
                    <i data-lucide="copy" class="h-3 w-3"></i>
                  </button>
                ` : `<span class="font-mono text-brand-500 dark:text-brand-400 font-bold">Sin Folio</span>`}
              </span>
            </div>
          </div>
          <button onclick="closeModal()" title="Cerrar modal" aria-label="Cerrar modal" class="h-7 w-7 rounded-lg flex items-center justify-center border border-border-ui hover:bg-border-ui dark:hover:bg-border-ui/50 text-text-tertiary hover:text-text-primary transition-colors cursor-pointer">
            <i data-lucide="x" class="h-4 w-4"></i>
          </button>
        </div>

        <!-- Info grid -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div>
            <span class="text-[10px] text-text-tertiary block uppercase tracking-wider font-bold">Fecha / Hora Agendada</span>
            <span class="text-text-secondary font-semibold">${dateFormatted}${item.fecha_agendada && item.fecha_agendada.split(' ')[1] ? ' ' + item.fecha_agendada.split(' ')[1].slice(0, 5) : ''}</span>
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
            <p class="text-xs text-text-tertiary font-medium mt-0.5">${escapeHtml(item.cargo_limpio || getCargoCleanFn(item.cargo))}</p>
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

    if (window.lucide) window.lucide.createIcons();
  } catch (err) {
    if (typeof window.showToast === 'function') {
      window.showToast("Error al abrir el modal de detalles: " + err.message, "error");
    }
    console.error(err);
  }
}

export function renderAgenda(container) {
  const filters = window.calendarFilters || { search: '', vigencia: 'todos' };
  const searchVal = filters.search || "";
  const viewMode = window.calendarViewMode || 'month';

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
            value: filters.vigencia,
            onChange: "changeCalendarVigencia",
          })}

          <!-- Temporal Navigation Capsule -->
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
          
          <!-- View Switcher -->
          <div class="flex items-center bg-bg-main p-1 rounded-xl border border-border-ui gap-0.5">
            ${["month", "week", "day"]
              .map((view) => {
                const label =
                  view === "month" ? "Mes" : view === "week" ? "Semana" : "Día";
                const active = viewMode === view;
                const activeClass = active
                  ? "bg-brand-600 text-white shadow-sm font-bold"
                  : "text-text-tertiary hover:text-text-primary font-semibold";
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
  if (window.lucide) window.lucide.createIcons();

  fetchAndDrawCalendar();
}

export function changeCalendarViewMode(mode) {
  const currentMode = window.calendarViewMode || 'month';
  if (currentMode !== mode && currentMode !== "day") {
    window.previousCalendarViewMode = currentMode;
  }
  window.calendarViewMode = mode;
  if (typeof window.renderView === 'function') {
    window.renderView();
  } else {
    const container = document.getElementById("main-content");
    renderAgenda(container);
  }
}

export function navigateCalendar(direction) {
  const current = window.currentCalendarDate || new Date();
  const mode = window.calendarViewMode || 'month';
  if (mode === "month") {
    current.setMonth(current.getMonth() + direction);
  } else if (mode === "week") {
    current.setDate(current.getDate() + direction * 7);
  } else if (mode === "day") {
    current.setDate(current.getDate() + direction);
  }
  window.currentCalendarDate = current;
  if (typeof window.renderView === 'function') {
    window.renderView();
  } else {
    const container = document.getElementById("main-content");
    renderAgenda(container);
  }
}

export function goCalendarToday() {
  window.currentCalendarDate = new Date();
  if (window.calendarFilters) {
    window.calendarFilters.search = "";
  }
  if (typeof window.renderView === 'function') {
    window.renderView();
  } else {
    const container = document.getElementById("main-content");
    renderAgenda(container);
  }
}

export function onCalendarSearchInput(val) {
  if (window.calendarFilters) {
    window.calendarFilters.search = val;
  }
  drawCalendarBodyOnly();
  showCalendarSuggestions(val);
}

export function onCalendarSearchFocus() {
  const input = document.getElementById("search-calendar");
  if (input) showCalendarSuggestions(input.value);
}

export function onCalendarSearchKeydown(e) {
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
    if (window.calendarFilters) {
      window.calendarFilters.search = selectedText;
    }
    drawCalendarBodyOnly();
    list.classList.add("hidden");
  } else if (e.key === "Escape") {
    list.classList.add("hidden");
  }
}

export function showCalendarSuggestions(val) {
  const list = document.getElementById("cal-suggestions-list");
  if (!list) return;

  const query = (val || "").toLowerCase().trim();
  if (!query || query.length < 2) {
    list.classList.add("hidden");
    return;
  }

  const events = window.calendarEvents || [];
  const filters = window.calendarFilters || { search: '', vigencia: 'todos' };
  const activeIdsCache = window.activeSujetoIdsCache;
  const dropdownCache = window.dashboardDropdownCache || {};

  const sugSet = new Set();
  events.forEach((e) => {
    if (filters.vigencia === 'vigentes' || filters.soloVigentes === true) {
      const isVigente = (e.sujeto_pasivo_id && activeIdsCache && activeIdsCache.has(e.sujeto_pasivo_id)) ||
                        (dropdownCache.nombresVigentes && e.sujeto_pasivo && dropdownCache.nombresVigentes.some(n => n.toLowerCase() === e.sujeto_pasivo.toLowerCase()));
      if (!isVigente) return;
    } else if (filters.vigencia === 'no_vigentes') {
      const isVigente = (e.sujeto_pasivo_id && activeIdsCache && activeIdsCache.has(e.sujeto_pasivo_id)) ||
                        (dropdownCache.nombresVigentes && e.sujeto_pasivo && dropdownCache.nombresVigentes.some(n => n.toLowerCase() === e.sujeto_pasivo.toLowerCase()));
      if (isVigente) return;
    }
    if (e.sujeto_pasivo) sugSet.add(e.sujeto_pasivo);
    if (e.cargo_limpio) sugSet.add(e.cargo_limpio);
    else if (e.cargo) {
      const getCargoCleanFn = typeof window.getCargoClean === 'function'
        ? window.getCargoClean
        : (cargo) => cargo || '';
      const cl = getCargoCleanFn(e.cargo);
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

export function selectCalendarSuggestion(val) {
  const input = document.getElementById("search-calendar");
  if (input) {
    input.value = val;
  }
  if (window.calendarFilters) {
    window.calendarFilters.search = val;
  }
  drawCalendarBodyOnly();
  const list = document.getElementById("cal-suggestions-list");
  if (list) list.classList.add("hidden");
}

// Global click outside suggestions
if (typeof document !== 'undefined') {
  document.addEventListener("click", function (e) {
    const wrapper = document.getElementById("cal-search-wrapper");
    const list = document.getElementById("cal-suggestions-list");
    if (wrapper && list && !wrapper.contains(e.target)) {
      list.classList.add("hidden");
    }
  });
}

export const AgendaView = {
  async mount(container, params = {}) {
    return renderAgenda(container);
  },
  unmount() {}
};

if (typeof window !== 'undefined') {
  window.renderAgenda = renderAgenda;
  window.AgendaView = AgendaView;
  window.changeCalendarViewMode = changeCalendarViewMode;
  window.navigateCalendar = navigateCalendar;
  window.goCalendarToday = goCalendarToday;
  window.onCalendarSearchInput = onCalendarSearchInput;
  window.onCalendarSearchFocus = onCalendarSearchFocus;
  window.onCalendarSearchKeydown = onCalendarSearchKeydown;
  window.selectCalendarSuggestion = selectCalendarSuggestion;
  window.showCalendarSuggestions = showCalendarSuggestions;
  window.showAgendaDetailsModal = showAgendaDetailsModal;
  window.getCalendarActiveTitle = getCalendarActiveTitle;
  window.formatCalendarTitle = getCalendarActiveTitle;
  window.calculateCalendarDateRange = calculateCalendarDateRange;
  window.fetchAndDrawCalendar = fetchAndDrawCalendar;
  window.detectCalendarConflicts = detectCalendarConflicts;
  window.drawCalendarBodyOnly = drawCalendarBodyOnly;
  window.drawMonthView = drawMonthView;
  window.drawWeekView = drawWeekView;
  window.drawDayView = drawDayView;
  window.openDayEventsModal = openDayEventsModal;
  window.formatLocalDateYYYYMMDD = formatLocalDateYYYYMMDD;
}
