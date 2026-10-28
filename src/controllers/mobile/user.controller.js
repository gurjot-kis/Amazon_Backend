import { sendSuccess } from "../../helpers/response.helper.js";
import UserService from "../../services/user.service.js";

export const UserController = {
  getMyProfile: async (req, res, next) => {
    try {
      const user_id = req.user._id;
      const user = await UserService.getMyProfile(user_id);
      return sendSuccess(res, { data: user });
    } catch (error) {
      next(error);
    }
  },

  requestEmailChange: async (req, res, next) => {
    try {
      const user_id = req.user._id;
      const { newEmail } = req.body;
      const result = await UserService.requestEmailChange(user_id, {
        newEmail,
      });
      return sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  },

  verifyEmailChange: async (req, res, next) => {
    try {
      const user_id = req.user._id;
      const { otp } = req.body;
      const result = await UserService.verifyEmailChange(user_id, { otp });
      return sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  },

  requestPhoneChange: async (req, res, next) => {
    try {
      const user_id = req.user._id;
      const { newPhone } = req.body;
      const result = await UserService.requestPhoneChange(user_id, {
        newPhone,
      });
      return sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  },

  verifyPhoneChange: async (req, res, next) => {
    try {
      const user_id = req.user._id;
      const { otp } = req.body;
      const result = await UserService.verifyPhoneChange(user_id, { otp });
      return sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  },

  updateMyProfile: async (req, res, next) => {
    try {
      const user_id = req.user._id;
      const { name } = req.body;
      const profilePicture = req.file
        ? `/uploads/profiles/${req.file.filename}`
        : undefined;

      const user = await UserService.updateMyProfile(user_id, {
        name,
        profilePicture,
      });

      return sendSuccess(res, {
        message: "Profile updated successfully",
        data: user,
      });
    } catch (error) {
      next(error);
    }
  },

  deleteMyAccount: async (req, res, next) => {
    try {
      const user_id = req.user._id;

      await UserService.deleteMyAccount(user_id);

      return sendSuccess(res, {
        message: "Your account has been deleted successfully",
      });
    } catch (error) {
      next(error);
    }
  },
};

export default UserController;
