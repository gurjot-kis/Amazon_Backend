import mongoose from "mongoose";
import Cart from "../models/cart.model.js";
import Product from "../models/product.model.js";
import Store from "../models/store.model.js";
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

export const getCartSettings = async (type = "Product") => {
  const settings = await CartSettings.findOne({
    type,
    status: "active",
  }).lean();
  return { ...DEFAULT_CART_SETTINGS, ...(settings || {}) };
};

const OBJECT_ID_REGEX = /^[a-f\d]{24}$/i;

const assertObjectId = (value, name) => {
  if (!OBJECT_ID_REGEX.test(String(value ?? ""))) {
    throw new AppError(400, `${name} must be a valid ObjectId`);
  }
};

const parseQuantity = (value) => {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) {
    throw new AppError(400, "quantity must be a positive integer");
  }
  return n;
};

const assertActiveStore = async (storeId) => {
  assertObjectId(storeId, "storeId");

  const store = await Store.findOne({
    _id: storeId,
    status: "active",
    verification_status: "verified",
  })
    .select("_id")
    .lean();

  if (!store) throw new AppError(404, "Store not available");
};

const getMaxAllowedQty = async (storeId, productId, variantId) => {
  const product = await Product.findById(productId)
    .select("status stock stockStatus hasVariants store_id")
    .lean();

  if (!product || product.status !== "active") {
    throw new AppError(404, "Product not available");
  }

  // Product must belong to the active store
  if (String(product.store_id) !== String(storeId)) {
    throw new AppError(409, "Product does not belong to this store");
  }

  let stock;

  if (product.hasVariants) {
    if (!variantId)
      throw new AppError(400, "Variant is required for this product");

    const variant = await ProductVariant.findOne({
      _id: variantId,
      product_id: productId,
    })
      .select("status stock stockStatus")
      .lean();

    if (!variant || variant.status !== "active") {
      throw new AppError(404, "Variant not available");
    }
    if (variant.stockStatus !== "in_stock" || variant.stock <= 0) {
      throw new AppError(409, "Variant is out of stock");
    }
    stock = variant.stock;
  } else {
    if (variantId) throw new AppError(400, "This product has no variants");
    if (product.stockStatus !== "in_stock" || product.stock <= 0) {
      throw new AppError(409, "Product is out of stock");
    }
    stock = product.stock;
  }

  return Math.min(stock, MAX_QTY_PER_ITEM);
};

const itemMatch = (productId, variantId) => ({
  product_id: new mongoose.Types.ObjectId(productId),
  variant_id: variantId ? new mongoose.Types.ObjectId(variantId) : null,
});

const cartFilter = (userId, storeId) => ({
  user_id: userId,
  store_id: new mongoose.Types.ObjectId(storeId),
});

const summarize = (cart, storeId, productId, variantId) => {
  const line = cart?.items.find(
    (i) =>
      String(i.product_id) === String(productId) &&
      String(i.variant_id || "") === String(variantId || ""),
  );

  return {
    storeId,
    productId,
    variantId: variantId || null,
    quantity: line ? line.quantity : 0,
    totalItems: cart ? cart.items.reduce((sum, i) => sum + i.quantity, 0) : 0,
  };
};

