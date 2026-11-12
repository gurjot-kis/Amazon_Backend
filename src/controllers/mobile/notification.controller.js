import { sendSuccess, sendError } from "../../helpers/response.helper.js";
import NotificationService from "../../services/notification.service.js";
import { AppError } from "../../utils/AppError.js";

const authId = (req) => {
  const id = req.user?._id;
  if (!id) throw new AppError(401, "Unauthorized");
  return id;
};

const handle = (fallbackMessage, fn) => async (req, res) => {
  try {
    return await fn(req, res);
  } catch (err) {
    if (err instanceof AppError) {
      return sendError(res, { code: err.statusCode, message: err.message });
    }
    console.error("[notification]", err);
    return sendError(res, { code: 500, message: fallbackMessage });
  }
};

export const NotificationController = {
  listUnread: handle("Unable to fetch notifications", async (req, res) => {
    const { page, limit } = req.query || {};
    const { notifications, pagination } = await NotificationService.listUnread({
      user_id: authId(req),
      page,
      limit,
    });
    return sendSuccess(res, {
      message: "Notifications fetched successfully",
      data: notifications,
      pagination,
    });
  }),

  markAsRead: handle("Unable to update notification", async (req, res) => {
    const data = await NotificationService.markAsRead({
      user_id: authId(req),
      notification_id: req.params?.id,
    });
    return sendSuccess(res, { message: "Notification marked as read", data });
  }),

  markAllAsRead: handle("Unable to update notifications", async (req, res) => {
    const data = await NotificationService.markAllAsRead({
      user_id: authId(req),
    });
    return sendSuccess(res, {
      message: "All notifications marked as read",
      data,
    });
  }),
};

export default NotificationController;
