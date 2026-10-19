const postService = require("../services/post");
const commentService = require("../services/comment");
const likeService = require("../services/like");

exports.create = async (req, res) => res.json(await postService.create(req.user.id, req.body));
exports.list = async (req, res) =>
  res.json(await postService.list({ userId: req.valid.query.user_id }));
exports.getById = async (req, res) => res.json(await postService.getById(req.valid.params.id));
exports.update = async (req, res) =>
  res.json({
    message: "Post updated successfully",
    post: await postService.update(req.user.id, req.valid.params.id, req.body),
  });
exports.remove = async (req, res) => {
  await postService.remove(req.user.id, req.valid.params.id);
  res.json({ message: "Post deleted" });
};

exports.toggleLike = async (req, res) =>
  res.json(await likeService.toggle(req.user.id, req.valid.params.postId));
exports.toggleLikeByBody = async (req, res) =>
  res.json(await likeService.toggle(req.user.id, req.body.post_id));
exports.listLikes = async (req, res) =>
  res.json(await likeService.listForPost(req.valid.params.postId));

exports.createComment = async (req, res) =>
  res.json(await commentService.create(req.user.id, req.body));
exports.listComments = async (req, res) =>
  res.json(await commentService.listForPost(req.valid.params.postId));
exports.removeComment = async (req, res) => {
  await commentService.remove(req.user.id, req.valid.params.id);
  res.json({ message: "Comment deleted" });
};
