/**
 * ViajesView - Vista modular de registro de viajes (Hoja VH)
 */
export const ViajesView = {
  async mount(container, params = {}) {
    if (typeof window.renderViajes === 'function') {
      window.renderViajes(container);
    }
  },
  unmount() {}
};
