// Helper para escapar comillas y caracteres especiales en atributos HTML
function escapeHtmlAttr(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Helper para escapar HTML en nodos de texto (Previene XSS pasivo)
function escapeHtml(str) {
  return escapeHtmlAttr(str);
}

// Helper para formatear fechas
function formatDate(dateString) {
  if (!dateString) return '-';
  try {
    const parts = dateString.split(' ')[0].split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateString;
  } catch (e) {
    return dateString;
  }
}

// Helper para obtener el badge de estado del plazo (DDL) y el estado unificados en un objeto semántico de datos
function getDeadlineStatusBadge(fechaIngreso, fechaRespuesta, estado, item) {
  const estadoClean = (estado || 'Ingresada').trim();
  const hasRespuesta = fechaRespuesta && fechaRespuesta !== '-' && fechaRespuesta !== 'null' && fechaRespuesta !== '---';

  if (item && item.estado_cumplimiento_sh) {
    if (estadoClean.toLowerCase() !== 'ingresada') {
      let subtext = '';
      if (item.estado_cumplimiento_sh === 'FUERA_PLAZO') {
        subtext = `Fuera de plazo (-${item.dias_habiles_respuesta || 0}d)`;
      } else if (item.estado_cumplimiento_sh === 'EN_PLAZO' && hasRespuesta) {
        subtext = 'En plazo';
      }
      return {
        text: estadoClean,
        subtext: subtext,
        class: 'badge-status-otros'
      };
    }
    
    // Para "Ingresada" (se obtiene de los campos precalculados e inyectados por el servidor)
    if (item.estado_cumplimiento_sh === 'PENDIENTE_VENCIDA') {
      const atraso = Math.abs(item.dias_restantes_sh || 0);
      return {
        text: 'Ingresada',
        subtext: `Vencido (-${atraso}d)`,
        class: 'badge-status-vencido'
      };
    } else if (item.estado_cumplimiento_sh === 'PENDIENTE_EN_PLAZO') {
      const diffDays = item.dias_restantes_sh !== undefined ? item.dias_restantes_sh : 0;
      return {
        text: 'Ingresada',
        subtext: `En plazo (${diffDays}d)`,
        class: 'badge-status-enplazo'
      };
    }
  }

  return {
    text: estadoClean,
    subtext: '',
    class: 'badge-status-otros'
  };
}

// Helper para formatear Sujeto Pasivo y Cargo (separa por " - ")
function formatSujetoPasivoCargo(cargoString) {
  if (!cargoString) {
    return { title: 'No definido', subtitle: '' };
  }
  
  // Detectar si empieza con código de licitación (por ejemplo, 2770-...)
  const licitacionMatch = cargoString.match(/^\s*(2770-\d+-?\s*[A-Z0-9]+)/i);
  if (licitacionMatch) {
    const code = licitacionMatch[1].trim();
    // Intentar extraer el nombre que está después del último guion
    const lastHyphenIndex = cargoString.lastIndexOf('-');
    if (lastHyphenIndex !== -1 && lastHyphenIndex > licitacionMatch[0].length) {
      const nombre = cargoString.substring(lastHyphenIndex + 1).trim();
      return { title: code, subtitle: nombre };
    }
    return { title: code, subtitle: '' };
  }

  // Comportamiento normal para otros cargos
  const parts = cargoString.split(' - ');
  if (parts.length >= 3) {
    const cargo = parts[0].trim();
    const nombre = parts[parts.length - 1].trim();
    return { title: cargo, subtitle: nombre };
  } else if (parts.length === 2) {
    const cargo = parts[0].trim();
    const nombre = parts[1].trim();
    return { title: cargo, subtitle: nombre };
  }
  return { title: cargoString, subtitle: '' };
}

// Helper para obtener el cargo limpio (específico para licitaciones en PH)
function getCargoCleanBidding(cargoString) {
  if (!cargoString) return 'No definido';
  
  // Detectar patrón de licitación de Maipú (2770-...)
  const licitacionMatch = cargoString.match(/^\s*(2770-\d+-?\s*[A-Z0-9]+)/i);
  if (licitacionMatch) {
    return licitacionMatch[1].trim();
  }
  
  // Fallback al comportamiento estándar de limpieza
  const parts = cargoString.split(' - ');
  return parts[0].trim();
}

// Helper para obtener sólo el cargo/función limpio (sin el nombre) - Conservado para SPH
function getCargoClean(cargoString) {
  if (!cargoString) return 'No definido';
  const parts = cargoString.split(' - ');
  if (parts.length > 1) {
    return parts.slice(0, -1).join(' - ').trim();
  }
  return cargoString.trim();
}

// Normalizar nombres a Title Case respetando preposiciones y partículas españolas
// Ej: "JUAN CARLOS DE LA FUENTE" → "Juan Carlos de la Fuente"
// Ej: "maría josé del río" → "María José del Río"
const _lowercaseParticles = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'e']);
function normalizeName(name) {
  if (!name) return '';
  return name
    .toLowerCase()
    .split(/\s+/)
    .map((word, idx) => {
      if (idx > 0 && _lowercaseParticles.has(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

// Control de modo claro/oscuro
function toggleTheme() {
  const html = document.documentElement;
  if (html.classList.contains('dark')) {
    html.classList.remove('dark');
    localStorage.setItem('lobby_theme', 'light');
    if (typeof showToast === 'function') showToast('Modo Claro activado');
  } else {
    html.classList.add('dark');
    localStorage.setItem('lobby_theme', 'dark');
    if (typeof showToast === 'function') showToast('Modo Oscuro activado');
  }
  updateThemeIcons();
  if (typeof currentView !== 'undefined' && currentView === 'dashboard' && typeof initDashboardCharts === 'function') {
    initDashboardCharts();
  }
}

function updateThemeIcons() {
  const html = document.documentElement;
  const isDark = html.classList.contains('dark');
  const buttons = [
    document.getElementById('theme-toggle'),
    document.getElementById('login-theme-toggle')
  ].filter(Boolean);
  
  buttons.forEach(btn => {
    if (isDark) {
      btn.title = "Cambiar a Modo Claro";
      btn.innerHTML = '<i data-lucide="sun" class="h-4 w-4"></i>';
    } else {
      btn.title = "Cambiar a Modo Oscuro";
      btn.innerHTML = '<i data-lucide="moon" class="h-4 w-4"></i>';
    }
  });

  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
}

/**
 * Ajusta una lista de valores numéricos para obtener sus porcentajes redondeados a 1 decimal
 * de tal forma que la suma sea exactamente 100.0%, utilizando el Método del Resto Mayor (Hare-Niemeyer).
 * @param {number[]} values - Lista de recuentos individuales.
 * @param {number} total - Suma total de los recuentos.
 * @returns {number[]} Lista de porcentajes ajustados.
 */
function roundPercentagesTo100(values, total) {
  if (!total || total === 0 || !values || values.length === 0) {
    return values.map(() => 0);
  }

  // Trabajar en décimas de porcentaje (100% = 1000 décimas)
  const target = 1000;

  const items = values.map((val, index) => {
    const rawVal = (val / total) * 1000;
    const floorVal = Math.floor(rawVal);
    const remainder = rawVal - floorVal;
    return { index, floorVal, remainder };
  });

  let currentSum = items.reduce((sum, item) => sum + item.floorVal, 0);
  const diff = target - currentSum;

  if (diff > 0 && items.length > 0) {
    // Ordenar por residuo descendente
    const sorted = [...items].sort((a, b) => b.remainder - a.remainder);
    for (let i = 0; i < diff; i++) {
      const idx = i % sorted.length;
      if (sorted[idx]) {
        sorted[idx].floorVal += 1;
      }
    }
  }

  const result = Array(values.length);
  items.forEach(item => {
    result[item.index] = parseFloat((item.floorVal / 10).toFixed(1));
  });

  return result;
}

// Función central del motor analítico para el nuevo Dashboard
function calculateDashboardStats(rawData, filters) {
  // 1. Filtrar los datos en base a los filtros provistos
  let filtered = rawData;

  if (filters.anio && filters.anio !== 'TODOS') {
    filtered = filtered.filter(item => item.fecha_ingreso && item.fecha_ingreso.startsWith(filters.anio));
  }

  if (filters.fechaInicio) {
    const startLimit = filters.fechaInicio; // 'YYYY-MM-DD'
    filtered = filtered.filter(item => item.fecha_ingreso && item.fecha_ingreso.split(' ')[0] >= startLimit);
  }

  if (filters.fechaTermino) {
    const endLimit = filters.fechaTermino;
    filtered = filtered.filter(item => item.fecha_ingreso && item.fecha_ingreso.split(' ')[0] <= endLimit);
  }

  if (filters.nombre && filters.nombre.trim() !== '') {
    const val = filters.nombre.toLowerCase();
    filtered = filtered.filter(item => item.sujeto_pasivo && item.sujeto_pasivo.toLowerCase().includes(val));
  }

  if (filters.cargo && filters.cargo.trim() !== '') {
    const val = filters.cargo.toLowerCase();
    filtered = filtered.filter(item => item.cargo && getCargoClean(item.cargo).toLowerCase().includes(val));
  }

  // 2. Clasificar y contar plazos y estados
  const publicadosFolios = new Set((dataStore.publicadas || []).map(p => p.folio_lobby).filter(Boolean));
  let respondidasCount = 0;
  let pendientesCount = 0;
  let publicadasCount = 0;
  let pendientesPublicacionCount = 0;

  let rdpCount = 0;
  let rfpCount = 0;

  let ddpCount = 0;
  let fdpCount = 0;

  let countsByEstado = {
    aceptada: 0,
    rechazada: 0,
    suspendida: 0,
    cancelada: 0,
    encomendada: 0
  };

  const today = new Date();
  const todayUTC = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));

  // Filtrar las publicaciones directamente con la misma lógica del dashboard
  let filteredPublicadas = dataStore.publicadas || [];

  if (filters.anio && filters.anio !== 'TODOS') {
    filteredPublicadas = filteredPublicadas.filter(item => item.fecha_inicio && item.fecha_inicio.startsWith(filters.anio));
  }

  if (filters.fechaInicio) {
    const startLimit = filters.fechaInicio;
    filteredPublicadas = filteredPublicadas.filter(item => item.fecha_inicio && item.fecha_inicio.split(' ')[0] >= startLimit);
  }

  if (filters.fechaTermino) {
    const endLimit = filters.fechaTermino;
    filteredPublicadas = filteredPublicadas.filter(item => item.fecha_inicio && item.fecha_inicio.split(' ')[0] <= endLimit);
  }

  if (filters.nombre && filters.nombre.trim() !== '') {
    const val = filters.nombre.toLowerCase();
    filteredPublicadas = filteredPublicadas.filter(item => item.sujeto_pasivo && item.sujeto_pasivo.toLowerCase().includes(val));
  }

  if (filters.cargo && filters.cargo.trim() !== '') {
    const val = filters.cargo.toLowerCase();
    filteredPublicadas = filteredPublicadas.filter(item => item.cargo && getCargoClean(item.cargo).toLowerCase().includes(val));
  }

  publicadasCount = filteredPublicadas.length;

  filtered.forEach(item => {
    const estadoClean = (item.estado || 'Ingresada').trim().toLowerCase();
    
    // Contar publicadas / pendientes de publicación
    const hasFolio = !!item.folio_lobby;
    
    if (estadoClean === 'aceptada' && item.fecha_agendada && (!hasFolio || !publicadosFolios.has(item.folio_lobby))) {
      pendientesPublicacionCount++;
    }

    if (estadoClean === 'ingresada') {
      pendientesCount++;
      const diffDays = item.dias_restantes_sh !== undefined ? item.dias_restantes_sh : 0;
      if (diffDays < 0) {
        fdpCount++;
      } else {
        ddpCount++;
      }
    } else {
      // Estado procesado (Respondida)
      respondidasCount++;
      
      // Contar en desglose individual
      const estLower = estadoClean.toLowerCase();
      if (estLower === 'aceptada') countsByEstado.aceptada++;
      else if (estLower === 'rechazada') countsByEstado.rechazada++;
      else if (estLower === 'suspendida') countsByEstado.suspendida++;
      else if (estLower === 'cancelada') countsByEstado.cancelada++;
      else if (estLower === 'encomendada') countsByEstado.encomendada++;

      // Determinar si fue respondida dentro o fuera de plazo usando precalculados de SQLite
      if (item.estado_cumplimiento_sh === 'FUERA_PLAZO') {
        rfpCount++; // Fuera de plazo
      } else {
        rdpCount++; // Dentro de plazo
      }
    }
  });

  const total = filtered.length;
  const aceptadasCount = countsByEstado.aceptada;

  // Calcular porcentajes redondeados consistentes para el desglose total de estados (6 estados particionan total)
  const [
    pctPendientes,
    pctAceptada,
    pctRechazada,
    pctSuspendida,
    pctCancelada,
    pctEncomendada
  ] = roundPercentagesTo100([
    pendientesCount,
    countsByEstado.aceptada,
    countsByEstado.rechazada,
    countsByEstado.suspendida,
    countsByEstado.cancelada,
    countsByEstado.encomendada
  ], total);

  // La suma de los estados respondidos es la parte de respondidas
  const pctRespondidas = parseFloat((100.0 - pctPendientes).toFixed(1));

  // Calcular porcentajes para publicaciones (publicadas vs pendientes de publicación relativas a aceptadas)
  const [pctPublicadas, pctPendientesPublicacion] = roundPercentagesTo100([
    publicadasCount,
    pendientesPublicacionCount
  ], publicadasCount + pendientesPublicacionCount);

  // Calcular porcentajes para respondidas (RDP vs RFP relativas a respondidas)
  const [pctRdp, pctRfp] = roundPercentagesTo100([rdpCount, rfpCount], respondidasCount);

  // Calcular porcentajes para pendientes (DDP vs FDP relativas a pendientes)
  const [pctDdp, pctFdp] = roundPercentagesTo100([ddpCount, fdpCount], pendientesCount);

  return {
    totales: { 
      total, 
      respondidas: respondidasCount, 
      pendientes: pendientesCount, 
      publicadas: publicadasCount, 
      pendientesPublicacion: pendientesPublicacionCount,
      pctPublicadas,
      pctPendientesPublicacion
    },
    respondidas: { rdp: rdpCount, rfp: rfpCount, pctRdp, pctRfp, pctTotal: pctRespondidas },
    pendientes: { ddp: ddpCount, fdp: fdpCount, pctDdp, pctFdp, pctTotal: pctPendientes },
    estados: {
      aceptada: { count: countsByEstado.aceptada, pct: pctAceptada },
      rechazada: { count: countsByEstado.rechazada, pct: pctRechazada },
      suspendida: { count: countsByEstado.suspendida, pct: pctSuspendida },
      cancelada: { count: countsByEstado.cancelada, pct: pctCancelada },
      encomendada: { count: countsByEstado.encomendada, pct: pctEncomendada }
    }
  };
}

// Helper para estandarizar el texto del plazo según especificaciones (DDP, FDP, RDP, RFP)
function getStandardizedPlazoText(item, isPendiente) {
  if (isPendiente) {
    const pubDelayDays = item.dias_retraso_publicacion || 0;
    if (pubDelayDays > 0) {
      return `FDP (-${pubDelayDays}d)`;
    } else {
      return 'DDP';
    }
  }

  const estadoClean = (item.estado || 'Ingresada').trim().toLowerCase();

  if (estadoClean === 'ingresada') {
    const diffDays = item.dias_restantes_sh !== undefined ? item.dias_restantes_sh : 0;
    if (diffDays < 0) {
      return `FDP (-${Math.abs(diffDays)}d)`;
    } else {
      return `DDP (${diffDays}d)`;
    }
  } else {
    // Es respondida (RDP o RFP)
    if (item.estado_cumplimiento_sh === 'FUERA_PLAZO') {
      return `RFP (-${item.dias_habiles_respuesta || 0}d)`;
    } else {
      return 'RDP';
    }
  }
}

// Helper para procesar datos de reportes con filtros multidimensionales y truncamiento de cargo
function processReportData(rawData, filters) {
  const hasAnyFilter = (filters.nombre && filters.nombre !== '') ||
                       (filters.cargo && filters.cargo !== '') ||
                       filters.fechaInicio ||
                       filters.fechaTermino ||
                       (filters.estados && filters.estados.length > 0);

  if (!hasAnyFilter) {
    return [];
  }

  let filtered = [];
  
  const hasNombreFilter = filters.nombre && filters.nombre.toUpperCase() !== 'TODOS' && filters.nombre !== '';
  const hasCargoFilter = filters.cargo && filters.cargo.toUpperCase() !== 'TODOS' && filters.cargo !== '';
  const hasEstadosFilter = filters.estados && filters.estados.length > 0;

  // Optimización usando Set para verificar folios publicados en O(1)
  const publicadosFolios = new Set((dataStore.publicadas || []).map(p => p.folio_lobby).filter(Boolean));

  rawData.forEach(item => {
    // Determinar estado lógico virtual
    let itemEstado = (item.estado || 'Ingresada').trim();
    const isPendiente = itemEstado.toLowerCase() === 'aceptada' && item.fecha_agendada && !publicadosFolios.has(item.folio_lobby);
    if (isPendiente) {
      itemEstado = 'Pendiente de publicación';
    }

    // Filtro por Nombre
    if (hasNombreFilter) {
      if (!item.sujeto_pasivo || !item.sujeto_pasivo.toLowerCase().includes(filters.nombre.toLowerCase())) {
        return;
      }
    }
    // Filtro por Cargo
    if (hasCargoFilter) {
      const cleanedCargo = getCargoClean(item.cargo);
      if (!cleanedCargo.toLowerCase().includes(filters.cargo.toLowerCase())) {
        return;
      }
    }
    // Filtro por Rango de Fechas (se aplica a la fecha límite DDL y, si existe, a la fecha agendada)
    if (item.fecha_limite_sh) {
      const itemDate = item.fecha_limite_sh.split(' ')[0]; // YYYY-MM-DD
      if (filters.fechaInicio && itemDate < filters.fechaInicio) {
        return;
      }
      if (filters.fechaTermino && itemDate > filters.fechaTermino) {
        return;
      }
    } else {
      if (filters.fechaInicio || filters.fechaTermino) {
        return;
      }
    }

    if (item.fecha_agendada && item.fecha_agendada !== '-' && item.fecha_agendada !== '---') {
      const agendaDate = item.fecha_agendada.split(' ')[0]; // YYYY-MM-DD
      if (filters.fechaInicio && agendaDate < filters.fechaInicio) {
        return;
      }
      if (filters.fechaTermino && agendaDate > filters.fechaTermino) {
        return;
      }
    }
    // Filtro por Estados Múltiples
    if (hasEstadosFilter) {
      const match = filters.estados.some(est => est.toLowerCase() === itemEstado.toLowerCase());
      if (!match) {
        return;
      }
    }
    
    filtered.push(item);
  });

  // Mapear registros filtrados a su formato plano
  return filtered.map((item, idx) => {
    const isLicitacion = item.cargo && (item.cargo.includes('2770-') || item.cargo.includes('27770-'));
    const cleanedCargoText = isLicitacion ? getCargoCleanBidding(item.cargo) : getCargoClean(item.cargo);
    const normalizedName = normalizeName(item.sujeto_pasivo) || 'Sin Nombre';
    const cargoCombinado = `${normalizedName} - ${cleanedCargoText}`;

    // Determinar estado lógico virtual
    let itemEstado = (item.estado || 'Ingresada').trim();
    const isPendiente = itemEstado.toLowerCase() === 'aceptada' && item.fecha_agendada && !publicadosFolios.has(item.folio_lobby);
    if (isPendiente) {
      itemEstado = 'Pendiente de publicación';
    }

    // Obtener badge
    let badge;
    if (isPendiente) {
      badge = {
        text: 'Pendiente de publicación',
        class: 'badge-status-otros'
      };
    } else {
      badge = getDeadlineStatusBadge(item.fecha_ingreso, item.fecha_respuesta, item.estado, item);
    }
    const plazoRestanteStr = getStandardizedPlazoText(item, isPendiente);

    return {
      index: idx + 1,
      id: item.id || idx,
      folio: item.folio_lobby || 'Sin Folio',
      cargoCompleto: cargoCombinado,
      cargo: cleanedCargoText,
      fechaIngreso: formatDate(item.fecha_ingreso),
      fechaAgendada: formatDate(item.fecha_agendada) || '---',
      estado: itemEstado,
      badgeClass: badge.class,
      badgeText: badge.text,
      plazo: plazoRestanteStr
    };
  });
}

// Helper para calcular la fecha límite de publicación y el estado/días de atraso en incrementos de 30 días
function getPendingPublicationDelay(fechaAgendada, item) {
  if (!fechaAgendada) {
    return {
      deadlineStr: '---',
      days: 0,
      badgeClass: 'badge-status-normal',
      text: 'Sin Fecha'
    };
  }
  
  try {
    let deadlineStr = '---';
    if (item && item.fecha_limite_publicacion) {
      deadlineStr = formatDate(item.fecha_limite_publicacion);
    } else {
      const agendadaParts = fechaAgendada.split(' ')[0].split('-');
      if (agendadaParts.length === 3) {
        const year = parseInt(agendadaParts[0], 10);
        const month = parseInt(agendadaParts[1], 10) - 1;
        const lastDay = new Date(year, month + 1, 0);
        deadlineStr = formatDate(`${lastDay.getFullYear()}-${String(lastDay.getMonth() + 1).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`);
      }
    }

    const delayDays = (item && item.dias_retraso_publicacion !== undefined) ? item.dias_retraso_publicacion : 0;
    
    if (delayDays <= 0) {
      return {
        deadlineStr,
        days: 0,
        badgeClass: 'badge-status-enplazo',
        text: 'En plazo'
      };
    } else {
      return {
        deadlineStr,
        days: delayDays,
        badgeClass: 'badge-status-vencido',
        text: `Atrasado (-${delayDays}d)`
      };
    }
  } catch (e) {
    return {
      deadlineStr: '---',
      days: 0,
      badgeClass: 'badge-status-normal',
      text: 'Error'
    };
  }
}


/**
 * Anima un valor numérico incrementándolo suavemente desde 0 hasta el valor final.
 * @param {string} elementId ID del elemento HTML
 * @param {number|string} targetValue Valor final de la animación
 * @param {number} duration Duración en milisegundos
 */
function animateNumberCount(elementId, targetValue, duration = 800) {
  const obj = document.getElementById(elementId);
  if (!obj) return;
  
  const valToUse = targetValue !== undefined && targetValue !== null ? targetValue : obj.textContent;
  const start = 0;
  const end = parseInt(valToUse, 10);
  if (isNaN(end)) {
    obj.textContent = valToUse;
    return;
  }
  if (end === 0) {
    obj.textContent = "0";
    return;
  }
  
  let startTimestamp = null;
  const step = (timestamp) => {
    if (!startTimestamp) startTimestamp = timestamp;
    const progress = Math.min((timestamp - startTimestamp) / duration, 1);
    const currentValue = Math.floor(progress * (end - start) + start);
    obj.textContent = currentValue.toLocaleString('es-CL');
    if (progress < 1) {
      window.requestAnimationFrame(step);
    } else {
      obj.textContent = end.toLocaleString('es-CL');
    }
  };
  window.requestAnimationFrame(step);
}

// Función utilitaria Debounce
function debounce(fn, delay) {
  let timer = null;
  return function (...args) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      fn.apply(this, args);
    }, delay);
  };
}

