import crypto from 'crypto';
import { PASSWORD_HASHING } from '../constants/password.js';

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const passwordHash = crypto
    .pbkdf2Sync(password, salt, PASSWORD_HASHING.iterations, PASSWORD_HASHING.keyLength, PASSWORD_HASHING.digest)
    .toString('hex');

  return { passwordHash, passwordSalt: salt };
}

export function verifyPassword(password, passwordHash, passwordSalt) {
  const attemptedHash = crypto
    .pbkdf2Sync(password, passwordSalt, PASSWORD_HASHING.iterations, PASSWORD_HASHING.keyLength, PASSWORD_HASHING.digest)
    .toString('hex');

  return crypto.timingSafeEqual(
    Buffer.from(attemptedHash, 'hex'),
    Buffer.from(passwordHash, 'hex')
  );
}
