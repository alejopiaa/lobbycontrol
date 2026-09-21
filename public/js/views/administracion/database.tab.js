/**
 * DatabaseTab - Modulo desacoplado de Inspector y Diagnostico de Base de Datos
 */
import { debounce } from '../../utils/dom.js';
import { escapeHtml, escapeHtmlAttr } from '../../utils/formatters.js';
import { showToast } from '../../components/toast.component.js';

// INSPECTOR DE BASE DE DATOS - ESTADO Y COMPONENTE VISUAL

let inspectorState = {
  tables: {},
  selectedDb: "data.db",
  selectedTable: "solicitudes_sh",
  page: 1,
  limit: 10,
  search: "",
  columns: [],
  rows: [],
  total: 0,
  loading: false,
};

async function initDatabaseInspector() {
  const hasTables = inspectorState.tables && Object.keys(inspectorState.tables).length > 0;
  if (!hasTables) {
    try {
      const res = await fetch("/api/admin/inspector/tables");
      if (res.ok) {
        const rawTables = await res.json();
        inspectorState.tables = (rawTables && typeof rawTables === 'object' && !Array.isArray(rawTables)) ? (rawTables.data || rawTables) : {};
        if (!inspectorState.tables || typeof inspectorState.tables !== 'object' || Array.isArray(inspectorState.tables)) {
          inspectorState.tables = {};
        }
        
        if (Array.isArray(inspectorState.tables["data.db"]) && inspectorState.tables["data.db"].includes("solicitudes_sh")) {
          inspectorState.selectedDb = "data.db";
          inspectorState.selectedTable = "solicitudes_sh";
        } else {
          const dbs = Object.keys(inspectorState.tables);
          if (dbs.length > 0) {
            inspectorState.selectedDb = dbs[0];
            const tablesList = Array.isArray(inspectorState.tables[dbs[0]]) ? inspectorState.tables[dbs[0]] : [];
            if (tablesList.length > 0) {
              inspectorState.selectedTable = tablesList[0];
            }
          }
        }
      }
    } catch (e) {
      console.error("Error al inicializar tablas del inspector:", e);
    }
  }
  await fetchInspectorData();
}

async function fetchInspectorData() {
  if (!inspectorState.selectedTable) return;
  inspectorState.loading = true;
  updateInspectorUI();

  try {
    const params = new URLSearchParams({
      db: inspectorState.selectedDb || "data.db",
      table: inspectorState.selectedTable,
      page: inspectorState.page,
      limit: inspectorState.limit,
      search: inspectorState.search,
    });
    const res = await fetch(`/api/admin/inspector/data?${params.toString()}`);
    if (res.ok) {
      const result = await res.json();
      inspectorState.columns = Array.isArray(result.columns) ? result.columns : [];
      inspectorState.rows = Array.isArray(result.rows) ? result.rows : [];
      inspectorState.total = typeof result.total === 'number' ? result.total : 0;
    } else {
      showToast("Error al obtener datos de la tabla.", "error");
    }
  } catch (e) {
    console.error("Error al obtener datos de la tabla:", e);
    showToast("Error al conectar con el inspector.", "error");
  } finally {
    inspectorState.loading = false;
    updateInspectorUI();
  }
}

function renderDatabaseInspectorHtml() {
  const hasTables = inspectorState.tables && Object.keys(inspectorState.tables).length > 0;
  if (!hasTables) {
    setTimeout(initDatabaseInspector, 0);
  }

  return `
    <div class="space-y-6 mt-6 animate-fade-in" id="database-inspector-root">
      ${renderDatabaseInspectorContent()}
    </div>
  `;
}

function updateInspectorUI() {
  const root = document.getElementById("database-inspector-root");
  if (root) {
    root.innerHTML = renderDatabaseInspectorContent();
    if (window.lucide && typeof window.lucide.createIcons === "function") {
      window.lucide.createIcons();
    }
  }
}

