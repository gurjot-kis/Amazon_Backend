import { CartSettingsService } from "../../services/cart-settings.service.js";
import { ROLES } from "../../middlewares/role.middleware.js";
import { sendSuccess, sendError } from "../../helpers/response.helper.js";

const applyVendorScope = (req, target) => {
  if (req.user?.role === ROLES.VENDOR) {
    target.user_id = req.user.user_id;
    target.role = ROLES.VENDOR;
  }
  return target;
};

const handleError = (res, err, fallbackMessage) =>
  sendError(res, {
    code: err?.statusCode || 400,
    message: err?.message || fallbackMessage,
  });

export const CartSettingsController = {
  createCartSettings: async (req, res) => {
    try {
      const payload = applyVendorScope(req, { ...(req.body || {}) });
      const data = await CartSettingsService.createCartSettings(payload);

      return sendSuccess(res, {
        code: 201,
        message: "Cart settings created successfully",
        data,
      });
    } catch (err) {
      return handleError(res, err, "Cart settings creation failed");
    }
  },

  listCartSettings: async (req, res) => {
    try {
      const { page, limit } = req.query || {};
      const query = applyVendorScope(req, {
        page,
        limit,
        user_id: req.query?.user_id,
        role: req.query?.role,
      });

      const { items, pagination } =
        await CartSettingsService.listCartSettings(query);

      return sendSuccess(res, {
        code: 200,
        message: "Cart settings fetched successfully",
        data: items,
        pagination,
      });
    } catch (_err) {
      return sendError(res, {
        code: 500,
        message: "Unable to fetch cart settings",
      });
    }
  },

  getCartSettingsById: async (req, res) => {
    try {
      const { id } = req.params || {};
      const query = applyVendorScope(req, {
        _id: id,
        user_id: req.query?.user_id,
        role: req.query?.role,
      });

      const data = await CartSettingsService.getCartSettingsById(query);

      return sendSuccess(res, {
        code: 200,
        message: "Cart settings fetched successfully",
        data,
      });
    } catch (err) {
      return handleError(res, err, "Unable to fetch cart settings");
    }
  },

  // Handles both PUT and PATCH (partial update).
  updateCartSettings: async (req, res) => {
    try {
      const { id } = req.params || {};
      const payload = applyVendorScope(req, { ...(req.body || {}) });

      const data = await CartSettingsService.updateCartSettings({
        _id: id,
        ...payload,
      });

      return sendSuccess(res, {
        code: 200,
        message: "Cart settings updated successfully",
        data,
      });
    } catch (err) {
      return handleError(res, err, "Cart settings update failed");
    }
  },

  deleteCartSettings: async (req, res) => {
    try {
      const { id } = req.params || {};
      const query = applyVendorScope(req, {
        _id: id,
        user_id: req.query?.user_id,
        role: req.query?.role,
      });

      const data = await CartSettingsService.deleteCartSettings(query);

      return sendSuccess(res, {
        code: 200,
        message: "Cart settings deleted successfully",
        data,
      });
    } catch (err) {
      return handleError(res, err, "Cart settings deletion failed");
    }
  },
};

export default CartSettingsController;
