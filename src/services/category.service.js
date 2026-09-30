import mongoose from "mongoose";
import Category from "../models/category.model.js";
import { paginateAggregate } from "./pagination.service.js";

const normalizeName = (value) => String(value).trim();

export const CategoryService = {
  createCategory: async ({
    name,
    category_type = "standard_commerce",
    description,
    category_image,
    parent_id,
  }) => {
    if (!name) {
      throw new Error("Category name is required");
    }

    const normalizedName = normalizeName(name);

    let level = 1;
    let resolvedType = category_type;

    if (parent_id) {
      const parent = await Category.findById(parent_id);
      if (!parent) {
        throw new Error("Parent category not found");
      }
      level = parent.level + 1;
      resolvedType = category_type || parent.category_type;
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
      category_type: resolvedType,
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
    filter_type = "",
  } = {}) => {
    const baseMatch = {};
    if (search) baseMatch.name = { $regex: search, $options: "i" };
    if (filter_status) baseMatch.status = filter_status;
    if (filter_type) baseMatch.category_type = filter_type;
    if (filter_level !== "") baseMatch.level = Number(filter_level);

    const maxLevelDoc = await Category.findOne()
      .sort({ level: -1 })
      .select("level")
      .lean();
    const maxLevel = maxLevelDoc?.level ?? 1;

    // ─── FLAT MODE: Activate when search, level filter, OR type filter is set ───
    if (search || filter_level || filter_type) {
      const { data, pagination } = await paginateAggregate(
        Category,
        [
          { $match: baseMatch },
          { $sort: { display_order: 1 } },
          {
            $project: {
              _id: 1,
              name: 1,
              category_type: 1,
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

      return { data, pagination, maxLevel };
    }

    // ─── TREE MODE (normal browse without filters) ───────────────────
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
            category_type: 1,
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
      return { data: [], pagination, maxLevel };
    }

    const allCategories = await Category.find(
      filter_status ? { status: filter_status } : {},
    )
      .select(
        "_id name category_type parent_id category_image description level status display_order",
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
          category_type: c.category_type,
          parent_id: c.parent_id,
          category_image: c.category_image,
          description: c.description,
          level: c.level,
          status: c.status,
          children: buildTree(c._id),
        }));
    };

    const tree = roots.map((c) => ({
      _id: c._id,
      name: c.name,
      category_type: c.category_type,
      parent_id: c.parent_id,
      category_image: c.category_image,
      description: c.description,
      level: c.level,
      status: c.status,
      children: buildTree(c._id),
    }));

    return { data: tree, pagination, maxLevel };
  },

  getCategoryById: async (id) => {
    const category = await Category.findById(id)
      .select(
        "_id name category_type parent_id category_image description level",
      )
      .lean();

    if (!category) {
      throw new Error("Category not found");
    }

    return category;
  },

  updateCategory: async (
    id,
    {
      name,
      category_type,
      description,
      category_image,
      parent_id,
      is_featured,
      metadata,
    },
  ) => {
    const category = await Category.findById(id).lean();

    if (!category) {
      throw new Error("Category not found");
    }

    const updateFields = {};

    if (category_type !== undefined) {
      updateFields.category_type = category_type;
    }

    const newParentId =
      parent_id !== undefined
        ? parent_id === ""
          ? null
          : parent_id
        : category.parent_id;

    if (
      newParentId !== null &&
      newParentId !== undefined &&
      !mongoose.Types.ObjectId.isValid(newParentId)
    ) {
      throw new Error("Invalid parent category ID");
    }

    // Name
    if (name !== undefined) {
      const normalizedName = normalizeName(name);

      const existing = await Category.findOne({
        _id: { $ne: id },
        parent_id: newParentId || null,
        name: normalizedName,
      }).lean();

      if (existing) {
        throw new Error(
          "Category with this name already exists under the same parent",
        );
      }

      updateFields.name = normalizedName;
    }

    // Description
    if (description !== undefined) {
      updateFields.description = String(description).trim();
    }

    // Image
    if (category_image) {
      updateFields.category_image = category_image;
    }

    // Featured
    if (is_featured !== undefined) {
      updateFields.is_featured = is_featured === "true" || is_featured === true;
    }

    // Metadata
    if (metadata) {
      updateFields.metadata = new Map(Object.entries(metadata));
    }

    // Parent category change
    if (parent_id !== undefined) {
      const currentParentId = category.parent_id
        ? category.parent_id.toString()
        : null;

      const normalizedNewParentId = newParentId ? newParentId.toString() : null;

      if (normalizedNewParentId !== currentParentId) {
        // Move to top-level
        if (!normalizedNewParentId) {
          updateFields.parent_id = null;
          updateFields.level = 1;
        } else {
          // Prevent self-parent
          if (normalizedNewParentId === id.toString()) {
            throw new Error("A category cannot be its own parent");
          }

          const newParent = await Category.findById(normalizedNewParentId)
            .select("_id level")
            .lean();

          if (!newParent) {
            throw new Error("Parent category not found");
          }

          updateFields.parent_id = newParent._id;
          updateFields.level = newParent.level + 1;
        }
      }
    }

    const updated = await Category.findByIdAndUpdate(
      id,
      { $set: updateFields },
      {
        new: true,
        runValidators: true,
      },
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

  getLeafCategories: async ({ search = "" } = {}) => {
    const filter = {
      status: "active",
    };

    if (search?.trim()) {
      filter.name = {
        $regex: search.trim(),
        $options: "i",
      };
    }

    const allCategories = await Category.find(filter)
      .select("_id name parent_id")
      .sort({ name: 1 })
      .lean();

    const parentIds = new Set(
      allCategories
        .filter((c) => c.parent_id)
        .map((c) => c.parent_id.toString()),
    );

    const leafCategories = allCategories.filter(
      (c) => !parentIds.has(c._id.toString()),
    );

    leafCategories.sort((a, b) =>
      a.name.localeCompare(b.name, undefined, {
        sensitivity: "base",
      }),
    );

    return leafCategories;
  },

  getAllCategoriesSelectList: async () => {
    const allCategories = await Category.find({ status: "active" })
      .select("_id name parent_id level category_type")
      .lean();

    const flatten = (parentId = null, depth = 0) => {
      return allCategories
        .filter((c) =>
          parentId === null
            ? c.parent_id === null
            : c.parent_id?.toString() === parentId.toString(),
        )
        .flatMap((c) => [
          {
            _id: c._id,
            name: c.name,
            level: c.level,
            depth,
            category_type: c.category_type,
            parent_id: c.parent_id,
          },
          ...flatten(c._id, depth + 1),
        ]);
    };

    return flatten();
  },

  getActiveQuickCommerceCategories: async () => {
    const categories = await Category.find({
      category_type: "quick_commerce",
      status: "active",
    })
      .select(
        "_id name category_type parent_id category_image description level display_order",
      )
      .sort({ display_order: 1 })
      .lean();

    // Nested tree builder (Top-level roots with subcategories attached)
    const buildTree = (parentId = null) => {
      return categories
        .filter((c) =>
          parentId === null
            ? c.parent_id === null
            : c.parent_id?.toString() === parentId.toString(),
        )
        .map((c) => ({
          _id: c._id,
          name: c.name,
          category_type: c.category_type,
          parent_id: c.parent_id,
          category_image: c.category_image,
          description: c.description,
          level: c.level,
          display_order: c.display_order,
          children: buildTree(c._id),
        }));
    };

    return {
      tree: buildTree(null),
      flat: categories, // returned so consumers can pick either flat or tree structure
    };
  },
};

export default CategoryService;
