import * as MessageService from "../services/message.service.js";
import { ConversationModel, MessageModel } from "../models/index.js";
import mongoose from "mongoose";

export default function registerChatEvents(io, socket) {
  socket.on("send_message", async (data, callback) => {
    try {
      const senderId = socket.user._id.toString();

      const { message, conversation } = await MessageService.sendMessage(
        senderId,
        data,
      );

      // Send message to all participants except sender
      conversation.participants.forEach((participantId) => {
        participantId = participantId.toString();

        if (participantId !== senderId) {
          io.to(`user:${participantId}`).emit("new_message", {
            conversationId: conversation._id,
            message,
          });
        }
      });

      // ACK to sender
      if (typeof callback === "function") {
        callback({
          success: true,
          data: {
            conversationId: conversation._id,
            message,
          },
        });
      }
    } catch (error) {
      if (typeof callback === "function") {
        callback({
          success: false,
          message: error.message,
        });
      }
    }
  });

  socket.on("typing", async (data) => {
    try {
      const senderId = socket.user._id.toString();
      const { conversationId } = data || {};

      if (!conversationId || !mongoose.Types.ObjectId.isValid(conversationId)) {
        return;
      }

      // Fetch the conversation and ensure the sender is a participant
      const conversation = await ConversationModel.findOne({
        _id: conversationId,
        participants: senderId,
      });

      if (!conversation) return;

      // Broadcast typing event to all other participants
      conversation.participants.forEach((participantId) => {
        participantId = participantId.toString();

        if (participantId !== senderId) {
          io.to(`user:${participantId}`).emit("user_typing", {
            conversationId: conversation._id,
            userId: senderId,
            userName: socket.user.name,
          });
        }
      });
    } catch (error) {
      console.error("Error in typing event:", error);
    }
  });

  socket.on("stop_typing", async (data) => {
    try {
      const senderId = socket.user._id.toString();
      const { conversationId } = data || {};

      if (!conversationId || !mongoose.Types.ObjectId.isValid(conversationId)) {
        return;
      }

      // Fetch the conversation and ensure the sender is a participant
      const conversation = await ConversationModel.findOne({
        _id: conversationId,
        participants: senderId,
      });

      if (!conversation) return;

      // Broadcast stop typing event to all other participants
      conversation.participants.forEach((participantId) => {
        participantId = participantId.toString();

        if (participantId !== senderId) {
          io.to(`user:${participantId}`).emit("user_stop_typing", {
            conversationId: conversation._id,
            userId: senderId,
          });
        }
      });
    } catch (error) {
      console.error("Error in stop_typing event:", error);
    }
  });

  socket.on("mark_as_read", async (data) => {
    try {
      const userId = socket.user._id.toString();
      const { conversationId } = data || {};

      if (!conversationId || !mongoose.Types.ObjectId.isValid(conversationId)) {
        return;
      }

      // Update messages: set readBy for this user if not already present
      // where conversation is conversationId and sender is NOT this user
      await MessageModel.updateMany(
        {
          conversation: conversationId,
          sender: { $ne: userId },
          "readBy.user": { $ne: userId },
        },
        {
          $push: {
            readBy: {
              user: userId,
              readAt: new Date(),
            },
          },
        },
      );

      // Fetch conversation to find other participants and broadcast the event
      const conversation = await ConversationModel.findById(conversationId);
      if (conversation) {
        conversation.participants.forEach((participantId) => {
          participantId = participantId.toString();
          if (participantId !== userId) {
            io.to(`user:${participantId}`).emit("messages_read", {
              conversationId,
              userId,
            });
          }
        });
      }
    } catch (error) {
      console.error("Error in mark_as_read event:", error);
    }
  });
}
