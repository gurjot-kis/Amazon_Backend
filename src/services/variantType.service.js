import VariantType from "../models/variantType.model.js";
import { paginateAggregate } from "./pagination.service.js";

export const VariantTypeService = {
  createVariantTypeService: async (data) => {
    const existing = await VariantType.findOne({
      name: { $regex: new RegExp(`^${data.name}$`, "i") },
    });

    if (existing) {
      throw {
        code: 409,
        message: "Variant type with this name already exists",
      };
    }

    const lastVariantType = await VariantType.findOne()
      .sort({ display_order: -1 })
      .select("display_order");

    const nextDisplayOrder = lastVariantType
      ? lastVariantType.display_order + 1
      : 1;

    const variantType = await VariantType.create({
      ...data,
      display_order: nextDisplayOrder,
    });

    return variantType;
  },

  getAllVariantTypesService: async (query) => {
    const {
      page = 1,
      limit = 10,
      status,
      search,
      sortBy = "display_order",
      sortOrder = "asc",
    } = query;

    const filter = {};

    if (status) {
      filter.status = status;
    }

    if (search) {
      filter.name = { $regex: search, $options: "i" };
    }

    const pageNumber = Number(page);
    const limitNumber = Number(limit);

    const sort = {
      [sortBy]: sortOrder === "asc" ? 1 : -1,
    };

    const pipeline = [{ $match: filter }, { $sort: sort }];

    return await paginateAggregate(VariantType, pipeline, {
      page: pageNumber,
      limit: limitNumber,
    });
  },

  getVariantTypeByIdService: async (id) => {
    const variantType = await VariantType.findById(id);

    if (!variantType) {
      throw { code: 404, message: "Variant type not found" };
    }

    return variantType;
  },

  updateVariantTypeService: async (id, data) => {
    const existing = await VariantType.findById(id);

    if (!existing) {
      throw { code: 404, message: "Variant type not found" };
    }

    if (data.name) {
      const duplicate = await VariantType.findOne({
        _id: { $ne: id },
        name: { $regex: new RegExp(`^${data.name}$`, "i") },
      });

      if (duplicate) {
        throw {
          code: 409,
          message: "Variant type with this name already exists",
        };
      }
    }

    if (data.name) {
      data.slug = data.name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-");
    }

    const updated = await VariantType.findByIdAndUpdate(
      id,
      { $set: data },
      { new: true, runValidators: true },
    );

    return updated;
  },

  updateVariantTypeStatusService: async (id) => {
    const existing = await VariantType.findById(id);

    if (!existing) {
      throw {
        code: 404,
        message: "Variant type not found",
      };
    }

    const newStatus = existing.status === "active" ? "inactive" : "active";

    const updated = await VariantType.findByIdAndUpdate(
      id,
      { $set: { status: newStatus } },
      { new: true },
    );

    return updated;
  },

  deleteVariantTypeService: async (id) => {
    const existing = await VariantType.findById(id);

    if (!existing) {
      throw { code: 404, message: "Variant type not found" };
    }

    await VariantType.findByIdAndDelete(id);

    return true;
  },
};

export default VariantTypeService;
