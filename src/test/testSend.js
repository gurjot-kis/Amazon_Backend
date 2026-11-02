import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import DeviceTokenService from "../services/deviceToken.service.js";
import NotificationService from "../services/notification.service.js";

const USER_ID = "6abe3c9c6f7301f191416182";

await mongoose.connect(process.env.MONGO_URI); // use your actual env variable name
console.log("Mongo connected");

// 1. Save a fake token
await DeviceTokenService.saveToken({
  userId: USER_ID,
  token: "fake-token-123",
  platform: "ios",
});
console.log("Fake token saved");

// 2. Try to send
await NotificationService.sendToUser(USER_ID, {
  title: "Test",
  body: "Hello from backend",
  data: { type: "test" },
});
console.log("sendToUser finished");

await mongoose.disconnect();
