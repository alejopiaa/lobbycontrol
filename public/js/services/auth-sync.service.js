/**
 * auth-sync.service.js - Servicios de Autenticación, SSO, Impersonación y Sincronización en Segundo Plano
 * Desacoplado de app.js para arquitectura modular ESM.
 */

let currentUser = (typeof window !== 'undefined' && window.currentUser) ? window.currentUser : null;

const getCurrentUser = () => currentUser || (typeof window !== 'undefined' ? window.currentUser : null);

const setCurrentUser = (user) => {
  currentUser = user;
  if (typeof window !== 'undefined') {
    window.currentUser = user;
  }
};

window.lastCloudCheckTimestamp = null;

window.getCloudCheckText = function() {
  if (!window.lastCloudCheckTimestamp) return 'Comprobando conexión...';
  const elapsedSec = Math.floor((Date.now() - window.lastCloudCheckTimestamp) / 1000);
  const timeStr = new Date(window.lastCloudCheckTimestamp).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false });
  let relative = '';
  if (elapsedSec < 60) {
    relative = `hace ${Math.max(1, elapsedSec)} s`;
  } else {
    const diffMinutes = Math.floor(elapsedSec / 60);
    relative = `hace ${diffMinutes} min`;
  }
  return `${timeStr} hrs (${relative}) · Sin cambios`;
};

function parseTimestampToMs(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return 0;
  const str = dateStr.trim();
  if (str === '-' || str === '--' || str.startsWith('No se')) return 0;

  // Formato Latino: DD-MM-YYYY o DD/MM/YYYY [HH:mm]
  const latin = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?:\s+(\d{1,2}):(\d{1,2}))?/);
  if (latin) {
    const day = parseInt(latin[1], 10);
    const month = parseInt(latin[2], 10) - 1;
    const year = parseInt(latin[3], 10);
    const hour = parseInt(latin[4] || '0', 10);
    const min = parseInt(latin[5] || '0', 10);
    return new Date(year, month, day, hour, min).getTime();
  }

  // Formato ISO: YYYY-MM-DD [HH:mm]
  const iso = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:\s+(\d{1,2}):(\d{1,2}))?/);
  if (iso) {
    const year = parseInt(iso[1], 10);
    const month = parseInt(iso[2], 10) - 1;
    const day = parseInt(iso[3], 10);
    const hour = parseInt(iso[4] || '0', 10);
    const min = parseInt(iso[5] || '0', 10);
    return new Date(year, month, day, hour, min).getTime();
  }

  const parsed = Date.parse(str);
  return isNaN(parsed) ? 0 : parsed;
}

function getEffectiveLastUpdate() {
  const cloud = dataStore.dbHealth?.lastCloudUpdate;
  const localImport = dataStore.dbHealth?.lastImport;
  const storeUpdate = dataStore.dbLastUpdate;
  const candidates = [cloud, localImport, storeUpdate].filter(c => c && typeof c === 'string' && c !== '-' && c !== '--' && !c.startsWith('No se'));

  if (candidates.length === 0) return '--';

  let latestStr = candidates[0];
  let latestMs = parseTimestampToMs(candidates[0]);

  for (let i = 1; i < candidates.length; i++) {
    const ms = parseTimestampToMs(candidates[i]);
    if (ms > latestMs) {
      latestMs = ms;
      latestStr = candidates[i];
    }
  }

  return latestStr || '--';
}

function updateCloudCheckDisplay() {
  const timeEl = document.getElementById('capsule-cloud-time');
  const statusEl = document.getElementById('capsule-cloud-status');
  const downloadEl = document.getElementById('capsule-last-download');

  if (timeEl && window.lastCloudCheckTimestamp) {
    const timeStr = new Date(window.lastCloudCheckTimestamp).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false });
    timeEl.textContent = `${timeStr} hrs`;
  }

  if (downloadEl) {
    downloadEl.textContent = getEffectiveLastUpdate();
  }

  const syncViewEl = document.getElementById('sync-view-cloud-check');
  if (syncViewEl) {
    syncViewEl.textContent = window.getCloudCheckText();
  }
}

