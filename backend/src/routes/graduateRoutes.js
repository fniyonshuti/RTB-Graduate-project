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
  .get(authorize('learner'), getMyProfile)
  .put(authorize('learner'), upsertMyProfile)
  .delete(authorize('learner'), deleteMyProfile);

router.get('/', authorize('org_admin', 'admin'), listGraduateProfiles);
router
  .route('/:userId')
  .get(authorize('org_admin', 'admin'), getGraduateProfile)
  .delete(authorize('admin'), deleteGraduateProfile);

export default router;
