import mongoose from "mongoose";

const ProductVariantSchema = new mongoose.Schema(
  {
    product_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    combination: [
      {
        variant_type_id: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "VariantType",
          required: true,
        },
        variant_option_id: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "VariantOption",
          required: true,
        },
      },
    ],
    sku: {
      type: String,
      trim: true,
      default: "",
    },
    costPrice: {
      type: Number,
      min: 0,
      default: 0,
    },
    sellingPrice: {
      type: Number,
      min: 0,
      default: 0,
    },
    price: {
      type: Number,
      min: 0,
      default: 0,
    },
    stock: {
      type: Number,
      min: 0,
      default: 0,
    },
    stockStatus: {
      type: String,
      enum: ["in_stock", "out_of_stock"],
      default: "in_stock",
    },
    images: {
      type: [String],
      default: [],
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
  },
  { timestamps: true, versionKey: false },
);

ProductVariantSchema.index({ product_id: 1 });
ProductVariantSchema.index({ product_id: 1, status: 1 });
ProductVariantSchema.index({ sku: 1 });
ProductVariantSchema.index({ stockStatus: 1, status: 1 });
ProductVariantSchema.index({
  product_id: 1,
  "combination.variant_option_id": 1,
});

const ProductVariant = mongoose.model("ProductVariant", ProductVariantSchema);

export default ProductVariant;
