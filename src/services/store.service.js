import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import Store from "../models/store.model.js";
import { paginateAggregate } from "./pagination.service.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_ROOT = path.join(__dirname, "../uploads");
const TEXT_FIELDS = [
  "store_name",
  "store_description",
  "email",
  "phone",
  "address",
  "country",
  "state",
  "city",
  "postal_code",
  "gst_number",
];

const clean = (v) => String(v ?? "").trim();
const toBool = (v) => v === true || v === "true";
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const assertObjectId = (id, label = "ID") => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new Error(`Invalid ${label}`);
  }
};

const isBlank = (v) => v === undefined || v === null || clean(v) === "";

const removeFile = (fileUrl) => {
  if (!fileUrl) return;
  const relative = fileUrl.replace(/^\/?uploads\//, "");
  const fullPath = path.resolve(UPLOADS_ROOT, relative);
  if (!fullPath.startsWith(UPLOADS_ROOT)) return; 
  fs.unlink(fullPath, () => {});
};

const parseLocation = (latitude, longitude) => {
  const hasLat = !isBlank(latitude);
  const hasLng = !isBlank(longitude);

  if (!hasLat && !hasLng) return null;
  if (hasLat !== hasLng) {
    throw new Error("Both latitude and longitude are required");
  }

  const lat = Number(latitude);
  const lng = Number(longitude);

  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    throw new Error("Latitude must be between -90 and 90");
  }
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
    throw new Error("Longitude must be between -180 and 180");
  }

  return { type: "Point", coordinates: [lng, lat] }; 
};

const assertUniqueName = async (vendor_id, name, excludeId = null) => {
  const query = { vendor_id, store_name: name };
  if (excludeId) query._id = { $ne: excludeId };

  const existing = await Store.findOne(query)
    .collation({ locale: "en", strength: 2 }) 
    .select("_id")
    .lean();

  if (existing) {
    throw new Error("You already have a store with this name");
  }
};

const getOwnedStore = async (vendor_id, id) => {
  assertObjectId(id, "store ID");
  const store = await Store.findOne({ _id: id, vendor_id }).lean();
  if (!store) throw new Error("Store not found");
  return store;
};

const normalizePagination = (page, limit) => ({
  page: Math.max(Number(page) || 1, 1),
  limit: Math.min(Math.max(Number(limit) || 10, 1), 100),
});

const paginate = (pipeline, { page, limit } = {}) =>
  paginateAggregate(Store, pipeline, normalizePagination(page, limit));


