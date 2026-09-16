import mongoose from "mongoose";
import { ConversationModel, MessageModel } from "../models/index.js";
import { isUserOnline } from "./socket.service.js";

export const getConversationMessages = async (
  userId,
  conversationId,
  page,
  limit,
) => {
  if (!mongoose.Types.ObjectId.isValid(conversationId)) {
    throw new Error("Invalid conversation ID");
  }

  const conversation = await ConversationModel.findOne({
    _id: conversationId,
    participants: userId,
  });

  if (!conversation) {
    throw new Error("Conversation not found");
  }

  // Mark all messages from other users as read by the current user
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

  const skip = (page - 1) * limit;

  const totalMessages = await MessageModel.countDocuments({
    conversation: conversationId,
  });

  const messages = await MessageModel
    .find({ conversation: conversationId })
    .populate("sender", "name phone avatar")
    .populate({
      path: "parentMessage",
      populate: {
        path: "sender",
        select: "name",
      },
    })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  return {
    messages: messages.reverse(),
    page,
    limit,
    hasMore: skip + messages.length < totalMessages,
  };
};

export const sendMessage = async (senderId, data) => {
  const { conversationId, messageType = "text", mediaUrl, text, parentMessageId } = data;

  if (!conversationId) {
    throw new Error("Conversation ID is required");
  }

  if (!mongoose.Types.ObjectId.isValid(conversationId)) {
    throw new Error("Invalid conversation ID");
  }

  if (messageType === "text" && (!text || !text.trim())) {
    throw new Error("Message cannot be empty");
  }

  if (messageType !== "text" && !mediaUrl) {
    throw new Error("Media URL is required for attachments");
  }

  const conversation = await ConversationModel.findOne({
    _id: conversationId,
    participants: senderId,
  });

  if (!conversation) {
    throw new Error("Conversation not found");
  }

  const deliveredTo = [];
  const readBy = [];

  // Check if other participants are online to mark as delivered
  for (const participantId of conversation.participants) {
    const pIdStr = participantId.toString();
    if (pIdStr !== senderId.toString()) {
      if (isUserOnline(pIdStr)) {
        deliveredTo.push({
          user: participantId,
          deliveredAt: new Date(),
        });
      }
    }
  }

  const message = await MessageModel.create({
    conversation: conversationId,
    sender: senderId,
    messageType,
    text: text ? text.trim() : "",
    mediaUrl: mediaUrl || "",
    parentMessage: parentMessageId || null,
    deliveredTo,
    readBy,
  });

  conversation.lastMessage = message._id;
  conversation.deletedBy = [];
  await conversation.save();

  await message.populate("sender", "name phone avatar");
  if (message.parentMessage) {
    await message.populate({
      path: "parentMessage",
      populate: {
        path: "sender",
        select: "name",
      },
    });
  }

  return {
    message,
    conversation,
  };
};
