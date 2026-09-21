/**
 * AuthService - Servicios de autenticación y gestión de sesiones
 */
import { apiClient } from './api-client.js';
import { appStore } from '../core/store.js';
import { eventBus } from '../core/event-bus.js';

export const AuthService = {
  async loginMicrosoft() {
    try {
      const res = await fetch('/api/auth/trigger-sso', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success) {
        this._setSession(data.user);
        return { success: true, user: data.user };
      }
      return { success: false, message: data.message || data.error || 'Error al autenticar con Microsoft' };
    } catch (err) {
      console.error('[AuthService] Error en loginMicrosoft:', err);
      return { success: false, message: err.message || 'Error de conexión con Microsoft 365' };
    }
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
    if (typeof window !== 'undefined') {
      window.currentUser = user;
    }
    if (token) localStorage.setItem('lobby_token', token);
    eventBus.emit('auth:login', { user });
  },

  _clearSession() {
    appStore.state.currentUser = null;
    if (typeof window !== 'undefined') {
      window.currentUser = null;
    }
    localStorage.removeItem('lobby_token');
    eventBus.emit('auth:logout');
  }
};
