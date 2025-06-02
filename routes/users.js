const express = require("express");
const router = express.Router();
const { User } = require("../models");
const auth = require("../middleware/authMiddleware");
const sharp = require("sharp");
const path = require("path");
const fs = require("fs");
const { Op } = require("sequelize");

// Helper function to generate profile picture blob
async function generateBlob(profilePicUrl) {
  if (!profilePicUrl) return null;

  const picFilename = path.basename(profilePicUrl);
  const picPath = path.join(__dirname, "../uploads", picFilename);

  try {
    const resizedBuffer = await sharp(picPath)
      .resize(64, 64)
      .jpeg({ quality: 60 })
      .toBuffer();

    return `data:image/jpeg;base64,${resizedBuffer.toString("base64")}`;
  } catch (err) {
    console.error("❌ Error resizing image:", err.message);
    return null;
  }
}

router.post("/", auth, async (req, res) => {
  try {
    const user = await User.create(req.body);
    res.json(user);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get("/", auth, async (req, res) => {
  try {
    const { search } = req.query;

    let users;

    if (search) {
      users = await User.findAll({
        where: {
          name: {
            [Op.like]: `%${search}%`,
          },
        },
        attributes: ["id", "name", "email", "profile_pic"],
        limit: 20,
      });
    } else {
      users = await User.findAll({
        attributes: ["id", "name", "email", "profile_pic"],
        limit: 50,
      });
    }

    // Add profile_pic_blob to each user
    const enrichedUsers = [];
    for (const user of users) {
      const blob = await generateBlob(user.profile_pic);
      enrichedUsers.push({
        id: user.id,
        name: user.name,
        email: user.email,
        profile_pic: user.profile_pic,
        profile_pic_blob: blob,
      });
    }

    res.json(enrichedUsers);
  } catch (err) {
    console.error("❌ Error fetching users:", err.message);
    res.status(500).json({ error: err.message });
  }
});

router.get("/:id", auth, async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id, {
      attributes: ["id", "name", "profile_pic"],
    });

    if (!user) return res.status(404).json({ error: "User not found" });

    let resizedBlob = null;

    const profilePicUrl = user.profile_pic;
    if (profilePicUrl) {
      const picFilename = path.basename(profilePicUrl);
      const picPath = path.join(__dirname, "../uploads", picFilename);

      try {
        const resizedBuffer = await sharp(picPath)
          .resize(64, 64) // same dimensions as in posts route
          .jpeg({ quality: 60 })
          .toBuffer();

        resizedBlob = `data:image/jpeg;base64,${resizedBuffer.toString(
          "base64"
        )}`;
      } catch (err) {
        console.error("Error resizing profile picture:", err);
      }
    }

    res.json({
      id: user.id,
      name: user.name,
      profile_pic: user.profile_pic,
      profile_pic_blob: resizedBlob,
    });
  } catch (err) {
    console.error("Error fetching user:", err);
    res.status(500).json({ error: err.message });
  }
});

router.put("/:id", auth, async (req, res) => {
  try {
    const [updated] = await User.update(req.body, {
      where: { id: req.params.id },
    });
    if (!updated) return res.status(404).json({ error: "User not found" });
    const user = await User.findByPk(req.params.id, {
      attributes: ["id", "name", "profile_pic"],
    });
    res.json(user);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete("/:id", auth, async (req, res) => {
  try {
    const deleted = await User.destroy({ where: { id: req.params.id } });
    if (!deleted) return res.status(404).json({ error: "User not found" });
    res.json({ message: "User deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
