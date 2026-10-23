import express from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { authorizeRoles, ROLES } from "../../middlewares/role.middleware.js";
import { uploadProductImages } from "../../middlewares/upload.middleware.js";
import { ProductController } from "../../controllers/vendor/product.controller.js";

const router = express.Router();
router.use(authMiddleware, authorizeRoles(ROLES.VENDOR));

router.get("/all", ProductController.getAllProductsAcrossStores);
router.get("/list", ProductController.getAllProducts);
router.post("/create", uploadProductImages, ProductController.createProduct);

router.get("/:id", ProductController.getProductById);
router.put("/:id/update", uploadProductImages, ProductController.updateProduct);
router.patch("/:id/status", ProductController.updateProductStatus);
router.delete("/:id/delete", ProductController.deleteProduct);

export default router;
