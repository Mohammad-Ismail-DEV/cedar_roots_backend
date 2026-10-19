const router = require("express").Router();
const auth = require("../middleware/auth");
const { imageUpload } = require("../middleware/upload");
const c = require("../controllers/upload");

router.post("/", auth, imageUpload.single("file"), c.upload);

module.exports = router;
