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

const isBadToken = (e) =>
  INVALID_TOKEN_CODES.includes(e?.code) ||
  (e?.code === "messaging/invalid-argument" &&
    /registration token/i.test(e?.message || ""));

const USERS_PARALLEL = 20;

// send to one user's devices, with that user's own notificationId
const sendToUser = async ({
  userId,
  notificationId,
  type,
  title,
  body,
  data,
  result,
  invalid,
}) => {
  const tokens = await DeviceTokenService.getTokensByUser(userId);
  result.tokens += tokens.length;
  if (!tokens.length) return;

  for (const batch of chunk(tokens, FCM_BATCH_LIMIT)) {
    const pushData = toStringMap({ type, ...data, notificationId });
    console.log("[push] data:", pushData);

    const response = await messaging.sendEachForMulticast({
      tokens: batch,
      notification: { title, body },
      data: pushData,
      apns: { payload: { aps: { sound: "default" } } },
      android: { priority: "high" },
    });

    result.success += response.successCount;
    result.failed += response.failureCount;

    response.responses.forEach((r, i) => {
      if (!r.success && isBadToken(r.error)) invalid.push(batch[i]);
    });
  }
};

export const sendPush = async ({
  userIds,
  type,
  title,
  body,
  data = {},
  save = true,
}) => {
  const result = { ok: false, tokens: 0, success: 0, failed: 0 };
  try {
    const ids = [...new Set([].concat(userIds).filter(Boolean).map(String))];
    if (!ids.length) return result;

    // 1) save inbox records first, so every user gets a notification _id
    let docs = [];
    if (save) {
      docs = await Notification.insertMany(
        ids.map((userId) => ({ userId, type, title, body, data })),
      );
    }

    // 2) push to each user with their own notificationId
    const invalid = [];
    for (const group of chunk(ids, USERS_PARALLEL)) {
      await Promise.all(
        group.map((userId) => {
          const index = ids.indexOf(userId);
          return sendToUser({
            userId,
            notificationId: docs[index]?._id,
            type,
            title,
            body,
            data,
            result,
            invalid,
          });
        }),
      );
    }

    await DeviceTokenService.removeInvalidTokens(invalid);
    result.ok = true;
    return result;
  } catch (error) {
    console.error(`[push] ${type} failed:`, error);
    return result;
  }
};
