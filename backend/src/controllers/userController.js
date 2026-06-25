import User from '../models/User.js';
import { hashPassword } from '../utils/password.js';
import { AppError, asyncHandler } from '../utils/errors.js';
import { sendSuccess } from '../utils/response.js';
import { sanitizeUser } from '../services/authService.js';

export const listUsers = asyncHandler(async (req, res) => {
  const query = {};

  if (req.query.role) query.role = req.query.role;
  if (req.query.isActive !== undefined) query.isActive = req.query.isActive === 'true';

  const users = await User.find(query).sort({ createdAt: -1 });
  sendSuccess(res, 'Users loaded', users.map(sanitizeUser));
});

export const getUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    throw new AppError('User was not found', 404);
  }

  sendSuccess(res, 'User loaded', sanitizeUser(user));
});

export const createUser = asyncHandler(async (req, res) => {
  const { name, email, password, role, institution } = req.body;

  if (!password || password.length < 6) {
    throw new AppError('Password must be at least 6 characters', 400);
  }

  const existing = await User.findOne({ email });

  if (existing) {
    throw new AppError('Email is already registered', 409);
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

  sendSuccess(res, 'User created', sanitizeUser(user), 201);
});

export const updateUser = asyncHandler(async (req, res) => {
  const allowedUpdates = ['name', 'role', 'institution', 'isActive'];
  const updates = {};

  allowedUpdates.forEach((field) => {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  });

  const user = await User.findByIdAndUpdate(req.params.id, updates, {
    new: true,
    runValidators: true,
  });

  if (!user) {
    throw new AppError('User was not found', 404);
  }

  sendSuccess(res, 'User updated', sanitizeUser(user));
});

export const deactivateUser = asyncHandler(async (req, res) => {
  const user = await User.findByIdAndUpdate(
    req.params.id,
    { isActive: false },
    { new: true }
  );

  if (!user) {
    throw new AppError('User was not found', 404);
  }

  sendSuccess(res, 'User deactivated', sanitizeUser(user));
});
