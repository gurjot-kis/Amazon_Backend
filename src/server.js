import "./config/env.js"
import app from "./app.js";
import connectDB from "./config/db.js";
import http from "http";
import { initSocket } from "./config/socket.js";
import registerSocketHandlers from "./socket/socketHandler.js";
import cron from "node-cron";
import * as CronService from "./services/cron.service.js";
import { expireStalePayments } from "./services/payment-expiry.service.js";


const PORT = process.env.PORT || 5000;

const startServer = async () => {
  await connectDB();

  const server = http.createServer(app);
  const io = initSocket(server);

  registerSocketHandlers(io);

  // Schedule cron job to run every hour to cleanup unrated ended conversations
  // cron.schedule("0 * * * *", async () => {
  cron.schedule("*/2 * * * *", async () => {
    console.log("Running cron job: cleanup unrated ended conversations");
    try {
      await CronService.cleanupUnratedEndedConversations(io);
    } catch (error) {
      console.error("Error in cron job execution:", error);
    }
  });

    // Cancel (or rescue) unpaid online orders every minute.
  let paymentExpiryRunning = false;
  cron.schedule("* * * * *", async () => {
    // Skip if the previous run is still going.
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

  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(
      "Cron job scheduled: cleanup unrated ended conversations (every hour)",
    );
  });
};

startServer();
