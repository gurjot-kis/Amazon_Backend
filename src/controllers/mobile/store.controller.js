import { sendSuccess } from "../../helpers/response.helper.js";
import StoreService from "../../services/store.service.js";

export const StoreController = {
  getNearbyStores: async (req, res, next) => {
    try {
      const { latitude, longitude, radius_km, page, limit } = req.query;
      const { data, pagination } = await StoreService.getNearbyStores({
        latitude,
        longitude,
        radius_km,
        page,
        limit,
      });
      return sendSuccess(res, {
        message: "Nearby stores fetched successfully",
        data,
        pagination,
      });
    } catch (error) {
      next(error);
    }
  },

  setActiveStore: async (req, res, next) => {
    try {
      const { user_id, store_id } = req.body;

      if (!user_id) {
        throw new Error("User ID is required");
      }

      if (!store_id) {
        throw new Error("Store ID is required");
      }

      const data = await StoreService.setActiveStore(user_id, store_id);

      return sendSuccess(res, {
        message: "Active store updated successfully",
        data,
      });
    } catch (error) {
      next(error);
    }
  },

  getStoreAndUserAddress: async (req, res, next) => {
    try {
      const { storeid } = req.params;
      const userId = req.user?._id;

      if (!userId) {
        throw new Error("Unauthorized: User ID not found");
      }

      if (!storeid) {
        throw new Error("Store ID parameter is required");
      }

      const data = await StoreService.getStoreAndUserAddress(userId, storeid);

      return sendSuccess(res, {
        message: "Store details and user address fetched successfully",
        data,
      });
    } catch (error) {
      next(error);
    }
  },
};

export default StoreController;
