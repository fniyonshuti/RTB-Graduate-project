export const passwordRequirements = [
  {
    key: 'length',
    label: 'At least 8 characters',
    test: (password: string) => password.length >= 8,
  },
  {
    key: 'uppercase',
    label: 'At least one uppercase letter',
    test: (password: string) => /[A-Z]/.test(password),
  },
  {
    key: 'lowercase',
    label: 'At least one lowercase letter',
    test: (password: string) => /[a-z]/.test(password),
  },
  {
    key: 'number',
    label: 'At least one number',
    test: (password: string) => /\d/.test(password),
  },
  {
    key: 'special',
    label: 'At least one special character',
    test: (password: string) => /[^A-Za-z0-9\s]/.test(password),
  },
  {
    key: 'spaces',
    label: 'No spaces',
    test: (password: string) => !/\s/.test(password),
  },
]

export function getPasswordPolicy(password: string) {
  const requirements = passwordRequirements.map((requirement) => ({
    key: requirement.key,
    label: requirement.label,
    passed: requirement.test(password),
  }))
  const passedCount = requirements.filter((requirement) => requirement.passed).length
  const isValid = requirements.every((requirement) => requirement.passed)
  const strength = isValid ? 'Strong' : passedCount >= 4 && password.length >= 8 ? 'Medium' : 'Weak'

  return { isValid, strength, requirements }
}

export function passwordPolicyMessage(label = 'Password') {
  return `${label} must be at least 8 characters and include uppercase, lowercase, number, special character, and no spaces.`
}