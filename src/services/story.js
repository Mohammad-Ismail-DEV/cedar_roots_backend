const fs = require("fs/promises");
const path = require("path");
const { Op } = require("sequelize");
const { Story, StoryView, User, Post } = require("../models");
const env = require("../config/env");
const AppError = require("../utils/AppError");
const logger = require("../utils/logger");
const realtime = require("../sockets/realtime");
const { attachBlob } = require("./imageBlob");
const { connectedUserIds, areConnected } = require("./network");

const TTL_MS = 24 * 60 * 60 * 1000;
const authorAttrs = ["id", "name", "profile_pic"];

// Tell the author and their connections to refresh their story rings.
async function announce(userId) {
  try {
    const ids = await connectedUserIds(userId);
    [userId, ...ids].forEach((id) => realtime.emitToUser(id, "stories_changed", { userId }));
  } catch (err) {
    logger.warn({ err: err.message }, "Could not announce story change");
  }
}

async function create(userId, { type, image_url, text, bg }) {
  if (type === "image" && !image_url) throw AppError.badRequest("A photo story needs an image");
  if (type === "text" && !text) throw AppError.badRequest("A text story needs some text");

  const now = new Date();
  const story = await Story.create({
    user_id: userId,
    type,
    image_url: type === "image" ? image_url : null,
    text: text || null,
    bg: bg ?? 0,
    created_at: now,
    expires_at: new Date(now.getTime() + TTL_MS),
  });

  await announce(userId);
  return story;
}

const storyJson = (story, viewed, viewCount) => ({
  id: story.id,
  type: story.type,
  image_url: story.image_url,
  text: story.text,
  bg: story.bg,
  created_at: story.created_at,
  expires_at: story.expires_at,
  viewed,
  ...(viewCount === undefined ? {} : { view_count: viewCount }),
});

// Active stories from me and my connections, grouped by author. Mine come first, then people
// with something I haven't seen, then the rest, newest first.
async function feed(userId) {
  const authors = [userId, ...(await connectedUserIds(userId))];
  const stories = await Story.findAll({
    where: { user_id: authors, expires_at: { [Op.gt]: new Date() } },
    include: [{ model: User, attributes: authorAttrs }],
    order: [["created_at", "ASC"]],
  });
  if (!stories.length) return [];

  const ids = stories.map((s) => s.id);
  const [seen, counts] = await Promise.all([
    StoryView.findAll({ where: { viewer_id: userId, story_id: ids }, attributes: ["story_id"] }),
    StoryView.findAll({
      where: {
        story_id: stories.filter((s) => s.user_id === userId).map((s) => s.id),
        viewer_id: { [Op.ne]: userId },
      },
      attributes: ["story_id"],
    }),
  ]);
  const seenIds = new Set(seen.map((v) => v.story_id));
  const viewCounts = new Map();
  counts.forEach((v) => viewCounts.set(v.story_id, (viewCounts.get(v.story_id) || 0) + 1));

  const groups = new Map();
  for (const story of stories) {
    if (!groups.has(story.user_id)) {
      const user = story.User.toJSON();
      await attachBlob(user, "profile_pic", "profile_pic_blob");
      groups.set(story.user_id, { user, stories: [] });
    }
    const mine = story.user_id === userId;
    groups
      .get(story.user_id)
      .stories.push(
        storyJson(story, seenIds.has(story.id), mine ? viewCounts.get(story.id) || 0 : undefined)
      );
  }

  const list = [...groups.values()].map((g) => ({
    ...g,
    all_seen: g.stories.every((s) => s.viewed),
    latest_at: g.stories[g.stories.length - 1].created_at,
  }));

  const rank = (g) => (g.user.id === userId ? 0 : g.all_seen ? 2 : 1);
  return list.sort(
    (a, b) => rank(a) - rank(b) || new Date(b.latest_at).getTime() - new Date(a.latest_at).getTime()
  );
}

async function loadActive(storyId) {
  const story = await Story.findByPk(storyId);
  if (!story || new Date(story.expires_at) <= new Date()) {
    throw AppError.notFound("Story not found or expired");
  }
  return story;
}

// Records that `userId` watched a story. Watching your own story only greys your own ring: it
// is not listed or counted among the viewers.
async function view(userId, storyId) {
  const story = await loadActive(storyId);
  const own = story.user_id === userId;

  if (!own && !(await areConnected(userId, story.user_id))) {
    throw AppError.forbidden("You can only view stories from your connections");
  }

  const [, created] = await StoryView.findOrCreate({
    where: { story_id: storyId, viewer_id: userId },
    defaults: { viewed_at: new Date() },
  });
  if (created && !own) realtime.emitToUser(story.user_id, "story_viewed", { storyId, viewerId: userId });
  return { viewed: true };
}

async function viewers(userId, storyId) {
  const story = await Story.findByPk(storyId);
  if (!story) throw AppError.notFound("Story not found");
  if (story.user_id !== userId) throw AppError.forbidden("Only the author can see who viewed");

  const views = await StoryView.findAll({
    where: { story_id: storyId, viewer_id: { [Op.ne]: userId } },
    include: [{ model: User, as: "Viewer", attributes: authorAttrs }],
    order: [["viewed_at", "DESC"]],
  });

  return Promise.all(
    views.map(async (v) => {
      const user = v.Viewer.toJSON();
      await attachBlob(user, "profile_pic", "profile_pic_blob");
      return { user, viewed_at: v.viewed_at };
    })
  );
}

// Deletes the uploaded file of a story image unless a post (or another story) still uses it.
async function removeUnusedUpload(url) {
  const name = url && path.basename(String(url).split("?")[0]);
  if (!name || !String(url).includes("/uploads/")) return;

  const [post, story] = await Promise.all([
    Post.findOne({ where: { image_url: { [Op.like]: `%/uploads/${name}` } } }),
    Story.findOne({ where: { image_url: { [Op.like]: `%/uploads/${name}` } } }),
  ]);
  if (post || story) return;

  await fs.rm(path.join(env.uploadsDir, name), { force: true });

  // Also drop the resized copies made for this one photo.
  const cache = path.join(env.uploadsDir, "..", "image-cache");
  const sizes = await fs.readdir(cache).catch(() => []);
  await Promise.all(sizes.map((size) => fs.rm(path.join(cache, size, `${name}.webp`), { force: true })));
}

async function remove(userId, storyId) {
  const story = await Story.findByPk(storyId);
  if (!story) throw AppError.notFound("Story not found");
  if (story.user_id !== userId) throw AppError.forbidden("You can only delete your own stories");

  await StoryView.destroy({ where: { story_id: storyId } });
  await story.destroy();
  await removeUnusedUpload(story.image_url).catch((err) =>
    logger.warn({ err: err.message }, "Could not remove story image")
  );
  await announce(userId);
}

// Removes stories past their 24 hours. Run on a timer.
async function purgeExpired(now = new Date()) {
  const expired = await Story.findAll({ where: { expires_at: { [Op.lte]: now } } });
  if (!expired.length) return 0;

  const ids = expired.map((s) => s.id);
  await StoryView.destroy({ where: { story_id: ids } });
  await Story.destroy({ where: { id: ids } });
  for (const story of expired) {
    await removeUnusedUpload(story.image_url).catch(() => {});
  }
  return expired.length;
}

module.exports = { TTL_MS, create, feed, view, viewers, remove, purgeExpired };
