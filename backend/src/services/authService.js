import User from '../models/User.js';
import { PASSWORD_HASHING, checkPasswordPolicy, passwordPolicyMessage } from '../constants/password.js';
import crypto from 'node:crypto';
import dotenv from 'dotenv';
import { OAuth2Client } from 'google-auth-library';
import { AppError } from './errorService.js';
import { ROLES } from '../constants/roles.js';
import {
  buildEmailVerificationUrl,
  buildPasswordResetUrl,
  exposePasswordResetLinkInResponse,
  sendEmailVerificationEmail,
  sendPasswordResetEmail,
} from './emailService.js';

dotenv.config({ quiet: true });

// Password hashing, JWT handling, and password reset email belong to auth.

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const passwordHash = crypto
    .pbkdf2Sync(password, salt, PASSWORD_HASHING.iterations, PASSWORD_HASHING.keyLength, PASSWORD_HASHING.digest)
    .toString("hex");
  return { passwordHash, passwordSalt: salt };
}

export function verifyPassword(password, passwordHash, passwordSalt) {
  const attemptedHash = crypto
    .pbkdf2Sync(password, passwordSalt, PASSWORD_HASHING.iterations, PASSWORD_HASHING.keyLength, PASSWORD_HASHING.digest)
    .toString("hex");
  return crypto.timingSafeEqual(Buffer.from(attemptedHash, "hex"), Buffer.from(passwordHash, "hex"));
}

function base64UrlEncode(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function base64UrlDecode(value) {
  try {
    return JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
  } catch {
    throw new AppError("Invalid authentication token", 401);
  }
}

export function signJwt(payload, expiresInSeconds = Number(process.env.JWT_EXPIRES_IN_SECONDS) || 60 * 60 * 24) {
  const secret = String(process.env.JWT_SECRET || "").trim();
  if (!secret) throw new Error("JWT_SECRET is missing from environment variables");
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const body = { ...payload, iat: now, exp: now + expiresInSeconds };
  const unsignedToken = `${base64UrlEncode(header)}.${base64UrlEncode(body)}`;
  const signature = crypto.createHmac("sha256", secret).update(unsignedToken).digest("base64url");
  return `${unsignedToken}.${signature}`;
}

export function verifyJwt(token) {
  const secret = String(process.env.JWT_SECRET || "").trim();
  if (!secret) throw new Error("JWT_SECRET is missing from environment variables");
  const parts = token.split(".");
  if (parts.length !== 3) throw new AppError("Invalid authentication token", 401);
  const [encodedHeader, encodedPayload, signature] = parts;
  const header = base64UrlDecode(encodedHeader);
  if (header.alg !== "HS256" || header.typ !== "JWT") throw new AppError("Invalid authentication token", 401);
  const expectedSignature = crypto.createHmac("sha256", secret).update(`${encodedHeader}.${encodedPayload}`).digest("base64url");
  if (Buffer.byteLength(signature) !== Buffer.byteLength(expectedSignature) || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
    throw new AppError("Invalid authentication token", 401);
  }
  const payload = base64UrlDecode(encodedPayload);
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) throw new AppError("Authentication token has expired", 401);
  return payload;
}

export function hashToken(token) {
  return crypto.createHash('sha256').update(String(token || '')).digest('hex');
}

export function assertStrongPassword(password, label = 'Password') {
  const result = checkPasswordPolicy(password);
  if (!result.isValid) {
    throw new AppError(passwordPolicyMessage(label), 400, { requirements: result.requirements });
  }
}

export function createRawToken() {
  return crypto.randomBytes(32).toString('hex');
}

export function verificationTokenExpiresAt(now = new Date()) {
  const expiresInMinutes = Number(process.env.EMAIL_VERIFICATION_TOKEN_EXPIRES_MINUTES) || 30;
  return new Date(now.getTime() + expiresInMinutes * 60 * 1000);
}

