import jwt from "jsonwebtoken";
import { isBlacklisted } from "../utils/token-blacklist.js";

export const authMiddleware = (req, res, next) => {
  try {
    const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";
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
    req.user = {
      user_id: decoded.user_id,
      email: decoded.email,
      role: decoded.role || "User",
    };

    return next();
  } catch (_err) {
    console.error("JWT Verification failed:", _err);
    return res.status(401).json({
      success: false,
      code: 401,
      message: process.env.NODE_ENV === "development"
        ? `Unauthorized: ${_err.message}`
        : "Unauthorized: invalid token",
      data: null,
    });
  }
};

export default authMiddleware;

