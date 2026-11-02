import express from "express";
import { CouponController } from "../../controllers/admin/index.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { authorizeRoles, ROLES } from "../../middlewares/role.middleware.js";
import { uploadCouponImage } from "../../middlewares/upload.middleware.js";

const router = express.Router();
router.use(authMiddleware, authorizeRoles(ROLES.SUPER_ADMIN));

router
  .route("/")
  .get(CouponController.listCoupons)
  .post(CouponController.createCoupon);

router
  .route("/:id")
  .get(CouponController.getCouponById)
  .put(CouponController.updateCoupon)
  .patch(CouponController.updateCoupon)
  .delete(CouponController.deleteCoupon);

router.patch("/:id/status", CouponController.toggleStatus);
router.post("/:id/image",uploadCouponImage, CouponController.uploadCouponImage);

export default router;
