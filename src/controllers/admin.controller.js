import { sendSuccess } from "../helpers/response.helper.js";
import { AdminService } from "../services/admin.service.js";

const sendError = (res, code, message) => {
  return res.status(code).json({
    success: false,
    code,
    message,
    data: null,
  });
};

export const AdminController = {
  getProfile: async (req, res) => {
    try {
      const { user_id } = req.user;
      const data = await AdminService.getProfile({ user_id });
      return res.status(200).json({
        success: true,
        code: 200,
        message: "Profile fetched successfully",
        data,
      });
    } catch (err) {
      const message = err?.message || "Unable to fetch profile";

      if (message === "Admin not found") {
        return sendError(res, 404, message);
      }

      return sendError(res, 500, message);
    }
  },

  updateProfile: async (req, res) => {
    try {
      const { user_id } = req.user;
      const { fullName, email, phone, address, password } = req.body || {};
      const profilePicture = req.file
        ? `/uploads/admin/${req.file.filename}`
        : undefined;
      const data = await AdminService.updateProfile({
        user_id,
        fullName,
        email,
        phone,
        address,
        password,
        profilePicture,
      });
      return res.status(200).json({
        success: true,
        code: 200,
        message: "Profile updated successfully",
        data,
      });
    } catch (err) {
      const message = err?.message || "Profile update failed";

      if (message === "Admin not found") {
        return sendError(res, 404, message);
      }

      if (message === "Email already in use") {
        return sendError(res, 409, message);
      }

      return sendError(res, 400, message);
    }
  },

  getDashboardData: async (req, res) => {
    try {
      const data = await AdminService.getDashboardData();

      return sendSuccess(res, {
        message: "Dashboard data fetched successfully",
        data,
      });
    } catch (err) {
      const message = err?.message || "Unable to fetch dashboard data";

      return sendError(res, {
        code: 500,
        message,
      });
    }
  },
};

export default AdminController;
