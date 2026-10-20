jest.mock("../src/models", () => {
  const model = () => ({
    findAll: jest.fn(),
    findOne: jest.fn(),
    findByPk: jest.fn(),
    findOrCreate: jest.fn(),
    create: jest.fn(),
    destroy: jest.fn(),
    update: jest.fn(),
    upsert: jest.fn(),
  });
  return {
    Story: model(),
    StoryView: model(),
    SavedPost: model(),
    Post: model(),
    User: model(),
    Connection: model(),
    Message: model(),
    UserPreference: model(),
    UserPresence: model(),
    EventReminder: model(),
    EmailChange: model(),
    Event: model(),
    EventParticipant: model(),
    FirebaseToken: model(),
    Notification: model(),
    UserVerification: model(),
  };
});
jest.mock("../src/sockets/realtime", () => ({
  emitToUser: jest.fn(),
  emitToAll: jest.fn(),
  userRoom: (id) => `user:${id}`,
}));
jest.mock("../src/services/imageBlob", () => ({
  attachBlob: jest.fn(),
  getBlob: jest.fn().mockResolvedValue(null),
}));
jest.mock("../src/services/notification", () => ({ notifyUser: jest.fn() }));
jest.mock("../src/services/email", () => ({ sendEmail: jest.fn() }));
jest.mock("../src/config/firebase", () => ({
  isEnabled: () => true,
  messaging: () => ({ send: jest.fn().mockResolvedValue("ok") }),
}));

const bcrypt = require("bcryptjs");
const models = require("../src/models");
const realtime = require("../src/sockets/realtime");
const { notifyUser } = require("../src/services/notification");
const { sendEmail } = require("../src/services/email");
const story = require("../src/services/story");
const savedPost = require("../src/services/savedPost");
const preference = require("../src/services/preference");
const reminder = require("../src/services/reminder");
const presence = require("../src/services/presence");
const messageService = require("../src/services/message");
const auth = require("../src/services/auth");
const push = require("../src/services/push");
const storyValidators = require("../src/validators/story");

const accepted = (a, b) => ({ sender_id: a, receiver_id: b, status: "accepted" });
const plain = (obj) => ({ ...obj, toJSON: () => obj });

beforeEach(() => {
  jest.clearAllMocks();
  presence.reset();
});

