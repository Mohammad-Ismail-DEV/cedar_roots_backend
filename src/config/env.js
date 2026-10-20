const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", "..", ".env") });

const isTest = process.env.NODE_ENV === "test";

function required(name) {
  const value = process.env[name];
  if (!value && !isTest) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

module.exports = {
  isTest,
  port: Number(process.env.PORT) || 3000,
  // SHA-256 fingerprints (comma separated) of the keys the Android app is signed with; they let
  // https://<host>/p/<id> links open straight in the app.
  androidCertFingerprints: (process.env.ANDROID_CERT_SHA256 || "")
    .split(",")
    .map((f) => f.trim())
    .filter(Boolean),
  jwt: {
    secret: required("JWT_SECRET") || "test-secret",
    expiresIn: process.env.JWT_EXPIRES_IN || "30d",
  },
  db: {
    username: required("DB_USERNAME"),
    password: process.env.DB_PASSWORD ?? process.env.PASSWORD,
    name: process.env.DB_NAME || "cedar_roots_db",
    host: process.env.DB_HOST || "127.0.0.1",
    dialect: "mysql",
  },
  // "console" prints verification codes in the server log instead of emailing them (dev only).
  emailMode: process.env.EMAIL_MODE === "console" ? "console" : "smtp",
  // Gmail account used to send verification emails. Use an App Password, not the account password.
  email: {
    user: process.env.GMAIL_USER,
    password: process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, ""),
  },
  firebaseServiceAccountPath:
    process.env.FIREBASE_SERVICE_ACCOUNT ||
    path.join(__dirname, "..", "..", "firebase-settings.json"),
  uploadsDir: path.join(__dirname, "..", "..", "uploads"),
  allowAnonymousSockets: process.env.ALLOW_ANON_SOCKETS !== "false",
};
