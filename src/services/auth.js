const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { User, UserVerification, EmailChange } = require("../models");
const env = require("../config/env");
const AppError = require("../utils/AppError");
const logger = require("../utils/logger");
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

// Expires any older pending code, stores a new one and emails it.
async function issueVerificationCode(user) {
  await UserVerification.update(
    { status: "expired" },
    { where: { user_id: user.id, status: "pending" } }
  );

  const code = crypto.randomInt(1000, 10000).toString();
  await UserVerification.create({
    user_id: user.id,
    verification_code: code,
    expires_at: new Date(Date.now() + CODE_TTL_MS),
    status: "pending",
  });

  if (env.emailMode === "console") {
    logger.warn({ email: user.email, code }, "EMAIL_MODE=console: verification code (not emailed)");
  }

  await sendEmail(
    user.email,
    "Your Cedar Roots Verification Code",
    `<p>Hi ${escapeHtml(user.name)},</p>
     <p>Your 4-digit verification code is:</p>
     <h2>${code}</h2>
     <p>This code expires in <strong>10 minutes</strong>.</p>
     <p>If you didn't request this, please ignore this email.</p>
     <p>— The Cedar Roots Team</p>`
  );
}

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

  try {
    await issueVerificationCode(user);
  } catch (err) {
    // No half-created account: the user can simply try again.
    await UserVerification.destroy({ where: { user_id: user.id } });
    await user.destroy();
    throw err;
  }

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

// Same answer whether or not the account exists, so it can't be used to probe emails.
async function resendCode({ email }) {
  const user = await User.findOne({ where: { email } });
  if (user) {
    const verified = await UserVerification.findOne({
      where: { user_id: user.id, status: "verified" },
    });
    if (!verified) await issueVerificationCode(user);
  }
  return { message: "If the account exists and is unverified, a new code was sent." };
}

async function checkPassword(userId, password) {
  const user = await User.findByPk(userId);
  if (!user) throw AppError.notFound("User not found");
  if (!(await bcrypt.compare(password, user.password_hash))) {
    // 403, not 401: the app signs people out on 401 (an expired token), and a typo in this
    // field must not do that.
    throw AppError.forbidden("Current password is incorrect");
  }
  return user;
}

async function changePassword(userId, { current_password, new_password }) {
  const user = await checkPassword(userId, current_password);
  if (current_password === new_password) {
    throw AppError.badRequest("Choose a password you haven't used just now");
  }
  user.password_hash = await bcrypt.hash(new_password, 10);
  user.updated_at = new Date();
  await user.save();
  return { message: "Password updated." };
}

// Step 1 of changing your email: prove who you are, then a code goes to the NEW address.
async function startEmailChange(userId, { new_email, password }) {
  const user = await checkPassword(userId, password);
  if (new_email === user.email) throw AppError.badRequest("That is already your email");
  if (await User.findOne({ where: { email: new_email } })) {
    throw AppError.badRequest("Email already used");
  }

  const code = crypto.randomInt(1000, 10000).toString();
  await EmailChange.upsert({
    user_id: userId,
    new_email,
    code,
    expires_at: new Date(Date.now() + CODE_TTL_MS),
  });

  if (env.emailMode === "console") {
    logger.warn({ email: new_email, code }, "EMAIL_MODE=console: email change code (not emailed)");
  }
  await sendEmail(
    new_email,
    "Confirm your new Cedar Roots email",
    `<p>Hi ${escapeHtml(user.name)},</p>
     <p>Your 4-digit code to confirm this email address is:</p>
     <h2>${code}</h2>
     <p>This code expires in <strong>10 minutes</strong>. If you didn't ask for this, ignore this email.</p>`
  );
  return { message: "A code was sent to your new email." };
}

// Step 2: the code from the new address makes it the account's email.
async function confirmEmailChange(userId, { code }) {
  const pending = await EmailChange.findByPk(userId);
  if (!pending || pending.code !== code) throw AppError.badRequest("Invalid verification code.");
  if (new Date(pending.expires_at) < new Date()) {
    throw AppError.badRequest("Verification code expired.");
  }
  if (await User.findOne({ where: { email: pending.new_email } })) {
    throw AppError.badRequest("Email already used");
  }

  await User.update(
    { email: pending.new_email, updated_at: new Date() },
    { where: { id: userId } }
  );
  await pending.destroy();
  return { message: "Email updated.", email: pending.new_email };
}

module.exports = {
  signup,
  verify,
  login,
  resendCode,
  changePassword,
  startEmailChange,
  confirmEmailChange,
};
