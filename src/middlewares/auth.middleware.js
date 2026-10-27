import jwt from "jsonwebtoken";
import { isBlacklisted } from "../utils/token-blacklist.js";
import User from "../models/user.model.js";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";

export const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || "";
    const [scheme, token] = authHeader.split(" ");

    if (scheme !== "Bearer" || !token) {
      return res.status(401).json({
        success: false,
        code: 401,
        message: "Unauthorized: token missing",
        data: null,
      });
    }

    if (isBlacklisted(token)) {
      return res.status(401).json({
        success: false,
        code: 401,
        message: "Unauthorized: token has been revoked",
        data: null,
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);

    const user = await User.findById(decoded._id)
      .select("_id user_id email role status isDeleted")
      .lean();

    if (!user || user.isDeleted) {
      return res.status(401).json({
        success: false,
        code: 401,
        message: "Unauthorized: account not found or has been deleted",
        data: null,
      });
    }

    if (user.status === 0) {
      return res.status(401).json({
        success: false,
        code: 401,
        message: "Unauthorized: account is deactivated",
        data: null,
      });
    }

    req.user = {
      _id: user._id,
      user_id: user.user_id,
      email: user.email,
      role: user.role,
    };

    return next();
  } catch (err) {
    console.error("========== JWT ERROR ==========");
    console.error("Name:", err.name);
    console.error("Message:", err.message);
    console.error("================================");

    return res.status(401).json({
      success: false,
      code: 401,
      message: "Unauthorized: invalid token",
      data: null,
    });
  }
};

/** Sets req.user when a valid Bearer token is present; continues without error when absent. */
export const optionalAuthMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization || "";
  const [scheme, token] = authHeader.split(" ");

  if (scheme !== "Bearer" || !token) {
    return next();
  }

  if (isBlacklisted(token)) {
    return next();
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = {
      user_id: decoded.user_id,
      email: decoded.email,
      role: decoded.role || "User",
    };
  } catch {
    // Invalid token — allow guest cart via guest_id on public cart routes.
  }

  return next();
};

export default authMiddleware;
