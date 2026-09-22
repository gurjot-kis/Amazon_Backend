import express from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { authorizeRoles, ROLES } from "../../middlewares/role.middleware.js";
import { uploadCategoryImage } from "../../middlewares/upload.middleware.js";
import { CategoryController } from "../../controllers/admin/index.js";

const router = express.Router();
router.use(authMiddleware, authorizeRoles(ROLES.SUPER_ADMIN));

router.get("/list", CategoryController.getAllCategories);
router.get("/leaf", CategoryController.getLeafCategories);
router.get("/active-list", CategoryController.getCategoriesSelectList)
router.post("/create", uploadCategoryImage, CategoryController.createCategory);

router.get("/:id", CategoryController.getCategoryById);
router.put(
  "/:id/update",
  uploadCategoryImage,
  CategoryController.updateCategory,
);
router.patch("/:id/status", CategoryController.toggleCategoryStatus);
router.delete("/:id", CategoryController.deleteCategory);

export default router;
