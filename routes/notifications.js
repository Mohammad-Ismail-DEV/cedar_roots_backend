const express = require('express');
const router = express.Router();
const { Notification } = require('../models');
const auth = require('../middleware/authMiddleware');

// Create a notification
router.post('/', auth, async (req, res) => {
  try {
    const notification = await Notification.create({
      user_id: req.user.id,
      type: req.body.type,
      message: req.body.message,
      is_read: false,
      created_at: new Date(),
    });
    res.json(notification);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get all notifications for logged in user
router.get('/', auth, async (req, res) => {
  try {
    const notifications = await Notification.findAll({ where: { user_id: req.user.id } });
    res.json(notifications);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Mark a notification as read
router.put('/:id/read', auth, async (req, res) => {
  try {
    const notification = await Notification.findByPk(req.params.id);
    if (!notification || notification.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized or notification not found' });
    }
    notification.is_read = true;
    await notification.save();
    res.json(notification);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a notification
router.delete('/:id', auth, async (req, res) => {
  try {
    const deleted = await Notification.destroy({ where: { id: req.params.id, user_id: req.user.id } });
    if (!deleted) return res.status(404).json({ error: 'Notification not found' });
    res.json({ message: 'Notification deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
