import express from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { authorizeRoles, ROLES } from "../../middlewares/role.middleware.js";
import { VariantOptionController } from "../../controllers/admin/variantOption.controller.js";

const router = express.Router();
router.use(authMiddleware);

router
  .route("/")
  .get(
    authorizeRoles(ROLES.SUPER_ADMIN),
    VariantOptionController.getAllVariantOptions,
  )
  .post(
    authorizeRoles(ROLES.SUPER_ADMIN),
    VariantOptionController.createVariantOption,
  );

router
  .route("/:id")
  .get(
    authorizeRoles(ROLES.SUPER_ADMIN),
    VariantOptionController.getVariantOptionById,
  )
  .put(
    authorizeRoles(ROLES.SUPER_ADMIN),
    VariantOptionController.updateVariantOption,
  )
  .delete(
    authorizeRoles(ROLES.SUPER_ADMIN),
    VariantOptionController.deleteVariantOption,
  );

router.patch(
  "/:id/status",
  authorizeRoles(ROLES.SUPER_ADMIN),
  VariantOptionController.updateVariantOptionStatus,
);
router.get(
  "/by-type/:variantTypeId",
  authorizeRoles(ROLES.SUPER_ADMIN, ROLES.VENDOR),
  VariantOptionController.getVariantOptionsByType,
);

export default router;
