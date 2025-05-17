const admin = require("firebase-admin");
const { Notification, FirebaseToken, User } = require("../models");

async function sendUserNotification({ userId, title, body, type, data = {} }) {
  try {
    const tokens = await FirebaseToken.findAll({ where: { user_id: userId } });
    const user = await User.findByPk(userId);

    // Store in DB
    await Notification.create({
      user_id: userId,
      type,
      message: body,
      is_read: false,
      created_at: new Date(),
    });

    for (const token of tokens) {
      await admin
        .messaging()
        .send({
          token: token.fcm_token,
          notification: { title, body },
          data: { ...data, notificationType: type },
        })
        .then((res) => console.log("📣 Notification sent:", res))
        .catch((err) => console.error("❌ FCM error:", err));
    }
  } catch (err) {
    console.error("❌ Error sending notification:", err.message);
  }
}

module.exports = sendUserNotification;
