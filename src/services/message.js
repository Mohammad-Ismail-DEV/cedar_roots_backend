const { Op } = require("sequelize");
const { Message, User, Post } = require("../models");
const AppError = require("../utils/AppError");
const realtime = require("../sockets/realtime");
const push = require("./push");
const logger = require("../utils/logger");

const STATUS = { SENT: "sent", DELIVERED: "delivered", SEEN: "seen" };

const conversationWith = (a, b) => ({
  [Op.or]: [
    { sender_id: a, receiver_id: b },
    { sender_id: b, receiver_id: a },
  ],
});

// `onSaved` runs after the message is stored but before the receiver is told, so a sender
// always learns the real id before any delivered/seen receipt can come back.
async function send({ senderId, receiverId, content, type = "text", onSaved }) {
  const [sender, receiver] = await Promise.all([
    User.findByPk(senderId),
    User.findByPk(receiverId),
  ]);
  if (!sender || !receiver) throw AppError.notFound("User not found");

  // A shared post is sent as its id; make sure it exists so the card never points at nothing.
  if (type === "post" && !(await Post.findByPk(Number(content)))) {
    throw AppError.notFound("Post not found");
  }

  const message = await Message.create({
    sender_id: senderId,
    receiver_id: receiverId,
    content,
    type,
    sent_at: new Date(),
    read_status: STATUS.SENT,
  });

  onSaved?.(message);
  realtime.emitToUser(receiverId, "receive_message", message);

  push
    .sendToUser(receiverId, {
      title: sender.name || "Cedar Roots",
      body: type === "text" ? content : type === "post" ? "Shared a post with you" : `Sent you a ${type}`,
      data: {
        senderId,
        senderName: sender.name || "",
        content,
        type,
        notificationType: "chat",
      },
    })
    .catch((err) => logger.warn({ err: err.message }, "Chat push failed"));

  return message;
}

async function history({ userId, otherUserId, page, limit }) {
  const messages = await Message.findAll({
    where: conversationWith(userId, otherUserId),
    order: [
      ["sent_at", "DESC"],
      ["id", "DESC"],
    ],
    offset: (page - 1) * limit,
    limit,
  });
  return messages.reverse();
}

// One entry per conversation partner with the latest message and unread count.
async function conversations(userId) {
  const messages = await Message.findAll({
    where: { [Op.or]: [{ sender_id: userId }, { receiver_id: userId }] },
    include: [
      { model: User, as: "sender", attributes: ["id", "name", "profile_pic"] },
      { model: User, as: "receiver", attributes: ["id", "name", "profile_pic"] },
    ],
    order: [
      ["sent_at", "DESC"],
      ["id", "DESC"],
    ],
  });

  const byPartner = new Map();
  for (const msg of messages) {
    const isSent = msg.sender_id === userId;
    const partner = isSent ? msg.receiver : msg.sender;
    if (!byPartner.has(partner.id)) {
      byPartner.set(partner.id, {
        user_id: partner.id,
        name: partner.name,
        profile_pic: partner.profile_pic,
        last_message: msg,
        unread_count: 0,
      });
    }
    if (!isSent && msg.read_status !== STATUS.SEEN) byPartner.get(partner.id).unread_count++;
  }
  return [...byPartner.values()];
}

async function markDelivered({ messageId, receiverId }) {
  const message = await Message.findOne({
    where: { id: messageId, receiver_id: receiverId, read_status: STATUS.SENT },
  });
  if (!message) return;

  message.read_status = STATUS.DELIVERED;
  await message.save();
  realtime.emitToUser(message.sender_id, "message_delivered", { messageId });
}

// Marks everything `authorId` sent to `readerId` as seen and tells the author.
async function markSeen({ readerId, authorId }) {
  const where = {
    sender_id: authorId,
    receiver_id: readerId,
    read_status: { [Op.ne]: STATUS.SEEN },
  };
  const unseen = await Message.findAll({ where, attributes: ["id"] });
  if (!unseen.length) return [];

  const messageIds = unseen.map((m) => m.id);
  await Message.update({ read_status: STATUS.SEEN }, { where: { id: messageIds } });

  realtime.emitToUser(authorId, "messages_seen_by_receiver", {
    senderId: authorId,
    receiverId: readerId,
    messageIds,
  });
  return messageIds;
}

async function listForUser(userId) {
  return Message.findAll({
    where: { [Op.or]: [{ sender_id: userId }, { receiver_id: userId }] },
    include: [
      { model: User, as: "sender", attributes: ["id", "name"] },
      { model: User, as: "receiver", attributes: ["id", "name"] },
    ],
    order: [
      ["sent_at", "DESC"],
      ["id", "DESC"],
    ],
    limit: 200,
  });
}

async function getById(userId, id) {
  const message = await Message.findByPk(id);
  if (!message) throw AppError.notFound("Message not found");
  if (message.sender_id !== userId && message.receiver_id !== userId) {
    throw AppError.forbidden("Not authorized");
  }
  return message;
}

async function remove(userId, id) {
  const deleted = await Message.destroy({ where: { id, sender_id: userId } });
  if (!deleted) throw AppError.notFound("Message not found or not authorized");
}

module.exports = {
  STATUS,
  send,
  history,
  conversations,
  markDelivered,
  markSeen,
  listForUser,
  getById,
  remove,
};
