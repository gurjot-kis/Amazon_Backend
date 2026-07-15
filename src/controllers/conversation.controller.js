import * as ConversationService from "../services/conversation.service.js";
import * as BackupService from "../services/backup.service.js";
import { UserModel } from "../models/index.js";
import { getIO } from "../config/socket.js";

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

export const endChat = async (req, res) => {
  try {
    const senderId = await getSenderId(req);
    const { conversationId } = req.params;
    const { end_chat } = req.body;

    if (end_chat !== true) {
      return res.status(400).json({
        success: false,
        message: "end_chat must be true",
      });
    }

    const conversation = await ConversationService.endChat(senderId, conversationId);

    const io = getIO();
    conversation.participants.forEach((participantId) => {
      const pIdStr = participantId.toString();
      if (pIdStr !== senderId.toString()) {
        io.to(`user:${pIdStr}`).emit("end_chat", {
          conversationId: conversation._id,
          end_chat: true,
        });
      }
    });

    return res.status(200).json({
      success: true,
      message: "Chat ended successfully",
      data: conversation,
    });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      success: false,
      message: error.message,
    });
  }
};

export const rateConversation = async (req, res) => {
  try {
    const senderId = await getSenderId(req);
    const { conversationId } = req.params;
    const { rating, feedback } = req.body;

    const io = getIO();

    const { conversation, backup } = await ConversationService.rateConversation(
      senderId,
      conversationId,
      rating,
      feedback,
      io
    );

    const otherParticipant = conversation.participants.find(
      (p) => p.toString() !== senderId.toString()
    );

    if (otherParticipant) {
      io.to(`user:${otherParticipant}`).emit("conversation_rated", {
        conversationId: conversation._id,
        rating,
        feedback,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Rating submitted and conversation removed",
      data: { rating, feedback },
    });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      success: false,
      message: error.message,
    });
  }
};

export const backupAndRemoveConversation = async (req, res) => {
  try {
    const senderId = await getSenderId(req);
    const { conversationId } = req.params;

    const backup = await BackupService.backupAndRemoveConversation(
      senderId,
      conversationId,
      "manual_delete"
    );

    return res.status(200).json({
      success: true,
      message: "Conversation backed up and removed successfully",
      data: backup,
    });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      success: false,
      message: error.message,
    });
  }
};
