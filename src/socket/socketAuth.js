import { UserModel } from "../models/index.js";
import { verifyToken } from "../services/token.service.js";

export default async function socketAuth(socket, next) {
  try {
    let token = socket.handshake.auth?.token;

    if (!token) {
      return next(new Error("Authentication token is required"));
    }

    // Clean token: strip whitespace, 'Bearer ' prefix, and outer quotes
    token = token.trim();
    if (token.toLowerCase().startsWith("bearer ")) {
      token = token.slice(7).trim();
    }
    if (
      (token.startsWith('"') && token.endsWith('"')) ||
      (token.startsWith("'") && token.endsWith("'"))
    ) {
      token = token.slice(1, -1);
    }

    const decoded = verifyToken(token);

    const userId = decoded.id || decoded.user_id;
    let user = null;
    if (userId) {
      user = await UserModel.findOne({ user_id: userId }).select("-password");
      if (!user && String(userId).match(/^[0-9a-fA-F]{24}$/)) {
        user = await UserModel.findById(userId).select("-password");
      }
    }

    if (!user) {
      return next(new Error("User not found"));
    }

    socket.user = user;

    next();
  } catch (error) {
    next(new Error(error.message || "Unauthorized"));
  }
}