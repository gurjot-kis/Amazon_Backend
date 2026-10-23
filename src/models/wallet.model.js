import mongoose from "mongoose";

const { Schema } = mongoose;

export const WALLET_STATUSES = ["active", "frozen"];

const isInt = {
  validator: Number.isInteger,
  message: "{PATH} must be an integer (paise)",
};

const WalletSchema = new Schema(
  {
    user_id: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    balance: { type: Number, default: 0, min: 0, validate: isInt },
    currency: { type: String, default: "INR", trim: true, uppercase: true },
    status: { type: String, enum: WALLET_STATUSES, default: "active" },
  },
  { timestamps: true, versionKey: false },
);

const Wallet = mongoose.model("Wallet", WalletSchema);

export default Wallet;
