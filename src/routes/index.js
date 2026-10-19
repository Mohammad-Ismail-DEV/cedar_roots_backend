const router = require("express").Router();

router.use("/auth", require("./auth"));
router.use("/users", require("./users"));
router.use("/events", require("./events"));
router.use("/announcements", require("./announcements"));
router.use("/messages", require("./messages"));
router.use("/connections", require("./connections"));
router.use("/notifications", require("./notifications"));
router.use("/upload", require("./upload"));
router.use("/organizations", require("./organizations"));
router.use("/organization_members", require("./organization_members"));
router.use("/organization_followers", require("./organization_followers"));
router.use("/posts", require("./posts"));
router.use("/comments", require("./comments"));
router.use("/likes", require("./likes"));
router.use("/search", require("./search"));

module.exports = router;
