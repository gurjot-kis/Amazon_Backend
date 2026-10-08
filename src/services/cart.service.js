import mongoose from "mongoose";
import Cart from "../models/cart.model.js";
import Product from "../models/product.model.js";
import CartSettings from "../models/cart-settings.model.js";
import ProductVariant from "../models/productVariant.model.js";
import { AppError } from "../utils/AppError.js";

const MAX_QTY_PER_ITEM = 10;

const DEFAULT_CART_SETTINGS = {
  handling_charge: 10,
  delivery_charge: 30,
  free_delivery_min_amount: 150,
  small_cart_charge: 0,
  small_cart_max_amount: 0,
};

const getCartSettings = async (type = "Product") => {
  const settings = await CartSettings.findOne({ type }).lean();
  return { ...DEFAULT_CART_SETTINGS, ...(settings || {}) };
};

const getMaxAllowedQty = async (productId, variantId) => {
  const product = await Product.findById(productId)
    .select("status stock stockStatus hasVariants")
    .lean();

  if (!product || product.status !== "active") {
    throw new AppError("Product not available", 404);
  }

  let stock;

  if (product.hasVariants) {
    if (!variantId)
      throw new AppError("Variant is required for this product", 400);

    const variant = await ProductVariant.findOne({
      _id: variantId,
      product_id: productId,
    })
      .select("status stock stockStatus")
      .lean();

    if (!variant || variant.status !== "active") {
      throw new AppError("Variant not available", 404);
    }
    if (variant.stockStatus !== "in_stock" || variant.stock <= 0) {
      throw new AppError("Variant is out of stock", 409);
    }
    stock = variant.stock;
  } else {
    if (variantId) throw new AppError("This product has no variants", 400);
    if (product.stockStatus !== "in_stock" || product.stock <= 0) {
      throw new AppError("Product is out of stock", 409);
    }
    stock = product.stock;
  }

  return Math.min(stock, MAX_QTY_PER_ITEM);
};

const itemMatch = (productId, variantId) => ({
  product_id: new mongoose.Types.ObjectId(productId),
  variant_id: variantId ? new mongoose.Types.ObjectId(variantId) : null,
});

const summarize = (cart, productId, variantId) => {
  const line = cart?.items.find(
    (i) =>
      String(i.product_id) === String(productId) &&
      String(i.variant_id || "") === String(variantId || ""),
  );

  return {
    productId,
    variantId: variantId || null,
    quantity: line ? line.quantity : 0,
    totalItems: cart ? cart.items.reduce((sum, i) => sum + i.quantity, 0) : 0,
  };
};

