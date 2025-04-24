const express = require('express');
const router = express.Router();
const { Message, User } = require('../models');
const auth = require('../middleware/authMiddleware');
const { Op } = require('sequelize');

// Create a message
router.post('/', auth, async (req, res) => {
  try {
    const message = await Message.create({
      sender_id: req.user.id,
      receiver_id: req.body.receiver_id,
      content: req.body.content,
      sent_at: new Date(),
      read_status: false,
    });
    res.json(message);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get all messages (sent or received by logged in user)
router.get('/', auth, async (req, res) => {
  try {
    const messages = await Message.findAll({
      where: {
        [Op.or]: [
          { sender_id: req.user.id },
          { receiver_id: req.user.id }
        ]
      },
      include: [
        { model: User, as: 'sender', attributes: ['id', 'name'] },
        { model: User, as: 'receiver', attributes: ['id', 'name'] }
      ],
      order: [['createdAt', 'DESC']]
    });
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get a single message by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const message = await Message.findByPk(req.params.id);
    if (!message) return res.status(404).json({ error: 'Message not found' });
    res.json(message);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Mark messages as read

router.post('/mark_as_read', auth, async (req, res) => {
  const { senderId, receiverId } = req.body;

  // Optional: ensure the user is allowed to perform this action
  if (req.user.id !== receiverId) {
    return res.status(403).json({ error: 'You can only mark messages sent to you as read.' });
  }

  try {
    const [updatedCount] = await Message.update(
      { read_status: true },
      {
        where: {
          sender_id: senderId,
          receiver_id: receiverId,
          read_status: false,
        },
      }
    );

    return res.status(200).json({
      message: `${updatedCount} message(s) marked as read.`,
      success: true,
    });
  } catch (error) {
    console.error('Error marking messages as read:', error);
    return res.status(500).json({ error: 'Failed to update messages' });
  }
});

// Delete a message (only sender can delete)
router.delete('/:id', auth, async (req, res) => {
  try {
    const deleted = await Message.destroy({ where: { id: req.params.id, sender_id: req.user.id } });
    if (!deleted) return res.status(404).json({ error: 'Message not found or not authorized' });
    res.json({ message: 'Message deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
