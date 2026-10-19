const { z, id } = require("../../validators/common");
const v = require("../../validators/message");
const messageService = require("../../services/message");
const realtime = require("../realtime");
const { on, actingUserId } = require("../helpers");

module.exports = function chat(socket) {
  on(
    socket,
    "send_message",
    v.socketSend,
    async (data) => {
      await messageService.send({
        senderId: actingUserId(socket, data.senderId),
        receiverId: data.receiverId,
        content: data.content,
        type: data.type,
        onSaved: (message) =>
          socket.emit("message_saved", {
            messageId: message.id,
            local_id: data.local_id,
            status: "saved",
          }),
      });
    },
    (error, payload) => socket.emit("message_failed", { local_id: payload?.local_id, error })
  );

  on(
    socket,
    "fetch_messages",
    v.socketHistory,
    async (data) => {
      const userId = actingUserId(socket, data.senderId);
      const messages = await messageService.history({
        userId,
        otherUserId: data.receiverId,
        page: data.page,
        limit: data.limit,
      });
      socket.emit("fetched_messages", messages);
    },
    (error) => socket.emit("fetched_messages_error", { error })
  );

  on(
    socket,
    "fetch_user_messages",
    z.object({ userId: id.optional() }),
    async (data) => {
      const userId = actingUserId(socket, data.userId);
      socket.emit("fetched_user_messages", await messageService.conversations(userId));
    },
    (error) => socket.emit("fetched_user_messages", { error })
  );

  on(socket, "message_received", z.object({ messageId: id }), (data) =>
    messageService.markDelivered({
      messageId: data.messageId,
      receiverId: actingUserId(socket),
    })
  );

  on(
    socket,
    "mark_messages_as_read",
    z.object({ senderId: id, receiverId: id.optional() }),
    (data) =>
      messageService.markSeen({
        readerId: actingUserId(socket, data.receiverId),
        authorId: data.senderId,
      })
  );

  on(socket, "typing", z.object({ receiverId: id, senderId: id.optional() }), (data) =>
    realtime.emitToUser(data.receiverId, "user_typing", {
      senderId: actingUserId(socket, data.senderId),
    })
  );
};
