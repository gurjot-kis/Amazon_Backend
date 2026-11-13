import cron from "node-cron";
import * as CronService from "../services/cron.service.js";
import { expireStalePayments } from "../services/payment-expiry.service.js";
import NotifyMeService from "../services/notify-me.service.js";

export const registerCronJobs = (io) => {
  //Job : 1 ( Every 2 minutes: cleanup unrated ended conversations)
  //   cron.schedule("*/2 * * * *", async () => {
  //     console.log("[cron] cleanup unrated ended conversations");
  //     try {
  //       await CronService.cleanupUnratedEndedConversations(io);
  //     } catch (error) {
  //       console.error("[cron] cleanupUnratedEndedConversations failed:", error);
  //     }
  //   });
  //   ------------------------------------------------------------------------
  // Job : 2 (Every minute: expire stale payments (skips if previous run still going))
  let paymentExpiryRunning = false;
  cron.schedule("* * * * *", async () => {
    if (paymentExpiryRunning) return;
    paymentExpiryRunning = true;
    try {
      const summary = await expireStalePayments();
      if (summary.checked > 0) console.log("[payment-expiry]", summary);
    } catch (error) {
      console.error("[payment-expiry] run failed:", error?.message);
    } finally {
      paymentExpiryRunning = false;
    }
  });
  //   ------------------------------------------------------------------------
  // Job : 3 (Every 5 minutes: back-in-stock notifications, safety net for any stock change)
  let notifyMeRunning = false;
  cron.schedule("*/5 * * * *", async () => {
    if (notifyMeRunning) return;
    notifyMeRunning = true;
    try {
      const summary = await NotifyMeService.processPending();
      if (summary.sent > 0) console.log("[notify-me]", summary);
    } catch (error) {
      console.error("[notify-me] run failed:", error?.message);
    } finally {
      notifyMeRunning = false;
    }
  });

  console.log("[cron] All jobs registered");
};
