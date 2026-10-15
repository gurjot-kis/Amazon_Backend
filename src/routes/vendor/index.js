import express from "express";
import VendorProfileRoutes from "./vendor.routes.js";
import StoreRoutes from "./store.routes.js";

const router = express.Router();
router.use(VendorProfileRoutes);
router.use("/store", StoreRoutes);

export default router;
