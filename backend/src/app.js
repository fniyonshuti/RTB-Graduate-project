import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { AppError } from './services/errorService.js';

import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import graduateRoutes from './routes/graduateRoutes.js';
import competencyRoutes from './routes/competencyRoutes.js';
import checklistRoutes from './routes/checklistRoutes.js';
import benchmarkRoutes from './routes/benchmarkRoutes.js';
import assessmentRoutes from './routes/assessmentRoutes.js';
import recommendationRoutes from './routes/recommendationRoutes.js';
import reportRoutes from './routes/reportRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import repositoryAssessmentRoutes from './routes/repositoryAssessmentRoutes.js';
import organizationRoutes from './routes/organizationRoutes.js';
import { notFound, errorHandler } from './middleware/errorMiddleware.js';
import {
  createRateLimiter,
  requestId,
  securityHeaders,
} from './middleware/securityMiddleware.js';

dotenv.config({ quiet: true });

const app = express();

function listEnv(value = '') {
  return String(value)
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
}

const configuredCorsOrigins = listEnv(
  process.env.CORS_ORIGINS || process.env.FRONTEND_URL || '',
);
const localCorsOrigins =
  process.env.NODE_ENV === 'production'
    ? []
    : listEnv(process.env.LOCAL_CORS_ORIGINS || '');
const corsOrigins = [...new Set([...configuredCorsOrigins, ...localCorsOrigins])];
const authRateLimitMaxRequests = Number(process.env.AUTH_RATE_LIMIT_MAX_REQUESTS) || 20;

function wildcardOriginToRegExp(origin = '') {
  const escaped = origin
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*');

  return new RegExp(`^${escaped}$`);
}

function isOriginAllowed(origin = '') {
  return corsOrigins.some((allowedOrigin) => {
    if (allowedOrigin === origin) return true;
    if (!allowedOrigin.includes('*')) return false;
    return wildcardOriginToRegExp(allowedOrigin).test(origin);
  });
}

function corsErrorForOrigin(origin = '') {
  const allowed = corsOrigins.length > 0 ? corsOrigins.join(', ') : 'none configured';
  const message = [
    `Frontend origin is not allowed by backend CORS: ${origin || 'unknown origin'}.`,
    `Allowed origins: ${allowed}.`,
    'Set CORS_ORIGINS in the backend environment to include the deployed frontend URL, then redeploy the backend.',
  ].join(' ');

  return new AppError(message, 403);
}

app.disable('x-powered-by');
app.set('trust proxy', 1);

const corsOptions = {
  origin(origin, callback) {
    if (!origin || isOriginAllowed(origin)) {
      return callback(null, true);
    }

    return callback(corsErrorForOrigin(origin));
  },
  credentials: true,
};

app.use(requestId);
app.use(securityHeaders);
app.use(cors(corsOptions));
app.use(createRateLimiter());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Skills Gap Analysis API is running',
  });
});

app.use(
  '/api/auth',
  createRateLimiter({
    maxRequests: authRateLimitMaxRequests,
    scope: 'auth',
  }),
  authRoutes,
);
app.use('/api/users', userRoutes);
app.use('/api/graduates', graduateRoutes);
app.use('/api/competencies', competencyRoutes);
app.use('/api/checklists', checklistRoutes);
app.use('/api/benchmarks', benchmarkRoutes);
app.use('/api/assessments', assessmentRoutes);
app.use('/api/recommendations', recommendationRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/repository-assessments', repositoryAssessmentRoutes);
app.use('/api/organizations', organizationRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
