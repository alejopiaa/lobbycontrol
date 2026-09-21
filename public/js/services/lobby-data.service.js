/**
 * lobby-data.service.js - Capa de servicios y peticiones de datos de la plataforma Lobby
 * Desacoplado de app.js para arquitectura modular ESM.
 */

const getStore = () => window.dataStore || (window.dataStore = {});
const getPaginationState = () => window.paginationState || (window.paginationState = {});

async function fetchStats(signal) {
  const res = await fetch('/api/stats', { signal });
  if (!res.ok) throw new Error();
  getStore().stats = await res.json();
  if (typeof window !== 'undefined' && typeof window.updateSidebarBadges === 'function') {
    window.updateSidebarBadges();
  }
}

/**
 * Petición de datos genérica
 * @param {string} viewName - Parámetro viewName.
 * @param {AbortSignal} signal - Parámetro signal.
 */
async function fetchData(viewName, signal) {
  const apiPath = viewName === 'administracion' ? 'usuarios' : viewName;
  const endpoint = `/api/${apiPath}`;
  const res = await fetch(endpoint, { signal });
  if (!res.ok) throw new Error();
  
  const storeKey = viewName === 'administracion' ? 'usuarios' : viewName;
  getStore()[storeKey] = await res.json();
}

/**
 * Petición de lista paginada y filtrada desde el backend
 * @param {string} viewName - Parámetro viewName.
 * @param {AbortSignal} signal - Parámetro signal.
 */
async function fetchPaginatedList(viewName, signal) {
  const pageLimit = 10;
  const pState = getPaginationState();
  const ds = getStore();
  
  if (viewName === 'audiencias') {
    const subTab = window.activeAudienciasSubTab || 'solicitudes';
    if (subTab === 'solicitudes') {
      return await fetchPaginatedList('solicitudes', signal);
    } else {
      if (!pState.publicadas) pState.publicadas = { page: 1, filters: {} };
      pState.publicadas.subTab = (subTab === 'pendientes') ? 'pendientes' : 'historial';
      return await fetchPaginatedList('publicadas', signal);
    }
  }

  if (viewName === 'solicitudes') {
    if (!pState.solicitudes) pState.solicitudes = { page: 1, filters: {} };
    const state = pState.solicitudes;
    const params = new URLSearchParams({
      page: state.page,
      limit: pageLimit,
      folio: state.filters.folio || '',
      nombre: state.filters.nombre || '',
      cargo: state.filters.cargo || '',
      sujetoActivoRepresentado: state.filters.sujetoActivoRepresentado || '',
      estado: state.filters.estado || '',
      fechaInicio: state.filters.fechaInicio || '',
      fechaTermino: state.filters.fechaTermino || '',
      relacionSujetoActivo: state.filters.relacionSujetoActivo || '',
      relacionRut: state.filters.relacionRut || '',
      relacionRepresentado: state.filters.relacionRepresentado || '',
      vigencia: state.filters.vigencia || 'todos'
    });
    
    const res = await fetch(`/api/solicitudes?${params.toString()}`, { signal });
    if (!res.ok) throw new Error();
    ds.solicitudes = await res.json();
    
  } else if (viewName === 'publicadas') {
    if (!pState.publicadas) pState.publicadas = { page: 1, filters: {} };
    const state = pState.publicadas;
    const subTab = state.subTab || 'historial';
    const params = new URLSearchParams({
      page: state.page,
      limit: pageLimit,
      folio: state.filters.folio || '',
      nombre: state.filters.nombre || '',
      cargo: state.filters.cargo || '',
      sujetoActivoRepresentado: state.filters.sujetoActivoRepresentado || '',
      estado: state.filters.estado || '',
      fechaInicio: state.filters.fechaInicio || '',
      fechaTermino: state.filters.fechaTermino || '',
      relacionSujetoActivo: state.filters.relacionSujetoActivo || '',
      relacionRut: state.filters.relacionRut || '',
      relacionRepresentado: state.filters.relacionRepresentado || '',
      vigencia: state.filters.vigencia || 'todos'
    });
    
    if (subTab === 'historial') {
      const res = await fetch(`/api/publicadas?${params.toString()}`, { signal });
      if (!res.ok) throw new Error();
      ds.publicadas = await res.json();
    } else {
      params.set('pending_publication', 'true');
      const res = await fetch(`/api/solicitudes?${params.toString()}`, { signal });
      if (!res.ok) throw new Error();
      ds.solicitudesPendientesPublicacion = await res.json();
    }
  } else if (viewName === 'viajes') {
    if (!pState.viajes) pState.viajes = { page: 1, filters: {} };
    const state = pState.viajes;
    const params = new URLSearchParams({
      page: state.page,
      limit: pageLimit,
      search: state.filters.search || '',
      nombre: state.filters.nombre || state.filters.sujetoPasivo || '',
      sujetoPasivo: state.filters.sujetoPasivo || state.filters.nombre || '',
      cargo: state.filters.cargo || '',
      destino: state.filters.destino || '',
      financiador: state.filters.financiador || '',
      anio: state.filters.anio || '',
      fechaInicio: state.filters.fechaInicio || '',
      fechaTermino: state.filters.fechaTermino || '',
      vigencia: state.filters.vigencia || 'todos'
    });

    const [resViajes, resStats] = await Promise.all([
      fetch(`/api/viajes?${params.toString()}`, { signal }),
      fetch(`/api/viajes/stats?${params.toString()}`, { signal })
    ]);

    if (!resViajes.ok) throw new Error();
    ds.viajes = await resViajes.json();
    if (resStats.ok) {
      ds.viajesStats = await resStats.json();
    }
  } else if (viewName === 'donativos') {
    if (!pState.donativos) pState.donativos = { page: 1, filters: {} };
    const state = pState.donativos;
    const params = new URLSearchParams({
      page: state.page,
      limit: pageLimit,
      search: state.filters.search || '',
      nombre: state.filters.nombre || state.filters.sujetoPasivo || '',
      sujetoPasivo: state.filters.sujetoPasivo || state.filters.nombre || '',
      cargo: state.filters.cargo || '',
      procedencia: state.filters.procedencia || '',
      tipo: state.filters.tipo || '',
      ocasion: state.filters.ocasion || '',
      anio: state.filters.anio || '',
      fechaInicio: state.filters.fechaInicio || '',
      fechaTermino: state.filters.fechaTermino || '',
      vigencia: state.filters.vigencia || 'todos'
    });

    const [resDonativos, resStats] = await Promise.all([
      fetch(`/api/donativos?${params.toString()}`, { signal }),
      fetch(`/api/donativos/stats?${params.toString()}`, { signal })
    ]);

    if (!resDonativos.ok) throw new Error();
    ds.donativos = await resDonativos.json();
    if (resStats.ok) {
      ds.donativosStats = await resStats.json();
    }
  }
}

