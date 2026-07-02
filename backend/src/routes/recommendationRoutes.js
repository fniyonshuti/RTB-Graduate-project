import express from 'express';
import {
  deleteRecommendation,
  getRecommendation,
  listRecommendations,
  updateRecommendation,
} from '../controllers/recommendationController.js';
import { protect } from '../middleware/authMiddleware.js';
import { authorize } from '../middleware/roleMiddleware.js';

const router = express.Router();

router.use(protect);

router.get('/', authorize('learner', 'org_admin', 'admin'), listRecommendations);
router
  .route('/:id')
  .get(authorize('learner', 'org_admin', 'admin'), getRecommendation)
  .put(authorize('admin'), updateRecommendation)
  .delete(authorize('admin'), deleteRecommendation);

export default router;
