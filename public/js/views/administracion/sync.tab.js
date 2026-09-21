/**
 * SyncTab - Modulo desacoplado de Sincronizacion y SharePoint
 */

import { renderGlassCard } from '../../components/ui.js';

function renderHistoryList() {
  const list = dataStore.syncHistory || [];
  if (list.length === 0) {
    return `<p class="text-center text-[10px] text-text-tertiary py-4">No se registran sincronizaciones previas.</p>`;
  }

  return list
    .map((item) => {
      let badgeClass = "badge-status-normal";
      if (item.estado === "Exitoso") {
        badgeClass = "badge-status-enplazo";
      } else if (item.estado === "Fallido") {
        badgeClass = "badge-status-vencido";
      } else if (item.estado === "Cancelado") {
        badgeClass = "badge-status-otros";
      }

      let dateStr = item.timestamp;
      try {
        const d = new Date(item.timestamp.replace(" ", "T") + "Z");
        dateStr = d.toLocaleString("es-CL", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        });
      } catch (err) {
        console.warn('[sync] Error formateando fecha historial:', err);
        dateStr = item.timestamp || '';
      }

      let detailStr = "";
      let hasDetails = false;
      try {
        const statsObj = JSON.parse(item.detalles);
        const ins =
          (statsObj.sh?.inserts || 0) +
          (statsObj.ph?.inserts || 0) +
          (statsObj.sph?.inserts || 0) +
          (statsObj.vh?.inserts || 0) +
          (statsObj.dh?.inserts || 0);
        const upd =
          (statsObj.sh?.updates || 0) +
          (statsObj.ph?.updates || 0) +
          (statsObj.sph?.updates || 0) +
          (statsObj.vh?.updates || 0) +
          (statsObj.dh?.updates || 0);
        const del =
          (statsObj.sh?.deletes || 0) +
          (statsObj.ph?.deletes || 0) +
          (statsObj.sph?.deletes || 0) +
          (statsObj.vh?.deletes || 0) +
          (statsObj.dh?.deletes || 0);
        detailStr = `${ins} creados, ${upd} act., ${del} elim.`;
        hasDetails =
          (statsObj.sh?.details && statsObj.sh.details.length > 0) ||
          (statsObj.ph?.details && statsObj.ph.details.length > 0) ||
          (statsObj.sph?.details && statsObj.sph.details.length > 0) ||
          (statsObj.vh?.details && statsObj.vh.details.length > 0) ||
          (statsObj.dh?.details && statsObj.dh.details.length > 0);
      } catch (e) {
        console.warn('[sync] Error procesando detalles historial:', e);
        detailStr = item.detalles || "";
      }

      return `
      <div class="py-1.5 px-2.5 rounded-lg border border-border-ui/60 bg-bg-main hover:border-brand-500 transition-colors flex items-center justify-between gap-2.5 text-xs">
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2">
            <span class="font-bold text-heading text-[11px] font-mono">${dateStr}</span>
            <span class="px-1.5 py-0.2 rounded text-[9px] font-semibold ${badgeClass}">${item.estado}</span>
          </div>
          <div class="text-[10px] text-body-muted font-mono truncate mt-0.5">${detailStr}</div>
        </div>
        ${
          hasDetails
            ? `
          <button onclick="viewSyncDetails(${item.id})" class="text-text-tertiary hover:text-brand-500 p-1 transition-colors cursor-pointer border-none bg-transparent flex items-center justify-center shrink-0" title="Ver detalles de los cambios">
            <i data-lucide="eye" class="h-3.5 w-3.5"></i>
          </button>
        `
            : ""
        }
      </div>
    `;
    })
    .join("");
}

function showSyncHistoryModal() {
  const modal = document.getElementById('modal-container');
  if (!modal) return;
  modal.classList.remove('hidden');
  modal.classList.add('backdrop-animate-in');

  const historyHtml = typeof renderHistoryList === 'function' ? renderHistoryList() : '<p class="text-xs text-text-tertiary">Sin registros.</p>';

  modal.innerHTML = `
    <div class="glass-card w-full max-w-xl p-6 rounded-3xl space-y-4 shadow-2xl relative modal-animate-in border border-border-ui text-[var(--text-primary)] max-h-[85vh] flex flex-col font-sans text-left">
      <div class="flex items-center justify-between border-b border-border-ui pb-3.5">
        <div class="flex items-center gap-2.5">
          <div class="h-9 w-9 rounded-xl bg-brand-500/10 text-brand-400 flex items-center justify-center shrink-0">
            <i data-lucide="history" class="h-4.5 w-4.5"></i>
          </div>
          <div>
            <h3 class="text-xs font-bold uppercase tracking-wider text-heading">Historial de Sincronizaciones</h3>
            <p class="text-[10px] text-text-tertiary">Registro de cargas de Excel y sincronizaciones con SharePoint</p>
          </div>
        </div>
        <button type="button" onclick="closeModal()" class="h-8 w-8 rounded-xl bg-border-ui/40 hover:bg-border-ui text-text-secondary flex items-center justify-center transition-colors cursor-pointer" title="Cerrar">
          <i data-lucide="x" class="h-4 w-4"></i>
        </button>
      </div>

      <div class="space-y-2 overflow-y-auto custom-scrollbar flex-1 pr-1 max-h-[60vh]">
        ${historyHtml}
      </div>

      <div class="pt-3 border-t border-border-ui flex justify-end">
        <button type="button" onclick="closeModal()" class="py-2 px-5 rounded-xl text-xs font-bold btn-secondary cursor-pointer">
          Cerrar
        </button>
      </div>
    </div>
  `;
  if (typeof lucide !== 'undefined') lucide.createIcons();
}
window.showSyncHistoryModal = showSyncHistoryModal;


