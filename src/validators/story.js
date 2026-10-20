const { z, id, optionalText } = require("./common");

module.exports = {
  create: z.object({
    type: z.enum(["image", "text"]),
    image_url: optionalText(500),
    text: z.string().trim().max(280).optional(),
    bg: z.coerce.number().int().min(0).max(20).default(0),
  }),
  storyIdParams: z.object({ storyId: id }),
};
