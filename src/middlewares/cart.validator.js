import mongoose from "mongoose";
import { sendError } from "../helpers/response.helper.js";

export const validateCartItem = (req, res, next) => {
  const { productId, variantId, quantity } = req.body;

  if (!productId || !mongoose.isValidObjectId(productId)) {
    return sendError(res, {
      code: 400,
      message: "Valid productId is required",
    });
  }
  if (variantId && !mongoose.isValidObjectId(variantId)) {
    return sendError(res, { code: 400, message: "Invalid variantId" });
  }
  if (
    quantity !== undefined &&
    (!Number.isInteger(quantity) || quantity < 1 || quantity > 100)
  ) {
    return sendError(res, {
      code: 400,
      message: "Quantity must be an integer between 1 and 100",
    });
  }

  next();
};
