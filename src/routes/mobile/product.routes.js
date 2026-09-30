import express from "express";
import { ProductController } from "../../controllers/mobile/index.js";

const router = express.Router();

router.get("/category/:categoryId", ProductController.getProductsByCategoryId);
router.get("/:id/details", ProductController.productDetails);

export default router;
