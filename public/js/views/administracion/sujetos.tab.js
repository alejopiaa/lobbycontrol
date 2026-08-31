/**
 * SujetosTab - Módulo desacoplado de la pestaña de sujetos pasivos
 */
export const SujetosTab = {
  mount(container) {
    if (typeof window.renderSujetosPasivos === 'function') {
      window.renderSujetosPasivos(container);
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
    const inputs = document.querySelectorAll('#sujetos-pasivos-view-container .datepicker-display-input');
    inputs.forEach(input => {
      if (input._airDatepicker && typeof input._airDatepicker.destroy === 'function') {
        try {
          input._airDatepicker.destroy();
        } catch (e) {
          console.debug('[SujetosTab] Error al destruir datepicker:', e);
        }
        input._airDatepicker = null;
      }
    });
  }
};