/**
 * Actualizar la vista de la lista con cancelación y manejo de errores
 * @param {string} viewName - Parámetro viewName.
 * @param {string|number} activeInputId - Parámetro activeInputId.
 */
async function updateListView(viewName, activeInputId = null) {
  if (window.activeAbortController) {
    window.activeAbortController.abort();
  }
  window.activeAbortController = new AbortController();
  const signal = window.activeAbortController.signal;
  
  try {
    await fetchPaginatedList(viewName, signal);
    window.activeInputId = activeInputId;
    if (typeof window.renderView === 'function') {
      window.renderView();
    }
    window.activeInputId = null;
    if (activeInputId) {
      const input = document.getElementById(activeInputId);
      if (input && input.tagName !== 'SELECT' && typeof input.focus === 'function') {
        input.focus();
        if (typeof input.setSelectionRange === 'function') {
          const len = (input.value && input.value.length) || 0;
          input.setSelectionRange(len, len);
        }
      }
    }
  } catch (err) {
    if (err.name === 'AbortError') return;
    console.error(err);
    if (typeof window.showToast === 'function') {
      window.showToast('Error al obtener datos paginados del servidor.', 'error');
    }
  }
}

/**
 * Helper para disparar re-renderizado o llamada paginada según corresponda
 */
function triggerRenderOrFetch() {
  const currentView = window.currentView || 'dashboard';
  if (currentView === 'solicitudes' || currentView === 'publicadas' || currentView === 'viajes' || currentView === 'donativos' || currentView === 'audiencias') {
    updateListView(currentView);
  } else if (typeof window.renderView === 'function') {
    window.renderView();
  }
}

/**
 * Petición de estado de salud y diagnóstico de base de datos
 * @param {AbortSignal} signal - Parámetro signal.
 */
