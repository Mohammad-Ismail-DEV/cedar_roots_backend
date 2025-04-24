const express = require('express');
const router = express.Router();
const { GroupMessage } = require('../models');
const auth = require('../middleware/authMiddleware');

// Create a new group message
router.post('/', auth, async (req, res) => {
  try {
    const message = await GroupMessage.create({
      group_id: req.body.group_id,
      sender_id: req.user.id,
      content: req.body.content
    });
    res.json(message);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get all messages for a group
router.get('/group/:groupId', auth, async (req, res) => {
  try {
    const messages = await GroupMessage.findAll({
      where: { group_id: req.params.groupId },
      order: [['sent_at', 'ASC']]
    });
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get a single group message by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const message = await GroupMessage.findByPk(req.params.id);
    if (!message) return res.status(404).json({ error: 'Message not found' });
    res.json(message);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update a group message
router.put('/:id', auth, async (req, res) => {
  try {
    const [updated] = await GroupMessage.update(req.body, {
      where: { id: req.params.id, sender_id: req.user.id }
    });
    if (!updated) return res.status(404).json({ error: 'Message not found or not yours' });
    const message = await GroupMessage.findByPk(req.params.id);
    res.json(message);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Delete a group message
router.delete('/:id', auth, async (req, res) => {
  try {
    const deleted = await GroupMessage.destroy({
      where: { id: req.params.id, sender_id: req.user.id }
    });
    if (!deleted) return res.status(404).json({ error: 'Message not found or not yours' });
    res.json({ message: 'Group message deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
