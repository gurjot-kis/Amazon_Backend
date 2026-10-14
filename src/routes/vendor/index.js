import express from "express";
import warehousesRoutes from "./warehouses.routes.js";
import inventoryRoutes from "./inventory.routes.js";
import dashboardRoutes from "./dashboard.routes.js";
import VendorProfileRoutes from "./vendor.routes.js";

const router = express.Router();
router.use(VendorProfileRoutes);
router.use(warehousesRoutes);
router.use(inventoryRoutes);
router.use(dashboardRoutes);

export default router;
