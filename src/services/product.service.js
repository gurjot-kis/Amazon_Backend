import mongoose from "mongoose";
import Product from "../models/product.model.js";
import Category from "../models/category.model.js";
import ProductVariant from "../models/productVariant.model.js";
import VariantType from "../models/variantType.model.js";
import VariantOption from "../models/variantOption.model.js";
import { paginateAggregate } from "./pagination.service.js";

const normalizeName = (value) => String(value).trim();
const normalizeSku = (s) =>
  String(s || "")
    .trim()
    .toUpperCase();
const SKU_REGEX = /^[A-Z0-9][A-Z0-9\-_]{1,49}$/;

const assertUniqueSkus = async ({
  productSku,
  variants = [],
  excludeProductId = null,
}) => {
  if (!SKU_REGEX.test(productSku)) {
    throw new Error("SKU must be 2-50 chars: letters, numbers, - or _");
  }

  const variantSkus = variants.map((v) => normalizeSku(v.sku)).filter(Boolean);

  for (const s of variantSkus) {
    if (!SKU_REGEX.test(s)) throw new Error(`Invalid variant SKU: ${s}`);
  }
  if (new Set(variantSkus).size !== variantSkus.length) {
    throw new Error("Duplicate SKU found in variants");
  }
  if (variantSkus.includes(productSku)) {
    throw new Error("Variant SKU cannot be the same as the product SKU");
  }

  const all = [productSku, ...variantSkus];
  const productFilter = { sku: { $in: all } };
  const variantFilter = { sku: { $in: all } };
  if (excludeProductId) {
    productFilter._id = { $ne: excludeProductId };
    variantFilter.product_id = { $ne: excludeProductId };
  }

  const [p, v] = await Promise.all([
    Product.findOne(productFilter).select("sku").lean(),
    ProductVariant.findOne(variantFilter).select("sku").lean(),
  ]);
  if (p || v) throw new Error(`SKU already exists: ${(p || v).sku}`);
};

const slugify = (text) =>
  String(text)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

const generateUniqueSlug = async (name, excludeId = null) => {
  const base = slugify(name) || "product";
  let slug = base;
  let i = 1;

  while (
    await Product.exists({
      slug,
      ...(excludeId ? { _id: { $ne: excludeId } } : {}),
    })
  ) {
    i += 1;
    slug = `${base}-${i}`;
  }
  return slug;
};

const calcStock = ({ hasVariants, stock, variants = [] }) =>
  hasVariants
    ? variants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0)
    : Number(stock) || 0;

const toNum = (value, label) => {
  const n = Number(value);
  if (
    value === "" ||
    value === null ||
    value === undefined ||
    !Number.isFinite(n)
  ) {
    throw new Error(`${label} must be a valid number`);
  }
  if (n < 0) throw new Error(`${label} cannot be negative`);
  return n;
};

const assertPricing = (
  { costPrice, sellingPrice, price },
  label = "Product",
) => {
  const cost = toNum(costPrice, `${label} cost price`);
  const selling = toNum(sellingPrice, `${label} selling price`);
  const mrp = toNum(price, `${label} MRP`);

  if (cost > selling)
    throw new Error(
      `${label}: cost price cannot be greater than selling price`,
    );
  if (selling > mrp)
    throw new Error(`${label}: selling price cannot be greater than MRP`);
};

const assertVariantNumbers = (variants = [], base) => {
  variants.forEach((v, i) => {
    const label = `Variant #${i + 1}`;
    toNum(v.stock ?? 0, `${label} stock`);
    assertPricing(
      {
        costPrice: v.costPrice ?? base.costPrice,
        sellingPrice: v.sellingPrice ?? base.sellingPrice,
        price: v.price ?? base.price,
      },
      label,
    );
  });
};

