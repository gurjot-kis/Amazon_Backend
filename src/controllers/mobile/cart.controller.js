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

export const CartController = {
  getCart: async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId)
        return sendError(res, { code: 401, message: "Unauthorized" });

      const cart = await CartService.getCart(userId);

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
      const userId = getUserId(req);
      if (!userId)
        return sendError(res, { code: 401, message: "Unauthorized" });

      const { productId, variantId = null, quantity = 1 } = req.body;

      const data = await CartService.addToCart({
        userId,
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
      const userId = getUserId(req);
      if (!userId)
        return sendError(res, { code: 401, message: "Unauthorized" });

      const { productId, variantId = null, quantity = 1 } = req.body;

      const data = await CartService.decrementCartItem({
        userId,
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
      const userId = getUserId(req);
      if (!userId)
        return sendError(res, { code: 401, message: "Unauthorized" });

      await CartService.clearCart(userId);

      return sendSuccess(res, {
        message: "Cart cleared successfully",
        data: { totalItems: 0 },
      });
    } catch (err) {
      return handleError(res, err, "Failed to clear cart");
    }
  },

  removeCartItem: async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId)
        return sendError(res, { code: 401, message: "Unauthorized" });

      const { productId, variantId } = req.body;

      const data = await CartService.removeCartItem({
        userId,
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
