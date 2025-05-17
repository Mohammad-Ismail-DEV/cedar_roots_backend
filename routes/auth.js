const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { User, UserVerification } = require("../models");
const sgMail = require("@sendgrid/mail");
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

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
        status: "pending", // still unused
      },
    });

    if (verification == null) {
      console.log("Verification not found or already used.");
      return res
        .status(400)
        .json({ message: "Invalid or already used verification code." });
    }

    // Ensure UTC-based comparison
    const now = new Date(); // still in local time
    const expiryUTC = new Date(verification.expires_at); // stored in UTC
    if (expiryUTC < now) {
      return res.status(400).json({ message: "Verification code expired." });
    }

    // Update verification status
    verification.status = "verified";
    await verification.save();

    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET);

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

    // Generate 4-digit verification code and expiry
    const verificationCode = Math.floor(1000 + Math.random() * 9000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes

    await UserVerification.create({
      user_id: user.id,
      verification_code: verificationCode,
      expires_at: expiresAt,
      status: "pending",
    });

    // Send email with code
    await sendEmail(
      email,
      "Your Cedar Roots Verification Code",
      `
        <p>Hi ${name},</p>
        <p>Thanks for signing up! Your 4-digit verification code is:</p>
        <h2>${verificationCode}</h2>
        <p>This code was sent by Cedar Roots and will expire in <strong>10 minutes</strong>.</p>
        <p>If you didn’t request this, please ignore this email.</p>
        <br/>
        <p>— The Cedar Roots Team</p>
      `
    );

    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET);

    res.json({
      token,
      user,
      message: "User created. Verification code sent to email.",
    });
  } catch (err) {
    console.error("Signup error:", err);
    res.status(400).json({ error: err.message });
  }
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({
      where: { email },
      include: [], // add necessary includes
    });

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

    // Exclude password before sending
    const userPlain = user.get({ plain: true });
    delete userPlain.password_hash;

    res.json({ token, user: userPlain });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

async function sendEmail(to, subject, htmlContent) {
  try {
    const msg = {
      to,
      from: {
        email: process.env.SENDGRID_VERIFIED_EMAIL,
        name: "Cedar Roots",
      },
      subject,
      html: htmlContent,
    };

    const response = await sgMail.send(msg);
    console.log("✅ Email sent:", response[0].statusCode);
  } catch (error) {
    console.error("❌ SendGrid error:", error.response?.body || error.message);
    throw new Error("Failed to send verification email.");
  }
}

module.exports = router;
