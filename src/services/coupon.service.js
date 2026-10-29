import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import Coupon from "../models/coupon.model.js";
import Store from "../models/store.model.js";
import CouponUsage from "../models/coupon-usage.model.js";
import { AppError } from "../utils/AppError.js";

const normalizeString = (value) =>
  value === undefined || value === null ? "" : String(value).trim();

const normalizeCouponId = (value) => {
  const s = normalizeString(value);
  return s.startsWith(":") ? s.slice(1) : s;
};

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const parseStatus = (value, { required = false, defaultValue = 1 } = {}) => {
  if (value === undefined || value === null || value === "") {
    if (required) {
      throw new Error("status is required");
    }
    return defaultValue;
  }
  const n = parseInt(String(value).trim(), 10);
  if (n === 0 || n === 1) {
    return n;
  }
  throw new Error("status must be 0 or 1");
};

const DISCOUNT_TYPES = ["percentage", "fixed"];
const SCOPES = ["global", "store"];
const IMAGE_TYPES = ["website", "mobile"];
const selectPublicFields =
  "code title description discount_type discount_value min_order_amount max_discount_amount usage_limit per_user_limit used_count scope created_by created_by_role vendor_id store_ids start_date end_date status website_image mobile_image createdAt updatedAt";

//Validates that store_ids belong to the given vendor.
const validateStoreOwnership = async (vendorId, storeIds) => {
  if (!storeIds || storeIds.length === 0) return;

  const stores = await Store.find({
    _id: { $in: storeIds },
    vendor_id: vendorId,
  })
    .select("_id")
    .lean();

  if (stores.length !== storeIds.length) {
    throw new Error(
      "One or more store_ids do not belong to the specified vendor",
    );
  }
};

const resolveId = (value) => {
  const id = normalizeCouponId(value);
  if (!id) throw new Error("Coupon id is required");
  if (!mongoose.Types.ObjectId.isValid(id))
    throw new Error("Invalid coupon id");
  return id;
};

const buildFilter = (id, vendor_id) => {
  const filter = { _id: id };
  if (vendor_id) filter.vendor_id = vendor_id;
  return filter;
};

const uniqueIds = (ids) =>
  Array.isArray(ids) ? [...new Set(ids.map(String))] : [];

const validateDiscountRules = ({
  discount_type,
  discount_value,
  min_order_amount,
  max_discount_amount,
}) => {
  if (discount_type === "percentage" && discount_value > 100) {
    throw new Error("percentage discount_value must be between 0 and 100");
  }
  if (isNaN(min_order_amount) || min_order_amount < 0) {
    throw new Error("min_order_amount must be a non-negative number");
  }
  if (max_discount_amount !== null) {
    if (isNaN(max_discount_amount) || max_discount_amount < 0) {
      throw new Error("max_discount_amount must be a non-negative number");
    }
    if (discount_type === "fixed") {
      throw new Error(
        "max_discount_amount is only allowed for percentage coupons",
      );
    }
  }
};

const removeStoredFile = (relativePath) => {
  if (!relativePath) return;
  fs.unlink(path.join(process.cwd(), relativePath), () => {});
};

const toCouponResponse = (doc) => ({
  _id: doc._id,
  code: doc.code,
  title: doc.title,
  description: doc.description,
  discount_type: doc.discount_type,
  discount_value: doc.discount_value,
  min_order_amount: doc.min_order_amount,
  max_discount_amount: doc.max_discount_amount,
  usage_limit: doc.usage_limit,
  per_user_limit: doc.per_user_limit,
  used_count: doc.used_count,
  scope: doc.scope,
  created_by: doc.created_by,
  created_by_role: doc.created_by_role,
  vendor_id: doc.vendor_id,
  store_ids: doc.store_ids,
  start_date: doc.start_date,
  end_date: doc.end_date,
  status: doc.status,
  website_image: doc.website_image,
  mobile_image: doc.mobile_image,
});

const round2 = (n) => Math.round(n * 100) / 100;

const calculateDiscount = (coupon, orderAmount) => {
  let discount =
    coupon.discount_type === "percentage"
      ? (orderAmount * coupon.discount_value) / 100
      : coupon.discount_value;

  if (coupon.max_discount_amount != null) {
    discount = Math.min(discount, coupon.max_discount_amount);
  }
  discount = Math.min(discount, orderAmount);
  return round2(discount);
};

