const { Op } = require("sequelize");
const { Post, User, Comment, Like, Connection } = require("../models");
const AppError = require("../utils/AppError");
const { attachBlob } = require("./imageBlob");

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

async function connectedUserIds(userId) {
  const accepted = await Connection.findAll({
    where: {
      status: "accepted",
      [Op.or]: [{ sender_id: userId }, { receiver_id: userId }],
    },
  });
  return accepted.map((c) => (c.sender_id === userId ? c.receiver_id : c.sender_id));
}

async function create(userId, { content, image_url }) {
  return Post.create({
    user_id: userId,
    content,
    image_url: image_url ?? null,
    created_at: new Date(),
    updated_at: new Date(),
  });
}

// Posts from the user's connections come first, newest first within each group.
async function list({ userId }) {
  const connected = new Set(userId ? await connectedUserIds(userId) : []);

  const posts = await Post.findAll({
    include: postInclude,
    order: [["created_at", "DESC"]],
  });
  posts.sort((a, b) => Number(!connected.has(a.user_id)) - Number(!connected.has(b.user_id)));

  return Promise.all(posts.map(toJsonWithAvatar));
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
  post.image_url = image_url ?? post.image_url;
  post.updated_at = new Date();
  await post.save();
  return post;
}

async function remove(userId, id) {
  const post = await loadOwned(userId, id);
  await post.destroy();
}

module.exports = { create, list, getById, update, remove };
