import express from "express";
import { BannerController } from "../../controllers/admin/index.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { authorizeRoles, ROLES } from "../../middlewares/role.middleware.js";

const router = express.Router();
router.use(authMiddleware, authorizeRoles(ROLES.SUPER_ADMIN));

router
  .route("/")
  .get(BannerController.listBanners)
  .post(BannerController.createBanner);

router
  .route("/:banner_id")
  .get(BannerController.getBannerById)
  .put(BannerController.updateBannerPut)
  .patch(BannerController.updateBannerPatch)
  .delete(BannerController.deleteBanner);

export default router;
