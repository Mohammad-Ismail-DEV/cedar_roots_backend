const messageService = require("../services/message");
const AppError = require("../utils/AppError");

exports.create = async (req, res) =>
  res.json(
    await messageService.send({
      senderId: req.user.id,
      receiverId: req.body.receiver_id,
      content: req.body.content,
    })
  );
exports.list = async (req, res) => res.json(await messageService.listForUser(req.user.id));
exports.getById = async (req, res) =>
  res.json(await messageService.getById(req.user.id, req.valid.params.id));
exports.markAsRead = async (req, res) => {
  const { senderId, receiverId } = req.body;
  if (receiverId !== req.user.id) {
    throw AppError.forbidden("You can only mark messages sent to you as read.");
  }
  const ids = await messageService.markSeen({ readerId: receiverId, authorId: senderId });
  res.json({ message: `${ids.length} message(s) marked as read.`, success: true });
};
exports.remove = async (req, res) => {
  await messageService.remove(req.user.id, req.valid.params.id);
  res.json({ message: "Message deleted" });
};