export function renderSyncTabHtml() {
  const dataStore = window.dataStore || {};
  const currentUser = window.currentUser || null;
  let contentHtml = "";
  let lastSyncStr = "Sin registros";
    if (dataStore.syncHistory && dataStore.syncHistory.length > 0) {
      const lastSync = dataStore.syncHistory[0];
      try {
        const d = new Date(lastSync.timestamp.replace(" ", "T") + "Z");
        lastSyncStr = d.toLocaleString("es-CL", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        });
      } catch (e) {
        console.warn('[sync] Error formateando fecha último sync:', e);
        lastSyncStr = lastSync.timestamp;
      }
    }

    contentHtml = `
      <div class="mt-4 animate-fade-in">
        ${renderGlassCard(
          `
          <!-- HEADER DE LA CONSOLA MAESTRA -->
          <div class="border-b border-border-ui pb-3.5 mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div class="flex items-center gap-2.5">
              <div class="h-8 w-8 rounded-lg bg-brand-500/10 text-brand-400 flex items-center justify-center shrink-0">
                <i data-lucide="refresh-cw" class="h-4 w-4"></i>
              </div>
              <div>
                <h3 class="text-sm font-bold text-heading">Consola de Sincronización y Datos</h3>
                <p class="text-[11px] text-text-tertiary">Gestión de enlace con SharePoint, actualización de planillas y salud del ecosistema</p>
              </div>
            </div>
            <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20 self-start sm:self-auto">
              <span class="h-2 w-2 rounded-full bg-brand-500 animate-pulse"></span>
              Sistema Operativo
            </span>
          </div>

          <!-- CUERPO PRINCIPAL: 2 ZONAS INTEGRADAS CON SEPARADOR (65% / 35%) -->
          <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 divide-y lg:divide-y-0 lg:divide-x divide-border-ui">
            
            <!-- ZONA 1: OPERACIONES Y CARGA (Izquierda - 65% del ancho) -->
            <div class="space-y-6 lg:col-span-8 lg:pr-8">
              
              <!-- SECCIÓN A: ACTUALIZACIÓN POR PLANILLA (EXCEL) - HERO PRINCIPAL -->
              <div>
                <div class="flex items-center justify-between mb-3">
                  <div class="flex items-center gap-2">
                    <i data-lucide="file-spreadsheet" class="h-4 w-4 text-brand-400"></i>
                    <h4 class="text-xs font-bold uppercase tracking-wider text-heading">Carga de Planilla Excel</h4>
                  </div>
                  <span class="text-[11px] text-text-secondary font-mono">
                    Última carga: <strong class="text-text-primary">${dataStore.dbHealth?.lastImport || '--'}</strong>
                  </span>
                </div>

                <!-- Selector Drag & Drop destacado y accesible -->
                <div class="border-2 border-dashed border-border-ui rounded-xl p-5 text-center hover:border-brand-500 transition-colors cursor-pointer bg-bg-main relative mb-3" 
                     onclick="document.getElementById('import-excel-file').click()"
                     ondragover="event.preventDefault(); this.classList.add('border-brand-500')"
                     ondragleave="this.classList.remove('border-brand-500')"
                     ondrop="event.preventDefault(); this.classList.remove('border-brand-500'); if(event.dataTransfer.files.length) { document.getElementById('import-excel-file').files = event.dataTransfer.files; handleExcelFileSelected({target: document.getElementById('import-excel-file')}); }">
                  <input type="file" id="import-excel-file" accept=".xlsx" class="hidden" onchange="handleExcelFileSelected(event)">
                  <div class="space-y-1.5 pointer-events-none">
                    <i data-lucide="file-up" class="h-7 w-7 text-brand-500 mx-auto"></i>
                    <p class="text-xs font-semibold text-text-secondary" id="excel-file-label">Haz clic para buscar o arrastra aquí tu archivo Excel</p>
                    <p class="text-[10px] text-text-tertiary" id="excel-file-details">Formato .xlsx descargado de la plataforma Ley de Lobby</p>
                  </div>
                </div>

                <div class="flex justify-end pt-1">
                  <button id="btn-clear-excel" type="button" onclick="clearSelectedExcelFile(event)" class="hidden text-xs text-rose-500 hover:text-rose-600 font-semibold py-1 px-2.5 rounded-lg hover:bg-rose-500/10 transition-all flex items-center gap-1.5 cursor-pointer">
                    <i data-lucide="x" class="h-3.5 w-3.5"></i>
                    <span>Quitar archivo</span>
                  </button>
                </div>

                <div id="import-progress-container" class="hidden space-y-2 py-1.5 mb-3">
                  <div class="flex justify-between text-[10px]">
                    <span id="import-progress-status" class="text-text-tertiary font-medium">Sincronizando registros...</span>
                    <span class="text-brand-400 font-bold animate-pulse">En curso</span>
                  </div>
                  <div class="w-full bg-border-ui h-1.5 rounded-full overflow-hidden">
                    <div class="bg-brand-500 h-full w-full animate-pulse rounded-full" style="width: 100%;"></div>
                  </div>
                </div>

                <div class="flex items-center justify-between gap-3 pt-1">
                  <button onclick="downloadBackup()" class="py-2 px-3.5 rounded-xl text-xs font-bold transition-all btn-secondary active:scale-[0.98] flex items-center justify-center gap-2 shrink-0">
                    <i data-lucide="download" class="h-3.5 w-3.5"></i>
                    <span>Respaldar BD</span>
                  </button>

                  <button id="btn-import-sync" onclick="triggerImport()" disabled class="py-2 px-5 bg-border-ui/50 text-text-tertiary rounded-xl text-xs font-bold transition-all cursor-not-allowed flex items-center justify-center gap-2">
                    <i data-lucide="upload" class="h-3.5 w-3.5"></i>
                    <span>Procesar e Importar Excel</span>
                  </button>
                </div>
              </div>

              <!-- SECCIÓN B: ENLACE INSTITUCIONAL SHAREPOINT -->
              <div class="border-t border-border-ui pt-5">
                <div class="flex items-center justify-between mb-3">
                  <div class="flex items-center gap-2">
                    <i data-lucide="cloud" class="h-4 w-4 text-brand-400"></i>
                    <h4 class="text-xs font-bold uppercase tracking-wider text-heading">Enlace Institucional SharePoint</h4>
                  </div>
                  <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    🟢 Conectado
                  </span>
                </div>

                <div class="p-3 rounded-xl border border-border-ui bg-bg-main space-y-1.5 text-xs mb-3">
                  <div class="flex justify-between items-center">
                    <span class="text-text-secondary">Último chequeo:</span>
                    <span id="sync-view-cloud-check" class="font-mono font-medium text-heading">${typeof window.getCloudCheckText === 'function' ? window.getCloudCheckText() : 'Comprobando conexión...'}</span>
                  </div>
                  <div class="flex justify-between items-center pt-1 border-t border-border-ui/60">
                    <span class="text-text-secondary">Última descarga con cambios:</span>
                    <span class="font-mono font-semibold text-heading">${dataStore.dbHealth?.lastCloudUpdate || '--'}</span>
                  </div>
                </div>

                <div class="flex items-center justify-between gap-3">
                  <p class="text-[11px] text-text-tertiary">
                    Comprobación periódica en segundo plano.
                  </p>
                  <button id="btn-sharepoint-sync" onclick="triggerSharepointSync()" class="py-2 px-4 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-bold transition-all active:scale-[0.98] flex items-center justify-center gap-2 shrink-0 shadow-sm">
                    <i data-lucide="refresh-cw" class="h-3.5 w-3.5"></i>
                    <span>Sincronizar con SharePoint</span>
                  </button>
                </div>
              </div>

            </div>

            <!-- ZONA 2: SUPERVISIÓN Y REGISTRO (Derecha - 35% del ancho) -->
            <div class="space-y-6 lg:col-span-4 lg:pl-8 pt-6 lg:pt-0">
              
              <!-- SECCIÓN C: ECOSISTEMA DE BASES DE DATOS -->
              <div>
                <div class="flex items-center justify-between mb-3">
                  <div class="flex items-center gap-2">
                    <i data-lucide="database" class="h-4 w-4 text-brand-400"></i>
                    <h4 class="text-xs font-bold uppercase tracking-wider text-heading">Ecosistema de Bases de Datos</h4>
                  </div>
                  <span class="text-[10px] text-text-tertiary font-mono">SQLite Local</span>
                </div>

                <div class="space-y-2.5 text-xs">
                  <!-- data.db -->
                  <div class="p-3 rounded-xl border border-border-ui bg-bg-main space-y-1">
                    <div class="flex justify-between items-center">
                      <span class="font-bold text-heading text-[11px] font-mono">data.db (Lobby)</span>
                      <span class="font-mono text-[10px] px-1.5 py-0.5 rounded ${dataStore.dbHealth?.integrity === 'ok' ? 'badge-status-enplazo' : 'badge-status-vencido'}">${dataStore.dbHealth?.integrity || 'ok'}</span>
                    </div>
                    <div class="flex justify-between text-[10px] text-body-muted">
                      <span>Tamaño: <strong class="text-heading font-mono">${dataStore.dbHealth?.dbSize || '-'}</strong></span>
                      <span>Firma: <strong class="font-mono ${dataStore.dbHealth?.signatureStatus === 'Válida' ? 'text-emerald-500' : 'text-rose-500'}">${dataStore.dbHealth?.signatureStatus || 'Válida'}</strong></span>
                    </div>
                  </div>

                  <!-- app.db -->
                  <div class="p-3 rounded-xl border border-border-ui bg-bg-main space-y-1">
                    <div class="flex justify-between items-center">
                      <span class="font-bold text-heading text-[11px] font-mono">app.db (Asistencias y Auditoría)</span>
                      <span class="font-mono text-[10px] px-1.5 py-0.5 rounded badge-status-enplazo">ok</span>
                    </div>
                    <div class="flex justify-between text-[10px] text-body-muted">
                      <span>Tamaño: <strong class="text-heading font-mono">${dataStore.dbHealth?.appDbSize || '1.2 MB'}</strong></span>
                      <span><strong class="text-heading">${dataStore.dbHealth?.asistenciasCount ?? '11'}</strong> asistencias · <strong class="text-heading">${dataStore.dbHealth?.auditoriaCount ?? '19'}</strong> auditorías</span>
                    </div>
                  </div>

                  <!-- usuarios.db -->
                  <div class="p-3 rounded-xl border border-border-ui bg-bg-main space-y-1">
                    <div class="flex justify-between items-center">
                      <span class="font-bold text-heading text-[11px] font-mono">usuarios.db (Seguridad)</span>
                      <span class="font-mono text-[10px] px-1.5 py-0.5 rounded badge-status-enplazo">ok</span>
                    </div>
                    <div class="flex justify-between text-[10px] text-body-muted">
                      <span>Tamaño: <strong class="text-heading font-mono">${dataStore.dbHealth?.usersDbSize || '64.0 KB'}</strong></span>
                      <span><strong class="text-heading">${dataStore.dbHealth?.usersCount ?? dataStore.stats?.usuarios ?? '1'}</strong> usuario activo</span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- SECCIÓN D: HISTORIAL RECIENTE (ACCESO DISCRETO) -->
              <div class="border-t border-border-ui pt-4 flex items-center justify-between gap-3">
                <div class="flex items-center gap-2 min-w-0">
                  <i data-lucide="history" class="h-4 w-4 text-brand-400 shrink-0"></i>
                  <div class="text-xs truncate">
                    <span class="text-text-secondary">Última operación: </span>
                    <span class="font-mono font-medium text-heading">${lastSyncStr}</span>
                  </div>
                </div>
                <button type="button" onclick="showSyncHistoryModal()" class="py-1.5 px-3 rounded-lg text-xs font-bold btn-secondary hover:text-brand-400 flex items-center gap-1.5 shrink-0 cursor-pointer transition-all">
                  <i data-lucide="list" class="h-3.5 w-3.5"></i>
                  <span>Ver historial</span>
                </button>
              </div>

            </div>
          </div>

          <!-- FOOTER: DIAGNÓSTICO TÉCNICO Y ARQUITECTURA (OPCIÓN 3) -->
          <div class="mt-8 pt-5 border-t border-border-ui/70 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div class="p-3 rounded-xl bg-bg-main/60 border border-border-ui/60 flex items-center gap-3">
              <div class="h-8 w-8 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
                <i data-lucide="hard-drive" class="h-4 w-4"></i>
              </div>
              <div class="min-w-0">
                <p class="text-[10px] text-text-tertiary font-bold uppercase tracking-wider">Almacenamiento Local</p>
                <p class="font-mono text-[11px] text-heading font-medium truncate mt-0.5" title="AppData/Roaming/LobbyControl/data">AppData/Roaming/LobbyControl/data</p>
              </div>
            </div>

            <div class="p-3 rounded-xl bg-bg-main/60 border border-border-ui/60 flex items-center gap-3">
              <div class="h-8 w-8 rounded-lg bg-brand-500/10 text-brand-400 flex items-center justify-center shrink-0">
                <i data-lucide="shield-check" class="h-4 w-4"></i>
              </div>
              <div class="min-w-0">
                <p class="text-[10px] text-text-tertiary font-bold uppercase tracking-wider">Integridad Criptográfica</p>
                <div class="flex items-center gap-1.5 mt-0.5">
                  <span class="font-mono text-[11px] text-heading font-medium">HMAC-SHA256</span>
                  <span class="font-mono text-[9px] px-1 py-0.2 rounded badge-status-enplazo">Activa</span>
                </div>
              </div>
            </div>

            <div class="p-3 rounded-xl bg-bg-main/60 border border-border-ui/60 flex items-center gap-3">
              <div class="h-8 w-8 rounded-lg bg-purple-500/10 text-purple-500 flex items-center justify-center shrink-0">
                <i data-lucide="cpu" class="h-4 w-4"></i>
              </div>
              <div class="min-w-0">
                <p class="text-[10px] text-text-tertiary font-bold uppercase tracking-wider">Motor de Persistencia</p>
                <p class="font-mono text-[11px] text-heading font-medium truncate mt-0.5">SQLite 3 · WAL Mode</p>
              </div>
            </div>
          </div>
        `,
          "rounded-3xl p-6 shadow-sm border border-border-ui",
        )}
      </div>
    `;

  return contentHtml;
}

