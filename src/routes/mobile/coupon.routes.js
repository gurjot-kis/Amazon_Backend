import express from "express";
import authMiddleware from "../../middlewares/auth.middleware.js";
import { authorizeRoles, ROLES } from "../../middlewares/role.middleware.js";
import { CouponController } from "../../controllers/mobile/index.js";
import { requireActiveStore } from "../../middlewares/activeStore.middleware.js";

const router = express.Router();
router.use(authMiddleware, authorizeRoles(ROLES.USER));

router.post("/apply", requireActiveStore, CouponController.applyCoupon);

export default router;
