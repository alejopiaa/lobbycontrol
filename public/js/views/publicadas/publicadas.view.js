/**
 * publicadas.view.js - Módulo puente / retrocompatibilidad hacia audienciasPublicadas.view.js y pendientesPublicacion.view.js
 * LobbyControl - Arquitectura Modular ESM
 */

import { renderAudienciasPublicadas, AudienciasPublicadasView } from '../audienciasPublicadas/audienciasPublicadas.view.js';
import { renderPendientesPublicacion, PendientesPublicacionView } from '../pendientesPublicacion/pendientesPublicacion.view.js';

/**
 * Renderiza la vista correspondiente (retrocompatibilidad para llamadas heredadas)
 * @param {HTMLElement} container
 */
export function renderPublicadas(container) {
  const pageState = (typeof paginationState !== 'undefined' ? paginationState : (typeof window !== 'undefined' ? window.paginationState : null));
  const subTab = pageState?.publicadas?.subTab;
  if (subTab === 'pendientes') {
    return renderPendientesPublicacion(container);
  }
  return renderAudienciasPublicadas(container);
}

export const PublicadasView = {
  async mount(container, params = {}) {
    return renderPublicadas(container);
  },
  unmount() {}
};

export {
  renderAudienciasPublicadas,
  AudienciasPublicadasView,
  renderPendientesPublicacion,
  PendientesPublicacionView
};

if (typeof window !== 'undefined') {
  window.renderPublicadas = renderPublicadas;
  window.PublicadasView = PublicadasView;
}
