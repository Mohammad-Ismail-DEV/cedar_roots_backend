const express = require("express");
const router = express.Router();
const { Comment, User, Post } = require("../models"); // Make sure Like is imported
const auth = require("../middleware/authMiddleware");
const sendUserNotification = require("../utils/sendUserNotification");


// ✅ Create a Comment & Notify Post Owner
router.post("/", auth, async (req, res) => {
  try {
    const comment = await Comment.create({
      user_id: req.user.id,
      post_id: req.body.post_id,
      content: req.body.content,
      created_at: new Date(),
    });

    const post = await Post.findByPk(req.body.post_id);
    const sender = await User.findByPk(req.user.id);

    if (post && post.user_id !== req.user.id) {
      await sendUserNotification({
        userId: post.user_id,
        title: "New Comment",
        body: `${sender.name} commented on your post.`,
        type: "comment",
        data: {
          postId: post.id,
          senderId: sender.id,
          senderName: sender.name,
        },
      });
    }

    res.json(comment);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});


// ✅ Get Comments for a Post
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


// ✅ Delete a Comment
router.delete("/:id", auth, async (req, res) => {
  const commentId = parseInt(req.params.id);

  try {
    const comment = await Comment.findByPk(commentId);

    if (!comment) {
      return res.status(404).json({ error: "Comment not found" });
    }

    const userId = req.user.id;
    if (comment.user_id !== userId) {
      return res.status(403).json({ error: "Not authorized" });
    }

    await comment.destroy();
    res.json({ message: "Comment deleted" });
  } catch (err) {
    console.error("❌ Error deleting comment:", err);
    res.status(500).json({ error: "Failed to delete comment" });
  }
});


module.exports = router;
