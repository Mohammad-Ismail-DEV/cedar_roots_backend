const router = require("express").Router();
const auth = require("../middleware/auth");
const validate = require("../middleware/validate");
const { idParams } = require("../validators/common");
const c = require("../controllers/notification");

router.get("/", auth, c.list);
router.put("/:id/read", auth, validate({ params: idParams }), c.markRead);
router.delete("/:id", auth, validate({ params: idParams }), c.remove);

module.exports = router;
