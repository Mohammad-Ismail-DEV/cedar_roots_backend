const { Server } = require("socket.io");
const env = require("../config/env");
const logger = require("../utils/logger");
const { verifyToken } = require("../middleware/auth");
const realtime = require("./realtime");

const handlers = [
  require("./handlers/presence"),
  require("./handlers/chat"),
  require("./handlers/fcm"),
  require("./handlers/social"),
];

// A handshake token binds the socket to a user. Without one the socket falls back
// to the legacy "join with a user id" flow until ALLOW_ANON_SOCKETS=false.
function authenticate(socket, next) {
  const token = socket.handshake.auth?.token;
  if (token) {
    try {
      socket.data.userId = verifyToken(token).id;
      socket.data.authenticated = true;
    } catch {
      return next(new Error("Invalid or expired token"));
    }
  } else if (!env.allowAnonymousSockets) {
    return next(new Error("Authentication required"));
  }
  next();
}

module.exports = function initSockets(server) {
  const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST", "PUT", "DELETE"] },
  });
  realtime.init(io);
  io.use(authenticate);

  io.on("connection", (socket) => {
    logger.debug({ socketId: socket.id }, "socket connected");
    if (socket.data.authenticated) socket.join(realtime.userRoom(socket.data.userId));

    handlers.forEach((register) => register(socket));

    socket.on("disconnect", () => logger.debug({ socketId: socket.id }, "socket disconnected"));
  });

  return io;
};