describe("stories", () => {
  test("a photo story needs an image and a text story needs text", async () => {
    await expect(story.create(1, { type: "image" })).rejects.toMatchObject({ status: 400 });
    await expect(story.create(1, { type: "text", text: "" })).rejects.toMatchObject({
      status: 400,
    });
  });

  test("a new story lasts 24 hours and tells the author's connections", async () => {
    models.Connection.findAll.mockResolvedValue([accepted(1, 2), accepted(3, 1)]);
    models.Story.create.mockImplementation(async (row) => ({ id: 9, ...row }));

    const created = await story.create(1, { type: "text", text: "hi", bg: 2 });

    expect(created.expires_at.getTime() - created.created_at.getTime()).toBe(story.TTL_MS);
    expect(created.image_url).toBeNull();
    const told = realtime.emitToUser.mock.calls.map((c) => c[0]).sort();
    expect(told).toEqual([1, 2, 3]);
    expect(realtime.emitToUser).toHaveBeenCalledWith(2, "stories_changed", { userId: 1 });
  });

  test("the feed shows mine first, then unseen, with view counts only on mine", async () => {
    models.Connection.findAll.mockResolvedValue([accepted(1, 2), accepted(1, 3)]);
    const now = Date.now();
    const user = (id) => ({ toJSON: () => ({ id, name: `U${id}`, profile_pic: null }) });
    const row = (id, userId, minutesAgo) => ({
      id,
      user_id: userId,
      type: "text",
      text: "x",
      bg: 0,
      created_at: new Date(now - minutesAgo * 60000),
      expires_at: new Date(now + 3600000),
      User: user(userId),
    });
    models.Story.findAll.mockResolvedValue([
      row(10, 2, 30),
      row(11, 3, 20),
      row(12, 1, 50),
    ]);
    // I have seen story 10 (user 2) but not 11 (user 3).
    models.StoryView.findAll
      .mockResolvedValueOnce([{ story_id: 10 }])
      .mockResolvedValueOnce([{ story_id: 12 }, { story_id: 12 }]);

    const feed = await story.feed(1);

    expect(feed.map((g) => g.user.id)).toEqual([1, 3, 2]);
    expect(feed[0].stories[0].view_count).toBe(2);
    expect(feed[0].all_seen).toBe(true);
    expect(feed[1].all_seen).toBe(false);
    expect(feed[2].all_seen).toBe(true);
    expect(feed[1].stories[0]).not.toHaveProperty("view_count");
  });

  test("an empty feed is an empty list", async () => {
    models.Connection.findAll.mockResolvedValue([]);
    models.Story.findAll.mockResolvedValue([]);
    expect(await story.feed(1)).toEqual([]);
  });

  test("viewing needs a live story and a connection, and is recorded once", async () => {
    models.Story.findByPk.mockResolvedValue(null);
    await expect(story.view(2, 5)).rejects.toMatchObject({ status: 404 });

    models.Story.findByPk.mockResolvedValue({
      id: 5,
      user_id: 1,
      expires_at: new Date(Date.now() - 1000),
    });
    await expect(story.view(2, 5)).rejects.toMatchObject({ status: 404 });

    models.Story.findByPk.mockResolvedValue({
      id: 5,
      user_id: 1,
      expires_at: new Date(Date.now() + 100000),
    });
    models.Connection.findOne.mockResolvedValue(null);
    await expect(story.view(2, 5)).rejects.toMatchObject({ status: 403 });

    models.Connection.findOne.mockResolvedValue(accepted(1, 2));
    models.StoryView.findOrCreate.mockResolvedValue([{}, true]);
    await story.view(2, 5);
    expect(realtime.emitToUser).toHaveBeenCalledWith(1, "story_viewed", {
      storyId: 5,
      viewerId: 2,
    });

    realtime.emitToUser.mockClear();
    models.StoryView.findOrCreate.mockResolvedValue([{}, false]);
    await story.view(2, 5);
    expect(realtime.emitToUser).not.toHaveBeenCalled();
  });

  test("watching your own story is not recorded", async () => {
    models.Story.findByPk.mockResolvedValue({
      id: 5,
      user_id: 1,
      expires_at: new Date(Date.now() + 100000),
    });
    expect(await story.view(1, 5)).toEqual({ viewed: false });
    expect(models.StoryView.findOrCreate).not.toHaveBeenCalled();
  });

  test("only the author sees who viewed", async () => {
    models.Story.findByPk.mockResolvedValue({ id: 5, user_id: 1 });
    await expect(story.viewers(2, 5)).rejects.toMatchObject({ status: 403 });

    models.StoryView.findAll.mockResolvedValue([
      { viewed_at: new Date(), Viewer: plain({ id: 2, name: "Karim", profile_pic: null }) },
    ]);
    const viewers = await story.viewers(1, 5);
    expect(viewers).toHaveLength(1);
    expect(viewers[0].user.name).toBe("Karim");
  });

  test("only the author can delete a story", async () => {
    models.Story.findByPk.mockResolvedValue({ id: 5, user_id: 1, destroy: jest.fn() });
    await expect(story.remove(2, 5)).rejects.toMatchObject({ status: 403 });
  });

  test("expired stories are purged with their views", async () => {
    models.Story.findAll.mockResolvedValue([
      { id: 1, image_url: null },
      { id: 2, image_url: null },
    ]);
    expect(await story.purgeExpired()).toBe(2);
    expect(models.StoryView.destroy).toHaveBeenCalledWith({ where: { story_id: [1, 2] } });
    expect(models.Story.destroy).toHaveBeenCalledWith({ where: { id: [1, 2] } });
  });

  test("the body schema defaults bg and limits text", () => {
    expect(storyValidators.create.parse({ type: "text", text: "hi" }).bg).toBe(0);
    expect(() => storyValidators.create.parse({ type: "text", text: "x".repeat(281) })).toThrow();
    expect(() => storyValidators.create.parse({ type: "video" })).toThrow();
  });
});

describe("saved posts", () => {
  test("toggling saves, then un-saves", async () => {
    models.Post.findByPk.mockResolvedValue({ id: 7 });
    models.SavedPost.findOne.mockResolvedValueOnce(null);
    expect(await savedPost.toggle(1, 7)).toEqual({ saved: true });
    expect(models.SavedPost.create).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 1, post_id: 7 })
    );

    const destroy = jest.fn();
    models.SavedPost.findOne.mockResolvedValueOnce({ destroy });
    expect(await savedPost.toggle(1, 7)).toEqual({ saved: false });
    expect(destroy).toHaveBeenCalled();
  });

  test("a missing post cannot be saved", async () => {
    models.Post.findByPk.mockResolvedValue(null);
    await expect(savedPost.toggle(1, 7)).rejects.toMatchObject({ status: 404 });
  });

  test("lists the ids newest first", async () => {
    models.SavedPost.findAll.mockResolvedValue([{ post_id: 9 }, { post_id: 4 }]);
    expect(await savedPost.ids(1)).toEqual([9, 4]);
  });
});

