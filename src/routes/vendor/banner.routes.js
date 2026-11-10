import express from "express";
import { BannerController } from "../../controllers/vendor/index.js";
import { uploadBannerImage } from "../../middlewares/upload.middleware.js";
import authMiddleware from "../../middlewares/auth.middleware.js";
import authorizeRoles, { ROLES } from "../../middlewares/role.middleware.js";

const router = express.Router();
router.use(authMiddleware, authorizeRoles(ROLES.VENDOR));

router
  .route("/")
  .get(BannerController.listBanners)
  .post(uploadBannerImage, BannerController.createBanner);

router
  .route("/:id")
  .get(BannerController.getBannerById)
  .put(uploadBannerImage, BannerController.updateBanner)
  .delete(BannerController.deleteBanner);

router.patch("/:id/status", BannerController.toggleBannerStatus);

export default router;
