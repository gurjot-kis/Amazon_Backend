import mongoose from "mongoose";

const CouponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: [true, "Coupon code is required"],
      unique: true,
      trim: true,
      uppercase: true,
      maxlength: [50, "Coupon code cannot exceed 50 characters"],
    },
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
      maxlength: [200, "Title cannot exceed 200 characters"],
    },
    description: {
      type: String,
      default: "",
      trim: true,
      maxlength: [1000, "Description cannot exceed 1000 characters"],
    },
    discount_type: {
      type: String,
      enum: ["percentage", "fixed"],
      required: [true, "Discount type is required"],
    },
    discount_value: {
      type: Number,
      required: [true, "Discount value is required"],
      min: [0, "Discount value cannot be negative"],
    },
    min_order_amount: {
      type: Number,
      default: 0,
      min: [0, "Minimum order amount cannot be negative"],
    },
    max_discount_amount: {
      type: Number,
      default: null,
      min: [0, "Maximum discount amount cannot be negative"],
    },
    usage_limit: {
      type: Number,
      default: null,
      min: [1, "Usage limit must be at least 1"],
    },
    per_user_limit: {
      type: Number,
      default: 1,
      min: [1, "Per user limit must be at least 1"],
    },
    used_count: {
      type: Number,
      default: 0,
      min: 0,
    },
    scope: {
      type: String,
      enum: ["global", "store"],
      default: "global",
    },
    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    created_by_role: {
      type: String,
      enum: ["SuperAdmin", "Vendor"],
      required: true,
    },
    vendor_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    store_ids: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Store",
      },
    ],
    start_date: {
      type: Date,
      required: [true, "Start date is required"],
    },
    end_date: {
      type: Date,
      required: [true, "End date is required"],
    },
    status: {
      type: Number,
      enum: [0, 1],
      default: 1,
    },

    website_image: {
      type: String,
      default: null,
    },
    mobile_image: {
      type: String,
      default: null,
    },
  },
  { timestamps: true, versionKey: false },
);

CouponSchema.index({ code: 1 }, { unique: true });
CouponSchema.index({ vendor_id: 1, status: 1 });
CouponSchema.index({ scope: 1, status: 1 });
CouponSchema.index({ created_by: 1 });
CouponSchema.index({ store_ids: 1 });
CouponSchema.index({ status: 1, start_date: 1, end_date: 1 });

const Coupon = mongoose.model("Coupon", CouponSchema);

export default Coupon;
