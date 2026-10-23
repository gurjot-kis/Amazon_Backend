import express from "express";
import { CategoryController } from "../../controllers/mobile/index.js";
import { requireActiveStore } from "../../middlewares/activeStore.middleware.js";
import authMiddleware from "../../middlewares/auth.middleware.js";
import authorizeRoles, { ROLES } from "../../middlewares/role.middleware.js";

const router = express.Router();
router.use(authMiddleware, authorizeRoles(ROLES.USER));

router.get("/list", requireActiveStore, CategoryController.getAllCategories);
router.get(
  "/quick-commerce/list",
  CategoryController.getActiveQuickCommerceCategories,
);

export default router;
