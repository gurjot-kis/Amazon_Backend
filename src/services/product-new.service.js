import mongoose from "mongoose";
import Product from "../models/product.model.js";
import Category from "../models/category.model.js";
import { paginateAggregate } from "./pagination.service.js";

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

    //category conditions
    const category = await Category.findById(category_id)
      .select("_id status")
      .lean();
    if (!category) throw new Error("Category not found");
    if (category.status !== "active") throw new Error("Category is not active");
    const hasChildren = await Category.exists({ parent_id: category_id });
    if (hasChildren)
      throw new Error(
        "Product can only be added to a leaf category (category with no subcategories)",
      );

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

  getAllProducts: async ({
    page = 1,
    limit = 10,
    search = "",
    category_id = "",
    status = "",
  } = {}) => {
    const matchStage = {};
    if (search) matchStage.name = { $regex: search, $options: "i" };
    if (category_id)
      matchStage.category_id = new mongoose.Types.ObjectId(category_id);
    if (status) matchStage.status = status;

    const pipeline = [
      { $match: matchStage },
      {
        $lookup: {
          from: "categories",
          localField: "category_id",
          foreignField: "_id",
          as: "category",
          pipeline: [{ $project: { _id: 1, name: 1, category_image: 1 } }],
        },
      },
      { $unwind: { path: "$category", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 1,
          name: 1,
          mainImage: 1,
          sku: 1,
          price: 1,
          sellingPrice: 1,
          costPrice: 1,
          currency: 1,
          stock: 1,
          stockStatus: 1,
          status: 1,
          category: 1,
          createdAt: 1,
        },
      },
      { $sort: { createdAt: -1 } },
    ];

    const { data, pagination } = await paginateAggregate(Product, pipeline, {
      page: Number(page),
      limit: Number(limit),
    });

    return { data, pagination };
  },

  getProductById: async (id) => {
    const product = await Product.findById(id)
      .populate("category_id", "name _id")
      .lean();

    if (!product) throw new Error("Product not found");

    return product;
  },

  updateProduct: async (
    id,
    {
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
    },
  ) => {
    const product = await Product.findById(id).lean();
    if (!product) throw new Error("Product not found");

    // required field validations
    if (!name) throw new Error("Product name is required");
    if (!category_id) throw new Error("Category is required");
    if (!sku) throw new Error("SKU is required");
    if (!currency) throw new Error("Currency is required");
    if (costPrice === undefined) throw new Error("Cost price is required");
    if (sellingPrice === undefined)
      throw new Error("Selling price is required");
    if (price === undefined) throw new Error("Price is required");

    const resolvedMainImage = mainImage || product.mainImage;
    if (!resolvedMainImage) throw new Error("Main image is required");

    // sku change — check duplicate
    const normalizedSku = sku.trim().toUpperCase();
    if (normalizedSku !== product.sku) {
      const existingSku = await Product.findOne({
        sku: normalizedSku,
        _id: { $ne: id },
      }).lean();
      if (existingSku) throw new Error("Product with this SKU already exists");
    }

    // category change — validate leaf node
    if (category_id.toString() !== product.category_id.toString()) {
      const category = await Category.findById(category_id)
        .select("_id status")
        .lean();
      if (!category) throw new Error("Category not found");
      if (category.status !== "active")
        throw new Error("Category is not active");
      const hasChildren = await Category.exists({ parent_id: category_id });
      if (hasChildren)
        throw new Error("Product can only be added to a leaf category");
    }

    const stockCount = stock !== undefined ? Number(stock) : 0;

    // slug regenerate if name changed
    const slug =
      name !== product.name
        ? normalizeName(name)
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, "")
            .replace(/\s+/g, "-")
        : product.slug;

    const updated = await Product.findByIdAndUpdate(
      id,
      {
        $set: {
          name: normalizeName(name),
          slug,
          description: description ? String(description).trim() : "",
          short_description: short_description
            ? String(short_description).trim()
            : "",
          category_id,
          sku: normalizedSku,
          currency: currency.trim().toUpperCase(),
          costPrice: Number(costPrice),
          sellingPrice: Number(sellingPrice),
          price: Number(price),
          stock: stockCount,
          stockStatus: stockCount > 0 ? "in_stock" : "out_of_stock",
          mainImage: resolvedMainImage,
          featuredImages: featuredImages || [],
        },
      },
      { new: true, runValidators: true },
    ).lean();

    return updated;
  },

  updateProductStatus: async (id, status) => {
    if (!["pending", "active", "rejected"].includes(status)) {
      throw new Error("Invalid status value");
    }

    const product = await Product.findById(id).select("_id").lean();
    if (!product) throw new Error("Product not found");

    const updated = await Product.findByIdAndUpdate(
      id,
      { $set: { status } },
      { new: true },
    ).lean();

    return updated;
  },

  deleteProduct: async (id) => {
    const product = await Product.findById(id).lean();
    if (!product) throw new Error("Product not found");

    await Product.findByIdAndDelete(id);
  },
};

export default ProductService;
