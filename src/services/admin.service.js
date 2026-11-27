import bcrypt from "bcryptjs";
import User from "../models/user.model.js";
import Product from "../models/product.model.js";
import Order from "../models/order.model.js";

const normalizeEmail = (value) => String(value).trim().toLowerCase();
const normalizeName = (value) => String(value).trim();

const DEFAULT_COUNTRY_CODE = "+91";

const normalizeCountryCode = (value) => {
  const s = String(value ?? "").trim();
  if (!s) return DEFAULT_COUNTRY_CODE;
  return s.startsWith("+") ? s : `+${s}`;
};

const buildAdminResponse = (user) => ({
  user_id: user.user_id,
  fullName: user.name,
  email: user.email,
  countryCode: user.countryCode || DEFAULT_COUNTRY_CODE,
  phone: user.phone || "",
  address: user.address || "",
  profilePicture: user.profilePicture || "",
});

export const AdminService = {
  getProfile: async ({ user_id }) => {
    const admin = await User.findOne({
      user_id: String(user_id).trim(),
      role: "SuperAdmin",
    })
      .select(
        "user_id name email countryCode phone address profilePicture -_id",
      )
      .lean()
      .exec();

    if (!admin) {
      throw new Error("Admin not found");
    }

    return buildAdminResponse(admin);
  },

  updateProfile: async ({
    user_id,
    fullName,
    email,
    countryCode,
    phone,
    address,
    password,
    profilePicture,
  }) => {
    if (
      !fullName &&
      !email &&
      !phone &&
      countryCode === undefined &&
      address === undefined &&
      !password &&
      !profilePicture
    ) {
      throw new Error("At least one field is required to update");
    }

    const admin = await User.findOne({
      user_id: String(user_id).trim(),
      role: "SuperAdmin",
    }).exec();

    if (!admin) {
      throw new Error("Admin not found");
    }

    if (email) {
      const normalizedEmail = normalizeEmail(email);
      const duplicate = await User.findOne({
        email: normalizedEmail,
        user_id: { $ne: String(user_id).trim() },
      }).exec();

      if (duplicate) {
        throw new Error("Email already in use");
      }

      admin.email = normalizedEmail;
    }

    if (fullName) {
      admin.name = normalizeName(fullName);
    }

    if (phone !== undefined) {
      admin.phone = String(phone).trim();
    }

    if (address !== undefined) {
      admin.address = String(address).trim();
    }

    if (password) {
      admin.passwordHash = await bcrypt.hash(String(password), 10);
    }

    if (profilePicture) {
      admin.profilePicture = profilePicture;
    }

    if (countryCode !== undefined) {
      admin.countryCode = normalizeCountryCode(countryCode);
    }

    await admin.save();

    return buildAdminResponse(admin);
  },

  getDashboardData: async () => {
    const [totalUsers, totalProducts, totalOrders, earningResult] =
      await Promise.all([
        User.countDocuments({
          role: "User",
        }),

        Product.countDocuments(),
        Order.countDocuments(),

        Order.aggregate([
          {
            $match: {
              paymentReceived: 1,
              status: { $ne: "cancelled" },
            },
          },
          {
            $group: {
              _id: null,
              totalEarning: {
                $sum: "$grandTotal",
              },
            },
          },
        ]),
      ]);

    const totalEarning = earningResult[0]?.totalEarning || 0;

    return {
      totalUsers,
      totalProducts,
      totalOrders,
      totalEarning,
    };
  },
};

export default AdminService;
