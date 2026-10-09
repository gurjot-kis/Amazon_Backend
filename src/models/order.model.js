import mongoose from "mongoose";

const { Schema } = mongoose;

const VariantSnapshotSchema = new Schema(
  {
    sku: { type: String, default: "" },
    options: [
      new Schema(
        {
          name: { type: String, default: "" },
          value: { type: String, default: "" },
        },
        { _id: false },
      ),
    ],
  },
  { _id: false },
);

const OrderItemSchema = new Schema(
  {
    product_id: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    variant_id: {
      type: Schema.Types.ObjectId,
      ref: "ProductVariant",
      default: null,
    },
    // Owner of the product when a Vendor listed it; null for SuperAdmin products.
    vendor_id: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    variant: { type: VariantSnapshotSchema, default: null },
    name: { type: String, required: true, trim: true },
    slug: { type: String, default: "", trim: true },
    mainImage: { type: String, default: "", trim: true },
    currency: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 }, // original / MRP
    sellingPrice: { type: Number, required: true, min: 0 }, // what the customer pays
    quantity: { type: Number, required: true, min: 1 },
    itemTotal: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const ShippingAddressSchema = new Schema(
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

const OrderSchema = new Schema(
  {
    user_id: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    items: { type: [OrderItemSchema], default: [] },
    shippingAddress: { type: ShippingAddressSchema, required: true },
    totalItems: { type: Number, required: true, min: 1 },
    grandTotal: { type: Number, required: true, min: 0 },
    items_total: { type: Number, required: true, min: 0 },
    price_total: { type: Number, required: true, min: 0 },
    discount: { type: Number, required: true, min: 0, default: 0 },
    handling_charge: { type: Number, default: 0, min: 0 },
    delivery_charge: { type: Number, default: 0, min: 0 },
    delivery_waived: { type: Boolean, default: false },
    small_cart_charge: { type: Number, default: 0, min: 0 },
    paymentMethod: { type: String, default: "COD", trim: true },
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

OrderSchema.index({ user_id: 1, createdAt: -1 });
OrderSchema.index({ status: 1, createdAt: -1 });

const Order = mongoose.model("Order", OrderSchema);

export default Order;
