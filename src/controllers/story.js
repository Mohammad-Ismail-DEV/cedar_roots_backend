const storyService = require("../services/story");

exports.feed = async (req, res) => res.json(await storyService.feed(req.user.id));
exports.create = async (req, res) => res.json(await storyService.create(req.user.id, req.body));
exports.view = async (req, res) =>
  res.json(await storyService.view(req.user.id, req.valid.params.storyId));
exports.viewers = async (req, res) =>
  res.json(await storyService.viewers(req.user.id, req.valid.params.storyId));
exports.remove = async (req, res) => {
  await storyService.remove(req.user.id, req.valid.params.storyId);
  res.json({ message: "Story deleted" });
};
