import mongoose from "mongoose";
const { Schema } = mongoose;

const OrderItemSchema = new mongoose.Schema(
  {
    product_id: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    name: { type: String, required: true, trim: true },
    slug: { type: String, default: "", trim: true },
    mainImage: { type: String, default: "", trim: true },
    currency: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 },
    sellingPrice: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1 },
    itemTotal: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const ShippingAddressSchema = new mongoose.Schema(
  {
    address_id: {
      type: Schema.Types.ObjectId,
      ref: "Address",
      required: true,
    },
    fullName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    addressLine1: { type: String, required: true, trim: true },
    addressLine2: { type: String, default: "", trim: true },
    landmark: { type: String, default: "", trim: true },
    city: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
    country: { type: String, required: true, trim: true },
    pincode: { type: String, required: true, trim: true },
    latitude: { type: Number, default: null },
    longitude: { type: Number, default: null },
  },
  { _id: false },
);

const OrderSchema = new mongoose.Schema(
  {
    user_id: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    items: {
      type: [OrderItemSchema],
      default: [],
    },
    shippingAddress: {
      type: ShippingAddressSchema,
      required: true,
    },
    totalItems: {
      type: Number,
      required: true,
      min: 1,
    },
    grandTotal: {
      type: Number,
      required: true,
      min: 0,
    },
    items_total: {
      type: Number,
      required: true,
      min: 0,
    },
    price_total: {
      type: Number,
      required: true,
      min: 0,
    },
    discount: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    handling_charge: {
      type: Number,
      default: 0,
      min: 0,
    },
    delivery_charge: {
      type: Number,
      default: 0,
      min: 0,
    },
    delivery_waived: {
      type: Boolean,
      default: false,
    },
    small_cart_charge: {
      type: Number,
      default: 0,
      min: 0,
    },
    paymentMethod: {
      type: String,
      default: "COD",
      trim: true,
    },
    paymentReceived: {
      type: Number,
      enum: [0, 1],
      default: 0,
      index: true,
    },
    status: {
      type: String,
      enum: ["placed", "confirmed", "shipped", "delivered", "cancelled"],
      default: "placed",
      index: true,
    },
  },
  { timestamps: true },
);

const Order = mongoose.model("Order", OrderSchema);

export default Order;
