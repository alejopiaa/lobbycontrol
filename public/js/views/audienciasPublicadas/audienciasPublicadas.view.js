/**
 * audienciasPublicadas.view.js - Vista modular de Audiencias Publicadas
 * LobbyControl - Arquitectura Modular ESM
 */

import { renderTableListViewLayout } from '../../components/table-list.layout.js';
import { renderFilterBar } from '../../components/filter-bar.component.js';
import {
  renderSearchInput,
  renderDualDatePicker,
  renderSelectInput,
  renderVigenciaSelect,
  renderPaginationControls,
  renderStatusBadge
} from '../../components/ui.js';
import {
  escapeHtml,
  escapeHtmlAttr,
  formatDateForDisplay
} from '../../utils/formatters.js';

/**
 * Renderiza la vista de Audiencias Publicadas
 * @param {HTMLElement} container - Contenedor principal donde se monta la vista
 */
export function renderAudienciasPublicadas(container) {
  if (!container) return;

  const store = (typeof dataStore !== 'undefined' ? dataStore : (typeof window !== 'undefined' ? window.dataStore : null)) || {};
  const pageState = (typeof paginationState !== 'undefined' ? paginationState : (typeof window !== 'undefined' ? window.paginationState : null)) || { publicadas: { page: 1, filters: {} } };
  const sujetoCache = (typeof window !== 'undefined' && window.activeSujetoIdsCache) || (typeof activeSujetoIdsCache !== 'undefined' ? activeSujetoIdsCache : null);
  const dropdownCache = typeof dashboardDropdownCache !== 'undefined' ? dashboardDropdownCache : (typeof window !== 'undefined' ? window.dashboardDropdownCache : null) || {};

  const formatDateFn = typeof formatDate === 'function' ? formatDate : formatDateForDisplay;
  const normalizeNameFn = typeof normalizeName === 'function' ? normalizeName : (s => s || '');
  const getCargoCleanFn = typeof getCargoClean === 'function' ? getCargoClean : (s => s || '');

  // Soportar estado en publicadas o audienciasPublicadas
  if (!pageState.publicadas && pageState.audienciasPublicadas) {
    pageState.publicadas = pageState.audienciasPublicadas;
  }

  const filters = pageState.publicadas?.filters || {};
  let paginatedItems = [];
  let totalItems = 0;
  const currentPage = pageState.publicadas?.page || 1;
  const pageSize = 10;

  const isServerPaged = store.publicadas && !Array.isArray(store.publicadas);
  if (isServerPaged) {
    paginatedItems = store.publicadas.data || [];
    totalItems = store.publicadas.totalItems || 0;
  } else {
    let filtered = store.publicadas || [];
    if (filters.vigencia === 'vigentes' || filters.soloVigentes === true) {
      filtered = filtered.filter((item) => {
        if (item.sujeto_pasivo_id && sujetoCache && (sujetoCache.has(Number(item.sujeto_pasivo_id)) || sujetoCache.has(String(item.sujeto_pasivo_id)))) {
          return true;
        }
        if (dropdownCache.nombresVigentes && item.sujeto_pasivo) {
          return dropdownCache.nombresVigentes.some(n => n.toLowerCase() === item.sujeto_pasivo.toLowerCase());
        }
        return false;
      });
    } else if (filters.vigencia === 'no_vigentes') {
      filtered = filtered.filter((item) => {
        if (item.sujeto_pasivo_id && sujetoCache && (sujetoCache.has(Number(item.sujeto_pasivo_id)) || sujetoCache.has(String(item.sujeto_pasivo_id)))) {
          return false;
        }
        if (dropdownCache.nombresVigentes && item.sujeto_pasivo) {
          return !dropdownCache.nombresVigentes.some(n => n.toLowerCase() === item.sujeto_pasivo.toLowerCase());
        }
        return true;
      });
    }
    if (filters.folio) {
      const val = filters.folio.toLowerCase();
      filtered = filtered.filter((item) =>
        (item.folio_lobby || '').toLowerCase().includes(val)
      );
    }
    if (filters.nombre) {
      const val = filters.nombre.toLowerCase();
      filtered = filtered.filter((item) =>
        (item.sujeto_pasivo || '').toLowerCase().includes(val)
      );
    }
    if (filters.cargo) {
      const val = filters.cargo.toLowerCase();
      filtered = filtered.filter(
        (item) =>
          item.cargo && getCargoCleanFn(item.cargo).toLowerCase().includes(val)
      );
    }
    if (filters.sujetoActivoRepresentado) {
      const val = filters.sujetoActivoRepresentado.toLowerCase();
      filtered = filtered.filter(
        (item) =>
          (item.sujeto_activo || '').toLowerCase().includes(val) ||
          (item.representado || '').toLowerCase().includes(val) ||
          (item.rut || '').toLowerCase().includes(val)
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
          item.sujeto_activo.toLowerCase() === filters.relacionSujetoActivo.toLowerCase()
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
          filters.relacionRepresentado.toLowerCase() !== 'particular' &&
          item.representado &&
          item.representado.toLowerCase() === filters.relacionRepresentado.toLowerCase()
        ) {
          match = true;
        }
        return match;
      });
    }
    if (filters.estado) {
      const val = filters.estado.toLowerCase();
      filtered = filtered.filter((item) => {
        const isItemFuera = (item.cumplimiento || '')
          .toLowerCase()
          .includes('fuera');
        if (val === 'fuera de plazo') return isItemFuera;
        if (val === 'en plazo') return !isItemFuera;
        return true;
      });
    }
    if (filters.fechaInicio) {
      filtered = filtered.filter((item) => {
        const itemDate = (
          item.fecha_audiencia ||
          item.fecha_inicio ||
          ''
        ).split(' ')[0];
        return itemDate >= filters.fechaInicio;
      });
    }
    if (filters.fechaTermino) {
      filtered = filtered.filter((item) => {
        const itemDate = (
          item.fecha_audiencia ||
          item.fecha_inicio ||
          ''
        ).split(' ')[0];
        return itemDate <= filters.fechaTermino;
      });
    }
    totalItems = filtered.length;
    paginatedItems = filtered.slice(
      (currentPage - 1) * pageSize,
      currentPage * pageSize
    );
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
      header: 'FECHA Y HORA',
      key: 'fecha_audiencia',
      width: 'w-28 text-left',
      render: (item) => {
        const rawDate = item.fecha_audiencia || item.fecha_inicio;
        const formattedDate = formatDateFn(rawDate);
        const timePart = rawDate && rawDate.includes(' ') ? rawDate.split(' ')[1].slice(0, 5) + ' hrs' : '';
        const displayDateTime = timePart ? `${formattedDate} ${timePart}` : formattedDate;
        return `
          <div class="font-medium text-text-secondary w-full truncate">${displayDateTime}</div>
          <div class="text-[10px] text-text-secondary mt-0.5 w-full truncate">${escapeHtml(item.forma || 'Presencial')}</div>
        `;
      }
    },
    {
      header: 'FECHA PUBLICACIÓN',
      key: 'fecha_publicacion',
      width: 'w-28 text-left',
      render: (item) => `
        <div class="font-semibold text-text-secondary">${formatDateFn(item.fecha_publicacion)}</div>
        <div class="text-[10px] text-text-tertiary mt-0.5">Publicación</div>
      `
    },
    {
      header: 'SUJETO PASIVO',
      key: 'sujeto_pasivo',
      width: 'w-48 text-left',
      render: (item) => `
        <div class="font-medium text-text-secondary w-full truncate" title="${escapeHtmlAttr(normalizeNameFn(item.sujeto_pasivo) || 'Sin Nombre')}">${escapeHtml(normalizeNameFn(item.sujeto_pasivo) || 'Sin Nombre')}</div>
        <div class="text-[10px] text-text-secondary mt-0.5 w-full truncate" title="${escapeHtmlAttr(getCargoCleanFn(item.cargo))}">${escapeHtml(getCargoCleanFn(item.cargo))}</div>
      `
    },
    {
      header: 'SUJETO ACTIVO',
      key: 'sujeto_activo',
      width: 'w-48 text-left',
      render: (item) => `
        <div class="font-medium text-text-secondary w-full flex items-center justify-between gap-1">
          <span class="truncate" title="${escapeHtmlAttr(item.sujeto_activo || 'Sin Activo')}">${escapeHtml(item.sujeto_activo || 'Sin Activo')}</span>
          ${
            item.sujeto_activo
              ? `
            <button onclick="filtrarRelacionados('publicadas', '${escapeHtmlAttr(item.sujeto_activo)}', '${escapeHtmlAttr(item.rut || '')}', '${escapeHtmlAttr(item.representado || '')}')" 
                    class="text-brand-500 dark:text-brand-400 hover:text-brand-600 dark:hover:text-brand-300 hover:bg-brand-500/10 p-0.5 rounded-lg transition-all shrink-0 cursor-pointer" 
                    title="Filtrar audiencias relacionadas (mismo RUN, representado y/o sujeto activo)">
              <i data-lucide="info" class="h-3.5 w-3.5"></i>
            </button>
          `
              : ''
          }
        </div>
        <div class="text-[10px] text-text-secondary mt-0.5 w-full truncate" title="${escapeHtmlAttr(item.representado || 'Particular')}">${escapeHtml(item.representado || 'Particular')}</div>
      `
    },
    {
      header: 'MATERIA',
      key: 'materia',
      width: 'w-auto text-left',
      render: (item) => `
        <div class="text-[10.5px] text-text-secondary font-sans leading-normal overflow-hidden" 
             style="display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; max-height: 2.8em;"
             title="${escapeHtmlAttr(item.especificacion_materia || item.materia || '')}">
          ${escapeHtml(item.especificacion_materia || item.materia || 'Sin Especificar')}
        </div>
      `
    },
    {
      header: 'PLAZO',
      key: 'cumplimiento',
      width: 'w-28 text-left',
      render: (item) => {
        const rawCumplimiento = item.cumplimiento || 'En plazo';
        const isFuera = rawCumplimiento.toLowerCase().includes('fuera');
        const badgeClass = isFuera ? 'badge-status-vencido' : 'badge-status-enplazo';
        const mainStatusText = isFuera ? 'Fuera de plazo' : 'En plazo';
        let delaySubtext = '';
        if (isFuera) {
          const matchDelay = rawCumplimiento.match(/-?\d+d/i);
          if (matchDelay) {
            delaySubtext = matchDelay[0];
          }
        }
        return `
          <div class="w-24">
            ${renderStatusBadge({ text: mainStatusText, subtext: delaySubtext, class: badgeClass })}
          </div>
        `;
      }
    },
    {
      header: 'ACCIÓN',
      key: 'accion',
      width: 'w-28 text-left whitespace-nowrap',
      render: (item) => `
        <button onclick="showAudienciaPublicadaDetailsModal(${item.id})" class="px-3 py-1.5 rounded-lg text-xs font-semibold bg-brand-600 hover:bg-brand-500 text-white transition-all inline-block hover:shadow-md hover:shadow-brand-500/20 whitespace-nowrap cursor-pointer">Ver Detalle</button>
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
    moduleName: 'publicadas',
    activeCount,
    chipsHtml: `
      <!-- 1. VIGENCIA -->
      ${renderVigenciaSelect({
        id: "filter-publicadas-vigencia",
        value: filters.vigencia,
        onChange: "changePublicadasVigencia",
      })}

      <!-- 2. FOLIO -->
      <div class="w-[150px] shrink-0">
        ${renderSearchInput({
          id: "filter-publicadas-folio",
          fieldName: "folio",
          placeholder: "Buscar folio...",
          value: filters.folio,
          icon: "hash",
        })}
      </div>

      <!-- 3. SUJETO PASIVO -->
      <div class="w-[200px] shrink-0">
        ${renderSearchInput({
          id: "publicadas-filter-nombre",
          fieldName: "nombre",
          placeholder: "Sujeto Pasivo...",
          value: filters.nombre,
          icon: "user",
          hasSuggestions: true,
        })}
      </div>

      <!-- 4. CARGO (Bloqueado por defecto si no hay Sujeto Pasivo) -->
      <div class="w-[180px] shrink-0">
        ${renderSearchInput({
          id: "publicadas-filter-cargo",
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
          id: "publicadas-filter-sujetoActivoRepresentado",
          fieldName: "sujetoActivoRepresentado",
          placeholder: "Lobbista o RUT...",
          value: filters.sujetoActivoRepresentado,
          icon: "users",
          hasSuggestions: true,
        })}
      </div>

      <!-- 6. PLAZO -->
      <div class="w-[170px] shrink-0">
        ${renderSelectInput({
          id: "filter-publicadas-estado",
          fieldName: "estado",
          value: filters.estado,
          optionsList: [
            { value: "", text: "Todos" },
            { value: "en plazo", text: "Dentro de plazo (DDP)" },
            { value: "fuera de plazo", text: "Fuera de plazo (FDP)" },
          ],
        })}
      </div>

      <!-- 7. FECHAS -->
      ${renderDualDatePicker({
        idPrefix: "filter-publicadas-",
        fechaInicio: filters.fechaInicio,
        fechaTermino: filters.fechaTermino,
      })}
    `
  });

  const bannerRelacionHtml = (filters.relacionSujetoActivo || filters.relacionRut || filters.relacionRepresentado)
    ? `
      <div class="mb-4 p-4 rounded-2xl bg-brand-50 dark:bg-brand-500/10 border border-brand-200/80 border-brand-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-brand-900 dark:text-brand-200 relative overflow-hidden glass-card">
        <div class="flex items-center gap-3">
          <div class="p-2 rounded-xl bg-brand-100 dark:bg-brand-500/20 text-brand-600 dark:text-brand-400 border border-brand-200 dark:border-brand-500/30">
            <i data-lucide="info" class="h-4 w-4"></i>
          </div>
          <div>
            <div class="font-bold text-text-primary uppercase tracking-wider text-[10px] mb-0.5">Filtrando Audiencias Relacionadas</div>
            <div class="font-medium text-text-secondary">
              Mostrando registros de sujeto activo <strong class="text-text-primary">${escapeHtml(filters.relacionSujetoActivo || '---')}</strong>
              ${filters.relacionRut ? ` (RUN: <strong class="text-text-primary font-mono">${escapeHtml(filters.relacionRut)}</strong>)` : ''}
              ${filters.relacionRepresentado ? ` y/o representado <strong class="text-text-primary">${escapeHtml(filters.relacionRepresentado)}</strong>` : ''}
            </div>
          </div>
        </div>
        <button onclick="clearRelacionFilter('publicadas')" class="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl font-bold transition-all hover:shadow-lg hover:shadow-brand-500/20 whitespace-nowrap shrink-0 text-xs cursor-pointer">
          Limpiar Filtro
        </button>
      </div>
    `
    : '';

  const subTabsHtml = `
    <button onclick="changeAudienciasSubTab('solicitudes')" class="px-4 py-2 text-xs font-semibold rounded-xl transition-all text-text-secondary hover:text-text-primary hover:bg-border-ui/50 cursor-pointer border-0 bg-transparent">
      Solicitudes
    </button>
    <button onclick="changeAudienciasSubTab('pendientes')" class="px-4 py-2 text-xs font-semibold rounded-xl transition-all text-text-secondary hover:text-text-primary hover:bg-border-ui/50 cursor-pointer border-0 bg-transparent">
      Pendientes de Publicación
    </button>
    <button onclick="changeAudienciasSubTab('publicadas')" class="px-4 py-2 text-xs font-semibold rounded-xl transition-all bg-brand-600 text-white shadow-md shadow-brand-500/20 cursor-pointer border-0">
      Audiencias Publicadas
    </button>
  `;

  container.innerHTML = renderTableListViewLayout({
    id: 'publicadas-table-view',
    title: 'Audiencias y Solicitudes',
    titleIcon: 'calendar-check',
    subtitle: 'Gestión y seguimiento de audiencias según Ley N° 20.730',
    subTabsHtml,
    bannerHtml: bannerRelacionHtml,
    filtersHtml,
    counterText: `${totalItems} registros publicados encontrados`,
    counterId: 'publicadas-counter',
    tableId: 'table-publicadas',
    columns,
    items: paginatedItems,
    emptyIcon: 'calendar-check',
    emptyMessage: 'No hay registros de audiencias publicadas coincidentes con los filtros.',
    emptyActionHtml: '<button onclick="clearFilters(\'publicadas\')" class="text-xs text-brand-500 hover:underline font-semibold mt-1 bg-transparent border-0 cursor-pointer">Limpiar filtros de búsqueda</button>',
    paginationSummary: `Mostrando <span class="font-semibold text-text-secondary">${paginatedItems.length}</span> de <span class="font-semibold text-text-secondary">${totalItems}</span> registros`,
    paginationHtml: renderPaginationControls('publicadas', totalItems, currentPage, pageSize),
    paginationId: 'publicadas-pagination-container'
  });

  const renderedTable = container.querySelector('#table-publicadas');
  if (renderedTable) {
    renderedTable.dataset.subtab = 'historial';
  }

  if (typeof lucide !== 'undefined' && lucide.createIcons) {
    lucide.createIcons();
  }
  if (typeof window.initAirDatepickerFields === 'function') {
    window.initAirDatepickerFields();
  }
}

export const AudienciasPublicadasView = {
  async mount(container, params = {}) {
    return renderAudienciasPublicadas(container);
  },
  unmount() {}
};

if (typeof window !== 'undefined') {
  window.renderAudienciasPublicadas = renderAudienciasPublicadas;
  window.AudienciasPublicadasView = AudienciasPublicadasView;
  // Shim de retrocompatibilidad
  window.renderPublicadas = renderAudienciasPublicadas;
  window.PublicadasView = AudienciasPublicadasView;
}
