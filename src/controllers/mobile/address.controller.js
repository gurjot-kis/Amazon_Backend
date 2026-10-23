import { AddressService } from "../../services/address.service.js";
import { sendSuccess, sendError } from "../../helpers/response.helper.js";

export const AddressController = {
  listAddresses: async (req, res) => {
    try {
      const user_id = req.user?._id;
      const data = await AddressService.listAddresses({ user_id });

      return sendSuccess(res, {
        message: "Address list fetched successfully",
        data,
      });
    } catch (err) {
      return sendError(res, {
        code: 400,
        message: err?.message || "Unable to fetch addresses",
      });
    }
  },

  getAddressById: async (req, res) => {
    try {
      const user_id = req.user?._id;
      const { address_id } = req.params || {};
      const data = await AddressService.getAddressById({ user_id, address_id });

      return sendSuccess(res, {
        message: "Address fetched successfully",
        data,
      });
    } catch (err) {
      const message = err?.message || "Unable to fetch address";

      return sendError(res, {
        code: message === "Address not found" ? 404 : 400,
        message,
      });
    }
  },

  addAddress: async (req, res) => {
    try {
      const user_id = req.user?._id;
      const data = await AddressService.addAddress({
        user_id,
        ...(req.body || {}),
      });

      return sendSuccess(res, {
        code: 201,
        message: "Address added successfully",
        data,
      });
    } catch (err) {
      return sendError(res, {
        code: 400,
        message: err?.message || "Unable to add address",
      });
    }
  },

  setDefaultAddress: async (req, res) => {
    try {
      const user_id = req.user?._id;
      const { address_id } = req.params || {};
      const data = await AddressService.setDefaultAddress({
        user_id,
        address_id,
      });

      return sendSuccess(res, {
        message: "Default address updated successfully",
        data,
      });
    } catch (err) {
      const message = err?.message || "Unable to update default address";
      return sendError(res, {
        code: message === "Address not found" ? 404 : 400,
        message,
      });
    }
  },

  updateAddress: async (req, res) => {
    try {
      const user_id = req.user?._id;
      const { address_id } = req.params || {};
      const data = await AddressService.updateAddress({
        user_id,
        address_id,
        ...(req.body || {}),
      });

      return sendSuccess(res, {
        message: "Address updated successfully",
        data,
      });
    } catch (err) {
      const message = err?.message || "Unable to update address";

      return sendError(res, {
        code: message === "Address not found" ? 404 : 400,
        message,
      });
    }
  },

  deleteAddress: async (req, res) => {
    try {
      const user_id = req.user?._id;
      const { address_id } = req.params || {};
      const data = await AddressService.deleteAddress({ user_id, address_id });

      return sendSuccess(res, {
        message: "Address deleted successfully",
        data,
      });
    } catch (err) {
      const message = err?.message || "Unable to delete address";

      return sendError(res, {
        code: message === "Address not found" ? 404 : 400,
        message,
      });
    }
  },
};

export default AddressController;