export const StoreService = {
  // ═════════════════════════ VENDOR ═════════════════════════

  createStore: async (vendor_id, body = {}, images = {}) => {
    const store_name = clean(body.store_name);
    if (!store_name) throw new Error("Store name is required");
    if (isBlank(body.address)) throw new Error("Address is required");

    const location = parseLocation(body.latitude, body.longitude);
    await assertUniqueName(vendor_id, store_name);

    const storeCount = await Store.countDocuments({ vendor_id });
    const makeDefault = storeCount === 0 || toBool(body.is_default);

    const doc = { vendor_id, store_name, is_default: makeDefault };

    for (const field of TEXT_FIELDS) {
      if (field !== "store_name" && body[field] !== undefined) {
        doc[field] = clean(body[field]);
      }
    }
    if (location) doc.location = location;
    if (images.store_logo) doc.store_logo = images.store_logo;
    if (images.store_banner) doc.store_banner = images.store_banner;

    if (makeDefault) {
      await Store.updateMany(
        { vendor_id, is_default: true },
        { $set: { is_default: false } },
      );
    }

    return Store.create(doc);
  },

  getMyStores: async (
    vendor_id,
    { page, limit, search = "", status = "", verification_status = "" } = {},
  ) => {
    const match = { vendor_id: new mongoose.Types.ObjectId(vendor_id) };
    if (search.trim()) {
      match.store_name = { $regex: escapeRegex(search.trim()), $options: "i" };
    }
    if (status) match.status = status;
    if (verification_status) match.verification_status = verification_status;

    return paginate(
      [{ $match: match }, { $sort: { is_default: -1, createdAt: -1 } }],
      { page, limit },
    );
  },

  getMyStoreById: async (vendor_id, id) => getOwnedStore(vendor_id, id),

  updateStore: async (vendor_id, id, body = {}, images = {}) => {
    const store = await getOwnedStore(vendor_id, id);

    const $set = {};
    const $unset = {};
    const filesToDelete = [];

    // Text fields
    for (const field of TEXT_FIELDS) {
      if (body[field] === undefined) continue;
      const value = clean(body[field]);

      if ((field === "store_name" || field === "address") && !value) {
        throw new Error(
          `${field === "store_name" ? "Store name" : "Address"} cannot be empty`,
        );
      }
      if (field === "store_name" && value !== store.store_name) {
        await assertUniqueName(vendor_id, value, store._id);
      }
      $set[field] = value;
    }

    // Changing GST on a verified store requires re-verification
    if (
      $set.gst_number !== undefined &&
      $set.gst_number !== store.gst_number &&
      store.verification_status === "verified"
    ) {
      $set.verification_status = "pending";
      $set.verified_at = null;
    }

    // Location: both empty = clear it, both valid = update it
    if (body.latitude !== undefined || body.longitude !== undefined) {
      const location = parseLocation(body.latitude, body.longitude);
      if (location) $set.location = location;
      else $unset.location = "";
    }

    // Images: new upload replaces old; remove_* flags clear it
    if (images.store_logo) {
      $set.store_logo = images.store_logo;
      filesToDelete.push(store.store_logo);
    } else if (toBool(body.remove_logo)) {
      $set.store_logo = "";
      filesToDelete.push(store.store_logo);
    }

    if (images.store_banner) {
      $set.store_banner = images.store_banner;
      filesToDelete.push(store.store_banner);
    } else if (toBool(body.remove_banner)) {
      $set.store_banner = "";
      filesToDelete.push(store.store_banner);
    }

    // Default flag
    if (body.is_default !== undefined) {
      const wantsDefault = toBool(body.is_default);
      if (!wantsDefault && store.is_default) {
        throw new Error(
          "A default store cannot be unset. Make another store the default instead",
        );
      }
      if (wantsDefault && !store.is_default) {
        await Store.updateMany(
          { vendor_id, is_default: true },
          { $set: { is_default: false } },
        );
        $set.is_default = true;
      }
    }

    const update = {};
    if (Object.keys($set).length) update.$set = $set;
    if (Object.keys($unset).length) update.$unset = $unset;
    if (!Object.keys(update).length) return store;

    const updated = await Store.findOneAndUpdate(
      { _id: id, vendor_id },
      update,
      { new: true, runValidators: true },
    ).lean();

    // Delete replaced files only after the DB update succeeded
    filesToDelete.forEach(removeFile);
    return updated;
  },

  setDefaultStore: async (vendor_id, id) => {
    const store = await getOwnedStore(vendor_id, id);

    if (store.status !== "active") {
      throw new Error("Only an active store can be the default");
    }
    if (store.is_default) return store;

    await Store.updateMany(
      { vendor_id, is_default: true },
      { $set: { is_default: false } },
    );
    return Store.findByIdAndUpdate(
      id,
      { $set: { is_default: true } },
      { new: true },
    ).lean();
  },

  toggleStoreStatus: async (vendor_id, id) => {
    const store = await getOwnedStore(vendor_id, id);

    if (store.status === "suspended") {
      throw new Error("This store is suspended. Please contact support");
    }

    const status = store.status === "active" ? "inactive" : "active";
    return Store.findByIdAndUpdate(
      id,
      { $set: { status } },
      { new: true },
    ).lean();
  },

  deleteStore: async (vendor_id, id) => {
    const store = await getOwnedStore(vendor_id, id);

    // TODO: block deletion if products/orders reference this store
    await Store.deleteOne({ _id: id, vendor_id });

    // Promote another store if the default was deleted
    if (store.is_default) {
      const next = await Store.findOne({ vendor_id, status: "active" })
        .sort({ createdAt: 1 })
        .select("_id")
        .lean();
      if (next) {
        await Store.updateOne(
          { _id: next._id },
          { $set: { is_default: true } },
        );
      }
    }

    removeFile(store.store_logo);
    removeFile(store.store_banner);
  },

  // ═════════════════════════ ADMIN ═════════════════════════

  getAllStoresForAdmin: async ({
    page,
    limit,
    search = "",
    status = "",
    verification_status = "",
    vendor_id = "",
  } = {}) => {
    const match = {};
    if (search.trim()) {
      match.store_name = { $regex: escapeRegex(search.trim()), $options: "i" };
    }
    if (status) match.status = status;
    if (verification_status) match.verification_status = verification_status;
    if (vendor_id) {
      assertObjectId(vendor_id, "vendor ID");
      match.vendor_id = new mongoose.Types.ObjectId(vendor_id);
    }

    return paginate(
      [
        { $match: match },
        { $sort: { createdAt: -1 } },
        // Adjust collection and field names to your User model
        {
          $lookup: {
            from: "users",
            localField: "vendor_id",
            foreignField: "_id",
            as: "vendor",
            pipeline: [
              { $project: { name: 1, email: 1, phone: 1, profilePicture: 1 } },
            ],
          },
        },
        { $unwind: { path: "$vendor", preserveNullAndEmptyArrays: true } },
      ],
      { page, limit },
    );
  },

  getStoreByIdForAdmin: async (id) => {
    assertObjectId(id, "store ID");
    const store = await Store.findById(id)
      .populate("vendor_id", "name email phone profilePicture")
      .lean();
    if (!store) throw new Error("Store not found");
    return store;
  },

  updateVerificationStatus: async (
    id,
    { verification_status, rejection_reason },
  ) => {
    assertObjectId(id, "store ID");

    if (!["verified", "rejected", "pending"].includes(verification_status)) {
      throw new Error(
        "Verification status must be verified, rejected or pending",
      );
    }
    if (verification_status === "rejected" && isBlank(rejection_reason)) {
      throw new Error("Rejection reason is required");
    }

    const $set = {
      verification_status,
      verified_at: verification_status === "verified" ? new Date() : null,
      rejection_reason:
        verification_status === "rejected" ? clean(rejection_reason) : "",
    };

    const store = await Store.findByIdAndUpdate(
      id,
      { $set },
      { new: true, runValidators: true },
    ).lean();
    if (!store) throw new Error("Store not found");
    return store;
  },

  updateStoreStatusByAdmin: async (id, status) => {
    assertObjectId(id, "store ID");
    if (!["active", "inactive", "suspended"].includes(status)) {
      throw new Error("Status must be active, inactive or suspended");
    }

    const store = await Store.findByIdAndUpdate(
      id,
      { $set: { status } },
      { new: true },
    ).lean();
    if (!store) throw new Error("Store not found");
    return store;
  },

  // ═════════════════════════ PUBLIC / CUSTOMER ═════════════════════════

  getNearbyStores: async ({
    latitude,
    longitude,
    radius_km = 5,
    page,
    limit,
  }) => {
    const location = parseLocation(latitude, longitude);
    if (!location) throw new Error("Latitude and longitude are required");

    const radius = Number(radius_km);
    if (!Number.isFinite(radius) || radius <= 0 || radius > 100) {
      throw new Error("Radius must be between 0 and 100 km");
    }

    return paginate(
      [
        {
          // Must be the first stage
          $geoNear: {
            near: location,
            distanceField: "distance_m",
            maxDistance: radius * 1000,
            spherical: true,
            query: { status: "active", verification_status: "verified" },
          },
        },
        {
          $project: {
            store_name: 1,
            store_description: 1,
            store_logo: 1,
            store_banner: 1,
            address: 1,
            city: 1,
            state: 1,
            location: 1,
            distance_km: { $round: [{ $divide: ["$distance_m", 1000] }, 1] },
          },
        },
      ],
      { page, limit },
    );
  },
};

export default StoreService;
