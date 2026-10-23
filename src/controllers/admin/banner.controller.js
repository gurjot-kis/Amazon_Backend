import { BannerService } from "../../services/banner.service.js";

const sendError = (res, code, message) => {
  return res.status(code).json({
    success: false,
    code,
    message,
    data: null,
  });
};

const mergeBody = (req) => {
  const body = { ...(req.body || {}) };
  delete body.image;
  return body;
};

const updateBanner = async (req, res) => {
  try {
    const { banner_id } = req.params || {};
    const payload = mergeBody(req);
    if (req.file) {
      payload.banner_image = `/uploads/banners/${req.file.filename}`;
    }

    const data = await BannerService.updateBanner({
      banner_id,
      ...payload,
    });
    return res.status(200).json({
      success: true,
      code: 200,
      message: "Banner updated successfully",
      data,
    });
  } catch (err) {
    const message = err?.message || "Banner update failed";
    if (message === "Banner not found") {
      return sendError(res, 404, message);
    }
    return sendError(res, 400, message);
  }
};

export const BannerController = {
  createBanner: async (req, res) => {
    try {
      const payload = mergeBody(req);
      if (req.file) {
        payload.banner_image = `/uploads/banners/${req.file.filename}`;
      }

      const data = await BannerService.createBanner(payload);
      return res.status(200).json({
        success: true,
        code: 200,
        message: "Banner created successfully",
        data,
      });
    } catch (err) {
      const message = err?.message || "Banner creation failed";
      return sendError(res, 400, message);
    }
  },

  listBanners: async (req, res) => {
    try {
      const { page, limit, search, status, upload_area } = req.query || {};
      const { items, pagination } = await BannerService.listBanners({
        page,
        limit,
        search,
        status,
        upload_area,
      });
      return res.status(200).json({
        success: true,
        code: 200,
        message: "Banners fetched successfully",
        data: items,
        pagination,
      });
    } catch (err) {
      const message = err?.message || "Unable to fetch banners";
      if (
        message === "status must be 0 or 1" ||
        message === "status is required" ||
        message === "upload_area must be website or app" ||
        message === "upload_area is required"
      ) {
        return sendError(res, 400, message);
      }
      return sendError(res, 500, "Unable to fetch banners");
    }
  },

  getBannerById: async (req, res) => {
    try {
      const { banner_id } = req.params || {};
      const data = await BannerService.getBannerById({ banner_id });
      return res.status(200).json({
        success: true,
        code: 200,
        message: "Banner fetched successfully",
        data,
      });
    } catch (err) {
      const message = err?.message || "Unable to fetch banner";
      if (message === "Banner not found") {
        return sendError(res, 404, message);
      }
      return sendError(res, 400, message);
    }
  },

  updateBannerPut: updateBanner,

  updateBannerPatch: updateBanner,

  deleteBanner: async (req, res) => {
    try {
      const { banner_id } = req.params || {};
      const data = await BannerService.deleteBanner({ banner_id });
      return res.status(200).json({
        success: true,
        code: 200,
        message: "Banner deleted successfully",
        data,
      });
    } catch (err) {
      const message = err?.message || "Banner deletion failed";
      if (message === "Banner not found") {
        return sendError(res, 404, message);
      }
      return sendError(res, 400, message);
    }
  },
};

export default BannerController;
