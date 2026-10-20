class AppError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

AppError.badRequest = (msg = "Bad request") => new AppError(400, msg);
AppError.unauthorized = (msg = "Unauthorized") => new AppError(401, msg);
AppError.forbidden = (msg = "Forbidden") => new AppError(403, msg);
AppError.notFound = (msg = "Not found") => new AppError(404, msg);

module.exports = AppError;
