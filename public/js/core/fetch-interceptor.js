/**
 * fetch-interceptor.js - Interceptor global para redirección automática y desvío de API a IPC en Electron
 * Desacoplado de app.js para arquitectura modular ESM.
 */

const originalFetch = window.fetch;

export function setupFetchInterceptor() {
  if (window.__fetchInterceptorInstalled) return;
  window.__fetchInterceptorInstalled = true;

  window.fetch = async function (input, init = {}) {
    let url = typeof input === 'string' ? input : input.url;

    // Si es un llamado a la API local (/api/...) y estamos en entorno Electron
    if (url.startsWith('/api/') && typeof window.api !== 'undefined') {
      const method = init.method || 'GET';
      let body = null;
      if (init.body) {
        if (typeof init.body === 'string') {
          try {
            body = JSON.parse(init.body);
          } catch (e) {
            console.warn('[fetch-interceptor] Body no es JSON parseable, usando como string crudo:', e);
            body = init.body;
          }
        } else {
          body = init.body;
        }
      }

      try {
        const responseData = await window.api.invokeRoute({
          url,
          method,
          body,
          headers: init.headers
        });

        const resStatus = responseData?.status || (responseData?.success === false ? 500 : 200);
        const resData = responseData?.data !== undefined ? responseData.data : (responseData !== undefined ? responseData : { error: 'Unknown backend response' });
        const resObj = new Response(
          typeof resData === 'string' ? resData : JSON.stringify(resData),
          {
            status: resStatus,
            statusText: resStatus === 200 ? 'OK' : 'Error',
            headers: new Headers({
              'Content-Type': 'application/json',
              ...(responseData?.headers || {})
            })
          }
        );

        // Manejar el caso de no autorizado (401)
        if (resObj.status === 401) {
          if (!url.includes('/api/auth/me') && !url.includes('/api/auth/login')) {
            window.currentUser = null;
            if (typeof window.switchView === 'function') window.switchView('login');
            resObj.clone().json().then(data => {
              const msg = data.error || data.message || 'Su sesión ha expirado o no está autorizado.';
              if (typeof window.showToast === 'function') window.showToast(msg, 'error');
            }).catch(() => {
              if (typeof window.showToast === 'function') window.showToast('Su sesión ha expirado o no está autorizado.', 'error');
            });
          }
        }

        return resObj;
      } catch (err) {
        console.error('[fetch-interceptor] Error al invocar ruta:', err);
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          statusText: 'Internal Server Error',
          headers: new Headers({ 'Content-Type': 'application/json' })
        });
      }
    }

    // Comportamiento por defecto para assets estáticos u otras llamadas (si no hay Electron)
    const response = await originalFetch(input, init);
    if (response.status === 401) {
      if (!url.includes('/api/auth/me') && !url.includes('/api/auth/login')) {
        window.currentUser = null;
        if (typeof window.switchView === 'function') window.switchView('login');
        response.clone().json().then(data => {
          const msg = data.error || data.message || 'Su sesión ha expirado o no está autorizado.';
          if (typeof window.showToast === 'function') window.showToast(msg, 'error');
        }).catch(() => {
          if (typeof window.showToast === 'function') window.showToast('Su sesión ha expirado o no está autorizado.', 'error');
        });
      }
    }
    return response;
  };
}

// Instalar inmediatamente al cargar el módulo
setupFetchInterceptor();
