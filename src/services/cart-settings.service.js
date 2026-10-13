import mongoose from "mongoose";
import CartSettings from "../models/cart-settings.model.js";

const { Types } = mongoose;

const createError = (message, statusCode = 400) =>
  Object.assign(new Error(message), { statusCode });

const normalizeId = (value) =>
  String(value || "")
    .trim()
    .replace(/^:/, "");

const parseNonNegativeNumber = (
  value,
  fieldName,
  { required = false } = {},
) => {
  if (value === undefined || value === null || value === "") {
    if (required) throw createError(`${fieldName} is required`, 400);
    return undefined;
  }
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) {
    throw createError(
      `${fieldName} must be a number greater than or equal to 0`,
      400,
    );
  }
  return n;
};

const VALID_STATUSES = ["active", "inactive"];

const parseStatus = (value) => {
  if (value === undefined || value === null || value === "") return undefined;
  const s = String(value).trim().toLowerCase();
  if (!VALID_STATUSES.includes(s)) {
    throw createError(
      `status must be one of: ${VALID_STATUSES.join(", ")}`,
      400,
    );
  }
  return s;
};

const selectPublicFields =
  "cart_settings_id handling_charge delivery_charge free_delivery_min_amount small_cart_charge small_cart_max_amount user_id role status _id createdAt updatedAt";

