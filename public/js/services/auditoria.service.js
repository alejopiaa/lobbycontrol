/**
 * AuditoriaService - Control semanal y mensual de auditoría
 */
import { apiClient } from './api-client.js';

export const AuditoriaService = {
  async getAuditorias() {
    return await apiClient.get('/api/auditorias');
  },

  async saveAuditoria(data) {
    if (data.id) {
      return await apiClient.put(`/api/auditorias/${data.id}`, data);
    }
    return await apiClient.post('/api/auditorias', data);
  },

  async deleteAuditoria(id) {
    return await apiClient.delete(`/api/auditorias/${id}`);
  },

  async closeAuditoriaRecord(id) {
    return await apiClient.post(`/api/auditorias/${id}/close`);
  }
};
