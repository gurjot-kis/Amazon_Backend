import fs from "fs";
import { sendSuccess } from "../../helpers/response.helper.js";
import StoreService from "../../services/store.service.js";

const toUrl = (file) => (file ? `/uploads/stores/${file.filename}` : undefined);

const getImages = (req) => ({
  store_logo: toUrl(req.files?.store_logo?.[0]),
  store_banner: toUrl(req.files?.store_banner?.[0]),
});

const cleanupUploads = (req) => {
  Object.values(req.files || {})
    .flat()
    .forEach((file) => fs.unlink(file.path, () => {}));
};

export const StoreController = {
  createStore: async (req, res, next) => {
    try {
      const store = await StoreService.createStore(
        req.user._id,
        req.body,
        getImages(req),
      );
      return sendSuccess(res, {
        code: 201,
        message: "Store created successfully",
        data: store,
      });
    } catch (error) {
      cleanupUploads(req);
      next(error);
    }
  },

  getMyStores: async (req, res, next) => {
    try {
      const { page, limit, search, status, verification_status } = req.query;
      const { data, pagination } = await StoreService.getMyStores(
        req.user._id,
        {
          page,
          limit,
          search,
          status,
          verification_status,
        },
      );
      return sendSuccess(res, {
        message: "Stores fetched successfully",
        data,
        pagination,
      });
    } catch (error) {
      next(error);
    }
  },

  getMyStoreById: async (req, res, next) => {
    try {
      const store = await StoreService.getMyStoreById(
        req.user._id,
        req.params.id,
      );
      return sendSuccess(res, {
        message: "Store fetched successfully",
        data: store,
      });
    } catch (error) {
      next(error);
    }
  },

  updateStore: async (req, res, next) => {
    try {
      const updated = await StoreService.updateStore(
        req.user._id,
        req.params.id,
        req.body,
        getImages(req),
      );
      return sendSuccess(res, {
        message: "Store updated successfully",
        data: updated,
      });
    } catch (error) {
      cleanupUploads(req);
      next(error);
    }
  },

  setDefaultStore: async (req, res, next) => {
    try {
      const store = await StoreService.setDefaultStore(
        req.user._id,
        req.params.id,
      );
      return sendSuccess(res, {
        message: "Default store updated successfully",
        data: store,
      });
    } catch (error) {
      next(error);
    }
  },

  toggleStoreStatus: async (req, res, next) => {
    try {
      const store = await StoreService.toggleStoreStatus(
        req.user._id,
        req.params.id,
      );
      return sendSuccess(res, {
        message: `Store ${store.status} successfully`,
        data: store,
      });
    } catch (error) {
      next(error);
    }
  },

  deleteStore: async (req, res, next) => {
    try {
      await StoreService.deleteStore(req.user._id, req.params.id);
      return sendSuccess(res, {
        message: "Store deleted successfully",
        data: null,
      });
    } catch (error) {
      next(error);
    }
  },
};

export default StoreController;
