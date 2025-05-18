// routes/search.js
const express = require("express");
const router = express.Router();
const { Op } = require("sequelize");
const { Post, Event, User, Organization, SearchHistory } = require("../models");
const auth = require("../middleware/authMiddleware");

router.get("/", auth, async (req, res) => {
  const query = req.query.q;
  const userId = req.user.id;

  if (!query) return res.status(400).json({ error: "Missing query parameter" });

  try {
    // Log to search history
    await SearchHistory.create({
      user_id: userId,
      search_term: query,
      searched_at: new Date(),
    });

    const posts = await Post.findAll({
      where: {
        content: { [Op.like]: `%${query}%` },
      },
      include: [{ model: User, attributes: ["id", "name", "profile_pic"] }],
    });

    const events = await Event.findAll({
      where: {
        [Op.or]: [
          { title: { [Op.like]: `%${query}%` } },
          { location: { [Op.like]: `%${query}%` } },
        ],
      },
    });

    const users = await User.findAll({
      where: {
        name: { [Op.like]: `%${query}%` },
      },
    });

    const orgs = await Organization.findAll({
      where: {
        name: { [Op.like]: `%${query}%` },
      },
    });

    res.json({ posts, events, users, organizations: orgs });
  } catch (err) {
    console.error("❌ Search failed:", err);
    res.status(500).json({ error: `Search failed, ${err}` });
  }
});

module.exports = router;
