import { sendSuccess } from "../../helpers/response.helper.js";
import AppContentService from "../../services/appContent.service.js";
import HelpService from "../../services/faq.service.js";

const getUserId = (req) => req.user?._id || req.user?.id;
const getStoreId = (req) => req.activeStoreId;

export const AppContentController = {
  getStoreContactAndTimings: async (req, res, next) => {
    try {
      const storeId = getStoreId(req);
      const result = await AppContentService.getStoreContactAndTimings(storeId);
      return sendSuccess(res, {
        message: "Contact Us details fetched successfully",
        data: result,
      });
    } catch (err) {
      next(err);
    }
  },

  getActiveFaqs: async (req, res, next) => {
    try {
      const faqs = await HelpService.getActiveFaqsForMobile();

      return sendSuccess(res, {
        message: "Active FAQs fetched successfully",
        data: faqs,
      });
    } catch (error) {
      next(error);
    }
  },
};

export default AppContentController;
