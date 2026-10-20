const router = require("express").Router();
const auth = require("../middleware/auth");
const validate = require("../middleware/validate");
const v = require("../validators/misc");
const c = require("../controllers/event");

router.post("/", auth, validate({ body: v.announcementCreate }), c.createAnnouncement);
router.get("/:event_id", validate({ params: v.announcementParams }), c.listAnnouncements);

module.exports = router;
