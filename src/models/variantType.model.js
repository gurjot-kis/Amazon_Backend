import mongoose from "mongoose";

const VariantTypeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      trim: true,
      lowercase: true,
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

VariantTypeSchema.pre("save", function () {
  if (!this.slug && this.name) {
    this.slug = this.name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-");
  }
});

VariantTypeSchema.index({ slug: 1 }, { unique: true });
VariantTypeSchema.index({ status: 1 });
VariantTypeSchema.index({ display_order: 1 });

const VariantType = mongoose.model("VariantType", VariantTypeSchema);

export default VariantType;
