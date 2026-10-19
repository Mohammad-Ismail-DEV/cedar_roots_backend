const { Notification } = require("../models");
const realtime = require("../sockets/realtime");
const push = require("./push");
const logger = require("../utils/logger");
const AppError = require("../utils/AppError");

const stringifyData = (data) =>
  Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)]));

// Stores the notification, emits it over the socket and sends an FCM push.
// Never throws: a failed notification must not fail the action that caused it.
async function notifyUser({ userId, type, title, body, data = {} }) {
  try {
    const payload = stringifyData({ ...data, notificationType: type });

    await Notification.create({
      user_id: userId,
      type,
      message: body,
      is_read: false,
      data: payload,
      created_at: new Date(),
    });

    realtime.emitToUser(userId, "receive_notification", {
      ...payload,
      type,
      title,
      message: body,
    });

    await push.sendToUser(userId, { title, body, data: payload });
  } catch (err) {
    logger.error({ err: err.message, userId, type }, "Failed to notify user");
  }
}

async function notifyUsers(userIds, buildNotification) {
  await Promise.all(
    [...userIds].map((userId) => notifyUser({ userId, ...buildNotification(userId) }))
  );
}

async function listForUser(userId) {
  return Notification.findAll({
    where: { user_id: userId },
    order: [["created_at", "DESC"]],
  });
}

async function markRead(userId, id) {
  const notification = await Notification.findByPk(id);
  if (!notification || notification.user_id !== userId) {
    throw AppError.forbidden("Not authorized or notification not found");
  }
  notification.is_read = true;
  await notification.save();
  return notification;
}

async function remove(userId, id) {
  const deleted = await Notification.destroy({ where: { id, user_id: userId } });
  if (!deleted) throw AppError.notFound("Notification not found");
}

module.exports = { notifyUser, notifyUsers, listForUser, markRead, remove };
