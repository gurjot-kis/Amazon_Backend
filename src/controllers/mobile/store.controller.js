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
};

export default StoreController;
