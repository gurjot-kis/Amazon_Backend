import { sendError, sendSuccess } from "../../helpers/response.helper.js";
import { HelpService } from "../../services/faq.service.js";

const handleError = (res, error) => {
  return sendError(res, {
    code: error.statusCode || 500,
    message: error.statusCode ? error.message : "Internal server error",
  });
};

export const HelpController = {
  getHelp: async (req, res) => {
    try {
      const { page = 1, limit = 10 } = req.query;

      const result = await HelpService.getAllFaqs({
        page,
        limit,
      });

      return sendSuccess(res, {
        message: "FAQs fetched successfully",
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      return handleError(res, error);
    }
  },

  getFaqById: async (req, res) => {
    try {
      const faq = await HelpService.getFaqById(req.params.faqId);

      return sendSuccess(res, {
        message: "FAQ fetched successfully",
        data: faq,
      });
    } catch (error) {
      return handleError(res, error);
    }
  },

  addFaq: async (req, res) => {
    try {
      const faq = await HelpService.createFaq(req.body);

      return sendSuccess(res, {
        code: 201,
        message: "FAQ added successfully",
        data: faq,
      });
    } catch (error) {
      return handleError(res, error);
    }
  },

  updateFaq: async (req, res) => {
    try {
      const faq = await HelpService.updateFaq(req.params.faqId, req.body);

      return sendSuccess(res, {
        message: "FAQ updated successfully",
        data: faq,
      });
    } catch (error) {
      return handleError(res, error);
    }
  },

  deleteFaq: async (req, res) => {
    try {
      const faq = await HelpService.deleteFaq(req.params.faqId);

      return sendSuccess(res, {
        message: "FAQ deleted successfully",
        data: faq,
      });
    } catch (error) {
      return handleError(res, error);
    }
  },
};

export default HelpController;
