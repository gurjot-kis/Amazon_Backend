import express from "express";
import authMiddleware from "../../middlewares/auth.middleware.js";
import { authorizeRoles, ROLES } from "../../middlewares/role.middleware.js";
import { StoreController } from "../../controllers/admin/index.js";

const router = express.Router();
router.use(authMiddleware, authorizeRoles(ROLES.SUPER_ADMIN));

router.get("/", StoreController.getAllStores);
router.get("/:id/details", StoreController.getStoreByIdForAdmin);
router.patch("/:id/verification", StoreController.updateVerificationStatus);
router.patch("/:id/status", StoreController.updateStoreStatusByAdmin)

export default router;
