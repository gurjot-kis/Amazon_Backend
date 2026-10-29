import { CouponService } from "../../services/coupon.service.js";

const sendError = (res, code, message) => {
  return res.status(code).json({
    success: false,
    code,
    message,
    data: null,
  });
};

export const CouponController = {
  createCoupon: async (req, res) => {
    try {
      const payload = {
        ...req.body,
        created_by: req.user._id,
        created_by_role: "SuperAdmin",
      };

      const data = await CouponService.createCoupon(payload);
      return res.status(201).json({
        success: true,
        code: 201,
        message: "Coupon created successfully",
        data,
      });
    } catch (err) {
      const message = err?.message || "Coupon creation failed";
      if (message === "Coupon code already exists") {
        return sendError(res, 409, message);
      }
      return sendError(res, 400, message);
    }
  },

  listCoupons: async (req, res) => {
    try {
      const {
        page,
        limit,
        search,
        status,
        scope,
        vendor_id,
        store_id,
        created_by_role,
      } = req.query || {};

      const { items, pagination } = await CouponService.listCoupons({
        page,
        limit,
        search,
        status,
        scope,
        vendor_id,
        store_id,
        created_by_role,
      });

      return res.status(200).json({
        success: true,
        code: 200,
        message: "Coupons fetched successfully",
        data: items,
        pagination,
      });
    } catch (err) {
      const message = err?.message || "Unable to fetch coupons";
      if (
        message === "status must be 0 or 1" ||
        message === "scope must be global or store"
      ) {
        return sendError(res, 400, message);
      }
      return sendError(res, 500, "Unable to fetch coupons");
    }
  },

  getCouponById: async (req, res) => {
    try {
      const { coupon_id } = req.params || {};
      const data = await CouponService.getCouponById({ coupon_id });
      return res.status(200).json({
        success: true,
        code: 200,
        message: "Coupon fetched successfully",
        data,
      });
    } catch (err) {
      const message = err?.message || "Unable to fetch coupon";
      if (message === "Coupon not found") {
        return sendError(res, 404, message);
      }
      return sendError(res, 400, message);
    }
  },

  updateCoupon: async (req, res) => {
    try {
      const { coupon_id } = req.params || {};
      const data = await CouponService.updateCoupon({
        coupon_id,
        ...req.body,
      });
      return res.status(200).json({
        success: true,
        code: 200,
        message: "Coupon updated successfully",
        data,
      });
    } catch (err) {
      const message = err?.message || "Coupon update failed";
      if (message === "Coupon not found") {
        return sendError(res, 404, message);
      }
      if (message === "Coupon code already exists") {
        return sendError(res, 409, message);
      }
      return sendError(res, 400, message);
    }
  },

  deleteCoupon: async (req, res) => {
    try {
      const { coupon_id } = req.params || {};
      const data = await CouponService.deleteCoupon({ coupon_id });
      return res.status(200).json({
        success: true,
        code: 200,
        message: "Coupon deleted successfully",
        data,
      });
    } catch (err) {
      const message = err?.message || "Coupon deletion failed";
      if (message === "Coupon not found") {
        return sendError(res, 404, message);
      }
      return sendError(res, 400, message);
    }
  },

  toggleStatus: async (req, res) => {
    try {
      const { coupon_id } = req.params || {};
      const data = await CouponService.toggleCouponStatus({ coupon_id });
      return res.status(200).json({
        success: true,
        code: 200,
        message: `Coupon ${data.status === 1 ? "activated" : "deactivated"} successfully`,
        data,
      });
    } catch (err) {
      const message = err?.message || "Status toggle failed";
      if (message === "Coupon not found") {
        return sendError(res, 404, message);
      }
      return sendError(res, 400, message);
    }
  },
};

export default CouponController;
