const sgMail = require("@sendgrid/mail");
const env = require("../config/env");
const logger = require("../utils/logger");

if (env.sendgrid.apiKey) sgMail.setApiKey(env.sendgrid.apiKey);

async function sendEmail(to, subject, html) {
  try {
    await sgMail.send({
      to,
      from: { email: env.sendgrid.fromEmail, name: "Cedar Roots" },
      subject,
      html,
    });
  } catch (err) {
    logger.error({ err: err.response?.body || err.message }, "SendGrid error");
    throw new Error("Failed to send verification email.", { cause: err });
  }
}

module.exports = { sendEmail };
