import express from "express";
import { UserController } from "../controllers/user.controller.js";
import * as ChatUserController from "../controllers/chat-user.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { authorizeRoles, ROLES } from "../middlewares/role.middleware.js";
import { uploadMedia } from "../middlewares/upload.middleware.js";

const router = express.Router();

router.get(
  "/users/chat-search",
  authMiddleware,
  ChatUserController.getAllUsers
);

router.post(
  "/users/register",
  ChatUserController.register
);

router.post(
  "/users/login",
  ChatUserController.login
);

router.get(
  "/users/profile-details",
  authMiddleware,
  ChatUserController.getUserProfile
);

router.post(
  "/users/upload-avatar",
  uploadMedia.single("file"),
  ChatUserController.uploadAvatarFile
);

router.put(
  "/users/profile",
  authMiddleware,
  ChatUserController.updateProfile
);

/**
 * User status: 1 = Active, 0 = Inactive
 * List filter: GET /users?status=0|1
 */

router.patch(
  "/user/location",
  authMiddleware,
  authorizeRoles(ROLES.USER),
  UserController.updateUserLocation
);

router.get(
  "/users",
  authMiddleware,
  authorizeRoles(ROLES.SUPER_ADMIN),
  UserController.getUsers
);

router.post(
  "/users",
  authMiddleware,
  authorizeRoles(ROLES.SUPER_ADMIN),
  UserController.addUser
);

router.get(
  "/users/:user_id",
  authMiddleware,
  authorizeRoles(ROLES.SUPER_ADMIN),
  UserController.getUserById
);

router.put(
  "/users/:user_id",
  authMiddleware,
  authorizeRoles(ROLES.SUPER_ADMIN),
  UserController.updateUser
);

router.patch(
  "/users/:user_id",
  authMiddleware,
  authorizeRoles(ROLES.SUPER_ADMIN),
  UserController.editUser
);

router.delete(
  "/users/:user_id",
  authMiddleware,
  authorizeRoles(ROLES.SUPER_ADMIN),
  UserController.deleteUser
);

export default router;
