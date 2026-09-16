import mongoose from "mongoose";
import crypto from "crypto";

const ProductSchema = new mongoose.Schema(
  {
    category_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
      trim: true,
    },
    short_description: {
      type: String,
      default: "",
      trim: true,
    },
    mainImage: {
      type: String,
      required: true,
      trim: true,
    },
    featuredImages: {
      type: [String],
      default: [],
    },
    sku: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      trim: true,
      lowercase: true,
    },
    currency: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    costPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    sellingPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    stock: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    stockStatus: {
      type: String,
      enum: ["in_stock", "out_of_stock"],
      required: true,
      default: "in_stock",
    },
    status: {
      type: String,
      enum: ["pending", "active", "rejected"],
      default: "pending",
    },
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    role: {
      type: String,
      enum: ["SuperAdmin", "User", "Vendor"],
      index: true,
    },
  },
  { timestamps: true, versionKey: false },
);

ProductSchema.pre("save", async function () {
  if (!this.slug && this.name) {
    this.slug = this.name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-");
  }
});

ProductSchema.index({ category_id: 1 });
ProductSchema.index({ status: 1 });
ProductSchema.index({ sku: 1 });
ProductSchema.index({ slug: 1 });
ProductSchema.index({ stockStatus: 1, status: 1 });

const Product = mongoose.model("Product", ProductSchema);

export default Product;
