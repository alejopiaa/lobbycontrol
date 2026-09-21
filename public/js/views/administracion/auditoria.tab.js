/**
 * AuditoriaTab - Modulo desacoplado de Control de Auditoria Semanal
 */

export function renderAuditoriaTabHtml() {
  const dataStore = window.dataStore || {};
  const currentUser = window.currentUser || null;
  const list = dataStore.auditoria || [];
  let contentHtml = "";
    const sortedAudits = [...list].sort((a, b) =>
      a.fecha.localeCompare(b.fecha),
    );

    const liveVals = dataStore.valoresActuales || {
      ingresada: 0,
      aceptada: 0,
      rechazada: 0,
      suspendida: 0,
      cancelada: 0,
      encomendada: 0,
      publicada: 0,
    };
    const liveTotal =
      liveVals.ingresada +
      liveVals.aceptada +
      liveVals.rechazada +
      liveVals.suspendida +
      liveVals.cancelada +
      liveVals.encomendada;

    const formatVariation = (val, prevVal) => {
      if (prevVal === undefined || prevVal === null || prevVal === 0) return "";
      const diff = val - prevVal;
      const pct = (diff / prevVal) * 100;
      if (pct === 0)
        return `<span class="text-text-tertiary text-[9px] ml-1">0,00%</span>`;
      const sign = pct > 0 ? "+" : "";
      const colorClass =
        pct > 0
          ? "text-emerald-600 dark:text-emerald-400 font-semibold animate-pulse-subtle"
          : "text-rose-600 dark:text-rose-400 font-semibold";
      return `<span class="${colorClass} text-[9px] ml-1">${sign}${pct.toFixed(2).replace(".", ",")}%</span>`;
    };

    // Construcción de la Tabla Semanal (última ingresada primero)
    let weeklyRowsHtml = "";
    if (sortedAudits.length === 0) {
      weeklyRowsHtml = `<tr><td colspan="10" class="px-3 py-8 text-center text-xs text-text-tertiary">No hay registros de auditoría cargados.</td></tr>`;
    } else {
      for (let i = sortedAudits.length - 1; i >= 0; i--) {
        const cur = sortedAudits[i];
        const prev = i > 0 ? sortedAudits[i - 1] : null;

        const curTotal = cur.total || 0;
        const prevTotal = prev ? prev.total || 0 : null;

        const isLatest = i === sortedAudits.length - 1;
        const isEnProceso = cur.estado === "En Proceso";
        const discIngresada =
          isLatest && isEnProceso && cur.ingresada !== liveVals.ingresada;
        const discAceptada =
          isLatest && isEnProceso && cur.aceptada !== liveVals.aceptada;
        const discRechazada =
          isLatest && isEnProceso && cur.rechazada !== liveVals.rechazada;
        const discSuspendida =
          isLatest && isEnProceso && cur.suspendida !== liveVals.suspendida;
        const discCancelada =
          isLatest && isEnProceso && cur.cancelada !== liveVals.cancelada;
        const discEncomendada =
          isLatest && isEnProceso && cur.encomendada !== liveVals.encomendada;
        const discPublicada =
          isLatest && isEnProceso && cur.publicada !== liveVals.publicada;
        const discTotal = isLatest && isEnProceso && curTotal !== liveTotal;

        const hasAnyDiscrepancy =
          discIngresada ||
          discAceptada ||
          discRechazada ||
          discSuspendida ||
          discCancelada ||
          discEncomendada ||
          discPublicada ||
          discTotal;

        let warningBadge = "";
        if (cur.estado === "Cerrado") {
          warningBadge = `
            <span class="px-1.5 py-0.5 rounded text-[8px] font-bold badge-status-enplazo flex items-center gap-1 inline-flex shrink-0 select-none cursor-default">
              <i data-lucide="shield-check" class="h-2.5 w-2.5 shrink-0"></i> Validado
            </span>
          `;
        } else {
          warningBadge = `
            <div class="flex flex-col items-end gap-1 shrink-0">
              <span class="px-1.5 py-0.5 rounded text-[8px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1 inline-flex shrink-0 select-none cursor-default">
                <i data-lucide="clock" class="h-2.5 w-2.5 shrink-0 animate-pulse"></i> En Proceso
              </span>
              ${
                hasAnyDiscrepancy
                  ? `
              <span class="px-1.5 py-0.5 rounded text-[8px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center gap-1 inline-flex shrink-0 select-none cursor-default" title="Discrepancia detectada con la base de datos actual.">
                <i data-lucide="alert-circle" class="h-2.5 w-2.5 shrink-0"></i> Discrepancia
              </span>
              `
                  : ""
              }
            </div>
          `;
        }

        const formatCell = (val, prevVal, isDisc, liveVal) => {
          const formattedVal = val.toLocaleString("es-CL");
          const variation =
            prevVal !== null ? formatVariation(val, prevVal) : "";
          const discClass = isDisc
            ? "bg-rose-500/20 text-rose-300 font-bold border border-rose-500/30 rounded px-1.5 py-0.5"
            : "";
          const titleText = isDisc
            ? `title="Cifra en Sistema: ${liveVal.toLocaleString("es-CL")} (Discrepancia: ${val - liveVal})"`
            : "";
          return `<div class="flex flex-col items-start gap-0.5">
            <span class="${discClass} inline-block" ${titleText}>${formattedVal}</span>
            ${variation}
          </div>`;
        };

        // Formatear fecha DD-MM-YYYY
        let dateStr = cur.fecha;
        try {
          const parts = cur.fecha.split(" ");
          if (parts[0]) {
            const dateParts = parts[0].split("-");
            if (dateParts.length === 3) {
              dateStr = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}${parts[1] ? " " + parts[1] : ""}`;
            }
          }
        } catch (err) {
          console.warn('[auditoria] Error formateando fecha de auditoría:', err);
          dateStr = cur.fecha || '';
        }

        const cerrarBtnHtml =
          isEnProceso && isLatest
            ? `<button onclick="closeAuditoriaRecord(${cur.id})" class="p-1.5 rounded-lg text-text-tertiary hover:text-brand-500 hover:bg-brand-500/10 dark:hover:bg-brand-500/20 transition-all shrink-0" title="Cerrar y Validar Control Semanal">
               <i data-lucide="check-square" class="h-3.5 w-3.5"></i>
             </button>`
            : `<div class="w-[26px] h-[26px] shrink-0"></div>`;

        weeklyRowsHtml += `
          <tr class="hover:bg-border-ui border-b border-border-ui transition-colors h-[64px]">
            <td class="pl-6 pr-2 text-xs font-semibold text-text-primary font-mono">
              <div class="flex flex-col">
                <span class="text-text-secondary font-semibold text-[11px]">${dateStr}</span>
                <span class="text-[9px] text-text-tertiary font-medium">${cur.usuario || "Sistema"}</span>
              </div>
            </td>
            <td class="px-2 text-xs font-semibold text-text-primary">${formatCell(curTotal, prevTotal, discTotal, liveTotal)}</td>
            <td class="px-2 text-xs text-text-secondary">${formatCell(cur.ingresada, prev ? prev.ingresada : null, discIngresada, liveVals.ingresada)}</td>
            <td class="px-2 text-xs text-text-secondary">${formatCell(cur.aceptada, prev ? prev.aceptada : null, discAceptada, liveVals.aceptada)}</td>
            <td class="px-2 text-xs text-text-secondary">${formatCell(cur.rechazada, prev ? prev.rechazada : null, discRechazada, liveVals.rechazada)}</td>
            <td class="px-2 text-xs text-text-secondary">${formatCell(cur.suspendida, prev ? prev.suspendida : null, discSuspendida, liveVals.suspendida)}</td>
            <td class="px-2 text-xs text-text-secondary">${formatCell(cur.cancelada, prev ? prev.cancelada : null, discCancelada, liveVals.cancelada)}</td>
            <td class="px-2 text-xs text-text-secondary">${formatCell(cur.encomendada, prev ? prev.encomendada : null, discEncomendada, liveVals.encomendada)}</td>
            <td class="px-2 text-xs text-text-secondary">${formatCell(cur.publicada, prev ? prev.publicada : null, discPublicada, liveVals.publicada)}</td>
            <td class="pl-2 pr-6 text-right whitespace-nowrap">
              <div class="flex items-center justify-end gap-1">
                <div class="flex items-center gap-1 mr-2">${warningBadge}</div>
                ${cerrarBtnHtml}
                <button onclick="openAuditoriaModal(${cur.id})" class="p-1.5 rounded-lg text-text-tertiary hover:text-brand-400 hover:bg-brand-500/10 dark:hover:bg-brand-500/20 transition-all" title="Editar">
                  <i data-lucide="edit-2" class="h-3.5 w-3.5"></i>
                </button>
                <button onclick="deleteAuditoria(${cur.id})" class="p-1.5 rounded-lg text-text-tertiary hover:text-rose-500 hover:bg-rose-500/10 dark:hover:bg-rose-500/20 transition-all" title="Eliminar">
                  <i data-lucide="trash-2" class="h-3.5 w-3.5"></i>
                </button>
              </div>
            </td>
          </tr>
        `;
      }
    }

    // Construcción de la Tabla Mensual (Cierres de mes)
    const monthlyGroups = {};
    sortedAudits.forEach((aud) => {
      const yyyymm = aud.fecha.slice(0, 7); // e.g. "2026-06"
      monthlyGroups[yyyymm] = aud; // Sobrescribe con el último registro cronológico del mes
    });

    const monthlyKeys = Object.keys(monthlyGroups).sort();
    let monthlyRowsHtml = "";
    if (monthlyKeys.length === 0) {
      monthlyRowsHtml = `<tr><td colspan="10" class="px-3 py-8 text-center text-xs text-text-tertiary">No hay datos de auditoría mensual disponibles.</td></tr>`;
    } else {
      for (let i = monthlyKeys.length - 1; i >= 0; i--) {
        const key = monthlyKeys[i];
        const cur = monthlyGroups[key];
        const prevKey = i > 0 ? monthlyKeys[i - 1] : null;
        const prev = prevKey ? monthlyGroups[prevKey] : null;

        const curTotal = cur.total || 0;
        const prevTotal = prev ? prev.total || 0 : null;

        let monthName = key;
        try {
          const parts = key.split("-");
          const yearShort = parts[0].slice(2);
          const months = [
            "ene",
            "feb",
            "mar",
            "abr",
            "may",
            "jun",
            "jul",
            "ago",
            "sep",
            "oct",
            "nov",
            "dic",
          ];
          const monthIndex = parseInt(parts[1], 10) - 1;
          monthName = `${months[monthIndex]}-${yearShort}`;
        } catch (err) {
          console.warn('[auditoria] Error formateando mes:', err);
          monthName = key;
        }

        const formatMonthlyCell = (val, prevVal) => {
          const formattedVal = val.toLocaleString("es-CL");
          const variation =
            prevVal !== null ? formatVariation(val, prevVal) : "";
          return `<div class="flex flex-col items-start gap-0.5">
            <span>${formattedVal}</span>
            ${variation}
          </div>`;
        };

        monthlyRowsHtml += `
          <tr class="hover:bg-border-ui border-b border-border-ui transition-colors h-[56px]">
            <td class="pl-6 pr-2 text-xs font-bold text-text-secondary uppercase">${monthName}</td>
            <td class="px-2 text-xs font-semibold text-text-primary">${formatMonthlyCell(curTotal, prevTotal)}</td>
            <td class="px-2 text-xs text-text-secondary">${formatMonthlyCell(cur.ingresada, prev ? prev.ingresada : null)}</td>
            <td class="px-2 text-xs text-text-secondary">${formatMonthlyCell(cur.aceptada, prev ? prev.aceptada : null)}</td>
            <td class="px-2 text-xs text-text-secondary">${formatMonthlyCell(cur.rechazada, prev ? prev.rechazada : null)}</td>
            <td class="px-2 text-xs text-text-secondary">${formatMonthlyCell(cur.suspendida, prev ? prev.suspendida : null)}</td>
            <td class="px-2 text-xs text-text-secondary">${formatMonthlyCell(cur.cancelada, prev ? prev.cancelada : null)}</td>
            <td class="px-2 text-xs text-text-secondary">${formatMonthlyCell(cur.encomendada, prev ? prev.encomendada : null)}</td>
            <td class="px-2 text-xs text-text-secondary">${formatMonthlyCell(cur.publicada, prev ? prev.publicada : null)}</td>
            <td class="pl-2 pr-6"></td>
          </tr>
        `;
      }
    }

    contentHtml = `
      <div class="space-y-6 mt-6 animate-fade-in">
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div class="space-y-1">
            <h3 class="text-sm font-bold text-text-primary flex items-center gap-2">
              <i data-lucide="clipboard-check" class="h-4 w-4 text-brand-400"></i>
              Control de Auditoría Semanal
            </h3>
            <p class="text-xs text-text-tertiary">Auditoría manual.</p>
          </div>
          <button id="btn-registrar-auditoria" onclick="openAuditoriaModal()" class="px-4 py-2.5 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2 transition-all hover:shadow-lg hover:shadow-brand-500/20 shrink-0">
            <i data-lucide="plus" class="h-4 w-4"></i> Registrar Control Semanal
          </button>
        </div>

        <!-- TABLA PROGRESIÓN MENSUAL -->
        <div class="space-y-2">
          <span class="text-[10px] font-bold text-brand-400 uppercase tracking-wider block">Tabla Superior: Progresión Mensual (Estados de Solicitud)</span>
          <div class="rounded-2xl overflow-hidden border border-border-ui glass-card">
            <div class="overflow-x-auto">
              <table class="w-full text-left border-collapse table-fixed">
                <thead>
                  <tr class="bg-border-ui/50 border-b border-border-ui text-text-tertiary text-[9px] uppercase font-bold tracking-widest">
                    <th class="pl-6 pr-2 py-3 w-32 text-left">Mes</th>
                    <th class="px-2 py-3 w-28 text-left">Total Mensual</th>
                    <th class="px-2 py-3 w-24 text-left">Ingresada</th>
                    <th class="px-2 py-3 w-24 text-left">Aceptada</th>
                    <th class="px-2 py-3 w-24 text-left">Rechazada</th>
                    <th class="px-2 py-3 w-24 text-left">Suspendida</th>
                    <th class="px-2 py-3 w-24 text-left">Cancelada</th>
                    <th class="px-2 py-3 w-28 text-left">Encomendada</th>
                    <th class="px-2 py-3 w-24 text-left">Publicada</th>
                    <th class="pl-2 pr-6 py-3 w-16"></th>
                  </tr>
                </thead>
                <tbody>
                  ${monthlyRowsHtml}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- TABLA CONTROL SEMANAL -->
        <div class="space-y-2">
          <span class="text-[10px] font-bold text-brand-400 uppercase tracking-wider block">Tabla Inferior: Registro Histórico Semanal (Control Físico)</span>
          <div class="rounded-2xl overflow-hidden border border-border-ui glass-card">
            <div class="overflow-x-auto">
              <table class="w-full text-left border-collapse table-fixed">
                <thead>
                  <tr class="bg-border-ui/50 border-b border-border-ui text-text-tertiary text-[9px] uppercase font-bold tracking-widest">
                    <th class="pl-6 pr-2 py-3 w-40 text-left">Fecha de Control</th>
                    <th class="px-2 py-3 w-28 text-left">Total</th>
                    <th class="px-2 py-3 w-24 text-left">Ingresada</th>
                    <th class="px-2 py-3 w-24 text-left">Aceptada</th>
                    <th class="px-2 py-3 w-24 text-left">Rechazada</th>
                    <th class="px-2 py-3 w-24 text-left">Suspendida</th>
                    <th class="px-2 py-3 w-24 text-left">Cancelada</th>
                    <th class="px-2 py-3 w-28 text-left">Encomendada</th>
                    <th class="px-2 py-3 w-24 text-left">Publicada</th>
                    <th class="pl-2 pr-6 py-3 w-48 text-right">Validación / Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  ${weeklyRowsHtml}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    `;

  return contentHtml;
}

export async function openAuditoriaModal(id = null) {
  const modal = document.getElementById('modal-container');
  if (!modal) return;
  modal.classList.remove('hidden');

  const dataStore = window.dataStore || {};
  const isEdit = id !== null;
  let rec = { fecha: '', total: '', ingresada: '', aceptada: '', rechazada: '', suspendida: '', cancelada: '', encomendada: '', publicada: '', estado: 'En Proceso' };
  if (isEdit && Array.isArray(dataStore.auditoria)) {
    rec = dataStore.auditoria.find(a => a.id === id) || rec;
  } else {
    const now = new Date();
    const offset = now.getTimezoneOffset();
    const localNow = new Date(now.getTime() - (offset * 60 * 1000));
    rec.fecha = localNow.toISOString().slice(0, 16).replace('T', ' ');
  }

  const isEnProceso = !isEdit || rec.estado === 'En Proceso';
  window.activeAuditIsEnProceso = isEnProceso;

  modal.innerHTML = `
    <div class="glass-card w-full max-w-lg p-6 rounded-2xl space-y-6 shadow-2xl relative">
      <div>
        <h3 class="text-lg font-bold text-heading">${isEdit ? 'Editar Registro de Auditoría' : 'Nuevo Registro de Auditoría'}</h3>
        <p class="text-xs text-body-muted">Fecha y Hora de Auditoría: <span class="font-mono text-brand-400 font-bold">${rec.fecha}</span></p>
        <p class="text-[11px] text-body-muted mt-1.5">Ingresa los valores validados manualmente para el control semanal. El total de solicitudes ingresado debe coincidir exactamente con la suma de los estados (Ingresada a Encomendada).</p>
      </div>

      <form id="auditoria-form" onsubmit="saveAuditoria(event, ${id})" class="space-y-4">
        <input type="hidden" id="aud-fecha" value="${rec.fecha}">

        <div class="grid grid-cols-2 gap-4">
          ${[
            { key: 'total', id: 'aud-total', label: 'Total Solicitudes', isTotal: true },
            { key: 'ingresada', id: 'aud-ingresada', label: 'Ingresada' },
            { key: 'aceptada', id: 'aud-aceptada', label: 'Aceptada' },
            { key: 'rechazada', id: 'aud-rechazada', label: 'Rechazada' },
            { key: 'suspendida', id: 'aud-suspendida', label: 'Suspendida' },
            { key: 'cancelada', id: 'aud-cancelada', label: 'Cancelada' },
            { key: 'encomendada', id: 'aud-encomendada', label: 'Encomendada' },
            { key: 'publicada', id: 'aud-publicada', label: 'Publicada' }
          ].map(f => {
            const isTotal = f.key === 'total';
            const val = rec[f.key] !== undefined && rec[f.key] !== null ? rec[f.key] : '';
            return `
              <div class="space-y-1">
                <div class="flex justify-between items-center">
                  <label for="${f.id}" class="text-[10px] font-bold text-body-muted uppercase">${f.label}</label>
                  <span id="sys-val-${f.key}" class="text-[9px] text-text-tertiary font-semibold ${isEnProceso ? '' : 'hidden'}">Cargando...</span>
                </div>
                <input type="number" id="${f.id}" aria-label="${escapeHtmlAttr(f.label)}" value="${val !== '' ? val : ''}" required min="0" oninput="validateAuditForm(); compareFieldDiscrepancy('${f.key}')" class="w-full px-3 py-2 rounded-xl text-xs glass-input text-text-secondary placeholder:text-text-tertiary ${isTotal ? 'font-bold border-brand-500/30' : ''}">
                <div id="discrepancy-info-${f.key}" class="text-[9px] font-bold hidden mt-0.5"></div>
              </div>
            `;
          }).join('')}
        </div>

        <div id="validation-warning" class="hidden p-3 rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-400 text-xs font-semibold flex items-center gap-2">
          <i data-lucide="alert-triangle" class="h-4 w-4 shrink-0"></i>
          <span>La suma de los estados (Ingresada a Encomendada) no coincide con el Total de solicitudes ingresado.</span>
        </div>

        <div class="flex justify-end gap-3 pt-2">
          <button type="button" onclick="closeModal()" class="px-4 py-2 rounded-xl text-xs font-semibold btn-secondary">Cancelar</button>
          <button type="submit" class="px-4 py-2 rounded-xl text-xs font-semibold btn-primary">${isEdit ? 'Actualizar Registro' : 'Registrar Auditoría'}</button>
        </div>
      </form>
    </div>
  `;
  if (typeof lucide !== 'undefined') lucide.createIcons();
  validateAuditForm();

  if (isEnProceso) {
    try {
      const res = await fetch('/api/admin/auditoria/valores-actuales');
      if (res.ok) {
        const sysVals = await res.json();
        window.currentSystemValues = sysVals;
        Object.keys(sysVals).forEach(key => {
          const labelEl = document.getElementById(`sys-val-${key}`);
          if (labelEl) {
            labelEl.textContent = `Sistema: ${sysVals[key].toLocaleString('es-CL')}`;
          }
          compareFieldDiscrepancy(key);
        });

        const liveTotal = (sysVals.ingresada || 0) +
                          (sysVals.aceptada || 0) +
                          (sysVals.rechazada || 0) +
                          (sysVals.suspendida || 0) +
                          (sysVals.cancelada || 0) +
                          (sysVals.encomendada || 0);
        const totalLabelEl = document.getElementById(`sys-val-total`);
        if (totalLabelEl) {
          totalLabelEl.textContent = `Sistema: ${liveTotal.toLocaleString('es-CL')}`;
        }
        compareFieldDiscrepancy('total');
      }
    } catch(e) {
      console.error('Error fetching system values:', e);
    }
  }
}

export function validateAuditForm() {
  const totalInput = document.getElementById('aud-total');
  const ingresadaEl = document.getElementById('aud-ingresada');
  const aceptadaEl = document.getElementById('aud-aceptada');
  const rechazadaEl = document.getElementById('aud-rechazada');
  const suspendidaEl = document.getElementById('aud-suspendida');
  const canceladaEl = document.getElementById('aud-cancelada');
  const encomendadaEl = document.getElementById('aud-encomendada');

  if (!totalInput || !ingresadaEl || !aceptadaEl || !rechazadaEl || !suspendidaEl || !canceladaEl || !encomendadaEl) return;

  const total = parseInt(totalInput.value, 10);
  const ingresada = parseInt(ingresadaEl.value || 0, 10);
  const aceptada = parseInt(aceptadaEl.value || 0, 10);
  const rechazada = parseInt(rechazadaEl.value || 0, 10);
  const suspendida = parseInt(suspendidaEl.value || 0, 10);
  const cancelada = parseInt(canceladaEl.value || 0, 10);
  const encomendada = parseInt(encomendadaEl.value || 0, 10);

  const sumStates = ingresada + aceptada + rechazada + suspendida + cancelada + encomendada;

  const warningEl = document.getElementById('validation-warning');
  const submitBtn = document.querySelector('#auditoria-form button[type="submit"]');

  if (isNaN(total) || total !== sumStates) {
    if (warningEl) warningEl.classList.remove('hidden');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.classList.add('opacity-50', 'cursor-not-allowed');
    }
  } else {
    if (warningEl) warningEl.classList.add('hidden');
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.classList.remove('opacity-50', 'cursor-not-allowed');
    }
  }
}

export function compareFieldDiscrepancy(key) {
  if (!window.activeAuditIsEnProceso) return;
  const inputEl = document.getElementById(`aud-${key}`);
  const infoEl = document.getElementById(`discrepancy-info-${key}`);
  if (!inputEl || !infoEl || !window.currentSystemValues) return;

  const enteredVal = parseInt(inputEl.value, 10);
  
  let sysVal = 0;
  if (key === 'total') {
    sysVal = (window.currentSystemValues.ingresada || 0) +
             (window.currentSystemValues.aceptada || 0) +
             (window.currentSystemValues.rechazada || 0) +
             (window.currentSystemValues.suspendida || 0) +
             (window.currentSystemValues.cancelada || 0) +
             (window.currentSystemValues.encomendada || 0);
  } else {
    sysVal = window.currentSystemValues[key] || 0;
  }

  if (isNaN(enteredVal)) {
    infoEl.classList.add('hidden');
    inputEl.classList.remove('border-rose-500', 'bg-rose-950/10', 'border-emerald-500', 'bg-emerald-950/10');
    return;
  }

  const diff = enteredVal - sysVal;
  if (diff === 0) {
    infoEl.textContent = 'Coincide con el sistema';
    infoEl.className = 'text-[9px] font-bold text-emerald-400 mt-0.5';
    infoEl.classList.remove('hidden');
    inputEl.classList.remove('border-rose-500', 'bg-rose-950/10');
    inputEl.classList.add('border-emerald-500', 'bg-emerald-950/10');
  } else {
    const sign = diff > 0 ? '+' : '';
    infoEl.textContent = `Discrepancia: ${sign}${diff}`;
    infoEl.className = 'text-[9px] font-bold text-rose-400 mt-0.5';
    infoEl.classList.remove('hidden');
    inputEl.classList.remove('border-emerald-500', 'bg-emerald-950/10');
    inputEl.classList.add('border-rose-500', 'bg-rose-950/10');
  }
}

export async function saveAuditoria(event, id) {
  event.preventDefault();
  const fecha = document.getElementById('aud-fecha').value;
  const total = parseInt(document.getElementById('aud-total').value, 10);
  const ingresada = parseInt(document.getElementById('aud-ingresada').value, 10);
  const aceptada = parseInt(document.getElementById('aud-aceptada').value, 10);
  const rechazada = parseInt(document.getElementById('aud-rechazada').value, 10);
  const suspendida = parseInt(document.getElementById('aud-suspendida').value, 10);
  const cancelada = parseInt(document.getElementById('aud-cancelada').value, 10);
  const encomendada = parseInt(document.getElementById('aud-encomendada').value, 10);
  const publicada = parseInt(document.getElementById('aud-publicada').value, 10);

  const isEdit = id !== null;
  const url = isEdit ? `/api/admin/auditoria/${id}` : '/api/admin/auditoria';
  const method = isEdit ? 'PUT' : 'POST';

  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fecha, total, ingresada, aceptada, rechazada, suspendida, cancelada, encomendada, publicada })
    });

    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.error || 'Error al guardar la auditoría.');
    }

    if (typeof showToast === 'function') showToast(isEdit ? 'Registro de auditoría actualizado.' : 'Registro de auditoría guardado.');
    if (typeof closeModal === 'function') closeModal();
    if (typeof switchView === 'function') await switchView('administracion');
  } catch (err) {
    if (typeof showToast === 'function') showToast(err.message, 'error');
  }
}

export function deleteAuditoria(id) {
  if (typeof openConfirmModal === 'function') {
    openConfirmModal(
      'Eliminar Auditoría',
      '¿Está seguro de que desea eliminar este registro de auditoría?',
      async () => {
        try {
          const res = await fetch(`/api/admin/auditoria/${id}`, { method: 'DELETE' });
          if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Error al eliminar.');
          }
          if (typeof showToast === 'function') showToast('Registro de auditoría eliminado.');
          if (typeof switchView === 'function') await switchView('administracion');
        } catch (err) {
          if (typeof showToast === 'function') showToast(err.message, 'error');
        }
      }
    );
  }
}

export function closeAuditoriaRecord(id) {
  if (typeof openConfirmModal === 'function') {
    openConfirmModal(
      'Validar y Cerrar Control',
      '¿Está seguro de que desea cerrar este control de auditoría? Una vez cerrado, las cifras quedarán congeladas y no se mostrarán más alertas de discrepancia.',
      async () => {
        try {
          const dataStore = window.dataStore || {};
          const record = (dataStore.auditoria || []).find(a => a.id === id);
          if (!record) return;
          const res = await fetch(`/api/admin/auditoria/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fecha: record.fecha,
              total: record.total,
              ingresada: record.ingresada,
              aceptada: record.aceptada,
              rechazada: record.rechazada,
              suspendida: record.suspendida,
              cancelada: record.cancelada,
              encomendada: record.encomendada,
              publicada: record.publicada,
              estado: 'Cerrado'
            })
          });
          if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Error al cerrar el registro.');
          }
          if (typeof showToast === 'function') showToast('Control de auditoría cerrado y validado.');
          if (typeof switchView === 'function') await switchView('administracion');
        } catch (err) {
          if (typeof showToast === 'function') showToast(err.message, 'error');
        }
      }
    );
  }
}

export const AuditoriaTab = {
  mount(container) {
    if (container) {
      container.innerHTML = renderAuditoriaTabHtml();
      if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
      }
    }
  },
  unmount() {},
  renderTabHtml: renderAuditoriaTabHtml,
  openAuditoriaModal,
  validateAuditForm,
  compareFieldDiscrepancy,
  saveAuditoria,
  deleteAuditoria,
  closeAuditoriaRecord
};

if (typeof window !== 'undefined') {
  window.AuditoriaTab = AuditoriaTab;
  window.renderAuditoriaTabHtml = renderAuditoriaTabHtml;
  window.openAuditoriaModal = openAuditoriaModal;
  window.validateAuditForm = validateAuditForm;
  window.compareFieldDiscrepancy = compareFieldDiscrepancy;
  window.saveAuditoria = saveAuditoria;
  window.deleteAuditoria = deleteAuditoria;
  window.closeAuditoriaRecord = closeAuditoriaRecord;
}
