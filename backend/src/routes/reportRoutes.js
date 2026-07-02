import express from 'express';
import {
  createReport,
  deleteReport,
  getReport,
  listReports,
  updateReport,
} from '../controllers/reportController.js';
import { protect } from '../middleware/authMiddleware.js';
import { authorize } from '../middleware/roleMiddleware.js';

const router = express.Router();

router.use(protect);

router
  .route('/')
  .get(authorize('graduate', 'assessor', 'org_admin', 'admin'), listReports)
  .post(authorize('graduate', 'assessor', 'org_admin', 'admin'), createReport);

router
  .route('/:id')
  .get(authorize('graduate', 'assessor', 'org_admin', 'admin'), getReport)
  .put(authorize('assessor', 'org_admin', 'admin'), updateReport)
  .delete(authorize('graduate', 'assessor', 'org_admin', 'admin'), deleteReport);

export default router;