function renderDatabaseInspectorContent() {
  if (inspectorState.loading && inspectorState.columns.length === 0) {
    return `
      <div class="h-64 flex flex-col items-center justify-center gap-4 animate-fade-in">
        <div class="w-12 h-12 border-4 border-border-ui border-brand-500 rounded-full animate-spin"></div>
        <p class="text-sm text-text-secondary font-medium">Consultando tabla...</p>
      </div>
    `;
  }

  // Selector de Bases de Datos
  let dbOptions = "";
  for (const dbName in inspectorState.tables) {
    dbOptions += `<option value="${dbName}" ${inspectorState.selectedDb === dbName ? "selected" : ""}>${dbName}</option>`;
  }

  // Selector de Tablas (solo para la base de datos seleccionada)
  let tableOptions = "";
  const rawTables = inspectorState.tables ? inspectorState.tables[inspectorState.selectedDb] : [];
  const currentTables = Array.isArray(rawTables) ? rawTables : [];
  currentTables.forEach((t) => {
    tableOptions += `<option value="${t}" ${inspectorState.selectedTable === t ? "selected" : ""}>${t}</option>`;
  });

  // Columnas y cabeceras
  let headersHtml = "";
  let colCount = inspectorState.columns.length || 1;
  if (inspectorState.columns.length > 0) {
    headersHtml = inspectorState.columns
      .map(
        (col) =>
          `<th class="px-3 py-3 text-left font-bold text-[10px] text-text-tertiary uppercase tracking-wider font-mono select-none whitespace-nowrap" title="${col.type} ${col.notnull ? "NOT NULL" : ""}">${escapeHtml(col.name)}</th>`,
      )
      .join("");
  } else {
    headersHtml = `<th class="px-6 py-3 text-left font-bold text-[10px] text-text-tertiary uppercase tracking-wider">Columnas</th>`;
  }

  // Filas de datos
  let rowsHtml = "";
  if (inspectorState.rows.length === 0) {
    rowsHtml = `<tr><td colspan="${colCount}" class="px-6 py-8 text-center text-xs text-text-tertiary">La tabla está vacía o no tiene registros que coincidan con la búsqueda.</td></tr>`;
  } else {
    inspectorState.rows.forEach((row) => {
      rowsHtml += `<tr class="hover:bg-border-ui dark:hover:bg-border-ui/50 border-b border-border-ui transition-colors">`;
      inspectorState.columns.forEach((col) => {
        let val = row[col.name];
        let valStr = "";
        if (val === null || val === undefined) {
          valStr = `<span class="text-text-tertiary font-mono italic text-[10px]">NULL</span>`;
        } else if (typeof val === "object") {
          valStr = `<span class="text-text-secondary font-mono text-[11px]">${escapeHtml(JSON.stringify(val))}</span>`;
        } else {
          valStr = `<span class="text-text-primary text-xs">${escapeHtml(String(val))}</span>`;
        }
        rowsHtml += `<td class="px-3 py-2.5 max-w-xs truncate font-medium align-middle" title="${escapeHtmlAttr(String(val || ""))}">${valStr}</td>`;
      });
      rowsHtml += `</tr>`;
    });
  }

  // Generar botones de paginación del inspector
  const totalPages = Math.ceil(inspectorState.total / inspectorState.limit);
  const startItem =
    inspectorState.total === 0
      ? 0
      : (inspectorState.page - 1) * inspectorState.limit + 1;
  const endItem = Math.min(
    inspectorState.page * inspectorState.limit,
    inspectorState.total,
  );

  let pagesHtml = "";
  if (totalPages > 1) {
    const prevDisabled = inspectorState.page === 1;
    const nextDisabled = inspectorState.page === totalPages;

    pagesHtml += `
      <div class="flex items-center gap-1.5 font-sans">
        <button onclick="${prevDisabled ? "" : "changeInspectorPage(" + (inspectorState.page - 1) + ")"}" 
                title="Página anterior" aria-label="Página anterior"
                class="h-8 w-8 rounded-lg flex items-center justify-center border border-border-ui bg-bg-card text-text-secondary hover:text-text-primary transition-all ${prevDisabled ?"opacity-40 cursor-not-allowed" : "hover:bg-border-ui dark:hover:bg-border-ui/50 cursor-pointer"}">
          <i data-lucide="chevron-left" class="h-4 w-4"></i>
        </button>
        <span class="text-xs text-text-secondary px-2.5 font-semibold font-sans">Página ${inspectorState.page} de ${totalPages}</span>
        <button onclick="${nextDisabled ? "" : "changeInspectorPage(" + (inspectorState.page + 1) + ")"}" 
                title="Página siguiente" aria-label="Página siguiente"
                class="h-8 w-8 rounded-lg flex items-center justify-center border border-border-ui bg-bg-card text-text-secondary hover:text-text-primary transition-all ${nextDisabled ?"opacity-40 cursor-not-allowed" : "hover:bg-border-ui dark:hover:bg-border-ui/50 cursor-pointer"}">
          <i data-lucide="chevron-right" class="h-4 w-4"></i>
        </button>
      </div>
    `;
  }

  const paginationControlsHtml = `
    <div class="p-4 border-t border-border-ui flex flex-col sm:flex-row items-center justify-between gap-4 bg-bg-main">
      <div class="text-xs text-text-secondary font-medium">
        Mostrando <span class="text-text-primary font-bold">${startItem}</span> a <span class="text-text-primary font-bold">${endItem}</span> de <span class="text-text-primary font-bold">${inspectorState.total}</span> registros
      </div>
      ${pagesHtml}
    </div>
  `;

  return `
    <div class="flex flex-col md:flex-row gap-4 items-center justify-between relative z-30">
      <div class="flex flex-col sm:flex-row gap-3 items-center w-full md:w-auto">
        
        <!-- CUSTOM DROPDOWN: BASE DE DATOS -->
        <div class="relative w-full sm:w-auto" id="dropdown-inspector-db-container">
          <div class="flex items-center gap-2">
            <span class="text-xs font-bold text-text-tertiary uppercase tracking-wider shrink-0 flex items-center gap-1.5">
              <i data-lucide="database" class="h-3.5 w-3.5 text-brand-500"></i>
              <span>Base:</span>
            </span>
            <button type="button" onclick="toggleInspectorDbDropdown(event)" class="w-full sm:w-52 px-3 py-2 rounded-xl text-xs bg-bg-card hover:bg-border-ui dark:hover:bg-border-ui border border-border-ui hover:border-border-ui dark:hover:border-border-ui font-bold text-text-primary flex items-center justify-between gap-2 shadow-xs transition-all cursor-pointer">
              <span class="truncate font-mono">${inspectorState.selectedDb}</span>
              <i data-lucide="chevron-down" class="h-3.5 w-3.5 text-text-tertiary transition-transform ${inspectorState.isDbDropdownOpen ? 'rotate-180 text-brand-500' : ''}"></i>
            </button>
          </div>

          ${inspectorState.isDbDropdownOpen ? `
          <div class="absolute left-0 sm:left-14 top-full mt-1.5 w-full sm:w-60 bg-bg-header border border-border-ui rounded-xl shadow-2xl backdrop-blur-xl p-1.5 z-50 animate-fade-in divide-y divide-border-ui divide-border-ui">
            <div class="p-1 space-y-1">
              ${Object.keys(inspectorState.tables).map(dbName => {
                const isSelected = inspectorState.selectedDb === dbName;
                let badge = 'Compartida';
                let iconColor = 'text-brand-500';
                if (dbName === 'data.db') { badge = 'Datos'; iconColor = 'text-brand-500'; }
                else if (dbName === 'app.db') { badge = 'Operación'; iconColor = 'text-emerald-500'; }
                else if (dbName === 'usuarios.db') { badge = 'Seguridad'; iconColor = 'text-purple-500'; }
                else if (dbName === 'local.db') { badge = 'Local'; iconColor = 'text-amber-500'; }
                
                return `
                <button type="button" onclick="selectInspectorDb('${dbName}')" class="w-full px-2.5 py-2 rounded-lg text-left text-xs font-semibold flex items-center justify-between transition-all cursor-pointer ${isSelected ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/20 dark:text-brand-300 border border-brand-200 dark:border-brand-500/30' : 'text-text-secondary hover:bg-border-ui dark:hover:bg-border-ui/50 hover:text-text-primary '}">
                  <div class="flex items-center gap-2 truncate">
                    <i data-lucide="database" class="h-3.5 w-3.5 shrink-0 ${iconColor}"></i>
                    <span class="font-mono truncate">${dbName}</span>
                  </div>
                  <span class="text-[9px] uppercase px-1.5 py-0.5 rounded bg-border-ui text-text-secondary font-bold border border-border-ui">${badge}</span>
                </button>
                `;
              }).join('')}
            </div>
          </div>
          ` : ''}
        </div>

        <!-- CUSTOM DROPDOWN: TABLA -->
        <div class="relative w-full sm:w-auto sm:ml-2" id="dropdown-inspector-table-container">
          <div class="flex items-center gap-2">
            <span class="text-xs font-bold text-text-tertiary uppercase tracking-wider shrink-0 flex items-center gap-1.5">
              <i data-lucide="table" class="h-3.5 w-3.5 text-purple-500"></i>
              <span>Tabla:</span>
            </span>
            <button type="button" onclick="toggleInspectorTableDropdown(event)" class="w-full sm:w-56 px-3 py-2 rounded-xl text-xs bg-bg-card hover:bg-border-ui dark:hover:bg-border-ui border border-border-ui hover:border-border-ui dark:hover:border-border-ui font-bold text-text-primary flex items-center justify-between gap-2 shadow-xs transition-all cursor-pointer">
              <span class="truncate font-mono">${inspectorState.selectedTable || 'Seleccionar tabla'}</span>
              <i data-lucide="chevron-down" class="h-3.5 w-3.5 text-text-tertiary transition-transform ${inspectorState.isTableDropdownOpen ? 'rotate-180 text-purple-500' : ''}"></i>
            </button>
          </div>

          ${inspectorState.isTableDropdownOpen ? `
          <div class="absolute left-0 sm:left-14 top-full mt-1.5 w-full sm:w-64 max-h-72 overflow-y-auto bg-bg-header border border-border-ui rounded-xl shadow-2xl backdrop-blur-xl p-1.5 z-50 animate-fade-in space-y-1">
            ${(inspectorState.tables[inspectorState.selectedDb] || []).map(tbl => {
              const isSelected = inspectorState.selectedTable === tbl;
              return `
              <button type="button" onclick="selectInspectorTable('${tbl}')" class="w-full px-2.5 py-1.5 rounded-lg text-left text-xs font-medium flex items-center justify-between transition-all cursor-pointer ${isSelected ? 'bg-purple-50 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300 border border-purple-200 dark:border-purple-500/30 font-bold' : 'text-text-secondary hover:bg-border-ui dark:hover:bg-border-ui/50 hover:text-text-primary '}">
                <div class="flex items-center gap-2 truncate">
                  <i data-lucide="table-properties" class="h-3.5 w-3.5 shrink-0 text-text-tertiary"></i>
                  <span class="font-mono truncate">${tbl}</span>
                </div>
                ${isSelected ? '<i data-lucide="check" class="h-3.5 w-3.5 text-purple-600 dark:text-purple-400 shrink-0"></i>' : ''}
              </button>
              `;
            }).join('')}
          </div>
          ` : ''}
        </div>

      </div>
      
      <div class="relative w-full md:w-80">
        <span class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-tertiary">
          <i data-lucide="search" class="h-4 w-4"></i>
        </span>
        <input type="text" oninput="onInspectorSearch(this.value)" placeholder="Buscar en tabla..." value="${escapeHtmlAttr(inspectorState.search)}" class="w-full py-2 pl-9 pr-4 rounded-xl text-xs bg-bg-card border border-border-ui focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none transition-all text-text-primary font-medium placeholder:text-text-tertiary shadow-xs">
      </div>
    </div>

    <!-- TABLA DE DATOS -->
    <div class="rounded-2xl overflow-hidden mt-4 border border-border-ui bg-bg-header shadow-xs">
      <div class="overflow-x-auto">
        <table class="w-full text-left border-collapse table-auto">
          <thead>
            <tr class="bg-bg-main border-b border-border-ui text-text-tertiary">
              ${headersHtml}
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </div>
      ${paginationControlsHtml}
    </div>
  `;
}

