import mongoose from "mongoose";
import crypto from "crypto";

const UserSchema = new mongoose.Schema(
  {
    user_id: {
      type: String,
      required: true,
      unique: true,
      default: () => crypto.randomUUID(),
    },
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
      index: true,
    },
    phone: { type: String, default: "" },
    address: { type: String, default: "" },
    latitude: { type: Number, default: null },
    longitude: { type: Number, default: null },
    active_store_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Store",
      default: null,
    },
    code: { type: String, default: "", trim: true },
    gst_number: { type: String, default: "", trim: true },
    role: {
      type: String,
      enum: ["SuperAdmin", "Admin", "User", "Vendor"],
      default: "User",
      index: true,
    },
    status: {
      type: Number,
      enum: [0, 1],
      default: 1,
    },
    googleId: { type: String, default: "", trim: true, index: true },
    facebookId: { type: String, default: "", trim: true, index: true },
    appleId: { type: String, default: "", trim: true, index: true },
    authProvider: {
      type: String,
      enum: ["local", "google", "facebook", "apple"],
      default: "local",
      index: true,
    },
    profilePicture: { type: String, default: "" },
    avatar: { type: String, default: "" },
    bio: { type: String, default: "Hey there! I am using Chat." },
    gender: { type: String, default: "" },
    passwordHash: { type: String, default: "" },
    resetOtp: { type: String, default: null },
    resetOtpExpiry: { type: Date, default: null },
    resetToken: { type: String, default: null },
    resetTokenExpiry: { type: Date, default: null },
    loginTwilioOtp: { type: String, default: null },
    loginTwilioOtpExpiry: { type: Date, default: null },
    isVendorVerified: { type: Boolean },
    deletedAt: { type: Date, default: null },
    isDeleted: { type: Boolean, default: false, index: true },
  },
  { timestamps: true },
);

const User = mongoose.model("User", UserSchema);

export default User;
