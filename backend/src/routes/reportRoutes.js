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
  .get(authorize('learner', 'org_admin', 'admin'), listReports)
  .post(authorize('learner', 'org_admin', 'admin'), createReport);

router
  .route('/:id')
  .get(authorize('learner', 'org_admin', 'admin'), getReport)
  .put(authorize('org_admin', 'admin'), updateReport)
  .delete(authorize('learner', 'org_admin', 'admin'), deleteReport);

export default router;
