const logger = require("../utils/logger");
const AppError = require("../utils/AppError");

function notFoundHandler(req, res) {
  res.status(404).json({ error: "Route not found", message: "Route not found" });
}

// `message` mirrors `error` because the mobile app reads either key.
function send(res, status, error) {
  res.status(status).json({ error, message: error });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err.status && err.status < 500) return send(res, err.status, err.message);

  // Deliberate server-side failures (e.g. email provider down) carry a user-safe message.
  if (err instanceof AppError) {
    logger.error({ err, path: req.path, method: req.method }, err.message);
    return send(res, err.status, err.message);
  }

  if (err.name === "SequelizeUniqueConstraintError") {
    return send(res, 409, "Resource already exists");
  }
  if (err.name === "SequelizeValidationError") {
    return send(res, 400, err.errors?.[0]?.message || "Invalid data");
  }
  if (err.name === "MulterError") {
    const status = err.code === "LIMIT_FILE_SIZE" ? 413 : 400;
    return send(res, status, err.message);
  }
  if (err.type === "entity.parse.failed") {
    return send(res, 400, "Malformed JSON body");
  }

  logger.error({ err, path: req.path, method: req.method }, "Unhandled error");
  return send(res, 500, "Internal server error");
}

module.exports = { errorHandler, notFoundHandler };
