const express = require("express");
const router = express.Router();
const { OrganizationMember, User } = require("../models");
const auth = require("../middleware/authMiddleware");

// Add member to organization
router.post("/", auth, async (req, res) => {
  const { user_id, organization_id, role = "member" } = req.body;

  try {
    const existing = await OrganizationMember.findOne({
      where: { user_id, organization_id },
    });

    if (existing) {
      return res
        .status(400)
        .json({ error: "User already a member of the organization" });
    }

    const membership = await OrganizationMember.create({
      user_id,
      organization_id,
      role,
    });

    res.json(membership);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get members of an organization
router.get("/:organizationId", async (req, res) => {
  try {
    const members = await OrganizationMember.findAll({
      where: { organization_id: req.params.organizationId },
      include: [
        { model: User, attributes: ["id", "name", "email", "profile_pic"] },
      ],
    });

    res.json(members);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/role", auth, async (req, res) => {
  const { organization_id, user_id, role } = req.body;

  if (!organization_id || !user_id || !role) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const member = await OrganizationMember.findOne({
      where: { organization_id, user_id },
    });

    if (!member) {
      return res.status(404).json({ error: "Member not found" });
    }

    member.role = role;
    await member.save();

    res.json({ message: "Role updated", member });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Remove a member
router.delete("/", auth, async (req, res) => {
  const { user_id, organization_id } = req.body;

  try {
    const deleted = await OrganizationMember.destroy({
      where: { user_id, organization_id },
    });

    if (!deleted) {
      return res.status(404).json({ error: "Member not found" });
    }

    res.json({ message: "Member removed" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get a specific user's membership in an organization
router.get("/:organizationId/:userId", auth, async (req, res) => {
  try {
    const member = await OrganizationMember.findOne({
      where: {
        organization_id: req.params.organizationId,
        user_id: req.params.userId,
      },
      include: [{ model: User, attributes: ["id", "name", "profile_pic"] }],
    });

    if (!member) return res.status(404).json({ error: "Not a member" });

    res.json(member);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
