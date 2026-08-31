/**
 * ErrorTranslator - Diccionario y normalizador de excepciones hacia mensajes legibles
 */
const ERROR_DICTIONARY = {
  'Failed to fetch': 'No se pudo conectar con el servidor local o el servicio de red.',
  'NetworkError': 'Error de conexión de red.',
  'SQLITE_CONSTRAINT': 'Conflicto de integridad en la base de datos (registro duplicado o clave foránea inválida).',
  'SQLITE_BUSY': 'La base de datos está ocupada por otra operación. Intenta nuevamente.',
  'UNAUTHORIZED': 'Tu sesión ha expirado o no tienes permisos para realizar esta acción.',
  'NOT_FOUND': 'El registro solicitado no existe o fue eliminado.'
};

export function translateError(rawError) {
  if (!rawError) return 'Ha ocurrido un error inesperado.';
  const msg = typeof rawError === 'string' ? rawError : (rawError.message || JSON.stringify(rawError));

  for (const [pattern, translation] of Object.entries(ERROR_DICTIONARY)) {
    if (msg.includes(pattern)) {
      return translation;
    }
  }

  return msg;
}
