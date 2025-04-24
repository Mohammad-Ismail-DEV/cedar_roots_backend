const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST", "PUT", "DELETE"] },
});
const db = require("./models");
const dotenv = require("dotenv");
const { Op } = require("sequelize");
const admin = require("firebase-admin");
const serviceAccount = require("./firebase-settings.json"); // path to your service account key file
dotenv.config();

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

app.use(cors({ origin: "*", methods: ["GET", "POST", "PUT", "DELETE"] }));
app.use(express.json());

// Routes
app.use("/users", require("./routes/users"));
app.use("/auth", require("./routes/auth"));
app.use("/events", require("./routes/events"));
app.use("/messages", require("./routes/messages"));
app.use("/connections", require("./routes/connections"));
app.use("/notifications", require("./routes/notifications"));
app.use("/group-messages", require("./routes/groupMessages"));
app.use("/upload", require("./routes/upload"));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// WebSocket events
const userSockets = {};

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("join", (userId) => {
    if (!userSockets[userId]) userSockets[userId] = [];
    if (!userSockets[userId].includes(socket.id))
      userSockets[userId].push(socket.id);
    socket.join(userId);
    console.log("userSockets :>> ", userSockets);
  });

  socket.on(
    "store_fcm_token",
    async ({ user_id, fcm_token, device_id, platform }) => {
      try {
        if (!user_id || !fcm_token || !device_id || !platform) {
          return socket.emit("fcm_error", {
            message: "Missing required fields",
          });
        }

        // Upsert (insert if not exists, update if exists)
        await db.FirebaseToken.upsert({
          user_id,
          fcm_token,
          device_id,
          platform,
          updated_at: new Date(),
        });

        socket.emit("fcm_stored", { success: true });
      } catch (error) {
        console.error("Error storing FCM token:", error);
        socket.emit("fcm_error", { message: "Failed to store FCM token" });
      }
    }
  );

  socket.on("disconnect", () => {
    for (const userId in userSockets) {
      userSockets[userId] = userSockets[userId].filter(
        (id) => id !== socket.id
      );
      if (!userSockets[userId].length) delete userSockets[userId];
    }
    console.log("User disconnected:", socket.id);

    console.log("userSockets :>> ", userSockets);
  });

  socket.on("remove_fcm_device_token", async ({ userId, deviceId }) => {
    console.log("userId, deviceId :>> ", userId, deviceId);
    try {
      if (!userId || !deviceId) {
        return socket.emit("fcm_token_removed", {
          success: false,
          error: "Missing userId or deviceId",
        });
      }
      console.log("userId, deviceId :>> ", userId, deviceId);

      // Assuming you have a Sequelize model `FcmToken` with `user_id` and `device_id`
      const removed = await db.FirebaseToken.destroy({
        where: {
          user_id: userId,
          device_id: deviceId,
        },
      });
      console.log("removed :>> ", removed);

      if (removed > 0) {
        console.log(`✅ FCM token removed for device: ${deviceId}`);
        socket.emit("fcm_token_removed", { success: true });
      } else {
        console.log(`⚠️ No FCM token found to remove`);
        socket.emit("fcm_token_removed", {
          success: false,
          error: "Token not found",
        });
      }
    } catch (err) {
      console.error("❌ Error removing FCM token:", err);
      socket.emit("fcm_token_removed", {
        success: false,
        error: err.message,
      });
    }
  });

  socket.on(
    "message_received",
    async ({ messageId, senderId, receiverId }) => {
      try {
        const [updated] = await db.Message.update(
          { status: "delivered" },
          {
            where: {
              id: messageId,
              sender_id: senderId,
              receiver_id: receiverId,
            },
          }
        );
        if (updated > 0 && userSockets[senderId]) {
          userSockets[senderId].forEach((sockId) => {
            io.to(sockId).emit("message_delivered", { messageId });
          });
        }
      } catch (err) {
        console.error("❌ Error updating delivery status:", err);
      }
    }
  );

  socket.on("mark_messages_as_read", async ({ senderId, receiverId }) => {
    console.log("📩 mark_messages_as_read triggered", { senderId, receiverId });

    try {
      const seenMessages = await db.Message.findAll({
        where: {
          sender_id: senderId,
          receiver_id: receiverId,
          read_status: false,
        },
        attributes: ["id"],
      });

      const messageIds = seenMessages.map((msg) => msg.id);

      // Mark as read
      const [count] = await db.Message.update(
        { read_status: true },
        {
          where: {
            sender_id: senderId,
            receiver_id: receiverId,
            read_status: false,
          },
        }
      );

      console.log(`✅ Marked ${count} messages as read.`);

      // Notify sender of which messages were seen
      if (userSockets[senderId]) {
        userSockets[senderId].forEach((sockId) => {
          io.to(sockId).emit("messages_seen_by_receiver", {
            senderId: senderId,
            receiverId: receiverId,
            messageIds,
          });
        });
      }
    } catch (err) {
      console.error("❌ Error marking messages as read:", err);
    }
  });

  socket.on("fetch_user_messages", async (data) => {
    try {
      const userId = data.userId;
      const conversations = {};

      const directMessages = await db.Message.findAll({
        where: { [Op.or]: [{ sender_id: userId }, { receiver_id: userId }] },
        include: [
          {
            model: db.User,
            as: "sender",
            attributes: ["id", "name", "profile_pic"],
          },
          {
            model: db.User,
            as: "receiver",
            attributes: ["id", "name", "profile_pic"],
          },
        ],
        order: [["sent_at", "DESC"]],
      });

      for (const msg of directMessages) {
        const isSent = msg.sender_id === userId;
        const otherUser = isSent ? msg.receiver : msg.sender;
        const key = `user_${otherUser.id}`;
        if (!conversations[key]) {
          conversations[key] = {
            type: "direct",
            user_id: otherUser.id,
            name: otherUser.name,
            profile_pic: otherUser.profile_pic,
            last_message: {
              id: msg.id,
              content: msg.content,
              type: msg.type,
              sent_at: msg.sent_at,
              status: isSent ? "sent" : "received",
              read_status: msg.read_status,
            },
            unread_count: 0,
          };
        }
        if (!isSent && msg.read_status === false) {
          conversations[key].unread_count++;
        }
      }

      const groupMemberships = await db.GroupMember.findAll({
        where: { user_id: userId },
      });
      const groupIds = groupMemberships.map((m) => m.group_id);

      const groupMessages = await db.GroupMessage.findAll({
        where: { group_id: { [Op.in]: groupIds } },
        include: [
          { model: db.User, as: "groupSender", attributes: ["id", "name"] },
          { model: db.Group, attributes: ["id", "group_name"] },
          {
            model: db.GroupMessageStatus,
            as: "statuses",
            where: { user_id: userId },
            required: false,
          },
        ],
        order: [["sent_at", "DESC"]],
      });

      for (const msg of groupMessages) {
        const group = msg.Group;
        const key = `group_${group.id}`;
        if (!conversations[key]) {
          conversations[key] = {
            type: "group",
            group_id: group.id,
            name: group.group_name,
            last_message: {
              id: msg.id,
              content: msg.content,
              sent_at: msg.sent_at,
              sender_name: msg.User.name,
              status: msg.user_id === userId ? "sent" : "received",
            },
            unread_count: 0,
          };
        }
        const status = msg.statuses?.find((s) => s.user_id === userId);
        if (status && !status.read && msg.user_id !== userId) {
          conversations[key].unread_count++;
        }
      }

      socket.emit("fetched_user_messages", Object.values(conversations));
    } catch (err) {
      console.error("Error fetching user messages:", err);
      socket.emit("fetched_user_messages", { error: err.message });
    }
  });

  socket.on(
    "fetch_messages",
    async ({ senderId, receiverId, page = 1, limit = 20 }) => {
      try {
        const offset = (page - 1) * limit;

        // 1. Fetch ALL unread messages from receiverId to senderId
        const unreadMessages = await db.Message.findAll({
          where: {
            sender_id: receiverId,
            receiver_id: senderId,
            read_status: false,
          },
          order: [["sent_at", "ASC"]], // older unread first
        });

        // 2. Fetch paginated recent messages between both users
        const recentMessages = await db.Message.findAll({
          where: {
            [Op.or]: [
              { sender_id: senderId, receiver_id: receiverId },
              { sender_id: receiverId, receiver_id: senderId },
            ],
          },
          order: [["sent_at", "DESC"]],
          offset,
          limit,
        });

        // 3. Combine and deduplicate (avoid duplicates if unread overlap with recent)
        const combinedMap = new Map();
        [...unreadMessages, ...recentMessages].forEach((msg) => {
          combinedMap.set(msg.id, msg); // Map will auto-deduplicate by id
        });

        const combined = Array.from(combinedMap.values()).sort(
          (a, b) => new Date(a.sent_at) - new Date(b.sent_at)
        ); // ASC order for UI

        socket.emit("fetched_messages", combined);
      } catch (err) {
        console.error("Error fetching messages:", err);
        socket.emit("fetched_messages_error", { error: err.message });
      }
    }
  );

  socket.on("send_message", async (data) => {
    try {
      const message = await db.Message.create({
        sender_id: data.senderId,
        receiver_id: data.receiverId,
        content: data.content,
        type: data.type || "text",
        sent_at: new Date(),
        read_status: false,
      });

      // Return real ID and local_id to sender
      socket.emit("message_saved", {
        messageId: message.id,
        local_id: data.local_id,
        status: "saved",
      });

      // Emit to receiver
      if (userSockets[data.receiverId]) {
        userSockets[data.receiverId].forEach((socket) => {
          io.to(socket).emit("receive_message", message);
        });
      }

      // Fetch sender name
      const sender = await db.User.findByPk(data.senderId, {
        attributes: ["name"],
      });
      const senderName = sender?.name || "Cedar Roots";

      // Send FCM notifications...
      const tokens = await db.FirebaseToken.findAll({
        where: { user_id: data.receiverId },
        attributes: ["fcm_token", "device_id", "platform"],
      });

      const notifications = tokens.map((token) => ({
        token: token.fcm_token,
        notification: {
          title: senderName,
          body: data.content,
        },
        data: {
          senderId: data.senderId.toString(),
          senderName: senderName,
          content: data.content,
          type: data.type || "text",
        },
      }));

      notifications.forEach((notification) => {
        admin
          .messaging()
          .send(notification)
          .then((response) => console.log("\u2705 FCM sent:", response))
          .catch((error) => console.error("\u274C FCM error:", error));
      });
    } catch (err) {
      console.error("Error saving message:", err);
    }
  });

  socket.on("send_notification", (data) => {
    if (userSockets[data.receiverId]) {
      userSockets[data.receiverId].forEach((id) => {
        io.to(id).emit("receive_notification", data);
      });
    }
  });

  socket.on("send_group_message", async (data) => {
    try {
      const message = await db.GroupMessage.create({
        group_id: data.groupId,
        sender_id: data.senderId,
        content: data.content,
        sent_at: new Date(),
      });

      io.to(data.groupId).emit("receive_group_message", message);
    } catch (err) {
      console.error("Error saving group message:", err);
    }
  });

  socket.on("typing", ({ receiverId, senderId }) => {
    if (userSockets[receiverId]) {
      userSockets[receiverId].forEach((sockId) => {
        io.to(sockId).emit("user_typing", { senderId });
      });
    }
  });

  socket.on("message_seen", ({ messageId, userId }) => {
    // Update message seen status
    db.Message.update(
      { read_status: true },
      { where: { id: messageId, receiver_id: userId } }
    );
  });

  socket.on("join_group", (groupId) => {
    socket.join(groupId);
  });
});

db.sequelize.sync().then(() => {
  server.listen(process.env.PORT || 3000, () => {
    console.log("Server running on port 3000");
  });
});
