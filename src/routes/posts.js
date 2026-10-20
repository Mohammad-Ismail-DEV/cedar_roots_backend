const router = require("express").Router();
const auth = require("../middleware/auth");
const validate = require("../middleware/validate");
const { idParams } = require("../validators/common");
const v = require("../validators/post");
const c = require("../controllers/post");

router.post("/", auth, validate({ body: v.create }), c.create);
router.get("/", validate({ query: v.listQuery }), c.list);
router.get("/saved", auth, c.listSaved);
router.get("/saved/ids", auth, c.savedIds);
router.get("/:id", validate({ params: idParams }), c.getById);
router.put("/:id", auth, validate({ params: idParams, body: v.update }), c.update);
router.delete("/:id", auth, validate({ params: idParams }), c.remove);
router.post("/:postId/save", auth, validate({ params: v.postIdParams }), c.toggleSave);
router.post("/:postId/like", auth, validate({ params: v.postIdParams }), c.toggleLike);

module.exports = router;
