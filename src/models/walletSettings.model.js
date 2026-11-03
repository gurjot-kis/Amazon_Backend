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
    max_topup: { type: Number, default: 500000, min: 100, validate: isInt }, // ₹5,000 per topup
    max_balance: { type: Number, default: 5000000, min: 100, validate: isInt }, // ₹50,000 wallet cap
    quick_topup_amounts: {
      type: [
        {
          type: Number,
          min: 100,
          validate: isInt,
        },
      ],
      default: [50000, 100000, 200000, 500000],
    },
  },
  { timestamps: true, versionKey: false },
);

const WalletSettings = mongoose.model("WalletSettings", WalletSettingsSchema);

export default WalletSettings;
