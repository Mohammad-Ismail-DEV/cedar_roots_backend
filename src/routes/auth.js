const router = require("express").Router();
const validate = require("../middleware/validate");
const { authLimiter, verifyLimiter } = require("../middleware/rateLimit");
const v = require("../validators/auth");
const c = require("../controllers/auth");

router.post("/signup", authLimiter, validate({ body: v.signup }), c.signup);
router.post("/verify", verifyLimiter, validate({ body: v.verify }), c.verify);
router.post("/login", authLimiter, validate({ body: v.login }), c.login);

module.exports = router;
