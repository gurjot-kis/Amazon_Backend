import { sendSuccess } from "../../helpers/response.helper.js";
import { authId, handle } from "../../utils/controller.js";
import WalletTopupService from "../../services/wallet-topup.service.js";
import WalletService from "../../services/wallet.service.js";

export const WalletController = {
  createTopup: handle("Unable to create top-up", async (req, res) => {
    const data = await WalletTopupService.createTopup({
      user_id: authId(req),
      amount: req.body?.amount,
    });
    return sendSuccess(res, {
      code: 201,
      message: "Top-up order created successfully",
      data,
    });
  }),

  verifyTopup: handle("Unable to verify top-up", async (req, res) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
      req.body || {};
    const data = await WalletTopupService.verifyTopup({
      user_id: authId(req),
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    });
    return sendSuccess(res, { message: "Top-up verified successfully", data });
  }),

  getWallet: handle("Unable to fetch wallet", async (req, res) => {
    const data = await WalletService.getBalance({ user_id: authId(req) });
    return sendSuccess(res, { message: "Wallet fetched successfully", data });
  }),

  listTransactions: handle("Unable to fetch transactions", async (req, res) => {
    const { type, page, limit } = req.query || {};
    const { transactions, pagination } = await WalletService.listTransactions({
      user_id: authId(req),
      type,
      page,
      limit,
    });
    return sendSuccess(res, {
      message: "Transactions fetched successfully",
      data: transactions,
      pagination,
    });
  }),
};

export default WalletController;
