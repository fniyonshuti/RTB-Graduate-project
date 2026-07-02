import express from 'express';
import {
  createRepositoryAssessment,
  deleteRepositoryAssessment,
  getRepositoryAssessment,
  getRepositoryAssessments,
  updateRepositoryAssessment,
} from '../controllers/repositoryAssessmentController.js';
import { protect } from '../middleware/authMiddleware.js';
import { authorize } from '../middleware/roleMiddleware.js';

const router = express.Router();

router.use(protect);

router
  .route('/')
  .get(getRepositoryAssessments)
  .post(authorize('graduate', 'assessor', 'admin'), createRepositoryAssessment);

router
  .route('/:id')
  .get(getRepositoryAssessment)
  .put(authorize('assessor', 'admin'), updateRepositoryAssessment)
  .delete(deleteRepositoryAssessment);

export default router;
