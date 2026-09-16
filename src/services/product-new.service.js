import Product from "../models/product.model.js";
import Category from "../models/category.model.js";

const normalizeName = (value) => String(value).trim();

export const ProductService = {
  createProduct: async ({
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
    user_id,
    role,
  }) => {
    if (!name) throw new Error("Product name is required");
    if (!category_id) throw new Error("Category is required");
    if (!sku) throw new Error("SKU is required");
    if (!mainImage) throw new Error("Main image is required");
    if (!currency) throw new Error("Currency is required");
    if (costPrice === undefined) throw new Error("Cost price is required");
    if (sellingPrice === undefined)
      throw new Error("Selling price is required");
    if (price === undefined) throw new Error("Price is required");

    const category = await Category.findById(category_id)
      .select("_id status")
      .lean();
    if (!category) throw new Error("Category not found");
    if (category.status !== "active") throw new Error("Category is not active");

    const existingSku = await Product.findOne({ sku: sku.trim() }).lean();
    if (existingSku) throw new Error("Product with this SKU already exists");

    const stockCount = stock !== undefined ? Number(stock) : 0;

    const product = new Product({
      name: normalizeName(name),
      description: description ? String(description).trim() : "",
      short_description: short_description
        ? String(short_description).trim()
        : "",
      category_id,
      sku: sku.trim().toUpperCase(),
      currency: currency.trim().toUpperCase(),
      costPrice: Number(costPrice),
      sellingPrice: Number(sellingPrice),
      price: Number(price),
      mainImage,
      featuredImages: featuredImages || [],
      stock: stockCount,
      stockStatus: stockCount > 0 ? "in_stock" : "out_of_stock",
      status: "pending",
      user_id,
      role,
    });

    await product.save();

    return product;
  },
};

export default ProductService;
