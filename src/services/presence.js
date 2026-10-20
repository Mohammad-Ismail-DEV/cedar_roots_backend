const { UserPresence } = require("../models");
const AppError = require("../utils/AppError");
const logger = require("../utils/logger");
const realtime = require("../sockets/realtime");
const { connectedUserIds, areConnected } = require("./network");

// How many sockets each user currently has open (a phone and a browser count as two).
const sockets = new Map();

async function broadcast(userId, online, lastSeenAt) {
  try {
    const ids = await connectedUserIds(userId);
    ids.forEach((id) =>
      realtime.emitToUser(id, "presence_changed", {
        userId,
        online,
        last_seen_at: lastSeenAt,
      })
    );
  } catch (err) {
    logger.warn({ err: err.message }, "Could not broadcast presence");
  }
}

async function connected(userId) {
  const count = (sockets.get(userId) || 0) + 1;
  sockets.set(userId, count);
  if (count === 1) await broadcast(userId, true, null);
}

async function disconnected(userId) {
  const count = (sockets.get(userId) || 1) - 1;
  if (count > 0) {
    sockets.set(userId, count);
    return;
  }

  sockets.delete(userId);
  const lastSeen = new Date();
  try {
    await UserPresence.upsert({ user_id: userId, last_seen_at: lastSeen });
  } catch (err) {
    logger.warn({ err: err.message }, "Could not store last seen");
  }
  await broadcast(userId, false, lastSeen);
}

const isOnline = (userId) => sockets.has(userId);

// Whether `userId` is online and when they were last seen. Only you and your connections can ask.
async function statusFor(viewerId, userId) {
  if (!(await areConnected(viewerId, userId))) {
    throw AppError.forbidden("You can only see the status of your connections");
  }
  const online = isOnline(userId);
  const row = online ? null : await UserPresence.findByPk(userId);
  return { user_id: userId, online, last_seen_at: row ? row.last_seen_at : null };
}

// Test helper.
const reset = () => sockets.clear();

module.exports = { connected, disconnected, isOnline, statusFor, reset };
