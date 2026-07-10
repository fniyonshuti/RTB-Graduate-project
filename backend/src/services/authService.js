import User from '../models/User.js';
import { PASSWORD_HASHING } from '../constants/password.js';
import crypto from 'node:crypto';
import dotenv from 'dotenv';
import { AppError } from './errorService.js';
import { ROLES } from '../constants/roles.js';

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

function exposePasswordResetLinkInResponse() {
  return String(process.env.EXPOSE_PASSWORD_RESET_LINK_IN_RESPONSE || (process.env.NODE_ENV !== "production" ? "true" : "false")).toLowerCase() === "true";
}

function isEmailConfigured() {
  const emailProvider = process.env.EMAIL_PROVIDER || "generic";
  const emailApiKey = process.env.EMAIL_API_KEY || "";
  const emailFrom = process.env.EMAIL_FROM || "";
  const emailApiUrl = process.env.EMAIL_API_URL || "";
  if (!emailApiKey || !emailFrom) return false;
  if (emailProvider === "generic" && !emailApiUrl) return false;
  return true;
}

function buildPasswordResetMessage({ name, resetLink, expiresInMinutes }) {
  const safeName = name || "User";
  const subject = "Reset your Skills Gap Analysis Tool password";
  const text = [
    `Hello ${safeName},`,
    "",
    "We received a request to reset your Skills Gap Analysis Tool password.",
    `Open this link to create a new password: ${resetLink}`,
    "",
    `This link expires in ${expiresInMinutes} minutes.`,
    "If you did not request this reset, ignore this email.",
  ].join("\n");
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #0f172a;">
      <h2>Password reset request</h2>
      <p>Hello ${safeName},</p>
      <p>We received a request to reset your Skills Gap Analysis Tool password.</p>
      <p><a href="${resetLink}" style="display:inline-block;background:#0077B6;color:#ffffff;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:700;">Reset password</a></p>
      <p>This link expires in ${expiresInMinutes} minutes.</p>
      <p>If you did not request this reset, ignore this email.</p>
    </div>`;
  return { subject, text, html };
}

async function sendWithResend({ to, subject, text, html }) {
  const emailApiKey = process.env.EMAIL_API_KEY || "";
  const emailFrom = process.env.EMAIL_FROM || "";
  const emailFromName = process.env.EMAIL_FROM_NAME || "Skills Gap Analysis Tool";
  const resendApiUrl = process.env.EMAIL_RESEND_API_URL || "";
  if (!resendApiUrl) throw new AppError("EMAIL_RESEND_API_URL is required when EMAIL_PROVIDER=resend", 500);
  return fetch(resendApiUrl, {
    method: "POST",
    headers: { Authorization: `Bearer ${emailApiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: `${emailFromName} <${emailFrom}>`, to: [to], subject, text, html }),
  });
}

function resendErrorMessage(status, body) {
  const normalizedBody = String(body || "").toLowerCase();
  if (status === 403 && (normalizedBody.includes("verify a domain") || normalizedBody.includes("only send testing emails"))) {
    return "Resend is still using a testing sender. Verify a domain in Resend, then set EMAIL_FROM to an address on that verified domain so reset emails can be sent to any recipient.";
  }
  if (status === 401 || status === 403) return "Resend rejected the email request. Check EMAIL_API_KEY and EMAIL_FROM domain verification.";
  return `Resend failed to send the password reset email with status ${status}.`;
}

function isResendDomainVerificationError(status, body) {
  const normalizedBody = String(body || "").toLowerCase();
  return status === 403 && (normalizedBody.includes("verify a domain") || normalizedBody.includes("only send testing emails"));
}

async function sendWithBrevo({ to, subject, text, html }) {
  const emailApiKey = process.env.EMAIL_API_KEY || "";
  const emailFrom = process.env.EMAIL_FROM || "";
  const emailFromName = process.env.EMAIL_FROM_NAME || "Skills Gap Analysis Tool";
  const brevoApiUrl = process.env.EMAIL_BREVO_API_URL || "";
  if (!brevoApiUrl) throw new AppError("EMAIL_BREVO_API_URL is required when EMAIL_PROVIDER=brevo", 500);
  return fetch(brevoApiUrl, {
    method: "POST",
    headers: { "api-key": emailApiKey, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ sender: { name: emailFromName, email: emailFrom }, to: [{ email: to }], subject, textContent: text, htmlContent: html }),
  });
}

