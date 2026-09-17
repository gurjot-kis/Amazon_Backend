import {
  applyProductUploads,
  applyProductUploadsForUpdate,
} from "../../helpers/product-upload.helper.js";
import { sendSuccess } from "../../helpers/response.helper.js";
import Product from "../../models/product.model.js";
import ProductService from "../../services/product-new.service.js";

export const ProductController = {
  createProduct: async (req, res, next) => {
    try {
      const body = applyProductUploads(req.body, req.files);

      const {
        name,
        description,
        short_description,
        category_id,
        sku,
        currency,
        costPrice,
        sellingPrice,
        price,
        stock,
        mainImage,
        featuredImages,
      } = body;

      const product = await ProductService.createProduct({
        name,
        description,
        short_description,
        category_id,
        sku,
        currency,
        costPrice,
        sellingPrice,
        price,
        stock,
        mainImage,
        featuredImages,
        user_id: req.user._id,
        role: req.user.role,
      });

      return sendSuccess(res, {
        message: "Product created successfully",
        data: product,
      });
    } catch (error) {
      next(error);
    }
  },

  getAllProducts: async (req, res, next) => {
    try {
      const { page, limit, search, category_id, status } = req.query;

      const { data, pagination } = await ProductService.getAllProducts({
        page,
        limit,
        search,
        category_id,
        status,
      });

      return sendSuccess(res, {
        message: "Products fetched successfully",
        data,
        pagination,
      });
    } catch (error) {
      next(error);
    }
  },

  getProductById: async (req, res, next) => {
    try {
      const { id } = req.params;
      const product = await ProductService.getProductById(id);

      return sendSuccess(res, {
        message: "Product fetched successfully",
        data: product,
      });
    } catch (error) {
      next(error);
    }
  },

  updateProduct: async (req, res, next) => {
    try {
      const { id } = req.params;

      // fetch existing first — needed for featuredImages fallback
      const existing = await Product.findById(id)
        .select("featuredImages mainImage")
        .lean();
      if (!existing) {
        return sendSuccess(res, { message: "Product not found" }, 404);
      }

      const body = applyProductUploadsForUpdate(req.body, req.files, existing);

      const {
        name,
        description,
        short_description,
        category_id,
        sku,
        currency,
        costPrice,
        sellingPrice,
        price,
        stock,
        mainImage,
        featuredImages,
      } = body;

      const updated = await ProductService.updateProduct(id, {
        name,
        description,
        short_description,
        category_id,
        sku,
        currency,
        costPrice,
        sellingPrice,
        price,
        stock,
        mainImage,
        featuredImages,
      });

      return sendSuccess(res, {
        message: "Product updated successfully",
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  },

  updateProductStatus: async (req, res, next) => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!status) throw new Error("Status is required");

      const updated = await ProductService.updateProductStatus(id, status);
      return sendSuccess(res, {
        message: `Product status updated to ${updated.status} successfully`,
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  },

  deleteProduct: async (req, res, next) => {
    try {
      const { id } = req.params;
      await ProductService.deleteProduct(id);
      return sendSuccess(res, {
        message: "Product deleted successfully",
        data: null,
      });
    } catch (error) {
      next(error);
    }
  },
};

export default ProductController;
