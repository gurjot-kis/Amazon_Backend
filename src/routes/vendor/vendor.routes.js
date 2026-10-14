import express from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import authorizeRoles, { ROLES } from "../../middlewares/role.middleware.js";
import { VendorController } from "../../controllers/vendor/index.js";

const router = express.Router();
router.use(authMiddleware, authorizeRoles(ROLES.VENDOR));

router.route("/profile").get(VendorController.getProfile);

export default router;
