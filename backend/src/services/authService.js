import User from '../models/User.js';
import Organization from '../models/Organization.js';
import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { AppError } from '../utils/errors.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import { signJwt } from '../utils/jwt.js';
import { sendPasswordResetEmail } from './emailService.js';

function hashResetToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function assertStrongPassword(password) {
  if (!password || password.length < 6) {
    throw new AppError('Password must be at least 6 characters', 400);
  }
}

export function sanitizeUser(user) {
  const organization =
    user.organization && typeof user.organization === 'object'
      ? {
          _id: user.organization._id,
          name: user.organization.name,
          district: user.organization.district,
          type: user.organization.type,
          status: user.organization.status,
        }
      : user.organization;

  return {
    id: user._id,
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    organization,
    institution: user.institution,
    isActive: user.isActive,
    mustChangePassword: user.mustChangePassword,
  };
}

export async function getActiveUserById(userId) {
  const user = await User.findById(userId).populate('organization', 'name district type status');

  if (!user || !user.isActive) {
    throw new AppError('User account is not available', 401);
  }

  return user;
}

export async function registerUser(payload) {
  const { name, email, password, organizationId } = payload;

  if (!name || !email || !password || !organizationId) {
    throw new AppError(
      'Name, email, password, and organization are required for graduate registration',
      400,
    );
  }

  assertStrongPassword(password);

  const existingUser = await User.findOne({ email });

  if (existingUser) {
    throw new AppError('Email is already registered', 409);
  }

  const { passwordHash, passwordSalt } = hashPassword(password);
  const organization = await Organization.findOne({
    _id: organizationId,
    status: 'active',
  });

  if (!organization) {
    throw new AppError(
      'Selected organization is not available. Please choose an active organization.',
      400,
    );
  }

  const user = await User.create({
    name,
    email,
    passwordHash,
    passwordSalt,
    role: 'graduate',
    organization: organization._id,
    institution: organization.name,
  });

  await user.populate('organization', 'name district type status');

  const token = signJwt({ sub: user._id.toString(), role: user.role });

  return {
    user: sanitizeUser(user),
    token,
  };
}

export async function loginUser(email, password) {
  const user = await User.findOne({ email })
    .select('+passwordHash +passwordSalt')
    .populate('organization', 'name district type status');

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

  if (
    user.mustChangePassword &&
    user.temporaryPasswordExpiresAt &&
    user.temporaryPasswordExpiresAt < new Date()
  ) {
    throw new AppError(
      'Temporary password has expired. Please request a new password reset.',
      401,
    );
  }

  user.lastLoginAt = new Date();
  await user.save();

  const token = signJwt({ sub: user._id.toString(), role: user.role });

  return {
    user: sanitizeUser(user),
    token,
  };
}

export async function changePassword(userId, currentPassword, newPassword) {
  const user = await User.findById(userId).select('+passwordHash +passwordSalt');

  if (!user || !user.isActive) {
    throw new AppError('User account is not available', 401);
  }

  if (!verifyPassword(currentPassword, user.passwordHash, user.passwordSalt)) {
    throw new AppError('Current password is not correct', 400);
  }

  assertStrongPassword(newPassword);

  const { passwordHash, passwordSalt } = hashPassword(newPassword);
  user.passwordHash = passwordHash;
  user.passwordSalt = passwordSalt;
  user.mustChangePassword = false;
  user.temporaryPasswordExpiresAt = undefined;
  user.passwordChangedAt = new Date();
  await user.save();

  return sanitizeUser(user);
}

export async function requestPasswordReset(email) {
  const user = await User.findOne({ email });

  if (!user || !user.isActive) {
    return {
      message:
        'If an active account exists for that email, a password reset link has been prepared.',
    };
  }

  const resetToken = crypto.randomBytes(32).toString('hex');
  user.passwordResetTokenHash = hashResetToken(resetToken);
  user.passwordResetExpiresAt = new Date(
    Date.now() + env.passwordResetTokenExpiresMinutes * 60 * 1000,
  );
  user.passwordResetUsedAt = undefined;
  await user.save();

  const resetLink = `${env.frontendUrl.replace(/\/$/, '')}/?resetToken=${resetToken}`;
  let emailResult;

  try {
    emailResult = await sendPasswordResetEmail({
      to: user.email,
      name: user.name,
      resetLink,
      expiresInMinutes: env.passwordResetTokenExpiresMinutes,
    });
  } catch (error) {
    user.passwordResetTokenHash = undefined;
    user.passwordResetExpiresAt = undefined;
    user.passwordResetUsedAt = undefined;
    await user.save();
    throw error;
  }

  return {
    message:
      emailResult.sent
        ? 'If an active account exists for that email, a password reset link has been sent.'
        : 'Password reset link was created, but email delivery requires Resend domain verification.',
    ...(env.exposePasswordResetLinkInResponse ? { resetLink } : {}),
    expiresInMinutes: env.passwordResetTokenExpiresMinutes,
    emailSent: emailResult.sent,
    ...(emailResult.reason ? { emailStatus: emailResult.reason } : {}),
    ...(emailResult.message ? { emailMessage: emailResult.message } : {}),
  };
}

export async function resetPassword(resetToken, newPassword) {
  const normalizedToken = String(resetToken || '').trim();

  if (!normalizedToken) {
    throw new AppError('Password reset token is required', 400);
  }

  assertStrongPassword(newPassword);

  const user = await User.findOne({
    passwordResetTokenHash: hashResetToken(normalizedToken),
    passwordResetExpiresAt: { $gt: new Date() },
    $or: [
      { passwordResetUsedAt: { $exists: false } },
      { passwordResetUsedAt: null },
    ],
    isActive: true,
  }).select(
    '+passwordHash +passwordSalt +passwordResetTokenHash +passwordResetExpiresAt +passwordResetUsedAt',
  );

  if (!user) {
    throw new AppError('Password reset link is invalid or expired', 400);
  }

  const { passwordHash, passwordSalt } = hashPassword(newPassword);
  user.passwordHash = passwordHash;
  user.passwordSalt = passwordSalt;
  user.mustChangePassword = false;
  user.temporaryPasswordExpiresAt = undefined;
  user.passwordResetUsedAt = new Date();
  user.passwordResetTokenHash = undefined;
  user.passwordResetExpiresAt = undefined;
  user.passwordChangedAt = new Date();
  await user.save();

  return sanitizeUser(user);
}
