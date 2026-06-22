const auth = require('c:/Users/abarrazaj/OneDrive - Ilustre Municipalidad de Maipú/Documentos/Antigravity/Lobby/auth');
const crypto = require('crypto');

console.log('--- Iniciando prueba de Hashing ---');

// 1. Probar el nuevo hash Scrypt
const rawPassword = 'PruebaScrypt2026!';
const scryptHash = auth.hashPassword(rawPassword);
console.log('Scrypt Hash Generado:', scryptHash);

if (!scryptHash.startsWith('scrypt:')) {
  console.error('ERROR: El hash no tiene el prefijo "scrypt:"');
  process.exit(1);
}

// 2. Verificar la contraseña recién generada
const isValidScrypt = auth.verifyPassword(rawPassword, scryptHash);
console.log('¿Es válida la contraseña Scrypt?:', isValidScrypt);
if (!isValidScrypt) {
  console.error('ERROR: Falló la verificación de la contraseña Scrypt');
  process.exit(1);
}

// 3. Probar contraseña incorrecta con Scrypt
const isValidScryptWrong = auth.verifyPassword('WrongPass', scryptHash);
console.log('¿Es válida la contraseña incorrecta con Scrypt? (Debe ser false):', isValidScryptWrong);
if (isValidScryptWrong) {
  console.error('ERROR: Aceptó una contraseña incorrecta en Scrypt');
  process.exit(1);
}

// 4. Probar retrocompatibilidad con hash PBKDF2 antiguo
// Formato PBKDF2 antiguo: salt:hash
const pbkdf2Salt = crypto.randomBytes(16).toString('hex');
const pbkdf2Hash = crypto.pbkdf2Sync('Maipu2026!', pbkdf2Salt, 20000, 64, 'sha512').toString('hex');
const storedPbkdf2Hash = `${pbkdf2Salt}:${pbkdf2Hash}`;
console.log('Simulación de Hash PBKDF2 antiguo:', storedPbkdf2Hash);

const isValidPbkdf2 = auth.verifyPassword('Maipu2026!', storedPbkdf2Hash);
console.log('¿Es válida la contraseña PBKDF2 antigua?:', isValidPbkdf2);
if (!isValidPbkdf2) {
  console.error('ERROR: Falló la verificación de la contraseña PBKDF2 heredada');
  process.exit(1);
}

const isValidPbkdf2Wrong = auth.verifyPassword('WrongPass', storedPbkdf2Hash);
console.log('¿Es válida la contraseña incorrecta con PBKDF2? (Debe ser false):', isValidPbkdf2Wrong);
if (isValidPbkdf2Wrong) {
  console.error('ERROR: Aceptó una contraseña incorrecta en PBKDF2 heredada');
  process.exit(1);
}

console.log('--- ¡TODAS LAS PRUEBAS PASARON EXITOSAMENTE! ---');
