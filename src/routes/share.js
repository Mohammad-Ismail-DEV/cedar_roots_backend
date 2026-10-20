const router = require("express").Router();
const { Post, User } = require("../models");

const escapeHtml = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const clip = (text, max) => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text);

// "/uploads/abc.jpg" or an absolute URL of one -> an absolute URL on this host.
const absoluteImage = (req, imageUrl) => {
  const at = imageUrl.indexOf("/uploads/");
  if (at < 0) return null;
  return `${req.protocol}://${req.get("host")}${imageUrl.slice(at)}?w=1200`;
};

const page = ({ title, description, image, url, appLink }) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}">
<meta property="og:site_name" content="Cedar Roots">
<meta property="og:type" content="article">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:url" content="${escapeHtml(url)}">
${image ? `<meta property="og:image" content="${escapeHtml(image)}">` : ""}
<meta name="twitter:card" content="${image ? "summary_large_image" : "summary"}">
<style>
  body{margin:0;font-family:system-ui,sans-serif;background:#fafafa;color:#111;display:flex;justify-content:center}
  main{max-width:480px;width:100%;padding:24px 16px}
  .card{background:#fff;border:1px solid #dbdbdb;border-radius:12px;overflow:hidden}
  .card img{width:100%;display:block}
  .card p{margin:0;padding:16px;font-size:16px;line-height:1.4;white-space:pre-wrap}
  .who{padding:12px 16px 0;font-weight:600}
  a.open{display:block;margin-top:16px;text-align:center;background:#0095f6;color:#fff;text-decoration:none;padding:12px;border-radius:8px;font-weight:600}
</style>
</head>
<body><main>
<div class="card"><div class="who">${escapeHtml(title)}</div>
${image ? `<img src="${escapeHtml(image)}" alt="">` : ""}
<p>${escapeHtml(description)}</p></div>
<a class="open" href="${escapeHtml(appLink)}">Open in Cedar Roots</a>
</main></body></html>`;

// Public preview of a post for links shared outside the app: crawlers read the Open Graph tags,
// people get the post and a button that opens it in the app.
router.get("/:id", async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) return res.status(404).type("text").send("Not found");
  const post = await Post.findByPk(req.params.id, {
    include: [{ model: User, attributes: ["name"] }],
  });
  if (!post) return res.status(404).type("html").send(page({
    title: "Cedar Roots",
    description: "This post is no longer available.",
    url: `${req.protocol}://${req.get("host")}${req.originalUrl}`,
    appLink: "cedarroots://",
  }));

  const author = post.User?.name;
  const text = (post.content || "").trim();
  res.type("html").send(page({
    title: author ? `${author} on Cedar Roots` : "A post on Cedar Roots",
    description: clip(text || "Shared a photo", 200),
    image: post.image_url ? absoluteImage(req, post.image_url) : null,
    url: `${req.protocol}://${req.get("host")}${req.originalUrl}`,
    appLink: `cedarroots://post/${post.id}`,
  }));
});

module.exports = router;
