import mongoose from "mongoose";
import Product from "../models/product.model.js";
import Wishlist from "../models/wishlist.model.js";
import { paginateAggregate } from "./pagination.service.js";

export const WishlistService = {
  toggleWishlist: async (user_id, store_id, product_id) => {
    if (!mongoose.Types.ObjectId.isValid(product_id)) {
      throw new Error("Invalid product ID");
    }

    const product = await Product.findOne({
      _id: product_id,
      store_id,
      status: "active",
    })
      .select("_id")
      .lean();
    if (!product) {
      throw new Error("Product not found");
    }

    const existing = await Wishlist.findOne({
      user_id,
      store_id,
      product_id,
    }).lean();
    if (existing) {
      await Wishlist.deleteOne({ _id: existing._id });
      return { wishlisted: false };
    }

    await Wishlist.create({ user_id, store_id, product_id });
    return { wishlisted: true };
  },

  getMyWishlist: async (user_id, store_id, { page = 1, limit = 10 } = {}) => {
    const pipeline = [
      {
        $match: {
          user_id: new mongoose.Types.ObjectId(user_id),
          store_id: new mongoose.Types.ObjectId(store_id),
        },
      },
      { $sort: { createdAt: -1 } },
      {
        $lookup: {
          from: "products",
          localField: "product_id",
          foreignField: "_id",
          as: "product",
          pipeline: [
            { $match: { status: "active" } },
            {
              $project: {
                _id: 1,
                name: 1,
                mainImage: 1,
                price: 1,
                sellingPrice: 1,
                currency: 1,
                stock: 1,
                stockStatus: 1,
                hasVariants: 1,
              },
            },
          ],
        },
      },
      { $unwind: "$product" },
      {
        $project: {
          _id: 1,
          addedAt: "$createdAt",
          product: 1,
        },
      },
    ];

    return paginateAggregate(Wishlist, pipeline, {
      page: Number(page),
      limit: Number(limit),
    });
  },
};

export default WishlistService;