const mapCartSettings = (doc) => {
  const user =
    doc.user_id && typeof doc.user_id === "object" && doc.user_id._id
      ? doc.user_id
      : null;

  return {
    _id: doc._id,
    cart_settings_id: doc.cart_settings_id,
    handling_charge: Number(doc.handling_charge || 0),
    delivery_charge: Number(doc.delivery_charge || 0),
    free_delivery_min_amount: Number(doc.free_delivery_min_amount || 0),
    small_cart_charge: Number(doc.small_cart_charge || 0),
    small_cart_max_amount: Number(doc.small_cart_max_amount || 0),
    user_id: user
      ? String(user._id)
      : String(doc.user_id?._id || doc.user_id || ""),
    user_name: user?.name || "",
    user_profile: user?.profilePicture || user?.avatar || "",
    role: String(doc.role || ""),
    status: doc.status || "active",
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
};

const isValidObjectId = (id) => id && Types.ObjectId.isValid(String(id));

const populateUsers = async (rows) => {
  const validUserIds = [
    ...new Set(rows.map((r) => r.user_id).filter((id) => isValidObjectId(id))),
  ];

  const User = mongoose.model("User");

  const users = validUserIds.length
    ? await User.find({ _id: { $in: validUserIds } })
        .select("name profilePicture avatar")
        .lean()
        .exec()
    : [];

  const userMap = Object.fromEntries(users.map((u) => [String(u._id), u]));

  return rows.map((doc) => {
    const uid = String(doc.user_id || "");
    doc.user_id = userMap[uid] || null;
    return mapCartSettings(doc);
  });
};

// Always fetches the most recently updated *active* settings
export const getActiveCartSettings = async () => {
  const doc = await CartSettings.findOne({ status: "active" })
    .sort({ updatedAt: -1 })
    .select(selectPublicFields)
    .lean()
    .exec();

  if (!doc) {
    return {
      handling_charge: 0,
      delivery_charge: 0,
      free_delivery_min_amount: 0,
      small_cart_charge: 0,
      small_cart_max_amount: 0,
    };
  }

  return mapCartSettings(doc);
};

export const computeCartSummary = (items, settings) => {
  const items_total = items.reduce(
    (acc, item) => acc + Number(item.itemTotal || 0),
    0,
  );

  const price_total = items.reduce((acc, item) => {
    const unitPrice = item.product?.price ?? item.price ?? 0;
    return acc + Number(unitPrice) * Number(item.quantity || 0);
  }, 0);

  const discount = Math.max(0, price_total - items_total);
  const handling = Number(settings.handling_charge || 0);
  const deliveryBase = Number(settings.delivery_charge || 0);
  const freeDeliveryMin = Number(settings.free_delivery_min_amount || 0);
  const smallCartCharge = Number(settings.small_cart_charge || 0);
  const smallCartMax = Number(settings.small_cart_max_amount || 0);

  const delivery_waived = items_total >= freeDeliveryMin;
  const delivery_charge = delivery_waived ? 0 : deliveryBase;

  const applySmallCart =
    smallCartCharge > 0 && smallCartMax > 0 && items_total < smallCartMax;

  const small_cart_charge = applySmallCart ? smallCartCharge : 0;
  const handling_charge = handling > 0 ? handling : 0;

  let grandTotal = items_total;
  if (handling_charge > 0) grandTotal += handling_charge;
  if (delivery_charge > 0) grandTotal += delivery_charge;
  if (small_cart_charge > 0) grandTotal += small_cart_charge;

  const summary = { items_total, price_total, discount, grandTotal };

  if (handling_charge > 0) summary.handling_charge = handling_charge;

  if (delivery_waived) {
    summary.delivery_waived = true;
  } else if (delivery_charge > 0) {
    summary.delivery_charge = delivery_charge;
  }

  if (small_cart_charge > 0) summary.small_cart_charge = small_cart_charge;

  return summary;
};

export const CartSettingsService = {
  createCartSettings: async ({
    handling_charge,
    delivery_charge,
    free_delivery_min_amount,
    small_cart_charge,
    small_cart_max_amount,
    user_id,
    role,
    status,
  }) => {
    const normalizedRole = String(role || "SuperAdmin").trim();

    const existingSettings = await CartSettings.findOne({
      role: normalizedRole,
    })
      .select("_id role")
      .lean()
      .exec();

    if (existingSettings) {
      throw createError(
        `Cart settings already exist for role "${normalizedRole}"`,
        409,
      );
    }

    const doc = await CartSettings.create({
      handling_charge: parseNonNegativeNumber(
        handling_charge,
        "handling_charge",
        { required: true },
      ),
      delivery_charge: parseNonNegativeNumber(
        delivery_charge,
        "delivery_charge",
        { required: true },
      ),
      free_delivery_min_amount: parseNonNegativeNumber(
        free_delivery_min_amount,
        "free_delivery_min_amount",
        { required: true },
      ),
      small_cart_charge: parseNonNegativeNumber(
        small_cart_charge,
        "small_cart_charge",
        { required: true },
      ),
      small_cart_max_amount: parseNonNegativeNumber(
        small_cart_max_amount,
        "small_cart_max_amount",
        { required: true },
      ),
      user_id: user_id || undefined,
      role: normalizedRole,
      status: parseStatus(status) ?? "active",
    });

    return mapCartSettings(doc.toObject());
  },

  listCartSettings: async ({
    page = 1,
    limit = 10,
    user_id,
    role,
    status,
  } = {}) => {
    const parsedPage = Math.max(1, parseInt(page, 10) || 1);
    const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
    const skip = (parsedPage - 1) * parsedLimit;

    const filter = {};

    if (String(user_id || "").trim()) filter.user_id = String(user_id).trim();
    if (String(role || "").trim()) filter.role = String(role).trim();

    // Allow filtering by status; if omitted, returns all (active + inactive)
    const parsedStatus = parseStatus(status);
    if (parsedStatus) filter.status = parsedStatus;

    const [rows, total] = await Promise.all([
      CartSettings.find(filter)
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(parsedLimit)
        .select(selectPublicFields)
        .lean()
        .exec(),
      CartSettings.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / parsedLimit);
    const items = await populateUsers(rows);

    return {
      items,
      pagination: {
        total,
        page: parsedPage,
        limit: parsedLimit,
        totalPages,
        hasNextPage: parsedPage < totalPages,
        hasPrevPage: parsedPage > 1,
      },
    };
  },

  getCartSettingsById: async ({ _id, user_id, role }) => {
    const id = normalizeId(_id);
    if (!id) throw createError("_id is required", 400);
    if (!Types.ObjectId.isValid(id)) throw createError("Invalid _id", 400);

    const filter = { _id: id };
    if (String(user_id || "").trim()) filter.user_id = String(user_id).trim();
    if (String(role || "").trim()) filter.role = String(role).trim();

    const doc = await CartSettings.findOne(filter)
      .select(selectPublicFields)
      .lean()
      .exec();

    if (!doc) throw createError("Cart settings not found", 404);

    const [mapped] = await populateUsers([doc]);
    return mapped;
  },

  updateCartSettings: async ({
    _id,
    handling_charge,
    delivery_charge,
    free_delivery_min_amount,
    small_cart_charge,
    small_cart_max_amount,
    user_id,
    role,
    status,
  }) => {
    const id = normalizeId(_id);
    if (!id) throw createError("_id is required", 400);
    if (!Types.ObjectId.isValid(id)) throw createError("Invalid _id", 400);

    const filter = { _id: id };
    if (String(user_id || "").trim()) filter.user_id = String(user_id).trim();
    if (String(role || "").trim()) filter.role = String(role).trim();

    const parsedStatus = parseStatus(status);

    const hasAnyUpdate =
      handling_charge !== undefined ||
      delivery_charge !== undefined ||
      free_delivery_min_amount !== undefined ||
      small_cart_charge !== undefined ||
      small_cart_max_amount !== undefined ||
      parsedStatus !== undefined;

    if (!hasAnyUpdate) {
      throw createError("At least one cart setting field is required", 400);
    }

    const doc = await CartSettings.findOne(filter).exec();
    if (!doc) throw createError("Cart settings not found", 404);

    if (handling_charge !== undefined)
      doc.handling_charge = parseNonNegativeNumber(
        handling_charge,
        "handling_charge",
        { required: true },
      );

    if (delivery_charge !== undefined)
      doc.delivery_charge = parseNonNegativeNumber(
        delivery_charge,
        "delivery_charge",
        { required: true },
      );

    if (free_delivery_min_amount !== undefined)
      doc.free_delivery_min_amount = parseNonNegativeNumber(
        free_delivery_min_amount,
        "free_delivery_min_amount",
        { required: true },
      );

    if (small_cart_charge !== undefined)
      doc.small_cart_charge = parseNonNegativeNumber(
        small_cart_charge,
        "small_cart_charge",
        { required: true },
      );

    if (small_cart_max_amount !== undefined)
      doc.small_cart_max_amount = parseNonNegativeNumber(
        small_cart_max_amount,
        "small_cart_max_amount",
        { required: true },
      );

    if (parsedStatus !== undefined) doc.status = parsedStatus;

    await doc.save();

    const [mapped] = await populateUsers([doc.toObject()]);
    return mapped;
  },

  deleteCartSettings: async ({ _id, user_id, role }) => {
    const id = normalizeId(_id);
    if (!id) throw createError("_id is required", 400);
    if (!Types.ObjectId.isValid(id)) throw createError("Invalid _id", 400);

    const filter = { _id: id };
    if (String(user_id || "").trim()) filter.user_id = String(user_id).trim();
    if (String(role || "").trim()) filter.role = String(role).trim();

    const result = await CartSettings.deleteOne(filter);
    if (result.deletedCount === 0)
      throw createError("Cart settings not found", 404);

    return { _id: id };
  },

  toggleCartSettingsStatus: async ({ _id, user_id, role }) => {
    const id = normalizeId(_id);
    if (!id) throw createError("_id is required", 400);
    if (!Types.ObjectId.isValid(id)) throw createError("Invalid _id", 400);

    const filter = { _id: id };
    if (String(user_id || "").trim()) filter.user_id = String(user_id).trim();
    if (String(role || "").trim()) filter.role = String(role).trim();

    const doc = await CartSettings.findOne(filter).exec();
    if (!doc) throw createError("Cart settings not found", 404);

    doc.status = doc.status === "active" ? "inactive" : "active";
    await doc.save();

    const [mapped] = await populateUsers([doc.toObject()]);
    return mapped;
  },
};

export default CartSettingsService;
