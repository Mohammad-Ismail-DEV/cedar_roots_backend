const { z, id, text, optionalText } = require("./common");

const dateTime = z.coerce.date();

module.exports = {
  listQuery: z.object({ user_id: id.optional() }),
  create: z.object({
    title: text(255),
    description: optionalText(5000),
    location: optionalText(255),
    date_time: dateTime,
    organization_id: id,
    collaborators: z.array(id).max(50).default([]),
  }),
  update: z.object({
    title: text(255).optional(),
    description: optionalText(5000),
    location: optionalText(255),
    date_time: dateTime.optional(),
  }),
};
