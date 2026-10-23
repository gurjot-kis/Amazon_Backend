import Payment from "../models/payment.model.js";
import OrderService from "./order.service.js";
import PaymentService from "./payment.service.js";
import RazorpayService from "./razorpay.service.js";

const BATCH_SIZE = 50;
const GRACE_MS = 2 * 60 * 1000;

const processExpiredPayment = async (payment) => {
  // 1. If a Razorpay order exists, check whether it was actually paid
  //    (the customer may have paid but verify never reached us).
  if (payment.gateway?.order_ref) {
    const attempts = await RazorpayService.fetchOrderPayments(
      payment.gateway.order_ref,
    );
    const captured = attempts.find(
      (a) =>
        a.status === "captured" &&
        Number(a.amount) === RazorpayService.toMinorUnit(payment.amount),
    );

    if (captured) {
      await PaymentService.markPaid({
        payment_id: payment._id,
        gateway_payment_id: captured.id,
        method: captured.method,
      });
      return "paid";
    }
  }

  // 2. Not paid: cancel the order, restore stock, cancel the payment.
  const cancelled = await OrderService.cancelExpiredOrder({
    order_id: payment.order_id,
  });
  return cancelled ? "cancelled" : "skipped";
};

export const expireStalePayments = async () => {
  const cutoff = new Date(Date.now() - GRACE_MS);

  const payments = await Payment.find({
    status: "pending",
    method: "ONLINE",
    expires_at: { $ne: null, $lte: cutoff },
  })
    .sort({ expires_at: 1 })
    .limit(BATCH_SIZE)
    .lean()
    .exec();

  const summary = {
    checked: payments.length,
    paid: 0,
    cancelled: 0,
    skipped: 0,
    failed: 0,
  };

  for (const payment of payments) {
    try {
      const outcome = await processExpiredPayment(payment);
      summary[outcome] += 1;
    } catch (err) {
      // One bad payment must not stop the others.
      summary.failed += 1;
      console.error("[payment-expiry]", String(payment._id), err?.message);
    }
  }

  return summary;
};
