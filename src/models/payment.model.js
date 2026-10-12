import mongoose from "mongoose";

const { Schema } = mongoose;

export const PAYMENT_METHODS = ["COD", "UPI", "CARD", "NETBANKING", "WALLET"];
export const PAYMENT_STATUSES = [
  "pending",
  "paid",
  "failed",
  "cancelled",
  "refunded",
];

// Filled only for online payments (UPI/card/...) later.
const GatewaySchema = new Schema(
  {
    provider: { type: String, default: null, trim: true }, // e.g. "razorpay"
    order_ref: { type: String, default: null, trim: true }, // gateway's order id
    payment_ref: { type: String, default: null, trim: true }, // gateway's payment id
  },
  { _id: false },
);

const PaymentSchema = new Schema(
  {
    order_id: { type: Schema.Types.ObjectId, ref: "Order", required: true },
    user_id: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    method: {
      type: String,
      enum: PAYMENT_METHODS,
      default: "COD",
      index: true,
    },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, trim: true, uppercase: true },
    status: {
      type: String,
      enum: PAYMENT_STATUSES,
      default: "pending",
      index: true,
    },
    paid_at: { type: Date, default: null },
    cancelled_at: { type: Date, default: null },
    // COD: the admin who confirmed cash receipt.
    collected_by: { type: Schema.Types.ObjectId, ref: "User", default: null },
    note: { type: String, default: "", trim: true, maxlength: 500 },
    failure_reason: { type: String, default: "", trim: true },
    gateway: { type: GatewaySchema, default: null },
  },
  { timestamps: true, versionKey: false },
);

PaymentSchema.index({ order_id: 1, status: 1 });
PaymentSchema.index({ createdAt: -1 });

// An order can never have two successful payments (double-collect / double-webhook guard).
PaymentSchema.index(
  { order_id: 1 },
  {
    unique: true,
    partialFilterExpression: { status: "paid" },
    name: "uniq_paid_payment_per_order",
  },
);

// Webhook idempotency for online payments later.
PaymentSchema.index(
  { "gateway.payment_ref": 1 },
  {
    unique: true,
    partialFilterExpression: { "gateway.payment_ref": { $type: "string" } },
    name: "uniq_gateway_payment_ref",
  },
);

const Payment = mongoose.model("Payment", PaymentSchema);

export default Payment;