async function fetchDbHealth(signal) {
  try {
    const res = await fetch('/api/admin/db-health', { signal });
    if (res.ok) {
      const ds = getStore();
      ds.dbHealth = await res.json();
    }
  } catch (e) {
    if (e.name !== 'AbortError') console.warn('[lobby-data.service] Error en fetchDbHealth:', e);
  }
}

/**
 * Petición de historial de sincronizaciones
 * @param {AbortSignal} signal - Parámetro signal.
 */
async function fetchSyncHistory(signal) {
  try {
    const res = await fetch('/api/admin/historial-sincronizaciones', { signal });
    if (res.ok) {
      const ds = getStore();
      ds.syncHistory = await res.json();
    }
  } catch (e) {
    if (e.name !== 'AbortError') console.warn('[lobby-data.service] Error en fetchSyncHistory:', e);
  }
}

/**
 * Petición de registros de auditoría semanal
 * @param {AbortSignal} signal - Parámetro signal.
 */
async function fetchAuditoria(signal) {
  try {
    const res = await fetch('/api/admin/auditoria', { signal });
    if (res.ok) {
      const ds = getStore();
      ds.auditoria = await res.json();
    }
  } catch (e) {
    if (e.name !== 'AbortError') console.warn('[lobby-data.service] Error en fetchAuditoria:', e);
  }
}

/**
 * Petición especial de datos para el Dashboard
 * @param {AbortSignal} signal - Parámetro signal.
 */
async function fetchDashboardData(signal) {
  const res = await fetch('/api/solicitudes', { signal });
  if (!res.ok) throw new Error();
  const ds = getStore();
  ds.dashboardRawData = await res.json();
  if (typeof window !== 'undefined' && typeof window.updateSidebarBadges === 'function') {
    window.updateSidebarBadges();
  }
}

/**
 * Petición de IDs de sujetos pasivos vigentes
 * @param {AbortSignal} signal - Parámetro signal.
 */
async function fetchActiveSujetoIds(signal) {
  const res = await fetch('/api/sujetos_pasivos/vigentes', { signal });
  if (!res.ok) throw new Error();
  const data = await res.json();
  const cache = new Set();
  (Array.isArray(data) ? data : []).forEach(id => {
    if (id !== null && id !== undefined && id !== '') {
      cache.add(Number(id));
      cache.add(String(id));
    }
  });
  window.activeSujetoIdsCache = cache;
  if (typeof activeSujetoIdsCache !== 'undefined' && activeSujetoIdsCache instanceof Set) {
    activeSujetoIdsCache.clear();
    cache.forEach(val => activeSujetoIdsCache.add(val));
  }
}

/**
 * Petición de nombres de sujetos pasivos VIGENTES (para el autocomplete de reportes)
 * @param {AbortSignal} signal - Parámetro signal.
 */
async function fetchVigentesNombres(signal) {
  try {
    const res = await fetch('/api/sujetos_pasivos/vigentes-nombres', { signal });
    if (!res.ok) return;
    const data = await res.json();
    getStore().sujetosVigentesNombres = data; // [{ nombre, rut }, ...]
  } catch (e) {
    console.warn('No se pudo cargar la lista de vigentes:', e);
  }
}

/**
 * Petición especial de datos para Reportes
 * @param {AbortSignal} signal - Parámetro signal.
 */
async function fetchReportesData(signal) {
  const res = await fetch('/api/solicitudes', { signal });
  if (!res.ok) throw new Error();
  getStore().reportesRawData = await res.json();
}

window.fetchReportesData = fetchReportesData;
window.fetchStats = fetchStats;
window.fetchData = fetchData;
window.fetchPaginatedList = fetchPaginatedList;
window.updateListView = updateListView;
window.triggerRenderOrFetch = triggerRenderOrFetch;
window.fetchDbHealth = fetchDbHealth;
window.fetchSyncHistory = fetchSyncHistory;
window.fetchAuditoria = fetchAuditoria;
window.fetchDashboardData = fetchDashboardData;
window.fetchActiveSujetoIds = fetchActiveSujetoIds;
window.fetchVigentesNombres = fetchVigentesNombres;

export {
  fetchReportesData,
  fetchStats,
  fetchData,
  fetchPaginatedList,
  updateListView,
  triggerRenderOrFetch,
  fetchDbHealth,
  fetchSyncHistory,
  fetchAuditoria,
  fetchDashboardData,
  fetchActiveSujetoIds,
  fetchVigentesNombres
};
