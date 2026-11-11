import express from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { authorizeRoles, ROLES } from "../../middlewares/role.middleware.js";
import { DeviceTokenController } from "../../controllers/mobile/index.js";

const router = express.Router();
router.use(authMiddleware, authorizeRoles(ROLES.USER));

router
  .route("/")
  .post(DeviceTokenController.saveDeviceToken)
  .delete(DeviceTokenController.removeDeviceToken);

export default router;
