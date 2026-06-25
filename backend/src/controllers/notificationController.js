import Notification from '../models/Notification.js';
import User from '../models/User.js';
import { AppError, asyncHandler } from '../utils/errors.js';
import { sendSuccess } from '../utils/response.js';

export const listNotifications = asyncHandler(async (req, res) => {
  const query = { recipient: req.user._id };

  if (req.query.isRead !== undefined) {
    query.isRead = req.query.isRead === 'true';
  }

  const notifications = await Notification.find(query).sort({ createdAt: -1 });
  sendSuccess(res, 'Notifications loaded', notifications);
});

export const markNotificationRead = asyncHandler(async (req, res) => {
  const notification = await Notification.findOneAndUpdate(
    { _id: req.params.id, recipient: req.user._id },
    { isRead: true },
    { new: true }
  );

  if (!notification) {
    throw new AppError('Notification was not found', 404);
  }

  sendSuccess(res, 'Notification marked as read', notification);
});

export const markAllNotificationsRead = asyncHandler(async (req, res) => {
  const result = await Notification.updateMany(
    { recipient: req.user._id, isRead: false },
    { isRead: true }
  );

  sendSuccess(res, 'All notifications marked as read', {
    modifiedCount: result.modifiedCount,
  });
});

export const listAllNotifications = asyncHandler(async (req, res) => {
  const query = {};

  if (req.query.type) query.type = req.query.type;
  if (req.query.isRead !== undefined) query.isRead = req.query.isRead === 'true';

  const notifications = await Notification.find(query)
    .populate('recipient', 'name email role institution')
    .sort({ createdAt: -1 });

  sendSuccess(res, 'All notifications loaded', notifications);
});

export const createNotification = asyncHandler(async (req, res) => {
  const { title, message, type = 'system', recipientId, role, link } = req.body;

  if (!title || !message) {
    throw new AppError('Title and message are required', 400);
  }

  let recipients = [];

  if (recipientId) {
    const user = await User.findById(recipientId);

    if (!user) {
      throw new AppError('Recipient user was not found', 404);
    }

    recipients = [user];
  } else if (role && role !== 'all') {
    recipients = await User.find({ role, isActive: true });
  } else {
    recipients = await User.find({ isActive: true });
  }

  if (recipients.length === 0) {
    throw new AppError('No notification recipients found', 400);
  }

  const notifications = await Notification.insertMany(
    recipients.map((recipient) => ({
      recipient: recipient._id,
      title,
      message,
      type,
      link,
    }))
  );

  sendSuccess(res, 'Notification sent successfully', notifications, 201);
});
