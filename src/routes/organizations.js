const router = require("express").Router();
const auth = require("../middleware/auth");
const validate = require("../middleware/validate");
const requireOrgRole = require("../middleware/requireOrgRole");
const { idParams } = require("../validators/common");
const v = require("../validators/organization");
const c = require("../controllers/organization");

const owner = requireOrgRole(["owner"], (req) => req.valid.params.id);

router.post("/", auth, validate({ body: v.create }), c.create);
router.get("/", validate({ query: v.searchQuery }), c.list);
router.get("/user/:id", validate({ params: idParams }), c.listForUser);
router.get("/:id", validate({ params: idParams }), c.getById);
router.put("/:id", auth, validate({ params: idParams, body: v.update }), owner, c.update);
router.delete("/:id", auth, validate({ params: idParams }), owner, c.remove);

module.exports = router;
