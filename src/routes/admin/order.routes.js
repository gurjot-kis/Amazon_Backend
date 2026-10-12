import express from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { authorizeRoles, ROLES } from "../../middlewares/role.middleware.js";
import { OrderController } from "../../controllers/admin/index.js";

const router = express.Router();
router.use(authMiddleware, authorizeRoles(ROLES.USER));

router.get("/orders", OrderController.listOrders);
router.get("/orders/:order_id", OrderController.getOrderById);
router.patch("/orders/:order_id/status", OrderController.updateOrderStatus);

export default router;


// Vendor Order routes
// router.get("/vendor/orders", guard, VendorOrderController.listOrders);
// router.get("/vendor/orders/:order_id", guard, VendorOrderController.getOrderById);
