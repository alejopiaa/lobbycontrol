/**
 * LoginView - Vista modular de autenticación corporativa Microsoft 365 (SSO)
 */
import { AuthService } from '../../services/auth.service.js';
import { appRouter } from '../../core/router.js';
import { showToast } from '../../components/toast.component.js';

export const LoginView = {
  mount(container) {
    container.innerHTML = `
      <div class="h-full w-full min-h-[85vh] flex items-center justify-center p-4">
        <div class="glass-card w-full max-w-md p-8 rounded-3xl shadow-2xl border border-border-ui space-y-6 relative overflow-hidden animate-fade-in">
          <button id="login-theme-toggle" type="button" class="absolute top-4 right-4 h-8 w-8 rounded-xl flex items-center justify-center border border-border-ui hover:border-border-ui bg-bg-main text-text-secondary hover:text-text-primary transition-all duration-200 cursor-pointer" title="Cambiar de Modo">
            <i data-lucide="sun" class="h-4 w-4"></i>
          </button>

          <div class="absolute -top-10 -left-10 w-40 h-40 bg-brand-600/10 rounded-full blur-3xl pointer-events-none"></div>
          <div class="absolute -bottom-10 -right-10 w-40 h-40 bg-brand-500/5 rounded-full blur-3xl pointer-events-none"></div>

          <div class="flex flex-col items-center text-center space-y-3 relative z-10">
            <img src="/logo_secum.png" alt="Secretaría Municipal Maipú" class="h-20 w-auto object-contain mb-2">
            <div>
              <h1 class="text-2xl font-extrabold text-text-primary tracking-tight">LobbyControl</h1>
              <p class="text-xs text-body-muted mt-1 font-medium">Gestión de Audiencias - Ley N° 20.730</p>
            </div>
          </div>

          <div id="login-error" class="hidden px-4 py-3 rounded-xl bg-rose-950/40 border border-rose-900/60 text-rose-300 text-xs font-semibold flex items-center gap-2">
            <i data-lucide="alert-circle" class="h-4 w-4 shrink-0"></i>
            <span id="login-error-text">Credenciales inválidas. Inténtelo de nuevo.</span>
          </div>

          <div id="sso-container" class="space-y-4 relative z-10 text-center">
            <button id="btn-sso-login" type="button" 
                    class="w-full py-3 btn-primary rounded-xl text-xs font-bold transition-all hover:shadow-lg mt-2 flex items-center justify-center gap-2.5 active:scale-[0.98] cursor-pointer">
              <svg style="width: 18px; height: 18px; flex-shrink: 0;" viewBox="0 0 23 23" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M0 0H11V11H0V0Z" fill="#F25022"/>
                <path d="M12 0H23V11H12V0Z" fill="#7FBA00"/>
                <path d="M0 12H11V23H0V12Z" fill="#00A4EF"/>
                <path d="M12 12H23V23H12V12Z" fill="#FFB900"/>
              </svg>
              <span id="btn-sso-text">Iniciar sesión con Microsoft 365</span>
            </button>
          </div>

          <div class="text-center text-[10px] text-body-muted pt-2 relative z-10 border-t border-border-ui">
            <p>LobbyControl - Gestión de Audiencias</p>
          </div>
        </div>
      </div>
    `;

    this.bindEvents(container);

    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }
  },

  bindEvents(container) {
    const btnSso = container.querySelector('#btn-sso-login');
    const themeBtn = container.querySelector('#login-theme-toggle');

    if (themeBtn) {
      themeBtn.onclick = () => {
        if (typeof window.toggleTheme === 'function') {
          window.toggleTheme();
        }
      };
    }

    if (btnSso) {
      btnSso.onclick = async () => {
        const errorEl = container.querySelector('#login-error');
        const errorTextEl = container.querySelector('#login-error-text');
        if (errorEl) errorEl.classList.add('hidden');

        btnSso.disabled = true;
        btnSso.classList.add('opacity-60', 'cursor-not-allowed');
        const originalHtml = btnSso.innerHTML;
        btnSso.innerHTML = `<i data-lucide="refresh-cw" class="h-4 w-4 animate-spin shrink-0"></i> <span>Iniciando sesión...</span>`;
        if (window.lucide && typeof window.lucide.createIcons === 'function') {
          window.lucide.createIcons();
        }

        try {
          const res = await AuthService.loginMicrosoft();
          if (res && res.success) {
            showToast('Sesión iniciada con Microsoft 365');
            if (typeof window.switchView === 'function') {
              await window.switchView('dashboard');
            } else {
              await appRouter.navigate('dashboard');
            }
          } else {
            const msg = (res && (res.message || res.error)) || 'No se pudo iniciar sesión con Microsoft.';
            if (errorEl && errorTextEl) {
              errorTextEl.textContent = msg;
              errorEl.classList.remove('hidden');
            } else {
              showToast(msg, 'error');
            }
          }
        } catch (err) {
          console.error('[LoginView] Error en login Microsoft 365:', err);
          if (errorEl && errorTextEl) {
            errorTextEl.textContent = err.message || 'Error de conexión.';
            errorEl.classList.remove('hidden');
          } else {
            showToast('Error de conexión al iniciar sesión.', 'error');
          }
        } finally {
          btnSso.disabled = false;
          btnSso.classList.remove('opacity-60', 'cursor-not-allowed');
          btnSso.innerHTML = originalHtml;
          if (window.lucide && typeof window.lucide.createIcons === 'function') {
            window.lucide.createIcons();
          }
        }
      };
    }
  },

  unmount() {}
};

export function renderLogin(container) {
  return LoginView.mount(container);
}

if (typeof window !== 'undefined') {
  window.LoginView = LoginView;
  window.renderLogin = renderLogin;
}
