import mongoose from "mongoose";

const CategoryAttributeSchema = new mongoose.Schema(
  {
    category_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },
    attribute_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Attribute",
      required: true,
    },
    is_required: { type: Boolean, default: false }, // vendor must fill it when adding a product
    is_filterable: { type: Boolean, default: true }, // show in filter sidebar
    display_order: { type: Number, default: 0 }, // order in sidebar and in vendor form
  },
  { timestamps: true, versionKey: false },
);

CategoryAttributeSchema.index(
  { category_id: 1, attribute_id: 1 },
  { unique: true },
);
CategoryAttributeSchema.index({ category_id: 1, display_order: 1 });

export default mongoose.model("CategoryAttribute", CategoryAttributeSchema);
