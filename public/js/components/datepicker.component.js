/**
 * datepicker.component.js - Inicialización y sincronización cruzada de Air-Datepicker
 * Desacoplado de app.js para arquitectura modular ESM.
 */

/**
 * Inicializa los selectores de fecha AirDatepicker en los campos correspondientes.
 */
function initAirDatepickerFields() {
  if (typeof AirDatepicker === 'undefined') {
    console.error('[DatePicker] AirDatepicker no está definido en el ámbito global.');
    return;
  }

  const locale = (typeof window.AirDatepickerLocaleEs !== 'undefined')
    ? window.AirDatepickerLocaleEs
    : undefined;

  const inputs = document.querySelectorAll('.datepicker-display-input, .flatpickr-display-input');

  inputs.forEach(displayInput => {
    try {
      const hiddenInputId = displayInput.getAttribute('data-date-target');
      const hiddenInput = hiddenInputId ? document.getElementById(hiddenInputId) : null;

      // 1. Obtener límites min y max desde el input oculto
      let minDate = undefined;
      let maxDate = undefined;
      if (hiddenInput) {
        const minVal = hiddenInput.getAttribute('min');
        if (minVal) {
          const parts = minVal.split('-').map(Number);
          if (parts.length === 3 && !parts.some(isNaN)) {
            minDate = new Date(parts[0], parts[1] - 1, parts[2]);
          }
        }
        const maxVal = hiddenInput.getAttribute('max');
        if (maxVal) {
          const parts = maxVal.split('-').map(Number);
          if (parts.length === 3 && !parts.some(isNaN)) {
            maxDate = new Date(parts[0], parts[1] - 1, parts[2]);
          }
        }
      }

      // 2. Si ya tiene una instancia activa de AirDatepicker, actualizamos sus límites dinámicos sin duplicar
      if (displayInput._airDatepicker) {
        const dp = displayInput._airDatepicker;
        dp.update({
          minDate: minDate,
          maxDate: maxDate
        });
        return;
      }

      // 3. Crear opciones base del calendario
      const adpOptions = {
        dateFormat: 'dd/MM/yyyy',
        autoClose: true,
        isMobile: false,
        position: 'bottom left',
        navTitles: {
          days: 'MMMM yyyy',   // Click abre selector de meses
          months: 'yyyy',      // Click abre selector de años
          years: 'yyyy1 - yyyy2'
        },
        buttons: [
          {
            content: 'Hoy',
            className: 'adp-btn-today',
            onClick: (dp) => {
              dp.selectDate(new Date());
              dp.hide();
            }
          },
          {
            content: 'Limpiar',
            className: 'adp-btn-clear',
            onClick: (dp) => {
              dp.clear();
              if (hiddenInput && hiddenInput.value !== '') {
                hiddenInput.value = '';
                if (typeof syncAllLinkedDatepickers === 'function') {
                  syncAllLinkedDatepickers();
                }
                hiddenInput.dispatchEvent(new Event('change', { bubbles: true }));
              }
              dp.hide();
            }
          }
        ],
        onSelect: ({ date, formattedDate }) => {
          if (!hiddenInput) return;
          if (date) {
            const d = Array.isArray(date) ? date[0] : date;
            const yyyy = d.getFullYear();
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            const newVal = `${yyyy}-${mm}-${dd}`;
            
            // Solo si el valor realmente cambió disparamos el cambio (evita bucles infinitos en re-render)
            if (hiddenInput.value !== newVal) {
              hiddenInput.value = newVal;
              displayInput.value = formattedDate || `${dd.toString().padStart(2,'0')}/${mm}/${yyyy}`;
              syncAllLinkedDatepickers();
              hiddenInput.dispatchEvent(new Event('change', { bubbles: true }));
            }
          } else {
            if (hiddenInput.value !== '') {
              hiddenInput.value = '';
              displayInput.value = '';
              syncAllLinkedDatepickers();
              hiddenInput.dispatchEvent(new Event('change', { bubbles: true }));
            }
          }
        }
      };

      if (locale) adpOptions.locale = locale;
      if (minDate) adpOptions.minDate = minDate;
      if (maxDate) adpOptions.maxDate = maxDate;

      // Pre-seleccionar fecha parseando a Date local
      if (hiddenInput && hiddenInput.value && hiddenInput.value.length === 10) {
        const parts = hiddenInput.value.split('-').map(Number);
        if (parts.length === 3 && !parts.some(isNaN)) {
          adpOptions.selectedDates = [new Date(parts[0], parts[1] - 1, parts[2])];
          // Forzar que el display text muestre la fecha seleccionada al inicializar
          const dd = String(parts[2]).padStart(2, '0');
          const mm = String(parts[1]).padStart(2, '0');
          displayInput.value = `${dd}/${mm}/${parts[0]}`;
        }
      }

      const dp = new AirDatepicker(displayInput, adpOptions);
      displayInput._airDatepicker = dp;

      // Evento click al input display para asegurar que abra el calendario
      displayInput.addEventListener('click', (e) => {
        e.stopPropagation();
        dp.show();
      });

      // Botón del ícono de calendario: toggle del picker
      const triggerBtn = displayInput.parentElement
        ? displayInput.parentElement.querySelector(`[data-datepicker-trigger="${hiddenInputId}"], [data-flatpickr-trigger="${hiddenInputId}"]`)
        : null;
      if (triggerBtn) {
        const newBtn = triggerBtn.cloneNode(true);
        triggerBtn.parentNode.replaceChild(newBtn, triggerBtn);
        newBtn.addEventListener('click', (e) => { e.stopPropagation(); dp.show(); });
      }
    } catch (e) {
      console.error(`[DatePicker] Error al inicializar para el elemento:`, displayInput, e);
    }
  });

  // 4. Sincronizar dinámicamente los límites cruzados (minDate / maxDate) entre pares de fecha
  syncAllLinkedDatepickers();
}

