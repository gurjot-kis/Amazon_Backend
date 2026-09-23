import { Types } from "mongoose";
import VariantOption from "../models/variantOption.model.js";
import VariantType from "../models/variantType.model.js";
import { paginateAggregate } from "./pagination.service.js";

export const VariantOptionService = {
  createVariantOptionService: async (data) => {
    const { variant_type_id, value, label, meta } = data;

    const variantType = await VariantType.findById(variant_type_id);
    if (!variantType) {
      throw { code: 404, message: "Variant type not found" };
    }

    const existing = await VariantOption.findOne({
      variant_type_id,
      value: { $regex: new RegExp(`^${value}$`, "i") },
    });

    if (existing) {
      throw {
        code: 409,
        message: `Option "${value}" already exists under this variant type`,
      };
    }

    const lastOption = await VariantOption.findOne({ variant_type_id })
      .sort({ display_order: -1 })
      .select("display_order");

    const display_order = lastOption ? lastOption.display_order + 1 : 1;

    const metaMap =
      meta && typeof meta === "object"
        ? new Map(Object.entries(meta))
        : new Map();

    const variantOption = await VariantOption.create({
      variant_type_id,
      value,
      label: label || value,
      display_order,
      meta: metaMap,
    });

    await variantOption.populate("variant_type_id", "name slug");

    const result = variantOption.toObject();
    result.meta = Object.fromEntries(variantOption.meta || new Map());

    return result;
  },

  getAllVariantOptionsService: async (query) => {
    const { page = 1, limit = 10, status, search, variant_type_id } = query;

    const filter = {};

    if (status) {
      filter.status = status;
    }

    if (variant_type_id) {
      filter.variant_type_id = new Types.ObjectId(variant_type_id);
    }

    if (search) {
      filter.$or = [
        { value: { $regex: search, $options: "i" } },
        { label: { $regex: search, $options: "i" } },
      ];
    }

    const pageNumber = Number(page);
    const limitNumber = Number(limit);

    const pipeline = [
      {
        $match: filter,
      },
      {
        $lookup: {
          from: "varianttypes",
          localField: "variant_type_id",
          foreignField: "_id",
          as: "variant_type_id",
        },
      },
      {
        $unwind: {
          path: "$variant_type_id",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          value: 1,
          label: 1,
          slug: 1,
          display_order: 1,
          status: 1,
          meta: 1,
          variant_type_id: {
            _id: "$variant_type_id._id",
            name: "$variant_type_id.name",
            slug: "$variant_type_id.slug",
          },
          createdAt: 1,
          updatedAt: 1,
        },
      },
      {
        $sort: {
          createdAt: -1,
        },
      },
    ];

    const result = await paginateAggregate(VariantOption, pipeline, {
      page: pageNumber,
      limit: limitNumber,
    });

    result.data = result.data.map((item) => ({
      ...item,
      meta:
        item.meta instanceof Map
          ? Object.fromEntries(item.meta)
          : item.meta && typeof item.meta === "object"
            ? item.meta
            : {},
    }));

    return result;
  },

  getVariantOptionByIdService: async (id) => {
    const variantOption = await VariantOption.findById(id).populate(
      "variant_type_id",
      "name slug",
    );

    if (!variantOption) {
      throw { code: 404, message: "Variant option not found" };
    }

    return variantOption;
  },

  getVariantOptionsByTypeService: async (variantTypeId, query) => {
    const { status } = query;

    const variantType = await VariantType.findById(variantTypeId);
    if (!variantType) {
      throw { code: 404, message: "Variant type not found" };
    }

    const filter = { variant_type_id: variantTypeId };

    if (status) {
      filter.status = status;
    }

    const variantOptions = await VariantOption.find(filter)
      .sort({ display_order: 1 })
      .populate("variant_type_id", "name slug");

    return { variantType, variantOptions };
  },

  updateVariantOptionService: async (id, data) => {
    const { value, label, display_order, meta } = data;

    const existing = await VariantOption.findById(id);
    if (!existing) {
      throw { code: 404, message: "Variant option not found" };
    }

    if (value) {
      const duplicate = await VariantOption.findOne({
        _id: { $ne: id },
        variant_type_id: existing.variant_type_id,
        value: { $regex: new RegExp(`^${value}$`, "i") },
      });

      if (duplicate) {
        throw {
          code: 409,
          message: `Option "${value}" already exists under this variant type`,
        };
      }
    }

    const updateFields = {};

    if (value) updateFields.value = value;
    if (label) updateFields.label = label;
    if (display_order) updateFields.display_order = display_order;

    if (meta && typeof meta === "object") {
      updateFields.meta = new Map(Object.entries(meta));
    }

    const updated = await VariantOption.findByIdAndUpdate(
      id,
      { $set: updateFields },
      { new: true, runValidators: true },
    ).populate("variant_type_id", "name slug");

    const result = updated.toObject();
    result.meta = Object.fromEntries(updated.meta || new Map());

    return result;
  },

  updateVariantOptionStatusService: async (id) => {
    const existing = await VariantOption.findById(id);

    if (!existing) {
      throw { code: 404, message: "Variant option not found" };
    }

    const newStatus = existing.status === "active" ? "inactive" : "active";

    const updated = await VariantOption.findByIdAndUpdate(
      id,
      { $set: { status: newStatus } },
      { new: true },
    ).populate("variant_type_id", "name slug");

    return updated;
  },

  deleteVariantOptionService: async (id) => {
    const existing = await VariantOption.findById(id);

    if (!existing) {
      throw { code: 404, message: "Variant option not found" };
    }

    await VariantOption.findByIdAndDelete(id);

    return true;
  },
};

export default VariantOptionService;
