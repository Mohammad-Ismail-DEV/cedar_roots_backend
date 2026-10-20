// Live check of stories, saved posts, preferences, presence, post sharing, reminders, profile
// editing and account changes against a running server and the dev DB. Creates throwaway users
// and removes them afterwards. Usage: SMOKE_URL=http://localhost:3000 npm run smoke:features
const BASE = process.env.SMOKE_URL || "http://localhost:3000";
const { io } = require("socket.io-client");
const bcrypt = require("bcryptjs");
const { Op } = require("sequelize");
const db = require("../src/models");
const storyService = require("../src/services/story");
const reminderService = require("../src/services/reminder");

const results = [];
const check = (name, ok, extra = "") => {
  results.push({ name, ok: !!ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : "  -> " + extra}`);
};

async function api(method, path, { token, body } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers["Content-Type"] = "application/json";
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    /* empty body */
  }
  return { status: res.status, body: json };
}

const once = (socket, event, ms = 4000) =>
  new Promise((resolve) => {
    const t = setTimeout(() => resolve(null), ms);
    socket.once(event, (d) => {
      clearTimeout(t);
      resolve(d ?? true);
    });
  });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const connect = (token) =>
  new Promise((resolve) => {
    const s = io(BASE, { auth: { token }, transports: ["websocket"], forceNew: true });
    s.on("connect", () => resolve(s));
  });

const created = { users: [], events: [], orgs: [] };

async function mkUser(tag) {
  const user = await db.User.create({
    name: `Feat ${tag}`,
    email: `feat-${Date.now()}-${tag}@example.test`,
    password_hash: await bcrypt.hash("Passw0rd!", 4),
    created_at: new Date(),
    updated_at: new Date(),
  });
  await db.UserVerification.create({
    user_id: user.id,
    verification_code: "0000",
    expires_at: new Date(Date.now() + 600000),
    status: "verified",
  });
  created.users.push(user.id);
  return user;
}

async function cleanup() {
  const ids = created.users;
  if (!ids.length) return;
  const stories = await db.Story.findAll({ where: { user_id: ids }, attributes: ["id"] });
  const posts = await db.Post.findAll({ where: { user_id: ids }, attributes: ["id"] });
  const storyIds = stories.map((s) => s.id);
  const postIds = posts.map((p) => p.id);
  await db.StoryView.destroy({ where: { [Op.or]: [{ story_id: storyIds }, { viewer_id: ids }] } });
  await db.Story.destroy({ where: { id: storyIds } });
  await db.SavedPost.destroy({ where: { [Op.or]: [{ user_id: ids }, { post_id: postIds }] } });
  await db.EventReminder.destroy({ where: { user_id: ids } });
  await db.UserPreference.destroy({ where: { user_id: ids } });
  await db.UserPresence.destroy({ where: { user_id: ids } });
  await db.EmailChange.destroy({ where: { user_id: ids } });
  await db.Message.destroy({ where: { [Op.or]: [{ sender_id: ids }, { receiver_id: ids }] } });
  await db.Notification.destroy({ where: { user_id: ids } });
  await db.Post.destroy({ where: { id: postIds } });
  await db.Connection.destroy({ where: { [Op.or]: [{ sender_id: ids }, { receiver_id: ids }] } });
  await db.EventParticipant.destroy({
    where: { [Op.or]: [{ user_id: ids }, { event_id: created.events }] },
  });
  await db.Event.destroy({ where: { id: created.events } });
  await db.OrganizationMember.destroy({ where: { organization_id: created.orgs } });
  await db.Organization.destroy({ where: { id: created.orgs } });
  await db.UserVerification.destroy({ where: { user_id: ids } });
  await db.User.destroy({ where: { id: ids } });
}

async function connectUsers(ta, A, tb, B) {
  const req = await api("POST", "/connections", { token: ta, body: { receiver_id: B.id } });
  await api("PUT", "/connections/respond", {
    token: tb,
    body: { connectionId: req.body?.id, accept: true },
  });
}

async function run() {
  const [A, B, C] = [await mkUser("a"), await mkUser("b"), await mkUser("c")];
  const login = async (u) =>
    (await api("POST", "/auth/login", { body: { email: u.email, password: "Passw0rd!" } })).body
      ?.token;
  const [ta, tb, tc] = [await login(A), await login(B), await login(C)];
  check("logged in three users", ta && tb && tc);

  // A and B are connected; C is a stranger.
  await connectUsers(ta, A, tb, B);

  // ---- profile editing
  const edited = await api("PUT", `/users/${A.id}`, {
    token: ta,
    body: { name: "Feat A2", bio: "Hello there", location: "Bcharre" },
  });
  check("edit profile returns bio and location", edited.body?.bio === "Hello there" && edited.body?.location === "Bcharre", JSON.stringify(edited));
  const fetched = await api("GET", `/users/${A.id}`, { token: tb });
  check("another user reads the bio and location", fetched.body?.bio === "Hello there" && fetched.body?.location === "Bcharre");
  check("clearing the bio works", (await api("PUT", `/users/${A.id}`, { token: ta, body: { bio: "" } })).body?.bio === "");

  // ---- change password
  const wrongPw = await api("POST", "/auth/change-password", {
    token: ta,
    body: { current_password: "nope", new_password: "Brand-new1" },
  });
  check("change password: wrong current -> 401", wrongPw.status === 401);
  const okPw = await api("POST", "/auth/change-password", {
    token: ta,
    body: { current_password: "Passw0rd!", new_password: "Brand-new1" },
  });
  check("change password works", okPw.status === 200);
  const relog = await api("POST", "/auth/login", { body: { email: A.email, password: "Brand-new1" } });
  check("login with the new password", relog.status === 200);

  // ---- change email (the emailed code is seeded directly)
  await db.EmailChange.create({
    user_id: A.id,
    new_email: `renamed-${Date.now()}@example.test`,
    code: "4321",
    expires_at: new Date(Date.now() + 600000),
  });
  check(
    "email change: wrong code -> 400",
    (await api("POST", "/auth/email-change/confirm", { token: ta, body: { code: "0000" } })).status === 400
  );
  const confirmed = await api("POST", "/auth/email-change/confirm", { token: ta, body: { code: "4321" } });
  check("email change confirmed", confirmed.status === 200 && /renamed-/.test(confirmed.body?.email || ""), JSON.stringify(confirmed));
  const reA = await api("POST", "/auth/login", { body: { email: confirmed.body?.email, password: "Brand-new1" } });
  check("login with the new email", reA.status === 200);

  // ---- stories
  const photo = await api("POST", "/stories", { token: ta, body: { type: "image" } });
  check("photo story without an image -> 400", photo.status === 400);
  const s1 = await api("POST", "/stories", { token: ta, body: { type: "text", text: "Hello cedars", bg: 3 } });
  check("create a text story", s1.status === 200 && s1.body?.id, JSON.stringify(s1));
  const expiresIn = new Date(s1.body?.expires_at) - new Date(s1.body?.created_at);
  check("a story lasts 24 hours", expiresIn === 24 * 3600 * 1000, String(expiresIn));

  const feedB = await api("GET", "/stories", { token: tb });
  const groupA = (feedB.body || []).find((g) => g.user.id === A.id);
  check("a connection sees my story in their feed", groupA && groupA.stories.length === 1 && groupA.all_seen === false, JSON.stringify(feedB.body));
  const feedC = await api("GET", "/stories", { token: tc });
  check("a stranger does not", !(feedC.body || []).some((g) => g.user.id === A.id));
  check("a stranger cannot view it", (await api("POST", `/stories/${s1.body.id}/view`, { token: tc })).status === 403);
  check("a connection can view it", (await api("POST", `/stories/${s1.body.id}/view`, { token: tb })).status === 200);
  const feedB2 = await api("GET", "/stories", { token: tb });
  check("the ring is seen after viewing", (feedB2.body || []).find((g) => g.user.id === A.id)?.all_seen === true);
  const mine = await api("GET", "/stories", { token: ta });
  check("my own story shows a view count", mine.body?.[0]?.stories?.[0]?.view_count === 1, JSON.stringify(mine.body));
  const viewers = await api("GET", `/stories/${s1.body.id}/viewers`, { token: ta });
  check("the author sees who viewed", viewers.status === 200 && viewers.body?.[0]?.user?.id === B.id, JSON.stringify(viewers));
  check("a viewer cannot list viewers", (await api("GET", `/stories/${s1.body.id}/viewers`, { token: tb })).status === 403);

  const live = once(await connect(tb), "stories_changed");
  await api("POST", "/stories", { token: ta, body: { type: "text", text: "second" } });
  check("connections hear about new stories live", (await live)?.userId === A.id);

  // expiry: age one story and purge
  await db.Story.update({ expires_at: new Date(Date.now() - 1000) }, { where: { id: s1.body.id } });
  check("an expired story drops out of the feed", !(await api("GET", "/stories", { token: tb })).body.some((g) => g.stories.some((s) => s.id === s1.body.id)));
  check("expired stories are purged", (await storyService.purgeExpired()) >= 1);
  check("purged story is gone", (await db.Story.findByPk(s1.body.id)) === null);
  const s3 = await api("POST", "/stories", { token: ta, body: { type: "text", text: "delete me" } });
  check("an author can delete a story", (await api("DELETE", `/stories/${s3.body.id}`, { token: ta })).status === 200);
  check("others cannot delete it", (await api("DELETE", `/stories/${(await api("POST", "/stories", { token: ta, body: { type: "text", text: "keep" } })).body.id}`, { token: tb })).status === 403);

  // ---- saved posts
  const post = await api("POST", "/posts", { token: ta, body: { content: "Save me" } });
  const postId = post.body?.id;
  check("create a post", post.status === 200 && postId);
  const saved1 = await api("POST", `/posts/${postId}/save`, { token: tb });
  check("save a post", saved1.body?.saved === true, JSON.stringify(saved1));
  check("saved ids list it", (await api("GET", "/posts/saved/ids", { token: tb })).body?.includes(postId));
  const savedList = await api("GET", "/posts/saved", { token: tb });
  check("saved posts list returns the post", savedList.body?.[0]?.id === postId && savedList.body[0].User);
  check("saving is per user", !(await api("GET", "/posts/saved/ids", { token: tc })).body?.includes(postId));
  check("saving again un-saves", (await api("POST", `/posts/${postId}/save`, { token: tb })).body?.saved === false);
  check("saving a missing post -> 404", (await api("POST", "/posts/999999999/save", { token: tb })).status === 404);

  // ---- preferences
  const prefs = await api("GET", "/users/me/preferences", { token: ta });
  check("preferences default to on", prefs.body?.push_enabled === true && prefs.body?.event_reminders === true);
  const off = await api("PUT", "/users/me/preferences", { token: ta, body: { event_reminders: false } });
  check("turn reminders off", off.body?.event_reminders === false && off.body?.push_enabled === true);
  check("preferences persist", (await api("GET", "/users/me/preferences", { token: ta })).body?.event_reminders === false);

  // ---- event reminders
  const org = await db.Organization.create({ name: "Feat Org", created_at: new Date(), updated_at: new Date() });
  created.orgs.push(org.id);
  const event = await db.Event.create({
    title: "Feat Event",
    organization_id: org.id,
    date_time: new Date(Date.now() + 5 * 3600 * 1000),
    created_at: new Date(),
    updated_at: new Date(),
  });
  created.events.push(event.id);
  await db.EventParticipant.bulkCreate([
    { event_id: event.id, user_id: A.id, status: "joined", role: "attendee", joined_at: new Date() },
    { event_id: event.id, user_id: B.id, status: "joined", role: "attendee", joined_at: new Date() },
  ]);
  const sent = await reminderService.sendDueReminders();
  check("a reminder goes only to people with reminders on", sent >= 1);
  const notesB = (await api("GET", "/notifications", { token: tb })).body || [];
  const notesA = (await api("GET", "/notifications", { token: ta })).body || [];
  check("B got an event reminder", notesB.some((n) => n.type === "event_reminder"));
  check("A (reminders off) did not", !notesA.some((n) => n.type === "event_reminder"));
  const again = await reminderService.sendDueReminders();
  const notesB2 = ((await api("GET", "/notifications", { token: tb })).body || []).filter((n) => n.type === "event_reminder");
  check("reminders are sent only once", notesB2.length === 1 && again === 0, `${notesB2.length}/${again}`);

  // ---- presence
  const presenceStart = once(await connect(tb), "presence_changed");
  const sa = await connect(ta);
  const online = await presenceStart;
  check("a connection is told when I come online", online?.userId === A.id && online?.online === true, JSON.stringify(online));
  const statusOnline = await api("GET", `/users/${A.id}/presence`, { token: tb });
  check("presence endpoint says online", statusOnline.body?.online === true, JSON.stringify(statusOnline));
  check("a stranger cannot read presence", (await api("GET", `/users/${A.id}/presence`, { token: tc })).status === 403);
  const offlineEvent = once(await connect(tb), "presence_changed");
  sa.close();
  const offline = await offlineEvent;
  check("they are told when I go offline", offline?.online === false && offline?.last_seen_at, JSON.stringify(offline));
  await wait(300);
  const statusOff = await api("GET", `/users/${A.id}/presence`, { token: tb });
  check("presence endpoint gives last seen", statusOff.body?.online === false && statusOff.body?.last_seen_at, JSON.stringify(statusOff));

  // ---- sharing a post in chat
  const sbSocket = await connect(tb);
  const sharedRx = once(sbSocket, "receive_message");
  const saSocket = await connect(ta);
  const savedAck = once(saSocket, "message_saved");
  saSocket.emit("send_message", { receiverId: B.id, content: String(postId), type: "post", local_id: 1 });
  check("a post share is acknowledged", (await savedAck) !== null);
  const received = await sharedRx;
  check("the receiver gets a post message", received?.type === "post" && String(received?.content) === String(postId), JSON.stringify(received));
  const failed = once(saSocket, "message_failed");
  saSocket.emit("send_message", { receiverId: B.id, content: "999999999", type: "post", local_id: 2 });
  check("sharing a missing post fails", (await failed) !== null);
  sbSocket.close();
  saSocket.close();
}

(async () => {
  try {
    await run();
  } catch (e) {
    console.log("SCRIPT ERROR", e);
    results.push({ name: "script completed", ok: false });
  } finally {
    try {
      await cleanup();
      console.log("cleanup done");
    } catch (e) {
      console.log("CLEANUP ERROR", e.message);
    }
    const failed = results.filter((r) => !r.ok);
    console.log(`\n${results.length - failed.length}/${results.length} passed`);
    await db.sequelize.close();
    process.exit(failed.length ? 1 : 0);
  }
})();
