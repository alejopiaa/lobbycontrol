/**
 * DonativosView - Vista modular de registro de donativos (Hoja DH)
 * LobbyControl - Arquitectura Modular ESM
 */

import {
  renderGlassCard,
  renderSearchInput,
  renderVigenciaSelect,
  renderPaginationControls,
  renderTableListViewLayout,
  renderFilterBar,
  renderFilterChip,
  renderDualDatePicker
} from '../../components/ui.js';
import {
  formatDateForDisplay,
  escapeHtml,
  escapeHtmlAttr
} from '../../utils/formatters.js';

/**
 * Renderiza la vista principal de Donativos
 * @param {HTMLElement} container - Contenedor principal donde se monta la vista
 */
export function renderDonativos(container) {
  if (!container) return;

  const store = (typeof dataStore !== 'undefined' ? dataStore : (typeof window !== 'undefined' ? window.dataStore : null)) || {};
  const pageState = (typeof paginationState !== 'undefined' ? paginationState : (typeof window !== 'undefined' ? window.paginationState : null)) || { donativos: { page: 1, filters: {} } };

  const formatDateFn = typeof formatDate === 'function' ? formatDate : formatDateForDisplay;
  const filters = pageState.donativos?.filters || {};
  const currentPage = pageState.donativos?.page || 1;
  const pageSize = 10;

  const isServerPaged = store.donativos && !Array.isArray(store.donativos);
  const items = isServerPaged ? (store.donativos.data || []) : (store.donativos || []);
  const totalItems = isServerPaged ? (store.donativos.totalItems || 0) : items.length;

  const stats = store.donativosStats || {
    totalDonativos: totalItems,
    totalSujetos: 0,
    totalProcedencias: 0,
    donativosAnioActual: 0,
    topTipos: []
  };

  const currentYear = new Date().getFullYear();

  // 1. ZONA 1: Filtros (Estructura Unificada Dashboard)
  const activeCount = [
    filters.vigencia && filters.vigencia !== 'todos',
    !!(filters.nombre || filters.sujetoPasivo),
    !!filters.cargo,
    !!filters.procedencia,
    !!filters.fechaInicio,
    !!filters.fechaTermino
  ].filter(Boolean).length;
  const isFiltered = activeCount > 0;

  // 2. ZONA 2: KPIs declarativos (Diseño Behance LMS)
  const kpis = [
    {
      label: 'Total Donativos',
      value: stats.totalDonativos !== undefined ? stats.totalDonativos : totalItems,
      icon: 'gift',
      color: 'brand'
    },
    {
      label: 'Sujetos Receptores',
      value: stats.totalSujetos || 0,
      icon: 'users',
      color: 'amber'
    },
    {
      label: 'Procedencias',
      value: stats.totalProcedencias || 0,
      icon: 'user-check',
      color: 'indigo'
    },
    {
      label: `Año ${currentYear}`,
      value: stats.donativosAnioActual || 0,
      icon: 'calendar',
      color: 'sky'
    }
  ];

  const filtersHtml = renderFilterBar({
    moduleName: 'donativos',
    activeCount,
    chipsHtml: `
      <!-- 1. VIGENCIA -->
      ${renderVigenciaSelect({
        id: "filter-donativos-vigencia",
        value: filters.vigencia,
        onChange: "changeDonativosVigencia",
      })}

      <!-- 2. NOMBRE SUJETO PASIVO -->
      <div class="w-[210px] shrink-0">
        ${renderSearchInput({
          id: "donativos-filter-nombre",
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
          id: "donativos-filter-cargo",
          fieldName: "cargo",
          placeholder: "Cargo...",
          value: filters.cargo,
          icon: "user",
          disabled: !(filters.nombre || filters.sujetoPasivo),
          hasSuggestions: true,
        })}
      </div>

      <!-- 4. PROCEDENCIA -->
      <div class="w-[180px] shrink-0">
        ${renderSearchInput({
          id: "donativos-filter-procedencia",
          fieldName: "procedencia",
          placeholder: "Procedencia...",
          value: filters.procedencia,
          icon: "user",
        })}
      </div>

      <!-- 5. SELECTOR DUAL DE FECHAS (DESDE / HASTA) -->
      ${renderDualDatePicker({
        idPrefix: 'donativos-filter-',
        fechaInicio: filters.fechaInicio,
        fechaTermino: filters.fechaTermino
      })}
    `
  });

  const columns = [
    {
      header: 'Fecha',
      key: 'fecha',
      width: 'w-28 whitespace-nowrap',
      render: (d) => `<div class="font-medium text-text-secondary text-xs font-mono">${formatDateFn(d.fecha)}</div>`
    },
    {
      header: 'Sujeto Pasivo / Cargo',
      key: 'sujeto',
      width: 'w-48 max-w-[190px]',
      render: (d) => {
        const sujetoName = d.sujeto_pasivo || d.sujetoPasivo || '—';
        const cargoName = d.cargo || '—';
        return `
          <div class="font-medium text-text-secondary text-xs truncate max-w-[180px]" title="${escapeHtmlAttr(sujetoName)}">${escapeHtml(sujetoName)}</div>
          <div class="text-[10px] text-text-secondary/80 truncate max-w-[180px] mt-0.5" title="${escapeHtmlAttr(cargoName)}">${escapeHtml(cargoName)}</div>
        `;
      }
    },
    {
      header: 'Procedencia',
      key: 'procedencia',
      width: 'w-40 max-w-[160px] whitespace-nowrap',
      render: (d) => `
        <div class="flex items-center gap-1.5 font-medium text-text-secondary text-xs max-w-[140px] truncate" title="${escapeHtmlAttr(d.procedencia || '')}">
          <i data-lucide="user" class="h-3.5 w-3.5 text-brand-500 shrink-0"></i>
          <span class="truncate">${escapeHtml(d.procedencia || '—')}</span>
        </div>
      `
    },
    {
      header: 'Descripción',
      key: 'descripcion',
      width: 'w-auto min-w-[180px]',
      render: (d) => `
        <p class="line-clamp-2 text-text-secondary text-[11px] leading-relaxed" title="${escapeHtmlAttr(d.descripcion || '')}">
          ${escapeHtml(d.descripcion || '—')}
        </p>
      `
    },
    {
      header: 'Ocasión',
      key: 'ocasion',
      width: 'w-44 max-w-[176px]',
      render: (d) => `
        <p class="line-clamp-2 text-text-secondary text-[11px] leading-relaxed" title="${escapeHtmlAttr(d.ocasion || '')}">
          ${escapeHtml(d.ocasion || '—')}
        </p>
      `
    },
    {
      header: 'Tipo',
      key: 'tipo',
      width: 'w-36 whitespace-nowrap',
      render: (d) => {
        const tipoVal = d.tipo || 'General';
        return `
          <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-brand-500/10 text-brand-600 dark:text-brand-400 border-brand-500/20 max-w-[130px] truncate" title="${escapeHtmlAttr(tipoVal)}">
            ${escapeHtml(tipoVal)}
          </span>
        `;
      }
    },
    {
      header: 'Acción',
      key: 'accion',
      align: 'text-center',
      width: 'w-16 whitespace-nowrap',
      render: (d) => `
        <button onclick="event.stopPropagation(); showDonativoDetailsModal(${d.id})" class="h-7 w-7 rounded-lg inline-flex items-center justify-center border border-border-ui hover:border-brand-500 bg-bg-card hover:bg-border-ui/50 text-text-secondary hover:text-brand-500 transition-colors cursor-pointer" title="Ver detalle completo">
          <i data-lucide="eye" class="h-3.5 w-3.5"></i>
        </button>
      `
    }
  ];

  container.innerHTML = renderTableListViewLayout({
    title: 'Registro de Donativos',
    titleIcon: 'gift',
    subtitle: 'Donativos y regalos protocolares recibidos por sujetos pasivos en ejercicio de sus funciones (Ley N° 20.730).',
    kpis,
    filtersHtml,
    counterText: `${totalItems} donativos encontrados`,
    counterId: 'donativos-counter',
    columns,
    items,
    rowClick: (d) => `showDonativoDetailsModal(${d.id})`,
    emptyIcon: 'gift',
    emptyMessage: 'No se encontraron registros de donativos para los filtros aplicados.',
    emptyActionHtml: '<button onclick="clearFilters(\'donativos\')" class="text-xs text-brand-500 hover:underline font-semibold mt-1 bg-transparent border-0 cursor-pointer">Limpiar filtros de búsqueda</button>',
    paginationSummary: `Mostrando <span class="font-semibold text-text-secondary">${items.length}</span> de <span class="font-semibold text-text-secondary">${totalItems}</span> donativos registrados`,
    paginationHtml: renderPaginationControls('donativos', totalItems, currentPage, pageSize)
  });

  if (typeof lucide !== 'undefined' && lucide.createIcons) {
    lucide.createIcons();
  }
  if (typeof window.initAirDatepickerFields === 'function') {
    window.initAirDatepickerFields();
  }
}

