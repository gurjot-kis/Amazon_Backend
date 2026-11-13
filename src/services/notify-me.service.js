import mongoose from "mongoose";
import NotifyMe from "../models/notifyme.model.js";
import Product from "../models/product.model.js";
import ProductVariant from "../models/productVariant.model.js";
import Store from "../models/store.model.js";
import NotificationService from "./notification.service.js";
import { AppError } from "../utils/AppError.js";

const assertObjectId = (id, label) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError(400, `Invalid ${label}`);
  }
};

const isStoreLive = (store_id) =>
  Store.exists({
    _id: store_id,
    status: "active",
    verification_status: "verified",
  });

export const NotifyMeService = {
  subscribe: async ({ user_id, product_id, variant_id = null }) => {
    assertObjectId(product_id, "product ID");
    if (variant_id) assertObjectId(variant_id, "variant ID");

    const product = await Product.findById(product_id)
      .select("store_id status hasVariants stock")
      .lean();
    if (!product || product.status !== "active") {
      throw new AppError(404, "Product not found");
    }
    if (!(await isStoreLive(product.store_id))) {
      throw new AppError(404, "Product not found");
    }

    let outOfStock;
    if (product.hasVariants) {
      if (!variant_id)
        throw new AppError(400, "Variant is required for this product");
      const variant = await ProductVariant.findOne({
        _id: variant_id,
        product_id,
        status: "active",
      })
        .select("stock")
        .lean();
      if (!variant) throw new AppError(404, "Variant not found");
      outOfStock = variant.stock <= 0;
    } else {
      if (variant_id) throw new AppError(400, "This product has no variants");
      outOfStock = product.stock <= 0;
    }

    if (!outOfStock) throw new AppError(400, "This item is already in stock");

    const filter = {
      user_id,
      product_id,
      variant_id: variant_id || null,
      status: "pending",
    };

    try {
      return await NotifyMe.findOneAndUpdate(
        filter,
        { $setOnInsert: { store_id: product.store_id } },
        { upsert: true, new: true },
      ).lean();
    } catch (err) {
      // two taps at the same time -> unique index fires, return the existing one
      if (err.code === 11000) return NotifyMe.findOne(filter).lean();
      throw err;
    }
  },

  unsubscribe: async ({ user_id, id }) => {
    assertObjectId(id, "request ID");
    const res = await NotifyMe.findOneAndUpdate(
      { _id: id, user_id, status: "pending" },
      { $set: { status: "cancelled" } },
      { new: true },
    ).lean();
    if (!res) throw new AppError(404, "Notify request not found");
    return res;
  },

  listMine: async ({ user_id }) =>
    NotifyMe.find({ user_id, status: "pending" })
      .sort({ createdAt: -1 })
      .populate("product_id", "name mainImage")
      .populate("store_id", "store_name")
      .lean(),

  notifyForProduct: async (productId) => {
    const pending = await NotifyMe.find({
      product_id: productId,
      status: "pending",
    }).lean();
    if (!pending.length) return { sent: 0 };

    const product = await Product.findById(productId)
      .select("name mainImage stock status store_id hasVariants")
      .lean();
    if (!product) {
      await NotifyMe.updateMany(
        { product_id: productId, status: "pending" },
        { $set: { status: "cancelled" } },
      );
      return { sent: 0 };
    }
    if (product.status !== "active") return { sent: 0 };
    if (!(await isStoreLive(product.store_id))) return { sent: 0 };

    let variantMap = new Map();
    if (product.hasVariants) {
      const variants = await ProductVariant.find({ product_id: productId })
        .select("stock status")
        .lean();
      variantMap = new Map(variants.map((v) => [String(v._id), v]));
    }

    let sent = 0;
    for (const reqDoc of pending) {
      let available = false;
      let stale = false;

      if (reqDoc.variant_id) {
        const v = variantMap.get(String(reqDoc.variant_id));
        if (!v) stale = true;
        else available = v.status === "active" && v.stock > 0;
      } else if (product.hasVariants) {
        stale = true;
      } else {
        available = product.stock > 0;
      }

      if (stale) {
        await NotifyMe.updateOne(
          { _id: reqDoc._id, status: "pending" },
          { $set: { status: "cancelled" } },
        );
        continue;
      }
      if (!available) continue;

      const claimed = await NotifyMe.findOneAndUpdate(
        { _id: reqDoc._id, status: "pending" },
        { $set: { status: "notified", notifiedAt: new Date() } },
      );
      if (!claimed) continue;

      const revert = () =>
        NotifyMe.updateOne(
          { _id: reqDoc._id },
          { $set: { status: "pending" }, $unset: { notifiedAt: "" } },
        );

      try {
        const result = await NotificationService.backInStock({
          userId: reqDoc.user_id,
          product,
          variantId: reqDoc.variant_id,
        });

        if (result?.ok && result.success > 0) {
          sent += 1;
          console.log("notification sent :)");
        } else if (!result?.ok || (result.tokens > 0 && result.success === 0)) {
          await revert();
        }
      } catch (err) {
        await revert();
        console.error("[notify-me] push failed:", err?.message);
      }
    }

    return { sent };
  },

  getUserRequests: ({ user_id, product_ids }) => {
    if (!user_id || !product_ids?.length) return [];
    return NotifyMe.find({
      user_id,
      product_id: { $in: product_ids },
      status: "pending",
    })
      .select("_id product_id variant_id")
      .lean();
  },

  processPending: async () => {
    const productIds = await NotifyMe.distinct("product_id", {
      status: "pending",
    });
    let sent = 0;
    for (const pid of productIds.slice(0, 200)) {
      try {
        sent += (await NotifyMeService.notifyForProduct(pid)).sent;
      } catch (err) {
        console.error("[notify-me] product failed:", String(pid), err?.message);
      }
    }
    return { checked: productIds.length, sent };
  },

  cancelForProduct: (product_id) =>
    NotifyMe.updateMany(
      { product_id, status: "pending" },
      { $set: { status: "cancelled" } },
    ),
};

export default NotifyMeService;
