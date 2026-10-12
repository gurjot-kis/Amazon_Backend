import { sendSuccess } from "../../helpers/response.helper.js";
import { handle, authId } from "../../utils/controller.js";
import PaymentService from "../../services/payment.service.js";

export const PaymentController = {
  listPayments: handle("Unable to fetch payments", async (req, res) => {
    const { status, method, order_id, user_id, page, limit } = req.query || {};
    const { payments, pagination } = await PaymentService.listAdminPayments({
      status,
      method,
      order_id,
      user_id,
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
    const data = await PaymentService.getAdminPaymentById({
      payment_id: req.params?.payment_id,
    });
    return sendSuccess(res, { message: "Payment fetched successfully", data });
  }),

  collectCodPayment: handle("Unable to collect payment", async (req, res) => {
    const data = await PaymentService.collectCodPayment({
      payment_id: req.params?.payment_id,
      collected_by: authId(req),
      note: req.body?.note,
    });
    return sendSuccess(res, {
      message: "COD payment collected successfully",
      data,
    });
  }),
};

export default PaymentController;