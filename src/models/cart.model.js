import mongoose from "mongoose";

const CartItemSchema = new mongoose.Schema(
  {
    product_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    // null for products without variants
    variant_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProductVariant",
      default: null,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
      default: 1,
      validate: {
        validator: Number.isInteger,
        message: "Quantity must be an integer",
      },
    },
  },
  { _id: false },
);

const CartSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    items: { type: [CartItemSchema], default: [] },
  },
  { timestamps: true, versionKey: false },
);

const Cart = mongoose.model("Cart", CartSchema);
export default Cart;
