const eventService = require("../services/event");
const announcementService = require("../services/announcement");

exports.create = async (req, res) => res.json(await eventService.create(req.user.id, req.body));
exports.join = async (req, res) =>
  res.json(await eventService.join(req.user.id, req.valid.params.id));
exports.leave = async (req, res) => {
  await eventService.leave(req.user.id, req.valid.params.id);
  res.json({ message: "Left event" });
};
exports.list = async (req, res) =>
  res.json(await eventService.list({ userId: req.valid.query.user_id }));
exports.getById = async (req, res) => res.json(await eventService.getById(req.valid.params.id));
exports.update = async (req, res) =>
  res.json(await eventService.update(req.user.id, req.valid.params.id, req.body));
exports.remove = async (req, res) => {
  await eventService.remove(req.user.id, req.valid.params.id);
  res.json({ message: "Event deleted" });
};
exports.listParticipants = async (req, res) =>
  res.json(await eventService.listParticipants(req.valid.params.id));

exports.createAnnouncement = async (req, res) =>
  res.json(await announcementService.create(req.user.id, req.body));
exports.listAnnouncements = async (req, res) =>
  res.json(await announcementService.listForEvent(req.valid.params.event_id));
