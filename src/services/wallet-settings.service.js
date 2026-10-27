import WalletSettings from "../models/walletSettings.model.js";

export const getWalletSettings = async () => {
  try {
    return await WalletSettings.findOneAndUpdate(
      { key: "default" },
      { $setOnInsert: { key: "default" } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    )
      .lean()
      .exec();
  } catch (err) {
    if (err?.code === 11000) {
      return WalletSettings.findOne({ key: "default" }).lean().exec();
    }
    throw err;
  }
};
