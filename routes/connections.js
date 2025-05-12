const express = require("express");
const router = express.Router();
const { Connection, User } = require("../models");
const auth = require("../middleware/authMiddleware");
const { Op } = require("sequelize");

// Create new connection request
router.post("/", auth, async (req, res) => {
  try {
    const connection = await Connection.create(req.body);
    res.json(connection);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get all connections
router.get("/", auth, async (req, res) => {
  try {
    const connections = await Connection.findAll({
      include: [
        { model: User, as: "Sender", attributes: ["id", "name"] },
        { model: User, as: "Receiver", attributes: ["id", "name"] },
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
        [Op.or]: [{ sender_id: userId }, { reciever_id: userId }],
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
          { sender_id: user1, reciever_id: user2 },
          { sender_id: user2, reciever_id: user1 },
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
        [Op.or]: [{ sender_id: userId }, { reciever_id: userId }],
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
    const requests = [];

    for (const conn of connections) {
      if (conn.status === "accepted") {
        accepted.push(conn);
      } else if (conn.status === "pending") {
        if (conn.Sender.id != userId) requests.push(conn);
      }
    }

    res.json({ accepted, requests });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Accept a pending connection
router.put("/respond", auth, async (req, res) => {
  try {
    const { connectionId, accept } = req.body;

    const connection = await Connection.findByPk(connectionId);
    if (!connection) {
      return res.status(404).json({ error: "Connection not found" });
    }

    if (accept) {
      connection.status = "accepted";
      await connection.save();
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

module.exports = router;
