const { z, id, text } = require("./common");

const content = text(5000);

module.exports = {
  create: z.object({ receiver_id: id, content }),
  markAsRead: z.object({ senderId: id, receiverId: id }),

  socketSend: z.object({
    senderId: id.optional(),
    receiverId: id,
    content,
    type: z.enum(["text", "image"]).default("text"),
    local_id: z.union([z.string(), z.number()]).optional(),
  }),
  socketHistory: z.object({
    senderId: id.optional(),
    receiverId: id,
    page: id.default(1),
    limit: id.max(100).default(20),
  }),
};
