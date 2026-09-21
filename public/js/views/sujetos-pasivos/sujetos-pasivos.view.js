/**
 * SujetosPasivosView - Vista modular de Sujetos Pasivos (SPH)
 * LobbyControl - Arquitectura Modular ESM
 */

import {
  renderGlassCard,
  renderSearchInput,
  renderDateInput,
  renderSelectInput,
  renderVigenciaSelect,
  renderPaginationControls
} from '../../components/ui.js';
import {
  formatDateForDisplay,
  escapeHtml,
  escapeHtmlAttr
} from '../../utils/formatters.js';

export function isFechaTerminoIndefinida(ft) {
  if (!ft) return true;
  const s = String(ft).trim().toLowerCase();
  return s === '' || s === '-' || s === 'null' || s.includes('indefin');
}

export function isSujetoPasivoVigente(item) {
  if (!item) return false;
  const id = item.id_sujeto_lobby;
  if (id != null && window.activeSujetoIdsCache instanceof Set && window.activeSujetoIdsCache.size > 0) {
    return window.activeSujetoIdsCache.has(Number(id)) || window.activeSujetoIdsCache.has(String(id));
  }
  // Fallback de contingencia si la caché de vigentes aún no ha cargado
  if (isFechaTerminoIndefinida(item.fecha_termino)) return true;
  if (item.fecha_termino) {
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const ft = String(item.fecha_termino).trim().split(' ')[0];
    return ft >= todayStr;
  }
  return false;
}

