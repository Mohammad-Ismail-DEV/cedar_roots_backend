jest.mock("../src/models", () => ({
  OrganizationMember: { findOne: jest.fn(), create: jest.fn(), destroy: jest.fn() },
  Connection: { findByPk: jest.fn(), findOne: jest.fn() },
  Like: { findOne: jest.fn(), create: jest.fn() },
  Post: { findByPk: jest.fn() },
  User: { findByPk: jest.fn() },
  Message: { findAll: jest.fn(), update: jest.fn(), findOne: jest.fn() },
  Notification: { create: jest.fn() },
  FirebaseToken: { findAll: jest.fn(), destroy: jest.fn() },
}));
jest.mock("../src/sockets/realtime", () => ({
  emitToUser: jest.fn(),
  userRoom: (id) => `user:${id}`,
}));
jest.mock("../src/services/push", () => ({ sendToUser: jest.fn() }));

const models = require("../src/models");
const realtime = require("../src/sockets/realtime");
const push = require("../src/services/push");
const memberService = require("../src/services/organizationMember");
const connectionService = require("../src/services/connection");
const likeService = require("../src/services/like");
const messageService = require("../src/services/message");
const { notifyUser } = require("../src/services/notification");

beforeEach(() => jest.clearAllMocks());

describe("organization members", () => {
  const role = (r) => models.OrganizationMember.findOne.mockResolvedValueOnce(r && { role: r });

  test("a plain member cannot add members", async () => {
    role("member");
    await expect(
      memberService.add(1, { user_id: 2, organization_id: 5, role: "member" })
    ).rejects.toMatchObject({ status: 403 });
  });

  test("a stranger cannot make themselves owner", async () => {
    role(null);
    await expect(
      memberService.add(1, { user_id: 1, organization_id: 5, role: "owner" })
    ).rejects.toMatchObject({ status: 403 });
  });

  test("an admin cannot add another admin", async () => {
    role("admin");
    await expect(
      memberService.add(1, { user_id: 2, organization_id: 5, role: "admin" })
    ).rejects.toMatchObject({ status: 403 });
  });

  test("an owner can add an admin", async () => {
    role("owner");
    role(null);
    models.OrganizationMember.create.mockResolvedValue({ id: 1 });
    await memberService.add(1, { user_id: 2, organization_id: 5, role: "admin" });
    expect(models.OrganizationMember.create).toHaveBeenCalledWith({
      user_id: 2,
      organization_id: 5,
      role: "admin",
    });
  });

  test("only the owner can change roles", async () => {
    role("admin");
    await expect(
      memberService.updateRole(1, { organization_id: 5, user_id: 2, role: "owner" })
    ).rejects.toMatchObject({ status: 403 });
  });
});

describe("connections", () => {
  test("only the receiver can respond to a request", async () => {
    models.Connection.findByPk.mockResolvedValue({ id: 9, sender_id: 1, receiver_id: 2 });
    await expect(
      connectionService.respond(1, { connectionId: 9, accept: true })
    ).rejects.toMatchObject({ status: 403 });
  });

  test("a user cannot connect with themselves", async () => {
    await expect(connectionService.request(3, 3)).rejects.toMatchObject({ status: 400 });
  });
});

describe("likes", () => {
  test("liking another user's post notifies the owner", async () => {
    models.Post.findByPk.mockResolvedValue({ id: 10, user_id: 2 });
    models.User.findByPk.mockResolvedValue({ id: 1, name: "Ada" });
    models.Like.findOne.mockResolvedValue(null);
    models.Notification.create.mockResolvedValue({});
    models.Like.create.mockResolvedValue({});

    const result = await likeService.toggle(1, 10);

    expect(result.liked).toBe(true);
    expect(models.Notification.create).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 2, type: "like" })
    );
    expect(push.sendToUser).toHaveBeenCalledWith(2, expect.objectContaining({ title: "New Like" }));
  });

  test("liking your own post does not notify", async () => {
    models.Post.findByPk.mockResolvedValue({ id: 10, user_id: 1 });
    models.User.findByPk.mockResolvedValue({ id: 1, name: "Ada" });
    models.Like.findOne.mockResolvedValue(null);

    await likeService.toggle(1, 10);
    expect(models.Notification.create).not.toHaveBeenCalled();
  });

  test("unliking removes the like", async () => {
    const destroy = jest.fn();
    models.Post.findByPk.mockResolvedValue({ id: 10, user_id: 2 });
    models.User.findByPk.mockResolvedValue({ id: 1 });
    models.Like.findOne.mockResolvedValue({ destroy });

    expect((await likeService.toggle(1, 10)).liked).toBe(false);
    expect(destroy).toHaveBeenCalled();
  });
});

describe("notifyUser", () => {
  test("stores the row with data, emits, and pushes", async () => {
    await notifyUser({ userId: 4, type: "comment", title: "T", body: "B", data: { postId: 1 } });

    expect(models.Notification.create).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 4, data: { postId: "1", notificationType: "comment" } })
    );
    expect(realtime.emitToUser).toHaveBeenCalledWith(4, "receive_notification", expect.any(Object));
    expect(push.sendToUser).toHaveBeenCalled();
  });

  test("never throws when delivery fails", async () => {
    push.sendToUser.mockRejectedValueOnce(new Error("fcm down"));
    await expect(
      notifyUser({ userId: 4, type: "like", title: "T", body: "B" })
    ).resolves.toBeUndefined();
  });
});

describe("messages", () => {
  test("markSeen flags only the author's unseen messages and tells the author", async () => {
    models.Message.findAll.mockResolvedValue([{ id: 11 }, { id: 12 }]);

    const ids = await messageService.markSeen({ readerId: 2, authorId: 1 });

    expect(ids).toEqual([11, 12]);
    expect(models.Message.update).toHaveBeenCalledWith(
      { read_status: "seen" },
      { where: { id: [11, 12] } }
    );
    expect(realtime.emitToUser).toHaveBeenCalledWith(1, "messages_seen_by_receiver", {
      senderId: 1,
      receiverId: 2,
      messageIds: [11, 12],
    });
  });

  test("markDelivered never downgrades a seen message", async () => {
    models.Message.findOne.mockResolvedValue(null);
    await messageService.markDelivered({ messageId: 5, receiverId: 2 });

    expect(models.Message.findOne).toHaveBeenCalledWith({
      where: { id: 5, receiver_id: 2, read_status: "sent" },
    });
    expect(realtime.emitToUser).not.toHaveBeenCalled();
  });
});
