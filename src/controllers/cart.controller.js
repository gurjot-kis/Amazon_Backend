import * as cartService from "../services/cart.service.js";
import { asyncHandler } from "../utils/AppError.js";

export const getCart = asyncHandler(async (req, res) => {
  const cart = await cartService.getCart(req.user._id);
  res.status(200).json({ success: true, data: cart });
});

export const addToCart = asyncHandler(async (req, res) => {
  const { productId, variantId = null, quantity = 1 } = req.body;

  await cartService.addToCart({
    userId: req.user._id,
    productId,
    variantId,
    quantity,
  });

  const cart = await cartService.getCart(req.user._id);
  res
    .status(200)
    .json({ success: true, message: "Item added to cart", data: cart });
});

export const decrementCartItem = asyncHandler(async (req, res) => {
  const { productId, variantId = null, quantity = 1 } = req.body;

  await cartService.decrementCartItem({
    userId: req.user._id,
    productId,
    variantId,
    quantity,
  });

  const cart = await cartService.getCart(req.user._id);
  res.status(200).json({ success: true, message: "Cart updated", data: cart });
});

export const clearCart = asyncHandler(async (req, res) => {
  await cartService.clearCart(req.user._id);
  res.status(200).json({ success: true, message: "Cart cleared" });
});
