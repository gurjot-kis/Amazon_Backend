import mongoose from "mongoose";

// Required only for NON-variant products.
// For save()/create() `this` is the document. For update validators
// (findByIdAndUpdate + runValidators) `this` is a Query, so we skip the
// check there and let ProductService do the validation.
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
      default: 0, // for variant products this is the sum of variant stock
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
// partial: products without a SKU (variant products) are not indexed,
// so many of them can exist without a duplicate-null error
ProductSchema.index(
  { sku: 1 },
  { unique: true, partialFilterExpression: { sku: { $gt: "" } } },
);
ProductSchema.index({ slug: 1 }, { unique: true });
ProductSchema.index({ stockStatus: 1, status: 1 });
ProductSchema.index({ hasVariants: 1 });

const Product = mongoose.model("Product", ProductSchema);

export default Product;
