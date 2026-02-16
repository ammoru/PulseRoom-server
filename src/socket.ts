import { Server } from "socket.io";

export function registerSocketHandlers(io: Server) {
  io.on("connection", (socket) => {
    socket.on("poll:join", (payload) => {
      const pollId = typeof payload?.pollId === "string" ? payload.pollId.trim() : "";
      if (!pollId) {
        return;
      }
      socket.join(`poll:${pollId}`);
    });
  });
}
