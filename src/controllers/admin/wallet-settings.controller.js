import WalletSettingsService from "../../services/wallet-settings.service.js";
import { sendSuccess, sendError } from "../../helpers/response.helper.js";

export const WalletSettingsController = {
  create: async (req, res) => {
    try {
      const result = await WalletSettingsService.createWalletSettings(req.body);

      return sendSuccess(res, {
        code: 201,
        message: "Wallet settings created successfully",
        data: result,
      });
    } catch (error) {
      return sendError(res, {
        code: error.statusCode || 500,
        message: error.message || "Failed to create wallet settings",
        error: error,
      });
    }
  },

  getAll: async (req, res) => {
    try {
      const { page = 1, limit = 10 } = req.query;

      const result = await WalletSettingsService.getAllWalletSettings({
        page: Number(page),
        limit: Number(limit),
      });

      return sendSuccess(res, {
        message: "Wallet settings fetched successfully",
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      return sendError(res, {
        code: error.statusCode || 500,
        message: error.message || "Failed to fetch wallet settings",
        error,
      });
    }
  },

  getById: async (req, res) => {
    try {
      const result = await WalletSettingsService.getWalletSettingsById(
        req.params.id,
      );

      return sendSuccess(res, {
        message: "Wallet settings fetched successfully",
        data: result,
      });
    } catch (error) {
      return sendError(res, {
        code: error.statusCode || 500,
        message: error.message || "Failed to fetch wallet settings",
        error: error,
      });
    }
  },

  update: async (req, res) => {
    try {
      const result = await WalletSettingsService.updateWalletSettings(
        req.params.id,
        req.body,
      );

      return sendSuccess(res, {
        message: "Wallet settings updated successfully",
        data: result,
      });
    } catch (error) {
      return sendError(res, {
        code: error.statusCode || 500,
        message: error.message || "Failed to update wallet settings",
        error: error,
      });
    }
  },

  delete: async (req, res) => {
    try {
      await WalletSettingsService.deleteWalletSettings(req.params.id);

      return sendSuccess(res, {
        message: "Wallet settings deleted successfully",
        data: null,
      });
    } catch (error) {
      return sendError(res, {
        code: error.statusCode || 500,
        message: error.message || "Failed to delete wallet settings",
        error: error,
      });
    }
  },

  setDefault: async (req, res) => {
    try {
      const result = await WalletSettingsService.setDefaultWalletSettings(
        req.params.id,
      );

      return sendSuccess(res, {
        message: "Default wallet settings updated successfully",
        data: result,
      });
    } catch (error) {
      return sendError(res, {
        code: error.statusCode || 500,
        message: error.message || "Failed to set default wallet settings",
        error: error,
      });
    }
  },

  toggleStatus: async (req, res) => {
    try {
      const result = await WalletSettingsService.toggleWalletSettingsStatus(
        req.params.id,
      );

      return sendSuccess(res, {
        message: `Wallet ${result.enabled ? "enabled" : "disabled"} successfully`,
        data: result,
      });
    } catch (error) {
      return sendError(res, {
        code: error.statusCode || 500,
        message: error.message || "Failed to update wallet status",
        error,
      });
    }
  },
};

export default WalletSettingsController;
