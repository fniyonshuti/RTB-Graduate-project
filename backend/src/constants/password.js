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

export const PASSWORD_REQUIREMENTS = [
  {
    key: 'length',
    label: 'At least 8 characters',
    test: (password) => String(password || '').length >= 8,
  },
  {
    key: 'uppercase',
    label: 'At least one uppercase letter',
    test: (password) => /[A-Z]/.test(String(password || '')),
  },
  {
    key: 'lowercase',
    label: 'At least one lowercase letter',
    test: (password) => /[a-z]/.test(String(password || '')),
  },
  {
    key: 'number',
    label: 'At least one number',
    test: (password) => /\d/.test(String(password || '')),
  },
  {
    key: 'special',
    label: 'At least one special character',
    test: (password) => /[^A-Za-z0-9\s]/.test(String(password || '')),
  },
  {
    key: 'spaces',
    label: 'No spaces',
    test: (password) => !/\s/.test(String(password || '')),
  },
];

export function checkPasswordPolicy(password) {
  const value = String(password || '');
  const requirements = PASSWORD_REQUIREMENTS.map((requirement) => ({
    key: requirement.key,
    label: requirement.label,
    passed: requirement.test(value),
  }));
  const passedCount = requirements.filter((requirement) => requirement.passed).length;
  const isValid = requirements.every((requirement) => requirement.passed);
  const strength = isValid ? 'Strong' : passedCount >= 4 && value.length >= 8 ? 'Medium' : 'Weak';

  return {
    isValid,
    strength,
    requirements,
    missingRequirements: requirements
      .filter((requirement) => !requirement.passed)
      .map((requirement) => requirement.label),
  };
}

export function passwordPolicyMessage(label = 'Password') {
  return `${label} must be at least 8 characters and include uppercase, lowercase, number, special character, and no spaces.`;
}