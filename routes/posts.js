const express = require("express");
const router = express.Router();
const { Post, User, Comment, Like } = require("../models");
const auth = require("../middleware/authMiddleware");

router.post("/", auth, async (req, res) => {
  try {
    const post = await Post.create({
      user_id: req.user.id,
      content: req.body.content,
      image_url: req.body.image_url || null,
      created_at: new Date(),
      updated_at: new Date(),
    });
    res.json(post);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get("/", async (req, res) => {
  try {
    const posts = await Post.findAll({
      include: [
        { model: User, attributes: ["id", "name", "profile_pic"] },
        { model: Comment },
        { model: Like },
      ],
      order: [["created_at", "DESC"]],
    });
    res.json(posts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const post = await Post.findByPk(req.params.id, {
      include: [
        { model: User, attributes: ["id", "name", "profile_pic"] },
        { model: Comment },
        { model: Like },
      ],
    });
    if (!post) return res.status(404).json({ error: "Post not found" });
    res.json(post);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/:id", auth, async (req, res) => {
  try {
    const deleted = await Post.destroy({
      where: { id: req.params.id, user_id: req.user.id },
    });
    if (!deleted)
      return res.status(404).json({ error: "Post not found or unauthorized" });
    res.json({ message: "Post deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
