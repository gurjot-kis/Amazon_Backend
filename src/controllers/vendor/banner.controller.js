import { sendSuccess } from "../../helpers/response.helper.js";
import BannerService from "../../services/banner.service.js";

const sendError = (res, code, message) => {
  return res.status(code).json({
    success: false,
    code,
    message,
    data: null,
  });
};

const handleError = (res, err, fallbackMessage) => {
  const message = err?.message || fallbackMessage;

  if (
    message === "Banner not found" ||
    message === "Store not found or does not belong to this vendor"
  ) {
    return sendError(res, 404, message);
  }

  if (
    message.includes("required") ||
    message.includes("invalid") ||
    message.includes("must be") ||
    message.includes("cannot be") ||
    message.includes("Authenticated vendor")
  ) {
    return sendError(
      res,
      message.includes("Authenticated vendor") ? 401 : 400,
      message,
    );
  }

  return sendError(res, 500, fallbackMessage);
};

const getVendorId = (req) => {
  const vendorId = req.user?._id;

  if (!vendorId) {
    throw new Error("Authenticated vendor not found");
  }

  return vendorId;
};

const mergeBody = (req) => {
  const body = { ...(req.body || {}) };

  delete body.vendor_id;
  delete body.image;

  return body;
};

export const BannerController = {
  createBanner: async (req, res) => {
    try {
      const vendor_id = getVendorId(req);
      const payload = mergeBody(req);

      if (req.file) {
        payload.banner_image = `/uploads/banners/${req.file.filename}`;
      }

      const data = await BannerService.createBanner({
        ...payload,
        vendor_id,
      });

      return sendSuccess(res, {
        code: 201,
        message: "Banner created successfully",
        data,
      });
    } catch (err) {
      return handleError(res, err, "Banner creation failed");
    }
  },

  listBanners: async (req, res) => {
    try {
      const vendor_id = getVendorId(req);

      const { page, limit, search, status, upload_area, store_id, position } =
        req.query || {};

      const { items, pagination } = await BannerService.listBanners({
        vendor_id,
        store_id,
        page,
        limit,
        search,
        status,
        upload_area,
        position,
      });

      return sendSuccess(res, {
        message: "Banners fetched successfully",
        data: items,
        pagination,
      });
    } catch (err) {
      return handleError(res, err, "Unable to fetch banners");
    }
  },

  getBannerById: async (req, res) => {
    try {
      const vendor_id = getVendorId(req);
      const { id } = req.params || {};

      const data = await BannerService.getBannerById({
        banner_id: id,
        vendor_id,
      });

      return sendSuccess(res, {
        message: "Banner fetched successfully",
        data,
      });
    } catch (err) {
      return handleError(res, err, "Unable to fetch banner");
    }
  },

  updateBanner: async (req, res) => {
    try {
      const vendor_id = getVendorId(req);
      const { id } = req.params || {};

      const payload = mergeBody(req);

      if (req.file) {
        payload.banner_image = `/uploads/banners/${req.file.filename}`;
      }

      const data = await BannerService.updateBanner({
        ...payload,
        banner_id: id,
        vendor_id,
      });

      return sendSuccess(res, {
        message: "Banner updated successfully",
        data,
      });
    } catch (err) {
      return handleError(res, err, "Banner update failed");
    }
  },

  toggleBannerStatus: async (req, res) => {
    try {
      const vendor_id = getVendorId(req);
      const { id } = req.params || {};

      const data = await BannerService.toggleBannerStatus({
        banner_id: id,
        vendor_id,
      });

      return sendSuccess(res, {
        message: `Banner ${
          Number(data.status) === 1 ? "activated" : "deactivated"
        } successfully`,
        data,
      });
    } catch (err) {
        console.log(err)
      return handleError(res, err, "Unable to toggle banner status");
    }
  },

  deleteBanner: async (req, res) => {
    try {
      const vendor_id = getVendorId(req);
      const { id } = req.params || {};

      const data = await BannerService.deleteBanner({
        banner_id: id,
        vendor_id,
      });

      return sendSuccess(res, {
        message: "Banner deleted successfully",
        data,
      });
    } catch (err) {
      return handleError(res, err, "Banner deletion failed");
    }
  },
};

export default BannerController;
