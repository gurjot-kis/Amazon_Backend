import bcrypt from "bcryptjs";
import User from "../models/user.model.js";
import Cart from "../models/cart.model.js";
import Address from "../models/address.model.js";
import Wishlist from "../models/wishlist.model.js";
import Order from "../models/order.model.js";
import { mapUserStatus, parseUserStatus } from "../utils/user-status.js";

const normalizeName = (value) => String(value).trim();
const normalizeEmail = (value) => String(value).trim().toLowerCase();
const normalizeUserId = (value) =>
  String(value ?? "")
    .trim()
    .replace(/^:/, "");

const buildUserResponse = (user) => ({
  user_id: user.user_id,
  fullName: user.name,
  email: user.email,
  phone: user.phone || "",
  address: user.address || "",
  latitude:
    user.latitude != null && Number.isFinite(user.latitude)
      ? user.latitude
      : null,
  longitude:
    user.longitude != null && Number.isFinite(user.longitude)
      ? user.longitude
      : null,
  status: mapUserStatus(user.status),
});

const parseLatitude = (value) => {
  if (value === undefined || value === null || value === "") {
    throw new Error("latitude is required");
  }
  const n =
    typeof value === "number" ? value : parseFloat(String(value).trim(), 10);
  if (!Number.isFinite(n) || n < -90 || n > 90) {
    throw new Error("latitude must be a number between -90 and 90");
  }
  return n;
};

const parseLongitude = (value) => {
  if (value === undefined || value === null || value === "") {
    throw new Error("longitude is required");
  }
  const n =
    typeof value === "number" ? value : parseFloat(String(value).trim(), 10);
  if (!Number.isFinite(n) || n < -180 || n > 180) {
    throw new Error("longitude must be a number between -180 and 180");
  }
  return n;
};

