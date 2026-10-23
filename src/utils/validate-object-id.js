import mongoose from "mongoose";

export const validateObjectId = (id, fieldName = "id") => {
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    throw new Error(`${fieldName} must be a valid MongoDB ObjectId`);
  }

  return true;
};

export default validateObjectId;
