// ============================================================================
// CONSOLA DE ASISTENCIA TÉCNICA - LOBBYCONTROL PRO
// ============================================================================

let currentContactId = null;
let lastSavedTicket = null;
let isAlwaysOnTopActive = true;
let selectedCanal = 'telefono';
let selectedCategoria = 'Plazos Legales (3 Días / Publicación)';
let selectedEstado = 'resuelta';
let categoriasList = [];
let direccionesList = [];
let isFormLocked = false;
let isReviewMode = false;

document.addEventListener('DOMContentLoaded', async () => {
  if (window.lucide) window.lucide.createIcons();

  initLiveClock();
  initAlwaysOnTop();
  await Promise.all([loadCategorias(), loadDirecciones()]);
  initCustomDropdowns();
  initDeptoCombobox();
  initPhoneRestriction();
  initAutocomplete();
  initActions();
  initKeyboardShortcuts();

  // Comprobar si se abrió para editar una asistencia específica
  const urlParams = new URLSearchParams(window.location.search);
  const editId = urlParams.get('id');
  if (editId) {
    await loadAsistenciaParaEdicion(editId);
  } else {
    applyNewMode();
    initDraftAutosave();
  }

  if (window.api && window.api.onLoadAssistanceForEdit) {
    window.api.onLoadAssistanceForEdit(async (id) => {
      await loadAsistenciaParaEdicion(id);
    });
  }
});

async function loadAsistenciaParaEdicion(id) {
  if (!id) return;
  try {
    const res = await window.api.invokeRoute({ url: `/api/asistencias/${id}`, method: 'GET' });
    if (res && res.status === 200 && res.data) {
      const ast = res.data;
      lastSavedTicket = ast;
      currentContactId = ast.contacto_id || null;

      // Rellenar campos del formulario
      const inputSolicitante = document.getElementById('input-solicitante');
      const inputDepto = document.getElementById('input-depto');
      const inputCorreo = document.getElementById('input-correo');
      const inputContacto = document.getElementById('input-contacto');
      const inputFolio = document.getElementById('input-folio');
      const inputMotivo = document.getElementById('input-motivo');
      const inputSolucion = document.getElementById('input-solucion');

      if (inputSolicitante) inputSolicitante.value = ast.solicitante_nombre || '';
      if (inputDepto) inputDepto.value = ast.solicitante_cargo_depto || '';
      if (inputCorreo) inputCorreo.value = ast.solicitante_correo || '';
      if (inputContacto) inputContacto.value = ast.solicitante_contacto || '';
      if (inputFolio) inputFolio.value = ast.folio_lobby || '';
      if (inputMotivo) inputMotivo.value = ast.motivo_consulta || '';
      if (inputSolucion) inputSolucion.value = ast.solucion_orientacion || '';

      // Seleccionar canal, categoría y estado
      setCanalUI(ast.canal || 'telefono');
      
      const catFound = categoriasList.find(c => c.slug === ast.categoria || c.nombre === ast.categoria);
      setCategoriaUI(catFound ? catFound.nombre : (ast.categoria || 'Plazos Legales (3 Días / Publicación)'));
      setEstadoUI(ast.estado || 'resuelta');

      // Aplicar Modo Revisión (Lectura, Correo/PDF habilitados, botón Editar, botones Nueva y Descartar ocultos)
      applyReviewMode(ast);
    }
  } catch (err) {
    showToast('Error al cargar la asistencia: ' + err.message, 'error');
  }
}
window.loadAsistenciaParaEdicion = loadAsistenciaParaEdicion;

function applyReviewMode(ticket) {
  isReviewMode = true;
  isFormLocked = true;
  lastSavedTicket = ticket;

  // Bloquear campos de entrada en modo lectura
  document.querySelectorAll('.form-field-control').forEach(el => {
    el.disabled = true;
    el.classList.add('opacity-75', 'cursor-not-allowed');
  });

  // Ocultar botones no pertinentes en modo revisión
  const btnDescartar = document.getElementById('btn-descartar');
  const btnNueva = document.getElementById('btn-nueva-llamada');
  const btnCancelarEdicion = document.getElementById('btn-cancelar-edicion');
  if (btnDescartar) btnDescartar.classList.add('hidden');
  if (btnNueva) btnNueva.classList.add('hidden');
  if (btnCancelarEdicion) btnCancelarEdicion.classList.add('hidden');

  // Habilitar Correo y PDF
  setExportButtonsState(true);

  // Configurar botón principal como "Editar"
  const btnGuardar = document.getElementById('btn-guardar');
  if (btnGuardar) {
    btnGuardar.setAttribute('data-mode', 'edit');
    btnGuardar.className = 'h-9 px-4.5 rounded-lg text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white shadow-2xs transition-all flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap active:scale-95';
    document.getElementById('btn-guardar-text').textContent = 'Editar';
    const iconEl = document.getElementById('btn-guardar-icon');
    if (iconEl) {
      iconEl.setAttribute('data-lucide', 'edit-3');
      iconEl.classList.remove('animate-spin');
    }
  }

  // Actualizar badge en la cabecera
  const badge = document.getElementById('badge-ticket-draft');
  if (badge && ticket) {
    badge.textContent = ticket.ticket_codigo;
    badge.className = 'px-1.5 py-0.5 rounded font-mono text-[9px] font-bold bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800';
  }

  if (window.lucide) window.lucide.createIcons();
}

function applyNewMode() {
  isReviewMode = false;
  isFormLocked = false;
  lastSavedTicket = null;

  // Desbloquear campos
  document.querySelectorAll('.form-field-control').forEach(el => {
    el.disabled = false;
    el.classList.remove('opacity-75', 'cursor-not-allowed');
  });

  // Mostrar botones Descartar y Nueva
  const btnDescartar = document.getElementById('btn-descartar');
  const btnNueva = document.getElementById('btn-nueva-llamada');
  const btnCancelarEdicion = document.getElementById('btn-cancelar-edicion');
  if (btnDescartar) btnDescartar.classList.remove('hidden');
  if (btnNueva) btnNueva.classList.remove('hidden');
  if (btnCancelarEdicion) btnCancelarEdicion.classList.add('hidden');

  // Deshabilitar Correo y PDF (hasta que se guarde)
  setExportButtonsState(false);

  // Configurar botón principal como "Guardar"
  const btnGuardar = document.getElementById('btn-guardar');
  if (btnGuardar) {
    btnGuardar.setAttribute('data-mode', 'save');
    btnGuardar.className = 'h-9 px-4.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-2xs transition-all flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap active:scale-95';
    document.getElementById('btn-guardar-text').textContent = 'Guardar (Ctrl+Enter)';
    const iconEl = document.getElementById('btn-guardar-icon');
    if (iconEl) {
      iconEl.setAttribute('data-lucide', 'save');
      iconEl.classList.remove('animate-spin');
    }
  }

  // Badge en AST-NUEVA
  const badge = document.getElementById('badge-ticket-draft');
  if (badge) {
    badge.textContent = 'AST-NUEVA';
    badge.className = 'px-1.5 py-0.5 rounded font-mono text-[9px] font-bold bg-border-ui text-text-secondary border border-border-ui';
  }

  if (window.lucide) window.lucide.createIcons();
}

