/**
 * ViajesView - Vista modular de registro de viajes (Hoja VH)
 * LobbyControl - Arquitectura Modular ESM
 */

import {
  renderGlassCard,
  renderSearchInput,
  renderVigenciaSelect,
  renderPaginationControls,
  renderTableListViewLayout,
  renderFilterBar,
  renderDualDatePicker
} from '../../components/ui.js';
import {
  formatDateForDisplay,
  escapeHtml,
  escapeHtmlAttr
} from '../../utils/formatters.js';

export function formatMoney(amount) {
  if (amount === undefined || amount === null || isNaN(amount)) return "$0";
  return "$" + Number(amount).toLocaleString("es-CL");
}

export function renderViajeItemsChips(itemsStr) {
  if (!itemsStr || !itemsStr.trim()) {
    return '<span class="text-text-tertiary text-[11px] italic">Sin desglose</span>';
  }

  const parts = itemsStr.split("|").map(s => s.trim()).filter(Boolean);
  if (parts.length === 0) {
    return '<span class="text-text-tertiary text-[11px] italic">Sin desglose</span>';
  }

  return `
    <div class="flex flex-wrap gap-1">
      ${parts.map(part => {
        let chipColor = "bg-brand-500/10 text-brand-600 dark:text-brand-400 border-brand-500/20";
        const lower = part.toLowerCase();
        if (lower.includes("pasaje")) {
          chipColor = "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20";
        } else if (lower.includes("viático") || lower.includes("viatico")) {
          chipColor = "bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20";
        } else if (lower.includes("estadía") || lower.includes("estadia") || lower.includes("alojamiento")) {
          chipColor = "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20";
        } else if (lower.includes("inscrip") || lower.includes("curso")) {
          chipColor = "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20";
        } else if (lower.includes("sin costo")) {
          chipColor = "bg-slate-500/10 text-slate-500 dark:text-slate-400 border-slate-500/20";
        }

        return `<span class="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium border ${chipColor}">${escapeHtml(part)}</span>`;
      }).join("")}
    </div>
  `;
}

/**
 * Renderiza la vista principal de Viajes
 * @param {HTMLElement} container - Contenedor principal donde se monta la vista
 */
