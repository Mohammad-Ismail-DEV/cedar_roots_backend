const express = require("express");
const router = express.Router();
const { Like } = require("../models");
const auth = require("../middleware/authMiddleware");
const sendUserNotification = require("../utils/sendUserNotification");

router.post("/", auth, async (req, res) => {
  try {
    const existing = await Like.findOne({
      where: { user_id: req.user.id, post_id: req.body.post_id },
    });

    if (existing) {
      await existing.destroy();
      return res.json({ liked: false });
    } else {
      await Like.create({
        user_id: req.user.id,
        post_id: req.body.post_id,
        created_at: new Date(),
      });

      const post = await Post.findByPk(req.body.post_id);
      const sender = await User.findByPk(req.user.id);

      if (post && post.user_id !== req.user.id) {
        await sendUserNotification({
          userId: post.user_id,
          title: "New Like",
          body: `${sender.name} liked your post.`,
          type: "like",
          data: {
            postId: post.id,
            senderId: sender.id,
            senderName: sender.name,
          },
        });
      }

      return res.json({ liked: true });
    }
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get("/post/:postId", async (req, res) => {
  try {
    const likes = await Like.findAll({ where: { post_id: req.params.postId } });
    res.json({ count: likes.length, users: likes.map((like) => like.user_id) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
