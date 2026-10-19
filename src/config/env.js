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
  sendgrid: {
    apiKey: process.env.SENDGRID_API_KEY,
    fromEmail: process.env.SENDGRID_VERIFIED_EMAIL,
  },
  firebaseServiceAccountPath:
    process.env.FIREBASE_SERVICE_ACCOUNT ||
    path.join(__dirname, "..", "..", "firebase-settings.json"),
  uploadsDir: path.join(__dirname, "..", "..", "uploads"),
  allowAnonymousSockets: process.env.ALLOW_ANON_SOCKETS !== "false",
};
