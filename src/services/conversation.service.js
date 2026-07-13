import mongoose from "mongoose";
import { ConversationModel, UserModel, MessageModel } from "../models/index.js";
import { isUserOnline } from "./socket.service.js";

export const findOrCreatePrivateConversation = async (senderId, receiverId) => {
  if (!receiverId) {
    throw new Error("Receiver ID is required");
  }
  if (!mongoose.Types.ObjectId.isValid(receiverId)) {
    throw new Error("Invalid receiver ID");
  }

  if (senderId.toString() === receiverId.toString()) {
    throw new Error("You cannot start a conversation with yourself");
  }

  const receiver = await UserModel.findById(receiverId);
  if (!receiver) {
    throw new Error("Receiver not found");
  }

  let conversation = await ConversationModel.findOne({
    type: "private",
    participants: {
      $all: [senderId, receiverId],
    },
    $expr: {
      $eq: [{ $size: "$participants" }, 2],
    },
  });

  if (conversation) {
    if (conversation.deletedBy && conversation.deletedBy.length > 0) {
      await ConversationModel.findByIdAndUpdate(conversation._id, {
        $pull: { deletedBy: { $in: [senderId, receiverId] } },
      });
    }
  } else {
    conversation = await ConversationModel.create({
      type: "private",
      participants: [senderId, receiverId],
    });
  }

  const populated = await ConversationModel
    .findById(conversation._id)
    .populate({
      path: "participants",
      select: "-password -passwordHash -resetOtp -resetOtpExpiry -resetToken -resetTokenExpiry",
    })
    .populate("lastMessage");

  const obj = populated.toObject();

  const unreadCount = await MessageModel.countDocuments({
    conversation: obj._id,
    sender: { $ne: senderId },
    "readBy.user": { $ne: senderId },
  });
  obj.unreadCount = unreadCount;

  const otherUser = obj.participants.find(
    (participant) => participant._id.toString() !== senderId.toString()
  );
  if (otherUser) {
    otherUser.isOnline = isUserOnline(otherUser._id.toString());
    obj.user = otherUser;
  }
  delete obj.participants;

  return obj;
};

export const getMyConversations = async (userId) => {
  const conversations = await ConversationModel
    .find({
      participants: userId,
      deletedBy: { $ne: userId },
    })
    .populate({
      path: "participants",
      select: "-password -passwordHash -resetOtp -resetOtpExpiry -resetToken -resetTokenExpiry",
    })
    .populate("lastMessage")
    .sort({ updatedAt: -1 });

  const populatedConversations = await Promise.all(
    conversations.map(async (conversation) => {
      const obj = conversation.toObject();

      const unreadCount = await MessageModel.countDocuments({
        conversation: conversation._id,
        sender: { $ne: userId },
        "readBy.user": { $ne: userId },
      });
      obj.unreadCount = unreadCount;

      if (obj.type === "private") {
        const otherUser = obj.participants.find(
          (participant) => participant._id.toString() !== userId.toString()
        );
        if (otherUser) {
          otherUser.isOnline = isUserOnline(otherUser._id.toString());
          obj.user = otherUser;
        }
        delete obj.participants;
      } else {
        if (obj.participants) {
          obj.participants = obj.participants.map((participant) => {
            participant.isOnline = isUserOnline(participant._id.toString());
            return participant;
          });
        }
      }

      return obj;
    })
  );

  return populatedConversations;
};

export const deleteConversation = async (userId, conversationId) => {
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

  if (!conversation.deletedBy) {
    conversation.deletedBy = [];
  }

  const userIdStr = userId.toString();
  const alreadyDeleted = conversation.deletedBy.some((id) => id.toString() === userIdStr);

  if (!alreadyDeleted) {
    conversation.deletedBy.push(userId);
    await conversation.save();
  }

  return { success: true };
};
