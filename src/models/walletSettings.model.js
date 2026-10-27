import mongoose from "mongoose";

const { Schema } = mongoose;

const isInt = {
  validator: Number.isInteger,
  message: "{PATH} must be an integer (paise)",
};

const WalletSettingsSchema = new Schema(
  {
    key: { type: String, default: "default", unique: true },
    enabled: { type: Boolean, default: true },
    min_topup: { type: Number, default: 1000, min: 100, validate: isInt }, // ₹10
    max_topup: { type: Number, default: 1000000, min: 100, validate: isInt }, // ₹10,000 per topup
    max_balance: { type: Number, default: 5000000, min: 100, validate: isInt }, // ₹50,000 wallet cap
  },
  { timestamps: true, versionKey: false },
);

const WalletSettings = mongoose.model("WalletSettings", WalletSettingsSchema);

export default WalletSettings;
