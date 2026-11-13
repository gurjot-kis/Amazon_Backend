import { sendSuccess } from "../../helpers/response.helper.js";
import NotifyMeService from "../../services/notify-me.service.js";

const uid = (req) => req.user._id;

export const NotifyMeController = {
  subscribe: async (req, res, next) => {
    try {
      const { productId, variantId } = req.body;
      const data = await NotifyMeService.subscribe({
        user_id: uid(req),
        product_id: productId,
        variant_id: variantId || null,
      });
      return sendSuccess(res, {
        message: "We'll notify you when it's back in stock",
        data,
      });
    } catch (error) {
      next(error);
    }
  },

  unsubscribe: async (req, res, next) => {
    try {
      await NotifyMeService.unsubscribe({
        user_id: uid(req),
        id: req.params.id,
      });
      return sendSuccess(res, { message: "Notify request removed" });
    } catch (error) {
      next(error);
    }
  },

  listMine: async (req, res, next) => {
    try {
      const data = await NotifyMeService.listMine({ user_id: uid(req) });
      return sendSuccess(res, { message: "Notify requests fetched", data });
    } catch (error) {
      next(error);
    }
  },
};

export default NotifyMeController;
