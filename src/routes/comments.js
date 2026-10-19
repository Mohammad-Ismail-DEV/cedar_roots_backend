const router = require("express").Router();
const auth = require("../middleware/auth");
const validate = require("../middleware/validate");
const { idParams } = require("../validators/common");
const v = require("../validators/post");
const c = require("../controllers/post");

router.post("/", auth, validate({ body: v.commentCreate }), c.createComment);
router.get("/post/:postId", validate({ params: v.commentPostParams }), c.listComments);
router.delete("/:id", auth, validate({ params: idParams }), c.removeComment);

module.exports = router;
