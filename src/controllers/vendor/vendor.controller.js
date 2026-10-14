import { sendError, sendSuccess } from "../../helpers/response.helper.js";
import { VendorService } from "../../services/vendor.service.js";

export const VendorController = {
  getProfile: async (req, res) => {
    try {
      const { _id } = req.user;

      const data = await VendorService.getProfile({ user_id: _id });

      return sendSuccess(res, {
        code: 200,
        message: "Vendor profile fetched successfully",
        data,
      });
    } catch (err) {
      const message = err?.message || "Unable to fetch vendor profile";

      if (message === "Vendor not found") {
        return sendError(res, {
          code: 404,
          message,
        });
      }

      return sendError(res, {
        code: 500,
        message,
      });
    }
  },
};

export default VendorController;
