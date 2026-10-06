import express from "express";
import { CartController } from "../../controllers/mobile/index.js";
import { authorizeRoles, ROLES } from "../../middlewares/role.middleware.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";

const router = express.Router();
router.use(authMiddleware, authorizeRoles(ROLES.USER));

router.get("/", CartController.getCart);
router.post("/items", CartController.addToCart);
router.patch("/items/decrement", CartController.decrementCartItem);
router.delete("/items", CartController.removeCartItem);
router.delete("/", CartController.clearCart);

export default router;