export function assertVerificationResendAllowed(user, now = new Date()) {
  const cooldownSeconds = Number(process.env.EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS) || 60;
  if (!user?.emailVerificationLastSentAt) return;

  const elapsedSeconds = (now.getTime() - new Date(user.emailVerificationLastSentAt).getTime()) / 1000;
  if (elapsedSeconds < cooldownSeconds) {
    throw new AppError(`Please wait ${Math.ceil(cooldownSeconds - elapsedSeconds)} seconds before requesting another verification email.`, 429);
  }
}

export function validateStoredEmailVerificationToken(user, rawToken, now = new Date()) {
  if (!user || user.isEmailVerified) throw new AppError('Email verification link is invalid or expired', 400);
  if (user.emailVerificationUsedAt) throw new AppError('Email verification link has already been used', 400);
  if (!user.emailVerificationTokenHash || !user.emailVerificationExpiresAt) throw new AppError('Email verification link is invalid or expired', 400);
  if (new Date(user.emailVerificationExpiresAt) <= now) throw new AppError('Email verification link is invalid or expired', 400);
  if (user.emailVerificationTokenHash !== hashToken(rawToken)) throw new AppError('Email verification link is invalid or expired', 400);
  return true;
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
    authProvider: user.authProvider,
    isEmailVerified: user.isEmailVerified !== false,
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
  const { name, email, password } = payload;
  const normalizedEmail = String(email || '').trim().toLowerCase();

  if (!name || !normalizedEmail || !password) {
    throw new AppError(
      'Name, email, and password are required for registration',
      400,
    );
  }

  assertStrongPassword(password);

  const existingUser = await User.findOne({ email: normalizedEmail });

  if (existingUser) {
    throw new AppError('Registration could not be completed with the provided details', 409);
  }

  const { passwordHash, passwordSalt } = hashPassword(password);
  const verificationToken = createRawToken();
  const verificationExpiresInMinutes = Number(process.env.EMAIL_VERIFICATION_TOKEN_EXPIRES_MINUTES) || 30;

  const user = await User.create({
    name,
    email: normalizedEmail,
    passwordHash,
    passwordSalt,
    role: ROLES.NORMAL_USER,
    institution: payload.institution,
    isEmailVerified: false,
    emailVerificationTokenHash: hashToken(verificationToken),
    emailVerificationExpiresAt: verificationTokenExpiresAt(),
    emailVerificationLastSentAt: new Date(),
  });

  const verificationLink = buildEmailVerificationUrl(verificationToken);

  try {
    await sendEmailVerificationEmail({
      to: user.email,
      name: user.name,
      verificationLink,
      expiresInMinutes: verificationExpiresInMinutes,
    });
  } catch (error) {
    await User.findByIdAndDelete(user._id);
    throw error;
  }

  return {
    user: sanitizeUser(user),
    verificationRequired: true,
    emailSent: true,
    message: 'Account created. Please verify your email address before signing in.',
  };
}

