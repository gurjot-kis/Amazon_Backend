import { sendSuccess } from "../../helpers/response.helper.js";
import StoreService from "../../services/store.service.js";

export const StoreController = {
  getAllStores: async (req, res, next) => {
    try {
      const { page, limit, search, status, verification_status, vendor_id } =
        req.query;
      const { data, pagination } = await StoreService.getAllStoresForAdmin({
        page,
        limit,
        search,
        status,
        verification_status,
        vendor_id,
      });
      return sendSuccess(res, {
        message: "Stores fetched successfully",
        data,
        pagination,
      });
    } catch (error) {
      next(error);
    }
  },

  getStoreByIdForAdmin: async (req, res, next) => {
    try {
      const store = await StoreService.getStoreByIdForAdmin(req.params.id);
      return sendSuccess(res, {
        message: "Store fetched successfully",
        data: store,
      });
    } catch (error) {
      next(error);
    }
  },

  updateVerificationStatus: async (req, res, next) => {
    try {
      const { verification_status, rejection_reason } = req.body;
      const store = await StoreService.updateVerificationStatus(req.params.id, {
        verification_status,
        rejection_reason,
      });
      return sendSuccess(res, {
        message: `Store ${store.verification_status} successfully`,
        data: store,
      });
    } catch (error) {
      next(error);
    }
  },

  updateStoreStatusByAdmin: async (req, res, next) => {
    try {
      const store = await StoreService.updateStoreStatusByAdmin(
        req.params.id,
        req.body.status,
      );
      return sendSuccess(res, {
        message: `Store ${store.status} successfully`,
        data: store,
      });
    } catch (error) {
      next(error);
    }
  },
};

export default StoreController;