const validateCouponForUser = async ({
  code,
  user_id,
  order_amount,
  store_id,
  session,
}) => {
  const normalizedCode = normalizeString(code).toUpperCase();
  if (!normalizedCode) throw new AppError(400, "code is required");

  const amount = parseFloat(order_amount);
  if (isNaN(amount) || amount <= 0) {
    throw new AppError(400, "order_amount must be a positive number");
  }

  const coupon = await Coupon.findOne({ code: normalizedCode })
    .session(session)
    .lean();
  if (!coupon || coupon.status !== 1) {
    throw new AppError(400, "Invalid or inactive coupon");
  }

  const now = new Date();
  if (now < coupon.start_date)
    throw new AppError(400, "Coupon is not active yet");
  if (now > coupon.end_date) throw new AppError(400, "Coupon has expired");

  if (coupon.usage_limit !== null && coupon.used_count >= coupon.usage_limit) {
    throw new AppError(400, "Coupon usage limit reached");
  }

  if (coupon.scope === "store" || coupon.vendor_id) {
    if (!store_id || !mongoose.Types.ObjectId.isValid(store_id)) {
      throw new AppError(400, "A valid store_id is required for this coupon");
    }
    if (
      coupon.scope === "store" &&
      !coupon.store_ids.map(String).includes(String(store_id))
    ) {
      throw new AppError(400, "Coupon is not valid for this store");
    }
    if (coupon.vendor_id) {
      const store = await Store.findById(store_id)
        .select("vendor_id")
        .session(session)
        .lean();
      if (!store || String(store.vendor_id) !== String(coupon.vendor_id)) {
        throw new AppError(400, "Coupon is not valid for this store");
      }
    }
  }

  const userUsed = await CouponUsage.countDocuments({
    coupon_id: coupon._id,
    user_id,
  }).session(session);
  if (userUsed >= coupon.per_user_limit) {
    throw new AppError(
      400,
      "You have already used this coupon the maximum number of times",
    );
  }

  if (amount < coupon.min_order_amount) {
    throw new AppError(
      400,
      `Minimum order amount for this coupon is ${coupon.min_order_amount}`,
    );
  }

  const discount_amount = calculateDiscount(coupon, amount);

  return {
    coupon,
    order_amount: amount,
    discount_amount,
    final_amount: round2(amount - discount_amount),
  };
};

const toApplyResponse = ({
  coupon,
  order_amount,
  discount_amount,
  final_amount,
}) => ({
  coupon_id: coupon._id,
  code: coupon.code,
  title: coupon.title,
  discount_type: coupon.discount_type,
  discount_value: coupon.discount_value,
  order_amount,
  discount_amount,
  final_amount,
});

