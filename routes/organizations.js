const express = require("express");
const router = express.Router();
const {
  Organization,
  Event,
  User,
  OrganizationMember,
  OrganizationFollower,
} = require("../models");
const auth = require("../middleware/authMiddleware");
const { Op } = require("sequelize");

// Create a new organization
router.post("/", auth, async (req, res) => {
  try {
    const organization = await Organization.create({
      ...req.body,
      created_at: new Date(),
      updated_at: new Date(),
    });

    await OrganizationMember.create({
      user_id: req.user.id,
      organization_id: organization.id,
      role: "owner",
    });

    res.status(201).json(organization);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get all organizations or search by name
router.get("/", async (req, res) => {
  try {
    const { search } = req.query;

    const whereClause = search
      ? { name: { [Op.like]: `%${search}%` } }
      : undefined;

    const organizations = await Organization.findAll({ where: whereClause });

    res.json(organizations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get organizations where user is a member (any role)
router.get("/user/:id", async (req, res) => {
  const userId = parseInt(req.params.id);

  try {
    const memberships = await OrganizationMember.findAll({
      where: { user_id: userId },
      include: [Organization],
    });

    const organizations = memberships.map((m) => m.Organization);
    res.json(organizations);
  } catch (error) {
    console.error("❌ Error fetching user's organizations:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get an organization by ID
router.get("/:id", async (req, res) => {
  try {
    const organization = await Organization.findByPk(req.params.id, {
      include: [
        { model: Event },
        {
          model: OrganizationFollower,
          include: [{ model: User, attributes: ["id", "name", "profile_pic"] }],
        },
        {
          model: OrganizationMember,
          include: [{ model: User, attributes: ["id", "name", "profile_pic"] }],
        },
      ],
    });

    if (!organization)
      return res.status(404).json({ error: "Organization not found" });

    res.json(organization);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update organization (only owner)
router.put("/:id", auth, async (req, res) => {
  try {
    const membership = await OrganizationMember.findOne({
      where: {
        user_id: req.user.id,
        organization_id: req.params.id,
        role: "owner",
      },
    });

    if (!membership) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const org = await Organization.findByPk(req.params.id);
    await org.update({ ...req.body, updated_at: new Date() });
    res.json(org);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Delete organization (only owner)
router.delete("/:id", auth, async (req, res) => {
  try {
    const membership = await OrganizationMember.findOne({
      where: {
        user_id: req.user.id,
        organization_id: req.params.id,
        role: "owner",
      },
    });

    if (!membership) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    await Organization.destroy({ where: { id: req.params.id } });
    res.json({ message: "Organization deleted" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
