import mongoose from "mongoose";

const requiredUnlessVariants = function () {
  return this instanceof mongoose.Document ? !this.hasVariants : false;
};

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
      required: requiredUnlessVariants,
      trim: true,
      uppercase: true,
      default: undefined,
    },
    slug: {
      type: String,
      trim: true,
      lowercase: true,
    },
    currency: {
      type: String,
      required: requiredUnlessVariants,
      trim: true,
      uppercase: true,
      default: undefined,
    },
    costPrice: {
      type: Number,
      required: requiredUnlessVariants,
      min: 0,
      default: undefined,
    },
    sellingPrice: {
      type: Number,
      required: requiredUnlessVariants,
      min: 0,
      default: undefined,
    },
    price: {
      type: Number,
      required: requiredUnlessVariants,
      min: 0,
      default: undefined,
    },
    stock: {
      type: Number,
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
      enum: ["pending", "active", "rejected", "inactive"],
      default: "pending",
    },
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    store_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Store",
      required: true,
    },
    role: {
      type: String,
      enum: ["SuperAdmin", "User", "Vendor"],
      index: true,
    },

    hasVariants: {
      type: Boolean,
      default: false,
    },
    variantTypes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "VariantType",
      },
    ],

    imageGroupTypeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "VariantType",
      default: null,
    },

    unit: {
      type: String,
      trim: true,
      default: undefined,
    },

    brand_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Brand",
      default: null,
    },
    attributes: [
      {
        _id: false,
        key: { type: String, required: true, trim: true, lowercase: true },
        value: { type: String, trim: true },
        num_value: { type: Number },
      },
    ],
    min_price: { type: Number, min: 0, default: 0 },
    max_price: { type: Number, min: 0, default: 0 },
    variant_option_ids: [
      { type: mongoose.Schema.Types.ObjectId, ref: "VariantOption" },
    ],
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

  if (!this.hasVariants && this.price != null) {
    this.min_price = this.price;
    this.max_price = this.price;
  }
});

ProductSchema.index({ category_id: 1 });
ProductSchema.index({ status: 1 });
ProductSchema.index(
  { sku: 1 },
  { unique: true, partialFilterExpression: { sku: { $gt: "" } } },
);
ProductSchema.index({ slug: 1 }, { unique: true });
ProductSchema.index({ stockStatus: 1, status: 1 });
ProductSchema.index({ hasVariants: 1 });
ProductSchema.index({ category_id: 1, status: 1, brand_id: 1 });
ProductSchema.index({ category_id: 1, status: 1, min_price: 1, max_price: 1 });
ProductSchema.index({
  category_id: 1,
  status: 1,
  "attributes.key": 1,
  "attributes.value": 1,
});
ProductSchema.index({ variant_option_ids: 1 });

const Product = mongoose.model("Product", ProductSchema);

export default Product;
