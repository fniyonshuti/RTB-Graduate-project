export const ROLES = {
  NORMAL_USER: "normal_user",
  ORGANIZATION_USER: "organization_user",
  ORGANIZATION_ADMIN: "org_admin",
  ADMIN: "admin",
  SUPER_ADMIN: "super_admin",
  LEGACY_GRADUATE: "graduate",
  LEGACY_ASSESSOR: "assessor",
};

export const USER_ROLE_VALUES = Object.values(ROLES);

export const LEARNER_ROLES = [
  ROLES.NORMAL_USER,
  ROLES.ORGANIZATION_USER,
  ROLES.LEGACY_GRADUATE,
];

export const ORGANIZATION_SCOPED_ROLES = [
  ROLES.ORGANIZATION_USER,
  ROLES.ORGANIZATION_ADMIN,
  ROLES.LEGACY_GRADUATE,
];

export const SYSTEM_ADMIN_ROLES = [ROLES.ADMIN, ROLES.SUPER_ADMIN];
export const ADMINISTRATIVE_ROLES = [
  ROLES.ORGANIZATION_ADMIN,
  ROLES.ADMIN,
  ROLES.SUPER_ADMIN,
];

export function isLearnerRole(role) {
  return LEARNER_ROLES.includes(role);
}

export function isOrganizationUserRole(role) {
  return role === ROLES.ORGANIZATION_USER || role === ROLES.LEGACY_GRADUATE;
}

export function isOrganizationAdminRole(role) {
  return role === ROLES.ORGANIZATION_ADMIN;
}

export function isAdminRole(role) {
  return role === ROLES.ADMIN || role === ROLES.SUPER_ADMIN;
}

export function isSuperAdminRole(role) {
  return role === ROLES.SUPER_ADMIN;
}

export function manageableRolesFor(role) {
  if (role === ROLES.SUPER_ADMIN) {
    return [
      ROLES.NORMAL_USER,
      ROLES.ORGANIZATION_USER,
      ROLES.ORGANIZATION_ADMIN,
      ROLES.ADMIN,
      ROLES.SUPER_ADMIN,
      ROLES.LEGACY_GRADUATE,
    ];
  }

  if (role === ROLES.ADMIN) {
    return [ROLES.ORGANIZATION_ADMIN];
  }

  if (role === ROLES.ORGANIZATION_ADMIN) {
    return [ROLES.ORGANIZATION_USER];
  }

  return [];
}

export function canManageRole(actorRole, targetRole) {
  return manageableRolesFor(actorRole).includes(targetRole);
}

export function creatableRolesFor(role) {
  if (role === ROLES.SUPER_ADMIN) {
    return [ROLES.ADMIN];
  }

  if (role === ROLES.ADMIN) {
    return [ROLES.ORGANIZATION_ADMIN];
  }

  if (role === ROLES.ORGANIZATION_ADMIN) {
    return [ROLES.ORGANIZATION_USER];
  }

  return [];
}

export function canCreateRole(actorRole, targetRole) {
  return creatableRolesFor(actorRole).includes(targetRole);
}

export function displayRole(role) {
  const labels = {
    [ROLES.NORMAL_USER]: "Normal User",
    [ROLES.ORGANIZATION_USER]: "Organization User",
    [ROLES.ORGANIZATION_ADMIN]: "Organization Admin",
    [ROLES.ADMIN]: "Admin",
    [ROLES.SUPER_ADMIN]: "Super Admin",
    [ROLES.LEGACY_GRADUATE]: "Organization User",
    [ROLES.LEGACY_ASSESSOR]: "Assessor (legacy)",
  };

  return labels[role] || role;
}
