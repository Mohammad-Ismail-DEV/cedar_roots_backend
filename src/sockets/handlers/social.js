const { z, id, text } = require("../../validators/common");
const commentService = require("../../services/comment");
const likeService = require("../../services/like");
const connectionService = require("../../services/connection");
const { on, actingUserId } = require("../helpers");

// Socket entry points for actions that also exist as REST routes; both call the same services.
module.exports = function social(socket) {
  on(
    socket,
    "new_comment",
    z.object({ postId: id, userId: id.optional(), content: text(2000) }),
    (data) =>
      commentService.create(actingUserId(socket, data.userId), {
        post_id: data.postId,
        content: data.content,
      })
  );

  on(socket, "toggle_like", z.object({ postId: id, userId: id.optional() }), (data) =>
    likeService.toggle(actingUserId(socket, data.userId), data.postId)
  );

  on(socket, "connection_request", z.object({ senderId: id.optional(), receiverId: id }), (data) =>
    connectionService.request(actingUserId(socket, data.senderId), data.receiverId)
  );

  on(socket, "connection_respond", z.object({ connectionId: id, accept: z.boolean() }), (data) =>
    connectionService.respond(actingUserId(socket), data)
  );
};