// ============================================================================
// 1. SISTEMA DE TOASTS NATIVO DE LOBBYCONTROL (CERO ALERTS DE WINDOWS)
// ============================================================================
function showToast(message, type = 'info', duration = 3500) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  const typeStyles = {
    success: 'bg-emerald-600 text-white border-emerald-700',
    warning: 'bg-amber-500 text-white border-amber-600',
    error: 'bg-rose-600 text-white border-rose-700',
    info: 'bg-bg-header text-text-primary border-border-ui'
  };

  const icons = {
    success: 'check-circle-2',
    warning: 'alert-triangle',
    error: 'alert-circle',
    info: 'info'
  };

  toast.className = `pointer-events-auto flex items-center gap-2.5 px-4 py-2.5 rounded-xl shadow-xl text-xs font-semibold border ${typeStyles[type] || typeStyles.info} transform transition-all duration-200 translate-y-2 opacity-0`;
  toast.innerHTML = `
    <i data-lucide="${icons[type] || 'info'}" class="h-4 w-4 shrink-0"></i>
    <span class="leading-snug">${message}</span>
  `;

  container.appendChild(toast);
  if (window.lucide) window.lucide.createIcons();

  requestAnimationFrame(() => {
    toast.classList.remove('translate-y-2', 'opacity-0');
  });

  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-2');
    setTimeout(() => toast.remove(), 200);
  }, duration);
}

function showConfirmDialog({ title, message, acceptText = 'Aceptar', cancelText = 'Cancelar', isDanger = true }) {
  return new Promise((resolve) => {
    const modal = document.getElementById('confirm-modal');
    const titleEl = document.getElementById('confirm-modal-title');
    const msgEl = document.getElementById('confirm-modal-msg');
    const btnAccept = document.getElementById('btn-confirm-accept');
    const btnCancel = document.getElementById('btn-confirm-cancel');

    if (!modal) return resolve(false);

    titleEl.textContent = title;
    msgEl.textContent = message;
    btnAccept.textContent = acceptText;
    btnCancel.textContent = cancelText;

    if (isDanger) {
      btnAccept.className = 'h-8 px-3.5 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-xs transition-colors cursor-pointer';
    } else {
      btnAccept.className = 'h-8 px-3.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs transition-colors cursor-pointer';
    }

    modal.classList.remove('hidden');

    const handleAccept = () => {
      cleanup();
      resolve(true);
    };

    const handleCancel = () => {
      cleanup();
      resolve(false);
    };

    const cleanup = () => {
      modal.classList.add('hidden');
      btnAccept.removeEventListener('click', handleAccept);
      btnCancel.removeEventListener('click', handleCancel);
    };

    btnAccept.addEventListener('click', handleAccept);
    btnCancel.addEventListener('click', handleCancel);
  });
}

// ============================================================================
// 2. RELOJ DE HORA ACTUAL
// ============================================================================
function initLiveClock() {
  const clockEl = document.getElementById('live-clock');
  if (!clockEl) return;

  const update = () => {
    const now = new Date();
    const options = { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false };
    clockEl.textContent = now.toLocaleDateString('es-CL', options);
  };

  update();
  setInterval(update, 1000);
}

// ============================================================================
// 3. ALWAYS ON TOP
// ============================================================================
function initAlwaysOnTop() {
  const btn = document.getElementById('btn-always-on-top');
  if (!btn) return;

  btn.addEventListener('click', async () => {
    if (!window.api || !window.api.toggleAlwaysOnTop) return;
    const res = await window.api.toggleAlwaysOnTop();
    if (res && res.success) {
      isAlwaysOnTopActive = res.alwaysOnTop;
      updatePinButtonUI(isAlwaysOnTopActive);
    }
  });
}

function updatePinButtonUI(active) {
  const btn = document.getElementById('btn-always-on-top');
  if (!btn) return;
  if (active) {
    btn.className = 'h-7 px-2 rounded-lg text-[10px] font-semibold flex items-center gap-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 cursor-pointer';
    btn.innerHTML = '<i data-lucide="pin" class="h-3 w-3"></i><span>Fijado</span>';
  } else {
    btn.className = 'h-7 px-2 rounded-lg text-[10px] font-semibold flex items-center gap-1 bg-bg-card text-text-secondary border border-border-ui hover:bg-border-ui cursor-pointer';
    btn.innerHTML = '<i data-lucide="pin-off" class="h-3 w-3"></i><span>Libre</span>';
  }
  if (window.lucide) window.lucide.createIcons();
}

// ============================================================================
// 4. CATEGORÍAS Y DIRECCIONES DINÁMICAS (LOCAL.DB)
// ============================================================================
async function loadCategorias() {
  try {
    const res = await window.api.invokeRoute({ url: '/api/asistencias/categorias', method: 'GET' });
    if (res && res.status === 200 && Array.isArray(res.data)) {
      categoriasList = res.data;
    }
  } catch (e) {
    console.warn('Error al cargar categorías:', e);
  }

  if (!categoriasList || categoriasList.length === 0) {
    categoriasList = [
      { id: 1, nombre: 'Plazos Legales (3 Días / Publicación)' },
      { id: 2, nombre: 'Plataforma / ClaveÚnica' },
      { id: 3, nombre: 'Sujetos Pasivos / Suplencias' },
      { id: 4, nombre: 'Derivaciones / Improcedencia' },
      { id: 5, nombre: 'Carga de Actas y Respuestas' },
      { id: 6, nombre: 'Normativa Ley N° 20.730' },
      { id: 7, nombre: 'Consulta General / Otro' }
    ];
  }

  renderCategoriasDropdown();
}

