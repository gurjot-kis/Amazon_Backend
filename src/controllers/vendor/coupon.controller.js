import fs from "fs";
import { sendSuccess } from "../../helpers/response.helper.js";
import { CouponService } from "../../services/coupon.service.js";

export const CouponController = {
  createCoupon: async (req, res, next) => {
    try {
      const payload = {
        ...req.body,
        created_by: req.user._id,
        created_by_role: "Vendor",
        vendor_id: req.user._id,
      };

      const data = await CouponService.createCoupon(payload);
      return sendSuccess(res, {
        code: 201,
        message: "Coupon created successfully",
        data,
      });
    } catch (error) {
      next(error);
    }
  },

  listCoupons: async (req, res, next) => {
    try {
      const { page, limit, search, status, scope, store_id } = req.query || {};

      const { items, pagination } = await CouponService.listCoupons({
        page,
        limit,
        search,
        status,
        scope,
        store_id,
        vendor_id: req.user._id,
      });

      return sendSuccess(res, {
        message: "Coupons fetched successfully",
        data: items,
        pagination,
      });
    } catch (error) {
      next(error);
    }
  },

  getCouponById: async (req, res, next) => {
    try {
      const data = await CouponService.getCouponById({
        id: req.params.id,
        vendor_id: req.user._id,
      });
      return sendSuccess(res, {
        message: "Coupon fetched successfully",
        data,
      });
    } catch (error) {
      next(error);
    }
  },

  updateCoupon: async (req, res, next) => {
    try {
      const data = await CouponService.updateCoupon({
        ...req.body,
        id: req.params.id,
        vendor_id: req.user._id,
      });
      return sendSuccess(res, {
        message: "Coupon updated successfully",
        data,
      });
    } catch (error) {
      next(error);
    }
  },

  deleteCoupon: async (req, res, next) => {
    try {
      const data = await CouponService.deleteCoupon({
        id: req.params.id,
        vendor_id: req.user._id,
      });
      return sendSuccess(res, {
        message: "Coupon deleted successfully",
        data,
      });
    } catch (error) {
      next(error);
    }
  },

  toggleStatus: async (req, res, next) => {
    try {
      const data = await CouponService.toggleCouponStatus({
        id: req.params.id,
        vendor_id: req.user._id,
      });
      return sendSuccess(res, {
        message: `Coupon ${data.status === 1 ? "activated" : "deactivated"} successfully`,
        data,
      });
    } catch (error) {
      next(error);
    }
  },

  uploadCouponImage: async (req, res, next) => {
    try {
      const coupon_image = req.file
        ? `/uploads/coupons/${req.file.filename}`
        : "";

      const data = await CouponService.updateCouponImage({
        id: req.params.id,
        vendor_id: req.user._id,
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
