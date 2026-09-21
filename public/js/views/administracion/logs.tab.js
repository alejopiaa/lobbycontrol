/**
 * LogsTab - Modulo desacoplado de Bitacora de Auditoria y Logs del Sistema
 */

function renderLogsTabHtml() {
  const currentFilter = (typeof paginationState !== 'undefined' && paginationState.logs) ? paginationState.logs.filterType : 'all';
  
  const getPillClass = (type, activeType) => {
    if (type === activeType) {
      if (type === 'all') return 'bg-border-ui  text-[var(--text-primary)] font-bold';
      if (type === 'error') return 'bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-500 font-bold';
      if (type === 'warn') return 'bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 font-bold';
      if (type === 'auth') return 'bg-sky-500/10 border border-sky-500/30 text-sky-600 dark:text-sky-400 shadow-sm font-bold';
      if (type === 'info') return 'bg-border-ui/40 border border-border-ui text-text-secondary  font-bold';
    }
    // Inactivos
    if (type === 'error') return 'border border-transparent text-text-tertiary  hover:text-rose-500 hover:bg-rose-500/5 dark:hover:bg-rose-500/10';
    if (type === 'warn') return 'border border-transparent text-text-tertiary  hover:text-amber-500 hover:bg-amber-500/5 dark:hover:bg-amber-500/10';
    if (type === 'auth') return 'border border-transparent text-text-tertiary  hover:text-sky-500 hover:bg-sky-500/5 dark:hover:bg-sky-500/10';
    return 'border border-transparent text-text-tertiary  hover:text-[var(--text-primary)] hover:bg-border-ui/50';
  };

  return `
    <div class="space-y-4 animate-fade-in font-sans">
      <div class="pb-4 flex flex-col xl:flex-row xl:items-center justify-between gap-4 border-b border-border-ui">
        <div class="flex items-center gap-3">
          <div class="h-9 w-9 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center shrink-0">
            <i data-lucide="file-text" class="h-4.5 w-4.5"></i>
          </div>
          <div>
            <h3 class="text-xs font-bold uppercase tracking-wider text-heading font-sans">Bitácora de Logs</h3>
            <p class="text-[10px] text-text-tertiary mt-0.5 font-medium">
              Últimos eventos registrados • Clic en una fila para ver detalles
            </p>
          </div>
        </div>
        
        <!-- Filtro Segmentado Premium y Acciones -->
        <div class="flex items-center gap-3.5 flex-wrap">
          <!-- Selector de Tipo de Registro (Segmentado Estilo Alertas) -->
          <div class="flex items-center gap-1.5 pb-2.5 lg:pb-0 overflow-x-auto whitespace-nowrap scrollbar-none">
            <span class="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider mr-1 select-none">Filtro:</span>
            <button onclick="filterLogsByType('all')" class="px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${getPillClass('all', currentFilter)}">
              Todos
            </button>
            <button onclick="filterLogsByType('error')" class="px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${getPillClass('error', currentFilter)}">
              <span class="h-1.5 w-1.5 rounded-full bg-rose-500 shrink-0"></span>
              Crítico
            </button>
            <button onclick="filterLogsByType('warn')" class="px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${getPillClass('warn', currentFilter)}">
              <span class="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0"></span>
              Advertencia
            </button>
            <button onclick="filterLogsByType('auth')" class="px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${getPillClass('auth', currentFilter)}">
              <span class="h-1.5 w-1.5 rounded-full bg-sky-500 shrink-0"></span>
              Auth
            </button>
            <button onclick="filterLogsByType('info')" class="px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${getPillClass('info', currentFilter)}">
              <span class="h-1.5 w-1.5 rounded-full bg-border-ui shrink-0"></span>
              Info
            </button>
          </div>

          <div class="flex items-center gap-2">
            <span id="logs-count-badge" class="inline-flex items-center justify-center min-w-[24px] h-6 px-2 rounded-full bg-border-ui border border-border-ui text-[10px] font-bold text-text-secondary tabular-nums">—</span>
            
            <button onclick="refreshAdminLogs(true)" class="px-3 py-1.5 bg-border-ui hover:bg-border-ui dark:hover:bg-border-ui/50 text-text-secondary rounded-lg text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1.5 active:scale-[0.95] border border-border-ui">
              <i data-lucide="refresh-cw" class="h-3 w-3"></i> Actualizar
            </button>
          </div>
        </div>
      </div>

      <!-- Tabla de logs -->
      <div class="overflow-x-auto rounded-xl border border-border-ui mt-2">
        <table class="w-full text-left">
          <thead>
            <tr class="bg-bg-main border-b border-border-ui">
              <th class="py-2.5 px-3 text-[9px] font-bold text-text-tertiary uppercase tracking-widest w-[140px]">Fecha / Hora</th>
              <th class="py-2.5 px-3 text-[9px] font-bold text-text-tertiary uppercase tracking-widest w-[120px]">Código</th>
              <th class="py-2.5 px-3 text-[9px] font-bold text-text-tertiary uppercase tracking-widest">Mensaje</th>
              <th class="py-2.5 px-3 text-[9px] font-bold text-text-secondary uppercase tracking-widest w-[80px]"></th>
            </tr>
          </thead>
          <tbody id="logs-table-body">
            <tr><td colspan="4" class="text-center py-8 text-text-tertiary text-xs font-semibold">Cargando registros...</td></tr>
          </tbody>
        </table>
      </div>

      <!-- Paginación -->
      <div id="logs-pagination-container" class="mt-4"></div>
    </div>
  `;
}


