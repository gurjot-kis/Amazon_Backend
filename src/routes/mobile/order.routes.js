import express from "express";
import { OrderController } from "../../controllers/mobile/order.controller.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { authorizeRoles, ROLES } from "../../middlewares/role.middleware.js";
import { requireActiveStore } from "../../middlewares/activeStore.middleware.js";

const router = express.Router();
router.use(authMiddleware, authorizeRoles(ROLES.USER));

router.get("/", requireActiveStore, OrderController.listOrders);
router.post("/place", requireActiveStore, OrderController.placeOrder);
router.get("/:order_id", OrderController.getOrderById);
router.patch("/:order_id/cancel", OrderController.cancelOrder);

export default router;
