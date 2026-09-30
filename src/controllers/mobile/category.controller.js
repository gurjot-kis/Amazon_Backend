import { sendSuccess } from "../../helpers/response.helper.js";
import CategoryService from "../../services/category.service.js";

export const CategoryController = {
  getAllCategories: async (req, res, next) => {
    try {
      const { page, limit } = req.query;

      const { data, pagination } =
        await CategoryService.getAllCategoriesForUser({
          page,
          limit,
        });

      return sendSuccess(res, {
        message: "Categories fetched successfully",
        data,
        pagination,
      });
    } catch (error) {
      next(error);
    }
  },

  getActiveQuickCommerceCategories: async (req, res, next) => {
    try {
      const data = await CategoryService.getActiveQuickCommerceCategories();

      return sendSuccess(res, {
        message: "Active quick commerce categories fetched successfully",
        data,
      });
    } catch (error) {
      next(error);
    }
  },
};

export default CategoryController;
