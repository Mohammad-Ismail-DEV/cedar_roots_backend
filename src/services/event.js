const { Event, EventParticipant, User, Organization, OrganizationFollower } = require("../models");
const AppError = require("../utils/AppError");
const { attachBlob } = require("./imageBlob");
const organizationMember = require("./organizationMember");
const follower = require("./follower");
const { notifyUser, notifyUsers } = require("./notification");
const realtime = require("../sockets/realtime");

const announce = (id) => realtime.emitToAll("feed_changed", { kind: "event", id });

const orgInclude = { model: Organization, attributes: ["id", "name", "logo"] };

async function toJsonWithLogo(event) {
  const json = event.toJSON();
  if (json.Organization) await attachBlob(json.Organization, "logo", "logo_blob");
  return json;
}

async function create(actorId, { collaborators, ...fields }) {
  await organizationMember.assertRole(actorId, fields.organization_id, ["owner", "admin"]);

  const event = await Event.create({
    ...fields,
    created_at: new Date(),
    updated_at: new Date(),
  });
  const creator = await User.findByPk(actorId);
  const data = { eventId: event.id, organizerName: creator.name };

  const validCollaborators = (
    await User.findAll({ where: { id: collaborators }, attributes: ["id"] })
  ).map((u) => u.id);

  await EventParticipant.bulkCreate(
    validCollaborators.map((userId) => ({
      event_id: event.id,
      user_id: userId,
      role: "collaborator",
      status: "invited",
    }))
  );

  await notifyUsers(validCollaborators, () => ({
    type: "event_invite",
    title: "Event Invitation",
    body: `${creator.name} invited you to collaborate on ${event.title}.`,
    data,
  }));

  const audience = new Set([
    ...(await follower.listUserIds(fields.organization_id)),
    ...(await organizationMember.listUserIds(fields.organization_id)),
  ]);
  audience.delete(actorId);
  validCollaborators.forEach((id) => audience.delete(id));

  await notifyUsers(audience, () => ({
    type: "new_event",
    title: "New Event Created",
    body: `${creator.name} created a new event: ${event.title}`,
    data,
  }));

  announce(event.id);
  return event;
}

async function join(userId, eventId) {
  const event = await Event.findByPk(eventId);
  if (!event) throw AppError.notFound("Event not found");

  const [participation, created] = await EventParticipant.findOrCreate({
    where: { event_id: eventId, user_id: userId },
    defaults: { status: "joined" },
  });

  if (created) {
    const user = await User.findByPk(userId);
    const collaborators = await EventParticipant.findAll({
      where: { event_id: eventId, role: "collaborator" },
    });
    await Promise.all(
      collaborators
        .filter((c) => c.user_id !== userId)
        .map((c) =>
          notifyUser({
            userId: c.user_id,
            type: "event_join",
            title: "New Participant",
            body: `${user.name} joined the event: ${event.title}`,
            data: { eventId: event.id, joinerName: user.name },
          })
        )
    );
  }

  return participation;
}

async function leave(userId, eventId) {
  const left = await EventParticipant.destroy({ where: { event_id: eventId, user_id: userId } });
  if (!left) throw AppError.notFound("You are not part of this event");
}

// Events from organizations the user follows come first, newest first within each group.
async function list({ userId }) {
  const followedOrgIds = new Set(userId ? await followedOrganizationIds(userId) : []);

  const events = await Event.findAll({
    include: [orgInclude],
    order: [["created_at", "DESC"]],
  });
  events.sort(
    (a, b) =>
      Number(!followedOrgIds.has(a.organization_id)) -
      Number(!followedOrgIds.has(b.organization_id))
  );

  // How many people joined each event, and whether the caller is one of them.
  const rows = events.length
    ? await EventParticipant.findAll({
        where: { event_id: events.map((e) => e.id) },
        attributes: ["event_id", "user_id"],
      })
    : [];
  const counts = new Map();
  const mine = new Set();
  rows.forEach((r) => {
    counts.set(r.event_id, (counts.get(r.event_id) || 0) + 1);
    if (userId && r.user_id === userId) mine.add(r.event_id);
  });

  return Promise.all(
    events.map(async (e) => ({
      ...(await toJsonWithLogo(e)),
      participant_count: counts.get(e.id) || 0,
      is_participant: mine.has(e.id),
    }))
  );
}

async function followedOrganizationIds(userId) {
  const follows = await OrganizationFollower.findAll({ where: { user_id: userId } });
  return follows.map((f) => f.organization_id);
}

async function getById(id) {
  const event = await Event.findByPk(id, { include: [orgInclude] });
  if (!event) throw AppError.notFound("Event not found");
  return toJsonWithLogo(event);
}

async function loadManageable(actorId, id) {
  const event = await Event.findByPk(id);
  if (!event) throw AppError.notFound("Event not found");
  await organizationMember.assertRole(actorId, event.organization_id, ["owner", "admin"]);
  return event;
}

async function update(actorId, id, fields) {
  const event = await loadManageable(actorId, id);
  await event.update({ ...fields, updated_at: new Date() });
  announce(event.id);
  return event;
}

async function remove(actorId, id) {
  const event = await loadManageable(actorId, id);
  await event.destroy();
  announce(event.id);
}

async function listParticipants(eventId) {
  return EventParticipant.findAll({
    where: { event_id: eventId },
    include: [{ model: User, attributes: ["id", "name", "profile_pic"] }],
  });
}

module.exports = { create, join, leave, list, getById, update, remove, listParticipants };
