import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config();

const rootDir = process.cwd();

function numberEnv(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function booleanEnv(name, fallback = false) {
  const value = String(process.env[name] || '').toLowerCase();
  if (['true', '1', 'yes'].includes(value)) return true;
  if (['false', '0', 'no'].includes(value)) return false;
  return fallback;
}

function listEnv(name, fallback = []) {
  const value = process.env[name];
  if (!value) return fallback;
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function emailDomain(email = '') {
  const [, domain = ''] = String(email).split('@');
  return domain.toLowerCase();
}

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  port: numberEnv('PORT', 5000),
  host: process.env.HOST || '0.0.0.0',
  mongoUri: process.env.MONGO_URI || '',
  dbConnectTimeoutMs: numberEnv('DB_CONNECT_TIMEOUT_MS', 8000),
  jwtSecret: process.env.JWT_SECRET || '',
  jwtExpiresInSeconds: numberEnv('JWT_EXPIRES_IN_SECONDS', 60 * 60 * 24),
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  corsOrigins: listEnv('CORS_ORIGINS', [
    process.env.FRONTEND_URL || 'http://localhost:5173',
  ]),
  passwordResetTokenExpiresMinutes: numberEnv('PASSWORD_RESET_TOKEN_EXPIRES_MINUTES', 15),
  temporaryPasswordExpiresHours: numberEnv('TEMPORARY_PASSWORD_EXPIRES_HOURS', 72),
  emailProvider: process.env.EMAIL_PROVIDER || 'generic',
  emailApiUrl: process.env.EMAIL_API_URL || '',
  emailApiKey: process.env.EMAIL_API_KEY || '',
  emailFrom: process.env.EMAIL_FROM || '',
  emailFromName: process.env.EMAIL_FROM_NAME || 'Skills Gap Analysis Tool',
  rateLimitWindowMs: numberEnv('RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000),
  rateLimitMaxRequests: numberEnv('RATE_LIMIT_MAX_REQUESTS', 300),
  authRateLimitMaxRequests: numberEnv('AUTH_RATE_LIMIT_MAX_REQUESTS', 20),
  exposePasswordResetLinkInResponse: booleanEnv(
    'EXPOSE_PASSWORD_RESET_LINK_IN_RESPONSE',
    process.env.NODE_ENV !== 'production',
  ),
  githubApiUrl: process.env.GITHUB_API_URL || process.env.GITHUB_API_BASE_URL || 'https://api.github.com',
  githubToken: process.env.GITHUB_TOKEN || '',
  repositoryAnalysisTimeoutMs: numberEnv('REPOSITORY_ANALYSIS_TIMEOUT_MS', 120000),
  tempRepositoryDir: path.resolve(
    rootDir,
    process.env.TEMP_REPOSITORY_DIR || 'tmp/repositories',
  ),
  enableUnsafeLocalRepositoryExecution: booleanEnv(
    'ENABLE_UNSAFE_LOCAL_REPOSITORY_EXECUTION',
    false,
  ),
  repositoryDockerImage: process.env.REPOSITORY_DOCKER_IMAGE || 'node:20-alpine',
};

export function validateRuntimeConfig() {
  const errors = [];
  const warnings = [];

  if (!env.mongoUri) {
    errors.push('MONGO_URI is required');
  }

  if (!env.jwtSecret) {
    errors.push('JWT_SECRET is required');
  }

  if (env.jwtSecret && env.jwtSecret.length < 32) {
    errors.push('JWT_SECRET must be at least 32 characters');
  }

  if (env.isProduction) {
    if (env.frontendUrl.includes('localhost')) {
      errors.push('FRONTEND_URL must not use localhost in production');
    }

    if (env.corsOrigins.some((origin) => origin.includes('localhost'))) {
      errors.push('CORS_ORIGINS must not include localhost in production');
    }

    if (!process.env.GEMINI_API_KEY) {
      warnings.push('GEMINI_API_KEY is missing; recommendation generation will fail');
    }

    if (!env.githubToken) {
      warnings.push('GITHUB_TOKEN is missing; GitHub API rate limits may block repository review');
    }

    if (env.exposePasswordResetLinkInResponse) {
      errors.push('EXPOSE_PASSWORD_RESET_LINK_IN_RESPONSE must be false in production');
    }

    if (!env.emailApiKey || !env.emailFrom) {
      errors.push('EMAIL_API_KEY and EMAIL_FROM are required in production');
    }

    if (env.emailProvider === 'generic' && !env.emailApiUrl) {
      errors.push('EMAIL_API_URL is required when EMAIL_PROVIDER=generic');
    }

    if (
      env.emailProvider === 'resend' &&
      ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'resend.dev'].includes(
        emailDomain(env.emailFrom),
      )
    ) {
      errors.push(
        'EMAIL_FROM must use your verified Resend domain in production, not a personal or testing email domain',
      );
    }
  } else if (
    env.emailProvider === 'resend' &&
    ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'resend.dev'].includes(
      emailDomain(env.emailFrom),
    )
  ) {
    warnings.push(
      'Resend can only send to any recipient after you verify a domain and set EMAIL_FROM to that domain',
    );
  }

  return { errors, warnings };
}
