import express from 'express';
import { listRecommendations } from '../controllers/recommendationController.js';
import { protect } from '../middleware/authMiddleware.js';
import { authorize } from '../middleware/roleMiddleware.js';

const router = express.Router();

router.use(protect);

router.get('/', authorize('graduate', 'assessor', 'admin'), listRecommendations);

export default router;
