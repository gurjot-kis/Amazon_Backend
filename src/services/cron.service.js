import { ConversationModel, MessageModel, BackupMessageModel } from "../models/index.js";
import * as BackupService from "./backup.service.js";

/**
 * Cron job service to handle automatic cleanup of unrated ended conversations
 * Runs every hour to check for conversations that have been ended for more than 2 hours
 * without a rating and backs them up automatically
 */

export const cleanupUnratedEndedConversations = async (io = null) => {
  try {
    console.log("Starting cleanup of unrated ended conversations...");

    // Find conversations that are:
    // 1. Ended (isEnded: true)
    // 2. Not rated (rating is null)
    // 3. Ended more than 2 hours ago (use 5 minutes for testing)
    const timeThreshold = new Date(Date.now() - 2 * 60 * 1000); // 5 minutes for testing, change to 2 * 60 * 60 * 1000 for production

    const unratedEndedConversations = await ConversationModel.find({
      isEnded: true,
      rating: { $exists: false },
      endedAt: { $lt: timeThreshold },
    });

    console.log(`Found ${unratedEndedConversations.length} unrated ended conversations older than threshold`);

    let successCount = 0;
    let errorCount = 0;

    for (const conversation of unratedEndedConversations) {
      try {
        // Backup and remove the conversation
        await BackupService.backupAndRemoveConversation(
          conversation.participants[0], // Use first participant as the user
          conversation._id,
          "auto_cleanup_unrated",
          io
        );
        successCount++;
        console.log(`Successfully backed up and removed conversation: ${conversation._id}`);
      } catch (error) {
        errorCount++;
        console.error(`Failed to backup conversation ${conversation._id}:`, error.message);
      }
    }

    console.log(`Cleanup completed. Success: ${successCount}, Errors: ${errorCount}`);
    return {
      total: unratedEndedConversations.length,
      success: successCount,
      errors: errorCount,
    };
  } catch (error) {
    console.error("Error in cleanup cron job:", error);
    throw error;
  }
};
