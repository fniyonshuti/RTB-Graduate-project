import dotenv from 'dotenv';

dotenv.config({ quiet: true });

export const PASSWORD_HASHING = {
  // PBKDF2 iterations for password hashing (higher = more secure but slower)
  // Configured via PBKDF2_ITERATIONS env var, defaults to 120000
  iterations: Number(process.env.PBKDF2_ITERATIONS) || 120000,
  
  // Key length for PBKDF2 hash output
  // Configured via PBKDF2_KEY_LENGTH env var, defaults to 64
  keyLength: Number(process.env.PBKDF2_KEY_LENGTH) || 64,
  
  // Hash digest algorithm for PBKDF2
  // Configured via PBKDF2_DIGEST env var, defaults to 'sha512'
  digest: process.env.PBKDF2_DIGEST || 'sha512',
};
