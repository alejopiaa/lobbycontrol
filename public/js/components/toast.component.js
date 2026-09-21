/**
 * ToastComponent - Sistema desacoplado de notificaciones flotantes tipadas
 */

import { translateError } from '../utils/error-translator.js';

/**
 * Descartar notificación Toast con animación de salida suave
 * @param {*} element - Parámetro element.
 */
function dismissToast(element) {
  if (!element) return;
  const t = element.closest('.toast-notification-item, [data-toast-item]') || element;
  if (t) {
    t.classList.remove('toast-animate-in');
    t.classList.add('toast-animate-out');
    setTimeout(() => {
      if (t.parentNode) t.parentNode.removeChild(t);
    }, 190);
  }
}
window.dismissToast = dismissToast;

/**
 * Mostrar notificaciones Toast
 * @param {*} message - Parámetro message.
 * @param {string} type - Parámetro type.
 * @param {Object} options - Parámetro options.
 */
function showToast(message, type = 'success', options = {}) {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  const isError = type === 'error';
  
  let displayMessage = message;
  let errorDetails = options.details || '';
  
  if (isError) {
    displayMessage = translateError(message);
    
    const codeMatch = displayMessage.match(/\[(ERR-\w+-\d+)\]/);
    const code = codeMatch ? codeMatch[1] : '';
    
    if (code === 'ERR-GEN-999' || code === 'ERR-DB-500') {
      const now = new Date();
      const d = String(now.getDate()).padStart(2, '0');
      const m = String(now.getMonth() + 1).padStart(2, '0');
      const y = now.getFullYear();
      const hh = String(now.getHours()).padStart(2, '0');
      const min = String(now.getMinutes()).padStart(2, '0');
      const ss = String(now.getSeconds()).padStart(2, '0');
      const timestamp = `${d}-${m}-${y} ${hh}:${min}:${ss}`;

      errorDetails = `================ LOBBYCONTROL ERROR REPORT ================
Fecha/Hora:     ${timestamp}
Código Soporte: ${code}
Mensaje:        ${displayMessage}
-----------------------------------------------------------
Detalle Técnico:
${message}
===========================================================`;
    }
  }

  const persistent = options.persistent !== undefined ? options.persistent : isError;

  const borderTextClass = type === 'success' 
    ? 'border-emerald-500/30 text-emerald-300' 
    : (type === 'warning' ? 'border-amber-500/30 text-amber-300' : 'border-rose-500/30 text-rose-300');

  toast.className = `toast-notification-item flex items-center justify-between gap-3 px-4 py-3 rounded-2xl shadow-xl text-sm toast-animate-in glass-card border ${borderTextClass}`;
  toast.setAttribute('data-toast-item', 'true');
  toast.style.position = 'relative';
  toast.style.overflow = 'hidden';
  
  const icon = type === 'success' ? 'check-circle' : (type === 'warning' ? 'alert-triangle' : 'alert-circle');
  const iconColor = type === 'success' ? 'text-emerald-400' : (type === 'warning' ? 'text-amber-400' : 'text-rose-400');
  
  let htmlContent = `
    <div class="flex items-center gap-3 pr-2">
      <i data-lucide="${icon}" class="h-5 w-5 shrink-0 ${iconColor}"></i>
      <span class="break-words text-left font-medium">${displayMessage}</span>
    </div>
    <div class="flex items-center gap-2 shrink-0">
  `;

  if (isError && errorDetails) {
    const escapedDetails = String(errorDetails).replace(/'/g, "\\'").replace(/"/g, '\\"').replace(/\n/g, '\\n');
    htmlContent += `
      <button onclick="navigator.clipboard.writeText('${escapedDetails}'); showToast('Detalles copiados', 'success', { persistent: false });" 
              class="px-2 py-1 bg-rose-950/40 hover:bg-rose-900/60 rounded text-[10px] font-semibold text-rose-300 transition-colors border border-rose-800/40 active:scale-[0.98] cursor-pointer">
        Copiar detalles
      </button>
    `;
  }

  if (persistent) {
    htmlContent += `
      <button onclick="dismissToast(this)" 
              class="text-text-tertiary hover:text-text-primary transition-colors bg-transparent border-none cursor-pointer p-0.5 flex items-center justify-center"
              title="Cerrar notificación">
        <i data-lucide="x" class="h-4 w-4"></i>
      </button>
    `;
  }

  htmlContent += `</div>`;

  if (!persistent) {
    const progressBarColor = type === 'success' ? '#10b981' : (type === 'warning' ? '#f59e0b' : '#f43f5e');
    htmlContent += `
      <div style="position: absolute; bottom: 0; left: 0; right: 0; width: 100%; height: 3px; overflow: hidden; pointer-events: none;">
        <div class="toast-progress-bar" style="height: 100%; background-color: ${progressBarColor};"></div>
      </div>
    `;
  }

  toast.innerHTML = htmlContent;
  container.appendChild(toast);
  lucide.createIcons();

  if (!persistent) {
    setTimeout(() => {
      dismissToast(toast);
    }, 3800);
  }
}

window.showToast = showToast;

export {
  dismissToast,
  showToast
};
