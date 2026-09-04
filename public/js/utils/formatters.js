/**
 * Formatters - Utilidades puras de formateo y localización chilena (es-CL)
 */

export function formatDateForDisplay(dateInput) {
  if (!dateInput) return '';
  try {
    const str = String(dateInput).trim();
    if (str.includes('T') || str.includes('-')) {
      const parts = str.split('T')[0].split('-');
      if (parts.length === 3) {
        return `${parts[2]}-${parts[1]}-${parts[0]}`;
      }
    }
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return String(dateInput);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  } catch (err) {
    return String(dateInput);
  }
}

export function formatDateTime(dateInput) {
  if (!dateInput) return '';
  try {
    const d = new Date(String(dateInput).replace(' ', 'T') + (String(dateInput).includes('Z') ? '' : 'Z'));
    if (isNaN(d.getTime())) return String(dateInput);
    return d.toLocaleString('es-CL', {
      timeZone: 'America/Santiago',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  } catch (err) {
    return String(dateInput);
  }
}

export function formatNumber(num) {
  if (num === null || num === undefined || isNaN(num)) return '0';
  return Number(num).toLocaleString('es-CL');
}

export function formatPct(val, count = null) {
  if (val === null || val === undefined || isNaN(val)) return '0%';
  const num = Number(val);
  const formatted = num % 1 === 0 ? `${num}%` : `${num.toFixed(1)}%`;
  if (count !== null && count !== undefined) {
    return `${formatted} (${formatNumber(count)})`;
  }
  return formatted;
}

export function formatRut(rut) {
  if (!rut) return '';
  const clean = String(rut).replace(/[^0-9kK]/g, '').toUpperCase();
  if (clean.length < 2) return clean;
  const dv = clean.slice(-1);
  const cuerpo = clean.slice(0, -1);
  return `${formatNumber(cuerpo)}-${dv}`;
}

export function sanitizeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
