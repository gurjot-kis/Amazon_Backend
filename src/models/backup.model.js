import mongoose from "mongoose";

const backupMessageSchema = new mongoose.Schema(
  {
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
    },

    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
    ],

    type: {
      type: String,
      enum: ["private", "group"],
      required: true,
    },

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

    messages: [
      {
        conversation: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Conversation",
        },

        sender: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },

        messageType: {
          type: String,
          enum: ["text", "image", "video", "file"],
          default: "text",
        },

        text: {
          type: String,
          default: "",
        },

        mediaUrl: String,

        parentMessage: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Message",
        },

        readBy: [
          {
            user: {
              type: mongoose.Schema.Types.ObjectId,
              ref: "User",
            },
            readAt: Date,
          },
        ],

        deliveredTo: [
          {
            user: {
              type: mongoose.Schema.Types.ObjectId,
              ref: "User",
            },
            deliveredAt: Date,
          },
        ],

        createdAt: Date,
        updatedAt: Date,
      },
    ],

    backedUpBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    backupReason: {
      type: String,
      enum: ["end_chat", "manual_delete", "admin_action", "rated_and_removed", "auto_cleanup_unrated"],
      default: "manual_delete",
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("BackupMessage", backupMessageSchema);
