import express from "express";
import CategoryRoutes from "./category.routes.js";
import ProductRoutes from "./product.routes.js";
import VariantTypeRoutes from "./variantType.routes.js";
import VariantOptionRoutes from "./variantOption.routes.js";
import CartSettingsRoutes from "./cart-settings.routes.js";
import BannerRoutes from "./banner.routes.js";
import OrderRoutes from "./order.routes.js";
import PaymentRoutes from "./payment.routes.js";
import VendorRoutes from "./vendor.routes.js";
import StoreRoutes from "./store.routes.js";

const router = express.Router();

router.use("/category", CategoryRoutes);
router.use("/product", ProductRoutes);
router.use("/variant-types", VariantTypeRoutes);
router.use("/variant-options", VariantOptionRoutes);
router.use("/cart-settings", CartSettingsRoutes);
router.use("/banner", BannerRoutes);
router.use("/order", OrderRoutes);
router.use("/payment", PaymentRoutes);
router.use("/vendors", VendorRoutes);
router.use("/store", StoreRoutes);

export default router;
