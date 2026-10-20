const userService = require("../services/user");
const preferenceService = require("../services/preference");
const presenceService = require("../services/presence");

exports.list = async (req, res) => res.json(await userService.list(req.valid.query));
exports.getById = async (req, res) => res.json(await userService.getById(req.valid.params.id));
exports.update = async (req, res) =>
  res.json(await userService.update(req.user.id, req.valid.params.id, req.body));
exports.remove = async (req, res) => {
  await userService.remove(req.user.id, req.valid.params.id);
  res.json({ message: "User deleted" });
};

exports.getPreferences = async (req, res) => res.json(await preferenceService.get(req.user.id));
exports.updatePreferences = async (req, res) =>
  res.json(await preferenceService.update(req.user.id, req.body));
exports.presence = async (req, res) =>
  res.json(await presenceService.statusFor(req.user.id, req.valid.params.id));
