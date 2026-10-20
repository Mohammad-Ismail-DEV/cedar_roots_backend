const fs = require("fs/promises");
const path = require("path");
const sharp = require("sharp");
const env = require("../config/env");
const logger = require("../utils/logger");

// /uploads/photo.jpg?w=700 serves a WebP no wider than the next size up (768), generated once
// and kept on disk. Without ?w= the original is served untouched (that is the full-size view).
const WIDTHS = [128, 256, 512, 768, 1080, 1600];
const RESIZABLE = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const IMMUTABLE = "public, max-age=31536000, immutable"; // upload file names are unique

const inFlight = new Map();

const cacheDir = () => path.join(env.uploadsDir, "..", "image-cache");

function bucketFor(requested) {
  return WIDTHS.find((w) => w >= requested) ?? WIDTHS[WIDTHS.length - 1];
}

async function exists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

function build(source, target, width) {
  let job = inFlight.get(target);
  if (!job) {
    job = (async () => {
      await fs.mkdir(path.dirname(target), { recursive: true });
      const temp = `${target}.${process.pid}.tmp`;
      await sharp(source)
        .rotate() // honour the phone's EXIF orientation before the metadata is dropped
        .resize({ width, withoutEnlargement: true })
        .webp({ quality: 80 })
        .toFile(temp);
      await fs.rename(temp, target);
    })().finally(() => inFlight.delete(target));
    inFlight.set(target, job);
  }
  return job;
}

async function imageVariants(req, res, next) {
  const requested = Number(req.query.w);
  if (!Number.isFinite(requested) || requested <= 0) return next();

  const name = path.basename(req.path);
  if (!RESIZABLE.has(path.extname(name).toLowerCase())) return next();

  try {
    const source = path.join(env.uploadsDir, name);
    if (!(await exists(source))) return next();

    const width = bucketFor(requested);
    const target = path.join(cacheDir(), String(width), `${name}.webp`);
    if (!(await exists(target))) await build(source, target, width);

    res.set("Cache-Control", IMMUTABLE);
    res.type("image/webp");
    return res.sendFile(target);
  } catch (err) {
    logger.warn({ err: err.message, name }, "Could not build image variant; serving original");
    return next();
  }
}

module.exports = { imageVariants, WIDTHS };
