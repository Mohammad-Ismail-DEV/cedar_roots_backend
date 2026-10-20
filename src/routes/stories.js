const router = require("express").Router();
const auth = require("../middleware/auth");
const validate = require("../middleware/validate");
const v = require("../validators/story");
const c = require("../controllers/story");

router.get("/", auth, c.feed);
router.post("/", auth, validate({ body: v.create }), c.create);
router.post("/:storyId/view", auth, validate({ params: v.storyIdParams }), c.view);
router.get("/:storyId/viewers", auth, validate({ params: v.storyIdParams }), c.viewers);
router.delete("/:storyId", auth, validate({ params: v.storyIdParams }), c.remove);

module.exports = router;
