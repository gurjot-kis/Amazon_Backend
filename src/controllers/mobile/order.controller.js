import { OrderService } from "../../services/order.service.js";
import { sendSuccess, sendError } from "../../helpers/response.helper.js";
import { AppError } from "../../utils/AppError.js";

const authId = (req) => {
  const id = req.user?._id;
  if (!id) throw new AppError(401, "Unauthorized");
  return id;
};

const respondError = (res, err, fallbackMessage) => {
  if (err instanceof AppError) {
    return sendError(res, { code: err.statusCode, message: err.message });
  }
  if (err?.name === "ValidationError") {
    return sendError(res, { code: 400, message: err.message });
  }
  console.error("[order]", err);
  return sendError(res, { code: 500, message: fallbackMessage });
};

const handle = (fallbackMessage, fn) => async (req, res) => {
  try {
    return await fn(req, res);
  } catch (err) {
    return respondError(res, err, fallbackMessage);
  }
};

export const OrderController = {
  placeOrder: handle("Unable to place order", async (req, res) => {
    const { address_id, paymentMethod } = req.body || {};
    const data = await OrderService.placeOrder({
      user_id: authId(req),
      address_id,
      paymentMethod,
    });
    return sendSuccess(res, {
      code: 201,
      message: "Order placed successfully",
      data,
    });
  }),

  listOrders: handle("Unable to fetch orders", async (req, res) => {
    const { page, limit } = req.query || {};
    const { orders, pagination } = await OrderService.listUserOrders({
      user_id: authId(req),
      page,
      limit,
    });
    return sendSuccess(res, {
      message: "Orders fetched successfully",
      data: orders,
      pagination,
    });
  }),

  getOrderById: handle("Unable to fetch order", async (req, res) => {
    const data = await OrderService.getUserOrderById({
      user_id: authId(req),
      order_id: req.params?.order_id,
    });
    return sendSuccess(res, { message: "Order fetched successfully", data });
  }),

  cancelOrder: handle("Unable to cancel order", async (req, res) => {
    const data = await OrderService.cancelUserOrder({
      user_id: authId(req),
      order_id: req.params?.order_id,
    });
    return sendSuccess(res, { message: "Order cancelled successfully", data });
  }),
};


export default OrderController;