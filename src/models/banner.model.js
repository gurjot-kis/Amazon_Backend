import mongoose from "mongoose";
import {
  BANNER_DEVICE_TYPE,
  BANNER_DEVICE_TYPE_VALUES,
  BANNER_POSITION,
  BANNER_POSITION_VALUES,
  BANNER_REDIRECT_TYPE,
  BANNER_REDIRECT_TYPE_VALUES,
  BANNER_UPLOAD_AREA,
  BANNER_UPLOAD_AREA_VALUES,
  STATUS,
  STATUS_VALUES,
} from "../constants/index.js";

const BannerSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
      trim: true,
    },

    banner_image: {
      type: String,
      default: "",
      trim: true,
    },

    redirect_url: {
      type: String,
      required: true,
      trim: true,
    },
    redirect_type: {
      type: String,
      enum: BANNER_REDIRECT_TYPE_VALUES,
      default: BANNER_REDIRECT_TYPE.NONE,
    },

    upload_area: {
      type: String,
      enum: BANNER_UPLOAD_AREA_VALUES,
      default: BANNER_UPLOAD_AREA.APP,
    },

    position: {
      type: String,
      enum: BANNER_POSITION_VALUES,
      default: BANNER_POSITION.HOME_TOP,
    },
    device_type: {
      type: String,
      enum: BANNER_DEVICE_TYPE_VALUES,
      default: BANNER_DEVICE_TYPE.MOBILE,
    },
    sort_order: {
      type: Number,
      default: 0,
      min: 0,
    },
    start_date: {
      type: Date,
      default: null,
    },
    end_date: {
      type: Date,
      default: null,
    },
    vendor_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    store_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Store",
      required: true,
      index: true,
    },
    status: {
      type: Number,
      enum: STATUS_VALUES,
      default: STATUS.ACTIVE,
    },
  },
  { timestamps: true },
);

BannerSchema.index({
  vendor_id: 1,
  store_id: 1,
  upload_area: 1,
  position: 1,
  status: 1,
  sort_order: 1,
});

const Banner = mongoose.model("Banner", BannerSchema);

export default Banner;
