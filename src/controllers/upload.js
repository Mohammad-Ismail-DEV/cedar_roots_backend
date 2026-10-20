const AppError = require("../utils/AppError");

exports.upload = (req, res) => {
  if (!req.file) throw AppError.badRequest("No file uploaded");
  res.json({ url: `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}` });
};
