import mongoose from "mongoose";

const { Schema } = mongoose;

export const WALLET_TXN_TYPES = ["credit", "debit"];
export const WALLET_TXN_SOURCES = [
  "topup",
  "order_payment",
  "order_refund",
  "admin_adjustment",
];
export const WALLET_REFERENCE_TYPES = ["WalletTopup", "Order", "Payment"];

const isInt = {
  validator: Number.isInteger,
  message: "{PATH} must be an integer (paise)",
};

const WalletTransactionSchema = new Schema(
  {
    wallet_id: { type: Schema.Types.ObjectId, ref: "Wallet", required: true },
    user_id: { type: Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, enum: WALLET_TXN_TYPES, required: true },
    amount: { type: Number, required: true, min: 1, validate: isInt },
    balance_after: { type: Number, required: true, min: 0, validate: isInt },
    source: { type: String, enum: WALLET_TXN_SOURCES, required: true },
    reference_type: {
      type: String,
      enum: WALLET_REFERENCE_TYPES,
      default: null,
    },
    reference_id: { type: Schema.Types.ObjectId, default: null },
    // Same key can never be written twice, so a retry cannot double-credit.
    // Examples: "topup:<topup_id>", "order:<order_id>", "refund:<order_id>"
    idempotency_key: { type: String, required: true, trim: true },
    note: { type: String, default: "", trim: true, maxlength: 500 },
    created_by: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
);

WalletTransactionSchema.index({ idempotency_key: 1 }, { unique: true });
WalletTransactionSchema.index({ wallet_id: 1, createdAt: -1 });
WalletTransactionSchema.index({ user_id: 1, createdAt: -1 });
WalletTransactionSchema.index({ reference_type: 1, reference_id: 1 });

// The ledger is append-only: block edits and deletes.
const blockChange = function () {
  throw new Error("Wallet transactions are immutable");
};
[
  "updateOne",
  "updateMany",
  "findOneAndUpdate",
  "findOneAndReplace",
  "deleteOne",
  "deleteMany",
  "findOneAndDelete",
].forEach((op) => WalletTransactionSchema.pre(op, blockChange));

const WalletTransaction = mongoose.model(
  "WalletTransaction",
  WalletTransactionSchema,
);

export default WalletTransaction;
