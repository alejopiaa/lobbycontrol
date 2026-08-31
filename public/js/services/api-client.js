/**
 * ApiClient - Cliente centralizado de comunicación IPC con el backend local
 * Encapsula window.api.invokeRoute con intercepción de errores, timeouts y logging.
 */
export class ApiClient {
  constructor(timeoutMs = 30000) {
    this.timeoutMs = timeoutMs;
  }

  async request(routeOptions) {
    if (!window.api || typeof window.api.invokeRoute !== 'function') {
      throw new Error('IPC Bridge (window.api) no está disponible en este entorno.');
    }

    try {
      const response = await window.api.invokeRoute(routeOptions);
      if (!response) {
        throw new Error('Respuesta vacía del servidor local.');
      }
      return response;
    } catch (err) {
      console.error(`[ApiClient] Error en petición a ${routeOptions.url || 'ruta desconocida'}:`, err);
      throw err;
    }
  }

  async get(url, queryParams = null) {
    let finalUrl = url;
    if (queryParams && typeof queryParams === 'object') {
      const qs = new URLSearchParams(queryParams).toString();
      if (qs) finalUrl += `?${qs}`;
    }
    return this.request({ url: finalUrl, method: 'GET' });
  }

  async post(url, body = {}) {
    return this.request({ url, method: 'POST', body });
  }

  async put(url, body = {}) {
    return this.request({ url, method: 'PUT', body });
  }

  async delete(url, body = {}) {
    return this.request({ url, method: 'DELETE', body });
  }
}

export const apiClient = new ApiClient();
