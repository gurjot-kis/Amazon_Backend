import mongoose from "mongoose";

const conversationSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["private", "group"],
      default: "private",
    },

    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
    ],

    groupName: {
      type: String,
      default: null,
    },

    groupImage: {
      type: String,
      default: null,
    },

    admin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    lastMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },

    deletedBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    isEnded: {
      type: Boolean,
      default: false,
    },

    endedAt: {
      type: Date,
      default: null,
    },

    rating: {
      type: Number,
      min: 1,
      max: 5,
    },

    feedback: {
      type: String,
      default: "",
    },

    ratedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    ratedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("Conversation", conversationSchema);