setInterval(updateCloudCheckDisplay, 15000);

/**
 * Administrar visualmente el estado de la cápsula flotante de conexión
 * @param {*} state - Parámetro state.
 */
function updateCapsuleStatus(state) {
  const pingEl = document.getElementById('capsule-indicator-ping');
  const dotEl = document.getElementById('capsule-indicator-dot');
  const labelEl = document.getElementById('capsule-label');
  const netStatusEl = document.getElementById('capsule-net-status');
  const cloudTimeEl = document.getElementById('capsule-cloud-time');
  const cloudStatusEl = document.getElementById('capsule-cloud-status');
  const lastDownloadEl = document.getElementById('capsule-last-download');
  const syncContainer = document.getElementById('capsule-sync-container');

  if (lastDownloadEl) {
    lastDownloadEl.textContent = getEffectiveLastUpdate();
  }

  if (pingEl && dotEl && labelEl && netStatusEl) {
    pingEl.className = 'animate-ping absolute inline-flex h-full w-full rounded-full';
    dotEl.className = 'relative inline-flex rounded-full h-2 w-2';

    if (state === 'synced') {
      window.lastCloudCheckTimestamp = Date.now();
      updateCloudCheckDisplay();
      pingEl.classList.remove('hidden');
      pingEl.classList.add('bg-emerald-400');
      dotEl.classList.add('bg-emerald-500');
      labelEl.textContent = 'Conectado';
      netStatusEl.textContent = 'Conectado';
      netStatusEl.className = 'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400';
      if (cloudStatusEl) cloudStatusEl.textContent = 'Sin cambios';
      if (syncContainer) syncContainer.classList.add('hidden');
    } else if (state === 'syncing') {
      if (cloudStatusEl) cloudStatusEl.textContent = 'Comprobando...';
      pingEl.classList.remove('hidden');
      pingEl.classList.add('bg-amber-400');
      dotEl.classList.add('bg-amber-500');
      labelEl.textContent = 'Actualizando...';
      netStatusEl.textContent = 'Sincronizando...';
      netStatusEl.className = 'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400';
      if (syncContainer) syncContainer.classList.add('hidden');
    } else if (state === 'error') {
      if (cloudStatusEl) cloudStatusEl.textContent = 'Error enlace';
      pingEl.classList.add('hidden');
      dotEl.classList.add('bg-rose-500');
      labelEl.textContent = 'Desconectado';
      netStatusEl.textContent = 'Error';
      netStatusEl.className = 'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400';
      if (syncContainer) syncContainer.classList.remove('hidden');
    }
  }
}

/**
 * Obtener y actualizar fecha de última actualización de la base de datos en el header
 */
async function fetchAndUpdateDbTimestamp() {
  try {
    const res = await fetch('/api/db-last-update');
    if (res.ok) {
      const data = await res.json();
      if (data.dbLastUpdate) {
        dataStore.dbLastUpdate = data.dbLastUpdate;
        updateCapsuleStatus('synced');
      }
      if (data.usersLastUpdate) {
        dataStore.usersLastUpdate = data.usersLastUpdate;
      }
    }
  } catch (err) {
    console.error('Error al obtener fecha de última actualización:', err);
    updateCapsuleStatus('error');
  }
}

/**
 * Funciones auxiliares de autenticación frontend
 */
async function checkAuth() {
  try {
    const res = await fetch('/api/auth/me');
    if (res.ok) {
      const user = await res.json();
      setCurrentUser(user);
      if (user) {
        if (user.nombre || user.correo) {
          localStorage.setItem('lobby_user_name', user.nombre || user.correo);
        }
        updateHeaderUserSection();
        if (typeof window.loadDockCatalogs === 'function') {
          window.loadDockCatalogs();
        }
        return true;
      }
    }
  } catch (err) {
    console.error('Error al comprobar sesión:', err);
  }
  setCurrentUser(null);
  return false;
}

