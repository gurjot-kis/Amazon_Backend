import "./config/env.js";
import app from "./app.js";
import connectDB from "./config/db.js";
import http from "http";
import { initSocket } from "./config/socket.js";
import registerSocketHandlers from "./socket/socketHandler.js";
import { registerCronJobs } from "./config/cron.js";

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  await connectDB();

  const server = http.createServer(app);
  const io = initSocket(server);

  registerSocketHandlers(io);
  registerCronJobs(io);

  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
};

startServer();
