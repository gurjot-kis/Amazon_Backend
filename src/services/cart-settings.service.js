import CartSettings from "../models/cart-settings.model.js";

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
    if (required) {
      throw createError(`${fieldName} is required`, 400);
    }
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

const selectPublicFields =
  "cart_settings_id handling_charge delivery_charge free_delivery_min_amount small_cart_charge small_cart_max_amount user_id role _id";

const mapCartSettings = (doc) => ({
  _id: doc._id,
  cart_settings_id: doc.cart_settings_id,
  handling_charge: Number(doc.handling_charge || 0),
  delivery_charge: Number(doc.delivery_charge || 0),
  free_delivery_min_amount: Number(doc.free_delivery_min_amount || 0),
  small_cart_charge: Number(doc.small_cart_charge || 0),
  small_cart_max_amount: Number(doc.small_cart_max_amount || 0),
  user_id: String(doc.user_id || ""),
  role: String(doc.role || ""),
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
});

const buildScopedFilter = ({ cart_settings_id, user_id, role }) => {
  // const id = normalizeId(cart_settings_id);
  const id = cart_settings_id;
  if (!id) {
    throw createError("cart_settings_id is required", 400);
  }
  const filter = { cart_settings_id: id };
  if (String(user_id || "").trim()) filter.user_id = String(user_id).trim();
  if (String(role || "").trim()) filter.role = String(role).trim();
  return { id, filter };
};

export const getActiveCartSettings = async () => {
  const doc = await CartSettings.findOne({})
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
  if (handling_charge > 0) {
    grandTotal += handling_charge;
  }
  if (delivery_charge > 0) {
    grandTotal += delivery_charge;
  }
  if (small_cart_charge > 0) {
    grandTotal += small_cart_charge;
  }

  const summary = {
    items_total,
    price_total,
    discount,
    grandTotal,
  };

  if (handling_charge > 0) {
    summary.handling_charge = handling_charge;
  }

  if (delivery_waived) {
    summary.delivery_waived = true;
  } else if (delivery_charge > 0) {
    summary.delivery_charge = delivery_charge;
  }

  if (small_cart_charge > 0) {
    summary.small_cart_charge = small_cart_charge;
  }

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
  }) => {
    const normalizedRole = String(role || "SuperAdmin").trim();

    // Check if cart settings already exist for this role
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
        {
          required: true,
        },
      ),
      delivery_charge: parseNonNegativeNumber(
        delivery_charge,
        "delivery_charge",
        {
          required: true,
        },
      ),
      free_delivery_min_amount: parseNonNegativeNumber(
        free_delivery_min_amount,
        "free_delivery_min_amount",
        { required: true },
      ),
      small_cart_charge: parseNonNegativeNumber(
        small_cart_charge,
        "small_cart_charge",
        {
          required: true,
        },
      ),
      small_cart_max_amount: parseNonNegativeNumber(
        small_cart_max_amount,
        "small_cart_max_amount",
        { required: true },
      ),
      user_id: String(user_id || "").trim(),
      role: normalizedRole,
    });

    return mapCartSettings(doc);
  },

  listCartSettings: async ({ page = 1, limit = 10, user_id, role } = {}) => {
    const parsedPage = Math.max(1, parseInt(page, 10) || 1);
    const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
    const skip = (parsedPage - 1) * parsedLimit;

    const filter = {};
    if (String(user_id || "").trim()) filter.user_id = String(user_id).trim();
    if (String(role || "").trim()) filter.role = String(role).trim();

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

    return {
      items: rows.map(mapCartSettings),
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
    const id = String(_id || "").trim();

    if (!id) {
      throw createError("_id is required", 400);
    }

    const filter = { _id: id };

    if (String(user_id || "").trim()) {
      filter.user_id = String(user_id).trim();
    }

    if (String(role || "").trim()) {
      filter.role = String(role).trim();
    }

    const doc = await CartSettings.findOne(filter)
      .select(selectPublicFields)
      .lean()
      .exec();

    if (!doc) {
      throw createError("Cart settings not found", 404);
    }

    return mapCartSettings(doc);
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
  }) => {
    const id = String(_id || "").trim();

    if (!id) {
      throw createError("_id is required", 400);
    }

    const filter = { _id: id };

    if (String(user_id || "").trim()) {
      filter.user_id = String(user_id).trim();
    }

    if (String(role || "").trim()) {
      filter.role = String(role).trim();
    }

    const hasAnyUpdate =
      handling_charge !== undefined ||
      delivery_charge !== undefined ||
      free_delivery_min_amount !== undefined ||
      small_cart_charge !== undefined ||
      small_cart_max_amount !== undefined;

    if (!hasAnyUpdate) {
      throw createError(
        "At least one of handling_charge, delivery_charge, free_delivery_min_amount, small_cart_charge, or small_cart_max_amount is required",
        400,
      );
    }

    const doc = await CartSettings.findOne(filter).exec();

    if (!doc) {
      throw createError("Cart settings not found", 404);
    }

    if (handling_charge !== undefined) {
      doc.handling_charge = parseNonNegativeNumber(
        handling_charge,
        "handling_charge",
        {
          required: true,
        },
      );
    }

    if (delivery_charge !== undefined) {
      doc.delivery_charge = parseNonNegativeNumber(
        delivery_charge,
        "delivery_charge",
        {
          required: true,
        },
      );
    }

    if (free_delivery_min_amount !== undefined) {
      doc.free_delivery_min_amount = parseNonNegativeNumber(
        free_delivery_min_amount,
        "free_delivery_min_amount",
        {
          required: true,
        },
      );
    }

    if (small_cart_charge !== undefined) {
      doc.small_cart_charge = parseNonNegativeNumber(
        small_cart_charge,
        "small_cart_charge",
        {
          required: true,
        },
      );
    }

    if (small_cart_max_amount !== undefined) {
      doc.small_cart_max_amount = parseNonNegativeNumber(
        small_cart_max_amount,
        "small_cart_max_amount",
        {
          required: true,
        },
      );
    }

    await doc.save();

    return mapCartSettings(doc);
  },

  deleteCartSettings: async ({ _id, user_id, role }) => {
    const id = String(_id || "").trim();

    if (!id) {
      throw createError("_id is required", 400);
    }

    const filter = { _id: id };

    if (String(user_id || "").trim()) {
      filter.user_id = String(user_id).trim();
    }

    if (String(role || "").trim()) {
      filter.role = String(role).trim();
    }

    const result = await CartSettings.deleteOne(filter);

    if (result.deletedCount === 0) {
      throw createError("Cart settings not found", 404);
    }

    return {
      _id: id,
    };
  },
};

export default CartSettingsService;