function toggleInspectorDbDropdown(event) {
  if (event) event.stopPropagation();
  inspectorState.isDbDropdownOpen = !inspectorState.isDbDropdownOpen;
  inspectorState.isTableDropdownOpen = false;
  updateInspectorUI();
}
window.toggleInspectorDbDropdown = toggleInspectorDbDropdown;

function toggleInspectorTableDropdown(event) {
  if (event) event.stopPropagation();
  inspectorState.isTableDropdownOpen = !inspectorState.isTableDropdownOpen;
  inspectorState.isDbDropdownOpen = false;
  updateInspectorUI();
}
window.toggleInspectorTableDropdown = toggleInspectorTableDropdown;

function onInspectorDbChange(dbName) {
  inspectorState.selectedDb = dbName;
  const tablesList = inspectorState.tables[dbName] || [];
  inspectorState.selectedTable = tablesList.length > 0 ? tablesList[0] : "";
  inspectorState.page = 1;
  inspectorState.search = "";
  fetchInspectorData();
}
window.onInspectorDbChange = onInspectorDbChange;

function onInspectorTableChange(table) {
  inspectorState.selectedTable = table;
  inspectorState.page = 1;
  inspectorState.search = "";
  fetchInspectorData();
}
window.onInspectorTableChange = onInspectorTableChange;

