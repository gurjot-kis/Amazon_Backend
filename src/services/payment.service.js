import Payment, {
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
} from "../models/payment.model.js";
import Order from "../models/order.model.js";
import { AppError } from "../utils/AppError.js";
import { toObjectId } from "../utils/object-id.js";
import { runInTransaction } from "../utils/transaction.js";
import { buildPagination, parsePagination } from "./pagination.service.js";
import { RazorpayService } from "./razorpay.service.js";
import { notifyStatusChange } from "./order-notification.service.js";

const COLLECTABLE_ORDER_STATUSES = ["shipped", "delivered"];

const idToString = (value) => (value == null ? null : String(value));

const mapPayment = (payment, { admin = false } = {}) => {
  const data = {
    _id: idToString(payment._id),
    order_id: idToString(payment.order_id),
    user_id: idToString(payment.user_id),
    method: payment.method,
    amount: payment.amount,
    currency: payment.currency,
    status: payment.status,
    paid_at: payment.paid_at || null,
    expires_at: payment.expires_at || null,
    createdAt: payment.createdAt,
    updatedAt: payment.updatedAt,
  };

  if (admin) {
    data.collected_by = idToString(payment.collected_by);
    data.note = payment.note || "";
    data.cancelled_at = payment.cancelled_at || null;
    data.failure_reason = payment.failure_reason || "";
    data.gateway = payment.gateway || null;
  }

  return data;
};

const parseEnumFilter = (value, allowed, label, transform) => {
  if (value === undefined || value === null || String(value).trim() === "") {
    return undefined;
  }
  const normalized = transform(String(value).trim());
  if (!allowed.includes(normalized)) {
    throw new AppError(400, `Invalid payment ${label}`);
  }
  return normalized;
};

const findPaginated = async (filter, pagination) => {
  const [payments, total] = await Promise.all([
    Payment.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit)
      .lean()
      .exec(),
    Payment.countDocuments(filter).exec(),
  ]);
  return { payments, pagination: buildPagination(total, pagination) };
};

