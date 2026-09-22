/**
 * AsistenciaTab - Módulo desacoplado de la pestaña de asistencia técnica
 * Incorpora la Bitácora de Atenciones, Directorio de Contactos,
 * Catálogo de Categorías y Direcciones Municipales Oficiales.
 */

import { escapeHtml } from '../../utils/formatters.js';

// Estado de paginación y filtros de la bitácora
window.asistenciaPaginationState = window.asistenciaPaginationState || {
  page: 1,
  limit: 10,
  totalItems: 0,
  totalPages: 1
};
window.activeAsistenciaSubTab = window.activeAsistenciaSubTab || 'bitacora';

function renderAsistenciaTabHtml() {
  if (typeof activeAsistenciaSubTab === "undefined") {
    window.activeAsistenciaSubTab = "bitacora";
  }

  const subTabClass = (tab) => {
    return activeAsistenciaSubTab === tab
      ? "px-4 py-2 rounded-xl text-xs font-bold bg-brand-600 text-white shadow-sm flex items-center gap-2 transition-all cursor-default"
      : "px-4 py-2 rounded-xl text-xs font-semibold text-text-secondary  hover:text-text-primary dark:hover:text-text-primary hover:bg-border-ui dark:hover:bg-border-ui/50 flex items-center gap-2 transition-all cursor-pointer";
  };

  let subContent = renderAsistenciaBitacoraViewHtml();
  if (activeAsistenciaSubTab === "contactos") {
    subContent = renderAsistenciaContactosViewHtml();
  } else if (activeAsistenciaSubTab === "categorias") {
    subContent = renderAsistenciaCategoriasViewHtml();
  } else if (activeAsistenciaSubTab === "direcciones") {
    subContent = renderAsistenciaDireccionesViewHtml();
  }

  return `
    <div class="space-y-5 animate-fade-in font-sans mt-4">
      
      <!-- SUB-BARRA DE NAVEGACIÓN (BITÁCORA / DIRECTORIO / CATEGORÍAS / DIRECCIONES) -->
      <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-2 border-b border-border-ui">
        <div class="flex items-center gap-2 flex-wrap">
          <button onclick="changeAsistenciaSubTab('bitacora')" class="${subTabClass('bitacora')}">
            <i data-lucide="clipboard-list" class="h-4 w-4"></i>
            <span>Bitácora de Atenciones</span>
          </button>
          <button onclick="changeAsistenciaSubTab('contactos')" class="${subTabClass('contactos')}">
            <i data-lucide="users" class="h-4 w-4"></i>
            <span>Directorio de Contactos</span>
          </button>
          <button onclick="changeAsistenciaSubTab('categorias')" class="${subTabClass('categorias')}">
            <i data-lucide="tags" class="h-4 w-4"></i>
            <span>Materias y Categorías</span>
          </button>
          <button onclick="changeAsistenciaSubTab('direcciones')" class="${subTabClass('direcciones')}">
            <i data-lucide="building-2" class="h-4 w-4"></i>
            <span>Direcciones Municipales</span>
          </button>
        </div>
      </div>

      <!-- CONTENIDO DE LA SUB-PESTAÑA SELECCIONADA -->
      <div id="asistencia-subtab-content">
        ${subContent}
      </div>
    </div>
  `;
}

/**
 * Renderiza la sub-vista de la Bitácora de Atenciones.
 * @returns {string} Fragmento HTML de la bitácora.
 */