let selectedExcelFileBase64 = null;

export function handleExcelFileSelected(event) {
  const input = event.target;
  const file = input.files ? input.files[0] : null;
  const label = document.getElementById('excel-file-label');
  const details = document.getElementById('excel-file-details');
  const btn = document.getElementById('btn-import-sync');
  const clearBtn = document.getElementById('btn-clear-excel');

  if (!file) {
    selectedExcelFileBase64 = null;
    if (label) label.textContent = 'Haz clic para buscar o arrastra aquí tu archivo Excel';
    if (details) details.textContent = 'Solo formato .xlsx';
    if (clearBtn) clearBtn.classList.add('hidden');
    if (btn) {
      btn.disabled = true;
      btn.className = 'flex-1 py-3 bg-border-ui/50 text-text-tertiary rounded-xl text-xs font-bold transition-all cursor-not-allowed flex items-center justify-center gap-2';
      btn.innerHTML = `<i data-lucide="file-up" class="h-4 w-4"></i> <span>Procesar e Importar Excel</span>`;
      if (typeof lucide !== 'undefined') lucide.createIcons();
    }
    return;
  }

  if (clearBtn) clearBtn.classList.remove('hidden');

  if (!file.name.endsWith('.xlsx')) {
    if (typeof showToast === 'function') showToast('El archivo seleccionado debe tener la extensión .xlsx', 'error');
    input.value = '';
    handleExcelFileSelected({ target: input });
    return;
  }

  if (label) {
    label.textContent = `Archivo seleccionado: ${file.name}`;
  }
  if (details) {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
    details.textContent = `Tamaño: ${sizeMB} MB - Listo para sincronizar`;
  }

  const reader = new FileReader();
  reader.onload = function(e) {
    const dataUrl = e.target.result;
    const base64Index = dataUrl.indexOf(';base64,');
    if (base64Index !== -1) {
      selectedExcelFileBase64 = dataUrl.substring(base64Index + 8);
    } else {
      selectedExcelFileBase64 = dataUrl;
    }
    
    if (btn) {
      btn.disabled = false;
      btn.className = 'flex-1 py-3 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-bold transition-all hover:shadow-lg hover:shadow-brand-500/20 active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer';
    }
  };
  
  reader.onerror = function(err) {
    console.error('Error leyendo archivo:', err);
    if (typeof showToast === 'function') showToast('Error al leer el archivo seleccionado.', 'error');
  };
  
  reader.readAsDataURL(file);
}