const validateVariants = async (variantTypes, variants) => {
  const typeIds = variantTypes.map(String);

  if (new Set(typeIds).size !== typeIds.length) {
    throw new Error("Duplicate variant types are not allowed");
  }

  const validTypes = await VariantType.find({
    _id: { $in: typeIds },
    status: "active",
  }).select("_id");

  if (validTypes.length !== typeIds.length) {
    throw new Error("One or more variant types are invalid or inactive");
  }

  const seenCombos = new Set();
  const optionIds = new Set();

  variants.forEach((variant, i) => {
    const label = `Variant #${i + 1}`;
    const combination = variant.combination;

    if (!Array.isArray(combination) || combination.length === 0) {
      throw new Error(`${label}: combination is required`);
    }

    const usedTypes = combination.map((c) => String(c.variant_type_id));

    if (new Set(usedTypes).size !== usedTypes.length) {
      throw new Error(`${label}: the same variant type is used twice`);
    }
    if (
      usedTypes.length !== typeIds.length ||
      !typeIds.every((t) => usedTypes.includes(t))
    ) {
      throw new Error(
        `${label}: it must have exactly one option for each selected variant type`,
      );
    }

    combination.forEach((c) => {
      if (!c.variant_option_id) {
        throw new Error(`${label}: an option is missing`);
      }
      optionIds.add(String(c.variant_option_id));
    });

    const key = combination
      .map((c) => `${c.variant_type_id}_${c.variant_option_id}`)
      .sort()
      .join("|");

    if (seenCombos.has(key)) {
      throw new Error(`${label}: duplicate combination`);
    }
    seenCombos.add(key);
  });

  // one query for all options instead of one per option
  const options = await VariantOption.find({
    _id: { $in: [...optionIds] },
    status: "active",
  })
    .select("_id variant_type_id")
    .lean();

  const optionMap = new Map(options.map((o) => [String(o._id), o]));

  variants.forEach((variant, i) => {
    variant.combination.forEach((c) => {
      const opt = optionMap.get(String(c.variant_option_id));
      if (!opt || String(opt.variant_type_id) !== String(c.variant_type_id)) {
        throw new Error(
          `Variant #${i + 1}: option is invalid, inactive, or does not belong to its variant type`,
        );
      }
    });
  });
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

    assertPricing({ costPrice, sellingPrice, price });
    if (hasVariants)
      assertVariantNumbers(variants, { costPrice, sellingPrice, price });
    if (!hasVariants) toNum(stock ?? 0, "Stock");

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

    // const existingSku = await Product.findOne({ sku: sku.trim() }).lean();
    // if (existingSku) throw new Error("Product with this SKU already exists");
    const normalizedSku = normalizeSku(sku);
    await assertUniqueSkus({
      productSku: normalizedSku,
      variants: hasVariants ? variants : [],
    });

    const stockCount = calcStock({ hasVariants, stock, variants });

    // create product
    const product = new Product({
      name: normalizeName(name),
      slug: await generateUniqueSlug(name),
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
      mainImage,
      featuredImages: featuredImages || [],
      stock: stockCount,
      stockStatus: stockCount > 0 ? "in_stock" : "out_of_stock",
      status: "pending",
      user_id,
      role,
      hasVariants: hasVariants || false,
      variantTypes: hasVariants ? variantTypes : [],
    });

    try {
      await product.save();
    } catch (err) {
      if (err.code === 11000) {
        if (err.keyPattern?.sku)
          throw new Error("Product with this SKU already exists");
        if (err.keyPattern?.slug)
          throw new Error(
            "A product with this name already exists. Change the name slightly.",
          );
      }
      throw err;
    }

    // create product variants if hasVariants is true
    if (hasVariants && variants?.length > 0) {
      const variantDocs = variants.map((v) => ({
        product_id: product._id,
        combination: v.combination,
        sku: normalizeSku(v.sku),
        costPrice:
          v.costPrice !== undefined ? Number(v.costPrice) : Number(costPrice),
        sellingPrice:
          v.sellingPrice !== undefined
            ? Number(v.sellingPrice)
            : Number(sellingPrice),
        price: v.price !== undefined ? Number(v.price) : Number(price),
        stock: v.stock !== undefined ? Number(v.stock) : 0,
        stockStatus: Number(v.stock) > 0 ? "in_stock" : "out_of_stock",
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
      .populate("category_id", "name _id category_image")
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

  getProductsByCategoryId: async ({
    category_id,
    page = 1,
    limit = 10,
    search = "",
    status = "",
  } = {}) => {
    if (!category_id || !mongoose.Types.ObjectId.isValid(category_id)) {
      throw new Error("Valid category ID is required");
    }

    return await ProductService.getAllProducts({
      category_id,
      page,
      limit,
      search,
      status,
    });
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

    assertPricing({ costPrice, sellingPrice, price });
    if (hasVariants)
      assertVariantNumbers(variants, { costPrice, sellingPrice, price });
    if (!hasVariants) toNum(stock ?? 0, "Stock");

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

    const normalizedSku = normalizeSku(sku);
    await assertUniqueSkus({
      productSku: normalizedSku,
      variants: hasVariants ? variants : [],
      excludeProductId: id,
    });

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

    const stockCount = calcStock({ hasVariants, stock, variants });

    const slug =
      normalizeName(name) !== product.name
        ? await generateUniqueSlug(name, id)
        : product.slug;

    let updated;
    try {
      updated = await Product.findByIdAndUpdate(
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
            hasVariants: hasVariants || false,
            variantTypes: hasVariants ? variantTypes : [],
          },
        },
        { new: true, runValidators: true },
      ).lean();
    } catch (err) {
      if (err.code === 11000) {
        if (err.keyPattern?.sku)
          throw new Error("Product with this SKU already exists");
        if (err.keyPattern?.slug)
          throw new Error("Product name conflict, please try again");
      }
      throw err;
    }

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
            sku: normalizeSku(incoming.sku),
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
            stockStatus:
              Number(incoming.stock) > 0 ? "in_stock" : "out_of_stock",
            images: incoming.images || [],
            status: incoming.status || "active",
          });
        }
      }

      if (toDelete.length > 0) {
        await ProductVariant.deleteMany({ _id: { $in: toDelete } });
      }

      // execute all 3 operations
      await Promise.all([
        // update existing variants
        ...toUpdate.map(({ id: varId, data }) =>
          ProductVariant.findByIdAndUpdate(varId, {
            $set: {
              sku: normalizeSku(data.sku),
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
              stockStatus: Number(data.stock) > 0 ? "in_stock" : "out_of_stock",
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
    if (!["pending", "active", "inactive", "rejected"].includes(status)) {
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
