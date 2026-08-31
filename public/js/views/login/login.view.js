/**
 * LoginView - Vista modular de autenticación
 */
import { AuthService } from '../../services/auth.service.js';
import { appRouter } from '../../core/router.js';
import { translateError } from '../../utils/error-translator.js';
import { showToast } from '../../components/toast.component.js';

export const LoginView = {
  mount(container) {
    container.innerHTML = `
      <div class="min-h-[85vh] flex items-center justify-center p-4">
        <div class="glass-card w-full max-w-md p-8 rounded-3xl space-y-6 shadow-2xl border border-border-ui modal-animate-in">
          <div class="text-center space-y-2">
            <div class="h-16 w-16 mx-auto rounded-2xl bg-brand-500/10 text-brand-600 dark:text-brand-400 flex items-center justify-center shadow-inner">
              <i data-lucide="shield-check" class="h-8 w-8"></i>
            </div>
            <h1 class="text-2xl font-extrabold text-heading">LobbyControl</h1>
            <p class="text-xs text-body-muted font-medium">Sistema Local de Gestión de Audiencias y Ley de Lobby</p>
          </div>

          <div id="login-error-container" class="hidden p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-semibold">
            <span id="login-error-text"></span>
          </div>

          <form id="form-login-local" class="space-y-4">
            <div class="space-y-1.5">
              <label class="text-xs font-bold text-text-secondary uppercase tracking-wider">Usuario</label>
              <input type="text" id="login-username" required autocomplete="username"
                class="w-full px-4 py-2.5 rounded-xl border border-border-ui bg-bg-card text-text-primary text-xs focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all placeholder:text-text-tertiary"
                placeholder="Ingresa tu usuario institucional" />
            </div>

            <div class="space-y-1.5">
              <label class="text-xs font-bold text-text-secondary uppercase tracking-wider">Contraseña</label>
              <input type="password" id="login-password" required autocomplete="current-password"
                class="w-full px-4 py-2.5 rounded-xl border border-border-ui bg-bg-card text-text-primary text-xs focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all placeholder:text-text-tertiary"
                placeholder="••••••••••••" />
            </div>

            <button type="submit" id="btn-login-local" class="w-full py-3 rounded-xl text-xs font-bold btn-primary text-white shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer">
              <span>Iniciar Sesión</span>
              <i data-lucide="arrow-right" class="h-4 w-4"></i>
            </button>
          </form>

          <div class="relative flex py-2 items-center">
            <div class="flex-grow border-t border-border-ui"></div>
            <span class="flex-shrink mx-4 text-[10px] uppercase font-bold text-text-tertiary">O continuar con</span>
            <div class="flex-grow border-t border-border-ui"></div>
          </div>

          <button type="button" id="btn-login-microsoft" class="w-full py-3 rounded-xl text-xs font-bold btn-secondary flex items-center justify-center gap-2 transition-all cursor-pointer">
            <svg class="h-4 w-4" viewBox="0 0 21 21"><path fill="#f25022" d="M1 1h9v9H1z"/><path fill="#00a4ef" d="M1 11h9v9H1z"/><path fill="#7fba00" d="M11 1h9v9h-9z"/><path fill="#ffb900" d="M11 11h9v9h-9z"/></svg>
            <span>Microsoft 365</span>
          </button>
        </div>
      </div>
    `;

    this.bindEvents(container);
  },

  bindEvents(container) {
    const form = container.querySelector('#form-login-local');
    const btnMs = container.querySelector('#btn-login-microsoft');
    const errContainer = container.querySelector('#login-error-container');
    const errText = container.querySelector('#login-error-text');

    const showError = (msg) => {
      if (errContainer && errText) {
        errText.textContent = translateError(msg);
        errContainer.classList.remove('hidden');
      }
    };

    if (form) {
      form.onsubmit = async (e) => {
        e.preventDefault();
        const username = container.querySelector('#login-username').value.trim();
        const password = container.querySelector('#login-password').value;
        const submitBtn = container.querySelector('#btn-login-local');

        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.classList.add('opacity-60', 'cursor-not-allowed');
        }

        try {
          const res = await AuthService.loginLocal(username, password);
          if (res.success) {
            showToast('Bienvenido a LobbyControl', 'success');
            await appRouter.navigate('dashboard');
          } else {
            showError(res.message);
          }
        } catch (err) {
          showError(err.message);
        } finally {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.classList.remove('opacity-60', 'cursor-not-allowed');
          }
        }
      };
    }

    if (btnMs) {
      btnMs.onclick = async () => {
        btnMs.disabled = true;
        btnMs.classList.add('opacity-60', 'cursor-not-allowed');
        try {
          const res = await AuthService.loginMicrosoft();
          if (res.success) {
            showToast('Sesión iniciada con Microsoft', 'success');
            await appRouter.navigate('dashboard');
          } else {
            showError(res.message);
          }
        } catch (err) {
          showError(err.message);
        } finally {
          btnMs.disabled = false;
          btnMs.classList.remove('opacity-60', 'cursor-not-allowed');
        }
      };
    }
  },

  unmount() {}
};
