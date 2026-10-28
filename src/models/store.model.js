import mongoose from "mongoose";

const StoreSchema = new mongoose.Schema(
  {
    vendor_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    store_name: {
      type: String,
      required: [true, "Store name is required"],
      trim: true,
      maxlength: [100, "Store name cannot exceed 100 characters"],
    },

    store_description: {
      type: String,
      default: "",
      trim: true,
      maxlength: [1000, "Description cannot exceed 1000 characters"],
    },

    store_logo: { type: String, default: "", trim: true },
    store_banner: { type: String, default: "", trim: true },

    email: {
      type: String,
      default: "",
      trim: true,
      lowercase: true,
      match: [/^$|^\S+@\S+\.\S+$/, "Invalid email address"],
    },

    phone: {
      type: String,
      default: "",
      trim: true,
      match: [/^$|^\+?[0-9\s\-()]{7,15}$/, "Invalid phone number"],
    },

    address: {
      type: String,
      required: [true, "Address is required"],
      trim: true,
    },

    country: { type: String, default: "", trim: true },
    state: { type: String, default: "", trim: true },
    city: { type: String, default: "", trim: true },
    postal_code: { type: String, default: "", trim: true },

    // GeoJSON point for geospatial queries ($near, $geoWithin)
    // Order is [longitude, latitude]
    location: {
      type: {
        type: String,
        enum: ["Point"],
      },
      coordinates: {
        type: [Number],
        default: undefined,
        validate: {
          validator: (v) =>
            v === undefined ||
            (v.length === 2 &&
              v[0] >= -180 &&
              v[0] <= 180 &&
              v[1] >= -90 &&
              v[1] <= 90),
          message: "Coordinates must be [longitude, latitude]",
        },
      },
    },

    gst_number: {
      type: String,
      default: "",
      trim: true,
      uppercase: true,
      match: [
        /^$|^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}Z[A-Z\d]{1}$/,
        "Invalid GST number",
      ],
    },

    verification_status: {
      type: String,
      enum: ["pending", "verified", "rejected"],
      default: "pending",
      index: true,
    },

    status: {
      type: String,
      enum: ["active", "inactive", "suspended"],
      default: "active",
    },

    is_default: { type: Boolean, default: false },
    verified_at: { type: Date, default: null },
    rejection_reason: { type: String, default: "", trim: true, maxlength: 500 },

    timings: {
      type: [
        {
          day: {
            type: String,
            enum: [
              "monday",
              "tuesday",
              "wednesday",
              "thursday",
              "friday",
              "saturday",
              "sunday",
            ],
            required: true,
          },
          is_closed: { type: Boolean, default: false },
          open_time: {
            type: String,
            default: "",
            trim: true,
            match: [
              /^$|^([01]\d|2[0-3]):[0-5]\d$/,
              "open_time must be HH:MM (24h)",
            ],
          },
          close_time: {
            type: String,
            default: "",
            trim: true,
            match: [
              /^$|^([01]\d|2[0-3]):[0-5]\d$/,
              "close_time must be HH:MM (24h)",
            ],
          },
        },
      ],
      default: undefined,
      validate: {
        validator(arr) {
          if (!arr || arr.length === 0) return true;
          const days = arr.map((t) => t.day);
          return new Set(days).size === days.length; // no duplicate days
        },
        message: "Each day can appear only once in timings",
      },
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

StoreSchema.index({ vendor_id: 1, status: 1 });
StoreSchema.index({ status: 1 });
StoreSchema.index({ location: "2dsphere" });

// Only one default store per vendor
StoreSchema.index(
  { vendor_id: 1 },
  { unique: true, partialFilterExpression: { is_default: true } },
);

const Store = mongoose.model("Store", StoreSchema);

export default Store;
