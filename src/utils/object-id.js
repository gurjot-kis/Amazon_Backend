import mongoose from "mongoose";
import { AppError } from "./AppError.js";

const OBJECT_ID_REGEX = /^[a-f\d]{24}$/i;

export const isObjectIdLike = (value) =>
  OBJECT_ID_REGEX.test(String(value ?? ""));

export const toObjectId = (value, fieldName = "id") => {
  const raw = typeof value === "string" ? value.trim() : value;
  if (!raw || !isObjectIdLike(raw)) {
    throw new AppError(400, `${fieldName} must be a valid ObjectId`);
  }
  return new mongoose.Types.ObjectId(String(raw));
};
