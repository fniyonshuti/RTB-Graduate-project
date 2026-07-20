import express from 'express';
import dotenv from 'dotenv';
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
import legalPolicyRoutes from './routes/legalPolicyRoutes.js';
import { notFound, errorHandler } from './middleware/errorMiddleware.js';
import {
  createRateLimiter,
  requestId,
  securityHeaders,
  corsMiddleware,
} from './middleware/securityMiddleware.js';

dotenv.config({ quiet: true });

const app = express();

const authRateLimitMaxRequests = Number(process.env.AUTH_RATE_LIMIT_MAX_REQUESTS) || 20;

app.disable('x-powered-by');
app.set('trust proxy', 1);


app.use(requestId);
app.use(corsMiddleware);
app.use(securityHeaders);
app.use(createRateLimiter());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

function sendApiStatus(res) {
  res.status(200).json({
    success: true,
    message: 'Skills Gap Analysis API is running',
  });
}

app.get('/api', (req, res) => {
  sendApiStatus(res);
});

app.get('/api/health', (req, res) => {
  sendApiStatus(res);
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
app.use('/api/legal-policies', legalPolicyRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