export function renderViajes(container) {
  if (!container) return;

  const store = (typeof dataStore !== 'undefined' ? dataStore : (typeof window !== 'undefined' ? window.dataStore : null)) || {};
  const pageState = (typeof paginationState !== 'undefined' ? paginationState : (typeof window !== 'undefined' ? window.paginationState : null)) || { viajes: { page: 1, filters: {} } };

  const formatDateFn = typeof formatDate === 'function' ? formatDate : formatDateForDisplay;
  const filters = pageState.viajes?.filters || {};
  const currentPage = pageState.viajes?.page || 1;
  const pageSize = 10;

  const isServerPaged = store.viajes && !Array.isArray(store.viajes);
  const items = isServerPaged ? (store.viajes.data || []) : (store.viajes || []);
  const totalItems = isServerPaged ? (store.viajes.totalItems || 0) : items.length;

  const stats = store.viajesStats || {
    totalViajes: totalItems,
    totalInversion: 0,
    financiadoMaipu: 0,
    financiadoExterno: 0,
    totalSujetos: 0,
    topDestinos: []
  };

  // 1. ZONA 1: Filtros (Estructura Unificada Dashboard)
  const activeCount = [
    filters.vigencia && filters.vigencia !== 'todos',
    !!(filters.nombre || filters.sujetoPasivo),
    !!filters.cargo,
    !!(filters.financiador || filters.financiadoPor),
    !!filters.fechaInicio,
    !!filters.fechaTermino
  ].filter(Boolean).length;
  const isFiltered = activeCount > 0;

  // 2. ZONA 2: KPIs declarativos (Diseño Behance LMS)
  const kpis = [
    {
      label: 'Total Viajes',
      value: stats.totalViajes !== undefined ? stats.totalViajes : totalItems,
      icon: 'compass',
      color: 'brand'
    },
    {
      label: 'Inversión Total',
      value: formatMoney(stats.totalInversion || 0),
      icon: 'coins',
      color: 'amber'
    },
    {
      label: 'Fondos Municipales',
      value: formatMoney(stats.financiadoMaipu || 0),
      icon: 'landmark',
      color: 'sky'
    },
    {
      label: 'Financiamiento Externo',
      value: formatMoney(stats.financiadoExterno || 0),
      icon: 'globe',
      color: 'indigo'
    }
  ];

  const filtersHtml = renderFilterBar({
    moduleName: 'viajes',
    activeCount,
    chipsHtml: `
      <!-- 1. VIGENCIA -->
      ${renderVigenciaSelect({
        id: "filter-viajes-vigencia",
        value: filters.vigencia,
        onChange: "changeViajesVigencia",
      })}

      <!-- 2. NOMBRE SUJETO PASIVO -->
      <div class="w-[210px] shrink-0">
        ${renderSearchInput({
          id: "viajes-filter-nombre",
          fieldName: "nombre",
          placeholder: "Sujeto Pasivo...",
          value: filters.nombre || filters.sujetoPasivo,
          icon: "user",
          hasSuggestions: true,
        })}
      </div>

      <!-- 3. CARGO -->
      <div class="w-[190px] shrink-0">
        ${renderSearchInput({
          id: "viajes-filter-cargo",
          fieldName: "cargo",
          placeholder: "Cargo...",
          value: filters.cargo,
          icon: "user",
          disabled: !(filters.nombre || filters.sujetoPasivo),
          hasSuggestions: true,
        })}
      </div>

      <!-- 4. FINANCIADOR -->
      <div class="w-[180px] shrink-0">
        ${renderSearchInput({
          id: "viajes-filter-financiador",
          fieldName: "financiador",
          placeholder: "Financiamiento...",
          value: filters.financiador,
          icon: "coins",
        })}
      </div>

      <!-- 5. SELECTOR DUAL DE FECHAS (DESDE / HASTA) -->
      ${renderDualDatePicker({
        idPrefix: 'viajes-filter-',
        fechaInicio: filters.fechaInicio,
        fechaTermino: filters.fechaTermino
      })}
    `
  });

  const columns = [
    {
      header: 'Fechas',
      key: 'fechas',
      width: 'w-28 whitespace-nowrap',
      render: (v) => `
        <div class="font-medium text-text-secondary text-xs font-mono">${formatDateFn(v.fecha_inicio)}</div>
        <div class="text-[10px] text-text-secondary/80 font-mono mt-0.5">al ${formatDateFn(v.fecha_termino)}</div>
      `
    },
    {
      header: 'Sujeto Pasivo / Cargo',
      key: 'sujeto',
      width: 'w-48 max-w-[190px]',
      render: (v) => {
        const sujetoName = v.sujeto_pasivo || '—';
        const cargoName = v.cargo || '—';
        return `
          <div class="font-medium text-text-secondary text-xs truncate max-w-[180px]" title="${escapeHtmlAttr(sujetoName)}">${escapeHtml(sujetoName)}</div>
          <div class="text-[10px] text-text-secondary/80 truncate max-w-[180px] mt-0.5" title="${escapeHtmlAttr(cargoName)}">${escapeHtml(cargoName)}</div>
        `;
      }
    },
    {
      header: 'Destino',
      key: 'destino',
      width: 'w-40 max-w-[160px] whitespace-nowrap',
      render: (v) => `
        <div class="flex items-center gap-1.5 font-medium text-text-secondary text-xs max-w-[140px] truncate" title="${escapeHtmlAttr(v.destino || '')}">
          <i data-lucide="map-pin" class="h-3.5 w-3.5 text-rose-500 shrink-0"></i>
          <span class="truncate">${escapeHtml(v.destino || '—')}</span>
        </div>
      `
    },
    {
      header: 'Objeto del Viaje',
      key: 'objeto',
      width: 'w-auto min-w-[180px]',
      render: (v) => `
        <p class="line-clamp-2 text-text-secondary text-[11px] leading-relaxed" title="${escapeHtmlAttr(v.objeto || '')}">
          ${escapeHtml(v.objeto || '—')}
        </p>
      `
    },
    {
      header: 'Ítems',
      key: 'items',
      width: 'w-44 max-w-[176px]',
      render: (v) => renderViajeItemsChips(v.items)
    },
    {
      header: 'Costo Total',
      key: 'costo',
      align: 'text-right',
      width: 'w-28 whitespace-nowrap font-mono',
      render: (v) => {
        const costoTotal = Number(v.costo_total) || 0;
        return `<span class="font-semibold text-text-secondary text-xs font-mono">${formatMoney(costoTotal)}</span>`;
      }
    },
    {
      header: 'Financiamiento',
      key: 'financiamiento',
      width: 'w-36 whitespace-nowrap',
      render: (v) => {
        const financiamiento = v.financiamiento || v.financiado_por || '—';
        const isMaipu = financiamiento.toLowerCase().includes('municipal') || financiamiento.toLowerCase().includes('maipú');
        const badgeClass = isMaipu
          ? 'bg-brand-500/10 text-brand-600 dark:text-brand-400 border-brand-500/20'
          : 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20';

        return `
          <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${badgeClass} max-w-[130px] truncate" title="${escapeHtmlAttr(financiamiento)}">
            ${escapeHtml(financiamiento)}
          </span>
        `;
      }
    },
    {
      header: 'Acción',
      key: 'accion',
      align: 'text-center',
      width: 'w-16 whitespace-nowrap',
      render: (v) => `
        <button onclick="event.stopPropagation(); showViajeDetailsModal(${v.id})" class="h-7 w-7 rounded-lg inline-flex items-center justify-center border border-border-ui hover:border-brand-500 bg-bg-card hover:bg-border-ui/50 text-text-secondary hover:text-brand-500 transition-colors cursor-pointer" title="Ver detalle completo">
          <i data-lucide="eye" class="h-3.5 w-3.5"></i>
        </button>
      `
    }
  ];

  container.innerHTML = renderTableListViewLayout({
    title: 'Registro de Viajes',
    titleIcon: 'plane',
    subtitle: 'Comisiones de servicio y viajes realizados por autoridades y funcionarios (Ley N° 20.730).',
    kpis,
    filtersHtml,
    counterText: `${totalItems} viajes encontrados`,
    counterId: 'viajes-counter',
    columns,
    items,
    rowClick: (v) => `showViajeDetailsModal(${v.id})`,
    emptyIcon: 'plane-takeoff',
    emptyMessage: 'No se encontraron registros de viajes para los filtros aplicados.',
    emptyActionHtml: '<button onclick="clearFilters(\'viajes\')" class="text-xs text-brand-500 hover:underline font-semibold mt-1 bg-transparent border-0 cursor-pointer">Limpiar filtros de búsqueda</button>',
    paginationSummary: `Mostrando <span class="font-semibold text-text-secondary">${items.length}</span> de <span class="font-semibold text-text-secondary">${totalItems}</span> viajes registrados`,
    paginationHtml: renderPaginationControls('viajes', totalItems, currentPage, pageSize)
  });

  if (typeof lucide !== 'undefined' && lucide.createIcons) {
    lucide.createIcons();
  }
  if (typeof window.initAirDatepickerFields === 'function') {
    window.initAirDatepickerFields();
  }
}

