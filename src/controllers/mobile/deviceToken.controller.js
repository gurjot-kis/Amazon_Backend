import { sendError, sendSuccess } from "../../helpers/response.helper.js";
import DeviceTokenService from "../../services/deviceToken.service.js";

export const DeviceTokenController = {
  saveDeviceToken: async (req, res, next) => {
    try {
      const { token, platform } = req.body;

      if (!token || !platform) {
        return sendError(res, {
          code: 400,
          message: "token and platform are required",
        });
      }

      const result = await DeviceTokenService.saveToken({
        userId: req.user._id,
        token,
        platform,
      });

      return sendSuccess(res, {
        message: "Device token saved successfully",
        data: result,
      });
    } catch (err) {
      next(err);
    }
  },

  removeDeviceToken: async (req, res, next) => {
    try {
      const { token } = req.body;

      if (!token) {
        return sendError(res, {
          code: 400,
          message: "token is required",
        });
      }

      const result = await DeviceTokenService.removeToken(token);

      return sendSuccess(res, {
        message: "Device token removed successfully",
        data: result,
      });
    } catch (err) {
      next(err);
    }
  },
};

export default DeviceTokenController;
