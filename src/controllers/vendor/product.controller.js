import {
  applyProductUploads,
  applyProductUploadsForUpdate,
} from "../../helpers/product-upload.helper.js";
import { sendSuccess } from "../../helpers/response.helper.js";
import Product from "../../models/product.model.js";
import ProductService from "../../services/product.service.js";

const parseJson = (v) => (v ? (typeof v === "string" ? JSON.parse(v) : v) : []);
const toBool = (v) => v === true || v === "true";

const pickProductFields = (body) => ({
  name: body.name,
  description: body.description,
  short_description: body.short_description,
  category_id: body.category_id,
  sku: body.sku,
  currency: body.currency,
  costPrice: body.costPrice,
  sellingPrice: body.sellingPrice,
  price: body.price,
  stock: body.stock,
  mainImage: body.mainImage,
  featuredImages: body.featuredImages,
  hasVariants: toBool(body.hasVariants),
  variantTypes: parseJson(body.variantTypes),
  variants: parseJson(body.variants),
  imageGroupTypeId: body.imageGroupTypeId,
});

export const ProductController = {
  createProduct: async (req, res, next) => {
    try {
      const body = applyProductUploads(req.body, req.files);

      const product = await ProductService.createProduct({
        ...pickProductFields(body),
        store_id: body.store_id,
        user_id: req.user._id,
        role: req.user.role,
      });

      return sendSuccess(res, {
        code: 201,
        message: "Product created successfully",
        data: product,
      });
    } catch (error) {
      next(error);
    }
  },

  getAllProducts: async (req, res, next) => {
    try {
      const { page, limit, search, category_id, status, store_id } = req.query;

      const { data, pagination } = await ProductService.getVendorProducts({
        vendor_id: req.user._id,
        store_id,
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

  getAllProductsAcrossStores: async (req, res, next) => {
    try {
      const { page, limit, search, category_id, status } = req.query;

      const { data, pagination } =
        await ProductService.getAllVendorProductsAcrossStores({
          vendor_id: req.user._id,
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
      const product = await ProductService.getProductById(req.params.id, {
        user_id: req.user._id,
      });
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

      // Ownership check; also needed for existing images
      const existing = await Product.findOne({ _id: id, user_id: req.user._id })
        .select("featuredImages mainImage")
        .lean();
      if (!existing) throw new Error("Product not found");

      const body = applyProductUploadsForUpdate(req.body, req.files, existing);

      const updated = await ProductService.updateProduct(
        id,
        req.user._id,
        pickProductFields(body),
      );

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
      const updated = await ProductService.updateVendorProductStatus(
        req.params.id,
        req.user._id,
        req.body.status,
      );
      return sendSuccess(res, {
        message: `Product ${updated.status} successfully`,
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  },

  deleteProduct: async (req, res, next) => {
    try {
      await ProductService.deleteProduct(req.params.id, req.user._id);
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