/**
 * Alterna visibilidad del panel de filtros de viajes
 */
export function toggleViajesFiltersPanel() {
  toggleFilterBarPanel('viajes');
}
if (typeof window !== 'undefined') {
  window.toggleViajesFiltersPanel = toggleViajesFiltersPanel;
}


/**
 * Modal: Detalle completo de un viaje
 * @param {number} viajeId
 */
export async function showViajeDetailsModal(viajeId) {
  const modal = document.getElementById('modal-container');
  if (!modal) return;

  const formatDateFn = typeof formatDate === 'function' ? formatDate : formatDateForDisplay;

  modal.classList.remove('hidden');
  modal.classList.add('backdrop-animate-in');

  modal.innerHTML = `
    <div class="glass-card w-full max-w-2xl p-6 rounded-3xl space-y-6 shadow-2xl relative modal-animate-in border border-border-ui">
      <div class="h-32 flex items-center justify-center">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500"></div>
      </div>
    </div>
  `;

  try {
    const res = await fetch(`/api/viajes/${viajeId}`);
    if (!res.ok) throw new Error("No se pudo cargar el registro");
    const v = await res.json();

    const isExt = v.financiado_por && !v.financiado_por.toLowerCase().includes("maip");
    const financiadoBadgeClass = isExt
      ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20"
      : "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20";

    modal.innerHTML = `
      <div class="glass-card w-full max-w-2xl p-6 rounded-3xl space-y-5 shadow-2xl relative modal-animate-in border border-border-ui">
        
        <!-- HEADER MODAL -->
        <div class="flex items-start justify-between pb-4 border-b border-border-ui">
          <div class="flex items-center gap-3">
            <div class="h-10 w-10 rounded-2xl bg-brand-500/10 text-brand-600 dark:text-brand-400 flex items-center justify-center shrink-0">
              <i data-lucide="plane" class="h-5 w-5"></i>
            </div>
            <div>
              <h3 class="text-base font-bold text-text-primary tracking-tight">Ficha de Viaje</h3>
              <p class="text-xs text-text-secondary mt-0.5">Destino: <strong class="text-text-primary">${escapeHtml(v.destino || '—')}</strong></p>
            </div>
          </div>
          <button type="button" onclick="closeModal()" title="Cerrar modal" aria-label="Cerrar modal" class="h-8 w-8 rounded-xl flex items-center justify-center border border-border-ui hover:bg-border-ui/50 text-text-secondary hover:text-text-primary transition-colors cursor-pointer">
            <i data-lucide="x" class="h-4 w-4"></i>
          </button>
        </div>

        <!-- DETALLES PRINCIPALES -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <!-- Sujeto Pasivo -->
          <div class="p-3.5 rounded-2xl bg-border-ui/30 border border-border-ui/50 space-y-1">
            <p class="text-[10px] font-bold uppercase tracking-wider text-text-tertiary">Sujeto Pasivo</p>
            <p class="text-xs font-bold text-text-primary">${escapeHtml(v.sujeto_pasivo || '—')}</p>
            <p class="text-[11px] text-text-secondary">${escapeHtml(v.cargo || '—')}</p>
          </div>

          <!-- Fechas de Viaje -->
          <div class="p-3.5 rounded-2xl bg-border-ui/30 border border-border-ui/50 space-y-1">
            <p class="text-[10px] font-bold uppercase tracking-wider text-text-tertiary">Período de Comisión</p>
            <p class="text-xs font-semibold text-text-primary">Desde: ${formatDateFn(v.fecha_inicio)}</p>
            <p class="text-xs font-semibold text-text-primary">Hasta: ${formatDateFn(v.fecha_termino)}</p>
          </div>
        </div>

        <!-- OBJETO DEL VIAJE -->
        <div class="space-y-1.5">
          <label class="text-[10px] font-bold uppercase tracking-wider text-text-tertiary">Objeto o Finalidad del Viaje</label>
          <div class="p-4 rounded-2xl bg-border-ui/20 border border-border-ui text-xs text-text-primary leading-relaxed">
            ${escapeHtml(v.objeto || 'Sin detalle de objeto especificado.')}
          </div>
        </div>

        <!-- FINANCIAMIENTO Y DESGLOSE DE GASTOS -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <!-- Financiamiento -->
          <div class="p-3.5 rounded-2xl bg-border-ui/30 border border-border-ui/50 space-y-2">
            <p class="text-[10px] font-bold uppercase tracking-wider text-text-tertiary">Financiado Por</p>
            <span class="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold border ${financiadoBadgeClass}">
              ${escapeHtml(v.financiado_por || 'Municipalidad de Maipú')}
            </span>
            ${v.tipo ? `<p class="text-[10px] text-text-tertiary">Tipo: ${escapeHtml(v.tipo)}</p>` : ''}
          </div>

          <!-- Costo Total -->
          <div class="p-3.5 rounded-2xl bg-border-ui/30 border border-border-ui/50 space-y-1">
            <p class="text-[10px] font-bold uppercase tracking-wider text-text-tertiary">Costo Total Declarado</p>
            <p class="text-xl font-black font-mono text-text-primary">${formatMoney(v.costo_total)}</p>
            ${v.fecha_ultima_modificacion ? `<p class="text-[10px] text-text-tertiary">Última mod: ${formatDateFn(v.fecha_ultima_modificacion)}</p>` : ''}
          </div>
        </div>

        <!-- ÍTEMS / GASTOS DESGLOSADOS -->
        <div class="space-y-2">
          <label class="text-[10px] font-bold uppercase tracking-wider text-text-tertiary">Desglose de Ítems (Pasajes, Viáticos, Estadías, etc.)</label>
          <div class="p-3.5 rounded-2xl bg-border-ui/20 border border-border-ui">
            ${renderViajeItemsChips(v.items)}
          </div>
        </div>

        <!-- BOTÓN CERRAR -->
        <div class="flex justify-end pt-2">
          <button type="button" onclick="closeModal()" class="px-4 py-2 rounded-xl text-xs font-semibold btn-secondary">
            Cerrar
          </button>
        </div>

      </div>
    `;

    if (typeof lucide !== 'undefined' && lucide.createIcons) {
      lucide.createIcons();
    }
  } catch (err) {
    console.error('[viajes] Error al abrir detalle del viaje:', err);
    modal.innerHTML = `
      <div class="glass-card w-full max-w-md p-6 rounded-3xl space-y-4 shadow-2xl text-center">
        <p class="text-xs text-rose-500 font-semibold">Error al cargar el detalle del viaje.</p>
        <button type="button" onclick="closeModal()" class="px-4 py-2 rounded-xl text-xs font-semibold btn-secondary">Cerrar</button>
      </div>
    `;
  }
}

