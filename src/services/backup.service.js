import mongoose from "mongoose";
import { ConversationModel, MessageModel, BackupMessageModel } from "../models/index.js";

export const backupAndRemoveConversation = async (userId, conversationId, reason = "manual_delete") => {
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

  const messages = await MessageModel.find({ conversation: conversationId });

  const backup = await BackupMessageModel.create({
    conversation: conversation._id,
    participants: conversation.participants,
    type: conversation.type,
    groupName: conversation.groupName,
    groupImage: conversation.groupImage,
    admin: conversation.admin,
    lastMessage: conversation.lastMessage,
    deletedBy: conversation.deletedBy,
    isEnded: conversation.isEnded,
    endedAt: conversation.endedAt,
    messages: messages.map((msg) => ({
      conversation: msg.conversation,
      sender: msg.sender,
      messageType: msg.messageType,
      text: msg.text,
      mediaUrl: msg.mediaUrl,
      parentMessage: msg.parentMessage,
      readBy: msg.readBy,
      deliveredTo: msg.deliveredTo,
      createdAt: msg.createdAt,
      updatedAt: msg.updatedAt,
    })),
    backedUpBy: userId,
    backupReason: reason,
  });

  await MessageModel.deleteMany({ conversation: conversationId });
  await ConversationModel.findByIdAndDelete(conversationId);

  return backup;
};
