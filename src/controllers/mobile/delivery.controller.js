import { sendSuccess } from "../../helpers/response.helper.js";
import DeliveryService from "../../services/delivery.service.js";

export const DeliveryController = {
  getCheckoutLocationDetails: async (req, res, next) => {
    try {
      const result = await DeliveryService.getCheckoutLocationDetails(
        req.user._id,
      );

      return sendSuccess(res, {
        message: "Checkout location details fetched successfully",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  },
};

export default DeliveryController;
