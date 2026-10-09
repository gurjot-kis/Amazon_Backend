import mongoose from "mongoose";
import Order from "../models/order.model.js";
import Cart from "../models/cart.model.js";
import Product from "../models/product.model.js";
import ProductVariant from "../models/productVariant.model.js";
import Address from "../models/address.model.js";
import User from "../models/user.model.js";
import { sendEmail } from "../utils/email.js";
import { AppError } from "../utils/AppError.js";
import { toObjectId, isObjectIdLike } from "../utils/object-id.js";
import { getCartSettings } from "./cart.service.js";
import { computeCartSummary } from "./cart-settings.service.js";

/* -------------------------------------------------------------------------- */
/*                                  Constants                                 */
/* -------------------------------------------------------------------------- */

const ORDER_STATUSES = [
  "placed",
  "confirmed",
  "shipped",
  "delivered",
  "cancelled",
];
const USER_CANCELLABLE_STATUSES = ["placed", "confirmed"];
const STATUS_TRANSITIONS = {
  placed: ["confirmed", "cancelled"],
  confirmed: ["shipped", "cancelled"],
  shipped: ["delivered", "cancelled"],
  delivered: [],
  cancelled: [],
};
const ALLOWED_PAYMENT_METHODS = ["COD"];

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;

/* -------------------------------------------------------------------------- */
/*                                   Helpers                                  */
/* -------------------------------------------------------------------------- */

const normalizeString = (value) => String(value ?? "").trim();
const idToString = (value) => (value == null ? null : String(value));
const finiteOrNull = (value) =>
  value != null && Number.isFinite(value) ? value : null;
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const escapeHtml = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );

const runInTransaction = async (work) => {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await work(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
};

const parsePagination = ({ page, limit } = {}) => {
  const parsedPage = Math.max(1, parseInt(page, 10) || 1);
  const parsedLimit = Math.min(
    MAX_LIMIT,
    Math.max(1, parseInt(limit, 10) || DEFAULT_LIMIT),
  );
  return {
    page: parsedPage,
    limit: parsedLimit,
    skip: (parsedPage - 1) * parsedLimit,
  };
};

const buildPagination = (total, { page, limit }) => {
  const totalPages = Math.ceil(total / limit);
  return {
    total,
    page,
    limit,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
};

const findPaginated = async (filter, pagination) => {
  const [orders, total] = await Promise.all([
    Order.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit)
      .lean()
      .exec(),
    Order.countDocuments(filter).exec(),
  ]);
  return { orders, pagination: buildPagination(total, pagination) };
};

/* -------------------------------------------------------------------------- */
/*                                   Mappers                                  */
/* -------------------------------------------------------------------------- */

const mapItem = (item) => ({
  product_id: idToString(item.product_id),
  variant_id: idToString(item.variant_id),
  variant: item.variant || null,
  name: item.name,
  slug: item.slug || "",
  mainImage: item.mainImage || "",
  currency: item.currency,
  price: item.price,
  sellingPrice: item.sellingPrice,
  quantity: item.quantity,
  itemTotal: item.itemTotal,
});

const mapShippingAddress = (address) =>
  address
    ? {
        address_id: idToString(address.address_id),
        fullName: address.fullName,
        phone: address.phone,
        addressLine1: address.addressLine1,
        addressLine2: address.addressLine2 || "",
        landmark: address.landmark || "",
        city: address.city,
        state: address.state,
        country: address.country,
        pincode: address.pincode,
        latitude: finiteOrNull(address.latitude),
        longitude: finiteOrNull(address.longitude),
      }
    : null;

const mapSummary = (order) => {
  const summary = {
    items_total: Number(order.items_total || 0),
    price_total: Number(order.price_total || 0),
    discount: Number(order.discount || 0),
    grandTotal: Number(order.grandTotal || 0),
  };

  const handling = Number(order.handling_charge || 0);
  if (handling > 0) summary.handling_charge = handling;

  if (order.delivery_waived) {
    summary.delivery_waived = true;
  } else {
    const delivery = Number(order.delivery_charge || 0);
    if (delivery > 0) summary.delivery_charge = delivery;
  }

  const smallCart = Number(order.small_cart_charge || 0);
  if (smallCart > 0) summary.small_cart_charge = smallCart;

  return summary;
};

const mapOrder = (order) => ({
  _id: idToString(order._id),
  user_id: idToString(order.user_id),
  items: (order.items || []).map(mapItem),
  shippingAddress: mapShippingAddress(order.shippingAddress),
  totalItems: Number(order.totalItems || 0),
  grandTotal: Number(order.grandTotal || 0),
  summary: mapSummary(order),
  paymentMethod: order.paymentMethod,
  paymentReceived: Number(order.paymentReceived || 0),
  status: order.status,
  createdAt: order.createdAt,
  updatedAt: order.updatedAt,
});

const mapVendorOrder = (order, vendorId) => {
  const items = (order.items || []).filter(
    (i) => idToString(i.vendor_id) === vendorId,
  );
  return {
    _id: idToString(order._id),
    items: items.map(mapItem),
    totalItems: items.reduce((acc, i) => acc + Number(i.quantity || 0), 0),
    vendorTotal: items.reduce((acc, i) => acc + Number(i.itemTotal || 0), 0),
    shippingAddress: mapShippingAddress(order.shippingAddress),
    paymentMethod: order.paymentMethod,
    paymentReceived: Number(order.paymentReceived || 0),
    status: order.status,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
};

const getUserNameMap = async (orders) => {
  const ids = [
    ...new Set(orders.map((o) => idToString(o.user_id)).filter(Boolean)),
  ];
  if (ids.length === 0) return new Map();
  const users = await User.find({ _id: { $in: ids } })
    .select("name")
    .lean()
    .exec();
  return new Map(users.map((u) => [idToString(u._id), u.name]));
};

/* -------------------------------------------------------------------------- */
/*                                Stock helpers                               */
/* -------------------------------------------------------------------------- */

const stockPipeline = (delta) => [
  {
    $set: {
      stock: { $add: ["$stock", delta] },
      stockStatus: {
        $cond: [
          { $gt: [{ $add: ["$stock", delta] }, 0] },
          "in_stock",
          "out_of_stock",
        ],
      },
      updatedAt: "$$NOW", 
    },
  },
];

const stockBulkOps = (lines, sign) =>
  lines.map(({ id, quantity }) => ({
    updateOne: {
      filter: sign < 0 ? { _id: id, stock: { $gte: quantity } } : { _id: id },
      update: stockPipeline(sign * quantity),
    },
  }));

const adjustStock = async (items, sign, session) => {
  const run = async (Model, lines) => {
    if (lines.length === 0) return;
    const res = await Model.collection.bulkWrite(stockBulkOps(lines, sign), {
      session,
      ordered: true,
    });
    if (sign < 0 && res.modifiedCount !== lines.length) {
      throw new AppError(
        409,
        "Stock changed while placing the order, please try again",
      );
    }
  };

  await run(
    Product,
    items
      .filter((i) => !i.variant_id)
      .map((i) => ({ id: i.product_id, quantity: i.quantity })),
  );
  await run(
    ProductVariant,
    items
      .filter((i) => i.variant_id)
      .map((i) => ({ id: i.variant_id, quantity: i.quantity })),
  );
};

const restoreStock = (items, session) => adjustStock(items, 1, session);

/* -------------------------------------------------------------------------- */
/*                                    Email                                   */
/* -------------------------------------------------------------------------- */

const formatOrderStatusEmail = ({ customerName, order, status }) => {
  const name = customerName || "Customer";
  const orderId = String(order._id);
  const totalItems = Number(order.totalItems || 0);
  const grandTotal = Number(order.grandTotal || 0);
  const paymentMethod = order.paymentMethod || "COD";
  const paymentReceived =
    Number(order.paymentReceived || 0) === 1 ? "Yes" : "No";

  const subject = `Order ${orderId} is now ${status}`;
  const text = [
    `Hello ${name},`,
    "",
    `Your order status has been updated to: ${status}`,
    `Order ID: ${orderId}`,
    `Items: ${totalItems}`,
    `Grand Total: ${grandTotal}`,
    `Payment Method: ${paymentMethod}`,
    `Payment Received: ${paymentReceived}`,
    "",
    "Thank you for shopping with us.",
  ].join("\n");

  const html = `
    <p>Hello ${escapeHtml(name)},</p>
    <p>Your order status has been updated.</p>
    <p><strong>Status:</strong> ${escapeHtml(status)}</p>
    <p><strong>Order ID:</strong> ${escapeHtml(orderId)}</p>
    <p><strong>Items:</strong> ${totalItems}</p>
    <p><strong>Grand Total:</strong> ${grandTotal}</p>
    <p><strong>Payment Method:</strong> ${escapeHtml(paymentMethod)}</p>
    <p><strong>Payment Received:</strong> ${paymentReceived}</p>
    <p>Thank you for shopping with us.</p>
  `;

  return { subject, text, html };
};

const notifyStatusChange = async (order, status) => {
  try {
    const customer = await User.findById(order.user_id)
      .select("name email")
      .lean()
      .exec();
    if (!customer?.email) return;
    const { subject, text, html } = formatOrderStatusEmail({
      customerName: customer.name,
      order,
      status,
    });
    await sendEmail({ to: customer.email, subject, text, html });
  } catch (err) {
    console.error("[order] status email failed:", err?.message);
  }
};

/* -------------------------------------------------------------------------- */
/*                                   Service                                  */
/* -------------------------------------------------------------------------- */

export const OrderService = {
  /* ------------------------------- Customer ------------------------------- */

  placeOrder: async ({ user_id, address_id, paymentMethod }) => {
    const userId = toObjectId(user_id, "user_id");
    const addressId = toObjectId(address_id, "address_id");

    const method = normalizeString(paymentMethod).toUpperCase() || "COD";
    if (!ALLOWED_PAYMENT_METHODS.includes(method)) {
      throw new AppError(400, "Unsupported payment method");
    }

    // Same settings source as the cart, so cart total === order total.
    const settings = await getCartSettings("Product");

    const order = await runInTransaction(async (session) => {
      const [address, cart] = await Promise.all([
        Address.findOne({ _id: addressId, user_id: userId })
          .session(session)
          .lean()
          .exec(),
        Cart.findOne({ user_id: userId }).session(session).lean().exec(),
      ]);

      if (!address) throw new AppError(404, "Address not found");
      if (!cart || cart.items.length === 0) {
        throw new AppError(400, "Cart is empty");
      }

      // One line per product + variant combination.
      const lines = new Map();
      for (const item of cart.items) {
        const quantity = Number(item.quantity);
        if (!Number.isInteger(quantity) || quantity < 1) {
          throw new AppError(400, "Cart contains an invalid item");
        }
        const key = `${item.product_id}:${item.variant_id || ""}`;
        const existing = lines.get(key);
        if (existing) existing.quantity += quantity;
        else {
          lines.set(key, {
            product_id: item.product_id,
            variant_id: item.variant_id || null,
            quantity,
          });
        }
      }
      const lineList = [...lines.values()];

      const productIds = [
        ...new Set(lineList.map((l) => String(l.product_id))),
      ];
      const variantIds = lineList
        .filter((l) => l.variant_id)
        .map((l) => l.variant_id);

      const [products, variants] = await Promise.all([
        Product.find({ _id: { $in: productIds } })
          .session(session)
          .lean()
          .exec(),
        variantIds.length
          ? ProductVariant.find({ _id: { $in: variantIds } })
              .populate("combination.variant_type_id", "name")
              .populate("combination.variant_option_id", "value label")
              .session(session)
              .lean()
              .exec()
          : [],
      ]);
      const productMap = new Map(products.map((p) => [String(p._id), p]));
      const variantMap = new Map(variants.map((v) => [String(v._id), v]));

      const items = lineList.map(({ product_id, variant_id, quantity }) => {
        const product = productMap.get(String(product_id));
        if (!product || product.status !== "active") {
          throw new AppError(
            409,
            "Some products in your cart are no longer available",
          );
        }

        let variant = null;
        if (product.hasVariants) {
          variant = variant_id ? variantMap.get(String(variant_id)) : null;
          if (
            !variant ||
            variant.status !== "active" ||
            String(variant.product_id) !== String(product._id)
          ) {
            throw new AppError(
              409,
              `"${product.name}" variant is no longer available`,
            );
          }
        } else if (variant_id) {
          throw new AppError(409, `"${product.name}" has no variants`);
        }

        const source = variant || product;
        const availableStock = Number(source.stock || 0);
        if (source.stockStatus !== "in_stock" || availableStock < quantity) {
          throw new AppError(
            409,
            `Insufficient stock for "${product.name}". Available: ${availableStock}, Requested: ${quantity}`,
          );
        }

        // Customer pays sellingPrice; price is the original (MRP).
        const price = Number(variant?.price || product.price || 0);
        const sellingPrice = Number(
          variant?.sellingPrice || product.sellingPrice || 0,
        );

        return {
          product_id: product._id,
          variant_id: variant?._id ?? null,
          vendor_id:
            product.role === "Vendor" ? (product.user_id ?? null) : null,
          variant: variant
            ? {
                sku: variant.sku || "",
                options: (variant.combination || []).map((c) => ({
                  name: c.variant_type_id?.name || "",
                  value:
                    c.variant_option_id?.label ||
                    c.variant_option_id?.value ||
                    "",
                })),
              }
            : null,
          name: product.name,
          slug: product.slug || "",
          mainImage: variant?.images?.[0] || product.mainImage || "",
          currency: product.currency,
          price,
          sellingPrice,
          quantity,
          itemTotal: sellingPrice * quantity,
        };
      });

      const totalItems = items.reduce((acc, i) => acc + i.quantity, 0);
      const summary = computeCartSummary(items, settings);

      // Atomic, guarded stock reservation (products and variants).
      await adjustStock(items, -1, session);

      const [created] = await Order.create(
        [
          {
            user_id: userId,
            items,
            shippingAddress: {
              address_id: address._id,
              fullName: address.fullName,
              phone: address.phone,
              addressLine1: address.addressLine1,
              addressLine2: address.addressLine2 || "",
              landmark: address.landmark || "",
              city: address.city,
              state: address.state,
              country: address.country,
              pincode: address.pincode,
              latitude: finiteOrNull(address.latitude),
              longitude: finiteOrNull(address.longitude),
            },
            totalItems,
            grandTotal: summary.grandTotal,
            items_total: summary.items_total,
            price_total: summary.price_total,
            discount: summary.discount,
            handling_charge: summary.handling_charge || 0,
            delivery_charge: summary.delivery_charge || 0,
            delivery_waived: Boolean(summary.delivery_waived),
            small_cart_charge: summary.small_cart_charge || 0,
            paymentMethod: method,
            status: "placed",
          },
        ],
        { session },
      );

      await Cart.updateOne(
        { user_id: userId },
        { $set: { items: [] } },
        { session },
      );

      return created.toObject();
    });

    return mapOrder(order);
  },

  listUserOrders: async ({ user_id, page, limit }) => {
    const userId = toObjectId(user_id, "user_id");
    const { orders, pagination } = await findPaginated(
      { user_id: userId },
      parsePagination({ page, limit }),
    );
    return { orders: orders.map(mapOrder), pagination };
  },

  getUserOrderById: async ({ user_id, order_id }) => {
    const userId = toObjectId(user_id, "user_id");
    const orderId = toObjectId(order_id, "order_id");

    const order = await Order.findOne({ _id: orderId, user_id: userId })
      .lean()
      .exec();
    if (!order) throw new AppError(404, "Order not found");

    return mapOrder(order);
  },

  cancelUserOrder: async ({ user_id, order_id }) => {
    const userId = toObjectId(user_id, "user_id");
    const orderId = toObjectId(order_id, "order_id");

    const order = await runInTransaction(async (session) => {
      // Single atomic status flip prevents double-cancel / double stock restore.
      const cancelled = await Order.findOneAndUpdate(
        {
          _id: orderId,
          user_id: userId,
          status: { $in: USER_CANCELLABLE_STATUSES },
        },
        { $set: { status: "cancelled" } },
        { new: true, session },
      ).exec();

      if (!cancelled) {
        const exists = await Order.exists({
          _id: orderId,
          user_id: userId,
        }).session(session);
        throw exists
          ? new AppError(409, "Order cannot be cancelled")
          : new AppError(404, "Order not found");
      }

      await restoreStock(cancelled.items, session);
      return cancelled.toObject();
    });

    return mapOrder(order);
  },

  /* --------------------------------- Admin -------------------------------- */

  listAdminOrders: async ({ status, search, page, limit, user_id }) => {
    const filter = {};

    if (user_id) filter.user_id = toObjectId(user_id, "user_id");

    if (status) {
      const normalizedStatus = normalizeString(status).toLowerCase();
      if (!ORDER_STATUSES.includes(normalizedStatus)) {
        throw new AppError(400, "Invalid order status");
      }
      filter.status = normalizedStatus;
    }

    const term = normalizeString(search);
    if (term) {
      const regex = new RegExp(escapeRegex(term), "i");
      const matchedUsers = await User.find({ name: regex })
        .select("_id")
        .limit(100)
        .lean()
        .exec();

      const or = [
        { "shippingAddress.city": regex },
        { "shippingAddress.state": regex },
        { status: regex },
      ];
      if (matchedUsers.length > 0) {
        or.push({ user_id: { $in: matchedUsers.map((u) => u._id) } });
      }
      if (isObjectIdLike(term)) or.push({ _id: term });

      filter.$or = or;
    }

    const { orders, pagination } = await findPaginated(
      filter,
      parsePagination({ page, limit }),
    );
    const userMap = await getUserNameMap(orders);

    return {
      orders: orders.map((order) => ({
        ...mapOrder(order),
        user_name: userMap.get(idToString(order.user_id)) || null,
      })),
      pagination,
    };
  },

  getAdminOrderById: async ({ order_id }) => {
    const orderId = toObjectId(order_id, "order_id");

    const order = await Order.findById(orderId).lean().exec();
    if (!order) throw new AppError(404, "Order not found");

    const userMap = await getUserNameMap([order]);
    return {
      ...mapOrder(order),
      user_name: userMap.get(idToString(order.user_id)) || null,
    };
  },

  updateOrderStatus: async ({ order_id, status, paymentReceived }) => {
    const orderId = toObjectId(order_id, "order_id");
    const nextStatus = normalizeString(status).toLowerCase();

    if (!nextStatus) throw new AppError(400, "status is required");
    if (!ORDER_STATUSES.includes(nextStatus)) {
      throw new AppError(400, "Invalid order status");
    }

    let nextPaymentReceived;
    if (paymentReceived !== undefined) {
      nextPaymentReceived = Number(paymentReceived);
      if (![0, 1].includes(nextPaymentReceived)) {
        throw new AppError(400, "paymentReceived must be 0 or 1");
      }
    }

    const order = await runInTransaction(async (session) => {
      const doc = await Order.findById(orderId).session(session).exec();
      if (!doc) throw new AppError(404, "Order not found");

      const previousStatus = doc.status;
      if (nextStatus !== previousStatus) {
        if (!STATUS_TRANSITIONS[previousStatus]?.includes(nextStatus)) {
          throw new AppError(
            409,
            `Cannot change order status from ${previousStatus} to ${nextStatus}`,
          );
        }
        doc.status = nextStatus;
      }
      if (nextPaymentReceived !== undefined) {
        doc.paymentReceived = nextPaymentReceived;
      }

      await doc.save({ session });

      if (nextStatus === "cancelled" && previousStatus !== "cancelled") {
        await restoreStock(doc.items, session);
      }

      return {
        data: doc.toObject(),
        statusChanged: previousStatus !== nextStatus,
      };
    });

    if (order.statusChanged) void notifyStatusChange(order.data, nextStatus);

    return mapOrder(order.data);
  },

  /* --------------------------------- Vendor -------------------------------- */

  listVendorOrders: async ({ vendor_id, status, page, limit }) => {
    const vendorId = toObjectId(vendor_id, "vendor_id");
    const filter = { "items.vendor_id": vendorId };

    if (status) {
      const normalizedStatus = normalizeString(status).toLowerCase();
      if (!ORDER_STATUSES.includes(normalizedStatus)) {
        throw new AppError(400, "Invalid order status");
      }
      filter.status = normalizedStatus;
    }

    const { orders, pagination } = await findPaginated(
      filter,
      parsePagination({ page, limit }),
    );
    return {
      orders: orders.map((order) => mapVendorOrder(order, String(vendorId))),
      pagination,
    };
  },

  getVendorOrderById: async ({ vendor_id, order_id }) => {
    const vendorId = toObjectId(vendor_id, "vendor_id");
    const orderId = toObjectId(order_id, "order_id");

    const order = await Order.findOne({
      _id: orderId,
      "items.vendor_id": vendorId,
    })
      .lean()
      .exec();
    if (!order) throw new AppError(404, "Order not found");

    return mapVendorOrder(order, String(vendorId));
  },
};

export default OrderService;