/**
 * Exportación de registros de viajes a Excel
 */
export async function exportarViajesExcel() {
  try {
    const pageState = (typeof paginationState !== 'undefined' ? paginationState : (typeof window !== 'undefined' ? window.paginationState : null)) || { viajes: { filters: {} } };
    const filters = pageState.viajes?.filters || {};
    const params = new URLSearchParams({
      all: 'true',
      vigencia: filters.vigencia || '',
      sujetoPasivo: filters.sujetoPasivo || filters.nombre || '',
      cargo: filters.cargo || '',
      financiador: filters.financiador || filters.financiadoPor || '',
      fechaInicio: filters.fechaInicio || '',
      fechaTermino: filters.fechaTermino || ''
    });

    const res = await fetch(`/api/viajes?${params.toString()}`);
    if (!res.ok) throw new Error("Error al consultar datos de viajes");
    const data = await res.json();

    if (!Array.isArray(data) || data.length === 0) {
      if (typeof showToast === 'function') {
        showToast("No hay registros para exportar con los filtros seleccionados.", "warning");
      }
      return;
    }

    const exportRows = data.map(v => ({
      "Fecha Inicio": v.fecha_inicio || "",
      "Fecha Término": v.fecha_termino || "",
      "Fecha Última Modificación": v.fecha_ultima_modificacion || "",
      "Destino": v.destino || "",
      "Objeto": v.objeto || "",
      "Tipo": v.tipo || "",
      "Sujeto Pasivo": v.sujeto_pasivo || "",
      "Cargo": v.cargo || "",
      "ID Sujeto Pasivo": v.id_sujeto_pasivo || "",
      "Ítems": v.items || "",
      "Costo Total": v.costo_total || 0,
      "Financiado Por": v.financiado_por || ""
    }));

    if (typeof XLSX === 'undefined') {
      throw new Error("Biblioteca XLSX no disponible");
    }

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Viajes");

    const now = new Date();
    const dateStr = now.toISOString().split("T")[0];
    XLSX.writeFile(wb, `Reporte_Viajes_LobbyControl_${dateStr}.xlsx`);
    if (typeof showToast === 'function') {
      showToast("Reporte de viajes exportado exitosamente.", "success");
    }
  } catch (err) {
    console.error("Error exportando viajes a Excel:", err);
    if (typeof showToast === 'function') {
      showToast("Error al generar el archivo Excel de viajes.", "error");
    }
  }
}

export const ViajesView = {
  async mount(container, params = {}) {
    return renderViajes(container);
  },
  unmount() {}
};

if (typeof window !== 'undefined') {
  window.renderViajes = renderViajes;
  window.renderViajesModule = renderViajes;
  window.showViajeDetailsModal = showViajeDetailsModal;
  window.exportarViajesExcel = exportarViajesExcel;
  window.formatMoney = formatMoney;
  window.renderViajeItemsChips = renderViajeItemsChips;
  window.ViajesView = ViajesView;
}
