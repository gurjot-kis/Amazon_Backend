import { CategoryService } from "../../services/category.service.js";
import { sendSuccess } from "../../helpers/response.helper.js";

export const CategoryController = {
  createCategory: async (req, res, next) => {
    try {
      const { name, description, parent_id } = req.body;
      const category_image = req.file
        ? `/uploads/categories/${req.file.filename}`
        : "";
      const category = await CategoryService.createCategory({
        name,
        description,
        parent_id: parent_id || null,
        category_image,
      });

      return sendSuccess(res, {
        code: 201,
        message: "Category created successfully",
        data: category,
      });
    } catch (error) {
      next(error);
    }
  },

  getAllCategories: async (req, res, next) => {
    try {
      const { page, limit, search, status, level } = req.query;

      const { data, pagination } =
        await CategoryService.getAllCategoriesForAdmin({
          page,
          limit,
          search,
          filter_status: status,
          filter_level: level,
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

  getLeafCategories: async (req, res, next) => {
    try {
      const categories = await CategoryService.getLeafCategories();
      return sendSuccess(res, {
        message: "Leaf categories fetched successfully",
        data: categories,
      });
    } catch (error) {
      next(error);
    }
  },

  getCategoryById: async (req, res, next) => {
    try {
      const { id } = req.params;
      const category = await CategoryService.getCategoryById(id);
      return sendSuccess(res, {
        message: "Category fetched successfully",
        data: category,
      });
    } catch (error) {
      next(error);
    }
  },

  updateCategory: async (req, res, next) => {
    try {
      const { id } = req.params;
      const { name, description, parent_id, is_featured, metadata } = req.body;
      const category_image = req.file
        ? `/uploads/categories/${req.file.filename}`
        : "";

      const updated = await CategoryService.updateCategory(id, {
        name,
        description,
        category_image,
        parent_id,
        is_featured,
        metadata,
      });

      return sendSuccess(res, {
        message: "Category updated successfully",
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  },

  toggleCategoryStatus: async (req, res, next) => {
    try {
      const { id } = req.params;
      const updated = await CategoryService.toggleCategoryStatus(id);
      return sendSuccess(res, {
        message: `Category ${updated.status} successfully`,
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  },

  deleteCategory: async (req, res, next) => {
    try {
      const { id } = req.params;
      await CategoryService.deleteCategory(id);
      return sendSuccess(res, {
        message: "Category deleted successfully",
        data: null,
      });
    } catch (error) {
      next(error);
    }
  },
};

export default CategoryController;
