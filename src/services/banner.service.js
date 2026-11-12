import mongoose from "mongoose";
import Banner from "../models/banner.model.js";
import Store from "../models/store.model.js";
import {
  BANNER_DEVICE_TYPE,
  BANNER_DEVICE_TYPE_VALUES,
  BANNER_POSITION,
  BANNER_POSITION_VALUES,
  BANNER_REDIRECT_TYPE,
  BANNER_REDIRECT_TYPE_VALUES,
  BANNER_UPLOAD_AREA,
  BANNER_UPLOAD_AREA_VALUES,
  STATUS,
  STATUS_VALUES,
} from "../constants/index.js";

const normalizeString = (value) =>
  value === undefined || value === null ? "" : String(value).trim();

const normalizeBannerId = (value) => {
  console.log(value);
  const id = normalizeString(value).replace(/^:/, "");

  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    throw new Error("banner_id is invalid");
  }

  return new mongoose.Types.ObjectId(id);
};

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const parseEnum = (value, values, field, defaultValue) => {
  if (value === undefined || value === null || value === "") {
    return defaultValue;
  }

  const normalized = normalizeString(value).toLowerCase();

  if (!values.includes(normalized)) {
    throw new Error(`${field} must be one of: ${values.join(", ")}`);
  }

  return normalized;
};

const parseStatus = (value, defaultValue = STATUS.ACTIVE) => {
  if (value === undefined || value === null || value === "") {
    return defaultValue;
  }

  const normalized = Number(value);

  if (!STATUS_VALUES.includes(normalized)) {
    throw new Error("status must be 0 or 1");
  }

  return normalized;
};

const normalizeObjectId = (value, field) => {
  const id = normalizeString(value);

  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    throw new Error(`${field} is invalid`);
  }

  return new mongoose.Types.ObjectId(id);
};

const parseDate = (value, field) => {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`${field} must be a valid date`);
  }

  return date;
};

const validateBannerDates = (startDate, endDate) => {
  if (startDate && endDate && startDate >= endDate) {
    throw new Error("end_date must be greater than start_date");
  }
};

const validateRedirect = (redirectType, redirectUrl) => {
  if (
    redirectType !== BANNER_REDIRECT_TYPE.NONE &&
    !normalizeString(redirectUrl)
  ) {
    throw new Error("redirect_url is required for this redirect_type");
  }
};

const validateVendorStore = async (vendorId, storeId) => {
  const store = await Store.findOne({
    _id: storeId,
    vendor_id: vendorId,
  })
    .select("_id")
    .lean()
    .exec();

  if (!store) {
    throw new Error("Store not found or does not belong to this vendor");
  }
};

const selectBannerFields =
  "_id vendor_id store_id title description banner_image redirect_url redirect_type upload_area position device_type sort_order start_date end_date status createdAt updatedAt";

const buildPagination = (total, page, limit) => ({
  total,
  page,
  limit,
  totalPages: Math.ceil(total / limit),
  hasNextPage: page < Math.ceil(total / limit),
  hasPrevPage: page > 1,
});

const getPagination = (page, limit) => {
  const parsedPage = Math.max(1, parseInt(page, 10) || 1);
  const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));

  return {
    page: parsedPage,
    limit: parsedLimit,
    skip: (parsedPage - 1) * parsedLimit,
  };
};

const buildSearchFilter = (search) => {
  const normalizedSearch = normalizeString(search);

  if (!normalizedSearch) return {};

  const regex = new RegExp(escapeRegex(normalizedSearch), "i");

  return {
    $or: [
      { title: regex },
      { description: regex },
      { banner_image: regex },
      { redirect_url: regex },
    ],
  };
};

const buildScheduleFilter = (date = new Date()) => ({
  $and: [
    {
      $or: [{ start_date: null }, { start_date: { $lte: date } }],
    },
    {
      $or: [{ end_date: null }, { end_date: { $gte: date } }],
    },
  ],
});

