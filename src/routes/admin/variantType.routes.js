import express from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { authorizeRoles, ROLES } from "../../middlewares/role.middleware.js";
import { VariantTypeController } from "../../controllers/admin/index.js";

const router = express.Router();
router.use(authMiddleware, authorizeRoles(ROLES.SUPER_ADMIN));

router
  .route("/")
  .get(VariantTypeController.getAllVariantTypes)
  .post(VariantTypeController.createVariantType);

router
  .route("/:id")
  .get(VariantTypeController.getVariantTypeById)
  .put(VariantTypeController.updateVariantType)
  .delete(VariantTypeController.deleteVariantType);

router.patch("/:id/status", VariantTypeController.updateVariantTypeStatus);

export default router;