function renderAsistenciaBitacoraViewHtml() {
  return `
    <div class="space-y-4">
      <!-- 4 TARJETAS KPI EJECUTIVAS -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div class="glass-card p-4 rounded-2xl flex items-center gap-3.5 shadow-xs border border-border-ui bg-bg-header">
          <div class="h-10 w-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 border border-blue-500/20">
            <i data-lucide="clipboard-check" class="h-5 w-5"></i>
          </div>
          <div class="min-w-0">
            <p class="text-[10px] text-text-tertiary font-bold uppercase tracking-wider">Atenciones del Mes</p>
            <p id="kpi-asistencia-total" class="text-xl font-bold text-text-primary mt-0.5">--</p>
          </div>
        </div>

        <div class="glass-card p-4 rounded-2xl flex items-center gap-3.5 shadow-xs border border-border-ui bg-bg-header">
          <div class="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/20">
            <i data-lucide="check-circle" class="h-5 w-5"></i>
          </div>
          <div class="min-w-0">
            <p class="text-[10px] text-text-tertiary font-bold uppercase tracking-wider">Tasa de Resolución</p>
            <p id="kpi-asistencia-pct-tel" class="text-xl font-bold text-text-primary mt-0.5">--%</p>
          </div>
        </div>

        <div class="glass-card p-4 rounded-2xl flex items-center gap-3.5 shadow-xs border border-border-ui bg-bg-header">
          <div class="h-10 w-10 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0 border border-purple-500/20">
            <i data-lucide="building-2" class="h-5 w-5"></i>
          </div>
          <div class="min-w-0">
            <p class="text-[10px] text-text-tertiary font-bold uppercase tracking-wider">Mayor Demanda</p>
            <p id="kpi-asistencia-top-cat" class="text-sm font-bold text-text-primary mt-1 truncate">--</p>
          </div>
        </div>

        <div class="glass-card p-4 rounded-2xl flex items-center gap-3.5 shadow-xs border border-border-ui bg-bg-header">
          <div class="h-10 w-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/20">
            <i data-lucide="clock" class="h-5 w-5"></i>
          </div>
          <div class="min-w-0">
            <p class="text-[10px] text-text-tertiary font-bold uppercase tracking-wider">En Seguimiento</p>
            <p id="kpi-asistencia-pendientes" class="text-xl font-bold text-text-primary mt-0.5">--</p>
          </div>
        </div>
      </div>

      <!-- SECCIÓN DE GRÁFICOS DINÁMICOS APEXCHARTS (DEMANDA Y EVOLUCIÓN) -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
        
        <!-- GRÁFICO 1: DEMANDA POR DIRECCIÓN MUNICIPAL -->
        <div class="glass-card p-4 rounded-2xl border border-border-ui bg-bg-header shadow-xs flex flex-col justify-between">
          <div class="flex items-center justify-between mb-2">
            <div class="flex items-center gap-2">
              <div class="h-8 w-8 rounded-lg bg-brand-500/10 text-brand-600 dark:text-brand-400 flex items-center justify-center">
                <i data-lucide="bar-chart-2" class="h-4 w-4"></i>
              </div>
              <div>
                <h3 class="text-xs font-bold text-text-primary uppercase tracking-wider">Demanda por Dirección</h3>
                <p class="text-[10px] text-text-tertiary">Atenciones por unidad y depto. municipal</p>
              </div>
            </div>
          </div>
          <div id="chart-asistencia-direcciones" class="w-full min-h-[220px] flex items-center justify-center text-xs text-text-tertiary">
            <i data-lucide="loader-2" class="h-5 w-5 animate-spin mr-2 text-brand-500"></i> Cargando gráfico...
          </div>
        </div>

        <!-- GRÁFICO 2: EVOLUCIÓN TEMPORAL DE ASISTENCIAS -->
        <div class="glass-card p-4 rounded-2xl border border-border-ui bg-bg-header shadow-xs flex flex-col justify-between">
          <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-2">
            <div class="flex items-center gap-2">
              <div class="h-8 w-8 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                <i data-lucide="trending-up" class="h-4 w-4"></i>
              </div>
              <div>
                <h3 class="text-xs font-bold text-text-primary uppercase tracking-wider">Evolución de Consultas</h3>
                <p class="text-[10px] text-text-tertiary">Tendencia histórica y comparativa</p>
              </div>
            </div>
            
            <div class="flex items-center gap-1.5 flex-wrap">
              <!-- Selector Granularidad: Semanal / Mensual / Anual -->
              <div class="flex items-center bg-border-ui p-0.5 rounded-lg border border-border-ui text-[10px] font-semibold">
                <button type="button" id="btn-evol-semanal" onclick="setAsistenciaEvolucionView('semanal')" class="px-2 py-0.5 rounded-md text-text-secondary hover:text-text-primary dark:hover:text-text-primary cursor-pointer">
                  Semanal
                </button>
                <button type="button" id="btn-evol-mensual" onclick="setAsistenciaEvolucionView('mensual')" class="px-2 py-0.5 rounded-md bg-bg-card text-brand-600 dark:text-brand-400 shadow-xs cursor-pointer">
                  Mensual
                </button>
                <button type="button" id="btn-evol-anual" onclick="setAsistenciaEvolucionView('anual')" class="px-2 py-0.5 rounded-md text-text-secondary hover:text-text-primary dark:hover:text-text-primary cursor-pointer">
                  Anual
                </button>
              </div>
            </div>
          </div>
          <div id="chart-asistencia-evolucion" class="w-full min-h-[220px] flex items-center justify-center text-xs text-text-tertiary">
            <i data-lucide="loader-2" class="h-5 w-5 animate-spin mr-2 text-brand-500"></i> Cargando gráfico...
          </div>
        </div>

      </div>

      <!-- BARRA DE HERRAMIENTAS Y FILTROS -->
      <div class="glass-card p-3.5 rounded-2xl border border-border-ui bg-bg-header space-y-3 shadow-xs">
        <div class="flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-3">
          
          <!-- Filtros de Búsqueda y Dropdowns -->
          <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 flex-1">
            <!-- Buscador -->
            <div class="relative">
              <i data-lucide="search" class="absolute left-3 top-2.5 h-3.5 w-3.5 text-text-tertiary"></i>
              <input type="text" id="filter-asistencia-search" oninput="handleAsistenciasFilterChange()" placeholder="Buscar por nombre, depto, motivo..."
                class="w-full pl-8.5 pr-3 py-1.5 glass-input rounded-xl text-xs text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-colors font-medium">
            </div>

            <!-- Filtro Canal -->
            <select id="filter-asistencia-canal" aria-label="Filtrar por canal de atención" onchange="handleAsistenciasFilterChange()" class="glass-input rounded-xl px-2.5 py-1.5 text-xs text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 cursor-pointer">
              <option value="todos">Canal: Todos</option>
              <option value="telefono">📞 Teléfono</option>
              <option value="correo">✉️ Correo</option>
              <option value="presencial">👥 Presencial</option>
              <option value="teams">💬 Teams</option>
            </select>

            <!-- Filtro Materia -->
            <select id="filter-asistencia-categoria" aria-label="Filtrar por materia o categoría" onchange="handleAsistenciasFilterChange()" class="glass-input rounded-xl px-2.5 py-1.5 text-xs text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 cursor-pointer">
              <option value="todas">Materia: Todas</option>
            </select>

            <!-- Filtro Estado -->
            <select id="filter-asistencia-estado" aria-label="Filtrar por estado de atención" onchange="handleAsistenciasFilterChange()" class="glass-input rounded-xl px-2.5 py-1.5 text-xs text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 cursor-pointer">
              <option value="todos">Estado: Todos</option>
              <option value="resuelta">🟢 Resuelta</option>
              <option value="en_seguimiento">🟡 En Seguimiento</option>
              <option value="derivada">🔵 Derivada</option>
            </select>
          </div>

          <!-- Botones de Acción y Exportación -->
          <div class="flex items-center gap-2 shrink-0 justify-end">
            <button onclick="toggleAssistanceDock()" class="px-3.5 py-1.5 bg-brand-600 hover:bg-brand-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-xs cursor-pointer" title="Registrar asistencia en consola flotante (Ctrl+Shift+A)">
              <i data-lucide="plus" class="h-3.5 w-3.5"></i>
              <span>Nueva Asistencia</span>
              <span class="text-[9px] bg-brand-700/60 px-1 py-0.5 rounded font-mono hidden sm:inline">Ctrl+Shift+A</span>
            </button>
            <button onclick="exportAsistenciasExcel()" class="px-3 py-1.5 bg-bg-card hover:bg-border-ui dark:hover:bg-border-ui/50 text-text-secondary border border-border-ui rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer" title="Exportar bitácora a Excel">
              <i data-lucide="file-spreadsheet" class="h-3.5 w-3.5 text-emerald-500"></i>
              <span class="hidden sm:inline">Excel</span>
            </button>
            <button onclick="exportAsistenciasConsolidadoPDF()" class="px-3 py-1.5 bg-bg-card hover:bg-border-ui dark:hover:bg-border-ui/50 text-text-secondary border border-border-ui rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer" title="Exportar reporte consolidado en PDF">
              <i data-lucide="file-text" class="h-3.5 w-3.5 text-rose-500"></i>
              <span class="hidden sm:inline">PDF</span>
            </button>
          </div>
        </div>
      </div>

      <!-- TABLA DE BITÁCORA DE ATENCIONES -->
      <div class="glass-card rounded-2xl overflow-hidden border border-border-ui bg-bg-header shadow-xs">
        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs border-collapse">
            <thead>
              <tr class="border-b border-border-ui bg-bg-main text-[10px] font-bold text-text-tertiary uppercase tracking-wider">
                <th class="px-4 py-3 text-left w-32">Ticket / Fecha</th>
                <th class="px-3 py-3 text-center w-24">Canal</th>
                <th class="px-4 py-3 text-left min-w-[150px]">Solicitante</th>
                <th class="px-4 py-3 text-left w-28">Dirección</th>
                <th class="px-3 py-3 text-left w-36">Materia</th>
                <th class="px-4 py-3 text-left min-w-[220px]">Motivo & Orientación</th>
                <th class="px-3 py-3 text-center w-36">Estado</th>
                <th class="px-4 py-3 text-right w-36">Acciones</th>
              </tr>
            </thead>
            <tbody id="tabla-asistencias-body" class="divide-y divide-border-ui divide-border-ui">
              <tr>
                <td colspan="8" class="text-center py-8 text-text-tertiary">
                  <i data-lucide="loader-2" class="h-5 w-5 animate-spin mx-auto mb-2 text-brand-500"></i>
                  Cargando bitácora de asistencias...
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Paginación shadcn/ui -->
        <div id="asistencia-pagination" class="p-3 border-t border-border-ui flex items-center justify-between text-xs text-text-tertiary">
          <span id="asistencia-page-info">Mostrando 0 de 0 registros</span>
          <div class="flex items-center gap-2">
            <button id="btn-asistencia-prev" onclick="changeAsistenciaPage(-1)" class="h-8 px-3 rounded-lg border border-border-ui bg-bg-card text-text-secondary hover:bg-border-ui dark:hover:bg-border-ui/50 hover:text-text-primary dark:hover:text-text-primary disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold shadow-2xs transition-colors cursor-pointer active:scale-95">Anterior</button>
            <button id="btn-asistencia-next" onclick="changeAsistenciaPage(1)" class="h-8 px-3 rounded-lg border border-border-ui bg-bg-card text-text-secondary hover:bg-border-ui dark:hover:bg-border-ui/50 hover:text-text-primary dark:hover:text-text-primary disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold shadow-2xs transition-colors cursor-pointer active:scale-95">Siguiente</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Renderiza la sub-vista del Directorio de Contactos.
 * @returns {string} Fragmento HTML del directorio.
 */
function renderAsistenciaContactosViewHtml() {
  return `
    <div class="space-y-4">
      <!-- BARRA SUPERIOR DE CONTACTOS -->
      <div class="glass-card p-3.5 rounded-2xl border border-border-ui bg-bg-header shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div class="relative flex-1 max-w-md">
          <i data-lucide="search" class="absolute left-3 top-2.5 h-3.5 w-3.5 text-text-tertiary"></i>
          <input type="text" id="filter-contactos-search" oninput="handleContactosFilterChange()" placeholder="Buscar por nombre, dirección o correo..."
            class="w-full pl-8.5 pr-3 py-1.5 bg-bg-card border border-border-ui rounded-xl text-xs text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-colors font-medium">
        </div>

        <div class="flex items-center gap-2 justify-end">
          <button onclick="openModalNuevoContacto()" class="px-3.5 py-1.5 bg-brand-600 hover:bg-brand-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-xs cursor-pointer">
            <i data-lucide="user-plus" class="h-3.5 w-3.5"></i>
            <span>Nuevo Contacto</span>
          </button>
          <button onclick="openModalMergeContactos()" class="px-3.5 py-1.5 bg-purple-50 hover:bg-purple-100 dark:bg-purple-600/15 dark:hover:bg-purple-600/25 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-500/30 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer" title="Unificar contactos duplicados">
            <i data-lucide="git-merge" class="h-3.5 w-3.5"></i>
            <span>Unificar Duplicados</span>
          </button>
        </div>
      </div>

      <!-- TABLA DEL DIRECTORIO -->
      <div class="glass-card rounded-2xl overflow-hidden border border-border-ui bg-bg-header shadow-xs">
        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs border-collapse">
            <thead>
              <tr class="border-b border-border-ui bg-bg-main text-[10px] font-bold text-text-tertiary uppercase tracking-wider">
                <th class="px-4 py-3">Funcionario / Solicitante</th>
                <th class="px-4 py-3">Dirección Habitual</th>
                <th class="px-4 py-3">Correo Institucional</th>
                <th class="px-4 py-3">Anexo / Contacto</th>
                <th class="px-3 py-3 text-center w-28">Atenciones</th>
                <th class="px-4 py-3 text-right w-28">Acciones</th>
              </tr>
            </thead>
            <tbody id="tabla-contactos-body" class="divide-y divide-border-ui divide-border-ui">
              <tr>
                <td colspan="6" class="text-center py-8 text-text-tertiary">
                  <i data-lucide="loader-2" class="h-5 w-5 animate-spin mx-auto mb-2 text-brand-500"></i>
                  Cargando directorio de contactos...
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

/**
 * Renderiza la sub-vista de Materias y Categorías de Asistencia.
 * @returns {string} Fragmento HTML de materias.
 */
function renderAsistenciaCategoriasViewHtml() {
  return `
    <div class="space-y-4">
      <!-- BARRA SUPERIOR DE CATEGORÍAS -->
      <div class="glass-card p-3.5 rounded-2xl border border-border-ui bg-bg-header shadow-xs flex items-center justify-between gap-3">
        <div>
          <h3 class="text-xs font-bold text-text-primary uppercase tracking-wider flex items-center gap-2">
            <i data-lucide="tags" class="h-4 w-4 text-brand-500"></i>
            <span>Materias / Categorías de Asistencia Técnica</span>
          </h3>
          <p class="text-[10px] text-text-tertiary mt-0.5">
            Configura las materias que aparecen en los desplegables de registro y en las estadísticas de atención.
          </p>
        </div>

        <div class="flex items-center gap-2 shrink-0">
          <button id="btn-toggle-reordenar-categorias" onclick="toggleReordenarCategorias()" class="px-3 py-1.5 rounded-xl text-xs font-semibold border border-border-ui bg-bg-card hover:bg-border-ui text-text-secondary hover:text-text-primary flex items-center gap-1.5 transition-all cursor-pointer">
            <i data-lucide="arrow-up-down" class="h-3.5 w-3.5"></i>
            <span>Reordenar</span>
          </button>
          <button onclick="openModalNuevaCategoria()" class="px-3.5 py-1.5 bg-brand-600 hover:bg-brand-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-xs cursor-pointer shrink-0">
            <i data-lucide="plus" class="h-3.5 w-3.5"></i>
            <span>Nueva Materia</span>
          </button>
        </div>
      </div>

      <!-- TABLA DE CATEGORÍAS -->
      <div class="glass-card rounded-2xl overflow-hidden border border-border-ui bg-bg-header shadow-xs">
        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs border-collapse">
            <thead>
              <tr class="border-b border-border-ui bg-bg-main text-[10px] font-bold text-text-tertiary uppercase tracking-wider">
                <th class="px-4 py-3 w-28 text-center"># / Orden</th>
                <th class="px-4 py-3 w-72">Nombre de la Materia</th>
                <th class="px-4 py-3">Descripción / Alcance</th>
                <th class="px-4 py-3 text-right w-28">Acciones</th>
              </tr>
            </thead>
            <tbody id="tabla-categorias-body" class="divide-y divide-border-ui divide-border-ui">
              <tr>
                <td colspan="4" class="text-center py-8 text-text-tertiary">
                  <i data-lucide="loader-2" class="h-5 w-5 animate-spin mx-auto mb-2 text-brand-500"></i>
                  Cargando materias y categorías...
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

/**
 * Renderiza la sub-vista de Direcciones Municipales Oficiales.
 * @returns {string} Fragmento HTML de direcciones.
 */
function renderAsistenciaDireccionesViewHtml() {
  return `
    <div class="space-y-4">
      <!-- BARRA SUPERIOR DE DIRECCIONES -->
      <div class="glass-card p-3.5 rounded-2xl border border-border-ui bg-bg-header shadow-xs flex items-center justify-between gap-3">
        <div>
          <h3 class="text-xs font-bold text-text-primary uppercase tracking-wider flex items-center gap-2">
            <i data-lucide="building-2" class="h-4 w-4 text-brand-500"></i>
            <span>Catálogo de Direcciones Municipales</span>
          </h3>
          <p class="text-[10px] text-text-tertiary mt-0.5">
            Configura las direcciones y departamentos municipales para el autocompletado en tickets y estadísticas.
          </p>
        </div>

        <div class="flex items-center gap-2 shrink-0">
          <button id="btn-ordenar-alfabetico-direcciones" onclick="ordenarDireccionesAlfabetico()" class="hidden px-3 py-1.5 rounded-xl text-xs font-semibold border border-brand-500/40 bg-brand-500/10 hover:bg-brand-500/20 text-brand-600 dark:text-brand-400 flex items-center gap-1.5 transition-all cursor-pointer shadow-xs" title="Ordenar automáticamente todas las direcciones por acrónimo (A-Z)">
            <i data-lucide="arrow-down-a-z" class="h-3.5 w-3.5"></i>
            <span>Ordenar A-Z (Acrónimo)</span>
          </button>
          <button id="btn-toggle-reordenar-direcciones" onclick="toggleReordenarDirecciones()" class="px-3 py-1.5 rounded-xl text-xs font-semibold border border-border-ui bg-bg-card hover:bg-border-ui text-text-secondary hover:text-text-primary flex items-center gap-1.5 transition-all cursor-pointer">
            <i data-lucide="arrow-up-down" class="h-3.5 w-3.5"></i>
            <span>Reordenar</span>
          </button>
          <button onclick="openModalNuevaDireccion()" class="px-3.5 py-1.5 bg-brand-600 hover:bg-brand-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-xs cursor-pointer shrink-0">
            <i data-lucide="plus" class="h-3.5 w-3.5"></i>
            <span>Nueva Dirección</span>
          </button>
        </div>
      </div>

      <!-- TABLA DE DIRECCIONES -->
      <div class="glass-card rounded-2xl overflow-hidden border border-border-ui bg-bg-header shadow-xs">
        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs border-collapse">
            <thead>
              <tr class="border-b border-border-ui bg-bg-main text-[10px] font-bold text-text-tertiary uppercase tracking-wider">
                <th class="px-4 py-3 w-20 text-center"># / Orden</th>
                <th class="px-4 py-3 w-32">Acrónimo</th>
                <th class="px-4 py-3">Nombre de la Dirección</th>
                <th class="px-4 py-3 text-right w-28">Acciones</th>
              </tr>
            </thead>
            <tbody id="tabla-direcciones-body" class="divide-y divide-border-ui">
              <tr>
                <td colspan="4" class="text-center py-8 text-text-tertiary">
                  <i data-lucide="loader-2" class="h-5 w-5 animate-spin mx-auto mb-2 text-brand-500"></i>
                  Cargando catálogo de direcciones municipales...
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}



/**
 * Alterna entre las diferentes sub-pestañas del módulo de asistencia.
 * @param {string} subTab - Identificador de la sub-pestaña.
 */
function changeAsistenciaSubTab(subTab) {
  window.activeAsistenciaSubTab = subTab;
  const container = document.getElementById('asistencia-subtab-content');
  if (!container) return;

  if (subTab === 'contactos') {
    container.innerHTML = renderAsistenciaContactosViewHtml();
    loadContactosData();
  } else if (subTab === 'categorias') {
    container.innerHTML = renderAsistenciaCategoriasViewHtml();
    loadCategoriasData();
  } else if (subTab === 'direcciones') {
    container.innerHTML = renderAsistenciaDireccionesViewHtml();
    loadDireccionesData();
  } else {
    container.innerHTML = renderAsistenciaBitacoraViewHtml();
    loadAsistenciaStats();
    loadAsistenciasData();
    populateBitacoraCategoriasFilter();
  }

  // Actualizar estilos de los botones de sub-pestaña
  const navButtons = document.querySelectorAll('button[onclick*="changeAsistenciaSubTab"]');
  navButtons.forEach(btn => {
    const isTarget = btn.getAttribute('onclick').includes(`'${subTab}'`);
    btn.className = isTarget
      ? "px-4 py-2 rounded-xl text-xs font-bold bg-brand-600 text-white shadow-2xs flex items-center gap-2 transition-all"
      : "px-4 py-2 rounded-xl text-xs font-semibold text-text-tertiary hover:text-text-primary hover:bg-border-ui/50 flex items-center gap-2 transition-all cursor-pointer";
  });

  if (window.lucide) window.lucide.createIcons();
}
window.changeAsistenciaSubTab = changeAsistenciaSubTab;

/**
 * Inicializa los datos y controladores al entrar a la pestaña de Asistencia Técnica.
 */
function initAsistenciaTab() {
  if (window.activeAsistenciaSubTab === 'contactos') {
    loadContactosData();
  } else if (window.activeAsistenciaSubTab === 'categorias') {
    loadCategoriasData();
  } else if (window.activeAsistenciaSubTab === 'direcciones') {
    loadDireccionesData();
  } else {
    loadAsistenciaStats();
    loadAsistenciasData();
    populateBitacoraCategoriasFilter();
  }
}
window.initAsistenciaTab = initAsistenciaTab;

let chartAsistenciaDireccionesInstance = null;
let chartAsistenciaEvolucionInstance = null;
let currentAsistenciaEvolucionView = 'mensual';
window.asistenciaStatsData = null;

function setAsistenciaEvolucionView(view) {
  currentAsistenciaEvolucionView = view;
  ['semanal', 'mensual', 'anual'].forEach(v => {
    const btn = document.getElementById(`btn-evol-${v}`);
    if (btn) {
      if (v === view) {
        btn.className = "px-2 py-0.5 rounded-md bg-bg-card  text-brand-600 dark:text-brand-400 shadow-xs cursor-pointer";
      } else {
        btn.className = "px-2 py-0.5 rounded-md text-text-secondary  hover:text-text-primary dark:hover:text-text-primary cursor-pointer";
      }
    }
  });
  if (window.asistenciaStatsData) {
    renderAsistenciaEvolucionChart(window.asistenciaStatsData);
  }
}
window.setAsistenciaEvolucionView = setAsistenciaEvolucionView;

function renderAsistenciaDireccionesChart(stats) {
  const container = document.getElementById('chart-asistencia-direcciones');
  if (!container) return;

  if (chartAsistenciaDireccionesInstance) {
    try { chartAsistenciaDireccionesInstance.destroy(); } catch (err) { console.debug('chartAsistenciaDirecciones ya liberado:', err); }
    chartAsistenciaDireccionesInstance = null;
  }

  const isDark = document.documentElement.classList.contains('dark');
  const textColor = isDark ? '#e2e0ed' : '#18112b';
  const gridColor = isDark ? '#221e33' : '#edeaf5';
  const brandColor = isDark ? '#a78bfa' : '#7c3aed';

  const deptos = (stats && Array.isArray(stats.por_direccion) && stats.por_direccion.length > 0)
    ? stats.por_direccion.slice(0, 8)
    : [];

  if (deptos.length === 0) {
    container.innerHTML = '<div class="text-center text-text-tertiary text-xs py-10">Sin atenciones registradas todavía.</div>';
    return;
  }

  container.innerHTML = '';

  const categories = deptos.map(d => d.depto);
  const seriesData = deptos.map(d => d.count);

  const options = {
    chart: {
      type: 'bar',
      height: 240,
      fontFamily: 'Inter, sans-serif',
      foreColor: textColor,
      toolbar: { show: false }
    },
    plotOptions: {
      bar: {
        horizontal: true,
        barHeight: '35%',
        borderRadius: 4,
        borderRadiusApplication: 'end'
      }
    },
    colors: [brandColor],
    dataLabels: {
      enabled: false
    },
    series: [{
      name: 'Atenciones',
      data: seriesData
    }],
    xaxis: {
      categories: categories,
      labels: {
        style: { colors: textColor, fontSize: '10px' },
        formatter: (val) => Math.floor(val)
      },
      axisBorder: { show: false },
      axisTicks: { show: false }
    },
    yaxis: {
      labels: {
        style: { colors: textColor, fontSize: '11px', fontWeight: 500 },
        maxWidth: 140
      }
    },
    grid: {
      borderColor: gridColor,
      strokeDashArray: 4,
      xaxis: { lines: { show: true } },
      yaxis: { lines: { show: false } }
    },
    tooltip: {
      theme: isDark ? 'dark' : 'light',
      y: {
        formatter: (val) => `${val} atenciones`
      }
    }
  };

  chartAsistenciaDireccionesInstance = new ApexCharts(container, options);
  chartAsistenciaDireccionesInstance.render();
}

function renderAsistenciaEvolucionChart(stats) {
  const container = document.getElementById('chart-asistencia-evolucion');
  if (!container) return;

  if (chartAsistenciaEvolucionInstance) {
    try { chartAsistenciaEvolucionInstance.destroy(); } catch (err) { console.debug('chartAsistenciaEvolucion ya liberado:', err); }
    chartAsistenciaEvolucionInstance = null;
  }

  const isDark = document.documentElement.classList.contains('dark');
  const textColor = isDark ? '#e2e0ed' : '#18112b';
  const gridColor = isDark ? '#221e33' : '#edeaf5';
  const brandColor = isDark ? '#a78bfa' : '#7c3aed';
  const slateColor = isDark ? '#9a95b0' : '#9d8dbf';

  const fechas = (stats && Array.isArray(stats.fechas)) ? stats.fechas : [];

  if (fechas.length === 0) {
    container.innerHTML = '<div class="text-center text-text-tertiary text-xs py-10">Sin datos temporales registrados.</div>';
    return;
  }

  container.innerHTML = '';

  let categories = [];
  let series = [];

  const view = currentAsistenciaEvolucionView || 'mensual';
  const today = new Date();

  // Pre-calcular mapa de conteos por fecha exacta YYYY-MM-DD
  const countsByDate = {};
  fechas.forEach(fStr => {
    if (!fStr) return;
    const datePart = fStr.split(' ')[0].split('T')[0];
    if (datePart && datePart.length === 10) {
      countsByDate[datePart] = (countsByDate[datePart] || 0) + 1;
    }
  });

  if (view === 'semanal') {
    // 1. VISTA SEMANAL: Lunes a Viernes de la semana actual comparado con la semana anterior
    const day = today.getDay(); // 0: Dom, 1: Lun, ..., 6: Sáb
    const diffToMon = (day === 0 ? -6 : 1) - day;
    const curMon = new Date(today.getFullYear(), today.getMonth(), today.getDate() + diffToMon);

    categories = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie'];
    const curWeekData = [];
    const prevWeekData = [];
    const endOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);

    for (let i = 0; i < 5; i++) {
      const dCur = new Date(curMon.getFullYear(), curMon.getMonth(), curMon.getDate() + i);
      const dPrev = new Date(curMon.getFullYear(), curMon.getMonth(), curMon.getDate() - 7 + i);

      const keyCur = `${dCur.getFullYear()}-${String(dCur.getMonth() + 1).padStart(2, '0')}-${String(dCur.getDate()).padStart(2, '0')}`;
      const keyPrev = `${dPrev.getFullYear()}-${String(dPrev.getMonth() + 1).padStart(2, '0')}-${String(dPrev.getDate()).padStart(2, '0')}`;

      if (dCur > endOfToday) {
        curWeekData.push(null);
      } else {
        curWeekData.push(countsByDate[keyCur] || 0);
      }
      prevWeekData.push(countsByDate[keyPrev] || 0);
    }

    series = [
      {
        name: 'Semana Actual',
        data: curWeekData
      },
      {
        name: 'Semana Anterior',
        data: prevWeekData
      }
    ];
  } else if (view === 'anual') {
    // 3. VISTA ANUAL: 12 meses (Ene-Dic) Año Actual vs Año Anterior (Evolución Interanual)
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const currentYear = today.getFullYear();
    const previousYear = currentYear - 1;
    const currentYearMonthly = Array(12).fill(null);

    for (let m = 0; m < 12; m++) {
      if (m <= today.getMonth()) {
        currentYearMonthly[m] = 0;
      }
    }
    const previousYearMonthly = Array(12).fill(0);

    Object.keys(countsByDate).forEach(dateStr => {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        const count = countsByDate[dateStr];
        if (m >= 0 && m < 12) {
          if (y === currentYear) {
            if (currentYearMonthly[m] !== null) {
              currentYearMonthly[m] += count;
            }
          } else if (y === previousYear) {
            previousYearMonthly[m] += count;
          }
        }
      }
    });

    categories = months;
    series = [
      {
        name: `${currentYear} (Año Actual)`,
        data: currentYearMonthly
      },
      {
        name: `${previousYear} (Año Anterior)`,
        data: previousYearMonthly
      }
    ];
  } else {
    // 2. VISTA MENSUAL ACUMULADA: Días del 1 al 30/31 (Suma progresiva en el mismo eje)
    const curYear = today.getFullYear();
    const curMonth = today.getMonth(); // 0-11
    
    const prevDate = new Date(curYear, curMonth - 1, 1);
    const prevYear = prevDate.getFullYear();
    const prevMonth = prevDate.getMonth();

    const daysInCur = new Date(curYear, curMonth + 1, 0).getDate();
    const daysInPrev = new Date(prevYear, prevMonth + 1, 0).getDate();
    const maxDays = Math.max(daysInCur, daysInPrev);

    categories = Array.from({ length: maxDays }, (_, i) => String(i + 1));

    const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const curMonthData = [];
    const prevMonthData = [];
    let runningCur = 0;
    let runningPrev = 0;

    for (let d = 1; d <= maxDays; d++) {
      // Día d en mes actual acumulado
      if (d <= daysInCur) {
        const keyCur = `${curYear}-${String(curMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const count = countsByDate[keyCur] || 0;
        runningCur += count;

        if (d > today.getDate() && curYear === today.getFullYear() && curMonth === today.getMonth()) {
          curMonthData.push(null);
        } else {
          curMonthData.push(runningCur);
        }
      } else {
        curMonthData.push(null);
      }

      // Día d en mes anterior acumulado
      if (d <= daysInPrev) {
        const keyPrev = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const count = countsByDate[keyPrev] || 0;
        runningPrev += count;
        prevMonthData.push(runningPrev);
      } else {
        prevMonthData.push(null);
      }
    }

    series = [
      {
        name: `Mes Actual (${monthNames[curMonth]})`,
        data: curMonthData
      },
      {
        name: `Mes Anterior (${monthNames[prevMonth]})`,
        data: prevMonthData
      }
    ];
  }

  const options = {
    chart: {
      type: 'area',
      height: 240,
      fontFamily: 'Inter, sans-serif',
      foreColor: textColor,
      toolbar: { show: false }
    },
    series: series,
    colors: [brandColor, slateColor],
    stroke: {
      curve: 'smooth',
      width: [2.5, 1.8],
      dashArray: [0, 4]
    },
    fill: {
      type: 'gradient',
      gradient: {
        shadeIntensity: 1,
        opacityFrom: [0.28, 0.05],
        opacityTo: [0.03, 0],
        stops: [0, 90, 100]
      }
    },
    xaxis: {
      categories: categories,
      labels: {
        style: { colors: textColor, fontSize: '10px' }
      },
      axisBorder: { show: false },
      axisTicks: { show: false }
    },
    yaxis: {
      labels: {
        style: { colors: textColor, fontSize: '10px' },
        formatter: (val) => Math.floor(val)
      },
      min: 0,
      forceNiceScale: true
    },
    grid: {
      borderColor: gridColor,
      strokeDashArray: 4,
      xaxis: { lines: { show: false } },
      yaxis: { lines: { show: true } }
    },
    dataLabels: {
      enabled: false
    },
    legend: {
      show: true,
      position: 'bottom',
      fontSize: '11px',
      markers: { width: 8, height: 8, radius: 8 }
    },
    tooltip: {
      theme: isDark ? 'dark' : 'light',
      y: {
        formatter: (val) => {
          if (val === null || val === undefined) return 'Sin datos';
          return view === 'mensual' ? `${val} consultas acumuladas` : `${val} consultas`;
        }
      }
    }
  };

  chartAsistenciaEvolucionInstance = new ApexCharts(container, options);
  chartAsistenciaEvolucionInstance.render();
}

function renderAsistenciaCharts(stats) {
  if (typeof ApexCharts === 'undefined') return;
  renderAsistenciaDireccionesChart(stats);
  renderAsistenciaEvolucionChart(stats);
}

/**
 * Carga las estadísticas y métricas KPI mensuales de asistencia técnica.
 */
async function loadAsistenciaStats() {
  try {
    const res = await window.api.invokeRoute({
      url: '/api/asistencias/stats',
      method: 'GET'
    });

    if (res && res.status === 200 && res.data) {
      const stats = res.data;
      window.asistenciaStatsData = stats;

      const elTotal = document.getElementById('kpi-asistencia-total');
      const elPctTel = document.getElementById('kpi-asistencia-pct-tel');
      const elPend = document.getElementById('kpi-asistencia-pendientes');
      const elTopCat = document.getElementById('kpi-asistencia-top-cat');

      if (elTotal) elTotal.textContent = (stats.total_mes || 0).toLocaleString('es-CL');
      if (elPctTel) elPctTel.textContent = `${stats.tasa_resolucion !== undefined ? stats.tasa_resolucion : 100}%`;
      if (elPend) elPend.textContent = (stats.en_seguimiento || 0).toLocaleString('es-CL');
      if (elTopCat) elTopCat.textContent = stats.top_direccion || 'Sin registros';

      renderAsistenciaCharts(stats);
    }
  } catch (err) {
    console.warn('Error al cargar KPIs de asistencia:', err);
  }
}
window.loadAsistenciaStats = loadAsistenciaStats;

async function populateBitacoraCategoriasFilter() {
  const select = document.getElementById('filter-asistencia-categoria');
  if (!select) return;

  const currentValue = select.value;
  try {
    const res = await window.api.invokeRoute({ url: '/api/asistencias/categorias', method: 'GET' });
    if (res && res.status === 200 && Array.isArray(res.data)) {
      const options = ['<option value="todas">Materia: Todas</option>'];
      res.data.forEach(cat => {
        options.push(`<option value="${cat.nombre}">${cat.nombre}</option>`);
      });
      select.innerHTML = options.join('');
      if (currentValue && (currentValue === 'todas' || res.data.some(c => c.nombre === currentValue))) {
        select.value = currentValue;
      }
    }
  } catch (err) {
    console.warn('Error al poblar filtro de materias en bitácora:', err);
  }
}
window.populateBitacoraCategoriasFilter = populateBitacoraCategoriasFilter;

/**
 * Carga y renderiza el listado paginado y filtrado de asistencias.
 */
async function loadAsistenciasData() {
  const tbody = document.getElementById('tabla-asistencias-body');
  if (!tbody) return;

  const search = document.getElementById('filter-asistencia-search')?.value.trim() || '';
  const canal = document.getElementById('filter-asistencia-canal')?.value || 'todos';
  const categoria = document.getElementById('filter-asistencia-categoria')?.value || 'todas';
  const estado = document.getElementById('filter-asistencia-estado')?.value || 'todos';

  const params = new URLSearchParams({
    page: window.asistenciaPaginationState.page,
    limit: window.asistenciaPaginationState.limit
  });

  if (search) params.append('search', search);
  if (canal !== 'todos') params.append('canal', canal);
  if (categoria !== 'todas') params.append('categoria', categoria);
  if (estado !== 'todos') params.append('estado', estado);

  try {
    const res = await window.api.invokeRoute({
      url: `/api/asistencias?${params.toString()}`,
      method: 'GET'
    });

    if (res && res.status === 200 && res.data) {
      const total = res.data.total || 0;
      const page = res.data.page || 1;
      const totalPages = res.data.totalPages || res.data.total_pages || Math.ceil(total / (window.asistenciaPaginationState.limit || 10)) || 1;
      const rows = res.data.rows || [];

      window.asistenciaPaginationState.total = total;
      window.asistenciaPaginationState.page = page;
      window.asistenciaPaginationState.totalPages = totalPages;

      // Actualizar información de paginación
      const pageInfo = document.getElementById('asistencia-page-info');
      if (pageInfo) {
        const start = total === 0 ? 0 : (page - 1) * window.asistenciaPaginationState.limit + 1;
        const end = Math.min(page * window.asistenciaPaginationState.limit, total);
        pageInfo.textContent = `Mostrando ${start}-${end} de ${total} registros (Pág. ${page} de ${totalPages})`;
      }

      const btnPrev = document.getElementById('btn-asistencia-prev');
      const btnNext = document.getElementById('btn-asistencia-next');
      if (btnPrev) btnPrev.disabled = page <= 1;
      if (btnNext) btnNext.disabled = page >= totalPages;

      if (!rows || rows.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="8" class="text-center py-10 text-text-tertiary">
              <i data-lucide="inbox" class="h-6 w-6 mx-auto mb-2 text-text-tertiary"></i>
              No se encontraron registros de asistencias con los filtros seleccionados.
            </td>
          </tr>
        `;
        if (window.lucide) window.lucide.createIcons();
        return;
      }

      tbody.innerHTML = rows.map(r => {
        const canalBadges = {
          'telefono': '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20"><i data-lucide="phone" class="h-2.5 w-2.5"></i> Teléfono</span>',
          'correo': '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"><i data-lucide="mail" class="h-2.5 w-2.5"></i> Correo</span>',
          'presencial': '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20"><i data-lucide="users" class="h-2.5 w-2.5"></i> Presencial</span>',
          'teams': '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20"><i data-lucide="message-square" class="h-2.5 w-2.5"></i> Teams</span>'
        };

        const estadoBadges = {
          'resuelta': '<span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20"><span class="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>Resuelta</span>',
          'en_seguimiento': '<span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20"><span class="h-1.5 w-1.5 rounded-full bg-amber-500"></span>En Seguimiento</span>',
          'derivada': '<span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20"><span class="h-1.5 w-1.5 rounded-full bg-blue-500"></span>Derivada</span>'
        };

        const catNames = {
          'plazos': 'Plazos Legales',
          'plataforma': 'Uso Plataforma',
          'sujetos_pasivos': 'Sujetos Pasivos',
          'derivaciones': 'Derivaciones',
          'actas': 'Carga Actas',
          'normativa': 'Normativa Ley',
          'otro': 'General'
        };

        const fechaFmt = formatDateTime(r.fecha_hora);

        return `
          <tr class="hover:bg-border-ui dark:hover:bg-border-ui/50 transition-colors">
            <!-- 1. TICKET / FECHA -->
            <td class="px-4 py-3 align-middle text-left w-32 whitespace-nowrap">
              <button type="button" onclick="copiarFolio('${escapeHtml(r.ticket_codigo)}', event, 'Ticket')" 
                      class="group font-mono font-bold text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 inline-flex items-center gap-1 cursor-pointer active:scale-95 text-left whitespace-nowrap" 
                      title="Clic para copiar ticket ${escapeHtml(r.ticket_codigo)}">
                <span>${r.ticket_codigo}</span>
                <i data-lucide="copy" class="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></i>
              </button>
              <span class="text-[10px] text-text-tertiary block font-medium mt-0.5 whitespace-nowrap">${fechaFmt}</span>
            </td>

            <!-- 2. CANAL -->
            <td class="px-3 py-3 align-middle text-center w-24">
              <div class="flex justify-center">
                ${canalBadges[r.canal] || r.canal}
              </div>
            </td>

            <!-- 3. FUNCIONARIO SOLICITANTE -->
            <td class="px-4 py-3 align-middle text-left min-w-[150px]">
              <div class="font-bold text-text-primary">${r.solicitante_nombre}</div>
              ${r.representado ? `<div class="text-[11px] leading-snug text-brand-600 dark:text-brand-400 font-medium mt-0.5 break-words" title="En representación de: ${r.representado.replace(/"/g, '&quot;')}">↳ Por: ${r.representado}</div>` : ''}
              <div class="text-[10px] text-text-tertiary mt-0.5">${r.solicitante_correo || ''} ${(r.solicitante_telefono || r.solicitante_contacto) ? '· ' + (r.solicitante_telefono || r.solicitante_contacto) : ''}</div>
            </td>

            <!-- 4. DIRECCIÓN MUNICIPAL -->
            <td class="px-4 py-3 align-middle text-left w-28">
              <span class="font-semibold text-text-primary">${r.solicitante_direccion || r.solicitante_cargo_depto || '<span class="text-text-tertiary italic font-normal">General</span>'}</span>
            </td>

            <!-- 5. MATERIA (Limpio y legible estilo shadcn/ui) -->
            <td class="px-3 py-3 align-middle text-left w-36">
              <span class="text-xs font-medium text-text-secondary line-clamp-2 leading-tight" title="${catNames[r.categoria] || r.categoria}">
                ${catNames[r.categoria] || r.categoria}
              </span>
            </td>

            <!-- 6. MOTIVO & ORIENTACIÓN (UNIFICADO) -->
            <td class="px-4 py-3 align-middle text-left min-w-[220px]">
              <p class="text-text-primary line-clamp-2 text-xs leading-relaxed" title="${r.motivo_consulta}">${r.motivo_consulta || '<span class="text-text-tertiary italic">Sin motivo especificado</span>'}</p>
              ${r.solucion_orientacion ? `<p class="text-[10px] text-text-secondary dark:text-text-tertiary line-clamp-1 mt-1 font-medium" title="${r.solucion_orientacion}">↳ ${r.solucion_orientacion}</p>` : ''}
            </td>

            <!-- 7. ESTADO -->
            <td class="px-3 py-3 align-middle text-center w-36">
              <div class="flex justify-center">
                ${estadoBadges[r.estado] || r.estado}
              </div>
            </td>

            <!-- 8. ACCIONES (Ver Detalle + Eliminar) -->
            <td class="px-4 py-3 align-middle text-right w-36">
              <div class="flex items-center justify-end gap-1.5">
                <button onclick="openModalDetalleAsistencia(${r.id})" class="h-7 px-2.5 rounded-lg text-xs font-semibold bg-brand-50 hover:bg-brand-100 dark:bg-brand-950/50 dark:hover:bg-brand-900/60 text-brand-600 dark:text-brand-400 border border-brand-200 dark:border-brand-800 transition-colors shadow-2xs cursor-pointer inline-flex items-center gap-1.5 active:scale-95 whitespace-nowrap" title="Ver detalle de la atención">
                  <i data-lucide="eye" class="h-3.5 w-3.5 shrink-0"></i>
                  <span>Ver Detalle</span>
                </button>
                <button onclick="eliminarAsistencia(${r.id}, '${r.ticket_codigo}')" class="h-7 w-7 rounded-lg text-text-tertiary hover:text-rose-600 dark:hover:text-rose-400 bg-border-ui hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-border-ui hover:border-rose-200 dark:hover:border-rose-800 transition-colors cursor-pointer inline-flex items-center justify-center active:scale-95 shrink-0" title="Eliminar registro">
                  <i data-lucide="trash-2" class="h-3.5 w-3.5"></i>
                </button>
              </div>
            </td>
          </tr>
        `;
      }).join('');

      if (window.lucide) window.lucide.createIcons();
    }
  } catch (err) {
    console.error('Error al listar asistencias:', err);
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="text-center py-8 text-rose-400">
          <i data-lucide="alert-triangle" class="h-6 w-6 mx-auto mb-2"></i>
          Error al cargar asistencias: ${err.message}
        </td>
      </tr>
    `;
    if (window.lucide) window.lucide.createIcons();
  }
}
window.loadAsistenciasData = loadAsistenciasData;

