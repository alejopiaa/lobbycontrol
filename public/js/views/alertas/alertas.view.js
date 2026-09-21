/**
 * AlertasView - Vista modular del Centro de Alertas
 * LobbyControl - Arquitectura Modular ESM
 */

import { openConfirmModal, closeModal } from '../../components/modal.component.js';
import { showToast } from '../../components/toast.component.js';
import {
  formatDateForDisplay,
  escapeHtml,
  escapeHtmlAttr
} from '../../utils/formatters.js';

let activeAlertasTab = "no_leidas";
let alertasSearchQuery = "";
let activeAlertasType = "todos";

export function renderAlertasCentro(container) {
  if (!container) return;

  const getAlertsFn = typeof window.getActiveAlertsList === 'function'
    ? window.getActiveAlertsList
    : () => [];

  const allAlerts = getAlertsFn(true);
  const unreadAlerts = allAlerts.filter((w) => w.estado_gestion !== "leida");
  const readAlerts = allAlerts.filter((w) => w.estado_gestion === "leida");

  const activeList =
    activeAlertasTab === "no_leidas" ? unreadAlerts : readAlerts;
  const filteredList = activeList.filter((w) => {
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
        <button onclick="switchAlertasTab('no_leidas')" class="-mb-px px-4 py-2.5 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${ activeAlertasTab === "no_leidas"
            ? "border-brand-500 text-[var(--text-primary)] font-bold"
            : "border-transparent text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
        }">
          <i data-lucide="bell" class="h-4 w-4"></i>
          No leídas
          <span class="px-1.5 py-0.5 rounded-full text-[10px] bg-brand-500/20 text-brand-700 dark:text-brand-300 font-bold">
            ${unreadAlerts.length}
          </span>
        </button>
        <button onclick="switchAlertasTab('leidas')" class="-mb-px px-4 py-2.5 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${ activeAlertasTab === "leidas"
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
        <button onclick="switchAlertasType('todos')" class="px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${ activeAlertasType === "todos"
            ? "bg-border-ui  text-[var(--text-primary)] font-bold"
            : "text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-border-ui/50"
        }">
          Todos
        </button>
        <button onclick="switchAlertasType('solicitud')" class="px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${ activeAlertasType === "solicitud"
            ? "bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 font-bold"
            : "text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-border-ui/50"
        }">
          <span class="h-1.5 w-1.5 rounded-full bg-indigo-500 shrink-0"></span>
          Solicitudes
        </button>
        <button onclick="switchAlertasType('publicacion')" class="px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${ activeAlertasType === "publicacion"
            ? "bg-purple-500/10 border border-purple-500/30 text-purple-450 font-bold"
            : "text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-border-ui/50"
        }">
          <span class="h-1.5 w-1.5 rounded-full bg-purple-500 shrink-0"></span>
          Publicaciones
        </button>
        <button onclick="switchAlertasType('agenda')" class="px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${ activeAlertasType === "agenda"
            ? "bg-sky-500/10 border border-sky-500/30 text-sky-400 font-bold"
            : "text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-border-ui/50"
        }">
          <span class="h-1.5 w-1.5 rounded-full bg-sky-500 shrink-0"></span>
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
        <i data-lucide="${isSearch ? "search" : activeAlertasTab === "no_leidas" ? "check-circle" : "archive"}" class="h-12 w-12 ${isSearch ? "text-[var(--text-tertiary)]" : activeAlertasTab === "no_leidas" ? "text-emerald-500/80" : "text-[var(--text-tertiary)]"} mx-auto mb-3"></i>
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

            const deadlineDisplay = typeof window.formatDate === 'function'
              ? window.formatDate(w.deadline)
              : formatDateForDisplay(w.deadline);

            return `
            <div class="glass-card px-6 py-5 rounded-2xl ${w.color === "red" ? "card-alert-urgent" : w.color === "blue" ? "card-alert-info" : "card-alert-warning"} flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all hover:bg-border-ui dark:hover:bg-border-ui group font-sans">
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
                    ${dateIconHtml} Límite: <span class="text-[var(--text-secondary)] font-semibold">${deadlineDisplay}</span>
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

export function switchAlertasTab(tab) {
  activeAlertasTab = tab;
  const container = document.getElementById("main-content");
  renderAlertasCentro(container);
}

export function switchAlertasType(type) {
  activeAlertasType = type;
  const container = document.getElementById("main-content");
  renderAlertasCentro(container);
}

export function onAlertasSearch(val) {
  alertasSearchQuery = val;
  const container = document.getElementById("main-content");
  renderAlertasCentro(container);
}

/**
 * Acción individual: Cambiar estado (leída / no leída)
 * @param {string} type - Parámetro type.
 * @param {string|number} id - Parámetro id.
 * @param {*} estado - Parámetro estado.
 */
export async function changeAlertaEstado(type, id, estado) {
  try {
    const res = await fetch("/api/alertas/gestionar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        alertas: [{ tipo: type, solicitud_id: id, estado: estado }],
      }),
    });
    if (res.ok) {
      if (typeof window.showToast === 'function') {
        window.showToast(
          estado === "leida"
            ? "Alerta marcada como leída."
            : "Alerta marcada como no leída.",
        );
      }
      if (typeof window.fetchAlertas === 'function') {
        await window.fetchAlertas();
      }
    } else {
      if (typeof window.showToast === 'function') {
        window.showToast("Error al actualizar el estado de la alerta.", "error");
      }
    }
  } catch (err) {
    console.error(err);
    if (typeof window.showToast === 'function') {
      window.showToast("Error de red al actualizar la alerta.", "error");
    }
  }
}

/**
 * Acción individual: Borrar alerta (estado = 'borrada')
 * @param {string} type - Parámetro type.
 * @param {string|number} id - Parámetro id.
 */
export function deleteAlerta(type, id) {
  const confirmFn = typeof openConfirmModal === 'function'
    ? openConfirmModal
    : (window.openConfirmModal || ((title, msg, onConfirm) => onConfirm()));

  confirmFn(
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
          if (typeof window.showToast === 'function') {
            window.showToast("Alerta eliminada con éxito.");
          }
          if (typeof window.fetchAlertas === 'function') {
            await window.fetchAlertas();
          }
        } else {
          if (typeof window.showToast === 'function') {
            window.showToast("Error al eliminar la alerta.", "error");
          }
        }
      } catch (err) {
        console.error(err);
        if (typeof window.showToast === 'function') {
          window.showToast("Error de red al eliminar la alerta.", "error");
        }
      }
    },
  );
}

/**
 * Acción bulk: Marcar todas como leídas o borrar todo el historial
 * @param {*} estado - Parámetro estado.
 */
export function bulkChangeAlertaEstado(estado) {
  const getAlertsFn = typeof window.getActiveAlertsList === 'function'
    ? window.getActiveAlertsList
    : () => [];
  const allAlerts = getAlertsFn(true);
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
        if (typeof window.showToast === 'function') {
          window.showToast(
            estado === "leida"
              ? "Todas las alertas fueron marcadas como leídas."
              : "Historial de alertas limpio con éxito.",
          );
        }
        if (typeof window.fetchAlertas === 'function') {
          await window.fetchAlertas();
        }
      } else {
        if (typeof window.showToast === 'function') {
          window.showToast("Error al procesar la acción en lote.", "error");
        }
      }
    } catch (err) {
      console.error(err);
      if (typeof window.showToast === 'function') {
        window.showToast("Error de red al realizar la acción en lote.", "error");
      }
    }
  };

  const confirmFn = typeof openConfirmModal === 'function'
    ? openConfirmModal
    : (window.openConfirmModal || ((title, msg, onConfirm) => onConfirm()));

  confirmFn(modalTitle, modalText, performBulk);
}



/**
 * CAPA DE GESTIÓN Y WIDGET DE ALERTAS (DESACOPLADO DE app.js)
 */

function renderAlertasWidget() {
  const container = document.getElementById('alerts-widget-container');
  if (!container) return;

  if (!currentUser || !dataStore.alertas) {
    container.innerHTML = '';
    return;
  }

  const warnings = getActiveAlertsList(false);
  const hasWarnings = warnings.length > 0;

  container.innerHTML = `
    <button id="alerts-toggle-btn" onclick="toggleAlertsDropdown(event)" class="relative h-8 w-8 rounded-xl flex items-center justify-center border border-border-ui hover:border-border-ui bg-bg-main text-text-secondary hover:text-text-primary transition-all duration-200" title="Alertas de Plazos">
      <i data-lucide="bell" class="h-4 w-4"></i>
      ${hasWarnings ? `
        <span class="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold text-white ring-2 ring-[var(--bg-header)] animate-pulse">
          ${warnings.length}
        </span>
      ` : ''}
    </button>
    
    <div id="alerts-dropdown" class="hidden absolute right-0 mt-2 w-80 glass-card text-[var(--text-primary)] rounded-2xl p-4 z-50 flex flex-col gap-3">
      <div class="flex items-center justify-between border-b border-[var(--border-ui)] pb-2">
        <h3 class="text-xs font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
          <i data-lucide="alert-circle" class="h-3.5 w-3.5 text-brand-500 dark:text-brand-400"></i>
          Alertas de Plazos
        </h3>
        ${hasWarnings ? `
          <button onclick="dismissAllAlertas(event)" class="text-[10px] text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 font-bold transition-all duration-150 flex items-center gap-1 hover:underline cursor-pointer" title="Descartar todas las alertas actuales">
            <i data-lucide="check-check" class="h-3.5 w-3.5"></i> Descartar todo
          </button>
        ` : `
          <span class="text-[10px] text-[var(--text-tertiary)] font-medium">0 activas</span>
        `}
      </div>
      
      <div class="max-h-60 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
        ${!hasWarnings ? `
          <div class="text-center py-6 text-[var(--text-tertiary)] text-xs">
            <i data-lucide="check-circle" class="h-8 w-8 text-emerald-500/80 mx-auto mb-2"></i>
            <span>No hay alertas pendientes</span>
            <p class="text-[10px] text-[var(--text-tertiary)] mt-0.5">Todos los plazos están al día</p>
          </div>
        ` : warnings.map(w => `
          <div class="p-2.5 rounded-xl border border-[var(--border-ui)] border-l-4 ${ w.color === 'red' ? 'border-l-rose-500 bg-rose-500/[0.03] dark:bg-rose-950/10' : w.color === 'blue' ? 'border-l-blue-500 bg-blue-500/[0.03] dark:bg-blue-950/10' : 'border-l-amber-500 bg-amber-500/[0.03] dark:bg-amber-950/10' } hover:bg-border-ui dark:hover:bg-border-ui/20 transition-colors flex gap-2.5 items-start text-left relative group">
            <span class="flex h-2 w-2 rounded-full mt-1.5 shrink-0 ${ w.color === 'red' ? 'bg-rose-500 shadow-[0_0_8px_rgba(239,68,68,0.5)] animate-pulse' : w.color === 'blue' ? 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)] animate-pulse' : 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]' }"></span>
            <div class="flex-1 min-w-0">
              <div class="text-xs font-semibold text-[var(--text-primary)] mb-0.5 flex justify-between gap-2">
                <span class="truncate pr-4">${w.sujeto_pasivo || 'Sujeto Pasivo'}</span>
                <span class="text-[9px] text-[var(--text-tertiary)] font-mono tracking-tighter shrink-0">${formatDate(w.deadline)}</span>
              </div>
              <p class="text-[10px] text-[var(--text-secondary)] leading-normal">${w.text}</p>
              <div class="mt-1 flex items-center gap-2">
                <button onclick="goToAlertItem('${w.type}', '${w.folio}')" class="text-[9px] text-brand-500 dark:text-brand-400 hover:text-brand-600 dark:hover:text-brand-300 font-semibold flex items-center gap-0.5 transition-colors">
                  Ir al registro <i data-lucide="arrow-right" class="h-2.5 w-2.5"></i>
                </button>
              </div>
            </div>
            <button onclick="dismissAlerta(event, '${w.type}', '${w.id}')" class="absolute top-2 right-2 text-[var(--text-tertiary)] hover:text-rose-500 transition-colors duration-150 rounded p-0.5 opacity-0 group-hover:opacity-100 focus:opacity-100" title="Descartar alerta">
              <i data-lucide="x" class="h-3 w-3"></i>
            </button>
          </div>
        `).join('')}
      </div>

      <div class="border-t border-[var(--border-ui)] pt-2 text-center mt-1">
        <button onclick="switchView('alertas'); toggleAlertsDropdown(event);" class="text-[11px] text-brand-500 dark:text-brand-400 hover:text-brand-600 dark:hover:text-brand-300 font-semibold hover:underline flex items-center justify-center gap-1 w-full py-1 cursor-pointer">
          <i data-lucide="layout-list" class="h-3 w-3"></i> Ver todas (Centro de Alertas)
        </button>
      </div>
    </div>
  `;

  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
}



/**
 * Cargar alertas de plazos legales desde el backend
 * Cargar alertas de plazos legales desde el backend
 * @param {AbortSignal} signal - Parámetro signal.
 */
async function fetchAlertas(signal) {
  if (!currentUser) return;
  try {
    const res = await fetch('/api/alertas', { signal });
    if (res.ok) {
      dataStore.alertas = await res.json();
      renderAlertasWidget();
      if (currentView === 'alertas') {
        const main = document.getElementById('main-content');
        if (main && typeof renderAlertasCentro === 'function') {
          renderAlertasCentro(main);
        }
      }
    }
  } catch (err) {
    if (err.name !== 'AbortError') {
      console.error('Error al obtener alertas:', err);
    }
  }
}

/**
 * Obtiene el listado completo y procesado de alertas (sin filtrar por descartadas si full=true)
 * @param {boolean} full - Parámetro full.
 */
function getActiveAlertsList(full = false) {
  if (!dataStore.alertas) return [];

  const warnings = [];

  (dataStore.alertas.ingresadas || []).forEach(item => {
    if (!full && (item.estado_gestion === 'leida' || item.estado_gestion === 'borrada')) return;

    if (item.dias_restantes_sh === undefined) return;
    const diffDays = item.dias_restantes_sh;

    if (diffDays < 0) {
      if (diffDays >= -180) { // Omitir alertas históricas antiguas de más de 180 días
        warnings.push({
          id: item.id,
          type: 'solicitud',
          folio: item.folio_lobby || 'Sin Folio',
          sujeto_pasivo: item.sujeto_pasivo,
          deadline: item.fecha_limite_sh,
          diff: diffDays,
          color: 'red',
          text: `Folio ${item.folio_lobby || 'Sin Folio'} - Solicitud vencida hace ${Math.abs(diffDays)}d hábiles`,
          estado_gestion: item.estado_gestion
        });
      }
    } else if (diffDays <= 1) {
      warnings.push({
        id: item.id,
        type: 'solicitud',
        folio: item.folio_lobby || 'Sin Folio',
        sujeto_pasivo: item.sujeto_pasivo,
        deadline: item.fecha_limite_sh,
        diff: diffDays,
        color: 'yellow',
        text: `Folio ${item.folio_lobby || 'Sin Folio'} - Solicitud por vencer (${diffDays}d hábiles restantes)`,
        estado_gestion: item.estado_gestion
      });
    }
  });

  (dataStore.alertas.pendientesPub || []).forEach(item => {
    if (!full && (item.estado_gestion === 'leida' || item.estado_gestion === 'borrada')) return;

    if (item.dias_restantes_publicacion === undefined) return;
    const diffDays = item.dias_restantes_publicacion;

    if (diffDays < 0) {
      if (diffDays >= -180) { // Omitir alertas históricas antiguas de más de 180 días
        warnings.push({
          id: item.id,
          type: 'publicacion',
          folio: item.folio_lobby || 'Sin Folio',
          sujeto_pasivo: item.sujeto_pasivo,
          deadline: item.fecha_limite_publicacion,
          diff: diffDays,
          color: 'red',
          text: `Folio ${item.folio_lobby || 'Sin Folio'} - Publicación atrasada hace ${Math.abs(diffDays)}d`,
          estado_gestion: item.estado_gestion
        });
      }
    } else if (diffDays <= 5) {
      warnings.push({
        id: item.id,
        type: 'publicacion',
        folio: item.folio_lobby || 'Sin Folio',
        sujeto_pasivo: item.sujeto_pasivo,
        deadline: item.fecha_limite_publicacion,
        diff: diffDays,
        color: 'yellow',
        text: `Folio ${item.folio_lobby || 'Sin Folio'} - Pendiente publicar (${diffDays}d restantes)`,
        estado_gestion: item.estado_gestion
      });
    }
  });

  (dataStore.alertas.agendadasHoy || []).forEach(item => {
    if (!full && (item.estado_gestion === 'leida' || item.estado_gestion === 'borrada')) return;

    const timeStr = item.fecha_agendada && item.fecha_agendada.split(' ')[1]
      ? item.fecha_agendada.split(' ')[1].slice(0, 5)
      : 'Hora no especificada';

    warnings.push({
      id: item.id,
      type: 'agenda',
      folio: item.folio_lobby || 'Sin Folio',
      sujeto_pasivo: item.sujeto_pasivo,
      deadline: item.fecha_agendada,
      diff: 0,
      color: 'blue',
      text: `Hoy - Reunión agendada con ${item.sujeto_pasivo} (${item.sujeto_activo || 'Lobbista'}) a las ${timeStr}`,
      estado_gestion: item.estado_gestion
    });
  });

  warnings.sort((a, b) => {
    if (a.color === 'red' && b.color !== 'red') return -1;
    if (a.color !== 'red' && b.color === 'red') return 1;
    if (a.color === 'yellow' && b.color === 'blue') return -1;
    if (a.color === 'blue' && b.color === 'yellow') return 1;
    return a.diff - b.diff;
  });

  return warnings;
}

/**
 * Descartar una alerta y recargar el widget
 * @param {Event} event - Parámetro event.
 * @param {string} type - Parámetro type.
 * @param {string|number} id - Parámetro id.
 */
async function dismissAlerta(event, type, id) {
  if (event) event.stopPropagation();
  try {
    const res = await fetch('/api/alertas/gestionar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        alertas: [{ tipo: type, solicitud_id: id, estado: 'leida' }]
      })
    });
    if (res.ok) {
      showToast('Alerta descartada.');
      await fetchAlertas();
    } else {
      showToast('Error al descartar la alerta.', 'error');
    }
  } catch (e) {
    console.error('Error descartando alerta:', e);
  }
}

/**
 * Descartar todas las alertas visibles
 * @param {Event} event - Parámetro event.
 */
async function dismissAllAlertas(event) {
  if (event) event.stopPropagation();
  try {
    const warningList = getActiveAlertsList(false);
    if (warningList.length === 0) {
      showToast('No hay alertas activas para descartar.');
      return;
    }

    const alertasToManage = warningList.map(w => ({
      tipo: w.type,
      solicitud_id: w.id,
      estado: 'leida'
    }));

    const res = await fetch('/api/alertas/gestionar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alertas: alertasToManage })
    });

    if (res.ok) {
      showToast('Todas las alertas actuales han sido descartadas.');
      await fetchAlertas();
    } else {
      showToast('Error al descartar las alertas.', 'error');
    }
  } catch (e) {
    console.error('Error descartando todas las alertas:', e);
  }
}



function toggleAlertsDropdown(event) {
  if (event) event.stopPropagation();
  const dropdown = document.getElementById('alerts-dropdown');
  if (!dropdown) return;
  const isHidden = dropdown.classList.contains('hidden');
  
  const profileDropdown = document.getElementById('profile-dropdown');
  if (profileDropdown) profileDropdown.classList.add('hidden');

  if (isHidden) {
    dropdown.classList.remove('hidden');
  } else {
    dropdown.classList.add('hidden');
  }
}



function goToAlertItem(type, folio) {
  const dropdown = document.getElementById('alerts-dropdown');
  if (dropdown) dropdown.classList.add('hidden');

  if (type === 'solicitud') {
    switchView('solicitudes');
    paginationState.solicitudes.filters.folio = folio;
    paginationState.solicitudes.page = 1;
    updateListView('solicitudes');
    
    setTimeout(() => {
      const input = document.getElementById('filter-solicitudes-folio');
      if (input) input.value = folio;
    }, 100);
  } else if (type === 'publicacion') {
    switchView('publicadas');
    paginationState.publicadas.subTab = 'pendientes';
    paginationState.publicadas.filters.folio = folio;
    paginationState.publicadas.page = 1;
    updateListView('publicadas');
    
    setTimeout(() => {
      const input = document.getElementById('filter-publicadas-folio');
      if (input) input.value = folio;
    }, 100);
  } else if (type === 'agenda') {
    const meeting = (dataStore.alertas.agendadasHoy || []).find(m => m.folio_lobby === folio);
    if (meeting && meeting.fecha_agendada) {
      // Usar split y guiones para evitar desfases locales en parseo de fecha
      const dateParts = meeting.fecha_agendada.split(' ')[0].split('-');
      if (dateParts.length === 3) {
        const calDate = new Date(parseInt(dateParts[0], 10), parseInt(dateParts[1], 10) - 1, parseInt(dateParts[2], 10));
        window.currentCalendarDate = calDate;
        if (typeof currentCalendarDate !== 'undefined') currentCalendarDate = calDate;
      }
    }
    const calFilters = window.calendarFilters || (typeof calendarFilters !== 'undefined' ? calendarFilters : {});
    calFilters.search = folio;
    window.calendarFilters = calFilters;
    if (typeof switchView === 'function') switchView('agenda');
    else if (typeof window.switchView === 'function') window.switchView('agenda');
  }
}



// Exposición global adicional
window.renderAlertasWidget = renderAlertasWidget;
window.fetchAlertas = fetchAlertas;
window.getActiveAlertsList = getActiveAlertsList;
window.dismissAlerta = dismissAlerta;
window.dismissAllAlertas = dismissAllAlertas;
window.toggleAlertsDropdown = toggleAlertsDropdown;
window.goToAlertItem = goToAlertItem;

export const AlertasView = {
  async mount(container, params = {}) {
    return renderAlertasCentro(container);
  },
  unmount() {}
};

export {
  fetchAlertas
};

if (typeof window !== 'undefined') {
  window.renderAlertasCentro = renderAlertasCentro;
  window.switchAlertasTab = switchAlertasTab;
  window.switchAlertasType = switchAlertasType;
  window.onAlertasSearch = onAlertasSearch;
  window.changeAlertaEstado = changeAlertaEstado;
  window.deleteAlerta = deleteAlerta;
  window.bulkChangeAlertaEstado = bulkChangeAlertaEstado;
  window.AlertasView = AlertasView;
}
