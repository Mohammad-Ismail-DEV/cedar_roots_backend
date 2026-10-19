const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { User, UserVerification } = require("../models");
const env = require("../config/env");
const AppError = require("../utils/AppError");
const { sendEmail } = require("./email");

const CODE_TTL_MS = 10 * 60 * 1000;

const capitalizeWords = (str) =>
  str
    .toLowerCase()
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

const escapeHtml = (s) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]
  );

const signToken = (userId) =>
  jwt.sign({ id: userId }, env.jwt.secret, { expiresIn: env.jwt.expiresIn });

const publicUser = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  created_at: user.created_at,
});

async function signup({ email, password, name }) {
  if (await User.findOne({ where: { email } })) {
    throw AppError.badRequest("Email already used");
  }

  const user = await User.create({
    email,
    name: capitalizeWords(name),
    password_hash: await bcrypt.hash(password, 10),
    created_at: new Date(),
    updated_at: new Date(),
  });

  const code = crypto.randomInt(1000, 10000).toString();
  await UserVerification.create({
    user_id: user.id,
    verification_code: code,
    expires_at: new Date(Date.now() + CODE_TTL_MS),
    status: "pending",
  });

  await sendEmail(
    email,
    "Your Cedar Roots Verification Code",
    `<p>Hi ${escapeHtml(user.name)},</p>
     <p>Thanks for signing up! Your 4-digit verification code is:</p>
     <h2>${code}</h2>
     <p>This code expires in <strong>10 minutes</strong>.</p>
     <p>If you didn't request this, please ignore this email.</p>
     <p>— The Cedar Roots Team</p>`
  );

  return { user: publicUser(user), message: "User created. Verification code sent to email." };
}

async function verify({ email, code }) {
  const invalid = () => AppError.badRequest("Invalid or already used verification code.");

  const user = await User.findOne({ where: { email } });
  if (!user) throw invalid();

  const verification = await UserVerification.findOne({
    where: { user_id: user.id, verification_code: code, status: "pending" },
  });
  if (!verification) throw invalid();
  if (new Date(verification.expires_at) < new Date()) {
    throw AppError.badRequest("Verification code expired.");
  }

  verification.status = "verified";
  await verification.save();

  return {
    message: "Email verified successfully.",
    token: signToken(user.id),
    user: publicUser(user),
  };
}

async function login({ email, password }) {
  const user = await User.findOne({ where: { email } });
  const valid = user && (await bcrypt.compare(password, user.password_hash));
  if (!valid) throw AppError.unauthorized("Invalid email or password");

  const verified = await UserVerification.findOne({
    where: { user_id: user.id, status: "verified" },
  });
  if (!verified) throw AppError.forbidden("Email not verified");

  const plain = user.get({ plain: true });
  delete plain.password_hash;
  return { token: signToken(user.id), user: plain };
}

module.exports = { signup, verify, login };
