const router = require("express").Router();
const auth = require("../middleware/auth");
const validate = require("../middleware/validate");
const v = require("../validators/post");
const c = require("../controllers/post");

router.post("/", auth, validate({ body: v.likeBody }), c.toggleLikeByBody);
router.get("/post/:postId", validate({ params: v.postIdParams }), c.listLikes);

module.exports = router;