function renderCategoriasDropdown() {
  const container = document.getElementById('list-categorias-options');
  if (!container) return;

  container.innerHTML = categoriasList.map(cat => `
    <button type="button" class="option-categoria w-full px-3.5 py-2 text-left text-xs font-medium hover:bg-border-ui flex items-center gap-2 cursor-pointer ${selectedCategoria === cat.nombre ? 'font-bold text-brand-600 dark:text-brand-400' : 'text-text-primary'}" data-value="${cat.nombre}">
      <i data-lucide="tag" class="h-3.5 w-3.5 text-text-tertiary shrink-0"></i>
      <span class="truncate">${cat.nombre}</span>
    </button>
  `).join('');

  if (window.lucide) window.lucide.createIcons();

  container.querySelectorAll('.option-categoria').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedCategoria = btn.getAttribute('data-value');
      const label = document.getElementById('selected-categoria-label');
      if (label) {
        label.innerHTML = `<i data-lucide="tag" class="h-3.5 w-3.5 text-brand-500 shrink-0"></i><span class="truncate">${selectedCategoria}</span>`;
        if (window.lucide) window.lucide.createIcons();
      }
      document.getElementById('menu-dropdown-categoria')?.classList.add('hidden');
      saveDraft();
    });
  });
}

async function loadDirecciones() {
  try {
    const res = await window.api.invokeRoute({ url: '/api/direcciones', method: 'GET' });
    if (res && res.status === 200 && Array.isArray(res.data)) {
      direccionesList = res.data;
    }
  } catch (e) {
    console.warn('Error al cargar direcciones:', e);
  }

  if (!direccionesList || direccionesList.length === 0) {
    direccionesList = [
      { acronimo: 'DOM', nombre: 'Dirección de Obras Municipales' },
      { acronimo: 'SECMUN', nombre: 'Secretaría Municipal' },
      { acronimo: 'DIDECO', nombre: 'Dirección de Desarrollo Comunitario' },
      { acronimo: 'DAF', nombre: 'Dirección de Administración y Finanzas' },
      { acronimo: 'SECPLA', nombre: 'Secretaría Comunal de Planificación' },
      { acronimo: 'DIPRESEC', nombre: 'Dirección de Prevención y Seguridad Ciudadana' },
      { acronimo: 'DAJ', nombre: 'Dirección de Asesoría Jurídica' },
      { acronimo: 'CTRL', nombre: 'Dirección de Control' },
      { acronimo: 'DTT', nombre: 'Dirección de Tránsito y Transporte' },
      { acronimo: 'DAOGA', nombre: 'Dirección de Aseo, Ornato y Gestión Ambiental' },
      { acronimo: 'DITEC', nombre: 'Dirección de Tecnologías de la Información' },
      { acronimo: 'RRHH', nombre: 'Dirección de Personas / Recursos Humanos' },
      { acronimo: 'OPS', nombre: 'Dirección de Operaciones' },
      { acronimo: 'ALC', nombre: 'Alcaldía' },
      { acronimo: 'CON', nombre: 'Concejo Municipal / Concejales' },
      { acronimo: 'SMAPA', nombre: 'Servicio Municipal de Agua Potable y Alcantarillado' },
      { acronimo: 'JPL', nombre: 'Juzgados de Policía Local' }
    ];
  }

  renderDireccionesDropdown(direccionesList);
}

function initDeptoCombobox() {
  const input = document.getElementById('input-depto');
  const toggleBtn = document.getElementById('btn-toggle-depto-dropdown');
  const menu = document.getElementById('menu-dropdown-depto');
  if (!input || !menu) return;

  const showMenu = () => {
    if (isFormLocked) return;
    const val = input.value.trim().toLowerCase();
    const filtered = val ? direccionesList.filter(d => d.acronimo.toLowerCase().includes(val) || d.nombre.toLowerCase().includes(val)) : direccionesList;
    renderDireccionesDropdown(filtered);
    menu.classList.remove('hidden');
  };

  input.addEventListener('focus', showMenu);
  input.addEventListener('input', showMenu);

  if (toggleBtn) {
    toggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (isFormLocked) return;
      if (menu.classList.contains('hidden')) {
        renderDireccionesDropdown(direccionesList);
        menu.classList.remove('hidden');
      } else {
        menu.classList.add('hidden');
      }
    });
  }

  document.addEventListener('click', (e) => {
    if (!input.contains(e.target) && !menu.contains(e.target) && (!toggleBtn || !toggleBtn.contains(e.target))) {
      menu.classList.add('hidden');
    }
  });
}

function renderDireccionesDropdown(list) {
  const menu = document.getElementById('menu-dropdown-depto');
  if (!menu) return;

  if (list.length === 0) {
    menu.innerHTML = '<div class="p-3 text-[11px] text-text-tertiary text-center">Sin coincidencias (puedes escribir libremente)</div>';
    return;
  }

  menu.innerHTML = list.map(d => `
    <button type="button" class="option-depto w-full px-3.5 py-2 text-left hover:bg-border-ui flex items-center justify-between gap-2 cursor-pointer" data-acronimo="${d.acronimo}">
      <span class="font-bold text-xs text-brand-600 dark:text-brand-400 font-mono">${d.acronimo}</span>
      <span class="text-[11px] text-text-tertiary truncate text-right">${d.nombre}</span>
    </button>
  `).join('');

  menu.querySelectorAll('.option-depto').forEach(btn => {
    btn.addEventListener('click', () => {
      const acronimo = btn.getAttribute('data-acronimo');
      document.getElementById('input-depto').value = acronimo;
      menu.classList.add('hidden');
      saveDraft();
    });
  });
}

// ============================================================================
// 5. VALIDACIONES Y RESTRICCIÓN DE DÍGITOS EN TELÉFONO
// ============================================================================
function initPhoneRestriction() {
  const input = document.getElementById('input-contacto');
  if (!input) return;

  input.addEventListener('input', () => {
    input.value = input.value.replace(/[^0-9]/g, '');
    saveDraft();
  });
}

