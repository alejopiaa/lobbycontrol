/**
 * AudienciasView - Vista unificada de audiencias (Solicitudes, Pendientes, Publicadas)
 */
export const AudienciasView = {
  async mount(container, params = {}) {
    if (typeof window.renderAudiencias === 'function') {
      window.renderAudiencias(container);
    }
  },
  unmount() {}
};
