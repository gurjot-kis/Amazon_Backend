import Store from "../models/store.model.js";
import { toObjectId } from "../utils/object-id.js";
import { sendPush } from "./push.service.js";
import Notification from "../models/notification.model.js";
import { AppError } from "../utils/AppError.js";

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

const mapNotification = (n) => ({
  _id: String(n._id),
  type: n.type,
  title: n.title,
  body: n.body,
  imageUrl: n.imageUrl || "",
  data: n.data || {},
  isRead: n.isRead,
  createdAt: n.createdAt,
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

  /* ------------------------------- INBOX ------------------------------- */
  listNotifications: async ({ user_id, page, limit, notificationType }) => {
    const userId = toObjectId(user_id, "user_id");
    const p = Math.max(1, parseInt(page, 10) || 1);
    const l = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));

    const includeRead = String(notificationType || "").toLowerCase() === "read";

    // default: only unread | notificationType=read: unread + read
    const filter = includeRead ? { userId } : { userId, isRead: false };

    const [items, total, unreadCount] = await Promise.all([
      Notification.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip((p - 1) * l)
        .limit(l)
        .lean()
        .exec(),
      Notification.countDocuments(filter).exec(),
      Notification.countDocuments({ userId, isRead: false }).exec(),
    ]);

    const totalPages = Math.ceil(total / l);
    return {
      notifications: items.map(mapNotification),
      unreadCount,
      pagination: {
        total,
        page: p,
        limit: l,
        totalPages,
        hasNextPage: p < totalPages,
        hasPrevPage: p > 1,
      },
    };
  },

  markAsRead: async ({ user_id, notification_id }) => {
    const userId = toObjectId(user_id, "user_id");
    const id = toObjectId(notification_id, "notification_id");

    const updated = await Notification.findOneAndUpdate(
      { _id: id, userId },
      { $set: { isRead: true } },
      { new: true },
    )
      .lean()
      .exec();

    if (!updated) throw new AppError(404, "Notification not found");
    return mapNotification(updated);
  },

  markAllAsRead: async ({ user_id }) => {
    const userId = toObjectId(user_id, "user_id");
    const res = await Notification.updateMany(
      { userId, isRead: false },
      { $set: { isRead: true } },
    );
    return { updated: res.modifiedCount };
  },
};

export default NotificationService;