// ============================================================================
// 6. MENÚS DESPLEGABLES GENERALES
// ============================================================================
function initCustomDropdowns() {
  setupDropdownToggle('btn-dropdown-canal', 'menu-dropdown-canal');
  setupDropdownToggle('btn-dropdown-categoria', 'menu-dropdown-categoria');
  setupDropdownToggle('btn-dropdown-estado', 'menu-dropdown-estado');

  // Canal
  document.querySelectorAll('.option-canal').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedCanal = btn.getAttribute('data-value') || 'telefono';
      const labelText = btn.getAttribute('data-label') || 'Teléfono';
      const iconName = btn.getAttribute('data-icon') || 'phone';
      
      const label = document.getElementById('selected-canal-label');
      if (label) {
        label.innerHTML = `<i data-lucide="${iconName}" class="h-3.5 w-3.5 text-brand-500 shrink-0"></i><span>${labelText}</span>`;
        if (window.lucide) window.lucide.createIcons();
      }
      document.getElementById('menu-dropdown-canal')?.classList.add('hidden');
      saveDraft();
    });
  });

  // Estado
  document.querySelectorAll('.option-estado').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedEstado = btn.getAttribute('data-value') || 'resuelta';
      const labelText = btn.getAttribute('data-label') || 'Resuelta';
      const colorClass = btn.getAttribute('data-color') || 'bg-emerald-500';

      const label = document.getElementById('selected-estado-label');
      if (label) {
        label.innerHTML = `<span class="h-2 w-2 rounded-full ${colorClass}"></span><span>${labelText}</span>`;
      }
      document.getElementById('menu-dropdown-estado')?.classList.add('hidden');
      saveDraft();
    });
  });

  // Clic exterior
  document.addEventListener('click', (e) => {
    ['canal', 'categoria', 'estado'].forEach(m => {
      const btn = document.getElementById(`btn-dropdown-${m}`);
      const menu = document.getElementById(`menu-dropdown-${m}`);
      if (btn && menu && !btn.contains(e.target) && !menu.contains(e.target)) {
        menu.classList.add('hidden');
      }
    });
  });
}

function setupDropdownToggle(btnId, menuId) {
  const btn = document.getElementById(btnId);
  const menu = document.getElementById(menuId);
  if (!btn || !menu) return;

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (isFormLocked) return;
    document.querySelectorAll('.absolute').forEach(d => {
      if (d !== menu && !d.id.includes('autocomplete') && !d.id.includes('drawer')) d.classList.add('hidden');
    });
    menu.classList.toggle('hidden');
  });
}

// ============================================================================
// 7. BORRADOR AUTOMÁTICO (PERSISTENCIA TOTAL EN TIEMPO REAL)
// ============================================================================
const DRAFT_KEY = 'lobby_asistencia_draft_v6';

function initDraftAutosave() {
  const inputs = ['input-solicitante', 'input-depto', 'input-correo', 'input-contacto', 'input-folio', 'input-motivo', 'input-solucion'];
  
  inputs.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', saveDraft);
      el.addEventListener('change', saveDraft);
    }
  });

  restoreDraft();
}

function saveDraft() {
  if (isFormLocked) return;

  const draft = {
    solicitante: document.getElementById('input-solicitante')?.value || '',
    depto: document.getElementById('input-depto')?.value || '',
    correo: document.getElementById('input-correo')?.value || '',
    contacto: document.getElementById('input-contacto')?.value || '',
    canal: selectedCanal,
    categoria: selectedCategoria,
    estado: selectedEstado,
    folio: document.getElementById('input-folio')?.value || '',
    motivo: document.getElementById('input-motivo')?.value || '',
    solucion: document.getElementById('input-solucion')?.value || '',
    contactoId: currentContactId,
    timerSeconds: timerSeconds,
    timestamp: Date.now()
  };

  const hasContent = draft.solicitante.trim() || draft.motivo.trim() || draft.solucion.trim() || draft.depto.trim();
  if (hasContent) {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } else {
    localStorage.removeItem(DRAFT_KEY);
  }
}

function restoreDraft() {
  try {
    const saved = localStorage.getItem(DRAFT_KEY);
    if (!saved) return;
    const draft = JSON.parse(saved);

    if (Date.now() - (draft.timestamp || 0) > 3 * 24 * 60 * 60 * 1000) {
      localStorage.removeItem(DRAFT_KEY);
      return;
    }

    if (draft.solicitante) document.getElementById('input-solicitante').value = draft.solicitante;
    if (draft.depto) document.getElementById('input-depto').value = draft.depto;
    if (draft.correo) document.getElementById('input-correo').value = draft.correo;
    if (draft.contacto) document.getElementById('input-contacto').value = draft.contacto;
    if (draft.folio) document.getElementById('input-folio').value = draft.folio;
    if (draft.motivo) document.getElementById('input-motivo').value = draft.motivo;
    if (draft.solucion) document.getElementById('input-solucion').value = draft.solucion;
    if (draft.contactoId) currentContactId = draft.contactoId;
    if (draft.canal) setCanalUI(draft.canal);
    if (draft.categoria) setCategoriaUI(draft.categoria);
    if (draft.estado) setEstadoUI(draft.estado);
    if (draft.timerSeconds) {
      timerSeconds = draft.timerSeconds;
      updateTimerDisplay();
    }

    if (draft.contactoId) {
      document.getElementById('indicator-contacto-vinculado')?.classList.remove('hidden');
    }
  } catch (e) {
    console.warn('Error al restaurar borrador:', e);
  }
}

function setCanalUI(canal) {
  selectedCanal = canal || 'telefono';
  const iconMap = { telefono: 'phone', correo: 'mail', presencial: 'users', teams: 'message-square' };
  const labelMap = { telefono: 'Teléfono', correo: 'Correo', presencial: 'Presencial', teams: 'Teams' };
  const label = document.getElementById('selected-canal-label');
  if (label) {
    label.innerHTML = `<i data-lucide="${iconMap[selectedCanal] || 'phone'}" class="h-3.5 w-3.5 text-brand-500 shrink-0"></i><span>${labelMap[selectedCanal] || 'Teléfono'}</span>`;
    if (window.lucide) window.lucide.createIcons();
  }
}

function setCategoriaUI(cat) {
  selectedCategoria = cat || 'Plazos Legales (3 Días / Publicación)';
  const label = document.getElementById('selected-categoria-label');
  if (label) {
    label.innerHTML = `<i data-lucide="tag" class="h-3.5 w-3.5 text-brand-500 shrink-0"></i><span class="truncate">${selectedCategoria}</span>`;
    if (window.lucide) window.lucide.createIcons();
  }
}

function setEstadoUI(est) {
  selectedEstado = est || 'resuelta';
  const colorMap = { resuelta: 'bg-emerald-500', en_seguimiento: 'bg-amber-500', derivada: 'bg-blue-500' };
  const labelMap = { resuelta: 'Resuelta', en_seguimiento: 'En Seguimiento', derivada: 'Derivada' };
  const label = document.getElementById('selected-estado-label');
  if (label) {
    label.innerHTML = `<span class="h-2 w-2 rounded-full ${colorMap[selectedEstado] || 'bg-emerald-500'}"></span><span>${labelMap[selectedEstado] || 'Resuelta'}</span>`;
  }
}

