const router = require("express").Router();
const auth = require("../middleware/auth");
const validate = require("../middleware/validate");
const v = require("../validators/organization");
const c = require("../controllers/organization");

router.post("/", auth, validate({ body: v.memberAdd }), c.addMember);
router.put("/role", auth, validate({ body: v.memberRole }), c.updateMemberRole);
router.delete("/", auth, validate({ body: v.memberRemove }), c.removeMember);
router.get("/:organizationId", validate({ params: v.orgIdParams }), c.listMembers);
router.get("/:organizationId/:userId", auth, validate({ params: v.orgMemberParams }), c.getMember);

module.exports = router;
