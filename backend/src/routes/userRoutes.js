import express from 'express';
import {
  listUsers,
  getUser,
  createUser,
  updateUser,
  deactivateUser,
  deleteUser,
} from '../controllers/userController.js';
import { protect } from '../middleware/authMiddleware.js';
import { authorize } from '../middleware/roleMiddleware.js';
import { requireFields } from '../middleware/validateMiddleware.js';

const router = express.Router();

router.use(protect, authorize('admin', 'org_admin'));

router
  .route('/')
  .get(listUsers)
  .post(requireFields('name', 'email', 'password', 'role'), createUser);

router.route('/:id').get(getUser).put(updateUser).delete(deleteUser);
router.patch('/:id/deactivate', deactivateUser);

export default router;