// ============================================================================
// 8. AUTOCOMPLETADO DE SOLICITANTE (SIN DUPLICACIÓN Y DISEÑO LIMPIO)
// ============================================================================
let debounceTimeout = null;

function initAutocomplete() {
  const input = document.getElementById('input-solicitante');
  const suggestionsBox = document.getElementById('autocomplete-suggestions');
  if (!input || !suggestionsBox) return;

  input.addEventListener('input', () => {
    if (isFormLocked) return;
    const val = input.value.trim();
    currentContactId = null;
    document.getElementById('indicator-contacto-vinculado')?.classList.add('hidden');

    if (val.length < 2) {
      suggestionsBox.classList.add('hidden');
      suggestionsBox.innerHTML = '';
      return;
    }

    clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(async () => {
      try {
        const res = await window.api.invokeRoute({
          url: `/api/asistencias/contactos/sugerencias?q=${encodeURIComponent(val)}`,
          method: 'GET'
        });

        if (res && res.status === 200 && Array.isArray(res.data) && res.data.length > 0) {
          renderSuggestions(res.data);
        } else {
          suggestionsBox.classList.add('hidden');
          suggestionsBox.innerHTML = '';
        }
      } catch (err) {
        console.warn('Error en sugerencias:', err);
      }
    }, 150);
  });

  document.addEventListener('click', (e) => {
    if (!input.contains(e.target) && !suggestionsBox.contains(e.target)) {
      suggestionsBox.classList.add('hidden');
    }
  });
}

function renderSuggestions(contacts) {
  const box = document.getElementById('autocomplete-suggestions');
  if (!box) return;

  box.innerHTML = contacts.map(c => {
    const rawAnexo = (c.telefono_anexo || '').replace(/anexo/gi, '').trim();
    const anexoStr = rawAnexo ? ` · Anexo ${rawAnexo}` : '';
    const subline = `${c.depto_habitual || 'Sin departamento'}${anexoStr}`;

    return `
      <button type="button" class="w-full px-3.5 py-2.5 text-left hover:bg-border-ui flex items-center gap-3 cursor-pointer transition-colors" data-contact='${JSON.stringify(c).replace(/'/g, "&#39;")}'>
        <div class="h-7 w-7 rounded-full bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20 flex items-center justify-center shrink-0">
          <i data-lucide="user" class="h-3.5 w-3.5"></i>
        </div>
        <div class="flex-1 min-w-0">
          <div class="font-semibold text-xs text-text-primary truncate">${c.nombre}</div>
          <div class="text-[11px] text-text-tertiary truncate mt-0.5">${subline}</div>
        </div>
      </button>
    `;
  }).join('');

  box.classList.remove('hidden');
  if (window.lucide) window.lucide.createIcons();

  box.querySelectorAll('button').forEach(el => {
    el.addEventListener('click', () => {
      const data = JSON.parse(el.getAttribute('data-contact'));
      seleccionarContactoExistente(data);
      box.classList.add('hidden');
    });
  });
}

function selectContactFromDropdown(c) {
  seleccionarContactoExistente(c);
  document.getElementById('autocomplete-suggestions').classList.add('hidden');
}

function updateActionButtonsState(enabled) {
  const btnCorreo = document.getElementById('btn-enviar-correo');
  const btnPdf = document.getElementById('btn-ficha-pdf');

  [btnCorreo, btnPdf].forEach(btn => {
    if (btn) {
      btn.disabled = !enabled;
      if (enabled) {
        btn.classList.remove('opacity-40', 'pointer-events-none');
        btn.classList.add('hover:bg-border-ui', 'hover:text-text-primary');
      } else {
        btn.classList.add('opacity-40', 'pointer-events-none');
        btn.classList.remove('hover:bg-border-ui', 'hover:text-text-primary');
      }
    }
  });
}

function selectContact(contact) {
  currentContactId = contact.id;
  document.getElementById('input-solicitante').value = contact.nombre;
  
  if (contact.depto_habitual && !document.getElementById('input-depto').value) {
    document.getElementById('input-depto').value = contact.depto_habitual;
  }
  if (contact.correo) document.getElementById('input-correo').value = contact.correo;
  if (contact.telefono_anexo) {
    const numOnly = contact.telefono_anexo.replace(/[^0-9]/g, '');
    document.getElementById('input-contacto').value = numOnly;
  }

  const ind = document.getElementById('indicator-contacto-vinculado');
  if (ind) ind.classList.remove('hidden');

  showToast(`Funcionario vinculado: ${contact.nombre}`, 'success', 2500);
  saveDraft();
}

// ============================================================================
// 9. ACCIONES (GUARDAR, EDITAR, CANCELAR, DESCARTAR, NUEVA, CORREO, PDF)
// ============================================================================
function initActions() {
  const btnGuardar = document.getElementById('btn-guardar');
  const btnCancelarEdicion = document.getElementById('btn-cancelar-edicion');
  const btnDescartar = document.getElementById('btn-descartar');
  const btnNueva = document.getElementById('btn-nueva-llamada');
  const btnCorreo = document.getElementById('btn-enviar-correo');
  const btnPdf = document.getElementById('btn-ficha-pdf');

  if (btnGuardar) {
    btnGuardar.addEventListener('click', () => {
      const mode = btnGuardar.getAttribute('data-mode');
      if (mode === 'edit') {
        unlockFormForEditing();
      } else {
        guardarAsistencia();
      }
    });
  }

  if (btnCancelarEdicion) {
    btnCancelarEdicion.addEventListener('click', () => {
      if (lastSavedTicket && lastSavedTicket.id) {
        loadAsistenciaParaEdicion(lastSavedTicket.id);
        showToast('Edición cancelada.', 'info');
      }
    });
  }

  if (btnDescartar) btnDescartar.addEventListener('click', handleDescartar);
  if (btnNueva) btnNueva.addEventListener('click', handleNueva);
  if (btnCorreo) btnCorreo.addEventListener('click', prepararCorreoOutlook);
  if (btnPdf) btnPdf.addEventListener('click', generarFichaPDF);
}

function initKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      const btnGuardar = document.getElementById('btn-guardar');
      if (btnGuardar && btnGuardar.getAttribute('data-mode') !== 'edit') {
        guardarAsistencia();
      }
    }
  });
}

