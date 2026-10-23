import { sendError } from "../helpers/response.helper.js";
import User from "../models/user.model.js";

export const requireActiveStore = async (req, res, next) => {
  try {
    const userId = req.user?._id || req.user?.id;

    let storeId = req.user?.active_store_id;

    if (storeId === undefined) {
      const user = await User.findById(userId).select("active_store_id").lean();
      storeId = user?.active_store_id;
    }

    if (!storeId) {
      return sendError(res, {
        code: 400,
        message: "No active store selected. Please select a store first.",
      });
    }

    req.activeStoreId = String(storeId);
    next();
  } catch (err) {
    next(err);
  }
};