function updateHeaderUserSection() {
  const user = getCurrentUser();
  if (!user) return;
  const rolEl = document.getElementById('header-user-rol');
  const nombreEl = document.getElementById('header-user-nombre');
  const initialsEl = document.getElementById('header-user-initials');
  
  if (rolEl) rolEl.textContent = user.rol || 'Analista';
  if (nombreEl) nombreEl.textContent = user.nombre || '';
  if (initialsEl) {
    const names = (user.nombre || '').trim().split(/\s+/);
    let initials = 'U';
    if (names.length >= 2) {
      initials = (names[0][0] + names[names.length - 1][0]).toUpperCase();
    } else if (names.length === 1 && names[0]) {
      initials = names[0].substring(0, 2).toUpperCase();
    }
    initialsEl.textContent = initials;
  }

  const rol = user.rol || '';
  const navSettings = document.getElementById('nav-settings');
  if (navSettings) {
    if (rol === 'Sujeto Pasivo' || rol === 'Asistente técnico') {
      navSettings.classList.add('hidden');
    } else {
      navSettings.classList.remove('hidden');
    }
  }

  // Manejar el banner de simulación de perfil
  const banner = document.getElementById('impersonation-banner');
  if (banner) {
    if (user.isSimulated) {
      banner.classList.remove('hidden');
      const nameEl = document.getElementById('simulated-user-name');
      const roleEl = document.getElementById('simulated-user-role');
      if (nameEl) nameEl.textContent = user.nombre || '';
      if (roleEl) roleEl.textContent = user.rol || '';
    } else {
      banner.classList.add('hidden');
    }
  }
}

async function startImpersonation(userId) {
  try {
    const res = await fetch('/api/admin/impersonate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ userId })
    });
    
    if (res.ok) {
      showToast('Simulación de perfil iniciada.');
      await checkAuth();
      // Forzar recarga de datos según el nuevo rol simulado
      await switchView('dashboard');
    } else {
      const data = await res.json();
      showToast(data.error || 'No se pudo iniciar la simulación.', 'error');
    }
  } catch (err) {
    console.error('Error al iniciar simulación:', err);
    showToast('Error de red al iniciar la simulación.', 'error');
  }
}
window.startImpersonation = startImpersonation;

async function stopImpersonation() {
  try {
    const res = await fetch('/api/admin/impersonate/stop', {
      method: 'POST'
    });
    
    if (res.ok) {
      showToast('Simulación de perfil finalizada.');
      await checkAuth();
      // Forzar recarga de datos según el rol real
      await switchView('dashboard');
    } else {
      showToast('No se pudo finalizar la simulación.', 'error');
    }
  } catch (err) {
    console.error('Error al detener simulación:', err);
    showToast('Error de red al finalizar la simulación.', 'error');
  }
}
window.stopImpersonation = stopImpersonation;

