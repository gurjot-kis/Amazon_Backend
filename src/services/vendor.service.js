import bcrypt from "bcrypt";
import User from "../models/user.model.js";
import { mapUserStatus, parseUserStatus } from "../utils/user-status.js";
import validateObjectId from "../utils/validate-object-id.js";
import { toObjectId } from "../utils/object-id.js";
import sendEmail from "../utils/email.js";

const DEFAULT_COUNTRY_CODE = "+91";

const normalizeName = (value) => String(value).trim();
const normalizeEmail = (value) => String(value).trim().toLowerCase();

const normalizeCountryCode = (value) => {
  const s = String(value ?? "").trim();
  if (!s) return DEFAULT_COUNTRY_CODE;
  return s.startsWith("+") ? s : `+${s}`;
};

const escapeHtml = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[c],
  );

const getSuperAdminEmails = async () => {
  const admins = await User.find({ role: "SuperAdmin" })
    .select("email")
    .lean()
    .exec();
  const emails = admins.map((a) => a.email).filter(Boolean);
  if (process.env.SUPERADMIN_EMAIL) emails.push(process.env.SUPERADMIN_EMAIL);
  return [...new Set(emails)];
};

const sendVendorRegisteredEmail = async ({ vendor, plainPassword }) => {
  try {
    const bcc = await getSuperAdminEmails();
    const name = escapeHtml(vendor.name);
    const email = escapeHtml(vendor.email);
    const phone = vendor.phone
      ? `${escapeHtml(vendor.countryCode || DEFAULT_COUNTRY_CODE)} ${escapeHtml(vendor.phone)}`
      : "-";

    await sendEmail({
      to: vendor.email,
      bcc,
      subject: "Vendor account created",
      text:
        `Hello ${vendor.name},\n\n` +
        `Your vendor account has been created by the administrator.\n\n` +
        `Email: ${vendor.email}\nPassword: ${plainPassword}\n\n` +
        `Please log in and change your password.`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:560px">
          <h2>Welcome, ${name}</h2>
          <p>Your vendor account has been created by the administrator.</p>
          <table cellpadding="6">
            <tr><td><b>Email</b></td><td>${email}</td></tr>
            <tr><td><b>Phone</b></td><td>${phone}</td></tr>
            <tr><td><b>Password</b></td><td>${escapeHtml(plainPassword)}</td></tr>
          </table>
          <p>Please log in and change your password immediately.</p>
        </div>`,
    });
  } catch (err) {
    console.error("Vendor registration email failed:", err.message);
  }
};

const buildVendorResponse = (v) => ({
  _id: v._id,
  fullName: v.name,
  email: v.email,
  countryCode: v.countryCode || DEFAULT_COUNTRY_CODE,
  phone: v.phone || "",
  address: v.address || "",
  profilePicture: v.profilePicture || "",
  status: mapUserStatus(v.status),
  isVendorVerified: !!v.isVendorVerified,
  createdAt: v.createdAt,
});

const buildVendorProfileResponse = (vendor) => ({
  _id: vendor._id,
  fullName: vendor.name,
  email: vendor.email,
  countryCode: vendor.countryCode || DEFAULT_COUNTRY_CODE,
  phone: vendor.phone || "",
  address: vendor.address || "",
  profilePicture: vendor.profilePicture || "",
});

export const VendorService = {
  getVendors: async ({
    page = 1,
    limit = 10,
    search = "",
    status,
    category,
    isVendorVerified,
    sortBy = "createdAt",
    sortOrder = "desc",
  } = {}) => {
    const parsedPage = Math.max(1, parseInt(page, 10) || 1);
    const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
    const skip = (parsedPage - 1) * parsedLimit;

    const filter = { role: "Vendor" };

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

    if (category) {
      filter.vendorCategories = category;
    }

    if (
      isVendorVerified !== undefined &&
      String(isVendorVerified).trim() !== ""
    ) {
      filter.isVendorVerified = String(isVendorVerified) === "true";
    }

    const allowedSortFields = ["createdAt", "name", "email", "status"];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : "createdAt";
    const sortDir = sortOrder === "asc" ? 1 : -1;

    const [vendors, total] = await Promise.all([
      User.aggregate([
        {
          $match: filter,
        },

        {
          $sort: {
            [sortField]: sortDir,
          },
        },

        {
          $skip: skip,
        },

        {
          $limit: parsedLimit,
        },

        {
          $project: {
            passwordHash: 0,
            resetOtp: 0,
            resetOtpExpiry: 0,
            resetToken: 0,
            resetTokenExpiry: 0,
            loginTwilioOtp: 0,
            loginTwilioOtpExpiry: 0,
          },
        },
      ]),

      User.countDocuments(filter),
    ]);

    return {
      vendors: vendors.map(buildVendorResponse),
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

  getVendorById: async ({ user_id }) => {
    toObjectId(user_id);

    const vendor = await User.findOne({
      _id: user_id,
      role: "Vendor",
    })
      .select("user_id name email countryCode phone address createdAt")
      .lean()
      .exec();

    if (!vendor) throw new Error("Vendor not found");

    return {
      _id: vendor._id,
      fullName: vendor.name,
      email: vendor.email,
      countryCode: vendor.countryCode || DEFAULT_COUNTRY_CODE,
      phone: vendor.phone,
      address: vendor.address,
      createdAt: vendor.createdAt,
    };
  },

  addVendor: async ({
    fullName,
    email,
    password,
    countryCode,
    phone,
    address,
  }) => {
    if (!fullName || !email || !password) {
      throw new Error("fullName, email, and password are required");
    }

    const normalizedEmail = normalizeEmail(email);
    const existing = await User.findOne({ email: normalizedEmail }).exec();
    if (existing) throw new Error("User already exists with this email");

    const passwordHash = await bcrypt.hash(String(password), 10);

    const vendor = await User.create({
      name: normalizeName(fullName),
      email: normalizedEmail,
      countryCode: normalizeCountryCode(countryCode),
      phone: phone ? String(phone).trim() : "",
      address: address ? String(address).trim() : "",
      role: "Vendor",
      passwordHash,
      isVendorVerified: false,
    });

    sendVendorRegisteredEmail({ vendor, plainPassword: String(password) });

    return buildVendorResponse(vendor);
  },

  updateVendor: async ({
    user_id,
    fullName,
    email,
    password,
    countryCode,
    phone,
    address,
  }) => {
    validateObjectId(user_id);
    if (!fullName || !email) throw new Error("fullName and email are required");

    const vendor = await User.findOne({
      _id: user_id,
      role: "Vendor",
    }).exec();

    if (!vendor) throw new Error("Vendor not found");

    const normalizedEmail = normalizeEmail(email);
    const duplicate = await User.findOne({
      email: normalizedEmail,
      _id: { $ne: vendor._id },
    }).exec();
    if (duplicate) throw new Error("Email already in use");

    vendor.name = normalizeName(fullName);
    vendor.email = normalizedEmail;

    if (password) vendor.passwordHash = await bcrypt.hash(String(password), 10);
    if (countryCode !== undefined)
      vendor.countryCode = normalizeCountryCode(countryCode);

    if (phone !== undefined) vendor.phone = String(phone).trim();
    if (address !== undefined) vendor.address = String(address).trim();

    await vendor.save();
    return buildVendorResponse(vendor);
  },

  updateVendorStatus: async ({ user_id, status }) => {
    toObjectId(user_id);

    const vendor = await User.findOne({
      _id: user_id,
      role: "Vendor",
    }).exec();

    if (!vendor) throw new Error("Vendor not found");

    vendor.status = Number(vendor.status) === 0 ? 1 : 0;

    await vendor.save();
    return buildVendorResponse(vendor);
  },

  updateVendorVerification: async ({ user_id }) => {
    toObjectId(user_id);

    const vendor = await User.findOne({
      _id: user_id,
      role: "Vendor",
    }).exec();

    if (!vendor) throw new Error("Vendor not found");

    vendor.isVendorVerified = !vendor.isVendorVerified;

    await vendor.save();
    return buildVendorResponse(vendor);
  },

  deleteVendor: async ({ user_id }) => {
    toObjectId(user_id);

    const vendor = await User.findOne({
      _id: user_id,
      role: "Vendor",
    }).exec();

    if (!vendor) throw new Error("Vendor not found");

    await User.deleteOne({ _id: user_id });
    return { _id: user_id };
  },

  getProfile: async ({ user_id }) => {
    const vendor = await User.findOne({
      _id: String(user_id).trim(),
      role: "Vendor",
    })
      .select("_id name email countryCode phone address profilePicture")
      .lean()
      .exec();

    if (!vendor) {
      throw new Error("Vendor not found");
    }

    return buildVendorProfileResponse(vendor);
  },

  updateProfile: async ({
    user_id,
    name,
    email,
    phone,
    countryCode,
    address,
    gst,
    code,
    password,
    profilePicture,
  }) => {
    if (
      !name &&
      !email &&
      countryCode === undefined &&
      phone === undefined &&
      address === undefined &&
      gst === undefined &&
      !password &&
      !profilePicture
    ) {
      throw new Error("At least one field is required to update");
    }

    const vendor = await User.findOne({
      user_id: String(user_id).trim(),
      role: "Vendor",
    }).exec();

    if (!vendor) {
      throw new Error("Vendor not found");
    }

    // Email
    if (email) {
      const normalizedEmail = normalizeEmail(email);

      const duplicate = await User.findOne({
        email: normalizedEmail,
        user_id: {
          $ne: String(user_id).trim(),
        },
      }).exec();

      if (duplicate) {
        throw new Error("Email already in use");
      }

      vendor.email = normalizedEmail;
    }

    // Name
    if (name) {
      vendor.name = normalizeName(name);
    }

    // Phone
    if (phone !== undefined) {
      vendor.phone = String(phone).trim();
    }

    // Address
    if (address !== undefined) {
      vendor.address = String(address).trim();
    }

    // GST
    if (gst !== undefined) {
      vendor.gst_number = String(gst).trim();
    }

    if (code !== undefined) {
      vendor.code = String(code).trim();
    }

    // Password - only update when provided
    if (password) {
      vendor.passwordHash = await bcrypt.hash(String(password), 10);
    }

    // Profile picture
    if (profilePicture) {
      vendor.profilePicture = profilePicture;
    }

    if (countryCode !== undefined) {
      vendor.countryCode = normalizeCountryCode(countryCode);
    }

    await vendor.save();

    return buildVendorResponse(vendor);
  },

  getActiveVendors: async () => {
    const vendors = await User.find({
      role: "Vendor",
      status: 1,
    })
      .select("_id name")
      .sort({ name: 1 })
      .lean()
      .exec();

    return vendors;
  },
};

export default VendorService;
