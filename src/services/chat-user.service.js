import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { UserModel } from "../models/index.js";

const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#]).{8,16}$/;

const signAuthToken = (user) => {
  const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";
  const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "365d";
  return jwt.sign(
    {
      id: user._id.toString(),
      user_id: user.user_id,
      email: user.email,
      role: user.role || "User",
    },
    JWT_SECRET,
    { algorithm: "HS256", expiresIn: JWT_EXPIRES_IN }
  );
};

export const mapChatUser = (user) => {
  if (!user) return null;
  return {
    _id: user._id.toString(),
    user_id: user.user_id,
    name: user.name,
    email: user.email,
    phone: user.phone || "",
    gender: user.gender || "male",
    bio: user.bio || "Hey there! I am using Chat.",
    avatar: user.avatar || user.profilePicture || "",
    status: user.status === 0 ? "inactive" : "active",
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
};

export const registerUser = async (data) => {
  const { name, email, phone, password, gender } = data;

  const nameRegex = /^[A-Za-z\s]+$/;
  if (!nameRegex.test(name)) {
    throw new Error("Name should contain only alphabets");
  }

  if (!email && !phone) {
    throw new Error("Email or Phone is required");
  }

  if (!gender) {
    throw new Error("Please choose your gender");
  }
  if (!name) {
    throw new Error("Please enter your name");
  }

  if (!passwordRegex.test(password)) {
    throw new Error(
      "Password must be 8-16 characters with uppercase, lowercase, number and special character"
    );
  }

  const conditions = [];
  if (email) conditions.push({ email });
  if (phone) conditions.push({ phone });
  const existingUser = await UserModel.findOne(
    conditions.length ? { $or: conditions } : {}
  );

  if (existingUser) {
    throw new Error("User already exists");
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await UserModel.create({
    user_id: crypto.randomUUID(),
    name,
    email,
    phone: phone || "",
    gender,
    bio: data.bio || "Hey there! I am using Chat.",
    avatar: data.avatar || "",
    profilePicture: data.avatar || "",
    passwordHash: hashedPassword,
    role: "User",
    status: 1,
  });

  const token = signAuthToken(user);
  return {
    user: mapChatUser(user),
    token,
  };
};

export const loginUser = async (data) => {
  const { email, phone, password } = data;

  if (!email && !phone) {
    throw new Error("Email or Phone is required");
  }

  if (!password) {
    throw new Error("Password is required");
  }

  const conditions = [];
  if (email) conditions.push({ email });
  if (phone) conditions.push({ phone });

  const user = await UserModel.findOne(
    conditions.length ? { $or: conditions } : {}
  );

  if (!user) {
    throw new Error("User not found");
  }

  const isMatch = await bcrypt.compare(password, user.passwordHash || "");
  if (!isMatch) {
    throw new Error("Invalid credentials");
  }

  const token = signAuthToken(user);
  return {
    user: mapChatUser(user),
    token,
  };
};

export const getLoggedInUserProfile = async (userId) => {
  const user = await UserModel.findById(userId);
  if (!user) {
    throw new Error("User not found");
  }
  return mapChatUser(user);
};

export const updateUserProfile = async (userId, data) => {
  const { name, gender, bio, avatar } = data;

  const user = await UserModel.findById(userId);
  if (!user) {
    throw new Error("User not found");
  }

  if (name) {
    const nameRegex = /^[A-Za-z\s]+$/;
    if (!nameRegex.test(name)) {
      throw new Error("Name should contain only alphabets");
    }
    user.name = name;
  }

  if (gender) {
    user.gender = gender;
  }

  if (bio !== undefined) {
    user.bio = bio;
  }

  if (avatar !== undefined) {
    user.avatar = avatar;
    user.profilePicture = avatar;
  }

  await user.save();
  return mapChatUser(user);
};

export const getAllUsersList = async (currentUserId, search = "") => {
  const query = {
    _id: { $ne: currentUserId },
  };

  if (search.trim()) {
    query.$or = [
      { name: { $regex: search.trim(), $options: "i" } },
      { phone: { $regex: search.trim(), $options: "i" } },
    ];
  }

  const users = await UserModel.find(query).sort({ name: 1 });
  return users.map(mapChatUser);
};

export const getConversationUsersList = async (currentUserId, search = "") => {
  const ConversationModel = (await import("../models/index.js")).ConversationModel;

  const conversations = await ConversationModel.find({
    participants: currentUserId,
    type: "private",
  }).select("participants");

  const participantIds = [...new Set(conversations.map((c) => c.participants.map((p) => p.toString())))].flat();

  const uniqueUserIds = [...new Set(participantIds.filter((id) => id !== currentUserId.toString()))];

  if (uniqueUserIds.length === 0) {
    return [];
  }

  const query = {
    _id: { $in: uniqueUserIds },
  };

  if (search.trim()) {
    query.$or = [
      { name: { $regex: search.trim(), $options: "i" } },
      { phone: { $regex: search.trim(), $options: "i" } },
    ];
  }

  const users = await UserModel.find(query).sort({ name: 1 });
  return users.map(mapChatUser);
};
