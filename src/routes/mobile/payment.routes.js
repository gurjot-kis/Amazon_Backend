import express from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { authorizeRoles, ROLES } from "../../middlewares/role.middleware.js";
import { PaymentController } from "../../controllers/mobile/index.js";

const router = express.Router();
router.use(authMiddleware, authorizeRoles(ROLES.USER));

router.get("/", PaymentController.listPayments);
router.get("/order/:order_id", PaymentController.getPaymentByOrder);
router.get("/:payment_id", PaymentController.getPaymentById);

export default router;
