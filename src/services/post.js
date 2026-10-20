const { Post, User, Comment, Like, SavedPost } = require("../models");
const AppError = require("../utils/AppError");
const { attachBlob } = require("./imageBlob");
const { connectedUserIds } = require("./network");
const realtime = require("../sockets/realtime");

const announce = (id) => realtime.emitToAll("feed_changed", { kind: "post", id });

const authorAttrs = ["id", "name", "profile_pic"];

const postInclude = [
  { model: User, attributes: authorAttrs },
  {
    model: Comment,
    as: "Comments",
    include: [{ model: User, as: "Author", attributes: authorAttrs }],
  },
  {
    model: Like,
    as: "Likes",
    include: [{ model: User, as: "Liker", attributes: authorAttrs }],
  },
];

async function toJsonWithAvatar(post) {
  const json = post.toJSON();
  if (json.User) await attachBlob(json.User, "profile_pic", "profile_pic_blob");
  return json;
}

async function create(userId, { content, image_url }) {
  const post = await Post.create({
    user_id: userId,
    content,
    image_url: image_url ?? null,
    created_at: new Date(),
    updated_at: new Date(),
  });
  announce(post.id);
  return post;
}

// Posts from the user's connections come first, newest first within each group.
async function list({ userId, authorId }) {
  const connected = new Set(userId ? await connectedUserIds(userId) : []);

  const posts = await Post.findAll({
    where: authorId ? { user_id: authorId } : undefined,
    include: postInclude,
    order: [["created_at", "DESC"]],
  });
  posts.sort((a, b) => Number(!connected.has(a.user_id)) - Number(!connected.has(b.user_id)));

  return Promise.all(posts.map(toJsonWithAvatar));
}

// The given posts in the given order (ids of deleted posts are skipped).
async function listByIds(ids) {
  if (!ids.length) return [];
  const posts = await Post.findAll({ where: { id: ids }, include: postInclude });
  const byId = new Map(posts.map((p) => [p.id, p]));
  return Promise.all(ids.filter((id) => byId.has(id)).map((id) => toJsonWithAvatar(byId.get(id))));
}

async function getById(id) {
  const post = await Post.findByPk(id, { include: postInclude });
  if (!post) throw AppError.notFound("Post not found");
  return toJsonWithAvatar(post);
}

async function loadOwned(userId, id) {
  const post = await Post.findOne({ where: { id, user_id: userId } });
  if (!post) throw AppError.notFound("Post not found or unauthorized");
  return post;
}

async function update(userId, id, { content, image_url }) {
  const post = await loadOwned(userId, id);
  post.content = content ?? post.content;
  // null means "remove the image"; undefined means "leave it alone".
  if (image_url !== undefined) post.image_url = image_url;
  post.updated_at = new Date();
  await post.save();
  announce(post.id);
  return post;
}

async function remove(userId, id) {
  const post = await loadOwned(userId, id);
  await SavedPost.destroy({ where: { post_id: id } });
  await post.destroy();
  announce(post.id);
}

module.exports = { create, list, listByIds, getById, update, remove };
