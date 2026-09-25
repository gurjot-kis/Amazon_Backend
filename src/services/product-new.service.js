import mongoose from "mongoose";
import Product from "../models/product.model.js";
import Category from "../models/category.model.js";
import ProductVariant from "../models/productVariant.model.js";
import VariantType from "../models/variantType.model.js";
import VariantOption from "../models/variantOption.model.js";
import { paginateAggregate } from "./pagination.service.js";

const normalizeName = (value) => String(value).trim();

const validateVariants = async (variantTypes, variants) => {
  const validTypes = await VariantType.find({
    _id: { $in: variantTypes },
    status: "active",
  }).select("_id");

  if (validTypes.length !== variantTypes.length) {
    throw new Error("One or more variant types are invalid or inactive");
  }

  for (const variant of variants) {
    if (!variant.combination || variant.combination.length === 0) {
      throw new Error("Each variant must have at least one combination");
    }

    for (const combo of variant.combination) {
      const option = await VariantOption.findOne({
        _id: combo.variant_option_id,
        variant_type_id: combo.variant_type_id,
        status: "active",
      }).lean();

      if (!option) {
        throw new Error(
          `Variant option ${combo.variant_option_id} is invalid or does not belong to the given variant type`,
        );
      }
    }
  }
};

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
    hasVariants,
    variantTypes,
    variants,
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

    // variant specific validations
    if (hasVariants) {
      if (!variantTypes || variantTypes.length === 0) {
        throw new Error("Variant types are required when hasVariants is true");
      }
      if (!variants || variants.length === 0) {
        throw new Error(
          "At least one variant is required when hasVariants is true",
        );
      }

      await validateVariants(variantTypes, variants);
    }

    //category validations
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

    // sku duplicate check
    const existingSku = await Product.findOne({ sku: sku.trim() }).lean();
    if (existingSku) throw new Error("Product with this SKU already exists");

    const stockCount = stock !== undefined ? Number(stock) : 0;

    // create product
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
      stockStatus: !hasVariants
        ? stockCount > 0
          ? "in_stock"
          : "out_of_stock"
        : "in_stock",
      status: "pending",
      user_id,
      role,
      hasVariants: hasVariants || false,
      variantTypes: hasVariants ? variantTypes : [],
    });

    await product.save();

    // create product variants if hasVariants is true
    if (hasVariants && variants?.length > 0) {
      const variantDocs = variants.map((v) => ({
        product_id: product._id,
        combination: v.combination,
        sku: v.sku || "",
        costPrice:
          v.costPrice !== undefined ? Number(v.costPrice) : Number(costPrice),
        sellingPrice:
          v.sellingPrice !== undefined
            ? Number(v.sellingPrice)
            : Number(sellingPrice),
        price: v.price !== undefined ? Number(v.price) : Number(price),
        stock: v.stock !== undefined ? Number(v.stock) : 0,
        stockStatus: v.stock > 0 ? "in_stock" : "out_of_stock",
        images: v.images || [],
        status: "active",
      }));
      await ProductVariant.insertMany(variantDocs);
    }

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
          hasVariants: 1,
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
      .populate("variantTypes", "name")
      .lean();

    if (!product) throw new Error("Product not found");

    if (product.hasVariants) {
      const variants = await ProductVariant.find({ product_id: id })
        .populate("combination.variant_type_id", "name _id")
        .populate("combination.variant_option_id", "value level meta _id")
        .lean();

      product.variants = variants;
    }

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
      hasVariants,
      variantTypes,
      variants,
    },
  ) => {
    const product = await Product.findById(id).lean();
    if (!product) throw new Error("Product not found");

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

    // variant validations
    if (hasVariants) {
      if (!variantTypes || variantTypes.length === 0) {
        throw new Error("Variant types are required when hasVariants is true");
      }
      if (!variants || variants.length === 0) {
        throw new Error(
          "At least one variant is required when hasVariants is true",
        );
      }

      await validateVariants(variantTypes, variants);
    }

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

    const stockCount = !hasVariants && stock !== undefined ? Number(stock) : 0;

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
          stockStatus: !hasVariants
            ? stockCount > 0
              ? "in_stock"
              : "out_of_stock"
            : "in_stock",
          mainImage: resolvedMainImage,
          featuredImages: featuredImages || [],
          hasVariants: hasVariants || false,
          variantTypes: hasVariants ? variantTypes : [],
        },
      },
      { new: true, runValidators: true },
    ).lean();

    if (hasVariants && variants?.length > 0) {
      // fetch all existing variants of this product
      const existingVariants = await ProductVariant.find({
        product_id: id,
      }).lean();

      // helper to create unique key from combination
      // e.g. "colorId_redId|sizeId_sId"
      const makeComboKey = (combination) =>
        combination
          .map((c) => `${c.variant_type_id}_${c.variant_option_id}`)
          .sort()
          .join("|");

      // map existing variants by combo key for quick lookup
      const existingMap = new Map(
        existingVariants.map((v) => [makeComboKey(v.combination), v]),
      );

      // map incoming variants by combo key
      const incomingMap = new Map(
        variants.map((v) => [makeComboKey(v.combination), v]),
      );

      const toInsert = [];
      const toUpdate = [];
      const toDelete = [];

      // find variants to DELETE → in DB but not in incoming
      for (const [key, existing] of existingMap) {
        if (!incomingMap.has(key)) {
          toDelete.push(existing._id);
        }
      }

      // find variants to INSERT or UPDATE
      for (const [key, incoming] of incomingMap) {
        if (existingMap.has(key)) {
          // already exists → UPDATE
          const existingDoc = existingMap.get(key);
          toUpdate.push({ id: existingDoc._id, data: incoming });
        } else {
          // new combination → INSERT
          toInsert.push({
            product_id: id,
            combination: incoming.combination,
            sku: incoming.sku || "",
            costPrice:
              incoming.costPrice !== undefined
                ? Number(incoming.costPrice)
                : Number(costPrice),
            sellingPrice:
              incoming.sellingPrice !== undefined
                ? Number(incoming.sellingPrice)
                : Number(sellingPrice),
            price:
              incoming.price !== undefined
                ? Number(incoming.price)
                : Number(price),
            stock: incoming.stock !== undefined ? Number(incoming.stock) : 0,
            stockStatus: incoming.stock > 0 ? "in_stock" : "out_of_stock",
            images: incoming.images || [],
            status: incoming.status || "active",
          });
        }
      }

      // execute all 3 operations
      await Promise.all([
        // delete only removed variants
        toDelete.length > 0 &&
          ProductVariant.deleteMany({ _id: { $in: toDelete } }),

        // update existing variants
        ...toUpdate.map(({ id: varId, data }) =>
          ProductVariant.findByIdAndUpdate(varId, {
            $set: {
              sku: data.sku || "",
              costPrice:
                data.costPrice !== undefined
                  ? Number(data.costPrice)
                  : Number(costPrice),
              sellingPrice:
                data.sellingPrice !== undefined
                  ? Number(data.sellingPrice)
                  : Number(sellingPrice),
              price:
                data.price !== undefined ? Number(data.price) : Number(price),
              stock: data.stock !== undefined ? Number(data.stock) : 0,
              stockStatus: data.stock > 0 ? "in_stock" : "out_of_stock",
              images: data.images || [],
              status: data.status || "active",
            },
          }),
        ),

        // insert new variants
        toInsert.length > 0 && ProductVariant.insertMany(toInsert),
      ]);
    }

    if (!hasVariants && product.hasVariants) {
      await ProductVariant.deleteMany({ product_id: id });
    }

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

    await Promise.all([
      Product.findByIdAndDelete(id),
      ProductVariant.deleteMany({ product_id: id }),
    ]);
  },
};

export default ProductService;
