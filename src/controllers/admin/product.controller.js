import { sendSuccess } from "../../helpers/response.helper.js";
import ProductService from "../../services/product-new.service.js";

const applyProductUploads = (body, files) => {
  const next = { ...(body || {}) };
  const mainImageFile = files?.mainImage?.[0];
  const featuredImageFiles = files?.featuredImages || [];

  if (mainImageFile) {
    next.mainImage = `/uploads/products/${mainImageFile.filename}`;
  }

  const uploadedFeatured = featuredImageFiles.map(
    (f) => `/uploads/products/${f.filename}`,
  );
  const existingFeatured = normalizeFeaturedImagesInput(next.featuredImages);

  if (uploadedFeatured.length > 0) {
    next.featuredImages = [...(existingFeatured || []), ...uploadedFeatured];
  } else if (next.featuredImages !== undefined) {
    const normalized = normalizeFeaturedImagesInput(next.featuredImages);
    if (normalized === undefined) {
      delete next.featuredImages;
    } else {
      next.featuredImages = normalized;
    }
  }

  return next;
};

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
};

export default ProductController;
