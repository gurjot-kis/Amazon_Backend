import express from "express";
import { CategoryController } from "../../controllers/mobile/index.js";

const router = express.Router();

router.get("/list", CategoryController.getAllCategories);
router.get(
  "/quick-commerce/list",
  CategoryController.getActiveQuickCommerceCategories,
);

export default router;
