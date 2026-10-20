const jwt = require("jsonwebtoken");
const env = require("../config/env");
const AppError = require("../utils/AppError");

function verifyToken(token) {
  const decoded = jwt.verify(token, env.jwt.secret);
  if (!decoded || typeof decoded.id !== "number") {
    throw new Error("Malformed token payload");
  }
  return { id: decoded.id };
}

function auth(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) throw AppError.unauthorized("Access denied. No token provided.");

  try {
    req.user = verifyToken(token);
  } catch {
    throw AppError.unauthorized("Invalid or expired token.");
  }
  next();
}

module.exports = auth;
module.exports.verifyToken = verifyToken;
