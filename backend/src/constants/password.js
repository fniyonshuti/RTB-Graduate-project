import { env } from '../config/env.js';

export const PASSWORD_HASHING = {
  // PBKDF2 iterations for password hashing (higher = more secure but slower)
  // Configured via PBKDF2_ITERATIONS env var, defaults to 120000
  iterations: env.pbkdf2Iterations,
  
  // Key length for PBKDF2 hash output
  // Configured via PBKDF2_KEY_LENGTH env var, defaults to 64
  keyLength: env.pbkdf2KeyLength,
  
  // Hash digest algorithm for PBKDF2
  // Configured via PBKDF2_DIGEST env var, defaults to 'sha512'
  digest: env.pbkdf2Digest,
};
