/**
 * AsistenciaTab - Módulo desacoplado de la pestaña de asistencia técnica
 */
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
  },

  unmount() {
    const inputs = document.querySelectorAll('#asistencia-view-container .datepicker-display-input');
    inputs.forEach(input => {
      if (input._airDatepicker && typeof input._airDatepicker.destroy === 'function') {
        try {
          input._airDatepicker.destroy();
        } catch (e) {
          console.debug('[AsistenciaTab] Error al destruir datepicker:', e);
        }
        input._airDatepicker = null;
      }
    });
  }
};
