const { z, id, text, optionalText } = require("./common");

const fields = {
  description: optionalText(5000),
  location: optionalText(255),
  website: optionalText(500),
  logo: optionalText(500),
};
const role = z.enum(["member", "admin", "owner"]);

module.exports = {
  searchQuery: z.object({ search: z.string().trim().max(100).optional() }),
  create: z.object({ name: text(255), ...fields }),
  update: z.object({ name: text(255).optional(), ...fields }),

  memberAdd: z.object({ user_id: id, organization_id: id, role: role.default("member") }),
  memberRole: z.object({ user_id: id, organization_id: id, role }),
  memberRemove: z.object({ user_id: id, organization_id: id }),
  orgMemberParams: z.object({ organizationId: id, userId: id }),
  orgIdParams: z.object({ organizationId: id }),

  followBody: z.object({ organization_id: id }),
  followersParams: z.object({ organization_id: id }),
};