export const CartService = {
  getUserCarts: async (userId) => {
    const carts = await Cart.find({ user_id: userId })
      .populate("store_id", "store_name store_logo status")
      .sort({ updatedAt: -1 })
      .lean();

    return carts
      .filter((c) => c.items.length > 0 && c.store_id)
      .map((c) => ({
        store: c.store_id,
        totalItems: c.items.reduce((s, i) => s + i.quantity, 0),
        updatedAt: c.updatedAt,
      }));
  },

  getCart: async (userId, storeId) => {
    await assertActiveStore(storeId);

    const emptyCart = {
      storeId,
      items: [],
      totalItems: 0,
      subtotal: 0,
      deliveryFee: 0,
      handlingFee: 0,
      smallCartFee: 0,
      grandTotal: 0,
    };

    const [cart, settings] = await Promise.all([
      Cart.findOne(cartFilter(userId, storeId))
        .populate(
          "items.product_id",
          "name slug mainImage price sellingPrice currency",
        )
        .populate({
          path: "items.variant_id",
          select: "sku price sellingPrice images combination",
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

        const unitPrice = variant?.sellingPrice || product.sellingPrice;

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

    if (items.length === 0) return emptyCart;

    const subtotal = items.reduce((s, i) => s + i.lineTotal, 0);

    const deliveryFee =
      subtotal >= settings.free_delivery_min_amount
        ? 0
        : settings.delivery_charge;

    const handlingFee = settings.handling_charge;

    const smallCartFee =
      settings.small_cart_charge > 0 &&
      subtotal < settings.small_cart_max_amount
        ? settings.small_cart_charge
        : 0;

    const grandTotal = subtotal + deliveryFee + handlingFee + smallCartFee;

    return {
      storeId,
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
    storeId,
    productId,
    variantId = null,
    quantity = 1,
    _retry = true,
  }) => {
    await assertActiveStore(storeId);
    assertObjectId(productId, "productId");

    if (variantId) assertObjectId(variantId, "variantId");
    quantity = parseQuantity(quantity);
    variantId = variantId || null;

    const maxQty = await getMaxAllowedQty(storeId, productId, variantId);

    if (quantity > maxQty) {
      throw new AppError(
        409,
        `Only ${maxQty} unit(s) can be added for this item`,
      );
    }

    const match = itemMatch(productId, variantId);
    const base = cartFilter(userId, storeId);

    // 1) Line exists and stays within limit -> atomic increment
    let cart = await Cart.findOneAndUpdate(
      {
        ...base,
        items: {
          $elemMatch: { ...match, quantity: { $lte: maxQty - quantity } },
        },
      },
      { $inc: { "items.$.quantity": quantity } },
      { new: true },
    );
    if (cart) return summarize(cart, storeId, productId, variantId);

    // 2) Line exists but increment would exceed limit
    const exists = await Cart.exists({
      ...base,
      items: { $elemMatch: match },
    });
    if (exists) {
      throw new AppError(
        409,
        `Cart limit reached. Max ${maxQty} unit(s) allowed for this item`,
      );
    }

    // 3) Line doesn't exist -> push (creates this store's cart if needed)
    try {
      cart = await Cart.findOneAndUpdate(
        { ...base, items: { $not: { $elemMatch: match } } },
        { $push: { items: { ...match, quantity } } },
        { new: true, upsert: true },
      );
      return summarize(cart, storeId, productId, variantId);
    } catch (err) {
      if (err.code === 11000 && _retry) {
        return CartService.addToCart({
          userId,
          storeId,
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
    storeId,
    productId,
    variantId = null,
    quantity = 1,
  }) => {
    await assertActiveStore(storeId);
    assertObjectId(productId, "productId");

    if (variantId) assertObjectId(variantId, "variantId");
    quantity = parseQuantity(quantity);
    variantId = variantId || null;

    const match = itemMatch(productId, variantId);
    const base = cartFilter(userId, storeId);

    // 1) Quantity remains above zero -> atomic decrement
    let cart = await Cart.findOneAndUpdate(
      {
        ...base,
        items: { $elemMatch: { ...match, quantity: { $gt: quantity } } },
      },
      { $inc: { "items.$.quantity": -quantity } },
      { new: true },
    );
    if (cart) return summarize(cart, storeId, productId, variantId);

    // 2) Decrement would reach zero -> remove the line
    cart = await Cart.findOneAndUpdate(
      {
        ...base,
        items: { $elemMatch: { ...match, quantity: { $lte: quantity } } },
      },
      { $pull: { items: match } },
      { new: true },
    );
    if (!cart) throw new AppError(404, "Item not found in cart");

    return summarize(cart, storeId, productId, variantId);
  },

  clearCart: async (userId, storeId) => {
    assertObjectId(storeId, "storeId");
    await Cart.updateOne(cartFilter(userId, storeId), { $set: { items: [] } });
  },

  removeCartItem: async ({ userId, storeId, productId, variantId }) => {
    assertObjectId(storeId, "storeId");
    assertObjectId(productId, "productId");
    if (variantId) assertObjectId(variantId, "variantId");

    const match =
      variantId === undefined
        ? { product_id: new mongoose.Types.ObjectId(productId) }
        : itemMatch(productId, variantId);

    const cart = await Cart.findOneAndUpdate(
      { ...cartFilter(userId, storeId), items: { $elemMatch: match } },
      { $pull: { items: match } },
      { new: true },
    );

    if (!cart) throw new AppError(404, "Item not found in cart");

    return {
      storeId,
      productId,
      variantId: variantId ?? null,
      quantity: 0,
      totalItems: cart.items.reduce((sum, i) => sum + i.quantity, 0),
    };
  },
};

export default CartService;
