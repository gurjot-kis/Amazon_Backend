import express from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { authorizeRoles, ROLES } from "../../middlewares/role.middleware.js";
import { PaymentController } from "../../controllers/admin/index.js";

const router = express.Router();
router.use(authMiddleware, authorizeRoles(ROLES.SUPER_ADMIN));

router.get("/", PaymentController.listPayments);
router.get("/:payment_id", PaymentController.getPaymentById);
router.patch("/:payment_id/collect", PaymentController.collectCodPayment);

export default router;
