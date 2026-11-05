import express from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { authorizeRoles, ROLES } from "../../middlewares/role.middleware.js";
import { OrderController } from "../../controllers/vendor/index.js";

const router = express.Router();
router.use(authMiddleware, authorizeRoles(ROLES.VENDOR));

router.get("/orders", OrderController.listOrders);
router.get("/orders/:order_id", OrderController.getOrderById);
router.patch("/orders/:order_id/status", OrderController.updateOrderStatus);

export default router;
