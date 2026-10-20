const { Op } = require("sequelize");
const { Connection, User } = require("../models");
const AppError = require("../utils/AppError");
const { attachBlob } = require("./imageBlob");
const { notifyUser } = require("./notification");
const realtime = require("../sockets/realtime");

const between = (a, b) => ({
  [Op.or]: [
    { sender_id: a, receiver_id: b },
    { sender_id: b, receiver_id: a },
  ],
});

const involving = (userId) => ({
  [Op.or]: [{ sender_id: userId }, { receiver_id: userId }],
});

const sideInclude = (as, attributes) => ({ model: User, as, attributes });

async function request(senderId, receiverId) {
  if (senderId === receiverId) throw AppError.badRequest("You cannot connect with yourself");

  const [sender, receiver] = await Promise.all([
    User.findByPk(senderId),
    User.findByPk(receiverId),
  ]);
  if (!receiver) throw AppError.notFound("User not found");

  if (await Connection.findOne({ where: between(senderId, receiverId) })) {
    throw AppError.badRequest("A connection or request already exists");
  }

  const connection = await Connection.create({
    sender_id: senderId,
    receiver_id: receiverId,
    status: "pending",
    created_at: new Date(),
  });

  realtime.emitToUser(receiverId, "connection_request_received", { request: connection });
  await notifyUser({
    userId: receiverId,
    type: "connection_request",
    title: "New Connection Request",
    body: `${sender.name} sent you a connection request.`,
    data: { senderId: sender.id, senderName: sender.name },
  });

  return connection;
}

async function respond(userId, { connectionId, accept }) {
  const connection = await Connection.findByPk(connectionId);
  if (!connection) throw AppError.notFound("Connection not found");
  if (connection.receiver_id !== userId) {
    throw AppError.forbidden("Only the receiver can respond to a connection request");
  }

  if (!accept) {
    await connection.destroy();
    return { message: "Connection request deleted." };
  }

  connection.status = "accepted";
  connection.updated_at = new Date();
  await connection.save();

  const receiver = await User.findByPk(userId);
  realtime.emitToUser(connection.sender_id, "connection_request_accepted", {
    senderId: connection.sender_id,
    receiverId: userId,
    connectionId: connection.id,
  });
  await notifyUser({
    userId: connection.sender_id,
    type: "connection_accept",
    title: "Connection Accepted",
    body: `${receiver.name} accepted your connection request.`,
    data: { receiverId: receiver.id, receiverName: receiver.name },
  });

  return connection;
}

async function listForUser(userId) {
  return Connection.findAll({
    where: involving(userId),
    include: [sideInclude("Sender", ["id", "name"]), sideInclude("Receiver", ["id", "name"])],
  });
}

async function countAccepted(userId) {
  return Connection.count({ where: { status: "accepted", ...involving(userId) } });
}

async function status(user1, user2) {
  const connection = await Connection.findOne({ where: between(user1, user2) });
  if (!connection) return "none";
  if (connection.status === "accepted") return "accepted";
  return connection.sender_id === user1 ? "pending_sent" : "pending_received";
}

async function findBetween(user1, user2) {
  const connection = await Connection.findOne({ where: between(user1, user2) });
  if (!connection) throw AppError.notFound("No connection found");
  return connection;
}

async function groupedForUser(userId) {
  const profileAttrs = ["id", "name", "profile_pic"];
  const connections = await Connection.findAll({
    where: involving(userId),
    include: [sideInclude("Sender", profileAttrs), sideInclude("Receiver", profileAttrs)],
  });

  const result = { accepted: [], requests: [], outgoing: [] };
  await Promise.all(
    connections.map(async (conn) => {
      const data = conn.toJSON();
      await Promise.all([
        attachBlob(data.Sender, "profile_pic", "profile_pic_blob"),
        attachBlob(data.Receiver, "profile_pic", "profile_pic_blob"),
      ]);
      if (data.status === "accepted") result.accepted.push(data);
      else if (data.status === "pending") {
        (data.Sender.id !== userId ? result.requests : result.outgoing).push(data);
      }
    })
  );
  return result;
}

async function remove(userId, id) {
  const connection = await Connection.findByPk(id);
  if (!connection) throw AppError.notFound("Connection not found");
  if (connection.sender_id !== userId && connection.receiver_id !== userId) {
    throw AppError.forbidden("Not authorized to delete this connection");
  }
  await connection.destroy();
}

module.exports = {
  request,
  respond,
  listForUser,
  countAccepted,
  status,
  findBetween,
  groupedForUser,
  remove,
};
