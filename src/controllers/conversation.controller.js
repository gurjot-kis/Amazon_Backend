import * as ConversationService from "../services/conversation.service.js";
import { UserModel } from "../models/index.js";

const getSenderId = async (req) => {
  const loggedInUser = await UserModel.findOne({ user_id: req.user.user_id });
  if (!loggedInUser) {
    throw new Error("Unauthorized: User not found in database");
  }
  return loggedInUser._id;
};

export const findOrCreatePrivateConversation = async (req, res) => {
  try {
    const senderId = await getSenderId(req);
    const { receiverId } = req.body;

    const conversation = await ConversationService.findOrCreatePrivateConversation(
      senderId,
      receiverId
    );

    return res.status(200).json({
      success: true,
      message: "Conversation fetched successfully",
      data: conversation,
    });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      success: false,
      message: error.message,
    });
  }
};

export const getMyConversations = async (req, res) => {
  try {
    const senderId = await getSenderId(req);

    const conversations = await ConversationService.getMyConversations(senderId);

    return res.status(200).json({
      success: true,
      message: "Conversations fetched successfully",
      data: conversations,
    });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      success: false,
      message: error.message,
    });
  }
};

export const deleteConversation = async (req, res) => {
  try {
    const senderId = await getSenderId(req);
    const { conversationId } = req.params;

    await ConversationService.deleteConversation(senderId, conversationId);

    return res.status(200).json({
      success: true,
      message: "Conversation deleted successfully",
    });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      success: false,
      message: error.message,
    });
  }
};
