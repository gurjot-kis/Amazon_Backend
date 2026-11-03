import mongoose from "mongoose";
import WalletSettings from "../models/walletSettings.model.js";
import { paginateAggregate } from "./pagination.service.js";

//Helper functions
const validateId = (id) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    const error = new Error("Invalid wallet settings ID");
    error.statusCode = 400;
    throw error;
  }
};

const validateAmounts = (data) => {
  const min = data.min_topup;
  const max = data.max_topup;

  if (min !== undefined && max !== undefined && min > max) {
    const error = new Error(
      "Minimum top-up amount cannot be greater than maximum top-up amount",
    );
    error.statusCode = 400;
    throw error;
  }

  if (
    data.quick_topup_amounts &&
    data.quick_topup_amounts.some(
      (amount) =>
        !Number.isInteger(amount) ||
        amount < (min ?? 100) ||
        amount > (max ?? 1000000),
    )
  ) {
    const error = new Error(
      "Quick top-up amounts must be integers within the allowed top-up range",
    );
    error.statusCode = 400;
    throw error;
  }
};

export const WalletSettingsService = {
  getWalletSettings: async () => {
    try {
      return await WalletSettings.findOneAndUpdate(
        { key: "default" },
        { $setOnInsert: { key: "default" } },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      )
        .lean()
        .exec();
    } catch (error) {
      if (err?.code === 11000) {
        return WalletSettings.findOne({ key: "default" }).lean().exec();
      }
      throw err;
    }
  },

  //Admin panel functions
  createWalletSettings: async (payload) => {
    validateAmounts(payload);

    const settings = await WalletSettings.create({
      ...payload,
      key: `wallet_${new mongoose.Types.ObjectId()}`,
    });

    return settings.toObject();
  },

  getAllWalletSettings: async ({ page = 1, limit = 10 } = {}) => {
    const pipeline = [
      {
        $sort: {
          key: 1,
          createdAt: -1,
        },
      },
    ];

    return await paginateAggregate(WalletSettings, pipeline, {
      page: Math.max(1, Number(page) || 1),
      limit: Math.max(1, Math.min(100, Number(limit) || 10)),
    });
  },

  getWalletSettingsById: async (id) => {
    validateId(id);

    const settings = await WalletSettings.findById(id).lean().exec();
    if (!settings) {
      const error = new Error("Wallet settings not found");
      error.statusCode = 404;
      throw error;
    }

    return settings;
  },

  updateWalletSettings: async (id, payload) => {
    validateId(id);

    const allowedFields = [
      "enabled",
      "min_topup",
      "max_topup",
      "max_balance",
      "quick_topup_amounts",
    ];

    const updateData = {};

    allowedFields.forEach((field) => {
      if (payload[field] !== undefined) {
        updateData[field] = payload[field];
      }
    });

    if (!Object.keys(updateData).length) {
      const error = new Error("No valid fields provided for update");
      error.statusCode = 400;
      throw error;
    }

    const existing = await WalletSettings.findById(id).lean().exec();
    if (!existing) {
      const error = new Error("Wallet settings not found");
      error.statusCode = 404;
      throw error;
    }

    validateAmounts({
      min_topup: updateData.min_topup ?? existing.min_topup,
      max_topup: updateData.max_topup ?? existing.max_topup,
      quick_topup_amounts:
        updateData.quick_topup_amounts ?? existing.quick_topup_amounts,
    });

    const updated = await WalletSettings.findByIdAndUpdate(
      id,
      { $set: updateData },
      {
        new: true,
        runValidators: true,
      },
    )
      .lean()
      .exec();

    return updated;
  },

  deleteWalletSettings: async (id) => {
    validateId(id);

    const settings = await WalletSettings.findById(id).lean().exec();
    if (!settings) {
      const error = new Error("Wallet settings not found");
      error.statusCode = 404;
      throw error;
    }
    if (settings.key === "default") {
      const error = new Error(
        "Default wallet settings cannot be deleted. Set another configuration as default first.",
      );
      error.statusCode = 400;
      throw error;
    }

    await WalletSettings.findByIdAndDelete(id);

    return true;
  },

  setDefaultWalletSettings: async (id) => {
    validateId(id);

    const settings = await WalletSettings.findById(id).lean().exec();
    if (!settings) {
      const error = new Error("Wallet settings not found");
      error.statusCode = 404;
      throw error;
    }
    if (settings.key === "default") {
      return settings;
    }

    const currentDefault = await WalletSettings.findOne({ key: "default" });
    if (currentDefault) {
      currentDefault.key = `wallet_${new mongoose.Types.ObjectId()}`;
      await currentDefault.save();
    }

    const updated = await WalletSettings.findByIdAndUpdate(
      id,
      { $set: { key: "default" } },
      { new: true, runValidators: true },
    )
      .lean()
      .exec();

    return updated;
  },

  toggleWalletSettingsStatus: async (id) => {
    validateId(id);

    const settings = await WalletSettings.findById(id);
    if (!settings) {
      const error = new Error("Wallet settings not found");
      error.statusCode = 404;
      throw error;
    }

    settings.enabled = !settings.enabled;

    await settings.save();

    return settings.toObject();
  },

};

export default WalletSettingsService;
