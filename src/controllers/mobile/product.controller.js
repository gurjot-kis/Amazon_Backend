import { sendSuccess } from "../../helpers/response.helper.js";
import ProductService from "../../services/product.service.js";

export const ProductController = {
  getProductsByCategoryId: async (req, res, next) => {
    try {
      const { categoryId } = req.params;
      const {store_id, page, limit, search } = req.query;

      const { data, pagination } = await ProductService.getProductsByCategoryId(
        {
          category_id: categoryId,
          store_id,
          page,
          limit,
          search,
        },
      );

      return sendSuccess(res, {
        message: "Products fetched successfully for the category",
        data,
        pagination,
      });
    } catch (error) {
      next(error);
    }
  },

  productDetails: async (req, res, next) => {
    try {
      const { id } = req.params;
      const product = await ProductService.getMobileProductById(id);

      return sendSuccess(res, {
        message: "Product fetched successfully",
        data: product,
      });
    } catch (error) {
      next(error);
    }
  },
};

export default ProductController;
