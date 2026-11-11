import DeviceToken from "../models/DeviceToken.js";

export const DeviceTokenService = {
  saveToken: async ({ userId, token, platform }) => {
    try {
      return DeviceToken.findOneAndUpdate(
        { token },
        { userId, token, platform },
        { upsert: true, new: true },
      );
    } catch (error) {
      next(error);
    }
  },

  removeToken: async (token) => {
    return DeviceToken.deleteOne({ token });
  },

  getTokensByUser: async (userId) => {
    const docs = await DeviceToken.find({ userId });
    return docs.map((d) => d.token);
  },

  removeInvalidTokens: async (tokens) => {
    if (!tokens.length) return;
    return DeviceToken.deleteMany({ token: { $in: tokens } });
  },
};

export default DeviceTokenService;