export function renderSujetosPasivos(container, options = {}) {
  if (!container) return;
  const isEmbedded = !!(options && options.isEmbedded) || container.id === 'admin-tab-content-container';

  const pagState = window.paginationState?.sujetos_pasivos || {
    search: '',
    vigencia: 'todos',
    tipoFecha: 'incorporacion',
    fechaDesde: '',
    fechaHasta: '',
    page: 1
  };

  const search = (pagState.search || "").toLowerCase();
  const vigencia = pagState.vigencia || 'todos';
  const tipoFecha = pagState.tipoFecha || 'incorporacion';
  const fechaDesde = pagState.fechaDesde || '';
  const fechaHasta = pagState.fechaHasta || '';

  const dStore = window.dataStore || {};
  let filtered = dStore.sujetos_pasivos || [];
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
  const currentPage = pagState.page || 1;
  const pageSize = 10;
  const paginatedItems = filtered.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  const getCargoCleanFn = typeof window.getCargoClean === 'function'
    ? window.getCargoClean
    : (cargo) => cargo || '';

  const formatDateFn = typeof window.formatDate === 'function'
    ? window.formatDate
    : formatDateForDisplay;

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
            <div class="line-clamp-2 leading-relaxed" title="${escapeHtmlAttr(getCargoCleanFn(item.cargo))}">${escapeHtml(getCargoCleanFn(item.cargo))}</div>
          </td>
          <td class="px-2 text-xs text-text-secondary font-mono">
            <div>${formatDateFn(item.fecha_incorporacion)}</div>
          </td>
          <td class="px-2 text-xs text-text-secondary font-mono">
            <div>${isIndef ? '<span class="text-text-tertiary font-bold select-none">-</span>' : formatDateFn(item.fecha_termino)}</div>
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
    if (window.lucide) window.lucide.createIcons();
    return true;
  }

  container.innerHTML = `
    <div class="space-y-4 font-sans" id="sujetos-pasivos-view-container">
      ${!isEmbedded ? `
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div class="space-y-1">
          <h2 class="text-2xl font-bold text-heading tracking-tight">Sujetos Pasivos</h2>
        </div>
      </div>
      ` : ''}

      <!-- CONTENEDOR FILTROS ESTÁNDAR -->
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
              value: pagState.vigencia,
              onChange: "changeSujetosPasivosVigencia",
            })}
          </div>
          ${(pagState.search || pagState.fechaDesde || pagState.fechaHasta || pagState.vigencia !== 'todos') ? `
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
            value: pagState.search,
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
    </div>
  `;

  if (window.lucide) window.lucide.createIcons();
}

export function showSujetoDetailsModal(sujetoId) {
  try {
    const list = window.dataStore?.sujetos_pasivos || [];
    const item = list.find((s) => s.id == sujetoId);
    if (!item) {
      if (typeof window.showToast === 'function') {
        window.showToast("No se encontró el registro del Sujeto Pasivo.", "error");
      }
      return;
    }

    const modal = document.getElementById("modal-container");
    if (!modal) return;

    modal.classList.remove("hidden");
    modal.classList.add("backdrop-animate-in");

    const users = window.dataStore?.usuarios || [];
    const asesores = users.filter((u) => u.rol === "Asistente técnico" && u.asistido_rut === item.rut);
    
    let asesoresHtml = "";
    if (asesores.length === 0) {
      asesoresHtml = `
        <p class="text-xs text-text-tertiary italic mt-1.5 p-3 rounded-xl border border-border-ui bg-bg-main">
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
                  <p class="text-text-tertiary text-[9.5px] mt-0.5">${escapeHtml(a.correo)}</p>
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

    const getCargoCleanFn = typeof window.getCargoClean === 'function'
      ? window.getCargoClean
      : (cargo) => cargo || '';

    const formatDateFn = typeof window.formatDate === 'function'
      ? window.formatDate
      : formatDateForDisplay;

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
              <span class="text-xs font-semibold text-text-secondary">ID Portal Lobby: <span class="font-mono text-brand-400 font-bold">${item.id_sujeto_lobby || "Sin ID"}</span></span>
            </div>
          </div>
          <button onclick="closeModal()" title="Cerrar modal" aria-label="Cerrar modal" class="h-7 w-7 rounded-lg flex items-center justify-center border border-border-ui hover:bg-border-ui dark:hover:bg-border-ui/50 text-text-tertiary hover:text-text-primary transition-colors cursor-pointer bg-transparent">
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
            <p class="text-xs text-text-secondary font-semibold mt-1 bg-bg-main border border-border-ui p-2.5 rounded-xl leading-relaxed select-text">${escapeHtml(getCargoCleanFn(item.cargo))}</p>
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
              <p class="text-text-secondary font-semibold font-mono mt-0.5">${formatDateFn(item.fecha_incorporacion)}</p>
            </div>
            <div>
              <span class="text-[10px] text-text-tertiary block uppercase tracking-wider font-bold">Fecha de Término</span>
              <p class="text-text-secondary font-semibold font-mono mt-0.5">${isIndef ? "Indefinido" : formatDateFn(item.fecha_termino)}</p>
            </div>
          </div>

          <hr class="border-border-ui">
          
          <div>
            <span class="text-[10px] text-text-tertiary block uppercase tracking-wider font-bold">Respaldo Jurídico (Decreto)</span>
            <p class="text-xs text-text-secondary mt-1 bg-bg-main border border-border-ui p-2.5 rounded-xl leading-relaxed select-text">${escapeHtml(item.respaldo_juridico || "No registra respaldo jurídico")}</p>
          </div>

          <hr class="border-border-ui">

          <div>
            <span class="text-[10px] text-text-tertiary block uppercase tracking-wider font-bold">Asistente Técnico Registrado (Excel SPH)</span>
            <p class="text-xs text-text-secondary mt-1 bg-bg-main border border-border-ui p-2.5 rounded-xl leading-relaxed select-text">${escapeHtml(item.asistente_tecnico || "No registra asistente técnico en SPH")}</p>
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

    if (window.lucide) window.lucide.createIcons();
  } catch (err) {
    console.error("Error al abrir modal del sujeto pasivo:", err);
  }
}

export const SujetosPasivosView = {
  async mount(container, params = {}) {
    return renderSujetosPasivos(container);
  },
  unmount() {}
};

if (typeof window !== 'undefined') {
  window.renderSujetosPasivos = renderSujetosPasivos;
  window.showSujetoDetailsModal = showSujetoDetailsModal;
  window.isSujetoPasivoVigente = isSujetoPasivoVigente;
  window.isFechaTerminoIndefinida = isFechaTerminoIndefinida;
  window.SujetosPasivosView = SujetosPasivosView;
}
