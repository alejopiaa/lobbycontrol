/**
 * session-timeout.js
 * Módulo de cierre de sesión automático por inactividad.
 *
 * Flujo:
 *  - 55 min sin actividad → Modal de advertencia con cuenta regresiva de 5 min
 *  - Usuario hace clic en "Extender" → Se renuevan los 60 min
 *  - Cuenta regresiva llega a 0 → Cierre de sesión automático
 */

(function () {
  'use strict';

  // ─── Configuración ────────────────────────────────────────────────────────
  const TOTAL_TIMEOUT_MS    = 30 * 60 * 1000; // 30 minutos de inactividad total
  const WARNING_BEFORE_MS   =  5 * 60 * 1000; // Advertir 5 min antes del cierre
  const WARN_AT_MS = TOTAL_TIMEOUT_MS - WARNING_BEFORE_MS;
  const EXTEND_MINUTES      = 30; // Minutos que agrega el botón "Extender"

  // ─── Estado interno ───────────────────────────────────────────────────────
  let warningTimer    = null; // Timer para mostrar la advertencia
  let countdownTimer  = null; // Intervalo del contador regresivo
  let secondsLeft     = WARNING_BEFORE_MS / 1000; // Segundos en la cuenta regresiva
  let warningVisible  = false;
  let lastServerExtend = Date.now(); // Timestamp de la última renovación en el servidor
  const MIN_EXTEND_INTERVAL_MS = 5 * 60 * 1000; // Enviar ping al servidor máximo cada 5 minutos

  // ─── Eventos que reinician el temporizador ────────────────────────────────
  const ACTIVITY_EVENTS = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];

  // ─── Extender sesión en el servidor silenciosamente (con throttle de 5 min) ────
  async function extendSessionOnServer() {
    const now = Date.now();
    if (now - lastServerExtend < MIN_EXTEND_INTERVAL_MS) return;

    try {
      const res = await fetch('/api/auth/extend', { method: 'POST' });
      if (res.ok) {
        lastServerExtend = now;
        console.log('[SessionTimeout] Sesión extendida en el servidor por actividad del usuario.');
      }
    } catch (err) {
      console.error('[SessionTimeout] Error al extender sesión por actividad:', err);
    }
  }

  // ─── Iniciar / reiniciar el temporizador de inactividad ──────────────────
  function resetTimer() {
    // Si la advertencia ya está visible, no reiniciar por movimiento de ratón
    if (warningVisible) return;

    clearTimeout(warningTimer);
    warningTimer = setTimeout(showWarning, WARN_AT_MS);

    // Intentar extender la sesión en el servidor
    extendSessionOnServer();
  }

  // ─── Mostrar modal de advertencia ─────────────────────────────────────────
  function showWarning() {
    // No mostrar si no hay sesión activa (usuario en login)
    if (!currentUser) return;

    warningVisible  = true;
    secondsLeft     = WARNING_BEFORE_MS / 1000;

    // Detener escucha de actividad para que el timer no se resetee
    ACTIVITY_EVENTS.forEach(ev => document.removeEventListener(ev, resetTimer, true));

    renderWarningModal();
    startCountdown();
  }

  // ─── Renderizar el modal ──────────────────────────────────────────────────
  function renderWarningModal() {
    let overlay = document.getElementById('session-timeout-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'session-timeout-overlay';
      document.body.appendChild(overlay);
    }

    overlay.innerHTML = `
      <div class="session-timeout-backdrop"></div>
      <div class="session-timeout-modal" role="alertdialog" aria-modal="true" aria-labelledby="sto-title">
        
        <!-- Ícono animado -->
        <div class="sto-icon-wrap">
          <div class="sto-icon-ring"></div>
          <div class="sto-icon-ring sto-icon-ring-2"></div>
          <i data-lucide="clock" class="sto-icon"></i>
        </div>

        <!-- Texto -->
        <h2 id="sto-title" class="sto-title">Sesión por expirar</h2>
        <p class="sto-body">
          Por inactividad, tu sesión se cerrará automáticamente en:
        </p>

        <!-- Cuenta regresiva -->
        <div class="sto-countdown" id="sto-countdown" aria-live="polite">
          <span id="sto-minutes">04</span><span class="sto-sep">:</span><span id="sto-seconds">59</span>
        </div>

        <!-- Barra de progreso -->
        <div class="sto-progress-track">
          <div class="sto-progress-bar" id="sto-progress-bar"></div>
        </div>

        <!-- Acciones -->
        <div class="sto-actions">
          <button id="sto-btn-extend" class="sto-btn-primary" onclick="sessionTimeoutExtend()">
            <i data-lucide="refresh-cw" class="h-4 w-4"></i>
            Extender ${EXTEND_MINUTES} minutos
          </button>
          <button id="sto-btn-logout" class="sto-btn-secondary" onclick="sessionTimeoutLogout()">
            <i data-lucide="log-out" class="h-4 w-4"></i>
            Cerrar sesión ahora
          </button>
        </div>
      </div>
    `;

    overlay.style.display = 'flex';

    // Inicializar íconos lucide dentro del modal
    if (window.lucide) lucide.createIcons();
    updateCountdownDisplay();
  }

  // ─── Iniciar la cuenta regresiva ──────────────────────────────────────────
  function startCountdown() {
    clearInterval(countdownTimer);
    countdownTimer = setInterval(() => {
      secondsLeft--;
      updateCountdownDisplay();

      if (secondsLeft <= 0) {
        clearInterval(countdownTimer);
        sessionTimeoutLogout();
      }
    }, 1000);
  }

  // ─── Actualizar la UI del contador ───────────────────────────────────────
  function updateCountdownDisplay() {
    const minEl = document.getElementById('sto-minutes');
    const secEl = document.getElementById('sto-seconds');
    const barEl = document.getElementById('sto-progress-bar');

    if (!minEl || !secEl) return;

    const mins = Math.floor(Math.max(0, secondsLeft) / 60);
    const secs = Math.max(0, secondsLeft) % 60;

    minEl.textContent = String(mins).padStart(2, '0');
    secEl.textContent = String(secs).padStart(2, '0');

    // Barra de progreso (va de 100% a 0% mientras baja el tiempo)
    if (barEl) {
      const pct = (secondsLeft / (WARNING_BEFORE_MS / 1000)) * 100;
      barEl.style.width = pct + '%';
      // Color cambia según urgencia
      if (pct > 50) {
        barEl.style.background = 'var(--color-ok, #22c55e)';
      } else if (pct > 20) {
        barEl.style.background = 'var(--color-warn, #f59e0b)';
      } else {
        barEl.style.background = 'var(--color-danger, #ef4444)';
      }
    }

    // Parpadeo urgente cuando quedan menos de 60 segundos
    const modal = document.querySelector('.session-timeout-modal');
    if (modal) {
      if (secondsLeft <= 60) {
        modal.classList.add('sto-urgent');
      }
    }
  }

  // ─── Extensión de sesión (botón "Extender") ───────────────────────────────
  window.sessionTimeoutExtend = async function () {
    try {
      const res = await fetch('/api/auth/extend', { method: 'POST' });
      if (!res.ok) throw new Error('No se pudo extender la sesión.');

      hideWarning();
      // Reiniciar el timer con los nuevos 30 minutos
      initSessionTimeout();
      if (window.showToast) showToast('Sesión extendida 30 minutos más.', 'success');
    } catch (err) {
      console.error('Error extendiendo sesión:', err);
      sessionTimeoutLogout();
    }
  };

  // ─── Cierre de sesión (manual o automático) ───────────────────────────────
  window.sessionTimeoutLogout = async function () {
    clearTimeout(warningTimer);
    clearInterval(countdownTimer);

    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (_) { /* ignorar */ }

    // Limpiar estado de la app y redirigir al login
    if (typeof currentUser !== 'undefined') currentUser = null;
    if (typeof switchView === 'function') {
      hideWarning();
      switchView('login');
      if (window.showToast) showToast('Sesión cerrada por inactividad.', 'error');
    } else {
      window.location.reload();
    }
  };

  // ─── Ocultar el modal ────────────────────────────────────────────────────
  function hideWarning() {
    warningVisible = false;
    clearInterval(countdownTimer);
    const overlay = document.getElementById('session-timeout-overlay');
    if (overlay) overlay.style.display = 'none';
  }

  // ─── Inicializar el módulo ────────────────────────────────────────────────
  function initSessionTimeout() {
    clearTimeout(warningTimer);
    clearInterval(countdownTimer);
    warningVisible = false;
    lastServerExtend = Date.now(); // Resetear el timestamp de control

    // Escuchar actividad del usuario
    ACTIVITY_EVENTS.forEach(ev => {
      document.removeEventListener(ev, resetTimer, true);
      document.addEventListener(ev, resetTimer, true);
    });

    // Arrancar el timer
    warningTimer = setTimeout(showWarning, WARN_AT_MS);
  }

  // Exponer para que app.js lo llame al iniciar sesión
  window.initSessionTimeout  = initSessionTimeout;
  window.destroySessionTimeout = function () {
    clearTimeout(warningTimer);
    clearInterval(countdownTimer);
    ACTIVITY_EVENTS.forEach(ev => document.removeEventListener(ev, resetTimer, true));
    hideWarning();
  };

  // Función de prueba — solo para desarrollo
  // Uso desde consola del navegador: sessionTimeoutTest()
  window.sessionTimeoutTest = function () {
    clearTimeout(warningTimer);
    clearInterval(countdownTimer);
    showWarning();
  };

})();
