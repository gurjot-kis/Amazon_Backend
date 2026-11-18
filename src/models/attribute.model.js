import mongoose from "mongoose";
import {
  DATA_TYPE,
  DATA_TYPE_VALUES,
  INPUT_TYPE,
  INPUT_TYPE_VALUES,
} from "../constants/attribute.enum.js";
import { STATUS_TYPE, STATUS_TYPE_VALUES } from "../constants/common.enum.js";

const AttributeSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    label: { type: String, required: true, trim: true },
    input_type: {
      type: String,
      enum: INPUT_TYPE_VALUES,
      default: INPUT_TYPE.MULTI_SELECT,
    },
    data_type: {
      type: String,
      enum: DATA_TYPE_VALUES,
      default: DATA_TYPE.STRING,
    },
    unit: { type: String, default: "", trim: true },
    options: [
      {
        _id: false,
        value: { type: String, required: true, trim: true, lowercase: true },
        label: { type: String, required: true, trim: true },
        display_order: { type: Number, default: 0 },
      },
    ],
    status: {
      type: String,
      enum: STATUS_TYPE_VALUES,
      default: STATUS_TYPE.ACTIVE,
    },
  },
  { timestamps: true, versionKey: false },
);

export default mongoose.model("Attribute", AttributeSchema);
