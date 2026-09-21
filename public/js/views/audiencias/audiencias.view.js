/**
 * audiencias.view.js - Vista orquestadora del módulo Audiencias y Solicitudes
 * LobbyControl - Arquitectura Modular ESM
 */

import { renderSolicitudes } from '../solicitudes/solicitudes.view.js';
import { renderPendientesPublicacion } from '../pendientesPublicacion/pendientesPublicacion.view.js';
import { renderAudienciasPublicadas } from '../audienciasPublicadas/audienciasPublicadas.view.js';

/**
 * Renderiza la sub-pestaña activa del módulo Audiencias y Solicitudes
 * @param {HTMLElement} container - Contenedor principal donde se monta la vista
 */
export function renderAudiencias(container) {
  const activeSubTab = (typeof window !== 'undefined' && window.activeAudienciasSubTab) ? window.activeAudienciasSubTab : 'solicitudes';
  
  if (activeSubTab === 'solicitudes') {
    renderSolicitudes(container);
  } else if (activeSubTab === 'pendientes') {
    renderPendientesPublicacion(container);
  } else {
    renderAudienciasPublicadas(container);
  }
}

export const AudienciasView = {
  async mount(container, params = {}) {
    return renderAudiencias(container);
  },
  unmount() {}
};

if (typeof window !== 'undefined') {
  window.renderAudiencias = renderAudiencias;
  window.renderAudienciasModule = renderAudiencias;
  window.AudienciasView = AudienciasView;
}
