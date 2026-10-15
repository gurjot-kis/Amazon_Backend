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

  updateProfile: async (req, res) => {
    try {
      const { user_id } = req.user;

      const { name, email, phone, address, gst, code, password } =
        req.body || {};

      const profilePicture = req.file
        ? `/uploads/vendor/${req.file.filename}`
        : undefined;

      const data = await VendorService.updateProfile({
        user_id,
        name,
        email,
        phone,
        address,
        gst,
        code,
        password,
        profilePicture,
      });

      return sendSuccess(res, {
        code: 200,
        message: "Vendor profile updated successfully",
        data,
      });
    } catch (err) {
      const message = err?.message || "Vendor profile update failed";

      if (message === "Vendor not found") {
        return sendError(res, {
          code: 404,
          message,
        });
      }

      if (message === "Email already in use") {
        return sendError(res, {
          code: 409,
          message,
        });
      }

      return sendError(res, {
        code: 400,
        message,
      });
    }
  },
};

export default VendorController;
