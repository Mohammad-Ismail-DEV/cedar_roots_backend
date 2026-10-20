const notificationService = require("../services/notification");

exports.list = async (req, res) => res.json(await notificationService.listForUser(req.user.id));
exports.markRead = async (req, res) =>
  res.json(await notificationService.markRead(req.user.id, req.valid.params.id));
exports.remove = async (req, res) => {
  await notificationService.remove(req.user.id, req.valid.params.id);
  res.json({ message: "Notification deleted" });
};
