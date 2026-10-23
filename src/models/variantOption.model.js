import mongoose from "mongoose";

const VariantOptionSchema = new mongoose.Schema(
  {
    variant_type_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "VariantType",
      required: true,
    },
    value: {
      type: String,
      required: true,
      trim: true,
    },
    label: {
      type: String,
      trim: true,
      default: "",
    },
    meta: {
      type: Map,
      of: String,
      default: {},
    },
    display_order: {
      type: Number,
      default: 1,
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
  },
  { timestamps: true, versionKey: false },
);

VariantOptionSchema.index({ variant_type_id: 1, value: 1 }, { unique: true });
VariantOptionSchema.index({ variant_type_id: 1, display_order: 1 });
VariantOptionSchema.index({ status: 1 });

const VariantOption = mongoose.model("VariantOption", VariantOptionSchema);

export default VariantOption;
