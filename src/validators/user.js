const { z, optionalText } = require("./common");

module.exports = {
  listQuery: z.object({ search: z.string().trim().max(100).optional() }),
  update: z.object({
    name: z.string().trim().min(1).max(100).optional(),
    profile_pic: optionalText(500),
    bio: optionalText(2000),
    location: optionalText(255),
  }),
};
