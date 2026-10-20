const request = require("supertest");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

jest.mock("../src/models", () => ({
  User: { findOne: jest.fn(), create: jest.fn() },
  UserVerification: {
    create: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    destroy: jest.fn(),
  },
}));
jest.mock("../src/services/email", () => ({ sendEmail: jest.fn() }));

const { User, UserVerification } = require("../src/models");
const { sendEmail } = require("../src/services/email");
const app = require("../src/app");
const env = require("../src/config/env");
const AppError = require("../src/utils/AppError");

const tokenFor = (id) => jwt.sign({ id }, env.jwt.secret);

beforeEach(() => jest.clearAllMocks());

describe("authentication", () => {
  test.each([
    ["get", "/users/1"],
    ["put", "/users/1"],
    ["delete", "/users/1"],
    ["post", "/upload"],
    ["post", "/organization_members"],
    ["post", "/announcements"],
  ])("%s %s requires a token", async (method, path) => {
    const res = await request(app)[method](path);
    expect(res.status).toBe(401);
  });

  test("rejects an invalid token with 401", async () => {
    const res = await request(app).get("/users/1").set("Authorization", "Bearer nope");
    expect(res.status).toBe(401);
  });

  test("rejects an expired token with 401", async () => {
    const expired = jwt.sign({ id: 1 }, env.jwt.secret, { expiresIn: -10 });
    const res = await request(app).get("/users/1").set("Authorization", `Bearer ${expired}`);
    expect(res.status).toBe(401);
  });
});

describe("validation and error shape", () => {
  test("returns 400 with error and message keys", async () => {
    const res = await request(app).post("/auth/login").send({ email: "not-an-email" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeTruthy();
    expect(res.body.message).toBe(res.body.error);
  });

  test("unknown routes return JSON 404", async () => {
    const res = await request(app).get("/nope");
    expect(res.status).toBe(404);
    expect(res.body.error).toBeTruthy();
  });

  test("ownership check returns 403 when editing another user", async () => {
    const res = await request(app)
      .put("/users/2")
      .set("Authorization", `Bearer ${tokenFor(1)}`)
      .send({ name: "Mallory" });
    expect(res.status).toBe(403);
  });
});

describe("auth flow", () => {
  test("signup does not leak the password hash or a token", async () => {
    User.findOne.mockResolvedValue(null);
    User.create.mockImplementation(async (fields) => ({
      id: 7,
      created_at: new Date(),
      ...fields,
    }));

    const res = await request(app)
      .post("/auth/signup")
      .send({ email: "A@Example.com", password: "secret123", name: "ada lovelace" });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toMatch(/password/);
    expect(res.body.user).toMatchObject({ id: 7, email: "a@example.com", name: "Ada Lovelace" });
  });

  test("when the verification email fails, signup is undone and the error is clear", async () => {
    const destroy = jest.fn();
    User.findOne.mockResolvedValue(null);
    User.create.mockImplementation(async (fields) => ({ id: 9, destroy, ...fields }));
    sendEmail.mockRejectedValueOnce(
      new AppError(502, "We couldn't send the verification email. Please try again later.")
    );

    const res = await request(app)
      .post("/auth/signup")
      .send({ email: "new@example.com", password: "secret123", name: "New Person" });

    expect(res.status).toBe(502);
    expect(res.body.error).toMatch(/couldn't send the verification email/);
    expect(destroy).toHaveBeenCalled();
    expect(UserVerification.destroy).toHaveBeenCalledWith({ where: { user_id: 9 } });
  });

  test("login gives the same 401 for unknown email and wrong password", async () => {
    User.findOne.mockResolvedValueOnce(null);
    const unknown = await request(app)
      .post("/auth/login")
      .send({ email: "ghost@example.com", password: "whatever" });

    User.findOne.mockResolvedValueOnce({ id: 1, password_hash: await bcrypt.hash("right", 4) });
    const wrong = await request(app)
      .post("/auth/login")
      .send({ email: "real@example.com", password: "wrong" });

    expect(unknown.status).toBe(401);
    expect(wrong.status).toBe(401);
    expect(unknown.body.error).toBe(wrong.body.error);
  });

  test("login returns an expiring token and no password hash", async () => {
    const user = {
      id: 1,
      email: "real@example.com",
      password_hash: await bcrypt.hash("right", 4),
      get: () => ({ id: 1, email: "real@example.com", password_hash: "x" }),
    };
    User.findOne.mockResolvedValue(user);
    UserVerification.findOne.mockResolvedValue({ status: "verified" });

    const res = await request(app)
      .post("/auth/login")
      .send({ email: "real@example.com", password: "right" });

    expect(res.status).toBe(200);
    expect(res.body.user.password_hash).toBeUndefined();
    expect(jwt.decode(res.body.token).exp).toBeDefined();
  });
});

describe("resend verification code", () => {
  const send = (email) => request(app).post("/auth/resend").send({ email });

  test("sends a fresh code to an unverified account and expires the old one", async () => {
    User.findOne.mockResolvedValue({ id: 3, email: "a@example.com", name: "Ada" });
    UserVerification.findOne.mockResolvedValue(null);

    const res = await send("a@example.com");

    expect(res.status).toBe(200);
    expect(UserVerification.update).toHaveBeenCalledWith(
      { status: "expired" },
      { where: { user_id: 3, status: "pending" } }
    );
    expect(UserVerification.create).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 3, status: "pending" })
    );
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  test("answers identically for unknown and already verified accounts, sending nothing", async () => {
    User.findOne.mockResolvedValueOnce(null);
    const unknown = await send("ghost@example.com");

    User.findOne.mockResolvedValueOnce({ id: 4, email: "v@example.com", name: "V" });
    UserVerification.findOne.mockResolvedValueOnce({ status: "verified" });
    const verified = await send("v@example.com");

    expect(unknown.status).toBe(200);
    expect(verified.body).toEqual(unknown.body);
    expect(sendEmail).not.toHaveBeenCalled();
  });
});
