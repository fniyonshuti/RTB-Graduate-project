import Notification from "../models/Notification.js";
import User from "../models/User.js";
import { AppError } from "../utils/errors.js";

export function listNotificationsForUser(userId, filters = {}) {
  const query = { recipient: userId };

  if (filters.isRead !== undefined) {
    query.isRead = filters.isRead === "true";
  }

  return Notification.find(query).sort({ createdAt: -1 });
}

export async function markNotificationReadForUser(notificationId, userId) {
  const notification = await Notification.findOneAndUpdate(
    { _id: notificationId, recipient: userId },
    { isRead: true },
    { new: true },
  );

  if (!notification) {
    throw new AppError("Notification was not found", 404);
  }

  return notification;
}

export async function markAllNotificationsReadForUser(userId) {
  const result = await Notification.updateMany(
    { recipient: userId, isRead: false },
    { isRead: true },
  );

  return {
    modifiedCount: result.modifiedCount,
  };
}

export function listManagedNotifications(filters = {}) {
  const query = {};

  if (filters.type) query.type = filters.type;
  if (filters.isRead !== undefined) query.isRead = filters.isRead === "true";

  return Notification.find(query)
    .populate("recipient", "name email role institution")
    .sort({ createdAt: -1 });
}

export async function createManagedNotification(payload) {
  const { title, message, type = "system", recipientId, role, link } = payload;

  if (!title || !message) {
    throw new AppError("Title and message are required", 400);
  }

  let recipients = [];

  if (recipientId) {
    const user = await User.findById(recipientId);

    if (!user) {
      throw new AppError("Recipient user was not found", 404);
    }

    recipients = [user];
  } else if (role && role !== "all") {
    recipients = await User.find({ role, isActive: true });
  } else {
    recipients = await User.find({ isActive: true });
  }

  if (recipients.length === 0) {
    throw new AppError("No notification recipients found", 400);
  }

  return Notification.insertMany(
    recipients.map((recipient) => ({
      recipient: recipient._id,
      title,
      message,
      type,
      link,
    })),
  );
}
