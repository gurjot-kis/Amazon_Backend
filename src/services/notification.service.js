import Store from "../models/store.model.js";
import { sendPush } from "./push.service.js";

const shortId = (id) => String(id).slice(-6).toUpperCase();
const plural = (n, word) => `${n} ${word}${n > 1 ? "s" : ""}`;

const ORDER_MESSAGES = {
  placed: {
    title: "Order placed 🎉",
    text: (o) =>
      `Your order #${shortId(o._id)} (${plural(o.totalItems, "item")}, ₹${o.grandTotal}) has been placed.`,
  },
  confirmed: {
    title: "Order confirmed",
    text: (o) => `Order #${shortId(o._id)} has been confirmed.`,
  },
  packed: {
    title: "Order packed",
    text: (o) => `Order #${shortId(o._id)} is packed and ready to ship.`,
  },
  shipped: {
    title: "Order on the way 🚚",
    text: (o) => `Order #${shortId(o._id)} has been shipped.`,
  },
  delivered: {
    title: "Order delivered ✅",
    text: (o) => `Order #${shortId(o._id)} has been delivered.`,
  },
  cancelled: {
    title: "Order cancelled",
    text: (o) => `Order #${shortId(o._id)} has been cancelled.`,
  },
};

const orderData = (order, screen = "order_details") => ({
  orderId: order._id,
  storeId: order.store_id,
  screen,
});

export const NotificationService = {
  /* ------------------------------- ORDER ------------------------------- */
  orderStatusChanged: async (order, status) => {
    const msg = ORDER_MESSAGES[status];
    if (!msg) return;

    // Customer
    await sendPush({
      userIds: order.user_id,
      type: `order_${status}`,
      title: msg.title,
      body: msg.text(order),
      data: orderData(order),
    });

    // New order: also alert the vendor
    if (status === "placed") {
      const store = await Store.findById(order.store_id)
        .select("vendor_id")
        .lean();

      if (store?.vendor_id) {
        await sendPush({
          userIds: store.vendor_id,
          type: "vendor_new_order",
          title: "New order received",
          body: `Order #${shortId(order._id)} · ${plural(order.totalItems, "item")} · ₹${order.grandTotal}`,
          data: orderData(order, "vendor_order_details"),
        });
      }
    }
  },

  /* ------------------------------- OFFER ------------------------------- */
  newOffer: ({ userIds, offer }) =>
    sendPush({
      userIds,
      type: "offer",
      title: offer.title, // use your coupon field names
      body: offer.description || `Use code ${offer.code} and save more`,
      data: { offerId: offer._id, code: offer.code, screen: "offers" },
    }),
};

export default NotificationService;
