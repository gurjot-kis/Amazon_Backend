import express from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { authorizeRoles, ROLES } from "../../middlewares/role.middleware.js";
import { VariantOptionController } from "../../controllers/admin/variantOption.controller.js";

const router = express.Router();
router.use(authMiddleware, authorizeRoles(ROLES.SUPER_ADMIN));

router
  .route("/")
  .get(VariantOptionController.getAllVariantOptions)
  .post(VariantOptionController.createVariantOption);

router
  .route("/:id")
  .get(VariantOptionController.getVariantOptionById)
  .put(VariantOptionController.updateVariantOption)
  .delete(VariantOptionController.deleteVariantOption);

router.patch("/:id/status", VariantOptionController.updateVariantOptionStatus);
router.get(
  "/by-type/:variantTypeId",
  VariantOptionController.getVariantOptionsByType,
);

export default router;
