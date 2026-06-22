const crypto = require('crypto');

const ITERATIONS = 20000;
const KEYLEN = 64;
const DIGEST = 'sha512';
const JWT_SECRET = process.env.JWT_SECRET || 'lobbyflow_super_secret_dev_key_2026';

/**
 * Genera una sal aleatoria y calcula el hash de la contraseña usando Scrypt
 * @param {string} password - Contraseña en texto plano
 * @returns {string} Formato 'scrypt:salt:hash' en hexadecimal
 */
function hashPassword(password) {
  if (!password) return '';
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt:${salt}:${hash}`;
}

/**
 * Verifica si una contraseña coincide con el hash guardado (soporta Scrypt y PBKDF2)
 * @param {string} password - Contraseña en texto plano
 * @param {string} storedPasswordHash - Hash guardado en formato 'scrypt:salt:hash' o 'salt:hash'
 * @returns {boolean} True si coincide, de lo contrario False
 */
function verifyPassword(password, storedPasswordHash) {
  if (!password || !storedPasswordHash) return false;
  
  // Retrocompatibilidad con PBKDF2
  if (!storedPasswordHash.startsWith('scrypt:')) {
    if (!storedPasswordHash.includes(':')) return false;
    const parts = storedPasswordHash.split(':');
    if (parts.length !== 2) return false;
    const [salt, hash] = parts;
    const checkHash = crypto.pbkdf2Sync(password, salt, ITERATIONS, KEYLEN, DIGEST).toString('hex');
    return checkHash === hash;
  }
  
  // Formato Scrypt: scrypt:salt:hash
  const parts = storedPasswordHash.split(':');
  if (parts.length !== 3) return false;
  const [, salt, hash] = parts;
  const checkHash = crypto.scryptSync(password, salt, 64).toString('hex');
  return checkHash === hash;
}

/**
 * Genera un token JWT (HS256) firmado localmente sin dependencias externas
 * @param {Object} payload - Datos del usuario a encriptar en el token
 * @returns {string} Token JWT
 */
function signToken(payload) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify({
    ...payload,
    exp: Math.floor(Date.now() / 1000) + (30 * 60) // Expira en 30 minutos
  })).toString('base64url');
  
  const hmac = crypto.createHmac('sha256', JWT_SECRET);
  hmac.update(`${header}.${body}`);
  const signature = hmac.digest('base64url');
  
  return `${header}.${body}.${signature}`;
}

/**
 * Verifica y decodifica un token JWT firmado
 * @param {string} token - Token JWT a verificar
 * @returns {Object|null} Payload decodificado o null si el token es inválido o expiró
 */
function verifyToken(token) {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  
  const [header, body, signature] = parts;
  const hmac = crypto.createHmac('sha256', JWT_SECRET);
  hmac.update(`${header}.${body}`);
  const expectedSignature = hmac.digest('base64url');
  
  if (signature !== expectedSignature) {
    return null;
  }
  
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null; // Token expirado
    }
    return payload;
  } catch (e) {
    return null;
  }
}

module.exports = {
  hashPassword,
  verifyPassword,
  signToken,
  verifyToken
};
