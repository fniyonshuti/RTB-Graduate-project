import {
  createManagedNotification,
  deleteNotificationForUser,
  getNotificationForUser,
  listManagedNotifications,
  listNotificationsForUser,
  markAllNotificationsReadForUser,
  markNotificationReadForUser,
  updateManagedNotification,
} from '../services/notificationService.js';
import { asyncHandler } from '../utils/errors.js';
import { sendSuccess } from '../utils/response.js';

export const listNotifications = asyncHandler(async (req, res) => {
  const notifications = await listNotificationsForUser(req.user._id, req.query);
  sendSuccess(res, 'Notifications loaded', notifications);
});

export const markNotificationRead = asyncHandler(async (req, res) => {
  const notification = await markNotificationReadForUser(
    req.params.id,
    req.user._id,
  );
  sendSuccess(res, 'Notification marked as read', notification);
});

export const markAllNotificationsRead = asyncHandler(async (req, res) => {
  const result = await markAllNotificationsReadForUser(req.user._id);
  sendSuccess(res, 'All notifications marked as read', result);
});

export const listAllNotifications = asyncHandler(async (req, res) => {
  const notifications = await listManagedNotifications(req.query);
  sendSuccess(res, 'All notifications loaded', notifications);
});

export const createNotification = asyncHandler(async (req, res) => {
  const notifications = await createManagedNotification(req.body);
  sendSuccess(res, 'Notification sent successfully', notifications, 201);
});

export const getNotification = asyncHandler(async (req, res) => {
  const notification = await getNotificationForUser(req.params.id, req.user);
  sendSuccess(res, 'Notification loaded', notification);
});

export const updateNotification = asyncHandler(async (req, res) => {
  const notification = await updateManagedNotification(req.params.id, req.body);
  sendSuccess(res, 'Notification updated', notification);
});

export const deleteNotification = asyncHandler(async (req, res) => {
  const notification = await deleteNotificationForUser(req.params.id, req.user);
  sendSuccess(res, 'Notification deleted', notification);
});
