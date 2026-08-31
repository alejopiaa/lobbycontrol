/**
 * PublicadasView - Vista modular de audiencias publicadas
 */
export const PublicadasView = {
  async mount(container, params = {}) {
    if (typeof window.renderPublicadas === 'function') {
      window.renderPublicadas(container);
    }
  },
  unmount() {}
};