export const UserService = {
  getUsers: async ({ page = 1, limit = 10, search = "", status } = {}) => {
    const parsedPage = Math.max(1, parseInt(page, 10) || 1);
    const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
    const skip = (parsedPage - 1) * parsedLimit;

    const filter = { role: "User" };

    if (search && String(search).trim()) {
      const regex = new RegExp(String(search).trim(), "i");
      filter.$or = [{ name: regex }, { email: regex }];
    }

    if (
      status !== undefined &&
      status !== null &&
      String(status).trim() !== ""
    ) {
      filter.status = parseUserStatus(status);
    }

    const [users, total] = await Promise.all([
      User.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parsedLimit)
        .select(
          "user_id name email phone address latitude longitude status -_id",
        )
        .lean()
        .exec(),
      User.countDocuments(filter),
    ]);

    const mapped = users.map((u) => ({
      user_id: u.user_id,
      fullName: u.name,
      email: u.email,
      phone: u.phone || "",
      address: u.address || "",
      latitude:
        u.latitude != null && Number.isFinite(u.latitude) ? u.latitude : null,
      longitude:
        u.longitude != null && Number.isFinite(u.longitude)
          ? u.longitude
          : null,
      status: mapUserStatus(u.status),
    }));

    return {
      users: mapped,
      pagination: {
        total,
        page: parsedPage,
        limit: parsedLimit,
        totalPages: Math.ceil(total / parsedLimit),
        hasNextPage: parsedPage < Math.ceil(total / parsedLimit),
        hasPrevPage: parsedPage > 1,
      },
    };
  },

  getUserById: async ({ user_id }) => {
    if (!user_id) {
      throw new Error("user_id is required");
    }

    const user = await User.findOne({
      user_id: String(user_id).trim(),
      role: "User",
    })
      .select("user_id name email phone address latitude longitude status -_id")
      .lean()
      .exec();

    if (!user) {
      throw new Error("User not found");
    }

    return buildUserResponse(user);
  },

  addUser: async ({ fullName, email, password, phone, address, status }) => {
    if (!fullName || !email || !password) {
      throw new Error("fullName, email, and password are required");
    }

    const normalizedEmail = normalizeEmail(email);
    const normalizedName = normalizeName(fullName);

    const existing = await User.findOne({ email: normalizedEmail }).exec();
    if (existing) {
      throw new Error("User already exists");
    }

    const passwordHash = await bcrypt.hash(String(password), 10);

    const user = await User.create({
      name: normalizedName,
      email: normalizedEmail,
      phone: phone ? String(phone).trim() : "",
      address: address ? String(address).trim() : "",
      role: "User",
      status: parseUserStatus(status),
      passwordHash,
    });

    return buildUserResponse(user);
  },

  // PUT — replace all updatable fields (password optional)
  updateUser: async ({
    user_id,
    fullName,
    email,
    password,
    phone,
    address,
    status,
  }) => {
    if (!user_id) {
      throw new Error("user_id is required");
    }

    if (!fullName || !email) {
      throw new Error("fullName and email are required");
    }

    const user = await User.findOne({
      user_id: String(user_id).trim(),
      role: "User",
    }).exec();
    if (!user) {
      throw new Error("User not found");
    }

    const normalizedEmail = normalizeEmail(email);

    const duplicate = await User.findOne({
      email: normalizedEmail,
      user_id: { $ne: String(user_id).trim() },
    }).exec();

    if (duplicate) {
      throw new Error("Email already in use");
    }

    user.name = normalizeName(fullName);
    user.email = normalizedEmail;
    if (password) {
      user.passwordHash = await bcrypt.hash(String(password), 10);
    }
    user.phone = phone ? String(phone).trim() : "";
    user.address = address ? String(address).trim() : "";
    if (status !== undefined) {
      user.status = parseUserStatus(status);
    }

    await user.save();

    return buildUserResponse(user);
  },

  // PATCH — partial update (at least one field required)
  editUser: async ({
    user_id,
    fullName,
    email,
    password,
    phone,
    address,
    status,
  }) => {
    if (!user_id) {
      throw new Error("user_id is required");
    }

    if (
      !fullName &&
      !email &&
      !password &&
      phone === undefined &&
      address === undefined &&
      status === undefined
    ) {
      throw new Error(
        "At least one of fullName, email, password, phone, address, or status is required",
      );
    }

    const user = await User.findOne({
      user_id: String(user_id).trim(),
      role: "User",
    }).exec();
    if (!user) {
      throw new Error("User not found");
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

      user.email = normalizedEmail;
    }

    if (fullName) {
      user.name = normalizeName(fullName);
    }

    if (password) {
      user.passwordHash = await bcrypt.hash(String(password), 10);
    }

    if (phone !== undefined) {
      user.phone = String(phone).trim();
    }

    if (address !== undefined) {
      user.address = String(address).trim();
    }

    if (status !== undefined) {
      user.status = parseUserStatus(status);
    }

    await user.save();

    return buildUserResponse(user);
  },

  updateUserLocation: async ({ user_id, latitude, longitude }) => {
    if (!user_id) {
      throw new Error("user_id is required");
    }

    const lat = parseLatitude(latitude);
    const lng = parseLongitude(longitude);

    const user = await User.findOne({
      user_id: String(user_id).trim(),
      role: "User",
    }).exec();
    if (!user) {
      throw new Error("User not found");
    }

    user.latitude = lat;
    user.longitude = lng;
    await user.save();

    return buildUserResponse(user);
  },

  deleteUser: async ({ user_id }) => {
    const id = normalizeUserId(user_id);
    if (!id) {
      throw new Error("user_id is required");
    }

    const user = await User.findOne({ user_id: id, role: "User" }).exec();
    if (!user) {
      throw new Error("User not found");
    }

    await Promise.all([
      User.deleteOne({ user_id: id }),
      Cart.deleteMany({ user_id: id }),
      Address.deleteMany({ user_id: id }),
      Order.deleteMany({ user_id: id }),
    ]);

    return { user_id: id };
  },

  deleteMyAccount: async (user_id) => {
    const user = await User.findOne({ _id: user_id, isDeleted: false })
      .select("_id status")
      .lean();
    if (!user) throw new Error("Account not found");
    if (user.status === 0) throw new Error("Account is already deactivated");

    await Promise.all([
      User.findByIdAndUpdate(user_id, {
        $set: {
          isDeleted: true,
          deletedAt: new Date(),
          status: 0,
          active_store_id: null,
          resetOtp: null,
          resetOtpExpiry: null,
          resetToken: null,
          resetTokenExpiry: null,
          loginTwilioOtp: null,
          loginTwilioOtpExpiry: null,
        },
      }),
      Wishlist.deleteMany({ user_id }),
      Cart.deleteMany({ user_id }),
      Address.deleteMany({ user_id }),
    ]);
  },
};

export default UserService;
