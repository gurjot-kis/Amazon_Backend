import express from "express";
import { AppContentController } from "../../controllers/mobile/index.js";
import { authorizeRoles, ROLES } from "../../middlewares/role.middleware.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { requireActiveStore } from "../../middlewares/activeStore.middleware.js";

const router = express.Router();
router.use(authMiddleware, authorizeRoles(ROLES.USER));

router.get(
  "/contact-us",
  requireActiveStore,
  AppContentController.getStoreContactAndTimings,
);

export default router;
