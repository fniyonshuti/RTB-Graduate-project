import User from "../models/User.js";
import Organization from "../models/Organization.js";
import { sanitizeUser } from "./authService.js";
import { AppError } from "./errorService.js";
import { assertStrongPassword, hashPassword } from "./authService.js";
import dotenv from "dotenv";
import {
  ROLES,
  ORGANIZATION_SCOPED_ROLES,
  canCreateRole,
  canManageRole,
  creatableRolesFor,
} from "../constants/roles.js";

dotenv.config({ quiet: true });

const MANAGED_USER_POPULATE = "name district type status";

function assertOrganizationAdminHasOrganization(user) {
  if (user.role === ROLES.ORGANIZATION_ADMIN && !user.organization) {
    throw new AppError(
      "Organization administrator account is not linked to an organization",
      403,
    );
  }
}

function organizationIdOf(user) {
  return user.organization?._id || user.organization;
}

async function resolveOrganizationForManagedUser(actor, payload) {
  if (actor.role === ROLES.ORGANIZATION_ADMIN) {
    assertOrganizationAdminHasOrganization(actor);
    return Organization.findById(organizationIdOf(actor));
  }

  if (!payload.organization && !payload.organizationId) {
    return null;
  }

  const organization = await Organization.findOne({
    _id: payload.organization || payload.organizationId,
    status: "active",
  });

  if (!organization) {
    throw new AppError("Selected organization is not available", 400);
  }

  return organization;
}

function assertCanManageRole(actor, targetRole) {
  if (canManageRole(actor.role, targetRole)) {
    return;
  }

  throw new AppError("You are not allowed to manage this user role", 403);
}

function assertCanCreateRole(actor, targetRole) {
  if (canCreateRole(actor.role, targetRole)) {
    return;
  }

  throw new AppError("You are not allowed to create this user role", 403);
}

function defaultCreatableRoleForActor(actor) {
  const [firstRole] = creatableRolesFor(actor.role);
  return firstRole || ROLES.ORGANIZATION_USER;
}

function applyManagedUserScope(query, actor) {
  if (actor.role === ROLES.SUPER_ADMIN) {
    return query;
  }

  if (actor.role === ROLES.ADMIN) {
    query.role = ROLES.ORGANIZATION_ADMIN;
    return query;
  }

  if (actor.role === ROLES.ORGANIZATION_ADMIN) {
    assertOrganizationAdminHasOrganization(actor);
    query.organization = organizationIdOf(actor);
    query.role = ROLES.ORGANIZATION_USER;
  }

  return query;
}

async function getUserInManagedScope(userId, actor) {
  const query = { _id: userId };
  applyManagedUserScope(query, actor);

  const user = await User.findOne(query).populate("organization", MANAGED_USER_POPULATE);

  if (!user) {
    throw new AppError("User was not found", 404);
  }

  return user;
}

export async function listManagedUsers(filters = {}, actor) {
  const query = {};
  applyManagedUserScope(query, actor);

  if (actor.role === ROLES.SUPER_ADMIN && filters.organization) {
    query.organization = filters.organization;
  }

  if (filters.role) {
    assertCanManageRole(actor, filters.role);
    query.role = filters.role;
  }
  if (filters.isActive !== undefined) {
    query.isActive = filters.isActive === "true";
  }

  const users = await User.find(query)
    .populate("organization", MANAGED_USER_POPULATE)
    .sort({ createdAt: -1 });
  return users.map(sanitizeUser);
}

export async function getManagedUser(userId, actor) {
  const user = await getUserInManagedScope(userId, actor);
  return sanitizeUser(user);
}

export async function createManagedUser(payload, actor) {
  const {
    name,
    email,
    password,
    role = defaultCreatableRoleForActor(actor),
    institution,
  } = payload;

  assertCanCreateRole(actor, role);

  if (!name || !email) {
    throw new AppError("Name and email are required", 400);
  }
  assertStrongPassword(password);

  const existing = await User.findOne({ email });

  if (existing) {
    throw new AppError("Email is already registered", 409);
  }

  const organization = await resolveOrganizationForManagedUser(actor, payload);

  if (ORGANIZATION_SCOPED_ROLES.includes(role) && !organization) {
    throw new AppError(
      "Organization is required when creating an organization user or organization administrator",
      400,
    );
  }

  const { passwordHash, passwordSalt } = hashPassword(password);
  const temporaryPasswordExpiresHours =
    Number(process.env.TEMPORARY_PASSWORD_EXPIRES_HOURS) || 72;
  const temporaryPasswordExpiresAt = new Date(
    Date.now() + temporaryPasswordExpiresHours * 60 * 60 * 1000,
  );
  const user = await User.create({
    name,
    email,
    passwordHash,
    passwordSalt,
    role,
    organization: organization?._id,
    institution: organization?.name || institution,
    mustChangePassword: true,
    temporaryPasswordExpiresAt,
    isEmailVerified: true,
    emailVerifiedAt: new Date(),
  });

  await user.populate("organization", MANAGED_USER_POPULATE);
  return sanitizeUser(user);
}

export async function updateManagedUser(userId, payload, actor) {
  const existingUser = await getUserInManagedScope(userId, actor);
  const requestedRole = payload.role || existingUser.role;

  assertCanManageRole(actor, requestedRole);

  const allowedUpdates =
    actor.role === ROLES.ADMIN || actor.role === ROLES.SUPER_ADMIN
      ? ["name", "role", "organization", "organizationId", "institution", "isActive"]
      : ["name", "institution", "isActive"];
  const updates = {};

  allowedUpdates.forEach((field) => {
    if (payload[field] !== undefined) updates[field] = payload[field];
  });

  if (payload.organization || payload.organizationId) {
    const organization = await resolveOrganizationForManagedUser(actor, payload);
    updates.organization = organization?._id;
    updates.institution = organization?.name || updates.institution;
    delete updates.organizationId;
  }

  const user = await User.findByIdAndUpdate(existingUser._id, updates, {
    new: true,
    runValidators: true,
  }).populate("organization", MANAGED_USER_POPULATE);

  return sanitizeUser(user);
}

export async function deactivateManagedUser(userId, actor) {
  const existingUser = await getUserInManagedScope(userId, actor);
  assertCanManageRole(actor, existingUser.role);

  const user = await User.findByIdAndUpdate(
    existingUser._id,
    { isActive: false },
    { new: true },
  ).populate("organization", MANAGED_USER_POPULATE);

  return sanitizeUser(user);
}

export async function deleteManagedUser(userId, actor) {
  return deactivateManagedUser(userId, actor);
}

class UserService {
  listManagedUsers = listManagedUsers;
  getManagedUser = getManagedUser;
  createManagedUser = createManagedUser;
  updateManagedUser = updateManagedUser;
  deactivateManagedUser = deactivateManagedUser;
  deleteManagedUser = deleteManagedUser;
}

const userService = new UserService();

export default userService;
