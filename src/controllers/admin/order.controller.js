import OrderService from "../../services/order.service.js";
import { sendSuccess } from "../../helpers/response.helper.js";

export const OrderController = {
  getStoreOrderCounts: async (req, res, next) => {
    try {
      const data = await OrderService.getStoreOrderCounts({
        search: req.query.search,
        vendor_id: req.query.vendor_id, // optional
        page: req.query.page,
        limit: req.query.limit,
      });
      return sendSuccess(res, { message: "Fetched successfully", data });
    } catch (err) {
      next(err);
    }
  },
};

export default OrderController;
