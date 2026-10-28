import express from "express";
import authRoutes from "./auth.routes.js";
import adminRoutes from "./admin.routes.js";
import vendorRoutes from "./vendor/index.js";

const router = express.Router();

router.use(authRoutes);
router.use(adminRoutes);
router.use("/vendor", vendorRoutes);

export default router;
