import { messaging } from "../config/firebase.js";
import DeviceTokenService from "./deviceToken.service.js";

const INVALID_TOKEN_CODES = [
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
];

export const NotificationService = {
  sendToUser: async (userId, { title, body, data = {} }) => {
    const tokens = await DeviceTokenService.getTokensByUser(userId);
    if (!tokens.length) return;

    const response = await messaging.sendEachForMulticast({
      tokens,
      notification: { title, body },
      data,
    });

    const invalid = [];
    response.responses.forEach((r, i) => {
      if (!r.success && INVALID_TOKEN_CODES.includes(r.error?.code)) {
        invalid.push(tokens[i]);
      }
    });

    await DeviceTokenService.removeInvalidTokens(invalid);
  },
};


export default NotificationService;