import jwt from "jsonwebtoken";

export const generateToken = (payload) => {
  const JWT_SECRET = process.env.JWT_SECRET || "mysecretkey";
  const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
};

export const verifyToken = (token) => {
  const JWT_SECRET = process.env.JWT_SECRET || "mysecretkey";
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    throw new Error("Invalid or expired token");
  }
};