describe("notification preferences", () => {
  test("default to everything on", async () => {
    models.UserPreference.findByPk.mockResolvedValue(null);
    expect(await preference.get(1)).toEqual({ push_enabled: true, event_reminders: true });
  });

  test("an update changes only what was sent", async () => {
    models.UserPreference.findByPk.mockResolvedValue({ push_enabled: true, event_reminders: true });
    const next = await preference.update(1, { event_reminders: false });
    expect(next).toEqual({ push_enabled: true, event_reminders: false });
    expect(models.UserPreference.upsert).toHaveBeenCalledWith({
      user_id: 1,
      push_enabled: true,
      event_reminders: false,
    });
  });

  test("turning push off stops pushes but nothing else", async () => {
    models.UserPreference.findByPk.mockResolvedValue({ push_enabled: false, event_reminders: true });
    await push.sendToUser(1, { title: "t", body: "b" });
    expect(models.FirebaseToken.findAll).not.toHaveBeenCalled();
  });

  test("pushes are sent when push is on", async () => {
    models.UserPreference.findByPk.mockResolvedValue(null);
    models.FirebaseToken.findAll.mockResolvedValue([]);
    await push.sendToUser(1, { title: "t", body: "b" });
    expect(models.FirebaseToken.findAll).toHaveBeenCalled();
  });
});

describe("event reminders", () => {
  const now = new Date("2026-10-20T08:00:00Z");
  const event = { id: 3, title: "Cedar planting", date_time: new Date("2026-10-20T20:00:00Z") };

  test("sends one reminder per joined participant and records it", async () => {
    models.Event.findAll.mockResolvedValue([event]);
    models.EventParticipant.findAll.mockResolvedValue([
      { event_id: 3, user_id: 1 },
      { event_id: 3, user_id: 2 },
    ]);
    models.EventReminder.findAll.mockResolvedValue([{ event_id: 3, user_id: 2 }]);
    models.UserPreference.findByPk.mockResolvedValue(null);

    expect(await reminder.sendDueReminders(now)).toBe(1);
    expect(notifyUser).toHaveBeenCalledTimes(1);
    expect(notifyUser).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 1,
        type: "event_reminder",
        body: "Cedar planting starts in 12 hours.",
        data: { eventId: 3 },
      })
    );
    expect(models.EventReminder.create).toHaveBeenCalledTimes(1);
  });

  test("skips people who turned reminders off, but never retries them", async () => {
    models.Event.findAll.mockResolvedValue([event]);
    models.EventParticipant.findAll.mockResolvedValue([{ event_id: 3, user_id: 1 }]);
    models.EventReminder.findAll.mockResolvedValue([]);
    models.UserPreference.findByPk.mockResolvedValue({ push_enabled: true, event_reminders: false });

    expect(await reminder.sendDueReminders(now)).toBe(0);
    expect(notifyUser).not.toHaveBeenCalled();
    expect(models.EventReminder.create).toHaveBeenCalledTimes(1);
  });

  test("does nothing when no event is coming up", async () => {
    models.Event.findAll.mockResolvedValue([]);
    expect(await reminder.sendDueReminders(now)).toBe(0);
  });
});

describe("presence", () => {
  test("is online while any socket is open and announces only the first and last", async () => {
    models.Connection.findAll.mockResolvedValue([accepted(1, 2)]);

    await presence.connected(1);
    await presence.connected(1);
    expect(presence.isOnline(1)).toBe(true);
    expect(realtime.emitToUser).toHaveBeenCalledTimes(1);
    expect(realtime.emitToUser).toHaveBeenCalledWith(2, "presence_changed", {
      userId: 1,
      online: true,
      last_seen_at: null,
    });

    realtime.emitToUser.mockClear();
    await presence.disconnected(1);
    expect(presence.isOnline(1)).toBe(true);
    expect(realtime.emitToUser).not.toHaveBeenCalled();

    await presence.disconnected(1);
    expect(presence.isOnline(1)).toBe(false);
    expect(models.UserPresence.upsert).toHaveBeenCalled();
    expect(realtime.emitToUser).toHaveBeenCalledWith(
      2,
      "presence_changed",
      expect.objectContaining({ userId: 1, online: false })
    );
  });

  test("only connections can see someone's status", async () => {
    models.Connection.findOne.mockResolvedValue(null);
    await expect(presence.statusFor(2, 1)).rejects.toMatchObject({ status: 403 });

    models.Connection.findOne.mockResolvedValue(accepted(1, 2));
    models.UserPresence.findByPk.mockResolvedValue({ last_seen_at: new Date("2026-10-20T01:00:00Z") });
    const status = await presence.statusFor(2, 1);
    expect(status.online).toBe(false);
    expect(status.last_seen_at).toEqual(new Date("2026-10-20T01:00:00Z"));
  });
});