/**
 * Sincroniza dinámicamente los límites minDate y maxDate entre un selector de Fecha Inicio y Fecha Término.
 * Deshabilita en tiempo real las fechas inválidas en el calendario compañero sin destruir ni re-renderizar los inputs.
 * @param {string|number} startId - Parámetro startId.
 * @param {string|number} endId - Parámetro endId.
 */
function syncLinkedDatepickers(startId, endId) {
  const startHidden = document.getElementById(startId);
  const endHidden = document.getElementById(endId);
  const startDisplay = document.getElementById(`${startId}-display`);
  const endDisplay = document.getElementById(`${endId}-display`);

  if (!startDisplay || !endDisplay) return;

  const dpStart = startDisplay._airDatepicker;
  const dpEnd = endDisplay._airDatepicker;

  let startDate = undefined;
  if (startHidden && startHidden.value && startHidden.value.length === 10) {
    const parts = startHidden.value.split('-').map(Number);
    if (parts.length === 3 && !parts.some(isNaN)) {
      startDate = new Date(parts[0], parts[1] - 1, parts[2]);
    }
  }

  let endDate = undefined;
  if (endHidden && endHidden.value && endHidden.value.length === 10) {
    const parts = endHidden.value.split('-').map(Number);
    if (parts.length === 3 && !parts.some(isNaN)) {
      endDate = new Date(parts[0], parts[1] - 1, parts[2]);
    }
  }

  const minValStart = startHidden ? startHidden.getAttribute('min') : null;
  const minDateBase = minValStart ? new Date(minValStart.split('-')[0], minValStart.split('-')[1] - 1, minValStart.split('-')[2]) : undefined;
  
  const maxValEnd = endHidden ? endHidden.getAttribute('max') : null;
  const maxDateBase = maxValEnd ? new Date(maxValEnd.split('-')[0], maxValEnd.split('-')[1] - 1, maxValEnd.split('-')[2]) : undefined;

  if (dpStart) {
    dpStart.update({
      minDate: minDateBase,
      maxDate: endDate || maxDateBase
    });
  }
  if (dpEnd) {
    dpEnd.update({
      minDate: startDate || minDateBase,
      maxDate: maxDateBase
    });
  }
}

/**
 * Aplica la sincronización cruzada a todos los módulos con rangos de fecha activos.
 */
function syncAllLinkedDatepickers() {
  syncLinkedDatepickers('dashboard-filter-fechainicio', 'dashboard-filter-fechatermino');
  syncLinkedDatepickers('solicitudes-filter-fechainicio', 'solicitudes-filter-fechatermino');
  syncLinkedDatepickers('publicadas-filter-fechainicio', 'publicadas-filter-fechatermino');
  syncLinkedDatepickers('viajes-filter-fechainicio', 'viajes-filter-fechatermino');
  syncLinkedDatepickers('donativos-filter-fechainicio', 'donativos-filter-fechatermino');
  syncLinkedDatepickers('report-filter-fechainicio', 'report-filter-fechatermino');
  syncLinkedDatepickers('filter-sujetos-fechadesde', 'filter-sujetos-fechahasta');
  syncLinkedDatepickers('asistencia-filter-fechainicio', 'asistencia-filter-fechatermino');
}



// Exposición canónica a window para compatibilidad total con eventos DOM y app.js
window.initAirDatepickerFields = initAirDatepickerFields;
window.syncLinkedDatepickers = syncLinkedDatepickers;
window.syncAllLinkedDatepickers = syncAllLinkedDatepickers;

export {
  initAirDatepickerFields,
  syncLinkedDatepickers,
  syncAllLinkedDatepickers
};
