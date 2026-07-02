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

router.get('/', authorize('graduate', 'assessor', 'admin'), listRecommendations);
router
  .route('/:id')
  .get(authorize('graduate', 'assessor', 'admin'), getRecommendation)
  .put(authorize('assessor', 'admin'), updateRecommendation)
  .delete(authorize('admin'), deleteRecommendation);

export default router;
