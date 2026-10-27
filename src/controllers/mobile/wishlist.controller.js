import { sendSuccess } from "../../helpers/response.helper.js";
import WishlistService from "../../services/wishlist.service.js";

export const WishListController = {
  toggleWishlist: async (req, res, next) => {
    try {
      const user_id = req.user._id;
      const store_id = req.activeStoreId;
      const { productId } = req.params;

      const result = await WishlistService.toggleWishlist(
        user_id,
        store_id,
        productId,
      );

      return sendSuccess(res, {
        message: result.wishlisted
          ? "Product added to wishlist"
          : "Product removed from wishlist",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  },

  getMyWishlist: async (req, res, next) => {
    try {
      const user_id = req.user._id;
      const store_id = req.activeStoreId;

      const { page, limit } = req.query;

      const { data, pagination } = await WishlistService.getMyWishlist(
        user_id,
        store_id,
        { page, limit },
      );

      return sendSuccess(res, {
        message: "Wishlist fetched successfully",
        data,
        pagination,
      });
    } catch (error) {
      next(error);
    }
  },
};

export default WishListController;
