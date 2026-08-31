/**
 * ToastComponent - Sistema desacoplado de notificaciones flotantes tipadas
 */
export function showToast(message, type = 'info', duration = 3500) {
  const container = document.getElementById('toast-container');
  if (!container) {
    console.log(`[${type.toUpperCase()}] ${message}`);
    return;
  }

  const toast = document.createElement('div');
  
  const typeConfig = {
    success: { icon: 'check-circle', border: 'border-emerald-500/30', bg: 'bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400' },
    error: { icon: 'x-circle', border: 'border-rose-500/30', bg: 'bg-rose-500/10', text: 'text-rose-600 dark:text-rose-400' },
    warning: { icon: 'alert-triangle', border: 'border-amber-500/30', bg: 'bg-amber-500/10', text: 'text-amber-600 dark:text-amber-400' },
    info: { icon: 'info', border: 'border-brand-500/30', bg: 'bg-brand-500/10', text: 'text-brand-600 dark:text-brand-400' }
  };

  const cfg = typeConfig[type] || typeConfig.info;

  toast.className = `glass-card flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl border ${cfg.border} modal-animate-in max-w-md pointer-events-auto`;
  toast.innerHTML = `
    <div class="h-8 w-8 rounded-xl ${cfg.bg} ${cfg.text} flex items-center justify-center shrink-0">
      <i data-lucide="${cfg.icon}" class="h-4 w-4"></i>
    </div>
    <span class="text-xs font-semibold text-text-primary flex-1">${message}</span>
  `;

  container.appendChild(toast);

  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }

  setTimeout(() => {
    toast.classList.remove('modal-animate-in');
    toast.classList.add('modal-animate-out');
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 130);
  }, duration);
}
