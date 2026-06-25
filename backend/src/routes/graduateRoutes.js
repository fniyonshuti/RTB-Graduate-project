import express from 'express';
import {
  getMyProfile,
  upsertMyProfile,
  listGraduateProfiles,
  getGraduateProfile,
} from '../controllers/graduateController.js';
import { protect } from '../middleware/authMiddleware.js';
import { authorize } from '../middleware/roleMiddleware.js';

const router = express.Router();

router.use(protect);

router
  .route('/me')
  .get(authorize('graduate'), getMyProfile)
  .put(authorize('graduate'), upsertMyProfile);

router.get('/', authorize('assessor', 'admin'), listGraduateProfiles);
router.get('/:userId', authorize('assessor', 'admin'), getGraduateProfile);

export default router;
