const express = require("express");
const router = express.Router();
const { Connection, User } = require("../models");
const auth = require("../middleware/authMiddleware");
const { Op } = require("sequelize");
const sendUserNotification = require("../utils/sendUserNotification");

// Create new connection request

router.post("/", auth, async (req, res) => {
  try {
    const connection = await Connection.create({
      sender_id: req.user.id,
      receiver_id: req.body.receiver_id,
      status: "pending",
      created_at: new Date(),
    });

    const sender = await User.findByPk(req.user.id);
    const receiver = await User.findByPk(req.body.receiver_id);

    if (receiver) {
      await sendUserNotification({
        userId: receiver.id,
        title: "New Connection Request",
        body: `${sender.name} sent you a connection request.`,
        type: "connection_request",
        data: { senderId: sender.id, senderName: sender.name },
      });
    }

    res.json(connection);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Accept or deny a connection
router.put("/respond", auth, async (req, res) => {
  try {
    const { connectionId, accept } = req.body;

    const connection = await Connection.findByPk(connectionId);
    if (!connection)
      return res.status(404).json({ error: "Connection not found" });

    if (accept) {
      connection.status = "accepted";
      await connection.save();

      const sender = await User.findByPk(connection.sender_id);
      const receiver = await User.findByPk(connection.receiver_id);

      if (sender) {
        await sendUserNotification({
          userId: sender.id,
          title: "Connection Accepted",
          body: `${receiver.name} accepted your connection request.`,
          type: "connection_accept",
          data: { receiverId: receiver.id, receiverName: receiver.name },
        });
      }

      return res.json(connection);
    } else {
      await connection.destroy();
      return res.json({ message: "Connection request deleted." });
    }
  } catch (err) {
    console.error("Error responding to connection:", err);
    return res.status(400).json({ error: err.message });
  }
});

// Get all connections
router.get("/", auth, async (req, res) => {
  try {
    const connections = await Connection.findAll({
      include: [
        {
          model: User,
          attributes: ["id", "name", "profile_pic"],
          as: "Sender",
          attributes: ["id", "name"],
        },
        {
          model: User,
          attributes: ["id", "name", "profile_pic"],
          as: "Receiver",
          attributes: ["id", "name"],
        },
      ],
    });
    res.json(connections);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get accepted connection count for user (either sender or receiver)
router.get("/user/:id/accepted", auth, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const count = await Connection.count({
      where: {
        status: "accepted",
        [Op.or]: [{ sender_id: userId }, { receiver_id: userId }],
      },
    });
    res.json({ count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/status/:user1/:user2", async (req, res) => {
  const user1 = parseInt(req.params.user1);
  const user2 = parseInt(req.params.user2);

  console.log(user1, user2);

  if (!user1 || !user2) return res.status(400).json({ status: "none" });

  try {
    const connection = await Connection.findOne({
      where: {
        [Op.or]: [
          { sender_id: user1, receiver_id: user2 },
          { sender_id: user2, receiver_id: user1 },
        ],
      },
    });

    if (!connection) return res.json({ status: "none" });

    if (connection.status === "accepted") {
      return res.json({ status: "accepted" });
    } else if (connection.sender_id === user1) {
      return res.json({ status: "pending_sent" });
    } else {
      return res.json({ status: "pending_received" });
    }
  } catch (err) {
    console.error("❌ Error fetching connection status:", err);
    res.status(500).json({ status: "none" });
  }
});

// Get all connections (accepted and pending) for a user
router.get("/user/:id", auth, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);

    const connections = await Connection.findAll({
      where: {
        [Op.or]: [{ sender_id: userId }, { receiver_id: userId }],
      },
      include: [
        {
          model: User,
          as: "Sender",
          attributes: ["id", "name", "profile_pic"],
        },
        {
          model: User,
          as: "Receiver",
          attributes: ["id", "name", "profile_pic"],
        },
      ],
    });

    const accepted = [];
    const requests = []; // incoming
    const outgoing = [];

    for (const conn of connections) {
      if (conn.status === "accepted") {
        accepted.push(conn);
      } else if (conn.status === "pending") {
        if (conn.Sender.id != userId) {
          // someone sent the current user a request
          requests.push(conn);
        } else {
          // the current user sent the request
          outgoing.push(conn);
        }
      }
    }

    res.json({ accepted, requests, outgoing });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/between/:user1/:user2", async (req, res) => {
  const user1 = parseInt(req.params.user1);
  const user2 = parseInt(req.params.user2);

  if (!user1 || !user2) {
    return res.status(400).json({ error: "Invalid user IDs" });
  }

  try {
    const connection = await Connection.findOne({
      where: {
        [Op.or]: [
          { sender_id: user1, receiver_id: user2 },
          { sender_id: user2, receiver_id: user1 },
        ],
      },
    });

    if (!connection)
      return res.status(404).json({ error: "No connection found" });

    res.json(connection); // returns full object including `id`
  } catch (err) {
    console.error("❌ Error fetching connection:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Delete a connection by ID (accepted or pending)
router.delete("/:id", auth, async (req, res) => {
  try {
    const connectionId = parseInt(req.params.id);
    const connection = await Connection.findByPk(connectionId);

    if (!connection) {
      return res.status(404).json({ error: "Connection not found" });
    }

    // Optional: Check if the current user is involved in the connection
    if (
      connection.sender_id !== req.user.id &&
      connection.receiver_id !== req.user.id
    ) {
      return res
        .status(403)
        .json({ error: "Not authorized to delete this connection" });
    }

    await connection.destroy();
    res.json({ message: "Connection deleted successfully." });
  } catch (err) {
    console.error("❌ Error deleting connection:", err);
    res.status(500).json({ error: "Failed to delete connection" });
  }
});

module.exports = router;
