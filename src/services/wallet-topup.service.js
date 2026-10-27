import WalletTopup from "../models/walletTopup.model.js";
import { AppError } from "../utils/AppError.js";
import { toObjectId } from "../utils/object-id.js";
import RazorpayService from "./razorpay.service.js";
import WalletService from "./wallet.service.js";
import { getWalletSettings } from "./wallet-settings.service.js";
import { runInTransaction } from "../utils/transaction.js";

const idToString = (value) => (value == null ? null : String(value));

const rupeesToPaise = (value) => {
  const rupees = Number(value);
  if (!Number.isFinite(rupees) || rupees <= 0) {
    throw new AppError(400, "Enter a valid amount");
  }
  const paise = Math.round(rupees * 100);
  if (Math.abs(rupees * 100 - paise) > 1e-6) {
    throw new AppError(400, "Amount can have at most 2 decimal places");
  }
  return paise;
};

const mapTopup = (topup) => ({
  _id: idToString(topup._id),
  amount: topup.amount / 100,
  amount_minor: topup.amount,
  currency: topup.currency,
  status: topup.status,
  paid_at: topup.paid_at || null,
  expires_at: topup.expires_at || null,
});

// Shared by verify (and later the webhook). Atomic + idempotent.
const markTopupPaid = async ({
  topup_id,
  gateway_payment_id,
  method,
  signature,
}) => {
  const settings = await getWalletSettings();

  return runInTransaction(async (session) => {
    const topup = await WalletTopup.findOneAndUpdate(
      { _id: topup_id, status: "pending" },
      {
        $set: {
          status: "paid",
          paid_at: new Date(),
          "gateway.payment_ref": gateway_payment_id,
          "gateway.method": method || null,
          "gateway.signature": signature || null,
        },
      },
      { new: true, session },
    )
      .lean()
      .exec();

    // Not pending anymore: someone else already handled it.
    if (!topup) {
      const existing = await WalletTopup.findById(topup_id)
        .session(session)
        .lean()
        .exec();
      if (!existing) throw new AppError(404, "Top-up not found");
      return { topup: existing, changed: false };
    }

    // Money was captured, so credit WITHOUT the balance cap.
    // (The cap was already checked when the top-up was created.)
    await WalletService.credit({
      user_id: topup.user_id,
      amount: topup.amount,
      source: "topup",
      reference: { type: "WalletTopup", id: topup._id },
      idempotency_key: `topup:${topup._id}`,
      session,
    });

    return { topup, changed: true };
  });
};

export const WalletTopupService = {
  createTopup: async ({ user_id, amount }) => {
    const userId = toObjectId(user_id, "user_id");
    const paise = rupeesToPaise(amount);

    const settings = await getWalletSettings();
    if (!settings.enabled) throw new AppError(403, "Wallet is not available");
    if (paise < settings.min_topup) {
      throw new AppError(400, `Minimum top-up is ₹${settings.min_topup / 100}`);
    }
    if (paise > settings.max_topup) {
      throw new AppError(400, `Maximum top-up is ₹${settings.max_topup / 100}`);
    }

    const wallet = await WalletService.getOrCreateWallet({ user_id: userId });
    if (wallet.status !== "active") {
      throw new AppError(403, "Wallet is not active");
    }
    if (wallet.balance + paise > settings.max_balance) {
      throw new AppError(
        400,
        `Wallet balance cannot exceed ₹${settings.max_balance / 100}`,
      );
    }

    const expiryMinutes = Number(process.env.PAYMENT_EXPIRY_MINUTES) || 20;
    const topup = await WalletTopup.create({
      user_id: userId,
      wallet_id: wallet._id,
      amount: paise,
      currency: wallet.currency,
      status: "pending",
      expires_at: new Date(Date.now() + expiryMinutes * 60 * 1000),
    });

    // Razorpay call, outside any DB transaction.
    let rzpOrder;
    try {
      rzpOrder = await RazorpayService.createOrder({
        amount: RazorpayService.fromMinorUnit(paise),
        currency: topup.currency,
        receipt: `topup_${topup._id}`,
        notes: { type: "wallet_topup", topup_id: String(topup._id) },
      });
    } catch (err) {
      await WalletTopup.updateOne(
        { _id: topup._id },
        { $set: { status: "failed", failure_reason: "Gateway order failed" } },
      );
      throw err;
    }

    await WalletTopup.updateOne(
      { _id: topup._id },
      { $set: { gateway: { provider: "razorpay", order_ref: rzpOrder.id } } },
    );

    return {
      key_id: RazorpayService.getKeyId(),
      topup_id: idToString(topup._id),
      razorpay_order_id: rzpOrder.id,
      amount: paise / 100,
      amount_minor: paise,
      currency: topup.currency,
      expires_at: topup.expires_at,
    };
  },

  verifyTopup: async ({
    user_id,
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
  }) => {
    const userId = toObjectId(user_id, "user_id");

    // 1. Is the signature genuine?
    const valid = RazorpayService.verifyCheckoutSignature({
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      signature: razorpay_signature,
    });
    if (!valid) throw new AppError(400, "Invalid payment signature");

    // 2. The Razorpay order must belong to this user's top-up.
    const topup = await WalletTopup.findOne({
      "gateway.order_ref": razorpay_order_id,
      user_id: userId,
    })
      .lean()
      .exec();
    if (!topup) throw new AppError(404, "Top-up not found");

    // Already credited (e.g. by the webhook): just report it.
    if (topup.status === "paid") {
      const wallet = await WalletService.getBalance({ user_id: userId });
      return { topup: mapTopup(topup), wallet };
    }
    if (topup.status !== "pending") {
      throw new AppError(409, `Top-up is ${topup.status}`);
    }

    // 3. Ask Razorpay to confirm (outside any transaction).
    const rzpPayment = await RazorpayService.fetchPayment(razorpay_payment_id);
    if (
      rzpPayment.order_id !== razorpay_order_id ||
      Number(rzpPayment.amount) !== topup.amount
    ) {
      throw new AppError(400, "Payment details do not match the top-up");
    }
    if (rzpPayment.status !== "captured") {
      throw new AppError(
        409,
        "Payment is still being processed. Your wallet will update shortly",
      );
    }

    // 4. Mark paid and credit the wallet (atomic, only once).
    const result = await markTopupPaid({
      topup_id: topup._id,
      gateway_payment_id: razorpay_payment_id,
      method: rzpPayment.method,
      signature: razorpay_signature,
    });
    if (result.topup.status !== "paid") {
      throw new AppError(409, `Top-up is ${result.topup.status}`);
    }

    const wallet = await WalletService.getBalance({ user_id: userId });
    return { topup: mapTopup(result.topup), wallet };
  },
};

export default WalletTopupService;
