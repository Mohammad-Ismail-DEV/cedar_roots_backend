const request = require("supertest");
const jwt = require("jsonwebtoken");

jest.mock("../src/models", () => ({
  User: { findByPk: jest.fn(), update: jest.fn(), findAll: jest.fn() },
  UserPreference: { findByPk: jest.fn(), upsert: jest.fn() },
  UserPresence: { findByPk: jest.fn() },
  Connection: { findAll: jest.fn(), findOne: jest.fn() },
  Story: { findAll: jest.fn(), findByPk: jest.fn(), create: jest.fn() },
  StoryView: { findAll: jest.fn() },
  SavedPost: { findAll: jest.fn(), findOne: jest.fn() },
  Post: { findByPk: jest.fn(), findAll: jest.fn() },
}));
jest.mock("../src/services/imageBlob", () => ({
  attachBlob: jest.fn(),
  getBlob: jest.fn().mockResolvedValue(null),
}));

const models = require("../src/models");
const app = require("../src/app");
const env = require("../src/config/env");
const userService = require("../src/services/user");

const tokenFor = (id) => jwt.sign({ id }, env.jwt.secret);
const authed = (req, id = 1) => req.set("Authorization", `Bearer ${tokenFor(id)}`);

beforeEach(() => jest.clearAllMocks());

describe("profile", () => {
  const row = { id: 1, name: "Mo", profile_pic: null, bio: "Hi there", location: "Bcharre" };

  test("a profile includes the bio and location", async () => {
    models.User.findByPk.mockResolvedValue(row);
    expect(await userService.getById(1)).toMatchObject({ bio: "Hi there", location: "Bcharre" });
  });

  test("a profile without them returns null, not undefined", async () => {
    models.User.findByPk.mockResolvedValue({ id: 2, name: "A", profile_pic: null });
    expect(await userService.getById(2)).toMatchObject({ bio: null, location: null });
  });

  test("editing returns the saved profile with bio and location", async () => {
    models.User.update.mockResolvedValue([1]);
    models.User.findByPk.mockResolvedValue({ ...row, bio: "New bio" });
    const saved = await userService.update(1, 1, { bio: "New bio" });
    expect(saved.bio).toBe("New bio");
    expect(models.User.update).toHaveBeenCalledWith(
      expect.objectContaining({ bio: "New bio" }),
      { where: { id: 1 } }
    );
  });

  test("you cannot edit someone else", async () => {
    await expect(userService.update(1, 2, { bio: "x" })).rejects.toMatchObject({ status: 403 });
  });

  test("PUT /users/:id saves bio and location over HTTP", async () => {
    models.User.update.mockResolvedValue([1]);
    models.User.findByPk.mockResolvedValue({ ...row, location: "Beirut" });
    const res = await authed(request(app).put("/users/1")).send({
      name: "Mo",
      bio: "Hi there",
      location: "Beirut",
    });
    expect(res.status).toBe(200);
    expect(res.body.location).toBe("Beirut");
  });
});

describe("new endpoints require a token", () => {
  test.each([
    ["get", "/stories"],
    ["post", "/stories"],
    ["post", "/stories/1/view"],
    ["get", "/stories/1/viewers"],
    ["delete", "/stories/1"],
    ["get", "/posts/saved"],
    ["get", "/posts/saved/ids"],
    ["post", "/posts/1/save"],
    ["get", "/users/me/preferences"],
    ["put", "/users/me/preferences"],
    ["get", "/users/1/presence"],
    ["post", "/auth/change-password"],
    ["post", "/auth/email-change"],
    ["post", "/auth/email-change/confirm"],
  ])("%s %s", async (method, path) => {
    const res = await request(app)[method](path);
    expect(res.status).toBe(401);
  });
});

describe("validation", () => {
  test("a story needs a known type", async () => {
    const res = await authed(request(app).post("/stories")).send({ type: "video" });
    expect(res.status).toBe(400);
  });

  test("a photo story without an image is refused", async () => {
    const res = await authed(request(app).post("/stories")).send({ type: "image" });
    expect(res.status).toBe(400);
  });

  test("preferences must be booleans and not empty", async () => {
    expect((await authed(request(app).put("/users/me/preferences")).send({})).status).toBe(400);
    expect(
      (await authed(request(app).put("/users/me/preferences")).send({ push_enabled: "yes" })).status
    ).toBe(400);
  });

  test("preferences round-trip", async () => {
    models.UserPreference.findByPk.mockResolvedValue(null);
    const res = await authed(request(app).put("/users/me/preferences")).send({
      event_reminders: false,
    });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ push_enabled: true, event_reminders: false });
  });

  test("a new password must be at least 6 characters", async () => {
    const res = await authed(request(app).post("/auth/change-password")).send({
      current_password: "old-pass",
      new_password: "123",
    });
    expect(res.status).toBe(400);
  });

  test("the email-change code must be 4 digits", async () => {
    const res = await authed(request(app).post("/auth/email-change/confirm")).send({ code: "12" });
    expect(res.status).toBe(400);
  });
});