export async function loginUser(email, password) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const user = await User.findOne({ email: normalizedEmail })
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
  if (user.authProvider !== 'google' && user.isEmailVerified === false) {
    throw new AppError('Please verify your email address before signing in. Check your inbox for the verification link.', 403);
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

async function verifyGoogleCredential(credential) {
  const googleClientId = String(process.env.GOOGLE_CLIENT_ID || '').trim();

  if (!googleClientId) {
    throw new AppError(
      'Google sign-in is not configured on the backend. Add GOOGLE_CLIENT_ID in Render and redeploy the backend.',
      503,
    );
  }

  const normalizedCredential = String(credential || '').trim();
  if (!normalizedCredential) {
    throw new AppError('Google credential is required', 400);
  }

  let profile;
  try {
    const googleClient = new OAuth2Client(googleClientId);
    const ticket = await googleClient.verifyIdToken({
      idToken: normalizedCredential,
      audience: googleClientId,
    });
    profile = ticket.getPayload();
  } catch (error) {
    console.error('Google token verification failed:', error);
    throw new AppError(
      'Google sign-in failed because the Google credential could not be verified. Confirm VITE_GOOGLE_CLIENT_ID and GOOGLE_CLIENT_ID use the same OAuth Client ID.',
      401,
    );
  }

  if (!profile?.email || !profile?.sub) {
    throw new AppError('Google did not return the required account information', 401);
  }

  if (profile.aud !== googleClientId) {
    throw new AppError(
      'Google sign-in failed because the frontend and backend Google Client IDs do not match.',
      401,
    );
  }

  if (profile.email_verified !== true && String(profile.email_verified).toLowerCase() !== 'true') {
    throw new AppError('Google account email is not verified', 401);
  }

  return {
    googleId: profile.sub,
    email: String(profile.email).toLowerCase(),
    name: profile.name || String(profile.email).split('@')[0],
  };
}

function normalizeGoogleAuthError(error) {
  if (error instanceof AppError) return error;

  if (error?.code === 11000) {
    return new AppError(
      'This Google account is already linked to another user. Sign in with the original email account or contact the system administrator.',
      409,
    );
  }

  if (error?.name === 'ValidationError') {
    return new AppError(
      Object.values(error.errors || {})
        .map((fieldError) => fieldError.message)
        .join(', ') || 'Google account data is invalid',
      400,
    );
  }

  if (String(error?.message || '').includes('JWT_SECRET')) {
    return new AppError(
      'Google sign-in could not create a login session because JWT_SECRET is missing or invalid on the backend.',
      503,
    );
  }

  if (
    error?.name === 'MongoNetworkError' ||
    error?.name === 'MongoServerSelectionError' ||
    String(error?.message || '').toLowerCase().includes('mongo')
  ) {
    return new AppError(
      'Google sign-in could not access the database. Confirm MongoDB Atlas connection settings and try again.',
      503,
    );
  }

  console.error('Google sign-in completion failed:', error);
  return new AppError(
    'Google sign-in could not be completed on the backend. Check Render logs for the request ID and confirm OAuth environment variables are configured.',
    502,
  );
}

export async function loginWithGoogle(credential) {
  try {
    const googleProfile = await verifyGoogleCredential(credential);
    let user = await User.findOne({ email: googleProfile.email }).populate('organization', 'name district type status');

    if (user && !user.isActive) {
      throw new AppError('User account is not available', 401);
    }

    if (!user) {
      const randomPassword = crypto.randomBytes(32).toString('hex');
      const { passwordHash, passwordSalt } = hashPassword(randomPassword);

      user = await User.create({
        name: googleProfile.name,
        email: googleProfile.email,
        passwordHash,
        passwordSalt,
        role: ROLES.NORMAL_USER,
        googleId: googleProfile.googleId,
        authProvider: 'google',
        isEmailVerified: true,
        emailVerifiedAt: new Date(),
        lastLoginAt: new Date(),
      });
    } else {
      if (user.googleId && user.googleId !== googleProfile.googleId) {
        throw new AppError(
          'This email is already linked to a different Google account. Use the original Google account or sign in with email and password.',
          409,
        );
      }

      user.googleId = googleProfile.googleId;
      user.authProvider = 'google';
      user.isEmailVerified = true;
      user.emailVerifiedAt = user.emailVerifiedAt || new Date();
      user.lastLoginAt = new Date();
      await user.save();
    }

    const token = signJwt({ sub: user._id.toString(), role: user.role });

    return {
      user: sanitizeUser(user),
      token,
    };
  } catch (error) {
    throw normalizeGoogleAuthError(error);
  }
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
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const user = await User.findOne({ email: normalizedEmail });

  if (!user || !user.isActive) {
    return {
      message:
        'Password reset link sent. Check your email.',
    };
  }

  const resetToken = crypto.randomBytes(32).toString('hex');
  const passwordResetTokenExpiresMinutes =
    Number(process.env.PASSWORD_RESET_TOKEN_EXPIRES_MINUTES) || 15;
  const frontendUrl = process.env.FRONTEND_URL || '';
  const shouldExposeResetLink = exposePasswordResetLinkInResponse();
  user.passwordResetTokenHash = hashToken(resetToken);

  if (!frontendUrl) {
    throw new AppError('FRONTEND_URL is required to generate password reset links', 500);
  }

  user.passwordResetExpiresAt = new Date(
    Date.now() + passwordResetTokenExpiresMinutes * 60 * 1000,
  );
  user.passwordResetUsedAt = undefined;
  await user.save();

  const resetLink = buildPasswordResetUrl(resetToken);
  let emailResult;

  try {
    emailResult = await sendPasswordResetEmail({
      to: user.email,
      name: user.name,
      resetLink,
      expiresInMinutes: passwordResetTokenExpiresMinutes,
    });
  } catch (error) {
    user.passwordResetTokenHash = undefined;
    user.passwordResetExpiresAt = undefined;
    user.passwordResetUsedAt = undefined;
    await user.save();
    throw error;
  }

  if (emailResult.sent) {
    console.info('Password reset email accepted by provider', {
      provider: emailResult.provider || 'email',
      messageId: emailResult.messageId,
      recipient: user.email,
      userId: String(user._id),
    });
  }

  return {
    message:
      emailResult.sent
        ? 'Password reset link sent. Check your email.'
        : 'Password reset link was created, but email delivery is not configured.',
    ...(shouldExposeResetLink ? { resetLink } : {}),
    expiresInMinutes: passwordResetTokenExpiresMinutes,
    emailSent: emailResult.sent,
    ...(emailResult.provider ? { emailProvider: emailResult.provider } : {}),
    ...(emailResult.messageId ? { emailMessageId: emailResult.messageId } : {}),
    ...(emailResult.reason ? { emailStatus: emailResult.reason } : {}),

  };
}
export async function verifyEmailAddress(rawToken) {
  const normalizedToken = String(rawToken || '').trim();
  if (!normalizedToken) throw new AppError('Email verification token is required', 400);

  const user = await User.findOne({
    emailVerificationTokenHash: hashToken(normalizedToken),
    isActive: true,
  }).select('+emailVerificationTokenHash +emailVerificationExpiresAt +emailVerificationUsedAt');

  validateStoredEmailVerificationToken(user, normalizedToken);

  user.isEmailVerified = true;
  user.emailVerifiedAt = new Date();
  user.emailVerificationUsedAt = new Date();
  user.emailVerificationTokenHash = undefined;
  user.emailVerificationExpiresAt = undefined;
  await user.save();

  return {
    user: sanitizeUser(user),
    message: 'Email verified successfully. You can now sign in.',
  };
}

export async function resendVerificationEmail(email, options = {}) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const safeResponse = {
    message: 'If an account exists and needs verification, a verification email has been sent.',
  };

  const user = await User.findOne({ email: normalizedEmail, isActive: true })
    .select('+emailVerificationTokenHash +emailVerificationExpiresAt +emailVerificationUsedAt +emailVerificationLastSentAt');

  if (!user || user.isEmailVerified) return safeResponse;

  if (!options.ignoreCooldown) {
    assertVerificationResendAllowed(user);
  }

  const verificationToken = createRawToken();
  const verificationExpiresInMinutes = Number(process.env.EMAIL_VERIFICATION_TOKEN_EXPIRES_MINUTES) || 30;
  user.emailVerificationTokenHash = hashToken(verificationToken);
  user.emailVerificationExpiresAt = verificationTokenExpiresAt();
  user.emailVerificationUsedAt = undefined;
  user.emailVerificationLastSentAt = new Date();
  await user.save();

  const verificationLink = buildEmailVerificationUrl(verificationToken);
  const emailResult = await sendEmailVerificationEmail({
    to: user.email,
    name: user.name,
    verificationLink,
    expiresInMinutes: verificationExpiresInMinutes,
  });

  return {
    ...safeResponse,
    emailSent: true,
    ...(emailResult?.messageId ? { emailMessageId: emailResult.messageId } : {}),
  };
}
export async function resetPassword(resetToken, newPassword) {
  const normalizedToken = String(resetToken || '').trim();

  if (!normalizedToken) {
    throw new AppError('Password reset token is required', 400);
  }

  assertStrongPassword(newPassword);

  const user = await User.findOne({
    passwordResetTokenHash: hashToken(normalizedToken),
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

const authService = {
  sanitizeUser,
  getActiveUserById,
  registerUser,
  loginUser,
  loginWithGoogle,
  changePassword,
  requestPasswordReset,
  verifyEmailAddress,
  resendVerificationEmail,
  resetPassword,
};

export default authService;



