const logger = require("../utils/logger");
const AppError = require("../utils/AppError");

// Registers a socket event with optional zod validation and uniform error handling.
// `onError` lets an event emit its own failure event (the client listens per event).
function on(socket, event, schema, handler, onError) {
  socket.on(event, async (payload) => {
    try {
      const data = schema ? schema.parse(payload ?? {}) : (payload ?? {});
      await handler(data);
    } catch (err) {
      logger.warn({ event, userId: socket.data.userId, err: err.message }, "socket handler failed");
      const message = err instanceof AppError ? err.message : "Request failed";
      if (onError) onError(message, payload);
      else socket.emit("socket_error", { event, error: message });
    }
  });
}

// The user a socket acts as. Authenticated sockets can never act as someone else.
function actingUserId(socket, claimedId) {
  const userId = socket.data.userId;
  if (!userId) throw AppError.unauthorized("Join first");
  if (claimedId && claimedId !== userId) throw AppError.forbidden("User mismatch");
  return userId;
}

module.exports = { on, actingUserId };
