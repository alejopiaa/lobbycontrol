// date-utils.js - Centralized date and holiday calculations (DRY backend)

const staticHolidays = new Set();
let holidaysInitialized = false;

function initializeHolidays() {
  const start = 2015;
  const end = 2030;
  for (let year = start; year <= end; year++) {
    for (let month = 0; month < 12; month++) {
      const numDays = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
      for (let day = 1; day <= numDays; day++) {
        const testDate = new Date(Date.UTC(year, month, day));
        if (calculateIsChileanHoliday(testDate)) {
          staticHolidays.add(`${year}-${month}-${day}`);
        }
      }
    }
  }
}

function isChileanHoliday(date) {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth();
  const d = date.getUTCDate();
  
  if (y >= 2015 && y <= 2030) {
    if (!holidaysInitialized) {
      initializeHolidays();
      holidaysInitialized = true;
    }
    return staticHolidays.has(`${y}-${m}-${d}`);
  }
  
  // Fallback para fechas fuera del rango precalculado
  return calculateIsChileanHoliday(date);
}

function calculateIsChileanHoliday(date) {
  const m = date.getUTCMonth(); // 0-indexed
  const d = date.getUTCDate();
  const y = date.getUTCFullYear();

  const fijosAbsolutos = [
    { m: 0, d: 1 },   // 1 Ene: Año Nuevo
    { m: 4, d: 1 },   // 1 May: Día del Trabajo
    { m: 4, d: 21 },  // 21 May: Glorias Navales
    { m: 6, d: 16 },  // 16 Jul: Virgen del Carmen
    { m: 7, d: 15 },  // 15 Ago: Asunción de la Virgen
    { m: 8, d: 18 },  // 18 Sep: Fiestas Patrias
    { m: 8, d: 19 },  // 19 Sep: Glorias del Ejército
    { m: 10, d: 1 },  // 1 Nov: Todos los Santos
    { m: 11, d: 8 },  // 8 Dic: Inmaculada Concepción
    { m: 11, d: 25 }  // 25 Dic: Navidad
  ];

  if (fijosAbsolutos.some(f => f.m === m && f.d === d)) {
    return true;
  }

  // Algoritmo de Computus para Semana Santa
  const a = y % 19;
  const b = Math.floor(y / 100);
  const c = y % 100;
  const dRes = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - dRes - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const mRes = Math.floor((a + 11 * h + 22 * l) / 451);
  const monthRes = Math.floor((h + l - 7 * mRes + 114) / 31);
  const dayRes = ((h + l - 7 * mRes + 114) % 31) + 1;

  const resurreccion = new Date(Date.UTC(y, monthRes - 1, dayRes));
  const viernesSanto = new Date(resurreccion.getTime());
  viernesSanto.setUTCDate(resurreccion.getUTCDate() - 2);

  const sabadoSanto = new Date(resurreccion.getTime());
  sabadoSanto.setUTCDate(resurreccion.getUTCDate() - 1);

  if (m === viernesSanto.getUTCMonth() && d === viernesSanto.getUTCDate()) return true;
  if (m === sabadoSanto.getUTCMonth() && d === sabadoSanto.getUTCDate()) return true;

  // Feriados móviles Ley 19.668
  const checkMovableHoliday = (origMonth, origDay) => {
    const origDate = new Date(Date.UTC(y, origMonth, origDay));
    const dayOfWeek = origDate.getUTCDay();
    let finalMonth = origMonth;
    let finalDay = origDay;

    if (dayOfWeek === 2 || dayOfWeek === 3) {
      const diff = dayOfWeek === 2 ? 1 : 2;
      origDate.setUTCDate(origDate.getUTCDate() - diff);
      finalMonth = origDate.getUTCMonth();
      finalDay = origDate.getUTCDate();
    } else if (dayOfWeek === 4) {
      origDate.setUTCDate(origDate.getUTCDate() + 4);
      finalMonth = origDate.getUTCMonth();
      finalDay = origDate.getUTCDate();
    }
    return m === finalMonth && d === finalDay;
  };

  if (checkMovableHoliday(5, 29)) return true; // San Pedro y San Pablo
  if (checkMovableHoliday(9, 12)) return true; // Encuentro de Dos Mundos

  // Feriado evangélico Ley 20.299
  let evanMonth = 9;
  let evanDay = 31;
  const evanDate = new Date(Date.UTC(y, 9, 31));
  const evanDayOfWeek = evanDate.getUTCDay();
  if (evanDayOfWeek === 2) {
    evanMonth = 9;
    evanDay = 27;
  } else if (evanDayOfWeek === 3) {
    evanMonth = 10;
    evanDay = 2;
  }
  if (m === evanMonth && d === evanDay) return true;

  return false;
}

function getDeadlineDate(dateString) {
  if (!dateString) return null;
  try {
    const datePart = dateString.split(' ')[0];
    const parts = datePart.split('-');
    if (parts.length !== 3) return null;
    
    let year = parseInt(parts[0], 10);
    let month = parseInt(parts[1], 10) - 1;
    let day = parseInt(parts[2], 10);
    
    let date = new Date(Date.UTC(year, month, day));
    
    let addedDays = 0;
    while (addedDays < 3) {
      date.setUTCDate(date.getUTCDate() + 1);
      const dayOfWeek = date.getUTCDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6 && !isChileanHoliday(date)) {
        addedDays++;
      }
    }
    return date;
  } catch (e) {
    return null;
  }
}

function getBusinessDaysDiff(date1, date2) {
  const d1 = new Date(Date.UTC(date1.getUTCFullYear(), date1.getUTCMonth(), date1.getUTCDate()));
  const d2 = new Date(Date.UTC(date2.getUTCFullYear(), date2.getUTCMonth(), date2.getUTCDate()));
  
  if (d1.getTime() === d2.getTime()) return 0;
  
  let start = d1 < d2 ? d1 : d2;
  let end = d1 < d2 ? d2 : d1;
  
  let count = 0;
  let cur = new Date(start.getTime());
  
  while (cur < end) {
    cur.setUTCDate(cur.getUTCDate() + 1);
    const dayOfWeek = cur.getUTCDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6 && !isChileanHoliday(cur)) {
      count++;
    }
  }
  
  return d1 < d2 ? count : -count;
}

function getLastBusinessDayOfMonth(year, month) {
  let date = new Date(Date.UTC(year, month + 1, 0));
  while (true) {
    const dayOfWeek = date.getUTCDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6 && !isChileanHoliday(date)) {
      return date;
    }
    date.setUTCDate(date.getUTCDate() - 1);
  }
}

module.exports = {
  isChileanHoliday,
  getDeadlineDate,
  getBusinessDaysDiff,
  getLastBusinessDayOfMonth
};
