import express from "express";
import { ProductController } from "../../controllers/mobile/index.js";
import { requireActiveStore } from "../../middlewares/activeStore.middleware.js";
import authMiddleware from "../../middlewares/auth.middleware.js";
import authorizeRoles, { ROLES } from "../../middlewares/role.middleware.js";

const router = express.Router();
router.use(authMiddleware, authorizeRoles(ROLES.USER));

router.get(
  "/category/:categoryId",
  requireActiveStore,
  ProductController.getProductsByCategoryId,
);
router.get("/:id/details", ProductController.productDetails);

export default router;
