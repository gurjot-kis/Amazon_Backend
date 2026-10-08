import express from "express";
import { AddressController } from "../../controllers/mobile/index.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { authorizeRoles, ROLES } from "../../middlewares/role.middleware.js";

const router = express.Router();
router.use(authMiddleware, authorizeRoles(ROLES.USER));

router
  .route("/")
  .get(AddressController.listAddresses)
  .post(AddressController.addAddress);

router
  .route("/:address_id")
  .get(AddressController.getAddressById)
  .put(AddressController.updateAddress)
  .delete(AddressController.deleteAddress);

router.patch("/:address_id/default", AddressController.setDefaultAddress);

export default router;
