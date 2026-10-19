const router = require("express").Router();
const auth = require("../middleware/auth");
const validate = require("../middleware/validate");
const { idParams } = require("../validators/common");
const v = require("../validators/user");
const c = require("../controllers/user");

router.get("/", auth, validate({ query: v.listQuery }), c.list);
router.get("/:id", auth, validate({ params: idParams }), c.getById);
router.put("/:id", auth, validate({ params: idParams, body: v.update }), c.update);
router.delete("/:id", auth, validate({ params: idParams }), c.remove);

module.exports = router;
