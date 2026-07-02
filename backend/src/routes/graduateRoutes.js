import express from 'express';
import {
  getMyProfile,
  upsertMyProfile,
  listGraduateProfiles,
  getGraduateProfile,
  deleteMyProfile,
  deleteGraduateProfile,
} from '../controllers/graduateController.js';
import { protect } from '../middleware/authMiddleware.js';
import { authorize } from '../middleware/roleMiddleware.js';

const router = express.Router();

router.use(protect);

router
  .route('/me')
  .get(authorize('graduate'), getMyProfile)
  .put(authorize('graduate'), upsertMyProfile)
  .delete(authorize('graduate'), deleteMyProfile);

router.get('/', authorize('assessor', 'admin'), listGraduateProfiles);
router
  .route('/:userId')
  .get(authorize('assessor', 'admin'), getGraduateProfile)
  .delete(authorize('admin'), deleteGraduateProfile);

export default router;
