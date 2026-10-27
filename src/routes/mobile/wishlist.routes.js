import express from "express";
import authMiddleware from "../../middlewares/auth.middleware.js";
import authorizeRoles, { ROLES } from "../../middlewares/role.middleware.js";
import { WishListController } from "../../controllers/mobile/index.js";
import { requireActiveStore } from "../../middlewares/activeStore.middleware.js";

const router = express.Router();
router.use(authMiddleware, authorizeRoles(ROLES.USER));

router.get("/", requireActiveStore, WishListController.getMyWishlist);
router.post("/:productId/toggle", requireActiveStore, WishListController.toggleWishlist);

export default router;
