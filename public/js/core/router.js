/**
 * Router SPA - Gestor de Enrutamiento y Ciclo de Vida de Vistas
 * Controla el ciclo de vida: mount(), unmount() y destroy() de cada pantalla.
 */
import { appStore } from './store.js';
import { eventBus } from './event-bus.js';

export class Router {
  constructor(routes = {}, containerId = 'main-content') {
    this.routes = routes;
    this.containerId = containerId;
    this.currentViewInstance = null;
    this.currentViewName = null;
  }

  /**
   * Registra una vista para una ruta/nombre dado
   * @param {string} name - Nombre de la vista (ej. 'dashboard', 'solicitudes')
   * @param {Object} viewModule - Objeto o clase con mount() y opcionalmente unmount()
   */
  register(name, viewModule) {
    this.routes[name] = viewModule;
  }

  /**
   * Conmuta hacia una vista dada gestionando su ciclo de vida
   * @param {string} viewName - Nombre de la vista destino
   * @param {Object} [params={}] - Parámetros opcionales para la vista
   */
  async navigate(viewName, params = {}) {
    const container = document.getElementById(this.containerId);
    if (!container && viewName !== 'login') {
      console.warn(`[Router] Contenedor '${this.containerId}' no encontrado en el DOM.`);
    }

    // 1. Ciclo de desmontaje de la vista anterior
    if (this.currentViewInstance) {
      if (typeof this.currentViewInstance.unmount === 'function') {
        try {
          await this.currentViewInstance.unmount();
        } catch (err) {
          console.error(`[Router] Error al desmontar vista '${this.currentViewName}':`, err);
        }
      }
      this.currentViewInstance = null;
    }

    // 2. Control de seguridad por rol y sesión
    const user = appStore.state.currentUser;
    if (!user && viewName !== 'login') {
      console.warn('[Router] Acceso no autenticado. Redirigiendo a login.');
      viewName = 'login';
    }

    // 3. Obtener módulo de la vista destino
    const viewModule = this.routes[viewName];
    this.currentViewName = viewName;
    appStore.state.currentView = viewName;
    localStorage.setItem('lobby_current_view', viewName);

    // 4. Notificar cambio de vista
    eventBus.emit('router:navigating', { viewName, params });

    if (viewModule) {
      this.currentViewInstance = viewModule;
      if (container && typeof viewModule.mount === 'function') {
        try {
          await viewModule.mount(container, params);
        } catch (err) {
          console.error(`[Router] Error al montar vista '${viewName}':`, err);
        }
      }
    } else {
      // Fallback hacia el render legacy si la vista aún no ha sido migrada a ESM
      if (typeof window.renderViewLegacy === 'function') {
        window.renderViewLegacy(viewName, params);
      } else if (typeof window.switchView === 'function') {
        // Delegar temporalmente al router heredado
        window._isRouterDelegating = true;
        window.switchView(viewName);
        window._isRouterDelegating = false;
      }
    }

    // 5. Notificar vista montada
    eventBus.emit('router:navigated', { viewName, params });

    // Actualizar iconos Lucide
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }
  }

  getCurrentView() {
    return this.currentViewName;
  }
}

export const appRouter = new Router();