let _logEntries = [];

export async function refreshAdminLogs(force = false) {
  const container = document.getElementById('logs-table-body');
  const countEl = document.getElementById('logs-count-badge');
  if (!container) return;
  
  if (force || _logEntries.length === 0) {
    container.innerHTML = `<tr><td colspan="4" class="text-center py-8 text-text-tertiary text-xs font-semibold">Cargando registros...</td></tr>`;
    try {
      const res = await fetch('/api/admin/logs');
      const data = await res.json();
      _logEntries = (data && data.entries) ? data.entries : [];
    } catch (err) {
      console.error('Error al obtener bitácora de logs:', err);
      container.innerHTML = `<tr><td colspan="4" class="text-center py-8 text-rose-400 text-xs font-semibold">Error de red al obtener bitácora de logs.</td></tr>`;
      return;
    }
  }

  if (_logEntries.length === 0) {
    container.innerHTML = `<tr><td colspan="4" class="text-center py-8 text-text-tertiary text-xs font-semibold">
      <div class="flex flex-col items-center gap-2">
        <i data-lucide="check-circle" class="h-8 w-8 text-emerald-600/40"></i>
        <span>No hay logs registrados. ¡Todo en orden!</span>
      </div>
    </td></tr>`;
    if (countEl) countEl.textContent = '0';
    const paginationContainer = document.getElementById('logs-pagination-container');
    if (paginationContainer) paginationContainer.innerHTML = '';
    if (window.lucide) lucide.createIcons();
    return;
  }

  const pagState = window.paginationState || {};
  const filterType = (pagState.logs && pagState.logs.filterType) ? pagState.logs.filterType : 'all';
  const filtered = _logEntries.filter(entry => {
    if (filterType === 'all') return true;
    const code = entry.code || '';
    if (filterType === 'warn') {
      return code.startsWith('ERR-NET') || code.startsWith('ERR-SYNC');
    }
    if (filterType === 'auth') {
      return code.startsWith('ERR-AUTH') || code.startsWith('AUTH-');
    }
    if (filterType === 'error') {
      return code.startsWith('ERR-') && !code.startsWith('ERR-NET') && !code.startsWith('ERR-SYNC') && !code.startsWith('ERR-AUTH');
    }
    if (filterType === 'info') {
      return !code.startsWith('ERR-') && !code.startsWith('AUTH-');
    }
    return true;
  });

  if (countEl) countEl.textContent = String(filtered.length);

  if (filtered.length === 0) {
    container.innerHTML = `<tr><td colspan="4" class="text-center py-8 text-text-tertiary text-xs font-semibold">No hay registros que coincidan con el filtro seleccionado.</td></tr>`;
    const paginationContainer = document.getElementById('logs-pagination-container');
    if (paginationContainer) paginationContainer.innerHTML = '';
    if (window.lucide) lucide.createIcons();
    return;
  }

  // Paginación
  const pageSize = 15;
  const totalItems = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  
  let currentPage = (pagState.logs && pagState.logs.page) ? pagState.logs.page : 1;
  if (currentPage > totalPages) {
    currentPage = totalPages;
    if (pagState.logs) pagState.logs.page = currentPage;
  }
  
  const startIndex = (currentPage - 1) * pageSize;
  const paginated = filtered.slice(startIndex, startIndex + pageSize);

  const severityColor = (code) => {
    if (code.startsWith('ERR-NET') || code.startsWith('ERR-SYNC')) return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 dark:border-amber-800/40';
    if (code.startsWith('ERR-AUTH') || code.startsWith('AUTH-')) return 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20 dark:border-sky-800/40';
    if (code.startsWith('ERR-')) return 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20 dark:border-rose-800/40';
    return 'bg-border-ui/40 text-text-secondary  border-border-ui ';
  };

  container.innerHTML = paginated.map((entry) => {
    const originalIndex = _logEntries.indexOf(entry);
    return `
      <tr class="border-b border-border-ui hover:bg-border-ui dark:hover:bg-border-ui/50 transition-colors cursor-pointer group" onclick="openLogDetailModal(${originalIndex})">
        <td class="py-2.5 px-3 text-[10px] text-text-secondary font-mono whitespace-nowrap">${entry.timestamp}</td>
        <td class="py-2.5 px-3">
          <span class="inline-block px-2 py-0.5 rounded-md text-[9px] font-bold border ${severityColor(entry.code)}">${entry.code}</span>
        </td>
        <td class="py-2.5 px-3 text-[11px] text-text-secondary max-w-[350px] truncate font-medium">${entry.message}</td>
        <td class="py-2.5 px-3 text-right">
          <span class="opacity-0 group-hover:opacity-100 transition-opacity text-[9px] text-brand-600 dark:text-brand-400 font-bold">Ver detalle →</span>
        </td>
      </tr>
    `;
  }).join('');

  const paginationContainer = document.getElementById('logs-pagination-container');
  if (paginationContainer) {
    const renderControls = typeof renderPaginationControls === 'function' ? renderPaginationControls : window.renderPaginationControls;
    if (typeof renderControls === 'function') {
      paginationContainer.innerHTML = renderControls('logs', totalItems, currentPage, pageSize);
    }
  }

  if (window.lucide) lucide.createIcons();
}

