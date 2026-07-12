import express from 'express';
import {
  createRepositoryAssessment,
  deleteRepositoryAssessment,
  getRepositoryAssessment,
  getRepositoryAssessments,
  updateRepositoryAssessment,
} from '../controllers/githubController.js';
import { protect } from '../middleware/authMiddleware.js';
import { authorize } from '../middleware/roleMiddleware.js';

const router = express.Router();

router.use(protect);

router
  .route('/')
  .get(getRepositoryAssessments)
  .post(authorize('learner', 'admin'), createRepositoryAssessment);

router
  .route('/:id')
  .get(getRepositoryAssessment)
  .put(authorize('admin'), updateRepositoryAssessment)
  .delete(deleteRepositoryAssessment);

export default router;
