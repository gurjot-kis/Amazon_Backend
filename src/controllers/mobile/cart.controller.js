import { sendError, sendSuccess } from "../../helpers/response.helper.js";
import CartService from "../../services/cart.service.js";

const handleError = (res, err, fallbackMessage) => {
  if (err.isOperational) {
    return sendError(res, { code: err.statusCode, message: err.message });
  }

  console.error(`[Cart] ${fallbackMessage}:`, err);
  return sendError(res, {
    code: 500,
    message: fallbackMessage,
    error: process.env.NODE_ENV === "production" ? null : err.message,
  });
};

const getUserId = (req) => req.user?._id || req.user?.id;
const getStoreId = (req) => req.activeStoreId;

const getContext = (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    sendError(res, { code: 401, message: "Unauthorized" });
    return null;
  }
  const storeId = getStoreId(req);
  if (!storeId) {
    sendError(res, { code: 400, message: "Active store id is required" });
    return null;
  }
  return { userId, storeId };
};

export const CartController = {
  getUserCarts: async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId)
        return sendError(res, { code: 401, message: "Unauthorized" });

      const data = await CartService.getUserCarts(userId);
      return sendSuccess(res, { message: "Carts fetched successfully", data });
    } catch (err) {
      return handleError(res, err, "Failed to fetch carts");
    }
  },

  getCart: async (req, res) => {
    try {
      const ctx = getContext(req, res);
      if (!ctx) return;

      const cart = await CartService.getCart(ctx.userId, ctx.storeId);
      return sendSuccess(res, {
        message: "Cart fetched successfully",
        data: cart,
      });
    } catch (err) {
      return handleError(res, err, "Failed to fetch cart");
    }
  },

  addToCart: async (req, res) => {
    try {
      const ctx = getContext(req, res);
      if (!ctx) return;

      const { productId, variantId = null, quantity = 1 } = req.body;

      const data = await CartService.addToCart({
        ...ctx,
        productId,
        variantId,
        quantity,
      });

      return sendSuccess(res, { message: "Item added to cart", data });
    } catch (err) {
      return handleError(res, err, "Failed to add item to cart");
    }
  },

  decrementCartItem: async (req, res) => {
    try {
      const ctx = getContext(req, res);
      if (!ctx) return;

      const { productId, variantId = null, quantity = 1 } = req.body;

      const data = await CartService.decrementCartItem({
        ...ctx,
        productId,
        variantId,
        quantity,
      });

      return sendSuccess(res, { message: "Cart updated successfully", data });
    } catch (err) {
      return handleError(res, err, "Failed to update cart");
    }
  },

  clearCart: async (req, res) => {
    try {
      const ctx = getContext(req, res);
      if (!ctx) return;

      await CartService.clearCart(ctx.userId, ctx.storeId);

      return sendSuccess(res, {
        message: "Cart cleared successfully",
        data: { storeId: ctx.storeId, totalItems: 0 },
      });
    } catch (err) {
      return handleError(res, err, "Failed to clear cart");
    }
  },

  removeCartItem: async (req, res) => {
    try {
      const ctx = getContext(req, res);
      if (!ctx) return;

      const { productId, variantId } = req.body;

      const data = await CartService.removeCartItem({
        ...ctx,
        productId,
        variantId,
      });

      return sendSuccess(res, { message: "Item removed from cart", data });
    } catch (err) {
      return handleError(res, err, "Failed to remove item from cart");
    }
  },
};

export default CartController;
