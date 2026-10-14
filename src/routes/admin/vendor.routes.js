import express from "express";
import authMiddleware from "../../middlewares/auth.middleware.js";
import authorizeRoles, { ROLES } from "../../middlewares/role.middleware.js";
import { VendorController } from "../../controllers/admin/index.js";

const router = express.Router();
router.use(authMiddleware, authorizeRoles(ROLES.SUPER_ADMIN));

router
  .route("/")
  .get(VendorController.getVendors)
  .post(VendorController.addVendor);

router
  .route("/:id")
  .get(VendorController.getVendorById)
  .put(VendorController.updateVendor)
  .delete(VendorController.deleteVendor);

router.patch("/:id/status", VendorController.updateVendorStatus);
router.patch("/:id/verify", VendorController.updateVendorVerification);

export default router;
