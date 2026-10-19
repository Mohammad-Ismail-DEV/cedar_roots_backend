const { Announcement, Event, EventParticipant, User } = require("../models");
const AppError = require("../utils/AppError");
const organizationMember = require("./organizationMember");
const { notifyUsers } = require("./notification");

const PREVIEW_LENGTH = 100;

async function create(actorId, { event_id, message }) {
  const event = await Event.findByPk(event_id);
  if (!event) throw AppError.notFound("Event not found");
  await organizationMember.assertRole(actorId, event.organization_id, ["owner", "admin"]);

  const [announcement, sender, memberIds, participants] = await Promise.all([
    Announcement.create({ event_id, message, created_at: new Date() }),
    User.findByPk(actorId),
    organizationMember.listUserIds(event.organization_id),
    EventParticipant.findAll({ where: { event_id } }),
  ]);

  const audience = new Set([...memberIds, ...participants.map((p) => p.user_id)]);
  audience.delete(actorId);

  const preview =
    message.length > PREVIEW_LENGTH ? `${message.slice(0, PREVIEW_LENGTH)}...` : message;

  await notifyUsers(audience, () => ({
    type: "event_announcement",
    title: "New Event Announcement",
    body: `${sender.name} announced: ${preview}`,
    data: { eventId: event_id },
  }));

  return announcement;
}

async function listForEvent(eventId) {
  return Announcement.findAll({
    where: { event_id: eventId },
    order: [["created_at", "DESC"]],
  });
}

module.exports = { create, listForEvent };
