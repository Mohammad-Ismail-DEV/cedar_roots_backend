const { z, id, text, optionalText } = require("./common");

module.exports = {
  listQuery: z.object({ user_id: id.optional() }),
  create: z.object({
    content: z.string().trim().max(5000).default(""),
    image_url: optionalText(500),
  }),
  update: z.object({
    content: z.string().trim().max(5000).optional(),
    image_url: optionalText(500),
  }),
  postIdParams: z.object({ postId: id }),

  commentCreate: z.object({ post_id: id, content: text(2000) }),
  commentPostParams: z.object({ postId: id }),
  likeBody: z.object({ post_id: id }),
};
