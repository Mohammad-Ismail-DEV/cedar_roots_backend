const { z, id } = require("../../validators/common");
const push = require("../../services/push");
const { on, actingUserId } = require("../helpers");

module.exports = function fcm(socket) {
  on(
    socket,
    "store_fcm_token",
    z.object({
      user_id: id.optional(),
      fcm_token: z.string().min(1).max(500),
      device_id: z.string().min(1).max(255),
      platform: z.string().min(1).max(50),
    }),
    async (data) => {
      await push.registerToken({
        userId: actingUserId(socket, data.user_id),
        fcmToken: data.fcm_token,
        deviceId: data.device_id,
        platform: data.platform,
      });
      socket.emit("fcm_stored", { success: true });
    },
    (error) => socket.emit("fcm_error", { message: error })
  );

  on(
    socket,
    "remove_fcm_device_token",
    z.object({ userId: id.optional(), deviceId: z.string().min(1).max(255) }),
    async (data) => {
      const removed = await push.removeDeviceToken(
        actingUserId(socket, data.userId),
        data.deviceId
      );
      socket.emit("fcm_token_removed", {
        success: removed > 0,
        error: removed ? null : "Token not found",
      });
    },
    (error) => socket.emit("fcm_token_removed", { success: false, error })
  );
};
