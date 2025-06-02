const express = require("express");
const router = express.Router();
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const {
  Event,
  EventParticipant,
  User,
  Organization,
  OrganizationMember,
  OrganizationFollower,
  Sequelize,
} = require("../models");

const auth = require("../middleware/authMiddleware");
const sendUserNotification = require("../utils/sendUserNotification");

async function isOrgAdmin(userId, organizationId) {
  const member = await OrganizationMember.findOne({
    where: { user_id: userId, organization_id: organizationId },
  });
  return member && (member.role === "owner" || member.role === "admin");
}

// Create Event
router.post("/", auth, async (req, res) => {
  const {
    title,
    description,
    location,
    date_time,
    organization_id,
    collaborators = [],
  } = req.body;

  try {
    const authorized = await isOrgAdmin(req.user.id, organization_id);
    if (!authorized)
      return res.status(403).json({
        error: "Not authorized to create events for this organization.",
      });

    const event = await Event.create({
      title,
      description,
      location,
      date_time,
      organization_id,
      created_at: new Date(),
      updated_at: new Date(),
    });

    const creator = await User.findByPk(req.user.id);

    // Notify collaborators
    for (const userId of collaborators) {
      await EventParticipant.create({
        event_id: event.id,
        user_id: userId,
        role: "collaborator",
        status: "invited",
      });

      const user = await User.findByPk(userId);
      if (user) {
        await sendUserNotification({
          userId: user.id,
          title: "Event Invitation",
          body: `${creator.name} invited you to collaborate on ${title}.`,
          type: "event_invite",
          data: { eventId: event.id, organizerName: creator.name },
        });
      }
    }

    // Notify org followers and members (excluding creator)
    const [followers, members] = await Promise.all([
      OrganizationFollower.findAll({ where: { organization_id } }),
      OrganizationMember.findAll({ where: { organization_id } }),
    ]);

    const notifyUserIds = new Set();

    for (const f of followers) {
      if (f.user_id !== req.user.id) notifyUserIds.add(f.user_id);
    }
    for (const m of members) {
      if (m.user_id !== req.user.id) notifyUserIds.add(m.user_id);
    }

    for (const userId of notifyUserIds) {
      await sendUserNotification({
        userId,
        title: "New Event Created",
        body: `${creator.name} created a new event: ${title}`,
        type: "new_event",
        data: { eventId: event.id, organizerName: creator.name },
      });
    }

    res.json(event);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Join Event
router.post("/:id/join", auth, async (req, res) => {
  try {
    const participation = await EventParticipant.create({
      event_id: req.params.id,
      user_id: req.user.id,
      status: "joined",
    });

    const event = await Event.findByPk(req.params.id);
    const user = await User.findByPk(req.user.id);

    if (event && user) {
      const participants = await EventParticipant.findAll({
        where: { event_id: event.id, role: "collaborator" },
      });

      for (const participant of participants) {
        if (participant.user_id !== req.user.id) {
          await sendUserNotification({
            userId: participant.user_id,
            title: "New Participant",
            body: `${user.name} joined the event: ${event.title}`,
            type: "event_join",
            data: { eventId: event.id, joinerName: user.name },
          });
        }
      }
    }

    res.json(participation);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get All Events (optionally filtered by user connections)
router.get("/", async (req, res) => {
  const userId = parseInt(req.query.user_id);

  try {
    let orgIds = [];

    if (!isNaN(userId)) {
      const follows = await OrganizationFollower.findAll({
        where: { user_id: userId },
      });
      orgIds = follows.map((f) => f.organization_id);
    }

    const events = await Event.findAll({
      include: [{ model: Organization, attributes: ["id", "name", "logo"] }],
      order: [
        [
          Sequelize.literal(
            orgIds.length > 0
              ? `CASE WHEN \`Event\`.\`organization_id\` IN (${orgIds.join(
                  ","
                )}) THEN 0 ELSE 1 END`
              : `1`
          ),
          "ASC",
        ],
        ["created_at", "DESC"],
      ],
    });

    for (const event of events) {
      const org = event.Organization;
      if (org && org.logo) {
        const filename = path.basename(org.logo);
        const filePath = path.join(__dirname, "../uploads", filename);
        try {
          const resizedBuffer = await sharp(filePath)
            .resize(64, 64) // Resize to a small avatar size
            .jpeg({ quality: 60 })
            .toBuffer();
          org.dataValues.logo_blob = `data:image/jpeg;base64,${resizedBuffer.toString(
            "base64"
          )}`;
        } catch (err) {
          console.error("Error generating logo_blob:", err);
          org.dataValues.logo_blob = null;
        }
      } else if (org) {
        org.dataValues.logo_blob = null;
      }
    }

    res.json(events);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get Event by ID
router.get("/:id", async (req, res) => {
  try {
    const event = await Event.findByPk(req.params.id, {
      include: [{ model: Organization, attributes: ["id", "name", "logo"] }],
    });

    if (!event) return res.status(404).json({ error: "Event not found" });
    const org = event.Organization;
    if (org && org.logo) {
      const filename = path.basename(org.logo);
      const filePath = path.join(__dirname, "../uploads", filename);
      try {
        const resizedBuffer = await sharp(filePath)
          .resize(64, 64)
          .jpeg({ quality: 60 })
          .toBuffer();
        org.dataValues.logo_blob = `data:image/jpeg;base64,${resizedBuffer.toString(
          "base64"
        )}`;
      } catch (err) {
        console.error("Error generating logo_blob:", err);
        org.dataValues.logo_blob = null;
      }
    } else if (org) {
      org.dataValues.logo_blob = null;
    }
    res.json(event);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update Event
router.put("/:id", auth, async (req, res) => {
  try {
    const event = await Event.findByPk(req.params.id);
    if (!event) return res.status(404).json({ error: "Event not found" });

    const authorized = await isOrgAdmin(req.user.id, event.organization_id);
    if (!authorized)
      return res
        .status(403)
        .json({ error: "Not authorized to update this event." });

    await event.update(req.body);
    res.json(event);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Delete Event
router.delete("/:id", auth, async (req, res) => {
  try {
    const event = await Event.findByPk(req.params.id);
    if (!event) return res.status(404).json({ error: "Event not found" });

    const authorized = await isOrgAdmin(req.user.id, event.organization_id);
    if (!authorized)
      return res
        .status(403)
        .json({ error: "Not authorized to delete this event." });

    await event.destroy();
    res.json({ message: "Event deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get Event Participants
router.get("/:id/participants", auth, async (req, res) => {
  try {
    const participants = await EventParticipant.findAll({
      where: { event_id: req.params.id },
      include: [{ model: User, attributes: ["id", "name", "profile_pic"] }],
    });

    res.json(participants);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
