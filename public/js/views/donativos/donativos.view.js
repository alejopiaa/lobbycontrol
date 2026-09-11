/**
 * DonativosView - Vista modular de registro de donativos (Hoja DH)
 */
export const DonativosView = {
  async mount(container, params = {}) {
    if (typeof window.renderDonativos === 'function') {
      window.renderDonativos(container);
    }
  },
  unmount() {}
};
