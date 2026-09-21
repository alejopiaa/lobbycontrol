/**
 * ReportesView - Vista modular de Reportes Analíticos Avanzados
 * LobbyControl - Arquitectura Modular ESM
 */

import {
  renderGlassCard,
  renderSearchInput,
  renderDateInput,
  renderVigenciaSelect,
  renderPaginationControls
} from '../../components/ui.js';
import {
  escapeHtml,
  escapeHtmlAttr
} from '../../utils/formatters.js';

export function renderReportes(container, options = {}) {
  if (!container) return;
  const isEmbedded = !!(options && options.isEmbedded) || container.id === 'admin-tab-content-container';

  const filters = window.reportesFilters || {
    vigencia: 'todos',
    nombre: '',
    cargo: '',
    fechaInicio: '',
    fechaTermino: '',
    estados: []
  };

  const pagState = window.paginationState?.reportes || { page: 1 };
  const dStore = window.dataStore || {};
  const rawData = dStore.reportesRawData || [];

  const processFn = typeof window.processReportData === 'function'
    ? window.processReportData
    : (data) => data || [];

  const processedData = processFn(rawData, filters);
  const totalItems = processedData.length;
  const currentPage = pagState.page || 1;
  const pageSize = 10;
  const paginatedItems = processedData.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  const isNombreEmpty = !filters.nombre || filters.nombre === "";
  const cargoPlaceholder = isNombreEmpty
    ? "Seleccione nombre primero..."
    : "Escribir cargo...";

  let rowsHtml = "";
  if (paginatedItems.length === 0) {
    const hasAnyFilter =
      (filters.nombre && filters.nombre !== "") ||
      (filters.cargo && filters.cargo !== "") ||
      filters.fechaInicio ||
      filters.fechaTermino ||
      (filters.estados && filters.estados.length > 0);
    const msg = hasAnyFilter
      ? "No hay registros que coincidan con los filtros aplicados."
      : 'Por favor, ingrese un Sujeto Pasivo (o seleccione "Todos") u otros filtros para generar el reporte.';
    rowsHtml = `<tr><td colspan="7" class="px-6 py-8 text-center text-xs text-text-tertiary font-semibold">${msg}</td></tr>`;
  } else {
    paginatedItems.forEach((item) => {
      rowsHtml += `
        <tr class="hover:bg-border-ui dark:hover:bg-border-ui border-b border-border-ui transition-colors h-[56px]">
          <td class="pl-6 pr-2 text-xs font-semibold text-text-tertiary text-left w-12">${item.index}</td>
          <td class="px-2 text-xs font-semibold text-text-secondary text-left w-36">${escapeHtml(item.folio)}</td>
          <td class="px-2 text-xs text-text-secondary text-left" title="${escapeHtmlAttr(item.cargoCompleto)}">
            <div class="font-medium text-text-secondary truncate max-w-xs">${escapeHtml(item.cargoCompleto)}</div>
          </td>
          <td class="px-2 text-xs text-left w-32">
            <div class="font-medium text-text-secondary">${item.fechaIngreso}</div>
            ${item.fechaLimiteRespuesta ? `<div class="text-[10px] text-text-tertiary mt-0.5" title="Plazo Legal Límite de Respuesta">${item.fechaLimiteRespuesta}</div>` : ""}
          </td>
          <td class="px-2 text-xs text-left w-32">
            <div class="font-medium text-text-secondary">${item.fechaAgendada}</div>
            ${item.fechaLimitePublicacion ? `<div class="text-[10px] text-text-tertiary mt-0.5" title="Plazo Límite de Publicación">${item.fechaLimitePublicacion}</div>` : ""}
          </td>
          <td class="px-2 text-xs text-left w-44">
            ${
              item.badgeText === "Pendiente de publicación"
                ? `<span class="px-2 py-1 rounded text-[10px] font-bold ${item.badgeClass} inline-block text-center leading-tight">Pendiente de<br>publicación</span>`
                : `<span class="px-2 py-0.5 rounded text-[10px] font-bold ${item.badgeClass} whitespace-nowrap">${escapeHtml(item.badgeText)}</span>`
            }
          </td>
          <td class="pl-2 pr-6 text-xs text-left w-28">
            ${(() => {
              const plazoStr = item.plazo || "";
              const hasDays =
                plazoStr.includes("(") && plazoStr.includes(")");
              let mainCode = plazoStr || "—";
              let subtextHtml = "";

              if (hasDays) {
                const parts = plazoStr.split(" ");
                mainCode = parts[0] || "—";
                const days = (parts[1] || "").replace(/[()]/g, "");
                if (mainCode === "FDP" || mainCode === "RFP") {
                  subtextHtml = `<div class="text-[9px] font-bold mt-0.5 leading-none opacity-90">${days}</div>`;
                }
              }

              const isOverdue =
                mainCode === "FDP" ||
                mainCode === "RFP" ||
                plazoStr.includes("-");
              const badgeClass = isOverdue
                ? "badge-status-vencido"
                : "badge-status-enplazo";

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

  const existingReportes = container.querySelector("#reportes-view-container");
  if (existingReportes) {
    const tbody = existingReportes.querySelector("#table-reportes tbody");
    if (tbody) tbody.innerHTML = rowsHtml;
    
    const counterEl = existingReportes.querySelector("#reportes-counter");
    if (counterEl) counterEl.textContent = `${totalItems} registros coincidentes encontrados`;
    
    const pagEl = existingReportes.querySelector("#reportes-pagination-container");
    if (pagEl) {
      pagEl.innerHTML = renderPaginationControls(
        "reportes",
        totalItems,
        currentPage,
        pageSize,
      );
    }

    const exportBtnContainer = existingReportes.querySelector("#reportes-export-btn-container");
    if (exportBtnContainer) {
      exportBtnContainer.className = "flex items-center gap-2.5 flex-wrap";
      exportBtnContainer.innerHTML = `
        <button onclick="abrirModalConfigurarCorrelativo()" title="Configurar o reiniciar correlativo de reportes RAP" class="px-2.5 py-1.5 bg-border-ui hover:bg-border-ui dark:hover:bg-border-ui/50 text-text-secondary border border-border-ui rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer group">
          <i data-lucide="hash" class="h-3.5 w-3.5 text-brand-600 dark:text-brand-400"></i>
          <span class="text-[10px] uppercase font-bold text-text-tertiary">Próximo Folio:</span>
          <span id="badge-proximo-correlativo" class="font-mono font-extrabold text-brand-600 dark:text-brand-400 text-xs">...</span>
          <i data-lucide="settings-2" class="h-3 w-3 text-text-tertiary group-hover:text-text-primary dark:group-hover:text-text-primary transition-colors ml-0.5"></i>
        </button>

        <button onclick="generarReportesMasivos()" class="px-2.5 py-1.5 bg-border-ui hover:bg-border-ui dark:hover:bg-border-ui/50 text-text-secondary border border-border-ui rounded-xl text-[10px] font-bold flex items-center gap-1 transition-all shadow-sm cursor-pointer">
          <i data-lucide="files" class="h-3.5 w-3.5"></i>
          Generación Masiva
        </button>
        
        <div class="h-4 w-[1px] bg-border-ui mx-1"></div>

        <button onclick="exportReportToExcel()" class="px-3 py-1.5 bg-border-ui hover:bg-border-ui dark:hover:bg-border-ui/50 text-text-secondary border border-border-ui rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm ${totalItems > 0 ? 'cursor-pointer' : 'opacity-40 cursor-not-allowed'}" title="${totalItems > 0 ? 'Exportar datos a planilla Excel (.xlsx)' : 'No hay registros coincidentes para exportar'}">
          <i data-lucide="sheet" class="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400"></i>
          Exportar a Excel
        </button>

        <button onclick="exportReporteEjecutivoPDF()" class="px-3 py-1.5 bg-border-ui hover:bg-border-ui dark:hover:bg-border-ui/50 text-text-secondary border border-border-ui rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm ${totalItems > 0 ? 'cursor-pointer' : 'opacity-40 cursor-not-allowed'}" title="${totalItems > 0 ? 'Generar Reporte Consolidado de Solicitudes y Audiencias' : 'No hay registros coincidentes para exportar'}">
          <i data-lucide="bar-chart-3" class="h-3.5 w-3.5 text-blue-600 dark:text-blue-400"></i>
          Reporte Consolidado PDF
        </button>

        <button onclick="exportReportToPDF()" class="px-3 py-1.5 bg-brand-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm ${totalItems > 0 ? 'cursor-pointer hover:bg-brand-500' : 'opacity-40 cursor-not-allowed'}" title="${totalItems > 0 ? 'Exportar documento PDF individual' : 'No hay registros coincidentes para exportar'}">
          <i data-lucide="file-down" class="h-3.5 w-3.5"></i>
          Exportar PDF
        </button>`;
    }
    if (window.actualizarBadgeCorrelativo) {
      window.actualizarBadgeCorrelativo();
    }
    if (window.lucide) window.lucide.createIcons();
    return true;
  }

  container.innerHTML = `
    <div class="space-y-4 font-sans" id="reportes-view-container">
      ${!isEmbedded ? `
      <div class="space-y-1">
        <h2 class="text-2xl font-bold text-heading tracking-tight">Reportes</h2>
      </div>
      ` : ''}

      <!-- PANEL FILTROS AVANZADOS -->
      ${renderGlassCard(
        `
        <div class="flex flex-wrap items-center justify-between border-b border-border-ui pb-3 gap-2">
          <div class="flex items-center gap-3 flex-wrap">
            <h3 class="text-xs font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400 flex items-center gap-2">
              <i data-lucide="sliders-horizontal" class="h-3.5 w-3.5"></i>
              Filtros
            </h3>
            ${renderVigenciaSelect({
              id: "reportes-filter-vigencia",
              value: filters.vigencia,
              onChange: "changeReportesVigencia",
            })}
          </div>
          <button id="btn-reportes-clear" class="text-[10px] text-text-tertiary hover:text-text-primary transition-colors flex items-center gap-1 bg-transparent border-none cursor-pointer">
            <i data-lucide="rotate-ccw" class="h-3 w-3"></i> Limpiar Filtros
          </button>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <!-- NOMBRE -->
          ${renderSearchInput({
            id: "report-filter-nombre",
            fieldName: "nombre",
            label: "Nombre Sujeto Pasivo",
            placeholder: "Vigentes o escribir nombre...",
            value: filters.nombre,
            hasSuggestions: true,
          })}

          <!-- CARGO -->
          ${renderSearchInput({
            id: "report-filter-cargo",
            fieldName: "cargo",
            label: "Cargo",
            placeholder: cargoPlaceholder,
            value: filters.cargo,
            disabled: isNombreEmpty,
            hasSuggestions: true,
          })}

          <!-- FECHA INICIO -->
          ${renderDateInput({
            id: "report-filter-fechainicio",
            fieldName: "fechaInicio",
            label: "Fecha Inicio",
            value: filters.fechaInicio,
          })}

          <!-- FECHA TERMINO -->
          ${renderDateInput({
            id: "report-filter-fechatermino",
            fieldName: "fechaTermino",
            label: "Fecha Término",
            value: filters.fechaTermino,
          })}
        </div>

        <!-- FILTRO ESTADOS MULTIPLE -->
        <div class="space-y-2">
          <label class="text-[10px] font-bold text-text-tertiary uppercase tracking-wider block">Estados de Solicitud (Selección Múltiple)</label>
          <div class="flex flex-wrap gap-2.5">
            ${[
              "Ingresada",
              "Aceptada",
              "Rechazada",
              "Suspendida",
              "Cancelada",
              "Encomendada",
              "Pendiente de publicación",
            ]
              .map((est) => {
                const checked = (filters.estados || []).includes(est);
                return `
                <label class="flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer select-none transition-all ${checked ? "border-brand-500 bg-blue-500/10 text-blue-600 dark:text-blue-400 shadow-sm shadow-brand-500/20" : "border-border-ui bg-border-ui text-text-tertiary hover:bg-border-ui dark:hover:bg-border-ui/50"}">
                  <input type="checkbox" class="sr-only report-estado-checkbox" data-estado="${est}" ${checked ? "checked" : ""}>
                  <span>${est}</span>
                </label>
              `;
              })
              .join("")}
          </div>
        </div>
      `,
        "rounded-2xl p-5 space-y-4 relative z-20",
      )}

      <!-- TABLA DE REPORTES -->
      <div class="rounded-2xl overflow-hidden mt-4 border border-border-ui glass-card">
        <div class="p-4 border-b border-border-ui flex justify-between items-center">
          <div class="text-xs text-text-secondary font-semibold" id="reportes-counter">${totalItems} registros coincidentes encontrados</div>
          <div id="reportes-export-btn-container" class="flex items-center gap-2.5 flex-wrap">
            <button onclick="abrirModalConfigurarCorrelativo()" title="Configurar o reiniciar correlativo de reportes RAP" class="px-2.5 py-1.5 bg-border-ui hover:bg-border-ui dark:hover:bg-border-ui/50 text-text-secondary border border-border-ui rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer group">
              <i data-lucide="hash" class="h-3.5 w-3.5 text-brand-600 dark:text-brand-400"></i>
              <span class="text-[10px] uppercase font-bold text-text-tertiary">Próximo Folio:</span>
              <span id="badge-proximo-correlativo" class="font-mono font-extrabold text-brand-600 dark:text-brand-400 text-xs">...</span>
              <i data-lucide="settings-2" class="h-3 w-3 text-text-tertiary group-hover:text-text-primary dark:group-hover:text-text-primary transition-colors ml-0.5"></i>
            </button>

            <button onclick="generarReportesMasivos()" class="px-2.5 py-1.5 bg-border-ui hover:bg-border-ui dark:hover:bg-border-ui/50 text-text-secondary border border-border-ui rounded-xl text-[10px] font-bold flex items-center gap-1 transition-all shadow-sm cursor-pointer">
              <i data-lucide="files" class="h-3.5 w-3.5"></i>
              Generación Masiva
            </button>
            
            <div class="h-4 w-[1px] bg-border-ui mx-1"></div>

            <button onclick="exportReportToExcel()" class="px-3 py-1.5 bg-border-ui hover:bg-border-ui dark:hover:bg-border-ui/50 text-text-secondary border border-border-ui rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm ${totalItems > 0 ? 'cursor-pointer' : 'opacity-40 cursor-not-allowed'}" title="${totalItems > 0 ? 'Exportar datos a planilla Excel (.xlsx)' : 'No hay registros coincidentes para exportar'}">
              <i data-lucide="sheet" class="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400"></i>
              Exportar a Excel
            </button>

            <button onclick="exportReporteEjecutivoPDF()" class="px-3 py-1.5 bg-border-ui hover:bg-border-ui dark:hover:bg-border-ui/50 text-text-secondary border border-border-ui rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm ${totalItems > 0 ? 'cursor-pointer' : 'opacity-40 cursor-not-allowed'}" title="${totalItems > 0 ? 'Generar Reporte Consolidado de Solicitudes y Audiencias' : 'No hay registros coincidentes para exportar'}">
              <i data-lucide="bar-chart-3" class="h-3.5 w-3.5 text-blue-600 dark:text-blue-400"></i>
              Reporte Consolidado PDF
            </button>

            <button onclick="exportReportToPDF()" class="px-3 py-1.5 bg-brand-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm ${totalItems > 0 ? 'cursor-pointer hover:bg-brand-500' : 'opacity-40 cursor-not-allowed'}" title="${totalItems > 0 ? 'Exportar documento PDF individual' : 'No hay registros coincidentes para exportar'}">
              <i data-lucide="file-down" class="h-3.5 w-3.5"></i>
              Exportar PDF
            </button>
          </div>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse table-fixed" id="table-reportes">
            <thead>
              <tr class="bg-border-ui/50 border-b border-border-ui text-text-tertiary text-[10px] uppercase font-bold tracking-widest">
                <th class="pl-6 pr-2 py-3 w-12 text-left">#</th>
                <th class="px-2 py-3 w-36 text-left">Folio</th>
                <th class="px-2 py-3 text-left">Sujeto Pasivo y Cargo</th>
                <th class="px-2 py-3 w-36 text-left">
                  <div>Fecha Ingreso</div>
                  <div class="text-[9px] font-medium text-text-secondary mt-0.5 normal-case tracking-normal">Plazo Respuesta</div>
                </th>
                <th class="px-2 py-3 w-36 text-left">
                  <div>Fecha Agenda</div>
                  <div class="text-[9px] font-medium text-text-secondary mt-0.5 normal-case tracking-normal">Plazo Publicación</div>
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
          ${renderPaginationControls("reportes", totalItems, currentPage, pageSize)}
        </div>
      </div>
    </div>
  `;

  if (window.actualizarBadgeCorrelativo) {
    window.actualizarBadgeCorrelativo();
  }
  if (window.lucide) window.lucide.createIcons();
}

export function generateLocalReportCode() {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `RAP${yy}${mm}${dd}`;
}

export function buildReportPDFHtml({ processedData, filtersSnapshot, sujetoPasivoNombre, sujetoPasivoCargo, codigoReporte = '' }) {
  const isOverdueItem = (item) => {
    const mainCode = (item.plazo || '').split(' ')[0].toUpperCase();
    return mainCode === 'FDP' || mainCode === 'RFP';
  };
  const isFdpItem = (item) => (item.plazo || '').split(' ')[0].toUpperCase() === 'FDP';
  const isDdpItem = (item) => (item.plazo || '').split(' ')[0].toUpperCase() === 'DDP';

  const totalItems = processedData.length;
  const overdueCount = processedData.filter(isFdpItem).length;
  const compliantCount = processedData.filter(isDdpItem).length;

  const countIngresada = processedData.filter(i => (i.estado || '').toLowerCase() === 'ingresada').length;
  const countAceptada = processedData.filter(i => (i.estado || '').toLowerCase() === 'aceptada').length;
  const countRechazada = processedData.filter(i => (i.estado || '').toLowerCase() === 'rechazada').length;
  const countPendientePub = processedData.filter(i => (i.estado || '').toLowerCase() === 'pendiente de publicación').length;
  const countSuspendida = processedData.filter(i => (i.estado || '').toLowerCase() === 'suspendida').length;
  const countCancelada = processedData.filter(i => (i.estado || '').toLowerCase() === 'cancelada').length;
  const countEncomendada = processedData.filter(i => (i.estado || '').toLowerCase() === 'encomendada').length;

  const rowsArray = processedData.map((item, idx) => {
    let stateColor = '#334155';
    let stateBg = '#f8fafc';
    let stateBorder = '#e2e8f0';
    const stateLower = (item.estado || '').toLowerCase();
    
    if (stateLower === 'ingresada') {
      stateColor = '#475569'; stateBg = '#f8fafc'; stateBorder = '#e2e8f0';
    } else if (stateLower === 'aceptada') {
      stateColor = '#0369a1'; stateBg = '#f0f9ff'; stateBorder = '#bae6fd';
    } else if (stateLower === 'pendiente de publicación') {
      stateColor = '#5b21b6'; stateBg = '#f5f3ff'; stateBorder = '#ddd6fe';
    } else if (stateLower === 'rechazada') {
      stateColor = '#be123c'; stateBg = '#fff1f2'; stateBorder = '#fecdd3';
    } else if (stateLower === 'suspendida') {
      stateColor = '#b45309'; stateBg = '#fef3c7'; stateBorder = '#fde68a';
    } else if (stateLower === 'cancelada') {
      stateColor = '#c2410c'; stateBg = '#fff7ed'; stateBorder = '#ffedd5';
    } else if (stateLower === 'encomendada') {
      stateColor = '#86198f'; stateBg = '#fdf4ff'; stateBorder = '#f5d0fe';
    }

    const isOverdue = isOverdueItem(item);
    const plazoColor = isOverdue ? '#be123c' : '#166534';
    const plazoBg   = isOverdue ? '#fff1f2' : '#f0fdf4';
    const plazoBorder = isOverdue ? '#fecdd3' : '#bbf7d0';

    const plazoStr = item.plazo || '';
    const hasDays = plazoStr.includes('(') && plazoStr.includes(')');
    let mainCode = plazoStr || '—';
    let days = '';
    if (hasDays) {
      const parts = plazoStr.split(' ');
      mainCode = parts[0] || '—';
      days = (parts[1] || '').replace(/[()]/g, '');
    }

    const showTwoLine = hasDays && (mainCode === 'FDP' || mainCode === 'RFP');
    const plazoBadgeHtml = showTwoLine
      ? `<span style="display: inline-block; padding: 3px 6px; border: 1px solid ${plazoBorder}; border-radius: 6px; font-size: 7px; font-weight: 800; color: ${plazoColor}; background: ${plazoBg}; text-align: center; min-width: 42px; line-height: 1.3; white-space: normal;">${mainCode}<br><span style="font-size: 6px; font-weight: 500;">${days}</span></span>`
      : `<span style="display: inline-block; padding: 3px 6px; border: 1px solid ${plazoBorder}; border-radius: 6px; font-size: 7px; font-weight: 800; color: ${plazoColor}; background: ${plazoBg}; text-align: center; min-width: 42px; line-height: 1.3; text-transform: uppercase; white-space: nowrap;">${mainCode}</span>`;

    const rowBg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';

    return `
      <tr style="border-bottom: 1px solid #e2e8f0; font-size: 7.5px; background: ${rowBg};">
        <td style="padding: 8px 10px; font-weight: 600; color: #64748b; border-bottom: 1px solid #e2e8f0;">${item.index}</td>
        <td style="padding: 8px 10px; font-weight: 700; color: #0f172a; font-family: monospace; border-bottom: 1px solid #e2e8f0;">${item.folio}</td>
        <td style="padding: 8px 10px; color: #1e293b; font-weight: 500; border-bottom: 1px solid #e2e8f0; line-height: 1.3;">${item.cargo}</td>
        <td style="padding: 8px 10px; color: #475569; border-bottom: 1px solid #e2e8f0; line-height: 1.3;">
          <div style="font-weight: 600; color: #334155;">${item.fechaIngreso}</div>
          ${item.fechaLimiteRespuesta ? `<div style="font-size: 6.5px; color: #94a3b8; margin-top: 1px;">${item.fechaLimiteRespuesta}</div>` : ''}
        </td>
        <td style="padding: 8px 10px; color: #475569; border-bottom: 1px solid #e2e8f0; line-height: 1.3;">
          <div style="font-weight: 600; color: #334155;">${item.fechaAgendada}</div>
          ${item.fechaLimitePublicacion ? `<div style="font-size: 6.5px; color: #94a3b8; margin-top: 1px;">${item.fechaLimitePublicacion}</div>` : ''}
        </td>
        <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0; vertical-align: middle;">
          ${item.estado === 'Pendiente de publicación'
            ? `<span style="display: inline-block; padding: 3px 6px; border: 1px solid ${stateBorder}; border-radius: 6px; font-size: 6.5px; font-weight: 700; color: ${stateColor}; background: ${stateBg}; text-align: center; line-height: 1.2;">PENDIENTE DE PUBLICACIÓN</span>`
            : `<span style="display: inline-block; padding: 3px 6px; border: 1px solid ${stateBorder}; border-radius: 6px; font-size: 6.5px; font-weight: 700; color: ${stateColor}; background: ${stateBg}; text-transform: uppercase; white-space: nowrap; line-height: 1.2;">${item.estado}</span>`
          }
        </td>
        <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0; vertical-align: middle;">
          ${plazoBadgeHtml}
        </td>
      </tr>
    `;
  });

  const normFn = typeof window.normalizeName === 'function' ? window.normalizeName : (n => n || '');
  const rfechas = `${filtersSnapshot.fechaInicio ? `Desde: ${filtersSnapshot.fechaInicio}` : ''} ${filtersSnapshot.fechaTermino ? `Hasta: ${filtersSnapshot.fechaTermino}` : ''}`;
  const rfechasStr = rfechas.trim() !== '' ? rfechas : 'Cualquier fecha';
  const generadoFechaHora = new Date().toLocaleString('es-CL', { timeZone: 'America/Santiago', hour12: false });
  const displayNombre = sujetoPasivoNombre || normFn(filtersSnapshot.nombre) || 'Todos los Sujetos Pasivos';
  const displayCargo = sujetoPasivoCargo || filtersSnapshot.cargo || 'Todos los Cargos';

  return `
    <style>
      @page {
        size: portrait;
        margin-top: 22mm;
        margin-bottom: 20mm;
        margin-left: 15mm;
        margin-right: 15mm;
        
        @top-left {
          content: "Reporte de Solicitudes de Audiencia (Ley N° 20.730 de Lobby) — Sujeto Pasivo: ${displayNombre}";
          font-family: 'Inter', sans-serif;
          font-size: 8px;
          font-weight: 800;
          color: #0f172a;
          padding-bottom: 6px;
          border-bottom: 1.5px solid #334155;
        }
        @top-right {
          content: "Generado el ${generadoFechaHora}";
          font-family: monospace;
          font-size: 7.5px;
          font-weight: 700;
          color: #64748b;
          padding-bottom: 6px;
          border-bottom: 1.5px solid #334155;
        }
        @bottom-right {
          content: "Página " counter(page) " de " counter(pages);
          font-family: monospace;
          font-size: 8.5px;
          font-weight: 700;
          color: #64748b;
        }
      }
      @page :first {
        margin-top: 15mm;
        @top-left { content: none; }
        @top-right { content: none; }
      }
    </style>
    <div style="font-family: 'Inter', sans-serif;">
      <div class="municipal-header-p1" style="border-bottom: 2px solid #334155; padding-bottom: 14px; margin-bottom: 16px;">
        <table style="width: 100%; border-collapse: collapse; border: none;">
          <tr>
            <td style="vertical-align: middle; text-align: left; border: none; padding: 0;">
              <table style="border-collapse: collapse; border: none;">
                <tr>
                  <td style="padding-right: 14px; vertical-align: middle; border: none;">
                    <img src="/logo_secum.png" style="height: 46px; max-height: 46px; width: auto; object-fit: contain; display: block;" />
                  </td>
                  <td style="vertical-align: middle; border: none;">
                    <div style="font-size: 14px; font-weight: 800; color: #0f172a; letter-spacing: -0.02em; line-height: 1.2;">Reporte de Solicitudes de Audiencia</div>
                    <div style="font-size: 9px; font-weight: 600; color: #64748b; margin-top: 2px; line-height: 1.2;">Audiencias registradas bajo la Ley N° 20.730 de Lobby</div>
                  </td>
                </tr>
              </table>
            </td>
            <td style="vertical-align: middle; text-align: right; border: none; padding: 0;">
              <div style="font-size: 9px; font-weight: 700; color: #475569; font-family: monospace;">${generadoFechaHora}</div>
            </td>
          </tr>
        </table>
      </div>

      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; margin-bottom: 15px; box-sizing: border-box; width: 100%;">
        <div style="font-size: 12px; font-weight: 800; color: #1e3a8a; text-transform: uppercase; letter-spacing: -0.01em;">Sujeto Pasivo: ${displayNombre}</div>
        <div style="font-size: 10px; font-weight: 700; color: #475569; margin-top: 2px; text-transform: uppercase; letter-spacing: -0.01em;">Cargo: ${displayCargo}</div>
        <table style="width: 100%; border-collapse: collapse; font-size: 8.5px; color: #475569; margin-top: 6px;">
          <tr>
            <td style="padding: 0; border: none; width: 50%;"><strong>Período:</strong> ${rfechasStr}</td>
            <td style="padding: 0; border: none; width: 50%;"><strong>Estados:</strong> ${filtersSnapshot.estados.length > 0 ? filtersSnapshot.estados.join(', ') : 'Todos'}</td>
          </tr>
        </table>
      </div>

      <table style="width: 100%; border-collapse: collapse; margin-bottom: 8px;">
        <tr>
          <td style="width: 33.3%; padding-right: 8px; border: none;">
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; text-align: left; box-sizing: border-box; position: relative; overflow: hidden;">
              <div style="font-size: 7.5px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.05em;">Total de Audiencias</div>
              <div style="font-size: 20px; font-weight: 800; color: #0f172a; margin-top: 2px;">${totalItems}</div>
              <div style="position: absolute; right: 10px; bottom: 4px; font-size: 20px; color: #cbd5e1; font-weight: 900; line-height: 1; user-select: none;">#</div>
            </div>
          </td>
          <td style="width: 33.3%; padding-left: 4px; padding-right: 4px; border: none;">
            <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 10px; text-align: left; box-sizing: border-box; position: relative; overflow: hidden;">
              <div style="font-size: 7.5px; font-weight: 700; color: #166534; text-transform: uppercase; letter-spacing: 0.05em;">Dentro de Plazo</div>
              <div style="font-size: 20px; font-weight: 800; color: #14532d; margin-top: 2px;">${compliantCount}</div>
              <div style="position: absolute; right: 10px; bottom: 4px; font-size: 20px; color: #bbf7d0; font-weight: 900; line-height: 1; user-select: none;">&#10003;</div>
            </div>
          </td>
          <td style="width: 33.3%; padding-left: 8px; border: none;">
            <div style="background: #fff1f2; border: 1px solid #fecdd3; border-radius: 8px; padding: 10px; text-align: left; box-sizing: border-box; position: relative; overflow: hidden;">
              <div style="font-size: 7.5px; font-weight: 700; color: #be123c; text-transform: uppercase; letter-spacing: 0.05em;">Fuera de Plazo</div>
              <div style="font-size: 20px; font-weight: 800; color: #9f1239; margin-top: 2px;">${overdueCount}</div>
              <div style="position: absolute; right: 10px; bottom: 4px; font-size: 20px; color: #fecdd3; font-weight: 900; line-height: 1; user-select: none;">!</div>
            </div>
          </td>
        </tr>
      </table>

      <table style="width: 100%; border-collapse: collapse; margin-bottom: 15px;">
        <tr>
          <td style="width: 14.28%; padding-right: 4px; border: none;">
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 6px 8px; box-sizing: border-box;">
              <div style="font-size: 6px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.03em;">Ingresadas</div>
              <div style="font-size: 14px; font-weight: 800; color: #334155; margin-top: 1px;">${countIngresada}</div>
            </div>
          </td>
          <td style="width: 14.28%; padding-right: 4px; border: none;">
            <div style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 6px 8px; box-sizing: border-box;">
              <div style="font-size: 6px; font-weight: 700; color: #0369a1; text-transform: uppercase; letter-spacing: 0.03em;">Aceptadas</div>
              <div style="font-size: 14px; font-weight: 800; color: #075985; margin-top: 1px;">${countAceptada}</div>
            </div>
          </td>
          <td style="width: 14.28%; padding-right: 4px; border: none;">
            <div style="background: #fff1f2; border: 1px solid #fecdd3; border-radius: 8px; padding: 6px 8px; box-sizing: border-box;">
              <div style="font-size: 6px; font-weight: 700; color: #be123c; text-transform: uppercase; letter-spacing: 0.03em;">Rechazadas</div>
              <div style="font-size: 14px; font-weight: 800; color: #9f1239; margin-top: 1px;">${countRechazada}</div>
            </div>
          </td>
          <td style="width: 14.28%; padding-right: 4px; border: none;">
            <div style="background: #f5f3ff; border: 1px solid #ddd6fe; border-radius: 8px; padding: 6px 8px; box-sizing: border-box;">
              <div style="font-size: 6px; font-weight: 700; color: #5b21b6; text-transform: uppercase; letter-spacing: 0.03em;">Pend. Pub.</div>
              <div style="font-size: 14px; font-weight: 800; color: #4c1d95; margin-top: 1px;">${countPendientePub}</div>
            </div>
          </td>
          <td style="width: 14.28%; padding-right: 4px; border: none;">
            <div style="background: #fef3c7; border: 1px solid #fde68a; border-radius: 8px; padding: 6px 8px; box-sizing: border-box;">
              <div style="font-size: 6px; font-weight: 700; color: #b45309; text-transform: uppercase; letter-spacing: 0.03em;">Suspendidas</div>
              <div style="font-size: 14px; font-weight: 800; color: #92400e; margin-top: 1px;">${countSuspendida}</div>
            </div>
          </td>
          <td style="width: 14.28%; padding-right: 4px; border: none;">
            <div style="background: #fff7ed; border: 1px solid #ffedd5; border-radius: 8px; padding: 6px 8px; box-sizing: border-box;">
              <div style="font-size: 6px; font-weight: 700; color: #c2410c; text-transform: uppercase; letter-spacing: 0.03em;">Canceladas</div>
              <div style="font-size: 14px; font-weight: 800; color: #9a3412; margin-top: 1px;">${countCancelada}</div>
            </div>
          </td>
          <td style="width: 14.28%; border: none;">
            <div style="background: #fdf4ff; border: 1px solid #f5d0fe; border-radius: 8px; padding: 6px 8px; box-sizing: border-box;">
              <div style="font-size: 6px; font-weight: 700; color: #86198f; text-transform: uppercase; letter-spacing: 0.03em;">Encomend.</div>
              <div style="font-size: 14px; font-weight: 800; color: #701a75; margin-top: 1px;">${countEncomendada}</div>
            </div>
          </td>
        </tr>
      </table>

      <div style="border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; background: white; width: 100%;">
        <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 7.5px;">
          <thead>
            <tr style="background: #f8fafc; border-bottom: 1px solid #e2e8f0; color: #475569; font-weight: 700; font-size: 7.5px;">
              <th style="padding: 10px; width: 30px; border-bottom: 1px solid #e2e8f0;">#</th>
              <th style="padding: 10px; width: 95px; border-bottom: 1px solid #e2e8f0;">Folio</th>
              <th style="padding: 10px; border-bottom: 1px solid #e2e8f0;">Cargo</th>
              <th style="padding: 10px; width: 110px; border-bottom: 1px solid #e2e8f0; vertical-align: bottom;">
                <div style="font-size: 7.5px; font-weight: 800; color: #0f172a; text-transform: uppercase;">Fecha Ingreso</div>
                <div style="font-size: 6.5px; font-weight: 500; color: #64748b; margin-top: 1px; text-transform: uppercase;">Plazo Respuesta</div>
              </th>
              <th style="padding: 10px; width: 110px; border-bottom: 1px solid #e2e8f0; vertical-align: bottom;">
                <div style="font-size: 7.5px; font-weight: 800; color: #0f172a; text-transform: uppercase;">Fecha Agenda</div>
                <div style="font-size: 6.5px; font-weight: 500; color: #64748b; margin-top: 1px; text-transform: uppercase;">Plazo Publicación</div>
              </th>
              <th style="padding: 10px; width: 100px; border-bottom: 1px solid #e2e8f0;">Estado</th>
              <th style="padding: 10px; width: 75px; border-bottom: 1px solid #e2e8f0;">Plazo / Retraso</th>
            </tr>
          </thead>
          <tbody>
            ${rowsArray.join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

export async function exportReportToPDF() {
  const dStore = window.dataStore || {};
  const rFilters = window.reportesFilters || {};
  const showToast = window.showToast || console.log;

  if (!dStore.reportesRawData || dStore.reportesRawData.length === 0) {
    showToast('No hay datos para exportar.', 'error');
    return;
  }

  showToast('Preparando vista de impresión...');

  let codigoReporte = generateLocalReportCode();
  try {
    const resCorrelativo = await fetch('/api/reportes/correlativo/consumir', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cantidad: 1 })
    });
    if (resCorrelativo.ok) {
      const d = await resCorrelativo.json();
      const firstCode = d?.firstCode || d?.data?.firstCode || (d?.codes ? d.codes[0] : (d?.data?.codes ? d.data.codes[0] : null));
      if (firstCode) {
        codigoReporte = firstCode;
      }
    }
  } catch (e) {
    console.warn('Error al consumir correlativo para PDF:', e);
  }
  const filtersSnapshot = {
    nombre: rFilters.nombre || '',
    cargo: rFilters.cargo || '',
    fechaInicio: rFilters.fechaInicio || '',
    fechaTermino: rFilters.fechaTermino || '',
    estados: [...(rFilters.estados || [])],
    vigencia: rFilters.vigencia || 'todos',
    soloVigentes: !!rFilters.soloVigentes
  };

  try {
    const procFn = typeof window.processReportData === 'function' ? window.processReportData : (d => d || []);
    const processedData = procFn(dStore.reportesRawData, filtersSnapshot);
    if (processedData.length === 0) {
      showToast('No hay registros coincidentes para exportar.', 'error');
      return;
    }

    const htmlContent = buildReportPDFHtml({ processedData, filtersSnapshot, codigoReporte });
    const getCargoAbbrFn = typeof window.getCargoAbbreviated === 'function' ? window.getCargoAbbreviated : (c => c || '');
    const sanitizeNameFn = typeof window.sanitizeNombreForFilename === 'function' ? window.sanitizeNombreForFilename : (n => n || '');

    const cargoAbbr = getCargoAbbrFn(filtersSnapshot.cargo || 'TODOS');
    const displayTitleName = (filtersSnapshot.nombre && filtersSnapshot.nombre.trim() !== '') ? filtersSnapshot.nombre : 'Reporte General';
    const sanitizedNombre = sanitizeNameFn(displayTitleName);
    const defaultName = `${codigoReporte}_${cargoAbbr}_${sanitizedNombre}.pdf`;

    const saveResult = await window.api.selectSavePath({ defaultName });
    if (saveResult.cancelled || !saveResult.filePath) {
      showToast('Guardado de reporte cancelado.', 'info');
      return;
    }

    showToast('Generando reporte PDF...');
    const silentResult = await window.api.generateSilentPdf({
      html: htmlContent,
      filePath: saveResult.filePath,
      title: `${codigoReporte} - ${displayTitleName}`
    });

    if (silentResult && silentResult.success) {
      showToast(`Reporte ${codigoReporte} guardado correctamente.`, 'success');
      if (window.actualizarBadgeCorrelativo) window.actualizarBadgeCorrelativo();
      window.api.invokeRoute({
        url: '/api/log',
        method: 'POST',
        body: {
          code: 'INFO-REP-501',
          message: 'Reporte PDF generado (Individual)',
          details: `Archivo: ${defaultName} | Destino: ${saveResult.filePath} | Por: ${window.currentUser ? window.currentUser.correo : 'Desconocido'}`,
          severity: 'info'
        }
      }).catch(err => console.error('Error al registrar log de reporte:', err));
    } else {
      showToast('No se pudo generar el archivo PDF.', 'error');
    }
  } catch (err) {
    console.error('Error al exportar reporte a PDF:', err);
    showToast('Error al generar el reporte PDF.', 'error');
  }
}

export async function exportReportToExcel() {
  const dStore = window.dataStore || {};
  const rFilters = window.reportesFilters || {};
  const showToast = window.showToast || console.log;

  if (!dStore.reportesRawData || dStore.reportesRawData.length === 0) {
    showToast('No hay datos para exportar.', 'error');
    return;
  }

  showToast('Generando planilla Excel...');

  const filtersSnapshot = {
    nombre: rFilters.nombre || '',
    cargo: rFilters.cargo || '',
    fechaInicio: rFilters.fechaInicio || '',
    fechaTermino: rFilters.fechaTermino || '',
    estados: [...(rFilters.estados || [])],
    vigencia: rFilters.vigencia || 'todos',
    soloVigentes: !!rFilters.soloVigentes
  };

  const procFn = typeof window.processReportData === 'function' ? window.processReportData : (d => d || []);
  const processedData = procFn(dStore.reportesRawData, filtersSnapshot);
  if (processedData.length === 0) {
    showToast('No hay registros coincidentes para exportar.', 'error');
    return;
  }

  const dateFormatted = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const hasSpecificNombre = filtersSnapshot.nombre && filtersSnapshot.nombre.toUpperCase() !== 'TODOS' && filtersSnapshot.nombre.trim() !== '';
  const sanitizeNameFn = typeof window.sanitizeNombreForFilename === 'function' ? window.sanitizeNombreForFilename : (n => n || '');
  const normFn = typeof window.normalizeName === 'function' ? window.normalizeName : (n => n || '');

  const sanitizedNombre = hasSpecificNombre ? sanitizeNameFn(filtersSnapshot.nombre) : '';
  const fileName = sanitizedNombre
    ? `MU163-RAP${dateFormatted}_${sanitizedNombre}.xlsx`
    : `MU163-RAP${dateFormatted}.xlsx`;

  const excelData = processedData.map((item) => {
    const isFdp = (item.plazo || '').split(' ')[0].toUpperCase() === 'FDP' || (item.plazo || '').toLowerCase().includes('fuera');
    const plazoText = (!item.plazo || item.plazo === '---') ? '---' : (isFdp ? 'Fuera de plazo' : 'En plazo');

    return {
      '# Correlativo': item.index,
      'Folio Lobby': item.folio,
      'Fecha Ingreso': item.fechaIngreso,
      'Fecha Agendada': item.fechaAgendada || '---',
      'Sujeto Pasivo': item.sujetoPasivo || normFn(filtersSnapshot.nombre) || '---',
      'Cargo': item.cargo,
      'Sujeto Activo / Gestor de Interés': item.sujetoActivo || '---',
      'Representado': item.representado || '---',
      'Materia': item.materia || '---',
      'Especificación de Materia': item.especificacionMateria || '---',
      'Estado': item.estado,
      'Plazo': plazoText
    };
  });

  try {
    const saveResult = await window.api.selectSavePath({
      title: 'Guardar Planilla Excel',
      defaultName: fileName,
      filters: [{ name: 'Planilla Excel', extensions: ['xlsx'] }]
    });

    if (saveResult.cancelled || !saveResult.filePath) {
      showToast('Guardado de Excel cancelado.', 'info');
      return;
    }

    const exportResult = await window.api.generateExcelFile({
      data: excelData,
      sheetName: 'Reporte Lobby',
      filePath: saveResult.filePath
    });

    if (exportResult && exportResult.success) {
      showToast(`Planilla Excel guardada exitosamente: ${fileName}`, 'success');

      window.api.invokeRoute({
        url: '/api/log',
        method: 'POST',
        body: {
          code: 'INFO-REP-502',
          message: 'Reporte Excel generado',
          details: `Archivo: ${fileName} | Destino: ${saveResult.filePath} | Por: ${window.currentUser ? window.currentUser.correo : 'Desconocido'}`,
          severity: 'info'
        }
      }).catch(err => console.error('Error al registrar log de Excel:', err));
    } else {
      showToast(`No se pudo generar la planilla Excel: ${exportResult ? exportResult.error : 'Error desconocido'}`, 'error');
    }
  } catch (err) {
    console.error('Error al exportar a Excel:', err);
    showToast(`Error al procesar exportación a Excel: ${err.message}`, 'error');
  }
}

export async function exportReporteEjecutivoPDF() {
  const dStore = window.dataStore || {};
  const rFilters = window.reportesFilters || {};
  const showToast = window.showToast || console.log;

  if (!dStore.reportesRawData || dStore.reportesRawData.length === 0) {
    showToast('No hay datos para exportar.', 'error');
    return;
  }

  showToast('Generando Reporte Ejecutivo PDF...');

  const filtersSnapshot = {
    nombre: rFilters.nombre || '',
    cargo: rFilters.cargo || '',
    fechaInicio: rFilters.fechaInicio || '',
    fechaTermino: rFilters.fechaTermino || '',
    estados: [...(rFilters.estados || [])],
    vigencia: rFilters.vigencia || 'todos',
    soloVigentes: !!rFilters.soloVigentes
  };

  const procFn = typeof window.processReportData === 'function' ? window.processReportData : (d => d || []);
  const processedData = procFn(dStore.reportesRawData, filtersSnapshot);
  if (processedData.length === 0) {
    showToast('No hay registros coincidentes para exportar.', 'error');
    return;
  }

  const isFdpItem = (item) => (item.plazo || '').split(' ')[0].toUpperCase() === 'FDP';
  const isDdpItem = (item) => (item.plazo || '').split(' ')[0].toUpperCase() === 'DDP';

  const totalItems = processedData.length;
  const compliantCount = processedData.filter(isDdpItem).length;
  const overdueCount = processedData.filter(isFdpItem).length;

  const publicadasArray = Array.isArray(dStore.publicadas) ? dStore.publicadas : (dStore.publicadas?.data || []);
  const publicadosFolios = new Set(publicadasArray.map(p => p.folio_lobby).filter(Boolean));
  const publicadasCount = processedData.filter(i => publicadosFolios.has(i.folio_lobby)).length;

  const compliantPercent = totalItems > 0 ? ((compliantCount / totalItems) * 100).toFixed(1) : '0.0';
  const overduePercent = totalItems > 0 ? ((overdueCount / totalItems) * 100).toFixed(1) : '0.0';

  const sujetoGroups = {};
  processedData.forEach(item => {
    const name = (item.sujetoPasivo || item.sujeto_pasivo || 'Sin Nombre').trim();
    const cargo = (item.cargo || 'Sin Cargo').trim();
    const key = `${name}|||${cargo}`;
    if (!sujetoGroups[key]) {
      sujetoGroups[key] = {
        name,
        cargo,
        total: 0,
        ingresada: 0,
        aceptada: 0,
        rechazada: 0,
        suspendida: 0,
        cancelada: 0,
        encomendada: 0,
        pendientePub: 0,
        enPlazo: 0,
        fueraPlazo: 0
      };
    }

    const g = sujetoGroups[key];
    g.total += 1;

    const estLower = (item.estado || '').toLowerCase();
    if (estLower === 'ingresada') g.ingresada += 1;
    else if (estLower === 'aceptada') g.aceptada += 1;
    else if (estLower === 'rechazada') g.rechazada += 1;
    else if (estLower === 'suspendida') g.suspendida += 1;
    else if (estLower === 'cancelada') g.cancelada += 1;
    else if (estLower === 'encomendada') g.encomendada += 1;
    else if (estLower === 'pendiente de publicación') g.pendientePub += 1;

    if (isFdpItem(item)) g.fueraPlazo += 1;
    else g.enPlazo += 1;
  });

  const getCargoAbbrFn = typeof window.getCargoAbbreviated === 'function' ? window.getCargoAbbreviated : (c => c || '');
  const cargoPriorityOrder = ['ALC', 'CON', 'DOM', 'SECMUN', 'CE'];
  const sortedKeys = Object.keys(sujetoGroups).sort((keyA, keyB) => {
    const [nameA, cargoA] = keyA.split('|||');
    const [nameB, cargoB] = keyB.split('|||');

    const codeA = getCargoAbbrFn(cargoA);
    const codeB = getCargoAbbrFn(cargoB);

    const idxA = cargoPriorityOrder.indexOf(codeA);
    const idxB = cargoPriorityOrder.indexOf(codeB);

    const prioA = idxA !== -1 ? idxA : 999;
    const prioB = idxB !== -1 ? idxB : 999;

    if (prioA !== prioB) return prioA - prioB;
    if (codeA !== codeB) return codeA.localeCompare(codeB);
    return nameA.localeCompare(nameB);
  });

  let sumTotal = 0, sumIng = 0, sumAcep = 0, sumRech = 0, sumSusp = 0, sumCanc = 0, sumEnc = 0, sumPend = 0, sumDdp = 0, sumFdp = 0;

  const tableRowsHtml = sortedKeys.map((key, idx) => {
    const g = sujetoGroups[key];
    sumTotal += g.total;
    sumIng += g.ingresada;
    sumAcep += g.aceptada;
    sumRech += g.rechazada;
    sumSusp += g.suspendida;
    sumCanc += g.cancelada;
    sumEnc += g.encomendada;
    sumPend += g.pendientePub;
    sumDdp += g.enPlazo;
    sumFdp += g.fueraPlazo;

    const rowBg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
    const code = getCargoAbbrFn(g.cargo);

    return `
      <tr style="border-bottom: 1px solid #e2e8f0; font-size: 7.5px; background: ${rowBg};">
        <td style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0; vertical-align: middle;">
          <div style="font-size: 7.5px; font-weight: 700; color: #0f172a; line-height: 1.2;">${g.name}</div>
          <div style="font-size: 6.5px; font-weight: 600; color: #475569; margin-top: 1.5px; line-height: 1.2;">
            ${g.cargo} <span style="font-size: 6px; font-weight: 700; color: #64748b; background: #e2e8f0; padding: 1px 4px; border-radius: 3px; margin-left: 2px;">${code}</span>
          </div>
        </td>
        <td style="padding: 7px 8px; font-weight: 800; color: #0f172a; text-align: center; border-bottom: 1px solid #e2e8f0;">${g.total}</td>
        <td style="padding: 7px 8px; color: #475569; text-align: center; border-bottom: 1px solid #e2e8f0;">${g.ingresada}</td>
        <td style="padding: 7px 8px; color: #075985; text-align: center; border-bottom: 1px solid #e2e8f0;">${g.aceptada}</td>
        <td style="padding: 7px 8px; color: #be123c; text-align: center; border-bottom: 1px solid #e2e8f0;">${g.rechazada}</td>
        <td style="padding: 7px 8px; color: #b45309; text-align: center; border-bottom: 1px solid #e2e8f0;">${g.suspendida}</td>
        <td style="padding: 7px 8px; color: #c2410c; text-align: center; border-bottom: 1px solid #e2e8f0;">${g.cancelada}</td>
        <td style="padding: 7px 8px; color: #86198f; text-align: center; border-bottom: 1px solid #e2e8f0;">${g.encomendada}</td>
        <td style="padding: 7px 8px; color: #5b21b6; text-align: center; border-bottom: 1px solid #e2e8f0;">${g.pendientePub}</td>
        <td style="padding: 7px 8px; font-weight: 700; color: #166534; text-align: center; border-bottom: 1px solid #e2e8f0; background: #f0fdf4;">${g.enPlazo}</td>
        <td style="padding: 7px 8px; font-weight: 700; color: #be123c; text-align: center; border-bottom: 1px solid #e2e8f0; background: #fff1f2;">${g.fueraPlazo}</td>
      </tr>
    `;
  }).join('');

  const rfechas = `${filtersSnapshot.fechaInicio ? `Desde: ${filtersSnapshot.fechaInicio}` : ''} ${filtersSnapshot.fechaTermino ? `Hasta: ${filtersSnapshot.fechaTermino}` : ''}`;
  const rfechasStr = rfechas.trim() !== '' ? rfechas : 'Cualquier fecha';
  const generadoFechaHora = new Date().toLocaleString('es-CL', { timeZone: 'America/Santiago' });

  const htmlContent = `
    <style>
      @page {
        size: portrait;
        margin-top: 20mm;
        margin-bottom: 18mm;
        margin-left: 15mm;
        margin-right: 15mm;
        
        @top-left {
          content: "Reporte de Solicitudes de Audiencia (Ley N° 20.730 de Lobby) — Municipalidad de Maipú";
          font-family: 'Inter', sans-serif;
          font-size: 8px;
          font-weight: 800;
          color: #0f172a;
          padding-bottom: 6px;
          border-bottom: 1.5px solid #334155;
        }
        @top-right {
          content: "Generado el ${generadoFechaHora}";
          font-family: monospace;
          font-size: 7.5px;
          font-weight: 700;
          color: #64748b;
          padding-bottom: 6px;
          border-bottom: 1.5px solid #334155;
        }
        @bottom-right {
          content: "Página " counter(page) " de " counter(pages);
          font-family: monospace;
          font-size: 8.5px;
          font-weight: 700;
          color: #64748b;
        }
      }
      @page :first {
        margin-top: 14mm;
        @top-left { content: none; }
        @top-right { content: none; }
      }
    </style>
    <div style="font-family: 'Inter', sans-serif;">
      <div class="municipal-header-p1" style="border-bottom: 2px solid #334155; padding-bottom: 14px; margin-bottom: 16px;">
        <table style="width: 100%; border-collapse: collapse; border: none;">
          <tr>
            <td style="vertical-align: middle; text-align: left; border: none; padding: 0;">
              <table style="border-collapse: collapse; border: none;">
                <tr>
                  <td style="padding-right: 14px; vertical-align: middle; border: none;">
                    <img src="/logo_secum.png" style="height: 46px; max-height: 46px; width: auto; object-fit: contain; display: block;" />
                  </td>
                  <td style="vertical-align: middle; border: none;">
                    <div style="font-size: 14px; font-weight: 800; color: #0f172a; letter-spacing: -0.02em; line-height: 1.2;">Reporte de Solicitudes de Audiencia</div>
                    <div style="font-size: 9px; font-weight: 600; color: #64748b; margin-top: 2px; line-height: 1.2;">Audiencias registradas bajo la Ley N° 20.730 de Lobby</div>
                  </td>
                </tr>
              </table>
            </td>
            <td style="vertical-align: middle; text-align: right; border: none; padding: 0;">
              <div style="font-size: 9px; font-weight: 700; color: #475569; font-family: monospace;">${generadoFechaHora}</div>
            </td>
          </tr>
        </table>
      </div>

      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; margin-bottom: 12px; box-sizing: border-box; width: 100%;">
        <div style="font-size: 11px; font-weight: 800; color: #1e3a8a; text-transform: uppercase;">Período Evaluado: ${rfechasStr}</div>
        <div style="font-size: 8.5px; color: #475569; margin-top: 2px;">Filtros: ${filtersSnapshot.nombre ? `Sujeto: ${filtersSnapshot.nombre} | ` : ''}${filtersSnapshot.cargo ? `Cargo: ${filtersSnapshot.cargo} | ` : ''}Estados: ${filtersSnapshot.estados.length > 0 ? filtersSnapshot.estados.join(', ') : 'Todos'}</div>
      </div>

      <table style="width: 100%; border-collapse: collapse; margin-bottom: 12px;">
        <tr>
          <td style="width: 25%; padding-right: 6px; border: none;">
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 10px; text-align: left;">
              <div style="font-size: 7px; font-weight: 700; color: #475569; text-transform: uppercase;">Total Solicitudes</div>
              <div style="font-size: 18px; font-weight: 800; color: #0f172a; margin-top: 1px;">${totalItems}</div>
            </div>
          </td>
          <td style="width: 25%; padding-right: 6px; border: none;">
            <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 8px 10px; text-align: left;">
              <div style="font-size: 7px; font-weight: 700; color: #166534; text-transform: uppercase;">En Plazo Legal</div>
              <div style="font-size: 18px; font-weight: 800; color: #14532d; margin-top: 1px;">${compliantCount} <span style="font-size: 9px; font-weight: 600;">(${compliantPercent}%)</span></div>
            </div>
          </td>
          <td style="width: 25%; padding-right: 6px; border: none;">
            <div style="background: #fff1f2; border: 1px solid #fecdd3; border-radius: 8px; padding: 8px 10px; text-align: left;">
              <div style="font-size: 7px; font-weight: 700; color: #be123c; text-transform: uppercase;">Fuera de Plazo</div>
              <div style="font-size: 18px; font-weight: 800; color: #9f1239; margin-top: 1px;">${overdueCount} <span style="font-size: 9px; font-weight: 600;">(${overduePercent}%)</span></div>
            </div>
          </td>
          <td style="width: 25%; border: none;">
            <div style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 8px 10px; text-align: left;">
              <div style="font-size: 7px; font-weight: 700; color: #0369a1; text-transform: uppercase;">Audiencias Publicadas</div>
              <div style="font-size: 18px; font-weight: 800; color: #075985; margin-top: 1px;">${publicadasCount}</div>
            </div>
          </td>
        </tr>
      </table>

      <div style="font-size: 8.5px; font-weight: 800; color: #0f172a; text-transform: uppercase; margin-bottom: 6px;">Totales Municipales por Estado de Solicitud</div>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 12px;">
        <tr>
          <td style="width: 14.28%; padding-right: 3px; border: none;">
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 6px 4px; text-align: center;">
              <div style="font-size: 6.5px; font-weight: 700; color: #475569; text-transform: uppercase;">Ingresadas</div>
              <div style="font-size: 14px; font-weight: 800; color: #0f172a; margin-top: 1px;">${sumIng}</div>
            </div>
          </td>
          <td style="width: 14.28%; padding-left: 2px; padding-right: 3px; border: none;">
            <div style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 6px; padding: 6px 4px; text-align: center;">
              <div style="font-size: 6.5px; font-weight: 700; color: #0369a1; text-transform: uppercase;">Aceptadas</div>
              <div style="font-size: 14px; font-weight: 800; color: #075985; margin-top: 1px;">${sumAcep}</div>
            </div>
          </td>
          <td style="width: 14.28%; padding-left: 2px; padding-right: 3px; border: none;">
            <div style="background: #fff1f2; border: 1px solid #fecdd3; border-radius: 6px; padding: 6px 4px; text-align: center;">
              <div style="font-size: 6.5px; font-weight: 700; color: #be123c; text-transform: uppercase;">Rechazadas</div>
              <div style="font-size: 14px; font-weight: 800; color: #9f1239; margin-top: 1px;">${sumRech}</div>
            </div>
          </td>
          <td style="width: 14.28%; padding-left: 2px; padding-right: 3px; border: none;">
            <div style="background: #f5f3ff; border: 1px solid #ddd6fe; border-radius: 6px; padding: 6px 4px; text-align: center;">
              <div style="font-size: 6.5px; font-weight: 700; color: #6d28d9; text-transform: uppercase;">Pend. Pub.</div>
              <div style="font-size: 14px; font-weight: 800; color: #5b21b6; margin-top: 1px;">${sumPend}</div>
            </div>
          </td>
          <td style="width: 14.28%; padding-left: 2px; padding-right: 3px; border: none;">
            <div style="background: #fffbeb; border: 1px solid #fef3c7; border-radius: 6px; padding: 6px 4px; text-align: center;">
              <div style="font-size: 6.5px; font-weight: 700; color: #b45309; text-transform: uppercase;">Suspendidas</div>
              <div style="font-size: 14px; font-weight: 800; color: #92400e; margin-top: 1px;">${sumSusp}</div>
            </div>
          </td>
          <td style="width: 14.28%; padding-left: 2px; padding-right: 3px; border: none;">
            <div style="background: #fff7ed; border: 1px solid #ffedd5; border-radius: 6px; padding: 6px 4px; text-align: center;">
              <div style="font-size: 6.5px; font-weight: 700; color: #c2410c; text-transform: uppercase;">Canceladas</div>
              <div style="font-size: 14px; font-weight: 800; color: #9a3412; margin-top: 1px;">${sumCanc}</div>
            </div>
          </td>
          <td style="width: 14.28%; padding-left: 2px; border: none;">
            <div style="background: #fdf4ff; border: 1px solid #f5d0fe; border-radius: 6px; padding: 6px 4px; text-align: center;">
              <div style="font-size: 6.5px; font-weight: 700; color: #86198f; text-transform: uppercase;">Encomendadas</div>
              <div style="font-size: 14px; font-weight: 800; color: #701a75; margin-top: 1px;">${sumEnc}</div>
            </div>
          </td>
        </tr>
      </table>

      <div style="font-size: 8.5px; font-weight: 800; color: #0f172a; text-transform: uppercase; margin-bottom: 6px;">Resumen por Sujeto Pasivo</div>
      <div style="border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; background: white; width: 100%;">
        <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 7.5px;">
          <thead>
            <tr style="background: #f8fafc; border-bottom: 1px solid #e2e8f0; color: #475569; font-weight: 700; font-size: 7px; text-transform: uppercase;">
              <th style="padding: 8px; border-bottom: 1px solid #e2e8f0;">Sujeto Pasivo (Nombre y Cargo)</th>
              <th style="padding: 8px; width: 35px; text-align: center; border-bottom: 1px solid #e2e8f0;">Total</th>
              <th style="padding: 8px; width: 35px; text-align: center; border-bottom: 1px solid #e2e8f0;">Ing.</th>
              <th style="padding: 8px; width: 35px; text-align: center; border-bottom: 1px solid #e2e8f0;">Acep.</th>
              <th style="padding: 8px; width: 35px; text-align: center; border-bottom: 1px solid #e2e8f0;">Rech.</th>
              <th style="padding: 8px; width: 35px; text-align: center; border-bottom: 1px solid #e2e8f0;">Susp.</th>
              <th style="padding: 8px; width: 35px; text-align: center; border-bottom: 1px solid #e2e8f0;">Canc.</th>
              <th style="padding: 8px; width: 35px; text-align: center; border-bottom: 1px solid #e2e8f0;">Enc.</th>
              <th style="padding: 8px; width: 45px; text-align: center; border-bottom: 1px solid #e2e8f0;">Pend.Pub.</th>
              <th style="padding: 8px; width: 40px; text-align: center; border-bottom: 1px solid #e2e8f0; background: #f0fdf4;">En Plazo</th>
              <th style="padding: 8px; width: 40px; text-align: center; border-bottom: 1px solid #e2e8f0; background: #fff1f2;">Fuera Plazo</th>
            </tr>
          </thead>
          <tbody>
            ${tableRowsHtml}
            <tr style="background: #0f172a; color: white; font-weight: 800; font-size: 7.5px; page-break-inside: avoid;">
              <td style="padding: 8px;">TOTALES MUNICIPALES CONSOLIDADOS</td>
              <td style="padding: 8px; text-align: center;">${sumTotal}</td>
              <td style="padding: 8px; text-align: center;">${sumIng}</td>
              <td style="padding: 8px; text-align: center;">${sumAcep}</td>
              <td style="padding: 8px; text-align: center;">${sumRech}</td>
              <td style="padding: 8px; text-align: center;">${sumSusp}</td>
              <td style="padding: 8px; text-align: center;">${sumCanc}</td>
              <td style="padding: 8px; text-align: center;">${sumEnc}</td>
              <td style="padding: 8px; text-align: center;">${sumPend}</td>
              <td style="padding: 8px; text-align: center; background: #166534;">${sumDdp}</td>
              <td style="padding: 8px; text-align: center; background: #be123c;">${sumFdp}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  const dateFormatted = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const defaultName = `MU163-RAPEJECUTIVO_${dateFormatted}.pdf`;

  const saveResult = await window.api.selectSavePath({ defaultName });
  if (saveResult.cancelled || !saveResult.filePath) {
    showToast('Guardado de Reporte Ejecutivo cancelado.', 'info');
    return;
  }

  showToast('Generando Reporte Ejecutivo PDF...');
  const silentResult = await window.api.generateSilentPdf({
    html: htmlContent,
    filePath: saveResult.filePath,
    title: 'Reporte de Solicitudes de Audiencia — Resumen General'
  });

  if (silentResult && silentResult.success) {
    showToast(`Reporte Ejecutivo PDF guardado correctamente.`, 'success');
    window.api.invokeRoute({
      url: '/api/log',
      method: 'POST',
      body: {
        code: 'INFO-REP-503',
        message: 'Reporte Ejecutivo PDF generado',
        details: `Archivo: ${defaultName} | Destino: ${saveResult.filePath} | Por: ${window.currentUser ? window.currentUser.correo : 'Desconocido'}`,
        severity: 'info'
      }
    }).catch(err => console.error('Error al registrar log:', err));
  } else {
    showToast('No se pudo generar el Reporte Ejecutivo PDF.', 'error');
  }
}

export async function actualizarBadgeCorrelativo() {
  try {
    const res = await fetch('/api/reportes/correlativo');
    if (!res.ok) return;
    const json = await res.json();
    const currentNum = json?.current ?? json?.data?.current ?? json?.valor ?? 1;
    const badge = document.getElementById('badge-proximo-correlativo');
    if (badge) {
      badge.textContent = String(currentNum).padStart(3, '0');
    }
  } catch (e) {
    console.warn('Error al obtener correlativo:', e);
  }
}

export async function abrirModalConfigurarCorrelativo() {
  let currentVal = 1;
  try {
    const res = await fetch('/api/reportes/correlativo');
    if (res.ok) {
      const json = await res.json();
      currentVal = json?.current ?? json?.data?.current ?? json?.valor ?? 1;
    }
  } catch (e) {
    console.warn('Error al consultar correlativo:', e);
  }

  const modalHtml = `
    <div id="modal-correlativo-backdrop" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
      <div class="glass-card rounded-2xl border border-border-ui shadow-2xl p-6 w-full max-w-sm space-y-4">
        <div class="flex items-center justify-between border-b border-border-ui pb-3">
          <h3 class="text-sm font-bold text-text-primary flex items-center gap-2">
            <i data-lucide="hash" class="h-4 w-4 text-brand-500"></i>
            Configurar Próximo Folio RAP
          </h3>
          <button onclick="document.getElementById('modal-correlativo-backdrop').remove()" title="Cerrar modal" aria-label="Cerrar modal" class="text-text-tertiary hover:text-text-primary p-1 rounded-lg cursor-pointer">
            <i data-lucide="x" class="h-4 w-4"></i>
          </button>
        </div>
        <p class="text-xs text-text-secondary">
          Establezca el número correlativo que se asignará al siguiente reporte generado:
        </p>
        <div class="space-y-1">
          <label for="input-nuevo-correlativo" class="text-[10px] font-bold text-text-tertiary uppercase">Número Correlativo</label>
          <input type="number" id="input-nuevo-correlativo" aria-label="Número Correlativo" min="1" step="1" value="${currentVal}" class="w-full px-3 py-2 rounded-xl text-sm font-mono font-bold glass-input text-text-primary">
        </div>
        <div class="flex justify-end gap-2 pt-2">
          <button onclick="document.getElementById('modal-correlativo-backdrop').remove()" class="px-3 py-1.5 text-xs font-semibold rounded-xl border border-border-ui text-text-secondary hover:bg-border-ui cursor-pointer">Cancelar</button>
          <button onclick="guardarNuevoCorrelativo()" class="px-4 py-1.5 text-xs font-bold rounded-xl bg-brand-600 hover:bg-brand-500 text-white shadow-sm cursor-pointer">Guardar</button>
        </div>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', modalHtml);
  if (window.lucide) window.lucide.createIcons();
}

export async function guardarNuevoCorrelativo() {
  const showToast = window.showToast || console.log;
  const input = document.getElementById('input-nuevo-correlativo');
  if (!input) return;
  const val = parseInt(input.value, 10);
  if (isNaN(val) || val < 1) {
    showToast('Ingrese un número correlativo válido mayor o igual a 1.', 'error');
    return;
  }
  try {
    const res = await fetch('/api/reportes/correlativo/set', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ valor: val })
    });
    if (!res.ok) throw new Error('Error al guardar correlativo');
    showToast(`Próximo folio RAP actualizado a: ${String(val).padStart(3, '0')}`, 'success');
    const modal = document.getElementById('modal-correlativo-backdrop');
    if (modal) modal.remove();
    if (window.actualizarBadgeCorrelativo) window.actualizarBadgeCorrelativo();
  } catch (e) {
    showToast('No se pudo actualizar el correlativo.', 'error');
  }
}

