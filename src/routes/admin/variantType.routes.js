import express from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { authorizeRoles, ROLES } from "../../middlewares/role.middleware.js";
import { VariantTypeController } from "../../controllers/admin/index.js";

const router = express.Router();
router.use(authMiddleware);

router
  .route("/")
  .get(
    authorizeRoles(ROLES.SUPER_ADMIN, ROLES.VENDOR),
    VariantTypeController.getAllVariantTypes,
  )
  .post(
    authorizeRoles(ROLES.SUPER_ADMIN),
    VariantTypeController.createVariantType,
  );

router
  .route("/:id")
  .get(
    authorizeRoles(ROLES.SUPER_ADMIN),
    VariantTypeController.getVariantTypeById,
  )
  .put(
    authorizeRoles(ROLES.SUPER_ADMIN),
    VariantTypeController.updateVariantType,
  )
  .delete(
    authorizeRoles(ROLES.SUPER_ADMIN),
    VariantTypeController.deleteVariantType,
  );

router.patch(
  "/:id/status",
  authorizeRoles(ROLES.SUPER_ADMIN),
  VariantTypeController.updateVariantTypeStatus,
);

export default router;
