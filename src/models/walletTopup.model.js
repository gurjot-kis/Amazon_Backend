import mongoose from "mongoose";

const { Schema } = mongoose;

export const TOPUP_STATUSES = ["pending", "paid", "failed", "expired"];

const isInt = {
  validator: Number.isInteger,
  message: "{PATH} must be an integer (paise)",
};

const TopupGatewaySchema = new Schema(
  {
    provider: { type: String, default: null, trim: true },
    order_ref: { type: String, default: null, trim: true },
    payment_ref: { type: String, default: null, trim: true },
    method: { type: String, default: null, trim: true },
    signature: { type: String, default: null, trim: true },
    last_event_id: { type: String, default: null, trim: true },
    error_code: { type: String, default: null, trim: true },
  },
  { _id: false },
);

const WalletTopupSchema = new Schema(
  {
    user_id: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    wallet_id: { type: Schema.Types.ObjectId, ref: "Wallet", required: true },
    amount: { type: Number, required: true, min: 1, validate: isInt }, 
    currency: { type: String, default: "INR", trim: true, uppercase: true },
    status: { type: String, enum: TOPUP_STATUSES, default: "pending" },
    gateway: { type: TopupGatewaySchema, default: null },
    expires_at: { type: Date, default: null },
    paid_at: { type: Date, default: null },
    failure_reason: { type: String, default: "", trim: true },
  },
  { timestamps: true, versionKey: false },
);

WalletTopupSchema.index({ user_id: 1, createdAt: -1 });
WalletTopupSchema.index({ status: 1, expires_at: 1 });

WalletTopupSchema.index(
  { "gateway.order_ref": 1 },
  {
    unique: true,
    partialFilterExpression: { "gateway.order_ref": { $type: "string" } },
    name: "uniq_topup_order_ref",
  },
);
WalletTopupSchema.index(
  { "gateway.payment_ref": 1 },
  {
    unique: true,
    partialFilterExpression: { "gateway.payment_ref": { $type: "string" } },
    name: "uniq_topup_payment_ref",
  },
);

const WalletTopup = mongoose.model("WalletTopup", WalletTopupSchema);

export default WalletTopup;