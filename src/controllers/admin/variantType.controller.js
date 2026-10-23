import { sendError, sendSuccess } from "../../helpers/response.helper.js";
import { VariantTypeService } from "../../services/variantType.service.js";

export const VariantTypeController = {
  createVariantType: async (req, res) => {
    try {
      const variantType = await VariantTypeService.createVariantTypeService(
        req.body,
      );

      return sendSuccess(res, {
        code: 201,
        message: "Variant type created successfully",
        data: variantType,
      });
    } catch (err) {
      return sendError(res, {
        code: err.code || 500,
        message: err.message || "Failed to create variant type",
        error: err,
      });
    }
  },

  getAllVariantTypes: async (req, res) => {
    try {
      const { data, pagination } =
        await VariantTypeService.getAllVariantTypesService(req.query);

      return sendSuccess(res, {
        message: "Variant types fetched successfully",
        data,
        pagination,
      });
    } catch (err) {
      return sendError(res, {
        code: err.code || 500,
        message: err.message || "Failed to fetch variant types",
        error: err,
      });
    }
  },

  getVariantTypeById: async (req, res) => {
    try {
      const variantType = await VariantTypeService.getVariantTypeByIdService(
        req.params.id,
      );

      return sendSuccess(res, {
        code: 200,
        message: "Variant type fetched successfully",
        data: variantType,
      });
    } catch (err) {
      return sendError(res, {
        code: err.code || 500,
        message: err.message || "Failed to fetch variant type",
        error: err,
      });
    }
  },

  updateVariantType: async (req, res) => {
    try {
      const updated = await VariantTypeService.updateVariantTypeService(
        req.params.id,
        req.body,
      );

      return sendSuccess(res, {
        code: 200,
        message: "Variant type updated successfully",
        data: updated,
      });
    } catch (err) {
      return sendError(res, {
        code: err.code || 500,
        message: err.message || "Failed to update variant type",
        error: err,
      });
    }
  },

  updateVariantTypeStatus: async (req, res) => {
    try {
      const updated = await VariantTypeService.updateVariantTypeStatusService(
        req.params.id,
      );

      return sendSuccess(res, {
        code: 200,
        message: `Variant type status updated to ${updated.status} successfully`,
        data: updated,
      });
    } catch (err) {
      return sendError(res, {
        code: err.code || 500,
        message: err.message || "Failed to update variant type status",
        error: err,
      });
    }
  },

  deleteVariantType: async (req, res) => {
    try {
      await VariantTypeService.deleteVariantTypeService(req.params.id);

      return sendSuccess(res, {
        code: 200,
        message: "Variant type deleted successfully",
        data: null,
      });
    } catch (err) {
      return sendError(res, {
        code: err.code || 500,
        message: err.message || "Failed to delete variant type",
        error: err,
      });
    }
  },
};

export default VariantTypeController;