export const CartService = {
  getCart: async (userId) => {
    const emptyCart = {
      items: [],
      totalItems: 0,
      subtotal: 0,
      deliveryFee: 0,
      handlingFee: 0,
      smallCartFee: 0,
      grandTotal: 0,
    };

    const [cart, settings] = await Promise.all([
      Cart.findOne({ user_id: userId })
        .populate("items.product_id", "name slug mainImage price currency")
        .populate({
          path: "items.variant_id",
          select: "sku price images combination",
          populate: [
            { path: "combination.variant_type_id", select: "name" },
            { path: "combination.variant_option_id", select: "value label" },
          ],
        })
        .lean(),
      getCartSettings("Product"),
    ]);

    if (!cart) return emptyCart;

    const items = cart.items
      .filter((i) => i.product_id) 
      .map((i) => {
        const product = i.product_id;
        const variant = i.variant_id || null;

        const unitPrice = variant?.price || product.price;

        return {
          productId: product._id,
          variantId: variant?._id || null,
          name: product.name,
          slug: product.slug,
          image: variant?.images?.[0] || product.mainImage,
          currency: product.currency,
          unitPrice,
          quantity: i.quantity,
          lineTotal: unitPrice * i.quantity,
          variant: variant
            ? {
                sku: variant.sku || null,
                options: (variant.combination || []).map((c) => ({
                  type: c.variant_type_id?.name || null,
                  value:
                    c.variant_option_id?.label ||
                    c.variant_option_id?.value ||
                    null,
                })),
              }
            : null,
        };
      });

    // No valid items left (e.g. all products deleted) -> no fees
    if (items.length === 0) return emptyCart;

    const subtotal = items.reduce((s, i) => s + i.lineTotal, 0);

    // Free delivery once subtotal reaches the configured minimum
    const deliveryFee =
      subtotal >= settings.free_delivery_min_amount
        ? 0
        : settings.delivery_charge;

    const handlingFee = settings.handling_charge;

    // Small cart surcharge when subtotal is below the configured max
    const smallCartFee =
      settings.small_cart_charge > 0 &&
      subtotal < settings.small_cart_max_amount
        ? settings.small_cart_charge
        : 0;

    const grandTotal = subtotal + deliveryFee + handlingFee + smallCartFee;

    return {
      items,
      totalItems: items.reduce((s, i) => s + i.quantity, 0),
      subtotal,
      deliveryFee,
      handlingFee,
      smallCartFee,
      grandTotal,
    };
  },

  addToCart: async ({
    userId,
    productId,
    variantId = null,
    quantity = 1,
    _retry = true,
  }) => {
    const maxQty = await getMaxAllowedQty(productId, variantId);

    if (quantity > maxQty) {
      throw new AppError(
        `Only ${maxQty} unit(s) can be added for this item`,
        409,
      );
    }

    const match = itemMatch(productId, variantId);

    // 1) Line exists and stays within limit -> atomic increment
    let cart = await Cart.findOneAndUpdate(
      {
        user_id: userId,
        items: {
          $elemMatch: { ...match, quantity: { $lte: maxQty - quantity } },
        },
      },
      { $inc: { "items.$.quantity": quantity } },
      { new: true },
    );
    if (cart) return summarize(cart, productId, variantId);

    // 2) Line exists but increment would exceed limit
    const exists = await Cart.exists({
      user_id: userId,
      items: { $elemMatch: match },
    });
    if (exists) {
      throw new AppError(
        `Cart limit reached. Max ${maxQty} unit(s) allowed for this item`,
        409,
      );
    }

    // 3) Line doesn't exist -> push (creates cart if needed)
    try {
      cart = await Cart.findOneAndUpdate(
        { user_id: userId, items: { $not: { $elemMatch: match } } },
        { $push: { items: { ...match, quantity } } },
        { new: true, upsert: true },
      );
      return summarize(cart, productId, variantId);
    } catch (err) {
      if (err.code === 11000 && _retry) {
        return addToCart({
          userId,
          productId,
          variantId,
          quantity,
          _retry: false,
        });
      }
      throw err;
    }
  },

  decrementCartItem: async ({
    userId,
    productId,
    variantId = null,
    quantity = 1,
  }) => {
    const match = itemMatch(productId, variantId);

    // 1) Quantity remains above zero -> atomic decrement
    let cart = await Cart.findOneAndUpdate(
      {
        user_id: userId,
        items: { $elemMatch: { ...match, quantity: { $gt: quantity } } },
      },
      { $inc: { "items.$.quantity": -quantity } },
      { new: true },
    );
    if (cart) return summarize(cart, productId, variantId);

    // 2) Decrement would reach zero -> remove the line
    cart = await Cart.findOneAndUpdate(
      {
        user_id: userId,
        items: { $elemMatch: { ...match, quantity: { $lte: quantity } } },
      },
      { $pull: { items: match } },
      { new: true },
    );
    if (!cart) throw new AppError("Item not found in cart", 404);

    return summarize(cart, productId, variantId);
  },

  clearCart: async (userId) => {
    await Cart.updateOne({ user_id: userId }, { $set: { items: [] } });
  },

  removeCartItem: async ({ userId, productId, variantId }) => {
    const match =
      variantId === undefined
        ? { product_id: new mongoose.Types.ObjectId(productId) }
        : itemMatch(productId, variantId);

    const cart = await Cart.findOneAndUpdate(
      { user_id: userId, items: { $elemMatch: match } },
      { $pull: { items: match } },
      { new: true },
    );

    if (!cart) throw new AppError("Item not found in cart", 404);

    return {
      productId,
      variantId: variantId ?? null,
      quantity: 0,
      totalItems: cart.items.reduce((sum, i) => sum + i.quantity, 0),
    };
  },
};

export default CartService;
