/**
 * SolicitudesView - Vista modular de solicitudes activas
 */
export const SolicitudesView = {
  async mount(container, params = {}) {
    if (typeof window.renderSolicitudes === 'function') {
      window.renderSolicitudes(container);
    }
  },
  unmount() {}
};
