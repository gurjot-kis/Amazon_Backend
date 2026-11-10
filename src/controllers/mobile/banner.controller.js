import { sendSuccess } from "../../helpers/response.helper.js";
import { BannerService } from "../../services/banner.service.js";

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

export const BannerController = {
  getBannerList: async (req, res) => {
    try {
      const {
        page,
        limit,
        search,
        store_id,
        upload_area,
        position,
        device_type,
      } = req.query || {};

      const { items, pagination } = await BannerService.listBannerImg({
        store_id,
        page,
        limit,
        search,
        upload_area,
        position,
        device_type,
      });

      return sendSuccess(res, {
        message: "Banners fetched successfully",
        data: items,
        pagination,
      });
    } catch (err) {
      console.log(err)
      return handleError(res, err, "Unable to fetch banners");
    }
  },
};

export default BannerController;
