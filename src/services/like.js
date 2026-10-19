const { Like, Post, User } = require("../models");
const AppError = require("../utils/AppError");
const { notifyUser } = require("./notification");

async function toggle(userId, postId) {
  const [post, user] = await Promise.all([Post.findByPk(postId), User.findByPk(userId)]);
  if (!post || !user) throw AppError.notFound("Post or user not found");

  const existing = await Like.findOne({ where: { post_id: postId, user_id: userId } });
  if (existing) {
    await existing.destroy();
    return { liked: false, message: "Post unliked" };
  }

  await Like.create({ post_id: postId, user_id: userId, created_at: new Date() });

  if (post.user_id !== userId) {
    await notifyUser({
      userId: post.user_id,
      type: "like",
      title: "New Like",
      body: `${user.name} liked your post.`,
      data: { postId: post.id, senderId: user.id, senderName: user.name },
    });
  }

  return { liked: true, message: "Post liked" };
}

async function listForPost(postId) {
  const likes = await Like.findAll({ where: { post_id: postId } });
  return { count: likes.length, users: likes.map((l) => l.user_id) };
}

module.exports = { toggle, listForPost };
