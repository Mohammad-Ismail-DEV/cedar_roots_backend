const express = require("express");
const router = express.Router();
const {
  Announcement,
  Event,
  EventParticipant,
  OrganizationMember,
  User,
} = require("../models");
const auth = require("../middleware/authMiddleware");
const sendUserNotification = require("../utils/sendUserNotification");

// Create announcement and notify all participants

router.post("/", auth, async (req, res) => {
  const { event_id, message } = req.body;

  if (!event_id || !message) {
    return res.status(400).json({ error: "Missing fields" });
  }

  try {
    const announcement = await Announcement.create({
      event_id,
      message,
      created_at: new Date(),
    });

    const sender = await User.findByPk(req.user.id);
    const event = await Event.findByPk(event_id);

    if (!event) {
      return res.status(404).json({ error: "Event not found" });
    }

    // ✅ Fetch members of the org
    const members = await OrganizationMember.findAll({
      where: { organization_id: event.organization_id },
    });

    // ✅ Fetch event participants
    const participants = await EventParticipant.findAll({
      where: { event_id },
    });

    // Use Set to deduplicate IDs
    const targetUserIds = new Set();

    for (const m of members) {
      if (m.user_id !== req.user.id) targetUserIds.add(m.user_id);
    }
    for (const p of participants) {
      if (p.user_id !== req.user.id) targetUserIds.add(p.user_id);
    }

    for (const userId of targetUserIds) {
      await sendUserNotification({
        userId,
        title: "New Event Announcement",
        body: `${sender.name} announced: ${message.substring(0, 100)}...`,
        type: "event_announcement",
        data: { eventId: event_id },
      });
    }

    res.json(announcement);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all announcements for an event
router.get("/:event_id", auth, async (req, res) => {
  try {
    const list = await Announcement.findAll({
      where: { event_id: req.params.event_id },
      order: [["created_at", "DESC"]],
    });

    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
