/**
 * AuthService - Servicios de autenticación y gestión de sesiones
 */
import { apiClient } from './api-client.js';
import { appStore } from '../core/store.js';
import { eventBus } from '../core/event-bus.js';

export const AuthService = {
  async loginLocal(username, password) {
    const res = await apiClient.post('/api/auth/login', { username, password });
    if (res.status === 200 && res.data && res.data.user) {
      this._setSession(res.data.user, res.data.token);
      return { success: true, user: res.data.user };
    }
    return { success: false, message: res.data?.message || 'Credenciales inválidas' };
  },

  async loginMicrosoft() {
    const res = await apiClient.post('/api/auth/login-microsoft');
    if (res.status === 200 && res.data && res.data.user) {
      this._setSession(res.data.user, res.data.token);
      return { success: true, user: res.data.user };
    }
    return { success: false, message: res.data?.message || res.data?.error || 'Error al autenticar con Microsoft' };
  },

  async checkSession() {
    try {
      const res = await apiClient.get('/api/auth/me');
      if (res.status === 200 && res.data && res.data.user) {
        this._setSession(res.data.user, res.data.token);
        return { authenticated: true, user: res.data.user };
      }
    } catch (err) {
      console.warn('[AuthService] No hay sesión activa o falló la verificación:', err.message);
    }
    return { authenticated: false, user: null };
  },

  async logout() {
    try {
      await apiClient.post('/api/auth/logout');
    } catch (err) {
      console.warn('[AuthService] Error al notificar logout al backend:', err.message);
    } finally {
      this._clearSession();
    }
  },

  _setSession(user, token) {
    appStore.state.currentUser = user;
    if (token) localStorage.setItem('lobby_token', token);
    eventBus.emit('auth:login', { user });
  },

  _clearSession() {
    appStore.state.currentUser = null;
    localStorage.removeItem('lobby_token');
    eventBus.emit('auth:logout');
  }
};