async function triggerSsoLogin() {
  const loginErrorEl = document.getElementById('login-error');
  const loginErrorTextEl = document.getElementById('login-error-text');
  const btn = document.getElementById('btn-sso-login');
  
  if (loginErrorEl) loginErrorEl.classList.add('hidden');

  let originalHtml = '';
  if (btn) {
    originalHtml = btn.innerHTML;
    btn.disabled = true;
    btn.classList.add('opacity-60', 'cursor-not-allowed');
    btn.innerHTML = `<i data-lucide="refresh-cw" class="h-4 w-4 animate-spin shrink-0"></i> <span>Iniciando sesión...</span>`;
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  }

  try {
    const res = await fetch('/api/auth/trigger-sso', { method: 'POST' });
    const data = await res.json();
    
    if (res.ok && data.success) {
      setCurrentUser(data.user);
      showToast('Sesión iniciada con éxito via SSO');
      
      const header = document.querySelector('header');
      if (header) header.classList.remove('hidden');
      
      updateHeaderUserSection();
      fetchAlertas();
      if (typeof initSessionTimeout === 'function') initSessionTimeout();
      await switchView('dashboard');
    } else {
      if (loginErrorEl && loginErrorTextEl) {
        const rawMsg = data.message || data.error || 'No se pudo iniciar sesión con Microsoft.';
        loginErrorTextEl.textContent = translateError(rawMsg);
        loginErrorEl.classList.remove('hidden');
      }
      if (btn) {
        btn.disabled = false;
        btn.classList.remove('opacity-60', 'cursor-not-allowed');
        btn.innerHTML = originalHtml;
        if (typeof lucide !== 'undefined') {
          lucide.createIcons();
        }
      }
    }
  } catch (err) {
    console.error('Error en SSO:', err);
    if (loginErrorEl && loginErrorTextEl) {
      loginErrorTextEl.textContent = translateError(err.message || 'Error de red al conectar con el inicio de sesión corporativo.');
      loginErrorEl.classList.remove('hidden');
    }
    if (btn) {
      btn.disabled = false;
      btn.classList.remove('opacity-60', 'cursor-not-allowed');
      btn.innerHTML = originalHtml;
      if (typeof lucide !== 'undefined') {
        lucide.createIcons();
      }
    }
  }
}

async function logout() {
  // Detener el timeout antes de cerrar sesión
  if (typeof destroySessionTimeout === 'function') destroySessionTimeout();
  // Detener la sincronización automática en segundo plano
  if (window.bgSyncInterval) {
    clearInterval(window.bgSyncInterval);
    window.bgSyncInterval = null;
  }
  try {
    const res = await fetch('/api/auth/logout', { method: 'POST' });
    if (res.ok) {
      setCurrentUser(null);
      showToast('Sesión cerrada');
      switchView('login');
    } else {
      showToast('Error al cerrar sesión', 'error');
    }
  } catch (err) {
    console.error('Error en logout:', err);
    showToast('Error de red al conectar con el servidor', 'error');
  }
}

/**
 * Función para iniciar la verificación automática de base de datos en segundo plano
 */
function initBackgroundSync() {
  if (window.bgSyncInterval) clearInterval(window.bgSyncInterval);

  const runSync = async () => {
    if (!getCurrentUser()) return;

    // 1. Mostrar estado "Actualizando..."
    updateCapsuleStatus('syncing');

    try {
      console.log('[Auto-Sync] Verificando nueva versión de base de datos...');
      const res = await fetch('/api/db/sync', { method: 'POST' });
      
      if (res.ok) {
        const data = await res.json();
        
        if (data.success && data.updated) {
          console.log('[Auto-Sync] ¡Base de datos actualizada con éxito!');
          showToast('Base de datos actualizada con nuevos registros.', 'success');
          
          // 2. Éxito
          updateCapsuleStatus('synced');
          
          if (typeof renderView === 'function') {
            renderView();
          }
        } else {
          updateCapsuleStatus('synced');
        }
      } else {
        updateCapsuleStatus('error');
      }
    } catch (err) {
      console.error('[Auto-Sync] Error en la verificación automática:', err);
      updateCapsuleStatus('error');
    }
  };

  // 1. Ejecutar una verificación inicial 2 segundos después de arrancar
  setTimeout(runSync, 2000);

  // 2. Ejecutar de forma periódica en segundo plano
  // Configurado a 5 minutos para producción
  const syncIntervalTime = 5 * 60 * 1000; 
  window.bgSyncInterval = setInterval(runSync, syncIntervalTime);
}

/**
 * Función para ejecutar la sincronización manual desde la cápsula de estado
 * @param {boolean} isManual - Parámetro isManual.
 */
