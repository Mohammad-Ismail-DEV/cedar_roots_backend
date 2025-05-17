const express = require("express");
const router = express.Router();
const { OrganizationFollower, Organization, User } = require("../models");
const auth = require("../middleware/authMiddleware");

// Follow organization
router.post("/", auth, async (req, res) => {
  const { organization_id } = req.body;

  try {
    const [follower, created] = await OrganizationFollower.findOrCreate({
      where: { user_id: req.user.id, organization_id },
    });

    res.status(201).json({ follower, created });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Unfollow
router.delete("/", auth, async (req, res) => {
  const { organization_id } = req.body;

  try {
    const deleted = await OrganizationFollower.destroy({
      where: { user_id: req.user.id, organization_id },
    });

    if (!deleted) {
      return res.status(404).json({ error: "Not following organization" });
    }

    res.json({ message: "Unfollowed organization" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get followers for an organization
router.get("/:organization_id", async (req, res) => {
  try {
    const followers = await OrganizationFollower.findAll({
      where: { organization_id: req.params.organization_id },
      include: [{ model: User, attributes: ["id", "name", "profile_pic"] }],
    });

    res.json(followers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