export function clearSelectedExcelFile(event) {
  if (event) event.stopPropagation();
  const input = document.getElementById('import-excel-file');
  if (input) {
    input.value = '';
    handleExcelFileSelected({ target: input });
  }
}

export async function triggerImport() {
  const btn = document.getElementById('btn-import-sync');
  const btnRegistrar = document.getElementById('btn-registrar-usuario');
  const progressContainer = document.getElementById('import-progress-container');
  const progressStatus = document.getElementById('import-progress-status');

  if (!btn) return;
  if (!selectedExcelFileBase64) {
    if (typeof showToast === 'function') showToast('Por favor, seleccione primero un archivo Excel.', 'error');
    return;
  }

  const doImport = async () => {
    btn.disabled = true;
    btn.classList.add('glass-input-disabled', 'cursor-not-allowed', 'opacity-60');
    btn.innerHTML = `<span class="w-4 h-4 border-2 border-border-ui border-t-transparent rounded-full animate-spin"></span> <span>Procesando...</span>`;

    if (btnRegistrar) {
      btnRegistrar.disabled = true;
      btnRegistrar.classList.add('glass-input-disabled', 'cursor-not-allowed', 'opacity-60');
    }

    if (progressContainer) {
      progressContainer.classList.remove('hidden');
    }
    if (progressStatus) {
      progressStatus.textContent = 'Procesando archivo masivo en segundo plano...';
    }

    try {
      const res = await fetch('/api/admin/importar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ fileData: selectedExcelFileBase64 })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.stats) {
          const stats = data.stats;
          
          if (stats.sharepoint) {
            if (stats.sharepoint.uploaded) {
              if (typeof showToast === 'function') showToast('✓ Base de datos sincronizada y subida a SharePoint.', 'success');
            } else {
              const isOmit = stats.sharepoint.error && stats.sharepoint.error.startsWith('Omitido');
              if (isOmit) {
                if (typeof showToast === 'function') showToast('⚠️ Base de datos guardada localmente (SharePoint omitido, requiere SSO).', 'warning');
              } else if (!stats.sharepoint.error) {
                if (typeof showToast === 'function') showToast('✓ La base de datos local y remota están sincronizadas.', 'success');
              } else {
                if (typeof showToast === 'function') showToast(`❌ Error al subir a SharePoint: ${stats.sharepoint.error}`, 'error');
              }
            }
          } else {
            if (typeof showToast === 'function') showToast('✓ Base de datos sincronizada localmente.', 'success');
          }
          
          openSyncSummaryModal(stats, 'Sincronización recién completada');
          
          if (typeof fetchAlertas === 'function') fetchAlertas();
          if (typeof fetchSyncHistory === 'function') fetchSyncHistory();
          
          const ds = window.dataStore || {};
          ds.dashboardRawData = [];
          ds.solicitudes = [];
          ds.publicadas = [];
          if (window.dashboardDropdownCache) {
            window.dashboardDropdownCache.nombres = [];
            window.dashboardDropdownCache.cargos = [];
            window.dashboardDropdownCache.sujetosActivosRepresentados = [];
          }
          if (window.currentView === 'administracion' && typeof switchView === 'function') {
            switchView('administracion');
          }
        } else {
          if (typeof showToast === 'function') showToast('La importación finalizó pero no devolvió el formato esperado.', 'error');
        }
      } else {
        let errorText = 'Error al procesar la importación en el servidor.';
        try {
          const err = await res.json();
          if (err && err.error) errorText = err.error;
        } catch (_) {
          console.warn('[sync] Fallback parseando json error importación:', _);
          try {
            const text = await res.text();
            if (text) errorText = text;
          } catch (__) {
            console.warn('[sync] Fallback parseando text error importación:', __);
          }
        }
        if (typeof showToast === 'function') showToast(errorText, 'error');
      }
    } catch (err) {
      console.error('Error gatillando importación:', err);
      if (typeof showToast === 'function') showToast('Error de red al conectar con el servidor para la importación.', 'error');
    } finally {
      selectedExcelFileBase64 = null;
      const fileInput = document.getElementById('import-excel-file');
      if (fileInput) fileInput.value = '';
      
      const label = document.getElementById('excel-file-label');
      const details = document.getElementById('excel-file-details');
      if (label) label.textContent = 'Haz clic para buscar o arrastra aquí tu archivo Excel';
      if (details) details.textContent = 'Solo formato .xlsx (Ley de Lobby)';

      if (btn) {
        btn.disabled = true;
        btn.className = 'flex-1 py-3 bg-border-ui/50 text-text-tertiary rounded-xl text-xs font-bold transition-all cursor-not-allowed flex items-center justify-center gap-2';
        btn.innerHTML = `<i data-lucide="file-up" class="h-4 w-4"></i> <span>Procesar e Importar Excel</span>`;
      }

      if (btnRegistrar) {
        btnRegistrar.disabled = false;
        btnRegistrar.classList.remove('glass-input-disabled', 'cursor-not-allowed', 'opacity-60');
      }

      if (progressContainer) {
        progressContainer.classList.add('hidden');
      }

      if (typeof lucide !== 'undefined') lucide.createIcons();
      if (typeof fetchAndUpdateDbTimestamp === 'function') fetchAndUpdateDbTimestamp();
    }
  };

  if (typeof openConfirmModal === 'function') {
    openConfirmModal(
      'Confirmar Sincronización',
      '¿Está seguro de que desea iniciar la sincronización incremental de la base de datos local? Este proceso actualizará los registros de solicitudes, audiencias y sujetos obligados.',
      doImport
    );
  } else {
    doImport();
  }
}

