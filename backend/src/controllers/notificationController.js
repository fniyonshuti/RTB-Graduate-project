import notificationService from '../services/notificationService.js';
import { asyncHandler } from '../services/errorService.js';
import { sendSuccess } from '../services/responseService.js';

class NotificationController {
  listNotifications = asyncHandler(async (req, res) => {
    const notifications = await notificationService.listNotificationsForUser(req.user._id, req.query);
    sendSuccess(res, 'Notifications loaded', notifications);
  });

  markNotificationRead = asyncHandler(async (req, res) => {
    const notification = await notificationService.markNotificationReadForUser(
      req.params.id,
      req.user._id,
    );
    sendSuccess(res, 'Notification marked as read', notification);
  });

  markAllNotificationsRead = asyncHandler(async (req, res) => {
    const result = await notificationService.markAllNotificationsReadForUser(req.user._id);
    sendSuccess(res, 'All notifications marked as read', result);
  });

  listAllNotifications = asyncHandler(async (req, res) => {
    const notifications = await notificationService.listManagedNotifications(req.query);
    sendSuccess(res, 'All notifications loaded', notifications);
  });

  createNotification = asyncHandler(async (req, res) => {
    const notifications = await notificationService.createManagedNotification(req.body);
    sendSuccess(res, 'Notification sent successfully', notifications, 201);
  });

  getNotification = asyncHandler(async (req, res) => {
    const notification = await notificationService.getNotificationForUser(req.params.id, req.user);
    sendSuccess(res, 'Notification loaded', notification);
  });

  updateNotification = asyncHandler(async (req, res) => {
    const notification = await notificationService.updateManagedNotification(req.params.id, req.body);
    sendSuccess(res, 'Notification updated', notification);
  });

  deleteNotification = asyncHandler(async (req, res) => {
    const notification = await notificationService.deleteNotificationForUser(req.params.id, req.user);
    sendSuccess(res, 'Notification deleted', notification);
  });
}

const notificationController = new NotificationController();

export const listNotifications = notificationController.listNotifications;
export const markNotificationRead = notificationController.markNotificationRead;
export const markAllNotificationsRead = notificationController.markAllNotificationsRead;
export const listAllNotifications = notificationController.listAllNotifications;
export const createNotification = notificationController.createNotification;
export const getNotification = notificationController.getNotification;
export const updateNotification = notificationController.updateNotification;
export const deleteNotification = notificationController.deleteNotification;
export default notificationController;