export const CouponService = {
  createCoupon: async ({
    code,
    title,
    description,
    discount_type,
    discount_value,
    min_order_amount,
    max_discount_amount,
    usage_limit,
    per_user_limit,
    scope,
    created_by,
    created_by_role,
    vendor_id,
    store_ids,
    start_date,
    end_date,
    status,
  }) => {
    const normalizedCode = normalizeString(code).toUpperCase();
    if (!normalizedCode) {
      throw new Error("code is required");
    }

    const normalizedTitle = normalizeString(title);
    if (!normalizedTitle) {
      throw new Error("title is required");
    }

    if (!discount_type || !DISCOUNT_TYPES.includes(discount_type)) {
      throw new Error("discount_type must be percentage or fixed");
    }

    const parsedDiscountValue = parseFloat(discount_value);
    if (isNaN(parsedDiscountValue) || parsedDiscountValue < 0) {
      throw new Error("discount_value must be a non-negative number");
    }

    if (!start_date) {
      throw new Error("start_date is required");
    }
    if (!end_date) {
      throw new Error("end_date is required");
    }

    const parsedStartDate = new Date(start_date);
    const parsedEndDate = new Date(end_date);

    if (isNaN(parsedStartDate.getTime())) {
      throw new Error("start_date must be a valid date");
    }
    if (isNaN(parsedEndDate.getTime())) {
      throw new Error("end_date must be a valid date");
    }
    if (parsedEndDate <= parsedStartDate) {
      throw new Error("end_date must be after start_date");
    }

    const existing = await Coupon.findOne({ code: normalizedCode })
      .select("_id")
      .lean();
    if (existing) {
      throw new Error("Coupon code already exists");
    }

    let resolvedScope = scope || "global";
    if (!SCOPES.includes(resolvedScope)) {
      throw new Error("scope must be global or store");
    }

    const resolvedStoreIds = uniqueIds(store_ids);

    if (resolvedStoreIds.length > 0) {
      resolvedScope = "store";
    }

    if (resolvedScope === "store" && resolvedStoreIds.length === 0) {
      throw new Error("store_ids are required when scope is store");
    }

    const resolvedVendorId = vendor_id || null;

    if (resolvedScope === "store" && resolvedVendorId) {
      await validateStoreOwnership(resolvedVendorId, resolvedStoreIds);
    }

    const parsedMinOrder =
      min_order_amount !== undefined && min_order_amount !== null
        ? parseFloat(min_order_amount)
        : 0;
    const parsedMaxDiscount =
      max_discount_amount !== undefined && max_discount_amount !== null
        ? parseFloat(max_discount_amount)
        : null;
    const parsedUsageLimit =
      usage_limit !== undefined && usage_limit !== null
        ? parseInt(usage_limit, 10)
        : null;
    const parsedPerUserLimit =
      per_user_limit !== undefined && per_user_limit !== null
        ? parseInt(per_user_limit, 10)
        : 1;
    const parsedStatus = parseStatus(status, { defaultValue: 1 });

    if (
      parsedUsageLimit !== null &&
      (isNaN(parsedUsageLimit) || parsedUsageLimit < 1)
    ) {
      throw new Error("usage_limit must be at least 1");
    }
    if (isNaN(parsedPerUserLimit) || parsedPerUserLimit < 1) {
      throw new Error("per_user_limit must be at least 1");
    }
    validateDiscountRules({
      discount_type,
      discount_value: parsedDiscountValue,
      min_order_amount: parsedMinOrder,
      max_discount_amount: parsedMaxDiscount,
    });

    const doc = await Coupon.create({
      code: normalizedCode,
      title: normalizedTitle,
      description:
        description !== undefined ? normalizeString(description) : "",
      discount_type,
      discount_value: parsedDiscountValue,
      min_order_amount: parsedMinOrder,
      max_discount_amount: parsedMaxDiscount,
      usage_limit: parsedUsageLimit,
      per_user_limit: parsedPerUserLimit,
      scope: resolvedScope,
      created_by,
      created_by_role,
      vendor_id: resolvedVendorId,
      store_ids: resolvedStoreIds,
      start_date: parsedStartDate,
      end_date: parsedEndDate,
      status: parsedStatus,
    });

    return toCouponResponse(doc);
  },

  listCoupons: async ({
    page = 1,
    limit = 10,
    search = "",
    status: statusFilter,
    scope: scopeFilter,
    vendor_id: vendorIdFilter,
    store_id: storeIdFilter,
    created_by_role: roleFilter,
  } = {}) => {
    const parsedPage = Math.max(1, parseInt(page, 10) || 1);
    const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
    const skip = (parsedPage - 1) * parsedLimit;

    const filter = {};
    const normalizedSearch = normalizeString(search);

    if (
      statusFilter !== undefined &&
      statusFilter !== null &&
      normalizeString(statusFilter) !== ""
    ) {
      filter.status = parseStatus(statusFilter, { required: true });
    }

    if (
      scopeFilter !== undefined &&
      scopeFilter !== null &&
      normalizeString(scopeFilter) !== ""
    ) {
      const s = normalizeString(scopeFilter).toLowerCase();
      if (!SCOPES.includes(s)) {
        throw new Error("scope must be global or store");
      }
      filter.scope = s;
    }

    if (vendorIdFilter) {
      filter.vendor_id = vendorIdFilter;
    }

    if (storeIdFilter) {
      filter.store_ids = storeIdFilter;
    }

    if (
      roleFilter !== undefined &&
      roleFilter !== null &&
      normalizeString(roleFilter) !== ""
    ) {
      filter.created_by_role = normalizeString(roleFilter);
    }

    if (normalizedSearch) {
      const searchRegex = new RegExp(escapeRegex(normalizedSearch), "i");
      filter.$or = [
        { code: searchRegex },
        { title: searchRegex },
        { description: searchRegex },
      ];
    }

    const [items, total] = await Promise.all([
      Coupon.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parsedLimit)
        .select(selectPublicFields)
        .lean()
        .exec(),
      Coupon.countDocuments(filter),
    ]);

    return {
      items,
      pagination: {
        total,
        page: parsedPage,
        limit: parsedLimit,
        totalPages: Math.ceil(total / parsedLimit),
        hasNextPage: parsedPage < Math.ceil(total / parsedLimit),
        hasPrevPage: parsedPage > 1,
      },
    };
  },

  getCouponById: async ({ id, vendor_id }) => {
    const doc = await Coupon.findOne(buildFilter(resolveId(id), vendor_id))
      .select(selectPublicFields)
      .lean()
      .exec();

    if (!doc) throw new Error("Coupon not found");
    return doc;
  },

  updateCoupon: async ({
    id,
    vendor_id,
    code,
    title,
    description,
    discount_type,
    discount_value,
    min_order_amount,
    max_discount_amount,
    usage_limit,
    per_user_limit,
    scope,
    store_ids,
    start_date,
    end_date,
    status,
  }) => {
    const doc = await Coupon.findOne(
      buildFilter(resolveId(id), vendor_id),
    ).exec();
    if (!doc) throw new Error("Coupon not found");

    if (code !== undefined) {
      const c = normalizeString(code).toUpperCase();
      if (!c) throw new Error("code cannot be empty");
      if (c !== doc.code) {
        const existing = await Coupon.findOne({ code: c }).select("_id").lean();
        if (existing) throw new Error("Coupon code already exists");
      }
      doc.code = c;
    }

    if (title !== undefined) {
      const t = normalizeString(title);
      if (!t) throw new Error("title cannot be empty");
      doc.title = t;
    }

    if (description !== undefined) {
      doc.description = normalizeString(description);
    }

    if (discount_type !== undefined) {
      if (!DISCOUNT_TYPES.includes(discount_type)) {
        throw new Error("discount_type must be percentage or fixed");
      }
      doc.discount_type = discount_type;
    }

    if (discount_value !== undefined) {
      const dv = parseFloat(discount_value);
      if (isNaN(dv) || dv < 0) {
        throw new Error("discount_value must be a non-negative number");
      }
      doc.discount_value = dv;
    }

    if (min_order_amount !== undefined) {
      doc.min_order_amount =
        min_order_amount !== null ? parseFloat(min_order_amount) : 0;
    }

    if (max_discount_amount !== undefined) {
      doc.max_discount_amount =
        max_discount_amount !== null ? parseFloat(max_discount_amount) : null;
    }

    // validate the final combined values
    validateDiscountRules({
      discount_type: doc.discount_type,
      discount_value: doc.discount_value,
      min_order_amount: doc.min_order_amount,
      max_discount_amount: doc.max_discount_amount,
    });

    if (usage_limit !== undefined) {
      const v = usage_limit !== null ? parseInt(usage_limit, 10) : null;
      if (v !== null && (isNaN(v) || v < 1)) {
        throw new Error("usage_limit must be at least 1");
      }
      doc.usage_limit = v;
    }

    if (per_user_limit !== undefined) {
      const v = per_user_limit !== null ? parseInt(per_user_limit, 10) : 1;
      if (isNaN(v) || v < 1)
        throw new Error("per_user_limit must be at least 1");
      doc.per_user_limit = v;
    }

    // scope and store_ids are resolved together
    if (scope !== undefined && !SCOPES.includes(scope)) {
      throw new Error("scope must be global or store");
    }

    let nextStoreIds =
      store_ids !== undefined
        ? uniqueIds(store_ids)
        : doc.store_ids.map(String);

    if (scope === "global" && store_ids === undefined) nextStoreIds = [];

    const nextScope = nextStoreIds.length > 0 ? "store" : (scope ?? doc.scope);

    if (nextScope === "store" && nextStoreIds.length === 0) {
      throw new Error("store_ids are required when scope is store");
    }

    if (store_ids !== undefined && nextStoreIds.length > 0) {
      const ownerVendorId = vendor_id || doc.vendor_id;
      if (ownerVendorId) {
        await validateStoreOwnership(ownerVendorId, nextStoreIds);
      }
    }

    doc.scope = nextScope;
    doc.store_ids = nextStoreIds;

    if (start_date !== undefined) {
      const d = new Date(start_date);
      if (isNaN(d.getTime()))
        throw new Error("start_date must be a valid date");
      doc.start_date = d;
    }

    if (end_date !== undefined) {
      const d = new Date(end_date);
      if (isNaN(d.getTime())) throw new Error("end_date must be a valid date");
      doc.end_date = d;
    }

    if (doc.end_date <= doc.start_date) {
      throw new Error("end_date must be after start_date");
    }

    if (status !== undefined) {
      doc.status = parseStatus(status, { required: true });
    }

    await doc.save();
    return toCouponResponse(doc);
  },

  deleteCoupon: async ({ id, vendor_id }) => {
    const couponId = resolveId(id);
    const doc = await Coupon.findOneAndDelete(buildFilter(couponId, vendor_id));
    if (!doc) throw new Error("Coupon not found");
    removeStoredFile(doc.website_image);
    removeStoredFile(doc.mobile_image);

    return { _id: couponId };
  },

  toggleCouponStatus: async ({ id, vendor_id }) => {
    const doc = await Coupon.findOne(
      buildFilter(resolveId(id), vendor_id),
    ).exec();
    if (!doc) throw new Error("Coupon not found");
    doc.status = doc.status === 1 ? 0 : 1;
    await doc.save();
    return {
      _id: doc._id,
      code: doc.code,
      title: doc.title,
      status: doc.status,
    };
  },

  updateCouponImage: async ({ id, vendor_id, image_type, coupon_image }) => {
    if (!coupon_image) throw new Error("coupon_image file is required");

    const type = normalizeString(image_type).toLowerCase();
    if (!IMAGE_TYPES.includes(type)) {
      throw new Error("coupon_image_type must be website or mobile");
    }

    const doc = await Coupon.findOne(
      buildFilter(resolveId(id), vendor_id),
    ).exec();
    if (!doc) throw new Error("Coupon not found");

    const field = `${type}_image`;
    const oldPath = doc[field];

    doc[field] = coupon_image;
    await doc.save();

    removeStoredFile(oldPath);

    return {
      _id: doc._id,
      code: doc.code,
      coupon_image_type: type,
      website_image: doc.website_image,
      mobile_image: doc.mobile_image,
    };
  },

  verifyCoupon: async ({ code, user_id, order_amount, store_id }) => {
    const result = await validateCouponForUser({
      code,
      user_id,
      order_amount,
      store_id,
    });
    return toApplyResponse(result);
  },

  applyCoupon: async ({
    code,
    user_id,
    order_amount,
    store_id,
    order_id,
    session,
  }) => {
    const result = await validateCouponForUser({
      code,
      user_id,
      order_amount,
      store_id,
      session,
    });

    const updated = await Coupon.findOneAndUpdate(
      {
        _id: result.coupon._id,
        $or: [
          { usage_limit: null },
          { $expr: { $lt: ["$used_count", "$usage_limit"] } },
        ],
      },
      { $inc: { used_count: 1 } },
      { new: true, session },
    );
    if (!updated) throw new AppError(400, "Coupon usage limit reached");

    const [usage] = await CouponUsage.create(
      [
        {
          coupon_id: result.coupon._id,
          user_id,
          store_id: store_id || null,
          order_id: order_id || null,
          order_amount: result.order_amount,
          discount_amount: result.discount_amount,
        },
      ],
      { session },
    );

    return { ...toApplyResponse(result), usage_id: usage._id };
  },

  releaseCoupon: async ({ order_id, session }) => {
    const usage = await CouponUsage.findOneAndDelete({ order_id }, { session });
    if (!usage) return false;
    await Coupon.updateOne(
      { _id: usage.coupon_id, used_count: { $gt: 0 } },
      { $inc: { used_count: -1 } },
      { session },
    );
    return true;
  },
};

export default CouponService;
