import * as ChatUserService from "../services/chat-user.service.js";
import { UserModel } from "../models/index.js";

const getSenderId = async (req) => {
  const loggedInUser = await UserModel.findOne({ user_id: req.user.user_id });
  if (!loggedInUser) {
    throw new Error("Unauthorized: User not found in database");
  }
  return loggedInUser._id;
};

export const register = async (req, res) => {
  try {
    const data = await ChatUserService.registerUser(req.body);
    return res.status(201).json({
      success: true,
      message: "Registered successfully",
      data,
    });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      success: false,
      message: error.message || "Something went wrong",
    });
  }
};

export const login = async (req, res) => {
  try {
    const data = await ChatUserService.loginUser(req.body);
    return res.status(201).json({
      success: true,
      message: "Login successfully",
      data,
    });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      success: false,
      message: error.message || "Something went wrong",
    });
  }
};

export const getUserProfile = async (req, res) => {
  try {
    const senderId = await getSenderId(req);
    const user = await ChatUserService.getLoggedInUserProfile(senderId);

    return res.status(200).json({
      success: true,
      data: { userObj: user },
      message: "User profile fetched successfully",
    });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      success: false,
      message: error.message || "Something went wrong",
    });
  }
};

export const uploadAvatarFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }

    const avatarUrl = `/uploads/${req.file.path.replace(/\\/g, "/").split("/uploads/")[1]}`;

    return res.status(200).json({
      success: true,
      message: "Avatar uploaded successfully",
      data: {
        avatarUrl,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const senderId = await getSenderId(req);
    const updatedUser = await ChatUserService.updateUserProfile(senderId, req.body);

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data: updatedUser,
    });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      success: false,
      message: error.message || "Something went wrong",
    });
  }
};

export const getAllUsers = async (req, res) => {
  try {
    const senderId = await getSenderId(req);
    const search = req.query.search || "";
    const users = await ChatUserService.getAllUsersList(senderId, search);

    return res.status(200).json({
      success: true,
      message: "Users fetched successfully",
      data: users,
    });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      success: false,
      message: error.message || "Something went wrong",
    });
  }
};
