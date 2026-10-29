import { sendSuccess, sendError } from "../../helpers/response.helper.js";
import { AppError } from "../../utils/AppError.js";
import { CouponService } from "../../services/coupon.service.js";
import { CartService } from "../../services/cart.service.js";

const authId = (req) => {
  const id = req.user?._id;
  if (!id) throw new AppError(401, "Unauthorized");
  return id;
};

const activeStoreId = (req) => {
  const id = req.activeStoreId;
  if (!id) throw new AppError(400, "No active store selected");
  return id;
};

const respondError = (res, err, fallbackMessage) => {
  if (err instanceof AppError) {
    return sendError(res, { code: err.statusCode, message: err.message });
  }
  if (err?.name === "ValidationError") {
    return sendError(res, { code: 400, message: err.message });
  }
  console.error("[coupon]", err);
  return sendError(res, { code: 500, message: fallbackMessage });
};

const handle = (fallbackMessage, fn) => async (req, res) => {
  try {
    return await fn(req, res);
  } catch (err) {
    return respondError(res, err, fallbackMessage);
  }
};

export const CustomerCouponController = {
  applyCoupon: handle("Unable to apply coupon", async (req, res) => {
    const { code } = req.body || {};
    const userId = authId(req);
    const storeId = activeStoreId(req);

    const cart = await CartService.getCart(userId, storeId);
    if (cart.items.length === 0) throw new AppError(400, "Cart is empty");

    const data = await CouponService.verifyCoupon({
      code,
      order_amount: cart.subtotal,
      store_id: storeId,
      user_id: userId,
    });

    return sendSuccess(res, {
      message: "Coupon applied successfully",
      data: {
        ...data,
        grand_total:
          Math.round((cart.grandTotal - data.discount_amount) * 100) / 100,
      },
    });
  }),
};

export default CustomerCouponController;
