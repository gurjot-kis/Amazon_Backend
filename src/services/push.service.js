import { messaging } from "../config/firebase.js";
import DeviceTokenService from "./deviceToken.service.js";
import Notification from "../models/notification.model.js";

const INVALID_TOKEN_CODES = [
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
];
const FCM_BATCH_LIMIT = 500;

const toStringMap = (obj) =>
  Object.fromEntries(
    Object.entries(obj)
      .filter(([, v]) => v != null)
      .map(([k, v]) => [k, String(v)]),
  );

const chunk = (arr, size) =>
  Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
    arr.slice(i * size, i * size + size),
  );

export const sendPush = async ({
  userIds,
  type,
  title,
  body,
  data = {},
  save = true,
}) => {
  try {
    const ids = [].concat(userIds).filter(Boolean);
    if (!ids.length) return;

    if (save) {
      await Notification.insertMany(
        ids.map((userId) => ({ userId, type, title, body, data })),
      );
    }

    const tokens = await DeviceTokenService.getTokensByUser(ids);
    if (!tokens.length) return;

    const invalid = [];
    for (const batch of chunk(tokens, FCM_BATCH_LIMIT)) {
      const response = await messaging.sendEachForMulticast({
        tokens: batch,
        notification: { title, body },
        data: toStringMap({ type, ...data }),
        apns: { payload: { aps: { sound: "default" } } },
        android: { priority: "high" },
      });

      response.responses.forEach((r, i) => {
        if (!r.success && INVALID_TOKEN_CODES.includes(r.error?.code)) {
          invalid.push(batch[i]);
        }
      });
    }

    await DeviceTokenService.removeInvalidTokens(invalid);
  } catch (error) {
    console.error(`[push] ${type} failed:`, error);
  }
};
