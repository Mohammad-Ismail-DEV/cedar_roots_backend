const router = require("express").Router();
const auth = require("../middleware/auth");
const validate = require("../middleware/validate");
const v = require("../validators/misc");
const c = require("../controllers/search");

router.get("/", auth, validate({ query: v.searchQuery }), c.search);

module.exports = router;
