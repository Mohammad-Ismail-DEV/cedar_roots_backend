// Lets services push realtime events without importing socket.io directly.
let io = null;

const userRoom = (userId) => `user:${userId}`;

module.exports = {
  init(server) {
    io = server;
  },
  userRoom,
  emitToUser(userId, event, payload) {
    if (io) io.to(userRoom(userId)).emit(event, payload);
  },
  emitToAll(event, payload) {
    if (io) io.emit(event, payload);
  },
};
