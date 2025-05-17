const express = require("express");
const router = express.Router();
const { Post, User, Comment, Like, Connection } = require("../models");
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
  const userId = parseInt(req.query.user_id);

  try {
    let connections = [];
    if (!isNaN(userId)) {
      const accepted = await Connection.findAll({
        where: {
          status: "accepted",
          [Op.or]: [{ sender_id: userId }, { receiver_id: userId }],
        },
      });

      connections = accepted.map((conn) =>
        conn.sender_id === userId ? conn.receiver_id : conn.sender_id
      );
    }

    const whereCondition =
      !isNaN(userId) && connections.length > 0
        ? { user_id: { [Op.in]: connections } }
        : !isNaN(userId)
        ? { user_id: -1 } // empty match instead of crash
        : {};

    const posts = await Post.findAll({
      where: whereCondition,
      include: [
        { model: User, attributes: ["id", "name", "profile_pic"] },
        {
          model: Comment,
          as: "Comments",
          include: [
            {
              model: User,
              as: "Author",
              attributes: ["id", "name", "profile_pic"],
            },
          ],
        },
        {
          model: Like,
          as: "Likes",
          include: [
            {
              model: User,
              as: "Liker",
              attributes: ["id", "name", "profile_pic"],
            },
          ],
        },
      ],
      order: [["created_at", "DESC"]],
    });

    res.json(posts);
  } catch (err) {
    console.error("❌ Error in GET /posts:", err);
    res.status(500).json({ error: err.message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const post = await Post.findByPk(req.params.id, {
      include: [
        { model: User, attributes: ["id", "name", "profile_pic"] },
        {
          model: Comment,
          as: "Comments",
          include: [
            {
              model: User,
              as: "Author",
              attributes: ["id", "name", "profile_pic"],
            },
          ],
        },
        {
          model: Like,
          as: "Likes",
          include: [{ model: User, as: "Liker", attributes: ["id", "name"] }],
        },
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

// ✅ Like or Unlike a Post & Notify Post Owner
router.post("/:postId/like", auth, async (req, res) => {
  const { postId } = req.params;
  const userId = req.user.id;

  try {
    const existing = await Like.findOne({
      where: { post_id: postId, user_id: userId },
    });

    const post = await Post.findByPk(postId);
    const user = await User.findByPk(userId);

    if (!post || !user) {
      return res.status(404).json({ error: "Post or user not found" });
    }

    if (existing) {
      await existing.destroy();
      return res.json({ liked: false, message: "Post unliked" });
    } else {
      await Like.create({ post_id: postId, user_id: userId });

      if (post.user_id !== userId) {
        await sendUserNotification({
          userId: post.user_id,
          title: "New Like",
          body: `${user.name} liked your post.`,
          type: "like",
          data: {
            postId: post.id,
            senderId: user.id,
            senderName: user.name,
          },
        });
      }

      return res.json({ liked: true, message: "Post liked" });
    }
  } catch (err) {
    console.error("❌ Error toggling like:", err);
    return res.status(500).json({ error: "Failed to toggle like" });
  }
});

module.exports = router;
