import User from "../models/User.js";
import { sanitizeUser } from "./authService.js";
import { AppError } from "../utils/errors.js";
import { hashPassword } from "../utils/password.js";

export async function listManagedUsers(filters = {}) {
  const query = {};

  if (filters.role) query.role = filters.role;
  if (filters.isActive !== undefined) {
    query.isActive = filters.isActive === "true";
  }

  const users = await User.find(query).sort({ createdAt: -1 });
  return users.map(sanitizeUser);
}

export async function getManagedUser(userId) {
  const user = await User.findById(userId);

  if (!user) {
    throw new AppError("User was not found", 404);
  }

  return sanitizeUser(user);
}

export async function createManagedUser(payload) {
  const { name, email, password, role, institution } = payload;

  if (!password || password.length < 6) {
    throw new AppError("Password must be at least 6 characters", 400);
  }

  const existing = await User.findOne({ email });

  if (existing) {
    throw new AppError("Email is already registered", 409);
  }

  const { passwordHash, passwordSalt } = hashPassword(password);
  const user = await User.create({
    name,
    email,
    passwordHash,
    passwordSalt,
    role,
    institution,
  });

  return sanitizeUser(user);
}

export async function updateManagedUser(userId, payload) {
  const allowedUpdates = ["name", "role", "institution", "isActive"];
  const updates = {};

  allowedUpdates.forEach((field) => {
    if (payload[field] !== undefined) updates[field] = payload[field];
  });

  const user = await User.findByIdAndUpdate(userId, updates, {
    new: true,
    runValidators: true,
  });

  if (!user) {
    throw new AppError("User was not found", 404);
  }

  return sanitizeUser(user);
}

export async function deactivateManagedUser(userId) {
  const user = await User.findByIdAndUpdate(
    userId,
    { isActive: false },
    { new: true },
  );

  if (!user) {
    throw new AppError("User was not found", 404);
  }

  return sanitizeUser(user);
}
