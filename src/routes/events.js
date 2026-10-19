const router = require("express").Router();
const auth = require("../middleware/auth");
const validate = require("../middleware/validate");
const { idParams } = require("../validators/common");
const v = require("../validators/event");
const c = require("../controllers/event");

router.post("/", auth, validate({ body: v.create }), c.create);
router.get("/", validate({ query: v.listQuery }), c.list);
router.post("/:id/join", auth, validate({ params: idParams }), c.join);
router.get("/:id", validate({ params: idParams }), c.getById);
router.put("/:id", auth, validate({ params: idParams, body: v.update }), c.update);
router.delete("/:id", auth, validate({ params: idParams }), c.remove);
router.get("/:id/participants", auth, validate({ params: idParams }), c.listParticipants);

module.exports = router;
