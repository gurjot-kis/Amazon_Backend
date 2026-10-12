import { sendSuccess, sendError } from "../../helpers/response.helper.js";
import { OrderService } from "../../services/order.service.js";

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
  listOrders: handle("Unable to fetch orders", async (req, res) => {
    const { status, search, page, limit, user_id } = req.query || {};
    const { orders, pagination } = await OrderService.listAdminOrders({
      status,
      search,
      page,
      limit,
      user_id,
    });
    return sendSuccess(res, {
      message: "Orders fetched successfully",
      data: orders,
      pagination,
    });
  }),

  getOrderById: handle("Unable to fetch order", async (req, res) => {
    const data = await OrderService.getAdminOrderById({
      order_id: req.params?.order_id,
    });
    return sendSuccess(res, { message: "Order fetched successfully", data });
  }),

  updateOrderStatus: handle(
    "Unable to update order status",
    async (req, res) => {
      const { status } = req.body || {};
      const data = await OrderService.updateOrderStatus({
        order_id: req.params?.order_id,
        status,
      });
      return sendSuccess(res, {
        message: "Order status updated successfully",
        data,
      });
    },
  ),
};

export default OrderController;

/* --------------------------------- Vendor ---------------------------------- */

// export const VendorOrderController = {
//   listOrders: handle("Unable to fetch orders", async (req, res) => {
//     const { status, page, limit } = req.query || {};
//     const { orders, pagination } = await OrderService.listVendorOrders({
//       vendor_id: authId(req),
//       status,
//       page,
//       limit,
//     });
//     return sendSuccess(res, {
//       message: "Orders fetched successfully",
//       data: orders,
//       pagination,
//     });
//   }),

//   getOrderById: handle("Unable to fetch order", async (req, res) => {
//     const data = await OrderService.getVendorOrderById({
//       vendor_id: authId(req),
//       order_id: req.params?.order_id,
//     });
//     return sendSuccess(res, { message: "Order fetched successfully", data });
//   }),
// };
