import express from "express";
import CategoryRoutes from "./category.routes.js";
import ProductRoutes from "./product.routes.js";
import CartRoutes from "./cart.routes.js";
import BannerRoutes from "./banner.routes.js";
import AddressRoutes from "./address.routes.js";
import OrderRoutes from "./order.routes.js";
import PaymentRoutes from "./payment.routes.js";
import StoreRoutes from "./store.routes.js";
import WalletRoutes from "./wallet.routes.js";
import WishlistRoutes from "./wishlist.routes.js";
import UserRoutes from "./user.routes.js";
import AppContentRoutes from "./appContent.routes.js";
import CouponRoutes from "./coupon.routes.js";

const router = express.Router();

router.use("/category", CategoryRoutes);
router.use("/product", ProductRoutes);
router.use("/cart", CartRoutes);
router.use("/banner", BannerRoutes);
router.use("/address", AddressRoutes);
router.use("/order", OrderRoutes);
router.use("/payment", PaymentRoutes);
router.use("/store", StoreRoutes);
router.use("/wallet", WalletRoutes);
router.use("/wishlist", WishlistRoutes);
router.use("/user", UserRoutes);
router.use("/app-content", AppContentRoutes);
router.use("/coupon", CouponRoutes);

export default router;
