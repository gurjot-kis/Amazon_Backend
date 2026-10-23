import express from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { authorizeRoles, ROLES } from "../../middlewares/role.middleware.js";
import { WalletController } from "../../controllers/mobile/index.js";

const router = express.Router();
router.use(authMiddleware, authorizeRoles(ROLES.USER));

router.get("/", WalletController.getWallet);
router.post("/topup", WalletController.createTopup);
router.post("/topup/verify", WalletController.verifyTopup);
router.get("/transactions", WalletController.listTransactions);

export default router;