async function runCapsuleSync(isManual = false) {
  if (!getCurrentUser()) return;
  
  // 1. Mostrar estado "Actualizando..."
  updateCapsuleStatus('syncing');
  
  const syncBtn = document.getElementById('btn-capsule-sync');
  const topbarBtn = document.getElementById('btn-topbar-sync');
  if (syncBtn) {
    syncBtn.disabled = true;
    syncBtn.classList.add('opacity-50', 'pointer-events-none');
  }
  if (topbarBtn) {
    topbarBtn.disabled = true;
    topbarBtn.classList.add('opacity-75', 'cursor-not-allowed');
    const icon = topbarBtn.querySelector('i');
    if (icon) icon.classList.add('animate-spin');
  }

  try {
    console.log('[Manual-Sync] Forzando sincronización de base de datos...');
    const res = await fetch('/api/db/sync', { method: 'POST' });
    
    if (res.ok) {
      const data = await res.json();
      
      if (data.success) {
        if (data.updated) {
          console.log('[Manual-Sync] ¡Base de datos actualizada con éxito!');
          showToast('Base de datos sincronizada con éxito.', 'success');
          updateCapsuleStatus('synced');
          
          if (typeof renderView === 'function') {
            renderView();
          }
        } else {
          console.log('[Manual-Sync] La base de datos ya está al día.');
          if (isManual) {
            showToast('La base de datos ya se encuentra al día.', 'info');
          }
          updateCapsuleStatus('synced');
        }
      } else {
        updateCapsuleStatus('error');
        if (isManual) showToast('Error al intentar sincronizar: ' + (data.error || 'Servicio no disponible'), 'error');
      }
    } else {
      updateCapsuleStatus('error');
      if (isManual) showToast('No se pudo establecer conexión con el servidor.', 'error');
    }
  } catch (err) {
    console.error('[Manual-Sync] Error en la sincronización manual:', err);
    updateCapsuleStatus('error');
    if (isManual) showToast('Error de red al intentar sincronizar.', 'error');
  } finally {
    if (syncBtn) {
      syncBtn.disabled = false;
      syncBtn.classList.remove('opacity-50', 'pointer-events-none');
    }
    if (topbarBtn) {
      topbarBtn.disabled = false;
      topbarBtn.classList.remove('opacity-75', 'cursor-not-allowed');
      const icon = topbarBtn.querySelector('i');
      if (icon) icon.classList.remove('animate-spin');
    }
  }
}
window.runCapsuleSync = runCapsuleSync;

/**
 * Función para sincronizar directamente con SharePoint desde el Topbar
 * @param {*} btnElement - Parámetro btnElement.
 */
