import express from "express";
import authMiddleware from "../../middlewares/auth.middleware.js";
import { authorizeRoles, ROLES } from "../../middlewares/role.middleware.js";
import { StoreController } from "../../controllers/vendor/index.js";
import { uploadStoreImages } from "../../middlewares/upload.middleware.js";

const router = express.Router();
router.use(authMiddleware, authorizeRoles(ROLES.VENDOR));

router
  .route("/")
  .get(StoreController.getMyStores)
  .post(uploadStoreImages, StoreController.createStore);

router.get("/my/active-list", StoreController.getMyActiveStoresList);

router
  .route("/:id")
  .get(StoreController.getMyStoreById)
  .put(uploadStoreImages, StoreController.updateStore)
  .delete(StoreController.deleteStore);

router.patch("/:id/default", StoreController.setDefaultStore);
router.patch("/:id/status", StoreController.toggleStoreStatus);

export default router;