// Traducir y mapear errores técnicos a mensajes amigables y códigos de soporte
function translateError(msg) {
  if (!msg) return 'Su sesión ha expirado. Por favor, inicie sesión nuevamente. [ERR-AUTH-201]';
  const cleanMsg = String(msg).toLowerCase();

  // 1. Conectividad y Red
  if (cleanMsg.includes('enotfound') || cleanMsg.includes('getaddrinfo') || cleanMsg.includes('connect error') || cleanMsg.includes('error de conexión') || cleanMsg.includes('etimedout') || cleanMsg.includes('econnreset') || cleanMsg.includes('fetch failed')) {
    if (cleanMsg.includes('econnreset')) {
      return 'Conexión con el servidor interrumpida. Por favor, reintente. [ERR-NET-102]';
    }
    return 'No se pudo establecer conexión. Verifique su conexión a internet. [ERR-NET-101]';
  }

  // 2. Autenticación y Autorización
  if (cleanMsg.includes('cancelado') || cleanMsg.includes('cancelada') || cleanMsg.includes('user cancelled') || cleanMsg.includes('closed the window')) {
    return 'Inicio de sesión cancelado por el usuario. [ERR-AUTH-205]';
  }
  if (cleanMsg.includes('no se encuentra registrado') || cleanMsg.includes('no está registrado') || cleanMsg.includes('user_not_registered') || cleanMsg.includes('autorizad') || cleanMsg.includes('privilegios insuficientes')) {
    return 'Usuario no registrado en el sistema. Contacte con Soporte Lobby. [ERR-AUTH-202]';
  }
  if (cleanMsg.includes('dominio') || cleanMsg.includes('maipu.cl') || cleanMsg.includes('cuenta @maipu.cl') || cleanMsg.includes('correo institucional inválido')) {
    return 'Debes iniciar sesión con tu cuenta de correo institucional (@maipu.cl). [ERR-AUTH-203]';
  }
  if (cleanMsg.includes('denegado') || cleanMsg.includes('no autorizado') || cleanMsg.includes('privilegios de administrador') || cleanMsg.includes('role')) {
    if (cleanMsg.includes('administrador')) {
      return 'Acceso denegado. Se requieren privilegios de Administrador. [ERR-AUTH-204]';
    }
    return 'Su sesión ha expirado. Por favor, inicie sesión nuevamente. [ERR-AUTH-201]';
  }
  if (cleanMsg.includes('token') || cleanMsg.includes('auth error') || cleanMsg.includes('microsoft')) {
    return 'Error de autenticación institucional. Por favor, intente nuevamente. [ERR-AUTH-206]';
  }
  if (cleanMsg.includes('perfil') || cleanMsg.includes('session') || cleanMsg.includes('expirado') || cleanMsg.includes('expired')) {
    return 'Su sesión ha expirado. Por favor, inicie sesión nuevamente. [ERR-AUTH-201]';
  }

  // 3. Sincronización e Integridad Cloud
  if (cleanMsg.includes('descargar') || cleanMsg.includes('sincronización inicial') || cleanMsg.includes('pull')) {
    if (cleanMsg.includes('404') || cleanMsg.includes('no está inicializada en sharepoint')) {
      return 'La base de datos de usuarios no está inicializada en SharePoint. Contacte con Soporte Lobby. [ERR-SYNC-304]';
    }
    return 'Fallo al descargar datos desde la nube. Reintente en unos instantes. [ERR-SYNC-301]';
  }
  if (cleanMsg.includes('firma') || cleanMsg.includes('signature') || cleanMsg.includes('corrupt') || cleanMsg.includes('integridad')) {
    return 'Fallo de integridad en los datos locales. Contacte con Soporte Lobby. [ERR-SYNC-302]';
  }
  if (cleanMsg.includes('subir') || cleanMsg.includes('push') || cleanMsg.includes('sincronizar con sharepoint')) {
    return 'Fallo al guardar datos en la nube. Reintente en unos instantes. [ERR-SYNC-303]';
  }

  // 4. Base de Datos Local y Transacciones
  if (cleanMsg.includes('ebusy') || cleanMsg.includes('locked') || cleanMsg.includes('almacenamiento') || cleanMsg.includes('resource busy')) {
    return 'Error de almacenamiento local. Cierre otras instancias de la aplicación. [ERR-DB-401]';
  }
  if (cleanMsg.includes('unique') || cleanMsg.includes('ya está registrado') || cleanMsg.includes('ya existe') || cleanMsg.includes('duplicado')) {
    return 'El correo electrónico ingresado ya se encuentra registrado. [ERR-DB-402]';
  }
  if (cleanMsg.includes('no puedes eliminar a tu propio usuario') || cleanMsg.includes('propio usuario')) {
    return 'Operación inválida: No puedes eliminar a tu propio usuario. [ERR-DB-403]';
  }
  if (cleanMsg.includes('sqlite_error') || cleanMsg.includes('query') || cleanMsg.includes('syntax') || cleanMsg.includes('database')) {
    return 'Error en la base de datos local. Reintente la acción. [ERR-DB-500]';
  }

  // 5. Importación de Excel y Hojas
  if (cleanMsg.includes('excel') || cleanMsg.includes('sheet') || cleanMsg.includes('hoja')) {
    if (cleanMsg.includes('formato') || cleanMsg.includes('sh') || cleanMsg.includes('ph') || cleanMsg.includes('sph')) {
      return 'El archivo no cumple con el formato requerido de la Ley de Lobby (faltan hojas obligatorias). [ERR-IMPORT-402]';
    }
    if (cleanMsg.includes('vacío') || cleanMsg.includes('empty') || cleanMsg.includes('sin registros') || cleanMsg.includes('sin filas')) {
      return 'El archivo Excel seleccionado está vacío o no contiene registros válidos. [ERR-IMPORT-403]';
    }
    return 'No se pudo leer el archivo Excel. Asegúrese de que no esté dañado. [ERR-IMPORT-401]';
  }
  if (cleanMsg.includes('sincronización activo') || cleanMsg.includes('ya hay un proceso')) {
    return 'Ya hay una importación activa en ejecución. Espere a que finalice. [ERR-IMPORT-409]';
  }

  // 6. Reportes e Impresión
  if (cleanMsg.includes('pdf') || cleanMsg.includes('reporte') || cleanMsg.includes('impresión')) {
    if (cleanMsg.includes('cancelado') || cleanMsg.includes('cancelada') || cleanMsg.includes('cancel')) {
      return 'Guardado de reporte cancelado por el usuario. [ERR-REPORT-502]';
    }
    return 'No se pudo generar el reporte en PDF. Verifique los permisos de escritura. [ERR-REPORT-501]';
  }

  // 7. General Fallback
  return 'Ha ocurrido un error inesperado en el sistema. [ERR-GEN-999]';
}

/**
 * Formatea un porcentaje resguardando que valores muy bajos no se muestren como 0%
 * @param {number} pct - Porcentaje calculado (ej: 0)
 * @param {number} count - Cantidad real de elementos (ej: 8)
 * @returns {string} Texto formateado
 */
function formatPct(pct, count) {
  if (count > 0 && pct < 0.1) {
    return '<0.1%';
  }
  return `${pct}%`;
}


