import express from "express";
import authMiddleware from "../../middlewares/auth.middleware.js";
import authorizeRoles, { ROLES } from "../../middlewares/role.middleware.js";
import { NotifyMeController } from "../../controllers/mobile/notify-me.controller.js";

const router = express.Router();
router.use(authMiddleware, authorizeRoles(ROLES.USER));

router
  .route("/")
  .get(NotifyMeController.listMine)
  .post(NotifyMeController.subscribe);

router.delete("/:id", NotifyMeController.unsubscribe);

export default router;
