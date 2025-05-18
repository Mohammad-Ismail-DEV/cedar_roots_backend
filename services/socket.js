const { Server } = require("socket.io");
const db = require("../models");
const admin = require("firebase-admin");
const { Op } = require("sequelize");

const userSockets = {};

module.exports = function initializeSocket(server) {
  const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST", "PUT", "DELETE"] },
  });

  io.on("connection", (socket) => {
    console.log("🟢 User connected:", socket.id);

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

          await db.FirebaseToken.upsert({
            user_id,
            fcm_token,
            device_id,
            platform,
            updated_at: new Date(),
          });

          socket.emit("fcm_stored", { success: true });
        } catch (error) {
          console.error("FCM store error:", error);
          socket.emit("fcm_error", { message: "Failed to store FCM token" });
        }
      }
    );

    socket.on("remove_fcm_device_token", async ({ userId, deviceId }) => {
      try {
        const removed = await db.FirebaseToken.destroy({
          where: { user_id: userId, device_id: deviceId },
        });

        socket.emit("fcm_token_removed", {
          success: removed > 0,
          error: removed ? null : "Token not found",
        });
      } catch (err) {
        socket.emit("fcm_token_removed", {
          success: false,
          error: err.message,
        });
      }
    });

    socket.on(
      "message_received",
      async ({ messageId, senderId, receiverId }) => {
        const [updated] = await db.Message.update(
          { read_status: "delivered" },
          {
            where: {
              id: messageId,
              sender_id: senderId,
              receiver_id: receiverId,
            },
          }
        );

        if (updated && userSockets[senderId]) {
          userSockets[senderId].forEach((sockId) => {
            io.to(sockId).emit("message_delivered", { messageId });
          });
        }
      }
    );

    socket.on("mark_messages_as_read", async ({ senderId, receiverId }) => {
      const seenMessages = await db.Message.findAll({
        where: {
          sender_id: receiverId,
          receiver_id: senderId,
          read_status: { [Op.ne]: "seen" },
        },
        attributes: ["id"],
      });

      const messageIds = seenMessages.map((msg) => msg.id);
      await db.Message.update(
        { read_status: "seen" },
        {
          where: {
            sender_id: senderId,
            receiver_id: receiverId,
            read_status: { [Op.ne]: "seen" },
          },
        }
      );

      if (userSockets[senderId]) {
        userSockets[senderId].forEach((sockId) => {
          io.to(sockId).emit("messages_seen_by_receiver", {
            senderId,
            receiverId,
            messageIds,
          });
        });
      }
    });

    socket.on("fetch_user_messages", async ({ userId }) => {
      try {
        const conversations = {};
        const messages = await db.Message.findAll({
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

        for (const msg of messages) {
          const isSent = msg.sender_id === userId;
          const otherUser = isSent ? msg.receiver : msg.sender;
          const key = otherUser.id;
          if (!conversations[key]) {
            conversations[key] = {
              user_id: otherUser.id,
              name: otherUser.name,
              profile_pic: otherUser.profile_pic,
              last_message: msg,
              unread_count: 0,
            };
          }
          if (!isSent && msg.read_status !== "seen")
            conversations[key].unread_count++;
        }

        socket.emit("fetched_user_messages", Object.values(conversations));
      } catch (err) {
        socket.emit("fetched_user_messages", { error: err.message });
      }
    });

    socket.on(
      "fetch_messages",
      async ({ senderId, receiverId, page = 1, limit = 20 }) => {
        try {
          const offset = (page - 1) * limit;
          const messages = await db.Message.findAll({
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
          socket.emit("fetched_messages", messages.reverse());
        } catch (err) {
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
          read_status: "sent",
        });

        socket.emit("message_saved", {
          messageId: message.id,
          local_id: data.local_id,
          status: "saved",
        });

        if (userSockets[data.receiverId]) {
          userSockets[data.receiverId].forEach((sockId) => {
            io.to(sockId).emit("receive_message", message);
          });
        }

        const sender = await db.User.findByPk(data.senderId);
        const senderName = sender?.name || "Cedar Roots";

        const tokens = await db.FirebaseToken.findAll({
          where: { user_id: data.receiverId },
          attributes: ["fcm_token"],
        });

        const messages = tokens.map((token) => ({
          token: token.fcm_token,
          notification: {
            title: senderName,
            body: data.content,
          },
          data: {
            senderId: `${data.senderId}`,
            content: data.content,
            type: data.type || "text",
            notificationType: "message",
          },
        }));

        for (const msg of messages) {
          try {
            await admin.messaging().send(msg);
          } catch (err) {
            console.error("❌ FCM error:", err);
          }
        }
      } catch (err) {
        console.error("❌ Error sending message:", err);
      }
    });

    socket.on("new_comment", async ({ postId, userId, content }) => {
      try {
        await db.Comment.create({
          user_id: userId,
          post_id: postId,
          content,
          created_at: new Date(),
        });

        const post = await db.Post.findByPk(postId);
        const sender = await db.User.findByPk(userId);

        if (post && post.user_id !== userId) {
          const message = `${sender.name} commented on your post.`;

          // Save notification in DB
          await db.Notification.create({
            user_id: post.user_id,
            type: "comment",
            message,
            is_read: false,
            created_at: new Date(),
          });

          // Emit real-time notification to post author only
          if (userSockets[post.user_id]) {
            userSockets[post.user_id].forEach((sockId) =>
              io.to(sockId).emit("receive_notification", {
                type: "comment",
                message,
                senderId: userId,
                senderName: sender.name,
                postId,
              })
            );
          }

          // Send Firebase push
          const tokens = await db.FirebaseToken.findAll({
            where: { user_id: post.user_id },
          });

          tokens.forEach((token) => {
            admin
              .messaging()
              .send({
                token: token.fcm_token,
                notification: {
                  title: "New Comment",
                  body: `${sender.name} commented on your post.`,
                },
                data: {
                  postId: `${postId}`,
                  senderId: `${userId}`,
                  senderName: sender.name,
                  notificationType: "comment",
                },
              })
              .then((res) => console.log("📣 FCM comment sent:", res))
              .catch((err) => console.error("❌ FCM error:", err));
          });
        }
      } catch (err) {
        console.error("❌ Error handling new_comment:", err);
      }
    });

    socket.on("toggle_like", async ({ postId, userId }) => {
      try {
        const existing = await db.Like.findOne({
          where: { post_id: postId, user_id: userId },
        });

        const post = await db.Post.findByPk(postId);
        const sender = await db.User.findByPk(userId);
        let liked;

        if (existing) {
          await existing.destroy();
          liked = false;
        } else {
          await db.Like.create({
            post_id: postId,
            user_id: userId,
            created_at: new Date(),
          });
          liked = true;

          if (post && post.user_id !== userId) {
            const message = `${sender.name} liked your post.`;

            // Save notification in DB
            await db.Notification.create({
              user_id: post.user_id,
              type: "like",
              message,
              is_read: false,
              created_at: new Date(),
            });

            // Emit real-time notification
            if (userSockets[post.user_id]) {
              userSockets[post.user_id].forEach((sockId) =>
                io.to(sockId).emit("receive_notification", {
                  type: "like",
                  message,
                  senderId: userId,
                  senderName: sender.name,
                  postId,
                })
              );
            }

            // Send Firebase push
            const tokens = await db.FirebaseToken.findAll({
              where: { user_id: post.user_id },
            });

            tokens.forEach((token) => {
              admin
                .messaging()
                .send({
                  token: token.fcm_token,
                  notification: {
                    title: "New Like",
                    body: `${sender.name} liked your post.`,
                  },
                  data: {
                    postId: `${postId}`,
                    senderId: `${userId}`,
                    senderName: sender.name,
                    notificationType: "like",
                  },
                })
                .then((res) => console.log("✅ FCM like sent:", res))
                .catch((err) => console.error("❌ FCM error:", err));
            });
          }
        }

        // Emit updated like state to all users
        // io.emit("like_updated", {
        //   postId,
        //   userId,
        //   liked,
        // });
      } catch (err) {
        console.error("❌ Error toggling like:", err);
      }
    });

    socket.on("connection_request", async ({ senderId, receiverId }) => {
      try {
        const dbRequest = await db.Connection.create({
          sender_id: senderId,
          receiver_id: receiverId,
          status: "pending",
          created_at: new Date(),
        });

        // Store notification
        await db.Notification.create({
          user_id: receiverId,
          type: "connection",
          message: "You received a new connection request.",
          is_read: false,
          created_at: new Date(),
        });

        // Emit to receiver via socket
        if (userSockets[receiverId]) {
          userSockets[receiverId].forEach((sockId) =>
            io.to(sockId).emit("connection_request_received", {
              request: dbRequest,
            })
          );
        }

        // Send Firebase push
        const tokens = await db.FirebaseToken.findAll({
          where: { user_id: receiverId },
        });

        tokens.forEach((token) => {
          admin
            .messaging()
            .send({
              token: token.fcm_token,
              notification: {
                title: "New Connection Request",
                body: "Someone wants to connect with you.",
              },
              data: {
                senderId: `${senderId}`,
                notificationType: "connection",
              },
            })
            .then((res) => console.log("🔔 FCM connection sent:", res))
            .catch((err) => console.error("❌ FCM error:", err));
        });
      } catch (err) {
        console.error("❌ Error sending connection request:", err);
      }
    });

    socket.on("connection_respond", async ({ connectionId, accept }) => {
      try {
        const connection = await db.Connection.findByPk(connectionId);
        if (!connection) return;

        const senderId = connection.sender_id;
        const receiverId = connection.receiver_id;

        if (accept) {
          connection.status = "accepted";
          await connection.save();

          // Store notification
          await db.Notification.create({
            user_id: senderId,
            type: "connection",
            message: "Your connection request was accepted.",
            is_read: false,
            created_at: new Date(),
          });

          // Emit to sender
          if (userSockets[senderId]) {
            userSockets[senderId].forEach((sockId) =>
              io.to(sockId).emit("connection_request_accepted", {
                senderId,
                receiverId,
                connectionId,
              })
            );
          }

          // Send FCM
          const tokens = await db.FirebaseToken.findAll({
            where: { user_id: senderId },
          });

          tokens.forEach((token) => {
            admin
              .messaging()
              .send({
                token: token.fcm_token,
                notification: {
                  title: "Connection Accepted",
                  body: "Your connection request was accepted.",
                },
                data: {
                  receiverId: `${receiverId}`,
                  notificationType: "connection",
                },
              })
              .then((res) =>
                console.log("🔔 FCM connection accepted sent:", res)
              )
              .catch((err) => console.error("❌ FCM error:", err));
          });
        } else {
          await connection.destroy();

          // Optionally notify sender of decline here
        }
      } catch (err) {
        console.error("❌ Error responding to connection request:", err);
      }
    });

    socket.on("typing", ({ receiverId, senderId }) => {
      if (userSockets[receiverId]) {
        userSockets[receiverId].forEach((sockId) => {
          io.to(sockId).emit("user_typing", { senderId });
        });
      }
    });

    socket.on("disconnect", () => {
      for (const userId in userSockets) {
        userSockets[userId] = userSockets[userId].filter(
          (id) => id !== socket.id
        );
        if (!userSockets[userId].length) delete userSockets[userId];
      }
      console.log("🔴 User disconnected:", socket.id);
    });
  });

  return io;
};
