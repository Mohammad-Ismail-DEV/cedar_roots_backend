const { z, id, text } = require("./common");

module.exports = {
  announcementCreate: z.object({ event_id: id, message: text(1000) }),
  announcementParams: z.object({ event_id: id }),
  searchQuery: z.object({ q: text(100) }),
};
