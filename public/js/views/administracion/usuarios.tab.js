/**
 * UsuariosTab - Modulo desacoplado de Gestion de Usuarios y Roles
 */

import { escapeHtml } from '../../utils/formatters.js';

function generateUsuarioRowHtml(item) {
  const names = (item.nombre || "").trim().split(/\s+/);
  let initials = "U";
  if (names.length >= 2) {
    initials = (names[0][0] + names[names.length - 1][0]).toUpperCase();
  } else if (names.length === 1 && names[0]) {
    initials = names[0].substring(0, 2).toUpperCase();
  }

  const colors = [
    "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
    "bg-brand-500/10 text-brand-600 dark:text-brand-400 border-brand-500/20",
    "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
    "bg-rose-500/10 text-pink-600 dark:text-rose-400 border-pink-500/20",
    "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20",
  ];
  let hash = 0;
  const nameStr = item.nombre || "";
  for (let i = 0; i < nameStr.length; i++) {
    hash = nameStr.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % colors.length;
  const avatarColorClass = colors[index];

  let roleClasses = "";
  switch (item.rol) {
    case "Administrador":
      roleClasses = "bg-brand-500/10 text-brand-500 dark:text-brand-400 border-brand-500/20 border";
      break;
    case "Auditor":
      roleClasses =
        "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-badge-enplazo-border border";
      break;
    case "Sujeto Pasivo":
      roleClasses = "bg-card-amber-bg text-card-amber-text border-card-amber-border border";
      break;
    case "Asistente técnico":
      roleClasses =
        "bg-badge-ingresada-bg text-badge-ingresada-text border-badge-ingresada-border border";
      break;
    default:
      roleClasses = "bg-border-ui/40 text-text-tertiary border-border-ui border";
  }

  let asistidoSubtext = "";
  if (item.rol === "Asistente técnico" && item.asistido_rut) {
    const sp = (dataStore.sujetos_pasivos || []).find(
      (s) => s.rut === item.asistido_rut,
    );
    const asistidoNombre = sp ? sp.nombre : item.asistido_rut;
    asistidoSubtext = `
      <div class="text-[9px] text-text-tertiary font-medium truncate mt-0.5" title="Asiste a: ${asistidoNombre}">
        Asiste a: <span class="font-semibold text-text-secondary">${asistidoNombre}</span>
      </div>
    `;
  }

  return `
    <tr class="hover:bg-border-ui border-b border-border-ui transition-colors h-[72px]">
      <td class="pl-6 pr-2 text-xs font-semibold text-text-primary">
        <div class="flex items-center gap-3">
          <div class="h-8 w-8 rounded-full flex items-center justify-center text-[10px] font-bold border ${avatarColorClass} shrink-0 shadow-sm">
            ${initials}
          </div>
          <div class="font-semibold text-heading truncate max-w-[180px]">${escapeHtml(item.nombre)}</div>
        </div>
      </td>
      <td class="px-2 text-xs text-text-secondary font-mono"><div class="w-full truncate">${escapeHtml(item.rut || "-")}</div></td>
      <td class="px-2 text-xs text-text-secondary font-mono"><div class="w-full truncate">${escapeHtml(item.correo)}</div></td>
      <td class="px-2 text-xs">
        <div class="w-full truncate">
          <span class="px-2 py-0.5 rounded text-[10px] font-bold border ${roleClasses}">${escapeHtml(item.rol)}</span>
          ${asistidoSubtext}
        </div>
      </td>
      <td class="pl-2 pr-6 text-right whitespace-nowrap">
        <div class="flex items-center justify-end gap-1">
          ${
            currentUser && currentUser.rol === 'Administrador' && item.id !== currentUser.id && !currentUser.isSimulated
              ? `<button onclick="startImpersonation(${item.id})" class="p-1.5 rounded-lg text-text-tertiary hover:text-amber-500 hover:bg-amber-500/10 dark:hover:bg-amber-500/20 transition-all" title="Simular Usuario">
                   <i data-lucide="user-check" class="h-3.5 w-3.5"></i>
                 </button>`
              : ''
          }
          <button onclick="openUsuarioModal(${item.id})" class="p-1.5 rounded-lg text-text-tertiary hover:text-brand-600 hover:bg-brand-500/10 dark:hover:bg-brand-500/20 transition-all" title="Editar">
            <i data-lucide="edit-2" class="h-3.5 w-3.5"></i>
          </button>
          ${
            currentUser && item.id === currentUser.id
              ? `<button disabled class="p-1.5 rounded-lg text-text-secondary cursor-not-allowed opacity-40" title="No puedes eliminar tu propio usuario">
                 <i data-lucide="trash-2" class="h-3.5 w-3.5"></i>
               </button>`
              : `<button onclick="deleteRecord('usuarios', ${item.id})" class="p-1.5 rounded-lg text-text-tertiary hover:text-rose-600 hover:bg-rose-500/10 dark:hover:bg-rose-500/20 transition-all" title="Eliminar">
                 <i data-lucide="trash-2" class="h-3.5 w-3.5"></i>
               </button>`
          }
        </div>
      </td>
    </tr>
  `;
}

function filterUsuarios() {
  const query = (document.getElementById("search-usuarios")?.value || "")
    .toLowerCase()
    .trim();
  const tbody = document.querySelector("#table-usuarios tbody");
  if (!tbody) return;

  const items = dataStore.usuarios || [];
  const filtered = items.filter((user) => {
    return (
      (user.nombre || "").toLowerCase().includes(query) ||
      (user.correo || "").toLowerCase().includes(query) ||
      (user.rut || "").toLowerCase().includes(query) ||
      (user.rol || "").toLowerCase().includes(query)
    );
  });

  let rowsHtml = "";
  if (filtered.length === 0) {
    rowsHtml = `<tr><td colspan="5" class="px-3 py-8 text-center text-xs text-text-secondary">No se encontraron usuarios coincidentes.</td></tr>`;
  } else {
    filtered.forEach((item) => {
      rowsHtml += generateUsuarioRowHtml(item);
    });
  }
  tbody.innerHTML = rowsHtml;
  lucide.createIcons();
}


export function renderUsuariosTabHtml() {
  const dataStore = window.dataStore || {};
  const currentUser = window.currentUser || null;
  const items = dataStore.usuarios || [];
  let contentHtml = "";
  let rowsHtml = "";

  if (items.length === 0) {
      rowsHtml = `<tr><td colspan="5" class="px-3 py-8 text-center text-xs text-text-secondary">No hay registros de usuarios encontrados.</td></tr>`;
    } else {
      items.forEach((item) => {
        rowsHtml += generateUsuarioRowHtml(item);
      });
    }

    contentHtml = `
      <div class="space-y-6 mt-6">
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div class="relative w-full max-w-md">
            <span class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-tertiary">
              <i data-lucide="search" class="h-4 w-4"></i>
            </span>
            <input type="text" id="search-usuarios" oninput="filterUsuarios()" placeholder="Buscar por nombre, correo, rut..." class="w-full py-2.5 pl-9 pr-4 rounded-xl text-xs glass-input focus:outline-none transition-colors">
          </div>
          
          <div class="flex items-center gap-2.5 w-full sm:w-auto sm:justify-end shrink-0">
            <button id="btn-sincronizar-usuarios" onclick="confirmarSincronizacionUsuarios(this)" class="px-4 py-2.5 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2 transition-all hover:shadow-lg hover:shadow-brand-500/20 shrink-0 cursor-pointer">
              <i data-lucide="cloud-lightning" class="h-4 w-4"></i> Sincronizar usuarios
            </button>
            <button id="btn-registrar-usuario" onclick="openUsuarioModal()" class="px-4 py-2.5 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2 transition-all hover:shadow-lg hover:shadow-brand-500/20 shrink-0 cursor-pointer">
              <i data-lucide="plus" class="h-4 w-4"></i> Registrar Usuario
            </button>
          </div>
        </div>

        <div class="rounded-2xl overflow-hidden border border-border-ui mt-4 glass-card">
          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse table-fixed" id="table-usuarios">
              <thead>
                <tr class="bg-border-ui/50 border-b border-border-ui text-text-tertiary text-[10px] uppercase font-bold tracking-widest">
                  <th class="pl-6 pr-2 py-3 w-44 text-left">Nombre Completo</th>
                  <th class="px-2 py-3 w-28 text-left">RUT</th>
                  <th class="px-2 py-3 w-48 text-left">Correo Electrónico</th>
                  <th class="px-2 py-3 w-32 text-left">Rol</th>
                  <th class="pl-2 pr-6 py-3 w-24 text-right whitespace-nowrap">Acciones</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

  return contentHtml;
}

export function toggleAsistidoSelector() {
  const rolSelect = document.getElementById('user-rol');
  const asistidoContainer = document.getElementById('user-asistido-container');
  const asistidoSelect = document.getElementById('user-asistido-rut');
  if (rolSelect && asistidoContainer && asistidoSelect) {
    if (rolSelect.value === 'Asistente técnico') {
      asistidoContainer.classList.remove('hidden');
      asistidoSelect.setAttribute('required', 'true');
    } else {
      asistidoContainer.classList.add('hidden');
      asistidoSelect.removeAttribute('required');
      asistidoSelect.value = '';
    }
  }
}

export function openUsuarioModal(id = null) {
  const modal = document.getElementById('modal-container');
  if (!modal) return;
  modal.classList.remove('hidden');

  const isEdit = id !== null;
  const dataStore = window.dataStore || {};
  let user = { nombre: '', correo: '', rol: 'Administrador', rut: '', asistido_rut: '' };
  if (isEdit && Array.isArray(dataStore.usuarios)) {
    user = dataStore.usuarios.find(u => u.id === id) || user;
  }

  const uniqueSujetos = [];
  const seenRuts = new Set();
  (dataStore.sujetos_pasivos || []).forEach(sp => {
    if (sp.rut && !seenRuts.has(sp.rut)) {
      seenRuts.add(sp.rut);
      uniqueSujetos.push(sp);
    }
  });
  uniqueSujetos.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));

  modal.innerHTML = `
    <div class="glass-card w-full max-w-md p-6 rounded-2xl space-y-6 shadow-2xl relative">
      <div>
        <h3 class="text-lg font-bold text-heading">${isEdit ? 'Editar Usuario' : 'Nuevo Usuario'}</h3>
        <p class="text-xs text-body-muted">Completa los datos locales para registrar el acceso.</p>
      </div>

      <form id="usuario-form" onsubmit="saveUsuario(event, ${id})" class="space-y-4">
        <div class="space-y-1">
          <label for="user-nombre" class="text-[10px] font-bold text-body-muted uppercase">Nombre Completo</label>
          <input type="text" id="user-nombre" aria-label="Nombre Completo" value="${escapeHtml(user.nombre || '')}" required class="w-full px-3 py-2 rounded-xl text-xs glass-input text-text-secondary placeholder:text-text-tertiary">
        </div>

        <div class="space-y-1">
          <label for="user-rut" class="text-[10px] font-bold text-body-muted uppercase">RUT</label>
          <input type="text" id="user-rut" aria-label="RUT" value="${escapeHtml(user.rut || '')}" placeholder="12.345.678-9" class="w-full px-3 py-2 rounded-xl text-xs glass-input text-text-secondary placeholder:text-text-tertiary">
        </div>

        <div class="space-y-1">
          <label for="user-correo" class="text-[10px] font-bold text-body-muted uppercase">Correo Electrónico</label>
          <input type="email" id="user-correo" aria-label="Correo Electrónico" value="${escapeHtml(user.correo || '')}" required placeholder="ejemplo@correo.com" ${isEdit ? 'readonly class="w-full px-3 py-2 rounded-xl text-xs glass-input glass-input-disabled cursor-not-allowed"' : 'class="w-full px-3 py-2 rounded-xl text-xs glass-input text-text-secondary placeholder:text-text-tertiary"'}>
        </div>

        <div class="space-y-1">
          <label for="user-rol" class="text-[10px] font-bold text-body-muted uppercase">Rol en Sistema</label>
          <select id="user-rol" aria-label="Rol en Sistema" onchange="toggleAsistidoSelector()" class="w-full px-3 py-2 rounded-xl text-xs glass-input">
            <option value="Administrador" ${user.rol === 'Administrador' ? 'selected' : ''}>Administrador</option>
            <option value="Auditor" ${user.rol === 'Auditor' ? 'selected' : ''}>Auditor</option>
            <option value="Sujeto Pasivo" ${user.rol === 'Sujeto Pasivo' ? 'selected' : ''}>Sujeto Pasivo</option>
            <option value="Asistente técnico" ${user.rol === 'Asistente técnico' ? 'selected' : ''}>Asistente técnico</option>
          </select>
        </div>

        <div class="space-y-1 ${user.rol === 'Asistente técnico' ? '' : 'hidden'}" id="user-asistido-container">
          <label for="user-asistido-rut" class="text-[10px] font-bold text-body-muted uppercase">Sujeto Pasivo a Asistir</label>
          <select id="user-asistido-rut" aria-label="Sujeto Pasivo a Asistir" ${user.rol === 'Asistente técnico' ? 'required' : ''} class="w-full px-3 py-2 rounded-xl text-xs glass-input">
            <option value="">-- Seleccionar Sujeto Pasivo --</option>
            ${uniqueSujetos.map(sp => `<option value="${sp.rut}" ${user.asistido_rut === sp.rut ? 'selected' : ''}>${sp.nombre} (${sp.rut})</option>`).join('')}
          </select>
        </div>

        <div class="flex justify-end gap-3 pt-2">
          <button type="button" onclick="closeModal()" class="px-4 py-2 rounded-xl text-xs font-semibold btn-secondary">Cancelar</button>
          <button type="submit" class="px-4 py-2 rounded-xl text-xs font-semibold btn-primary">Guardar Cambios</button>
        </div>
      </form>
    </div>
  `;
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

export async function saveUsuario(event, id) {
  event.preventDefault();
  const nombre = document.getElementById('user-nombre').value;
  const correo = document.getElementById('user-correo').value;
  const rol = document.getElementById('user-rol').value;
  const rut = document.getElementById('user-rut').value;
  const asistido_rut = rol === 'Asistente técnico' ? document.getElementById('user-asistido-rut').value : '';

  const isEdit = id !== null;
  const url = isEdit ? `/api/usuarios/${id}` : '/api/usuarios';
  const method = isEdit ? 'PUT' : 'POST';

  const bodyData = { nombre, correo, rol, rut, asistido_rut };

  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyData)
    });

    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.error || 'Error en la petición.');
    }

    if (typeof showToast === 'function') showToast(isEdit ? 'Usuario actualizado.' : 'Usuario registrado.');
    if (typeof closeModal === 'function') closeModal();
    if (typeof fetchAndUpdateDbTimestamp === 'function') fetchAndUpdateDbTimestamp();
    if (typeof switchView === 'function') switchView('administracion');
  } catch (err) {
    if (typeof showToast === 'function') showToast(err.message, 'error');
  }
}

export function confirmarSincronizacionUsuarios(btn) {
  if (typeof openConfirmModal === 'function') {
    openConfirmModal(
      'Sincronizar Usuarios',
      '¿Está seguro de que desea subir y sincronizar la base de datos de usuarios actual con SharePoint? Esto actualizará la versión compartida para todos los computadores de la red.',
      () => {
        sincronizarUsuariosASharepoint(btn);
      }
    );
  }
}

export async function sincronizarUsuariosASharepoint(btn) {
  if (!btn) return;
  const originalHtml = btn.innerHTML;
  btn.disabled = true;
  btn.classList.add('opacity-60', 'cursor-not-allowed');
  btn.innerHTML = `<i data-lucide="refresh-cw" class="h-4 w-4 animate-spin shrink-0"></i> <span>Sincronizando...</span>`;
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }

  try {
    const res = await fetch('/api/admin/sincronizar-usuarios-sharepoint', { method: 'POST' });
    const data = await res.json();

    if (res.ok && data.success) {
      if (typeof showToast === 'function') showToast(data.message || 'Usuarios sincronizados con SharePoint correctamente.', 'success');
      if (typeof fetchAndUpdateDbTimestamp === 'function') fetchAndUpdateDbTimestamp();
    } else {
      if (typeof showToast === 'function') showToast(data.error || 'Error al sincronizar usuarios.', 'error');
    }
  } catch (err) {
    console.error('Error al sincronizar usuarios:', err);
    if (typeof showToast === 'function') showToast('Error de red al conectar con el servidor', 'error');
  } finally {
    btn.disabled = false;
    btn.classList.remove('opacity-60', 'cursor-not-allowed');
    btn.innerHTML = originalHtml;
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  }
}

export const UsuariosTab = {
  mount(container) {
    if (container) {
      container.innerHTML = renderUsuariosTabHtml();
      if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
      }
    }
  },
  unmount() {},
  renderTabHtml: renderUsuariosTabHtml,
  openUsuarioModal,
  saveUsuario,
  toggleAsistidoSelector,
  confirmarSincronizacionUsuarios,
  sincronizarUsuariosASharepoint
};

if (typeof window !== 'undefined') {
  window.UsuariosTab = UsuariosTab;
  window.generateUsuarioRowHtml = generateUsuarioRowHtml;
  window.filterUsuarios = filterUsuarios;
  window.renderUsuariosTabHtml = renderUsuariosTabHtml;
  window.openUsuarioModal = openUsuarioModal;
  window.saveUsuario = saveUsuario;
  window.toggleAsistidoSelector = toggleAsistidoSelector;
  window.confirmarSincronizacionUsuarios = confirmarSincronizacionUsuarios;
  window.sincronizarUsuariosASharepoint = sincronizarUsuariosASharepoint;
}