// Descartar
async function handleDescartar() {
  const nombre = document.getElementById('input-solicitante')?.value.trim();
  const motivo = document.getElementById('input-motivo')?.value.trim();

  if (nombre || motivo) {
    const confirmed = await showConfirmDialog({
      title: 'Descartar Atención',
      message: '¿Estás seguro de descartar los datos ingresados? Esta acción no se puede deshacer.',
      acceptText: 'Sí, Descartar',
      cancelText: 'Continuar editando',
      isDanger: true
    });
    if (!confirmed) return;
  }

  resetForm();
  showToast('Formulario limpio.', 'info');
}

// Nueva Atención
async function handleNueva() {
  if (!isFormLocked) {
    const nombre = document.getElementById('input-solicitante')?.value.trim();
    const motivo = document.getElementById('input-motivo')?.value.trim();

    if (nombre || motivo) {
      const confirmed = await showConfirmDialog({
        title: 'Iniciar Nueva Atención',
        message: 'Hay una atención en curso sin guardar. ¿Deseas descartarla e iniciar una nueva?',
        acceptText: 'Nueva Atención',
        cancelText: 'Volver',
        isDanger: true
      });
      if (!confirmed) return;
    }
  }

  resetForm();
}

function resetForm() {
  currentContactId = null;
  lastSavedTicket = null;
  isReviewMode = false;
  isFormLocked = false;

  applyNewMode();

  document.getElementById('input-solicitante').value = '';
  document.getElementById('input-depto').value = '';
  document.getElementById('input-correo').value = '';
  document.getElementById('input-contacto').value = '';
  document.getElementById('input-folio').value = '';
  document.getElementById('input-motivo').value = '';
  document.getElementById('input-solucion').value = '';
  
  setCanalUI('telefono');
  if (categoriasList.length > 0) setCategoriaUI(categoriasList[0].nombre);
  setEstadoUI('resuelta');

  const ind = document.getElementById('indicator-contacto-vinculado');
  if (ind) ind.classList.add('hidden');

  localStorage.removeItem(DRAFT_KEY);
  document.getElementById('input-solicitante').focus();
  if (window.lucide) window.lucide.createIcons();
}

function setExportButtonsState(enabled) {
  const btnCorreo = document.getElementById('btn-enviar-correo');
  const btnPdf = document.getElementById('btn-ficha-pdf');

  [btnCorreo, btnPdf].forEach(btn => {
    if (btn) {
      btn.disabled = !enabled;
      if (enabled) {
        btn.classList.remove('opacity-40', 'pointer-events-none');
        btn.classList.add('hover:bg-border-ui', 'hover:text-text-primary');
      } else {
        btn.classList.add('opacity-40', 'pointer-events-none');
        btn.classList.remove('hover:bg-border-ui', 'hover:text-text-primary');
      }
    }
  });
}

function unlockFormForEditing() {
  isFormLocked = false;

  document.querySelectorAll('.form-field-control').forEach(el => {
    el.disabled = false;
    el.classList.remove('opacity-75', 'cursor-not-allowed');
  });

  const btnCancelarEdicion = document.getElementById('btn-cancelar-edicion');
  if (btnCancelarEdicion) btnCancelarEdicion.classList.remove('hidden');

  const btnGuardar = document.getElementById('btn-guardar');
  if (btnGuardar) {
    btnGuardar.setAttribute('data-mode', 'save');
    btnGuardar.className = 'h-9 px-4.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-2xs transition-all flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap active:scale-95';
    document.getElementById('btn-guardar-text').textContent = 'Guardar Cambios';
    const iconEl = document.getElementById('btn-guardar-icon');
    if (iconEl) {
      iconEl.setAttribute('data-lucide', 'save');
      iconEl.classList.remove('animate-spin');
    }
  }

  if (window.lucide) window.lucide.createIcons();
}

// ============================================================================
// 10. GUARDAR ASISTENCIA (SIN BLOQUEOS ANTE ERRORES)
// ============================================================================
async function guardarAsistencia() {
  const inputSolicitante = document.getElementById('input-solicitante');
  const inputMotivo = document.getElementById('input-motivo');

  const nombre = inputSolicitante?.value.trim();
  const depto = document.getElementById('input-depto')?.value.trim();
  const correo = document.getElementById('input-correo')?.value.trim();
  const contacto = document.getElementById('input-contacto')?.value.trim();
  const folio = document.getElementById('input-folio')?.value.trim();
  const motivo = inputMotivo?.value.trim();
  const solucion = document.getElementById('input-solucion')?.value.trim();

  if (!nombre) {
    showToast('Por favor indica el nombre del solicitante.', 'warning');
    inputSolicitante?.focus();
    inputSolicitante?.classList.add('ring-2', 'ring-rose-500');
    setTimeout(() => inputSolicitante?.classList.remove('ring-2', 'ring-rose-500'), 2500);
    return;
  }

  if (!motivo) {
    showToast('Por favor describe el motivo de la consulta.', 'warning');
    inputMotivo?.focus();
    inputMotivo?.classList.add('ring-2', 'ring-rose-500');
    setTimeout(() => inputMotivo?.classList.remove('ring-2', 'ring-rose-500'), 2500);
    return;
  }

  const btnGuardar = document.getElementById('btn-guardar');
  if (btnGuardar) {
    btnGuardar.disabled = true;
    document.getElementById('btn-guardar-text').textContent = 'Guardando...';
    document.getElementById('btn-guardar-icon').setAttribute('data-lucide', 'loader-2');
    document.getElementById('btn-guardar-icon').classList.add('animate-spin');
    if (window.lucide) window.lucide.createIcons();
  }

  try {
    const isUpdating = !!(lastSavedTicket && lastSavedTicket.id);
    const method = isUpdating ? 'PUT' : 'POST';
    const url = isUpdating ? `/api/asistencias/${lastSavedTicket.id}` : '/api/asistencias';

    const res = await window.api.invokeRoute({
      url,
      method,
      body: {
        solicitante_nombre: nombre,
        solicitante_cargo_depto: depto,
        solicitante_correo: correo,
        solicitante_contacto: contacto,
        canal: selectedCanal,
        categoria: selectedCategoria,
        folio_lobby: folio,
        motivo_consulta: motivo,
        solucion_orientacion: solucion,
        estado: selectedEstado,
        contacto_id: currentContactId
      }
    });

    if (btnGuardar) btnGuardar.disabled = false;

    if (res && (res.status === 200 || res.status === 201)) {
      lastSavedTicket = res.data.ticket_codigo ? res.data : { ...res.data, ticket_codigo: lastSavedTicket?.ticket_codigo || 'AST-GUARDADA' };
      localStorage.removeItem(DRAFT_KEY);

      if (window.api && window.api.notifyAssistanceSaved) {
        window.api.notifyAssistanceSaved(lastSavedTicket);
      }

      showToast(`¡Atención ${lastSavedTicket.ticket_codigo} guardada con éxito!`, 'success');
      applyReviewMode(lastSavedTicket);
    } else {
      showToast('Error al guardar: ' + (res?.data?.error || 'Error desconocido'), 'error');
      if (btnGuardar) {
        document.getElementById('btn-guardar-text').textContent = isUpdating ? 'Guardar Cambios' : 'Guardar (Ctrl+Enter)';
        document.getElementById('btn-guardar-icon').setAttribute('data-lucide', 'save');
        document.getElementById('btn-guardar-icon').classList.remove('animate-spin');
        if (window.lucide) window.lucide.createIcons();
      }
    }
  } catch (err) {
    if (btnGuardar) {
      btnGuardar.disabled = false;
      document.getElementById('btn-guardar-text').textContent = 'Guardar (Ctrl+Enter)';
      document.getElementById('btn-guardar-icon').setAttribute('data-lucide', 'save');
      document.getElementById('btn-guardar-icon').classList.remove('animate-spin');
      if (window.lucide) window.lucide.createIcons();
    }
    showToast('Error al comunicarse con la base de datos: ' + err.message, 'error');
  }
}

