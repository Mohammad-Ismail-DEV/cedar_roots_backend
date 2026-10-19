const router = require("express").Router();
const auth = require("../middleware/auth");
const validate = require("../middleware/validate");
const { idParams } = require("../validators/common");
const v = require("../validators/connection");
const c = require("../controllers/connection");

router.post("/", auth, validate({ body: v.request }), c.request);
router.put("/respond", auth, validate({ body: v.respond }), c.respond);
router.get("/", auth, c.list);
router.get("/user/:id/accepted", auth, validate({ params: idParams }), c.countAccepted);
router.get("/user/:id", auth, validate({ params: idParams }), c.groupedForUser);
router.get("/status/:user1/:user2", auth, validate({ params: v.pairParams }), c.status);
router.get("/between/:user1/:user2", auth, validate({ params: v.pairParams }), c.between);
router.delete("/:id", auth, validate({ params: idParams }), c.remove);

module.exports = router;
