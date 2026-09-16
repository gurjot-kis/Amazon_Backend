import express from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { authorizeRoles, ROLES } from "../../middlewares/role.middleware.js";
import { uploadProductImages } from "../../middlewares/upload.middleware.js";
import { ProductController } from "../../controllers/admin/index.js";

const router = express.Router();
router.use(authMiddleware, authorizeRoles(ROLES.SUPER_ADMIN));

router.post("/create", uploadProductImages, ProductController.createProduct);

export default router;
