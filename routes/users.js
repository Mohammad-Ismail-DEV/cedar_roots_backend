const express = require("express");
const router = express.Router();
const { User } = require("../models");
const auth = require("../middleware/authMiddleware");

router.post("/", auth, async (req, res) => {
  try {
    const user = await User.create(req.body);
    res.json(user);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get("/", auth, async (req, res) => {
  try {
    const { search } = req.query;

    let users;

    if (search) {
      users = await User.findAll({
        where: {
          name: {
            [require("sequelize").Op.like]: `%${search}%`,
          },
        },
        attributes: ["id", "name", "email", "profile_pic"],
        limit: 20,
      });
    } else {
      users = await User.findAll({
        attributes: ["id", "name", "email", "profile_pic"],
        limit: 50,
      });
    }

    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/:id", auth, async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id, {attributes: ["id", "name", "profile_pic"] });
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/:id", auth, async (req, res) => {
  try {
    const [updated] = await User.update(req.body, {
      where: { id: req.params.id },
    });
    if (!updated) return res.status(404).json({ error: "User not found" });
    const user = await User.findByPk(req.params.id, {attributes: ["id", "name", "profile_pic"] });
    res.json(user);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete("/:id", auth, async (req, res) => {
  try {
    const deleted = await User.destroy({ where: { id: req.params.id } });
    if (!deleted) return res.status(404).json({ error: "User not found" });
    res.json({ message: "User deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
