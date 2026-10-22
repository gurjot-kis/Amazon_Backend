import express from "express";
import { StoreController } from "../../controllers/mobile/index.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { authorizeRoles, ROLES } from "../../middlewares/role.middleware.js";

const router = express.Router();

router.get("/nearby", StoreController.getNearbyStores);
router.patch("/active-store", StoreController.setActiveStore);
router.get(
  "/:storeid/details",
  authMiddleware,
  authorizeRoles(ROLES.USER),
  StoreController.getStoreAndUserAddress,
);

export default router;
