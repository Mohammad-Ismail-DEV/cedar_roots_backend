const express = require("express");
const router = express.Router();
const { Organization, Event, User } = require("../models");
const auth = require("../middleware/authMiddleware");

// Create a new organization
router.post("/", auth, async (req, res) => {
  try {
    const organization = await Organization.create({
      ...req.body,
      owner_id: req.user.id,
      created_at: new Date(),
      updated_at: new Date(),
    });
    res.status(201).json(organization);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get all organizations
router.get("/", async (req, res) => {
  try {
    const organizations = await Organization.findAll({
      include: [{ model: User, attributes: ["id", "name"] }],
    });
    res.json(organizations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get an organization by ID
router.get("/:id", async (req, res) => {
  try {
    const organization = await Organization.findByPk(req.params.id, {
      include: [{ model: User, attributes: ["id", "name"] }, { model: Event }],
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
    const org = await Organization.findByPk(req.params.id);
    if (!org || org.owner_id !== req.user.id) {
      return res.status(403).json({ error: "Unauthorized" });
    }
    await org.update({ ...req.body, updated_at: new Date() });
    res.json(org);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Delete organization (only owner)
router.delete("/:id", auth, async (req, res) => {
  try {
    const org = await Organization.findByPk(req.params.id);
    if (!org || org.owner_id !== req.user.id) {
      return res.status(403).json({ error: "Unauthorized" });
    }
    await org.destroy();
    res.json({ message: "Organization deleted" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
