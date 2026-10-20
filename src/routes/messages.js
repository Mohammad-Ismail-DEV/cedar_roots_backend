const router = require("express").Router();
const auth = require("../middleware/auth");
const validate = require("../middleware/validate");
const { idParams } = require("../validators/common");
const v = require("../validators/message");
const c = require("../controllers/message");

router.post("/", auth, validate({ body: v.create }), c.create);
router.get("/", auth, c.list);
router.post("/mark_as_read", auth, validate({ body: v.markAsRead }), c.markAsRead);
router.get("/:id", auth, validate({ params: idParams }), c.getById);
router.delete("/:id", auth, validate({ params: idParams }), c.remove);

module.exports = router;