export async function triggerSharepointSync() {
  const btn = document.getElementById('btn-sharepoint-sync');
  const syncBtn = document.getElementById('btn-import-sync');
  const btnRegistrar = document.getElementById('btn-registrar-usuario');

  if (!btn) return;

  btn.disabled = true;
  btn.classList.add('opacity-60', 'cursor-not-allowed');
  btn.innerHTML = `<i data-lucide="refresh-cw" class="h-4 w-4 animate-spin"></i> <span>Sincronizando...</span>`;
  
  if (syncBtn) syncBtn.disabled = true;
  if (btnRegistrar) btnRegistrar.disabled = true;
  
  if (typeof lucide !== 'undefined') lucide.createIcons();

  try {
    const res = await fetch('/api/admin/sincronizar-desde-sharepoint', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const data = await res.json();
    if (res.ok && data.success) {
      if (typeof showToast === 'function') showToast(data.message, 'success');
      if (data.updated && typeof switchView === 'function' && window.currentView) {
        await switchView(window.currentView);
      }
    } else {
      if (typeof showToast === 'function') showToast(data.error || 'Error al sincronizar con SharePoint.', 'error');
    }
  } catch (err) {
    console.error('Error en sincronización manual:', err);
    if (typeof showToast === 'function') showToast('Error de red al conectar con el servidor para la sincronización.', 'error');
  } finally {
    btn.disabled = false;
    btn.classList.remove('opacity-60', 'cursor-not-allowed');
    btn.innerHTML = `<i data-lucide="refresh-cw" class="h-4 w-4"></i> <span>Sincronizar con SharePoint</span>`;
    
    if (btnRegistrar) btnRegistrar.disabled = false;
    
    if (syncBtn) {
      syncBtn.disabled = !selectedExcelFileBase64;
    }

    if (typeof lucide !== 'undefined') lucide.createIcons();
    if (typeof fetchAndUpdateDbTimestamp === 'function') fetchAndUpdateDbTimestamp();
  }
}

export async function downloadBackup() {
  try {
    if (typeof showToast === 'function') showToast('Generando copia de seguridad...');
    const date = new Date();
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const defaultName = `lobby_backup_${yyyy}${mm}${dd}.db`;
    
    if (window.api && typeof window.api.selectSavePath === 'function') {
      const saveResult = await window.api.selectSavePath({ defaultName });
      if (saveResult.cancelled || !saveResult.filePath) {
        if (typeof showToast === 'function') showToast('Guardado de copia de seguridad cancelado.', 'info');
        return;
      }
      const targetPath = saveResult.filePath;
      const res = await fetch(`/api/admin/backup?filePath=${encodeURIComponent(targetPath)}`);
      const data = await res.json();
      if (data && data.success) {
        if (typeof showToast === 'function') showToast('Copia de seguridad guardada con éxito.', 'success');
      } else {
        if (typeof showToast === 'function') showToast(data.error || 'Error al guardar la copia de seguridad.', 'error');
      }
    } else {
      window.open('/api/admin/backup', '_blank');
    }
  } catch (err) {
    console.error('Error al descargar copia de seguridad:', err);
    if (typeof showToast === 'function') showToast('Error al procesar el respaldo de la base de datos.', 'error');
  }
}

export function openSyncSummaryModal(statsObj, dateStr) {
  const modal = document.getElementById('modal-container');
  if (!modal) return;
  modal.classList.remove('hidden');

  window._activeSyncStats = statsObj;
  window._activeSyncDateStr = dateStr;

  const inserts = (statsObj.sh?.inserts || 0) + (statsObj.ph?.inserts || 0) + (statsObj.sph?.inserts || 0) + (statsObj.vh?.inserts || 0) + (statsObj.dh?.inserts || 0);
  const updates = (statsObj.sh?.updates || 0) + (statsObj.ph?.updates || 0) + (statsObj.sph?.updates || 0) + (statsObj.vh?.updates || 0) + (statsObj.dh?.updates || 0);
  const deletes = (statsObj.sh?.deletes || 0) + (statsObj.ph?.deletes || 0) + (statsObj.sph?.deletes || 0) + (statsObj.vh?.deletes || 0) + (statsObj.dh?.deletes || 0);
  const skipped = (statsObj.sh?.skipped || 0) + (statsObj.ph?.skipped || 0) + (statsObj.sph?.skipped || 0) + (statsObj.vh?.skipped || 0) + (statsObj.dh?.skipped || 0);
  const totalChanges = inserts + updates + deletes;

  let spStatusHtml = '';
  if (statsObj.sharepoint && statsObj.sharepoint.uploaded) {
    spStatusHtml = `
      <div class="flex items-center gap-2.5 p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs font-medium">
        <i data-lucide="cloud-check" class="h-4 w-4 text-emerald-500 shrink-0"></i>
        <span>Base de datos respaldada y sincronizada en SharePoint con éxito.</span>
      </div>
    `;
  } else if (statsObj.sharepoint && statsObj.sharepoint.error && statsObj.sharepoint.error.startsWith('Omitido')) {
    spStatusHtml = `
      <div class="flex items-center gap-2.5 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-xs font-medium">
        <i data-lucide="cloud-off" class="h-4 w-4 text-amber-500 shrink-0"></i>
        <span>Base de datos guardada localmente (subida a SharePoint omitida).</span>
      </div>
    `;
  } else if (statsObj.sharepoint && statsObj.sharepoint.error) {
    spStatusHtml = `
      <div class="flex items-center gap-2.5 p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-400 text-xs font-medium">
        <i data-lucide="alert-triangle" class="h-4 w-4 text-rose-500 shrink-0"></i>
        <span>Guardado localmente. Error SharePoint: ${statsObj.sharepoint.error}</span>
      </div>
    `;
  } else {
    spStatusHtml = `
      <div class="flex items-center gap-2.5 p-3 rounded-2xl bg-border-ui/40 border border-border-ui text-text-secondary text-xs font-medium">
        <i data-lucide="database" class="h-4 w-4 text-brand-500 shrink-0"></i>
        <span>Base de datos local actualizada correctamente.</span>
      </div>
    `;
  }

  modal.innerHTML = `
    <div class="glass-card w-full max-w-lg p-6 rounded-3xl space-y-5 shadow-2xl relative animate-fade-in border border-border-ui flex flex-col overflow-hidden">
      <div class="flex items-start justify-between">
        <div class="flex items-center gap-3">
          <div class="h-11 w-11 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0 border border-emerald-500/20">
            <i data-lucide="check-circle-2" class="h-6 w-6"></i>
          </div>
          <div>
            <h3 class="text-base font-bold text-text-primary">¡Importación Completada!</h3>
            <p class="text-[11px] text-text-tertiary mt-0.5">${dateStr}</p>
          </div>
        </div>
        <button onclick="closeModal()" title="Cerrar modal" aria-label="Cerrar modal" class="text-text-tertiary hover:text-text-primary dark:hover:text-text-primary transition-colors bg-transparent border-none cursor-pointer p-1">
          <i data-lucide="x" class="h-4 w-4"></i>
        </button>
      </div>

      <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div class="bg-bg-main border border-border-ui rounded-2xl p-3 text-center">
          <span class="block text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Creados</span>
          <span class="text-xl font-black text-text-primary mt-0.5 block">+${inserts}</span>
        </div>
        <div class="bg-bg-main border border-border-ui rounded-2xl p-3 text-center">
          <span class="block text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">Modificados</span>
          <span class="text-xl font-black text-text-primary mt-0.5 block">${updates}</span>
        </div>
        <div class="bg-bg-main border border-border-ui rounded-2xl p-3 text-center">
          <span class="block text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">Eliminados</span>
          <span class="text-xl font-black text-text-primary mt-0.5 block">${deletes}</span>
        </div>
        <div class="bg-bg-main border border-border-ui rounded-2xl p-3 text-center">
          <span class="block text-[10px] font-bold uppercase tracking-wider text-text-tertiary">Sin cambio</span>
          <span class="text-xl font-black text-text-primary mt-0.5 block">${skipped.toLocaleString('es-CL')}</span>
        </div>
      </div>

      ${spStatusHtml}

      <div class="flex items-center justify-between gap-3 pt-2 border-t border-border-ui shrink-0">
        ${totalChanges > 0 ? `
          <button onclick="openSyncDetailsModal(window._activeSyncStats, window._activeSyncDateStr, true)" class="px-4 py-2.5 rounded-xl text-xs font-bold border border-border-ui hover:bg-border-ui dark:hover:bg-border-ui/50 text-text-secondary flex items-center gap-2 cursor-pointer transition-all">
            <i data-lucide="eye" class="h-4 w-4 text-brand-500"></i>
            <span>Ver desglose detallado</span>
          </button>
        ` : `<div></div>`}
        <button onclick="closeModal()" class="px-6 py-2.5 rounded-xl text-xs font-bold btn-primary text-white cursor-pointer shadow-lg shadow-brand-500/20">
          Entendido
        </button>
      </div>
    </div>
  `;

  if (typeof lucide !== 'undefined') lucide.createIcons();
}

export function openSyncDetailsModal(statsObj, dateStr, showBackBtn = false) {
  const modal = document.getElementById('modal-container');
  if (!modal) return;
  modal.classList.remove('hidden');

  window._activeSyncStats = statsObj;
  window._activeSyncDateStr = dateStr;

  const inserts = [];
  const updates = [];
  const deletes = [];

  if (statsObj.sh && statsObj.sh.details) {
    statsObj.sh.details.forEach(d => {
      if (d.type === 'insert') inserts.push({ ...d, section: 'Solicitud (SH)' });
      else if (d.type === 'update') updates.push({ ...d, section: 'Solicitud (SH)' });
      else if (d.type === 'delete') deletes.push({ ...d, section: 'Solicitud (SH)' });
    });
  }
  if (statsObj.ph && statsObj.ph.details) {
    statsObj.ph.details.forEach(d => {
      if (d.type === 'insert') inserts.push({ ...d, section: 'Audiencia (PH)' });
      else if (d.type === 'update') updates.push({ ...d, section: 'Audiencia (PH)' });
      else if (d.type === 'delete') deletes.push({ ...d, section: 'Audiencia (PH)' });
    });
  }
  if (statsObj.sph && statsObj.sph.details) {
    statsObj.sph.details.forEach(d => {
      if (d.type === 'insert') inserts.push({ ...d, section: 'Sujeto Pasivo (SPH)' });
      else if (d.type === 'update') updates.push({ ...d, section: 'Sujeto Pasivo (SPH)' });
      else if (d.type === 'delete') deletes.push({ ...d, section: 'Sujeto Pasivo (SPH)' });
    });
  }
  if (statsObj.vh && statsObj.vh.details) {
    statsObj.vh.details.forEach(d => {
      const travelInfo = {
        ...d,
        section: 'Viaje (VH)',
        pasivo: d.sujeto || d.pasivo,
        folio: d.destino ? `Destino: ${d.destino}` : `ID: ${d.id}`,
        cargo: d.cargo || ''
      };
      if (d.type === 'insert') inserts.push(travelInfo);
      else if (d.type === 'update') updates.push(travelInfo);
      else if (d.type === 'delete') deletes.push(travelInfo);
    });
  }
  if (statsObj.dh && statsObj.dh.details) {
    statsObj.dh.details.forEach(d => {
      const donativoInfo = {
        ...d,
        section: 'Donativo (DH)',
        pasivo: d.sujeto || d.pasivo || d.sujetoPasivo,
        folio: d.descripcion ? (d.descripcion.length > 30 ? d.descripcion.substring(0, 30) + '...' : d.descripcion) : `ID: ${d.id}`,
        cargo: d.cargo || ''
      };
      if (d.type === 'insert') inserts.push(donativoInfo);
      else if (d.type === 'update') updates.push(donativoInfo);
      else if (d.type === 'delete') deletes.push(donativoInfo);
    });
  }

  const renderCard = (item, typeCls, icon) => {
    let diffHtml = '';
    if (item.diff && Object.keys(item.diff).length > 0) {
      diffHtml = `
        <div class="mt-2 pt-2 border-t border-border-ui text-[11px] space-y-1">
          <span class="font-bold text-text-tertiary block text-[9px] uppercase tracking-wider">Modificaciones:</span>
          ${Object.keys(item.diff).map(f => `
            <div class="grid grid-cols-3 gap-1 bg-border-ui/30 p-1.5 rounded-lg">
              <span class="font-medium text-text-secondary truncate">${f}:</span>
              <span class="text-rose-600 dark:text-rose-400 line-through truncate">${item.diff[f].old || '(vacío)'}</span>
              <span class="text-emerald-600 dark:text-emerald-400 font-semibold truncate">→ ${item.diff[f].new || '(vacío)'}</span>
            </div>
          `).join('')}
        </div>
      `;
    }

    const searchStr = `${item.folio || ''} ${item.pasivo || ''} ${item.cargo || ''} ${item.activo || ''} ${item.section || ''}`.toLowerCase();

    return `
      <div class="sync-item-card p-3.5 rounded-2xl border border-border-ui bg-bg-main shadow-sm flex flex-col gap-1.5 transition-all text-xs" data-search="${searchStr.replace(/"/g, '&quot;')}">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="h-2 w-2 rounded-full ${typeCls}"></span>
            <span class="font-bold text-text-primary text-[11px]">${item.section}</span>
            <span class="font-mono text-text-secondary text-[10px] bg-border-ui/50 px-1.5 py-0.5 rounded">${item.folio || 'Sin ID'}</span>
          </div>
          <span class="text-[9px] text-text-tertiary flex items-center gap-1 font-semibold uppercase">
            <i data-lucide="${icon}" class="h-3 w-3"></i> ${item.type}
          </span>
        </div>
        
        <div class="space-y-0.5 mt-1 text-[11px]">
          ${item.pasivo ? `<p class="text-text-primary font-medium truncate"><span class="text-text-tertiary">Sujeto:</span> ${item.pasivo} ${item.cargo ? `<span class="text-text-tertiary">(${item.cargo})</span>` : ''}</p>` : ''}
          ${item.activo ? `<p class="text-text-secondary truncate"><span class="text-text-tertiary">Solicitante:</span> ${item.activo}</p>` : ''}
        </div>

        ${diffHtml}
      </div>
    `;
  };

  const defaultTab = inserts.length > 0 ? 'inserts' : (updates.length > 0 ? 'updates' : 'deletes');

  modal.innerHTML = `
    <div class="glass-card w-full max-w-2xl p-6 rounded-3xl space-y-4 shadow-2xl relative animate-fade-in border border-border-ui max-h-[90vh] flex flex-col overflow-hidden">
      <div class="flex items-start justify-between border-b border-border-ui pb-3 shrink-0">
        <div class="flex items-center gap-3">
          <div class="h-10 w-10 rounded-2xl bg-brand-500/10 text-brand-500 flex items-center justify-center shrink-0 border border-brand-500/20">
            <i data-lucide="layers" class="h-5 w-5"></i>
          </div>
          <div>
            <h3 class="text-sm font-bold text-text-primary">Desglose de Auditoría e Impacto</h3>
            <p class="text-[11px] text-text-tertiary mt-0.5">${dateStr}</p>
          </div>
        </div>
        <button onclick="closeModal()" title="Cerrar modal" aria-label="Cerrar modal" class="text-text-tertiary hover:text-text-primary dark:hover:text-text-primary transition-colors bg-transparent border-none cursor-pointer p-1">
          <i data-lucide="x" class="h-4 w-4"></i>
        </button>
      </div>

      <div class="flex items-center justify-between gap-4 border-b border-border-ui shrink-0">
        <div class="flex space-x-2">
          <button onclick="changeSyncDetailTab('inserts')" data-tab="inserts" class="sync-tab-header px-4 py-2 border-b-2 ${defaultTab === 'inserts' ? 'border-brand-500 text-brand-600 dark:text-brand-400 font-bold' : 'border-transparent text-text-tertiary'} text-xs font-bold transition-all bg-transparent cursor-pointer">
            Nuevos (+${inserts.length})
          </button>
          <button onclick="changeSyncDetailTab('updates')" data-tab="updates" class="sync-tab-header px-4 py-2 border-b-2 ${defaultTab === 'updates' ? 'border-brand-500 text-brand-600 dark:text-brand-400 font-bold' : 'border-transparent text-text-tertiary'} text-xs font-bold transition-all bg-transparent cursor-pointer">
            Modificados (${updates.length})
          </button>
          <button onclick="changeSyncDetailTab('deletes')" data-tab="deletes" class="sync-tab-header px-4 py-2 border-b-2 ${defaultTab === 'deletes' ? 'border-brand-500 text-brand-600 dark:text-brand-400 font-bold' : 'border-transparent text-text-tertiary'} text-xs font-bold transition-all bg-transparent cursor-pointer">
            Eliminados (${deletes.length})
          </button>
        </div>

        <div class="relative w-48 mb-1">
          <input type="text" id="sync-detail-search" oninput="filterSyncDetailCards(this.value)" placeholder="Buscar en lista..." class="w-full pl-7 pr-3 py-1 bg-bg-main border border-border-ui rounded-xl text-[11px] text-text-primary focus:outline-none focus:border-brand-500 transition-colors">
          <i data-lucide="search" class="h-3.5 w-3.5 text-text-tertiary absolute left-2 top-2"></i>
        </div>
      </div>

      <div class="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
        <div id="sync-tab-inserts" class="sync-tab-content space-y-2 ${defaultTab === 'inserts' ? '' : 'hidden'}">
          ${inserts.length === 0 ? '<p class="text-xs text-text-tertiary text-center py-8 font-medium">No se detectaron nuevos registros ingresados.</p>' : inserts.map(i => renderCard(i, 'bg-emerald-500', 'plus')).join('')}
        </div>

        <div id="sync-tab-updates" class="sync-tab-content space-y-2 ${defaultTab === 'updates' ? '' : 'hidden'}">
          ${updates.length === 0 ? '<p class="text-xs text-text-tertiary text-center py-8 font-medium">No se registraron modificaciones en registros existentes.</p>' : updates.map(u => renderCard(u, 'bg-amber-500', 'edit-3')).join('')}
        </div>

        <div id="sync-tab-deletes" class="sync-tab-content space-y-2 ${defaultTab === 'deletes' ? '' : 'hidden'}">
          ${deletes.length === 0 ? '<p class="text-xs text-text-tertiary text-center py-8 font-medium">No se removieron registros en esta sincronización.</p>' : deletes.map(d => renderCard(d, 'bg-rose-500', 'trash-2')).join('')}
        </div>
      </div>

      <div class="flex items-center justify-between pt-2 border-t border-border-ui shrink-0">
        ${showBackBtn ? `
          <button onclick="openSyncSummaryModal(window._activeSyncStats, window._activeSyncDateStr)" class="px-4 py-2 rounded-xl text-xs font-bold border border-border-ui hover:bg-border-ui dark:hover:bg-border-ui/50 text-text-secondary flex items-center gap-1.5 cursor-pointer transition-all">
            <i data-lucide="chevron-left" class="h-4 w-4"></i> Volver al Resumen
          </button>
        ` : `<div></div>`}
        <button onclick="closeModal()" class="px-5 py-2 rounded-xl text-xs font-bold btn-primary text-white cursor-pointer shadow-lg shadow-brand-500/20">
          Cerrar
        </button>
      </div>
    </div>
  `;

  if (typeof lucide !== 'undefined') lucide.createIcons();
}

export function changeSyncDetailTab(tabName) {
  document.querySelectorAll('.sync-tab-content').forEach(el => el.classList.add('hidden'));
  const target = document.getElementById(`sync-tab-${tabName}`);
  if (target) target.classList.remove('hidden');
  
  document.querySelectorAll('.sync-tab-header').forEach(el => {
    if (el.getAttribute('data-tab') === tabName) {
      el.className = 'sync-tab-header px-4 py-2 border-b-2 border-brand-500 text-brand-600 dark:text-brand-400 text-xs font-bold transition-all bg-transparent cursor-pointer';
    } else {
      el.className = 'sync-tab-header px-4 py-2 border-b-2 border-transparent text-text-tertiary hover:text-text-primary dark:hover:text-text-primary text-xs font-bold transition-all bg-transparent cursor-pointer';
    }
  });

  const searchInput = document.getElementById('sync-detail-search');
  if (searchInput && searchInput.value) {
    filterSyncDetailCards(searchInput.value);
  }
}

export function filterSyncDetailCards(query) {
  const q = (query || '').toLowerCase().trim();
  const activeContent = document.querySelector('.sync-tab-content:not(.hidden)');
  if (!activeContent) return;
  const cards = activeContent.querySelectorAll('.sync-item-card');
  cards.forEach(card => {
    const text = (card.getAttribute('data-search') || '') + ' ' + card.innerText;
    if (text.toLowerCase().includes(q)) {
      card.classList.remove('hidden');
    } else {
      card.classList.add('hidden');
    }
  });
}

export function viewSyncDetails(id) {
  const dataStore = window.dataStore || {};
  const item = (dataStore.syncHistory || []).find(x => x.id === id);
  if (!item) return;
  
  let dateStr = item.timestamp;
  try {
    const d = new Date(item.timestamp.replace(' ', 'T') + 'Z');
    dateStr = d.toLocaleString('es-CL', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  } catch (err) {
    console.warn('No se pudo formatear timestamp:', err);
  }
  
  try {
    const statsObj = JSON.parse(item.detalles);
    openSyncDetailsModal(statsObj, `Sincronización del ${dateStr}`);
  } catch(e) {
    if (typeof showToast === 'function') showToast('No se pudieron cargar los detalles de este registro.', 'error');
  }
}

export const SyncTab = {
  mount(container) {
    if (container) {
      container.innerHTML = renderSyncTabHtml();
      if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
      }
    }
  },
  unmount() {},
  renderTabHtml: renderSyncTabHtml,
  renderHistoryList,
  showSyncHistoryModal,
  handleExcelFileSelected,
  clearSelectedExcelFile,
  triggerImport,
  triggerSharepointSync,
  downloadBackup,
  openSyncSummaryModal,
  openSyncDetailsModal,
  changeSyncDetailTab,
  filterSyncDetailCards,
  viewSyncDetails
};

if (typeof window !== 'undefined') {
  window.SyncTab = SyncTab;
  window.renderHistoryList = renderHistoryList;
  window.showSyncHistoryModal = showSyncHistoryModal;
  window.renderSyncTabHtml = renderSyncTabHtml;
  window.handleExcelFileSelected = handleExcelFileSelected;
  window.clearSelectedExcelFile = clearSelectedExcelFile;
  window.triggerImport = triggerImport;
  window.triggerSharepointSync = triggerSharepointSync;
  window.downloadBackup = downloadBackup;
  window.openSyncSummaryModal = openSyncSummaryModal;
  window.openSyncDetailsModal = openSyncDetailsModal;
  window.changeSyncDetailTab = changeSyncDetailTab;
  window.filterSyncDetailCards = filterSyncDetailCards;
  window.viewSyncDetails = viewSyncDetails;
}
