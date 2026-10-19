jest.mock("nodemailer", () => {
  const sendMail = jest.fn();
  return { createTransport: jest.fn(() => ({ sendMail })), __sendMail: sendMail };
});

const nodemailer = require("nodemailer");
const env = require("../src/config/env");
const { sendEmail, isConfigured } = require("../src/services/email");

const sendMail = nodemailer.__sendMail;

beforeEach(() => {
  sendMail.mockReset();
  env.emailMode = "smtp";
  env.email.user = "cedar@example.com";
  env.email.password = "abcdabcdabcdabcd";
});

test("sends through Gmail SMTP from the configured account", async () => {
  sendMail.mockResolvedValue({});

  await sendEmail("to@example.com", "Hi", "<p>x</p>");

  expect(nodemailer.createTransport).toHaveBeenCalledWith(
    expect.objectContaining({
      host: "smtp.gmail.com",
      secure: true,
      auth: { user: "cedar@example.com", pass: "abcdabcdabcdabcd" },
    })
  );
  expect(sendMail).toHaveBeenCalledWith(
    expect.objectContaining({
      from: '"Cedar Roots" <cedar@example.com>',
      to: "to@example.com",
      subject: "Hi",
    })
  );
});

test("console mode never touches the mail server", async () => {
  env.emailMode = "console";

  await sendEmail("to@example.com", "Hi", "<p>x</p>");

  expect(sendMail).not.toHaveBeenCalled();
});

test("a rejected login becomes a 502 with a safe message", async () => {
  sendMail.mockRejectedValue(Object.assign(new Error("Invalid login"), { code: "EAUTH" }));

  await expect(sendEmail("to@example.com", "Hi", "<p>x</p>")).rejects.toMatchObject({
    status: 502,
    message: expect.stringContaining("couldn't send"),
  });
});

test("missing credentials fail the same way instead of crashing", async () => {
  env.email.user = undefined;

  expect(isConfigured()).toBe(false);
  await expect(sendEmail("to@example.com", "Hi", "<p>x</p>")).rejects.toMatchObject({
    status: 502,
  });
  expect(sendMail).not.toHaveBeenCalled();
});
