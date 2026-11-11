import DeviceToken from "../models/DeviceToken.js";

export const DeviceTokenService = {
  saveToken: async ({ userId, token, platform }) => {
    return DeviceToken.findOneAndUpdate(
      { token },
      { $set: { userId, platform } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
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
