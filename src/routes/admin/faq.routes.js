import express from "express";
import { FaqController } from "../../controllers/admin/index.js";
import authMiddleware from "../../middlewares/auth.middleware.js";
import authorizeRoles, { ROLES } from "../../middlewares/role.middleware.js";

const router = express.Router();
router.use(authMiddleware, authorizeRoles(ROLES.SUPER_ADMIN));

router.route("/").get(FaqController.getHelp).post(FaqController.addFaq);
router
  .route("/:faqId")
  .get(FaqController.getFaqById)
  .patch(FaqController.updateFaq)
  .delete(FaqController.deleteFaq);

export default router;
