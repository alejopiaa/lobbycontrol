/**
 * perfil.modal.js - Modal y gestión de edición de perfil propio de usuario
 * Desacoplado de app.js para arquitectura modular ESM.
 */

import { showToast } from '../../components/toast.component.js';
import { closeModal } from '../../components/modal.component.js';

function openProfileModal() {
  if (!currentUser) return;
  const modal = document.getElementById('modal-container');
  if (!modal) return;
  modal.classList.remove('hidden');

  const isAdmin = currentUser.rol === 'Administrador';

  modal.innerHTML = `
    <div class="glass-card w-full max-w-md p-6 rounded-2xl space-y-6 shadow-2xl relative animate-fade-in">
      <div class="absolute -top-10 -left-10 w-24 h-24 bg-brand-600/10 rounded-full blur-2xl pointer-events-none"></div>
      <div class="absolute -bottom-10 -right-10 w-24 h-24 bg-brand-500/5 rounded-full blur-2xl pointer-events-none"></div>

      <div>
        <h3 class="text-lg font-bold text-heading">Mi Perfil</h3>
        <p class="text-xs text-body-muted">Visualiza y edita los datos de tu cuenta personal.</p>
      </div>

      <form id="profile-form" onsubmit="saveProfile(event)" class="space-y-4">
        <!-- NOMBRE -->
        <div class="space-y-1">
          <label for="profile-nombre" class="text-[10px] font-bold text-body-muted uppercase">Nombre Completo</label>
          <input type="text" id="profile-nombre" aria-label="Nombre Completo" value="${currentUser.nombre || ''}" 
                 ${isAdmin ? 'required' : 'readonly'} 
                 class="w-full px-3 py-2 rounded-xl text-xs glass-input ${isAdmin ? 'text-text-secondary placeholder:text-text-tertiary' : 'glass-input-disabled cursor-not-allowed'}">
        </div>

        <!-- RUT -->
        <div class="space-y-1">
          <label for="profile-rut" class="text-[10px] font-bold text-body-muted uppercase">RUT</label>
          <input type="text" id="profile-rut" aria-label="RUT" value="${currentUser.rut || ''}" placeholder="12.345.678-9"
                 ${isAdmin ? '' : 'readonly'} 
                 class="w-full px-3 py-2 rounded-xl text-xs glass-input ${isAdmin ? 'text-text-secondary placeholder:text-text-tertiary' : 'glass-input-disabled cursor-not-allowed'}">
        </div>

        <!-- ROL -->
        <div class="space-y-1">
          <label for="profile-rol" class="text-[10px] font-bold text-body-muted uppercase">Rol del Sistema</label>
          <input type="text" id="profile-rol" aria-label="Rol del Sistema" value="${currentUser.rol || 'Analista'}" readonly 
                 class="w-full px-3 py-2 rounded-xl text-xs glass-input glass-input-disabled cursor-not-allowed">
        </div>

        <!-- CORREO ELECTRÓNICO -->
        <div class="space-y-1">
          <label for="profile-correo" class="text-[10px] font-bold text-body-muted uppercase">Correo Electrónico</label>
          <input type="email" id="profile-correo" aria-label="Correo Electrónico" value="${currentUser.correo || ''}" required placeholder="ejemplo@correo.com"
                 class="w-full px-3 py-2 rounded-xl text-xs glass-input text-text-secondary placeholder:text-text-tertiary">
        </div>

        <div class="flex justify-end gap-3 pt-2">
          <button type="button" onclick="closeModal()" class="px-4 py-2 rounded-xl text-xs font-semibold btn-secondary">Cancelar</button>
          <button type="submit" class="px-4 py-2 rounded-xl text-xs font-semibold btn-primary">Guardar Cambios</button>
        </div>
      </form>
    </div>
  `;
  lucide.createIcons();
}

async function saveProfile(event) {
  event.preventDefault();
  const nombre = document.getElementById('profile-nombre').value;
  const correo = document.getElementById('profile-correo').value;
  const rut = document.getElementById('profile-rut').value;
  const bodyData = { correo };
  
  if (currentUser.rol === 'Administrador') {
    bodyData.nombre = nombre;
    bodyData.rut = rut;
  }

  try {
    const res = await fetch('/api/perfil', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyData)
    });

    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.error || 'Error al actualizar el perfil.');
    }

    const updatedUser = await res.json();
    window.currentUser = updatedUser;
    if (typeof currentUser !== 'undefined') currentUser = updatedUser;
    if (typeof setCurrentUser === 'function') setCurrentUser(updatedUser);
    
    showToast('Perfil actualizado con éxito.');
    closeModal();
    if (typeof updateHeaderUserSection === 'function') updateHeaderUserSection();
    fetchAndUpdateDbTimestamp();
  } catch (err) {
    showToast(err.message, 'error');
  }
}


/**
 * Exposición canónica a window para retrocompatibilidad total
 */

/**
 * Manejo de Dropdown de Perfil
 * @param {Event} event - Parámetro event.
 */
function toggleProfileDropdown(event) {
  if (event) event.stopPropagation();
  const dropdown = document.getElementById('profile-dropdown');
  if (!dropdown) return;
  const isHidden = dropdown.classList.contains('hidden');
  const alertsDropdown = document.getElementById('alerts-dropdown');
  if (alertsDropdown) alertsDropdown.classList.add('hidden');
  if (isHidden) dropdown.classList.remove('hidden');
  else dropdown.classList.add('hidden');
}

function triggerEditProfile(event) {
  if (event) event.stopPropagation();
  const dropdown = document.getElementById('profile-dropdown');
  if (dropdown) dropdown.classList.add('hidden');
  openProfileModal();
}

function triggerAlertCenter(event) {
  if (event) event.stopPropagation();
  const dropdown = document.getElementById('profile-dropdown');
  if (dropdown) dropdown.classList.add('hidden');
  if (typeof window.switchView === 'function') {
    window.switchView('alertas');
  }
}

document.addEventListener('click', (event) => {
  const container = document.getElementById('alerts-widget-container');
  const dropdown = document.getElementById('alerts-dropdown');
  if (container && dropdown && !container.contains(event.target)) {
    dropdown.classList.add('hidden');
  }

  const profileContainer = document.getElementById('user-profile-menu');
  const profileDropdown = document.getElementById('profile-dropdown');
  if (profileContainer && profileDropdown && !profileContainer.contains(event.target)) {
    profileDropdown.classList.add('hidden');
  }
});

window.toggleProfileDropdown = toggleProfileDropdown;
window.triggerEditProfile = triggerEditProfile;
window.triggerAlertCenter = triggerAlertCenter;

window.openProfileModal = openProfileModal;
window.saveProfile = saveProfile;

export {
  openProfileModal,
  saveProfile
};
