import express from "express";
import { OrderController } from "../../controllers/mobile/order.controller.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { authorizeRoles, ROLES } from "../../middlewares/role.middleware.js";

const router = express.Router();

// User order APIs
router.post(
  "/orders/place",
  authMiddleware,
  authorizeRoles(ROLES.USER),
  OrderController.placeOrder
);

router.get(
  "/orders",
  authMiddleware,
  authorizeRoles(ROLES.USER),
  OrderController.listUserOrders
);

router.get(
  "/orders/:order_id",
  authMiddleware,
  authorizeRoles(ROLES.USER),
  OrderController.getUserOrderById
);

router.patch(
  "/orders/:order_id/cancel",
  authMiddleware,
  authorizeRoles(ROLES.USER),
  OrderController.cancelUserOrder
);

// Admin order APIs
router.get(
  "/admin/orders",
  authMiddleware,
  authorizeRoles(ROLES.SUPER_ADMIN, ROLES.VENDOR),
  OrderController.listAdminOrders
);

router.get(
  "/admin/orders/:order_id",
  authMiddleware,
  authorizeRoles(ROLES.SUPER_ADMIN),
  OrderController.getAdminOrderById
);

router.patch(
  "/admin/orders/:order_id/status",
  authMiddleware,
  authorizeRoles(ROLES.SUPER_ADMIN),
  OrderController.updateOrderStatus
);

export default router;
