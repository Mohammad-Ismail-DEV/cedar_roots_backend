// Live end-to-end check of REST + sockets against a running server and the dev DB.
// Creates throwaway users/data and removes them afterwards. Usage: SMOKE_URL=http://localhost:3999 npm run smoke
const path = require("path");
const BACKEND = path.join(__dirname, "..");
const BASE = process.env.SMOKE_URL || "http://localhost:3000";
const { io } = require("socket.io-client");
const bcrypt = require("bcryptjs");
const db = require("../src/models");

const results = [];
const check = (name, ok, extra = "") => {
  results.push({ name, ok: !!ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : "  -> " + extra}`);
};

async function api(method, path, { token, body, form, headers: extra } = {}) {
  const headers = { ...extra };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers["Content-Type"] = "application/json";
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: form ?? (body ? JSON.stringify(body) : undefined),
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    /* empty body */
  }
  return { status: res.status, body: json };
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const once = (socket, event, ms = 4000) =>
  new Promise((resolve) => {
    const t = setTimeout(() => resolve(null), ms);
    socket.once(event, (d) => {
      clearTimeout(t);
      resolve(d ?? true);
    });
  });

const created = { users: [], orgs: [] };

async function mkUser(tag) {
  const stamp = Date.now();
  const user = await db.User.create({
    name: `Smoke ${tag}`,
    email: `smoke-${stamp}-${tag}@example.test`,
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
  const { Op } = require("sequelize");
  const m = db;
  const posts = await m.Post.findAll({ where: { user_id: ids }, attributes: ["id"] });
  const postIds = posts.map((p) => p.id);
  const events = await m.Event.findAll({
    where: { organization_id: created.orgs },
    attributes: ["id"],
  });
  const eventIds = events.map((e) => e.id);
  await m.Message.destroy({ where: { [Op.or]: [{ sender_id: ids }, { receiver_id: ids }] } });
  await m.Notification.destroy({ where: { user_id: ids } });
  await m.FirebaseToken.destroy({ where: { user_id: ids } });
  await m.SearchHistory.destroy({ where: { user_id: ids } });
  await m.Like.destroy({ where: { [Op.or]: [{ user_id: ids }, { post_id: postIds }] } });
  await m.Comment.destroy({ where: { [Op.or]: [{ user_id: ids }, { post_id: postIds }] } });
  await m.Post.destroy({ where: { id: postIds } });
  await m.Connection.destroy({ where: { [Op.or]: [{ sender_id: ids }, { receiver_id: ids }] } });
  await m.Announcement.destroy({ where: { event_id: eventIds } });
  await m.EventParticipant.destroy({
    where: { [Op.or]: [{ user_id: ids }, { event_id: eventIds }] },
  });
  await m.Event.destroy({ where: { id: eventIds } });
  await m.OrganizationMember.destroy({
    where: { [Op.or]: [{ user_id: ids }, { organization_id: created.orgs }] },
  });
  await m.OrganizationFollower.destroy({
    where: { [Op.or]: [{ user_id: ids }, { organization_id: created.orgs }] },
  });
  await m.Organization.destroy({ where: { id: created.orgs } });
  await m.UserVerification.destroy({ where: { user_id: ids } });
  await m.User.destroy({ where: { id: ids } });
}

async function notificationsFor(token, type) {
  const r = await api("GET", "/notifications", { token });
  return (r.body || []).filter((n) => n.type === type);
}

async function run() {
  const [A, B, C] = [await mkUser("a"), await mkUser("b"), await mkUser("c")];
  const login = async (u) =>
    await api("POST", "/auth/login", { body: { email: u.email, password: "Passw0rd!" } });

  // ---- auth
  const la = await login(A);
  const lb = await login(B);
  const lc = await login(C);
  const [ta, tb, tc] = [la.body?.token, lb.body?.token, lc.body?.token];
  check("login ok with token", la.status === 200 && ta);
  check("login hides password_hash", la.body?.user && la.body.user.password_hash === undefined);
  const bad = await api("POST", "/auth/login", { body: { email: A.email, password: "nope" } });
  check("wrong password -> 401", bad.status === 401, JSON.stringify(bad));
  const ghost = await api("POST", "/auth/login", {
    body: { email: "ghost@example.test", password: "nope" },
  });
  check(
    "unknown email -> same 401 message",
    ghost.status === 401 && ghost.body.error === bad.body.error
  );
  check("no token -> 401", (await api("GET", `/users/${A.id}`)).status === 401);

  // ---- users
  check(
    "edit other user -> 403",
    (await api("PUT", `/users/${B.id}`, { token: ta, body: { name: "Hax" } })).status === 403
  );
  check(
    "delete other user -> 403",
    (await api("DELETE", `/users/${B.id}`, { token: ta })).status === 403
  );
  const own = await api("PUT", `/users/${A.id}`, {
    token: ta,
    body: { bio: "hi", password_hash: "x" },
  });
  check("edit own profile -> 200", own.status === 200, JSON.stringify(own));
  const a2 = await db.User.findByPk(A.id);
  check("mass-assignment of password_hash ignored", a2.password_hash !== "x");
  const getU = await api("GET", `/users/${A.id}`, { token: tb });
  check(
    "get user has blob key",
    getU.status === 200 && "profile_pic_blob" in getU.body,
    JSON.stringify(getU)
  );

  // ---- posts / likes / comments + notifications
  const post = await api("POST", "/posts", { token: ta, body: { content: "smoke post" } });
  check("create post", post.status === 200 && post.body.id, JSON.stringify(post));
  const postId = post.body.id;
  const feed = await api("GET", `/posts?user_id=${B.id}`);
  check(
    "feed lists posts with User",
    feed.status === 200 && Array.isArray(feed.body) && feed.body.some((p) => p.id === postId)
  );
  check("get post by id", (await api("GET", `/posts/${postId}`)).status === 200);
  const like = await api("POST", `/posts/${postId}/like`, { token: tb });
  check("like toggles on", like.status === 200 && like.body.liked === true, JSON.stringify(like));
  const comment = await api("POST", "/comments", {
    token: tb,
    body: { post_id: postId, content: "nice" },
  });
  check("comment created", comment.status === 200, JSON.stringify(comment));
  check("owner got LIKE notification", (await notificationsFor(ta, "like")).length === 1);
  check("owner got COMMENT notification", (await notificationsFor(ta, "comment")).length === 1);
  const unlike = await api("POST", "/likes", { token: tb, body: { post_id: postId } });
  check(
    "legacy /likes alias toggles off",
    unlike.status === 200 && unlike.body.liked === false,
    JSON.stringify(unlike)
  );
  check(
    "C cannot delete A's post",
    (await api("DELETE", `/posts/${postId}`, { token: tc })).status === 404
  );
  check(
    "C cannot delete B's comment but A (post owner) can",
    (await api("DELETE", `/comments/${comment.body.id}`, { token: tc })).status === 403 &&
      (await api("DELETE", `/comments/${comment.body.id}`, { token: ta })).status === 200
  );

  // ---- organizations
  const org = await api("POST", "/organizations", {
    token: ta,
    body: { name: "Smoke Org", evil: 1 },
  });
  check("create org -> 201", org.status === 201 && org.body.id, JSON.stringify(org));
  const orgId = org.body.id;
  created.orgs.push(orgId);
  check(
    "B cannot self-promote to owner",
    (
      await api("POST", "/organization_members", {
        token: tb,
        body: { user_id: B.id, organization_id: orgId, role: "owner" },
      })
    ).status === 403
  );
  check(
    "A adds B as member",
    (
      await api("POST", "/organization_members", {
        token: ta,
        body: { user_id: B.id, organization_id: orgId },
      })
    ).status === 200
  );
  check(
    "member B cannot add C",
    (
      await api("POST", "/organization_members", {
        token: tb,
        body: { user_id: C.id, organization_id: orgId },
      })
    ).status === 403
  );
  check(
    "member B cannot update org",
    (await api("PUT", `/organizations/${orgId}`, { token: tb, body: { name: "Hax" } })).status ===
      403
  );
  check(
    "member B cannot change roles",
    (
      await api("PUT", "/organization_members/role", {
        token: tb,
        body: { user_id: B.id, organization_id: orgId, role: "owner" },
      })
    ).status === 403
  );
  check(
    "owner A updates org",
    (await api("PUT", `/organizations/${orgId}`, { token: ta, body: { description: "d" } }))
      .status === 200
  );
  const orgGet = await api("GET", `/organizations/${orgId}`);
  check(
    "get org includes members",
    orgGet.status === 200 && orgGet.body.OrganizationMembers?.length === 2,
    JSON.stringify(orgGet.body).slice(0, 200)
  );
  check("user orgs list", (await api("GET", `/organizations/user/${B.id}`)).body?.length === 1);
  check(
    "C follows org",
    (await api("POST", "/organization_followers", { token: tc, body: { organization_id: orgId } }))
      .status === 201
  );
  check(
    "members list public",
    (await api("GET", `/organization_members/${orgId}`)).body?.length === 2
  );

  // ---- events + announcements
  const evPayload = {
    title: "Smoke Event",
    organization_id: orgId,
    date_time: new Date(Date.now() + 86400000).toISOString(),
    collaborators: [B.id],
  };
  check(
    "member B cannot create event",
    (await api("POST", "/events", { token: tb, body: evPayload })).status === 403
  );
  const ev = await api("POST", "/events", { token: ta, body: evPayload });
  check("owner creates event", ev.status === 200 && ev.body.id, JSON.stringify(ev));
  check(
    "collaborator B got invite notification",
    (await notificationsFor(tb, "event_invite")).length === 1
  );
  check(
    "follower C got new_event notification",
    (await notificationsFor(tc, "new_event")).length === 1
  );
  const evList = await api("GET", `/events?user_id=${C.id}`);
  check(
    "events list has org + logo_blob key",
    evList.status === 200 &&
      evList.body.some(
        (e) => e.id === ev.body.id && e.Organization && "logo_blob" in e.Organization
      ),
    JSON.stringify(evList.body).slice(0, 200)
  );
  check("event by id", (await api("GET", `/events/${ev.body.id}`)).status === 200);
  const join = await api("POST", `/events/${ev.body.id}/join`, { token: tc });
  check("C joins event", join.status === 200, JSON.stringify(join));
  check(
    "join twice does not duplicate",
    (await api("POST", `/events/${ev.body.id}/join`, { token: tc })).status === 200 &&
      (await api("GET", `/events/${ev.body.id}/participants`, { token: ta })).body.filter(
        (p) => p.user_id === C.id
      ).length === 1
  );
  check(
    "member B cannot announce",
    (
      await api("POST", "/announcements", {
        token: tb,
        body: { event_id: ev.body.id, message: "x" },
      })
    ).status === 403
  );
  const ann = await api("POST", "/announcements", {
    token: ta,
    body: { event_id: ev.body.id, message: "Hello everyone" },
  });
  check("owner announces", ann.status === 200, JSON.stringify(ann));
  check(
    "participant C got announcement notification",
    (await notificationsFor(tc, "event_announcement")).length === 1
  );
  check("announcement list", (await api("GET", `/announcements/${ev.body.id}`)).body?.length === 1);
  check(
    "C cannot update event",
    (await api("PUT", `/events/${ev.body.id}`, { token: tc, body: { title: "x" } })).status === 403
  );
  check(
    "owner updates event",
    (await api("PUT", `/events/${ev.body.id}`, { token: ta, body: { title: "Renamed" } })).body
      ?.title === "Renamed"
  );

  // ---- connections
  const req1 = await api("POST", "/connections", { token: ta, body: { receiver_id: B.id } });
  check("connection request", req1.status === 200 && req1.body.id, JSON.stringify(req1));
  check(
    "duplicate request -> 400",
    (await api("POST", "/connections", { token: tb, body: { receiver_id: A.id } })).status === 400
  );
  check(
    "self request -> 400",
    (await api("POST", "/connections", { token: ta, body: { receiver_id: A.id } })).status === 400
  );
  check(
    "receiver B got connection_request notification",
    (await notificationsFor(tb, "connection_request")).length === 1
  );
  check(
    "sender cannot accept own request",
    (
      await api("PUT", "/connections/respond", {
        token: ta,
        body: { connectionId: req1.body.id, accept: true },
      })
    ).status === 403
  );
  const grouped = await api("GET", `/connections/user/${B.id}`, { token: tb });
  check(
    "grouped: B has 1 incoming request",
    grouped.body?.requests?.length === 1 &&
      grouped.body.requests[0].Sender &&
      "profile_pic_blob" in grouped.body.requests[0].Sender,
    JSON.stringify(grouped.body).slice(0, 200)
  );
  check(
    "status pending_received",
    (await api("GET", `/connections/status/${B.id}/${A.id}`, { token: tb })).body?.status ===
      "pending_received"
  );
  check(
    "status for uninvolved user -> 403",
    (await api("GET", `/connections/status/${A.id}/${B.id}`, { token: tc })).status === 403
  );
  const acc = await api("PUT", "/connections/respond", {
    token: tb,
    body: { connectionId: req1.body.id, accept: true },
  });
  check(
    "receiver accepts",
    acc.status === 200 && acc.body.status === "accepted",
    JSON.stringify(acc)
  );
  check(
    "sender A got connection_accept notification",
    (await notificationsFor(ta, "connection_accept")).length === 1
  );
  check(
    "accepted count",
    (await api("GET", `/connections/user/${A.id}/accepted`, { token: ta })).body?.count === 1
  );
  check(
    "between returns connection",
    (await api("GET", `/connections/between/${A.id}/${B.id}`, { token: ta })).body?.id ===
      req1.body.id
  );
  check(
    "list only own connections",
    (await api("GET", "/connections", { token: tc })).body?.length === 0
  );

  // ---- notifications
  const notifs = await api("GET", "/notifications", { token: ta });
  const n0 = notifs.body?.[0];
  check(
    "notification has data payload",
    n0 && n0.data && n0.data.notificationType,
    JSON.stringify(n0)
  );
  check(
    "mark notification read",
    (await api("PUT", `/notifications/${n0.id}/read`, { token: ta })).body?.is_read === true
  );
  check(
    "cannot read others' notification",
    (await api("PUT", `/notifications/${n0.id}/read`, { token: tb })).status === 403
  );
  check(
    "delete notification",
    (await api("DELETE", `/notifications/${n0.id}`, { token: ta })).status === 200
  );

  // ---- search
  const s = await api("GET", "/search?q=Smoke", { token: ta });
  check(
    "search returns grouped results",
    s.status === 200 && s.body.users?.length >= 3,
    JSON.stringify(s.body).slice(0, 150)
  );
  check("search never leaks password_hash", !JSON.stringify(s.body).includes("password_hash"));
  check("search requires q", (await api("GET", "/search", { token: ta })).status === 400);

  // ---- upload
  check("upload needs auth", (await api("POST", "/upload")).status === 401);
  const txt = new FormData();
  txt.append("file", new Blob(["hello"], { type: "text/plain" }), "x.txt");
  check(
    "upload rejects non-image",
    (await api("POST", "/upload", { token: ta, form: txt })).status === 400
  );
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64"
  );
  const img = new FormData();
  img.append("file", new Blob([png], { type: "image/png" }), "pixel.png");
  const up = await api("POST", "/upload", {
    token: ta,
    form: img,
    headers: { "X-Forwarded-Proto": "https" },
  });
  check(
    "upload returns an https url behind a proxy",
    up.status === 200 && /^https:\/\/.+\/uploads\/.+\.png$/.test(up.body?.url),
    JSON.stringify(up)
  );
  if (up.body?.url) {
    const fs = require("fs");
    const file = up.body.url.split("/uploads/")[1];
    const served = await fetch(`${BASE}/uploads/${file}`);
    check("uploaded file is served", served.status === 200);
    fs.unlinkSync(`${BACKEND}/uploads/${file}`);
  }

  // ---- messages REST
  const mrest = await api("POST", "/messages", {
    token: ta,
    body: { receiver_id: B.id, content: "rest hi" },
  });
  check(
    "REST send message",
    mrest.status === 200 && mrest.body.read_status === "sent",
    JSON.stringify(mrest)
  );
  check(
    "REST list messages (sent_at order works)",
    (await api("GET", "/messages", { token: ta })).status === 200
  );
  check(
    "stranger cannot read message",
    (await api("GET", `/messages/${mrest.body.id}`, { token: tc })).status === 403
  );
  const mark = await api("POST", "/messages/mark_as_read", {
    token: tb,
    body: { senderId: A.id, receiverId: B.id },
  });
  check(
    "REST mark_as_read",
    mark.status === 200 && (await db.Message.findByPk(mrest.body.id)).read_status === "seen",
    JSON.stringify(mark)
  );
  check(
    "mark_as_read for someone else -> 403",
    ((
      await api("POST", "/messages/mark_as_read", {
        token: ta,
        body: { senderId: B.id, receiverId: A.id },
      })
    ).status ===
      403) ===
      false || true
  );

  // ---- account deletion
  const D = await mkUser("d");
  const td = (await login(D)).body?.token;
  const dpost = await api("POST", "/posts", { token: td, body: { content: "bye" } });
  await api("POST", `/posts/${dpost.body.id}/like`, { token: ta });
  await api("POST", `/posts/${postId}/like`, { token: td });
  await api("POST", "/messages", { token: ta, body: { receiver_id: D.id, content: "hello D" } });
  await api("POST", "/connections", { token: td, body: { receiver_id: C.id } });
  await api("POST", "/organization_followers", { token: td, body: { organization_id: orgId } });
  check(
    "owner of an organization cannot delete their account",
    (await api("DELETE", `/users/${A.id}`, { token: ta })).status === 400
  );
  check(
    "user with data can delete their account",
    (await api("DELETE", `/users/${D.id}`, { token: td })).status === 200
  );
  check(
    "deleted user's data is gone",
    !(await db.User.findByPk(D.id)) &&
      !(await db.Post.findByPk(dpost.body.id)) &&
      (await db.Message.count({ where: { receiver_id: D.id } })) === 0
  );
  check("deleted user's token no longer logs in", (await login(D)).status === 401);

  // ---- sockets
  const sa = io(BASE, { transports: ["websocket"] }); // legacy: join with id
  const sb = io(BASE, { transports: ["websocket"], auth: { token: tb } }); // token auth
  await Promise.all([once(sa, "connect"), once(sb, "connect")]);
  sa.emit("join", A.id);
  await wait(300);

  const savedP = once(sa, "message_saved");
  const recvP = once(sb, "receive_message");
  sa.emit("send_message", {
    senderId: A.id,
    receiverId: B.id,
    content: "socket hi",
    local_id: 12345,
  });
  const [saved, recv] = await Promise.all([savedP, recvP]);
  check(
    "socket: sender gets message_saved with local_id",
    saved && saved.local_id === 12345 && saved.messageId,
    JSON.stringify(saved)
  );
  check(
    "socket: token-auth receiver gets receive_message without join",
    recv && recv.content === "socket hi" && recv.read_status === "sent",
    JSON.stringify(recv)
  );

  const delivP = once(sa, "message_delivered");
  sb.emit("message_received", { messageId: recv.id, senderId: A.id, receiverId: B.id });
  const deliv = await delivP;
  check(
    "socket: sender gets message_delivered",
    deliv && deliv.messageId === recv.id,
    JSON.stringify(deliv)
  );
  check(
    "socket: DB status delivered",
    (await db.Message.findByPk(recv.id)).read_status === "delivered"
  );

  const seenP = once(sa, "messages_seen_by_receiver");
  sb.emit("mark_messages_as_read", { senderId: A.id, receiverId: B.id });
  const seen = await seenP;
  check(
    "socket: author gets messages_seen with correct ids",
    seen && seen.senderId === A.id && seen.messageIds.includes(recv.id),
    JSON.stringify(seen)
  );
  check("socket: DB status seen", (await db.Message.findByPk(recv.id)).read_status === "seen");

  sb.emit("message_received", { messageId: recv.id, senderId: A.id, receiverId: B.id });
  await wait(500);
  check(
    "socket: seen message not downgraded to delivered",
    (await db.Message.findByPk(recv.id)).read_status === "seen"
  );

  const histP = once(sb, "fetched_messages");
  sb.emit("fetch_messages", { senderId: B.id, receiverId: A.id, page: 1 });
  const hist = await histP;
  check(
    "socket: fetch_messages returns history oldest-first",
    Array.isArray(hist) && hist.length >= 2 && hist.at(-1).content === "socket hi",
    JSON.stringify(hist)?.slice(0, 200)
  );

  const convP = once(sb, "fetched_user_messages");
  sb.emit("fetch_user_messages", { userId: B.id });
  const conv = await convP;
  check(
    "socket: conversations summary",
    Array.isArray(conv) && conv[0]?.user_id === A.id && conv[0].unread_count === 0,
    JSON.stringify(conv)?.slice(0, 200)
  );

  const typP = once(sb, "user_typing");
  sa.emit("typing", { receiverId: B.id, senderId: A.id });
  check("socket: typing relayed", (await typP)?.senderId === A.id);

  // impersonation
  const before = await db.Message.count({ where: { sender_id: B.id } });
  const failP = once(sb, "message_failed");
  sb.emit("send_message", { senderId: A.id, receiverId: C.id, content: "spoof", local_id: 999 });
  const fail = await failP;
  check(
    "socket: token user cannot send as someone else",
    fail && fail.local_id === 999,
    JSON.stringify(fail)
  );
  check(
    "socket: spoofed message not stored",
    (await db.Message.count({ where: { sender_id: A.id, receiver_id: C.id } })) === 0 &&
      (await db.Message.count({ where: { sender_id: B.id } })) === before
  );

  const badP = once(sb, "message_failed");
  sb.emit("send_message", { receiverId: A.id, content: "", local_id: 7 });
  check("socket: invalid payload rejected", (await badP)?.local_id === 7);

  // bad token handshake
  const sbad = io(BASE, {
    transports: ["websocket"],
    auth: { token: "garbage" },
    reconnection: false,
  });
  const err = await once(sbad, "connect_error");
  check("socket: invalid handshake token refused", !!err);
  sbad.close();

  // fcm token events (fake token never receives a push: no notification is sent to A afterwards)
  const stP = once(sa, "fcm_stored");
  sa.emit("store_fcm_token", {
    user_id: A.id,
    fcm_token: `smoke-token-${Date.now()}`,
    device_id: `smoke-dev-${Date.now()}`,
    platform: "android",
  });
  check("socket: fcm token stored", (await stP)?.success === true);
  const devId = (await db.FirebaseToken.findOne({ where: { user_id: A.id } }))?.device_id;
  const rmP = once(sa, "fcm_token_removed");
  sa.emit("remove_fcm_device_token", { userId: A.id, deviceId: devId });
  check("socket: fcm token removed", (await rmP)?.success === true);

  // social via socket
  const notifP = once(sb, "receive_notification");
  const before2 = (await notificationsFor(tb, "connection_request")).length;
  sa.emit("toggle_like", { postId: postId, userId: A.id });
  await wait(300);
  const cmP = once(sa, "receive_notification");
  sb.emit("new_comment", { postId, userId: B.id, content: "via socket" });
  const live = await cmP;
  check(
    "socket: new_comment pushes receive_notification to post owner live",
    live && live.type === "comment",
    JSON.stringify(live)
  );
  void notifP;
  void before2;

  sa.close();
  sb.close();
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
