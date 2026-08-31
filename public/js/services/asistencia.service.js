/**
 * AsistenciaService - CRUD de tickets de asistencia técnica, contactos y categorías
 */
import { apiClient } from './api-client.js';

export const AsistenciaService = {
  async getStats() {
    return await apiClient.get('/api/asistencias/stats');
  },

  async getTickets(filtros = {}) {
    return await apiClient.get('/api/asistencias', filtros);
  },

  async getTicket(id) {
    return await apiClient.get(`/api/asistencias/${id}`);
  },

  async saveTicket(data) {
    if (data.id) {
      return await apiClient.put(`/api/asistencias/${data.id}`, data);
    }
    return await apiClient.post('/api/asistencias', data);
  },

  async deleteTicket(id) {
    return await apiClient.delete(`/api/asistencias/${id}`);
  },

  // Contactos
  async getContactos(params = {}) {
    return await apiClient.get('/api/asistencias/contactos', params);
  },

  async saveContacto(data) {
    if (data.id) {
      return await apiClient.put(`/api/asistencias/contactos/${data.id}`, data);
    }
    return await apiClient.post('/api/asistencias/contactos', data);
  },

  async deleteContacto(id) {
    return await apiClient.delete(`/api/asistencias/contactos/${id}`);
  },

  async unificarContactos(targetId, sourceIds) {
    return await apiClient.post('/api/asistencias/contactos/unificar', {
      target_id: targetId,
      source_ids: sourceIds
    });
  },

  // Categorías
  async getCategorias() {
    return await apiClient.get('/api/asistencias/categorias');
  },

  async saveCategoria(data) {
    if (data.id) {
      return await apiClient.put(`/api/asistencias/categorias/${data.id}`, data);
    }
    return await apiClient.post('/api/asistencias/categorias', data);
  },

  async deleteCategoria(id) {
    return await apiClient.delete(`/api/asistencias/categorias/${id}`);
  }
};
