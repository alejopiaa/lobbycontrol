/**
 * Store - Gestor de Estado Centralizado y Reactivo
 * Implementa el patrón Proxy + Observer para mutaciones predecibles y trazables.
 */
import { eventBus } from './event-bus.js';

const initialState = {
  currentUser: null,
  currentView: 'login',
  theme: localStorage.getItem('theme') || 'light',
  
  // Ámbitos y pestañas de navegación activa
  activeAdminScope: 'gestion',
  activeAdminTab: 'auditoria',
  
  // Almacenes de datos en memoria (dataStore)
  dataStore: {
    solicitudes: [],
    audiencias: [],
    sujetosPasivos: [],
    auditorias: [],
    alertas: [],
    syncHistory: [],
    usuarios: [],
    asistencias: [],
    contactos: [],
    categorias: []
  },

  // Filtros globales activos
  filters: {
    vigenciaDashboard: 'vigentes',
    vigenciaSolicitudes: 'vigentes',
    vigenciaPublicadas: 'vigentes',
    vigenciaSujetos: 'vigentes',
    searchSolicitudes: '',
    searchPublicadas: '',
    searchSujetos: '',
    searchAsistencia: ''
  },

  // Indicadores de estado asíncrono
  ui: {
    isSyncing: false,
    syncStatus: 'idle', // 'idle' | 'syncing' | 'success' | 'error'
    lastSyncTime: null,
    isModalOpen: false,
    activeModalId: null
  }
};

class Store {
  constructor(state) {
    this._subscribers = new Map();
    this.state = this._createProxy(state);
  }

  _createProxy(target, path = '') {
    return new Proxy(target, {
      get: (obj, prop) => {
        const val = obj[prop];
        if (val && typeof val === 'object' && !Array.isArray(val)) {
          return this._createProxy(val, path ? `${path}.${String(prop)}` : String(prop));
        }
        return val;
      },
      set: (obj, prop, value) => {
        const fullPath = path ? `${path}.${String(prop)}` : String(prop);
        const oldValue = obj[prop];
        obj[prop] = value;

        // Notificar a observadores específicos
        this._notify(fullPath, value, oldValue);
        // Emitir evento en el bus general
        eventBus.emit(`state:${fullPath}`, { value, oldValue });
        eventBus.emit('state:changed', { path: fullPath, value, oldValue });

        return true;
      }
    });
  }

  /**
   * Suscribe un callback a una propiedad del estado
   * @param {string} path - Ruta de la propiedad (ej. 'currentUser', 'ui.isSyncing')
   * @param {Function} callback - Función a ejecutar con (newValue, oldValue)
   * @returns {Function} Función para desuscribirse
   */
  subscribe(path, callback) {
    if (!this._subscribers.has(path)) {
      this._subscribers.set(path, new Set());
    }
    this._subscribers.get(path).add(callback);

    return () => {
      if (this._subscribers.has(path)) {
        this._subscribers.get(path).delete(callback);
      }
    };
  }

  _notify(path, newValue, oldValue) {
    if (this._subscribers.has(path)) {
      this._subscribers.get(path).forEach(cb => {
        try {
          cb(newValue, oldValue);
        } catch (err) {
          console.error(`[Store] Error en suscriptor de '${path}':`, err);
        }
      });
    }
  }

  /**
   * Obtiene una copia inmutable del estado
   */
  getState() {
    return JSON.parse(JSON.stringify(this.state));
  }

  /**
   * Actualiza múltiples propiedades del estado de forma atómica
   * @param {Object} partialState
   */
  setState(partialState) {
    Object.entries(partialState).forEach(([key, value]) => {
      this.state[key] = value;
    });
  }
}

export const appStore = new Store(initialState);
