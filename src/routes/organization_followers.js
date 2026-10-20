const router = require("express").Router();
const auth = require("../middleware/auth");
const validate = require("../middleware/validate");
const v = require("../validators/organization");
const c = require("../controllers/organization");

router.post("/", auth, validate({ body: v.followBody }), c.follow);
router.delete("/", auth, validate({ body: v.followBody }), c.unfollow);
router.get("/:organization_id", validate({ params: v.followersParams }), c.listFollowers);

module.exports = router;
