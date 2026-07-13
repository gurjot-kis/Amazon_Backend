import registerPresence from "./presence.socket.js";
import socketAuth from "./socketAuth.js";
import registerChatEvents from "./chat.socket.js";

export default function registerSocketHandlers(io) {
  io.use(socketAuth);

  io.on("connection", (socket) => {
    registerPresence(socket);
    registerChatEvents(io, socket);
  });
}