function handleAsistenciasFilterChange() {
  clearTimeout(asistenciaFilterTimeout);
  asistenciaFilterTimeout = setTimeout(() => {
    window.asistenciaPaginationState.page = 1;
    loadAsistenciasData();
  }, 200);
}
window.handleAsistenciasFilterChange = handleAsistenciasFilterChange;

function changeAsistenciaPage(delta) {
  const target = window.asistenciaPaginationState.page + delta;
  if (target >= 1 && target <= window.asistenciaPaginationState.totalPages) {
    window.asistenciaPaginationState.page = target;
    loadAsistenciasData();
  }
}
window.changeAsistenciaPage = changeAsistenciaPage;

/**
 * Carga los registros del directorio de contactos frecuentes.
 */
async function loadContactosData() {
  const tbody = document.getElementById('tabla-contactos-body');
  if (!tbody) return;

  const search = document.getElementById('filter-contactos-search')?.value.trim() || '';

  try {
    const res = await window.api.invokeRoute({
      url: `/api/asistencias/contactos?search=${encodeURIComponent(search)}`,
      method: 'GET'
    });

    if (res && res.status === 200 && Array.isArray(res.data)) {
      const contacts = res.data;
      if (contacts.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="6" class="text-center py-10 text-text-tertiary">
              <i data-lucide="users" class="h-6 w-6 mx-auto mb-2 text-text-tertiary"></i>
              No hay funcionarios registrados en el directorio.
            </td>
          </tr>
        `;
        if (window.lucide) window.lucide.createIcons();
        return;
      }

      tbody.innerHTML = contacts.map(c => `
        <tr class="hover:bg-border-ui/50 transition-colors">
          <td class="px-4 py-3 font-bold text-text-primary flex items-center gap-2">
            <div class="h-7 w-7 rounded-lg bg-brand-500/10 text-brand-400 flex items-center justify-center font-bold text-xs shrink-0">
              ${(c.nombre || 'U').charAt(0).toUpperCase()}
            </div>
            <div>
              <span>${c.nombre}</span>
              ${c.notas ? `<p class="text-[10px] text-text-tertiary font-normal italic">${c.notas}</p>` : ''}
            </div>
          </td>
          <td class="px-4 py-3 text-text-secondary">
            ${c.direccion || c.depto_habitual || '<span class="text-text-tertiary italic">No especificada</span>'}
          </td>
          <td class="px-4 py-3 text-text-secondary font-mono text-[11px]">
            ${c.correo || '<span class="text-text-tertiary italic">Sin correo</span>'}
          </td>
          <td class="px-4 py-3 text-text-secondary">
            ${c.telefono || c.telefono_anexo || '<span class="text-text-tertiary italic">Sin teléfono</span>'}
          </td>
          <td class="px-3 py-3 text-center">
            <button onclick="filtrarBitacoraPorContacto('${c.nombre}')" class="px-2 py-0.5 rounded-full bg-brand-500/15 text-brand-400 hover:bg-brand-500/20 border border-brand-500/30 text-[10px] font-bold transition-all cursor-pointer" title="Ver atenciones de este contacto">
              ${c.total_asistencias || 0} atenciones
            </button>
          </td>
          <td class="px-4 py-3 text-right">
            <div class="flex items-center justify-end gap-1">
              <button onclick="openModalEditarContacto(${c.id})" class="p-1.5 rounded-lg bg-border-ui/50 hover:bg-border-ui/50 text-text-secondary hover:text-text-primary border border-border-ui transition-all cursor-pointer" title="Editar contacto">
                <i data-lucide="edit-3" class="h-3.5 w-3.5 pointer-events-none"></i>
              </button>
              <button data-id="${c.id}" data-nombre="${typeof escapeHtmlAttr === 'function' ? escapeHtmlAttr(c.nombre) : escapeHtml(c.nombre)}" onclick="eliminarContacto(this)" class="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 transition-all cursor-pointer" title="Eliminar contacto">
                <i data-lucide="trash-2" class="h-3.5 w-3.5 pointer-events-none"></i>
              </button>
            </div>
          </td>
        </tr>
      `).join('');

      if (window.lucide) window.lucide.createIcons();
    }
  } catch (err) {
    console.error('Error al listar contactos:', err);
  }
}
window.loadContactosData = loadContactosData;

function handleContactosFilterChange() {
  clearTimeout(contactosFilterTimeout);
  contactosFilterTimeout = setTimeout(loadContactosData, 200);
}
window.handleContactosFilterChange = handleContactosFilterChange;

function filtrarBitacoraPorContacto(nombre) {
  changeAsistenciaSubTab('bitacora');
  setTimeout(() => {
    const input = document.getElementById('filter-asistencia-search');
    if (input) {
      input.value = nombre;
      handleAsistenciasFilterChange();
    }
  }, 100);
}
window.filtrarBitacoraPorContacto = filtrarBitacoraPorContacto;

/**
 * Abre la consola dock en modo detalle o edición para un ticket determinado.
 * @param {number|string} id - Identificador del ticket.
 */
async function openModalDetalleAsistencia(id) {
  if (typeof window.openAssistanceDock === 'function') {
    window.openAssistanceDock(id);
  } else if (window.api && window.api.openAssistanceWindow) {
    await window.api.openAssistanceWindow(id);
  }
}
window.openModalDetalleAsistencia = openModalDetalleAsistencia;


/**
 * Gestiona la eliminación de un contacto del directorio.
 * @param {HTMLElement} btnOrChild - Elemento disparador.
 */
let isDeletingContacto = false;
function eliminarContacto(btnOrChild) {
  const btn = btnOrChild.closest('button') || btnOrChild;
  const id = parseInt(btn.getAttribute('data-id'), 10);
  const nombre = btn.getAttribute('data-nombre') || 'este contacto';

  if (!id) return;

  openConfirmModal(
    'Eliminar Contacto',
    `¿Estás seguro de eliminar a <strong>${escapeHtml(nombre)}</strong> del directorio? Sus atenciones registradas se conservarán intactas en la bitácora con todos sus datos históricos.`,
    async () => {
      if (isDeletingContacto) return;
      isDeletingContacto = true;
      try {
        const res = await window.api.invokeRoute({
          url: `/api/asistencias/contactos/${id}`,
          method: 'DELETE'
        });

        if (res && res.status === 200) {
          showToast(res.data?.message || 'Contacto eliminado con éxito.', 'success');
          loadContactosData();
        } else {
          showToast('Error al eliminar contacto: ' + (res?.data?.error || 'Error desconocido'), 'error');
        }
      } catch (e) {
        showToast('Error de red al eliminar: ' + (typeof translateError === 'function' ? translateError(e.message) : e.message), 'error');
      } finally {
        isDeletingContacto = false;
      }
    }
  );
}
window.eliminarContacto = eliminarContacto;

/**
 * Despliega el modal de creación o edición de un contacto.
 * @param {number|null} id - Identificador opcional del contacto.
 */
function openModalNuevoContacto() {
  openModalEditarContacto(null);
}
window.openModalNuevoContacto = openModalNuevoContacto;

async function openModalEditarContacto(id) {
  let contact = { nombre: '', direccion: '', correo: '', telefono: '', notas: '' };
  if (id) {
    try {
      const res = await window.api.invokeRoute({ url: '/api/asistencias/contactos', method: 'GET' });
      if (res && res.status === 200 && Array.isArray(res.data)) {
        const found = res.data.find(c => c.id === id);
        if (found) contact = found;
      }
    } catch (err) {
      console.error('Error al cargar detalle de contacto:', err);
      showToast('No se pudo cargar la información del contacto.', 'error');
    }
  }

  // Cargar catálogo de direcciones municipales oficiales para el datalist
  let direccionesOptionsHtml = '';
  try {
    const dirRes = await window.api.invokeRoute({ url: '/api/direcciones', method: 'GET' });
    if (dirRes && dirRes.status === 200 && Array.isArray(dirRes.data)) {
      direccionesOptionsHtml = dirRes.data
        .filter(d => d.activo !== 0)
        .map(d => `<option value="${escapeHtmlAttr(d.acronimo)}">${escapeHtml(d.nombre)}</option>`)
        .join('');
    }
  } catch (dErr) {
    console.warn('No se pudieron cargar las direcciones oficiales para el datalist:', dErr);
  }

  const modal = document.getElementById('modal-container');
  if (!modal) return;

  modal.innerHTML = `
    <div class="fixed inset-0 bg-bg-main backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div class="bg-bg-card border border-border-ui rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-fade-in flex flex-col">
        
        <div class="p-4 border-b border-border-ui flex items-center justify-between bg-bg-main">
          <h3 class="font-bold text-sm text-text-primary flex items-center gap-2">
            <i data-lucide="user" class="h-4 w-4 text-brand-400"></i>
            <span>${id ? 'Editar Contacto' : 'Nuevo Contacto de Asistencia'}</span>
          </h3>
          <button onclick="closeModal()" title="Cerrar modal" aria-label="Cerrar modal" class="p-1.5 rounded-lg hover:bg-border-ui/50 text-text-tertiary hover:text-text-primary transition-all cursor-pointer">
            <i data-lucide="x" class="h-4 w-4"></i>
          </button>
        </div>

        <div class="p-4 space-y-3 text-xs">
          <div>
            <label class="text-[10px] font-bold uppercase text-text-tertiary block mb-1">Nombre Completo *</label>
            <input type="text" id="modal-contacto-nombre" value="${escapeHtmlAttr(contact.nombre)}" placeholder="Ej. Lorena Soto" class="w-full bg-bg-main border border-border-ui rounded-lg p-2 text-text-primary focus:border-brand-500 font-medium">
          </div>
          <div>
            <label class="text-[10px] font-bold uppercase text-text-tertiary block mb-1">Dirección Municipal</label>
            <input type="text" id="modal-contacto-direccion" list="datalist-direcciones-modal" value="${escapeHtmlAttr(contact.direccion || contact.depto_habitual || '')}" placeholder="Ej. DOM, DAF, SECPLA..." class="w-full bg-bg-main border border-border-ui rounded-lg p-2 text-text-primary focus:border-brand-500" autocomplete="off">
            <datalist id="datalist-direcciones-modal">
              ${direccionesOptionsHtml}
            </datalist>
          </div>
          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="text-[10px] font-bold uppercase text-text-tertiary block mb-1">Correo (@maipu.cl)</label>
              <input type="text" id="modal-contacto-correo" value="${escapeHtmlAttr(contact.correo || '')}" placeholder="lsoto@maipu.cl" class="w-full bg-bg-main border border-border-ui rounded-lg p-2 text-text-primary focus:border-brand-500">
            </div>
            <div>
              <label class="text-[10px] font-bold uppercase text-text-tertiary block mb-1">Teléfono</label>
              <input type="text" id="modal-contacto-telefono" value="${escapeHtmlAttr(contact.telefono || contact.telefono_anexo || '')}" placeholder="4321" class="w-full bg-bg-main border border-border-ui rounded-lg p-2 text-text-primary focus:border-brand-500">
            </div>
          </div>
          <div>
            <label class="text-[10px] font-bold uppercase text-text-tertiary block mb-1">Notas Internas</label>
            <textarea id="modal-contacto-notas" rows="2" placeholder="Observaciones o notas de contacto..." class="w-full bg-bg-main border border-border-ui rounded-lg p-2 text-text-primary focus:border-brand-500 resize-none">${escapeHtml(contact.notas || '')}</textarea>
          </div>
        </div>

        <div class="p-3 border-t border-border-ui bg-bg-main flex items-center justify-end gap-2">
          <button onclick="closeModal()" class="px-3 py-1.5 rounded-lg bg-border-ui/50 hover:bg-border-ui/50 text-text-secondary text-xs font-semibold cursor-pointer">
            Cancelar
          </button>
          <button onclick="guardarContacto(${id || 'null'})" class="px-4 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold cursor-pointer">
            Guardar Contacto
          </button>
        </div>

      </div>
    </div>
  `;

  modal.classList.remove('hidden');
  if (window.lucide) window.lucide.createIcons();
}
window.openModalEditarContacto = openModalEditarContacto;

async function guardarContacto(id) {
  const nombre = document.getElementById('modal-contacto-nombre')?.value.trim();
  const direccion = document.getElementById('modal-contacto-direccion')?.value.trim();
  const correo = document.getElementById('modal-contacto-correo')?.value.trim();
  const telefono = document.getElementById('modal-contacto-telefono')?.value.trim();
  const notas = document.getElementById('modal-contacto-notas')?.value.trim();

  if (!nombre) {
    showToast('El nombre del funcionario es obligatorio.', 'error');
    return;
  }

  try {
    const url = id ? `/api/asistencias/contactos/${id}` : '/api/asistencias/contactos';
    const method = id ? 'PUT' : 'POST';

    const res = await window.api.invokeRoute({
      url,
      method,
      body: {
        nombre,
        direccion,
        correo,
        telefono,
        notas
      }
    });

    if (res && (res.status === 200 || res.status === 201)) {
      showToast('Contacto guardado exitosamente.', 'success');
      closeModal();
      loadContactosData();
    } else {
      showToast('Error: ' + (res?.data?.error || 'No se pudo guardar'), 'error');
    }
  } catch (err) {
    showToast('Error de red: ' + err.message, 'error');
  }
}
window.guardarContacto = guardarContacto;

/**
 * Despliega el modal de unificación para fusionar contactos duplicados.
 * @param {number} idPrimario - Identificador del contacto principal.
 * @param {string} nombrePrimario - Nombre del contacto principal.
 */
async function openModalMergeContactos() {
  try {
    const res = await window.api.invokeRoute({ url: '/api/asistencias/contactos', method: 'GET' });
    if (!res || res.status !== 200 || !Array.isArray(res.data)) {
      showToast('No se pudieron obtener los contactos para unificar.', 'error');
      return;
    }

    const contacts = res.data;
    if (contacts.length < 2) {
      showToast('Se requieren al menos 2 contactos en el directorio para realizar una unificación.', 'info');
      return;
    }

    const modal = document.getElementById('modal-container');
    if (!modal) return;

    modal.innerHTML = `
      <div class="fixed inset-0 bg-bg-main backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div class="bg-bg-card border border-border-ui rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-fade-in flex flex-col max-h-[90vh]">
          
          <div class="p-4 border-b border-border-ui flex items-center justify-between bg-bg-main">
            <h3 class="font-bold text-sm text-text-primary flex items-center gap-2">
              <i data-lucide="git-merge" class="h-4 w-4 text-purple-400"></i>
              <span>Unificar Contactos Duplicados</span>
            </h3>
            <button onclick="closeModal()" title="Cerrar modal" aria-label="Cerrar modal" class="p-1.5 rounded-lg hover:bg-border-ui/50 text-text-tertiary hover:text-text-primary transition-all cursor-pointer">
              <i data-lucide="x" class="h-4 w-4"></i>
            </button>
          </div>

          <div class="p-4 overflow-y-auto space-y-4 text-xs">
            <p class="text-text-secondary">
              Esta herramienta fusiona los registros duplicados en un único contacto principal. Todas las bitácoras asociadas se reasignarán automáticamente.
            </p>

            <div>
              <label class="text-[10px] font-bold uppercase text-brand-600 dark:text-brand-400 block mb-1">1. Selecciona el Contacto Principal (Destino que prevalece):</label>
              <select id="merge-target-id" aria-label="Contacto principal de destino para la unificación" class="w-full glass-input border border-border-ui rounded-lg p-2 text-text-primary focus:border-brand-500 font-medium">
                ${contacts.map(c => `<option value="${c.id}">${c.nombre} (${c.direccion || c.depto_habitual || 'Sin Dirección'}) - ${c.total_asistencias} atenciones</option>`).join('')}
              </select>
            </div>

            <div>
              <label class="text-[10px] font-bold uppercase text-rose-400 block mb-1">2. Marca los contactos duplicados que serán absorbidos y eliminados:</label>
              <div class="bg-bg-main border border-border-ui rounded-lg p-2 max-h-48 overflow-y-auto divide-y divide-border-ui space-y-1">
                ${contacts.map(c => `
                  <label class="flex items-center gap-2 p-1.5 hover:bg-border-ui rounded cursor-pointer">
                    <input type="checkbox" name="merge-source" value="${c.id}" class="rounded border-border-ui bg-bg-card text-purple-600 focus:ring-0">
                    <span class="font-medium text-text-secondary">${c.nombre}</span>
                    <span class="text-[10px] text-text-tertiary">(${c.direccion || c.depto_habitual || 'Sin dirección'}) · ${c.total_asistencias} atenciones</span>
                  </label>
                `).join('')}
              </div>
            </div>
          </div>

          <div class="p-3 border-t border-border-ui bg-bg-main flex items-center justify-end gap-2">
            <button onclick="closeModal()" class="px-3 py-1.5 rounded-lg bg-border-ui/50 hover:bg-border-ui/50 text-text-secondary text-xs font-semibold cursor-pointer">
              Cancelar
            </button>
            <button onclick="ejecutarMergeContactos()" class="px-4 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold cursor-pointer flex items-center gap-1.5">
              <i data-lucide="git-merge" class="h-3.5 w-3.5"></i>
              <span>Unificar y Reasignar</span>
            </button>
          </div>

        </div>
      </div>
    `;

    modal.classList.remove('hidden');

    const targetSelect = document.getElementById('merge-target-id');
    const updateMergeSourceCheckboxes = () => {
      const currentTarget = parseInt(targetSelect?.value, 10);
      document.querySelectorAll('input[name="merge-source"]').forEach(cb => {
        const isCurrentTarget = parseInt(cb.value, 10) === currentTarget;
        const label = cb.closest('label');
        if (isCurrentTarget) {
          cb.checked = false;
          cb.disabled = true;
          if (label) {
            label.classList.add('opacity-40', 'pointer-events-none');
            label.classList.remove('cursor-pointer');
          }
        } else {
          cb.disabled = false;
          if (label) {
            label.classList.remove('opacity-40', 'pointer-events-none');
            label.classList.add('cursor-pointer');
          }
        }
      });
    };

    if (targetSelect) {
      targetSelect.addEventListener('change', updateMergeSourceCheckboxes);
      updateMergeSourceCheckboxes();
    }

    if (window.lucide) window.lucide.createIcons();
  } catch (err) {
    showToast('Error al abrir unificador: ' + err.message, 'error');
  }
}
window.openModalMergeContactos = openModalMergeContactos;

async function ejecutarMergeContactos() {
  const targetId = parseInt(document.getElementById('merge-target-id')?.value, 10);
  const checkedBoxes = document.querySelectorAll('input[name="merge-source"]:checked');
  const sourceIds = Array.from(checkedBoxes).map(cb => parseInt(cb.value, 10)).filter(id => id !== targetId);

  if (sourceIds.length === 0) {
    showToast('Debes seleccionar al menos un contacto duplicado diferente al destino.', 'error');
    return;
  }

  openConfirmModal(
    'Confirmar Unificación de Contactos',
    `¿Confirmas la unificación de ${sourceIds.length} contacto(s) en el contacto principal? Todos los tickets asociados serán reasignados y las fichas duplicadas se eliminarán permanentemente.`,
    async () => {
      try {
        const res = await window.api.invokeRoute({
          url: '/api/asistencias/contactos/unificar',
          method: 'POST',
          body: {
            target_id: targetId,
            source_ids: sourceIds
          }
        });

        if (res && res.status === 200) {
          showToast(res.data.message || 'Contactos unificados con éxito.', 'success');
          closeModal();
          loadContactosData();
          loadAsistenciaStats();
          loadAsistenciasData();
        } else {
          showToast('Error al unificar: ' + (res?.data?.error || 'Error desconocido'), 'error');
        }
      } catch (err) {
        showToast('Error de red: ' + (typeof translateError === 'function' ? translateError(err.message) : err.message), 'error');
      }
    }
  );
}
window.ejecutarMergeContactos = ejecutarMergeContactos;

/**
 * Elimina un registro de atención técnica tras confirmación.
 * @param {number} id - Identificador del registro.
 * @param {string} codigo - Código visual del ticket.
 */
async function eliminarAsistencia(id, codigo) {
  openConfirmModal(
    'Eliminar Registro de Asistencia',
    `¿Estás seguro de eliminar el registro ${codigo}? Esta acción es permanente y no se puede deshacer.`,
    async () => {
      try {
        const res = await window.api.invokeRoute({
          url: `/api/asistencias/${id}`,
          method: 'DELETE'
        });

        if (res && res.status === 200) {
          showToast(`Registro ${codigo} eliminado.`, 'success');
          loadAsistenciaStats();
          loadAsistenciasData();
        } else {
          showToast('Error al eliminar: ' + (res?.data?.error || 'Error desconocido'), 'error');
        }
      } catch (err) {
        showToast('Error de red: ' + (typeof translateError === 'function' ? translateError(err.message) : err.message), 'error');
      }
    }
  );
}
window.eliminarAsistencia = eliminarAsistencia;


/**
 * Genera la exportación consolidada de la bitácora a Excel.
 */
async function exportAsistenciasExcel() {
  try {
    const search = document.getElementById('filter-asistencia-search')?.value.trim() || '';
    const canal = document.getElementById('filter-asistencia-canal')?.value || 'todos';
    const categoria = document.getElementById('filter-asistencia-categoria')?.value || 'todas';
    const estado = document.getElementById('filter-asistencia-estado')?.value || 'todos';

    const params = new URLSearchParams({ page: 1, limit: 10000 });
    if (search) params.append('search', search);
    if (canal !== 'todos') params.append('canal', canal);
    if (categoria !== 'todas') params.append('categoria', categoria);
    if (estado !== 'todos') params.append('estado', estado);

    const res = await window.api.invokeRoute({
      url: `/api/asistencias?${params.toString()}`,
      method: 'GET'
    });

    if (!res || res.status !== 200 || !res.data.rows || res.data.rows.length === 0) {
      showToast('No hay registros para exportar con los filtros actuales.', 'info');
      return;
    }

    const defaultName = `Bitacora_Asistencias_Lobby_${new Date().toISOString().split('T')[0]}.xlsx`;
    const saveRes = await window.api.selectSavePath({ defaultName });
    if (saveRes.cancelled || !saveRes.filePath) return;

    showToast('Generando archivo Excel...');

    const columns = [
      { header: 'Ticket', key: 'ticket_codigo', width: 16 },
      { header: 'Fecha y Hora', key: 'fecha_hora', width: 20 },
      { header: 'Solicitante', key: 'solicitante_nombre', width: 28 },
      { header: 'En representación de', key: 'representado', width: 32 },
      { header: 'Dirección Municipal', key: 'solicitante_direccion', width: 28 },
      { header: 'Correo', key: 'solicitante_correo', width: 25 },
      { header: 'Teléfono', key: 'solicitante_telefono', width: 18 },
      { header: 'Canal', key: 'canal', width: 14 },
      { header: 'Materia', key: 'categoria', width: 18 },
      { header: 'Folio Lobby', key: 'folio_lobby', width: 18 },
      { header: 'Motivo de Consulta', key: 'motivo_consulta', width: 40 },
      { header: 'Solución / Orientación', key: 'solucion_orientacion', width: 45 },
      { header: 'Estado', key: 'estado', width: 15 },
      { header: 'Atendido Por', key: 'creado_por', width: 22 }
    ];

    const excelRes = await window.api.generateExcelFile({
      data: res.data.rows,
      columns,
      filePath: saveRes.filePath,
      sheetName: 'Bitácora Asistencias'
    });

    if (excelRes && excelRes.success) {
      const folderPath = saveRes.filePath.replace(/[\\/][^\\/]+$/, '');
      showToast('Bitácora exportada a Excel correctamente.', 'success', {
        duration: 7500,
        action: {
          label: 'Abrir carpeta',
          icon: 'folder',
          onClick: () => {
            if (window.api && window.api.openPath) window.api.openPath(folderPath);
          }
        }
      });
    } else {
      showToast('Error al exportar a Excel: ' + (excelRes?.error || 'Error desconocido'), 'error');
    }
  } catch (e) {
    showToast('Error al generar Excel: ' + e.message, 'error');
  }
}
window.exportAsistenciasExcel = exportAsistenciasExcel;

async function exportAsistenciasConsolidadoPDF() {
  try {
    const search = document.getElementById('filter-asistencia-search')?.value.trim() || '';
    const canal = document.getElementById('filter-asistencia-canal')?.value || 'todos';
    const categoria = document.getElementById('filter-asistencia-categoria')?.value || 'todas';
    const estado = document.getElementById('filter-asistencia-estado')?.value || 'todos';

    const params = new URLSearchParams({ page: 1, limit: 1000 });
    if (search) params.append('search', search);
    if (canal !== 'todos') params.append('canal', canal);
    if (categoria !== 'todas') params.append('categoria', categoria);
    if (estado !== 'todos') params.append('estado', estado);

    const res = await window.api.invokeRoute({
      url: `/api/asistencias?${params.toString()}`,
      method: 'GET'
    });

    if (!res || res.status !== 200 || !res.data.rows || res.data.rows.length === 0) {
      showToast('No hay registros para exportar en el informe PDF.', 'info');
      return;
    }

    const defaultName = `Informe_Consolidado_Asistencias_${new Date().toISOString().split('T')[0]}.pdf`;
    const saveRes = await window.api.selectSavePath({ defaultName });
    if (saveRes.cancelled || !saveRes.filePath) return;

    showToast('Generando informe consolidado PDF...');

    const rows = res.data.rows;
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 9px; color: #1e293b; padding: 20px; line-height: 1.3; }
          .header { border-bottom: 2px solid #0f172a; padding-bottom: 10px; margin-bottom: 14px; }
          .title { font-size: 14px; font-weight: bold; color: #0f172a; }
          .subtitle { font-size: 10px; color: #64748b; margin-top: 2px; }
          .table-data { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 8.5px; }
          .table-data th { background: #0f172a; color: #ffffff; padding: 6px 8px; text-align: left; font-size: 8px; text-transform: uppercase; }
          .table-data td { padding: 6px 8px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
          .table-data tr:nth-child(even) { background: #f8fafc; }
          .badge { font-family: monospace; font-weight: bold; color: #0284c7; }
          .footer { margin-top: 25px; border-top: 1px solid #e2e8f0; padding-top: 8px; font-size: 8px; color: #94a3b8; text-align: center; }
        </style>
      </head>
      <body>
        <div class="header">
          <table style="width: 100%;">
            <tr>
              <td>
                <div class="title">MUNICIPALIDAD DE MAIPÚ</div>
                <div class="subtitle">Secretaría Municipal — Plataforma LobbyControl (Ley N° 20.730)</div>
                <div class="subtitle">Informe Consolidado de Asistencia Técnica y Consultas Normativas</div>
              </td>
              <td style="text-align: right;">
                <div style="font-size: 9px; color: #64748b;">Fecha Emisión: ${new Date().toLocaleDateString('es-CL')}</div>
                <div style="font-size: 9px; color: #0f172a; font-weight: bold;">Total Atenciones: ${rows.length}</div>
              </td>
            </tr>
          </table>
        </div>

        <table class="table-data">
          <thead>
            <tr>
              <th style="width: 75px;">Ticket / Fecha</th>
              <th style="width: 120px;">Solicitante</th>
              <th style="width: 120px;">Dirección / Depto</th>
              <th style="width: 50px;">Canal</th>
              <th style="width: 70px;">Materia</th>
              <th>Motivo & Solución Brindada</th>
              <th style="width: 55px;">Estado</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(r => `
              <tr>
                <td>
                  <span class="badge">${r.ticket_codigo}</span><br>
                  <span style="color: #64748b; font-size: 7.5px;">${r.fecha_hora ? r.fecha_hora.replace('T', ' ').substring(0, 16) : ''}</span>
                </td>
                <td>
                  <strong>${r.solicitante_nombre}</strong><br>
                  ${r.representado ? `<span style="color: #0284c7; font-size: 8px; font-weight: bold;">↳ Por: ${r.representado}</span><br>` : ''}
                  <span style="color: #64748b;">${r.solicitante_correo || ''}</span>
                </td>
                <td>${r.solicitante_direccion || r.solicitante_cargo_depto || 'General'}</td>
                <td>${r.canal.toUpperCase()}</td>
                <td>${r.categoria.toUpperCase()}</td>
                <td>
                  <strong>Consulta:</strong> ${r.motivo_consulta}<br>
                  ${r.solucion_orientacion ? '<strong style="color: #166534;">Orientación:</strong> ' + r.solucion_orientacion : ''}
                </td>
                <td><strong>${r.estado.toUpperCase()}</strong></td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="footer">
          Documento generado automáticamente por LobbyControl — Secretaría Municipal de Maipú.
        </div>
      </body>
      </html>
    `;

    const pdfRes = await window.api.generateSilentPdf({
      html: htmlContent,
      filePath: saveRes.filePath
    });

    if (pdfRes && pdfRes.success) {
      const folderPath = saveRes.filePath.replace(/[\\/][^\\/]+$/, '');
      showToast('Informe consolidado PDF guardado correctamente.', 'success', {
        duration: 7500,
        action: {
          label: 'Abrir carpeta',
          icon: 'folder',
          onClick: () => {
            if (window.api && window.api.openPath) window.api.openPath(folderPath);
          }
        }
      });
    } else {
      showToast('Error al generar PDF: ' + (pdfRes?.error || 'Error desconocido'), 'error');
    }
  } catch (e) {
    showToast('Error al exportar informe consolidado: ' + e.message, 'error');
  }
}
window.exportAsistenciasConsolidadoPDF = exportAsistenciasConsolidadoPDF;







/**
 * Carga el catálogo de materias y categorías de asistencia.
 */

// MATERIAS / CATEGORÍAS DE ASISTENCIA: REORDENAMIENTO

let ordenCategoriasModificado = false;
let draggedCategoriaRow = null;

function actualizarIndicesYBotonesCategorias(tbody) {
  if (!tbody) return;
  const rows = tbody.querySelectorAll('tr[data-id]');
  const total = rows.length;

  rows.forEach((row, idx) => {
    const badge = row.querySelector('.row-order-badge');
    if (badge) badge.textContent = idx + 1;

    const btnSubir = row.querySelector('.btn-order-up');
    const btnBajar = row.querySelector('.btn-order-down');

    // Gestión de foco en extremo superior (idx === 0)
    if (idx === 0) {
      if (btnSubir && document.activeElement === btnSubir && btnBajar) {
        btnBajar.focus();
      }
      if (btnSubir) btnSubir.disabled = true;
    } else {
      if (btnSubir) btnSubir.disabled = false;
    }

    // Gestión de foco en extremo inferior (idx === total - 1)
    if (idx === total - 1) {
      if (btnBajar && document.activeElement === btnBajar && btnSubir) {
        btnSubir.focus();
      }
      if (btnBajar) btnBajar.disabled = true;
    } else {
      if (btnBajar) btnBajar.disabled = false;
    }
  });
}

function moverFilaCategoriasDOM(row, direccion) {
  if (!row || !row.parentNode) return false;
  const tbody = row.parentNode;

  if (direccion === -1) {
    const prevRow = row.previousElementSibling;
    if (prevRow && prevRow.hasAttribute('data-id')) {
      tbody.insertBefore(row, prevRow);
      ordenCategoriasModificado = true;
      actualizarIndicesYBotonesCategorias(tbody);
      return true;
    }
  } else if (direccion === 1) {
    const nextRow = row.nextElementSibling;
    if (nextRow && nextRow.hasAttribute('data-id')) {
      tbody.insertBefore(row, nextRow.nextElementSibling);
      ordenCategoriasModificado = true;
      actualizarIndicesYBotonesCategorias(tbody);
      return true;
    }
  }
  return false;
}

async function persistirOrdenCategoriasInmediato() {
  const tbody = document.getElementById('tabla-categorias-body');
  if (!tbody) return;

  const ids = Array.from(tbody.querySelectorAll('tr[data-id]'))
                   .map(tr => parseInt(tr.dataset.id, 10))
                   .filter(id => !isNaN(id) && id > 0);

  if (ids.length === 0) return;

  try {
    const res = await window.api.invokeRoute({
      url: '/api/asistencias/categorias/reordenar',
      method: 'PUT',
      body: { ids }
    });

    if (res && res.status === 200) {
      showToast('Orden de materias actualizado exitosamente.', 'success');
      populateBitacoraCategoriasFilter();
    } else {
      const msg = res?.data?.error || 'Error al persistir orden.';
      showToast(`No se pudo guardar el orden: ${msg}`, 'error');
      await loadCategoriasData(); // Rollback fiel a SQLite
    }
  } catch (err) {
    showToast(`Error de comunicación: ${err.message}`, 'error');
    await loadCategoriasData(); // Rollback fiel a SQLite
  }
}
window.persistirOrdenCategoriasInmediato = persistirOrdenCategoriasInmediato;

function setupCategoriasTableEvents(tbody) {
  if (!tbody || tbody.dataset.eventsAttached === 'true') return;
  tbody.dataset.eventsAttached = 'true';

  // 1. TECLADO: keydown (Enter / Espacio)
  tbody.addEventListener('keydown', (e) => {
    const btnSubir = e.target.closest('[data-action="subir"]');
    const btnBajar = e.target.closest('[data-action="bajar"]');
    const btn = btnSubir || btnBajar;
    if (!btn) return;

    if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
      e.preventDefault(); // Inhibe click sintético
      const row = btn.closest('tr[data-id]');
      if (!row) return;
      moverFilaCategoriasDOM(row, btnSubir ? -1 : 1);
    }
  });

  // 2. TECLADO: keyup (Enter / Espacio)
  tbody.addEventListener('keyup', (e) => {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
      if (ordenCategoriasModificado) {
        ordenCategoriasModificado = false;
        persistirOrdenCategoriasInmediato();
      }
    }
  });

  // 3. MOUSE: click directo sobre botones de subir/bajar
  tbody.addEventListener('click', (e) => {
    const btnSubir = e.target.closest('[data-action="subir"]');
    const btnBajar = e.target.closest('[data-action="bajar"]');
    const btn = btnSubir || btnBajar;
    if (!btn) return;
    const row = btn.closest('tr[data-id]');
    if (!row) return;
    const moved = moverFilaCategoriasDOM(row, btnSubir ? -1 : 1);
    if (moved) {
      ordenCategoriasModificado = false;
      persistirOrdenCategoriasInmediato();
    }
  });

  // 4. HTML5 DRAG & DROP
  tbody.addEventListener('dragstart', (e) => {
    const row = e.target.closest('tr[data-id]');
    if (!row) return;
    draggedCategoriaRow = row;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', row.dataset.id);

    // Clon para setDragImage respetando ancho exacto de cada celda
    const clone = row.cloneNode(true);
    clone.style.width = `${row.offsetWidth}px`;
    const origTds = row.querySelectorAll('td');
    clone.querySelectorAll('td').forEach((td, i) => {
      if (origTds[i]) td.style.width = `${origTds[i].offsetWidth}px`;
    });
    clone.style.position = 'absolute';
    clone.style.top = '-9999px';
    clone.style.left = '-9999px';
    clone.classList.add('bg-bg-header', 'shadow-2xl', 'border', 'border-brand-500');
    document.body.appendChild(clone);
    e.dataTransfer.setDragImage(clone, 20, 20);
    setTimeout(() => clone.remove(), 0);

    row.classList.add('opacity-40', 'bg-brand-500/10');
  });

  tbody.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const targetRow = e.target.closest('tr[data-id]');
    if (!targetRow || targetRow === draggedCategoriaRow) return;

    tbody.querySelectorAll('tr[data-id]').forEach(r => {
      if (r !== targetRow) r.classList.remove('border-t-2', 'border-b-2', 'border-brand-500');
    });

    const rect = targetRow.getBoundingClientRect();
    const offset = e.clientY - rect.top;
    if (offset < rect.height / 2) {
      targetRow.classList.add('border-t-2', 'border-brand-500');
      targetRow.classList.remove('border-b-2');
    } else {
      targetRow.classList.add('border-b-2', 'border-brand-500');
      targetRow.classList.remove('border-t-2');
    }
  });

  tbody.addEventListener('dragleave', (e) => {
    const targetRow = e.target.closest('tr[data-id]');
    if (targetRow && !targetRow.contains(e.relatedTarget)) {
      targetRow.classList.remove('border-t-2', 'border-b-2', 'border-brand-500');
    }
  });

  tbody.addEventListener('drop', (e) => {
    e.preventDefault();
    tbody.querySelectorAll('tr[data-id]').forEach(r => r.classList.remove('border-t-2', 'border-b-2', 'border-brand-500'));

    const targetRow = e.target.closest('tr[data-id]');
    if (!targetRow || !draggedCategoriaRow || targetRow === draggedCategoriaRow) return;

    const rect = targetRow.getBoundingClientRect();
    const offset = e.clientY - rect.top;

    if (offset < rect.height / 2) {
      tbody.insertBefore(draggedCategoriaRow, targetRow);
    } else {
      tbody.insertBefore(draggedCategoriaRow, targetRow.nextElementSibling);
    }

    actualizarIndicesYBotonesCategorias(tbody);
    persistirOrdenCategoriasInmediato();
  });

  tbody.addEventListener('dragend', () => {
    if (draggedCategoriaRow) {
      draggedCategoriaRow.classList.remove('opacity-40', 'bg-brand-500/10');
      draggedCategoriaRow = null;
    }
    tbody.querySelectorAll('tr[data-id]').forEach(r => r.classList.remove('border-t-2', 'border-b-2', 'border-brand-500'));
  });
}

window.isCategoriasReordering = false;

function toggleReordenarCategorias() {
  window.isCategoriasReordering = !window.isCategoriasReordering;
  const btn = document.getElementById('btn-toggle-reordenar-categorias');
  if (btn) {
    if (window.isCategoriasReordering) {
      btn.className = "px-3 py-1.5 rounded-xl text-xs font-bold border border-brand-500 bg-brand-500/10 text-brand-600 dark:text-brand-400 flex items-center gap-1.5 transition-all cursor-pointer shadow-xs";
      btn.innerHTML = '<i data-lucide="check" class="h-3.5 w-3.5"></i> <span>Finalizar Orden</span>';
    } else {
      btn.className = "px-3 py-1.5 rounded-xl text-xs font-semibold border border-border-ui bg-bg-card hover:bg-border-ui text-text-secondary hover:text-text-primary flex items-center gap-1.5 transition-all cursor-pointer";
      btn.innerHTML = '<i data-lucide="arrow-up-down" class="h-3.5 w-3.5"></i> <span>Reordenar</span>';
    }
    if (window.lucide) window.lucide.createIcons();
  }
  loadCategoriasData();
}
window.toggleReordenarCategorias = toggleReordenarCategorias;

async function loadCategoriasData() {
  const tbody = document.getElementById('tabla-categorias-body');
  if (!tbody) return;

  try {
    const res = await window.api.invokeRoute({ url: '/api/asistencias/categorias', method: 'GET' });
    if (res && res.status === 200 && Array.isArray(res.data)) {
      const rows = res.data;
      if (rows.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center py-6 text-text-tertiary">No hay materias registradas.</td></tr>';
        return;
      }

      const isReordering = Boolean(window.isCategoriasReordering);

      tbody.innerHTML = rows.map((cat, idx) => `
        <tr data-id="${cat.id}" ${isReordering ? 'draggable="true"' : ''} class="hover:bg-border-ui dark:hover:bg-border-ui/50 transition-colors group">
          <td class="px-4 py-2.5 text-xs text-text-secondary whitespace-nowrap text-center">
            ${isReordering ? `
              <div class="flex items-center justify-center gap-2">
                <!-- Drag Handle -->
                <span class="drag-handle cursor-grab active:cursor-grabbing p-1 rounded hover:bg-border-ui text-text-tertiary hover:text-text-primary transition-colors inline-flex items-center" title="Arrastrar para reordenar">
                  <i data-lucide="grip-vertical" class="h-3.5 w-3.5"></i>
                </span>
                <!-- Posición / Índice -->
                <span class="row-order-badge font-mono text-[11px] font-semibold text-text-tertiary w-5 text-center">${idx + 1}</span>
                <!-- Botones Subir / Bajar -->
                <div class="flex flex-col gap-0.5">
                  <button type="button" 
                          data-action="subir" 
                          data-id="${cat.id}" 
                          aria-label="Subir materia ${cat.nombre}" 
                          title="Subir"
                          class="btn-order-up p-0.5 rounded hover:bg-border-ui hover:text-brand-600 dark:hover:text-brand-400 text-text-tertiary transition-colors disabled:opacity-20 disabled:cursor-not-allowed cursor-pointer" 
                          ${idx === 0 ? 'disabled' : ''}>
                    <i data-lucide="chevron-up" class="h-3 w-3"></i>
                  </button>
                  <button type="button" 
                          data-action="bajar" 
                          data-id="${cat.id}" 
                          aria-label="Bajar materia ${cat.nombre}" 
                          title="Bajar"
                          class="btn-order-down p-0.5 rounded hover:bg-border-ui hover:text-brand-600 dark:hover:text-brand-400 text-text-tertiary transition-colors disabled:opacity-20 disabled:cursor-not-allowed cursor-pointer" 
                          ${idx === rows.length - 1 ? 'disabled' : ''}>
                    <i data-lucide="chevron-down" class="h-3 w-3"></i>
                  </button>
                </div>
              </div>
            ` : `
              <span class="font-mono text-[11px] font-semibold text-text-tertiary">${idx + 1}</span>
            `}
          </td>
          <td class="px-4 py-3 font-bold text-text-primary">
            <div class="flex items-center gap-2">
              <i data-lucide="tag" class="h-3.5 w-3.5 text-brand-600 dark:text-brand-400 shrink-0"></i>
              <span>${cat.nombre}</span>
            </div>
          </td>
          <td class="px-4 py-3 text-text-secondary text-xs">${cat.descripcion || '-'}</td>
          <td class="px-4 py-3 text-right">
            <div class="flex items-center justify-end gap-1.5">
              <button onclick="openModalEditarCategoria(${cat.id})" class="p-1.5 rounded-lg bg-border-ui hover:bg-border-ui dark:hover:bg-border-ui/50 text-text-secondary hover:text-brand-600 dark:hover:text-brand-400 border border-border-ui transition-colors cursor-pointer" title="Editar materia">
                <i data-lucide="edit-3" class="h-3.5 w-3.5"></i>
              </button>
              <button onclick="eliminarCategoria(${cat.id}, '${cat.nombre.replace(/'/g, "\\'")}')" class="p-1.5 rounded-lg bg-border-ui hover:bg-rose-50 dark:hover:bg-rose-600/20 text-text-tertiary hover:text-rose-600 dark:hover:text-rose-400 border border-border-ui transition-colors cursor-pointer" title="Eliminar materia">
                <i data-lucide="trash-2" class="h-3.5 w-3.5"></i>
              </button>
            </div>
          </td>
        </tr>
      `).join('');

      if (isReordering) {
        setupCategoriasTableEvents(tbody);
      }
      if (window.lucide) window.lucide.createIcons();
    }
  } catch (err) {
    console.error('Error al cargar materias:', err);
    tbody.innerHTML = `<tr><td colspan="4" class="text-center py-6 text-rose-500">Error al cargar materias: ${err.message}</td></tr>`;
  }
}
window.loadCategoriasData = loadCategoriasData;

function openModalNuevaCategoria() {
  openModalEditarCategoria(null);
}
window.openModalNuevaCategoria = openModalNuevaCategoria;

async function openModalEditarCategoria(id) {
  let cat = { nombre: '', descripcion: '' };
  if (id) {
    try {
      const res = await window.api.invokeRoute({ url: '/api/asistencias/categorias', method: 'GET' });
      if (res && res.status === 200 && Array.isArray(res.data)) {
        const found = res.data.find(c => c.id === id);
        if (found) cat = found;
      }
    } catch (err) {
      console.error('Error al cargar categoría:', err);
      showToast('No se pudo cargar la información de la categoría.', 'error');
    }
  }

  const modal = document.getElementById('modal-container');
  if (!modal) return;

  modal.innerHTML = `
    <div class="fixed inset-0 bg-bg-main backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div class="glass-card bg-bg-card border border-border-ui rounded-3xl w-full max-w-md shadow-2xl overflow-hidden modal-animate-in flex flex-col text-text-primary text-left">
        
        <div class="p-4 border-b border-border-ui flex items-center justify-between bg-bg-main">
          <h3 class="font-bold text-sm text-text-primary flex items-center gap-2">
            <i data-lucide="tag" class="h-4 w-4 text-brand-600 dark:text-brand-400"></i>
            <span>${id ? 'Editar Materia / Categoría' : 'Nueva Materia / Categoría'}</span>
          </h3>
          <button onclick="closeModal()" title="Cerrar modal" aria-label="Cerrar modal" class="p-1.5 rounded-lg hover:bg-border-ui dark:hover:bg-border-ui/50 text-text-tertiary hover:text-text-primary dark:hover:text-text-primary transition-colors cursor-pointer">
            <i data-lucide="x" class="h-4 w-4"></i>
          </button>
        </div>

        <div class="p-4 space-y-3 text-xs">
          <div>
            <label class="text-[10px] font-bold uppercase text-text-tertiary block mb-1">Nombre de la Materia *</label>
            <input type="text" id="modal-cat-nombre" value="${escapeHtml(cat.nombre || '')}" placeholder="Nombre de la materia" class="w-full bg-bg-card border border-border-ui rounded-lg p-2 text-text-primary focus:border-brand-500 font-medium">
          </div>
          <div>
            <label class="text-[10px] font-bold uppercase text-text-tertiary block mb-1">Descripción / Alcance</label>
            <textarea id="modal-cat-desc" rows="2" placeholder="Detalle o alcance de esta materia..." class="w-full bg-bg-card border border-border-ui rounded-lg p-2 text-text-primary focus:border-brand-500 resize-none">${escapeHtml(cat.descripcion || '')}</textarea>
          </div>
        </div>

        <div class="p-3.5 border-t border-border-ui bg-bg-main flex items-center justify-end gap-2">
          <button onclick="closeModal()" class="px-3.5 py-1.5 rounded-lg bg-border-ui hover:bg-border-ui dark:hover:bg-border-ui/50 text-text-secondary text-xs font-semibold transition-colors cursor-pointer">
            Cancelar
          </button>
          <button onclick="guardarCategoria(${id || 'null'})" class="px-4 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold transition-all shadow-xs cursor-pointer">
            Guardar Materia
          </button>
        </div>

      </div>
    </div>
  `;

  modal.classList.remove('hidden');
  if (window.lucide) window.lucide.createIcons();
}
window.openModalEditarCategoria = openModalEditarCategoria;

async function guardarCategoria(id) {
  const nombre = document.getElementById('modal-cat-nombre')?.value.trim();
  const desc = document.getElementById('modal-cat-desc')?.value.trim();

  if (!nombre) {
    showToast('El nombre de la materia es obligatorio.', 'error');
    return;
  }

  try {
    const isEdit = Boolean(id);
    const url = isEdit ? `/api/asistencias/categorias/${id}` : '/api/asistencias/categorias';
    const method = isEdit ? 'PUT' : 'POST';

    const res = await window.api.invokeRoute({
      url,
      method,
      body: { nombre, descripcion: desc }
    });

    if (res && (res.status === 200 || res.status === 201)) {
      showToast(isEdit ? 'Materia actualizada con éxito.' : 'Materia creada con éxito.', 'success');
      closeModal();
      loadCategoriasData();
    } else {
      showToast('Error: ' + (res?.data?.error || 'No se pudo guardar'), 'error');
    }
  } catch (err) {
    showToast('Error al guardar materia: ' + err.message, 'error');
  }
}
window.guardarCategoria = guardarCategoria;

function eliminarCategoria(id, nombre) {
  openConfirmModal(
    'Eliminar Materia',
    `¿Estás seguro de eliminar la materia "${nombre}"?`,
    async () => {
      try {
        const res = await window.api.invokeRoute({
          url: `/api/asistencias/categorias/${id}`,
          method: 'DELETE'
        });

        if (res && res.status === 200) {
          showToast('Materia eliminada exitosamente.', 'success');
          loadCategoriasData();
        } else {
          showToast('Error al eliminar materia: ' + (res?.data?.error || 'Error desconocido'), 'error');
        }
      } catch (err) {
        showToast('Error al eliminar: ' + err.message, 'error');
      }
    }
  );
}
window.eliminarCategoria = eliminarCategoria;

// ─── GESTIÓN DE DIRECCIONES MUNICIPALES ─────────────────────────────────────
window.isDireccionesReordering = false;

function toggleReordenarDirecciones() {
  window.isDireccionesReordering = !window.isDireccionesReordering;
  const btn = document.getElementById('btn-toggle-reordenar-direcciones');
  const btnSortAz = document.getElementById('btn-ordenar-alfabetico-direcciones');
  if (btnSortAz) {
    if (window.isDireccionesReordering) {
      btnSortAz.classList.remove('hidden');
    } else {
      btnSortAz.classList.add('hidden');
    }
  }
  if (btn) {
    if (window.isDireccionesReordering) {
      btn.className = "px-3 py-1.5 rounded-xl text-xs font-bold border border-brand-500 bg-brand-500/10 text-brand-600 dark:text-brand-400 flex items-center gap-1.5 transition-all cursor-pointer shadow-xs";
      btn.innerHTML = '<i data-lucide="check" class="h-3.5 w-3.5"></i> <span>Finalizar Orden</span>';
    } else {
      btn.className = "px-3 py-1.5 rounded-xl text-xs font-semibold border border-border-ui bg-bg-card hover:bg-border-ui text-text-secondary hover:text-text-primary flex items-center gap-1.5 transition-all cursor-pointer";
      btn.innerHTML = '<i data-lucide="arrow-up-down" class="h-3.5 w-3.5"></i> <span>Reordenar</span>';
    }
    if (window.lucide) window.lucide.createIcons();
  }
  loadDireccionesData();
}
window.toggleReordenarDirecciones = toggleReordenarDirecciones;

async function ordenarDireccionesAlfabetico() {
  try {
    const res = await window.api.invokeRoute({ url: '/api/direcciones', method: 'GET' });
    if (res && res.status === 200 && Array.isArray(res.data)) {
      const sorted = [...res.data].sort((a, b) => (a.acronimo || '').localeCompare(b.acronimo || '', 'es', { sensitivity: 'base' }));
      const orderedIds = sorted.map(d => d.id);
      await reorderDirecciones(orderedIds);
      showToast('Direcciones ordenadas alfabéticamente por acrónimo (A-Z).', 'success');
    }
  } catch (err) {
    showToast('Error al ordenar alfabéticamente: ' + err.message, 'error');
  }
}
window.ordenarDireccionesAlfabetico = ordenarDireccionesAlfabetico;

async function reorderDirecciones(orderedIds) {
  try {
    const res = await window.api.invokeRoute({
      url: '/api/direcciones/reordenar',
      method: 'PUT',
      body: { ids: orderedIds }
    });

    if (res && res.status === 200) {
      showToast('Orden de direcciones actualizado.', 'success');
      await loadDireccionesData();
    } else if (res && res.status === 409 && res.data?.refresh_required) {
      showToast('El catálogo de direcciones cambió concurrentemente. Refrescando...', 'warn');
      await loadDireccionesData();
    } else {
      showToast(res?.data?.error || 'No se pudo guardar el nuevo orden.', 'error');
      await loadDireccionesData();
    }
  } catch (err) {
    showToast('Error al reordenar direcciones: ' + err.message, 'error');
    await loadDireccionesData();
  }
}

function setupDireccionesTableEvents(tbody) {
  tbody.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn || btn.disabled) return;

    const action = btn.getAttribute('data-action');
    const currentRow = btn.closest('tr[data-id]');
    if (!currentRow) return;

    const allRows = Array.from(tbody.querySelectorAll('tr[data-id]'));
    const currentIndex = allRows.indexOf(currentRow);
    if (currentIndex === -1) return;

    let targetIndex = -1;
    if (action === 'subir' && currentIndex > 0) {
      targetIndex = currentIndex - 1;
    } else if (action === 'bajar' && currentIndex < allRows.length - 1) {
      targetIndex = currentIndex + 1;
    }

    if (targetIndex !== -1) {
      const targetRow = allRows[targetIndex];
      if (action === 'subir') {
        tbody.insertBefore(currentRow, targetRow);
      } else {
        tbody.insertBefore(currentRow, targetRow.nextSibling);
      }

      const newOrderedRows = Array.from(tbody.querySelectorAll('tr[data-id]'));
      const newIds = newOrderedRows.map(r => parseInt(r.getAttribute('data-id'), 10));

      newOrderedRows.forEach((row, idx) => {
        const badge = row.querySelector('.row-order-badge');
        if (badge) badge.textContent = idx + 1;
        const upBtn = row.querySelector('.btn-order-up');
        const downBtn = row.querySelector('.btn-order-down');
        if (upBtn) upBtn.disabled = (idx === 0);
        if (downBtn) downBtn.disabled = (idx === newOrderedRows.length - 1);
      });

      const movedBtn = currentRow.querySelector(`button[data-action="${action}"]`);
      if (movedBtn && !movedBtn.disabled) {
        movedBtn.focus();
      } else {
        const alternateAction = action === 'subir' ? 'bajar' : 'subir';
        const alternateBtn = currentRow.querySelector(`button[data-action="${alternateAction}"]`);
        if (alternateBtn) alternateBtn.focus();
      }

      await reorderDirecciones(newIds);
    }
  });

  // Drag & Drop nativo
  let draggedRow = null;

  tbody.addEventListener('dragstart', (e) => {
    const row = e.target.closest('tr[data-id]');
    if (!row) return;
    draggedRow = row;
    row.classList.add('opacity-40', 'bg-brand-500/10');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', row.getAttribute('data-id'));
  });

  tbody.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const targetRow = e.target.closest('tr[data-id]');
    if (!targetRow || targetRow === draggedRow) return;

    tbody.querySelectorAll('tr[data-id]').forEach(r => r.classList.remove('border-t-2', 'border-b-2', 'border-brand-500'));
    const rect = targetRow.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    if (e.clientY < midY) {
      targetRow.classList.add('border-t-2', 'border-brand-500');
    } else {
      targetRow.classList.add('border-b-2', 'border-brand-500');
    }
  });

  tbody.addEventListener('dragleave', (e) => {
    const targetRow = e.target.closest('tr[data-id]');
    if (targetRow && !targetRow.contains(e.relatedTarget)) {
      targetRow.classList.remove('border-t-2', 'border-b-2', 'border-brand-500');
    }
  });

  tbody.addEventListener('dragend', () => {
    if (draggedRow) {
      draggedRow.classList.remove('opacity-40', 'bg-brand-500/10');
      draggedRow = null;
    }
    tbody.querySelectorAll('tr[data-id]').forEach(r => r.classList.remove('border-t-2', 'border-b-2', 'border-brand-500'));
  });

  tbody.addEventListener('drop', async (e) => {
    e.preventDefault();
    const targetRow = e.target.closest('tr[data-id]');
    if (!targetRow || !draggedRow || targetRow === draggedRow) return;

    const rect = targetRow.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    if (e.clientY < midY) {
      tbody.insertBefore(draggedRow, targetRow);
    } else {
      tbody.insertBefore(draggedRow, targetRow.nextSibling);
    }

    tbody.querySelectorAll('tr[data-id]').forEach(r => r.classList.remove('border-t-2', 'border-b-2', 'border-brand-500'));
    const newOrderedRows = Array.from(tbody.querySelectorAll('tr[data-id]'));
    const newIds = newOrderedRows.map(r => parseInt(r.getAttribute('data-id'), 10));

    newOrderedRows.forEach((row, idx) => {
      const badge = row.querySelector('.row-order-badge');
      if (badge) badge.textContent = idx + 1;
      const upBtn = row.querySelector('.btn-order-up');
      const downBtn = row.querySelector('.btn-order-down');
      if (upBtn) upBtn.disabled = (idx === 0);
      if (downBtn) downBtn.disabled = (idx === newOrderedRows.length - 1);
    });

    await reorderDirecciones(newIds);
  });
}

async function loadDireccionesData() {
  const tbody = document.getElementById('tabla-direcciones-body');
  if (!tbody) return;

  try {
    const res = await window.api.invokeRoute({ url: '/api/direcciones', method: 'GET' });
    if (res && res.status === 200 && Array.isArray(res.data)) {
      const rows = res.data;
      if (rows.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center py-6 text-text-tertiary">No hay direcciones municipales registradas.</td></tr>';
        return;
      }

      const isReordering = Boolean(window.isDireccionesReordering);

      tbody.innerHTML = rows.map((dir, idx) => `
        <tr data-id="${dir.id}" ${isReordering ? 'draggable="true"' : ''} class="hover:bg-border-ui dark:hover:bg-border-ui/50 transition-colors group">
          <td class="px-4 py-2.5 text-xs text-text-secondary whitespace-nowrap text-center">
            ${isReordering ? `
              <div class="flex items-center justify-center gap-2">
                <!-- Drag Handle -->
                <span class="drag-handle cursor-grab active:cursor-grabbing p-1 rounded hover:bg-border-ui text-text-tertiary hover:text-text-primary transition-colors inline-flex items-center" title="Arrastrar para reordenar">
                  <i data-lucide="grip-vertical" class="h-3.5 w-3.5"></i>
                </span>
                <!-- Posición / Índice -->
                <span class="row-order-badge font-mono text-[11px] font-semibold text-text-tertiary w-5 text-center">${idx + 1}</span>
                <!-- Botones Subir / Bajar -->
                <div class="flex flex-col gap-0.5">
                  <button type="button" 
                          data-action="subir" 
                          data-id="${dir.id}" 
                          aria-label="Subir dirección ${dir.acronimo}" 
                          title="Subir"
                          class="btn-order-up p-0.5 rounded hover:bg-border-ui hover:text-brand-600 dark:hover:text-brand-400 text-text-tertiary transition-colors disabled:opacity-20 disabled:cursor-not-allowed cursor-pointer" 
                          ${idx === 0 ? 'disabled' : ''}>
                    <i data-lucide="chevron-up" class="h-3 w-3"></i>
                  </button>
                  <button type="button" 
                          data-action="bajar" 
                          data-id="${dir.id}" 
                          aria-label="Bajar dirección ${dir.acronimo}" 
                          title="Bajar"
                          class="btn-order-down p-0.5 rounded hover:bg-border-ui hover:text-brand-600 dark:hover:text-brand-400 text-text-tertiary transition-colors disabled:opacity-20 disabled:cursor-not-allowed cursor-pointer" 
                          ${idx === rows.length - 1 ? 'disabled' : ''}>
                    <i data-lucide="chevron-down" class="h-3 w-3"></i>
                  </button>
                </div>
              </div>
            ` : `
              <span class="font-mono text-[11px] font-semibold text-text-tertiary">${idx + 1}</span>
            `}
          </td>
          <td class="px-4 py-3 font-bold text-text-primary">
            <div class="flex items-center gap-2">
              <span class="px-2 py-0.5 rounded-md bg-brand-500/10 text-brand-600 dark:text-brand-400 font-mono font-bold text-xs border border-brand-500/20">
                ${dir.acronimo}
              </span>
            </div>
          </td>
          <td class="px-4 py-3 text-text-primary font-medium text-xs">
            ${dir.nombre}
          </td>
          <td class="px-4 py-3 text-right">
            <div class="flex items-center justify-end gap-1.5">
              <button onclick="openModalEditarDireccion(${dir.id})" class="p-1.5 rounded-lg bg-border-ui hover:bg-border-ui dark:hover:bg-border-ui/50 text-text-secondary hover:text-brand-600 dark:hover:text-brand-400 border border-border-ui transition-colors cursor-pointer" title="Editar dirección">
                <i data-lucide="edit-3" class="h-3.5 w-3.5"></i>
              </button>
              <button onclick="eliminarDireccion(${dir.id}, '${dir.acronimo.replace(/'/g, "\\'")}', '${dir.nombre.replace(/'/g, "\\'")}')" class="p-1.5 rounded-lg bg-border-ui hover:bg-rose-50 dark:hover:bg-rose-600/20 text-text-tertiary hover:text-rose-600 dark:hover:text-rose-400 border border-border-ui transition-colors cursor-pointer" title="Eliminar dirección">
                <i data-lucide="trash-2" class="h-3.5 w-3.5"></i>
              </button>
            </div>
          </td>
        </tr>
      `).join('');

      if (isReordering) {
        setupDireccionesTableEvents(tbody);
      }
      if (window.lucide) window.lucide.createIcons();
    }
  } catch (err) {
    console.error('Error al cargar direcciones:', err);
    tbody.innerHTML = `<tr><td colspan="4" class="text-center py-6 text-rose-500">Error al cargar direcciones: ${err.message}</td></tr>`;
  }
}
window.loadDireccionesData = loadDireccionesData;

function openModalNuevaDireccion() {
  openModalEditarDireccion(null);
}
window.openModalNuevaDireccion = openModalNuevaDireccion;

async function openModalEditarDireccion(id) {
  let dir = { acronimo: '', nombre: '', orden: 0 };
  try {
    const res = await window.api.invokeRoute({ url: '/api/direcciones', method: 'GET' });
    if (res && res.status === 200 && Array.isArray(res.data)) {
      if (id) {
        const found = res.data.find(d => d.id === id);
        if (found) dir = found;
      } else {
        const maxOrden = res.data.length > 0 ? Math.max(...res.data.map(d => parseInt(d.orden, 10) || 0)) : 0;
        dir.orden = maxOrden + 1;
      }
    }
  } catch (err) {
    console.error('Error al cargar datos para modal de dirección:', err);
  }

  const modal = document.getElementById('modal-container');
  if (!modal) return;

  modal.innerHTML = `
    <div class="fixed inset-0 bg-bg-main backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div class="glass-card bg-bg-card border border-border-ui rounded-3xl w-full max-w-md shadow-2xl overflow-hidden modal-animate-in flex flex-col text-text-primary text-left">
        
        <div class="p-4 border-b border-border-ui flex items-center justify-between bg-bg-main">
          <h3 class="font-bold text-sm text-text-primary flex items-center gap-2">
            <i data-lucide="building-2" class="h-4 w-4 text-brand-600 dark:text-brand-400"></i>
            <span>${id ? 'Editar Dirección Municipal' : 'Nueva Dirección Municipal'}</span>
          </h3>
          <button onclick="closeModal()" title="Cerrar modal" aria-label="Cerrar modal" class="p-1.5 rounded-lg hover:bg-border-ui dark:hover:bg-border-ui/50 text-text-tertiary hover:text-text-primary dark:hover:text-text-primary transition-colors cursor-pointer">
            <i data-lucide="x" class="h-4 w-4"></i>
          </button>
        </div>

        <div class="p-4 space-y-3 text-xs">
          <div class="grid grid-cols-3 gap-3">
            <div class="col-span-1">
              <label class="text-[10px] font-bold uppercase text-text-tertiary block mb-1">Acrónimo *</label>
              <input type="text" id="modal-dir-acronimo" value="${dir.acronimo}" placeholder="Ej. DOM" maxlength="10" class="w-full bg-bg-card border border-border-ui rounded-lg p-2 text-text-primary focus:border-brand-500 font-mono font-bold uppercase" oninput="this.value = this.value.toUpperCase()">
            </div>
            <div class="col-span-2">
              <label class="text-[10px] font-bold uppercase text-text-tertiary block mb-1">Orden de Visualización</label>
              <input type="number" id="modal-dir-orden" value="${dir.orden || 0}" min="1" placeholder="1" class="w-full bg-bg-card border border-border-ui rounded-lg p-2 text-text-primary focus:border-brand-500 font-medium">
            </div>
          </div>
          <div>
            <label class="text-[10px] font-bold uppercase text-text-tertiary block mb-1">Nombre de la Dirección *</label>
            <input type="text" id="modal-dir-nombre" value="${dir.nombre}" placeholder="Ej. Dirección de Obras Municipales" class="w-full bg-bg-card border border-border-ui rounded-lg p-2 text-text-primary focus:border-brand-500 font-medium">
          </div>
        </div>

        <div class="p-3.5 border-t border-border-ui bg-bg-main flex items-center justify-end gap-2">
          <button onclick="closeModal()" class="px-3.5 py-1.5 rounded-lg bg-border-ui hover:bg-border-ui dark:hover:bg-border-ui/50 text-text-secondary text-xs font-semibold transition-colors cursor-pointer">
            Cancelar
          </button>
          <button onclick="guardarDireccion(${id || 'null'})" class="px-4 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold transition-all shadow-xs cursor-pointer">
            Guardar Dirección
          </button>
        </div>

      </div>
    </div>
  `;

  modal.classList.remove('hidden');
  if (window.lucide) window.lucide.createIcons();
}
window.openModalEditarDireccion = openModalEditarDireccion;

async function guardarDireccion(id) {
  const acronimo = document.getElementById('modal-dir-acronimo')?.value.trim().toUpperCase();
  const nombre = document.getElementById('modal-dir-nombre')?.value.trim();
  const orden = parseInt(document.getElementById('modal-dir-orden')?.value, 10) || 0;

  if (!acronimo) {
    showToast('El acrónimo de la dirección es obligatorio (ej. DOM).', 'error');
    return;
  }
  if (!nombre) {
    showToast('El nombre de la dirección es obligatorio.', 'error');
    return;
  }

  try {
    const isEdit = Boolean(id);
    const url = isEdit ? `/api/direcciones/${id}` : '/api/direcciones';
    const method = isEdit ? 'PUT' : 'POST';

    const res = await window.api.invokeRoute({
      url,
      method,
      body: { acronimo, nombre, orden }
    });

    if (res && (res.status === 200 || res.status === 201)) {
      showToast(isEdit ? 'Dirección actualizada con éxito.' : 'Dirección creada con éxito.', 'success');
      closeModal();
      loadDireccionesData();
    } else {
      showToast('Error: ' + (res?.data?.error || 'No se pudo guardar'), 'error');
    }
  } catch (err) {
    showToast('Error al guardar dirección: ' + err.message, 'error');
  }
}
window.guardarDireccion = guardarDireccion;

function eliminarDireccion(id, acronimo, nombre) {
  openConfirmModal(
    'Eliminar Dirección',
    `¿Estás seguro de eliminar la dirección "${acronimo} - ${nombre}"?`,
    async () => {
      try {
        const res = await window.api.invokeRoute({
          url: `/api/direcciones/${id}`,
          method: 'DELETE'
        });

        if (res && res.status === 200) {
          showToast('Dirección eliminada exitosamente.', 'success');
          loadDireccionesData();
        } else {
          showToast('Error al eliminar dirección: ' + (res?.data?.error || 'Error desconocido'), 'error');
        }
      } catch (err) {
        showToast('Error al eliminar: ' + err.message, 'error');
      }
    }
  );
}
window.eliminarDireccion = eliminarDireccion;


// ─── Exportación del Módulo AsistenciaTab ─────────────────────────────────────
export const AsistenciaTab = {
  mount(container) {
    if (typeof window.initAsistenciaTab === 'function') {
      window.initAsistenciaTab();
    }
    if (typeof window.initAirDatepickerFields === 'function') {
      requestAnimationFrame(() => {
        window.initAirDatepickerFields();
        if (typeof window.syncAllLinkedDatepickers === 'function') {
          window.syncAllLinkedDatepickers();
        }
      });
    }
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }
  },

  unmount() {
    if (typeof chartAsistenciaDireccionesInstance?.destroy === 'function') {
      try { chartAsistenciaDireccionesInstance.destroy(); } catch (e) {}
      chartAsistenciaDireccionesInstance = null;
    }
    if (typeof chartAsistenciaEvolucionInstance?.destroy === 'function') {
      try { chartAsistenciaEvolucionInstance.destroy(); } catch (e) {}
      chartAsistenciaEvolucionInstance = null;
    }
    const inputs = document.querySelectorAll('#asistencia-view-container .datepicker-display-input');
    inputs.forEach(input => {
      if (input._airDatepicker && typeof input._airDatepicker.destroy === 'function') {
        try { input._airDatepicker.destroy(); } catch (e) {}
        input._airDatepicker = null;
      }
    });
  },

  renderTabHtml: renderAsistenciaTabHtml,
  renderAsistenciaTabHtml,
  renderAsistenciaBitacoraViewHtml,
  renderAsistenciaContactosViewHtml,
  renderAsistenciaCategoriasViewHtml,
  renderAsistenciaDireccionesViewHtml,
  initAsistenciaTab,
  changeAsistenciaSubTab,
  loadAsistenciaStats,
  loadAsistenciasData,
  loadContactosData,
  loadCategoriasData,
  loadDireccionesData,
  toggleReordenarCategorias,
  openModalNuevaCategoria,
  openModalEditarCategoria,
  guardarCategoria,
  eliminarCategoria,
  ordenarDireccionesAlfabetico,
  toggleReordenarDirecciones,
  openModalNuevaDireccion,
  openModalEditarDireccion,
  guardarDireccion,
  eliminarDireccion
};

if (typeof window !== 'undefined') {
  window.AsistenciaTab = AsistenciaTab;
  window.renderAsistenciaTabHtml = renderAsistenciaTabHtml;
  window.renderAsistenciaBitacoraViewHtml = renderAsistenciaBitacoraViewHtml;
  window.renderAsistenciaContactosViewHtml = renderAsistenciaContactosViewHtml;
  window.renderAsistenciaCategoriasViewHtml = renderAsistenciaCategoriasViewHtml;
  window.renderAsistenciaDireccionesViewHtml = renderAsistenciaDireccionesViewHtml;
  window.initAsistenciaTab = initAsistenciaTab;
  window.changeAsistenciaSubTab = changeAsistenciaSubTab;
  window.loadAsistenciaStats = loadAsistenciaStats;
  window.loadAsistenciasData = loadAsistenciasData;
  window.loadContactosData = loadContactosData;
  window.loadCategoriasData = loadCategoriasData;
  window.loadDireccionesData = loadDireccionesData;
  window.toggleReordenarCategorias = toggleReordenarCategorias;
  window.openModalNuevaCategoria = openModalNuevaCategoria;
  window.openModalEditarCategoria = openModalEditarCategoria;
  window.guardarCategoria = guardarCategoria;
  window.eliminarCategoria = eliminarCategoria;
  window.ordenarDireccionesAlfabetico = ordenarDireccionesAlfabetico;
  window.toggleReordenarDirecciones = toggleReordenarDirecciones;
  window.openModalNuevaDireccion = openModalNuevaDireccion;
  window.openModalEditarDireccion = openModalEditarDireccion;
  window.guardarDireccion = guardarDireccion;
  window.eliminarDireccion = eliminarDireccion;
}
