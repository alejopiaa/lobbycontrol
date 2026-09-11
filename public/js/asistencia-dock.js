/**
 * asistencia-dock.js
 * Panel Flotante Anclado (Docked Panel) de Asistencia Técnica - LobbyControl
 * 
 * Flujo de interacción:
 *  - Por defecto: Totalmente oculto (interfaz 100% limpia)
 *  - F9 / Ctrl+Shift+A / Botón Header: Abre el panel en la esquina inferior derecha
 *  - No bloqueante: Toda la app detrás sigue interactiva (scroll, navegación, filtros)
 *  - Botón Minimizar [—] o F9: Pliega a una píldora en el footer sin perder datos
 *  - Botón Cerrar [✕] o Descartar: Cierra y oculta por completo
 */

(function () {
  'use strict';

  // ─── Estado interno del Dock ──────────────────────────────────────────────
  let dockContactId = null;
  let dockLastSavedTicket = null;
  let dockSelectedCanal = 'telefono';
  let dockSelectedCategoria = 'Plazos Legales (3 Días / Publicación)';
  let dockSelectedEstado = 'resuelta';
  let dockCategoriasList = [];
  let dockDireccionesList = [];
  let dockAutoridadesList = [];
  let dockIsFormLocked = false;
  let dockIsReviewMode = false;
  let dockFechaAirDatepicker = null;
  let dockDebounceTimeout = null;
  const DOCK_DRAFT_KEY = 'lobby_asistencia_dock_draft_v1';

  // ─── Inicialización al cargar el DOM ──────────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    initDockListeners();
    initDockKeyboardShortcuts();
    initDockLiveClock();
    initDockPhoneRestriction();
    initDockAutocomplete();
    initDockFolioAutocomplete();
    initDockCustomDropdowns();
    initDockDeptoCombobox();
    initDockRepresentadoCombobox();
    initDockDraftAutosave();

    // Carga perezosa de catálogos
    loadDockCatalogs();

    // Escuchar trigger desde proceso principal de Electron (atajo global OS)
    if (window.api && window.api.onTriggerToggleAssistance) {
      window.api.onTriggerToggleAssistance((id) => {
        toggleAssistanceDock(id);
      });
    }

    if (window.api && window.api.onCategoriasUpdated) {
      window.api.onCategoriasUpdated(() => {
        loadDockCategorias();
      });
    }
  });

  // ─── Catálogos ────────────────────────────────────────────────────────────
  async function loadDockCatalogs() {
    await Promise.all([loadDockCategorias(), loadDockDirecciones(), loadDockAutoridades()]);
  }

  async function loadDockCategorias() {
    try {
      const res = await window.api.invokeRoute({ url: '/api/asistencias/categorias', method: 'GET' });
      if (res && res.status === 200 && Array.isArray(res.data)) {
        dockCategoriasList = res.data;
      }
    } catch (e) {
      console.warn('[AsistenciaDock] Error al cargar categorías:', e);
    }

    if (!dockCategoriasList || dockCategoriasList.length === 0) {
      dockCategoriasList = [
        { id: 1, nombre: 'Plazos Legales (3 Días / Publicación)' },
        { id: 2, nombre: 'Plataforma / ClaveÚnica' },
        { id: 3, nombre: 'Sujetos Pasivos / Suplencias' },
        { id: 4, nombre: 'Derivaciones / Improcedencia' },
        { id: 5, nombre: 'Carga de Actas y Respuestas' },
        { id: 6, nombre: 'Normativa Ley N° 20.730' },
        { id: 7, nombre: 'Consulta General / Otro' }
      ];
    }

    const existe = dockCategoriasList.some(c => c.nombre === dockSelectedCategoria);
    if (!existe && dockCategoriasList.length > 0) {
      setDockCategoriaUI(dockCategoriasList[0].nombre);
    }
    renderDockCategoriasDropdown();
  }

  function renderDockCategoriasDropdown() {
    const container = document.getElementById('dock-list-categorias-options');
    if (!container) return;

    container.innerHTML = dockCategoriasList.map(cat => `
      <button type="button" class="dock-option-categoria w-full px-3.5 py-2 text-left text-xs font-medium hover:bg-border-ui flex items-center gap-2 cursor-pointer ${dockSelectedCategoria === cat.nombre ? 'font-bold text-brand-600 dark:text-brand-400' : 'text-text-primary'}" data-value="${cat.nombre}">
        <i data-lucide="tag" class="h-3.5 w-3.5 text-text-tertiary shrink-0"></i>
        <span class="leading-snug text-left whitespace-normal break-words">${cat.nombre}</span>
      </button>
    `).join('');

    if (window.lucide) window.lucide.createIcons();

    container.querySelectorAll('.dock-option-categoria').forEach(btn => {
      btn.addEventListener('click', () => {
        dockSelectedCategoria = btn.getAttribute('data-value');
        setDockCategoriaUI(dockSelectedCategoria);
        document.getElementById('dock-menu-dropdown-categoria')?.classList.add('hidden');
        saveDockDraft();
      });
    });
  }

  async function loadDockDirecciones() {
    try {
      const res = await window.api.invokeRoute({ url: '/api/direcciones', method: 'GET' });
      if (res && res.status === 200 && Array.isArray(res.data)) {
        dockDireccionesList = res.data;
      } else {
        dockDireccionesList = [];
      }
    } catch (e) {
      console.warn('[AsistenciaDock] Error al cargar direcciones:', e);
      dockDireccionesList = [];
    }
    renderDockDireccionesDropdown(dockDireccionesList);
  }

  async function loadDockAutoridades() {
    try {
      const res = await window.api.invokeRoute({ url: '/api/sujetos_pasivos/vigentes-nombres', method: 'GET' });
      if (res && res.status === 200 && Array.isArray(res.data)) {
        dockAutoridadesList = res.data;
      } else {
        dockAutoridadesList = [];
      }
    } catch (e) {
      console.warn('[AsistenciaDock] Error al cargar autoridades:', e);
      dockAutoridadesList = [];
    }
  }

  // ─── Control del Ciclo de Vida: Abrir / Minimizar / Cerrar / Toggle ───────
  function openAssistanceDock(id = null) {
    const panel = document.getElementById('asistencia-dock-panel');
    const tab = document.getElementById('asistencia-dock-tab');
    if (!panel) return;

    panel.classList.remove('hidden');
    if (tab) tab.classList.add('hidden');

    // Inicializar Datepicker si no existe
    initDockFechaAirDatepicker();

    // Carga perezosa defensiva si los catálogos aún no están en memoria
    if (!dockDireccionesList.length || !dockAutoridadesList.length) {
      loadDockCatalogs();
    }

    if (id) {
      loadDockAsistenciaParaEdicion(id);
    } else {
      // Si no hay ticket cargado ni borrador activo, aplicar modo nuevo
      if (!dockLastSavedTicket && !hasDockDraft()) {
        applyDockNewMode();
      }
    }

    if (window.lucide) window.lucide.createIcons();

    // Auto-focus en nombre del solicitante si está editable
    setTimeout(() => {
      const inputSol = document.getElementById('dock-input-solicitante');
      if (inputSol && !dockIsFormLocked) inputSol.focus();
    }, 100);
  }

  function minimizeAssistanceDock() {
    const panel = document.getElementById('asistencia-dock-panel');
    const tab = document.getElementById('asistencia-dock-tab');
    if (!panel) return;

    panel.classList.add('hidden');
    if (tab) {
      tab.classList.remove('hidden');
      updateDockTabBadge();
    }

    saveDockDraft();
    if (window.lucide) window.lucide.createIcons();
  }

  async function closeAssistanceDock() {
    const executeClose = () => {
      const panel = document.getElementById('asistencia-dock-panel');
      const tab = document.getElementById('asistencia-dock-tab');

      if (panel) panel.classList.add('hidden');
      if (tab) tab.classList.add('hidden');

      resetDockForm();
    };

    if (hasDockUnsavedChanges()) {
      if (typeof window.openConfirmModal === 'function') {
        window.openConfirmModal(
          'Descartar y Cerrar',
          'Hay datos ingresados sin guardar en la ficha de atención. ¿Deseas descartarlos y cerrar?',
          () => {
            executeClose();
          }
        );
      } else {
        executeClose();
      }
    } else {
      executeClose();
    }
  }

  function toggleAssistanceDock(id = null) {
    const panel = document.getElementById('asistencia-dock-panel');
    const tab = document.getElementById('asistencia-dock-tab');

    if (panel && !panel.classList.contains('hidden')) {
      // Panel abierto -> Minimizar
      minimizeAssistanceDock();
    } else if (tab && !tab.classList.contains('hidden')) {
      // Pestaña minimizada -> Expandir
      openAssistanceDock(id);
    } else {
      // Oculto por completo -> Abrir
      openAssistanceDock(id);
    }
  }

  function updateDockTabBadge() {
    const badge = document.getElementById('dock-tab-badge');
    if (!badge) return;

    if (dockLastSavedTicket && dockLastSavedTicket.ticket_codigo) {
      badge.textContent = dockLastSavedTicket.ticket_codigo;
      badge.className = 'px-1.5 py-0.5 rounded font-mono text-[9px] font-bold bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20';
    } else {
      const sol = document.getElementById('dock-input-solicitante')?.value.trim();
      badge.textContent = sol ? sol.substring(0, 14) + '...' : 'AST-NUEVA';
      badge.className = 'px-1.5 py-0.5 rounded font-mono text-[9px] font-bold bg-border-ui text-text-secondary border border-border-ui';
    }
  }

  function hasDockUnsavedChanges() {
    if (dockIsReviewMode || dockIsFormLocked) return false;
    const sol = document.getElementById('dock-input-solicitante')?.value.trim();
    const mot = document.getElementById('dock-input-motivo')?.value.trim();
    const soluc = document.getElementById('dock-input-solucion')?.value.trim();
    return !!(sol || mot || soluc);
  }

  function hasDockDraft() {
    return !!localStorage.getItem(DOCK_DRAFT_KEY);
  }

  // ─── Listeners de Botones y Atajos ────────────────────────────────────────
  function initDockListeners() {
    // Minimizar y Cerrar de cabecera
    document.getElementById('dock-btn-minimize')?.addEventListener('click', minimizeAssistanceDock);
    document.getElementById('dock-btn-close')?.addEventListener('click', closeAssistanceDock);

    // Botones de pie
    const btnGuardar = document.getElementById('dock-btn-guardar');
    if (btnGuardar) {
      btnGuardar.addEventListener('click', () => {
        const mode = btnGuardar.getAttribute('data-mode');
        if (mode === 'edit') {
          unlockDockFormForEditing();
        } else {
          guardarDockAsistencia();
        }
      });
    }

    document.getElementById('dock-btn-cancelar-edicion')?.addEventListener('click', () => {
      if (dockLastSavedTicket && dockLastSavedTicket.id) {
        loadDockAsistenciaParaEdicion(dockLastSavedTicket.id);
        if (window.showToast) showToast('Edición cancelada.', 'info');
      }
    });

    document.getElementById('dock-btn-descartar')?.addEventListener('click', handleDockDescartar);
    document.getElementById('dock-btn-nueva-llamada')?.addEventListener('click', handleDockNueva);
    document.getElementById('dock-btn-enviar-correo')?.addEventListener('click', prepararDockCorreoOutlook);
    document.getElementById('dock-btn-ficha-pdf')?.addEventListener('click', generarDockFichaPDF);
  }

  function initDockKeyboardShortcuts() {
    // F9 y Ctrl+Shift+A (o Ctrl+Alt+A) para alternar el Dock
    window.addEventListener('keydown', (e) => {
      const isF9 = e.key === 'F9';
      const isCtrlShiftA = ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'A' || e.key === 'a'));
      const isCtrlAltA = ((e.ctrlKey || e.metaKey) && e.altKey && (e.key === 'A' || e.key === 'a'));

      if (isF9 || isCtrlShiftA || isCtrlAltA) {
        e.preventDefault();
        toggleAssistanceDock();
        return;
      }

      // Ctrl + Enter para guardar si el dock está enfocado/abierto
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        const panel = document.getElementById('asistencia-dock-panel');
        if (panel && !panel.classList.contains('hidden')) {
          const btnGuardar = document.getElementById('dock-btn-guardar');
          if (btnGuardar && btnGuardar.getAttribute('data-mode') !== 'edit') {
            e.preventDefault();
            guardarDockAsistencia();
          }
        }
      }

      // Esc para minimizar si el dock está abierto y no hay menú desplegado
      if (e.key === 'Escape') {
        const panel = document.getElementById('asistencia-dock-panel');
        if (panel && !panel.classList.contains('hidden')) {
          const hasOpenDropdown = panel.querySelector('.dock-dropdown-menu:not(.hidden)');
          if (!hasOpenDropdown) {
            minimizeAssistanceDock();
          }
        }
      }
    });
  }

  // ─── Reloj en Vivo ────────────────────────────────────────────────────────
  function initDockLiveClock() {
    const clockEl = document.getElementById('dock-live-clock');
    if (!clockEl) return;

    const update = () => {
      const now = new Date();
      const options = { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false };
      clockEl.textContent = now.toLocaleDateString('es-CL', options);
    };
    update();
    setInterval(update, 1000);
  }

  // ─── Air Datepicker ───────────────────────────────────────────────────────
  function initDockFechaAirDatepicker() {
    const input = document.getElementById('dock-input-fecha-atencion');
    if (!input || typeof AirDatepicker === 'undefined' || dockFechaAirDatepicker) return;

    const locale = (typeof window.AirDatepickerLocaleEs !== 'undefined')
      ? window.AirDatepickerLocaleEs
      : undefined;

    dockFechaAirDatepicker = new AirDatepicker(input, {
      locale: locale,
      timepicker: true,
      timeFormat: 'HH:mm',
      dateFormat: 'dd/MM/yyyy',
      autoClose: false,
      selectedDates: [new Date()],
      buttons: ['today', 'clear'],
      isMobile: false,
      position: 'top left'
    });

    const triggerBtn = document.getElementById('dock-btn-trigger-fecha');
    if (triggerBtn) {
      triggerBtn.addEventListener('click', () => {
        if (!dockIsFormLocked && dockFechaAirDatepicker) {
          if (dockFechaAirDatepicker.visible) {
            dockFechaAirDatepicker.hide();
          } else {
            dockFechaAirDatepicker.show();
          }
        }
      });
    }
  }

  // ─── Modos: Nuevo vs Revisión/Edición ─────────────────────────────────────
  function applyDockNewMode() {
    dockIsReviewMode = false;
    dockIsFormLocked = false;
    dockLastSavedTicket = null;

    document.querySelectorAll('#asistencia-dock-panel .form-field-control').forEach(el => {
      el.disabled = false;
      el.classList.remove('opacity-75', 'cursor-not-allowed');
    });

    const triggerBtn = document.getElementById('dock-btn-trigger-fecha');
    if (triggerBtn) {
      triggerBtn.disabled = false;
      triggerBtn.classList.remove('opacity-50', 'pointer-events-none');
    }

    if (dockFechaAirDatepicker) {
      dockFechaAirDatepicker.clear();
      dockFechaAirDatepicker.selectDate(new Date());
    }

    const btnDescartar = document.getElementById('dock-btn-descartar');
    const btnNueva = document.getElementById('dock-btn-nueva-llamada');
    const btnCancelarEdicion = document.getElementById('dock-btn-cancelar-edicion');
    if (btnDescartar) btnDescartar.classList.remove('hidden');
    if (btnNueva) btnNueva.classList.remove('hidden');
    if (btnCancelarEdicion) btnCancelarEdicion.classList.add('hidden');

    setDockExportButtonsState(false);

    const btnGuardar = document.getElementById('dock-btn-guardar');
    if (btnGuardar) {
      btnGuardar.setAttribute('data-mode', 'save');
      btnGuardar.className = 'flex-1 w-full h-8.5 px-4 rounded-xl text-xs font-bold bg-brand-600 hover:bg-brand-500 text-white shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap active:scale-[0.99]';
      document.getElementById('dock-btn-guardar-text').textContent = 'Guardar (Ctrl+Enter)';
      const iconEl = document.getElementById('dock-btn-guardar-icon');
      if (iconEl) {
        iconEl.setAttribute('data-lucide', 'save');
        iconEl.classList.remove('animate-spin');
      }
    }

    const badge = document.getElementById('dock-badge-ticket-draft');
    if (badge) {
      badge.textContent = 'AST-NUEVA';
      badge.className = 'px-1.5 py-0.5 rounded font-mono text-[9px] font-bold bg-border-ui text-text-secondary border border-border-ui';
    }

    updateDockTabBadge();
    if (window.lucide) window.lucide.createIcons();
  }

  function applyDockReviewMode(ticket) {
    dockIsReviewMode = true;
    dockIsFormLocked = true;
    dockLastSavedTicket = ticket;

    document.querySelectorAll('#asistencia-dock-panel .form-field-control').forEach(el => {
      el.disabled = true;
      el.classList.add('opacity-75', 'cursor-not-allowed');
    });

    const triggerBtn = document.getElementById('dock-btn-trigger-fecha');
    if (triggerBtn) {
      triggerBtn.disabled = true;
      triggerBtn.classList.add('opacity-50', 'pointer-events-none');
    }

    const btnDescartar = document.getElementById('dock-btn-descartar');
    const btnNueva = document.getElementById('dock-btn-nueva-llamada');
    const btnCancelarEdicion = document.getElementById('dock-btn-cancelar-edicion');
    if (btnDescartar) btnDescartar.classList.add('hidden');
    if (btnNueva) btnNueva.classList.add('hidden');
    if (btnCancelarEdicion) btnCancelarEdicion.classList.add('hidden');

    setDockExportButtonsState(true);

    const btnGuardar = document.getElementById('dock-btn-guardar');
    if (btnGuardar) {
      btnGuardar.setAttribute('data-mode', 'edit');
      btnGuardar.className = 'flex-1 w-full h-8.5 px-4 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap active:scale-[0.99]';
      document.getElementById('dock-btn-guardar-text').textContent = 'Editar';
      const iconEl = document.getElementById('dock-btn-guardar-icon');
      if (iconEl) {
        iconEl.setAttribute('data-lucide', 'edit-3');
        iconEl.classList.remove('animate-spin');
      }
    }

    const badge = document.getElementById('dock-badge-ticket-draft');
    if (badge && ticket) {
      badge.textContent = ticket.ticket_codigo;
      badge.className = 'px-1.5 py-0.5 rounded font-mono text-[9px] font-bold bg-brand-50 dark:bg-brand-950/40 text-brand-700 dark:text-brand-300 border border-brand-300 dark:border-brand-800';
    }

    updateDockTabBadge();
    if (window.lucide) window.lucide.createIcons();
  }

  function unlockDockFormForEditing() {
    dockIsFormLocked = false;

    document.querySelectorAll('#asistencia-dock-panel .form-field-control').forEach(el => {
      el.disabled = false;
      el.classList.remove('opacity-75', 'cursor-not-allowed');
    });

    const triggerBtn = document.getElementById('dock-btn-trigger-fecha');
    if (triggerBtn) {
      triggerBtn.disabled = false;
      triggerBtn.classList.remove('opacity-50', 'pointer-events-none');
    }

    const btnCancelarEdicion = document.getElementById('dock-btn-cancelar-edicion');
    if (btnCancelarEdicion) btnCancelarEdicion.classList.remove('hidden');

    const btnGuardar = document.getElementById('dock-btn-guardar');
    if (btnGuardar) {
      btnGuardar.setAttribute('data-mode', 'save');
      btnGuardar.className = 'flex-1 w-full h-8.5 px-4 rounded-xl text-xs font-bold bg-brand-600 hover:bg-brand-500 text-white shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap active:scale-[0.99]';
      document.getElementById('dock-btn-guardar-text').textContent = 'Guardar Cambios';
      const iconEl = document.getElementById('dock-btn-guardar-icon');
      if (iconEl) {
        iconEl.setAttribute('data-lucide', 'save');
        iconEl.classList.remove('animate-spin');
      }
    }

    if (window.lucide) window.lucide.createIcons();
  }

  function setDockExportButtonsState(enabled) {
    const btnCorreo = document.getElementById('dock-btn-enviar-correo');
    const btnPdf = document.getElementById('dock-btn-ficha-pdf');

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

  // ─── Carga de Asistencia para Edición ─────────────────────────────────────
  async function loadDockAsistenciaParaEdicion(id) {
    if (!id) return;
    try {
      const res = await window.api.invokeRoute({ url: `/api/asistencias/${id}`, method: 'GET' });
      if (res && res.status === 200 && res.data) {
        const ast = res.data;
        dockLastSavedTicket = ast;
        dockContactId = ast.contacto_id || null;

        const inputSolicitante = document.getElementById('dock-input-solicitante');
        const inputDireccion = document.getElementById('dock-input-direccion');
        const inputCorreo = document.getElementById('dock-input-correo');
        const inputTelefono = document.getElementById('dock-input-telefono');
        const inputRepresentado = document.getElementById('dock-input-representado');
        const inputRepresentadoId = document.getElementById('dock-input-representado-id');
        const clearRepresentadoBtn = document.getElementById('dock-btn-clear-representado');
        const inputFolio = document.getElementById('dock-input-folio');
        const inputMotivo = document.getElementById('dock-input-motivo');
        const inputSolucion = document.getElementById('dock-input-solucion');

        if (inputSolicitante) inputSolicitante.value = ast.solicitante_nombre || '';
        if (inputDireccion) inputDireccion.value = ast.solicitante_direccion || ast.solicitante_cargo_depto || '';
        if (inputCorreo) inputCorreo.value = ast.solicitante_correo || '';
        if (inputTelefono) inputTelefono.value = ast.solicitante_telefono || ast.solicitante_contacto || '';
        if (inputRepresentado) inputRepresentado.value = ast.representado || '';
        if (inputRepresentadoId) inputRepresentadoId.value = ast.representado_id_lobby || '';
        if (inputFolio) inputFolio.value = ast.folio_lobby || '';
        if (inputMotivo) inputMotivo.value = ast.motivo_consulta || '';
        if (inputSolucion) inputSolucion.value = ast.solucion_orientacion || '';

        if (ast.representado) {
          if (clearRepresentadoBtn) clearRepresentadoBtn.classList.remove('hidden');
          const exists = dockAutoridadesList.some(a => a.cargo === ast.representado || (ast.representado_id_lobby && a.id_sujeto_lobby === ast.representado_id_lobby));
          if (!exists) {
            dockAutoridadesList.unshift({
              id_sujeto_lobby: ast.representado_id_lobby || null,
              cargo: ast.representado,
              esHistorico: true
            });
          }
        } else {
          if (clearRepresentadoBtn) clearRepresentadoBtn.classList.add('hidden');
        }

        setDockCanalUI(ast.canal || 'telefono');
        const catFound = dockCategoriasList.find(c => c.slug === ast.categoria || c.nombre === ast.categoria);
        setDockCategoriaUI(catFound ? catFound.nombre : (ast.categoria || 'Plazos Legales (3 Días / Publicación)'));
        setDockEstadoUI(ast.estado || 'resuelta');

        if (ast.fecha_hora && dockFechaAirDatepicker) {
          const isoStr = ast.fecha_hora.replace(' ', 'T');
          const d = new Date(isoStr);
          if (!isNaN(d.getTime())) {
            dockFechaAirDatepicker.clear();
            dockFechaAirDatepicker.selectDate(d);
          }
        }

        applyDockReviewMode(ast);
      }
    } catch (err) {
      if (window.showToast) showToast('Error al cargar la asistencia: ' + err.message, 'error');
    }
  }

  // ─── Dropdowns de UI ──────────────────────────────────────────────────────
  function initDockCustomDropdowns() {
    setupDockDropdownToggle('dock-btn-dropdown-canal', 'dock-menu-dropdown-canal');
    setupDockDropdownToggle('dock-btn-dropdown-categoria', 'dock-menu-dropdown-categoria');
    setupDockDropdownToggle('dock-btn-dropdown-estado', 'dock-menu-dropdown-estado');

    document.querySelectorAll('.dock-option-canal').forEach(btn => {
      btn.addEventListener('click', () => {
        dockSelectedCanal = btn.getAttribute('data-value') || 'telefono';
        setDockCanalUI(dockSelectedCanal);
        document.getElementById('dock-menu-dropdown-canal')?.classList.add('hidden');
        saveDockDraft();
      });
    });

    document.querySelectorAll('.dock-option-estado').forEach(btn => {
      btn.addEventListener('click', () => {
        dockSelectedEstado = btn.getAttribute('data-value') || 'resuelta';
        setDockEstadoUI(dockSelectedEstado);
        document.getElementById('dock-menu-dropdown-estado')?.classList.add('hidden');
        saveDockDraft();
      });
    });

    document.addEventListener('click', (e) => {
      ['canal', 'categoria', 'estado'].forEach(m => {
        const btn = document.getElementById(`dock-btn-dropdown-${m}`);
        const menu = document.getElementById(`dock-menu-dropdown-${m}`);
        if (btn && menu && !btn.contains(e.target) && !menu.contains(e.target)) {
          menu.classList.add('hidden');
        }
      });
    });
  }

  function setupDockDropdownToggle(btnId, menuId) {
    const btn = document.getElementById(btnId);
    const menu = document.getElementById(menuId);
    if (!btn || !menu) return;

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (dockIsFormLocked) return;
      document.querySelectorAll('#asistencia-dock-panel .dock-dropdown-menu').forEach(d => {
        if (d !== menu) d.classList.add('hidden');
      });
      menu.classList.toggle('hidden');
    });
  }

  function setDockCanalUI(canal) {
    dockSelectedCanal = canal || 'telefono';
    const iconMap = { telefono: 'phone', correo: 'mail', presencial: 'users', teams: 'message-square' };
    const labelMap = { telefono: 'Teléfono', correo: 'Correo', presencial: 'Presencial', teams: 'Teams' };
    const label = document.getElementById('dock-selected-canal-label');
    if (label) {
      label.innerHTML = `<i data-lucide="${iconMap[dockSelectedCanal] || 'phone'}" class="h-3.5 w-3.5 text-brand-500 shrink-0"></i><span>${labelMap[dockSelectedCanal] || 'Teléfono'}</span>`;
      if (window.lucide) window.lucide.createIcons();
    }
  }

  function setDockCategoriaUI(cat) {
    dockSelectedCategoria = cat || 'Plazos Legales (3 Días / Publicación)';
    const label = document.getElementById('dock-selected-categoria-label');
    if (label) {
      label.title = dockSelectedCategoria;
      label.innerHTML = `<i data-lucide="tag" class="h-3.5 w-3.5 text-brand-500 shrink-0"></i><span class="truncate">${dockSelectedCategoria}</span>`;
      if (window.lucide) window.lucide.createIcons();
    }
    const btn = document.getElementById('dock-btn-dropdown-categoria');
    if (btn) btn.title = dockSelectedCategoria;
  }

  function setDockEstadoUI(est) {
    dockSelectedEstado = est || 'resuelta';
    const colorMap = { resuelta: 'bg-emerald-500', en_seguimiento: 'bg-amber-500', derivada: 'bg-blue-500' };
    const labelMap = { resuelta: 'Resuelta', en_seguimiento: 'En Seguimiento', derivada: 'Derivada' };
    const label = document.getElementById('dock-selected-estado-label');
    if (label) {
      label.innerHTML = `<span class="h-2 w-2 rounded-full ${colorMap[dockSelectedEstado] || 'bg-emerald-500'}"></span><span>${labelMap[dockSelectedEstado] || 'Resuelta'}</span>`;
    }
  }

  // ─── Combobox de Direcciones y Representado ────────────────────────────────
  function initDockDeptoCombobox() {
    const input = document.getElementById('dock-input-direccion');
    const toggleBtn = document.getElementById('dock-btn-toggle-direccion-dropdown');
    const menu = document.getElementById('dock-menu-dropdown-direccion');
    if (!input || !menu) return;

    const showMenu = async () => {
      if (dockIsFormLocked) return;
      if (!dockDireccionesList || dockDireccionesList.length === 0) {
        await loadDockDirecciones();
      }
      const val = input.value.trim().toLowerCase();
      const filtered = val ? dockDireccionesList.filter(d => (d.acronimo && d.acronimo.toLowerCase().includes(val)) || (d.nombre && d.nombre.toLowerCase().includes(val))) : dockDireccionesList;
      renderDockDireccionesDropdown(filtered);
      menu.classList.remove('hidden');
    };

    input.addEventListener('focus', showMenu);
    input.addEventListener('input', showMenu);

    if (toggleBtn) {
      toggleBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (dockIsFormLocked) return;
        if (menu.classList.contains('hidden')) {
          if (!dockDireccionesList || dockDireccionesList.length === 0) {
            await loadDockDirecciones();
          }
          renderDockDireccionesDropdown(dockDireccionesList);
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

  function renderDockDireccionesDropdown(list) {
    const menu = document.getElementById('dock-menu-dropdown-direccion');
    if (!menu) return;

    if (!list || list.length === 0) {
      menu.innerHTML = '<div class="p-3 text-[11px] text-text-tertiary text-center">Sin coincidencias</div>';
      return;
    }

    menu.innerHTML = list.map(d => `
      <button type="button" class="dock-option-direccion w-full px-3.5 py-2 text-left hover:bg-border-ui flex items-center justify-between gap-2 cursor-pointer" data-acronimo="${d.acronimo}">
        <span class="font-bold text-xs text-brand-600 dark:text-brand-400 font-mono">${d.acronimo}</span>
        <span class="text-[11px] text-text-tertiary truncate text-right">${d.nombre}</span>
      </button>
    `).join('');

    menu.querySelectorAll('.dock-option-direccion').forEach(btn => {
      btn.addEventListener('click', () => {
        const acronimo = btn.getAttribute('data-acronimo');
        const input = document.getElementById('dock-input-direccion');
        if (input) input.value = acronimo;
        menu.classList.add('hidden');
        saveDockDraft();
      });
    });
  }

  function initDockRepresentadoCombobox() {
    const input = document.getElementById('dock-input-representado');
    const inputHidden = document.getElementById('dock-input-representado-id');
    const toggleBtn = document.getElementById('dock-btn-toggle-representado-dropdown');
    const clearBtn = document.getElementById('dock-btn-clear-representado');
    const menu = document.getElementById('dock-menu-dropdown-representado');
    if (!input || !menu) return;

    const normalize = (str) => (str || '').normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

    const showMenu = async () => {
      if (dockIsFormLocked) return;
      if (!dockAutoridadesList || dockAutoridadesList.length === 0) {
        await loadDockAutoridades();
      }
      const val = normalize(input.value.trim());
      const filtered = val ? dockAutoridadesList.filter(a => a.cargo && normalize(a.cargo).includes(val)) : dockAutoridadesList;
      renderDockRepresentadoDropdown(filtered);
      menu.classList.remove('hidden');
    };

    input.addEventListener('focus', showMenu);
    input.addEventListener('input', () => {
      const val = input.value.trim();
      if (!val) {
        if (clearBtn) clearBtn.classList.add('hidden');
        if (inputHidden) inputHidden.value = '';
      } else {
        if (clearBtn) clearBtn.classList.remove('hidden');
      }
      showMenu();
      saveDockDraft();
    });

    if (clearBtn) {
      clearBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (dockIsFormLocked) return;
        input.value = '';
        if (inputHidden) inputHidden.value = '';
        clearBtn.classList.add('hidden');
        menu.classList.add('hidden');
        saveDockDraft();
        input.focus();
      });
    }

    if (toggleBtn) {
      toggleBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (dockIsFormLocked) return;
        if (menu.classList.contains('hidden')) {
          if (!dockAutoridadesList || dockAutoridadesList.length === 0) {
            await loadDockAutoridades();
          }
          renderDockRepresentadoDropdown(dockAutoridadesList);
          menu.classList.remove('hidden');
        } else {
          menu.classList.add('hidden');
        }
      });
    }

    document.addEventListener('click', (e) => {
      if (!input.contains(e.target) && !menu.contains(e.target) && (!toggleBtn || !toggleBtn.contains(e.target)) && (!clearBtn || !clearBtn.contains(e.target))) {
        menu.classList.add('hidden');
      }
    });
  }

  function renderDockRepresentadoDropdown(list) {
    const menu = document.getElementById('dock-menu-dropdown-representado');
    if (!menu) return;

    if (!list || list.length === 0) {
      menu.innerHTML = '<div class="p-3 text-[11px] text-text-tertiary text-center">Sin coincidencias</div>';
      return;
    }

    menu.innerHTML = list.map(a => `
      <button type="button" class="dock-option-representado w-full px-3.5 py-2 text-left hover:bg-border-ui flex items-center justify-between gap-2 cursor-pointer transition-colors" data-id="${a.id_sujeto_lobby || ''}" data-cargo="${(a.cargo || '').replace(/"/g, '&quot;')}">
        <span class="text-xs text-text-primary font-medium leading-snug break-words">${a.cargo}${a.esHistorico ? ' <span class="text-[10px] text-amber-600 dark:text-amber-400 font-normal">(Histórico)</span>' : ''}</span>
      </button>
    `).join('');

    menu.querySelectorAll('.dock-option-representado').forEach(btn => {
      btn.addEventListener('click', () => {
        const cargo = btn.getAttribute('data-cargo');
        const idSujeto = btn.getAttribute('data-id');
        const input = document.getElementById('dock-input-representado');
        const inputHidden = document.getElementById('dock-input-representado-id');
        const clearBtn = document.getElementById('dock-btn-clear-representado');

        if (input) input.value = cargo;
        if (inputHidden) inputHidden.value = idSujeto || '';
        if (clearBtn) clearBtn.classList.remove('hidden');
        menu.classList.add('hidden');
        saveDockDraft();
      });
    });
  }

  // ─── Autocompletado de Solicitantes y Restricción de Teléfono ──────────────
  function initDockPhoneRestriction() {
    const input = document.getElementById('dock-input-telefono');
    if (!input) return;
    input.addEventListener('input', () => {
      input.value = input.value.replace(/[^0-9]/g, '');
      saveDockDraft();
    });
  }

  function initDockAutocomplete() {
    const input = document.getElementById('dock-input-solicitante');
    const suggestionsBox = document.getElementById('dock-autocomplete-suggestions');
    if (!input || !suggestionsBox) return;

    input.addEventListener('input', () => {
      if (dockIsFormLocked) return;
      const val = input.value.trim();
      dockContactId = null;
      document.getElementById('dock-indicator-contacto-vinculado')?.classList.add('hidden');

      if (val.length < 2) {
        suggestionsBox.classList.add('hidden');
        suggestionsBox.innerHTML = '';
        return;
      }

      clearTimeout(dockDebounceTimeout);
      dockDebounceTimeout = setTimeout(async () => {
        try {
          const res = await window.api.invokeRoute({
            url: `/api/asistencias/contactos/sugerencias?q=${encodeURIComponent(val)}`,
            method: 'GET'
          });

          if (res && res.status === 200 && Array.isArray(res.data) && res.data.length > 0) {
            renderDockSuggestions(res.data);
          } else {
            suggestionsBox.classList.add('hidden');
            suggestionsBox.innerHTML = '';
          }
        } catch (err) {
          console.warn('[AsistenciaDock] Error en sugerencias:', err);
        }
      }, 150);
    });

    document.addEventListener('click', (e) => {
      if (!input.contains(e.target) && !suggestionsBox.contains(e.target)) {
        suggestionsBox.classList.add('hidden');
      }
    });
  }

  function renderDockSuggestions(contacts) {
    const box = document.getElementById('dock-autocomplete-suggestions');
    if (!box) return;

    box.innerHTML = contacts.map(c => {
      const rawTel = (c.telefono || c.telefono_anexo || '').trim();
      const telStr = rawTel ? ` · Tel. ${rawTel}` : '';
      const subline = `${c.direccion || c.depto_habitual || 'Sin dirección'}${telStr}`;

      return `
        <button type="button" class="w-full px-3.5 py-2 text-left hover:bg-border-ui flex items-center gap-2.5 cursor-pointer transition-colors" data-contact='${JSON.stringify(c).replace(/'/g, "&#39;")}'>
          <div class="h-6 w-6 rounded-full bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20 flex items-center justify-center shrink-0">
            <i data-lucide="user" class="h-3 w-3"></i>
          </div>
          <div class="flex-1 min-w-0">
            <div class="font-semibold text-xs text-text-primary truncate">${c.nombre}</div>
            <div class="text-[10px] text-text-tertiary truncate">${subline}</div>
          </div>
        </button>
      `;
    }).join('');

    box.classList.remove('hidden');
    if (window.lucide) window.lucide.createIcons();

    box.querySelectorAll('button').forEach(el => {
      el.addEventListener('click', () => {
        const data = JSON.parse(el.getAttribute('data-contact'));
        seleccionarDockContacto(data);
        box.classList.add('hidden');
      });
    });
  }

  function seleccionarDockContacto(c) {
    if (!c) return;
    dockContactId = c.id || null;
    const elSol = document.getElementById('dock-input-solicitante');
    const elDir = document.getElementById('dock-input-direccion');
    const elCor = document.getElementById('dock-input-correo');
    const elTel = document.getElementById('dock-input-telefono');
    if (elSol && c.nombre) elSol.value = c.nombre;
    if (elDir) elDir.value = c.direccion || c.depto_habitual || '';
    if (elCor && c.correo) elCor.value = c.correo;
    if (elTel) elTel.value = (c.telefono || c.telefono_anexo || '').replace(/\D/g, '');
    document.getElementById('dock-indicator-contacto-vinculado')?.classList.remove('hidden');
    saveDockDraft();
  }

  // ─── Autocompletado Predictivo de Folio Lobby ─────────────────────────────
  function initDockFolioAutocomplete() {
    const input = document.getElementById('dock-input-folio');
    const suggestionsBox = document.getElementById('dock-folio-suggestions');
    if (!input || !suggestionsBox) return;

    let folioTimeout = null;

    input.addEventListener('input', () => {
      if (dockIsFormLocked) return;
      const val = input.value.trim();

      if (val.length < 2) {
        suggestionsBox.classList.add('hidden');
        suggestionsBox.innerHTML = '';
        return;
      }

      clearTimeout(folioTimeout);
      folioTimeout = setTimeout(async () => {
        try {
          const res = await window.api.invokeRoute({
            url: `/api/asistencias/folios/sugerencias?q=${encodeURIComponent(val)}`,
            method: 'GET'
          });

          if (res && res.status === 200 && Array.isArray(res.data) && res.data.length > 0) {
            renderDockFolioSuggestions(res.data);
          } else {
            suggestionsBox.classList.add('hidden');
            suggestionsBox.innerHTML = '';
          }
        } catch (err) {
          console.warn('[AsistenciaDock] Error en sugerencias de folio:', err);
        }
      }, 150);
    });

    document.addEventListener('click', (e) => {
      if (!input.contains(e.target) && !suggestionsBox.contains(e.target)) {
        suggestionsBox.classList.add('hidden');
      }
    });
  }

  function renderDockFolioSuggestions(items) {
    const box = document.getElementById('dock-folio-suggestions');
    if (!box) return;

    const esc = window.escapeHtml || (s => s ? String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') : '');

    box.innerHTML = items.map(item => `
      <button type="button" class="dock-option-folio w-full p-2.5 text-left hover:bg-border-ui flex flex-col gap-0.5 cursor-pointer text-text-primary transition-colors border-0 bg-transparent" 
        data-folio="${esc(item.folio_lobby)}"
        data-pasivo="${esc(item.sujeto_pasivo || '')}"
        data-cargo="${esc(item.cargo || '')}"
        data-representado="${esc(item.representado || '')}">
        <div class="flex items-center justify-between gap-2">
          <span class="font-mono font-bold text-xs text-brand-600 dark:text-brand-400">${esc(item.folio_lobby)}</span>
          <span class="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20">${esc(item.origen || 'Lobby')}</span>
        </div>
        ${item.sujeto_pasivo ? `<div class="text-[11px] text-text-secondary truncate"><strong class="text-text-tertiary font-semibold">Sujeto:</strong> ${esc(item.sujeto_pasivo)}</div>` : ''}
        ${item.cargo ? `<div class="text-[10px] text-text-tertiary truncate">${esc(item.cargo)}</div>` : ''}
        ${item.materia ? `<div class="text-[10px] text-text-tertiary truncate">${esc(item.materia)}</div>` : ''}
      </button>
    `).join('');

    box.classList.remove('hidden');

    box.querySelectorAll('.dock-option-folio').forEach(btn => {
      btn.addEventListener('click', () => {
        const folio = btn.getAttribute('data-folio');
        const pasivo = btn.getAttribute('data-pasivo');
        const cargo = btn.getAttribute('data-cargo');
        const representado = btn.getAttribute('data-representado');

        const input = document.getElementById('dock-input-folio');
        if (input) input.value = folio;

        // Autocompletar representado si no está lleno
        const inputRep = document.getElementById('dock-input-representado');
        if (inputRep && !inputRep.value.trim()) {
          inputRep.value = cargo || representado || pasivo;
          document.getElementById('dock-btn-clear-representado')?.classList.remove('hidden');
        }

        box.classList.add('hidden');
        saveDockDraft();
      });
    });
  }

  // ─── Borrador Local en Tiempo Real ────────────────────────────────────────
  function initDockDraftAutosave() {
    const inputs = ['dock-input-solicitante', 'dock-input-direccion', 'dock-input-correo', 'dock-input-telefono', 'dock-input-representado', 'dock-input-folio', 'dock-input-motivo', 'dock-input-solucion'];
    inputs.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', saveDockDraft);
        el.addEventListener('change', saveDockDraft);
      }
    });
    restoreDockDraft();
  }

  function saveDockDraft() {
    if (dockIsFormLocked || dockIsReviewMode) return;

    const draft = {
      solicitante: document.getElementById('dock-input-solicitante')?.value || '',
      direccion: document.getElementById('dock-input-direccion')?.value || '',
      correo: document.getElementById('dock-input-correo')?.value || '',
      telefono: document.getElementById('dock-input-telefono')?.value || '',
      representado: document.getElementById('dock-input-representado')?.value || '',
      representadoId: document.getElementById('dock-input-representado-id')?.value || '',
      canal: dockSelectedCanal,
      categoria: dockSelectedCategoria,
      estado: dockSelectedEstado,
      folio: document.getElementById('dock-input-folio')?.value || '',
      motivo: document.getElementById('dock-input-motivo')?.value || '',
      solucion: document.getElementById('dock-input-solucion')?.value || '',
      contactoId: dockContactId,
      timestamp: Date.now()
    };

    const hasContent = draft.solicitante.trim() || draft.motivo.trim() || draft.solucion.trim();
    if (hasContent) {
      localStorage.setItem(DOCK_DRAFT_KEY, JSON.stringify(draft));
    } else {
      localStorage.removeItem(DOCK_DRAFT_KEY);
    }
  }

  function restoreDockDraft() {
    try {
      const saved = localStorage.getItem(DOCK_DRAFT_KEY);
      if (!saved) return;
      const draft = JSON.parse(saved);

      if (Date.now() - (draft.timestamp || 0) > 3 * 24 * 60 * 60 * 1000) {
        localStorage.removeItem(DOCK_DRAFT_KEY);
        return;
      }

      const elSol = document.getElementById('dock-input-solicitante');
      const elDir = document.getElementById('dock-input-direccion');
      const elCor = document.getElementById('dock-input-correo');
      const elTel = document.getElementById('dock-input-telefono');
      const elRep = document.getElementById('dock-input-representado');
      const elRepId = document.getElementById('dock-input-representado-id');
      const clearRepBtn = document.getElementById('dock-btn-clear-representado');
      const elFol = document.getElementById('dock-input-folio');
      const elMot = document.getElementById('dock-input-motivo');
      const elSolu = document.getElementById('dock-input-solucion');

      if (draft.solicitante && elSol) elSol.value = draft.solicitante;
      if (draft.direccion && elDir) elDir.value = draft.direccion;
      if (draft.correo && elCor) elCor.value = draft.correo;
      if (draft.telefono && elTel) elTel.value = draft.telefono;
      if (draft.representado && elRep) {
        elRep.value = draft.representado;
        if (clearRepBtn) clearRepBtn.classList.remove('hidden');
      }
      if (draft.representadoId && elRepId) elRepId.value = draft.representadoId;
      if (draft.folio && elFol) elFol.value = draft.folio;
      if (draft.motivo && elMot) elMot.value = draft.motivo;
      if (draft.solucion && elSolu) elSolu.value = draft.solucion;
      if (draft.contactoId) dockContactId = draft.contactoId;
      if (draft.canal) setDockCanalUI(draft.canal);
      if (draft.categoria) setDockCategoriaUI(draft.categoria);
      if (draft.estado) setDockEstadoUI(draft.estado);

      if (draft.contactoId) {
        document.getElementById('dock-indicator-contacto-vinculado')?.classList.remove('hidden');
      }
    } catch (e) {
      console.warn('[AsistenciaDock] Error al restaurar borrador:', e);
    }
  }

  // ─── Descartar y Nueva Atención ───────────────────────────────────────────
  function handleDockDescartar() {
    const doDescartar = () => {
      resetDockForm();
      if (window.showToast) showToast('Formulario limpio.', 'info');
    };

    if (hasDockUnsavedChanges()) {
      if (typeof window.openConfirmModal === 'function') {
        window.openConfirmModal(
          'Descartar Atención',
          '¿Estás seguro de descartar los datos ingresados en esta atención?',
          () => {
            doDescartar();
          }
        );
      } else {
        doDescartar();
      }
    } else {
      doDescartar();
    }
  }

  function handleDockNueva() {
    const doNueva = () => {
      resetDockForm();
    };

    if (hasDockUnsavedChanges()) {
      if (typeof window.openConfirmModal === 'function') {
        window.openConfirmModal(
          'Nueva Atención',
          'Hay una atención en curso sin guardar. ¿Deseas descartarla e iniciar una nueva?',
          () => {
            doNueva();
          }
        );
      } else {
        doNueva();
      }
    } else {
      doNueva();
    }
  }

  function resetDockForm() {
    dockContactId = null;
    dockLastSavedTicket = null;
    dockIsReviewMode = false;
    dockIsFormLocked = false;

    applyDockNewMode();

    const ids = ['dock-input-solicitante', 'dock-input-direccion', 'dock-input-correo', 'dock-input-telefono', 'dock-input-representado', 'dock-input-representado-id', 'dock-input-folio', 'dock-input-motivo', 'dock-input-solucion'];
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });

    document.getElementById('dock-btn-clear-representado')?.classList.add('hidden');
    document.getElementById('dock-indicator-contacto-vinculado')?.classList.add('hidden');

    setDockCanalUI('telefono');
    if (dockCategoriasList.length > 0) setDockCategoriaUI(dockCategoriasList[0].nombre);
    setDockEstadoUI('resuelta');

    localStorage.removeItem(DOCK_DRAFT_KEY);
    updateDockTabBadge();
  }

  // ─── Guardar Asistencia ───────────────────────────────────────────────────
  async function guardarDockAsistencia() {
    const inputFecha = document.getElementById('dock-input-fecha-atencion');
    const inputSolicitante = document.getElementById('dock-input-solicitante');
    const inputDireccion = document.getElementById('dock-input-direccion');
    const inputCorreo = document.getElementById('dock-input-correo');
    const inputTelefono = document.getElementById('dock-input-telefono');
    const inputFolio = document.getElementById('dock-input-folio');
    const inputMotivo = document.getElementById('dock-input-motivo');
    const inputSolucion = document.getElementById('dock-input-solucion');

    const fechaVal = inputFecha?.value.trim();
    const nombre = inputSolicitante?.value.trim();
    const direccion = inputDireccion?.value.trim();
    const correo = inputCorreo?.value.trim();
    const telefono = inputTelefono?.value.trim();
    const folio = inputFolio?.value.trim();
    const motivo = inputMotivo?.value.trim();
    const solucion = inputSolucion?.value.trim();

    let finalFechaHora = null;
    if (dockFechaAirDatepicker && dockFechaAirDatepicker.selectedDates && dockFechaAirDatepicker.selectedDates.length > 0) {
      const d = dockFechaAirDatepicker.selectedDates[0];
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const h = String(d.getHours()).padStart(2, '0');
      const min = String(d.getMinutes()).padStart(2, '0');
      const s = String(d.getSeconds()).padStart(2, '0');
      finalFechaHora = `${y}-${m}-${day} ${h}:${min}:${s}`;
    }

    const highlight = (el) => {
      if (!el) return;
      el.focus();
      el.classList.add('ring-2', 'ring-rose-500');
      setTimeout(() => el.classList.remove('ring-2', 'ring-rose-500'), 2500);
    };

    if (!fechaVal || !finalFechaHora) {
      if (window.showToast) showToast('La fecha y hora de atención es obligatoria.', 'warning');
      highlight(inputFecha);
      return;
    }
    if (!dockSelectedCanal) {
      if (window.showToast) showToast('Debes seleccionar el canal de contacto.', 'warning');
      return;
    }
    if (!dockSelectedCategoria) {
      if (window.showToast) showToast('Debes seleccionar la materia o categoría.', 'warning');
      return;
    }
    if (!nombre) {
      if (window.showToast) showToast('Por favor indica el nombre del solicitante.', 'warning');
      highlight(inputSolicitante);
      return;
    }
    if (!direccion) {
      if (window.showToast) showToast('Por favor selecciona una Dirección Municipal.', 'warning');
      highlight(inputDireccion);
      return;
    }

    const direccionVal = direccion.toLowerCase();
    const direccionEncontrada = dockDireccionesList.find(d => 
      (d.acronimo && d.acronimo.toLowerCase() === direccionVal) || 
      (d.nombre && d.nombre.toLowerCase() === direccionVal)
    );

    if (!direccionEncontrada) {
      if (window.showToast) showToast('La dirección ingresada no existe en el catálogo.', 'warning');
      highlight(inputDireccion);
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!correo || !emailRegex.test(correo)) {
      if (window.showToast) showToast('Por favor ingresa un correo electrónico válido.', 'warning');
      highlight(inputCorreo);
      return;
    }
    if (!telefono) {
      if (window.showToast) showToast('Por favor indica el teléfono de contacto.', 'warning');
      highlight(inputTelefono);
      return;
    }
    if (!motivo) {
      if (window.showToast) showToast('Por favor describe el motivo de la consulta.', 'warning');
      highlight(inputMotivo);
      return;
    }
    if (!solucion) {
      if (window.showToast) showToast('Por favor indica la orientación brindada.', 'warning');
      highlight(inputSolucion);
      return;
    }

    const btnGuardar = document.getElementById('dock-btn-guardar');
    if (btnGuardar) {
      btnGuardar.disabled = true;
      document.getElementById('dock-btn-guardar-text').textContent = 'Guardando...';
      document.getElementById('dock-btn-guardar-icon').setAttribute('data-lucide', 'loader-2');
      document.getElementById('dock-btn-guardar-icon').classList.add('animate-spin');
      if (window.lucide) window.lucide.createIcons();
    }

    try {
      const isUpdating = !!(dockLastSavedTicket && dockLastSavedTicket.id);
      const method = isUpdating ? 'PUT' : 'POST';
      const url = isUpdating ? `/api/asistencias/${dockLastSavedTicket.id}` : '/api/asistencias';

      const res = await window.api.invokeRoute({
        url,
        method,
        body: {
          solicitante_nombre: nombre,
          solicitante_direccion: direccionEncontrada.acronimo,
          solicitante_cargo_depto: direccionEncontrada.acronimo,
          solicitante_correo: correo,
          solicitante_telefono: telefono,
          solicitante_contacto: telefono,
          representado: document.getElementById('dock-input-representado')?.value.trim() || null,
          representado_id_lobby: document.getElementById('dock-input-representado-id')?.value || null,
          canal: dockSelectedCanal,
          categoria: dockSelectedCategoria,
          folio_lobby: folio,
          motivo_consulta: motivo,
          solucion_orientacion: solucion,
          estado: dockSelectedEstado,
          contacto_id: dockContactId,
          fecha_hora: finalFechaHora
        }
      });

      if (btnGuardar) btnGuardar.disabled = false;

      if (res && (res.status === 200 || res.status === 201)) {
        dockLastSavedTicket = res.data.ticket_codigo ? res.data : { ...res.data, ticket_codigo: dockLastSavedTicket?.ticket_codigo || 'AST-GUARDADA' };
        localStorage.removeItem(DOCK_DRAFT_KEY);

        if (window.showToast) showToast(`¡Atención ${dockLastSavedTicket.ticket_codigo} guardada con éxito!`, 'success');
        applyDockReviewMode(dockLastSavedTicket);

        // Si la pestaña de administración / asistencia está activa en segundo plano, refrescarla
        if (typeof window.loadAsistenciasData === 'function') window.loadAsistenciasData();
        if (typeof window.loadAsistenciaStats === 'function') window.loadAsistenciaStats();
      } else {
        if (window.showToast) showToast('Error al guardar: ' + (res?.data?.error || 'Desconocido'), 'error');
        if (btnGuardar) {
          document.getElementById('dock-btn-guardar-text').textContent = isUpdating ? 'Guardar Cambios' : 'Guardar (Ctrl+Enter)';
          document.getElementById('dock-btn-guardar-icon').setAttribute('data-lucide', 'save');
          document.getElementById('dock-btn-guardar-icon').classList.remove('animate-spin');
          if (window.lucide) window.lucide.createIcons();
        }
      }
    } catch (err) {
      if (btnGuardar) {
        btnGuardar.disabled = false;
        document.getElementById('dock-btn-guardar-text').textContent = 'Guardar (Ctrl+Enter)';
        document.getElementById('dock-btn-guardar-icon').setAttribute('data-lucide', 'save');
        document.getElementById('dock-btn-guardar-icon').classList.remove('animate-spin');
        if (window.lucide) window.lucide.createIcons();
      }
      if (window.showToast) showToast('Error: ' + err.message, 'error');
    }
  }

  // ─── Exportaciones: Correo Outlook y Ficha PDF ────────────────────────────
  async function prepararDockCorreoOutlook() {
    if (!dockLastSavedTicket) {
      if (window.showToast) showToast('Debes guardar la atención antes de generar el correo.', 'warning');
      return;
    }

    const nombre = document.getElementById('dock-input-solicitante')?.value.trim() || dockLastSavedTicket.solicitante_nombre;
    const direccion = document.getElementById('dock-input-direccion')?.value.trim() || dockLastSavedTicket.solicitante_direccion || dockLastSavedTicket.solicitante_cargo_depto;
    const correo = document.getElementById('dock-input-correo')?.value.trim() || dockLastSavedTicket.solicitante_correo;
    const representado = dockLastSavedTicket.representado || document.getElementById('dock-input-representado')?.value.trim() || null;
    const motivo = document.getElementById('dock-input-motivo')?.value.trim() || dockLastSavedTicket.motivo_consulta;
    const solucion = document.getElementById('dock-input-solucion')?.value.trim() || dockLastSavedTicket.solucion_orientacion;
    const folio = document.getElementById('dock-input-folio')?.value.trim() || dockLastSavedTicket.folio_lobby;
    const ticket = dockLastSavedTicket.ticket_codigo;

    let fechaAtencionStr = '--';
    if (dockLastSavedTicket.fecha_hora) {
      const d = new Date(dockLastSavedTicket.fecha_hora.replace(' ', 'T'));
      if (!isNaN(d.getTime())) {
        fechaAtencionStr = d.toLocaleDateString('es-CL', {
          day: '2-digit', month: '2-digit', year: 'numeric',
          hour: '2-digit', minute: '2-digit', hour12: false
        });
      } else {
        fechaAtencionStr = dockLastSavedTicket.fecha_hora.replace('T', ' ').substring(0, 16);
      }
    }

    const esc = window.escapeHtml || (s => s ? String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') : '');
    const solucionHtml = (solucion || 'Atención brindada conforme a normativa.').split('\n').map(line => esc(line)).join('<br>');
    const subject = `[LobbyControl] Asistencia Técnica N° ${ticket}`;

    let atendidoPor = dockLastSavedTicket.creado_por_nombre || dockLastSavedTicket.atendido_por;
    if (!atendidoPor && typeof currentUser !== 'undefined' && currentUser) {
      atendidoPor = currentUser.nombre || currentUser.correo;
    }
    if (!atendidoPor && dockLastSavedTicket.creado_por) {
      atendidoPor = dockLastSavedTicket.creado_por;
    }
    if (!atendidoPor) {
      atendidoPor = localStorage.getItem('lobby_user_name') || '';
    }

    const bodyHtml = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta name="color-scheme" content="light dark">
        <meta name="supported-color-schemes" content="light dark">
        <style>
          :root { color-scheme: light dark; supported-color-schemes: light dark; }
          body, table, td, p, a, div { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
          @media (prefers-color-scheme: dark) {
            .email-bg { background-color: #18181b !important; }
            .email-card { background-color: #27272a !important; border-color: #3f3f46 !important; }
            .email-title { color: #f4f4f5 !important; }
            .email-text { color: #e4e4e7 !important; }
            .email-muted { color: #a1a1aa !important; }
            .email-box { background-color: #1f1f23 !important; border-color: #3f3f46 !important; color: #e4e4e7 !important; }
          }
        </style>
      </head>
      <body class="email-bg" style="margin: 0; padding: 20px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 13px; color: #1e293b; background-color: #f1f5f9;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" align="center" style="margin: 0 auto; max-width: 620px; width: 100%;">
          <tr>
            <td align="center" style="padding: 0 12px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" class="email-card" style="max-width: 600px; width: 100%; background-color: #ffffff; border: 1px solid #cbd5e1; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.06);">
                
                <!-- BANDA SUPERIOR INSTITUCIONAL -->
                <tr>
                  <td style="background-color: #0284c7; height: 5px; line-height: 5px; font-size: 1px;">&nbsp;</td>
                </tr>

                <!-- CABECERA INSTITUCIONAL LIMPIA -->
                <tr>
                  <td style="padding: 22px 26px 18px 26px; border-bottom: 1px solid #e2e8f0; background-color: #ffffff;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td valign="middle">
                          <div class="email-muted" style="font-size: 11px; font-weight: 700; color: #0284c7; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 3px;">
                            MUNICIPALIDAD DE MAIPÚ • SECRETARÍA MUNICIPAL
                          </div>
                          <div class="email-title" style="font-size: 18px; font-weight: 700; color: #0f172a; margin-bottom: 2px;">
                            Asistencia Técnica
                          </div>
                          <div class="email-muted" style="font-size: 12px; color: #64748b;">
                            Plataforma LobbyControl — Ley N° 20.730 de Lobby
                          </div>
                        </td>
                        <td align="right" valign="middle">
                          <span style="display: inline-block; background-color: #f0f9ff; border: 1px solid #bae6fd; color: #0284c7; font-family: Consolas, Monaco, 'Courier New', monospace; font-size: 12px; font-weight: 700; padding: 5px 11px; border-radius: 6px; white-space: nowrap;">
                            ${esc(ticket)}
                          </span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- CONTENIDO DEL MENSAJE -->
                <tr>
                  <td style="padding: 24px 26px;">
                    <!-- SALUDO -->
                    <p class="email-text" style="margin: 0 0 12px 0; font-size: 14px; line-height: 1.5; color: #1e293b;">
                      Estimado(a) <strong>${esc(nombre)}</strong>${direccion ? ` <span class="email-muted" style="color: #64748b; font-size: 13px;">(${esc(direccion)})</span>` : ''}:
                    </p>
                    <p class="email-text" style="margin: 0 0 18px 0; font-size: 13px; line-height: 1.5; color: #475569;">
                      A continuación se detalla la orientación brindada a su consulta:
                    </p>

                    <!-- FICHA DE DATOS CLAVE -->
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" class="email-box" style="width: 100%; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 18px;">
                      <tr>
                        <td style="padding: 12px 16px;">
                          <table width="100%" cellpadding="0" cellspacing="0" border="0">
                            ${representado ? `
                            <tr>
                              <td valign="top" style="padding: 4px 0; width: 140px; font-size: 12px; font-weight: 600; color: #64748b;">En representación de:</td>
                              <td valign="top" class="email-text" style="padding: 4px 0; font-size: 12.5px; font-weight: 600; color: #1e293b;">${esc(representado)}</td>
                            </tr>` : ''}
                            ${folio ? `
                            <tr>
                              <td valign="top" style="padding: 4px 0; width: 140px; font-size: 12px; font-weight: 600; color: #64748b;">Folio Lobby:</td>
                              <td valign="top" style="padding: 4px 0; font-size: 12.5px; font-family: Consolas, Monaco, monospace; font-weight: 700; color: #0284c7;">${esc(folio)}</td>
                            </tr>` : ''}
                            <tr>
                              <td valign="top" style="padding: 4px 0; width: 140px; font-size: 12px; font-weight: 600; color: #64748b;">Fecha y Hora:</td>
                              <td valign="top" class="email-text" style="padding: 4px 0; font-size: 12.5px; color: #334155;">${esc(fechaAtencionStr)}</td>
                            </tr>
                            ${atendidoPor ? `
                            <tr>
                              <td valign="top" style="padding: 4px 0; width: 140px; font-size: 12px; font-weight: 600; color: #64748b;">Atendido por:</td>
                              <td valign="top" class="email-text" style="padding: 4px 0; font-size: 12.5px; font-weight: 600; color: #1e293b;">${esc(atendidoPor)}</td>
                            </tr>` : ''}
                          </table>
                        </td>
                      </tr>
                    </table>

                    <!-- MOTIVO DE CONSULTA -->
                    <div style="margin-bottom: 18px;">
                      <div class="email-muted" style="font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">
                        Motivo de Consulta
                      </div>
                      <div class="email-text email-box" style="font-size: 13px; line-height: 1.55; color: #1e293b; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px;">
                        ${esc(motivo)}
                      </div>
                    </div>

                    <!-- ORIENTACIÓN / SOLUCIÓN TÉCNICA -->
                    <div style="margin-bottom: 20px;">
                      <div class="email-muted" style="font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">
                        Orientación Técnica
                      </div>
                      <div class="email-text email-box" style="font-size: 13px; line-height: 1.6; color: #1e293b; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px;">
                        ${solucionHtml}
                      </div>
                    </div>

                    <!-- AVISO DE NO RESPONDER -->
                    <div class="email-muted" style="text-align: center; font-size: 12px; color: #64748b; margin: 18px 0 14px 0; font-style: italic;">
                      Por favor, no responder a este correo.
                    </div>

                    <!-- PIE INSTITUCIONAL SOBRIO -->
                    <div class="email-muted" style="text-align: center; font-size: 11px; color: #94a3b8; line-height: 1.4; padding-top: 14px; border-top: 1px solid #f1f5f9;">
                      LobbyControl • Secretaría Municipal • Municipalidad de Maipú
                    </div>
                  </td>
                </tr>
              </table>
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

  async function generarDockFichaPDF() {
    if (!dockLastSavedTicket) {
      if (window.showToast) showToast('Debes guardar la atención antes de exportar el PDF.', 'warning');
      return;
    }

    const nombre = document.getElementById('dock-input-solicitante')?.value.trim() || dockLastSavedTicket.solicitante_nombre;
    const direccion = document.getElementById('dock-input-direccion')?.value.trim() || dockLastSavedTicket.solicitante_direccion || dockLastSavedTicket.solicitante_cargo_depto;
    const correo = document.getElementById('dock-input-correo')?.value.trim() || dockLastSavedTicket.solicitante_correo;
    const telefono = document.getElementById('dock-input-telefono')?.value.trim() || dockLastSavedTicket.solicitante_telefono || dockLastSavedTicket.solicitante_contacto;
    const representado = dockLastSavedTicket.representado || document.getElementById('dock-input-representado')?.value.trim() || null;
    const motivo = document.getElementById('dock-input-motivo')?.value.trim() || dockLastSavedTicket.motivo_consulta;
    const solucion = document.getElementById('dock-input-solucion')?.value.trim() || dockLastSavedTicket.solucion_orientacion;
    const folio = document.getElementById('dock-input-folio')?.value.trim() || dockLastSavedTicket.folio_lobby;
    const ticket = dockLastSavedTicket.ticket_codigo;

    let fechaAtencionPdf = '--';
    if (dockLastSavedTicket.fecha_hora) {
      const d = new Date(dockLastSavedTicket.fecha_hora.replace(' ', 'T'));
      if (!isNaN(d.getTime())) {
        fechaAtencionPdf = d.toLocaleDateString('es-CL', {
          day: '2-digit', month: '2-digit', year: 'numeric',
          hour: '2-digit', minute: '2-digit', hour12: false
        });
      } else {
        fechaAtencionPdf = dockLastSavedTicket.fecha_hora.replace('T', ' ').substring(0, 16);
      }
    }

    const savePathRes = await window.api.selectSavePath({
      defaultName: `Ficha_Asistencia_${ticket}.pdf`
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
          <tr><td class="label">Funcionario / Solicitante:</td><td><strong>${nombre}</strong></td></tr>
          ${representado ? `<tr><td class="label">En representación de:</td><td><strong>${representado}</strong></td></tr>` : ''}
          <tr><td class="label">Dirección Municipal:</td><td>${direccion || 'No especificada'}</td></tr>
          <tr><td class="label">Correo y Teléfono:</td><td>${correo || ''} ${telefono ? ' (' + telefono + ')' : ''}</td></tr>
          <tr><td class="label">Canal y Categoría:</td><td>Canal: ${dockSelectedCanal.toUpperCase()} | Materia: ${dockSelectedCategoria.toUpperCase()}</td></tr>
          ${folio ? `<tr><td class="label">Folio Vinculado:</td><td><code>${folio}</code></td></tr>` : ''}
          <tr><td class="label">Motivo de Consulta:</td><td>${motivo}</td></tr>
        </table>
        <div class="box-solucion">
          <strong style="color: #166534;">ORIENTACIÓN Y SOLUCIÓN BRINDADA:</strong>
          <p style="margin: 6px 0 0 0; color: #14532d;">${(solucion || 'Atención concluida satisfactoriamente.').replace(/\n/g, '<br>')}</p>
        </div>
        <div class="footer">Documento generado automáticamente por LobbyControl — Municipalidad de Maipú.</div>
      </body>
      </html>
    `;

    const pdfRes = await window.api.generateSilentPdf({
      html: htmlPdf,
      filePath: savePathRes.filePath
    });

    if (pdfRes && pdfRes.success) {
      if (window.showToast) showToast('Ficha PDF guardada exitosamente.', 'success');
    } else {
      if (window.showToast) showToast('Error al generar PDF: ' + (pdfRes?.error || 'Desconocido'), 'error');
    }
  }

  // ─── Exponer métodos en window ────────────────────────────────────────────
  window.openAssistanceDock = openAssistanceDock;
  window.minimizeAssistanceDock = minimizeAssistanceDock;
  window.closeAssistanceDock = closeAssistanceDock;
  window.toggleAssistanceDock = toggleAssistanceDock;
  window.loadDockCatalogs = loadDockCatalogs;
})();
