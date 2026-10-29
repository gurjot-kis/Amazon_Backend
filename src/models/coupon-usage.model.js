import mongoose from "mongoose";

const CouponUsageSchema = new mongoose.Schema(
  {
    coupon_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Coupon",
      required: true,
    },
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    store_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Store",
      default: null,
    },
    order_id: { type: mongoose.Schema.Types.ObjectId, default: null },
    order_amount: { type: Number, required: true },
    discount_amount: { type: Number, required: true },
  },
  { timestamps: true, versionKey: false },
);

CouponUsageSchema.index({ coupon_id: 1, user_id: 1 });

export default mongoose.model("CouponUsage", CouponUsageSchema);
