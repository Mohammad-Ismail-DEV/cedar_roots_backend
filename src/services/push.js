const { FirebaseToken } = require("../models");
const firebase = require("../config/firebase");
const logger = require("../utils/logger");

const STALE_TOKEN_CODES = new Set([
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
]);

const stringifyData = (data) =>
  Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)]));

async function sendToUser(userId, { title, body, data = {} }) {
  if (!firebase.isEnabled()) return;

  const tokens = await FirebaseToken.findAll({ where: { user_id: userId } });
  const payload = stringifyData(data);

  const results = await Promise.allSettled(
    tokens.map((t) =>
      firebase.messaging().send({
        token: t.fcm_token,
        notification: { title, body },
        data: payload,
      })
    )
  );

  const staleTokens = [];
  results.forEach((result, i) => {
    if (result.status === "fulfilled") return;
    if (STALE_TOKEN_CODES.has(result.reason?.code)) {
      staleTokens.push(tokens[i].fcm_token);
    } else {
      logger.warn({ err: result.reason?.message, userId }, "FCM send failed");
    }
  });

  if (staleTokens.length) {
    await FirebaseToken.destroy({ where: { fcm_token: staleTokens } });
  }
}

async function registerToken({ userId, fcmToken, deviceId, platform }) {
  await FirebaseToken.upsert({
    user_id: userId,
    fcm_token: fcmToken,
    device_id: deviceId,
    platform,
    updated_at: new Date(),
  });
}

async function removeDeviceToken(userId, deviceId) {
  return FirebaseToken.destroy({ where: { user_id: userId, device_id: deviceId } });
}

module.exports = { sendToUser, registerToken, removeDeviceToken };
