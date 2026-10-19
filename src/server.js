const http = require("http");
const env = require("./config/env");
const logger = require("./utils/logger");
const { initFirebase } = require("./config/firebase");
const db = require("./models");
const app = require("./app");
const initSockets = require("./sockets");

async function start() {
  initFirebase();
  await db.sequelize.sync();

  const server = http.createServer(app);
  initSockets(server);

  server.listen(env.port, () => logger.info(`Server running on port ${env.port}`));
}

start().catch((err) => {
  logger.fatal({ err }, "Failed to start server");
  process.exit(1);
});
