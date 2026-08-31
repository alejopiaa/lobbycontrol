/**
 * DateCalculator - Algoritmo de cálculo de plazos de Ley de Lobby y días hábiles
 */

// Lista fija de feriados nacionales chilenos
const FERIADOS_CHILE = [
  '2026-01-01', '2026-04-03', '2026-04-04', '2026-05-01', '2026-05-21',
  '2026-06-29', '2026-07-16', '2026-08-15', '2026-09-18', '2026-09-19',
  '2026-10-12', '2026-10-31', '2026-11-01', '2026-12-08', '2026-12-25'
];

export function isHabil(date) {
  const d = new Date(date);
  const dayOfWeek = d.getDay();
  if (dayOfWeek === 0 || dayOfWeek === 6) return false; // Domingo o Sábado
  const iso = d.toISOString().split('T')[0];
  return !FERIADOS_CHILE.includes(iso);
}

export function calculateDeadline(fechaIngreso, diasHabiles = 3) {
  if (!fechaIngreso) return null;
  try {
    let cur = new Date(fechaIngreso);
    let added = 0;
    while (added < diasHabiles) {
      cur.setDate(cur.getDate() + 1);
      if (isHabil(cur)) {
        added++;
      }
    }
    return cur;
  } catch (err) {
    console.error('[DateCalculator] Error al calcular plazo:', err);
    return null;
  }
}

export function getDaysRemaining(fechaLimite) {
  if (!fechaLimite) return null;
  try {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const target = new Date(fechaLimite);
    target.setHours(0, 0, 0, 0);
    const diffTime = target.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  } catch (err) {
    return null;
  }
}
