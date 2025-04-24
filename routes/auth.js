const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { User, UserVerification } = require("../models");

router.post("/verify", async (req, res) => {
  const { email, code } = req.body;

  try {
    const user = await User.findOne({ where: { email } });

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    const verification = await UserVerification.findOne({
      where: {
        user_id: user.id,
        verification_code: code,
        status: "pending", // make sure it's still pending
      },
    });

    if (!verification) {
      return res
        .status(400)
        .json({ message: "Invalid or already used verification code." });
    }

    const now = new Date();
    if (verification.expires_at < now) {
      return res.status(400).json({ message: "Verification code expired." });
    }

    // Update verification status
    verification.status = "verified";
    await verification.save();

    // You can optionally update user status here too
    // user.is_verified = true;
    // await user.save();
    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET);
    // Return user data
    return res.status(200).json({
      message: "Email verified successfully.",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error("Email verification error:", error);
    return res
      .status(500)
      .json({ message: "Server error during verification." });
  }
});

router.post("/signup", async (req, res) => {
  const { email, password, name } = req.body;

  try {
    const existing = await User.findOne({ where: { email } });
    if (existing) return res.status(400).json({ error: "Email already used" });

    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({ email, name, password_hash: hashed });

    // Generate 4-digit verification code
    const verificationCode = Math.floor(1000 + Math.random() * 9000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

    await UserVerification.create({
      user_id: user.id,
      verification_code: verificationCode,
      expires_at: expiresAt,
      status: "pending",
    });

    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET);

    res.json({
      token,
      user,
      message: "User created. Verification code sent.",
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ where: { email } });

    if (!user) return res.status(404).json({ error: "User not found" });

    const verification = await UserVerification.findOne({
      where: {
        user_id: user.id,
        status: "verified",
      },
    });

    if (!verification) {
      return res.status(403).json({ error: "Email not verified" });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: "Invalid password" });

    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET);

    res.json({ token, user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