/**
 * Alterna visibilidad del panel de filtros de donativos
 */
export function toggleDonativosFiltersPanel() {
  toggleFilterBarPanel('donativos');
}
if (typeof window !== 'undefined') {
  window.toggleDonativosFiltersPanel = toggleDonativosFiltersPanel;
}



/**
 * Modal: Detalle completo de un donativo
 * @param {number} donativoId
 */
export async function showDonativoDetailsModal(donativoId) {
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
    const res = await fetch(`/api/donativos/${donativoId}`);
    if (!res.ok) throw new Error("No se pudo cargar el registro");
    const d = await res.json();

    const sujetoName = d.sujeto_pasivo || d.sujetoPasivo || '—';
    const cargoName = d.cargo || '—';

    modal.innerHTML = `
      <div class="glass-card w-full max-w-2xl p-6 rounded-3xl space-y-5 shadow-2xl relative modal-animate-in border border-border-ui">
        
        <!-- HEADER MODAL -->
        <div class="flex items-start justify-between pb-4 border-b border-border-ui">
          <div class="flex items-center gap-3">
            <div class="h-10 w-10 rounded-2xl bg-brand-500/10 text-brand-600 dark:text-brand-400 flex items-center justify-center shrink-0">
              <i data-lucide="gift" class="h-5 w-5"></i>
            </div>
            <div>
              <h3 class="text-base font-bold text-text-primary">Detalle de Donativo</h3>
              <p class="text-[11px] text-text-tertiary">Registro de donativo protocolar (Ley N° 20.730)</p>
            </div>
          </div>
          <button type="button" onclick="closeModal()" title="Cerrar modal" aria-label="Cerrar modal" class="text-text-tertiary hover:text-text-primary transition-colors p-1 cursor-pointer bg-transparent border-0">
            <i data-lucide="x" class="h-5 w-5"></i>
          </button>
        </div>

        <!-- GRID DATOS GENERALES -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <!-- Sujeto Pasivo -->
          <div class="p-3 bg-bg-card rounded-xl border border-border-ui">
            <p class="text-[10px] font-bold uppercase tracking-wider text-text-tertiary">Sujeto Pasivo</p>
            <p class="text-xs font-bold text-text-primary mt-1">${escapeHtml(sujetoName)}</p>
            <p class="text-[11px] text-text-secondary mt-0.5">${escapeHtml(cargoName)}</p>
            ${d.id_sujeto_pasivo || d.idSujetoPasivo ? `<p class="text-[10px] text-text-tertiary mt-1 font-mono">ID: ${escapeHtml(d.id_sujeto_pasivo || d.idSujetoPasivo)}</p>` : ''}
          </div>

          <!-- Fechas -->
          <div class="p-3 bg-bg-card rounded-xl border border-border-ui">
            <p class="text-[10px] font-bold uppercase tracking-wider text-text-tertiary">Fechas de Registro</p>
            <p class="text-xs font-semibold text-text-primary mt-1">Fecha Recepción: ${formatDateFn(d.fecha)}</p>
            ${d.fecha_ultima_modificacion || d.fechaUltimaModificacion ? `
              <p class="text-[10px] text-text-tertiary mt-0.5">Última modif.: ${formatDateFn(d.fecha_ultima_modificacion || d.fechaUltimaModificacion)}</p>
            ` : ''}
          </div>

          <!-- Ocasión -->
          <div class="p-3 bg-bg-card rounded-xl border border-border-ui">
            <p class="text-[10px] font-bold uppercase tracking-wider text-text-tertiary">Ocasión</p>
            <p class="text-xs font-semibold text-text-primary mt-1">${escapeHtml(d.ocasion || '—')}</p>
          </div>

          <!-- Procedencia y Tipo -->
          <div class="p-3 bg-bg-card rounded-xl border border-border-ui">
            <p class="text-[10px] font-bold uppercase tracking-wider text-text-tertiary">Procedencia & Tipo</p>
            <p class="text-xs font-semibold text-text-primary mt-1">${escapeHtml(d.procedencia || '—')}</p>
            <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-brand-500/10 text-brand-600 dark:text-brand-400 border-brand-500/20 mt-1">
              ${escapeHtml(d.tipo || 'General')}
            </span>
          </div>
        </div>

        <!-- DESCRIPCIÓN COMPLETA -->
        <div class="p-4 bg-bg-card rounded-xl border border-border-ui space-y-1.5">
          <p class="text-[10px] font-bold uppercase tracking-wider text-text-tertiary">Descripción del Donativo</p>
          <p class="text-xs text-text-primary leading-relaxed whitespace-pre-wrap">${escapeHtml(d.descripcion || 'Sin descripción detallada.')}</p>
        </div>

        <!-- FOOTER -->
        <div class="pt-3 border-t border-border-ui flex justify-end">
          <button type="button" onclick="closeModal()" class="px-4 py-2 rounded-xl text-xs font-semibold btn-secondary cursor-pointer">
            Cerrar
          </button>
        </div>

      </div>
    `;

    if (typeof lucide !== 'undefined' && lucide.createIcons) {
      lucide.createIcons();
    }
  } catch (err) {
    console.error('[donativos] Error al abrir detalle:', err);
    modal.innerHTML = `
      <div class="glass-card w-full max-w-md p-6 rounded-3xl space-y-4 shadow-2xl text-center">
        <p class="text-xs text-rose-500 font-semibold">Error al cargar el detalle del donativo.</p>
        <button type="button" onclick="closeModal()" class="px-4 py-2 rounded-xl text-xs font-semibold btn-secondary">Cerrar</button>
      </div>
    `;
  }
}

