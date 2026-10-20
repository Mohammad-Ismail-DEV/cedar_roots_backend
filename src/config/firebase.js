const fs = require("fs");
const admin = require("firebase-admin");
const env = require("./env");
const logger = require("../utils/logger");

let enabled = false;

function initFirebase() {
  if (admin.apps.length) {
    enabled = true;
    return;
  }
  if (!fs.existsSync(env.firebaseServiceAccountPath)) {
    logger.warn("Firebase service account not found; push notifications disabled");
    return;
  }
  const serviceAccount = JSON.parse(fs.readFileSync(env.firebaseServiceAccountPath, "utf8"));
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  enabled = true;
}

module.exports = {
  initFirebase,
  isEnabled: () => enabled,
  messaging: () => admin.messaging(),
};
