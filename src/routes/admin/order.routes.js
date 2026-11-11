import express from "express";
import { OrderController } from "../../controllers/admin/index.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import authorizeRoles, { ROLES } from "../../middlewares/role.middleware.js";

const router = express.Router();
router.use(authMiddleware, authorizeRoles(ROLES.SUPER_ADMIN));

router.get("/count", OrderController.getStoreOrderCounts);

export default router;
