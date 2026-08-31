/**
 * ReportesTab - Módulo desacoplado de la pestaña de reportes
 */
import { ExportService } from '../../services/export.service.js';

export const ReportesTab = {
  mount(container) {
    if (typeof window.renderReportes === 'function') {
      window.renderReportes(container);
    }
    if (typeof window.initAirDatepickerFields === 'function') {
      requestAnimationFrame(() => {
        window.initAirDatepickerFields();
        if (typeof window.syncAllLinkedDatepickers === 'function') {
          window.syncAllLinkedDatepickers();
        }
      });
    }
  },

  unmount() {
    const inputs = document.querySelectorAll('#reportes-view-container .datepicker-display-input');
    inputs.forEach(input => {
      if (input._airDatepicker && typeof input._airDatepicker.destroy === 'function') {
        try {
          input._airDatepicker.destroy();
        } catch (e) {
          console.debug('[ReportesTab] Error al destruir datepicker:', e);
        }
        input._airDatepicker = null;
      }
    });
  }
};