const markPaid = async ({
  payment_id,
  gateway_payment_id,
  method,
  signature,
}) => {
  const result = await runInTransaction(async (session) => {
    const payment = await Payment.findOneAndUpdate(
      { _id: payment_id, status: "pending" },
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
    if (!payment) {
      const existing = await Payment.findById(payment_id)
        .session(session)
        .lean()
        .exec();
      if (!existing) throw new AppError(404, "Payment not found");
      return { payment: existing, order: null, changed: false };
    }

    const order = await Order.findOneAndUpdate(
      { _id: payment.order_id, status: "payment_pending" },
      { $set: { status: "placed", paymentReceived: 1 } },
      { new: true, session },
    )
      .lean()
      .exec();
    if (!order) throw new AppError(409, "Order is no longer awaiting payment");

    return { payment, order, changed: true };
  });
  if (result.changed) void notifyStatusChange(result.order, "placed");
  return result;
};

export const PaymentService = {
  markPaid,

  // Called by OrderService (inside its transaction)
  createPendingPayment: async ({ order, session }) => {
    const isOnline = order.paymentMethod === "ONLINE";
    const isWallet = order.paymentMethod === "WALLET";
    const expiryMinutes = Number(process.env.PAYMENT_EXPIRY_MINUTES) || 20;

    const [payment] = await Payment.create(
      [
        {
          order_id: order._id,
          user_id: order.user_id,
          method: order.paymentMethod,
          amount: order.grandTotal,
          currency: order.items?.[0]?.currency || "INR",
          status: isWallet ? "paid" : "pending",
          paid_at: isWallet ? new Date() : null,
          expires_at: isOnline
            ? new Date(Date.now() + expiryMinutes * 60 * 1000)
            : null,
        },
      ],
      { session },
    );
    return payment;
  },

  // Throws (rolling back the cancellation) if money was already received.
  handleOrderCancellation: async ({ order_id, session }) => {
    const paid = await Payment.exists({
      order_id,
      status: { $in: ["paid", "refund_pending"] },
    }).session(session);
    if (paid) {
      throw new AppError(
        409,
        "Payment was already received for this order. Refund it before cancelling",
      );
    }

    await Payment.updateMany(
      { order_id, status: "pending" },
      { $set: { status: "cancelled", cancelled_at: new Date() } },
      { session },
    ).exec();
  },

  createRazorpayOrder: async ({ user_id, order_id }) => {
    const userId = toObjectId(user_id, "user_id");
    const orderId = toObjectId(order_id, "order_id");

    const order = await Order.findOne({ _id: orderId, user_id: userId })
      .select("status paymentMethod")
      .lean()
      .exec();

    if (!order) throw new AppError(404, "Order not found");
    if (order.paymentMethod !== "ONLINE") {
      throw new AppError(400, "This order is not an online payment order");
    }
    if (order.status !== "payment_pending") {
      throw new AppError(409, "Order is not awaiting payment");
    }

    let payment = await Payment.findOne({
      order_id: orderId,
      user_id: userId,
      status: "pending",
    })
      .sort({ createdAt: -1 })
      .lean()
      .exec();
    if (!payment) throw new AppError(409, "No pending payment for this order");

    if (payment.expires_at && payment.expires_at <= new Date()) {
      throw new AppError(
        409,
        "Payment window has expired. Please place the order again",
      );
    }

    if (!payment.gateway?.order_ref) {
      const rzpOrder = await RazorpayService.createOrder({
        amount: payment.amount,
        currency: payment.currency,
        receipt: String(orderId),
        notes: { order_id: String(orderId), payment_id: String(payment._id) },
      });

      const updated = await Payment.findOneAndUpdate(
        { _id: payment._id, status: "pending", "gateway.order_ref": null },
        { $set: { gateway: { provider: "razorpay", order_ref: rzpOrder.id } } },
        { new: true },
      )
        .lean()
        .exec();

      payment = updated || (await Payment.findById(payment._id).lean().exec());
      if (!payment?.gateway?.order_ref || payment.status !== "pending") {
        throw new AppError(409, "Payment is no longer pending");
      }
    }
    return {
      key_id: RazorpayService.getKeyId(),
      payment_id: idToString(payment._id),
      order_id: idToString(orderId),
      razorpay_order_id: payment.gateway.order_ref,
      amount: payment.amount,
      amount_minor: RazorpayService.toMinorUnit(payment.amount),
      currency: payment.currency,
      expires_at: payment.expires_at,
    };
  },

  verifyRazorpayPayment: async ({
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

    // 2. The Razorpay order must belong to this user.
    const payment = await Payment.findOne({
      "gateway.order_ref": razorpay_order_id,
      user_id: userId,
    })
      .lean()
      .exec();
    if (!payment) throw new AppError(404, "Payment not found");
    if (payment.status === "paid") {
      return { payment: mapPayment(payment), order_status: "placed" };
    }
    if (payment.status !== "pending") {
      throw new AppError(409, `Payment is ${payment.status}`);
    }

    // 3. Ask Razorpay to confirm (outside any transaction).
    const rzpPayment = await RazorpayService.fetchPayment(razorpay_payment_id);
    if (
      rzpPayment.order_id !== razorpay_order_id ||
      Number(rzpPayment.amount) !== RazorpayService.toMinorUnit(payment.amount)
    ) {
      throw new AppError(400, "Payment details do not match the order");
    }
    if (rzpPayment.status !== "captured") {
      throw new AppError(
        409,
        "Payment is still being processed. Your order will update shortly",
      );
    }

    // 4. Mark paid (atomic, only once).
    const result = await markPaid({
      payment_id: payment._id,
      gateway_payment_id: razorpay_payment_id,
      method: rzpPayment.method,
      signature: razorpay_signature,
    });
    if (result.payment.status !== "paid") {
      throw new AppError(409, `Payment is ${result.payment.status}`);
    }

    return { payment: mapPayment(result.payment), order_status: "placed" };
  },

  // payment.captured / order.paid: same job as verify, so reuse markPaid.
  handleRazorpayCaptured: async ({ rzpPayment, eventId }) => {
    const payment = await Payment.findOne({
      "gateway.order_ref": rzpPayment.order_id,
    })
      .lean()
      .exec();
    if (!payment) return "unknown_order";

    // Already processed this exact event.
    if (eventId && payment.gateway?.last_event_id === eventId) {
      return "duplicate";
    }
    if (payment.status === "paid") return "already_paid";

    // Amount must match what we stored.
    if (
      Number(rzpPayment.amount) !== RazorpayService.toMinorUnit(payment.amount)
    ) {
      console.error("[razorpay-webhook] amount mismatch", String(payment._id));
      return "amount_mismatch";
    }

    if (payment.status === "pending") {
      try {
        await markPaid({
          payment_id: payment._id,
          gateway_payment_id: rzpPayment.id,
          method: rzpPayment.method,
        });
      } catch (err) {
        // Order was cancelled/expired before the money arrived.
        if (err instanceof AppError && err.statusCode === 409) {
          console.error(
            "[razorpay-webhook] LATE PAYMENT needs refund:",
            String(payment._id),
            rzpPayment.id,
          );
          return "late_payment";
        }
        throw err;
      }
    } else {
      // cancelled/failed payment but money was captured.
      console.error(
        "[razorpay-webhook] LATE PAYMENT needs refund:",
        String(payment._id),
        rzpPayment.id,
      );
      return "late_payment";
    }

    if (eventId) {
      await Payment.updateOne(
        { _id: payment._id },
        { $set: { "gateway.last_event_id": eventId } },
      );
    }
    return "paid";
  },

  // payment.failed: record the reason. The customer can retry, so the
  // Payment stays pending until it expires.
  handleRazorpayFailed: async ({ rzpPayment }) => {
    await Payment.updateOne(
      { "gateway.order_ref": rzpPayment.order_id, status: "pending" },
      {
        $set: {
          failure_reason: String(
            rzpPayment.error_description || "Payment failed",
          ).slice(0, 500),
          "gateway.error_code": rzpPayment.error_code || null,
        },
      },
    );
    return "failed_recorded";
  },

  listUserPayments: async ({ user_id, status, page, limit }) => {
    const userId = toObjectId(user_id, "user_id");
    const filter = { user_id: userId };

    const normalizedStatus = parseEnumFilter(
      status,
      PAYMENT_STATUSES,
      "status",
      (v) => v.toLowerCase(),
    );
    if (normalizedStatus) filter.status = normalizedStatus;

    const { payments, pagination } = await findPaginated(
      filter,
      parsePagination({ page, limit }),
    );
    return { payments: payments.map((p) => mapPayment(p)), pagination };
  },

  getUserPaymentById: async ({ user_id, payment_id }) => {
    const userId = toObjectId(user_id, "user_id");
    const paymentId = toObjectId(payment_id, "payment_id");

    const payment = await Payment.findOne({ _id: paymentId, user_id: userId })
      .lean()
      .exec();
    if (!payment) throw new AppError(404, "Payment not found");

    return mapPayment(payment);
  },

  getUserPaymentByOrder: async ({ user_id, order_id }) => {
    const userId = toObjectId(user_id, "user_id");
    const orderId = toObjectId(order_id, "order_id");

    const payment = await Payment.findOne({
      order_id: orderId,
      user_id: userId,
    })
      .sort({ createdAt: -1 })
      .lean()
      .exec();
    if (!payment) throw new AppError(404, "Payment not found");

    return mapPayment(payment);
  },

  listAdminPayments: async ({
    status,
    method,
    order_id,
    user_id,
    page,
    limit,
  }) => {
    const filter = {};

    const normalizedStatus = parseEnumFilter(
      status,
      PAYMENT_STATUSES,
      "status",
      (v) => v.toLowerCase(),
    );
    if (normalizedStatus) filter.status = normalizedStatus;

    const normalizedMethod = parseEnumFilter(
      method,
      PAYMENT_METHODS,
      "method",
      (v) => v.toUpperCase(),
    );
    if (normalizedMethod) filter.method = normalizedMethod;

    if (order_id) filter.order_id = toObjectId(order_id, "order_id");
    if (user_id) filter.user_id = toObjectId(user_id, "user_id");

    const { payments, pagination } = await findPaginated(
      filter,
      parsePagination({ page, limit }),
    );
    return {
      payments: payments.map((p) => mapPayment(p, { admin: true })),
      pagination,
    };
  },

  getAdminPaymentById: async ({ payment_id }) => {
    const paymentId = toObjectId(payment_id, "payment_id");

    const payment = await Payment.findById(paymentId).lean().exec();
    if (!payment) throw new AppError(404, "Payment not found");

    return mapPayment(payment, { admin: true });
  },

  // Admin confirms the delivery person handed over the cash.
  collectCodPayment: async ({ payment_id, collected_by, note }) => {
    const paymentId = toObjectId(payment_id, "payment_id");
    const collectedBy = toObjectId(collected_by, "collected_by");
    const normalizedNote = String(note ?? "")
      .trim()
      .slice(0, 500);

    const payment = await runInTransaction(async (session) => {
      const doc = await Payment.findById(paymentId).session(session).exec();
      if (!doc) throw new AppError(404, "Payment not found");

      if (doc.method !== "COD") {
        throw new AppError(400, "Only COD payments can be collected manually");
      }
      if (doc.status === "paid") {
        throw new AppError(409, "Payment already collected");
      }
      if (doc.status !== "pending") {
        throw new AppError(409, `Cannot collect a ${doc.status} payment`);
      }

      const order = await Order.findById(doc.order_id).session(session).exec();
      if (!order) throw new AppError(404, "Order not found");

      if (!COLLECTABLE_ORDER_STATUSES.includes(order.status)) {
        throw new AppError(
          409,
          "COD can be collected only after the order is shipped",
        );
      }

      doc.status = "paid";
      doc.paid_at = new Date();
      doc.collected_by = collectedBy;
      doc.note = normalizedNote;
      await doc.save({ session });

      order.paymentReceived = 1;
      await order.save({ session });

      return doc.toObject();
    });

    return mapPayment(payment, { admin: true });
  },
};

export default PaymentService;
