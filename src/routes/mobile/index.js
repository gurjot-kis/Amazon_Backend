import express from "express";
import CategoryRoutes from "./category.routes.js";
import ProductRoutes from "./product.routes.js";
import CartRoutes from "./cart.routes.js";
import BannerRoutes from "./banner.routes.js";
import AddressRoutes from "./address.routes.js";

const router = express.Router();

router.use("/category", CategoryRoutes);
router.use("/product", ProductRoutes);
router.use("/cart", CartRoutes);
router.use("/banner", BannerRoutes);
router.use("/address", AddressRoutes);

export default router;
