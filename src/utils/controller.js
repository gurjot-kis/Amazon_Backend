import { sendError } from "../helpers/response.helper.js";
import { AppError } from "./AppError.js";

export const authId = (req) => {
  const id = req.user?._id;
  if (!id) throw new AppError(401, "Unauthorized");
  return id;
};

const respondError = (res, err, fallbackMessage) => {
  if (err instanceof AppError) {
    return sendError(res, { code: err.statusCode, message: err.message });
  }
  if (err?.name === "ValidationError") {
    return sendError(res, { code: 400, message: err.message });
  }
  console.error("[controller]", err);
  return sendError(res, { code: 500, message: fallbackMessage });
};

// Keeps each controller method focused on the happy path.
export const handle = (fallbackMessage, fn) => async (req, res) => {
  try {
    return await fn(req, res);
  } catch (err) {
    return respondError(res, err, fallbackMessage);
  }
};
