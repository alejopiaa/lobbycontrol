/**
 * SolicitudesView - Vista modular de solicitudes activas de lobby
 * LobbyControl - Arquitectura Modular ESM
 */

import { renderTableListViewLayout } from '../../components/table-list.layout.js';
import { renderFilterBar } from '../../components/filter-bar.component.js';
import {
  renderGlassCard,
  renderSearchInput,
  renderSelectInput,
  renderVigenciaSelect,
  renderDualDatePicker,
  renderPaginationControls,
  renderStatusBadge
} from '../../components/ui.js';
import {
  escapeHtml,
  escapeHtmlAttr,
  formatDateForDisplay
} from '../../utils/formatters.js';

/**
 * Renderiza la vista de Solicitudes SH
 * @param {HTMLElement} container - Contenedor principal donde se monta la vista
 */
export function renderSolicitudes(container) {
  if (!container) return;

  const store = (typeof dataStore !== 'undefined' ? dataStore : (typeof window !== 'undefined' ? window.dataStore : null)) || {};
  const pageState = (typeof paginationState !== 'undefined' ? paginationState : (typeof window !== 'undefined' ? window.paginationState : null)) || { solicitudes: { page: 1, filters: {} } };
  const sujetoCache = (typeof window !== 'undefined' && window.activeSujetoIdsCache) || (typeof activeSujetoIdsCache !== 'undefined' ? activeSujetoIdsCache : null);

  const formatDateFn = typeof formatDate === 'function' ? formatDate : formatDateForDisplay;
  const normalizeNameFn = typeof normalizeName === 'function' ? normalizeName : (s => s || '');
  const getCargoCleanFn = typeof getCargoClean === 'function' ? getCargoClean : (s => s || '');
  const getDeadlineStatusBadgeFn = typeof getDeadlineStatusBadge === 'function' ? getDeadlineStatusBadge : (() => ({ text: '', class: '' }));

  const filters = pageState.solicitudes?.filters || {};
  let paginatedItems = [];
  let totalItems = 0;
  const currentPage = pageState.solicitudes?.page || 1;
  const pageSize = 10;

  const isServerPaged = store.solicitudes && !Array.isArray(store.solicitudes);
  if (isServerPaged) {
    paginatedItems = store.solicitudes.data || [];
    totalItems = store.solicitudes.totalItems || 0;
  } else {
    let filtered = store.solicitudes || [];
    if (filters.vigencia === 'vigentes' || filters.soloVigentes === true) {
      filtered = filtered.filter((item) => {
        if (item.sujeto_pasivo_id && sujetoCache && (sujetoCache.has(Number(item.sujeto_pasivo_id)) || sujetoCache.has(String(item.sujeto_pasivo_id)))) {
          return true;
        }
        return false;
      });
    } else if (filters.vigencia === 'no_vigentes') {
      filtered = filtered.filter((item) => {
        if (!item.sujeto_pasivo_id || !sujetoCache || (!sujetoCache.has(Number(item.sujeto_pasivo_id)) && !sujetoCache.has(String(item.sujeto_pasivo_id)))) {
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
          item.cargo && getCargoCleanFn(item.cargo).toLowerCase().includes(val),
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
    if (filters.estadoPlazo === 'FDP') {
      filtered = filtered.filter((item) => {
        const diffDays = item.dias_restantes_sh !== undefined ? item.dias_restantes_sh : 0;
        return item.estado_cumplimiento_sh === 'PENDIENTE_VENCIDA' || diffDays < 0;
      });
    } else if (filters.estadoPlazo === 'DDP') {
      filtered = filtered.filter((item) => {
        const diffDays = item.dias_restantes_sh !== undefined ? item.dias_restantes_sh : 0;
        return item.estado_cumplimiento_sh === 'PENDIENTE_EN_PLAZO' || diffDays >= 0;
      });
    }
    if (filters.fechaInicio) {
      filtered = filtered.filter((item) => {
        const itemDate = (item.fecha_ingreso || "").split(" ")[0];
        return itemDate >= filters.fechaInicio;
      });
    }
    if (filters.fechaTermino) {
      filtered = filtered.filter((item) => {
        const itemDate = (item.fecha_ingreso || "").split(" ")[0];
        return itemDate <= filters.fechaTermino;
      });
    }
    totalItems = filtered.length;
    paginatedItems = filtered.slice(
      (currentPage - 1) * pageSize,
      currentPage * pageSize,
    );
  }

  let rowsHtml = "";
  if (paginatedItems.length === 0) {
    rowsHtml = `<tr><td colspan="8" class="px-6 py-8 text-center text-xs text-text-secondary">No hay registros de solicitudes.</td></tr>`;
  } else {
    paginatedItems.forEach((item) => {
      rowsHtml += `
        <tr class="hover:bg-border-ui border-b border-border-ui transition-colors h-[72px]">
          <td class="pl-6 pr-2 text-xs font-semibold text-text-primary text-left">
            ${item.folio_lobby && item.folio_lobby !== 'Sin Folio' ? `
              <button type="button" onclick="copiarFolio('${escapeHtmlAttr(item.folio_lobby)}', event)" 
                      class="group font-mono text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 font-bold inline-flex items-center gap-1.5 cursor-pointer transition-colors active:scale-95 text-left" 
                      title="Clic para copiar folio ${escapeHtmlAttr(item.folio_lobby)}">
                <span>${escapeHtml(item.folio_lobby)}</span>
                <i data-lucide="copy" class="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none text-brand-500"></i>
              </button>
            ` : `<span class="text-text-tertiary italic">Sin Folio</span>`}
          </td>
          <td class="px-2 text-xs text-left">
            <div class="font-semibold text-text-secondary" title="Fecha Ingreso">${formatDateFn(item.fecha_ingreso)}</div>
            <div class="text-[10px] text-text-tertiary mt-0.5" title="Plazo Legal Límite">
              ${item.fecha_limite_sh ? formatDateFn(item.fecha_limite_sh) : (item.fecha_ingreso ? formatDateFn(item.fecha_ingreso) : "---")}
            </div>
          </td>
          <td class="px-2 text-xs text-left">
            <div class="font-semibold text-text-secondary" title="Fecha Respuesta">${item.fecha_respuesta ? formatDateFn(item.fecha_respuesta) : "---"}</div>
            <div class="text-[10px] mt-0.5 truncate" title="Fecha y Hora Agendada">
              ${item.fecha_agendada && item.fecha_agendada !== '-' && item.fecha_agendada !== '---' ? `
                <span class="text-brand-600 dark:text-brand-400 font-medium">${formatDateFn(item.fecha_agendada)}${item.fecha_agendada.includes(' ') ? ' ' + item.fecha_agendada.split(' ')[1].slice(0, 5) + ' hrs' : ''}</span>
              ` : (item.fecha_respuesta ? `<span class="text-text-tertiary">${item.estado === 'Rechazada' ? 'Rechazada' : 'Sin cita'}</span>` : `<span class="text-text-tertiary">Pendiente</span>`)}
            </div>
          </td>
          <td class="px-2 text-xs text-text-secondary text-left">
            <div class="font-medium text-text-secondary w-full truncate" title="${escapeHtmlAttr(normalizeNameFn(item.sujeto_pasivo) || "Sin Nombre")}">${escapeHtml(normalizeNameFn(item.sujeto_pasivo) || "Sin Nombre")}</div>
            <div class="text-[10px] text-text-secondary mt-0.5 w-full truncate" title="${escapeHtmlAttr(item.cargo_limpio || getCargoCleanFn(item.cargo))}">${escapeHtml(item.cargo_limpio || getCargoCleanFn(item.cargo))}</div>
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
              ${renderStatusBadge(getDeadlineStatusBadgeFn(item.fecha_ingreso, item.fecha_respuesta, item.estado, item))}
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
  if (existingTable && typeof window !== 'undefined' && window.activeInputId) {
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
    if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
    return;
  }

  const columns = [
    {
      header: 'FOLIO',
      key: 'folio_lobby',
      width: 'w-36 text-left',
      render: (item) => {
        if (item.folio_lobby && item.folio_lobby !== 'Sin Folio') {
          return `
            <button type="button" onclick="copiarFolio('${escapeHtmlAttr(item.folio_lobby)}', event)" 
                    class="group font-mono text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 font-bold inline-flex items-center gap-1.5 cursor-pointer transition-colors active:scale-95 text-left" 
                    title="Clic para copiar folio ${escapeHtmlAttr(item.folio_lobby)}">
              <span>${escapeHtml(item.folio_lobby)}</span>
              <i data-lucide="copy" class="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none text-brand-500"></i>
            </button>
          `;
        }
        return `<span class="text-text-tertiary italic">Sin Folio</span>`;
      }
    },
    {
      header: 'INGRESO',
      key: 'fecha_ingreso',
      width: 'w-28 text-left',
      render: (item) => `
        <div class="font-semibold text-text-secondary" title="Fecha Ingreso">${formatDateFn(item.fecha_ingreso)}</div>
        <div class="text-[10px] text-text-tertiary mt-0.5" title="Plazo Legal Límite">
          ${item.fecha_limite_sh ? formatDateFn(item.fecha_limite_sh) : (item.fecha_ingreso ? formatDateFn(item.fecha_ingreso) : "---")}
        </div>
      `
    },
    {
      header: 'RESPUESTA',
      key: 'fecha_respuesta',
      width: 'w-28 text-left',
      render: (item) => `
        <div class="font-semibold text-text-secondary" title="Fecha Respuesta">${item.fecha_respuesta ? formatDateFn(item.fecha_respuesta) : "---"}</div>
        <div class="text-[10px] mt-0.5 truncate" title="Fecha y Hora Agendada">
          ${item.fecha_agendada && item.fecha_agendada !== '-' && item.fecha_agendada !== '---' ? `
            <span class="text-brand-600 dark:text-brand-400 font-medium">${formatDateFn(item.fecha_agendada)}${item.fecha_agendada.includes(' ') ? ' ' + item.fecha_agendada.split(' ')[1].slice(0, 5) + ' hrs' : ''}</span>
          ` : (item.fecha_respuesta ? `<span class="text-text-tertiary">${item.estado === 'Rechazada' ? 'Rechazada' : 'Sin cita'}</span>` : `<span class="text-text-tertiary">Pendiente</span>`)}
        </div>
      `
    },
    {
      header: 'SUJETO PASIVO',
      key: 'sujeto_pasivo',
      width: 'w-48 text-left',
      render: (item) => `
        <div class="font-medium text-text-secondary w-full truncate" title="${escapeHtmlAttr(normalizeNameFn(item.sujeto_pasivo) || "Sin Nombre")}">${escapeHtml(normalizeNameFn(item.sujeto_pasivo) || "Sin Nombre")}</div>
        <div class="text-[10px] text-text-secondary mt-0.5 w-full truncate" title="${escapeHtmlAttr(item.cargo_limpio || getCargoCleanFn(item.cargo))}">${escapeHtml(item.cargo_limpio || getCargoCleanFn(item.cargo))}</div>
      `
    },
    {
      header: 'SUJETO ACTIVO',
      key: 'sujeto_activo',
      width: 'w-48 text-left',
      render: (item) => `
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
      `
    },
    {
      header: 'MATERIA',
      key: 'materia',
      width: 'w-auto text-left',
      render: (item) => `
        <div class="text-[10.5px] text-text-secondary font-sans leading-normal overflow-hidden" 
             style="display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; max-height: 2.8em;"
             title="${escapeHtmlAttr(item.especificacion_materia || item.materia || "")}">
          ${escapeHtml(item.especificacion_materia || item.materia || "Sin Especificar")}
        </div>
      `
    },
    {
      header: 'ESTADO',
      key: 'estado',
      width: 'w-28 text-left',
      render: (item) => `
        <div class="w-24">
          ${renderStatusBadge(getDeadlineStatusBadgeFn(item.fecha_ingreso, item.fecha_respuesta, item.estado, item))}
        </div>
      `
    },
    {
      header: 'ACCIÓN',
      key: 'accion',
      width: 'w-28 text-left whitespace-nowrap',
      render: (item) => `
        <button onclick="showSolicitudDetailsModal(${item.id})" class="px-3 py-1.5 rounded-lg text-xs font-semibold bg-brand-600 hover:bg-brand-500 text-white transition-all inline-block hover:shadow-md hover:shadow-brand-500/20 whitespace-nowrap cursor-pointer">Ver Detalle</button>
      `
    }
  ];

  const activeCount = [
    filters.vigencia && filters.vigencia !== 'todos',
    filters.folio,
    filters.nombre,
    filters.cargo,
    filters.sujetoActivoRepresentado,
    filters.estado,
    filters.fechaInicio || filters.fechaTermino
  ].filter(Boolean).length;

  const filtersHtml = renderFilterBar({
    moduleName: 'solicitudes',
    activeCount,
    chipsHtml: `
      <!-- 1. VIGENCIA -->
      ${renderVigenciaSelect({
        id: "filter-solicitudes-vigencia",
        value: filters.vigencia,
        onChange: "changeSolicitudesVigencia",
      })}

      <!-- 2. FOLIO -->
      <div class="w-[150px] shrink-0">
        ${renderSearchInput({
          id: "filter-solicitudes-folio",
          fieldName: "folio",
          placeholder: "Buscar folio...",
          value: filters.folio,
          icon: "hash",
        })}
      </div>

      <!-- 3. SUJETO PASIVO -->
      <div class="w-[200px] shrink-0">
        ${renderSearchInput({
          id: "solicitudes-filter-nombre",
          fieldName: "nombre",
          placeholder: "Sujeto Pasivo...",
          value: filters.nombre,
          icon: "user",
          hasSuggestions: true,
        })}
      </div>

      <!-- 4. CARGO -->
      <div class="w-[180px] shrink-0">
        ${renderSearchInput({
          id: "solicitudes-filter-cargo",
          fieldName: "cargo",
          placeholder: "Cargo...",
          value: filters.cargo,
          icon: "user",
          disabled: !filters.nombre,
          hasSuggestions: true,
        })}
      </div>

      <!-- 5. SUJETO ACTIVO -->
      <div class="w-[200px] shrink-0">
        ${renderSearchInput({
          id: "solicitudes-filter-sujetoActivoRepresentado",
          fieldName: "sujetoActivoRepresentado",
          placeholder: "Lobbista o RUT...",
          value: filters.sujetoActivoRepresentado,
          icon: "users",
          hasSuggestions: true,
        })}
      </div>

      <!-- 6. ESTADO -->
      <div class="w-[170px] shrink-0">
        ${renderSelectInput({
          id: "filter-solicitudes-estado",
          fieldName: "estado",
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

      <!-- 7. FECHAS -->
      ${renderDualDatePicker({
        idPrefix: "filter-solicitudes-",
        fechaInicio: filters.fechaInicio,
        fechaTermino: filters.fechaTermino
      })}
    `
  });

  const bannerRelacionHtml = (filters.relacionSujetoActivo || filters.relacionRut || filters.relacionRepresentado)
    ? `
      <div class="mb-4 p-4 rounded-2xl bg-brand-50 dark:bg-brand-500/10 border border-brand-200/80 dark:border-brand-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-brand-900 dark:text-brand-200 relative overflow-hidden glass-card">
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
    : "";

  const subTabsHtml = `
    <button onclick="changeAudienciasSubTab('solicitudes')" class="px-4 py-2 text-xs font-semibold rounded-xl transition-all bg-brand-600 text-white shadow-md shadow-brand-500/20 cursor-pointer border-0">
      Solicitudes
    </button>
    <button onclick="changeAudienciasSubTab('pendientes')" class="px-4 py-2 text-xs font-semibold rounded-xl transition-all text-text-secondary hover:text-text-primary hover:bg-border-ui/50 cursor-pointer border-0 bg-transparent">
      Pendientes de Publicación
    </button>
    <button onclick="changeAudienciasSubTab('historial')" class="px-4 py-2 text-xs font-semibold rounded-xl transition-all text-text-secondary hover:text-text-primary hover:bg-border-ui/50 cursor-pointer border-0 bg-transparent">
      Audiencias Publicadas
    </button>
  `;

  container.innerHTML = renderTableListViewLayout({
    id: 'solicitudes-table-view',
    title: 'Audiencias y Solicitudes',
    titleIcon: 'calendar-check',
    subtitle: 'Gestión y seguimiento de audiencias según Ley N° 20.730',
    subTabsHtml,
    bannerHtml: bannerRelacionHtml,
    filtersHtml,
    counterText: `${totalItems} registros encontrados`,
    counterId: 'solicitudes-counter',
    tableId: 'table-solicitudes',
    columns,
    items: paginatedItems,
    emptyIcon: 'inbox',
    emptyMessage: 'No hay registros de solicitudes coincidentes con los filtros.',
    emptyActionHtml: '<button onclick="clearFilters(\'solicitudes\')" class="text-xs text-brand-500 hover:underline font-semibold mt-1 bg-transparent border-0 cursor-pointer">Limpiar filtros de búsqueda</button>',
    paginationSummary: `Mostrando <span class="font-semibold text-text-secondary">${paginatedItems.length}</span> de <span class="font-semibold text-text-secondary">${totalItems}</span> registros`,
    paginationHtml: renderPaginationControls("solicitudes", totalItems, currentPage, pageSize),
    paginationId: 'solicitudes-pagination-container'
  });

  if (typeof lucide !== 'undefined' && lucide.createIcons) {
    lucide.createIcons();
  }
  if (typeof window.initAirDatepickerFields === 'function') {
    window.initAirDatepickerFields();
  }
}

export const SolicitudesView = {
  async mount(container, params = {}) {
    return renderSolicitudes(container);
  },
  unmount() {}
};

if (typeof window !== 'undefined') {
  window.renderSolicitudesModule = renderSolicitudes;
  window.renderSolicitudes = renderSolicitudes;
  window.SolicitudesView = SolicitudesView;
}


/**
 * MODAL: DETALLE DE SOLICITUD (SOLICITUDES Y PENDIENTES DE PUBLICACIÓN)
 * @param {string|number} idOrItem - Parámetro idOrItem.
 * @param {boolean} isPending - Parámetro isPending.
 */
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
                  <span class="text-xs font-semibold text-text-secondary">Folio: 
                    ${item.folio_lobby && item.folio_lobby !== 'Sin Folio' ? `
                      <button type="button" onclick="copiarFolio('${escapeHtmlAttr(item.folio_lobby)}', event)" 
                              class="font-mono text-brand-400 hover:text-brand-300 font-bold inline-flex items-center gap-1 cursor-pointer hover:underline active:scale-95" 
                              title="Clic para copiar folio">
                        <span>${escapeHtml(item.folio_lobby)}</span>
                        <i data-lucide="copy" class="h-3 w-3"></i>
                      </button>
                    ` : `<span class="font-mono text-brand-400 font-bold">Sin Folio</span>`}
                  </span>
                  <span class="px-2 py-0.5 rounded text-[10px] font-bold ${badgeData?.class || 'badge-status-otros'}">${escapeHtml(estado)}</span>
                </div>
              </div>
            </div>
            <button onclick="closeModal()" title="Cerrar modal" aria-label="Cerrar modal" class="h-7 w-7 rounded-lg flex items-center justify-center border border-border-ui hover:bg-border-ui dark:hover:bg-border-ui/50 text-text-tertiary hover:text-text-primary transition-colors cursor-pointer">
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
                  <span class="text-xs font-semibold text-text-secondary">Folio: 
                    ${item.folio_lobby && item.folio_lobby !== 'Sin Folio' ? `
                      <button type="button" onclick="copiarFolio('${escapeHtmlAttr(item.folio_lobby)}', event)" 
                              class="font-mono text-brand-400 hover:text-brand-300 font-bold inline-flex items-center gap-1 cursor-pointer hover:underline active:scale-95" 
                              title="Clic para copiar folio">
                        <span>${escapeHtml(item.folio_lobby)}</span>
                        <i data-lucide="copy" class="h-3 w-3"></i>
                      </button>
                    ` : `<span class="font-mono text-brand-400 font-bold">Sin Folio</span>`}
                  </span>
                  <span class="px-2 py-0.5 rounded text-[10px] font-bold ${badgeData?.class || 'badge-status-otros'}">${escapeHtml(estado)}</span>
                </div>
              </div>
            </div>
            <button onclick="closeModal()" title="Cerrar modal" aria-label="Cerrar modal" class="h-7 w-7 rounded-lg flex items-center justify-center border border-border-ui hover:bg-border-ui dark:hover:bg-border-ui/50 text-text-tertiary hover:text-text-primary transition-colors cursor-pointer">
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
export { showSolicitudDetailsModal };

