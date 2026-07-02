import express from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import { AppError } from './utils/errors.js';

import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import graduateRoutes from './routes/graduateRoutes.js';
import competencyRoutes from './routes/competencyRoutes.js';
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

const app = express();

app.disable('x-powered-by');
app.set('trust proxy', 1);

const corsOptions = {
  origin(origin, callback) {
    if (!origin || env.corsOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new AppError('Origin is not allowed by CORS', 403));
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
    maxRequests: env.authRateLimitMaxRequests,
    scope: 'auth',
  }),
  authRoutes,
);
app.use('/api/users', userRoutes);
app.use('/api/graduates', graduateRoutes);
app.use('/api/competencies', competencyRoutes);
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
