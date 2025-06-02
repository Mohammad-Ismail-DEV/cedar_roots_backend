const express = require("express");
const router = express.Router();
const {
  Post,
  User,
  Comment,
  Like,
  Connection,
  Sequelize,
} = require("../models");
const auth = require("../middleware/authMiddleware");
const { Op } = require("sequelize");
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const sendUserNotification = require("../utils/sendUserNotification");

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

    const posts = await Post.findAll({
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
      order: [
        [
          Sequelize.literal(
            connections.length > 0
              ? `CASE WHEN \`Post\`.\`user_id\` IN (${connections.join(
                  ","
                )}) THEN 0 ELSE 1 END`
              : `1`
          ),
          "ASC",
        ],
        ["created_at", "DESC"],
      ],
    });
    for (const post of posts) {
      // 🔹 2. Handle author's profile picture as a small base64 blob
      const profilePicUrl = post.User?.profile_pic;
      if (profilePicUrl) {
        const picFilename = path.basename(profilePicUrl);
        const picPath = path.join(__dirname, "../uploads", picFilename);

        try {
          const resizedBuffer = await sharp(picPath)
            .resize(64, 64) // reduce to small square avatar
            .jpeg({ quality: 60 })
            .toBuffer();

          post.User.dataValues.profile_pic_blob = `data:image/jpeg;base64,${resizedBuffer.toString(
            "base64"
          )}`;
        } catch (e) {
          console.error("Error reading profile pic:", e);
          post.User.dataValues.profile_pic_blob = null;
        }
      } else {
        post.User.dataValues.profile_pic_blob = null;
      }
    }

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
    const profilePicUrl = post.User?.profile_pic;
    if (profilePicUrl) {
      const picFilename = path.basename(profilePicUrl);
      const picPath = path.join(__dirname, "../uploads", picFilename);

      try {
        const resizedBuffer = await sharp(picPath)
          .resize(64, 64) // reduce to small square avatar
          .jpeg({ quality: 60 })
          .toBuffer();

        post.User.dataValues.profile_pic_blob = `data:image/jpeg;base64,${resizedBuffer.toString(
          "base64"
        )}`;
      } catch (e) {
        console.error("Error reading profile pic:", e);
        post.User.dataValues.profile_pic_blob = null;
      }
    } else {
      post.User.dataValues.profile_pic_blob = null;
    }
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
        try {
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
        } catch (notificationError) {
          console.error(
            "\n\n🔔 Failed to send notification:",
            notificationError,
            "\n"
          );
          // Optional: You might decide not to throw here, so the like still succeeds
        }
      }

      return res.json({ liked: true, message: "Post liked" });
    }
  } catch (err) {
    console.error("❌ Error toggling like:", err);
    return res.status(500).json({ error: err.message });
  }
});

// ✅ Update a post (content or image)
router.put("/:id", auth, async (req, res) => {
  const postId = parseInt(req.params.id);
  const userId = req.user.id;
  const { content, image_url } = req.body;

  try {
    const post = await Post.findOne({
      where: {
        id: postId,
        user_id: userId, // Ensure the user owns the post
      },
    });

    if (!post) {
      return res.status(404).json({ error: "Post not found or unauthorized" });
    }

    post.content = content ?? post.content;
    post.image_url = image_url ?? post.image_url;
    post.updated_at = new Date();

    await post.save();

    res.json({ message: "Post updated successfully", post });
  } catch (err) {
    console.error("❌ Error updating post:", err);
    res.status(500).json({ error: "Failed to update post" });
  }
});

module.exports = router;
