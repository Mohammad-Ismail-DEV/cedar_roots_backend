const searchService = require("../services/search");

exports.search = async (req, res) =>
  res.json(await searchService.search(req.user.id, req.valid.query.q));
