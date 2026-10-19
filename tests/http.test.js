const request = require("supertest");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

jest.mock("../src/models", () => ({
  User: { findOne: jest.fn(), create: jest.fn() },
  UserVerification: { create: jest.fn(), findOne: jest.fn() },
}));
jest.mock("../src/services/email", () => ({ sendEmail: jest.fn() }));

const { User, UserVerification } = require("../src/models");
const app = require("../src/app");
const env = require("../src/config/env");

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
