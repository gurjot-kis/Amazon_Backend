import mongoose from "mongoose";
import { STATUS_TYPE, STATUS_TYPE_VALUES } from "../constants/common.enum.js";

const BrandSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, trim: true, lowercase: true },
    logo: { type: String, default: "", trim: true },
    status: {
      type: String,
      enum: STATUS_TYPE_VALUES,
      default: STATUS_TYPE.ACTIVE,
    },
  },
  { timestamps: true, versionKey: false },
);

BrandSchema.pre("save", async function () {
  if (!this.slug && this.name) {
    this.slug = this.name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-");
  }
});

BrandSchema.index({ name: 1 }, { unique: true });
BrandSchema.index({ slug: 1 }, { unique: true });

export default mongoose.model("Brand", BrandSchema);
