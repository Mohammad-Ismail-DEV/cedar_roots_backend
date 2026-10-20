const { z, id } = require("./common");

module.exports = {
  request: z.object({ receiver_id: id }),
  respond: z.object({ connectionId: id, accept: z.boolean() }),
  pairParams: z.object({ user1: id, user2: id }),
};
