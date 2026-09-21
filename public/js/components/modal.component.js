/**
 * ModalComponent - Manejador de modales base y confirmaciones asíncronas con Promesas
 */
import { sanitizeHtml } from '../utils/formatters.js';

export function closeModal() {
  const modal = document.getElementById('modal-container');
  if (modal && !modal.classList.contains('hidden')) {
    const card = modal.querySelector('.glass-card');
    if (card) {
      card.classList.remove('modal-animate-in');
      card.classList.add('modal-animate-out');
      modal.classList.add('backdrop-animate-out');
      setTimeout(() => {
        modal.classList.add('hidden');
        modal.classList.remove('backdrop-animate-out');
        modal.innerHTML = '';
      }, 130);
    } else {
      modal.classList.add('hidden');
      modal.innerHTML = '';
    }
  }
}

export function openConfirmModal(title, message, onConfirmCallback = null) {
  return new Promise((resolve) => {
    const modal = document.getElementById('modal-container');
    if (!modal) {
      resolve(false);
      return;
    }

    modal.classList.remove('hidden');
    modal.classList.add('backdrop-animate-in');

    modal.innerHTML = `
      <div class="glass-card w-full max-w-md p-6 rounded-3xl space-y-5 shadow-2xl relative modal-animate-in border border-border-ui">
        <div class="flex items-center gap-3">
          <div class="h-10 w-10 rounded-xl bg-amber-500/10 text-amber-500 dark:text-amber-400 flex items-center justify-center shrink-0">
            <i data-lucide="alert-triangle" class="h-5 w-5"></i>
          </div>
          <div>
            <h3 class="text-sm font-bold text-heading uppercase tracking-wider">${sanitizeHtml(title)}</h3>
          </div>
        </div>

        <p class="text-xs text-body-muted leading-relaxed">${sanitizeHtml(message)}</p>

        <div class="flex justify-end gap-3 pt-2">
          <button type="button" id="btn-cancel-modal-action" class="px-4 py-2.5 rounded-xl text-xs font-semibold btn-secondary cursor-pointer">
            Cancelar
          </button>
          <button type="button" id="btn-confirm-modal-action" class="px-4 py-2.5 rounded-xl text-xs font-bold btn-primary text-white cursor-pointer">
            Confirmar
          </button>
        </div>
      </div>
    `;

    const btnConfirm = document.getElementById('btn-confirm-modal-action');
    const btnCancel = document.getElementById('btn-cancel-modal-action');

    if (btnConfirm) {
      btnConfirm.onclick = async () => {
        closeModal();
        if (typeof onConfirmCallback === 'function') {
          await onConfirmCallback();
        }
        resolve(true);
      };
    }

    if (btnCancel) {
      btnCancel.onclick = () => {
        closeModal();
        resolve(false);
      };
    }

    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }
  });
}

/**
 * Eliminación genérica de registros con confirmación modal
 * @param {string} viewName - Parámetro viewName.
 * @param {string|number} id - Parámetro id.
 */
export async function deleteRecord(viewName, id) {
  openConfirmModal(
    'Eliminar Registro',
    '¿Estás seguro de que deseas eliminar este registro de la base de datos local? Esta acción no se puede deshacer.',
    async () => {
      try {
        let endpoint = `/api/${viewName}/${id}`;
        if (viewName === 'solicitudes_sh') endpoint = `/api/solicitudes/${id}`;
        
        const res = await fetch(endpoint, {
          method: 'DELETE'
        });

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || 'No se pudo eliminar el registro.');
        }

        if (typeof window.showToast === 'function') {
          window.showToast('Registro eliminado con éxito.');
        }
        if (typeof window.fetchAndUpdateDbTimestamp === 'function') {
          window.fetchAndUpdateDbTimestamp();
        }
        if (typeof window.switchView === 'function') {
          window.switchView(window.currentView || viewName);
        }
      } catch (err) {
        if (typeof window.showToast === 'function') {
          window.showToast(err.message, 'error');
        }
      }
    }
  );
}

// Exposición canónica a window para eventos inline y llamadas DOM
window.closeModal = closeModal;
window.openConfirmModal = openConfirmModal;
window.deleteRecord = deleteRecord;

// Atajos globales: Escape y Clic en backdrop para cerrar modales
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const modal = document.getElementById('modal-container');
    if (modal && !modal.classList.contains('hidden')) {
      closeModal();
    }
  }
});

document.addEventListener('click', (e) => {
  const modal = document.getElementById('modal-container');
  if (modal && !modal.classList.contains('hidden') && e.target === modal) {
    closeModal();
  }
});
