const express = require('express');
const router = express.Router();
const { Notification } = require('../models');
const auth = require('../middleware/authMiddleware');

// Get all notifications for logged in user
router.get("/notifications", auth, async (req, res) => {
  try {
    const notifications = await Notification.findAll({
      where: { user_id: req.user.id },
      order: [["created_at", "DESC"]],
    });
    res.json(notifications);
  } catch (err) {
    console.error("❌ Error fetching notifications:", err);
    res.status(500).json({ error: "Failed to fetch notifications" });
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