describe("sharing a post in chat", () => {
  test("the shared post must exist", async () => {
    models.User.findByPk.mockResolvedValue({ id: 1, name: "A" });
    models.Post.findByPk.mockResolvedValue(null);
    await expect(
      messageService.send({ senderId: 1, receiverId: 2, content: "99", type: "post" })
    ).rejects.toMatchObject({ status: 404 });
  });

  test("a post share is stored as a message of type post", async () => {
    models.User.findByPk.mockResolvedValue({ id: 1, name: "A" });
    models.Post.findByPk.mockResolvedValue({ id: 99 });
    models.Message.create.mockImplementation(async (row) => ({ id: 1, ...row }));
    models.UserPreference.findByPk.mockResolvedValue(null);
    models.FirebaseToken.findAll.mockResolvedValue([]);

    const message = await messageService.send({
      senderId: 1,
      receiverId: 2,
      content: "99",
      type: "post",
    });
    expect(message.type).toBe("post");
    expect(realtime.emitToUser).toHaveBeenCalledWith(2, "receive_message", message);
  });
});

describe("changing password and email", () => {
  const user = async (extra = {}) => ({
    id: 1,
    name: "Mo",
    email: "mo@example.com",
    password_hash: await bcrypt.hash("old-pass", 4),
    save: jest.fn(),
    ...extra,
  });

  test("the current password must be right", async () => {
    models.User.findByPk.mockResolvedValue(await user());
    await expect(
      auth.changePassword(1, { current_password: "wrong", new_password: "new-pass" })
    ).rejects.toMatchObject({ status: 403 });
  });

  test("a correct current password sets the new one", async () => {
    const u = await user();
    models.User.findByPk.mockResolvedValue(u);
    await auth.changePassword(1, { current_password: "old-pass", new_password: "new-pass" });
    expect(await bcrypt.compare("new-pass", u.password_hash)).toBe(true);
    expect(u.save).toHaveBeenCalled();
  });

  test("an email change emails a code to the NEW address after checking the password", async () => {
    models.User.findByPk.mockResolvedValue(await user());
    models.User.findOne.mockResolvedValue(null);

    await auth.startEmailChange(1, { new_email: "new@example.com", password: "old-pass" });

    expect(models.EmailChange.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 1, new_email: "new@example.com" })
    );
    expect(sendEmail).toHaveBeenCalledWith(
      "new@example.com",
      expect.any(String),
      expect.stringContaining("code")
    );
  });

  test("an email that is already used is refused", async () => {
    models.User.findByPk.mockResolvedValue(await user());
    models.User.findOne.mockResolvedValue({ id: 5 });
    await expect(
      auth.startEmailChange(1, { new_email: "taken@example.com", password: "old-pass" })
    ).rejects.toMatchObject({ status: 400 });
  });

  test("the code confirms the change; a wrong or expired one does not", async () => {
    models.EmailChange.findByPk.mockResolvedValue(null);
    await expect(auth.confirmEmailChange(1, { code: "1234" })).rejects.toMatchObject({ status: 400 });

    const destroy = jest.fn();
    models.EmailChange.findByPk.mockResolvedValue({
      code: "1234",
      new_email: "new@example.com",
      expires_at: new Date(Date.now() - 1000),
      destroy,
    });
    await expect(auth.confirmEmailChange(1, { code: "1234" })).rejects.toMatchObject({
      status: 400,
    });

    models.EmailChange.findByPk.mockResolvedValue({
      code: "1234",
      new_email: "new@example.com",
      expires_at: new Date(Date.now() + 100000),
      destroy,
    });
    models.User.findOne.mockResolvedValue(null);
    const result = await auth.confirmEmailChange(1, { code: "1234" });
    expect(result.email).toBe("new@example.com");
    expect(models.User.update).toHaveBeenCalledWith(
      expect.objectContaining({ email: "new@example.com" }),
      { where: { id: 1 } }
    );
    expect(destroy).toHaveBeenCalled();
  });
});
