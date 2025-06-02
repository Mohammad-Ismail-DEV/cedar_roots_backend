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
  data: stringifiedData,
  created_at: new Date(),
});


    const stringifiedData = Object.fromEntries(
      Object.entries({ ...data, notificationType: type }).map(([k, v]) => [
        k,
        String(v),
      ])
    );

    for (const token of tokens) {
      await admin
        .messaging()
        .send({
          token: token.fcm_token,
          notification: { title, body },
          data: stringifiedData,
        })
        .then((res) => console.log("\n\n📣 Notification sent:", res, "\n"))
        .catch((err) => console.log("\n\n❌ FCM error:", err, "\n"));
    }
  } catch (err) {
    console.log("\n\n❌ Error sending notification:", err.message, "\n");
  }
}

module.exports = sendUserNotification;
