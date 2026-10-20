const http = require("http");
const env = require("./config/env");
const logger = require("./utils/logger");
const { initFirebase } = require("./config/firebase");
const db = require("./models");
const app = require("./app");
const initSockets = require("./sockets");
const { isConfigured } = require("./services/email");

function checkEmailConfig() {
  if (env.emailMode === "console") {
    logger.warn("EMAIL_MODE=console: verification codes are printed here, not emailed");
  } else if (!isConfigured()) {
    logger.warn(
      "Email is not configured: set GMAIL_USER and GMAIL_APP_PASSWORD in .env (or EMAIL_MODE=console for dev). Signups will fail until then."
    );
  }
}

async function start() {
  initFirebase();
  checkEmailConfig();
  await db.sequelize.sync();

  const server = http.createServer(app);
  initSockets(server);

  server.listen(env.port, () => logger.info(`Server running on port ${env.port}`));
}

start().catch((err) => {
  logger.fatal({ err }, "Failed to start server");
  process.exit(1);
});
