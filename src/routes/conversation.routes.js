import express from "express";
import * as ConversationController from "../controllers/conversation.controller.js";
import * as MessageController from "../controllers/message.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.post(
  "/private",
  authMiddleware,
  ConversationController.findOrCreatePrivateConversation
);

router.get("/", authMiddleware, ConversationController.getMyConversations);

router.delete(
  "/:conversationId",
  authMiddleware,
  ConversationController.deleteConversation
);

router.get(
  "/:conversationId/messages",
  authMiddleware,
  MessageController.getConversationMessages
);

export default router;
