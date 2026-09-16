import { Server } from "socket.io";

let io;

export const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });
  return io;
};

export const getIO = ()=>{
      if (!io) {
    throw new Error("Socket.io has not been initialized!");
  }

  return io;
}