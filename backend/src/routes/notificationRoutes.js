import express from 'express';
import {
  createNotification,
  deleteNotification,
  getNotification,
  listAllNotifications,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  updateNotification,
} from '../controllers/notificationController.js';
import { protect } from '../middleware/authMiddleware.js';
import { authorize } from '../middleware/roleMiddleware.js';

const router = express.Router();

router.use(protect);

router
  .route('/')
  .get(listNotifications)
  .post(authorize('admin'), createNotification);

router.get('/manage', authorize('admin'), listAllNotifications);
router.patch('/read-all', markAllNotificationsRead);
router.patch('/:id/read', markNotificationRead);
router
  .route('/:id')
  .get(getNotification)
  .put(authorize('admin'), updateNotification)
  .delete(deleteNotification);

export default router;
