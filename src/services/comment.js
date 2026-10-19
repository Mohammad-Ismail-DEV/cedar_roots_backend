const { Comment, User, Post } = require("../models");
const AppError = require("../utils/AppError");
const { notifyUser } = require("./notification");

async function create(userId, { post_id, content }) {
  const [post, sender] = await Promise.all([Post.findByPk(post_id), User.findByPk(userId)]);
  if (!post) throw AppError.notFound("Post not found");

  const comment = await Comment.create({
    user_id: userId,
    post_id,
    content,
    created_at: new Date(),
  });

  if (post.user_id !== userId) {
    await notifyUser({
      userId: post.user_id,
      type: "comment",
      title: "New Comment",
      body: `${sender.name} commented on your post.`,
      data: { postId: post.id, senderId: sender.id, senderName: sender.name },
    });
  }

  return comment;
}

async function listForPost(postId) {
  return Comment.findAll({
    where: { post_id: postId },
    include: { model: User, as: "Author", attributes: ["id", "name", "profile_pic"] },
    order: [["created_at", "ASC"]],
  });
}

async function remove(userId, commentId) {
  const comment = await Comment.findByPk(commentId);
  if (!comment) throw AppError.notFound("Comment not found");

  const post = await Post.findByPk(comment.post_id);
  if (!post) throw AppError.notFound("Related post not found");

  if (comment.user_id !== userId && post.user_id !== userId) {
    throw AppError.forbidden("Not authorized");
  }
  await comment.destroy();
}

module.exports = { create, listForPost, remove };
