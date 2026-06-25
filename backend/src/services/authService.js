import User from '../models/User.js';
import { AppError } from '../utils/errors.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import { signJwt } from '../utils/jwt.js';

export function sanitizeUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    institution: user.institution,
    isActive: user.isActive,
  };
}

export async function registerUser(payload) {
  const { name, email, password, role = 'graduate', institution } = payload;

  if (!name || !email || !password) {
    throw new AppError('Name, email, and password are required', 400);
  }

  if (password.length < 6) {
    throw new AppError('Password must be at least 6 characters', 400);
  }

  const existingUser = await User.findOne({ email });

  if (existingUser) {
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

  const token = signJwt({ sub: user._id.toString(), role: user.role });

  return {
    user: sanitizeUser(user),
    token,
  };
}

export async function loginUser(email, password) {
  const user = await User.findOne({ email }).select('+passwordHash +passwordSalt');

  if (!user || !user.isActive) {
    throw new AppError('Invalid email or password', 401);
  }

  const isPasswordValid = verifyPassword(
    password,
    user.passwordHash,
    user.passwordSalt
  );

  if (!isPasswordValid) {
    throw new AppError('Invalid email or password', 401);
  }

  user.lastLoginAt = new Date();
  await user.save();

  const token = signJwt({ sub: user._id.toString(), role: user.role });

  return {
    user: sanitizeUser(user),
    token,
  };
}
