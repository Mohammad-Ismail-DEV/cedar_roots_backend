const multer = require("multer");
const path = require("path");
const fs = require("fs");
const env = require("../config/env");
const AppError = require("../utils/AppError");

const ALLOWED = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};
// Photos are stored exactly as uploaded (no recompression), so leave room for full-resolution shots.
const MAX_BYTES = 30 * 1024 * 1024;

fs.mkdirSync(env.uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, env.uploadsDir),
  filename: (req, file, cb) => {
    const suffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, suffix + path.extname(file.originalname).toLowerCase());
  },
});

const imageUpload = multer({
  storage,
  limits: { fileSize: MAX_BYTES, files: 1 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED[ext] && file.mimetype.startsWith("image/")) return cb(null, true);
    cb(AppError.badRequest("Only image uploads (jpg, png, webp, gif) are allowed"));
  },
});

module.exports = { imageUpload };
