import crypto from 'node:crypto';
import dotenv from 'dotenv';
import { AppError } from '../services/errorService.js';

dotenv.config({ quiet: true });

const requestBuckets = new Map();

export function corsMiddleware(req, res, next) {
  const requestOrigin = req.headers.origin;

  if (requestOrigin) {
    res.setHeader('Access-Control-Allow-Origin', requestOrigin);
    res.setHeader('Vary', 'Origin');
  }

  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-Request-Id',
  );
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  return next();
}

function clientKey(req, scope) {
  return `${scope}:${req.ip || req.socket.remoteAddress || 'unknown'}`;
}

export function requestId(req, res, next) {
  const id = req.headers['x-request-id'] || crypto.randomUUID();
  req.id = String(id);
  res.setHeader('X-Request-Id', req.id);
  next();
}

export function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  res.setHeader('X-DNS-Prefetch-Control', 'off');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
  );

  if (process.env.NODE_ENV === 'production') {
    res.setHeader(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains',
    );
  }

  next();
}

export function createRateLimiter({
  windowMs = Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  maxRequests = Number(process.env.RATE_LIMIT_MAX_REQUESTS) || 300,
  scope = 'global',
} = {}) {
  return function rateLimiter(req, res, next) {
    const now = Date.now();
    const key = clientKey(req, scope);
    const current = requestBuckets.get(key);

    if (!current || current.resetAt <= now) {
      requestBuckets.set(key, {
        count: 1,
        resetAt: now + windowMs,
      });
      return next();
    }

    current.count += 1;

    if (current.count > maxRequests) {
      res.setHeader('Retry-After', Math.ceil((current.resetAt - now) / 1000));
      return next(
        new AppError('Too many requests. Please wait and try again.', 429),
      );
    }

    return next();
  };
}

export function cleanupRateLimitBuckets() {
  const now = Date.now();

  for (const [key, bucket] of requestBuckets.entries()) {
    if (bucket.resetAt <= now) {
      requestBuckets.delete(key);
    }
  }
}
