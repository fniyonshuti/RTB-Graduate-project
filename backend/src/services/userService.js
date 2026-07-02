import User from "../models/User.js";
import Organization from "../models/Organization.js";
import { sanitizeUser } from "./authService.js";
import { AppError } from "../utils/errors.js";
import { hashPassword } from "../utils/password.js";
import { env } from "../config/env.js";
import crypto from "node:crypto";

const MANAGED_USER_POPULATE = "name district type status";

function generateTemporaryPassword() {
  return `Temp-${crypto.randomBytes(5).toString("base64url")}1`;
}

function assertOrganizationAdminHasOrganization(user) {
  if (user.role === "org_admin" && !user.organization) {
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
  if (actor.role === "org_admin") {
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
  if (actor.role === "admin") return;

  if (
    actor.role === "org_admin" &&
    ["graduate", "assessor", "org_admin"].includes(targetRole)
  ) {
    return;
  }

  throw new AppError("You are not allowed to manage this user role", 403);
}

async function getUserInManagedScope(userId, actor) {
  const query = { _id: userId };

  if (actor.role === "org_admin") {
    assertOrganizationAdminHasOrganization(actor);
    query.organization = organizationIdOf(actor);
  }

  const user = await User.findOne(query).populate("organization", MANAGED_USER_POPULATE);

  if (!user) {
    throw new AppError("User was not found", 404);
  }

  return user;
}

export async function listManagedUsers(filters = {}, actor) {
  const query = {};

  if (actor.role === "org_admin") {
    assertOrganizationAdminHasOrganization(actor);
    query.organization = organizationIdOf(actor);
  } else if (filters.organization) {
    query.organization = filters.organization;
  }

  if (filters.role) query.role = filters.role;
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
  const { name, email, password, role = "graduate", institution } = payload;

  assertCanManageRole(actor, role);

  if (!name || !email) {
    throw new AppError("Name and email are required", 400);
  }

  if (!password || password.length < 6) {
    throw new AppError("Password must be at least 6 characters", 400);
  }

  const existing = await User.findOne({ email });

  if (existing) {
    throw new AppError("Email is already registered", 409);
  }

  const organization = await resolveOrganizationForManagedUser(actor, payload);

  if (["org_admin", "assessor", "graduate"].includes(role) && !organization) {
    throw new AppError(
      "Organization is required when creating a graduate, assessor, or organization administrator",
      400,
    );
  }

  const { passwordHash, passwordSalt } = hashPassword(password);
  const temporaryPasswordExpiresAt = new Date(
    Date.now() + env.temporaryPasswordExpiresHours * 60 * 60 * 1000,
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
  });

  await user.populate("organization", MANAGED_USER_POPULATE);
  return sanitizeUser(user);
}

export async function updateManagedUser(userId, payload, actor) {
  const existingUser = await getUserInManagedScope(userId, actor);
  const requestedRole = payload.role || existingUser.role;

  assertCanManageRole(actor, requestedRole);

  const allowedUpdates =
    actor.role === "admin"
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

export async function resetManagedUserTemporaryPassword(userId, actor) {
  const existingUser = await getUserInManagedScope(userId, actor);
  assertCanManageRole(actor, existingUser.role);

  const temporaryPassword = generateTemporaryPassword();
  const { passwordHash, passwordSalt } = hashPassword(temporaryPassword);
  const temporaryPasswordExpiresAt = new Date(
    Date.now() + env.temporaryPasswordExpiresHours * 60 * 60 * 1000,
  );

  const user = await User.findByIdAndUpdate(
    existingUser._id,
    {
      $set: {
        passwordHash,
        passwordSalt,
        mustChangePassword: true,
        temporaryPasswordExpiresAt,
      },
      $unset: {
        passwordChangedAt: "",
        passwordResetTokenHash: "",
        passwordResetExpiresAt: "",
        passwordResetUsedAt: "",
      },
    },
    { new: true, runValidators: true },
  ).populate("organization", MANAGED_USER_POPULATE);

  return {
    user: sanitizeUser(user),
    temporaryPassword,
    expiresAt: temporaryPasswordExpiresAt,
  };
}
