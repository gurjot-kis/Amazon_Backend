import mongoose from "mongoose";

const WishlistSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    product_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Products",
      required: true,
    },
    store_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Store",
      required: true,
    },
  },
  { timestamps: true, versionKey: false },
);

WishlistSchema.index(
  { user_id: 1, store_id: 1, product_id: 1 },
  { unique: true },
);
WishlistSchema.index({ user_id: 1, store_id: 1, createdAt: -1 });

const Wishlist = mongoose.model("Wishlist", WishlistSchema);
export default Wishlist;
