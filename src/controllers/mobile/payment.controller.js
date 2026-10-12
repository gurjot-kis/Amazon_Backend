import { sendSuccess } from "../../helpers/response.helper.js";
import { handle, authId } from "../../utils/controller.js";
import PaymentService from "../../services/payment.service.js";

export const PaymentController = {
  listPayments: handle("Unable to fetch payments", async (req, res) => {
    const { status, page, limit } = req.query || {};
    const { payments, pagination } = await PaymentService.listUserPayments({
      user_id: authId(req),
      status,
      page,
      limit,
    });
    return sendSuccess(res, {
      message: "Payments fetched successfully",
      data: payments,
      pagination,
    });
  }),

  getPaymentById: handle("Unable to fetch payment", async (req, res) => {
    const data = await PaymentService.getUserPaymentById({
      user_id: authId(req),
      payment_id: req.params?.payment_id,
    });
    return sendSuccess(res, { message: "Payment fetched successfully", data });
  }),

  getPaymentByOrder: handle("Unable to fetch payment", async (req, res) => {
    const data = await PaymentService.getUserPaymentByOrder({
      user_id: authId(req),
      order_id: req.params?.order_id,
    });
    return sendSuccess(res, { message: "Payment fetched successfully", data });
  }),
};


export default PaymentController;