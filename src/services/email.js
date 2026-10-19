const nodemailer = require("nodemailer");
const env = require("../config/env");
const logger = require("../utils/logger");
const AppError = require("../utils/AppError");

let transporter;

function getTransporter() {
  transporter ??= nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user: env.email.user, pass: env.email.password },
  });
  return transporter;
}

function isConfigured() {
  return Boolean(env.email.user && env.email.password);
}

async function sendEmail(to, subject, html) {
  if (env.emailMode === "console") {
    logger.warn({ to, subject }, "EMAIL_MODE=console: email not sent");
    return;
  }

  try {
    if (!isConfigured()) throw new Error("GMAIL_USER / GMAIL_APP_PASSWORD are not set");

    await getTransporter().sendMail({
      from: `"Cedar Roots" <${env.email.user}>`,
      to,
      subject,
      html,
    });
  } catch (err) {
    logger.error(
      { code: err.code, response: err.response, message: err.message },
      "Could not send email"
    );
    const failure = new AppError(
      502,
      "We couldn't send the verification email. Please try again later."
    );
    failure.cause = err;
    throw failure;
  }
}

module.exports = { sendEmail, isConfigured };
