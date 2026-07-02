import type { Role } from '../types'

export const learnerRoles: Role[] = ['normal_user', 'organization_user', 'graduate']
export const adminRoles: Role[] = ['admin', 'super_admin']

export function isLearnerRole(role: Role) {
  return learnerRoles.includes(role)
}

export function isAdminRole(role: Role) {
  return adminRoles.includes(role)
}

export function roleLabel(role: Role) {
  const labels: Record<Role, string> = {
    normal_user: 'Normal User',
    organization_user: 'Organization User',
    org_admin: 'Organization Admin',
    admin: 'Admin',
    super_admin: 'Super Admin',
    graduate: 'Organization User',
    assessor: 'Assessor (legacy)',
  }

  return labels[role] || role
}