function selectInspectorDb(dbName) {
  inspectorState.isDbDropdownOpen = false;
  onInspectorDbChange(dbName);
}
window.selectInspectorDb = selectInspectorDb;

function selectInspectorTable(table) {
  inspectorState.isTableDropdownOpen = false;
  onInspectorTableChange(table);
}
window.selectInspectorTable = selectInspectorTable;

document.addEventListener('click', (e) => {
  if (inspectorState.isDbDropdownOpen || inspectorState.isTableDropdownOpen) {
    const dbContainer = document.getElementById('dropdown-inspector-db-container');
    const tableContainer = document.getElementById('dropdown-inspector-table-container');
    if ((!dbContainer || !dbContainer.contains(e.target)) && (!tableContainer || !tableContainer.contains(e.target))) {
      inspectorState.isDbDropdownOpen = false;
      inspectorState.isTableDropdownOpen = false;
      updateInspectorUI();
    }
  }
});

const debouncedInspectorSearch = debounce(() => {
  fetchInspectorData();
}, 250);

function onInspectorSearch(query) {
  inspectorState.search = query;
  inspectorState.page = 1;
  debouncedInspectorSearch();
}
window.onInspectorSearch = onInspectorSearch;

function changeInspectorPage(page) {
  inspectorState.page = page;
  fetchInspectorData();
}
window.changeInspectorPage = changeInspectorPage;


export const DatabaseTab = {
  mount(container) {
    if (container) {
      container.innerHTML = renderDatabaseInspectorHtml();
      if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
      }
    }
  },
  unmount() {},
  renderTabHtml: renderDatabaseInspectorHtml,
  initDatabaseInspector: typeof initDatabaseInspector !== 'undefined' ? initDatabaseInspector : undefined,
  changeInspectorPage: typeof changeInspectorPage !== 'undefined' ? changeInspectorPage : undefined
};

if (typeof window !== 'undefined') {
  window.DatabaseTab = DatabaseTab;
  window.renderDatabaseInspectorHtml = renderDatabaseInspectorHtml;
  if (typeof initDatabaseInspector !== 'undefined') window.initDatabaseInspector = initDatabaseInspector;
  if (typeof changeInspectorPage !== 'undefined') window.changeInspectorPage = changeInspectorPage;
  if (typeof updateInspectorUI !== 'undefined') window.updateInspectorUI = updateInspectorUI;
}