/**
 * Exportación de donativos a Excel
 */
export async function exportarDonativosExcel() {
  try {
    const pageState = (typeof paginationState !== 'undefined' ? paginationState : (typeof window !== 'undefined' ? window.paginationState : null)) || { donativos: { filters: {} } };
    const filters = pageState.donativos?.filters || {};
    const params = new URLSearchParams({
      all: 'true',
      vigencia: filters.vigencia || '',
      sujetoPasivo: filters.sujetoPasivo || filters.nombre || '',
      cargo: filters.cargo || '',
      procedencia: filters.procedencia || '',
      fechaInicio: filters.fechaInicio || '',
      fechaTermino: filters.fechaTermino || ''
    });

    const res = await fetch(`/api/donativos?${params.toString()}`);
    if (!res.ok) throw new Error("Error al consultar datos de donativos");
    const data = await res.json();

    if (!Array.isArray(data) || data.length === 0) {
      if (typeof showToast === 'function') {
        showToast("No hay registros para exportar con los filtros seleccionados.", "warning");
      }
      return;
    }

    const exportRows = data.map(d => ({
      "Fecha": d.fecha || "",
      "Fecha Última Modificación": d.fecha_ultima_modificacion || d.fechaUltimaModificacion || "",
      "Sujeto Pasivo": d.sujeto_pasivo || d.sujetoPasivo || "",
      "Cargo": d.cargo || "",
      "ID Sujeto Pasivo": d.id_sujeto_pasivo || d.idSujetoPasivo || "",
      "Ocasión": d.ocasion || "",
      "Descripción": d.descripcion || "",
      "Procedencia": d.procedencia || "",
      "Tipo": d.tipo || ""
    }));

    if (typeof XLSX === 'undefined') {
      throw new Error("Biblioteca XLSX no disponible");
    }

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Donativos");

    const now = new Date();
    const dateStr = now.toISOString().split("T")[0];
    XLSX.writeFile(wb, `Reporte_Donativos_LobbyControl_${dateStr}.xlsx`);
    if (typeof showToast === 'function') {
      showToast("Reporte de donativos exportado exitosamente.", "success");
    }
  } catch (err) {
    console.error("Error exportando donativos a Excel:", err);
    if (typeof showToast === 'function') {
      showToast("Error al generar el archivo Excel de donativos.", "error");
    }
  }
}

export const DonativosView = {
  async mount(container, params = {}) {
    return renderDonativos(container);
  },
  unmount() {}
};

if (typeof window !== 'undefined') {
  window.renderDonativos = renderDonativos;
  window.renderDonativosModule = renderDonativos;
  window.showDonativoDetailsModal = showDonativoDetailsModal;
  window.exportarDonativosExcel = exportarDonativosExcel;
  window.DonativosView = DonativosView;
}

