import fs from "fs";
import { sendSuccess } from "../../helpers/response.helper.js";
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
  createCoupon: async (req, res, next) => {
    try {
      const payload = {
        ...req.body,
        created_by: req.user._id,
        created_by_role: "SuperAdmin",
      };

      const data = await CouponService.createCoupon(payload);
      return sendSuccess(res, {
        code: 201,
        message: "Coupon created successfully",
        data,
      });
    } catch (err) {
      next(err);
    }
  },

  listCoupons: async (req, res, next) => {
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

      return sendSuccess(res, {
        message: "Coupons fetched successfully",
        data: items,
        pagination,
      });
    } catch (err) {
      next(err);
    }
  },

  getCouponById: async (req, res, next) => {
    try {
      const { id } = req.params || {};
      const data = await CouponService.getCouponById({ id });
      return sendSuccess(res, {
        message: "Coupon fetched successfully",
        data,
      });
    } catch (err) {
      next(err);
    }
  },

  updateCoupon: async (req, res, next) => {
    try {
      const { id } = req.params || {};
      const { vendor_id: new_vendor_id, ...rest } = req.body || {};

      const data = await CouponService.updateCoupon({
        id,
        ...rest,
        new_vendor_id,
      });
      return sendSuccess(res, {
        message: "Coupon updated successfully",
        data,
      });
    } catch (err) {
      next(err);
    }
  },

  deleteCoupon: async (req, res, next) => {
    try {
      const { id } = req.params || {};
      const data = await CouponService.deleteCoupon({ id });
      return sendSuccess(res, {
        message: "Coupon deleted successfully",
        data,
      });
    } catch (err) {
      next(err);
    }
  },

  toggleStatus: async (req, res, next) => {
    try {
      const { id } = req.params || {};
      const data = await CouponService.toggleCouponStatus({ id });
      return sendSuccess(res, {
        message: `Coupon ${data.status === 1 ? "activated" : "deactivated"} successfully`,
        data,
      });
    } catch (err) {
      next(err);
    }
  },

  uploadCouponImage: async (req, res, next) => {
    try {
      const coupon_image = req.file
        ? `/uploads/coupons/${req.file.filename}`
        : "";

      const data = await CouponService.updateCouponImage({
        id: req.params.id,
        image_type: req.body?.coupon_image_type,
        coupon_image,
      });

      return sendSuccess(res, {
        message: "Coupon image uploaded successfully",
        data,
      });
    } catch (error) {
      if (req.file) fs.unlink(req.file.path, () => {});
      next(error);
    }
  },
};

export default CouponController;
