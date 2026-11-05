import express from "express";
import authRoutes from "./auth.routes.js";
import adminRoutes from "./admin.routes.js";
import vendorRoutes from "./vendor/index.js";
import UserRoutes from "./user.routes.js";

const router = express.Router();

router.use(UserRoutes);
router.use(authRoutes);
router.use("/admin", adminRoutes);
router.use("/vendor", vendorRoutes);

export default router;
