import {
  addUserSocket,
  removeUserSocket,
  getOnlineUsers,
  isUserOnline,
} from "../services/socket.service.js";

export default function registerPresence(socket) {
  const userId = socket.user._id.toString();

  socket.join(`user:${userId}`);

  const wasOffline = !isUserOnline(userId);

  addUserSocket(userId, socket.id);

  console.log("================================");
  console.log("User Connected");
  console.log("Name:", socket.user.name);
  console.log("UserId:", userId);
  console.log("Room:", `user:${userId}`);
  console.log("SocketId:", socket.id);
  console.log("Online Users:", getOnlineUsers());
  console.log("================================");

  // If this was the user's first connection, broadcast to others that they are online
  if (wasOffline) {
    socket.broadcast.emit("user_online", { userId });
  }

  // Send the list of currently online user IDs to the connected client
  socket.emit("get_online_users", Array.from(getOnlineUsers().keys()));

  socket.on("disconnect", (reason) => {
    removeUserSocket(userId, socket.id);

    console.log("================================");
    console.log("User Disconnected");
    console.log("Name:", socket.user.name);
    console.log("UserId:", userId);
    console.log("SocketId:", socket.id);
    console.log("Reason:", reason);
    console.log("Online Users:", getOnlineUsers());
    console.log("================================");

    // If the user has no remaining active socket connections, they are offline
    const isOffline = !isUserOnline(userId);
    if (isOffline) {
      socket.broadcast.emit("user_offline", { userId });
    }
  });
}