async function sendWithGenericProvider({ to, subject, text, html, resetLink }) {
  const emailApiUrl = process.env.EMAIL_API_URL || "";
  const emailApiKey = process.env.EMAIL_API_KEY || "";
  const emailFrom = process.env.EMAIL_FROM || "";
  const emailFromName = process.env.EMAIL_FROM_NAME || "Skills Gap Analysis Tool";
  return fetch(emailApiUrl, {
    method: "POST",
    headers: { Authorization: `Bearer ${emailApiKey}`, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ from: emailFrom, fromName: emailFromName, to, subject, text, html, resetLink }),
  });
}

export async function sendPasswordResetEmail({ to, name, resetLink, expiresInMinutes }) {
  if (!isEmailConfigured()) {
    if (exposePasswordResetLinkInResponse()) return { sent: false };
    throw new AppError("Email service is not configured for password reset", 500);
  }
  const message = buildPasswordResetMessage({ name, resetLink, expiresInMinutes });
  const payload = { to, resetLink, ...message };
  const emailProvider = process.env.EMAIL_PROVIDER || "generic";
  const response = emailProvider === "resend" ? await sendWithResend(payload) : emailProvider === "brevo" ? await sendWithBrevo(payload) : await sendWithGenericProvider(payload);
  if (!response.ok) {
    const body = await response.text();
    const resendDomainVerificationRequired = emailProvider === "resend" && isResendDomainVerificationError(response.status, body);
    if (resendDomainVerificationRequired && exposePasswordResetLinkInResponse()) {
      return { sent: false, reason: "resend_domain_verification_required", message: resendErrorMessage(response.status, body) };
    }
    const providerMessage = emailProvider === "resend" ? resendErrorMessage(response.status, body) : `Email API failed to send password reset message: ${response.status}`;
    throw new AppError(providerMessage, 502);
  }
  return { sent: true };
}


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
  const { name, email, password } = payload;

  if (!name || !email || !password) {
    throw new AppError(
      'Name, email, and password are required for registration',
      400,
    );
  }

  assertStrongPassword(password);

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
    role: ROLES.NORMAL_USER,
    institution: payload.institution,
  });

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
  const passwordResetTokenExpiresMinutes =
    Number(process.env.PASSWORD_RESET_TOKEN_EXPIRES_MINUTES) || 15;
  const frontendUrl = process.env.FRONTEND_URL || '';
  const exposePasswordResetLinkInResponse =
    String(
      process.env.EXPOSE_PASSWORD_RESET_LINK_IN_RESPONSE ||
        (process.env.NODE_ENV !== 'production' ? 'true' : 'false'),
    ).toLowerCase() === 'true';
  user.passwordResetTokenHash = hashResetToken(resetToken);

  if (!frontendUrl) {
    throw new AppError('FRONTEND_URL is required to generate password reset links', 500);
  }

  user.passwordResetExpiresAt = new Date(
    Date.now() + passwordResetTokenExpiresMinutes * 60 * 1000,
  );
  user.passwordResetUsedAt = undefined;
  await user.save();

  const resetLink = `${frontendUrl.replace(/\/$/, '')}/?resetToken=${resetToken}`;
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

  return {
    message:
      emailResult.sent
        ? 'If an active account exists for that email, a password reset link has been sent.'
        : 'Password reset link was created, but email delivery requires Resend domain verification.',
    ...(exposePasswordResetLinkInResponse ? { resetLink } : {}),
    expiresInMinutes: passwordResetTokenExpiresMinutes,
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

class AuthService {
  sanitizeUser = sanitizeUser;
  getActiveUserById = getActiveUserById;
  registerUser = registerUser;
  loginUser = loginUser;
  changePassword = changePassword;
  requestPasswordReset = requestPasswordReset;
  resetPassword = resetPassword;
}

const authService = new AuthService();

export default authService;
