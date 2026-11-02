import mongoose from "mongoose";

const deviceTokenSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    token: { type: String, required: true, unique: true },
    platform: { type: String, enum: ["android", "ios"], required: true },
  },
  { timestamps: true, versionKey: false },
);

export default mongoose.model("DeviceToken", deviceTokenSchema);