// ============================================================================
// 11. CORREO OUTLOOK Y FICHA PDF (FECHAS EN 24 HORAS REALES DEL TICKET)
// ============================================================================
async function prepararCorreoOutlook() {
  if (!lastSavedTicket) {
    showToast('Debes guardar la atención antes de generar el correo.', 'warning');
    return;
  }

  const nombre = document.getElementById('input-solicitante')?.value.trim() || lastSavedTicket.solicitante_nombre;
  const depto = document.getElementById('input-depto')?.value.trim() || lastSavedTicket.solicitante_cargo_depto;
  const correo = document.getElementById('input-correo')?.value.trim() || lastSavedTicket.solicitante_correo;
  const motivo = document.getElementById('input-motivo')?.value.trim() || lastSavedTicket.motivo_consulta;
  const solucion = document.getElementById('input-solucion')?.value.trim() || lastSavedTicket.solucion_orientacion;
  const folio = document.getElementById('input-folio')?.value.trim() || lastSavedTicket.folio_lobby;
  const ticket = lastSavedTicket.ticket_codigo;

  let fechaAtencionStr = '--';
  if (lastSavedTicket.fecha_hora) {
    const d = new Date(lastSavedTicket.fecha_hora);
    if (!isNaN(d.getTime())) {
      fechaAtencionStr = d.toLocaleDateString('es-CL', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
        hour12: false
      });
    } else {
      fechaAtencionStr = lastSavedTicket.fecha_hora.replace('T', ' ').substring(0, 16);
    }
  }

  const subject = `[LobbyControl] Comprobante de Asistencia Técnica N° ${ticket}`;
  const bodyHtml = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
    </head>
    <body style="margin: 0; padding: 15px 0; font-family: Calibri, Arial, sans-serif; font-size: 13px; color: #1e293b; background-color: #ffffff;">
      <table width="600" cellpadding="0" cellspacing="0" border="0" align="left" style="width: 600px; max-width: 600px; border-collapse: collapse; font-family: Calibri, Arial, sans-serif;">
        <tr>
          <td style="background-color: #0f172a; color: #ffffff; padding: 14px 18px; border: 1px solid #0f172a;">
            <div style="font-size: 15px; font-weight: bold; color: #ffffff;">MUNICIPALIDAD DE MAIPÚ — PLATAFORMA LOBBYCONTROL</div>
            <div style="font-size: 12px; color: #94a3b8; margin-top: 3px;">Comprobante Oficial de Asistencia Técnica (Ley N° 20.730 de Lobby)</div>
          </td>
        </tr>
        <tr>
          <td style="padding: 18px; border: 1px solid #cbd5e1; border-top: none; background-color: #ffffff;">
            <p style="margin: 0 0 12px 0; font-size: 13px; color: #1e293b;">
              Estimado(a) <strong>${nombre}</strong>${depto ? ' (' + depto + ')' : ''}:
            </p>
            <p style="margin: 0 0 14px 0; font-size: 13px; color: #1e293b;">
              A continuación se detalla el registro y la orientación técnica brindada a su consulta:
            </p>
            
            <table width="100%" cellpadding="6" cellspacing="0" border="1" style="width: 100%; border-collapse: collapse; border: 1px solid #cbd5e1; font-size: 12px; margin-bottom: 16px;">
              <tr style="background-color: #f8fafc;">
                <td width="140" style="padding: 8px 10px; font-weight: bold; border: 1px solid #cbd5e1; background-color: #f8fafc; color: #475569;">Ticket N°:</td>
                <td style="padding: 8px 10px; border: 1px solid #cbd5e1; font-family: monospace; font-weight: bold; color: #0284c7; font-size: 13px;">${ticket}</td>
              </tr>
              ${folio ? `
              <tr>
                <td style="padding: 8px 10px; font-weight: bold; border: 1px solid #cbd5e1; background-color: #f8fafc; color: #475569;">Folio Lobby:</td>
                <td style="padding: 8px 10px; border: 1px solid #cbd5e1; font-family: monospace; font-weight: bold; color: #334155;">${folio}</td>
              </tr>` : ''}
              <tr style="background-color: #f8fafc;">
                <td style="padding: 8px 10px; font-weight: bold; border: 1px solid #cbd5e1; background-color: #f8fafc; color: #475569;">Fecha de Atención:</td>
                <td style="padding: 8px 10px; border: 1px solid #cbd5e1; color: #334155;">${fechaAtencionStr}</td>
              </tr>
              <tr>
                <td style="padding: 8px 10px; font-weight: bold; border: 1px solid #cbd5e1; background-color: #f8fafc; color: #475569;">Motivo de Consulta:</td>
                <td style="padding: 8px 10px; border: 1px solid #cbd5e1; color: #1e293b; line-height: 1.4;">${motivo}</td>
              </tr>
              <tr style="background-color: #f0fdf4;">
                <td style="padding: 8px 10px; font-weight: bold; border: 1px solid #86efac; background-color: #f0fdf4; color: #166534;">Orientación / Solución:</td>
                <td style="padding: 8px 10px; border: 1px solid #86efac; color: #14532d; line-height: 1.4;">${(solucion || 'Atención brindada conforme a normativa.').replace(/\n/g, '<br>')}</td>
              </tr>
            </table>

            <div style="font-size: 11px; color: #64748b; margin-top: 14px; padding-top: 10px; border-top: 1px solid #e2e8f0;">
              Comprobante emitido automáticamente por la plataforma <strong>LobbyControl</strong> de la Secretaría Municipal.
            </div>
          </td>
        </tr>
      </table>
      <div id="Signature" style="display: none !important; font-size: 0; line-height: 0; mso-hide: all;"></div>
    </body>
    </html>
  `;

  if (window.api && window.api.generateEmlAndOpen) {
    const res = await window.api.generateEmlAndOpen({
      to: correo,
      subject,
      bodyHtml,
      ticketCodigo: ticket
    });
    if (!res || !res.success) {
      const mailtoUrl = `mailto:${encodeURIComponent(correo)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(`Estimado(a) ${nombre}:\n\nTicket: ${ticket}\nConsulta: ${motivo}\nOrientación: ${solucion}`)}`;
      window.location.href = mailtoUrl;
    }
  }
}

async function generarFichaPDF() {
  if (!lastSavedTicket) {
    showToast('Debes guardar la atención antes de exportar el PDF.', 'warning');
    return;
  }

  const nombre = document.getElementById('input-solicitante')?.value.trim() || lastSavedTicket.solicitante_nombre;
  const depto = document.getElementById('input-depto')?.value.trim() || lastSavedTicket.solicitante_cargo_depto;
  const correo = document.getElementById('input-correo')?.value.trim() || lastSavedTicket.solicitante_correo;
  const contacto = document.getElementById('input-contacto')?.value.trim() || lastSavedTicket.solicitante_contacto;
  const motivo = document.getElementById('input-motivo')?.value.trim() || lastSavedTicket.motivo_consulta;
  const solucion = document.getElementById('input-solucion')?.value.trim() || lastSavedTicket.solucion_orientacion;
  const folio = document.getElementById('input-folio')?.value.trim() || lastSavedTicket.folio_lobby;
  const ticket = lastSavedTicket.ticket_codigo;

  let fechaAtencionPdf = '--';
  if (lastSavedTicket.fecha_hora) {
    const d = new Date(lastSavedTicket.fecha_hora);
    if (!isNaN(d.getTime())) {
      fechaAtencionPdf = d.toLocaleDateString('es-CL', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
        hour12: false
      });
    } else {
      fechaAtencionPdf = lastSavedTicket.fecha_hora.replace('T', ' ').substring(0, 16);
    }
  }

  const savePathRes = await window.api.selectSavePath({
    defaultPath: `Ficha_Asistencia_${ticket}.pdf`
  });
  if (!savePathRes || !savePathRes.filePath) return;

  const htmlPdf = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 11px; color: #1e293b; padding: 25px; line-height: 1.4; }
        .header { border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 18px; }
        .title { font-size: 16px; font-weight: bold; color: #0f172a; }
        .subtitle { font-size: 11px; color: #64748b; margin-top: 3px; }
        .badge { font-family: monospace; font-size: 13px; font-weight: bold; color: #0284c7; background: #e0f2fe; padding: 4px 8px; border-radius: 4px; display: inline-block; }
        .table-info { width: 100%; border-collapse: collapse; margin-top: 15px; }
        .table-info td { padding: 7px 10px; border: 1px solid #cbd5e1; }
        .table-info td.label { font-weight: bold; background: #f8fafc; width: 140px; }
        .box-solucion { background: #f0fdf4; border: 1px solid #86efac; border-radius: 6px; padding: 12px; margin-top: 15px; }
        .footer { margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 10px; font-size: 9px; color: #94a3b8; text-align: center; }
      </style>
    </head>
    <body>
      <div class="header">
        <table style="width: 100%;">
          <tr>
            <td>
              <div class="title">MUNICIPALIDAD DE MAIPÚ</div>
              <div class="subtitle">Secretaría Municipal — Plataforma LobbyControl (Ley N° 20.730)</div>
              <div class="subtitle">Ficha de Asistencia Técnica y Orientación Normativa</div>
            </td>
            <td style="text-align: right;">
              <div class="badge">${ticket}</div>
              <div style="font-size: 10px; color: #64748b; margin-top: 4px;">Fecha: ${fechaAtencionPdf}</div>
            </td>
          </tr>
        </table>
      </div>

      <table class="table-info">
        <tr>
          <td class="label">Funcionario / Solicitante:</td>
          <td><strong>${nombre}</strong></td>
        </tr>
        <tr>
          <td class="label">Dirección / Depto:</td>
          <td>${depto || 'No especificado'}</td>
        </tr>
        <tr>
          <td class="label">Correo / Contacto:</td>
          <td>${correo || ''} ${contacto ? ' (' + contacto + ')' : ''}</td>
        </tr>
        <tr>
          <td class="label">Canal y Categoría:</td>
          <td>Canal: ${selectedCanal.toUpperCase()} | Materia: ${selectedCategoria.toUpperCase()}</td>
        </tr>
        ${folio ? `<tr><td class="label">Folio Vinculado:</td><td><code>${folio}</code></td></tr>` : ''}
        <tr>
          <td class="label">Motivo de Consulta:</td>
          <td>${motivo}</td>
        </tr>
      </table>

      <div class="box-solucion">
        <strong style="color: #166534;">ORIENTACIÓN Y SOLUCIÓN BRINDADA:</strong>
        <p style="margin: 6px 0 0 0; color: #14532d;">${(solucion || 'Atención concluida satisfactoriamente.').replace(/\n/g, '<br>')}</p>
      </div>

      <div class="footer">
        Documento generado automáticamente por LobbyControl — Municipalidad de Maipú.
      </div>
    </body>
    </html>
  `;

  const pdfRes = await window.api.generateSilentPdf({
    html: htmlPdf,
    filePath: savePathRes.filePath
  });

  if (pdfRes && pdfRes.success) {
    showToast('Ficha PDF guardada exitosamente.', 'success');
  } else {
    showToast('Error al generar PDF: ' + (pdfRes?.error || 'Error desconocido'), 'error');
  }
}
