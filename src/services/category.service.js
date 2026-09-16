import Category from "../models/category.model.js";
import { paginateAggregate } from "./pagination.service.js";

const normalizeName = (value) => String(value).trim();

export const CategoryService = {
  createCategory: async ({ name, description, category_image, parent_id }) => {
    if (!name) {
      throw new Error("Category name is required");
    }

    const normalizedName = normalizeName(name);

    let level = 1;
    if (parent_id) {
      const parent = await Category.findById(parent_id);
      if (!parent) {
        throw new Error("Parent category not found");
      }
      level = parent.level + 1;
    }

    const lastCategory = await Category.findOne({
      parent_id: parent_id || null,
    })
      .sort({ display_order: -1 })
      .select("display_order")
      .lean();
    const display_order = lastCategory ? lastCategory.display_order + 1 : 1;

    const existing = await Category.findOne({
      parent_id: parent_id || null,
      name: normalizedName,
    }).lean();
    if (existing) {
      throw new Error(
        "Category with this name already exists under the same parent",
      );
    }

    const category = await Category.create({
      name: normalizedName,
      description: description ? String(description).trim() : "",
      category_image: category_image || "",
      parent_id: parent_id || null,
      level,
      display_order,
    });
    return category;
  },

  getAllCategoriesForAdmin: async ({
    page = 1,
    limit = 10,
    search = "",
    filter_status = "",
    filter_level = "",
  } = {}) => {
    const baseMatch = {};
    if (search) baseMatch.name = { $regex: search, $options: "i" };
    if (filter_status) baseMatch.status = filter_status;
    if (filter_level !== "") baseMatch.level = Number(filter_level);

    // ─── FLAT MODE (search or level filter active) ───────────────────
    if (search || filter_level) {
      const { data, pagination } = await paginateAggregate(
        Category,
        [
          { $match: baseMatch },
          { $sort: { display_order: 1 } },
          {
            $project: {
              _id: 1,
              name: 1,
              parent_id: 1,
              category_image: 1,
              description: 1,
              level: 1,
              status: 1,
            },
          },
        ],
        { page: Number(page), limit: Number(limit) },
      );

      return { data, pagination };
    }

    // ─── TREE MODE (normal browse, filter_status only or nothing) ────
    const rootMatch = { parent_id: null };
    if (filter_status) rootMatch.status = filter_status;

    const { data: roots, pagination } = await paginateAggregate(
      Category,
      [
        { $match: rootMatch },
        { $sort: { display_order: 1 } },
        {
          $project: {
            _id: 1,
            name: 1,
            parent_id: 1,
            category_image: 1,
            description: 1,
            level: 1,
            status: 1,
          },
        },
      ],
      { page: Number(page), limit: Number(limit) },
    );

    if (!roots.length) {
      return { data: [], pagination };
    }

    const allCategories = await Category.find(
      filter_status ? { status: filter_status } : {},
    )
      .select(
        "_id name parent_id category_image description level status display_order",
      )
      .sort({ display_order: 1 })
      .lean();

    const buildTree = (parentId) => {
      return allCategories
        .filter((c) =>
          parentId === null
            ? c.parent_id === null
            : c.parent_id?.toString() === parentId.toString(),
        )
        .map((c) => ({
          _id: c._id,
          name: c.name,
          parent_id: c.parent_id,
          category_image: c.category_image,
          description: c.description,
          status: c.status,
          children: buildTree(c._id),
        }));
    };

    const tree = roots.map((c) => ({
      _id: c._id,
      name: c.name,
      parent_id: c.parent_id,
      category_image: c.category_image,
      description: c.description,
      status: c.status,
      children: buildTree(c._id),
    }));

    return { data: tree, pagination };
  },

  getCategoryById: async (id) => {
    const category = await Category.findById(id)
      .select("_id name parent_id category_image description level")
      .lean();

    if (!category) {
      throw new Error("Category not found");
    }

    return category;
  },

  updateCategory: async (
    id,
    { name, description, category_image, parent_id, is_featured, metadata },
  ) => {
    const category = await Category.findById(id).lean();
    if (!category) {
      throw new Error("Category not found");
    }

    const updateFields = {};

    if (name) {
      const normalizedName = normalizeName(name);
      const existing = await Category.findOne({
        _id: { $ne: id },
        parent_id: parent_id !== undefined ? parent_id : category.parent_id,
        name: normalizedName,
      }).lean();
      if (existing) {
        throw new Error(
          "Category with this name already exists under the same parent",
        );
      }
      updateFields.name = normalizedName;
    }

    if (description !== undefined)
      updateFields.description = String(description).trim();
    if (category_image) updateFields.category_image = category_image;
    if (is_featured !== undefined)
      updateFields.is_featured = is_featured === "true" || is_featured === true;
    if (metadata) updateFields.metadata = new Map(Object.entries(metadata));

    if (
      parent_id !== undefined &&
      parent_id !== category.parent_id?.toString()
    ) {
      if (parent_id === null || parent_id === "") {
        updateFields.parent_id = null;
        updateFields.level = 1;
      } else {
        const newParent = await Category.findById(parent_id)
          .select("level")
          .lean();
        if (!newParent) throw new Error("Parent category not found");
        updateFields.parent_id = parent_id;
        updateFields.level = newParent.level + 1;
      }
    }

    const updated = await Category.findByIdAndUpdate(
      id,
      { $set: updateFields },
      { new: true, runValidators: true },
    ).lean();

    return updated;
  },

  toggleCategoryStatus: async (id) => {
    const category = await Category.findById(id).select("status").lean();
    if (!category) throw new Error("Category not found");

    const newStatus = category.status === "active" ? "inactive" : "active";

    const updated = await Category.findByIdAndUpdate(
      id,
      { $set: { status: newStatus } },
      { new: true },
    ).lean();

    return updated;
  },

  deleteCategory: async (id) => {
    const category = await Category.findById(id).lean();
    if (!category) throw new Error("Category not found");

    const hasChildren = await Category.exists({ parent_id: id });
    if (hasChildren) {
      throw new Error(
        "Cannot delete category with subcategories. Delete subcategories first.",
      );
    }

    await Category.findByIdAndDelete(id);
  },

  getAllCategoriesForUser: async ({ page = 1, limit = 10 } = {}) => {
    const { data: roots, pagination } = await paginateAggregate(
      Category,
      [
        { $match: { parent_id: null, status: "active" } },
        { $sort: { display_order: 1 } },
        {
          $project: {
            _id: 1,
            name: 1,
            parent_id: 1,
            category_image: 1,
            description: 1,
          },
        },
      ],
      { page: Number(page), limit: Number(limit) },
    );

    if (!roots.length) {
      return { data: [], pagination };
    }

    const allActiveCategories = await Category.find({ status: "active" })
      .select("_id name parent_id category_image description display_order")
      .sort({ display_order: 1 })
      .lean();

    const buildTree = (parentId) => {
      return allActiveCategories
        .filter((c) => c.parent_id?.toString() === parentId.toString())
        .map((c) => ({
          _id: c._id,
          name: c.name,
          parent_id: c.parent_id,
          category_image: c.category_image,
          description: c.description,
          children: buildTree(c._id),
        }));
    };

    const tree = roots.map((c) => ({
      _id: c._id,
      name: c.name,
      parent_id: c.parent_id,
      category_image: c.category_image,
      description: c.description,
      children: buildTree(c._id),
    }));

    return { data: tree, pagination };
  },
};

export default CategoryService;
