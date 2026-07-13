import express from "express";
import * as MessageController from "../controllers/message.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { uploadMedia } from "../middlewares/upload.middleware.js";

const router = express.Router();

router.post(
  "/",
  authMiddleware,
  MessageController.sendMessage
);

router.post(
  "/upload",
  authMiddleware,
  uploadMedia.single("file"),
  MessageController.uploadMediaFile
);

router.post(
  "/upload-multiple",
  authMiddleware,
  uploadMedia.array("files", 10),
  MessageController.uploadMultipleMediaFiles
);

export default router;
