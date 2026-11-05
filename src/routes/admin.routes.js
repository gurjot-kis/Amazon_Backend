import express from "express";
import { AdminController } from "../controllers/admin.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { authorizeRoles, ROLES } from "../middlewares/role.middleware.js";
import { uploadAdminProfilePicture } from "../middlewares/upload.middleware.js";

const router = express.Router();

router
  .route("/profile")
  .get(
    authMiddleware,
    authorizeRoles(ROLES.SUPER_ADMIN),
    AdminController.getProfile,
  )
  .patch(
    authMiddleware,
    authorizeRoles(ROLES.SUPER_ADMIN),
    uploadAdminProfilePicture,
    AdminController.updateProfile,
  );

router.get("/dashboard", AdminController.getDashboardData);

export default router;
