import mongoose from "mongoose";

const CategorySchema = new mongoose.Schema(
  {
    parent_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      default: null,
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
    category_image: {
      type: String,
      default: "",
      trim: true,
    },
    display_order: {
      type: Number,
      default: 1,
    },
    level: {
      type: Number,
      required: true,
      default: 1,
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
    is_featured: {
      type: Boolean,
      default: false,
    },
    metadata: {
      type: Map,
      of: String,
      default: {},
    },
  },
  { timestamps: true, versionKey: false },
);

CategorySchema.index({ parent_id: 1, name: 1 }, { unique: true });
CategorySchema.index({ parent_id: 1, display_order: 1 });
CategorySchema.index({ status: 1, is_featured: 1 });

const Category = mongoose.model("Category", CategorySchema);

export default Category;
