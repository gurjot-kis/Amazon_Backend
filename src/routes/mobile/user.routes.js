import express from "express";
import { UserController } from "../../controllers/mobile/index.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { authorizeRoles, ROLES } from "../../middlewares/role.middleware.js";
import { uploadProfileImage } from "../../middlewares/upload.middleware.js";

const router = express.Router();
router.use(authMiddleware, authorizeRoles(ROLES.USER));

router.post("/request-email-change", UserController.requestEmailChange);
router.post("/verify-email-change", UserController.verifyEmailChange);
router.post("/request-phone-change", UserController.requestPhoneChange);
router.post("/verify-phone-change", UserController.verifyPhoneChange);

router
  .route("/profile")
  .get(UserController.getMyProfile)
  .patch(uploadProfileImage, UserController.updateMyProfile)
  .delete(UserController.deleteMyAccount);

export default router;
