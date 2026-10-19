const connectionService = require("../services/connection");
const AppError = require("../utils/AppError");

function assertInvolved(req, user1, user2) {
  if (req.user.id !== user1 && req.user.id !== user2) {
    throw AppError.forbidden("You can only look up your own connections");
  }
}

exports.request = async (req, res) =>
  res.json(await connectionService.request(req.user.id, req.body.receiver_id));
exports.respond = async (req, res) =>
  res.json(await connectionService.respond(req.user.id, req.body));
exports.list = async (req, res) => res.json(await connectionService.listForUser(req.user.id));
exports.countAccepted = async (req, res) =>
  res.json({ count: await connectionService.countAccepted(req.valid.params.id) });
// Pending requests are private: other users only see accepted connections.
exports.groupedForUser = async (req, res) => {
  const userId = req.valid.params.id;
  const grouped = await connectionService.groupedForUser(userId);
  res.json(userId === req.user.id ? grouped : { ...grouped, requests: [], outgoing: [] });
};
exports.status = async (req, res) => {
  const { user1, user2 } = req.valid.params;
  assertInvolved(req, user1, user2);
  res.json({ status: await connectionService.status(user1, user2) });
};
exports.between = async (req, res) => {
  const { user1, user2 } = req.valid.params;
  assertInvolved(req, user1, user2);
  res.json(await connectionService.findBetween(user1, user2));
};
exports.remove = async (req, res) => {
  await connectionService.remove(req.user.id, req.valid.params.id);
  res.json({ message: "Connection deleted successfully." });
};
