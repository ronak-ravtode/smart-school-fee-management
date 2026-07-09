import { Server as HttpServer } from "http";
import { Server } from "socket.io";

let io: Server;

export function initSocketServer(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN || "http://localhost:5173",
      credentials: true,
    },
    // Edge Case 2: Heartbeat — server pings every 25s, client pong timeout 20s
    pingInterval: 25000,
    pingTimeout: 20000,
  });

  io.on("connection", (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // Respond to client pings with pong
    socket.on("ping", (cb) => {
      if (typeof cb === "function") {
        cb();
      }
    });

    socket.on("disconnect", (reason) => {
      console.log(`Socket disconnected: ${socket.id} — ${reason}`);
    });
  });

  return io;
}

export function getIO(): Server {
  if (!io) {
    throw new Error("Socket.io server not initialized. Call initSocketServer first.");
  }
  return io;
}
