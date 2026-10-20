const { z } = require("zod");

const id = z.coerce.number().int().positive();
const text = (max) => z.string().trim().min(1).max(max);
const optionalText = (max) => z.string().trim().max(max).nullable().optional();

module.exports = {
  z,
  id,
  text,
  optionalText,
  idParams: z.object({ id }),
};