export function filterLogsByType(type) {
  if (!window.paginationState) {
    window.paginationState = {};
  }
  if (!window.paginationState.logs) {
    window.paginationState.logs = { page: 1, filterType: 'all' };
  }
  window.paginationState.logs.filterType = type;
  window.paginationState.logs.page = 1;
  
  const container = document.getElementById("main-content");
  if (container && typeof renderUsuarios === "function") {
    renderUsuarios(container);
  } else {
    refreshAdminLogs(false);
  }
}

export function openLogDetailModal(index) {
  const entry = _logEntries[index];
  if (!entry) return;
  
  const modal = document.getElementById('modal-container');
  if (!modal) return;
  modal.classList.remove('hidden');
  
  const severityLabel = (code) => {
    if (code.startsWith('ERR-GEN') || code.startsWith('ERR-DB-5')) return { text: 'CRÍTICO', cls: 'bg-rose-500/20 text-rose-400 border-rose-500/40' };
    if (code.startsWith('ERR-NET') || code.startsWith('ERR-SYNC')) return { text: 'ADVERTENCIA', cls: 'bg-amber-500/20 text-amber-400 border-amber-500/40' };
    if (code.startsWith('ERR-AUTH')) return { text: 'AUTENTICACIÓN', cls: 'bg-sky-500/20 text-sky-400 border-sky-500/40' };
    return { text: 'INFO', cls: 'bg-border-ui/40 text-text-tertiary border-border-ui' };
  };
  
  const severity = severityLabel(entry.code);
  const hasDetails = entry.details && entry.details.trim().length > 0;
  const escapedFull = JSON.stringify(`[${entry.timestamp}] [${entry.code}] ${entry.message}${hasDetails ? ' | ' + entry.details : ''}`).slice(1, -1);
  
  modal.innerHTML = `
    <div class="glass-card w-full max-w-lg p-6 rounded-3xl space-y-5 shadow-2xl relative animate-fade-in border border-border-ui">
      <!-- Header -->
      <div class="flex items-start justify-between">
        <div class="flex items-center gap-3">
          <div class="h-10 w-10 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center shrink-0">
            <i data-lucide="file-warning" class="h-5 w-5"></i>
          </div>
          <div>
            <h3 class="text-sm font-bold text-heading">Detalle del Evento</h3>
            <p class="text-[10px] text-text-tertiary mt-0.5">${entry.timestamp}</p>
          </div>
        </div>
        <button onclick="closeModal()" title="Cerrar modal" aria-label="Cerrar modal" class="text-text-tertiary hover:text-text-primary transition-colors bg-transparent border-none cursor-pointer p-1">
          <i data-lucide="x" class="h-4 w-4"></i>
        </button>
      </div>
      
      <!-- Badges -->
      <div class="flex items-center gap-2">
        <span class="inline-block px-2.5 py-1 rounded-lg text-[10px] font-bold border ${severity.cls}">${severity.text}</span>
        <span class="inline-block px-2.5 py-1 rounded-lg text-[10px] font-bold bg-border-ui/50 text-text-secondary border border-border-ui font-mono">${entry.code}</span>
      </div>
      
      <!-- Mensaje -->
      <div class="space-y-1.5">
        <label class="text-[9px] font-bold text-text-tertiary uppercase tracking-widest">Mensaje</label>
        <p class="text-xs text-text-secondary leading-relaxed bg-black/50 rounded-xl px-4 py-3 border border-border-ui">${entry.message}</p>
      </div>
      
      <!-- Detalle Técnico -->
      ${hasDetails ? `
      <div class="space-y-1.5">
        <label class="text-[9px] font-bold text-text-tertiary uppercase tracking-widest">Detalle Técnico</label>
        <pre class="text-[10px] text-text-tertiary font-mono leading-relaxed bg-black/50 rounded-xl px-4 py-3 border border-border-ui max-h-48 overflow-y-auto whitespace-pre-wrap break-all">${entry.details}</pre>
      </div>
      ` : ''}
      
      <!-- Acciones -->
      <div class="flex justify-end gap-2 pt-1">
        <button onclick="navigator.clipboard.writeText('${escapedFull.replace(/'/g, "\\'")}'); showToast('Registro copiado al portapapeles', 'success', { persistent: false });" 
                class="px-3 py-2 rounded-xl text-[10px] font-bold btn-secondary flex items-center gap-1.5 cursor-pointer">
          <i data-lucide="copy" class="h-3.5 w-3.5"></i> Copiar
        </button>
        <button onclick="closeModal()" class="px-4 py-2 rounded-xl text-[10px] font-bold btn-primary text-white cursor-pointer">
          Cerrar
        </button>
      </div>
    </div>
  `;
  
  if (window.lucide) lucide.createIcons();
}

export const LogsTab = {
  mount(container) {
    if (container) {
      container.innerHTML = renderLogsTabHtml();
      if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
      }
    }
    if (typeof refreshAdminLogs === 'function') {
      refreshAdminLogs();
    }
  },
  unmount() {},
  renderTabHtml: renderLogsTabHtml,
  refreshAdminLogs,
  filterLogsByType,
  openLogDetailModal
};

if (typeof window !== 'undefined') {
  window.LogsTab = LogsTab;
  window.renderLogsTabHtml = renderLogsTabHtml;
  window.refreshAdminLogs = refreshAdminLogs;
  window.filterLogsByType = filterLogsByType;
  window.openLogDetailModal = openLogDetailModal;
}
