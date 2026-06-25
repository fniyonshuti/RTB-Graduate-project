import express from 'express';
import { createReport, listReports } from '../controllers/reportController.js';
import { protect } from '../middleware/authMiddleware.js';
import { authorize } from '../middleware/roleMiddleware.js';

const router = express.Router();

router.use(protect);

router
  .route('/')
  .get(authorize('graduate', 'assessor', 'admin'), listReports)
  .post(authorize('graduate', 'assessor', 'admin'), createReport);

export default router;