export async function generarReportesMasivos() {
  const dStore = window.dataStore || {};
  const rFilters = window.reportesFilters || {};
  const showToast = window.showToast || console.log;
  const closeModal = window.closeModal || (() => {});

  const fInicio = rFilters.fechaInicio || '';
  const fTermino = rFilters.fechaTermino || '';

  const dirResult = await window.api.selectDirectory();
  if (dirResult.cancelled || !dirResult.filePath) {
    showToast('Generación masiva cancelada.', 'info');
    return;
  }
  const destFolder = dirResult.filePath;

  showToast('Iniciando procesamiento masivo...');

  const vigenciaState = rFilters.vigencia || 'todos';
  let vigentesIds = window.activeSujetoIdsCache || null;
  if ((vigenciaState === 'vigentes' || vigenciaState === 'no_vigentes') && (!vigentesIds || vigentesIds.size === 0)) {
    try {
      const res = await fetch('/api/sujetos_pasivos/vigentes');
      if (res.ok) {
        const rawIds = await res.json();
        vigentesIds = new Set();
        (Array.isArray(rawIds) ? rawIds : []).forEach(id => {
          if (id != null) {
            vigentesIds.add(Number(id));
            vigentesIds.add(String(id));
          }
        });
        window.activeSujetoIdsCache = vigentesIds;
      }
    } catch (e) {
      console.error('Error al obtener sujetos vigentes:', e);
    }
  }

  const filtered = [];
  const hasEstadosFilter = rFilters.estados && rFilters.estados.length > 0;
  const publicadasArray = Array.isArray(dStore.publicadas) ? dStore.publicadas : (dStore.publicadas?.data || []);
  const publicadosFolios = new Set(publicadasArray.map(p => p.folio_lobby).filter(Boolean));

  (dStore.reportesRawData || []).forEach(item => {
    let itemEstado = (item.estado || 'Ingresada').trim();
    const isPendiente = itemEstado.toLowerCase() === 'aceptada' &&
                        item.fecha_agendada &&
                        item.fecha_agendada !== '-' &&
                        item.fecha_agendada !== '---' &&
                        publicadosFolios.size > 0 &&
                        !publicadosFolios.has(item.folio_lobby);
    if (isPendiente) {
      itemEstado = 'Pendiente de publicación';
    }

    if (fInicio || fTermino) {
      const statusLower = itemEstado.toLowerCase();
      let evalDate = null;
      if (statusLower === 'ingresada') {
        evalDate = item.fecha_limite_sh || item.fecha_ingreso;
      } else if (item.fecha_agendada && item.fecha_agendada !== '-' && item.fecha_agendada !== '---') {
        evalDate = item.fecha_agendada;
      } else {
        evalDate = item.fecha_ingreso;
      }
      if (evalDate) {
        const dateStr = evalDate.split(' ')[0];
        if (fInicio && dateStr < fInicio) return;
        if (fTermino && dateStr > fTermino) return;
      } else {
        return;
      }
    }

    if (hasEstadosFilter) {
      const match = rFilters.estados.some(est => est.toLowerCase() === itemEstado.toLowerCase());
      if (!match) return;
    }

    if (vigenciaState === 'vigentes' && vigentesIds && vigentesIds.size > 0) {
      const id = item.sujeto_pasivo_id;
      if (id == null || (!vigentesIds.has(Number(id)) && !vigentesIds.has(String(id)))) return;
    } else if (vigenciaState === 'no_vigentes' && vigentesIds && vigentesIds.size > 0) {
      const id = item.sujeto_pasivo_id;
      if (id != null && (vigentesIds.has(Number(id)) || vigentesIds.has(String(id)))) return;
    }

    filtered.push(item);
  });

  const groups = {};
  filtered.forEach(item => {
    const name = (item.sujeto_pasivo || 'Sin Nombre').trim();
    const cargo = (item.cargo || 'Sin Cargo').trim();
    const key = `${name}|||${cargo}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
  });

  const getCargoAbbrFn = typeof window.getCargoAbbreviated === 'function' ? window.getCargoAbbreviated : (c => c || '');
  const cargoPriorityOrder = ['ALC', 'CON', 'DOM', 'SECMUN', 'CE'];

  const groupKeys = Object.keys(groups).sort((keyA, keyB) => {
    const [nameA, cargoA] = keyA.split('|||');
    const [nameB, cargoB] = keyB.split('|||');

    const codeA = getCargoAbbrFn(cargoA);
    const codeB = getCargoAbbrFn(cargoB);

    const idxA = cargoPriorityOrder.indexOf(codeA);
    const idxB = cargoPriorityOrder.indexOf(codeB);

    const prioA = idxA !== -1 ? idxA : 999;
    const prioB = idxB !== -1 ? idxB : 999;

    if (prioA !== prioB) return prioA - prioB;
    if (codeA !== codeB) return codeA.localeCompare(codeB);
    return nameA.localeCompare(nameB);
  });
  const totalGroups = groupKeys.length;

  if (totalGroups === 0) {
    showToast('No se encontraron registros que coincidan con los filtros de fechas/estados.', 'error');
    return;
  }

  let assignedBatchCodes = [];
  try {
    const resBatch = await fetch('/api/reportes/correlativo/consumir', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cantidad: totalGroups })
    });
    if (resBatch.ok) {
      const d = await resBatch.json();
      assignedBatchCodes = d?.codes || d?.data?.codes || [];
    }
  } catch (e) {
    console.warn('Error al pre-consumir correlativos para lote:', e);
  }

  let isCancelled = false;
  const modal = document.getElementById('modal-container');
  if (modal) {
    modal.classList.remove('hidden');
    modal.innerHTML = `
      <div class="glass-card w-full max-w-md p-6 rounded-3xl space-y-5 shadow-2xl relative border border-border-ui">
        <div class="flex items-center gap-3">
          <div class="h-10 w-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
            <svg class="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
          <div>
            <h3 class="text-sm font-bold text-text-primary uppercase tracking-wider">Generación Masiva</h3>
            <p class="text-[10px] text-text-tertiary mt-0.5">Exportando reportes a PDF silenciosamente...</p>
          </div>
        </div>
        
        <div class="space-y-2">
          <div class="w-full bg-bg-card rounded-full h-1.5 overflow-hidden">
            <div id="batch-progress-bar" class="bg-blue-500 h-1.5 rounded-full transition-all duration-250" style="width: 0%"></div>
          </div>
          <div class="flex justify-between text-[10px] text-text-tertiary font-semibold">
            <span id="batch-progress-text" class="truncate max-w-[240px]">Iniciando cola...</span>
            <span id="batch-progress-percent">0%</span>
          </div>
        </div>

        <div class="flex justify-end pt-2">
          <button id="cancel-batch-btn" class="px-4 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 font-bold text-[10px] uppercase tracking-wider transition-colors">
            Cancelar
          </button>
        </div>
      </div>
    `;

    const cancelBtn = document.getElementById('cancel-batch-btn');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        isCancelled = true;
        cancelBtn.textContent = 'Cancelando...';
        cancelBtn.disabled = true;
        cancelBtn.classList.remove('bg-rose-500/10', 'text-rose-500');
        cancelBtn.classList.add('bg-border-ui/40', 'text-text-tertiary');
        showToast('Cancelando exportación masiva...', 'info');
      });
    }
  }

  const cleanBiddingFn = typeof window.getCargoCleanBidding === 'function' ? window.getCargoCleanBidding : (c => c || '');
  const cleanCargoFn = typeof window.getCargoClean === 'function' ? window.getCargoClean : (c => c || '');
  const normFn = typeof window.normalizeName === 'function' ? window.normalizeName : (n => n || '');
  const fmtDateFn = typeof window.formatDate === 'function' ? window.formatDate : (d => d || '');
  const fmtDateTimeFn = typeof window.formatDateTime === 'function' ? window.formatDateTime : (d => d || '');
  const getBadgeFn = typeof window.getDeadlineStatusBadge === 'function' ? window.getDeadlineStatusBadge : (() => ({ class: '', text: '' }));
  const getPlazoFn = typeof window.getStandardizedPlazoText === 'function' ? window.getStandardizedPlazoText : (() => '');
  const getDelayFn = typeof window.getPendingPublicationDelay === 'function' ? window.getPendingPublicationDelay : (() => ({ deadlineStr: null }));
  const sanitizeNameFn = typeof window.sanitizeNombreForFilename === 'function' ? window.sanitizeNombreForFilename : (n => n || '');

  for (let index = 0; index < totalGroups; index++) {
    if (isCancelled) {
      closeModal();
      showToast('Generación masiva cancelada por el usuario.', 'info');
      window.api.invokeRoute({
        url: '/api/log',
        method: 'POST',
        body: {
          code: 'INFO-REP-505',
          message: 'Generación masiva cancelada',
          details: `Procesamiento cancelado por el usuario en el reporte ${index + 1} de ${totalGroups} | Destino: ${destFolder} | Por: ${window.currentUser ? window.currentUser.correo : 'Desconocido'}`,
          severity: 'info'
        }
      }).catch(err => console.error('Error al registrar log de cancelación de reporte:', err));
      return;
    }
    const key = groupKeys[index];
    const [name, cargo] = key.split('|||');
    const groupItems = groups[key];

    const progressPercent = Math.round((index / totalGroups) * 100);
    const progressBar = document.getElementById('batch-progress-bar');
    const progressText = document.getElementById('batch-progress-text');
    const progressPercentText = document.getElementById('batch-progress-percent');
    
    if (progressBar) progressBar.style.width = `${progressPercent}%`;
    if (progressText) progressText.textContent = `${normFn(name)} (${index + 1}/${totalGroups})`;
    if (progressPercentText) progressPercentText.textContent = `${progressPercent}%`;

    const codigoReporte = (assignedBatchCodes && assignedBatchCodes[index]) ? assignedBatchCodes[index] : `${generateLocalReportCode()}-${String(index + 1).padStart(3, '0')}`;

    const processedGroupItems = groupItems.map((item, idx) => {
      const isLicitacion = item.cargo && (item.cargo.includes('2770-') || item.cargo.includes('27770-'));
      const cleanedCargoText = isLicitacion ? cleanBiddingFn(item.cargo) : cleanCargoFn(item.cargo);
      const normalizedName = normFn(item.sujeto_pasivo) || 'Sin Nombre';
      const cargoCombinado = `${normalizedName} - ${cleanedCargoText}`;

      let itemEstado = (item.estado || 'Ingresada').trim();
      const isPendiente = itemEstado.toLowerCase() === 'aceptada' &&
                        item.fecha_agendada &&
                        item.fecha_agendada !== '-' &&
                        item.fecha_agendada !== '---' &&
                        publicadosFolios.size > 0 &&
                        !publicadosFolios.has(item.folio_lobby);
      if (isPendiente) {
        itemEstado = 'Pendiente de publicación';
      }

      let badge;
      if (isPendiente) {
        badge = { text: 'Pendiente de publicación', class: 'badge-status-otros' };
      } else {
        badge = getBadgeFn(item.fecha_ingreso, item.fecha_respuesta, item.estado, item);
      }
      const plazoRestanteStr = getPlazoFn(item, isPendiente);
      const pubInfo = getDelayFn(item.fecha_agendada, item);

      return {
        index: idx + 1,
        id: item.id || idx,
        folio: item.folio_lobby || 'Sin Folio',
        cargoCompleto: cargoCombinado,
        cargo: cleanedCargoText,
        fechaIngreso: fmtDateFn(item.fecha_ingreso),
        fechaLimiteRespuesta: item.fecha_limite_sh ? fmtDateFn(item.fecha_limite_sh) : null,
        fechaAgendada: fmtDateTimeFn(item.fecha_agendada),
        fechaLimitePublicacion: (item.fecha_agendada && item.fecha_agendada !== '-') ? pubInfo.deadlineStr : null,
        estado: itemEstado,
        badgeClass: badge.class,
        badgeText: badge.text,
        plazo: plazoRestanteStr
      };
    });

    const isOverdueItem = (item) => {
      const mainCode = (item.plazo || '').split(' ')[0].toUpperCase();
      return mainCode === 'FDP' || mainCode === 'RFP';
    };
    const isFdpItem = (item) => (item.plazo || '').split(' ')[0].toUpperCase() === 'FDP';
    const isDdpItem = (item) => (item.plazo || '').split(' ')[0].toUpperCase() === 'DDP';

    const rowsArray = processedGroupItems.map((item, idx) => {
      let stateColor = '#334155';
      let stateBg = '#f1f5f9';
      let stateBorder = '#e2e8f0';
      const stateLower = (item.estado || '').toLowerCase();
      if (stateLower === 'aceptada') { stateColor = '#166534'; stateBg = '#f0fdf4'; stateBorder = '#bbf7d0'; }
      else if (stateLower === 'pendiente de publicación') { stateColor = '#075985'; stateBg = '#f0f9ff'; stateBorder = '#bae6fd'; }
      else if (stateLower === 'rechazada') { stateColor = '#991b1b'; stateBg = '#fef2f2'; stateBorder = '#fecaca'; }
      else if (stateLower === 'cancelada' || stateLower === 'suspendida') { stateColor = '#9a3412'; stateBg = '#fffbeb'; stateBorder = '#fed7aa'; }

      const isOverdue = isOverdueItem(item);
      const plazoColor = isOverdue ? '#991b1b' : '#166534';
      const plazoBg   = isOverdue ? '#fef2f2' : '#f0fdf4';
      const plazoBorder = isOverdue ? '#fecaca' : '#bbf7d0';

      const plazoStr = item.plazo || '';
      const hasDays = plazoStr.includes('(') && plazoStr.includes(')');
      let mainCode = plazoStr || '—';
      let days = '';
      if (hasDays) {
        const parts = plazoStr.split(' ');
        mainCode = parts[0] || '—';
        days = (parts[1] || '').replace(/[()]/g, '');
      }

      const showTwoLine = hasDays && (mainCode === 'FDP' || mainCode === 'RFP');
      const plazoBadgeHtml = showTwoLine
        ? `<span style="display: inline-block; padding: 3px 6px; border: 1px solid ${plazoBorder}; border-radius: 6px; font-size: 7px; font-weight: 800; color: ${plazoColor}; background: ${plazoBg}; text-align: center; min-width: 42px; line-height: 1.3; white-space: normal;">${mainCode}<br><span style="font-size: 6px; font-weight: 500;">${days}</span></span>`
        : `<span style="display: inline-block; padding: 3px 6px; border: 1px solid ${plazoBorder}; border-radius: 6px; font-size: 7px; font-weight: 800; color: ${plazoColor}; background: ${plazoBg}; text-align: center; min-width: 42px; line-height: 1.3; text-transform: uppercase; white-space: nowrap;">${mainCode}</span>`;

      const rowBg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';

      return `
        <tr style="border-bottom: 1px solid #e2e8f0; font-size: 7.5px; background: ${rowBg};">
          <td style="padding: 8px 10px; font-weight: 600; color: #64748b; border-bottom: 1px solid #e2e8f0;">${item.index}</td>
          <td style="padding: 8px 10px; font-weight: 700; color: #0f172a; font-family: monospace; border-bottom: 1px solid #e2e8f0;">${item.folio}</td>
          <td style="padding: 8px 10px; color: #1e293b; font-weight: 500; border-bottom: 1px solid #e2e8f0; line-height: 1.3;">${item.cargo}</td>
          <td style="padding: 8px 10px; color: #475569; border-bottom: 1px solid #e2e8f0; line-height: 1.3;">
            <div style="font-weight: 600; color: #334155;">${item.fechaIngreso}</div>
            ${item.fechaLimiteRespuesta ? `<div style="font-size: 6.5px; color: #94a3b8; margin-top: 1px;">${item.fechaLimiteRespuesta}</div>` : ''}
          </td>
          <td style="padding: 8px 10px; color: #475569; border-bottom: 1px solid #e2e8f0; line-height: 1.3;">
            <div style="font-weight: 600; color: #334155;">${item.fechaAgendada}</div>
            ${item.fechaLimitePublicacion ? `<div style="font-size: 6.5px; color: #94a3b8; margin-top: 1px;">${item.fechaLimitePublicacion}</div>` : ''}
          </td>
          <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0; vertical-align: middle;">
            ${item.estado === 'Pendiente de publicación'
              ? `<span style="display: inline-block; padding: 3px 6px; border: 1px solid ${stateBorder}; border-radius: 6px; font-size: 6.5px; font-weight: 700; color: ${stateColor}; background: ${stateBg}; text-align: center; line-height: 1.2;">PENDIENTE DE PUBLICACIÓN</span>`
              : `<span style="display: inline-block; padding: 3px 6px; border: 1px solid ${stateBorder}; border-radius: 6px; font-size: 6.5px; font-weight: 700; color: ${stateColor}; background: ${stateBg}; text-transform: uppercase; white-space: nowrap; line-height: 1.2;">${item.estado}</span>`
            }
          </td>
          <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0; vertical-align: middle;">
            ${plazoBadgeHtml}
          </td>
        </tr>
      `;
    });

    const htmlContent = buildReportPDFHtml({
      processedData: processedGroupItems,
      filtersSnapshot: {
        nombre: name,
        cargo: cargo,
        fechaInicio: fInicio,
        fechaTermino: fTermino,
        estados: rFilters.estados || []
      },
      sujetoPasivoNombre: normFn(name),
      sujetoPasivoCargo: cargo,
      codigoReporte
    });

    const cargoAbbr = getCargoAbbrFn(cargo);
    const sanitizedNombre = sanitizeNameFn(name);
    const fileName = `${codigoReporte}_${cargoAbbr}_${sanitizedNombre}.pdf`;
    const filePath = `${destFolder}/${fileName}`.replace(/\\/g, '/');

    const silentResult = await window.api.generateSilentPdf({
      html: htmlContent,
      filePath,
      title: `${codigoReporte} - ${name}`
    });

    if (!silentResult || !silentResult.success) {
      console.error(`Error al exportar PDF de ${name} (${cargo}):`, silentResult ? silentResult.error : 'Desconocido');
    }
  }

  closeModal();
  showToast(`Generación masiva completada: ${totalGroups} reportes exportados en ${destFolder}`, 'success');
  window.api.invokeRoute({
    url: '/api/log',
    method: 'POST',
    body: {
      code: 'INFO-REP-504',
      message: 'Generación masiva completada',
      details: `Total: ${totalGroups} reportes exportados en ${destFolder} | Por: ${window.currentUser ? window.currentUser.correo : 'Desconocido'}`,
      severity: 'info'
    }
  }).catch(err => console.error('Error al registrar log de generación masiva:', err));
}

export const ReportesView = {
  async mount(container, params = {}) {
    return renderReportes(container);
  },
  unmount() {},
  generateLocalCode: generateLocalReportCode,
  buildPDFHtml: buildReportPDFHtml,
  exportPDF: exportReportToPDF,
  exportExcel: exportReportToExcel,
  exportConsolidadoPDF: exportReporteEjecutivoPDF,
  generarMasivos: generarReportesMasivos,
  actualizarBadgeCorrelativo,
  abrirModalConfigurarCorrelativo,
  guardarNuevoCorrelativo
};

if (typeof window !== 'undefined') {
  window.renderReportes = renderReportes;
  window.ReportesView = ReportesView;
  window.generateLocalReportCode = generateLocalReportCode;
  window.buildReportPDFHtml = buildReportPDFHtml;
  window.exportReportToPDF = exportReportToPDF;
  window.exportReportToExcel = exportReportToExcel;
  window.exportReporteEjecutivoPDF = exportReporteEjecutivoPDF;
  window.generarReportesMasivos = generarReportesMasivos;
  window.actualizarBadgeCorrelativo = actualizarBadgeCorrelativo;
  window.abrirModalConfigurarCorrelativo = abrirModalConfigurarCorrelativo;
  window.guardarNuevoCorrelativo = guardarNuevoCorrelativo;
}

