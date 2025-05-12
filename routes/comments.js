const express = require("express");
const router = express.Router();
const { Comment, User } = require("../models");
const auth = require("../middleware/authMiddleware");

router.post("/", auth, async (req, res) => {
  try {
    const comment = await Comment.create({
      user_id: req.user.id,
      post_id: req.body.post_id,
      content: req.body.content,
      created_at: new Date(),
    });
    res.json(comment);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get("/post/:postId", async (req, res) => {
  try {
    const comments = await Comment.findAll({
      where: { post_id: req.params.postId },
      include: { model: User, attributes: ["id", "name", "profile_pic"] },
      order: [["created_at", "ASC"]],
    });
    res.json(comments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