export const BannerService = {
  createBanner: async ({
    vendor_id,
    store_id,
    title,
    description,
    banner_image,
    redirect_url,
    redirect_type,
    upload_area,
    position,
    device_type,
    sort_order,
    start_date,
    end_date,
    status,
  }) => {
    const vendorId = normalizeObjectId(vendor_id, "vendor_id");
    const storeId = normalizeObjectId(store_id, "store_id");

    await validateVendorStore(vendorId, storeId);

    const normalizedTitle = normalizeString(title);

    if (!normalizedTitle) {
      throw new Error("title is required");
    }

    const normalizedRedirectType = parseEnum(
      redirect_type,
      BANNER_REDIRECT_TYPE_VALUES,
      "redirect_type",
      BANNER_REDIRECT_TYPE.NONE,
    );

    const normalizedRedirectUrl = normalizeString(redirect_url);

    validateRedirect(normalizedRedirectType, normalizedRedirectUrl);

    const normalizedStartDate = parseDate(start_date, "start_date");
    const normalizedEndDate = parseDate(end_date, "end_date");

    validateBannerDates(normalizedStartDate, normalizedEndDate);

    const doc = await Banner.create({
      vendor_id: vendorId,
      store_id: storeId,
      title: normalizedTitle,
      description: normalizeString(description),
      banner_image: normalizeString(banner_image),
      redirect_url: normalizedRedirectUrl,
      redirect_type: normalizedRedirectType,
      upload_area: parseEnum(
        upload_area,
        BANNER_UPLOAD_AREA_VALUES,
        "upload_area",
        BANNER_UPLOAD_AREA.APP,
      ),
      position: parseEnum(
        position,
        BANNER_POSITION_VALUES,
        "position",
        BANNER_POSITION.HOME_TOP,
      ),
      device_type: parseEnum(
        device_type,
        BANNER_DEVICE_TYPE_VALUES,
        "device_type",
        BANNER_DEVICE_TYPE.MOBILE,
      ),
      sort_order: Math.max(0, Number(sort_order) || 0),
      start_date: normalizedStartDate ?? null,
      end_date: normalizedEndDate ?? null,
      status: parseStatus(status),
    });

    return doc.toObject();
  },

  listBanners: async ({
    vendor_id,
    store_id,
    page = 1,
    limit = 10,
    search = "",
    status,
    upload_area,
    position,
  } = {}) => {
    const vendorId = normalizeObjectId(vendor_id, "vendor_id");

    const {
      page: parsedPage,
      limit: parsedLimit,
      skip,
    } = getPagination(page, limit);

    const filter = { vendor_id: vendorId };

    if (store_id) {
      filter.store_id = normalizeObjectId(store_id, "store_id");
    }

    if (status !== undefined && normalizeString(status) !== "") {
      filter.status = parseStatus(status);
    }

    if (upload_area) {
      filter.upload_area = parseEnum(
        upload_area,
        BANNER_UPLOAD_AREA_VALUES,
        "upload_area",
      );
    }

    if (position) {
      filter.position = parseEnum(position, BANNER_POSITION_VALUES, "position");
    }

    Object.assign(filter, buildSearchFilter(search));

    const [rawItems, total] = await Promise.all([
      Banner.find(filter)
        .sort({ sort_order: 1, createdAt: -1 })
        .skip(skip)
        .limit(parsedLimit)
        .select(selectBannerFields)
        .populate({
          path: "store_id",
          select: "store_name store_logo",
        })
        .lean()
        .exec(),

      Banner.countDocuments(filter),
    ]);

    const items = rawItems.map(({ store_id, ...banner }) => ({
      ...banner,
      store_id: store_id?._id ?? null,
      store: store_id
        ? { store_name: store_id.store_name, store_logo: store_id.store_logo }
        : null,
    }));

    return {
      items,
      pagination: buildPagination(total, parsedPage, parsedLimit),
    };
  },

  listBannerImg: async ({
    store_id,
    page = 1,
    limit = 10,
    search = "",
    upload_area = BANNER_UPLOAD_AREA.APP,
    position,
    device_type,
  } = {}) => {
    const storeId = normalizeObjectId(store_id, "store_id");

    const {
      page: parsedPage,
      limit: parsedLimit,
      skip,
    } = getPagination(page, limit);

    const filter = {
      store_id: storeId,
      status: STATUS.ACTIVE,
      upload_area: parseEnum(
        upload_area,
        BANNER_UPLOAD_AREA_VALUES,
        "upload_area",
      ),
      ...buildScheduleFilter(),
    };

    if (position) {
      filter.position = parseEnum(position, BANNER_POSITION_VALUES, "position");
    }

    if (device_type) {
      const normalizedDevice = parseEnum(
        device_type,
        BANNER_DEVICE_TYPE_VALUES,
        "device_type",
      );

      filter.device_type = {
        $in: [normalizedDevice, BANNER_DEVICE_TYPE.ALL],
      };
    }

    Object.assign(filter, buildSearchFilter(search));

    const [items, total] = await Promise.all([
      Banner.find(filter)
        .sort({ sort_order: 1, createdAt: -1 })
        .skip(skip)
        .limit(parsedLimit)
        .select(selectBannerFields)
        .lean()
        .exec(),

      Banner.countDocuments(filter),
    ]);

    return {
      items,
      pagination: buildPagination(total, parsedPage, parsedLimit),
    };
  },

  getBannerById: async ({ banner_id, vendor_id }) => {
    const id = normalizeBannerId(banner_id);
    const vendorId = normalizeObjectId(vendor_id, "vendor_id");

    if (!id) throw new Error("banner_id is required");

    const doc = await Banner.findOne({
      _id: id,
      vendor_id: vendorId,
    })
      .select(selectBannerFields)
      .lean()
      .exec();

    if (!doc) throw new Error("Banner not found");

    return doc;
  },

  updateBanner: async ({
    banner_id,
    vendor_id,
    store_id,
    title,
    description,
    banner_image,
    redirect_url,
    redirect_type,
    upload_area,
    position,
    device_type,
    sort_order,
    start_date,
    end_date,
    status,
  }) => {
    const id = normalizeBannerId(banner_id);
    const vendorId = normalizeObjectId(vendor_id, "vendor_id");

    if (!id) throw new Error("banner_id is required");

    const doc = await Banner.findOne({
      _id: id,
      vendor_id: vendorId,
    }).exec();

    if (!doc) throw new Error("Banner not found");

    if (store_id !== undefined) {
      const storeId = normalizeObjectId(store_id, "store_id");
      await validateVendorStore(vendorId, storeId);
      doc.store_id = storeId;
    }

    if (title !== undefined) {
      const value = normalizeString(title);
      if (!value) throw new Error("title cannot be empty");
      doc.title = value;
    }

    if (description !== undefined) {
      doc.description = normalizeString(description);
    }

    if (banner_image !== undefined) {
      doc.banner_image = normalizeString(banner_image);
    }

    if (redirect_url !== undefined) {
      doc.redirect_url = normalizeString(redirect_url);
    }

    if (redirect_type !== undefined) {
      doc.redirect_type = parseEnum(
        redirect_type,
        BANNER_REDIRECT_TYPE_VALUES,
        "redirect_type",
      );
    }

    if (upload_area !== undefined) {
      doc.upload_area = parseEnum(
        upload_area,
        BANNER_UPLOAD_AREA_VALUES,
        "upload_area",
      );
    }

    if (position !== undefined) {
      doc.position = parseEnum(position, BANNER_POSITION_VALUES, "position");
    }

    if (device_type !== undefined) {
      doc.device_type = parseEnum(
        device_type,
        BANNER_DEVICE_TYPE_VALUES,
        "device_type",
      );
    }

    if (sort_order !== undefined) {
      const value = Number(sort_order);

      if (!Number.isFinite(value) || value < 0) {
        throw new Error("sort_order must be a non-negative number");
      }

      doc.sort_order = value;
    }

    if (start_date !== undefined) {
      doc.start_date = parseDate(start_date, "start_date");
    }

    if (end_date !== undefined) {
      doc.end_date = parseDate(end_date, "end_date");
    }

    validateBannerDates(doc.start_date, doc.end_date);

    if (status !== undefined) {
      doc.status = parseStatus(status);
    }

    validateRedirect(doc.redirect_type, doc.redirect_url);

    await doc.save();

    return doc.toObject();
  },

  toggleBannerStatus: async ({ banner_id, vendor_id }) => {
    const id = normalizeBannerId(banner_id);
    const vendorId = normalizeObjectId(vendor_id, "vendor_id");

    const doc = await Banner.findOne({
      _id: id,
      vendor_id: vendorId,
    })
      .select("_id status")
      .lean()
      .exec();

    if (!doc) {
      throw new Error("Banner not found");
    }

    const nextStatus = Number(doc.status) === 1 ? 0 : 1;

    const updatedDoc = await Banner.findOneAndUpdate(
      {
        _id: id,
        vendor_id: vendorId,
        status: doc.status,
      },
      {
        $set: { status: nextStatus },
      },
      {
        new: true,
        runValidators: true,
      },
    )
      .select(selectBannerFields)
      .lean()
      .exec();

    if (!updatedDoc) {
      throw new Error("Banner status was modified concurrently. Please retry.");
    }

    return updatedDoc;
  },

  deleteBanner: async ({ banner_id, vendor_id }) => {
    const id = normalizeBannerId(banner_id);
    const vendorId = normalizeObjectId(vendor_id, "vendor_id");

    if (!id) throw new Error("banner_id is required");

    const result = await Banner.deleteOne({
      _id: id,
      vendor_id: vendorId,
    });

    if (result.deletedCount === 0) {
      throw new Error("Banner not found");
    }

    return { banner_id: id };
  },
};

export default BannerService;