async function sincronizarSharepoint(btnElement = null) {
  const topbarBtn = btnElement || document.getElementById('btn-topbar-sync');
  let originalText = 'Sincronizar SharePoint';

  if (topbarBtn) {
    topbarBtn.disabled = true;
    topbarBtn.classList.add('opacity-70', 'cursor-wait', 'pointer-events-none');
    topbarBtn.querySelectorAll('svg, i').forEach(el => el.classList.add('animate-spin'));
    const textSpan = topbarBtn.querySelector('span');
    if (textSpan) {
      originalText = textSpan.textContent;
      textSpan.textContent = 'Sincronizando...';
    }
  }

  updateCapsuleStatus('syncing');

  try {
    const fetchPromise = fetch('/api/admin/sincronizar-desde-sharepoint', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('TIMEOUT')), 45000);
    });

    const res = await Promise.race([fetchPromise, timeoutPromise]);
    const data = await res.json();

    if (res.ok && data.success) {
      if (typeof window.showToast === 'function') {
        window.showToast(data.message || 'Sincronización con SharePoint completada.', 'success');
      } else if (typeof showToast === 'function') {
        showToast(data.message || 'Sincronización con SharePoint completada.', 'success');
      }
      updateCapsuleStatus('synced');
      window.lastCloudCheckTimestamp = Date.now();
      updateCloudCheckDisplay();

      // Detener animación antes de refrescar la vista para evitar que Lucide clone 'animate-spin'
      const btnToClean = btnElement || document.getElementById('btn-topbar-sync');
      if (btnToClean) {
        btnToClean.querySelectorAll('svg, i').forEach(el => el.classList.remove('animate-spin'));
      }

      // Si hubo actualización de datos, refrescar la vista activa
      if (data.updated && typeof window.switchView === 'function' && window.currentView) {
        await window.switchView(window.currentView);
      }
    } else {
      updateCapsuleStatus('error');
      const errorMsg = data.error || 'Error al sincronizar con SharePoint.';
      if (typeof window.showToast === 'function') {
        window.showToast(errorMsg, 'error');
      } else if (typeof showToast === 'function') {
        showToast(errorMsg, 'error');
      }
    }
  } catch (err) {
    console.error('[sincronizarSharepoint] Error en sincronización con SharePoint:', err);
    updateCapsuleStatus('error');
    const msg = err && err.message === 'TIMEOUT'
      ? 'La sincronización con SharePoint tardó demasiado tiempo y se canceló por seguridad.'
      : 'Error al conectar con el servidor para la sincronización.';
    if (typeof window.showToast === 'function') {
      window.showToast(msg, 'error');
    } else if (typeof showToast === 'function') {
      showToast(msg, 'error');
    }
  } finally {
    const finalBtn = btnElement || document.getElementById('btn-topbar-sync');
    if (finalBtn) {
      finalBtn.disabled = false;
      finalBtn.classList.remove('opacity-70', 'cursor-wait', 'pointer-events-none');
      finalBtn.querySelectorAll('svg, i').forEach(el => el.classList.remove('animate-spin'));
      const textSpan = finalBtn.querySelector('span');
      if (textSpan) textSpan.textContent = originalText;
    }
  }
}
window.sincronizarSharepoint = sincronizarSharepoint;


/**
 * Obtener y mostrar la versión de la app desde el backend (package.json)
 */
async function fetchAppVersion() {
  try {
    const response = await window.api.invokeRoute({
      url: '/api/app-version',
      method: 'GET'
    });
    if (response && response.status === 200 && response.data) {
      const versionEl = document.getElementById('app-version');
      if (versionEl) {
        versionEl.textContent = `v${response.data.version}`;
      }
      const devTag = document.getElementById('capsule-dev-tag');
      if (devTag) {
        if (response.data.isDev) {
          devTag.classList.remove('hidden');
        } else {
          devTag.classList.add('hidden');
        }
      }
    }
  } catch (err) {
    console.error('Error al cargar la versión de la app:', err);
  }
}

/**
 * Reloj digital (desactivado para reducir distracciones visuales)
 */
function startLiveClock() {}



// Exposición canónica a window para compatibilidad con eventos DOM y app.js
window.checkAuth = checkAuth;
window.updateHeaderUserSection = updateHeaderUserSection;
window.startImpersonation = startImpersonation;
window.stopImpersonation = stopImpersonation;
window.triggerSsoLogin = triggerSsoLogin;
window.logout = logout;
window.initBackgroundSync = initBackgroundSync;
window.runCapsuleSync = runCapsuleSync;
window.fetchAndUpdateDbTimestamp = fetchAndUpdateDbTimestamp;
window.fetchAppVersion = fetchAppVersion;
window.startLiveClock = startLiveClock;
window.updateCapsuleStatus = updateCapsuleStatus;
window.updateCloudCheckDisplay = updateCloudCheckDisplay;
window.getEffectiveLastUpdate = getEffectiveLastUpdate;
window.parseTimestampToMs = parseTimestampToMs;

export {
  checkAuth,
  updateHeaderUserSection,
  startImpersonation,
  stopImpersonation,
  triggerSsoLogin,
  logout,
  initBackgroundSync,
  runCapsuleSync,
  sincronizarSharepoint,
  fetchAndUpdateDbTimestamp,
  fetchAppVersion,
  startLiveClock,
  updateCapsuleStatus,
  updateCloudCheckDisplay,
  getEffectiveLastUpdate,
  parseTimestampToMs
};
