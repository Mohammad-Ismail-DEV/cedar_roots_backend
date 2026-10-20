const { Op } = require("sequelize");
const { Connection } = require("../models");

// Ids of everyone with an accepted connection to `userId`.
async function connectedUserIds(userId) {
  const accepted = await Connection.findAll({
    where: {
      status: "accepted",
      [Op.or]: [{ sender_id: userId }, { receiver_id: userId }],
    },
  });
  return accepted.map((c) => (c.sender_id === userId ? c.receiver_id : c.sender_id));
}

async function areConnected(a, b) {
  if (a === b) return true;
  const found = await Connection.findOne({
    where: {
      status: "accepted",
      [Op.or]: [
        { sender_id: a, receiver_id: b },
        { sender_id: b, receiver_id: a },
      ],
    },
  });
  return Boolean(found);
}

module.exports = { connectedUserIds, areConnected };
