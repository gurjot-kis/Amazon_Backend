import jwt from "jsonwebtoken";
import { isBlacklisted } from "../utils/token-blacklist.js";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";

export const authMiddleware = (req, res, next) => {
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
    req.user = {
      _id: decoded._id,
      user_id: decoded.user_id,
      email: decoded.email,
      role: decoded.role || "User",
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

export default authMiddleware;
