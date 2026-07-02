import crypto from 'crypto';
import { env } from '../config/env.js';
import { AppError } from './errors.js';

function base64UrlEncode(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function base64UrlDecode(value) {
  try {
    return JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
  } catch {
    throw new AppError('Invalid authentication token', 401);
  }
}

export function signJwt(payload, expiresInSeconds = env.jwtExpiresInSeconds) {
  const secret = env.jwtSecret;

  if (!secret) {
    throw new Error('JWT_SECRET is missing from environment variables');
  }

  const header = {
    alg: 'HS256',
    typ: 'JWT',
  };

  const now = Math.floor(Date.now() / 1000);
  const body = {
    ...payload,
    iat: now,
    exp: now + expiresInSeconds,
  };

  const unsignedToken = `${base64UrlEncode(header)}.${base64UrlEncode(body)}`;
  const signature = crypto
    .createHmac('sha256', secret)
    .update(unsignedToken)
    .digest('base64url');

  return `${unsignedToken}.${signature}`;
}

export function verifyJwt(token) {
  const secret = env.jwtSecret;

  if (!secret) {
    throw new Error('JWT_SECRET is missing from environment variables');
  }

  const parts = token.split('.');

  if (parts.length !== 3) {
    throw new AppError('Invalid authentication token', 401);
  }

  const [encodedHeader, encodedPayload, signature] = parts;
  const header = base64UrlDecode(encodedHeader);

  if (header.alg !== 'HS256' || header.typ !== 'JWT') {
    throw new AppError('Invalid authentication token', 401);
  }

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64url');

  if (
    Buffer.byteLength(signature) !== Buffer.byteLength(expectedSignature) ||
    !crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    )
  ) {
    throw new AppError('Invalid authentication token', 401);
  }

  const payload = base64UrlDecode(encodedPayload);

  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
    throw new AppError('Authentication token has expired', 401);
  }

  return payload;
}
