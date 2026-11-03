import express from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { authorizeRoles, ROLES } from "../../middlewares/role.middleware.js";
import { WalletSettingsController } from "../../controllers/admin/index.js";

const router = express.Router();
router.use(authMiddleware, authorizeRoles(ROLES.SUPER_ADMIN));

router
  .route("/")
  .get(WalletSettingsController.getAll)
  .post(WalletSettingsController.create);

router
  .route("/:id")
  .get(WalletSettingsController.getById)
  .put(WalletSettingsController.update)
  .delete(WalletSettingsController.delete);

router.patch("/:id/set-default", WalletSettingsController.setDefault);
router.patch("/:id/toggle-status", WalletSettingsController.toggleStatus);

export default router;
