import mongoose from "mongoose";
import Address from "../models/address.model.js";

const { Types } = mongoose;

const normalizeString = (value) => String(value || "").trim();

const toObjectId = (value, fieldName = "user_id") => {
  if (!value || !Types.ObjectId.isValid(value)) {
    throw new Error(`${fieldName} must be a valid ObjectId`);
  }
  return new Types.ObjectId(value);
};

const parseOptionalLatitude = (value) => {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  const n =
    typeof value === "number" ? value : parseFloat(String(value).trim());
  if (!Number.isFinite(n) || n < -90 || n > 90) {
    throw new Error("latitude must be a number between -90 and 90");
  }
  return n;
};

const parseOptionalLongitude = (value) => {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  const n =
    typeof value === "number" ? value : parseFloat(String(value).trim());
  if (!Number.isFinite(n) || n < -180 || n > 180) {
    throw new Error("longitude must be a number between -180 and 180");
  }
  return n;
};

const mapAddress = (address) => ({
  _id: address._id,
  user_id: address.user_id,
  fullName: address.fullName,
  phone: address.phone,
  addressLine1: address.addressLine1,
  addressLine2: address.addressLine2 || "",
  landmark: address.landmark || "",
  city: address.city,
  state: address.state,
  country: address.country,
  pincode: address.pincode,
  isDefault: Boolean(address.isDefault),
  latitude:
    address.latitude != null && Number.isFinite(address.latitude)
      ? address.latitude
      : null,
  longitude:
    address.longitude != null && Number.isFinite(address.longitude)
      ? address.longitude
      : null,
  createdAt: address.createdAt,
  updatedAt: address.updatedAt,
});

const setDefaultAddress = async (user_id, address_id) => {
  await Address.updateMany(
    { user_id, _id: { $ne: address_id }, isDefault: true },
    { $set: { isDefault: false } },
  ).exec();
};

const requireFields = ({
  fullName,
  phone,
  addressLine1,
  city,
  state,
  country,
  pincode,
}) => {
  if (
    !fullName ||
    !phone ||
    !addressLine1 ||
    !city ||
    !state ||
    !country ||
    !pincode
  ) {
    throw new Error(
      "fullName, phone, addressLine1, city, state, country and pincode are required",
    );
  }
};

export const AddressService = {
  listAddresses: async ({ user_id }) => {
    const userId = toObjectId(user_id);
    if (!userId) {
      throw new Error("user_id is required");
    }

    const addresses = await Address.find({ user_id: userId })
      .sort({ isDefault: -1, createdAt: -1 })
      .lean()
      .exec();

    return addresses.map(mapAddress);
  },

  getAddressById: async ({ user_id, address_id }) => {
    const userId = toObjectId(user_id);
    const addressId = toObjectId(address_id, "address_id");

    const address = await Address.findOne({
      _id: addressId,
      user_id: userId,
    })
      .lean()
      .exec();

    if (!address) {
      throw new Error("Address not found");
    }

    return mapAddress(address);
  },

  addAddress: async ({
    user_id,
    fullName,
    phone,
    addressLine1,
    addressLine2,
    landmark,
    city,
    state,
    country,
    pincode,
    isDefault,
    latitude,
    longitude,
  }) => {
    const userId = toObjectId(user_id);
    requireFields({
      fullName,
      phone,
      addressLine1,
      city,
      state,
      country,
      pincode,
    });

    const created = await Address.create({
      user_id: userId,
      fullName: normalizeString(fullName),
      phone: normalizeString(phone),
      addressLine1: normalizeString(addressLine1),
      addressLine2: normalizeString(addressLine2),
      landmark: normalizeString(landmark),
      city: normalizeString(city),
      state: normalizeString(state),
      country: normalizeString(country),
      pincode: normalizeString(pincode),
      isDefault: Boolean(isDefault),
      latitude: parseOptionalLatitude(latitude),
      longitude: parseOptionalLongitude(longitude),
    });

    if (created.isDefault) {
      await setDefaultAddress(userId, created._id);
    }

    return mapAddress(created);
  },

  setDefaultAddress: async ({ user_id, address_id }) => {
    const userId = toObjectId(user_id);
    const addressId = toObjectId(address_id, "address_id");

    const target = await Address.findOne({
      user_id: userId,
      _id: addressId,
    }).exec();

    if (!target) {
      throw new Error("Address not found");
    }

    await Address.updateMany(
      { user_id: userId },
      { $set: { isDefault: false } },
    ).exec();
    target.isDefault = true;
    await target.save();

    return mapAddress(target);
  },

  updateAddress: async ({
    user_id,
    address_id,
    fullName,
    phone,
    addressLine1,
    addressLine2,
    landmark,
    city,
    state,
    country,
    pincode,
    isDefault,
    latitude,
    longitude,
  }) => {
    const userId = toObjectId(user_id);
    const addressId = toObjectId(address_id, "address_id");

    const address = await Address.findOne({
      user_id: userId,
      _id: addressId,
    }).exec();

    if (!address) {
      throw new Error("Address not found");
    }

    requireFields({
      fullName,
      phone,
      addressLine1,
      city,
      state,
      country,
      pincode,
    });

    address.fullName = normalizeString(fullName);
    address.phone = normalizeString(phone);
    address.addressLine1 = normalizeString(addressLine1);
    address.addressLine2 = normalizeString(addressLine2);
    address.landmark = normalizeString(landmark);
    address.city = normalizeString(city);
    address.state = normalizeString(state);
    address.country = normalizeString(country);
    address.pincode = normalizeString(pincode);
    address.isDefault = Boolean(isDefault);

    if (latitude !== undefined) {
      address.latitude = parseOptionalLatitude(latitude);
    }
    if (longitude !== undefined) {
      address.longitude = parseOptionalLongitude(longitude);
    }

    await address.save();

    if (address.isDefault) {
      await setDefaultAddress(userId, addressId);
    }

    return mapAddress(address);
  },

  deleteAddress: async ({ user_id, address_id }) => {
    const userId = toObjectId(user_id);
    const addressId = toObjectId(address_id, "address_id");

    const deleted = await Address.findOneAndDelete({
      _id: addressId,
      user_id: userId,
    }).exec();

    if (!deleted) {
      throw new Error("Address not found");
    }

    if (deleted.isDefault) {
      const nextDefault = await Address.findOne({ user_id: userId })
        .sort({ createdAt: -1 })
        .exec();
      if (nextDefault) {
        nextDefault.isDefault = true;
        await nextDefault.save();
      }
    }

    return {
      _id: addressId,
    };
  },
};

export default AddressService;
