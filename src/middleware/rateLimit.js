const rateLimit = require("express-rate-limit");

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many attempts, please try again later",
    message: "Too many attempts, please try again later",
  },
});

// Verification codes are only 4 digits, so cap guesses per email regardless of IP.
const verifyLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `verify:${String(req.body?.email ?? "").toLowerCase()}`,
  validate: { keyGeneratorIpFallback: false },
  message: {
    error: "Too many attempts, please try again later",
    message: "Too many attempts, please try again later",
  },
});

module.exports = { authLimiter, verifyLimiter };
