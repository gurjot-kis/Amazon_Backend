import express from "express";
import { StoreController } from "../../controllers/mobile/index.js";

const router = express.Router();

router.get("/nearby", StoreController.getNearbyStores);
router.patch("/active-store", StoreController.setActiveStore);

export default router;
