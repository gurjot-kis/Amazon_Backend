import mongoose from "mongoose";
import crypto from "crypto";

const CartSettingsSchema = new mongoose.Schema(
  {
    cart_settings_id: {
      type: String,
      required: true,
      unique: true,
      default: () => crypto.randomUUID(),
    },
    handling_charge: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    delivery_charge: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    free_delivery_min_amount: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    small_cart_charge: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    small_cart_max_amount: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    user_id: {
      type: String,
      trim: true,
      default: "",
      index: true,
    },
    role: {
      type: String,
      trim: true,
      default: "SuperAdmin",
      index: true,
    },
    type: {
      type: String,
      default: undefined,
    },
  },
  { timestamps: true },
);

const CartSettings = mongoose.model("CartSettings", CartSettingsSchema);

export default CartSettings;
