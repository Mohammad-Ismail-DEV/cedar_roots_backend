const fs = require("fs/promises");
const path = require("path");
const sharp = require("sharp");
const env = require("../config/env");
const logger = require("../utils/logger");

const MAX_CACHE_ENTRIES = 500;
const cache = new Map();

function remember(key, value) {
  if (cache.size >= MAX_CACHE_ENTRIES) cache.delete(cache.keys().next().value);
  cache.set(key, value);
}

// Returns a 256x256 base64 JPEG data URI for an uploaded image URL, or null.
async function getBlob(imageUrl) {
  if (!imageUrl) return null;

  const filePath = path.join(env.uploadsDir, path.basename(imageUrl));
  try {
    const { mtimeMs } = await fs.stat(filePath);
    const key = `${filePath}:${mtimeMs}`;
    if (cache.has(key)) return cache.get(key);

    const buffer = await sharp(filePath).resize(256, 256).jpeg({ quality: 70 }).toBuffer();
    const blob = `data:image/jpeg;base64,${buffer.toString("base64")}`;
    remember(key, blob);
    return blob;
  } catch (err) {
    logger.debug({ err: err.message, imageUrl }, "Could not build image blob");
    return null;
  }
}

// Sets target[blobKey] from target[urlKey] when target exists.
async function attachBlob(target, urlKey, blobKey) {
  if (target) target[blobKey] = await getBlob(target[urlKey]);
}

module.exports = { getBlob, attachBlob };
