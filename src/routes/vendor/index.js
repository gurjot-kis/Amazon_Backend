import express from "express";
import VendorProfileRoutes from "./vendor.routes.js";
import StoreRoutes from "./store.routes.js";
import ProductRoutes from "./product.routes.js";
import CouponRoutes from "./coupon.routes.js";

const router = express.Router();
router.use(VendorProfileRoutes);
router.use("/store", StoreRoutes);
router.use("/product", ProductRoutes);
router.use("/coupon", CouponRoutes);

export default router;
