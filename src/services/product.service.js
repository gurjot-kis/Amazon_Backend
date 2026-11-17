import mongoose from "mongoose";
import Product from "../models/product.model.js";
import Category from "../models/category.model.js";
import ProductVariant from "../models/productVariant.model.js";
import VariantType from "../models/variantType.model.js";
import VariantOption from "../models/variantOption.model.js";
import Store from "../models/store.model.js";
import { paginateAggregate } from "./pagination.service.js";
import NotifyMeService from "./notify-me.service.js";

const normalizeName = (value) => String(value).trim();
const normalizeSku = (s) =>
  String(s || "")
    .trim()
    .toUpperCase();
const SKU_REGEX = /^[A-Z0-9][A-Z0-9\-_]{1,49}$/;
const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// true when a value was actually provided (not undefined / null / "")
const hasValue = (v) =>
  v !== undefined && v !== null && String(v).trim() !== "";
// variant value wins, otherwise fall back to the product value
const pickValue = (variantValue, baseValue) =>
  hasValue(variantValue) ? variantValue : baseValue;

const assertUniqueSkus = async ({
  productSku = null, // optional now (variant products have no product SKU)
  variants = [],
  excludeProductId = null,
}) => {
  if (productSku && !SKU_REGEX.test(productSku)) {
    throw new Error("SKU must be 2-50 chars: letters, numbers, - or _");
  }

  const variantSkus = variants.map((v) => normalizeSku(v.sku)).filter(Boolean);

  for (const s of variantSkus) {
    if (!SKU_REGEX.test(s)) throw new Error(`Invalid variant SKU: ${s}`);
  }
  if (new Set(variantSkus).size !== variantSkus.length) {
    throw new Error("Duplicate SKU found in variants");
  }
  if (productSku && variantSkus.includes(productSku)) {
    throw new Error("Variant SKU cannot be the same as the product SKU");
  }

  const all = [productSku, ...variantSkus].filter(Boolean);
  if (all.length === 0) return; // nothing to check

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

// Product-level pricing:
//  - no variants  -> all three are mandatory and validated
//  - has variants -> optional, but if any one is sent, all three are validated
const assertBasePricing = ({ hasVariants, costPrice, sellingPrice, price }) => {
  if (!hasVariants) {
    if (!hasValue(costPrice)) throw new Error("Cost price is required");
    if (!hasValue(sellingPrice)) throw new Error("Selling price is required");
    if (!hasValue(price)) throw new Error("Price is required");
    assertPricing({ costPrice, sellingPrice, price });
    return;
  }
  if ([costPrice, sellingPrice, price].some(hasValue)) {
    assertPricing({ costPrice, sellingPrice, price });
  }
};

// Each variant must end up with its own valid pricing
// (its own value, or the product value if one was provided)
const assertVariantNumbers = (variants = [], base = {}) => {
  variants.forEach((v, i) => {
    const label = `Variant #${i + 1}`;
    toNum(v.stock ?? 0, `${label} stock`);
    assertPricing(
      {
        costPrice: pickValue(v.costPrice, base.costPrice),
        sellingPrice: pickValue(v.sellingPrice, base.sellingPrice),
        price: pickValue(v.price, base.price),
      },
      label,
    );
  });
};

const buildVariantPricing = (v, base = {}) => ({
  costPrice: Number(pickValue(v.costPrice, base.costPrice)),
  sellingPrice: Number(pickValue(v.sellingPrice, base.sellingPrice)),
  price: Number(pickValue(v.price, base.price)),
});

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

const assertVendorStore = async (vendor_id, store_id) => {
  if (!store_id) throw new Error("Store is required");
  if (!mongoose.Types.ObjectId.isValid(store_id)) {
    throw new Error("Invalid store ID");
  }
  const store = await Store.findOne({ _id: store_id, vendor_id })
    .select("_id status")
    .lean();
  if (!store) throw new Error("Store not found");
  return store;
};

const assertObjectId = (id, label) => {
  if (!mongoose.Types.ObjectId.isValid(id)) throw new Error(`Invalid ${label}`);
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
    store_id,
    role,
    hasVariants,
    variantTypes,
    variants,
    imageGroupTypeId,
    unit,
  }) => {
    if (!name) throw new Error("Product name is required");
    if (!category_id) throw new Error("Category is required");
    if (!mainImage) throw new Error("Main image is required");

    // these are mandatory ONLY when the product has no variants
    if (!hasVariants) {
      if (!hasValue(sku)) throw new Error("SKU is required");
      if (!hasValue(currency)) throw new Error("Currency is required");
    }

    const store = await assertVendorStore(user_id, store_id);
    if (store.status !== "active") {
      throw new Error("Products can only be added to an active store");
    }

    assertBasePricing({ hasVariants, costPrice, sellingPrice, price });
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

    const normalizedSku = hasValue(sku) ? normalizeSku(sku) : null;
    await assertUniqueSkus({
      productSku: normalizedSku,
      variants: hasVariants ? variants : [],
    });

    const stockCount = calcStock({ hasVariants, stock, variants });

    const product = new Product({
      name: normalizeName(name),
      store_id,
      slug: await generateUniqueSlug(name),
      description: description ? String(description).trim() : "",
      short_description: short_description
        ? String(short_description).trim()
        : "",
      category_id,
      ...(normalizedSku && { sku: normalizedSku }),
      ...(hasValue(currency) && {
        currency: String(currency).trim().toUpperCase(),
      }),
      ...(hasValue(costPrice) && { costPrice: Number(costPrice) }),
      ...(hasValue(sellingPrice) && { sellingPrice: Number(sellingPrice) }),
      ...(hasValue(price) && { price: Number(price) }),
      mainImage,
      featuredImages: featuredImages || [],
      stock: stockCount,
      stockStatus: stockCount > 0 ? "in_stock" : "out_of_stock",
      status: "pending",
      user_id,
      role,
      hasVariants: hasVariants || false,
      variantTypes: hasVariants ? variantTypes : [],
      imageGroupTypeId: hasVariants ? imageGroupTypeId : null,
      ...(hasValue(unit) && { unit }),
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
      const base = { costPrice, sellingPrice, price };
      const variantDocs = variants.map((v) => ({
        product_id: product._id,
        combination: v.combination,
        sku: normalizeSku(v.sku),
        ...buildVariantPricing(v, base),
        stock: Number(v.stock) || 0,
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
    user_id = "",
    store_id = "",
  } = {}) => {
    const matchStage = {};
    if (search)
      matchStage.name = { $regex: escapeRegex(search), $options: "i" };
    if (category_id) {
      assertObjectId(category_id, "category ID");
      matchStage.category_id = new mongoose.Types.ObjectId(category_id);
    }
    if (store_id) {
      assertObjectId(store_id, "store ID");
      matchStage.store_id = new mongoose.Types.ObjectId(store_id);
    }
    if (user_id) matchStage.user_id = new mongoose.Types.ObjectId(user_id);
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
        $lookup: {
          from: "stores",
          localField: "store_id",
          foreignField: "_id",
          as: "store",
          pipeline: [{ $project: { _id: 1, store_name: 1, store_logo: 1 } }],
        },
      },
      { $unwind: { path: "$store", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "productvariants",
          let: { pid: "$_id", hv: "$hasVariants" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$product_id", "$$pid"] },
                    { $eq: ["$$hv", true] },
                    { $eq: ["$status", "active"] },
                  ],
                },
              },
            },
            {
              $group: {
                _id: null,
                minPrice: { $min: "$sellingPrice" },
                maxPrice: { $max: "$sellingPrice" },
              },
            },
          ],
          as: "variantPriceRange",
        },
      },
      {
        $unwind: {
          path: "$variantPriceRange",
          preserveNullAndEmptyArrays: true,
        },
      },
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
          store: 1,
          unit: 1,
          priceRange: {
            $cond: {
              if: "$hasVariants",
              then: {
                min: "$variantPriceRange.minPrice",
                max: "$variantPriceRange.maxPrice",
              },
              else: null,
            },
          },
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

  getProductById: async (id, { user_id } = {}) => {
    assertObjectId(id, "product ID");

    const filter = { _id: id };
    if (user_id) filter.user_id = user_id;

    const product = await Product.findOne(filter)
      .populate("category_id", "name _id category_image")
      .populate("store_id", "store_name store_logo")
      .populate("variantTypes", "name")
      .populate("imageGroupTypeId", "name _id")
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

  getMobileProductById: async (id, { user_id } = {}) => {
    const product = await Product.findById(id)
      .populate("category_id", "name _id category_image")
      .populate("variantTypes", "name _id")
      .populate("imageGroupTypeId", "name _id")
      .lean();

    if (!product) throw new Error("Product not found");
    if (product.status !== "active") throw new Error("Product not found");

    const store = await Store.findOne({
      _id: product.store_id,
      status: "active",
      verification_status: "verified",
    })
      .select("_id store_name store_logo")
      .lean();
    if (!store) throw new Error("Product not found");

    const notifyRows = await NotifyMeService.getUserRequests({
      user_id,
      product_ids: [product._id],
    });
    const notifyByVariant = new Map(
      notifyRows.map((r) => [String(r.variant_id || "none"), String(r._id)]),
    );
    const notifyFields = (variantId) => {
      const requestId = notifyByVariant.get(String(variantId || "none"));
      return { isNotifyEnabled: !!requestId, notifyMeId: requestId || null };
    };

    if (!product.hasVariants) {
      return {
        _id: product._id,
        name: product.name,
        store,
        slug: product.slug,
        description: product.description,
        short_description: product.short_description,
        mainImage: product.mainImage,
        featuredImages: product.featuredImages,
        sku: product.sku,
        currency: product.currency,
        costPrice: product.costPrice,
        sellingPrice: product.sellingPrice,
        price: product.price,
        stock: product.stock,
        stockStatus: product.stockStatus,
        status: product.status,
        category: product.category_id,
        unit: product.unit,
        hasVariants: false,
        ...notifyFields(null),
        variantTypes: [],
        swatches: [],
      };
    }

    const variants = await ProductVariant.find({
      product_id: id,
      status: "active",
    })
      .populate("combination.variant_type_id", "name _id")
      .populate("combination.variant_option_id", "value label meta _id")
      .lean();

    const imageGroupTypeId = product.imageGroupTypeId
      ? String(product.imageGroupTypeId._id || product.imageGroupTypeId)
      : null;

    if (!imageGroupTypeId) {
      return {
        _id: product._id,
        name: product.name,
        store,
        slug: product.slug,
        description: product.description,
        short_description: product.short_description,
        mainImage: product.mainImage,
        featuredImages: product.featuredImages,
        sku: product.sku,
        currency: product.currency,
        costPrice: product.costPrice,
        sellingPrice: product.sellingPrice,
        price: product.price,
        stock: product.stock,
        stockStatus: product.stockStatus,
        status: product.status,
        category: product.category_id,
        unit: product.unit,
        hasVariants: true,
        variantTypes: product.variantTypes,
        imageGroupType: null,
        swatches: [
          {
            option: null,
            options: variants.map((v) => ({
              variantId: v._id,
              ...notifyFields(v._id),
              sku: v.sku,
              costPrice: v.costPrice,
              sellingPrice: v.sellingPrice,
              price: v.price,
              stock: v.stock,
              stockStatus: v.stockStatus,
              images: v.images || [], // ✅
              thumbnail: v.images?.[0] || null, // ✅ optional
              attributes: v.combination.map((c) => ({
                type: {
                  _id: c.variant_type_id._id,
                  name: c.variant_type_id.name,
                },
                option: {
                  _id: c.variant_option_id._id,
                  value: c.variant_option_id.value,
                  label: c.variant_option_id.label || c.variant_option_id.value,
                },
              })),
            })),
          },
        ],
      };
    }

    const swatchMap = new Map();

    variants.forEach((v) => {
      const groupCombo = v.combination.find(
        (c) => String(c.variant_type_id._id) === imageGroupTypeId,
      );
      if (!groupCombo) return;

      const groupOptId = String(groupCombo.variant_option_id._id);

      if (!swatchMap.has(groupOptId)) {
        swatchMap.set(groupOptId, {
          option: {
            _id: groupCombo.variant_option_id._id,
            value: groupCombo.variant_option_id.value,
            label:
              groupCombo.variant_option_id.label ||
              groupCombo.variant_option_id.value,
            meta: groupCombo.variant_option_id.meta || {},
          },
          images: v.images, // all images for this color
          thumbnail: v.images[0] || null, // first image as swatch thumbnail
          options: [], // available sizes/other options for this color
        });
      }

      // Add the other dimension (Size) as an available option under this color
      const otherCombos = v.combination.filter(
        (c) => String(c.variant_type_id._id) !== imageGroupTypeId,
      );

      swatchMap.get(groupOptId).options.push({
        variantId: v._id,
        ...notifyFields(v._id),
        sku: v.sku,
        costPrice: v.costPrice,
        sellingPrice: v.sellingPrice,
        price: v.price,
        stock: v.stock,
        stockStatus: v.stockStatus,
        // The size (or other non-image dimension) for this specific variant
        attributes: otherCombos.map((c) => ({
          type: {
            _id: c.variant_type_id._id,
            name: c.variant_type_id.name,
          },
          option: {
            _id: c.variant_option_id._id,
            value: c.variant_option_id.value,
            label: c.variant_option_id.label || c.variant_option_id.value,
          },
        })),
      });
    });

    return {
      _id: product._id,
      name: product.name,
      store,
      slug: product.slug,
      description: product.description,
      short_description: product.short_description,
      mainImage: product.mainImage,
      featuredImages: product.featuredImages,
      sku: product.sku,
      currency: product.currency,
      costPrice: product.costPrice,
      sellingPrice: product.sellingPrice,
      price: product.price,
      stock: product.stock,
      stockStatus: product.stockStatus,
      status: product.status,
      category: product.category_id,
      unit: product.unit,
      hasVariants: true,
      variantTypes: product.variantTypes,
      imageGroupType:
        product.variantTypes.find(
          (vt) => String(vt._id) === imageGroupTypeId,
        ) || null,
      swatches: Array.from(swatchMap.values()),
    };
  },

  getProductsByCategoryId: async ({
    category_id,
    store_id,
    user_id,
    page = 1,
    limit = 10,
    search = "",
  } = {}) => {
    if (!category_id || !mongoose.Types.ObjectId.isValid(category_id)) {
      throw new Error("Valid category ID is required");
    }
    if (!store_id || !mongoose.Types.ObjectId.isValid(store_id)) {
      throw new Error("Valid store ID is required");
    }

    // Customers can only browse stores that are live
    const store = await Store.exists({
      _id: store_id,
      status: "active",
      verification_status: "verified",
    });
    if (!store) throw new Error("Store is not available");

    const result = await ProductService.getAllProducts({
      category_id,
      store_id,
      page,
      limit,
      search,
      status: "active",
    });

    const rows = await NotifyMeService.getUserRequests({
      user_id,
      product_ids: result.data.map((p) => p._id),
    });

    // productId -> { notifyMeId }  (notifyMeId only for products without variants)
    const notifyByProduct = new Map();
    rows.forEach((r) => {
      const key = String(r.product_id);
      const entry = notifyByProduct.get(key) || { notifyMeId: null };
      if (!r.variant_id) entry.notifyMeId = String(r._id);
      notifyByProduct.set(key, entry);
    });

    result.data = result.data.map((p) => {
      const entry = notifyByProduct.get(String(p._id));
      return {
        ...p,
        isNotifyEnabled: !!entry,
        notifyRequestId: entry?.notifyMeId || null,
      };
    });

    return result;
  },

  updateProduct: async (
    id,
    vendor_id,
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
      imageGroupTypeId,
      store_id,
      unit,
    },
  ) => {
    assertObjectId(id, "product ID");
    const product = await Product.findOne({
      _id: id,
      user_id: vendor_id,
    }).lean();
    if (!product) throw new Error("Product not found");

    if (!name) throw new Error("Product name is required");
    if (!category_id) throw new Error("Category is required");

    // these are mandatory ONLY when the product has no variants
    if (!hasVariants) {
      if (!hasValue(sku)) throw new Error("SKU is required");
      if (!hasValue(currency)) throw new Error("Currency is required");
    }

    assertBasePricing({ hasVariants, costPrice, sellingPrice, price });
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

    const normalizedSku = hasValue(sku) ? normalizeSku(sku) : null;
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

    // optional base fields: set when provided, remove when not provided
    // (only possible for variant products; non-variant ones are validated above)
    const optionalSet = {};
    const optionalUnset = {};
    const setOrUnset = (key, provided, value) => {
      if (provided) optionalSet[key] = value;
      else optionalUnset[key] = "";
    };
    setOrUnset("sku", !!normalizedSku, normalizedSku);
    setOrUnset(
      "currency",
      hasValue(currency),
      hasValue(currency) ? String(currency).trim().toUpperCase() : null,
    );
    setOrUnset("costPrice", hasValue(costPrice), Number(costPrice));
    setOrUnset("sellingPrice", hasValue(sellingPrice), Number(sellingPrice));
    setOrUnset("price", hasValue(price), Number(price));

    const updateDoc = {
      $set: {
        name: normalizeName(name),
        slug,
        description: description ? String(description).trim() : "",
        short_description: short_description
          ? String(short_description).trim()
          : "",
        category_id,
        ...optionalSet,
        stock: stockCount,
        stockStatus: stockCount > 0 ? "in_stock" : "out_of_stock",
        mainImage: resolvedMainImage,
        featuredImages: featuredImages || [],
        hasVariants: hasVariants || false,
        variantTypes: hasVariants ? variantTypes : [],
        imageGroupTypeId: hasVariants ? imageGroupTypeId : null,
        ...(store_id && { store_id }),
        ...(hasValue(unit) && { unit }),
      },
      ...(Object.keys(optionalUnset).length > 0 && { $unset: optionalUnset }),
    };

    let updated;
    try {
      updated = await Product.findByIdAndUpdate(id, updateDoc, {
        new: true,
        runValidators: true,
      }).lean();
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
      const base = { costPrice, sellingPrice, price };

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
            ...buildVariantPricing(incoming, base),
            stock: Number(incoming.stock) || 0,
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
              ...buildVariantPricing(data, base),
              stock: Number(data.stock) || 0,
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

    NotifyMeService.notifyForProduct(id).catch((e) =>
      console.error("[notify-me] hook failed:", e?.message),
    );

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

  deleteProduct: async (id, vendor_id) => {
    assertObjectId(id, "product ID");
    const product = await Product.findOne({ _id: id, user_id: vendor_id })
      .select("_id")
      .lean();
    if (!product) throw new Error("Product not found");

    await Promise.all([
      Product.findByIdAndDelete(id),
      ProductVariant.deleteMany({ product_id: id }),
      NotifyMeService.cancelForProduct(id),
    ]);
  },

  getVendorProducts: async ({ vendor_id, store_id, ...filters }) => {
    if (store_id) {
      await assertVendorStore(vendor_id, store_id);
    }
    return ProductService.getAllProducts({
      ...filters,
      user_id: vendor_id,
      store_id,
    });
  },

  getAllVendorProductsAcrossStores: async ({
    vendor_id,
    page,
    limit,
    search = "",
    category_id = "",
    status = "",
  } = {}) => {
    const matchStage = { user_id: new mongoose.Types.ObjectId(vendor_id) };
    if (search)
      matchStage.name = { $regex: escapeRegex(search), $options: "i" };
    if (category_id) {
      assertObjectId(category_id, "category ID");
      matchStage.category_id = new mongoose.Types.ObjectId(category_id);
    }
    if (status) matchStage.status = status;

    const pipeline = [
      { $match: matchStage },
      {
        $lookup: {
          from: "stores",
          localField: "store_id",
          foreignField: "_id",
          as: "store",
          pipeline: [{ $project: { _id: 1, store_name: 1, store_logo: 1 } }],
        },
      },
      {
        $unwind: { path: "$store", preserveNullAndEmptyArrays: true },
      },
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
          store: 1,
          createdAt: 1,
        },
      },
      { $sort: { createdAt: -1 } },
    ];

    return paginateAggregate(Product, pipeline, {
      page: Number(page) || 1,
      limit: Number(limit) || 10,
    });
  },

  updateVendorProductStatus: async (id, vendor_id, status) => {
    assertObjectId(id, "product ID");
    if (!["active", "inactive", "pending"].includes(status)) {
      throw new Error("Status must be active, inactive or pending");
    }

    const product = await Product.findById(id).select("status store_id").lean();
    if (!product) throw new Error("Product not found");

    // verify the product's store belongs to this vendor
    const store = await Store.findOne({
      _id: product.store_id,
      vendor_id,
    })
      .select("_id")
      .lean();
    if (!store) throw new Error("Product not found");

    // vendor cannot change rejected products
    if (product.status === "rejected") {
      throw new Error("A rejected product cannot be changed");
    }

    return Product.findByIdAndUpdate(
      id,
      { $set: { status } },
      { new: true },
    ).lean();
  },
};

export default ProductService;
