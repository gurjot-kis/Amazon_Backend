import express from "express";
import { CartSettingsController } from "../../controllers/admin/index.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { authorizeRoles, ROLES } from "../../middlewares/role.middleware.js";

const router = express.Router();
router.use(authMiddleware, authorizeRoles(ROLES.SUPER_ADMIN, ROLES.VENDOR));

router
  .route("/")
  .post(CartSettingsController.createCartSettings)
  .get(CartSettingsController.listCartSettings);

router
  .route("/:id")
  .get(CartSettingsController.getCartSettingsById)
  .put(CartSettingsController.updateCartSettings)
  .patch(CartSettingsController.updateCartSettings)
  .delete(CartSettingsController.deleteCartSettings);

export default router;
