import express from "express";
import CategoryRoutes from "./category.routes.js";
import ProductRoutes from "./product.routes.js";
import VariantTypeRoutes from "./variantType.routes.js";
import VariantOptionRoutes from "./variantOption.routes.js";

const router = express.Router();

router.use("/category", CategoryRoutes);
router.use("/product", ProductRoutes);
router.use("/variant-types", VariantTypeRoutes);
router.use("/variant-options", VariantOptionRoutes);

export default router;
