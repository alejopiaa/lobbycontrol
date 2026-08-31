/**
 * LobbyService - Consultas de audiencias activas, publicadas y sujetos pasivos
 */
import { apiClient } from './api-client.js';

export const LobbyService = {
  async getDashboardStats(params = {}) {
    return await apiClient.get('/api/dashboard/stats', params);
  },

  async getSolicitudes(params = {}) {
    return await apiClient.get('/api/solicitudes', params);
  },

  async getSolicitudDetalle(id) {
    return await apiClient.get(`/api/solicitudes/${id}`);
  },

  async getPublicadas(params = {}) {
    return await apiClient.get('/api/publicadas', params);
  },

  async getSujetosPasivos(params = {}) {
    return await apiClient.get('/api/sujetos-pasivos', params);
  },

  async getAlertas() {
    return await apiClient.get('/api/alertas');
  }
};
