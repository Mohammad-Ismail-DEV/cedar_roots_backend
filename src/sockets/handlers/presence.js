const { z, id } = require("../../validators/common");
const realtime = require("../realtime");
const { on } = require("../helpers");

module.exports = function presence(socket) {
  on(
    socket,
    "join",
    z.union([id, z.object({ userId: id }).transform((o) => o.userId)]),
    (userId) => {
      // Authenticated sockets already joined their own room on connect.
      if (socket.data.authenticated) return;

      if (socket.data.userId) socket.leave(realtime.userRoom(socket.data.userId));
      socket.data.userId = userId;
      socket.join(realtime.userRoom(userId));
    }
  );
};
