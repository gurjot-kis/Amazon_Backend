import mongoose from "mongoose";

const NotifyMeSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    product_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    variant_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProductVariant",
      default: null,
    },
    store_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Store",
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "notified", "cancelled"],
      default: "pending",
    },
    notifiedAt: { type: Date },
  },
  { timestamps: true, versionKey: false },
);

// one pending request per user + product + variant
NotifyMeSchema.index(
  { user_id: 1, product_id: 1, variant_id: 1 },
  { unique: true, partialFilterExpression: { status: "pending" } },
);
NotifyMeSchema.index({ product_id: 1, status: 1 });
NotifyMeSchema.index({ status: 1, createdAt: 1 });
NotifyMeSchema.index({ user_id: 1, createdAt: -1 });
// auto-delete notified records after 30 days (docs without notifiedAt are never removed)
NotifyMeSchema.index(
  { notifiedAt: 1 },
  { expireAfterSeconds: 60 * 60 * 24 * 30 },
);

const NotifyMe = mongoose.model("NotifyMe", NotifyMeSchema);
export default NotifyMe;
