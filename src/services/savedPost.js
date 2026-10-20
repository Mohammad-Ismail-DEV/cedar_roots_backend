const { SavedPost, Post } = require("../models");
const AppError = require("../utils/AppError");
const postService = require("./post");

// Bookmarks or un-bookmarks a post for `userId`.
async function toggle(userId, postId) {
  if (!(await Post.findByPk(postId))) throw AppError.notFound("Post not found");

  const existing = await SavedPost.findOne({ where: { user_id: userId, post_id: postId } });
  if (existing) {
    await existing.destroy();
    return { saved: false };
  }
  await SavedPost.create({ user_id: userId, post_id: postId, created_at: new Date() });
  return { saved: true };
}

// Newest bookmark first.
async function ids(userId) {
  const rows = await SavedPost.findAll({
    where: { user_id: userId },
    attributes: ["post_id"],
    order: [
      ["created_at", "DESC"],
      ["id", "DESC"],
    ],
  });
  return rows.map((r) => r.post_id);
}

async function list(userId) {
  return postService.listByIds(await ids(userId));
}

module.exports = { toggle, ids, list };
