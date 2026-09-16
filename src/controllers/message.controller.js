import * as MessageService from "../services/message.service.js";
import { UserModel } from "../models/index.js";

const getSenderId = async (req) => {
  const loggedInUser = await UserModel.findOne({ user_id: req.user.user_id });
  if (!loggedInUser) {
    throw new Error("Unauthorized: User not found in database");
  }
  return loggedInUser._id;
};

export const getConversationMessages = async (req, res) => {
  try {
    const senderId = await getSenderId(req);
    const { conversationId } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const messages = await MessageService.getConversationMessages(
      senderId,
      conversationId,
      Number(page),
      Number(limit)
    );

    return res.status(200).json({
      success: true,
      message: "Messages fetched successfully",
      data: messages,
    });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      success: false,
      message: error.message,
    });
  }
};

export const sendMessage = async (req, res) => {
  try {
    const senderId = await getSenderId(req);

    const { message } = await MessageService.sendMessage(senderId, req.body);

    return res.status(201).json({
      success: true,
      message: "Message sent successfully",
      data: message,
    });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      success: false,
      message: error.message,
    });
  }
};

export const uploadMediaFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }

    let messageType = "file";
    if (req.file.mimetype.startsWith("image/")) messageType = "image";
    else if (req.file.mimetype.startsWith("video/")) messageType = "video";

    const mediaUrl = `/uploads/${req.file.path.replace(/\\/g, "/").split("/uploads/")[1]}`;

    return res.status(200).json({
      success: true,
      message: "File uploaded successfully",
      data: {
        mediaUrl,
        messageType,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const uploadMultipleMediaFiles = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: "No files uploaded" });
    }

    const uploadedFiles = req.files.map((file) => {
      let messageType = "file";
      if (file.mimetype.startsWith("image/")) messageType = "image";
      else if (file.mimetype.startsWith("video/")) messageType = "video";

      const mediaUrl = `/uploads/${file.path.replace(/\\/g, "/").split("/uploads/")[1]}`;
      return {
        mediaUrl,
        messageType,
      };
    });

    return res.status(200).json({
      success: true,
      message: "Files uploaded successfully",
      data: uploadedFiles,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
