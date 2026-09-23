import { sendError, sendSuccess } from "../../helpers/response.helper.js";
import { VariantOptionService } from "../../services/variantOption.service.js";

export const VariantOptionController = {
  createVariantOption: async (req, res) => {
    try {
      const variantOption =
        await VariantOptionService.createVariantOptionService(req.body);

      return sendSuccess(res, {
        code: 201,
        message: "Variant option created successfully",
        data: variantOption,
      });
    } catch (err) {
      return sendError(res, {
        code: err.code || 500,
        message: err.message || "Failed to create variant option",
        error: err,
      });
    }
  },

  getAllVariantOptions: async (req, res) => {
    try {
      const { data, pagination } =
        await VariantOptionService.getAllVariantOptionsService(req.query);

      return sendSuccess(res, {
        message: "Variant options fetched successfully",
        data,
        pagination,
      });
    } catch (err) {
      return sendError(res, {
        code: err.code || 500,
        message: err.message || "Failed to fetch variant options",
        error: err,
      });
    }
  },

  getVariantOptionById: async (req, res) => {
    try {
      const variantOption =
        await VariantOptionService.getVariantOptionByIdService(req.params.id);

      return sendSuccess(res, {
        message: "Variant option fetched successfully",
        data: variantOption,
      });
    } catch (err) {
      return sendError(res, {
        code: err.code || 500,
        message: err.message || "Failed to fetch variant option",
        error: err,
      });
    }
  },

  getVariantOptionsByType: async (req, res) => {
    try {
      const { variantType, variantOptions } =
        await VariantOptionService.getVariantOptionsByTypeService(
          req.params.variantTypeId,
          req.query,
        );

      return sendSuccess(res, {
        message: "Variant options fetched successfully",
        data: {
          variantType,
          variantOptions,
        },
      });
    } catch (err) {
      return sendError(res, {
        code: err.code || 500,
        message: err.message || "Failed to fetch variant options by type",
        error: err,
      });
    }
  },

  updateVariantOption: async (req, res) => {
    try {
      const updated = await VariantOptionService.updateVariantOptionService(
        req.params.id,
        req.body,
      );

      return sendSuccess(res, {
        message: "Variant option updated successfully",
        data: updated,
      });
    } catch (err) {
      return sendError(res, {
        code: err.code || 500,
        message: err.message || "Failed to update variant option",
        error: err,
      });
    }
  },

  updateVariantOptionStatus: async (req, res) => {
    try {
      const updated =
        await VariantOptionService.updateVariantOptionStatusService(
          req.params.id,
        );

      return sendSuccess(res, {
        message: `Variant option status updated to ${updated.status} successfully`,
        data: updated,
      });
    } catch (err) {
      return sendError(res, {
        code: err.code || 500,
        message: err.message || "Failed to update variant option status",
        error: err,
      });
    }
  },

  deleteVariantOption: async (req, res) => {
    try {
      await VariantOptionService.deleteVariantOptionService(req.params.id);

      return sendSuccess(res, {
        message: "Variant option deleted successfully",
        data: null,
      });
    } catch (err) {
      return sendError(res, {
        code: err.code || 500,
        message: err.message || "Failed to delete variant option",
        error: err,
      });
    }
  },
};

export default VariantOptionController;
