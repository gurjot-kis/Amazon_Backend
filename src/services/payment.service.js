import Payment, {
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
} from "../models/payment.model.js";
import Order from "../models/order.model.js";
import { AppError } from "../utils/AppError.js";
import { toObjectId } from "../utils/object-id.js";
import { runInTransaction } from "../utils/transaction.js";
import { buildPagination, parsePagination } from "./pagination.service.js";

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

export const PaymentService = {
  // Called by OrderService (inside its transaction)
  createPendingPayment: async ({ order, session }) => {
    const [payment] = await Payment.create(
      [
        {
          order_id: order._id,
          user_id: order.user_id,
          method: order.paymentMethod,
          amount: order.grandTotal,
          currency: order.items?.[0]?.currency || "INR",
          status: "pending",
        },
      ],
      { session },
    );
    return payment;
  },

  // Throws (rolling back the cancellation) if money was already received.
  handleOrderCancellation: async ({ order_id, session }) => {
    const paid = await Payment.exists({ order_id, status: "paid" }).session(
      session,
    );
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
