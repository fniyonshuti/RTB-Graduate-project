import express from 'express';
import {
  createReport,
  deleteReport,
  getReport,
  listReports,
} from '../controllers/reportController.js';
import { protect } from '../middleware/authMiddleware.js';
import { authorize } from '../middleware/roleMiddleware.js';

const router = express.Router();

router.use(protect);

router
  .route('/')
  .get(authorize('learner'), listReports)
  .post(authorize('learner'), createReport);

router
  .route('/:id')
  .get(authorize('learner'), getReport)
  .delete(authorize('learner'), deleteReport);

export default router;
