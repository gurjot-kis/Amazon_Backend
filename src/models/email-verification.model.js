import mongoose from "mongoose";

const EmailVerificationSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      unique: true,
    },
    otpHash: { type: String, default: null },
    otpExpiry: { type: Date, default: null },
    attempts: { type: Number, default: 0 },
    verified: { type: Boolean, default: false },
    lastSentAt: { type: Date, default: null },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

EmailVerificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model("EmailVerification", EmailVerificationSchema);
