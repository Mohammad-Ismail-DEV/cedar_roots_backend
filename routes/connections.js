const express = require('express');
const router = express.Router();
const { Connection, User } = require('../models');
const auth = require('../middleware/authMiddleware');
const { Op } = require('sequelize');

// Create new connection request
router.post('/', auth, async (req, res) => {
  try {
    const connection = await Connection.create(req.body);
    res.json(connection);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get all connections
router.get('/', auth, async (req, res) => {
  try {
    const connections = await Connection.findAll({
      include: [
        { model: User, as: 'Sender', attributes: ['id', 'name'] },
        { model: User, as: 'Receiver', attributes: ['id', 'name'] },
      ],
    });
    res.json(connections);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get accepted connection count for user (either sender or receiver)
router.get('/user/:id/accepted', auth, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const count = await Connection.count({
      where: {
        status: 'accepted',
        [Op.or]: [
          { sender_id: userId },
          { reciever_id: userId },
        ],
      },
    });
    res.json({ count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all connections (accepted and pending) for a user
router.get('/user/:id', auth, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const connections = await Connection.findAll({
      where: {
        [Op.or]: [
          { sender_id: userId },
          { reciever_id: userId },
        ],
      },
      include: [
        { model: User, as: 'Sender', attributes: ['id', 'name'] },
        { model: User, as: 'Receiver', attributes: ['id', 'name'] },
      ],
    });
    res.json(connections);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Accept a pending connection
router.put('/:id/accept', auth, async (req, res) => {
  try {
    const id = req.params.id;
    const connection = await Connection.findByPk(id);
    if (!connection) return res.status(404).json({ error: 'Connection not found' });

    connection.status = 'accepted';
    await connection.save();

    res.json(connection);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
