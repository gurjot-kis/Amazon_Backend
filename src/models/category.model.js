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
    category_type: {
      type: String,
      enum: ["quick_commerce", "standard_commerce"],
      default: "standard_commerce",
      required: true,
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
    ancestors: [{ type: mongoose.Schema.Types.ObjectId, ref: "Category" }],
  },
  { timestamps: true, versionKey: false },
);

CategorySchema.index({ parent_id: 1, name: 1 }, { unique: true });
CategorySchema.index({ category_type: 1 });
CategorySchema.index({ parent_id: 1, display_order: 1 });
CategorySchema.index({ status: 1, is_featured: 1 });
CategorySchema.index({ ancestors: 1 });

CategorySchema.pre("save", async function () {
  if (!this.isNew && !this.isModified("parent_id")) return;

  if (!this.parent_id) {
    this.ancestors = [];
    this.level = 1;
    return;
  }

  const parent = await mongoose
    .model("Category")
    .findById(this.parent_id)
    .select("ancestors level");
  if (!parent) throw new Error("Parent category not found");

  this.ancestors = [...parent.ancestors, parent._id];
  this.level = parent.level + 1;
});

const Category = mongoose.model("Category", CategorySchema);

export default Category;
